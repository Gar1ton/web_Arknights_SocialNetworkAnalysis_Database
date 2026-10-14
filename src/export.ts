import { type Settings, palettes } from "./settings";
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const note =
  "Arknights SNA v2 · IPC 与大五人格数值由大模型根据剧情对话推断，非官方设定";
/** Exports the visible network as an SVG image (the only export format). */
export function exportGraph(
  settings: Settings,
  archive: { id: string; title: string },
) {
  const stem = "arknights-sna-" + (archive.id || "graph");
  const original = document.getElementById("network-svg");
  const scene = original?.querySelector<SVGGElement>(":scope > g");
  if (!original || !scene) throw Error("未找到关系图");
  // Frame every visible node, not just the part currently on screen.
  const box = scene.getBBox();
  const pad = 40;
  const x = box.x - pad,
    y = box.y - pad,
    w = box.width + pad * 2,
    h = box.height + pad * 2 + 30;
  const copy = original.cloneNode(true) as SVGSVGElement;
  copy.querySelector(":scope > g")!.removeAttribute("transform");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  copy.setAttribute("width", String(Math.round(Math.max(1600, w * 1.6))));
  copy.setAttribute(
    "height",
    String(Math.round(Math.max(1600, w * 1.6) * (h / w))),
  );
  copy.style.background = palettes[settings.palette].bg;
  const svg = "http://www.w3.org/2000/svg";
  const background = document.createElementNS(svg, "rect");
  background.setAttribute("x", String(x));
  background.setAttribute("y", String(y));
  background.setAttribute("width", String(w));
  background.setAttribute("height", String(h));
  background.setAttribute("fill", palettes[settings.palette].bg);
  copy.prepend(background);
  copy.querySelectorAll("animateMotion,.edge-hit").forEach((el) => el.remove());
  copy
    .querySelectorAll("[tabindex]")
    .forEach((el) => el.removeAttribute("tabindex"));
  const title = document.createElementNS(svg, "text");
  title.setAttribute("x", String(x + 30));
  title.setAttribute("y", String(y + h - 20));
  title.setAttribute("fill", "#dcb99b");
  title.setAttribute("font-size", "12");
  title.textContent = (archive.title || "关系图谱") + " · " + note;
  copy.append(title);
  download(
    stem + ".svg",
    new XMLSerializer().serializeToString(copy),
    "image/svg+xml",
  );
}
