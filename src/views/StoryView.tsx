import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react";
import { archiveCode, archiveTitle, avatarUrl, categories, categoryColors, categoryName, type Category } from "../archives";
import { t } from "../i18n";
import type { Core } from "../model/load";
import { useStory } from "../model/load";
import {
  arrange, bisect, edgesAt, eventAt, indexStory, layout, pairKey, personaAt, stateAt, toQueue, trend,
  type Edge, type IndexedStory, type Keep, type Sort,
} from "../model/model";
import { BEN, INT, POW, SEQ, TYPE, type StoryMeta } from "../model/types";
import { Bars, Circumplex, OceanBars, StepLines, Timeline } from "../ui/charts";
import { hideTip, hover } from "../ui/tip";
import { num, positionLabel, signed, typeName } from "../ui/format";
import { altName, Avatar, NewBadge, PersonLink, personName, scopeName } from "./common";

export type Selection = { kind: "event"; i: number } | { kind: "pair"; o: number; t: number } | { kind: "node"; u: number } | null;
type Pane = "events" | "rels" | "charts" | "detail";
const W = 1000;
const H = 680;

export default function StoryView(props: {
  core: Core;
  named: boolean;
  keep: Keep;
  storyId: string;
  openStory: (id: string) => void;
  openPerson: (p: number, other?: number) => void;
  report: (s: IndexedStory, pos: number, sel: Selection) => void;
  relationsOf: (s: StoryMeta) => number;
  /** A pair to select on opening, from a link on a character page. */
  pair?: [number, number];
}) {
  const { core, storyId } = props;
  const meta = core.manifest.stories.find((s) => s.id === storyId) ?? core.manifest.stories[0];
  const loaded = useStory(meta.id);
  return (
    <div className="story-view">
      <StoryList {...props} current={meta.id} />
      {loaded.data ? (
        <StoryStage key={meta.id + (props.pair ? `|${props.pair.join("-")}` : "")} core={core} keep={props.keep} pair={props.pair}
          story={indexStory(meta, loaded.data)} openPerson={props.openPerson} report={props.report} />
      ) : (
        <div className="stage-loading">{loaded.error ? t("这个故事没能载入，请刷新重试。", "This story did not load; try reloading.") : t("载入中…", "Loading…")}</div>
      )}
    </div>
  );
}

