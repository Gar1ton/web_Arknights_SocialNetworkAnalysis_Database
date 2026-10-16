#!/usr/bin/env python3
"""Build character avatars and story banners for the site under public/media.

Run after build_data.py. Reads only (SQLite opened with mode=ro&immutable=1):
  --db        v2 database (identity_bindings: physical id per persona)
  --linemap   2.cleaned/snapshots/fullstory_20261011/all_ready.linemap.jsonl
  --sources   1.raw/arknights_selected_sources.zip (raw stage scripts)
  --appendix  Appendix/ with Characters/*.png avatars and prop/index.csv banners
  --data      public/data (manifest.json and archives/*.json written by build_data.py)

Operators and the Doctor use their own avatar. Other speakers get the avatar
of the stage sprite in focus while they talk, when one sprite clearly
dominates and an avatar exists for it. Writes public/data/media.json, which
maps node ids to avatar keys and archives to banners and cast avatars, and
re-encodes only the images it references as WebP (ffmpeg with libwebp).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sqlite3
import subprocess
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

# Stage sprites whose avatar uses a different file name, checked by eye.
SPRITE_ALIASES = {
    "char_011_talula": "npc_011_talula",
    "char_105_emper": "npc_105_emperor",
    "char_2005_weiyw": "npc_2005_wywu",
    "char_2006_weiywfmzuki": "npc_2006_fmzuki",
    "avg_npc_025": "npc_025_patriot",
    "avg_npc_052": "npc_052_ines",
    "avg_npc_058": "npc_058_shield",
    "avg_npc_077": "npc_077_blades",
    "avg_npc_078": "npc_011_talula",
    "avg_npc_1297": "npc_1297_theresis",
}
# Chapters 7 and 8 opened with these celebrations; their banners announce them.
MAIN_BANNERS = {"苦难摇篮": "一周年庆典", "怒号光明": "2020「感谢庆典」"}
AVATAR_SIZE = 180  # source size; not upscaled
BANNER_WIDTH = 1024
ARG = re.compile(r'(\w+)\s*=\s*("([^"]*)"|[^,)\s]+)')


# ── stage sprites ─────────────────────────────────────────────────────────────

def command(line: str) -> tuple[str | None, dict[str, str]]:
    m = re.match(r"\s*\[(\w+)\s*(?:\((.*)\))?\s*\]", line)
    if not m:
        return None, {}
    args = {k.lower(): q if v.startswith('"') else v for k, v, q in ARG.findall(m.group(2) or "")}
    return m.group(1).lower(), args


def focused_sprites(text: str) -> dict[int, str]:
    """1-based line number -> sprite in focus while that line is shown."""
    out: dict[int, str] = {}
    slots: dict[str, str] = {}
    focus: str | None = None
    for number, line in enumerate(text.splitlines(), 1):
        cmd, a = command(line)
        if cmd == "character":
            slots = {k: a[n] for k, n in (("1", "name"), ("2", "name2")) if a.get(n)}
            focus = a.get("focus") or (next(iter(slots)) if len(slots) == 1 else None)
        elif cmd == "charslot":
            slot = a.get("slot")
            if not a or (not slot and not a.get("name") and "focus" not in a):
                slots, focus = {}, None
                continue
            if slot:
                if a.get("name"):
                    slots[slot] = a["name"]
                else:
                    slots.pop(slot, None)
            if "focus" in a:
                focus = a["focus"]
            elif len(slots) == 1:
                focus = next(iter(slots))
            elif slot and a.get("name"):
                focus = None
        elif cmd in ("name", "multiline") or (cmd is None and line.strip()):
            sprite = slots.get(focus) if focus else None
            if sprite:
                out[number] = sprite
    return out


def sprite_tally(linemap: Path, sources: Path) -> dict[str, Counter]:
    """Physical speaker id -> Counter of sprites in focus on their lines."""
    tally: dict[str, Counter] = defaultdict(Counter)
    scenes: dict[str, dict[int, str]] = {}
    with zipfile.ZipFile(sources) as z, linemap.open(encoding="utf-8") as f:
        for row in f:
            r = json.loads(row)
            if r.get("kind") != "dialogue":
                continue
            scene, _, pos = r["line_key"].partition("#")
            if scene not in scenes:
                try:
                    text = z.read(f"raw_scripts/{scene}.txt").decode("utf-8", "replace")
                except KeyError:
                    text = ""
                scenes[scene] = focused_sprites(text)
            sprite = scenes[scene].get(int(pos.split(".")[0]))
            if sprite:
                tally[r["user_id"]][sprite] += 1
    return tally


def avatar_for_sprite(sprite: str, avatars: set[str]) -> str | None:
    base = re.split(r"[#$]", sprite.strip())[0].strip().lower()
    for name in (base, base[4:] if base.startswith("avg_") else ""):
        parts = name.split("_") if name else []
        while len(parts) >= 2:  # drop variant suffixes: _1, _2, _ex …
            key = "_".join(parts)
            if key in avatars:
                return key
            if key in SPRITE_ALIASES and SPRITE_ALIASES[key] in avatars:
                return SPRITE_ALIASES[key]
            parts.pop()
    return None


def speaker_avatars(tally: dict[str, Counter], avatars: set[str], operators: set[str]) -> dict[str, str]:
    """Physical id -> avatar, when one avatar clearly dominates their lines."""
    out = {}
    for pid, sprites in tally.items():
        total = sum(sprites.values())
        votes: Counter = Counter()
        for sprite, n in sprites.items():
            key = avatar_for_sprite(sprite, avatars)
            # Another operator's own avatar means the speaker is someone else on stage.
            if key and not (key in operators and key != pid):
                votes[key] += n
        ranked = votes.most_common(2)
        if not ranked:
            continue
        key, n = ranked[0]
        runner = ranked[1][1] if len(ranked) > 1 else 0
        if n >= 2 and n >= 0.35 * total and n >= 2 * runner:
            out[pid] = key
    return out


# ── banners ───────────────────────────────────────────────────────────────────

def plain(text: str) -> str:
    return re.sub(r"[\s·・:：！!？?“”\"'—\-「」]", "", text)


def story_banners(manifest: list[dict], prop: Path) -> dict[str, Path]:
    rows = []
    with (prop / "index.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            parts = r["info"].split()
            path = prop / r["type"] / r["file"]
            if len(parts) > 2 and path.exists():
                rows.append({"type": r["type"], "date": r["date"], "name": parts[2], "path": path})
    rows.sort(key=lambda r: r["date"])  # first release before reruns
    out = {}
    for a in manifest:
        if a["category"] not in ("主线", "活动"):
            continue
        want = plain(MAIN_BANNERS.get(a["title"], a["title"]))
        same = [r for r in rows if r["type"] == a["category"]] + [r for r in rows if r["type"] != a["category"]]
        hit = next((r for r in same if plain(r["name"].removesuffix("·复刻")) == want), None)
        if not hit and a["category"] == "主线":
            hit = next((r for r in same if r["type"] == "主线" and want in plain(r["name"])), None)
        if hit:
            out[a["id"]] = hit["path"]
    return out


# ── output ────────────────────────────────────────────────────────────────────

def encode(src: Path, dst: Path, scale: str, quality: int) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", scale, "-c:v", "libwebp",
         "-pix_fmt", "yuva420p", "-quality", str(quality), "-compression_level", "6", str(dst)],
        check=True,
    )


def sync(folder: Path, wanted: dict[str, tuple[Path, str, int]], force: bool) -> None:
    """Write wanted name -> (source, scale filter, quality); remove anything else."""
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.webp"):
        if old.stem not in wanted:
            old.unlink()
    for name, (src, scale, quality) in sorted(wanted.items()):
        dst = folder / f"{name}.webp"
        if force or not dst.exists():
            encode(src, dst, scale, quality)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True, type=Path)
    ap.add_argument("--linemap", required=True, type=Path)
    ap.add_argument("--sources", required=True, type=Path)
    ap.add_argument("--appendix", required=True, type=Path)
    root = Path(__file__).resolve().parent.parent / "public"
    ap.add_argument("--data", default=root / "data", type=Path)
    ap.add_argument("--out", default=root / "media", type=Path)
    ap.add_argument("--force", action="store_true", help="re-encode images that already exist")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required")

    portraits = args.appendix / "Characters"
    # Keys become file names and URLs, so only plain ones are used.
    files = {p.stem.lower(): p for p in portraits.glob("*.png") if re.fullmatch(r"[a-z0-9_]+", p.stem.lower())}
    avatars = set(files)

    con = sqlite3.connect(f"file:{args.db.resolve()}?mode=ro&immutable=1", uri=True)
    physical = {uid: pid for pid, uid in con.execute("SELECT physical_id, uid FROM identity_bindings")}
    con.close()
    operators = {pid for pid in physical.values() if pid.startswith("char_")}

    manifest = json.loads((args.data / "manifest.json").read_text(encoding="utf-8"))["archives"]
    archives = {a["id"]: json.loads((args.data / "archives" / f"{a['id']}.json").read_text(encoding="utf-8"))
                for a in manifest}
    width = len(next(n["id"] for d in archives.values() for n in d["nodes"])) - 1
    short = {"p" + uid.replace("-", "")[:width]: pid for uid, pid in physical.items()}

    spoken = speaker_avatars(sprite_tally(args.linemap, args.sources), avatars, operators)

    def avatar(pid: str) -> str | None:
        if pid == "doctor":
            return "npc_001_doctor" if "npc_001_doctor" in avatars else None
        return pid if pid in avatars else spoken.get(pid)

    node_avatar: dict[str, str] = {}
    for data in archives.values():
        for n in data["nodes"]:
            key = avatar(short.get(n["id"], ""))
            if key:
                node_avatar[n["id"]] = key

    banners = story_banners(manifest, args.appendix / "prop")
    cards = {}
    for a in manifest:
        nodes = archives[a["id"]]["nodes"]
        top = sorted(nodes, key=lambda x: (-x["degree"], -x["messages"], x["id"]))[: len(a["top"])]
        card: dict = {"cast": [node_avatar.get(n["id"]) for n in top]}
        if a["id"] in banners:
            card["banner"] = f"media/banners/{a['id']}.webp"
        if a["category"] == "密录":
            lead = next((n for n in nodes if n["name"] == a["title"] and n["id"] in node_avatar), None)
            if lead:
                card["lead"] = node_avatar[lead["id"]]
        cards[a["id"]] = card

    used = set(node_avatar.values())
    sync(args.out / "avatars", {k: (files[k], f"scale={AVATAR_SIZE}:{AVATAR_SIZE}", 84) for k in used}, args.force)
    sync(args.out / "banners", {aid: (src, f"scale={BANNER_WIDTH}:-2", 78) for aid, src in banners.items()}, args.force)
    media = {"avatars": dict(sorted(node_avatar.items())), "archives": cards}
    (args.data / "media.json").write_text(json.dumps(media, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    stories = [a for a in manifest if a["category"] in ("主线", "活动")]
    print(f"{len(node_avatar)} nodes with avatars ({len(used)} images, {len(spoken)} from stage sprites)")
    print(f"{sum(a['id'] in banners for a in stories)}/{len(stories)} main and event stories with banners")


if __name__ == "__main__":
    main()
