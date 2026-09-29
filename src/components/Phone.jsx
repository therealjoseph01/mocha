// A deliberately simple, conceptual phone. Mocha's real app is behind a login,
// so this shows the idea (need → location → request) and labels itself as a concept.
import { LINKS } from '../content.js';

export function DriverPhone() {
  return (
    <figure className="phone" data-steps="0.42 0.47 0.6 0.72" data-step="0">
      <div className="phone-body">
        <div className="phone-screen">
          <div className="ps ps-0">
            <p className="ps-k">Battery 0%</p>
            <p className="ps-h">Need a charge?</p>
            <span className="ps-btn">I Need a Charge</span>
          </div>
          <div className="ps ps-1">
            <p className="ps-k">Location</p>
            <div className="ps-map" aria-hidden="true">
              <span className="ps-road" />
              <span className="ps-pin" />
            </div>
            <p className="ps-s">Sharing your current location</p>
          </div>
          <div className="ps ps-2">
            <p className="ps-k">Ready</p>
            <p className="ps-h">Request a charge</p>
            <span className="ps-btn press">Request</span>
          </div>
          <div className="ps ps-3">
            <span className="ps-sent" aria-hidden="true" />
            <p className="ps-h">Request sent</p>
            <p className="ps-s">Finding a nearby provider</p>
          </div>
        </div>
      </div>
      <figcaption>
        Conceptual interface. Requests are made in the <a href={LINKS.app}>Mocha web app</a>.
      </figcaption>
    </figure>
  );
}

export function ProviderPhone() {
  return (
    <figure className="phone phone-provider" data-steps="0.36 0.48" data-step="0">
      <div className="phone-body">
        <div className="phone-screen">
          <div className="ps ps-0">
            <p className="ps-k">Provider</p>
            <p className="ps-h">Available</p>
          </div>
          <div className="ps ps-1">
            <span className="ps-ping" aria-hidden="true" />
            <p className="ps-k">New request</p>
            <p className="ps-h">A driver nearby needs a charge</p>
          </div>
          <div className="ps ps-2">
            <p className="ps-k">Accepted</p>
            <p className="ps-h">On the way</p>
          </div>
        </div>
      </div>
      <figcaption>Conceptual interface</figcaption>
    </figure>
  );
}
