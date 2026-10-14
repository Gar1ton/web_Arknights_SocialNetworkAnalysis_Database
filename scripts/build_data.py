#!/usr/bin/env python3
"""Build the static data set under public/data from the Amiya SNA results.

Reads only (SQLite opened with mode=ro&immutable=1, JSON files read-only):
  --db         v2 database (stage3_tail_fix_final/realtime_test.db)
  --groups     2.cleaned/snapshots/fullstory_20261011/groups.json (story order)
  --fullgraph  5.fullgraph/fullgraph_run_<id>.json (cross-story merged graphs)
  --characters 1.raw/reference_tables/character_table.json (English names only)

Exports only IPC relations, network structure/metrics/communities and Big Five
profiles. Script text, quotes, event summaries and speaking-style quotes are
never written. Output is deterministic for the same inputs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

OCTANTS = ("affinity", "active", "dominant", "arrogant", "cold", "withdrawn", "submissive", "deferential")
DIMS = ("O", "C", "E", "A", "N")
CATEGORY = {"主线": "main", "活动": "event", "密录": "record", "集成战略": "rogue"}
COLORS = ["#d3a6a0", "#b49baa", "#d2997e", "#a0bfbc", "#a8b7d2", "#c69abd", "#b5a788", "#c9a98c"]
OVERVIEW = {
    "【合成】全剧情 · 具名角色": ("all", "全剧情总表", "全部剧情合并计算，只含具名角色与博士。"),
    "【合成】主线 · 具名角色": ("all-main", "主线合并", "第 0–17 章合并计算，只含具名角色。"),
    "【合成】活动 · 具名角色": ("all-event", "活动合并", "全部活动剧情合并计算，只含具名角色。"),
    "【合成】密录 · 具名角色": ("all-record", "密录合并", "全部干员密录合并计算，只含具名角色。"),
    "【合成】集成战略 · 具名角色": ("all-rogue", "集成战略合并", "六季集成战略合并计算，只含具名角色。"),
}
MAX_COMMUNITIES = 9


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def r3(x: float) -> float:
    return round(float(x), 3)


def pct(x) -> int | None:
    return None if x is None else round((float(x) + 1) / 2 * 100)


# ── network metrics ───────────────────────────────────────────────────────────

def louvain(nodes: list[str], weights: dict[tuple[str, str], float]) -> dict[str, int]:
    """Deterministic Louvain modularity communities on an undirected graph."""
    index = {n: i for i, n in enumerate(nodes)}
    graph: dict[int, dict[int, float]] = {i: {} for i in range(len(nodes))}
    for (a, b), w in weights.items():
        i, j = index[a], index[b]
        graph[i][j] = graph[i].get(j, 0.0) + w
        graph[j][i] = graph[j].get(i, 0.0) + w
    member = list(range(len(nodes)))
    for _ in range(30):
        degree = {n: sum(nb.values()) for n, nb in graph.items()}
        m2 = sum(degree.values())
        if m2 <= 0:
            break
        comm = {n: n for n in graph}
        total = dict(degree)
        improved, passes = False, 0
        moved = True
        while moved and passes < 100:
            moved, passes = False, passes + 1
            for n in sorted(graph):
                own = comm[n]
                links: dict[int, float] = defaultdict(float)
                for other, w in graph[n].items():
                    if other != n:
                        links[comm[other]] += w
                total[own] -= degree[n]
                best, gain = own, links.get(own, 0.0) - total[own] * degree[n] / m2
                for c in sorted(links):
                    g = links[c] - total[c] * degree[n] / m2
                    if g > gain + 1e-12:
                        best, gain = c, g
                total[best] += degree[n]
                comm[n] = best
                if best != own:
                    moved = improved = True
        if not improved:
            break
        member = [comm[c] for c in member]
        merged: dict[int, dict[int, float]] = {c: {} for c in set(comm.values())}
        for n, nb in graph.items():
            for other, w in nb.items():
                a, b = comm[n], comm[other]
                merged[a][b] = merged[a].get(b, 0.0) + w
        graph = merged
    return {n: member[i] for i, n in enumerate(nodes)}


def betweenness(nodes: list[str], neighbours: dict[str, set[str]]) -> dict[str, float]:
    """Brandes betweenness on the undirected, unweighted graph, normalised to 0–1."""
    score = dict.fromkeys(nodes, 0.0)
    for s in nodes:
        stack, pred = [], {n: [] for n in nodes}
        sigma, dist = dict.fromkeys(nodes, 0.0), dict.fromkeys(nodes, -1)
        sigma[s], dist[s] = 1.0, 0
        queue, head = [s], 0
        while head < len(queue):
            v = queue[head]
            head += 1
            stack.append(v)
            for w in sorted(neighbours[v]):
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)
        delta = dict.fromkeys(nodes, 0.0)
        while stack:
            w = stack.pop()
            for v in pred[w]:
                delta[v] += sigma[v] / sigma[w] * (1 + delta[w])
            if w != s:
                score[w] += delta[w]
    n = len(nodes)
    scale = 1 / ((n - 1) * (n - 2)) if n > 2 else 0.0
    return {k: v * scale for k, v in score.items()}


# ── archive assembly ──────────────────────────────────────────────────────────

def direction(row: dict) -> dict:
    out = {
        "type": row["type"],
        "benevolence": r3(row["benevolence"]),
        "power": r3(row["power"]),
        "intensity": r3(row["intensity"]),
        "confidence": r3(row["confidence"]),
        "evidence": int(row["evidence"]),
    }
    if row.get("scopes"):
        out["scopes"] = int(row["scopes"])
    return out


def build_archive(meta, relations, persons, profiles, messages, shared, short):
    """relations: {(observer, subject): row}; messages/shared: totals within the archive."""
    pairs: dict[tuple[str, str], dict] = {}
    for (o, s), row in relations.items():
        a, b = sorted((short[o], short[s]))
        edge = pairs.setdefault((a, b), {"ab": None, "ba": None})
        edge["ab" if short[o] == a else "ba"] = direction(row)
    uid_of = {short[u]: u for u in persons}
    ids = sorted({x for p in pairs for x in p})
    max_events = max([shared.get(p, 0) for p in pairs] + [1])
    edges = []
    for (a, b) in sorted(pairs):
        ev = shared.get((a, b), 0)
        edges.append({
            "id": f"{a}-{b}",
            "source": a,
            "target": b,
            "events": ev,
            "weight": r3(max(0.08, math.log1p(ev) / math.log1p(max_events))),
            "ab": pairs[(a, b)]["ab"],
            "ba": pairs[(a, b)]["ba"],
        })
    neighbours = {i: set() for i in ids}
    out_deg, in_deg = Counter(), Counter()
    for (o, s) in relations:
        out_deg[short[o]] += 1
        in_deg[short[s]] += 1
    for e in edges:
        neighbours[e["source"]].add(e["target"])
        neighbours[e["target"]].add(e["source"])
    between = betweenness(ids, neighbours)
    raw = louvain(ids, {(e["source"], e["target"]): 1 + math.log1p(e["events"]) for e in edges})
    groups: dict[int, list[str]] = defaultdict(list)
    for i in ids:
        groups[raw[i]].append(i)
    ranked = sorted(groups.values(), key=lambda g: (-len(g), min(g)))
    big = [g for g in ranked if len(g) >= 3][:MAX_COMMUNITIES]
    community = {}
    communities = []
    for idx, g in enumerate(big):
        lead = max(g, key=lambda i: (len(neighbours[i]), messages.get(uid_of[i], 0), -ids.index(i)))
        communities.append({"label": f"{persons[uid_of[lead]]['name']} 等 {len(g)} 人", "size": len(g)})
        for i in g:
            community[i] = idx
    rest = [i for i in ids if i not in community]
    if rest:
        communities.append({"label": f"其他 {len(rest)} 人", "size": len(rest)})
        for i in rest:
            community[i] = len(communities) - 1
    nodes = []
    for i in ids:
        uid = uid_of[i]
        p = persons[uid]
        nodes.append({
            "id": i,
            "name": p["name"],
            "en": p["en"],
            "kind": p["kind"],
            "messages": messages.get(uid, 0),
            "community": community[i],
            "degree": len(neighbours[i]),
            "outDegree": out_deg[i],
            "inDegree": in_deg[i],
            "betweenness": round(between[i], 4),
            "profile": profiles[uid],
        })
    n = len(nodes)
    mutual = sum(1 for e in edges if e["ab"] and e["ba"])
    octants = Counter(r["type"] for r in relations.values())
    stats = {
        "nodes": n,
        "pairs": len(edges),
        "relations": len(relations),
        "mutual": mutual,
        "density": round(len(edges) / (n * (n - 1) / 2), 4) if n > 1 else 0,
        "reciprocity": round(mutual / len(edges), 4) if edges else 0,
        "avgDegree": round(2 * len(edges) / n, 2) if n else 0,
        "octants": {k: octants.get(k, 0) for k in OCTANTS},
        "avgBenevolence": r3(sum(r["benevolence"] for r in relations.values()) / len(relations)),
        "avgPower": r3(sum(r["power"] for r in relations.values()) / len(relations)),
    }
    top = sorted(nodes, key=lambda x: (-x["degree"], -x["messages"], x["id"]))[:3]
    entry = dict(meta, nodes=n, pairs=len(edges), relations=len(relations), top=[t["name"] for t in top])
    return entry, {"id": meta["id"], "communities": communities, "stats": stats, "nodes": nodes, "edges": edges}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", required=True, type=Path)
    ap.add_argument("--groups", required=True, type=Path)
    ap.add_argument("--fullgraph", required=True, type=Path)
    ap.add_argument("--characters", required=True, type=Path)
    ap.add_argument("--out", default=Path(__file__).resolve().parent.parent / "public" / "data", type=Path)
    ap.add_argument("--version-label", default="v2 候选（stage3），2026-10-14")
    args = ap.parse_args()

    con = sqlite3.connect(f"file:{args.db.resolve()}?mode=ro&immutable=1", uri=True)
    order = {g["group_id"]: g["rank"] for g in json.loads(args.groups.read_text(encoding="utf-8"))}
    chars = json.loads(args.characters.read_text(encoding="utf-8"))

    # People, profiles (Big Five + personality summary only)
    physical = {uid: pid for pid, uid in con.execute("SELECT physical_id, uid FROM identity_bindings")}
    persons, profiles = {}, {}
    for uid, name, attrs, conf in con.execute("SELECT uid, primary_name, persona_attrs, confidence FROM personas"):
        pid = physical.get(uid, "")
        kind = "doctor" if pid == "doctor" else "named" if pid.startswith("char_") else "npc"
        en = (chars.get(pid) or {}).get("appellation") or ("Doctor" if kind == "doctor" else "")
        persons[uid] = {"name": name, "en": en.strip(), "kind": kind}
        a = json.loads(attrs or "{}")
        bf = a.get("big_five") if isinstance(a.get("big_five"), dict) else {}
        ev = a.get("big_five_evidence") if isinstance(a.get("big_five_evidence"), dict) else {}
        profiles[uid] = {
            "description": str(a.get("description") or ""),
            "bigFive": [pct(bf.get(d)) for d in DIMS],
            "evidence": [str(ev[d]) if isinstance(ev.get(d), str) and d in bf else None for d in DIMS],
            "confidence": r3(conf),
        }
    for width in range(8, 37):
        short = {uid: "p" + uid.replace("-", "")[:width] for uid in persons}
        if len(set(short.values())) == len(short):
            break

    # Lines spoken and shared events per group
    spoken: dict[str, Counter] = defaultdict(Counter)
    for gid, uid, n in con.execute("SELECT group_id, sender_uid, COUNT(*) FROM raw_messages GROUP BY 1, 2"):
        spoken[gid][uid] = n
    together: dict[str, Counter] = defaultdict(Counter)
    for gid, parts in con.execute("SELECT group_id, participants FROM events"):
        ids = sorted({short[u] for u in json.loads(parts or "[]") if u in short})
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                together[gid][(ids[i], ids[j])] += 1

    # Per-group relations (placeholder impressions with confidence 0 are skipped)
    per_scope: dict[str, dict] = defaultdict(dict)
    for o, s, scope, typ, b, p, inten, conf, ev in con.execute(
        "SELECT observer_uid, subject_uid, scope, ipc_orientation, benevolence, power, affect_intensity,"
        " confidence, evidence_event_ids FROM impressions WHERE confidence > 0 ORDER BY id"
    ):
        if o == s or o not in persons or s not in persons:
            continue
        row = {"type": typ, "benevolence": b, "power": p, "intensity": inten, "confidence": conf,
               "evidence": len(json.loads(ev or "[]"))}
        prev = per_scope[scope].get((o, s))
        if prev is None or row["confidence"] > prev["confidence"]:
            per_scope[scope][(o, s)] = row
    con.close()

    out = args.out
    (out / "archives").mkdir(parents=True, exist_ok=True)
    for old in (out / "archives").glob("*.json"):
        old.unlink()
    manifest, written = [], 0

    def emit(meta, relations, messages, shared):
        nonlocal written
        involved = {u for pair in relations for u in pair}
        entry, data = build_archive(meta, relations, {u: persons[u] for u in involved},
                                    profiles, messages, shared, short)
        (out / "archives" / f"{meta['id']}.json").write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest.append(entry)
        written += 1

    # Merged cross-story graphs from 5.fullgraph
    side = json.loads(args.fullgraph.read_text(encoding="utf-8"))
    for order_index, card in enumerate(c for c in side["cards"] if c["key"] in OVERVIEW):
        aid, title, desc = OVERVIEW[card["key"]]
        cats = [k for k in CATEGORY if k in card["key"]] or list(CATEGORY)
        scopes = [g for g in spoken if g.split(" · ")[0] in cats]
        relations = {}
        for item in card["edges"]:
            d = item["data"]
            st = d.get("belief_state") or {}
            relations[(d["source"], d["target"])] = {
                "type": d["label"], "benevolence": d["affect"], "power": d["power"],
                "intensity": d["intensity"], "confidence": d["confidence"],
                "evidence": st.get("n_evidence", len(d.get("evidence_event_ids") or [])),
                "scopes": st.get("n_scopes", 1),
            }
        messages, shared = Counter(), Counter()
        for g in scopes:
            messages.update(spoken[g])
            shared.update(together[g])
        emit({"id": aid, "title": title, "category": "总览", "code": "总览 · " + ("全部剧情" if aid == "all" else card["key"].split("】")[1].split(" · ")[0]),
              "order": order_index, "description": desc, "color": COLORS[order_index % len(COLORS)],
              "source": card["key"]}, relations, messages, shared)

    # One archive per story group, in story order
    counters = Counter()
    for scope in sorted(per_scope, key=lambda g: (list(CATEGORY).index(g.split(" · ")[0]), order.get(g, 10**6), g)):
        parts = scope.split(" · ")
        cat = parts[0]
        kind = CATEGORY[cat]
        counters[kind] += 1
        if kind == "main":
            num = int(re.search(r"\d+", parts[1]).group())
            aid, title, code, rank = f"main-{num:02d}", parts[2], f"主线 · {parts[1]}", num
        elif kind == "rogue":
            m = re.match(r"#(\d+)\s*(.*)", parts[1])
            num = int(m.group(1))
            aid, title, code, rank = f"rogue-{num}", m.group(2) or f"集成战略 #{num}", f"集成战略 · 第 {num} 季", num
        else:
            aid, title, code, rank = f"{kind}-{counters[kind]:03d}", parts[1], cat, order.get(scope, 10**6)
        emit({"id": aid, "title": title, "category": cat, "code": code, "order": rank,
              "description": "", "color": COLORS[(len(manifest) * 3) % len(COLORS)], "source": scope},
             per_scope[scope], spoken[scope], together[scope])

    cat_order = ["总览", *CATEGORY]
    manifest.sort(key=lambda a: (cat_order.index(a["category"]), a["order"], a["id"]))
    for a in manifest:
        if not a["description"]:
            a["description"] = f"{a['nodes']} 名角色，{a['pairs']} 组关系。关系最多的是 {'、'.join(a['top'])}。"
    named = sum(1 for p in persons.values() if p["kind"] != "npc")
    info = {
        "version": args.version_label,
        "sources": {
            "database": {"sha256": sha256(args.db)},
            "groups": {"sha256": sha256(args.groups)},
            "fullgraph": {"sha256": sha256(args.fullgraph), "runId": side.get("run_id")},
            "characters": {"sha256": sha256(args.characters), "fields": ["appellation"]},
        },
        "totals": {
            "stories": sum(1 for a in manifest if a["category"] != "总览"),
            "people": len(persons),
            "namedPeople": named,
            "relations": sum(len(v) for v in per_scope.values()),
        },
    }
    (out / "manifest.json").write_text(
        json.dumps({"info": info, "archives": manifest}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {written} archives to {out}")


if __name__ == "__main__":
    main()
