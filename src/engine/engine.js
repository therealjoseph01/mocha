// Runtime: scroll → narrative time → frame state → canvas + DOM.
// Native scroll is never hijacked; the film eases toward wherever the page is.
import { createRenderer } from './renderer.js';
import { direct } from './director.js';
import { SCENES } from '../scenes.js';
import { clamp, smooth } from './math.js';

const FADE = 0.05;

export function startEngine({ canvas, root }) {
  const renderer = createRenderer(canvas);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let RM = reduce.matches;
  const sections = [...root.querySelectorAll('[data-scene]')];
  const caps = [...root.querySelectorAll('[data-w]')].map(el => {
    const [a, b] = el.dataset.w.split(' ').map(Number);
    const sec = el.closest('[data-scene]');
    return { el, a, b, i: Number(sec.dataset.scene), last: -1, big: el.classList.contains('cap-hero') };
  });
  const steppers = [...root.querySelectorAll('[data-steps]')].map(el => ({
    el,
    i: Number(el.closest('[data-scene]').dataset.scene),
    steps: el.dataset.steps.split(' ').map(Number),
    last: -1,
  }));
  const varSections = [...root.querySelectorAll('[data-vars]')].map(el => ({ el, i: Number(el.dataset.scene), last: '' }));
  const hud = document.querySelector('.hud');
  const H = hud && {
    root: hud,
    illus: hud.querySelector('[data-h=illus]'),
    range: hud.querySelector('[data-h=range]'),
    rangeV: hud.querySelector('[data-h=rangeV]'),
    strip: hud.querySelector('[data-h=strip]'),
    reach: hud.querySelector('[data-h=reach]'),
    pin: hud.querySelector('[data-h=pin]'),
    c1: hud.querySelector('[data-h=c1]'),
    c1L: hud.querySelector('[data-h=c1L]'),
    c1V: hud.querySelector('[data-h=c1V]'),
    c2: hud.querySelector('[data-h=c2]'),
    c2V: hud.querySelector('[data-h=c2V]'),
    bat: hud.querySelector('[data-h=bat]'),
    batV: hud.querySelector('[data-h=batV]'),
    batBar: hud.querySelector('[data-h=batBar]'),
    status: document.querySelector('[data-h=status]'),
    statusT: document.querySelector('[data-h=statusT]'),
    statusBar: document.querySelector('[data-h=statusBar]'),
  };
  const topbar = document.querySelector('.topbar');
  const navLinks = [...document.querySelectorAll('.trip a[data-to]')];
  const navFill = document.querySelector('.trip-fill');
  const MOCHA_I = SCENES.findIndex(s => s.id === 'mocha');

  let tops = [], heights = [], vh = 1, view = null, dpr = 1;
  function measure() {
    const w = window.innerWidth, h = window.innerHeight;
    vh = h;
    tops = sections.map(s => s.getBoundingClientRect().top + window.scrollY);
    heights = sections.map(s => s.offsetHeight);
    const portrait = w < h * 0.82;
    dpr = Math.min(window.devicePixelRatio || 1, portrait ? 1.5 : 2);
    if (w * h * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (w * h));
    renderer.resize(w, h, dpr);
    view = { w, h, F: Math.min(h * 0.95, w * 1.35), portrait };
    root.classList.toggle('portrait', portrait);
  }
  function localT(i, y) {
    return (y - tops[i]) / Math.max(1, heights[i]);
  }
  function targetT() {
    const y = window.scrollY + vh * 0.0;
    let i = 0;
    while (i < sections.length - 1 && y >= tops[i + 1]) i++;
    return i + clamp(localT(i, y), 0, 0.99999);
  }

  let T = 0;
  let lastNow = performance.now();
  let lastTarget = -1, idleSince = 0, frameN = 0;
  let raf = 0;
  const t0 = performance.now();

  function setStyle(el, k, v) {
    if (el.style[k] !== v) el.style[k] = v;
  }
  function show(el, a) {
    if (!el) return;
    const v = a.toFixed(3);
    if (el._a !== v) {
      el._a = v;
      el.style.opacity = v;
    }
  }
  function text(el, s) {
    if (el && el._t !== s) {
      el._t = s;
      el.textContent = s;
    }
  }
  function tone(el, t) {
    if (el && el._tone !== t) {
      el._tone = t;
      el.dataset.tone = t;
    }
  }

  function updateDom(Tn, st) {
    const y = window.scrollY;
    const cur = Math.floor(Tn);
    // captions (each uses its own section's unclamped local time)
    for (const c of caps) {
      if (RM) {
        if (c.last !== 'rm') {
          c.last = 'rm';
          c.el.style.opacity = c.el.style.visibility = c.el.style.transform = '';
        }
        continue;
      }
      if (Math.abs(c.i - cur) > 1) {
        if (c.last !== 0) {
          c.last = 0;
          c.el.style.opacity = '0';
          c.el.style.visibility = 'hidden';
        }
        continue;
      }
      const t = RM ? SCENES[c.i].rep : c.i === cur ? Tn - cur : c.i < cur ? 1 + (Tn - cur) * (heights[cur] / heights[c.i]) : (Tn - cur - 1) * (heights[cur] / heights[c.i]);
      const a = smooth(c.a, c.a + FADE, t) * (1 - smooth(c.b - FADE, c.b, t));
      const q = Math.round(a * 200) / 200;
      if (q !== c.last) {
        c.last = q;
        c.el.style.opacity = String(q);
        c.el.style.visibility = q < 0.01 ? 'hidden' : 'visible';
        c.el.style.transform = c.big ? `translate3d(0,${(1 - a) * 10}px,0) scale(${0.985 + a * 0.015})` : `translate3d(0,${(1 - a) * 14}px,0)`;
        c.el.classList.toggle('live', q > 0.5);
      }
    }
    for (const s of steppers) {
      const t = s.i === cur ? Tn - cur : s.i < cur ? 1 : 0;
      let k = 0;
      for (let j = 0; j < s.steps.length; j++) if (t >= s.steps[j]) k = j + 1;
      if (k !== s.last) {
        s.last = k;
        s.el.dataset.step = String(k);
      }
    }
    for (const s of varSections) {
      if (Math.abs(s.i - cur) > 1) continue;
      const t = s.i === cur ? Tn - cur : s.i < cur ? 1 : 0;
      const v = t.toFixed(4);
      if (v !== s.last) {
        s.last = v;
        s.el.style.setProperty('--t', v);
      }
    }
    // HUD
    if (H) {
      const h = st.hud;
      show(H.illus, h.illus);
      show(H.range, h.rangeA);
      text(H.rangeV, String(Math.ceil(h.range - 1e-6)));
      tone(H.range, h.rangeTone);
      show(H.strip, h.stripA);
      if (h.stripA > 0) {
        setStyle(H.reach, 'transform', `scaleX(${clamp(h.stripRange / 40).toFixed(4)})`);
        setStyle(H.pin, 'left', `${(clamp(h.stripCharger / 40) * 100).toFixed(2)}%`);
      }
      show(H.c1, h.c1A);
      text(H.c1L, h.c1Label);
      text(H.c1V, h.c1Val);
      tone(H.c1, h.c1Tone);
      show(H.c2, h.c2A);
      text(H.c2V, h.c2Val);
      tone(H.c2, h.c2Tone);
      show(H.bat, h.batA);
      text(H.batV, String(Math.round(h.bat)));
      setStyle(H.batBar, 'transform', `scaleX(${(h.bat / 100).toFixed(4)})`);
      show(H.status, h.statusA);
      text(H.statusT, h.status);
      tone(H.status, h.statusTone);
      setStyle(H.statusBar, 'transform', `scaleX(${h.statusBar < 0 ? 0 : h.statusBar.toFixed(4)})`);
      setStyle(H.statusBar, 'opacity', h.statusBar < 0 ? '0' : '1');
      const any = h.illus + h.rangeA + h.stripA + h.c1A + h.c2A + h.batA > 0.01;
      hud.classList.toggle('on', any);
    }
    // brand + nav
    if (topbar) topbar.classList.toggle('branded', Tn >= MOCHA_I + 0.04);
    if (navFill) {
      const total = tops[tops.length - 1] + heights[heights.length - 1] - vh;
      const p = clamp(y / Math.max(1, total)).toFixed(4);
      if (navFill._p !== p) {
        navFill._p = p;
        navFill.style.setProperty('--p', p);
      }
    }
    let active = null;
    for (const a of navLinks) if (Number(a.dataset.to) <= cur) active = a;
    for (const a of navLinks) {
      const on = a === active;
      if (on !== (a.getAttribute('aria-current') === 'step')) {
        if (on) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - lastNow) / 1000);
    lastNow = now;
    const target = targetT();
    if (target !== lastTarget) {
      lastTarget = target;
      idleSince = now;
    }
    const idle = now - idleSince > 1200 && Math.abs(target - T) < 1e-4;
    frameN++;
    if (idle && frameN % 2) return; // ambient-only: 30fps
    if (RM) {
      const i = Math.floor(target);
      T = i + SCENES[i].rep;
    } else if (Math.abs(target - T) > 2.5) T = target;
    else T += (target - T) * (1 - Math.exp(-dt * 5.5));
    const time = (now - t0) / 1000;
    const st = direct(T, view, time);
    renderer.render(st, time);
    updateDom(T, st);
  }

  // keyboard users: focusing a control inside an invisible caption scrolls the film to it
  function onFocus(e) {
    const cap = e.target.closest && e.target.closest('[data-w]');
    if (!cap) return;
    const c = caps.find(x => x.el === cap);
    if (!c || RM) return;
    const mid = (c.a + Math.min(c.b, 1)) / 2;
    const yT = tops[c.i] + heights[c.i] * clamp(mid, 0, 0.98);
    if (Math.abs(window.scrollY - yT) > vh * 0.2) window.scrollTo({ top: yT, behavior: 'instant' });
    T = targetT();
  }
  function onMotion() {
    RM = reduce.matches;
    document.documentElement.classList.toggle('rm', RM);
    requestAnimationFrame(measure);
  }

  measure();
  T = targetT();
  document.documentElement.classList.toggle('rm', RM);
  const ro = new ResizeObserver(() => measure());
  ro.observe(document.body);
  window.addEventListener('resize', measure);
  root.addEventListener('focusin', onFocus);
  reduce.addEventListener?.('change', onMotion);
  raf = requestAnimationFrame(frame);
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    window.removeEventListener('resize', measure);
    root.removeEventListener('focusin', onFocus);
    reduce.removeEventListener?.('change', onMotion);
  };
}
