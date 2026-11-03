import {
  type ArchiveData,
  type ArchiveStats,
  type AtlasEdge,
  type AtlasNode,
  type Community,
  type Direction,
  octantKeys,
} from "../data";
import type { Core } from "./load";
import {
  bisect,
  personaAt,
  stateAt,
  toQueue,
  type IndexedStory,
  type Keep,
} from "./model";
import { BEN, INT, OBS, POW, SEQ, SUB, TYPE, type StateRow } from "./types";
/**
 * The previous site drew one finished network per story (nodes and unordered
 * edges, with communities and betweenness). This module rebuilds that shape
 * from the story's relation history at any position, so the graph, the detail
 * panels, the export and the report panel keep working while the timeline
 * moves. Node ids are "p<person>".
 */
export const nodeId = (p: number) => `p${p}`;
export const personOf = (id: string) => +id.slice(1);
export const edgeId = (a: number, b: number) =>
  a < b ? `p${a}-p${b}` : `p${b}-p${a}`;
const KIND: AtlasNode["kind"][] = ["named", "named", "doctor", "npc"];
const MAX_COMMUNITIES = 8;
/** Big Five from −1…1 to the 0–100 the profile panel shows. */
export const toHundred = (v: number | null) =>
  v == null ? null : Math.round(((v + 1) / 2) * 100);
