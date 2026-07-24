/* ============================================================
   FIRE Dashboard v1.5 — app.js
   Controller: state, DOM wiring, KPI render, export/import,
   localStorage, boot.
   View widgets (chart, gauge, milestones) live in ui.js.
   Pure math lives in engine.js.
   ============================================================ */

'use strict';

/* ── 1. State + persistence live in store.js (loaded first) ── */

/* ── 2. Formatters ────────────────────────────────────────── */

// €10,000 format (en-IE = English + Euro, comma grouping, € prefix)
const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
});

// Plain comma-grouped number for inputs (no € symbol)
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/* ── 4. DOM refs ──────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const els = {
  portfolio:    $('input-portfolio'),
  income:       $('input-income'),
  spending:     $('input-spending'),
  sliderReturn: $('slider-return'),
  sliderInfl:   $('slider-inflation'),
  sliderWR:     $('slider-withdrawal'),
  valReturn:    $('val-return'),     // now <input class="value-box">
  valInfl:      $('val-inflation'),
  valWR:        $('val-withdrawal'),
  kpiFI:        $('kpi-fi-number'),
  kpiFISub:     $('kpi-fi-sub'),
  kpiYears:     $('kpi-years'),
  kpiFireYear:  $('kpi-fire-year'),
  kpiYearsSub:  $('kpi-years-sub'),
  kpiYearsCard:   $('kpi-years-card'),
  yearsFirePin:   $('years-fire-pin'),
  pinKpiYears:    $('pin-kpi-years'),
  pinKpiFireYear: $('pin-kpi-fire-year'),
  inputAge:     $('input-age'),
  notice:       $('notice-banner'),
  btnReal:      $('btn-real'),
  btnNominal:   $('btn-nominal'),
  btnExport:    $('btn-export'),
  btnImport:    $('btn-import'),
  fileInput:    $('file-input'),
  exportMenu:      $('export-menu'),
  exportJson:      $('export-json'),
  exportPdf:       $('export-pdf'),
  printDate:       $('print-date'),
  printKpiYears:   $('print-kpi-years'),
  printKpiFi:      $('print-kpi-fi'),
  printKpiSr:      $('print-kpi-sr'),
  printChartImg:   $('print-chart-img'),
  printAssumptions:$('print-assumptions'),
  // Tax
  btnTaxNone:   $('btn-tax-none'),
  btnTaxBox3:   $('btn-tax-box3'),
  btnTaxCustom: $('btn-tax-custom'),
  taxBox3Info:  $('tax-box3-info'),
  btnBox3Single:$('btn-box3-single'),
  btnBox3Couple:$('btn-box3-couple'),
  taxCustomRow: $('tax-custom-row'),
  valTaxCustom: $('val-tax-custom'),
  taxAnnualVal: $('tax-annual-val'),
  // Asset allocation
  valSavings:      $('val-savings'),
  sliderAlloc:     $('slider-alloc'),
  allocInvestPct:  $('alloc-invest-pct'),
  allocSavingsPct: $('alloc-savings-pct'),
  blendedReturn:   $('blended-return'),
  blendedSuffix:   $('blended-suffix'),
  // Gauge
  gaugeArc:    $('gauge-arc'),
  gaugeNeedle: $('gauge-needle'),
  gaugePct:    $('gauge-pct'),
  // v1.7 lifecycle
  valTer:            $('val-ter'),
  feeImpactVal:      $('fee-impact-val'),
  inputPensionAge:   $('input-pension-age'),
  inputPensionAmount:$('input-pension-amount'),
  inputPensionPot:   $('input-pension-pot'),
  inputPensionContrib:$('input-pension-contrib'),
  btnAddEvent:       $('btn-add-event'),
  eventsList:        $('events-list'),
  lifecycleNote:     $('lifecycle-note'),
  // v1.8 risk
  btnStratFixed:  $('btn-strat-fixed'),
  btnStratGk:     $('btn-strat-gk'),
  btnStratVpw:    $('btn-strat-vpw'),
  btnProjSteady:  $('btn-proj-steady'),
  btnProjMc:      $('btn-proj-mc'),
  btnProjHistory: $('btn-proj-history'),
  vintageSelect:  $('vintage-select'),
  shockAgeReadout:$('shock-age-readout'),
  shockAgeVal:    $('shock-age-val'),
  mcSuccess:      $('mc-success'),
  mcSuccessVal:   $('mc-success-val'),
  mcRuns:         $('mc-runs'),
  // v2.0 cockpit
  btnCompare:     $('btn-compare'),
  btnWizard:      $('btn-wizard'),
  compareReadout: $('compare-readout'),
  wizardOverlay:  $('wizard-overlay'),
  wizardBody:     $('wizard-body'),
  wizardProgress: $('wizard-progress'),
  wizardBack:     $('wizard-back'),
  wizardNext:     $('wizard-next'),
  wizardSkip:     $('wizard-skip'),
  // v2.3 help modal
  btnHelp:        $('btn-help'),
  helpOverlay:    $('help-overlay'),
  helpClose:      $('help-close'),
  helpTabs:       $('help-tabs'),
  helpPanel:      $('help-panel'),
  // v2.2 net-worth CAGR
  btnModelIncome:  $('btn-model-income'),
  btnModelCagr:    $('btn-model-cagr'),
  cagrBlock:       $('cagr-block'),
  valCagr:         $('val-cagr'),
  sliderCagr:      $('slider-cagr'),
  inputTargetAge:  $('input-target-age'),
  cagrSolveResult: $('cagr-solve-result'),
  btnApplyCagr:    $('btn-apply-cagr'),
  cagrImplied:     $('cagr-implied'),
  groupIncome:      $('group-income'),
  groupReturn:      $('group-return'),
  groupSavingsLabel:$('group-savings-label'),
  groupAlloc:       $('group-alloc'),
  // v2.5 perpetual growth model
  btnModelPerp:    $('btn-model-perp'),
  perpetualBlock:  $('perpetual-block'),
  perpG:           $('perp-g'),
  perpN:           $('perp-n'),
  perpR:           $('perp-r'),
  perpCapital:     $('perp-capital'),
  perpTaxLine:     $('perp-tax-line'),
  perpWarning:     $('perp-warning'),
  perpSensitivity: $('perp-sensitivity'),
};

/* ── A/B scenario compare state (module-level, not in saved config) ── */
const LS_SCENARIO_A = 'fire-dashboard-scenario-a';
let compareOn = false;
let scenarioA = null;   // frozen deterministic snapshot of the plan

/* ── 5. Macro button active state ───────────────────────── */
function refreshMacroActive() {
  document.querySelectorAll('.macro-btn').forEach(btn => {
    // Compare against the value-box (source of truth), not the slider
    const boxId = btn.dataset.slider.replace('slider-', 'val-');
    const box   = $(boxId);
    const val   = parseFloat(btn.dataset.val);
    btn.classList.toggle('active-macro', box && parseFloat(box.value) === val);
  });
}

