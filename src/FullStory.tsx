import Select from "./Select";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  PanelRightClose,
  PanelRightOpen,
  ListTree,
  Play,
  Pause,
  SkipBack,
  StepBack,
  StepForward,
} from "lucide-react";
import { altName, communityLabel, neighborhood, nodeName, octantKeys, octantName, octants } from "./data";
import { locale, plural, t } from "./i18n";
import { useLang } from "./useLang";
import LangSwitch from "./LangSwitch";
import { nodeColor, scaleColors } from "./colors";
import { defaults, type Settings } from "./settings";
import { archiveCode, archiveTitle } from "./archives";
import Graph from "./Graph";
import Controls from "./Controls";
import { NodeDetail, EdgeDetail, type Timeline } from "./Details";
import { TimelineCurve } from "./charts";
import { exportGraph } from "./export";
import type { Core } from "./model/load";
import { edgeId, nodeId, personOf } from "./model/atlas";
import {
  fullAt,
  growth,
  historyRows,
  indexFull,
  turnsOf,
  useFullStory,
  T,
  type FullIndex,
  type Scope,
} from "./model/fullstory";
import { personHash, storyHash, fullStoryHash } from "./routes";
type Tab = "stories" | "nodes" | "settings";
const num = (n: number) => n.toLocaleString(locale());
const SHOWN = 300;
/**
 * 全剧情总表: the network of named characters over the main story and the events, as of any story. The
 * timeline steps through the stories in chronological order; a relation shows its value as of that story.
 */
