import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { t } from "../i18n";
import { bigFiveNames } from "../data";
import { hideTip, hover, showTip } from "./tip";
import { num, pct, signed } from "./format";
/*
 * Charts drawn as plain SVG, one look across the site: hairline recessive grid, 2px lines, rounded bar ends, text in
 * ink tokens never in series colors, a tooltip on every mark. Friendliness uses the diverging pair (--pos / --neg).
 */

/** Where relations land on friendliness × dominance: a 20 × 20 grid, darker cells hold more relations. */
export function Heatmap({ rows }: { rows: { b: number; p: number }[] }) {
  const N = 20;
  const size = 17;
  const m = 34;
  const side = N * size;
  const grid = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const cell = (v: number) => Math.max(0, Math.min(N - 1, Math.floor(((v + 1) / 2) * N)));
  for (const r of rows) grid[cell(r.p)][cell(r.b)]++;
  const max = Math.max(1, ...grid.flat());
  const lo = (v: number) => ((v * 2) / N - 1).toFixed(1);
  const hi = (v: number) => (((v + 1) * 2) / N - 1).toFixed(1);
  const mid = side / 2;
  return (
    <svg viewBox={`0 0 ${side + m + 10} ${side + m + 10}`} className="chart heatmap" role="img"
      aria-label={t("友善度和支配度的分布", "Friendliness and dominance")}>
      {grid.map((row, y) =>
        row.map((n, x) => (
          <rect key={`${x}-${y}`} x={m + x * size} y={8 + (N - 1 - y) * size} width={size - 2} height={size - 2} rx={2}
            fill={n ? `rgba(57, 135, 229, ${0.12 + 0.88 * Math.sqrt(n / max)})` : "var(--soft)"}
            {...hover(() => [
              t(`友善 ${lo(x)}～${hi(x)}，支配 ${lo(y)}～${hi(y)}`, `friendliness ${lo(x)} to ${hi(x)}, dominance ${lo(y)} to ${hi(y)}`),
              t(`${num(n)} 条关系`, `${num(n)} relations`),
            ])} />
        )),
      )}
      <line x1={m + mid} x2={m + mid} y1={8} y2={8 + side} className="axis" />
      <line x1={m} x2={m + side} y1={8 + mid} y2={8 + mid} className="axis" />
      <text x={m} y={side + 22} className="tick" textAnchor="middle">−1</text>
      <text x={m + mid} y={side + 22} className="tick" textAnchor="middle">0</text>
      <text x={m + side} y={side + 22} className="tick" textAnchor="middle">+1</text>
      <text x={m + mid} y={side + 38} className="tick" textAnchor="middle">
        {t("友善度 → 越右越友善", "friendliness → warmer to the right")}
      </text>
      <text x={m - 6} y={16} className="tick" textAnchor="end">+1</text>
      <text x={m - 6} y={12 + mid} className="tick" textAnchor="end">0</text>
      <text x={m - 6} y={side + 8} className="tick" textAnchor="end">−1</text>
      <text x={11} y={8 + mid} className="tick" textAnchor="middle" transform={`rotate(-90 11 ${8 + mid})`}>
        {t("支配度 ↑ 越上越居高", "dominance ↑ higher up")}
      </text>
    </svg>
  );
}

