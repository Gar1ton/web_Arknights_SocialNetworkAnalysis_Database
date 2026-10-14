export type Route = { page: "home" | "archives" | "graph"; archiveId: string };
/** Opened by #atlas / #studio: 主线 第8章 怒号光明. */
export const defaultArchive = "main-08";
export function resolveRoute(hash: string): Route {
  if (hash === "#archives")
    return { page: "archives", archiveId: defaultArchive };
  if (hash === "#atlas" || hash === "#studio")
    return { page: "graph", archiveId: defaultArchive };
  if (hash.startsWith("#graph/")) {
    const id = decodeURIComponent(hash.slice(7));
    return /^[a-z0-9-]+$/.test(id)
      ? { page: "graph", archiveId: id }
      : { page: "archives", archiveId: defaultArchive };
  }
  return { page: "home", archiveId: defaultArchive };
}
