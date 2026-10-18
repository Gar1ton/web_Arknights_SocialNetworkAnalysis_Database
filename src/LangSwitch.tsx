import { type Lang, setLang } from "./i18n";
import { useLang } from "./useLang";
const options: [Lang, string, string][] = [
  ["zh", "中", "中文"],
  ["en", "EN", "English"],
];
export default function LangSwitch() {
  const current = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="语言 / Language">
      {options.map(([key, short, full]) => (
        <button
          key={key}
          type="button"
          lang={key === "zh" ? "zh-CN" : "en"}
          aria-label={full}
          aria-pressed={current === key}
          onClick={() => setLang(key)}
        >
          {short}
        </button>
      ))}
    </div>
  );
}
