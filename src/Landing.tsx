import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowDown, ArrowRight, Pause, Play } from "lucide-react";
import Brand from "./Brand";
import Graph from "./Graph";
import { archiveCode, archiveTitle, useArchive, useManifest } from "./archives";
import { lang, locale, t } from "./i18n";
import LangSwitch from "./LangSwitch";
import { type Settings, showcaseFlow } from "./settings";
import { createScreenScroller, scrollsInside } from "./screenScroll";
/** Screen 2: each card is a title and its terms. */
type Concepts = [string, [string, string][]][];
const conceptsZh: Concepts = [
  [
    "怎么读一条关系",
    [
      [
        "关系方向",
        "每组关系分两个方向看，如阿米娅 → 凯尔希、凯尔希 → 阿米娅。两边的态度未必一样，有时也只有一个方向有记录。",
      ],
      [
        "八类态度",
        "按友善度（敌对—友善）和支配度（顺从—主导）在环形图上分成八类：友好、热情主动、主导、傲慢算计、冷淡、疏离回避、顺从、友善配合。",
      ],
      [
        "关系强度",
        "0–1，看两人同场的事件有多少，本页最高为 1。只说明同框有多频繁，和关系好坏无关。",
      ],
      [
        "情感强度与可信度",
        "都是 0–100%：前者是态度有多强烈，后者是模型对这条判断有多大把握。「依据 N 个事件」指推断用到的事件数。",
      ],
    ],
  ],
  [
    "怎么读整张网",
    [
      [
        "关系数与发言数",
        "当前剧情里，这个角色和多少人有关系记录、说了多少句台词。",
      ],
      [
        "中介中心性",
        "0–1，看一个角色有多常处在别人之间的最短路径上。值高的人是连接不同圈子的「桥」，不一定认识的人最多。",
      ],
      [
        "社群",
        "按来往疏密自动分出的圈子，以圈内关系最多的人命名，如「凯尔希 等 15 人」。这是算法分组，不等于剧情阵营。",
      ],
      [
        "网络密度",
        "实际关系数占「人人两两相识」时关系数的比例。剧情出场人物多，密度通常很低（如 0.04），这很正常。",
      ],
    ],
  ],
  [
    "怎么读一个角色",
    [
      [
        "大五人格",
        "开放性、尽责性、外向性、宜人性、神经质五项，各 0–100，分高、中、低三档，根据角色在全部剧情中的表现评出。「神经质」高表示情绪更敏感、容易波动，不是贬义。",
      ],
      ["未评分", "台词太少的角色不评分；某一项空着表示「未评分」，不是 0 分。"],
      [
        "角色类型",
        "分具名角色、无名角色和博士三类。不同剧情里同名的无名角色（如「市民 A」）算作不同的人。",
      ],
    ],
  ],
];
const conceptsEn: Concepts = [
  [
    "Reading one relation",
    [
      [
        "Direction",
        "Every pair is read both ways, e.g. Amiya → Kal'tsit and Kal'tsit → Amiya. The two attitudes can differ, and sometimes only one direction is on record.",
      ],
      [
        "Eight attitudes",
        "Affiliation (hostile to friendly) and dominance (submissive to dominant) place each attitude on a circle split into the eight octants of Wiggins's Interpersonal Adjective Scales: warm-agreeable, gregarious-extraverted, assured-dominant, arrogant-calculating, cold-quarrelsome, aloof-introverted, unassured-submissive and unassuming-ingenuous.",
      ],
      [
        "Tie strength",
        "0–1, from how many events the two share; the strongest pair on the page is 1. It says how often they appear together, not whether they get along.",
      ],
      [
        "Affect intensity and confidence",
        "Both 0–100%: the first is how strong the attitude is, the second how sure the model is of it. \u201cBased on N events\u201d counts the events behind the call.",
      ],
    ],
  ],
  [
    "Reading the whole network",
    [
      [
        "Relations and lines",
        "How many people a character has a recorded relation with in this story, and how many lines they speak.",
      ],
      [
        "Betweenness centrality",
        "0–1: how often a character sits on the shortest path between two others. High values mark the bridges between circles, not necessarily the people who know the most others.",
      ],
      [
        "Communities",
        "Circles found automatically from who talks to whom, named after the best-connected member, e.g. \u201cKal'tsit +14\u201d. They are an algorithm's grouping, not the factions of the story.",
      ],
      [
        "Density",
        "The share of all possible pairs that actually have a relation. Stories have large casts, so density is usually low (around 0.04), and that is normal.",
      ],
    ],
  ],
  [
    "Reading one character",
    [
      [
        "Big Five",
        "Openness, conscientiousness, extraversion, agreeableness and neuroticism, each 0–100 and graded high, mid or low, from how the character acts across every story. High neuroticism means more emotionally sensitive; it is not an insult.",
      ],
      [
        "Not scored",
        "Characters with too few lines are not scored; an empty trait means \u201cnot scored\u201d, not zero.",
      ],
      [
        "Character type",
        "Named characters, unnamed characters and the Doctor. Unnamed characters with the same label in different stories (\u201cCitizen A\u201d) count as different people.",
      ],
    ],
  ],
];
/** Screen 3: what the project is, its limits and how to help. */
const projectZh: [string, string][] = [
  [
    "从台词到图谱",
    "剧情脚本取自社区整理的游戏数据，没有标明说话人的台词先由 AI 识别、再经人工复核。台词整理成对话后，大语言模型从每个剧情事件里提取关系证据，再由我们的关系推断算法和判断器筛选证据、随剧情逐步更新每个方向的态度；人物画像则综合全部剧情写成。这套算法属于学术研究的一部分，目前处于科研闭源期。",
  ],
  [
    "独立解读与局限",
    "这是独立的学术项目，与鹰角网络（Hypergryph）和 Yostar 无关。站内的评分与描述都是模型对虚构作品的自动解读，未经逐条人工核验，可能有错误、遗漏或偏见，请勿当作官方设定。",
  ],
  [
    "众包纠错与迭代",
    "发现重名没合并、关系方向反了，或者性格评得离谱？点详情里的「数据有问题？」或画布右下角的「提交纠错」告诉我们。每份报告都会先经人工核对，再用来改进下一版数据，不会自动生效。报告不记录 IP 或邮箱；愿意留名的话，我们会把你列入致谢名单。",
  ],
];
const projectEn: [string, string][] = [
  [
    "From script to graph",
    "Story scripts come from community-maintained game data; lines without a marked speaker are first attributed by AI, then checked by hand. Once the lines are assembled into conversations, a large language model pulls relation evidence out of each story event, and our relation inference algorithm and a judge model filter that evidence and update each direction's attitude as the story goes on. Character profiles are written from every story together. The algorithm is part of ongoing academic research and is not open source yet.",
  ],
  [
    "An independent reading, with limits",
    "This is an independent academic project with no ties to Hypergryph or Yostar. Every score and description here is a model's automatic reading of a work of fiction. They have not been checked one by one, may contain errors, gaps or bias, and are not official lore.",
  ],
  [
    "Crowd-sourced corrections",
    "Two names that should be one person, a relation pointing the wrong way, a personality that is way off? Tell us with \u201cSomething wrong?\u201d in any detail panel or \u201cReport it\u201d at the bottom right of the graph. Every report is checked by hand before it shapes the next data release; nothing changes automatically. Reports store no IP or email, and if you leave a username we will add you to the credits.",
  ],
];
export default function Landing({
  settings,
  onAnimate,
}: {
  settings: Settings;
  onAnimate: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const en = lang() === "en";
  const concepts = en ? conceptsEn : conceptsZh;
  const project = en ? projectEn : projectZh;
  const fmt = (n?: number) => (n == null ? "—" : n.toLocaleString(locale()));
  const animate = useRef(settings.animate);
  animate.current = settings.animate;
  /** Moves to a screen (0 hero, 1 concepts, 2 about); set by the effect below. */
  const goTo = useRef<(screen: number) => void>(() => {});
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
    const screens = () => [
      ...(root.current?.querySelectorAll(".scene-introduction") ?? []),
    ];
    const stops = () => [
      0,
      ...screens().map((el) =>
        Math.round(el.getBoundingClientRect().top + scrollY),
      ),
    ];
    const introTop = () => stops()[1] ?? 0;
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
    // Desktop: the page follows the wheel one screen at a time (hero,
    // concepts, about); touch layouts (≤912px) keep CSS scroll snap.
    const desktop = matchMedia("(min-width: 913px)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const scroller = createScreenScroller(
      stops,
      () => !animate.current || reduced.matches,
    );
    goTo.current = (screen) => {
      if (desktop.matches) scroller.go(screen);
      else if (screen)
        screens()[screen - 1]?.scrollIntoView({ behavior: "smooth" });
      else scrollTo({ top: 0, behavior: "smooth" });
    };
    const wheel = (e: WheelEvent) => {
      if (!desktop.matches || e.ctrlKey || !e.deltaY) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (scroller.wheel(dy, scrollsInside(e.target, dy))) e.preventDefault();
    };
    // Screen offsets: ±1 moves to the next or previous screen; ±Infinity
    // goes to the last or first.
    const keys: Record<string, number> = {
      ArrowDown: 1,
      PageDown: 1,
      End: Infinity,
      ArrowUp: -1,
      PageUp: -1,
      Home: -Infinity,
    };
    const key = (e: KeyboardEvent) => {
      const step = keys[e.key];
      if (step === undefined || !desktop.matches) return;
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (scrollsInside(e.target, step)) return;
      e.preventDefault();
      const last = stops().length - 1;
      scroller.go(
        Math.abs(step) === Infinity
          ? step > 0
            ? last
            : 0
          : scroller.current() + step,
      );
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
          <LangSwitch />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">
            <i />{" "}
            {t(
              "明日方舟 · 剧情人物关系分析",
              "Arknights · story character network analysis",
            )}
          </span>
          {en ? (
            <h1>
              Arknights
              <br />
              <em>SNA</em>
            </h1>
          ) : (
            <h1>
              角色之间的
              <br />
              <em>关系图谱</em>
            </h1>
          )}
          <div className="hero-divider" />
          <p className="hero-chinese">
            {t(
              `${fmt(manifest?.archives.length)} 段剧情`,
              `${fmt(manifest?.archives.length)} stories`,
            )}
            <br />
            {t(
              `${fmt(shownRelations)} 条人物关系`,
              `${fmt(shownRelations)} character relations`,
            )}
          </p>
          <p className="hero-description">
            {t(
              "按主线、活动和干员密录整理，",
              "Sorted by Main Theme, events and Operator Records:",
            )}
            <br />
            {t(
              "看谁和谁有交集、彼此态度如何，以及每个角色的性格画像。",
              "see who crosses paths, how they regard each other, and each character's personality.",
            )}
          </p>
          <a href="#archives" className="primary-cta">
            <span>{t("选择一段剧情", "Choose a story")}</span>
            <i aria-hidden="true">
              <svg viewBox="0 0 44 12">
                <path d="M1 6h41M36.5 1 42 6l-5.5 5" />
              </svg>
            </i>
          </a>
          <a
            href="#concepts"
            onClick={(e) => {
              e.preventDefault();
              goTo.current(1);
            }}
            className="secondary-cta"
          >
            {t("读图指南与项目介绍", "Reading guide and about")}{" "}
            <ArrowDown size={13} />
          </a>
        </div>
        <div className="landing-rail">
          <span>{t("明日方舟剧情人物关系", "Arknights story relations")}</span>
          <button
            onClick={onAnimate}
            aria-label={
              settings.animate
                ? t("暂停背景动效", "Pause background motion")
                : t("播放背景动效", "Play background motion")
            }
          >
            {settings.animate ? <Pause size={12} /> : <Play size={12} />}
          </button>
        </div>
      </div>
      <div className="landing-scenes">
        <section
          className="scene-hero"
          aria-label={t("剧情关系预览", "Story relation preview")}
        >
          <div className="scene-number">
            <span>{featured && archiveCode(featured)}</span>
            <i /> {t("预览", "Preview")}
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
              {featured && archiveTitle(featured)} ·{" "}
              {t(
                `关系最多的 ${preview.nodes.length} 名角色`,
                `the ${preview.nodes.length} best-connected characters`,
              )}
            </span>
            <small>
              {t(
                `${preview.nodes.length} 名角色 · ${preview.edges.length} 组关系 · 点击进入剧情目录`,
                `${preview.nodes.length} characters · ${preview.edges.length} relations · click to browse stories`,
              )}
            </small>
          </div>
          <div className="scroll-cue">
            <span>{t("向下了解更多", "Scroll for more")}</span>
            <i />
            <ArrowDown size={12} />
          </div>
        </section>
        <section
          id="concepts"
          className="scene-introduction scene-concepts"
          aria-labelledby="concepts-heading"
        >
          <div className="reveal">
            <span className="eyebrow">{t("读图指南", "Reading guide")}</span>
            <h2 id="concepts-heading">
              {t("图上的数字", "What the numbers")}
              <br />
              <em>{t("怎么读", "mean")}</em>
            </h2>
            <p className="intro-lead">
              {t(
                "不用懂社会网络分析或心理学。把剧情当作一场漫长的群聊，这些指标只回答三件事：谁和谁熟、谁对谁什么态度、谁是怎样的性格。",
                "No network science or psychology needed. Think of the story as one long group chat; the numbers answer three questions: who knows whom, who feels what about whom, and what each person is like.",
              )}
            </p>
          </div>
          <div className="intro-chapters">
            {concepts.map(([title, terms], i) => (
              <article key={title} className="reveal">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <dl className="concept-terms">
                    {terms.map(([term, text]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd>{text}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
          <p className="intro-note reveal">
            {t(
              "注：站内所有数值和画像都是大模型对台词的解读，不是官方设定。",
              "Note: every number and profile here is a language model's reading of the script, not official lore.",
            )}
          </p>
        </section>
        <section
          id="about"
          className="scene-introduction scene-about"
          aria-labelledby="about-heading"
        >
          <div className="reveal">
            <span className="eyebrow">{t("关于本项目", "About")}</span>
            <h2 id="about-heading">
              {t("这张图谱是", "How this atlas")}
              <br />
              <em>{t("怎么来的", "was made")}</em>
            </h2>
            <p className="intro-lead">
              {t(
                "收录主线第 0–17 章、活动、干员密录和集成战略，剧情更新到 2026 年 10 月的活动「昨日海」，另有跨剧情的总览图。数据是 v2 候选版本，仍在迭代。",
                "Covers Main Theme Episodes 00–17, events, Operator Records and Integrated Strategies, up to the October 2026 event \u201c昨日海\u201d on the Chinese server, plus cross-story overviews. The data is a v2 candidate and still changing. Story titles follow the English server; stories it has not released yet keep their Chinese titles, and the personality notes are in Chinese only for now.",
              )}
            </p>
          </div>
          <div className="intro-chapters">
            {project.map(([title, text], i) => (
              <article key={title} className="reveal">
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
          <dl className="intro-team reveal">
            <div>
              <dt>{t("制作与开源", "Made by")}</dt>
              <dd>
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
                <span>
                  {t(
                    "网站源码（含网络指标计算）在",
                    "The site's source, network metrics included, is public on ",
                  )}
                  <a
                    href="https://github.com/Gar1ton/web_Arknights_SocialNetworkAnalysis_Database"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                  {t(
                    "公开，关系推断算法仍在科研闭源期内",
                    "; the relation inference algorithm stays closed during the research.",
                  )}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("联系邮箱", "Contact")}</dt>
              <dd>
                <a href="mailto:zefeng.1.wu@kcl.ac.uk">zefeng.1.wu@kcl.ac.uk</a>
                <span>
                  {t(
                    "数据反馈、合作、权利方下架请求都可以发到这里",
                    "Data feedback, collaboration and takedown requests from rights holders",
                  )}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("许可协议", "Licence")}</dt>
              <dd>
                <span>
                  {t(
                    "图谱数据、派生评分、描述与网站代码采用",
                    "The graph data, derived scores, descriptions and site code are licensed under ",
                  )}
                  <a
                    href={
                      "https://creativecommons.org/licenses/by-nc-sa/4.0/" +
                      t("deed.zh-hans", "")
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY-NC-SA 4.0
                  </a>
                  {t(
                    "许可，与 PRTS 维基一致。《明日方舟》的角色、名称、剧情、设定及美术素材（头像、横幅等）归鹰角网络及其许可方所有。",
                    ", the same as the PRTS wiki. Arknights characters, names, story, setting and artwork (avatars, banners) belong to Hypergryph and its licensors.",
                  )}
                </span>
              </dd>
            </div>
          </dl>
          <div className="intro-signoff reveal">
            <span className="intro-star">✳</span>
            <p>
              {t(
                "感谢社区整理的基础数据，以及每一位帮模型「捉虫」的博士。",
                "Thanks to the community for the game data, and to every Doctor who helps catch the model's mistakes.",
              )}
            </p>
            <a
              href="#archives"
              aria-label={t("浏览剧情目录", "Browse stories")}
            >
              <ArrowUpRight size={23} />
            </a>
          </div>
          <div className="intro-footer">
            <button onClick={() => goTo.current(0)}>
              ↑ {t("回到顶部", "Back to top")}
            </button>
            <a href="#archives">
              {t("进入剧情目录", "Browse stories")} <ArrowRight size={11} />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
