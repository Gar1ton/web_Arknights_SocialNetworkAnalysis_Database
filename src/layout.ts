import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import {
  type AtlasNode,
  type AtlasEdge,
  degreeMap,
  neighborhood,
} from "./data";
import { type Settings } from "./settings";
export type Point = { x: number; y: number };
/** Circle order: community first, then most connected first. */
export function ringOrder(nodes: AtlasNode[], degrees: Map<string, number>) {
  return [...nodes].sort(
    (a, b) =>
      a.community - b.community ||
      (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0) ||
      a.id.localeCompare(b.id),
  );
}
/** Radius that leaves `gap` units of arc between neighbours on a ring. */
const ringRadius = (count: number, min: number, gap: number) =>
  Math.max(min, (count * gap) / (Math.PI * 2));
function medianNearest(points: Point[]) {
  if (points.length < 2) return 0;
  const nearest = points.map((p, i) => {
    let best = Infinity;
    points.forEach((q, j) => {
      if (i !== j) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
    });
    return best;
  });
  return nearest.sort((a, b) => a - b)[nearest.length >> 1];
}
/**
 * Positions in the 1000×760 scene, centred on (500, 380). Unless `compact`,
 * the network layout keeps a median neighbour spacing of about
 * 0.8 × s.distance, so larger graphs extend beyond the view and are panned or
 * zoomed instead of being squeezed into it.
 */
export function makeLayout(
  nodes: AtlasNode[],
  edges: AtlasEdge[],
  s: Settings,
  selected: string | null,
  compact = false,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (!nodes.length) return positions;
  const degrees = degreeMap(edges);
  if (s.mode === "ego" && selected) {
    const distances = neighborhood(selected, edges, 1);
    const rings = [
      ringOrder(
        nodes.filter((n) => n.id !== selected && distances.has(n.id)),
        degrees,
      ),
      ringOrder(
        nodes.filter((n) => !distances.has(n.id)),
        degrees,
      ),
    ];
    positions.set(selected, { x: 500, y: 380 });
    const inner = ringRadius(rings[0].length, s.hops === 2 ? 170 : 240, 30);
    const outer = ringRadius(rings[1].length, inner + 90, 30);
    rings.forEach((ring, r) =>
      ring.forEach((n, i) => {
        const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        const radius = r === 0 ? inner : outer;
        positions.set(n.id, {
          x: 500 + Math.cos(a) * radius,
          y: 380 + Math.sin(a) * radius,
        });
      }),
    );
    return positions;
  }
  if (s.layout === "circular" || s.mode === "chord") {
    const ordered = ringOrder(nodes, degrees);
    const radius = compact ? 300 : ringRadius(ordered.length, 300, 24);
    ordered.forEach((n, i) => {
      const a = (i / ordered.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(n.id, {
        x: 500 + Math.cos(a) * radius,
        y: 380 + Math.sin(a) * radius,
      });
    });
    return positions;
  }
  const groups = Math.max(1, ...nodes.map((n) => n.community + 1));
  const groupCenter = (f: number) =>
    groups === 1
      ? { x: 500, y: 380 }
      : {
          x: 500 + Math.cos((f / groups) * Math.PI * 2 - 1.9) * 240,
          y: 380 + Math.sin((f / groups) * Math.PI * 2 - 1.9) * 235,
        };
  const crowd = Math.min(1, 60 / nodes.length);
  // Landing keeps the original tight clustering; the workbench spreads out.
  const pull = (s.layout === "organic" ? 0.22 : 0.08) * (compact ? 1 : 0.45);
  const points: (SimulationNodeDatum & { id: string; community: number })[] =
    nodes.map((n, i) => {
      const c = groupCenter(n.community),
        angle = i * 2.399;
      return {
        id: n.id,
        community: n.community,
        x: c.x + Math.cos(angle) * 60,
        y: c.y + Math.sin(angle) * 60,
      };
    });
  const links = edges.map((e) => ({
    source: e.source,
    target: e.target,
    weight:
      s.weight === "affinity"
        ? e.weight
        : s.weight === "messages"
          ? Math.min(1, Math.sqrt(e.events) / 6)
          : 0.5,
  }));
  const sim = forceSimulation(points)
    .randomSource(() => 0.42)
    .force("charge", forceManyBody().strength(-s.repulsion))
    .force(
      "link",
      forceLink(links)
        .id((n) => (n as (typeof points)[number]).id)
        .distance(s.distance)
        .strength((l) => 0.1 + l.weight * 0.25),
    )
    .force(
      "x",
      forceX<(typeof points)[number]>((n) =>
        s.layout === "organic" ? groupCenter(n.community).x : 500,
      ).strength(s.gravity * pull),
    )
    .force(
      "y",
      forceY<(typeof points)[number]>((n) =>
        s.layout === "organic" ? groupCenter(n.community).y : 380,
      ).strength(s.gravity * pull),
    )
    .force(
      "collide",
      forceCollide<(typeof points)[number]>().radius((n) =>
        s.overlap
          ? (12 + 10 * crowd + Math.sqrt(degrees.get(n.id) || 0) * 2.2) *
            (0.6 + 0.4 * crowd)
          : 1,
      ),
    )
    .stop();
  sim.tick(230);
  const xs = points.map((p) => p.x!),
    ys = points.map((p) => p.y!);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const fit = Math.min(
    720 / Math.max(1, maxX - minX),
    560 / Math.max(1, maxY - minY),
    1.8,
  );
  const spread = compact
    ? 0
    : Math.min(
        6,
        (s.distance * 0.8) / Math.max(1, medianNearest(points as Point[])),
      );
  const scale = Math.max(fit, spread);
  points.forEach((p) =>
    positions.set(p.id, {
      x: 500 + (p.x! - (minX + maxX) / 2) * scale,
      y: 380 + (p.y! - (minY + maxY) / 2) * scale,
    }),
  );
  return positions;
}
export function curve(a: Point, b: Point, index: number, chord = false) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const bend = (index % 2 ? 1 : -1) * 0.14;
  return {
    c: chord
      ? { x: 500, y: 380 }
      : { x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend },
    path: chord
      ? `M${a.x},${a.y} Q500,380 ${b.x},${b.y}`
      : `M${a.x},${a.y} Q${(a.x + b.x) / 2 - dy * bend},${(a.y + b.y) / 2 + dx * bend} ${b.x},${b.y}`,
  };
}
