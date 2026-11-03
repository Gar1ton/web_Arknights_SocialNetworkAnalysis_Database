import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { type Octant, octantName, octants } from "./data";
import { t } from "./i18n";
/**
 * Small charts in the site's own look: hairline axes, mono ticks, the octant
 * and affect colours of the graph. Every chart answers hover and focus with
 * one readout, value first.
 */
export const affectColor = "#94c4b2";
export const powerColor = "#ddb780";
const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
type Readout = { x: number; y: number; lines: ReactNode[] } | null;
function Tip({ tip }: { tip: Readout }) {
  if (!tip) return null;
  return (
    <div
      className="chart-tip"
      style={{ left: tip.x, top: tip.y }}
      role="status"
    >
      {tip.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
/** Pointer position as a share of the element's width, 0–1. */
function share(e: { clientX: number; clientY: number }, el: Element) {
  const box = el.getBoundingClientRect();
  return {
    f: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
    x: e.clientX - box.left,
    y: e.clientY - box.top,
  };
}
/** Last value of a step series at or before x. */
const stepAt = (pts: [number, number][], x: number) => {
  let v: number | null = null;
  for (const [px, py] of pts) {
    if (px > x) break;
    v = py;
  }
  return v;
};
const stepPath = (
  pts: [number, number][],
  sx: (v: number) => number,
  sy: (v: number) => number,
  end: number,
) =>
  pts
    .map(([x, y], i) => {
      const next = i + 1 < pts.length ? pts[i + 1][0] : end;
      return `${i ? "L" : "M"}${sx(x)},${sy(y)}H${sx(next)}`;
    })
    .join("");
/**
 * The relations formed so far along one story, above the scrubber. Dragging
 * on it moves the story position like the slider does.
 */
export function TimelineCurve({
  series,
  m,
  cur,
  scenes,
  describe,
  onSeek,
}: {
  series: { pos: number; n: number }[];
  m: number;
  cur: number;
  /** Start positions of the scenes after the first. */
  scenes: number[];
  describe: (pos: number) => ReactNode[];
  onSeek: (pos: number) => void;
}) {
  const W = 1000,
    H = 64;
  const max = Math.max(1, ...series.map((p) => p.n));
  const sx = (v: number) => ((v - 1) / Math.max(1, m - 1)) * W;
  const sy = (v: number) => H - 4 - (v / max) * (H - 12);
  const pts: [number, number][] = [[1, 0], ...series.map((p) => [p.pos, p.n] as [number, number])];
  const line = stepPath(pts, sx, sy, m);
  const area = `${line}V${H}H${sx(1)}Z`;
  const [tip, setTip] = useState<Readout>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const dragging = useRef(false);
  const posAt = (f: number) => Math.round(1 + f * (m - 1));
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const { f, x } = share(e, e.currentTarget);
    const pos = posAt(f);
    if (dragging.current) onSeek(pos);
    setHoverX(sx(pos));
    setTip({ x, y: -6, lines: describe(pos) });
  };
  return (
    <div
      className="timeline-curve"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onSeek(posAt(share(e, e.currentTarget).f));
      }}
      onPointerMove={move}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onPointerLeave={() => {
        setTip(null);
        setHoverX(null);
      }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="timeline-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#dba0b0" stopOpacity=".34" />
            <stop offset="1" stopColor="#dba0b0" stopOpacity="0" />
          </linearGradient>
          <clipPath id="timeline-past">
            <rect x="0" y="0" width={sx(cur)} height={H} />
          </clipPath>
        </defs>
        {scenes.map((s) => (
          <line key={s} x1={sx(s)} x2={sx(s)} y1={H - 10} y2={H} className="timeline-scene" />
        ))}
        <path d={area} className="timeline-area future" />
        <path d={line} className="timeline-line future" />
        <g clipPath="url(#timeline-past)">
          <path d={area} fill="url(#timeline-fill)" />
          <path d={line} className="timeline-line" />
        </g>
        {hoverX !== null && (
          <line x1={hoverX} x2={hoverX} y1={0} y2={H} className="timeline-hover" />
        )}
        <line x1={sx(cur)} x2={sx(cur)} y1={0} y2={H} className="timeline-now" />
      </svg>
      <Tip tip={tip} />
    </div>
  );
}
/**
 * One direction of a relation over the story: friendliness (solid) and
 * dominance (dashed) as steps, from when it forms. Click to move there.
 */
export function HistoryChart({
  rows,
  m,
  cur,
  position,
  onSeek,
}: {
  rows: [number, number, number][];
  m: number;
  cur: number;
  position: (pos: number) => string;
  onSeek: (pos: number) => void;
}) {
  const W = 300,
    H = 112,
    L = 26,
    R = 6,
    T = 8,
    B = 16;
  const sx = (v: number) => L + ((v - 1) / Math.max(1, m - 1)) * (W - L - R);
  const sy = (v: number) => T + ((1 - v) / 2) * (H - T - B);
  const ben = rows.map((r) => [r[0], r[1]] as [number, number]);
  const pow = rows.map((r) => [r[0], r[2]] as [number, number]);
  const [tip, setTip] = useState<Readout>(null);
  const [hx, setHx] = useState<number | null>(null);
  const toPos = (e: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) => {
    const { x } = share(e, e.currentTarget);
    const box = e.currentTarget.getBoundingClientRect();
    const sceneX = (x / box.width) * W;
    return Math.round(1 + ((sceneX - L) / (W - L - R)) * (m - 1));
  };
  return (
    <div className="history-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("友善度与支配度随剧情的变化", "Affiliation and dominance over the story")}
        onPointerMove={(e) => {
          const pos = Math.max(1, Math.min(m, toPos(e)));
          const b = stepAt(ben, pos),
            p = stepAt(pow, pos);
          const { x, y } = share(e, e.currentTarget);
          setHx(sx(pos));
          setTip({
            x,
            y: y - 8,
            lines:
              b === null
                ? [<small key="n">{t("此时尚未形成", "Not formed yet")}</small>, <small key="p">{position(pos)}</small>]
                : [
                    <span key="b"><i style={{ background: affectColor }} /><b>{signed(b)}</b> {t("友善度", "affiliation")}</span>,
                    <span key="p"><i className="dash" style={{ background: powerColor }} /><b>{signed(p!)}</b> {t("支配度", "dominance")}</span>,
                    <small key="x">{position(pos)}</small>,
                  ],
          });
        }}
        onPointerLeave={() => {
          setTip(null);
          setHx(null);
        }}
        onClick={(e) => onSeek(Math.max(1, Math.min(m, toPos(e))))}
      >
        {[1, 0, -1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className={v ? "chart-grid" : "chart-zero"} />
            <text x={L - 5} y={sy(v) + 3} textAnchor="end" className="chart-tick">
              {v > 0 ? "+1" : v < 0 ? "−1" : "0"}
            </text>
          </g>
        ))}
        <path d={stepPath(ben, sx, sy, m)} className="history-line" stroke={affectColor} />
        <path d={stepPath(pow, sx, sy, m)} className="history-line dashed" stroke={powerColor} />
        {hx !== null && <line x1={hx} x2={hx} y1={T} y2={H - B} className="timeline-hover" />}
        <line x1={sx(cur)} x2={sx(cur)} y1={T - 4} y2={H - B + 2} className="history-now" />
        <text x={L} y={H - 3} className="chart-tick">1</text>
        <text x={W - R} y={H - 3} textAnchor="end" className="chart-tick">{m.toLocaleString()}</text>
      </svg>
      <Tip tip={tip} />
    </div>
  );
}
export function HistoryKey() {
  return (
    <p className="chart-key">
      <span><i style={{ background: affectColor }} />{t("友善度", "Affiliation")}</span>
      <span><i className="dash" style={{ background: powerColor }} />{t("支配度", "Dominance")}</span>
      <span>{t("点图可跳到那一句", "Click to jump there")}</span>
    </p>
  );
}
/** Counts of the eight relation types, most common first, each with its name. */
export function OctantBars({
  counts,
  onPick,
}: {
  counts: Record<Octant, number>;
  onPick?: (k: Octant) => void;
}) {
  const rows = (Object.keys(counts) as Octant[])
    .map((k) => ({ k, v: counts[k] }))
    .sort((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0);
  const max = Math.max(1, rows[0]?.v ?? 1);
  return (
    <div className="octant-bars">
      {rows.map(({ k, v }) => (
        <button
          key={k}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(k)}
          title={`${octantName(k)} ${v}`}
        >
          <span className="octant-name">
            <i style={{ background: octants[k].color }} />
            {octantName(k)}
          </span>
          <span className="octant-track">
            <i style={{ width: `${(v / max) * 100}%`, background: octants[k].color }} />
          </span>
          <b>{v.toLocaleString()}</b>
          <small>{total ? Math.round((v / total) * 100) : 0}%</small>
        </button>
      ))}
    </div>
  );
}
/** Friendliness × dominance as a 10 × 10 grid; brighter cells hold more relations. */
export function Heatmap({ points }: { points: { b: number; p: number }[] }) {
  const N = 10;
  const grid = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const cell = (v: number) => Math.min(N - 1, Math.floor(((v + 1) / 2) * N));
  for (const { b, p } of points) grid[N - 1 - cell(p)][cell(b)]++;
  const max = Math.max(1, ...grid.flat());
  const [tip, setTip] = useState<Readout>(null);
  const S = 22,
    L = 34,
    T = 8;
  const range = (i: number) => {
    const a = -1 + (2 * i) / N;
    return `${signed(a)} ～ ${signed(a + 2 / N)}`;
  };
  return (
    <div className="heatmap">
      <svg
        viewBox={`0 0 ${L + N * S + 8} ${T + N * S + 30}`}
        role="img"
        aria-label={t("友善度 × 支配度分布", "Affiliation × dominance")}
        onPointerLeave={() => setTip(null)}
      >
        {grid.map((row, r) =>
          row.map((n, c) => (
            <rect
              key={r + "-" + c}
              x={L + c * S + 1}
              y={T + r * S + 1}
              width={S - 2}
              height={S - 2}
              rx="2"
              fill="#dba0b0"
              fillOpacity={n ? 0.1 + 0.9 * Math.pow(n / max, 0.55) : 0.03}
              className="heat-cell"
              onPointerMove={(e) => {
                const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top - 10,
                  lines: [
                    <b key="n">{n.toLocaleString()} {t("条关系", n === 1 ? "relation" : "relations")}</b>,
                    <small key="b">{t("友善度", "Affiliation")} {range(c)}</small>,
                    <small key="p">{t("支配度", "Dominance")} {range(N - 1 - r)}</small>,
                  ],
                });
              }}
            />
          )),
        )}
        <line x1={L + (N * S) / 2} x2={L + (N * S) / 2} y1={T} y2={T + N * S} className="chart-zero" />
        <line x1={L} x2={L + N * S} y1={T + (N * S) / 2} y2={T + (N * S) / 2} className="chart-zero" />
        <text x={L} y={T + N * S + 14} className="chart-tick">{t("← 敌对", "← hostile")}</text>
        <text x={L + N * S} y={T + N * S + 14} textAnchor="end" className="chart-tick">{t("友善 →", "friendly →")}</text>
        <text x={L + (N * S) / 2} y={T + N * S + 27} textAnchor="middle" className="chart-label">{t("友善度", "Affiliation")}</text>
        <text x={L - 6} y={T + 8} textAnchor="end" className="chart-tick">{t("主导", "dom.")}</text>
        <text x={L - 6} y={T + N * S} textAnchor="end" className="chart-tick">{t("顺从", "sub.")}</text>
        <text x={10} y={T + (N * S) / 2} textAnchor="middle" className="chart-label" transform={`rotate(-90 10 ${T + (N * S) / 2})`}>{t("支配度", "Dominance")}</text>
      </svg>
      <Tip tip={tip} />
    </div>
  );
}
/** One column per story along the chronology, height = relations at its end. */
export function ChronoStrip({
  items,
  legend,
}: {
  items: { key: string; value: number; color: string; mark?: boolean; lines: () => ReactNode[]; href: string }[];
  legend: { label: string; color: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const [tip, setTip] = useState<Readout>(null);
  const W = 1000,
    H = 150;
  const step = W / Math.max(1, items.length);
  return (
    <div className="chrono-strip">
      <p className="chart-key">
        {legend.map((l) => (
          <span key={l.label}><i className="swatch" style={{ background: l.color }} />{l.label}</span>
        ))}
        <span><i className="dot" />{t("最新加入", "Just added")}</span>
      </p>
      <div className="chrono-plot" onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="chart-zero" />
          {items.map((it, i) => {
            const h = (it.value / max) * (H - 14);
            return (
              <g key={it.key}>
                <rect x={i * step + step * 0.12} y={H - h} width={Math.max(0.6, step * 0.76)} height={h} fill={it.color} opacity={it.mark ? 1 : 0.72} />
                {it.mark && <circle cx={i * step + step / 2} cy={H - h - 6} r="3.2" className="chrono-new" />}
              </g>
            );
          })}
        </svg>
        <div className="chrono-hits">
          {items.map((it) => (
            <a
              key={it.key}
              href={it.href}
              aria-label={String(it.lines()[0])}
              onPointerMove={(e) => {
                const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                setTip({ x: e.clientX - box.left, y: e.clientY - box.top - 12, lines: it.lines() });
              }}
              onFocus={(e) => {
                const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                const own = e.currentTarget.getBoundingClientRect();
                setTip({ x: own.left - box.left, y: 0, lines: it.lines() });
              }}
              onBlur={() => setTip(null)}
            />
          ))}
        </div>
        <Tip tip={tip} />
      </div>
    </div>
  );
}
/** A trait (0–100) along the whole chronology, as steps. */
export function TraitLine({
  name,
  pts,
  x0,
  x1,
  color,
  where,
}: {
  name: string;
  pts: [number, number][];
  x0: number;
  x1: number;
  color: string;
  where: (seq: number) => string;
}) {
  const W = 300,
    H = 46;
  const sx = (v: number) => 4 + ((v - x0) / Math.max(1, x1 - x0)) * (W - 8);
  const sy = (v: number) => 4 + (1 - v / 100) * (H - 8);
  const [tip, setTip] = useState<Readout>(null);
  const last = pts[pts.length - 1];
  return (
    <div className="trait-line">
      <span>{name}</span>
      <div className="trait-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerMove={(e) => {
            const { f, x, y } = share(e, e.currentTarget);
            const seq = x0 + f * (x1 - x0);
            let best = pts[0];
            for (const p of pts) if (Math.abs(p[0] - seq) < Math.abs(best[0] - seq)) best = p;
            setTip({ x, y: y - 10, lines: [<b key="v">{best[1]}</b>, <small key="w">{where(best[0])}</small>] });
          }}
          onPointerLeave={() => setTip(null)}
        >
          <line x1="0" x2={W} y1={sy(50)} y2={sy(50)} className="chart-grid" />
          <path d={stepPath(pts, sx, sy, x1)} stroke={color} className="history-line" vectorEffect="non-scaling-stroke" />
        </svg>
        <Tip tip={tip} />
      </div>
      <b>{last ? last[1] : "—"}</b>
    </div>
  );
}
/** Story by story: ● what a character gives, ○ what they receive (mean friendliness). */
export function DotStrip({
  rows,
  onPick,
}: {
  rows: { label: string; given?: number; got?: number }[];
  onPick: (i: number) => void;
}) {
  const W = Math.max(300, rows.length * 18),
    H = 120,
    T = 8,
    B = 8;
  const sy = (v: number) => T + ((1 - v) / 2) * (H - T - B);
  const [tip, setTip] = useState<Readout>(null);
  return (
    <div className="dot-strip" onPointerLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {[1, 0, -1].map((v) => (
          <line key={v} x1="0" x2={W} y1={sy(v)} y2={sy(v)} className={v ? "chart-grid" : "chart-zero"} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="dot-columns">
        {rows.map((r, i) => (
          <button
            key={i}
            type="button"
            style={{ width: `${100 / rows.length}%` }}
            onClick={() => onPick(i)}
            onPointerMove={(e) => {
              const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
              setTip({
                x: e.clientX - box.left,
                y: e.clientY - box.top - 12,
                lines: [
                  r.given !== undefined && <span key="g"><b>{signed(r.given)}</b> {t("给出", "given")}</span>,
                  r.got !== undefined && <span key="r"><b>{signed(r.got)}</b> {t("收到", "received")}</span>,
                  <small key="l">{r.label}</small>,
                ].filter(Boolean),
              });
            }}
            aria-label={r.label}
          >
            {r.given !== undefined && <i className="dot-given" style={{ top: `${(sy(r.given) / H) * 100}%` }} />}
            {r.got !== undefined && <i className="dot-got" style={{ top: `${(sy(r.got) / H) * 100}%` }} />}
          </button>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}
