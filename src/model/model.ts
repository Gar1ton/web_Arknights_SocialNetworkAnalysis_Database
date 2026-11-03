import {
  BEN,
  OBS,
  SEQ,
  SUB,
  type FinalRow,
  type People,
  type Persona,
  type StateRow,
  type StoryData,
  type StoryMeta,
  type WhoRow,
} from "./types";
/** Index of the first element whose key is above x (rows sorted by key). */
export function bisect<T>(arr: readonly T[], x: number, key: (v: T) => number) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (key(arr[m]) <= x) lo = m + 1;
    else hi = m;
  }
  return lo;
}
/** The state a sorted history is in at a position, or null before its first row. */
export function stateAt<R extends readonly number[]>(rows: readonly R[], pos: number): R | null {
  const i = bisect(rows, pos, (r) => r[0]);
  return i ? rows[i - 1] : null;
}
export const pairKey = (o: number, t: number) => `${o}|${t}`;
export type Keep = (a: number, b: number) => boolean;
/** Named means operators, named story characters and the Doctor: scope 0–2. */
export const isNamed = (people: People, p: number) => people.people[p][2] < 3;
export const keeper = (people: People, namedOnly: boolean): Keep =>
  namedOnly ? (a, b) => isNamed(people, a) && isNamed(people, b) : () => true;
export interface Edge {
  o: number;
  t: number;
  r: StateRow;
}
export interface IndexedStory {
  meta: StoryMeta;
  data: StoryData;
  pairs: Map<string, StateRow[]>;
  /** Positions where some relation changes, for stepping and the timeline ticks. */
  stops: number[];
  said: Map<number, WhoRow>;
}
export function indexStory(meta: StoryMeta, data: StoryData): IndexedStory {
  const pairs = new Map<string, StateRow[]>();
  const rows = [...data.ch].sort((a, b) => a[SEQ] - b[SEQ]);
  for (const r of rows) {
    const k = pairKey(r[OBS], r[SUB]);
    const list = pairs.get(k);
    if (list) list.push(r);
    else pairs.set(k, [r]);
  }
  const stops = [...new Set(rows.map((r) => r[SEQ]))].sort((a, b) => a - b);
  return { meta, data, pairs, stops, said: new Map(data.who.map((w) => [w[0], w])) };
}
export function edgesAt(s: IndexedStory, pos: number, keep: Keep): Edge[] {
  const out: Edge[] = [];
  for (const rows of s.pairs.values()) {
    const o = rows[0][OBS];
    const t = rows[0][SUB];
    if (!keep(o, t)) continue;
    const r = stateAt(rows, pos);
    if (r) out.push({ o, t, r });
  }
  return out;
}
/** Formed relations and their mean friendliness after each change, for the timeline chart. */
export function trend(s: IndexedStory, keep: Keep) {
  const now = new Map<string, number>();
  let sum = 0;
  const out: { pos: number; n: number; mean: number }[] = [];
  const rows = [...s.data.ch].sort((a, b) => a[SEQ] - b[SEQ]);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (keep(r[OBS], r[SUB])) {
      const k = pairKey(r[OBS], r[SUB]);
      sum += r[BEN] - (now.get(k) ?? 0);
      now.set(k, r[BEN]);
    }
    if (i === rows.length - 1 || rows[i + 1][SEQ] !== r[SEQ])
      out.push({ pos: r[SEQ], n: now.size, mean: now.size ? sum / now.size : 0 });
  }
  return out;
}
/** Index of the event covering a position: the last one that starts at or before it. */
export const eventAt = (s: IndexedStory, pos: number) => bisect(s.data.ev, pos, (e) => e[0]) - 1;
/** Story position → queue position; a story continued later has two stretches. */
export function toQueue(segs: readonly (readonly [number, number])[], pos: number) {
  let left = pos;
  for (const [a, b] of segs) {
    const size = b - a + 1;
    if (left <= size) return a + left - 1;
    left -= size;
  }
  const last = segs[segs.length - 1];
  return last ? last[1] : 0;
}
/** The story a queue position belongs to. */
export function storyAtQueue(stories: readonly StoryMeta[], seq: number) {
  return stories.find((s) => s.segs.some(([a, b]) => a <= seq && seq <= b));
}
/** The Big Five a person had reached by a queue position. */
export function personaAt(persona: Persona | undefined, seq: number) {
  if (!persona) return null;
  const i = bisect(persona.h, seq, (h) => h[0]);
  return i ? persona.h[i - 1][1] : null;
}
export type Sort = "queue" | "messages" | "relations" | "events";
/** Stories from the latest update first, in queue order; then the rest in the chosen order. */
export function arrange(stories: readonly StoryMeta[], sort: Sort, relations: (s: StoryMeta) => number) {
  const key: Record<Sort, (s: StoryMeta) => number> = {
    queue: (s) => s.order,
    messages: (s) => -s.m,
    relations: (s) => -relations(s),
    events: (s) => -s.ev,
  };
  const pinned = stories.filter((s) => s.new).sort((a, b) => (a.new === b.new ? a.order - b.order : a.new === "new" ? -1 : 1));
  const rest = stories.filter((s) => !s.new).sort((a, b) => key[sort](a) - key[sort](b) || a.order - b.order);
  return { pinned, rest };
}
/** Relations where each story ends, grouped by person. */
export function finalsByPerson(finals: readonly FinalRow[]) {
  const map = new Map<number, FinalRow[]>();
  for (const f of finals)
    for (const p of [f[1], f[2]]) {
      const list = map.get(p);
      if (list) list.push(f);
      else map.set(p, [f]);
    }
  return map;
}
export interface Point {
  x: number;
  y: number;
}
/**
 * One fixed position per person and filter, from every relation the story ever forms, so the network grows in
 * place as the timeline moves: a deterministic spring layout (golden-angle start), then spacing for the labels.
 */
