# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Open `index.html` directly in a browser. After CSS edits, use **Ctrl+Shift+R** (hard refresh) — the browser caches stylesheets aggressively on `file://`.

Chart.js 4 is loaded from CDN (`cdn.jsdelivr.net/npm/chart.js@4.4.3`). No npm, no node_modules, no package.json.

## Architecture

Three files, no others:

- `index.html` — markup only; all IDs wired to `els` in app.js
- `styles.css` — design tokens in `:root`, no preprocessor
- `app.js` — all logic; runs in strict mode, no modules

### Data flow (app.js)

Single `state` object → **`recalc()`** is the only heartbeat. Every input event (slider, text box, toggle) calls `recalc()`, which reads all inputs, runs the math, and renders everything in one pass. Never update the UI piecemeal.

```
input event
  → update state fields (parseNum for € fields, parseFloat for rate boxes)
  → runProjection(state) → { savings, fiTarget, yearsToFI, data[] }
  → write KPIs, notice banner, chart.update(), milestones
```

### Key invariants

**Chart** — `initChart()` runs once at boot. Always call `chart.update()` on the existing instance; never recreate it (causes memory leak and animation glitch).

**Rate inputs** — `bindRange(slider, box, sliderMax, [capMin, capMax])` is the canonical way to wire any rate control. The box is the source of truth; `recalc()` reads `parseFloat(els.valReturn.value)`, not the slider value. Hard caps: Return 50%, Inflation 50%, WR 20%; slider track maxes are lower (15/10/10) and pin visually when the typed value exceeds them.

**€ inputs** — `type="text"` (not `type="number"` — browsers reject comma-formatted strings). `parseNum()` strips all non-digits before parsing. `numFmt.format()` (en-US, no symbol) writes `50,000` on blur. `eur.format()` (en-IE) writes `€750,000` — use en-IE, not de-DE (which gives `750.000 €`).

**Nominal vs Real mode** — controlled by `state.mode`. Nominal: both portfolio and FI target inflate each year (`FI = FI * (1+infl)`). Real: FI target is fixed; portfolio uses `realReturn = (1+r)/(1+infl)-1`.

**Macro buttons** — each has `data-slider` and `data-val` attributes. On click, set both the slider and the corresponding value-box. `refreshMacroActive()` highlights the active macro by comparing against the box value (not the slider), so it stays correct when a typed value matches a preset.

**Pure-CSS tooltips** — `.has-tip[data-tip]` uses `::after` (card) + `::before` (arrow) triggered on `:hover`/`:focus`. No JS. Add `tabindex="0"` to any non-interactive element that needs a tooltip for keyboard/tap access. Use `.tip-right` on elements near the right edge to flip tooltip alignment.

### Export / Import

`exportConfig()` serialises `state` to JSON and triggers a download. `importConfig(file)` reads JSON and repopulates both the DOM controls and `state`, then calls `recalc()`. Import sets slider values clamped to track max AND box values unclamped so high typed values survive a round-trip.

## Git

Private repo: `github.com/dennyscottjupiter-spec/fire-dashboard`. Commit after every meaningful change; use named tags as version waypoints. Tag history: `css-foundation → html-structure → js-engine → v1.0.0 → finance-restyle → ux-tooltips-emojis → grouped-inputs-editable-rates → v1.1.0`.
