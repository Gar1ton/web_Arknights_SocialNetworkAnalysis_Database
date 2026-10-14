/**
 * Two-stop page scrolling for the landing page (desktop).
 *
 * The page follows wheel / trackpad input directly, eased towards the input
 * target each frame, and is limited to two stops: the hero (0) and the
 * introduction (`second()`). Reaching a stop absorbs the rest of that gesture,
 * so inertia never runs on into the introduction's own scroller. When input
 * stops between the stops, the page eases on to the stop it was heading for
 * (or back, for a small nudge).
 */
const EASE = 0.14; // share of the remaining distance covered per frame
const IDLE_MS = 160; // pause that ends a wheel gesture
const NUDGE = 0.12; // share of the distance a gesture must cover to switch
export function createScreenScroller(
  second: () => number,
  instant: () => boolean,
) {
  let y = scrollY,
    target = scrollY,
    raf = 0,
    idle = 0,
    lockUntil = 0,
    direction = 0,
    origin = 0;
  const frame = () => {
    y += (target - y) * (instant() ? 1 : EASE);
    if (Math.abs(target - y) < 0.5) y = target;
    scrollTo(0, y);
    raf = y === target ? 0 : requestAnimationFrame(frame);
  };
  const run = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const atStop = (v: number) => v <= 0.5 || Math.abs(v - second()) <= 0.5;
  const settle = () => {
    idle = 0;
    if (atStop(target)) return;
    const end = second();
    const moved = Math.abs(target - origin) / Math.max(1, end);
    const forward = direction > 0 ? end : 0;
    const back = direction > 0 ? 0 : end;
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
      if (atStop(target)) origin = target;
      direction = Math.sign(dy);
      const end = second();
      target = Math.min(end, Math.max(0, target + dy));
      if (atStop(target) && target !== origin) lockUntil = now + IDLE_MS;
      clearTimeout(idle);
      idle = window.setTimeout(settle, IDLE_MS);
      run();
      return true;
    },
    /** Eases to a stop (keyboard and buttons). */
    go(screen: 0 | 1) {
      if (!raf) y = scrollY;
      origin = target = screen ? second() : 0;
      run();
    },
    /** Picks up scrolling done outside this controller (e.g. scrollbar drag). */
    release() {
      if (raf || idle) return;
      y = target = scrollY;
      if (!atStop(y)) {
        direction = 0;
        target = y > second() / 2 ? second() : 0;
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
