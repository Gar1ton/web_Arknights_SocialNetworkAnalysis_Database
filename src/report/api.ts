import type { Draft, Report } from "./report";
import { t } from "../i18n";
/**
 * The report service: a Pages Function on Cloudflare's default domain
 * (feedback/). It only accepts reports; nothing on the web can read them back.
 */
export const feedbackUrl: string = "https://atlas-feedback.pages.dev/reports";
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
  if (now - openedAt < 3000)
    return t("请稍等几秒再提交", "Wait a few seconds before sending");
  if (sentToday() >= dailyLimit)
    return t(
      `今天已经提交了 ${dailyLimit} 份，请明天再来`,
      `You have sent ${dailyLimit} reports today. Come back tomorrow`,
    );
  return null;
}
