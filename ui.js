/* ============================================================
   FIRE Dashboard v1.5 — ui.js
   View layer: Chart.js, Retirement Readiness gauge, Milestones.
   Pure rendering — reads state + els (declared in app.js), calls
   engine globals (engine.js). No DOM wiring, no persistence here.
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

    // Label: "🔥 Yr N"
    const label = `🔥 Yr ${yr}`;
    ctx2.font        = 'bold 11px Inter, "Segoe UI", sans-serif';
    ctx2.fillStyle   = '#22d3a0';
    ctx2.textAlign   = pt.x > ch.chartArea.right - 60 ? 'right' : 'left';
    ctx2.textBaseline = 'bottom';
    const labelX = ctx2.textAlign === 'right' ? pt.x - 8 : pt.x + 8;
    ctx2.fillText(label, labelX, pt.y - 8);

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
            font: { size: 12, family: 'Inter, "Segoe UI", sans-serif' }
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

/* ── Milestone definitions & renderer ─────────────────────── */
const MILESTONES = [
  { key: 'coast',   threshold: (fi, age, rr) => coastFiTarget(fi, age, rr), el: 'ms-coast-val'  },
  { key: '100k',    threshold: ()             => 100000,                     el: 'ms-100k-val'   },
  { key: 'barista', threshold: fi             => fi * 0.50,                  el: 'ms-barista-val'},
  { key: 'lean',    threshold: fi             => fi * 0.70,                  el: 'ms-lean-val'   },
  { key: 'full',    threshold: fi             => fi,                         el: 'ms-full-val'   },
  { key: 'fat',     threshold: fi             => fi * 1.50,                  el: 'ms-fat-val'    },
];

function updateMilestones(portfolio, fiTarget, currentAge, realReturn) {
  MILESTONES.forEach(m => {
    const threshold = m.threshold(fiTarget, currentAge, realReturn);
    const achieved  = portfolio >= threshold;
    const item      = document.querySelector(`[data-milestone="${m.key}"]`);
    const valEl     = document.getElementById(m.el);
    if (!item || !valEl) return;
    item.classList.toggle('achieved', achieved);
    valEl.textContent = isFinite(threshold) ? eur.format(threshold) : '—';
  });
}

/* ── Retirement Readiness gauge ────────────────────────────── */
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

/* ── Build static speedometer dial (runs once at boot) ─────── */
function buildGauge() {
  const svg = document.getElementById('gauge-svg');
  if (!svg) return;
  const ns = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, txt) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  // Point on the semicircle at fraction f∈[0,1], radius r.
  // f=0 → left (20,100)  f=0.5 → top (100,20)  f=1 → right (180,100)
  function pt(r, f) {
    const a = Math.PI * (1 - f);
    return [parseFloat((100 + r * Math.cos(a)).toFixed(2)),
            parseFloat((100 - r * Math.sin(a)).toFixed(2))];
  }

  function arcPath(r, f1, f2) {
    const [x1, y1] = pt(r, f1);
    const [x2, y2] = pt(r, f2);
    return `M${x1} ${y1} A${r} ${r} 0 ${(f2 - f1) > 0.5 ? 1 : 0} 1 ${x2} ${y2}`;
  }

  const needleGroup = document.getElementById('gauge-needle');
  const gaugeArc    = document.getElementById('gauge-arc');
  const oldHub      = svg.querySelector('.gauge-hub');

  // ─ Zone arcs (red / amber / green) ─
  const zones = [
    [0,    0.33, 'rgba(244,63,94,0.28)'],
    [0.33, 0.80, 'rgba(245,165,36,0.28)'],
    [0.80, 1.00, 'rgba(34,211,160,0.28)'],
  ];
  for (const [f1, f2, stroke] of zones) {
    svg.insertBefore(
      el('path', { class: 'gauge-zone', d: arcPath(80, f1, f2), stroke, fill: 'none' }),
      gaugeArc
    );
  }

  // ─ Minor tick marks every 10% ─
  for (let i = 0; i <= 10; i++) {
    const f = i / 10;
    const [x1, y1] = pt(80, f);
    const [x2, y2] = pt(74, f);
    svg.insertBefore(el('line', { class: 'gauge-tick', x1, y1, x2, y2 }), needleGroup);
  }

  // ─ Major ticks at 0 / 25 / 50 / 75 / 100 % ─
  for (const f of [0, 0.25, 0.5, 0.75, 1.0]) {
    const [x1, y1] = pt(80, f);
    const [x2, y2] = pt(67, f);
    svg.insertBefore(el('line', { class: 'gauge-tick gauge-tick-major', x1, y1, x2, y2 }), needleGroup);
  }

  // ─ Numeric labels outside the arc ─
  for (const [f, txt] of [[0, '0'], [0.25, '25'], [0.5, '50'], [0.75, '75'], [1.0, '100']]) {
    const [lx, ly] = pt(94, f);
    const anchor = f < 0.05 ? 'end' : f > 0.95 ? 'start' : 'middle';
    svg.insertBefore(el('text', { class: 'gauge-label', x: lx, y: ly,
                                  'text-anchor': anchor, 'dominant-baseline': 'middle' }, txt), needleGroup);
  }

  // ─ FIRE milestone checkpoint flags ─
  const FLAGS = [
    [0.50, 'var(--success)', 'Barista FI (50%)'],
    [0.70, 'var(--amber)',   'Lean FI (70%)'],
    [1.00, 'var(--success)', 'Full FIRE (100%)'],
  ];
  for (const [f, color, title] of FLAGS) {
    const [ox, oy] = pt(84, f);
    const [ix, iy] = pt(63, f);
    const [dx, dy] = pt(84, f);
    const g = el('g', { class: 'gauge-flag' });
    g.appendChild(el('title', {}, title));
    g.appendChild(el('line', { class: 'gauge-flag-tick', x1: ox, y1: oy, x2: ix, y2: iy,
                                stroke: color, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    g.appendChild(el('circle', { class: 'gauge-flag-dot', cx: dx, cy: dy, r: 3.5, fill: color }));
    svg.insertBefore(g, needleGroup);
  }

  // ─ Replace line needle with tapered polygon ─
  needleGroup.innerHTML = '';
  needleGroup.appendChild(el('polygon', { class: 'gauge-needle-poly', points: '100,27 96.5,100 103.5,100' }));

  // ─ Replace flat hub with chrome hub cap ─
  if (oldHub) oldHub.remove();
  svg.appendChild(el('circle', { class: 'gauge-hub-ring', cx: 100, cy: 100, r: 9 }));
  svg.appendChild(el('circle', { class: 'gauge-hub',      cx: 100, cy: 100, r: 6 }));
}
