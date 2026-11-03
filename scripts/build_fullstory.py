#!/usr/bin/env python3
"""Build public/data/fullstory.json, the full-story table of named characters, from the TSRA site data.

Reads only:
  --data      work/fullstory_data.json, written in the TSRA repository by
              `sna/temporal/fullstory_network.py RUN_ID --site PATH` (story values, values as of each story, turns,
              arcs as of each story, Big Five as of each story; snapshot ids and story names, no text)
  --view      work/view_data.json (its `ids` give the site's person index of each snapshot id)
  --manifest  public/data/manifest.json (the site's story index of each story name)

Published, data only: per relation and story the story-end value, the value as of that story over all stories and
within its category (主线 or 活动), turn marks, arcs as of each story and Big Five as of each story. The evidence
counts and uncertainty that weigh the values stay in TSRA. Positions are story indices into `stories` (0-based,
chronological); people are site person indices. Run scripts/layout_fullstory.ts afterwards: it adds the fixed layouts.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def build(data: dict, view: dict, manifest: dict) -> dict:
    person = {pid: i for i, pid in enumerate(view['ids'])}
    missing = [pid for pid in data['people'] if pid not in person]
    if missing:
        raise SystemExit(f'{len(missing)} people of the table are not in the view, e.g. {missing[:3]}')
    story = {s['group']: i for i, s in enumerate(manifest['stories'])}
    gone = [s for s in data['stories'] if s not in story]
    if gone:
        raise SystemExit(f'{len(gone)} stories of the table are not on the site, e.g. {gone[:3]}')
    p = [person[pid] for pid in data['people']]
    return {
        'run': data['run'],
        'stories': [story[s] for s in data['stories']],
        'lines': [[p[a], t, n] for a, t, n in data['lines']],
        'pairs': [[p[a], p[b]] for a, b in data['pairs']],
        'values': data['values'],
        'arcs': [[a, [p[x] for x in top], first, last] for a, top, first, last in data['arcs']],
        'arcOf': [[p[a], changes] for a, changes in data['arcOf']],
        'bigFive': [[p[a], history] for a, history in data['bigFive']],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--data', type=Path, default=Path('work/fullstory_data.json'))
    ap.add_argument('--view', type=Path, default=Path('work/view_data.json'))
    ap.add_argument('--manifest', type=Path, default=Path('public/data/manifest.json'))
    ap.add_argument('--out', type=Path, default=Path('public/data/fullstory.json'))
    args = ap.parse_args()
    table = build(load(args.data), load(args.view), load(args.manifest))
    text = json.dumps(table, ensure_ascii=False, separators=(',', ':'))
    banned = [k for k in ('evidence', 'confidence', '"V"') if k in text]
    if banned:
        raise SystemExit(f'the table carries {banned}')
    args.out.write_text(text, encoding='utf-8')
    print(f'{args.out}: {len(table["stories"])} stories, {len({x for pair in table["pairs"] for x in pair}):,} people, '
          f'{len(table["values"]):,} story values, {len(table["arcs"])} arc ids, {len(text.encode()) / 1024:.0f} kB')


if __name__ == '__main__':
    main()
