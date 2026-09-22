/**
 * simulator.js — Combustion Chimney Analyser — UI Layer
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : All DOM reads, writes, and user-facing rendering.
 *           Zero engineering calculations.
 *           Calls calculate() from core.js and renders results.
 *
 * ARCHITECTURE:
 *   UI reads inputs → calls core.calculate(params) → renders results
 *   Core never touches the DOM. Fuel data lives in constants.js.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { FUEL_DATA } from './constants.js';
import { calculate } from './core.js';

/* ── 0. LOCAL CONSTANTS & PARSE HELPERS ────────────────────────── */

// Matches the HTML input's max="1200" for co-inp-tg — kept as an explicit
// UI-side sanity check so a value that technically parses (e.g. from
// scientific notation like "1e10") can't slip through with a friendly
// error instead of a nonsensical calculation.
const MAX_FLUE_GAS_TEMP_C = 1200;

/**
 * parseDecimal()
 * Tolerant numeric parser: accepts both "12.5" and "12,5" (regional
 * decimal comma), since plain parseFloat('12,5') silently truncates to
 * 12 instead of failing or parsing the full value.
 *
 * @param {string} raw
 * @returns {number} parsed value, or NaN if not a valid number
 */
function parseDecimal(raw) {
    return parseFloat(String(raw).trim().replace(',', '.'));
}

/* ── 1. DOM REFERENCES ─────────────────────────────────────────── */

// Fuel & mode selectors
const selFuel        = document.getElementById('co-sel-fuel');
const fuelNote       = document.getElementById('co-fuel-note');
const coCustomParams = document.getElementById('co-custom-params');
const inpCustomCO2max = document.getElementById('co-inp-custom-co2max');
const inpCustomK     = document.getElementById('co-inp-custom-k');

const selMode        = document.getElementById('co-sel-mode');
const fieldCO2       = document.getElementById('co-field-co2');
const fieldO2        = document.getElementById('co-field-o2');
const inpCO2         = document.getElementById('co-inp-co2');
const inpO2          = document.getElementById('co-inp-o2');

// Temperature inputs
const inpTg          = document.getElementById('co-inp-tg');
const inpTa          = document.getElementById('co-inp-ta');

// Action buttons
const btnCalculate   = document.getElementById('btn-calculate');
const btnReset       = document.getElementById('co-btn-reset');

// Error display
const errorBox       = document.getElementById('co-error-box');

// Results area
const resWrapper     = document.getElementById('co-results-wrapper');
const resSubtitle    = document.getElementById('co-res-subtitle');
const diagnostic     = document.getElementById('co-diagnostic');
const diagText       = document.getElementById('co-diag-text');
const resCO2max      = document.getElementById('co-res-co2max');
const resDilucion    = document.getElementById('co-res-dilucion');
const resExceso      = document.getElementById('co-res-exceso');
const resPerdidas    = document.getElementById('co-res-perdidas');
const resEficiencia  = document.getElementById('co-res-eficiencia');

/* ── 2. UI STATE UPDATE ON SELECT CHANGES ──────────────────────── */

/**
 * Shows the CO2max and K constants for the selected fuel
 * to guide the user before entering the measured CO2.
 * Also manages the visibility of the custom fuel panel
 * and the active mode field (CO2 or O2).
 */
function updateUI() {
    const fuelKey = selFuel.value;
    const mode    = selMode.value;

    // Custom fuel
    if (fuelKey === 'custom') {
        fuelNote.style.display = 'none';
        coCustomParams.style.display = 'flex';
    } else {
        fuelNote.style.display = 'inline-block';
        coCustomParams.style.display = 'none';
        const fuel = FUEL_DATA[fuelKey];
        fuelNote.textContent =
            `CO\u2082max = ${fuel.co2max} % | K (Siegert) = ${fuel.K}`;
    }

    // Calculation mode
    if (mode === 'co2') {
        fieldCO2.style.display = 'flex';
        fieldO2.style.display  = 'none';
    } else {
        fieldCO2.style.display = 'none';
        fieldO2.style.display  = 'flex';
    }
}

