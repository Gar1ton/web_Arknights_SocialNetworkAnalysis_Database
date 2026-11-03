import { useMemo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { archiveCode, archiveTitle, avatarUrl, categories, categoryColors, categoryName, dataVersion, mediaUrl } from "../archives";
import { t } from "../i18n";
import type { Core } from "../model/load";
import { finalsByPerson, type Keep } from "../model/model";
import { BEN, INT, OBS, POW, SUB, TYPE } from "../model/types";
import { Bars, Heatmap, QueueStrip } from "../ui/charts";
import { num, pct, signed, typeName } from "../ui/format";
import { Avatar, NewBadge, personName } from "./common";

export default function Overview({ core, named, keep, openStory, openPerson }: {
  core: Core;
  named: boolean;
  keep: Keep;
  openStory: (id: string) => void;
  openPerson: (p: number) => void;
}) {
  const { manifest } = core;
  const stories = manifest.stories;
  const rows = useMemo(() => core.overview.finals.filter((f) => keep(f[OBS], f[SUB])), [core, keep]);
  const perStory = useMemo(() => {
    const n = new Array<number>(stories.length).fill(0);
    for (const f of rows) n[f[0]]++;
    return n;
  }, [rows, stories.length]);
  const latest = stories.filter((s) => s.new).sort((a, b) => (a.new === b.new ? a.order - b.order : a.new === "new" ? -1 : 1));
  const total = (k: (i: number) => number) => stories.reduce((n, _, i) => n + k(i), 0);
  const totals = manifest.info.totals;
  const scope = named ? t("两端都是具名角色的", "between named characters") : t("全部", "all");

  const positive = rows.filter((f) => f[BEN] > 0).length;
  const mean = (k: number) => rows.reduce((n, f) => n + f[k], 0) / Math.max(1, rows.length);
  const types = Array.from({ length: 8 }, (_, i) => ({ label: typeName(i), value: rows.filter((f) => f[TYPE] === i).length }))
    .sort((a, b) => b.value - a.value);
  const busiest = perStory.reduce((best, n, i) => (n > perStory[best] ? i : best), 0);
  const people = useMemo(() => {
    const by = finalsByPerson(rows);
    return [...by.entries()].map(([p, l]) => ({ p, n: l.length, stories: new Set(l.map((f) => f[0])).size }))
      .sort((a, b) => b.n - a.n || a.p - b.p).slice(0, 12);
  }, [rows]);
  const reverse = new Set(rows.map((f) => `${f[0]}|${f[OBS]}|${f[SUB]}`));
  const mutual = rows.filter((f) => reverse.has(`${f[0]}|${f[SUB]}|${f[OBS]}`)).length;
  const vivid = [...rows].sort((a, b) => b[INT] - a[INT]).slice(0, 8);

  return (
    <div className="overview">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Arknights SNA · {t("随剧情变化的关系数据", "relations over story time")}</p>
          <h1>{t("方舟关系图谱", "Arknights Social Networks")}</h1>
          <p className="lead">
            {t(
              "把《明日方舟》的剧情台词当作一段很长的群聊来读：谁和谁说话，谁对谁友善、谁在谁面前居高。每个故事一张关系网，拖动时间轴，看关系随剧情一步步成形。",
              "Arknights read as one long group chat: who talks to whom, who is warm to whom, who stands above whom. Every story has its own network; drag the timeline and watch the relations form as the story goes on.",
            )}
          </p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={() => openStory((latest[0] ?? stories[0]).id)}>
              {t("看最新剧情", "Open the latest story")} <ArrowRight size={16} />
            </button>
            <button type="button" className="ghost" onClick={() => people[0] && openPerson(people[0].p)}>
              {t("看人物", "Browse characters")}
            </button>
          </div>
          <p className="meta">{t("数据版本", "Data version")}：{dataVersion(manifest.info.version)}</p>
        </div>
        <dl className="tiles">
          {[
            [totals.messages, t("句台词", "lines")],
            [totals.stories, t("个故事", "stories")],
            [totals.scenes, t("个场景", "scenes")],
            [totals.events, t("个事件", "events")],
            [rows.length, named ? t("条具名角色间的关系", "relations between named characters") : t("条关系", "relations")],
            [named ? totals.namedPeople : totals.people, named ? t("位具名角色", "named characters") : t("位角色", "characters")],
          ].map(([n, label]) => (
            <div key={String(label)} className="tile">
              <dd>{num(Number(n))}</dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {latest.length > 0 && (
        <section className="block">
          <h2><Sparkles size={16} /> {t("最新加入", "Just added")}</h2>
          <p className="hint">
            {t(`${manifest.info.updated} 更新：新增 ${latest.filter((s) => s.new === "new").length} 个故事，续写 ${latest.filter((s) => s.new === "updated").length} 个。`,
              `Updated ${manifest.info.updated}: ${latest.filter((s) => s.new === "new").length} new stories, ${latest.filter((s) => s.new === "updated").length} continued.`)}
          </p>
          <div className="cards">
            {latest.map((s) => {
              const media = core.media.archives[s.id];
              const i = stories.indexOf(s);
              return (
                <button key={s.id} type="button" className="story-card" onClick={() => openStory(s.id)}>
                  <span className="story-card-art" style={{ ["--accent" as string]: categoryColors[s.category] }}>
                    {media?.banner ? <img src={mediaUrl(media.banner)} alt="" loading="lazy" /> : null}
                    <span className="cast">
                      {(media?.cast ?? []).filter(Boolean).slice(0, 3).map((k) => <img key={k} src={avatarUrl(k!)} alt="" loading="lazy" />)}
                    </span>
                  </span>
                  <span className="story-card-body">
                    <span className="story-card-code"><NewBadge kind={s.new} /> {archiveCode(s)}</span>
                    <b>{archiveTitle(s)}</b>
                    <span className="story-card-meta">
                      {t(`${num(s.m)} 句 · ${num(s.ev)} 个事件 · ${num(perStory[i])} 条关系`, `${num(s.m)} lines · ${num(s.ev)} events · ${num(perStory[i])} relations`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="block two">
        <article className="card">
          <h2>{t("这些词是什么意思", "What the words mean")}</h2>
          <dl className="defs">
            {[
              [t("故事", "Story"), t("一章主线、一个活动或一篇干员密录。每个故事单独成图，同一对角色在不同故事里各算各的。", "A main chapter, an event or an operator record. Each story is its own network; the same pair counts afresh in another story.")],
              [t("事件", "Event"), t("一个场景里一段连续的对话，带标题和经过。", "A stretch of conversation within a scene, with a title and a summary.")],
              [t("关系", "Relation"), t("有方向：A 对 B 和 B 对 A 分开看。", "Directed: how A sees B and how B sees A are separate.")],
              [t("友善度", "Friendliness"), t("−1 到 +1，正为友善，负为敌意。", "−1 to +1: warm when positive, hostile when negative.")],
              [t("支配度", "Dominance"), t("−1 到 +1，正为居高，负为居低。", "−1 to +1: above the other when positive, below when negative.")],
              [t("强度", "Intensity"), t("0 到 1，这段关系有多鲜明。", "0 to 1: how pronounced the relation is.")],
              [t("类型", "Type"), t("按友善度和支配度的方向分成八类。", "Eight kinds, by the direction of friendliness and dominance.")],
              [t("具名角色", "Named"), t("干员、有名有姓的剧情角色和博士；“士兵”这类泛称角色只在单个故事内有效。右上角可以切换。", "Operators, named story characters and the Doctor. Generic roles such as “soldier” count within one story only. Toggle at the top right.")],
            ].map(([a, b]) => (
              <div key={a}><dt>{a}</dt><dd>{b}</dd></div>
            ))}
          </dl>
        </article>
        <article className="card">
          <h2>{t("按类别", "By category")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("类别", "Category")}</th>
                <th className="n">{t("故事", "Stories")}</th>
                <th className="n">{t("台词", "Lines")}</th>
                <th className="n">{t("事件", "Events")}</th>
                <th className="n">{t("关系", "Relations")}</th>
                <th className="n">{t("每故事", "Per story")}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => {
                const idx = stories.map((s, i) => (s.category === c ? i : -1)).filter((i) => i >= 0);
                const rel = idx.reduce((n, i) => n + perStory[i], 0);
                return (
                  <tr key={c}>
                    <td><i className="key-swatch" style={{ background: categoryColors[c] }} />{categoryName(c)}</td>
                    <td className="n">{num(idx.length)}</td>
                    <td className="n">{num(idx.reduce((n, i) => n + stories[i].m, 0))}</td>
                    <td className="n">{num(idx.reduce((n, i) => n + stories[i].ev, 0))}</td>
                    <td className="n">{num(rel)}</td>
                    <td className="n">{(rel / Math.max(1, idx.length)).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">
            {t(`全部 ${num(total((i) => stories[i].m))} 句台词、${num(total((i) => stories[i].sc))} 个场景。`, `${num(total((i) => stories[i].m))} lines in ${num(total((i) => stories[i].sc))} scenes.`)}
          </p>
        </article>
      </section>

      <section className="block">
        <article className="card">
          <h2>{t("图 1 · 沿剧情队列，每个故事结束时有多少关系", "Figure 1 · Relations at the end of each story, along the queue")}</h2>
          <QueueStrip
            items={stories.map((s, i) => ({
              key: s.id, value: perStory[i], color: categoryColors[s.category], mark: !!s.new,
              lines: () => [archiveTitle(s), archiveCode(s), t(`${num(perStory[i])} 条关系 · ${num(s.m)} 句`, `${num(perStory[i])} relations · ${num(s.m)} lines`)],
              onPick: () => openStory(s.id),
            }))}
            legend={categories.map((c) => ({ label: categoryName(c), color: categoryColors[c] }))}
          />
          <p className="hint">
            {t(
              `每一根柱子是一个故事，从左到右按本站整理的剧情年代排列，柱高是故事结束时${scope}关系的数量。关系最多的是《${archiveTitle(stories[busiest])}》（${num(perStory[busiest])} 条）。点柱子可以打开那个故事；圆点标出最新加入的故事。`,
              `Each column is one story, in the site's own story chronology from left to right; its height is the number of relations ${scope} when the story ends. The most is in ${archiveTitle(stories[busiest])} (${num(perStory[busiest])}). Click a column to open the story; dots mark the latest additions.`,
            )}
          </p>
        </article>
      </section>

      <section className="block two">
        <article className="card">
          <h2>{t("图 2 · 关系落在哪里", "Figure 2 · Where relations land")}</h2>
          <Heatmap rows={rows.map((f) => ({ b: f[BEN], p: f[POW] }))} />
          <p className="hint">
            {t(
              `每个格子是一段友善度和支配度的范围，颜色越亮，故事结束时落在这里的${scope}关系越多。${pct(positive, rows.length)} 的关系友善度为正；平均友善度 ${signed(mean(BEN))}，平均支配度 ${signed(mean(POW))}。`,
              `Each cell is a range of friendliness and dominance; brighter cells hold more relations ${scope} at the end of their story. ${pct(positive, rows.length)} are warm; mean friendliness ${signed(mean(BEN))}, mean dominance ${signed(mean(POW))}.`,
            )}
          </p>
        </article>
        <article className="card">
          <h2>{t("图 3 · 八种类型各有多少", "Figure 3 · How many of each type")}</h2>
          <Bars rows={types} total={rows.length} />
          <p className="hint">
            {t(
              `按故事结束时的类型计数。最多的是“${types[0].label}”（${pct(types[0].value, rows.length)}），最少的是“${types[7].label}”（${pct(types[7].value, rows.length)}）。${pct(mutual, rows.length)} 的关系对方也有一条指回来的关系。`,
              `Counted by type at the end of each story. Most common: ${types[0].label} (${pct(types[0].value, rows.length)}); least: ${types[7].label} (${pct(types[7].value, rows.length)}). ${pct(mutual, rows.length)} of relations are returned by the other side.`,
            )}
          </p>
        </article>
      </section>

      <section className="block two">
        <article className="card">
          <h2>{t("图 4 · 关系最多的角色", "Figure 4 · Characters with the most relations")}</h2>
          <div className="people-bars">
            {people.map(({ p, n, stories: k }) => (
              <button key={p} type="button" className="person-bar" onClick={() => openPerson(p)}>
                <Avatar core={core} p={p} size={26} />
                <span className="person-bar-name">{personName(core, p)}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(100 * n) / people[0].n}%` }} /></span>
                <span className="bar-value">{t(`${num(n)} 条 · ${k} 个故事`, `${num(n)} in ${k} stories`)}</span>
              </button>
            ))}
          </div>
          <p className="hint">{t("一位角色在所有故事里发出和收到的关系条数。点名字看这个人的全部故事。", "Relations a character gives and receives across all stories. Click a name for that character's stories.")}</p>
        </article>
        <article className="card">
          <h2>{t("图 5 · 最鲜明的关系", "Figure 5 · The most pronounced relations")}</h2>
          <table>
            <thead>
              <tr>
                <th>{t("关系", "Relation")}</th>
                <th>{t("故事", "Story")}</th>
                <th>{t("类型", "Type")}</th>
                <th className="n">{t("友善", "Friendly")}</th>
                <th className="n">{t("支配", "Dominant")}</th>
              </tr>
            </thead>
            <tbody>
              {vivid.map((f) => (
                <tr key={f.join("|")} className="go" onClick={() => openStory(stories[f[0]].id)}>
                  <td>{personName(core, f[OBS])} → {personName(core, f[SUB])}</td>
                  <td>{archiveTitle(stories[f[0]])}</td>
                  <td>{typeName(f[TYPE])}</td>
                  <td className="n">{signed(f[BEN])}</td>
                  <td className="n">{signed(f[POW])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">{t("强度最高的几条关系，取故事结束时的状态。点一行打开那个故事。", "The relations with the highest intensity, as each story ends. Click a row to open the story.")}</p>
        </article>
      </section>

      <section className="block">
        <article className="card notes">
          <h2>{t("关于这些数据", "About the data")}</h2>
          <p>
            {t(
              "非官方的学术项目。关系数值、类型、人物性格和事件经过都由大语言模型从剧情中推断或撰写，可能有误，也不是官方设定。剧情顺序按本项目自行整理的年代排列。",
              "An unofficial academic project. Relation values, types, personalities and event summaries are inferred or written by a language model from the story; they may be wrong and are not canon. Stories follow the project's own chronology.",
            )}{" "}
            <a href="https://github.com/Gar1ton/web_Arknights_SocialNetworkAnalysis_Database#readme" target="_blank" rel="noreferrer">
              {t("说明与条款", "Notes and terms")}
            </a>
          </p>
        </article>
      </section>
    </div>
  );
}
