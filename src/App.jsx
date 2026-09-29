import { TopBar, Footer } from './components/Chrome.jsx';
import { Film } from './components/Film.jsx';
import { Drivers, Providers, Coverage } from './components/Sections.jsx';
import { PowerBridge, FinalCta } from './components/Blocks.jsx';

export default function App() {
  return (
    <>
      <TopBar />
      <Film />
      <main>
        <Drivers />
        <Providers />
        <Coverage />
        <section className="sec sec-alt" id="powerbridge" aria-label="PowerBridge Pro by RoamEnergy">
          <div className="sec-in">
            <PowerBridge />
          </div>
        </section>
        <section className="sec sec-final" id="get-help" aria-labelledby="final-h">
          <div className="sec-in">
            <h2 id="final-h" className="sec-h center">
              When your range runs out, <span className="mint">your options shouldn&rsquo;t.</span>
            </h2>
            <FinalCta />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
