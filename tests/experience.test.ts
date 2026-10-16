import test from "node:test";
import assert from "node:assert/strict";
import { categories, searchArchives, visibleArchives } from "../src/archives";
import { resolveRoute } from "../src/routes";
import {
  advanceThreadField,
  createThreadField,
  resizeThreadField,
  reweaveThreadField,
  stepThreadField,
  traceRibbon,
  particleBudget,
  FADE_OUT,
  TICK_MS,
  TRAIL_LENGTH,
  type ThreadField,
} from "../src/particles";
import { manifest } from "./fixture";

const archives = visibleArchives(manifest.archives);
test("merged tables are hidden and stories follow category and story order", () => {
  assert.ok(manifest.archives.some((a) => a.category === "总览"));
  assert.ok(archives.every((a) => a.category !== "总览"));
  assert.equal(archives[0].id, "main-00");
  assert.equal(new Set(archives.map((a) => a.id)).size, archives.length);
  const order = archives.map((a) => categories.indexOf(a.category));
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v >= order[i - 1])));
  const main = archives.filter((a) => a.category === "主线");
  assert.deepEqual(
    main.map((a) => a.order),
    main.map((_, i) => i),
  );
  assert.ok(archives.every((a) => a.category !== "集成战略"));
  assert.deepEqual(categories, ["主线", "活动", "密录"]);
  assert.equal(
    manifest.info.totals.stories,
    manifest.archives.filter((a) => a.category !== "总览").length,
  );
});
test("archive search combines normalized text with category and handles empty results", () => {
  assert.equal(searchArchives(archives, "  孤星  ")[0]?.title, "孤星");
  assert.equal(searchArchives(archives, "第8章")[0]?.id, "main-08");
  assert.equal(searchArchives(archives, "孤星", "主线").length, 0);
  assert.ok(searchArchives(archives, "阿米娅").length > 10);
  assert.equal(searchArchives(archives, "不存在的活动").length, 0);
  assert.equal(searchArchives(archives, "").length, archives.length);
  assert.ok(
    searchArchives(archives, "", "主线").every((a) => a.category === "主线"),
  );
});
test("routes preserve archive deep links and reject malformed ids", () => {
  assert.deepEqual(resolveRoute("#graph/event-012"), {
    page: "graph",
    archiveId: "event-012",
  });
  assert.equal(resolveRoute("#graph/<script>").page, "archives");
  assert.equal(resolveRoute("#archives").page, "archives");
  assert.equal(resolveRoute("#atlas").page, "graph");
  assert.equal(resolveRoute("#studio").archiveId, "main-08");
  assert.equal(resolveRoute("#").page, "home");
});
test("particle budget scales by area and never exceeds fixed caps", () => {
  assert.equal(particleBudget(99999, 10000, 10000, false), 1600);
  assert.equal(particleBudget(99999, 10000, 10000, true), 720);
  assert.equal(particleBudget(0, 1200, 800, false), 0);
  assert.ok(
    particleBudget(3000, 390, 600, false) <
      particleBudget(3000, 1440, 900, false),
  );
});
test("five simulated hours preserve the same particle buffers and bounded geometry", () => {
  const f = createThreadField(1280, 800, 64);
  const particles = f.particles,
    grid = f.grid,
    buffers = f.particles.map((p) => p.trail);
  let peak = 0;
  // Heads that leave the canvas keep drifting while they fade out.
  const margin = 2 + FADE_OUT * 2.2 * 0.65 * 2.1 + 1;
  for (let frame = 0; frame < 5 * 60 * 60 * 24; frame++) {
    stepThreadField(f, 0.65, 1.2);
    if (frame % 2400 === 0) {
      for (const p of f.particles) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.length <= TRAIL_LENGTH && p.head < TRAIL_LENGTH);
        assert.ok(p.x >= -margin && p.x <= 1280 + margin);
        assert.ok(p.y >= -margin && p.y <= 800 + margin);
        peak = Math.max(peak, p.length);
      }
    }
  }
  assert.equal(f.particles, particles);
  assert.equal(f.grid, grid);
  assert.equal(f.particles.length, 64);
  assert.equal(peak, TRAIL_LENGTH);
  f.particles.forEach((p, i) => {
    assert.equal(p.trail, buffers[i]);
    assert.equal(p.trail.length, TRAIL_LENGTH * 2);
  });
});
test("maximum density stays finite through repeated particle respawns", () => {
  const f = createThreadField(1920, 1080, 1600, [{ x: 0.5, y: 0.5 }]);
  for (let frame = 0; frame < 1440; frame++) stepThreadField(f, 2, 3);
  assert.equal(f.particles.length, 1600);
  for (const p of f.particles) assert.ok([...p.trail].every(Number.isFinite));
});

