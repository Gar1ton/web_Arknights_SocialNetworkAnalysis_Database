import { type AtlasEdge, type AtlasNode, type ArchiveStats, type Community, type Direction, octantKeys } from "../data";
import type { Core } from "./load";
import { useLoaded } from "./load";
import { bisect } from "./model";
import { edgeId, nodeId, toHundred, type AtlasAt } from "./atlas";
import type { StateRow } from "./types";
/**
 * The full-story table of named characters (public/data/fullstory.json, built by scripts/build_fullstory.py
 * from TSRA's fullstory_network.py --site). Time is the story index t = 0..stories.length-1 in chronological
 * order. A relation at story t is its value as of t: the mean of its story values since its last turn, each
 * weighted by the events of its story; a turn is a story that breaks clearly from the ones before and restarts
 * the value. The values exist over all stories and within each category, for the 主线 / 活动 filter.
 */
export interface FullStoryData {
  run: string;
  /** Site story index of each table story, in chronological order. */
  stories: number[];
  /** person, story, lines in that story. */
  lines: [number, number, number][];
  /** observer, subject. */
  pairs: [number, number][];
  /** pair, story, story value b p type, as-of over all stories b p type turn, as-of within the category b p type turn. */
  values: number[][];
  /** arc id, its two people with most evidence, first story, last story. */
  arcs: [number, [number, number?], number, number][];
  /** person, [story, arc id] at each change. */
  arcOf: [number, [number, number][]][];
  /** person, [story, Big Five O C E A N in −1..1] at each change. */
  bigFive: [number, [number, (number | null)[]][]][];
  /** Fixed positions by how many people are shown: people, [person, x, y] (scripts/layout_fullstory.ts). */
  layouts?: [number, [number, number, number][]][];
}
export const PAIR = 0,
  T = 1,
  TYPE = 4;
export type Scope = "all" | "main" | "event";
const FIELDS: Record<"all" | "cat", [number, number, number, number]> = {
  all: [5, 6, 7, 8],
  cat: [9, 10, 11, 12],
};
const KIND: AtlasNode["kind"][] = ["named", "named", "doctor", "npc"];
let request: Promise<FullStoryData> | null = null;
export function loadFullStory() {
  request ??= fetch("./data/fullstory.json").then(
    (r) => {
      if (!r.ok) throw Error(r.status + " fullstory.json");
      return r.json();
    },
    (error) => {
      request = null;
      throw error;
    },
  );
  return request;
}
export const useFullStory = () => useLoaded(loadFullStory, "fullstory");
export interface FullIndex {
  data: FullStoryData;
  n: number;
  /** "主线" or "活动" for each table story. */
  category: string[];
  /** Directed pair index -> its rows in story order. */
  rows: number[][][];
  /** Undirected edge id -> [a, b, pair a→b, pair b→a]. */
  edges: Map<string, [number, number, number, number]>;
  arcOf: Map<number, [number, number][]>;
  bigFive: Map<number, [number, (number | null)[]][]>;
  /** person -> lines per story prefix sums by scope. */
  lines: Map<number, Record<Scope, number[]>>;
  arcs: Map<number, [number, [number, number?], number, number]>;
  maxArc: number;
}
export function indexFull(core: Core, data: FullStoryData): FullIndex {
  const n = data.stories.length;
  const category = data.stories.map((s) => core.manifest.stories[s].category);
  const rows: number[][][] = data.pairs.map(() => []);
  for (const v of data.values) rows[v[PAIR]].push(v);
  for (const r of rows) r.sort((a, b) => a[T] - b[T]);
  const edges = new Map<string, [number, number, number, number]>();
  data.pairs.forEach(([o, s], i) => {
    const id = edgeId(o, s);
    const [a, b] = o < s ? [o, s] : [s, o];
    const e = edges.get(id) ?? [a, b, -1, -1];
    if (o === a) e[2] = i;
    else e[3] = i;
    edges.set(id, e);
  });
  const lines = new Map<number, Record<Scope, number[]>>();
  for (const [p, t, k] of data.lines) {
    const l = lines.get(p) ?? { all: new Array(n).fill(0), main: new Array(n).fill(0), event: new Array(n).fill(0) };
    l.all[t] += k;
    l[category[t] === "主线" ? "main" : "event"][t] += k;
    lines.set(p, l);
  }
  for (const l of lines.values())
    for (const s of ["all", "main", "event"] as Scope[]) for (let t = 1; t < n; t++) l[s][t] += l[s][t - 1];
  return {
    data,
    n,
    category,
    rows,
    edges,
    arcOf: new Map(data.arcOf),
    bigFive: new Map(data.bigFive),
    lines,
    arcs: new Map(data.arcs.map((a) => [a[0], a])),
    maxArc: Math.max(0, ...data.arcs.map((a) => a[0])),
  };
}
const inScope = (ix: FullIndex, scope: Scope, t: number) =>
  scope === "all" || ix.category[t] === (scope === "main" ? "主线" : "活动");
