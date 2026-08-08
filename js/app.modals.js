/* ============================================================
   FIRE Dashboard — app.modals.js
   Controller, part 4/6: onboarding wizard + Help modal + About modal.
   Pure definitions only — no top-level side effects. Depends on
   app.core.js (els, state, recalc, parseNum, numFmt) + store.js
   (applyConfig) — loaded earlier, called only after app.boot.js runs.
   @map: WIZARD_STEPS L13 · openWizard/closeWizard L27 ·
         renderWizardStep L30 · wizardCapture L63 · wizardNext/wizardBack L74 ·
         finishWizard L81 · HELP_TABS L97 · renderHelpTabs L188 ·
         renderHelpPanel L197 · openHelp/closeHelp L205 ·
         APP_VERSION/ABOUT_FEATURES L221 · openAbout/closeAbout L228
   ============================================================ */

'use strict';

/* ── 6d. Onboarding wizard ───────────────────────────────── */
const WIZARD_STEPS = [
  { key: 'age',       icon: '🎂', q: 'How old are you today?',                 hint: 'We use this to place your FIRE year on the calendar.',                 type: 'number', suffix: 'years old', def: () => state.currentAge },
  { key: 'income',    icon: '💵', q: 'Your yearly take-home income?',          hint: 'After tax — what actually lands in your account.',                     type: 'euro',   def: () => state.income },
  { key: 'spending',  icon: '🛒', q: 'How much do you spend per year?',        hint: 'Everything: rent, food, fun. The gap is what you invest.',             type: 'euro',   def: () => state.spending },
  { key: 'retireAge', icon: '🏖️', q: 'When do you want to stop mandatory work?', hint: 'Your target age. Earlier retirements get a safer withdrawal rate.',   type: 'number', suffix: 'years old', def: () => Math.max(state.currentAge + 1, 50) },
  { key: 'risk',      icon: '🎯', q: 'How do you feel about market swings?',   hint: 'Sets your expected return and stock/cash mix.',                        type: 'choice', def: () => 'balanced', choices: [
      { val: 'cautious', label: '🛡️ Cautious', desc: 'Steadier ride, lower growth (40% stocks)' },
      { val: 'balanced', label: '⚖️ Balanced', desc: 'A healthy mix (70% stocks)' },
      { val: 'growth',   label: '🚀 Growth',   desc: 'Ride the swings for more (95% stocks)' },
  ] },
];
let _wizIdx = 0, _wizAns = {};

function openWizard() { _wizIdx = 0; _wizAns = {}; els.wizardOverlay.style.display = 'flex'; renderWizardStep(); }
function closeWizard() { els.wizardOverlay.style.display = 'none'; }

function renderWizardStep() {
  const step = WIZARD_STEPS[_wizIdx];
  let html = `<div class="wiz-q">${step.icon} ${step.q}</div><div class="wiz-hint">${step.hint}</div>`;
  if (step.type === 'choice') {
    const cur = _wizAns[step.key] != null ? _wizAns[step.key] : step.def();
    html += '<div class="wiz-choices">';
    step.choices.forEach(c => {
      html += `<button type="button" class="wiz-choice${c.val === cur ? ' selected' : ''}" data-val="${c.val}">` +
              `<div><div class="wiz-choice-label">${c.label}</div><div class="wiz-choice-desc">${c.desc}</div></div></button>`;
    });
    html += '</div>';
  } else {
    const cur = _wizAns[step.key] != null ? _wizAns[step.key] : step.def();
    const shown = step.type === 'euro' ? numFmt.format(cur) : cur;
    html += `<input type="text" inputmode="numeric" class="wiz-input" id="wiz-input" value="${shown}" autocomplete="off" />`;
    if (step.suffix) html += `<div class="wiz-suffix">${step.suffix}</div>`;
  }
  els.wizardBody.innerHTML = html;
  els.wizardProgress.innerHTML = WIZARD_STEPS
    .map((_, i) => `<span class="wiz-dot ${i < _wizIdx ? 'done' : i === _wizIdx ? 'active' : ''}"></span>`).join('');
  els.wizardBack.disabled   = _wizIdx === 0;
  els.wizardNext.textContent = _wizIdx === WIZARD_STEPS.length - 1 ? 'Finish ✓' : 'Next →';

  if (step.type === 'choice') {
    els.wizardBody.querySelectorAll('.wiz-choice').forEach(b => b.addEventListener('click', () => {
      _wizAns[step.key] = b.dataset.val;
      els.wizardBody.querySelectorAll('.wiz-choice').forEach(x => x.classList.toggle('selected', x === b));
    }));
  } else {
    const inp = document.getElementById('wiz-input');
    if (inp) { inp.focus(); inp.select(); }
  }
}

