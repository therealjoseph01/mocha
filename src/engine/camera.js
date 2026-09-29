// Orbit camera over a flat world. One projection covers everything:
// chase view (pitch ≈ 11°), road → map (pitch → 90°), and national zoom (huge distance).
import { lerp, angLerp } from './math.js';

export const NEAR = 0.6;

export function camera(c, w, h) {
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const px = c.tx - sy * c.dist * cp;
  const py = c.ty - cy * c.dist * cp;
  const pz = (c.tz || 0) + c.dist * sp;
  const fx = sy * cp, fy = cy * cp, fz = -sp; // forward
  const rx = cy, ry = -sy; // right (rz = 0)
  const ux = sy * sp, uy = cy * sp, uz = cp; // up
  const F = c.F;
  const ox = w / 2, oy = h * (c.oy ?? 0.5);
  const cam = {
    px, py, pz, F, ox, oy, w, h, yaw: c.yaw, pitch: c.pitch, dist: c.dist,
    /** world → camera space [x, y, depth] */
    toCam(x, y, z = 0) {
      const vx = x - px, vy = y - py, vz = z - pz;
      return [vx * rx + vy * ry, vx * ux + vy * uy + vz * uz, vx * fx + vy * fy + vz * fz];
    },
    toScreen(c3) {
      const k = F / c3[2];
      return [ox + c3[0] * k, oy - c3[1] * k];
    },
    project(x, y, z = 0) {
      const vx = x - px, vy = y - py, vz = z - pz;
      const d = vx * fx + vy * fy + vz * fz;
      if (d < NEAR) return null;
      const k = F / d;
      return [ox + (vx * rx + vy * ry) * k, oy - (vx * ux + vy * uy + vz * uz) * k, d];
    },
    /** meters → pixels at a given depth */
    scale(d) {
      return F / d;
    },
    horizonY() {
      if (cp < 0.02) return -1e6;
      return oy - (sp / cp) * F;
    },
    // horizontal basis for ground-aligned sprites
    fwd: [sy, cy],
    right: [cy, -sy],
  };
  return cam;
}

/** Sutherland–Hodgman against the near plane, in camera space. */
export function clipNear(poly) {
  const out = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out;
}

/** Blend two camera states — distance blends in log space so zooms feel physical. */
export function mixCam(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  // Zooming out: keep the subject framed until we're high enough, then drift.
  // Zooming in: arrive over the subject first, then descend.
  const r = Math.log(b.dist / a.dist);
  const k = 1 + Math.min(2.2, Math.abs(r) * 0.45);
  const tt = r > 0 ? Math.pow(t, k) : 1 - Math.pow(1 - t, k);
  return {
    tx: lerp(a.tx, b.tx, tt),
    ty: lerp(a.ty, b.ty, tt),
    tz: lerp(a.tz || 0, b.tz || 0, t),
    yaw: angLerp(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
    dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t)),
    oy: lerp(a.oy ?? 0.5, b.oy ?? 0.5, t),
  };
}
