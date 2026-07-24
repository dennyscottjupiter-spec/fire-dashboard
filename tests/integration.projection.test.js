'use strict';
/* ══════════════════════════════════════════════════════════
   INTEGRATION TESTS — projection  (part 3/4 of the integration suite)
   Defines window.runIntegrationProjection(ctx), called by
   integration.setup.js AFTER runIntegrationInputs() completes —
   never runs standalone. Covers notice banner, milestones,
   withdrawal-strategy toggle, Monte Carlo, History vintage,
   Interactive History click-to-place, TER fee, pension bridge
   inputs, lifecycle depletion note, life events manager, Box-1
   pension pot, A/B scenario compare, onboarding wizard.
   ══════════════════════════════════════════════════════════ */
window.runIntegrationProjection = async function runIntegrationProjection(ctx) {
  const { win, doc, s, setVal, fireBlur, clickEl, keyDown, text, val, style, resetBaseline } = ctx;

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

  /* ── Interactive History: click-to-place crash window (v2.5) ── */
  try {
    group('Integration — Interactive History click-to-place crash');
    resetBaseline();
    s.shockAge = null;
    clickEl('btn-proj-history');
    assert('shock-age-readout visible in History mode', style('shock-age-readout').display !== 'none', style('shock-age-readout').display, 'block');
    assert('default crash age is currentAge + 10', text('shock-age-val') === String(s.currentAge + 10), text('shock-age-val'), String(s.currentAge + 10));
    const ch = win._chart;
    assert('chart.$shock is set in History mode', ch.$shock != null, ch.$shock, '!= null');
    assert('chart.$shock.index matches the default crash age', ch.$shock.index === 10, ch.$shock.index, 10);

    // Simulate the click-to-place flow: set shockAge directly (the raw canvas
    // click itself is visually verified separately — jsdom-less harness can't
    // dispatch real pixel-accurate canvas clicks) and confirm the chart reacts.
    s.shockAge = s.currentAge + 25;
    win.recalc();
    assert('shock-age-val readout updates after moving the crash', text('shock-age-val') === String(s.currentAge + 25), text('shock-age-val'), String(s.currentAge + 25));
    assert('chart.$shock.index updates after moving the crash', ch.$shock.index === 25, ch.$shock.index, 25);
    const dataAt25 = ch.data.datasets[0].data[25];
    const steadyProj = win.runProjection(s);
    assert('portfolio data at the crash year diverges from a steady projection', dataAt25 !== Math.round(steadyProj.data[25].portfolio), dataAt25, '!= ' + Math.round(steadyProj.data[25].portfolio));

    clickEl('btn-proj-steady');
    assert('shock-age-readout hidden back in steady mode', style('shock-age-readout').display === 'none', style('shock-age-readout').display, 'none');
    s.shockAge = null;
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] Interactive History click-to-place: ${e.message}\n`; }

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
};
