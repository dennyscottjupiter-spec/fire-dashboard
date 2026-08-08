'use strict';
/* ══════════════════════════════════════════════════════════
   ENGINE VALIDATION / BACKTEST TESTS  (synchronous — run immediately)
   Smoke, model-validation, financial-data-integrity, and backtest layer
   (v2.9). Depends on: data.js, engine.js, harness.js (assert/group/near).
   Runs headless in Node too (pure math only — no DOM).
   @map: closed-form parity L14 · mode identity L38 · degenerate L54 ·
   fee integrity L64 · spending law L76 · data integrity L88 ·
   backtest CAGR L100 · backtest Trinity L112 · realism gate L133
   ══════════════════════════════════════════════════════════ */

const vBase = {
  portfolio: 50000, income: 60000, spending: 30000,
  investReturn: 7, savingsReturn: 2, allocInvest: 80,
  inflation: 2, withdrawal: 4, mode: 'real',
  taxMode: 'none', taxCustomPct: 0, box3Persons: 2, currentAge: 30,
  terPct: 0.25, pensionAge: 67, pensionAmount: 0, events: [],
  pensionPot: 0, pensionContrib: 0,
  wdStrategy: 'fixed', projMode: 'steady', vintageYear: 2008, shockAge: null,
  growthModel: 'income', cagrPct: 10, targetFireAge: 45,
  returnRate: 0.8 * (7 - 0.25) + 0.2 * 2, longevityAge: 95,
};

/* ── Closed-form parity: P0(1+r)^t + c*((1+r)^t-1)/r ─────────── */
group('Validation — closed-form parity (accumulation phase)');
[1, 5, 10].forEach(t => {
  const s = { ...vBase };
  const proj = runProjection(s);
  const rConst = s.returnRate / 100;
  const infl = s.inflation / 100;
  const r = s.mode === 'real' ? (1 + rConst) / (1 + infl) - 1 : rConst; // engine deflates growth in real mode
  const c = s.income - s.spending;
  const closedForm = s.portfolio * Math.pow(1 + r, t) + c * (Math.pow(1 + r, t) - 1) / r;
  const point = proj.data[t];
  if (point && point.phase === 'grow') {
    assert(`closed form matches engine at t=${t}`, near(closedForm, point.portfolio, 1), point.portfolio.toFixed(2), closedForm.toFixed(2));
  }
});

/* ── Mode identity: real[t] === nominal[t] / (1+i)^t ─────────── */
group('Validation — real ≡ deflated-nominal identity (guards contribution symmetry)');
[5, 19, 40, 65].forEach(t => {
  const pReal = runProjection({ ...vBase, mode: 'real' });
  const pNom  = runProjection({ ...vBase, mode: 'nominal' });
  if (pReal.data[t] && pNom.data[t]) {
    const infl = vBase.inflation / 100;
    const nomDeflated = pNom.data[t].portfolio / Math.pow(1 + infl, t);
    assert(`real[${t}] === nominal[${t}] deflated`, near(pReal.data[t].portfolio, nomDeflated, 1), pReal.data[t].portfolio.toFixed(2), nomDeflated.toFixed(2));
  }
});

/* ── Degenerate: r=0, i=0 ─────────────────────────────────────── */
group('Validation — degenerate zero-rate case (pure arithmetic)');
{
  const s = { ...vBase, investReturn: 0.25, savingsReturn: 0.25, terPct: 0.25, allocInvest: 100, inflation: 0, returnRate: 0 };
  const proj = runProjection(s);
  const c = s.income - s.spending;
  const expected10 = s.portfolio + c * 10;
  assert('r=0,i=0: portfolio at t=10 is P0 + c*10', near(proj.data[10].portfolio, expected10, 1), proj.data[10].portfolio, expected10);
  assert('r=0,i=0: yearsToFI = fiTarget/c', proj.yearsToFI === Math.ceil((proj.fiTarget - s.portfolio) / c), proj.yearsToFI, Math.ceil((proj.fiTarget - s.portfolio) / c));
}

