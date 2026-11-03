import { useEffect, useState } from "react";
import { setEnglish, type English } from "../archives";
import type { Manifest, MediaMap, Overview, People, StoryData } from "./types";
const base = "./data/";
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(base + path);
  if (!response.ok) throw Error(response.status + " " + path);
  return response.json();
}
/** Everything the overview and the people pages need, fetched once. */
export interface Core {
  manifest: Manifest;
  people: People;
  overview: Overview;
  media: MediaMap;
}
let coreRequest: Promise<Core> | null = null;
export function loadCore() {
  coreRequest ??= Promise.all([
    getJson<Manifest>("manifest.json"),
    getJson<People>("people.json"),
    getJson<Overview>("overview.json"),
    // Pictures and English are layers on top: without them the site keeps its plain Chinese look.
    getJson<MediaMap>("media.json").catch(() => ({ avatars: {}, archives: {} })),
    getJson<English>("en.json").catch(() => null),
  ]).then(
    ([manifest, people, overview, media, en]) => {
      if (en) setEnglish(en);
      return { manifest, people, overview, media };
    },
    (error) => {
      coreRequest = null;
      throw error;
    },
  );
  return coreRequest;
}
const storyRequests = new Map<string, Promise<StoryData>>();
export function loadStory(id: string) {
  let request = storyRequests.get(id);
  if (!request) {
    request = getJson<StoryData>("stories/" + encodeURIComponent(id) + ".json").catch((error) => {
      storyRequests.delete(id);
      throw error;
    });
    storyRequests.set(id, request);
  }
  return request;
}
type Loaded<T> = { data: T | null; error: boolean; key: string };
export function useLoaded<T>(load: (() => Promise<T>) | null, key: string) {
  const [state, setState] = useState<Loaded<T>>({ data: null, error: false, key });
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
export const useCore = () => useLoaded(loadCore, "core");
export const useStory = (id: string | null) => useLoaded(id ? () => loadStory(id) : null, id || "");
