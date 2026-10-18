import { ArrowUpRight, ChevronLeft, Focus } from "lucide-react";
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
import { avatarUrl, useMedia } from "./archives";
import { ReportButton } from "./report/ReportDialog";
import type { ReportTarget } from "./report/report";
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
function TypeTag({ type }: { type: Octant }) {
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
function DirectionBlock({
  from,
  to,
  d,
}: {
  from: string;
  to: string;
  d: Direction | null;
}) {
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
            {t("可信度", "confidence")} <b>{percent(d.confidence)}</b>
            <span>·</span>
            {t("依据", "based on")} <b>{d.evidence}</b>{" "}
            {t("个事件", d.evidence === 1 ? "event" : "events")}
            {d.scopes ? (
              <>
                <span>·</span>
                {t("来自", "from")} <b>{d.scopes}</b>{" "}
                {t("段剧情", d.scopes === 1 ? "story" : "stories")}
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="control-note">
          {t(
            "没有记录到这个方向的态度。",
            "No attitude recorded in this direction.",
          )}
        </p>
      )}
    </div>
  );
}
export function EdgeDetail({
  edge,
  byId,
  onBack,
  onSelect,
  onReport,
}: {
  edge: AtlasEdge;
  byId: Map<string, AtlasNode>;
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
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> {t("返回角色列表", "Back to characters")}
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
              ? t("双向都有记录", "Recorded both ways")
              : t("只有单向记录", "Recorded one way only")}
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
            "关系强度按两人同时出场的事件数计算，在本页范围内换算到 0–1。",
            "Tie strength counts the events both appear in, scaled to 0–1 within this story.",
          )}
        </p>
        <h3 className="mini-heading">
          {t("人际态度（IPC）", "Interpersonal circumplex (IPC)")}
        </h3>
        <IpcChart
          points={points}
          label={t(
            `${a.name}与${b.name}的人际态度坐标图`,
            `Attitude chart of ${nodeName(a)} and ${nodeName(b)}`,
          )}
        />
        <DirectionBlock from={nodeName(a)} to={nodeName(b)} d={edge.ab} />
        <DirectionBlock from={nodeName(b)} to={nodeName(a)} d={edge.ba} />
        <div className="evidence-note">
          <span className="eyebrow">
            {t("怎么看这张图", "Reading this chart")}
          </span>
          <p>
            {t(
              "横轴是友善度（右友善、左敌对），纵轴是支配度（上主导、下顺从），按所在区域归为八种关系类型。数值由大模型根据剧情对话推断，不是官方设定。",
              "The horizontal axis is affiliation (friendly right, hostile left), the vertical axis dominance (dominant up, submissive down); the region a point falls in gives one of eight relation types. Values are inferred by a language model from the dialogue and are not official lore.",
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
  const avatar = useMedia()?.avatars[node.id];
  const en = lang() === "en";
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> {t("返回角色列表", "Back to characters")}
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
            "发言数为本页范围内的台词条数；中介中心性越高，说明越常处在其他角色彼此联系的路径上。",
            "Lines are counted within this story. Higher betweenness centrality means the character more often sits on the paths that connect others.",
          )}
        </p>
        <button className="wide-button" onClick={onEgo}>
          <Focus size={15} /> {t("只看 TA 的关系圈", "Show only their circle")}{" "}
          <ArrowUpRight size={15} />
        </button>
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
            {node.profile.evidence.some(Boolean) && (
              <details className="trait-evidence">
                <summary>{t("查看评分依据", "Why these scores")}</summary>
                {bigFiveNames().map((label, i) =>
                  node.profile.evidence[i] ? (
                    <p key={label} lang="zh-CN">
                      <b>{label}</b>
                      {node.profile.evidence[i]}
                    </p>
                  ) : null,
                )}
              </details>
            )}
            <p className="control-note">
              {t(
                `根据该角色在全部剧情中的表现推断，画像可信度 ${percent(node.profile.confidence)}。`,
                `Inferred from the character across every story; profile confidence ${percent(node.profile.confidence)}.`,
              )}
            </p>
          </>
        ) : (
          <p className="control-note">
            {t(
              "发言太少，未做人格评分。",
              "Too few lines to score a personality.",
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
