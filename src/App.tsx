import Select from "./Select";
import { useState, useEffect, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  Search,
  X,
  Orbit,
  SlidersHorizontal,
  Network,
  Focus,
  AudioLines,
  Download,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Flag,
} from "lucide-react";
import {
  type ArchiveData,
  altName,
  communityLabel,
  defaultMinMessages,
  neighborhood,
  nodeName,
  octantKeys,
  octantName,
  octants,
} from "./data";
import { locale, plural, t } from "./i18n";
import { useLang } from "./useLang";
import LangSwitch from "./LangSwitch";
import { nodeColor, scaleColors } from "./colors";
import {
  defaults,
  readSettings,
  storageKey,
  type Settings,
  palettes,
} from "./settings";
import { archiveCode, archiveTitle, useArchive, useManifest } from "./archives";
import { resolveRoute } from "./routes";
import Landing from "./Landing";
import Library from "./Library";
import Graph from "./Graph";
import Controls from "./Controls";
import { NodeDetail, EdgeDetail } from "./Details";
import { exportGraph } from "./export";
import ReportDialog from "./report/ReportDialog";
import type { ReportTarget } from "./report/report";
const empty: ArchiveData = {
  id: "",
  communities: [],
  stats: {
    nodes: 0,
    pairs: 0,
    relations: 0,
    mutual: 0,
    density: 0,
    reciprocity: 0,
    avgDegree: 0,
    octants: Object.fromEntries(octantKeys.map((k) => [k, 0])) as never,
    avgBenevolence: 0,
    avgPower: 0,
  },
  nodes: [],
  edges: [],
};
export default function App() {
  const language = useLang();
  const [route, setRoute] = useState(() => resolveRoute(location.hash));
  const [settings, setSettings] = useState<Settings>(() => {
    const s = readSettings();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      s.animate = false;
    return s;
  });
  const [panelTab, setPanelTab] = useState<"nodes" | "settings">(
    location.hash === "#studio" ? "settings" : "nodes",
  );
  const [selected, setSelected] = useState<string | null>(null),
    [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [community, setCommunity] = useState(-1),
    [sort, setSort] = useState("degree"),
    [panelOpen, setPanelOpen] = useState(true),
    [resetKey, setResetKey] = useState(0),
    [toast, setToast] = useState("");
  const [report, setReport] = useState<ReportTarget | null>(null);
  const manifest = useManifest();
  const loaded = useArchive(route.page === "graph" ? route.archiveId : null);
  const archive = manifest.data?.archives.find((a) => a.id === route.archiveId);
  const dataset = loaded.data || empty;
  const communities = useMemo(
    () =>
      dataset.communities.map((c) => ({
        ...c,
        label: communityLabel(c, dataset.nodes),
      })),
    [dataset, language],
  );
  const byId = useMemo(
    () => new Map(dataset.nodes.map((n) => [n.id, n])),
    [dataset],
  );
  const maxMessages = useMemo(
    () => Math.max(10, ...dataset.nodes.map((n) => n.messages)),
    [dataset],
  );
  useEffect(() => {
    if (route.page === "graph" && manifest.data && !archive)
      location.hash = "archives";
  }, [route, manifest.data, archive]);
  useEffect(() => {
    const cb = () => {
      const next = resolveRoute(location.hash);
      const change = () => {
        flushSync(() => {
          setRoute(next);
          setSelected(null);
          setSelectedEdge(null);
          setPanelOpen(true);
          setReport(null);
        });
        window.scrollTo({ top: 0, behavior: "instant" });
      };
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };
      if (
        doc.startViewTransition &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        doc.startViewTransition(change);
      else change();
    };
    addEventListener("hashchange", cb);
    return () => removeEventListener("hashchange", cb);
  }, []);
  useEffect(() => {
    setSelected(null);
    setSelectedEdge(null);
    setReport(null);
    setQuery("");
    setCommunity(-1);
    setPanelTab("nodes");
    setSettings((s) => ({
      ...s,
      mode: "network",
      minMessages: defaultMinMessages(dataset.nodes),
      minWeight: 0,
      locked: false,
    }));
    setResetKey((k) => k + 1);
  }, [dataset]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {}
    document.documentElement.style.setProperty(
      "--bg",
      palettes[settings.palette].bg,
    );
  }, [settings]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    [],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // The report dialog handles its own keys.
      if ((e.target as HTMLElement).closest("dialog")) return;
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          'input,select,textarea,button,a,[role="button"],summary',
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setSettings((s) => ({ ...s, animate: !s.animate }));
      }
      if (e.key === "r" || e.key === "R") setResetKey((k) => k + 1);
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, []);
  const baseNodes = useMemo(
    () =>
      dataset.nodes.filter(
        (n) =>
          (community < 0 || n.community === community) &&
          n.messages >= settings.minMessages,
      ),
    [dataset, community, settings.minMessages],
  );
  const hiddenByMessages = useMemo(
    () =>
      dataset.nodes.filter(
        (n) =>
          (community < 0 || n.community === community) &&
          n.messages < settings.minMessages,
      ).length,
    [dataset, community, settings.minMessages],
  );
  const baseEdges = useMemo(() => {
    const ids = new Set(baseNodes.map((n) => n.id));
    return dataset.edges.filter(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        e.weight >= settings.minWeight,
    );
  }, [dataset, baseNodes, settings.minWeight]);
  const egoCenter =
    selected ||
    [...baseNodes].sort((a, b) => b.degree - a.degree)[0]?.id ||
    null;
  const visibleNodes = useMemo(() => {
    if (settings.mode !== "ego" || !egoCenter) return baseNodes;
    const ids = neighborhood(egoCenter, baseEdges, settings.hops);
    return baseNodes.filter((n) => ids.has(n.id));
  }, [baseNodes, baseEdges, settings.mode, settings.hops, egoCenter]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id));
    return baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [visibleNodes, baseEdges]);
  const list = useMemo(
    () =>
      baseNodes
        .filter((n) =>
          (n.name + " " + n.en)
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) =>
          sort === "degree"
            ? b.degree - a.degree || b.messages - a.messages
            : sort === "messages"
              ? b.messages - a.messages
              : sort === "betweenness"
                ? b.betweenness - a.betweenness
                : nodeName(a).localeCompare(nodeName(b), locale()),
        ),
    [baseNodes, query, sort, language],
  );
  const choose = (id: string) => {
    const n = byId.get(id);
    if (!n) return;
    if (community >= 0 && n.community !== community) setCommunity(-1);
    if (n.messages < settings.minMessages) update("minMessages", n.messages);
    setSelected(id);
    setSelectedEdge(null);
    setPanelOpen(true);
    setPanelTab("nodes");
  };
  const chooseEdge = (id: string) => {
    setSelectedEdge(id);
    setSelected(dataset.edges.find((e) => e.id === id)?.source || null);
    setPanelOpen(true);
    setPanelTab("nodes");
  };
  const clearDetails = () => {
    setSelected(null);
    setSelectedEdge(null);
  };
  const resetFilters = () => {
    setCommunity(-1);
    setQuery("");
    setSettings((s) => ({
      ...s,
      minMessages: 0,
      minWeight: 0,
      mode: "network",
    }));
    clearDetails();
  };
  const doExport = () => {
    try {
      exportGraph(settings, {
        id: archive?.id || "",
        title: archive ? archiveTitle(archive) : "",
      });
      setToast(t("已导出 SVG 图片", "SVG image exported"));
    } catch {
      setToast(
        t(
          "导出未完成，请重新打开图谱后重试",
          "Export failed. Reopen the graph and try again",
        ),
      );
    }
  };
  const setMode = (mode: Settings["mode"]) => {
    if (mode === "ego" && !selected) setSelected(egoCenter);
    update("mode", mode);
    setSelectedEdge(null);
  };
  const stats = dataset.stats;
  const octantTotal = octantKeys.reduce((s, k) => s + stats.octants[k], 0);
  const legend =
    settings.coloring === "type"
      ? octantKeys.map((k) => [octantName(k), octants[k].color])
      : settings.coloring === "affect"
        ? [
            t("敌对", "Hostile"),
            t("中性", "Neutral"),
            t("友善", "Friendly"),
          ].map((l, i) => [l, scaleColors.affect[i]])
        : settings.coloring === "power"
          ? [
              t("顺从", "Submissive"),
              t("中性", "Neutral"),
              t("主导", "Dominant"),
            ].map((l, i) => [l, scaleColors.power[i]])
          : null;
  const title = archive
    ? archiveTitle(archive)
    : t("关系图谱", "Relation graph");
  const code = archive ? archiveCode(archive) : "";
  const relationCount = (nodes: number, pairs: number) =>
    t(
      `${nodes} 名角色 · ${pairs} 组关系`,
      `${plural("character", nodes)} · ${plural("relation", pairs)}`,
    );
  const dataVersion =
    manifest.data?.info.sources?.fullgraph?.runId ||
    manifest.data?.info.version ||
    "";
  return (
    <div
      className={
        "app " +
        (route.page === "graph"
          ? "workspace workbench"
          : route.page === "home"
            ? "home"
            : "library-page") +
        (settings.animate ? "" : " reduced-motion")
      }
    >
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {t("跳转到主要内容", "Skip to main content")}
      </a>
      {route.page === "home" ? (
        <Landing
          settings={settings}
          onAnimate={() => update("animate", !settings.animate)}
        />
      ) : route.page === "archives" ? (
        <Library settings={settings} />
      ) : (
        <>
          <main
            id="main-content"
            tabIndex={-1}
            className={
              "explorer route-surface " + (!panelOpen ? "panel-collapsed" : "")
            }
          >
            <section
              className="canvas-section"
              aria-label={t(title + "关系图谱", "Relation graph: " + title)}
            >
              <div className="canvas-heading">
                <div className="workbench-breadcrumb">
                  <a href="#archives">
                    <ArrowLeft size={13} /> {t("剧情目录", "Stories")}
                  </a>
                  <span>/</span>
                  <span>{code}</span>
                </div>
                <h1>{title}</h1>
                <p>
                  {settings.mode === "ego" && byId.get(egoCenter || "")
                    ? t(
                        nodeName(byId.get(egoCenter!)!) + " 的关系圈",
                        nodeName(byId.get(egoCenter!)!) + "'s circle",
                      )
                    : relationCount(visibleNodes.length, visibleEdges.length)}
                </p>
              </div>
              <div
                className="view-switch"
                role="group"
                aria-label={t("视图", "View")}
              >
                {[
                  ["network", t("全图", "Network"), Network],
                  ["ego", t("关系圈", "Circle"), Focus],
                  ["chord", t("环形图", "Chord"), AudioLines],
                ].map(([mode, label, Icon]) => {
                  const I = Icon as typeof Network;
                  return (
                    <button
                      key={mode as string}
                      className={settings.mode === mode ? "active" : ""}
                      aria-pressed={settings.mode === mode}
                      onClick={() => setMode(mode as Settings["mode"])}
                    >
                      <I size={13} />
                      {label as string}
                    </button>
                  );
                })}
                {settings.mode === "ego" && (
                  <Select
                    aria-label={t("关系圈范围", "Circle range")}
                    value={settings.hops}
                    onChange={(e) => update("hops", +e.target.value)}
                  >
                    <option value={1}>{t("直接相关", "Direct ties")}</option>
                    <option value={2}>
                      {t("再往外一层", "Two steps out")}
                    </option>
                  </Select>
                )}
              </div>
              <Graph
                nodes={visibleNodes}
                edges={visibleEdges}
                communities={communities}
                settings={settings}
                selected={settings.mode === "ego" ? egoCenter : selected}
                onSelect={choose}
                onEdge={chooseEdge}
                onBackground={() => {
                  // A plain click on empty canvas returns to the whole network.
                  clearDetails();
                  if (settings.mode === "ego") update("mode", "network");
                }}
                onAnimate={() => update("animate", !settings.animate)}
                resetKey={resetKey}
              />
              {loaded.data && !visibleNodes.length && (
                <div className="empty-graph">
                  <Orbit size={32} />
                  <h2>{t("没有符合条件的角色", "No characters match")}</h2>
                  <p>
                    {t(
                      "当前筛选条件下没有角色。",
                      "No one passes the current filters.",
                    )}
                  </p>
                  <button className="wide-button" onClick={resetFilters}>
                    {t("清除筛选", "Clear filters")}
                  </button>
                </div>
              )}
              {!loaded.data && (
                <div className="empty-graph load-state" role="status">
                  <Orbit size={32} />
                  <h2>
                    {loaded.error
                      ? t("数据载入失败", "Could not load the data")
                      : t("正在载入关系数据…", "Loading relations…")}
                  </h2>
                  {loaded.error && (
                    <a className="wide-button" href="#archives">
                      {t("返回剧情目录", "Back to stories")}
                    </a>
                  )}
                </div>
              )}
              <button
                className="panel-toggle"
                aria-label={
                  panelOpen
                    ? t("收起侧栏", "Hide sidebar")
                    : t("展开侧栏", "Show sidebar")
                }
                onClick={() => setPanelOpen((v) => !v)}
              >
                {panelOpen ? (
                  <PanelRightClose size={16} />
                ) : (
                  <PanelRightOpen size={16} />
                )}
              </button>
              {loaded.data && (
                <button
                  className="report-cta"
                  onClick={() => setReport({ kind: "none" })}
                >
                  <Flag size={16} />
                  <span>
                    <small>{t("发现数据有误？", "Spotted an error?")}</small>
                    {t("提交纠错", "Report it")}
                  </span>
                  <i aria-hidden="true">
                    <svg viewBox="0 0 44 12">
                      <path d="M1 6h41M36.5 1 42 6l-5.5 5" />
                    </svg>
                  </i>
                </button>
              )}
              <div className="canvas-bottom">
                <div className="legend">
                  {legend
                    ? legend.map(([label, color]) => (
                        <span key={label} className="legend-item">
                          <i style={{ background: color }} />
                          {label}
                        </span>
                      ))
                    : communities.map((c, i) => (
                        <button
                          key={i}
                          className={community === i ? "active" : ""}
                          aria-pressed={community === i}
                          onClick={() => {
                            setCommunity(community === i ? -1 : i);
                            clearDetails();
                          }}
                        >
                          <i
                            style={{
                              background: nodeColor(
                                i,
                                communities,
                                settings.palette,
                              ),
                            }}
                          />
                          {c.label}
                        </button>
                      ))}
                </div>
                <div className="canvas-help">
                  <span>
                    {settings.locked
                      ? t("节点已锁定", "Nodes locked")
                      : t("拖拽节点 / 平移画布", "Drag nodes / pan")}{" "}
                    · {t("滚轮或双指缩放", "Wheel or pinch to zoom")}
                  </span>
                  <span>
                    <kbd>{t("空格", "Space")}</kbd>{" "}
                    {t(
                      "暂停动效 点击空白处或",
                      "pauses motion · Click empty space or",
                    )}{" "}
                    <kbd>ESC</kbd> {t("取消选择", "to deselect")}
                  </span>
                </div>
              </div>
            </section>
            <aside
              className="side-panel"
              aria-label={t("图谱侧栏", "Graph sidebar")}
            >
              <div className="workbench-context">
                <a href="#" aria-label={t("返回首页", "Back to home")}>
                  <Orbit size={17} />
                  <span>{t("方舟关系图谱", "Arknights Relation Atlas")}</span>
                </a>
                <LangSwitch />
              </div>
              <div
                className="sidebar-tabs"
                role="tablist"
                aria-label={t("侧栏", "Sidebar")}
              >
                <button
                  id="nodes-tab"
                  role="tab"
                  aria-controls="sidebar-pane"
                  aria-selected={panelTab === "nodes"}
                  tabIndex={panelTab === "nodes" ? 0 : -1}
                  onClick={() => setPanelTab("nodes")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      setPanelTab("settings");
                      document.getElementById("settings-tab")?.focus();
                    }
                  }}
                >
                  <Orbit size={14} /> {t("角色", "Characters")}{" "}
                  <span>{dataset.nodes.length}</span>
                </button>
                <button
                  id="settings-tab"
                  role="tab"
                  aria-controls="sidebar-pane"
                  aria-selected={panelTab === "settings"}
                  tabIndex={panelTab === "settings" ? 0 : -1}
                  onClick={() => setPanelTab("settings")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      setPanelTab("nodes");
                      document.getElementById("nodes-tab")?.focus();
                    }
                  }}
                >
                  <SlidersHorizontal size={14} /> {t("画布设置", "Display")}
                </button>
              </div>
              <div
                className="sidebar-page"
                id="sidebar-pane"
                role="tabpanel"
                aria-labelledby={
                  panelTab === "nodes" ? "nodes-tab" : "settings-tab"
                }
                key={panelTab}
              >
                {panelTab === "settings" ? (
                  <Controls
                    settings={settings}
                    maxMessages={maxMessages}
                    update={update}
                    setAll={setSettings}
                    onExport={doExport}
                    onReset={() => {
                      setSettings({
                        ...defaults,
                        minMessages: defaultMinMessages(dataset.nodes),
                      });
                      setResetKey((k) => k + 1);
                      setToast(t("已恢复默认设置", "Settings reset"));
                    }}
                  />
                ) : selectedEdge &&
                  dataset.edges.some((e) => e.id === selectedEdge) ? (
                  <div className="detail-scroll">
                    <EdgeDetail
                      edge={dataset.edges.find((e) => e.id === selectedEdge)!}
                      byId={byId}
                      onBack={clearDetails}
                      onSelect={choose}
                      onReport={setReport}
                    />
                  </div>
                ) : selected && byId.has(selected) ? (
                  <div className="detail-scroll" key={selected}>
                    <NodeDetail
                      node={byId.get(selected)!}
                      graphEdges={dataset.edges}
                      byId={byId}
                      communities={communities}
                      onBack={() => setSelected(null)}
                      onSelect={choose}
                      onEdge={chooseEdge}
                      onReport={setReport}
                      onEgo={() => {
                        update("mode", "ego");
                        update("hops", 1);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="panel-heading">
                      <span className="eyebrow">
                        {t("角色列表", "Characters")}
                      </span>
                      <h2>
                        {stats.nodes}
                        {t(" 名", " ")}
                        <em>{t("角色", "characters")}</em>
                      </h2>
                      <p>
                        {t(
                          "点击名字，查看人格画像和人际关系。",
                          "Click a name for their personality and relations.",
                        )}
                      </p>
                    </div>
                    <div
                      className="network-stats"
                      aria-label={t("网络概况", "Network overview")}
                    >
                      <div>
                        <strong>{stats.pairs}</strong>
                        <span>{t("组关系", "relations")}</span>
                      </div>
                      <div>
                        <strong>{Math.round(stats.reciprocity * 100)}%</strong>
                        <span>{t("双向关系", "reciprocity")}</span>
                      </div>
                      <div>
                        <strong>{stats.avgDegree}</strong>
                        <span>{t("人均关系", "avg. degree")}</span>
                      </div>
                      <div>
                        <strong>{stats.density.toFixed(3)}</strong>
                        <span>{t("网络密度", "density")}</span>
                      </div>
                      {octantTotal > 0 && (
                        <div className="network-octants">
                          <span>{t("关系类型", "Relation types")}</span>
                          <div className="breakdown-bar">
                            {octantKeys.map((k) =>
                              stats.octants[k] ? (
                                <i
                                  key={k}
                                  title={`${octantName(k)} ${stats.octants[k]}`}
                                  style={{
                                    flex: stats.octants[k],
                                    background: octants[k].color,
                                  }}
                                />
                              ) : null,
                            )}
                          </div>
                          <small>
                            {[...octantKeys]
                              .sort(
                                (a, b) => stats.octants[b] - stats.octants[a],
                              )
                              .slice(0, 3)
                              .map(
                                (k) =>
                                  `${octantName(k)} ${Math.round((stats.octants[k] / octantTotal) * 100)}%`,
                              )
                              .join(" · ")}
                          </small>
                        </div>
                      )}
                    </div>
                    <div className="navigation-controls">
                      <label className="search-box">
                        <Search size={15} />
                        <input
                          aria-label={t("搜索角色", "Search characters")}
                          placeholder={t(
                            "搜索角色中文名或英文名…",
                            "Search by English or Chinese name…",
                          )}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query && (
                          <button
                            aria-label={t("清空搜索", "Clear search")}
                            onClick={() => setQuery("")}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </label>
                      <div className="filter-row">
                        <Select
                          aria-label={t("社群筛选", "Community filter")}
                          value={community}
                          onChange={(e) => {
                            setCommunity(+e.target.value);
                            clearDetails();
                          }}
                        >
                          <option value={-1}>
                            {t("全部社群", "All communities")}
                          </option>
                          {communities.map((c, i) => (
                            <option value={i} key={i}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                        <Select
                          aria-label={t("角色排序", "Sort characters")}
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="degree">
                            {t("按关系数", "By relations")}
                          </option>
                          <option value="messages">
                            {t("按发言数", "By lines")}
                          </option>
                          <option value="betweenness">
                            {t("按中介中心性", "By betweenness centrality")}
                          </option>
                          <option value="name">{t("按名称", "By name")}</option>
                        </Select>
                      </div>
                      <div className="list-heading">
                        <span>
                          {hiddenByMessages
                            ? t(
                                `已隐藏发言少于 ${settings.minMessages} 条的 ${hiddenByMessages} 人`,
                                `${hiddenByMessages} hidden with under ${settings.minMessages} lines`,
                              )
                            : t("全部角色", "Everyone")}
                        </span>
                        <span>
                          {t(
                            `共 ${list.length} 人`,
                            plural("person", list.length, "people"),
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="node-list">
                      {list.map((n, i) => (
                        <button
                          key={n.id}
                          className="node-row"
                          onClick={() => choose(n.id)}
                          style={
                            {
                              "--row-order": Math.min(i, 8),
                            } as React.CSSProperties
                          }
                        >
                          <span className="row-index">
                            {(i + 1).toString().padStart(2, "0")}
                          </span>
                          <span
                            className="node-symbol"
                            style={
                              {
                                "--node-color": nodeColor(
                                  n.community,
                                  communities,
                                  settings.palette,
                                ),
                              } as React.CSSProperties
                            }
                          >
                            <i />
                          </span>
                          <span className="row-name">
                            {nodeName(n)}
                            <small>{altName(n)}</small>
                          </span>
                          <span className="row-degree">
                            {sort === "messages"
                              ? n.messages
                              : sort === "betweenness"
                                ? n.betweenness.toFixed(2)
                                : n.degree}
                            <small>
                              {sort === "messages"
                                ? t("发言", "lines")
                                : sort === "betweenness"
                                  ? t("中介", "betw.")
                                  : t("关系", "ties")}
                            </small>
                          </span>
                          <ArrowUpRight size={13} />
                        </button>
                      ))}
                      {!list.length && loaded.data && (
                        <div className="list-empty">
                          <Search size={23} />
                          <p>
                            {t("没有找到匹配的角色", "No matching characters")}
                          </p>
                          <button
                            className="text-button"
                            onClick={resetFilters}
                          >
                            {t("清除搜索与筛选", "Clear search and filters")}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="panel-bottom">
                      <small>
                        {t(
                          "数值由大模型根据剧情对话推断，仅供参考。",
                          "Values are a language model's estimates from the dialogue.",
                        )}
                      </small>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </main>
          <footer className="workspace-footer">
            <span>
              <i className="status-dot" /> {code} <b>{title}</b>
            </span>
            <span>
              {t(
                `${visibleNodes.length} 名角色`,
                plural("character", visibleNodes.length),
              )}{" "}
              <i>/</i>{" "}
              {t(
                `${visibleEdges.length} 组关系`,
                plural("relation", visibleEdges.length),
              )}{" "}
              <i>/</i>{" "}
              {t(
                `${new Set(visibleNodes.map((n) => n.community)).size} 个社群`,
                plural(
                  "community",
                  new Set(visibleNodes.map((n) => n.community)).size,
                  "communities",
                ),
              )}
            </span>
            <button onClick={doExport}>
              <Download size={12} /> {t("导出 SVG", "Export SVG")}
            </button>
          </footer>
        </>
      )}
      {report && archive && loaded.data && (
        <ReportDialog
          origin={report}
          archive={archive}
          dataVersion={dataVersion}
          data={loaded.data}
          byId={byId}
          onClose={(kept) => {
            setReport(null);
            if (kept)
              setToast(
                t(
                  "草稿已保留，再次打开纠错面板即可继续",
                  "Draft kept. Reopen the report panel to continue",
                ),
              );
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
