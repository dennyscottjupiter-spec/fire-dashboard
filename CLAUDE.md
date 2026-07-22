# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Shell preference

**Prefer PowerShell; avoid the Bash tool.** Run terminal commands via PowerShell by default. Only use Bash when a task genuinely needs POSIX-only syntax that PowerShell can't express cleanly. The Bash tool is flaky on this Windows machine (fork/permission errors, zombie `bash.exe` processes).

## Running the app

No build step. Open `index.html` directly in a browser. After CSS edits, use **Ctrl+Shift+R** (hard refresh) — the browser caches stylesheets aggressively on `file://`.

Chart.js 4 is loaded from CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.3`) with an **SRI integrity hash** and `crossorigin="anonymous"`. No npm, no node_modules, no package.json. The app degrades gracefully if the CDN is unavailable or the hash mismatches (KPIs/inputs still work, chart panel shows a friendly message).

A **Content-Security-Policy** `<meta>` restricts scripts to `'self' + cdn.jsdelivr.net`, styles to `'self' + 'unsafe-inline'` (required for static `style="display:none"` attributes), **font-src `'self'`** (for Inter), and blocks all other origins.

**Typography** — Inter variable font (rsms/inter v4.1, SIL OFL) is self-hosted in `fonts/InterVariable.woff2`. Both `--sans` and `--mono` CSS tokens point to Inter; Segoe UI / system-ui are fallbacks. `font-variant-numeric: tabular-nums` keeps numbers aligned without a separate monospace face.

Open `tests/tests.html` **via a local http server** to run the full test suite — integration tests need a same-origin iframe (file:// blocks cross-frame access). Quick start: `python -m http.server 8000` → open `http://localhost:8000/tests/tests.html`. Engine unit tests (116, synchronous) run on `file://` too — including the v1.8 risk engine, the v1.9 Box-1 pension pot, and the v2.2 Net-Worth CAGR growth model + solvers. Integration tests drive every input, the gauge, blend, import guards, localStorage round-trip, milestones, two-step reset, the annual tax readout, the v1.7 lifecycle controls, the v1.8 risk UI, the v1.9 pension pot, the v2.0 cockpit (A/B compare, onboarding wizard), and the v2.2 Growth Model toggle (CAGR block, reverse solver, implied-CAGR bridge, MC/History disablement). Full suite is **312 tests**; the integration watchdog is 45 s. The harness is bulletproof: file:// early-exit, try/catch/finally + 25 s watchdog + global error/rejection listeners + per-section try/catch — a hang is structurally impossible.

**Test file layout (v2.1)** — the suite is split out of the HTML into modules under `tests/`: `tests.html` is a thin shell that loads `harness.js` (assert/group/near/`renderSummary`/watchdog) → `engine.test.js` (116 unit tests) → `integration.test.js` (196 iframe tests). `renderSummary()` also writes a machine-readable one-liner (`PASS 312/312` / `FAIL n/312`) to a `#test-summary` element **and** `document.title` — so a headless reader can grab the verdict without parsing the whole log. The 116 engine tests can also be run headlessly under Node via a stdlib `vm` DOM-shim (no npm); integration self-skips there because `location.protocol` reads `file:`.

> **Dev caching gotcha:** Chrome heuristic-caches `file://`-style local resources; the plain `python -m http.server` sends no `Cache-Control`, so edited `js/engine.js`/`js/app.js` can be served stale (undefined fields, old test counts). Fix once with a hard reload (Ctrl+Shift+R evicts the poisoned entries), or serve with `Cache-Control: no-store` during a build session.

## Architecture

Files are organized into folders (v2.1) — `index.html` stays at repo root (double-click still works); JS in `js/`, CSS in `css/`, the test suite in `tests/`:

