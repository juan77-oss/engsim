// simulator.js — Fuel Consumption Converter
import { UNITS, UNIT_ORDER, DEFAULT_VALUE, DEFAULT_UNIT } from './constants.js';
import { convertAll } from './core.js';

const inputValue = document.getElementById('input-value');
const inputUnit = document.getElementById('input-unit');
const btnCalculate = document.getElementById('btn-calculate');
const errorBox = document.getElementById('sim-error');
const resultsTableWrap = document.getElementById('results-table-wrap');
const resultsTbody = document.getElementById('results-tbody');

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

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('is-hidden');

  const wrap = inputValue.closest('.sim-input-wrap');
  wrap.classList.remove('sim-input--invalid');
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

function fmt(value, decimals) {
  if (!isFinite(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  const roundsToZero = Number(value.toFixed(decimals)) === 0;

  if (roundsToZero || abs >= 1e9) {
    return value.toExponential(4).replace('e', ' × 10^').replace(/\+/g, '');
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function calculate() {
  const rawValue = inputValue.value.trim();

  if (rawValue === '') {
    showError('Please enter a fuel consumption value.');
    return;
  }

  const value = Number(rawValue);

  if (!isFinite(value) || isNaN(value)) {
    showError('Please enter a valid number.');
    return;
  }

  // Fuel economy is only meaningful for a strictly positive value: 0 or a
  // negative number would imply infinite or undefined consumption in the
  // mpg/km-per-L <-> L/100km reciprocal relationship (division by the
  // input value happens internally for L/100km). Similar in spirit to
  // Temperature Converter's absolute-zero floor and Speed Converter's
  // speed-of-light ceiling — this is a physical/mathematical constraint,
  // not a style choice.
  if (value <= 0) {
    showError('Fuel consumption must be a positive number.');
    return;
  }

  clearError();

  const fromKey = inputUnit.value;
  const results = convertAll(value, fromKey);

  resultsTbody.innerHTML = '';
  UNIT_ORDER.forEach((key) => {
    const unit = UNITS[key];
    const row = document.createElement('tr');
    if (key === fromKey) row.classList.add('fcc-row--active');

    const tdUnit = document.createElement('td');
    tdUnit.textContent = `${unit.label} (${unit.symbol})`;

    const tdValue = document.createElement('td');
    tdValue.textContent = fmt(results[key], unit.decimals);
    tdValue.className = 'fcc-value-cell';

    row.appendChild(tdUnit);
    row.appendChild(tdValue);
    resultsTbody.appendChild(row);
  });

  resultsTableWrap.classList.remove('is-hidden');
}

populateUnitSelect();
inputValue.value = DEFAULT_VALUE;

btnCalculate.addEventListener('click', calculate);
inputValue.addEventListener('input', calculate);
inputUnit.addEventListener('change', calculate);

calculate();
