/**
 * simulator.js — Entropy T-s Diagram Simulator
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Reads the DOM, calls the physics engine (core.js), and
 *           writes results + chart back to the DOM. Flat module script,
 *           no framework, follows the EngSim template pattern.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { EntropyCore } from './core.js';
import { INPUT_RANGES, PROCESS_TYPES, TARGET_FIELD_CONFIG } from './constants.js';

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — DOM Refs & Helpers
// ─────────────────────────────────────────────────────────────────────────────

const el = (id) => document.getElementById(id);

const errorBox = el('sim-error');

function fmt(n, decimals = 3) {
    return Number.isFinite(n) ? n.toFixed(decimals) : '—';
}

function getVal(id, fallback = 0) {
    const input = el(id);
    const n = parseFloat(input?.value);
    return Number.isFinite(n) ? n : fallback;
}

function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.add('is-visible');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.remove('is-visible');
}

function markInvalid(wrapId) {
    const wrap = el(wrapId);
    if (!wrap) return;
    wrap.classList.remove('sim-input--invalid');
    // Force reflow so the shake animation can replay on repeated errors
    void wrap.offsetWidth;
    wrap.classList.add('sim-input--invalid');
}

function clearInvalid(wrapId) {
    const wrap = el(wrapId);
    if (wrap) wrap.classList.remove('sim-input--invalid');
}

function syncInputSlider(inputEl, sliderEl, cb) {
    if (!inputEl || !sliderEl) return;
    inputEl.addEventListener('input', (e) => {
        sliderEl.value = e.target.value;
        cb();
    });
    sliderEl.addEventListener('input', (e) => {
        inputEl.value = e.target.value;
        cb();
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — Chart.js Setup
// ─────────────────────────────────────────────────────────────────────────────

let chart = null;

function getThemeColors() {
    const isDark = document.body.classList.contains('dark');
    return {
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        text: isDark ? '#9ca3af' : '#64748b',
        path: isDark ? '#60a5fa' : '#1a3a5c',
        pathIrrev: isDark ? '#f59e0b' : '#2563eb',
        state1: isDark ? '#60a5fa' : '#1a3a5c',
        state2: isDark ? '#f59e0b' : '#2e6da4'
    };
}

function initChart() {
    const canvas = el('entropy-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const c = getThemeColors();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Process Path',
                    data: [],
                    borderColor: c.path,
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.2
                },
                {
                    label: 'Initial State (1)',
                    data: [],
                    backgroundColor: c.state1,
                    borderColor: '#fff',
                    borderWidth: 2,
                    pointRadius: 6,
                    showLine: false
                },
                {
                    label: 'Final State (2)',
                    data: [],
                    backgroundColor: c.state2,
                    borderColor: '#fff',
                    borderWidth: 2,
                    pointRadius: 6,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Entropy Variation, s − s₁ [kJ/kg·K]', color: c.text },
                    grid: { color: c.grid },
                    ticks: { color: c.text }
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Temperature, T [K]', color: c.text },
                    grid: { color: c.grid },
                    ticks: { color: c.text }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx2) => `s: ${ctx2.raw.x.toFixed(3)}, T: ${ctx2.raw.y.toFixed(0)} K`
                    }
                }
            }
        }
    });
}

function updateChart(state1, result, isIrreversible) {
    if (!chart) return;
    const { points, ds, T2 } = result;
    const c = getThemeColors();

    chart.data.datasets[0].data = points;
    chart.data.datasets[0].borderColor = isIrreversible ? c.pathIrrev : c.path;
    chart.data.datasets[1].data = [{ x: 0, y: state1.t }];
    chart.data.datasets[2].data = [{ x: ds, y: T2 }];

    // Scale axes to the full path, not just the two endpoints — avoids
    // clipping if an intermediate point ever falls outside [0, ds] or
    // [T1, T2].
    const allS = points.map((p) => p.x).concat([0, ds]);
    const allT = points.map((p) => p.y).concat([state1.t, T2]);
    const sMin = Math.min(...allS);
    const sMax = Math.max(...allS);
    const sPad = Math.max(0.05, (sMax - sMin) * 0.15);

    chart.options.scales.x.min = sMin - sPad;
    chart.options.scales.x.max = sMax + sPad;
    chart.options.scales.y.min = Math.min(...allT) - 40;
    chart.options.scales.y.max = Math.max(...allT) + 40;

    chart.update();
}

function reThemeChart() {
    if (!chart) return;
    const c = getThemeColors();
    chart.data.datasets[0].borderColor = currentState.isIrreversible ? c.pathIrrev : c.path;
    chart.data.datasets[1].backgroundColor = c.state1;
    chart.data.datasets[2].backgroundColor = c.state2;
    chart.options.scales.x.title.color = c.text;
    chart.options.scales.x.grid.color = c.grid;
    chart.options.scales.x.ticks.color = c.text;
    chart.options.scales.y.title.color = c.text;
    chart.options.scales.y.grid.color = c.grid;
    chart.options.scales.y.ticks.color = c.text;
    chart.update();
}

// Redraw chart colors whenever dark mode is toggled (platform.js flips body.dark)
new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.attributeName === 'class') reThemeChart();
    }
}).observe(document.body, { attributes: true });

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — Results Rendering
// ─────────────────────────────────────────────────────────────────────────────

function setStatusBanner(title, message, variant) {
    const banner = el('res-indicator');
    const titleEl = el('res-indicator-title');
    const msgEl = el('res-indicator-message');
    if (!banner) return;

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    banner.classList.remove('status-banner--success', 'status-banner--warning', 'status-banner--danger', 'status-banner--info');
    banner.classList.add('status-banner', `status-banner--${variant}`);
}

function updateResults(result, isIrreversible) {
    const { ds, q, sgen } = result;

    el('res-ds') && (el('res-ds').textContent = fmt(ds, 3));
    el('res-q') && (el('res-q').textContent = fmt(q, 1));

    const sgenCard = el('res-sgen-card');

    if (isIrreversible) {
        if (sgenCard) sgenCard.classList.remove('is-hidden');
        el('res-sgen') && (el('res-sgen').textContent = fmt(sgen, 3));

        if (sgen > 0) {
            setStatusBanner('Irreversible process', 'Entropy is generated internally (Sgen > 0) due to the process efficiency below 1.0.', 'warning');
        } else {
            setStatusBanner('Reversible process', 'No internal entropy generation (Sgen ≈ 0) at this efficiency.', 'success');
        }
    } else {
        if (sgenCard) sgenCard.classList.add('is-hidden');

        if (ds > 0.001) {
            setStatusBanner('Entropy increases', 'Heat is transferred into the system during this process.', 'info');
        } else if (ds < -0.001) {
            setStatusBanner('Entropy decreases', 'Heat is rejected from the system (cooling).', 'danger');
        } else {
            setStatusBanner('Ideal reversible process', 'Isentropic — entropy stays constant (ΔS ≈ 0).', 'success');
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — State & Main Calculation
// ─────────────────────────────────────────────────────────────────────────────

function getProcessConfig(processValue) {
    return PROCESS_TYPES.find((p) => p.value === processValue) || PROCESS_TYPES[0];
}

let currentState = {
    T1: INPUT_RANGES.T1.default,
    P1: INPUT_RANGES.P1.default,
    target: INPUT_RANGES.P2.default,
    targetMode: 'P2',
    process: 'isothermal',
    n: INPUT_RANGES.n.default,
    eta: INPUT_RANGES.eta.default,
    isIrreversible: false,
    result: null
};

function calculate() {
    clearError();
    clearInvalid('wrap-t1');
    clearInvalid('wrap-p1');
    clearInvalid('wrap-target');

    currentState.T1 = getVal('input-t1', INPUT_RANGES.T1.default);
    currentState.P1 = getVal('input-p1', INPUT_RANGES.P1.default);
    currentState.n = getVal('input-n', INPUT_RANGES.n.default);

    const processSelect = el('select-process');
    currentState.process = processSelect ? processSelect.value : 'isothermal';

    const processConfig = getProcessConfig(currentState.process);
    currentState.targetMode = processConfig.target; // 'P2' (pressure-driven) or 'T2' (temperature-driven)

    const targetRange = TARGET_FIELD_CONFIG[currentState.targetMode].range;
    currentState.target = getVal('input-target', targetRange.default);

    const irrevControls = el('irrev-controls');
    currentState.isIrreversible = irrevControls ? irrevControls.open : false;
    currentState.eta = currentState.isIrreversible
        ? getVal('input-eta', INPUT_RANGES.eta.default)
        : 1.0;

    // Validation — physical quantities must be positive
    let hasError = false;
    if (!(currentState.T1 > 0)) {
        markInvalid('wrap-t1');
        hasError = true;
    }
    if (!(currentState.P1 > 0)) {
        markInvalid('wrap-p1');
        hasError = true;
    }
    if (!(currentState.target > 0)) {
        markInvalid('wrap-target');
        hasError = true;
    }
    if (hasError) {
        showError('Temperature and pressure values must be positive.');
        return;
    }

    const coreParams = {
        T1: currentState.T1,
        P1: currentState.P1,
        process: currentState.process,
        n: currentState.n,
        eta: currentState.eta
    };
    if (currentState.targetMode === 'P2') {
        coreParams.P2 = currentState.target;
    } else {
        coreParams.T2 = currentState.target;
    }

    try {
        const result = EntropyCore(coreParams);
        currentState.result = result;

        el('res-v1') && (el('res-v1').textContent = fmt(result.v1, 4));

        updateResults(result, currentState.isIrreversible);
        updateChart({ t: currentState.T1, p: currentState.P1 }, result, currentState.isIrreversible);
    } catch (err) {
        console.error('Entropy simulation error:', err);
        showError('Could not compute this process with the given inputs.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — Event Bindings
// ─────────────────────────────────────────────────────────────────────────────

// Apply min/max/step from constants.js to each slider/input pair so
// INPUT_RANGES stays the single source of truth (HTML no longer hardcodes
// its own copies that could drift out of sync).
function applyRange(inputId, sliderId, range) {
    [el(inputId), el(sliderId)].forEach((node) => {
        if (!node) return;
        node.min = range.min;
        node.max = range.max;
        node.step = range.step;
    });
}
applyRange('input-t1', 'slider-t1', INPUT_RANGES.T1);
applyRange('input-p1', 'slider-p1', INPUT_RANGES.P1);
applyRange('input-n', 'slider-n', INPUT_RANGES.n);
applyRange('input-eta', 'slider-eta', INPUT_RANGES.eta);

// Target field (P₂ or T₂) changes label/unit/range depending on process —
// keep it in sync from a single place.
let lastTargetMode = null;

function applyTargetField(mode, resetValue) {
    const cfg = TARGET_FIELD_CONFIG[mode];
    if (!cfg) return;

    const label = el('label-target');
    const unit = el('unit-target');
    const input = el('input-target');
    const slider = el('slider-target');

    if (label) label.textContent = cfg.label;
    if (unit) unit.textContent = cfg.unit;
    applyRange('input-target', 'slider-target', cfg.range);

    if (resetValue) {
        if (input) input.value = cfg.range.default;
        if (slider) slider.value = cfg.range.default;
    }
}

applyTargetField('P2', false);
lastTargetMode = 'P2';

syncInputSlider(el('input-t1'), el('slider-t1'), calculate);
syncInputSlider(el('input-p1'), el('slider-p1'), calculate);
syncInputSlider(el('input-target'), el('slider-target'), calculate);
syncInputSlider(el('input-n'), el('slider-n'), calculate);
syncInputSlider(el('input-eta'), el('slider-eta'), calculate);

const selectProcess = el('select-process');
if (selectProcess) {
    selectProcess.addEventListener('change', (e) => {
        const field = el('field-n');
        if (field) {
            field.classList.toggle('is-hidden', e.target.value !== 'polytropic');
        }

        const config = getProcessConfig(e.target.value);
        const modeChanged = config.target !== lastTargetMode;
        applyTargetField(config.target, modeChanged);
        lastTargetMode = config.target;

        calculate();
    });
}

const irrevControls = el('irrev-controls');
if (irrevControls) {
    irrevControls.addEventListener('toggle', calculate);
}

const btnCalculate = el('btn-calculate');
if (btnCalculate) {
    btnCalculate.addEventListener('click', calculate);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — Initialization
// ─────────────────────────────────────────────────────────────────────────────

initChart();
calculate();
