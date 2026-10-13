import Select from "./Select";
import { type Settings, palettes, defaults } from "./settings";
import {
  SlidersHorizontal,
  RotateCcw,
  Download,
  ArrowUpRight,
} from "lucide-react";
type Props = {
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setAll: (s: Settings) => void;
  onExport: (type: "svg" | "json" | "csv") => void;
  onReset: () => void;
};
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <output>
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {unit}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={
          {
            "--range": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
        onChange={(e) => onChange(+e.target.value)}
      />
    </label>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-control">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}
export default function Controls({
  settings: s,
  update,
  setAll,
  onExport,
  onReset,
}: Props) {
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">
          <SlidersHorizontal size={12} /> FIELD CONTROLS
        </span>
        <h2>
          Shape the <em>field.</em>
        </h2>
        <p>调整引力、光线与流动，让关系显现。</p>
      </div>
      <div className="panel-scroll">
        <section className="control-section">
          <h3>
            场景预设 <span>PRESETS</span>
          </h3>
          <div className="preset-row">
            <button onClick={() => setAll({ ...defaults, animate: s.animate })}>
              星图 <span>Atlas</span>
            </button>
            <button
              onClick={() =>
                setAll({
                  ...defaults,
                  palette: "glacier",
                  layout: "circular",
                  mode: "chord",
                  opacity: 0.5,
                  particles: 900,
                  animate: s.animate,
                })
              }
            >
              弦月 <span>Chord</span>
            </button>
            <button
              onClick={() =>
                setAll({
                  ...defaults,
                  palette: "ember",
                  particles: 2600,
                  turbulence: 2,
                  speed: 1,
                  opacity: 0.6,
                  layout: "force",
                  animate: s.animate,
                })
              }
            >
              余烬 <span>Ember</span>
            </button>
          </div>
        </section>
        <section className="control-section">
          <h3>
            布局与引力 <span>I</span>
          </h3>
          <div className="select-control">
            布局算法
            <Select
              aria-label="布局算法"
              value={s.layout}
              onChange={(e) =>
                update("layout", e.target.value as Settings["layout"])
              }
            >
              <option value="organic">社群星系 · Clustered force</option>
              <option value="force">力导向 · D3 force</option>
              <option value="circular">环形 · Circular</option>
            </Select>
          </div>
          <Range
            label="节点斥力"
            value={s.repulsion}
            min={50}
            max={500}
            onChange={(v) => update("repulsion", v)}
          />
          <Range
            label="中心引力"
            value={s.gravity}
            min={0.1}
            max={2}
            step={0.05}
            onChange={(v) => update("gravity", v)}
          />
          <Range
            label="理想边长"
            value={s.distance}
            min={30}
            max={180}
            onChange={(v) => update("distance", v)}
          />
          <Toggle
            label="防止节点重叠"
            checked={s.overlap}
            onChange={(v) => update("overlap", v)}
          />
          <Toggle
            label="锁定节点位置"
            checked={s.locked}
            onChange={(v) => update("locked", v)}
          />
          {(s.layout === "circular" || s.mode !== "network" || s.locked) && (
            <p className="control-note">
              引力参数在未锁定的网络力导向布局中生效。
            </p>
          )}
        </section>
        <section className="control-section">
          <h3>
            关系与可见性 <span>II</span>
          </h3>
          <div className="select-control">
            关系权重
            <Select
              aria-label="关系权重"
              value={s.weight}
              onChange={(e) =>
                update("weight", e.target.value as Settings["weight"])
              }
            >
              <option value="affinity">关系强度</option>
              <option value="messages">互动消息数</option>
              <option value="equal">等权重</option>
            </Select>
          </div>
          <div className="select-control">
            边的着色
            <Select
              aria-label="边的着色"
              value={s.coloring}
              onChange={(e) =>
                update("coloring", e.target.value as Settings["coloring"])
              }
            >
              <option value="faction">所属社群</option>
              <option value="affect">情感倾向 · Benevolence</option>
              <option value="power">权力倾向 · Power</option>
            </Select>
          </div>
          <Range
            label="最低消息数"
            value={s.minMessages}
            min={0}
            max={1300}
            step={10}
            onChange={(v) => update("minMessages", v)}
          />
          <Range
            label="最低关系强度"
            value={s.minWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("minWeight", v)}
          />
          <Range
            label="边透明度"
            value={s.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => update("opacity", v)}
          />
          <Range
            label="连线宽度"
            value={s.width}
            min={0.4}
            max={3}
            step={0.1}
            onChange={(v) => update("width", v)}
          />
          <Range
            label="节点大小"
            value={s.nodeSize}
            min={0.6}
            max={1.8}
            step={0.1}
            onChange={(v) => update("nodeSize", v)}
          />
          <Toggle
            label="显示节点名称"
            checked={s.labels}
            onChange={(v) => update("labels", v)}
          />
          <Toggle
            label="显示关系方向"
            checked={s.arrows}
            onChange={(v) => update("arrows", v)}
          />
          <Toggle
            label="显示关系标签"
            checked={s.edgeLabels}
            onChange={(v) => update("edgeLabels", v)}
          />
        </section>
        <section className="control-section">
          <h3>
            流场与粒子 <span>III</span>
          </h3>
          <Range
            label="背景亮度"
            value={s.flowOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("flowOpacity", v)}
          />
          <Range
            label="节点引力"
            value={s.flowGravity}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => update("flowGravity", v)}
          />
          <Range
            label="引力中心数量"
            value={s.gravityNodes}
            min={1}
            max={5}
            onChange={(v) => update("gravityNodes", v)}
          />
          <p className="control-note">
            高权重节点轻微偏转附近流向，保留贯穿画布的流动；与序章共享设置。
          </p>
          <Range
            label="粒子密度"
            value={s.particles}
            min={0}
            max={3000}
            step={100}
            onChange={(v) => update("particles", v)}
          />
          <Range
            label="流动速度"
            value={s.speed}
            min={0.1}
            max={2}
            step={0.05}
            unit="×"
            onChange={(v) => update("speed", v)}
          />
          <Range
            label="流场扰动"
            value={s.turbulence}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(v) => update("turbulence", v)}
          />
          <Toggle
            label="运行动效"
            checked={s.animate}
            onChange={(v) => update("animate", v)}
          />
        </section>
        <section className="control-section">
          <h3>
            色彩叙事 <span>IV</span>
          </h3>
          <div className="palette-row">
            {Object.entries(palettes).map(([key, p]) => (
              <button
                key={key}
                className={s.palette === key ? "active" : ""}
                aria-label={p.name + "配色"}
                aria-pressed={s.palette === key}
                onClick={() => update("palette", key as Settings["palette"])}
              >
                <span
                  className="palette-swatch"
                  style={{
                    background: `linear-gradient(125deg,${p.colors[0]},${p.bg} 53%,${p.colors[1]})`,
                  }}
                />
                <small>{p.name}</small>
              </button>
            ))}
          </div>
          <p className="palette-caption">
            {palettes[s.palette].en} — a different light, the same connections.
          </p>
        </section>
        <section className="control-section">
          <h3>
            保存此刻 <span>V</span>
          </h3>
          <button className="wide-button" onClick={() => onExport("svg")}>
            <Download size={14} /> 导出矢量星图 <ArrowUpRight size={14} />
          </button>
          <div className="export-row">
            <button onClick={() => onExport("json")}>JSON 数据</button>
            <button onClick={() => onExport("csv")}>CSV 关系表</button>
          </div>
          <p className="control-note">
            导出当前可见的演示网络。设置自动保存在此浏览器。
          </p>
          <button className="text-button" onClick={onReset}>
            <RotateCcw size={12} /> 恢复默认设置
          </button>
        </section>
      </div>
    </>
  );
}
