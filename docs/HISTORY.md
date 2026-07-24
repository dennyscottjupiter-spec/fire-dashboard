# Release history

Private repo `github.com/dennyscottjupiter-spec/fire-dashboard`.

## Tag history

`css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0 → security-csp-sri → readiness-gauge → return-split → integration-tests → v1.3.0 → pre-v1.4-baseline → speedometer-gauge → localstorage-reset → v1.4.0 → test-harness-fix → inter-font → ui-polish → reset-confirm → app-split → v1.5.0 → bugfix-gauge-reset → box3-2026-tax → typography-polish → v1.6.0 → v1.7.0 → v1.8.0 → v1.9.0 → v2.0.0 → v2.1.0 → v2.2.0 → v2.2.1 → v2.2.2 → v2.2.3 → v2.2.4 → v2.2.5 → v2.2.6 → v2.3.0 → v2.3.1 → v2.4.0 → v2.5.0`

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
