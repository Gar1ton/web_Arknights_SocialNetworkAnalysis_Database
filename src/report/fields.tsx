import { useMemo } from "react";
import { X } from "lucide-react";
import Select from "../Select";
import {
  type ArchiveData,
  type AtlasNode,
  bigFiveNames,
  kindNames,
  level,
  octantKeys,
  octants,
} from "../data";
import type { Draft, RelationDirection, TraitVote } from "./report";
type Props = {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
  data: ArchiveData;
  byId: Map<string, AtlasNode>;
};
function CharacterSelect({
  label,
  placeholder,
  value,
  nodes,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  nodes: AtlasNode[];
  onChange: (id: string) => void;
}) {
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {nodes.map((n) => (
        <option key={n.id} value={n.id}>
          {n.name}
        </option>
      ))}
    </Select>
  );
}
/** The preset fields of one problem type: two at most, all but the target optional. */
export default function TypeFields({ draft, update, data, byId }: Props) {
  const nodes = useMemo(
    () => [...data.nodes].sort((a, b) => b.messages - a.messages),
    [data],
  );
  const node = byId.get(draft.nodeId);
  const pickNode = (
    <CharacterSelect
      label="选择角色"
      placeholder="选择角色…"
      value={draft.nodeId}
      nodes={nodes}
      onChange={(id) => update({ nodeId: id })}
    />
  );
  if (draft.type === "merge")
    return (
      <div className="report-section">
        <span className="report-label">
          哪些角色应该是同一个人？（至少 2 个）
        </span>
        {draft.people.length > 0 && (
          <div className="report-tags">
            {draft.people.map((id) => (
              <span className="report-tag" key={id}>
                {byId.get(id)?.name ?? id}
                <button
                  type="button"
                  aria-label={`移除${byId.get(id)?.name ?? ""}`}
                  onClick={() =>
                    update({ people: draft.people.filter((p) => p !== id) })
                  }
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <CharacterSelect
          label="添加角色"
          placeholder="＋ 从本剧情选择角色"
          value=""
          nodes={nodes.filter((n) => !draft.people.includes(n.id))}
          onChange={(id) => id && update({ people: [...draft.people, id] })}
        />
        <p className="report-hint">
          本站默认不跨剧情合并无名角色：不同剧情里同名的无名角色是不同的人。
        </p>
      </div>
    );
  if (draft.type === "name")
    return (
      <>
        <div className="report-section">
          <span className="report-label">哪个角色</span>
          {pickNode}
          {node && (
            <p className="report-current">
              当前显示：<b>{node.name}</b> · {kindNames[node.kind]} · 英文名：
              {node.en || "空"}
            </p>
          )}
        </div>
        <label className="report-section">
          <span className="report-label">正确的名字（可选）</span>
          <input
            className="report-input"
            value={draft.correctName}
            placeholder="例如：塔露拉 / Talulah"
            onChange={(e) => update({ correctName: e.target.value })}
          />
        </label>
      </>
    );
  if (draft.type === "relation") {
    const edge = data.edges.find((e) => e.id === draft.edgeId);
    if (!edge) {
      const links = data.edges
        .filter((e) => e.source === draft.nodeId || e.target === draft.nodeId)
        .sort((a, b) => b.weight - a.weight);
      return (
        <div className="report-section">
          <span className="report-label">是哪一组关系</span>
          {pickNode}
          {node &&
            (links.length ? (
              <Select
                aria-label="选择关系"
                value=""
                onChange={(e) =>
                  e.target.value && update({ edgeId: e.target.value })
                }
              >
                <option value="">选择和谁的关系…</option>
                {links.map((e) => {
                  const other = byId.get(
                    e.source === node.id ? e.target : e.source,
                  );
                  const d = e.source === node.id ? e.ab || e.ba : e.ba || e.ab;
                  return (
                    <option key={e.id} value={e.id}>
                      {other?.name} · {d ? octants[d.type].name : ""}
                    </option>
                  );
                })}
              </Select>
            ) : (
              <p className="report-hint">
                这个角色在本剧情里没有关系记录。缺少的关系请用「其他问题」报告。
              </p>
            ))}
        </div>
      );
    }
    const a = byId.get(edge.source)?.name ?? "",
      b = byId.get(edge.target)?.name ?? "";
    const directions: [RelationDirection, string, string?][] = [
      ["ab", `${a} → ${b}`, edge.ab ? octants[edge.ab.type].name : "无记录"],
      ["ba", `${b} → ${a}`, edge.ba ? octants[edge.ba.type].name : "无记录"],
      ["both", "两个方向都有"],
      ["notReal", "这组关系不该存在"],
    ];
    return (
      <>
        <fieldset className="report-section">
          <legend className="report-label">哪个方向有问题</legend>
          <div className="report-tags">
            <span className="report-tag">
              {a} ⇄ {b}
            </span>
            <button
              type="button"
              className="report-text-button"
              onClick={() => update({ edgeId: "", direction: null })}
            >
              换一组关系
            </button>
          </div>
          {directions.map(([key, label, type]) => (
            <label key={key} className="report-check">
              <input
                type="radio"
                name="report-direction"
                checked={draft.direction === key}
                onChange={() => update({ direction: key })}
              />
              {label}
              {type && <small>· {type}</small>}
            </label>
          ))}
        </fieldset>
        <div className="report-section">
          <span className="report-label">你认为应该是（可选）</span>
          <Select
            aria-label="你认为应该是哪种关系"
            value={draft.suggestedType}
            onChange={(e) =>
              update({
                suggestedType: e.target.value as Draft["suggestedType"],
              })
            }
          >
            <option value="">不填</option>
            {octantKeys.map((k) => (
              <option key={k} value={k}>
                {octants[k].name}
              </option>
            ))}
            <option value="unsure">不确定</option>
          </Select>
        </div>
      </>
    );
  }
  if (draft.type === "personality") {
    const vote = (i: number, v: TraitVote) =>
      update({
        traits: draft.traits.map((old, j) =>
          j === i ? (old === v ? null : v) : old,
        ),
      });
    return (
      <div className="report-section">
        <span className="report-label">哪个角色 · 只填有意见的项</span>
        {pickNode}
        {node && (
          <table className="report-traits">
            <thead>
              <tr>
                <th scope="col">维度</th>
                <th scope="col">当前</th>
                <th scope="col">应更高</th>
                <th scope="col">应更低</th>
              </tr>
            </thead>
            <tbody>
              {bigFiveNames.map((label, i) => {
                const score = node.profile.bigFive[i];
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>
                      {score == null ? "未评分" : `${score} ${level(score)}`}
                    </td>
                    {(["higher", "lower"] as TraitVote[]).map((v) => (
                      <td key={v}>
                        <button
                          type="button"
                          className="report-vote"
                          aria-pressed={draft.traits[i] === v}
                          aria-label={`${label}${v === "higher" ? "应更高" : "应更低"}`}
                          onClick={() => vote(i, v)}
                        >
                          {v === "higher" ? "↑" : "↓"}
                        </button>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  return null;
}
