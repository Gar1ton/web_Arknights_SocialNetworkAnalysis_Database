import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  Search,
  X,
  Orbit,
  SlidersHorizontal,
  Network,
  Focus,
  AudioLines,
  Download,
  Check,
  MoveUpRight,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import {
  nodes,
  edges,
  factions,
  nodeById,
  degree,
  neighborhood,
  type AtlasNode,
  type AtlasEdge,
} from "./data";
import { defaults, readSettings, type Settings, palettes } from "./settings";
import FlowField from "./FlowField";
import Graph from "./Graph";
import Controls from "./Controls";
import { exportGraph } from "./export";
type Route = "home" | "atlas" | "studio";
const readRoute = (): Route =>
  location.hash === "#atlas"
    ? "atlas"
    : location.hash === "#studio"
      ? "studio"
      : "home";
function Brand() {
  return (
    <a className="brand" href="#" aria-label="Terra 首页">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        TERRA<small>RELATION ATLAS</small>
      </span>
    </a>
  );
}
function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function EdgeDetail({
  edge,
  onBack,
  onSelect,
}: {
  edge: AtlasEdge;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const a = nodeById.get(edge.source)!,
    b = nodeById.get(edge.target)!;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回节点导航
      </button>
      <div className="detail-content">
        <span className="eyebrow">RELATIONSHIP / {edge.id.toUpperCase()}</span>
        <h2 className="edge-names">
          <button onClick={() => onSelect(a.id)}>{a.name}</button>
          <span>{edge.mutual ? "⇄" : "→"}</span>
          <button onClick={() => onSelect(b.id)}>{b.name}</button>
        </h2>
        <span className="tag">{edge.label}</span>
        <span className="tag">{edge.mutual ? "双向关系" : "单向关系"}</span>
        <p className="detail-prose">
          关系被看见的瞬间，孤立的节点开始拥有意义。
        </p>
        <div className="detail-metrics">
          <Metric value={edge.messages} label="演示互动数" />
          <Metric value={edge.weight.toFixed(2)} label="关系强度" />
        </div>
        <h3 className="mini-heading">方向与倾向</h3>
        <p className="control-note">
          {a.name} → {b.name}
          {edge.mutual ? "（反向关系存在，以下为正向属性）" : ""}
        </p>
        {[
          ["情感倾向", edge.affect, "疏离", "亲近"],
          ["权力倾向", edge.power, "追随", "主导"],
        ].map(([label, val, left, right]) => (
          <div key={label} className="sentiment">
            <div>
              <span>{label}</span>
              <b>
                {Number(val) > 0 ? "+" : ""}
                {Number(val).toFixed(2)}
              </b>
            </div>
            <div className="sentiment-track">
              <i style={{ left: `${(Number(val) + 1) * 50}%` }} />
            </div>
            <small>
              <span>{left}</span>
              <span>{right}</span>
            </small>
          </div>
        ))}
        <div className="evidence-note">
          <span className="eyebrow">DEMO EVIDENCE</span>
          <p>
            此关系与数值为界面演示构造，不代表原作设定或真实 SNA
            分析。真实证据将在数据接入后呈现。
          </p>
        </div>
      </div>
    </>
  );
}
function NodeDetail({
  node,
  onBack,
  onSelect,
  onEdge,
  onEgo,
}: {
  node: AtlasNode;
  onBack: () => void;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onEgo: () => void;
}) {
  const links = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .sort((a, b) => b.weight - a.weight);
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回节点导航
      </button>
      <div className="detail-content">
        <div
          className="profile-emblem"
          style={
            {
              "--node-color": factions[node.faction].color,
            } as React.CSSProperties
          }
        >
          <span>{factions[node.faction].short}</span>
          <i />
          <i />
          <i />
        </div>
        <span className="eyebrow">
          OPERATOR / {node.id.slice(1).padStart(3, "0")}
        </span>
        <h2 className="profile-name">
          {node.name}
          <em>{node.en}</em>
        </h2>
        <div className="tags">
          {node.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <p className="detail-prose">{node.description}</p>
        <div className="detail-metrics">
          <Metric value={links.length} label="关联节点" />
          <Metric value={node.messages} label="演示消息数" />
          <Metric
            value={`${Math.round(node.confidence * 100)}%`}
            label="演示置信度"
          />
        </div>
        <button className="wide-button" onClick={onEgo}>
          <Focus size={15} /> 探索此节点的邻域 <ArrowUpRight size={15} />
        </button>
        <h3 className="mini-heading">
          人格轮廓 <span>ILLUSTRATIVE</span>
        </h3>
        <div className="traits">
          {["开放性", "尽责性", "外向性", "宜人性", "神经质"].map(
            (label, i) => (
              <div key={label}>
                <span>{label}</span>
                <div>
                  <i style={{ width: node.traits[i] + "%" }} />
                </div>
                <b>{node.traits[i]}</b>
              </div>
            ),
          )}
        </div>
        <h3 className="mini-heading">
          关系轨迹 <span>{links.length} CONNECTIONS</span>
        </h3>
        <div className="connections">
          {links.map((e) => {
            const other = nodeById.get(
              e.source === node.id ? e.target : e.source,
            )!;
            return (
              <div key={e.id}>
                <button
                  className="connection-name"
                  onClick={() => onSelect(other.id)}
                >
                  <i style={{ background: factions[other.faction].color }} />
                  {other.name}
                  <small>
                    {e.mutual ? "⇄" : e.source === node.id ? "→" : "←"}
                  </small>
                </button>
                <button
                  className="connection-type"
                  onClick={() => onEdge(e.id)}
                  aria-label={`查看${node.name}与${other.name}的关系详情`}
                >
                  {e.label} <ArrowUpRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="control-note">档案、人格分数及关系均为演示内容。</p>
      </div>
    </>
  );
}
export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [settings, setSettings] = useState<Settings>(() => {
    const s = readSettings();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      s.animate = false;
    return s;
  });
  const [selected, setSelected] = useState<string | null>(null),
    [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [faction, setFaction] = useState(-1),
    [sort, setSort] = useState("degree"),
    [panelOpen, setPanelOpen] = useState(true),
    [resetKey, setResetKey] = useState(0),
    [toast, setToast] = useState("");
  useEffect(() => {
    const cb = () => {
      setRoute(readRoute());
      setPanelOpen(true);
    };
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
  }, []);
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
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    [],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
      }
      if (e.key === "r" || e.key === "R") setResetKey((k) => k + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const baseNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (faction < 0 || n.faction === faction) &&
          n.messages >= settings.minMessages,
      ),
    [faction, settings.minMessages],
  );
  const baseEdges = useMemo(() => {
    const ids = new Set(baseNodes.map((n) => n.id));
    return edges.filter(
      (e) =>
        ids.has(e.source) &&
        ids.has(e.target) &&
        e.weight >= settings.minWeight,
    );
  }, [baseNodes, settings.minWeight]);
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
            ? degree(b.id) - degree(a.id)
            : sort === "messages"
              ? b.messages - a.messages
              : a.name.localeCompare(b.name, "zh-CN"),
        ),
    [baseNodes, query, sort],
  );
  const choose = (id: string) => {
    const n = nodeById.get(id)!;
    if (faction >= 0 && n.faction !== faction) setFaction(-1);
    if (n.messages < settings.minMessages) update("minMessages", 0);
    setSelected(id);
    setSelectedEdge(null);
    setPanelOpen(true);
    if (route === "home") location.hash = "atlas";
  };
  const chooseEdge = (id: string) => {
    setSelectedEdge(id);
    setSelected(edges.find((e) => e.id === id)?.source || null);
    setPanelOpen(true);
    if (route === "studio") location.hash = "atlas";
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
    setSelected(null);
    setSelectedEdge(null);
  };
  const doExport = (type: "svg" | "json" | "csv") => {
    try {
      exportGraph(type, visibleNodes, visibleEdges, settings);
      setToast(type.toUpperCase() + " 演示文件已生成");
    } catch {
      setToast("导出未完成，请重新打开星图后重试");
    }
  };
  const setMode = (mode: Settings["mode"]) => {
    if (mode === "ego" && !selected) setSelected(baseNodes[0]?.id || null);
    update("mode", mode);
    setSelectedEdge(null);
  };
  const isHome = route === "home";
  return (
    <div
      className={
        "app " +
        (isHome ? "home" : "workspace") +
        (settings.animate ? "" : " reduced-motion")
      }
    >
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="skip-link"
      >
        跳转到主要内容
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="主要导航">
          {[
            ["home", "01", "序章"],
            ["atlas", "02", "节点导航"],
            ["studio", "03", "节点设置"],
          ].map(([id, num, label]) => (
            <a
              key={id}
              href={id === "home" ? "#" : "#" + id}
              className={route === id ? "active" : ""}
              aria-current={route === id ? "page" : undefined}
            >
              <span>{num}</span>
              {label}
            </a>
          ))}
        </nav>
        <div className="demo-badge">
          <span /> DEMO EDITION <small>v.01</small>
        </div>
      </header>
      {isHome ? (
        <main tabIndex={-1} id="main-content" className="landing">
          <div className="landing-art">
            <FlowField settings={settings} />
            <div className="art-vignette" />
            <Graph
              nodes={nodes}
              edges={edges}
              settings={{
                ...settings,
                mode: "network",
                layout: "organic",
                labels: true,
              }}
              selected={null}
              onSelect={choose}
              onEdge={chooseEdge}
              onAnimate={() => update("animate", !settings.animate)}
              landing
              resetKey={resetKey}
            />
          </div>
          <div className="hero-copy">
            <span className="eyebrow">
              <i /> ARKNIGHTS · SOCIAL NETWORK ANALYSIS
            </span>
            <h1>
              Every connection
              <br />
              leaves a <em>trace.</em>
            </h1>
            <div className="hero-divider" />
            <p className="hero-chinese">
              于万千轨迹中，
              <br />
              看见彼此的引力。
            </p>
            <p className="hero-description">
              一张关于泰拉的关系星图。
              <br />
              循着对话的微光，探索角色、社群与故事的交汇。
            </p>
            <a href="#atlas" className="primary-cta">
              进入关系星图 <ArrowUpRight size={20} />
            </a>
            <a href="#studio" className="secondary-cta">
              或，创造你的观测方式 <ArrowRight size={14} />
            </a>
          </div>
          <div className="art-caption">
            <span className="tiny-cross">+</span>
            <div>
              Constellation, No. 001
              <small>THE INVISIBLE THREADS BETWEEN US</small>
            </div>
            <span className="caption-coordinate">
              TERRA
              <br />
              00° / 48′
            </span>
          </div>
          <div className="landing-bottom">
            <div className="landing-stats">
              <Metric
                value={nodes.length.toString().padStart(2, "0")}
                label="演示节点 / NODES"
              />
              <Metric value={edges.length} label="关系轨迹 / EDGES" />
              <Metric value="06" label="社群 / COMMUNITIES" />
            </div>
            <div className="landing-note">
              <span className="status-dot" /> AN INTERACTIVE STUDY OF CONNECTION
              <p>
                演示数据 · 非真实分析结果 <span>SCROLL WITH CURIOSITY ↗</span>
              </p>
            </div>
          </div>
          <div className="landing-foot">
            <span>INDEPENDENT ARKNIGHTS SNA SHOWCASE</span>
            <span>从一个节点，抵达一个世界。</span>
            <button onClick={() => update("animate", !settings.animate)}>
              {settings.animate ? "Ⅱ 暂停流动" : "▷ 恢复流动"}
            </button>
          </div>
        </main>
      ) : (
        <main
          tabIndex={-1}
          id="main-content"
          className={"explorer " + (!panelOpen ? "panel-collapsed" : "")}
        >
          <section className="canvas-section" aria-label="关系星图">
            <FlowField settings={settings} subtle />
            <div className="canvas-vignette" />
            <div className="canvas-heading">
              <span className="eyebrow">
                THE TERRA CONSTELLATION <span>/ 001</span>
              </span>
              <h1>
                {route === "studio" ? "The art of" : "Between the"}{" "}
                <em>{route === "studio" ? "connection." : "lines."}</em>
              </h1>
              <p>
                {route === "studio"
                  ? "每一次微调，都是一次新的观看。"
                  : "沿着关系的轨迹，发现故事的另一面。"}
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
                {factions.map((f, i) => (
                  <button
                    key={f.en}
                    className={faction === i ? "active" : ""}
                    aria-pressed={faction === i}
                    onClick={() => {
                      setFaction(faction === i ? -1 : i);
                      setSelected(null);
                      setSelectedEdge(null);
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
                ))}
              </div>
              <div className="canvas-help">
                <span>
                  {settings.locked ? "节点位置已锁定" : "拖拽节点 / 平移画布"} ·
                  滚轮缩放
                </span>
                <span>
                  <kbd>SPACE</kbd> 暂停 <kbd>ESC</kbd> 取消选择
                </span>
              </div>
            </div>
          </section>
          <aside
            className="side-panel"
            aria-label={route === "studio" ? "节点设置面板" : "节点导航面板"}
          >
            {route === "studio" ? (
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
            ) : selectedEdge ? (
              <div className="detail-scroll">
                <EdgeDetail
                  edge={edges.find((e) => e.id === selectedEdge)!}
                  onBack={() => {
                    setSelectedEdge(null);
                    setSelected(null);
                  }}
                  onSelect={choose}
                />
              </div>
            ) : selected ? (
              <div className="detail-scroll">
                <NodeDetail
                  node={nodeById.get(selected)!}
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
                  <span className="eyebrow">
                    <Orbit size={12} /> NODE NAVIGATION / 02
                  </span>
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
                        setSelected(null);
                        setSelectedEdge(null);
                      }}
                    >
                      <option value={-1}>全部社群</option>
                      {factions.map((f, i) => (
                        <option value={i} key={f.en}>
                          {f.name}
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
                        {degree(n.id)}
                        <small>LINKS</small>
                      </span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                  {!list.length && (
                    <div className="list-empty">
                      <Search size={23} />
                      <p>没有找到匹配节点</p>
                      <button className="text-button" onClick={resetFilters}>
                        清除搜索与筛选
                      </button>
                    </div>
                  )}
                </div>
                <div className="panel-bottom">
                  <a href="#studio">
                    <SlidersHorizontal size={14} /> 调整星图设置{" "}
                    <ArrowUpRight size={15} />
                  </a>
                  <small>所有档案与关系均为演示内容</small>
                </div>
              </>
            )}
          </aside>
        </main>
      )}
      {!isHome && (
        <footer className="workspace-footer">
          <span>
            <i className="status-dot" /> ILLUSTRATIVE DATA <b>演示数据</b>
          </span>
          <span>
            {visibleNodes.length} NODES <i>/</i> {visibleEdges.length} EDGES{" "}
            <i>/</i> {new Set(visibleNodes.map((n) => n.faction)).size}{" "}
            COMMUNITIES
          </span>
          <button onClick={() => doExport("svg")}>
            <Download size={12} /> EXPORT VIEW <MoveUpRight size={12} />
          </button>
        </footer>
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
