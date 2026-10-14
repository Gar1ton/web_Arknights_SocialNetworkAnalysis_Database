import { readFileSync, readdirSync } from "node:fs";
import type { ArchiveData } from "../src/data";
import type { Manifest } from "../src/archives";
const dir = new URL("../public/data/", import.meta.url);
export const manifest: Manifest = JSON.parse(
  readFileSync(new URL("manifest.json", dir), "utf8"),
);
export function archive(id: string): ArchiveData {
  return JSON.parse(readFileSync(new URL(`archives/${id}.json`, dir), "utf8"));
}
export const archiveFiles = readdirSync(new URL("archives/", dir));
