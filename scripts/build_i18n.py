#!/usr/bin/env python3
"""Build the English names the site shows in English mode: public/data/en.json.

Run after build_data.py. Reads only:
  --zh-stories  zh_CN gamedata/excel/story_review_table.json (Kengxxiao/ArknightsGameData)
  --en-stories  en_US gamedata/excel/story_review_table.json (Kengxxiao/ArknightsGameData_YoStar)
  --zh-scripts  zh_CN gamedata/story directory (optional)
  --en-scripts  en_US gamedata/story directory (optional)
  --data        public/data (manifest.json and archives/*.json written by build_data.py)

Story titles are the official English titles, joined on the story id whose
Chinese title matches. Stories the English server has not released yet keep
their Chinese title. Events are split the way the English server's story
archive splits them: Side Stories (ACTIVITY) and Story Collections
(MINI_ACTIVITY), from the Chinese table, so unreleased events are split too.
Operator names come from the `en` field build_data.py already wrote
(character_table appellation). Story characters who are not operators
(Talulah, Wei Yenwu, "Infected") get the name the English script gives
them: the two servers' scripts are read side by side, speaker tag for speaker
tag, after lining up each file's commands (sprites, sounds, timings), which
the servers share; a Chinese name takes the English name it is paired with
at least twice and in 80% of pairings or more.

Names and titles with no official English get the literal translations in
scripts/i18n/names_literal.tsv and titles_literal.tsv; an official name
always wins over them. Writes:
  {"version": ..., "archives": {id: title}, "events": {id: "side" | "collection"},
   "names": {中文名: English}}
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path


SPEAKER = re.compile(r'^\[name="([^"]*)"\]')
QUOTES = "“”\"'‘’「」"


def skeleton(text: str) -> tuple[list[str], list[str | None]]:
    """One token per script line, equal across servers except for the words.

    Commands keep their full text (sprites, sounds and timings match between
    servers); speaker lines become NAME and plain text becomes TEXT.
    """
    tokens, names = [], []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = SPEAKER.match(line)
        if m:
            tokens.append("NAME")
            names.append(m.group(1).strip())
        elif line.startswith("["):
            tokens.append(line.split("]")[0].lower())
            names.append(None)
        else:
            tokens.append("TEXT")
            names.append(None)
    return tokens, names


def script_names(zh_dir: Path, en_dir: Path) -> dict[str, str]:
    """Chinese speaker name → English speaker name, from aligned story scripts."""
    pairs: dict[str, Counter] = defaultdict(Counter)
    aligned = 0
    for zh_path in sorted(zh_dir.rglob("*.txt")):
        en_path = en_dir / zh_path.relative_to(zh_dir)
        if not en_path.exists():
            continue
        zt, zn = skeleton(zh_path.read_text(encoding="utf-8", errors="replace"))
        et, en = skeleton(en_path.read_text(encoding="utf-8", errors="replace"))
        aligned += 1
        matcher = SequenceMatcher(None, zt, et, autojunk=False)
        for block in matcher.get_matching_blocks():
            for i in range(block.size):
                z, e = zn[block.a + i], en[block.b + i]
                if z and e and z != e:
                    pairs[z][e] += 1
                    # “灰礼帽” and 灰礼帽 are one speaker; count the bare name too.
                    if quoted(z) and quoted(e):
                        pairs[z[1:-1]][e[1:-1]] += 1
    out = {}
    for z, c in pairs.items():
        e, n = c.most_common(1)[0]
        if n >= 2 and n / sum(c.values()) >= 0.8:
            out[z] = e
    print(f"scripts: {aligned} files aligned, {len(out)} speaker names")
    return out


def quoted(name: str) -> bool:
    return len(name) > 2 and name[0] in QUOTES and name[-1] in QUOTES


def english_name(zh: str, names: dict[str, str]) -> str | None:
    """Looks a name up with and without its quotes: “灰礼帽” → “Trilby Asher”."""
    if zh in names:
        return names[zh]
    bare = zh[1:-1] if quoted(zh) else zh
    if bare != zh and bare in names:
        return "\u201c" + names[bare] + "\u201d"
    return None


def read_tsv(path: Path) -> list[list[str]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [line.split("\t") for line in lines if line and not line.startswith("#")]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zh-stories", type=Path, required=True)
    ap.add_argument("--en-stories", type=Path, required=True)
    ap.add_argument("--zh-scripts", type=Path)
    ap.add_argument("--en-scripts", type=Path)
    ap.add_argument("--data", type=Path, default=Path(__file__).resolve().parent.parent / "public" / "data")
    ap.add_argument("--version-label", default="v2 candidate (stage 3), 2026-10-14")
    args = ap.parse_args()

    zh = json.loads(args.zh_stories.read_text(encoding="utf-8"))
    en = json.loads(args.en_stories.read_text(encoding="utf-8"))
    manifest = json.loads((args.data / "manifest.json").read_text(encoding="utf-8"))

    # Every English spelling seen for a Chinese name; the commonest wins.
    seen: dict[str, Counter] = defaultdict(Counter)
    for path in sorted((args.data / "archives").glob("*.json")):
        for node in json.loads(path.read_text(encoding="utf-8"))["nodes"]:
            if node["en"]:
                seen[node["name"]][node["en"]] += 1
    operators = {zh_name: c.most_common(1)[0][0] for zh_name, c in sorted(seen.items())}
    speakers = script_names(args.zh_scripts, args.en_scripts) if args.zh_scripts and args.en_scripts else {}
    literal_dir = Path(__file__).resolve().parent / "i18n"
    literal = {zh: en for zh, en in read_tsv(literal_dir / "names_literal.tsv")}
    names = {**literal, **speakers, **operators}

    ids: dict[str, list[str]] = defaultdict(list)
    for key, story in zh.items():
        ids[story["name"]].append(key)
    titles: dict[str, str] = {}
    events: dict[str, str] = {}
    kinds = {"ACTIVITY": "side", "MINI_ACTIVITY": "collection"}
    for a in manifest["archives"]:
        if a["category"] == "活动":
            found = {kinds.get(zh[k]["entryType"]) for k in ids.get(a["title"], [])} - {None}
            if len(found) == 1:
                events[a["id"]] = found.pop()
        if a["category"] == "密录":
            if english_name(a["title"], names):
                titles[a["id"]] = english_name(a["title"], names)
            continue
        english = [en[k]["name"] for k in ids.get(a["title"], []) if k in en]
        if english:
            titles[a["id"]] = english[0]

    # Every name a page can show: story titles, the most connected, and every node.
    for aid, _zh, title in read_tsv(literal_dir / "titles_literal.tsv"):
        titles.setdefault(aid, title)

    used = {n for a in manifest["archives"] for n in [a["title"], *a["top"]]}
    for path in (args.data / "archives").glob("*.json"):
        used.update(n["name"] for n in json.loads(path.read_text(encoding="utf-8"))["nodes"])
    out = {
        "version": args.version_label,
        "archives": titles,
        "events": events,
        "names": {k: v for k in sorted(used) if (v := english_name(k, names))},
    }
    path = args.data / "en.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    shown = [a for a in manifest["archives"] if a["category"] in ("主线", "活动", "密录")]
    print(f"{path}: {sum(a['id'] in titles for a in shown)}/{len(shown)} titles, "
          f"{len(events)} events split, {len(out['names'])} names")


if __name__ == "__main__":
    main()
