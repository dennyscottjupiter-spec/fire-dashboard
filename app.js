/* ============================================================
   FIRE Dashboard v1.2 — app.js
   State → DOM → Chart.js → Milestones → Export/Import
   Pure math lives in engine.js (parseNum, runProjection, etc.)
   ============================================================ */

'use strict';

/* ── 1. State ─────────────────────────────────────────────── */
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
};

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
  // Asset allocation
  valSavings:      $('val-savings'),
  sliderAlloc:     $('slider-alloc'),
  allocInvestPct:  $('alloc-invest-pct'),
  allocSavingsPct: $('alloc-savings-pct'),
  blendedReturn:   $('blended-return'),
  // Gauge
  gaugeArc:    $('gauge-arc'),
  gaugeNeedle: $('gauge-needle'),
  gaugePct:    $('gauge-pct'),
};

/* ── 5. Chart.js Setup ────────────────────────────────────── */
let chart;
let chartReady = false;

// Inline plugin: draws a vertical crossover line + dot + label when FI is reached.
const crossoverPlugin = {
  id: 'fireMarker',
  afterDatasetsDraw(ch) {
    const yr = ch.$fireYear;
    if (yr == null || yr < 1) return;
    const meta = ch.getDatasetMeta(0);
    if (!meta || !meta.data[yr]) return;

    const pt   = meta.data[yr];
    const ctx2 = ch.ctx;
    const top  = ch.chartArea.top;
    const bot  = ch.chartArea.bottom;

    ctx2.save();

    // Vertical dashed line
    ctx2.beginPath();
    ctx2.setLineDash([5, 4]);
    ctx2.strokeStyle = 'rgba(34,211,160,0.55)';
    ctx2.lineWidth   = 1.5;
    ctx2.moveTo(pt.x, top);
    ctx2.lineTo(pt.x, bot);
    ctx2.stroke();

    // Glow dot on portfolio line
    ctx2.setLineDash([]);
    ctx2.beginPath();
    ctx2.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
    ctx2.fillStyle   = 'rgba(34,211,160,0.25)';
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
    ctx2.fillStyle   = '#22d3a0';
    ctx2.fill();

    // Label: "🔥 Yr N"
    const label = `🔥 Yr ${yr}`;
    ctx2.font        = 'bold 11px ui-monospace, SF Mono, monospace';
    ctx2.fillStyle   = '#22d3a0';
    ctx2.textAlign   = pt.x > ch.chartArea.right - 60 ? 'right' : 'left';
    ctx2.textBaseline = 'bottom';
    const labelX = ctx2.textAlign === 'right' ? pt.x - 8 : pt.x + 8;
    ctx2.fillText(label, labelX, pt.y - 8);

    ctx2.restore();
  }
};

function initChart() {
  const ctx = $('fi-chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Portfolio Value',
          data: [],
          borderColor: '#0ea5e9',
          backgroundColor: 'rgba(14,165,233,0.07)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'FI Target',
          data: [],
          borderColor: '#22d3a0',
          borderDash: [6, 4],
          backgroundColor: 'transparent',
          fill: false,
          tension: 0,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 1.5,
        }
      ]
    },
    plugins: [crossoverPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 200 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#8a8a8a',
            boxWidth: 14,
            padding: 16,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#0d1a26',
          borderColor: '#0ea5e9',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#8a8a8a',
          padding: 11,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${eur.format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8a8a8a', font: { size: 11 }, maxTicksLimit: 12 },
          grid:  { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: {
            color: '#8a8a8a',
            font: { size: 11 },
            callback: v => {
              if (v >= 1e6) return '€' + (v / 1e6).toFixed(1) + 'M';
              if (v >= 1e3) return '€' + (v / 1e3).toFixed(0) + 'k';
              return '€' + v;
            }
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        }
      }
    }
  });
  chartReady = true;
}

