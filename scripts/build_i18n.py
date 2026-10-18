#!/usr/bin/env python3
"""Build the English names the site shows in English mode: public/data/en.json.

Run after build_data.py. Reads only:
  --zh-stories  zh_CN gamedata/excel/story_review_table.json (Kengxxiao/ArknightsGameData)
  --en-stories  en_US gamedata/excel/story_review_table.json (Kengxxiao/ArknightsGameData_YoStar)
  --data        public/data (manifest.json and archives/*.json written by build_data.py)

Story titles are the official English titles, joined on the story id whose
Chinese title matches. Stories the English server has not released yet keep
their Chinese title. Events are split the way the English server's story
archive splits them: Side Stories (ACTIVITY) and Story Collections
(MINI_ACTIVITY), from the Chinese table, so unreleased events are split too.
Character names come from the `en` field build_data.py already wrote
(character_table appellation). Writes:
  {"version": ..., "archives": {id: title}, "events": {id: "side" | "collection"},
   "names": {中文名: English}}
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--zh-stories", type=Path, required=True)
    ap.add_argument("--en-stories", type=Path, required=True)
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
    names = {zh_name: c.most_common(1)[0][0] for zh_name, c in sorted(seen.items())}

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
            if a["title"] in names:
                titles[a["id"]] = names[a["title"]]
            continue
        english = [en[k]["name"] for k in ids.get(a["title"], []) if k in en]
        if english:
            titles[a["id"]] = english[0]

    used = {n for a in manifest["archives"] for n in [a["title"], *a["top"]]}
    out = {
        "version": args.version_label,
        "archives": titles,
        "events": events,
        "names": {k: v for k, v in names.items() if k in used},
    }
    path = args.data / "en.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    shown = [a for a in manifest["archives"] if a["category"] in ("主线", "活动", "密录")]
    print(f"{path}: {sum(a['id'] in titles for a in shown)}/{len(shown)} titles, "
          f"{len(events)} events split, {len(out['names'])} names")


if __name__ == "__main__":
    main()