function wizardCapture() {
  const step = WIZARD_STEPS[_wizIdx];
  if (step.type === 'choice') {
    if (_wizAns[step.key] == null) _wizAns[step.key] = step.def();
  } else {
    const inp = document.getElementById('wiz-input');
    const n = parseNum(inp ? inp.value : '');
    _wizAns[step.key] = step.type === 'euro' ? n : (n || step.def());
  }
}

function wizardNext() {
  wizardCapture();
  if (_wizIdx < WIZARD_STEPS.length - 1) { _wizIdx++; renderWizardStep(); }
  else finishWizard();
}
function wizardBack() { wizardCapture(); if (_wizIdx > 0) { _wizIdx--; renderWizardStep(); } }

function finishWizard() {
  const a = _wizAns, cfg = {};
  if (a.age != null)       cfg.currentAge = Math.max(1, Math.min(100, a.age));
  if (a.income != null)    cfg.income     = a.income;
  if (a.spending != null)  cfg.spending   = a.spending;
  if (a.retireAge != null) cfg.withdrawal = a.retireAge <= 55 ? 3.5 : a.retireAge <= 65 ? 4 : 4.5;
  if (a.risk === 'cautious')      { cfg.investReturn = 6; cfg.allocInvest = 40; cfg.savingsReturn = 2; }
  else if (a.risk === 'balanced') { cfg.investReturn = 7; cfg.allocInvest = 70; cfg.savingsReturn = 2; }
  else if (a.risk === 'growth')   { cfg.investReturn = 8; cfg.allocInvest = 95; cfg.savingsReturn = 2; }
  applyConfig(cfg);
  recalc();
  closeWizard();
}