/* ── 6. Recalculate + Render ─────────────────────────────── */
function recalc() {
  // € fields via parseNum (handles "50,000" strings)
  state.portfolio  = Math.max(0, parseNum(els.portfolio.value));
  state.income     = Math.max(0, parseNum(els.income.value));
  state.spending   = Math.max(0, parseNum(els.spending.value));
  state.currentAge = Math.max(1, Math.min(100, parseNum(els.inputAge.value) || 30));

  // Rate fields read from the editable value-boxes (source of truth)
  state.investReturn  = parseFloat(els.valReturn.value)    || 0;
  state.savingsReturn = parseFloat(els.valSavings.value)   || 0;
  state.allocInvest   = parseFloat(els.sliderAlloc.value);
  state.terPct        = Math.max(0, parseFloat(els.valTer.value) || 0);
  state.cagrPct       = Math.max(0, parseFloat(els.valCagr.value) || 0);
  state.targetFireAge = Math.max(1, Math.min(100, parseNum(els.inputTargetAge.value) || 45));
  const a = state.allocInvest / 100;
  // Fund fee (TER) is skimmed off the invested slice before blending; the engine
  // sees this net return. The fee-free blend is kept for the fee-impact readout.
  // In CAGR mode the typed rate replaces the blend entirely — but Box 3 (v2.5)
  // reads allocInvest directly, so updateAllocDim() keeps it live whenever Box 3
  // is the active tax mode, even in CAGR mode.
  let grossReturn;
  if (state.growthModel === 'cagr') {
    grossReturn      = state.cagrPct;
    state.returnRate = state.cagrPct - state.terPct;
  } else {
    grossReturn      = a * state.investReturn + (1 - a) * state.savingsReturn;
    state.returnRate = a * (state.investReturn - state.terPct) + (1 - a) * state.savingsReturn;
  }
  els.allocInvestPct.textContent  = Math.round(state.allocInvest)       + '%';
  els.allocSavingsPct.textContent = Math.round(100 - state.allocInvest) + '%';
  els.blendedReturn.textContent   = (state.growthModel === 'cagr' ? state.cagrPct : state.returnRate).toFixed(1);
  els.blendedSuffix.textContent   = state.growthModel === 'cagr'
    ? '% net-worth CAGR'
    : '% blended return';
  state.inflation    = parseFloat(els.valInfl.value)      || 0;
  state.withdrawal   = parseFloat(els.valWR.value)        || 0;
  state.taxCustomPct = parseFloat(els.valTaxCustom.value) || 0;
  state.pensionAge     = Math.max(1, Math.min(100, parseNum(els.inputPensionAge.value) || 67));
  state.pensionAmount  = Math.max(0, parseNum(els.inputPensionAmount.value));
  state.pensionPot     = Math.max(0, parseNum(els.inputPensionPot.value));
  state.pensionContrib = Math.max(0, parseNum(els.inputPensionContrib.value));

  refreshMacroActive();

  const isPerp = state.growthModel === 'perpetual';
  const det = isPerp ? runPerpetual(state) : runProjection(state);   // deterministic path drives all KPIs
  const { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge } = det;

  // ── KPI: FI Number
  els.kpiFI.textContent    = isFinite(fiTarget) ? eur.format(fiTarget) : '∞';
  els.kpiFISub.textContent = isPerp
    ? `Capital for ${eur.format(state.spending)}/yr, inflation-protected — forever`
    : `Covers ${eur.format(state.spending)}/yr · ${eur.format(state.spending / 12)}/mo`;

  // ── KPI: Years to FIRE
  if (yearsToFI === 0) {
    els.kpiYears.textContent = "You're FI! 🎉";
    els.kpiYears.className   = 'kpi-value';
  } else if (yearsToFI !== null) {
    els.kpiYears.textContent = yearsToFI + (yearsToFI === 1 ? ' year' : ' years');
    els.kpiYears.className   = 'kpi-value';
  } else {
    els.kpiYears.textContent = unattainable ? 'Never ❌' : '>50 yrs';
    els.kpiYears.className   = 'kpi-value' + (unattainable ? ' warn' : '');
  }

  // ── KPI: FIRE year + age pill
  if (yearsToFI !== null && yearsToFI <= 50) {
    const fireYear = new Date().getFullYear() + yearsToFI;
    const fireAge  = state.currentAge + yearsToFI;
    els.kpiFireYear.textContent   = yearsToFI === 0
      ? '🔥 Already FI!'
      : `🔥 ${fireYear} · age ${fireAge}`;
    els.kpiFireYear.style.display = 'inline-block';
  } else {
    els.kpiFireYear.style.display = 'none';
  }

  // Mirror into the header pin (visibility toggled separately by an IntersectionObserver)
  els.pinKpiYears.textContent    = els.kpiYears.textContent;
  els.pinKpiFireYear.textContent = els.kpiFireYear.style.display === 'none' ? '' : els.kpiFireYear.textContent;

  if (state.growthModel === 'cagr') {
    els.kpiYearsSub.textContent = `Net worth compounding at ${state.cagrPct.toFixed(1)}%/yr`;
  } else {
    const srLabel      = savingsRate > 0 ? savingsRate.toFixed(1) + '%' : '0%';
    const savingsLabel = savings > 0
      ? `Saving ${eur.format(savings)}/yr`
      : savings < 0
        ? `Deficit ${eur.format(-savings)}/yr`
        : 'No savings';
    els.kpiYearsSub.textContent = `SR: ${srLabel} · ${savingsLabel}`;
  }

  // ── Tax readout
  els.taxAnnualVal.textContent = eur.format(firstYearTax);

  // ── Fee-drag impact: rerun fee-free, compare LIFETIME wealth at the horizon.
  // Comparing at retirement is unreliable — the fee-free run reaches FI earlier and
  // is already drawing down, so it can dip below the still-accumulating fee run there.
  // At the longevity horizon the compounding gap is unambiguous (and dramatic).
  // Skipped in Perpetual mode: fees change the required capital itself (not just
  // the wealth at a fixed horizon), so a like-for-like rerun doesn't apply here.
  const lastIdx = data.length - 1;
  if (isPerp) {
    els.feeImpactVal.textContent = 'n/a';
  } else {
    const feeFreeProj = runProjection({ ...state, returnRate: grossReturn });
    const feeLost      = Math.max(0, feeFreeProj.data[lastIdx].portfolio - data[lastIdx].portfolio);
    els.feeImpactVal.textContent = eur.format(feeLost);
  }

  // ── Lifecycle note: does the pot survive the plan?
  if (depleteAge !== null) {
    els.lifecycleNote.textContent = `🔴 At this spending, your pot runs dry at age ${depleteAge}.`;
    els.lifecycleNote.className   = 'lifecycle-note has-tip dry';
  } else if (yearsToFI !== null) {
    els.lifecycleNote.textContent = `🟢 Your pot lasts through age ${data[lastIdx].age}.`;
    els.lifecycleNote.className   = 'lifecycle-note has-tip ok';
  } else {
    els.lifecycleNote.textContent = '';
    els.lifecycleNote.className   = 'lifecycle-note has-tip';
  }

  // ── Notice banner
  els.notice.classList.toggle('visible', unattainable);

  // ── A/B compare readout + chart (Steady / Monte Carlo / History)
  updateCompareReadout(det);
  renderChart(det);

  // ── Gauge
  updateGauge(isFinite(fiTarget) && fiTarget > 0 ? state.portfolio / fiTarget : 0);

  // ── Milestones (at t=0, mode-independent)
  const realReturn = (1 + state.returnRate / 100) / (1 + state.inflation / 100) - 1;
  updateMilestones(state.portfolio, fiTarget, state.currentAge, realReturn);

  // ── CAGR reverse solver + implied-CAGR bridge (v2.2)
  if (state.growthModel === 'cagr') {
    const g = solveCagrForAge(state, state.targetFireAge);
    els.cagrSolveResult.textContent = g === null ? '→ not reachable ❌' : `→ ${g.toFixed(1)}%/yr`;
    els.cagrSolveResult.classList.toggle('unreachable', g === null);
    els.btnApplyCagr.disabled = (g === null);
    els.cagrSolveResult._solved = g;
  }
  // Implied CAGR bridge: shown for Income & CAGR modes, hidden in Perpetual
  // (its own build-up readout — g→n→r→P — already tells that story).
  if (isPerp) {
    els.cagrImplied.textContent = '';
    renderPerpetual(perpetualCapital(state), perpetualSensitivity(state));
  } else {
    const incomeProj = state.growthModel === 'cagr'
      ? runProjection({ ...state, growthModel: 'income' })
      : det;
    const imp = impliedCagr(incomeProj, state.portfolio);
    els.cagrImplied.textContent = imp === null
      ? ''
      : `💡 Your income & return plan compounds at ≈ ${imp.toFixed(1)}%/yr`;
  }

  // Persist every recalc (fire-and-forget, silently fails if storage unavailable)
  saveState();
}

