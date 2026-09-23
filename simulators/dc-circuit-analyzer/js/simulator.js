/**
 * simulator.js — DC Circuit Analyzer
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - Input reading (voltage, resistances, network topology, unit selects)
 *   - Core physics (imported from core.js)
 *   - Output writing to the DOM (KPIs, results table, circuit diagram,
 *     RL power chart, step-by-step derivation)
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css, namespaced under "dcc-")
 *
 * THEORY NOTES:
 *   Topology "parallel" (default): V — R1 — (R2 ∥ RL). R1 behaves as the
 *   source's series resistance; R2 and the variable load RL share the
 *   same node.
 *   Topology "series": V — R1 — R2 — RL, all in series.
 *   Maximum power transfer: RL_opt = Rth, where Rth is the Thevenin
 *   resistance seen from the RL terminals (source shorted, load removed).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { calculateCC, maxPowerTransfer, toOhms, fromOhms } from './core.js';
import { RESOLUTION_METHODS, METHOD_EXPLANATIONS } from './constants.js';

const COLORS = {
    primary: '#1a3a5c', accent: '#2e6da4', text: '#1c2331',
    muted: '#5a6477', success: '#2d7a4f', danger: '#9b1c1c', line: '#d1d5db'
};

/* ── DOM references ──────────────────────────────────────────── */
// Network
const selectNetworkType = document.getElementById('select-network-type');

// Source
const rangeV1 = document.getElementById('range-v1');
const inputV1 = document.getElementById('input-v1');

// Resistances
const resistanceIds = ['r1', 'r2', 'rl'];

// Guided analysis
const selectMethod = document.getElementById('select-method');
const toggleSteps = document.getElementById('toggle-steps');

// Outputs — KPIs
const outPRL = document.getElementById('out-prl');
const outItotal = document.getElementById('out-itotal');
const outRth = document.getElementById('out-rth');
const outEta = document.getElementById('out-eta');

// Outputs — status banner
const statusBanner = document.getElementById('status-banner');
const statusTitle = document.getElementById('status-title');
const statusMessage = document.getElementById('status-message');

// Outputs — canvas + chart
const canvasTitle = document.getElementById('canvas-title');
const circuitCanvas = document.getElementById('circuit-canvas');
let ctx = null;
const powerChartCanvas = document.getElementById('power-chart');
let powerChart = null;

// Outputs — table + steps
const resultsTableBody = document.getElementById('results-table-body');
const stepPanel = document.getElementById('step-panel');
const currentMethodLabel = document.getElementById('current-method-label');
const stepContent = document.getElementById('step-content');
const methodExplain = document.getElementById('method-explain');

// Error slot
const errorEl = document.getElementById('sim-error');

/* ── State ───────────────────────────────────────────────────── */
const state = {
    v1: 12,
    networkType: 'parallel',
    values: { r1: 10, r2: 20, rl: 20 },
    units: { r1: 'Ω', r2: 'Ω', rl: 'Ω' },
    resolutionMethod: 'none',
    showSteps: true
};
let isDragging = false;

/* ── Error helpers ───────────────────────────────────────────── */
function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('is-visible');
}
function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
}

/* ── Format helpers ──────────────────────────────────────────── */
function fmt(val, decimals = 2) {
    if (!isFinite(val)) return '—';
    return val.toFixed(decimals);
}