type Pair = { a: number; b: number; ab: StateRow[]; ba: StateRow[] };
export interface StoryAtlas {
  story: IndexedStory;
  pairs: Map<string, Pair>;
  /** Start positions of the events each pair shares, ascending. */
  shared: Map<string, number[]>;
  maxShared: number;
  communities: Community[];
  community: Map<number, number>;
  /** The network as the story ends, for the layout and the counts. */
  full: ArchiveData;
  /** Relations formed after each change, for the timeline curve. */
  series: { pos: number; n: number }[];
  /** Positions where some relation changes. */
  stops: number[];
}
/** Deterministic Louvain modularity communities (the previous build's algorithm). */
export function louvain(
  nodes: number[],
  weights: Map<string, [number, number, number]>,
): Map<number, number> {
  const index = new Map(nodes.map((n, i) => [n, i]));
  let graph = new Map<number, Map<number, number>>(
    nodes.map((_, i) => [i, new Map()]),
  );
  for (const [a, b, w] of weights.values()) {
    const i = index.get(a)!,
      j = index.get(b)!;
    graph.get(i)!.set(j, (graph.get(i)!.get(j) ?? 0) + w);
    graph.get(j)!.set(i, (graph.get(j)!.get(i) ?? 0) + w);
  }
  let member = nodes.map((_, i) => i);
  for (let round = 0; round < 30; round++) {
    const degree = new Map<number, number>();
    for (const [n, nb] of graph)
      degree.set(
        n,
        [...nb.values()].reduce((s, w) => s + w, 0),
      );
    const m2 = [...degree.values()].reduce((s, w) => s + w, 0);
    if (m2 <= 0) break;
    const comm = new Map([...graph.keys()].map((n) => [n, n]));
    const total = new Map(degree);
    let improved = false,
      moved = true,
      passes = 0;
    const order = [...graph.keys()].sort((a, b) => a - b);
    while (moved && passes < 100) {
      moved = false;
      passes++;
      for (const n of order) {
        const own = comm.get(n)!;
        const links = new Map<number, number>();
        for (const [other, w] of graph.get(n)!)
          if (other !== n)
            links.set(comm.get(other)!, (links.get(comm.get(other)!) ?? 0) + w);
        total.set(own, total.get(own)! - degree.get(n)!);
        let best = own,
          gain = (links.get(own) ?? 0) - (total.get(own)! * degree.get(n)!) / m2;
        for (const c of [...links.keys()].sort((a, b) => a - b)) {
          const g = links.get(c)! - (total.get(c)! * degree.get(n)!) / m2;
          if (g > gain + 1e-12) {
            best = c;
            gain = g;
          }
        }
        total.set(best, total.get(best)! + degree.get(n)!);
        comm.set(n, best);
        if (best !== own) moved = improved = true;
      }
    }
    if (!improved) break;
    member = member.map((c) => comm.get(c)!);
    const merged = new Map<number, Map<number, number>>(
      [...new Set(comm.values())].map((c) => [c, new Map()]),
    );
    for (const [n, nb] of graph)
      for (const [other, w] of nb) {
        const a = comm.get(n)!,
          b = comm.get(other)!;
        merged.get(a)!.set(b, (merged.get(a)!.get(b) ?? 0) + w);
      }
    graph = merged;
  }
  return new Map(nodes.map((n, i) => [n, member[i]]));
}
/** Brandes betweenness on the undirected, unweighted graph, normalised to 0–1. */
export function betweenness(
  nodes: string[],
  neighbours: Map<string, Set<string>>,
): Map<string, number> {
  const score = new Map(nodes.map((n) => [n, 0]));
  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(nodes.map((n) => [n, []]));
    const sigma = new Map(nodes.map((n) => [n, 0]));
    const dist = new Map(nodes.map((n) => [n, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue = [s];
    for (let head = 0; head < queue.length; head++) {
      const v = queue[head];
      stack.push(v);
      for (const w of neighbours.get(v) ?? []) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }
    const delta = new Map(nodes.map((n) => [n, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!)
        delta.set(
          v,
          delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!),
        );
      if (w !== s) score.set(w, score.get(w)! + delta.get(w)!);
    }
  }
  const n = nodes.length;
  const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
  return new Map([...score].map(([k, v]) => [k, v * scale]));
}
const direction = (r: StateRow): Direction => ({
  type: octantKeys[r[TYPE]],
  benevolence: r[BEN],
  power: r[POW],
  intensity: r[INT],
});
export function buildAtlas(core: Core, story: IndexedStory, keep: Keep): StoryAtlas {
  const pairs = new Map<string, Pair>();
  for (const rows of story.pairs.values()) {
    const o = rows[0][OBS],
      t = rows[0][SUB];
    if (!keep(o, t)) continue;
    const [a, b] = o < t ? [o, t] : [t, o];
    const id = edgeId(a, b);
    const pair = pairs.get(id) ?? { a, b, ab: [], ba: [] };
    if (o === a) pair.ab = rows;
    else pair.ba = rows;
    pairs.set(id, pair);
  }
  // Events two people take part in together: the previous site's tie strength.
  const shared = new Map<string, number[]>();
  for (const e of story.data.ev) {
    const who = [...new Set(e[5])];
    for (let i = 0; i < who.length; i++)
      for (let j = i + 1; j < who.length; j++) {
        const id = edgeId(who[i], who[j]);
        if (!pairs.has(id)) continue;
        const list = shared.get(id);
        if (list) list.push(e[0]);
        else shared.set(id, [e[0]]);
      }
  }
  const maxShared = Math.max(1, ...[...shared.values()].map((l) => l.length));
  const people = [...new Set([...pairs.values()].flatMap((p) => [p.a, p.b]))].sort(
    (x, y) => x - y,
  );
  const weights = new Map<string, [number, number, number]>();
  for (const [id, p] of pairs)
    weights.set(id, [p.a, p.b, 1 + Math.log1p(shared.get(id)?.length ?? 0)]);
  const raw = louvain(people, weights);
  const groups = new Map<number, number[]>();
  for (const p of people) {
    const g = groups.get(raw.get(p)!);
    if (g) g.push(p);
    else groups.set(raw.get(p)!, [p]);
  }
  const degree = new Map<number, number>();
  for (const p of pairs.values()) {
    degree.set(p.a, (degree.get(p.a) ?? 0) + 1);
    degree.set(p.b, (degree.get(p.b) ?? 0) + 1);
  }
  const said = (p: number) => story.said.get(p)?.[1] ?? 0;
  const ranked = [...groups.values()].sort(
    (x, y) => y.length - x.length || Math.min(...x) - Math.min(...y),
  );
  const communities: Community[] = [];
  const community = new Map<number, number>();
  for (const g of ranked.filter((g) => g.length >= 3).slice(0, MAX_COMMUNITIES)) {
    const lead = [...g].sort(
      (x, y) =>
        (degree.get(y) ?? 0) - (degree.get(x) ?? 0) || said(y) - said(x) || x - y,
    )[0];
    for (const p of g) community.set(p, communities.length);
    communities.push({
      label: `${core.people.people[lead][0]} 等 ${g.length} 人`,
      size: g.length,
    });
  }
  const rest = people.filter((p) => !community.has(p));
  if (rest.length) {
    for (const p of rest) community.set(p, communities.length);
    communities.push({ label: `其他 ${rest.length} 人`, size: rest.length });
  }
  const rows = [...story.data.ch]
    .filter((r) => keep(r[OBS], r[SUB]))
    .sort((a, b) => a[SEQ] - b[SEQ]);
  const series: { pos: number; n: number }[] = [];
  const formed = new Set<string>();
  rows.forEach((r, i) => {
    formed.add(r[OBS] + "|" + r[SUB]);
    if (i === rows.length - 1 || rows[i + 1][SEQ] !== r[SEQ])
      series.push({ pos: r[SEQ], n: formed.size });
  });
  const atlas: StoryAtlas = {
    story,
    pairs,
    shared,
    maxShared,
    communities,
    community,
    full: null as unknown as ArchiveData,
    series,
    stops: series.map((p) => p.pos),
  };
  atlas.full = atlasAt(core, atlas, story.data.m);
  return atlas;
}
/** Window in which a relation that just changed glows on the graph. */
export const freshWindow = (m: number) => Math.max(40, m / 60);
export type AtlasAt = ArchiveData & {
  /** Edges whose state changed at the latest change before the position. */
  fresh: Set<string>;
};
export function atlasAt(core: Core, atlas: StoryAtlas, pos: number): AtlasAt {
  const { story } = atlas;
  const last = atlas.stops[bisect(atlas.stops, pos, (v) => v) - 1];
  const glowing = last !== undefined && pos - last < freshWindow(story.data.m);
  const edges: AtlasEdge[] = [];
  const fresh = new Set<string>();
  const outDeg = new Map<number, number>(),
    inDeg = new Map<number, number>();
  const octants = Object.fromEntries(octantKeys.map((k) => [k, 0])) as ArchiveStats["octants"];
  let relations = 0,
    benevolence = 0,
    power = 0;
  for (const [id, p] of atlas.pairs) {
    const ab = stateAt(p.ab, pos),
      ba = stateAt(p.ba, pos);
    if (!ab && !ba) continue;
    const events = bisect(atlas.shared.get(id) ?? [], pos, (v) => v);
    edges.push({
      id,
      source: nodeId(p.a),
      target: nodeId(p.b),
      events,
      weight:
        Math.round(
          Math.max(0.08, Math.log1p(events) / Math.log1p(atlas.maxShared)) * 1000,
        ) / 1000,
      ab: ab && direction(ab),
      ba: ba && direction(ba),
    });
    if (glowing && ((ab && ab[SEQ] === last) || (ba && ba[SEQ] === last))) fresh.add(id);
    for (const [r, from, to] of [
      [ab, p.a, p.b],
      [ba, p.b, p.a],
    ] as const)
      if (r) {
        relations++;
        benevolence += r[BEN];
        power += r[POW];
        octants[octantKeys[r[TYPE]]]++;
        outDeg.set(from, (outDeg.get(from) ?? 0) + 1);
        inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
      }
  }
  const neighbours = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!neighbours.has(e.source)) neighbours.set(e.source, new Set());
    if (!neighbours.has(e.target)) neighbours.set(e.target, new Set());
    neighbours.get(e.source)!.add(e.target);
    neighbours.get(e.target)!.add(e.source);
  }
  const ids = [...neighbours.keys()].sort();
  const between = betweenness(ids, neighbours);
  const seq = toQueue(story.data.segs, pos);
  const nodes: AtlasNode[] = ids.map((id) => {
    const p = personOf(id);
    const [name, en, scope] = core.people.people[p];
    const persona = core.people.persona[String(p)];
    const v = personaAt(persona, seq) ?? [null, null, null, null, null];
    return {
      id,
      name,
      en: scope === 2 ? en || "Doctor" : en,
      kind: KIND[scope],
      messages: story.said.get(p)?.[1] ?? 0,
      community: atlas.community.get(p) ?? 0,
      degree: neighbours.get(id)!.size,
      outDegree: outDeg.get(p) ?? 0,
      inDegree: inDeg.get(p) ?? 0,
      betweenness: Math.round(between.get(id)! * 10000) / 10000,
      profile: {
        description: persona?.d ?? "",
        bigFive: v.map(toHundred),
      },
    };
  });
  const n = nodes.length;
  const mutual = edges.filter((e) => e.ab && e.ba).length;
  return {
    id: story.meta.id,
    communities: atlas.communities,
    stats: {
      nodes: n,
      pairs: edges.length,
      relations,
      mutual,
      density: n > 1 ? Math.round((edges.length / ((n * (n - 1)) / 2)) * 10000) / 10000 : 0,
      reciprocity: edges.length ? Math.round((mutual / edges.length) * 10000) / 10000 : 0,
      avgDegree: n ? Math.round(((2 * edges.length) / n) * 100) / 100 : 0,
      octants,
      avgBenevolence: relations ? benevolence / relations : 0,
      avgPower: relations ? power / relations : 0,
    },
    nodes,
    edges,
    fresh,
  };
}
/** Both directions of one pair over the story, for the relation detail. */
export function pairHistory(atlas: StoryAtlas, id: string) {
  return atlas.pairs.get(id) ?? null;
}
