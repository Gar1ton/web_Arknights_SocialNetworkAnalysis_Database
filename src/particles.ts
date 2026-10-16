export const TRAIL_LENGTH = 208;
/** Trails keep one sample per tick; heads move continuously between ticks. */
export const TICK_MS = 1000 / 24;
/** Ticks a particle takes to fade in after (re)spawning, and to fade out. */
export const FADE_IN = 26;
export const FADE_OUT = 40;
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
  /** Milliseconds since the last trail sample. */
  clock: number;
  /** Trail samples taken so far; numbers ribbon vertices so they stay put. */
  samples: number;
  /** Speed of the last step, so re-traced trails keep the same spacing. */
  speed: number;
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
    clock: 0,
    samples: 0,
    speed: 0.65,
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
  for (let i = 0; i < count; i++)
    field.particles.push(spawn(field, Math.floor(random() * 180)));
  refreshGrid(field, 1.2);
  return field;
}
function spawn(f: ThreadField, age = 0): ThreadParticle {
  const p: ThreadParticle = {
    trail: new Float32Array(TRAIL_LENGTH * 2),
    head: 0,
    length: 1,
    x: 0,
    y: 0,
    age,
    life: 0,
    color: 0,
  };
  respawn(f, p);
  p.age = age;
  return p;
}
/** Restarts a particle at a random spot, reusing its trail buffer. */
function respawn(f: ThreadField, p: ThreadParticle) {
  p.x = f.random() * f.width;
  p.y = f.random() * f.height;
  p.life = 520 + Math.floor(f.random() * 280);
  p.color = pigment(p.x, p.y, f.width, f.height, f.random());
  p.age = 0;
  p.head = 0;
  p.length = 1;
  p.trail[0] = p.x;
  p.trail[1] = p.y;
}
/**
 * Fits an existing field to a new canvas size. Ribbons are stretched rather
 * than re-seeded, so a resize (or a mobile toolbar sliding away) never
 * replaces the whole painting at once.
 */