/* ── Canvas setup ────────────────────────────────────────────── */
function setupCanvas(canvas) {
    if (!canvas) return null;
    const dpr = window.devicePixelRatio || 1;
    const cssW = 800, cssH = 300;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${cssW}px`;
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
}

function setupChart() {
    if (!powerChartCanvas || typeof Chart === 'undefined') return null;
    powerChartCanvas.style.maxHeight = '200px';
    return new Chart(powerChartCanvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'W', data: [], borderColor: COLORS.accent, fill: true, tension: 0.3, pointRadius: 0 },
                { data: [], pointRadius: 6, pointBackgroundColor: COLORS.danger, showLine: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {
                        vLine: { type: 'line', borderColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderDash: [4, 4] }
                    }
                }
            },
            scales: { x: { type: 'linear' }, y: { beginAtZero: true } }
        }
    });
}

/* ── Canvas drawing primitives ──────────────────────────────── */
function drawSource(x, y, v) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.primary; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText('V1', x, y - 2);
    ctx.font = '9px Arial';
    ctx.fillText(`${v}V`, x, y + 14);
}

function drawCurrentSource(x, y, l, val) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 10); ctx.lineTo(x, y - 10);
    ctx.moveTo(x - 5, y - 5); ctx.lineTo(x, y - 10); ctx.lineTo(x + 5, y - 5);
    ctx.stroke();
    ctx.fillStyle = COLORS.primary; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText(l, x - 30, y - 2);
    ctx.font = '9px Arial';
    ctx.fillText(`${val}A`, x - 30, y + 14);
}

function drawResistor(x, y, o, l, v, varL = false) {
    ctx.save();
    ctx.translate(x, y);
    if (o === 'vert') ctx.rotate(Math.PI / 2);
    ctx.beginPath(); ctx.rect(-18, -6, 36, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, 0);
    for (let i = 0; i < 4; i++) ctx.lineTo(-18 + (i + 0.5) * 9, (i % 2 ? 1 : -1) * 6);
    ctx.lineTo(18, 0); ctx.stroke();
    if (varL) { ctx.beginPath(); ctx.moveTo(-12, 12); ctx.lineTo(12, -12); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = COLORS.primary; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
    if (o === 'horiz') {
        ctx.fillText(l, x, y - 15);
        ctx.fillText(`${v.toFixed(0)}Ω`, x, y + 22);
    } else {
        ctx.fillText(l, x + 30, y);
        ctx.fillText(`${v.toFixed(0)}Ω`, x + 30, y + 12);
    }
}

function drawNode(x, y, l) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.danger; ctx.fill();
    ctx.font = '9px Arial';
    ctx.fillText(l, x + 8, y - 8);
}

function geometry() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = circuitCanvas.width / dpr, cssH = circuitCanvas.height / dpr;
    const ML = 55, MR = 20, MT = 48, MB = 24;
    const spanW = cssW - ML - MR, spanH = cssH - MT - MB;
    return {
        cssW, cssH, ML, MR, MT, MB, spanW, spanH,
        xLeft: ML, xRight: ML + spanW,
        yTop: MT, yBot: MT + spanH, yCentre: MT + spanH / 2
    };
}

function drawCircuit(res) {
    if (!ctx) return;
    const g = geometry();
    ctx.clearRect(0, 0, g.cssW, g.cssH);
    ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    if (state.networkType === 'series') {
        const xDist = g.spanW / 4;
        const xR1 = g.ML + xDist, xR2 = g.ML + 2 * xDist, xRL = g.ML + 3 * xDist;
        ctx.beginPath();
        ctx.moveTo(g.xLeft, g.yCentre); ctx.lineTo(g.xLeft, g.yTop);
        ctx.lineTo(g.xRight, g.yTop); ctx.lineTo(g.xRight, g.yBot);
        ctx.lineTo(g.xLeft, g.yBot); ctx.lineTo(g.xLeft, g.yCentre);
        ctx.stroke();
        drawSource(g.xLeft, g.yCentre, state.v1);
        drawResistor(xR1, g.yTop, 'horiz', 'R1', state.values.r1);
        drawResistor(xR2, g.yTop, 'horiz', 'R2', state.values.r2);
        drawResistor(xRL, g.yTop, 'horiz', 'RL', state.values.rl, true);
    } else {
        const xNode = g.ML + g.spanW * 0.42, xR2 = g.ML + g.spanW * 0.64, xRL = g.ML + g.spanW * 0.86;
        ctx.beginPath();
        ctx.moveTo(g.xLeft, g.yCentre); ctx.lineTo(g.xLeft, g.yTop);
        ctx.lineTo(xRL, g.yTop); ctx.lineTo(xRL, g.yBot);
        ctx.lineTo(g.xLeft, g.yBot); ctx.lineTo(g.xLeft, g.yCentre);
        ctx.moveTo(xR2, g.yTop); ctx.lineTo(xR2, g.yBot);
        ctx.stroke();
        drawSource(g.xLeft, g.yCentre, state.v1);
        drawResistor((g.xLeft + xNode) / 2, g.yTop, 'horiz', 'R1', state.values.r1);
        drawResistor(xR2, g.yCentre, 'vert', 'R2', state.values.r2);
        drawResistor(xRL, g.yCentre, 'vert', 'RL', state.values.rl, true);
        drawNode(xNode, g.yTop, `Vn = ${res.Vnode.toFixed(1)}V`);
    }

    ctx.fillStyle = COLORS.primary; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText('+', g.xLeft - 14, g.yCentre - 26);
    ctx.fillText('−', g.xLeft - 14, g.yCentre + 32);
}

function drawGuidedCircuit(res) {
    if (!ctx) return;
    const g = geometry();
    const method = state.resolutionMethod;
    ctx.clearRect(0, 0, g.cssW, g.cssH);
    ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    if (method === 'thevenin') {
        ctx.beginPath();
        ctx.moveTo(g.xLeft, g.yCentre); ctx.lineTo(g.xLeft, g.yTop);
        ctx.lineTo(g.xRight, g.yTop); ctx.lineTo(g.xRight, g.yBot);
        ctx.lineTo(g.xLeft, g.yBot); ctx.lineTo(g.xLeft, g.yCentre);
        ctx.stroke();
        drawSource(g.xLeft, g.yCentre, res.Vth.toFixed(1));
        drawResistor(g.ML + g.spanW / 2, g.yTop, 'horiz', 'Rth', res.Rth);
        drawResistor(g.xRight, g.yCentre, 'vert', 'RL', state.values.rl);
        ctx.fillStyle = COLORS.primary; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
        ctx.fillText('+', g.xLeft - 14, g.yCentre - 26);
        ctx.fillText('−', g.xLeft - 14, g.yCentre + 32);

    } else if (method === 'norton') {
        const In = res.Rth !== 0 ? res.Vth / res.Rth : 0;
        const xRN = g.ML + g.spanW / 2;
        ctx.beginPath();
        ctx.moveTo(g.xLeft, g.yCentre); ctx.lineTo(g.xLeft, g.yTop);
        ctx.lineTo(g.xRight, g.yTop); ctx.lineTo(g.xRight, g.yBot);
        ctx.lineTo(g.xLeft, g.yBot); ctx.lineTo(g.xLeft, g.yCentre);
        ctx.moveTo(xRN, g.yTop); ctx.lineTo(xRN, g.yBot);
        ctx.stroke();
        drawCurrentSource(g.xLeft, g.yCentre, 'IN', In.toFixed(3));
        drawResistor(xRN, g.yCentre, 'vert', 'RN', res.Rth);
        drawResistor(g.xRight, g.yCentre, 'vert', 'RL', state.values.rl);

    } else if (method === 'nodos' || method === 'mallas') {
        drawCircuit(res);
        if (method === 'nodos' && state.networkType !== 'series') {
            const xNode = g.ML + g.spanW * 0.42;
            ctx.beginPath();
            ctx.arc(xNode, g.yTop, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(45, 122, 79, 0.2)'; ctx.fill();
            ctx.strokeStyle = COLORS.success; ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(xNode + 30, g.yTop + 20); ctx.lineTo(xNode + 30, g.yTop + 40);
            ctx.moveTo(xNode + 25, g.yTop + 35); ctx.lineTo(xNode + 30, g.yTop + 40); ctx.lineTo(xNode + 35, g.yTop + 35);
            ctx.stroke();
            ctx.fillStyle = COLORS.success;
            ctx.fillText('IR2', xNode + 30, g.yTop + 55);
            const xRL = g.ML + g.spanW * 0.86;
            ctx.beginPath();
            ctx.moveTo(xRL + 30, g.yTop + 20); ctx.lineTo(xRL + 30, g.yTop + 40);
            ctx.moveTo(xRL + 25, g.yTop + 35); ctx.lineTo(xRL + 30, g.yTop + 40); ctx.lineTo(xRL + 35, g.yTop + 35);
            ctx.stroke();
            ctx.fillText('IRL', xRL + 30, g.yTop + 55);
        } else if (method === 'mallas') {
            const yLoop = g.yCentre;
            const drawLoop = (x, y, label) => {
                ctx.beginPath();
                ctx.arc(x, y, 20, 0.5 * Math.PI, 2.3 * Math.PI);
                ctx.strokeStyle = COLORS.accent; ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y + 20); ctx.lineTo(x - 6, y + 14);
                ctx.moveTo(x, y + 20); ctx.lineTo(x + 6, y + 14);
                ctx.stroke();
                ctx.fillStyle = COLORS.accent; ctx.font = 'bold 12px Arial';
                ctx.fillText(label, x, y + 5);
            };
            if (state.networkType !== 'series') {
                drawLoop(g.ML + g.spanW * 0.25, yLoop, 'I1');
                drawLoop(g.ML + g.spanW * 0.75, yLoop, 'I2');
            } else {
                drawLoop(g.ML + g.spanW * 0.5, yLoop, 'I1');
            }
        }
    } else if (method === 'delta-wye') {
        drawCircuit(res);
        ctx.fillStyle = COLORS.accent; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
        ctx.fillText('The network is already in a Wye (Star) topology.', g.ML + g.spanW / 2, g.cssH - 10);
    }
}

/* ── Chart update ────────────────────────────────────────────── */
function updateChart(res, opt) {
    if (!powerChart) return;
    const labels = [], values = [];
    const maxR = Math.max(200, state.values.rl * 1.5);
    for (let r = 1; r <= maxR; r += 5) {
        const p = calculateCC({ V: state.v1, R1: state.values.r1, R2: state.values.r2, RL: r, networkType: state.networkType }).P_RL;
        if (isFinite(p)) { labels.push(r); values.push(p); }
    }
    powerChart.data.labels = labels;
    powerChart.data.datasets[0].data = values;
    if (isFinite(res.P_RL)) powerChart.data.datasets[1].data = [{ x: state.values.rl, y: res.P_RL }];
    if (powerChart.options.plugins.annotation) {
        powerChart.options.plugins.annotation.annotations.vLine.xMin = opt.Rth;
        powerChart.options.plugins.annotation.annotations.vLine.xMax = opt.Rth;
    }
    powerChart.update('none');
}

/* ── KPIs / table / status ──────────────────────────────────── */
function updateKPIs(res) {
    outPRL.textContent = fmt(res.P_RL, 2);
    outItotal.textContent = fmt(res.Itotal, 3);
    outRth.textContent = fmt(res.Rth, 1);
    outEta.textContent = fmt(res.eta * 100, 1);
}

function updateTable(res) {
    let rows;
    if (state.networkType === 'series') {
        rows = [
            { name: 'R1', v: res.V_R1, i: res.I_R1, p: res.P_R1 },
            { name: 'R2', v: res.V_R2, i: res.I_R2, p: res.P_R2 },
            { name: 'RL', v: res.V_RL, i: res.I_RL, p: res.P_RL }
        ];
    } else {
        rows = [
            { name: 'R1', v: res.Itotal * state.values.r1, i: res.Itotal, p: res.P_R1 },
            { name: 'R2', v: res.Vnode, i: res.I_R2, p: res.P_R2 },
            { name: 'RL', v: res.Vnode, i: res.I_RL, p: res.P_RL }
        ];
    }
    resultsTableBody.innerHTML = rows
        .map(r => `<tr><td>${r.name}</td><td class="val">${fmt(r.v)}</td><td class="val">${fmt(r.i, 3)}</td><td class="val">${fmt(r.p)}</td></tr>`)
        .join('');
}

function updateStatus(opt) {
    const diff = state.values.rl - opt.RL_opt;
    statusBanner.className = 'status-banner';
    if (Math.abs(diff) < 0.5) {
        statusBanner.classList.add('status-banner--success');
        statusTitle.textContent = 'Perfect Match';
        statusMessage.textContent = 'Maximum power transfer is active — RL equals the Thevenin resistance.';
    } else if (diff > 0) {
        statusBanner.classList.add('status-banner--warning');
        statusTitle.textContent = 'High Load';
        statusMessage.textContent = 'RL is above Rth: higher efficiency, but reduced power delivered.';
    } else {
        statusBanner.classList.add('status-banner--danger');
        statusTitle.textContent = 'Low Load';
        statusMessage.textContent = 'RL is below Rth: excessive current draw and voltage drop across the source network.';
    }
}

/* ── Step-by-step derivation ────────────────────────────────── */
function buildSteps(res) {
    const f = (n, d = 2) => n.toFixed(d);
    if (state.networkType === 'series') {
        return {
            method: 'Series Circuit Analysis',
            steps: [
                { title: 'Total equivalent resistance', formula: 'Req = R1 + R2 + RL', result: `Req = ${f(res.Req)} Ω` },
                { title: 'Total current', formula: 'Itotal = V / Req', result: `Itotal = ${f(res.Itotal, 3)} A` },
                { title: 'Branch currents', formula: 'I(R1) = I(R2) = I(RL) = Itotal', result: `I(R1)=${f(res.I_R1,3)} A · I(R2)=${f(res.I_R2,3)} A · I(RL)=${f(res.I_RL,3)} A` },
                { title: 'Voltages', formula: 'V = Itotal × R', result: `V(R1)=${f(res.V_R1)} V · V(R2)=${f(res.V_R2)} V · V(RL)=${f(res.V_RL)} V` },
                { title: 'Power', formula: 'P = Itotal² × R', result: `P(R1)=${f(res.P_R1)} W · P(R2)=${f(res.P_R2)} W · P(RL)=${f(res.P_RL)} W` },
                { title: 'Source power', formula: 'Psource = V × Itotal', result: `Psource = ${f(res.PTotal)} W` }
            ]
        };
    }
    return {
        method: 'Parallel Circuit Analysis',
        steps: [
            { title: 'Equivalent parallel resistance', formula: 'Rp = R2 ∥ RL', result: `Rp = ${f(res.Rp)} Ω` },
            { title: 'Total equivalent resistance', formula: 'Req = R1 + Rp', result: `Req = ${f(res.Req)} Ω` },
            { title: 'Total current', formula: 'Itotal = V / Req', result: `Itotal = ${f(res.Itotal,3)} A` },
            { title: 'Node voltage', formula: 'Vnode = Itotal × Rp', result: `Vnode = ${f(res.Vnode)} V` },
            { title: 'Branch currents', formula: 'I(R2) = Vnode/R2 · I(RL) = Vnode/RL', result: `I(R2)=${f(res.I_R2,3)} A · I(RL)=${f(res.I_RL,3)} A` },
            { title: 'Power', formula: 'P(R1)=I²R1 · P(R2)=Vnode²/R2 · P(RL)=Vnode²/RL', result: `P(R1)=${f(res.P_R1)} W · P(R2)=${f(res.P_R2)} W · P(RL)=${f(res.P_RL)} W` },
            { title: 'Source power', formula: 'Psource = V × Itotal', result: `Psource = ${f(res.PTotal)} W` }
        ]
    };
}

function updateSteps(res) {
    if (!state.showSteps || isDragging) return;
    const solution = buildSteps(res);
    currentMethodLabel.textContent = solution.method;
    stepContent.innerHTML = solution.steps.map((step, idx) => `
        <div class="dcc-step">
            <div class="dcc-step__header">
                <span class="dcc-step__num">${idx + 1}</span>
                <h4 class="dcc-step__title">${step.title}</h4>
            </div>
            <div class="dcc-step__body">
                <div class="dcc-step__formula">${step.formula}</div>
                <div class="dcc-step__result">${step.result}</div>
            </div>
        </div>
    `).join('');
}

function updateMethodExplain() {
    const explanation = METHOD_EXPLANATIONS[state.resolutionMethod];
    if (!explanation) {
        methodExplain.classList.add('is-hidden');
        methodExplain.innerHTML = '';
        return;
    }
    methodExplain.classList.remove('is-hidden');
    methodExplain.innerHTML = `<strong>What are we doing?</strong><p>${explanation}</p>`;
}

/* ── Main update cycle ──────────────────────────────────────── */
function calculate() {
    clearError();
    try {
        const { r1, r2, rl } = state.values;
        if (state.v1 <= 0 || r1 <= 0 || r2 <= 0 || rl <= 0) {
            showError('All values must be greater than zero.');
            return;
        }

        const res = calculateCC({ V: state.v1, R1: r1, R2: r2, RL: rl, networkType: state.networkType });
        const opt = maxPowerTransfer({ V: state.v1, R1: r1, R2: r2, networkType: state.networkType });

        updateKPIs(res);
        updateTable(res);
        updateStatus(opt);
        updateSteps(res);
        updateChart(res, opt);
        updateMethodExplain();

        if (state.resolutionMethod !== 'none') {
            canvasTitle.textContent = `Circuit Diagram — ${state.resolutionMethod.toUpperCase()}`;
            drawGuidedCircuit(res);
        } else {
            canvasTitle.textContent = 'Circuit Diagram';
            drawCircuit(res);
        }
    } catch (e) {
        console.warn('Update error:', e);
    }
}

let tCalc = null;
function debouncedCalculate() { if (tCalc) clearTimeout(tCalc); tCalc = setTimeout(calculate, 50); }

/* ── Event listeners ─────────────────────────────────────────── */
if (selectNetworkType) {
    selectNetworkType.addEventListener('change', e => { state.networkType = e.target.value; calculate(); });
}

if (rangeV1 && inputV1) {
    const validateV1 = (val) => {
        let v = parseFloat(val);
        if (isNaN(v) || v < 0) v = 0;
        state.v1 = v;
        rangeV1.value = v; inputV1.value = v;
        debouncedCalculate();
    };
    rangeV1.addEventListener('input', e => validateV1(e.target.value));
    inputV1.addEventListener('change', e => validateV1(e.target.value));
}

resistanceIds.forEach(id => {
    const range = document.getElementById(`range-${id}`);
    const input = document.getElementById(`input-${id}`);
    const unit = document.getElementById(`unit-${id}`);
    if (!range || !input || !unit) return;

    const updateLocal = () => {
        if (input.value === '' || input.value === null) return;
        let val = parseFloat(input.value);
        if (isNaN(val) || val < 0) val = 0;
        input.value = val; range.value = val;
        const u = unit.value;
        state.values[id] = toOhms(val, u);
        state.units[id] = u;
        debouncedCalculate();
    };

    range.addEventListener('mousedown', () => { isDragging = true; });
    range.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });
    range.addEventListener('mouseup', () => { isDragging = false; calculate(); });
    range.addEventListener('touchend', () => { isDragging = false; calculate(); });
    range.addEventListener('input', e => { input.value = e.target.value; updateLocal(); });
    input.addEventListener('change', e => { range.value = e.target.value; updateLocal(); });
    unit.addEventListener('change', updateLocal);
});

if (selectMethod) {
    selectMethod.addEventListener('change', e => { state.resolutionMethod = e.target.value; calculate(); });
}

if (toggleSteps) {
    toggleSteps.addEventListener('change', e => {
        state.showSteps = e.target.checked;
        stepPanel.classList.toggle('is-hidden', !state.showSteps);
        calculate();
    });
}

/* ── Init ───────────────────────────────────────────────────── */
ctx = setupCanvas(circuitCanvas);
powerChart = setupChart();
calculate();
