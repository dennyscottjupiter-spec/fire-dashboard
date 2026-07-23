'use strict';
/* ══════════════════════════════════════════════════════════
   INTEGRATION TESTS  (async — iframe drives the real app)
   Depends on: harness.js (assert/group/out/fail/_watchdog/renderSummary).
   Loads ../index.html in a hidden iframe; needs a same-origin http server.
   ══════════════════════════════════════════════════════════ */
(async function runIntegration() {
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

  /* ────────────────────────────────────────────────────────
     Each group wrapped in try/catch so one bad assertion
     can't skip the rest of the suite
     ──────────────────────────────────────────────────────── */

  /* ── euro inputs ──────────────────────────────────────── */
  try {
    group('Integration — euro inputs (parseNum + formatting)');
    setVal('input-portfolio', '100,000');
    assert('portfolio parseNum strips comma → 100000', s.portfolio === 100000, s.portfolio, 100000);
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
    assert('portfolio blur formats → "50,000"', val('input-portfolio') === '50,000', val('input-portfolio'), '50,000');
    assert('income reads 60000', s.income === 60000, s.income, 60000);
    assert('spending reads 30000', s.spending === 30000, s.spending, 30000);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] euro inputs: ${e.message}\n`; }

  /* ── € focus strips to raw digits ──────────────────────── */
  try {
    group('Integration — € input focus/blur cycle');
    setVal('input-portfolio', '100000'); fireBlur('input-portfolio');
    assert('blur of 100000 → "100,000"', val('input-portfolio') === '100,000', val('input-portfolio'), '100,000');
    doc.getElementById('input-portfolio').dispatchEvent(new win.Event('focus', { bubbles: true }));
    assert('focus strips comma → "100000"', val('input-portfolio') === '100000', val('input-portfolio'), '100000');
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] focus/blur: ${e.message}\n`; }

  /* ── age clamping ──────────────────────────────────────── */
  try {
    group('Integration — age clamping');
    setVal('input-age', '45'); fireBlur('input-age');
    assert('age 45 accepted', s.currentAge === 45, s.currentAge, 45);
    setVal('input-age', '200'); fireBlur('input-age');
    assert('age 200 clamps to 100', s.currentAge === 100, s.currentAge, 100);
    setVal('input-age', '0'); fireBlur('input-age');
    assert('age 0 falls back to default 30 (0||30)', s.currentAge === 30, s.currentAge, 30);
    setVal('input-age', '30'); fireBlur('input-age');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] age clamping: ${e.message}\n`; }

  /* ── investment return box/slider ────────────────────────── */
  try {
    group('Integration — investment return box / slider sync');
    setVal('val-return', '12');
    assert('investReturn 12 accepted', s.investReturn === 12, s.investReturn, 12);
    assert('slider-return pins at 12 (within track max 15)', parseFloat(val('slider-return')) === 12, val('slider-return'), '12');
    setVal('val-return', '99'); fireBlur('val-return');
    assert('investReturn clamps to cap 50 on blur', s.investReturn === 50, s.investReturn, 50);
    assert('slider-return pins at track max 15', parseFloat(val('slider-return')) === 15, val('slider-return'), '15');
    setVal('val-return', '7'); fireBlur('val-return');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] return box/slider: ${e.message}\n`; }

  /* ── inflation box/slider ────────────────────────────────── */
  try {
    group('Integration — inflation box / slider sync');
    setVal('val-inflation', '8');
    assert('inflation 8 accepted', s.inflation === 8, s.inflation, 8);
    setVal('val-inflation', '99'); fireBlur('val-inflation');
    assert('inflation clamps to cap 50 on blur', s.inflation === 50, s.inflation, 50);
    setVal('val-inflation', '2'); fireBlur('val-inflation');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] inflation: ${e.message}\n`; }

  /* ── withdrawal box/slider ───────────────────────────────── */
  try {
    group('Integration — withdrawal box / slider sync');
    setVal('val-withdrawal', '5');
    assert('withdrawal 5 accepted', s.withdrawal === 5, s.withdrawal, 5);
    setVal('val-withdrawal', '25'); fireBlur('val-withdrawal');
    assert('withdrawal clamps to cap 20 on blur', s.withdrawal === 20, s.withdrawal, 20);
    setVal('val-withdrawal', '4'); fireBlur('val-withdrawal');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] withdrawal: ${e.message}\n`; }

  /* ── savings return ──────────────────────────────────────── */
  try {
    group('Integration — savings return box (no slider)');
    setVal('val-savings', '3'); fireBlur('val-savings');
    assert('savingsReturn 3 accepted', s.savingsReturn === 3, s.savingsReturn, 3);
    setVal('val-savings', '15'); fireBlur('val-savings');
    assert('savingsReturn clamps to cap 10 on blur', s.savingsReturn === 10, s.savingsReturn, 10);
    setVal('val-savings', '2'); fireBlur('val-savings');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] savings return: ${e.message}\n`; }

  /* ── allocation slider + blended return ──────────────────── */
  try {
    group('Integration — allocation slider + blended return');
    setVal('val-return', '7'); fireBlur('val-return');
    setVal('val-savings', '2'); fireBlur('val-savings');

    doc.getElementById('slider-alloc').value = '100';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    assert('alloc 100% → invest label = "100%"', text('alloc-invest-pct') === '100%', text('alloc-invest-pct'), '100%');
    assert('alloc 100% → savings label = "0%"',  text('alloc-savings-pct') === '0%',  text('alloc-savings-pct'), '0%');
    assert('blended at 100% alloc = investReturn (7)', near(s.returnRate, 7), s.returnRate, 7);

    doc.getElementById('slider-alloc').value = '50';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    assert('alloc 50/50 → blended = 4.5 (0.5·7 + 0.5·2)', near(s.returnRate, 4.5), s.returnRate, 4.5);
    assert('blended-return DOM text = "4.5"', text('blended-return') === '4.5', text('blended-return'), '4.5');

    doc.getElementById('slider-alloc').value = '80';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    assert('alloc 80/20 default → blended ≈ 6.0', near(s.returnRate, 6.0), s.returnRate, 6.0);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] allocation: ${e.message}\n`; }

  /* ── mode buttons ────────────────────────────────────────── */
  try {
    group('Integration — Real / Nominal mode buttons');
    clickEl('btn-real');
    assert('mode = "real" after click', s.mode === 'real', s.mode, 'real');
    assert('btn-real has .active class', doc.getElementById('btn-real').classList.contains('active'), true, true);
    clickEl('btn-nominal');
    assert('mode = "nominal" after click', s.mode === 'nominal', s.mode, 'nominal');
    assert('btn-nominal has .active class', doc.getElementById('btn-nominal').classList.contains('active'), true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] mode buttons: ${e.message}\n`; }

  /* ── tax buttons + visibility ────────────────────────────── */
  try {
    group('Integration — tax buttons + row visibility');
    clickEl('btn-tax-box3');
    assert('taxMode = "box3"', s.taxMode === 'box3', s.taxMode, 'box3');
    assert('tax-box3-info visible', doc.getElementById('tax-box3-info').style.display !== 'none', true, true);
    clickEl('btn-tax-custom');
    assert('taxMode = "custom"', s.taxMode === 'custom', s.taxMode, 'custom');
    assert('tax-custom-row visible', doc.getElementById('tax-custom-row').style.display !== 'none', true, true);
    clickEl('btn-tax-none');
    assert('taxMode = "none"', s.taxMode === 'none', s.taxMode, 'none');
    assert('tax-box3-info hidden again',  doc.getElementById('tax-box3-info').style.display  === 'none', doc.getElementById('tax-box3-info').style.display,  'none');
    assert('tax-custom-row hidden again', doc.getElementById('tax-custom-row').style.display === 'none', doc.getElementById('tax-custom-row').style.display, 'none');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] tax buttons: ${e.message}\n`; }

  /* ── custom tax box ──────────────────────────────────────── */
  try {
    group('Integration — custom tax % box');
    setVal('val-tax-custom', '25');
    assert('taxCustomPct = 25', s.taxCustomPct === 25, s.taxCustomPct, 25);
    setVal('val-tax-custom', '500'); fireBlur('val-tax-custom');
    assert('taxCustomPct clamps to 100 on blur', s.taxCustomPct === 100, s.taxCustomPct, 100);
    setVal('val-tax-custom', '15'); fireBlur('val-tax-custom');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] custom tax: ${e.message}\n`; }

  /* ── annual tax readout ─────────────────────────────────── */
  try {
    group('Integration — annual tax readout (#tax-annual-val)');
    resetBaseline();
    /* None → readout shows €0 */
    clickEl('btn-tax-none');
    assert('tax-annual-val shows €0 when taxMode=none',
      text('tax-annual-val') === '€0', text('tax-annual-val'), '€0');

    /* Box 3 → non-zero € amount (portfolio=50k, which is below Box3 threshold 59357,
       but year-1 P includes savings contributions: 50k + 3k gain + 30k savings = 83k > 59357) */
    clickEl('btn-tax-box3');
    assert('tax-annual-val is non-zero under Box 3',
      text('tax-annual-val') !== '€0', text('tax-annual-val'), '!= €0');
    assert('tax-annual-val contains € symbol under Box 3',
      text('tax-annual-val').startsWith('€'), text('tax-annual-val'), 'starts with €');

    /* savings-heavy (0% invest) pays less than invest-heavy (100% invest) */
    doc.getElementById('slider-alloc').value = '0';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    const taxAllSavings = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    doc.getElementById('slider-alloc').value = '100';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    const taxAllInvest = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    assert('Box 3: invest-heavy pays more tax than savings-heavy (higher deemed return)',
      taxAllInvest > taxAllSavings, taxAllInvest.toFixed(0), '> ' + taxAllSavings.toFixed(0));

    /* restore */
    clickEl('btn-tax-none');
    doc.getElementById('slider-alloc').value = '80';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] tax readout: ${e.message}\n`; }

  /* ── macro buttons ───────────────────────────────────────── */
  try {
    group('Integration — macro preset buttons');
    setVal('val-return', '10'); fireBlur('val-return');
    const modBtn = Array.from(doc.querySelectorAll('.macro-btn')).find(b => b.dataset.val === '7' && b.dataset.slider === 'slider-return');
    if (modBtn) modBtn.click();
    assert('macro "Moderate 7%" sets investReturn', s.investReturn === 7, s.investReturn, 7);
    assert('macro syncs slider-return to 7', parseFloat(val('slider-return')) === 7, val('slider-return'), '7');
    assert('macro btn gets .active-macro class', modBtn ? modBtn.classList.contains('active-macro') : false, true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] macro buttons: ${e.message}\n`; }

  /* ── steppers ▲/▼ ───────────────────────────────────────── */
  try {
    group('Integration — steppers ▲/▼ (return + savings)');
    setVal('val-return', '7'); fireBlur('val-return');
    const stepRUp = doc.querySelector('.stepper-btn[data-box="val-return"][data-dir="1"]');
    const stepRDn = doc.querySelector('.stepper-btn[data-box="val-return"][data-dir="-1"]');
    if (stepRUp) stepRUp.click();
    assert('return stepper ▲ → investReturn 7.5', near(s.investReturn, 7.5), s.investReturn, 7.5);
    if (stepRDn) { stepRDn.click(); stepRDn.click(); }
    assert('return stepper ▼ twice → investReturn 6.5', near(s.investReturn, 6.5), s.investReturn, 6.5);
    setVal('val-return', '7'); fireBlur('val-return');

    setVal('val-savings', '2'); fireBlur('val-savings');
    const stepSUp = doc.querySelector('.stepper-btn[data-box="val-savings"][data-dir="1"]');
    if (stepSUp) stepSUp.click();
    assert('savings stepper ▲ → savingsReturn 2.5 (no slider crash)', near(s.savingsReturn, 2.5), s.savingsReturn, 2.5);
    setVal('val-savings', '2'); fireBlur('val-savings');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] steppers: ${e.message}\n`; }

  /* ── arrow keys ──────────────────────────────────────────── */
  try {
    group('Integration — ArrowUp/Down on rate boxes');
    setVal('val-return', '7'); fireBlur('val-return');
    keyDown('val-return', 'ArrowUp');
    assert('ArrowUp on val-return → 7.5', near(s.investReturn, 7.5), s.investReturn, 7.5);
    keyDown('val-return', 'ArrowDown');
    assert('ArrowDown on val-return → 7.0', near(s.investReturn, 7.0), s.investReturn, 7.0);

    setVal('val-savings', '2'); fireBlur('val-savings');
    keyDown('val-savings', 'ArrowUp');
    assert('ArrowUp on val-savings → 2.5 (slider-less box)', near(s.savingsReturn, 2.5), s.savingsReturn, 2.5);
    setVal('val-savings', '2'); fireBlur('val-savings');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] arrow keys: ${e.message}\n`; }

  /* ── retirement readiness gauge ──────────────────────────── */
  try {
    group('Integration — Retirement Readiness gauge');
    setVal('input-spending', '30000'); fireBlur('input-spending');
    setVal('val-withdrawal', '4');     fireBlur('val-withdrawal');

    setVal('input-portfolio', '750000'); fireBlur('input-portfolio');
    assert('gauge = 100% at portfolio ≥ FI', text('gauge-pct') === '100%', text('gauge-pct'), '100%');

    setVal('input-portfolio', '375000'); fireBlur('input-portfolio');
    assert('gauge = 50% at portfolio = FI/2', text('gauge-pct') === '50%', text('gauge-pct'), '50%');

    setVal('input-portfolio', '0'); fireBlur('input-portfolio');
    assert('gauge = 0% at portfolio = 0', text('gauge-pct') === '0%', text('gauge-pct'), '0%');

    /* clamp: portfolio 2× FI → still shows 100% */
    setVal('input-portfolio', '1500000'); fireBlur('input-portfolio');
    assert('gauge clamps at 100% when portfolio > FI', text('gauge-pct') === '100%', text('gauge-pct'), '100%');

    /* color ramp: at 0% should be red (warn), at 50% amber, at 100% green */
    setVal('input-portfolio', '0'); fireBlur('input-portfolio');
    assert('gauge arc stroke is warn color at 0%',
      doc.getElementById('gauge-arc').style.stroke === 'var(--warn)',
      doc.getElementById('gauge-arc').style.stroke, 'var(--warn)');
    setVal('input-portfolio', '400000'); fireBlur('input-portfolio'); // ~53% → amber
    assert('gauge arc stroke is amber between 33%–80%',
      doc.getElementById('gauge-arc').style.stroke === 'var(--amber)',
      doc.getElementById('gauge-arc').style.stroke, 'var(--amber)');
    setVal('input-portfolio', '750000'); fireBlur('input-portfolio'); // 100% → green
    assert('gauge arc stroke is success at 100%',
      doc.getElementById('gauge-arc').style.stroke === 'var(--success)',
      doc.getElementById('gauge-arc').style.stroke, 'var(--success)');

    /* needle transform contains rotate */
    assert('gauge needle has rotate transform',
      doc.getElementById('gauge-needle').style.transform.includes('rotate'),
      doc.getElementById('gauge-needle').style.transform.includes('rotate'), true);

    /* checkpoint flags exist in SVG */
    const svgFlags = doc.querySelectorAll('.gauge-flag');
    assert('SVG has gauge checkpoint flag elements (.gauge-flag)', svgFlags.length > 0, svgFlags.length, '>0');

    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] gauge: ${e.message}\n`; }

  /* ── KPI values ──────────────────────────────────────────── */
  try {
    group('Integration — KPI output values');
    setVal('input-spending', '30000'); fireBlur('input-spending');
    setVal('val-withdrawal', '4');     fireBlur('val-withdrawal');
    assert('FI number contains "750" (spending/wr = 750k)', text('kpi-fi-number').includes('750'), text('kpi-fi-number'), '~€750,000');
    assert('years-to-FIRE is populated (non-empty)', text('kpi-years').length > 0, text('kpi-years'), 'non-empty');
    assert('savings-rate sub shows "SR:"', text('kpi-years-sub').startsWith('SR:'), text('kpi-years-sub').slice(0,3), 'SR:');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] KPI: ${e.message}\n`; }

  /* ── notice banner (unattainable) ────────────────────────── */
  try {
    group('Integration — notice banner (unattainable scenario)');
    setVal('input-income',   '20000'); fireBlur('input-income');
    setVal('input-spending', '30000'); fireBlur('input-spending');
    assert('notice banner visible when spending > income',
      doc.getElementById('notice-banner').classList.contains('visible'), true, true);
    assert('KPI years shows "Never" when unattainable',
      text('kpi-years').includes('Never'), text('kpi-years'), '~Never ❌');
    setVal('input-income', '60000'); fireBlur('input-income');
    assert('notice banner hidden after restoring income',
      !doc.getElementById('notice-banner').classList.contains('visible'), true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] notice banner: ${e.message}\n`; }

  /* ── milestones ──────────────────────────────────────────── */
  try {
    group('Integration — milestones achieved / unachieved');
    setVal('input-spending', '30000'); fireBlur('input-spending');
    setVal('val-withdrawal', '4');     fireBlur('val-withdrawal');

    setVal('input-portfolio', '150000'); fireBlur('input-portfolio');
    assert('First €100k milestone achieved at 150k',
      doc.querySelector('[data-milestone="100k"]').classList.contains('achieved'), true, true);
    assert('Barista milestone (375k) NOT achieved at 150k',
      !doc.querySelector('[data-milestone="barista"]').classList.contains('achieved'), true, true);

    setVal('input-portfolio', '750000'); fireBlur('input-portfolio');
    assert('Full FIRE milestone achieved at exactly 750k (FI target)',
      doc.querySelector('[data-milestone="full"]').classList.contains('achieved'), true, true);
    assert('Fat FIRE (1125k) NOT achieved at 750k',
      !doc.querySelector('[data-milestone="fat"]').classList.contains('achieved'), true, true);

    setVal('input-portfolio', '1125000'); fireBlur('input-portfolio');
    assert('Fat FIRE achieved at 1125k (150% × 750k)',
      doc.querySelector('[data-milestone="fat"]').classList.contains('achieved'), true, true);

    /* milestone threshold text is formatted € */
    const fullVal = text('ms-full-val');
    assert('Full FIRE threshold shows € amount', fullVal.includes('€') || fullVal.includes('750'), fullVal, '€750,000');

    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] milestones: ${e.message}\n`; }

  /* ── withdrawal strategy toggle (v1.8) ───────────────────── */
  try {
    group('Integration — withdrawal strategy toggle');
    resetBaseline();
    clickEl('btn-strat-gk');
    assert('strategy = gk after click', s.wdStrategy === 'gk', s.wdStrategy, 'gk');
    assert('gk button gets .active-strat', doc.getElementById('btn-strat-gk').classList.contains('active-strat'), true, true);
    clickEl('btn-strat-vpw');
    assert('strategy = vpw after click', s.wdStrategy === 'vpw', s.wdStrategy, 'vpw');
    assert('fixed button loses .active-strat', !doc.getElementById('btn-strat-fixed').classList.contains('active-strat'), true, true);
    clickEl('btn-strat-fixed');
    assert('strategy back to fixed', s.wdStrategy === 'fixed', s.wdStrategy, 'fixed');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] strategy toggle: ${e.message}\n`; }

  /* ── projection mode: Monte Carlo (v1.8) ─────────────────── */
  try {
    group('Integration — projection mode: Monte Carlo');
    resetBaseline();
    clickEl('btn-proj-mc');
    assert('projMode = montecarlo', s.projMode === 'montecarlo', s.projMode, 'montecarlo');
    assert('mc-success badge shown', doc.getElementById('mc-success').style.display !== 'none', true, true);
    await new Promise(r => setTimeout(r, 350));   // debounced MC compute (250 ms)
    const succ = text('mc-success-val');
    assert('success readout is a percentage', /^\d+%$/.test(succ), succ, 'N%');
    const pctNum = parseInt(succ, 10);
    assert('success rate within 0–100', pctNum >= 0 && pctNum <= 100, pctNum, '0–100');
    /* MC fan bands populated and ordered */
    const mcChart = win.Chart.getChart('fi-chart');
    assert('median band populated', mcChart.data.datasets[4].data.length > 0, mcChart.data.datasets[4].data.length, '>0');
    assert('p10 ≤ p50 ≤ p90 mid-horizon', mcChart.data.datasets[3].data[20] <= mcChart.data.datasets[4].data[20] && mcChart.data.datasets[4].data[20] <= mcChart.data.datasets[2].data[20], true, true);
    clickEl('btn-proj-steady');
    assert('projMode back to steady', s.projMode === 'steady', s.projMode, 'steady');
    assert('mc-success hidden in steady', doc.getElementById('mc-success').style.display === 'none', true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] Monte Carlo: ${e.message}\n`; }

  /* ── projection mode: History vintage (v1.8) ─────────────── */
  try {
    group('Integration — projection mode: History vintage');
    resetBaseline();
    clickEl('btn-proj-history');
    assert('projMode = history', s.projMode === 'history', s.projMode, 'history');
    assert('vintage select visible', doc.getElementById('vintage-select').style.display !== 'none', true, true);
    const vsel = doc.getElementById('vintage-select');
    vsel.value = '1929';
    vsel.dispatchEvent(new win.Event('change', { bubbles: true }));
    assert('vintageYear = 1929', s.vintageYear === 1929, s.vintageYear, 1929);
    clickEl('btn-proj-steady');
    assert('vintage select hidden in steady', doc.getElementById('vintage-select').style.display === 'none', true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] History vintage: ${e.message}\n`; }

  /* ── TER fund fee (fee drag) ─────────────────────────────── */
  try {
    group('Integration — TER fund fee (fee drag)');
    resetBaseline();
    doc.getElementById('slider-alloc').value = '100';
    doc.getElementById('slider-alloc').dispatchEvent(new win.Event('input', { bubbles: true }));
    setVal('val-return', '7'); fireBlur('val-return');
    setVal('val-ter', '1'); fireBlur('val-ter');
    assert('terPct = 1 accepted', s.terPct === 1, s.terPct, 1);
    assert('net blended return = 6.0 at 100% invest (7 − 1 fee)', near(s.returnRate, 6), s.returnRate, 6);
    assert('blended-return DOM shows net 6.0', text('blended-return') === '6.0', text('blended-return'), '6.0');
    assert('fee-impact readout is non-zero under 1% fee', text('fee-impact-val') !== '€0', text('fee-impact-val'), '!= €0');
    setVal('val-ter', '99'); fireBlur('val-ter');
    assert('TER clamps to cap 5 on blur', s.terPct === 5, s.terPct, 5);
    setVal('val-ter', '0'); fireBlur('val-ter');
    assert('fee-impact = €0 when TER = 0', text('fee-impact-val') === '€0', text('fee-impact-val'), '€0');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] TER fee: ${e.message}\n`; }

  /* ── pension bridge inputs ───────────────────────────────── */
  try {
    group('Integration — pension bridge inputs');
    resetBaseline();
    setVal('input-pension-age', '65'); fireBlur('input-pension-age');
    assert('pensionAge = 65', s.pensionAge === 65, s.pensionAge, 65);
    setVal('input-pension-amount', '20000'); fireBlur('input-pension-amount');
    assert('pensionAmount = 20000', s.pensionAmount === 20000, s.pensionAmount, 20000);
    assert('pension-amount formats with comma on blur', val('input-pension-amount') === '20,000', val('input-pension-amount'), '20,000');
    setVal('input-pension-amount', '0'); fireBlur('input-pension-amount');
    setVal('input-pension-age', '67'); fireBlur('input-pension-age');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] pension: ${e.message}\n`; }

  /* ── lifecycle depletion note ────────────────────────────── */
  try {
    group('Integration — lifecycle depletion note');
    resetBaseline();
    setVal('input-portfolio', '500000'); fireBlur('input-portfolio');
    setVal('input-income',    '0');      fireBlur('input-income');
    setVal('input-spending',  '100000'); fireBlur('input-spending');
    setVal('val-withdrawal',  '20');     fireBlur('val-withdrawal');
    assert('depletion note has .dry class', doc.getElementById('lifecycle-note').classList.contains('dry'), true, true);
    assert('depletion note text mentions running dry', text('lifecycle-note').toLowerCase().includes('dry'), text('lifecycle-note'), '~runs dry');
    /* well-funded retiree survives to horizon */
    setVal('input-portfolio', '2000000'); fireBlur('input-portfolio');
    setVal('input-spending',  '40000');   fireBlur('input-spending');
    setVal('val-withdrawal',  '4');       fireBlur('val-withdrawal');
    assert('survival note has .ok class for well-funded retiree', doc.getElementById('lifecycle-note').classList.contains('ok'), true, true);
    resetBaseline();
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] lifecycle note: ${e.message}\n`; }

  /* ── life events manager ─────────────────────────────────── */
  try {
    group('Integration — life events manager');
    resetBaseline();
    const before = s.events.length;
    clickEl('btn-add-event');
    assert('add event → a row appears', doc.querySelectorAll('#events-list .event-row').length === before + 1,
      doc.querySelectorAll('#events-list .event-row').length, before + 1);
    assert('add event → state.events grew', s.events.length === before + 1, s.events.length, before + 1);
    const row = doc.querySelector('#events-list .event-row:last-child');
    const amtInput = row.querySelector('.event-amount');
    amtInput.value = '100000';
    amtInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert('event amount recorded in state', s.events[s.events.length - 1].amount === 100000,
      s.events[s.events.length - 1].amount, 100000);
    /* negative outlay parses as negative */
    amtInput.value = '-50000';
    amtInput.dispatchEvent(new win.Event('input', { bubbles: true }));
    assert('negative event amount parses as −50000', s.events[s.events.length - 1].amount === -50000,
      s.events[s.events.length - 1].amount, -50000);
    row.querySelector('.event-remove').click();
    assert('remove event → row gone', doc.querySelectorAll('#events-list .event-row').length === before,
      doc.querySelectorAll('#events-list .event-row').length, before);
    assert('remove event → state.events shrank', s.events.length === before, s.events.length, before);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] life events: ${e.message}\n`; }

  /* ── Box-1 pension pot (v1.9) ────────────────────────────── */
  try {
    group('Integration — Box-1 pension pot');
    resetBaseline();
    setVal('input-pension-pot', '300000'); fireBlur('input-pension-pot');
    assert('pensionPot = 300000', s.pensionPot === 300000, s.pensionPot, 300000);
    assert('pension-pot formats with comma on blur', val('input-pension-pot') === '300,000', val('input-pension-pot'), '300,000');
    setVal('input-pension-contrib', '8000'); fireBlur('input-pension-contrib');
    assert('pensionContrib = 8000', s.pensionContrib === 8000, s.pensionContrib, 8000);
    setVal('input-pension-pot', '0');     fireBlur('input-pension-pot');
    setVal('input-pension-contrib', '0'); fireBlur('input-pension-contrib');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] pension pot: ${e.message}\n`; }

  /* ── A/B scenario compare (v2.0) ─────────────────────────── */
  try {
    group('Integration — A/B scenario compare');
    resetBaseline();
    const chartOf = () => win.Chart.getChart('fi-chart');
    clickEl('btn-compare');
    assert('compare on → scenario A dataset shown', chartOf().data.datasets[5].hidden === false, chartOf().data.datasets[5].hidden, false);
    assert('compare on → live line relabels to Scenario B', chartOf().data.datasets[0].label === 'Scenario B', chartOf().data.datasets[0].label, 'Scenario B');
    assert('compare readout visible', doc.getElementById('compare-readout').style.display !== 'none', true, true);
    assert('scenario A saved to localStorage', win.localStorage.getItem('fire-dashboard-scenario-a') !== null, true, true);
    setVal('input-income', '120000'); fireBlur('input-income');
    assert('compare readout mentions FIRE years', text('compare-readout').includes('FIRE'), text('compare-readout').slice(0, 12), '~A: FIRE');
    clickEl('btn-compare');  // toggle off
    assert('compare off → A dataset hidden', chartOf().data.datasets[5].hidden === true, chartOf().data.datasets[5].hidden, true);
    assert('compare off → live line relabels back to Portfolio Value', chartOf().data.datasets[0].label === 'Portfolio Value', chartOf().data.datasets[0].label, 'Portfolio Value');
    assert('compare readout hidden when off', doc.getElementById('compare-readout').style.display === 'none', true, true);
    assert('scenario A cleared from localStorage', win.localStorage.getItem('fire-dashboard-scenario-a') === null, null, null);
    setVal('input-income', '60000'); fireBlur('input-income');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] A/B compare: ${e.message}\n`; }

  /* ── onboarding wizard (v2.0) ────────────────────────────── */
  try {
    group('Integration — onboarding wizard');
    resetBaseline();
    win.openWizard();
    assert('wizard opens', doc.getElementById('wizard-overlay').style.display === 'flex', doc.getElementById('wizard-overlay').style.display, 'flex');
    assert('wizard shows 5 progress dots', doc.querySelectorAll('#wizard-progress .wiz-dot').length === 5, doc.querySelectorAll('#wizard-progress .wiz-dot').length, 5);
    const wizIn = v => { doc.getElementById('wiz-input').value = String(v); };
    wizIn(45);        clickEl('wizard-next');
    wizIn('100,000'); clickEl('wizard-next');
    wizIn('40,000');  clickEl('wizard-next');
    wizIn(60);        clickEl('wizard-next');
    doc.querySelector('.wiz-choice[data-val="cautious"]').click();
    assert('finish button labelled on last step', doc.getElementById('wizard-next').textContent.includes('Finish'), doc.getElementById('wizard-next').textContent, '~Finish');
    clickEl('wizard-next');   // finish
    await new Promise(r => setTimeout(r, 30));
    assert('wizard applied age 45', s.currentAge === 45, s.currentAge, 45);
    assert('wizard applied income 100000', s.income === 100000, s.income, 100000);
    assert('wizard applied spending 40000', s.spending === 40000, s.spending, 40000);
    assert('wizard retireAge 60 → withdrawal 4%', s.withdrawal === 4, s.withdrawal, 4);
    assert('wizard cautious risk → alloc 40%', s.allocInvest === 40, s.allocInvest, 40);
    assert('wizard closed after finish', doc.getElementById('wizard-overlay').style.display === 'none', true, true);
    /* skip button also closes */
    win.openWizard();
    clickEl('wizard-skip');
    assert('skip closes the wizard', doc.getElementById('wizard-overlay').style.display === 'none', true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] wizard: ${e.message}\n`; }

  /* ── import guards ───────────────────────────────────────── */
  try {
    group('Integration — import size / type guards');
    const portfolioBefore = s.portfolio;

    win.importConfig(new File(['x'.repeat(102401)], 'big.json', { type: 'application/json' }));
    assert('size guard: state unchanged after >100 KB file', s.portfolio === portfolioBefore, s.portfolio, portfolioBefore);

    win.importConfig(new File(['{}'], 'bad.txt', { type: 'text/plain' }));
    assert('type guard: state unchanged after wrong-type file', s.portfolio === portfolioBefore, s.portfolio, portfolioBefore);

    /* invalid JSON content */
    win.importConfig(new File(['not valid json {{'], 'fire.json', { type: 'application/json' }));
    await new Promise(r => setTimeout(r, 150));
    assert('invalid-JSON import: state unchanged', s.portfolio === portfolioBefore, s.portfolio, portfolioBefore);

    /* valid import */
    const validCfg = JSON.stringify({ portfolio: 123456, income: 80000, spending: 25000 });
    win.importConfig(new File([validCfg], 'fire.json', { type: 'application/json' }));
    await new Promise(r => setTimeout(r, 150));
    assert('valid import applies new portfolio value', s.portfolio === 123456, s.portfolio, 123456);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] import guards: ${e.message}\n`; }

  /* ── backward-compat import (old returnRate key) ─────────── */
  try {
    group('Integration — backward-compat import (old returnRate key)');
    const oldCfg = JSON.stringify({ portfolio: 90000, returnRate: 8 });
    win.importConfig(new File([oldCfg], 'fire.json', { type: 'application/json' }));
    await new Promise(r => setTimeout(r, 150));
    assert('old config: portfolio applied', s.portfolio === 90000, s.portfolio, 90000);
    assert('old config: investReturn set to 8 (from returnRate)', s.investReturn === 8, s.investReturn, 8);
    assert('old config: allocInvest forced to 100', s.allocInvest === 100, s.allocInvest, 100);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] backward-compat import: ${e.message}\n`; }

  /* ── split-return state fields ───────────────────────────── */
  try {
    group('Integration — split-return state fields');
    resetBaseline();
    assert('state.investReturn is a number',  typeof s.investReturn  === 'number', typeof s.investReturn,  'number');
    assert('state.savingsReturn is a number', typeof s.savingsReturn === 'number', typeof s.savingsReturn, 'number');
    assert('state.allocInvest is a number',   typeof s.allocInvest   === 'number', typeof s.allocInvest,   'number');
    const expectedBlend = s.allocInvest / 100 * s.investReturn + (1 - s.allocInvest / 100) * s.savingsReturn;
    assert('state.returnRate equals blend formula', near(s.returnRate, expectedBlend, 0.001), s.returnRate, expectedBlend);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] split-return: ${e.message}\n`; }

  /* ── localStorage persistence round-trip ─────────────────── */
  try {
    group('Integration — localStorage persistence round-trip');
    resetBaseline();
    setVal('input-portfolio', '88888'); fireBlur('input-portfolio');
    /* saveState() fires on every recalc — check LS now */
    const stored = JSON.parse(win.localStorage.getItem(win._LS_KEY || 'fire-dashboard-state') || '{}');
    assert('portfolio 88888 persisted to localStorage', stored.portfolio === 88888, stored.portfolio, 88888);
    assert('inflation persisted to localStorage', stored.inflation === s.inflation, stored.inflation, s.inflation);
    assert('terPct persisted to localStorage', stored.terPct === s.terPct, stored.terPct, s.terPct);
    assert('pensionAge persisted to localStorage', stored.pensionAge === s.pensionAge, stored.pensionAge, s.pensionAge);
    assert('wdStrategy persisted to localStorage', stored.wdStrategy === s.wdStrategy, stored.wdStrategy, s.wdStrategy);
    assert('projMode persisted to localStorage', stored.projMode === s.projMode, stored.projMode, s.projMode);
    assert('pensionPot persisted to localStorage', stored.pensionPot === s.pensionPot, stored.pensionPot, s.pensionPot);
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] localStorage round-trip: ${e.message}\n`; }

  /* ── Reset button (two-step confirm) ─────────────────────── */
  try {
    group('Integration — Reset saved data button (two-step confirm)');
    // Flush any pending FileReader onload from the import tests above: a late
    // callback fires recalc()→saveState() and would re-write the LS key right
    // after reset removes it. Draining here keeps the LS-null assertion stable.
    await new Promise(r => setTimeout(r, 250));
    resetBaseline();
    setVal('input-portfolio', '99999'); fireBlur('input-portfolio');
    const lsKey = win._LS_KEY || 'fire-dashboard-state';
    assert('LS has data before reset', win.localStorage.getItem(lsKey) !== null, true, true);

    const resetBtn = doc.getElementById('btn-reset');
    if (resetBtn) {
      /* 1st click: arm — must NOT reset yet */
      resetBtn.click();
      await new Promise(r => setTimeout(r, 50));
      assert('single click does NOT reset LS (guard)', win.localStorage.getItem(lsKey) !== null,
        win.localStorage.getItem(lsKey) !== null, true);
      assert('single click does NOT reset portfolio (guard)', s.portfolio === 99999, s.portfolio, 99999);
      assert('button gets .armed class after 1st click', resetBtn.classList.contains('armed'), true, true);

      /* 2nd click: confirm — now it resets */
      resetBtn.click();
      await new Promise(r => setTimeout(r, 50));
      assert('LS key removed after 2nd click', win.localStorage.getItem(lsKey) === null,
        win.localStorage.getItem(lsKey), null);
      assert('portfolio returns to default (50000) after 2nd click', s.portfolio === 50000, s.portfolio, 50000);
      assert('button disarms after reset (.armed removed)', !resetBtn.classList.contains('armed'), true, true);
    } else {
      fail++;
      out.innerHTML += `<span class="fail">❌</span>  Reset button (#btn-reset) not found in DOM\n`;
    }
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] reset button: ${e.message}\n`; }

  /* ── Growth Model toggle + dimming (v2.2) ────────────────── */
  try {
    group('Integration — Growth Model toggle + dimming');
    resetBaseline();
    assert('boots on income model', s.growthModel === 'income', s.growthModel, 'income');
    assert('cagr-block hidden in income model', style('cagr-block').display === 'none', style('cagr-block').display, 'none');
    clickEl('btn-model-cagr');
    assert('growthModel = cagr after click', s.growthModel === 'cagr', s.growthModel, 'cagr');
    assert('btn-model-cagr gets .active-model', doc.getElementById('btn-model-cagr').classList.contains('active-model'), true, true);
    assert('btn-model-income loses .active-model', !doc.getElementById('btn-model-income').classList.contains('active-model'), true, true);
    assert('cagr-block visible in CAGR model', style('cagr-block').display === 'block', style('cagr-block').display, 'block');
    assert('group-income gets .model-dimmed', doc.getElementById('group-income').classList.contains('model-dimmed'), true, true);
    assert('group-return gets .model-dimmed', doc.getElementById('group-return').classList.contains('model-dimmed'), true, true);
    assert('group-savings-label gets .model-dimmed', doc.getElementById('group-savings-label').classList.contains('model-dimmed'), true, true);
    clickEl('btn-model-income');
    assert('growthModel back to income', s.growthModel === 'income', s.growthModel, 'income');
    assert('group-income loses .model-dimmed', !doc.getElementById('group-income').classList.contains('model-dimmed'), true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] growth model toggle: ${e.message}\n`; }

  /* ── CAGR mode drives Years-to-FIRE + FIRE-year pill ─────── */
  try {
    group('Integration — CAGR rate drives Years to FIRE');
    resetBaseline();
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
    setVal('input-spending', '30000');  fireBlur('input-spending');
    setVal('val-withdrawal', '4');      fireBlur('val-withdrawal');
    clickEl('btn-model-cagr');
    setVal('val-cagr', '5'); fireBlur('val-cagr');
    const yearsLo = text('kpi-years');
    setVal('val-cagr', '25'); fireBlur('val-cagr');
    const yearsHi = text('kpi-years');
    assert('a higher CAGR reaches FIRE sooner', yearsLo !== yearsHi, `${yearsLo} vs ${yearsHi}`, 'different');
    assert('KPI sub-line shows compounding readout in CAGR mode',
      text('kpi-years-sub').includes('compounding'), text('kpi-years-sub'), '~compounding at');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] CAGR drives KPIs: ${e.message}\n`; }

  /* ── CAGR reverse solver + Use✓ button ────────────────────── */
  try {
    group('Integration — CAGR reverse solver + Use button');
    resetBaseline();
    setVal('input-age', '30'); fireBlur('input-age');
    clickEl('btn-model-cagr');
    setVal('input-target-age', '45'); fireBlur('input-target-age');
    assert('solver readout renders a %/yr value', /→ [\d.]+%\/yr/.test(text('cagr-solve-result')), text('cagr-solve-result'), '~→ N.N%/yr');
    assert('Use button enabled for a reachable target', !doc.getElementById('btn-apply-cagr').disabled, false, false);
    clickEl('btn-apply-cagr');
    assert('Use button copies the solved rate into #val-cagr',
      near(parseFloat(val('val-cagr')), s.cagrPct, 0.05), val('val-cagr'), s.cagrPct);
    const fireYearsAfterApply = s.growthModel === 'cagr' ? true : false;
    assert('growthModel stays cagr after applying', fireYearsAfterApply, true, true);

    /* unreachable target: 1 year out with a huge FI gap */
    setVal('input-spending', '5000000'); fireBlur('input-spending');
    setVal('input-target-age', '31');    fireBlur('input-target-age');
    assert('unreachable target shows "not reachable"', text('cagr-solve-result').includes('not reachable'), text('cagr-solve-result'), '~not reachable ❌');
    assert('cagr-solve-result gets .unreachable class', doc.getElementById('cagr-solve-result').classList.contains('unreachable'), true, true);
    assert('Use button disabled when unreachable', doc.getElementById('btn-apply-cagr').disabled, true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] CAGR reverse solver: ${e.message}\n`; }

  /* ── Implied-CAGR bridge readout (both models) ───────────── */
  try {
    group('Integration — implied-CAGR bridge readout');
    resetBaseline();
    assert('implied readout shows in income model', text('cagr-implied').includes('%/yr'), text('cagr-implied'), '~compounds at N%/yr');
    clickEl('btn-model-cagr');
    assert('implied readout still shows in CAGR model', text('cagr-implied').includes('%/yr'), text('cagr-implied'), '~compounds at N%/yr');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] implied CAGR: ${e.message}\n`; }

  /* ── Monte Carlo / History disabled in CAGR mode ─────────── */
  try {
    group('Integration — Monte Carlo / History disabled in CAGR mode');
    resetBaseline();
    assert('MC button enabled in income model', !doc.getElementById('btn-proj-mc').disabled, false, false);
    assert('History button enabled in income model', !doc.getElementById('btn-proj-history').disabled, false, false);
    clickEl('btn-proj-history');
    assert('projMode = history before switching model', s.projMode === 'history', s.projMode, 'history');
    clickEl('btn-model-cagr');
    assert('MC button disabled in CAGR mode', doc.getElementById('btn-proj-mc').disabled, true, true);
    assert('History button disabled in CAGR mode', doc.getElementById('btn-proj-history').disabled, true, true);
    assert('projMode forced to steady entering CAGR mode', s.projMode === 'steady', s.projMode, 'steady');
    clickEl('btn-model-income');
    assert('MC button re-enabled back in income model', !doc.getElementById('btn-proj-mc').disabled, false, false);
    assert('History button re-enabled back in income model', !doc.getElementById('btn-proj-history').disabled, false, false);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] MC/History disablement: ${e.message}\n`; }

  /* ── localStorage round-trip for CAGR fields ─────────────── */
  try {
    group('Integration — localStorage round-trip (CAGR fields)');
    resetBaseline();
    clickEl('btn-model-cagr');
    setVal('val-cagr', '17.5'); fireBlur('val-cagr');
    setVal('input-target-age', '50'); fireBlur('input-target-age');
    const lsKey = win._LS_KEY || 'fire-dashboard-state';
    const stored = JSON.parse(win.localStorage.getItem(lsKey) || '{}');
    assert('growthModel persisted to localStorage', stored.growthModel === 'cagr', stored.growthModel, 'cagr');
    assert('cagrPct persisted to localStorage', near(stored.cagrPct, 17.5, 0.01), stored.cagrPct, 17.5);
    assert('targetFireAge persisted to localStorage', stored.targetFireAge === 50, stored.targetFireAge, 50);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] CAGR localStorage round-trip: ${e.message}\n`; }

  /* ── Export/Import round-trip for CAGR fields ────────────── */
  try {
    group('Integration — export/import round-trip (CAGR fields)');
    resetBaseline();
    clickEl('btn-model-cagr');
    setVal('val-cagr', '13'); fireBlur('val-cagr');
    setVal('input-target-age', '52'); fireBlur('input-target-age');
    // exportConfig() serialises `state` the same way saveState() does — reuse
    // state directly as the "exported" payload (avoids driving a real file download).
    const exported = JSON.parse(JSON.stringify({
      growthModel: s.growthModel, cagrPct: s.cagrPct, targetFireAge: s.targetFireAge,
    }));
    resetBaseline();  // back to income model, defaults
    win.applyConfig(exported);
    win.recalc();
    assert('imported growthModel restores cagr', s.growthModel === 'cagr', s.growthModel, 'cagr');
    assert('imported cagrPct restores 13', near(s.cagrPct, 13, 0.01), s.cagrPct, 13);
    assert('imported targetFireAge restores 52', s.targetFireAge === 52, s.targetFireAge, 52);
    assert('cagr-block visible after import restores cagr model', style('cagr-block').display === 'block', style('cagr-block').display, 'block');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] CAGR export/import: ${e.message}\n`; }

  /* ── Old config (no growthModel) stays backward-compatible ── */
  try {
    group('Integration — old config (no growthModel) stays on income model');
    resetBaseline();
    clickEl('btn-model-cagr');  // start from CAGR to prove the old import doesn't touch it either way
    clickEl('btn-model-income');
    const oldCfg = JSON.stringify({ portfolio: 77000, returnRate: 6 });
    win.importConfig(new File([oldCfg], 'old.json', { type: 'application/json' }));
    await new Promise(r => setTimeout(r, 150));
    assert('old config import leaves growthModel on income', s.growthModel === 'income', s.growthModel, 'income');
    assert('old config import still applies portfolio', s.portfolio === 77000, s.portfolio, 77000);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] old config backward compat: ${e.message}\n`; }

  /* ── Reset returns to income model ───────────────────────── */
  try {
    group('Integration — Reset returns to Growth Model default');
    resetBaseline();
    clickEl('btn-model-cagr');
    setVal('val-cagr', '22'); fireBlur('val-cagr');
    const resetBtn = doc.getElementById('btn-reset');
    resetBtn.click();                              // arm
    await new Promise(r => setTimeout(r, 50));
    resetBtn.click();                              // confirm
    await new Promise(r => setTimeout(r, 50));
    assert('Reset restores growthModel to income', s.growthModel === 'income', s.growthModel, 'income');
    assert('Reset restores cagrPct to default (10)', s.cagrPct === 10, s.cagrPct, 10);
    assert('Reset hides the cagr-block again', style('cagr-block').display === 'none', style('cagr-block').display, 'none');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] reset growth model: ${e.message}\n`; }

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
