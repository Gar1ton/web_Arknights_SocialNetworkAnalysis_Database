import { plural, t } from "./i18n";
import type { StoryMeta } from "./model/types";
export type Category = "主线" | "活动" | "密录" | "集成战略";
/** Categories shown in this version; 集成战略 stays offline, its data is not published. */
export const categories: Category[] = ["主线", "活动", "密录"];
const categoryNames: Record<Category | "全部", string> = {
  全部: "All",
  主线: "Main Theme",
  活动: "Event",
  密录: "Operator Record",
  集成战略: "Integrated Strategies",
};
export const categoryName = (c: Category | "全部") => t(c, categoryNames[c]);
/** How the English server's story archive splits 活动; Chinese keeps one 活动. */
export type EventKind = "side" | "collection";
const eventNames: Record<EventKind, string> = {
  side: "Side Story",
  collection: "Story Collection",
};
/** The library's filters: a category, or in English one kind of event. */
export type Filter = Category | "全部" | EventKind;
export const filters = (): Filter[] =>
  t("zh", "en") === "en"
    ? ["全部", "主线", "side", "collection", "密录"]
    : ["全部", ...categories];
export const filterName = (f: Filter) =>
  f === "side" || f === "collection" ? eventNames[f] : categoryName(f);
/** One story: what the titles, the library and the report panel need. */
export type Archive = Pick<StoryMeta, "id" | "title" | "category" | "code"> &
  Partial<StoryMeta>;
/** Official English titles and names, written by scripts/build_i18n.py and build_temporal.py. */
export type English = {
  version: string;
  archives: Record<string, string>;
  events?: Record<string, EventKind>;
  names: Record<string, string>;
};
let english: English = { version: "", archives: {}, events: {}, names: {} };
export const setEnglish = (en: English) => {
  english = en;
};
const eventKind = (a: Archive) =>
  a.category === "活动" ? english.events?.[a.id] : undefined;
/** The category label of one story, with the event kind in English. */
export function archiveCategory(a: Archive) {
  const kind = eventKind(a);
  return kind ? t(a.category, eventNames[kind]) : categoryName(a.category);
}
export function visibleArchives<T extends Archive>(archives: T[]) {
  return archives.filter((a) => categories.includes(a.category));
}
/** A story or character name in the current language; Chinese when no English one exists. */
export const englishName = (zh: string) => t(zh, english.names[zh] || zh);
export const archiveTitle = (a: Archive) =>
  t(a.title, english.archives[a.id] || a.title);
/** "主线 · 第8章" → "Main Theme · Episode 08"; other categories show the category alone. */
export function archiveCode(a: Archive) {
  const chapter = /第\s*(\d+)\s*章/.exec(a.code);
  const season = /第\s*(\d+)\s*季/.exec(a.code);
  return t(
    a.code,
    archiveCategory(a) +
      (chapter
        ? ` · Episode ${chapter[1].padStart(2, "0")}`
        : season
          ? ` · Season ${season[1]}`
          : ""),
  );
}
/** "新" for a story the latest update added, "续" for one it continued. */
export const newLabel = (kind: StoryMeta["new"]) =>
  kind === "new" ? t("新", "New") : kind === "updated" ? t("续", "Continued") : "";
export const dataVersion = (version: string) =>
  t(version, english.version || version);
export const avatarUrl = (key: string) => "./media/avatars/" + key + ".webp";
export const mediaUrl = (path: string) => "./" + path.replace(/^\.?\//, "");
export function searchArchives<T extends Archive>(
  archives: T[],
  query: string,
  category: Filter = "全部",
) {
  const q = query.trim().toLocaleLowerCase();
  return archives.filter(
    (a) =>
      (category === "全部" ||
        a.category === category ||
        eventKind(a) === category) &&
      [
        a.title,
        a.code,
        a.category,
        english.archives[a.id] || "",
        archiveCode(a),
        archiveCategory(a),
        ...(a.top ?? []),
        ...(a.top ?? []).map((n) => english.names[n] || ""),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
export const storyCount = (n: number) =>
  t(`${n.toLocaleString("zh-CN")} 段剧情`, plural("story", n, "stories"));
