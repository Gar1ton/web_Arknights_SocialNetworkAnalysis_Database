/**
 * Fixed positions for the full-story table, written into public/data/fullstory.json as `layouts`: one layout for
 * each of the page's choices of how many people to show (the 200 / 400 / 600 with most lines, and everyone), made
 * by the site's own layout (src/layout.ts) on those people and the relations among them as the last story ends,
 * as the page did in the browser before. The page draws from these and never lays the graph out itself.
 *
 *     python3 scripts/build_fullstory.py && npx tsx scripts/layout_fullstory.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { indexFull, fullAt } from "../src/model/fullstory";
import { makeLayout } from "../src/layout";
import { defaults } from "../src/settings";

const TIERS = [200, 400, 600];
const dir = new URL("../public/data/", import.meta.url);
const read = (f: string) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const data = read("fullstory.json");
delete data.layout;
const core = { manifest: read("manifest.json"), people: read("people.json"), overview: { finals: [] }, media: { avatars: {}, archives: {} } };
const ix = indexFull(core as never, data);
const full = fullAt(core as never, ix, ix.n - 1, "all", false);
const lines = full.nodes.map((n) => n.messages).sort((a, b) => b - a);
const quantile = (v: number[], f: number) => v[Math.round(f * (v.length - 1))];
data.layouts = [];
for (const k of [...TIERS, full.nodes.length]) {
  const start = performance.now();
  // Same cut as the page: everyone with at least as many lines as the k-th person.
  const min = k >= lines.length ? 0 : lines[k - 1];
  const nodes = full.nodes.filter((n) => n.messages >= min);
  const ids = new Set(nodes.map((n) => n.id));
  const edges = full.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const positions = makeLayout(nodes, edges, { ...defaults, mode: "network" }, null);
  // Keep the layout's own spacing (the page opens on its middle), shrinking only what the graph's smallest zoom
  // (30%) could not fit: the middle 96% must fit the 1000 × 760 canvas then. Centred on (500, 380) as laid out.
  const xs = [...positions.values()].map((p) => p.x).sort((a, b) => a - b);
  const ys = [...positions.values()].map((p) => p.y).sort((a, b) => a - b);
  const scale = Math.min(1, 920 / 0.3 / (quantile(xs, 0.98) - quantile(xs, 0.02)), 680 / 0.3 / (quantile(ys, 0.98) - quantile(ys, 0.02)));
  const at = (v: number, o: number) => Math.round((o + (v - o) * scale) * 10) / 10;
  data.layouts.push([nodes.length, [...positions].map(([id, p]) => [+id.slice(1), at(p.x, 500), at(p.y, 380)])]);
  console.log(`layout for ${k}: ${nodes.length} people, ${edges.length} pairs, scale ${scale.toFixed(2)}, ${Math.round(performance.now() - start)} ms`);
}
writeFileSync(new URL("fullstory.json", dir), JSON.stringify(data));
