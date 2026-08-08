---
title: Testing
description: Suite layout, test counts, how to run headless/browser, known flakes. Read before changing or running any test file.
status: current
updated: 2026-08-08
---

# Testing

Read before changing or running the suite. Behaviour rules under test live in `docs/INVARIANTS.md`.

## Running

- Open `tests/tests.html` **via a local http server** — integration tests need a same-origin iframe (`file://` blocks cross-frame access). Quick start: `python -m http.server 8000` → `http://localhost:8000/tests/tests.html`.
- **455 tests** = **195 engine unit tests** (synchronous; also run on `file://`) + **260 integration tests** (iframe). Integration watchdog **45 s**.

## Coverage

- Engine tests cover the v1.8 risk engine, v1.9 Box-1 pension pot, v2.2 Net-Worth CAGR growth model + solvers, v2.5 Perpetual growth model (`perpetualCapital`/`perpetualSensitivity`/`runPerpetual`), v2.7 interactive History (`runHistoricalShock`, 11-year hard-coded returns replay incl. dip→recovery regression + all-5-vintages length guard), v2.9 model-validation/backtest layer (`engine.validation.test.js`: closed-form parity, real≡deflated-nominal identity, degenerate zero-rate case, fee integrity, spending-leverage law, HIST data integrity, realized-CAGR + Trinity-survival backtests, realism gate on app defaults).
- Integration tests drive every input, gauge, blend, import guards, localStorage round-trip, milestones, two-step reset, annual tax readout, v1.7 lifecycle controls, v1.8 risk UI, v1.9 pension pot, v2.0 cockpit (A/B compare, onboarding wizard), v2.2 Growth Model toggle (CAGR block, reverse solver, implied-CAGR bridge, MC/History disablement), v2.3 Help modal (open/close/tabs/learn-more deep-links), Export dropdown (JSON/PDF snapshot), v2.5 Box 3 derived from Asset Allocation (no manual € inputs, debt bucket removed), v2.5 Perpetual growth model toggle (build-up chain, sensitivity table, MC/History disablement, r≤0 warning), v2.5 interactive History click-to-place (crash-age readout, `chart.$shock`), and v2.8 About modal (open/close via button, backdrop click, Escape).

## Layout (v2.6 — split for lower per-file token cost; see `docs/FILEMAP.md`)

- Suite split out of the HTML into modules under `tests/`: `tests.html` thin shell loads `harness.js` (assert/group/near/`renderSummary`/watchdog) → `engine.core.test.js` (incl. v2.10 peildatum + `box3Breakdown` guards) → `engine.risk.test.js` → `engine.validation.test.js` (195 engine total — incl. v2.6.1 sequence real/nominal regression guards, v2.7 11-year returns replay/dip-recovery/all-vintages guards, v2.9 model-validation/backtest layer) → `integration.inputs.test.js` / `integration.projection.test.js` / `integration.features.test.js` (260 asserts total, each just defines `window.runIntegration<Name>(ctx)` — none run standalone) → `integration.setup.js` (builds the shared hidden iframe + helpers, then `await`s the three integration files **in that order**, and is the only file that calls `renderSummary()`).
- `renderSummary()` also writes a machine-readable one-liner (`PASS 455/455` / `FAIL n/455`) to a `#test-summary` element **and** `document.title` — headless readers grab the verdict without parsing the whole log.
- The 195 engine tests also run headlessly under **Node** via a stdlib `vm` DOM-shim (no npm); integration self-skips there because `location.protocol` reads `file:`.
- Harness is bulletproof: `file://` early-exit, try/catch/finally + **25 s watchdog** + global error/rejection listeners + per-section try/catch — a hang is structurally impossible.

## ⚠️ Dev caching gotcha

Chrome heuristic-caches `file://`-style local resources and plain `python -m http.server` sends no `Cache-Control`, so edited `js/engine.js`/`js/app.js` can be served stale (undefined fields, old test counts). Fix once with a hard reload (Ctrl+Shift+R evicts poisoned entries), or serve with `Cache-Control: no-store` during a build session.

## ⚠️ Chrome MCP quirks (browser verification)

- **Mobile-viewport (≤480px) checks:** the Chrome extension's `resize_window` tool doesn't reliably change `window.innerWidth` — use Playwright MCP (`browser_resize` + `browser_navigate`) instead when verifying responsive layout.
- **`[watchdog] 45s timeout` on one integration group:** a known environmental flake tied to Chrome timer-throttling on this machine, not a code regression — it reproduces on unmodified `master` too, at a different `setTimeout`-based group each run. Re-run in a fresh tab; only treat it as a real bug if an actual assertion fails, not just the watchdog line itself.
