/**
 * core.js — Entropy T-s Diagram Simulator: Thermodynamic Engine
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Pure calculation module. Zero DOM access. Zero side effects.
 *           Thermodynamic equations for ideal gas (air) entropy processes.
 * EXPORTS : EntropyCore — single unified entry point for all process
 *           calculations.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { GAS_R as R, GAS_K as k, GAS_CV as Cv, GAS_CP as Cp } from './constants.js';

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — State 1 Calculation (Ideal Gas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the specific volume at state 1 using the ideal gas law.
 * Equation: v = R·T / P
 *
 * @param {number} T1 - Initial temperature [K]
 * @param {number} P1 - Initial pressure [kPa]
 * @returns {{ v1: number }} Specific volume [m³/kg]
 */
export function calcState1(T1, P1) {
    const v1 = (R * T1) / P1;
    return { v1 };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — Process Calculations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Isothermal process: T = constant.
 * Equations:
 *   ΔS = -R·ln(P2/P1)
 *   Q  = T1·ΔS
 *   v2 = R·T2 / P2
 *
 * @param {number} T1  - Initial temperature [K]
 * @param {number} P1  - Initial pressure [kPa]
 * @param {number} P2  - Final pressure [kPa]
 * @param {number} eta - Irreversibility factor [0.5–1.0] (1 = ideal/reversible)
 * @returns {{ T2, P2, ds, q, sgen, points }}
 */
export function calcIsothermal(T1, P1, P2, eta) {
    const T2 = T1;
    const dsIdeal = -R * Math.log(P2 / P1);
    let ds = dsIdeal;
    let q = T1 * dsIdeal;
    let sgen = 0;

    // Real (irreversible) case: eta < 1. Q stays T1·ΔS_ideal (heat exchanged
    // with the reservoir follows the reversible relation); Sgen is the
    // extra entropy produced internally, added on top of ds.
    if (eta < 1.0) {
        sgen = Math.abs(dsIdeal * (1 - eta));
        ds = dsIdeal + sgen;
        q = dsIdeal * T2;
    }

    const points = [];
    for (let i = 0; i <= 20; i++) {
        const stepS = (ds * i) / 20;
        points.push({ x: stepS, y: T2 });
    }

    return { T2, P2, ds, q, sgen, points };
}

/**
 * Adiabatic process: Q = 0.
 *   Ideal (isentropic): T2 = T1·(P2/P1)^((k-1)/k), ΔS = 0
 *   Real (irreversible): uses isentropic efficiency η
 *     Expansion (turbine):  h2_real = h1 - η·(h1 - h2s)
 *     Compression:          h2_real = h1 + (h2s - h1)/η
 *
 * @param {number} T1  - Initial temperature [K]
 * @param {number} P1  - Initial pressure [kPa]
 * @param {number} P2  - Final pressure [kPa]
 * @param {number} eta - Isentropic efficiency [0.5–1.0] (1 = ideal)
 * @returns {{ T2, P2, ds, q, sgen, points }}
 */
export function calcAdiabatic(T1, P1, P2, eta) {
    const T2s = T1 * Math.pow(P2 / P1, (k - 1) / k);
    let T2 = T2s;
    let ds = 0;
    const q = 0;
    let sgen = 0;

    if (eta < 1.0) {
        const isExpansion = P2 < P1;
        const h1 = Cp * T1;
        const h2s = Cp * T2s;
        let h2r;

        if (isExpansion) {
            h2r = h1 - eta * (h1 - h2s);
        } else {
            h2r = h1 + (h2s - h1) / eta;
        }
        T2 = h2r / Cp;
        ds = Cp * Math.log(T2 / T1) - R * Math.log(P2 / P1);
        // Guard: entropy generation can never be negative (2nd law). The
        // formulas above keep ds >= 0 for eta in [0.5, 1.0] by construction,
        // but this protects against edge cases / future range changes.
        sgen = Math.max(0, ds);
    }

    const points = [];
    for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        if (eta < 1.0) {
            // Actual intermediate path is not analytically known for the
            // irreversible case — a straight line between state 1 (0, T1)
            // and state 2 (ds, T2) is the honest representation and always
            // lands exactly on the computed endpoint.
            points.push({ x: ds * frac, y: T1 + (T2 - T1) * frac });
        } else {
            const stepP = P1 + (P2 - P1) * frac;
            const stepT = T1 * Math.pow(stepP / P1, (k - 1) / k);
            points.push({ x: 0, y: stepT });
        }
    }

    return { T2, P2, ds, q, sgen, points };
}

/**
 * Polytropic process: P·v^n = constant.
 * Equations:
 *   T2 = T1·(P2/P1)^((n-1)/n)
 *   ΔS = Cv·(n-k)/(n-1)·ln(T2/T1)   [if n ≠ 1]
 *   ΔS = -R·ln(P2/P1)                 [if n ≈ 1 → isothermal limit]
 *   Q  = Cv·(T2-T1) + R·(T2-T1)/(1-n)
 *
 * @param {number} T1  - Initial temperature [K]
 * @param {number} P1  - Initial pressure [kPa]
 * @param {number} P2  - Final pressure [kPa]
 * @param {number} n   - Polytropic exponent
 * @param {number} eta - Irreversibility factor [0.5–1.0] (1 = ideal)
 * @returns {{ T2, P2, ds, q, sgen, points }}
 */
