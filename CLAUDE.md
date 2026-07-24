# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository. Vanilla-JS FIRE dashboard.

**Detail lives in `docs/` — read the relevant file before working in that area:**

- **`docs/FILEMAP.md`** — the per-file index (one-liner + line count per file) + exact script/stylesheet load order. **Read this FIRST**, before opening any individual `js/`/`css/`/`tests/` file — every file is small (most well under 300 lines) and carries its own `@map`/`@file` header with section line-numbers, so once FILEMAP.md points you at the right file you only need to open that one, not read whole directories.
- **`docs/INVARIANTS.md`** — the `recalc()` data flow + every key invariant (chart, rate inputs, macro buttons, asset allocation, gauge, € inputs, nominal/real, tax, lifecycle, risk engine, pension pot, cockpit, CAGR mode, tooltips, milestones, localStorage, reset confirm, export/import guards). **Read before editing `js/` or `css/`.**
- **`docs/TESTING.md`** — suite layout, counts, coverage, headless Node run, harness guarantees, dev caching gotcha. **Read before changing or running tests.**
- **`docs/HISTORY.md`** — tag history + v1.7→v2.2 branch lineage + v2.2.1→v2.4.0 issue-backlog tags + v2.5.0 (Perpetual model, interactive History, Box 3/Allocation re-coupling) + v2.6.0 (file-size refactor).

## Targeted reads

Every source file carries an `@map` (large files: section name + line number) or `@file` (small files: one-line purpose) header comment. **Read `docs/FILEMAP.md` first** to find which file has what, then `Read` (or `Grep`) only the file/section you actually need — don't read whole files or whole directories by default just to locate one function. This repo is frequently driven by autonomous agent sessions; every unnecessary full-file read burns real tokens for no benefit, since the split was specifically done to make this cheap.

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

**405 tests** = 162 engine (split across `engine.core.test.js` + `engine.risk.test.js`, synchronous, run on `file://` too) + 243 integration (split across `integration.inputs/.projection/.features.test.js`, orchestrated by `integration.setup.js`). Integration needs a same-origin iframe, so serve them: `python -m http.server 8000` → `http://localhost:8000/tests/tests.html`. Details in `docs/TESTING.md`; exact file-by-file layout in `docs/FILEMAP.md`.

**Every UI or projection-behavior change must be verified in the real browser via Chrome MCP (or Playwright) before it's called done** — click through the actual feature, read `chart`/`state`/DOM values live, don't just reason about the code or trust the test suite alone.

## Architecture

Files organized into folders (v2.1); further split file-by-file in v2.6.0 to keep every source file small (most well under 300 lines) — **see `docs/FILEMAP.md` for the full per-file index and exact load order**, read that before opening individual files. `index.html` stays at repo root (double-click still works).

- `index.html` — markup only; all IDs wired to `els` in `js/app.core.js`. Already fully externalized (no inline script/style).
- `css/` — `base.css` (foundation, loaded first) + 6 ordered `components.*.css` partials (inputs/toggles/models/chart/kpi/gauge). The cut is contiguous and load order is fixed, so the cascade is byte-identical to the old single `components.css`.
- `fonts/InterVariable.woff2` — self-hosted Inter variable font (rsms/inter v4.1, SIL OFL); `@font-face` references it as `../fonts/…`.
- `js/data.js` — **vendored historical dataset**, no DOM: `HIST` (S&P 500 total return + US CPI, 1926–2023), `VINTAGES` (infamous crash start years).
- `js/engine.js` — **pure math only** (no DOM, no Chart): `parseNum`, `runProjection`, `box3Tax`, `box1Tax`, `customTax`, `coastFiTarget`, Perpetual model. `runProjection` is a **two-phase lifecycle sim** (accumulate → decumulate to `longevityAge`, default 95) that also accepts an injected `sequence` and `wdStrategy`. `box3Tax` takes a `{savingsRatio, investRatio, debtRatio}` object (v2.3) — not a bare allocation %. Risk-engine functions (`mulberry32`/`runMonteCarlo`/`runHistorical`/`runHistoricalShock`) live in `js/engine.risk.js`, loaded right after.
- `js/ui.chart.js` / `js/ui.gauge.js` — **view layer only** (no state, no persistence): Chart.js setup + drawing plugins / gauge + milestones respectively. Read `eur`/`els` from `app.core.js` globals — safe: only invoked at boot, after those consts initialize.
- `js/store.js` / `js/store.io.js` — **state + persistence**: `state` object, `DEFAULTS`, `LS_KEY`, `applyConfig` (shared restore), `saveState`/`loadState`/`resetSavedData` / export/import/PDF snapshot respectively. Pure definitions — they resolve `els`/`numFmt`/`recalc`/`renderEvents` from `app.core.js` only at call time (same boot-time forward-reference pattern as `ui.*.js`).
- `js/app.core.js` / `.chart.js` / `.scenarios.js` / `.modals.js` / `.io.js` — **controller**, split into pure-definition feature modules: formatters/`els`/`recalc()`/rate wiring · chart renderer + growth-model UI · A/B compare + life events · onboarding wizard + Help modal · export-menu/reset-confirm helpers.
- `js/app.boot.js` — **loaded last**: `wireInputs()` (all DOM listener wiring) + every top-level side effect + the boot sequence. The only file allowed to execute code (not just define functions) at load time — this is what makes every other split file safely reorderable relative to each other.
- `tests/` — `tests.html` (thin shell) + `harness.js` + `engine.core.test.js` + `engine.risk.test.js` + `integration.setup.js` + `integration.inputs/.projection/.features.test.js`. See `docs/FILEMAP.md` for the exact load order (the three `integration.*.test.js` files must load before `integration.setup.js`, which calls them).

## The one rule that governs everything

Single `state` object → **`recalc()` is the only heartbeat**. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. **Never update the UI piecemeal.** Full pipeline in `docs/INVARIANTS.md`.

## Git

Private repo `github.com/dennyscottjupiter-spec/fire-dashboard`. Commit after every meaningful change; use named tags as version waypoints. Currently `master` @ v2.6.0 — see `docs/HISTORY.md`.
