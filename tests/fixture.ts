import { readFileSync, readdirSync } from "node:fs";
import type { Core } from "../src/model/load.ts";
import type { Manifest, MediaMap, Overview, People, StoryData } from "../src/model/types.ts";
import { indexStory, keeper } from "../src/model/model.ts";
import { buildAtlas } from "../src/model/atlas.ts";
const dir = new URL("../public/data/", import.meta.url);
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, dir), "utf8"));
export const manifest = json<Manifest>("manifest.json");
export const people = json<People>("people.json");
export const overview = json<Overview>("overview.json");
export const media = json<MediaMap>("media.json");
export const core: Core = { manifest, people, overview, media };
export const storyFiles = readdirSync(new URL("stories/", dir));
export const story = (id: string) => json<StoryData>(`stories/${id}.json`);
export const indexed = (id: string) => indexStory(manifest.stories.find((s) => s.id === id)!, story(id));
/** A story's network as it ends, in the shape the graph and the panels read. */
export const atlas = (id: string, named = true) => buildAtlas(core, indexed(id), keeper(people, named));
export const archive = (id: string, named = true) => atlas(id, named).full;
