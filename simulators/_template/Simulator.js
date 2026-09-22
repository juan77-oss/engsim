/**
 * simulator.js — [SIMULATOR NAME]
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - Input reading
 *   - Core physics / engineering calculations
 *   - Output writing to the DOM
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css)
 *
 * THEORY NOTES:
 *   Document any formulas, standards, or sign conventions used.
 *   Especially note if your faculty's approach differs from textbooks.
 *   Example:
 *     Shear stress sign convention: Materials (Callister) — τ+ on +x face
 *     is counter-clockwise. This differs from Hibbeler (τ+ clockwise).
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/* ── DOM references ──────────────────────────────────────────── */
// Inputs
const inputExample = document.getElementById('input-example');
const selectExample = document.getElementById('select-example');
const btnCalculate  = document.getElementById('btn-calculate');

// Outputs
const outA = document.getElementById('out-a');
const outB = document.getElementById('out-b');
const outC = document.getElementById('out-c');

// Error slot
const errorEl = document.getElementById('sim-error');

/* ── Error helpers ───────────────────────────────────────────── */
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('is-visible');
}
function clearError() {
  errorEl.textContent = '';
  errorEl.classList.remove('is-visible');
}

/* ── Format helpers ──────────────────────────────────────────── */
function fmt(val, decimals = 2) {
  if (!isFinite(val)) return '—';
  return val.toFixed(decimals);
}

/* ── Core calculation ────────────────────────────────────────── */
/**
 * calculate()
 * Reads inputs, validates, runs physics, writes outputs.
 * Called on button click and on input change.
 */
function calculate() {
  clearError();

  // 1. Read inputs
  const val = parseFloat(inputExample.value);
  const mode = selectExample.value;

  // 2. Validate
  if (isNaN(val) || val <= 0) {
    showError('Please enter a valid positive value.');
    return;
  }

  // 3. Physics / calculations
  // ── Replace this block with your actual engineering logic ──
  const resultA = val * 2;          // example
  const resultB = val / Math.PI;    // example
  const resultC = Math.sqrt(val);   // example
  // ──────────────────────────────────────────────────────────

  // 4. Write outputs
  outA.textContent = fmt(resultA, 2);
  outB.textContent = fmt(resultB, 4);
  outC.textContent = fmt(resultC, 3);
}

/* ── Event listeners ─────────────────────────────────────────── */
// Button click
btnCalculate.addEventListener('click', calculate);

// Auto-recalculate on any input change (optional — remove if not wanted)
[inputExample, selectExample].forEach(el => {
  el.addEventListener('input', calculate);
});

/* ── Initial calculation on page load ───────────────────────── */
calculate();