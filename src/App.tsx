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
} from "lucide-react";
import {
  type ArchiveData,
  defaultMinMessages,
  neighborhood,
  octantKeys,
  octants,
} from "./data";
import { nodeColor, scaleColors } from "./colors";
import {
  defaults,
  readSettings,
  storageKey,
  type Settings,
  palettes,
} from "./settings";
import { useArchive, useManifest } from "./archives";
import { resolveRoute } from "./routes";
import Landing from "./Landing";
import Library from "./Library";
import Graph from "./Graph";
import Controls from "./Controls";
import { NodeDetail, EdgeDetail } from "./Details";
import { exportGraph } from "./export";
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
  const manifest = useManifest();
  const loaded = useArchive(route.page === "graph" ? route.archiveId : null);
  const archive = manifest.data?.archives.find((a) => a.id === route.archiveId);
  const dataset = loaded.data || empty;
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
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === "degree"
            ? b.degree - a.degree || b.messages - a.messages
            : sort === "messages"
              ? b.messages - a.messages
              : sort === "betweenness"
                ? b.betweenness - a.betweenness
                : a.name.localeCompare(b.name, "zh-CN"),
        ),
    [baseNodes, query, sort],
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
        title: archive?.title || "",
      });
      setToast("已导出 SVG 图片");
    } catch {
      setToast("导出未完成，请重新打开图谱后重试");
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
      ? octantKeys.map((k) => [octants[k].name, octants[k].color])
      : settings.coloring === "affect"
        ? ["敌对", "中性", "友善"].map((l, i) => [l, scaleColors.affect[i]])
        : settings.coloring === "power"
          ? ["顺从", "中性", "主导"].map((l, i) => [l, scaleColors.power[i]])
          : null;
  const title = archive?.title || "关系图谱";
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
            <section className="canvas-section" aria-label={title + "关系图谱"}>
              <div className="canvas-heading">
                <div className="workbench-breadcrumb">
                  <a href="#archives">
                    <ArrowLeft size={13} /> 剧情目录
                  </a>
                  <span>/</span>
                  <span>{archive?.code}</span>
                </div>
                <h1>{title}</h1>
                <p>
                  {settings.mode === "ego" && egoCenter
                    ? byId.get(egoCenter)?.name + " 的关系圈"
                    : `${visibleNodes.length} 名角色 · ${visibleEdges.length} 组关系`}
                </p>
              </div>
              <div className="view-switch" role="group" aria-label="视图">
                {[
                  ["network", "全图", Network],
                  ["ego", "关系圈", Focus],
                  ["chord", "环形图", AudioLines],
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
                    aria-label="关系圈范围"
                    value={settings.hops}
                    onChange={(e) => update("hops", +e.target.value)}
                  >
                    <option value={1}>直接相关</option>
                    <option value={2}>再往外一层</option>
                  </Select>
                )}
              </div>
              <Graph
                nodes={visibleNodes}
                edges={visibleEdges}
                communities={dataset.communities}
                settings={settings}
                selected={settings.mode === "ego" ? egoCenter : selected}
                onSelect={choose}
                onEdge={chooseEdge}
                onAnimate={() => update("animate", !settings.animate)}
                resetKey={resetKey}
              />
              {loaded.data && !visibleNodes.length && (
                <div className="empty-graph">
                  <Orbit size={32} />
                  <h2>没有符合条件的角色</h2>
                  <p>当前筛选条件下没有角色。</p>
                  <button className="wide-button" onClick={resetFilters}>
                    清除筛选
                  </button>
                </div>
              )}
              {!loaded.data && (
                <div className="empty-graph load-state" role="status">
                  <Orbit size={32} />
                  <h2>{loaded.error ? "数据载入失败" : "正在载入关系数据…"}</h2>
                  {loaded.error && (
                    <a className="wide-button" href="#archives">
                      返回剧情目录
                    </a>
                  )}
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
                  {legend
                    ? legend.map(([label, color]) => (
                        <span key={label} className="legend-item">
                          <i style={{ background: color }} />
                          {label}
                        </span>
                      ))
                    : dataset.communities.map((c, i) => (
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
                                dataset.communities,
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
                    {settings.locked ? "节点已锁定" : "拖拽节点 / 平移画布"} ·
                    滚轮缩放
                  </span>
                  <span>
                    <kbd>空格</kbd> 暂停动效 <kbd>ESC</kbd> 取消选择
                  </span>
                </div>
              </div>
            </section>
            <aside className="side-panel" aria-label="图谱侧栏">
              <div className="workbench-context">
                <a href="#" aria-label="返回首页">
                  <Orbit size={17} />
                  <span>方舟关系图谱</span>
                </a>
                <a
                  href="#archives"
                  className="switch-archive"
                  aria-label="切换剧情"
                >
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="sidebar-tabs" role="tablist" aria-label="侧栏">
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
                  <Orbit size={14} /> 角色 <span>{dataset.nodes.length}</span>
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
                      setToast("已恢复默认设置");
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
                    />
                  </div>
                ) : selected && byId.has(selected) ? (
                  <div className="detail-scroll" key={selected}>
                    <NodeDetail
                      node={byId.get(selected)!}
                      graphEdges={dataset.edges}
                      byId={byId}
                      communities={dataset.communities}
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
                      <span className="eyebrow">角色列表</span>
                      <h2>
                        {stats.nodes} 名<em>角色</em>
                      </h2>
                      <p>点击名字，查看人格画像和人际关系。</p>
                    </div>
                    <div className="network-stats" aria-label="网络概况">
                      <div>
                        <strong>{stats.pairs}</strong>
                        <span>组关系</span>
                      </div>
                      <div>
                        <strong>{Math.round(stats.reciprocity * 100)}%</strong>
                        <span>双向关系</span>
                      </div>
                      <div>
                        <strong>{stats.avgDegree}</strong>
                        <span>人均关系</span>
                      </div>
                      <div>
                        <strong>{stats.density.toFixed(3)}</strong>
                        <span>网络密度</span>
                      </div>
                      {octantTotal > 0 && (
                        <div className="network-octants">
                          <span>关系类型</span>
                          <div className="breakdown-bar">
                            {octantKeys.map((k) =>
                              stats.octants[k] ? (
                                <i
                                  key={k}
                                  title={`${octants[k].name} ${stats.octants[k]}`}
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
                                  `${octants[k].name} ${Math.round((stats.octants[k] / octantTotal) * 100)}%`,
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
                          aria-label="搜索角色"
                          placeholder="搜索角色中文名或英文名…"
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
                        <Select
                          aria-label="社群筛选"
                          value={community}
                          onChange={(e) => {
                            setCommunity(+e.target.value);
                            clearDetails();
                          }}
                        >
                          <option value={-1}>全部社群</option>
                          {dataset.communities.map((c, i) => (
                            <option value={i} key={i}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                        <Select
                          aria-label="角色排序"
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="degree">按关系数</option>
                          <option value="messages">按发言数</option>
                          <option value="betweenness">按中介中心性</option>
                          <option value="name">按名称</option>
                        </Select>
                      </div>
                      <div className="list-heading">
                        <span>
                          {hiddenByMessages
                            ? `已隐藏发言少于 ${settings.minMessages} 条的 ${hiddenByMessages} 人`
                            : "全部角色"}
                        </span>
                        <span>共 {list.length} 人</span>
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
                                  dataset.communities,
                                  settings.palette,
                                ),
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
                            {sort === "messages"
                              ? n.messages
                              : sort === "betweenness"
                                ? n.betweenness.toFixed(2)
                                : n.degree}
                            <small>
                              {sort === "messages"
                                ? "发言"
                                : sort === "betweenness"
                                  ? "中介"
                                  : "关系"}
                            </small>
                          </span>
                          <ArrowUpRight size={13} />
                        </button>
                      ))}
                      {!list.length && loaded.data && (
                        <div className="list-empty">
                          <Search size={23} />
                          <p>没有找到匹配的角色</p>
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
                        <ArrowLeft size={13} /> 换一段剧情{" "}
                        <ArrowUpRight size={14} />
                      </a>
                      <small>数值由大模型根据剧情对话推断，仅供参考。</small>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </main>
          <footer className="workspace-footer">
            <span>
              <i className="status-dot" /> {archive?.code} <b>{title}</b>
            </span>
            <span>
              {visibleNodes.length} 名角色 <i>/</i> {visibleEdges.length} 组关系{" "}
              <i>/</i> {new Set(visibleNodes.map((n) => n.community)).size}{" "}
              个社群
            </span>
            <button onClick={doExport}>
              <Download size={12} /> 导出 SVG
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
