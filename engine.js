/* ============================================================
   FIRE Dashboard — engine.js
   Pure math. No DOM, no Chart. Safe to unit-test.
   ============================================================ */

'use strict';

/* ── Formatters & helpers ─────────────────────────────────── */

function parseNum(str) {
  const n = parseInt(String(str).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

/* ── Box-3 wealth-tax constants (NL 2026) ─────────────────── */
const BOX3 = {
  allowance:     59357,  // heffingvrij vermogen 2026, single filer (€)
  deemedInvest:  0.060,  // fictitious return on investments (provisional 2026)
  deemedSavings: 0.0128, // fictitious return on savings (2026)
  taxRate:       0.36,   // flat 36% on the total deemed return
};

// Annual Box-3 tax on portfolio P using the NL 2026 proportional method.
// allocInvest (0–100): % of P held in investments; remainder is savings.
// In real mode, allowance is deflated so it stays comparable to a real-terms P.
// Proportional method: deemed return × (taxable fraction of P).
//
//   Example — P=€300k, 80% invest, single:
//     deemed = 240k×6.0% + 60k×1.28% = 15,168
//     taxable share = (300k − 59,357) / 300k = 0.8021
//     tax = 0.36 × 15,168 × 0.8021 ≈ €4,380
function box3Tax(P, t, infl, isReal, allocInvest) {
  const allowance = isReal
    ? BOX3.allowance / Math.pow(1 + infl, t)
    : BOX3.allowance;
  if (P <= allowance) return 0;
  const a = (allocInvest == null ? 100 : allocInvest) / 100;
  const deemed = P * a * BOX3.deemedInvest + P * (1 - a) * BOX3.deemedSavings;
  const taxableShare = (P - allowance) / P;
  return BOX3.taxRate * deemed * taxableShare;
}

// Capital-gains tax: pct% of that year's investment gain only.
function customTax(gain, pct) {
  return (pct / 100) * Math.max(0, gain);
}

/* ── Projection engine (two-phase lifecycle) ──────────────── */
// Accumulates until the portfolio reaches the FI target, then RETIRES:
// income stops, spending is withdrawn each year, and the pot is drawn down
// until the longevity horizon (default age 95). Age-triggered pension/AOW
// income and lumpy life-event cash flows are layered in during both phases.
//
// New optional state fields (all default-guarded for backward compatibility):
//   currentAge    – age today (default 30); horizon runs to longevityAge
//   longevityAge  – end of the plan (default 95)
//   pensionAge    – age an income stream switches on (default 67)
//   pensionAmount – €/yr that stream pays in today's money (default 0 = off)
//   events        – [{age, amount}] one-off cash flows (+inheritance / −outlay)
//
// Returns depleteAge: the age the pot first hits €0 in retirement (else null).
//
// v1.8 extensions (default-guarded, deterministic path unchanged):
//   s.sequence   – [{ret, infl}] per-year rates for Monte Carlo / historical replay.
//                  When present the sim runs in NOMINAL terms (real toggle ignored).
//   s.wdStrategy – 'fixed' (default) | 'vpw' (% of current pot) | 'gk' (Guyton-Klinger
//                  guardrails: skip the inflation raise after a loss year; cut/raise
//                  spending 10% when the current rate drifts ±20% off the initial rate).
function runProjection(s) {
  const rConst    = s.returnRate / 100;
  const inflConst = s.inflation  / 100;
  const wr        = s.withdrawal / 100;

  const currentAge   = s.currentAge   || 30;
  const longevityAge = s.longevityAge || 95;
  const pensionAge   = s.pensionAge   || 67;
  const pensionAmt   = s.pensionAmount || 0;
  const events       = Array.isArray(s.events) ? s.events : [];
  const seq          = Array.isArray(s.sequence) ? s.sequence : null;
  const strat        = s.wdStrategy || 'fixed';

  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget    = wr > 0 ? s.spending / wr : Infinity;
  const unattainable = savings <= 0 && s.portfolio < fiTarget;

  const MAX_YEARS = Math.max(1, Math.round(longevityAge - currentAge));
  const useReal   = (s.mode === 'real') && !seq;  // sequences always run nominal

  // Net one-off cash flow scheduled for a given age (nominal / today's € as entered).
  function eventAt(age) {
    let sum = 0;
    for (const e of events) if (Math.round(e.age) === age) sum += Number(e.amount) || 0;
    return sum;
  }
  // Return + inflation for year t (1-based): from the injected sequence, else constant.
  function yearRates(t) {
    if (seq) { const row = seq[(t - 1) % seq.length]; return { r: row.ret, infl: row.infl }; }
    return { r: rConst, infl: inflConst };
  }

  const data = [];
  let P  = s.portfolio;
  let FI = fiTarget;
  let cumInfl = 1;                 // running Π(1+infl); nominal spending/FI scale by this
  let prevRet = rConst;           // last year's return, for the GK loss-year check
  let yearsToFI    = null;
  let firstYearTax = 0;
  let depleteAge   = null;
  let gkSpend = 0, initialWR = 0, gkInit = false;  // Guyton-Klinger carried state

  // Already FI at t=0 → retire immediately.
  let retired = isFinite(fiTarget) && P >= fiTarget;
  if (retired) yearsToFI = 0;

  data.push({ year: 0, age: currentAge, portfolio: P, fi: FI, phase: retired ? 'draw' : 'grow' });

  for (let t = 1; t <= MAX_YEARS; t++) {
    const age = currentAge + t;
    const { r: yr, infl: yinfl } = yearRates(t);
    cumInfl *= (1 + yinfl);

    const prevP      = P + eventAt(age);       // life events land before growth
    const growthRate = useReal ? (1 + yr) / (1 + yinfl) - 1 : yr;
    const investGain = prevP * growthRate;
    const grown      = prevP + investGain;

    // Custom tax is always on the year's gain; Box 3 is on year-end wealth.
    let taxBase, tax;
    if (retired) {
      // ── Decumulation: gross spend by strategy, net of any pension income ──
      let gross;
      if (strat === 'vpw') {
        gross = wr * grown;                    // fixed % of the CURRENT pot
      } else if (strat === 'gk') {
        if (!gkInit) {                         // seed at the first retirement year
          gkSpend   = useReal ? s.spending : s.spending * cumInfl;
          initialWR = grown > 0 ? gkSpend / grown : 0;
          gkInit    = true;
        } else {
          if (prevRet >= 0) gkSpend *= (1 + (useReal ? 0 : yinfl)); // raise, skip after loss
          const curWR = grown > 0 ? gkSpend / grown : Infinity;
          if      (curWR > initialWR * 1.2) gkSpend *= 0.9;         // upper guardrail: cut
          else if (curWR < initialWR * 0.8) gkSpend *= 1.1;         // lower guardrail: raise
        }
        gross = gkSpend;
      } else {
        gross = useReal ? s.spending : s.spending * cumInfl;         // fixed real amount
      }
      const pension = age >= pensionAge ? (useReal ? pensionAmt : pensionAmt * cumInfl) : 0;
      const netDraw = Math.max(0, gross - pension);
      taxBase = grown;
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, inflConst, useReal, s.allocInvest)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = grown - netDraw - tax;
      if (P <= 0) { P = 0; if (depleteAge === null) depleteAge = age; }
    } else {
      // ── Accumulation: add contributions (deflated in real mode) ──
      const contrib = useReal ? savings / cumInfl : savings;
      taxBase = grown + contrib;
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, inflConst, useReal, s.allocInvest)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = Math.max(0, grown + contrib - tax);
    }

    if (!useReal) FI = fiTarget * cumInfl;     // nominal FI target inflates; real stays fixed
    if (t === 1) firstYearTax = tax;
    prevRet = yr;

    data.push({ year: t, age, portfolio: P, fi: FI, phase: retired ? 'draw' : 'grow' });

    // Cross into FI this year → accumulate through it, retire from next year.
    if (!retired && yearsToFI === null && P >= FI) { yearsToFI = t; retired = true; }
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge };
}

/* ── Risk engine: Monte Carlo + historical replay (v1.8) ──── */

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

/* ── Coast FI target ─────────────────────────────────────── */
// How much you need TODAY so that compounding alone reaches `fi` by age 65.
function coastFiTarget(fi, currentAge, realReturn) {
  const yearsLeft = Math.max(0, 65 - currentAge);
  if (yearsLeft === 0) return fi;
  return fi / Math.pow(1 + realReturn, yearsLeft);
}
