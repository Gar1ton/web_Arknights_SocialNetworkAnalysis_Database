import test from "node:test";
import assert from "node:assert/strict";
import { createScreenScroller } from "../src/screenScroll";

// Minimal window stand-in: manual frames and timers, a scroll position.
function fakeWindow() {
  const g = globalThis as Record<string, unknown>;
  let frames: (() => void)[] = [];
  let timers: (() => void)[] = [];
  let now = 0;
  g.scrollY = 0;
  g.scrollTo = (_: number, y: number) => (g.scrollY = y);
  g.requestAnimationFrame = (cb: () => void) => frames.push(cb);
  g.cancelAnimationFrame = () => (frames = []);
  g.window = { setTimeout: (cb: () => void) => timers.push(cb) };
  g.clearTimeout = () => (timers = []);
  Object.defineProperty(globalThis, "performance", {
    value: { now: () => now },
    configurable: true,
  });
  return {
    flush() {
      for (let i = 0; i < 500 && frames.length; i++) {
        const run = frames;
        frames = [];
        run.forEach((f) => f());
      }
    },
    idle() {
      now += 1000;
      const run = timers;
      timers = [];
      run.forEach((f) => f());
      this.flush();
    },
    get y() {
      return g.scrollY as number;
    },
  };
}
test("small nudges return, larger moves finish at the next stop", () => {
  const w = fakeWindow();
  const s = createScreenScroller(
    () => 900,
    () => false,
  );
  s.wheel(40, false);
  w.flush();
  assert.ok(w.y > 0 && w.y <= 40);
  w.idle();
  assert.equal(w.y, 0);
  s.wheel(200, false);
  w.idle();
  assert.equal(w.y, 900);
  s.wheel(-300, false);
  w.idle();
  assert.equal(w.y, 0);
});
test("stops are hard limits and absorb the rest of the gesture", () => {
  const w = fakeWindow();
  const s = createScreenScroller(
    () => 900,
    () => false,
  );
  assert.equal(s.wheel(5000, false), true);
  w.flush();
  assert.equal(w.y, 900);
  // Inertia right after reaching the stop must not scroll the inner panel.
  assert.equal(s.wheel(120, true), true);
  w.idle();
  // A new gesture at the stop lets the introduction scroll itself.
  assert.equal(s.wheel(120, true), false);
  assert.equal(w.y, 900);
  s.wheel(-5000, false);
  w.flush();
  assert.equal(w.y, 0);
});
test("instant mode jumps without easing", () => {
  const w = fakeWindow();
  const s = createScreenScroller(
    () => 900,
    () => true,
  );
  s.go(1);
  w.flush();
  assert.equal(w.y, 900);
});
