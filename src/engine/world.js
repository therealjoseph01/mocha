// The world: one flat plane of roads, seen by a single orbit camera.
// Units are meters. North = +y. Heading h: forward = (sin h, cos h).
// All distances here are ART DIRECTION, not geography. Narrative miles are
// mapped onto the road with K so the HUD numbers stay internally consistent.
import { rng, smooth } from './math.js';

export const K = 80; // world meters per illustrative "mile"
export const S_STOP = 32 * K; // where the car runs out (range 32 → 0)
export const CHARGER_A = 14 * K + 27 * K; // at range 18 the nearest charger is 27 "mi" away
export const CHARGER_B = 25 * K; // an out-of-service charger the car passes
export const LANE = 1.8; // lane center offset
export const SHOULDER = 4.7; // shoulder offset
export const GRID = 400;

/* ---------------- paths ---------------- */
export function makePath(pts) {
  const n = pts.length;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, cum, len: cum[n - 1] };
}
export function at(path, s) {
  const { pts, cum, len } = path;
  const n = pts.length;
  if (s <= 0) {
    const h = Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    return { x: pts[0][0] + Math.sin(h) * s, y: pts[0][1] + Math.cos(h) * s, h };
  }
  if (s >= len) {
    const h = Math.atan2(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
    return { x: pts[n - 1][0], y: pts[n - 1][1], h };
  }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= s) lo = m;
    else hi = m;
  }
  const a = pts[lo], b = pts[hi];
  const u = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
/** Smoothed heading: average tangent over a window, so vehicles don't snap at corners. */
export function headingAt(path, s, win = 6) {
  const a = at(path, s - win), b = at(path, s + win);
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return at(path, s).h;
  return Math.atan2(b.x - a.x, b.y - a.y);
}

/* ---------------- highway ---------------- */
export const hwX = y => 90 * Math.sin(y / 620) + 38 * Math.sin(y / 233 + 1.3) - 38 * Math.sin(1.3);
const hwPts = [];
for (let y = -2400; y <= 9200; y += 6) hwPts.push([hwX(y), y]);
export const HW = makePath(hwPts);
const HW_OFF = HW.cum[400]; // y = 0 at index 400
export const hw = s => at(HW, HW_OFF + s);
export const hwHeading = s => headingAt(HW, HW_OFF + s, 5);
export function hwPos(s, lat = LANE) {
  const p = hw(s);
  const h = hwHeading(s);
  return { x: p.x + Math.cos(h) * lat, y: p.y - Math.sin(h) * lat, h };
}
export function hwSAtY(y) {
  const i = Math.round((y + 2400) / 6);
  return HW.cum[Math.max(0, Math.min(HW.pts.length - 1, i))] - HW_OFF;
}

/* ---------------- street grid (map + road level) ---------------- */
export const ROADS = [];
ROADS.push({ kind: 'hw', path: HW, hw: 6.4 });
const vx = [];
for (let x = -6000; x <= 5600; x += GRID) if (Math.abs(x) >= 400) vx.push(x);
for (const x of vx) ROADS.push({ kind: 'st', path: makePath([[x, -3200], [x, 9200]]), hw: 4, core: x >= -2800 && x <= 2400 });
for (let y = -3200; y <= 9200; y += GRID) ROADS.push({ kind: 'st', path: makePath([[-6000, y], [5600, y]]), hw: 4, core: y >= -800 && y <= 6400 });

// Regional roads + satellite towns — only fade in when zoomed far out.
export const REGIONAL = [];
{
  const r = rng(11);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI + r() * 0.3;
    const pts = [];
    const cx = (r() - 0.5) * 50000, cy = 2600 + (r() - 0.5) * 50000;
    for (let t = -60000; t <= 60000; t += 1500) {
      const w = Math.sin(t / 9000 + i) * 1800;
      pts.push([cx + Math.cos(a) * t - Math.sin(a) * w, cy + Math.sin(a) * t + Math.cos(a) * w]);
    }
    REGIONAL.push(pts);
  }
  for (let i = 0; i < 14; i++) {
    const ang = r() * Math.PI * 2, d = 9000 + r() * 30000;
    const cx = Math.cos(ang) * d, cy = 2600 + Math.sin(ang) * d;
    const n = 2 + Math.floor(r() * 3), sp = 300;
    for (let k = 0; k <= n; k++) {
      REGIONAL.push([[cx - (n * sp) / 2, cy - (n * sp) / 2 + k * sp], [cx + (n * sp) / 2, cy - (n * sp) / 2 + k * sp]]);
      REGIONAL.push([[cx - (n * sp) / 2 + k * sp, cy - (n * sp) / 2], [cx - (n * sp) / 2 + k * sp, cy + (n * sp) / 2]]);
    }
  }
}
export const TOWNS_FAR = [];
{
  const r = rng(12);
  for (let i = 0; i < 90; i++) {
    const ang = r() * Math.PI * 2, d = 4000 + r() * 42000;
    TOWNS_FAR.push([Math.cos(ang) * d, 2600 + Math.sin(ang) * d]);
  }
}

