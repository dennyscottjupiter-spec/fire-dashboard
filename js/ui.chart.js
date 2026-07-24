/* ============================================================
   FIRE Dashboard — ui.chart.js
   View layer: Chart.js setup + drawing plugins only.
   Pure rendering — reads state + els (declared in app.js), calls
   engine globals (engine.js). No DOM wiring, no persistence here.
   Gauge/milestones live in ui.gauge.js.
   @map: crossoverPlugin L15 · eventMarkerPlugin L64 · shockMarkerPlugin L101 · initChart L143
   ============================================================ */

'use strict';

/* ── Chart.js Setup ────────────────────────────────────────── */
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

    // Label: "🔥 Age N" (falls back to FI if labels absent)
    const label = `🔥 ${ch.data.labels[yr] || 'FI'}`;
    ctx2.font        = 'bold 11px Inter, "Segoe UI", sans-serif';
    ctx2.fillStyle   = '#22d3a0';
    ctx2.textAlign   = pt.x > ch.chartArea.right - 60 ? 'right' : 'left';
    ctx2.textBaseline = 'bottom';
    const labelX = ctx2.textAlign === 'right' ? pt.x - 8 : pt.x + 8;
    ctx2.fillText(label, labelX, pt.y - 8);

    ctx2.restore();
  }
};

// Inline plugin: marks lumpy life events (▲ inflow / ▼ outlay) on the portfolio line.
const eventMarkerPlugin = {
  id: 'eventMarkers',
  afterDatasetsDraw(ch) {
    const events = ch.$events;
    if (!Array.isArray(events) || !events.length) return;
    const meta = ch.getDatasetMeta(0);
    if (!meta) return;
    const ctx2 = ch.ctx;
    ctx2.save();
    for (const ev of events) {
      const pt = meta.data[ev.index];
      if (!pt) continue;
      const inflow = ev.amount >= 0;
      const color  = inflow ? '#22d3a0' : '#f43f5e';
      const r = 5, dir = inflow ? -1 : 1;   // triangle points up for inflow, down for outlay
      ctx2.beginPath();
      ctx2.moveTo(pt.x, pt.y + dir * r);
      ctx2.lineTo(pt.x - r, pt.y + dir * -r * 0.2);
      ctx2.lineTo(pt.x + r, pt.y + dir * -r * 0.2);
      ctx2.closePath();
      ctx2.fillStyle = color;
      ctx2.fill();
      if (ev.label) {
        ctx2.font = '600 10px Inter, "Segoe UI", sans-serif';
        ctx2.fillStyle = color;
        ctx2.textAlign = 'center';
        ctx2.textBaseline = inflow ? 'bottom' : 'top';
        ctx2.fillText(ev.label, pt.x, pt.y + dir * (r + 3));
      }
    }
    ctx2.restore();
  }
};

// Inline plugin (v2.5): draws the click-to-place historical crash window —
// a shaded band + boundary line + label, reading ch.$shock = {index, span, label}
// (index = the data-array position the window starts at, i.e. shockAge − currentAge).
const shockMarkerPlugin = {
  id: 'shockMarker',
  afterDatasetsDraw(ch) {
    const shock = ch.$shock;
    if (!shock || shock.index == null || shock.index < 0) return;
    const meta = ch.getDatasetMeta(0);
    if (!meta) return;
    const p0 = meta.data[shock.index];
    const p1 = meta.data[Math.min(shock.index + shock.span, meta.data.length - 1)];
    if (!p0 || !p1) return;

    const ctx2 = ch.ctx;
    const top  = ch.chartArea.top;
    const bot  = ch.chartArea.bottom;
    ctx2.save();

    // Shaded crash-window band
    ctx2.fillStyle = 'rgba(244,63,94,0.10)';
    ctx2.fillRect(p0.x, top, Math.max(1, p1.x - p0.x), bot - top);

    // Boundary line at the window's start
    ctx2.setLineDash([4, 3]);
    ctx2.strokeStyle = 'rgba(244,63,94,0.55)';
    ctx2.lineWidth   = 1.5;
    ctx2.beginPath();
    ctx2.moveTo(p0.x, top);
    ctx2.lineTo(p0.x, bot);
    ctx2.stroke();

    // Label
    ctx2.setLineDash([]);
    ctx2.font        = 'bold 11px Inter, "Segoe UI", sans-serif';
    ctx2.fillStyle   = '#f43f5e';
    ctx2.textAlign   = p0.x > ch.chartArea.right - 90 ? 'right' : 'left';
    ctx2.textBaseline = 'top';
    const labelX = ctx2.textAlign === 'right' ? p0.x - 8 : p0.x + 8;
    ctx2.fillText(shock.label || 'Crash', labelX, top + 8);

    ctx2.restore();
  }
};

