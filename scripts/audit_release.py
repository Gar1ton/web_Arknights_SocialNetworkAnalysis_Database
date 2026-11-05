#!/usr/bin/env python3
"""Fail if an offline build holds anything beyond the published data and the page that shows it.

    audit_release.py BUILD_DIR [--view work/view_data.json] [--exe PATH.exe]

BUILD_DIR  is checked for file types, source maps, field names, run and model identifiers, machine paths,
           network addresses and image metadata.
--view     adds the run's own evidence quotes, run id and model id to the search (default: work/view_data.json
           when it exists; it stays out of every build).
--exe      also searches the finished binary for machine paths and identifiers.
"""
from __future__ import annotations

import argparse
import json
import re
import struct
import sys
from pathlib import Path

FILE_TYPES = {'.html', '.js', '.css', '.json', '.webp', '.woff', '.woff2', '.svg'}
# Every field name the site publishes. A new one has to be looked at and added here on purpose.
FIELDS = set("""arcOf archives arcs avatars banner bigFive cast category ch code color d ev events finals group h id info
layouts lead lines m messages named namedPeople names new newFrom order pairs people persona rel relAll relations
relationsAll sc scenes segs speakers stories title top totals updated values version who""".split())
ID_LIKE = re.compile(r'\d|[^\x00-\x7f]|^(char|token|trap|avg|npc|g)_|-')
# Objects keyed by a name or a story id rather than by a field name.
ID_MAPS = {'names', 'archives', 'events', 'avatars'}
INTERNAL = re.compile(
    r'qwen|gemini|\bclaude\b|gpt-\d|deepseek|llama|anthropic|openai|arc:(chat|embed)|embedvl|moirai|oedipus|horae|aoede'
    r'|fullstory_r\d|allstory|\d{8}-\d\d_|ablation|/home/|/mnt/|[A-Za-z]:\\\\?(Users|DEV)|drgar',
    re.I)
# Addresses the page may hold: links the reader can click, XML namespaces, React's error pointer.
ALLOWED_URLS = re.compile(
    r'https?://(www\.w3\.org/|github\.com/(Gar1ton|MKiyoaki)\b|creativecommons\.org/licenses/by-nc-sa/4\.0/|react\.dev/errors/)')
URL = re.compile(r'https?://[A-Za-z0-9./_%-]+')
BINARY_INTERNAL = re.compile(rb'/home/[a-z0-9_-]+|drgar|qwen|fullstory_r\d', re.I)


def walk(value, found, parent=''):
    if isinstance(value, dict):
        for k, v in value.items():
            if parent not in ID_MAPS and not ID_LIKE.search(k):
                found['keys'].add(k)
            walk(v, found, k)
    elif isinstance(value, list):
        for v in value:
            walk(v, found)
    elif isinstance(value, str):
        found['strings'].append(value)


def webp_metadata(raw: bytes):
    i, chunks = 12, []
    while i + 8 <= len(raw):
        size = struct.unpack('<I', raw[i + 4:i + 8])[0]
        chunks.append(raw[i:i + 4])
        i += 8 + size + (size & 1)
    return [c.decode() for c in chunks if c in (b'EXIF', b'XMP ')]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('build', type=Path)
    ap.add_argument('--view', type=Path, default=Path('work/view_data.json'))
    ap.add_argument('--exe', type=Path)
    args = ap.parse_args()

    problems, files = [], [p for p in args.build.rglob('*') if p.is_file()]
    if not files:
        raise SystemExit(f'nothing to audit in {args.build}')
    found = {'keys': set(), 'strings': []}
    text = {}
    for path in files:
        name = path.relative_to(args.build)
        if path.suffix not in FILE_TYPES:
            problems.append(f'{name}: file type not allowed')
        if path.suffix in {'.html', '.js', '.css', '.json', '.svg'}:
            text[name] = path.read_text(encoding='utf-8')
        if path.suffix == '.json':
            walk(json.loads(text[name]), found)
        if path.suffix == '.webp' and (extra := webp_metadata(path.read_bytes())):
            problems.append(f'{name}: image metadata {extra}')

    if unknown := found['keys'] - FIELDS:
        problems.append(f'unknown data fields: {sorted(unknown)}')
    for name, content in text.items():
        if 'sourceMappingURL' in content:
            problems.append(f'{name}: source map reference')
        for m in INTERNAL.finditer(content):
            problems.append(f'{name}: internal text {content[max(0, m.start() - 30):m.end() + 30]!r}')
        if name.suffix in {'.html', '.js', '.css'}:
            for url in URL.findall(content):
                if not ALLOWED_URLS.match(url):
                    problems.append(f'{name}: address {url}')

    checked = 0
    if args.view.exists():
        view = json.loads(args.view.read_text(encoding='utf-8'))
        published = ''.join(text.values())
        for label, value in (('run id', view['run']['id']), ('model id', view['run']['model'])):
            if value in published:
                problems.append(f'the {label} is in the build')
        quotes = {q for s in view['stories'] for e in s['ev'] for x in e[8] for q in x[6] if len(q) >= 6}
        checked = len(quotes)
        problems += [f'evidence quote in the build: {q!r}' for q in quotes if q in published]
    else:
        print(f'note: {args.view} not found, evidence quotes not checked')

    if args.exe:
        raw = args.exe.read_bytes()
        hits = sorted({m.group(0).decode('latin-1') for m in BINARY_INTERNAL.finditer(raw)})
        if hits:
            problems.append(f'{args.exe.name}: internal text {hits}')

    if problems:
        print(f'{len(problems)} problems')
        for p in problems[:40]:
            print(' -', p)
        sys.exit(1)
    print(f'clean: {len(files)} files, {len(found["strings"]):,} data strings, {len(found["keys"])} field names, '
          f'{checked:,} evidence quotes absent' + (f', {args.exe.name} clean' if args.exe else ''))


if __name__ == '__main__':
    main()
