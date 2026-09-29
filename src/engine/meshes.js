// Low-poly vehicles built by lofting cross-sections. Brand-agnostic on purpose:
// the car is "an EV driver", the pickup is "a fellow EV owner who can share power".
// Local space: x = right, y = forward, z = up (meters).

function faceNormal(v) {
  // Newell's method (robust for quads/polys)
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
function center(v) {
  let x = 0, y = 0, z = 0;
  for (const p of v) (x += p[0]), (y += p[1]), (z += p[2]);
  return [x / v.length, y / v.length, z / v.length];
}
function area(v) {
  const n = faceNormal(v);
  let a = 0;
  for (let i = 1; i < v.length - 1; i++) {
    const p = v[0], q = v[i], r = v[i + 1];
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
    const wx = r[0] - p[0], wy = r[1] - p[1], wz = r[2] - p[2];
    a += Math.abs((uy * wz - uz * wy) * n[0] + (uz * wx - ux * wz) * n[1] + (ux * wy - uy * wx) * n[2]) / 2;
  }
  return a;
}

function finalize(faces, mid) {
  const out = [];
  for (const f of faces) {
    if (area(f.v) < 1e-4) continue;
    let n = faceNormal(f.v);
    const c = center(f.v);
    const d = (c[0] - mid[0]) * n[0] + (c[1] - mid[1]) * n[1] + (c[2] - mid[2]) * n[2];
    if (d < 0) {
      f.v.reverse();
      n = [-n[0], -n[1], -n[2]];
    }
    out.push({ v: f.v, m: f.m, n, c, cull: f.cull !== false });
  }
  return out;
}

function loft(sections) {
  const prof = s => {
    const zr = Math.max(s.zr, s.belt);
    return [
      [s.w * 0.97, s.zb],
      [s.w, s.belt],
      [s.rw, zr],
      [-s.rw, zr],
      [-s.w, s.belt],
      [-s.w * 0.97, s.zb],
    ];
  };
  const faces = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const A = sections[i], B = sections[i + 1];
    const pa = prof(A), pb = prof(B);
    const cabin = A.zr > A.belt + 0.12 || B.zr > B.belt + 0.12;
    for (let j = 0; j < 5; j++) {
      const v = [
        [pa[j][0], A.y, pa[j][1]],
        [pa[j + 1][0], A.y, pa[j + 1][1]],
        [pb[j + 1][0], B.y, pb[j + 1][1]],
        [pb[j][0], B.y, pb[j][1]],
      ];
      let m = 'body';
      if ((j === 1 || j === 3) && cabin) m = 'glass';
      if (j === 2) {
        const n = faceNormal(v);
        m = cabin && Math.abs(n[2]) < 0.8 ? 'glass' : A.bed ? 'bed' : cabin ? 'roof' : 'body';
      }
      faces.push({ v, m });
    }
  }
  const first = prof(sections[0]).map(p => [p[0], sections[0].y, p[1]]);
  const last = prof(sections[sections.length - 1]).map(p => [p[0], sections[sections.length - 1].y, p[1]]);
  faces.push({ v: first, m: 'body' }, { v: last, m: 'body' });
  return faces;
}

function wheel(x, y, r, hw) {
  const faces = [];
  const ring = side =>
    Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      return [x + side * hw, y + Math.cos(a) * r, r + Math.sin(a) * r];
    });
  const L = ring(-1), R = ring(1);
  for (let k = 0; k < 8; k++) faces.push({ v: [L[k], L[(k + 1) % 8], R[(k + 1) % 8], R[k]], m: 'tire' });
  faces.push({ v: R.slice(), m: 'rim' }, { v: L.slice().reverse(), m: 'rim' });
  // upper tread sits inside the wheel arch; dropping it avoids painter's-order bleed from above
  return finalize(faces, [x, y, r]).filter(f => !(f.m === 'tire' && f.n[2] > 0.35));
}

function quad(x0, x1, y, z0, z1, m) {
  return { v: [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], m, cull: false };
}
export function box(cx, cy, w, d, z0, z1, m = 'body', top = m) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  return finalize(
    [
      { v: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], m },
      { v: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], m },
      { v: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], m },
      { v: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], m },
      { v: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], m: top },
    ],
    [cx, cy, (z0 + z1) / 2]
  );
}