/* ── 6b. Chart renderer — Steady / Monte Carlo / History ──── */
const MC_RUNS = 1000, MC_SEED = 0x51fe;
let _mcTimer = null;

function eventMarkers(lastIdx) {
  return state.events
    .map(e => ({ index: Math.round(e.age) - state.currentAge, amount: Number(e.amount) || 0, label: e.label || '' }))
    .filter(e => e.index >= 1 && e.index <= lastIdx);
}

function renderChart(det) {
  if (!chartReady) return;
  const ds = chart.data.datasets;

  if (state.projMode === 'montecarlo') {
    ds[0].hidden = true;                       // hide the single deterministic path
    ds[2].hidden = ds[3].hidden = ds[4].hidden = false;
    ds[5].hidden = true;                        // scenario-A off in MC view
    els.mcSuccess.style.display   = 'flex';
    els.vintageSelect.style.display = 'none';
    scheduleMonteCarlo();                       // debounced heavy compute
    return;
  }

  // Steady or History: one path in dataset 0, fan bands hidden.
  ds[0].hidden = false;
  ds[2].hidden = ds[3].hidden = ds[4].hidden = true;
  els.mcSuccess.style.display     = 'none';
  const isHistory = state.projMode === 'history';
  els.vintageSelect.style.display   = isHistory ? 'inline-block' : 'none';
  els.shockAgeReadout.style.display = isHistory ? 'block' : 'none';

  // History mode (v2.5): click the chart to place the crash at a chosen age —
  // before/after the window uses steady assumptions, the window itself replays
  // the chosen vintage's real HIST data. Defaults to age+10 until clicked.
  let proj = det;
  chart.$shock = null;
  if (isHistory) {
    const vintage = VINTAGES.find(v => v.year === state.vintageYear) || VINTAGES[0];
    const horizon = Math.max(1, Math.round(95 - state.currentAge));
    const shockAge = Math.max(state.currentAge + 1, Math.min(state.currentAge + horizon,
      state.shockAge != null ? state.shockAge : state.currentAge + 10));
    proj = runHistoricalShock(state, state.vintageYear, shockAge, vintage.span);
    chart.$shock = { index: shockAge - state.currentAge, span: vintage.span, label: vintage.label };
    els.shockAgeVal.textContent = shockAge;
  }
  const last = proj.data.length - 1;
  chart.$fireYear  = (proj.yearsToFI !== null && proj.yearsToFI <= last) ? proj.yearsToFI : null;
  chart.$drawStart = chart.$fireYear;
  chart.$events    = eventMarkers(last);
  chart.data.labels = proj.data.map(d => `Age ${d.age}`);
  ds[0].data = proj.data.map(d => Math.round(d.portfolio));
  ds[1].data = proj.data.map(d => Math.round(d.fi));

  // Scenario A overlay (A/B compare mode) — relabel the live line "Scenario B"
  // so the two plans read as clearly distinct series, not portfolio-vs-overlay.
  if (compareOn && scenarioA) {
    ds[0].label = 'Scenario B';
    const projA = scenarioA.growthModel === 'perpetual' ? runPerpetual(scenarioA) : runProjection(scenarioA);
    ds[5].data = projA.data.map(d => Math.round(d.portfolio));
    ds[5].hidden = false;
  } else {
    ds[0].label = 'Portfolio Value';
    ds[5].hidden = true;
  }
  chart.update();
}

function scheduleMonteCarlo() {
  clearTimeout(_mcTimer);
  _mcTimer = setTimeout(runAndDrawMonteCarlo, 250);   // keep slider-drag smooth
}

function runAndDrawMonteCarlo() {
  if (!chartReady || state.projMode !== 'montecarlo') return;
  const mc  = runMonteCarlo(state, MC_RUNS, MC_SEED);
  const det = runProjection(state);              // for the FI reference line
  const ds  = chart.data.datasets;
  chart.$fireYear = null; chart.$drawStart = null; chart.$events = [];
  chart.data.labels = mc.bands.map(b => `Age ${b.age}`);
  ds[1].data = det.data.map(d => Math.round(d.fi));
  ds[2].data = mc.bands.map(b => Math.round(b.p90));
  ds[3].data = mc.bands.map(b => Math.round(b.p10));
  ds[4].data = mc.bands.map(b => Math.round(b.p50));
  const pct = Math.round(mc.successRate * 100);
  els.mcSuccessVal.textContent = pct + '%';
  els.mcSuccess.className = 'mc-success ' + (pct < 70 ? 'dry' : pct < 85 ? 'mid' : 'ok');
  els.mcRuns.textContent = mc.runs.toLocaleString();
  chart.update();
}

function populateVintages() {
  els.vintageSelect.innerHTML = '';
  (typeof VINTAGES !== 'undefined' ? VINTAGES : []).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.year; opt.textContent = v.label;
    els.vintageSelect.appendChild(opt);
  });
  els.vintageSelect.value = state.vintageYear;
}

/* ── 6b2. Growth Model UI (v2.2 CAGR, v2.5 Perpetual) ────────── */
// Shows/hides the CAGR / Perpetual blocks, dims the Income + Investment
// Return groups in CAGR only (Perpetual keeps them live — it uses the same
// income-model blend to derive its gross rate; Asset Allocation is handled
// separately by updateAllocDim()), and disables Monte Carlo / History in
// BOTH CAGR and Perpetual (they inject a sequence that would silently
// override the typed CAGR / the derived real rate).
function applyGrowthModelUI() {
  const isCagr = state.growthModel === 'cagr';
  const isPerp = state.growthModel === 'perpetual';
  els.cagrBlock.style.display      = isCagr ? 'block' : 'none';
  els.perpetualBlock.style.display = isPerp ? 'block' : 'none';
  [els.groupIncome, els.groupReturn, els.groupSavingsLabel].forEach(g =>
    g.classList.toggle('model-dimmed', isCagr));
  updateAllocDim();

  const lockedOut = isCagr || isPerp;
  [els.btnProjMc, els.btnProjHistory].forEach(b => { b.disabled = lockedOut; });
  const lockTitle = isCagr
    ? 'Disabled in Net Worth CAGR mode — it would override your typed rate'
    : isPerp
      ? 'Disabled in Perpetual mode — it would override the derived real rate'
      : '';
  els.btnProjMc.title      = lockTitle;
  els.btnProjHistory.title = lockTitle;
  if (lockedOut && state.projMode !== 'steady') {
    state.projMode = 'steady';
    const projBtns = [els.btnProjSteady, els.btnProjMc, els.btnProjHistory];
    projBtns.forEach(b => b.classList.toggle('active-proj', b.dataset.proj === state.projMode));
  }
}

// Renders the layered build-up (g→n→r→P), tax line, r≤0 warning, and the
// inflation-sensitivity table for the Perpetual growth model.
function renderPerpetual(pc, sens) {
  els.perpG.textContent       = (pc.g * 100).toFixed(1) + '%';
  els.perpN.textContent       = (pc.n * 100).toFixed(1) + '%';
  els.perpR.textContent       = (pc.r * 100).toFixed(1) + '%';
  els.perpCapital.textContent = pc.unreachable ? '∞' : eur.format(pc.capital);

  els.perpTaxLine.textContent = pc.taxType === 'box3'
    ? `Tax: Box 3 wealth tax — ${(pc.drag * 100).toFixed(2)}%/yr drag on the whole pot, ${eur.format(pc.allowanceBenefit)}/yr free from the allowance`
    : pc.taxType === 'custom'
      ? `Tax: Custom — ${state.taxCustomPct || 0}%/yr on gains`
      : 'Tax: None';

  els.perpWarning.style.display = pc.unreachable ? 'block' : 'none';

  const tbody = els.perpSensitivity.querySelector('tbody');
  tbody.innerHTML = sens.map(row =>
    `<tr><td>${(row.infl * 100).toFixed(0)}%</td><td>${row.capital === null ? 'unreachable' : eur.format(row.capital)}</td></tr>`
  ).join('');
}

