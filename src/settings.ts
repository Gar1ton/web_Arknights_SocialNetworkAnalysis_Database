export type Settings = {
  layout: "organic" | "force" | "circular";
  mode: "network" | "ego" | "chord";
  hops: number;
  palette: "dusk" | "glacier" | "ember" | "mono";
  particles: number;
  speed: number;
  turbulence: number;
  opacity: number;
  width: number;
  labels: boolean;
  arrows: boolean;
  edgeLabels: boolean;
  gravity: number;
  repulsion: number;
  distance: number;
  overlap: boolean;
  locked: boolean;
  weight: "affinity" | "messages" | "equal";
  coloring: "faction" | "affect" | "power";
  minMessages: number;
  minWeight: number;
  animate: boolean;
  nodeSize: number;
};
export const defaults: Settings = {
  layout: "organic",
  mode: "network",
  hops: 1,
  palette: "dusk",
  particles: 1600,
  speed: 0.65,
  turbulence: 1.2,
  opacity: 0.35,
  width: 1,
  labels: true,
  arrows: false,
  edgeLabels: false,
  gravity: 0.6,
  repulsion: 190,
  distance: 90,
  overlap: true,
  locked: false,
  weight: "affinity",
  coloring: "faction",
  minMessages: 0,
  minWeight: 0,
  animate: true,
  nodeSize: 1,
};
export const palettes = {
  dusk: {
    name: "暮色",
    en: "Kyoto dusk",
    colors: ["#df96a7", "#dcb27b", "#9b86b4", "#ba746f"],
    bg: "#141216",
  },
  glacier: {
    name: "冰川",
    en: "Glacier",
    colors: ["#81c9cb", "#92b0db", "#c6decf", "#648baf"],
    bg: "#10191f",
  },
  ember: {
    name: "余烬",
    en: "Ember",
    colors: ["#ed986b", "#d36851", "#d8b078", "#ac6461"],
    bg: "#1c1412",
  },
  mono: {
    name: "月白",
    en: "Moonlight",
    colors: ["#d9d1c4", "#a6a1ad", "#b9b8bd", "#807b86"],
    bg: "#151518",
  },
};
export function parseSettings(raw: unknown): Settings {
  const out = { ...defaults };
  if (!raw || typeof raw !== "object") return out;
  const enums: Record<string, string[]> = {
    layout: ["organic", "force", "circular"],
    mode: ["network", "ego", "chord"],
    palette: Object.keys(palettes),
    weight: ["affinity", "messages", "equal"],
    coloring: ["faction", "affect", "power"],
  };
  const ranges: Record<string, [number, number]> = {
    hops: [1, 2],
    particles: [0, 3000],
    speed: [0.1, 2],
    turbulence: [0.2, 3],
    opacity: [0.05, 1],
    width: [0.4, 3],
    gravity: [0.1, 2],
    repulsion: [50, 500],
    distance: [30, 180],
    minMessages: [0, 1300],
    minWeight: [0, 1],
    nodeSize: [0.6, 1.8],
  };
  const target = out as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in defaults)) continue;
    if (enums[key] && typeof value === "string" && enums[key].includes(value))
      target[key] = value;
    else if (ranges[key] && typeof value === "number" && Number.isFinite(value))
      target[key] = Math.min(ranges[key][1], Math.max(ranges[key][0], value));
    else if (
      typeof defaults[key as keyof Settings] === "boolean" &&
      typeof value === "boolean"
    )
      target[key] = value;
  }
  out.hops = Math.round(out.hops);
  out.particles = Math.round(out.particles);
  return out;
}
export function readSettings(): Settings {
  try {
    return parseSettings(
      JSON.parse(localStorage.getItem("terra:settings:v1") || "null"),
    );
  } catch {
    return { ...defaults };
  }
}
