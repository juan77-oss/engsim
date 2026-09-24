/**
 * simulator.js — Gas Combustion Calculator
 * engsimapp.com / simulators/gas-combustion/
 *
 * WHAT GOES HERE: input reading, DOM wiring, output writing.
 * WHAT DOES NOT GO HERE: navbar/footer/theme (platform.js),
 *   layout/styling (simulator.css, css/custom.css),
 *   physics/math (core.js).
 */

'use strict';

import { parseFormula, calculateCombustion } from './core.js';

/* ── DOM references ──────────────────────────────────────────── */
// Fuel
const elFormulaInput = document.getElementById('gc-input-formula');
const elFormulaError = document.getElementById('gc-formula-error');
const elParsedX = document.getElementById('gc-parsed-x');
const elParsedY = document.getElementById('gc-parsed-y');
const elParsedZ = document.getElementById('gc-parsed-z');
const elParsedMm = document.getElementById('gc-parsed-mm');

// Gas analysis
const elCO2Input = document.getElementById('gc-input-co2');
const elCOInput = document.getElementById('gc-input-co');
const elO2Input = document.getElementById('gc-input-o2');
const elN2Input = document.getElementById('gc-input-n2');
const elGasSum = document.getElementById('gc-gas-sum');
const elGasWarning = document.getElementById('gc-gas-warning');

// Actions
const elBtnCalculate = document.getElementById('btn-calculate');
const elBtnReset = document.getElementById('gc-btn-reset');

// General error slot (template-standard)
const errorEl = document.getElementById('sim-error');

// Results
const elResults = document.getElementById('gc-results');
const elDiagnostic = document.getElementById('gc-diagnostic');
const elDiagText = document.getElementById('gc-diag-text');
const elDiagValue = document.getElementById('gc-diag-value');

const elResFormula = document.getElementById('gc-res-formula');
const elResO2teo = document.getElementById('gc-res-o2teo');
const elResL0 = document.getElementById('gc-res-l0');
const elResL0Mass = document.getElementById('gc-res-l0-mass');
const elResLambda = document.getElementById('gc-res-lambda');
const elResExcess = document.getElementById('gc-res-excess');
const elResLreal = document.getElementById('gc-res-lreal');

const elTblCO2Kmol = document.getElementById('gc-tbl-co2-kmol');
const elTblCO2Pct = document.getElementById('gc-tbl-co2-pct');
const elTblCOKmol = document.getElementById('gc-tbl-co-kmol');
const elTblCOPct = document.getElementById('gc-tbl-co-pct');
const elTblH2OKmol = document.getElementById('gc-tbl-h2o-kmol');
const elTblH2OPct = document.getElementById('gc-tbl-h2o-pct');
const elTblN2Kmol = document.getElementById('gc-tbl-n2-kmol');
const elTblN2Pct = document.getElementById('gc-tbl-n2-pct');
const elTblO2ExKmol = document.getElementById('gc-tbl-o2ex-kmol');
const elTblO2ExPct = document.getElementById('gc-tbl-o2ex-pct');
const elTblTotalKmol = document.getElementById('gc-tbl-total-kmol');

/* ── Error helpers ───────────────────────────────────────────── */
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add('is-visible');
}
function clearError() {
  errorEl.textContent = '';
  errorEl.classList.remove('is-visible');
}

function setFormulaError(msg) {
  if (msg) {
    elFormulaError.textContent = msg;
    elFormulaInput.classList.add('gc-input--error');
  } else {
    elFormulaError.textContent = '';
    elFormulaInput.classList.remove('gc-input--error');
  }
}

/* ── Display helpers ─────────────────────────────────────────── */
function updateParsedDisplay(parsed) {
  if (parsed) {
    elParsedX.textContent = parsed.x;
    elParsedY.textContent = parsed.y;
    elParsedZ.textContent = parsed.z;
    elParsedMm.textContent = parsed.Mm.toFixed(0);
  } else {
    elParsedX.textContent = '—';
    elParsedY.textContent = '—';
    elParsedZ.textContent = '—';
    elParsedMm.textContent = '—';
  }
}

function getGasVal(el) {
  const v = parseFloat(el.value);
  return isNaN(v) || v < 0 ? 0 : v;
}

function updateN2Display() {
  const co2 = getGasVal(elCO2Input);
  const co = getGasVal(elCOInput);
  const o2 = getGasVal(elO2Input);
  const sum = co2 + co + o2;

  elGasSum.textContent = sum.toFixed(3);
  elGasSum.classList.toggle('gc-sum--invalid', sum > 100);

  const n2 = 100 - sum;
  if (n2 < 0) {
    elN2Input.value = '—';
    elGasWarning.textContent = 'The sum of CO₂ + CO + O₂ exceeds 100 kmol %. Please check the values.';
    elGasWarning.classList.add('is-visible');
  } else {
    elN2Input.value = n2.toFixed(3);
    elGasWarning.classList.remove('is-visible');
  }
}

