export const TRAIL_LENGTH = 48;
export type FlowAnchor = { x: number; y: number };
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
      life: 260 + Math.floor(random() * 220),
      color: i % 4,
    });
  }
  refreshGrid(field, 1.2);
  return field;
}
function refreshGrid(f: ThreadField, turbulence: number) {
  for (let gy = 0; gy < f.rows; gy++)
    for (let gx = 0; gx < f.columns; gx++) {
      const x = gx / (f.columns - 1),
        y = gy / (f.rows - 1);
      let dx = 0.3,
        dy = 0.12;
      f.anchors.forEach((a, k) => {
        const ox = x - a.x,
          oy = y - a.y;
        const d = ox * ox + oy * oy + 0.035;
        const spin = k % 2 ? 1 : -1;
        dx += (-oy / d) * 0.14 * spin;
        dy += (ox / d) * 0.14 * spin;
      });
      const wave =
        Math.sin(x * 5.2 + y * 3.8 + f.phase * 0.14) * 0.62 +
        Math.cos(y * 7.4 - x * 2.1 - f.phase * 0.1) * 0.33;
      const angle = Math.atan2(dy, dx) + wave * turbulence;
      const j = (gy * f.columns + gx) * 2;
      f.grid[j] = Math.cos(angle);
      f.grid[j + 1] = Math.sin(angle);
    }
}
export function stepThreadField(
  f: ThreadField,
  speed = 0.65,
  turbulence = 1.2,
) {
  if (f.tick % 10 === 0) refreshGrid(f, turbulence);
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
