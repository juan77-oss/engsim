// simulator.js — Temperature Converter
import { UNITS, UNIT_ORDER, DEFAULT_VALUE, DEFAULT_UNIT } from './constants.js';
import { convertAll, isBelowAbsoluteZero } from './core.js';

const inputValue = document.getElementById('input-value');
const inputUnit = document.getElementById('input-unit');
const btnCalculate = document.getElementById('btn-calculate');
const errorBox = document.getElementById('sim-error');
const resultsTableWrap = document.getElementById('results-table-wrap');
const resultsTbody = document.getElementById('results-tbody');

// --- Populate unit <select> from UNITS -------------------------------
function populateUnitSelect() {
  inputUnit.innerHTML = '';
  UNIT_ORDER.forEach((key) => {
    const unit = UNITS[key];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${unit.label} (${unit.symbol})`;
    inputUnit.appendChild(opt);
  });
  inputUnit.value = DEFAULT_UNIT;
}

// --- Error handling ----------------------------------------------------
function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('is-hidden');

  const wrap = inputValue.closest('.sim-input-wrap');
  wrap.classList.remove('sim-input--invalid');
  // force reflow so the shake animation can restart
  void wrap.offsetWidth;
  wrap.classList.add('sim-input--invalid');
  inputValue.setAttribute('aria-invalid', 'true');

  resultsTableWrap.classList.add('is-hidden');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('is-hidden');
  const wrap = inputValue.closest('.sim-input-wrap');
  wrap.classList.remove('sim-input--invalid');
  inputValue.removeAttribute('aria-invalid');
}

// --- Number formatting ---------------------------------------------------
// Temperature values stay in a human-scale range (no eV/light-year-style
// extremes), so unlike Energy/Length/Mass Converter this doesn't need a
// scientific-notation threshold — a plain fixed-decimal format is enough.
function fmt(value, decimals) {
  if (!isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

// --- Main calculation ----------------------------------------------------
function calculate() {
  const rawValue = inputValue.value.trim();

  if (rawValue === '') {
    showError('Please enter a temperature value.');
    return;
  }

  const value = Number(rawValue);

  if (!isFinite(value) || isNaN(value)) {
    showError('Please enter a valid number.');
    return;
  }

  const fromKey = inputUnit.value;

  if (isBelowAbsoluteZero(value, fromKey)) {
    const unit = UNITS[fromKey];
    showError(`Temperature cannot be below absolute zero (${unit.absoluteZero}${unit.symbol}).`);
    return;
  }

  clearError();

  const results = convertAll(value, fromKey);

  resultsTbody.innerHTML = '';
  UNIT_ORDER.forEach((key) => {
    const unit = UNITS[key];
    const row = document.createElement('tr');
    if (key === fromKey) row.classList.add('tpc-row--active');

    const tdUnit = document.createElement('td');
    tdUnit.textContent = `${unit.label} (${unit.symbol})`;

    const tdValue = document.createElement('td');
    tdValue.textContent = fmt(results[key], unit.decimals);
    tdValue.className = 'tpc-value-cell';

    row.appendChild(tdUnit);
    row.appendChild(tdValue);
    resultsTbody.appendChild(row);
  });

  resultsTableWrap.classList.remove('is-hidden');
}

// --- Events ----------------------------------------------------------------
populateUnitSelect();
inputValue.value = DEFAULT_VALUE;

btnCalculate.addEventListener('click', calculate);
inputValue.addEventListener('input', calculate);
inputUnit.addEventListener('change', calculate);

calculate();
