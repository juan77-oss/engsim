/**
 * simulator.js — Voltage Divider
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - DOM reading/writing, event wiring
 *   - Mode switching (Two-Resistor direct/design vs Series Chain)
 *   - Dynamic resistor list (add/remove) for chain mode
 *   - Validation (shake + scroll-to-error), matching the static-beam
 *     simulator's UX pattern
 *   - Chart.js rendering and the circuit diagram (diagram.js)
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Physics / formulas (→ core.js, pure, no DOM)
 *   - Diagram geometry (→ diagram.js, pure, returns SVG markup)
 *
 * DEPENDENCIES (loaded as a global via CDN in index.html):
 *   - Chart.js  → window.Chart
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import {
  calculateVoltageDivider,
  calculateVoltageDividerN,
  calculateResistorForVout,
  sweepVout
} from './core.js';

import { renderDirectDiagram, renderChainDiagram } from './diagram.js';
import { DEFAULTS, CHAIN, SWEEP_POINTS, CHART_COLORS } from './constants.js';

/* ══════════════════════════════════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════════════════════════════════ */

// Shared
const inputVin   = document.getElementById('input-vin');
const btnCalc     = document.getElementById('btn-calculate');
const errorEl     = document.getElementById('sim-error');
const chartCanvas = document.getElementById('sim-chart');
const chartLabel  = document.getElementById('chart-label');
const diagramContainer = document.getElementById('circuit-diagram');

// Mode tabs
const tabDirect = document.getElementById('tab-direct');
const tabChain  = document.getElementById('tab-chain');
const panelDirect = document.querySelector('[data-mode-panel="direct"]');
const panelChain  = document.querySelector('[data-mode-panel="chain"]');
const resultsDirect = document.querySelector('[data-mode-results="direct"]');
const resultsChain  = document.querySelector('[data-mode-results="chain"]');

// Direct mode — inputs
const inputR1 = document.getElementById('input-r1');
const inputR2 = document.getElementById('input-r2');
const fieldR1 = document.getElementById('field-r1');
const fieldR2 = document.getElementById('field-r2');
const chkDesignMode = document.getElementById('chk-design-mode');
const designFields  = document.getElementById('design-fields');
const inputVoutTarget = document.getElementById('input-vout-target');
const radioFixR1 = document.getElementById('radio-fix-r1');
const radioFixR2 = document.getElementById('radio-fix-r2');

// Direct mode — results
const outVout   = document.getElementById('out-vout');
const outCurrent = document.getElementById('out-current');
const unitCurrent = document.getElementById('unit-current');
const outPR1 = document.getElementById('out-p-r1');
const unitPR1 = document.getElementById('unit-p-r1');
const warnPR1 = document.getElementById('warn-p-r1');
const outPR2 = document.getElementById('out-p-r2');
const unitPR2 = document.getElementById('unit-p-r2');
const warnPR2 = document.getElementById('warn-p-r2');
const outPTotal = document.getElementById('out-p-total');
const unitPTotal = document.getElementById('unit-p-total');

// Chain mode — inputs
const resistorList = document.getElementById('resistor-list');
const btnAddResistor = document.getElementById('btn-add-resistor');
const btnAddResistorLabel = document.getElementById('btn-add-resistor-label');

// Chain mode — results
const outChainVout    = document.getElementById('out-chain-vout');
const outChainCurrent = document.getElementById('out-chain-current');
const unitChainCurrent = document.getElementById('unit-chain-current');
const outChainPTotal  = document.getElementById('out-chain-p-total');
const unitChainPTotal = document.getElementById('unit-chain-p-total');
const breakdownBody   = document.getElementById('chain-breakdown-body');

/* ══════════════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════════════ */

let currentMode = 'direct'; // 'direct' | 'chain'
let chainCount = 0;         // number of resistor rows currently rendered
let chartInstance = null;

/* ══════════════════════════════════════════════════════════════════
   FORMAT HELPERS
   ══════════════════════════════════════════════════════════════════ */

/** Fixed-decimal formatter for values with a static unit (V, Ω raw). */
function fmt(val, decimals = 2) {
  if (!isFinite(val)) return '—';
  return val.toFixed(decimals);
}

