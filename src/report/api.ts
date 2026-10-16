import type { Draft, Report } from "./report";
/**
 * The report service. Empty until the Worker on atlas-api.gariton.work is
 * live: the panel then shows the whole form but sends nothing.
 */
export const feedbackUrl = "";
export const feedbackOpen = feedbackUrl !== "";
export async function sendReport(report: Report) {
  // text/plain keeps this a simple request, so the browser sends no preflight.
  const response = await fetch(feedbackUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw Error(String(response.status));
}
export const dailyLimit = 20;
const sentKey = "atlas-report-sent";
const today = () => new Date().toISOString().slice(0, 10);
export function sentToday() {
  try {
    const saved = JSON.parse(localStorage.getItem(sentKey) || "null");
    return saved?.day === today() ? (saved.n as number) : 0;
  } catch {
    return 0;
  }
}
export function countSent() {
  try {
    localStorage.setItem(
      sentKey,
      JSON.stringify({ day: today(), n: sentToday() + 1 }),
    );
  } catch {}
}
/**
 * Light checks only; the store has its own rate limit. "bot" means a script
 * filled the hidden field: the panel then acts as if it sent the report.
 */
export function spamCheck(d: Draft, openedAt: number, now = Date.now()) {
  if (d.website) return "bot";
  if (now - openedAt < 3000) return "请稍等几秒再提交";
  if (sentToday() >= dailyLimit)
    return `今天已经提交了 ${dailyLimit} 份，请明天再来`;
  return null;
}
