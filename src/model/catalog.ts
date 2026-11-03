import { useMemo } from "react";
import { englishName, visibleArchives } from "../archives";
import { t } from "../i18n";
import type { Core } from "./load";
import { keeper, type Keep } from "./model";
import { OBS, SUB, type FinalRow, type StoryMeta } from "./types";
/** A story with the counts the library shows under the current filter. */
export type Story = StoryMeta & {
  /** Index in manifest.stories, which overview.finals refers to. */
  index: number;
  /** People with at least one relation when the story ends. */
  people: number;
  relations: number;
};
export type PersonStats = {
  p: number;
  relations: number;
  stories: number[];
};
export interface Catalog {
  keep: Keep;
  stories: Story[];
  /** Relations where each story ends, under the filter. */
  finals: FinalRow[];
  persons: Map<number, PersonStats>;
}
export function catalog(core: Core, named: boolean): Catalog {
  const keep = keeper(core.people, named);
  const finals = core.overview.finals.filter((f) => keep(f[OBS], f[SUB]));
  const relations = new Array<number>(core.manifest.stories.length).fill(0);
  const people = core.manifest.stories.map(() => new Set<number>());
  const persons = new Map<number, PersonStats>();
  for (const f of finals) {
    relations[f[0]]++;
    for (const p of [f[OBS], f[SUB]]) {
      people[f[0]].add(p);
      const s = persons.get(p) ?? { p, relations: 0, stories: [] };
      s.relations++;
      if (s.stories[s.stories.length - 1] !== f[0]) s.stories.push(f[0]);
      persons.set(p, s);
    }
  }
  for (const s of persons.values())
    s.stories = [...new Set(s.stories)].sort((a, b) => a - b);
  const stories = visibleArchives(
    core.manifest.stories.map((s, index) => ({
      ...s,
      index,
      people: people[index].size,
      relations: relations[index],
    })),
  );
  return { keep, stories, finals, persons };
}
export const useCatalog = (core: Core | null, named: boolean) =>
  useMemo(() => (core ? catalog(core, named) : null), [core, named]);
/** Latest update first: new stories, then continued ones, each in story order. */
export const pinnedFirst = <T extends StoryMeta>(stories: T[]) =>
  [...stories].sort(
    (a, b) =>
      rank(a) - rank(b) || a.order - b.order,
  );
const rank = (s: StoryMeta) => (s.new === "new" ? 0 : s.new === "updated" ? 1 : 2);
/** A person's name in the current language: an operator's own English name, else the English script's, else Chinese. */
export function personName(core: Core, p: number) {
  const [zh, en, scope] = core.people.people[p];
  if (scope === 2) return t(zh, en || "Doctor");
  return en ? t(zh, en) : englishName(zh);
}
/** The other-language name, shown small, when it differs. */
export function personAlt(core: Core, p: number) {
  const zh = core.people.people[p][0];
  const shown = personName(core, p);
  return shown === zh ? core.people.people[p][1] : zh;
}
const scopes = [
  ["干员", "Operator"],
  ["具名角色", "Named character"],
  ["博士", "The Doctor"],
  ["无名角色", "Unnamed character"],
];
export const scopeName = (scope: number) => t(scopes[scope][0], scopes[scope][1]);
/** The named person a story's "top" name refers to, for its avatar. */
export function personByName(core: Core) {
  const map = new Map<string, number>();
  core.people.people.forEach(([name, , scope], p) => {
    if (scope < 3 && !map.has(name)) map.set(name, p);
  });
  return map;
}
