import test from "node:test";
import assert from "node:assert/strict";
import { gravityLeaders } from "../src/gravity";
import { nodes, edges, type AtlasEdge } from "../src/data";
import {
  createThreadField,
  stepThreadField,
  updateThreadAnchors,
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

test("overlapping centers retain through-flow even at maximum influence", () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    const field = createThreadField(
      width,
      height,
      0,
      Array.from({ length: 5 }, () => ({ x: 0.5, y: 0.5, mass: 1.5 })),
    );
    for (let phase = 0; phase < 40; phase++) {
      field.phase = phase * 7;
      field.tick = 0;
      stepThreadField(field, 0.65, 3, 2);
      for (let i = 0; i < field.grid.length; i += 2) {
        assert.ok(
          field.grid[i] > 0.15,
          "flow must not stall or fold into a point sink",
        );
        assert.ok(Number.isFinite(field.grid[i + 1]));
      }
    }
  }
});
test("particles placed at a gravity center travel out instead of remaining trapped", () => {
  const field = createThreadField(
    1200,
    800,
    64,
    Array.from({ length: 5 }, () => ({ x: 0.5, y: 0.5, mass: 1.5 })),
  );
  for (const p of field.particles) {
    p.x = 600;
    p.y = 400;
    p.age = 0;
    p.life = 480;
  }
  for (let tick = 0; tick < 120; tick++) stepThreadField(field, 0.65, 3, 2);
  assert.ok(field.particles.every((p) => p.x > 630));
  assert.equal(field.particles.length, 64);
});

test("moving a center displaces nearby existing trails and refreshes the next frame", () => {
  const field = createThreadField(1200, 800, 1, [
    { id: "leader", x: 0.5, y: 0.5, mass: 1.5 },
  ]);
  const p = field.particles[0],
    trail = p.trail;
  p.x = 600;
  p.y = 400;
  p.trail.fill(400);
  p.trail[0] = 600;
  const previousGrid = field.grid.slice();
  field.tick = 1;
  updateThreadAnchors(field, [{ id: "leader", x: 0.6, y: 0.5, mass: 1.5 }]);
  assert.ok(p.x > 600 && p.x < 630);
  assert.equal(p.trail, trail);
  assert.ok(Math.abs(p.trail[0] - p.x) < 0.001);
  assert.equal(p.y, 400);
  assert.equal(field.dirty, true);
  stepThreadField(field);
  assert.notDeepEqual(field.grid, previousGrid);
  assert.equal(field.dirty, false);
});
test("zero gravity, paused flow and newly introduced centers do not jump the ribbons", () => {
  for (const [gravity, follow] of [
    [0, true],
    [1, false],
  ] as const) {
    const field = createThreadField(1200, 800, 12, [
      { id: "a", x: 0.5, y: 0.5 },
    ]);
    const before = field.particles.map((p) => [p.x, p.y]);
    updateThreadAnchors(field, [{ id: "a", x: 0.7, y: 0.6 }], gravity, follow);
    assert.deepEqual(
      field.particles.map((p) => [p.x, p.y]),
      before,
    );
  }
  const field = createThreadField(1200, 800, 12, [{ id: "a", x: 0.5, y: 0.5 }]);
  const before = field.particles.map((p) => [p.x, p.y]);
  updateThreadAnchors(field, [{ id: "b", x: 0.8, y: 0.8 }]);
  assert.deepEqual(
    field.particles.map((p) => [p.x, p.y]),
    before,
  );
});
