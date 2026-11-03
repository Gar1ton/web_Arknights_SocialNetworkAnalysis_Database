import { ArrowUpRight, ChevronLeft, Focus, History } from "lucide-react";
import {
  type AtlasNode,
  type AtlasEdge,
  type Community,
  type Direction,
  type Octant,
  altName,
  bigFiveNames,
  communityColor,
  isMutual,
  kindName,
  level,
  nodeName,
  octantName,
  octants,
  towards,
} from "./data";
import { lang, t } from "./i18n";
import IpcChart from "./IpcChart";
import { avatarUrl } from "./archives";
import { ReportButton } from "./report/ReportDialog";
import type { ReportTarget } from "./report/report";
import { HistoryChart, HistoryKey } from "./charts";
import { BEN, POW, SEQ, type StateRow } from "./model/types";
function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
const percent = (v: number) => Math.round(v * 100) + "%";
const signed = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);
export function TypeTag({ type }: { type: Octant }) {
  return (
    <span className="tag ipc-tag" style={{ color: octants[type].color }}>
      <i style={{ background: octants[type].color }} />
      {octantName(type)}
    </span>
  );
}
function Scale({
  label,
  value,
  left,
  right,
}: {
  label: string;
  value: number;
  left: string;
  right: string;
}) {
  return (
    <div className="sentiment">
      <div>
        <span>{label}</span>
        <b>{signed(value)}</b>
      </div>
      <div className="sentiment-track">
        <i style={{ left: `${(value + 1) * 50}%` }} />
      </div>
      <small>
        <span>{left}</span>
        <span>{right}</span>
      </small>
    </div>
  );
}
/** What the timeline needs to know to draw a relation over the story. */
export type Timeline = {
  m: number;
  cur: number;
  position: (pos: number) => string;
  onSeek: (pos: number) => void;
};
function DirectionBlock({
  from,
  to,
  d,
  rows,
  timeline,
}: {
  from: string;
  to: string;
  d: Direction | null;
  rows: StateRow[];
  timeline: Timeline;
}) {
  const first = rows[0];
  return (
    <div className="direction-block">
      <h3 className="mini-heading">
        {t(`${from} 对 ${to}`, `${from} → ${to}`)}
        {d && <TypeTag type={d.type} />}
      </h3>
      {d ? (
        <>
          <Scale
            label={t("友善度", "Affiliation")}
            value={d.benevolence}
            left={t("敌对", "hostile")}
            right={t("友善", "friendly")}
          />
          <Scale
            label={t("支配度", "Dominance")}
            value={d.power}
            left={t("顺从", "submissive")}
            right={t("主导", "dominant")}
          />
          <p className="direction-facts">
            {t("情感强度", "Affect intensity")} <b>{percent(d.intensity)}</b>
            <span>·</span>
            {t("变化", "changed")} <b>{rows.length - 1}</b>{" "}
            {t("次", rows.length === 2 ? "time" : "times")}
          </p>
        </>
      ) : (
        <p className="control-note">
          {first
            ? t(
                `此时还没有形成，${timeline.position(first[SEQ])}才出现。`,
                `Not formed yet; it appears at ${timeline.position(first[SEQ])}.`,
              )
            : t(
                "没有记录到这个方向的态度。",
                "No attitude recorded in this direction.",
              )}
        </p>
      )}
      {rows.length > 0 && (
        <HistoryChart
          rows={rows.map((r) => [r[SEQ], r[BEN], r[POW]])}
          m={timeline.m}
          cur={timeline.cur}
          position={timeline.position}
          onSeek={timeline.onSeek}
        />
      )}
    </div>
  );
}
export function EdgeDetail({
  edge,
  byId,
  history,
  timeline,
  pairHref,
  onBack,
  onSelect,
  onReport,
}: {
  edge: AtlasEdge;
  byId: Map<string, AtlasNode>;
  /** source → target and target → source, over the whole story. */
  history: { ab: StateRow[]; ba: StateRow[] };
  timeline: Timeline;
  pairHref: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onReport: (target: ReportTarget) => void;
}) {
  const a = byId.get(edge.source)!,
    b = byId.get(edge.target)!;
  const points = [
    ...(edge.ab
      ? [
          {
            ...edge.ab,
            color: octants[edge.ab.type].color,
            arrow: true,
            label: nodeName(a) + "→" + nodeName(b),
          },
        ]
      : []),
    ...(edge.ba
      ? [
          {
            ...edge.ba,
            color: octants[edge.ba.type].color,
            arrow: true,
            label: nodeName(b) + "→" + nodeName(a),
          },
        ]
      : []),
  ];
  const formed = Math.min(
    ...[history.ab[0], history.ba[0]].filter(Boolean).map((r) => r[SEQ]),
  );
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> {t("返回", "Back")}
      </button>
      <div className="detail-content">
        <span className="eyebrow">{t("关系详情", "Relation")}</span>
        <h2 className="edge-names">
          <button onClick={() => onSelect(a.id)}>{nodeName(a)}</button>
          <span>{isMutual(edge) ? "⇄" : edge.ab ? "→" : "←"}</span>
          <button onClick={() => onSelect(b.id)}>{nodeName(b)}</button>
        </h2>
        <div className="tags">
          <span className="tag">
            {isMutual(edge)
              ? t("此刻双向都有", "Both ways at this point")
              : t("此刻只有单向", "One way only at this point")}
          </span>
          <ReportButton
            onClick={() => onReport({ kind: "edge", edgeId: edge.id })}
          />
        </div>
        <div className="detail-metrics">
          <Metric value={edge.events} label={t("同场事件", "Shared events")} />
          <Metric
            value={edge.weight.toFixed(2)}
            label={t("关系强度", "Tie strength")}
          />
        </div>
        <p className="control-note">
          {t(
            `从剧情开头到当前位置，两人同时出场的事件数；关系强度把它换算到 0–1。这段关系在${timeline.position(formed)}首次出现。`,
            `Events both appear in, from the start of the story to this point; tie strength scales that to 0–1. The relation first appears at ${timeline.position(formed)}.`,
          )}
        </p>
        <h3 className="mini-heading">
          {t("人际态度（IPC）", "Interpersonal circumplex (IPC)")}
          <span>{t("当前位置", "at this point")}</span>
        </h3>
        <IpcChart
          points={points}
          label={t(
            `${a.name}与${b.name}的人际态度坐标图`,
            `Attitude chart of ${nodeName(a)} and ${nodeName(b)}`,
          )}
        />
        <DirectionBlock
          from={nodeName(a)}
          to={nodeName(b)}
          d={edge.ab}
          rows={history.ab}
          timeline={timeline}
        />
        <DirectionBlock
          from={nodeName(b)}
          to={nodeName(a)}
          d={edge.ba}
          rows={history.ba}
          timeline={timeline}
        />
        <HistoryKey />
        <a className="wide-button" href={pairHref}>
          <History size={15} />{" "}
          {t("这两人在其他剧情里", "This pair in other stories")}{" "}
          <ArrowUpRight size={15} />
        </a>
        <div className="evidence-note">
          <span className="eyebrow">
            {t("怎么看这张图", "Reading this chart")}
          </span>
          <p>
            {t(
              "横轴是友善度（右友善、左敌对），纵轴是支配度（上主导、下顺从），按所在区域归为八种关系类型。下面两张小图是每个方向随剧情的变化：实线友善度，虚线支配度，竖线是当前位置。数值由大模型根据剧情对话推断，不是官方设定。",
              "The horizontal axis is affiliation (friendly right, hostile left), the vertical axis dominance (dominant up, submissive down); the region a point falls in gives one of eight relation types. The two small charts follow each direction through the story: solid affiliation, dashed dominance, the upright line marks this point. Values are inferred by a language model from the dialogue and are not official lore.",
            )}
          </p>
        </div>
      </div>
    </>
  );
}
function Breakdown({
  title,
  items,
}: {
  title: string;
  items: (Direction | null)[];
}) {
  const counts = new Map<Octant, number>();
  for (const d of items)
    if (d) counts.set(d.type, (counts.get(d.type) || 0) + 1);
  const total = [...counts.values()].reduce((s, v) => s + v, 0);
  const sorted = [...counts].sort((x, y) => y[1] - x[1]);
  return (
    <div className="breakdown">
      <span>{title}</span>
      {total ? (
        <>
          <div className="breakdown-bar">
            {sorted.map(([k, v]) => (
              <i
                key={k}
                title={`${octantName(k)} ${v}`}
                style={{ flex: v, background: octants[k].color }}
              />
            ))}
          </div>
          <small>
            {sorted
              .slice(0, 3)
              .map(([k, v]) => `${octantName(k)} ${v}`)
              .join(" · ")}
          </small>
        </>
      ) : (
        <small>{t("暂无记录", "None recorded")}</small>
      )}
    </div>
  );
}
export function NodeDetail({
  node,
  graphEdges,
  byId,
  communities,
  avatar,
  where,
  personHref,
  onBack,
  onSelect,
  onEdge,
  onEgo,
  onReport,
}: {
  node: AtlasNode;
  graphEdges: AtlasEdge[];
  byId: Map<string, AtlasNode>;
  communities: Community[];
  avatar?: string;
  /** "line 1,234 of 5,279", for the Big Five note. */
  where: string;
  personHref: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onEgo: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const links = graphEdges
    .filter((e) => e.source === node.id || e.target === node.id)
    .sort((a, b) => b.weight - a.weight || b.events - a.events);
  const outgoing = links.map((e) => towards(e, node.id));
  const incoming = links.map((e) =>
    towards(e, e.source === node.id ? e.target : e.source),
  );
  const color = communityColor(node.community, communities);
  const scored = node.profile.bigFive.some((v) => v != null);
  const en = lang() === "en";
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> {t("返回", "Back")}
      </button>
      <div className="detail-content">
        <div
          className={"profile-emblem" + (avatar ? " has-avatar" : "")}
          style={{ "--node-color": color } as React.CSSProperties}
        >
          {avatar ? (
            <img key={avatar} src={avatarUrl(avatar)} alt="" />
          ) : (
            <span aria-hidden="true">
              {[...nodeName(node).replace(/^[“"]/, "")][0]}
            </span>
          )}
          <i />
          <i />
          <i />
        </div>
        <span className="eyebrow">{kindName(node.kind)}</span>
        <h2 className="profile-name">
          {nodeName(node)}
          {altName(node) && <em>{altName(node)}</em>}
        </h2>
        <div className="tags">
          <span className="tag">
            {t("社群：", "Community: ")}
            {communities[node.community]?.label}
          </span>
          <ReportButton
            onClick={() => onReport({ kind: "node", nodeId: node.id })}
          />
        </div>
        <p className="detail-prose" lang="zh-CN">
          {node.profile.description || t("暂无性格简述。", "No profile yet.")}
        </p>
        {en && node.profile.description && (
          <p className="control-note">
            Profile notes are written in Chinese for now.
          </p>
        )}
        <div className="detail-metrics">
          <Metric value={links.length} label={t("关系数", "Relations")} />
          <Metric value={node.messages} label={t("发言数", "Lines")} />
          <Metric
            value={node.betweenness.toFixed(2)}
            label={t("中介中心性", "Betweenness centrality")}
          />
        </div>
        <p className="control-note">
          {t(
            "关系数和中介中心性按当前剧情位置计算，随时间轴变化；发言数是这段剧情里的全部台词条数。",
            "Relations and betweenness follow the timeline; lines count everything the character says in this story.",
          )}
        </p>
        <button className="wide-button" onClick={onEgo}>
          <Focus size={15} /> {t("只看 TA 的关系圈", "Show only their circle")}{" "}
          <ArrowUpRight size={15} />
        </button>
        <a className="wide-button quiet" href={personHref}>
          <History size={15} /> {t("TA 在全部剧情里", "Across every story")}{" "}
          <ArrowUpRight size={15} />
        </a>
        <h3 className="mini-heading">
          {t("大五人格", "Big Five")} <span>0–100</span>
        </h3>
        {scored ? (
          <>
            <div className="traits">
              {bigFiveNames().map((label, i) => {
                const v = node.profile.bigFive[i];
                return (
                  <div key={label} className={v == null ? "unscored" : ""}>
                    <span>{label}</span>
                    <div>
                      <i style={{ width: (v ?? 0) + "%" }} />
                    </div>
                    <b>{v == null ? "—" : `${v} ${level(v)}`}</b>
                  </div>
                );
              })}
            </div>
            <p className="control-note">
              {t(
                `从全部剧情的开头累积到这段剧情的${where}，时间轴移动时会跟着变。`,
                `Accumulated from the first story up to ${where} of this one; it moves with the timeline.`,
              )}
            </p>
          </>
        ) : (
          <p className="control-note">
            {t(
              "到这里为止台词还太少，未做人格评分。",
              "Too few lines up to here to score a personality.",
            )}
          </p>
        )}
        <h3 className="mini-heading">
          {t("人际态度（IPC）", "Interpersonal circumplex (IPC)")}{" "}
          <span>
            {t(
              `${links.length} 组关系`,
              `${links.length} ${links.length === 1 ? "relation" : "relations"}`,
            )}
          </span>
        </h3>
        <IpcChart
          label={t(
            `${node.name}的人际态度分布`,
            `Attitudes around ${nodeName(node)}`,
          )}
          points={[
            ...incoming.flatMap((d) =>
              d ? [{ ...d, color: octants[d.type].color, hollow: true }] : [],
            ),
            ...outgoing.flatMap((d) =>
              d ? [{ ...d, color: octants[d.type].color }] : [],
            ),
          ]}
        />
        <p className="ipc-legend">
          <span>● {t("TA 对别人", "Them to others")}</span>
          <span>○ {t("别人对 TA", "Others to them")}</span>
        </p>
        <Breakdown title={t("TA 对别人", "Them to others")} items={outgoing} />
        <Breakdown title={t("别人对 TA", "Others to them")} items={incoming} />
        <h3 className="mini-heading">
          {t("关系列表", "Relations")}{" "}
          <span>{t("按关系强度", "by tie strength")}</span>
        </h3>
        <div className="connections">
          {links.map((e) => {
            const other = byId.get(e.source === node.id ? e.target : e.source)!;
            const d = towards(e, node.id) || towards(e, other.id)!;
            return (
              <div key={e.id}>
                <button
                  className="connection-name"
                  onClick={() => onSelect(other.id)}
                >
                  <i
                    style={{
                      background: communityColor(other.community, communities),
                    }}
                  />
                  {nodeName(other)}
                  <small>
                    {isMutual(e) ? "⇄" : towards(e, node.id) ? "→" : "←"}
                  </small>
                </button>
                <button
                  className="connection-type"
                  onClick={() => onEdge(e.id)}
                  aria-label={t(
                    `查看${node.name}与${other.name}的关系详情`,
                    `Relation between ${nodeName(node)} and ${nodeName(other)}`,
                  )}
                  style={{ color: octants[d.type].color }}
                >
                  {octantName(d.type)} <ArrowUpRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="control-note">
          {t(
            "人格评分与关系数值由大模型根据剧情对话推断，仅供参考，不是官方设定。",
            "Personality scores and relation values are inferred by a language model from the dialogue. They are estimates, not official lore.",
          )}
        </p>
      </div>
    </>
  );
}
