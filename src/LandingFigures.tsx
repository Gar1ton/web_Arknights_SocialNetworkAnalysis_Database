import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { archiveCode, archiveTitle, categories, categoryName, type Category } from "./archives";
import { octantKeys, octantName, octants } from "./data";
import { locale, plural, t } from "./i18n";
import { ChronoStrip, Heatmap, OctantBars } from "./charts";
import type { Core } from "./model/load";
import { BEN, INT, OBS, POW, SUB, TYPE } from "./model/types";
import { personName, type Catalog } from "./model/catalog";
import { Face } from "./People";
import { personHash, storyHash } from "./routes";
/** The story categories' own tints, as in the story covers. */
export const categoryTint: Record<Category, string> = {
  主线: "#d3a6a0",
  活动: "#a0bfbc",
  密录: "#a8b7d2",
  集成战略: "#c9a98c",
};
const num = (n: number) => n.toLocaleString(locale());
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0) + "%";
const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
/**
 * Three screens of figures for the landing page, each a definition, the
 * figure and a paragraph on how to read it. Every count follows the
 * named-only switch and is taken where each story ends.
 */
export function LandingFigures({
  core,
  catalog,
  named,
}: {
  core: Core;
  catalog: Catalog;
  named: boolean;
}) {
  const { stories, finals } = catalog;
  const totals = core.manifest.info.totals;
  const scope = named ? t("具名角色之间的", "between named characters") : t("", "");
  const busiest = stories.reduce((a, b) => (b.relations > a.relations ? b : a), stories[0]);
  const counts = useMemo(() => {
    const c = Object.fromEntries(octantKeys.map((k) => [k, 0])) as Record<(typeof octantKeys)[number], number>;
    for (const f of finals) c[octantKeys[f[TYPE]]]++;
    return c;
  }, [finals]);
  const types = [...octantKeys].sort((a, b) => counts[b] - counts[a]);
  const warm = finals.filter((f) => f[BEN] > 0).length;
  const mean = (k: number) => finals.reduce((s, f) => s + f[k], 0) / Math.max(1, finals.length);
  const reverse = useMemo(() => new Set(finals.map((f) => `${f[0]}|${f[OBS]}|${f[SUB]}`)), [finals]);
  const mutual = finals.filter((f) => reverse.has(`${f[0]}|${f[SUB]}|${f[OBS]}`)).length;
  const people = useMemo(
    () => [...catalog.persons.values()].sort((a, b) => b.relations - a.relations || a.p - b.p).slice(0, 8),
    [catalog],
  );
  const vivid = useMemo(() => [...finals].sort((a, b) => b[INT] - a[INT]).slice(0, 6), [finals]);
  // Operator Records are short and would fill most of the axis with near-empty
  // columns, so the chronology shows Main Theme and events only.
  const chronoCategories = categories.filter((c) => c !== "密录");
  const chronoStories = useMemo(() => stories.filter((s) => s.category !== "密录"), [stories]);
  const byIndex = useMemo(() => new Map(stories.map((s) => [s.index, s])), [stories]);
  const tiles: [number, string][] = [
    [totals.messages, t("句台词", "lines")],
    [stories.length, t("段剧情", "stories")],
    [totals.scenes, t("个场景", "scenes")],
    [totals.events, t("个事件", "events")],
    [finals.length, t("条关系", "relations")],
    [catalog.persons.size, named ? t("位具名角色", "named characters") : t("位角色", "characters")],
  ];
  return (
    <>
      <section id="figures" className="scene-introduction scene-figures" aria-labelledby="figures-heading">
        <div className="reveal">
          <span className="eyebrow">{t("数据总览", "The data")}</span>
          <h2 id="figures-heading">
            {t("整套数据", "How much")}
            <br />
            <em>{t("有多大", "is here")}</em>
          </h2>
        </div>
        <dl className="figure-tiles reveal">
          {tiles.map(([n, label]) => (
            <div key={label}>
              <dd>{num(n)}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
        <article className="figure reveal">
          <h3>
            <span>{t("表 1", "Table 1")}</span>
            {t("按类别", "By category")}
          </h3>
          <table className="figure-table">
            <thead>
              <tr>
                <th>{t("类别", "Category")}</th>
                <th>{t("剧情", "Stories")}</th>
                <th>{t("台词", "Lines")}</th>
                <th>{t("事件", "Events")}</th>
                <th>{t("关系", "Relations")}</th>
                <th>{t("每段", "Per story")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const list = stories.filter((s) => s.category === c);
                const rel = list.reduce((n, s) => n + s.relations, 0);
                return (
                  <tr key={c}>
                    <td>
                      <i style={{ background: categoryTint[c] }} />
                      {categoryName(c)}
                    </td>
                    <td>{num(list.length)}</td>
                    <td>{num(list.reduce((n, s) => n + s.m, 0))}</td>
                    <td>{num(list.reduce((n, s) => n + s.ev, 0))}</td>
                    <td>{num(rel)}</td>
                    <td>{(rel / Math.max(1, list.length)).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="figure-note">
            {t(
              "事件是一个场景里一段连续的对话，带标题和经过；关系有方向，算的是剧情结束时已经形成的关系。",
              "An event is one stretch of conversation in a scene, with a title and a summary; relations are directed and counted as each story ends.",
            )}
          </p>
        </article>
      </section>
      <section id="chronology" className="scene-introduction scene-figures" aria-labelledby="chronology-heading">
        <div className="reveal">
          <span className="eyebrow">{t("剧情年代", "Story order")}</span>
          <h2 id="chronology-heading">
            {t("关系网络规模的", "Network size")}
            <br />
            <em>{t("历时分布", "across the chronology")}</em>
          </h2>
        </div>
        <article className="figure reveal">
          <h3>
            <span>{t("图 1", "Fig. 1")}</span>
            {t("每段剧情结束时有多少关系", "Relations as each story ends")}
          </h3>
          <ChronoStrip
            legend={chronoCategories.map((c) => ({ label: categoryName(c), color: categoryTint[c] }))}
            items={chronoStories.map((s) => ({
              key: s.id,
              value: s.relations,
              color: categoryTint[s.category],
              mark: !!s.new,
              href: storyHash(s.id),
              lines: () => [
                <b key="v">{t(`${num(s.relations)} 条关系`, plural("relation", s.relations))}</b>,
                <span key="t">{archiveTitle(s)}</span>,
                <small key="c">{archiveCode(s)}</small>,
              ],
            }))}
          />
          <p className="figure-note">
            {t(
              `每一根柱子是一段主线或活动剧情，从左到右按剧情年代排列，柱高是剧情结束时${scope}关系的条数（A 对 B、B 对 A 各算一条）。干员密录篇幅短、关系少，不列入此图。关系最多的是《${archiveTitle(busiest)}》，${num(busiest.relations)} 条；主线一般比活动多，因为出场的人更多、篇幅更长。顶上的金点是最新加入的剧情。点柱子打开那段剧情。`,
              `Each column is one Main Theme or event story, in story order from left to right; its height is the number of relations ${scope} when the story ends (A to B and B to A count separately). Operator Records are short with few relations and are left out. The most is in ${archiveTitle(busiest)}, ${num(busiest.relations)}. Main Theme chapters usually lead, with larger casts and longer scripts. Gold dots mark the latest additions. Click a column to open the story.`,
            )}
          </p>
        </article>
      </section>
      <section id="shapes" className="scene-introduction scene-figures" aria-labelledby="shapes-heading">
        <div className="reveal">
          <span className="eyebrow">{t("关系的形状", "The shape of relations")}</span>
          <h2 id="shapes-heading">
            {t("大多数关系", "Most relations")}
            <br />
            <em>{t("落在哪里", "sit here")}</em>
          </h2>
        </div>
        <div className="figure-pair">
          <article className="figure reveal">
            <h3>
              <span>{t("图 2", "Fig. 2")}</span>
              {t("友善度 × 支配度", "Affiliation × dominance")}
            </h3>
            <Heatmap points={finals.map((f) => ({ b: f[BEN], p: f[POW] }))} />
            <p className="figure-note">
              {t(
                `每个格子是一段友善度和支配度的范围，颜色越亮，落在这里的关系越多。${pct(warm, finals.length)} 的关系友善度为正；平均友善度 ${signed(mean(BEN))}，平均支配度 ${signed(mean(POW))}。右半边偏亮，说明剧情里的人际态度总体偏友善。`,
                `Each cell is a range of affiliation and dominance; brighter cells hold more relations. ${pct(warm, finals.length)} are friendly; mean affiliation ${signed(mean(BEN))}, mean dominance ${signed(mean(POW))}. The brighter right half says attitudes in the story lean friendly overall.`,
              )}
            </p>
          </article>
          <article className="figure reveal">
            <h3>
              <span>{t("图 3", "Fig. 3")}</span>
              {t("八种类型各有多少", "How many of each type")}
            </h3>
            <OctantBars counts={counts} />
            <p className="figure-note">
              {t(
                `按剧情结束时的类型计数。最多的是「${octantName(types[0])}」（${pct(counts[types[0]], finals.length)}），最少的是「${octantName(types[7])}」（${pct(counts[types[7]], finals.length)}）。${pct(mutual, finals.length)} 的关系对方也有一条指回来的关系。`,
                `Counted by type as each story ends. Most common: ${octantName(types[0])} (${pct(counts[types[0]], finals.length)}); least: ${octantName(types[7])} (${pct(counts[types[7]], finals.length)}). ${pct(mutual, finals.length)} of relations are returned by the other side.`,
              )}
            </p>
          </article>
        </div>
      </section>
      <section id="cast" className="scene-introduction scene-figures" aria-labelledby="cast-heading">
        <div className="reveal">
          <span className="eyebrow">{t("角色", "Characters")}</span>
          <h2 id="cast-heading">
            {t("谁的关系", "Who has")}
            <br />
            <em>{t("最多、最鲜明", "the most, the strongest")}</em>
          </h2>
        </div>
        <div className="figure-pair">
          <article className="figure reveal">
            <h3>
              <span>{t("图 4", "Fig. 4")}</span>
              {t("关系最多的角色", "Most relations")}
            </h3>
            <div className="people-bars">
              {people.map(({ p, relations, stories: list }) => (
                <a key={p} href={personHash(p)}>
                  <Face core={core} p={p} />
                  <span className="people-bar-name">{personName(core, p)}</span>
                  <span className="people-bar-track">
                    <i style={{ width: `${(100 * relations) / people[0].relations}%` }} />
                  </span>
                  <b>{num(relations)}</b>
                  <small>{t(`${list.length} 段`, plural("story", list.length, "stories"))}</small>
                </a>
              ))}
            </div>
            <p className="figure-note">
              {t(
                "一位角色在所有剧情里发出和收到的关系条数，右边是出场的剧情段数。点名字打开 TA 的角色页。",
                "Relations a character gives and receives across every story; on the right, how many stories. Click a name for their page.",
              )}
            </p>
          </article>
          <article className="figure reveal">
            <h3>
              <span>{t("图 5", "Fig. 5")}</span>
              {t("最鲜明的关系", "The strongest relations")}
            </h3>
            <div className="vivid-rows">
              {vivid.map((f) => {
                const s = byIndex.get(f[0]);
                const k = octantKeys[f[TYPE]];
                return s ? (
                  <a key={f.join("|")} href={storyHash(s.id, [f[OBS], f[SUB]])}>
                    <span>
                      <b>
                        {personName(core, f[OBS])} → {personName(core, f[SUB])}
                      </b>
                      <small>{archiveTitle(s)}</small>
                    </span>
                    <span className="tag ipc-tag" style={{ color: octants[k].color }}>
                      <i style={{ background: octants[k].color }} />
                      {octantName(k)}
                    </span>
                    <span className="vivid-values">
                      {signed(f[BEN])}
                      <small>{signed(f[POW])}</small>
                    </span>
                    <ArrowUpRight size={13} />
                  </a>
                ) : null;
              })}
            </div>
            <p className="figure-note">
              {t(
                "情感强度最高的六条关系，取剧情结束时的状态；右边是友善度，下面一行是支配度。点一行打开那段剧情并选中这对角色。",
                "The six relations with the highest intensity as their story ends; on the right affiliation, below it dominance. Click a row to open the story with the pair selected.",
              )}
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
