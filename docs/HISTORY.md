# Release history

Private repo `github.com/dennyscottjupiter-spec/fire-dashboard`.

## Tag history

`css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0 → security-csp-sri → readiness-gauge → return-split → integration-tests → v1.3.0 → pre-v1.4-baseline → speedometer-gauge → localstorage-reset → v1.4.0 → test-harness-fix → inter-font → ui-polish → reset-confirm → app-split → v1.5.0 → bugfix-gauge-reset → box3-2026-tax → typography-polish → v1.6.0 → v1.7.0 → v1.8.0 → v1.9.0 → v2.0.0 → v2.1.0 → v2.2.0`

## Branch lineage

The v2.0 "Reality Engine" roadmap was built as four stacked feature branches, each shippable and tagged, each branched off the previous level:

- `feature/v1.7-lifecycle` (v1.7.0, lifecycle engine)
- `feature/v1.8-risk` (v1.8.0, risk engine: Monte Carlo, historical replay, Guyton-Klinger/VPW (GK/VPW) withdrawals, `data.js` dataset — at this Level 2 the load order gains `data.js` before `engine.js`)
- `feature/v1.9-tax` (v1.9.0, NL tax layering: Box 1 pension pot + drawdown order)
- `feature/v2.0-cockpit` (v2.0.0, cockpit UX: A/B scenarios compare + onboarding wizard)
- `feature/v2.1-structure` (v2.1.0, "structure": pure structural refactor — repo restructure into `js/` + `css/` folders, test suite split into `tests/`, `app.js` splits into `store.js` + `app.js`, `styles.css` into `base.css` + `components.css`; zero behavior change)
- `feature/v2.2-cagr` (v2.2.0, "Net-Worth CAGR": second growth model — type a CAGR instead of income/spending/return — with a reverse FIRE-by-age solver + implied-CAGR bridge; the cumulative build to test)

**All of it now lives on `master` @ v2.2.0** — those feature branches are gone; the old "stacked branches awaiting user review, none merged to master" convention no longer applies.
