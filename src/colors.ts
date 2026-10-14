import {
  type AtlasEdge,
  type Community,
  communityColor,
  octants,
  otherColor,
  primary,
} from "./data";
import { type Settings, palettes } from "./settings";
export function nodeColor(
  community: number,
  communities: Community[],
  palette: Settings["palette"],
) {
  const color = communityColor(community, communities);
  if (palette === "dusk" || color === otherColor) return color;
  return palettes[palette].colors[community % 4];
}
const neutral = "#b9adaf";
export const scaleColors = {
  affect: ["#e18d9c", neutral, "#94c4b2"],
  power: ["#92b0db", neutral, "#ddb780"],
};
export function edgeColor(
  edge: AtlasEdge,
  coloring: Settings["coloring"],
  sourceColor: string,
) {
  if (coloring === "community") return sourceColor;
  const d = primary(edge);
  if (coloring === "type") return octants[d.type].color;
  const value = coloring === "affect" ? d.benevolence : d.power;
  const [low, mid, high] = scaleColors[coloring];
  return value > 0.15 ? high : value < -0.15 ? low : mid;
}