/**
 * Engineering-notation formatter: picks mΩ/Ω/kΩ/MΩ (or the equivalent
 * for A and W) automatically based on magnitude, and returns both the
 * text and the unit so the UI can update the unit label alongside it.
 * Zero is formatted with the same decimal count as every other value
 * (QA audit M-01) so results don't jump between "0" and "0.000".
 */
function formatEngineering(value, baseUnit, decimals = 3) {
  if (!isFinite(value)) return { text: '—', unit: baseUnit };
  const abs = Math.abs(value);
  if (abs === 0) return { text: (0).toFixed(decimals), unit: baseUnit };
  if (abs < 1) return { text: (value * 1000).toFixed(decimals), unit: 'm' + baseUnit };
  if (abs >= 1e9) return { text: (value / 1e9).toFixed(decimals), unit: 'G' + baseUnit };
  if (abs >= 1e6) return { text: (value / 1e6).toFixed(decimals), unit: 'M' + baseUnit };
  if (abs >= 1e3) return { text: (value / 1e3).toFixed(decimals), unit: 'k' + baseUnit };
  return { text: value.toFixed(decimals), unit: baseUnit };
}

/** Convenience wrapper for diagram labels: "6.00 mA" as a single string. */
function engLabel(value, baseUnit, decimals = 2) {
  const { text, unit } = formatEngineering(value, baseUnit, decimals);
  return `${text} ${unit}`;
}

function writeEngineering(valueEl, unitEl, value, baseUnit, decimals = 3) {
  const { text, unit } = formatEngineering(value, baseUnit, decimals);
  if (valueEl) valueEl.textContent = text;
  if (unitEl) unitEl.textContent = unit;
}

/* ══════════════════════════════════════════════════════════════════
   ERROR / VALIDATION HELPERS  (mirrors the static-beam UX pattern:
   shake the offending field, scroll it into view, show a banner)
   ══════════════════════════════════════════════════════════════════ */

/**
 * Writes the error banner. Clears the text first and sets the real
 * message on the next frame so aria-live="polite" re-announces it
 * even when the new message is identical to the previous one
 * (QA audit I-04 — screen readers otherwise treat unchanged text as
 * "nothing happened").
 */
function showError(msg) {
  errorEl.textContent = '';
  errorEl.classList.add('is-visible');
  requestAnimationFrame(() => { errorEl.textContent = msg; });
}

function clearError() {
  errorEl.textContent = '';
  errorEl.classList.remove('is-visible');
}

/**
 * Shakes the field that wraps `el` and scrolls it into view.
 * Site convention (simulator.css): the shake class + animation live
 * on .sim-input-wrap (the div around <input>+<unit>), not on the
 * <input> itself. Radio-card style controls use their own .is-invalid
 * variant, but reuse the same global @keyframes sim-shake.
 */
function shakeAndFocus(el) {
  if (!el) return;
  const target = el.closest('.sim-input-wrap') || el.closest('.radio-card') || el;
  const invalidClass = target.classList.contains('radio-card') ? 'is-invalid' : 'sim-input--invalid';

  target.classList.remove(invalidClass);
  void target.offsetWidth; // force reflow so the animation restarts if already shaking
  target.classList.add(invalidClass);

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
  window.setTimeout(() => target.classList.remove(invalidClass), 450);
}

/**
 * Parses a number input, and on failure shakes the field, scrolls to
 * it, and shows the given message. Returns null on failure.
 */
function readPositiveOrZero(el, label) {
  const val = parseFloat(el.value);
  if (isNaN(val) || !isFinite(val) || val < 0) {
    showError(`${label} must be a valid, non-negative number.`);
    shakeAndFocus(el);
    return null;
  }
  return val;
}

function readPositive(el, label) {
  const val = parseFloat(el.value);
  if (isNaN(val) || !isFinite(val) || val <= 0) {
    showError(`${label} must be a valid number greater than 0.`);
    shakeAndFocus(el);
    return null;
  }
  return val;
}

/* ══════════════════════════════════════════════════════════════════
   MODE TABS
   ══════════════════════════════════════════════════════════════════ */

