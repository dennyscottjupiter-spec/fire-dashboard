---
title: File map
description: Per-file index of every js/css/tests file with line counts and the exact script load order — read this to find WHICH file to open, never to read code.
status: current
updated: 2026-08-08
---

# File map

Read this **first** — before opening any individual `js/`, `css/`, or `tests/` file. Every file below carries its own `@map`/`@file` header with section line-numbers; this page is the index of *which file* has what, so you only open the one you need instead of reading whole files by default. See `docs/INVARIANTS.md` for behavior rules, `docs/TESTING.md` for suite details, `docs/HISTORY.md` for release lineage.

## Load order (classic scripts, one shared global scope)

`index.html`:
```
data.js → engine.js → engine.risk.js → ui.chart.js → ui.gauge.js →
store.js → store.io.js → app.core.js → app.chart.js → app.scenarios.js →
app.modals.js → app.io.js → app.boot.js
```
`css/base.css → components.inputs.css → .toggles.css → .models.css → .chart.css → .kpi.css → .gauge.css` (ordered `<link>`s — cascade depends on this exact order).

`tests/tests.html`:
```
data.js → engine.js → engine.risk.js → harness.js →
engine.core.test.js → engine.risk.test.js → engine.validation.test.js →
integration.inputs.test.js → integration.projection.test.js →
integration.features.test.js → integration.setup.js
```
The three `integration.*.test.js` files only *define* `window.runIntegration<Name>(ctx)` — `integration.setup.js` builds the shared hidden iframe + helpers, then `await`s all three **in that order**, and is the only file that calls `renderSummary()`.

**Hard rule:** all non-boot/non-setup `js/app.*.js` and `js/ui.*.js`/`store*.js` files are **pure definitions** — no top-level `addEventListener`, no side effects on load. `app.boot.js` is the only file allowed to attach listeners or run code at load time, so it must always load last.

## js/ (controller + view + engine + state)

| File | Lines | Purpose |
|---|---|---|
| `data.js` | 144 | Vendored historical S&P 500 + CPI dataset (`HIST`, `VINTAGES` — each with an 11-year hard-coded `returns` array, v2.7). No DOM. |
| `engine.js` | 393 | Pure math: `parseNum`, tax functions (`box3Tax`/`box1Tax`/`customTax`), `runProjection` (two-phase lifecycle sim — sequences honor the Real/Nominal toggle, v2.6.1), CAGR solver, Perpetual model (`perpetualCapital`/`runPerpetual`), `coastFiTarget`. No DOM, no Chart. |
| `engine.risk.js` | 100 | Risk engine: `mulberry32` (seedable PRNG), `runMonteCarlo`, `runHistorical`, `runHistoricalShock` (11-year hard-coded returns replay, v2.7). Depends on `HIST` + `runProjection`. |
| `ui.chart.js` | 279 | Chart.js setup (`initChart`) + drawing plugins (`crossoverPlugin`/`eventMarkerPlugin`/`shockMarkerPlugin`). |
| `ui.gauge.js` | 142 | Retirement Readiness gauge (`buildGauge`/`updateGauge`) + `MILESTONES`/`updateMilestones`. |
| `store.js` | 256 | `state` object, `DEFAULTS`, `applyConfig` (shared restore), `saveState`/`loadState`/`resetSavedData`. |
| `store.io.js` | 108 | `exportConfig`/`importConfig`/`showImportError`, PDF snapshot (`buildPrintSnapshot`/`printSnapshot`). |
| `app.core.js` | 409 | Formatters (`eur`/`numFmt`), DOM refs (`els`, incl. `eventSim`, v2.8 about-modal refs), `recalc()` — **the one heartbeat** — `bindRange`, rate stepper. |
| `app.chart.js` | 177 | `renderChart` (Steady/Monte Carlo/History — toggles `#event-sim` as one unit), `populateVintages`, Growth Model UI (`applyGrowthModelUI`/`renderPerpetual`/`updateAllocDim`). |
| `app.scenarios.js` | 115 | A/B scenario compare (`snapshotState`/`toggleCompare`/`updateCompareReadout`) + life events manager (`renderEvents`/`addEvent`). |
| `app.modals.js` | 233 | Onboarding wizard (`WIZARD_STEPS`/`renderWizardStep`/`finishWizard`) + Help modal (`HELP_TABS`/`renderHelpTabs`/`openHelp`) + About modal (`APP_VERSION`/`ABOUT_FEATURES`/`openAbout`, v2.8). |
| `app.io.js` | 30 | `closeExportMenu()` helper + two-step reset-confirm state (`_resetArmed`/`_disarmReset`). |
| `app.boot.js` | 339 | `wireInputs()` (all DOM event wiring) + every top-level listener + the boot sequence. **Loaded last.** Only file with side effects. |

