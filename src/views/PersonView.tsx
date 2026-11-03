import { useMemo, useState } from "react";
import { archiveTitle } from "../archives";
import { bigFiveNames } from "../data";
import { t } from "../i18n";
import type { Core } from "../model/load";
import { finalsByPerson, isNamed, storyAtQueue, type Keep } from "../model/model";
import { BEN, OBS, POW, SUB, TYPE, type FinalRow } from "../model/types";
import { Dots, OceanBars, StepLines } from "../ui/charts";
import { num, signed, typeName } from "../ui/format";
import { altName, Avatar, personName, scopeName } from "./common";

export default function PersonView({ core, named, keep, who, other, openPerson, openStory }: {
  core: Core;
  named: boolean;
  keep: Keep;
  who: number | null;
  other: number | null;
  openPerson: (p: number, other?: number) => void;
  openStory: (id: string, pair?: [number, number]) => void;
}) {
  const byPerson = useMemo(() => finalsByPerson(core.overview.finals.filter((f) => keep(f[OBS], f[SUB]))), [core, keep]);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const query = q.trim().toLocaleLowerCase();
    return [...byPerson.entries()]
      .filter(([p]) => (!named || isNamed(core.people, p)) && (!query || `${core.people.people[p][0]} ${personName(core, p)}`.toLocaleLowerCase().includes(query)))
      .map(([p, l]) => ({ p, n: l.length }))
      .sort((a, b) => b.n - a.n || a.p - b.p);
  }, [byPerson, q, named, core]);
  const p = who ?? list[0]?.p ?? null;
  return (
    <div className="person-view">
      <nav className="pick" aria-label={t("人物列表", "Characters")}>
        <div className="pick-tools">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("搜人名", "Search names")} aria-label={t("搜人名", "Search names")} />
        </div>
        <div className="items">
          {list.slice(0, 400).map(({ p: x, n }) => (
            <button key={x} type="button" aria-current={x === p} onClick={() => openPerson(x)} className="person-item">
              <Avatar core={core} p={x} size={26} />
              <span>
                <span className="item-title">{personName(core, x)}</span>
                <span className="item-meta">{t(`${num(n)} 条关系 · ${num(core.people.people[x][3])} 句`, `${num(n)} relations · ${num(core.people.people[x][3])} lines`)}</span>
              </span>
            </button>
          ))}
          {list.length > 400 && <p className="more">{t(`还有 ${num(list.length - 400)} 人，输入名字筛选`, `${num(list.length - 400)} more; type a name to filter`)}</p>}
          {!list.length && <p className="more">{t("没有匹配的人", "Nobody matches")}</p>}
        </div>
      </nav>
      <div className="person-page">
        {p === null ? null : <Profile key={p} core={core} p={p} rows={byPerson.get(p) ?? []} other={other} openPerson={openPerson} openStory={openStory} />}
      </div>
    </div>
  );
}