function setMode(mode) {
  currentMode = mode;

  tabDirect.classList.toggle('is-active', mode === 'direct');
  tabChain.classList.toggle('is-active', mode === 'chain');
  tabDirect.setAttribute('aria-selected', String(mode === 'direct'));
  tabChain.setAttribute('aria-selected', String(mode === 'chain'));

  panelDirect.classList.toggle('is-hidden', mode !== 'direct');
  panelChain.classList.toggle('is-hidden', mode !== 'chain');
  resultsDirect.classList.toggle('is-hidden', mode !== 'direct');
  resultsChain.classList.toggle('is-hidden', mode !== 'chain');

  chartLabel.textContent = mode === 'direct'
    ? 'Vout vs. R2 (operating point highlighted)'
    : 'Voltage drop per resistor in the chain';

  clearError();
  calculate();
}

tabDirect.addEventListener('click', () => setMode('direct'));
tabChain.addEventListener('click', () => setMode('chain'));

/* ══════════════════════════════════════════════════════════════════
   DESIGN MODE (two-resistor tab only)
   ══════════════════════════════════════════════════════════════════ */

function isDesignMode() {
  return chkDesignMode.checked;
}

function fixedResistor() {
  return radioFixR1.checked ? 'r1' : 'r2';
}

function updateDesignModeUI() {
  const active = isDesignMode();
  designFields.classList.toggle('is-hidden', !active);

  if (!active) {
    fieldR1.classList.remove('is-computed');
    fieldR2.classList.remove('is-computed');
    inputR1.disabled = false;
    inputR2.disabled = false;
    return;
  }

  const fixing = fixedResistor(); // 'r1' means R1 stays editable, R2 is computed
  fieldR1.classList.toggle('is-computed', fixing !== 'r1');
  fieldR2.classList.toggle('is-computed', fixing !== 'r2');
  inputR1.disabled = fixing !== 'r1';
  inputR2.disabled = fixing !== 'r2';
}

chkDesignMode.addEventListener('change', () => { updateDesignModeUI(); calculate(); });
radioFixR1.addEventListener('change', () => { updateDesignModeUI(); calculate(); });
radioFixR2.addEventListener('change', () => { updateDesignModeUI(); calculate(); });
inputVoutTarget.addEventListener('input', calculate);

/* ══════════════════════════════════════════════════════════════════
   DYNAMIC RESISTOR LIST (series chain mode)
   ══════════════════════════════════════════════════════════════════ */

function addResistorRow(value) {
  if (chainCount >= CHAIN.MAX_RESISTORS) return;

  chainCount += 1;
  const index = chainCount;

  const row = document.createElement('div');
  row.className = 'resistor-row';
  row.dataset.index = String(index);
  row.innerHTML = `
    <span class="resistor-row__label">R${index}</span>
    <div class="sim-input-wrap">
      <input type="number" class="sim-input chain-input" value="${value}" min="0" step="10"
             aria-label="Resistance R${index}" />
      <span class="sim-unit">Ω</span>
    </div>
    <button type="button" class="resistor-row__remove" aria-label="Remove R${index}">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      </svg>
    </button>
  `;

  resistorList.appendChild(row);

  row.querySelector('.chain-input').addEventListener('input', calculate);
  row.querySelector('.resistor-row__remove').addEventListener('click', () => removeResistorRow(row));

  relabelResistorRows();
  updateAddButtonState();
}

function removeResistorRow(row) {
  if (chainCount <= CHAIN.MIN_RESISTORS) return;
  row.remove();
  chainCount -= 1;
  relabelResistorRows();
  updateAddButtonState();
  calculate();
}

function relabelResistorRows() {
  const rows = resistorList.querySelectorAll('.resistor-row');
  rows.forEach((row, i) => {
    const n = i + 1;
    row.dataset.index = String(n);
    row.querySelector('.resistor-row__label').textContent = `R${n}`;
    row.querySelector('.chain-input').setAttribute('aria-label', `Resistance R${n}`);
    row.querySelector('.resistor-row__remove').setAttribute('aria-label', `Remove R${n}`);
    row.querySelector('.resistor-row__remove').disabled = chainCount <= CHAIN.MIN_RESISTORS;
  });
}

