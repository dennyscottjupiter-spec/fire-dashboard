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
  inputAge:     $('input-age'),
  notice:       $('notice-banner'),
  btnReal:      $('btn-real'),
  btnNominal:   $('btn-nominal'),
  btnExport:    $('btn-export'),
  btnImport:    $('btn-import'),
  fileInput:    $('file-input'),
  // Tax
  btnTaxNone:   $('btn-tax-none'),
  btnTaxBox3:   $('btn-tax-box3'),
  btnTaxCustom: $('btn-tax-custom'),
  taxBox3Info:  $('tax-box3-info'),
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
  // In CAGR mode the typed rate replaces the blend entirely (allocation still
  // drives the Box 3 deemed-return split, so the slider stays live either way).
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
    ? '% net-worth CAGR · mix drives Box 3 only'
    : '% blended return';
  state.inflation    = parseFloat(els.valInfl.value)      || 0;
  state.withdrawal   = parseFloat(els.valWR.value)        || 0;
  state.taxCustomPct = parseFloat(els.valTaxCustom.value) || 0;
  state.pensionAge     = Math.max(1, Math.min(100, parseNum(els.inputPensionAge.value) || 67));
  state.pensionAmount  = Math.max(0, parseNum(els.inputPensionAmount.value));
  state.pensionPot     = Math.max(0, parseNum(els.inputPensionPot.value));
  state.pensionContrib = Math.max(0, parseNum(els.inputPensionContrib.value));

  refreshMacroActive();

  const det = runProjection(state);   // deterministic path drives all KPIs
  const { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge } = det;

  // ── KPI: FI Number
  els.kpiFI.textContent    = isFinite(fiTarget) ? eur.format(fiTarget) : '∞';
  els.kpiFISub.textContent = `Covers ${eur.format(state.spending)}/yr · ${eur.format(state.spending / 12)}/mo`;

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
  const lastIdx     = data.length - 1;
  const feeFreeProj = runProjection({ ...state, returnRate: grossReturn });
  const feeLost     = Math.max(0, feeFreeProj.data[lastIdx].portfolio - data[lastIdx].portfolio);
  els.feeImpactVal.textContent = eur.format(feeLost);

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
  // Implied CAGR is always shown — the bridge between the two models.
  const incomeProj = state.growthModel === 'cagr'
    ? runProjection({ ...state, growthModel: 'income' })
    : det;
  const imp = impliedCagr(incomeProj, state.portfolio);
  els.cagrImplied.textContent = imp === null
    ? ''
    : `💡 Your income & return plan compounds at ≈ ${imp.toFixed(1)}%/yr`;

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
    ds[5].hidden = ds[6].hidden = true;         // scenario-A off in MC view
    els.mcSuccess.style.display   = 'flex';
    els.vintageSelect.style.display = 'none';
    scheduleMonteCarlo();                       // debounced heavy compute
    return;
  }

  // Steady or History: one path in dataset 0, fan bands hidden.
  ds[0].hidden = false;
  ds[2].hidden = ds[3].hidden = ds[4].hidden = true;
  els.mcSuccess.style.display     = 'none';
  els.vintageSelect.style.display = (state.projMode === 'history') ? 'inline-block' : 'none';

  const proj = (state.projMode === 'history') ? runHistorical(state, state.vintageYear) : det;
  const last = proj.data.length - 1;
  chart.$fireYear  = (proj.yearsToFI !== null && proj.yearsToFI <= last) ? proj.yearsToFI : null;
  chart.$drawStart = chart.$fireYear;
  chart.$events    = eventMarkers(last);
  chart.data.labels = proj.data.map(d => `Age ${d.age}`);
  ds[0].data = proj.data.map(d => Math.round(d.portfolio));
  ds[1].data = proj.data.map(d => Math.round(d.fi));

  // Scenario A overlay (A/B compare mode)
  if (compareOn && scenarioA) {
    const projA = runProjection(scenarioA);
    ds[5].data = projA.data.map(d => Math.round(d.portfolio));
    ds[6].data = projA.data.map(d => Math.round(d.fi));
    ds[5].hidden = ds[6].hidden = false;
  } else {
    ds[5].hidden = ds[6].hidden = true;
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

/* ── 6b2. Growth Model UI (v2.2) ──────────────────────────── */
// Shows/hides the CAGR block, dims the Income + Investment Return groups
// (Asset Allocation stays live — it still drives the Box 3 split), and
// disables Monte Carlo / History (they inject a sequence that would
// silently override the typed CAGR).
function applyGrowthModelUI() {
  const isCagr = state.growthModel === 'cagr';
  els.cagrBlock.style.display = isCagr ? 'block' : 'none';
  [els.groupIncome, els.groupReturn, els.groupSavingsLabel].forEach(g =>
    g.classList.toggle('model-dimmed', isCagr));

  [els.btnProjMc, els.btnProjHistory].forEach(b => { b.disabled = isCagr; });
  els.btnProjMc.title      = isCagr ? 'Disabled in Net Worth CAGR mode — it would override your typed rate' : '';
  els.btnProjHistory.title = isCagr ? 'Disabled in Net Worth CAGR mode — it would override your typed rate' : '';
  if (isCagr && state.projMode !== 'steady') {
    state.projMode = 'steady';
    const projBtns = [els.btnProjSteady, els.btnProjMc, els.btnProjHistory];
    projBtns.forEach(b => b.classList.toggle('active-proj', b.dataset.proj === state.projMode));
  }
}

/* ── 6c. A/B scenario compare ────────────────────────────── */
// Deterministic snapshot of the plan (returnRate is already fee-adjusted).
function snapshotState() {
  return JSON.parse(JSON.stringify({
    portfolio: state.portfolio, income: state.income, spending: state.spending,
    investReturn: state.investReturn, savingsReturn: state.savingsReturn, allocInvest: state.allocInvest,
    returnRate: state.returnRate, inflation: state.inflation, withdrawal: state.withdrawal,
    mode: state.mode, taxMode: state.taxMode, taxCustomPct: state.taxCustomPct, currentAge: state.currentAge,
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
  const aYr = fireYearOf(runProjection(scenarioA));
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
    els.taxBox3Info.style.display  = mode === 'box3'   ? 'block' : 'none';
    els.taxCustomRow.style.display = mode === 'custom' ? 'flex'  : 'none';
    recalc();
  }
  [els.btnTaxNone, els.btnTaxBox3, els.btnTaxCustom].forEach(btn =>
    btn.addEventListener('click', () => applyTaxMode(btn.dataset.tax))
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

  // Growth Model toggle (v2.2) + CAGR block wiring
  const modelBtns = [els.btnModelIncome, els.btnModelCagr];
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
    if (e.key === 'Escape' && els.wizardOverlay.style.display !== 'none') closeWizard();
  });
}

/* ── 11. Export / Import — logic (exportConfig / importConfig /
   showImportError) lives in store.js; button wiring below ───── */
els.btnExport.addEventListener('click', exportConfig);
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

// Expose globals for integration tests
window._state         = state;
window._LS_KEY        = LS_KEY;
window.resetSavedData = resetSavedData;
window.importConfig   = importConfig;
window._disarmReset   = _disarmReset;
window.openWizard     = openWizard;
window.finishWizard   = finishWizard;
window.toggleCompare  = toggleCompare;

// First visit → guide the newcomer through setup
if (_firstRun) openWizard();
