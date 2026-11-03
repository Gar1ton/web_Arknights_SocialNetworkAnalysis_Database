import type { AtlasNode, AtlasEdge } from "./data";
export function gravityLeaders(
  nodes: AtlasNode[],
  edges: AtlasEdge[],
  count = 3,
) {
  const weights = new Map(nodes.map((n) => [n.id, 0]));
  for (const edge of edges) {
    if (!weights.has(edge.source) || !weights.has(edge.target)) continue;
    weights.set(edge.source, weights.get(edge.source)! + edge.weight);
    weights.set(edge.target, weights.get(edge.target)! + edge.weight);
  }
  const ranked = nodes
    .map((n) => ({ id: n.id, weight: weights.get(n.id)! }))
    .filter((n) => n.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.min(5, Math.round(count))));
  const max = ranked[0]?.weight || 1;
  return ranked.map((n) => ({ ...n, mass: 0.5 + n.weight / max }));
}
