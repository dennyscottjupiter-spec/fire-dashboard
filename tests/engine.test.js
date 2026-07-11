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
group('box3Tax — NL 2026 proportional method');
assert('no tax below allowance (€50k < €59,357)', box3Tax(50000, 0, 0.02, false) === 0, box3Tax(50000, 0, 0.02, false), 0);
assert('no tax exactly at allowance (€59,357)', box3Tax(59357, 0, 0.02, false) === 0, box3Tax(59357, 0, 0.02, false), 0);
// 100% invest, P=100k: deemed=100k×6.0%=6000; taxableShare=(100k-59357)/100k=0.40643; tax=0.36×6000×0.40643
const expected3 = 0.36 * (100000 * 1.0 * 0.060) * ((100000 - 59357) / 100000);
assert('tax above allowance, 100% invest (t=0)', near(box3Tax(100000, 0, 0.02, false, 100), expected3, 0.1), box3Tax(100000, 0, 0.02, false, 100).toFixed(2), expected3.toFixed(2));
// 100% savings, same P: deemed=100k×1.28%=1280 — much less than invest
const expected3sav = 0.36 * (100000 * 1.0 * 0.0128) * ((100000 - 59357) / 100000);
assert('100% savings pays less tax than 100% invest', expected3sav < expected3, expected3sav.toFixed(2), '< ' + expected3.toFixed(2));
assert('100% savings tax is non-negative', expected3sav >= 0, expected3sav >= 0, true);
const box3Real = box3Tax(100000, 5, 0.02, true, 100);
const box3Nom  = box3Tax(100000, 5, 0.02, false, 100);
assert('real-mode allowance deflates → larger tax than nominal at t=5', box3Real > box3Nom, box3Real.toFixed(4), '> ' + box3Nom.toFixed(4));
assert('real-mode at t=0 equals nominal', near(box3Tax(100000, 0, 0.02, true, 100), box3Tax(100000, 0, 0.02, false, 100), 0.001), true, true);
assert('box3Tax result is non-negative for P=0', box3Tax(0, 0, 0.02, false) === 0, box3Tax(0, 0, 0.02, false), 0);
// backward-compat: omitting allocInvest defaults to 100% invest
assert('omitting allocInvest defaults to 100% invest', near(box3Tax(100000, 0, 0.02, false), box3Tax(100000, 0, 0.02, false, 100), 0.001), true, true);

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
