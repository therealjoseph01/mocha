# Mocha EV — Research brief & storyboard

Written before any code. Researched September 29, 2026.

## 1. What the live site says (source of truth)

Pages: `mochaev.com/`, `/powerbridgepro.html`, `/privacy.html`. The app (`app.mochaev.com`) needs a login (PropelAuth: Google, Microsoft, LinkedIn, magic link or email), so **the real request UI is not public**.

| Topic | What's verified | Source |
|---|---|---|
| What Mocha does | "Emergency EV Charging When You Need It Most." "Mocha gets you back on the road quickly by bringing a mobile charger to you." | Home |
| Two-sided marketplace | Drivers: "I Need a Charge — Stranded with a depleted battery? Find help nearby." Providers: "I'm a Charge Provider — Earn money helping fellow EV owners by offering emergency charging." | Home |
| How it works | 1 Sign Up ("Create an account as someone who needs help or can provide it."), 2 Connect ("Our platform matches those in need with nearby providers."), 3 Get Charged ("Receive emergency charging and get back on the road quickly.") | Home |
| Coverage | "Mobile EV charging is available through our growing network of service providers across the continental United States." | Home |
| CTAs | Get Help Now, Become a Provider, Sign In. All go to `https://app.mochaev.com/` | Home |
| App | A web app at app.mochaev.com. The privacy policy mentions a "mobile application", but I found no App Store or Play listing, so the design never claims a native app. | Privacy + search |
| Request data | Real-time GPS location for dispatch, vehicle make/model, battery level (if provided). Payment runs through third-party processors. | Privacy |
| Pricing | **Not published.** Provider terms are shown during signup. | Home, forum reply by Mocha |
| Providers | "Fellow EV owners." Mocha's own forum posts (Jul 2026) invited F‑150 Lightning "Pro Power" and Cybertruck owners to be providers, so providers are EV owners whose vehicles can share power. | Mocha forum posts |
| Equipment | Mocha doesn't make charging hardware. Providers bring their own mobile charging capability. | All of the above |
| PowerBridge Pro | Made by **RoamEnergy**, a partner. Mocha users get an "Additional 10% off" (code link `roamenergy.tech/discount/MOCHA`). It "taps into CCS1 and NACS vehicles" and is "compatible with validated CCS-enabled EVs. Vehicle compatibility varies by model." Uses on Mocha's page: keep the lights on, charge a stranded EV, outdoors, construction site. | /powerbridgepro.html, roamenergy.tech |
| Brand | Wordmark logo (dark green, plug inside the "O"). Inter at 400/600/700/900. Tailwind greens (green‑600/700/800/900) on a mint gradient (#f0fff4 → #d9fbe7). Dark green footer. | Home CSS |
| Imagery | Logo webp, plus one RoamEnergy lifestyle image (EV + PowerBridge + RV). No vehicle, provider or app photography of Mocha's own. | Home |
| Terminology | "charge provider", "provider", "stranded", "depleted battery", "emergency charging", "mobile charger", "get back on the road", "network of service providers". Forum: "No waiting for a tow truck." | Home, forum |
| SEO | Title: "Mocha EV Electric Vehicle rescue service". Meta description targets "electric vehicle mobile charging", "Nationwide US rescue service", "out of charge" and a list of states. No canonical, OG tags or structured data. | Home head |

Known but **deliberately not used** (they're off-site and not on mochaev.com): "up to 30 minutes at 9.2 kW, typically enough for 20 mi of range" (Mocha forum reply). The page never shows a charging speed, response time, provider count, price or earnings figure.

## 2. Accuracy rules for the build

* Every range, mileage and battery number sits inside a labeled **illustrative scenario**. There are no timers, ETAs or kW figures.
* The phone UI is labeled **conceptual** because the real app is behind a login.
* Provider vehicle: a generic electric pickup with a portable charger on the ground. No Mocha-branded vehicles, no proprietary hardware.
* PowerBridge Pro: always credited "by RoamEnergy". Compatibility caveat plus a link to RoamEnergy's tested vehicle list.
* The US map shows the lower 48 only, with dots labeled "illustrative, not actual provider locations".
* Fleets, apartments and events are left out because the site doesn't support them. Environments come only from Mocha's pages: roadside/road trips, home outage, outdoors, job site (the last three via PowerBridge Pro).

## 3. Storyboard (scroll = distance)

| # | Scene | What scroll moves | Copy |
|---|---|---|---|
| 1 | The road | The car drives forward. Range 32→24. | RANGE 32 MI |
| 2 | Something is wrong | Driving. Range 24→9. At 18 mi a charger pin appears 27 mi away. | NEAREST CHARGER 27 MI · TOO FAR |
| 3 | Range anxiety | Streetlights thin out. A dark charger passes (OUT OF SERVICE). 1 mi, the car coasts to the shoulder. 0%. | 1 MI → 0% |
| 4 | Silence | Nothing moves. Hazards blink. | OUT OF RANGE DOESN'T HAVE TO MEAN STRANDED. |
| 5 | Mocha | Logo appears. Phone: Need a charge → Share location → Request → Request sent | H1 "Emergency EV charging when you need it most." |
| 6 | Road → map | The camera pitches from behind the car to straight down. The road simplifies into a line and the car becomes a dot. A provider appears. | MATCHED WITH A NEARBY PROVIDER |
| 7 | Help is moving | The provider dot travels the route. The camera dips to the provider's truck at road level, then rises again. | THE CHARGER COMES TO YOU |
| 8 | Arrival | Map → road. The truck pulls onto the shoulder, a portable charger comes down, the cable connects. | CONNECTED |
| 9 | Power returns | Battery 0→12% (illustrative). Headlights and cabin light return. Cable disconnects. | ENOUGH TO KEEP MOVING |
| 10 | Back on the road | The car merges and the camera follows. Charger status turns "IN RANGE". | BACK ON THE ROAD |
| 11 | Change perspective | The car drives away and the camera stays with the provider. The provider's phone gets a new request. | ANOTHER DRIVER NEEDS A CHARGE |
| 12 | Become the charger | Map: the provider completes job after job, other providers join, completed jobs pile up. | HAVE MOBILE CHARGING CAPABILITY? PUT IT TO WORK. → Become a Provider |
| 13 | One request → network | Zoom out from neighborhood to city to region, then into the lower‑48 US map with live-feeling connections. | NATIONWIDE COVERAGE (Mocha copy) |
| 14 | Fixed vs moving | City map. Fixed chargers stay still, a stranded dot sits far from them, a provider moves in. | YOU GO TO THE CHARGER. / THE CHARGE COMES TO YOU. |
| 15 | PowerBridge Pro | EV → PowerBridge Pro → another EV / home essentials / outdoors / job site. | EV = BACKUP POWER (Mocha copy) + compatibility + 10% offer |
| 16 | Two sides, one network | Driver and provider slide together, meet at Mocha, then Sign Up → Connect → Get Charged. | Mocha's own 3 steps |
| 17 | Final journey | Dawn. Same car, driving easily. The camera pulls away. | WHEN YOUR RANGE RUNS OUT, YOUR OPTIONS SHOULDN'T. → Get Help Now / Become a Provider |

Scenes 13 and 16 of the brief were merged into 14 above. The brief's "environments" scene became PowerBridge Pro's real use cases, because only those are supported.

## 4. Technical decisions

* **One camera, one world.** The road, the map and the US zoom are all rendered by a small custom 2.5D engine on a single Canvas 2D. The world is a flat plane of roads. An orbit camera (target, yaw, pitch, distance) projects it. Road → map is just pitch 11° → 90° plus distance 11 m → 2.6 km, so the transition is spatially continuous rather than a cut. Vehicles are low-poly meshes (lofted cross-sections, back-face culled, painter-sorted) so they read correctly from behind, from the side and from above.
* **Why not Three.js / R3F:** about 150 KB gzip for a flat world with two vehicles. The custom projector is about 10 KB and gives full control over the art direction (night lighting, headlight cones, map line styles).
* **Scroll smoothing:** native scroll, no hijacking. The renderer eases toward the scroll position (critically damped) so scrubbing feels cinematic.
* **Copy is DOM, not canvas.** Every scene is a real `<section>` with headings and paragraphs, pre-rendered to static HTML at build time (React `renderToString`), then hydrated. Crawlers and screen readers get the whole story.
* **Emergency UX:** a discreet "Stranded now? Get help" link is visible from the first frame. A real stranded driver should never have to scroll a film to find help.
* **Reduced motion:** captions show as static blocks, the canvas shows one representative frame per scene, and there's no smoothing.
* **Mobile:** portrait-specific camera (higher chase camera, car in the lower third), HUD pinned to the top edge, captions at the bottom, the two-sides scene stacks vertically, DPR capped at 1.5, fewer map entities.
* **SEO:** title and description target emergency / mobile / roadside EV charging. Canonical, OG/Twitter, JSON-LD `Organization` + `Service` (areaServed: contiguous US), sitemap, robots.

---

# v2 — Self-playing film (after Mocha's feedback)

> "It may be a better idea as a self-playing animation or video. It requires a lot of scrolling to go through the entire sequence."

## Audit of v1 (live at mocha-vert-tau.vercel.app)

* **46 viewport heights of scroll** at 1720×997 (17 scenes, 180–320 vh each). The core rescue alone (drive → back on road, 10 scenes) was ~26 screens.
* Keep: golden-hour → night road, range/charger HUD, the 0% stop, road → map camera rise, provider route, map → road descent, cable + charging payoff, drive-off at dawn, brand + CTAs.
* Cut from the film: the "quiet" hold scene (folded into a 2 s beat), the provider road-level dip (unreadable at film speed), provider POV, multi-job map, national zoom, fixed-vs-moving, PowerBridge and two-sides scenes. Coverage, provider and PowerBridge move into short normal sections below.
* Bug spotted in v1: HUD battery readout overlapped bottom-left captions on desktop.

## Architecture: time, not scroll

`state = film(time)` — a pure function of seconds. Play, pause, seek, replay and scrubbing are all just "which second are we on", so scrubbing is exact and smooth. The renderer, world, meshes and camera from v1 are reused unchanged.

**Video vs real-time canvas:** stay real-time. The whole engine is ~28 KB gzip vs several MB for a 40 s 1080p video (plus a second portrait encode). Canvas gives exact portrait framing, crisp HUD, frame-accurate scrubbing, and no decode stalls. Frames render in single-digit milliseconds on the 2D canvas. Nothing in the film is expensive enough to justify video.

## Timeline (43.5 s)

| s | Beat | On screen |
|---|---|---|
| 0.0–2.8 | Hero | Logo + H1 over golden-hour road; range 32 |
| 2.8–6.4 | Drive | 29 → 18 mi; nearest charger appears at 27 mi |
| 6.4–9.4 | Too far | 18 → 9; "Nearest charger: too far"; dusk → night |
| 9.4–12.6 | Critical | 9 → 1; passes an out-of-service charger |
| 12.6–14.0 | Stop | Coasts to the shoulder |
| 14.0–16.0 | 0% | Silence. Hazards. |
| 16.0–18.6 | Request | "Need a charge?" → location shared → request sent |
| 18.6–22.0 | Map | Camera rises, car becomes a dot, provider found |
| 22.0–27.0 | Help moving | Provider travels the route; "Help is on the way" |
| 27.0–30.2 | Arrival | Map → road; provider pulls in behind |
| 30.2–31.6 | Connect | Portable charger, cable, "Connected" |
| 31.6–35.4 | Charging | 0 → 3 → 7 → 12% (illustrative), lights wake |
| 35.4–36.4 | Disconnect | Cable off |
| 36.4–40.6 | Back on road | Car merges, first light; "Back on the road" |
| 40.6–43.5 | CTA | Camera pulls away; logo, I Need a Charge / I'm a Charge Provider |

Chapters (scrubber): Driving 0 · Stranded 12.6 · Request 16 · Provider 18.6 · Charging 30.2 · Back on the road 36.4.

## Playback rules

Starts only when ≥35% of the hero is visible; pauses when the hero leaves the viewport or the tab is hidden; resumes only if it wasn't paused by the visitor; never restarts on its own; ends on the CTA frame and waits for Replay. `prefers-reduced-motion`: no autoplay, a still frame, chapter buttons jump between stills. No audio. Scroll is never intercepted. CTAs are in the top bar from the first frame.

## Page after the film

Hero film (1 screen) → Drivers → Providers → Coverage → PowerBridge Pro → Final CTA → Footer. About 5–6 screens total instead of 46.
