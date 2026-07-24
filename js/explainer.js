/* ============================================================
   FIRE Dashboard — explainer.js
   Extracted from explainer.html's inline <script> — self-contained
   scene-player controller (progress bars, autoplay timer, optional
   speech narration, keyboard/click controls). No dependency on the
   main app's js/css.
   ============================================================ */
(() => {
  "use strict";

  // Subtitle narration text, one per scene (kept in sync with DOM order).
  const NARRATION = [
    "Welcome to the FIRE Dashboard — a tool to plan the day work becomes optional.",
    "FIRE means Financial Independence, Retire Early. Grow a pot big enough that its returns cover your living costs, and a paycheck becomes a choice.",
    "It all rests on one number. Take what you spend in a year, divide by a safe withdrawal rate — usually four percent — and you get your FI number. That's just twenty-five times your annual spending.",
    "Start with your reality: your current portfolio, your yearly income, your spending, and your age. Change any value and everything recalculates instantly.",
    "Decide how your money grows. Split it between higher-return investments and safer savings, and the dashboard blends both into one realistic rate.",
    "Then watch compounding do the work. Your portfolio climbs year after year until it crosses the FI target — and that crossing point is your years to FIRE.",
    "Every number comes in two honest lenses. Nominal shows raw future euros; Real Terms strips out inflation, so you see today's true purchasing power.",
    "Taxes slow you down, so model them. Use the built-in Dutch Box 3 rules for 2026, or set your own custom rate, and see the yearly bill at once.",
    "A speedometer shows your retirement readiness — how close your pot is to the finish line, from red to green at a glance.",
    "And the journey is full of milestones: your first hundred thousand, Coast FI, Barista, Lean, Full FIRE, and beyond. Each lights up as you reach it.",
    "Your data is yours alone. It auto-saves in your browser, never uploaded anywhere. Export a scenario to a file, or wipe everything with one reset.",
    "That's it. Open index dot H-T-M-L, plug in your life, and find the day you reach financial independence."
  ];

  const scenes   = Array.from(document.querySelectorAll('.scene'));
  const stage    = document.getElementById('stage');
  const segWrap  = document.getElementById('segments');
  const caption  = document.getElementById('caption');
  const counter  = document.getElementById('counter');
  const playBtn  = document.getElementById('playBtn');
  const prevBtn  = document.getElementById('prevBtn');
  const nextBtn  = document.getElementById('nextBtn');
  const voiceBtn = document.getElementById('voiceBtn');
  const replay   = document.getElementById('replay');
  const replayBtn= document.getElementById('replayBtn');

  const N = scenes.length;
  const durations = scenes.map(s => parseInt(s.dataset.dur, 10) || 6000);

  // Build segmented progress bars
  const fills = scenes.map((_, i) => {
    const seg = document.createElement('div');
    seg.className = 'seg';
    const f = document.createElement('span');
    f.className = 'seg-fill';
    seg.appendChild(f);
    seg.addEventListener('click', () => { go(i); });
    segWrap.appendChild(seg);
    return f;
  });

  // ── State ──────────────────────────────────────────────────
  let idx = 0;
  let playing = true;
  let elapsed = 0;          // ms elapsed in current scene
  let last = 0;             // last rAF timestamp
  let raf = null;
  let voice = false;
  let ended = false;

  const speech = window.speechSynthesis || null;

  function speak(i){
    if (!voice || !speech) return;
    try {
      speech.cancel();
      const u = new SpeechSynthesisUtterance(NARRATION[i] || '');
      u.rate = 1.0; u.pitch = 1.0; u.lang = 'en-US';
      speech.speak(u);
    } catch (_) { /* TTS unavailable — silent fallback */ }
  }

  function paintProgress(){
    fills.forEach((f, i) => {
      f.style.width = i < idx ? '100%'
                    : i > idx ? '0%'
                    : Math.min(elapsed / durations[idx], 1) * 100 + '%';
    });
  }

  function activate(i){
    scenes.forEach((s, k) => s.classList.toggle('active', k === i));
    // restart CSS animations of the now-active scene
    const s = scenes[i];
    s.classList.remove('active');
    void s.offsetWidth;       // force reflow
    s.classList.add('active');
    caption.textContent = NARRATION[i] || '';
    counter.textContent = (i + 1) + ' / ' + N;
  }

  function go(i){
    idx = Math.max(0, Math.min(N - 1, i));
    elapsed = 0;
    ended = false;
    replay.classList.remove('show');
    activate(idx);
    paintProgress();
    speak(idx);
    if (!playing) setPlaying(true);
  }

  function finish(){
    playing = false;
    ended = true;
    playBtn.textContent = '▶';
    replay.classList.add('show');
    if (speech) speech.cancel();
  }

  function tick(now){
    if (!playing) return;
    if (!last) last = now;
    elapsed += now - last;
    last = now;
    paintProgress();
    if (elapsed >= durations[idx]) {
      if (idx >= N - 1) { fills[idx].style.width = '100%'; finish(); return; }
      idx++; elapsed = 0; activate(idx); speak(idx);
    }
    raf = requestAnimationFrame(tick);
  }

  function setPlaying(p){
    playing = p;
    playBtn.textContent = p ? '⏸' : '▶';
    if (p){
      if (ended){ go(0); return; }
      last = 0;
      raf = requestAnimationFrame(tick);
      // resume speech for the current scene
      if (voice && speech && !speech.speaking) speak(idx);
    } else {
      if (raf) cancelAnimationFrame(raf);
      if (speech) speech.cancel();
    }
  }

  // ── Controls ───────────────────────────────────────────────
  playBtn.addEventListener('click', () => setPlaying(!playing));
  nextBtn.addEventListener('click', () => go(idx + 1));
  prevBtn.addEventListener('click', () => go(idx - 1));
  replayBtn.addEventListener('click', () => go(0));
  voiceBtn.addEventListener('click', () => {
    voice = !voice;
    voiceBtn.textContent = voice ? '🔊 Voice on' : '🔇 Voice off';
    if (voice) speak(idx); else if (speech) speech.cancel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space'){ e.preventDefault(); setPlaying(!playing); }
    else if (e.code === 'ArrowRight') go(idx + 1);
    else if (e.code === 'ArrowLeft')  go(idx - 1);
    else if (e.key === 'r' || e.key === 'R') go(0);
  });

  // stop speech when leaving the page
  window.addEventListener('beforeunload', () => { if (speech) speech.cancel(); });

  // ── Boot ───────────────────────────────────────────────────
  activate(0);
  paintProgress();
  raf = requestAnimationFrame(tick);
})();
