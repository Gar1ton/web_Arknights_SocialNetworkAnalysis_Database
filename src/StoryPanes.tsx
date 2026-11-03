import { useEffect, useRef } from "react";
import { ArrowUpRight, ListTree } from "lucide-react";
import { type AtlasEdge, type AtlasNode, nodeName, octantName, octants, primary } from "./data";
import { plural, t } from "./i18n";
import IpcChart from "./IpcChart";
import { OctantBars } from "./charts";
import type { AtlasAt } from "./model/atlas";
import type { IndexedStory } from "./model/model";
const num = (n: number) => n.toLocaleString();
/** "[What] … [Who] … [How] …", several parts joined by " | ". */
export function summaryParts(text: string) {
  return String(text)
    .split(" | ")
    .map((part) => {
      const out: [string, string][] = [];
      part.split(/\[(What|Who|How)\]\s*/).forEach((x, i, all) => {
        if (i % 2 === 1 && all[i + 1]?.trim()) out.push([x, all[i + 1].trim()]);
      });
      return out.length ? out : [["", part.trim()] as [string, string]];
    });
}
const partNames: Record<string, [string, string]> = {
  What: ["发生", "What"],
  Who: ["人物", "Who"],
  How: ["经过", "How"],
};
/**
 * Every event of the story, by scene. The current event opens with its
 * summary and the list glides to keep it in the middle while the timeline is
 * dragged or played; events still to come are dimmed.
 */
