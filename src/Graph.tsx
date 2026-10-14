import { createPortal } from "react-dom";
import { gravityLeaders } from "./gravity";
import { useState, useMemo, useRef, useEffect, type PointerEvent } from "react";
import { Plus, Minus, Maximize, Play, Pause, RotateCcw } from "lucide-react";
import {
  type AtlasNode,
  type AtlasEdge,
  type Community,
  degreeMap,
  isMutual,
  octants,
  primary,
} from "./data";
import { type Settings, palettes } from "./settings";
import { nodeColor, edgeColor } from "./colors";
import { makeLayout, curve, type Point } from "./layout";
import FlowField from "./FlowField";
import { contentAt, panFor, pinchView, startPinch, type Pinch } from "./pinch";
type Props = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  communities: Community[];
  settings: Settings;
  selected: string | null;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onAnimate: () => void;
  landing?: boolean;
  resetKey: number;
  flowTarget?: HTMLElement | null;
};
export default function Graph({
  nodes,
  edges,
  communities,
  settings,
  selected,
  onSelect,
  onEdge,
  onAnimate,
  landing = false,
  resetKey,
  flowTarget,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
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
  } | null>(null);
  const previous = useRef<Map<string, Point>>(new Map());
  const computed = useMemo(
    () => makeLayout(nodes, edges, settings, selected, landing),
    [
      nodes,
      edges,
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
    for (const n of nodes) {
      const p = previous.current.get(n.id);
      if (p) next.set(n.id, p);
    }
    return next;
  }, [computed, settings.locked, nodes]);
  useEffect(() => {
    setOverrides({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
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
    if (!settings.animate || landing || !from.size) {
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
  const connected = new Set(
    focus
      ? [
          focus,
          ...edges
            .filter((e) => e.source === focus || e.target === focus)
            .map((e) => (e.source === focus ? e.target : e.source)),
        ]
      : [],
  );
  const clamp = (v: number) => Math.max(0.3, Math.min(2.5, v));
  /** Zoom that shows every node; the layout is centred on (500, 380). */
  const fitZoom = () => {
    let dx = 0,
      dy = 0;
    for (const p of positions.values()) {
      dx = Math.max(dx, Math.abs(p.x - 500));
      dy = Math.max(dy, Math.abs(p.y - 380));
    }
    return clamp(Math.min(1, 440 / Math.max(1, dx), 330 / Math.max(1, dy)));
  };
  // Active touch / pen / mouse pointers in scene coordinates, for pinch zoom.
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<Pinch | null>(null);
  const coordinate = (e: { clientX: number; clientY: number }) => {
    const m = svg.current!.getScreenCTM();
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m!.inverse());
  };
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
    if (id && !settings.locked) setDraggedId(id);
    drag.current = {
      id,
      x: p.x,
      y: p.y,
      start: id ? point(id) : pan,
      distance: 0,
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
    if (d.id && !settings.locked)
      setOverrides((old) => ({
        ...old,
        [d.id!]: { x: d.start.x + dx / zoom, y: d.start.y + dy / zoom },
      }));
    else if (!d.id) setPan({ x: d.start.x + dx, y: d.start.y + dy });
  };
  const release = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    const pinching = !!pinch.current;
    release(e);
    if (pinching) return;
    if (drag.current?.id && drag.current.distance < 5)
      onSelect(drag.current.id);
    drag.current = null;
    setDraggedId(null);
    setHover(null);
  };
  const color = (n: AtlasNode) =>
    nodeColor(n.community, communities, settings.palette);
  const linkColor = (e: AtlasEdge) =>
    edgeColor(e, settings.coloring, color(byId.get(e.source)!));
  const name = (id: string) => byId.get(id)?.name || "";
  return (
    <div
      className={"graph-stage " + (landing ? "hero-graph" : "")}
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
        viewBox="0 0 1000 760"
        role="group"
        aria-label="关系图：点击角色查看详情，拖拽平移，滚轮或双指缩放"
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
          {edges.map((e, i) => {
            const a = point(e.source),
              b = point(e.target);
            if (!a || !b) return null;
            const active = focus && (e.source === focus || e.target === focus);
            const { path } = curve(a, b, i, settings.mode === "chord");
            const opacity = focus ? (active ? 0.9 : 0.06) : settings.opacity;
            const w =
              settings.width *
              (settings.weight === "equal"
                ? 1
                : settings.weight === "messages"
                  ? 0.5 + Math.min(3, Math.sqrt(e.events) / 2)
                  : 0.5 + e.weight * 1.8);
            return (
              <g
                key={e.id}
                className="relationship"
                style={{ color: linkColor(e) }}
              >
                <path
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={w}
                  opacity={opacity}
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
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEdge(e.id);
                      }
                    }}
                    aria-label={`${name(e.source)}与${name(e.target)}的关系`}
                    onClick={() => onEdge(e.id)}
                  >
                    <title>
                      {name(e.source)} {isMutual(e) ? "⇄" : e.ab ? "→" : "←"}{" "}
                      {name(e.target)} · {octants[primary(e).type].name}
                    </title>
                  </path>
                )}
                {(!focus || active) && i % particleStep === 0 && (
                  <circle
                    r={active ? 2 : 1.3}
                    fill="currentColor"
                    opacity={active ? 0.9 : 0.7}
                  >
                    <animateMotion
                      dur={`${(8 + (i % 7)) / settings.speed}s`}
                      repeatCount="indefinite"
                      path={path}
                      begin={`-${i * 0.4}s`}
                    />
                  </circle>
                )}
                {settings.arrows && (
                  <g fill="currentColor" opacity={opacity}>
                    {[
                      ...(e.ab ? [[isMutual(e) ? 0.65 : 0.8, 0]] : []),
                      ...(e.ba ? [[isMutual(e) ? 0.35 : 0.2, 1]] : []),
                    ].map(([t, j]) => {
                      const c = curve(a, b, i, settings.mode === "chord").c;
                      const x =
                          (1 - t) ** 2 * a.x +
                          2 * (1 - t) * t * c.x +
                          t * t * b.x,
                        y =
                          (1 - t) ** 2 * a.y +
                          2 * (1 - t) * t * c.y +
                          t * t * b.y;
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
                {settings.edgeLabels && (!focus || active) && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 5}
                    fill="currentColor"
                    fontSize="12"
                    textAnchor="middle"
                  >
                    {octants[primary(e).type].name}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
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
                : settings.labels &&
                  (!crowded ||
                    rank.get(n.id)! < 45 ||
                    (!!focus && connected.has(n.id))));
            const muted = focus && !connected.has(n.id);
            const radialLabel =
              !landing &&
              settings.mode !== "ego" &&
              (settings.layout === "circular" || settings.mode === "chord");
            const leftLabel = p.x < 500;
            const labelAngle =
              (Math.atan2(p.y - 380, p.x - 500) * 180) / Math.PI +
              (leftLabel ? 180 : 0);
            return (
              <g
                key={n.id}
                data-node={n.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={muted ? 0.22 : 1}
                className="graph-node"
                role="button"
                tabIndex={landing ? -1 : 0}
                aria-label={`${n.name} · ${communities[n.community]?.label || ""} · ${d}组关系`}
                aria-pressed={isSelected}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(n.id);
                  }
                }}
              >
                <circle r={r + 13} fill="transparent" />
                {(nodes.length <= 160 || isSelected || prominent) && (
                  <circle
                    r={r * 2.2}
                    fill={color(n)}
                    opacity={isSelected ? 0.35 : 0.14}
                    filter={`url(#${landing ? "hero-glow" : "node-glow"})`}
                  />
                )}
                {(prominent || isSelected) && (
                  <circle
                    r={r + 7}
                    stroke={color(n)}
                    fill="none"
                    opacity={isSelected ? 0.8 : 0.3}
                    strokeWidth=".7"
                  />
                )}
                {isSelected && (
                  <circle
                    className={settings.animate ? "selection-orbit" : ""}
                    r={r + 14}
                    stroke={color(n)}
                    fill="none"
                    opacity=".55"
                    strokeDasharray="3 7"
                    strokeWidth=".8"
                  />
                )}
                <circle
                  r={r}
                  fill={palettes[settings.palette].bg}
                  stroke={color(n)}
                  strokeWidth={isSelected ? 1.8 : 1}
                />
                <circle r={r * 0.42} fill={color(n)} />
                {showLabel && (
                  <text
                    x={radialLabel ? (leftLabel ? -1 : 1) * (r + 12) : 0}
                    y={radialLabel ? 5 : r + 7 + 12 * settings.labelSize}
                    transform={
                      radialLabel ? "rotate(" + labelAngle + ")" : undefined
                    }
                    textAnchor={
                      radialLabel ? (leftLabel ? "end" : "start") : "middle"
                    }
                    fontSize={(prominent ? 18 : 15) * settings.labelSize}
                    fill={prominent ? "#eee0d0" : "#b9adaf"}
                    fontFamily="Inter, Microsoft YaHei, sans-serif"
                    style={{
                      paintOrder: "stroke",
                      stroke: palettes[settings.palette].bg,
                      strokeWidth: 3,
                    }}
                  >
                    {n.name}
                  </text>
                )}
                {landing && prominent && n.en && (
                  <text
                    y={r + 33}
                    textAnchor="middle"
                    fontSize="9.5"
                    letterSpacing="1.3"
                    fill="#8d8089"
                  >
                    {n.en.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      {!landing && (
        <>
          <div className="graph-corner">
            <span className="status-dot" />
            {settings.animate ? "动效开启" : "动效已暂停"}
            <span className="corner-sep">/</span>
            {Math.round(zoom * 100)}%
          </div>
          <div className="graph-tools">
            <button
              aria-label="放大"
              onClick={() => setZoom((z) => clamp(z + 0.15))}
            >
              <Plus size={16} />
            </button>
            <button
              aria-label="缩小"
              onClick={() => setZoom((z) => clamp(z - 0.15))}
            >
              <Minus size={16} />
            </button>
            <i />
            <button
              aria-label="缩放到显示全图"
              title="显示全图"
              onClick={() => {
                setZoom(fitZoom());
                setPan({ x: 0, y: 0 });
              }}
            >
              <Maximize size={15} />
            </button>
            <button aria-label="重置节点位置" onClick={() => setOverrides({})}>
              <RotateCcw size={15} />
            </button>
            <i />
            <button
              aria-label={settings.animate ? "暂停动效" : "播放动效"}
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
