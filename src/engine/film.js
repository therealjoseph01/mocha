// The film: seconds → complete frame state. A pure function of time, so play, pause,
// seek, replay and scrubbing are all exact. Reuses v1's shots, world and renderer.
import { clamp, lerp, inv, smooth, easeInOut, easeOut } from './math.js';
import { mixCam } from './camera.js';
import { S_STOP, CHARGER_B, LANE, SHOULDER, ROUTE1, hwPos, hwHeading } from './world.js';
import {
  baseState, chase, carPose, routePose, dusk, blink, youDot, provDot, chargerPins,
  camStopped, camMatch, camMoving, camArrive, camOrbit,
} from './director.js';
import { B, DURATION, RANGE_KEYS, BATTERY_KEYS, CHARGER_GAP, keyed } from '../timeline.js';

/* ---------- the drive: constant cruising speed, then a coast onto the shoulder ---------- */
const V = 46; // m/s — reads as highway speed on screen
const COAST = B.stopped - B.stop;
const DRIVE_DIST = V * B.stop + (V * COAST) / 2;
const S0 = S_STOP - DRIVE_DIST;
function driveS(t) {
  if (t <= B.stop) return S0 + V * t;
  const u = clamp((t - B.stop) / COAST);
  return S0 + V * B.stop + V * COAST * (u - (u * u) / 2);
}
const driveLat = t => LANE + (SHOULDER - LANE) * smooth(B.stop - 0.5, B.stopped - 0.05, t);
const T_PASS_B = (CHARGER_B - S0) / V; // when the car passes the dead charger

/* ---------- the drive-off ---------- */
function departS(t) {
  const tau = Math.max(0, t - B.back - 0.2);
  return S_STOP + (tau < 5 ? 4 * tau * tau : 100 + 40 * (tau - 5));
}
const departLat = t => SHOULDER + (LANE - SHOULDER) * smooth(B.back + 0.4, B.back + 2.8, t);

function pose(sF, latF, t) {
  const s = sF(t), l = latF(t);
  const p = hwPos(s, l);
  const s2 = sF(t + 0.05), l2 = latF(t + 0.05);
  const ds = s2 - s;
  let h = hwHeading(s);
  if (ds > 1e-3) h += Math.atan2(l2 - l, ds);
  return { x: p.x, y: p.y, h, s };
}

const range = t => keyed(RANGE_KEYS, t);
const PROVIDER_ROUTE_END = 0.965;

