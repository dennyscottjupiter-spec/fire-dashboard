/* ============================================================
   FIRE Dashboard — store.js
   State + persistence + config restore + export/import.
   Loaded AFTER ui.js and BEFORE app.js (classic scripts share
   one global scope). These are all definitions: they reference
   app.js globals (els, numFmt, recalc, renderEvents) only at
   call time — the same boot-time forward-reference pattern ui.js
   already uses — so load order stays safe.
   ============================================================ */

'use strict';

/* ── State ────────────────────────────────────────────────── */
const state = {
  portfolio:    50000,
  income:       60000,
  spending:     30000,
  investReturn: 7,        // % — investments (source of truth for the box/slider)
  savingsReturn: 2,       // % — cash/savings bucket
  allocInvest:   80,      // % allocated to investments (0–100); savings = 100 - allocInvest
  returnRate:   7,        // % derived blend — set every recalc(), read by runProjection
  inflation:    2,        // %
  withdrawal:   4,        // %
  mode:         'nominal',
  taxMode:      'none',   // 'none' | 'box3' | 'custom'
  taxCustomPct: 0,        // % for custom tax mode
  currentAge:   30,       // for FIRE-year + Coast FI
  // ── v1.7 lifecycle ──
  terPct:        0.2,     // % fund fee (TER) shaved off the invested return
  pensionAge:    67,      // AOW age — income streams switch on here
  pensionAmount: 0,       // AOW / state income €/yr in today's money (0 = off)
  pensionPot:    0,       // Box-1 workplace pension pot today (grows tax-free, locked)
  pensionContrib:0,       // €/yr gross added to the Box-1 pot
  events:        [],      // [{age, amount, label}] one-off cash flows
  // ── v1.8 risk engine ──
  wdStrategy:   'fixed',  // 'fixed' | 'gk' (Guyton-Klinger) | 'vpw' (% of pot)
  projMode:     'steady', // 'steady' | 'montecarlo' | 'history'
  vintageYear:   2008,    // historical replay start year
};

/* ── localStorage keys + seed defaults ────────────────────── */
const LS_KEY = 'fire-dashboard-state';

// Seed defaults for Reset — mirrors the initial state declaration above.
const DEFAULTS = {
  portfolio: 50000, income: 60000, spending: 30000,
  investReturn: 7, savingsReturn: 2, allocInvest: 80,
  inflation: 2, withdrawal: 4, mode: 'nominal',
  taxMode: 'none', taxCustomPct: 0, currentAge: 30,
  terPct: 0.2, pensionAge: 67, pensionAmount: 0, events: [],
  pensionPot: 0, pensionContrib: 0,
  wdStrategy: 'fixed', projMode: 'steady', vintageYear: 2008,
};

