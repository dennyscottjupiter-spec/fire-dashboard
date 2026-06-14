/* ============================================================
   FIRE Dashboard — app.js
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
  mode:       'nominal'  // 'nominal' | 'real'
};

/* ── 2. Currency formatter ────────────────────────────────── */
const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
});

/* ── 3. Math Engine ───────────────────────────────────────── */
function runProjection(s) {
  const r    = s.returnRate / 100;
  const infl = s.inflation  / 100;
  const wr   = s.withdrawal / 100;
  const savings  = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget = wr > 0 ? s.spending / wr : Infinity;

  // Unattainable if no positive savings AND already below FI
  const unattainable = savings <= 0 && s.portfolio < fiTarget;

  // Build year-by-year data
  const MAX_YEARS = 50;
  const data = [];
  let P  = s.portfolio;
  let FI = fiTarget;
  let yearsToFI = null;

  // year 0
  data.push({ year: 0, portfolio: P, fi: FI });
  if (P >= fiTarget) yearsToFI = 0;

  for (let t = 1; t <= MAX_YEARS; t++) {
    if (s.mode === 'real') {
      const realReturn = (1 + r) / (1 + infl) - 1;
      P = P * (1 + realReturn) + savings;
      // FI stays fixed in real mode (today's purchasing power)
    } else {
      // nominal: portfolio grows at raw rate, FI target inflates
      P  = P  * (1 + r) + savings;
      FI = FI * (1 + infl);
    }

    data.push({ year: t, portfolio: P, fi: FI });

    if (yearsToFI === null && P >= FI) {
      yearsToFI = t;
    }
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
  valReturn:    $('val-return'),
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
          borderColor: '#007acc',
          backgroundColor: 'rgba(0,122,204,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
        {
          label: 'FI Target',
          data: [],
          borderColor: '#4ec9b0',
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
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#aaaaaa',
            boxWidth: 16,
            padding: 16,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#252526',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#ffffff',
          bodyColor: '#aaaaaa',
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${eur.format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#aaaaaa', font: { size: 11 }, maxTicksLimit: 12 },
          grid:  { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          ticks: {
            color: '#aaaaaa',
            font: { size: 11 },
            callback: v => {
              if (v >= 1e6) return '€' + (v / 1e6).toFixed(1) + 'M';
              if (v >= 1e3) return '€' + (v / 1e3).toFixed(0) + 'k';
              return '€' + v;
            }
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        }
      }
    }
  });
}

/* ── 6. Milestone definitions & renderer ─────────────────── */
const MILESTONES = [
  { key: '100k',   threshold: _fi => 100000,       el: 'ms-100k-val'   },
  { key: '25pct',  threshold: fi  => fi * 0.25,    el: 'ms-25pct-val'  },
  { key: '50pct',  threshold: fi  => fi * 0.50,    el: 'ms-50pct-val'  },
  { key: '75pct',  threshold: fi  => fi * 0.75,    el: 'ms-75pct-val'  },
  { key: '100pct', threshold: fi  => fi,            el: 'ms-100pct-val' },
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
    const sliderId = btn.dataset.slider;
    const val      = parseFloat(btn.dataset.val);
    const slider   = $(sliderId);
    btn.classList.toggle('active-macro', slider && parseFloat(slider.value) === val);
  });
}

