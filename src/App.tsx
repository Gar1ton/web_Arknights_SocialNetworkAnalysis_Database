import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { Check, Orbit } from "lucide-react";
import { palettes, readSettings, storageKey, type Settings } from "./settings";
import { t } from "./i18n";
import { useLang } from "./useLang";
import { resolveRoute, defaultArchive } from "./routes";
import { useCore } from "./model/load";
import { useCatalog } from "./model/catalog";
import Landing from "./Landing";
import Library from "./Library";
import People, { PersonPage } from "./People";
import Workbench, { type ReportRequest } from "./Workbench";
import ReportDialog from "./report/ReportDialog";
export default function App() {
  useLang();
  const [route, setRoute] = useState(() => resolveRoute(location.hash));
  const [settings, setSettings] = useState<Settings>(() => {
    const s = readSettings();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) s.animate = false;
    return s;
  });
  const [toast, setToast] = useState("");
  const [report, setReport] = useState<ReportRequest | null>(null);
  const core = useCore();
  const data = core.data;
  const catalog = useCatalog(data, settings.named);
  useEffect(() => {
    const cb = () => {
      const next = resolveRoute(location.hash);
      const change = () => {
        flushSync(() => {
          setRoute(next);
          setReport(null);
        });
        window.scrollTo({ top: 0, behavior: "instant" });
      };
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };
      if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
        doc.startViewTransition(change);
      else change();
    };
    addEventListener("hashchange", cb);
    return () => removeEventListener("hashchange", cb);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {}
    document.documentElement.style.setProperty("--bg", palettes[settings.palette].bg);
  }, [settings]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  const update = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((s) => ({ ...s, [key]: value })),
    [],
  );
  const animate = () => update("animate", !settings.animate);
  let page = null;
  if (core.error)
    page = (
      <main id="main-content" className="archive-library route-surface">
        <div className="archive-empty">
          <Orbit size={32} />
          <h2>{t("数据载入失败", "Could not load the data")}</h2>
          <p>{t("请刷新页面重试。", "Refresh the page to try again.")}</p>
        </div>
      </main>
    );
  else if (route.page === "home")
    page = <Landing settings={settings} onAnimate={animate} core={data} catalog={catalog} />;
  else if (!data || !catalog)
    page = (
      <main id="main-content" className="archive-library route-surface">
        <div className="archive-empty" role="status">
          <Orbit size={32} />
          <h2>{t("正在载入…", "Loading…")}</h2>
        </div>
      </main>
    );
  else if (route.page === "archives")
    page = <Library settings={settings} core={data} catalog={catalog} />;
  else if (route.page === "people")
    page = <People settings={settings} core={data} catalog={catalog} />;
  else if (route.page === "person")
    page = <PersonPage settings={settings} core={data} catalog={catalog} p={route.p} other={route.other} />;
  else {
    const i = Math.max(
      0,
      catalog.stories.findIndex((s) => s.id === route.archiveId),
    );
    const story = catalog.stories[i] ?? catalog.stories.find((s) => s.id === defaultArchive)!;
    page = (
      <Workbench
        key={story.id + "|" + (route.focus ?? "") + "|" + (route.pair?.join("-") ?? "")}
        core={data}
        story={story}
        prev={catalog.stories[i - 1]}
        next={catalog.stories[i + 1]}
        focus={route.focus}
        pair={route.pair}
        settings={settings}
        setSettings={setSettings}
        onReport={setReport}
        onToast={setToast}
      />
    );
  }
  return (
    <div
      className={
        "app " +
        (route.page === "graph" ? "workspace workbench" : route.page === "home" ? "home" : "library-page") +
        (settings.animate ? "" : " reduced-motion")
      }
    >
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        {t("跳转到主要内容", "Skip to main content")}
      </a>
      {page}
      {report && data && (
        <ReportDialog
          origin={report.origin}
          archive={report.story}
          dataVersion={data.manifest.info.version}
          data={report.data}
          byId={new Map(report.data.nodes.map((n) => [n.id, n]))}
          onClose={(kept) => {
            setReport(null);
            if (kept)
              setToast(t("草稿已保留，再次打开纠错面板即可继续", "Draft kept. Reopen the report panel to continue"));
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
