/**
 * simulator.js — Static Beam Simulator · UI Layer
 */

import { calculatePhysics } from './core.js';
import { BEAM_LIMITS, NUMERICS, LOAD_PALETTE } from './constants.js';

// ─────────────────────────────────────────────────────────────────
//  CSS variable helper
// ─────────────────────────────────────────────────────────────────
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ─────────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────────
let loads = [];
let loadIdCt = 0;
let charts = { shear: null, moment: null, deflection: null };
let DOM = {};

// ─────────────────────────────────────────────────────────────────
//  Error handling — with scroll + shake
// ─────────────────────────────────────────────────────────────────

/**
 * Shows the error banner and scrolls it into view.
 * If a specific input element is provided it gets a red shake animation.
 * @param {string}          msg
 * @param {HTMLElement|null} [badInput]
 */
function showError(msg, badInput = null) {
    DOM.errorBox.textContent = msg;
    DOM.errorBox.style.display = 'block';

    // Scroll the error banner into view regardless of scroll position
    DOM.errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Shake + red border on the offending input
    if (badInput) {
        badInput.classList.remove('input-error'); // reset to retrigger animation
        void badInput.offsetWidth;               // reflow
        badInput.classList.add('input-error');
        const wrap = badInput.closest('.sim-input-wrap') || badInput.parentElement;
        if (wrap) {
            wrap.classList.remove('input-error-wrap');
            void wrap.offsetWidth;
            wrap.classList.add('input-error-wrap');
        }
        setTimeout(() => {
            badInput.classList.remove('input-error');
        }, 600);
    }
}

