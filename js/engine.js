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
  deemedDebt:    0.027,  // fictitious rate that deductible debts reduce the base by
  taxRate:       0.36,   // flat 36% on the total deemed return
};

// Annual Box-3 tax on portfolio P using the NL 2026 three-bucket proportional method.
// `ratios` = { savingsRatio, investRatio, debtRatio } — fixed shares of P, derived ONCE
// (in runProjection, from the user's today's-€ Savings/Investments/Debts split) and
// re-applied to the grown P every year, the same way the old single allocInvest% was.
// In real mode, allowance is deflated so it stays comparable to a real-terms P.
//
//   Example — P=€300k, ratios from €60k savings / €240k investments / €0 debt (today):
//     savings=60k, investments=240k, debts=0 → netWorth=300k
//     deemed = 240k×6.0% + 60k×1.28% − 0 = 15,168
//     taxable share = (300k − 59,357) / 300k = 0.8021
//     tax = 0.36 × 15,168 × 0.8021 ≈ €4,380
function box3Tax(P, t, infl, isReal, ratios) {
  const allowance = isReal
    ? BOX3.allowance / Math.pow(1 + infl, t)
    : BOX3.allowance;
  const r = ratios || { savingsRatio: 0, investRatio: 1, debtRatio: 0 }; // back-compat: 100% invested, no debt
  const savings     = P * r.savingsRatio;
  const investments = P * r.investRatio;
  const debts       = P * r.debtRatio;
  const netWorth = savings + investments - debts;
  if (netWorth <= allowance) return 0;
  const deemed = savings * BOX3.deemedSavings + investments * BOX3.deemedInvest - debts * BOX3.deemedDebt;
  const taxableShare = (netWorth - allowance) / netWorth;
  return BOX3.taxRate * Math.max(0, deemed) * taxableShare;
}

// Capital-gains tax: pct% of that year's investment gain only.
function customTax(gain, pct) {
  return (pct / 100) * Math.max(0, gain);
}

/* ── Box-1 pension income tax (NL, post-AOW, simplified 2026) ─ */
// A workplace/private pension pot (pijler 2/3) is Box 1, NOT Box 3: it grows
// untaxed as wealth, then its payout is taxed as income at the post-AOW rates
// (retirees pay no AOW premium, so the first bracket is ~19.07%).
const BOX1 = {
  bracket:  38441,   // 2026 first-bracket cap (approx, €)
  lowRate:  0.1907,  // post-AOW rate in the first bracket
  highRate: 0.37,    // simplified higher-bracket rate
};