/* ── 6. Milestone definitions & renderer ─────────────────── */
const MILESTONES = [
  { key: 'coast',  threshold: (fi, age, rr) => coastFiTarget(fi, age, rr), el: 'ms-coast-val'  },
  { key: '100k',   threshold: ()            => 100000,                      el: 'ms-100k-val'   },
  { key: 'barista',threshold: fi            => fi * 0.50,                   el: 'ms-barista-val'},
  { key: 'lean',   threshold: fi            => fi * 0.70,                   el: 'ms-lean-val'   },
  { key: 'full',   threshold: fi            => fi,                          el: 'ms-full-val'   },
  { key: 'fat',    threshold: fi            => fi * 1.50,                   el: 'ms-fat-val'    },
];

function updateMilestones(portfolio, fiTarget, currentAge, realReturn) {
  MILESTONES.forEach(m => {
    const threshold = m.threshold(fiTarget, currentAge, realReturn);
    const achieved  = portfolio >= threshold;
    const item      = document.querySelector(`[data-milestone="${m.key}"]`);
    const valEl     = $(m.el);
    if (!item || !valEl) return;
    item.classList.toggle('achieved', achieved);
    valEl.textContent = isFinite(threshold) ? eur.format(threshold) : '—';
  });
}

/* ── 7. Macro button active state ────────────────────────── */
function refreshMacroActive() {
  document.querySelectorAll('.macro-btn').forEach(btn => {
    // Compare against the value-box (source of truth), not the slider
    const boxId = btn.dataset.slider.replace('slider-', 'val-');
    const box   = $(boxId);
    const val   = parseFloat(btn.dataset.val);
    btn.classList.toggle('active-macro', box && parseFloat(box.value) === val);
  });
}

/* ── 7b. Retirement Readiness gauge ─────────────────────── */
const ARC_LEN = Math.PI * 80; // semicircle r=80 ≈ 251.33

function updateGauge(readiness) {
  const pct = isFinite(readiness) ? readiness * 100 : 0;
  const c   = Math.max(0, Math.min(1, readiness || 0));
  els.gaugeArc.style.strokeDasharray  = ARC_LEN;
  els.gaugeArc.style.strokeDashoffset = ARC_LEN * (1 - c);
  els.gaugeNeedle.style.transform     = `rotate(${c * 180 - 90}deg)`;
  const col = pct < 33 ? 'var(--warn)' : pct < 80 ? 'var(--amber)' : 'var(--success)';
  els.gaugeArc.style.stroke = col;
  els.gaugePct.style.color  = col;
  els.gaugePct.textContent  = Math.round(pct) + '%';
}

/* ── 8. Recalculate + Render ─────────────────────────────── */
function recalc() {
  // € fields via parseNum (handles "50,000" strings)
  state.portfolio  = Math.max(0, parseNum(els.portfolio.value));
  state.income     = Math.max(0, parseNum(els.income.value));
  state.spending   = Math.max(0, parseNum(els.spending.value));
  state.currentAge = Math.max(1, Math.min(100, parseNum(els.inputAge.value) || 30));

  // Rate fields read from the editable value-boxes (source of truth)
  state.returnRate   = parseFloat(els.valReturn.value)    || 0;
  state.inflation    = parseFloat(els.valInfl.value)      || 0;
  state.withdrawal   = parseFloat(els.valWR.value)        || 0;
  state.taxCustomPct = parseFloat(els.valTaxCustom.value) || 0;

  refreshMacroActive();

  const { savings, savingsRate, fiTarget, yearsToFI, unattainable, data } = runProjection(state);

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

  const srLabel      = savingsRate > 0 ? savingsRate.toFixed(1) + '%' : '0%';
  const savingsLabel = savings > 0
    ? `Saving ${eur.format(savings)}/yr`
    : savings < 0
      ? `Deficit ${eur.format(-savings)}/yr`
      : 'No savings';
  els.kpiYearsSub.textContent = `SR: ${srLabel} · ${savingsLabel}`;

  // ── Notice banner
  els.notice.classList.toggle('visible', unattainable);

  // ── Chart
  if (chartReady) {
    chart.$fireYear              = (yearsToFI !== null && yearsToFI <= 50) ? yearsToFI : null;
    chart.data.labels            = data.map(d => `Yr ${d.year}`);
    chart.data.datasets[0].data  = data.map(d => Math.round(d.portfolio));
    chart.data.datasets[1].data  = data.map(d => Math.round(d.fi));
    chart.update();
  }

  // ── Milestones (at t=0, mode-independent)
  const realReturn = (1 + state.returnRate / 100) / (1 + state.inflation / 100) - 1;
  updateMilestones(state.portfolio, fiTarget, state.currentAge, realReturn);

  // Persist every recalc (fire-and-forget, silently fails if storage unavailable)
  saveState();
}