function StoryList({ core, current, openStory, relationsOf }: {
  core: Core;
  current: string;
  openStory: (id: string) => void;
  relationsOf: (s: StoryMeta) => number;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "">("");
  const [sort, setSort] = useState<Sort>("queue");
  const query = q.trim().toLocaleLowerCase();
  const match = (s: StoryMeta) =>
    (!cat || s.category === cat) &&
    (!query || [s.title, archiveTitle(s), s.code, archiveCode(s), ...s.top].join(" ").toLocaleLowerCase().includes(query));
  const { pinned, rest } = arrange(core.manifest.stories.filter(match), sort, relationsOf);
  const item = (s: StoryMeta) => (
    <button key={s.id} type="button" aria-current={s.id === current} onClick={() => openStory(s.id)}
      ref={s.id === current ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}>
      <span className="item-title"><i className="key-swatch" style={{ background: categoryColors[s.category] }} />{archiveTitle(s)} <NewBadge kind={s.new} /></span>
      <span className="item-meta">{archiveCode(s)} · {t(`${num(s.m)} 句 · ${num(relationsOf(s))} 关系`, `${num(s.m)} lines · ${num(relationsOf(s))} relations`)}</span>
    </button>
  );
  return (
    <nav className="pick" aria-label={t("故事列表", "Stories")}>
      <div className="pick-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("搜故事或角色", "Search stories or characters")} aria-label={t("搜故事或角色", "Search stories or characters")} />
        <div className="row">
          <select value={cat} onChange={(e) => setCat(e.target.value as Category | "")} aria-label={t("类别", "Category")}>
            <option value="">{categoryName("全部")}</option>
            {categories.map((c) => <option key={c} value={c}>{categoryName(c)}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t("排序", "Sort")}>
            <option value="queue">{t("剧情顺序", "Story order")}</option>
            <option value="relations">{t("关系最多", "Most relations")}</option>
            <option value="messages">{t("台词最多", "Most lines")}</option>
            <option value="events">{t("事件最多", "Most events")}</option>
          </select>
        </div>
      </div>
      <div className="items">
        {pinned.length > 0 && <p className="items-head">{t("最新加入", "Just added")}</p>}
        {pinned.map(item)}
        {pinned.length > 0 && rest.length > 0 && <p className="items-head">{t("全部故事", "All stories")}</p>}
        {rest.map(item)}
        {!pinned.length && !rest.length && <p className="more">{t("没有匹配的故事", "No matching story")}</p>}
      </div>
    </nav>
  );
}

function StoryStage({ core, keep, story: s, openPerson, report, pair }: {
  core: Core;
  keep: Keep;
  story: IndexedStory;
  pair?: [number, number];
  openPerson: (p: number, other?: number) => void;
  report: (s: IndexedStory, pos: number, sel: Selection) => void;
}) {
  const { meta, data } = s;
  const [cur, setCur] = useState(data.m);
  const [sel, setSel] = useState<Selection>(pair ? { kind: "pair", o: pair[0], t: pair[1] } : null);
  const [pane, setPane] = useState<Pane>(pair ? "detail" : "events");
  const [playing, setPlaying] = useState(false);
  const pos = useMemo(() => layout(s, keep, W, H), [s, keep]);
  const series = useMemo(() => trend(s, keep), [s, keep]);
  const stops = useMemo(() => [...new Set(series.map((p) => p.pos))], [series]);
  const scenes = useMemo(() => [...new Set(data.ev.map((e) => e[2]))].map((sc) => data.ev.find((e) => e[2] === sc)![0]), [data]);
  const edges = useMemo(() => edgesAt(s, cur, keep), [s, cur, keep]);
  const name = (p: number) => personName(core, p);
  const go = (v: number) => setCur(Math.max(1, Math.min(data.m, Math.round(v))));
  const nextStop = () => {
    const i = bisect(stops, cur, (v) => v);
    return i < stops.length ? stops[i] : null;
  };
  const prevStop = () => {
    const i = bisect(stops, cur - 1, (v) => v);
    return i > 0 ? stops[i - 1] : 1;
  };
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setCur((c) => {
        const i = bisect(stops, c, (v) => v);
        if (i >= stops.length) {
          setPlaying(false);
          return c;
        }
        return stops[i];
      });
    }, 420);
    return () => clearInterval(timer);
  }, [playing, stops]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (/INPUT|SELECT|TEXTAREA/.test(el.tagName) && el.getAttribute("type") !== "range") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        const n = nextStop();
        if (n) go(n);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        go(prevStop());
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const pick = (next: Selection) => {
    setSel(next);
    setPane("detail");
  };
  const now = eventAt(s, cur);
  const nowEvent = now >= 0 ? data.ev[now] : null;
  const label = (p: number) => {
    const at = stateAt(series.map((x) => [x.pos, x.n] as const), p);
    const e = data.ev[eventAt(s, p)];
    return [positionLabel(p, data.m), t(`${num(at ? at[1] : 0)} 条关系`, `${num(at ? at[1] : 0)} relations`), e ? e[3] : ""];
  };

  return (
    <>
      <section className="center">
        <header className="stage-head">
          <div>
            <p className="eyebrow">{archiveCode(meta)} <NewBadge kind={meta.new} /></p>
            <h2>{archiveTitle(meta)}</h2>
          </div>
          <p className="stage-meta">
            {t(`${num(data.m)} 句 · ${data.sc} 个场景 · ${num(data.ev.length)} 个事件 · ${num(data.who.length)} 人说话`,
              `${num(data.m)} lines · ${data.sc} scenes · ${num(data.ev.length)} events · ${num(data.who.length)} speakers`)}
            <button type="button" className="ghost small" onClick={() => report(s, cur, sel)}>
              <Flag size={14} /> {t("纠错", "Report")}
            </button>
          </p>
        </header>
        <div className="stage">
          <Graph core={core} s={s} pos={pos} edges={edges} cur={cur} sel={sel} pick={pick} />
          <div className="legend">
            <span><i className="key-line pos" />{t("友善", "warm")}</span>
            <span><i className="key-line neg" />{t("敌意", "hostile")}</span>
            <span>{t("线越粗越鲜明 · 箭头指向对象 · 圆越大说话越多 · 发光的线刚刚变化", "thicker is stronger · arrow points at the other · bigger speaks more · glowing just changed")}</span>
          </div>
          {!edges.length && (
            <p className="empty">
              {s.pairs.size ? (cur >= data.m ? t("这个故事没有符合筛选的关系", "No relation in this story matches the filter") : t("这个位置还没有形成关系", "No relation has formed yet at this point")) : t("这个故事没有关系记录", "This story has no relations")}
            </p>
          )}
        </div>
        <div className="scrub">
          <Timeline points={series} m={data.m} cur={cur} scenes={scenes} label={label}
            onSeek={(p) => {
              setPlaying(false);
              go(p);
            }} />
          <div className="controls">
            <button type="button" onClick={() => { setPlaying(false); go(1); }} aria-label={t("回到开头", "Back to the start")}><SkipBack size={15} /></button>
            <button type="button" onClick={() => { setPlaying(false); go(prevStop()); }} aria-label={t("上一个变化", "Previous change")}><StepBack size={15} /></button>
            <button type="button" className="play" onClick={() => {
              if (playing) return setPlaying(false);
              if (!nextStop()) go(1);
              setPlaying(true);
            }}>
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? t("暂停", "Pause") : t("播放", "Play")}
            </button>
            <button type="button" onClick={() => { setPlaying(false); const n = nextStop(); if (n) go(n); }} aria-label={t("下一个变化", "Next change")}><StepForward size={15} /></button>
            <input type="range" min={1} max={data.m} value={cur} aria-label={t("故事内位置", "Position in the story")}
              onChange={(e) => { setPlaying(false); go(+e.target.value); }} />
            <span className="pos">{positionLabel(cur, data.m)}{nowEvent ? ` · ${t(`场景 ${nowEvent[2] + 1}`, `scene ${nowEvent[2] + 1}`)}` : ""}</span>
          </div>
        </div>
      </section>
      <aside className="side">
        <nav className="tabs" aria-label={t("右栏", "Side panel")}>
          {([["events", t("事件", "Events")], ["rels", t("关系", "Relations")], ["charts", t("图表", "Charts")], ["detail", t("详情", "Details")]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-current={pane === k} onClick={() => setPane(k)}>{l}</button>
          ))}
        </nav>
        {pane === "events" && <EventsPane core={core} s={s} cur={cur} now={now} playing={playing} jump={(i) => { setPlaying(false); go(data.ev[i][1]); pick({ kind: "event", i }); }} />}
        {pane === "rels" && <RelationsPane core={core} edges={edges} pick={pick} />}
        {pane === "charts" && <ChartsPane core={core} edges={edges} pick={pick} />}
        {pane === "detail" && <Detail core={core} s={s} cur={cur} edges={edges} sel={sel} pick={pick} openPerson={openPerson} go={go} name={name} />}
      </aside>
    </>
  );
}

