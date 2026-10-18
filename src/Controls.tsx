import Select from "./Select";
import { type Settings, palettes, defaults } from "./settings";
import { t } from "./i18n";
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
          <SlidersHorizontal size={12} /> {t("画布设置", "Display")}
        </span>
        <h2>
          {t("调整", "Adjust the ")}
          <em>{t("显示", "view")}</em>
        </h2>
        <p>
          {t(
            "布局、连线、背景动效和配色都在这里调整，会自动保存在本机浏览器。",
            "Layout, links, background motion and colours. Saved in this browser automatically.",
          )}
        </p>
      </div>
      <div className="panel-scroll">
        <section className="control-section">
          <h3>{t("快速预设", "Presets")}</h3>
          <div className="preset-row">
            <button onClick={() => setAll({ ...defaults, animate: s.animate })}>
              {t("默认", "Default")}
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
              {t("环形图", "Chord")}
            </button>
          </div>
        </section>
        <section className="control-section">
          <h3>{t("布局", "Layout")}</h3>
          <div className="select-control">
            {t("布局方式", "Layout")}
            <Select
              aria-label={t("布局方式", "Layout")}
              value={s.layout}
              onChange={(e) =>
                update("layout", e.target.value as Settings["layout"])
              }
            >
              <option value="organic">
                {t("按社群聚集", "Grouped by community")}
              </option>
              <option value="force">{t("自由分布", "Free")}</option>
              <option value="circular">{t("环形排列", "Circle")}</option>
            </Select>
          </div>
          <Range
            label={t("节点之间的距离", "Node spacing")}
            value={s.repulsion}
            min={50}
            max={500}
            onChange={(v) => update("repulsion", v)}
          />
          <Range
            label={t("向中心聚拢", "Pull to centre")}
            value={s.gravity}
            min={0.1}
            max={2}
            step={0.05}
            onChange={(v) => update("gravity", v)}
          />
          <Range
            label={t("连线长度", "Link length")}
            value={s.distance}
            min={30}
            max={180}
            onChange={(v) => update("distance", v)}
          />
          <Toggle
            label={t("防止节点重叠", "Prevent overlap")}
            checked={s.overlap}
            onChange={(v) => update("overlap", v)}
          />
          <Toggle
            label={t("锁定节点位置", "Lock node positions")}
            checked={s.locked}
            onChange={(v) => update("locked", v)}
          />
          {(s.layout === "circular" || s.mode !== "network" || s.locked) && (
            <p className="control-note">
              {t(
                "以上三项只在「全图」视图、非环形排列且未锁定时生效。",
                "These three apply only in the Network view, outside the circle layout, with nodes unlocked.",
              )}
            </p>
          )}
        </section>
        <section className="control-section">
          <h3>{t("关系与筛选", "Links and filters")}</h3>
          <div className="select-control">
            {t("连线粗细", "Link width by")}
            <Select
              aria-label={t("连线粗细", "Link width by")}
              value={s.weight}
              onChange={(e) =>
                update("weight", e.target.value as Settings["weight"])
              }
            >
              <option value="affinity">
                {t("按关系强度", "Tie strength")}
              </option>
              <option value="messages">
                {t("按同场事件数", "Shared events")}
              </option>
              <option value="equal">{t("统一粗细", "Same width")}</option>
            </Select>
          </div>
          <div className="select-control">
            {t("连线颜色", "Link colour")}
            <Select
              aria-label={t("连线颜色", "Link colour")}
              value={s.coloring}
              onChange={(e) =>
                update("coloring", e.target.value as Settings["coloring"])
              }
            >
              <option value="community">{t("按社群", "Community")}</option>
              <option value="type">
                {t("按关系类型（IPC 八类）", "Relation type (8 IPC octants)")}
              </option>
              <option value="affect">{t("按友善度", "Affiliation")}</option>
              <option value="power">{t("按支配度", "Dominance")}</option>
            </Select>
          </div>
          <Range
            label={t("最少发言数", "Minimum lines")}
            value={Math.min(s.minMessages, maxMessages)}
            min={0}
            max={maxMessages}
            step={maxMessages > 400 ? 10 : 1}
            onChange={(v) => update("minMessages", v)}
          />
          <Range
            label={t("最低关系强度", "Minimum tie strength")}
            value={s.minWeight}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("minWeight", v)}
          />
          <Range
            label={t("连线透明度", "Link opacity")}
            value={s.opacity}
            min={0.05}
            max={1}
            step={0.05}
            onChange={(v) => update("opacity", v)}
          />
          <Range
            label={t("连线宽度", "Link width")}
            value={s.width}
            min={0.4}
            max={3}
            step={0.1}
            onChange={(v) => update("width", v)}
          />
          <Range
            label={t("节点大小", "Node size")}
            value={s.nodeSize}
            min={0.6}
            max={1.8}
            step={0.1}
            onChange={(v) => update("nodeSize", v)}
          />
          <Range
            label={t("角色名大小", "Name size")}
            value={s.labelSize}
            min={0.6}
            max={2}
            step={0.1}
            unit="×"
            onChange={(v) => update("labelSize", v)}
          />
          <Toggle
            label={t("显示角色名", "Show names")}
            checked={s.labels}
            onChange={(v) => update("labels", v)}
          />
          <Toggle
            label={t("显示关系方向", "Show directions")}
            checked={s.arrows}
            onChange={(v) => update("arrows", v)}
          />
          <Toggle
            label={t("显示关系类型", "Show relation types")}
            checked={s.edgeLabels}
            onChange={(v) => update("edgeLabels", v)}
          />
          <p className="control-note">
            {t(
              "关系强度按两人同场出现的事件数换算到 0–1；角色较多时默认隐藏发言少的角色。",
              "Tie strength scales shared events to 0–1. Large casts hide characters with few lines by default.",
            )}
          </p>
        </section>
        <section className="control-section">
          <h3>{t("背景动效", "Background motion")}</h3>
          <Range
            label={t("背景亮度", "Background brightness")}
            value={s.flowOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => update("flowOpacity", v)}
          />
          <Range
            label={t("角色对背景的影响", "Pull of characters on background")}
            value={s.flowGravity}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => update("flowGravity", v)}
          />
          <Range
            label={t("影响背景的角色数", "Characters pulling the background")}
            value={s.gravityNodes}
            min={1}
            max={5}
            onChange={(v) => update("gravityNodes", v)}
          />
          <p className="control-note">
            {t(
              "默认关闭：亮度为 0 时不渲染背景，节省性能。调高亮度后，关系最多的几个角色会带动背景线条。首页不受这里影响。",
              "Off by default: at brightness 0 the background is not drawn, which saves power. Raise it and the best-connected characters pull the lines around. The home page is not affected.",
            )}
          </p>
          <Range
            label={t("背景线条数量", "Background lines")}
            value={s.particles}
            min={0}
            max={3000}
            step={100}
            onChange={(v) => update("particles", v)}
          />
          <Range
            label={t("流动速度", "Flow speed")}
            value={s.speed}
            min={0.1}
            max={2}
            step={0.05}
            unit="×"
            onChange={(v) => update("speed", v)}
          />
          <Range
            label={t("线条弯曲程度", "Line curl")}
            value={s.turbulence}
            min={0.2}
            max={3}
            step={0.1}
            onChange={(v) => update("turbulence", v)}
          />
          <Toggle
            label={t("播放动效", "Play motion")}
            checked={s.animate}
            onChange={(v) => update("animate", v)}
          />
        </section>
        <section className="control-section">
          <h3>{t("配色", "Palette")}</h3>
          <div className="palette-row">
            {Object.entries(palettes).map(([key, p]) => (
              <button
                key={key}
                className={s.palette === key ? "active" : ""}
                aria-label={t(p.name + "配色", p.en + " palette")}
                aria-pressed={s.palette === key}
                onClick={() => update("palette", key as Settings["palette"])}
              >
                <span
                  className="palette-swatch"
                  style={{
                    background: `linear-gradient(125deg,${p.colors[0]},${p.bg} 53%,${p.colors[1]})`,
                  }}
                />
                <small>{t(p.name, p.en)}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="control-section">
          <h3>{t("导出", "Export")}</h3>
          <button className="wide-button" onClick={onExport}>
            <Download size={14} /> {t("导出图片（SVG）", "Export image (SVG)")}{" "}
            <ArrowUpRight size={14} />
          </button>
          <p className="control-note">
            {t(
              "导出当前画面中可见的角色和关系，格式为 SVG 矢量图。",
              "Exports the characters and relations currently visible as an SVG vector image.",
            )}
          </p>
          <button className="text-button" onClick={onReset}>
            <RotateCcw size={12} /> {t("恢复默认设置", "Reset settings")}
          </button>
        </section>
      </div>
    </>
  );
}