/** The row a directed pair is in as of story t under the scope, or null before it forms. */
export function rowAt(ix: FullIndex, pair: number, t: number, scope: Scope) {
  if (pair < 0) return null;
  const rows = ix.rows[pair];
  for (let i = bisect(rows, t, (r) => r[T]) - 1; i >= 0; i--) if (inScope(ix, scope, rows[i][T])) return rows[i];
  return null;
}
const intensity = (b: number, p: number) => Math.min(1, Math.hypot(b, p) / Math.SQRT2);
export function asOf(row: number[], scope: Scope) {
  const [b, p, type, turn] = FIELDS[scope === "all" ? "all" : "cat"].map((i) => row[i]);
  return { b, p, type, turn: !!turn };
}
function direction(row: number[] | null, scope: Scope): Direction | null {
  if (!row) return null;
  const v = asOf(row, scope);
  return { type: octantKeys[v.type], benevolence: v.b, power: v.p, intensity: intensity(v.b, v.p) };
}
/** One direction's history as the relation panel draws it: positions are story numbers 1..n. */
export function historyRows(ix: FullIndex, pair: number, scope: Scope): StateRow[] {
  if (pair < 0) return [];
  const [o, s] = ix.data.pairs[pair];
  return ix.rows[pair]
    .filter((r) => inScope(ix, scope, r[T]))
    .map((r) => {
      const v = asOf(r, scope);
      return [r[T] + 1, o, s, v.type, v.b, v.p, intensity(v.b, v.p)] as StateRow;
    });
}
export function arcAt(ix: FullIndex, p: number, t: number) {
  const ch = ix.arcOf.get(p);
  if (!ch) return -1;
  const i = bisect(ch, t, (c) => c[0]);
  return i ? ch[i - 1][1] : -1;
}
/** Brandes betweenness over index arrays, normalised to 0–1 (fast enough to follow the slider). */
function betweenness(ids: string[], adj: number[][]): number[] {
  const n = ids.length,
    score = new Float64Array(n),
    sigma = new Float64Array(n),
    dist = new Int32Array(n),
    delta = new Float64Array(n),
    stack = new Int32Array(n),
    queue = new Int32Array(n);
  const pred: number[][] = ids.map(() => []);
  for (let s = 0; s < n; s++) {
    sigma.fill(0);
    dist.fill(-1);
    delta.fill(0);
    for (const l of pred) l.length = 0;
    sigma[s] = 1;
    dist[s] = 0;
    let head = 0,
      tail = 0,
      top = 0;
    queue[tail++] = s;
    while (head < tail) {
      const v = queue[head++];
      stack[top++] = v;
      for (const w of adj[v]) {
        if (dist[w] < 0) {
          dist[w] = dist[v] + 1;
          queue[tail++] = w;
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }
    while (top) {
      const w = stack[--top];
      for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) score[w] += delta[w];
    }
  }
  const scale = n > 2 ? 1 / ((n - 1) * (n - 2)) : 0;
  return Array.from(score, (v) => v * scale);
}
export type FullAt = AtlasAt & {
  /** Relations formed by story t, and how many people each arc has then. */
  arcSize: Map<number, number>;
};
/** The network as of story t: relations formed by then at their as-of values; arcs as of t. */
export function fullAt(core: Core, ix: FullIndex, t: number, scope: Scope, withBetweenness = true): FullAt {
  const edges: AtlasEdge[] = [];
  const fresh = new Set<string>();
  const octants = Object.fromEntries(octantKeys.map((k) => [k, 0])) as ArchiveStats["octants"];
  const outDeg = new Map<number, number>(),
    inDeg = new Map<number, number>();
  const stories = new Map<string, number>();
  let relations = 0,
    benevolence = 0,
    power = 0,
    maxStories = 1;
  for (const [id, [a, b, ab, ba]] of ix.edges) {
    const rab = rowAt(ix, ab, t, scope),
      rba = rowAt(ix, ba, t, scope);
    if (!rab && !rba) continue;
    const seen = new Set<number>();
    for (const pair of [ab, ba])
      if (pair >= 0) for (const r of ix.rows[pair]) if (r[T] <= t && inScope(ix, scope, r[T])) seen.add(r[T]);
    stories.set(id, seen.size);
    maxStories = Math.max(maxStories, seen.size);
    edges.push({
      id,
      source: nodeId(a),
      target: nodeId(b),
      events: seen.size,
      weight: 0,
      ab: direction(rab, scope),
      ba: direction(rba, scope),
    });
    if ((rab && rab[T] === t) || (rba && rba[T] === t)) fresh.add(id);
    for (const [r, from, to] of [
      [rab, a, b],
      [rba, b, a],
    ] as const)
      if (r) {
        const v = asOf(r, scope);
        relations++;
        benevolence += v.b;
        power += v.p;
        octants[octantKeys[v.type]]++;
        outDeg.set(from, (outDeg.get(from) ?? 0) + 1);
        inDeg.set(to, (inDeg.get(to) ?? 0) + 1);
      }
  }
  for (const e of edges)
    e.weight = Math.round(Math.max(0.08, Math.log1p(e.events) / Math.log1p(maxStories)) * 1000) / 1000;
  const index = new Map<string, number>();
  const adj: number[][] = [];
  const ids: string[] = [];
  const add = (id: string) => {
    if (!index.has(id)) {
      index.set(id, ids.length);
      ids.push(id);
      adj.push([]);
    }
    return index.get(id)!;
  };
  for (const e of edges) {
    const i = add(e.source),
      j = add(e.target);
    adj[i].push(j);
    adj[j].push(i);
  }
  const between = withBetweenness ? betweenness(ids, adj) : ids.map(() => 0);
  const arcSize = new Map<number, number>();
  const scopeLines: Scope = scope;
  const nodes: AtlasNode[] = ids.map((id, i) => {
    const p = +id.slice(1);
    const [name, en, kind] = core.people.people[p];
    const arc = arcAt(ix, p, t);
    arcSize.set(arc, (arcSize.get(arc) ?? 0) + 1);
    const hist = ix.bigFive.get(p);
    const k = hist ? bisect(hist, t, (h) => h[0]) : 0;
    const v = hist && k ? hist[k - 1][1] : [null, null, null, null, null];
    return {
      id,
      name,
      en: kind === 2 ? en || "Doctor" : en,
      kind: KIND[kind],
      messages: ix.lines.get(p)?.[scopeLines][t] ?? 0,
      community: Math.max(0, arc),
      degree: adj[i].length,
      outDegree: outDeg.get(p) ?? 0,
      inDegree: inDeg.get(p) ?? 0,
      betweenness: Math.round(between[i] * 10000) / 10000,
      profile: { description: core.people.persona[String(p)]?.d ?? "", bigFive: v.map(toHundred) },
    };
  });
  const communities: Community[] = Array.from({ length: ix.maxArc + 1 }, (_, a) => {
    const arc = ix.arcs.get(a);
    const size = arcSize.get(a) ?? 0;
    if (!arc || !size) return { label: "", size: 0 };
    return { label: `${core.people.people[arc[1][0]][0]} 等 ${size} 人`, size };
  });
  const n = nodes.length;
  const mutual = edges.filter((e) => e.ab && e.ba).length;
  return {
    id: "fullstory",
    communities,
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
    arcSize,
  };
}
/** Directed relations known after each story, for the timeline curve (positions 1..n), as on the story pages. */
export function growth(ix: FullIndex, scope: Scope) {
  const per = new Array(ix.n).fill(0);
  for (const rows of ix.rows) {
    const r = rows.find((x) => inScope(ix, scope, x[T]));
    if (r) per[r[T]]++;
  }
  let acc = 0;
  return per.map((k, t) => ({ pos: t + 1, n: (acc += k) }));
}
/** Turn marks of one directed pair under the scope: story indices. */
export function turnsOf(ix: FullIndex, pair: number, scope: Scope) {
  if (pair < 0) return [];
  return ix.rows[pair].filter((r) => inScope(ix, scope, r[T]) && asOf(r, scope).turn).map((r) => r[T]);
}
/**
 * fullAt by story and scope, computed once. Betweenness (the slow part on a large network) is computed only when
 * asked for and cached separately.
 */
export function fullCache(core: Core, ix: FullIndex) {
  const plain = new Map<string, FullAt>(),
    between = new Map<string, FullAt>();
  return (t: number, scope: Scope, withBetweenness: boolean) => {
    const key = t + "|" + scope;
    const store = withBetweenness ? between : plain;
    let v = store.get(key);
    if (!v) {
      v = fullAt(core, ix, t, scope, withBetweenness);
      store.set(key, v);
    }
    return v;
  };
}
