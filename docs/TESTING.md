# Testing

Read before changing or running the suite. Behaviour rules under test live in `docs/INVARIANTS.md`.

## Running

- Open `tests/tests.html` **via a local http server** — integration tests need a same-origin iframe (`file://` blocks cross-frame access). Quick start: `python -m http.server 8000` → `http://localhost:8000/tests/tests.html`.
- **400 tests** = **157 engine unit tests** (synchronous; also run on `file://`) + **243 integration tests** (iframe). Integration watchdog **45 s**.

## Coverage

- Engine tests cover the v1.8 risk engine, v1.9 Box-1 pension pot, v2.2 Net-Worth CAGR growth model + solvers, v2.5 Perpetual growth model (`perpetualCapital`/`perpetualSensitivity`/`runPerpetual`), v2.5 interactive History (`runHistoricalShock`).
- Integration tests drive every input, gauge, blend, import guards, localStorage round-trip, milestones, two-step reset, annual tax readout, v1.7 lifecycle controls, v1.8 risk UI, v1.9 pension pot, v2.0 cockpit (A/B compare, onboarding wizard), v2.2 Growth Model toggle (CAGR block, reverse solver, implied-CAGR bridge, MC/History disablement), v2.3 Help modal (open/close/tabs/learn-more deep-links), Export dropdown (JSON/PDF snapshot), v2.5 Box 3 derived from Asset Allocation (no manual € inputs, debt bucket removed), v2.5 Perpetual growth model toggle (build-up chain, sensitivity table, MC/History disablement, r≤0 warning), and v2.5 interactive History click-to-place (crash-age readout, `chart.$shock`).

## Layout (v2.1)

- Suite split out of the HTML into modules under `tests/`: `tests.html` thin shell loads `harness.js` (assert/group/near/`renderSummary`/watchdog) → `engine.test.js` (157) → `integration.test.js` (243).
- `renderSummary()` also writes a machine-readable one-liner (`PASS 312/312` / `FAIL n/312`) to a `#test-summary` element **and** `document.title` — headless readers grab the verdict without parsing the whole log.
- The 116 engine tests also run headlessly under **Node** via a stdlib `vm` DOM-shim (no npm); integration self-skips there because `location.protocol` reads `file:`.
- Harness is bulletproof: `file://` early-exit, try/catch/finally + **25 s watchdog** + global error/rejection listeners + per-section try/catch — a hang is structurally impossible.

## ⚠️ Dev caching gotcha

Chrome heuristic-caches `file://`-style local resources and plain `python -m http.server` sends no `Cache-Control`, so edited `js/engine.js`/`js/app.js` can be served stale (undefined fields, old test counts). Fix once with a hard reload (Ctrl+Shift+R evicts poisoned entries), or serve with `Cache-Control: no-store` during a build session.