- `index.html` — markup only; all IDs wired to `els` in `js/app.js`. Links `css/base.css` + `css/components.css`; loads `js/{data,engine,ui,store,app}.js`.
- `css/base.css` — foundation: `@font-face` for Inter, design tokens in `:root`, reset, typography, app shell, header chrome, main grid, panels. Loaded **before** components.
- `css/components.css` — widget layer: tooltips, inputs, sliders, toggles, timeline, projection bar, compare readout, wizard, KPIs, chart, milestones, gauge, allocation. Loaded **after** base; the cut is contiguous so the cascade equals the old single stylesheet.
- `fonts/InterVariable.woff2` — self-hosted Inter variable font (rsms/inter v4.1, SIL OFL). CSS `@font-face` references it as `../fonts/…`.
- `js/data.js` — **vendored historical dataset** (no DOM): `HIST` (S&P 500 total return + US CPI, 1926–2023) and `VINTAGES` (infamous crash start years). Load **before** engine.js.
- `js/engine.js` — **pure math only** (no DOM, no Chart): `parseNum`, `runProjection`, `box3Tax`, `box1Tax`, `customTax`, `coastFiTarget`, plus the risk engine `mulberry32`, `runMonteCarlo`, `runHistorical`. `runProjection` is a **two-phase lifecycle sim** (accumulate → decumulate to `longevityAge`, default 95) that also accepts an injected `sequence` and `wdStrategy`. Load before `ui.js` and `app.js`.
- `js/ui.js` — **view layer only** (no state, no persistence): `initChart`, `crossoverPlugin`, `buildGauge`, `updateGauge`, `MILESTONES`, `updateMilestones`. Reads `eur` and `els` from `app.js` globals (safe: only invoked at boot, after those consts initialize). Load after `engine.js`, before `store.js`/`app.js`.
- `js/store.js` — **state + persistence** (v2.1 split from app.js): the `state` object, `DEFAULTS`, `LS_KEY`, `applyConfig` (shared restore), `saveState`/`loadState`/`resetSavedData`, `exportConfig`/`importConfig`/`showImportError`. Pure definitions — they resolve `els`/`numFmt`/`recalc`/`renderEvents` from `app.js` only at call time (same boot-time forward-reference pattern as ui.js). Load after `ui.js`, before `app.js`.
- `js/app.js` — **controller**: DOM refs (`els`), formatters, `recalc()`, chart/gauge render, A/B compare, onboarding wizard, `bindRange`, rate steppers, life events, input wiring, two-step reset confirm, boot. Load last.
- `tests/` — the split suite: `tests.html` (thin shell) + `harness.js` + `engine.test.js` + `integration.test.js`. Open `tests.html` via http server for integration tests.

Load order: `js/data.js` → `js/engine.js` → `js/ui.js` → `js/store.js` → `js/app.js` (classic scripts, one shared global scope).

### Data flow (app.js)

Single `state` object → **`recalc()`** is the only heartbeat. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. Never update the UI piecemeal.

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

### Key invariants

**Chart** — `initChart()` runs once at boot (guarded by `chartReady` flag, both in `ui.js`). Always call `chart.update()` on the existing instance; never recreate it. Chart writes are skipped if CDN failed (`chartReady === false`). The `crossoverPlugin` (in `ui.js`) is an inline Chart.js plugin that draws the FI-crossover marker; it reads `chart.$fireYear` set in `recalc()`. All Chart.js font options use `Inter, "Segoe UI", sans-serif`.

**Rate inputs** — `bindRange(slider, box, sliderMax, [capMin, capMax])` wires any rate control. The box is the source of truth; `recalc()` reads `parseFloat(els.valReturn.value)`, not the slider. Hard caps: Return 50%, Inflation 50%, WR 20%, Savings 10%; slider track maxes are lower (15/10/10, no slider for savings) and pin visually when the typed value exceeds them. `box._lastValid` (on the DOM node, not a closure) stores the last valid value so macro clicks, stepper nudges, and imports all share one consistent revert value. `stepRate(boxId, delta)` nudges by 0.5; guards `if (slider)` before setting slider value so it works for slider-less boxes (`val-savings`). Wired to `ArrowUp`/`ArrowDown` on all rate boxes including `val-savings`.

**Asset allocation** — `state.investReturn` (investment return %) and `state.savingsReturn` (cash rate %) are split fields. `state.allocInvest` (0–100) is the % in investments; savings = 100−allocInvest. `state.returnRate` is derived in every `recalc()` via the blend formula; `engine.js` remains untouched. `RATE_CFG['val-savings']` has `slider: null`.

**Retirement Readiness gauge** — Speedometer dial built entirely in SVG/CSS with no extra libraries (`ui.js`). `buildGauge()` runs once at boot and injects into `#gauge-svg`: colored zone arcs (red 0–33% / amber 33–80% / green 80–100%), minor ticks every 10%, major ticks at 0/25/50/75/100%, numeric labels at r=94, and three FIRE milestone checkpoint flags (`.gauge-flag`) at Barista 50% / Lean FI 70% / Full FIRE 100%. The needle is a tapered `<polygon>` (not a `<line>`), hub is a two-circle chrome cap. `updateGauge(readiness)` sets `stroke-dashoffset = ARC_LEN · (1 − clamp(readiness, 0, 1))` and `rotate((c·180−90)deg)` on `#gauge-needle` (`transform-box: view-box; transform-origin: 100px 100px`). Colour ramp: red `<33%` → amber `<80%` → green `≥80%`. `ARC_LEN = π·80 ≈ 251.33`. `--amber: #f5a524` token in `:root`.