function Graph({ core, s, pos, edges, cur, sel, pick }: {
  core: Core;
  s: IndexedStory;
  pos: Map<number, { x: number; y: number }>;
  edges: Edge[];
  cur: number;
  sel: Selection;
  pick: (s: Selection) => void;
}) {
  const has = new Set(edges.map((e) => pairKey(e.o, e.t)));
  const linked = new Set(edges.flatMap((e) => [e.o, e.t]));
  const focus = sel && sel.kind === "node" ? sel.u : null;
  const most = Math.max(1, ...[...pos.keys()].map((u) => (s.said.get(u) ?? [0, 0])[1]));
  const lastStop = s.stops[bisect(s.stops, cur, (v) => v) - 1];
  const name = (p: number) => personName(core, p);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="graph" role="img"
      aria-label={t("这个故事的关系网；文字版见右侧“关系”", "This story's network; the Relations tab lists it as text")}
      onMouseLeave={hideTip}>
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g>
        {edges.map((e) => {
          const a = pos.get(e.o);
          const b = pos.get(e.t);
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const off = has.has(pairKey(e.t, e.o)) ? 0.14 : 0.05;
          const cx = (a.x + b.x) / 2 - dy * off;
          const cy = (a.y + b.y) / 2 + dx * off;
          const warm = e.r[BEN] >= 0;
          const on = sel?.kind === "pair" && ((sel.o === e.o && sel.t === e.t) || (sel.o === e.t && sel.t === e.o));
          const dim = (focus !== null && e.o !== focus && e.t !== focus) || (sel?.kind === "pair" && !on);
          const fresh = e.r[SEQ] === lastStop && cur - lastStop < Math.max(40, s.data.m / 60);
          const op = dim ? 0.08 : on ? 1 : 0.32 + 0.6 * Math.min(1, Math.abs(e.r[BEN]) + 0.15);
          const d = `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`;
          const q = 0.78;
          const mx = (1 - q) * (1 - q) * a.x + 2 * (1 - q) * q * cx + q * q * b.x;
          const my = (1 - q) * (1 - q) * a.y + 2 * (1 - q) * q * cy + q * q * b.y;
          const tx = 2 * (1 - q) * (cx - a.x) + 2 * q * (b.x - cx);
          const ty = 2 * (1 - q) * (cy - a.y) + 2 * q * (b.y - cy);
          const tl = Math.max(1, Math.hypot(tx, ty));
          const ux = tx / tl;
          const uy = ty / tl;
          const z = 5 + 3 * e.r[INT];
          return (
            <g key={pairKey(e.o, e.t)} className={"edge " + (warm ? "pos" : "neg") + (fresh ? " fresh" : "")} style={{ opacity: op }}>
              <path d={d} strokeWidth={(1 + 5 * e.r[INT]) * (on ? 1.5 : 1)} filter={fresh ? "url(#glow)" : undefined} />
              <polygon points={`${mx + ux * z},${my + uy * z} ${mx - ux * z - uy * z * 0.7},${my - uy * z + ux * z * 0.7} ${mx - ux * z + uy * z * 0.7},${my - uy * z - ux * z * 0.7}`} />
              <path d={d} className="hit" onClick={() => pick({ kind: "pair", o: e.o, t: e.t })}
                {...hover(() => [`${name(e.o)} → ${name(e.t)}`, `${typeName(e.r[TYPE])} · ${t("友善", "friendly")} ${signed(e.r[BEN])} · ${t("支配", "dominant")} ${signed(e.r[POW])}`])} />
            </g>
          );
        })}
      </g>
      <g>
        {[...pos.entries()].map(([u, n]) => {
          const said = s.said.get(u);
          if (!linked.has(u) && (!said || said[2] > cur)) return null;
          const r = 9 + 13 * Math.sqrt((said ? said[1] : 0) / most);
          const dim = focus !== null && focus !== u && !edges.some((e) => (e.o === focus && e.t === u) || (e.t === focus && e.o === u));
          const key = core.media.avatars[String(u)];
          const clip = `c-${s.meta.id}-${u}`;
          return (
            <g key={u} className={"node" + (focus === u ? " on" : "")} style={{ opacity: dim ? 0.22 : 1 }} onClick={() => pick({ kind: "node", u })}
              {...hover(() => [name(u), t(`在这个故事说了 ${num(said ? said[1] : 0)} 句`, `${num(said ? said[1] : 0)} lines in this story`)])}>
              <circle cx={n.x} cy={n.y} r={r + 2} className="ring" />
              {key ? (
                <>
                  <clipPath id={clip}><circle cx={n.x} cy={n.y} r={r} /></clipPath>
                  <image href={avatarUrl(key)} x={n.x - r} y={n.y - r} width={2 * r} height={2 * r} clipPath={`url(#${clip})`} preserveAspectRatio="xMidYMid slice" />
                </>
              ) : (
                <>
                  <circle cx={n.x} cy={n.y} r={r} className="disc" />
                  <text x={n.x} y={n.y + 4} textAnchor="middle" className="initial">{Array.from(core.people.people[u][0])[0]}</text>
                </>
              )}
              <text x={n.x} y={n.y + r + 15} textAnchor="middle" className="label">{name(u)}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function EventsPane({ core, s, cur, now, playing, jump }: {
  core: Core;
  s: IndexedStory;
  cur: number;
  now: number;
  playing: boolean;
  jump: (i: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLButtonElement>(null);
  // the list follows the timeline: dragging or playing glides the current event to the middle of the panel
  useEffect(() => {
    const el = current.current;
    const container = box.current;
    if (!el || !container) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top, behavior: "smooth" });
  }, [now, playing]);
  let scene = -1;
  return (
    <div className="pane events" ref={box}>
      {s.data.ev.map((e, i) => {
        const head = e[2] !== scene ? <p key={`s${e[2]}`} className="scene-head">{t(`场景 ${e[2] + 1}`, `Scene ${e[2] + 1}`)}</p> : null;
        scene = e[2];
        const state = i === now ? " now" : e[0] > cur ? " future" : "";
        return [
          head,
          <button key={i} ref={i === now ? current : undefined} type="button" className={"ev" + state} onClick={() => jump(i)}>
            <span className="ev-title">{e[3]}</span>
            <span className="ev-meta">
              {t(`${num(e[6])} 句`, `${num(e[6])} lines`)} · {e[5].slice(0, 4).map((p) => personName(core, p)).join("、")}{e[5].length > 4 ? t(` 等 ${e[5].length} 人`, ` +${e[5].length - 4}`) : ""}
            </span>
          </button>,
        ];
      })}
      {!s.data.ev.length && <p className="hint">{t("这个故事没有事件记录。", "No events in this story.")}</p>}
    </div>
  );
}

function RelationsPane({ core, edges, pick }: { core: Core; edges: Edge[]; pick: (s: Selection) => void }) {
  const rows = [...edges].sort((a, b) => b.r[INT] - a.r[INT]);
  return (
    <div className="pane">
      <p className="hint">{t(`此刻 ${num(edges.length)} 条关系，按鲜明程度排序`, `${num(edges.length)} relations at this point, most pronounced first`)}</p>
      <table>
        <thead>
          <tr><th>{t("关系", "Relation")}</th><th>{t("类型", "Type")}</th><th className="n">{t("友善", "Friendly")}</th><th className="n">{t("支配", "Dominant")}</th></tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={pairKey(e.o, e.t)} className="go" onClick={() => pick({ kind: "pair", o: e.o, t: e.t })}>
              <td>{personName(core, e.o)} → {personName(core, e.t)}</td>
              <td>{typeName(e.r[TYPE])}</td>
              <td className="n">{signed(e.r[BEN])}</td>
              <td className="n">{signed(e.r[POW])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartsPane({ core, edges, pick }: { core: Core; edges: Edge[]; pick: (s: Selection) => void }) {
  const types = Array.from({ length: 8 }, (_, i) => ({ label: typeName(i), value: edges.filter((e) => e.r[TYPE] === i).length }))
    .filter((r) => r.value).sort((a, b) => b.value - a.value);
  const warm = edges.filter((e) => e.r[BEN] >= 0).length;
  return (
    <div className="pane">
      <h3>{t("此刻的关系分布", "Relations at this point")}</h3>
      <Circumplex
        points={edges.map((e) => ({
          key: pairKey(e.o, e.t), b: e.r[BEN], p: e.r[POW], i: e.r[INT],
          lines: () => [`${personName(core, e.o)} → ${personName(core, e.t)}`, `${typeName(e.r[TYPE])} · ${t("友善", "friendly")} ${signed(e.r[BEN])} · ${t("支配", "dominant")} ${signed(e.r[POW])}`],
        }))}
        onPick={(k) => {
          const [o, tt] = k.split("|").map(Number);
          pick({ kind: "pair", o, t: tt });
        }} />
      <p className="hint">
        {t(`每个点是一条关系：越往右越友善，越往上越居高，点越大越鲜明。此刻 ${num(warm)} 条友善、${num(edges.length - warm)} 条敌意。`,
          `Each dot is a relation: warmer to the right, more dominant upward, larger when more pronounced. Now ${num(warm)} warm, ${num(edges.length - warm)} hostile.`)}
      </p>
      {types.length > 0 && (
        <>
          <h3>{t("此刻的类型", "Types at this point")}</h3>
          <Bars rows={types} total={edges.length} />
        </>
      )}
    </div>
  );
}

function summaryParts(text: string) {
  return String(text).split(" | ").map((part) => {
    const out: [string, string][] = [];
    part.split(/\[(What|Who|How)\]\s*/).forEach((x, i, all) => {
      if (i % 2 === 1 && all[i + 1]?.trim()) out.push([x, all[i + 1].trim()]);
    });
    return out.length ? out : [["", part.trim()] as [string, string]];
  });
}
const partNames: Record<string, [string, string]> = { What: ["发生", "What"], Who: ["人物", "Who"], How: ["经过", "How"] };

function Detail({ core, s, cur, edges, sel, pick, openPerson, go, name }: {
  core: Core;
  s: IndexedStory;
  cur: number;
  edges: Edge[];
  sel: Selection;
  pick: (s: Selection) => void;
  openPerson: (p: number, other?: number) => void;
  go: (pos: number) => void;
  name: (p: number) => string;
}) {
  const { data } = s;
  if (!sel) return <div className="pane"><p className="hint">{t("点图上的线或人，或在“事件”“关系”里点一项，这里会显示详情。", "Click a line or a person in the network, or an item in Events or Relations, to see it here.")}</p></div>;
  if (sel.kind === "event") {
    const e = data.ev[sel.i];
    return (
      <div className="pane">
        <h3>{e[3]}</h3>
        <p className="hint">
          {t(`场景 ${e[2] + 1} · ${num(e[6])} 句 · 第 ${num(e[0])}–${num(e[1])} 句`, `Scene ${e[2] + 1} · ${num(e[6])} lines · lines ${num(e[0])}–${num(e[1])}`)}
          {" · "}<button type="button" className="link" onClick={() => go(e[1])}>{t("跳到这里", "Go here")}</button>
        </p>
        <p className="who-line">
          {t("参与者：", "Participants: ")}
          {e[5].map((p, i) => <span key={p}>{i ? t("、", ", ") : ""}<PersonLink core={core} p={p} open={(q) => pick({ kind: "node", u: q })} /></span>)}
        </p>
        {summaryParts(e[4]).map((parts, i) => (
          <div key={i} className="summary">
            {parts.map(([k, v], j) => (
              <p key={j}>{k && <b>{t(partNames[k][0], partNames[k][1])}：</b>}{v}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }
  if (sel.kind === "pair") {
    return (
      <div className="pane">
        <h3>{name(sel.o)} ⇄ {name(sel.t)}</h3>
        <button type="button" className="link" onClick={() => openPerson(sel.o, sel.t)}>{t("看这两人在全部故事里的关系", "See this pair across all stories")}</button>
        {[[sel.o, sel.t], [sel.t, sel.o]].map(([a, b]) => {
          const rows = s.pairs.get(pairKey(a, b)) ?? [];
          const at = stateAt(rows, cur);
          return (
            <section key={`${a}-${b}`} className="direction">
              <h4>{name(a)} → {name(b)}</h4>
              <p className="hint">
                {at ? t(`此刻：${typeName(at[TYPE])}，友善 ${signed(at[BEN])}，支配 ${signed(at[POW])}，强度 ${at[INT].toFixed(2)}`, `Now: ${typeName(at[TYPE])}, friendliness ${signed(at[BEN])}, dominance ${signed(at[POW])}, intensity ${at[INT].toFixed(2)}`)
                  : rows.length ? t("此刻还没有形成", "Not formed yet at this point") : t("这个方向没有关系", "No relation this way")}
              </p>
              {rows.length > 0 && (
                <StepLines x0={1} x1={data.m} mark={cur} label={(x) => positionLabel(x, data.m)}
                  series={[
                    { name: t("友善度", "Friendliness"), pts: rows.map((r) => [r[SEQ], r[BEN]]) },
                    { name: t("支配度", "Dominance"), dash: true, pts: rows.map((r) => [r[SEQ], r[POW]]) },
                  ]} />
              )}
            </section>
          );
        })}
      </div>
    );
  }
  const u = sel.u;
  const said = s.said.get(u);
  const row = core.people.people[u];
  const mine = edges.filter((e) => e.o === u || e.t === u).sort((a, b) => b.r[INT] - a.r[INT]);
  const v = personaAt(core.people.persona[String(u)], toQueue(data.segs, cur));
  return (
    <div className="pane">
      <div className="person-head">
        <Avatar core={core} p={u} size={48} />
        <div>
          <h3>{name(u)}</h3>
          <p className="hint">{altName(core, u)}{altName(core, u) ? " · " : ""}{scopeName(row[2])}</p>
        </div>
      </div>
      <p className="hint">
        {t(`在这个故事说了 ${num(said ? said[1] : 0)} 句，全部剧情 ${num(row[3])} 句。`, `${num(said ? said[1] : 0)} lines in this story, ${num(row[3])} in all.`)}{" "}
        <button type="button" className="link" onClick={() => openPerson(u)}>{t("看此人的全部故事", "See all stories")}</button>
      </p>
      {v && <><h4>{t("大五人格（到此处为止）", "Big Five (up to here)")}</h4><OceanBars v={v} /></>}
      <h4>{t(`此刻的关系（${mine.length}）`, `Relations now (${mine.length})`)}</h4>
      <table>
        <tbody>
          {mine.map((e) => (
            <tr key={pairKey(e.o, e.t)} className="go" onClick={() => pick({ kind: "pair", o: e.o, t: e.t })}>
              <td>{name(e.o)} → {name(e.t)}</td>
              <td>{typeName(e.r[TYPE])}</td>
              <td className="n">{signed(e.r[BEN])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
