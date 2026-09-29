// Scene order + scroll length (in viewport heights). Scroll = distance.
// `rep` is the representative frame shown when the visitor prefers reduced motion.
export const SCENES = [
  { id: 'road', h: 260, rep: 0.5, chapter: 'Drive' },
  { id: 'wrong', h: 260, rep: 0.7 },
  { id: 'anxiety', h: 300, rep: 0.95, chapter: 'Stranded' },
  { id: 'quiet', h: 180, rep: 0.6 },
  { id: 'mocha', h: 260, rep: 0.85, chapter: 'Request' },
  { id: 'map', h: 250, rep: 0.9 },
  { id: 'moving', h: 320, rep: 0.8, chapter: 'Help moves' },
  { id: 'arrival', h: 250, rep: 0.85 },
  { id: 'power', h: 280, rep: 0.7, chapter: 'Charge' },
  { id: 'back', h: 230, rep: 0.7, chapter: 'Back on the road' },
  { id: 'provider', h: 230, rep: 0.5, chapter: 'Providers' },
  { id: 'become', h: 320, rep: 0.95 },
  { id: 'network', h: 320, rep: 0.95, chapter: 'Network' },
  { id: 'fixed', h: 290, rep: 0.9 },
  { id: 'powerbridge', h: 260, rep: 0.8, chapter: 'PowerBridge Pro' },
  { id: 'sides', h: 280, rep: 0.95, chapter: 'How it works' },
  { id: 'final', h: 300, rep: 0.95, chapter: 'Get help' },
];
export const SCENE_INDEX = Object.fromEntries(SCENES.map((s, i) => [s.id, i]));
