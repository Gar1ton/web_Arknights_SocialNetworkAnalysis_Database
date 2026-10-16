import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowDown, ArrowRight, Pause, Play } from "lucide-react";
import Brand from "./Brand";
import Graph from "./Graph";
import { useArchive, useManifest } from "./archives";
import { type Settings, showcaseFlow } from "./settings";
import { createScreenScroller, scrollsInside } from "./screenScroll";
const fmt = (n?: number) => (n == null ? "—" : n.toLocaleString("zh-CN"));
export default function Landing({
  settings,
  onAnimate,
}: {
  settings: Settings;
  onAnimate: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const animate = useRef(settings.animate);
  animate.current = settings.animate;
  /** Moves to screen 0 (hero) or 1 (introduction); set by the effect below. */
  const goTo = useRef<(screen: 0 | 1) => void>(() => {});
  const manifest = useManifest().data;
  // Preview the story with the most relations (merged tables are hidden).
  const featured = manifest?.archives.reduce<
    (typeof manifest.archives)[number] | null
  >((best, a) => (!best || a.pairs > best.pairs ? a : best), null);
  const overview = useArchive(featured?.id || null).data;
  const preview = useMemo(() => {
    if (!overview) return { nodes: [], edges: [] };
    const nodes = [...overview.nodes]
      .sort((a, b) => b.degree - a.degree || b.messages - a.messages)
      .slice(0, 48);
    const ids = new Set(nodes.map((n) => n.id));
    return {
      nodes,
      edges: overview.edges.filter(
        (e) => ids.has(e.source) && ids.has(e.target),
      ),
    };
  }, [overview]);
  // Counted from the stories shown, not the full build.
  const shownRelations = manifest?.archives.reduce(
    (s, a) => s + a.relations,
    0,
  );
  const [flowTarget, setFlowTarget] = useState<HTMLDivElement | null>(null);
  const artSettings = useMemo(
    () => ({
      ...settings,
      mode: "network" as const,
      layout: "organic" as const,
      labels: true,
      locked: false,
      opacity: 0.42,
      labelSize: 1,
      flowOpacity: showcaseFlow,
    }),
    [settings],
  );
  useEffect(() => {
    document.documentElement.classList.add("landing-snap");
    const about = () => document.getElementById("about");
    const introTop = () =>
      Math.round((about()?.getBoundingClientRect().top ?? 0) + scrollY);
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.current?.style.setProperty(
          "--journey",
          String(Math.min(1, scrollY / Math.max(1, introTop()))),
        );
      });
    };
    update();
    addEventListener("scroll", update, { passive: true });
    // Desktop: the page follows the wheel between two stops (hero and
    // introduction); touch layouts (≤760px) keep CSS scroll snap.
    const desktop = matchMedia("(min-width: 761px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const scroller = createScreenScroller(
      introTop,
      () => !animate.current || reduced.matches,
    );
    goTo.current = (screen) => {
      if (desktop.matches) scroller.go(screen);
      else if (screen) about()?.scrollIntoView({ behavior: "smooth" });
      else scrollTo({ top: 0, behavior: "smooth" });
    };
    const wheel = (e: WheelEvent) => {
      if (!desktop.matches || e.ctrlKey || !e.deltaY) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (scroller.wheel(dy, scrollsInside(e.target, dy))) e.preventDefault();
    };
    const keys: Record<string, 0 | 1> = {
      ArrowDown: 1,
      PageDown: 1,
      End: 1,
      ArrowUp: 0,
      PageUp: 0,
      Home: 0,
    };
    const key = (e: KeyboardEvent) => {
      const screen = keys[e.key];
      if (screen === undefined || !desktop.matches) return;
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (scrollsInside(e.target, screen ? 1 : -1)) return;
      e.preventDefault();
      scroller.go(screen);
    };
    const settle = () => {
      if (desktop.matches) scroller.release();
    };
    addEventListener("wheel", wheel, { passive: false });
    addEventListener("keydown", key);
    addEventListener("scrollend", settle);
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("revealed");
        }),
      { threshold: 0.12 },
    );
    root.current?.querySelectorAll(".reveal").forEach((e) => io.observe(e));
    return () => {
      document.documentElement.classList.remove("landing-snap");
      scroller.stop();
      removeEventListener("wheel", wheel);
      removeEventListener("keydown", key);
      removeEventListener("scrollend", settle);
      removeEventListener("scroll", update);
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="landing-experience route-surface"
      ref={root}
    >
      <div className="landing-atmosphere">
        <div className="landing-flow-host" ref={setFlowTarget} />
        <div className="landing-shade" />
      </div>
      <div className="landing-sticky">
        <div className="landing-brand">
          <Brand />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> 明日方舟 · 剧情人物关系分析
          </span>
          <h1>
            角色之间的
            <br />
            <em>关系图谱</em>
          </h1>
          <div className="hero-divider" />
          <p className="hero-chinese">
            {fmt(manifest?.archives.length)} 段剧情
            <br />
            {fmt(shownRelations)} 条人物关系
          </p>
          <p className="hero-description">
            按主线、活动和干员密录整理，
            <br />
            看谁和谁有交集、彼此态度如何，以及每个角色的性格画像。
          </p>
          <a href="#archives" className="primary-cta">
            <span>选择一段剧情</span>
            <i aria-hidden="true">
              <svg viewBox="0 0 44 12">
                <path d="M1 6h41M36.5 1 42 6l-5.5 5" />
              </svg>
            </i>
          </a>
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              goTo.current(1);
            }}
            className="secondary-cta"
          >
            关于这个项目 <ArrowDown size={13} />
          </a>
        </div>
        <div className="landing-rail">
          <span>明日方舟剧情人物关系</span>
          <button
            onClick={onAnimate}
            aria-label={settings.animate ? "暂停背景动效" : "播放背景动效"}
          >
            {settings.animate ? <Pause size={12} /> : <Play size={12} />}
          </button>
        </div>
      </div>
      <div className="landing-scenes">
        <section className="scene-hero" aria-label="剧情关系预览">
          <div className="scene-number">
            <span>{featured?.code}</span>
            <i /> 预览
          </div>
          <div className="hero-constellation">
            <Graph
              nodes={preview.nodes}
              edges={preview.edges}
              communities={overview?.communities || []}
              settings={artSettings}
              selected={null}
              onSelect={() => {
                location.hash = "archives";
              }}
              onEdge={() => {}}
              onAnimate={onAnimate}
              landing
              flowTarget={flowTarget}
              resetKey={0}
            />
          </div>
          <div className="scene-caption">
            <span>
              {featured?.title} · 关系最多的 {preview.nodes.length} 名角色
            </span>
            <small>
              {preview.nodes.length} 名角色 · {preview.edges.length} 组关系 ·
              点击进入剧情目录
            </small>
          </div>
          <div className="scroll-cue">
            <span>向下了解更多</span>
            <i />
            <ArrowDown size={12} />
          </div>
        </section>
        <section
          id="about"
          className="scene-introduction"
          aria-labelledby="about-heading"
        >
          <div className="reveal">
            <span className="eyebrow">关于这个项目</span>
            <h2 id="about-heading">
              这里能
              <br />
              <em>看到什么</em>
            </h2>
            <p className="intro-lead">
              把全部剧情台词整理成对话，
              <br />
              再由大模型推断人物之间的关系和性格。
            </p>
            <p className="intro-prose">
              目前收录主线第 0–17
              章、全部活动和干员密录，每段剧情一张关系图。图中既有具名角色，也有剧情里的无名角色。
            </p>
            <p className="intro-team">
              <span>
                制作
                <a
                  href="https://github.com/Gar1ton"
                  target="_blank"
                  rel="noreferrer"
                >
                  @Gar1ton
                </a>
                <a
                  href="https://github.com/MKiyoaki"
                  target="_blank"
                  rel="noreferrer"
                >
                  @MKiyoaki
                </a>
              </span>
              <span>
                联系
                <a href="mailto:zefeng.1.wu@kcl.ac.uk">zefeng.1.wu@kcl.ac.uk</a>
              </span>
            </p>
          </div>
          <div className="intro-chapters">
            <article className="reveal">
              <span>01</span>
              <div>
                <h3>人际态度（IPC）</h3>
                <p>
                  每组关系分两个方向：A 对 B、B 对
                  A。用「友善—敌对」和「主导—顺从」两个维度描述态度，并归为友好、主导、冷淡、顺从等八类。
                </p>
              </div>
            </article>
            <article className="reveal">
              <span>02</span>
              <div>
                <h3>关系网络（SNA）</h3>
                <p>
                  统计每个角色的关系数、发言数和中介中心性，并自动划分社群，方便找出核心人物和各自的圈子。
                </p>
              </div>
            </article>
            <article className="reveal">
              <span>03</span>
              <div>
                <h3>大五人格</h3>
                <p>
                  开放性、尽责性、外向性、宜人性、神经质五项，按 0–100
                  显示，并附上每项的评分依据。
                </p>
              </div>
            </article>
          </div>
          <div className="intro-signoff reveal">
            <span className="intro-star">✳</span>
            <p>
              {fmt(manifest?.archives.length)} 段剧情，每段一张关系图。
              <small>
                所有数值都是大模型对台词的解读，可能有误，不是官方设定。非官方项目，与鹰角网络无关联。
              </small>
            </p>
            <a href="#archives" aria-label="浏览剧情目录">
              <ArrowUpRight size={23} />
            </a>
          </div>
          <div className="intro-footer">
            <button onClick={() => goTo.current(0)}>↑ 回到顶部</button>
            <a href="#archives">
              进入剧情目录 <ArrowRight size={11} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
