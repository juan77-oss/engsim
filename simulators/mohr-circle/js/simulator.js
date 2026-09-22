/**
 * simulator.js — Mohr's Circle Calculator
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - Input reading
 *   - Orchestration of core.js (physics) and plot.js (canvas rendering)
 *   - Output writing to the DOM
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css / custom.css)
 *   - Physics (→ core.js)
 *   - Canvas drawing (→ plot.js)
 *
 * THEORY NOTES:
 *   Sign convention: this simulator exposes BOTH conventions to the user
 *   (see core.js CONVENTIONS). Materials (Callister) plots τ+ upward;
 *   Mechanics (Hibbeler) plots τ+ downward. σ1, σ2, τmax, θp are identical
 *   in both — only the diagram orientation changes (see core.js docblock).
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import * as core from './core.js';
import * as plot from './plot.js';
import {
    DEFAULT_SIGMA_X, DEFAULT_SIGMA_Y, DEFAULT_TAU_XY,
    STRESS_UNITS, DEFAULT_STRESS_UNIT,
    THETA_MIN_DEG, THETA_MAX_DEG, THETA_STEP_DEG, DEFAULT_THETA_DEG
} from './constants.js';

/* ── DOM references ──────────────────────────────────────────── */

// Stress inputs
const inputSigmaX = document.getElementById('input-sigma-x');
const inputSigmaY = document.getElementById('input-sigma-y');
const inputTauXY = document.getElementById('input-tau-xy');
const selectUnit = document.getElementById('select-unit');
const selectConvention = document.getElementById('select-convention');

// Angle slider
const inputTheta = document.getElementById('input-theta');
const thetaValueEl = document.getElementById('theta-value');

const btnCalculate = document.getElementById('btn-calculate');
const errorEl = document.getElementById('sim-error');

// Primary results
const outSigma1 = document.getElementById('out-sigma1');
const outSigma2 = document.getElementById('out-sigma2');
const outTauMax = document.getElementById('out-tau-max');
const outSigmaAvg = document.getElementById('out-sigma-avg');

// Angle results
const outThetaP = document.getElementById('out-theta-p');
const outThetaP2 = document.getElementById('out-theta-p2');
const outThetaS = document.getElementById('out-theta-s');

// Stress-at-θ results
const outSigmaTheta = document.getElementById('out-sigma-theta');
const outTauTheta = document.getElementById('out-tau-theta');

// Hydrostatic banner
const hydrostaticBanner = document.getElementById('hydrostatic-banner');

// Canvases
const canvasCircle = document.getElementById('sim-chart');
const canvasElement = document.getElementById('sim-chart-element');

/* ── Error / validation helpers ──────────────────────────────── */

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
    const target = input.closest('.sim-input-wrap') || input;
    target.classList.remove('sim-input--invalid');
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

/* ── Unit labels ─────────────────────────────────────────────── */
// The physics core is unit-agnostic (see core.js) — switching units only
// relabels the inputs/outputs, it never converts the numbers.
function updateUnitLabels() {
    const unit = selectUnit.value;
    document.querySelectorAll('.js-unit-label').forEach(el => {
        el.textContent = unit;
    });
}

/* ── Core calculation ────────────────────────────────────────── */

/**
 * calculate()
 * Reads inputs, validates, runs the physics chain, and draws both canvases.
 * Called on button click, on any input/slider change, on page load, and
 * on window resize (canvases need to be redrawn at their new pixel size).
 */
