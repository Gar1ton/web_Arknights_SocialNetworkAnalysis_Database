import { useState, useMemo } from "react";
import { ArrowUpRight, ArrowLeft, Search, X, Orbit } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import {
  archives,
  archiveGraph,
  searchArchives,
  type Archive,
} from "./archives";
import { type Settings } from "./settings";
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
        {index === 0 ? "∞" : String(index).padStart(2, "0")}
      </span>
    </div>
  );
}
export default function Library({ settings }: { settings: Settings }) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("全部");
  const matches = useMemo(
    () => searchArchives(query, category),
    [query, category],
  );
  const artSettings = useMemo(
    () => ({ ...settings, particles: 480 }),
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
            <ArrowLeft size={13} /> 返回序章
          </a>
        </div>
        <section className="library-intro">
          <div>
            <span className="eyebrow">
              <i /> THE NARRATIVE INDEX
            </span>
            <h1>
              Every story,
              <br />a <em>constellation.</em>
            </h1>
            <p>选择一段故事，沿着关系进入它的世界。</p>
          </div>
          <div className="library-edition">
            <span>THE ARCHIVE</span>
            <strong>00—06</strong>
            <p>
              一张全景总表
              <br />
              六段故事的关系切片
            </p>
            <small>DEMO COLLECTION / VOL. 01</small>
          </div>
        </section>
        <div className="archive-toolbar">
          <div className="archive-tabs" role="group" aria-label="档案分类">
            {["全部", "主线", "Side Story", "Intermezzi"].map((c) => (
              <button
                key={c}
                className={c === category ? "active" : ""}
                aria-pressed={c === category}
                onClick={() => setCategory(c)}
              >
                {c === "全部" ? "全部档案" : c}
              </button>
            ))}
          </div>
          <label className="archive-search">
            <Search size={16} />
            <input
              aria-label="搜索活动或章节"
              placeholder="搜索活动、章节或英文名…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query ? (
              <button onClick={() => setQuery("")} aria-label="清空档案搜索">
                <X size={14} />
              </button>
            ) : (
              <span>/</span>
            )}
          </label>
        </div>
        <div className="archive-result-count" role="status">
          <span>{matches.length.toString().padStart(2, "0")} ARCHIVES</span>
          <span>演示图谱 · 章节美术待补充</span>
        </div>
        <div className="archive-grid">
          {matches.map((archive) => {
            const index = archives.indexOf(archive),
              graph = archiveGraph(archive.id);
            return (
              <a
                key={archive.id}
                href={"#graph/" + archive.id}
                className={
                  "archive-card " + (index === 0 ? "archive-total" : "")
                }
                style={
                  {
                    "--archive-color": archive.color,
                    "--card-order": index,
                  } as React.CSSProperties
                }
                aria-label={"查看" + archive.title + "图谱"}
              >
                <Cover archive={archive} index={index} />
                <div className="archive-card-content">
                  <div className="archive-card-top">
                    <span>{archive.code}</span>
                    <span className="archive-category">{archive.category}</span>
                  </div>
                  <div className="archive-card-title">
                    <h2>{archive.title}</h2>
                    <p>{archive.en}</p>
                  </div>
                  <p className="archive-description">{archive.description}</p>
                  <div className="archive-card-bottom">
                    <span>
                      {graph.nodes.length} <small>NODES</small>
                      <i /> {graph.edges.length} <small>EDGES</small>
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
        {!matches.length && (
          <div className="archive-empty">
            <Orbit size={32} />
            <h2>还没有找到这段故事。</h2>
            <p>试试章节名称，或换一个关键词。</p>
            <button
              className="wide-button"
              onClick={() => {
                setQuery("");
                setCategory("全部");
              }}
            >
              查看全部档案
            </button>
          </div>
        )}
        <footer className="library-footer">
          <span>每一条线，都曾是一段故事。</span>
          <small>ILLUSTRATIVE DATA · INDEPENDENT ARKNIGHTS SNA SHOWCASE</small>
        </footer>
      </div>
    </main>
  );
}
