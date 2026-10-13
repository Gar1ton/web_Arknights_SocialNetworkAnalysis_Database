import { ArrowUpRight, ChevronLeft, Focus } from "lucide-react";
import { factions, nodeById, type AtlasNode, type AtlasEdge } from "./data";
function Metric({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
export function EdgeDetail({
  edge,
  onBack,
  onSelect,
}: {
  edge: AtlasEdge;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  const a = nodeById.get(edge.source)!,
    b = nodeById.get(edge.target)!;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回节点导航
      </button>
      <div className="detail-content">
        <span className="eyebrow">RELATIONSHIP / {edge.id.toUpperCase()}</span>
        <h2 className="edge-names">
          <button onClick={() => onSelect(a.id)}>{a.name}</button>
          <span>{edge.mutual ? "⇄" : "→"}</span>
          <button onClick={() => onSelect(b.id)}>{b.name}</button>
        </h2>
        <span className="tag">{edge.label}</span>
        <span className="tag">{edge.mutual ? "双向关系" : "单向关系"}</span>
        <p className="detail-prose">
          关系被看见的瞬间，孤立的节点开始拥有意义。
        </p>
        <div className="detail-metrics">
          <Metric value={edge.messages} label="演示互动数" />
          <Metric value={edge.weight.toFixed(2)} label="关系强度" />
        </div>
        <h3 className="mini-heading">方向与倾向</h3>
        <p className="control-note">
          {a.name} → {b.name}
          {edge.mutual ? "（反向关系存在，以下为正向属性）" : ""}
        </p>
        {[
          ["情感倾向", edge.affect, "疏离", "亲近"],
          ["权力倾向", edge.power, "追随", "主导"],
        ].map(([label, val, left, right]) => (
          <div key={label} className="sentiment">
            <div>
              <span>{label}</span>
              <b>
                {Number(val) > 0 ? "+" : ""}
                {Number(val).toFixed(2)}
              </b>
            </div>
            <div className="sentiment-track">
              <i style={{ left: `${(Number(val) + 1) * 50}%` }} />
            </div>
            <small>
              <span>{left}</span>
              <span>{right}</span>
            </small>
          </div>
        ))}
        <div className="evidence-note">
          <span className="eyebrow">DEMO EVIDENCE</span>
          <p>
            此关系与数值为界面演示构造，不代表原作设定或真实 SNA
            分析。真实证据将在数据接入后呈现。
          </p>
        </div>
      </div>
    </>
  );
}
export function NodeDetail({
  node,
  graphEdges,
  onBack,
  onSelect,
  onEdge,
  onEgo,
}: {
  node: AtlasNode;
  graphEdges: AtlasEdge[];
  onBack: () => void;
  onSelect: (id: string) => void;
  onEdge: (id: string) => void;
  onEgo: () => void;
}) {
  const links = graphEdges
    .filter((e) => e.source === node.id || e.target === node.id)
    .sort((a, b) => b.weight - a.weight);
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={14} /> 返回节点导航
      </button>
      <div className="detail-content">
        <div
          className="profile-emblem"
          style={
            {
              "--node-color": factions[node.faction].color,
            } as React.CSSProperties
          }
        >
          <span>{factions[node.faction].short}</span>
          <i />
          <i />
          <i />
        </div>
        <span className="eyebrow">
          OPERATOR / {node.id.slice(1).padStart(3, "0")}
        </span>
        <h2 className="profile-name">
          {node.name}
          <em>{node.en}</em>
        </h2>
        <div className="tags">
          {node.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <p className="detail-prose">{node.description}</p>
        <div className="detail-metrics">
          <Metric value={links.length} label="关联节点" />
          <Metric value={node.messages} label="演示消息数" />
          <Metric
            value={`${Math.round(node.confidence * 100)}%`}
            label="演示置信度"
          />
        </div>
        <button className="wide-button" onClick={onEgo}>
          <Focus size={15} /> 探索此节点的邻域 <ArrowUpRight size={15} />
        </button>
        <h3 className="mini-heading">
          人格轮廓 <span>ILLUSTRATIVE</span>
        </h3>
        <div className="traits">
          {["开放性", "尽责性", "外向性", "宜人性", "神经质"].map(
            (label, i) => (
              <div key={label}>
                <span>{label}</span>
                <div>
                  <i style={{ width: node.traits[i] + "%" }} />
                </div>
                <b>{node.traits[i]}</b>
              </div>
            ),
          )}
        </div>
        <h3 className="mini-heading">
          关系轨迹 <span>{links.length} CONNECTIONS</span>
        </h3>
        <div className="connections">
          {links.map((e) => {
            const other = nodeById.get(
              e.source === node.id ? e.target : e.source,
            )!;
            return (
              <div key={e.id}>
                <button
                  className="connection-name"
                  onClick={() => onSelect(other.id)}
                >
                  <i style={{ background: factions[other.faction].color }} />
                  {other.name}
                  <small>
                    {e.mutual ? "⇄" : e.source === node.id ? "→" : "←"}
                  </small>
                </button>
                <button
                  className="connection-type"
                  onClick={() => onEdge(e.id)}
                  aria-label={`查看${node.name}与${other.name}的关系详情`}
                >
                  {e.label} <ArrowUpRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="control-note">档案、人格分数及关系均为演示内容。</p>
      </div>
    </>
  );
}