function initChart() {
  const ctx = document.getElementById('fi-chart').getContext('2d');
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
          // Retirement (decumulation) portion of the line turns amber.
          segment: {
            borderColor: seg => {
              const ds = seg.chart.$drawStart;
              return (ds != null && seg.p0DataIndex >= ds) ? '#f5a524' : undefined;
            }
          },
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
        },
        // ── Monte Carlo fan bands (hidden until MC mode) ──
        {
          label: '_band90',                    // hidden from legend (see filter below)
          data: [],
          borderColor: 'rgba(14,165,233,0.30)',
          backgroundColor: 'transparent',
          fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 0,
          borderWidth: 1, hidden: true,
        },
        {
          label: 'Range (10–90%)',
          data: [],
          borderColor: 'rgba(14,165,233,0.30)',
          backgroundColor: 'rgba(14,165,233,0.13)',
          fill: '-1',                          // shade down to the 90th-pctile line
          tension: 0.3, pointRadius: 0, pointHoverRadius: 0,
          borderWidth: 1, hidden: true,
        },
        {
          label: 'Median outcome',
          data: [],
          borderColor: '#0ea5e9',
          backgroundColor: 'transparent',
          fill: false, tension: 0.3, pointRadius: 0, pointHoverRadius: 4,
          borderWidth: 2, hidden: true,
        },
        // ── Scenario A (A/B compare, v2.0), shown only in compare mode ──
        {
          label: 'Scenario A',
          data: [],
          borderColor: '#a78bfa',
          backgroundColor: 'transparent',
          fill: false, tension: 0.35, pointRadius: 0, pointHoverRadius: 4,
          borderWidth: 2, borderDash: [7, 4], hidden: true,
        }
      ]
    },
    plugins: [crossoverPlugin, eventMarkerPlugin, shockMarkerPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 200 },
      interaction: { mode: 'index', intersect: false },
      // v2.5: click the chart in History mode to place the crash window at that age.
      onClick: (evt, _elements, ch) => {
        if (state.projMode !== 'history') return;
        const idx = ch.scales.x.getValueForPixel(evt.x);
        if (idx == null) return;
        const horizon = ch.data.labels.length - 1;
        state.shockAge = state.currentAge + Math.max(1, Math.min(horizon, Math.round(idx)));
        recalc();
      },
      plugins: {
        legend: {
          labels: {
            color: '#8a8a8a',
            boxWidth: 14,
            padding: 16,
            font: { size: 12, family: 'Inter, "Segoe UI", sans-serif' },
            filter: item => !String(item.text).startsWith('_'),  // hide internal band-top series
          }
        },
        tooltip: {
          backgroundColor: '#0d1a26',
          borderColor: '#0ea5e9',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#8a8a8a',
          padding: 11,
          bodyFont: { family: 'Inter, "Segoe UI", sans-serif' },
          titleFont: { family: 'Inter, "Segoe UI", sans-serif' },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${eur.format(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8a8a8a', font: { size: 11, family: 'Inter, "Segoe UI", sans-serif' }, maxTicksLimit: 12 },
          grid:  { color: 'rgba(255,255,255,0.05)' },
        },
        y: {
          ticks: {
            color: '#8a8a8a',
            font: { size: 11, family: 'Inter, "Segoe UI", sans-serif' },
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