export function film(time, v) {
  const t = clamp(time, 0, DURATION);
  const st = baseState(v);
  const hud = st.hud;
  const car = st.car;
  const tr = st.truck;

  /* ================= 1. drive → 0% ================= */
  if (t < B.stopped) {
    Object.assign(car, pose(driveS, driveLat, t));
    const c = chase(car, v, hwHeading(car.s - 6));
    // land wide on golden hour, settle into the chase while the brand is on screen
    const settle = easeInOut(smooth(0, B.drive + 0.6, t));
    const sway = Math.sin(t * 0.45) * 0.012;
    st.cam = { ...c, yaw: c.yaw + sway * (1 - settle * 0.6), pitch: lerp(v.portrait ? 0.34 : 0.27, c.pitch, settle), dist: lerp(v.portrait ? 27 : 23, c.dist, settle) };
    dusk(st, 1 - smooth(1.2, 11.6, t));
    // oncoming traffic early on (closing speed ~2× cruising)
    st.traffic = [];
    for (const tp of [1.6, 4.2, 7.4]) {
      const so = car.s + (tp - t) * V * 2;
      if (so - car.s > -8 && so - car.s < 520) {
        const p = hwPos(so, -LANE);
        st.traffic.push({ x: p.x, y: p.y, oncoming: true });
      }
    }
    // coast: lights dim as the pack gives out
    const off = smooth(B.stop + 0.9, B.stopped, t);
    car.head = 1 - 0.88 * off;
    car.tail = 1 - 0.7 * off;
    car.cabin = 0.55 - 0.47 * off;
    const r = range(t);
    hud.illus = smooth(0.8, 1.6, t);
    hud.rangeA = smooth(0.8, 1.6, t);
    hud.range = t >= B.stopped - 0.15 ? 0 : Math.max(r, t > B.stop ? 1 : 0);
    hud.rangeTone = r < 5 ? 'bad' : r < 13 ? 'warn' : '';
    const cA = smooth(B.tooFar - 0.5, B.tooFar - 0.1, t);
    hud.c1A = cA * (1 - 0.5 * off);
    hud.c1Val = `${Math.ceil(r + CHARGER_GAP - 1e-6)} MI`;
    hud.c1Tone = 'warn';
    hud.stripA = cA * (1 - off);
    hud.stripRange = r;
    hud.stripCharger = r + CHARGER_GAP;
    const rB = keyed(RANGE_KEYS, T_PASS_B);
    const dB = r - rB;
    hud.c2A = smooth(3.4, 3.0, dB) * (1 - smooth(T_PASS_B + 0.8, T_PASS_B + 1.4, t));
    hud.c2Label = 'CHARGER';
    hud.c2Val = dB > 1.2 ? `${Math.ceil(dB)} MI` : 'OUT OF SERVICE';
    hud.c2Tone = dB > 1.2 ? '' : 'bad';
    return st;
  }

  /* ================= 2. stranded → request → map → provider ================= */
  if (t < B.arrive) {
    Object.assign(car, carPose(S_STOP), { head: 0.12, tail: 0.3, hazardOn: blink(t), cabin: 0.08 });
    dusk(st, 0);
    if (t < B.map) {
      // the silence, then the camera slowly starts to lift
      st.cam = camStopped(v, easeInOut(smooth(B.request + 0.6, B.map, t)));
      st.env.dim = 0.12 * smooth(B.stopped, B.stopped + 0.6, t) + 0.3 * smooth(B.request, B.request + 0.6, t) * (1 - smooth(B.map - 0.4, B.map, t));
      hud.illus = hud.rangeA = 1 - smooth(B.request, B.request + 0.5, t);
      hud.range = 0;
      hud.rangeTone = 'bad';
      hud.c1A = 0.5 * (1 - smooth(B.request, B.request + 0.5, t));
      hud.c1Val = `${CHARGER_GAP} MI`;
      hud.c1Tone = 'warn';
      hud.statusA = smooth(B.request + 1.7, B.request + 2.0, t);
      hud.status = 'Request sent';
      hud.statusTone = 'ok';
      return st;
    }
    if (t < B.moving) {
      // road → map
      const u = easeInOut(smooth(B.map, B.map + 2.6, t));
      st.cam = mixCam(camStopped(v, 1), camMatch(v), u);
      Object.assign(tr, routePose(ROUTE1, 0), { visible: true });
      const found = smooth(B.map + 1.7, B.map + 2.1, t);
      st.overlay = [
        ...chargerPins(smooth(B.map + 1.3, B.map + 2.0, t) * 0.75),
        ...youDot(car, smooth(B.map + 0.9, B.map + 1.5, t), t),
        { type: 'route', path: ROUTE1, s0: 0, s1: ROUTE1.len * smooth(B.map + 2.2, B.map + 3.2, t), a: smooth(B.map + 2.2, B.map + 2.4, t), color: 'rgba(134,239,172,0.85)', w: 2.2, dash: [2, 7] },
        ...provDot(tr, found),
        { type: 'dot', x: tr.x, y: tr.y, r: 5, color: '#86efac', pulse: true, ring: '#86efac', a: found * (1 - smooth(B.moving - 0.4, B.moving, t)) },
      ];
      hud.statusA = 1;
      hud.status = t < B.map + 1.9 ? 'Request sent' : 'Provider found';
      hud.statusTone = 'ok';
      return st;
    }
    // help is moving
    const u = easeInOut(inv(B.moving, B.arrive, t));
    const sp = ROUTE1.len * PROVIDER_ROUTE_END * u;
    Object.assign(tr, routePose(ROUTE1, sp), { visible: true });
    st.cam = camMoving(u, v);
    st.overlay = [
      ...chargerPins(0.6 * (1 - smooth(0.4, 0.8, u))),
      { type: 'route', path: ROUTE1, s0: sp, s1: ROUTE1.len, a: 1, color: 'rgba(134,239,172,0.9)', w: 2.4, dash: [2, 7] },
      ...youDot(car, 1, t),
      ...provDot(tr, 1),
    ];
    hud.statusA = 1;
    hud.status = 'Provider en route';
    hud.statusTone = 'ok';
    hud.statusBar = u;
    return st;
  }

  /* ================= 3. arrival → charge ================= */
  const e = hwPos(S_STOP - 4.6, SHOULDER + 1.7);
  if (t < B.back) {
    Object.assign(car, carPose(S_STOP));
    dusk(st, 0);
    if (t < B.connect) {
      Object.assign(car, { head: 0.12, tail: 0.3, hazardOn: blink(t), cabin: 0.08 });
      const k = easeOut(inv(B.arrive, B.arrive + 2.4, t));
      Object.assign(tr, routePose(ROUTE1, ROUTE1.len * lerp(PROVIDER_ROUTE_END, 1, k)), { visible: true });
      const parked = smooth(B.arrive + 2.2, B.arrive + 2.7, t);
      tr.head = 1 - 0.85 * parked;
      tr.work = parked;
      tr.hazardOn = parked > 0.5 && blink(t + 0.2);
      st.cam = mixCam(camMoving(1, v), camArrive(v), easeInOut(inv(B.arrive, B.arrive + 2.8, t)));
      const a = 1 - smooth(B.arrive, B.arrive + 0.9, t);
      st.overlay = [...youDot(car, a, t), ...provDot(tr, a, null)];
      hud.statusA = 1;
      hud.status = 'Provider arriving';
      hud.statusTone = 'ok';
      hud.statusBar = lerp(PROVIDER_ROUTE_END, 1, k);
      return st;
    }
    Object.assign(tr, routePose(ROUTE1, ROUTE1.len), { visible: true, head: 0.15, work: 1, hazardOn: blink(t + 0.2) });
    const bat = keyed(BATTERY_KEYS, t);
    const wake = smooth(0, 7, bat);
    car.head = lerp(0.12, 1, wake);
    car.tail = lerp(0.3, 1, smooth(0, 3, bat));
    car.cabin = smooth(0, 3, bat) * 0.85;
    car.hazardOn = blink(t);
    st.cam = camOrbit(v, easeInOut(inv(B.connect + 0.4, B.unplug + 0.6, t)));
    st.evse = { x: e.x, y: e.y, h: e.h, on: smooth(B.connect, B.connect + 0.35, t) * (1 - smooth(B.back - 0.4, B.back - 0.05, t)) };
    const plug = smooth(B.connect + 0.3, B.connect + 1.1, t);
    const unplug = smooth(B.unplug, B.unplug + 0.6, t);
    st.cable = {
      p: plug * (1 - unplug),
      flow: smooth(B.charge, B.charge + 0.3, t) * (1 - smooth(B.unplug - 0.3, B.unplug, t)),
      connected: smooth(B.connect + 1.1, B.connect + 1.3, t) * (1 - smooth(B.unplug - 0.1, B.unplug + 0.1, t)),
    };
    hud.batA = smooth(B.connect + 1.0, B.connect + 1.4, t);
    hud.bat = bat;
    hud.illus = hud.batA;
    hud.statusA = 1 - smooth(B.back - 0.4, B.back, t);
    hud.status = t < B.connect + 1.2 ? 'Connecting' : t < B.charge ? 'Connected' : t < B.unplug ? 'Charging' : 'Disconnected';
    hud.statusTone = 'ok';
    return st;
  }

  /* ================= 4. back on the road → CTA ================= */
  Object.assign(car, pose(departS, departLat, t), { head: 1, tail: 1, cabin: 0.85, hazardOn: t < B.back + 0.3 && blink(t) });
  Object.assign(tr, routePose(ROUTE1, ROUTE1.len), { visible: true, head: smooth(B.back, B.back + 0.6, t), work: 1 - smooth(B.back, B.back + 1.5, t), hazardOn: false });
  const light = smooth(B.back + 0.4, B.cta + 1.5, t);
  st.env.dawn = light * 0.9;
  st.env.lamps = 1 - light;
  st.env.stars = 1 - light;
  const follow = chase(car, v, hwHeading(car.s - 6));
  const pull = easeInOut(smooth(B.cta - 0.4, DURATION, t));
  // end frame: pull back and up, but keep the dawn sky in shot behind the CTA
  const end = { ...follow, pitch: v.portrait ? 0.36 : 0.3, dist: v.portrait ? 44 : 34, oy: v.portrait ? 0.66 : 0.64 };
  st.cam = mixCam(mixCam(camOrbit(v, 1), follow, easeInOut(smooth(B.back, B.back + 2.4, t))), end, pull);
  st.env.dim = 0.2 * smooth(B.cta, B.cta + 1.4, t);
  hud.batA = 1 - smooth(B.back + 1.8, B.back + 2.6, t);
  hud.bat = 12;
  hud.illus = hud.batA;
  return st;
}

export const FILM_DURATION = DURATION;
