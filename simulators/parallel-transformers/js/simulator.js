/**
 * simulator.js — Parallel Transformers Calculator
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - Input reading
 *   - Orchestration of core.js (physics) and plot.js (canvas/bars rendering)
 *   - Output writing to the DOM
 *   - Localization (_t) and fullscreen toggle for the phasor diagram
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Layout or styling (→ simulator.css / custom.css)
 *   - Physics (→ core.js)
 *   - Canvas drawing (→ plot.js)
 *
 * THEORY NOTES:
 *   Ucc (catalog short-circuit voltage) is referred to the HV/primary
 *   winding — see core.js catalogToNameplate() docblock. This differs
 *   from some textbooks that reference it to the LV side; confirmed
 *   against TP3.B1 Problem 2 (Máquinas Eléctricas 2018).
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import * as core from './core.js';
import * as plot from './plot.js';
import {
    DEFAULT_T1, DEFAULT_T2, DEFAULT_LOAD,
    LOAD_SLIDER_MIN, LOAD_SLIDER_MAX_MULTIPLIER, LOAD_SLIDER_STEP,
    COSPHI_MIN, COSPHI_MAX, COSPHI_STEP,
    RATIO_MISMATCH_TOLERANCE_PCT, CIRCULATING_CURRENT_TOLERANCE_PCT,
} from './constants.js';

/* ── Localization ────────────────────────────────────────────── */
const lang = document.documentElement.lang || 'en';
const _t = (en, es) => (lang === 'es' ? es : en);

/* ── DOM references — Transformer 1 ─────────────────────────── */
const inSn1 = document.getElementById('in-sn-1');
const inUcc1 = document.getElementById('in-ucc-1');
const inPcc1 = document.getElementById('in-pcc-1');
const inUnhv1 = document.getElementById('in-unhv-1');
const inUnlv1 = document.getElementById('in-unlv-1');

/* ── DOM references — Transformer 2 ─────────────────────────── */
const inSn2 = document.getElementById('in-sn-2');
const inUcc2 = document.getElementById('in-ucc-2');
const inPcc2 = document.getElementById('in-pcc-2');
const inUnhv2 = document.getElementById('in-unhv-2');
const inUnlv2 = document.getElementById('in-unlv-2');

/* ── DOM references — Load ───────────────────────────────────── */
const inLoadS = document.getElementById('in-load-s');
const loadSValueEl = document.getElementById('load-s-value');
const inCosPhi = document.getElementById('in-cosphi');
const inU2 = document.getElementById('in-u2');

const btnCalculate = document.getElementById('btn-calculate');
const errorEl = document.getElementById('sim-error');

/* ── DOM references — Nameplate conversion (verification block) ── */
const outUcc1 = document.getElementById('out-ucc-1');
const outUr1 = document.getElementById('out-ur-1');
const outUx1 = document.getElementById('out-ux-1');
const outUcc2 = document.getElementById('out-ucc-2');
const outUr2 = document.getElementById('out-ur-2');
const outUx2 = document.getElementById('out-ux-2');

/* ── DOM references — Main results ────────────────────────────── */
const outI1 = document.getElementById('out-i1');
const outI1Angle = document.getElementById('out-i1-angle');
const outI2 = document.getElementById('out-i2');
const outI2Angle = document.getElementById('out-i2-angle');
const rowDelivered = document.getElementById('row-delivered');
const outI1Delivered = document.getElementById('out-i1-delivered');
const outI2Delivered = document.getElementById('out-i2-delivered');
const outIc = document.getElementById('out-ic');
const outIcAngle = document.getElementById('out-ic-angle');
const outU1t1 = document.getElementById('out-u1-t1');
const outU1t2 = document.getElementById('out-u1-t2');
const outSmax = document.getElementById('out-smax');
const outLimiting = document.getElementById('out-limiting');

