import { LINKS, LOGO, SITE, SCENARIO } from '../content.js';
import { SCENES } from '../scenes.js';

export function Logo({ className = '', alt = 'Mocha' }) {
  return <img className={`logo ${className}`} src={LOGO} alt={alt} width="500" height="109" decoding="async" />;
}

export function TopBar() {
  return (
    <header className="topbar">
      <a className="skip" href="#get-help">Skip the story</a>
      <a className="brand" href="https://www.mochaev.com/" aria-label="Mocha home">
        <Logo alt="Mocha" />
      </a>
      <nav className="top-actions" aria-label="Account">
        <a className="sos" href={LINKS.app}>
          <span className="sos-dot" aria-hidden="true" />
          Stranded now? <strong>Get help</strong>
        </a>
        <a className="signin" href={LINKS.app}>Sign in</a>
      </nav>
    </header>
  );
}

export function TripNav() {
  const chapters = SCENES.map((s, i) => ({ ...s, i })).filter(s => s.chapter);
  return (
    <nav className="trip" aria-label="Story chapters">
      <span className="trip-line" aria-hidden="true">
        <span className="trip-fill" />
      </span>
      <ol>
        {chapters.map(c => (
          <li key={c.id}>
            <a href={`#${c.id}`} data-to={c.i}>
              <span>{c.chapter}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Instrument cluster. Numbers are demonstration values, and it says so. */
export function Hud() {
  return (
    <>
      <div className="hud" aria-hidden="true">
        <p className="hud-illus" data-h="illus">{SCENARIO.label}</p>
        <div className="hud-range" data-h="range">
          <span className="lbl">Range</span>
          <span className="val">
            <b data-h="rangeV">32</b>
            <small>mi</small>
          </span>
        </div>
        <div className="hud-strip" data-h="strip">
          <span className="track" />
          <span className="reach" data-h="reach" />
          <span className="pin" data-h="pin" />
          <span className="cap-l">range</span>
          <span className="cap-r">charger</span>
        </div>
        <div className="hud-row" data-h="c1">
          <span className="lbl" data-h="c1L">Nearest charger</span>
          <span className="v" data-h="c1V" />
        </div>
        <div className="hud-row" data-h="c2">
          <span className="lbl">Next charger</span>
          <span className="v" data-h="c2V" />
        </div>
        <div className="hud-bat" data-h="bat">
          <span className="lbl">Battery</span>
          <span className="val">
            <b data-h="batV">0</b>
            <small>%</small>
          </span>
          <span className="bat-track">
            <span className="bat-bar" data-h="batBar" />
          </span>
        </div>
      </div>
      <div className="status" data-h="status" aria-hidden="true">
        <span className="status-dot" />
        <span data-h="statusT" />
        <span className="status-bar" data-h="statusBar" />
      </div>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div>
          <p className="footer-brand">Mocha</p>
          <p>{SITE.footerTag}</p>
        </div>
        <ul className="footer-links">
          <li><a href={LINKS.privacy}>Privacy Policy</a></li>
          <li><a href={LINKS.contact}>Contact</a></li>
          <li><a href={LINKS.powerbridgePage}>PowerBridge Pro offer</a></li>
        </ul>
        <ul className="footer-social" aria-label="Mocha on social media">
          <li><a href={LINKS.linkedin} rel="noopener">LinkedIn</a></li>
          <li><a href={LINKS.facebook} rel="noopener">Facebook</a></li>
          <li><a href={LINKS.instagram} rel="noopener">Instagram</a></li>
          <li><a href={LINKS.x} rel="noopener">X</a></li>
        </ul>
      </div>
      <p className="footer-fine">
        Range, mileage, battery and map values in the story above are illustrative. They are not Mocha
        performance figures, response times or provider counts. PowerBridge Pro is a RoamEnergy product.
      </p>
    </footer>
  );
}
