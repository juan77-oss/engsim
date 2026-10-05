/**
 * simulator.js — [SIMULATOR NAME]
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - Input reading
 *   - UI orchestration
 *   - Output writing to the DOM
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css)
 *   - Physics / engineering calculations (→ js/core.js)
 *
 * THEORY NOTES:
 *   Document any formulas, standards, or sign conventions used.
 *   Especially note if your faculty's approach differs from textbooks.
 *   Example:
 *     Shear stress sign convention: Materials (Callister) — τ+ on +x face
 *     is counter-clockwise. This differs from Hibbeler (τ+ clockwise).
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { computeResult, runValidationSuite } from './core.js';
import { LIMITS } from './constants.js';



/* ── DOM references ──────────────────────────────────────────── */
const DOM = {
    inputExample: document.getElementById('input-example'),
    selectExample: document.getElementById('select-example'),
    btnCalculate: document.getElementById('btn-calculate'),
    outA: document.getElementById('out-a'),
    outB: document.getElementById('out-b'),
    errorEl: document.getElementById('sim-error')
};

/* ── Error helpers ───────────────────────────────────────────── */
function showError(msg) {
    DOM.errorEl.textContent = msg;
    DOM.errorEl.classList.add('is-visible');
}

function clearError() {
    DOM.errorEl.textContent = '';
    DOM.errorEl.classList.remove('is-visible');
}

/* ── Format helpers ──────────────────────────────────────────── */
function fmt(val, decimals = 2) {
    if (!isFinite(val)) return '—';
    return val.toFixed(decimals);
}

/* ── Core calculation ────────────────────────────────────────── */
function calculate() {
    clearError();

    // 1. Read inputs
    const val = parseFloat(DOM.inputExample?.value || 0);

    // 2. Validate
    if (isNaN(val) || val <= LIMITS.value_min) {
        showError('Please enter a valid positive value.');
        return;
    }

    // 3. Physics / calculations
    const result = computeResult(val);

    // 4. Write outputs
    if (DOM.outA) DOM.outA.textContent = fmt(result.input, 2);
    if (DOM.outB) DOM.outB.textContent = fmt(result.output, 2);
}

/* ── Fullscreen Toggle ───────────────────────────────────────── */
function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function onFsChange() {
    const isFs = !!fsElement();
    document.querySelectorAll('.sim-chart-wrap').forEach(wrap => {
        const btn = wrap.querySelector('.sim-chart-fullscreen-btn');
        if (btn) {
            btn.classList.toggle('is-fullscreen', isFs);
            btn.setAttribute('aria-pressed', String(isFs));
        }
    });
}

function wireFullscreen() {
    document.querySelectorAll('.sim-chart-wrap .sim-chart-fullscreen-btn').forEach(btn => {
        const wrap = btn.closest('.sim-chart-wrap');
        btn.addEventListener('click', () => {
            if (fsElement() === wrap) {
                (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            } else {
                const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
                if (req) req.call(wrap);
            }
        });
    });
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
}

/* ── Charting (Optional) ─────────────────────────────────────── */
/**
 * Problema de fondo: Chart.js entra en un loop infinito de resize con 
 * responsive:true + maintainAspectRatio:false sin un límite de altura.
 * Para evitarlo, siempre definimos un maxHeight explícito en el canvas.
 */
// function renderChart() {
//   const canvas = document.getElementById('sim-chart');
//   if (!canvas) return;
// 
//   // Chart.js resize-loop guard — ajustar este valor según el gráfico
//   // de este simulador (valores usados en simuladores existentes: 200-400px)
//   canvas.style.maxHeight = 'XXXpx'; // TODO: ajustar
// 
//   // Si el gráfico queda achatado a pesar del maxHeight de arriba,
//   // descomentar y ajustar (mismo valor que el maxHeight):
//   // if (canvas.parentElement) {
//   //     canvas.parentElement.style.height = 'XXXpx';
//   // }
// 
//   // Ejemplo de init:
//   // new Chart(canvas, { ... });
// }

/* ── Init ────────────────────────────────────────────────────── */
function init() {
    if (DOM.btnCalculate) {
        DOM.btnCalculate.addEventListener('click', calculate);
    }
    
    // Auto-recalculate on input change
    [DOM.inputExample, DOM.selectExample].forEach(el => {
        if (el) el.addEventListener('input', calculate);
    });

    wireFullscreen();
    calculate();
}

document.addEventListener('DOMContentLoaded', () => {
    init();

    // Run tests if hash is #selftest
    if (window.location.hash === '#selftest') {
        const r = runValidationSuite();
        console.log(`[self-test] ${r.summary}`, r.tests);
    }
});