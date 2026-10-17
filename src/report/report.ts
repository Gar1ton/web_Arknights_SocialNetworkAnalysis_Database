import type { AtlasEdge, AtlasNode, Octant } from "../data";
export type ReportType =
  "merge" | "name" | "relation" | "personality" | "other";
export const reportTypes: [ReportType, string][] = [
  ["merge", "角色合并"],
  ["name", "人名异常"],
  ["relation", "关系异常"],
  ["personality", "人格异常"],
  ["other", "其他问题"],
];
/** Where the panel was opened from. */
export type ReportTarget =
  | { kind: "node"; nodeId: string }
  | { kind: "edge"; edgeId: string }
  | { kind: "none" };
export type RelationDirection = "ab" | "ba" | "both" | "notReal";
export type TraitVote = "higher" | "lower";
/** Everything the form holds; only the fields of the chosen type are sent. */
export interface Draft {
  origin: ReportTarget;
  type: ReportType | null;
  /** The character for 人名异常 and 人格异常, and the start of a relation pick. */
  nodeId: string;
  /** The relation for 关系异常. */
  edgeId: string;
  /** The characters for 角色合并. */
  people: string[];
  correctName: string;
  direction: RelationDirection | null;
  suggestedType: Octant | "unsure" | "";
  /** One vote for each Big Five trait, in O C E A N order. */
  traits: (TraitVote | null)[];
  reason: string;
  contributor: string;
  credit: boolean;
  agreed: boolean;
  /** A field people never see; only scripts fill it. */
  website: string;
}
/** What the panel sends: one row in the store. */
export interface Report {
  type: ReportType;
  archive: string;
  dataVersion: string;
  target: { kind: ReportTarget["kind"]; id: string; names: string[] };
  fields: Record<string, unknown>;
  reason: string;
  /** Empty when the contributor gives no username. */
  contributor: string;
  credit: boolean;
}
export const limits = { reasonMin: 10, reasonMax: 2000, name: 40 };
/** Counts characters, not UTF-16 units, so 40 Chinese characters fit 40. */
export const length = (text: string) => Array.from(text.trim()).length;
export const displayName = (name: string) => name.trim() || "匿名贡献者";
export function newDraft(origin: ReportTarget, edges: AtlasEdge[]): Draft {
  const edge =
    origin.kind === "edge"
      ? edges.find((e) => e.id === origin.edgeId)
      : undefined;
  return {
    origin,
    type: edge ? "relation" : null,
    nodeId: origin.kind === "node" ? origin.nodeId : (edge?.source ?? ""),
    edgeId: edge?.id ?? "",
    people: origin.kind === "node" ? [origin.nodeId] : [],
    correctName: "",
    direction: null,
    suggestedType: "",
    traits: [null, null, null, null, null],
    reason: "",
    contributor: "",
    credit: false,
    agreed: false,
    website: "",
  };
}
/** Messages for the form, in the order of the fields. Empty means it can be sent. */
export function problems(d: Draft): string[] {
  const out: string[] = [];
  if (!d.type) out.push("请选择问题类型");
  if (d.type === "merge" && d.people.length < 2) out.push("请选择至少两个角色");
  if ((d.type === "name" || d.type === "personality") && !d.nodeId)
    out.push("请选择角色");
  if (d.type === "relation" && !d.edgeId) out.push("请选择是哪一组关系");
  const reason = length(d.reason);
  if (reason < limits.reasonMin) out.push("请写下至少 10 个字的理由");
  if (reason > limits.reasonMax) out.push("理由最多 2000 字");
  if (length(d.contributor) > limits.name) out.push("用户名最多 40 个字");
  if (/@|\d{7,}/.test(d.contributor)) out.push("用户名里不要放邮箱或电话号码");
  if (!d.agreed) out.push("请先阅读并勾选提交说明");
  return out;
}
const isText = (v: unknown, max: number): v is string =>
  typeof v === "string" && length(v) <= max;
const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const directions = ["ab", "ba", "both", "notReal"];
/**
 * The service's check: the rules of problems(), on the record the panel sent.
 * Returns a copy with only the known keys, or null.
 */
