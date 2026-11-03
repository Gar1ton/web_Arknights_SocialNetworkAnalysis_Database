export type Route =
  | { page: "home" }
  | { page: "story"; id: string | null; pair?: [number, number] }
  | { page: "person"; p: number | null; other?: number };
/** Opened by #atlas / #studio and the old graph links: 主线 第8章 怒号光明. */
export const defaultStory = "main-08";
const ID = /^[a-z]+-[0-9a-z]+$/;
export function resolveRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const [head, a, b] = parts;
  if (head === "archives") return { page: "story", id: null };
  if (head === "atlas" || head === "studio") return { page: "story", id: defaultStory };
  if (head === "graph" || head === "story") {
    if (!a || !ID.test(a)) return { page: "story", id: null };
    const pair = /^(\d+)-(\d+)$/.exec(b ?? "");
    return pair ? { page: "story", id: a, pair: [+pair[1], +pair[2]] } : { page: "story", id: a };
  }
  if (head === "person" || head === "people") {
    const p = /^\d+$/.test(a ?? "") ? +a : null;
    const other = /^\d+$/.test(b ?? "") ? +b : undefined;
    return other === undefined ? { page: "person", p } : { page: "person", p, other };
  }
  return { page: "home" };
}
export function hashFor(route: Route): string {
  if (route.page === "home") return "#/";
  if (route.page === "story")
    return route.id ? `#story/${route.id}${route.pair ? `/${route.pair[0]}-${route.pair[1]}` : ""}` : "#story";
  return route.p === null ? "#person" : `#person/${route.p}${route.other !== undefined ? `/${route.other}` : ""}`;
}
