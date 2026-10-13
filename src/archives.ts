import { nodes, edges } from "./data";
export type Archive = {
  id: string;
  title: string;
  en: string;
  category: "总览" | "主线" | "Side Story" | "Intermezzi";
  code: string;
  description: string;
  color: string;
  factions: number[];
  bannerUrl?: string;
};
export const archives: Archive[] = [
  {
    id: "all",
    title: "泰拉，全景关系档案",
    en: "The complete constellation",
    category: "总览",
    code: "TERRA / ALL",
    description: "跨越章节的总表。让每一条关系，在同一片星空中交汇。",
    color: "#d3a6a0",
    factions: [0, 1, 2, 3, 4, 5],
  },
  {
    id: "dark-age",
    title: "黑暗时代",
    en: "The age of darkness",
    category: "主线",
    code: "EPISODE / 00",
    description: "故事的起点，与命运初次相交的轨迹。",
    color: "#b49baa",
    factions: [0, 5],
  },
  {
    id: "roaring-flare",
    title: "怒号光明",
    en: "Roaring flare",
    category: "主线",
    code: "EPISODE / 08",
    description: "从切尔诺伯格到龙门，观察社群之间的桥梁。",
    color: "#d2997e",
    factions: [0, 1, 5],
  },
  {
    id: "lone-trail",
    title: "孤星",
    en: "Lone trail",
    category: "Side Story",
    code: "SIDE STORY / 01",
    description: "向群星发问，也向彼此寻找答案。",
    color: "#a0bfbc",
    factions: [0, 2],
  },
  {
    id: "break-the-ice",
    title: "风雪过境",
    en: "Break the ice",
    category: "Side Story",
    code: "SIDE STORY / 02",
    description: "雪山之下，那些从未静止的关系。",
    color: "#a8b7d2",
    factions: [0, 3],
  },
  {
    id: "code-of-brawl",
    title: "喧闹法则",
    en: "Code of brawl",
    category: "Side Story",
    code: "SIDE STORY / 03",
    description: "城市的脉搏，藏在每一次不期而遇。",
    color: "#c69abd",
    factions: [1, 4],
  },
  {
    id: "darknights",
    title: "生于黑夜",
    en: "Darknights memoir",
    category: "Intermezzi",
    code: "INTERMEZZI / 01",
    description: "沿着往昔留下的线索，重访故事的另一侧。",
    color: "#b5a788",
    factions: [0, 4, 5],
  },
];
export function archiveGraph(id: string) {
  const archive = archives.find((a) => a.id === id) || archives[0];
  const subset = nodes.filter((n) => archive.factions.includes(n.faction));
  const ids = new Set(subset.map((n) => n.id));
  return {
    archive,
    nodes: subset,
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  };
}
export function searchArchives(query: string, category = "全部") {
  const q = query.trim().toLocaleLowerCase();
  return archives.filter(
    (a) =>
      (category === "全部" || a.category === category) &&
      [a.title, a.en, a.code, a.category]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
