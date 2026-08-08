'use strict';
/* ══════════════════════════════════════════════════════════
   INTEGRATION TESTS — inputs  (part 2/4 of the integration suite)
   Defines window.runIntegrationInputs(ctx), called by
   integration.setup.js AFTER it builds the shared iframe/helpers —
   never runs standalone. Covers raw input-widget wiring: euro
   inputs, focus/blur, age clamping, return/inflation/withdrawal/
   savings box+slider sync, allocation slider, mode buttons, tax
   buttons + custom box + annual readout, macro buttons, steppers,
   arrow keys, Retirement Readiness gauge, KPI output values.
   @map: euro inputs L17 · focus/blur L28 · age clamping L38 · return/
   inflation/withdrawal/savings box+slider L50-90 · allocation slider L92 ·
   mode buttons L114 · tax buttons+custom+readout L125-198 · macro L199 ·
   steppers L210 · arrow keys L229 · gauge L244 · KPI values L289
   ══════════════════════════════════════════════════════════ */
window.runIntegrationInputs = async function runIntegrationInputs(ctx) {
  const { win, doc, s, setVal, fireBlur, clickEl, keyDown, text, val, style, resetBaseline } = ctx;

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

    /* Box 3 → non-zero € amount. App defaults to Couple (2-person allowance = €118,714),
       so bump the portfolio well above that: peildatum base is the flat 200k
       1-Jan balance (not year-end + contributions) — still > 118,714. */
    setVal('input-portfolio', '200000'); fireBlur('input-portfolio');
    clickEl('btn-tax-box3');
    assert('tax-annual-val is non-zero under Box 3',
      text('tax-annual-val') !== '€0', text('tax-annual-val'), '!= €0');
    assert('tax-annual-val contains € symbol under Box 3',
      text('tax-annual-val').startsWith('€'), text('tax-annual-val'), 'starts with €');
    assert('no manual Box 3 € inputs exist in the DOM (v2.5 — derived from Asset Allocation)',
      doc.getElementById('input-box3-savings') === null, doc.getElementById('input-box3-savings'), null);

    /* Box 3 split is now derived from the Asset Allocation slider (v2.5): savings-heavy
       (allocInvest=0) pays less than invest-heavy (allocInvest=100). Freeze
       investReturn = savingsReturn first so moving the slider can't change the blended
       returnRate itself — isolates whether allocInvest drives Box 3 as intended. */
    setVal('val-return', '5'); fireBlur('val-return');
    setVal('val-savings', '5'); fireBlur('val-savings');
    setVal('slider-alloc', '0');
    const taxAllSavings = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    setVal('slider-alloc', '100');
    const taxAllInvest = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    assert('Box 3: invest-heavy allocation pays more tax than savings-heavy (higher deemed return)',
      taxAllInvest > taxAllSavings, taxAllInvest.toFixed(0), '> ' + taxAllSavings.toFixed(0));

    /* Single ⇄ Couple allowance toggle: halving the allowance raises the tax bill */
    const taxCouple = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    clickEl('btn-box3-single');
    assert('box3Persons = 1 after clicking Single', s.box3Persons === 1, s.box3Persons, 1);
    const taxSingle = parseFloat(text('tax-annual-val').replace(/[€,]/g, ''));
    assert('Box 3: Single allowance (€59,357) pays more tax than Couple (€118,714)',
      taxSingle > taxCouple, taxSingle.toFixed(0), '> ' + taxCouple.toFixed(0));
    clickEl('btn-box3-couple');
    assert('box3Persons = 2 after clicking Couple', s.box3Persons === 2, s.box3Persons, 2);

    /* v2.10 — tax breakdown moved into the tooltip */
    clickEl('btn-tax-box3');
    const tipTax = doc.getElementById('tip-tax').dataset.tip;
    assert('tax tooltip carries the allowance line under Box 3',
      tipTax.includes('allowance') && tipTax.includes('avg deemed'), tipTax.slice(-70), 'breakdown appended');
    clickEl('btn-tax-none');
    assert('tax tooltip drops the breakdown when tax is off',
      !doc.getElementById('tip-tax').dataset.tip.includes('avg deemed'),
      doc.getElementById('tip-tax').dataset.tip.slice(-40), 'base copy only');

    /* v2.10 — spending impact moved into the tooltip */
    assert('spending impact now lives in the label tooltip',
      doc.getElementById('tip-spending').dataset.tip.includes('FI number ='),
      doc.getElementById('tip-spending').dataset.tip.slice(-60), 'contains "FI number ="');
    assert('old visible spending-impact readout is gone',
      doc.getElementById('spending-impact') === null, doc.getElementById('spending-impact'), null);
    /* Base tooltip copy must not compound across repeated recalc() passes */
    setVal('input-portfolio', '51000'); fireBlur('input-portfolio');
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
    const spendTipOccurrences = (doc.getElementById('tip-spending').dataset.tip.match(/FI number =/g) || []).length;
    assert('spending tooltip suffix does not compound across recalcs',
      spendTipOccurrences === 1, spendTipOccurrences, 1);

    /* restore */
    clickEl('btn-tax-none');
    setVal('slider-alloc', '80');
    setVal('input-portfolio', '50000'); fireBlur('input-portfolio');
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
};
