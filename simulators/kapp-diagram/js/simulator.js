/**
 * simulator.js — Kapp Diagram Calculator · UI Layer
 * engsimapp.com
 *
 * THEORY NOTES:
 *   Infinite bus model: U1 (primary) is held fixed at grid voltage.
 *   Secondary voltage: U2 = U1 − Zeq·I  (complex subtraction)
 *   Zeq from short-circuit test: Zeq = Vcc / I_nominal
 *     Req = Zeq·cos(φcc)   Xeq = Zeq·sin(φcc)
 *
 *   Sign convention for load angle φ:
 *     Inductive (lagging)  → φ < 0
 *     Capacitive (leading) → φ > 0
 *
 *   Voltage regulation: ε = (|U1| − |U2|) / |U2| × 100 %
 *     ε > 0 → voltage drop   (inductive, typical)
 *     ε < 0 → voltage rise   (capacitive)
 *
 * ─────────────────────────────────────────────────────────────────
 */

import { calculateTransformerModel } from './core.js';

// ─────────────────────────────────────────────────────────────────
//  CSS variable helper  (same as static-beam)
// ─────────────────────────────────────────────────────────────────
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ─────────────────────────────────────────────────────────────────
//  DOM references  (populated in init())
// ─────────────────────────────────────────────────────────────────
let DOM = {};

// ─────────────────────────────────────────────────────────────────
//  Error handling  (mirrors static-beam: scroll + shake on input)
// ─────────────────────────────────────────────────────────────────

/**
 * Shows the error banner and scrolls it into view.
 * If badInput is provided, adds a red shake animation to that element.
 * @param {string}           msg
 * @param {HTMLElement|null} [badInput]
 */
function showError(msg, badInput = null) {
    DOM.errorBox.textContent = msg;
    DOM.errorBox.style.display = 'block';
    DOM.errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (badInput) {
        badInput.classList.remove('input-error');
        void badInput.offsetWidth;                  // force reflow to retrigger animation
        badInput.classList.add('input-error');
        const wrap = badInput.closest('.sim-input-wrap') || badInput.parentElement;
        if (wrap) {
            wrap.classList.remove('input-error-wrap');
            void wrap.offsetWidth;
            wrap.classList.add('input-error-wrap');
        }
        setTimeout(() => badInput.classList.remove('input-error'), 600);
    }
}