/* ── 6e. Help modal — tabbed explainer, tooltip text reused verbatim ── */
// Each section's `tip` is copied verbatim from the matching data-tip in index.html;
// `extra` is a short plain-language add-on. Keeps the two in one place so future
// tooltip edits and this modal don't quietly drift apart.
const HELP_TABS = [
  { key: 'inputs', icon: '🎛️', label: 'Inputs', sections: [
      { tip: 'What your investments are worth today. This is your starting pot — the money already working for you.',
        extra: 'This seeds every projection as year zero — everything else compounds on top of it.' },
      { tip: 'Money you take home per year, after all taxes. The gross you see on your contract minus what the taxman keeps.',
        extra: 'Income minus spending is what actually gets invested each year.' },
      { tip: 'Everything you spend in a year: rent, food, travel, fun. The gap between income and spending is what you invest.',
        extra: 'Lowering this either speeds up FIRE or lowers the pot you need, since your FI Number is spending ÷ withdrawal rate.' },
      { tip: 'Your age today. Used to show which calendar year you’ll hit FIRE, and to calculate your Coast FI milestone.',
        extra: 'Also drives the chart’s x-axis, which is plotted in age rather than calendar year.' },
      { tip: 'Real Terms: strips out inflation so all values are in today’s purchasing power. Contributions are also deflated. The curve is lower but more honest.',
        extra: 'Nominal shows bigger, inflated future numbers; Real Terms answers "what could this actually buy today?"' },
  ] },
  { key: 'growth', icon: '📈', label: 'Growth Model', sections: [
      { tip: 'Two ways to reach FIRE. ‘Income & Return’ builds your pot from what you save each year plus market growth. ‘Net Worth CAGR’ skips all that — you just tell it how fast your total net worth grows per year, savings included.',
        extra: 'Use Income & Return if you think in salary/spending terms; use CAGR if you already track a single net-worth growth rate.' },
      { tip: 'How fast your total net worth compounds each year — this already includes the money you save, so income and spending contributions are switched off. This is a gross rate: your chosen tax mode and fund fee still apply on top.',
        extra: 'Because savings are already baked into one number, the engine doesn’t add income-minus-spending on top of it — that would double-count your contributions.' },
      { tip: 'Work it backwards: name the age you want to be financially independent, and this shows the yearly net-worth growth you’d need to get there.',
        extra: 'Solved numerically against the real simulation (tax, fees, inflation all included), not a back-of-envelope formula.' },
      { tip: 'The single equivalent annual growth rate implied by your Income & Return plan — yearly savings plus market growth combined into one compound rate. Compare it against the rate you type into the Net Worth CAGR model to sanity-check the two against each other.',
        extra: 'Always shown, even on the Income & Return model, as a bridge between the two ways of thinking about growth.' },
  ] },
  { key: 'allocation', icon: '⚖️', label: 'Allocation', sections: [
      { tip: 'How your money is split between growth investments and lower-risk savings. Both slices always sum to 100% — move the slider to change the mix.',
        extra: 'A higher invested share raises expected growth but also raises volatility — see the Monte Carlo / History views under Chart.' },
      { tip: 'The annual rate your cash savings or money-market account earns. Typically 1–4%, much lower than equities.',
        extra: 'Blended with the investment return, weighted by your allocation split, to get your overall expected portfolio return.' },
      { tip: 'Growth per year BEFORE inflation (nominal). Long-run global stocks run ≈10% nominal / ≈7% after inflation — the app subtracts your Expected Inflation separately, so don\'t pre-deduct it here.',
        extra: 'This is the pre-fee, pre-tax return — the fund fee (TER) and your tax mode both reduce what you actually keep.' },
  ] },
  { key: 'tax', icon: '🧾', label: 'Tax', sections: [
      { tip: 'Tax slows your portfolio’s growth each year. Box 3 (NL) is a wealth tax on assets above €57k — about 2.17%/yr. Custom lets you type your own effective rate.',
        extra: 'Tax is subtracted after that year’s growth and contributions, and the estimate shows in the "est. tax this year" readout.' },
  ] },
  { key: 'withdrawal', icon: '💧', label: 'Withdrawal', sections: [
      { tip: 'How fast prices rise each year, silently eroding the value of your money. ~2% is the central-bank target in most developed countries.',
        extra: 'Higher inflation raises your FI Number in Nominal mode (the target itself inflates) and raises the Coast FI target in Real mode.' },
      { tip: 'The % of your pot you can safely withdraw each year in retirement, without running out of money. 4% is the classic ‘Trinity Study’ rule of thumb.',
        extra: 'Your FI Number is simply spending ÷ this rate — a lower withdrawal rate demands a bigger pot but is safer.' },
      { tip: 'How you actually draw money down in retirement. A fixed amount is simplest; dynamic strategies flex with the market to survive crashes better.',
        extra: 'Fixed real = classic 4% rule. Guardrails (Guyton-Klinger) skip inflation raises after bad years and trim spending if you drift off-plan. % of pot recalculates off your current balance every year, so it mathematically never runs dry, but your income swings with the market.' },
  ] },
  { key: 'pension', icon: '🇳🇱', label: 'Pension', sections: [
      { tip: 'The messy realities a flat projection ignores: the fees your funds skim off every year, income that switches on at pension age, and one-off life events. All feed the age-by-age simulation.',
        extra: 'This is what turns a smooth compound-interest curve into a realistic, year-by-year retirement simulation.' },
      { tip: 'Total Expense Ratio: the % your funds quietly deduct each year. An index fund charges ~0.1%; an actively managed fund ~1%. Over 40 years that gap can eat a quarter of your pot — it’s subtracted straight from your investment return.',
        extra: 'The "lost to fees over your lifetime" readout reruns your whole plan fee-free and compares the terminal wealth, so you can see the gap in real €.' },
      { tip: 'The age a state or workplace pension starts paying — Dutch AOW is 67. From this age the income below covers part of your spending, so your own pot only has to bridge the early-retirement years.',
        extra: 'Everything before this age is funded entirely by your own portfolio; state/workplace income only kicks in afterwards.' },
      { tip: 'Flat state-pension income in today’s money, starting at the age above. Single-person Dutch AOW is roughly €19,000/yr. Set 0 if you don’t want to count on it.',
        extra: 'Reduces how much your own pot needs to cover each year once you reach pension age.' },
      { tip: 'Your workplace / private pension pot today (pijler 2/3). It grows tax-FREE as wealth — no Box 3 — locked until AOW age, then pays out over 20 years with each payout taxed as Box 1 income. Simplified model, not tax advice.',
        extra: 'Kept as a separate pool from your regular taxable portfolio until it annuitizes, at which point it starts paying out and topping up your income.' },
      { tip: 'Gross € added to your workplace pension pot every year (you + employer). Builds the Box-1 pot that bridges the years after AOW age.',
        extra: 'Grows alongside your regular portfolio but is walled off from Box 3 wealth tax until it pays out.' },
      { tip: 'One-off cash flows at a specific age: an inheritance or house sale (positive), or a house purchase, college, or sabbatical (negative). Each lands in that year before growth.',
        extra: 'Shown on the chart as small ▲/▼ markers at the age they occur.' },
  ] },
  { key: 'chart', icon: '📊', label: 'Chart', sections: [
      { tip: 'Blue line = your portfolio growing over time. Green dashed line = the FI target you need to hit. When blue crosses green, you’re financially independent. The line turns amber once you retire and start drawing the pot down — if it flattens at €0, your money ran out under this plan (see the note above the chart). In Monte Carlo mode, the shaded band shows the 10th-90th percentile range of outcomes and the blue line inside it is the median.',
        extra: 'The crossover point is marked with a 🔥 flag on the age axis the moment your portfolio overtakes the FI target.' },
      { tip: 'Steady: one smooth line at your average return. Clean, but ignores that real markets crash and boom.',
        extra: 'Good for a quick sanity check, but it hides sequence-of-returns risk — see Monte Carlo or History for the honest picture.' },
      { tip: 'Monte Carlo: replays 1,000 random shuffles of a century of real market years to show the RANGE of outcomes and how often your plan survives — the honest way to see Sequence-of-Returns Risk.',
        extra: 'The success-rate badge is the share of those 1,000 simulated futures where your pot lasts to age 95.' },
      { tip: 'History: replays the exact market sequence from a chosen year — e.g. retiring straight into the 1929 crash or the 2000 dot-com bust.',
        extra: 'Useful for stress-testing your plan against a real, specific historical sequence rather than a random shuffle.' },
      { tip: 'The projection spends your pot down through retirement to age 95 (your longevity horizon). ‘Runs dry at age N’ means the model expects your money to reach €0 at that age, given today’s spending, returns and withdrawal strategy — it’s a warning signal, not a hard failure.',
        extra: 'Try a more conservative withdrawal strategy (Guardrails or % of pot) or a lower withdrawal rate if this shows up red.' },
      { tip: 'Progress checkpoints on your journey to FI. Each one lights up green as soon as your current portfolio crosses that threshold.',
        extra: 'Ladder, easiest to hardest: First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%).' },
  ] },
  { key: 'tools', icon: '🧰', label: 'Tools', sections: [
      { tip: 'Guided setup: answer a few plain-language questions and we’ll fill in the sliders for you.',
        extra: 'A fast way to get reasonable starting values without touching every input by hand — you can still fine-tune afterwards.' },
      { tip: 'Snapshot your current plan as Scenario A, then keep editing as Scenario B — both are drawn on the chart so you can compare them side by side. Click again to clear.',
        extra: 'Great for "what if I retired 5 years later" or "what if I saved €200 more per month" side-by-side comparisons.' },
      { tip: 'Download your current settings as a JSON file. Share it or reload it later with Import.',
        extra: 'Nothing is uploaded anywhere — it’s a plain file saved to your own device.' },
      { tip: 'Load a previously exported JSON file to restore your saved settings.',
        extra: 'Rejects files over 100 KB or the wrong file type before reading them, so a stray file can’t corrupt your inputs.' },
      { tip: 'Clears your saved inputs from this browser’s local storage and resets all values to the defaults. Your data is stored only in this browser — never uploaded anywhere.',
        extra: 'Needs two clicks within 3 seconds to confirm, so it can’t be triggered by accident.' },
      { tip: 'Your inputs auto-save in this browser’s localStorage — a local database that never leaves your device. No server, no account, no upload. Use the 🗑 Reset button (top-right) to wipe everything and restore defaults.',
        extra: 'Everything you type is only ever stored on this one browser, on this one device.' },
  ] },
];
let _helpTab = HELP_TABS[0].key;

