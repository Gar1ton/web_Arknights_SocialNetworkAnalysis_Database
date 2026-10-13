import test from "node:test";
import assert from "node:assert/strict";
import { nodes, edges, degree, neighborhood } from "../src/data.ts";
import { defaults, parseSettings } from "../src/settings.ts";
import { makeLayout } from "../src/layout.ts";

test("fixture edges have valid endpoints, unique unordered pairs and bounded metrics", () => {
  const ids = new Set(nodes.map((n) => n.id));
  assert.equal(ids.size, nodes.length);
  const pairs = new Set<string>();
  for (const e of edges) {
    assert.ok(ids.has(e.source) && ids.has(e.target));
    assert.notEqual(e.source, e.target);
    const pair = [e.source, e.target].sort().join("|");
    assert.ok(!pairs.has(pair));
    pairs.add(pair);
    assert.ok(e.weight >= 0 && e.weight <= 1);
    assert.ok(Math.abs(e.affect) <= 1 && Math.abs(e.power) <= 1);
  }
  assert.equal(
    nodes.reduce((sum, n) => sum + degree(n.id), 0),
    2 * edges.length,
  );
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
test("all layouts are deterministic, finite, complete and inside the scene", () => {
  for (const layout of ["organic", "force", "circular"] as const)
    for (const mode of ["network", "ego", "chord"] as const) {
      const s = { ...defaults, layout, mode, hops: 2 };
      const first = makeLayout(nodes, edges, s, "n0");
      assert.deepEqual(first, makeLayout(nodes, edges, s, "n0"));
      assert.equal(first.size, nodes.length);
      for (const p of first.values()) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.x >= 50 && p.x <= 950 && p.y >= 30 && p.y <= 730);
      }
    }
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
    labels: "false",
    particles: 99999,
    gravity: NaN,
    hops: 1.8,
    opacity: -1,
    __proto__: null,
  });
  assert.equal(parsed.layout, defaults.layout);
  assert.equal(parsed.palette, defaults.palette);
  assert.equal(parsed.labels, true);
  assert.equal(parsed.particles, 3000);
  assert.equal(parsed.gravity, defaults.gravity);
  assert.equal(parsed.hops, 2);
  assert.equal(parsed.opacity, 0.05);
  assert.deepEqual(parseSettings(null), defaults);
  assert.deepEqual(
    parseSettings(JSON.parse(JSON.stringify(defaults))),
    defaults,
  );
});