/** Trail samples by absolute sample number, for particles that did not respawn. */
function history(f: ThreadField) {
  return f.particles.map((p) => {
    const samples = new Map<number, string>();
    for (let back = 0; back < p.length; back++) {
      const i = (p.head - back + TRAIL_LENGTH) % TRAIL_LENGTH;
      samples.set(f.samples - back, p.trail[i * 2] + "," + p.trail[i * 2 + 1]);
    }
    return { life: p.life, age: p.age, samples };
  });
}
test("still anchors never re-trace drawn ribbons, so the painting cannot snap", () => {
  const f = createThreadField(1440, 900, 200, [{ id: "a", x: 0.6, y: 0.4 }]);
  for (let i = 0; i < TRAIL_LENGTH; i++) stepThreadField(f);
  reweaveThreadField(f); // the first paint traces full ribbons once
  const before = history(f);
  // Thirty-five ticks of 60 Hz frames, painted like FlowField does; several
  // grid refreshes happen meanwhile.
  for (let frame = 0; frame < 35 * 2.4; frame++) {
    advanceThreadField(f, 1000 / 60, 0.65, 1.2, 1);
    reweaveThreadField(f);
  }
  const after = history(f);
  let compared = 0;
  before.forEach((old, i) => {
    if (after[i].age < old.age) return; // respawned
    for (const [n, point] of old.samples)
      if (after[i].samples.has(n)) {
        assert.equal(after[i].samples.get(n), point);
        compared++;
      }
  });
  assert.ok(compared > 120 * (TRAIL_LENGTH - 35));
});
test("motion follows elapsed time, not the display's frame rate", () => {
  const slow = createThreadField(1280, 800, 120),
    fast = createThreadField(1280, 800, 120);
  for (let i = 0; i < 24; i++) advanceThreadField(slow, TICK_MS);
  for (let i = 0; i < 144; i++) advanceThreadField(fast, 1000 / 144);
  assert.equal(slow.samples, fast.samples);
  slow.particles.forEach((p, i) => {
    const q = fast.particles[i];
    assert.equal(p.head, q.head);
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < 0.5);
  });
  // A long stall resumes with at most two ticks of travel.
  const before = fast.particles.map((p) => [p.x, p.y]);
  advanceThreadField(fast, 5000);
  assert.ok(fast.samples - slow.samples <= 2);
  fast.particles.forEach((p, i) =>
    assert.ok(Math.hypot(p.x - before[i][0], p.y - before[i][1]) < 2 * 3.1),
  );
});
test("ribbon vertices stay pinned to their samples while the trail moves on", () => {
  const f = createThreadField(1280, 800, 40);
  for (let i = 0; i < TRAIL_LENGTH + 5; i++) stepThreadField(f);
  const vertices = () =>
    f.particles.map((p) => {
      const out: string[] = [];
      traceRibbon(f, p, {
        moveTo: () => {},
        lineTo: (x, y) => out.push(x + "," + y),
      });
      return out.slice(0, -2); // drop the newest sample and the moving head
    });
  const before = vertices();
  advanceThreadField(f, TICK_MS * 0.5);
  advanceThreadField(f, TICK_MS * 0.5);
  const after = vertices();
  before.forEach((old, i) => {
    if (f.particles[i].age < 5) return; // respawned
    const kept = new Set(after[i]);
    // Only the oldest vertex may have dropped off the end.
    assert.ok(old.slice(1).every((v) => kept.has(v)));
  });
});
test("resizing stretches the existing ribbons instead of re-seeding them", () => {
  const f = createThreadField(1000, 800, 50);
  for (let i = 0; i < 30; i++) stepThreadField(f);
  const buffers = f.particles.map((p) => p.trail),
    heads = f.particles.map((p) => [p.x, p.y]);
  resizeThreadField(f, 1000, 600, 60);
  assert.equal(f.particles.length, 60);
  f.particles.slice(0, 50).forEach((p, i) => {
    assert.equal(p.trail, buffers[i]);
    assert.equal(p.x, heads[i][0]);
    assert.ok(Math.abs(p.y - heads[i][1] * 0.75) < 1e-9);
  });
  resizeThreadField(f, 1000, 600, 20);
  assert.equal(f.particles.length, 20);
});