function renderHelpTabs() {
  els.helpTabs.innerHTML = HELP_TABS
    .map(t => `<button type="button" class="help-tab-btn${t.key === _helpTab ? ' active' : ''}" data-tab="${t.key}">${t.icon} ${t.label}</button>`)
    .join('');
  els.helpTabs.querySelectorAll('.help-tab-btn').forEach(b => b.addEventListener('click', () => {
    _helpTab = b.dataset.tab;
    renderHelpTabs();
    renderHelpPanel();
  }));
}

function renderHelpPanel() {
  const tab = HELP_TABS.find(t => t.key === _helpTab) || HELP_TABS[0];
  els.helpPanel.innerHTML = tab.sections.map(s =>
    `<div class="help-section"><div class="help-tip-quote">${s.tip}</div><p class="help-extra">${s.extra}</p></div>`
  ).join('');
  els.helpPanel.scrollTop = 0;
}

function openHelp(tabKey) {
  _helpTab = tabKey && HELP_TABS.some(t => t.key === tabKey) ? tabKey : HELP_TABS[0].key;
  renderHelpTabs();
  renderHelpPanel();
  els.helpOverlay.style.display = 'flex';
}
function closeHelp() { els.helpOverlay.style.display = 'none'; }

/* ── 6f. About modal (v2.8) ──────────────────────────────── */
const APP_VERSION = 'v2.9.0';
const ABOUT_FEATURES = [
  'Real Terms is now the default view, and contributions track inflation in both Real and Nominal modes',
  'Fullscreen button on the Portfolio Growth Projection chart, plus a live spending-impact readout and slider',
  'TER fund-fee stepper fixed (0.05 steps), 0.25% ETF default, and a new engine validation/backtest test suite',
];

function openAbout() {
  els.aboutVersion.textContent = APP_VERSION;
  els.aboutFeatures.innerHTML = ABOUT_FEATURES.map(f => `<li>${f}</li>`).join('');
  els.aboutOverlay.style.display = 'flex';
}
function closeAbout() { els.aboutOverlay.style.display = 'none'; }
