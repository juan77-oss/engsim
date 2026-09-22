/**
 * @module plot
 * @description
 * HTML5 Canvas renderer for Mohr's Circle (plane stress).
 *
 * Depends on:  core.js  (physics — no DOM)
 * Depends on:  Nothing else. Zero external libraries.
 *
 * Public API:
 *   drawMohrCircle(canvas, data, options?)  → renders the full diagram
 *     options.theta      {number}  — optional angle in RADIANS; when provided,
 *                                    draws the rotated stress point P(θ) on
 *                                    the circle with a radius line and annotation.
 *     options.convention {string}  — 'materials' | 'mechanics' (default: 'materials')
 *   clearMohrCanvas(canvas)                 → wipes the canvas cleanly
 *
 * Coordinate conventions used on-screen:
 *   - σ (normal stress) → horizontal axis, positive right
 *   - τ (shear stress)  → vertical axis, direction depends on convention:
 *       materials → τ+ UPWARD  (τ positive = CCW on positive face)
 *       mechanics → τ+ DOWNWARD (τ positive = CW  on positive face)
 *
 * Convention effect — ONE PLACE ONLY:
 *   The Tc (convention-aware transform) wrapper in drawMohrCircle() applies
 *   tauMul = getConventionSign(convention) to every τ before conversion to
 *   canvas pixels. All other drawing functions receive Tc and are agnostic.
 *
 * Responsiveness:
 *   The function honours devicePixelRatio for crisp rendering on HiDPI screens.
 *   Call drawMohrCircle() again inside a ResizeObserver callback to re-draw
 *   when the container changes size — no internal timers are set here.
 *
 * @version 1.2.0
 */

'use strict';

import {
    computeMohrCircle,
    getStressAtAngle,
    toRadians,
    toDegrees,
    getConventionSign,
    CONVENTIONS,
} from './core.js';


// ─────────────────────────────────────────────────────────────────────────────
// THEME  — single source of truth for every visual decision
// ─────────────────────────────────────────────────────────────────────────────

/** @type {PlotTheme} */
const THEME = {
    // Canvas background
    bg: '#0f1117',

    // Axes
    axisColor: '#4a5568',
    axisWidth: 1.5,
    gridColor: '#1e2533',
    gridWidth: 1,
    tickLen: 5,
    tickColor: '#4a5568',
    tickFont: '11px "JetBrains Mono", "Courier New", monospace',
    tickColor2: '#6b7280',

    // Circle
    circleColor: '#3b82f6',   // blue-500
    circleWidth: 2,
    circleFill: 'rgba(59, 130, 246, 0.07)',

    // Diameter line (A → B through center)
    diamColor: 'rgba(248, 113, 113, 0.55)',
    diamWidth: 1.2,
    diamDash: [5, 4],

    // Special lines (τmax vertical)
    specialDash: [3, 4],
    specialColor: 'rgba(251, 191, 36, 0.5)',

    // Points
    ptRadius: 5,

    pointA: {              // (σx,  τxy)  — x-face
        fill: '#f87171',   // red-400
        stroke: '#fca5a5',
        label: 'A (σₓ, τₓᵧ)',
    },
    pointB: {              // (σy, −τxy)  — y-face (conjugate)
        fill: '#a78bfa',   // violet-400
        stroke: '#c4b5fd',
        label: 'B (σᵧ, −τₓᵧ)',
    },
    pointS1: {             // σ₁ (max principal)
        fill: '#34d399',   // emerald-400
        stroke: '#6ee7b7',
        label: 'σ₁',
    },
    pointS2: {             // σ₂ (min principal)
        fill: '#fbbf24',   // amber-400
        stroke: '#fde68a',
        label: 'σ₂',
    },
    pointTmax: {           // τ_max
        fill: '#38bdf8',   // sky-400
        stroke: '#7dd3fc',
        label: 'τmax',
    },
    centerDot: {
        fill: '#94a3b8',
        stroke: '#cbd5e1',
    },

    // θ-point — rotated stress state P(σ_θ, τ_θ)
    pointTheta: {
        fill: '#fb923c',   // orange-400  — distinct from all existing points
        stroke: '#fdba74',   // orange-300
        ringFill: 'rgba(251, 146, 60, 0.15)',
        lineColor: 'rgba(251, 146, 60, 0.70)',
        lineWidth: 1.8,
        lineDash: [4, 3],
        label: 'P(θ)',
    },

    // Labels
    labelFont: '12px "Inter", "Segoe UI", sans-serif',
    labelBoldFont: 'bold 12px "Inter", "Segoe UI", sans-serif',
    labelBg: 'rgba(15, 17, 23, 0.82)',
    labelPad: 4,

    // Axis titles
    axisTitleFont: 'bold 13px "Inter", "Segoe UI", sans-serif',
    axisTitleColor: '#94a3b8',

    // Arrow head
    arrowLen: 8,
    arrowAngle: 0.38,   // radians ≈ 22°
};


// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE TRANSFORM  — stress-space ↔ canvas-pixels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a transform object that converts stress-space coordinates
 * to canvas pixel coordinates (and back).
 *
 * Canvas origin (0,0) is top-left; y increases downward.
 * We map στ-space so that σ increases right and τ increases upward.
 *
 * @param {number} W        - Canvas logical pixel width
 * @param {number} H        - Canvas logical pixel height
 * @param {number} cx_s     - σ value at canvas center (= sigma_avg)
 * @param {number} scale    - Pixels per stress unit
 * @param {{top,right,bottom,left}} margin
 * @returns {CoordTransform}
 */
function buildTransform(W, H, cx_s, scale, margin) {
    // Canvas pixel origin of the stress-space origin (0,0)
    const ox = margin.left + (W - margin.left - margin.right) / 2 - cx_s * scale;
    const oy = margin.top + (H - margin.top - margin.bottom) / 2;

    return {
        /** Stress → canvas pixel (τ positive = upward by default) */
        toCanvas(sigma, tau) {
            return {
                x: ox + sigma * scale,
                y: oy - tau * scale,   // flip y so τ+ is visually up
            };
        },
        /** Canvas pixel → stress */
        toStress(px, py) {
            return {
                sigma: (px - ox) / scale,
                tau: (oy - py) / scale,
            };
        },
        ox,
        oy,
        scale,
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// SCALE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine a comfortable scale (px per stress unit) and margin
 * so the full circle plus all labels fit inside the canvas.
 *
 * @param {MohrResult} m - Computed Mohr's Circle data
 * @param {number} W     - Drawable width (px)
 * @param {number} H     - Drawable height (px)
 * @returns {{ scale: number, margin: object }}
 */
function computeScale(m, W, H) {
    const margin = { top: 42, right: 56, bottom: 48, left: 56 };

    const drawW = W - margin.left - margin.right;
    const drawH = H - margin.top - margin.bottom;

    // Data span with a 30% margin around the circle
    const PAD = 1.30;
    const spanS = (m.sigma1 - m.sigma2 + 2 * m.R * 0.1) * PAD || 2;  // guard zero-radius
    const spanT = 2 * m.tau_max * PAD || 2;

    const scaleS = drawW / spanS;
    const scaleT = drawH / spanT;
    const scale = Math.min(scaleS, scaleT);

    return { scale, margin };
}


// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL DRAWING PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a filled + stroked circle (dot) at canvas position (px, py).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px
 * @param {number} py
 * @param {number} r          - Radius in pixels
 * @param {string} fill
 * @param {string} stroke
 */
function drawDot(ctx, px, py, r, fill, stroke) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
}

/**
 * Draw a text label with a semi-transparent background pill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} px
 * @param {number} py
 * @param {number} dx
 * @param {number} dy
 * @param {string} color
 * @param {string} [font]
 */
function drawLabel(ctx, text, px, py, dx, dy, color, font) {
    ctx.font = font || THEME.labelFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const tw = ctx.measureText(text).width;
    const th = 14;
    const pad = THEME.labelPad;
    const lx = px + dx;
    const ly = py + dy;

    ctx.fillStyle = THEME.labelBg;
    ctx.beginPath();
    ctx.roundRect(lx - pad, ly - th / 2 - pad, tw + pad * 2, th + pad * 2, 3);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.fillText(text, lx, ly);
}

/**
 * Draw an arrowhead at (px, py) pointing in direction (angle).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} px
 * @param {number} py
 * @param {number} angle  - Direction the arrow POINTS TO (canvas radians)
 * @param {string} color
 */
function drawArrowHead(ctx, px, py, angle, color) {
    const L = THEME.arrowLen;
    const a = THEME.arrowAngle;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(
        px - L * Math.cos(angle - a),
        py - L * Math.sin(angle - a)
    );
    ctx.lineTo(
        px - L * Math.cos(angle + a),
        py - L * Math.sin(angle + a)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}


// ─────────────────────────────────────────────────────────────────────────────
// AXES & GRID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the background grid, σ and τ axes, tick marks, and axis titles.
 *
 * NOTE: axes always use T (the raw transform, not Tc) so tick labels and
 * grid positions are not affected by the sign convention.
 * The τ-axis label has a direction indicator added via the convention arg.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} T
 * @param {MohrResult} m
 * @param {number} W
 * @param {number} H
 * @param {{top,right,bottom,left}} margin
 * @param {string} convention
 */
function drawAxes(ctx, T, m, W, H, margin, convention) {
    const { ox, oy, scale } = T;

    // ── Compute nice tick interval ─────────────────────────────────────────────
    const rawSpan = (2 * m.R * 1.5) || 10;
    const rawTick = rawSpan / 6;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawTick)));
    const norm = rawTick / magnitude;
    let niceTick = magnitude * (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10);
    if (niceTick === 0) niceTick = 1;

    // Stress-space visible bounds
    const sigmaLeft = T.toStress(margin.left, 0).sigma;
    const sigmaRight = T.toStress(W - margin.right, 0).sigma;
    const tauBottom = T.toStress(0, H - margin.bottom).tau;
    const tauTop = T.toStress(0, margin.top).tau;

    // ── Grid lines ─────────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = THEME.gridColor;
    ctx.lineWidth = THEME.gridWidth;

    const sStart = Math.ceil(sigmaLeft / niceTick) * niceTick;
    for (let s = sStart; s <= sigmaRight + niceTick; s += niceTick) {
        const { x } = T.toCanvas(s, 0);
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, H - margin.bottom);
        ctx.stroke();
    }

    const tStart = Math.ceil(tauBottom / niceTick) * niceTick;
    for (let t = tStart; t <= tauTop + niceTick; t += niceTick) {
        const { y } = T.toCanvas(0, t);
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(W - margin.right, y);
        ctx.stroke();
    }
    ctx.restore();

    // ── Axes ───────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.strokeStyle = THEME.axisColor;
    ctx.lineWidth = THEME.axisWidth;

    // σ axis (horizontal)
    ctx.beginPath();
    ctx.moveTo(margin.left, oy);
    ctx.lineTo(W - margin.right, oy);
    ctx.stroke();
    drawArrowHead(ctx, W - margin.right, oy, 0, THEME.axisColor);

    // τ axis (vertical)
    ctx.beginPath();
    ctx.moveTo(ox, H - margin.bottom);
    ctx.lineTo(ox, margin.top);
    ctx.stroke();
    drawArrowHead(ctx, ox, margin.top, -Math.PI / 2, THEME.axisColor);

    ctx.restore();

    // ── Tick marks & numeric labels ────────────────────────────────────────────
    ctx.save();
    ctx.font = THEME.tickFont;
    ctx.fillStyle = THEME.tickColor2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let s = sStart; s <= sigmaRight + niceTick; s += niceTick) {
        const { x } = T.toCanvas(s, 0);
        ctx.strokeStyle = THEME.tickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, oy - THEME.tickLen);
        ctx.lineTo(x, oy + THEME.tickLen);
        ctx.stroke();
        ctx.fillText(formatTick(s), x, oy + THEME.tickLen + 2);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let t = tStart; t <= tauTop + niceTick; t += niceTick) {
        const { y } = T.toCanvas(0, t);
        ctx.strokeStyle = THEME.tickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox - THEME.tickLen, y);
        ctx.lineTo(ox + THEME.tickLen, y);
        ctx.stroke();
        if (Math.abs(t) > niceTick * 0.01) {
            ctx.fillText(formatTick(t), ox - THEME.tickLen - 3, y);
        }
    }
    ctx.restore();

    // ── Axis titles ────────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = THEME.axisTitleFont;
    ctx.fillStyle = THEME.axisTitleColor;

    // σ title (right end)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('σ', W - margin.right + 10, oy);

    // τ title — with convention direction indicator
    const isMech = convention === CONVENTIONS.MECHANICS;
    const tauSign = isMech ? '↓' : '↑';
    ctx.save();
    ctx.translate(ox, margin.top - 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isMech ? '#fb923c' : '#38bdf8';
    ctx.fillText(`τ ${tauSign}`, 0, 0);
    ctx.restore();

    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// CIRCLE & GEOMETRY LAYERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the Mohr's Circle (filled + stroked).
 * The circle geometry is convention-agnostic — always uses the raw T.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} T
 * @param {MohrResult} m
 */
