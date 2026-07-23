# Key invariants

Detailed rules for `js/` and `css/`. Read this before editing either.
See also `docs/TESTING.md` (suite) and `docs/HISTORY.md` (release lineage). Orientation + file map live in `CLAUDE.md`.

## Data flow (app.js)

Single `state` object → **`recalc()` is the only heartbeat**. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. **Never update the UI piecemeal.**

```
input event
  → update state fields (parseNum for € fields, parseFloat for rate boxes)
  → compute blend (fee-adjusted): returnRate = a·(investReturn − terPct) + (1−a)·savingsReturn
  → runProjection(state) → { savings, fiTarget, yearsToFI, data[], firstYearTax, depleteAge }
  → fee-impact readout (rerun fee-free, compare terminal wealth) + lifecycle note
  → write KPIs + FIRE-year pill + notice banner + #tax-annual-val readout
  → updateGauge(portfolio / fiTarget)
  → chart.update() + crossover marker plugin
  → updateMilestones()
  → saveState() → localStorage
```

## Chart

- `initChart()` runs once at boot, guarded by the `chartReady` flag (both in `ui.js`). Always `chart.update()` the existing instance; **never recreate it**.
- Chart writes skipped if CDN failed (`chartReady === false`).
- `crossoverPlugin` (`ui.js`): inline Chart.js plugin drawing the FI-crossover marker; reads `chart.$fireYear`, set in `recalc()`.
- All Chart.js font options use `Inter, "Segoe UI", sans-serif`.

## Rate inputs

- `bindRange(slider, box, sliderMax, [capMin, capMax])` wires any rate control.
- **Box is the source of truth**: `recalc()` reads `parseFloat(els.valReturn.value)`, not the slider.
- Hard caps: Return 50%, Inflation 50%, WR 20%, Savings 10%. Slider track maxes lower (15/10/10, no slider for savings) and pin visually when the typed value exceeds them.
- `box._lastValid` (on the DOM node, not a closure) stores the last valid value, so macro clicks, stepper nudges, and imports share one consistent revert value.
- `stepRate(boxId, delta)` nudges by 0.5, guards `if (slider)` before setting slider value so it works for slider-less boxes (`val-savings`). Wired to `ArrowUp`/`ArrowDown` on all rate boxes including `val-savings`.
- **Macro buttons** — each has `data-slider` and `data-val` attributes. On click, set both the slider, the box, and `box._lastValid`. `refreshMacroActive()` compares against the box value (not the slider).

## Asset allocation

- `state.investReturn` (investment return %) and `state.savingsReturn` (cash rate %) are split fields; `state.allocInvest` (0–100) is the % in investments, savings = 100−allocInvest.
- `state.returnRate` derived in every `recalc()` via the blend formula; `engine.js` remains untouched. `RATE_CFG['val-savings']` has `slider: null`.

## Retirement Readiness gauge

Speedometer dial built entirely in SVG/CSS, no extra libraries (`ui.js`).

- `buildGauge()` runs once at boot, injects into `#gauge-svg`: colored zone arcs (red 0–33% / amber 33–80% / green 80–100%), minor ticks every 10%, major ticks at 0/25/50/75/100%, numeric labels at r=94, three FIRE milestone checkpoint flags (`.gauge-flag`) at Barista 50% / Lean FI 70% / Full FIRE 100%.
- The needle is a tapered `<polygon>` (not a `<line>`); hub is a two-circle chrome cap.
- `updateGauge(readiness)` sets `stroke-dashoffset = ARC_LEN · (1 − clamp(readiness, 0, 1))` and `rotate((c·180−90)deg)` on `#gauge-needle` (`transform-box: view-box; transform-origin: 100px 100px`).
- Colour ramp: red `<33%` → amber `<80%` → green `≥80%`. `ARC_LEN = π·80 ≈ 251.33`. `--amber: #f5a524` token in `:root`.

## € inputs

- `type="text"`, not `type="number"` — browsers reject comma-formatted strings. `parseNum()` strips all non-digits before parsing.
- `numFmt.format()` (en-US, no symbol) writes `50,000` on blur; `eur.format()` (en-IE) writes `€750,000` — use en-IE, **not** de-DE (which gives `750.000 €`).

## Nominal vs Real mode

Controlled by `state.mode`.

- Nominal: both portfolio and FI target inflate each year.
- Real: FI target fixed; portfolio uses `realReturn = (1+r)/(1+infl)-1`; contributions deflated to today's purchasing power (`savings / (1+infl)^t`) so they don't overstate growth.

## Tax