/* ── 8. Recalculate + Render ─────────────────────────────── */
function recalc() {
  // Read inputs into state
  state.portfolio  = Math.max(0, parseFloat(els.portfolio.value)    || 0);
  state.income     = Math.max(0, parseFloat(els.income.value)       || 0);
  state.spending   = Math.max(0, parseFloat(els.spending.value)     || 0);
  state.returnRate = parseFloat(els.sliderReturn.value) || 0;
  state.inflation  = parseFloat(els.sliderInfl.value)  || 0;
  state.withdrawal = parseFloat(els.sliderWR.value)    || 0;

  // Update slider value labels
  els.valReturn.textContent = state.returnRate + '%';
  els.valInfl.textContent   = state.inflation  + '%';
  els.valWR.textContent     = state.withdrawal + '%';

  refreshMacroActive();

  // Run projection
  const { savings, savingsRate, fiTarget, yearsToFI, unattainable, data } = runProjection(state);

  // ── KPI: FI Number
  els.kpiFI.textContent    = isFinite(fiTarget) ? eur.format(fiTarget) : '∞';
  els.kpiFISub.textContent = `Covers ${eur.format(state.spending)}/yr · ${eur.format(state.spending / 12)}/mo`;

  // ── KPI: Years to FIRE
  if (yearsToFI === 0) {
    els.kpiYears.textContent   = 'You\'re FI! 🎉';
    els.kpiYears.className     = 'kpi-value';
  } else if (yearsToFI !== null) {
    els.kpiYears.textContent   = yearsToFI + (yearsToFI === 1 ? ' year' : ' years');
    els.kpiYears.className     = 'kpi-value';
  } else {
    els.kpiYears.textContent   = unattainable ? 'Never ❌' : '>50 yrs';
    els.kpiYears.className     = 'kpi-value' + (unattainable ? ' warn' : '');
  }

  const srLabel = savingsRate > 0 ? savingsRate.toFixed(1) + '%' : '0%';
  const savingsLabel = savings > 0 ? `Saving ${eur.format(savings)}/yr` : savings < 0 ? `Deficit ${eur.format(-savings)}/yr` : 'No savings';
  els.kpiYearsSub.textContent = `SR: ${srLabel} · ${savingsLabel}`;

  // ── Unattainable notice
  els.notice.classList.toggle('visible', unattainable);

  // ── Chart
  const labels     = data.map(d => `Yr ${d.year}`);
  const portValues = data.map(d => Math.round(d.portfolio));
  const fiValues   = data.map(d => Math.round(d.fi));

  chart.data.labels                 = labels;
  chart.data.datasets[0].data      = portValues;
  chart.data.datasets[1].data      = fiValues;
  chart.update();

  // ── Milestones (evaluated at current portfolio, t=0, mode-independent)
  updateMilestones(state.portfolio, fiTarget);
}

/* ── 9. Wire inputs ───────────────────────────────────────── */
function wireInputs() {
  [els.portfolio, els.income, els.spending].forEach(el => {
    el.addEventListener('input', recalc);
  });

  [els.sliderReturn, els.sliderInfl, els.sliderWR].forEach(el => {
    el.addEventListener('input', recalc);
  });

  // Macro buttons
  document.querySelectorAll('.macro-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slider = $(btn.dataset.slider);
      if (slider) {
        slider.value = btn.dataset.val;
        recalc();
      }
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

/* ── 10. Export / Import ──────────────────────────────────── */
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

      // Populate number inputs
      if (cfg.portfolio  != null) { els.portfolio.value  = cfg.portfolio;  state.portfolio  = cfg.portfolio; }
      if (cfg.income     != null) { els.income.value     = cfg.income;     state.income     = cfg.income; }
      if (cfg.spending   != null) { els.spending.value   = cfg.spending;   state.spending   = cfg.spending; }

      // Populate sliders
      if (cfg.returnRate != null) { els.sliderReturn.value = cfg.returnRate; state.returnRate = cfg.returnRate; }
      if (cfg.inflation  != null) { els.sliderInfl.value   = cfg.inflation;  state.inflation  = cfg.inflation; }
      if (cfg.withdrawal != null) { els.sliderWR.value     = cfg.withdrawal; state.withdrawal = cfg.withdrawal; }

      // Mode toggle
      if (cfg.mode === 'real' || cfg.mode === 'nominal') {
        state.mode = cfg.mode;
        els.btnReal.classList.toggle('active', state.mode === 'real');
        els.btnNominal.classList.toggle('active', state.mode === 'nominal');
      }

      recalc();
    } catch {
      const banner = els.notice;
      banner.textContent = '⚠️ Failed to parse config file. Please upload a valid FIRE Dashboard JSON.';
      banner.classList.add('visible');
      setTimeout(() => {
        banner.textContent = '⚠️ With current income and spending, retirement is unattainable. Increase income or reduce spending to generate positive savings.';
        recalc(); // restore banner visibility to correct state
      }, 4000);
    }
  };
  reader.readAsText(file);
}

els.btnExport.addEventListener('click', exportConfig);
els.btnImport.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => {
  if (e.target.files[0]) importConfig(e.target.files[0]);
  els.fileInput.value = ''; // reset so same file can be re-imported
});

/* ── 11. Boot ─────────────────────────────────────────────── */
initChart();
wireInputs();
recalc();
