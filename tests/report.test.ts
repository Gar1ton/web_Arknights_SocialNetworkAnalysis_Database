import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  displayName,
  newDraft,
  problems,
  type Draft,
} from "../src/report/report.ts";
import { feedbackOpen, spamCheck } from "../src/report/api.ts";
import { archive } from "./fixture.ts";

const sample = archive("main-08");
const byId = new Map(sample.nodes.map((n) => [n.id, n]));
const edge = sample.edges[0];
const ctx = {
  archive: "main-08",
  dataVersion: "run-1",
  byId,
  edges: sample.edges,
};
const ready = (d: Draft): Draft => ({
  ...d,
  reason: "这组关系的类型和剧情里的语气不一致",
  agreed: true,
});

test("the entry presets the form", () => {
  const fromEdge = newDraft({ kind: "edge", edgeId: edge.id }, sample.edges);
  assert.equal(fromEdge.type, "relation");
  assert.equal(fromEdge.edgeId, edge.id);
  const node = sample.nodes[0];
  const fromNode = newDraft({ kind: "node", nodeId: node.id }, sample.edges);
  assert.equal(fromNode.type, null);
  assert.deepEqual(fromNode.people, [node.id]);
  assert.equal(newDraft({ kind: "none" }, sample.edges).nodeId, "");
});

test("only the reason, the target and the notice are required", () => {
  const empty = newDraft({ kind: "none" }, sample.edges);
  assert.deepEqual(problems(empty), [
    "请选择问题类型",
    "请写下至少 10 个字的理由",
    "请先阅读并勾选提交说明",
  ]);
  assert.deepEqual(problems(ready({ ...empty, type: "other" })), []);
  const merge = ready({
    ...empty,
    type: "merge",
    people: [sample.nodes[0].id],
  });
  assert.deepEqual(problems(merge), ["请选择至少两个角色"]);
  assert.deepEqual(problems(ready({ ...empty, type: "relation" })), [
    "请选择是哪一组关系",
  ]);
});

test("lengths count characters, and usernames hold no contact details", () => {
  const d = ready({
    ...newDraft({ kind: "none" }, sample.edges),
    type: "other",
  });
  assert.deepEqual(problems({ ...d, reason: "一二三四五六七八九" }), [
    "请写下至少 10 个字的理由",
  ]);
  assert.deepEqual(problems({ ...d, contributor: "罗".repeat(40) }), []);
  assert.deepEqual(problems({ ...d, contributor: "罗".repeat(41) }), [
    "用户名最多 40 个字",
  ]);
  for (const name of ["me@example.com", "13800138000"])
    assert.deepEqual(problems({ ...d, contributor: name }), [
      "用户名里不要放邮箱或电话号码",
    ]);
  assert.equal(displayName("  "), "匿名贡献者");
});

test("a report carries only the fields of its type, with the names on screen", () => {
  const d = ready({
    ...newDraft({ kind: "edge", edgeId: edge.id }, sample.edges),
    direction: "ab",
    suggestedType: "affinity",
    correctName: "not sent for a relation",
    contributor: "  干员  ",
    credit: true,
  });
  const report = buildReport(d, ctx);
  assert.equal(report.type, "relation");
  assert.equal(report.dataVersion, "run-1");
  assert.deepEqual(report.target, {
    kind: "edge",
    id: edge.id,
    names: [byId.get(edge.source)!.name, byId.get(edge.target)!.name],
  });
  assert.deepEqual(report.fields, {
    direction: "ab",
    suggestedType: "affinity",
    shown: { ab: edge.ab?.type ?? null, ba: edge.ba?.type ?? null },
  });
  assert.equal(report.contributor, "干员");
  assert.equal(report.credit, true);
  const anonymous = buildReport({ ...d, contributor: " " }, ctx);
  assert.equal(anonymous.contributor, "");
  assert.equal(anonymous.credit, false);
  const node = sample.nodes[0];
  const traits = buildReport(
    {
      ...d,
      type: "personality",
      nodeId: node.id,
      traits: [null, "lower", null, "higher", null],
    },
    ctx,
  );
  assert.deepEqual(traits.fields.traits, { C: "lower", A: "higher" });
});

test("the panel sends nothing until the service is live", () => {
  assert.equal(feedbackOpen, false);
});

test("light spam checks", () => {
  const d = ready({
    ...newDraft({ kind: "none" }, sample.edges),
    type: "other",
  });
  assert.equal(spamCheck({ ...d, website: "x" }, 0, 10_000), "bot");
  assert.equal(spamCheck(d, 9_000, 10_000), "请稍等几秒再提交");
  assert.equal(spamCheck(d, 0, 10_000), null);
});
