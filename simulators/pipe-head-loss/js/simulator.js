/**
 * simulator.js — Pipe Head Loss (Darcy-Weisbach)
 * EngSim
 * ─────────────────────────────────────────────────────────────────
 * Flat script. Reads static DOM inputs, computes physics via
 * core.js, writes results/charts back to the DOM. No framework,
 * no window.IEM registry — matches the EngSim template pattern.
 */

import {
    validateInputs,
    deriveProperties,
    calcHeadLoss,
    getInterpretation,
    generateLossCurve,
    generateOperatingPoint,
    generateOptimizationCurve,
    findCommercialSolutions,
    getOptimizationStatus,
} from './core.js';

import { BASE_STEPS, VELOCITY_MIN_SAFE, VELOCITY_MAX_SAFE } from './constants.js';

// ── State ────────────────────────────────────────────────────────
const state = {
    inputs:  { D: 0.1, L: 100, Q: 0.02, eps_mm: 0.05, method: 'swamee' },
    derived: {},
};

let lossChart  = null;
let optimChart = null;

// ── DOM helpers ──────────────────────────────────────────────────
const el = id => document.getElementById(id);

function showError(msg) {
    const box = el('sim-error');
    if (box) {
        box.textContent = msg;
        box.classList.add('is-visible');
    }
    ['out-v', 'out-re', 'out-f', 'out-h'].forEach(id => { const e = el(id); if (e) e.textContent = '—'; });
    showOptimEmptyState('Invalid inputs — enter valid parameters to analyze.');
}

function clearError() {
    const box = el('sim-error');
    if (box) {
        box.classList.remove('is-visible');
        box.textContent = '';
    }
}

function fmt(value, decimals = 3) {
    if (!Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1)    return value.toFixed(Math.min(decimals, 3));
    if (abs >= 0.01) return value.toFixed(decimals + 1);
    return value.toFixed(decimals + 2);
}

function fmtHydraulic(v) {
    if (v === 0)      return '0';
    if (v < 0.0001)   return v.toFixed(6);
    if (v < 0.001)    return v.toFixed(5);
    if (v < 0.01)     return v.toFixed(4);
    if (v < 1)        return v.toFixed(3);
    return v.toFixed(2);
}

// ── Theme-aware chart colors (read live, no MutationObserver needed) ──
function themeColors() {
    const s = getComputedStyle(document.documentElement);
    const isDark = document.body.classList.contains('dark');
    return {
        grid:    isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)',
        text:    (s.getPropertyValue('--text-muted') || '#64748b').trim(),
        accent:  (s.getPropertyValue('--brand-accent') || '#2563eb').trim(),
        danger:  (s.getPropertyValue('--color-danger') || '#dc2626').trim(),
        warning: (s.getPropertyValue('--color-warning') || '#d97706').trim(),
        success: (s.getPropertyValue('--color-success') || '#16a34a').trim(),
    };
}

// ── Read inputs from static DOM ─────────────────────────────────────
function readInputs() {
    return {
        D:      parseFloat(el('in-D').value),
        L:      parseFloat(el('in-L').value),
        Q:      parseFloat(el('in-Q').value),
        eps_mm: parseFloat(el('in-eps').value),
        method: el('sel-method').value,
    };
}

// ── Slider ↔ number sync ────────────────────────────────────────────
function syncPair(sliderId, inputId) {
    const slider = el(sliderId), input = el(inputId);
    if (!slider || !input) return;
    slider.addEventListener('input', () => { input.value = slider.value; scheduleUpdate(); });
    input.addEventListener('input',  () => { slider.value = input.value; scheduleUpdate(); });
}

// ── Precision readouts ───────────────────────────────────────────────
function updatePrecisionReadouts() {
    const qEl   = el('precision-Q-value');
    const epsEl = el('precision-eps-value');
    if (qEl)   qEl.textContent   = state.inputs.Q.toFixed(6);
    if (epsEl) epsEl.textContent = state.inputs.eps_mm.toFixed(6);
}

