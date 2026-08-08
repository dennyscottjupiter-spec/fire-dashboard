/* ============================================================
   FIRE Dashboard — app.core.js
   Controller, part 1/6: formatters, DOM refs (els), A/B compare
   state vars, macro-button active state, recalc() (the one
   heartbeat), bindRange, rate stepper.
   Pure definitions only — no top-level side effects. Wiring +
   boot live in app.boot.js (loaded LAST after all app.*.js).
   State + persistence live in store.js/store.io.js. View widgets
   (chart, gauge, milestones) live in ui.chart.js/ui.gauge.js.
   @map: eur/numFmt L13 · els L25 · refreshMacroActive L167 ·
         recalc L178 · bindRange L347 · RATE_CFG/stepRate L389
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
  sliderSpending:      $('slider-spending'),
  chartPanel:   $('chart-panel'),
  btnChartFull: $('btn-chart-full'),
  spendingImpactTarget:$('spending-impact-target'),
  spendingImpactMult:  $('spending-impact-mult'),
  spendingImpactDelta: $('spending-impact-delta'),
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
  eventSim:       $('event-sim'),
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
  // v2.8 about modal
  btnAbout:       $('btn-about'),
  aboutOverlay:   $('about-overlay'),
  aboutClose:     $('about-close'),
  aboutVersion:   $('about-version'),
  aboutFeatures:  $('about-features'),
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

  // ── Spending impact readout: the withdrawal-rate leverage on the FI target
  const wr = state.withdrawal / 100;
  if (wr > 0 && isFinite(fiTarget)) {
    const mult  = 1 / wr;
    const delta = 1200 / wr;
    els.spendingImpactTarget.textContent = eur.format(fiTarget);
    els.spendingImpactMult.textContent   = mult.toFixed(0) + '×';
    els.spendingImpactDelta.textContent  = eur.format(delta);
  }
  els.sliderSpending.value = Math.min(state.spending, els.sliderSpending.max);

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
  const step   = cfg.step || 0.5;
  const dec    = step < 0.1 ? 2 : 1;
  const next   = Math.min(cfg.capMax, Math.max(cfg.capMin, parseFloat((curr + delta).toFixed(dec))));
  box.value      = next;
  box._lastValid = next;
  if (slider) slider.value = Math.min(next, cfg.sliderMax);
  recalc();
}