// Asset Allocation dims only when it's truly inert: CAGR mode dropped it from
// the return blend AND Box 3 isn't reading it for the savings/invest split.
function updateAllocDim() {
  const dim = state.growthModel === 'cagr' && state.taxMode !== 'box3';
  els.groupAlloc.classList.toggle('model-dimmed', dim);
}

/* ── 6c. A/B scenario compare ────────────────────────────── */
// Deterministic snapshot of the plan (returnRate is already fee-adjusted).
function snapshotState() {
  return JSON.parse(JSON.stringify({
    portfolio: state.portfolio, income: state.income, spending: state.spending,
    investReturn: state.investReturn, savingsReturn: state.savingsReturn, allocInvest: state.allocInvest,
    returnRate: state.returnRate, inflation: state.inflation, withdrawal: state.withdrawal,
    mode: state.mode, taxMode: state.taxMode, taxCustomPct: state.taxCustomPct,
    box3Persons: state.box3Persons,
    currentAge: state.currentAge,
    terPct: state.terPct, pensionAge: state.pensionAge, pensionAmount: state.pensionAmount,
    pensionPot: state.pensionPot, pensionContrib: state.pensionContrib, events: state.events,
    wdStrategy: state.wdStrategy,
    growthModel: state.growthModel, cagrPct: state.cagrPct,
  }));
}

function setCompareButton() {
  els.btnCompare.classList.toggle('compare-on', compareOn);
  els.btnCompare.textContent = compareOn ? '📊 Comparing ✕' : '📊 Compare';
}

function toggleCompare() {
  if (compareOn) {
    compareOn = false; scenarioA = null;
    try { localStorage.removeItem(LS_SCENARIO_A); } catch (_) {}
  } else {
    scenarioA = snapshotState();
    compareOn = true;
    try { localStorage.setItem(LS_SCENARIO_A, JSON.stringify(scenarioA)); } catch (_) {}
  }
  setCompareButton();
  recalc();
}

// FIRE calendar year for a projection (null if never reached in horizon).
function fireYearOf(proj) {
  return (proj.yearsToFI !== null && proj.yearsToFI <= proj.data.length - 1)
    ? new Date().getFullYear() + proj.yearsToFI : null;
}

function updateCompareReadout(detB) {
  if (!compareOn || !scenarioA) { els.compareReadout.style.display = 'none'; return; }
  const projA = scenarioA.growthModel === 'perpetual' ? runPerpetual(scenarioA) : runProjection(scenarioA);
  const aYr = fireYearOf(projA);
  const bYr = fireYearOf(detB);
  let delta = '';
  if (aYr && bYr) {
    const d = aYr - bYr;                        // positive → B is earlier
    if (d > 0)      delta = `<span class="cmp-delta better">→ B is ${d} yr${d > 1 ? 's' : ''} earlier 🎉</span>`;
    else if (d < 0) delta = `<span class="cmp-delta worse">→ B is ${-d} yr${-d > 1 ? 's' : ''} later</span>`;
    else            delta = `<span class="cmp-delta">→ same FIRE year</span>`;
  }
  els.compareReadout.innerHTML =
    `<span class="cmp-a">A: FIRE ${aYr || '—'}</span> &nbsp;·&nbsp; B: FIRE ${bYr || '—'} &nbsp;${delta}`;
  els.compareReadout.style.display = 'block';
}

/* ── 6d. Onboarding wizard ───────────────────────────────── */
const WIZARD_STEPS = [
  { key: 'age',       icon: '🎂', q: 'How old are you today?',                 hint: 'We use this to place your FIRE year on the calendar.',                 type: 'number', suffix: 'years old', def: () => state.currentAge },
  { key: 'income',    icon: '💵', q: 'Your yearly take-home income?',          hint: 'After tax — what actually lands in your account.',                     type: 'euro',   def: () => state.income },
  { key: 'spending',  icon: '🛒', q: 'How much do you spend per year?',        hint: 'Everything: rent, food, fun. The gap is what you invest.',             type: 'euro',   def: () => state.spending },
  { key: 'retireAge', icon: '🏖️', q: 'When do you want to stop mandatory work?', hint: 'Your target age. Earlier retirements get a safer withdrawal rate.',   type: 'number', suffix: 'years old', def: () => Math.max(state.currentAge + 1, 50) },
  { key: 'risk',      icon: '🎯', q: 'How do you feel about market swings?',   hint: 'Sets your expected return and stock/cash mix.',                        type: 'choice', def: () => 'balanced', choices: [
      { val: 'cautious', label: '🛡️ Cautious', desc: 'Steadier ride, lower growth (40% stocks)' },
      { val: 'balanced', label: '⚖️ Balanced', desc: 'A healthy mix (70% stocks)' },
      { val: 'growth',   label: '🚀 Growth',   desc: 'Ride the swings for more (95% stocks)' },
  ] },
];
let _wizIdx = 0, _wizAns = {};

function openWizard() { _wizIdx = 0; _wizAns = {}; els.wizardOverlay.style.display = 'flex'; renderWizardStep(); }
function closeWizard() { els.wizardOverlay.style.display = 'none'; }

function renderWizardStep() {
  const step = WIZARD_STEPS[_wizIdx];
  let html = `<div class="wiz-q">${step.icon} ${step.q}</div><div class="wiz-hint">${step.hint}</div>`;
  if (step.type === 'choice') {
    const cur = _wizAns[step.key] != null ? _wizAns[step.key] : step.def();
    html += '<div class="wiz-choices">';
    step.choices.forEach(c => {
      html += `<button type="button" class="wiz-choice${c.val === cur ? ' selected' : ''}" data-val="${c.val}">` +
              `<div><div class="wiz-choice-label">${c.label}</div><div class="wiz-choice-desc">${c.desc}</div></div></button>`;
    });
    html += '</div>';
  } else {
    const cur = _wizAns[step.key] != null ? _wizAns[step.key] : step.def();
    const shown = step.type === 'euro' ? numFmt.format(cur) : cur;
    html += `<input type="text" inputmode="numeric" class="wiz-input" id="wiz-input" value="${shown}" autocomplete="off" />`;
    if (step.suffix) html += `<div class="wiz-suffix">${step.suffix}</div>`;
  }
  els.wizardBody.innerHTML = html;
  els.wizardProgress.innerHTML = WIZARD_STEPS
    .map((_, i) => `<span class="wiz-dot ${i < _wizIdx ? 'done' : i === _wizIdx ? 'active' : ''}"></span>`).join('');
  els.wizardBack.disabled   = _wizIdx === 0;
  els.wizardNext.textContent = _wizIdx === WIZARD_STEPS.length - 1 ? 'Finish ✓' : 'Next →';

  if (step.type === 'choice') {
    els.wizardBody.querySelectorAll('.wiz-choice').forEach(b => b.addEventListener('click', () => {
      _wizAns[step.key] = b.dataset.val;
      els.wizardBody.querySelectorAll('.wiz-choice').forEach(x => x.classList.toggle('selected', x === b));
    }));
  } else {
    const inp = document.getElementById('wiz-input');
    if (inp) { inp.focus(); inp.select(); }
  }
}

function wizardCapture() {
  const step = WIZARD_STEPS[_wizIdx];
  if (step.type === 'choice') {
    if (_wizAns[step.key] == null) _wizAns[step.key] = step.def();
  } else {
    const inp = document.getElementById('wiz-input');
    const n = parseNum(inp ? inp.value : '');
    _wizAns[step.key] = step.type === 'euro' ? n : (n || step.def());
  }
}

