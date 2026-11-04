import { useCallback, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "./i18n";

/** The width under which the graph pages use the phone layout (mobile.css). */
const QUERY = "(max-width: 912px)";
const subscribe = (change: () => void) => {
  const list = matchMedia(QUERY);
  list.addEventListener("change", change);
  return () => list.removeEventListener("change", change);
};
export const useCompact = () => useSyncExternalStore(subscribe, () => matchMedia(QUERY).matches);

/** How much of the screen the panel takes on a phone. */
export type Sheet = "closed" | "half" | "full";

/**
 * The timeline dock starts folded on every graph page. Only unfolding is stored, so a later change of the
 * default still reaches everyone who never asked for the full dock.
 */
const DOCK_KEY = "terra:dock";
export function useDockFold() {
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(DOCK_KEY) !== "open";
    } catch {
      return true;
    }
  });
  const toggle = useCallback(() => {
    setFolded((was) => {
      try {
        if (was) localStorage.setItem(DOCK_KEY, "open");
        else localStorage.removeItem(DOCK_KEY);
      } catch {}
      return !was;
    });
  }, []);
  return [folded, toggle] as const;
}

/** The handle on top of the phone panel: tap or swipe up for full height, swipe down to shrink and close. */
export function SheetGrip({ sheet, onSheet }: { sheet: Sheet; onSheet: (next: Sheet) => void }) {
  const start = useRef<number | null>(null);
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const moved = e.clientY - start.current;
    start.current = null;
    if (moved > 24) onSheet(sheet === "full" ? "half" : "closed");
    else if (moved < -24) onSheet("full");
    else onSheet(sheet === "full" ? "half" : "full");
  };
  return (
    <div className="sheet-grip">
      <button
        className="sheet-handle"
        aria-label={sheet === "full" ? t("缩小面板", "Shrink the panel") : t("放大面板", "Enlarge the panel")}
        aria-expanded={sheet === "full"}
        onPointerDown={(e) => {
          start.current = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSheet(sheet === "full" ? "half" : "full");
          }
        }}
      >
        <i />
      </button>
      <button className="sheet-close" aria-label={t("关闭面板", "Close the panel")} onClick={() => onSheet("closed")}>
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