**€ inputs** — `type="text"` (not `type="number"` — browsers reject comma-formatted strings). `parseNum()` strips all non-digits before parsing. `numFmt.format()` (en-US, no symbol) writes `50,000` on blur. `eur.format()` (en-IE) writes `€750,000` — use en-IE, not de-DE (which gives `750.000 €`).

**Nominal vs Real mode** — controlled by `state.mode`. Nominal: both portfolio and FI target inflate each year. Real: FI target is fixed; portfolio uses `realReturn = (1+r)/(1+infl)-1`; contributions are deflated to today's purchasing power (`savings / (1+infl)^t`) so they don't overstate growth.

**Tax** — `state.taxMode` is `'none' | 'box3' | 'custom'`. Box 3 (NL 2026 model): split deemed returns — investments 6.0%, savings 1.28%, flat 36% rate, €59,357 threshold (single). Uses the *proportional method*: `deemed = P·a·6.0% + P·(1−a)·1.28%`; `taxableShare = (P−allowance)/P`; tax = `0.36 × deemed × taxableShare`. `box3Tax(P, t, infl, isReal, allocInvest)` — `allocInvest` param passes `state.allocInvest` from `runProjection`; omitting it defaults to 100% invest (backward-compat). Allowance is deflated in Real mode. Custom: `taxCustomPct`% applied to that year's investment gain only. Tax is subtracted *after* growth + contributions each year, inside `runProjection`. `runProjection` returns `firstYearTax` (year-1 tax under the active mode) → rendered to `#tax-annual-val` readout as "≈ €X est. tax this year".

**Lifecycle (v1.7)** — `runProjection` runs to `longevityAge` (95), retires at the FI crossing (accumulate → `phase:'draw'`), and returns `depleteAge` (age the pot first hits €0 in retirement, else null). Each `data` point carries `{year, age, portfolio, fi, phase}`. New default-guarded state: `currentAge`, `pensionAge`/`pensionAmount` (age-triggered income net off the withdrawal), `events[{age,amount,label}]` (one-off cash flows applied before growth), `terPct` (fund fee). **Fee drag** is applied in `recalc()` — `returnRate = a·(investReturn − terPct) + (1−a)·savingsReturn` — so `engine.js` stays fee-agnostic; the "lost to fees over your lifetime" readout reruns fee-free and compares **terminal** wealth (comparing at retirement inverts because the fee-free run retires earlier and is already drawing down). Life events: `renderEvents()` rebuilds `#events-list` on add/remove/restore (never per keystroke); `parseSignedNum` allows negative outlays. Chart: x-axis is age; draw phase colours amber via `dataset.segment.borderColor` reading `chart.$drawStart`; `eventMarkerPlugin` draws ▲/▼ markers from `chart.$events`. `#lifecycle-note` shows survive/deplete.

**Risk engine (v1.8)** — `runProjection` accepts `s.sequence` (`[{ret,infl}]` per-year rates; runs nominal, ignores the real toggle) and `s.wdStrategy` (`'fixed'`|`'gk'`|`'vpw'`). The deterministic path (no sequence, `'fixed'`) is byte-for-byte unchanged. `cumInfl` unifies nominal spending/FI scaling. **Guyton-Klinger** (`gk`): skip the inflation raise after a loss year; cut/raise spending 10% when the current rate drifts ±20% off the initial rate. **VPW** (`vpw`): withdraw `wr%` of the current pot (never depletes). `mulberry32(seed)` → reproducible `runMonteCarlo(s,N,seed)` (bootstrap-resample `HIST`, returns `{successRate, bands:[{age,p10,p50,p90}]}`) and `runHistorical(s,startYear)` (exact replay, wraps past 2023). **`recalc()` always computes the deterministic `det` for KPIs/gauge/milestones**; `renderChart(det)` switches the chart by `state.projMode`: steady/history draw one path in dataset 0 (bands hidden); Monte Carlo hides dataset 0, reveals the p90/p10(fill:'-1')/p50 band datasets, shows the `#mc-success` badge, and runs the debounced (250 ms) `runAndDrawMonteCarlo`. The `_band90` series is hidden from the legend via a label filter.

