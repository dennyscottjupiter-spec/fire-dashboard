'use strict';
/* ══════════════════════════════════════════════════════════
   ENGINE RISK-ENGINE UNIT TESTS  (synchronous — run immediately)
   Depends on: data.js, engine.js, engine.risk.js, harness.js
   (assert/group/near), AND engine.core.test.js — loaded BEFORE this
   file, since this file reuses its top-level `s1` const.
   ══════════════════════════════════════════════════════════ */

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

/* ── runHistoricalShock — click-to-place crash window (v2.7: 11-yr returns) ─── */
group('runHistoricalShock — click-to-place crash window');
const shockBase    = { ...s1, currentAge: 30, allocInvest: 100 };
const steadyProj   = runProjection(shockBase);
const returns2008  = VINTAGES.find(v => v.year === 2008).returns;
const shocked2008  = runHistoricalShock(shockBase, 2008, 50, returns2008);   // shockAge=50 → t=20, 11-yr window
assert('pre-shock years match steady exactly', near(shocked2008.data[10].portfolio, steadyProj.data[10].portfolio, 0.01), shocked2008.data[10].portfolio, steadyProj.data[10].portfolio);
assert('shock window diverges from steady', Math.abs(shocked2008.data[20].portfolio - steadyProj.data[20].portfolio) > 1, shocked2008.data[20].portfolio, '!= ' + steadyProj.data[20].portfolio);
assert('2008 shock (-37%) lowers the portfolio at the window vs steady', shocked2008.data[20].portfolio < steadyProj.data[20].portfolio, shocked2008.data[20].portfolio, '< ' + steadyProj.data[20].portfolio);
assert('shock still lowers the portfolio partway through the window (year 3 of 11)', shocked2008.data[23].portfolio < steadyProj.data[23].portfolio, shocked2008.data[23].portfolio, '< ' + steadyProj.data[23].portfolio);
assert('the recovery years are included — window end (t=31) beats the crash trough (t=20)', shocked2008.data[31].portfolio > shocked2008.data[20].portfolio, shocked2008.data[31].portfolio, '> ' + shocked2008.data[20].portfolio);

const shockedEmptyReturns = runHistoricalShock(shockBase, 2008, 50, []);
assert('empty returns array produces no shock at all (matches steady throughout)', near(shockedEmptyReturns.data[40].portfolio, steadyProj.data[40].portfolio, 1), shockedEmptyReturns.data[40].portfolio, steadyProj.data[40].portfolio);

const unknownStartShock = runHistoricalShock(shockBase, 9999, 50, returns2008);
assert('unknown startYear falls back to dataset start (still runs full horizon)', unknownStartShock.data.length === steadyProj.data.length, unknownStartShock.data.length, steadyProj.data.length);

group('VINTAGES — every event exposes a full 11-year returns array');
VINTAGES.forEach(v => {
  assert(`${v.year} has an 11-length returns array`, Array.isArray(v.returns) && v.returns.length === 11, v.returns && v.returns.length, 11);
});

/* ── Real mode must honor the toggle inside a sequence, not force nominal ──
   Regression for the reported "History mode drains the pot to €0" bug: a
   sequence used to hard-code useReal=false, so a Real-Terms plan silently
   computed its History/Monte-Carlo chart in nominal terms — disagreeing with
   the (real) steady KPI and, combined with Box 3's fixed nominal allowance,
   depleting far faster than the real-mode numbers implied. */
group('runProjection — sequence honors Real/Nominal toggle (not forced nominal)');
const oneYearSeq = [{ ret: 0.10, infl: 0.05 }];
const realSeqBase = { portfolio: 100000, income: 0, spending: 0, withdrawal: 4, currentAge: 60, longevityAge: 61, returnRate: 6, inflation: 2, mode: 'real', taxMode: 'none', allocInvest: 100, sequence: oneYearSeq };
const nominalSeqBase = { ...realSeqBase, mode: 'nominal' };
const realSeqProj    = runProjection(realSeqBase);
const nominalSeqProj = runProjection(nominalSeqBase);
const expectedRealGrowth = 100000 * (1 + (1.10 / 1.05 - 1));
assert('real mode deflates a sequence year by that year\'s own inflation', near(realSeqProj.data[1].portfolio, expectedRealGrowth, 0.01), realSeqProj.data[1].portfolio, expectedRealGrowth);
assert('nominal mode applies the sequence return raw (no deflation)', near(nominalSeqProj.data[1].portfolio, 110000, 0.01), nominalSeqProj.data[1].portfolio, 110000);
assert('real vs nominal sequence runs diverge (mode is honored, not overridden)', Math.abs(realSeqProj.data[1].portfolio - nominalSeqProj.data[1].portfolio) > 1, realSeqProj.data[1].portfolio, '!= ' + nominalSeqProj.data[1].portfolio);

// End-to-end: a comfortably-sustainable real-mode retiree under Box 3 (2.5% WR
// against a ~3.9% real return — a clear margin, not a razor's edge) should
// agree with the steady KPI that the plan survives, even through a historical
// crash — the chart must not silently deplete just because History replays a
// sequence (that was the reported "portfolio → €0" bug).
const retireeReal = { portfolio: 1000000, income: 0, spending: 25000, withdrawal: 4, currentAge: 65, longevityAge: 95, returnRate: 6, inflation: 2, mode: 'real', taxMode: 'box3', allocInvest: 80, box3Persons: 2 };
const retireeSteady = runProjection(retireeReal);
assert('sanity: sustainable real-mode retiree never depletes in steady mode', retireeSteady.depleteAge === null, retireeSteady.depleteAge, null);
const retiree2008Shock = runHistoricalShock(retireeReal, 2008, retireeReal.currentAge + 3, returns2008);
assert('same retiree still survives a 2008 shock in History mode (KPI/chart agree)', retiree2008Shock.depleteAge === null, retiree2008Shock.depleteAge, null);

group('withdrawal strategies — VPW & Guyton-Klinger');
const vpw = runProjection({ portfolio: 500000, income: 0, spending: 100000, withdrawal: 20, returnRate: 5, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 55, wdStrategy: 'vpw' });
assert('VPW never fully depletes (draws % of pot)', vpw.depleteAge === null, vpw.depleteAge, null);
const gkVint = { portfolio: 1000000, income: 0, spending: 40000, withdrawal: 4, returnRate: 6, inflation: 2, mode: 'nominal', taxMode: 'none', currentAge: 55, allocInvest: 100 };
const gkH = runHistorical({ ...gkVint, wdStrategy: 'gk' },    1966);
const fxH = runHistorical({ ...gkVint, wdStrategy: 'fixed' }, 1966);
assert('GK diverges from fixed under a volatile vintage', gkH.data[20].portfolio !== fxH.data[20].portfolio, true, true);
assert('GK projection stays finite', Number.isFinite(gkH.data[gkH.data.length - 1].portfolio), true, true);
