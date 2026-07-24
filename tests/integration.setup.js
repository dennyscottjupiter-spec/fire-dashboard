'use strict';
/* ══════════════════════════════════════════════════════════
   INTEGRATION TESTS — setup + orchestration  (part 1/4)
   Depends on: harness.js (assert/group/out/fail/_watchdog/renderSummary).
   Loads ../index.html in a hidden iframe; needs a same-origin http server.

   Builds the shared iframe/win/doc/state + DOM-driving helpers
   (setVal/fireBlur/clickEl/keyDown/text/val/style/resetBaseline), packs
   them into `ctx`, then awaits — IN ORDER — the three feature files
   (each just a `window.runIntegration<Name> = async function(ctx) {...}`
   definition, loaded earlier in tests.html so they exist by the time this
   file calls them):
     1. integration.inputs.test.js
     2. integration.projection.test.js
     3. integration.features.test.js
   Only THIS file calls clearTimeout(_watchdog)/renderSummary() — exactly
   once, on every exit path (file:// skip, iframe-load failure, missing
   window._state, or normal completion) — matching the original single-file
   integration.test.js's early-return + finally behavior.
   ══════════════════════════════════════════════════════════ */
(async function runIntegrationSetup() {
  group('\n━━━━━━━━ Integration (iframe → index.html) ━━━━━━━━');

  // file:// gives the iframe an opaque "null" origin; Chrome blocks cross-frame
  // access with a SecurityError — not a real test failure, just a protocol limit.
  if (location.protocol === 'file:') {
    out.innerHTML += `ℹ️  Integration tests skipped on file:// (browser blocks cross-origin iframe access).\n` +
                     `    Run with a local server to execute them:\n` +
                     `      python -m http.server 8000\n` +
                     `    then open http://localhost:8000/tests/tests.html\n`;
    clearTimeout(_watchdog);
    renderSummary();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.src = '../index.html';
  iframe.style.cssText = 'position:absolute;left:-9999px;width:1200px;height:900px;';
  document.body.appendChild(iframe);

  try {
    await Promise.race([
      new Promise(resolve => iframe.addEventListener('load', resolve, { once: true })),
      new Promise((_, reject) => setTimeout(() => reject(new Error('iframe load timeout (15 s)')), 15000))
    ]);
  } catch (e) {
    fail++;
    out.innerHTML += `<span class="fail">❌</span>  iframe failed to load: ${e.message}\n`;
    clearTimeout(_watchdog);
    renderSummary();
    return;
  }

  let win, doc;
  try {
    win = iframe.contentWindow;
    doc = win.document;
  } catch (e) {
    fail++;
    out.innerHTML += `<span class="fail">❌</span>  Cannot access iframe (cross-origin? Use http://): ${e.message}\n`;
    clearTimeout(_watchdog);
    renderSummary();
    return;
  }

  try { /* ── integration body wrapped so watchdog always clears ── */

  /* ── iframe helpers ──────────────────────────────────── */
  function setVal(id, v) {
    const el = doc.getElementById(id);
    if (!el) { fail++; out.innerHTML += `<span class="fail">❌</span>  [missing element #${id}]\n`; return; }
    el.value = v;
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  function fireBlur(id) {
    const el = doc.getElementById(id);
    if (el) el.dispatchEvent(new win.Event('blur', { bubbles: true }));
  }
  function clickEl(id) { const el = doc.getElementById(id); if (el) el.click(); }
  function keyDown(id, key) {
    const el = doc.getElementById(id);
    if (el) el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  }
  function text(id)  { const el = doc.getElementById(id); return el ? el.textContent.trim() : '(missing:' + id + ')'; }
  function val(id)   { const el = doc.getElementById(id); return el ? el.value               : '(missing:' + id + ')'; }
  function style(id) { const el = doc.getElementById(id); return el ? el.style               : {}; }

  /* guard: abort integration if _state isn't exposed */
  const s = win._state;
  if (!s) {
    fail++;
    out.innerHTML += `<span class="fail">❌</span>  window._state not found — app.js may not have loaded\n`;
    clearTimeout(_watchdog);
    renderSummary();
    return;
  }

  /* ── helper: safely clear localStorage inside the iframe ── */
  function safeClearLS() {
    try { win.localStorage.clear(); } catch (_) {}
  }

  /* ── reset iframe to a known baseline ───────────────────── */
  function resetBaseline() {
    safeClearLS();
    const wiz = doc.getElementById('wizard-overlay'); if (wiz) wiz.style.display = 'none';  // v2.0: dismiss auto-opened wizard
    const cb = doc.getElementById('btn-compare'); if (cb && cb.classList.contains('compare-on')) cb.click();  // v2.0: exit compare
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
    setVal('input-income',    '60000'); fireBlur('input-income');
    setVal('input-spending',  '30000'); fireBlur('input-spending');
    setVal('input-age',       '30');    fireBlur('input-age');
    setVal('val-return',      '7');     fireBlur('val-return');
    setVal('val-savings',     '2');     fireBlur('val-savings');
    setVal('val-inflation',   '2');     fireBlur('val-inflation');
    setVal('val-withdrawal',  '4');     fireBlur('val-withdrawal');
    setVal('val-tax-custom',  '15');    fireBlur('val-tax-custom');
    setVal('val-ter',         '0');     fireBlur('val-ter');   // fee off → blend == gross
    setVal('input-pension-age',    '67'); fireBlur('input-pension-age');
    setVal('input-pension-amount', '0');  fireBlur('input-pension-amount');
    setVal('input-pension-pot',    '0');  fireBlur('input-pension-pot');
    setVal('input-pension-contrib','0');  fireBlur('input-pension-contrib');
    win._state.events.length = 0;                              // clear any life events
    doc.getElementById('slider-alloc').value = '80';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    clickEl('btn-nominal');
    clickEl('btn-tax-none');
    clickEl('btn-strat-fixed');   // v1.8: back to fixed withdrawal
    clickEl('btn-proj-steady');   // v1.8: back to steady chart (avoid async MC bleed)
    setVal('val-cagr', '10');            fireBlur('val-cagr');
    setVal('input-target-age', '45');    fireBlur('input-target-age');
    clickEl('btn-model-income');  // v2.2: back to Income & Return model
  }
  resetBaseline();

  /* ── shared context handed to each feature file's exported runner ── */
  const ctx = { win, doc, s, setVal, fireBlur, clickEl, keyDown, text, val, style, resetBaseline };

  /* ────────────────────────────────────────────────────────
     Each feature file wraps its own groups in try/catch (one bad
     assertion can't skip the rest of ITS suite); running them as
     separate awaited calls also means a catastrophic failure in one
     file no longer skips the other two, unlike the old single-IIFE
     version — a resilience improvement, not a coverage change.
     ──────────────────────────────────────────────────────── */
  await window.runIntegrationInputs(ctx);
  await window.runIntegrationProjection(ctx);
  await window.runIntegrationFeatures(ctx);

  /* cleanup */
  safeClearLS();

  } catch (e) {
    fail++;
    out.innerHTML += `<span class="fail">❌</span>  [integration aborted] ${e.message}\n`;
  } finally {
    clearTimeout(_watchdog);
    renderSummary();
  }
})();