/* ── DOM references — Eligibility status banners ─────────────── */
const statusRatio = document.getElementById('status-ratio');
const statusIc = document.getElementById('status-ic');
const overloadBarsContainer = document.getElementById('overload-bars');
const loadShareContainer = document.getElementById('load-share');

/* ── Canvas ──────────────────────────────────────────────────── */
const canvasPhasor = document.getElementById('sim-chart');

/* ── Error helpers ────────────────────────────────────────────── */
function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('is-visible');
}
function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('is-visible');
}

/* ── Format helpers ───────────────────────────────────────────── */
function fmt(val, decimals = 2) {
    if (!isFinite(val)) return '—';
    return val.toFixed(decimals);
}

/* ── Populate defaults + slider range on load ─────────────────── */
function populateDefaults() {
    inSn1.value = DEFAULT_T1.Sn;
    inUcc1.value = DEFAULT_T1.Ucc;
    inPcc1.value = DEFAULT_T1.Pcc;
    inUnhv1.value = DEFAULT_T1.Un_hv;
    inUnlv1.value = DEFAULT_T1.Un_lv;

    inSn2.value = DEFAULT_T2.Sn;
    inUcc2.value = DEFAULT_T2.Ucc;
    inPcc2.value = DEFAULT_T2.Pcc;
    inUnhv2.value = DEFAULT_T2.Un_hv;
    inUnlv2.value = DEFAULT_T2.Un_lv;

    inCosPhi.min = COSPHI_MIN;
    inCosPhi.max = COSPHI_MAX;
    inCosPhi.step = COSPHI_STEP;
    inCosPhi.value = DEFAULT_LOAD.cosPhi;
    inU2.value = DEFAULT_LOAD.U2;

    updateLoadSliderRange();
    inLoadS.value = DEFAULT_LOAD.S;
}

/** Load slider max = 1.5 × (Sn1 + Sn2), recalculated whenever Sn changes. */
function updateLoadSliderRange() {
    const sn1 = parseFloat(inSn1.value) || 0;
    const sn2 = parseFloat(inSn2.value) || 0;
    const max = (sn1 + sn2) * LOAD_SLIDER_MAX_MULTIPLIER;
    inLoadS.min = LOAD_SLIDER_MIN;
    inLoadS.max = max > 0 ? max.toFixed(1) : 10;
    inLoadS.step = LOAD_SLIDER_STEP;
}

/* ── Status-banner rendering (.status-banner--success/--danger) ─ */
function renderStatusBanner(el, ok, okTitle, okMsg, failTitle, failMsg) {
    if (!el) return;
    el.classList.remove('status-banner--success', 'status-banner--danger');
    el.classList.add(ok ? 'status-banner--success' : 'status-banner--danger');
    el.querySelector('.status-banner__title').textContent = ok ? okTitle : failTitle;
    el.querySelector('.status-banner__message').textContent = ok ? okMsg : failMsg;
}

