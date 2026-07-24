/* ============================================================
   FIRE Dashboard — store.io.js
   Export / import / PDF snapshot. Loaded AFTER store.js and
   BEFORE app.js. Definitions only — reference app.js globals
   (els, eur, recalc) only at call time, same pattern as store.js.
   @map: exportConfig L14 · buildPrintSnapshot L36 · printSnapshot L58 ·
         showImportError L65 · importConfig L73
   ============================================================ */

'use strict';

/* ── Export / Import ──────────────────────────────────────── */
function exportConfig() {
  const config = {
    portfolio:     state.portfolio,
    income:        state.income,
    spending:      state.spending,
    investReturn:  state.investReturn,
    savingsReturn: state.savingsReturn,
    allocInvest:   state.allocInvest,
    inflation:     state.inflation,
    withdrawal:    state.withdrawal,
    mode:          state.mode,
    taxMode:       state.taxMode,
    taxCustomPct:  state.taxCustomPct,
    box3Persons:   state.box3Persons,
    currentAge:    state.currentAge,
    terPct:        state.terPct,
    pensionAge:    state.pensionAge,
    pensionAmount: state.pensionAmount,
    pensionPot:    state.pensionPot,
    pensionContrib:state.pensionContrib,
    events:        state.events,
    wdStrategy:    state.wdStrategy,
    projMode:      state.projMode,
    vintageYear:   state.vintageYear,
    shockAge:      state.shockAge,
    growthModel:   state.growthModel,
    cagrPct:       state.cagrPct,
    targetFireAge: state.targetFireAge,
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fire-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

// One-page PDF snapshot (v2.3) — print-optimized view + window.print(), no PDF library.
function buildPrintSnapshot() {
  const det = state.growthModel === 'perpetual' ? runPerpetual(state) : runProjection(state);
  els.printDate.textContent    = `Generated ${new Date().toLocaleDateString()}`;
  els.printKpiYears.textContent = els.kpiYears.textContent;
  els.printKpiFi.textContent    = els.kpiFI.textContent;
  els.printKpiSr.textContent    = det.savingsRate > 0 ? det.savingsRate.toFixed(1) + '%' : '0%';
  els.printChartImg.src = (typeof chartReady !== 'undefined' && chartReady) ? chart.toBase64Image() : '';

  const growthLabel = state.growthModel === 'cagr'
    ? `Net Worth CAGR: ${state.cagrPct}%/yr`
    : state.growthModel === 'perpetual'
      ? `Perpetual Capital: ${eur.format(det.fiTarget)} — inflation-protected, forever`
      : `Investment Return: ${state.investReturn}%/yr · Savings Return: ${state.savingsReturn}%/yr`;
  const taxLabel = state.taxMode === 'box3'   ? 'Box 3 (NL wealth tax)'
                  : state.taxMode === 'custom' ? `Custom (${state.taxCustomPct}%/yr on gains)`
                  : 'None';
  els.printAssumptions.innerHTML = [
    growthLabel,
    `Asset Allocation: ${state.allocInvest}% invested / ${100 - state.allocInvest}% savings`,
    `Expected Inflation: ${state.inflation}%/yr`,
    `Safe Withdrawal Rate: ${state.withdrawal}%`,
    `Tax Mode: ${taxLabel}`,
    `Calculation Mode: ${state.mode === 'real' ? 'Real Terms (inflation-adjusted)' : 'Nominal'}`,
  ].map(t => `<li>${t}</li>`).join('');
}

function printSnapshot() {
  buildPrintSnapshot();
  window.print();
}

const MAX_IMPORT_BYTES = 100 * 1024;

function showImportError(msg) {
  const banner = els.notice;
  const prev   = banner.textContent;
  banner.textContent = msg;
  banner.classList.add('visible');
  setTimeout(() => { banner.textContent = prev; recalc(); }, 4000);
}

function importConfig(file) {
  const okType = ['application/json', 'text/json', ''].includes(file.type) || /\.json$/i.test(file.name);
  if (file.size > MAX_IMPORT_BYTES) return showImportError('⚠️ File too large (max 100 KB). Is this a FIRE Dashboard config?');
  if (!okType)                       return showImportError('⚠️ Wrong file type — please upload a .json config exported from this app.');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const cfg = JSON.parse(e.target.result);
      applyConfig(cfg);
      recalc();
    } catch {
      showImportError('⚠️ Failed to parse config file. Please upload a valid FIRE Dashboard JSON.');
    }
  };
  reader.readAsText(file);
}
