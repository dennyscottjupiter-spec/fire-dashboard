/* ============================================================
   FIRE Dashboard — app.io.js
   Controller, part 5/6: export-menu close helper + two-step reset
   confirm state. Pure definitions only (plus the harmless DOM-ref
   read `_btnReset`, same pattern as els in app.core.js) — no
   listener attachment here. Export/import/PDF LOGIC lives in
   store.io.js; the actual button wiring (which calls these) lives
   in app.boot.js, loaded LAST.
   @map: closeExportMenu L12 · reset-confirm state L16
   ============================================================ */

'use strict';

/* ── 11. Export/Import menu helper (listeners wired in app.boot.js) ── */
function closeExportMenu() {
  els.exportMenu.style.display = 'none';
  els.btnExport.classList.remove('menu-open');
}

// Two-step confirm: 1st click arms; 2nd click within 3 s actually resets.
// Automatically disarms if ignored (no accidental wipes).
let _resetArmed = false, _resetTimer = null;
const _btnReset = document.getElementById('btn-reset');

function _disarmReset() {
  _resetArmed = false;
  clearTimeout(_resetTimer);
  _btnReset.classList.remove('armed');
  _btnReset.textContent = '🗑 Reset';
}
