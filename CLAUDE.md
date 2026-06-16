# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser. After CSS edits, use **Ctrl+Shift+R** (hard refresh) — the browser caches stylesheets aggressively on `file://`.

Chart.js 4 is loaded from CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.3`). No npm, no node_modules, no package.json. The app degrades gracefully if the CDN is unavailable (KPIs/inputs still work, chart panel shows a friendly message).

Open `tests.html` in a browser to run the in-browser unit test suite for `engine.js`.

## Architecture

Five files, no others:

- `index.html` — markup only; all IDs wired to `els` in app.js
- `styles.css` — design tokens in `:root`, no preprocessor
- `engine.js` — **pure math only** (no DOM, no Chart): `parseNum`, `runProjection`, `box3Tax`, `customTax`, `coastFiTarget`. Load this before `app.js`.
- `app.js` — state, DOM refs, chart, wiring, export/import, localStorage. Calls engine functions as globals.
- `tests.html` — in-browser assertions over `engine.js`; open directly to run.

### Data flow (app.js)

Single `state` object → **`recalc()`** is the only heartbeat. Every input event calls `recalc()`, which reads all inputs, runs the math via `runProjection(state)`, and renders everything in one pass. Never update the UI piecemeal.

```
input event
  → update state fields (parseNum for € fields, parseFloat for rate boxes)
  → runProjection(state) → { savings, fiTarget, yearsToFI, data[] }
  → write KPIs + FIRE-year pill + notice banner
  → chart.update() + crossover marker plugin
  → updateMilestones()
  → saveState() → localStorage
```

### Key invariants

**Chart** — `initChart()` runs once at boot (guarded by `chartReady` flag). Always call `chart.update()` on the existing instance; never recreate it. Chart writes are skipped if CDN failed (`chartReady === false`). The `crossoverPlugin` is an inline Chart.js plugin that draws the FI-crossover marker; it reads `chart.$fireYear` set in `recalc()`.

**Rate inputs** — `bindRange(slider, box, sliderMax, [capMin, capMax])` wires any rate control. The box is the source of truth; `recalc()` reads `parseFloat(els.valReturn.value)`, not the slider. Hard caps: Return 50%, Inflation 50%, WR 20%; slider track maxes are lower (15/10/10) and pin visually when the typed value exceeds them. `box._lastValid` (on the DOM node, not a closure) stores the last valid value so macro clicks, stepper nudges, and imports all share one consistent revert value. `stepRate(boxId, delta)` nudges by 0.5; also wired to `ArrowUp`/`ArrowDown` key events on each box.

**€ inputs** — `type="text"` (not `type="number"` — browsers reject comma-formatted strings). `parseNum()` strips all non-digits before parsing. `numFmt.format()` (en-US, no symbol) writes `50,000` on blur. `eur.format()` (en-IE) writes `€750,000` — use en-IE, not de-DE (which gives `750.000 €`).

**Nominal vs Real mode** — controlled by `state.mode`. Nominal: both portfolio and FI target inflate each year. Real: FI target is fixed; portfolio uses `realReturn = (1+r)/(1+infl)-1`; contributions are deflated to today's purchasing power (`savings / (1+infl)^t`) so they don't overstate growth.

**Tax** — `state.taxMode` is `'none' | 'box3' | 'custom'`. Box 3 (NL 2024): `0.36 × 0.0604` deemed-return tax on assets above €57k/yr; allowance is deflated in Real mode to stay comparable. Custom: `taxCustomPct`% applied to that year's investment gain only. Tax is subtracted *after* growth + contributions each year, inside `runProjection` in `engine.js`.

**Macro buttons** — each has `data-slider` and `data-val` attributes. On click, set both the slider, the box, and `box._lastValid`. `refreshMacroActive()` compares against the box value (not the slider).

**Pure-CSS tooltips** — `.has-tip[data-tip]` uses `::after` (frosted card, `backdrop-filter: blur(10px)`) + `::before` (arrow) triggered on `:hover`/`:focus`. No JS. Add `tabindex="0"` to non-interactive elements. Use `.tip-right` near the right edge. KPI elements have `aria-live="polite"`; the notice banner has `role="status" aria-live="assertive"`.

**Milestones** — `MILESTONES` array drives `updateMilestones(portfolio, fi, currentAge, realReturn)`. Ladder (order in DOM): First €100k → Coast FI → Barista FI (50%) → Lean FI (70%) → Full FIRE (100%) → Fat FIRE (150%). Coast FI uses `coastFiTarget(fi, currentAge, realReturn)` from `engine.js`.

**localStorage** — `saveState()` is called at the end of every `recalc()`. On boot, `loadState()` runs before the first `recalc()` and calls `applyConfig(cfg)` — the same helper used by `importConfig()`.

### Export / Import

`exportConfig()` serialises `state` to JSON and triggers a download. `importConfig(file)` calls `applyConfig(cfg)` then `recalc()`. Config fields: `portfolio, income, spending, returnRate, inflation, withdrawal, mode, taxMode, taxCustomPct, currentAge`.

## Git

Private repo: `github.com/dennyscottjupiter-spec/fire-dashboard`. Commit after every meaningful change; use named tags as version waypoints.

Tag history: `css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0 → tax-box3 → fire-milestones → chart-crossover → v1.2.0`.
