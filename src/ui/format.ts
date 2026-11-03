import { locale, t } from "../i18n";
import { octantKeys, octantName } from "../data";
export const num = (n: number) => n.toLocaleString(locale());
/** −1..1 values with an explicit sign. */
export const signed = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
export const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : "0") + "%";
/** Relation type by index, in the order the data files use. */
export const typeName = (i: number) => octantName(octantKeys[i]);
export const typeKey = (i: number) => octantKeys[i];
export const positionLabel = (pos: number, m: number) =>
  t(`第 ${num(pos)} / ${num(m)} 句`, `line ${num(pos)} of ${num(m)}`);
