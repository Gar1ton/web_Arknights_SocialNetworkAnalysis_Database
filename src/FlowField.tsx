import { useEffect, useRef, type RefObject } from "react";
import { palettes, type Settings } from "./settings";
import {
  createThreadField,
  stepThreadField,
  updateThreadAnchors,
  particleBudget,
  TRAIL_LENGTH,
  type FlowAnchor,
  type ThreadField,
} from "./particles";
const noAnchors: FlowAnchor[] = [];
export default function FlowField({
  settings,
  subtle = false,
  anchors = noAnchors,
  anchorElement,
}: {
  settings: Settings;
  subtle?: boolean;
  anchors?: FlowAnchor[];
  anchorElement?: RefObject<SVGSVGElement | null>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ settings, anchors });
  live.current = { settings, anchors };
  const syncRef = useRef<() => void>(() => {}),
    paintRef = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext("2d", { alpha: true })!;
    let field: ThreadField | undefined,
      raf = 0,
      last = 0,
      visible = true,
      resizeFrame = 0,
      box = canvas.getBoundingClientRect();
    const project = () => {
      if (!field) return;
      const points = live.current.anchors;
      if (!anchorElement && !points.length) return;
      const area = anchorElement?.current?.getBoundingClientRect() || box;
      const scale = Math.min(area.width / 1000, area.height / 760);
      const ox = area.left - box.left + (area.width - 1000 * scale) / 2,
        oy = area.top - box.top + (area.height - 760 * scale) / 2;
      const projected = points.map((p) => ({
        id: p.id,
        x: (ox + p.x * scale) / box.width,
        y: (oy + p.y * scale) / box.height,
        mass: p.mass,
      }));
      const s = live.current.settings;
      updateThreadAnchors(field, projected, s.flowGravity, s.animate);
      canvas.dataset.attractors = String(points.length);
    };
    const paint = () => {
      if (!field) return;
      const s = live.current.settings,
        colors = palettes[s.palette].colors;
      ctx.clearRect(0, 0, field.width, field.height);
      if (s.flowOpacity === 0) return;
      ctx.lineWidth = subtle ? 0.7 : 0.75;
      ctx.lineCap = "round";
      for (const p of field.particles) {
        const fade = Math.max(
          0,
          Math.min(1, p.age / 26, (p.life - p.age) / 40),
        );
        ctx.globalAlpha = fade * (subtle ? 0.22 : 0.32) * s.flowOpacity;
        ctx.strokeStyle = colors[p.color];
        ctx.beginPath();
        // Keep long silk-like trails without tripling Canvas path operations.
        for (let j = 0; j < p.length; j += 3) {
          const index =
            (p.head - p.length + 1 + j + TRAIL_LENGTH) % TRAIL_LENGTH;
          if (j === 0) ctx.moveTo(p.trail[index * 2], p.trail[index * 2 + 1]);
          else ctx.lineTo(p.trail[index * 2], p.trail[index * 2 + 1]);
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const loop = (now: number) => {
      raf = 0;
      const s = live.current.settings;
      if (!visible || document.hidden || !s.animate || s.flowOpacity === 0)
        return;
      if (field && now - last >= 1000 / 24) {
        project();
        stepThreadField(field, s.speed, s.turbulence, s.flowGravity);
        paint();
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    const sync = () => {
      const s = live.current.settings;
      if (visible && !document.hidden && s.animate && s.flowOpacity > 0) {
        if (!raf) raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const resize = () => {
      box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const dpr = Math.min(devicePixelRatio || 1, subtle ? 1 : 1.25),
        s = live.current.settings;
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const budget = particleBudget(s.particles, box.width, box.height, subtle);
      field = createThreadField(box.width, box.height, budget);
      project();
      for (let i = 0; i < TRAIL_LENGTH; i++)
        stepThreadField(field, s.speed, s.turbulence, s.flowGravity);
      canvas.dataset.particles = String(budget);
      canvas.dataset.trailLength = String(TRAIL_LENGTH);
      paint();
      sync();
    };
    syncRef.current = sync;
    paintRef.current = paint;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      syncRef.current = () => {};
      paintRef.current = () => {};
    };
  }, [settings.particles, subtle, anchorElement]);
  useEffect(() => {
    paintRef.current();
    syncRef.current();
  }, [settings.animate, settings.flowOpacity, settings.palette]);
  return (
    <canvas
      ref={ref}
      className={"flow-field " + (subtle ? "network-flow" : "")}
      aria-hidden="true"
    />
  );
}
