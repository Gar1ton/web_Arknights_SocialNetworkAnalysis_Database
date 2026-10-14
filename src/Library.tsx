import { useState, useMemo, useEffect, useRef } from "react";
import { ArrowUpRight, ArrowLeft, Search, X, Orbit } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import {
  categories,
  searchArchives,
  useManifest,
  type Archive,
} from "./archives";
const PAGE = 24;
import { type Settings, showcaseFlow } from "./settings";
function Cover({ archive, index }: { archive: Archive; index: number }) {
  return (
    <div className={"archive-cover cover-" + index} aria-hidden="true">
      {archive.bannerUrl ? (
        <img src={archive.bannerUrl} alt="" />
      ) : (
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
  const archives = manifest.data?.archives || [];
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部"),
    [shown, setShown] = useState(PAGE);
  const matches = useMemo(
    () => searchArchives(archives, query, category),
    [archives, query, category],
  );
  useEffect(() => setShown(PAGE), [query, category]);
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
          <a href="#" className="quiet-link">
            <ArrowLeft size={13} /> 返回首页
          </a>
        </div>
        <section className="library-intro">
          <div>
            <span className="eyebrow">
              <i /> 剧情目录
            </span>
            <h1>
              选择一段
              <br />
              <em>剧情</em>
            </h1>
            <p>每段剧情一张关系图，按剧情顺序排列。</p>
          </div>
          <div className="library-edition">
            <span>收录</span>
            <strong>{archives.length || "—"}</strong>
            <p>
              段剧情
              <br />
              {categories
                .map(
                  (c) =>
                    `${c} ${archives.filter((a) => a.category === c).length}`,
                )
                .join(" · ")}
            </p>
            <small>数据版本：{manifest.data?.info.version || "载入中"}</small>
          </div>
        </section>
        <div className="archive-toolbar">
          <div className="archive-tabs" role="group" aria-label="剧情分类">
            {["全部", ...categories].map((c) => (
              <button
                key={c}
                className={c === category ? "active" : ""}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c === "全部" ? "全部" : c}
              </button>
            ))}
          </div>
          <label className="archive-search">
            <Search size={16} />
            <input
              ref={searchInput}
              aria-label="搜索剧情"
              placeholder="搜索剧情名、章节或角色名…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="清空搜索">
                <X size={14} />
              </button>
            ) : (
              <span>/</span>
            )}
          </label>
        </div>
        <div className="archive-result-count" role="status">
          <span>共 {matches.length} 项</span>
          <span>按剧情顺序排列</span>
        </div>
        <div className="archive-grid">
          {matches.slice(0, shown).map((archive, index) => {
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
                aria-label={"查看" + archive.title + "关系图"}
              >
                <Cover archive={archive} index={archive.order % 7} />
                <div className="archive-card-content">
                  <div className="archive-card-top">
                    <span>{archive.code}</span>
                    <span className="archive-category">{archive.category}</span>
                  </div>
                  <div className="archive-card-title">
                    <h2>{archive.title}</h2>
                    <p>关系最多：{archive.top.join("、")}</p>
                  </div>
                  <p className="archive-description">{archive.description}</p>
                  <div className="archive-card-bottom">
                    <span>
                      {archive.nodes} <small>名角色</small>
                      <i /> {archive.pairs} <small>组关系</small>
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
            再显示 {Math.min(PAGE * 2, matches.length - shown)} 项（还有{" "}
            {matches.length - shown} 项）
          </button>
        )}
        {manifest.error && (
          <div className="archive-empty">
            <Orbit size={32} />
            <h2>目录载入失败</h2>
            <p>请刷新页面重试。</p>
          </div>
        )}
        {manifest.data && !matches.length && (
          <div className="archive-empty">
            <Orbit size={32} />
            <h2>没有找到这段剧情</h2>
            <p>试试剧情名、章节号或角色名。</p>
            <button
              className="wide-button"
              onClick={() => {
                setQuery("");
                setCategory("全部");
              }}
            >
              查看全部
            </button>
          </div>
        )}
        <footer className="library-footer">
          <span>数值由大模型根据剧情台词推断，仅供参考。</span>
          <small>非官方项目，与鹰角网络无关联</small>
        </footer>
      </div>
    </main>
  );
}