export function calcPolytropic(T1, P1, P2, n, eta) {
    const T2 = T1 * Math.pow(P2 / P1, (n - 1) / n);
    const isIsothermalLimit = Math.abs(n - 1) < 0.001;

    let dsIdeal;
    let q;
    if (isIsothermalLimit) {
        // n ≈ 1: falls back to the isothermal relation. Q = T·ΔS avoids the
        // 1/(1-n) division-by-zero that the general polytropic work term hits.
        dsIdeal = -R * Math.log(P2 / P1);
        q = T1 * dsIdeal;
    } else {
        dsIdeal = Cv * ((n - k) / (n - 1)) * Math.log(T2 / T1);
        const w = (R * (T2 - T1)) / (1 - n);
        q = Cv * (T2 - T1) + w;
    }

    let ds = dsIdeal;
    let sgen = 0;
    if (eta < 1.0) {
        sgen = Math.abs(dsIdeal * (1 - eta));
        ds = dsIdeal + sgen;
    }

    const points = [];
    for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        const stepP = P1 + (P2 - P1) * frac;
        const stepT = T1 * Math.pow(stepP / P1, (n - 1) / n);
        let stepS;
        if (isIsothermalLimit) {
            stepS = -R * Math.log(stepP / P1);
        } else {
            stepS = Cv * ((n - k) / (n - 1)) * Math.log(stepT / T1);
        }
        if (eta < 1.0) stepS += sgen * frac;
        points.push({ x: stepS, y: stepT });
    }

    return { T2, P2, ds, q, sgen, points };
}

/**
 * Isobaric process: P = constant (P2 = P1).
 * Equations:
 *   ΔS = Cp·ln(T2/T1)
 *   Q  = Cp·(T2 - T1)
 *   v2 = R·T2 / P1
 *
 * @param {number} T1  - Initial temperature [K]
 * @param {number} P1  - Initial (= final) pressure [kPa]
 * @param {number} T2  - Final temperature [K] — the user-provided target
 * @param {number} eta - Irreversibility factor [0.5–1.0] (1 = ideal)
 * @returns {{ T2, P2, ds, q, sgen, points }}
 */
export function calcIsobaric(T1, P1, T2, eta) {
    const dsIdeal = Cp * Math.log(T2 / T1);
    let ds = dsIdeal;
    const q = Cp * (T2 - T1);
    let sgen = 0;

    if (eta < 1.0) {
        sgen = Math.abs(dsIdeal * (1 - eta));
        ds = dsIdeal + sgen;
    }

    const points = [];
    for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        const stepT = T1 + (T2 - T1) * frac;
        let stepS = Cp * Math.log(stepT / T1);
        if (eta < 1.0) stepS += sgen * frac;
        points.push({ x: stepS, y: stepT });
    }

    return { T2, P2: P1, ds, q, sgen, points };
}

/**
 * Isochoric process: v = constant (v2 = v1).
 * Ideal gas law at fixed v: P2 = P1·(T2/T1).
 * Equations:
 *   ΔS = Cv·ln(T2/T1)
 *   Q  = Cv·(T2 - T1)
 *
 * @param {number} T1  - Initial temperature [K]
 * @param {number} P1  - Initial pressure [kPa]
 * @param {number} T2  - Final temperature [K] — the user-provided target
 * @param {number} eta - Irreversibility factor [0.5–1.0] (1 = ideal)
 * @returns {{ T2, P2, ds, q, sgen, points }}
 */
export function calcIsochoric(T1, P1, T2, eta) {
    const P2 = P1 * (T2 / T1);
    const dsIdeal = Cv * Math.log(T2 / T1);
    let ds = dsIdeal;
    const q = Cv * (T2 - T1);
    let sgen = 0;

    if (eta < 1.0) {
        sgen = Math.abs(dsIdeal * (1 - eta));
        ds = dsIdeal + sgen;
    }

    const points = [];
    for (let i = 0; i <= 20; i++) {
        const frac = i / 20;
        const stepT = T1 + (T2 - T1) * frac;
        let stepS = Cv * Math.log(stepT / T1);
        if (eta < 1.0) stepS += sgen * frac;
        points.push({ x: stepS, y: stepT });
    }

    return { T2, P2, ds, q, sgen, points };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — Unified Entry Point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EntropyCore — single unified calculation dispatcher.
 *
 * @param {Object} params
 * @param {number} params.T1      - Initial temperature [K]
 * @param {number} params.P1      - Initial pressure [kPa]
 * @param {number} [params.P2]    - Final pressure [kPa] (isothermal/adiabatic/polytropic)
 * @param {number} [params.T2]    - Final temperature [K] (isobaric/isochoric)
 * @param {string} params.process - 'isothermal' | 'adiabatic' | 'polytropic' | 'isobaric' | 'isochoric'
 * @param {number} params.n       - Polytropic exponent (only for polytropic)
 * @param {number} params.eta     - Irreversibility factor [0.5–1.0], 1 = ideal
 * @returns {{ v1, T2, P2, ds, q, sgen, points }}
 */
export function EntropyCore(params) {
    const { T1, P1, P2, T2, process, n, eta } = params;

    const { v1 } = calcState1(T1, P1);

    let result;
    switch (process) {
        case 'isothermal':
            result = calcIsothermal(T1, P1, P2, eta);
            break;
        case 'adiabatic':
            result = calcAdiabatic(T1, P1, P2, eta);
            break;
        case 'isobaric':
            result = calcIsobaric(T1, P1, T2, eta);
            break;
        case 'isochoric':
            result = calcIsochoric(T1, P1, T2, eta);
            break;
        case 'polytropic':
            result = calcPolytropic(T1, P1, P2, n, eta);
            break;
        default:
            throw new Error(`Unknown process type: "${process}"`);
    }

    return { v1, ...result };
}
