/* ============================================================
   FIRE Dashboard v1.1 — app.js
   State → Math Engine → Chart.js → Milestones → Export/Import
   ============================================================ */

'use strict';

/* ── 1. State ─────────────────────────────────────────────── */
const state = {
  portfolio:  50000,
  income:     60000,
  spending:   30000,
  returnRate: 7,      // %
  inflation:  2,      // %
  withdrawal: 4,      // %
  mode:       'nominal'
};

/* ── 2. Formatters & helpers ──────────────────────────────── */

// €10,000 format (en-IE = English + Euro, comma grouping, € prefix)
const eur = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
});

// Plain comma-grouped number for inputs (no € symbol)
const numFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

// Strip formatting, parse to integer (handles "50,000" → 50000)
function parseNum(str) {
  const n = parseInt(String(str).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

/* ── 3. Math Engine ───────────────────────────────────────── */
function runProjection(s) {
  const r    = s.returnRate / 100;
  const infl = s.inflation  / 100;
  const wr   = s.withdrawal / 100;
  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget    = wr > 0 ? s.spending / wr : Infinity;
  const unattainable = savings <= 0 && s.portfolio < fiTarget;

  const MAX_YEARS = 50;
  const data = [];
  let P  = s.portfolio;
  let FI = fiTarget;
  let yearsToFI = null;

  data.push({ year: 0, portfolio: P, fi: FI });
  if (P >= fiTarget) yearsToFI = 0;

  for (let t = 1; t <= MAX_YEARS; t++) {
    if (s.mode === 'real') {
      const realReturn = (1 + r) / (1 + infl) - 1;
      P = P * (1 + realReturn) + savings;
      // FI stays fixed in real-terms mode
    } else {
      P  = P  * (1 + r) + savings;
      FI = FI * (1 + infl);
    }

    data.push({ year: t, portfolio: P, fi: FI });
    if (yearsToFI === null && P >= FI) yearsToFI = t;
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data };
}

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
  kpiYearsSub:  $('kpi-years-sub'),
  notice:       $('notice-banner'),
  btnReal:      $('btn-real'),
  btnNominal:   $('btn-nominal'),
  btnExport:    $('btn-export'),
  btnImport:    $('btn-import'),
  fileInput:    $('file-input'),
};

/* ── 5. Chart.js Setup ────────────────────────────────────── */
let chart;

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
}

/* ── 6. Milestone definitions & renderer ─────────────────── */
const MILESTONES = [
  { key: '100k',   threshold: _fi => 100000,    el: 'ms-100k-val'   },
  { key: '25pct',  threshold: fi  => fi * 0.25, el: 'ms-25pct-val'  },
  { key: '50pct',  threshold: fi  => fi * 0.50, el: 'ms-50pct-val'  },
  { key: '75pct',  threshold: fi  => fi * 0.75, el: 'ms-75pct-val'  },
  { key: '100pct', threshold: fi  => fi,         el: 'ms-100pct-val' },
];

