import { createPortal } from "react-dom";
import { gravityLeaders } from "./gravity";
import { memo, useCallback, useLayoutEffect, useState, useMemo, useRef, useEffect, type PointerEvent } from "react";
import { useCompact } from "./compact";
import { useLang } from "./useLang";
import { Plus, Minus, Maximize, Play, Pause, RotateCcw } from "lucide-react";
import {
  type AtlasNode,
  type AtlasEdge,
  type Community,
  degreeMap,
  isMutual,
  nodeName,
  octantName,
  primary,
} from "./data";
import { t } from "./i18n";
import { type Settings, palettes } from "./settings";
import { nodeColor, edgeColor } from "./colors";
import { makeLayout, curve, type Point } from "./layout";
import FlowField from "./FlowField";
import { contentAt, panFor, pinchView, startPinch, type Pinch } from "./pinch";
type Props = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  /**
   * The network the positions come from, when it differs from what is shown:
   * a story's network as it ends, so people keep their place while the
   * timeline adds and removes relations.
   */
  layoutNodes?: AtlasNode[];
  layoutEdges?: AtlasEdge[];
  /** Relations that just changed; they glow. */
  fresh?: Set<string>;
  communities: Community[];
  settings: Settings;
  selected: string | null;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  /** A click (not a drag) on empty canvas. */
  onBackground?: () => void;
  onAnimate: () => void;
  landing?: boolean;
  resetKey: number;
  flowTarget?: HTMLElement | null;
  /**
   * For networks far larger than a story's (the full-story table): no moving
   * particles on the relations and no blurred glow; a relation that just
   * changed is drawn brighter instead.
   */
  lite?: boolean;
  /** Positions laid out ahead of time (the full-story table): the network view uses them as they are. */
  fixed?: Map<string, Point>;
};
/** Screen pixels per scene unit on a phone: 15-unit labels stay near 11 px. */
const MIN_UNIT = 0.72;
export default function Graph({
  nodes,
  edges,
  layoutNodes = nodes,
  layoutEdges = edges,
  fresh,
  communities,
  settings,
  selected,
  onSelect,
  onEdge,
  onBackground,
  onAnimate,
  landing = false,
  resetKey,
  flowTarget,
  lite = false,
  fixed,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  // Names and labels follow the language.
  const language = useLang();
  const stage = useRef<HTMLDivElement>(null);
  const [fieldHost, setFieldHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!landing)
      setFieldHost(
        stage.current?.closest<HTMLElement>(".canvas-section") ?? null,
      );
  }, [landing]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Point>>({});
  const drag = useRef<{
    id: string | null;
    x: number;
    y: number;
    start: Point;
    distance: number;
    /** The relation a finger came down on, opened if the finger lifts without moving. */
    edge?: string | null;
  } | null>(null);
  const previous = useRef<Map<string, Point>>(new Map());
  // Phones: the scene takes the shape of the screen at a readable scale instead of a tiny 1000×760 letterbox,
  // and the layout is stretched to fill it. It follows the stage, so opening the panel reflows the graph.
  const compact = useCompact() && !landing;
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = stage.current;
    if (!compact || !el) return setStageSize(null);
    const measure = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      // A hidden stage (the panel at full height) keeps its last shape.
      if (w && h) setStageSize((old) => (old && old.w === w && old.h === h ? old : { w, h }));
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [compact]);
  const view = useMemo(() => {
    if (!stageSize) return { w: 1000, h: 760, sx: 1, sy: 1 };
    const unit = Math.max(MIN_UNIT, Math.min(stageSize.w / 1000, stageSize.h / 760));
    const w = stageSize.w / unit,
      h = stageSize.h / unit;
    // A little air around the stretched network, for the corner controls.
    const sx = (w / 1000) * 0.97,
      sy = (h / 760) * 0.9;
    // Rings stay round; a network can stretch.
    const round = settings.mode !== "network" || settings.layout === "circular";
    const s = Math.min(sx, sy);
    return { w, h, sx: round ? s : sx, sy: round ? s : sy };
  }, [stageSize, settings.mode, settings.layout]);
  const computed = useMemo(
    () =>
      fixed && settings.mode === "network"
        ? fixed
        : makeLayout(layoutNodes, layoutEdges, settings, selected, landing),
    [
      fixed,
      layoutNodes,
      layoutEdges,
      settings.layout,
      settings.mode,
      settings.hops,
      settings.gravity,
      settings.repulsion,
      settings.distance,
      settings.overlap,
      settings.weight,
      settings.mode === "ego" ? selected : null,
      resetKey,
    ],
  );
  const positions = useMemo(() => {
    if (!settings.locked || !previous.current.size) previous.current = computed;
    const next = new Map(computed);
    for (const n of layoutNodes) {
      const p = previous.current.get(n.id);
      if (p) next.set(n.id, p);
    }
    if (view.sx !== 1 || view.sy !== 1)
      for (const [id, p] of next)
        next.set(id, { x: 500 + (p.x - 500) * view.sx, y: 380 + (p.y - 380) * view.sy });
    return next;
  }, [computed, settings.locked, view.sx, view.sy]);
  // Curves bend by their place in the full network, so a relation keeps its
  // shape when others appear before it.
  const bend = useMemo(
    () => new Map(layoutEdges.map((e, i) => [e.id, i])),
    [layoutEdges],
  );
  useEffect(() => {
    setOverrides({});
    setPan({ x: 0, y: 0 });
    setZoom(compact ? fitZoom() : 1);
  }, [computed, resetKey]);
  useEffect(() => {
    if (settings.animate) svg.current?.unpauseAnimations();
    else svg.current?.pauseAnimations();
  }, [settings.animate]);
  const leaders = useMemo(
    () => gravityLeaders(nodes, edges, settings.gravityNodes),
    [nodes, edges, settings.gravityNodes],
  );
  const [displayPositions, setDisplayPositions] = useState(positions);
  const displayRef = useRef(positions);
  useEffect(() => {
    const from = displayRef.current;
    // A lite graph jumps: animating a thousand people redraws everything at every frame.
    if (!settings.animate || landing || lite || !from.size) {
      displayRef.current = positions;
      setDisplayPositions(positions);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = Math.min(1, (now - start) / 720);
      const ease = 1 - Math.pow(1 - t, 4);
      const next = new Map<string, Point>();
      for (const [id, target] of positions) {
        const old = from.get(id) || { x: 500, y: 380 };
        next.set(id, {
          x: old.x + (target.x - old.x) * ease,
          y: old.y + (target.y - old.y) * ease,
        });
      }
      displayRef.current = next;
      setDisplayPositions(next);
      if (t < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [positions, settings.animate, landing]);
  const point = (id: string) =>
    overrides[id] || displayPositions.get(id) || positions.get(id)!;
  const anchors = useMemo(
    () =>
      [
        ...leaders,
        ...(draggedId && !leaders.some((n) => n.id === draggedId)
          ? [{ id: draggedId, mass: 0.7 }]
          : []),
      ].map((n) => {
        const p =
          overrides[n.id] || displayPositions.get(n.id) || positions.get(n.id)!;
        return {
          x: (p.x - 500) * zoom + 500 + pan.x,
          y: (p.y - 380) * zoom + 380 + pan.y,
          mass: n.mass,
          id: n.id,
        };
      }),
    [leaders, draggedId, overrides, displayPositions, positions, pan, zoom],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const degrees = useMemo(() => degreeMap(edges), [edges]);
  const rank = useMemo(() => {
    const order = [...nodes].sort(
      (a, b) =>
        (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0) ||
        b.messages - a.messages,
    );
    return new Map(order.map((n, i) => [n.id, i]));
  }, [nodes, degrees]);
  const crowded = nodes.length > 70;
  const prominentCount = Math.max(3, Math.ceil(nodes.length * 0.08));
  const particleStep = edges.length > 400 ? Math.ceil(edges.length / 200) : 2;
  const focus = hover || selected;
  const connected = useMemo(
    () =>
      new Set(
        focus
          ? [
              focus,
              ...edges
                .filter((e) => e.source === focus || e.target === focus)
                .map((e) => (e.source === focus ? e.target : e.source)),
            ]
          : [],
      ),
    [focus, edges],
  );
  // A phone's stretched view may need to go further out to fit a big network.
  const clamp = (v: number) => Math.max(compact ? 0.12 : 0.3, Math.min(compact ? 4 : 2.5, v));
  /** Zoom that shows every node; the layout is centred on (500, 380). */
  const fitZoom = () => {
    let dx = 0,
      dy = 0;
    for (const p of positions.values()) {
      dx = Math.max(dx, Math.abs(p.x - 500));
      dy = Math.max(dy, Math.abs(p.y - 380));
    }
    return clamp(
      Math.min(1, (view.w / 2 - 60) / Math.max(1, dx), (view.h / 2 - 50) / Math.max(1, dy)),
    );
  };
  // Active touch / pen / mouse pointers in scene coordinates, for pinch zoom.
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  const coordinate = (e: { clientX: number; clientY: number }) => {
    const m = svg.current!.getScreenCTM();
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m!.inverse());
  };
  // On a phone's crowded graph a finger always lands on someone: moving it pans, and people stay put.
  const fixedNodes = compact && lite;
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const p = coordinate(e);
    if (!landing) {
      pointers.current.set(e.pointerId, { x: p.x, y: p.y });
      if (pointers.current.size >= 2) {
        // A second finger turns the gesture into a pinch: drop any drag.
        const [a, b] = [...pointers.current.values()];
        pinch.current = startPinch(a, b, { zoom, pan });
        drag.current = null;
        setDraggedId(null);
        svg.current!.setPointerCapture(e.pointerId);
        return;
      }
    }
    const el = (e.target as Element).closest("[data-node]");
    const id = el?.getAttribute("data-node") || null;
    if (landing && !id) return;
    if (id && !settings.locked && !fixedNodes) setDraggedId(id);
    drag.current = {
      id,
      x: p.x,
      y: p.y,
      start: id && !fixedNodes ? point(id) : pan,
      distance: 0,
      edge: id ? null : (e.target as Element).closest("[data-edge]")?.getAttribute("data-edge"),
    };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) {
      const at = coordinate(e);
      pointers.current.set(e.pointerId, { x: at.x, y: at.y });
    }
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const view = pinchView(pinch.current, a, b, clamp);
      setZoom(view.zoom);
      setPan(view.pan);
      return;
    }
    if (!drag.current) return;
    const p = coordinate(e),
      d = drag.current;
    const dx = p.x - d.x,
      dy = p.y - d.y;
    d.distance = Math.hypot(dx, dy);
    if (d.id && !settings.locked && !fixedNodes)
      setOverrides((old) => ({
        ...old,
        [d.id!]: { x: d.start.x + dx / zoom, y: d.start.y + dy / zoom },
      }));
    else if (!d.id || fixedNodes) setPan({ x: d.start.x + dx, y: d.start.y + dy });
  };
  const release = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    const pinching = !!pinch.current;
    release(e);
    if (pinching) return;
    const d = drag.current;
    // A finger shakes more than a mouse; the distance is in scene units.
    if (d && d.distance < (compact ? 14 : 5)) {
      if (d.id) onSelect(d.id);
      else if (d.edge) onEdge(d.edge);
      else onBackground?.();
    }
    drag.current = null;
    setDraggedId(null);
    setHover(null);
  };
  const color = (n: AtlasNode) =>
    nodeColor(n.community, communities, settings.palette);
  const linkColor = (e: AtlasEdge) =>
    edgeColor(e, settings.coloring, color(byId.get(e.source)!));
  const name = (id: string) => {
    const n = byId.get(id);
    return n ? nodeName(n) : "";
  };
  // Handlers reach the memoised rows through a ref, so a new callback from the parent redraws nothing.
  const handlers = useRef({ onSelect, onEdge });
  handlers.current = { onSelect, onEdge };
  const selectNode = useCallback((id: string) => handlers.current.onSelect(id), []);
  const selectEdge = useCallback((id: string) => handlers.current.onEdge(id), []);
  // A phone is a map: names keep their size while pinching and more of them appear closer in. Only named
  // people redraw, and only when the zoom crosses a step, so a pinch stays as cheap as the scene below intends.
  const labelZoom = compact ? Math.pow(1.15, Math.round(Math.log(zoom) / Math.log(1.15))) : 1;
  // Names shrink a little with a far-out view so more of them fit; closer in they keep their full size.
  const labelScale = compact ? Math.pow(Math.min(labelZoom, 1), 0.3) / labelZoom : 1;
  // Names that would collide give way, the selection and the best connected first; zooming in brings them back.
  const placed = useMemo(() => {
    const radial = settings.mode !== "ego" && (settings.layout === "circular" || settings.mode === "chord");
    if (!compact || radial || settings.allLabels || !settings.labels) return null;
    const order = [...nodes].sort(
      (a, b) =>
        Number(b.id === focus) - Number(a.id === focus) ||
        Number(connected.has(b.id)) - Number(connected.has(a.id)) ||
        rank.get(a.id)! - rank.get(b.id)!,
    );
    const boxes: [number, number, number, number][] = [];
    const kept = new Set<string>();
    for (const n of order) {
      const p = overrides[n.id] || displayPositions.get(n.id) || positions.get(n.id);
      if (!p) continue;
      const size = (rank.get(n.id)! < prominentCount ? 18 : 15) * settings.labelSize * labelScale * labelZoom;
      const width = [...nodeName(n)].reduce((w, c) => w + (c.charCodeAt(0) < 128 ? 0.55 : 1), 0) * size;
      const r = (4 + Math.sqrt(degrees.get(n.id) || 0) * 1.6) * settings.nodeSize;
      const x = (p.x - 500) * labelZoom,
        y = (p.y - 380 + r) * labelZoom + (7 + 12 * settings.labelSize) * labelScale * labelZoom;
      const box: [number, number, number, number] = [x - width / 2, y - size * 0.85, x + width / 2, y + size * 0.15];
      if (boxes.some((b) => box[0] < b[2] && b[0] < box[2] && box[1] < b[3] && b[1] < box[3])) continue;
      boxes.push(box);
      kept.add(n.id);
    }
    return kept;
  }, [compact, settings, nodes, focus, connected, rank, degrees, crowded, prominentCount, overrides, displayPositions, positions, labelZoom, labelScale, language]);
  // The scene does not depend on pan or zoom: moving the view only changes the outer transform, and a
  // timeline step redraws only the relations and people whose drawing changed.
  const scene = useMemo(() => {
    const glowId = landing ? "hero-glow" : "node-glow";
    const chord = settings.mode === "chord";
    const bg = palettes[settings.palette].bg;
    const radialLabel =
      !landing &&
      settings.mode !== "ego" &&
      (settings.layout === "circular" || settings.mode === "chord");
    const edgeEls = edges.map((e, order) => {
      const a = point(e.source),
        b = point(e.target);
      if (!a || !b) return null;
      const i = bend.get(e.id) ?? order;
      const active = !!focus && (e.source === focus || e.target === focus);
      const glowing = !!fresh?.has(e.id);
      const opacity = focus ? (active ? 0.9 : 0.06) : settings.opacity;
      const w =
        settings.width *
        (settings.weight === "equal"
          ? 1
          : settings.weight === "intensity"
            ? 0.5 + Math.max(e.ab?.intensity ?? 0, e.ba?.intensity ?? 0) * 2.2
            : 0.5 + e.weight * 1.8);
      const mutual = isMutual(e);
      return (
        <EdgeView
          key={e.id}
          id={e.id}
          a={a}
          b={b}
          i={i}
          chord={chord}
          color={linkColor(e)}
          w={w}
          opacity={opacity}
          lineOpacity={glowing ? Math.max(opacity, focus ? opacity : 0.85) : opacity}
          glowing={glowing}
          lite={lite}
          landing={landing}
          glowId={glowId}
          active={active}
          particle={!lite && (!focus || active) && i % particleStep === 0}
          speed={settings.speed}
          arrowAb={settings.arrows && !!e.ab ? (mutual ? 0.65 : 0.8) : 0}
          arrowBa={settings.arrows && !!e.ba ? (mutual ? 0.35 : 0.2) : 0}
          label={settings.edgeLabels && (!focus || active) ? octantName(primary(e).type) : null}
          ariaLabel={
            landing
              ? ""
              : t(
                  `${name(e.source)}与${name(e.target)}的关系`,
                  `Relation between ${name(e.source)} and ${name(e.target)}`,
                )
          }
          title={
            landing
              ? ""
              : `${name(e.source)} ${mutual ? "⇄" : e.ab ? "→" : "←"} ${name(e.target)} · ${octantName(primary(e).type)}`
          }
          onEdge={selectEdge}
        />
      );
    });
    const nodeEls = nodes.map((n) => {
      const p = point(n.id);
      if (!p) return null;
      const d = degrees.get(n.id) || 0,
        r = (4 + Math.sqrt(d) * 1.6) * settings.nodeSize;
      const isSelected = selected === n.id;
      const prominent = rank.get(n.id)! < prominentCount;
      const showLabel =
        focus === n.id ||
        isSelected ||
        (landing
          ? prominent
          : placed
            ? placed.has(n.id)
            : settings.labels &&
            (settings.allLabels ||
              !crowded ||
              rank.get(n.id)! < 45 ||
              (!!focus && connected.has(n.id))));
      return (
        <NodeView
          key={n.id}
          id={n.id}
          p={p}
          r={r}
          color={color(n)}
          bg={bg}
          isSelected={isSelected}
          prominent={prominent}
          showLabel={showLabel}
          muted={!!focus && !connected.has(n.id)}
          radialLabel={radialLabel}
          labelSize={settings.labelSize}
          labelScale={showLabel ? labelScale : 1}
          hitPad={compact ? 20 : 13}
          landing={landing}
          lite={lite}
          glow={nodes.length <= 160 || isSelected || prominent}
          glowId={glowId}
          orbit={settings.animate}
          name={nodeName(n)}
          en={landing && prominent && n.en && nodeName(n) !== n.en ? n.en.toUpperCase() : null}
          ariaLabel={`${nodeName(n)} · ${communities[n.community]?.label || ""} · ${t(`${d}组关系`, `${d} relations`)}`}
          onSelect={selectNode}
          onHover={setHover}
        />
      );
    });
    return (
      <>
        {edgeEls}
        {nodeEls}
      </>
    );
  }, [
    edges,
    nodes,
    overrides,
    displayPositions,
    positions,
    bend,
    focus,
    connected,
    fresh,
    selected,
    settings,
    landing,
    lite,
    particleStep,
    degrees,
    rank,
    prominentCount,
    crowded,
    communities,
    byId,
    language,
    selectEdge,
    selectNode,
    placed,
    labelScale,
    compact,
  ]);
  return (
    <div
      className={"graph-stage " + (landing ? "hero-graph" : "") + (lite ? " lite" : "")}
      data-testid="graph-stage"
      ref={stage}
    >
      {landing
        ? flowTarget &&
          createPortal(
            <FlowField
              settings={settings}
              anchors={anchors}
              anchorElement={svg}
            />,
            flowTarget,
          )
        : fieldHost &&
          createPortal(
            <FlowField
              settings={settings}
              subtle
              anchors={anchors}
              anchorElement={svg}
            />,
            fieldHost,
          )}
      <svg
        ref={svg}
        id={landing ? "hero-svg" : "network-svg"}
        viewBox={`${500 - view.w / 2} ${380 - view.h / 2} ${view.w} ${view.h}`}
        role="group"
        aria-label={t(
          "关系图：点击角色查看详情，点击空白处返回全图，拖拽平移，滚轮或双指缩放",
          "Relation graph: click a character for details, click empty space to return to the whole network, drag to pan, wheel or pinch to zoom",
        )}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(e) => {
          release(e);
          drag.current = null;
          setDraggedId(null);
          setHover(null);
        }}
        onWheel={(e) => {
          if (landing) return;
          // Zoom around the cursor rather than the scene centre.
          const at = coordinate(e);
          const next = clamp(zoom - e.deltaY * 0.001);
          setPan(panFor(contentAt(at, { zoom, pan }), at, next));
          setZoom(next);
        }}
      >
        <defs>
          <radialGradient id={landing ? "hero-halo" : "field-halo"}>
            <stop offset="0" stopColor="#d49d9c" stopOpacity=".12" />
            <stop offset="1" stopColor="#d49d9c" stopOpacity="0" />
          </radialGradient>
          <filter
            id={landing ? "hero-glow" : "node-glow"}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        <g
          transform={`translate(${pan.x} ${pan.y}) translate(500 380) scale(${zoom}) translate(-500 -380)`}
        >
          {leaders.map((n) => {
            const p = point(n.id);
            return p ? (
              <circle
                key={"halo-" + n.id}
                cx={p.x}
                cy={p.y}
                r={80 + n.mass * 22}
                opacity={
                  settings.flowOpacity * Math.min(1, settings.flowGravity)
                }
                fill={`url(#${landing ? "hero-halo" : "field-halo"})`}
                pointerEvents="none"
              />
            ) : null;
          })}
          {scene}
        </g>
      </svg>
      {!landing && (
        <>
          <div className="graph-corner">
            <span className="status-dot" />
            {settings.animate
              ? t("动效开启", "Motion on")
              : t("动效已暂停", "Motion paused")}
            <span className="corner-sep">/</span>
            {Math.round(zoom * 100)}%
          </div>
          <div className="graph-tools">
            <button
              aria-label={t("放大", "Zoom in")}
              onClick={() => setZoom((z) => clamp(z + 0.15))}
            >
              <Plus size={16} />
            </button>
            <button
              aria-label={t("缩小", "Zoom out")}
              onClick={() => setZoom((z) => clamp(z - 0.15))}
            >
              <Minus size={16} />
            </button>
            <i />
            <button
              aria-label={t("缩放到显示全图", "Zoom to fit")}
              title={t("显示全图", "Fit")}
              onClick={() => {
                setZoom(fitZoom());
                setPan({ x: 0, y: 0 });
              }}
            >
              <Maximize size={15} />
            </button>
            <button
              aria-label={t("重置节点位置", "Reset node positions")}
              onClick={() => setOverrides({})}
            >
              <RotateCcw size={15} />
            </button>
            <i />
            <button
              aria-label={
                settings.animate
                  ? t("暂停动效", "Pause motion")
                  : t("播放动效", "Play motion")
              }
              onClick={onAnimate}
            >
              {settings.animate ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
type EdgeProps = {
  id: string;
  a: Point;
  b: Point;
  i: number;
  chord: boolean;
  color: string;
  w: number;
  opacity: number;
  /** The relation's own line: a fresh one stands out unless someone is focused. */
  lineOpacity: number;
  glowing: boolean;
  lite: boolean;
  landing: boolean;
  glowId: string;
  active: boolean;
  particle: boolean;
  speed: number;
  /** Where along the curve each arrow sits, or 0 for none. */
  arrowAb: number;
  arrowBa: number;
  label: string | null;
  ariaLabel: string;
  title: string;
  onEdge: (id: string) => void;
};
/** One relation; it redraws only when its own drawing changes. */
const EdgeView = memo(function EdgeView({
  id,
  a,
  b,
  i,
  chord,
  color,
  w,
  opacity,
  lineOpacity,
  glowing,
  lite,
  landing,
  glowId,
  active,
  particle,
  speed,
  arrowAb,
  arrowBa,
  label,
  ariaLabel,
  title,
  onEdge,
}: EdgeProps) {
  const { path, c } = curve(a, b, i, chord);
  const arrows = [
    ...(arrowAb ? [[arrowAb, 0]] : []),
    ...(arrowBa ? [[arrowBa, 1]] : []),
  ];
  return (
    <g
      className={"relationship" + (glowing ? " fresh" : "")}
      style={{ color }}
    >
      {glowing && !lite && (
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={w + 4}
          className="relationship-glow"
          filter={`url(#${glowId})`}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={glowing ? w + (lite ? 1.2 : 0.6) : w}
        // stroke-opacity, not opacity: opacity gives every relation its own compositing step, and a
        // thousand of them make each frame slow.
        strokeOpacity={lineOpacity}
      />
      {!landing && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          className="edge-hit"
          role="button"
          tabIndex={0}
          data-edge={id}
          // A mouse click on a relation is only a click. A finger on one may be starting a pan or a pinch, and on
          // a dense graph nearly every touch lands on a relation; the graph sorts out which it was on release.
          onPointerDown={(e) => {
            if (e.pointerType === "mouse") e.stopPropagation();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onEdge(id);
            }
          }}
          aria-label={ariaLabel}
          onClick={() => onEdge(id)}
        >
          <title>{title}</title>
        </path>
      )}
      {particle && (
        <circle r={active ? 2 : 1.3} fill="currentColor" opacity={active ? 0.9 : 0.7}>
          <animateMotion
            dur={`${(8 + (i % 7)) / speed}s`}
            repeatCount="indefinite"
            path={path}
            begin={`-${i * 0.4}s`}
          />
        </circle>
      )}
      {arrows.length > 0 && (
        <g fill="currentColor" fillOpacity={opacity}>
          {arrows.map(([t, j]) => {
            const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
              y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y;
            const angle =
              (Math.atan2(
                (1 - t) * (c.y - a.y) + t * (b.y - c.y),
                (1 - t) * (c.x - a.x) + t * (b.x - c.x),
              ) *
                180) /
                Math.PI +
              (j ? 180 : 0);
            return (
              <path
                key={j}
                d="M-5 -2.5L1 0L-5 2.5Z"
                transform={`translate(${x} ${y}) rotate(${angle})`}
              />
            );
          })}
        </g>
      )}
      {label !== null && (
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 5}
          fill="currentColor"
          fontSize="12"
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
});
type NodeProps = {
  id: string;
  p: Point;
  r: number;
  color: string;
  bg: string;
  isSelected: boolean;
  prominent: boolean;
  showLabel: boolean;
  muted: boolean;
  radialLabel: boolean;
  labelSize: number;
  /** Undoes the view's zoom on a phone, so a name keeps its size on screen. */
  labelScale: number;
  /** Tap margin around the node. */
  hitPad: number;
  landing: boolean;
  lite: boolean;
  glow: boolean;
  glowId: string;
  orbit: boolean;
  name: string;
  en: string | null;
  ariaLabel: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};
/** One person; it redraws only when their own drawing changes. */
const NodeView = memo(function NodeView({
  id,
  p,
  r,
  color,
  bg,
  isSelected,
  prominent,
  showLabel,
  muted,
  radialLabel,
  labelSize,
  labelScale,
  hitPad,
  landing,
  lite,
  glow,
  glowId,
  orbit,
  name,
  en,
  ariaLabel,
  onSelect,
  onHover,
}: NodeProps) {
  const leftLabel = p.x < 500;
  const labelAngle =
    (Math.atan2(p.y - 380, p.x - 500) * 180) / Math.PI + (leftLabel ? 180 : 0);
  // Circles sit at the person's place directly rather than in a translated group: a transform (or an
  // opacity of 1) on each of a thousand groups makes every frame slow.
  const { x, y } = p;
  return (
    <g
      data-node={id}
      opacity={muted ? 0.22 : undefined}
      className="graph-node"
      role="button"
      tabIndex={landing ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      // On a crowded graph the pointer is nearly always over some node: hovering would dim and
      // redraw everything at every move, so a lite graph highlights on click only.
      onMouseEnter={lite ? undefined : () => onHover(id)}
      onMouseLeave={lite ? undefined : () => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(id);
        }
      }}
    >
      <circle cx={x} cy={y} r={r + hitPad} fill="transparent" />
      {glow && (
        <circle
          cx={x}
          cy={y}
          r={r * 2.2}
          fill={color}
          fillOpacity={isSelected ? 0.35 : 0.14}
          filter={`url(#${glowId})`}
        />
      )}
      {(prominent || isSelected) && (
        <circle
          cx={x}
          cy={y}
          r={r + 7}
          stroke={color}
          fill="none"
          strokeOpacity={isSelected ? 0.8 : 0.3}
          strokeWidth=".7"
        />
      )}
      {isSelected && (
        <circle
          cx={x}
          cy={y}
          className={orbit ? "selection-orbit" : ""}
          r={r + 14}
          stroke={color}
          fill="none"
          strokeOpacity=".55"
          strokeDasharray="3 7"
          strokeWidth=".8"
        />
      )}
      <circle cx={x} cy={y} r={r} fill={bg} stroke={color} strokeWidth={isSelected ? 1.8 : 1} />
      <circle cx={x} cy={y} r={r * 0.42} fill={color} />
      {showLabel && (
        <text
          x={x + (radialLabel ? (leftLabel ? -1 : 1) * (r + 12) : 0)}
          y={y + (radialLabel ? 5 : r + (7 + 12 * labelSize) * labelScale)}
          transform={radialLabel ? `rotate(${labelAngle} ${x} ${y})` : undefined}
          textAnchor={radialLabel ? (leftLabel ? "end" : "start") : "middle"}
          fontSize={(prominent ? 18 : 15) * labelSize * labelScale}
          fill={prominent ? "#eee0d0" : "#b9adaf"}
          fontFamily="Inter, Microsoft YaHei, sans-serif"
          style={{
            paintOrder: "stroke",
            stroke: bg,
            strokeWidth: 3 * labelScale,
          }}
        >
          {name}
        </text>
      )}
      {en && (
        <text
          x={x}
          y={y + r + 33}
          textAnchor="middle"
          fontSize="9.5"
          letterSpacing="1.3"
          fill="#8d8089"
        >
          {en}
        </text>
      )}
    </g>
  );
});
