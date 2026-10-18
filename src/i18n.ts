export type Lang = "zh" | "en";
const storageKey = "terra:lang";
/* Plain module, no React: report.ts uses it and also runs in the feedback service. */
/** Saved choice first, then the browser language; Chinese outside a browser (tests, the feedback service). */
function initial(): Lang {
  if (typeof document === "undefined") return "zh";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "zh" || saved === "en") return saved;
  } catch {}
  return /^zh\b/i.test(navigator.language) ? "zh" : "en";
}
let current: Lang = initial();
const listeners = new Set<() => void>();
function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = current === "en" ? "en" : "zh-CN";
  document.title = t("方舟关系图谱", "Arknights Relation Atlas");
}
apply();
export const lang = () => current;
export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(storageKey, next);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** The text for the current language; both sit side by side at the call site. */
export function t(zh: string, en: string) {
  return current === "en" ? en : zh;
}
export const locale = () => (current === "en" ? "en-US" : "zh-CN");
/** Counts in English: plural("character", 3) → "3 characters". */
export function plural(word: string, n: number, many = word + "s") {
  return `${n.toLocaleString("en-US")} ${n === 1 ? word : many}`;
}