function Profile({ core, p, rows, other, openPerson, openStory }: {
  core: Core;
  p: number;
  rows: FinalRow[];
  other: number | null;
  openPerson: (p: number, other?: number) => void;
  openStory: (id: string, pair?: [number, number]) => void;
}) {
  const stories = core.manifest.stories;
  const row = core.people.people[p];
  const persona = core.people.persona[String(p)];
  const storySet = [...new Set(rows.map((f) => f[0]))].sort((a, b) => a - b);
  const last = persona?.h[persona.h.length - 1];
  const name = (x: number) => personName(core, x);
  const group = new Map<number, FinalRow[]>();
  for (const f of rows) {
    const u = f[OBS] === p ? f[SUB] : f[OBS];
    const l = group.get(u);
    if (l) l.push(f);
    else group.set(u, [f]);
  }
  const partners = [...group.entries()].map(([u, l]) => ({ u, l, n: new Set(l.map((f) => f[0])).size }))
    .sort((a, b) => b.n - a.n || b.l.length - a.l.length);
  const range = (l: FinalRow[]) => {
    if (!l.length) return "—";
    const v = l.map((f) => f[BEN]);
    const a = Math.min(...v);
    const b = Math.max(...v);
    return a === b ? signed(a) : `${signed(a)} ～ ${signed(b)}`;
  };
  const mean = (l: FinalRow[]) => (l.length ? l.reduce((n, f) => n + f[BEN], 0) / l.length : undefined);
  const perStory = storySet.map((i) => {
    const given = mean(rows.filter((f) => f[0] === i && f[OBS] === p));
    const got = mean(rows.filter((f) => f[0] === i && f[SUB] === p));
    return {
      label: archiveTitle(stories[i]),
      ab: given === undefined ? undefined : { v: given, text: t(`${name(p)} 给出的平均友善度 ${signed(given)}`, `${name(p)} gives on average ${signed(given)}`) },
      ba: got === undefined ? undefined : { v: got, text: t(`收到的平均友善度 ${signed(got)}`, `receives on average ${signed(got)}`) },
    };
  });
  return (
    <>
      <section className="card profile">
        <div className="person-head">
          <Avatar core={core} p={p} size={64} />
          <div>
            <h2>{name(p)}</h2>
            <p className="hint">{altName(core, p)}{altName(core, p) ? " · " : ""}{scopeName(row[2])} · {t(`说了 ${num(row[3])} 句 · 在 ${storySet.length} 个故事里有 ${num(rows.length)} 条关系`, `${num(row[3])} lines · ${num(rows.length)} relations in ${storySet.length} stories`)}</p>
          </div>
        </div>
        {persona?.d && <p className="description">{persona.d}</p>}
        {last ? (
          <div className="two">
            <div>
              <h3>{t("大五人格", "Big Five")}</h3>
              <OceanBars v={last[1]} />
              <p className="hint">{t("−1 到 +1，跨全部剧情累积；“—”表示这一维还没有评分。", "−1 to +1, accumulated over all stories; “—” means not scored yet.")}</p>
            </div>
            {persona.h.length > 1 && (
              <div>
                <h3>{t("随剧情的变化", "Over the story")}</h3>
                <div className="traits">
                  {bigFiveNames().map((trait, k) => {
                    const pts = persona.h.filter((h) => h[1][k] != null).map((h) => [h[0], h[1][k]!] as [number, number]);
                    return pts.length ? (
                      <div key={trait}>
                        <p className="hint">{trait}</p>
                        <StepLines series={[{ name: trait, pts }]} x0={persona.h[0][0]} x1={Math.max(persona.h[0][0] + 1, last[0])} height={70}
                          label={(seq) => { const s = storyAtQueue(stories, seq); return s ? archiveTitle(s) : ""; }} />
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="hint">{t("这个人物还没有性格评分。", "No personality scores for this character yet.")}</p>
        )}
      </section>

      {perStory.length > 1 && (
        <section className="card">
          <h2>{t("在各个故事里的友善度", "Friendliness story by story")}</h2>
          <div className="chart-key"><span>● {t(`${name(p)} 对别人`, `${name(p)} towards others`)}</span><span>○ {t(`别人对${name(p)}`, `others towards ${name(p)}`)}</span></div>
          <Dots title={t("平均友善度，按剧情顺序", "Mean friendliness, in story order")} rows={perStory} onPick={(i) => openStory(stories[storySet[i]].id)} />
          <p className="hint">{t("每一列是一个故事，取故事结束时的关系平均。点一列打开那个故事。", "Each column is one story, averaging the relations at its end. Click to open the story.")}</p>
        </section>
      )}

      {other !== null && group.has(other) && <PairCard core={core} a={p} b={other} list={group.get(other)!} openStory={openStory} />}

      <section className="card">
        <h2>{t(`和谁有关系（${partners.length} 人）`, `Relations with (${partners.length})`)}</h2>
        <p className="hint">{t("友善度范围是各故事结束时的最小值到最大值。点一行看两人逐故事的对比。", "Friendliness ranges from the lowest to the highest story end. Click a row to compare the pair story by story.")}</p>
        <table>
          <thead>
            <tr>
              <th>{t("对象", "With")}</th>
              <th className="n">{t("共同故事", "Stories")}</th>
              <th className="n">{t(`${name(p)} → 对方`, `${name(p)} → them`)}</th>
              <th className="n">{t(`对方 → ${name(p)}`, `them → ${name(p)}`)}</th>
            </tr>
          </thead>
          <tbody>
            {partners.map(({ u, l, n }) => (
              <tr key={u} className={"go" + (u === other ? " on" : "")} onClick={() => openPerson(p, u)}>
                <td><span className="inline-person"><Avatar core={core} p={u} size={20} />{name(u)}</span></td>
                <td className="n">{n}</td>
                <td className="n">{range(l.filter((f) => f[OBS] === p))}</td>
                <td className="n">{range(l.filter((f) => f[SUB] === p))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function PairCard({ core, a, b, list, openStory }: {
  core: Core;
  a: number;
  b: number;
  list: FinalRow[];
  openStory: (id: string, pair?: [number, number]) => void;
}) {
  const stories = core.manifest.stories;
  const name = (x: number) => personName(core, x);
  const idx = [...new Set(list.map((f) => f[0]))].sort((x, y) => x - y);
  const rows = idx.map((i) => ({ i, ab: list.find((f) => f[0] === i && f[OBS] === a), ba: list.find((f) => f[0] === i && f[OBS] === b) }));
  const point = (f: FinalRow | undefined, k: number, who: string) => (f ? { v: f[k], text: `${who}：${signed(f[k])}（${typeName(f[TYPE])}）` } : undefined);
  const cells = (f?: FinalRow) => f
    ? [<td key="t">{typeName(f[TYPE])}</td>, <td key="b" className="n">{signed(f[BEN])}</td>, <td key="p" className="n">{signed(f[POW])}</td>]
    : [<td key="t">—</td>, <td key="b" className="n">—</td>, <td key="p" className="n">—</td>];
  return (
    <section className="card">
      <h2>{name(a)} ⇄ {name(b)}</h2>
      <p className="hint">{t(`每个点是一个故事结束时的值，从左到右按剧情顺序，共 ${idx.length} 个故事。每个故事里两人的关系从零算起，点与点之间不是连续变化。`, `Each dot is a story's end value, in story order: ${idx.length} stories. Each story starts the pair afresh, so the dots are not one continuous line.`)}</p>
      <div className="chart-key"><span>● {name(a)} → {name(b)}</span><span>○ {name(b)} → {name(a)}</span></div>
      <div className="two">
        <Dots title={t("友善度", "Friendliness")} onPick={(i) => openStory(stories[rows[i].i].id, [a, b])}
          rows={rows.map((r) => ({ label: archiveTitle(stories[r.i]), ab: point(r.ab, BEN, `${name(a)} → ${name(b)}`), ba: point(r.ba, BEN, `${name(b)} → ${name(a)}`) }))} />
        <Dots title={t("支配度", "Dominance")} onPick={(i) => openStory(stories[rows[i].i].id, [a, b])}
          rows={rows.map((r) => ({ label: archiveTitle(stories[r.i]), ab: point(r.ab, POW, `${name(a)} → ${name(b)}`), ba: point(r.ba, POW, `${name(b)} → ${name(a)}`) }))} />
      </div>
      <table>
        <thead>
          <tr><th>{t("故事", "Story")}</th><th colSpan={3}>{name(a)} → {name(b)}</th><th colSpan={3}>{name(b)} → {name(a)}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.i} className="go" onClick={() => openStory(stories[r.i].id, [a, b])}>
              <td>{archiveTitle(stories[r.i])}</td>
              {cells(r.ab)}
              {cells(r.ba)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
