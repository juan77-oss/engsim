/**
 * simulator.js — Natural Draft Calculator
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - Input reading
 *   - Orchestration of core.js calculations
 *   - Output writing to the DOM
 *   - Chart.js rendering
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css / custom.css)
 *   - Physics (→ core.js)
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import * as core from './core.js';
import { GRAVITY, SECTION_TYPES, FLOW_INPUT_MODES } from './constants.js';

/* ── DOM references ──────────────────────────────────────────── */

// Thermal / gas inputs
const inputHeight = document.getElementById('input-height');
const inputGasTemp = document.getElementById('input-gas-temp');
const inputAmbientTemp = document.getElementById('input-ambient-temp');
const inputFurnacePress = document.getElementById('input-furnace-pressure');
const inputBaseDensity = document.getElementById('input-base-density');
const inputAlpha = document.getElementById('input-alpha');

// Section type
const selectSectionType = document.getElementById('select-section-type');
const groupCircular = document.getElementById('group-circular');
const groupRectangular = document.getElementById('group-rectangular');
const inputDiameter = document.getElementById('input-diameter');
const inputDuctWidth = document.getElementById('input-duct-width');
const inputDuctHeight = document.getElementById('input-duct-height');

// Flow mode
const selectFlowMode = document.getElementById('select-flow-mode');
const groupVelocity = document.getElementById('group-velocity');
const groupDynamicPress = document.getElementById('group-dynamic-pressure');
const inputVelocity = document.getElementById('input-velocity');
const inputDynamicPress = document.getElementById('input-dynamic-pressure');

const inputLossCoeff = document.getElementById('input-loss-coefficient');

const btnCalculate = document.getElementById('btn-calculate');
const errorEl = document.getElementById('sim-error');

// Primary results
const outAvailableDraft = document.getElementById('out-available-draft');
const outTotalRequirement = document.getElementById('out-total-requirement');
const outMargin = document.getElementById('out-margin');

// Status + interpretation banners
const statusBanner = document.getElementById('status-banner');
const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');

const interpretationBanner = document.getElementById('interpretation-banner');
const interpretationTitle = document.getElementById('interpretation-title');
const interpretationMessage = document.getElementById('interpretation-message');

// Secondary results
const outVelocity = document.getElementById('out-velocity');
const outFlowRate = document.getElementById('out-flow-rate');
const outDensity = document.getElementById('out-density');
const outKineticHead = document.getElementById('out-kinetic-head');
const outLosses = document.getElementById('out-losses');
const outHydraulicDiameter = document.getElementById('out-hydraulic-diameter');

let draftChart = null;

/* ── Error helpers ───────────────────────────────────────────── */

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('is-visible');
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
}

function markInvalid(input) {
    // The visible border lives on .sim-input-wrap, not on .sim-input itself
    // (.sim-input has border: none — see simulator.css).
    const target = input.closest('.sim-input-wrap') || input;
    target.classList.remove('sim-input--invalid');
    // Force reflow so the animation can restart if it's already running
    void target.offsetWidth;
    target.classList.add('sim-input--invalid');
}

function clearAllInvalid() {
    document.querySelectorAll('.sim-input-wrap.sim-input--invalid').forEach(el => {
        el.classList.remove('sim-input--invalid');
    });
}

/* ── Format helpers ──────────────────────────────────────────── */

function fmt(val, decimals = 2) {
    if (!isFinite(val)) return '—';
    return val.toFixed(decimals);
}

/* ── Visibility toggles ──────────────────────────────────────── */

function updateSectionVisibility() {
    const isCircular = selectSectionType.value === SECTION_TYPES.CIRCULAR;
    groupCircular.classList.toggle('is-hidden', !isCircular);
    groupRectangular.classList.toggle('is-hidden', isCircular);
}

function updateFlowModeVisibility() {
    const isVelocity = selectFlowMode.value === FLOW_INPUT_MODES.VELOCITY;
    groupVelocity.classList.toggle('is-hidden', !isVelocity);
    groupDynamicPress.classList.toggle('is-hidden', isVelocity);
}

/* ── Core calculation ────────────────────────────────────────── */

/**
 * calculate()
 * Reads inputs, validates, runs the physics chain, writes outputs.
 * Called on button click, on any input change, and on page load.
 */
