/* ============================================================
   FIRE Dashboard — app.boot.js
   Controller, part 6/6: wireInputs() + ALL top-level event
   listeners + boot sequence. Loaded LAST, after every other
   js/*.js file — this is the only file allowed to execute
   side effects (attach listeners, call recalc()/initChart()/
   buildGauge(), read/restore localStorage) at top level.
   @map: wireInputs L14 · export/import + reset wiring L238 · boot L268
   ============================================================ */

'use strict';

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

/* ── 11. Export/Import + Reset — button wiring (logic lives in
   store.io.js / app.io.js) ───────────────────────────────── */
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
