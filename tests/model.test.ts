import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  eventAt, keeper, personaAt, stateAt, storyAtQueue, toQueue,
} from "../src/model/model.ts";
import { BEN, INT, POW, TYPE } from "../src/model/types.ts";
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

test("a story continued later maps its two stretches onto the queue", () => {
  const continued = manifest.stories.find((s) => s.segs.length > 1)!;
  assert.equal(continued.new, "updated");
  const [[a, b], [c]] = continued.segs;
  assert.equal(toQueue(continued.segs, 1), a);
  assert.equal(toQueue(continued.segs, b - a + 1), b);
  assert.equal(toQueue(continued.segs, b - a + 2), c);
  assert.equal(storyAtQueue(manifest.stories, c)?.id, continued.id);
});

test("a person's Big Five is read up to a queue position", () => {
  const [p, persona] = Object.entries(people.persona).find(([, x]) => x.h.length > 2)!;
  assert.ok(Number(p) >= 0);
  assert.equal(personaAt(persona, persona.h[0][0] - 1), null);
  assert.deepEqual(personaAt(persona, persona.h[1][0]), persona.h[1][1]);
});
