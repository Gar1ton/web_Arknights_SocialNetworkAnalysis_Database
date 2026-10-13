import { useEffect, useRef } from "react";
import { palettes, type Settings } from "./settings";
import {
  createThreadField,
  stepThreadField,
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
}: {
  settings: Settings;
  subtle?: boolean;
  anchors?: FlowAnchor[];
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    moving = useRef(settings.animate);
  useEffect(() => {
    moving.current = settings.animate;
  }, [settings.animate]);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    let field: ThreadField | undefined,
      raf = 0,
      last = 0,
      visible = true,
      resizeFrame = 0;
    const colors = palettes[settings.palette].colors;
    const paint = () => {
      if (!field) return;
      // A complete clear is essential: alpha-fading an 8-bit canvas leaves residual
      // pixels that accumulate indefinitely. Every frame here has finite geometry.
      ctx.clearRect(0, 0, field.width, field.height);
      ctx.lineWidth = subtle ? 0.65 : 0.7;
      ctx.lineCap = "round";
      for (const p of field.particles) {
        const fade = Math.max(
          0,
          Math.min(1, p.age / 26, (p.life - p.age) / 40),
        );
        ctx.globalAlpha = fade * (subtle ? 0.27 : 0.43);
        ctx.strokeStyle = colors[p.color];
        ctx.beginPath();
        for (let j = 0; j < p.length; j++) {
          const index =
            (p.head - p.length + 1 + j + TRAIL_LENGTH) % TRAIL_LENGTH;
          const x = p.trail[index * 2],
            y = p.trail[index * 2 + 1];
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const dpr = Math.min(devicePixelRatio || 1, subtle ? 1 : 1.25);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const budget = particleBudget(
        settings.particles,
        box.width,
        box.height,
        subtle,
      );
      let centers = anchors;
      if (anchors.length) {
        const scale = Math.min(box.width / 1000, box.height / 760),
          ox = (box.width - 1000 * scale) / 2,
          oy = (box.height - 760 * scale) / 2;
        centers = anchors.map((p) => ({
          x: (ox + p.x * scale) / box.width,
          y: (oy + p.y * scale) / box.height,
        }));
      }
      field = createThreadField(box.width, box.height, budget, centers);
      for (let i = 0; i < TRAIL_LENGTH; i++)
        stepThreadField(field, settings.speed, settings.turbulence);
      canvas.dataset.particles = String(budget);
      canvas.dataset.trailLength = String(TRAIL_LENGTH);
      paint();
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);
    const loop = (now: number) => {
      if (now - last >= 1000 / 24) {
        if (field && moving.current && visible && !document.hidden) {
          stepThreadField(field, settings.speed, settings.turbulence);
          paint();
        }
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeFrame);
      ro.disconnect();
      io.disconnect();
    };
  }, [
    settings.palette,
    settings.particles,
    settings.speed,
    settings.turbulence,
    subtle,
    anchors,
  ]);
  return (
    <canvas
      ref={ref}
      className={"flow-field " + (subtle ? "network-flow" : "")}
      aria-hidden="true"
    />
  );
}
