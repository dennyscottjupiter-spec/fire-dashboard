---
title: Key invariants
description: The recalc() data-flow and every behavioral rule (chart, rates, tax, lifecycle, mode toggle, TER, spending, fullscreen). Read before editing js/ or css/, skip for pure doc/test work.
status: current
updated: 2026-08-08
---

# Key invariants

Detailed rules for `js/` and `css/`. Read this before editing either.
See also `docs/TESTING.md` (suite) and `docs/HISTORY.md` (release lineage). Per-file index + load order live in `docs/FILEMAP.md`; read that first for "which file has X" before opening whole files.

## Data flow (app.core.js)

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

- `initChart()` runs once at boot, guarded by the `chartReady` flag (both in `ui.chart.js`). Always `chart.update()` the existing instance; **never recreate it**.
- Chart writes skipped if CDN failed (`chartReady === false`).
- `crossoverPlugin` (`ui.chart.js`): inline Chart.js plugin drawing the FI-crossover marker; reads `chart.$fireYear`, set in `recalc()`.
- All Chart.js font options use `Inter, "Segoe UI", sans-serif`.
- **Fullscreen (v2.9)** — `#btn-chart-full` calls `toggleChartFullscreen()` (`app.chart.js`), which uses the native Fullscreen API on `#chart-panel` (`requestFullscreen()`/`exitFullscreen()`, `.catch(() => {})` guards a blocked request). A `fullscreenchange` listener (`app.boot.js`) flips `chart.options.maintainAspectRatio` (`false` while fullscreen so the canvas fills the viewport, `true` on exit), calls `chart.resize()`, and swaps the button glyph `⛶`/`✕`. Escape exits natively — no custom key handler, overlay, or scroll-lock. CSS: `.chart-panel:fullscreen` (in `components.kpi.css`) drops the canvas's `max-height: 300px` cap and switches to a flex column filling the screen.

## Rate inputs

- `bindRange(slider, box, sliderMax, [capMin, capMax])` wires any rate control.
- **Box is the source of truth**: `recalc()` reads `parseFloat(els.valReturn.value)`, not the slider.
- Hard caps: Return 50%, Inflation 50%, WR 20%, Savings 10%. Slider track maxes lower (15/10/10, no slider for savings) and pin visually when the typed value exceeds them.
- `box._lastValid` (on the DOM node, not a closure) stores the last valid value, so macro clicks, stepper nudges, and imports share one consistent revert value.
- `stepRate(boxId, delta)` derives rounding precision from `cfg.step` (default `0.5`, 1 decimal) — a box with `step < 0.1` (only `val-ter`, step `0.05`) rounds to 2 decimals instead, so a 0.05 nudge isn't rounded back to itself (v2.9 fix: hard-coding `.toFixed(1)` made the TER ▲/▼ steppers a no-op). Guards `if (slider)` before setting slider value so it works for slider-less boxes (`val-savings`, `val-ter`). Wired to `ArrowUp`/`ArrowDown` on all rate boxes.
- **Macro buttons** — each has `data-slider` and `data-val` attributes. On click, set both the slider, the box, and `box._lastValid`. `refreshMacroActive()` compares against the box value (not the slider).

## Asset allocation

- `state.investReturn` (investment return %) and `state.savingsReturn` (cash rate %) are split fields; `state.allocInvest` (0–100) is the % in investments, savings = 100−allocInvest.
- `state.returnRate` derived in every `recalc()` via the blend formula; `engine.js` remains untouched. `RATE_CFG['val-savings']` has `slider: null`.

## Retirement Readiness gauge

Speedometer dial built entirely in SVG/CSS, no extra libraries (`ui.gauge.js`).

