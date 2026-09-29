// The director turns scroll position (scene index + local progress) into a full frame state.
// Each scene's end state is the next scene's start state, so the film never cuts.
import { clamp, lerp, inv, smooth, bump, easeInOut, easeOut } from './math.js';
import { mixCam } from './camera.js';
import {
  K, S_STOP, CHARGER_A, CHARGER_B, LANE, SHOULDER, PARK_S, PROVIDER_START,
  hwPos, hwHeading, at, headingAt,
  ROUTE1, ROUTE2, ROUTE3, ROUTE4, JOBS, OTHER_PROVIDERS, NET_JOBS,
  FIXED_CHARGERS, STRANDED_B, RESCUE_B, TRAFFIC, CHARGERS, GRID,
} from './world.js';
import { US_W, US_H } from '../data/usMap.js';
import { SCENES } from '../scenes.js';

const HALF_PI = Math.PI / 2 - 1e-4;
const M_PER_US = 4500; // meters per US-map unit (1000 units ≈ lower-48 width)
const US_ANCHOR = [598, 402]; // where "our" little world sits inside the national map (unnamed, illustrative)

const C = {
  you: '#f8fafc',
  ring: '#fbbf24',
  prov: '#86efac',
  req: '#fbbf24',
  red: '#f87171',
};

/* ---------------- vehicles ---------------- */
const latCar = s =>
  s <= S_STOP
    ? LANE + (SHOULDER - LANE) * smooth(S_STOP - 170, S_STOP - 8, s)
    : SHOULDER + (LANE - SHOULDER) * smooth(S_STOP + 8, S_STOP + 130, s);
function carPose(s) {
  const p = hwPos(s, latCar(s));
  const q = hwPos(s + 1.5, latCar(s + 1.5));
  return { x: p.x, y: p.y, h: Math.atan2(q.x - p.x, q.y - p.y), s };
}
function routePose(path, s) {
  const p = at(path, s);
  return { x: p.x, y: p.y, h: headingAt(path, s, 3.5) };
}