/** Horizontal bars with the value at the tip. */
export function Bars({ rows, total }: {
  rows: { label: string; value: number; color?: string; onClick?: () => void }[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className={"bar-row" + (r.onClick ? " go" : "")} onClick={r.onClick}
          {...hover(() => [r.label, t(`${num(r.value)} 条，占 ${pct(r.value, total)}`, `${num(r.value)}, ${pct(r.value, total)}`)])}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span className="bar-fill" style={{ width: `${(100 * r.value) / max}%`, background: r.color }} />
          </span>
          <span className="bar-value">{num(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Step lines on one −1..1 axis; the pointer reads every series at that position. */
export function StepLines({ series, x0, x1, mark, label, height = 112 }: {
  series: { name: string; pts: [number, number][]; dash?: boolean }[];
  x0: number;
  x1: number;
  mark?: number;
  label?: (x: number) => string;
  height?: number;
}) {
  const w = 360;
  const ml = 26;
  const mr = 8;
  const mt = 8;
  const mb = 8;
  const x = (v: number) => ml + ((v - x0) / Math.max(1, x1 - x0)) * (w - ml - mr);
  const y = (v: number) => mt + (1 - (v + 1) / 2) * (height - mt - mb);
  const read = (ev: ReactMouseEvent<SVGRectElement>) => {
    const box = ev.currentTarget.getBoundingClientRect();
    const at = x0 + ((ev.clientX - box.left) / box.width) * (x1 - x0);
    showTip(ev, [
      label ? label(Math.round(at)) : "",
      ...series.map((s) => {
        let i = s.pts.length - 1;
        while (i >= 0 && s.pts[i][0] > at) i--;
        return `${s.name} ${i >= 0 ? signed(s.pts[i][1]) : "—"}`;
      }),
    ]);
  };
  return (
    <div className="steplines">
      {series.length > 1 && (
        <div className="chart-key">
          {series.map((s) => (
            <span key={s.name}><i className={s.dash ? "key-dash" : "key-line"} />{s.name}</span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${height}`} className="chart" role="img" aria-label={series.map((s) => s.name).join(" / ")}>
        {[-1, 0, 1].map((v) => (
          <g key={v}>
            <line x1={ml} x2={w - mr} y1={y(v)} y2={y(v)} className={v ? "grid" : "axis"} />
            <text x={ml - 5} y={y(v) + 3} className="tick" textAnchor="end">{v > 0 ? "+1" : v < 0 ? "−1" : "0"}</text>
          </g>
        ))}
        {series.map((s) => {
          if (!s.pts.length) return null;
          let d = "";
          s.pts.forEach((p, j) => {
            d += j ? ` H${x(p[0])} V${y(p[1])}` : `M${x(p[0])},${y(p[1])}`;
          });
          d += ` H${x(x1)}`;
          return <path key={s.name} d={d} className={s.dash ? "line line-dash" : "line"} />;
        })}
        {mark !== undefined && <line x1={x(mark)} x2={x(mark)} y1={mt} y2={height - mb} className="mark" />}
        <rect x={ml} y={mt} width={w - ml - mr} height={height - mt - mb} fill="transparent" onMouseMove={read} onMouseLeave={hideTip} />
      </svg>
    </div>
  );
}

/** One column per story, end values side by side: filled dot one direction, hollow the other. */
export function Dots({ title, rows, onPick }: {
  title: string;
  rows: { label: string; ab?: { v: number; text: string }; ba?: { v: number; text: string } }[];
  onPick?: (i: number) => void;
}) {
  const n = rows.length;
  const w = Math.max(460, n * 16);   // wide enough that many stories spread out instead of the chart growing tall
  const h = 128;
  const ml = 26;
  const mr = 10;
  const mt = 10;
  const mb = 10;
  const x = (i: number) => ml + (n > 1 ? i / (n - 1) : 0.5) * (w - ml - mr);
  const y = (v: number) => mt + (1 - (v + 1) / 2) * (h - mt - mb);
  return (
    <figure className="dots">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label={title}>
        {[-1, 0, 1].map((v) => (
          <g key={v}>
            <line x1={ml} x2={w - mr} y1={y(v)} y2={y(v)} className={v ? "grid" : "axis"} />
            <text x={ml - 5} y={y(v) + 3} className="tick" textAnchor="end">{v > 0 ? "+1" : v < 0 ? "−1" : "0"}</text>
          </g>
        ))}
        {rows.map((row, i) =>
          (["ab", "ba"] as const).map((side) => {
            const d = row[side];
            if (!d) return null;
            return (
              <g key={`${i}-${side}`} className={onPick ? "go" : ""} onClick={() => onPick?.(i)} {...hover(() => [row.label, d.text])}>
                <circle cx={x(i)} cy={y(d.v)} r={4.5} className={side === "ab" ? "dot" : "dot dot-hollow"} />
                <circle cx={x(i)} cy={y(d.v)} r={10} fill="transparent" />
              </g>
            );
          }),
        )}
      </svg>
    </figure>
  );
}

/** Relations on the interpersonal circle: friendliness across, dominance up; the color carries the sign. */
export function Circumplex({ points, onPick }: {
  points: { b: number; p: number; i: number; lines: () => string[]; key: string }[];
  onPick?: (key: string) => void;
}) {
  const s = 300;
  const c = s / 2;
  const r = c - 26;
  const labels = [
    [0, t("友好", "warm")], [90, t("主导", "dominant")], [180, t("冷淡", "cold")], [270, t("顺从", "submissive")],
  ] as const;
  return (
    <svg viewBox={`0 0 ${s} ${s}`} className="chart circumplex" role="img" aria-label={t("此刻关系的环形分布", "Relations on the interpersonal circle")}>
      <circle cx={c} cy={c} r={r} className="grid" fill="none" />
      <circle cx={c} cy={c} r={r / 2} className="grid" fill="none" />
      {[0, 45, 90, 135].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={c - r * Math.cos(rad)} y1={c + r * Math.sin(rad)} x2={c + r * Math.cos(rad)} y2={c - r * Math.sin(rad)} className={a % 90 ? "grid" : "axis"} />;
      })}
      {labels.map(([a, label]) => {
        const rad = (a * Math.PI) / 180;
        return (
          <text key={a} x={c + (r + 13) * Math.cos(rad)} y={c - (r + 13) * Math.sin(rad) + 3} className="tick" textAnchor="middle">{label}</text>
        );
      })}
      {points.map((p) => (
        <g key={p.key} className={onPick ? "go" : ""} onClick={() => onPick?.(p.key)} {...hover(p.lines)}>
          <circle cx={c + p.b * r} cy={c - p.p * r} r={3.5 + 3 * p.i} className={p.b >= 0 ? "pt pt-pos" : "pt pt-neg"} />
          <circle cx={c + p.b * r} cy={c - p.p * r} r={9} fill="transparent" />
        </g>
      ))}
    </svg>
  );
}

/** Big Five on −1..1, bars growing from the middle. */
export function OceanBars({ v }: { v: (number | null)[] }) {
  const names = bigFiveNames();
  return (
    <div className="ocean">
      {names.map((name, i) => {
        const x = v[i];
        return (
          <div key={name} className="ocean-row" {...hover(() => [name, x == null ? t("证据不足，未评分", "not scored") : signed(x)])}>
            <span>{name}</span>
            <span className="ocean-bar">
              <i className="zero" />
              {x != null && (
                <span className={x >= 0 ? "pos" : "neg"} style={{ left: `${x >= 0 ? 50 : 50 + x * 50}%`, width: `${Math.abs(x) * 50}%` }} />
              )}
            </span>
            <span className="ocean-v">{x == null ? "—" : signed(x)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Every story in queue order as one thin column; color is the story's category. */
export function QueueStrip({ items, legend }: {
  items: { key: string; value: number; color: string; mark?: boolean; lines: () => string[]; onPick: () => void }[];
  legend: { label: string; color: string }[];
}) {
  const w = 1000;
  const h = 150;
  const top = 16;
  const max = Math.max(1, ...items.map((i) => i.value));
  const bw = w / Math.max(1, items.length);
  return (
    <figure className="strip">
      <div className="chart-key">
        {legend.map((l) => (
          <span key={l.label}><i className="key-swatch" style={{ background: l.color }} />{l.label}</span>
        ))}
        <span><i className="key-new" />{t("最新加入", "latest update")}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" preserveAspectRatio="none" aria-label={t("沿剧情队列的关系数", "Relations along the story queue")}>
        <line x1={0} x2={w} y1={h - 0.5} y2={h - 0.5} className="axis" />
        {items.map((it, i) => {
          const bh = it.value ? Math.max(1.5, ((h - top) * it.value) / max) : 0;
          return (
            <g key={it.key} className="go" onClick={it.onPick} {...hover(it.lines)}>
              <rect x={i * bw} y={0} width={bw} height={h} fill="transparent" />
              <rect x={i * bw + bw * 0.12} y={h - bh} width={Math.max(0.8, bw * 0.76)} height={bh} fill={it.color} />
              {it.mark && <circle cx={i * bw + bw / 2} cy={Math.max(5, h - bh - 7)} r={4} className="new-dot" />}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/**
 * The story timeline: relations formed so far (area), scene starts (faint rules) and the current position. Dragging
 * on it moves the position, like the slider underneath.
 */
export function Timeline({ points, m, cur, scenes, onSeek, label }: {
  points: { pos: number; n: number }[];
  m: number;
  cur: number;
  scenes: number[];
  onSeek: (pos: number) => void;
  label: (pos: number) => string[];
}) {
  const w = 1000;
  const h = 64;
  const mt = 6;
  const max = Math.max(1, ...points.map((p) => p.n));
  const x = (v: number) => ((v - 1) / Math.max(1, m - 1)) * w;
  const y = (v: number) => h - 2 - (v / max) * (h - mt - 4);
  let d = `M0,${y(0)}`;
  for (const p of points) d += ` H${x(p.pos)} V${y(p.n)}`;
  d += ` H${w}`;
  const area = `${d} V${h} H0 Z`;
  const box = useRef<SVGSVGElement>(null);
  const posAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.max(1, Math.min(m, Math.round(1 + ((clientX - r.left) / r.width) * (m - 1))));
  };
  const drag = (ev: ReactPointerEvent<SVGSVGElement>) => {
    if (ev.buttons !== 1) return;
    onSeek(posAt(ev.clientX));
  };
  return (
    <svg ref={box} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="chart timeline" role="img"
      aria-label={t("这个故事里关系数随剧情推进的变化", "Relations formed as the story goes on")}
      onPointerDown={(ev) => {
        ev.currentTarget.setPointerCapture(ev.pointerId);
        onSeek(posAt(ev.clientX));
      }}
      onPointerMove={(ev) => {
        drag(ev);
        showTip(ev, label(posAt(ev.clientX)));
      }}
      onPointerLeave={hideTip}>
      {scenes.map((s) => (
        <line key={s} x1={x(s)} x2={x(s)} y1={0} y2={h} className="scene-rule" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={area} className="area" />
      <path d={d} className="line" vectorEffect="non-scaling-stroke" />
      <rect x={0} y={0} width={x(cur)} height={h} className="past" />
      <line x1={x(cur)} x2={x(cur)} y1={0} y2={h} className="now" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