// ── Material presets ─────────────────────────────────────────────────
function setupMaterialPresets() {
    const preset    = el('material-preset');
    const epsSlider = el('sl-eps');
    const epsInput  = el('in-eps');
    if (!preset || !epsInput) return;

    preset.addEventListener('change', () => {
        if (preset.value !== 'custom') {
            epsInput.value = preset.value;
            if (epsSlider) epsSlider.value = preset.value;
            scheduleUpdate();
        }
    });

    const markCustom = () => { if (preset.value !== 'custom') preset.value = 'custom'; };
    epsSlider?.addEventListener('input', markCustom);
    epsInput.addEventListener('input', markCustom);
}

// ── Fine sensitivity control ─────────────────────────────────────────
function setupSensitivityControl() {
    const sens = el('sens-Q');
    if (!sens) return;

    sens.addEventListener('change', () => {
        const factor = parseFloat(sens.value);
        if (!Number.isFinite(factor)) return;

        const stepQ   = (BASE_STEPS.Q * factor).toFixed(10).replace(/\.?0+$/, '');
        const stepEps = (BASE_STEPS.eps_mm * factor).toFixed(10).replace(/\.?0+$/, '');

        ['sl-Q', 'in-Q'].forEach(id => { const e = el(id); if (e) e.step = stepQ; });
        ['sl-eps', 'in-eps'].forEach(id => { const e = el(id); if (e) e.step = stepEps; });
    });
}

// ═══════════════════════════════════════════════════════════════
//  CHARTS
// ═══════════════════════════════════════════════════════════════

function initLossChart() {
    const canvas = el('lossChart');
    if (!canvas || !window.Chart) return null;
    const c = themeColors();
    canvas.style.maxHeight = '350px';

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: 'Head Loss H (m)', data: [], borderColor: c.accent, backgroundColor: 'rgba(37,99,235,.1)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0 },
                { label: 'Operating Point', data: [], type: 'scatter', backgroundColor: c.danger, borderColor: '#fff', borderWidth: 2, pointRadius: 6, pointHoverRadius: 8 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Flow Rate Q (m³/s)', color: c.text }, grid: { color: c.grid }, ticks: { color: c.text, callback: v => fmtHydraulic(v) } },
                y: { type: 'linear', title: { display: true, text: 'Head Loss H (m)', color: c.text }, grid: { color: c.grid }, ticks: { color: c.text, callback: v => fmtHydraulic(v) } },
            },
            plugins: {
                legend: { labels: { color: c.text, boxWidth: 12 } },
                tooltip: { callbacks: { label: ctx => `Q: ${fmtHydraulic(ctx.parsed.x)} m³/s | H: ${fmtHydraulic(ctx.parsed.y)} m` } },
            },
        },
    });
}

function updateLossChart(curve, op) {
    if (!lossChart) return;
    lossChart.data.datasets[0].data = curve;
    lossChart.data.datasets[1].data = op ? [op] : [];

    if (curve.length > 0) {
        const minH = Math.min(...curve.map(p => p.y));
        const maxH = Math.max(...curve.map(p => p.y));
        const maxQ = Math.max(...curve.map(p => p.x));
        const padding = Math.max(maxH * 0.15, 0.0005);
        lossChart.options.scales.y.min = Math.max(minH - padding, 0);
        lossChart.options.scales.y.max = maxH + padding;
        lossChart.options.scales.x.max = Math.max(maxQ * 1.05, 0.001);
    }
    lossChart.update('none');
}

