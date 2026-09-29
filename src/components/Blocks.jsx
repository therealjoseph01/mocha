import { LINKS, SITE, POWERBRIDGE } from '../content.js';
import { Logo } from './Chrome.jsx';

const Arrow = () => (
  <svg className="arr" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Cta({ href, children, kind = 'primary' }) {
  return (
    <a className={`btn btn-${kind}`} href={href}>
      {children}
      <Arrow />
    </a>
  );
}

/* ---------- PowerBridge Pro: EV → PowerBridge → loads ---------- */
function UseGlyph({ k }) {
  const p = {
    ev: 'M3 15h18M5 15l1.6-4.2a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3L19 15M7 18.5a1.5 1.5 0 1 0 0-.01M17 18.5a1.5 1.5 0 1 0 0-.01',
    home: 'M4 11.5 12 5l8 6.5M6.5 10v9h11v-9M10 19v-5h4v5',
    out: 'M3 19h18M6 19l6-12 6 12M12 7v12',
    job: 'M4 19h16M7 19v-6h10v6M9 13V9h6v4M12 5v4',
  }[k];
  return (
    <svg viewBox="0 0 24 24" className="use-g" aria-hidden="true">
      <path d={p} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PowerBridge() {
  return (
    <div className="pb">
      <div className="pb-copy">
        <p className="eyebrow">{POWERBRIDGE.offer}</p>
        <h2 className="pb-title">{POWERBRIDGE.title}</h2>
        <p className="pb-body">{POWERBRIDGE.body}</p>
        <p className="pb-body dim">{POWERBRIDGE.taps}</p>
      </div>
      <div className="pb-flow" aria-label="Energy flows from a compatible EV, through PowerBridge Pro, to what needs power">
        <div className="pb-src">
          <svg viewBox="0 0 120 48" aria-hidden="true" className="pb-ev">
            <path d="M6 36h108M14 36l7-12c1.4-2.4 4-4 6.8-4h40.4c2.6 0 5 1.2 6.6 3.3L84 32l20 2.4c3 .4 5 2.8 5 5.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="32" cy="38" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="92" cy="38" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p className="pb-lbl">Compatible EV</p>
        </div>
        <svg className="pb-wire w1" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 5H100" pathLength="1" />
        </svg>
        <div className="pb-dev">
          <img src={POWERBRIDGE.image} alt="PowerBridge Pro portable EV power unit by RoamEnergy" width="720" height="720" loading="lazy" decoding="async" />
          <p className="pb-lbl">PowerBridge Pro <span>by RoamEnergy</span></p>
        </div>
        <svg className="pb-wire w2" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 5H100" pathLength="1" />
        </svg>
        <ul className="pb-uses">
          {POWERBRIDGE.uses.map((u, i) => (
            <li key={u.key} style={{ '--i': i }}>
              <UseGlyph k={u.key} />
              <span>
                <strong>{u.title}</strong>
                {u.body}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pb-foot">
        <p className="fine">{POWERBRIDGE.compat}</p>
        <div className="pb-actions">
          <Cta href={LINKS.powerbridgeOffer}>{POWERBRIDGE.cta}</Cta>
          <a className="tlink" href={LINKS.powerbridgeCompat}>Check vehicle compatibility</a>
          <a className="tlink" href={LINKS.powerbridgePage}>About the offer</a>
        </div>
        <p className="fine">{POWERBRIDGE.ctaNote}</p>
      </div>
    </div>
  );
}

/* ---------- Final ---------- */
export function FinalCta() {
  return (
    <div className="final">
      <Logo className="final-logo" alt="Mocha" />
      <p className="final-lede">{SITE.lede}</p>
      <div className="final-pair">
        <div>
          <h3>{SITE.driverTitle}</h3>
          <p>{SITE.driverBody}</p>
          <Cta href={LINKS.app}>{SITE.driverCta}</Cta>
        </div>
        <div>
          <h3>{SITE.providerTitle}</h3>
          <p>{SITE.providerBody}</p>
          <Cta href={LINKS.app} kind="ghost">{SITE.providerCta}</Cta>
        </div>
      </div>
      <p className="final-cov">
        <strong>{SITE.coverageTitle}.</strong> {SITE.coverageBody}
      </p>
    </div>
  );
}