/* ---------- the driver's EV: a modern crossover silhouette ---------- */
const CAR_SECTIONS = [
  { y: -2.34, w: 0.84, zb: 0.38, belt: 0.88, zr: 0.97, rw: 0.7 },
  { y: -2.24, w: 0.93, zb: 0.32, belt: 0.92, zr: 1.06, rw: 0.7 },
  { y: -2.0, w: 0.96, zb: 0.3, belt: 0.94, zr: 1.3, rw: 0.62 },
  { y: -1.5, w: 0.97, zb: 0.28, belt: 0.94, zr: 1.5, rw: 0.68 },
  { y: 0.42, w: 0.97, zb: 0.28, belt: 0.93, zr: 1.52, rw: 0.7 },
  { y: 1.32, w: 0.96, zb: 0.28, belt: 0.88, zr: 0.99, rw: 0.8 },
  { y: 2.08, w: 0.94, zb: 0.3, belt: 0.8, zr: 0.85, rw: 0.84 },
  { y: 2.36, w: 0.84, zb: 0.36, belt: 0.66, zr: 0.7, rw: 0.76 },
];
export const CAR = (() => {
  const body = finalize(loft(CAR_SECTIONS), [0, 0, 0.8]);
  const lights = [
    // full-width rear light bar + front light bar + lamps
    { ...quad(-0.84, 0.84, -2.345, 0.76, 0.84, 'tail'), n: [0, -1, 0], c: [0, -2.35, 0.8] },
    { ...quad(-0.86, 0.86, -2.343, 0.32, 0.5, 'trim'), n: [0, -1, 0], c: [0, -2.35, 0.41] },
    { ...quad(-0.8, 0.8, 2.363, 0.36, 0.48, 'trim'), n: [0, 1, 0], c: [0, 2.37, 0.42] },
    { ...quad(-0.8, 0.8, 2.365, 0.6, 0.63, 'head'), n: [0, 1, 0], c: [0, 2.37, 0.62] },
    { ...quad(-0.8, -0.5, 2.366, 0.52, 0.6, 'head'), n: [0, 1, 0], c: [-0.65, 2.37, 0.56] },
    { ...quad(0.5, 0.8, 2.366, 0.52, 0.6, 'head'), n: [0, 1, 0], c: [0.65, 2.37, 0.56] },
  ].map(f => ({ ...f, cull: true }));
  const wheels = [
    ...wheel(-0.86, -1.42, 0.36, 0.13),
    ...wheel(0.86, -1.42, 0.36, 0.13),
    ...wheel(-0.86, 1.46, 0.36, 0.13),
    ...wheel(0.86, 1.46, 0.36, 0.13),
  ];
  return {
    faces: [...wheels, ...body, ...lights],
    len: 4.7,
    port: [0.97, -1.72, 0.84], // right-rear quarter (conceptual; varies by vehicle)
    tail: [[-0.72, -2.4, 0.8], [0.72, -2.4, 0.8]],
    head: [[-0.62, 2.42, 0.58], [0.62, 2.42, 0.58]],
    corners: [[-0.86, -2.36, 0.8], [0.86, -2.36, 0.8], [-0.8, 2.36, 0.6], [0.8, 2.36, 0.6]],
  };
})();

/* ---------- provider: generic electric pickup ---------- */
const TRUCK_SECTIONS = [
  { y: -2.95, w: 1.0, zb: 0.5, belt: 1.12, zr: 1.14, rw: 0.98, bed: true },
  { y: -0.62, w: 1.0, zb: 0.46, belt: 1.12, zr: 1.14, rw: 0.98, bed: true },
  { y: -0.6, w: 1.0, zb: 0.46, belt: 1.14, zr: 1.9, rw: 0.84 },
  { y: 0.85, w: 1.0, zb: 0.46, belt: 1.14, zr: 1.93, rw: 0.86 },
  { y: 1.62, w: 1.0, zb: 0.46, belt: 1.16, zr: 1.24, rw: 0.96 },
  { y: 2.62, w: 1.0, zb: 0.48, belt: 1.12, zr: 1.14, rw: 0.97 },
  { y: 2.95, w: 0.96, zb: 0.54, belt: 1.0, zr: 1.02, rw: 0.92 },
];
export const TRUCK = (() => {
  const body = finalize(loft(TRUCK_SECTIONS), [0, 0, 1.0]);
  const lights = [
    { ...quad(-0.9, -0.62, -2.955, 0.86, 1.06, 'tail'), n: [0, -1, 0], c: [-0.76, -2.96, 0.96] },
    { ...quad(0.62, 0.9, -2.955, 0.86, 1.06, 'tail'), n: [0, -1, 0], c: [0.76, -2.96, 0.96] },
    { ...quad(-0.9, 0.9, 2.965, 0.9, 0.95, 'head'), n: [0, 1, 0], c: [0, 2.97, 0.92] },
    { ...quad(-0.96, 0.96, -2.953, 0.5, 0.7, 'trim'), n: [0, -1, 0], c: [0, -2.96, 0.6] },
    { ...quad(-0.9, 0.9, 2.963, 0.52, 0.8, 'trim'), n: [0, 1, 0], c: [0, 2.97, 0.66] },
  ].map(f => ({ ...f, cull: true }));
  const wheels = [
    ...wheel(-0.9, -1.85, 0.43, 0.16),
    ...wheel(0.9, -1.85, 0.43, 0.16),
    ...wheel(-0.9, 1.9, 0.43, 0.16),
    ...wheel(0.9, 1.9, 0.43, 0.16),
  ];
  return {
    faces: [...wheels, ...body, ...lights],
    len: 5.9,
    outlet: [0.92, -1.4, 1.02], // bed-side power outlet (conceptual)
    tail: [[-0.76, -3.0, 0.96], [0.76, -3.0, 0.96]],
    head: [[-0.7, 3.0, 0.92], [0.7, 3.0, 0.92]],
    corners: [[-0.95, -2.96, 1.0], [0.95, -2.96, 1.0], [-0.92, 2.96, 0.95], [0.92, 2.96, 0.95]],
  };
})();

/* ---------- portable charger (generic, not proprietary) ---------- */
export const EVSE = (() => {
  const f = box(0, 0, 0.42, 0.3, 0, 0.34, 'evse', 'evseTop');
  return { faces: f, jack: [0, 0, 0.3] };
})();

export const PEDESTAL = box(0, 0, 0.55, 0.38, 0, 1.7, 'pedestal', 'pedestal').concat(
  finalize([{ v: [[-0.2, -0.195, 1.05], [0.2, -0.195, 1.05], [0.2, -0.195, 1.5], [-0.2, -0.195, 1.5]], m: 'screen' }], [0, 0, 1.2])
);
export const CANOPY = box(0, 0, 9, 5, 4.2, 4.55, 'canopy', 'canopyTop');
export const CANOPY_POST = box(0, 0, 0.3, 0.3, 0, 4.2, 'pedestal', 'pedestal');