function initOptimChart() {
    const canvas = el('optimChart');
    if (!canvas || !window.Chart) return null;
    const c = themeColors();
    canvas.style.maxHeight = '350px';

    return new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            datasets: [
                { label: `Valid Zone (${VELOCITY_MIN_SAFE}–${VELOCITY_MAX_SAFE} m/s)`, data: [], borderColor: c.success, backgroundColor: 'rgba(16,185,129,.05)', fill: true, tension: .3, pointRadius: 0, borderWidth: 3 },
                { label: `Sedimentation Risk (<${VELOCITY_MIN_SAFE} m/s)`, data: [], borderColor: c.warning, borderDash: [5, 5], pointRadius: 0, fill: false, tension: .3 },
                { label: `Erosion Risk (>${VELOCITY_MAX_SAFE} m/s)`, data: [], borderColor: c.danger, borderDash: [5, 5], pointRadius: 0, fill: false, tension: .3 },
                { label: 'Current System', data: [], type: 'scatter', backgroundColor: c.accent, borderColor: '#fff', borderWidth: 2, pointRadius: 7, order: -1 },
                { label: 'Optimal Recommendation', data: [], type: 'scatter', backgroundColor: '#facc15', borderColor: '#fff', borderWidth: 2, pointRadius: 10, pointStyle: 'star', order: -2 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', intersect: false },
            scales: {
                x: { type: 'linear', title: { display: true, text: 'Diameter D (m)', color: c.text }, grid: { color: c.grid }, ticks: { color: c.text } },
                y: { type: 'linear', title: { display: true, text: 'Head Loss H (m)', color: c.text }, grid: { color: c.grid }, ticks: { color: c.text } },
            },
            plugins: {
                legend: { labels: { color: c.text } },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const p  = ctx.raw;
                            const v  = p.velocity ?? 0;
                            const st = v < VELOCITY_MIN_SAFE ? '⚠ Sedimentation' : v > VELOCITY_MAX_SAFE ? '⚠ Erosion' : '✔ Valid';
                            return [`D: ${p.x.toFixed(3)} m`, `H: ${p.y.toFixed(3)} m`, `v: ${v.toFixed(2)} m/s`, `Status: ${st}`];
                        },
                    },
                },
            },
        },
    });
}

function updateOptimChart(datasets, currentPoint, best, isOptimized) {
    if (!optimChart) return;
    optimChart.data.datasets[0].data = datasets.valid;
    optimChart.data.datasets[1].data = datasets.low;
    optimChart.data.datasets[2].data = datasets.high;
    optimChart.data.datasets[3].data = currentPoint ? [currentPoint] : [];
    optimChart.data.datasets[3].label = isOptimized ? 'Optimized System' : 'Current System';
    optimChart.data.datasets[4].data = (best && !isOptimized) ? [{ x: best.D, y: best.hf }] : [];
    optimChart.update('none');
}

// ── Dark mode re-theming ──────────────────────────────────────────
function reThemeCharts() {
    const c = themeColors();

    if (lossChart) {
        ['x', 'y'].forEach(axis => {
            lossChart.options.scales[axis].ticks.color = c.text;
            lossChart.options.scales[axis].grid.color  = c.grid;
            if (lossChart.options.scales[axis].title) lossChart.options.scales[axis].title.color = c.text;
        });
        lossChart.options.plugins.legend.labels.color = c.text;
        lossChart.data.datasets[0].borderColor = c.accent;
        lossChart.data.datasets[1].backgroundColor = c.danger;
        lossChart.update('none');
    }

    if (optimChart) {
        ['x', 'y'].forEach(axis => {
            optimChart.options.scales[axis].ticks.color = c.text;
            optimChart.options.scales[axis].grid.color  = c.grid;
            if (optimChart.options.scales[axis].title) optimChart.options.scales[axis].title.color = c.text;
        });
        optimChart.options.plugins.legend.labels.color = c.text;
        optimChart.data.datasets[0].borderColor = c.success;
        optimChart.data.datasets[1].borderColor = c.warning;
        optimChart.data.datasets[2].borderColor = c.danger;
        optimChart.data.datasets[3].backgroundColor = c.accent;
        optimChart.update('none');
    }
}

new MutationObserver(reThemeCharts)
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });

// ═══════════════════════════════════════════════════════════════
//  DECISION ENGINE PANEL — status banner + velocity gauge
// ═══════════════════════════════════════════════════════════════

function renderOptimizationStatus(status) {
    const banner = el('opt-status-banner');
    const title   = el('opt-status-title');
    const msg     = el('opt-status-message');

    const titles = { success: 'Optimal', warning: 'Attention', danger: 'Infeasible', info: 'Analysis' };

    if (banner) banner.className = `status-banner status-banner--${status.level}`;
    if (title)  title.textContent = titles[status.level] ?? 'Analysis';
    if (msg)    msg.textContent   = status.message;

    const pct    = v => Math.min(100, Math.max(0, (v / status.gaugeMax) * 100));
    const minPct = pct(status.minSafe);
    const maxPct = pct(status.maxSafe);
    const curPct = pct(status.velocity);

    const zoneLow  = el('phl-gauge-zone-low');
    const zoneMid  = el('phl-gauge-zone-mid');
    const zoneHigh = el('phl-gauge-zone-high');
    const marker   = el('phl-gauge-marker');
    const valueLbl = el('phl-gauge-value');

    if (zoneLow)  zoneLow.style.width  = `${minPct}%`;
    if (zoneMid)  { zoneMid.style.left = `${minPct}%`; zoneMid.style.width = `${maxPct - minPct}%`; }
    if (zoneHigh) { zoneHigh.style.left = `${maxPct}%`; zoneHigh.style.width = `${100 - maxPct}%`; }
    if (marker)   marker.style.left = `${curPct}%`;
    if (valueLbl) valueLbl.textContent = `${status.velocity.toFixed(2)} m/s`;
}

