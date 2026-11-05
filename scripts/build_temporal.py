#!/usr/bin/env python3
"""Build the site's temporal data set under public/data from one full-story run.

Reads only:
  --view        work/view_data.json, written in the TSRA repository by
                `sna/temporal/arknights_view.py RUN_ID --json PATH` (stories, events, relation history, personas)
  --periods     the run's inputs/story_periods.json (where each story sits in the run's queue)
  --characters  a zh_CN character_table.json (English names for operators: the `appellation` field)
  --groups      the snapshot's groups.json (the story chronology: a story added later still takes its place in it)
  --old         the previous public/data (story ids, English titles, avatars and banners carry over)
  --new-from    the first queue position of the latest story update; stories at or after it are pinned as new

Writes public/data/manifest.json, people.json, overview.json, media.json, en.json and stories/<id>.json.

Published, data only: story and event positions, each event's title, scene, message count, participants and the
model's summary (what happened, who, how), the relation states over each story once formed (type, friendliness,
dominance, intensity), Big Five histories and character descriptions. Not published, since they describe how the data
was made rather than the data: event salience, the story lines quoted as relation evidence, evidence counts,
confidences, review reasons, the per-update change log, and the run's id and model. check() fails the build if an
evidence quote, the run id or the model id reaches the output.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

CATEGORY = {'主线': 'main', '活动': 'event', '密录': 'record', '集成战略': 'rogue'}
VISIBLE = ('主线', '活动', '密录')          # 集成战略 stays offline, as on the previous site
COLORS = {'主线': '#d3a6a0', '活动': '#a0bfbc', '密录': '#a8b7d2', '集成战略': '#c9a98c'}
DIMS = ('O', 'C', 'E', 'A', 'N')
NEW_TITLES = {'时间啊，向前！': 'Time, Forward!'}   # literal; the English server has not released it yet


def load(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path: Path, value) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    path.write_text(text, encoding='utf-8')
    return len(text.encode('utf-8'))


def r3(x) -> float:
    return round(float(x), 3)


class Local:
    """Queue position -> position inside one story (1-based); a story may come back for a second stretch."""

    def __init__(self, segs):
        self.segs, self.offsets, n = segs, [], 0
        for a, b in segs:
            self.offsets.append(n)
            n += b - a + 1
        self.size = n

    def __call__(self, seq):
        for (a, b), off in zip(self.segs, self.offsets):
            if seq <= b:
                return off + max(0, seq - a) + 1
        return self.size


def old_story_ids(old: Path):
    """Group name -> previous archive entry, so links, banners and English titles keep working."""
    manifest = load(old / 'manifest.json')
    return {a['source']: a for a in manifest['archives'] if a['category'] in CATEGORY}


def old_avatars(old: Path, story_by_group):
    """(story id, name) -> avatar key and name -> avatar key for named people, from the previous site."""
    media = load(old / 'media.json')
    by_story, by_name = {}, Counter()
    votes = defaultdict(Counter)
    for archive in story_by_group.values():
        path = old / 'archives' / f"{archive['id']}.json"
        if not path.exists():
            continue
        for node in load(path)['nodes']:
            key = media['avatars'].get(node['id'])
            if key:
                by_story[archive['id'], node['name']] = key
                votes[node['name']][key, node['id']] += 1
    # a name that kept one node across stories is a named person; generic names change node per story
    by_name = {}
    for name, c in votes.items():
        nodes = {node for _, node in c}
        if len(nodes) == 1 or c.most_common(1)[0][1] >= 2 and len({k for k, _ in c}) == 1:
            by_name[name] = c.most_common(1)[0][0][0]
    return by_story, by_name, media


def title_of(group, category):
    rest = group.split(' · ', 1)[1]
    if category == '主线':
        chapter, _, name = rest.partition(' · ')
        return name or chapter, f'主线 · {chapter}'
    if category == '集成战略':
        number = re.match(r'#(\d+)\s*(.*)', rest)
        return (number.group(2) or f'第 {number.group(1)} 季'), f'集成战略 · 第 {number.group(1)} 季'
    return rest, category


def build(args):
    view = load(args.view)
    periods = defaultdict(list)
    for p in load(args.periods):
        periods[p['label']].append([p['start_seq'], p['end_seq']])
    characters = load(args.characters)
    previous = old_story_ids(args.old)
    old_en = load(args.old / 'en.json')
    people, ids = view['people'], view['ids']

    # story ids: the previous id where the story existed, the next free number in its category otherwise
    used = Counter()
    for a in previous.values():
        m = re.match(r'([a-z]+)-(\d+)$', a['id'])
        if m:
            used[m.group(1)] = max(used[m.group(1)], int(m.group(2)))
    stories, files, finals = [], {}, []
    for index, s in enumerate(view['stories']):
        group, category = s['n'], s['c']
        if category not in VISIBLE:
            continue
        old = previous.get(group)
        if old:
            sid = old['id']
        else:
            prefix = CATEGORY[category]
            used[prefix] += 1
            sid = f'{prefix}-{used[prefix]:03d}'
        title, code = (old['title'], old['code']) if old else title_of(group, category)
        segs = periods[group]
        local = Local(segs)
        if local.size != s['m']:
            raise SystemExit(f'{group}: periods cover {local.size} messages, the view counts {s["m"]}')
        events = [[local(e[0]), local(e[1]), e[2], e[3], e[4], e[6], e[7]] for e in s['ev']]   # e[5] salience left out
        # relation states once formed: one row per change of a pair's state, positions inside the story
        last, rows = {}, []
        for c in s['ch']:
            seq, o, t, kind, octant, ben, power, inten, conf, formed = c[:10]
            if not formed:
                continue
            state = (octant, r3(ben), r3(power), r3(inten))
            if last.get((o, t)) == state:
                continue
            last[o, t] = state
            rows.append([local(seq), o, t, *state])
        who = [[p, n, local(first)] for p, n, first in s['who']]
        story_index = len(stories)
        for (o, t), state in last.items():
            finals.append([story_index, o, t, *state])
        named = lambda p: people[p][1] < 3
        relations = list(last)
        top = [people[p][0] for p, *_ in sorted(s['who'], key=lambda w: -w[1]) if named(p) and people[p][1] != 2][:3]
        new = None
        if segs[-1][1] >= args.new_from:
            new = 'new' if segs[0][0] >= args.new_from else 'updated'
        stories.append({
            'id': sid, 'title': title, 'category': category, 'code': code, 'order': index, 'group': group,
            'color': (old or {}).get('color') or COLORS[category], 'segs': segs, 'm': s['m'], 'sc': s['sc'],
            'ev': len(events), 'rel': sum(named(o) and named(t) for o, t in relations), 'relAll': len(relations),
            'speakers': len(who), 'named': sum(named(p) for p, *_ in who), 'top': top, **({'new': new} if new else {})})
        files[sid] = {'id': sid, 'segs': segs, 'm': s['m'], 'sc': s['sc'], 'who': who, 'ev': events, 'ch': rows}

    # people: name, operator English name, scope (0 operator, 1 named, 2 Doctor, 3 generic), messages
    by_story_avatar, by_name_avatar, old_media = old_avatars(args.old, previous)
    avatar_files = {p.stem for p in (args.old.parent / 'media' / 'avatars').glob('*.webp')}
    seen_in = defaultdict(set)
    for s in stories:
        for p, *_ in files[s['id']]['who']:
            seen_in[p].add(s['id'])
    avatars = {}
    for p, (name, scope, _) in enumerate(people):
        key = None
        if scope < 3:
            key = by_name_avatar.get(name) or (ids[p] if ids[p] in avatar_files else None)
        else:
            key = next((by_story_avatar[sid, name] for sid in sorted(seen_in[p]) if (sid, name) in by_story_avatar), None)
        if key:
            avatars[p] = key
    english = {}
    for p, pid in enumerate(ids):
        row = characters.get(pid)
        if row and row.get('appellation') and people[p][1] == 0:
            english[p] = row['appellation'].strip()
    rows = [[name, english.get(p, ''), scope, n] for p, (name, scope, n) in enumerate(people)]
    persona = {}
    for p, x in view['persona'].items():
        hist = [[seq, [None if v.get(k) is None else r3(v[k]) for k in DIMS]] for seq, v in x['h']]
        persona[p] = {'d': x['d'], 'h': hist}

    archive_media = {}
    for s in stories:
        old = old_media['archives'].get(s['id'], {})
        cast = []
        for name in s['top']:
            p = next((q for q, *_ in files[s['id']]['who'] if people[q][0] == name), None)
            cast.append(avatars.get(p) if p is not None else None)
        entry = {'cast': cast}
        if old.get('banner'):
            entry['banner'] = old['banner']
        if old.get('lead'):
            entry['lead'] = old['lead']
        archive_media[s['id']] = entry

    en_titles = dict(old_en['archives'])
    for s in stories:
        if s['id'] in en_titles:
            continue
        if s['title'] in NEW_TITLES:
            en_titles[s['id']] = NEW_TITLES[s['title']]
        elif s['category'] == '密录':
            lead = next((english[p] for p, (name, *_) in enumerate(people)
                         if p in english and (name == s['title'] or name.endswith(f"（{s['title']}）"))), None)
            if lead:
                en_titles[s['id']] = lead
    events = {sid: kind for sid, kind in (old_en.get('events') or {}).items()}
    for s in stories:
        if s['category'] == '活动' and s['id'] not in events:
            events[s['id']] = 'side'

    named = lambda p: people[p][1] < 3
    totals = {
        'stories': len(stories), 'messages': sum(s['m'] for s in stories), 'scenes': sum(s['sc'] for s in stories),
        'events': sum(s['ev'] for s in stories), 'relations': sum(s['rel'] for s in stories),
        'relationsAll': sum(s['relAll'] for s in stories),
        'people': len({p for s in stories for p, *_ in files[s['id']]['who']}),
        'namedPeople': len({p for s in stories for p, *_ in files[s['id']]['who'] if named(p)}),
    }
    manifest = {
        'info': {'version': args.version, 'newFrom': args.new_from,
                 'updated': args.updated, 'totals': totals},
        'stories': stories,
    }
    # stories in the site's story chronology, as the snapshot orders its groups; the replay queue appended the update
    groups = {g['group_id']: g for g in load(args.groups)}
    def chrono(s):
        g = groups[s['group']]
        return (g['tier'], tuple(g['anchor']) if g['anchor'] else (9999, 0, 0), g['tie'], g['rank'])
    ranked = sorted(range(len(stories)), key=lambda i: chrono(stories[i]))
    where = {old: new for new, old in enumerate(ranked)}
    stories = [stories[i] for i in ranked]
    for i, s in enumerate(stories):
        s['order'] = i
    finals = sorted(([where[f[0]], *f[1:]] for f in finals), key=lambda f: f[0])
    manifest['stories'] = stories
    return manifest, files, {'people': rows, 'persona': persona}, {'finals': finals}, \
        {'avatars': {str(k): v for k, v in avatars.items()}, 'archives': archive_media}, \
        {**old_en, 'version': args.version_en, 'archives': en_titles, 'events': events}


QUOTE_FIELDS = ('line_keys', 'quotes')


def check(view, out: Path):
    """Nothing quoted as relation evidence, and neither the run id nor the model id, may reach the published files."""
    quotes = set()
    for s in view['stories']:
        for e in s['ev']:
            for x in e[8]:
                quotes.update(q for q in x[6] if len(q) >= 12)
    published = ''.join(p.read_text(encoding='utf-8') for p in out.rglob('*.json'))
    for label, value in (('run id', view['run']['id']), ('model id', view['run']['model'])):
        if value in published:
            raise SystemExit(f'the {label} {value!r} found in the output')
    leaked = [q for q in quotes if q in published]
    if leaked:
        raise SystemExit(f'{len(leaked)} evidence quotes found in the output, e.g. {leaked[0]!r}')
    return len(quotes)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--view', type=Path, required=True)
    ap.add_argument('--periods', type=Path, required=True)
    ap.add_argument('--characters', type=Path, required=True)
    ap.add_argument('--groups', type=Path, required=True)
    ap.add_argument('--old', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--new-from', type=int, required=True)
    ap.add_argument('--updated', default='2026-11-03')
    ap.add_argument('--version', default='全剧情第二轮，2026-11-03')
    ap.add_argument('--version-en', default='Full story, second round, 2026-11-03')
    args = ap.parse_args()
    manifest, files, people, overview, media, en = build(args)
    out = args.out
    if out.exists() and any(out.iterdir()) and out.resolve() == args.old.resolve():
        raise SystemExit('write to a fresh directory; --old is read while building')
    size = write(out / 'manifest.json', manifest)
    for sid, data in files.items():
        size += write(out / 'stories' / f'{sid}.json', data)
    size += write(out / 'people.json', people) + write(out / 'overview.json', overview)
    size += write(out / 'media.json', media) + write(out / 'en.json', en)
    checked = check(load(args.view), out)
    t = manifest['info']['totals']
    print(f"{out}: {len(files)} stories, {t['messages']:,} messages, {t['events']:,} events, {t['relations']:,} named "
          f"relations, {len(people['people']):,} people, {size / 1048576:.1f} MB; {checked:,} evidence quotes checked absent")


if __name__ == '__main__':
    main()