**Cockpit UX (v2.0)** — **A/B compare**: `#btn-compare` toggles `compareOn` + a frozen `scenarioA = snapshotState()` (deterministic config, `returnRate` already fee-adjusted), saved to a separate LS key `fire-dashboard-scenario-a` and restored on boot. `renderChart` overlays A on datasets **6** (A portfolio, dashed) + **7** (`_A_FI`, hidden from legend) in steady/history only (hidden in MC); `updateCompareReadout(det)` shows the A-vs-B FIRE-year delta in `#compare-readout`. **Onboarding wizard**: pure DOM/CSS modal driven by `WIZARD_STEPS`; `renderWizardStep`/`wizardNext`/`wizardBack`/`finishWizard`; answers map through `applyConfig` (retire age → WR; risk → return+alloc). Auto-opens when `_firstRun` (no `LS_KEY` at boot); `#btn-wizard` re-opens it; Esc/Skip/click-outside close. `window.openWizard/finishWizard/toggleCompare` exposed for tests; tests dismiss the auto-opened wizard + exit compare in `resetBaseline`.

**NL tax layering (v1.9)** — a second bucket, the **Box-1 pension pot** (`state.pensionPot` + `pensionContrib`, pijler 2/3), tracked as `PP` alongside the taxable `P`. It grows locked and **Box-3-free**, then **annuitizes at AOW age** (`pensionAge`) over `ANNUITY_YEARS` (20): `annuityGross = PP/20`, taxed each year by `box1Tax` (progressive ~19.07%/37%, 2026 approx). **Drawdown order** in retirement: AOW income (`pensionAmount`) + net Box-1 annuity fund spending first; the taxable Box-3 pool covers only the remainder (so it shrinks, lowering Box 3). Every data point carries `pp` (pot balance; 0 after annuitization). Deterministic path is byte-for-byte unchanged when `pensionPot=0 && pensionContrib=0`. UI: a violet dashed pension-pot line (dataset **5**) shown in steady/history when a pot is set, hidden in Monte Carlo.

**Net-Worth CAGR mode (v2.2)** — a second growth model, `state.growthModel` (`'income'` | `'cagr'`), lets the user type a single compound annual growth rate instead of decomposing income/spending/return. In `runProjection`, CAGR mode zeroes the accumulation-phase `contrib` (a CAGR already bundles savings — adding `income − spending` on top would double-count it); `unattainable` is redefined as "growth can't outrun the FI target's own inflation" (`r ≤ inflation` nominal, `r ≤ 0` real) since there are no contributions to fall back on. The deterministic income-model path is byte-for-byte unchanged when `growthModel` is absent or `'income'`. Tax and TER still apply on top of the typed rate (it's treated as gross) — `app.js`'s `recalc()` sets `state.returnRate = cagrPct − terPct` in CAGR mode instead of the blended formula; Asset Allocation stays live even in CAGR mode because it still drives the Box 3 deemed-return split. `solveCagrForAge(s, targetAge)` is a 40-step bisection on the real sim (not a closed form, so it stays correct under tax/TER) that finds the minimum CAGR reaching FI by a target age — powers the "🎯 FIRE by age" reverse-solver row and its `Use ✓` button. `impliedCagr(proj, startPortfolio)` backs out the compound rate the *income* model's own accumulation phase achieves, shown as an always-visible bridge readout (`#cagr-implied`) so both models can be sanity-checked against each other. Monte Carlo and History are disabled in CAGR mode (their injected `sequence` would silently override the typed rate) — `applyGrowthModelUI()` dims/disables them and forces `projMode: 'steady'`. `snapshotState()` (A/B compare) carries `growthModel`/`cagrPct` so a frozen scenario replays under the right model.

**Macro buttons** — each has `data-slider` and `data-val` attributes. On click, set both the slider, the box, and `box._lastValid`. `refreshMacroActive()` compares against the box value (not the slider).

**Pure-CSS tooltips** — `.has-tip[data-tip]` uses `::after` (frosted card, `backdrop-filter: blur(10px)`) + `::before` (arrow) triggered on `:hover`/`:focus`. No JS. Add `tabindex="0"` to non-interactive elements. Use `.tip-right` near the right edge. KPI elements have `aria-live="polite"`; the notice banner has `role="status" aria-live="assertive"`.

**Milestones** — `MILESTONES` array (in `ui.js`) drives `updateMilestones(portfolio, fi, currentAge, realReturn)`. Ladder (order in DOM): First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%). Coast FI uses `coastFiTarget(fi, currentAge, realReturn)` from `engine.js` — already inflation-aware (passes real return = nominal − inflation; higher inflation raises the Coast FI target).

