import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import { type AtlasNode, type AtlasEdge, degree, neighborhood } from "./data";
import { type Settings } from "./settings";
export type Point = { x: number; y: number };
export function makeLayout(
  nodes: AtlasNode[],
  edges: AtlasEdge[],
  s: Settings,
  selected: string | null,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  if (!nodes.length) return positions;
  if (s.mode === "ego" && selected) {
    const distances = neighborhood(selected, edges, 1);
    const rings = [
      nodes.filter((n) => n.id !== selected && distances.has(n.id)),
      nodes.filter((n) => !distances.has(n.id)),
    ];
    positions.set(selected, { x: 500, y: 380 });
    rings.forEach((ring, r) =>
      ring.forEach((n, i) => {
        const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
        const radius = r === 0 ? (s.hops === 2 ? 170 : 240) : 300;
        positions.set(n.id, {
          x: 500 + Math.cos(a) * radius,
          y: 380 + Math.sin(a) * radius,
        });
      }),
    );
    return positions;
  }
  if (s.layout === "circular" || s.mode === "chord") {
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      positions.set(n.id, {
        x: 500 + Math.cos(a) * 300,
        y: 380 + Math.sin(a) * 300,
      });
    });
    return positions;
  }
  const groupCenter = (f: number) => ({
    x: 500 + Math.cos((f / 6) * Math.PI * 2 - 1.9) * 240,
    y: 380 + Math.sin((f / 6) * Math.PI * 2 - 1.9) * 235,
  });
  const points: (SimulationNodeDatum & { id: string; faction: number })[] =
    nodes.map((n, i) => {
      const c = groupCenter(n.faction),
        angle = i * 2.399;
      return {
        id: n.id,
        faction: n.faction,
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
          ? e.messages / 350
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
        s.layout === "organic" ? groupCenter(n.faction).x : 500,
      ).strength(s.gravity * (s.layout === "organic" ? 0.22 : 0.08)),
    )
    .force(
      "y",
      forceY<(typeof points)[number]>((n) =>
        s.layout === "organic" ? groupCenter(n.faction).y : 380,
      ).strength(s.gravity * (s.layout === "organic" ? 0.22 : 0.08)),
    )
    .force(
      "collide",
      forceCollide<(typeof points)[number]>().radius((n) =>
        s.overlap ? 22 + degree(n.id, edges) * 0.35 : 1,
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
  const scale = Math.min(
    720 / Math.max(1, maxX - minX),
    560 / Math.max(1, maxY - minY),
    1.8,
  );
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
