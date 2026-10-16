import { ArrowUpRight, ChevronLeft, Focus } from "lucide-react";
import {
  type AtlasNode,
  type AtlasEdge,
  type Community,
  type Direction,
  type Octant,
  bigFiveNames,
  communityColor,
  isMutual,
  kindNames,
  level,
  octants,
  towards,
} from "./data";
import IpcChart from "./IpcChart";
import { avatarUrl, useMedia } from "./archives";
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
      {octants[type].name}
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
        {from} 对 {to}
        {d && <TypeTag type={d.type} />}
      </h3>
      {d ? (
        <>
          <Scale
            label="友善度"
            value={d.benevolence}
            left="敌对"
            right="友善"
          />
          <Scale label="支配度" value={d.power} left="顺从" right="主导" />
          <p className="direction-facts">
            情感强度 <b>{percent(d.intensity)}</b>
            <span>·</span>可信度 <b>{percent(d.confidence)}</b>
            <span>·</span>依据 <b>{d.evidence}</b> 个事件
            {d.scopes ? (
              <>
                <span>·</span>来自 <b>{d.scopes}</b> 段剧情
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="control-note">没有记录到这个方向的态度。</p>
      )}
    </div>
  );
}
export function EdgeDetail({
  edge,
  byId,
  onBack,
  onSelect,
}: {
  edge: AtlasEdge;
  byId: Map<string, AtlasNode>;
  onBack: () => void;
  onSelect: (id: string) => void;
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
            label: a.name + "→" + b.name,
          },
        ]
      : []),
    ...(edge.ba
      ? [
          {
            ...edge.ba,
            color: octants[edge.ba.type].color,
            arrow: true,
            label: b.name + "→" + a.name,
          },
        ]
      : []),
  ];
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回角色列表
      </button>
      <div className="detail-content">
        <span className="eyebrow">关系详情</span>
        <h2 className="edge-names">
          <button onClick={() => onSelect(a.id)}>{a.name}</button>
          <span>{isMutual(edge) ? "⇄" : edge.ab ? "→" : "←"}</span>
          <button onClick={() => onSelect(b.id)}>{b.name}</button>
        </h2>
        <span className="tag">
          {isMutual(edge) ? "双向都有记录" : "只有单向记录"}
        </span>
        <div className="detail-metrics">
          <Metric value={edge.events} label="同场事件" />
          <Metric value={edge.weight.toFixed(2)} label="关系强度" />
        </div>
        <p className="control-note">
          关系强度按两人同时出场的事件数计算，在本页范围内换算到 0–1。
        </p>
        <h3 className="mini-heading">人际态度（IPC）</h3>
        <IpcChart
          points={points}
          label={`${a.name}与${b.name}的人际态度坐标图`}
        />
        <DirectionBlock from={a.name} to={b.name} d={edge.ab} />
        <DirectionBlock from={b.name} to={a.name} d={edge.ba} />
        <div className="evidence-note">
          <span className="eyebrow">怎么看这张图</span>
          <p>
            横轴是友善度（右友善、左敌对），纵轴是支配度（上主导、下顺从），按所在区域归为八种关系类型。数值由大模型根据剧情对话推断，不是官方设定。
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
                title={`${octants[k].name} ${v}`}
                style={{ flex: v, background: octants[k].color }}
              />
            ))}
          </div>
          <small>
            {sorted
              .slice(0, 3)
              .map(([k, v]) => `${octants[k].name} ${v}`)
              .join(" · ")}
          </small>
        </>
      ) : (
        <small>暂无记录</small>
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
}: {
  node: AtlasNode;
  graphEdges: AtlasEdge[];
  byId: Map<string, AtlasNode>;
  communities: Community[];
  onBack: () => void;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onEgo: () => void;
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
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回角色列表
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
              {[...node.name.replace(/^[“"]/, "")][0]}
            </span>
          )}
          <i />
          <i />
          <i />
        </div>
        <span className="eyebrow">{kindNames[node.kind]}</span>
        <h2 className="profile-name">
          {node.name}
          {node.en && <em>{node.en}</em>}
        </h2>
        <div className="tags">
          <span className="tag">
            社群：{communities[node.community]?.label}
          </span>
        </div>
        <p className="detail-prose">
          {node.profile.description || "暂无性格简述。"}
        </p>
        <div className="detail-metrics">
          <Metric value={links.length} label="关系数" />
          <Metric value={node.messages} label="发言数" />
          <Metric value={node.betweenness.toFixed(2)} label="中介中心性" />
        </div>
        <p className="control-note">
          发言数为本页范围内的台词条数；中介中心性越高，说明越常处在其他角色彼此联系的路径上。
        </p>
        <button className="wide-button" onClick={onEgo}>
          <Focus size={15} /> 只看 TA 的关系圈 <ArrowUpRight size={15} />
        </button>
        <h3 className="mini-heading">
          大五人格 <span>0–100</span>
        </h3>
        {scored ? (
          <>
            <div className="traits">
              {bigFiveNames.map((label, i) => {
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
                <summary>查看评分依据</summary>
                {bigFiveNames.map((label, i) =>
                  node.profile.evidence[i] ? (
                    <p key={label}>
                      <b>{label}</b>
                      {node.profile.evidence[i]}
                    </p>
                  ) : null,
                )}
              </details>
            )}
            <p className="control-note">
              根据该角色在全部剧情中的表现推断，画像可信度{" "}
              {percent(node.profile.confidence)}。
            </p>
          </>
        ) : (
          <p className="control-note">发言太少，未做人格评分。</p>
        )}
        <h3 className="mini-heading">
          人际态度（IPC） <span>{links.length} 组关系</span>
        </h3>
        <IpcChart
          label={`${node.name}的人际态度分布`}
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
          <span>● TA 对别人</span>
          <span>○ 别人对 TA</span>
        </p>
        <Breakdown title="TA 对别人" items={outgoing} />
        <Breakdown title="别人对 TA" items={incoming} />
        <h3 className="mini-heading">
          关系列表 <span>按关系强度</span>
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
                  {other.name}
                  <small>
                    {isMutual(e) ? "⇄" : towards(e, node.id) ? "→" : "←"}
                  </small>
                </button>
                <button
                  className="connection-type"
                  onClick={() => onEdge(e.id)}
                  aria-label={`查看${node.name}与${other.name}的关系详情`}
                  style={{ color: octants[d.type].color }}
                >
                  {octants[d.type].name} <ArrowUpRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="control-note">
          人格评分与关系数值由大模型根据剧情对话推断，仅供参考，不是官方设定。
        </p>
      </div>
    </>
  );
}