export function resizeThreadField(
  f: ThreadField,
  width: number,
  height: number,
  count: number,
) {
  const sx = width / f.width,
    sy = height / f.height;
  if (sx !== 1 || sy !== 1) {
    for (const p of f.particles) {
      p.x *= sx;
      p.y *= sy;
      for (let i = 0; i < p.trail.length; i += 2) {
        p.trail[i] *= sx;
        p.trail[i + 1] *= sy;
      }
    }
    f.width = width;
    f.height = height;
    f.dirty = true;
  }
  if (count < f.particles.length) f.particles.length = count;
  while (f.particles.length < count) f.particles.push(spawn(f));
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
  f.reweave = true;
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
// Re-integrate complete ribbons when the anchors move, so a drag bends the whole
// painting in the same frame instead of only changing tiny moving tips. The slow
// drift of the field itself is left to the trails' own history: re-tracing on
// every refresh made all ribbons snap at once several times a second.
const traceVelocity = new Float32Array(2);
export function reweaveThreadField(f: ThreadField) {
  if (!f.reweave) return;
  // Three samples per segment, spaced like real motion so later samples match.
  const reach = f.speed * 2.1 * 3;
  for (const p of f.particles) {
    let x = p.x,
      y = p.y;
    p.trail[p.head * 2] = x;
    p.trail[p.head * 2 + 1] = y;
    for (let offset = 3; offset < TRAIL_LENGTH; offset += 3) {
      velocity(f, x, y, traceVelocity);
      const nx = x - traceVelocity[0] * reach,
        ny = y - traceVelocity[1] * reach;
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
/** One trail sample: ages particles, records heads and respawns faded ones. */
function sample(f: ThreadField, turbulence: number, gravity: number) {
  if (f.tick % 10 === 0) refreshGrid(f, turbulence, gravity);
  f.tick++;
  f.samples++;
  f.phase += 0.006;
  for (const p of f.particles) {
    if (p.age >= p.life) {
      respawn(f, p);
      continue;
    }
    // A ribbon whose head leaves the canvas fades out instead of vanishing.
    if (
      (p.x < -2 || p.y < -2 || p.x > f.width + 2 || p.y > f.height + 2) &&
      p.life - p.age > FADE_OUT
    )
      p.life = p.age + FADE_OUT;
    p.age++;
    p.head = (p.head + 1) % TRAIL_LENGTH;
    p.trail[p.head * 2] = p.x;
    p.trail[p.head * 2 + 1] = p.y;
    p.length = Math.min(TRAIL_LENGTH, p.length + 1);
  }
}
/** Moves every head by `ticks` (usually a fraction) of one tick's travel. */
function drift(f: ThreadField, ticks: number, speed: number) {
  const reach = speed * 2.1 * ticks;
  for (const p of f.particles) {
    velocity(f, p.x, p.y, traceVelocity);
    p.x += traceVelocity[0] * reach;
    p.y += traceVelocity[1] * reach;
  }
}
/**
 * Advances the field by real elapsed time. Heads glide every frame while the
 * trail still gains one sample per tick, so motion stays even at any refresh
 * rate and ribbons keep the same length.
 */
export function advanceThreadField(
  f: ThreadField,
  elapsed: number,
  speed = 0.65,
  turbulence = 1.2,
  gravity = 1,
) {
  f.speed = speed;
  if (f.dirty) {
    refreshGrid(f, turbulence, gravity);
    f.dirty = false;
  }
  // A long gap (hidden tab, hitch) resumes gently instead of lurching ahead.
  let left = Math.min(Math.max(0, elapsed), TICK_MS * 2);
  while (left > 0) {
    const part = Math.min(left, TICK_MS - f.clock);
    drift(f, part / TICK_MS, speed);
    f.clock += part;
    left -= part;
    if (f.clock >= TICK_MS - 1e-6) {
      f.clock = 0;
      sample(f, turbulence, gravity);
    }
  }
}
/** Exactly one tick of motion followed by one trail sample. */
export function stepThreadField(
  f: ThreadField,
  speed = 0.65,
  turbulence = 1.2,
  gravity = 1,
) {
  f.clock = 0;
  advanceThreadField(f, TICK_MS, speed, turbulence, gravity);
}
type PathSink = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
};
/**
 * Adds one ribbon to a path. Every `stride`-th sample becomes a vertex, chosen
 * by its absolute sample number so vertices never crawl along the curve as the
 * trail grows; the tail end eases toward the next sample between ticks.
 */
export function traceRibbon(
  f: ThreadField,
  p: ThreadParticle,
  path: PathSink,
  stride = 4,
) {
  const t = p.trail,
    n = p.length;
  const oldest = (p.head - n + 1 + TRAIL_LENGTH) % TRAIL_LENGTH;
  let x = t[oldest * 2],
    y = t[oldest * 2 + 1];
  if (n === TRAIL_LENGTH) {
    const next = (oldest + 1) % TRAIL_LENGTH,
      k = f.clock / TICK_MS;
    x += (t[next * 2] - x) * k;
    y += (t[next * 2 + 1] - y) * k;
  }
  path.moveTo(x, y);
  for (let back = n - 2; back > 0; back--) {
    if ((f.samples - back) % stride) continue;
    const i = (p.head - back + TRAIL_LENGTH) % TRAIL_LENGTH;
    path.lineTo(t[i * 2], t[i * 2 + 1]);
  }
  if (n > 1) path.lineTo(t[p.head * 2], t[p.head * 2 + 1]);
  path.lineTo(p.x, p.y);
}
/** 0–1 opacity from fading in after spawn and out before respawn. */
export function particleFade(p: ThreadParticle) {
  return Math.max(0, Math.min(1, p.age / FADE_IN, (p.life - p.age) / FADE_OUT));
}