/* ---------------- cameras ---------------- */
function chase(pose, v, camYaw = pose.h, o = {}) {
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
const carCam = (s, v, o) => chase(carPose(s), v, hwHeading(s - 6), o);

function fit(pts, v, o = {}) {
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
const range = s => Math.max(0, 32 - s / K);
const mi = m => Math.max(0, m / K);

function baseState(v) {
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

function traffic(s) {
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
function dusk(st, k) {
  st.env.dusk = k;
  st.env.sunYaw = 0.32;
  st.env.sunUp = lerp(-0.03, 0.05, k);
  st.env.lamps = 0.35 + 0.65 * (1 - smooth(0.4, 1, k));
  st.env.stars = 1 - smooth(0.1, 0.6, k);
}

const blink = time => time % 0.9 < 0.48;

function stranded(st, time) {
  const car = st.car;
  Object.assign(car, carPose(S_STOP), { head: 0.12, tail: 0.3, hazardOn: blink(time), cabin: 0.08 });
}

function youDot(p, a, time) {
  return [
    { type: 'dot', x: p.x, y: p.y, r: 4.5, color: C.you, ring: C.ring, pulse: true, a, glow: 'white' },
    { type: 'label', x: p.x, y: p.y, text: 'YOU', a: a * 0.9, color: '#f8fafc', dx: 14, dy: -1 },
  ];
}
function provDot(p, a, label = 'PROVIDER') {
  return [
    { type: 'dot', x: p.x, y: p.y, r: 5, color: C.prov, stroke: '#052e16', a, glow: 'mint' },
    label ? { type: 'label', x: p.x, y: p.y, text: label, a: a * 0.9, color: C.prov, dx: 14 } : null,
  ];
}
function chargerPins(a) {
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
const camStopped = (v, k) => {
  const c = carCam(S_STOP, v);
  return { ...c, pitch: lerp(c.pitch, v.portrait ? 0.46 : 0.38, k), dist: lerp(c.dist, v.portrait ? 22 : 18, k) };
};
const camMatch = v => fit([[carPose(S_STOP).x, S_STOP + 60], PROVIDER_START, [CHARGERS[0].x, CHARGERS[0].y - 400]], v, { shiftX: -0.12 });
function camMoving(t, v) {
  const sp = ROUTE1.len * 0.965 * t;
  const p = at(ROUTE1, sp);
  const car = carPose(S_STOP);
  const tight = smooth(0.55, 1, t);
  const m = fit([[p.x, p.y], [car.x, car.y]], v, { pad: lerp(1.5, 2.6, tight), minMpp: lerp(0.4, 0.55, tight) * (v.portrait ? 1.3 : 1) });
  const base = mixCam(camMatch(v), m, smooth(0, 0.25, t));
  return { ...base, pitch: lerp(HALF_PI, 1.02, smooth(0.62, 1, t)), yaw: lerp(0, hwHeading(S_STOP), smooth(0.62, 1, t)) };
}
function camArrive(v) {
  const h = hwHeading(S_STOP);
  const p = hwPos(S_STOP - 4.2, SHOULDER + 0.9);
  // portrait looks along the shoulder so truck → charger → car stack vertically
  return { tx: p.x, ty: p.y, tz: 0.75, yaw: h - (v.portrait ? 0.62 : 1.3), pitch: v.portrait ? 0.26 : 0.13, dist: v.portrait ? 15 : 9.5, oy: v.portrait ? 0.58 : 0.56 };
}
function camOrbit(v, k) {
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
function usFitDist(v) {
  const s = Math.min((v.w * (v.portrait ? 0.94 : 0.8)) / US_W, (v.h * (v.portrait ? 0.46 : 0.66)) / US_H);
  return (M_PER_US * v.F) / s;
}

/* ================================================================== */
export function direct(T, v, time) {
  const st = baseState(v);
  const n = SCENES.length;
  const i = clamp(Math.floor(T), 0, n - 1);
  const t = clamp(T - i, 0, 1);
  const id = SCENES[i].id;
  const hud = st.hud;
  st.scene = id;
  st.t = t;

  switch (id) {
    case 'road': {
      const s = 640 * t;
      Object.assign(st.car, carPose(s));
      // Land on golden hour, not a black screen: the light fades as the range does.
      const intro = easeInOut(smooth(0, 0.45, t));
      const c = carCam(s, v);
      st.cam = { ...c, pitch: lerp(v.portrait ? 0.34 : 0.26, c.pitch, intro), dist: lerp(v.portrait ? 26 : 22, c.dist, intro) };
      dusk(st, lerp(1, 0.78, t));
      st.traffic = traffic(s);
      hud.illus = hud.rangeA = smooth(0.14, 0.24, t);
      hud.range = range(s);
      break;
    }
    case 'wrong': {
      const s = 640 + 1200 * t;
      Object.assign(st.car, carPose(s));
      st.cam = carCam(s, v);
      dusk(st, lerp(0.78, 0.12, easeInOut(t)));
      st.traffic = traffic(s);
      hud.illus = hud.rangeA = 1;
      hud.range = range(s);
      const r = range(s);
      hud.c1A = smooth(18.4, 17.9, r) ;
      hud.c1Val = `${Math.ceil(mi(CHARGER_A - s) - 1e-6)} MI`;
      hud.c1Tone = 'warn';
      hud.stripA = hud.c1A;
      hud.stripRange = r;
      hud.stripCharger = mi(CHARGER_A - s);
      const dB = mi(CHARGER_B - s);
      hud.c2A = smooth(12.4, 11.9, r);
      hud.c2Val = dB < 2.6 ? `${Math.max(1, Math.ceil(dB - 1e-6))} MI · OUT OF SERVICE` : `${Math.ceil(dB - 1e-6)} MI`;
      hud.c2Tone = dB < 2.6 ? 'bad' : '';
      if (r < 13) hud.rangeTone = 'warn';
      break;
    }
    case 'anxiety': {
      let s;
      if (t < 0.6) s = 1840 + (S_STOP - K - 1840) * (t / 0.6);
      else if (t < 0.8) {
        const u = (t - 0.6) / 0.2;
        s = S_STOP - K + K * (1 - Math.pow(1 - u, 2.67));
      } else s = S_STOP;
      Object.assign(st.car, carPose(s));
      const off = smooth(0.8, 0.9, t);
      st.car.head = 1 - 0.88 * off;
      st.car.tail = 1 - 0.7 * off;
      st.car.cabin = 0.55 - 0.47 * off;
      st.car.hazardOn = t > 0.84 && blink(time);
      st.cam = carCam(Math.min(s, S_STOP), v);
      dusk(st, lerp(0.12, 0, smooth(0, 0.35, t)));
      const r = range(s);
      hud.illus = 1;
      hud.rangeA = 1;
      hud.range = t >= 0.8 ? 0 : Math.max(1, r);
      hud.rangeTone = r < 5 ? 'bad' : 'warn';
      hud.c1A = 1 - 0.5 * off;
      hud.c1Val = `${Math.ceil(mi(CHARGER_A - s) - 1e-6)} MI`;
      hud.c1Tone = 'warn';
      hud.stripA = 1 - off;
      hud.stripRange = r;
      hud.stripCharger = mi(CHARGER_A - s);
      const dB = mi(CHARGER_B - s);
      hud.c2A = dB > -0.4 ? 1 : smooth(-1.2, -0.4, dB);
      hud.c2Val = dB > 0.3 ? `${Math.max(1, Math.round(dB))} MI · OUT OF SERVICE` : 'OUT OF SERVICE';
      hud.c2Tone = 'bad';
      break;
    }
    case 'quiet': {
      stranded(st, time);
      st.cam = carCam(S_STOP, v);
      st.env.dim = 0.18 * smooth(0.1, 0.4, t);
      hud.illus = 1 - smooth(0.7, 1, t);
      hud.rangeA = 1 - smooth(0.7, 1, t);
      hud.range = 0;
      hud.rangeTone = 'bad';
      hud.c1A = 0.5 * (1 - smooth(0.6, 0.9, t));
      hud.c1Val = `${Math.round(mi(CHARGER_A - S_STOP))} MI`;
      hud.c1Tone = 'warn';
      break;
    }
    case 'mocha': {
      stranded(st, time);
      st.cam = camStopped(v, easeInOut(t));
      st.env.dim = lerp(0.18, 0.55, smooth(0.18, 0.4, t));
      break;
    }
    case 'map': {
      stranded(st, time);
      const u = easeInOut(smooth(0.02, 0.62, t));
      st.cam = mixCam(camStopped(v, 1), camMatch(v), u);
      st.env.dim = lerp(0.55, 0, smooth(0, 0.35, t));
      Object.assign(st.truck, routePose(ROUTE1, 0), { visible: true, head: 1, tail: 1 });
      const car = st.car;
      st.overlay = [
        ...chargerPins(smooth(0.5, 0.6, t) * 0.8),
        ...youDot(car, smooth(0.26, 0.4, t), time),
        { type: 'route', path: ROUTE1, s0: 0, s1: ROUTE1.len * smooth(0.72, 0.88, t), a: smooth(0.72, 0.76, t), color: 'rgba(134,239,172,0.85)', w: 2.2, dash: [2, 7] },
        ...provDot(st.truck, smooth(0.6, 0.66, t) * (1 + 0 * t)),
        { type: 'dot', x: st.truck.x, y: st.truck.y, r: 5, color: C.prov, pulse: true, ring: C.prov, a: bump(t, 0.6, 0.64, 0.74, 0.8) },
      ];
      hud.statusA = smooth(0.74, 0.8, t);
      hud.status = 'Matched with a nearby provider';
      hud.statusTone = 'ok';
      break;
    }
    case 'moving': {
      stranded(st, time);
      const sp = ROUTE1.len * 0.965 * t;
      Object.assign(st.truck, routePose(ROUTE1, sp), { visible: true });
      const mapC = camMoving(t, v);
      const w = bump(t, 0.3, 0.4, 0.54, 0.64);
      const tr = st.truck;
      const trYaw = headingAt(ROUTE1, Math.max(0, sp - 10), 14);
      const chaseC = chase(tr, v, trYaw, { dist: v.portrait ? 17 : 13, pitch: v.portrait ? 0.3 : 0.21 });
      st.cam = mixCam(mapC, chaseC, easeInOut(w));
      const a = 1 - smooth(0.25, 0.36, t) + smooth(0.58, 0.68, t);
      st.overlay = [
        ...chargerPins(0.6 * clamp(a) * (1 - smooth(0.7, 0.9, t))),
        { type: 'route', path: ROUTE1, s0: sp, s1: ROUTE1.len, a: clamp(a), color: 'rgba(134,239,172,0.85)', w: 2.2, dash: [2, 7] },
        ...youDot(st.car, clamp(a), time),
        ...provDot(tr, clamp(a)),
      ];
      hud.statusA = 1;
      hud.status = 'Provider en route';
      hud.statusTone = 'ok';
      hud.statusBar = sp / ROUTE1.len;
      break;
    }
    case 'arrival': {
      stranded(st, time);
      const u = easeOut(smooth(0, 0.42, t));
      const sp = ROUTE1.len * lerp(0.965, 1, u);
      Object.assign(st.truck, routePose(ROUTE1, sp), { visible: true });
      const parked = smooth(0.4, 0.5, t);
      st.truck.head = 1 - 0.85 * parked;
      st.truck.work = parked;
      st.truck.hazardOn = t > 0.46 && blink(time + 0.2);
      st.cam = mixCam(camMoving(1, v), camArrive(v), easeInOut(smooth(0, 0.46, t)));
      const a = 1 - smooth(0, 0.2, t);
      st.overlay = [...youDot(st.car, a, time), ...provDot(st.truck, a, null)];
      const e = hwPos(S_STOP - 4.6, SHOULDER + 1.7);
      st.evse = { x: e.x, y: e.y, h: e.h, on: smooth(0.48, 0.56, t) };
      st.cable = { p: smooth(0.55, 0.73, t), flow: 0, connected: smooth(0.73, 0.77, t) };
      hud.statusA = 1;
      hud.status = t > 0.74 ? 'Connected' : 'Provider arriving';
      hud.statusTone = 'ok';
      hud.statusBar = t > 0.74 ? -1 : lerp(0.965, 1, u);
      hud.batA = smooth(0.75, 0.85, t);
      hud.bat = 0;
      break;
    }
    case 'power': {
      Object.assign(st.car, carPose(S_STOP));
      const b = smooth(0.05, 0.75, t);
      st.car.head = lerp(0.12, 1, smooth(0.12, 0.6, t));
      st.car.tail = lerp(0.3, 1, smooth(0.1, 0.4, t));
      st.car.cabin = smooth(0.06, 0.3, t) * 0.85;
      st.car.hazardOn = blink(time);
      Object.assign(st.truck, routePose(ROUTE1, ROUTE1.len), { visible: true, head: 0.15, work: 1, hazardOn: blink(time + 0.2) });
      st.cam = camOrbit(v, easeInOut(smooth(0, 0.85, t)));
      const e = hwPos(S_STOP - 4.6, SHOULDER + 1.7);
      st.evse = { x: e.x, y: e.y, h: e.h, on: 1 - smooth(0.93, 0.99, t) };
      st.cable = { p: 1 - smooth(0.82, 0.92, t), flow: smooth(0.03, 0.1, t) * (1 - smooth(0.76, 0.8, t)), connected: 1 - smooth(0.8, 0.83, t) };
      hud.batA = 1;
      hud.bat = 12 * b;
      hud.illus = 1;
      hud.statusA = 1 - smooth(0.9, 0.98, t);
      hud.status = t < 0.8 ? 'Charging' : 'Disconnected';
      hud.statusTone = 'ok';
      break;
    }
    case 'back': {
      const k = inv(0.06, 1, t);
      const s = S_STOP + 420 * Math.pow(k, 1.65);
      Object.assign(st.car, carPose(s), { head: 1, tail: 1, cabin: 0.85, hazardOn: t < 0.06 && blink(time) });
      Object.assign(st.truck, routePose(ROUTE1, ROUTE1.len), { visible: true, head: 0.15, work: lerp(1, 0.3, smooth(0.2, 0.6, t)), hazardOn: blink(time + 0.2) });
      st.cam = mixCam(camOrbit(v, 1), carCam(s, v), easeInOut(smooth(0.02, 0.5, t)));
      st.traffic = [];
      const so = 3300 - (s - S_STOP) * 1.2;
      if (so - s < 420 && so - s > -5) { const p = hwPos(so, -LANE); st.traffic.push({ x: p.x, y: p.y, oncoming: true }); }
      hud.illus = 1;
      hud.batA = 1 - smooth(0.5, 0.7, t);
      hud.bat = 12;
      hud.c1A = smooth(0.25, 0.35, t) * (1 - smooth(0.85, 1, t));
      hud.c1Label = 'NEXT CHARGER';
      hud.c1Val = `${Math.max(0, Math.round(mi(CHARGER_A - s) * 10) / 10).toFixed(1)} MI · IN RANGE`;
      hud.c1Tone = 'ok';
      break;
    }
    case 'provider': {
      const sCar = S_STOP + 420 + 700 * easeOut(t);
      Object.assign(st.car, carPose(sCar), { head: 1, tail: 1, cabin: 0.85 });
      const go = inv(0.26, 1, t);
      const sp2 = ROUTE2.len * 0.3 * Math.pow(go, 1.4);
      Object.assign(st.truck, routePose(ROUTE2, sp2), {
        visible: true, head: lerp(0.15, 1, smooth(0.16, 0.26, t)), work: 0.3 * (1 - smooth(0.12, 0.22, t)),
        hazardOn: t < 0.22 && blink(time + 0.2),
      });
      const tr = st.truck;
      const trYaw = headingAt(ROUTE2, Math.max(0, sp2 - 6), 10);
      const provC = chase(tr, v, trYaw, { dist: v.portrait ? 18 : 14, pitch: v.portrait ? 0.32 : 0.24 });
      let c = mixCam(carCam(S_STOP + 420 + 700 * easeOut(Math.min(t, 0.1)), v), provC, easeInOut(smooth(0, 0.3, t)));
      c = mixCam(c, camBecome(v, 0), easeInOut(smooth(0.62, 1, t)));
      st.cam = c;
      const a = smooth(0.7, 0.85, t);
      st.overlay = [
        { type: 'dot', x: JOBS[0][0], y: JOBS[0][1], r: 4.5, color: C.req, pulse: true, ring: C.req, a, glow: 'amber' },
        { type: 'label', x: JOBS[0][0], y: JOBS[0][1], text: 'NEW REQUEST', color: C.req, a, dx: 14 },
        { type: 'route', path: ROUTE2, s0: sp2, s1: ROUTE2.len, a, color: 'rgba(134,239,172,0.85)', w: 2, dash: [2, 7] },
        ...provDot(tr, a, 'YOU (PROVIDER)'),
      ];
      break;
    }
    case 'become': {
      st.car.visible = false;
      st.cam = camBecome(v, t);
      const ov = [];
      // the provider we've followed
      const legs = [
        { path: ROUTE2, t0: 0, t1: 0.2, from: 0.3, job: 0, j0: 0.2, j1: 0.28 },
        { path: ROUTE3, t0: 0.28, t1: 0.5, from: 0, job: 1, j0: 0.5, j1: 0.58 },
        { path: ROUTE4, t0: 0.58, t1: 0.8, from: 0, job: 2, j0: 0.8, j1: 0.88 },
      ];
      let pose = null;
      let routeO = null;
      for (const L of legs) {
        if (t >= L.t0 && t <= L.j1) {
          const k = smooth(L.t0, L.t1, t);
          const s = L.path.len * lerp(L.from, 1, k);
          pose = at(L.path, s);
          if (t < L.t1) routeO = { type: 'route', path: L.path, s0: s, s1: L.path.len, a: 1, color: 'rgba(134,239,172,0.85)', w: 2, dash: [2, 7] };
        }
      }
      if (!pose) pose = t < 0.28 ? at(ROUTE2, ROUTE2.len) : t < 0.58 ? at(ROUTE3, ROUTE3.len) : at(ROUTE4, ROUTE4.len);
      Object.assign(st.truck, { x: pose.x, y: pose.y, h: pose.h || 0, visible: false });
      legs.forEach((L, k) => {
        const [jx, jy] = JOBS[L.job];
        const appear = k === 0 ? 1 : smooth(L.t0 - 0.06, L.t0 - 0.02, t);
        if (t < L.j0) ov.push({ type: 'dot', x: jx, y: jy, r: 4.5, color: C.req, pulse: true, ring: C.req, a: appear, glow: 'amber' });
        else if (t < L.j1) ov.push({ type: 'dot', x: jx, y: jy, r: 4.5, color: C.req, a: 1 }, { type: 'ring', x: jx, y: jy, r: 11, p: inv(L.j0, L.j1, t), color: C.prov, a: 1 });
        else ov.push({ type: 'check', x: jx, y: jy, r: 6, a: 1 });
      });
      if (routeO) ov.push(routeO);
      // other providers joining the network
      for (const o of OTHER_PROVIDERS) {
        const end = at(o.route, o.route.len);
        const ta = o.t0 - 0.05;
        if (t < ta) continue;
        const svc = o.t1 + 0.06;
        if (t < o.t1) {
          const s = o.route.len * smooth(o.t0, o.t1, t);
          const p = at(o.route, s);
          ov.push({ type: 'dot', x: end[0] ?? end.x, y: end.y, r: 4, color: C.req, pulse: true, ring: C.req, a: smooth(ta, o.t0, t), glow: 'amber' });
          if (t > o.t0) {
            ov.push({ type: 'route', path: o.route, s0: s, s1: o.route.len, a: 0.7, color: 'rgba(134,239,172,0.6)', w: 1.5, dash: [2, 6] });
            ov.push({ type: 'dot', x: p.x, y: p.y, r: 4, color: C.prov, a: smooth(o.t0, o.t0 + 0.02, t), glow: 'mint' });
          }
        } else if (t < svc) {
          ov.push({ type: 'dot', x: end.x, y: end.y, r: 4, color: C.req, a: 1 }, { type: 'ring', x: end.x, y: end.y, r: 10, p: inv(o.t1, svc, t), color: C.prov, a: 1 });
          ov.push({ type: 'dot', x: end.x + 12, y: end.y, r: 3.5, color: C.prov, a: 1 });
        } else {
          ov.push({ type: 'check', x: end.x, y: end.y, r: 5, a: 0.9 });
        }
      }
      ov.push(...provDot(st.truck, 1, t < 0.3 ? 'YOU (PROVIDER)' : null));
      st.overlay = ov;
      break;
    }
    case 'network': {
      st.car.visible = false;
      const c0 = camBecome(v, 1);
      const dFit = usFitDist(v);
      const d1 = 26000;
      let dist;
      if (t < 0.38) dist = Math.exp(lerp(Math.log(c0.dist), Math.log(d1), easeInOut(inv(0, 0.38, t))));
      else dist = Math.exp(lerp(Math.log(d1), Math.log(dFit), easeInOut(inv(0.38, 0.72, t))));
      const centerW = [-200, 2800];
      const k = smooth(0, 0.3, t);
      st.cam = { ...c0, tx: lerp(c0.tx, centerW[0], k), ty: lerp(c0.ty, centerW[1], k), dist, oy: lerp(c0.oy, 0.5, k) };
      st.regional = smooth(4500, 12000, dist);
      st.worldA = 1 - smooth(0.36, 0.52, t);
      // the jobs we already completed stay on the map
      const ov = JOBS.map(j => ({ type: 'check', x: j[0], y: j[1], r: 5, a: 0.9 }));
      for (const o of OTHER_PROVIDERS) { const e = at(o.route, o.route.len); ov.push({ type: 'check', x: e.x, y: e.y, r: 4.5, a: 0.8 }); }
      // procedural requests revealed as the view widens
      const R = dist * 0.55;
      for (const j of NET_JOBS) {
        if (j.d > R) break;
        const ph = clamp((R - j.d) / (R * 0.35 + 300));
        const sz = clamp(3.8 - Math.log10(dist / 3000), 1.6, 3.8);
        if (ph < 1) {
          ov.push({ type: 'dot', x: j.x, y: j.y, r: sz, color: C.req, a: 0.9, glow: dist < 9000 ? 'amber' : null });
          ov.push({ type: 'link', x0: j.px, y0: j.py, x1: j.x, y1: j.y, p: ph, color: 'rgba(134,239,172,0.8)', w: 1, a: 0.8 });
          ov.push({ type: 'dot', x: j.px, y: j.py, r: sz * 0.9, color: C.prov, a: 0.9 });
        } else ov.push({ type: 'dot', x: j.x, y: j.y, r: sz * 0.8, color: C.prov, a: 0.75 });
      }
      st.overlay = ov;
      const scale = (M_PER_US * v.F) / dist;
      const ck = smooth(0.46, 0.76, t);
      st.us = {
        a: smooth(0.3, 0.46, t), scale,
        ax: lerp(US_ANCHOR[0], US_W / 2, ck), ay: lerp(US_ANCHOR[1], US_H / 2 + (v.portrait ? 40 : 0), ck),
        dots: smooth(0.44, 0.7, t), density: smooth(0.44, 0.84, t), links: smooth(0.62, 0.82, t), t: inv(0.62, 1, t),
      };
      if (st.us.a > 0) {
        // keep the world patch glued to the anchor while it shrinks away
        const dx = (st.us.ax - US_ANCHOR[0]) * M_PER_US, dy = (st.us.ay - US_ANCHOR[1]) * M_PER_US;
        st.cam.tx += dx;
        st.cam.ty -= dy;
      }
      break;
    }
    case 'fixed': {
      st.car.visible = false;
      const dFit = usFitDist(v);
      const city = camCity(v);
      const z = easeInOut(smooth(0.0, 0.26, t));
      const dist = Math.exp(lerp(Math.log(dFit), Math.log(city.dist), z));
      const ck = 1 - smooth(0.0, 0.2, t);
      const us = { a: 1 - smooth(0.1, 0.22, t), scale: (M_PER_US * v.F) / dist, ax: lerp(US_ANCHOR[0], US_W / 2, ck), ay: lerp(US_ANCHOR[1], US_H / 2 + (v.portrait ? 40 : 0), ck), dots: 1, density: 1, links: 1 - smooth(0, 0.1, t), t: 1 };
      st.us = us;
      st.worldA = smooth(0.1, 0.24, t);
      st.regional = smooth(4500, 12000, dist);
      st.cam = { ...city, dist };
      const dx = (us.ax - US_ANCHOR[0]) * M_PER_US, dy = (us.ay - US_ANCHOR[1]) * M_PER_US;
      st.cam.tx += dx * (1 - z);
      st.cam.ty -= dy * (1 - z);
      const a = smooth(0.2, 0.3, t);
      const ov = [];
      // traffic: everything is moving…
      for (const tr of TRAFFIC) {
        const u = ((tr.off + time * tr.speed * 0.25 + t * tr.speed * 8) % 1 + 1) % 1;
        const x = tr.vertical ? tr.line : lerp(-2800, 2400, u);
        const y = tr.vertical ? lerp(-800, 6400, u) : tr.line;
        ov.push({ type: 'dot', x, y, r: 1.6, color: 'rgba(226,232,240,0.7)', a: a * 0.8 });
      }
      // …but chargers are fixed
      for (const c of FIXED_CHARGERS) ov.push({ type: 'charger', x: c[0], y: c[1], status: 'ok', r: 6, a });
      const sa = smooth(0.3, 0.36, t);
      ov.push({ type: 'dot', x: STRANDED_B[0], y: STRANDED_B[1], r: 5, color: C.req, pulse: t < 0.86, ring: C.req, a: sa * (1 - smooth(0.86, 0.9, t)), glow: 'amber' });
      // nearest fixed charger — out of reach
      let best = FIXED_CHARGERS[0], bd = 1e9;
      for (const c of FIXED_CHARGERS) { const d = Math.hypot(c[0] - STRANDED_B[0], c[1] - STRANDED_B[1]); if (d < bd) { bd = d; best = c; } }
      const la = bump(t, 0.36, 0.42, 0.5, 0.56);
      ov.push({ type: 'link', x0: STRANDED_B[0], y0: STRANDED_B[1], x1: best[0], y1: best[1], p: smooth(0.36, 0.46, t), color: 'rgba(248,113,113,0.9)', w: 1.6, dash: [5, 6], a: la });
      ov.push({ type: 'label', x: best[0], y: best[1], text: 'YOU GO TO THE CHARGER', color: '#fca5a5', a: la, dx: 14, size: 10 });
      // the provider comes to you
      const ps = RESCUE_B.len * smooth(0.56, 0.86, t);
      const pp = at(RESCUE_B, ps);
      const pa = smooth(0.54, 0.58, t);
      if (t < 0.86) ov.push({ type: 'route', path: RESCUE_B, s0: ps, s1: RESCUE_B.len, color: 'rgba(134,239,172,0.9)', w: 2, dash: [2, 7], a: pa });
      ov.push({ type: 'dot', x: pp.x, y: pp.y, r: 5, color: C.prov, stroke: '#052e16', glow: 'mint', a: pa });
      if (t > 0.6 && t < 0.86) ov.push({ type: 'label', x: pp.x, y: pp.y, text: 'THE CHARGE COMES TO YOU', color: C.prov, a: pa, dx: 14, size: 10 });
      if (t >= 0.88) ov.push({ type: 'check', x: STRANDED_B[0], y: STRANDED_B[1], r: 6, a: smooth(0.88, 0.92, t) });
      st.overlay = ov;
      break;
    }
    case 'powerbridge':
    case 'sides': {
      st.car.visible = false;
      const city = camCity(v);
      st.cam = { ...city, dist: city.dist * (id === 'sides' ? 1.1 : 1.05) };
      st.env.dim = id === 'powerbridge' ? lerp(0, 0.84, smooth(0, 0.18, t)) : 0.9 + 0.06 * smooth(0.85, 1, t);
      const ov = [];
      for (const c of FIXED_CHARGERS) ov.push({ type: 'charger', x: c[0], y: c[1], status: 'ok', r: 5, a: 0.4 });
      for (const tr of TRAFFIC) {
        const u = ((tr.off + time * tr.speed * 0.25) % 1 + 1) % 1;
        ov.push({ type: 'dot', x: tr.vertical ? tr.line : lerp(-2800, 2400, u), y: tr.vertical ? lerp(-800, 6400, u) : tr.line, r: 1.5, color: 'rgba(226,232,240,0.6)', a: 0.5 });
      }
      st.overlay = ov;
      break;
    }
    case 'final': {
      const s = 4300 + 1150 * t;
      Object.assign(st.car, carPose(s), { head: 0.6, tail: 0.8, cabin: 0.3 });
      const pull = easeInOut(smooth(0.3, 1, t));
      const c = carCam(s, v);
      st.cam = { ...c, pitch: lerp(c.pitch, v.portrait ? 0.7 : 0.58, pull), dist: Math.exp(lerp(Math.log(c.dist), Math.log(v.portrait ? 130 : 95), pull)), oy: lerp(c.oy, v.portrait ? 0.34 : 0.5, pull) };
      st.env.dawn = 1;
      st.env.lamps = 0;
      st.env.stars = 0;
      st.env.dim = lerp(0.96, 0, smooth(0, 0.16, t)) + 0.4 * smooth(0.55, 0.75, t);
      break;
    }
  }
  return st;
}