function drawCircle(ctx, T, m) {
    const { x: cx, y: cy } = T.toCanvas(m.sigma_avg, 0);
    const rPx = m.R * T.scale;

    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.fillStyle = THEME.circleFill;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.strokeStyle = THEME.circleColor;
    ctx.lineWidth = THEME.circleWidth;
    ctx.stroke();

    ctx.restore();
}

/**
 * Draw the diameter line from A(σx, τxy) to B(σy, −τxy) through center C.
 * Uses Tc so A and B render at convention-correct vertical positions.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} Tc  - Convention-aware transform
 * @param {MohrResult} m
 */
function drawDiameter(ctx, Tc, m) {
    const A = Tc.toCanvas(m.sigma_x, m.tau_xy);
    const B = Tc.toCanvas(m.sigma_y, -m.tau_xy);

    ctx.save();
    ctx.setLineDash(THEME.diamDash);
    ctx.strokeStyle = THEME.diamColor;
    ctx.lineWidth = THEME.diamWidth;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

/**
 * Draw helper dashed lines: vertical spine at σ_avg and horizontal lines at ±τmax.
 * Uses Tc so helper lines respect convention direction.
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} Tc
 * @param {MohrResult} m
 */
function drawHelperLines(ctx, Tc, m) {
    const topPt = Tc.toCanvas(m.sigma_avg, m.tau_max);
    const botPt = Tc.toCanvas(m.sigma_avg, -m.tau_max);
    const leftPt = Tc.toCanvas(m.sigma2, 0);
    const rightPt = Tc.toCanvas(m.sigma1, 0);

    ctx.save();
    ctx.setLineDash(THEME.specialDash);
    ctx.strokeStyle = THEME.specialColor;
    ctx.lineWidth = 1;

    // Vertical spine at σ_avg
    ctx.beginPath();
    ctx.moveTo(topPt.x, topPt.y);
    ctx.lineTo(botPt.x, botPt.y);
    ctx.stroke();

    // Horizontal lines at ±τmax
    [topPt, botPt].forEach(pt => {
        ctx.beginPath();
        ctx.moveTo(leftPt.x, pt.y);
        ctx.lineTo(rightPt.x, pt.y);
        ctx.stroke();
    });

    ctx.setLineDash([]);
    ctx.restore();
}




// ─────────────────────────────────────────────────────────────────────────────
// NAMED POINTS  — A, B, σ₁, σ₂, τmax, center
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw all fixed named stress points and their annotations.
 * ALL points use Tc — so their τ position respects the sign convention.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} Tc  - Convention-aware transform
 * @param {MohrResult} m
 * @param {object} [options={}] - Rendering options (highlightTauMax, showPrincipalLabels, showSigmaAvg)
 */