/* ── applyConfig — shared restore logic ──────────────────── */
// Used by both importConfig() and loadState(). cfg keys match exportConfig().
function applyConfig(cfg) {
  if (cfg.portfolio != null) {
    state.portfolio     = cfg.portfolio;
    els.portfolio.value = numFmt.format(cfg.portfolio);
  }
  if (cfg.income != null) {
    state.income     = cfg.income;
    els.income.value = numFmt.format(cfg.income);
  }
  if (cfg.spending != null) {
    state.spending     = cfg.spending;
    els.spending.value = numFmt.format(cfg.spending);
  }
  // investReturn: new configs use investReturn; old configs use returnRate (treat as 100% invested)
  if (cfg.investReturn != null) {
    els.sliderReturn.value    = Math.min(cfg.investReturn, 15);
    els.valReturn.value       = cfg.investReturn;
    els.valReturn._lastValid  = cfg.investReturn;
    state.investReturn        = cfg.investReturn;
  } else if (cfg.returnRate != null) {
    els.sliderReturn.value    = Math.min(cfg.returnRate, 15);
    els.valReturn.value       = cfg.returnRate;
    els.valReturn._lastValid  = cfg.returnRate;
    state.investReturn        = cfg.returnRate;
  }
  if (cfg.savingsReturn != null) {
    els.valSavings.value      = cfg.savingsReturn;
    els.valSavings._lastValid = cfg.savingsReturn;
    state.savingsReturn       = cfg.savingsReturn;
  }
  if (cfg.allocInvest != null) {
    els.sliderAlloc.value = cfg.allocInvest;
    state.allocInvest     = cfg.allocInvest;
  } else if (cfg.returnRate != null) {
    // old config: was fully invested — preserve its projection
    els.sliderAlloc.value = 100;
    state.allocInvest     = 100;
  }
  if (cfg.inflation != null) {
    els.sliderInfl.value = Math.min(cfg.inflation, 10);
    els.valInfl.value    = cfg.inflation;
    els.valInfl._lastValid = cfg.inflation;
    state.inflation      = cfg.inflation;
  }
  if (cfg.withdrawal != null) {
    els.sliderWR.value = Math.min(cfg.withdrawal, 10);
    els.valWR.value    = cfg.withdrawal;
    els.valWR._lastValid = cfg.withdrawal;
    state.withdrawal   = cfg.withdrawal;
  }
  if (cfg.mode === 'real' || cfg.mode === 'nominal') {
    state.mode = cfg.mode;
    els.btnReal.classList.toggle('active', state.mode === 'real');
    els.btnNominal.classList.toggle('active', state.mode === 'nominal');
  }
  if (['none','box3','custom'].includes(cfg.taxMode)) {
    state.taxMode = cfg.taxMode;
    [els.btnTaxNone, els.btnTaxBox3, els.btnTaxCustom].forEach(b =>
      b.classList.toggle('active-tax', b.dataset.tax === cfg.taxMode)
    );
    els.taxBox3Info.style.display  = cfg.taxMode === 'box3'   ? 'block' : 'none';
    els.taxCustomRow.style.display = cfg.taxMode === 'custom' ? 'flex'  : 'none';
  }
  if (cfg.taxCustomPct != null) {
    state.taxCustomPct     = cfg.taxCustomPct;
    els.valTaxCustom.value = cfg.taxCustomPct;
  }
  if (cfg.currentAge != null) {
    state.currentAge   = cfg.currentAge;
    els.inputAge.value = cfg.currentAge;
  }
  // ── v1.7 lifecycle fields ──
  if (cfg.terPct != null) {
    state.terPct           = cfg.terPct;
    els.valTer.value       = cfg.terPct;
    els.valTer._lastValid  = cfg.terPct;
  }
  if (cfg.pensionAge != null) {
    state.pensionAge            = cfg.pensionAge;
    els.inputPensionAge.value   = cfg.pensionAge;
  }
  if (cfg.pensionAmount != null) {
    state.pensionAmount           = cfg.pensionAmount;
    els.inputPensionAmount.value  = numFmt.format(cfg.pensionAmount);
  }
  if (cfg.pensionPot != null) {
    state.pensionPot          = cfg.pensionPot;
    els.inputPensionPot.value = numFmt.format(cfg.pensionPot);
  }
  if (cfg.pensionContrib != null) {
    state.pensionContrib          = cfg.pensionContrib;
    els.inputPensionContrib.value = numFmt.format(cfg.pensionContrib);
  }
  if (Array.isArray(cfg.events)) {
    // Coerce to clean {age, amount, label} records
    state.events = cfg.events.map(e => ({
      age: Number(e.age) || 0, amount: Number(e.amount) || 0, label: String(e.label || '')
    }));
    renderEvents();
  }
  // ── v1.8 risk fields ──
  if (['fixed', 'gk', 'vpw'].includes(cfg.wdStrategy)) {
    state.wdStrategy = cfg.wdStrategy;
    [els.btnStratFixed, els.btnStratGk, els.btnStratVpw].forEach(b =>
      b.classList.toggle('active-strat', b.dataset.strat === cfg.wdStrategy));
  }
  if (['steady', 'montecarlo', 'history'].includes(cfg.projMode)) {
    state.projMode = cfg.projMode;
    [els.btnProjSteady, els.btnProjMc, els.btnProjHistory].forEach(b =>
      b.classList.toggle('active-proj', b.dataset.proj === cfg.projMode));
  }
  if (cfg.vintageYear != null) {
    state.vintageYear      = cfg.vintageYear;
    els.vintageSelect.value = cfg.vintageYear;
  }
}

/* ── localStorage persistence ────────────────────────────── */
function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
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
    }));
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const cfg = JSON.parse(raw);
    applyConfig(cfg);
  } catch (_) {}
}

function resetSavedData() {
  applyConfig(DEFAULTS);
  recalc();                                              // saveState() runs here…
  try { localStorage.removeItem(LS_KEY); } catch (_) {} // …so wipe it last
}

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
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fire-config.json';
  a.click();
  URL.revokeObjectURL(url);
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
