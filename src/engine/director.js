// Shot library: vehicle poses, cameras, overlay markers and the base frame state.
// The film (film.js) composes these over time.
import { clamp, lerp, inv, smooth, bump, easeInOut, easeOut } from './math.js';
import { mixCam } from './camera.js';
import {
  K, S_STOP, CHARGER_A, CHARGER_B, LANE, SHOULDER, PARK_S, PROVIDER_START,
  hwPos, hwHeading, at, headingAt,
  ROUTE1, ROUTE2, ROUTE3, ROUTE4, JOBS, OTHER_PROVIDERS, NET_JOBS,
  FIXED_CHARGERS, STRANDED_B, RESCUE_B, TRAFFIC, CHARGERS, GRID,
} from './world.js';
import { US_W, US_H } from '../data/usMap.js';

export const HALF_PI = Math.PI / 2 - 1e-4;
const M_PER_US = 4500; // meters per US-map unit (1000 units ≈ lower-48 width)
const US_ANCHOR = [598, 402]; // where "our" little world sits inside the national map (unnamed, illustrative)

export const C = {
  you: '#f8fafc',
  ring: '#fbbf24',
  prov: '#86efac',
  req: '#fbbf24',
  red: '#f87171',
};

/* ---------------- vehicles ---------------- */
export const latCar = s =>
  s <= S_STOP
    ? LANE + (SHOULDER - LANE) * smooth(S_STOP - 170, S_STOP - 8, s)
    : SHOULDER + (LANE - SHOULDER) * smooth(S_STOP + 8, S_STOP + 130, s);
export function carPose(s) {
  const p = hwPos(s, latCar(s));
  const q = hwPos(s + 1.5, latCar(s + 1.5));
  return { x: p.x, y: p.y, h: Math.atan2(q.x - p.x, q.y - p.y), s };
}
export function routePose(path, s) {
  const p = at(path, s);
  return { x: p.x, y: p.y, h: headingAt(path, s, 3.5) };
}

/* ---------------- cameras ---------------- */
export function chase(pose, v, camYaw = pose.h, o = {}) {
  const P = v.portrait;
  const ahead = P ? 5 : 4;
  return {
    tx: pose.x + Math.sin(camYaw) * ahead,
    ty: pose.y + Math.cos(camYaw) * ahead,
    yaw: camYaw,
    pitch: P ? 0.3 : 0.2,
    dist: P ? 15 : 11,
    oy: P ? 0.6 : 0.56,
    ...o,
  };
}
export const carCam = (s, v, o) => chase(carPose(s), v, hwHeading(s - 6), o);

export function fit(pts, v, o = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]);
  }
  const pad = o.pad ?? 1.3;
  const bw = Math.max(40, (x1 - x0) * pad), bh = Math.max(40, (y1 - y0) * pad);
  const mx = bw / (v.w * (v.portrait ? 0.9 : 0.62)), my = bh / (v.h * (v.portrait ? 0.5 : 0.7));
  const mpp = Math.max(o.cover ? Math.min(mx, my) : Math.max(mx, my), o.minMpp ?? 0);
  return {
    tx: (x0 + x1) / 2 + (v.portrait ? 0 : o.shiftX ?? 0) * bw,
    ty: (y0 + y1) / 2,
    yaw: o.yaw ?? 0,
    pitch: o.pitch ?? HALF_PI,
    dist: mpp * v.F,
    oy: v.portrait ? 0.42 : 0.5,
  };
}

/* ---------------- HUD helpers ---------------- */
export const range = s => Math.max(0, 32 - s / K);
export const mi = m => Math.max(0, m / K);

export function baseState(v) {
  return {
    F: v.F,
    cam: carCam(0, v),
    env: { fade: 0, dim: 0, dawn: 0, dusk: 0, lamps: 1, stars: 1 },
    car: { ...carPose(0), visible: true, head: 1, tail: 1, hazardOn: false, cabin: 0.55 },
    truck: { ...routePose(ROUTE1, 0), visible: false, head: 1, tail: 1, work: 0, hazardOn: false },
    evse: null,
    cable: null,
    overlay: [],
    traffic: [],
    us: null,
    worldA: 1,
    regional: 0,
    hud: {
      illus: 0, rangeA: 0, range: 32, rangeTone: '',
      stripA: 0, stripRange: 32, stripCharger: 27,
      c1A: 0, c1Label: 'NEAREST CHARGER', c1Val: '', c1Tone: '',
      c2A: 0, c2Label: 'CHARGER', c2Val: '', c2Tone: '',
      batA: 0, bat: 0,
      statusA: 0, status: '', statusTone: '', statusBar: -1,
    },
  };
}

export function traffic(s) {
  const out = [];
  for (const b of [900, 1500, 2200, 2800]) {
    const so = b - s;
    if (so - s > -6 && so - s < 480) {
      const p = hwPos(so, -LANE);
      out.push({ x: p.x, y: p.y, oncoming: true });
    }
  }
  const sa = 70 + s * 1.28;
  if (s < 1300 && sa - s < 600) {
    const p = hwPos(sa, LANE);
    out.push({ x: p.x, y: p.y, oncoming: false });
  }
  return out;
}

