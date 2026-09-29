import { useEffect, useRef } from 'react';
import { SCENES } from './scenes.js';
import { SITE, LINKS } from './content.js';
import { TopBar, TripNav, Hud, Footer, Logo } from './components/Chrome.jsx';
import { DriverPhone, ProviderPhone } from './components/Phone.jsx';
import { PowerBridge, TwoSides, FinalCta, Cta } from './components/Blocks.jsx';

function Scene({ id, children, label }) {
  const i = SCENES.findIndex(s => s.id === id);
  const s = SCENES[i];
  return (
    <section id={id} className={`scene scene-${id}`} data-scene={i} data-vars={['powerbridge', 'sides', 'final'].includes(id) ? '' : undefined} style={{ '--h': s.h }} aria-label={label}>
      {children}
    </section>
  );
}
/** A caption visible between local progress a → b of its scene. */
const Cap = ({ w, className = '', children, as: Tag = 'div' }) => (
  <Tag className={`cap ${className}`} data-w={w}>
    {children}
  </Tag>
);

export default function App() {
  const canvasRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    // the engine is a separate chunk so the HTML + copy paint first
    import('./engine/engine.js').then(({ startEngine }) => {
      if (cancelled) return;
      try {
        stop = startEngine({ canvas: canvasRef.current, root: rootRef.current });
        document.documentElement.classList.add('engine');
      } catch (e) {
        console.error(e);
        document.documentElement.classList.add('no-engine');
      }
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <>
      <TopBar />
      <div className="stage" aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
      <Hud />
      <TripNav />

      <main ref={rootRef} className="story">
        {/* 1 — THE ROAD */}
        <Scene id="road" label="Driving at night">
          <p className="sr-only">Illustrative scenario. You're driving an EV at night. Range: 32 miles, then 28, then 24.</p>
          <Cap w="-1 0.12" className="cap-cue">
            <p className="cue">
              <span>Scroll to drive</span>
              <i aria-hidden="true" />
            </p>
          </Cap>
          <Cap w="0.5 0.86" className="cap-quiet">
            <p className="whisper">Just another drive.</p>
          </Cap>
        </Scene>

        {/* 2 — SOMETHING IS WRONG */}
        <Scene id="wrong" label="The nearest charger is too far">
          <p className="sr-only">Range drops to 18 miles. The nearest charger is 27 miles away. Range keeps dropping to 9 miles.</p>
          <Cap w="0.44 0.74" className="cap-quiet">
            <p className="whisper">The math stops working.</p>
          </Cap>
          <Cap w="0.82 1.08" className="cap-quiet">
            <p className="whisper">Maybe that one.</p>
          </Cap>
        </Scene>

        {/* 3 — RANGE ANXIETY */}
        <Scene id="anxiety" label="Running out of range">
          <p className="sr-only">The closer charger is out of service. Six miles, four, two, one. The car slows and stops. Zero percent.</p>
          <Cap w="0.14 0.34" className="cap-quiet">
            <p className="whisper warn">Out of service.</p>
          </Cap>
          <Cap w="0.42 0.6" className="cap-quiet">
            <p className="whisper">Slower. Quieter. Still not enough.</p>
          </Cap>
          <Cap w="0.84 1.3" className="cap-hero cap-zero">
            <p className="zero" aria-label="Zero percent">0%</p>
          </Cap>
        </Scene>

        {/* 4 — SILENCE */}
        <Scene id="quiet" label="Stranded">
          <Cap w="0.3 1.02" className="cap-hero">
            <h2 className="display">
              Out of range doesn&rsquo;t have to mean <em>stranded.</em>
            </h2>
            <p className="sub" style={{ '--d': 1 }}>{SITE.driverBody}</p>
          </Cap>
        </Scene>

        {/* 5 — MOCHA */}
        <Scene id="mocha" label="Request a charge with Mocha">
          <Cap w="0.04 0.34" className="cap-hero">
            <Logo className="reveal-logo" alt="Mocha" />
            <h1 className="display h1">{SITE.h1}</h1>
          </Cap>
          <Cap w="0.3 1.12" className="cap-phone">
            <div className="phone-side">
              <p className="kicker">Need a charge</p>
              <p className="step-line">Location</p>
              <p className="step-line">Request</p>
            </div>
            <DriverPhone />
          </Cap>
        </Scene>

        {/* 6 — THE MAP */}
        <Scene id="map" label="Matched with a nearby provider">
          <Cap w="0.44 0.72" className="cap-low">
            <p className="line">One point on the map. <span className="dim">You.</span></p>
          </Cap>
          <Cap w="0.76 1.08" className="cap-low">
            <h2 className="line">Matched with a nearby provider.</h2>
            <p className="sub">Our platform matches those in need with nearby providers.</p>
          </Cap>
        </Scene>

        {/* 7 — HELP IS MOVING */}
        <Scene id="moving" label="The charger comes to you">
          <Cap w="0.06 0.3" className="cap-low">
            <p className="line">Help is moving.</p>
          </Cap>
          <Cap w="0.66 1.0" className="cap-low">
            <h2 className="line">The charger comes to you.</h2>
            <p className="sub">{SITE.noTow}</p>
          </Cap>
        </Scene>

        {/* 8 — ARRIVAL */}
        <Scene id="arrival" label="A provider arrives and connects">
          <Cap w="0.3 0.52" className="cap-low">
            <p className="line">A fellow EV owner pulls in.</p>
          </Cap>
          <Cap w="0.76 1.06" className="cap-hero cap-connected">
            <p className="display sm">Connected.</p>
          </Cap>
        </Scene>

        {/* 9 — POWER RETURNS */}
        <Scene id="power" label="Charging">
          <Cap w="0.14 0.44" className="cap-low">
            <p className="line">Power returns.</p>
            <p className="sub dim">Battery values shown are illustrative. Charging time and added range vary.</p>
          </Cap>
          <Cap w="0.54 0.86" className="cap-hero">
            <h2 className="display">Enough to keep moving.</h2>
          </Cap>
        </Scene>

        {/* 10 — BACK ON THE ROAD */}
        <Scene id="back" label="Back on the road">
          <Cap w="0.4 0.92" className="cap-hero">
            <h2 className="display">Back on the road.</h2>
            <p className="sub">{SITE.steps[2].body}</p>
          </Cap>
        </Scene>

        {/* 11 — CHANGE PERSPECTIVE */}
        <Scene id="provider" label="The provider's side">
          <Cap w="0.06 0.3" className="cap-low">
            <p className="line">Meanwhile, the provider.</p>
          </Cap>
          <Cap w="0.3 0.68" className="cap-phone cap-phone-p">
            <div className="phone-side">
              <p className="kicker">Another driver needs a charge.</p>
            </div>
            <ProviderPhone />
          </Cap>
        </Scene>

        {/* 12 — BECOME THE CHARGER */}
        <Scene id="become" label="Become a charge provider">
          <Cap w="0.1 0.4" className="cap-low">
            <p className="line">Have mobile charging capability?</p>
          </Cap>
          <Cap w="0.42 0.68" className="cap-low">
            <p className="line">Put it to work.</p>
          </Cap>
          <Cap w="0.7 1.06" className="cap-low cap-offer">
            <h2 className="line">{SITE.providerTitle}</h2>
            <p className="sub">{SITE.providerBody}</p>
            <Cta href={LINKS.app}>{SITE.providerCta}</Cta>
          </Cap>
        </Scene>

        {/* 13 — ONE REQUEST BECOMES A NETWORK */}
        <Scene id="network" label="Nationwide coverage">
          <Cap w="0.06 0.34" className="cap-low">
            <p className="line">One request becomes a network.</p>
          </Cap>
          <Cap w="0.66 1.04" className="cap-low cap-cov">
            <h2 className="line">{SITE.coverageTitle}.</h2>
            <p className="sub">{SITE.coverageBody}</p>
            <p className="fine">Animation is illustrative. It doesn&rsquo;t show actual provider locations, counts or availability.</p>
          </Cap>
        </Scene>

        {/* 14 — CHARGING WHERE CHARGERS AREN'T */}
        <Scene id="fixed" label="The charge comes to you">
          <Cap w="0.3 0.54" className="cap-low">
            <p className="kicker">Traditional charging</p>
            <h2 className="line">You go to the charger.</h2>
          </Cap>
          <Cap w="0.58 1.0" className="cap-low">
            <p className="kicker mint">Mocha</p>
            <h2 className="line">The charge comes to you.</h2>
          </Cap>
        </Scene>

        {/* 15 — POWERBRIDGE PRO */}
        <Scene id="powerbridge" label="PowerBridge Pro by RoamEnergy">
          <Cap w="0.08 1.02" className="cap-block">
            <PowerBridge />
          </Cap>
        </Scene>

        {/* 16 — TWO SIDES, ONE NETWORK */}
        <Scene id="sides" label="How Mocha works">
          <Cap w="0.0 1.02" className="cap-block">
            <TwoSides />
          </Cap>
        </Scene>

        {/* 17 — FINAL JOURNEY */}
        <Scene id="final" label="Get help or become a provider">
          <Cap w="0.14 0.5" className="cap-hero">
            <h2 className="display">
              When your range runs out,
              <span className="line2"> your options shouldn&rsquo;t.</span>
            </h2>
          </Cap>
          <Cap w="0.56 9" className="cap-block cap-final">
            <FinalCta />
          </Cap>
        </Scene>
      </main>
      <Footer />
    </>
  );
}
