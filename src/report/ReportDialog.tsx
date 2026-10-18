import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Flag, X } from "lucide-react";
import type { ArchiveData, AtlasNode } from "../data";
import type { Archive } from "../archives";
import TypeFields from "./fields";
import {
  agreedBefore,
  buildReport,
  clearDraft,
  hasContent,
  length,
  limits,
  loadDraft,
  newDraft,
  problems,
  rememberName,
  reportTypes,
  saveDraft,
  savedName,
  type Draft,
  type ReportTarget,
} from "./report";
import { countSent, feedbackOpen, sendReport, spamCheck } from "./api";
import { archiveCode, archiveTitle } from "../archives";
import { t } from "../i18n";
export function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="report-link" onClick={onClick}>
      <Flag size={13} />
      {t("数据有问题？", "Something wrong?")}
    </button>
  );
}
type Phase = "editing" | "sending" | "sent" | "failed";
export default function ReportDialog({
  origin,
  archive,
  dataVersion,
  data,
  byId,
  onClose,
}: {
  origin: ReportTarget;
  archive: Archive;
  dataVersion: string;
  data: ArchiveData;
  byId: Map<string, AtlasNode>;
  /** keptDraft: the visitor typed something that the next open restores. */
  onClose: (keptDraft: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const openedAt = useRef(Date.now());
  const [draft, setDraft] = useState<Draft>(
    () =>
      loadDraft(archive.id, origin) ?? {
        ...newDraft(origin, data.edges),
        contributor: savedName(),
        agreed: agreedBefore(),
      },
  );
  const [phase, setPhase] = useState<Phase>("editing"),
    [error, setError] = useState(""),
    [tried, setTried] = useState(false);
  useEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal();
    return () => d.close();
  }, []);
  useEffect(() => {
    if (phase !== "sent") saveDraft(archive.id, draft);
  }, [draft]);
  const issues = problems(draft);
  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    if (phase === "failed") setPhase("editing");
  };
  const close = () => {
    const kept = phase !== "sent" && hasContent(draft);
    if (!kept) clearDraft();
    onClose(kept);
  };
  const finish = () => {
    clearDraft();
    setPhase("sent");
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!feedbackOpen || issues.length || phase === "sending") return;
    const spam = spamCheck(draft, openedAt.current);
    if (spam === "bot") return finish();
    if (spam) {
      setError(spam);
      setPhase("failed");
      return;
    }
    setPhase("sending");
    try {
      await sendReport(
        buildReport(draft, {
          archive: archive.id,
          dataVersion,
          byId,
          edges: data.edges,
        }),
      );
      countSent();
      rememberName(draft.contributor.trim());
      finish();
    } catch {
      setError(
        t(
          "暂时连不上纠错服务，或提交太频繁。你填写的内容都还在。",
          "Could not reach the report service, or too many reports were sent. Everything you wrote is still here.",
        ),
      );
      setPhase("failed");
    }
  };
  const another = () => {
    openedAt.current = Date.now();
    setDraft({
      ...newDraft(origin, data.edges),
      contributor: draft.contributor,
      credit: draft.credit,
      agreed: true,
    });
    setTried(false);
    setPhase("editing");
  };
  const name = draft.contributor.trim();
  const status =
    phase === "failed"
      ? error
      : issues.length
        ? tried
          ? issues[0]
          : t(`还差 ${issues.length} 项`, `${issues.length} left to fill in`)
        : feedbackOpen
          ? t("可以提交了", "Ready to send")
          : t("已填写完整，开放后即可提交", "Complete; sending opens soon");
  return (
    <dialog
      ref={dialog}
      className="report-dialog"
      aria-labelledby="report-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <form className="report-form" onSubmit={submit} noValidate>
        <header className="report-head">
          <div>
            <span className="eyebrow">{t("纠错", "Report")}</span>
            <h2 id="report-title">
              {t("报告数据问题", "Report a data problem")}
            </h2>
            <p>
              {archiveCode(archive)} · {archiveTitle(archive)}
            </p>
          </div>
          <button
            type="button"
            className="report-close"
            aria-label={t("关闭", "Close")}
            onClick={close}
          >
            <X size={18} />
          </button>
        </header>
        {phase === "sent" ? (
          <div className="report-done" role="status">
            <Check size={26} />
            <h3>{t("已收到，谢谢你", "Received. Thank you")}</h3>
            <p>
              {t(
                "只有维护者能看到这份报告。它会在下一版数据清洗时被逐条核对。",
                "Only the maintainers can see this report. It will be checked by hand in the next data clean-up.",
              )}
            </p>
          </div>
        ) : (
          <div className="report-body">
            {!feedbackOpen && (
              <p className="report-closed">
                {t(
                  "纠错提交即将开放。现在可以先看看需要填写哪些内容，但暂时还不能发送。",
                  "Reports open soon. You can see what to fill in, but nothing can be sent yet.",
                )}
              </p>
            )}
            <fieldset className="report-section">
              <legend className="report-label">
                {t("问题类型", "Problem type")}
              </legend>
              <div className="report-chips">
                {reportTypes.map(([key, zh, en]) => (
                  <label key={key} className="report-chip">
                    <input
                      type="radio"
                      name="report-type"
                      checked={draft.type === key}
                      onChange={() => update({ type: key })}
                    />
                    {t(zh, en)}
                  </label>
                ))}
              </div>
            </fieldset>
            <TypeFields draft={draft} update={update} data={data} byId={byId} />
            <label className="report-section">
              <span className="report-label">
                {draft.type === "other"
                  ? t("发现了什么问题？", "What did you find?")
                  : t("为什么不合理？", "Why is it wrong?")}
                <i aria-hidden="true"> *</i>
              </span>
              <textarea
                className="report-input report-reason"
                rows={4}
                required
                value={draft.reason}
                placeholder={
                  draft.type === "other"
                    ? t(
                        "请描述你看到的问题，以及在哪里看到的",
                        "Describe the problem and where you saw it",
                      )
                    : t(
                        "例如：8-12 里阿米娅一直主动回应凯尔希，语气是信任，不是被压着服从",
                        "E.g. in 8-12 Amiya keeps answering Kal'tsit of her own accord; the tone is trust, not forced obedience",
                      )
                }
                onChange={(e) => update({ reason: e.target.value })}
              />
              <span className="report-count">
                {length(draft.reason)} / {limits.reasonMax}
              </span>
            </label>
            <div className="report-section">
              <label className="report-field">
                <span className="report-label">
                  {t("贡献者用户名（可选）", "Contributor username (optional)")}
                </span>
                <input
                  className="report-input"
                  value={draft.contributor}
                  autoComplete="nickname"
                  placeholder={t("匿名贡献者", "Anonymous contributor")}
                  onChange={(e) => update({ contributor: e.target.value })}
                />
              </label>
              <p className="report-hint">
                {t(
                  "留空则记为「匿名贡献者」。请不要填写真实姓名、邮箱或手机号。",
                  "Leave it empty to stay anonymous. Do not enter a real name, email or phone number.",
                )}
              </p>
              {name && (
                <label className="report-check">
                  <input
                    type="checkbox"
                    checked={draft.credit}
                    onChange={(e) => update({ credit: e.target.checked })}
                  />
                  {t(
                    `同意在致谢名单中显示「${name}」`,
                    `Show \u201c${name}\u201d in the credits`,
                  )}
                </label>
              )}
            </div>
            <section
              className="report-notice"
              aria-labelledby="report-notice-title"
            >
              <h3 id="report-notice-title">
                {t("提交前请知悉", "Before you send")}
              </h3>
              <ul>
                <li>
                  {t(
                    "保存：你填写的内容、贡献者用户名（如果填写）、剧情与对象编号、数据版本、提交时间。",
                    "Stored: what you write, your username (if any), the story and item ids, the data version and the time sent.",
                  )}
                </li>
                <li>
                  {t(
                    "不保存：IP 地址、邮箱、账号。",
                    "Not stored: IP address, email, account.",
                  )}
                </li>
                <li>
                  {t(
                    "报告经 Cloudflare 传到本项目的数据库。Cloudflare 会为传输和防滥用处理这次请求。",
                    "Reports reach the project's database through Cloudflare, which handles the request for delivery and abuse prevention.",
                  )}
                </li>
                <li>
                  {t(
                    "只有维护者能读报告。网站不公开报告，其他访客也看不到。",
                    "Only the maintainers can read reports. The site never shows them to other visitors.",
                  )}
                </li>
                <li>
                  {t(
                    "提交即同意报告内容以 CC BY-NC-SA 4.0 授权给本项目使用。",
                    "By sending, you license the report to the project under CC BY-NC-SA 4.0.",
                  )}
                </li>
              </ul>
              <p className="report-hint">
                {t(
                  "未满 14 周岁，请在监护人同意后提交。",
                  "If you are under 14, ask a parent or guardian before sending.",
                )}
              </p>
              <label className="report-check">
                <input
                  type="checkbox"
                  checked={draft.agreed}
                  onChange={(e) => update({ agreed: e.target.checked })}
                />
                {t(
                  "我已阅读以上说明，并且没有填写他人或自己的个人信息。",
                  "I have read the above and included no personal information about myself or anyone else.",
                )}
              </label>
            </section>
            <div className="report-trap" aria-hidden="true">
              <label>
                请勿填写
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={draft.website}
                  onChange={(e) => update({ website: e.target.value })}
                />
              </label>
            </div>
          </div>
        )}
        <footer className="report-foot">
          {phase === "sent" ? (
            <>
              <button type="button" className="report-button" onClick={another}>
                {t("再报告一个", "Report another")}
              </button>
              <button
                type="button"
                className="report-button primary"
                onClick={close}
              >
                {t("关闭", "Close")}
              </button>
            </>
          ) : (
            <>
              <p
                className={"report-status" + (phase === "failed" ? " bad" : "")}
                role={phase === "failed" ? "alert" : undefined}
              >
                {status}
              </p>
              <button type="button" className="report-button" onClick={close}>
                {t("取消", "Cancel")}
              </button>
              <button
                type="submit"
                className="report-button primary"
                disabled={!feedbackOpen || phase === "sending"}
              >
                {!feedbackOpen
                  ? t("即将开放", "Opening soon")
                  : phase === "sending"
                    ? t("提交中…", "Sending…")
                    : phase === "failed"
                      ? t("重试", "Retry")
                      : t("提交报告", "Send report")}
              </button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
