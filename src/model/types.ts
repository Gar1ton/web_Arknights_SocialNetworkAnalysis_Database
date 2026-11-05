import type { Category } from "../archives";
/** One story in the manifest; positions inside a story run 1..m. */
export interface StoryMeta {
  id: string;
  title: string;
  category: Category;
  code: string;
  /** Place in the queue the stories were replayed in. */
  order: number;
  group: string;
  color: string;
  /** Queue ranges the story covers; a story continued by an update has two. */
  segs: [number, number][];
  m: number;
  sc: number;
  ev: number;
  /** Formed relations at the story's end: both ends named, and all. */
  rel: number;
  relAll: number;
  speakers: number;
  named: number;
  top: string[];
  /** Added ("new") or continued ("updated") by the latest story update. */
  new?: "new" | "updated";
}
export interface Manifest {
  info: {
    version: string;
    newFrom: number;
    updated: string;
    totals: {
      stories: number;
      messages: number;
      scenes: number;
      events: number;
      relations: number;
      relationsAll: number;
      people: number;
      namedPeople: number;
    };
  };
  stories: StoryMeta[];
}
/** start, end, scene index, title, summary, participants, messages. */
export type EventRow = [number, number, number, string, string, number[], number];
/** position, observer, subject, type index, friendliness, dominance, intensity: the state from here on. */
export type StateRow = [number, number, number, number, number, number, number];
/** person, messages in this story, first position. */
export type WhoRow = [number, number, number];
export interface StoryData {
  id: string;
  segs: [number, number][];
  m: number;
  sc: number;
  who: WhoRow[];
  ev: EventRow[];
  ch: StateRow[];
}
/** name, operator English name ("" if none), scope (0 operator, 1 named, 2 Doctor, 3 generic), messages. */
export type PersonRow = [string, string, number, number];
export interface Persona {
  d: string;
  /** Queue position and Big Five (O C E A N, −1..1, null when not scored). */
  h: [number, (number | null)[]][];
}
export interface People {
  people: PersonRow[];
  persona: Record<string, Persona>;
}
/** story index, observer, subject, type index, friendliness, dominance, intensity: where each story ends. */
export type FinalRow = [number, number, number, number, number, number, number];
export interface Overview {
  finals: FinalRow[];
}
export interface MediaMap {
  avatars: Record<string, string>;
  archives: Record<string, { cast: (string | null)[]; banner?: string; lead?: string }>;
}
export const SEQ = 0,
  OBS = 1,
  SUB = 2,
  TYPE = 3,
  BEN = 4,
  POW = 5,
  INT = 6;
