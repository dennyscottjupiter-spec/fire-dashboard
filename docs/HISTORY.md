# Release history

Private repo `github.com/dennyscottjupiter-spec/fire-dashboard`.

## Tag history

`css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0 → security-csp-sri → readiness-gauge → return-split → integration-tests → v1.3.0 → pre-v1.4-baseline → speedometer-gauge → localstorage-reset → v1.4.0 → test-harness-fix → inter-font → ui-polish → reset-confirm → app-split → v1.5.0 → bugfix-gauge-reset → box3-2026-tax → typography-polish → v1.6.0 → v1.7.0 → v1.8.0 → v1.9.0 → v2.0.0 → v2.1.0 → v2.2.0 → v2.2.1 → v2.2.2 → v2.2.3 → v2.2.4 → v2.2.5 → v2.2.6 → v2.3.0 → v2.3.1 → v2.4.0 → v2.5.0 → v2.5.1 → v2.6.0`

## v2.6.0 — File-size refactor for lower agent token-cost (zero behavior change)

Branch `refactor/split-large-files`, one atomic commit per area, merged to `master`. Every oversized file was split along its own existing section boundaries so an autonomous agent session can read just the piece it needs instead of the whole file — no logic changes anywhere, verified by the full 400-test suite + Chrome MCP visual smoke checks after every commit.

- `js/engine.js` (476→391 lines) → risk-engine functions (`mulberry32`/`runMonteCarlo`/`runHistorical`/`runHistoricalShock`) moved to new `js/engine.risk.js`.
- `js/ui.js` (376 lines) → `js/ui.chart.js` (Chart.js setup + drawing plugins) + `js/ui.gauge.js` (gauge + milestones).
- `js/store.js` (352 lines) → `js/store.js` (state/persistence) + `js/store.io.js` (export/import/PDF snapshot).
- `css/components.css` (1132 lines) → 6 ordered contiguous partials (`components.inputs/.toggles/.models/.chart/.kpi/.gauge.css`), loaded via ordered `<link>`s so the cascade stays byte-identical (verified by reconstructing the original file from the 6 partials programmatically).
- `js/app.js` (1206 lines, the biggest single file) → `app.core.js` (formatters/els/recalc/bindRange/rate stepper) + `app.chart.js` (chart renderer/Monte Carlo/growth-model UI) + `app.scenarios.js` (A/B compare/life events) + `app.modals.js` (wizard/Help modal) + `app.io.js` (export-menu helper/reset-confirm state) + `app.boot.js` (`wireInputs()` + every top-level listener + boot — the only file allowed to execute side effects on load, always loaded last).
- `tests/engine.test.js` (480 lines) → `engine.core.test.js` + `engine.risk.test.js`. `tests/integration.test.js` (1005 lines, one async IIFE around a single shared hidden iframe) → `integration.setup.js` (builds the iframe/helpers, then `await`s the next three files in order) + `integration.inputs/.projection/.features.test.js` (each just defines `window.runIntegration<Name>(ctx)`, no self-execution). Test count held at exactly 400 (157 engine + 243 integration) throughout.
- `explainer.html` (627→202 lines): inline `<style>`/`<script>` extracted to `css/explainer.css` / `js/explainer.js`; CSP `script-src` tightened to `'self'` now that no inline script remains.
- New `docs/FILEMAP.md` — the durable per-file index + load order, meant to be read before opening any individual source file. `CLAUDE.md` gained a "Targeted reads" rule pointing to it.

## v2.5.1 — Box 3 Single/Couple allowance fix + UI cleanup

Branch `feat/box3-couple-ux-cleanup`, merged to `master`:

- **Bugfix:** `runPerpetual()` ignored the €59,357 Box 3 allowance entirely, taxing the whole pot from €1. Fixed by threading a `persons` multiplier (1 = Single, 2 = Couple) through `box3Tax`, `perpetualCapital`, and `runPerpetual`. The app now defaults to **Couple** (€118,714 allowance) with a Single/Couple toggle in the Box 3 info panel; the engine still defaults to Single (persons=1) for back-compat with existing direct calls.
- Added per-button tooltips to the 3 Growth Model buttons (previously only the group label had one).
- Moved the Real Terms/Nominal toggle from the header into the chart toolbar, next to Steady/Monte Carlo/History — it only affects the chart.
- Wrapped "Costs & Income Timeline" in a collapsed-by-default `<details>` to declutter the left control panel.
- Test suite grew from 391 → 400 tests (157 engine + 243 integration).

