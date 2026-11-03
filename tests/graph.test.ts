import test from "node:test";
import assert from "node:assert/strict";
import {
  degreeMap,
  neighborhood,
  defaultMinMessages,
  octantKeys,
  primary,
  towards,
} from "../src/data.ts";
import { defaults, parseSettings } from "../src/settings.ts";
import { makeLayout } from "../src/layout.ts";
import { atlas, archive, core, manifest, overview, people, storyFiles } from "./fixture.ts";
import { keeper } from "../src/model/model.ts";
import { atlasAt } from "../src/model/atlas.ts";

const sample = archive("main-08");
const { nodes, edges } = sample;

test("every story's end network has valid endpoints, unique pairs and matches the overview", () => {
  assert.equal(storyFiles.length, manifest.stories.length);
  const finals = new Map<number, number>();
  const keep = keeper(people, true);
  for (const f of overview.finals) if (keep(f[1], f[2])) finals.set(f[0], (finals.get(f[0]) ?? 0) + 1);
  manifest.stories.forEach((entry, i) => {
    const data = archive(entry.id);
    const ids = new Set(data.nodes.map((n) => n.id));
    assert.equal(ids.size, data.nodes.length);
    const pairs = new Set<string>();
    let directed = 0;
    for (const e of data.edges) {
      assert.ok(ids.has(e.source) && ids.has(e.target), entry.id);
      assert.ok(!pairs.has(e.id), entry.id);
      pairs.add(e.id);
      for (const d of [e.ab, e.ba]) {
        if (!d) continue;
        directed++;
        assert.ok(octantKeys.includes(d.type));
        assert.ok(Math.abs(d.benevolence) <= 1 && Math.abs(d.power) <= 1);
        assert.ok(d.intensity >= 0 && d.intensity <= 1.5);
      }
      assert.ok(e.weight > 0 && e.weight <= 1);
    }
    assert.equal(directed, finals.get(i) ?? 0, entry.id);
    assert.equal(data.stats.relations, directed, entry.id);
    for (const n of data.nodes) assert.ok(n.betweenness >= 0 && n.betweenness <= 1);
  });
});
test("the network at a position holds only relations formed by then", () => {
  const a = atlas("main-08");
  const m = a.story.data.m;
  let last = 0;
  for (const pos of [1, Math.round(m / 4), Math.round(m / 2), m]) {
    const at = atlasAt(core, a, pos);
    assert.ok(at.stats.relations >= last);
    last = at.stats.relations;
    for (const e of at.edges) {
      const p = a.pairs.get(e.id)!;
      const first = Math.min(...[p.ab[0], p.ba[0]].filter(Boolean).map((r) => r[0]));
      assert.ok(first <= pos);
      assert.ok(e.events <= (a.shared.get(e.id)?.length ?? 0));
    }
    for (const id of at.fresh) assert.ok(at.edges.some((e) => e.id === id));
  }
  assert.deepEqual(atlasAt(core, a, m).edges, a.full.edges);
});
test("communities are deterministic and every person has one", () => {
  const one = archive("main-08"),
    two = archive("main-08");
  assert.deepEqual(one.communities, two.communities);
  for (const n of one.nodes) assert.ok(n.community >= 0 && n.community < one.communities.length);
  assert.ok(one.communities.some((c) => / 等 \d+ 人$/.test(c.label)));
});
test("direction helpers read the right side of a pair", () => {
  const e = edges.find((x) => x.ab && x.ba)!;
  assert.equal(towards(e, e.source), e.ab);
  assert.equal(towards(e, e.target), e.ba);
  const best = primary(e);
  assert.ok(best === e.ab || best === e.ba);
  assert.ok(best.intensity >= Math.min(e.ab!.intensity, e.ba!.intensity));
});
test("default message threshold keeps large archives readable", () => {
  const biggest = [...manifest.stories].sort((a, b) => b.relAll - a.relAll)[0];
  const all = archive(biggest.id, false);
  assert.ok(all.nodes.length > 150);
  const t = defaultMinMessages(all.nodes, 150);
  const kept = all.nodes.filter((n) => n.messages >= t).length;
  assert.ok(kept <= 150 && kept > 100);
  assert.equal(defaultMinMessages(nodes, 150), 0);
});
test("ego traversal follows exact hop counts on a chain and terminates on cycles", () => {
  const link = (source: string, target: string) => ({
    ...edges[0],
    source,
    target,
  });
  const chain = [link("a", "b"), link("b", "c"), link("c", "d")];
  assert.deepEqual([...neighborhood("a", chain, 1)].sort(), ["a", "b"]);
  assert.deepEqual([...neighborhood("a", chain, 2)].sort(), ["a", "b", "c"]);
  assert.deepEqual(
    [...neighborhood("a", [...chain, link("d", "a")], 9)].sort(),
    ["a", "b", "c", "d"],
  );
  assert.deepEqual([...neighborhood("isolated", chain, 2)], ["isolated"]);
});
const nearest = (pts: { x: number; y: number }[]) =>
  pts
    .map((p, i) =>
      Math.min(
        ...pts
          .filter((_, j) => j !== i)
          .map((q) => Math.hypot(p.x - q.x, p.y - q.y)),
      ),
    )
    .sort((a, b) => a - b);