`state.taxMode` is `'none' | 'box3' | 'custom'`.

- Box 3 (NL 2026 model, v2.3 three-bucket): split deemed returns — investments 6.0%, savings 1.28%, deductible debts −2.70%, flat 36% rate, €59,357 threshold (single).
- **Decoupled from `state.allocInvest`** (the return-blend slider) — driven instead by three dedicated €-denominated inputs: `state.box3Savings`, `state.box3Investments`, `state.box3Debts`. `runProjection` derives fixed *ratios* from them once (`savingsRatio`/`investRatio` = each bucket ÷ (savings+investments); `debtRatio` = debts ÷ (savings+investments)) and re-applies those ratios to the grown taxable pool `P` every year — the same "fixed % of a growing P" pattern the old `allocInvest`-based method used, just from 3 buckets instead of 1 slider.
- Uses the *proportional method*: `savings=P·savingsRatio`, `investments=P·investRatio`, `debts=P·debtRatio`; `netWorth = savings+investments−debts`; `deemed = savings·1.28% + investments·6.0% − debts·2.70%`; `taxableShare = (netWorth−allowance)/netWorth`; tax = `0.36 × max(0,deemed) × taxableShare` (0 if `netWorth ≤ allowance`).
- `box3Tax(P, t, infl, isReal, ratios)` — `ratios = {savingsRatio, investRatio, debtRatio}`; omitting it defaults to `{0, 1, 0}` (100% invest, no debt — backward-compat with pre-v2.3 configs/tests). Allowance deflated in Real mode.
- Because Box 3 no longer reads `allocInvest`, Asset Allocation is now genuinely inert in CAGR mode (it never affected the CAGR return itself) — `applyGrowthModelUI()` dims `#group-alloc` there too, alongside Income/Investment Return.
- Custom: `taxCustomPct`% applied to that year's investment gain only.
- Tax is subtracted *after* growth + contributions each year, inside `runProjection`, which returns `firstYearTax` (year-1 tax under the active mode) → rendered to the `#tax-annual-val` readout as "≈ €X est. tax this year".

## Lifecycle (v1.7)