/* ── Core calculation ─────────────────────────────────────────── */
function calculate() {
    clearError();

    // 1. Read inputs
    const t1 = {
        Sn: parseFloat(inSn1.value),
        Ucc: parseFloat(inUcc1.value),
        Pcc: parseFloat(inPcc1.value),
        Un_hv: parseFloat(inUnhv1.value),
        Un_lv: parseFloat(inUnlv1.value),
    };
    const t2 = {
        Sn: parseFloat(inSn2.value),
        Ucc: parseFloat(inUcc2.value),
        Pcc: parseFloat(inPcc2.value),
        Un_hv: parseFloat(inUnhv2.value),
        Un_lv: parseFloat(inUnlv2.value),
    };
    const load = {
        S: parseFloat(inLoadS.value),
        cosPhi: parseFloat(inCosPhi.value),
        U2: parseFloat(inU2.value),
    };

    // 2. Validate
    const allValues = [...Object.values(t1), ...Object.values(t2), ...Object.values(load)];
    if (allValues.some((v) => isNaN(v) || v <= 0)) {
        showError(_t(
            'Please enter valid positive values for all fields.',
            'Por favor ingresá valores positivos válidos en todos los campos.'
        ));
        return;
    }
    if (load.cosPhi > 1) {
        showError(_t('Power factor cannot exceed 1.', 'El factor de potencia no puede ser mayor a 1.'));
        return;
    }

    let result;
    try {
        result = core.computeParallelTransformers({ t1, t2, load });
    } catch (err) {
        showError(err.message);
        return;
    }

    // 3. Nameplate conversion (verification block)
    outUcc1.textContent = fmt(result.nameplate.t1.u_cc_pct, 2);
    outUr1.textContent = fmt(result.nameplate.t1.u_r_pct, 2);
    outUx1.textContent = fmt(result.nameplate.t1.u_x_pct, 2);
    outUcc2.textContent = fmt(result.nameplate.t2.u_cc_pct, 2);
    outUr2.textContent = fmt(result.nameplate.t2.u_r_pct, 2);
    outUx2.textContent = fmt(result.nameplate.t2.u_x_pct, 2);

    // 4. Main numeric results
    outI1.textContent = fmt(result.currents.I1_mag, 2);
    outI1Angle.textContent = fmt(result.currents.I1_angle_deg, 2);
    outI2.textContent = fmt(result.currents.I2_mag, 2);
    outI2Angle.textContent = fmt(result.currents.I2_angle_deg, 2);
    // Only show "delivered to load" when there's circulating current worth
    // separating out — otherwise I_delivered === I and the row is noise.
    if (result.currents.Ic_mag >= 0.005) {
        rowDelivered.style.display = '';
        outI1Delivered.textContent = fmt(result.currents.I1_load_mag, 2);
        outI2Delivered.textContent = fmt(result.currents.I2_load_mag, 2);
    } else {
        rowDelivered.style.display = 'none';
    }
    outIc.textContent = fmt(result.currents.Ic_mag, 2);
    outIcAngle.textContent = fmt(result.currents.Ic_angle_deg, 2);
    outU1t1.textContent = fmt(result.primaryVoltage.U1_t1, 0);
    outU1t2.textContent = fmt(result.primaryVoltage.U1_t2, 0);
    outSmax.textContent = fmt(result.maxPower.Smax_total, 2);
    if (result.maxPower.limitingTransformer === 'TIE') {
        outLimiting.textContent = _t('Tied (T1 & T2)', 'Empatados (T1 y T2)');
        outLimiting.closest('.sim-result-card')?.classList.remove('sim-result-card--limiting');
    } else {
        outLimiting.textContent = result.maxPower.limitingTransformer === 'T1' ? _t('T1', 'T1') : _t('T2', 'T2');
        outLimiting.closest('.sim-result-card')?.classList.add('sim-result-card--limiting');
    }

    // 5. Eligibility status banners
    renderStatusBanner(
        statusRatio, result.eligibility.ratioOk,
        _t('Ratio OK', 'Relación OK'),
        _t(
            `Ratio mismatch: ${fmt(result.eligibility.ratioMismatchPct, 2)}% (within the ${RATIO_MISMATCH_TOLERANCE_PCT}% tolerance).`,
            `Diferencia de relación: ${fmt(result.eligibility.ratioMismatchPct, 2)}% (dentro de la tolerancia de ${RATIO_MISMATCH_TOLERANCE_PCT}%).`
        ),
        _t('Ratio mismatch too high', 'Relación no coincide'),
        _t(
            `Ratio mismatch: ${fmt(result.eligibility.ratioMismatchPct, 2)}% — exceeds the ${RATIO_MISMATCH_TOLERANCE_PCT}% tolerance. Parallel connection is not recommended.`,
            `Diferencia de relación: ${fmt(result.eligibility.ratioMismatchPct, 2)}% — supera la tolerancia de ${RATIO_MISMATCH_TOLERANCE_PCT}%. No se recomienda el paralelo.`
        )
    );
    renderStatusBanner(
        statusIc, result.eligibility.IcOk,
        _t('Circulating current OK', 'Corriente de circulación OK'),
        _t(
            `Ic = ${fmt(result.currents.Ic_mag, 2)} A (${fmt(result.eligibility.IcOverNominalPct, 1)}% of nominal, within the ${CIRCULATING_CURRENT_TOLERANCE_PCT}% tolerance).`,
            `I_C = ${fmt(result.currents.Ic_mag, 2)} A (${fmt(result.eligibility.IcOverNominalPct, 1)}% de la nominal, dentro del ${CIRCULATING_CURRENT_TOLERANCE_PCT}% de tolerancia).`
        ),
        _t('Circulating current too high', 'Corriente de circulación excesiva'),
        _t(
            `Ic = ${fmt(result.currents.Ic_mag, 2)} A (${fmt(result.eligibility.IcOverNominalPct, 1)}% of nominal) — exceeds the ${CIRCULATING_CURRENT_TOLERANCE_PCT}% tolerance.`,
            `I_C = ${fmt(result.currents.Ic_mag, 2)} A (${fmt(result.eligibility.IcOverNominalPct, 1)}% de la nominal) — supera el ${CIRCULATING_CURRENT_TOLERANCE_PCT}% de tolerancia.`
        )
    );

    // 6. Load share (of the 100% delivered, how much each transformer carries)
    plot.drawLoadShareBar(loadShareContainer, result, {
        t1: _t('T1', 'T1'),
        t2: _t('T2', 'T2'),
    });

    // 7. Overload bars (own-100% scaled, red/yellow/green per core.js rule)
    plot.drawOverloadBars(overloadBarsContainer, result, {
        t1: _t('T1', 'T1'),
        t2: _t('T2', 'T2'),
    });

    // 8. Phasor diagram
    plot.drawPhasorDiagram(canvasPhasor, result, {
        i1: 'I\u2081',
        i2: 'I\u2082',
        ic: 'I_C',
        u2: 'U\u2082',
    });
}

