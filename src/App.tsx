import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { BookOpen, Network, UsersRound } from "lucide-react";
import { dataVersion, type Archive } from "./archives";
import { t } from "./i18n";
import { useLang } from "./useLang";
import LangSwitch from "./LangSwitch";
import { hashFor, resolveRoute, type Route } from "./routes";
import { useCore } from "./model/load";
import { keeper, type IndexedStory } from "./model/model";
import { OBS, SUB, type StoryMeta } from "./model/types";
import { edgeId, nodeId, reportData } from "./model/reportAdapter";
import Overview from "./views/Overview";
import StoryView, { type Selection } from "./views/StoryView";
import PersonView from "./views/PersonView";
import { TipLayer } from "./ui/tip";
import ReportDialog from "./report/ReportDialog";
import type { ReportTarget } from "./report/report";

const namedKey = "terra:named";
const savedNamed = () => {
  try {
    return localStorage.getItem(namedKey) !== "0";
  } catch {
    return true;
  }
};

export default function App() {
  useLang();
  const core = useCore();
  const [route, setRoute] = useState<Route>(() => resolveRoute(location.hash));
  const [named, setNamed] = useState(savedNamed);
  const [report, setReport] = useState<{ s: IndexedStory; pos: number; origin: ReportTarget } | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    const sync = () => setRoute(resolveRoute(location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const go = useCallback((next: Route) => {
    const hash = hashFor(next);
    if (location.hash !== hash) location.hash = hash;
    setRoute(next);
    window.scrollTo({ top: 0 });
  }, []);
  const data = core.data;
  const keep = useMemo(() => (data ? keeper(data.people, named) : () => true), [data, named]);
  const relations = useMemo(() => {
    if (!data) return new Map<string, number>();
    const n = new Map<string, number>();
    for (const f of data.overview.finals) if (keep(f[OBS], f[SUB])) {
      const id = data.manifest.stories[f[0]].id;
      n.set(id, (n.get(id) ?? 0) + 1);
    }
    return n;
  }, [data, keep]);
  const relationsOf = useCallback((s: StoryMeta) => relations.get(s.id) ?? 0, [relations]);
  const openStory = useCallback((id: string, pair?: [number, number]) => go(pair ? { page: "story", id, pair } : { page: "story", id }), [go]);
  const openPerson = useCallback((p: number, other?: number) => go(other === undefined ? { page: "person", p } : { page: "person", p, other }), [go]);
  const toggleNamed = (on: boolean) => {
    setNamed(on);
    try {
      localStorage.setItem(namedKey, on ? "1" : "0");
    } catch {}
  };

  const tabs: [Route["page"], string, ReactElement][] = [
    ["home", t("总览", "Overview"), <BookOpen key="h" size={15} />],
    ["story", t("故事", "Stories"), <Network key="s" size={15} />],
    ["person", t("人物", "Characters"), <UsersRound key="p" size={15} />],
  ];
  const latest = data?.manifest.stories.find((s) => s.new === "new") ?? data?.manifest.stories[0];
  let page = null;
  if (data) {
    if (route.page === "home")
      page = <Overview core={data} named={named} keep={keep} openStory={(id) => openStory(id)} openPerson={(p) => openPerson(p)} />;
    else if (route.page === "story")
      page = (
        <StoryView core={data} named={named} keep={keep} storyId={route.id ?? latest!.id} pair={route.pair}
          openStory={(id) => openStory(id)} openPerson={openPerson} relationsOf={relationsOf}
          report={(s, pos, sel: Selection) => setReport({ s, pos, origin: originOf(sel) })} />
      );
    else page = <PersonView core={data} named={named} keep={keep} who={route.p} other={route.other ?? null} openPerson={openPerson} openStory={openStory} />;
  }
  const archive: Archive | null = report ? report.s.meta : null;
  const reportTables = useMemo(() => (report && data ? reportData(data, report.s, report.pos, keep) : null), [report, data, keep]);
  return (
    <div className={"app page-" + route.page}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => go({ page: "home" })}>
          <svg viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
            <circle cx="9" cy="10" r="4" /><circle cx="23" cy="9" r="3" /><circle cx="17" cy="23" r="5" />
            <path d="M9 10 L23 9 M9 10 L17 23 M23 9 L17 23" />
          </svg>
          <span>{t("方舟关系图谱", "Arknights SNA")}</span>
        </button>
        <nav className="tabs main-tabs" aria-label={t("页面", "Pages")}>
          {tabs.map(([k, label, icon]) => (
            <button key={k} type="button" aria-current={route.page === k}
              onClick={() => go(k === "home" ? { page: "home" } : k === "story" ? { page: "story", id: route.page === "story" ? route.id : null } : { page: "person", p: route.page === "person" ? route.p : null })}>
              {icon}{label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          {data && <span className="version">{dataVersion(data.manifest.info.version)}</span>}
          <label className="switch">
            <input type="checkbox" checked={named} onChange={(e) => toggleNamed(e.target.checked)} />
            <span>{t("只看具名角色", "Named only")}</span>
          </label>
          <LangSwitch />
        </div>
      </header>
      <main className="main">
        {core.error ? (
          <p className="state">{t("数据没能载入，请刷新重试。", "The data did not load; try reloading.")}</p>
        ) : data ? page : (
          <p className="state">{t("载入中…", "Loading…")}</p>
        )}
      </main>
      <TipLayer />
      {report && archive && reportTables && data && (
        <ReportDialog origin={report.origin} archive={archive} dataVersion={data.manifest.info.version}
          data={reportTables} byId={new Map(reportTables.nodes.map((n) => [n.id, n]))}
          onClose={(kept) => {
            setReport(null);
            if (kept) setToast(t("草稿已保留，再次打开纠错面板即可继续", "Draft kept. Reopen the report panel to continue"));
          }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function originOf(sel: Selection): ReportTarget {
  if (sel?.kind === "node") return { kind: "node", nodeId: nodeId(sel.u) };
  if (sel?.kind === "pair") return { kind: "edge", edgeId: edgeId(sel.o, sel.t) };
  return { kind: "none" };
}