function clearError() {
    DOM.errorBox.textContent = '';
    DOM.errorBox.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────
//  Load card management
// ─────────────────────────────────────────────────────────────────

function currentL() {
    return parseFloat(DOM.inputL.value) || 10;
}

function addLoad(type) {
    const id = ++loadIdCt;
    const colorIdx = loads.length % LOAD_PALETTE.length;
    const L = currentL();

    // Sensible defaults: midspan for point, full span for distributed
    if (type === 'point') {
        loads.push({ id, type, colorIdx, P: 10, a: +(L / 2).toFixed(2) });
    } else {
        loads.push({ id, type, colorIdx, w: 5, a: 0, b: L });
    }
    renderLoadCards();
}

function removeLoad(id) {
    loads = loads.filter(l => l.id !== id);
    renderLoadCards();
}

function readLoadCard(id) {
    const card = document.getElementById(`load-card-${id}`);
    if (!card) return null;
    const type = card.dataset.type;
    const get = field => parseFloat(card.querySelector(`[data-field="${field}"]`).value);

    if (type === 'point') {
        return { id, type, P: get('P'), a: get('a') };
    } else {
        return { id, type, w: get('w'), a: get('a'), b: get('b') };
    }
}

function renderLoadCards() {
    const container = DOM.loadList;
    container.innerHTML = '';

    if (loads.length === 0) {
        container.innerHTML = `
            <p class="sim-empty-state">
                No loads added yet.<br>Use the buttons above to add a load.
            </p>`;
        return;
    }

    const L = currentL();

    loads.forEach((load, idx) => {
        const palette = LOAD_PALETTE[load.colorIdx];
        const color = `var(--color-${palette})`;
        const num = idx + 1;

        let fieldsHtml = '';

        if (load.type === 'point') {
            // Dos campos en fila — P y posición a
            fieldsHtml = `
                <div class="sim-field">
                    <label class="sim-label">Magnitude P</label>
                    <div class="sim-input-wrap">
                        <input type="number" class="sim-input" data-field="P"
                               value="${load.P}" min="0" max="${BEAM_LIMITS.P_max}" step="1" />
                        <span class="sim-unit">kN</span>
                    </div>
                </div>
                <div class="sim-field">
                    <label class="sim-label">
                        Position a
                        <span class="sim-label-hint">(0 – ${L} m)</span>
                    </label>
                    <div class="sim-input-wrap">
                        <input type="number" class="sim-input" data-field="a"
                               value="${load.a}" min="0" max="${L}" step="0.1" />
                        <span class="sim-unit">m</span>
                    </div>
                </div>`;
        } else {
            // w arriba, luego a y b uno por uno — nunca se cortan las unidades
            fieldsHtml = `
                <div class="sim-field">
                    <label class="sim-label">Intensity w</label>
                    <div class="sim-input-wrap">
                        <input type="number" class="sim-input" data-field="w"
                               value="${load.w}" min="0" max="${BEAM_LIMITS.w_max}" step="0.1" />
                        <span class="sim-unit">kN/m</span>
                    </div>
                </div>
                <div class="sim-field">
                    <label class="sim-label">
                        Start a
                        <span class="sim-label-hint">(0 – ${L} m)</span>
                    </label>
                    <div class="sim-input-wrap">
                        <input type="number" class="sim-input" data-field="a"
                               value="${load.a}" min="0" max="${L}" step="0.1" />
                        <span class="sim-unit">m</span>
                    </div>
                </div>
                <div class="sim-field">
                    <label class="sim-label">
                        End b
                        <span class="sim-label-hint">(0 – ${L} m)</span>
                    </label>
                    <div class="sim-input-wrap">
                        <input type="number" class="sim-input" data-field="b"
                               value="${load.b}" min="0" max="${L}" step="0.1" />
                        <span class="sim-unit">m</span>
                    </div>
                </div>`;
        }

        const hintText = load.type === 'point'
            ? `Position must be within [0, ${L}] m`
            : `Start and End must be within [0, ${L}] m, with Start &lt; End`;

        const card = document.createElement('div');
        card.className = 'load-card';
        card.id = `load-card-${load.id}`;
        card.dataset.type = load.type;
        card.innerHTML = `
            <div class="load-card__header" style="border-left-color:${color}">
                <span class="load-card__label">Load ${num}</span>
                <span class="load-card__type-badge">${load.type === 'point' ? 'Point' : 'Distributed'}</span>
                <button type="button" class="load-card__remove" aria-label="Remove load ${num}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="load-card__body">${fieldsHtml}</div>
            <div class="load-card__hint">${hintText}</div>`;

        card.querySelector('.load-card__remove').addEventListener('click', () => removeLoad(load.id));
        container.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────

function buildState() {
    const L = parseFloat(DOM.inputL.value);
    const E = parseFloat(DOM.inputE.value);
    const I = parseFloat(DOM.inputI.value);

    if (!Number.isFinite(L) || L < BEAM_LIMITS.L_min || L > BEAM_LIMITS.L_max) {
        throw { msg: `Beam length must be between ${BEAM_LIMITS.L_min} and ${BEAM_LIMITS.L_max} m.`, el: DOM.inputL };
    }
    if (!Number.isFinite(E) || E < BEAM_LIMITS.E_min || E > BEAM_LIMITS.E_max) {
        throw { msg: `Elastic modulus must be between ${BEAM_LIMITS.E_min} and ${BEAM_LIMITS.E_max} GPa.`, el: DOM.inputE };
    }
    if (!Number.isFinite(I) || I < BEAM_LIMITS.I_min || I > BEAM_LIMITS.I_max) {
        throw { msg: `Moment of inertia must be between ${BEAM_LIMITS.I_min} and ${BEAM_LIMITS.I_max} cm⁴.`, el: DOM.inputI };
    }
    if (loads.length === 0) {
        throw { msg: 'Add at least one load before calculating.', el: null };
    }

    const sanitized = loads.map((l, idx) => {
        const raw = readLoadCard(l.id);
        if (!raw) throw { msg: `Could not read load ${idx + 1}.`, el: null };
        const n = idx + 1;

        if (raw.type === 'point') {
            const elP = document.querySelector(`#load-card-${l.id} [data-field="P"]`);
            const elA = document.querySelector(`#load-card-${l.id} [data-field="a"]`);
            if (!Number.isFinite(raw.P) || raw.P < 0 || raw.P > BEAM_LIMITS.P_max)
                throw { msg: `Load ${n}: P must be between 0 and ${BEAM_LIMITS.P_max} kN.`, el: elP };
            if (!Number.isFinite(raw.a) || raw.a < 0 || raw.a > L)
                throw { msg: `Load ${n}: Position a must be between 0 and L = ${L} m.`, el: elA };
            return { type: 'point', P: raw.P, a: raw.a };
        } else {
            const elW = document.querySelector(`#load-card-${l.id} [data-field="w"]`);
            const elA = document.querySelector(`#load-card-${l.id} [data-field="a"]`);
            const elB = document.querySelector(`#load-card-${l.id} [data-field="b"]`);
            if (!Number.isFinite(raw.w) || raw.w < 0 || raw.w > BEAM_LIMITS.w_max)
                throw { msg: `Load ${n}: w must be between 0 and ${BEAM_LIMITS.w_max} kN/m.`, el: elW };
            if (!Number.isFinite(raw.a) || raw.a < 0 || raw.a > L)
                throw { msg: `Load ${n}: Start a must be within [0, ${L}] m.`, el: elA };
            if (!Number.isFinite(raw.b) || raw.b < 0 || raw.b > L)
                throw { msg: `Load ${n}: End b must be within [0, ${L}] m.`, el: elB };
            if (raw.a >= raw.b)
                throw { msg: `Load ${n}: Start a must be less than End b.`, el: elA };
            if ((raw.b - raw.a) < BEAM_LIMITS.span_min)
                throw { msg: `Load ${n}: Span too small (min ${BEAM_LIMITS.span_min} m).`, el: elB };
            return { type: 'distributed', w: raw.w, a: raw.a, b: raw.b };
        }
    });

    return { L, E, I, loads: sanitized };
}

// ─────────────────────────────────────────────────────────────────
//  Charts
// ─────────────────────────────────────────────────────────────────

function destroyChart(key) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

function downsample(xData, yData, maxPts) {
    const step = Math.max(1, Math.floor(xData.length / maxPts));
    const xs = [], ys = [];
    const yAbsMax = Math.max(...yData.map(Math.abs)) || 1;
    for (let i = 0; i < xData.length; i++) {
        const isJump = i > 0 &&
            Math.abs(yData[i] - yData[i - 1]) > 0.01 * yAbsMax;
        if (i === 0 || i === xData.length - 1 || i % step === 0 || isJump) {
            xs.push(xData[i]);
            ys.push(yData[i]);
        }
    }
    return { xs, ys };
}

function renderChart(canvasId, key, xData, yData, label, yLabel, colorVar) {
    destroyChart(key);
    const { xs, ys } = downsample(xData, yData, 400);
    const color = getCssVar(colorVar);
    const muted = getCssVar('--color-text-muted');
    const grid = getCssVar('--color-border');

    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    charts[key] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: xs.map(v => v.toFixed(2)),
            datasets: [{
                label,
                data: ys,
                borderColor: color,
                backgroundColor: color + '22',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 250 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => `x = ${items[0].label} m`,
                        label: (item) => `${label}: ${item.raw.toFixed(3)} ${yLabel}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: muted, maxTicksLimit: 8,
                        callback: (_, i) => xs[i] !== undefined ? xs[i].toFixed(1) : ''
                    },
                    grid: { color: grid },
                    title: { display: true, text: 'Position x (m)', color: muted }
                },
                y: {
                    ticks: { color: muted },
                    grid: { color: grid },
                    title: { display: true, text: yLabel, color: muted }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────
//  SVG beam diagram
// ─────────────────────────────────────────────────────────────────

function renderBeamDiagram(state) {
    const svg = DOM.beamDiagram;
    const W = 560, H = 130;
    const PAD = 50;
    const beamY = 70;       // vertical centerline of the beam
    const beamH = 8;        // half-height of beam rectangle
    const beamL = W - 2 * PAD;
    const scale = beamL / state.L;
    const toX = pos => PAD + pos * scale;

    const beamClr = getCssVar('--color-primary');
    const loadClr = getCssVar('--color-error');
    const distClr = getCssVar('--color-warning');
    const suppClr = getCssVar('--color-text-muted');

    // ── Beam rectangle (solid, readable) ──
    let inner = `
        <rect x="${PAD}" y="${beamY - beamH}" width="${beamL}" height="${beamH * 2}"
              rx="2" fill="${beamClr}" opacity="0.85"/>
    `;

    // ── Support A — PIN (triangle pointing up, below beam) ──────
    //   Pin: solid triangle below the beam, with hatch base line
    const suppY = beamY + beamH; // bottom edge of beam
    inner += `
        <polygon points="${PAD},${suppY} ${PAD - 14},${suppY + 24} ${PAD + 14},${suppY + 24}"
                 fill="${suppClr}" opacity="0.9"/>
        <line x1="${PAD - 17}" y1="${suppY + 26}" x2="${PAD + 17}" y2="${suppY + 26}"
              stroke="${suppClr}" stroke-width="2"/>
        <line x1="${PAD - 14}" y1="${suppY + 26}" x2="${PAD - 20}" y2="${suppY + 32}"
              stroke="${suppClr}" stroke-width="1.5" opacity="0.6"/>
        <line x1="${PAD - 6}"  y1="${suppY + 26}" x2="${PAD - 12}" y2="${suppY + 32}"
              stroke="${suppClr}" stroke-width="1.5" opacity="0.6"/>
        <line x1="${PAD + 2}"  y1="${suppY + 26}" x2="${PAD - 4}"  y2="${suppY + 32}"
              stroke="${suppClr}" stroke-width="1.5" opacity="0.6"/>
        <line x1="${PAD + 10}" y1="${suppY + 26}" x2="${PAD + 4}"  y2="${suppY + 32}"
              stroke="${suppClr}" stroke-width="1.5" opacity="0.6"/>
        <text x="${PAD}" y="${suppY + 46}" text-anchor="middle"
              font-size="11" font-weight="600" fill="${suppClr}">A</text>
    `;

    // ── Support B — ROLLER (triangle + circles, below beam) ─────
    const bx = W - PAD;
    inner += `
        <polygon points="${bx},${suppY} ${bx - 14},${suppY + 24} ${bx + 14},${suppY + 24}"
                 fill="${suppClr}" opacity="0.9"/>
        <circle cx="${bx - 9}"  cy="${suppY + 29}" r="4" fill="${suppClr}" opacity="0.7"/>
        <circle cx="${bx}"      cy="${suppY + 29}" r="4" fill="${suppClr}" opacity="0.7"/>
        <circle cx="${bx + 9}"  cy="${suppY + 29}" r="4" fill="${suppClr}" opacity="0.7"/>
        <line x1="${bx - 17}" y1="${suppY + 34}" x2="${bx + 17}" y2="${suppY + 34}"
              stroke="${suppClr}" stroke-width="1.5" opacity="0.5"/>
        <text x="${bx}" y="${suppY + 48}" text-anchor="middle"
              font-size="11" font-weight="600" fill="${suppClr}">B</text>
    `;

    // ── Length label ──────────────────────────────────────────────
    inner += `
        <text x="${W / 2}" y="${H - 4}" text-anchor="middle"
              font-size="10" fill="${suppClr}">L = ${state.L} m</text>
    `;

    // ── Loads ──────────────────────────────────────────────────────
    state.loads.forEach((load, idx) => {
        const topY = beamY - beamH;  // top surface of beam

        if (load.type === 'point') {
            const x = toX(load.a);
            const arrowH = 30;
            inner += `
                <line x1="${x}" y1="${topY - 4}" x2="${x}" y2="${topY - arrowH}"
                      stroke="${loadClr}" stroke-width="2.5"/>
                <polygon points="${x},${topY - 4} ${x - 6},${topY - 16} ${x + 6},${topY - 16}"
                         fill="${loadClr}"/>
                <text x="${x}" y="${topY - arrowH - 5}" text-anchor="middle"
                      font-size="10" font-weight="600" fill="${loadClr}">${load.P} kN</text>
                <line x1="${x}" y1="${topY - 2}" x2="${x}" y2="${suppY}"
                      stroke="${loadClr}" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>
            `;
        } else {
            const x1 = toX(load.a);
            const x2 = toX(load.b);
            const barY = topY - 28;
            const nx = Math.max(2, Math.round((x2 - x1) / 22));

            // Top bar
            inner += `
                <line x1="${x1}" y1="${barY}" x2="${x2}" y2="${barY}"
                      stroke="${distClr}" stroke-width="2"/>
                <text x="${(x1 + x2) / 2}" y="${barY - 5}" text-anchor="middle"
                      font-size="10" font-weight="600" fill="${distClr}">${load.w} kN/m</text>
            `;
            // Arrows
            for (let k = 0; k <= nx; k++) {
                const xi = x1 + (k / nx) * (x2 - x1);
                inner += `
                    <line x1="${xi}" y1="${barY + 2}" x2="${xi}" y2="${topY - 6}"
                          stroke="${distClr}" stroke-width="1.8"/>
                    <polygon points="${xi},${topY - 4} ${xi - 4},${topY - 14} ${xi + 4},${topY - 14}"
                             fill="${distClr}"/>
                `;
            }
        }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = inner;
}

// ─────────────────────────────────────────────────────────────────
//  Results rendering
// ─────────────────────────────────────────────────────────────────

function fmt(v, dec = 3) {
    return Number.isFinite(v) ? v.toFixed(dec) : '—';
}

function renderResults(result, state) {
    const { reactions, criticalPoints, x, V, M, y, theta } = result;

    DOM.outRa.textContent = fmt(reactions.Ra);
    DOM.outRb.textContent = fmt(reactions.Rb);

    DOM.outVmax.textContent = fmt(Math.abs(criticalPoints.maxShear.value));
    DOM.outVmaxX.textContent = fmt(criticalPoints.maxShear.x);

    DOM.outMmax.textContent = fmt(Math.abs(criticalPoints.maxMoment.value));
    DOM.outMmaxX.textContent = fmt(criticalPoints.maxMoment.x);

    const yMM = y.map(v => v * NUMERICS.DEFLECTION_SCALE);
    const maxDef = criticalPoints.maxDeflection;
    DOM.outYmax.textContent = fmt(Math.abs(maxDef.value) * NUMERICS.DEFLECTION_SCALE);
    DOM.outYmaxX.textContent = fmt(maxDef.x);

    renderChart('chart-shear', 'shear', x, V, 'Shear Force', 'kN', '--color-success');
    renderChart('chart-moment', 'moment', x, M, 'Bending Moment', 'kNm', '--color-primary');
    renderChart('chart-deflection', 'deflection', x, yMM, 'Deflection', 'mm', '--color-warning');
    renderBeamDiagram(state);
    DOM.resultsPanel.style.display = '';
}

// ─────────────────────────────────────────────────────────────────
//  Main calculate handler
// ─────────────────────────────────────────────────────────────────

function calculate() {
    clearError();
    try {
        const state = buildState();
        const result = calculatePhysics(state);
        renderResults(result, state);
    } catch (err) {
        // err is either { msg, el } from buildState, or a real Error from core
        if (err && err.msg) {
            showError(err.msg, err.el || null);
        } else {
            showError(err.message || 'An unexpected error occurred.');
            console.error('[StaticBeam]', err);
        }
    }
}

// ─────────────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────────────

function init() {
    DOM = {
        inputL: document.getElementById('input-L'),
        inputE: document.getElementById('input-E'),
        inputI: document.getElementById('input-I'),
        loadList: document.getElementById('load-list'),
        btnAddPoint: document.getElementById('btn-add-point'),
        btnAddDist: document.getElementById('btn-add-distributed'),
        btnCalculate: document.getElementById('btn-calculate'),
        errorBox: document.getElementById('sim-error'),
        resultsPanel: document.getElementById('results-panel'),
        outRa: document.getElementById('out-Ra'),
        outRb: document.getElementById('out-Rb'),
        outVmax: document.getElementById('out-Vmax'),
        outVmaxX: document.getElementById('out-Vmax-x'),
        outMmax: document.getElementById('out-Mmax'),
        outMmaxX: document.getElementById('out-Mmax-x'),
        outYmax: document.getElementById('out-Ymax'),
        outYmaxX: document.getElementById('out-Ymax-x'),
        beamDiagram: document.getElementById('beam-diagram'),
    };

    DOM.btnAddPoint.addEventListener('click', () => addLoad('point'));
    DOM.btnAddDist.addEventListener('click', () => addLoad('distributed'));
    DOM.btnCalculate.addEventListener('click', calculate);

    // Recalculate if user changes L — update load card hints
    DOM.inputL.addEventListener('change', () => {
        if (loads.length > 0) renderLoadCards();
    });

    // Enter key triggers calculate
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('.sim-input')) calculate();
    });

    // Default: one point load
    addLoad('point');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}