import { useEffect, useRef } from 'react';
import { LINKS, SITE } from '../content.js';
import { B, DURATION, CHAPTERS } from '../timeline.js';
import { Hud, Logo } from './Chrome.jsx';
import { Cta } from './Blocks.jsx';

/** A caption visible between two moments of the film (seconds). */
const Cue = ({ at, until, className = '', children }) => (
  <div className={`cue ${className}`} data-cue={`${at} ${until}`}>
    {children}
  </div>
);

/** Conceptual request — Mocha's real app is behind a login, so this is labeled as a concept. */
function RequestCard() {
  const s = B.request;
  return (
    <figure className="req" data-steps={`${s + 0.9} ${s + 1.5}`} data-step="0">
      <ol>
        <li className="req-0"><span className="req-i" />Need a charge</li>
        <li className="req-1"><span className="req-i" />Location shared</li>
        <li className="req-2"><span className="req-i" />Request sent</li>
      </ol>
      <figcaption>Conceptual. Requests are made in the <a href={LINKS.app}>Mocha web app</a>.</figcaption>
    </figure>
  );
}

const Icon = ({ d }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
);

export function Film() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let stop = () => {};
    let cancelled = false;
    // the renderer is its own chunk: HTML, copy and CTAs paint first
    import('../engine/player.js').then(({ startFilm }) => {
      if (cancelled) return;
      try {
        stop = startFilm({ root: rootRef.current, canvas: canvasRef.current });
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
    <section className="film" id="story" ref={rootRef} aria-labelledby="film-title">
      <canvas ref={canvasRef} className="film-canvas" aria-hidden="true" />
      <div className="film-shade" aria-hidden="true" />
      <Hud />

      <p className="sr-only">
        A 43-second film, illustrative scenario: an EV's range drops from 32 miles to zero before it can reach
        the nearest charger. The driver requests a charge through Mocha, a nearby charge provider is matched and
        drives to them, connects portable charging equipment, and the EV gets enough charge to get back on the road.
      </p>

      <div className="cues">
        <Cue at={-1} until={B.drive + 0.2} className="cue-hero cue-title">
          <Logo className="title-logo" alt="Mocha" />
          <h1 id="film-title" className="display h1">{SITE.h1}</h1>
        </Cue>
        <Cue at={B.tooFar + 0.2} until={B.critical - 0.1} className="cue-line">
          <p className="line">Nearest charger: <span className="warn">too far.</span></p>
        </Cue>
        <Cue at={B.critical + 0.7} until={B.stop - 0.2} className="cue-line">
          <p className="line"><span className="bad">Out of service.</span></p>
        </Cue>
        <Cue at={B.stopped} until={B.request + 0.1} className="cue-big">
          <p className="zero" aria-label="Zero percent">0%</p>
        </Cue>
        <Cue at={B.request} until={B.map + 0.3} className="cue-hero cue-request">
          <h2 className="display">Need a charge?</h2>
          <RequestCard />
        </Cue>
        <Cue at={B.map + 1.9} until={B.moving + 1.6} className="cue-line">
          <h2 className="line">Provider found.</h2>
          <p className="sub">{SITE.steps[1].body}</p>
        </Cue>
        <Cue at={B.moving + 1.7} until={B.arrive + 0.2} className="cue-line">
          <h2 className="line">Help is on the way.</h2>
          <p className="sub">The charger comes to you.</p>
        </Cue>
        <Cue at={B.arrive + 1.2} until={B.connect + 0.2} className="cue-line">
          <p className="line">A fellow EV owner pulls in.</p>
        </Cue>
        <Cue at={B.connect + 1.1} until={B.charge + 0.6} className="cue-hero">
          <p className="display sm">Connected.</p>
        </Cue>
        <Cue at={B.charge + 0.6} until={B.charge + 2.9} className="cue-line">
          <p className="line">Power returns.</p>
          <p className="sub dim">Illustrative values. Charging time and added range vary.</p>
        </Cue>
        <Cue at={B.charge + 2.9} until={B.back} className="cue-hero">
          <h2 className="display">Enough to continue.</h2>
        </Cue>
        <Cue at={B.back + 1.0} until={B.cta + 0.2} className="cue-hero">
          <h2 className="display">Back on the road.</h2>
        </Cue>
        <Cue at={B.cta + 0.2} until={999} className="cue-end">
          <Logo className="end-logo" alt="Mocha" />
          <p className="end-lede">{SITE.lede}</p>
          <div className="end-ctas">
            <Cta href={LINKS.app}>{SITE.driverTitle}</Cta>
            <Cta href={LINKS.app} kind="ghost">{SITE.providerTitle}</Cta>
          </div>
        </Cue>
      </div>

      <div className="controls">
        <button type="button" className="ctl ctl-toggle" data-film="toggle" data-state="paused" aria-label="Play the story">
          <span className="i-play"><Icon d="M4 2.5v11l9-5.5z" /></span>
          <span className="i-pause"><Icon d="M4 2.5h3v11H4zM9 2.5h3v11H9z" /></span>
          <span className="i-replay"><Icon d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7l1.4.5A4 4 0 1 0 8 4v2L4.8 3.3 8 .5z" /></span>
        </button>
        <div className="timeline">
          <div
            className="tl-track"
            data-film="track"
            role="slider"
            tabIndex={0}
            aria-label="Story timeline"
            aria-valuemin={0}
            aria-valuemax={DURATION}
            aria-valuenow={0}
          >
            <span className="track-line" />
            <span className="track-fill" data-film="fill" />
            {CHAPTERS.map(c => (
              <span key={c.t} className="tick" style={{ left: `${(c.t / DURATION) * 100}%` }} />
            ))}
          </div>
          <ol className="chapters" aria-label="Jump to a moment">
            {CHAPTERS.map(c => (
              <li key={c.t} style={{ left: `${(c.t / DURATION) * 100}%` }}>
                <button type="button" data-seek={c.t}>{c.label}</button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