export function parseReport(text: string): Report | null {
  let r: any;
  try {
    r = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(r) || !reportTypes.some(([k]) => k === r.type)) return null;
  if (!isText(r.archive, 40) || !/^[\w-]+$/.test(r.archive)) return null;
  if (!isText(r.dataVersion, 80)) return null;
  const t = r.target;
  if (!isObject(t) || !["node", "edge", "none"].includes(t.kind)) return null;
  if (!isText(t.id, 120) || !Array.isArray(t.names) || t.names.length > 20)
    return null;
  if (!t.names.every((n: unknown) => isText(n, 80))) return null;
  const f = r.fields;
  if (!isObject(f) || JSON.stringify(f).length > 4000) return null;
  if (r.type === "merge") {
    const p = f.people;
    if (!Array.isArray(p) || p.length < 2 || p.length > 20) return null;
    if (!p.every((id: unknown) => isText(id, 120))) return null;
  }
  if (r.type === "relation") {
    if (t.kind !== "edge") return null;
    if (f.direction != null && !directions.includes(f.direction)) return null;
  }
  if (r.type === "name" || r.type === "personality") {
    if (t.kind !== "node") return null;
    if (
      r.type === "name" &&
      f.correctName != null &&
      !isText(f.correctName, limits.name)
    )
      return null;
  }
  if (r.type === "personality" && f.traits != null) {
    if (!isObject(f.traits)) return null;
    for (const [k, v] of Object.entries(f.traits))
      if (!traitKeys.includes(k) || (v !== "higher" && v !== "lower"))
        return null;
  }
  if (typeof r.reason !== "string") return null;
  const reason = length(r.reason);
  if (reason < limits.reasonMin || reason > limits.reasonMax) return null;
  if (typeof r.contributor !== "string") return null;
  const contributor = r.contributor.trim();
  if (length(contributor) > limits.name || /@|\d{7,}/.test(contributor))
    return null;
  if (typeof r.credit !== "boolean" || (r.credit && !contributor)) return null;
  return {
    type: r.type,
    archive: r.archive,
    dataVersion: r.dataVersion,
    target: { kind: t.kind, id: t.id, names: t.names },
    fields: f,
    reason: r.reason.trim(),
    contributor,
    credit: r.credit,
  };
}
type Context = {
  archive: string;
  dataVersion: string;
  byId: Map<string, AtlasNode>;
  edges: AtlasEdge[];
};
const traitKeys = ["O", "C", "E", "A", "N"];
/** Builds the record to send. Call it only when problems() is empty. */
export function buildReport(d: Draft, ctx: Context): Report {
  const type = d.type!;
  const name = (id: string) => ctx.byId.get(id)?.name ?? id;
  const node = ctx.byId.get(d.nodeId);
  const edge = ctx.edges.find((e) => e.id === d.edgeId);
  const origin = d.origin;
  let target: Report["target"];
  let fields: Record<string, unknown> = {};
  if (type === "merge") {
    target = { kind: "none", id: "", names: d.people.map(name) };
    fields = { people: d.people };
  } else if (type === "relation" && edge) {
    target = {
      kind: "edge",
      id: edge.id,
      names: [name(edge.source), name(edge.target)],
    };
    fields = {
      direction: d.direction,
      suggestedType: d.suggestedType || null,
      // What the visitor saw: ids can change in the next build.
      shown: { ab: edge.ab?.type ?? null, ba: edge.ba?.type ?? null },
    };
  } else if ((type === "name" || type === "personality") && node) {
    target = { kind: "node", id: node.id, names: [node.name] };
    fields =
      type === "name"
        ? {
            correctName: d.correctName.trim() || null,
            shown: { name: node.name, en: node.en, kind: node.kind },
          }
        : {
            traits: Object.fromEntries(
              d.traits.flatMap((v, i) => (v ? [[traitKeys[i], v]] : [])),
            ),
            shown: node.profile.bigFive,
          };
  } else if (origin.kind === "node") {
    target = { kind: "node", id: origin.nodeId, names: [name(origin.nodeId)] };
  } else if (origin.kind === "edge") {
    const e = ctx.edges.find((x) => x.id === origin.edgeId);
    target = {
      kind: "edge",
      id: origin.edgeId,
      names: e ? [name(e.source), name(e.target)] : [],
    };
  } else target = { kind: "none", id: "", names: [] };
  const contributor = d.contributor.trim();
  return {
    type,
    archive: ctx.archive,
    dataVersion: ctx.dataVersion,
    target,
    fields,
    reason: d.reason.trim(),
    contributor,
    credit: d.credit && contributor !== "",
  };
}
/* Browser storage. Every access can throw in a private window. */
const nameKey = "atlas-contributor",
  agreedKey = "atlas-report-agreed",
  draftKey = "atlas-report-draft";
export function savedName() {
  try {
    return localStorage.getItem(nameKey) || "";
  } catch {
    return "";
  }
}
export function rememberName(name: string) {
  try {
    if (name) localStorage.setItem(nameKey, name);
    localStorage.setItem(agreedKey, "1");
  } catch {}
}
export function agreedBefore() {
  try {
    return localStorage.getItem(agreedKey) === "1";
  } catch {
    return false;
  }
}
/** A draft lives until the tab closes, for the same story and the same entry. */
const draftId = (archive: string, origin: ReportTarget) =>
  archive + " " + JSON.stringify(origin);
export function loadDraft(archive: string, origin: ReportTarget) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey) || "null");
    return saved?.id === draftId(archive, origin)
      ? (saved.draft as Draft)
      : null;
  } catch {
    return null;
  }
}
export function saveDraft(archive: string, draft: Draft) {
  try {
    sessionStorage.setItem(
      draftKey,
      JSON.stringify({ id: draftId(archive, draft.origin), draft }),
    );
  } catch {}
}
export function clearDraft() {
  try {
    sessionStorage.removeItem(draftKey);
  } catch {}
}
/** True when closing would lose something the visitor typed or picked. */
export function hasContent(d: Draft) {
  return !!(
    d.reason.trim() ||
    d.correctName.trim() ||
    d.direction ||
    d.suggestedType ||
    d.traits.some(Boolean)
  );
}