function calculate() {
    clearError();
    clearAllInvalid();

    // 1. Read inputs
    const sigma_x = parseFloat(inputSigmaX.value);
    const sigma_y = parseFloat(inputSigmaY.value);
    const tau_xy = parseFloat(inputTauXY.value);
    const convention = selectConvention.value;
    const theta_deg = parseFloat(inputTheta.value);

    // 2. Validate
    const invalidInputs = [];
    if (isNaN(sigma_x)) invalidInputs.push(inputSigmaX);
    if (isNaN(sigma_y)) invalidInputs.push(inputSigmaY);
    if (isNaN(tau_xy)) invalidInputs.push(inputTauXY);

    if (invalidInputs.length > 0) {
        invalidInputs.forEach(markInvalid);
        showError('Please enter valid numeric values for σx, σy, and τxy before calculating.');
        return;
    }

    // 3. Physics
    const mohr = core.computeMohrCircle(sigma_x, sigma_y, tau_xy);
    const theta_rad = core.toRadians(theta_deg);
    const { sigma_theta, tau_theta } = core.getStressAtAngle(sigma_x, sigma_y, tau_xy, theta_rad);

    // 4. Write primary results
    outSigma1.textContent = fmt(mohr.sigma1, 2);
    outSigma2.textContent = fmt(mohr.sigma2, 2);
    outTauMax.textContent = fmt(mohr.tau_max, 2);
    outSigmaAvg.textContent = fmt(mohr.sigma_avg, 2);

    // 5. Angles of principal / max-shear planes
    outThetaP.textContent = fmt(mohr.theta_p_deg, 1);
    outThetaP2.textContent = fmt(mohr.theta_p2_deg, 1);
    outThetaS.textContent = fmt(mohr.theta_s_deg, 1);

    // 6. Stress at the user-selected angle θ
    thetaValueEl.textContent = `${theta_deg.toFixed(0)}°`;
    outSigmaTheta.textContent = fmt(sigma_theta, 2);
    outTauTheta.textContent = fmt(tau_theta, 2);

    // 7. Hydrostatic state banner
    hydrostaticBanner.classList.toggle('is-hidden', !mohr.isHydrostatic);
    if (mohr.isHydrostatic) {
        hydrostaticBanner.querySelector('.status-banner__message').textContent =
            'σx = σy and τxy = 0 — every plane is a principal plane and the circle degenerates to a single point.';
    }

    // 8. Unit labels (relabel only, never converts values)
    updateUnitLabels();

    // 9. Canvases
    plot.drawMohrCircle(
        canvasCircle,
        { sigma_x, sigma_y, tau_xy },
        { theta: theta_rad, convention }
    );
    plot.drawStressElement(
        canvasElement,
        mohr,
        sigma_theta,
        tau_theta,
        theta_deg,
        { convention }
    );
}

/* ── Fullscreen diagram toggle ───────────────────────────────── */
// Uses the native Fullscreen API on the .sim-chart-wrap container (not just
// the canvas) so the label + button stay visible while expanded.
function requestFs(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) fn.call(el);
}

function exitFs() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) fn.call(document);
}

function currentFsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function setupFullscreenButtons() {
    document.querySelectorAll('.sim-chart-fullscreen-btn').forEach(btn => {
        const wrap = btn.closest('.sim-chart-wrap');
        if (!wrap) return;
        btn.addEventListener('click', () => {
            if (currentFsElement() === wrap) {
                exitFs();
            } else {
                requestFs(wrap);
            }
        });
    });

    const onFsChange = () => {
        document.querySelectorAll('.sim-chart-wrap').forEach(wrap => {
            const isFs = currentFsElement() === wrap;
            const btn = wrap.querySelector('.sim-chart-fullscreen-btn');
            if (btn) {
                btn.classList.toggle('is-fullscreen', isFs);
                btn.setAttribute('aria-pressed', String(isFs));
            }
        });
        // The canvases size themselves from their container's pixel
        // dimensions (see plot.js setupHiDPI) — redraw at the new size.
        calculate();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
}

/* ── Event listeners ─────────────────────────────────────────── */

btnCalculate.addEventListener('click', calculate);

[inputSigmaX, inputSigmaY, inputTauXY, selectConvention, selectUnit].forEach(el => {
    el.addEventListener('input', calculate);
});

inputTheta.addEventListener('input', calculate);

// Canvases size themselves from their container's pixel dimensions
// (see plot.js setupHiDPI), so a layout-affecting resize needs a redraw.
window.addEventListener('resize', calculate);

/* ── Initial state on page load ─────────────────────────────── */

setupFullscreenButtons();
updateUnitLabels();
calculate();