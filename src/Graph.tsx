import { useState, useMemo, useRef, useEffect, type PointerEvent } from "react";
import { Plus, Minus, Maximize, Play, Pause, RotateCcw } from "lucide-react";
import {
  type AtlasNode,
  type AtlasEdge,
  factions,
  degree,
  nodeById,
} from "./data";
import { type Settings, palettes } from "./settings";
import { makeLayout, curve, type Point } from "./layout";
type Props = {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
  settings: Settings;
  selected: string | null;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onAnimate: () => void;
  landing?: boolean;
  resetKey: number;
};
export default function Graph({
  nodes,
  edges,
  settings,
  selected,
  onSelect,
  onEdge,
  onAnimate,
  landing = false,
  resetKey,
}: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
    () => makeLayout(nodes, edges, settings, selected),
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
  const point = (id: string) => overrides[id] || positions.get(id)!;
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
  const clamp = (v: number) => Math.max(0.55, Math.min(2.5, v));
  const coordinate = (e: PointerEvent<SVGSVGElement>) => {
    const m = svg.current!.getScreenCTM();
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(m!.inverse());
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (landing || e.button !== 0) return;
    const p = coordinate(e);
    const el = (e.target as Element).closest("[data-node]");
    const id = el?.getAttribute("data-node") || null;
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
  const up = () => {
    if (drag.current?.id && drag.current.distance < 5)
      onSelect(drag.current.id);
    drag.current = null;
  };
  const color = (n: AtlasNode) =>
    settings.palette === "dusk"
      ? factions[n.faction].color
      : palettes[settings.palette].colors[n.faction % 4];
  const linkColor = (e: AtlasEdge) =>
    settings.coloring === "faction"
      ? color(nodeById.get(e.source)!)
      : (settings.coloring === "affect" ? e.affect : e.power) >= 0
        ? "#94c4b2"
        : "#e18d9c";
  return (
    <div
      className={"graph-stage " + (landing ? "hero-graph" : "")}
      data-testid="graph-stage"
    >
      <svg
        ref={svg}
        id={landing ? "hero-svg" : "network-svg"}
        viewBox="0 0 1000 760"
        role="group"
        aria-label="交互式关系网络：选择节点查看档案，拖拽平移，滚轮缩放"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onWheel={(e) => {
          if (!landing) setZoom((z) => clamp(z - e.deltaY * 0.001));
        }}
      >
        <defs>
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
          className="orbital-grid"
          fill="none"
          stroke="#d9bea5"
          strokeWidth=".6"
          opacity=".11"
        >
          <circle cx="500" cy="380" r="305" />
          <circle cx="500" cy="380" r="220" strokeDasharray="2 9" />
          <ellipse
            cx="500"
            cy="380"
            rx="390"
            ry="150"
            transform="rotate(-30 500 380)"
          />
          <path d="M80 380H920M500 50V710" strokeDasharray="2 12" />
        </g>
        <g
          transform={`translate(${pan.x} ${pan.y}) translate(500 380) scale(${zoom}) translate(-500 -380)`}
        >
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
                  ? 0.5 + e.messages / 180
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
                    aria-label={`${nodeById.get(e.source)!.name}与${nodeById.get(e.target)!.name}的关系`}
                    onClick={() => onEdge(e.id)}
                  >
                    <title>
                      {nodeById.get(e.source)!.name} {e.mutual ? "⇄" : "→"}{" "}
                      {nodeById.get(e.target)!.name} · {e.label}
                    </title>
                  </path>
                )}
                {(!focus || active) && i % 2 === 0 && (
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
                    {[e.mutual ? 0.65 : 0.8, ...(e.mutual ? [0.35] : [])].map(
                      (t, j) => {
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
                      },
                    )}
                  </g>
                )}
                {settings.edgeLabels && (!focus || active) && (
                  <text
                    x={(a.x + b.x) / 2}
                    y={(a.y + b.y) / 2 - 5}
                    fill="currentColor"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                )}
              </g>
            );
          })}
          {nodes.map((n) => {
            const p = point(n.id);
            if (!p) return null;
            const d = degree(n.id, edges),
              r = (4 + Math.sqrt(d) * 1.6) * settings.nodeSize;
            const isSelected = selected === n.id;
            const prominent = d >= 8 || n.id === "n0";
            const muted = focus && !connected.has(n.id);
            return (
              <g
                key={n.id}
                data-node={n.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={muted ? 0.22 : 1}
                className="graph-node"
                role="button"
                tabIndex={landing ? -1 : 0}
                aria-label={`${n.name} · ${factions[n.faction].name} · ${d}条关系`}
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
                onClick={() => {
                  if (landing) onSelect(n.id);
                }}
              >
                <circle r={r + 13} fill="transparent" />
                <circle
                  r={r * 2.2}
                  fill={color(n)}
                  opacity={isSelected ? 0.35 : 0.14}
                  filter={`url(#${landing ? "hero-glow" : "node-glow"})`}
                />
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
                {(settings.labels || focus === n.id || isSelected) &&
                  (!landing ||
                    prominent ||
                    n.id === "n17" ||
                    n.id === "n33") && (
                    <text
                      y={r + 19}
                      textAnchor="middle"
                      fontSize={prominent ? 15 : 12}
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
                {landing && prominent && (
                  <text
                    y={r + 33}
                    textAnchor="middle"
                    fontSize="7.5"
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
            {settings.animate ? "FIELD IN MOTION" : "FIELD AT REST"}
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
              aria-label="适应画布"
              onClick={() => {
                setZoom(1);
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
