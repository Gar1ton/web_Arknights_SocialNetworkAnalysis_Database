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
} from "lucide-react";
import { factions, nodeById, degree, neighborhood } from "./data";
import { defaults, readSettings, type Settings, palettes } from "./settings";
import { archiveGraph } from "./archives";
import { resolveRoute } from "./routes";
import Landing from "./Landing";
import Library from "./Library";
import Graph from "./Graph";
import Controls from "./Controls";
import { NodeDetail, EdgeDetail } from "./Details";
import { exportGraph } from "./export";
export default function App() {
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
    [faction, setFaction] = useState(-1),
    [sort, setSort] = useState("degree"),
    [panelOpen, setPanelOpen] = useState(true),
    [resetKey, setResetKey] = useState(0),
    [toast, setToast] = useState("");
  const dataset = useMemo(
    () => archiveGraph(route.archiveId),
    [route.archiveId],
  );
  useEffect(() => {
    const cb = () => {
      const next = resolveRoute(location.hash);
      const change = () => {
        flushSync(() => {
          setRoute(next);
          setSelected(null);
          setSelectedEdge(null);
          setPanelOpen(true);
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
    setQuery("");
    setFaction(-1);
    setPanelTab("nodes");
    setSettings((s) => ({
      ...s,
      mode: "network",
      minMessages: 0,
      minWeight: 0,
      locked: false,
    }));
    setResetKey((k) => k + 1);
  }, [route.archiveId]);
  useEffect(() => {
    try {
      localStorage.setItem("terra:settings:v1", JSON.stringify(settings));
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
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          'input,select,textarea,button,a,[role="button"]',
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
          (faction < 0 || n.faction === faction) &&
          n.messages >= settings.minMessages,
      ),
    [dataset, faction, settings.minMessages],
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
  const egoCenter = selected || baseNodes[0]?.id || null;
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
          (n.name + " " + n.en + " " + n.tags.join(" "))
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "degree"
            ? degree(b.id, dataset.edges) - degree(a.id, dataset.edges)
            : sort === "messages"
              ? b.messages - a.messages
              : a.name.localeCompare(b.name, "zh-CN"),
        ),
    [baseNodes, query, sort, dataset],
  );
  const choose = (id: string) => {
    const n = nodeById.get(id)!;
    if (faction >= 0 && n.faction !== faction) setFaction(-1);
    if (n.messages < settings.minMessages) update("minMessages", 0);
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
    setFaction(-1);
    setQuery("");
    setSettings((s) => ({
      ...s,
      minMessages: 0,
      minWeight: 0,
      mode: "network",
    }));
    clearDetails();
  };
  const doExport = (type: "svg" | "json" | "csv") => {
    try {
      exportGraph(type, visibleNodes, visibleEdges, settings, {
        id: dataset.archive.id,
        title: dataset.archive.title,
      });
      setToast(type.toUpperCase() + " 演示文件已生成");
    } catch {
      setToast("导出未完成，请重新打开图谱后重试");
    }
  };
  const setMode = (mode: Settings["mode"]) => {
    if (mode === "ego" && !selected) setSelected(baseNodes[0]?.id || null);
    update("mode", mode);
    setSelectedEdge(null);
  };
  const archive = dataset.archive;
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
        跳转到主要内容
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
              aria-label={archive.title + "关系图谱"}
            >
              <div className="canvas-heading">
                <div className="workbench-breadcrumb">
                  <a href="#archives">
                    <ArrowLeft size={13} /> 活动档案
                  </a>
                  <span>/</span>
                  <span>{archive.code}</span>
                </div>
                <h1>
                  {archive.title}
                  <span className="graph-demo-tag">DEMO</span>
                </h1>
                <p>
                  {archive.en} <i />{" "}
                  {settings.mode === "ego" && egoCenter
                    ? nodeById.get(egoCenter)?.name + "的关系邻域"
                    : "每一条线，都曾是一段故事。"}
                </p>
              </div>
              <div className="view-switch" role="group" aria-label="网络视图">
                {[
                  ["network", "网络", Network],
                  ["ego", "邻域", Focus],
                  ["chord", "弦图", AudioLines],
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
                  <select
                    aria-label="邻域深度"
                    value={settings.hops}
                    onChange={(e) => update("hops", +e.target.value)}
                  >
                    <option value={1}>1 跳</option>
                    <option value={2}>2 跳</option>
                  </select>
                )}
              </div>
              <Graph
                nodes={visibleNodes}
                edges={visibleEdges}
                settings={settings}
                selected={settings.mode === "ego" ? egoCenter : selected}
                onSelect={choose}
                onEdge={chooseEdge}
                onAnimate={() => update("animate", !settings.animate)}
                resetKey={resetKey}
              />
              {!visibleNodes.length && (
                <div className="empty-graph">
                  <Orbit size={32} />
                  <h2>这一片星空，暂时安静。</h2>
                  <p>当前筛选条件下没有节点。</p>
                  <button className="wide-button" onClick={resetFilters}>
                    清除筛选，重新探索
                  </button>
                </div>
              )}
              <button
                className="panel-toggle"
                aria-label={panelOpen ? "收起侧栏" : "展开侧栏"}
                onClick={() => setPanelOpen((v) => !v)}
              >
                {panelOpen ? (
                  <PanelRightClose size={16} />
                ) : (
                  <PanelRightOpen size={16} />
                )}
              </button>
              <div className="canvas-bottom">
                <div className="legend">
                  {archive.factions.map((i) => {
                    const f = factions[i];
                    return (
                      <button
                        key={f.en}
                        className={faction === i ? "active" : ""}
                        aria-pressed={faction === i}
                        onClick={() => {
                          setFaction(faction === i ? -1 : i);
                          clearDetails();
                        }}
                      >
                        <i
                          style={{
                            background:
                              settings.palette === "dusk"
                                ? f.color
                                : palettes[settings.palette].colors[i % 4],
                          }}
                        />
                        {f.name}
                      </button>
                    );
                  })}
                </div>
                <div className="canvas-help">
                  <span>
                    {settings.locked ? "节点已锁定" : "拖拽节点 / 平移画布"} ·
                    滚轮缩放
                  </span>
                  <span>
                    <kbd>SPACE</kbd> 暂停 <kbd>ESC</kbd> 取消选择
                  </span>
                </div>
              </div>
            </section>
            <aside className="side-panel" aria-label="图谱侧栏">
              <div className="workbench-context">
                <a href="#" aria-label="Terra 首页">
                  <Orbit size={17} />
                  <span>
                    TERRA <i>/</i> ATLAS
                  </span>
                </a>
                <a
                  href="#archives"
                  className="switch-archive"
                  aria-label="切换活动"
                >
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div
                className="sidebar-tabs"
                role="tablist"
                aria-label="图谱工具"
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
                  <Orbit size={14} /> 节点导航{" "}
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
                  <SlidersHorizontal size={14} /> 画布设置
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
                    update={update}
                    setAll={setSettings}
                    onExport={doExport}
                    onReset={() => {
                      setSettings({ ...defaults });
                      setResetKey((k) => k + 1);
                      setToast("已恢复默认设置");
                    }}
                  />
                ) : selectedEdge &&
                  dataset.edges.some((e) => e.id === selectedEdge) ? (
                  <div className="detail-scroll">
                    <EdgeDetail
                      edge={dataset.edges.find((e) => e.id === selectedEdge)!}
                      onBack={clearDetails}
                      onSelect={choose}
                    />
                  </div>
                ) : selected ? (
                  <div className="detail-scroll" key={selected}>
                    <NodeDetail
                      node={nodeById.get(selected)!}
                      graphEdges={dataset.edges}
                      onBack={() => setSelected(null)}
                      onSelect={choose}
                      onEdge={chooseEdge}
                      onEgo={() => {
                        update("mode", "ego");
                        update("hops", 1);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="panel-heading">
                      <span className="eyebrow">THE PEOPLE IN THIS STORY</span>
                      <h2>
                        Find your <em>orbit.</em>
                      </h2>
                      <p>从一个名字出发，走进整个网络。</p>
                    </div>
                    <div className="navigation-controls">
                      <label className="search-box">
                        <Search size={15} />
                        <input
                          aria-label="搜索节点"
                          placeholder="搜索角色、英文名或社群…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {query && (
                          <button
                            aria-label="清空搜索"
                            onClick={() => setQuery("")}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </label>
                      <div className="filter-row">
                        <select
                          aria-label="社群筛选"
                          value={faction}
                          onChange={(e) => {
                            setFaction(+e.target.value);
                            clearDetails();
                          }}
                        >
                          <option value={-1}>全部社群</option>
                          {archive.factions.map((i) => (
                            <option value={i} key={i}>
                              {factions[i].name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="节点排序"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="degree">关联度排序</option>
                          <option value="messages">消息数排序</option>
                          <option value="name">名称排序</option>
                        </select>
                      </div>
                      <div className="list-heading">
                        <span>节点索引</span>
                        <span>
                          {list.length.toString().padStart(2, "0")} OPERATORS
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
                                "--node-color": factions[n.faction].color,
                              } as React.CSSProperties
                            }
                          >
                            <i />
                          </span>
                          <span className="row-name">
                            {n.name}
                            <small>{n.en}</small>
                          </span>
                          <span className="row-degree">
                            {degree(n.id, dataset.edges)}
                            <small>LINKS</small>
                          </span>
                          <ArrowUpRight size={13} />
                        </button>
                      ))}
                      {!list.length && (
                        <div className="list-empty">
                          <Search size={23} />
                          <p>没有找到匹配节点</p>
                          <button
                            className="text-button"
                            onClick={resetFilters}
                          >
                            清除搜索与筛选
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="panel-bottom">
                      <a href="#archives">
                        <ArrowLeft size={13} /> 选择另一段故事{" "}
                        <ArrowUpRight size={14} />
                      </a>
                      <small>当前：{archive.title} · 演示数据</small>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </main>
          <footer className="workspace-footer">
            <span>
              <i className="status-dot" /> {archive.code} <b>演示数据</b>
            </span>
            <span>
              {visibleNodes.length} NODES <i>/</i> {visibleEdges.length} EDGES{" "}
              <i>/</i> {new Set(visibleNodes.map((n) => n.faction)).size}{" "}
              COMMUNITIES
            </span>
            <button onClick={() => doExport("svg")}>
              <Download size={12} /> EXPORT VIEW
            </button>
          </footer>
        </>
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