- `buildGauge()` runs once at boot, injects into `#gauge-svg`: colored zone arcs (red 0–33% / amber 33–80% / green 80–100%), minor ticks every 10%, major ticks at 0/25/50/75/100%, numeric labels at r=94, three FIRE milestone checkpoint flags (`.gauge-flag`) at Barista 50% / Lean FI 70% / Full FIRE 100%.
- The needle is a tapered `<polygon>` (not a `<line>`); hub is a two-circle chrome cap.
- `updateGauge(readiness)` sets `stroke-dashoffset = ARC_LEN · (1 − clamp(readiness, 0, 1))` and `rotate((c·180−90)deg)` on `#gauge-needle` (`transform-box: view-box; transform-origin: 100px 100px`).
- Colour ramp: red `<33%` → amber `<80%` → green `≥80%`. `ARC_LEN = π·80 ≈ 251.33`. `--amber: #f5a524` token in `:root`.

## € inputs

- `type="text"`, not `type="number"` — browsers reject comma-formatted strings. `parseNum()` strips all non-digits before parsing.
- `numFmt.format()` (en-US, no symbol) writes `50,000` on blur; `eur.format()` (en-IE) writes `€750,000` — use en-IE, **not** de-DE (which gives `750.000 €`).

## Nominal vs Real mode

Controlled by `state.mode`, default **`'real'`** (v2.9 — was `'nominal'`; Real is lower but directly comparable to today's prices, so it's the honest default).

- Nominal: both portfolio and FI target inflate each year; contributions scale by `cumInfl` too.
- Real: FI target fixed; portfolio uses `realReturn = (1+r)/(1+infl)-1`; contributions stay in today's-€ terms (`savings`, no deflation).
- **Contributions track inflation in both modes** (v2.9 — previously only Real deflated them, so the two modes silently described different worlds: Real assumed a salary that never gets a raise, Nominal assumed a growing one). The accumulation-phase `contrib` in `runProjection` is `useReal ? savings : savings * cumInfl` — this preserves the exact identity `real[t] === nominal[t] / (1+i)^t` at every `t`, which `tests/engine.validation.test.js` guards.

## Tax

`state.taxMode` is `'none' | 'box3' | 'custom'`.

