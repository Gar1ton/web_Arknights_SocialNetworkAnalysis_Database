import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { ArrowUpRight, ArrowLeft, Search, X, Orbit } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import {
  archiveCode,
  archiveTitle,
  avatarUrl,
  archiveCategory,
  filterName,
  filters,
  dataVersion,
  englishName,
  mediaUrl,
  newLabel,
  searchArchives,
  type Filter,
} from "./archives";
import { type Settings, showcaseFlow } from "./settings";
import { locale, plural, t } from "./i18n";
import LangSwitch from "./LangSwitch";
import { useLang } from "./useLang";
import type { Core } from "./model/load";
import type { MediaMap } from "./model/types";
import { personByName, pinnedFirst, type Catalog, type Story } from "./model/catalog";
import { storyHash } from "./routes";
const PAGE = 24;
type ArchiveMedia = MediaMap["archives"][string];
/** Stories and characters: the two indexes share one shell. */
export function IndexSwitch({ current }: { current: "archives" | "people" }) {
  return (
    <nav className="index-switch" aria-label={t("目录", "Index")}>
      <a href="#archives" aria-current={current === "archives" ? "page" : undefined}>
        {t("剧情", "Stories")}
      </a>
      <a href="#people" aria-current={current === "people" ? "page" : undefined}>
        {t("角色", "Characters")}
      </a>
    </nav>
  );
}
/** Avatar keys for a story's leading names, where an avatar exists. */
export function castOf(core: Core, byName: Map<string, number>, s: Story) {
  return (s.top ?? []).map((n) => {
    const p = byName.get(n);
    return p === undefined ? null : core.media.avatars[String(p)] ?? null;
  });
}
export function Portrait({ id, name }: { id?: string | null; name: string }) {
  return (
    <span className="portrait">
      {id ? (
        <img src={avatarUrl(id)} alt="" loading="lazy" decoding="async" />
      ) : (
        <b>{[...name.replace(/^[“"]/, "")][0]}</b>
      )}
    </span>
  );
}
export function Cover({
  archive,
  index,
  media,
  cast,
}: {
  archive: Story;
  index: number;
  media?: ArchiveMedia;
  cast: (string | null)[];
}) {
  if (media?.banner)
    return (
      <div className="archive-cover has-banner" aria-hidden="true">
        <img src={mediaUrl(media.banner)} alt="" loading="lazy" decoding="async" />
        {archive.new && <span className="cover-new">{newLabel(archive.new)}</span>}
      </div>
    );
  // Without a banner: the record's operator, or the story's leading cast.
  const faces = media?.lead
    ? [media.lead]
    : (cast.filter(Boolean) as string[]);
  return (
    <div className={"archive-cover cover-" + index} aria-hidden="true">
      <svg viewBox="0 0 500 240" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={"wash-" + archive.id}>
            <stop stopColor={archive.color} stopOpacity=".2" />
            <stop offset="1" stopColor={archive.color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx={320 - index * 12}
          cy="115"
          rx="190"
          ry="145"
          fill={`url(#wash-${archive.id})`}
        />
        <g fill="none" stroke={archive.color}>
          {Array.from({ length: 15 }, (_, i) => (
            <ellipse
              key={i}
              cx="330"
              cy="120"
              rx={36 + i * 9}
              ry={30 + i * 3.5}
              transform={`rotate(${index % 2 ? -36 : 32} 330 120)`}
              opacity={0.1 + (i % 4) * 0.04}
              strokeWidth=".55"
            />
          ))}
          <circle cx="330" cy="120" r="72" strokeWidth=".7" opacity=".4" />
          <path
            d="M25 172Q220 48 475 150M50 180Q300 215 460 44"
            strokeWidth=".6"
            opacity=".2"
          />
          <path
            d="M330 14V225M200 120H465"
            strokeWidth=".5"
            opacity=".15"
            strokeDasharray="2 8"
          />
        </g>
        <g fill={archive.color}>
          {Array.from({ length: 16 }, (_, i) => {
            const a = i * 2.399 + index;
            const r = 40 + i * 5.5;
            return (
              <circle
                key={i}
                cx={330 + Math.cos(a) * r * 1.2}
                cy={120 + Math.sin(a) * r * 0.72}
                r={i % 4 === 0 ? 2.3 : 1}
                opacity={i % 4 === 0 ? 0.8 : 0.4}
              />
            );
          })}
        </g>
      </svg>
      {faces.length > 0 && (
        <div className={"cover-faces" + (media?.lead ? " lead" : "")}>
          {faces.map((id) => (
            <Portrait key={id} id={id} name="" />
          ))}
        </div>
      )}
      <span className="cover-index">
        {String(archive.index + 1).padStart(2, "0")}
      </span>
      {archive.new && <span className="cover-new">{newLabel(archive.new)}</span>}
    </div>
  );
}
export function StoryCard({
  archive,
  order,
  core,
  byName,
}: {
  archive: Story;
  order: number;
  core: Core;
  byName: Map<string, number>;
}) {
  const pictures = core.media.archives[archive.id];
  const cast = castOf(core, byName, archive);
  const num = (n: number) => n.toLocaleString(locale());
  return (
    <a
      href={storyHash(archive.id)}
      className={"archive-card" + (archive.new ? " is-new" : "")}
      style={
        {
          "--archive-color": archive.color,
          "--card-order": order % PAGE,
        } as React.CSSProperties
      }
      aria-label={t(
        "查看" + archive.title + "关系图",
        "Open the relation graph of " + archiveTitle(archive),
      )}
    >
      <Cover archive={archive} index={archive.index % 7} media={pictures} cast={cast} />
      <div className="archive-card-content">
        <div className="archive-card-top">
          {/* The category sits on the right; English keeps only the episode here. */}
          <span>
            {t(
              archive.code,
              archiveCode(archive)
                .replace(archiveCategory(archive), "")
                .replace(/^ · /, ""),
            )}
          </span>
          <span className="archive-category">{archiveCategory(archive)}</span>
        </div>
        <div className="archive-card-title">
          <h2>{archiveTitle(archive)}</h2>
          <p>
            {cast.some(Boolean) && (
              <span className="cast-faces">
                {(archive.top ?? []).map((name, i) => (
                  <Portrait key={i} id={cast[i]} name={name} />
                ))}
              </span>
            )}
            <span>
              {t("台词最多：", "Most lines: ")}
              {(archive.top ?? []).map(englishName).join(t("、", ", "))}
            </span>
          </p>
        </div>
        <p className="archive-description">
          {t(
            `${num(archive.m)} 句台词 · ${archive.sc} 个场景 · ${num(archive.ev)} 个事件`,
            `${plural("line", archive.m)} · ${plural("scene", archive.sc)} · ${plural("event", archive.ev)}`,
          )}
        </p>
        <div className="archive-card-bottom">
          <span>
            {archive.people} <small>{t("名角色", "characters")}</small>
            <i /> {archive.relations} <small>{t("条关系", "relations")}</small>
          </span>
          <span className="card-open">
            <ArrowUpRight size={19} />
          </span>
        </div>
      </div>
    </a>
  );
}
export default function Library({
  settings,
  core,
  catalog,
}: {
  settings: Settings;
  core: Core;
  catalog: Catalog;
}) {
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target as HTMLElement).closest("input,textarea,select")
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    addEventListener("keydown", shortcut);
    return () => removeEventListener("keydown", shortcut);
  }, []);
  const archives = catalog.stories;
  const byName = useMemo(() => personByName(core), [core]);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<Filter>("全部"),
    [shown, setShown] = useState(PAGE);
  const matches = useMemo(
    () => pinnedFirst(searchArchives(archives, query, category)),
    [archives, query, category],
  );
  const pinned = matches.filter((a) => a.new).length;
  useEffect(() => setShown(PAGE), [query, category]);
  // The event kinds are English-only filters.
  const language = useLang();
  useEffect(() => {
    if (!filters().includes(category)) setCategory("全部");
  }, [language]);
  const artSettings = useMemo(
    () => ({ ...settings, particles: 480, flowOpacity: showcaseFlow }),
    [settings],
  );
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="archive-library route-surface"
    >
      <div className="library-atmosphere">
        <FlowField settings={artSettings} subtle />
      </div>
      <div className="library-shell">
        <div className="library-brand-row">
          <Brand />
          <div className="library-brand-tools">
            <IndexSwitch current="archives" />
            <LangSwitch />
            <a href="#" className="quiet-link">
              <ArrowLeft size={13} /> {t("返回首页", "Home")}
            </a>
          </div>
        </div>
        <section className="library-intro">
          <div>
            <span className="eyebrow">
              <i /> {t("剧情目录", "Stories")}
            </span>
            <h1>
              {t("选择一段", "Choose a")}
              <br />
              <em>{t("剧情", "story")}</em>
            </h1>
            <p>
              {t(
                "每段剧情一张关系图，可以沿时间轴看关系一步步形成。最新加入的剧情排在最前，其余按剧情年代排列。",
                "One relation graph per story, with a timeline to watch it form. The latest additions come first, the rest in story order.",
              )}
            </p>
          </div>
          <div className="library-edition">
            <span>{t("收录", "Covers")}</span>
            <strong>{archives.length}</strong>
            <p>
              {t("段剧情", "stories")}
              <br />
              {filters()
                .slice(1)
                .map(
                  (f) =>
                    `${filterName(f)} ${searchArchives(archives, "", f).length}`,
                )
                .join(" · ")}
            </p>
            <small>
              {t("数据版本：", "Data version: ")}
              {dataVersion(core.manifest.info.version)}
            </small>
          </div>
        </section>
        <div className="archive-toolbar">
          <div
            className="archive-tabs"
            role="group"
            aria-label={t("剧情分类", "Story type")}
          >
            {filters().map((c) => (
              <button
                key={c}
                className={c === category ? "active" : ""}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {filterName(c)}
              </button>
            ))}
          </div>
          <label className="archive-search">
            <Search size={16} />
            <input
              ref={searchInput}
              aria-label={t("搜索剧情", "Search stories")}
              placeholder={t(
                "搜索剧情名、章节或角色名…",
                "Search by story, chapter or character…",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                aria-label={t("清空搜索", "Clear search")}
              >
                <X size={14} />
              </button>
            ) : (
              <span>/</span>
            )}
          </label>
        </div>
        <div className="archive-result-count" role="status">
          <span>
            {t(
              `共 ${matches.length} 项`,
              plural("story", matches.length, "stories"),
            )}
          </span>
          <span>{t("最新加入在前，其余按剧情年代", "Latest first, then in story order")}</span>
        </div>
        <div className="archive-grid">
          {matches.slice(0, shown).map((archive, index) => (
            <Fragment key={archive.id}>
              {index === 0 && pinned > 0 && (
                <p className="archive-group">
                  <span>{t("最新加入", "Just added")}</span>
                  <i />
                  <small>
                    {t(
                      `${core.manifest.info.updated} 更新`,
                      `Updated ${core.manifest.info.updated}`,
                    )}
                  </small>
                </p>
              )}
              {index === pinned && pinned > 0 && (
                <p className="archive-group">
                  <span>{t("全部剧情", "Every story")}</span>
                  <i />
                  <small>{t("按剧情年代", "In story order")}</small>
                </p>
              )}
              <StoryCard archive={archive} order={index} core={core} byName={byName} />
            </Fragment>
          ))}
        </div>
        {matches.length > shown && (
          <button
            className="wide-button library-more"
            onClick={() => setShown((n) => n + PAGE * 2)}
          >
            {t(
              `再显示 ${Math.min(PAGE * 2, matches.length - shown)} 项（还有 ${matches.length - shown} 项）`,
              `Show ${Math.min(PAGE * 2, matches.length - shown)} more (${matches.length - shown} left)`,
            )}
          </button>
        )}
        {!matches.length && (
          <div className="archive-empty">
            <Orbit size={32} />
            <h2>{t("没有找到这段剧情", "No story found")}</h2>
            <p>
              {t(
                "试试剧情名、章节号或角色名。",
                "Try a story title, chapter number or character name.",
              )}
            </p>
            <button
              className="wide-button"
              onClick={() => {
                setQuery("");
                setCategory("全部");
              }}
            >
              {t("查看全部", "Show all")}
            </button>
          </div>
        )}
        <footer className="library-footer">
          <span>
            {t(
              "数值由大模型根据剧情台词推断，仅供参考。",
              "Values are inferred by a large language model from the script. Treat them as estimates.",
            )}
          </span>
          <small>
            {t(
              "非官方项目，与鹰角网络无关联",
              "Unofficial project, not affiliated with Hypergryph",
            )}
          </small>
        </footer>
      </div>
    </main>
  );
}
