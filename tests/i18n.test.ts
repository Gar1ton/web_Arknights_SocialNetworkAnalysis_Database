import test from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { lang, setLang, t } from "../src/i18n.ts";
import { nodeName, altName, level } from "../src/data.ts";
import { archiveCode, archiveTitle, categories } from "../src/archives.ts";
import { problems, newDraft } from "../src/report/report.ts";
import { archive, manifest } from "./fixture.ts";

const en = JSON.parse(readFileSync(new URL("../public/data/en.json", import.meta.url), "utf8"));

test("Chinese is the default outside a browser", () => {
  assert.equal(lang(), "zh");
  assert.equal(t("中", "en"), "中");
});

test("English mode names operators in English and falls back to Chinese", (context) => {
  setLang("en");
  context.after(() => setLang("zh"));
  const data = archive("main-08");
  const named = data.nodes.find((n) => n.en)!;
  assert.equal(nodeName(named), named.en);
  assert.equal(altName(named), named.name);
  assert.equal(level(80), "high");
  const chapter = manifest.stories.find((s) => s.id === "main-08")!;
  assert.equal(archiveCode(chapter), "Main Theme · Episode 08");
  // en.json is not loaded here, so the title falls back to Chinese.
  assert.equal(archiveTitle(chapter), chapter.title);
  assert.equal(problems(newDraft({ kind: "none" }, []))[0], "Choose a problem type");
});

test("en.json titles every story shown and splits every event", () => {
  for (const s of manifest.stories) {
    assert.ok(categories.includes(s.category), s.id);
    assert.ok(en.archives[s.id], s.id);
    if (s.category === "活动") assert.ok(["side", "collection"].includes(en.events[s.id]), s.id);
  }
});
