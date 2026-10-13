import test from "node:test";
import assert from "node:assert/strict";
import { gravityLeaders } from "../src/gravity";
import { nodes, edges, type AtlasEdge } from "../src/data";
import {
  createThreadField,
  stepThreadField,
  updateThreadAnchors,
  reweaveThreadField,
} from "../src/particles";
import { defaults, parseSettings } from "../src/settings";
test("gravity centers rank weighted in-scope links, not node id or raw degree", () => {
  const fixture = [
    { ...edges[0], source: nodes[1].id, target: nodes[2].id, weight: 1 },
    { ...edges[0], source: nodes[0].id, target: nodes[1].id, weight: 0.1 },
    { ...edges[0], source: nodes[0].id, target: nodes[2].id, weight: 0.1 },
    { ...edges[0], source: nodes[0].id, target: "outside", weight: 100 },
  ] as AtlasEdge[];
  const leaders = gravityLeaders(nodes.slice(0, 3), fixture, 3);
  assert.equal(leaders[0].id, nodes[1].id);
  assert.equal(leaders[1].id, nodes[2].id);
  assert.equal(leaders[2].id, nodes[0].id);
  assert.ok(Math.abs(leaders[0].weight - 1.1) < 1e-8);
  assert.ok(leaders[0].mass > leaders[2].mass);
  assert.equal(gravityLeaders(nodes, edges, 99).length, 5);
  assert.deepEqual(gravityLeaders(nodes, [], 3), []);
});
test("gravity strength changes particle trajectories without adding particles", () => {
  const weak = createThreadField(1000, 760, 80, [
    { x: 0.5, y: 0.5, mass: 1.5 },
  ]);
  const strong = createThreadField(1000, 760, 80, [
    { x: 0.5, y: 0.5, mass: 1.5 },
  ]);
  for (let i = 0; i < 300; i++) {
    stepThreadField(weak, 0.65, 1.2, 0);
    stepThreadField(strong, 0.65, 1.2, 2);
  }
  assert.notDeepEqual(weak.particles[0].trail, strong.particles[0].trail);
  assert.equal(strong.particles.length, 80);
  assert.ok(
    strong.particles.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  );
});
test("visual settings migrate older saves and clamp new controls", () => {
  assert.equal(
    parseSettings({ particles: 900 }).flowOpacity,
    defaults.flowOpacity,
  );
  const clamped = parseSettings({
    flowOpacity: -2,
    flowGravity: 99,
    gravityNodes: 2.8,
  });
  assert.equal(clamped.flowOpacity, 0);
  assert.equal(clamped.flowGravity, 2);
  assert.equal(clamped.gravityNodes, 3);
  const invalid = parseSettings({
    flowOpacity: NaN,
    flowGravity: Infinity,
    gravityNodes: "4",
  });
  assert.equal(invalid.flowOpacity, defaults.flowOpacity);
  assert.equal(invalid.flowGravity, defaults.flowGravity);
  assert.equal(invalid.gravityNodes, defaults.gravityNodes);
});

test("multi-direction curl stays non-compressing with overlapping centers", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const f = createThreadField(
      width,
      height,
      0,
      Array.from({ length: 5 }, () => ({ x: 0.5, y: 0.5, mass: 1.5 })),
    );
    const hx = width / Math.min(width, height) / (f.columns - 1);
    const hy = height / Math.min(width, height) / (f.rows - 1);
    for (let phase = 0; phase < 20; phase++) {
      f.phase = phase * 7;
      f.tick = 0;
      stepThreadField(f, 0.65, 3, 2);
      let left = 0,
        right = 0,
        up = 0,
        down = 0;
      for (let y = 1; y < f.rows - 1; y++)
        for (let x = 1; x < f.columns - 1; x++) {
          const j = (y * f.columns + x) * 2;
          const divergence =
            (f.grid[j + 2] - f.grid[j - 2]) / (2 * hx) +
            (f.grid[j + f.columns * 2 + 1] - f.grid[j - f.columns * 2 + 1]) /
              (2 * hy);
          assert.ok(
            Math.abs(divergence) < 0.00003,
            "flow must not compress into point sinks",
          );
          assert.ok(Math.hypot(f.grid[j], f.grid[j + 1]) <= 2.201);
          if (f.grid[j] < -0.1) left++;
          if (f.grid[j] > 0.1) right++;
          if (f.grid[j + 1] < -0.1) up++;
          if (f.grid[j + 1] > 0.1) down++;
        }
      for (const count of [left, right, up, down]) assert.ok(count > 100);
    }
  }
});
test("moving a node reshapes distant field cells and complete trails in the next frame", () => {
  const f = createThreadField(1200, 800, 80, [
    { id: "leader", x: 0.5, y: 0.5, mass: 1.5 },
  ]);
  stepThreadField(f);
  reweaveThreadField(f);
  const before = f.grid.slice(),
    buffers = f.particles.map((p) => p.trail);
  const oldTrails = f.particles.map((p) => p.trail.slice());
  f.tick = 1;
  updateThreadAnchors(f, [{ id: "leader", x: 0.7, y: 0.3, mass: 1.5 }]);
  stepThreadField(f);
  reweaveThreadField(f);
  let changed = 0;
  for (let i = 0; i < f.grid.length; i += 2)
    if (Math.hypot(f.grid[i] - before[i], f.grid[i + 1] - before[i + 1]) > 0.02)
      changed++;
  assert.ok(changed > f.columns * f.rows * 0.8);
  assert.notEqual(
    f.grid[0],
    before[0],
    "a corner must respond as well as the node neighborhood",
  );
  f.particles.forEach((p, i) => {
    assert.equal(p.trail, buffers[i]);
    assert.notDeepEqual(p.trail, oldTrails[i]);
    assert.ok([...p.trail].every(Number.isFinite));
  });
});
test("zero gravity decouples node movement from the field", () => {
  const a = createThreadField(1200, 800, 0, [{ id: "a", x: 0.5, y: 0.5 }]);
  const b = createThreadField(1200, 800, 0, [{ id: "a", x: 0.5, y: 0.5 }]);
  updateThreadAnchors(b, [{ id: "a", x: 0.9, y: 0.2 }]);
  stepThreadField(a, 0.65, 1.2, 0);
  stepThreadField(b, 0.65, 1.2, 0);
  assert.deepEqual(a.grid, b.grid);
});
test("repeated whole-field dragging retains buffers and keeps full ribbons finite", () => {
  const f = createThreadField(1440, 900, 720, [{ id: "a", x: 0.3, y: 0.5 }]);
  const buffers = f.particles.map((p) => p.trail),
    grid = f.grid,
    potential = f.potential;
  for (let i = 0; i < 240; i++) {
    updateThreadAnchors(f, [
      {
        id: "a",
        x: 0.5 + 0.4 * Math.sin(i / 21),
        y: 0.5 + 0.4 * Math.cos(i / 27),
      },
    ]);
    stepThreadField(f, 2, 3, 2);
    reweaveThreadField(f);
  }
  assert.equal(f.grid, grid);
  assert.equal(f.potential, potential);
  assert.equal(new Set(f.particles.map((p) => p.color)).size, 6);
  f.particles.forEach((p, i) => {
    assert.equal(p.trail, buffers[i]);
    assert.ok([...p.trail].every(Number.isFinite));
  });
});
