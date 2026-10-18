import { lang, t } from "./i18n";
import { englishName } from "./archives";
export type Octant =
  | "affinity"
  | "active"
  | "dominant"
  | "arrogant"
  | "cold"
  | "withdrawn"
  | "submissive"
  | "deferential";
export interface Profile {
  description: string;
  /** Big Five as 0–100, in O C E A N order; null when not scored. */
  bigFive: (number | null)[];
  evidence: (string | null)[];
  confidence: number;
}
export interface AtlasNode {
  id: string;
  name: string;
  en: string;
  kind: "named" | "npc" | "doctor";
  messages: number;
  community: number;
  degree: number;
  outDegree: number;
  inDegree: number;
  betweenness: number;
  profile: Profile;
}
/** One direction of a relationship: how the observer sees the subject. */
export interface Direction {
  type: Octant;
  benevolence: number;
  power: number;
  intensity: number;
  confidence: number;
  evidence: number;
  scopes?: number;
}
/** An unordered pair; ab is source→target, ba is target→source. */
export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  events: number;
  weight: number;
  ab: Direction | null;
  ba: Direction | null;
}
export interface Community {
  label: string;
  size: number;
}
export interface ArchiveStats {
  nodes: number;
  pairs: number;
  relations: number;
  mutual: number;
  density: number;
  reciprocity: number;
  avgDegree: number;
  octants: Record<Octant, number>;
  avgBenevolence: number;
  avgPower: number;
}
export interface ArchiveData {
  id: string;
  communities: Community[];
  stats: ArchiveStats;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}
/**
 * English names are the octant labels of Wiggins's Interpersonal Adjective
 * Scales, as used by the Moirai pipeline that produced the data.
 */
export const octants: Record<
  Octant,
  { name: string; en: string; color: string; angle: number }
> = {
  affinity: { name: "友好", en: "Warm-Agreeable", color: "#94c4b2", angle: 0 },
  active: {
    name: "热情主动",
    en: "Gregarious-Extraverted",
    color: "#c4c98e",
    angle: 45,
  },
  dominant: {
    name: "主导",
    en: "Assured-Dominant",
    color: "#ddb780",
    angle: 90,
  },
  arrogant: {
    name: "傲慢算计",
    en: "Arrogant-Calculating",
    color: "#d9886a",
    angle: 135,
  },
  cold: { name: "冷淡", en: "Cold-Quarrelsome", color: "#e18d9c", angle: 180 },
  withdrawn: {
    name: "疏离回避",
    en: "Aloof-Introverted",
    color: "#a596c4",
    angle: 225,
  },
  submissive: {
    name: "顺从",
    en: "Unassured-Submissive",
    color: "#92b0db",
    angle: 270,
  },
  deferential: {
    name: "友善配合",
    en: "Unassuming-Ingenuous",
    color: "#81c9cb",
    angle: 315,
  },
};
export const octantName = (k: Octant) => t(octants[k].name, octants[k].en);
export const octantKeys = Object.keys(octants) as Octant[];
const bigFive = [
  ["开放性", "Openness"],
  ["尽责性", "Conscientiousness"],
  ["外向性", "Extraversion"],
  ["宜人性", "Agreeableness"],
  ["神经质", "Neuroticism"],
];
/** Big Five trait names in O C E A N order, in the current language. */
export const bigFiveNames = () => bigFive.map(([zh, en]) => t(zh, en));
const kinds = {
  named: ["具名角色", "Named character"],
  npc: ["无名角色", "Unnamed character"],
  doctor: ["博士", "The Doctor"],
};
export const kindName = (kind: AtlasNode["kind"]) =>
  t(kinds[kind][0], kinds[kind][1]);
/** The name to show: the English name in English mode when there is one. */
/**
 * Operators carry their own English name; other story characters take the
 * name the English script gives them (en.json), else stay in Chinese.
 */
export const nodeName = (n: Pick<AtlasNode, "name" | "en">) =>
  n.en ? t(n.name, n.en) : englishName(n.name);
/** The other-language name shown in small type, if it differs. */
export const altName = (n: Pick<AtlasNode, "name" | "en">) => {
  if (lang() === "zh") return n.en;
  return nodeName(n) === n.name ? "" : n.name;
};
/**
 * Community labels are written in Chinese by build_data.py ("凯尔希 等 9 人",
 * "其他 12 人"); English mode rebuilds them from the lead's English name.
 */
export function communityLabel(c: Community | undefined, nodes: AtlasNode[]) {
  if (!c) return "";
  const lead = /^(.+) 等 (\d+) 人$/.exec(c.label);
  if (lead) {
    const n = nodes.find((x) => x.name === lead[1]) ?? {
      name: lead[1],
      en: "",
    };
    return t(c.label, `${nodeName(n)} +${+lead[2] - 1}`);
  }
  const rest = /^其他 (\d+) 人$/.exec(c.label);
  return rest ? t(c.label, `Others (${rest[1]})`) : c.label;
}
export const communityColors = [
  "#d991a6",
  "#ddb780",
  "#8ec1b2",
  "#9eafda",
  "#cf9acb",
  "#d9886a",
  "#b7c48d",
  "#e0a98a",
  "#a3a0d8",
];
export const otherColor = "#8d8590";
export function communityColor(index: number, communities: Community[]) {
  const c = communities[index];
  if (!c || /^(其他 |Others \()/.test(c.label)) return otherColor;
  return communityColors[index % communityColors.length];
}
export function level(score: number | null) {
  if (score == null) return t("未评估", "not scored");
  return score >= 65
    ? t("高", "high")
    : score <= 34
      ? t("低", "low")
      : t("中等", "mid");
}
/** The direction with more confidence, used for single-value colouring. */
export function primary(edge: AtlasEdge): Direction {
  if (!edge.ab) return edge.ba!;
  if (!edge.ba) return edge.ab;
  return edge.ba.confidence > edge.ab.confidence ? edge.ba : edge.ab;
}
export function isMutual(edge: AtlasEdge) {
  return !!edge.ab && !!edge.ba;
}
/** Direction seen from `from` toward the other endpoint, if any. */
export function towards(edge: AtlasEdge, from: string) {
  return edge.source === from ? edge.ab : edge.ba;
}
export function degreeMap(links: AtlasEdge[]) {
  const map = new Map<string, number>();
  for (const e of links) {
    map.set(e.source, (map.get(e.source) || 0) + 1);
    map.set(e.target, (map.get(e.target) || 0) + 1);
  }
  return map;
}
export function neighborhood(center: string, links: AtlasEdge[], hops: number) {
  const adjacent = new Map<string, string[]>();
  for (const e of links) {
    adjacent.set(e.source, [...(adjacent.get(e.source) || []), e.target]);
    adjacent.set(e.target, [...(adjacent.get(e.target) || []), e.source]);
  }
  const result = new Set([center]);
  let frontier = [center];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const other of adjacent.get(id) || [])
        if (!result.has(other)) {
          result.add(other);
          next.push(other);
        }
    frontier = next;
  }
  return result;
}
/** Smallest message threshold that keeps at most `limit` people visible. */
export function defaultMinMessages(nodes: AtlasNode[], limit = 120) {
  if (nodes.length <= limit) return 0;
  const sorted = nodes.map((n) => n.messages).sort((a, b) => b - a);
  return sorted[limit - 1] + (sorted[limit - 1] === sorted[limit] ? 1 : 0);
}
