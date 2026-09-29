// The film's clock, in seconds. Shared by the renderer (film.js), the player and the React markup
// (captions + chapter buttons), so copy timing and picture timing can never drift apart.
export const B = {
  hero: 0,
  drive: 2.8,
  tooFar: 6.4,
  critical: 9.4,
  stop: 12.6, // start coasting
  stopped: 14.0,
  request: 16.0,
  map: 18.6,
  moving: 22.0,
  arrive: 27.0,
  connect: 30.2,
  charge: 31.6,
  unplug: 35.4,
  back: 36.4,
  cta: 40.6,
};
export const DURATION = 43.5;

export const CHAPTERS = [
  { t: B.hero, label: 'Driving' },
  { t: B.stop, label: 'Stranded' },
  { t: B.request, label: 'Request' },
  { t: B.map, label: 'Provider' },
  { t: B.connect, label: 'Charging' },
  { t: B.back, label: 'Back on the road' },
];

/** Illustrative range (mi) — keyframes, linear between. */
export const RANGE_KEYS = [
  [0, 32],
  [B.drive, 29],
  [B.tooFar, 18],
  [B.critical, 9],
  [B.stop, 1],
  [B.stopped, 0],
];
export const CHARGER_GAP = 9; // nearest working charger is always 9 "mi" beyond the available range

/** Illustrative battery % while charging — steps with small holds, no time claims. */
export const BATTERY_KEYS = [
  [B.charge + 0.2, 0],
  [B.charge + 0.8, 3],
  [B.charge + 1.1, 3],
  [B.charge + 1.7, 7],
  [B.charge + 2.0, 7],
  [B.charge + 2.7, 12],
];

export function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const u = (t - t0) / (t1 - t0 || 1);
      const e = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * e;
    }
  }
  return keys[keys.length - 1][1];
}