/* ── Fee integrity: higher TER strictly lowers terminal wealth ── */
group('Validation — fee integrity');
{
  const sLowFee = { ...vBase, terPct: 0, returnRate: 0.8 * 7 + 0.2 * 2, longevityAge: 60 };
  const sHiFee  = { ...vBase, terPct: 1, returnRate: 0.8 * 6 + 0.2 * 2, longevityAge: 60 };
  const pLow = runProjection(sLowFee);
  const pHi  = runProjection(sHiFee);
  const last = pLow.data.length - 1;
  assert('1% higher TER strictly lowers terminal wealth', pHi.data[last].portfolio < pLow.data[last].portfolio, pHi.data[last].portfolio.toFixed(0), '< ' + pLow.data[last].portfolio.toFixed(0));
}

/* ── Spending law: dFI/dSpending = 1/wr ──────────────────────── */
group('Validation — spending leverage law');
{
  const wr = vBase.withdrawal / 100;
  const p1 = runProjection({ ...vBase, spending: 30000 });
  const p2 = runProjection({ ...vBase, spending: 31000 });
  const dFI = p2.fiTarget - p1.fiTarget;
  assert('dFI/dSpending === 1/wr exactly', near(dFI, 1000 / wr, 0.01), dFI, 1000 / wr);
  assert('yearsToFI non-decreasing in spending', p2.yearsToFI >= p1.yearsToFI, p2.yearsToFI, '>= ' + p1.yearsToFI);
}

/* ── Data integrity: vendored HIST dataset ───────────────────── */
group('Validation — HIST data integrity');
assert('HIST has 98 rows', HIST.length === 98, HIST.length, 98);
assert('HIST starts 1926', HIST[0].year === 1926, HIST[0].year, 1926);
assert('HIST ends 2023', HIST[HIST.length - 1].year === 2023, HIST[HIST.length - 1].year, 2023);
assert('HIST has no year gaps', HIST.every((row, i) => i === 0 || row.year === HIST[i - 1].year + 1), true, true);
assert('HIST ret/infl are all finite', HIST.every(r => isFinite(r.ret) && isFinite(r.infl)), true, true);
assert('HIST ret/infl in sane bounds (-0.6..0.6)', HIST.every(r => r.ret > -0.6 && r.ret < 0.6 && r.infl > -0.2 && r.infl < 0.3), true, true);

/* ── Backtest: realized CAGR matches published long-run ≈7% ──── */
group('Validation — backtest realized real CAGR');
{
  let cum = 1;
  for (const row of HIST) cum *= (1 + ((1 + row.ret) / (1 + row.infl) - 1));
  const cagr = Math.pow(cum, 1 / HIST.length) - 1;
  assert('realized real CAGR ∈ [6.5%, 7.5%]', cagr >= 0.065 && cagr <= 0.075, (cagr * 100).toFixed(2) + '%', '[6.5%, 7.5%]');
}

/* ── Backtest: Trinity-style rolling 30-yr 4%-rule survival ──── */
group('Validation — backtest Trinity 4%-rule survival');
{
  const windows = [];
  for (let start = 0; start + 30 <= HIST.length; start++) {
    let pot = 1000000, draw = 40000, survived = true;
    for (let i = 0; i < 30; i++) {
      const row = HIST[start + i];
      pot = pot * (1 + row.ret) - draw;
      draw = draw * (1 + row.infl);
      if (pot <= 0) { survived = false; break; }
    }
    windows.push(survived);
  }
  const survivalRate = windows.filter(Boolean).length / windows.length;
  assert('rolling 30-yr 4% draw survival ∈ [90%, 100%]', survivalRate >= 0.9 && survivalRate <= 1.0, (survivalRate * 100).toFixed(1) + '%', '[90%, 100%]');
}

/* ── Realism gate: on defaults, no negative/NaN years, sane terminal ── */
group('Validation — realism gate on app defaults');
{
  const proj = runProjection({ ...vBase });
  assert('no negative portfolio years', proj.data.every(d => d.portfolio >= 0), true, true);
  assert('no NaN/Infinity years', proj.data.every(d => isFinite(d.portfolio)), true, true);
  const terminal = proj.data[proj.data.length - 1].portfolio;
  assert('terminal wealth < 50x starting portfolio', terminal < 50 * Math.max(vBase.portfolio, 1), terminal.toFixed(0), '< ' + (50 * vBase.portfolio));
}