// Progressive Box-1 tax on a gross annual pension payout.
function box1Tax(income) {
  if (income <= 0) return 0;
  const low  = Math.min(income, BOX1.bracket) * BOX1.lowRate;
  const high = Math.max(0, income - BOX1.bracket) * BOX1.highRate;
  return low + high;
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
//
// v1.9 NL tax layering (default-guarded):
//   s.pensionPot / s.pensionContrib – a Box-1 pension pot (pijler 2/3): grows locked and
//                  Box-3-free, then annuitizes over 20 yrs from AOW age (s.pensionAge),
//                  each payout taxed via box1Tax. Net annuity + AOW (s.pensionAmount) fund
//                  spending first; the taxable Box-3 pool covers only the remainder. Each
//                  data point carries `pp` (the pot balance that year).
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
  const pensionContrib = s.pensionContrib || 0;   // €/yr into the Box-1 pot (gross)
  const ANNUITY_YEARS  = 20;                       // pot pays out over 20 yrs from AOW
  const growthModel    = s.growthModel || 'income'; // 'income' | 'cagr' (v2.2)

  // Box-3 split (v2.5) — re-coupled to Asset Allocation: no debt bucket, no
  // manual € inputs. allocInvest% of the portfolio is "investments" (6.0%
  // deemed yield), the rest is "savings" (1.28% deemed yield).
  const alloc = s.allocInvest != null ? s.allocInvest : 100; // back-compat: 100% invested
  const box3Ratios = { savingsRatio: (100 - alloc) / 100, investRatio: alloc / 100, debtRatio: 0 };

  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget    = wr > 0 ? s.spending / wr : Infinity;
  // CAGR mode has no contributions, so "never catches up" means growth can't
  // outrun the FI target's own inflation (nominal: r ≤ i; real: FI is fixed, r ≤ 0).
  const unattainable = growthModel === 'cagr'
    ? (s.portfolio < fiTarget && ((s.mode === 'real' && !seq) ? rConst <= 0 : rConst <= inflConst))
    : (savings <= 0 && s.portfolio < fiTarget);

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
  let PP = s.pensionPot || 0;      // Box-1 pension pot (locked until AOW; untaxed by Box 3)
  let cumInfl = 1;                 // running Π(1+infl); nominal spending/FI scale by this
  let prevRet = rConst;           // last year's return, for the GK loss-year check
  let yearsToFI    = null;
  let firstYearTax = 0;
  let depleteAge   = null;
  let gkSpend = 0, initialWR = 0, gkInit = false;  // Guyton-Klinger carried state
  let annuityGross = 0, annuityLeft = 0, ppAnnuitized = false;  // Box-1 payout state

  // Already FI at t=0 → retire immediately.
  let retired = isFinite(fiTarget) && P >= fiTarget;
  if (retired) yearsToFI = 0;

  data.push({ year: 0, age: currentAge, portfolio: P, fi: FI, pp: PP, phase: retired ? 'draw' : 'grow' });

  for (let t = 1; t <= MAX_YEARS; t++) {
    const age = currentAge + t;
    const { r: yr, infl: yinfl } = yearRates(t);
    cumInfl *= (1 + yinfl);

    const prevP      = P + eventAt(age);       // life events land before growth
    const growthRate = useReal ? (1 + yr) / (1 + yinfl) - 1 : yr;
    const investGain = prevP * growthRate;
    const grown      = prevP + investGain;

    // ── Box-1 pension pot: grows locked & Box-3-free, annuitizes at AOW age ──
    if (!ppAnnuitized) {
      PP = PP * (1 + growthRate) + (useReal ? pensionContrib / cumInfl : pensionContrib);
      if (age >= pensionAge) {
        annuityGross = PP / ANNUITY_YEARS;     // level payout over 20 yrs
        annuityLeft  = ANNUITY_YEARS;
        ppAnnuitized = true;
        PP = 0;                                // pot converted to an income stream
      }
    }
    let annuityNet = 0;                        // Box-1 pension income, net of tax, this year
    if (ppAnnuitized && annuityLeft > 0) {
      annuityNet = annuityGross - box1Tax(annuityGross);
      annuityLeft--;
    }

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
      // Drawdown order: AOW income + Box-1 annuity cover spending first; the
      // taxable Box-3 pool funds only the remainder (and shrinks, lowering Box 3).
      const aow     = age >= pensionAge ? (useReal ? pensionAmt : pensionAmt * cumInfl) : 0;
      const netDraw = Math.max(0, gross - aow - annuityNet);
      taxBase = grown;
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, inflConst, useReal, box3Ratios)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = grown - netDraw - tax;
      if (P <= 0) { P = 0; if (depleteAge === null) depleteAge = age; }
    } else {
      // ── Accumulation: add contributions (deflated in real mode) ──
      // CAGR mode already bundles savings into the growth rate, so contributions
      // are switched off to avoid double-counting them.
      const contrib = growthModel === 'cagr' ? 0 : (useReal ? savings / cumInfl : savings);
      taxBase = grown + contrib;
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, inflConst, useReal, box3Ratios)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = Math.max(0, grown + contrib - tax);
    }

    if (!useReal) FI = fiTarget * cumInfl;     // nominal FI target inflates; real stays fixed
    if (t === 1) firstYearTax = tax;
    prevRet = yr;

    data.push({ year: t, age, portfolio: P, fi: FI, pp: PP, phase: retired ? 'draw' : 'grow' });

    // Cross into FI this year → accumulate through it, retire from next year.
    if (!retired && yearsToFI === null && P >= FI) { yearsToFI = t; retired = true; }
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge };
}

