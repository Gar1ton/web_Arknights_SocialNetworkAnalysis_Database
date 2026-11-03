import {
  OBS,
  SEQ,
  SUB,
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