export default function FullStory(props: {
  core: Core;
  focus?: number;
  pair?: [number, number];
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onToast: (text: string) => void;
}) {
  const loaded = useFullStory();
  const ix = useMemo(() => (loaded.data ? indexFull(props.core, loaded.data) : null), [loaded.data, props.core]);
  return ix ? (
    <Loaded {...props} ix={ix} />
  ) : (
    <main id="main-content" tabIndex={-1} className="explorer route-surface">
      <section className="canvas-section">
        <div className="empty-graph load-state" role="status">
          <Orbit size={32} />
          <h2>
            {loaded.error ? t("数据载入失败", "Could not load the data") : t("正在载入全剧情关系…", "Loading the full story…")}
          </h2>
          {loaded.error && (
            <a className="wide-button" href="#archives">
              {t("返回剧情目录", "Back to stories")}
            </a>
          )}
        </div>
      </section>
      <aside className="side-panel" />
    </main>
  );
}
function Loaded({
  core,
  ix,
  focus,
  pair,
  settings,
  setSettings,
  onToast,
}: Parameters<typeof FullStory>[0] & { ix: FullIndex }) {
  const language = useLang();
  const n = ix.n;
  const [scope, setScope] = useState<Scope>("all");
  const [cur, setCur] = useState(n - 1);
  const [playing, setPlaying] = useState(false);
  const [panelTab, setPanelTab] = useState<Tab>("stories");
  const [selected, setSelected] = useState<string | null>(focus !== undefined ? nodeId(focus) : null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(pair ? edgeId(pair[0], pair[1]) : null);
  const [query, setQuery] = useState(""),
    [community, setCommunity] = useState(-1),
    [sort, setSort] = useState("degree"),
    [panelOpen, setPanelOpen] = useState(true),
    [resetKey, setResetKey] = useState(0);
  const metaOf = (t0: number) => core.manifest.stories[ix.data.stories[t0]];
  const full = useMemo(() => fullAt(core, ix, n - 1, scope, false), [core, ix, scope]);
  const dataset = useMemo(() => fullAt(core, ix, cur, scope), [core, ix, cur, scope]);
  const series = useMemo(() => growth(ix, scope), [ix, scope]);
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value })),
    [setSettings],
  );
  const communities = useMemo(
    () => dataset.communities.map((c) => ({ ...c, label: communityLabel(c, full.nodes) })),
    [dataset.communities, full, language],
  );
  const arcsNow = useMemo(
    () =>
      communities
        .map((c, i) => [i, c] as const)
        .filter(([, c]) => c.size > 0)
        .sort((a, b) => b[1].size - a[1].size),
    [communities],
  );
  const byId = useMemo(() => new Map(dataset.nodes.map((x) => [x.id, x])), [dataset]);
  const fullById = useMemo(() => new Map(full.nodes.map((x) => [x.id, x])), [full]);
  const maxMessages = useMemo(() => Math.max(10, ...full.nodes.map((x) => x.messages)), [full]);
  // The table opens on everyone with the most lines; the rest come in from the settings.
  const firstMin = (nodes: typeof full.nodes) => {
    if (nodes.length <= SHOWN) return 0;
    const sorted = nodes.map((x) => x.messages).sort((a, b) => b - a);
    return sorted[SHOWN - 1];
  };
  useEffect(() => {
    const wanted = [focus, ...(pair ?? [])].map((p) =>
      p === undefined ? Infinity : (full.nodes.find((x) => x.id === nodeId(p))?.messages ?? Infinity),
    );
    setSettings((s) => ({ ...s, mode: "network", minMessages: Math.min(firstMin(full.nodes), ...wanted), minWeight: 0, locked: false }));
    setResetKey((k) => k + 1);
  }, [full]);
  useEffect(() => {
    const target = selectedEdge
      ? fullStoryHash(selectedEdge.split("-").map(personOf) as [number, number])
      : selected
        ? fullStoryHash(personOf(selected))
        : fullStoryHash();
    if (location.hash !== target) history.replaceState(null, "", target);
  }, [selected, selectedEdge]);
  const go = useCallback((v: number) => setCur(Math.max(0, Math.min(n - 1, Math.round(v)))), [n]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCur((c) => {
        if (c >= n - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 900);
    return () => clearInterval(timer);
  }, [playing, n]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (cur >= n - 1) go(0);
    setPlaying(true);
  };
  const keys = useRef({ play, cur });
  keys.current = { play, cur };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("dialog")) return;
      if (e.key === "Escape") {
        setSelected(null);
        setSelectedEdge(null);
        return;
      }
      if ((e.target as HTMLElement).closest('input:not([type="range"]),select,textarea,button,a,[role="button"],summary')) return;
      if (e.code === "Space") {
        e.preventDefault();
        keys.current.play();
      } else if ((e.target as HTMLElement).matches('input[type="range"]')) {
        // The slider moves by itself.
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        go(keys.current.cur + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        go(keys.current.cur - 1);
      } else if (e.key === "r" || e.key === "R") setResetKey((k) => k + 1);
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, [go]);
  const layoutBase = useMemo(() => full.nodes.filter((x) => x.messages >= settings.minMessages), [full, settings.minMessages]);
  const layoutIds = useMemo(() => new Set(layoutBase.map((x) => x.id)), [layoutBase]);
  const layoutBaseEdges = useMemo(
    () => full.edges.filter((e) => layoutIds.has(e.source) && layoutIds.has(e.target)),
    [full, layoutIds],
  );
  // A person stays on the table once their relations form, whatever they have said by then.
  const baseNodes = useMemo(
    () => dataset.nodes.filter((x) => layoutIds.has(x.id) && (community < 0 || x.community === community)),
    [dataset, layoutIds, community],
  );
  const hiddenByMessages = full.nodes.length - layoutBase.length;
  const baseEdges = useMemo(() => {
    const ids = new Set(baseNodes.map((x) => x.id));
    return dataset.edges.filter((e) => ids.has(e.source) && ids.has(e.target) && e.weight >= settings.minWeight);
  }, [dataset, baseNodes, settings.minWeight]);
  const egoCenter = selected || [...baseNodes].sort((a, b) => b.degree - a.degree)[0]?.id || null;
  const ego = settings.mode === "ego" && !!egoCenter;
  const layoutNodes = useMemo(() => {
    if (!ego) return layoutBase;
    const ids = neighborhood(egoCenter!, layoutBaseEdges, settings.hops);
    return layoutBase.filter((x) => ids.has(x.id));
  }, [ego, egoCenter, layoutBase, layoutBaseEdges, settings.hops]);
  const layoutEdges = useMemo(() => {
    if (!ego) return layoutBaseEdges;
    const ids = new Set(layoutNodes.map((x) => x.id));
    return layoutBaseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [ego, layoutNodes, layoutBaseEdges]);
  const visibleNodes = useMemo(() => {
    if (!ego) return baseNodes;
    const ids = neighborhood(egoCenter!, baseEdges, settings.hops);
    return baseNodes.filter((x) => ids.has(x.id));
  }, [ego, baseNodes, baseEdges, settings.hops, egoCenter]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((x) => x.id));
    return baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [visibleNodes, baseEdges]);
  const list = useMemo(
    () =>
      baseNodes
        .filter((x) =>
          (x.name + " " + x.en + " " + nodeName(x)).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
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
    const x = fullById.get(id);
    if (!x) return;
    if (community >= 0 && byId.get(id)?.community !== community) setCommunity(-1);
    if (x.messages < settings.minMessages) update("minMessages", x.messages);
    setSelected(id);
    setSelectedEdge(null);
    setPanelOpen(true);
    if (panelTab === "settings") setPanelTab("nodes");
  };
  const chooseEdge = (id: string) => {
    setSelectedEdge(id);
    setSelected(id.split("-")[0]);
    setPanelOpen(true);
    if (panelTab === "settings") setPanelTab("nodes");
  };
  const clearDetails = () => {
    setSelected(null);
    setSelectedEdge(null);
  };
  const resetFilters = () => {
    setCommunity(-1);
    setQuery("");
    setSettings((s) => ({ ...s, minMessages: 0, minWeight: 0, mode: "network" }));
    clearDetails();
  };
  const title = t("全剧情总表", "The full story");
  const scopeName = (s: Scope) =>
    s === "all" ? t("主线 + 活动", "Main story + events") : s === "main" ? t("主线", "Main story") : t("活动", "Events");
  const storyLabel = (t0: number) => {
    const meta = metaOf(t0);
    return `${archiveCode(meta)} · ${archiveTitle(meta)}`;
  };
  const position = (t0: number) => t(`第 ${t0 + 1} / ${n} 个故事`, `story ${t0 + 1} of ${n}`);
  const doExport = () => {
    try {
      exportGraph(settings, { id: "fullstory", title });
      onToast(t("已导出 SVG 图片", "SVG image exported"));
    } catch {
      onToast(t("导出未完成，请重新打开图谱后重试", "Export failed. Reopen the graph and try again"));
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
        ? [t("敌对", "Hostile"), t("中性", "Neutral"), t("友善", "Friendly")].map((l, i) => [l, scaleColors.affect[i]])
        : settings.coloring === "power"
          ? [t("顺从", "Submissive"), t("中性", "Neutral"), t("主导", "Dominant")].map((l, i) => [l, scaleColors.power[i]])
          : null;
  // Main-story chapters split the timeline, as scenes do in a story.
  const chapters = useMemo(
    () => ix.category.flatMap((c, t0) => (c === "主线" && t0 > 0 ? [t0 + 1] : [])),
    [ix],
  );
  const formedAt = useMemo(() => {
    const out = new Array(n).fill(0),
      turns = new Array(n).fill(0);
    ix.rows.forEach((rows, p) => {
      for (const r of rows) if (scope === "all" || ix.category[r[T]] === (scope === "main" ? "主线" : "活动")) out[r[T]]++;
      for (const s of turnsOf(ix, p, scope)) turns[s]++;
    });
    return { values: out, turns };
  }, [ix, scope]);
  const timeline: Timeline = {
    m: n,
    cur: cur + 1,
    position: (p) => storyLabel(p - 1),
    onSeek: (p) => {
      setPlaying(false);
      go(p - 1);
    },
  };
  const describe = (p: number) => [
    <b key="n">{t(`${num(series[p - 1]?.n ?? 0)} 条关系`, plural("relation", series[p - 1]?.n ?? 0))}</b>,
    <span key="s">{storyLabel(p - 1)}</span>,
    <small key="p">{position(p - 1)}</small>,
  ];
  const edge = selectedEdge
    ? (dataset.edges.find((e) => e.id === selectedEdge) ?? full.edges.find((e) => e.id === selectedEdge))
    : null;
  const shownEdge =
    edge && dataset.edges.some((e) => e.id === edge.id) ? edge : edge ? { ...edge, ab: null, ba: null, events: 0, weight: 0 } : null;
  const nodeOf = (id: string) => byId.get(id) ?? fullById.get(id);
  const detailNode = selected ? nodeOf(selected) : null;
  const tabs: [Tab, string, typeof Orbit, string | number | null][] = [
    ["stories", t("故事", "Stories"), ListTree, n],
    ["nodes", t("角色", "Cast"), Orbit, dataset.nodes.length],
    ["settings", t("设置", "Display"), SlidersHorizontal, null],
  ];
  const showDetail = panelTab !== "settings" && (!!shownEdge || !!detailNode);
  const noReport = () => onToast(t("请在对应剧情的图谱里提交纠错", "Report errors from the story's own graph"));
  const storyList = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    const el = storyList.current?.querySelector<HTMLElement>(".event-row.now");
    const box = storyList.current;
    if (!el || !box) return;
    const offset = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({
      top: offset - Math.min(box.clientHeight * 0.3, 160),
      behavior: scrolled.current && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto",
    });
    scrolled.current = true;
  }, [cur, panelTab, showDetail]);
  return (
    <>
      <main id="main-content" tabIndex={-1} className={"explorer route-surface fullstory " + (!panelOpen ? "panel-collapsed" : "")}>
        <section className="canvas-section" aria-label={t("全剧情关系图谱", "Full-story relation graph")}>
          <div className="canvas-heading">
            <div className="workbench-breadcrumb">
              <a href="#archives">
                <ArrowLeft size={13} /> {t("剧情目录", "Stories")}
              </a>
              <span>/</span>
              <span>{t("总览 · ", "Overview · ") + scopeName(scope)}</span>
            </div>
            <h1>{title}</h1>
            <p>
              {ego && nodeOf(egoCenter!)
                ? t(nodeName(nodeOf(egoCenter!)!) + " 的关系圈", nodeName(nodeOf(egoCenter!)!) + "'s circle")
                : t(
                    `${visibleNodes.length} 名角色 · ${visibleEdges.length} 组关系`,
                    `${plural("character", visibleNodes.length)} · ${plural("relation", visibleEdges.length)}`,
                  )}
              <i />
              {cur >= n - 1 ? t("全部剧情结束时", "after every story") : t("截至 ", "as of ") + storyLabel(cur)}
            </p>
          </div>
          <div className="view-switch" role="group" aria-label={t("视图", "View")}>
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
              <Select aria-label={t("关系圈范围", "Circle range")} value={settings.hops} onChange={(e) => update("hops", +e.target.value)}>
                <option value={1}>{t("直接相关", "Direct ties")}</option>
                <option value={2}>{t("再往外一层", "Two steps out")}</option>
              </Select>
            )}
            <Select
              aria-label={t("剧情分类", "Story type")}
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as Scope);
                setCommunity(-1);
                clearDetails();
              }}
            >
              <option value="all">{t("全部", "All")}</option>
              <option value="main">{t("主线", "Main story")}</option>
              <option value="event">{t("活动", "Events")}</option>
            </Select>
          </div>
          <Graph
            nodes={visibleNodes}
            edges={visibleEdges}
            layoutNodes={layoutNodes}
            layoutEdges={layoutEdges}
            fresh={dataset.fresh}
            communities={communities}
            settings={settings}
            selected={settings.mode === "ego" ? egoCenter : selected}
            onSelect={choose}
            onEdge={chooseEdge}
            onBackground={() => {
              clearDetails();
              if (settings.mode === "ego") update("mode", "network");
            }}
            onAnimate={() => update("animate", !settings.animate)}
            resetKey={resetKey}
          />
          {!visibleNodes.length && (
            <div className="empty-graph quiet-empty">
              <Orbit size={32} />
              <h2>
                {layoutBase.length
                  ? t("这个故事之前还没有形成关系", "No relation has formed yet")
                  : t("没有符合条件的角色", "No characters match")}
              </h2>
              <p>
                {layoutBase.length
                  ? t("向后拖动时间轴，或按播放。", "Drag the timeline on, or press play.")
                  : t("当前筛选条件下没有角色。", "No one passes the current filters.")}
              </p>
              {!layoutBase.length && (
                <button className="wide-button" onClick={resetFilters}>
                  {t("清除筛选", "Clear filters")}
                </button>
              )}
            </div>
          )}
          <button
            className="panel-toggle"
            aria-label={panelOpen ? t("收起侧栏", "Hide sidebar") : t("展开侧栏", "Show sidebar")}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
          <div className="canvas-bottom">
            <div className="story-timeline">
              <div className="timeline-controls">
                <button
                  aria-label={t("回到第一个故事", "Back to the first story")}
                  onClick={() => {
                    setPlaying(false);
                    go(0);
                  }}
                >
                  <SkipBack size={14} />
                </button>
                <button
                  aria-label={t("上一个故事", "Previous story")}
                  onClick={() => {
                    setPlaying(false);
                    go(cur - 1);
                  }}
                >
                  <StepBack size={14} />
                </button>
                <button className="timeline-play" aria-label={playing ? t("暂停", "Pause") : t("按故事播放", "Play story by story")} onClick={play}>
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  aria-label={t("下一个故事", "Next story")}
                  onClick={() => {
                    setPlaying(false);
                    go(cur + 1);
                  }}
                >
                  <StepForward size={14} />
                </button>
              </div>
              <div className="timeline-body">
                <div className="timeline-now-line">
                  <span className="timeline-pos">{position(cur)}</span>
                  <b>{storyLabel(cur)}</b>
                  <span className="timeline-count">{t(`${num(stats.relations)} 条关系`, plural("relation", stats.relations))}</span>
                </div>
                <TimelineCurve series={series} m={n} cur={cur + 1} scenes={chapters} describe={describe} onSeek={timeline.onSeek} />
                <input
                  className="timeline-range"
                  type="range"
                  min={0}
                  max={n - 1}
                  value={cur}
                  aria-label={t("故事位置", "Story")}
                  aria-valuetext={storyLabel(cur)}
                  style={{ "--range": `${(cur / Math.max(1, n - 1)) * 100}%` } as React.CSSProperties}
                  onChange={(e) => {
                    setPlaying(false);
                    go(+e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="legend">
              {legend
                ? legend.map(([label, color]) => (
                    <span key={label} className="legend-item">
                      <i style={{ background: color }} />
                      {label}
                    </span>
                  ))
                : arcsNow.slice(0, 10).map(([i, c]) => (
                    <button
                      key={i}
                      className={community === i ? "active" : ""}
                      aria-pressed={community === i}
                      onClick={() => {
                        setCommunity(community === i ? -1 : i);
                        clearDetails();
                      }}
                    >
                      <i style={{ background: nodeColor(i, communities, settings.palette) }} />
                      {c.label}
                    </button>
                  ))}
              <span className="legend-item legend-fresh">
                <i />
                {t("这个故事里出现或变化的关系", "Formed or changed in this story")}
              </span>
            </div>
            <div className="canvas-help">
              <span>
                {settings.locked ? t("节点已锁定", "Nodes locked") : t("拖拽节点 / 平移画布", "Drag nodes / pan")} ·{" "}
                {t("滚轮或双指缩放", "Wheel or pinch to zoom")}
              </span>
              <span>
                <kbd>{t("空格", "Space")}</kbd> {t("按故事播放 / 暂停", "plays story by story")}
                <kbd>← →</kbd> {t("上一个 / 下一个故事", "steps through stories")}
                <kbd>ESC</kbd> {t("取消选择", "deselects")}
              </span>
            </div>
          </div>
        </section>
        <aside className="side-panel" aria-label={t("图谱侧栏", "Graph sidebar")}>
          <div className="workbench-context">
            <a href="#" aria-label={t("返回首页", "Back to home")}>
              <Orbit size={17} />
              <span>{t("方舟关系图谱", "Arknights SNA")}</span>
            </a>
            <LangSwitch />
          </div>
          <div className="sidebar-tabs three" role="tablist" aria-label={t("侧栏", "Sidebar")}>
            {tabs.map(([key, label, Icon, count], i) => (
              <button
                key={key}
                id={key + "-tab"}
                role="tab"
                aria-controls="sidebar-pane"
                aria-selected={panelTab === key}
                tabIndex={panelTab === key ? 0 : -1}
                onClick={() => {
                  if (key !== "settings") clearDetails();
                  setPanelTab(key);
                }}
                onKeyDown={(e) => {
                  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                  if (!step) return;
                  const nextTab = tabs[(i + step + tabs.length) % tabs.length][0];
                  setPanelTab(nextTab);
                  document.getElementById(nextTab + "-tab")?.focus();
                }}
              >
                <Icon size={13} /> {label} {count !== null && <span>{count}</span>}
              </button>
            ))}
          </div>
          <div
            className="sidebar-page"
            id="sidebar-pane"
            role="tabpanel"
            aria-labelledby={panelTab + "-tab"}
            key={panelTab + (showDetail ? "-detail" : "")}
          >
            {panelTab === "settings" ? (
              <Controls
                settings={settings}
                maxMessages={maxMessages}
                update={update}
                setAll={(s) => setSettings(() => s)}
                onExport={doExport}
                onReset={() => {
                  setSettings(() => ({ ...defaults, minMessages: firstMin(full.nodes) }));
                  setResetKey((k) => k + 1);
                  onToast(t("已恢复默认设置", "Settings reset"));
                }}
              />
            ) : shownEdge ? (
              <div className="detail-scroll" key={shownEdge.id}>
                <EdgeDetail
                  edge={shownEdge}
                  byId={new Map([...fullById, ...byId])}
                  history={(() => {
                    const [, , ab, ba] = ix.edges.get(shownEdge.id)!;
                    return { ab: historyRows(ix, ab, scope), ba: historyRows(ix, ba, scope) };
                  })()}
                  timeline={timeline}
                  pairHref={personHash(personOf(shownEdge.source), personOf(shownEdge.target))}
                  onBack={clearDetails}
                  onSelect={choose}
                  onReport={noReport}
                  across
                />
                {(() => {
                  const [a, b, ab, ba] = ix.edges.get(shownEdge.id)!;
                  const marks = [
                    ...turnsOf(ix, ab, scope).map((s) => [a, b, s] as const),
                    ...turnsOf(ix, ba, scope).map((s) => [b, a, s] as const),
                  ].sort((x, y) => x[2] - y[2]);
                  return marks.length ? (
                    <div className="fs-turns">
                      <h3 className="mini-heading">{t("转折", "Turns")}</h3>
                      <p>
                        {t(
                          "这个故事里的关系和此前明显不同，截至值从这里重新开始算。",
                          "The relation in this story breaks clearly from the stories before; the value restarts here.",
                        )}
                      </p>
                      {marks.map(([x, y, s]) => (
                        <button key={x + "-" + s} className="text-button" onClick={() => timeline.onSeek(s + 1)}>
                          {nodeName(nodeOf(nodeId(x))!)} → {nodeName(nodeOf(nodeId(y))!)} · {storyLabel(s)}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ) : detailNode ? (
              <div className="detail-scroll" key={detailNode.id}>
                <NodeDetail
                  node={byId.get(detailNode.id) ?? { ...detailNode, degree: 0, betweenness: 0 }}
                  graphEdges={dataset.edges}
                  byId={byId}
                  communities={communities}
                  avatar={core.media.avatars[String(personOf(detailNode.id))]}
                  where={cur >= n - 1 ? t("全部剧情结束时", "after every story") : storyLabel(cur)}
                  personHref={personHash(personOf(detailNode.id))}
                  onBack={() => setSelected(null)}
                  onSelect={choose}
                  onEdge={chooseEdge}
                  onReport={noReport}
                  onEgo={() => {
                    update("mode", "ego");
                    update("hops", 1);
                  }}
                />
              </div>
            ) : panelTab === "stories" ? (
              <>
                <div className="panel-heading">
                  <span className="eyebrow">{t("全部剧情", "Every story")}</span>
                  <h2>
                    {n}
                    {t(" 个", " ")}
                    <em>{t("故事", "stories")}</em>
                  </h2>
                  <p>
                    {t(
                      "按剧情年代排列。点一个故事，关系网停在它结束时；每段关系取到这里为止各故事的值（按事件多少加权），遇到转折从转折处重新算。",
                      "In story order. Click a story and the network stops where it ends; each relation takes its values up to here, weighted by events, and restarts at a turn.",
                    )}
                  </p>
                </div>
                <div className="event-list" ref={storyList}>
                  {ix.data.stories.map((s, t0) => {
                    const meta = core.manifest.stories[s];
                    const state = t0 === cur ? "now" : t0 > cur ? "future" : "past";
                    const shownHere = scope === "all" || ix.category[t0] === (scope === "main" ? "主线" : "活动");
                    return (
                      <article key={t0} className={"event-row " + state + (shownHere ? "" : " fs-out")} aria-current={t0 === cur ? "step" : undefined}>
                        <button
                          type="button"
                          onClick={() => {
                            setPlaying(false);
                            go(t0);
                          }}
                        >
                          <span className="row-index">{String(t0 + 1).padStart(2, "0")}</span>
                          <span className="event-title">
                            {archiveTitle(meta)}
                            <small>
                              {archiveCode(meta)} ·{" "}
                              {t(`${formedAt.values[t0]} 条关系`, plural("relation", formedAt.values[t0]))}
                              {formedAt.turns[t0] ? t(` · ${formedAt.turns[t0]} 处转折`, ` · ${plural("turn", formedAt.turns[t0])}`) : ""}
                            </small>
                          </span>
                        </button>
                        {t0 === cur && (
                          <div className="event-summary">
                            <a className="text-button" href={storyHash(meta.id)}>
                              {t("打开这段剧情的图谱", "Open this story's graph")} <ArrowUpRight size={12} />
                            </a>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="panel-heading">
                  <span className="eyebrow">{t("角色列表", "Characters")}</span>
                  <h2>
                    {stats.nodes}
                    {t(" 名", " ")}
                    <em>{t("角色", "characters")}</em>
                  </h2>
                  <p>
                    {t(
                      "截至当前故事已有关系的具名角色。点击名字，查看人格画像和人际关系。",
                      "Named characters with a relation by this story. Click a name for their personality and relations.",
                    )}
                  </p>
                </div>
                <div className="network-stats" aria-label={t("网络概况", "Network overview")}>
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
                    <strong>{arcsNow.length}</strong>
                    <span>{t("个剧情块", "story arcs")}</span>
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
                              style={{ flex: stats.octants[k], background: octants[k].color }}
                            />
                          ) : null,
                        )}
                      </div>
                      <small>
                        {[...octantKeys]
                          .sort((a, b) => stats.octants[b] - stats.octants[a])
                          .slice(0, 3)
                          .map((k) => `${octantName(k)} ${Math.round((stats.octants[k] / octantTotal) * 100)}%`)
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
                      placeholder={t("搜索角色中文名或英文名…", "Search by English or Chinese name…")}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button aria-label={t("清空搜索", "Clear search")} onClick={() => setQuery("")}>
                        <X size={13} />
                      </button>
                    )}
                  </label>
                  <div className="filter-row">
                    <Select
                      aria-label={t("剧情块筛选", "Arc filter")}
                      value={community}
                      onChange={(e) => {
                        setCommunity(+e.target.value);
                        clearDetails();
                      }}
                    >
                      <option value={-1}>{t("全部剧情块", "All arcs")}</option>
                      {arcsNow.map(([i, c]) => (
                        <option value={i} key={i}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                    <Select aria-label={t("角色排序", "Sort characters")} value={sort} onChange={(e) => setSort(e.target.value)}>
                      <option value="degree">{t("按关系数", "By relations")}</option>
                      <option value="messages">{t("按发言数", "By lines")}</option>
                      <option value="betweenness">{t("按中介中心性", "By betweenness centrality")}</option>
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
                        : t("只含具名角色", "Named characters only")}
                    </span>
                    <span>{t(`共 ${list.length} 人`, plural("person", list.length, "people"))}</span>
                  </div>
                </div>
                <div className="node-list">
                  {list.map((x, i) => (
                    <button
                      key={x.id}
                      className="node-row"
                      onClick={() => choose(x.id)}
                      style={{ "--row-order": Math.min(i, 8) } as React.CSSProperties}
                    >
                      <span className="row-index">{(i + 1).toString().padStart(2, "0")}</span>
                      <span
                        className="node-symbol"
                        style={{ "--node-color": nodeColor(x.community, communities, settings.palette) } as React.CSSProperties}
                      >
                        <i />
                      </span>
                      <span className="row-name">
                        {nodeName(x)}
                        <small>{altName(x)}</small>
                      </span>
                      <span className="row-degree">
                        {sort === "messages" ? x.messages : sort === "betweenness" ? x.betweenness.toFixed(2) : x.degree}
                        <small>{sort === "messages" ? t("发言", "lines") : sort === "betweenness" ? t("中介", "betw.") : t("关系", "ties")}</small>
                      </span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                  {!list.length && (
                    <div className="list-empty">
                      <Search size={23} />
                      <p>{t("没有找到匹配的角色", "No matching characters")}</p>
                      <button className="text-button" onClick={resetFilters}>
                        {t("清除搜索与筛选", "Clear search and filters")}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </main>
      <footer className="workspace-footer">
        <span>
          <i className="status-dot" /> {t("总览", "Overview")} <b>{title}</b>
        </span>
        <span>
          {t(`${visibleNodes.length} 名角色`, plural("character", visibleNodes.length))} <i>/</i>{" "}
          {t(`${visibleEdges.length} 组关系`, plural("relation", visibleEdges.length))} <i>/</i>{" "}
          {t(`${arcsNow.length} 个剧情块`, plural("arc", arcsNow.length))}
        </span>
        <button onClick={doExport}>
          <Download size={12} /> {t("导出 SVG", "Export SVG")}
        </button>
      </footer>
    </>
  );
}