/* ── 3. ERROR DISPLAY HELPERS ──────────────────────────────────── */

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('is-visible');
}

function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('is-visible');
}

/* ── 4. INPUT VALIDATION ───────────────────────────────────────── */

/**
 * Validates input fields before calculating.
 * Returns null if there is an error (and shows it),
 * or an object with parsed values if everything is correct.
 *
 * Rules:
 *  a) No empty fields.
 *  b) Measured CO2 > 0 (prevents division by zero).
 *  c) Measured CO2 < CO2max of selected fuel.
 *  d) Tgas > Tambient (physically coherent).
 *
 * @returns {Object|null} Validated params or null on error.
 */
function validateInputs() {
    const fuelKey = selFuel.value;
    const mode    = selMode.value;
    let fuel;

    const tgRaw = inpTg.value.trim();
    const taRaw = inpTa.value.trim();

    // Temperature validation (always required)
    if (tgRaw === '' || taRaw === '') {
        showError('Temperatures are required.');
        return null;
    }

    // Custom fuel validation
    if (fuelKey === 'custom') {
        const customCO2maxRaw = inpCustomCO2max.value.trim();
        const customKRaw      = inpCustomK.value.trim();

        if (customCO2maxRaw === '' || customKRaw === '') {
            showError('Enter the maximum CO\u2082 and K for the custom fuel.');
            return null;
        }

        const cCO2max = parseDecimal(customCO2maxRaw);
        const cK      = parseDecimal(customKRaw);

        if (isNaN(cCO2max) || cCO2max <= 0 || isNaN(cK) || cK <= 0) {
            showError('Fuel parameters must be positive.');
            return null;
        }
        fuel = { label: 'Custom', co2max: cCO2max, K: cK };
    } else {
        fuel = FUEL_DATA[fuelKey];
    }

    // co2 / o2 are read here only for UI-side sanity checks (empty field,
    // obvious range mistakes, friendlier error copy). The physical
    // validation and the O2 → CO2 conversion are the engine's
    // responsibility now (see core.js) — this layer never derives values
    // that get fed back into the calculation.
    let co2, o2;

    if (mode === 'co2') {
        const co2Raw = inpCO2.value.trim();
        if (co2Raw === '') {
            showError('Measured CO\u2082 is required.');
            return null;
        }
        co2 = parseDecimal(co2Raw);
        if (isNaN(co2) || co2 <= 0) {
            showError('Measured CO\u2082 must be greater than zero.');
            return null;
        }
        if (co2 >= fuel.co2max) {
            showError(`Measured CO\u2082 (${co2}%) cannot exceed the theoretical maximum (${fuel.co2max}%).`);
            return null;
        }
        o2 = undefined;
    } else {
        const o2Raw = inpO2.value.trim();
        if (o2Raw === '') {
            showError('Measured O\u2082 is required.');
            return null;
        }
        o2 = parseDecimal(o2Raw);
        // Strict validation: O2 > 0 and O2 < 21
        if (isNaN(o2) || o2 <= 0 || o2 >= 21) {
            showError('Measured O\u2082 must be greater than 0 and less than 21%.');
            return null;
        }
        co2 = undefined; // core.js derives CO2 from O2 internally
    }

    const Tg = parseDecimal(tgRaw);
    const Ta = parseDecimal(taRaw);

    if (isNaN(Tg) || isNaN(Ta)) {
        showError('Temperatures must be valid numbers.');
        return null;
    }
    if (Tg > MAX_FLUE_GAS_TEMP_C) {
        showError(`Flue gas temperature must be a realistic value (up to ${MAX_FLUE_GAS_TEMP_C}\u00b0C).`);
        return null;
    }
    if (Tg <= Ta) {
        showError(`Flue gas temperature (${Tg}\u00b0C) must be higher than ambient temperature (${Ta}\u00b0C).`);
        return null;
    }

    clearError();
    return { fuel, co2, o2, Tg, Ta, mode };
}

/* ── 5. DIAGNOSTIC BADGE UPDATE ────────────────────────────────── */