/**
 * Updates the "+ Add resistor" button state. Writes to an inner
 * <span> rather than the button's textContent so that adding an
 * icon to this button later won't get silently wiped out by this
 * function (QA audit M-03 — preventive hardening).
 */
function updateAddButtonState() {
  btnAddResistor.disabled = chainCount >= CHAIN.MAX_RESISTORS;
  btnAddResistorLabel.textContent = chainCount >= CHAIN.MAX_RESISTORS
    ? `Maximum ${CHAIN.MAX_RESISTORS} resistors`
    : '+ Add resistor';
}

btnAddResistor.addEventListener('click', () => {
  addResistorRow(1000);
  calculate();
});

function readChainResistors() {
  const inputs = Array.from(resistorList.querySelectorAll('.chain-input'));
  const values = [];
  for (const el of inputs) {
    const v = readPositiveOrZero(el, `${el.closest('.resistor-row').querySelector('.resistor-row__label').textContent}`);
    if (v === null) return null;
    values.push(v);
  }
  return values;
}

/* ══════════════════════════════════════════════════════════════════
   CALCULATION — direct mode
   ══════════════════════════════════════════════════════════════════ */

function calculateDirect() {
  const V = readPositiveOrZero(inputVin, 'Input voltage');
  if (V === null) return;

  let R1, R2;

  if (isDesignMode()) {
    const voutTarget = readPositive(inputVoutTarget, 'Target Vout');
    if (voutTarget === null) return;

    const fixing = fixedResistor();
    const fixedEl = fixing === 'r1' ? inputR1 : inputR2;
    const fixedVal = readPositive(fixedEl, fixing === 'r1' ? 'R1' : 'R2');
    if (fixedVal === null) return;

    const design = calculateResistorForVout(V, voutTarget, fixedVal, fixing);
    if (!design.valid) {
      showError(design.error);
      shakeAndFocus(inputVoutTarget);
      return;
    }

    R1 = design.r1;
    R2 = design.r2;

    // Reflect the computed value back into the disabled field
    if (fixing === 'r1') {
      inputR2.value = fmt(R2, 2);
    } else {
      inputR1.value = fmt(R1, 2);
    }
  } else {
    R1 = readPositiveOrZero(inputR1, 'R1');
    if (R1 === null) return;
    R2 = readPositiveOrZero(inputR2, 'R2');
    if (R2 === null) return;
  }

  const result = calculateVoltageDivider(V, R1, R2);
  if (!result.valid) {
    showError(result.error);
    shakeAndFocus(inputR2);
    return;
  }

  clearError();

  outVout.textContent = fmt(result.vout, 2);
  writeEngineering(outCurrent, unitCurrent, result.current, 'A');
  writeEngineering(outPR1, unitPR1, result.p_r1, 'W');
  writeEngineering(outPR2, unitPR2, result.p_r2, 'W');
  writeEngineering(outPTotal, unitPTotal, result.p_total, 'W');

  warnPR1.textContent = result.p_r1_ok ? '' : `⚠ Exceeds ${result.p_max_rating} W rating`;
  warnPR2.textContent = result.p_r2_ok ? '' : `⚠ Exceeds ${result.p_max_rating} W rating`;

  diagramContainer.innerHTML = renderDirectDiagram({
    vinLabel: `${fmt(V, 2)} V`,
    voutLabel: `${fmt(result.vout, 2)} V`,
    currentLabel: engLabel(result.current, 'A'),
    r1Label: `R1 = ${engLabel(R1, 'Ω')}`,
    r2Label: `R2 = ${engLabel(R2, 'Ω')}`
  });

  renderDirectChart(V, R1, R2);
}

/* ══════════════════════════════════════════════════════════════════
   CALCULATION — series chain mode
   ══════════════════════════════════════════════════════════════════ */

