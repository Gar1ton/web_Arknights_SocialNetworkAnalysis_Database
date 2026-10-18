import { useMemo } from "react";
import { X } from "lucide-react";
import Select from "../Select";
import {
  type ArchiveData,
  type AtlasNode,
  bigFiveNames,
  kindName,
  level,
  nodeName,
  octantKeys,
  octantName,
} from "../data";
import { t } from "../i18n";
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
          {nodeName(n)}
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
      label={t("选择角色", "Choose a character")}
      placeholder={t("选择角色…", "Choose a character…")}
      value={draft.nodeId}
      nodes={nodes}
      onChange={(id) => update({ nodeId: id })}
    />
  );
  if (draft.type === "merge")
    return (
      <div className="report-section">
        <span className="report-label">
          {t(
            "哪些角色应该是同一个人？（至少 2 个）",
            "Which characters are the same person? (at least 2)",
          )}
        </span>
        {draft.people.length > 0 && (
          <div className="report-tags">
            {draft.people.map((id) => (
              <span className="report-tag" key={id}>
                {byId.has(id) ? nodeName(byId.get(id)!) : id}
                <button
                  type="button"
                  aria-label={t(
                    `移除${byId.get(id)?.name ?? ""}`,
                    `Remove ${byId.has(id) ? nodeName(byId.get(id)!) : ""}`,
                  )}
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
          label={t("添加角色", "Add a character")}
          placeholder={t(
            "＋ 从本剧情选择角色",
            "+ Pick a character from this story",
          )}
          value=""
          nodes={nodes.filter((n) => !draft.people.includes(n.id))}
          onChange={(id) => id && update({ people: [...draft.people, id] })}
        />
        <p className="report-hint">
          {t(
            "本站默认不跨剧情合并无名角色：不同剧情里同名的无名角色是不同的人。",
            "Unnamed characters are never merged across stories: same-named unnamed characters in different stories are different people.",
          )}
        </p>
      </div>
    );
  if (draft.type === "name")
    return (
      <>
        <div className="report-section">
          <span className="report-label">
            {t("哪个角色", "Which character")}
          </span>
          {pickNode}
          {node && (
            <p className="report-current">
              {t("当前显示：", "Shown as: ")}
              <b>{node.name}</b> · {kindName(node.kind)} ·{" "}
              {t("英文名：", "English name: ")}
              {node.en || t("空", "none")}
            </p>
          )}
        </div>
        <label className="report-section">
          <span className="report-label">
            {t("正确的名字（可选）", "Correct name (optional)")}
          </span>
          <input
            className="report-input"
            value={draft.correctName}
            placeholder={t("例如：塔露拉 / Talulah", "E.g. Talulah / 塔露拉")}
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
          <span className="report-label">
            {t("是哪一组关系", "Which relation")}
          </span>
          {pickNode}
          {node &&
            (links.length ? (
              <Select
                aria-label={t("选择关系", "Choose a relation")}
                value=""
                onChange={(e) =>
                  e.target.value && update({ edgeId: e.target.value })
                }
              >
                <option value="">
                  {t("选择和谁的关系…", "Relation with whom…")}
                </option>
                {links.map((e) => {
                  const other = byId.get(
                    e.source === node.id ? e.target : e.source,
                  );
                  const d = e.source === node.id ? e.ab || e.ba : e.ba || e.ab;
                  return (
                    <option key={e.id} value={e.id}>
                      {other && nodeName(other)} · {d ? octantName(d.type) : ""}
                    </option>
                  );
                })}
              </Select>
            ) : (
              <p className="report-hint">
                {t(
                  "这个角色在本剧情里没有关系记录。缺少的关系请用「其他问题」报告。",
                  "This character has no relations in this story. Report a missing relation under \u201cSomething else\u201d.",
                )}
              </p>
            ))}
        </div>
      );
    }
    const name = (id: string) => (byId.has(id) ? nodeName(byId.get(id)!) : "");
    const a = name(edge.source),
      b = name(edge.target);
    const none = t("无记录", "not recorded");
    const directions: [RelationDirection, string, string?][] = [
      ["ab", `${a} → ${b}`, edge.ab ? octantName(edge.ab.type) : none],
      ["ba", `${b} → ${a}`, edge.ba ? octantName(edge.ba.type) : none],
      ["both", t("两个方向都有", "Both directions")],
      ["notReal", t("这组关系不该存在", "This relation should not exist")],
    ];
    return (
      <>
        <fieldset className="report-section">
          <legend className="report-label">
            {t("哪个方向有问题", "Which direction is wrong")}
          </legend>
          <div className="report-tags">
            <span className="report-tag">
              {a} ⇄ {b}
            </span>
            <button
              type="button"
              className="report-text-button"
              onClick={() => update({ edgeId: "", direction: null })}
            >
              {t("换一组关系", "Pick another relation")}
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
          <span className="report-label">
            {t("你认为应该是（可选）", "What it should be (optional)")}
          </span>
          <Select
            aria-label={t("你认为应该是哪种关系", "What relation it should be")}
            value={draft.suggestedType}
            onChange={(e) =>
              update({
                suggestedType: e.target.value as Draft["suggestedType"],
              })
            }
          >
            <option value="">{t("不填", "Skip")}</option>
            {octantKeys.map((k) => (
              <option key={k} value={k}>
                {octantName(k)}
              </option>
            ))}
            <option value="unsure">{t("不确定", "Not sure")}</option>
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
        <span className="report-label">
          {t(
            "哪个角色 · 只填有意见的项",
            "Which character · mark only the traits you disagree with",
          )}
        </span>
        {pickNode}
        {node && (
          <table className="report-traits">
            <thead>
              <tr>
                <th scope="col">{t("维度", "Trait")}</th>
                <th scope="col">{t("当前", "Now")}</th>
                <th scope="col">{t("应更高", "Higher")}</th>
                <th scope="col">{t("应更低", "Lower")}</th>
              </tr>
            </thead>
            <tbody>
              {bigFiveNames().map((label, i) => {
                const score = node.profile.bigFive[i];
                return (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>
                      {score == null
                        ? t("未评分", "not scored")
                        : `${score} ${level(score)}`}
                    </td>
                    {(["higher", "lower"] as TraitVote[]).map((v) => (
                      <td key={v}>
                        <button
                          type="button"
                          className="report-vote"
                          aria-pressed={draft.traits[i] === v}
                          aria-label={
                            label +
                            (v === "higher"
                              ? t("应更高", " should be higher")
                              : t("应更低", " should be lower"))
                          }
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
