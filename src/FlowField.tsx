import { useEffect, useRef } from "react";
import { palettes, type Settings } from "./settings";
type Particle = {
  x: number;
  y: number;
  age: number;
  life: number;
  color: string;
};
export default function FlowField({
  settings,
  subtle = false,
}: {
  settings: Settings;
  subtle?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moving = useRef(settings.animate);
  useEffect(() => {
    moving.current = settings.animate;
  }, [settings.animate]);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      time = 0;
    let pts: Particle[] = [];
    let seed = 317;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const colors = palettes[settings.palette].colors;
    const spawn = (p?: Particle): Particle =>
      Object.assign(p || {}, {
        x: random() * width,
        y: random() * height,
        age: 0,
        life: 90 + random() * 240,
        color: colors[Math.floor(random() * colors.length)],
      });
    const paint = (initial = false) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = palettes[settings.palette].bg;
      ctx.globalAlpha = initial ? 0.007 : 0.035;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = subtle ? 0.15 : 0.24;
      ctx.lineWidth = 0.6;
      for (const p of pts) {
        let dx = 0.52,
          dy = 0;
        const nx = p.x / width,
          ny = p.y / height;
        for (let k = 0; k < 4; k++) {
          const cx = 0.27 + (k % 2) * 0.42 + Math.sin(time * 0.02 + k) * 0.055;
          const cy = 0.27 + Math.floor(k / 2) * 0.48;
          const x = nx - cx,
            y = ny - cy,
            d = x * x + y * y + 0.024;
          const sign = k % 2 === 0 ? 1 : -1;
          dx += (-y / d) * 0.17 * sign;
          dy += (x / d) * 0.17 * sign;
        }
        const a =
          Math.atan2(dy, dx) +
          Math.sin(nx * 7 + ny * 5 + time * 0.025) * settings.turbulence * 0.65;
        const speed = (initial ? 1.7 : 1.1) * settings.speed;
        const x = p.x + Math.cos(a) * speed,
          y = p.y + Math.sin(a) * speed;
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        p.x = x;
        p.y = y;
        p.age++;
        if (p.age > p.life || x < 0 || x > width || y < 0 || y > height)
          spawn(p);
      }
      ctx.globalAlpha = 1;
      time++;
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width;
      height = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = palettes[settings.palette].bg;
      ctx.fillRect(0, 0, width, height);
      pts = Array.from(
        { length: Math.min(settings.particles, width < 600 ? 900 : 3000) },
        () => spawn(),
      );
      for (let i = 0; i < 100; i++) paint(true);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const loop = (now: number) => {
      if (moving.current && now - last > 32 && !document.hidden) {
        paint();
        last = now;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [
    settings.palette,
    settings.particles,
    settings.speed,
    settings.turbulence,
    subtle,
  ]);
  return <canvas ref={ref} className="flow-field" aria-hidden="true" />;
}
