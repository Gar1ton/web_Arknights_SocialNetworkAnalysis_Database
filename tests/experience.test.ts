import test from "node:test";
import assert from "node:assert/strict";
import { categories, searchArchives, visibleArchives } from "../src/archives";
import { resolveRoute } from "../src/routes";
import {
  createThreadField,
  stepThreadField,
  particleBudget,
  TRAIL_LENGTH,
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
  for (let frame = 0; frame < 5 * 60 * 60 * 24; frame++) {
    stepThreadField(f, 0.65, 1.2);
    if (frame % 2400 === 0) {
      for (const p of f.particles) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.length <= TRAIL_LENGTH && p.head < TRAIL_LENGTH);
        assert.ok(p.x >= -4 && p.x <= 1284 && p.y >= -4 && p.y <= 804);
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