function wizardNext() {
  wizardCapture();
  if (_wizIdx < WIZARD_STEPS.length - 1) { _wizIdx++; renderWizardStep(); }
  else finishWizard();
}
function wizardBack() { wizardCapture(); if (_wizIdx > 0) { _wizIdx--; renderWizardStep(); } }

function finishWizard() {
  const a = _wizAns, cfg = {};
  if (a.age != null)       cfg.currentAge = Math.max(1, Math.min(100, a.age));
  if (a.income != null)    cfg.income     = a.income;
  if (a.spending != null)  cfg.spending   = a.spending;
  if (a.retireAge != null) cfg.withdrawal = a.retireAge <= 55 ? 3.5 : a.retireAge <= 65 ? 4 : 4.5;
  if (a.risk === 'cautious')      { cfg.investReturn = 6; cfg.allocInvest = 40; cfg.savingsReturn = 2; }
  else if (a.risk === 'balanced') { cfg.investReturn = 7; cfg.allocInvest = 70; cfg.savingsReturn = 2; }
  else if (a.risk === 'growth')   { cfg.investReturn = 8; cfg.allocInvest = 95; cfg.savingsReturn = 2; }
  applyConfig(cfg);
  recalc();
  closeWizard();
}

/* ── 6e. Help modal — tabbed explainer, tooltip text reused verbatim ── */
// Each section's `tip` is copied verbatim from the matching data-tip in index.html;
// `extra` is a short plain-language add-on. Keeps the two in one place so future
// tooltip edits and this modal don't quietly drift apart.
const HELP_TABS = [
  { key: 'inputs', icon: '🎛️', label: 'Inputs', sections: [
      { tip: 'What your investments are worth today. This is your starting pot — the money already working for you.',
        extra: 'This seeds every projection as year zero — everything else compounds on top of it.' },
      { tip: 'Money you take home per year, after all taxes. The gross you see on your contract minus what the taxman keeps.',
        extra: 'Income minus spending is what actually gets invested each year.' },
      { tip: 'Everything you spend in a year: rent, food, travel, fun. The gap between income and spending is what you invest.',
        extra: 'Lowering this either speeds up FIRE or lowers the pot you need, since your FI Number is spending ÷ withdrawal rate.' },
      { tip: 'Your age today. Used to show which calendar year you’ll hit FIRE, and to calculate your Coast FI milestone.',
        extra: 'Also drives the chart’s x-axis, which is plotted in age rather than calendar year.' },
      { tip: 'Real Terms: strips out inflation so all values are in today’s purchasing power. Contributions are also deflated. The curve is lower but more honest.',
        extra: 'Nominal shows bigger, inflated future numbers; Real Terms answers "what could this actually buy today?"' },
  ] },
  { key: 'growth', icon: '📈', label: 'Growth Model', sections: [
      { tip: 'Two ways to reach FIRE. ‘Income & Return’ builds your pot from what you save each year plus market growth. ‘Net Worth CAGR’ skips all that — you just tell it how fast your total net worth grows per year, savings included.',
        extra: 'Use Income & Return if you think in salary/spending terms; use CAGR if you already track a single net-worth growth rate.' },
      { tip: 'How fast your total net worth compounds each year — this already includes the money you save, so income and spending contributions are switched off. This is a gross rate: your chosen tax mode and fund fee still apply on top.',
        extra: 'Because savings are already baked into one number, the engine doesn’t add income-minus-spending on top of it — that would double-count your contributions.' },
      { tip: 'Work it backwards: name the age you want to be financially independent, and this shows the yearly net-worth growth you’d need to get there.',
        extra: 'Solved numerically against the real simulation (tax, fees, inflation all included), not a back-of-envelope formula.' },
      { tip: 'The single equivalent annual growth rate implied by your Income & Return plan — yearly savings plus market growth combined into one compound rate. Compare it against the rate you type into the Net Worth CAGR model to sanity-check the two against each other.',
        extra: 'Always shown, even on the Income & Return model, as a bridge between the two ways of thinking about growth.' },
  ] },
  { key: 'allocation', icon: '⚖️', label: 'Allocation', sections: [
      { tip: 'How your money is split between growth investments and lower-risk savings. Both slices always sum to 100% — move the slider to change the mix.',
        extra: 'A higher invested share raises expected growth but also raises volatility — see the Monte Carlo / History views under Chart.' },
      { tip: 'The annual rate your cash savings or money-market account earns. Typically 1–4%, much lower than equities.',
        extra: 'Blended with the investment return, weighted by your allocation split, to get your overall expected portfolio return.' },
      { tip: 'How much your invested portfolio grows per year on average. ~7% is a common global stock-market assumption. Higher risk assets can go well above 15%.',
        extra: 'This is the pre-fee, pre-tax return — the fund fee (TER) and your tax mode both reduce what you actually keep.' },
  ] },
  { key: 'tax', icon: '🧾', label: 'Tax', sections: [
      { tip: 'Tax slows your portfolio’s growth each year. Box 3 (NL) is a wealth tax on assets above €57k — about 2.17%/yr. Custom lets you type your own effective rate.',
        extra: 'Tax is subtracted after that year’s growth and contributions, and the estimate shows in the "est. tax this year" readout.' },
  ] },
  { key: 'withdrawal', icon: '💧', label: 'Withdrawal', sections: [
      { tip: 'How fast prices rise each year, silently eroding the value of your money. ~2% is the central-bank target in most developed countries.',
        extra: 'Higher inflation raises your FI Number in Nominal mode (the target itself inflates) and raises the Coast FI target in Real mode.' },
      { tip: 'The % of your pot you can safely withdraw each year in retirement, without running out of money. 4% is the classic ‘Trinity Study’ rule of thumb.',
        extra: 'Your FI Number is simply spending ÷ this rate — a lower withdrawal rate demands a bigger pot but is safer.' },
      { tip: 'How you actually draw money down in retirement. A fixed amount is simplest; dynamic strategies flex with the market to survive crashes better.',
        extra: 'Fixed real = classic 4% rule. Guardrails (Guyton-Klinger) skip inflation raises after bad years and trim spending if you drift off-plan. % of pot recalculates off your current balance every year, so it mathematically never runs dry, but your income swings with the market.' },
  ] },
  { key: 'pension', icon: '🇳🇱', label: 'Pension', sections: [
      { tip: 'The messy realities a flat projection ignores: the fees your funds skim off every year, income that switches on at pension age, and one-off life events. All feed the age-by-age simulation.',
        extra: 'This is what turns a smooth compound-interest curve into a realistic, year-by-year retirement simulation.' },
      { tip: 'Total Expense Ratio: the % your funds quietly deduct each year. An index fund charges ~0.1%; an actively managed fund ~1%. Over 40 years that gap can eat a quarter of your pot — it’s subtracted straight from your investment return.',
        extra: 'The "lost to fees over your lifetime" readout reruns your whole plan fee-free and compares the terminal wealth, so you can see the gap in real €.' },
      { tip: 'The age a state or workplace pension starts paying — Dutch AOW is 67. From this age the income below covers part of your spending, so your own pot only has to bridge the early-retirement years.',
        extra: 'Everything before this age is funded entirely by your own portfolio; state/workplace income only kicks in afterwards.' },
      { tip: 'Flat state-pension income in today’s money, starting at the age above. Single-person Dutch AOW is roughly €19,000/yr. Set 0 if you don’t want to count on it.',
        extra: 'Reduces how much your own pot needs to cover each year once you reach pension age.' },
      { tip: 'Your workplace / private pension pot today (pijler 2/3). It grows tax-FREE as wealth — no Box 3 — locked until AOW age, then pays out over 20 years with each payout taxed as Box 1 income. Simplified model, not tax advice.',
        extra: 'Kept as a separate pool from your regular taxable portfolio until it annuitizes, at which point it starts paying out and topping up your income.' },
      { tip: 'Gross € added to your workplace pension pot every year (you + employer). Builds the Box-1 pot that bridges the years after AOW age.',
        extra: 'Grows alongside your regular portfolio but is walled off from Box 3 wealth tax until it pays out.' },
      { tip: 'One-off cash flows at a specific age: an inheritance or house sale (positive), or a house purchase, college, or sabbatical (negative). Each lands in that year before growth.',
        extra: 'Shown on the chart as small ▲/▼ markers at the age they occur.' },
  ] },
  { key: 'chart', icon: '📊', label: 'Chart', sections: [
      { tip: 'Blue line = your portfolio growing over time. Green dashed line = the FI target you need to hit. When blue crosses green, you’re financially independent. The line turns amber once you retire and start drawing the pot down — if it flattens at €0, your money ran out under this plan (see the note above the chart). In Monte Carlo mode, the shaded band shows the 10th-90th percentile range of outcomes and the blue line inside it is the median.',
        extra: 'The crossover point is marked with a 🔥 flag on the age axis the moment your portfolio overtakes the FI target.' },
      { tip: 'Steady: one smooth line at your average return. Clean, but ignores that real markets crash and boom.',
        extra: 'Good for a quick sanity check, but it hides sequence-of-returns risk — see Monte Carlo or History for the honest picture.' },
      { tip: 'Monte Carlo: replays 1,000 random shuffles of a century of real market years to show the RANGE of outcomes and how often your plan survives — the honest way to see Sequence-of-Returns Risk.',
        extra: 'The success-rate badge is the share of those 1,000 simulated futures where your pot lasts to age 95.' },
      { tip: 'History: replays the exact market sequence from a chosen year — e.g. retiring straight into the 1929 crash or the 2000 dot-com bust.',
        extra: 'Useful for stress-testing your plan against a real, specific historical sequence rather than a random shuffle.' },
      { tip: 'The projection spends your pot down through retirement to age 95 (your longevity horizon). ‘Runs dry at age N’ means the model expects your money to reach €0 at that age, given today’s spending, returns and withdrawal strategy — it’s a warning signal, not a hard failure.',
        extra: 'Try a more conservative withdrawal strategy (Guardrails or % of pot) or a lower withdrawal rate if this shows up red.' },
      { tip: 'Progress checkpoints on your journey to FI. Each one lights up green as soon as your current portfolio crosses that threshold.',
        extra: 'Ladder, easiest to hardest: First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%).' },
  ] },
  { key: 'tools', icon: '🧰', label: 'Tools', sections: [
      { tip: 'Guided setup: answer a few plain-language questions and we’ll fill in the sliders for you.',
        extra: 'A fast way to get reasonable starting values without touching every input by hand — you can still fine-tune afterwards.' },
      { tip: 'Snapshot your current plan as Scenario A, then keep editing as Scenario B — both are drawn on the chart so you can compare them side by side. Click again to clear.',
        extra: 'Great for "what if I retired 5 years later" or "what if I saved €200 more per month" side-by-side comparisons.' },
      { tip: 'Download your current settings as a JSON file. Share it or reload it later with Import.',
        extra: 'Nothing is uploaded anywhere — it’s a plain file saved to your own device.' },
      { tip: 'Load a previously exported JSON file to restore your saved settings.',
        extra: 'Rejects files over 100 KB or the wrong file type before reading them, so a stray file can’t corrupt your inputs.' },
      { tip: 'Clears your saved inputs from this browser’s local storage and resets all values to the defaults. Your data is stored only in this browser — never uploaded anywhere.',
        extra: 'Needs two clicks within 3 seconds to confirm, so it can’t be triggered by accident.' },
      { tip: 'Your inputs auto-save in this browser’s localStorage — a local database that never leaves your device. No server, no account, no upload. Use the 🗑 Reset button (top-right) to wipe everything and restore defaults.',
        extra: 'Everything you type is only ever stored on this one browser, on this one device.' },
  ] },
];
let _helpTab = HELP_TABS[0].key;

