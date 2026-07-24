'use strict';
/* ══════════════════════════════════════════════════════════
   ENGINE UNIT TESTS  (synchronous — run immediately)
   Depends on: data.js, engine.js, harness.js (assert/group/near).
   ══════════════════════════════════════════════════════════ */

/* ── parseNum ──────────────────────────────────────────────── */
group('parseNum');
assert('parseNum("50,000")',     parseNum('50,000')    === 50000,   parseNum('50,000'),    50000);
assert('parseNum("1,234,567")', parseNum('1,234,567') === 1234567, parseNum('1,234,567'), 1234567);
assert('parseNum("")',          parseNum('')          === 0,       parseNum(''),          0);
assert('parseNum("abc")',       parseNum('abc')       === 0,       parseNum('abc'),       0);
assert('parseNum("100")',       parseNum('100')       === 100,     parseNum('100'),       100);
assert('parseNum("€50,000")',   parseNum('€50,000')   === 50000,   parseNum('€50,000'),   50000);
assert('parseNum("  50 000 ")  — spaces stripped', parseNum('  50 000 ') === 50000, parseNum('  50 000 '), 50000);
assert('parseNum("0")',         parseNum('0')         === 0,       parseNum('0'),         0);
assert('parseNum("007")',       parseNum('007')       === 7,       parseNum('007'),       7);
assert('parseNum("9999999")',   parseNum('9999999')   === 9999999, parseNum('9999999'),   9999999);

/* ── box3Tax (NL 2026) ─────────────────────────────────────── */
group('box3Tax — NL 2026 three-bucket proportional method');
const allInvest  = { savingsRatio: 0, investRatio: 1, debtRatio: 0 };
const allSavings = { savingsRatio: 1, investRatio: 0, debtRatio: 0 };
assert('no tax below allowance (€50k < €59,357)', box3Tax(50000, 0, 0.02, false) === 0, box3Tax(50000, 0, 0.02, false), 0);
assert('no tax exactly at allowance (€59,357)', box3Tax(59357, 0, 0.02, false) === 0, box3Tax(59357, 0, 0.02, false), 0);
// 100% invest, P=100k: deemed=100k×6.0%=6000; taxableShare=(100k-59357)/100k=0.40643; tax=0.36×6000×0.40643
const expected3 = 0.36 * (100000 * 1.0 * 0.060) * ((100000 - 59357) / 100000);
assert('tax above allowance, 100% invest (t=0)', near(box3Tax(100000, 0, 0.02, false, allInvest), expected3, 0.1), box3Tax(100000, 0, 0.02, false, allInvest).toFixed(2), expected3.toFixed(2));
// 100% savings, same P: deemed=100k×1.28%=1280 — much less than invest
const expected3sav = 0.36 * (100000 * 1.0 * 0.0128) * ((100000 - 59357) / 100000);
assert('100% savings pays less tax than 100% invest', near(box3Tax(100000, 0, 0.02, false, allSavings), expected3sav, 0.1), box3Tax(100000, 0, 0.02, false, allSavings).toFixed(2), expected3sav.toFixed(2));
assert('100% savings tax is non-negative', box3Tax(100000, 0, 0.02, false, allSavings) >= 0, box3Tax(100000, 0, 0.02, false, allSavings) >= 0, true);
const box3Real = box3Tax(100000, 5, 0.02, true, allInvest);
const box3Nom  = box3Tax(100000, 5, 0.02, false, allInvest);
assert('real-mode allowance deflates → larger tax than nominal at t=5', box3Real > box3Nom, box3Real.toFixed(4), '> ' + box3Nom.toFixed(4));
assert('real-mode at t=0 equals nominal', near(box3Tax(100000, 0, 0.02, true, allInvest), box3Tax(100000, 0, 0.02, false, allInvest), 0.001), true, true);
assert('box3Tax result is non-negative for P=0', box3Tax(0, 0, 0.02, false) === 0, box3Tax(0, 0, 0.02, false), 0);
// backward-compat: omitting ratios defaults to 100% invest, no debt
assert('omitting ratios defaults to 100% invest', near(box3Tax(100000, 0, 0.02, false), box3Tax(100000, 0, 0.02, false, allInvest), 0.001), true, true);

/* ── box3Tax three-bucket: deductible debts (v2.3) ───────────── */
group('box3Tax — deductible debts bucket');
// P=300k, 20% savings/80% invest, no debt: deemed = 60k×1.28% + 240k×6.0% = 15,168
const mix8020 = { savingsRatio: 0.2, investRatio: 0.8, debtRatio: 0 };
const expectedMix = 0.36 * (60000 * 0.0128 + 240000 * 0.060) * ((300000 - 59357) / 300000);
assert('three-bucket mix matches hand-computed example', near(box3Tax(300000, 0, 0.02, false, mix8020), expectedMix, 0.1), box3Tax(300000, 0, 0.02, false, mix8020).toFixed(2), expectedMix.toFixed(2));
// Same mix, +10% of P as deductible debt: reduces both the deemed return and the taxable net worth
const mixWithDebt = { savingsRatio: 0.2, investRatio: 0.8, debtRatio: 0.1 };
const debtTax = box3Tax(300000, 0, 0.02, false, mixWithDebt);
assert('adding deductible debt lowers the tax vs no debt', debtTax < expectedMix, debtTax.toFixed(2), '< ' + expectedMix.toFixed(2));
// Debt heavy enough to push net worth below the allowance → no tax at all
const heavyDebt = { savingsRatio: 0.2, investRatio: 0.8, debtRatio: 0.9 };
assert('heavy debt can push net worth below the allowance (no tax)', box3Tax(300000, 0, 0.02, false, heavyDebt) === 0, box3Tax(300000, 0, 0.02, false, heavyDebt), 0);