function calculateChain() {
  const V = readPositiveOrZero(inputVin, 'Input voltage');
  if (V === null) return;

  const resistors = readChainResistors();
  if (resistors === null) return;

  const result = calculateVoltageDividerN(V, resistors);
  if (!result.valid) {
    showError(result.error);
    return;
  }

  clearError();

  outChainVout.textContent = fmt(result.vout, 2);
  writeEngineering(outChainCurrent, unitChainCurrent, result.current, 'A');
  writeEngineering(outChainPTotal, unitChainPTotal, result.p_total, 'W');

  renderBreakdownTable(result.breakdown);

  diagramContainer.innerHTML = renderChainDiagram({
    vinLabel: `${fmt(V, 2)} V`,
    voutLabel: `${fmt(result.vout, 2)} V`,
    currentLabel: engLabel(result.current, 'A'),
    resistorLabels: result.breakdown.map(row => `R${row.index} = ${engLabel(row.r, 'Ω')}`)
  });

  renderChainChart(result.breakdown);
}

/**
 * Renders the per-resistor breakdown table. The overload flag is
 * applied to the whole <tr>, not just the power <td>, so an
 * overloaded resistor's entire row is easy to spot at a glance
 * (QA audit M-05).
 */
function renderBreakdownTable(breakdown) {
  breakdownBody.innerHTML = breakdown.map(row => {
    const rFmt = formatEngineering(row.r, 'Ω', 2);
    const pFmt = formatEngineering(row.p, 'W', 3);
    return `
      <tr class="${row.p_ok ? '' : 'is-overload'}">
        <td>R${row.index}</td>
        <td>${rFmt.text} ${rFmt.unit}</td>
        <td>${fmt(row.vDrop, 2)} V</td>
        <td>${pFmt.text} ${pFmt.unit}${row.p_ok ? '' : ' ⚠'}</td>
      </tr>
    `;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════════
   DISPATCH
   ══════════════════════════════════════════════════════════════════ */

function calculate() {
  clearError();
  if (currentMode === 'direct') {
    calculateDirect();
  } else {
    calculateChain();
  }
}

/* ══════════════════════════════════════════════════════════════════
   CHARTS (Chart.js, loaded globally via CDN — see index.html)
   ══════════════════════════════════════════════════════════════════ */

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

function renderDirectChart(V, R1, R2) {
  const R2max = Math.max(R2 * 3, 1000, R1 * 2);
  const curve = sweepVout(V, R1, R2max, SWEEP_POINTS);
  if (curve.length === 0) return;

  destroyChart();

  chartInstance = new Chart(chartCanvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Vout(R2)',
          data: curve,
          borderColor: CHART_COLORS.curve,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15
        },
        {
          label: 'Operating point',
          data: [{ x: R2, y: V * (R2 / (R1 + R2)) }],
          type: 'scatter',
          borderColor: CHART_COLORS.highlight,
          backgroundColor: CHART_COLORS.highlight,
          pointRadius: 5,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'R2 (Ω)' },
          grid: { color: CHART_COLORS.grid }
        },
        y: {
          title: { display: true, text: 'Vout (V)' },
          grid: { color: CHART_COLORS.grid }
        }
      },
      plugins: {
        legend: { display: true, labels: { boxWidth: 12 } }
      }
    }
  });
}

function renderChainChart(breakdown) {
  destroyChart();

  chartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: breakdown.map(r => `R${r.index}`),
      datasets: [
        {
          label: 'Voltage drop (V)',
          data: breakdown.map(r => r.vDrop),
          backgroundColor: breakdown.map(r => r.p_ok ? CHART_COLORS.bar : CHART_COLORS.barOverload),
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: 'Voltage drop (V)' },
          grid: { color: CHART_COLORS.grid }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════════════════
   EVENT WIRING — shared inputs
   ══════════════════════════════════════════════════════════════════ */

btnCalc.addEventListener('click', calculate);
inputVin.addEventListener('input', calculate);
inputR1.addEventListener('input', calculate);
inputR2.addEventListener('input', calculate);

/* ══════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════ */

inputVin.value = DEFAULTS.V;
inputR1.value = DEFAULTS.R1;
inputR2.value = DEFAULTS.R2;
inputVoutTarget.value = DEFAULTS.VOUT_TARGET;

CHAIN.DEFAULT_RESISTORS.forEach(v => addResistorRow(v));

updateDesignModeUI();
setMode('direct'); // also triggers the first calculate()
