# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. Vanilla-JS FIRE dashboard.

**Detail lives in `docs/` — read the relevant file before working in that area:**

- **`docs/INVARIANTS.md`** — the `recalc()` data flow + every key invariant (chart, rate inputs, macro buttons, asset allocation, gauge, € inputs, nominal/real, tax, lifecycle, risk engine, pension pot, cockpit, CAGR mode, tooltips, milestones, localStorage, reset confirm, export/import guards). **Read before editing `js/` or `css/`.**
- **`docs/TESTING.md`** — suite layout, counts, coverage, headless Node run, harness guarantees, dev caching gotcha. **Read before changing or running tests.**
- **`docs/HISTORY.md`** — tag history + v1.7→v2.2 branch lineage.

## Shell preference

- **Prefer PowerShell; avoid the Bash tool** — flaky on this Windows machine (fork/permission errors, zombie `bash.exe` processes).
- Bash only for POSIX-only syntax PowerShell genuinely can't express cleanly.

## Running the app

- **No build step** — open `index.html` directly in a browser.
- After CSS edits: **Ctrl+Shift+R** (hard refresh). Browsers cache stylesheets aggressively on `file://`.
- **Chart.js 4** from CDN `cdn.jsdelivr.net/npm/chart.js@4.4.3`, with **SRI integrity hash** + `crossorigin="anonymous"`. No npm, no node_modules, no package.json. Degrades gracefully if the CDN is unavailable or the hash mismatches: KPIs/inputs still work, chart panel shows a friendly message.
- **Content-Security-Policy `<meta>`** restricts scripts to `'self' + cdn.jsdelivr.net`, styles to `'self' + 'unsafe-inline'` (required for static `style="display:none"` attributes), **font-src `'self'`** (for Inter); blocks all other origins.
- **Typography** — Inter variable font (rsms/inter v4.1, SIL OFL) self-hosted in `fonts/InterVariable.woff2`. Both `--sans` and `--mono` point to Inter; Segoe UI / system-ui are fallbacks. `font-variant-numeric: tabular-nums` keeps numbers aligned without a separate monospace face.

## Tests

**312 tests** = 116 engine (synchronous, run on `file://` too) + 196 integration. Integration needs a same-origin iframe, so serve them: `python -m http.server 8000` → `http://localhost:8000/tests/tests.html`. Details in `docs/TESTING.md`.

## Architecture

Files organized into folders (v2.1); `index.html` stays at repo root (double-click still works).
**Load order** (classic scripts, one shared global scope): `js/data.js` → `js/engine.js` → `js/ui.js` → `js/store.js` → `js/app.js`.

- `index.html` — markup only; all IDs wired to `els` in `js/app.js`. Links `css/base.css` + `css/components.css`; loads `js/{data,engine,ui,store,app}.js`.
- `css/base.css` — foundation, loaded **before** components: `@font-face` for Inter, design tokens in `:root`, reset, typography, app shell, header chrome, main grid, panels.
- `css/components.css` — widget layer, loaded **after** base: tooltips, inputs, sliders, toggles, timeline, projection bar, compare readout, wizard, KPIs, chart, milestones, gauge, allocation. Cut is contiguous, so the cascade equals the old single stylesheet.
- `fonts/InterVariable.woff2` — self-hosted Inter variable font (rsms/inter v4.1, SIL OFL); `@font-face` references it as `../fonts/…`.
- `js/data.js` — **vendored historical dataset**, no DOM: `HIST` (S&P 500 total return + US CPI, 1926–2023), `VINTAGES` (infamous crash start years).
- `js/engine.js` — **pure math only** (no DOM, no Chart): `parseNum`, `runProjection`, `box3Tax`, `box1Tax`, `customTax`, `coastFiTarget`, plus risk engine `mulberry32`, `runMonteCarlo`, `runHistorical`. `runProjection` is a **two-phase lifecycle sim** (accumulate → decumulate to `longevityAge`, default 95) that also accepts an injected `sequence` and `wdStrategy`.
- `js/ui.js` — **view layer only** (no state, no persistence): `initChart`, `crossoverPlugin`, `buildGauge`, `updateGauge`, `MILESTONES`, `updateMilestones`. Reads `eur` and `els` from `app.js` globals — safe: only invoked at boot, after those consts initialize.
- `js/store.js` — **state + persistence** (v2.1 split from app.js): `state` object, `DEFAULTS`, `LS_KEY`, `applyConfig` (shared restore), `saveState`/`loadState`/`resetSavedData`, `exportConfig`/`importConfig`/`showImportError`. Pure definitions — they resolve `els`/`numFmt`/`recalc`/`renderEvents` from `app.js` only at call time (same boot-time forward-reference pattern as ui.js).
- `js/app.js` — **controller**, loaded last: DOM refs (`els`), formatters, `recalc()`, chart/gauge render, A/B compare, onboarding wizard, `bindRange`, rate steppers, life events, input wiring, two-step reset confirm, boot.
- `tests/` — `tests.html` (thin shell) + `harness.js` + `engine.test.js` + `integration.test.js`.

## The one rule that governs everything

Single `state` object → **`recalc()` is the only heartbeat**. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. **Never update the UI piecemeal.** Full pipeline in `docs/INVARIANTS.md`.

## Git

Private repo `github.com/dennyscottjupiter-spec/fire-dashboard`. Commit after every meaningful change; use named tags as version waypoints. Currently `master` @ v2.2.0 — see `docs/HISTORY.md`.
