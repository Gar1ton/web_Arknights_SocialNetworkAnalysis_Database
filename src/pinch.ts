import { type Point } from "./layout";
/**
 * The graph draws content point c at  pan + C + (c − C) × zoom,
 * with C = (500, 380), the scene centre.
 */
const C = { x: 500, y: 380 };
export type View = { zoom: number; pan: Point };
/** Content point under a scene point for the given view. */
export function contentAt(scene: Point, view: View): Point {
  return {
    x: C.x + (scene.x - view.pan.x - C.x) / view.zoom,
    y: C.y + (scene.y - view.pan.y - C.y) / view.zoom,
  };
}
/** Pan that places content point `content` under scene point `scene` at `zoom`. */
export function panFor(content: Point, scene: Point, zoom: number): Point {
  return {
    x: scene.x - C.x - (content.x - C.x) * zoom,
    y: scene.y - C.y - (content.y - C.y) * zoom,
  };
}
export type Pinch = { distance: number; zoom: number; content: Point };
const middle = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
/** Starts a two-finger gesture from the current view. */
export function startPinch(a: Point, b: Point, view: View): Pinch {
  return {
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    zoom: view.zoom,
    content: contentAt(middle(a, b), view),
  };
}
/**
 * View for the fingers' current positions: zoom follows the finger spread and
 * the content first touched between the fingers stays between them, so the
 * same gesture also pans.
 */
export function pinchView(
  pinch: Pinch,
  a: Point,
  b: Point,
  clamp: (z: number) => number,
): View {
  const zoom = clamp(
    (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance,
  );
  return { zoom, pan: panFor(pinch.content, middle(a, b), zoom) };
}