export function layout(s: IndexedStory, keep: Keep, W = 1000, H = 680) {
  const nodes = new Map<number, Point & { w: number; dx: number; dy: number }>();
  const links: { o: number; t: number; w: number }[] = [];
  for (const rows of s.pairs.values()) {
    const o = rows[0][OBS];
    const t = rows[0][SUB];
    if (!keep(o, t)) continue;
    for (const u of [o, t])
      if (!nodes.has(u)) nodes.set(u, { x: 0, y: 0, dx: 0, dy: 0, w: (s.said.get(u) ?? [0, 0])[1] });
    links.push({ o, t, w: rows.length });
  }
  const list = [...nodes.entries()].sort((a, b) => b[1].w - a[1].w || a[0] - b[0]).map(([, n]) => n);
  list.forEach((n, i) => {
    const a = i * 2.39996;
    const r = 40 + 18 * Math.sqrt(i);
    n.x = W / 2 + r * Math.cos(a);
    n.y = H / 2 + r * Math.sin(a);
  });
  const k = Math.sqrt((W * H) / Math.max(1, list.length)) * 0.55;
  for (let it = 0; it < 300; it++) {
    const temp = 18 * (1 - it / 300) + 0.6;
    for (const a of list) {
      a.dx = 0;
      a.dy = 0;
    }
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        const f = (k * k) / d;
        dx /= d;
        dy /= d;
        a.dx += dx * f;
        a.dy += dy * f;
        b.dx -= dx * f;
        b.dy -= dy * f;
      }
    for (const l of links) {
      const a = nodes.get(l.o)!;
      const b = nodes.get(l.t)!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = ((d * d) / k) * Math.min(2.5, 0.35 + Math.log1p(l.w) * 0.35);
      dx /= d;
      dy /= d;
      a.dx -= dx * f;
      a.dy -= dy * f;
      b.dx += dx * f;
      b.dy += dy * f;
    }
    for (const a of list) {
      a.dx += (W / 2 - a.x) * 0.02 * k;
      a.dy += (H / 2 - a.y) * 0.03 * k;
      const d = Math.max(1, Math.hypot(a.dx, a.dy));
      a.x += (a.dx / d) * Math.min(d, temp);
      a.y += (a.dy / d) * Math.min(d, temp);
    }
  }
  if (list.length > 1) {
    const xs = list.map((n) => n.x);
    const ys = list.map((n) => n.y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const sc = Math.min(1.6, (W - 140) / Math.max(1, x1 - x0), (H - 110) / Math.max(1, y1 - y0));
    const ox = (W - (x1 - x0) * sc) / 2;
    const oy = 24 + (H - 110 - (y1 - y0) * sc) / 2;
    for (const n of list) {
      n.x = ox + (n.x - x0) * sc;
      n.y = oy + (n.y - y0) * sc;
    }
    // push apart whatever is still too close for two name labels to fit
    for (let it = 0; it < 60; it++)
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const dx = (a.x - b.x) / 1.6;
          const dy = a.y - b.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          if (d < 48) {
            const f = (48 - d) / d / 2;
            a.x += dx * f * 1.6;
            a.y += dy * f;
            b.x -= dx * f * 1.6;
            b.y -= dy * f;
          }
        }
    for (const n of list) {
      n.x = Math.max(44, Math.min(W - 44, n.x));
      n.y = Math.max(28, Math.min(H - 56, n.y));
    }
  } else if (list.length === 1) {
    list[0].x = W / 2;
    list[0].y = H / 2;
  }
  const out = new Map<number, Point>();
  for (const [u, n] of nodes) out.set(u, { x: n.x, y: n.y });
  return out;
}