function clearError() {
    DOM.errorBox.textContent = '';
    DOM.errorBox.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────
//  Vcc unit label toggle
// ─────────────────────────────────────────────────────────────────
function syncVccUnit() {
    // If switching to % and the current value looks like an absolute voltage, reset to a safe default
    if (DOM.selVccMode.value === 'percent' && parseFloat(DOM.inVcc.value) >= 100) {
        DOM.inVcc.value = '4';
    }
}

// ─────────────────────────────────────────────────────────────────
//  Validation — returns params object or throws { msg, el }
// ─────────────────────────────────────────────────────────────────
function buildParams() {
    const U1 = parseFloat(DOM.inU1.value);
    const Inom = parseFloat(DOM.inInom.value);
    const Imag = parseFloat(DOM.inImag.value);
    const cos = parseFloat(DOM.inCosPhi.value);
    const Vcc = parseFloat(DOM.inVcc.value);
    const phiCc = parseFloat(DOM.inPhiCc.value);

    if (!Number.isFinite(U1) || U1 <= 0)
        throw { msg: 'Grid voltage U₁ must be a positive number (V).', el: DOM.inU1 };

    if (!Number.isFinite(Inom) || Inom <= 0)
        throw { msg: 'Nominal current Iₙ must be a positive number (A).', el: DOM.inInom };

    if (!Number.isFinite(Imag) || Imag < 0)
        throw { msg: 'Load current I must be ≥ 0 A.', el: DOM.inImag };

    if (!Number.isFinite(cos) || cos < 0 || cos > 1)
        throw { msg: 'Power factor cos φ must be between 0 and 1.', el: DOM.inCosPhi };

    if (!Number.isFinite(Vcc) || Vcc <= 0)
        throw { msg: 'Short-circuit voltage Vcc must be a positive number.', el: DOM.inVcc };

    if (DOM.selVccMode.value === 'percent' && Vcc >= 100)
        throw { msg: 'Vcc in % must be less than 100 %.', el: DOM.inVcc };

    if (!Number.isFinite(phiCc) || phiCc < 0 || phiCc > 90)
        throw { msg: 'Short-circuit angle φcc must be between 0° and 90°.', el: DOM.inPhiCc };

    return {
        U1_nominal: U1,
        I_nominal: Inom,
        I_mag: Imag,
        cosPhi: cos,
        mode: DOM.selMode.value,
        Vcc,
        vccMode: DOM.selVccMode.value,
        phi_cc: phiCc,
    };
}

// ─────────────────────────────────────────────────────────────────
//  Format helpers
// ─────────────────────────────────────────────────────────────────
function fmt(val, dec = 2) {
    return Number.isFinite(val) ? val.toFixed(dec) : '—';
}
function fmtSigned(val, dec = 2) {
    if (!Number.isFinite(val)) return '—';
    return (val >= 0 ? '+' : '') + val.toFixed(dec);
}

// ─────────────────────────────────────────────────────────────────
//  Regulation quality badge
// ─────────────────────────────────────────────────────────────────
function updateRegBadge(reg_pct) {
    const badge = DOM.outRegBadge;
    badge.className = 'sim-reg-badge';
    const abs = Math.abs(reg_pct);
    if (abs <= 2) {
        badge.textContent = 'Excellent';
        badge.classList.add('sim-reg-badge--good');
    } else if (abs <= 5) {
        badge.textContent = 'Acceptable';
        badge.classList.add('sim-reg-badge--warn');
    } else {
        badge.textContent = 'High regulation';
        badge.classList.add('sim-reg-badge--bad');
    }
}

// ─────────────────────────────────────────────────────────────────
//  Kapp Phasor Diagram
//
//  Faculty convention:
//
//  The voltage-drop triangle is ALWAYS in the upper half.
//  It is drawn first and never moves.
//    T0 = origin (left vertex)
//    T1 = T0 + (ΔVR, 0)          — horizontal, orange
//    T2 = T1 + (0, −ΔVX)         — always upward (SVG y inverted), violet
//    ΔV = T0 → T2                — hypotenuse, red
//
//  The zoom slider scales ONLY the triangle pixels, keeping T0 fixed.
//  T2 pixel position changes with zoom, but T0 never moves.
//
//  From T2, U2 departs at angle |φ| from horizontal:
//    Inductive  (φ < 0): U2 goes UP-right   (above axis)
//    Capacitive (φ > 0): U2 goes DOWN-right  (below axis)
//  Both use the SAME |φ|, only the sign of the vertical component flips.
//
//  ΔU extends U2 in the same direction until it hits circle 2.
//  U1 closes from T0 to tip of ΔU.
//  I is dashed from T0 in the same direction as U2.
//
//  Two reference circles (dashed, geometric construction only):
//    Circle 1: center T0, radius |U1|
//    Circle 2: center T2, radius |U1|
// ─────────────────────────────────────────────────────────────────
function drawPhasorDiagram(result) {
    const svg = DOM.phasorSvg;
    const rect = svg.getBoundingClientRect();
    const W = rect.width > 10 ? rect.width : (svg.clientWidth || 480);
    const H = rect.height > 10 ? rect.height : (svg.clientHeight || 380);

    // ── Colors ───────────────────────────────────────────────────
    const cU1 = getCssVar('--color-primary') || '#6366f1';
    const cU2 = getCssVar('--color-success') || '#22c55e';
    const cDv = '#e05252';
    const cDvR = '#f59e0b';
    const cDvX = '#a855f7';
    const cDU = '#06b6d4';
    const cI = '#94a3b8';
    const cAx = getCssVar('--color-border') || '#1e293b';
    const cCir = getCssVar('--color-text-muted') || '#475569';

    // ── Physics ──────────────────────────────────────────────────
    const U1_mag = result.U1_mag;
    const U2_mag = result.U2_mag;
    const I_mag = Math.hypot(result.I.re, result.I.im);
    const phi = result.phi;          // negative = inductive, positive = capacitive
    const absPhi = Math.abs(phi);
    const isCap = phi > 0;
    const dVR = result.Req * I_mag;
    const dVX = result.Xeq * I_mag;
    const deltaU = U1_mag - U2_mag;

    // ── Zoom (ONLY scales triangle pixels, not the voltage phasors) ──
    const zoom = parseFloat(DOM.sliderZoom?.value ?? 1);

    // ── Layout constants ──────────────────────────────────────────
    const PAD = 44;
    const LPAD = PAD + 16;
    const LBL = 20;

    // ── Scale: ajustada a ancho Y alto disponibles ────────────────
    // En fullscreen W y H son grandes — hay que contener el diagrama
    // en ambas dimensiones. scaleV = mínimo entre restricción horizontal
    // y restricción vertical.
    const budgetW = W - LPAD - PAD;
    const budgetH = H - PAD * 2 - LBL * 2;

    // Restricción horizontal: U1 horizontal cabe en budgetW
    const scaleH = (budgetW * 0.82) / Math.max(U1_mag, 1e-9);

    // Restricción vertical: U2 vertical (máxima excursión posible = U2_mag)
    // dividida por el presupuesto vertical disponible para ese lado.
    // Usamos U2_mag completo como peor caso (φ = 90°).
    const scaleVert = (budgetH * 0.72) / Math.max(U2_mag, 1e-9);

    const scaleV = Math.min(scaleH, scaleVert);

    // Triangle visual scale (zoomed) — T1v/T2v only
    const scaleT = scaleV * zoom;

    // ── Derived geometry ──────────────────────────────────────────
    const sinA = Math.sin(absPhi);
    const cosA = Math.cos(absPhi);
    const dirY = isCap ? +sinA : -sinA;   // SVG: positive = down

    // U2 vertical excursion from T2l (pixels)
    const u2VertPx = U2_mag * sinA * scaleV;
    // Triangle vertical excursion from T0 (always up, pixels)
    const triVertPx = dVX * scaleT;

    // ── T0 position — centrado en ambos ejes ─────────────────────
    // Excursión horizontal total desde T0: dVR*scaleV + U2_mag*cosA*scaleV
    const hExcursion = (dVR + U2_mag * cosA) * scaleV;
    // Centrar horizontalmente con margen para I (iLen = budgetW*0.38)
    const iLen = Math.min(budgetW * 0.38, 180);
    const totalW = Math.max(hExcursion, iLen) + LBL * 2;
    const T0x = Math.max(LPAD, (W - totalW) / 2);
    // Things above T0: triangle (always), U2 inductive (if ind)
    // Things below T0: U2 capacitive (if cap)
    const upPx = Math.max(triVertPx, isCap ? 0 : u2VertPx) + LBL + PAD;
    const downPx = (isCap ? u2VertPx : 0) + LBL + PAD;
    // Clamp T0y so both fit, centered when possible
    const T0y = Math.min(H - downPx, Math.max(upPx, H / 2 + (downPx - upPx) / 2));
    const T0 = { x: T0x, y: T0y };

    // ── Triangle vertices ─────────────────────────────────────────
    const T1v = { x: T0.x + dVR * scaleT, y: T0.y };
    const T2v = { x: T0.x + dVR * scaleT, y: T0.y - dVX * scaleT };
    const T2l = { x: T0.x + dVR * scaleV, y: T0.y - dVX * scaleV };

    // ── Circle radius ─────────────────────────────────────────────
    const rSvg = U1_mag * scaleV;

    // ── From T2l: I horizontal, U2 at angle φ ────────────────────
    const Itip = { x: T2l.x + iLen, y: T2l.y };

    const U2tip = {
        x: T2l.x + U2_mag * scaleV * cosA,
        y: T2l.y + U2_mag * scaleV * dirY
    };
    const DUtip = {
        x: U2tip.x + deltaU * scaleV * cosA,
        y: U2tip.y + deltaU * scaleV * dirY
    };
    const U1tip = DUtip;

    // ── SVG helpers ───────────────────────────────────────────────
    const uid = Math.random().toString(36).slice(2, 6);
    const mid = n => `arr-${n}-${uid}`;

    const markerDef = (id, color, sz = 7) => {
        const hy = (sz / 2 - 0.5).toFixed(1);
        return `<marker id="${id}" markerWidth="${sz}" markerHeight="${sz}"
                        refX="${sz - 1}" refY="${hy}" orient="auto">
                    <path d="M0,0 L0,${sz - 1} L${sz},${hy} z" fill="${color}"/>
                </marker>`;
    };

    const arrow = (x1, y1, x2, y2, color, markId, sw = 2, dash = '') => {
        const d = dash ? `stroke-dasharray="${dash}"` : '';
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
                      x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                      stroke="${color}" stroke-width="${sw}" ${d}
                      marker-end="url(#${markId})"/>`;
    };

    const lbl = (x, y, text, color, anchor = 'middle') => {
        // Escala el texto con el diagrama: base 11px, crece con scaleV pero con techo
        const fs = Math.min(22, Math.max(11, Math.round(11 * scaleV / 3.5)));
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}"
               fill="${color}" font-size="${fs}" font-weight="600"
               font-family="Inter,sans-serif"
               text-anchor="${anchor}" dominant-baseline="middle">${text}</text>`;
    };

    const dot = (x, y, color, r = 3) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"
                 r="${r}" fill="${color}" opacity="0.9"/>`;

    // ── Marker IDs ────────────────────────────────────────────────
    const mU1 = mid('u1');
    const mU2 = mid('u2');
    const mDv = mid('dv');
    const mDvR = mid('dvr');
    const mDvX = mid('dvx');
    const mDU = mid('du');
    const mI = mid('i');

    // ── Axes ──────────────────────────────────────────────────────
    const axes = `
        <line x1="${(PAD / 2).toFixed(1)}" y1="${T0.y.toFixed(1)}"
              x2="${(W - PAD / 2).toFixed(1)}" y2="${T0.y.toFixed(1)}"
              stroke="${cAx}" stroke-width="1" opacity="0.3"/>
        <line x1="${T0.x.toFixed(1)}" y1="${(PAD / 2).toFixed(1)}"
              x2="${T0.x.toFixed(1)}" y2="${(H - PAD / 2).toFixed(1)}"
              stroke="${cAx}" stroke-width="1" opacity="0.3"/>`;

    // ── Circles ───────────────────────────────────────────────────
    // circ1 centered on T0 (fixed), circ2 centered on T2l (logical, zoom-independent)
    const circ1 = `<circle cx="${T0.x.toFixed(1)}" cy="${T0.y.toFixed(1)}"
                            r="${rSvg.toFixed(1)}" fill="none"
                            stroke="${cCir}" stroke-width="1"
                            stroke-dasharray="4,4" opacity="0.4"/>`;
    const circ2 = `<circle cx="${T2l.x.toFixed(1)}" cy="${T2l.y.toFixed(1)}"
                            r="${rSvg.toFixed(1)}" fill="none"
                            stroke="${cCir}" stroke-width="1"
                            stroke-dasharray="4,4" opacity="0.4"/>`;

    // ── Labels — punto medio de cada vector ──────────────────────
    const triW = T1v.x - T0.x;
    const triH = T0.y - T2v.y;
    const showTriLabels = triW > 18 && triH > 12;

    // ΔVR: medio del segmento horizontal, abajo
    const lDvR = showTriLabels
        ? lbl((T0.x + T1v.x) / 2, T1v.y + 14, 'ΔVR', cDvR) : '';
    // ΔVX: medio del segmento vertical, a la derecha
    const lDvX = (showTriLabels && triH > 22)
        ? lbl(T1v.x + 16, (T1v.y + T2v.y) / 2, 'ΔVX', cDvX, 'start') : '';
    // ΔV: medio de la hipotenusa, a la izquierda
    const lDv = showTriLabels
        ? lbl((T0.x + T2v.x) / 2 - 16, (T0.y + T2v.y) / 2, 'ΔV', cDv, 'end') : '';

    const off = Math.min(28, Math.max(14, Math.round(14 * scaleV / 3.5))); // px separación perpendicular

    // U1: T0 → U1tip, label a la IZQUIERDA del vector (offset negativo)
    const lU1 = lbl(
        (T0.x + U1tip.x) / 2 - off * sinA * (isCap ? -1 : 1),
        (T0.y + U1tip.y) / 2 - off * cosA * (isCap ? 1 : -1),
        'U₁', cU1
    );
    // U2: T2l → U2tip, label a la DERECHA del vector (offset positivo)
    const lU2 = lbl(
        (T2l.x + U2tip.x) / 2 + off * sinA * (isCap ? -1 : 1),
        (T2l.y + U2tip.y) / 2 + off * cosA * (isCap ? 1 : -1),
        'U₂', cU2
    );
    // ΔU: U2tip → DUtip
    const lDU = lbl(
        (U2tip.x + DUtip.x) / 2 + off * sinA * (isCap ? -1 : 1),
        (U2tip.y + DUtip.y) / 2 + off * cosA * (isCap ? 1 : -1),
        'ΔU', cDU
    );
    // I: horizontal desde T2l, label arriba del medio
    const lI = lbl(
        (T2l.x + Itip.x) / 2,
        T2l.y - off,
        'I', cI
    );

    svg.innerHTML = `
        <defs>
            ${markerDef(mU1, cU1, 8)}
            ${markerDef(mU2, cU2, 8)}
            ${markerDef(mDv, cDv, 7)}
            ${markerDef(mDvR, cDvR, 6)}
            ${markerDef(mDvX, cDvX, 6)}
            ${markerDef(mDU, cDU, 6)}
            ${markerDef(mI, cI, 6)}
        </defs>

        ${axes}
        ${circ1}
        ${circ2}

        <!-- ── Drop triangle: visual/zoomed (T1v, T2v), always upper half ── -->
        ${arrow(T0.x, T0.y, T1v.x, T1v.y, cDvR, mDvR, 2)}
        ${arrow(T1v.x, T1v.y, T2v.x, T2v.y, cDvX, mDvX, 2)}
        ${arrow(T0.x, T0.y, T2v.x, T2v.y, cDv, mDv, 2)}

        <!-- ── Voltage phasors from T2l (logical, zoom-independent) ── -->
        ${arrow(T2l.x, T2l.y, U2tip.x, U2tip.y, cU2, mU2, 2.5)}
        ${arrow(U2tip.x, U2tip.y, DUtip.x, DUtip.y, cDU, mDU, 2)}
        ${arrow(T0.x, T0.y, U1tip.x, U1tip.y, cU1, mU1, 2.5)}

        <!-- ── Current I (horizontal, from T2l) ── -->
        ${I_mag > 1e-9 ? arrow(T2l.x, T2l.y, Itip.x, Itip.y, cI, mI, 1.5, '5,3') : ''}

        <!-- ── Key dots ── -->
        ${dot(T0.x, T0.y, cAx, 3.5)}
        ${dot(T2l.x, T2l.y, cDv, 3.5)}
        ${dot(U2tip.x, U2tip.y, cU2, 3)}
        ${dot(U1tip.x, U1tip.y, cU1, 3)}

        <!-- ── Labels ── -->
        ${lDvR} ${lDvX} ${lDv}
        ${lU1} ${lU2} ${lDU}
        ${I_mag > 1e-9 ? lI : ''}
    `;
}

// ─────────────────────────────────────────────────────────────────
//  Write results to DOM
// ─────────────────────────────────────────────────────────────────
function renderResults(result) {
    DOM.outU2.textContent = fmt(result.U2_mag, 2);
    DOM.outDeltaV.textContent = fmt(result.dV_mag, 2);
    DOM.outReg.textContent = fmtSigned(result.regulation_pct, 2);
    DOM.outReq.textContent = fmt(result.Req, 4);
    DOM.outXeq.textContent = fmt(result.Xeq, 4);
    DOM.outPhi.textContent = fmt(result.phi * 180 / Math.PI, 1);

    updateRegBadge(result.regulation_pct);
    drawPhasorDiagram(result);
}

// ─────────────────────────────────────────────────────────────────
//  Main calculate handler
// ─────────────────────────────────────────────────────────────────
function calculate() {
    clearError();
    try {
        const params = buildParams();
        const result = calculateTransformerModel(params);
        renderResults(result);
    } catch (err) {
        if (err && err.msg) {
            showError(err.msg, err.el || null);
        } else {
            showError(err.message || 'An unexpected error occurred.');
            console.error('[KappDiagram]', err);
        }
    }
}

// ─────────────────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────────────────
function init() {
    DOM = {
        // Inputs
        inU1: document.getElementById('in-u1'),
        inInom: document.getElementById('in-inom'),
        inImag: document.getElementById('in-imag'),
        inCosPhi: document.getElementById('in-cosphi'),
        selMode: document.getElementById('sel-mode'),
        inVcc: document.getElementById('in-vcc'),
        selVccMode: document.getElementById('sel-vcc-mode'),
        inPhiCc: document.getElementById('in-phi-cc'),
        btnCalc: document.getElementById('btn-calculate'),
        // Outputs
        outU2: document.getElementById('out-u2'),
        outDeltaV: document.getElementById('out-deltav'),
        outReg: document.getElementById('out-reg'),
        outRegBadge: document.getElementById('out-reg-badge'),
        outReq: document.getElementById('out-req'),
        outXeq: document.getElementById('out-xeq'),
        outPhi: document.getElementById('out-phi'),
        // Diagram
        phasorSvg: document.getElementById('phasor-svg'),
        phasorWrap: document.getElementById('phasor-wrap'),
        sliderZoom: document.getElementById('slider-zoom'),
        zoomVal: document.getElementById('zoom-val'),
        btnFullscreen: document.getElementById('btn-fullscreen'),
        // Error
        errorBox: document.getElementById('sim-error'),
    };

    // Button
    DOM.btnCalc.addEventListener('click', calculate);

    // Vcc mode toggle → update unit label
    DOM.selVccMode.addEventListener('change', () => {
        syncVccUnit();
        calculate();
    });

    // Load type toggle
    DOM.selMode.addEventListener('change', calculate);

    // Triangle zoom slider — only redraws, no recalculation needed
    DOM.sliderZoom.addEventListener('input', () => {
        DOM.zoomVal.textContent = DOM.sliderZoom.value + '×';
        // Redraw with last result (stored in closure)
        calculate();
    });

    // Auto-recalculate on any numeric input
    [DOM.inU1, DOM.inInom, DOM.inImag, DOM.inCosPhi, DOM.inVcc, DOM.inPhiCc].forEach(el => {
        el.addEventListener('input', calculate);
    });

    // Fullscreen toggle
    DOM.btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            const el = DOM.phasorWrap;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(err => console.warn('[KappDiagram] Fullscreen:', err));
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    });

    document.addEventListener('fullscreenchange', () => {
        requestAnimationFrame(() => requestAnimationFrame(() => calculate()));
    });
    document.addEventListener('webkitfullscreenchange', () => {
        requestAnimationFrame(() => requestAnimationFrame(() => calculate()));
    });

    // Enter key on any input triggers calculate (mirrors static-beam)
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('.sim-input')) calculate();
    });

    // Redraw phasor on resize (debounced)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(calculate, 120);
    });

    // Initial render
    calculate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}