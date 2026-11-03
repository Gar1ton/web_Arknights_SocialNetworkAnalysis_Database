import { useEffect, useRef, type RefObject } from "react";
import { type Settings } from "./settings";
const flowColors = {
  dusk: ["#f3b572", "#ea79ad", "#a180df", "#67c1b9", "#c97bbb", "#dcbf86"],
  glacier: ["#69c9c4", "#83a1de", "#bfddd0", "#638db5", "#aaa2d5", "#87baaa"],
  ember: ["#ee895e", "#d36974", "#e5b968", "#ae648e", "#d989a2", "#eac6a0"],
  mono: ["#ded6c8", "#afa8bd", "#bec7cc", "#9296a8", "#c3b7c6", "#e2d7ce"],
};
import {
  advanceThreadField,
  createThreadField,
  particleFade,
  particleBudget,
  resizeThreadField,
  reweaveThreadField,
  stepThreadField,
  traceRibbon,
  updateThreadAnchors,
  TRAIL_LENGTH,
  type FlowAnchor,
  type ThreadField,
  type ThreadParticle,
} from "./particles";
const noAnchors: FlowAnchor[] = [];
/** Opacity steps per colour: ribbons are stroked in batches, not one by one. */
const LEVELS = 12;
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
      updateThreadAnchors(field, projected);
      canvas.dataset.attractors = String(points.length);
    };
    // Reused every frame: ribbons grouped by colour and opacity step.
    const batches: ThreadParticle[][] = Array.from(
      { length: 6 * LEVELS },
      () => [],
    );
    const paint = () => {
      if (!field) return;
      const s = live.current.settings,
        colors = flowColors[s.palette];
      reweaveThreadField(field);
      ctx.clearRect(0, 0, field.width, field.height);
      if (s.flowOpacity === 0) return;
      for (const batch of batches) batch.length = 0;
      for (const p of field.particles) {
        const level = Math.ceil(particleFade(p) * LEVELS);
        if (level > 0) batches[p.color * LEVELS + level - 1].push(p);
      }
      ctx.lineWidth = subtle ? 0.7 : 0.75;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const strength = (subtle ? 0.44 : 0.46) * s.flowOpacity;
      batches.forEach((batch, i) => {
        if (!batch.length) return;
        ctx.globalAlpha = (((i % LEVELS) + 1) / LEVELS) * strength;
        ctx.strokeStyle = colors[Math.floor(i / LEVELS)];
        ctx.beginPath();
        for (const p of batch) traceRibbon(field!, p, ctx);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };
    // Paint every frame; if painting gets expensive, paint every other frame.
    // Motion is driven by elapsed time either way, so speed never changes.
    let cost = 0,
      stride = 1,
      frame = 0;
    const loop = (now: number) => {
      raf = 0;
      const s = live.current.settings;
      if (!visible || document.hidden || !s.animate || s.flowOpacity === 0) {
        last = 0;
        return;
      }
      if (field) {
        const elapsed = last ? now - last : 0;
        last = now;
        project();
        advanceThreadField(
          field,
          elapsed,
          s.speed,
          s.turbulence,
          s.flowGravity,
        );
        if (++frame % stride === 0) {
          const start = performance.now();
          paint();
          cost = cost * 0.9 + (performance.now() - start) * 0.1;
          if (cost > 11) stride = 2;
          else if (cost < 5) stride = 1;
        }
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
        last = 0;
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
      if (field) resizeThreadField(field, box.width, box.height, budget);
      else {
        field = createThreadField(box.width, box.height, budget);
        project();
        for (let i = 0; i < TRAIL_LENGTH; i++)
          stepThreadField(field, s.speed, s.turbulence, s.flowGravity);
      }
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