/* ── 9. bindRange — syncs a slider + editable box ────────── */
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

/* ── 10. applyConfig — shared restore logic ──────────────── */
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
  if (cfg.returnRate != null) {
    els.sliderReturn.value = Math.min(cfg.returnRate, 15);
    els.valReturn.value    = cfg.returnRate;
    els.valReturn._lastValid = cfg.returnRate;
    state.returnRate       = cfg.returnRate;
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
}

/* ── 10b. localStorage persistence ───────────────────────── */
const LS_KEY = 'fire-dashboard-state';

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      portfolio:    state.portfolio,
      income:       state.income,
      spending:     state.spending,
      returnRate:   state.returnRate,
      inflation:    state.inflation,
      withdrawal:   state.withdrawal,
      mode:         state.mode,
      taxMode:      state.taxMode,
      taxCustomPct: state.taxCustomPct,
      currentAge:   state.currentAge,
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

/* ── 11. Rate stepper ────────────────────────────────────── */
// Nudges a rate box by `delta`, respects its cap, re-pins the slider.
// configs keyed by box id for cap lookup.
const RATE_CFG = {
  'val-return':     { slider: 'slider-return',     sliderMax: 15, capMin: 0,   capMax: 50  },
  'val-inflation':  { slider: 'slider-inflation',  sliderMax: 10, capMin: 0,   capMax: 50  },
  'val-withdrawal': { slider: 'slider-withdrawal', sliderMax: 10, capMin: 0.5, capMax: 20  },
};

function stepRate(boxId, delta) {
  const cfg  = RATE_CFG[boxId];
  if (!cfg) return;
  const box    = $(boxId);
  const slider = $(cfg.slider);
  const curr   = parseFloat(box.value) || cfg.capMin;
  const next   = Math.min(cfg.capMax, Math.max(cfg.capMin, parseFloat((curr + delta).toFixed(1))));
  box.value      = next;
  box._lastValid = next;
  slider.value   = Math.min(next, cfg.sliderMax);
  recalc();
}

/* ── 12. Wire all inputs ──────────────────────────────────── */
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

  // Stepper buttons (▲/▼)
  document.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      stepRate(btn.dataset.box, parseFloat(btn.dataset.dir) * 0.5)
    );
  });

  // ArrowUp/Down keyboard on each rate box
  [els.valReturn, els.valInfl, els.valWR].forEach(box => {
    box.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); stepRate(box.id, +0.5); }
      if (e.key === 'ArrowDown') { e.preventDefault(); stepRate(box.id, -0.5); }
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
}

/* ── 12. Export / Import ──────────────────────────────────── */
function exportConfig() {
  const config = {
    portfolio:    state.portfolio,
    income:       state.income,
    spending:     state.spending,
    returnRate:   state.returnRate,
    inflation:    state.inflation,
    withdrawal:   state.withdrawal,
    mode:         state.mode,
    taxMode:      state.taxMode,
    taxCustomPct: state.taxCustomPct,
    currentAge:   state.currentAge,
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

els.btnExport.addEventListener('click', exportConfig);
els.btnImport.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => {
  if (e.target.files[0]) importConfig(e.target.files[0]);
  els.fileInput.value = '';
});

/* ── 13. Boot ─────────────────────────────────────────────── */

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

wireInputs();

// Restore from localStorage (overrides seed values)
loadState();

// Format seed € values that weren't overridden by loadState
[els.portfolio, els.income, els.spending].forEach(el => {
  if (!el.value.includes(',')) el.value = numFmt.format(parseNum(el.value));
});

// Sync macro active states before first recalc
refreshMacroActive();

recalc();
