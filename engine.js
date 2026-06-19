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
  let yearsToFI   = null;
  let firstYearTax = 0;

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
        ? box3Tax(prevP + investGain + realSavings, t, infl, true, s.allocInvest)
        : s.taxMode === 'custom'
          ? customTax(investGain, s.taxCustomPct || 0)
          : 0;

      if (t === 1) firstYearTax = tax;
      P = Math.max(0, prevP + investGain + realSavings - tax);
      // FI stays fixed in real-terms mode
    } else {
      const investGain = prevP * r;

      const tax = s.taxMode === 'box3'
        ? box3Tax(prevP + investGain + savings, t, infl, false, s.allocInvest)
        : s.taxMode === 'custom'
          ? customTax(investGain, s.taxCustomPct || 0)
          : 0;

      if (t === 1) firstYearTax = tax;
      P  = Math.max(0, prevP + investGain + savings - tax);
      FI = FI * (1 + infl);
    }

    data.push({ year: t, portfolio: P, fi: FI });
    if (yearsToFI === null && P >= FI) yearsToFI = t;
  }

  return { savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax };
}

/* ── Coast FI target ─────────────────────────────────────── */
// How much you need TODAY so that compounding alone reaches `fi` by age 65.
function coastFiTarget(fi, currentAge, realReturn) {
  const yearsLeft = Math.max(0, 65 - currentAge);
  if (yearsLeft === 0) return fi;
  return fi / Math.pow(1 + realReturn, yearsLeft);
}