function showOptimEmptyState(msg) {
    el('opt-chart-wrap')?.classList.add('is-hidden');
    el('opt-insights')?.classList.add('is-hidden');
    el('opt-empty-state')?.classList.remove('is-hidden');
    const m = el('opt-empty-message');
    if (m) m.textContent = msg;
}

function hideOptimEmptyState() {
    el('opt-chart-wrap')?.classList.remove('is-hidden');
    el('opt-insights')?.classList.remove('is-hidden');
    el('opt-empty-state')?.classList.add('is-hidden');
}

function renderOptimization(results) {
    if (state.inputs.Q < 1e-6) {
        showOptimEmptyState('No flow → no head losses to evaluate');
        return;
    }

    const datasets = generateOptimizationCurve(state);
    const total = datasets.valid.length + datasets.low.length + datasets.high.length;

    if (total < 3) {
        showOptimEmptyState('Insufficient valid points for analysis');
        return;
    }
    if (datasets.valid.length === 0) {
        showOptimEmptyState('The system cannot operate in safe velocity ranges at the current flow rate.');
        return;
    }

    const best        = findCommercialSolutions(state, results);
    const isOptimized  = best ? Math.abs(state.inputs.D - best.D) / state.inputs.D < 0.02 : false;

    hideOptimEmptyState();
    updateOptimChart(datasets, { x: state.inputs.D, y: results.headLoss }, best, isOptimized);

    const status = getOptimizationStatus(best, isOptimized, datasets.valid.length > 0, state);
    renderOptimizationStatus(status);
}

// ═══════════════════════════════════════════════════════════════
//  RESULTS TABLE
// ═══════════════════════════════════════════════════════════════

function renderResults(results, method) {
    el('out-v').textContent  = fmt(results.velocity, 2);
    el('out-re').textContent = Math.round(results.Reynolds).toLocaleString('en-US');
    el('out-f').textContent  = fmt(results.frictionFactor, 4);
    el('out-h').textContent  = fmt(results.headLoss, 2);

    const badge = el('out-regime-badge');
    if (badge) badge.textContent = results.regime.charAt(0).toUpperCase() + results.regime.slice(1);

    const methodTag = el('out-method-tag');
    if (methodTag) methodTag.textContent = method === 'colebrook' ? 'Colebrook-White' : 'Swamee-Jain';
}

// ═══════════════════════════════════════════════════════════════
//  MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════

function calculate() {
    Object.assign(state.inputs, readInputs());

    const validation = validateInputs(state.inputs);
    if (!validation.valid) { showError(validation.errors[0]); return; }
    clearError();

    state.derived = deriveProperties(state.inputs);
    const results = calcHeadLoss(state.derived, state.inputs);
    if (!results.valid) { showError(results.errors?.[0]?.message ?? 'Calculation error'); return; }

    renderResults(results, state.inputs.method);

    const interpEl = el('interpretation-text');
    if (interpEl) interpEl.innerHTML = getInterpretation(results, state.inputs, state.derived);

    updateLossChart(generateLossCurve(state), generateOperatingPoint(state));
    renderOptimization(results);
    updatePrecisionReadouts();
}

// ── requestAnimationFrame debounce ───────────────────────────────────
let raf = null;
function scheduleUpdate() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { raf = null; calculate(); });
}

// ═══════════════════════════════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

syncPair('sl-D', 'in-D');
syncPair('sl-L', 'in-L');
syncPair('sl-Q', 'in-Q');
syncPair('sl-eps', 'in-eps');
el('sel-method')?.addEventListener('change', scheduleUpdate);
el('btn-calculate')?.addEventListener('click', calculate);

setupMaterialPresets();
setupSensitivityControl();

lossChart  = initLossChart();
optimChart = initOptimChart();

calculate();
