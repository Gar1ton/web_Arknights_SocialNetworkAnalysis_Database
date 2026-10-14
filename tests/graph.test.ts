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
import { archive, archiveFiles, manifest } from "./fixture.ts";

const sample = archive("main-08");
const { nodes, edges } = sample;

test("every archive has valid endpoints, unique pairs and bounded IPC values", () => {
  assert.equal(archiveFiles.length, manifest.archives.length);
  for (const entry of manifest.archives) {
    const data = archive(entry.id);
    const ids = new Set(data.nodes.map((n) => n.id));
    assert.equal(ids.size, data.nodes.length);
    assert.equal(data.nodes.length, entry.nodes);
    assert.equal(data.edges.length, entry.pairs);
    const pairs = new Set<string>();
    let directed = 0;
    for (const e of data.edges) {
      assert.ok(ids.has(e.source) && ids.has(e.target));
      assert.ok(e.source < e.target);
      assert.ok(!pairs.has(e.id));
      pairs.add(e.id);
      assert.ok(e.ab || e.ba);
      assert.ok(e.weight > 0 && e.weight <= 1);
      for (const d of [e.ab, e.ba]) {
        if (!d) continue;
        directed++;
        assert.ok(octantKeys.includes(d.type));
        assert.ok(Math.abs(d.benevolence) <= 1 && Math.abs(d.power) <= 1);
        assert.ok(d.confidence > 0 && d.confidence <= 1);
        assert.ok(d.intensity >= 0 && d.intensity <= 1);
      }
    }
    assert.equal(directed, entry.relations);
    for (const n of data.nodes) {
      assert.ok(n.community >= 0 && n.community < data.communities.length);
      assert.ok(n.betweenness >= 0 && n.betweenness <= 1);
      assert.equal(n.profile.bigFive.length, 5);
      for (const v of n.profile.bigFive)
        assert.ok(v === null || (v >= 0 && v <= 100));
    }
    const deg = degreeMap(data.edges);
    assert.ok(data.nodes.every((n) => deg.get(n.id) === n.degree));
  }
});
test("exports carry no script quotes, only derived values", () => {
  const text = JSON.stringify(archive("all"));
  assert.ok(!text.includes('"quote"'));
  assert.ok(!text.includes("style_quotes"));
  assert.ok(!text.includes("interaction_flow"));
});
test("direction helpers read the right side of a pair", () => {
  const e = edges.find((x) => x.ab && x.ba)!;
  assert.equal(towards(e, e.source), e.ab);
  assert.equal(towards(e, e.target), e.ba);
  const best = primary(e);
  assert.ok(best === e.ab || best === e.ba);
  assert.ok(best.confidence >= Math.min(e.ab!.confidence, e.ba!.confidence));
});
test("default message threshold keeps large archives readable", () => {
  const all = archive("all");
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
      const xs = pts.map((p) => p.x),
        ys = pts.map((p) => p.y);
      assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 500) < 1);
      assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 380) < 1);
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
