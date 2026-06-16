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

/* ── Box-3 wealth-tax constants (NL 2024) ─────────────────── */
const BOX3 = {
  allowance:    57000,   // heffingvrij vermogen per person (€)
  deemedReturn: 0.0604,  // fictitious return rate (6.04%)
  taxRate:      0.36,    // flat 36% on the deemed return
  // Effective drag on wealth above allowance ≈ 2.17%/yr
};

// Annual Box-3 tax on portfolio P at projection year t.
// In real mode, allowance is deflated so it stays comparable to a real-terms P.
function box3Tax(P, t, infl, isReal) {
  const allowance = isReal
    ? BOX3.allowance / Math.pow(1 + infl, t)
    : BOX3.allowance;
  const taxable = Math.max(0, P - allowance);
  return BOX3.taxRate * BOX3.deemedReturn * taxable;
}

// Capital-gains tax: pct% of that year's investment gain only.
function customTax(gain, pct) {
  return (pct / 100) * Math.max(0, gain);
}

/* ── Projection engine ────────────────────────────────────── */
function runProjection(s) {
  const r    = s.returnRate / 100;
  const infl = s.inflation  / 100;
  const wr   = s.withdrawal / 100;

  const savings     = s.income - s.spending;
  const savingsRate = s.income > 0 ? Math.max(0, savings / s.income) * 100 : 0;
  const fiTarget    = wr > 0 ? s.spending / wr : Infinity;
  const unattainable = savings <= 0 && s.portfolio < fiTarget;

  const MAX_YEARS = 50;
  const data = [];
  let P  = s.portfolio;
  let FI = fiTarget;
  let yearsToFI = null;

  data.push({ year: 0, portfolio: P, fi: FI });
  if (P >= fiTarget) yearsToFI = 0;

  const isReal = s.mode === 'real';

  for (let t = 1; t <= MAX_YEARS; t++) {
    const prevP = P;

    if (isReal) {
      const realReturn  = (1 + r) / (1 + infl) - 1;
      // Deflate nominal contributions so they stay in today's purchasing power
      const realSavings = savings / Math.pow(1 + infl, t);
      const investGain  = prevP * realReturn;

      const tax = s.taxMode === 'box3'
        ? box3Tax(prevP + investGain + realSavings, t, infl, true)
        : s.taxMode === 'custom'
          ? customTax(investGain, s.taxCustomPct || 0)
          : 0;

      P = Math.max(0, prevP + investGain + realSavings - tax);
      // FI stays fixed in real-terms mode
    } else {
      const investGain = prevP * r;

      const tax = s.taxMode === 'box3'
        ? box3Tax(prevP + investGain + savings, t, infl, false)
        : s.taxMode === 'custom'
          ? customTax(investGain, s.taxCustomPct || 0)
          : 0;

      P  = Math.max(0, prevP + investGain + savings - tax);
      FI = FI * (1 + infl);
    }

    data.push({ year: t, portfolio: P, fi: FI });
    if (yearsToFI === null && P >= FI) yearsToFI = t;
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data };
}

/* ── Coast FI target ─────────────────────────────────────── */
// How much you need TODAY so that compounding alone reaches `fi` by age 65.
function coastFiTarget(fi, currentAge, realReturn) {
  const yearsLeft = Math.max(0, 65 - currentAge);
  if (yearsLeft === 0) return fi;
  return fi / Math.pow(1 + realReturn, yearsLeft);
}
