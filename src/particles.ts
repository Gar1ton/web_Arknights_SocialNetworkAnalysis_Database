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
  reweave: boolean;
  potential: Float32Array;
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
    grid: new Float32Array(52 * 40 * 2),
    columns: 52,
    rows: 40,
    phase: 0,
    tick: 0,
    dirty: false,
    reweave: true,
    potential: new Float32Array(54 * 42),
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
      color: pigment(x, y, width, height, random()),
    });
  }
  refreshGrid(field, 1.2);
  return field;
}

function pigment(
  x: number,
  y: number,
  width: number,
  height: number,
  random: number,
) {
  const u = x / Math.min(width, height),
    v = y / Math.min(width, height);
  const band =
    Math.sin(u * 4.7 + Math.sin(v * 3.1)) + Math.cos(v * 5.3 - u * 2.2);
  return random < 0.23
    ? Math.floor((random / 0.23) * 6)
    : Math.min(5, Math.floor((band + 2) * 1.5));
}
function refreshGrid(f: ThreadField, turbulence: number, gravity = 1) {
  const unit = Math.min(f.width, f.height);
  const hx = f.width / unit / (f.columns - 1),
    hy = f.height / unit / (f.rows - 1);
  const stride = f.columns + 2,
    phase = f.phase * 0.13;
  const totalMass = f.anchors.reduce((sum, a) => sum + (a.mass ?? 1), 0) || 1;
  let mx = 0,
    my = 0;
  for (const a of f.anchors) {
    const weight = (a.mass ?? 1) / totalMass;
    mx += Math.sin(a.x * 4.1 + a.y * 2.7) * weight * gravity;
    my += Math.cos(a.y * 3.7 - a.x * 2.3) * weight * gravity;
  }
  // A warped scalar potential, not a shared directional wind. Node positions
  // influence its domain everywhere; broad vortices add local gravitational structure.
  for (let gy = -1; gy <= f.rows; gy++)
    for (let gx = -1; gx <= f.columns; gx++) {
      const x = gx * hx,
        y = gy * hy;
      const u = x + 0.24 * Math.sin(2.1 * y + 0.8 * x + phase + mx) + mx * 0.36;
      const v =
        y + 0.22 * Math.cos(2.8 * x - 0.6 * y + phase * 0.7 + my) + my * 0.36;
      let psi =
        0.19 * Math.sin(3.1 * u + 1.7 * v + phase) +
        0.15 * Math.cos(2.4 * u - 4.3 * v - phase * 0.7) +
        0.11 * Math.sin(5.4 * u + 3.7 * v + 2.1) +
        (0.016 + turbulence * 0.021) *
          Math.sin(9.3 * u - 6.7 * v + phase * 0.8);
      f.anchors.forEach((a, k) => {
        const dx = x - (a.x * f.width) / unit,
          dy = y - (a.y * f.height) / unit;
        const radius = 0.52 + (k % 3) * 0.1;
        psi +=
          (((k % 2 ? 1 : -1) * 0.34 * gravity * (a.mass ?? 1)) / totalMass) *
          Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
      });
      f.potential[(gy + 1) * stride + gx + 1] = psi;
    }
  let peak = 0;
  for (let gy = 0; gy < f.rows; gy++)
    for (let gx = 0; gx < f.columns; gx++) {
      const k = (gy + 1) * stride + gx + 1,
        j = (gy * f.columns + gx) * 2;
      const dx = (f.potential[k + stride] - f.potential[k - stride]) / (2 * hy);
      const dy = -(f.potential[k + 1] - f.potential[k - 1]) / (2 * hx);
      f.grid[j] = dx;
      f.grid[j + 1] = dy;
      peak = Math.max(peak, Math.hypot(dx, dy));
    }
  // One global speed bound preserves curl; per-cell normalization would create sinks.
  const scale = Math.min(1, 2.2 / (peak || 1));
  for (let i = 0; i < f.grid.length; i++) f.grid[i] *= scale;
  f.reweave = true;
}
export function updateThreadAnchors(f: ThreadField, next: FlowAnchor[]) {
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
  f.anchors = next;
  f.dirty = true;
}
function velocity(f: ThreadField, x: number, y: number, out: Float32Array) {
  const fx = Math.max(
    0,
    Math.min(f.columns - 1.001, (x / f.width) * (f.columns - 1)),
  );
  const fy = Math.max(
    0,
    Math.min(f.rows - 1.001, (y / f.height) * (f.rows - 1)),
  );
  const ix = Math.floor(fx),
    iy = Math.floor(fy),
    tx = fx - ix,
    ty = fy - iy;
  const base = (iy * f.columns + ix) * 2,
    next = base + f.columns * 2;
  for (let c = 0; c < 2; c++)
    out[c] =
      (f.grid[base + c] * (1 - tx) + f.grid[base + 2 + c] * tx) * (1 - ty) +
      (f.grid[next + c] * (1 - tx) + f.grid[next + 2 + c] * tx) * ty;
}
// Re-integrate complete ribbons when the field changes, so a drag bends the whole
// painting in the same frame instead of only changing tiny moving tips.
const traceVelocity = new Float32Array(2);
export function reweaveThreadField(f: ThreadField) {
  if (!f.reweave) return;
  for (const p of f.particles) {
    let x = p.x,
      y = p.y;
    p.trail[p.head * 2] = x;
    p.trail[p.head * 2 + 1] = y;
    for (let offset = 3; offset < TRAIL_LENGTH; offset += 3) {
      velocity(f, x, y, traceVelocity);
      const nx = x - traceVelocity[0] * 5.4,
        ny = y - traceVelocity[1] * 5.4;
      for (let step = 1; step <= 3; step++) {
        const index =
          (p.head - offset + 3 - step + TRAIL_LENGTH) % TRAIL_LENGTH;
        p.trail[index * 2] = x + ((nx - x) * step) / 3;
        p.trail[index * 2 + 1] = y + ((ny - y) * step) / 3;
      }
      x = nx;
      y = ny;
    }
    p.length = TRAIL_LENGTH;
  }
  f.reweave = false;
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
      p.color = pigment(p.x, p.y, f.width, f.height, f.random());
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