- `runProjection` runs to `longevityAge` (95), retires at the FI crossing (accumulate → `phase:'draw'`), returns `depleteAge` (age the pot first hits €0 in retirement, else null). Each `data` point carries `{year, age, portfolio, fi, phase}`.
- New default-guarded state: `currentAge`, `pensionAge`/`pensionAmount` (age-triggered income net off the withdrawal), `events[{age,amount,label}]` (one-off cash flows applied before growth), `terPct` (fund fee).
- **Fee drag** applied in `recalc()` — `returnRate = a·(investReturn − terPct) + (1−a)·savingsReturn` — so `engine.js` stays fee-agnostic. The "lost to fees over your lifetime" readout reruns fee-free and compares **terminal** wealth (comparing at retirement inverts, because the fee-free run retires earlier and is already drawing down).
- Life events: `renderEvents()` rebuilds `#events-list` on add/remove/restore (never per keystroke); `parseSignedNum` allows negative outlays.
- Chart: x-axis is age; draw phase colours amber via `dataset.segment.borderColor` reading `chart.$drawStart`; `eventMarkerPlugin` draws ▲/▼ markers from `chart.$events`; `#lifecycle-note` shows survive/deplete.
- The amber decumulation line **flat-lines at exactly €0** if the pot depletes before the horizon — that's real, meaningful data (confirmed via `runProjection`, not a rendering bug), documented via the chart card's `data-tip` rather than removed (v2.3 chart declutter, #8).

## Risk engine (v1.8)

- `runProjection` accepts `s.sequence` (`[{ret,infl}]` per-year rates; runs nominal, ignores the real toggle) and `s.wdStrategy` (`'fixed'`|`'gk'`|`'vpw'`). Deterministic path (no sequence, `'fixed'`) is **byte-for-byte unchanged**. `cumInfl` unifies nominal spending/FI scaling.
- **Guyton-Klinger** (`gk`): skip the inflation raise after a loss year; cut/raise spending 10% when the current rate drifts ±20% off the initial rate. **VPW** (`vpw`): withdraw `wr%` of the current pot (never depletes).
- `mulberry32(seed)` → reproducible `runMonteCarlo(s,N,seed)` (bootstrap-resample `HIST`; returns `{successRate, bands:[{age,p10,p50,p90}]}`) and `runHistorical(s,startYear)` (exact replay, wraps past 2023).
- **`recalc()` always computes the deterministic `det`** for KPIs/gauge/milestones; `renderChart(det)` switches the chart by `state.projMode`.
- steady/history draw one path in dataset 0 (bands hidden); Monte Carlo hides dataset 0, reveals the p90/p10(`fill:'-1'`)/p50 band datasets, shows the `#mc-success` badge, runs the debounced (250 ms) `runAndDrawMonteCarlo`. The `_band90` series is hidden from the legend via a label filter.

## NL tax layering (v1.9)

- Second bucket, the **Box-1 pension pot** (`state.pensionPot` + `pensionContrib`, pijler 2/3), tracked as `PP` alongside the taxable `P`.
- Grows locked and **Box-3-free**, then **annuitizes at AOW age** (`pensionAge`) over `ANNUITY_YEARS` (20): `annuityGross = PP/20`, taxed each year by `box1Tax` (progressive ~19.07%/37%, 2026 approx).
- **Drawdown order** in retirement: AOW income (`pensionAmount`) + net Box-1 annuity fund spending first; the taxable Box-3 pool covers only the remainder (so it shrinks, lowering Box 3).
- Every data point carries `pp` (pot balance; 0 after annuitization). Deterministic path byte-for-byte unchanged when `pensionPot=0 && pensionContrib=0`.
- The pot itself has **no chart line** (removed in v2.3 — see **Chart** below); it still fully drives tax/drawdown math, just isn't plotted.

## Cockpit UX (v2.0)

- **A/B compare**: `#btn-compare` toggles `compareOn` + a frozen `scenarioA = snapshotState()` (deterministic config, `returnRate` already fee-adjusted), saved to a separate LS key `fire-dashboard-scenario-a` and restored on boot.
- `renderChart` overlays scenario A on dataset **5** ("Scenario A", solid violet `#a78bfa`, dashed) in steady/history only (hidden in MC); the live line (dataset 0) relabels to "Scenario B" while `compareOn`, reverting to "Portfolio Value" on exit. `updateCompareReadout(det)` shows the A-vs-B FIRE-year delta in `#compare-readout`. (v2.3: dropped the separate `_A_FI` dataset that used to sit at index 7 — scenario A's own FI-target line was redundant chart clutter, not information users needed.)
- **Onboarding wizard**: pure DOM/CSS modal driven by `WIZARD_STEPS`; `renderWizardStep`/`wizardNext`/`wizardBack`/`finishWizard`; answers map through `applyConfig` (retire age → WR; risk → return+alloc).
- Auto-opens when `_firstRun` (no `LS_KEY` at boot); `#btn-wizard` re-opens it; Esc/Skip/click-outside close.
- `window.openWizard/finishWizard/toggleCompare` exposed for tests; tests dismiss the auto-opened wizard + exit compare in `resetBaseline`.

## Net-Worth CAGR mode (v2.2)

- `state.growthModel` (`'income'` | `'cagr'`) lets the user type a single compound annual growth rate instead of decomposing income/spending/return.
- In `runProjection`, CAGR mode zeroes the accumulation-phase `contrib` (a CAGR already bundles savings — adding `income − spending` on top would double-count it); `unattainable` is redefined as "growth can't outrun the FI target's own inflation" (`r ≤ inflation` nominal, `r ≤ 0` real), since there are no contributions to fall back on.
- Deterministic income-model path byte-for-byte unchanged when `growthModel` is absent or `'income'`.
- Tax and TER still apply on top of the typed rate (treated as gross) — `app.js`'s `recalc()` sets `state.returnRate = cagrPct − terPct` in CAGR mode instead of the blended formula. Asset Allocation is dimmed (`.model-dimmed` on `#group-alloc`) in CAGR mode since v2.3 — Box 3 now uses its own dedicated Savings/Investments/Debts split (see **Tax**), so the allocation slider has no effect on either the return or the tax in this mode.
- `solveCagrForAge(s, targetAge)`: 40-step bisection on the real sim (not a closed form, so it stays correct under tax/TER) finding the minimum CAGR reaching FI by a target age — powers the "🎯 FIRE by age" reverse-solver row and its `Use ✓` button.
- `impliedCagr(proj, startPortfolio)` backs out the compound rate the *income* model's own accumulation phase achieves, shown as an always-visible bridge readout (`#cagr-implied`) so both models can be sanity-checked against each other.
- Monte Carlo and History are disabled in CAGR mode (their injected `sequence` would silently override the typed rate) — `applyGrowthModelUI()` dims/disables them and forces `projMode: 'steady'`.
- `snapshotState()` (A/B compare) carries `growthModel`/`cagrPct` so a frozen scenario replays under the right model.

## Pure-CSS tooltips

`.has-tip[data-tip]` uses `::after` (frosted card, `backdrop-filter: blur(10px)`) + `::before` (arrow) triggered on `:hover`/`:focus`. No JS. Add `tabindex="0"` to non-interactive elements; use `.tip-right` near the right edge. KPI elements have `aria-live="polite"`; the notice banner has `role="status" aria-live="assertive"`.

## Milestones

The `MILESTONES` array (in `ui.js`) drives `updateMilestones(portfolio, fi, currentAge, realReturn)`. Ladder (order in DOM): First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%). Coast FI uses `coastFiTarget(fi, currentAge, realReturn)` from `engine.js` — already inflation-aware (passes real return = nominal − inflation; higher inflation raises the Coast FI target).

## localStorage

`saveState()` is called at the end of every `recalc()`. On boot, `loadState()` runs before the first `recalc()` and calls `applyConfig(cfg)` — the same helper used by `importConfig()`. The `DEFAULTS` const holds the seed values. `resetSavedData()` applies `DEFAULTS`, calls `recalc()` (which re-saves via `saveState()`), then *removes* the LS key — order is deliberate so the key ends up absent after the reset.

## Reset confirm (two-step)

`#btn-reset` uses an arm-then-confirm flow: first click arms the button (adds the `.armed` class, changes label to "⚠️ Click again to confirm", starts a 3 s timer); second click within 3 s calls `resetSavedData()`; ignoring it auto-disarms via `_disarmReset()`. `window._state`, `window._LS_KEY`, `window.resetSavedData`, `window.importConfig`, `window._disarmReset` are exposed at boot for integration tests.

## Export / Import

- `exportConfig()` serialises `state` to JSON and triggers a download. `importConfig(file)` validates guards, then calls `applyConfig(cfg)` + `recalc()`.
- New config fields `investReturn, savingsReturn, allocInvest` replace raw `returnRate`; backward-compat in `applyConfig()` treats old configs with `returnRate` and no `investReturn` as 100% invested, so their projection is preserved.
- **Import guards** — `importConfig(file)` rejects *before* `FileReader` if `file.size > 100 KB`, or if type is not `application/json | text/json | "" (empty MIME)` **and** the name doesn't end in `.json`. All three rejection paths share `showImportError(msg)`.
- **PDF export (v2.3)** — `#btn-export` opens a small dropdown (`#export-menu`: JSON / PDF) instead of exporting directly; `exportConfig()` itself is unchanged. PDF path: `buildPrintSnapshot()` (store.js) fills `#print-snapshot` (headline KPIs, `chart.toBase64Image()`, key assumptions), then `printSnapshot()` calls `window.print()`. `#print-snapshot` is `display:none` normally and only shown under `@media print` (standard `visibility:hidden`-on-body / `visibility:visible`-on-snapshot technique) — no PDF library, no new CDN origin. The export button suppresses its own `.has-tip` tooltip via a `.menu-open` class while the dropdown is open (the mouse is still resting on the button right after the click that opened it, which would otherwise cover the menu).

## Help modal (v2.3)

- `#btn-help` (left of Reset) opens `#help-overlay`, mirroring the wizard overlay's show/hide + Esc/overlay-click/close-button dismiss pattern (`openHelp(tabKey)` / `closeHelp()`).
- Tab content lives in the `HELP_TABS` array in `app.js` — each section's `tip` is a **verbatim copy** of the matching `data-tip` string in `index.html`, plus a short `extra` explanation. Keep the two in sync by hand when editing either; there's no automated link between them.
- A few cross-referenced readouts (`#lifecycle-note`, `#cagr-implied`, the chart `panel-title`) carry a `.help-learn-more` button that deep-links to the matching tab. These sit as **siblings**, not children, of the has-tip element — `.has-tip::after` is CSS-generated content (`content: attr(data-tip)`) and can't host a real clickable child. Not every tooltip in the app has one of these links (would require rebuilding the whole tooltip system as real DOM); the Help button itself is always one click away instead (and pinned in the header — see below).

## Pinned Years-to-FIRE KPI (v2.3)

- `#years-fire-pin` lives inside the already-`position: sticky` header (not a separately-positioned fixed element — avoids tracking header height across the `flex-wrap` breakpoints). An `IntersectionObserver` on `#kpi-years-card` (boot section of `app.js`) toggles its `.visible` class; `recalc()` unconditionally mirrors `#kpi-years`/`#kpi-fire-year` text into it every pass, so content is always fresh even while hidden.
