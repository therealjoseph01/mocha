// Canvas 2D renderer. Draws one frame of the world from a director state.
import { camera, clipNear } from './camera.js';
import { clamp, lerp, smooth } from './math.js';
import {
  ROADS, HW, LAMPS, TREES, HOUSES, FIELDS, CHARGERS, REGIONAL, TOWNS_FAR,
  hwSAtY, hwPos, at,
} from './world.js';
import { CAR, TRUCK, EVSE, PEDESTAL, CANOPY, CANOPY_POST } from './meshes.js';
import { US_OUTLINE, US_BORDERS, US_POINTS, US_W, US_H } from '../data/usMap.js';

const TAU = Math.PI * 2;
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// palette — [night, dawn, dusk/golden hour]
const P = {
  skyTop: [[3, 6, 5], [34, 50, 66], [44, 66, 98]],
  skyMid: [[6, 11, 9], [108, 124, 134], [178, 150, 150]],
  skyHz: [[14, 24, 19], [238, 186, 140], [255, 190, 122]],
  ground: [[7, 11, 9], [30, 38, 34], [58, 56, 46]],
  asphalt: [[22, 26, 25], [52, 56, 54], [78, 76, 72]],
  field: [[8, 13, 10], [40, 50, 42], [74, 72, 52]],
  tree: [[3, 6, 4], [22, 32, 26], [40, 38, 40]],
  hill: [[6, 11, 9], [74, 84, 92], [138, 116, 122]],
  map: [5, 12, 9],
};
/** environment colour: night → dawn (final scene) or → dusk (opening) */
const pc = (k, env) => mixc(mixc(P[k][0], P[k][1], env.dawn || 0), P[k][2], env.dusk || 0);
const daylight = env => Math.max(env.dawn || 0, env.dusk || 0);