function updateMilestones(portfolio, fiTarget) {
  MILESTONES.forEach(m => {
    const threshold = m.threshold(fiTarget);
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

/* ── 8. Recalculate + Render ─────────────────────────────── */
function recalc() {
  // € fields via parseNum (handles "50,000" strings)
  state.portfolio  = Math.max(0, parseNum(els.portfolio.value));
  state.income     = Math.max(0, parseNum(els.income.value));
  state.spending   = Math.max(0, parseNum(els.spending.value));

  // Rate fields read from the editable value-boxes (source of truth)
  state.returnRate = parseFloat(els.valReturn.value)  || 0;
  state.inflation  = parseFloat(els.valInfl.value)    || 0;
  state.withdrawal = parseFloat(els.valWR.value)      || 0;

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
  chart.data.labels            = data.map(d => `Yr ${d.year}`);
  chart.data.datasets[0].data  = data.map(d => Math.round(d.portfolio));
  chart.data.datasets[1].data  = data.map(d => Math.round(d.fi));
  chart.update();

  // ── Milestones (at t=0, mode-independent)
  updateMilestones(state.portfolio, fiTarget);
}

/* ── 9. bindRange — syncs a slider + editable box ────────── */
// sliderMax  = the slider's track maximum
// [capMin, capMax] = full allowed range for the typed box
function bindRange(slider, box, sliderMax, [capMin, capMax]) {
  let lastValid = parseFloat(box.value) || capMin;

  // Slider moved → update box
  slider.addEventListener('input', () => {
    const v  = parseFloat(slider.value);
    box.value = v;
    lastValid = v;
    recalc();
  });

  // Box typed → sync slider (pin at its max if v exceeds track)
  box.addEventListener('input', () => {
    const v = parseFloat(box.value);
    if (!isNaN(v) && v >= capMin) {
      slider.value = Math.min(v, sliderMax);
      lastValid    = Math.min(capMax, Math.max(capMin, v));
      recalc();
    }
  });

  // Box blur → clamp and write clean value back
  box.addEventListener('blur', () => {
    const v = parseFloat(box.value);
    if (isNaN(v) || v < capMin) {
      box.value    = lastValid;
    } else {
      const clamped = Math.min(capMax, v);
      box.value     = clamped;
      lastValid     = clamped;
      slider.value  = Math.min(clamped, sliderMax);
    }
    recalc();
  });
}

/* ── 10. Wire all inputs ──────────────────────────────────── */
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

  // Rate sliders + boxes — hard caps: Return 50%, Inflation 50%, WR 20%
  bindRange(els.sliderReturn, els.valReturn, 15,  [0,   50]);
  bindRange(els.sliderInfl,   els.valInfl,   10,  [0,   50]);
  bindRange(els.sliderWR,     els.valWR,     10,  [0.5, 20]);

  // Macro preset buttons — set both slider and box
  document.querySelectorAll('.macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slider = $(btn.dataset.slider);
      const boxId  = btn.dataset.slider.replace('slider-', 'val-');
      const box    = $(boxId);
      if (slider) slider.value = btn.dataset.val;
      if (box)    box.value    = btn.dataset.val;
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
}

/* ── 11. Export / Import ──────────────────────────────────── */
function exportConfig() {
  const config = {
    portfolio:  state.portfolio,
    income:     state.income,
    spending:   state.spending,
    returnRate: state.returnRate,
    inflation:  state.inflation,
    withdrawal: state.withdrawal,
    mode:       state.mode,
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fire-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const cfg = JSON.parse(e.target.result);

      // € fields — write raw, format on display
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

      // Rate fields — populate both slider and box; slider pins at its track max
      if (cfg.returnRate != null) {
        els.sliderReturn.value = Math.min(cfg.returnRate, 15);
        els.valReturn.value    = cfg.returnRate;
        state.returnRate       = cfg.returnRate;
      }
      if (cfg.inflation != null) {
        els.sliderInfl.value = Math.min(cfg.inflation, 10);
        els.valInfl.value    = cfg.inflation;
        state.inflation      = cfg.inflation;
      }
      if (cfg.withdrawal != null) {
        els.sliderWR.value = Math.min(cfg.withdrawal, 10);
        els.valWR.value    = cfg.withdrawal;
        state.withdrawal   = cfg.withdrawal;
      }

      // Mode toggle
      if (cfg.mode === 'real' || cfg.mode === 'nominal') {
        state.mode = cfg.mode;
        els.btnReal.classList.toggle('active', state.mode === 'real');
        els.btnNominal.classList.toggle('active', state.mode === 'nominal');
      }

      recalc();
    } catch {
      const banner = els.notice;
      const prev   = banner.textContent;
      banner.textContent = '⚠️ Failed to parse config file. Please upload a valid FIRE Dashboard JSON.';
      banner.classList.add('visible');
      setTimeout(() => {
        banner.textContent = prev;
        recalc();
      }, 4000);
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

/* ── 12. Boot ─────────────────────────────────────────────── */
initChart();
wireInputs();

// Format seed values in € inputs before first recalc
[els.portfolio, els.income, els.spending].forEach(el => {
  el.value = numFmt.format(parseNum(el.value));
});

// Sync macro active states with initial seed values
refreshMacroActive();

recalc();