/* ── runProjection — Box 3 split derived from Asset Allocation (v2.5) ──── */
group('runProjection — Box 3 / Asset Allocation coupling');
const box3Base = { portfolio: 300000, income: 60000, spending: 30000, investReturn: 0, savingsReturn: 0,
  allocInvest: 100, returnRate: 0, inflation: 2, withdrawal: 4, mode: 'nominal', currentAge: 30, taxMode: 'box3' };
const projAllInvest  = runProjection({ ...box3Base, allocInvest: 100 });
const projAllSavings = runProjection({ ...box3Base, allocInvest: 0 });
assert('all-savings allocation pays less first-year Box3 tax than all-invest', projAllSavings.firstYearTax < projAllInvest.firstYearTax, projAllSavings.firstYearTax, '< ' + projAllInvest.firstYearTax);
const projNoAlloc = runProjection({ ...box3Base, allocInvest: undefined });
assert('omitting allocInvest defaults to 100% invest (back-compat)', near(projNoAlloc.firstYearTax, projAllInvest.firstYearTax, 0.01), projNoAlloc.firstYearTax, projAllInvest.firstYearTax);
const projMix = runProjection({ ...box3Base, allocInvest: 80 });
assert('Box 3 now keys off allocInvest (80% invest sits between the extremes)',
  projMix.firstYearTax > projAllSavings.firstYearTax && projMix.firstYearTax < projAllInvest.firstYearTax,
  projMix.firstYearTax, `between ${projAllSavings.firstYearTax} and ${projAllInvest.firstYearTax}`);

/* ── customTax ─────────────────────────────────────────────── */
group('customTax');
assert('customTax(1000, 20) = 200',       near(customTax(1000, 20), 200),   customTax(1000, 20),   200);
assert('customTax(1000, 0) = 0',          customTax(1000, 0) === 0,         customTax(1000, 0),    0);
assert('customTax(-500, 20) = 0 (neg gain)', customTax(-500, 20) === 0,     customTax(-500, 20),   0);
assert('customTax(0, 20) = 0',            customTax(0, 20) === 0,           customTax(0, 20),      0);
assert('customTax(500, 100) = 500',       near(customTax(500, 100), 500),   customTax(500, 100),   500);

