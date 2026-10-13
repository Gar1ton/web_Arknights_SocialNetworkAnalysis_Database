import { archives } from "./archives";
export type Route = { page: "home" | "archives" | "graph"; archiveId: string };
export function resolveRoute(hash: string): Route {
  if (hash === "#archives") return { page: "archives", archiveId: "all" };
  if (hash === "#atlas" || hash === "#studio")
    return { page: "graph", archiveId: "all" };
  if (hash.startsWith("#graph/")) {
    const id = hash.slice(7);
    return archives.some((a) => a.id === id)
      ? { page: "graph", archiveId: id }
      : { page: "archives", archiveId: "all" };
  }
  return { page: "home", archiveId: "all" };
}