function calculate() {
    clearError();
    clearAllInvalid();

    // 1. Read inputs
    const H = parseFloat(inputHeight.value);
    const tg = parseFloat(inputGasTemp.value);
    const ta = parseFloat(inputAmbientTemp.value);
    const pm = parseFloat(inputFurnacePress.value);
    const baseDensity = parseFloat(inputBaseDensity.value);
    const alpha = parseFloat(inputAlpha.value);
    const J = parseFloat(inputLossCoeff.value);

    const sectionType = selectSectionType.value;
    const flowMode = selectFlowMode.value;

    const d = parseFloat(inputDiameter.value);
    const a = parseFloat(inputDuctWidth.value);
    const b = parseFloat(inputDuctHeight.value);

    const wInput = parseFloat(inputVelocity.value);
    const pdinInput = parseFloat(inputDynamicPress.value);

    // 2. Validate
    const invalidInputs = [];
    if (isNaN(H) || H <= 0) invalidInputs.push(inputHeight);
    if (isNaN(tg)) invalidInputs.push(inputGasTemp);
    if (isNaN(ta)) invalidInputs.push(inputAmbientTemp);
    if (isNaN(pm)) invalidInputs.push(inputFurnacePress);
    if (isNaN(baseDensity) || baseDensity <= 0) invalidInputs.push(inputBaseDensity);
    if (isNaN(alpha) || alpha < 0) invalidInputs.push(inputAlpha);
    if (isNaN(J) || J < 0) invalidInputs.push(inputLossCoeff);

    if (sectionType === SECTION_TYPES.CIRCULAR) {
        if (isNaN(d) || d <= 0) invalidInputs.push(inputDiameter);
    } else {
        if (isNaN(a) || a <= 0) invalidInputs.push(inputDuctWidth);
        if (isNaN(b) || b <= 0) invalidInputs.push(inputDuctHeight);
    }

    if (flowMode === FLOW_INPUT_MODES.VELOCITY) {
        if (isNaN(wInput) || wInput <= 0) invalidInputs.push(inputVelocity);
    } else {
        if (isNaN(pdinInput) || pdinInput <= 0) invalidInputs.push(inputDynamicPress);
    }

    if (invalidInputs.length > 0) {
        invalidInputs.forEach(markInvalid);
        showError('Please fill in all fields with valid values (positive where required) before calculating.');
        return;
    }

    // 3. Duct geometry
    let area, wettedPerimeter;
    if (sectionType === SECTION_TYPES.CIRCULAR) {
        area = core.calculateCircularArea(d);
        wettedPerimeter = core.calculateCircularPerimeter(d);
    } else {
        area = core.calculateRectangularArea(a, b);
        wettedPerimeter = core.calculateRectangularWettedPerimeter(a, b);
    }
    const hydraulicDiameter = core.calculateHydraulicDiameter(area, wettedPerimeter);

    // 4. Gas properties
    const absolutePressure = core.calculateAbsolutePressure(pm);
    const density = core.calculateGasDensity({
        absolutePressure,
        temperatureC: tg,
        baseDensity
    });

    // 5. Flow velocity (direct input or derived from dynamic pressure)
    const velocity = flowMode === FLOW_INPUT_MODES.VELOCITY
        ? wInput
        : core.calculateVelocityFromDynamicPressure(pdinInput, density);

    const flowRate = core.calculateFlowRate(area, velocity);

    // 6. Energy balance
    const kineticHead = core.calculateKineticHead(velocity, density, GRAVITY);
    const resistiveLosses = core.calculateResistiveLosses(velocity, density, J, GRAVITY);
    const totalRequirement = kineticHead + resistiveLosses;

    const availableDraft = core.calculateNaturalDraft(H, tg, ta, baseDensity, alpha);

    const balance = core.evaluateDraftBalance(availableDraft, totalRequirement);

    const state = { tg, ta, w: velocity, sectionType, width: a, height: b, pm };
    const fluid = { velocity, flowRate, flowMode };
    const interpretation = core.generatePhysicalInterpretation(
        state,
        balance.margin,
        availableDraft,
        totalRequirement,
        fluid
    );

    // 7. Write primary results
    outAvailableDraft.textContent = fmt(availableDraft, 3);
    outTotalRequirement.textContent = fmt(totalRequirement, 3);
    outMargin.textContent = fmt(balance.margin, 3);

    // 8. Status banner
    statusTitle.textContent = balance.status;
    statusMessage.textContent = balance.message;
    statusBanner.className = `status-banner status-banner--${balance.severity}`;

    // 9. Interpretation banner
    interpretationTitle.textContent = interpretation.title;
    interpretationMessage.textContent = interpretation.message;
    interpretationBanner.className = `status-banner status-banner--${interpretation.severity}`;

    // 10. Secondary results
    outVelocity.textContent = fmt(velocity, 2);
    outFlowRate.textContent = fmt(flowRate * 3600, 1); // m3/s -> m3/h
    outDensity.textContent = fmt(density, 3);
    outKineticHead.textContent = fmt(kineticHead, 3);
    outLosses.textContent = fmt(resistiveLosses, 3);
    outHydraulicDiameter.textContent = fmt(hydraulicDiameter, 3);

    // 11. Chart
    updateChart(availableDraft, kineticHead, resistiveLosses);
}

/* ── Chart ────────────────────────────────────────────────────── */

function updateChart(availableDraft, kineticHead, resistiveLosses) {
    const canvas = document.getElementById('sim-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const data = {
        labels: ['Available Draft', 'Total Requirement'],
        datasets: [
            {
                label: 'Available Draft',
                data: [Number(availableDraft.toFixed(3)), 0],
                backgroundColor: '#2563eb'
            },
            {
                label: 'Kinetic Head',
                data: [0, Number(kineticHead.toFixed(3))],
                backgroundColor: '#f59e0b'
            },
            {
                label: 'Resistive Losses',
                data: [0, Number(resistiveLosses.toFixed(3))],
                backgroundColor: '#ef4444'
            }
        ]
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { stacked: true },
            y: { stacked: true, title: { display: true, text: 'mmH2O' } }
        },
        plugins: {
            legend: { position: 'bottom' }
        }
    };

    if (draftChart) {
        draftChart.data = data;
        draftChart.options = options;
        draftChart.update();
    } else {
        draftChart = new Chart(canvas, { type: 'bar', data, options });
    }
}

/* ── Event listeners ─────────────────────────────────────────── */

selectSectionType.addEventListener('change', () => {
    updateSectionVisibility();
    calculate();
});

selectFlowMode.addEventListener('change', () => {
    updateFlowModeVisibility();
    calculate();
});

btnCalculate.addEventListener('click', calculate);

[
    inputHeight, inputGasTemp, inputAmbientTemp, inputFurnacePress,
    inputBaseDensity, inputAlpha, inputDiameter, inputDuctWidth,
    inputDuctHeight, inputVelocity, inputDynamicPress, inputLossCoeff
].forEach(el => el.addEventListener('input', calculate));

/* ── Initial state on page load ─────────────────────────────── */

updateSectionVisibility();
updateFlowModeVisibility();
calculate();