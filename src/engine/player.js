// Film player: a clock, not a scroll listener.
// Plays when the hero is on screen, pauses when it isn't (or the tab is hidden),
// never restarts on its own, and never touches page scroll.
import { createRenderer } from './renderer.js';
import { film, FILM_DURATION as END } from './film.js';
import { CHAPTERS } from '../timeline.js';
import { clamp, smooth } from './math.js';

const FADE = 0.35; // caption fade, seconds

export function startFilm({ root, canvas }) {
  const renderer = createRenderer(canvas);
  const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let RM = rmQuery.matches;

  /* ---------- state ---------- */
  let time = 0;
  let playing = false;
  let userPaused = false; // the visitor pressed pause — only they can resume
  let ended = false;
  let onScreen = false;
  let tabVisible = document.visibilityState !== 'hidden';
  let dragging = false;
  let raf = 0;
  let last = 0;
  let view = null;

  /* ---------- DOM ---------- */
  const q = s => root.querySelector(s);
  const cues = [...root.querySelectorAll('[data-cue]')].map(el => {
    const [a, b] = el.dataset.cue.split(' ').map(Number);
    // text-only captions stay in the accessibility tree (opacity only); ones with controls
    // are also hidden from focus while off screen
    const interactive = !!el.querySelector('a, button');
    return { el, a, b, last: -1, interactive, hero: el.classList.contains('cue-hero') || el.classList.contains('cue-big') };
  });
  const steppers = [...root.querySelectorAll('[data-steps]')].map(el => ({ el, steps: el.dataset.steps.split(' ').map(Number), last: -1 }));
  const btnToggle = q('[data-film=toggle]');
  const btnReplay = q('[data-film=replay]');
  const track = q('[data-film=track]');
  const fill = q('[data-film=fill]');
  const chapterBtns = [...root.querySelectorAll('[data-seek]')];
  const H = {
    hud: q('.hud'),
    illus: q('[data-h=illus]'),
    range: q('[data-h=range]'),
    rangeV: q('[data-h=rangeV]'),
    strip: q('[data-h=strip]'),
    reach: q('[data-h=reach]'),
    pin: q('[data-h=pin]'),
    c1: q('[data-h=c1]'),
    c1L: q('[data-h=c1L]'),
    c1V: q('[data-h=c1V]'),
    c2: q('[data-h=c2]'),
    c2V: q('[data-h=c2V]'),
    bat: q('[data-h=bat]'),
    batV: q('[data-h=batV]'),
    batBar: q('[data-h=batBar]'),
    status: q('[data-h=status]'),
    statusT: q('[data-h=statusT]'),
    statusBar: q('[data-h=statusBar]'),
  };
  const setOp = (el, a) => {
    if (!el) return;
    const v = a.toFixed(3);
    if (el._a !== v) (el._a = v), (el.style.opacity = v);
  };
  const setText = (el, s) => el && el._t !== s && ((el._t = s), (el.textContent = s));
  const setTone = (el, s) => el && el._tone !== s && ((el._tone = s), (el.dataset.tone = s));
  const setStyle = (el, k, v) => el && el.style[k] !== v && (el.style[k] = v);

  function measure() {
    const r = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const portrait = w < h * 0.82;
    let dpr = Math.min(window.devicePixelRatio || 1, portrait ? 1.5 : 2);
    if (w * h * dpr * dpr > 4.2e6) dpr = Math.sqrt(4.2e6 / (w * h));
    renderer.resize(w, h, dpr);
    view = { w, h, F: Math.min(h * 0.95, w * 1.35), portrait };
    root.classList.toggle('portrait', portrait);
    draw();
  }

  /* ---------- frame ---------- */
  function draw() {
    if (!view) return;
    const st = film(time, view);
    renderer.render(st, time);
    updateDom(st);
  }

  function updateDom(st) {
    for (const c of cues) {
      const a = RM ? (time >= c.a && time < c.b ? 1 : 0) : smooth(c.a, c.a + FADE, time) * (1 - smooth(c.b - FADE, c.b, time));
      const v = Math.round(a * 100) / 100;
      if (v !== c.last) {
        c.last = v;
        c.el.style.opacity = String(v);
        if (c.interactive) c.el.style.visibility = v < 0.01 ? 'hidden' : 'visible';
        c.el.style.transform = RM ? '' : c.hero ? `scale(${0.985 + v * 0.015})` : `translate3d(0,${(1 - v) * 10}px,0)`;
        c.el.classList.toggle('live', v > 0.5);
      }
    }
    for (const s of steppers) {
      let k = 0;
      for (let j = 0; j < s.steps.length; j++) if (time >= s.steps[j]) k = j + 1;
      if (k !== s.last) (s.last = k), (s.el.dataset.step = String(k));
    }
    const h = st.hud;
    setOp(H.illus, h.illus);
    setOp(H.range, h.rangeA);
    setText(H.rangeV, String(Math.ceil(h.range - 1e-6)));
    setTone(H.range, h.rangeTone);
    setOp(H.strip, h.stripA);
    if (h.stripA > 0) {
      setStyle(H.reach, 'transform', `scaleX(${clamp(h.stripRange / 40).toFixed(4)})`);
      setStyle(H.pin, 'left', `${(clamp(h.stripCharger / 40) * 100).toFixed(2)}%`);
    }
    setOp(H.c1, h.c1A);
    setText(H.c1L, h.c1Label);
    setText(H.c1V, h.c1Val);
    setTone(H.c1, h.c1Tone);
    setOp(H.c2, h.c2A);
    setText(H.c2V, h.c2Val);
    setTone(H.c2, h.c2Tone);
    setOp(H.bat, h.batA);
    setText(H.batV, String(Math.round(h.bat)));
    setStyle(H.batBar, 'transform', `scaleX(${(h.bat / 100).toFixed(4)})`);
    setOp(H.status, h.statusA);
    setText(H.statusT, h.status);
    setTone(H.status, h.statusTone);
    setStyle(H.statusBar, 'transform', `scaleX(${h.statusBar < 0 ? 0 : h.statusBar.toFixed(4)})`);
    setStyle(H.statusBar, 'opacity', h.statusBar < 0 ? '0' : '1');
    H.hud?.classList.toggle('on', h.illus + h.rangeA + h.stripA + h.c1A + h.c2A + h.batA > 0.01);
    // controls
    const p = time / END;
    setStyle(fill, 'transform', `scaleX(${p.toFixed(4)})`);
    if (track) {
      track.setAttribute('aria-valuenow', time.toFixed(1));
      const ch = currentChapter();
      track.setAttribute('aria-valuetext', `${ch.label}, ${Math.round(time)} of ${Math.round(END)} seconds`);
    }
    const cur = currentChapter();
    for (const b of chapterBtns) b.toggleAttribute('data-on', Number(b.dataset.seek) === cur.t);
  }
  const currentChapter = () => {
    let c = CHAPTERS[0];
    for (const ch of CHAPTERS) if (time >= ch.t - 0.01) c = ch;
    return c;
  };

  /* ---------- clock ---------- */
  function tick(now) {
    raf = 0;
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    if (time >= END) {
      time = END;
      ended = true;
      setPlaying(false);
    }
    draw();
    if (playing) raf = requestAnimationFrame(tick);
  }
  function setPlaying(on) {
    playing = on;
    root.classList.toggle('is-playing', on);
    root.classList.toggle('is-ended', ended);
    if (btnToggle) {
      btnToggle.setAttribute('aria-label', on ? 'Pause the story' : ended ? 'Replay the story' : 'Play the story');
      btnToggle.dataset.state = on ? 'playing' : ended ? 'ended' : 'paused';
    }
    if (on && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    if (!on && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  /** Autoplay decision: only when visible, tab active, not paused by the visitor, not finished. */
  function autoplay() {
    const want = onScreen && tabVisible && !userPaused && !ended && !RM && !dragging;
    if (want !== playing) setPlaying(want);
  }
  function seek(t, { keepPlaying = true } = {}) {
    time = clamp(t, 0, END);
    if (time < END) ended = false;
    root.classList.toggle('is-ended', ended);
    if (!keepPlaying) setPlaying(false);
    draw();
  }

  /* ---------- controls ---------- */
  btnToggle?.addEventListener('click', () => {
    if (ended) {
      userPaused = false;
      ended = false;
      seek(0);
      setPlaying(true);
      return;
    }
    if (playing) {
      userPaused = true;
      setPlaying(false);
    } else {
      userPaused = false;
      setPlaying(true);
    }
  });
  btnReplay?.addEventListener('click', () => {
    userPaused = false;
    ended = false;
    seek(0);
    if (RM) setPlaying(true);
    else autoplay();
  });
  for (const b of chapterBtns)
    b.addEventListener('click', () => {
      seek(Number(b.dataset.seek));
      if (RM) return;
      userPaused = false;
      autoplay();
    });
  // scrubbing: click or drag the progress line
  if (track) {
    const at = e => {
      const r = track.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width) * END;
    };
    let wasPlaying = false;
    track.addEventListener('pointerdown', e => {
      dragging = true;
      wasPlaying = playing;
      setPlaying(false);
      track.setPointerCapture(e.pointerId);
      root.classList.add('is-scrubbing');
      seek(at(e));
    });
    track.addEventListener('pointermove', e => dragging && seek(at(e)));
    const up = () => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('is-scrubbing');
      if (wasPlaying && !ended) setPlaying(true);
    };
    track.addEventListener('pointerup', up);
    track.addEventListener('pointercancel', up);
    track.addEventListener('keydown', e => {
      const step = e.shiftKey ? 5 : 2;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') seek(time + step);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') seek(time - step);
      else if (e.key === 'Home') seek(0);
      else if (e.key === 'End') seek(END);
      else return;
      e.preventDefault();
    });
  }
  // leaving via a CTA: stop the film so it isn't running behind a new tab
  root.addEventListener('click', e => {
    if (e.target.closest('a[href]') && playing) {
      userPaused = true;
      setPlaying(false);
    }
  });

  /* ---------- visibility ---------- */
  const io = new IntersectionObserver(
    ([en]) => {
      onScreen = en.isIntersecting && en.intersectionRatio >= 0.35;
      autoplay();
    },
    { threshold: [0, 0.35, 0.6] }
  );
  io.observe(root);
  const onVis = () => {
    tabVisible = document.visibilityState !== 'hidden';
    autoplay();
  };
  document.addEventListener('visibilitychange', onVis);
  const onRM = () => {
    RM = rmQuery.matches;
    root.classList.toggle('rm', RM);
    if (RM) setPlaying(false);
    else autoplay();
    draw();
  };
  rmQuery.addEventListener?.('change', onRM);
  const ro = new ResizeObserver(measure);
  ro.observe(root);

  root.classList.toggle('rm', RM);
  root.classList.add('film-ready');
  measure();
  if (RM) seek(0, { keepPlaying: false });
  autoplay();

  return () => {
    setPlaying(false);
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    rmQuery.removeEventListener?.('change', onRM);
  };
}
