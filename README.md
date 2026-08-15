---
title: fire-dashboard
status: current
updated: 2026-08-15
---

# FIRE Dashboard

A single-page, browser-based calculator for planning Financial Independence / Retire Early (FIRE). You enter your current portfolio, income, spending, and a handful of market assumptions, and it projects when your investments will be large enough to cover your living costs forever — along with a retirement drawdown simulation, crash-scenario stress tests, and progress milestones.

Everything runs client-side. There is no backend, no account, and no data ever leaves your browser: your inputs are saved only in that browser's local storage.

## Setup (Windows)

**To just use the app:** nothing to install. You need a modern browser (Chrome, Edge, or Firefox) and, on first load only, an internet connection — the charting library (Chart.js) is pulled from a CDN and then cached by the browser.

**To run the automated test suite as well:** you need Python 3 on your PATH (any recent 3.x works; this project was verified against 3.14). Check with:

```powershell
python3 --version
```

There is no `npm install`, no `package.json`, and no build step of any kind — the app is plain HTML/CSS/JavaScript served (or opened) as-is.

## Usage

**Fastest way — just open it:**

```powershell
cd C:\Users\usuario\Claudinho\fire-dashboard
Start-Process index.html
```

This opens the dashboard directly in your default browser (`file://…/index.html`). Change any input on the left-hand Control Center panel — portfolio, income, spending, age, expected return, inflation, withdrawal rate, tax mode — and the entire dashboard (KPIs, chart, gauge, milestones) recalculates instantly, no submit button involved.

**Concrete example:** with the app's own defaults (€50,000 portfolio, €60,000/yr net income, €30,000/yr spending, age 30, 7% nominal return, 2% inflation, 4% safe withdrawal rate), the dashboard immediately shows an FI Number of €750,000 and a "Years to FIRE" countdown — try nudging the Yearly Spending slider down and watch the FI Number and years-to-FIRE both drop live.

**Running the test suite** (455 automated checks — engine math + UI integration): the integration tests need same-origin access to a hidden iframe, which `file://` blocks, so serve the folder over HTTP first:

```powershell
cd C:\Users\usuario\Claudinho\fire-dashboard
python3 -m http.server 8000
```

Then open `http://localhost:8000/tests/tests.html` in a browser. The page runs automatically and reports a `PASS 455/455` (or `FAIL n/455`) line, both on-page and in the browser tab title. Stop the server afterward with Ctrl+C (or close the PowerShell window/process) — this machine only tolerates one background process at a time.

If you edit the JS/CSS and results look stale, hard-refresh (Ctrl+Shift+R) — `python -m http.server` sends no cache-control headers, so Chrome can silently serve an old cached copy.

## Outputs

- **FI Number** — the portfolio size at which investment income alone covers your spending at your chosen safe withdrawal rate.
- **Retirement Readiness gauge** — your current portfolio as a percentage of the FI Number.
- **Years to FIRE** — a countdown plus your savings rate, pinned in the header once you scroll past the KPI row.
- **Portfolio Growth Projection chart** — three modes: a single steady-assumptions line, a Monte Carlo band (1,000 resampled market-history simulations with a survival percentage), or a "History" mode where you click the chart to place a real historical crash (1929, 1966, 1973, 2000, or 2008) at a chosen age and watch the full 11-year dip-and-recovery play out.
- **Milestones** — a checklist that lights up as your portfolio crosses First €100k, Coast FI, Barista FI (50%), Lean FI (70%), Full FIRE (100%), and Fat FIRE (150%).
- **Retirement drawdown** — once you cross the FI Number, the simulation continues drawing your portfolio down through retirement (to age 95 by default) and flags if/when it would run out of money under your chosen withdrawal strategy (fixed, Guyton-Klinger guardrails, or percentage-of-portfolio).
- **Export** — a JSON settings file (for backup/reload) or a one-page PDF snapshot of your plan (via the browser's print dialog), from the Export menu in the header.
- **Persistence** — every change auto-saves to that browser's local storage; the Reset button (two-click confirm) wipes it back to defaults.

## Limitations

- **Not financial or tax advice.** This is a simplified planning tool for exploring assumptions, not a substitute for a financial advisor.
- **Dutch tax model only.** The built-in tax modes are Box 3 (Netherlands wealth tax, 2026 rates) and a flat "Custom %" you type yourself; there is no tax logic for any other country. The AOW/pension-bridge fields (state pension age, workplace pension pot) also assume the Dutch two-pillar system. Non-Dutch users should stick to "None" or "Custom %" tax mode and treat the pension fields as optional.
- **Currency is fixed to euros** in the display (all figures render as `€`), though the underlying math is currency-agnostic if you just mentally substitute your own currency.
- **Historical/Monte Carlo data is US-only** — the Monte Carlo bootstrap and the five crash scenarios are drawn from a vendored S&P 500 total-return + US CPI dataset (1926–2023). They do not reflect non-US market behavior.
- **Simplifying assumptions baked into the math**: a fixed 95-year longevity horizon, constant assumed return/inflation outside of Monte Carlo/History modes, and — per the project's own documentation — real-market sequences replay exact historical years rather than modeling any other scenario space.
- **No accounts, no sync, no server storage.** Your plan lives only in the browser's local storage. Clearing browser data, using a different browser, or switching devices loses it unless you've exported a JSON backup first. Nothing is ever uploaded anywhere.
- **Single-scenario focus.** The "Compare" feature lets you snapshot one alternate scenario (A vs. B) side by side; it isn't built for comparing many scenarios at once.