export function EventsPane({
  story,
  cur,
  now,
  name,
  onJump,
  onPerson,
}: {
  story: IndexedStory;
  cur: number;
  now: number;
  name: (p: number) => string;
  onJump: (i: number) => void;
  onPerson: (p: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = current.current,
      container = box.current;
    if (!el || !container) return;
    // Rows sit in the list's own coordinates, whatever the offset parent is.
    const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    // The current event sits a little below the top, so its summary has room underneath.
    const top = offset - Math.min(container.clientHeight * 0.22, 120);
    container.scrollTo({
      top,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [now]);
  const ev = story.data.ev;
  const scenes = new Set(ev.map((e) => e[2])).size;
  let scene = -1;
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">{t("剧情事件", "Events")}</span>
        <h2>
          {num(ev.length)}
          {t(" 个", " ")}
          <em>{t("事件", ev.length === 1 ? "event" : "events")}</em>
        </h2>
        <p>
          {t(
            `${scenes} 个场景。列表跟着时间轴走：拖动、播放或点一个事件，关系网都会停在那里。`,
            `${plural("scene", scenes)}. The list follows the timeline: drag, play or click an event and the network moves there.`,
          )}
        </p>
      </div>
      <div className="event-list" ref={box}>
        {ev.map((e, i) => {
          const head =
            e[2] !== scene ? (
              <p key={"s" + e[2]} className="scene-head">
                <span>{t(`场景 ${String(e[2] + 1).padStart(2, "0")}`, `Scene ${String(e[2] + 1).padStart(2, "0")}`)}</span>
                <i />
                <small>{t(`第 ${num(e[0])} 句起`, `from line ${num(e[0])}`)}</small>
              </p>
            ) : null;
          scene = e[2];
          const state = i === now ? "now" : e[0] > cur ? "future" : "past";
          const who = e[5];
          return [
            head,
            <article
              key={i}
              className={"event-row " + state}
              ref={i === now ? current : undefined}
              aria-current={i === now ? "step" : undefined}
            >
              <button type="button" onClick={() => onJump(i)}>
                <span className="row-index">{String(i + 1).padStart(3, "0")}</span>
                <span className="event-title">
                  {e[3]}
                  <small>
                    {t(`${num(e[6])} 句`, plural("line", e[6]))} ·{" "}
                    {who.slice(0, 3).map(name).join(t("、", ", "))}
                    {who.length > 3 ? t(` 等 ${who.length} 人`, ` +${who.length - 3}`) : ""}
                  </small>
                </span>
              </button>
              {i === now && (
                <div className="event-summary" lang="zh-CN">
                  <p className="event-people">
                    {who.map((p) => (
                      <button key={p} type="button" onClick={() => onPerson(p)}>
                        {name(p)}
                      </button>
                    ))}
                  </p>
                  {summaryParts(e[4]).map((parts, k) => (
                    <dl key={k}>
                      {parts.map(([part, text], j) => (
                        <div key={j}>
                          {part && <dt>{t(partNames[part][0], partNames[part][1])}</dt>}
                          <dd>{text}</dd>
                        </div>
                      ))}
                    </dl>
                  ))}
                </div>
              )}
            </article>,
          ];
        })}
        {!ev.length && (
          <div className="list-empty">
            <ListTree size={23} />
            <p>{t("这段剧情没有事件记录。", "No events in this story.")}</p>
          </div>
        )}
      </div>
      <div className="panel-bottom">
        <small>
          {t(
            "事件标题和经过由大模型根据台词概括，可能有误。",
            "Event titles and summaries are a language model's digest of the script and may be wrong.",
          )}
        </small>
      </div>
    </>
  );
}
/** The relations formed by the current position, as charts. */
export function ChartsPane({
  data,
  byId,
  onEdge,
}: {
  data: AtlasAt;
  byId: Map<string, AtlasNode>;
  onEdge: (id: string) => void;
}) {
  const directions = data.edges.flatMap((e) => [e.ab, e.ba]).filter((d) => !!d);
  const warm = directions.filter((d) => d.benevolence > 0).length;
  const vivid = [...data.edges]
    .sort((a, b) => primary(b).intensity - primary(a).intensity)
    .slice(0, 8);
  const label = (e: AtlasEdge) => {
    const a = byId.get(e.source),
      b = byId.get(e.target);
    return a && b ? `${nodeName(a)} ${e.ab && e.ba ? "⇄" : e.ab ? "→" : "←"} ${nodeName(b)}` : "";
  };
  return (
    <>
      <div className="panel-heading">
        <span className="eyebrow">{t("图表", "Charts")}</span>
        <h2>
          {t("此刻的", "Relations ")}
          <em>{t("关系", "now")}</em>
        </h2>
        <p>
          {t(
            "跟着时间轴，只算当前位置已经形成的关系。",
            "Follows the timeline: only relations formed by this point count.",
          )}
        </p>
      </div>
      <div className="detail-scroll chart-pane">
        <h3 className="mini-heading">
          {t("人际态度分布", "Where attitudes sit")}
          <span>{t(`${num(directions.length)} 条`, plural("relation", directions.length))}</span>
        </h3>
        <IpcChart
          label={t("此刻全部关系的人际态度分布", "Attitudes of every relation at this point")}
          points={directions.map((d) => ({ ...d, color: octants[d.type].color }))}
        />
        <p className="control-note">
          {t(
            `每个点是一个方向的态度：越往右越友善，越往上越主导。此刻 ${num(warm)} 条友善、${num(directions.length - warm)} 条不友善；平均友善度 ${data.stats.avgBenevolence.toFixed(2)}，平均支配度 ${data.stats.avgPower.toFixed(2)}。`,
            `Each dot is one direction: friendlier to the right, more dominant upward. Now ${num(warm)} friendly and ${num(directions.length - warm)} not; mean affiliation ${data.stats.avgBenevolence.toFixed(2)}, mean dominance ${data.stats.avgPower.toFixed(2)}.`,
          )}
        </p>
        <h3 className="mini-heading">{t("八种类型", "Eight types")}</h3>
        <OctantBars counts={data.stats.octants} />
        <h3 className="mini-heading">
          {t("此刻最鲜明的关系", "Most pronounced now")}
          <span>{t("按情感强度", "by intensity")}</span>
        </h3>
        <div className="connections">
          {vivid.map((e) => {
            const d = primary(e);
            return (
              <div key={e.id}>
                <button className="connection-name" onClick={() => onEdge(e.id)}>
                  {label(e)}
                </button>
                <button
                  className="connection-type"
                  onClick={() => onEdge(e.id)}
                  style={{ color: octants[d.type].color }}
                >
                  {octantName(d.type)} <ArrowUpRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
        {!data.edges.length && (
          <p className="control-note">
            {t("这个位置还没有形成关系。", "No relation has formed yet at this point.")}
          </p>
        )}
      </div>
    </>
  );
}