/* ---------------- roadside objects ---------------- */
export const LAMPS = []; // {x,y,h:height, s?}
{
  const add = (s, side) => {
    const p = hwPos(s, side * 8.4);
    LAMPS.push({ x: p.x, y: p.y, z: 8.5, s, arm: -side });
  };
  let side = 1;
  for (let s = -400; s < 1700; s += 58) add(s, (side = -side));
  for (let s = 1700; s < 2160; s += 125) add(s, (side = -side));
  for (let s = 2980; s < 6400; s += s < 3600 ? 70 : 96) add(s, (side = -side));
  // town streets (lit) around the provider's start and the east neighborhood
  const town = (x0, x1, y0, y1) => {
    for (let y = Math.ceil(y0 / GRID) * GRID; y <= y1; y += GRID)
      for (let x = x0; x <= x1; x += 85) LAMPS.push({ x, y: y + 6.5, z: 7, town: true });
    for (let x = Math.ceil(x0 / GRID) * GRID; x <= x1; x += GRID)
      if (Math.abs(x) >= 400) for (let y = y0; y <= y1; y += 85) LAMPS.push({ x: x + 6.5, y, z: 7, town: true });
  };
  town(-2000, -420, 800, 2000);
  town(420, 2000, 2800, 4000);
}

export const CHARGERS = [
  { ...hwPos(CHARGER_A, 17), status: 'ok', s: CHARGER_A },
  { ...hwPos(CHARGER_B, 11.5), status: 'out', s: CHARGER_B },
];

export const TREES = [];
{
  const r = rng(3);
  for (let i = 0; i < 520; i++) {
    const s = -300 + r() * 6600;
    const side = r() < 0.5 ? -1 : 1;
    let lat = side * (16 + Math.pow(r(), 1.6) * 150);
    if (s > S_STOP - 120 && s < S_STOP + 80 && lat > 0 && lat < 60) continue; // keep the rescue sightline clear
    if (Math.abs(s - CHARGER_A) < 60 && lat > 0) continue;
    const p = hwPos(s, lat);
    TREES.push({ x: p.x, y: p.y, z: 5 + r() * 9, w: 2 + r() * 2.6 });
  }
}

export const HOUSES = [];
{
  const r = rng(5);
  const town = (x0, x1, y0, y1) => {
    for (let y = Math.ceil(y0 / GRID) * GRID; y <= y1; y += GRID)
      for (let x = x0; x <= x1; x += 48)
        for (const side of [-1, 1]) {
          if (r() < 0.25) continue;
          const w = 9 + r() * 6, d = 9 + r() * 5, hgt = 4 + r() * 3.5;
          HOUSES.push({ x: x + (r() - 0.5) * 8, y: y + side * (20 + d / 2), w, d, z: hgt, lit: r() < 0.55 });
        }
  };
  town(-2000, -440, 800, 2000);
  town(440, 2000, 2800, 4000);
}

export const FIELDS = [];
{
  const r = rng(9);
  for (let i = 0; i < 420; i++) {
    const x = -6200 + r() * 12000, y = -3400 + r() * 12800;
    const w = 90 + r() * 260, d = 90 + r() * 260;
    if (Math.abs(x - hwX(y)) < w / 2 + 24) continue;
    FIELDS.push({ x, y, w, d, a: r() * 0.35, shade: r() });
  }
}

