import { convertToAll, convert } from './core.js';
import {
  POWER_UNITS,
  DBM_UNIT_ID,
  DBM_UNIT_META,
  UNIT_DISPLAY_ORDER,
  DEFAULT_INPUT_VALUE,
  DEFAULT_INPUT_UNIT,
  QUICK_REFERENCE_PAIRS,
} from './constants.js';

// ---------- DOM refs ----------
const inputValue = document.getElementById('input-value');
const inputUnit = document.getElementById('input-unit');
const resultsBody = document.getElementById('results-table-body');
const resultsEmpty = document.getElementById('results-empty-state');
const resultsTable = document.getElementById('results-table');
const resultsTableWrap = document.getElementById('results-table-wrap');
const referenceBody = document.getElementById('reference-table-body');

// ---------- error helpers ----------
function showError(message) {
  const errorBox = document.getElementById('sim-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.add('is-visible');

  const wrap = inputValue.closest('.sim-input-wrap');
  if (wrap) {
    wrap.classList.remove('sim-input--invalid'); // reset to allow re-trigger
    void wrap.offsetWidth; // force reflow so the shake animation restarts
    wrap.classList.add('sim-input--invalid');
  }
  inputValue.setAttribute('aria-invalid', 'true');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
  const errorBox = document.getElementById('sim-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.remove('is-visible');

  const wrap = inputValue.closest('.sim-input-wrap');
  if (wrap) wrap.classList.remove('sim-input--invalid');
  inputValue.removeAttribute('aria-invalid');
}

// ---------- formatting ----------
function fmt(value, decimals) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return '—';

  // Use scientific notation for extreme magnitudes so the table stays readable,
  // and also whenever the value would otherwise round to a misleading "0" at
  // this unit's own decimal precision (e.g. 0.0001 mW rounding to "0.00").
  const abs = Math.abs(value);
  if (abs !== 0 && (Number(value.toFixed(decimals)) === 0 || abs >= 1e12)) {
    return value.toExponential(4);
  }

  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function unitMeta(unitId) {
  return unitId === DBM_UNIT_ID ? DBM_UNIT_META : POWER_UNITS[unitId];
}

// ---------- rendering ----------
function renderResultsTable(results) {
  resultsBody.innerHTML = '';

  UNIT_DISPLAY_ORDER.forEach((unitId) => {
    const meta = unitMeta(unitId);
    const value = results[unitId];

    const row = document.createElement('tr');
    if (unitId === inputUnit.value) {
      row.classList.add('pwc-row--active');
    }

    const labelCell = document.createElement('td');
    labelCell.textContent = meta.plural;

    const symbolCell = document.createElement('td');
    symbolCell.textContent = meta.symbol;

    const valueCell = document.createElement('td');
    valueCell.className = 'pwc-value-cell';
    valueCell.textContent = fmt(value, meta.decimals);

    row.appendChild(labelCell);
    row.appendChild(symbolCell);
    row.appendChild(valueCell);
    resultsBody.appendChild(row);
  });
}

function renderReferenceTable() {
  referenceBody.innerHTML = '';

  QUICK_REFERENCE_PAIRS.forEach((pair) => {
    const result = convert(1, pair.from, pair.to);
    const toMeta = unitMeta(pair.to);

    const row = document.createElement('tr');

    const labelCell = document.createElement('td');
    labelCell.textContent = pair.label;

    const valueCell = document.createElement('td');
    valueCell.className = 'pwc-value-cell';
    valueCell.textContent = `${fmt(result, toMeta.decimals)} ${toMeta.symbol}`;

    row.appendChild(labelCell);
    row.appendChild(valueCell);
    referenceBody.appendChild(row);
  });
}

// ---------- main calculate ----------
function calculate() {
  clearError();

  const rawValue = inputValue.value.trim();
  if (rawValue === '') {
    showError('Enter a numeric value to convert.');
    resultsTable.classList.add('is-hidden');
    resultsTableWrap.classList.add('is-hidden');
    resultsEmpty.classList.remove('is-hidden');
    return;
  }

  const value = Number(rawValue);
  if (Number.isNaN(value)) {
    showError('That value isn\u2019t a valid number. Use digits only, e.g. 12.5.');
    resultsTable.classList.add('is-hidden');
    resultsTableWrap.classList.add('is-hidden');
    resultsEmpty.classList.remove('is-hidden');
    return;
  }

  const fromUnitId = inputUnit.value;
  const { watts, results } = convertToAll(value, fromUnitId);

  if (watts === null) {
    showError('That value can\u2019t be converted from the selected unit.');
    resultsTable.classList.add('is-hidden');
    resultsTableWrap.classList.add('is-hidden');
    resultsEmpty.classList.remove('is-hidden');
    return;
  }

  resultsEmpty.classList.add('is-hidden');
  resultsTable.classList.remove('is-hidden');
  resultsTableWrap.classList.remove('is-hidden');
  renderResultsTable(results);
}

// ---------- init ----------
function init() {
  inputValue.value = DEFAULT_INPUT_VALUE;
  inputUnit.value = DEFAULT_INPUT_UNIT;

  renderReferenceTable();
  calculate();
}

inputValue.addEventListener('input', calculate);
inputUnit.addEventListener('change', calculate);
document.getElementById('btn-calculate').addEventListener('click', calculate);

init();