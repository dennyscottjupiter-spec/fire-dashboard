'use strict';
/* ══════════════════════════════════════════════════════════
   INTEGRATION TESTS — features  (part 4/4 of the integration suite)
   Defines window.runIntegrationFeatures(ctx), called by
   integration.setup.js AFTER runIntegrationProjection() completes —
   never runs standalone. Covers import guards, backward-compat
   import, split-return state fields, localStorage round-trip,
   Reset button, Growth Model toggle + dimming, CAGR reverse solver +
   implied-CAGR bridge, MC/History disablement in CAGR, Perpetual
   growth model, CAGR localStorage/export-import round-trips, old
   config backward-compat, Help modal, Export dropdown.
   @map: import guards L18 · backward-compat import L41 · split-return
   fields L52 · localStorage round-trip L63 · Reset button L80 · Growth
   Model dimming L115-146 · CAGR drives KPIs L148 · CAGR solver L165 ·
   implied-CAGR L188 · MC/History disabled L197 · Perpetual model L214 ·
   CAGR localStorage/export-import L249-281 · old config L284 · Reset to
   default L297 · Help modal L313 · Export dropdown L331
   ══════════════════════════════════════════════════════════ */
window.runIntegrationFeatures = async function runIntegrationFeatures(ctx) {
  const { win, doc, s, setVal, fireBlur, clickEl, keyDown, text, val, style, resetBaseline } = ctx;

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

  /* ── updateAllocDim: Asset Allocation dims in CAGR only when Box 3 is off (v2.5) ── */
  try {
    group('Integration — Asset Allocation dimming follows Box 3 coupling');
    resetBaseline();
    clickEl('btn-tax-none');
    clickEl('btn-model-cagr');
    assert('group-alloc dims in CAGR mode with tax off', doc.getElementById('group-alloc').classList.contains('model-dimmed'), true, true);
    clickEl('btn-tax-box3');
    assert('group-alloc stays live in CAGR mode once Box 3 is on', !doc.getElementById('group-alloc').classList.contains('model-dimmed'), false, false);
    clickEl('btn-model-income');
    assert('group-alloc never dims in income model', !doc.getElementById('group-alloc').classList.contains('model-dimmed'), false, false);
    clickEl('btn-tax-none');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] alloc dimming: ${e.message}\n`; }

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

  /* ── Perpetual growth model (v2.5) ────────────────────────── */
  try {
    group('Integration — Perpetual growth model toggle + block');
    resetBaseline();
    assert('perpetual-block hidden in income model', style('perpetual-block').display === 'none', style('perpetual-block').display, 'none');
    clickEl('btn-model-perp');
    assert('growthModel = perpetual after click', s.growthModel === 'perpetual', s.growthModel, 'perpetual');
    assert('btn-model-perp gets .active-model', doc.getElementById('btn-model-perp').classList.contains('active-model'), true, true);
    assert('perpetual-block visible in Perpetual model', style('perpetual-block').display === 'block', style('perpetual-block').display, 'block');
    assert('cagr-block stays hidden in Perpetual model', style('cagr-block').display === 'none', style('cagr-block').display, 'none');
    assert('group-income stays live (not dimmed) in Perpetual model', !doc.getElementById('group-income').classList.contains('model-dimmed'), false, false);
    assert('group-return stays live (not dimmed) in Perpetual model', !doc.getElementById('group-return').classList.contains('model-dimmed'), false, false);
    assert('group-alloc stays live (not dimmed) in Perpetual model', !doc.getElementById('group-alloc').classList.contains('model-dimmed'), false, false);
    assert('MC button disabled in Perpetual model', doc.getElementById('btn-proj-mc').disabled, true, true);
    assert('History button disabled in Perpetual model', doc.getElementById('btn-proj-history').disabled, true, true);
    assert('implied-CAGR bridge is hidden in Perpetual model', text('cagr-implied') === '', text('cagr-implied'), '');

    // FI Number KPI should equal the perpetual capital, and the build-up chain should render
    assert('perp-g renders a % value', /%$/.test(text('perp-g')), text('perp-g'), '~N.N%');
    assert('perp-r renders a % value', /%$/.test(text('perp-r')), text('perp-r'), '~N.N%');
    assert('perp-capital matches FI Number KPI', text('perp-capital') === text('kpi-fi-number'), text('perp-capital'), text('kpi-fi-number'));
    assert('sensitivity table renders 5 rows', doc.querySelectorAll('#perp-sensitivity tbody tr').length === 5, doc.querySelectorAll('#perp-sensitivity tbody tr').length, 5);
    assert('perp-warning hidden for a normal reachable plan', style('perp-warning').display === 'none', style('perp-warning').display, 'none');

    // Force r ≤ 0 (return well below inflation) → unreachable warning + ∞ capital
    setVal('val-return', '1');  fireBlur('val-return');
    setVal('val-savings', '1'); fireBlur('val-savings');
    setVal('val-inflation', '8'); fireBlur('val-inflation');
    assert('perp-warning shows when r ≤ 0', style('perp-warning').display === 'block', style('perp-warning').display, 'block');
    assert('FI Number shows ∞ when unreachable', text('kpi-fi-number') === '∞', text('kpi-fi-number'), '∞');

    clickEl('btn-model-income');
    assert('MC/History re-enabled back in income model', !doc.getElementById('btn-proj-mc').disabled && !doc.getElementById('btn-proj-history').disabled, true, true);
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] Perpetual growth model: ${e.message}\n`; }

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

  /* ── Help modal (v2.3) ────────────────────────────────────── */
  try {
    group('Integration — Help modal');
    resetBaseline();
    clickEl('btn-help');
    assert('Help opens on btn-help click', style('help-overlay').display === 'flex', style('help-overlay').display, 'flex');
    assert('Help defaults to first (Inputs) tab', doc.querySelector('.help-tab-btn.active')?.dataset.tab === 'inputs', doc.querySelector('.help-tab-btn.active')?.dataset.tab, 'inputs');
    doc.querySelector('[data-tab="chart"]').click();
    assert('Clicking a tab switches the active tab', doc.querySelector('.help-tab-btn.active')?.dataset.tab === 'chart', doc.querySelector('.help-tab-btn.active')?.dataset.tab, 'chart');
    assert('Panel content updates with the tab', text('help-panel').includes('Monte Carlo'), text('help-panel').slice(0, 20), '~Monte Carlo');
    keyDown('help-overlay', 'Escape');
    assert('Escape closes the Help modal', style('help-overlay').display === 'none', style('help-overlay').display, 'none');
    doc.querySelector('[data-help-tab="growth"]').click();
    assert('Learn-more link opens Help on the matching tab', doc.querySelector('.help-tab-btn.active')?.dataset.tab === 'growth', doc.querySelector('.help-tab-btn.active')?.dataset.tab, 'growth');
    clickEl('help-close');
    assert('Close button closes the Help modal', style('help-overlay').display === 'none', style('help-overlay').display, 'none');
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] help modal: ${e.message}\n`; }

  /* ── Export dropdown: JSON / PDF (v2.3) ──────────────────── */
  try {
    group('Integration — Export dropdown (JSON / PDF)');
    resetBaseline();
    const realPrint = win.print;
    win.print = () => {};   // stub — never show a real print dialog in the test run
    clickEl('btn-export');
    assert('Export menu opens on click', style('export-menu').display === 'flex', style('export-menu').display, 'flex');
    clickEl('export-pdf');
    assert('Export menu closes after choosing PDF', style('export-menu').display === 'none', style('export-menu').display, 'none');
    assert('PDF snapshot fills in the FI Number', text('print-kpi-fi') === text('kpi-fi-number'), text('print-kpi-fi'), text('kpi-fi-number'));
    assert('PDF snapshot fills in Years to FIRE', text('print-kpi-years') === text('kpi-years'), text('print-kpi-years'), text('kpi-years'));
    assert('PDF snapshot embeds the chart as a base64 image', doc.getElementById('print-chart-img').src.startsWith('data:image'), doc.getElementById('print-chart-img').src.slice(0, 15), '~data:image');
    assert('PDF snapshot lists key assumptions', text('print-assumptions').includes('Safe Withdrawal Rate'), text('print-assumptions').slice(0, 30), '~Safe Withdrawal Rate');
    win.print = realPrint;
  } catch(e) { fail++; out.innerHTML += `<span class="fail">❌</span>  [section threw] export dropdown: ${e.message}\n`; }
};
