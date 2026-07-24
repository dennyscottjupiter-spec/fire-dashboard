'use strict';
/* ══════════════════════════════════════════════════════════
   @file: shared assert/group/summary infrastructure. Loaded before
   engine.core.test.js/engine.risk.test.js and the integration.*.test.js
   files (see docs/FILEMAP.md for the full load order).
   Depends on: an #out <pre> and an #summary element in the page.
   ══════════════════════════════════════════════════════════ */
const out = document.getElementById('out');
let pass = 0, fail = 0;
let _done = false;

/* ── harness helpers ──────────────────────────────────────── */
function assert(label, ok, got, expected) {
  if (ok) {
    pass++;
    out.innerHTML += `<span class="pass">✅</span>  ${label}\n`;
  } else {
    fail++;
    out.innerHTML += `<span class="fail">❌</span>  ${label}\n       got      : ${JSON.stringify(got)}\n       expected : ${JSON.stringify(expected)}\n`;
  }
}
function group(name) { out.innerHTML += `\n<b style="color:#8a8a8a">${name}</b>\n`; }
function near(a, b, eps = 0.01) { return Math.abs(a - b) <= eps; }

function renderSummary() {
  if (_done) return;
  _done = true;
  const total = pass + fail;
  document.getElementById('summary').innerHTML =
    `${total} tests — <span class="pass">${pass} passed</span>` +
    (fail > 0 ? `, <span class="fail">${fail} failed</span>` : ' — all green 🎉');
  /* machine-readable one-liner — lets an automated reader grab the verdict
     from a single element or the tab title without parsing the whole page. */
  const line = fail === 0 ? `PASS ${pass}/${total}` : `FAIL ${fail}/${total} (passed ${pass})`;
  const sumEl = document.getElementById('test-summary');
  if (sumEl) sumEl.textContent = line;
  document.title = `${line} — FIRE Tests`;
}

/* global error/rejection → count as failed test, always resolve */
window.addEventListener('error', ev => {
  fail++;
  out.innerHTML += `<span class="fail">❌</span>  [uncaught error] ${ev.message} (${ev.filename}:${ev.lineno})\n`;
});
window.addEventListener('unhandledrejection', ev => {
  fail++;
  out.innerHTML += `<span class="fail">❌</span>  [unhandled rejection] ${String(ev.reason)}\n`;
});

/* watchdog: if integration never finishes, force renderSummary after 45 s.
   The suite has grown to 250+ tests with many deliberate async waits (Monte Carlo
   debounce, FileReader imports, reset flush) — 45 s leaves headroom on slow machines
   while still catching a genuine hang. */
const _watchdog = setTimeout(() => {
  fail++;
  out.innerHTML += `<span class="fail">❌</span>  [watchdog] Integration tests did not complete within 45 s\n`;
  renderSummary();
}, 45000);
