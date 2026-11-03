import { plural, t } from "./i18n";
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
/** Colors for the story categories, validated as a set on the dark surface. */
export const categoryColors: Record<Category, string> = {
  主线: "#d95926",
  活动: "#199e70",
  密录: "#9085e9",
  集成战略: "#c98500",
};
/** How the English server's story archive splits 活动; Chinese keeps one 活动. */
export type EventKind = "side" | "collection";
const eventNames: Record<EventKind, string> = {
  side: "Side Story",
  collection: "Story Collection",
};
/** What the report panel and the titles need from a story. */
export type Archive = {
  id: string;
  title: string;
  category: Category;
  code: string;
};
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
export const storyCount = (n: number) =>
  t(`${n.toLocaleString("zh-CN")} 个故事`, plural("story", n, "stories"));
export const dataVersion = (version: string) =>
  t(version, english.version || version);
export const avatarUrl = (key: string) => "./media/avatars/" + key + ".webp";
export const mediaUrl = (path: string) => "./" + path.replace(/^\.?\//, "");
