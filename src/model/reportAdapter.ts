import type { ArchiveData, AtlasEdge, AtlasNode, Direction } from "../data";
import { octantKeys } from "../data";
import type { Core } from "./load";
import { edgesAt, personaAt, toQueue, type IndexedStory, type Keep } from "./model";
import { BEN, INT, POW, TYPE, type StateRow } from "./types";
/**
 * The report panel was written for the previous per-story tables (nodes and unordered edges); this builds them from a
 * story at one position, so a report names exactly what was on screen. Node ids are "p<person>".
 */
export const nodeId = (p: number) => `p${p}`;
export const edgeId = (a: number, b: number) => (a < b ? `p${a}-p${b}` : `p${b}-p${a}`);
const KIND: AtlasNode["kind"][] = ["named", "named", "doctor", "npc"];
const direction = (r: StateRow): Direction => ({
  type: octantKeys[r[TYPE]],
  benevolence: r[BEN],
  power: r[POW],
  intensity: r[INT],
  confidence: 0,
  evidence: 0,
});
export function reportData(core: Core, s: IndexedStory, pos: number, keep: Keep): ArchiveData {
  const seq = toQueue(s.data.segs, pos);
  const nodes: AtlasNode[] = s.data.who.map(([p, messages]) => {
    const [name, en, scope] = core.people.people[p];
    const persona = core.people.persona[String(p)];
    const v = personaAt(persona, seq) ?? [null, null, null, null, null];
    return {
      id: nodeId(p), name, en, kind: KIND[scope], messages, community: 0, degree: 0, outDegree: 0, inDegree: 0,
      betweenness: 0,
      profile: {
        description: persona?.d ?? "",
        bigFive: v.map((x) => (x == null ? null : Math.round(((x + 1) / 2) * 100))),
        evidence: [null, null, null, null, null],
        confidence: 0,
      },
    };
  });
  const pairs = new Map<string, AtlasEdge>();
  for (const e of edgesAt(s, pos, keep)) {
    const [a, b] = e.o < e.t ? [e.o, e.t] : [e.t, e.o];
    const id = edgeId(a, b);
    const edge = pairs.get(id) ?? { id, source: nodeId(a), target: nodeId(b), events: 0, weight: 0, ab: null, ba: null };
    if (e.o === a) edge.ab = direction(e.r);
    else edge.ba = direction(e.r);
    pairs.set(id, edge);
  }
  return {
    id: s.meta.id,
    communities: [],
    stats: {
      nodes: nodes.length, pairs: pairs.size, relations: 0, mutual: 0, density: 0, reciprocity: 0, avgDegree: 0,
      octants: { affinity: 0, active: 0, dominant: 0, arrogant: 0, cold: 0, withdrawn: 0, submissive: 0, deferential: 0 },
      avgBenevolence: 0, avgPower: 0,
    },
    nodes,
    edges: [...pairs.values()],
  };
}
