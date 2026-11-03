export type Route =
  | { page: "home" }
  | { page: "archives" }
  | { page: "people" }
  | { page: "person"; p: number; other?: number }
  | {
      page: "graph";
      archiveId: string;
      /** A character or a pair to select on opening. */
      focus?: number;
      pair?: [number, number];
    };
/** Opened by #atlas / #studio: 主线 第8章 怒号光明. */
export const defaultArchive = "main-08";
const ID = /^[a-z]+-[0-9a-z]+$/;
/**
 * #archives, #people, #person/12[/34], #graph/<story>[/12 | /12-34]. The old
 * #graph/<story> links keep working; #story/… is read as #graph/….
 */
export function resolveRoute(hash: string): Route {
  const [head, a, b] = hash
    .replace(/^#\/?/, "")
    .split("/")
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return "";
      }
    });
  if (head === "archives") return { page: "archives" };
  if (head === "people") return { page: "people" };
  if (head === "atlas" || head === "studio")
    return { page: "graph", archiveId: defaultArchive };
  if (head === "graph" || head === "story") {
    if (!a || !ID.test(a)) return { page: "archives" };
    const pair = /^(\d+)-(\d+)$/.exec(b ?? "");
    if (pair) return { page: "graph", archiveId: a, pair: [+pair[1], +pair[2]] };
    if (/^\d+$/.test(b ?? "")) return { page: "graph", archiveId: a, focus: +b };
    return { page: "graph", archiveId: a };
  }
  if (head === "person") {
    if (!/^\d+$/.test(a ?? "")) return { page: "people" };
    return /^\d+$/.test(b ?? "")
      ? { page: "person", p: +a, other: +b }
      : { page: "person", p: +a };
  }
  return { page: "home" };
}
export const storyHash = (id: string, focus?: number | [number, number]) =>
  "#graph/" +
  id +
  (focus === undefined ? "" : "/" + (Array.isArray(focus) ? focus.join("-") : focus));
export const personHash = (p: number, other?: number) =>
  "#person/" + p + (other === undefined ? "" : "/" + other);