**localStorage** — `saveState()` is called at the end of every `recalc()`. On boot, `loadState()` runs before the first `recalc()` and calls `applyConfig(cfg)` — the same helper used by `importConfig()`. `DEFAULTS` const holds the seed values. `resetSavedData()` applies `DEFAULTS`, calls `recalc()` (which re-saves via `saveState()`), then *removes* the LS key — order is deliberate so the key ends up absent after the reset.

**Reset confirm (two-step)** — `#btn-reset` uses an arm-then-confirm flow: first click arms the button (adds `.armed` class, changes label to "⚠️ Click again to confirm", starts a 3 s timer); second click within 3 s calls `resetSavedData()`; ignoring auto-disarms via `_disarmReset()`. `window._state`, `window._LS_KEY`, `window.resetSavedData`, `window.importConfig`, and `window._disarmReset` are exposed at boot for integration tests.

**Import guards** — `importConfig(file)` rejects before `FileReader` if `file.size > 100 KB` or type is not `application/json | text/json | "" (empty MIME)` and name doesn't end in `.json`. All three rejection paths share `showImportError(msg)`.

### Export / Import

`exportConfig()` serialises `state` to JSON and triggers a download. `importConfig(file)` validates guards, then calls `applyConfig(cfg)` + `recalc()`. New config fields: `investReturn, savingsReturn, allocInvest` (replaces raw `returnRate`). Backward-compat in `applyConfig()`: old configs with `returnRate` and no `investReturn` are treated as 100% invested so their projection is preserved.

## Git

Private repo: `github.com/dennyscottjupiter-spec/fire-dashboard`. Commit after every meaningful change; use named tags as version waypoints.

Tag history: `css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0 → security-csp-sri → readiness-gauge → return-split → integration-tests → v1.3.0 → pre-v1.4-baseline → speedometer-gauge → localstorage-reset → v1.4.0 → test-harness-fix → inter-font → ui-polish → reset-confirm → app-split → v1.5.0 → bugfix-gauge-reset → box3-2026-tax → typography-polish → v1.6.0 → v1.7.0` (lifecycle engine) ` → v1.8.0` (risk engine: Monte Carlo, historical replay, GK/VPW) ` → v1.9.0` (NL tax layering: Box-1 pension pot + drawdown order) ` → v2.0.0` (cockpit UX: A/B scenario compare + onboarding wizard) ` → v2.1.0` (repo restructure: `js/` + `css/` folders, test suite split into `tests/`, `app.js` → `store.js` + `app.js`, `styles.css` → `base.css` + `components.css`; no behavior change) ` → v2.2.0` (Net-Worth CAGR growth model + reverse solver + implied-CAGR bridge).

**v2.0 "Reality Engine" is complete** — four stacked feature branches (`feature/v1.7-lifecycle` → `v1.8-risk` → `v1.9-tax` → `v2.0-cockpit`), each tagged, none merged to master (awaiting user review). **v2.1 "structure"** (`feature/v2.1-structure` @ `v2.1.0`) stacks on top: a pure structural refactor (folders + file splits, zero behavior change). **v2.2 "Net-Worth CAGR"** (`feature/v2.2-cagr` @ `v2.2.0`) stacks on top of that: a second growth model (type a CAGR instead of income/spending/return) with a reverse FIRE-by-age solver — the cumulative build to test. None merged to master.

## v2.0 "Reality Engine" roadmap (in progress)

Four stacked feature branches, each shippable and tagged, **not merged to master** (branch off the previous level): `feature/v1.7-lifecycle` (v1.7.0, lifecycle) → `feature/v1.8-risk` (v1.8.0, Monte Carlo + historical replay + Guyton-Klinger/VPW withdrawals, `data.js` dataset) → `feature/v1.9-tax` (v1.9.0, NL Box 1 pension pot + drawdown order) → `feature/v2.0-cockpit` (v2.0.0, A/B scenarios + onboarding wizard). Load order gains `data.js` before `engine.js` at Level 2.
