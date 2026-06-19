# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser. After CSS edits, use **Ctrl+Shift+R** (hard refresh) — the browser caches stylesheets aggressively on `file://`.

Chart.js 4 is loaded from CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.3`) with an **SRI integrity hash** and `crossorigin="anonymous"`. No npm, no node_modules, no package.json. The app degrades gracefully if the CDN is unavailable or the hash mismatches (KPIs/inputs still work, chart panel shows a friendly message).

A **Content-Security-Policy** `<meta>` restricts scripts to `'self' + cdn.jsdelivr.net`, styles to `'self' + 'unsafe-inline'` (required for static `style="display:none"` attributes), **font-src `'self'`** (for Inter), and blocks all other origins.

**Typography** — Inter variable font (rsms/inter v4.1, SIL OFL) is self-hosted in `fonts/InterVariable.woff2`. Both `--sans` and `--mono` CSS tokens point to Inter; Segoe UI / system-ui are fallbacks. `font-variant-numeric: tabular-nums` keeps numbers aligned without a separate monospace face.

Open `tests.html` **via a local http server** to run the full test suite — integration tests need a same-origin iframe (file:// blocks cross-frame access). Quick start: `python -m http.server 8000` → open `http://localhost:8000/tests.html`. Engine unit tests (54, synchronous) run on `file://` too. Integration tests drive every input, the gauge, blend, import guards, localStorage round-trip, milestones, two-step reset, and the annual tax readout (Box 3 split-deemed-return). The harness is bulletproof: file:// early-exit, try/catch/finally + 25 s watchdog + global error/rejection listeners + per-section try/catch — a hang is structurally impossible.

## Architecture

Six files:

- `index.html` — markup only; all IDs wired to `els` in app.js
- `styles.css` — design tokens in `:root`, `@font-face` for Inter, no preprocessor
- `fonts/InterVariable.woff2` — self-hosted Inter variable font (rsms/inter v4.1, SIL OFL)
- `engine.js` — **pure math only** (no DOM, no Chart): `parseNum`, `runProjection`, `box3Tax`, `customTax`, `coastFiTarget`. Load before `ui.js` and `app.js`.
- `ui.js` — **view layer only** (no state, no persistence): `initChart`, `crossoverPlugin`, `buildGauge`, `updateGauge`, `MILESTONES`, `updateMilestones`. Reads `eur` and `els` from `app.js` globals (safe: only invoked at boot, after those consts initialize). Load after `engine.js`, before `app.js`.
- `app.js` — **controller**: state, DOM refs, `recalc()`, `bindRange`, rate steppers, `applyConfig`, localStorage, export/import, two-step reset confirm, boot. Load last.
- `tests.html` — in-browser assertions; open via http server for integration tests.

Load order: `engine.js` → `ui.js` → `app.js` (classic scripts, one shared global scope).

### Data flow (app.js)

Single `state` object → **`recalc()`** is the only heartbeat. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. Never update the UI piecemeal.

```
input event
  → update state fields (parseNum for € fields, parseFloat for rate boxes)
  → compute blend: state.returnRate = (allocInvest/100)·investReturn + (1-allocInvest/100)·savingsReturn
  → runProjection(state) → { savings, fiTarget, yearsToFI, data[], firstYearTax }
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

Tag history: `css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0 → security-csp-sri → readiness-gauge → return-split → integration-tests → v1.3.0 → pre-v1.4-baseline → speedometer-gauge → localstorage-reset → v1.4.0 → test-harness-fix → inter-font → ui-polish → reset-confirm → app-split → v1.5.0 → bugfix-gauge-reset → box3-2026-tax → typography-polish → v1.6.0`.