test("all layouts are deterministic, finite, complete and centred", () => {
  for (const layout of ["organic", "force", "circular"] as const)
    for (const mode of ["network", "ego", "chord"] as const) {
      const s = { ...defaults, layout, mode, hops: 2 };
      const first = makeLayout(nodes, edges, s, nodes[0].id);
      assert.deepEqual(first, makeLayout(nodes, edges, s, nodes[0].id));
      assert.equal(first.size, nodes.length);
      const pts = [...first.values()];
      assert.ok(pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
      if (mode === "network" && layout !== "circular") {
        const xs = pts.map((p) => p.x),
          ys = pts.map((p) => p.y);
        assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 500) < 1);
        assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 380) < 1);
      } else {
        // Rings around the scene centre: the centre itself, an inner and an outer ring at most.
        const radii = new Set(pts.map((p) => Math.round(Math.hypot(p.x - 500, p.y - 380))));
        assert.ok(radii.size <= 3, `${layout}/${mode}: ${radii.size} radii`);
      }
    }
});
test("network layout keeps the requested spacing; landing stays inside the scene", () => {
  for (const distance of [100, 160]) {
    const pts = [
      ...makeLayout(nodes, edges, { ...defaults, distance }, null).values(),
    ];
    const gaps = nearest(pts);
    assert.ok(gaps[gaps.length >> 1] >= distance * 0.8 - 1e-6);
  }
  const compact = [...makeLayout(nodes, edges, defaults, null, true).values()];
  assert.ok(
    compact.every((p) => p.x >= 50 && p.x <= 950 && p.y >= 30 && p.y <= 730),
  );
  const ring = [
    ...makeLayout(nodes, edges, { ...defaults, mode: "chord" }, null).values(),
  ];
  assert.ok(nearest(ring)[0] >= 20);
});
test("empty and isolated graph layouts do not fail", () => {
  assert.equal(makeLayout([], [], defaults, null).size, 0);
  const p = makeLayout([nodes[0]], [], defaults, null).get(nodes[0].id)!;
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
test("physics parameters change the actual layout", () => {
  const a = makeLayout(nodes, edges, defaults, null);
  const b = makeLayout(
    nodes,
    edges,
    { ...defaults, repulsion: 500, gravity: 1.8, distance: 150 },
    null,
  );
  assert.notDeepEqual(a, b);
});
test("settings reject stale, malicious and nonfinite values and clamp supported ranges", () => {
  const parsed = parseSettings({
    layout: "not-an-algorithm",
    palette: "unknown",
    coloring: "faction",
    labels: "false",
    particles: 99999,
    gravity: NaN,
    hops: 1.8,
    opacity: -1,
    labelSize: 9,
    __proto__: null,
  });
  assert.equal(parsed.layout, defaults.layout);
  assert.equal(parsed.palette, defaults.palette);
  assert.equal(parsed.coloring, defaults.coloring);
  assert.equal(parsed.labels, true);
  assert.equal(parsed.particles, 3000);
  assert.equal(parsed.gravity, defaults.gravity);
  assert.equal(parsed.hops, 2);
  assert.equal(parsed.opacity, 0.05);
  assert.equal(parsed.labelSize, 2);
  assert.equal(defaults.flowOpacity, 0);
  assert.deepEqual(parseSettings(null), defaults);
  assert.deepEqual(
    parseSettings(JSON.parse(JSON.stringify(defaults))),
    defaults,
  );
});