## css/ (loaded in this exact order — cascade is byte-identical to the pre-split single stylesheet)

| File | Lines | Purpose |
|---|---|---|
| `base.css` | 279 | Foundation: `@font-face`, design tokens (`:root`), reset, typography, app shell, header, main grid, panels. |
| `components.inputs.css` | 236 | Tooltips, control groups, collapsible sections, euro inputs, rate display, steppers, sliders. |
| `components.toggles.css` | 209 | Macro buttons, tax toggle, costs/income timeline, life events, lifecycle note. |
| `components.models.css` | 140 | "Learn more" links, persons/strategy/growth-model toggles, Perpetual growth model. |
| `components.chart.css` | 321 | Projection mode bar, `.event-sim` titled wrapper (v2.6.1), Monte Carlo badge, A/B compare readout, onboarding wizard, Help modal, About modal (v2.8). |
| `components.kpi.css` | 169 | Dashboard column, KPI row/cards, notice banner, chart panel, milestones panel. |
| `components.gauge.css` | 168 | Retirement Readiness gauge, Asset Allocation controls, localStorage note, app byline (v2.8). |

## tests/ (445 tests = 191 engine + 254 integration)

| File | Lines | Purpose |
|---|---|---|
| `harness.js` | 57 | Shared `assert`/`group`/`near`/`renderSummary`/watchdog infrastructure. |
| `engine.core.test.js` | 424 | Pure-math tests: `parseNum`, tax functions, `runProjection` scenarios, `coastFiTarget`, Box-1 pension pot, CAGR mode, Perpetual model (130 asserts, 37 groups). |
| `engine.risk.test.js` | 105 | `mulberry32`, `runMonteCarlo`, `runHistorical`, `runHistoricalShock` (11-year hard-coded returns replay, v2.7), sequence real/nominal-toggle regression (v2.6.1), withdrawal strategies (38 asserts, 9 groups). Depends on `s1` etc. declared in `engine.core.test.js` (loaded first). |
| `engine.validation.test.js` | ~110 | v2.9 smoke/model-validation/data-integrity/backtest layer: closed-form parity, real≡deflated-nominal identity, degenerate zero-rate case, fee integrity, spending-leverage law, HIST data integrity, backtest CAGR + Trinity survival, realism gate on app defaults (23 asserts, 9 groups). Pure math — runs headless in Node too. |
| `integration.inputs.test.js` | 296 | Raw input-widget wiring: euro inputs, sliders/boxes, mode/tax buttons, macros, steppers, gauge, KPIs (67 asserts, 17 groups). Defines `window.runIntegrationInputs(ctx)` — doesn't self-execute. |
| `integration.projection.test.js` | ~295 | Notice banner, milestones, withdrawal strategy, Monte Carlo, History vintage (checks `#event-sim`, v2.6.1), Interactive History, TER fee + stepper regression + ETF macro (v2.9), pension bridge, life events, A/B compare, wizard (79 asserts, 13 groups). Defines `window.runIntegrationProjection(ctx)`. |
| `integration.features.test.js` | 366 | Import guards, localStorage round-trips, Reset button, Growth Model/CAGR/Perpetual toggles, Help modal, About modal (v2.8), Export dropdown (108 asserts, 19 groups). Defines `window.runIntegrationFeatures(ctx)`. |
| `integration.setup.js` | 159 | Builds the shared hidden iframe + DOM-driving helpers (`setVal`/`clickEl`/`text`/etc.) + `resetBaseline()`, packs them into `ctx`, then `await`s the three `integration.*.test.js` functions in order. Only file that calls `clearTimeout(_watchdog)`/`renderSummary()`. |
| `tests.html` | — | Thin shell; script tags define the load order above. |

## Root HTML

| File | Lines | Purpose |
|---|---|---|
| `index.html` | 701 | Markup only, all IDs wired to `els` in `app.core.js`. Already fully externalized (no inline script/style) — see its own `@map` header comment for section line-numbers. |

## Docs

`docs/INVARIANTS.md` (behavior rules) · `docs/TESTING.md` (suite layout) · `docs/HISTORY.md` (tag history) · this file (per-file index).