/* ── Fullscreen diagram toggle (same pattern as kapp-diagram) ──── */
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
    document.querySelectorAll('.sim-chart-fullscreen-btn').forEach((btn) => {
        const wrap = btn.closest('.sim-chart-wrap');
        if (!wrap) return;
        btn.addEventListener('click', () => {
            if (currentFsElement() === wrap) exitFs();
            else requestFs(wrap);
        });
    });
    const onFsChange = () => {
        document.querySelectorAll('.sim-chart-wrap').forEach((wrap) => {
            const isFs = currentFsElement() === wrap;
            const btn = wrap.querySelector('.sim-chart-fullscreen-btn');
            if (btn) {
                btn.classList.toggle('is-fullscreen', isFs);
                btn.setAttribute('aria-pressed', String(isFs));
            }
        });
        calculate(); // canvas sizes itself from container pixel size — redraw
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
}

/* ── Event listeners ──────────────────────────────────────────── */
btnCalculate.addEventListener('click', calculate);

[inSn1, inUcc1, inPcc1, inUnhv1, inUnlv1, inSn2, inUcc2, inPcc2, inUnhv2, inUnlv2, inCosPhi, inU2].forEach((el) => {
    el.addEventListener('input', calculate);
});

[inSn1, inSn2].forEach((el) => {
    el.addEventListener('input', () => {
        updateLoadSliderRange();
        calculate();
    });
});

inLoadS.addEventListener('input', () => {
    loadSValueEl.textContent = `${parseFloat(inLoadS.value).toFixed(1)} kVA`;
    calculate();
});

window.addEventListener('resize', calculate);

/* ── Initial state on page load ───────────────────────────────── */
populateDefaults();
loadSValueEl.textContent = `${parseFloat(inLoadS.value).toFixed(1)} kVA`;
setupFullscreenButtons();
calculate();