function renderHelpTabs() {
  els.helpTabs.innerHTML = HELP_TABS
    .map(t => `<button type="button" class="help-tab-btn${t.key === _helpTab ? ' active' : ''}" data-tab="${t.key}">${t.icon} ${t.label}</button>`)
    .join('');
  els.helpTabs.querySelectorAll('.help-tab-btn').forEach(b => b.addEventListener('click', () => {
    _helpTab = b.dataset.tab;
    renderHelpTabs();
    renderHelpPanel();
  }));
}

function renderHelpPanel() {
  const tab = HELP_TABS.find(t => t.key === _helpTab) || HELP_TABS[0];
  els.helpPanel.innerHTML = tab.sections.map(s =>
    `<div class="help-section"><div class="help-tip-quote">${s.tip}</div><p class="help-extra">${s.extra}</p></div>`
  ).join('');
  els.helpPanel.scrollTop = 0;
}

function openHelp(tabKey) {
  _helpTab = tabKey && HELP_TABS.some(t => t.key === tabKey) ? tabKey : HELP_TABS[0].key;
  renderHelpTabs();
  renderHelpPanel();
  els.helpOverlay.style.display = 'flex';
}
function closeHelp() { els.helpOverlay.style.display = 'none'; }

/* ── 7. bindRange — syncs a slider + editable box ────────── */
// sliderMax  = the slider's track maximum
// [capMin, capMax] = full allowed range for the typed box
// Uses box._lastValid (on the DOM node) so macro/stepper/import paths all share one revert value.
function bindRange(slider, box, sliderMax, [capMin, capMax]) {
  box._lastValid = parseFloat(box.value) || capMin;

  // Slider moved → update box
  slider.addEventListener('input', () => {
    const v  = parseFloat(slider.value);
    box.value      = v;
    box._lastValid = v;
    recalc();
  });

  // Box typed → sync slider (pin at its max if v exceeds track)
  box.addEventListener('input', () => {
    const v = parseFloat(box.value);
    if (!isNaN(v) && v >= capMin) {
      slider.value   = Math.min(v, sliderMax);
      box._lastValid = Math.min(capMax, Math.max(capMin, v));
      recalc();
    }
  });

  // Box blur → clamp and write clean value back
  box.addEventListener('blur', () => {
    const v = parseFloat(box.value);
    if (isNaN(v) || v < capMin) {
      box.value = box._lastValid;
    } else {
      const clamped  = Math.min(capMax, v);
      box.value      = clamped;
      box._lastValid = clamped;
      slider.value   = Math.min(clamped, sliderMax);
    }
    recalc();
  });
}

/* ── 8. Config restore (applyConfig) + persistence (saveState/
   loadState/resetSavedData) live in store.js ────────────────── */

/* ── 9. Rate stepper ─────────────────────────────────────── */
// Nudges a rate box by `delta`, respects its cap, re-pins the slider.
// configs keyed by box id for cap lookup.
const RATE_CFG = {
  'val-return':     { slider: 'slider-return',     sliderMax: 15, capMin: 0,   capMax: 50  },
  'val-inflation':  { slider: 'slider-inflation',  sliderMax: 10, capMin: 0,   capMax: 50  },
  'val-withdrawal': { slider: 'slider-withdrawal', sliderMax: 10, capMin: 0.5, capMax: 20  },
  'val-savings':    { slider: null,                sliderMax: 0,  capMin: 0,   capMax: 10  },
  'val-ter':        { slider: null,                sliderMax: 0,  capMin: 0,   capMax: 5, step: 0.05 },
  'val-cagr':       { slider: 'slider-cagr',        sliderMax: 25, capMin: 0,   capMax: 100 },
};

function stepRate(boxId, delta) {
  const cfg  = RATE_CFG[boxId];
  if (!cfg) return;
  const box    = $(boxId);
  const slider = cfg.slider ? $(cfg.slider) : null;
  const curr   = parseFloat(box.value) || cfg.capMin;
  const next   = Math.min(cfg.capMax, Math.max(cfg.capMin, parseFloat((curr + delta).toFixed(1))));
  box.value      = next;
  box._lastValid = next;
  if (slider) slider.value = Math.min(next, cfg.sliderMax);
  recalc();
}