- Box 3 (NL 2026 model): split deemed returns — investments 6.0%, savings 1.28%, flat 36% rate, €59,357 threshold (single). No debt bucket (removed v2.5 — the user doesn't need it).
- **Re-coupled to `state.allocInvest`** (v2.5 — reverses the v2.3 decoupling): no manual € inputs. `runProjection` derives `box3Ratios = { savingsRatio: (100-alloc)/100, investRatio: alloc/100, debtRatio: 0 }` fresh each call from `state.allocInvest` (defaults to 100% invest if omitted, for backward-compat with old configs), and re-applies that fixed ratio to the grown taxable pool `P` every year.
- Uses the *proportional method*: `savings=P·savingsRatio`, `investments=P·investRatio`; `netWorth = savings+investments`; `deemed = savings·1.28% + investments·6.0%`; `taxableShare = (netWorth−allowance)/netWorth`; tax = `0.36 × max(0,deemed) × taxableShare` (0 if `netWorth ≤ allowance`).
- `box3Tax(P, t, infl, isReal, ratios)` — `ratios = {savingsRatio, investRatio, debtRatio}` (the function signature keeps `debtRatio` for backward-compat with its direct unit tests; `runProjection` always passes `0`). Omitting `ratios` entirely defaults to `{0, 1, 0}` (100% invest, no debt). Allowance deflated in Real mode.
- Because Box 3 now reads `allocInvest` again, it is **not** inert in CAGR mode when Box 3 is the active tax mode — `updateAllocDim()` (called from both `applyGrowthModelUI()` and `applyTaxMode()`) dims `#group-alloc` only when `growthModel==='cagr' && taxMode!=='box3'`; it stays live whenever Box 3 needs it, even in CAGR mode.
- Custom: `taxCustomPct`% applied to that year's investment gain only.
- **Box 3 peildatum (v2.10):** Dutch Box 3 taxes wealth on the **1-January balance**, not year-end wealth. `runProjection` captures `peilP = P` before life events/growth touch it each loop iteration and taxes that (`box3Tax(peilP, t-1, …)` — `t-1` because the peildatum is the *start* of year `t`, so the Real-mode allowance deflation exponent must be one year earlier). At `t=1` this is undeflated (`box3Tax(s.portfolio, 0, …)`), matching `runPerpetual` which already taxed `s.portfolio`. Custom tax is unaffected — still taxes the year's gain. `box3Breakdown(P, persons, allocInvest)` is the UI-facing companion (same four Belastingdienst steps), delegating the actual number back to `box3Tax` so it can't drift from the engine.
- Tax is subtracted *after* growth + contributions each year (the tax **base**, not the deduction timing, is what peildatum changed), inside `runProjection`, which returns `firstYearTax` (year-1 tax under the active mode) → rendered to the `#tax-annual-val` readout as "≈ €X est. tax this year".

## Lifecycle (v1.7)

- `runProjection` runs to `longevityAge` (95), retires at the FI crossing (accumulate → `phase:'draw'`), returns `depleteAge` (age the pot first hits €0 in retirement, else null). Each `data` point carries `{year, age, portfolio, fi, phase}`.
- New default-guarded state: `currentAge`, `pensionAge`/`pensionAmount` (age-triggered income net off the withdrawal), `events[{age,amount,label}]` (one-off cash flows applied before growth), `terPct` (fund fee, default **0.25%** since v2.9 — was 0.2%, matches the "ETF 0.25%" macro preset being lit on first load).
- **Fee drag** applied in `recalc()` — `returnRate = a·(investReturn − terPct) + (1−a)·savingsReturn` — so `engine.js` stays fee-agnostic. The "lost to fees over your lifetime" readout reruns fee-free and compares **terminal** wealth (comparing at retirement inverts, because the fee-free run retires earlier and is already drawing down).
- Life events: `renderEvents()` rebuilds `#events-list` on add/remove/restore (never per keystroke); `parseSignedNum` allows negative outlays.
- Chart: x-axis is age; draw phase colours amber via `dataset.segment.borderColor` reading `chart.$drawStart`; `eventMarkerPlugin` draws ▲/▼ markers from `chart.$events`; `#lifecycle-note` shows survive/deplete.
- The amber decumulation line **flat-lines at exactly €0** if the pot depletes before the horizon — that's real, meaningful data (confirmed via `runProjection`, not a rendering bug), documented via the chart card's `data-tip` rather than removed (v2.3 chart declutter, #8).

## Risk engine (v1.8)

- `runProjection` accepts `s.sequence` (`[{ret,infl}]` per-year rates) and `s.wdStrategy` (`'fixed'`|`'gk'`|`'vpw'`). Deterministic path (no sequence, `'fixed'`) is **byte-for-byte unchanged**. `cumInfl` unifies nominal spending/FI scaling. **Sequences honor the Real/Nominal toggle** (`useReal = s.mode === 'real'`, v2.6.1 fix — previously a sequence hard-coded nominal regardless of the toggle, so a Real-mode plan's History/Monte-Carlo chart silently disagreed with its own real-mode KPIs, and Box 3's fixed nominal allowance caused extra bracket-creep drag the KPIs never showed): in Real mode each sequence year is deflated by *that year's own* historical inflation, same formula as the steady path.
- **Guyton-Klinger** (`gk`): skip the inflation raise after a loss year; cut/raise spending 10% when the current rate drifts ±20% off the initial rate. **VPW** (`vpw`): withdraw `wr%` of the current pot (never depletes).
- `mulberry32(seed)` → reproducible `runMonteCarlo(s,N,seed)` (bootstrap-resample `HIST`; returns `{successRate, bands:[{age,p10,p50,p90}]}`) and `runHistorical(s,startYear)` (exact full-timeline replay, wraps past 2023 — kept for its own engine test, no longer used by the History chart mode).
- **`recalc()` always computes the deterministic `det`** for KPIs/gauge/milestones; `renderChart(det)` switches the chart by `state.projMode`.
- steady/history draw one path in dataset 0 (bands hidden); Monte Carlo hides dataset 0, reveals the p90/p10(`fill:'-1'`)/p50 band datasets, shows the `#mc-success` badge, runs the debounced (250 ms) `runAndDrawMonteCarlo`. The `_band90` series is hidden from the legend via a label filter.

### Interactive History (v2.7)

History mode no longer replays the *entire* timeline from a vintage year (that made a crash feel "random" — it always started at age-now). Instead the user **clicks the chart to place the crash at a chosen age**; before and after that window the plan runs on the user's own steady assumptions, and only the window itself replays real market data.

- `VINTAGES` entries (`js/data.js`) carry a hard-coded **11-year `returns` array** (crash year + 10 following years, exact nominal total returns) rather than a short crash-only window — a 2–4 year window captured the crash but cut off the big rebound years (e.g. 1933 `+54%`, 1935 `+48%`, 2002→2003 `+29%`), which in decumulation scenarios made the portfolio slide toward zero instead of recovering. All 5 vintages (1929, 1966, 1973, 2000, 2008) carry the full 11-year arc.
- `runHistoricalShock(s, startYear, shockAge, returns)` builds a **full-horizon** sequence: every year is the user's steady `{ret: returnRate, infl: inflation}` except the `returns.length` years starting at `t = shockAge − currentAge`, which push `{ret: returns[i], infl: HIST[idx0+i].infl}` — the hard-coded nominal return paired with that year's real historical CPI (so the Real/Nominal toggle still deflates correctly) — then calls `runProjection({ ...s, sequence })`, which honors `s.mode` like any other run (see Risk engine intro above). `runProjection` itself is untouched. An empty `returns` array = no shock window.
- `js/ui.chart.js`'s `initChart()` adds a **click handler** (`options.onClick`): active only when `state.projMode === 'history'`, it maps the click's x-pixel to a data index via `chart.scales.x.getValueForPixel(evt.x)`, clamps to `[1, horizon]`, and sets `state.shockAge = currentAge + index` before calling `recalc()`.
- `renderChart()` derives the shock age each render (`state.shockAge` if set, else `currentAge + 10` as a sane default before the user has clicked), calls `runHistoricalShock`, and sets `chart.$shock = { index, span: returns.length, label }` for the `shockMarkerPlugin` (sibling to `crossoverPlugin`/`eventMarkerPlugin`) to draw a shaded band (now spanning all 11 years) + boundary line + vintage label at that position. `chart.$shock` is reset to `null` outside History mode.
- `#vintage-select` + `#shock-age-readout` ("💥 Crash at age N · click the chart to move it") live inside `#event-sim`, a titled "🎬 Event Simulator" wrapper (v2.6.1) shown/hidden as one unit by `renderChart()` (`els.eventSim.style.display`) — visible only in History mode.
- `state.shockAge` persists (`null` = not yet clicked, falls back to the +10 default) via `saveState`/`applyConfig`/`exportConfig` in `js/store.js`.
- Test hooks: `window._chart`, `window.recalc`, and `window.runProjection` are exposed on `window` (classic-script `function` declarations attach to `window` automatically; `VINTAGES`/`HIST`/`chart` do not, since they're `const`/`let` — hence the explicit `window._chart` exposure) so integration tests can inspect `chart.$shock` and drive `recalc()` without a raw canvas click; the actual pixel-accurate click is verified visually (Chrome MCP), not by the node harness.

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
- Tax and TER still apply on top of the typed rate (treated as gross) — `app.core.js`'s `recalc()` sets `state.returnRate = cagrPct − terPct` in CAGR mode instead of the blended formula. Asset Allocation is dimmed (`.model-dimmed` on `#group-alloc`) in CAGR mode **only when Box 3 isn't the active tax mode** (see `updateAllocDim()` under **Tax**) — since v2.5 Box 3 reads `allocInvest` directly, so the slider must stay live and interactive whenever it's driving real tax math, even with CAGR typed in.
- `solveCagrForAge(s, targetAge)`: 40-step bisection on the real sim (not a closed form, so it stays correct under tax/TER) finding the minimum CAGR reaching FI by a target age — powers the "🎯 FIRE by age" reverse-solver row and its `Use ✓` button.
- `impliedCagr(proj, startPortfolio)` backs out the compound rate the *income* model's own accumulation phase achieves, shown as an always-visible bridge readout (`#cagr-implied`) so both models can be sanity-checked against each other — **hidden in Perpetual mode** (see below), since Perpetual's own build-up readout already tells that story.
- Monte Carlo and History are disabled in CAGR **and Perpetual** mode (their injected `sequence` would silently override the typed rate / derived real rate) — `applyGrowthModelUI()` dims/disables them and forces `projMode: 'steady'`.
- `snapshotState()` (A/B compare) carries `growthModel`/`cagrPct` so a frozen scenario replays under the right model. `updateCompareReadout()` and the chart's scenario-A overlay both branch on `scenarioA.growthModel === 'perpetual'` to call `runPerpetual` instead of `runProjection` when replaying a saved snapshot — otherwise a perpetual snapshot would be silently misread as an income-model one.

## Perpetual growth model (v2.5)

"How much capital funds my spending forever, adjusted for inflation, without ever running out?" `state.growthModel === 'perpetual'` is a third Growth-Model option, alongside `'income'` and `'cagr'`. No new inputs — it reuses the income-model blend (Asset Allocation / Investment Return / Savings Return / TER all stay **live**, unlike CAGR mode) and the existing Tax toggle.

- **Layered build-up**, computed by `perpetualCapital(s)`: gross `g = s.returnRate/100` (the fee-adjusted income-model blend) → after-tax nominal `n` → after-tax **real** `r` via the exact Fisher equation `r = (1+n)/(1+f) − 1` → required capital `capital = (I − allowanceBenefit) / r`, where `I = s.spending`.
- **Tax mapping reuses `state.taxMode`** (no dedicated Perpetual tax UI):
  - `box3` — wealth tax: `blendedDeemed = alloc·6.0% + (1−alloc)·1.28%` (same `alloc` as the Box 3 split); `drag = blendedDeemed × 36%`; `n = g − drag`. The €59,357 allowance is tax-free, so it funds `allowanceBenefit = BOX3.allowance × drag` €/yr of income for free, lowering the required capital.
  - `custom` — income tax: `n = g × (1 − taxCustomPct/100)`; `allowanceBenefit = 0`.
  - `none` — `n = g`; `allowanceBenefit = 0`.
- **If `r ≤ 0`** (after-tax growth can't outrun inflation), `perpetualCapital` returns `{ unreachable: true, capital: Infinity }` — no finite principal works. Surfaced as a warning (`#perp-warning`) in the UI.
- `perpetualSensitivity(s)` holds `g` and the tax layer fixed and re-derives `r`/`capital` across a 1–5% inflation sweep (v2.9 — was 0–4%; `capital: null` wherever that inflation alone would push `r ≤ 0`) — rendered as `#perp-sensitivity`.
- `runPerpetual(s)` returns the **same shape as `runProjection`** (`{ savings, savingsRate, fiTarget, yearsToFI, unattainable, data, firstYearTax, depleteAge }`) so the chart/KPI/gauge/milestone plumbing is reused unchanged. `fiTarget = perpetualCapital(s).capital`.
  - **Accumulation** (before reaching the target): simple real-terms compounding, `P = P·(1+r) + (income − spending)`, mirroring the income model's contribution but at the after-tax real rate `r`.
  - **Crossing**: `fiTarget` is an exact fixed point of the draw recursion (`r·capital + allowanceBenefit = I`) — on the year `P` first reaches it, `runPerpetual` **snaps `P` to exactly `fiTarget`** rather than carrying that year's overshoot forward, because the draw recursion amplifies any starting delta by `(1+r)` every subsequent year (unstable fixed point in the forward direction). Without the snap, "flat forever" would silently drift.
  - **Draw phase** (after reaching the target): `P = max(0, P·(1+r) + allowanceBenefit − I)` every year — flat by construction. `depleteAge` is always `null`.
  - `firstYearTax` is a representative one-year figure for the existing `#tax-annual-val` readout: `drag × portfolio` (wealth) or `customTax(portfolio × g, taxCustomPct)` (income); `0` for no tax.
- **`runProjection` is completely untouched** — Perpetual is a fully separate code path (`recalc()` picks `runPerpetual` vs `runProjection` based on `state.growthModel`), so the deterministic income-model path stays byte-for-byte identical.
- UI: `#perpetual-block` (mirrors `#cagr-block`) shows the build-up chain (`#perp-g → #perp-n → #perp-r → #perp-capital`), the active tax line, the sensitivity table, and the `r ≤ 0` warning, rendered by `renderPerpetual(pc, sens)`. FI Number KPI sub-label switches to "Capital for €I/yr, inflation-protected — forever". The fee-drag rerun and implied-CAGR bridge are both skipped (fees change the required capital itself, not just wealth at a fixed horizon — a like-for-like rerun doesn't apply the same way).

## Pure-CSS tooltips

`.has-tip[data-tip]` uses `::after` (frosted card, `backdrop-filter: blur(10px)`) + `::before` (arrow) triggered on `:hover`/`:focus`. No JS. Add `tabindex="0"` to non-interactive elements; use `.tip-right` near the right edge. KPI elements have `aria-live="polite"`; the notice banner has `role="status" aria-live="assertive"`.

## Milestones

The `MILESTONES` array (in `ui.gauge.js`) drives `updateMilestones(portfolio, fi, currentAge, realReturn)`. Ladder (order in DOM): First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%). Coast FI uses `coastFiTarget(fi, currentAge, realReturn)` from `engine.js` — already inflation-aware (passes real return = nominal − inflation; higher inflation raises the Coast FI target).

## localStorage

`saveState()` is called at the end of every `recalc()`. On boot, `loadState()` runs before the first `recalc()` and calls `applyConfig(cfg)` — the same helper used by `importConfig()`. The `DEFAULTS` const holds the seed values. `resetSavedData()` applies `DEFAULTS`, calls `recalc()` (which re-saves via `saveState()`), then *removes* the LS key — order is deliberate so the key ends up absent after the reset.

## Reset confirm (two-step)

`#btn-reset` uses an arm-then-confirm flow: first click arms the button (adds the `.armed` class, changes label to "⚠️ Click again to confirm", starts a 3 s timer); second click within 3 s calls `resetSavedData()`; ignoring it auto-disarms via `_disarmReset()`. `window._state`, `window._LS_KEY`, `window.resetSavedData`, `window.importConfig`, `window._disarmReset` are exposed at boot for integration tests.

## Export / Import

- `exportConfig()` serialises `state` to JSON and triggers a download. `importConfig(file)` validates guards, then calls `applyConfig(cfg)` + `recalc()`.
- New config fields `investReturn, savingsReturn, allocInvest` replace raw `returnRate`; backward-compat in `applyConfig()` treats old configs with `returnRate` and no `investReturn` as 100% invested, so their projection is preserved.
- **Import guards** — `importConfig(file)` rejects *before* `FileReader` if `file.size > 100 KB`, or if type is not `application/json | text/json | "" (empty MIME)` **and** the name doesn't end in `.json`. All three rejection paths share `showImportError(msg)`.
- **PDF export (v2.3)** — `#btn-export` opens a small dropdown (`#export-menu`: JSON / PDF) instead of exporting directly; `exportConfig()` itself is unchanged. PDF path: `buildPrintSnapshot()` (store.io.js) fills `#print-snapshot` (headline KPIs, `chart.toBase64Image()`, key assumptions), then `printSnapshot()` calls `window.print()`. `#print-snapshot` is `display:none` normally and only shown under `@media print` (standard `visibility:hidden`-on-body / `visibility:visible`-on-snapshot technique) — no PDF library, no new CDN origin. The export button suppresses its own `.has-tip` tooltip via a `.menu-open` class while the dropdown is open (the mouse is still resting on the button right after the click that opened it, which would otherwise cover the menu).

## Help modal (v2.3)

- `#btn-help` (left of Reset) opens `#help-overlay`, mirroring the wizard overlay's show/hide + Esc/overlay-click/close-button dismiss pattern (`openHelp(tabKey)` / `closeHelp()`).
- Tab content lives in the `HELP_TABS` array in `app.modals.js` — each section's `tip` is a **verbatim copy** of the matching `data-tip` string in `index.html`, plus a short `extra` explanation. Keep the two in sync by hand when editing either; there's no automated link between them.
- A few cross-referenced readouts (`#lifecycle-note`, `#cagr-implied`, the chart `panel-title`) carry a `.help-learn-more` button that deep-links to the matching tab. These sit as **siblings**, not children, of the has-tip element — `.has-tip::after` is CSS-generated content (`content: attr(data-tip)`) and can't host a real clickable child. Not every tooltip in the app has one of these links (would require rebuilding the whole tooltip system as real DOM); the Help button itself is always one click away instead (and pinned in the header — see below).

## About modal (v2.8)

- `#btn-about` (between Help and Reset) opens `#about-overlay`, reusing the `.help-overlay`/`.help-modal` classes (backdrop-click + Escape + close-button dismiss, same as Help) via `openAbout()`/`closeAbout()` in `app.modals.js`. No tabs — a single flat `.about-body` block.
- Version string is the `APP_VERSION` const in `app.modals.js` — the **only** place the version is hard-coded; bumping a release means editing that one line. `openAbout()` writes it into `#about-version` and renders `ABOUT_FEATURES` (max 3 one-liners) into `#about-features` on every open, so both always reflect the current constants even if the DOM was stale.
- The `thiago ab` byline in the left `<aside>` (`.app-byline`, directly under `.ls-note`) is static markup in `index.html` — not wired through JS, since it never changes at runtime.

## Spending impact readout (v2.9, moved into tooltip v2.10)

Surfaces the withdrawal-rate leverage on the FI target (a €1,000/yr spending change moves the FI number by 25× that at a 4% WR) so it isn't invisible in the UI. In `recalc()`, once `fiTarget` is known: `mult = 1/wr`, `delta = 1200/wr` (the €/yr impact of an extra €100/mo). **v2.10:** no longer a visible `#spending-impact` DOM line — appended to `els.tipSpending.dataset.tip`, rebuilt from the module-level `TIP_SPENDING_BASE` (captured once at load) every `recalc()` pass so the suffix never compounds on itself. `#slider-spending` mirrors `#input-spending` (writes `numFmt.format()` into the box then calls `recalc()`, same pattern as the euro-input boxes — `bindRange()` doesn't fit since it's percent/`parseFloat`-shaped); `recalc()` syncs the slider back from `state.spending` every pass so the two stay consistent regardless of which one was edited.

## Pinned Years-to-FIRE KPI (v2.3)

- `#years-fire-pin` lives inside the already-`position: sticky` header (not a separately-positioned fixed element — avoids tracking header height across the `flex-wrap` breakpoints). An `IntersectionObserver` on `#kpi-years-card` (boot section of `app.boot.js`) toggles its `.visible` class; `recalc()` unconditionally mirrors `#kpi-years`/`#kpi-fire-year` text into it every pass, so content is always fresh even while hidden.