function drawPoints(ctx, Tc, m, options = {}) {
    const r = THEME.ptRadius;
    const highlightTauMax = !!options.highlightTauMax;
    const showPrincipalLabels = !!options.showPrincipalLabels;
    const showSigmaAvg = !!options.showSigmaAvg;

    // ── Center C ───────────────────────────────────────────────────────────────
    const C = Tc.toCanvas(m.sigma_avg, 0);
    drawDot(ctx, C.x, C.y, 3, THEME.centerDot.fill, THEME.centerDot.stroke);

    if (showSigmaAvg) {
        drawLabel(ctx, 'σavg', C.x, C.y, 6, 8, THEME.axisTitleColor, '10px "JetBrains Mono", monospace');
    }

    // ── Point A : (σx, τxy)  — x-face ─────────────────────────────────────────
    {
        const pt = Tc.toCanvas(m.sigma_x, m.tau_xy);
        drawDot(ctx, pt.x, pt.y, r, THEME.pointA.fill, THEME.pointA.stroke);
        drawLabel(ctx, THEME.pointA.label, pt.x, pt.y, 8, -8,
            THEME.pointA.stroke, THEME.labelFont);
    }

    // ── Point B : (σy, −τxy)  — y-face ────────────────────────────────────────
    {
        const pt = Tc.toCanvas(m.sigma_y, -m.tau_xy);
        drawDot(ctx, pt.x, pt.y, r, THEME.pointB.fill, THEME.pointB.stroke);
        drawLabel(ctx, THEME.pointB.label, pt.x, pt.y, 8, 4,
            THEME.pointB.stroke, THEME.labelFont);
    }

    // ── σ₁ — max principal stress (rightmost point) ───────────────────────────
    {
        const pt = Tc.toCanvas(m.sigma1, 0);
        drawDot(ctx, pt.x, pt.y, r, THEME.pointS1.fill, THEME.pointS1.stroke);
        if (showPrincipalLabels) {
            drawLabel(ctx, `σ₁ = ${m.sigma1.toFixed(1)}`, pt.x, pt.y, 6, -14,
                THEME.pointS1.stroke, THEME.labelFont);
        }
    }

    // ── σ₂ — min principal stress (leftmost point) ────────────────────────────
    {
        const pt = Tc.toCanvas(m.sigma2, 0);
        drawDot(ctx, pt.x, pt.y, r, THEME.pointS2.fill, THEME.pointS2.stroke);
        if (showPrincipalLabels) {
            drawLabel(ctx, `σ₂ = ${m.sigma2.toFixed(1)}`, pt.x, pt.y, -(50 + 60), -14,
                THEME.pointS2.stroke, THEME.labelFont);
        }
    }

    {
        const pt = Tc.toCanvas(m.sigma_avg, m.tau_max);

        // Highlight logic for τmax point (educational emphasis)
        const fill = highlightTauMax ? '#fb923c' : THEME.pointTmax.fill;
        const stroke = highlightTauMax ? '#fdba74' : THEME.pointTmax.stroke;

        drawDot(ctx, pt.x, pt.y, r, fill, stroke);
        drawLabel(ctx, `τmax = ${m.tau_max.toFixed(1)}`, pt.x, pt.y, 8, 0,
            stroke, THEME.labelFont);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// θ-POINT  — rotated stress state P(σ_θ, τ_θ)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw the stress point at angle θ on Mohr's Circle.
 *
 * Convention handling:
 *   - Tc already incorporates tauMul, so P renders at the convention-correct
 *     vertical position on the canvas.
 *   - The 2θ arc direction must match the convention:
 *       materials → CCW sweep on canvas = CW in math → correct for materials textbooks
 *       mechanics → CW  sweep on canvas = CCW in math → correct for mechanics textbooks
 *   - The annotation box always shows the physics value of τ(θ) (convention-agnostic).
 *     A small note next to τ tells the student which convention is active.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {CoordTransform} Tc          - Convention-aware transform
 * @param {MohrResult} m
 * @param {number} theta_rad           - Physical rotation angle [rad]
 * @param {string} convention          - 'materials' | 'mechanics'
 */
function drawThetaPoint(ctx, Tc, m, theta_rad, convention) {
    // ── Physics (convention-agnostic) ─────────────────────────────────────────
    const { sigma_theta, tau_theta } = getStressAtAngle(
        m.sigma_x, m.sigma_y, m.tau_xy, theta_rad
    );
    const theta_deg = toDegrees(theta_rad);

    // Canvas positions — Tc applies tauMul so P is at the right visual position
    const P = Tc.toCanvas(sigma_theta, tau_theta);
    const C = Tc.toCanvas(m.sigma_avg, 0);
    const Proj = Tc.toCanvas(sigma_theta, 0);   // projection onto σ-axis

    const th = THEME.pointTheta;

    // ── 1. Projection line (sigma-axis → P, shows τ component) ─────────────────
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Proj.x, Proj.y);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();

    // ── 2. Tick on sigma-axis at sigma_theta ────────────────────────────────────
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
    ctx.beginPath();
    ctx.moveTo(Proj.x, Tc.oy - 5);
    ctx.lineTo(Proj.x, Tc.oy + 5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── 3. Dashed radius C → P ─────────────────────────────────────────────────
    ctx.save();
    ctx.setLineDash(th.lineDash);
    ctx.strokeStyle = th.lineColor;
    ctx.lineWidth = th.lineWidth;
    ctx.beginPath();
    ctx.moveTo(C.x, C.y);
    ctx.lineTo(P.x, P.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // ── 4. 2θ angle arc from A to P ─────────────────────────────────────────────
    //
    //   A = point at θ=0. Its canvas position comes via Tc (convention-aware).
    //
    //   KEY FIX (v1.2.1): sweep is derived from the physical θ, NOT from the
    //   canvas position of P.  Using P's canvas angle caused the arc to take
    //   the long path (>180°) in mechanics convention at large θ, because
    //   tauMul flips P's y-position and the angular difference can wrap past π.
    //
    //   Physical mapping → canvas direction:
    //     materials: math-CCW radius = canvas +angle (y-flipped) → sweep = +2θ
    //     mechanics: math-CW  radius = canvas -angle (y-flipped) → sweep = −2θ
    //
    //   ctx.arc is always called with anticlockwise=false (CW flag);
    //   the signed canvasSweep moves the end angle in the correct direction.
    {
        const Ac = Tc.toCanvas(m.sigma_x, m.tau_xy);
        const startAngle = Math.atan2(Ac.y - C.y, Ac.x - C.x);   // canvas angle to A
        const rPx = m.R * Tc.scale;
        const arcR = Math.max(rPx * 0.28, 10);

        // arcCCW documented for convention clarity but NOT passed to ctx.arc —
        // direction is encoded in the sign of canvasSweep instead.
        const arcCCW = convention !== CONVENTIONS.MECHANICS;
        const canvasSweep = 2 * theta_rad * (arcCCW ? 1 : -1);
        const endAngle = startAngle + canvasSweep;

        ctx.save();
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(C.x, C.y, arcR, startAngle, endAngle, false);   // false = CW; direction via canvasSweep
        ctx.stroke();

        // Label "2θ" at midpoint of the arc — always stable because
        // it is derived from θ, not from canvas-position vectors.
        const midAngle = startAngle + canvasSweep / 2;
        const lx = C.x + (arcR + 10) * Math.cos(midAngle);
        const ly = C.y + (arcR + 10) * Math.sin(midAngle);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(251, 146, 60, 0.75)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('2θ', lx, ly);
        ctx.restore();
    }

    // ── 5. Halo ─────────────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(P.x, P.y, THEME.ptRadius + 5, 0, Math.PI * 2);
    ctx.fillStyle = th.ringFill;
    ctx.fill();
    ctx.restore();

    // ── 6. Dot ───────────────────────────────────────────────────────────────────
    drawDot(ctx, P.x, P.y, THEME.ptRadius + 1, th.fill, th.stroke);

    // ── 7. Floating annotation box ───────────────────────────────────────────────
    //   Adapts quadrant: offX prefers the side with more empty space.
    //   P.y < C.y in canvas means P is visually ABOVE the σ-axis (τ+ visually up).
    const offX = sigma_theta > m.sigma_avg ? 12 : -(140 + 12);
    const offY = P.y < C.y ? -32 : 10;

    const isMech = convention === CONVENTIONS.MECHANICS;
    const convNote = isMech ? ' (CW)' : ' (CCW)';

    const lines = [
        { color: th.fill, text: `P  θ = ${theta_deg.toFixed(1)}°` },
        { color: '#34d399', text: `σ(θ) = ${sigma_theta.toFixed(2)}` },
        { color: '#f87171', text: `τ(θ) = ${tau_theta.toFixed(2)}${convNote}` },
    ];

    const lFont = '11px "JetBrains Mono", "Courier New", monospace';
    const lh = 15;
    const lPad = 5;

    ctx.save();
    ctx.font = lFont;

    const boxW = Math.max(...lines.map(l => ctx.measureText(l.text).width)) + lPad * 2;
    const boxH = lines.length * lh + lPad * 2;
    const bx = P.x + offX;
    const by = P.y + offY;

    ctx.fillStyle = 'rgba(15, 17, 23, 0.88)';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach(({ color, text }, i) => {
        ctx.fillStyle = color;
        ctx.fillText(text, bx + lPad, by + lPad + lh * i + lh / 2);
    });

    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// LEGEND
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a compact legend in the top-left corner of the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {MohrResult} m
 * @param {ThetaData|null} [thetaData=null]
 *
 * @typedef {{ theta_rad: number, sigma_theta: number, tau_theta: number }} ThetaData
 */
function drawLegend(ctx, m, thetaData = null) {
    const items = [
        { color: THEME.pointA.fill, label: `A  σx = ${m.sigma_x.toFixed(1)},  τxy = ${m.tau_xy.toFixed(1)}` },
        { color: THEME.pointB.fill, label: `B  σy = ${m.sigma_y.toFixed(1)},  −τxy = ${(-m.tau_xy).toFixed(1)}` },
        { color: THEME.pointS1.fill, label: `σ₁ = ${m.sigma1.toFixed(2)}` },
        { color: THEME.pointS2.fill, label: `σ₂ = ${m.sigma2.toFixed(2)}` },
        { color: THEME.pointTmax.fill, label: `τmax = ${m.tau_max.toFixed(2)}` },
        { color: THEME.axisTitleColor, label: `θp = ${m.theta_p_deg.toFixed(2)}°` },
        { color: THEME.circleColor, label: `σavg = ${m.sigma_avg.toFixed(2)},  R = ${m.R.toFixed(2)}` },
    ];

    if (thetaData !== null) {
        const { theta_rad, sigma_theta, tau_theta } = thetaData;
        const th = THEME.pointTheta;
        items.push(
            { color: th.fill, label: `── P(θ)  θ = ${toDegrees(theta_rad).toFixed(1)}°` },
            { color: '#34d399', label: `   σ(θ) = ${sigma_theta.toFixed(2)}` },
            { color: '#f87171', label: `   τ(θ)  = ${tau_theta.toFixed(2)}` },
        );
    }

    const x0 = 12;
    let y0 = 14;
    const lh = 17;
    const dotR = 4;

    ctx.save();
    ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
    ctx.textBaseline = 'middle';

    const maxW = Math.max(...items.map(i => ctx.measureText(i.label).width));
    ctx.fillStyle = 'rgba(15, 17, 23, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x0 - 4, y0 - 6, maxW + dotR * 2 + 16, items.length * lh + 10, 5);
    ctx.fill();

    items.forEach(({ color, label }) => {
        drawDot(ctx, x0 + dotR, y0, dotR, color, color);
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(label, x0 + dotR * 2 + 6, y0);
        y0 += lh;
    });

    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// CONVENTION BADGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draw a pill badge in the bottom-right corner identifying the active convention.
 *
 * Materials: "τ ↑  Materials"
 * Mechanics: "τ ↓  Mechanics"
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W
 * @param {number} H
 * @param {string} convention
 */
function drawConventionBadge(ctx, W, H, convention) {
    const isMech = convention === CONVENTIONS.MECHANICS;
    const label = isMech ? 'τ ↓  Mechanics' : 'τ ↑  Materials';
    const color = isMech ? '#fb923c' : '#38bdf8';

    ctx.save();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';

    const tw = ctx.measureText(label).width;
    const pad = 6;
    const bx = W - pad - tw - pad * 2;
    const by = H - pad - 18;
    const bw = tw + pad * 2;
    const bh = 18;

    ctx.fillStyle = 'rgba(15, 17, 23, 0.80)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, bx + pad, by + bh / 2);

    ctx.restore();
}


// ─────────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a stress value for tick display.
 * Avoids −0 and unnecessary decimal places.
 * @param {number} v
 * @returns {string}
 */
function formatTick(v) {
    if (Object.is(v, -0)) v = 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(0);
}

/**
 * Prepare the canvas for HiDPI (Retina) rendering.
 *
 * FIX (v1.2.0): ctx.setTransform() is called BEFORE ctx.scale() to reset any
 * accumulated transforms from previous draw calls (animation loop, ResizeObserver).
 * Without this, each repaint adds another dpr scale factor → canvas distortion.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ W: number, H: number, dpr: number, ctx: CanvasRenderingContext2D }}
 */
function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Backing buffer dimensions (physical pixels)
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');

    // CRITICAL: reset transform before scaling — prevents accumulation across frames
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    return {
        W: rect.width,
        H: rect.height,
        dpr,
        ctx,
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render Mohr's Circle on the provided canvas element.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas element.
 *
 * @param {{ sigma_x: number, sigma_y: number, tau_xy: number }} data
 *   Raw stress components (any consistent unit — MPa, kPa, psi…)
 *
 * @param {object} [options={}]
 *   Optional rendering options.
 *   - `theta`      {number} — physical rotation angle in radians.
 *     When provided, draws point P(σ_θ, τ_θ) on the circle,
 *     a dashed radius line, τ-projection, 2θ arc, and extra legend rows.
 *   - `convention` {string} — 'materials' | 'mechanics' (default: 'materials').
 *     Controls τ-axis direction and arc sweep on the diagram.
 *     Does NOT affect σ₁, σ₂, τmax, θp — those are physics invariants.
 *
 * @throws {TypeError}  If data contains non-finite numbers.
 * @throws {Error}      If canvas is not a valid HTMLCanvasElement.
 *
 * @example — basic
 *   drawMohrCircle(canvas, { sigma_x: 80, sigma_y: -20, tau_xy: 30 });
 *
 * @example — with theta + convention
 *   drawMohrCircle(canvas,
 *     { sigma_x: 80, sigma_y: -20, tau_xy: 30 },
 *     { theta: Math.PI / 6, convention: 'mechanics' });
 */
function drawMohrCircle(canvas, data, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('[mohr-plot] First argument must be an HTMLCanvasElement.');
    }

    const { sigma_x, sigma_y, tau_xy } = data;

    // ── Resolve options ─────────────────────────────────────────────────────────
    const thetaRaw = options?.theta;
    const hasTheta = typeof thetaRaw === 'number' && isFinite(thetaRaw);
    const theta_rad = hasTheta ? thetaRaw : null;

    // Visual highlights and educational flags
    const visOptions = {
        highlightTauMax: !!options?.highlightTauMax,
        showPrincipalLabels: !!options?.showPrincipalLabels,
        showSigmaAvg: !!options?.showSigmaAvg,
        showTauAxisGuide: !!options?.showTauAxisGuide
    };

    // Sign convention (default: materials — positive τ upward)
    const convention = options?.convention ?? CONVENTIONS.MATERIALS;

    // tauMul: +1 keeps τ+ upward (materials / math convention)
    //         -1 flips τ+ downward (mechanics convention)
    // This is the SINGLE point where convention affects rendering.
    const tauMul = getConventionSign(convention);

    // ── Physics ─────────────────────────────────────────────────────────────────
    const m = computeMohrCircle(sigma_x, sigma_y, tau_xy);

    // ── Pre-compute theta stress ─────────────────────────────────────────────────
    let thetaData = null;
    if (hasTheta) {
        const { sigma_theta, tau_theta } = getStressAtAngle(
            sigma_x, sigma_y, tau_xy, theta_rad
        );
        thetaData = { theta_rad, sigma_theta, tau_theta };
    }

    // ── Canvas setup ─────────────────────────────────────────────────────────────
    // setupHiDPI resets the transform and sets dpr scale atomically.
    const { W, H, ctx } = setupHiDPI(canvas);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, W, H);

    // ── Scale & coordinate transform ────────────────────────────────────────────
    const { scale, margin } = computeScale(m, W, H);
    const T = buildTransform(W, H, m.sigma_avg, scale, margin);

    // ── Convention-aware transform wrapper (Tc) ──────────────────────────────────
    //
    // Tc wraps T and multiplies every τ by tauMul before converting to pixels.
    // When convention = 'mechanics', tauMul = -1, which flips the τ axis so
    // positive τ appears DOWNWARD on the canvas — the standard mechanics diagram.
    //
    // Rules:
    //  ✦ drawAxes  → uses T    (raw) — grid/ticks must not be flipped
    //  ✦ everything else → uses Tc  (convention-aware)
    //
    const Tc = {
        toCanvas(sigma, tau) { return T.toCanvas(sigma, tauMul * tau); },
        toStress(px, py) { return T.toStress(px, py); },
        ox: T.ox,
        oy: T.oy,
        scale: T.scale,
    };

    // ── Render layers (painter's order: back → front) ────────────────────────────
    drawAxes(ctx, T, m, W, H, margin, convention);
    drawHelperLines(ctx, Tc, m);
    drawDiameter(ctx, Tc, m);
    drawCircle(ctx, T, m);           // circle geometry is convention-agnostic
    drawPoints(ctx, Tc, m, visOptions);

    // ── Optional θ-layer ─────────────────────────────────────────────────────────
    if (hasTheta) {
        drawThetaPoint(ctx, Tc, m, theta_rad, convention);
    }

    // ── Overlay: legend + convention badge ───────────────────────────────────────
    drawLegend(ctx, m, thetaData);
    drawConventionBadge(ctx, W, H, convention);
}

/**
 * Clear the canvas and fill it with the background color.
 * @param {HTMLCanvasElement} canvas
 */
function clearMohrCanvas(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);   // reset before clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


/**
 * Draw a 2D stress element (rotated square) in the PLOT layer.
 * Renders the rotated stress element visualization.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {MohrResult} m - The result from computeMohrCircle()
 * @param {number} sigma_theta - Normal stress at angle theta
 * @param {number} tau_theta - Shear stress at angle theta
 * @param {number} theta_deg - The physical rotation angle in DEGREES
 * @param {object} [options={}] - Rendering options (convention, highlightTheta)
 */
function drawStressElement(canvas, m, sigma_theta, tau_theta, theta_deg, options = {}) {
    const { ctx, W, H } = setupHiDPI(canvas);
    const convention = options?.convention ?? CONVENTIONS.MATERIALS;
    const theta_color = options?.thetaColor ?? '#fb923c'; // matching THEME.pointTheta.fill
    // NOTE: this is intentionally the OPPOSITE sign of core.js's
    // getConventionSign() (materials → -1, mechanics → -1 there vs. +1 here).
    // getConventionSign() flips the τ-AXIS on the Mohr diagram; here we're
    // orienting shear ARROWS on the physical stress element, where the
    // sense/convention relationship is inverted. Both are correct in their
    // own space — don't "fix" this to match core.js without re-deriving it.
    const convDir = convention === CONVENTIONS.MECHANICS ? 1 : -1;

    const cx = W / 2;
    const cy = H / 2;
    const SIDE = Math.min(W, H) * 0.30;

    // ── Stress reference (MUST BE FIRST) ─────────────────────────────────────
    const maxStress = Math.max(Math.abs(m.sigma1), Math.abs(m.sigma2), Math.abs(m.tau_max), 1);

    // ── Deformation Hint ────────────────────────────────────────────────────────
    // Subtle skew/scaling to represent stress state visually
    let dx = 0, dy = 0, skew = 0;
    if (options.enableDeformation) {
        const deformScale = 4; // exaggerated for visibility
        dx = (sigma_theta / maxStress) * deformScale;
        const sigmaConj = 2 * m.sigma_avg - sigma_theta;
        dy = (sigmaConj / maxStress) * deformScale;
        skew = (tau_theta / maxStress) * (deformScale / 40) * convDir; // subtle skew matching convention
    }

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, W, H);


    // ── Reference (unrotated) ghost square ───────────────────────────────────
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(cx - SIDE, cy - SIDE, SIDE * 2, SIDE * 2);
    ctx.restore();

    // ── Rotate & Deform context ──────────────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(toRadians(theta_deg));

    if (options.enableDeformation) {
        ctx.transform(1 + dx / SIDE, skew, skew, 1 + dy / SIDE, 0, 0);
    }

    // ── Element body ──────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(251, 146, 60, 0.07)';   // tinted orange fill
    ctx.strokeStyle = theta_color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-SIDE, -SIDE, SIDE * 2, SIDE * 2);
    ctx.fill();
    ctx.stroke();

    // ── Stress Arrows ─────────────────────────────────────────────────────────
    const ARR_MAX = SIDE * 0.72;
    const arrowScale = (v) => (Math.abs(v) / maxStress) * ARR_MAX;


    const drawStressArrow = (x0, y0, len, angle, color) => {
        if (len < 1) return;
        const x1 = x0 + len * Math.cos(angle);
        const y1 = y0 + len * Math.sin(angle);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const A = 0.35, L = 8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - L * Math.cos(angle - A), y1 - L * Math.sin(angle - A));
        ctx.lineTo(x1 - L * Math.cos(angle + A), y1 - L * Math.sin(angle + A));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };

    const X_FACE_NORM = theta_color;
    const X_FACE_SHEAR = '#fdba74';
    const Y_FACE_NORM = '#6ee7b7';
    const Y_FACE_SHEAR = '#fca5a5';

    // x-faces (Normal)
    const lenSx = arrowScale(sigma_theta);
    const dirSx = sigma_theta >= 0 ? 1 : -1;
    drawStressArrow(SIDE, 0, dirSx * lenSx, 0, X_FACE_NORM);
    drawStressArrow(-SIDE, 0, -dirSx * lenSx, Math.PI, X_FACE_NORM);

    // y-faces (Normal)
    const sigmaConj = 2 * m.sigma_avg - sigma_theta;
    const lenSy = arrowScale(sigmaConj);
    const dirSy = sigmaConj >= 0 ? 1 : -1;
    drawStressArrow(0, -SIDE, -dirSy * lenSy, -Math.PI / 2, Y_FACE_NORM);
    drawStressArrow(0, SIDE, dirSy * lenSy, Math.PI / 2, Y_FACE_NORM);

    // Shear arrows
    const lenT = arrowScale(tau_theta);
    const tauSign = tau_theta >= 0 ? 1 : -1;
    const shearRightAngle = convDir * tauSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    const shearLeftAngle = convDir * tauSign > 0 ? -Math.PI / 2 : Math.PI / 2;
    const shearBotAngle = convDir * tauSign > 0 ? 0 : Math.PI;
    const shearTopAngle = convDir * tauSign > 0 ? Math.PI : 0;

    drawStressArrow(SIDE, 0, lenT, shearRightAngle, X_FACE_SHEAR);
    drawStressArrow(-SIDE, 0, lenT, shearLeftAngle, X_FACE_SHEAR);
    drawStressArrow(0, SIDE, lenT, shearBotAngle, Y_FACE_SHEAR);
    drawStressArrow(0, -SIDE, lenT, shearTopAngle, Y_FACE_SHEAR);

    ctx.restore();

    // ── Labels ────────────────────────────────────────────────────────────
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('θ = ' + theta_deg.toFixed(2) + '°', cx + SIDE + 34, cy + 10);
    ctx.fillStyle = X_FACE_NORM;
    ctx.fillText('σ(θ) = ' + sigma_theta.toFixed(2), cx, cy + SIDE + 22);
    ctx.fillStyle = X_FACE_SHEAR;
    ctx.fillText('τ(θ) = ' + tau_theta.toFixed(2), cx, cy + SIDE + 38);
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { drawMohrCircle, clearMohrCanvas, drawStressElement };

export default { drawMohrCircle, clearMohrCanvas, drawStressElement };