/* ── 9b. Life events manager ─────────────────────────────── */
// Parse a €-style string that may be negative (outlays): "-50,000" → -50000.
function parseSignedNum(str) {
  const neg = /^\s*-/.test(String(str));
  const n   = parseNum(str);
  return neg ? -n : n;
}

// Rebuild the events list from state.events. Called on add/remove and restore,
// NOT on every keystroke (editing a field mutates state in place + recalc()).
function renderEvents() {
  els.eventsList.innerHTML = '';
  state.events.forEach((ev, i) => {
    const row = document.createElement('div');
    row.className = 'event-row';
    const age = document.createElement('input');
    age.type = 'text'; age.inputMode = 'numeric'; age.className = 'event-input event-age';
    age.value = ev.age; age.placeholder = 'Age'; age.setAttribute('aria-label', 'Event age');
    const amt = document.createElement('input');
    amt.type = 'text'; amt.inputMode = 'numeric'; amt.className = 'event-input event-amount';
    amt.value = ev.amount; amt.placeholder = '±€'; amt.setAttribute('aria-label', 'Event amount (negative for an outlay)');
    const lbl = document.createElement('input');
    lbl.type = 'text'; lbl.className = 'event-input event-label';
    lbl.value = ev.label || ''; lbl.placeholder = 'Label'; lbl.setAttribute('aria-label', 'Event label');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'event-remove'; del.textContent = '×';
    del.setAttribute('aria-label', 'Remove event');

    age.addEventListener('input', () => { state.events[i].age    = parseNum(age.value);       recalc(); });
    amt.addEventListener('input', () => { state.events[i].amount = parseSignedNum(amt.value);  recalc(); });
    lbl.addEventListener('input', () => { state.events[i].label  = lbl.value;                  recalc(); });
    del.addEventListener('click', () => { state.events.splice(i, 1); renderEvents(); recalc(); });

    row.append(age, amt, lbl, del);
    els.eventsList.appendChild(row);
  });
}

function addEvent() {
  const nextAge = Math.min(94, (state.currentAge || 30) + 5);
  state.events.push({ age: nextAge, amount: 0, label: '' });
  renderEvents();
  recalc();
}

/* ── 10. Wire all inputs ─────────────────────────────────── */
function wireInputs() {

  // € grouped inputs: fire recalc on input, format on blur, strip on focus
  [els.portfolio, els.income, els.spending].forEach(el => {
    el.addEventListener('input', recalc);
    el.addEventListener('focus', () => {
      const n = parseNum(el.value);
      el.value = n > 0 ? n : '';
    });
    el.addEventListener('blur', () => {
      el.value = numFmt.format(parseNum(el.value));
      recalc();
    });
  });

  // Age input
  els.inputAge.addEventListener('input', recalc);
  els.inputAge.addEventListener('blur', () => {
    const v = parseNum(els.inputAge.value);
    els.inputAge.value = Math.max(1, Math.min(100, v || 30));
    recalc();
  });

  // Rate sliders + boxes — hard caps: Return 50%, Inflation 50%, WR 20%
  bindRange(els.sliderReturn, els.valReturn, 15,  [0,   50]);
  bindRange(els.sliderInfl,   els.valInfl,   10,  [0,   50]);
  bindRange(els.sliderWR,     els.valWR,     10,  [0.5, 20]);

  // Savings return (no slider — clamp [0,10] on blur)
  els.valSavings._lastValid = parseFloat(els.valSavings.value) || 0;
  els.valSavings.addEventListener('input', recalc);
  els.valSavings.addEventListener('blur', () => {
    const v = parseFloat(els.valSavings.value);
    const clamped = isNaN(v) ? els.valSavings._lastValid : Math.min(10, Math.max(0, v));
    els.valSavings.value      = clamped;
    els.valSavings._lastValid = clamped;
    recalc();
  });

  // Fund fee / TER (no slider — clamp [0,5] on blur, like savings return)
  els.valTer._lastValid = parseFloat(els.valTer.value) || 0;
  els.valTer.addEventListener('input', recalc);
  els.valTer.addEventListener('blur', () => {
    const v = parseFloat(els.valTer.value);
    const clamped = isNaN(v) ? els.valTer._lastValid : Math.min(5, Math.max(0, v));
    els.valTer.value      = clamped;
    els.valTer._lastValid = clamped;
    recalc();
  });

  // Pension age + amount
  els.inputPensionAge.addEventListener('input', recalc);
  els.inputPensionAge.addEventListener('blur', () => {
    els.inputPensionAge.value = Math.max(1, Math.min(100, parseNum(els.inputPensionAge.value) || 67));
    recalc();
  });
  els.inputPensionAmount.addEventListener('input', recalc);
  els.inputPensionAmount.addEventListener('blur', () => {
    els.inputPensionAmount.value = numFmt.format(Math.max(0, parseNum(els.inputPensionAmount.value)));
    recalc();
  });
  // Box-1 pension pot + yearly contribution
  [els.inputPensionPot, els.inputPensionContrib].forEach(el => {
    el.addEventListener('input', recalc);
    el.addEventListener('blur', () => { el.value = numFmt.format(Math.max(0, parseNum(el.value))); recalc(); });
  });

  // Life events manager
  els.btnAddEvent.addEventListener('click', addEvent);
  renderEvents();

  // Allocation slider
  els.sliderAlloc.addEventListener('input', recalc);

  // Stepper buttons (▲/▼) — step size is per-box (TER nudges by 0.05, rates by 0.5)
  document.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfg  = RATE_CFG[btn.dataset.box];
      const step = (cfg && cfg.step) || 0.5;
      stepRate(btn.dataset.box, parseFloat(btn.dataset.dir) * step);
    });
  });

  // ArrowUp/Down keyboard on each rate box
  [els.valReturn, els.valInfl, els.valWR, els.valSavings, els.valTer, els.valCagr].forEach(box => {
    box.addEventListener('keydown', e => {
      const step = (RATE_CFG[box.id] && RATE_CFG[box.id].step) || 0.5;
      if (e.key === 'ArrowUp')   { e.preventDefault(); stepRate(box.id, +step); }
      if (e.key === 'ArrowDown') { e.preventDefault(); stepRate(box.id, -step); }
    });
  });

  // Macro preset buttons — set both slider and box
  document.querySelectorAll('.macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slider = $(btn.dataset.slider);
      const boxId  = btn.dataset.slider.replace('slider-', 'val-');
      const box    = $(boxId);
      if (slider) slider.value  = btn.dataset.val;
      if (box) {
        box.value      = btn.dataset.val;
        box._lastValid = parseFloat(btn.dataset.val);
      }
      recalc();
    });
  });

  // Mode toggle
  [els.btnReal, els.btnNominal].forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      els.btnReal.classList.toggle('active', state.mode === 'real');
      els.btnNominal.classList.toggle('active', state.mode === 'nominal');
      recalc();
    });
  });

  // Tax toggle
  function applyTaxMode(mode) {
    state.taxMode = mode;
    [els.btnTaxNone, els.btnTaxBox3, els.btnTaxCustom].forEach(b =>
      b.classList.toggle('active-tax', b.dataset.tax === mode)
    );
    els.taxBox3Info.style.display   = mode === 'box3'   ? 'block' : 'none';
    els.taxCustomRow.style.display  = mode === 'custom' ? 'flex'  : 'none';
    updateAllocDim();
    recalc();
  }
  [els.btnTaxNone, els.btnTaxBox3, els.btnTaxCustom].forEach(btn =>
    btn.addEventListener('click', () => applyTaxMode(btn.dataset.tax))
  );

  // Box 3 Single/Couple allowance toggle
  function applyBox3Persons(n) {
    state.box3Persons = n;
    els.btnBox3Single.classList.toggle('active-persons', n === 1);
    els.btnBox3Couple.classList.toggle('active-persons', n === 2);
    recalc();
  }
  [els.btnBox3Single, els.btnBox3Couple].forEach(btn =>
    btn.addEventListener('click', () => applyBox3Persons(Number(btn.dataset.persons)))
  );

  els.valTaxCustom.addEventListener('input', recalc);
  els.valTaxCustom.addEventListener('blur', () => {
    const v = parseFloat(els.valTaxCustom.value);
    els.valTaxCustom.value = isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
    recalc();
  });

  // Withdrawal strategy toggle
  const stratBtns = [els.btnStratFixed, els.btnStratGk, els.btnStratVpw];
  stratBtns.forEach(btn => btn.addEventListener('click', () => {
    state.wdStrategy = btn.dataset.strat;
    stratBtns.forEach(b => b.classList.toggle('active-strat', b.dataset.strat === state.wdStrategy));
    recalc();
  }));

  // Projection mode toggle (Steady / Monte Carlo / History)
  const projBtns = [els.btnProjSteady, els.btnProjMc, els.btnProjHistory];
  projBtns.forEach(btn => btn.addEventListener('click', () => {
    state.projMode = btn.dataset.proj;
    projBtns.forEach(b => b.classList.toggle('active-proj', b.dataset.proj === state.projMode));
    recalc();
  }));

  // Historical vintage select
  populateVintages();
  els.vintageSelect.addEventListener('change', () => {
    state.vintageYear = parseInt(els.vintageSelect.value, 10) || 2008;
    recalc();
  });

  // Growth Model toggle (v2.2 CAGR, v2.5 Perpetual) + block wiring
  const modelBtns = [els.btnModelIncome, els.btnModelCagr, els.btnModelPerp];
  modelBtns.forEach(btn => btn.addEventListener('click', () => {
    state.growthModel = btn.dataset.model;
    modelBtns.forEach(b => b.classList.toggle('active-model', b.dataset.model === state.growthModel));
    applyGrowthModelUI();
    recalc();
  }));
  bindRange(els.sliderCagr, els.valCagr, 25, [0, 100]);
  els.inputTargetAge.addEventListener('input', recalc);
  els.inputTargetAge.addEventListener('blur', () => {
    const v = parseNum(els.inputTargetAge.value);
    els.inputTargetAge.value = Math.max(1, Math.min(100, v || 45));
    recalc();
  });
  els.btnApplyCagr.addEventListener('click', () => {
    const g = els.cagrSolveResult._solved;
    if (g == null) return;
    const rounded = Math.round(g * 10) / 10;
    els.valCagr.value      = rounded;
    els.valCagr._lastValid = rounded;
    els.sliderCagr.value   = Math.min(rounded, 25);
    recalc();
  });
  applyGrowthModelUI();

  // A/B scenario compare
  els.btnCompare.addEventListener('click', toggleCompare);

  // Onboarding wizard
  els.btnWizard.addEventListener('click', openWizard);
  els.wizardSkip.addEventListener('click', closeWizard);
  els.wizardNext.addEventListener('click', wizardNext);
  els.wizardBack.addEventListener('click', wizardBack);
  els.wizardOverlay.addEventListener('click', e => { if (e.target === els.wizardOverlay) closeWizard(); });
  els.wizardBody.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wizardNext(); } });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (els.wizardOverlay.style.display !== 'none') closeWizard();
    if (els.helpOverlay.style.display   !== 'none') closeHelp();
  });

  // Help modal
  els.btnHelp.addEventListener('click', () => openHelp());
  els.helpClose.addEventListener('click', closeHelp);
  els.helpOverlay.addEventListener('click', e => { if (e.target === els.helpOverlay) closeHelp(); });
  document.querySelectorAll('.help-learn-more').forEach(btn =>
    btn.addEventListener('click', () => openHelp(btn.dataset.helpTab))
  );
}

