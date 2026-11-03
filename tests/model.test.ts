import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  arrange, edgesAt, eventAt, keeper, layout, personaAt, stateAt, storyAtQueue, toQueue, trend,
} from "../src/model/model.ts";
import { BEN, INT, POW, TYPE } from "../src/model/types.ts";
import { defaultStory, hashFor, resolveRoute } from "../src/routes.ts";
import { indexed, manifest, people, story, storyFiles } from "./fixture.ts";

test("every story file matches the manifest and holds positions inside the story", () => {
  assert.equal(storyFiles.length, manifest.stories.length);
  for (const meta of manifest.stories) {
    const s = story(meta.id);
    assert.equal(s.m, meta.m, meta.id);
    assert.equal(s.segs.reduce((n, [a, b]) => n + b - a + 1, 0), s.m, meta.id);
    for (const e of s.ev) assert.ok(1 <= e[0] && e[0] <= e[1] && e[1] <= s.m, meta.id);
    for (const r of s.ch) {
      assert.ok(1 <= r[0] && r[0] <= s.m, meta.id);
      assert.ok(Math.abs(r[BEN]) <= 1 && Math.abs(r[POW]) <= 1 && r[INT] >= 0 && r[INT] <= 1.5, meta.id);
      assert.ok(r[TYPE] >= 0 && r[TYPE] < 8, meta.id);
    }
  }
});

test("published files carry data, not how it was made", () => {
  const text = readFileSync(new URL("../public/data/stories/main-08.json", import.meta.url), "utf8");
  for (const word of ["line_keys", "evidence", "confidence", "salience", "review"]) assert.ok(!text.includes(word), word);
  const e = story("main-08").ev[0];
  assert.equal(e.length, 7, "start, end, scene, title, summary, participants, lines");
});

test("the state at a position is the last row at or before it", () => {
  const rows = [[3, 0, 1, 0, 0.1, 0, 0.1], [9, 0, 1, 1, 0.5, 0.2, 0.5]] as const;
  assert.equal(stateAt(rows, 2), null);
  assert.equal(stateAt(rows, 3)![4], 0.1);
  assert.equal(stateAt(rows, 8)![4], 0.1);
  assert.equal(stateAt(rows, 100)![4], 0.5);
});

test("the network grows along the story and ends with every relation", () => {
  const s = indexed("main-08");
  const keep = keeper(people, false);
  const end = edgesAt(s, s.data.m, keep).length;
  assert.equal(end, s.pairs.size);
  assert.equal(edgesAt(s, 0, keep).length, 0);
  const series = trend(s, keep);
  assert.equal(series[series.length - 1].n, end);
  for (let i = 1; i < series.length; i++) assert.ok(series[i].pos > series[i - 1].pos);
  assert.ok(eventAt(s, s.data.m) === s.data.ev.length - 1);
});

test("the layout is fixed per story and filter, finite and inside the stage", () => {
  const s = indexed("main-08");
  const keep = keeper(people, true);
  const a = layout(s, keep);
  const b = layout(s, keep);
  assert.deepEqual([...a], [...b]);
  for (const { x, y } of a.values()) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.ok(x >= 0 && x <= 1000 && y >= 0 && y <= 680);
  }
});

test("a story continued later maps its two stretches onto the queue", () => {
  const continued = manifest.stories.find((s) => s.segs.length > 1)!;
  assert.equal(continued.new, "updated");
  const [[a, b], [c]] = continued.segs;
  assert.equal(toQueue(continued.segs, 1), a);
  assert.equal(toQueue(continued.segs, b - a + 1), b);
  assert.equal(toQueue(continued.segs, b - a + 2), c);
  assert.equal(storyAtQueue(manifest.stories, c)?.id, continued.id);
});

test("stories from the latest update come first, new before continued", () => {
  const { pinned, rest } = arrange(manifest.stories, "messages", (s) => s.rel);
  assert.ok(pinned.length > 0);
  assert.ok(pinned.every((s) => s.new));
  assert.equal(pinned[0].new, "new");
  assert.ok(rest.every((s) => !s.new));
  for (let i = 1; i < rest.length; i++) assert.ok(rest[i - 1].m >= rest[i].m);
});

test("a person's Big Five is read up to a queue position", () => {
  const [p, persona] = Object.entries(people.persona).find(([, x]) => x.h.length > 2)!;
  assert.ok(Number(p) >= 0);
  assert.equal(personaAt(persona, persona.h[0][0] - 1), null);
  assert.deepEqual(personaAt(persona, persona.h[1][0]), persona.h[1][1]);
});

test("routes keep old links working and round-trip", () => {
  assert.deepEqual(resolveRoute("#graph/main-08"), { page: "story", id: "main-08" });
  assert.deepEqual(resolveRoute("#atlas"), { page: "story", id: defaultStory });
  assert.deepEqual(resolveRoute("#archives"), { page: "story", id: null });
  assert.deepEqual(resolveRoute("#graph/<script>"), { page: "story", id: null });
  assert.deepEqual(resolveRoute(""), { page: "home" });
  for (const r of [{ page: "story", id: "event-077", pair: [3, 4] }, { page: "person", p: 12, other: 30 }, { page: "home" }] as const)
    assert.deepEqual(resolveRoute(hashFor(r as never)), r);
});