## v2.5.0 — Perpetual model, interactive History, Box 3/Allocation re-coupling

Branch `feat/round5-perpetual-history-tax`, four atomic commits merged to `master`:

- `.gitignore` added — exported user financial data (`fire-config*.json`, `*.pdf`) can no longer land in the repo by accident.
- Box 3 simplified: the three manual Savings/Investments/Debts € inputs are gone; the savings/invest split is now derived from the existing Asset Allocation slider (re-coupling a v2.3 decoupling), and the deductible-debt bucket is removed entirely. `updateAllocDim()` keeps the allocation slider live in CAGR mode whenever Box 3 needs it.
- **Perpetual** growth model added — a third Growth Model option (alongside Income & Return and Net Worth CAGR) that computes the capital needed to draw an inflation-protected income forever: gross → after-tax → real (Fisher equation) → capital, reusing the existing Tax toggle, with an inflation-sensitivity table and an `r ≤ 0` "unreachable" warning.
- **History** mode reworked from a full-timeline replay into a click-to-place crash: click the chart to choose the age a crash hits; before/after that window the plan runs on steady assumptions, and only a per-vintage window replays the real historical sequence.
- Test suite grew from 339 → 391 tests (151 engine + 240 integration).

## v2.2.1–v2.4.0 — GitHub issue backlog clear-out

One session, all 9 open issues, each on its own branch → merged → tagged (so any tag is a clean rollback point):

- `v2.2.1` #6 wizard risk-choice label contrast fix
- `v2.2.2` #1 lifecycle-note tooltip · `v2.2.3` #3 implied-CAGR tooltip
- `v2.2.4` #8 chart declutter (dropped the Pension-pot line, documented the €0 depletion flat-line)
- `v2.2.5` #9 A/B compare renders as distinct "Scenario A"/"Scenario B" series, dropped the stray `_A_FI` dataset
- `v2.2.6` #5 Years-to-FIRE KPI pinned in the header on scroll (`IntersectionObserver`)
- `v2.3.0` #2 tabbed Help modal (`#btn-help`, reuses tooltip text verbatim)
- `v2.3.1` #4 PDF export option alongside JSON (print-optimized snapshot, no library)
- `v2.4.0` #7 Box 3 tax rebuilt as three dedicated buckets (Savings/Investments/Deductible debts), decoupled from the return-blend allocation slider

## Branch lineage

The v2.0 "Reality Engine" roadmap was built as four stacked feature branches, each shippable and tagged, each branched off the previous level:

- `feature/v1.7-lifecycle` (v1.7.0, lifecycle engine)
- `feature/v1.8-risk` (v1.8.0, risk engine: Monte Carlo, historical replay, Guyton-Klinger/VPW (GK/VPW) withdrawals, `data.js` dataset — at this Level 2 the load order gains `data.js` before `engine.js`)
- `feature/v1.9-tax` (v1.9.0, NL tax layering: Box 1 pension pot + drawdown order)
- `feature/v2.0-cockpit` (v2.0.0, cockpit UX: A/B scenarios compare + onboarding wizard)
- `feature/v2.1-structure` (v2.1.0, "structure": pure structural refactor — repo restructure into `js/` + `css/` folders, test suite split into `tests/`, `app.js` splits into `store.js` + `app.js`, `styles.css` into `base.css` + `components.css`; zero behavior change)
- `feature/v2.2-cagr` (v2.2.0, "Net-Worth CAGR": second growth model — type a CAGR instead of income/spending/return — with a reverse FIRE-by-age solver + implied-CAGR bridge; the cumulative build to test)

**All of it now lives on `master` @ v2.5.0** — those feature branches are gone; the old "stacked branches awaiting user review, none merged to master" convention no longer applies.