function renderResults(r, formulaStr) {
  elResults.style.display = 'block';
  setTimeout(() => elResults.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  elDiagnostic.className = 'gc-diagnostic';
  const lStr = r.lambda.toFixed(4);

  if (Math.abs(r.lambda - 1) <= 0.005) {
    elDiagnostic.classList.add('gc-diagnostic--stoich');
    elDiagText.textContent = 'Stoichiometric Combustion';
    elDiagValue.textContent = 'λ = ' + lStr;
  } else if (r.lambda > 1) {
    elDiagnostic.classList.add('gc-diagnostic--excess');
    elDiagText.textContent = 'Excess Air';
    elDiagValue.textContent = 'λ = ' + lStr + ' — ' + Math.abs(r.excess_pct).toFixed(1) + '% above λ = 1';
  } else {
    elDiagnostic.classList.add('gc-diagnostic--deficit');
    elDiagText.textContent = 'Air Deficit';
    elDiagValue.textContent = 'λ = ' + lStr + ' — ' + Math.abs(r.excess_pct).toFixed(1) + '% below λ = 1';
  }

  elResFormula.textContent = formulaStr;
  elResO2teo.textContent = r.O2teo.toFixed(3);
  elResL0.textContent = r.L0.toFixed(3);
  elResL0Mass.textContent = r.L0_mass.toFixed(3);
  elResLambda.textContent = r.lambda.toFixed(4);
  elResLreal.textContent = r.Lreal.toFixed(3);

  const sign = r.excess_pct >= 0 ? '+' : '';
  elResExcess.textContent = sign + r.excess_pct.toFixed(2);

  elTblCO2Kmol.textContent = r.CO2_prod.toFixed(3);
  elTblCO2Pct.textContent = r.pct(r.CO2_prod) + ' %';
  elTblCOKmol.textContent = r.CO_prod.toFixed(3);
  elTblCOPct.textContent = r.pct(r.CO_prod) + ' %';
  elTblH2OKmol.textContent = r.H2O_prod.toFixed(3);
  elTblH2OPct.textContent = r.pct(r.H2O_prod) + ' %';
  elTblN2Kmol.textContent = r.N2_prod.toFixed(3);
  elTblN2Pct.textContent = r.pct(r.N2_prod) + ' %';
  elTblO2ExKmol.textContent = r.O2_excess.toFixed(3);
  elTblO2ExPct.textContent = r.pct(r.O2_excess) + ' %';
  elTblTotalKmol.textContent = r.Total_wet.toFixed(3);
}

/* ── Handlers ────────────────────────────────────────────────── */
function calculate() {
  clearError();

  const parsed = parseFormula(elFormulaInput.value);
  if (!parsed) {
    setFormulaError('Invalid formula. Use the format CH4, C2H6, C3H8, C2H4O — only C, H and O atoms with positive integer subscripts are accepted.');
    return;
  }
  setFormulaError(null);

  const CO2_pct = getGasVal(elCO2Input);
  const CO_pct = getGasVal(elCOInput);
  const O2_pct = getGasVal(elO2Input);
  const sum3 = CO2_pct + CO_pct + O2_pct;

  if (sum3 > 100) {
    showError('The sum of CO₂ + CO + O₂ exceeds 100 kmol %. Cannot calculate.');
    return;
  }

  const N2_pct = 100 - sum3;
  const C_in_gas = CO2_pct + CO_pct;
  if (C_in_gas <= 0) {
    showError('Gas analysis must contain at least CO₂ or CO to determine the carbon balance.');
    return;
  }

  const results = calculateCombustion({
    x: parsed.x, y: parsed.y, z: parsed.z, Mm: parsed.Mm,
    CO2_pct, CO_pct, N2_pct
  });

  if (!results) {
    showError('Calculation failed. Please check all inputs.');
    return;
  }

  renderResults(results, parsed.formulaStr);
}

function resetAll() {
  [elFormulaInput, elCO2Input, elCOInput, elO2Input, elN2Input].forEach(el => el.value = '');

  clearError();
  setFormulaError(null);
  updateParsedDisplay(null);

  elGasSum.textContent = '—';
  elGasSum.classList.remove('gc-sum--invalid');
  elGasWarning.classList.remove('is-visible');
  elResults.style.display = 'none';
  elFormulaInput.focus();
}

/* ── Event listeners ─────────────────────────────────────────── */
elFormulaInput.addEventListener('input', () => {
  const raw = elFormulaInput.value.trim();
  if (!raw) {
    setFormulaError(null);
    updateParsedDisplay(null);
    return;
  }
  const parsed = parseFormula(raw);
  if (parsed) {
    setFormulaError(null);
    updateParsedDisplay(parsed);
  } else {
    setFormulaError('Formula not recognized. Example: CH4, C2H6, C3H8, C2H4O');
    updateParsedDisplay(null);
  }
});

elFormulaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elCO2Input.focus();
});

[elCO2Input, elCOInput, elO2Input].forEach((el) => {
  el.addEventListener('input', updateN2Display);
});

elCO2Input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elCOInput.focus();
});

elCOInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elO2Input.focus();
});

elO2Input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') calculate();
});

elBtnCalculate.addEventListener('click', calculate);
elBtnReset.addEventListener('click', resetAll);
