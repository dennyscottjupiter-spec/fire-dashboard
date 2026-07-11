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
function runProjection(s) {
  const r    = s.returnRate / 100;
  const infl = s.inflation  / 100;
  const wr   = s.withdrawal / 100;

  const currentAge   = s.currentAge   || 30;
  const longevityAge = s.longevityAge || 95;
  const pensionAge   = s.pensionAge   || 67;
  const pensionAmt   = s.pensionAmount || 0;
  const events       = Array.isArray(s.events) ? s.events : [];

  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget    = wr > 0 ? s.spending / wr : Infinity;
  const unattainable = savings <= 0 && s.portfolio < fiTarget;

  const MAX_YEARS = Math.max(1, Math.round(longevityAge - currentAge));
  const isReal    = s.mode === 'real';
  const realReturn = (1 + r) / (1 + infl) - 1;

  // Net one-off cash flow scheduled for a given age (nominal / today's € as entered).
  function eventAt(age) {
    let sum = 0;
    for (const e of events) if (Math.round(e.age) === age) sum += Number(e.amount) || 0;
    return sum;
  }

  const data = [];
  let P  = s.portfolio;
  let FI = fiTarget;
  let yearsToFI    = null;
  let firstYearTax = 0;
  let depleteAge   = null;

  // Already FI at t=0 → retire immediately.
  let retired = isFinite(fiTarget) && P >= fiTarget;
  if (retired) yearsToFI = 0;

  data.push({ year: 0, age: currentAge, portfolio: P, fi: FI, phase: retired ? 'draw' : 'grow' });

  for (let t = 1; t <= MAX_YEARS; t++) {
    const age   = currentAge + t;
    const prevP = P + eventAt(age);          // life events land before growth
    const investGain = prevP * (isReal ? realReturn : r);
    const grown = prevP + investGain;

    // Custom tax is always on the year's gain; Box 3 is on year-end wealth,
    // whose base differs by phase (contributions add, withdrawals subtract).
    let taxBase, tax;
    if (retired) {
      // ── Decumulation: stop income, withdraw spending net of any pension ──
      const spendNeed = isReal ? s.spending : s.spending * Math.pow(1 + infl, t);
      const pension   = age >= pensionAge
        ? (isReal ? pensionAmt : pensionAmt * Math.pow(1 + infl, t))
        : 0;
      const netDraw = Math.max(0, spendNeed - pension);
      taxBase = grown;                         // wealth before drawdown
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, infl, isReal, s.allocInvest)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = grown - netDraw - tax;
      if (P <= 0) { P = 0; if (depleteAge === null) depleteAge = age; }
    } else {
      // ── Accumulation: add contributions (deflated in real mode) ──
      const contrib = isReal ? savings / Math.pow(1 + infl, t) : savings;
      taxBase = grown + contrib;               // wealth incl. this year's savings
      tax = s.taxMode === 'box3'
        ? box3Tax(taxBase, t, infl, isReal, s.allocInvest)
        : s.taxMode === 'custom' ? customTax(investGain, s.taxCustomPct || 0) : 0;
      P = Math.max(0, grown + contrib - tax);
    }

    if (!isReal) FI = FI * (1 + infl);         // nominal FI target inflates
    if (t === 1) firstYearTax = tax;

    data.push({ year: t, age, portfolio: P, fi: FI, phase: retired ? 'draw' : 'grow' });

    // Cross into FI this year → accumulate through it, retire from next year.
    if (!retired && yearsToFI === null && P >= FI) { yearsToFI = t; retired = true; }
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge };
}

/* ── Coast FI target ─────────────────────────────────────── */
// How much you need TODAY so that compounding alone reaches `fi` by age 65.
function coastFiTarget(fi, currentAge, realReturn) {
  const yearsLeft = Math.max(0, 65 - currentAge);
  if (yearsLeft === 0) return fi;
  return fi / Math.pow(1 + realReturn, yearsLeft);
}
