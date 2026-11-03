import { useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
/** One tooltip for the whole page: charts call show/hide, <TipLayer/> draws it next to the pointer. */
type State = { lines: string[]; x: number; y: number } | null;
let state: State = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
type PointerLike = { clientX: number; clientY: number };
export function showTip(ev: PointerLike | ReactMouseEvent, lines: string[]) {
  state = { lines: lines.filter(Boolean), x: ev.clientX, y: ev.clientY };
  emit();
}
export function hideTip() {
  if (!state) return;
  state = null;
  emit();
}
/** Props that put a tooltip on any element. */
export const hover = (lines: () => string[]) => ({
  onMouseMove: (ev: ReactMouseEvent) => showTip(ev, lines()),
  onMouseLeave: hideTip,
});
export function TipLayer() {
  const tip = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  if (!tip) return null;
  const left = Math.min(tip.x + 14, window.innerWidth - 300);
  const top = Math.min(tip.y + 14, window.innerHeight - 24 - tip.lines.length * 18);
  return (
    <div className="tip" style={{ left, top }} role="status">
      {tip.lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
