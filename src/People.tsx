import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Orbit, Search, X } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import LangSwitch from "./LangSwitch";
import Select from "./Select";
import { IndexSwitch } from "./Library";
import { archiveCode, archiveTitle, avatarUrl, dataVersion } from "./archives";
import { bigFiveNames, level, octantName, octantKeys, octants } from "./data";
import { locale, plural, t } from "./i18n";
import { type Settings, showcaseFlow } from "./settings";
import type { Core } from "./model/load";
import { BEN, OBS, POW, SUB, TYPE, type FinalRow } from "./model/types";
import { storyAtQueue } from "./model/model";
import { toHundred } from "./model/atlas";
import { personAlt, personName, scopeName, type Catalog } from "./model/catalog";
import { DotStrip, TraitLine } from "./charts";
import { personHash, storyHash } from "./routes";
const PAGE = 48;
const num = (n: number) => n.toLocaleString(locale());
const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const traitColors = ["#ddb780", "#94c4b2", "#dba0b0", "#92b0db", "#a596c4"];
function Shell({
  settings,
  current,
  children,
}: {
  settings: Settings;
  current: "archives" | "people";
  children: React.ReactNode;
}) {
  const art = useMemo(
    () => ({ ...settings, particles: 480, flowOpacity: showcaseFlow }),
    [settings],
  );
  return (
    <main id="main-content" tabIndex={-1} className="archive-library route-surface">
      <div className="library-atmosphere">
        <FlowField settings={art} subtle />
      </div>
      <div className="library-shell">
        <div className="library-brand-row">
          <Brand />
          <div className="library-brand-tools">
            <IndexSwitch current={current} />
            <LangSwitch />
            <a href="#" className="quiet-link">
              <ArrowLeft size={13} /> {t("返回首页", "Home")}
            </a>
          </div>
        </div>
        {children}
        <footer className="library-footer">
          <span>
            {t(
              "数值由大模型根据剧情台词推断，仅供参考。",
              "Values are inferred by a large language model from the script. Treat them as estimates.",
            )}
          </span>
          <small>
            {t("非官方项目，与鹰角网络无关联", "Unofficial project, not affiliated with Hypergryph")}
          </small>
        </footer>
      </div>
    </main>
  );
}
export function Face({ core, p, size }: { core: Core; p: number; size?: "large" }) {
  const key = core.media.avatars[String(p)];
  return (
    <span className={"portrait" + (size ? " " + size : "")}>
      {key ? (
        <img src={avatarUrl(key)} alt="" loading="lazy" decoding="async" />
      ) : (
        <b>{[...core.people.people[p][0].replace(/^[“"]/, "")][0]}</b>
      )}
    </span>
  );
}
type Kind = "all" | "operator" | "story";
const kinds: [Kind, string, string][] = [
  ["all", "全部", "All"],
  ["operator", "干员", "Operators"],
  ["story", "剧情角色", "Story characters"],
];
export default function People({
  settings,
  core,
  catalog,
}: {
  settings: Settings;
  core: Core;
  catalog: Catalog;
}) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState<Kind>("all"),
    [sort, setSort] = useState("relations"),
    [shown, setShown] = useState(PAGE);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement).closest("input,textarea,select")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    addEventListener("keydown", shortcut);
    return () => removeEventListener("keydown", shortcut);
  }, []);
  const all = useMemo(() => [...catalog.persons.values()], [catalog]);
  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return all
      .filter(({ p }) => {
        const scope = core.people.people[p][2];
        if (kind === "operator" && scope !== 0) return false;
        if (kind === "story" && scope === 0) return false;
        return (
          !q ||
          `${core.people.people[p][0]} ${core.people.people[p][1]} ${personName(core, p)}`
            .toLocaleLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) =>
        sort === "lines"
          ? core.people.people[b.p][3] - core.people.people[a.p][3]
          : sort === "stories"
            ? b.stories.length - a.stories.length || b.relations - a.relations
            : sort === "name"
              ? personName(core, a.p).localeCompare(personName(core, b.p), locale())
              : b.relations - a.relations || a.p - b.p,
      );
  }, [all, query, kind, sort, core]);
  useEffect(() => setShown(PAGE), [query, kind, sort]);
  return (
    <Shell settings={settings} current="people">
      <section className="library-intro">
        <div>
          <span className="eyebrow">
            <i /> {t("角色目录", "Characters")}
          </span>
          <h1>
            {t("选择一位", "Choose a")}
            <br />
            <em>{t("角色", "character")}</em>
          </h1>
          <p>
            {t(
              "每位角色一页：性格随剧情的变化，在各段剧情里与谁有关系、态度如何。",
              "One page per character: how their personality moves through the story, and who they relate to in each story.",
            )}
          </p>
        </div>
        <div className="library-edition">
          <span>{t("收录", "Covers")}</span>
          <strong>{num(all.length)}</strong>
          <p>
            {settings.named ? t("位具名角色", "named characters") : t("位角色", "characters")}
            <br />
            {t("至少有一条关系", "with at least one relation")}
          </p>
          <small>
            {t("数据版本：", "Data version: ")}
            {dataVersion(core.manifest.info.version)}
          </small>
        </div>
      </section>
      <div className="archive-toolbar">
        <div className="archive-tabs" role="group" aria-label={t("角色类型", "Character type")}>
          {kinds.map(([k, zh, en]) => (
            <button key={k} className={k === kind ? "active" : ""} aria-pressed={k === kind} onClick={() => setKind(k)}>
              {t(zh, en)}
            </button>
          ))}
        </div>
        <label className="archive-search">
          <Search size={16} />
          <input
            ref={input}
            aria-label={t("搜索角色", "Search characters")}
            placeholder={t("搜索角色中文名或英文名…", "Search by English or Chinese name…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label={t("清空搜索", "Clear search")}>
              <X size={14} />
            </button>
          ) : (
            <span>/</span>
          )}
        </label>
      </div>
      <div className="archive-result-count person-count">
        <span role="status">{t(`共 ${num(list.length)} 位`, plural("character", list.length))}</span>
        <Select aria-label={t("排序", "Sort")} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relations">{t("按关系数", "By relations")}</option>
          <option value="stories">{t("按出场剧情数", "By stories")}</option>
          <option value="lines">{t("按台词数", "By lines")}</option>
          <option value="name">{t("按名称", "By name")}</option>
        </Select>
      </div>
      <div className="person-grid">
        {list.slice(0, shown).map(({ p, relations, stories }, i) => {
          const persona = core.people.persona[String(p)];
          const last = persona?.h[persona.h.length - 1]?.[1];
          return (
            <a
              key={p}
              href={personHash(p)}
              className="person-card"
              style={{ "--card-order": i % PAGE } as React.CSSProperties}
            >
              <Face core={core} p={p} />
              <span className="person-card-name">
                <b>{personName(core, p)}</b>
                <small>
                  {scopeName(core.people.people[p][2])}
                  {personAlt(core, p) && " · " + personAlt(core, p)}
                </small>
              </span>
              <span className="person-card-stats">
                <span>
                  {num(relations)} <small>{t("关系", "rel.")}</small>
                </span>
                <span>
                  {stories.length} <small>{t("段剧情", stories.length === 1 ? "story" : "stories")}</small>
                </span>
              </span>
              {last && (
                <span className="person-card-ocean" aria-hidden="true">
                  {last.map((v, k) => (
                    <i key={k} style={{ height: `${toHundred(v) ?? 0}%`, background: traitColors[k], opacity: v == null ? 0.2 : 0.8 }} />
                  ))}
                </span>
              )}
              <ArrowUpRight size={14} />
            </a>
          );
        })}
      </div>
      {list.length > shown && (
        <button className="wide-button library-more" onClick={() => setShown((n) => n + PAGE * 2)}>
          {t(
            `再显示 ${Math.min(PAGE * 2, list.length - shown)} 位（还有 ${list.length - shown} 位）`,
            `Show ${Math.min(PAGE * 2, list.length - shown)} more (${list.length - shown} left)`,
          )}
        </button>
      )}
      {!list.length && (
        <div className="archive-empty">
          <Orbit size={32} />
          <h2>{t("没有找到这位角色", "No character found")}</h2>
          <p>{t("试试中文名、英文名或干员代号。", "Try a Chinese or English name.")}</p>
        </div>
      )}
    </Shell>
  );
}
export function PersonPage({
  settings,
  core,
  catalog,
  p,
  other,
}: {
  settings: Settings;
  core: Core;
  catalog: Catalog;
  p: number;
  other?: number;
}) {
  const row = core.people.people[p];
  if (!row)
    return (
      <Shell settings={settings} current="people">
        <div className="archive-empty">
          <Orbit size={32} />
          <h2>{t("没有这位角色", "No such character")}</h2>
          <a className="wide-button" href="#people">
            {t("返回角色目录", "Back to characters")}
          </a>
        </div>
      </Shell>
    );
  return <Profile settings={settings} core={core} catalog={catalog} p={p} other={other} />;
}
function Profile({
  settings,
  core,
  catalog,
  p,
  other,
}: {
  settings: Settings;
  core: Core;
  catalog: Catalog;
  p: number;
  other?: number;
}) {
  const stories = core.manifest.stories;
  const [name, , scope, lines] = core.people.people[p];
  const persona = core.people.persona[String(p)];
  const last = persona?.h[persona.h.length - 1];
  const rows = useMemo(
    () => catalog.finals.filter((f) => f[OBS] === p || f[SUB] === p),
    [catalog, p],
  );
  const storySet = [...new Set(rows.map((f) => f[0]))].sort((a, b) => a - b);
  const label = (x: number) => personName(core, x);
  const group = new Map<number, FinalRow[]>();
  for (const f of rows) {
    const u = f[OBS] === p ? f[SUB] : f[OBS];
    const l = group.get(u);
    if (l) l.push(f);
    else group.set(u, [f]);
  }
  const partners = [...group.entries()]
    .map(([u, l]) => ({ u, l, n: new Set(l.map((f) => f[0])).size }))
    .sort((a, b) => b.n - a.n || b.l.length - a.l.length);
  const mean = (l: FinalRow[], k = BEN) =>
    l.length ? l.reduce((s, f) => s + f[k], 0) / l.length : undefined;
  const range = (l: FinalRow[]) => {
    if (!l.length) return "—";
    const v = l.map((f) => f[BEN]);
    const a = Math.min(...v),
      b = Math.max(...v);
    return a === b ? signed(a) : `${signed(a)} ～ ${signed(b)}`;
  };
  const per = storySet.map((i) => ({
    i,
    given: mean(rows.filter((f) => f[0] === i && f[OBS] === p)),
    got: mean(rows.filter((f) => f[0] === i && f[SUB] === p)),
    n: rows.filter((f) => f[0] === i).length,
  }));
  const counts = Object.fromEntries(octantKeys.map((k) => [k, 0])) as Record<(typeof octantKeys)[number], number>;
  for (const f of rows) if (f[OBS] === p) counts[octantKeys[f[TYPE]]]++;
  const given = rows.filter((f) => f[OBS] === p).length;
  const where = (seq: number) => {
    const s = storyAtQueue(stories, seq);
    return s ? archiveTitle(s) : "";
  };
  const pair = other !== undefined ? group.get(other) : undefined;
  return (
    <Shell settings={settings} current="people">
      <div className="person-crumbs">
        <a href="#people">
          <ArrowLeft size={13} /> {t("角色目录", "Characters")}
        </a>
      </div>
      <section className="person-hero">
        <div className={"profile-emblem large" + (core.media.avatars[String(p)] ? " has-avatar" : "")}>
          {core.media.avatars[String(p)] ? (
            <img src={avatarUrl(core.media.avatars[String(p)])} alt="" />
          ) : (
            <span aria-hidden="true">{[...name.replace(/^[“"]/, "")][0]}</span>
          )}
          <i />
          <i />
          <i />
        </div>
        <div>
          <span className="eyebrow">
            <i /> {scopeName(scope)}
          </span>
          <h1>
            {label(p)}
            {personAlt(core, p) && (
              <>
                <br />
                <em>{personAlt(core, p)}</em>
              </>
            )}
          </h1>
          {persona?.d && (
            <p className="person-description" lang="zh-CN">
              {persona.d}
            </p>
          )}
        </div>
        <dl className="person-figures">
          <div>
            <dt>{t("条关系", "relations")}</dt>
            <dd>{num(rows.length)}</dd>
          </div>
          <div>
            <dt>{t("段剧情", "stories")}</dt>
            <dd>{num(storySet.length)}</dd>
          </div>
          <div>
            <dt>{t("句台词", "lines")}</dt>
            <dd>{num(lines)}</dd>
          </div>
        </dl>
      </section>
      <section className="person-section two">
        <article>
          <h2 className="section-title">
            {t("大五人格", "Big Five")} <small>0–100</small>
          </h2>
          {last ? (
            <>
              <div className="traits">
                {bigFiveNames().map((trait, k) => {
                  const v = toHundred(last[1][k]);
                  return (
                    <div key={trait} className={v == null ? "unscored" : ""}>
                      <span>{trait}</span>
                      <div>
                        <i style={{ width: (v ?? 0) + "%" }} />
                      </div>
                      <b>{v == null ? "—" : `${v} ${level(v)}`}</b>
                    </div>
                  );
                })}
              </div>
              <p className="figure-note">
                {t(
                  "从第一段剧情开始累积到最后一次出场。台词太少的维度不评分，显示为“—”。",
                  "Accumulated from the first story to the last appearance. A trait with too few lines stays unscored (“—”).",
                )}
              </p>
            </>
          ) : (
            <p className="figure-note">{t("这位角色还没有性格评分。", "No personality scores yet.")}</p>
          )}
        </article>
        <article>
          <h2 className="section-title">
            {t("性格随剧情的变化", "Personality over the story")}
          </h2>
          {persona && persona.h.length > 1 ? (
            <>
              <div className="trait-lines">
                {bigFiveNames().map((trait, k) => {
                  const pts = persona.h
                    .filter((h) => h[1][k] != null)
                    .map((h) => [h[0], toHundred(h[1][k])!] as [number, number]);
                  return pts.length ? (
                    <TraitLine
                      key={trait}
                      name={trait}
                      pts={pts}
                      x0={persona.h[0][0]}
                      x1={Math.max(persona.h[0][0] + 1, last![0])}
                      color={traitColors[k]}
                      where={where}
                    />
                  ) : null;
                })}
              </div>
              <p className="figure-note">
                {t(
                  `横轴是剧情年代，从${where(persona.h[0][0])}到${where(last![0])}；每一级台阶是一次重新评估。悬停可以看到那一次评估所在的剧情。`,
                  `Story order runs left to right, from ${where(persona.h[0][0])} to ${where(last![0])}; each step is one reassessment. Hover to see which story it came from.`,
                )}
              </p>
            </>
          ) : (
            <p className="figure-note">
              {t("评估次数太少，画不出变化。", "Too few assessments to show a change.")}
            </p>
          )}
        </article>
      </section>
      {per.length > 1 && (
        <section className="person-section">
          <h2 className="section-title">{t("在各段剧情里的友善度", "Affiliation story by story")}</h2>
          <p className="chart-key">
            <span><i className="dot-given" />{t(`${label(p)} 对别人`, `${label(p)} to others`)}</span>
            <span><i className="dot-got" />{t(`别人对 ${label(p)}`, `others to ${label(p)}`)}</span>
          </p>
          <DotStrip
            rows={per.map((r) => ({ label: archiveTitle(stories[r.i]), given: r.given, got: r.got }))}
            onPick={(i) => (location.hash = storyHash(stories[per[i].i].id, p))}
          />
          <p className="figure-note">
            {t(
              `每一列是一段剧情（共 ${per.length} 段，按剧情年代），取剧情结束时的平均友善度，−1 敌对到 +1 友善。实心点是 TA 对别人，空心点是别人对 TA。点一列打开那段剧情，并选中 TA。`,
              `Each column is one story (${per.length}, in story order): the mean affiliation as it ends, from −1 hostile to +1 friendly. Filled dots are what they give, hollow ones what they receive. Click a column to open that story with them selected.`,
            )}
          </p>
        </section>
      )}
      {pair && other !== undefined && (
        <PairSection core={core} a={p} b={other} list={pair} />
      )}
      <section className="person-section two">
        <article>
          <h2 className="section-title">
            {t("出场的剧情", "Stories")} <small>{per.length}</small>
          </h2>
          <div className="story-rows">
            {per.map(({ i, given: g, got, n }) => (
              <a key={i} href={storyHash(stories[i].id, p)}>
                <span>
                  <b>{archiveTitle(stories[i])}</b>
                  <small>{archiveCode(stories[i])}</small>
                </span>
                <span className="story-row-values">
                  {t(`${n} 条关系`, plural("relation", n))}
                  <small>
                    {g !== undefined && `→ ${signed(g)}`}
                    {g !== undefined && got !== undefined && " · "}
                    {got !== undefined && `← ${signed(got)}`}
                  </small>
                </span>
                <ArrowUpRight size={13} />
              </a>
            ))}
          </div>
        </article>
        <article>
          <h2 className="section-title">
            {t("TA 给出的关系类型", "Relation types they give")} <small>{given}</small>
          </h2>
          <div className="breakdown">
            <div className="breakdown-bar">
              {octantKeys.map((k) =>
                counts[k] ? <i key={k} title={`${octantName(k)} ${counts[k]}`} style={{ flex: counts[k], background: octants[k].color }} /> : null,
              )}
            </div>
            <small>
              {[...octantKeys]
                .filter((k) => counts[k])
                .sort((a, b) => counts[b] - counts[a])
                .map((k) => `${octantName(k)} ${counts[k]}`)
                .join(" · ")}
            </small>
          </div>
          <h2 className="section-title">
            {t("和谁有关系", "Relations with")} <small>{partners.length}</small>
          </h2>
          <div className="partner-rows">
            {partners.slice(0, 60).map(({ u, l, n }) => (
              <a key={u} href={personHash(p, u)} aria-current={u === other ? "true" : undefined}>
                <Face core={core} p={u} />
                <span>
                  <b>{label(u)}</b>
                  <small>{t(`${n} 段剧情`, plural("story", n, "stories"))}</small>
                </span>
                <span className="partner-values">
                  <span>→ {range(l.filter((f) => f[OBS] === p))}</span>
                  <span>← {range(l.filter((f) => f[SUB] === p))}</span>
                </span>
              </a>
            ))}
          </div>
          <p className="figure-note">
            {t(
              "箭头右边是友善度：→ TA 对对方，← 对方对 TA；跨多段剧情时显示最低到最高。点一行，在上方对比两人逐段剧情的关系。",
              "Affiliation after the arrow: → them to the other, ← the other to them; across several stories the lowest to the highest. Click a row to compare the pair story by story above.",
            )}
          </p>
        </article>
      </section>
    </Shell>
  );
}
function PairSection({ core, a, b, list }: { core: Core; a: number; b: number; list: FinalRow[] }) {
  const stories = core.manifest.stories;
  const label = (x: number) => personName(core, x);
  const idx = [...new Set(list.map((f) => f[0]))].sort((x, y) => x - y);
  const rows = idx.map((i) => ({
    i,
    ab: list.find((f) => f[0] === i && f[OBS] === a),
    ba: list.find((f) => f[0] === i && f[OBS] === b),
  }));
  useEffect(() => {
    document.getElementById("pair-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [a, b]);
  return (
    <section className="person-section pair-section" id="pair-section">
      <h2 className="section-title">
        {label(a)} ⇄ {label(b)} <small>{t(`${idx.length} 段剧情`, plural("story", idx.length, "stories"))}</small>
      </h2>
      <p className="chart-key">
        <span><i className="dot-given" />{label(a)} → {label(b)}</span>
        <span><i className="dot-got" />{label(b)} → {label(a)}</span>
      </p>
      <div className="pair-charts">
        {([[BEN, t("友善度", "Affiliation")], [POW, t("支配度", "Dominance")]] as const).map(([k, title]) => (
          <div key={k}>
            <h3 className="mini-heading">{title}</h3>
            <DotStrip
              rows={rows.map((r) => ({ label: archiveTitle(stories[r.i]), given: r.ab?.[k], got: r.ba?.[k] }))}
              onPick={(i) => (location.hash = storyHash(stories[rows[i].i].id, [a, b]))}
            />
          </div>
        ))}
      </div>
      <div className="story-rows">
        {rows.map((r) => (
          <a key={r.i} href={storyHash(stories[r.i].id, [a, b])}>
            <span>
              <b>{archiveTitle(stories[r.i])}</b>
              <small>{archiveCode(stories[r.i])}</small>
            </span>
            <span className="story-row-values">
              {r.ab ? `${octantName(octantKeys[r.ab[TYPE]])} ${signed(r.ab[BEN])}` : "—"}
              <small>{r.ba ? `← ${octantName(octantKeys[r.ba[TYPE]])} ${signed(r.ba[BEN])}` : "← —"}</small>
            </span>
            <ArrowUpRight size={13} />
          </a>
        ))}
      </div>
      <p className="figure-note">
        {t(
          "每段剧情里两人的关系都从零算起，所以点与点之间不是连续变化。点一列或一行，打开那段剧情并选中这两人，可以在那里看关系怎样一步步形成。",
          "Each story starts the pair afresh, so the dots are not one continuous line. Click a column or a row to open that story with the pair selected and watch the relation form.",
        )}
      </p>
    </section>
  );
}