function makeGlow(r, g, b, size = 128, hard = 0.0) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gr.addColorStop(0.12 + hard, `rgba(${r},${g},${b},0.55)`);
  gr.addColorStop(0.4, `rgba(${r},${g},${b},0.14)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  return c;
}

const STARS = (() => {
  const s = [];
  let v = 3;
  const r = () => ((v = (v * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160; i++) s.push([r() * TAU, 0.02 + Math.pow(r(), 1.5) * 0.7, 0.2 + r() * 0.6]);
  return s;
})();

const NEAR = new Map();
function nearestProvider(i) {
  let j = NEAR.get(i);
  if (j !== undefined) return j;
  let bd = 1e9;
  const p = US_POINTS[i];
  for (let k = 0; k < US_POINTS.length; k++) {
    if (k % 3 === 0) continue;
    const q = US_POINTS[k];
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    if (d < bd) { bd = d; j = k; }
  }
  NEAR.set(i, j);
  return j;
}
const hillH = u => 10 + 7 * Math.sin(3 * u) + 5 * Math.sin(7 * u + 1) + 2.5 * Math.sin(17 * u + 2) + 1.5 * Math.sin(31 * u);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const G = {
    warm: makeGlow(255, 196, 128),
    white: makeGlow(255, 248, 235),
    red: makeGlow(255, 46, 56),
    amber: makeGlow(255, 170, 40),
    mint: makeGlow(110, 240, 160),
    teal: makeGlow(120, 220, 200),
    shadow: makeGlow(0, 0, 0, 64, 0.25),
  };
  let W = 1, H = 1, DPR = 1;
  let usOutline = null, usBorders = null;
  const getUS = () => {
    if (!usOutline && typeof Path2D !== 'undefined') {
      usOutline = new Path2D(US_OUTLINE);
      usBorders = new Path2D(US_BORDERS);
    }
    return usOutline;
  };

  function resize(w, h, dpr) {
    W = w; H = h; DPR = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function sprite(img, x, y, rx, ry, a) {
    if (!img || a <= 0.003 || rx < 0.3) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(img, x - rx, y - ry, rx * 2, ry * 2);
  }

  function polyScreen(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function fillCam(cam, camPts, style) {
    const c = clipNear(camPts);
    if (c.length < 3) return;
    polyScreen(c.map(p => cam.toScreen(p)));
    ctx.fillStyle = style;
    ctx.fill();
  }

  /* ---------- meshes ---------- */
  function shade(m, n, mats, L) {
    const base = mats[m];
    if (!base) return 'rgb(30,30,30)';
    if (base.emit) {
      const c = mixc(base.off, base.on, clamp(base.k));
      return rgb(c);
    }
    const ndl = Math.max(0, n[0] * -0.35 + n[1] * -0.45 + n[2] * 0.82);
    let k = L.amb + L.key * ndl;
    const c = base.c;
    let r = c[0] * k, g = c[1] * k, b = c[2] * k;
    if (L.lamp > 0) {
      const lk = L.lamp * (0.35 + 0.65 * Math.max(0, n[2] * 0.7 + 0.3));
      r += 255 * 0.2 * lk; g += 190 * 0.2 * lk; b += 130 * 0.2 * lk;
    }
    if (m === 'glass') {
      const sky = Math.max(0, n[2]) * L.sky;
      r += 26 * sky; g += 34 * sky; b += 36 * sky;
      if (L.cabin > 0) { r += 4 * L.cabin; g += 16 * L.cabin; b += 13 * L.cabin; }
    }
    if (L.mint > 0 && m !== 'glass') { r += 20 * L.mint; g += 70 * L.mint; b += 44 * L.mint; }
    return `rgb(${Math.min(255, r) | 0},${Math.min(255, g) | 0},${Math.min(255, b) | 0})`;
  }

  function meshFaces(cam, mesh, pose, mats, L, out, bias = 0) {
    const ch = Math.cos(pose.h), sh = Math.sin(pose.h);
    const X = pose.x, Y = pose.y, Z = pose.z || 0;
    for (const f of mesh) {
      const nx = f.n[0] * ch + f.n[1] * sh, ny = -f.n[0] * sh + f.n[1] * ch, nz = f.n[2];
      const cx = X + f.c[0] * ch + f.c[1] * sh, cy = Y - f.c[0] * sh + f.c[1] * ch, cz = Z + f.c[2];
      if (f.cull && (cx - cam.px) * nx + (cy - cam.py) * ny + (cz - cam.pz) * nz >= 0) continue;
      const pts = new Array(f.v.length);
      for (let i = 0; i < f.v.length; i++) {
        const v = f.v[i];
        pts[i] = cam.toCam(X + v[0] * ch + v[1] * sh, Y - v[0] * sh + v[1] * ch, Z + v[2]);
      }
      const c = clipNear(pts);
      if (c.length < 3) continue;
      let d = 0;
      for (const p of c) d += p[2];
      out.push({ d: d / c.length + bias, s: c.map(p => cam.toScreen(p)), col: shade(f.m, [nx, ny, nz], mats, L) });
    }
  }
  function drawFaceList(list) {
    list.sort((a, b) => b.d - a.d);
    ctx.lineJoin = 'round';
    for (const it of list) {
      polyScreen(it.s);
      ctx.fillStyle = it.col;
      ctx.fill();
      ctx.strokeStyle = it.col;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
  const local = (pose, p) => {
    const ch = Math.cos(pose.h), sh = Math.sin(pose.h);
    return [pose.x + p[0] * ch + p[1] * sh, pose.y - p[0] * sh + p[1] * ch, (pose.z || 0) + p[2]];
  };
  function lampNear(x, y, on) {
    if (on <= 0) return 0;
    let s = 0;
    for (const l of LAMPS) {
      const dx = l.x - x, dy = l.y - y;
      if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
      const d = Math.hypot(dx, dy);
      if (d < 30) s += (1 - d / 30) ** 2;
    }
    return Math.min(1.4, s) * on;
  }

  /* ---------- world layers ---------- */
  function drawSky(cam, env) {
    const hz = cam.horizonY();
    const d = daylight(env);
    const top = pc('skyTop', env), mid = pc('skyMid', env), hzc = pc('skyHz', env);
    const gnd = pc('ground', env);
    if (hz > 0) {
      const g = ctx.createLinearGradient(0, Math.min(0, hz - H), 0, hz);
      g.addColorStop(0, rgb(top));
      g.addColorStop(0.65, rgb(mid));
      g.addColorStop(1, rgb(hzc));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, Math.min(H, hz + 1));
      // stars
      const night = (1 - d) * env.stars;
      if (night > 0.01) {
        ctx.fillStyle = '#dfeee6';
        for (const s of STARS) {
          let u = ((s[0] - cam.yaw) % TAU + TAU) % TAU;
          if (u > Math.PI) u -= TAU;
          const x = cam.ox + u * cam.F;
          if (x < 0 || x > W) continue;
          const y = hz - Math.tan(s[1]) * cam.F;
          if (y < 0 || y > hz - 8) continue;
          ctx.globalAlpha = s[2] * night * (0.6 + 0.4 * Math.sin(env.time * 0.7 + s[0] * 9));
          ctx.fillRect(x, y, 1.1, 1.1);
        }
        ctx.globalAlpha = 1;
      }
      // low sun: dawn (final scene) or setting sun (opening)
      if (d > 0.01) {
        const sy = env.sunYaw ?? 0.55;
        const sx = cam.ox + (((sy - cam.yaw) % TAU + TAU + Math.PI) % TAU - Math.PI) * cam.F;
        const lift = (env.sunUp ?? 0) * cam.F;
        ctx.globalCompositeOperation = 'lighter';
        sprite(G.warm, sx, hz - 6 - lift * 0.5, W * 0.6, H * 0.26, 0.55 * d);
        sprite(G.white, sx, hz - 2 - lift, 60 + lift * 0.2, 32 + lift * 0.1, 0.7 * d);
        ctx.globalCompositeOperation = 'source-over';
      }
      // hills
      ctx.beginPath();
      ctx.moveTo(0, hz + 1);
      for (let x = 0; x <= W + 8; x += 8) {
        const u = (x - cam.ox) / cam.F + cam.yaw;
        ctx.lineTo(x, hz - hillH(u) * (cam.F / 900));
      }
      ctx.lineTo(W, hz + 1);
      ctx.closePath();
      ctx.fillStyle = rgb(pc('hill', env));
      ctx.fill();
    }
    ctx.fillStyle = rgb(gnd);
    ctx.fillRect(0, Math.max(0, hz), W, H - Math.max(0, hz));
    return { hz, hzc, gnd };
  }

  function drawFields(cam, env, alpha, map = 0) {
    if (alpha + map <= 0.01) return;
    const col = mixc(pc('field', env), [10, 24, 17], map);
    const far = cam.dist < 400 ? 2600 : 1e9;
    if (cam.dist > 30000) return;
    for (const f of FIELDS) {
      if (Math.abs(f.x - cam.px) > far || Math.abs(f.y - cam.py) > far) continue;
      const pts = [
        cam.toCam(f.x - f.w / 2, f.y - f.d / 2),
        cam.toCam(f.x + f.w / 2, f.y - f.d / 2),
        cam.toCam(f.x + f.w / 2, f.y + f.d / 2),
        cam.toCam(f.x - f.w / 2, f.y + f.d / 2),
      ];
      ctx.globalAlpha = Math.min(1, alpha * (0.35 + f.a) + map * (0.18 + f.a * 0.5));
      fillCam(cam, pts, rgb(mixc(col, [col[0] + 6, col[1] + 9, col[2] + 5], f.shade)));
    }
    ctx.globalAlpha = 1;
  }

  function hwStrip(cam, s0, s1, lat0, lat1, stepFn) {
    const L = [], R = [];
    for (let s = s0; s <= s1; ) {
      const a = hwPos(s, lat0), b = hwPos(s, lat1);
      L.push(cam.toCam(a.x, a.y));
      R.push(cam.toCam(b.x, b.y));
      s += stepFn(s);
    }
    return L.concat(R.reverse());
  }

  function drawRoadsPoly(cam, env, alpha, sCam) {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    const asph = rgb(pc('asphalt', env));
    // streets near the camera
    for (const r of ROADS) {
      if (r.kind !== 'st') continue;
      const [a, b] = r.path.pts;
      const vertical = a[0] === b[0];
      const off = vertical ? Math.abs(a[0] - cam.px) : Math.abs(a[1] - cam.py);
      if (off > 1400) continue;
      const hw = r.hw;
      const pts = vertical
        ? [[a[0] - hw, a[1]], [a[0] + hw, a[1]], [b[0] + hw, b[1]], [b[0] - hw, b[1]]]
        : [[a[0], a[1] - hw], [a[0], a[1] + hw], [b[0], b[1] + hw], [b[0], b[1] - hw]];
      // split long streets into chunks so near-plane clipping stays precise
      const n = 24;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n;
        const q = [
          [lerp(pts[0][0], pts[3][0], u0), lerp(pts[0][1], pts[3][1], u0)],
          [lerp(pts[1][0], pts[2][0], u0), lerp(pts[1][1], pts[2][1], u0)],
          [lerp(pts[1][0], pts[2][0], u1), lerp(pts[1][1], pts[2][1], u1)],
          [lerp(pts[0][0], pts[3][0], u1), lerp(pts[0][1], pts[3][1], u1)],
        ];
        const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
        if (Math.hypot(cx - cam.px, cy - cam.py) > 2200) continue;
        fillCam(cam, q.map(p => cam.toCam(p[0], p[1])), asph);
      }
    }
    // highway
    const step = s => clamp(2 + Math.abs(s - sCam) * 0.03, 2, 40);
    const s0 = sCam - 300, s1 = sCam + 2200;
    fillCam(cam, hwStrip(cam, s0, s1, -6.4, 6.4, step), asph);
    // edge lines
    const line = `rgba(235,240,236,${0.55})`;
    const stepL = s => clamp(1.5 + Math.abs(s - sCam) * 0.02, 1.5, 30);
    fillCam(cam, hwStrip(cam, s0, Math.min(s1, sCam + 900), 3.55, 3.7, stepL), line);
    fillCam(cam, hwStrip(cam, s0, Math.min(s1, sCam + 900), -3.7, -3.55, stepL), line);
    // center dashes
    ctx.fillStyle = 'rgba(240,242,238,0.8)';
    const d0 = Math.floor((sCam - 40) / 12) * 12;
    for (let s = d0; s < sCam + 320; s += 12) {
      const a = hwPos(s, -0.08), b = hwPos(s, 0.08), c = hwPos(s + 3.2, 0.08), d = hwPos(s + 3.2, -0.08);
      fillCam(cam, [cam.toCam(a.x, a.y), cam.toCam(b.x, b.y), cam.toCam(c.x, c.y), cam.toCam(d.x, d.y)], 'rgba(240,242,238,0.8)');
    }
    ctx.globalAlpha = 1;
  }

  function strokePath(cam, pts, stride = 1) {
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i < pts.length; i += stride) {
      const p = cam.project(pts[i][0], pts[i][1], 0);
      if (!p) { pen = false; continue; }
      if (pen) ctx.lineTo(p[0], p[1]);
      else { ctx.moveTo(p[0], p[1]); pen = true; }
    }
    const l = pts[pts.length - 1];
    const p = cam.project(l[0], l[1], 0);
    if (p && pen) ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  }

  function drawRoadsMap(cam, env, alpha, st) {
    if (alpha <= 0.01) return;
    const mpp = cam.dist / cam.F; // meters per pixel
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // town blocks
    if (mpp < 12) {
      ctx.fillStyle = `rgba(134,239,172,${0.13 * alpha})`;
      for (const h of HOUSES) {
        const a = cam.project(h.x - h.w / 2, h.y - h.d / 2), b = cam.project(h.x + h.w / 2, h.y + h.d / 2);
        if (!a || !b) continue;
        ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]) + 0.6, Math.abs(b[1] - a[1]) + 0.6);
      }
    }
    // tree specks = terrain texture
    if (mpp < 6) {
      ctx.fillStyle = `rgba(134,239,172,${0.16 * alpha})`;
      for (const t of TREES) {
        const p = cam.project(t.x, t.y);
        if (p) ctx.fillRect(p[0], p[1], 1.4, 1.4);
      }
    }
    const regional = st.regional || 0;
    ctx.strokeStyle = `rgba(160,230,185,${0.14 * alpha * (1 - regional * 0.5)})`;
    ctx.lineWidth = clamp(8 / mpp, 0.8, 5);
    for (const r of ROADS) if (r.kind === 'st' && r.core) strokePath(cam, r.path.pts);
    ctx.strokeStyle = `rgba(160,230,185,${0.08 * alpha * (1 - regional * 0.5)})`;
    for (const r of ROADS) if (r.kind === 'st' && !r.core) strokePath(cam, r.path.pts);
    if (regional > 0.01) {
      ctx.strokeStyle = `rgba(160,230,185,${0.16 * alpha * regional})`;
      ctx.lineWidth = 1;
      for (const r of REGIONAL) strokePath(cam, r);
      ctx.fillStyle = `rgba(200,245,215,${0.22 * alpha * regional})`;
      for (const t of TOWNS_FAR) {
        const p = cam.project(t[0], t[1]);
        if (p) ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
      }
    }
    ctx.strokeStyle = `rgba(220,252,231,${0.42 * alpha})`;
    ctx.lineWidth = clamp(13 / mpp, 1.6, 9);
    const stride = Math.max(1, Math.floor((mpp * 2) / 6));
    strokePath(cam, HW.pts, stride);
  }

  function groundSprite(cam, img, x, y, r, a) {
    const c = cam.project(x, y, 0);
    if (!c) return;
    const f0 = cam.project(x - cam.fwd[0] * r, y - cam.fwd[1] * r, 0);
    const f1 = cam.project(x + cam.fwd[0] * r, y + cam.fwd[1] * r, 0);
    const rx = (r * cam.F) / c[2];
    const ry = f0 && f1 ? Math.abs(f0[1] - f1[1]) / 2 : rx * 0.3;
    sprite(img, c[0], c[1], rx, Math.max(0.5, ry), a);
  }

  function beam(cam, pose, len, spread, a, near = 2.4, zoff = 0) {
    if (a <= 0.005) return;
    const pts = [
      local(pose, [-0.7, near, zoff]), local(pose, [0.7, near, zoff]),
      local(pose, [spread, near + len, 0]), local(pose, [-spread, near + len, 0]),
    ];
    const cp = pts.map(p => cam.toCam(p[0], p[1], p[2]));
    const c = clipNear(cp);
    if (c.length < 3) return;
    const s0 = cam.project(...local(pose, [0, near, 0]));
    const s1 = cam.project(...local(pose, [0, near + len, 0]));
    let fill = `rgba(255,244,220,${a * 0.5})`;
    if (s0 && s1) {
      const g = ctx.createLinearGradient(s0[0], s0[1], s1[0], s1[1]);
      g.addColorStop(0, `rgba(255,244,222,${a})`);
      g.addColorStop(0.35, `rgba(255,240,215,${a * 0.45})`);
      g.addColorStop(1, 'rgba(255,240,215,0)');
      fill = g;
    }
    polyScreen(c.map(p => cam.toScreen(p)));
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function drawCable(cam, a, b, prog, sag, flow, time) {
    if (prog <= 0) return;
    const N = 26;
    const pts = [];
    const n = Math.max(2, Math.round(N * prog));
    for (let i = 0; i <= n; i++) {
      const u = (i / N);
      const z = lerp(a[2], b[2], u) - Math.sin(u * Math.PI) * sag;
      const p = cam.project(lerp(a[0], b[0], u), lerp(a[1], b[1], u), Math.max(0.03, z));
      if (p) pts.push(p);
    }
    if (pts.length < 2) return;
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    const wpx = clamp((0.035 * cam.F) / pts[0][2], 1, 6);
    ctx.strokeStyle = '#0b0f0e';
    ctx.lineWidth = wpx + 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,135,130,0.55)';
    ctx.lineWidth = Math.max(0.6, wpx * 0.35);
    ctx.stroke();
    if (flow > 0 && prog >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const u = ((time * 0.35 + k / 3) % 1);
        const i = Math.floor(u * (pts.length - 1));
        const p = pts[i];
        sprite(G.mint, p[0], p[1], 7, 7, 0.55 * flow);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* ---------- map overlay primitives ---------- */
  function overlay(cam, list, time) {
    for (const o of list) {
      if (!o || o.a <= 0.004) continue;
      ctx.globalAlpha = Math.min(1, o.a);
      if (o.type === 'route') {
        const pts = [];
        const step = Math.max(4, cam.dist / cam.F * 3);
        for (let s = o.s0; s <= o.s1; s += step) { const p = at(o.path, s); pts.push([p.x, p.y]); }
        const e = at(o.path, o.s1); pts.push([e.x, e.y]);
        ctx.strokeStyle = o.color || '#86efac';
        ctx.lineWidth = o.w || 2.5;
        ctx.lineCap = 'round';
        ctx.setLineDash(o.dash || []);
        ctx.lineDashOffset = o.dash ? -time * 18 : 0;
        strokePath(cam, pts);
        ctx.setLineDash([]);
      } else if (o.type === 'link') {
        const a = cam.project(o.x0, o.y0), b = cam.project(o.x1, o.y1);
        if (!a || !b) continue;
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.w || 1.2;
        ctx.setLineDash(o.dash || []);
        ctx.lineDashOffset = -time * 14;
        ctx.beginPath();
        if (o.arc) {
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.25;
          ctx.moveTo(a[0], a[1]);
          const p = o.p ?? 1;
          // partial quadratic
          const N = 16;
          for (let i = 1; i <= N * p; i++) {
            const u = i / N;
            ctx.lineTo((1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * my + u * u * b[1]);
          }
        } else {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(lerp(a[0], b[0], o.p ?? 1), lerp(a[1], b[1], o.p ?? 1));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (o.type === 'dot') {
        const p = cam.project(o.x, o.y, o.z || 0);
        if (!p) continue;
        const r = o.r || 4;
        if (o.pulse) {
          for (let k = 0; k < 2; k++) {
            const u = (time * 0.6 + k * 0.5) % 1;
            ctx.globalAlpha = Math.min(1, o.a) * (1 - u) * 0.8;
            ctx.strokeStyle = o.ring || o.color;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(p[0], p[1], r + u * r * 5, 0, TAU);
            ctx.stroke();
          }
          ctx.globalAlpha = Math.min(1, o.a);
        }
        if (o.glow) {
          ctx.globalCompositeOperation = 'lighter';
          sprite(G[o.glow], p[0], p[1], r * 5, r * 5, o.a * 0.7);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, o.a);
        }
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, TAU);
        ctx.fill();
        if (o.stroke) {
          ctx.strokeStyle = o.stroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (o.type === 'ring') {
        const p = cam.project(o.x, o.y);
        if (!p) continue;
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p[0], p[1], o.r || 10, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(o.p));
        ctx.stroke();
      } else if (o.type === 'check') {
        const p = cam.project(o.x, o.y);
        if (!p) continue;
        const r = o.r || 5;
        ctx.fillStyle = o.color || '#86efac';
        ctx.beginPath();
        ctx.arc(p[0], p[1], r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#052e16';
        ctx.lineWidth = Math.max(1.2, r * 0.35);
        ctx.beginPath();
        ctx.moveTo(p[0] - r * 0.45, p[1]);
        ctx.lineTo(p[0] - r * 0.1, p[1] + r * 0.38);
        ctx.lineTo(p[0] + r * 0.5, p[1] - r * 0.38);
        ctx.stroke();
      } else if (o.type === 'charger') {
        const p = cam.project(o.x, o.y);
        if (!p) continue;
        const r = o.r || 6;
        ctx.fillStyle = o.status === 'out' ? '#2a0d0f' : '#0b1a12';
        ctx.strokeStyle = o.status === 'out' ? '#f87171' : '#e8f5ec';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.rect(p[0] - r, p[1] - r, r * 2, r * 2);
        ctx.fill();
        ctx.stroke();
        // bolt-free plug glyph: two prongs
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(p[0] - r * 0.4, p[1] - r * 0.5, r * 0.22, r * 0.5);
        ctx.fillRect(p[0] + r * 0.18, p[1] - r * 0.5, r * 0.22, r * 0.5);
        ctx.fillRect(p[0] - r * 0.5, p[1] - r * 0.05, r, r * 0.35);
        if (o.status === 'out') {
          ctx.strokeStyle = '#f87171';
          ctx.beginPath();
          ctx.moveTo(p[0] - r * 1.4, p[1] + r * 1.4);
          ctx.lineTo(p[0] + r * 1.4, p[1] - r * 1.4);
          ctx.stroke();
        }
      } else if (o.type === 'label') {
        const p = cam.project(o.x, o.y, o.z || 0);
        if (!p) continue;
        ctx.font = `${o.weight || 600} ${o.size || 11}px Inter, system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = o.color || '#e8f5ec';
        const dx = o.dx || 12;
        const tw = ctx.measureText(o.text).width;
        // flip to the left of the marker when it would run off-screen
        if (p[0] + dx + tw > W - 14) {
          ctx.textAlign = 'right';
          ctx.fillText(o.text, p[0] - dx, p[1] + (o.dy || 0));
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(o.text, p[0] + dx, p[1] + (o.dy || 0));
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawUS(us, time) {
    if (!us || us.a <= 0.003) return;
    const path = getUS();
    if (!path) return;
    ctx.save();
    ctx.globalAlpha = us.a;
    ctx.translate(W / 2, H / 2);
    ctx.scale(us.scale, us.scale);
    ctx.translate(-us.ax, -us.ay);
    ctx.fillStyle = 'rgba(134,239,172,0.045)';
    ctx.fill(path);
    ctx.lineWidth = 1.2 / us.scale;
    ctx.strokeStyle = 'rgba(220,252,231,0.5)';
    ctx.stroke(path);
    ctx.lineWidth = 0.7 / us.scale;
    ctx.strokeStyle = 'rgba(220,252,231,0.12)';
    ctx.stroke(usBorders);
    ctx.restore();
    // network points (screen space so dot size stays constant)
    const toS = p => [W / 2 + (p[0] - us.ax) * us.scale, H / 2 + (p[1] - us.ay) * us.scale];
    const n = Math.floor(US_POINTS.length * clamp(us.density ?? 1));
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const s = toS(US_POINTS[i]);
      if (s[0] < -10 || s[0] > W + 10 || s[1] < -10 || s[1] > H + 10) continue;
      const prov = i % 3 !== 0;
      const br = 0.5 + 0.5 * Math.sin(time * 1.3 + i * 1.7);
      ctx.globalAlpha = us.a * us.dots * (prov ? 0.55 + 0.3 * br : 0.8);
      ctx.fillStyle = prov ? '#86efac' : '#fde68a';
      ctx.fillRect(s[0] - 1.2, s[1] - 1.2, 2.4, 2.4);
    }
    ctx.globalCompositeOperation = 'source-over';
    // connections: driver point i (i%3==0) → nearest provider, drawn progressively
    if (us.links > 0) {
      ctx.lineWidth = 1;
      const m = Math.floor(US_POINTS.length / 3);
      for (let k = 0; k < m; k++) {
        const i = k * 3;
        const cyc = (time * 0.18 + k * 0.137) % 1;
        const vis = us.links * clamp((us.t * m * 1.4 - k) / 4);
        if (vis <= 0) continue;
        const a = toS(US_POINTS[i]), b = toS(US_POINTS[nearestProvider(i)]);
        const p = clamp(cyc * 2.2);
        ctx.globalAlpha = us.a * vis * (1 - clamp((cyc - 0.6) / 0.4)) * 0.8;
        ctx.strokeStyle = '#86efac';
        ctx.beginPath();
        ctx.moveTo(b[0], b[1]);
        ctx.lineTo(lerp(b[0], a[0], p), lerp(b[1], a[1], p));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- frame ---------- */
  function render(st, time) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const F = st.F;
    const cam = camera({ ...st.cam, F }, W, H);
    const env = { ...st.env, time };
    const mapMix = smooth(110, 1500, cam.dist);
    const worldA = st.worldA ?? 1;
    const ground = 1 - mapMix;

    // background: physical sky/ground, cross-faded into the flat map plane
    ctx.globalAlpha = 1;
    if (ground > 0.001) drawSky(cam, env);
    if (mapMix > 0.001) {
      ctx.globalAlpha = mapMix;
      ctx.fillStyle = rgb(P.map);
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = worldA;
    if (worldA > 0.002) {
      const sCam = hwSAtY(cam.py + cam.fwd[1] * 30);
      drawFields(cam, env, ground, mapMix);
      drawRoadsPoly(cam, env, ground, sCam);
      ctx.globalAlpha = worldA;
      drawRoadsMap(cam, env, mapMix * worldA, st);

      if (ground > 0.01) {
        const lampsOn = env.lamps ?? 1;
        // ground light pools
        ctx.globalCompositeOperation = 'lighter';
        for (const l of LAMPS) {
          if (Math.abs(l.x - cam.px) > 700 || Math.abs(l.y - cam.py) > 700) continue;
          groundSprite(cam, G.warm, l.x, l.y, l.town ? 13 : 17, 0.3 * lampsOn * ground);
        }
        for (const c of CHARGERS) {
          if (c.status === 'ok') groundSprite(cam, G.white, c.x, c.y, 16, 0.5 * ground);
        }
        const car = st.car, tr = st.truck;
        if (car.visible) {
          beam(cam, car, 46, 7.5, 0.27 * car.head * ground * (1 - daylight(env) * 0.45));
          groundSprite(cam, G.red, ...local(car, [0, -3.0, 0]).slice(0, 2), 2.4, 0.22 * car.tail * ground);
          if (car.hazardOn) {
            for (const c of CAR.corners) groundSprite(cam, G.amber, ...local(car, [c[0] * 1.6, c[1] * 1.15, 0]).slice(0, 2), 2.4, 0.4 * ground);
          }
        }
        if (tr.visible) {
          beam(cam, tr, 40, 7, 0.22 * tr.head * ground * (1 - daylight(env) * 0.45), 3.0);
          if (tr.work > 0) groundSprite(cam, G.warm, ...local(tr, [2.4, -1.2, 0]).slice(0, 2), 5, 0.45 * tr.work * ground);
          if (tr.hazardOn) for (const c of TRUCK.corners) groundSprite(cam, G.amber, ...local(tr, [c[0] * 1.5, c[1] * 1.1, 0]).slice(0, 2), 2.4, 0.35 * ground);
        }
        ctx.globalCompositeOperation = 'source-over';
        // contact shadows ground the vehicles
        if (car.visible) groundSprite(cam, G.shadow, car.x, car.y, 3.4, 0.75 * ground);
        if (tr.visible) groundSprite(cam, G.shadow, tr.x, tr.y, 4, 0.75 * ground);
        ctx.globalAlpha = 1;

        // horizon fog
        const hz = cam.horizonY();
        if (hz > -50 && hz < H) {
          const hzc = pc('skyHz', env);
          const g = ctx.createLinearGradient(0, hz - 2, 0, hz + H * 0.14);
          g.addColorStop(0, rgb(hzc, 0.95 * ground));
          g.addColorStop(1, rgb(hzc, 0));
          ctx.fillStyle = g;
          ctx.fillRect(0, hz - 2, W, H * 0.14 + 2);
        }

        // ---------- objects ----------
        const faces = [];
        const lampsList = [];
        const L = { amb: lerp(0.2, 0.62, daylight(env)), key: lerp(0.28, 0.78, daylight(env)), sky: lerp(0.5, 1.6, daylight(env)), lamp: 0, cabin: 0, mint: 0 };
        // trees
        const treeCol = rgb(pc('tree', env));
        const trees = [];
        for (const t of TREES) {
          if (Math.abs(t.x - cam.px) > 900 || Math.abs(t.y - cam.py) > 900) continue;
          const b = cam.project(t.x, t.y, 0);
          if (!b) continue;
          const top = cam.project(t.x, t.y, t.z);
          if (!top) continue;
          trees.push({ d: b[2], b, top, w: (t.w * cam.F) / b[2] });
        }
        trees.sort((a, b) => b.d - a.d);
        ctx.fillStyle = treeCol;
        const topDown = smooth(0.55, 0.95, cam.pitch);
        for (const t of trees) {
          if (topDown < 0.99) {
            // layered conifer silhouette
            ctx.globalAlpha = 1 - topDown;
            ctx.beginPath();
            const bx = t.b[0], by = t.b[1], tx = t.top[0], ty = t.top[1];
            for (let k = 0; k < 3; k++) {
              const u0 = 0.18 + k * 0.24, u1 = 1 - k * 0.22;
              const y0 = lerp(by, ty, u0), x0 = lerp(bx, tx, u0);
              const y1 = lerp(by, ty, Math.min(1, u1 * 0.92 + 0.08)), x1 = lerp(bx, tx, Math.min(1, u1 * 0.92 + 0.08));
              const wk = t.w * (1 - k * 0.26);
              ctx.moveTo(x0 - wk, y0);
              ctx.lineTo(x1, y1 - (k === 2 ? (ty - by) * 0.02 : 0));
              ctx.lineTo(x0 + wk, y0);
              ctx.closePath();
            }
            ctx.rect(bx - t.w * 0.08, lerp(by, ty, 0.2), t.w * 0.16, (by - ty) * 0.2);
            ctx.fill();
          }
          if (topDown > 0.01) {
            ctx.globalAlpha = topDown;
            ctx.beginPath();
            ctx.arc(t.b[0], t.b[1], t.w * 0.9, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        // lamps: pole + head
        ctx.strokeStyle = rgb(mixc([24, 30, 28], [70, 76, 74], daylight(env)));
        for (const l of LAMPS) {
          if (Math.abs(l.x - cam.px) > 800 || Math.abs(l.y - cam.py) > 800) continue;
          const b = cam.project(l.x, l.y, 0), t = cam.project(l.x, l.y, l.z);
          if (!b || !t) continue;
          ctx.lineWidth = clamp((0.18 * cam.F) / b[2], 0.5, 4);
          ctx.beginPath();
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(t[0], t[1]);
          ctx.stroke();
          lampsList.push({ t, r: (1.1 * cam.F) / t[2] });
        }
        // houses
        const HMAT = { body: { c: [30, 33, 31] }, roof: { c: [22, 25, 24] } };
        const houseFaces = [];
        const windows = [];
        for (const h of HOUSES) {
          const dx = h.x - cam.px, dy = h.y - cam.py;
          if (Math.abs(dx) > 520 || Math.abs(dy) > 520) continue;
          if (dx * cam.fwd[0] + dy * cam.fwd[1] < -20) continue;
          const mesh = boxCache(h);
          meshFaces(cam, mesh, { x: h.x, y: h.y, h: 0 }, HMAT, { ...L, lamp: 0.2 * (env.lamps ?? 1) }, houseFaces);
          if (h.lit) {
            const p = cam.project(h.x, h.y - h.d / 2 - 0.2, h.z * 0.45);
            if (p) windows.push({ p, r: (2.2 * cam.F) / p[2] });
          }
        }
        drawFaceList(houseFaces);

        // chargers (roadside)
        for (const c of CHARGERS) {
          if (Math.abs(c.x - cam.px) > 900 || Math.abs(c.y - cam.py) > 900) continue;
          const on = c.status === 'ok';
          const PM = {
            pedestal: { c: [60, 66, 64] },
            screen: { emit: true, on: on ? [140, 240, 190] : [140, 26, 30], off: [20, 20, 20], k: on ? 1 : 0.55 },
            canopy: { c: [70, 76, 74] },
            canopyTop: { c: [42, 46, 46] },
          };
          const pose = { x: c.x, y: c.y, h: c.h + Math.PI / 2 };
          const list = [];
          const lc = { ...L, lamp: on ? 1.2 : 0.0 };
          if (on) {
            meshFaces(cam, CANOPY, pose, PM, lc, list);
            for (const o of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) meshFaces(cam, CANOPY_POST, { ...pose, x: local(pose, [o[0], o[1], 0])[0], y: local(pose, [o[0], o[1], 0])[1] }, PM, lc, list);
            for (const o of [-2, 2]) { const q = local(pose, [o, 0, 0]); meshFaces(cam, PEDESTAL, { ...pose, x: q[0], y: q[1] }, PM, lc, list); }
          } else {
            meshFaces(cam, PEDESTAL, pose, PM, lc, list);
          }
          drawFaceList(list);
          if (!on) {
            const q = cam.project(...local(pose, [0, -0.25, 1.28]));
            if (q) {
              ctx.globalCompositeOperation = 'lighter';
              sprite(G.red, q[0], q[1], (0.5 * cam.F) / q[2], (0.5 * cam.F) / q[2], 0.35 + 0.25 * Math.sin(time * 3));
              ctx.globalCompositeOperation = 'source-over';
            }
          } else {
            const q = cam.project(...local(pose, [0, 0, 4.1]));
            if (q) {
              ctx.globalCompositeOperation = 'lighter';
              sprite(G.white, q[0], q[1], (6 * cam.F) / q[2], (2 * cam.F) / q[2], 0.5);
              ctx.globalCompositeOperation = 'source-over';
            }
          }
          ctx.globalAlpha = 1;
        }

        // vehicles + portable charger, depth-sorted as a group
        const vfaces = [];
        // (car, tr from above)
        if (car.visible) {
          const CM = {
            body: { c: [156, 152, 146] }, glass: { c: [8, 10, 11] }, roof: { c: [14, 15, 16] },
            tire: { c: [10, 10, 10] }, rim: { c: [48, 52, 54] }, trim: { c: [20, 22, 23] },
            tail: { emit: true, on: [255, 52, 60], off: [58, 12, 14], k: car.tail },
            head: { emit: true, on: [255, 252, 240], off: [70, 72, 72], k: car.head },
          };
          meshFaces(cam, CAR.faces, car, CM, { ...L, lamp: lampNear(car.x, car.y, env.lamps ?? 1) + (st.evse?.on > 0 ? 0.25 : 0), cabin: car.cabin, mint: 0 }, vfaces);
        }
        if (tr.visible) {
          const TM = {
            body: { c: [92, 98, 96] }, glass: { c: [9, 12, 13] }, roof: { c: [70, 76, 74] }, bed: { c: [40, 44, 43] },
            tire: { c: [10, 10, 10] }, rim: { c: [48, 52, 54] }, trim: { c: [20, 22, 23] },
            tail: { emit: true, on: [255, 52, 60], off: [58, 12, 14], k: tr.tail },
            head: { emit: true, on: [255, 252, 240], off: [70, 72, 72], k: tr.head },
          };
          meshFaces(cam, TRUCK.faces, tr, TM, { ...L, lamp: lampNear(tr.x, tr.y, env.lamps ?? 1) + tr.work * 0.5, cabin: 0, mint: 0 }, vfaces);
        }
        const ev = st.evse;
        if (ev && ev.on > 0.01) {
          const EM = { evse: { c: [44, 50, 48] }, evseTop: { c: [70, 78, 75] } };
          meshFaces(cam, EVSE.faces, { x: ev.x, y: ev.y, z: (1 - ev.on) * 0.4, h: ev.h }, EM, { ...L, lamp: 0.6 }, vfaces);
        }
        drawFaceList(vfaces);

        // cable: truck outlet → portable charger → car port
        if (ev && ev.on > 0.5 && st.cable && st.cable.p > 0) {
          const a = local(tr, TRUCK.outlet), m = [ev.x, ev.y, 0.28], b = local(car, CAR.port);
          const p = st.cable.p;
          drawCable(cam, a, m, clamp(p * 2), 0.5, st.cable.flow, time);
          if (p > 0.5) drawCable(cam, m, b, clamp(p * 2 - 1), 0.35, st.cable.flow, time + 0.5);
        }

        // light sprites
        ctx.globalCompositeOperation = 'lighter';
        // lampsOn from above
        for (const l of lampsList) sprite(G.warm, l.t[0], l.t[1], Math.max(3, l.r * 3), Math.max(3, l.r * 3), 0.85 * lampsOn);
        for (const w of windows) sprite(G.warm, w.p[0], w.p[1], Math.max(2, w.r * 2), Math.max(1.5, w.r * 1.2), 0.7 * (env.lamps ?? 1));
        const lightsFor = (pose, mesh, v) => {
          // lights only glow toward the side they face
          const fx = Math.sin(pose.h), fy = Math.cos(pose.h);
          const facing = (p, dir) => {
            const w = local(pose, p);
            const dx = cam.px - w[0], dy = cam.py - w[1], dz = cam.pz - w[2];
            const l = Math.hypot(dx, dy, dz) || 1;
            return clamp(((dx * fx + dy * fy) / l) * dir * 3 + 0.15);
          };
          for (const p of mesh.tail) {
            const q = cam.project(...local(pose, p));
            const f = facing(p, -1);
            if (q && f > 0) sprite(G.red, q[0], q[1], Math.max(3, (0.9 * cam.F) / q[2]), Math.max(2, (0.5 * cam.F) / q[2]), 0.7 * v.tail * f);
          }
          for (const p of mesh.head) {
            const q = cam.project(...local(pose, p));
            const f = facing(p, 1);
            if (q && f > 0) sprite(G.white, q[0], q[1], Math.max(3, (1.2 * cam.F) / q[2]), Math.max(2, (0.7 * cam.F) / q[2]), 0.85 * v.head * f);
          }
          if (v.hazardOn)
            for (const p of mesh.corners) {
              const q = cam.project(...local(pose, p));
              if (q) sprite(G.amber, q[0], q[1], Math.max(4, (1.1 * cam.F) / q[2]), Math.max(3, (0.8 * cam.F) / q[2]), 0.95);
            }
        };
        if (car.visible) lightsFor(car, CAR, car);
        if (tr.visible) lightsFor(tr, TRUCK, tr);
        if (ev && ev.on > 0.5 && st.cable?.connected) {
          const q = cam.project(...local(car, CAR.port));
          if (q) sprite(G.mint, q[0], q[1], Math.max(4, (0.8 * cam.F) / q[2]), Math.max(4, (0.8 * cam.F) / q[2]), 0.9 * st.cable.connected);
          const e = cam.project(ev.x, ev.y, 0.36);
          if (e) sprite(G.mint, e[0], e[1], Math.max(3, (0.5 * cam.F) / e[2]), Math.max(3, (0.5 * cam.F) / e[2]), 0.8 * st.cable.connected);
        }
        // other traffic (headlights / taillights only — reads as distant cars at night)
        for (const o of st.traffic || []) {
          const q = cam.project(o.x, o.y, 0.7);
          if (!q) continue;
          const r = Math.max(1.5, (0.7 * cam.F) / q[2]);
          const sp = (0.75 * cam.F) / q[2];
          const img = o.oncoming ? G.white : G.red;
          sprite(img, q[0] - sp, q[1], r * 2, r * 1.4, o.oncoming ? 0.9 : 0.7);
          sprite(img, q[0] + sp, q[1], r * 2, r * 1.4, o.oncoming ? 0.9 : 0.7);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }

      // map overlay
      overlay(cam, st.overlay || [], time);
    }
    ctx.globalAlpha = 1;
    drawUS(st.us, time);

    // grade: dim + vignette + fade-from-black
    if (st.env.dim > 0.001) {
      ctx.fillStyle = `rgba(3,6,5,${st.env.dim})`;
      ctx.fillRect(0, 0, W, H);
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${0.45 * (1 - daylight(env) * 0.65)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    if (st.env.fade > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${st.env.fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const bc = new Map();
  function boxCache(h) {
    let m = bc.get(h);
    if (!m) {
      m = boxLocal(h);
      bc.set(h, m);
    }
    return m;
  }
  return { resize, render };
}

import { box } from './meshes.js';
function boxLocal(h) {
  return box(0, 0, h.w, h.d, 0, h.z, 'body', 'roof');
}
