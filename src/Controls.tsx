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
  maxMessages: number;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  setAll: (s: Settings) => void;
  onExport: () => void;
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
  maxMessages,
  update,
  setAll,
  onExport,
  onReset,
}: Props) {
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">
          <SlidersHorizontal size={12} /> 画布设置
        </span>
        <h2>
          调整<em>显示</em>
        </h2>
        <p>布局、连线、背景动效和配色都在这里调整，会自动保存在本机浏览器。</p>
      </div>
      <div className="panel-scroll">
        <section className="control-section">
          <h3>快速预设</h3>
          <div className="preset-row">
            <button onClick={() => setAll({ ...defaults, animate: s.animate })}>
              默认
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
              环形图
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
              暖色动态
            </button>
          </div>
        </section>
        <section className="control-section">
          <h3>布局</h3>
          <div className="select-control">
            布局方式
            <Select
              aria-label="布局方式"
              value={s.layout}
              onChange={(e) =>
                update("layout", e.target.value as Settings["layout"])
              }
            >
              <option value="organic">按社群聚集</option>
              <option value="force">自由分布</option>
              <option value="circular">环形排列</option>
            </Select>
          </div>
          <Range
            label="节点之间的距离"
            value={s.repulsion}
            min={50}
            max={500}
            onChange={(v) => update("repulsion", v)}
          />
          <Range
            label="向中心聚拢"
            value={s.gravity}
            min={0.1}
            max={2}
            step={0.05}
            onChange={(v) => update("gravity", v)}
          />
          <Range
            label="连线长度"
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
              以上三项只在「全图」视图、非环形排列且未锁定时生效。
            </p>
          )}
        </section>
        <section className="control-section">
          <h3>关系与筛选</h3>
          <div className="select-control">
            连线粗细
            <Select
              aria-label="连线粗细"
              value={s.weight}
              onChange={(e) =>
                update("weight", e.target.value as Settings["weight"])
              }
            >
              <option value="affinity">按关系强度</option>
              <option value="messages">按同场事件数</option>
              <option value="equal">统一粗细</option>
            </Select>
          </div>
          <div className="select-control">
            连线颜色
            <Select
              aria-label="连线颜色"
              value={s.coloring}
              onChange={(e) =>
                update("coloring", e.target.value as Settings["coloring"])
              }
            >
              <option value="community">按社群</option>
              <option value="type">按关系类型（IPC 八类）</option>
              <option value="affect">按友善度</option>
              <option value="power">按支配度</option>
            </Select>
          </div>
          <Range
            label="最少发言数"
            value={Math.min(s.minMessages, maxMessages)}
            min={0}
            max={maxMessages}
            step={maxMessages > 400 ? 10 : 1}
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
            label="连线透明度"
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
          <Range
            label="角色名大小"
            value={s.labelSize}
            min={0.6}
            max={2}
            step={0.1}
            unit="×"
            onChange={(v) => update("labelSize", v)}
          />
          <Toggle
            label="显示角色名"
            checked={s.labels}
            onChange={(v) => update("labels", v)}
          />
          <Toggle
            label="显示关系方向"
            checked={s.arrows}
            onChange={(v) => update("arrows", v)}
          />
          <Toggle
            label="显示关系类型"
            checked={s.edgeLabels}
            onChange={(v) => update("edgeLabels", v)}
          />
          <p className="control-note">
            关系强度按两人同场出现的事件数换算到
            0–1；角色较多时默认隐藏发言少的角色。
          </p>
        </section>
        <section className="control-section">
          <h3>背景动效</h3>
          <Range
            label="背景亮度"
            value={s.flowOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("flowOpacity", v)}
          />
          <Range
            label="角色对背景的影响"
            value={s.flowGravity}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => update("flowGravity", v)}
          />
          <Range
            label="影响背景的角色数"
            value={s.gravityNodes}
            min={1}
            max={5}
            onChange={(v) => update("gravityNodes", v)}
          />
          <p className="control-note">
            默认关闭：亮度为 0
            时不渲染背景，节省性能。调高亮度后，关系最多的几个角色会带动背景线条。首页不受这里影响。
          </p>
          <Range
            label="背景线条数量"
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
            label="线条弯曲程度"
            value={s.turbulence}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(v) => update("turbulence", v)}
          />
          <Toggle
            label="播放动效"
            checked={s.animate}
            onChange={(v) => update("animate", v)}
          />
        </section>
        <section className="control-section">
          <h3>配色</h3>
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
        </section>
        <section className="control-section">
          <h3>导出</h3>
          <button className="wide-button" onClick={onExport}>
            <Download size={14} /> 导出图片（SVG） <ArrowUpRight size={14} />
          </button>
          <p className="control-note">
            导出当前画面中可见的角色和关系，格式为 SVG 矢量图。
          </p>
          <button className="text-button" onClick={onReset}>
            <RotateCcw size={12} /> 恢复默认设置
          </button>
        </section>
      </div>
    </>
  );
}