/* ── runProjection — basic nominal ────────────────────────── */
group('runProjection — nominal, no tax');
const s1 = { portfolio: 50000, income: 60000, spending: 30000, returnRate: 7, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none' };
const r1 = runProjection(s1);
assert('FI target = spending / (wr/100)',  near(r1.fiTarget, 750000),   r1.fiTarget,   750000);
assert('savings = income − spending',      r1.savings === 30000,         r1.savings,    30000);
assert('savingsRate = 50%',               near(r1.savingsRate, 50),     r1.savingsRate, 50);
assert('yearsToFI is finite and > 0',     r1.yearsToFI > 0,            r1.yearsToFI,  '>0');
assert('data length = 66 (age 30→95 lifecycle horizon)', r1.data.length === 66, r1.data.length, 66);
assert('yr-0 portfolio = initial',        r1.data[0].portfolio === 50000, r1.data[0].portfolio, 50000);
assert('yr-0 age = currentAge default 30', r1.data[0].age === 30,        r1.data[0].age, 30);

/* ── runProjection — already FI ──────────────────────────── */
group('runProjection — already FI');
const r2 = runProjection({ ...s1, portfolio: 800000 });
assert('yearsToFI === 0 when already FI',  r2.yearsToFI === 0, r2.yearsToFI, 0);
assert('unattainable is false when already FI', r2.unattainable === false, r2.unattainable, false);

/* ── runProjection — exactly at FI ───────────────────────── */
group('runProjection — portfolio exactly equals FI target');
const rExact = runProjection({ ...s1, portfolio: 750000 });
assert('portfolio===fiTarget → yearsToFI===0', rExact.yearsToFI === 0, rExact.yearsToFI, 0);

/* ── runProjection — unattainable ────────────────────────── */
group('runProjection — unattainable (spending > income)');
const r3 = runProjection({ ...s1, income: 20000 });
assert('unattainable flag is true',  r3.unattainable === true, r3.unattainable, true);
assert('yearsToFI is null',          r3.yearsToFI === null,    r3.yearsToFI,    null);

/* ── runProjection — zero spending ───────────────────────── */
group('runProjection — spending = 0 (FI already)');
const rZeroSpend = runProjection({ ...s1, spending: 0 });
assert('spending=0 → fiTarget=0 → already FI', rZeroSpend.yearsToFI === 0, rZeroSpend.yearsToFI, 0);

/* ── runProjection — withdrawal = 0 ─────────────────────── */
group('runProjection — withdrawal rate = 0 (Infinity FI)');
const rZeroWR = runProjection({ ...s1, withdrawal: 0 });
assert('withdrawal=0 → fiTarget=Infinity', !isFinite(rZeroWR.fiTarget), rZeroWR.fiTarget, Infinity);
assert('withdrawal=0 → yearsToFI=null (never)',  rZeroWR.yearsToFI === null, rZeroWR.yearsToFI, null);

/* ── runProjection — zero income ─────────────────────────── */
group('runProjection — income = 0');
const rZeroIncome = runProjection({ ...s1, income: 0, spending: 0 });
assert('income=0 spending=0 → savingsRate=0', rZeroIncome.savingsRate === 0, rZeroIncome.savingsRate, 0);

/* ── runProjection — Real mode ───────────────────────────── */
// Compared during accumulation (yr-10, pre-FI) where the deflated-contributions
// semantic is clean; post-retirement contributions stop, so the property is age-scoped.
group('runProjection — Real mode vs Nominal (deflated contributions)');
const r4nom = runProjection({ ...s1, mode: 'nominal' });
const r4rl  = runProjection({ ...s1, mode: 'real' });
assert('Real yr-10 portfolio < Nominal yr-10 (deflated contributions)',
  r4rl.data[10].portfolio < r4nom.data[10].portfolio,
  Math.round(r4rl.data[10].portfolio), '< ' + Math.round(r4nom.data[10].portfolio));
assert('Real yr-10 portfolio is finite and positive',
  Number.isFinite(r4rl.data[10].portfolio) && r4rl.data[10].portfolio > 0,
  r4rl.data[10].portfolio.toFixed(0), '>0');

/* ── runProjection — high inflation real mode stays finite ── */
group('runProjection — high inflation real mode stays finite and ≥ 0');
const rHighInfl = runProjection({ ...s1, inflation: 8, returnRate: 5, mode: 'real' });
assert('high-inflation real mode yr-50 is finite', Number.isFinite(rHighInfl.data[50].portfolio), true, true);
assert('high-inflation real mode yr-50 is ≥ 0', rHighInfl.data[50].portfolio >= 0, true, true);

/* ── runProjection — Box-3 tax drag ──────────────────────── */
group('runProjection — Box-3 tax slows growth');
const r5notax = runProjection({ ...s1, taxMode: 'none' });
const r5box3  = runProjection({ ...s1, taxMode: 'box3' });
assert('Box-3 yr-20 portfolio < no-tax yr-20',
  r5box3.data[20].portfolio < r5notax.data[20].portfolio,
  Math.round(r5box3.data[20].portfolio), '< ' + Math.round(r5notax.data[20].portfolio));

/* ── runProjection — Box-3 real mode ─────────────────────── */
group('runProjection — Box-3 in real mode');
const r5box3Real = runProjection({ ...s1, taxMode: 'box3', mode: 'real' });
assert('Box-3 real yr-20 portfolio < no-tax nominal yr-20',
  r5box3Real.data[20].portfolio < r5notax.data[20].portfolio, true, true);
assert('Box-3 real yr-20 is finite and > 0',
  Number.isFinite(r5box3Real.data[20].portfolio) && r5box3Real.data[20].portfolio > 0, true, true);

/* ── runProjection — Custom tax ──────────────────────────── */
group('runProjection — Custom tax');
const r6custom = runProjection({ ...s1, taxMode: 'custom', taxCustomPct: 20 });
assert('Custom-20% yr-20 portfolio < no-tax yr-20',
  r6custom.data[20].portfolio < r5notax.data[20].portfolio,
  Math.round(r6custom.data[20].portfolio), '< ' + Math.round(r5notax.data[20].portfolio));

/* ── runProjection — Custom tax real mode ─────────────────── */
// Compared at yr-10 (pre-FI): both real scenarios are still accumulating, so the
// tax purely subtracts. Post-FI the taxed run retires a year or two later, and the
// retirement-crossover timing can invert a same-year comparison.
group('runProjection — Custom tax in real mode');
const r6customReal = runProjection({ ...s1, taxMode: 'custom', taxCustomPct: 20, mode: 'real' });
assert('Custom-20% real yr-10 < no-tax real yr-10',
  r6customReal.data[10].portfolio < r4rl.data[10].portfolio,
  Math.round(r6customReal.data[10].portfolio), '< ' + Math.round(r4rl.data[10].portfolio));

/* ── Lifecycle — decumulation & depletion ────────────────── */
group('runProjection — lifecycle decumulation & depleteAge');
// Already-FI overspender: 20% WR depletes the pot before the horizon.
const rDeplete = runProjection({ portfolio: 500000, income: 0, spending: 100000,
  returnRate: 3, inflation: 2, withdrawal: 20, mode: 'nominal', taxMode: 'none', currentAge: 50 });
assert('overspending retiree retires at t=0', rDeplete.yearsToFI === 0, rDeplete.yearsToFI, 0);
assert('depleteAge is set when pot runs dry', rDeplete.depleteAge !== null, rDeplete.depleteAge, '!= null');
assert('depleteAge within horizon (≤ 95)', rDeplete.depleteAge <= 95, rDeplete.depleteAge, '≤ 95');
// Sustainable retiree: 2% effective WR never depletes.
const rSustain = runProjection({ portfolio: 2000000, income: 0, spending: 40000,
  returnRate: 7, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', currentAge: 50 });
assert('sustainable retiree never depletes (depleteAge null)', rSustain.depleteAge === null, rSustain.depleteAge, null);
assert('final data point reaches longevity age 95', rSustain.data[rSustain.data.length - 1].age === 95, rSustain.data[rSustain.data.length - 1].age, 95);
assert('retirement year is phase "draw"', rSustain.data[1].phase === 'draw', rSustain.data[1].phase, 'draw');

/* ── Lifecycle — TER fee-drag mechanism ──────────────────── */
// The TER subtraction lives in app.js (returnRate − terPct); here we verify the
// engine responds monotonically: a lower net return yields lower terminal wealth.
group('runProjection — fee drag (lower net return → less wealth)');
const rNoFee  = runProjection({ ...s1, returnRate: 7.0 });
const rWithFee = runProjection({ ...s1, returnRate: 6.8 }); // 0.2% TER shaved off
assert('0.2% fee drag lowers yr-10 portfolio', rWithFee.data[10].portfolio < rNoFee.data[10].portfolio,
  Math.round(rWithFee.data[10].portfolio), '< ' + Math.round(rNoFee.data[10].portfolio));

/* ── Lifecycle — pension/AOW bridge ──────────────────────── */
group('runProjection — pension bridge reduces post-age withdrawals');
const pensBase = { portfolio: 1000000, income: 0, spending: 50000, returnRate: 5,
  inflation: 2, withdrawal: 5, mode: 'nominal', taxMode: 'none', currentAge: 60, pensionAge: 67 };
const rNoPens = runProjection({ ...pensBase, pensionAmount: 0 });
const rPens   = runProjection({ ...pensBase, pensionAmount: 30000 });
assert('pension income lifts terminal wealth',
  rPens.data[rPens.data.length - 1].portfolio > rNoPens.data[rNoPens.data.length - 1].portfolio,
  Math.round(rPens.data[rPens.data.length - 1].portfolio), '> ' + Math.round(rNoPens.data[rNoPens.data.length - 1].portfolio));
assert('no difference before pension age (age 65, t=5)',
  near(rPens.data[5].portfolio, rNoPens.data[5].portfolio, 1),
  Math.round(rPens.data[5].portfolio), Math.round(rNoPens.data[5].portfolio));

/* ── Lifecycle — lumpy life events ───────────────────────── */
group('runProjection — lumpy life events shift the pot');
const evBase  = { ...s1, currentAge: 30 };
const rInherit = runProjection({ ...evBase, events: [{ age: 35, amount: 100000 }] });
const rBaseEv  = runProjection(evBase);
// age 35 = t=5; event lands before growth so it contributes >€100k that year
assert('€100k inheritance at age 35 raises that year by > €100k',
  rInherit.data[5].portfolio - rBaseEv.data[5].portfolio > 100000,
  Math.round(rInherit.data[5].portfolio - rBaseEv.data[5].portfolio), '> 100000');
const rOutlay = runProjection({ ...evBase, events: [{ age: 35, amount: -50000 }] });
assert('−€50k outlay at age 35 lowers that year',
  rOutlay.data[5].portfolio < rBaseEv.data[5].portfolio,
  Math.round(rOutlay.data[5].portfolio), '< ' + Math.round(rBaseEv.data[5].portfolio));

/* ── coastFiTarget ───────────────────────────────────────── */
group('coastFiTarget');
const fi = 750000, realReturn = 0.05;
const coast30 = coastFiTarget(fi, 30, realReturn);
const coast65 = coastFiTarget(fi, 65, realReturn);
assert('Coast FI at age 30 < Full FI',           coast30 < fi,                       coast30.toFixed(0), '< ' + fi);
assert('Coast FI at age 65 === Full FI',          near(coast65, fi, 1),               coast65.toFixed(0), fi);
assert('Coast FI at age 64 slightly < Full FI',   coastFiTarget(fi, 64, realReturn) < fi, '< fi', fi);
assert('Coast FI at age > 65 returns fi',         coastFiTarget(fi, 70, realReturn) === fi, coastFiTarget(fi, 70, realReturn), fi);
assert('Coast FI with realReturn=0 returns fi',   coastFiTarget(fi, 30, 0) === fi,    coastFiTarget(fi, 30, 0), fi);
assert('Coast FI with negativeReturn > fi',       coastFiTarget(fi, 30, -0.01) > fi, coastFiTarget(fi, 30, -0.01).toFixed(0), '> ' + fi);

/* ── Risk engine: RNG, Monte Carlo, historical, strategies (v1.8) ── */
group('data.js — historical dataset');
assert('HIST spans ~a century (≥ 95 years)', HIST.length >= 95, HIST.length, '≥95');
assert('HIST rows have ret + infl numbers', typeof HIST[0].ret === 'number' && typeof HIST[0].infl === 'number', true, true);
assert('1931 is a deep crash year (< −40%)', HIST.find(h => h.year === 1931).ret < -0.4, HIST.find(h => h.year === 1931).ret, '< -0.4');
assert('2008 crash present (< −30%)', HIST.find(h => h.year === 2008).ret < -0.3, HIST.find(h => h.year === 2008).ret, '< -0.3');

group('mulberry32 RNG — deterministic');
assert('same seed → same first draw', mulberry32(42)() === mulberry32(42)(), true, true);
assert('different seeds → different draws', mulberry32(1)() !== mulberry32(2)(), true, true);
(() => { const r = mulberry32(7); let ok = true; for (let i = 0; i < 200; i++) { const x = r(); if (x < 0 || x >= 1) ok = false; } assert('draws stay in [0,1)', ok, true, true); })();

group('runMonteCarlo — reproducible + well-formed');
const mcBase = { ...s1, currentAge: 40 };
const mcA = runMonteCarlo(mcBase, 200, 123);
const mcB = runMonteCarlo(mcBase, 200, 123);
assert('same seed → identical successRate', mcA.successRate === mcB.successRate, mcA.successRate, mcB.successRate);
assert('successRate in [0,1]', mcA.successRate >= 0 && mcA.successRate <= 1, mcA.successRate, '0–1');
assert('bands length = horizon+1 (age 40→95 = 56)', mcA.bands.length === 56, mcA.bands.length, 56);
assert('bands first age = currentAge 40', mcA.bands[0].age === 40, mcA.bands[0].age, 40);
assert('p10 ≤ p50 ≤ p90 at mid-horizon', mcA.bands[20].p10 <= mcA.bands[20].p50 && mcA.bands[20].p50 <= mcA.bands[20].p90, true, true);

group('runMonteCarlo — sensible success rates');
const mcRich  = runMonteCarlo({ portfolio: 3000000, income: 0, spending: 40000, withdrawal: 4, returnRate: 7, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 60, allocInvest: 100 }, 300, 7);
assert('over-funded retiree survives almost always (>0.9)', mcRich.successRate > 0.9, mcRich.successRate, '>0.9');
const mcBroke = runMonteCarlo({ portfolio: 500000, income: 0, spending: 80000, withdrawal: 16, returnRate: 7, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 60, allocInvest: 100 }, 300, 7);
assert('overspending retiree often fails (<0.6)', mcBroke.successRate < 0.6, mcBroke.successRate, '<0.6');

group('runHistorical — replay specific vintages');
const histBase = { ...s1, currentAge: 40 };
const h2008 = runHistorical(histBase, 2008);
assert('replay returns full data path (56)', h2008.data.length === 56, h2008.data.length, 56);
assert('replay differs from flat projection', h2008.data[10].portfolio !== runProjection(histBase).data[10].portfolio, true, true);
const h1929 = runHistorical({ portfolio: 600000, income: 0, spending: 36000, withdrawal: 6, returnRate: 7, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 60, allocInvest: 100 }, 1929);
assert('1929 retirement (thin pot) depletes', h1929.depleteAge !== null, h1929.depleteAge, '!= null');
assert('unknown start year falls back to dataset start (no crash)', runHistorical(histBase, 3000).data.length === 56, runHistorical(histBase, 3000).data.length, 56);

group('withdrawal strategies — VPW & Guyton-Klinger');
const vpw = runProjection({ portfolio: 500000, income: 0, spending: 100000, withdrawal: 20, returnRate: 5, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 55, wdStrategy: 'vpw' });
assert('VPW never fully depletes (draws % of pot)', vpw.depleteAge === null, vpw.depleteAge, null);
const gkVint = { portfolio: 1000000, income: 0, spending: 40000, withdrawal: 4, returnRate: 6, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 55, allocInvest: 100 };
const gkH = runHistorical({ ...gkVint, wdStrategy: 'gk' },    1966);
const fxH = runHistorical({ ...gkVint, wdStrategy: 'fixed' }, 1966);
assert('GK diverges from fixed under a volatile vintage', gkH.data[20].portfolio !== fxH.data[20].portfolio, true, true);
assert('GK projection stays finite', Number.isFinite(gkH.data[gkH.data.length - 1].portfolio), true, true);

/* ── Box-1 pension pot (v1.9 NL tax layering) ────────────── */
group('box1Tax — progressive post-AOW');
assert('box1Tax(0) = 0', box1Tax(0) === 0, box1Tax(0), 0);
assert('box1Tax(20000) = 20000 × 19.07%', near(box1Tax(20000), 20000 * 0.1907, 0.01), box1Tax(20000).toFixed(2), (20000 * 0.1907).toFixed(2));
const b1exp = 38441 * 0.1907 + (50000 - 38441) * 0.37;
assert('box1Tax(50000) uses both brackets', near(box1Tax(50000), b1exp, 0.01), box1Tax(50000).toFixed(2), b1exp.toFixed(2));
assert('box1Tax is progressive (higher income → higher effective rate)',
  box1Tax(60000) / 60000 > box1Tax(20000) / 20000, true, true);

group('runProjection — Box-1 pension pot');
const potBase = { portfolio: 800000, income: 0, spending: 40000, withdrawal: 5, returnRate: 6, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 55, pensionAge: 67, allocInvest: 100 };
const noPot   = runProjection(potBase);
const withPot = runProjection({ ...potBase, pensionPot: 400000 });
assert('pension pot grows before AOW (t=5 > seed)', withPot.data[5].pp > 400000, Math.round(withPot.data[5].pp), '> 400000');
assert('pension pot is 0 after annuitization (t=20)', withPot.data[20].pp === 0, withPot.data[20].pp, 0);
assert('no-pot scenario carries pp = 0', noPot.data[5].pp === 0, noPot.data[5].pp, 0);
assert('taxable pool identical BEFORE AOW (pot is separate)', near(withPot.data[5].portfolio, noPot.data[5].portfolio, 1), Math.round(withPot.data[5].portfolio), Math.round(noPot.data[5].portfolio));
assert('taxable pool HIGHER after AOW (annuity offsets withdrawals)', withPot.data[25].portfolio > noPot.data[25].portfolio, Math.round(withPot.data[25].portfolio), '> ' + Math.round(noPot.data[25].portfolio));

group('runProjection — pension pot is Box-3 free + backward compatible');
// Same pot, with Box 3 on: the pot itself is never hit by wealth tax (only the taxable pool is).
const potBox3 = runProjection({ ...potBase, pensionPot: 400000, taxMode: 'box3' });
assert('pension pot grows the same under Box 3 (untaxed as wealth)', near(potBox3.data[5].pp, withPot.data[5].pp, 1), Math.round(potBox3.data[5].pp), Math.round(withPot.data[5].pp));
// pensionPot=0 & pensionContrib=0 must be byte-identical to omitting them
const compatA = runProjection(s1);
const compatB = runProjection({ ...s1, pensionPot: 0, pensionContrib: 0 });
assert('pensionPot=0 leaves the projection unchanged (backward compat)', compatA.data[30].portfolio === compatB.data[30].portfolio, compatB.data[30].portfolio, compatA.data[30].portfolio);
// contributions build the pot
const contribPot = runProjection({ ...potBase, pensionContrib: 10000 });
assert('pensionContrib builds the pot', contribPot.data[5].pp > 0, Math.round(contribPot.data[5].pp), '> 0');

/* ── Net-Worth CAGR mode (v2.2) ───────────────────────────── */
group('runProjection — CAGR mode regression guard (byte-for-byte income model)');
const cagrRegA = runProjection(s1);
const cagrRegB = runProjection({ ...s1, growthModel: 'income' });
assert('omitting growthModel === explicit "income" (deep-equal data[])',
  JSON.stringify(cagrRegA.data) === JSON.stringify(cagrRegB.data), true, true);

group('runProjection — CAGR mode ignores contributions');
const cagrBase = { portfolio: 100000, income: 60000, spending: 30000, returnRate: 10,
  inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', currentAge: 30, growthModel: 'cagr' };
const cagrHiIncome = runProjection({ ...cagrBase, income: 200000 });
const cagrLoIncome = runProjection({ ...cagrBase, income: 60000 });
assert('CAGR mode: differing income produces identical data[]',
  JSON.stringify(cagrHiIncome.data) === JSON.stringify(cagrLoIncome.data), true, true);

group('runProjection — CAGR closed-form check (no tax, no fee, nominal mode)');
// Nominal mode: growthRate === rConst directly (real mode instead converts the
// typed rate via (1+r)/(1+i)-1, which is exercised separately below).
const cagrClosed = runProjection({ portfolio: 100000, income: 60000, spending: 30000,
  returnRate: 8, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', terPct: 0,
  currentAge: 30, growthModel: 'cagr' });
const expectedT10 = 100000 * Math.pow(1.08, 10);
assert('P(t=10) ≈ P0·(1+g)^10 in nominal mode with no tax/fee',
  near(cagrClosed.data[10].portfolio, expectedT10, 1),
  Math.round(cagrClosed.data[10].portfolio), Math.round(expectedT10));

group('runProjection — CAGR mode still honours lifecycle features');
const cagrLifecycle = runProjection({ portfolio: 800000, income: 0, spending: 40000,
  returnRate: 6, inflation: 2, withdrawal: 5, mode: 'nominal', taxMode: 'none',
  currentAge: 55, pensionAge: 67, pensionAmount: 20000, pensionPot: 100000,
  events: [{ age: 60, amount: 50000 }], growthModel: 'cagr' });
assert('CAGR mode still reaches FI (already funded) → yearsToFI=0', cagrLifecycle.yearsToFI === 0, cagrLifecycle.yearsToFI, 0);
assert('CAGR mode still tracks the Box-1 pension pot', cagrLifecycle.data[5].pp > 0, Math.round(cagrLifecycle.data[5].pp), '> 0');
assert('CAGR mode still runs to the longevity horizon', cagrLifecycle.data[cagrLifecycle.data.length - 1].age === 95, cagrLifecycle.data[cagrLifecycle.data.length - 1].age, 95);

group('runProjection — CAGR unattainable redefinition');
const cagrNeverNom = runProjection({ portfolio: 10000, income: 0, spending: 30000,
  returnRate: 2, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', currentAge: 30, growthModel: 'cagr' });
assert('nominal: r ≤ inflation → unattainable', cagrNeverNom.unattainable === true, cagrNeverNom.unattainable, true);
const cagrNeverReal = runProjection({ portfolio: 10000, income: 0, spending: 30000,
  returnRate: 0, inflation: 2, withdrawal: 4, mode: 'real', taxMode: 'none', currentAge: 30, growthModel: 'cagr' });
assert('real: r ≤ 0 → unattainable', cagrNeverReal.unattainable === true, cagrNeverReal.unattainable, true);
const cagrReaches = runProjection({ portfolio: 10000, income: 0, spending: 30000,
  returnRate: 15, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', currentAge: 30, growthModel: 'cagr' });
assert('nominal: r > inflation and P < FI → attainable', cagrReaches.unattainable === false, cagrReaches.unattainable, false);

group('solveCagrForAge — reverse solver');
const solveBase = { portfolio: 50000, income: 0, spending: 30000, inflation: 2, withdrawal: 4,
  mode: 'nominal', taxMode: 'none', terPct: 0.2, currentAge: 30 };
const solvedG = solveCagrForAge(solveBase, 45);
assert('solveCagrForAge returns a plausible rate (0–100)', solvedG !== null && solvedG > 0 && solvedG <= 100, solvedG, '0–100');
const roundTrip = runProjection({ ...solveBase, growthModel: 'cagr', returnRate: solvedG - solveBase.terPct });
assert('round-trip: solved rate reaches FI at/before targetAge (15 yrs)', roundTrip.yearsToFI !== null && roundTrip.yearsToFI <= 15, roundTrip.yearsToFI, '≤15');
assert('solveCagrForAge(targetAge ≤ currentAge) → null', solveCagrForAge(solveBase, 30) === null, solveCagrForAge(solveBase, 30), null);
assert('solveCagrForAge — impossible target (age 31, huge FI gap) → null',
  solveCagrForAge({ ...solveBase, portfolio: 100, spending: 1000000 }, 31) === null,
  solveCagrForAge({ ...solveBase, portfolio: 100, spending: 1000000 }, 31), null);
const solvedNoTax = solveCagrForAge({ ...solveBase, taxMode: 'none' }, 45);
const solvedBox3  = solveCagrForAge({ ...solveBase, taxMode: 'box3' }, 45);
assert('Box 3 on requires a higher (or equal) solved CAGR than no tax', solvedBox3 >= solvedNoTax, solvedBox3, '>= ' + solvedNoTax);

group('impliedCagr — bridge readout');
const impliedProj = runProjection(s1);
const impliedRate = impliedCagr(impliedProj, s1.portfolio);
assert('impliedCagr recovers a plausible rate for the default income plan', impliedRate !== null && impliedRate > 0 && impliedRate < 50, impliedRate, '0–50');
assert('impliedCagr returns null for portfolio=0', impliedCagr(impliedProj, 0) === null, impliedCagr(impliedProj, 0), null);
// Closed-form sanity: a pure CAGR run's implied rate should recover the typed rate
// (nominal mode, so growthRate === rConst with no real/nominal conversion in the way).
const pureCagrProj = runProjection({ portfolio: 100000, income: 60000, spending: 30000,
  returnRate: 9, inflation: 2, withdrawal: 4, mode: 'nominal', taxMode: 'none', terPct: 0,
  currentAge: 30, growthModel: 'cagr' });
const impliedPure = impliedCagr(pureCagrProj, 100000);
assert('impliedCagr recovers the exact typed rate for a pure CAGR run', near(impliedPure, 9, 0.01), impliedPure.toFixed(2), 9);

/* ── perpetualCapital — layered build-up (v2.5) ──────────────── */
group('perpetualCapital — tax mapping + Fisher equation');
const perpBase = { portfolio: 300000, income: 60000, spending: 30000, returnRate: 7, inflation: 2,
  allocInvest: 80, taxMode: 'none', taxCustomPct: 0, currentAge: 30 };
// none: n = g; r = (1.07/1.02)-1 ≈ 4.902%; capital = 30000 / r
const pcNone = perpetualCapital(perpBase);
const rNoneExpected = (1.07 / 1.02) - 1;
assert('none: n equals g (no tax drag)', near(pcNone.n, 0.07, 1e-9), pcNone.n, 0.07);
assert('none: r matches exact Fisher equation', near(pcNone.r, rNoneExpected, 1e-9), pcNone.r, rNoneExpected);
assert('none: capital = I / r', near(pcNone.capital, 30000 / rNoneExpected, 0.01), pcNone.capital.toFixed(2), (30000 / rNoneExpected).toFixed(2));
assert('none: allowanceBenefit is 0', pcNone.allowanceBenefit === 0, pcNone.allowanceBenefit, 0);
assert('none: unreachable is false', pcNone.unreachable === false, pcNone.unreachable, false);

// box3: blendedDeemed = 0.8*6.0% + 0.2*1.28% = 5.056%; drag = 5.056%*36% = 1.82016%
const pcBox3 = perpetualCapital({ ...perpBase, taxMode: 'box3' });
const blendedDeemed = 0.8 * 0.060 + 0.2 * 0.0128;
const dragExpected  = blendedDeemed * 0.36;
assert('box3: drag matches hand-computed blended deemed × 36%', near(pcBox3.drag, dragExpected, 1e-9), pcBox3.drag, dragExpected);
assert('box3: n = g - drag', near(pcBox3.n, 0.07 - dragExpected, 1e-9), pcBox3.n, 0.07 - dragExpected);
assert('box3: allowanceBenefit = 59357 × drag', near(pcBox3.allowanceBenefit, 59357 * dragExpected, 0.01), pcBox3.allowanceBenefit.toFixed(2), (59357 * dragExpected).toFixed(2));
assert('box3: allowance benefit lowers required capital vs no benefit', pcBox3.capital < (30000 - 0) / pcBox3.r, pcBox3.capital, '< ' + ((30000 - 0) / pcBox3.r));

// custom: n = g × (1 − pct%)
const pcCustom = perpetualCapital({ ...perpBase, taxMode: 'custom', taxCustomPct: 20 });
assert('custom: n = g × (1 − 20%)', near(pcCustom.n, 0.07 * 0.8, 1e-9), pcCustom.n, 0.07 * 0.8);
assert('custom: allowanceBenefit is 0 (income tax, not wealth)', pcCustom.allowanceBenefit === 0, pcCustom.allowanceBenefit, 0);

// unreachable: inflation high enough that r ≤ 0
const pcUnreachable = perpetualCapital({ ...perpBase, taxMode: 'none', returnRate: 2, inflation: 5 });
assert('r ≤ 0 → unreachable + infinite capital', pcUnreachable.unreachable === true && pcUnreachable.capital === Infinity, pcUnreachable, '{unreachable:true, capital:Infinity}');

/* ── perpetualSensitivity — inflation sweep ──────────────────── */
group('perpetualSensitivity — inflation 0–4%');
const sens = perpetualSensitivity(perpBase);
assert('sensitivity returns 5 rows (0–4% inflation)', sens.length === 5, sens.length, 5);
assert('sensitivity is monotonically increasing capital as inflation rises', sens.every((row, i) => i === 0 || row.capital === null || sens[i - 1].capital === null || row.capital > sens[i - 1].capital), true, true);
const sensHighInfl = perpetualSensitivity({ ...perpBase, returnRate: 3 });
assert('sensitivity nulls out capital once r ≤ 0 at high inflation', sensHighInfl.some(row => row.capital === null), true, true);

/* ── runPerpetual — same shape as runProjection, accumulates to P ───── */
group('runPerpetual — accumulation + flat draw phase');
const perpProj = runPerpetual({ ...perpBase, portfolio: 50000, currentAge: 30, longevityAge: 95 });
assert('fiTarget equals perpetualCapital(...).capital', near(perpProj.fiTarget, pcNone.capital, 0.01), perpProj.fiTarget, pcNone.capital);
assert('yearsToFI is a positive integer (starts below target)', perpProj.yearsToFI > 0, perpProj.yearsToFI, '> 0');
assert('portfolio grows monotonically during accumulation', perpProj.data[1].portfolio > perpProj.data[0].portfolio, perpProj.data[1].portfolio, '> ' + perpProj.data[0].portfolio);
const lastRow = perpProj.data[perpProj.data.length - 1];
assert('portfolio stays close to target after reaching it (flat draw phase)', near(lastRow.portfolio, perpProj.fiTarget, perpProj.fiTarget * 0.01), lastRow.portfolio, perpProj.fiTarget);
assert('depleteAge is always null (perpetuity never depletes by construction)', perpProj.depleteAge === null, perpProj.depleteAge, null);

const perpAlreadyFI = runPerpetual({ ...perpBase, portfolio: pcNone.capital * 1.5 });
assert('already above target → yearsToFI = 0', perpAlreadyFI.yearsToFI === 0, perpAlreadyFI.yearsToFI, 0);

const perpUnreachableProj = runPerpetual({ ...perpBase, taxMode: 'none', returnRate: 2, inflation: 5 });
assert('unreachable perpetual sets unattainable = true', perpUnreachableProj.unattainable === true, perpUnreachableProj.unattainable, true);
assert('unreachable perpetual never marks yearsToFI', perpUnreachableProj.yearsToFI === null, perpUnreachableProj.yearsToFI, null);
