import { useEffect, useState } from "react";
import type { ArchiveData } from "./data";
import { plural, t } from "./i18n";
export type Category = "总览" | "主线" | "活动" | "密录" | "集成战略";
/**
 * Categories shown in this version. 总览 (merged tables) and 集成战略 are
 * offline for now; their data files are still generated.
 */
export const categories: Category[] = ["主线", "活动", "密录"];
const categoryNames: Record<Category | "全部", string> = {
  全部: "All",
  总览: "Overview",
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
const eventKind = (a: Archive) =>
  a.category === "活动" ? english.events?.[a.id] : undefined;
/** The category label of one story, with the event kind in English. */
export function archiveCategory(a: Archive) {
  const kind = eventKind(a);
  return kind ? t(a.category, eventNames[kind]) : categoryName(a.category);
}
export function visibleArchives(archives: Archive[]) {
  return archives.filter((a) => categories.includes(a.category));
}
export type Archive = {
  id: string;
  title: string;
  category: Category;
  code: string;
  order: number;
  description: string;
  color: string;
  source: string;
  nodes: number;
  pairs: number;
  relations: number;
  top: string[];
};
export type Manifest = {
  info: {
    version: string;
    /** The pipeline run the data was built from; reports carry it. */
    sources?: { fullgraph?: { runId?: string } };
    totals: {
      stories: number;
      people: number;
      namedPeople: number;
      relations: number;
    };
  };
  archives: Archive[];
};
/** Avatars and banners written by scripts/build_media.py. */
export type ArchiveMedia = {
  /** Avatar keys aligned with Archive.top; null where none exists. */
  cast: (string | null)[];
  banner?: string;
  /** The operator an operator record is about. */
  lead?: string;
};
export type Media = {
  /** Node id → avatar key. */
  avatars: Record<string, string>;
  archives: Record<string, ArchiveMedia>;
};
/** Official English titles and names, written by scripts/build_i18n.py. */
export type English = {
  version: string;
  archives: Record<string, string>;
  events?: Record<string, EventKind>;
  names: Record<string, string>;
};
let english: English = { version: "", archives: {}, events: {}, names: {} };
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
export function archiveDescription(a: Archive) {
  return t(
    a.description,
    `${plural("character", a.nodes)}, ${plural("relation", a.pairs)}. Most connected: ${a.top.map(englishName).join(", ")}.`,
  );
}
export const dataVersion = (m: Manifest) =>
  t(m.info.version, english.version || m.info.version);
export const avatarUrl = (key: string) => "./media/avatars/" + key + ".webp";
const base = "./data/";
let manifestRequest: Promise<Manifest> | null = null;
let mediaRequest: Promise<Media> | null = null;
const archiveRequests = new Map<string, Promise<ArchiveData>>();
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path);
  if (!response.ok) throw Error(response.status + " " + path);
  return response.json();
}
export function loadManifest() {
  manifestRequest ??= Promise.all([
    getJson<Manifest>("manifest.json"),
    // English is a layer on top: without en.json the site falls back to Chinese.
    getJson<English>("en.json").catch(() => english),
  ]).then(
    ([m, en]) => {
      english = en;
      return { ...m, archives: visibleArchives(m.archives) };
    },
    (error) => {
      manifestRequest = null;
      throw error;
    },
  );
  return manifestRequest;
}
/** Pictures are decoration: without media.json the site keeps its plain look. */
export function loadMedia() {
  mediaRequest ??= getJson<Media>("media.json").catch(() => ({
    avatars: {},
    archives: {},
  }));
  return mediaRequest;
}
export function loadArchive(id: string) {
  let request = archiveRequests.get(id);
  if (!request) {
    request = getJson<ArchiveData>(
      "archives/" + encodeURIComponent(id) + ".json",
    ).catch((error) => {
      archiveRequests.delete(id);
      throw error;
    });
    archiveRequests.set(id, request);
  }
  return request;
}
type Loaded<T> = { data: T | null; error: boolean };
function useLoaded<T>(load: (() => Promise<T>) | null, key: string) {
  const [state, setState] = useState<Loaded<T> & { key: string }>({
    data: null,
    error: false,
    key,
  });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (data) => live && setState({ data, error: false, key }),
      () => live && setState({ data: null, error: true, key }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return state.key === key ? state : { data: null, error: false, key };
}
export function useManifest() {
  return useLoaded(loadManifest, "manifest");
}
export function useMedia() {
  return useLoaded(loadMedia, "media").data;
}
export function useArchive(id: string | null) {
  return useLoaded(id ? () => loadArchive(id) : null, id || "");
}
export function searchArchives(
  archives: Archive[],
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
        ...a.top,
        ...a.top.map((n) => english.names[n] || ""),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