/* ── 11. Export / Import — logic (exportConfig / importConfig /
   showImportError / buildPrintSnapshot / printSnapshot) lives in
   store.js; button wiring below ───── */
function closeExportMenu() {
  els.exportMenu.style.display = 'none';
  els.btnExport.classList.remove('menu-open');
}
els.btnExport.addEventListener('click', e => {
  e.stopPropagation();
  const opening = els.exportMenu.style.display === 'none';
  els.exportMenu.style.display = opening ? 'flex' : 'none';
  els.btnExport.classList.toggle('menu-open', opening);
});
els.exportJson.addEventListener('click', () => { closeExportMenu(); exportConfig(); });
els.exportPdf.addEventListener('click',  () => { closeExportMenu(); printSnapshot(); });
document.addEventListener('click', e => {
  if (els.exportMenu.style.display !== 'none' && !els.exportMenu.contains(e.target) && e.target !== els.btnExport) {
    closeExportMenu();
  }
});
els.btnImport.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => {
  if (e.target.files[0]) importConfig(e.target.files[0]);
  els.fileInput.value = '';
});

// Two-step confirm: 1st click arms; 2nd click within 3 s actually resets.
// Automatically disarms if ignored (no accidental wipes).
let _resetArmed = false, _resetTimer = null;
const _btnReset = document.getElementById('btn-reset');

function _disarmReset() {
  _resetArmed = false;
  clearTimeout(_resetTimer);
  _btnReset.classList.remove('armed');
  _btnReset.textContent = '🗑 Reset';
}

_btnReset.addEventListener('click', () => {
  if (_resetArmed) {
    _disarmReset();
    resetSavedData();
    return;
  }
  _resetArmed = true;
  _btnReset.classList.add('armed');
  _btnReset.textContent = '⚠️ Click again to confirm';
  _resetTimer = setTimeout(_disarmReset, 3000);
});

/* ── 12. Boot ────────────────────────────────────────────── */

// CDN fallback: if Chart.js didn't load, show a graceful message and disable chart writes.
if (typeof Chart === 'undefined') {
  chartReady = false;
  const panel = document.querySelector('.chart-panel');
  if (panel) {
    panel.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 20px;font-size:13px">' +
      '📶 Chart library failed to load (offline or CDN blocked).<br>' +
      'All inputs and KPIs still work — open with a network connection to see the projection chart.</p>';
  }
} else {
  initChart();
}

buildGauge();
wireInputs();

// First-run detection (before restore) → drives the onboarding wizard
const _firstRun = (() => { try { return !localStorage.getItem(LS_KEY); } catch (_) { return false; } })();

// Restore from localStorage (overrides seed values)
loadState();

// Restore A/B compare snapshot if one was saved
try {
  const rawA = localStorage.getItem(LS_SCENARIO_A);
  if (rawA) { scenarioA = JSON.parse(rawA); compareOn = true; setCompareButton(); }
} catch (_) {}

// Format seed € values that weren't overridden by loadState
[els.portfolio, els.income, els.spending, els.inputPensionAmount,
 els.inputPensionPot, els.inputPensionContrib].forEach(el => {
  if (!el.value.includes(',')) el.value = numFmt.format(parseNum(el.value));
});

// Sync macro active states before first recalc
refreshMacroActive();

recalc();

// Pin the Years-to-FIRE figure in the header once its KPI card scrolls out of view
if (typeof IntersectionObserver !== 'undefined') {
  new IntersectionObserver(
    ([entry]) => els.yearsFirePin.classList.toggle('visible', !entry.isIntersecting),
    { threshold: 0 }
  ).observe(els.kpiYearsCard);
}

// Expose globals for integration tests
window._state         = state;
window._LS_KEY        = LS_KEY;
window.resetSavedData = resetSavedData;
window.importConfig   = importConfig;
window._disarmReset   = _disarmReset;
window.openWizard     = openWizard;
window.finishWizard   = finishWizard;
window.toggleCompare  = toggleCompare;
window._chart         = chart;
window.recalc         = recalc;

// First visit → guide the newcomer through setup
if (_firstRun) openWizard();
