import { LINKS, SITE } from '../content.js';
import { US_OUTLINE, US_BORDERS, US_POINTS, US_W, US_H } from '../data/usMap.js';
import { Cta } from './Blocks.jsx';

export function Drivers() {
  return (
    <section className="sec" id="drivers" aria-labelledby="drivers-h">
      <div className="sec-in split">
        <div>
          <p className="eyebrow amber">For drivers</p>
          <h2 id="drivers-h" className="sec-h">Need emergency charging?</h2>
          <p className="sec-lead">{SITE.driverBody}</p>
          <p className="sec-p">{SITE.lede}</p>
          <Cta href={LINKS.app}>{SITE.driverCta}</Cta>
        </div>
        <div>
          <h3 className="mini-h">How Mocha works</h3>
          <ol className="steps">
            {SITE.steps.map((s, i) => (
              <li key={s.title}>
                <span className="steps-n">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <strong>{s.title}</strong>
                  {s.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function Providers() {
  return (
    <section className="sec sec-alt" id="providers" aria-labelledby="providers-h">
      <div className="sec-in split">
        <div>
          <p className="eyebrow">For charge providers</p>
          <h2 id="providers-h" className="sec-h">
            Have mobile charging capability? <span className="mint">Put it to work.</span>
          </h2>
          <p className="sec-lead">{SITE.providerBody}</p>
          <Cta href={LINKS.app} kind="ghost">{SITE.providerCta}</Cta>
        </div>
        <figure className="route-art" aria-hidden="true">
          <svg viewBox="0 0 420 220">
            <path d="M30 190 H210 V60 H390" className="ra-road" />
            <path d="M30 190 H210 V60 H390" className="ra-route" />
            <circle cx="390" cy="60" r="6" className="ra-you" />
            <circle cx="390" cy="60" r="6" className="ra-ring" />
            <circle r="6.5" className="ra-prov">
              <animateMotion dur="5s" repeatCount="indefinite" path="M30 190 H210 V60 H390" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear" />
            </circle>
            <text x="390" y="38" textAnchor="middle">DRIVER</text>
            <text x="30" y="214" textAnchor="start">YOU, THE PROVIDER</text>
          </svg>
        </figure>
      </div>
    </section>
  );
}

export function Coverage() {
  const pts = US_POINTS.filter((_, i) => i % 2 === 0);
  return (
    <section className="sec" id="coverage" aria-labelledby="coverage-h">
      <div className="sec-in cov">
        <div>
          <p className="eyebrow">Coverage</p>
          <h2 id="coverage-h" className="sec-h">{SITE.coverageTitle}</h2>
          <p className="sec-lead">{SITE.coverageBody}</p>
        </div>
        <figure className="us">
          <svg viewBox={`0 0 ${US_W} ${US_H}`} role="img" aria-label="Map of the continental United States">
            <path d={US_OUTLINE} className="us-land" />
            <path d={US_BORDERS} className="us-borders" />
            {pts.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i % 3 ? 2.2 : 2.8} className={i % 3 ? 'us-p' : 'us-d'} style={{ animationDelay: `${(i % 17) * 0.23}s` }} />
            ))}
          </svg>
          <figcaption>Dots are illustrative. They don&rsquo;t show actual provider locations, counts or availability.</figcaption>
        </figure>
      </div>
    </section>
  );
}