/** Sunset → night. k = 1 golden hour, 0 full night. Streetlights come on as it gets dark. */
export function dusk(st, k) {
  st.env.dusk = k;
  st.env.sunYaw = 0.32;
  st.env.sunUp = lerp(-0.03, 0.05, k);
  st.env.lamps = 0.35 + 0.65 * (1 - smooth(0.4, 1, k));
  st.env.stars = 1 - smooth(0.1, 0.6, k);
}

export const blink = time => time % 0.9 < 0.48;

export function stranded(st, time) {
  const car = st.car;
  Object.assign(car, carPose(S_STOP), { head: 0.12, tail: 0.3, hazardOn: blink(time), cabin: 0.08 });
}

export function youDot(p, a, time) {
  return [
    { type: 'dot', x: p.x, y: p.y, r: 4.5, color: C.you, ring: C.ring, pulse: true, a, glow: 'white' },
    { type: 'label', x: p.x, y: p.y, text: 'YOU', a: a * 0.9, color: '#f8fafc', dx: 14, dy: -1 },
  ];
}
export function provDot(p, a, label = 'PROVIDER') {
  return [
    { type: 'dot', x: p.x, y: p.y, r: 5, color: C.prov, stroke: '#052e16', a, glow: 'mint' },
    label ? { type: 'label', x: p.x, y: p.y, text: label, a: a * 0.9, color: C.prov, dx: 14 } : null,
  ];
}
export function chargerPins(a) {
  if (a <= 0) return [];
  const A = CHARGERS[0], B = CHARGERS[1];
  return [
    { type: 'charger', x: A.x, y: A.y, status: 'ok', a, r: 6 },
    { type: 'label', x: A.x, y: A.y, text: 'NEAREST WORKING CHARGER', a: a * 0.7, size: 10, color: '#cbd5d0', dx: 14 },
    { type: 'charger', x: B.x, y: B.y, status: 'out', a, r: 5 },
    { type: 'label', x: B.x, y: B.y, text: 'OUT OF SERVICE', a: a * 0.7, size: 10, color: C.red, dx: 14 },
  ];
}

/* ---------------- scene cameras reused across boundaries ---------------- */
export const camStopped = (v, k) => {
  const c = carCam(S_STOP, v);
  return { ...c, pitch: lerp(c.pitch, v.portrait ? 0.46 : 0.38, k), dist: lerp(c.dist, v.portrait ? 22 : 18, k) };
};
export const camMatch = v => fit([[carPose(S_STOP).x, S_STOP + 60], PROVIDER_START, [CHARGERS[0].x, CHARGERS[0].y - 400]], v, { shiftX: -0.12 });
export function camMoving(t, v) {
  const sp = ROUTE1.len * 0.965 * t;
  const p = at(ROUTE1, sp);
  const car = carPose(S_STOP);
  const tight = smooth(0.55, 1, t);
  const m = fit([[p.x, p.y], [car.x, car.y]], v, { pad: lerp(1.5, 2.6, tight), minMpp: lerp(0.4, 0.55, tight) * (v.portrait ? 1.3 : 1) });
  const base = mixCam(camMatch(v), m, smooth(0, 0.25, t));
  return { ...base, pitch: lerp(HALF_PI, 1.02, smooth(0.62, 1, t)), yaw: lerp(0, hwHeading(S_STOP), smooth(0.62, 1, t)) };
}
export function camArrive(v) {
  const h = hwHeading(S_STOP);
  const p = hwPos(S_STOP - 4.2, SHOULDER + 0.9);
  // portrait looks along the shoulder so truck → charger → car stack vertically
  return { tx: p.x, ty: p.y, tz: 0.75, yaw: h - (v.portrait ? 0.62 : 1.3), pitch: v.portrait ? 0.26 : 0.13, dist: v.portrait ? 15 : 9.5, oy: v.portrait ? 0.58 : 0.56 };
}
export function camOrbit(v, k) {
  const a = camArrive(v);
  const h = hwHeading(S_STOP);
  const c = hwPos(S_STOP + 0.6, SHOULDER);
  return {
    ...a,
    tx: lerp(a.tx, c.x, k),
    ty: lerp(a.ty, c.y, k),
    tz: lerp(0.75, 0.7, k),
    yaw: lerp(h - (v.portrait ? 0.62 : 1.3), h - (v.portrait ? 2.55 : 2.45), k),
    dist: lerp(a.dist, v.portrait ? 12 : 8.6, k),
    pitch: lerp(a.pitch, v.portrait ? 0.2 : 0.12, k),
  };
}
const BECOME_BOX = [[-2900, 1000], [2300, 1000], [-2900, 4900], [2300, 4900]];
const camBecome = (v, t) => {
  const c = fit(BECOME_BOX, v, { pad: 1.0, shiftX: -0.12, cover: true });
  return { ...c, dist: c.dist * (1 + 0.12 * t) };
};
const CITY = [[-2900, 500], [2500, 500], [-2900, 5700], [2500, 5700]];
const camCity = v => fit(CITY, v, { pad: 1.0, shiftX: -0.12, cover: true });
export function usFitDist(v) {
  const s = Math.min((v.w * (v.portrait ? 0.94 : 0.8)) / US_W, (v.h * (v.portrait ? 0.46 : 0.66)) / US_H);
  return (M_PER_US * v.F) / s;
}

