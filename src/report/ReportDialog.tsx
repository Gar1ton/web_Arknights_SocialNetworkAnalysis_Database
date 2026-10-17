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
export function ReportButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="report-link" onClick={onClick}>
      <Flag size={13} />
      数据有问题？
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
      setError("暂时连不上纠错服务，或提交太频繁。你填写的内容都还在。");
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
          : `还差 ${issues.length} 项`
        : feedbackOpen
          ? "可以提交了"
          : "已填写完整，开放后即可提交";
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
            <span className="eyebrow">纠错</span>
            <h2 id="report-title">报告数据问题</h2>
            <p>
              {archive.code} · {archive.title}
            </p>
          </div>
          <button
            type="button"
            className="report-close"
            aria-label="关闭"
            onClick={close}
          >
            <X size={18} />
          </button>
        </header>
        {phase === "sent" ? (
          <div className="report-done" role="status">
            <Check size={26} />
            <h3>已收到，谢谢你</h3>
            <p>只有维护者能看到这份报告。它会在下一版数据清洗时被逐条核对。</p>
          </div>
        ) : (
          <div className="report-body">
            {!feedbackOpen && (
              <p className="report-closed">
                纠错提交即将开放。现在可以先看看需要填写哪些内容，但暂时还不能发送。
              </p>
            )}
            <fieldset className="report-section">
              <legend className="report-label">问题类型</legend>
              <div className="report-chips">
                {reportTypes.map(([key, label]) => (
                  <label key={key} className="report-chip">
                    <input
                      type="radio"
                      name="report-type"
                      checked={draft.type === key}
                      onChange={() => update({ type: key })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <TypeFields draft={draft} update={update} data={data} byId={byId} />
            <label className="report-section">
              <span className="report-label">
                {draft.type === "other" ? "发现了什么问题？" : "为什么不合理？"}
                <i aria-hidden="true"> *</i>
              </span>
              <textarea
                className="report-input report-reason"
                rows={4}
                required
                value={draft.reason}
                placeholder={
                  draft.type === "other"
                    ? "请描述你看到的问题，以及在哪里看到的"
                    : "例如：8-12 里阿米娅一直主动回应凯尔希，语气是信任，不是被压着服从"
                }
                onChange={(e) => update({ reason: e.target.value })}
              />
              <span className="report-count">
                {length(draft.reason)} / {limits.reasonMax}
              </span>
            </label>
            <div className="report-section">
              <label className="report-field">
                <span className="report-label">贡献者用户名（可选）</span>
                <input
                  className="report-input"
                  value={draft.contributor}
                  autoComplete="nickname"
                  placeholder="匿名贡献者"
                  onChange={(e) => update({ contributor: e.target.value })}
                />
              </label>
              <p className="report-hint">
                留空则记为「匿名贡献者」。请不要填写真实姓名、邮箱或手机号。
              </p>
              {name && (
                <label className="report-check">
                  <input
                    type="checkbox"
                    checked={draft.credit}
                    onChange={(e) => update({ credit: e.target.checked })}
                  />
                  同意在致谢名单中显示「{name}」
                </label>
              )}
            </div>
            <section
              className="report-notice"
              aria-labelledby="report-notice-title"
            >
              <h3 id="report-notice-title">提交前请知悉</h3>
              <ul>
                <li>
                  保存：你填写的内容、贡献者用户名（如果填写）、剧情与对象编号、数据版本、提交时间。
                </li>
                <li>不保存：IP 地址、邮箱、账号。</li>
                <li>
                  报告经 Cloudflare 传到本项目的数据库。Cloudflare
                  会为传输和防滥用处理这次请求。
                </li>
                <li>只有维护者能读报告。网站不公开报告，其他访客也看不到。</li>
                <li>提交即同意报告内容以 CC BY-NC-SA 3.0 授权给本项目使用。</li>
              </ul>
              <p className="report-hint">
                未满 14 周岁，请在监护人同意后提交。
              </p>
              <label className="report-check">
                <input
                  type="checkbox"
                  checked={draft.agreed}
                  onChange={(e) => update({ agreed: e.target.checked })}
                />
                我已阅读以上说明，并且没有填写他人或自己的个人信息。
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
                再报告一个
              </button>
              <button
                type="button"
                className="report-button primary"
                onClick={close}
              >
                关闭
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
                取消
              </button>
              <button
                type="submit"
                className="report-button primary"
                disabled={!feedbackOpen || phase === "sending"}
              >
                {!feedbackOpen
                  ? "即将开放"
                  : phase === "sending"
                    ? "提交中…"
                    : phase === "failed"
                      ? "重试"
                      : "提交报告"}
              </button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
