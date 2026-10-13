export const TRAIL_LENGTH = 160;
export type FlowAnchor = { x: number; y: number; mass?: number; id?: string };
export type ThreadParticle = {
  trail: Float32Array;
  head: number;
  length: number;
  x: number;
  y: number;
  age: number;
  life: number;
  color: number;
};
export type ThreadField = {
  width: number;
  height: number;
  particles: ThreadParticle[];
  grid: Float32Array;
  columns: number;
  rows: number;
  phase: number;
  tick: number;
  dirty: boolean;
  random: () => number;
  anchors: FlowAnchor[];
};
export function particleBudget(
  requested: number,
  width: number,
  height: number,
  quiet: boolean,
) {
  return Math.max(
    0,
    Math.floor(
      Math.min(
        requested * (quiet ? 0.52 : 0.82),
        (width * height) / (quiet ? 1600 : 820),
        quiet ? 720 : 1600,
      ),
    ),
  );
}
export function createThreadField(
  width: number,
  height: number,
  count: number,
  anchors: FlowAnchor[] = [],
): ThreadField {
  let seed = 731;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const field: ThreadField = {
    width,
    height,
    particles: [],
    grid: new Float32Array(38 * 30 * 2),
    columns: 38,
    rows: 30,
    phase: 0,
    tick: 0,
    dirty: false,
    random,
    anchors: anchors.length
      ? anchors
      : [
          { x: 0.28, y: 0.38 },
          { x: 0.72, y: 0.56 },
          { x: 0.58, y: 0.17 },
        ],
  };
  for (let i = 0; i < count; i++) {
    const x = random() * width,
      y = random() * height;
    const trail = new Float32Array(TRAIL_LENGTH * 2);
    trail[0] = x;
    trail[1] = y;
    field.particles.push({
      trail,
      head: 0,
      length: 1,
      x,
      y,
      age: Math.floor(random() * 180),
      life: 520 + Math.floor(random() * 280),
      color: i % 4,
    });
  }
  refreshGrid(field, 1.2);
  return field;
}
function refreshGrid(f: ThreadField, turbulence: number, gravity = 1) {
  const unit = Math.min(f.width, f.height);
  const aspectX = f.width / unit,
    aspectY = f.height / unit;
  const phase = f.phase * 0.2;
  const amplitude = 0.15 * (0.75 + turbulence * 0.12);
  const totalMass = f.anchors.reduce((sum, a) => sum + (a.mass ?? 1), 0) || 1;
  for (let gy = 0; gy < f.rows; gy++)
    for (let gx = 0; gx < f.columns; gx++) {
      const x = (gx / (f.columns - 1)) * aspectX,
        y = (gy / (f.rows - 1)) * aspectY;
      const sx = 7 * x + phase,
        sy = 2.8 * y - phase * 0.7;
      const ribbon = 4.5 * x + 2.2 * y + phase * 0.4;
      // Curl of a smooth stream function plus through-flow: no inward force,
      // no point sinks, and no per-cell normalization (which creates compression).
      let dx =
        1.1 +
        amplitude * 2.8 * Math.sin(sx) * Math.cos(sy) +
        0.088 * Math.cos(ribbon);
      let dy =
        0.1 -
        amplitude * 7 * Math.cos(sx) * Math.sin(sy) -
        0.18 * Math.cos(ribbon);
      // Incommensurate stream-function modes break up parallel ribbons.
      const detail = 0.025 + turbulence * 0.015;
      const a = Math.cos(9.3 * x + 2.1 * y + phase * 1.4 + 1.8);
      const b = Math.cos(5.7 * x - 1.3 * y - phase * 0.8 + 4.2);
      const c = Math.cos(14.1 * x + 4.7 * y + phase * 0.6);
      dx += detail * (2.1 * a - 1.3 * b) + turbulence * 0.003 * 4.7 * c;
      dy -= detail * (9.3 * a + 5.7 * b) + turbulence * 0.003 * 14.1 * c;
      f.anchors.forEach((a, k) => {
        const ox = x - a.x * aspectX,
          oy = y - a.y * aspectY;
        const radius = 0.28 + (k % 3) * 0.035;
        const envelope = Math.exp(-(ox * ox + oy * oy) / (2 * radius * radius));
        // All nodes share one bounded influence budget, even when they overlap.
        const strength = (0.42 * gravity * (a.mass ?? 1)) / totalMass;
        const spin = k % 2 ? 1 : -1;
        dx += (-oy / radius) * envelope * strength * spin;
        dy += (ox / radius) * envelope * strength * spin;
      });
      const j = (gy * f.columns + gx) * 2;
      f.grid[j] = dx;
      f.grid[j + 1] = dy;
    }
}
// Move existing local ribbons with their field centers; preserve fixed buffers.
export function updateThreadAnchors(
  f: ThreadField,
  next: FlowAnchor[],
  gravity = 1,
  follow = true,
) {
  const changed =
    next.length !== f.anchors.length ||
    next.some((a, i) => {
      const old = f.anchors[i];
      return (
        !old ||
        a.id !== old.id ||
        Math.abs(a.x - old.x) > 0.00001 ||
        Math.abs(a.y - old.y) > 0.00001 ||
        a.mass !== old.mass
      );
    });
  if (!changed) return;
  if (follow && gravity > 0) {
    const unit = Math.min(f.width, f.height);
    const radius2 = (unit * 0.24) ** 2 * 2;
    const moves = next.flatMap((a, i) => {
      const old = a.id ? f.anchors.find((p) => p.id === a.id) : f.anchors[i];
      if (!old) return [];
      const dx = (a.x - old.x) * f.width,
        dy = (a.y - old.y) * f.height;
      const limit = Math.min(1, (unit * 0.08) / (Math.hypot(dx, dy) || 1));
      return [
        {
          x: old.x * f.width,
          y: old.y * f.height,
          dx: dx * limit,
          dy: dy * limit,
          gain: Math.min(1, gravity) * 0.42 * Math.min(1, (a.mass ?? 1) / 1.5),
        },
      ];
    });
    for (const p of f.particles) {
      let dx = 0,
        dy = 0;
      for (const m of moves) {
        const influence =
          Math.exp(-((p.x - m.x) ** 2 + (p.y - m.y) ** 2) / radius2) * m.gain;
        dx += m.dx * influence;
        dy += m.dy * influence;
      }
      p.x += dx;
      p.y += dy;
      for (let j = 0; j < p.trail.length; j += 2) {
        p.trail[j] += dx;
        p.trail[j + 1] += dy;
      }
    }
  }
  f.anchors = next;
  f.dirty = true;
}
export function stepThreadField(
  f: ThreadField,
  speed = 0.65,
  turbulence = 1.2,
  gravity = 1,
) {
  if (f.dirty || f.tick % 10 === 0) {
    refreshGrid(f, turbulence, gravity);
    f.dirty = false;
  }
  f.tick++;
  f.phase += 0.006;
  for (const p of f.particles) {
    if (
      p.age >= p.life ||
      p.x < -2 ||
      p.y < -2 ||
      p.x > f.width + 2 ||
      p.y > f.height + 2
    ) {
      p.x = f.random() * f.width;
      p.y = f.random() * f.height;
      p.age = 0;
      p.head = 0;
      p.length = 1;
      p.trail[0] = p.x;
      p.trail[1] = p.y;
      continue;
    }
    const fx = Math.max(
        0,
        Math.min(f.columns - 1.001, (p.x / f.width) * (f.columns - 1)),
      ),
      fy = Math.max(
        0,
        Math.min(f.rows - 1.001, (p.y / f.height) * (f.rows - 1)),
      );
    const ix = Math.floor(fx),
      iy = Math.floor(fy),
      tx = fx - ix,
      ty = fy - iy;
    const base = (iy * f.columns + ix) * 2,
      next = base + f.columns * 2;
    const vx =
      (f.grid[base] * (1 - tx) + f.grid[base + 2] * tx) * (1 - ty) +
      (f.grid[next] * (1 - tx) + f.grid[next + 2] * tx) * ty;
    const vy =
      (f.grid[base + 1] * (1 - tx) + f.grid[base + 3] * tx) * (1 - ty) +
      (f.grid[next + 1] * (1 - tx) + f.grid[next + 3] * tx) * ty;
    p.x += vx * speed * 2.1;
    p.y += vy * speed * 2.1;
    p.age++;
    p.head = (p.head + 1) % TRAIL_LENGTH;
    p.trail[p.head * 2] = p.x;
    p.trail[p.head * 2 + 1] = p.y;
    p.length = Math.min(TRAIL_LENGTH, p.length + 1);
  }
}
