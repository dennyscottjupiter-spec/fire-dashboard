/* ============================================================
   FIRE Dashboard — engine.risk.js
   Risk engine: Monte Carlo + historical replay (v1.8/v2.5).
   Pure math. No DOM. Depends on HIST (data.js) + runProjection (engine.js) —
   load order: data.js → engine.js → engine.risk.js.
   @map: mulberry32 L11 · runMonteCarlo L20 · runHistorical L46 · runHistoricalShock L60
   ============================================================ */

'use strict';

// Tiny seedable PRNG (mulberry32) so Monte Carlo runs are reproducible in tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bootstrap Monte Carlo: resample historical years (with replacement) N times,
// run the full lifecycle sim on each, and report the survival rate + fan bands.
// Returns { successRate (0–1), bands:[{age,p10,p50,p90}], runs }.
function runMonteCarlo(s, N, seed) {
  N = N || 1000;
  const rand    = mulberry32(seed || 0x9e3779b9);
  const horizon = Math.max(1, Math.round((s.longevityAge || 95) - (s.currentAge || 30)));
  const H = HIST.length;
  const cols = [];
  for (let t = 0; t <= horizon; t++) cols.push([]);
  const ages = [];
  let successes = 0;

  for (let run = 0; run < N; run++) {
    const sequence = [];
    for (let t = 0; t < horizon; t++) {
      const row = HIST[(rand() * H) | 0];
      sequence.push({ ret: row.ret, infl: row.infl });
    }
    const proj = runProjection({ ...s, sequence });
    if (proj.depleteAge === null) successes++;     // survived to the horizon
    for (let t = 0; t < proj.data.length; t++) {
      cols[t].push(proj.data[t].portfolio);
      if (run === 0) ages.push(proj.data[t].age);
    }
  }

  const bands = cols.map((vals, t) => {
    vals.sort((a, b) => a - b);
    const q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
    return { age: ages[t], p10: q(0.10), p50: q(0.50), p90: q(0.90) };
  });
  return { successRate: successes / N, bands, runs: N };
}

// Historical replay: run the exact return/inflation sequence starting at `startYear`,
// wrapping back to the start of the dataset if the horizon runs past the last year.
function runHistorical(s, startYear) {
  const horizon = Math.max(1, Math.round((s.longevityAge || 95) - (s.currentAge || 30)));
  let idx0 = HIST.findIndex(h => h.year === startYear);
  if (idx0 < 0) idx0 = 0;
  const sequence = [];
  for (let t = 0; t < horizon; t++) {
    const row = HIST[(idx0 + t) % HIST.length];
    sequence.push({ ret: row.ret, infl: row.infl });
  }
  return runProjection({ ...s, sequence });
}

// Interactive History (v2.7): click-to-place crash. Every year uses the
// user's own steady assumptions EXCEPT an 11-year window starting at
// `shockAge`, which replays the vintage's hard-coded `returns` array (exact
// nominal total returns, crash year + 10 following) paired with that year's
// actual HIST inflation — so a crash happens exactly when placed, not "from
// age-now" like runHistorical, and the full dip-AND-recovery arc renders.
function runHistoricalShock(s, startYear, shockAge, returns) {
  const currentAge   = s.currentAge   || 30;
  const longevityAge = s.longevityAge || 95;
  const horizon       = Math.max(1, Math.round(longevityAge - currentAge));
  const rConst    = s.returnRate / 100;
  const inflConst = s.inflation  / 100;
  returns = returns || [];

  let idx0 = HIST.findIndex(h => h.year === startYear);
  if (idx0 < 0) idx0 = 0;

  const shockStart = Math.round(shockAge - currentAge);  // 1-based year the window begins
  const sequence = [];
  for (let t = 1; t <= horizon; t++) {
    if (t >= shockStart && t < shockStart + returns.length) {
      const i = t - shockStart;
      const infl = HIST[(idx0 + i) % HIST.length] ? HIST[(idx0 + i) % HIST.length].infl : inflConst;
      sequence.push({ ret: returns[i], infl });
    } else {
      sequence.push({ ret: rConst, infl: inflConst });
    }
  }
  return runProjection({ ...s, sequence });
}
