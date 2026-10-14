import test from "node:test";
import assert from "node:assert/strict";
import { contentAt, panFor, pinchView, startPinch } from "../src/pinch";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9);
const clamp = (z: number) => Math.max(0.3, Math.min(2.5, z));
const scene = (
  c: { x: number; y: number },
  v: { zoom: number; pan: { x: number; y: number } },
) => ({
  x: v.pan.x + 500 + (c.x - 500) * v.zoom,
  y: v.pan.y + 380 + (c.y - 380) * v.zoom,
});

test("contentAt and panFor invert the graph transform", () => {
  const view = { zoom: 1.7, pan: { x: -40, y: 25 } };
  const c = contentAt({ x: 320, y: 610 }, view);
  const s = scene(c, view);
  near(s.x, 320);
  near(s.y, 610);
  const pan = panFor(c, { x: 100, y: 90 }, 0.6);
  const moved = scene(c, { zoom: 0.6, pan });
  near(moved.x, 100);
  near(moved.y, 90);
});
test("spreading two fingers zooms around the content between them", () => {
  const start = { zoom: 1, pan: { x: 0, y: 0 } };
  const a = { x: 300, y: 300 },
    b = { x: 400, y: 300 };
  const pinch = startPinch(a, b, start);
  const view = pinchView(pinch, { x: 250, y: 300 }, { x: 450, y: 300 }, clamp);
  near(view.zoom, 2);
  const mid = scene(pinch.content, view);
  near(mid.x, 350);
  near(mid.y, 300);
});
test("moving both fingers together pans; zoom stays clamped", () => {
  const pinch = startPinch(
    { x: 300, y: 300 },
    { x: 400, y: 300 },
    { zoom: 1, pan: { x: 0, y: 0 } },
  );
  const panned = pinchView(
    pinch,
    { x: 330, y: 340 },
    { x: 430, y: 340 },
    clamp,
  );
  near(panned.zoom, 1);
  near(panned.pan.x, 30);
  near(panned.pan.y, 40);
  assert.equal(
    pinchView(pinch, { x: 0, y: 0 }, { x: 5000, y: 0 }, clamp).zoom,
    2.5,
  );
  assert.equal(
    pinchView(pinch, { x: 350, y: 300 }, { x: 351, y: 300 }, clamp).zoom,
    0.3,
  );
});