/**
 * Excess air → diagnostic traffic light:
 *   < 15 %        → "Near optimal combustion"  (green)
 *   15 – 50 %     → "Acceptable combustion"    (blue)
 *   > 50 %        → "High excess air"          (orange)
 *
 * @param {number} exceso - Excess air percentage [%]
 */
function updateDiagnostic(exceso) {
    // Clear previous state classes
    diagnostic.classList.remove(
        'co-diagnostic--optimal',
        'co-diagnostic--acceptable',
        'co-diagnostic--high'
    );

    if (exceso < 15) {
        diagnostic.classList.add('co-diagnostic--optimal');
        diagText.textContent = `Near optimal combustion \u2014 Excess air: ${exceso.toFixed(2)} %`;
    } else if (exceso <= 50) {
        diagnostic.classList.add('co-diagnostic--acceptable');
        diagText.textContent = `Acceptable combustion \u2014 Excess air: ${exceso.toFixed(2)} %`;
    } else {
        diagnostic.classList.add('co-diagnostic--high');
        diagText.textContent = `High excess air \u2014 Excess air: ${exceso.toFixed(2)} %`;
    }
}

/* ── 6. RENDER RESULTS TO DOM ──────────────────────────────────── */

/**
 * Writes calculation results into the DOM result cards.
 * Updates the diagnostic badge, shows the results wrapper,
 * and scrolls to it (UX mobile).
 *
 * @param {Object} r    - Results object from core.calculate()
 * @param {Object} fuel - Fuel object { label, co2max, K }
 */
function renderResults(r, fuel) {
    // Results panel subtitle
    resSubtitle.textContent =
        `${fuel.label} \u00b7 CO\u2082 max = ${fuel.co2max} %`;

    // Metrics (2 exact decimals)
    resCO2max.textContent    = r.co2max.toFixed(2);
    resDilucion.textContent  = r.dilucion.toFixed(2);
    resExceso.textContent    = r.exceso.toFixed(2);
    resPerdidas.textContent  = r.perdidas.toFixed(2);
    resEficiencia.textContent = r.eficiencia.toFixed(2);

    // Color diagnostic
    updateDiagnostic(r.exceso);

    // Show panel
    resWrapper.classList.add('is-visible');

    // Smooth scroll to results (mobile UX)
    resWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── 7. RESET FORM ─────────────────────────────────────────────── */

/**
 * Resets all input fields and hides the results panel.
 */
function resetForm() {
    // Reset input fields
    inpCO2.value          = '';
    inpTg.value           = '';
    inpTa.value           = '';
    selFuel.value         = 'gas_natural';
    inpCustomCO2max.value = '';
    inpCustomK.value      = '';
    inpO2.value           = '';
    selMode.value         = 'co2';

    // Clear errors and results
    clearError();
    resWrapper.classList.remove('is-visible');

    // Update UI
    updateUI();

    // Reset metrics to placeholder
    resCO2max.textContent    = '\u2014';
    resDilucion.textContent  = '\u2014';
    resExceso.textContent    = '\u2014';
    resPerdidas.textContent  = '\u2014';
    resEficiencia.textContent = '\u2014';
    diagText.textContent     = '\u2014';
    resSubtitle.textContent  = '\u2014 / \u2014 / \u2014';
}

/* ── 8. EVENT LISTENERS ────────────────────────────────────────── */

// Fuel / mode selectors
selFuel.addEventListener('change', updateUI);
selMode.addEventListener('change', updateUI);

// Calculate button
btnCalculate.addEventListener('click', function () {
    const params = validateInputs();
    if (!params) return; // validation failed, error already shown

    const results = calculate(params);
    renderResults(results, params.fuel);
});

// Reset button
btnReset.addEventListener('click', resetForm);

// Enter key triggers calculation from any input
[inpCO2, inpO2, inpTg, inpTa, inpCustomCO2max, inpCustomK].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') btnCalculate.click();
    });
});

/* ── 9. INITIALISE ─────────────────────────────────────────────── */

// Set initial UI state on page load
updateUI();

