import { type AtlasNode, type AtlasEdge } from "./data";
import { type Settings, palettes } from "./settings";
export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function exportGraph(
  type: "svg" | "json" | "csv",
  nodes: AtlasNode[],
  edges: AtlasEdge[],
  settings: Settings,
  archive?: { id: string; title: string },
) {
  if (type === "json") {
    download(
      "terra-demo-network.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          archive,
          source: "illustrative-demo-not-analysis",
          nodes,
          edges,
          settings,
        },
        null,
        2,
      ),
      "application/json",
    );
    return;
  }
  if (type === "csv") {
    const cell = (s: unknown) => '"' + String(s).replaceAll('"', '""') + '"';
    download(
      "terra-demo-relationships.csv",
      "\ufeff" +
        [
          [
            "source",
            "target",
            "type",
            "strength",
            "messages",
            "affect",
            "power",
            "mutual",
            "provenance",
            "archive",
          ],
          ...edges.map((e) => [
            e.source,
            e.target,
            e.label,
            e.weight,
            e.messages,
            e.affect,
            e.power,
            e.mutual,
            "illustrative-demo",
            archive?.id || "all",
          ]),
        ]
          .map((r) => r.map(cell).join(","))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
    return;
  }
  const original = document.getElementById("network-svg");
  if (!original) throw Error("未找到星图");
  const copy = original.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1600");
  copy.setAttribute("height", "1216");
  copy.style.background = palettes[settings.palette].bg;
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  background.setAttribute("width", "1000");
  background.setAttribute("height", "760");
  background.setAttribute("fill", palettes[settings.palette].bg);
  copy.prepend(background);
  copy.querySelectorAll("animateMotion,.edge-hit").forEach((el) => el.remove());
  copy
    .querySelectorAll("[tabindex]")
    .forEach((el) => el.removeAttribute("tabindex"));
  const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
  title.setAttribute("x", "30");
  title.setAttribute("y", "735");
  title.setAttribute("fill", "#dcb99b");
  title.setAttribute("font-size", "11");
  title.textContent =
    "TERRA / " +
    (archive?.title || "RELATION ATLAS") +
    " · ILLUSTRATIVE DEMO DATA";
  copy.append(title);
  download(
    "terra-demo-atlas.svg",
    new XMLSerializer().serializeToString(copy),
    "image/svg+xml",
  );
}
