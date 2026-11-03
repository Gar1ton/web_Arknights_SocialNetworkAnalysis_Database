/**
 * Screen-by-screen page scrolling for the landing page (desktop).
 *
 * The page follows wheel / trackpad input directly, eased towards the input
 * target each frame, and moves at most one screen per gesture: from a stop it
 * can reach only the neighbouring stop in the direction of travel. Reaching a
 * stop absorbs the rest of that gesture, so inertia never runs on into a
 * screen's own scroller. When input stops between two stops, the page eases on
 * to the stop it was heading for (or back, for a small nudge).
 */
const EASE = 0.14; // share of the remaining distance covered per frame
const IDLE_MS = 160; // pause that ends a wheel gesture
const NUDGE = 0.12; // share of the distance a gesture must cover to switch
/** `stops` returns the page offset of each screen, ascending, starting at 0. */
export function createScreenScroller(
  stops: () => number[],
  instant: () => boolean,
) {
  let y = scrollY,
    target = scrollY,
    raf = 0,
    idle = 0,
    lockUntil = 0,
    direction = 0,
    origin = 0,
    lo = 0, // the two stops the current gesture moves between
    hi = 0;
  const frame = () => {
    y += (target - y) * (instant() ? 1 : EASE);
    if (Math.abs(target - y) < 0.5) y = target;
    scrollTo(0, y);
    raf = y === target ? 0 : requestAnimationFrame(frame);
  };
  const run = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const atStop = (v: number) => stops().some((s) => Math.abs(v - s) <= 0.5);
  /** Index of the stop nearest to `v`. */
  const nearest = (v: number) => {
    const all = stops();
    let best = 0;
    all.forEach((s, i) => {
      if (Math.abs(v - s) < Math.abs(v - all[best])) best = i;
    });
    return best;
  };
  const settle = () => {
    idle = 0;
    if (atStop(target)) return;
    const moved = Math.abs(target - origin) / Math.max(1, hi - lo);
    const forward = direction > 0 ? hi : lo;
    const back = direction > 0 ? lo : hi;
    target = moved >= NUDGE ? forward : back;
    run();
  };
  return {
    /** Returns true when the event was used to move the page. */
    wheel(dy: number, canScrollInside: boolean) {
      const now = performance.now();
      if (now < lockUntil && Math.sign(dy) === direction) {
        lockUntil = now + IDLE_MS;
        return true;
      }
      if (!raf) y = target = scrollY;
      if (canScrollInside && atStop(target)) return false;
      direction = Math.sign(dy);
      if (atStop(target)) {
        const all = stops(),
          i = nearest(target);
        origin = all[i];
        lo = direction > 0 ? origin : all[Math.max(0, i - 1)];
        hi = direction > 0 ? all[Math.min(all.length - 1, i + 1)] : origin;
      }
      target = Math.min(hi, Math.max(lo, target + dy));
      if (atStop(target) && target !== origin) lockUntil = now + IDLE_MS;
      clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
      run();
      return true;
    },
    /** Eases to a stop (keyboard and buttons); out-of-range indexes clamp. */
    go(screen: number) {
      const all = stops();
      if (!raf) y = scrollY;
      origin = target = all[Math.max(0, Math.min(all.length - 1, screen))];
      run();
    },
    /** The screen the page rests on, or is heading for. */
    current() {
      return nearest(raf ? target : scrollY);
    },
    /** Picks up scrolling done outside this controller (e.g. scrollbar drag). */
    release() {
      if (raf || idle) return;
      y = target = scrollY;
      if (!atStop(y)) {
        direction = 0;
        target = stops()[nearest(y)];
        run();
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      raf = idle = 0;
    },
  };
}
/** True when an element between `target` and the page can still scroll by `dy`. */
export function scrollsInside(target: EventTarget | null, dy: number) {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== document.body && el !== document.documentElement;
    el = el.parentElement
  ) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 1 &&
      (dy > 0
        ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
        : el.scrollTop > 0)
    )
      return true;
  }
  return false;
}
