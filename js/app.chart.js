/* ============================================================
   FIRE Dashboard — app.chart.js
   Controller, part 2/6: chart renderer (Steady / Monte Carlo /
   History), historical vintages, Growth Model UI (CAGR/Perpetual
   block toggling + Perpetual build-up readout).
   Pure definitions only — no top-level side effects. Depends on
   app.core.js (els, state, recalc) + ui.chart.js (chart, chartReady)
   + engine.js/engine.risk.js — all loaded earlier, called only
   after app.boot.js runs.
   @map: eventMarkers L14 · renderChart L18 · scheduleMonteCarlo L74 ·
         runAndDrawMonteCarlo L79 · populateVintages L97 ·
         applyGrowthModelUI L114 · renderPerpetual L138 · updateAllocDim L156
   ============================================================ */

'use strict';

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
    els.eventSim.style.display    = 'none';
    scheduleMonteCarlo();                       // debounced heavy compute
    return;
  }

  // Steady or History: one path in dataset 0, fan bands hidden.
  ds[0].hidden = false;
  ds[2].hidden = ds[3].hidden = ds[4].hidden = true;
  els.mcSuccess.style.display     = 'none';
  const isHistory = state.projMode === 'history';
  els.eventSim.style.display = isHistory ? 'flex' : 'none';

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
    proj = runHistoricalShock(state, state.vintageYear, shockAge, vintage.returns);
    chart.$shock = { index: shockAge - state.currentAge, span: vintage.returns.length, label: vintage.label };
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

// Fullscreen toggle for the chart panel — native Fullscreen API, no custom
// overlay/z-index/scroll-lock. Escape exits natively; fullscreenchange
// (wired in app.boot.js) flips maintainAspectRatio + resizes the chart.
function toggleChartFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    els.chartPanel.requestFullscreen().catch(() => {});
  }
}
