import { avatarUrl, englishName } from "../archives";
import { t } from "../i18n";
import type { Core } from "../model/load";
/** A person's name in the current language: an operator's own English name, else the English script's, else Chinese. */
export function personName(core: Core, p: number) {
  const [zh, en, scope] = core.people.people[p];
  if (scope === 2) return t(zh, "Doctor");
  return en ? t(zh, en) : englishName(zh);
}
/** The other-language name, shown small, when it differs. */
export function altName(core: Core, p: number) {
  const zh = core.people.people[p][0];
  const shown = personName(core, p);
  return shown === zh ? "" : t(shown, zh);
}
const scopes = [
  ["干员", "Operator"],
  ["具名角色", "Named character"],
  ["博士", "The Doctor"],
  ["本故事的泛称角色", "Unnamed, this story only"],
];
export const scopeName = (scope: number) => t(scopes[scope][0], scopes[scope][1]);
export function Avatar({ core, p, size = 34 }: { core: Core; p: number; size?: number }) {
  const key = core.media.avatars[String(p)];
  const name = core.people.people[p][0];
  return (
    <span className="avatar" style={{ width: size, height: size }} aria-hidden="true">
      {key ? <img src={avatarUrl(key)} alt="" loading="lazy" /> : <span>{Array.from(name)[0]}</span>}
    </span>
  );
}
export function PersonLink({ core, p, open }: { core: Core; p: number; open: (p: number) => void }) {
  return (
    <button type="button" className="link" onClick={() => open(p)}>
      {personName(core, p)}
    </button>
  );
}
export function NewBadge({ kind }: { kind?: "new" | "updated" }) {
  if (!kind) return null;
  return <span className={"badge badge-" + kind}>{kind === "new" ? t("新", "New") : t("续", "Updated")}</span>;
}
