import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { lang, setLang, t } from "../src/i18n.ts";
import { communityLabel, nodeName, altName, level } from "../src/data.ts";
import { archiveCode, archiveTitle } from "../src/archives.ts";
import { problems, newDraft } from "../src/report/report.ts";
import { archive, manifest } from "./fixture.ts";

test("Chinese is the default outside a browser", () => {
  assert.equal(lang(), "zh");
  assert.equal(t("中", "en"), "中");
});

test("English mode rebuilds labels from the data", (context) => {
  setLang("en");
  context.after(() => setLang("zh"));
  const data = archive("main-08");
  const lead = data.communities.find((c) => / 等 \d+ 人$/.test(c.label))!;
  assert.match(communityLabel(lead, data.nodes), /^\S.* \+\d+$/);
  assert.equal(
    communityLabel({ label: "其他 8 人", size: 8 }, []),
    "Others (8)",
  );
  const named = data.nodes.find((n) => n.en)!;
  assert.equal(nodeName(named), named.en);
  assert.equal(altName(named), named.name);
  const npc = data.nodes.find((n) => !n.en)!;
  assert.equal(nodeName(npc), npc.name);
  assert.equal(altName(npc), "");
  assert.equal(level(80), "high");
  const chapter = manifest.archives.find((a) => a.id === "main-08")!;
  assert.equal(archiveCode(chapter), "Main Theme · Episode 08");
  // en.json is not loaded here, so the title falls back to Chinese.
  assert.equal(archiveTitle(chapter), chapter.title);
  assert.equal(
    problems(newDraft({ kind: "none" }, []))[0],
    "Choose a problem type",
  );
});

test("en.json splits every shown event into Side Story or Story Collection", () => {
  const en = JSON.parse(
    readFileSync(new URL("../public/data/en.json", import.meta.url), "utf8"),
  );
  const events = manifest.archives.filter((a) => a.category === "活动");
  assert.ok(events.length > 0);
  for (const a of events)
    assert.ok(["side", "collection"].includes(en.events[a.id]), a.id);
});
