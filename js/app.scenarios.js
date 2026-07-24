/* ============================================================
   FIRE Dashboard — app.scenarios.js
   Controller, part 3/6: A/B scenario compare + life events manager.
   Pure definitions only — no top-level side effects. Depends on
   app.core.js (els, state, recalc, LS_SCENARIO_A/compareOn/scenarioA)
   + engine.js — loaded earlier, called only after app.boot.js runs.
   @map: snapshotState L13 · setCompareButton L28 · toggleCompare L33 ·
         fireYearOf L48 · updateCompareReadout L54 ·
         parseSignedNum L71 · renderEvents L78 · addEvent L104
   ============================================================ */

'use strict';

/* ── 6c. A/B scenario compare ────────────────────────────── */
// Deterministic snapshot of the plan (returnRate is already fee-adjusted).
function snapshotState() {
  return JSON.parse(JSON.stringify({
    portfolio: state.portfolio, income: state.income, spending: state.spending,
    investReturn: state.investReturn, savingsReturn: state.savingsReturn, allocInvest: state.allocInvest,
    returnRate: state.returnRate, inflation: state.inflation, withdrawal: state.withdrawal,
    mode: state.mode, taxMode: state.taxMode, taxCustomPct: state.taxCustomPct,
    box3Persons: state.box3Persons,
    currentAge: state.currentAge,
    terPct: state.terPct, pensionAge: state.pensionAge, pensionAmount: state.pensionAmount,
    pensionPot: state.pensionPot, pensionContrib: state.pensionContrib, events: state.events,
    wdStrategy: state.wdStrategy,
    growthModel: state.growthModel, cagrPct: state.cagrPct,
  }));
}

function setCompareButton() {
  els.btnCompare.classList.toggle('compare-on', compareOn);
  els.btnCompare.textContent = compareOn ? '📊 Comparing ✕' : '📊 Compare';
}

function toggleCompare() {
  if (compareOn) {
    compareOn = false; scenarioA = null;
    try { localStorage.removeItem(LS_SCENARIO_A); } catch (_) {}
  } else {
    scenarioA = snapshotState();
    compareOn = true;
    try { localStorage.setItem(LS_SCENARIO_A, JSON.stringify(scenarioA)); } catch (_) {}
  }
  setCompareButton();
  recalc();
}

// FIRE calendar year for a projection (null if never reached in horizon).
function fireYearOf(proj) {
  return (proj.yearsToFI !== null && proj.yearsToFI <= proj.data.length - 1)
    ? new Date().getFullYear() + proj.yearsToFI : null;
}

function updateCompareReadout(detB) {
  if (!compareOn || !scenarioA) { els.compareReadout.style.display = 'none'; return; }
  const projA = scenarioA.growthModel === 'perpetual' ? runPerpetual(scenarioA) : runProjection(scenarioA);
  const aYr = fireYearOf(projA);
  const bYr = fireYearOf(detB);
  let delta = '';
  if (aYr && bYr) {
    const d = aYr - bYr;                        // positive → B is earlier
    if (d > 0)      delta = `<span class="cmp-delta better">→ B is ${d} yr${d > 1 ? 's' : ''} earlier 🎉</span>`;
    else if (d < 0) delta = `<span class="cmp-delta worse">→ B is ${-d} yr${-d > 1 ? 's' : ''} later</span>`;
    else            delta = `<span class="cmp-delta">→ same FIRE year</span>`;
  }
  els.compareReadout.innerHTML =
    `<span class="cmp-a">A: FIRE ${aYr || '—'}</span> &nbsp;·&nbsp; B: FIRE ${bYr || '—'} &nbsp;${delta}`;
  els.compareReadout.style.display = 'block';
}

/* ── 9b. Life events manager ─────────────────────────────── */
// Parse a €-style string that may be negative (outlays): "-50,000" → -50000.
function parseSignedNum(str) {
  const neg = /^\s*-/.test(String(str));
  const n   = parseNum(str);
  return neg ? -n : n;
}

// Rebuild the events list from state.events. Called on add/remove and restore,
// NOT on every keystroke (editing a field mutates state in place + recalc()).
function renderEvents() {
  els.eventsList.innerHTML = '';
  state.events.forEach((ev, i) => {
    const row = document.createElement('div');
    row.className = 'event-row';
    const age = document.createElement('input');
    age.type = 'text'; age.inputMode = 'numeric'; age.className = 'event-input event-age';
    age.value = ev.age; age.placeholder = 'Age'; age.setAttribute('aria-label', 'Event age');
    const amt = document.createElement('input');
    amt.type = 'text'; amt.inputMode = 'numeric'; amt.className = 'event-input event-amount';
    amt.value = ev.amount; amt.placeholder = '±€'; amt.setAttribute('aria-label', 'Event amount (negative for an outlay)');
    const lbl = document.createElement('input');
    lbl.type = 'text'; lbl.className = 'event-input event-label';
    lbl.value = ev.label || ''; lbl.placeholder = 'Label'; lbl.setAttribute('aria-label', 'Event label');
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'event-remove'; del.textContent = '×';
    del.setAttribute('aria-label', 'Remove event');

    age.addEventListener('input', () => { state.events[i].age    = parseNum(age.value);       recalc(); });
    amt.addEventListener('input', () => { state.events[i].amount = parseSignedNum(amt.value);  recalc(); });
    lbl.addEventListener('input', () => { state.events[i].label  = lbl.value;                  recalc(); });
    del.addEventListener('click', () => { state.events.splice(i, 1); renderEvents(); recalc(); });

    row.append(age, amt, lbl, del);
    els.eventsList.appendChild(row);
  });
}

function addEvent() {
  const nextAge = Math.min(94, (state.currentAge || 30) + 5);
  state.events.push({ age: nextAge, amount: 0, label: '' });
  renderEvents();
  recalc();
}
