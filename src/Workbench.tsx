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
  Flag,
  ListTree,
  ChartPie,
  Play,
  Pause,
  SkipBack,
  StepBack,
  StepForward,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
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
import { defaults, type Settings } from "./settings";
import { archiveCode, archiveTitle, newLabel } from "./archives";
import Graph from "./Graph";
import Controls from "./Controls";
import { NodeDetail, EdgeDetail, type Timeline } from "./Details";
import { EventsPane, ChartsPane } from "./StoryPanes";
import { TimelineCurve } from "./charts";
import { exportGraph } from "./export";
import type { ReportTarget } from "./report/report";
import type { Core } from "./model/load";
import { useStory } from "./model/load";
import { bisect, eventAt, indexStory, keeper } from "./model/model";
import { atlasAt, buildAtlas, edgeId, nodeId, personOf, type AtlasAt } from "./model/atlas";
import { personName, type Story } from "./model/catalog";
import { personHash, storyHash } from "./routes";
type Tab = "events" | "nodes" | "charts" | "settings";
const num = (n: number) => n.toLocaleString(locale());
const position = (pos: number, m: number) =>
  t(`第 ${num(pos)} / ${num(m)} 句`, `line ${num(pos)} of ${num(m)}`);
export type ReportRequest = { origin: ReportTarget; data: AtlasAt; story: Story };
export default function Workbench(props: {
  core: Core;
  story: Story;
  /** Neighbours in story order, for the previous / next links. */
  prev?: Story;
  next?: Story;
  focus?: number;
  pair?: [number, number];
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onReport: (r: ReportRequest) => void;
  onToast: (text: string) => void;
}) {
  const loaded = useStory(props.story.id);
  return loaded.data ? (
    <Loaded {...props} data={loaded.data} />
  ) : (
    <main id="main-content" tabIndex={-1} className="explorer route-surface">
      <section className="canvas-section">
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
      </section>
      <aside className="side-panel" />
    </main>
  );
}
function Loaded({
  core,
  story: meta,
  prev,
  next,
  focus,
  pair,
  settings,
  setSettings,
  onReport,
  onToast,
  data,
}: Parameters<typeof Workbench>[0] & { data: Parameters<typeof indexStory>[1] }) {
  const language = useLang();
  const story = useMemo(() => indexStory(meta, data), [meta, data]);
  const keep = useMemo(() => keeper(core.people, settings.named), [core, settings.named]);
  const atlas = useMemo(() => buildAtlas(core, story, keep), [core, story, keep]);
  const m = data.m;
  const [cur, setCur] = useState(m);
  const [playing, setPlaying] = useState(false);
  const [panelTab, setPanelTab] = useState<Tab>("events");
  const [selected, setSelected] = useState<string | null>(
    focus !== undefined ? nodeId(focus) : null,
  );
  const [selectedEdge, setSelectedEdge] = useState<string | null>(
    pair ? edgeId(pair[0], pair[1]) : null,
  );
  const [query, setQuery] = useState(""),
    [community, setCommunity] = useState(-1),
    [sort, setSort] = useState("degree"),
    [panelOpen, setPanelOpen] = useState(true),
    [resetKey, setResetKey] = useState(0);
  const dataset = useMemo(() => atlasAt(core, atlas, cur), [core, atlas, cur]);
  const full = atlas.full;
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    [setSettings],
  );
  const communities = useMemo(
    () =>
      dataset.communities.map((c) => ({
        ...c,
        label: communityLabel(c, full.nodes),
      })),
    [dataset.communities, full, language],
  );
  const byId = useMemo(() => new Map(dataset.nodes.map((n) => [n.id, n])), [dataset]);
  const fullById = useMemo(() => new Map(full.nodes.map((n) => [n.id, n])), [full]);
  const maxMessages = useMemo(
    () => Math.max(10, ...full.nodes.map((n) => n.messages)),
    [full],
  );
  // A new filter or story starts from the whole network, as before.
  const shown = useRef(full);
  useEffect(() => {
    // The selection from the address survives the first run (twice in strict mode).
    if (shown.current !== full) {
      setSelected(null);
      setSelectedEdge(null);
      shown.current = full;
    }
    setQuery("");
    setCommunity(-1);
    // A character or pair opened from a link stays visible even with few lines.
    const wanted = [focus, ...(pair ?? [])]
      .map((p) => (p === undefined ? Infinity : (full.nodes.find((n) => n.id === nodeId(p))?.messages ?? Infinity)));
    setSettings((s) => ({
      ...s,
      mode: "network",
      minMessages: Math.min(defaultMinMessages(full.nodes), ...wanted),
      minWeight: 0,
      locked: false,
    }));
    setResetKey((k) => k + 1);
  }, [full]);
  // Selections become links: copy the address to share a character or a pair.
  useEffect(() => {
    const target = selectedEdge
      ? storyHash(meta.id, selectedEdge.split("-").map(personOf) as [number, number])
      : selected
        ? storyHash(meta.id, personOf(selected))
        : storyHash(meta.id);
    if (location.hash !== target) history.replaceState(null, "", target);
  }, [selected, selectedEdge, meta.id]);
  const go = useCallback(
    (v: number) => setCur(Math.max(1, Math.min(m, Math.round(v)))),
    [m],
  );
  const stops = atlas.stops;
  const nextStop = () => {
    const i = bisect(stops, cur, (v) => v);
    return i < stops.length ? stops[i] : null;
  };
  const prevStop = () => {
    const i = bisect(stops, cur - 1, (v) => v);
    return i > 0 ? stops[i - 1] : 1;
  };
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCur((c) => {
        const i = bisect(stops, c, (v) => v);
        if (i >= stops.length) {
          setPlaying(false);
          return m;
        }
        return stops[i];
      });
    }, 460);
    return () => clearInterval(timer);
  }, [playing, stops, m]);
  const play = () => {
    if (playing) return setPlaying(false);
    if (!nextStop()) go(1);
    setPlaying(true);
  };
  const keys = useRef({ play, nextStop, prevStop });
  keys.current = { play, nextStop, prevStop };
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
          'input:not([type="range"]),select,textarea,button,a,[role="button"],summary',
        )
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        keys.current.play();
      } else if ((e.target as HTMLElement).matches('input[type="range"]')) {
        // The slider moves by itself.
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        const n = keys.current.nextStop();
        if (n) go(n);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        go(keys.current.prevStop());
      } else if (e.key === "r" || e.key === "R") setResetKey((k) => k + 1);
    };
    addEventListener("keydown", handler);
    return () => removeEventListener("keydown", handler);
  }, [go]);
  const inScope = (n: { community: number; messages: number }) =>
    (community < 0 || n.community === community) && n.messages >= settings.minMessages;
  const layoutBase = useMemo(() => full.nodes.filter(inScope), [full, community, settings.minMessages]);
  const layoutBaseEdges = useMemo(() => {
    const ids = new Set(layoutBase.map((n) => n.id));
    return full.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [full, layoutBase]);
  const baseNodes = useMemo(
    () => dataset.nodes.filter(inScope),
    [dataset, community, settings.minMessages],
  );
  const hiddenByMessages = useMemo(
    () =>
      full.nodes.filter(
        (n) => (community < 0 || n.community === community) && n.messages < settings.minMessages,
      ).length,
    [full, community, settings.minMessages],
  );
  const baseEdges = useMemo(() => {
    const ids = new Set(baseNodes.map((n) => n.id));
    return dataset.edges.filter(
      (e) => ids.has(e.source) && ids.has(e.target) && e.weight >= settings.minWeight,
    );
  }, [dataset, baseNodes, settings.minWeight]);
  const egoCenter =
    selected ||
    [...layoutBase].sort((a, b) => b.degree - a.degree)[0]?.id ||
    null;
  const ego = settings.mode === "ego" && !!egoCenter;
  const layoutNodes = useMemo(() => {
    if (!ego) return layoutBase;
    const ids = neighborhood(egoCenter!, layoutBaseEdges, settings.hops);
    return layoutBase.filter((n) => ids.has(n.id));
  }, [ego, egoCenter, layoutBase, layoutBaseEdges, settings.hops]);
  const layoutEdges = useMemo(() => {
    if (!ego) return layoutBaseEdges;
    const ids = new Set(layoutNodes.map((n) => n.id));
    return layoutBaseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [ego, layoutNodes, layoutBaseEdges]);
  const visibleNodes = useMemo(() => {
    if (!ego) return baseNodes;
    const ids = neighborhood(egoCenter!, baseEdges, settings.hops);
    return baseNodes.filter((n) => ids.has(n.id));
  }, [ego, baseNodes, baseEdges, settings.hops, egoCenter]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleNodes.map((n) => n.id));
    return baseEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }, [visibleNodes, baseEdges]);
  const list = useMemo(
    () =>
      baseNodes
        .filter((n) =>
          (n.name + " " + n.en + " " + nodeName(n))
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
    const n = fullById.get(id);
    if (!n) return;
    if (community >= 0 && n.community !== community) setCommunity(-1);
    if (n.messages < settings.minMessages) update("minMessages", n.messages);
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
  const title = archiveTitle(meta);
  const code = archiveCode(meta);
  const doExport = () => {
    try {
      exportGraph(settings, { id: meta.id, title });
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
  const now = eventAt(story, cur);
  const nowEvent = now >= 0 ? data.ev[now] : null;
  const scenes = useMemo(() => {
    const out: number[] = [];
    let last = -1;
    for (const e of data.ev) if (e[2] !== last) {
      if (last >= 0) out.push(e[0]);
      last = e[2];
    }
    return out;
  }, [data]);
  const timeline: Timeline = {
    m,
    cur,
    position: (p) => position(p, m),
    onSeek: (p) => {
      setPlaying(false);
      go(p);
    },
  };
  const describe = (p: number) => {
    const n = atlas.series[bisect(atlas.series, p, (s) => s.pos) - 1]?.n ?? 0;
    const e = data.ev[eventAt(story, p)];
    return [
      <b key="n">{t(`${num(n)} 条关系`, plural("relation", n))}</b>,
      e ? <span key="e">{e[3]}</span> : null,
      <small key="p">{position(p, m)}</small>,
    ].filter(Boolean);
  };
  const name = (p: number) => personName(core, p);
  const edge = selectedEdge ? dataset.edges.find((e) => e.id === selectedEdge) ?? full.edges.find((e) => e.id === selectedEdge) : null;
  const shownEdge = edge && dataset.edges.some((e) => e.id === edge.id) ? edge : edge ? { ...edge, ab: null, ba: null, events: 0, weight: 0 } : null;
  const nodeOf = (id: string) => byId.get(id) ?? fullById.get(id);
  const detailNode = selected ? nodeOf(selected) : null;
  const tabs: [Tab, string, typeof Orbit, string | number | null][] = [
    ["events", t("事件", "Events"), ListTree, data.ev.length],
    ["nodes", t("角色", "Cast"), Orbit, dataset.nodes.length],
    ["charts", t("图表", "Charts"), ChartPie, null],
    ["settings", t("设置", "Display"), SlidersHorizontal, null],
  ];
  const showDetail = panelTab !== "settings" && (!!shownEdge || !!detailNode);
  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className={"explorer route-surface " + (!panelOpen ? "panel-collapsed" : "")}
      >
        <section className="canvas-section" aria-label={t(title + "关系图谱", "Relation graph: " + title)}>
          <div className="canvas-heading">
            <div className="workbench-breadcrumb">
              <a href="#archives">
                <ArrowLeft size={13} /> {t("剧情目录", "Stories")}
              </a>
              <span>/</span>
              <span>{code}</span>
              {meta.new && <span className="new-mark">{newLabel(meta.new)}</span>}
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
              {cur >= m ? t("剧情结束时", "as the story ends") : position(cur, m)}
            </p>
            <nav className="story-steps" aria-label={t("相邻剧情", "Neighbouring stories")}>
              {prev && (
                <a href={storyHash(prev.id)} title={archiveTitle(prev)}>
                  <ChevronLeft size={12} /> {t("上一段", "Previous")}
                </a>
              )}
              {next && (
                <a href={storyHash(next.id)} title={archiveTitle(next)}>
                  {t("下一段", "Next")} <ChevronRight size={12} />
                </a>
              )}
            </nav>
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
              <Select
                aria-label={t("关系圈范围", "Circle range")}
                value={settings.hops}
                onChange={(e) => update("hops", +e.target.value)}
              >
                <option value={1}>{t("直接相关", "Direct ties")}</option>
                <option value={2}>{t("再往外一层", "Two steps out")}</option>
              </Select>
            )}
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
              // A plain click on empty canvas returns to the whole network.
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
                  ? t("这个位置还没有形成关系", "No relation has formed yet")
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
          <button
            className="report-cta"
            onClick={() => onReport({ origin: { kind: "none" }, data: dataset, story: meta })}
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
          <div className="canvas-bottom">
            <div className="story-timeline">
              <div className="timeline-controls">
                <button
                  aria-label={t("回到开头", "Back to the start")}
                  onClick={() => {
                    setPlaying(false);
                    go(1);
                  }}
                >
                  <SkipBack size={14} />
                </button>
                <button
                  aria-label={t("上一个变化", "Previous change")}
                  onClick={() => {
                    setPlaying(false);
                    go(prevStop());
                  }}
                >
                  <StepBack size={14} />
                </button>
                <button
                  className="timeline-play"
                  aria-label={playing ? t("暂停", "Pause") : t("播放剧情", "Play the story")}
                  onClick={play}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  aria-label={t("下一个变化", "Next change")}
                  onClick={() => {
                    setPlaying(false);
                    const n = nextStop();
                    if (n) go(n);
                  }}
                >
                  <StepForward size={14} />
                </button>
              </div>
              <div className="timeline-body">
                <div className="timeline-now-line">
                  <span className="timeline-pos">
                    {position(cur, m)}
                    {nowEvent && (
                      <>
                        <i>/</i>
                        {t(`场景 ${nowEvent[2] + 1}`, `scene ${nowEvent[2] + 1}`)}
                      </>
                    )}
                  </span>
                  <b>{nowEvent ? nowEvent[3] : t("剧情开始前", "Before the first event")}</b>
                  <span className="timeline-count">
                    {t(`${num(stats.relations)} 条关系`, plural("relation", stats.relations))}
                  </span>
                </div>
                <TimelineCurve
                  series={atlas.series}
                  m={m}
                  cur={cur}
                  scenes={scenes}
                  describe={describe}
                  onSeek={timeline.onSeek}
                />
                <input
                  className="timeline-range"
                  type="range"
                  min={1}
                  max={m}
                  value={cur}
                  aria-label={t("剧情位置", "Position in the story")}
                  aria-valuetext={position(cur, m)}
                  style={{ "--range": `${((cur - 1) / Math.max(1, m - 1)) * 100}%` } as React.CSSProperties}
                  onChange={(e) => timeline.onSeek(+e.target.value)}
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
                      <i style={{ background: nodeColor(i, communities, settings.palette) }} />
                      {c.label}
                    </button>
                  ))}
              <span className="legend-item legend-fresh">
                <i />
                {t("刚刚变化的关系", "Just changed")}
              </span>
            </div>
            <div className="canvas-help">
              <span>
                {settings.locked ? t("节点已锁定", "Nodes locked") : t("拖拽节点 / 平移画布", "Drag nodes / pan")} ·{" "}
                {t("滚轮或双指缩放", "Wheel or pinch to zoom")}
              </span>
              <span>
                <kbd>{t("空格", "Space")}</kbd> {t("播放 / 暂停剧情", "plays the story")}
                <kbd>← →</kbd> {t("上一个 / 下一个变化", "steps through changes")}
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
          <div className="sidebar-tabs four" role="tablist" aria-label={t("侧栏", "Sidebar")}>
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
                  setSettings(() => ({ ...defaults, minMessages: defaultMinMessages(full.nodes) }));
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
                    const p = atlas.pairs.get(shownEdge.id)!;
                    return { ab: p.ab, ba: p.ba };
                  })()}
                  timeline={timeline}
                  pairHref={personHash(personOf(shownEdge.source), personOf(shownEdge.target))}
                  onBack={clearDetails}
                  onSelect={choose}
                  onReport={(origin) => onReport({ origin, data: dataset, story: meta })}
                />
              </div>
            ) : detailNode ? (
              <div className="detail-scroll" key={detailNode.id}>
                <NodeDetail
                  node={byId.get(detailNode.id) ?? { ...detailNode, degree: 0, betweenness: 0 }}
                  graphEdges={dataset.edges}
                  byId={byId}
                  communities={communities}
                  avatar={core.media.avatars[String(personOf(detailNode.id))]}
                  where={cur >= m ? t("结尾", "its end") : position(cur, m)}
                  personHref={personHash(personOf(detailNode.id))}
                  onBack={() => setSelected(null)}
                  onSelect={choose}
                  onEdge={chooseEdge}
                  onReport={(origin) => onReport({ origin, data: dataset, story: meta })}
                  onEgo={() => {
                    update("mode", "ego");
                    update("hops", 1);
                  }}
                />
              </div>
            ) : panelTab === "events" ? (
              <EventsPane
                story={story}
                cur={cur}
                now={now}
                name={name}
                onJump={(i) => {
                  setPlaying(false);
                  go(data.ev[i][1]);
                }}
                onPerson={(p) => choose(nodeId(p))}
              />
            ) : panelTab === "charts" ? (
              <ChartsPane data={dataset} byId={byId} onEdge={chooseEdge} />
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
                      "跟随时间轴，只列出此刻已有关系的角色。点击名字，查看人格画像和人际关系。",
                      "Follows the timeline: only characters with a relation by now. Click a name for their personality and relations.",
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
                      aria-label={t("社群筛选", "Community filter")}
                      value={community}
                      onChange={(e) => {
                        setCommunity(+e.target.value);
                        clearDetails();
                      }}
                    >
                      <option value={-1}>{t("全部社群", "All communities")}</option>
                      {communities.map((c, i) => (
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
                        : settings.named
                          ? t("只含具名角色", "Named characters only")
                          : t("全部角色", "Everyone")}
                    </span>
                    <span>{t(`共 ${list.length} 人`, plural("person", list.length, "people"))}</span>
                  </div>
                </div>
                <div className="node-list">
                  {list.map((n, i) => (
                    <button
                      key={n.id}
                      className="node-row"
                      onClick={() => choose(n.id)}
                      style={{ "--row-order": Math.min(i, 8) } as React.CSSProperties}
                    >
                      <span className="row-index">{(i + 1).toString().padStart(2, "0")}</span>
                      <span
                        className="node-symbol"
                        style={{ "--node-color": nodeColor(n.community, communities, settings.palette) } as React.CSSProperties}
                      >
                        <i />
                      </span>
                      <span className="row-name">
                        {nodeName(n)}
                        <small>{altName(n)}</small>
                      </span>
                      <span className="row-degree">
                        {sort === "messages" ? n.messages : sort === "betweenness" ? n.betweenness.toFixed(2) : n.degree}
                        <small>
                          {sort === "messages" ? t("发言", "lines") : sort === "betweenness" ? t("中介", "betw.") : t("关系", "ties")}
                        </small>
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
                <div className="panel-bottom">
                  <small>
                    {t("数值由大模型根据剧情对话推断，仅供参考。", "Values are a language model's estimates from the dialogue.")}
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
          {t(`${visibleNodes.length} 名角色`, plural("character", visibleNodes.length))} <i>/</i>{" "}
          {t(`${visibleEdges.length} 组关系`, plural("relation", visibleEdges.length))} <i>/</i>{" "}
          {t(
            `${new Set(visibleNodes.map((n) => n.community)).size} 个社群`,
            plural("community", new Set(visibleNodes.map((n) => n.community)).size, "communities"),
          )}
        </span>
        <button onClick={doExport}>
          <Download size={12} /> {t("导出 SVG", "Export SVG")}
        </button>
      </footer>
    </>
  );
}
