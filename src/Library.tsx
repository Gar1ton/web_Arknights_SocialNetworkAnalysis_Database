import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowLeft, Search, X, Orbit } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import {
  archiveCode,
  archiveDescription,
  archiveTitle,
  avatarUrl,
  archiveCategory,
  filterName,
  filters,
  dataVersion,
  englishName,
  searchArchives,
  useManifest,
  useMedia,
  type Archive,
  type ArchiveMedia,
  type Filter,
} from "./archives";
const PAGE = 24;
import { type Settings, showcaseFlow } from "./settings";
import { plural, t } from "./i18n";
import LangSwitch from "./LangSwitch";
import { useLang } from "./useLang";
function Portrait({ id, name }: { id?: string | null; name: string }) {
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
function Cover({
  archive,
  index,
  media,
}: {
  archive: Archive;
  index: number;
  media?: ArchiveMedia;
}) {
  if (media?.banner)
    return (
      <div className="archive-cover has-banner" aria-hidden="true">
        <img src={media.banner} alt="" loading="lazy" decoding="async" />
      </div>
    );
  // Without a banner: the record's operator, or the story's leading cast.
  const faces = media?.lead
    ? [media.lead]
    : (media?.cast.filter(Boolean) as string[] | undefined) || [];
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
        {String(archive.order).padStart(2, "0")}
      </span>
    </div>
  );
}
export default function Library({ settings }: { settings: Settings }) {
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
  const manifest = useManifest();
  const media = useMedia();
  const archives = manifest.data?.archives || [];
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState<Filter>("全部"),
    [shown, setShown] = useState(PAGE);
  const matches = useMemo(
    () => searchArchives(archives, query, category),
    [archives, query, category],
  );
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
                "每段剧情一张关系图，按剧情顺序排列。",
                "One relation graph per story, in story order.",
              )}
            </p>
          </div>
          <div className="library-edition">
            <span>{t("收录", "Covers")}</span>
            <strong>{archives.length || "—"}</strong>
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
              {manifest.data
                ? dataVersion(manifest.data)
                : t("载入中", "loading")}
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
          <span>{t("按剧情顺序排列", "In story order")}</span>
        </div>
        <div className="archive-grid">
          {matches.slice(0, shown).map((archive, index) => {
            const pictures = media?.archives[archive.id];
            const cast = pictures?.cast.some(Boolean) ? pictures.cast : null;
            return (
              <a
                key={archive.id}
                href={"#graph/" + archive.id}
                className="archive-card"
                style={
                  {
                    "--archive-color": archive.color,
                    "--card-order": index % PAGE,
                  } as React.CSSProperties
                }
                aria-label={t(
                  "查看" + archive.title + "关系图",
                  "Open the relation graph of " + archiveTitle(archive),
                )}
              >
                <Cover
                  archive={archive}
                  index={archive.order % 7}
                  media={pictures}
                />
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
                    <span className="archive-category">
                      {archiveCategory(archive)}
                    </span>
                  </div>
                  <div className="archive-card-title">
                    <h2>{archiveTitle(archive)}</h2>
                    <p>
                      {cast && (
                        <span className="cast-faces">
                          {archive.top.map((name, i) => (
                            <Portrait key={i} id={cast[i]} name={name} />
                          ))}
                        </span>
                      )}
                      <span>
                        {t("关系最多：", "Most connected: ")}
                        {archive.top.map(englishName).join(t("、", ", "))}
                      </span>
                    </p>
                  </div>
                  <p className="archive-description">
                    {archiveDescription(archive)}
                  </p>
                  <div className="archive-card-bottom">
                    <span>
                      {archive.nodes} <small>{t("名角色", "characters")}</small>
                      <i /> {archive.pairs}{" "}
                      <small>{t("组关系", "relations")}</small>
                    </span>
                    <span className="card-open">
                      <ArrowUpRight size={19} />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
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
        {manifest.error && (
          <div className="archive-empty">
            <Orbit size={32} />
            <h2>{t("目录载入失败", "Could not load the stories")}</h2>
            <p>{t("请刷新页面重试。", "Refresh the page to try again.")}</p>
          </div>
        )}
        {manifest.data && !matches.length && (
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