/* ---------------- routes ---------------- */
export const PROVIDER_START = [-1200, 1200];
export const PARK_S = S_STOP - 9.5; // provider parks behind the stranded car
// Route 1: town street → highway → shoulder behind the stranded EV
export const ROUTE1 = (() => {
  const sJoin = hwSAtY(1200);
  const join = hwPos(sJoin, LANE);
  const pts = [PROVIDER_START, [join.x - 30, 1200], [join.x - 6, 1204], [join.x, 1215]];
  const seg = [];
  for (let s = sJoin + 20; s <= PARK_S; s += 10) {
    const lat = LANE + (SHOULDER - LANE) * smooth(PARK_S - 110, PARK_S - 20, s);
    const p = hwPos(s, lat);
    seg.push([p.x, p.y]);
  }
  const end = hwPos(PARK_S, SHOULDER);
  seg.push([end.x, end.y]);
  return makePath(pts.concat(seg));
})();

const via = pts => makePath(pts);
// Route 2: pull off the shoulder, north, then east into the neighborhood
export const ROUTE2 = (() => {
  const sY = hwSAtY(3200);
  const a = [];
  for (let s = PARK_S; s <= sY; s += 10) {
    const lat = SHOULDER + (LANE - SHOULDER) * smooth(PARK_S, PARK_S + 60, s);
    const p = hwPos(s, lat);
    a.push([p.x, p.y]);
  }
  const j = hwPos(sY, LANE);
  return via(a.concat([[j.x + 8, 3200], [1200, 3200], [1200, 3600]]));
})();
export const ROUTE3 = via([[1200, 3600], [-1600, 3600], [-1600, 4000]]);
export const ROUTE4 = via([[-1600, 4000], [-1600, 2400], [-800, 2400]]);
export const JOBS = [
  [1200, 3600],
  [-1600, 4000],
  [-800, 2400],
];
export const OTHER_PROVIDERS = [
  { route: via([[2000, 1600], [2000, 2800], [800, 2800]]), t0: 0.18, t1: 0.42 },
  { route: via([[-2400, 4800], [-800, 4800], [-800, 4400]]), t0: 0.3, t1: 0.52 },
  { route: via([[800, 5200], [800, 4400], [2000, 4400]]), t0: 0.44, t1: 0.66 },
  { route: via([[-2000, 400], [-2000, 1600], [-400, 1600]]), t0: 0.52, t1: 0.76 },
  { route: via([[1600, 400], [1600, 1200], [800, 1200]]), t0: 0.62, t1: 0.86 },
  { route: via([[-2800, 2800], [-2800, 3200], [-2000, 3200]]), t0: 0.7, t1: 0.9 },
];

// Network zoom: procedural requests + nearby providers (illustrative only).
export const NET_JOBS = [];
{
  const r = rng(21);
  for (let i = 0; i < 150; i++) {
    const far = i > 50;
    let x, y;
    if (!far) {
      x = (Math.round((r() * 5200 - 2800) / GRID) * GRID) | 0;
      y = Math.round((r() * 7000 - 600) / GRID) * GRID;
      if (Math.abs(x) < 400) x = 800;
    } else {
      const t = TOWNS_FAR[Math.floor(r() * TOWNS_FAR.length)];
      x = t[0] + (r() - 0.5) * 1500;
      y = t[1] + (r() - 0.5) * 1500;
    }
    const d = Math.hypot(x + 200, y - 3000);
    const ang = r() * Math.PI * 2, pd = far ? 900 + r() * 2500 : 500 + r() * 900;
    NET_JOBS.push({ x, y, px: x + Math.cos(ang) * pd, py: y + Math.sin(ang) * pd, d, ph: r() });
  }
  NET_JOBS.sort((a, b) => a.d - b.d);
}

// "Fixed vs moving" scene
export const FIXED_CHARGERS = [
  [-2400, 1600], [-1600, 4800], [2000, 5200], [2000, 800], [-400, 5600], [-2800, 3600],
];
export const STRANDED_B = [1200, 2800];
export const RESCUE_B = via([[400, 2000], [400, 2800], [1200, 2800]]);
export const TRAFFIC = [];
{
  const r = rng(31);
  for (let i = 0; i < 70; i++) {
    const vertical = r() < 0.5;
    const line = vertical ? vx.filter(x => x >= -2800 && x <= 2400)[Math.floor(r() * 12)] : -800 + Math.floor(r() * 18) * GRID;
    TRAFFIC.push({ vertical, line, off: r(), speed: (0.012 + r() * 0.02) * (r() < 0.5 ? -1 : 1) });
  }
}