/* ── Net-Worth CAGR mode (v2.2) ───────────────────────────── */

// Reverse solver: the lowest gross CAGR (0–100%) that reaches FI by targetAge.
// Bisection on the real sim (not a closed form) because tax + TER stay active
// on top of the typed rate, per the user's choice — reaching FI is monotonic
// in the growth rate, so bisection is sound. Returns null if unreachable or
// if targetAge is not in the future.
function solveCagrForAge(s, targetAge) {
  const t = Math.round(targetAge - (s.currentAge || 30));
  if (t <= 0) return null;
  const reaches = g => {
    const p = runProjection({ ...s, growthModel: 'cagr',
                              returnRate: g - (s.terPct || 0), sequence: null });
    return p.yearsToFI !== null && p.yearsToFI <= t;
  };
  if (!reaches(100)) return null;
  if (reaches(0))    return 0;
  let lo = 0, hi = 100;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; reaches(mid) ? hi = mid : lo = mid; }
  return hi;
}

// Bridge readout: the compound annual growth rate the income model's own
// accumulation phase implies, so the two growth models can be sanity-checked
// against each other. Returns null when it can't be derived.
function impliedCagr(proj, startPortfolio) {
  const last = proj.data.length - 1;
  const n    = (proj.yearsToFI !== null && proj.yearsToFI > 0) ? proj.yearsToFI : last;
  if (n <= 0 || startPortfolio <= 0) return null;
  const end = proj.data[Math.min(n, last)].portfolio;
  if (end <= 0) return null;
  return (Math.pow(end / startPortfolio, 1 / n) - 1) * 100;
}

/* ── Perpetual growth model (v2.5) ────────────────────────── */
// "How much capital do I need to draw an inflation-protected income forever?"
// Reuses the income-model blend (s.returnRate — already fee-adjusted) and the
// existing Tax toggle, layered up through a real (Fisher) after-tax rate:
//
//   g (gross blend) → n (after-tax nominal) → r (after-tax REAL, Fisher) → P
//
// Tax mapping (reuses the existing taxMode toggle, no new UI):
//   box3   — wealth tax: drag = (alloc·6.0% + (1-alloc)·1.28%) × 36%, applied to
//            the WHOLE pot every year (n = g − drag), but the €59,357 allowance
//            is tax-FREE, so it funds `allowanceBenefit` €/yr of income for free.
//   custom — income tax: n = g × (1 − taxCustomPct%) (tax only bites the gain).
//   none   — n = g.
//
// Fisher equation converts the after-tax NOMINAL rate to a REAL one so P is
// expressed in today's money: r = (1+n)/(1+f) − 1. If r ≤ 0, compounding can't
// outrun inflation net of tax — no finite principal funds the income forever.
function perpetualCapital(s) {
  const I     = s.spending;
  const g     = s.returnRate / 100;
  const f     = s.inflation  / 100;
  const alloc = (s.allocInvest != null ? s.allocInvest : 100) / 100;

  let n, drag = 0, allowanceBenefit = 0, taxType = 'none';
  if (s.taxMode === 'box3') {
    taxType = 'box3';
    const blendedDeemed = alloc * BOX3.deemedInvest + (1 - alloc) * BOX3.deemedSavings;
    drag = blendedDeemed * BOX3.taxRate;
    n = g - drag;
    allowanceBenefit = BOX3.allowance * drag;
  } else if (s.taxMode === 'custom') {
    taxType = 'custom';
    n = g * (1 - (s.taxCustomPct || 0) / 100);
  } else {
    n = g;
  }

  const r = (1 + n) / (1 + f) - 1;
  if (r <= 0) return { I, g, drag, n, r, taxType, allowanceBenefit, capital: Infinity, unreachable: true };
  return { I, g, drag, n, r, taxType, allowanceBenefit, capital: (I - allowanceBenefit) / r, unreachable: false };
}

