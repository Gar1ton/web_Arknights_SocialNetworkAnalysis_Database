import { t } from "./i18n";
export default function Brand() {
  return (
    <a className="brand" href="#" aria-label={t("返回首页", "Back to home")}>
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>
        {t("方舟关系图谱", "Arknights Relation Atlas")}
        <small>
          {t("明日方舟 · 剧情人物关系", "Arknights · story relations")}
        </small>
      </span>
    </a>
  );
}
