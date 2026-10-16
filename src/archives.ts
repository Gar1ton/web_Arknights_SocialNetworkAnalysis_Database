import { useEffect, useState } from "react";
import type { ArchiveData } from "./data";
export type Category = "总览" | "主线" | "活动" | "密录" | "集成战略";
/**
 * Categories shown in this version. 总览 (merged tables) and 集成战略 are
 * offline for now; their data files are still generated.
 */
export const categories: Category[] = ["主线", "活动", "密录"];
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
  manifestRequest ??= getJson<Manifest>("manifest.json").then(
    (m) => ({ ...m, archives: visibleArchives(m.archives) }),
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
  category = "全部",
) {
  const q = query.trim().toLocaleLowerCase();
  return archives.filter(
    (a) =>
      (category === "全部" || a.category === category) &&
      [a.title, a.code, a.category, ...a.top]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
