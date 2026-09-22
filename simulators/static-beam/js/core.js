/**
 * core.js — Beam Simulator Physics Engine
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Pure calculation module. Zero DOM access. Zero side effects.
 *           Physics, signs, and conventions for isostatic beams.
 * EXPORTS : calculatePhysics(state, n) — single unified entry point.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { NUMERICS } from './constants.js';


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — Reaction Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactions for a single point load P at position a on a simply supported beam of length L.
 * Convention: Ra at x=0, Rb at x=L.
 * Equilibrium: ΣM_A=0 → Rb·L = P·a → Ra = P − Rb
 */
function calcReactionsPoint(L, P, a) {
    if (a < 0 || a > L) {
        throw new Error(`Point load position out of range: a=${a}, L=${L}`);
    }
    const Ra = (P * (L - a)) / L;
    const Rb = (P * a) / L;
    return { Ra, Rb };
}

/**
 * Reactions for a UDL of intensity w [kN/m] spanning [a, b].
 * Resultant W = w·(b−a) acting at centroid x_cg = (a+b)/2.
 */
function calcReactionsDistributed(L, w, a, b) {
    if (Math.abs(b - a) < 1e-9) return { Ra: 0, Rb: 0 };
    if (a < 0 || b > L || a >= b) {
        throw new Error(`Invalid distributed load range: a=${a}, b=${b}, L=${L}`);
    }
    const W = w * (b - a);
    const xcg = (a + b) / 2;
    const Rb = (W * xcg) / L;
    const Ra = W - Rb;
    return { Ra, Rb };
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — Shear & Moment Functions
// ─────────────────────────────────────────────────────────────────────────────

function shearPoint(x, Ra, P, a) {
    return x < a ? Ra : Ra - P;
}

function momentPoint(x, Ra, P, a) {
    return x <= a ? Ra * x : Ra * x - P * (x - a);
}

function shearDistributed(x, Ra, w, a, b) {
    if (x < a) return Ra;
    if (x <= b) return Ra - w * (x - a);
    return Ra - w * (b - a);
}

function momentDistributed(x, Ra, w, a, b) {
    if (x < a) return Ra * x;
    if (x <= b) return Ra * x - (w * Math.pow(x - a, 2)) / 2;
    const W = w * (b - a);
    const xcg = (a + b) / 2;
    return Ra * x - W * (x - xcg);
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — Superposition Contribution
// ─────────────────────────────────────────────────────────────────────────────

function computeContribution(load, L, x) {
    const type = load.type || load.loadType;
    let V = 0, M = 0;

    if (type === 'point') {
        const { Ra } = calcReactionsPoint(L, load.P, load.a);
        V = shearPoint(x, Ra, load.P, load.a);
        M = momentPoint(x, Ra, load.P, load.a);
    } else if (type === 'distributed') {
        const { Ra } = calcReactionsDistributed(L, load.w, load.a, load.b);
        V = shearDistributed(x, Ra, load.w, load.a, load.b);
        M = momentDistributed(x, Ra, load.w, load.a, load.b);
    }

    return { V, M };
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — Numerical Integration (deflection)
// ─────────────────────────────────────────────────────────────────────────────

function trapzIntegral(x, y) {
    const result = [0];
    for (let i = 1; i < x.length; i++) {
        const dx = x[i] - x[i - 1];
        const area = 0.5 * (y[i] + y[i - 1]) * dx;
        result.push(result[i - 1] + area);
    }
    return result;
}

function findRoots(x, y) {
    const roots = [];
    for (let i = 0; i < x.length - 1; i++) {
        if (y[i] === 0) {
            roots.push(x[i]);
        } else if (y[i] * y[i + 1] < 0) {
            const t = y[i] / (y[i] - y[i + 1]);
            const xr = x[i] + t * (x[i + 1] - x[i]);
            roots.push(xr);
        }
    }
    return roots;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — Critical Point Detection
// ─────────────────────────────────────────────────────────────────────────────

function findMaxDiscrete(x, y) {
    if (x.length === 0) return { value: 0, x: 0 };
    let maxVal = y[0];
    let maxX = x[0];
    for (let i = 1; i < y.length; i++) {
        if (Math.abs(y[i]) > Math.abs(maxVal)) {
            maxVal = y[i];
            maxX = x[i];
        }
    }
    return { value: maxVal, x: maxX };
}

function findMaxWithRoots(x, dy, y) {
    const roots = dy.length > 0 ? findRoots(x, dy) : [];
    let maxObj = findMaxDiscrete(x, y);

    roots.forEach(xr => {
        const idx = x.findIndex((xi, i) =>
            i < x.length - 1 && x[i] <= xr && xr <= x[i + 1]);
        if (idx < 0) return;
        const t = (xr - x[idx]) / (x[idx + 1] - x[idx]);
        const yr = y[idx] + t * (y[idx + 1] - y[idx]);
        if (Math.abs(yr) > Math.abs(maxObj.value)) {
            maxObj = { value: yr, x: xr };
        }
    });

    return maxObj;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — Main Physics Engine
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePhysics(state, n = NUMERICS.N_POINTS) {
    const { L } = state;

    if (!Number.isFinite(L) || L <= 0) {
        throw new Error(`Invalid beam length (L=${L})`);
    }

    const EPS = L * 1e-6;
    const xPointsSet = new Set();

    for (let i = 0; i <= n; i++) xPointsSet.add((i / n) * L);
    xPointsSet.add(0);
    xPointsSet.add(L);

    const loads = state.loads || [];

    loads.forEach(load => {
        const type = load.type || load.loadType;
        const posA = load.a || 0;
        const posB = load.b || 0;

        if (type === 'point') {
            xPointsSet.add(Math.max(0, posA - EPS));
            xPointsSet.add(posA);
            xPointsSet.add(Math.min(L, posA + EPS));
        } else if (type === 'distributed') {
            xPointsSet.add(Math.max(0, posA));
            xPointsSet.add(Math.min(L, posB));
        }
    });

    const xArray = Array.from(xPointsSet).sort((a, b) => a - b);

    let totalRa = 0;
    let totalRb = 0;
    loads.forEach(l => {
        const type = l.type || l.loadType;
        const res = (type === 'point')
            ? calcReactionsPoint(L, l.P, l.a)
            : calcReactionsDistributed(L, l.w, l.a, l.b);
        totalRa += res.Ra;
        totalRb += res.Rb;
    });

    const V_arr = [];
    const M_arr = [];

    xArray.forEach(x => {
        let V_val = 0;
        let M_val = 0;
        loads.forEach(load => {
            const c = computeContribution(load, L, x);
            V_val += c.V;
            M_val += c.M;
        });
        V_arr.push(V_val);
        M_arr.push(M_val);
    });

    const E_SI = (state.E || 200) * 1e9;
    const I_SI = (state.I || 10000) * 1e-8;
    const EI = E_SI * I_SI;

    const M_SI = M_arr.map(m => m * 1000);
    const curvature = M_SI.map(m => m / EI);
    const slopeRel = trapzIntegral(xArray, curvature);
    const yRel = trapzIntegral(xArray, slopeRel);

    const y0 = yRel[0];
    const yL = yRel[yRel.length - 1];
    const correctionSlope = (yL - y0) / L;

    const y_arr = xArray.map((x, i) => yRel[i] - (y0 + correctionSlope * x));
    const theta_arr = slopeRel.map((s) => s - correctionSlope);

    const criticalPoints = {
        maxShear: findMaxDiscrete(xArray, V_arr),
        maxMoment: findMaxWithRoots(xArray, V_arr, M_arr),
        maxDeflection: findMaxWithRoots(xArray, theta_arr, y_arr)
    };

    const safeNum = (v) => (Number.isFinite(v) ? v : 0);
    return {
        x: xArray,
        V: V_arr.map(safeNum),
        M: M_arr.map(safeNum),
        theta: theta_arr.map(safeNum),
        y: y_arr.map(safeNum),
        reactions: { Ra: safeNum(totalRa), Rb: safeNum(totalRb) },
        criticalPoints
    };
}