// Inflation-sensitivity table: holds g and the tax layer fixed, re-derives r
// and the required capital at a spread of inflation rates (0–4%). `capital`
// is null wherever that inflation rate alone would already push r ≤ 0.
function perpetualSensitivity(s) {
  const pc = perpetualCapital(s);
  return [0, 0.01, 0.02, 0.03, 0.04].map(infl => {
    const r = (1 + pc.n) / (1 + infl) - 1;
    return { infl, capital: r > 0 ? (pc.I - pc.allowanceBenefit) / r : null };
  });
}

// Same return shape as runProjection so the chart/KPI plumbing is reused as-is.
// Accumulates in real terms at rate r (adding annual real savings) until the
// pot reaches the perpetual capital target, then holds flat: each year draws I
// and receives the tax-free allowance benefit, which nets to ~0 by construction
// (r·capital + allowanceBenefit = I) — the whole point of a perpetuity.
function runPerpetual(s) {
  const pc         = perpetualCapital(s);
  const fiTarget   = pc.capital;
  const currentAge   = s.currentAge   || 30;
  const longevityAge = s.longevityAge || 95;
  const MAX_YEARS  = Math.max(1, Math.round(longevityAge - currentAge));
  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const r = pc.r;

  const data = [];
  let P = s.portfolio;
  let yearsToFI = isFinite(fiTarget) && P >= fiTarget ? 0 : null;
  let retired   = yearsToFI === 0;
  data.push({ year: 0, age: currentAge, portfolio: P, fi: fiTarget, pp: 0, phase: retired ? 'draw' : 'grow' });

  for (let t = 1; t <= MAX_YEARS; t++) {
    const age = currentAge + t;
    if (retired) {
      P = Math.max(0, P * (1 + r) + pc.allowanceBenefit - pc.I);
    } else {
      P = P * (1 + r) + savings;
      // fiTarget is an exact fixed point of the draw recursion (r·capital +
      // allowanceBenefit = I) — snap onto it at the crossing so the "flat"
      // phase actually stays flat instead of carrying that year's overshoot
      // forward and compounding it at rate r for the rest of the horizon.
      if (yearsToFI === null && isFinite(fiTarget) && P >= fiTarget) { yearsToFI = t; retired = true; P = fiTarget; }
    }
    data.push({ year: t, age, portfolio: P, fi: fiTarget, pp: 0, phase: retired ? 'draw' : 'grow' });
  }

  let firstYearTax = 0;
  if (pc.taxType === 'box3')   firstYearTax = pc.drag * s.portfolio;
  else if (pc.taxType === 'custom') firstYearTax = customTax(s.portfolio * pc.g, s.taxCustomPct || 0);

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable: pc.unreachable, data, firstYearTax, depleteAge: null };
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

// Interactive History (v2.5): click-to-place crash. Every year uses the
// user's own steady assumptions EXCEPT a `span`-year window starting at
// `shockAge`, which replays the exact HIST sequence from `startYear` — so a
// crash happens exactly when placed, not "from age-now" like runHistorical.
function runHistoricalShock(s, startYear, shockAge, span) {
  const currentAge   = s.currentAge   || 30;
  const longevityAge = s.longevityAge || 95;
  const horizon       = Math.max(1, Math.round(longevityAge - currentAge));
  const rConst    = s.returnRate / 100;
  const inflConst = s.inflation  / 100;

  let idx0 = HIST.findIndex(h => h.year === startYear);
  if (idx0 < 0) idx0 = 0;

  const shockStart = Math.round(shockAge - currentAge);  // 1-based year the window begins
  const sequence = [];
  for (let t = 1; t <= horizon; t++) {
    if (t >= shockStart && t < shockStart + span) {
      const row = HIST[(idx0 + (t - shockStart)) % HIST.length];
      sequence.push({ ret: row.ret, infl: row.infl });
    } else {
      sequence.push({ ret: rConst, infl: inflConst });
    }
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
