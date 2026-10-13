import { useEffect, useMemo, useRef } from "react";
import { ArrowUpRight, ArrowDown, ArrowRight, Pause, Play } from "lucide-react";
import Brand from "./Brand";
import FlowField from "./FlowField";
import Graph from "./Graph";
import { nodes, edges } from "./data";
import { archives } from "./archives";
import { type Settings } from "./settings";
export default function Landing({
  settings,
  onAnimate,
}: {
  settings: Settings;
  onAnimate: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const artSettings = useMemo(
    () => ({
      ...settings,
      mode: "network" as const,
      layout: "organic" as const,
      labels: true,
      locked: false,
      opacity: 0.42,
    }),
    [settings],
  );
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        root.current?.style.setProperty(
          "--journey",
          String(Math.min(1, scrollY / (innerHeight * 0.85))),
        );
      });
    };
    update();
    addEventListener("scroll", update, { passive: true });
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("revealed");
        }),
      { threshold: 0.12 },
    );
    root.current?.querySelectorAll(".reveal").forEach((e) => io.observe(e));
    return () => {
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
        <FlowField settings={settings} />
        <div className="landing-shade" />
      </div>
      <div className="landing-sticky">
        <div className="landing-brand">
          <Brand />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">
            <i /> ARKNIGHTS · SOCIAL NETWORK ANALYSIS
          </span>
          <h1>
            Every connection
            <br />
            leaves a <em>trace.</em>
          </h1>
          <div className="hero-divider" />
          <p className="hero-chinese">
            于万千轨迹中，
            <br />
            看见彼此的引力。
          </p>
          <p className="hero-description">
            从一段故事出发，走进关系的宇宙。
            <br />
            关于角色、社群，以及将彼此连接的无形之线。
          </p>
          <a href="#archives" className="primary-cta">
            选择一段故事 <ArrowUpRight size={20} />
          </a>
          <a
            href="#about"
            onClick={(e) => {
              e.preventDefault();
              document
                .getElementById("about")
                ?.scrollIntoView({
                  behavior: settings.animate ? "smooth" : "auto",
                });
            }}
            className="secondary-cta"
          >
            关于这个项目 <ArrowDown size={13} />
          </a>
        </div>
        <div className="landing-rail">
          <span>AN ATLAS OF INVISIBLE THREADS</span>
          <button
            onClick={onAnimate}
            aria-label={settings.animate ? "暂停背景动效" : "播放背景动效"}
          >
            {settings.animate ? <Pause size={12} /> : <Play size={12} />}
          </button>
        </div>
      </div>
      <div className="landing-scenes">
        <section className="scene-hero" aria-label="泰拉关系星图预览">
          <div className="scene-number">
            <span>FIELD NOTES / 001</span>
            <i /> TERRA
          </div>
          <div className="hero-constellation">
            <Graph
              nodes={nodes}
              edges={edges}
              settings={artSettings}
              selected={null}
              onSelect={() => {
                location.hash = "archives";
              }}
              onEdge={() => {}}
              onAnimate={onAnimate}
              landing
              resetKey={0}
            />
          </div>
          <div className="scene-caption">
            <span>Constellation, No. 001</span>
            <small>
              {nodes.length} NODES · {edges.length} THREADS · ENDLESS STORIES
            </small>
          </div>
          <div className="scroll-cue">
            <span>SCROLL TO DISCOVER</span>
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
            <span className="eyebrow">01 / A SHORT INTRODUCTION</span>
            <h2 id="about-heading">
              Stories are made
              <br />
              of <em>connections.</em>
            </h2>
            <p className="intro-lead">
              不只是谁与谁相遇，
              <br />
              更是每一次相遇，如何改变故事。
            </p>
            <p className="intro-prose">
              Terra Relation Atlas
              将《明日方舟》的叙事转化为可以漫游的关系网络。以角色为节点，以互动为轨迹，让故事中不易察觉的联系，拥有可见的形状。
            </p>
          </div>
          <div className="intro-chapters">
            <article className="reveal">
              <span>01</span>
              <div>
                <h3>一段剧情，一片星空。</h3>
                <p>
                  从活动或主线章节进入独立图谱，也可以在总览中，寻找跨越故事的联系。
                </p>
              </div>
            </article>
            <article className="reveal">
              <span>02</span>
              <div>
                <h3>顺着关系，读懂角色。</h3>
                <p>
                  选中一个节点，观察它的邻域、互动方向与关系强度，发现社群之间的关键连接。
                </p>
              </div>
            </article>
            <article className="reveal">
              <span>03</span>
              <div>
                <h3>把观看的方式，交给你。</h3>
                <p>在同一侧栏里调整布局与视觉，让每次探索都保有自己的节奏。</p>
              </div>
            </article>
          </div>
          <div className="intro-signoff reveal">
            <span className="intro-star">✳</span>
            <p>
              {archives.length - 1} 段示例故事，一张全景总表。
              <small>目前使用演示图谱，不代表正式分析结果。</small>
            </p>
            <a href="#archives" aria-label="浏览活动档案">
              <ArrowUpRight size={23} />
            </a>
          </div>
          <div className="intro-footer">
            <span>INDEPENDENT SNA SHOWCASE</span>
            <a href="#archives">
              ENTER THE ARCHIVE <ArrowRight size={11} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
