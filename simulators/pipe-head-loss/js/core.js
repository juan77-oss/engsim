/**
 * core.js — Hydraulic Physics Engine (Darcy-Weisbach)
 * Pipe Head Loss · EngSim
 * ─────────────────────────────────────────────────────────────────
 * Pure calculation module. ZERO DOM access. ZERO side effects.
 * Fuses the legacy core.js + curve-engine.js + optimization.js +
 * numerical.js into a single physics module, per EngSim convention.
 *
 * Exports:
 *   validateInputs()          — input validation layer
 *   deriveProperties()        — unit conversion (pure)
 *   calcSwameeJain()          — explicit friction factor
 *   calcColebrook()           — iterative friction factor + convergence
 *   getFrictionFactor()       — unified f(Re, e_D, method) with blending
 *   calcHeadLoss()            — full hydraulic calculation (rich return)
 *   getInterpretation()       — engineering interpretation text (pure)
 *   generateLossCurve()       — H vs Q dataset
 *   generateOperatingPoint()  — current {Q, H} point
 *   generateOptimizationCurve() — H vs D dataset, zone-classified
 *   findCommercialSolutions() — best commercial diameter (Decision Engine)
 *   getOptimizationStatus()   — pure status data for the Decision Engine panel
 */

import {
    G, RHO_WATER, NU_WATER,
    FLOW_REGIMES,
    COLEBROOK_TOLERANCE, COLEBROOK_MAX_ITER,
    ROUGHNESS_WARN_RATIO,
    VELOCITY_MIN_SAFE, VELOCITY_MAX_SAFE, VELOCITY_HARD_MAX,
    HEAD_LOSS_MAX,
    COMMERCIAL_DIAMETERS,
    OPT_WEIGHT_ENERGY, OPT_WEIGHT_COST, OPT_COST_EXPONENT, OPT_MIN_IMPROVEMENT,
    N_OPTIM_POINTS,
} from './constants.js';

const { LAMINAR_MAX, TURBULENT_MIN, LAMINAR, TRANSITION, TURBULENT } = FLOW_REGIMES;

// Fixed internal parameters — not exposed in the UI (preserved from
// legacy defaults: minor losses unmodeled, water at 20 °C).
const K_MINOR = 0;
const V_SCALE = 1;

// ── Numeric helpers (was numerical.js) ─────────────────────────────
const isFiniteNum = v => typeof v === 'number' && Number.isFinite(v);
const safeDivide  = (a, b, fallback = 0) => (b !== 0 && isFinite(b)) ? a / b : fallback;


// ═══════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validates raw simulator inputs before any calculation.
 * @param {object} inputs — { D, L, Q, eps_mm, method }
 * @returns {{ valid: boolean, errors: string[], warnings: Array }}
 */
export function validateInputs(inputs) {
    const errors   = [];
    const warnings = [];

    if (!isFiniteNum(inputs.D) || inputs.D <= 0)
        errors.push('Diameter (D) must be greater than zero');
    if (!isFiniteNum(inputs.L) || inputs.L <= 0)
        errors.push('Length (L) must be greater than zero');
    if (!isFiniteNum(inputs.Q) || inputs.Q <= 0)
        errors.push('Flow rate (Q) must be greater than zero');
    if (!isFiniteNum(inputs.eps_mm) || inputs.eps_mm < 0)
        errors.push('Roughness (ε) must be greater than or equal to zero');

    if (errors.length === 0 && inputs.D > 0) {
        const area = Math.PI * inputs.D * inputs.D / 4;
        const vEst = safeDivide(inputs.Q, area);
        if (vEst > VELOCITY_HARD_MAX) {
            warnings.push({
                level: 'warning', code: 'VELOCITY_EXCEEDS_LIMIT',
                message: `Estimated velocity (${vEst.toFixed(1)} m/s) exceeds the physical limit of ${VELOCITY_HARD_MAX} m/s`,
            });
        }
        const e_D = safeDivide(inputs.eps_mm * 1e-3, inputs.D);
        if (e_D > ROUGHNESS_WARN_RATIO) {
            warnings.push({
                level: 'warning', code: 'HIGH_ROUGHNESS',
                message: 'High relative roughness (ε/D > 0.05): head loss dominated by wall roughness',
            });
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}


// ═══════════════════════════════════════════════════════════════
//  DERIVED PROPERTIES
// ═══════════════════════════════════════════════════════════════

/**
 * @param {object} inputs — { D, eps_mm }
 * @returns {{ epsilon_m: number, nu: number, area: number }}
 */
export function deriveProperties(inputs) {
    return {
        epsilon_m: (inputs.eps_mm ?? 0) * 1e-3,
        nu:        V_SCALE * NU_WATER,
        area:      Math.PI * inputs.D * inputs.D / 4,
    };
}


// ═══════════════════════════════════════════════════════════════
//  FRICTION FACTOR
// ═══════════════════════════════════════════════════════════════

/** Swamee-Jain explicit equation. Valid for 5e-6 ≤ ε/D ≤ 5e-2, 3000 ≤ Re ≤ 3e8. */
export function calcSwameeJain(Re, e_D) {
    const term1 = e_D / 3.7;
    const term2 = 5.74 / Math.pow(Re, 0.9);
    return 0.25 / Math.pow(Math.log10(term1 + term2), 2);
}

/** Colebrook-White — fixed-point iteration seeded with Swamee-Jain. */
export function calcColebrook(Re, e_D) {
    let f = calcSwameeJain(Re, e_D);
    let iterations = 0;
    let residual   = Infinity;

    for (let i = 0; i < COLEBROOK_MAX_ITER; i++) {
        iterations = i + 1;
        const sqrtF    = Math.sqrt(f);
        const invSqrtF = -2.0 * Math.log10(e_D / 3.7 + 2.51 / (Re * sqrtF));
        const newF     = 1.0 / (invSqrtF * invSqrtF);
        residual = Math.abs(newF - f);
        f = newF;
        if (residual < COLEBROOK_TOLERANCE) break;
    }

    return {
        frictionFactor: f,
        convergence: { converged: residual < COLEBROOK_TOLERANCE, iterations, residual },
    };
}

/**
 * Unified friction factor with laminar/transition/turbulent blending.
 *   Re ≤ 2000        → laminar: f = 64/Re
 *   2000 < Re < 4000 → linear blend
 *   Re ≥ 4000         → turbulent (Swamee or Colebrook)
 */
export function getFrictionFactor(Re, e_D, method) {
    const f_lam = 64 / Math.max(Re, 1e-10);

    let f_turb;
    if (method === 'colebrook' && Re > 2000) {
        f_turb = calcColebrook(Re, e_D).frictionFactor;
    } else {
        f_turb = calcSwameeJain(Re, e_D);
    }

    if (Re <= LAMINAR_MAX) return f_lam;
    if (Re >= TURBULENT_MIN) return f_turb;

    const w = (TURBULENT_MIN - Re) / (TURBULENT_MIN - LAMINAR_MAX);
    return w * f_lam + (1 - w) * f_turb;
}


// ═══════════════════════════════════════════════════════════════
//  MAIN CALCULATION — Darcy-Weisbach
// ═══════════════════════════════════════════════════════════════

/**
 * h_f = (f · L/D + K) · v² / (2g)
 * Reference case: D=0.1 m, L=100 m, Q=0.02 m³/s, ε=0.05 mm, swamee
 *   → v≈2.546 m/s, Re≈254600, f≈0.01855, H≈6.13 m
 *
 * @param {object} derived — { epsilon_m, nu, area }
 * @param {object} inputs  — { D, L, Q, method }
 * @param {number} [Qoverride] — optional flow rate override for curve generation
 */
export function calcHeadLoss(derived, inputs, Qoverride = null) {
    const Q = Qoverride !== null ? Qoverride : inputs.Q;
    const { D, L, method } = inputs;
    const { epsilon_m, nu, area } = derived;

    const warnings   = [];
    let   convergence = null;

    const velocity = safeDivide(Q, area);
    const Reynolds = safeDivide(velocity * D, nu);

    let e_D = 0;
    if (D > 0 && epsilon_m > 0) {
        e_D = epsilon_m / D;
        if (!isFiniteNum(e_D)) {
            return { valid: false, errors: [{ code: 'INVALID_ROUGHNESS', message: 'Invalid relative roughness' }] };
        }
    }

    let frictionFactor;
    let methodUsed;

    if (Reynolds < LAMINAR_MAX) {
        frictionFactor = 64 / Math.max(Reynolds, 1e-10);
        methodUsed     = 'hagen-poiseuille';
    } else {
        if (method === 'colebrook') {
            const cb = calcColebrook(Reynolds, e_D);
            convergence = cb.convergence;
            if (!cb.convergence.converged) {
                warnings.push({
                    level: 'warning', code: 'COLEBROOK_NO_CONVERGENCE',
                    message: `Colebrook did not converge in ${cb.convergence.iterations} iterations`,
                });
            }
        }
        frictionFactor = getFrictionFactor(Reynolds, e_D, method);
        methodUsed = method === 'colebrook'
            ? 'colebrook-white'
            : (Reynolds >= TURBULENT_MIN ? 'swamee-jain' : 'swamee-jain (blended)');
    }

    const velocityHead = safeDivide(velocity * velocity, 2 * G);
    const headLoss      = (frictionFactor * safeDivide(L, D) + K_MINOR) * velocityHead;
    const pressureDrop  = headLoss * RHO_WATER * G;

    let regime;
    if      (Reynolds < LAMINAR_MAX)   regime = LAMINAR;
    else if (Reynolds < TURBULENT_MIN) regime = TRANSITION;
    else                               regime = TURBULENT;

    if (velocity > VELOCITY_MAX_SAFE) {
        warnings.push({ level: 'warning', code: 'HIGH_VELOCITY',
            message: `High velocity (${velocity.toFixed(2)} m/s > ${VELOCITY_MAX_SAFE} m/s): erosion risk` });
    } else if (velocity < VELOCITY_MIN_SAFE && velocity > 0) {
        warnings.push({ level: 'info', code: 'LOW_VELOCITY',
            message: `Low velocity (${velocity.toFixed(2)} m/s < ${VELOCITY_MIN_SAFE} m/s): sedimentation risk` });
    }
    if (Reynolds >= LAMINAR_MAX && Reynolds < TURBULENT_MIN) {
        warnings.push({ level: 'warning', code: 'TRANSITION_ZONE', message: 'Flow in transition zone — results may be unstable' });
    }
    if (method === 'swamee' && Reynolds > TURBULENT_MIN) {
        warnings.push({ level: 'info', code: 'SWAMEE_VALID', message: 'Difference from Colebrook-White is minimal (<2%) — Swamee-Jain is valid' });
    }
    if (e_D > 0.01) {
        warnings.push({ level: 'warning', code: 'HIGH_ROUGHNESS_RATIO', message: 'High relative roughness: head loss dominated by wall roughness' });
    }

    if (!isFiniteNum(velocity) || !isFiniteNum(Reynolds) || !isFiniteNum(frictionFactor) ||
        !isFiniteNum(headLoss) || headLoss > HEAD_LOSS_MAX || headLoss < 0) {
        return { valid: false, errors: [{ code: 'NUMERICAL_INSTABILITY', message: 'Non-finite result — check input parameters' }] };
    }

    return { valid: true, velocity, Reynolds, frictionFactor, headLoss, pressureDrop, regime, methodUsed, warnings, convergence };
}


// ═══════════════════════════════════════════════════════════════
//  INTERPRETATION (pure text generator)
// ═══════════════════════════════════════════════════════════════

export function getInterpretation(results, inputs, derived) {
    if (!results?.valid) return 'System could not be calculated.';

    const { Reynolds, regime } = results;
    const e_D = safeDivide(derived.epsilon_m, inputs.D);
    const messages = [];

    if (regime === LAMINAR) {
        messages.push('Flow is <strong>laminar</strong>; the theoretical relation f = 64/Re applies.');
    } else if (regime === TRANSITION) {
        messages.push('Flow is in the <strong>transition zone</strong>; results may be unstable.');
    } else {
        const name = inputs.method === 'colebrook' ? 'Colebrook-White' : 'Swamee-Jain';
        messages.push(`Flow is <strong>turbulent</strong>; use of ${name} is justified.`);
    }

    if (inputs.method === 'swamee' && Reynolds > TURBULENT_MIN) {
        messages.push('Difference from Colebrook-White is minimal (&lt;2%); Swamee-Jain is valid for this range.');
    }
    if (e_D > 0.01) {
        messages.push('High relative roughness detected: head loss is dominated by wall roughness.');
    }

    return messages.join('<br>');
}


// ═══════════════════════════════════════════════════════════════
//  CURVE GENERATION (was curve-engine.js)
// ═══════════════════════════════════════════════════════════════

let _optimCache = null;

/** H vs Q curve over [0, Q_max]. */
export function generateLossCurve(state) {
    const { inputs, derived } = state;
    const qCurrent  = inputs.Q;
    const qMax      = Math.max(qCurrent * 4, qCurrent + 0.0002, 0.001);
    const pointCount = inputs.Q < 0.001 ? 120 : 60;
    const curve = [];

    for (let i = 0; i <= pointCount; i++) {
        const qi = (i / pointCount) * qMax;
        const r  = calcHeadLoss(derived, inputs, qi);
        if (r.valid) curve.push({ x: qi, y: r.headLoss });
    }
    return curve;
}

/** Current operating point {x: Q, y: H}. */
export function generateOperatingPoint(state) {
    const r = calcHeadLoss(state.derived, state.inputs);
    if (!r.valid) return null;
    return { x: state.inputs.Q, y: r.headLoss };
}

/**
 * H vs D datasets for the Decision Engine chart, classified into
 * velocity zones (valid / low / high). Cached by input signature.
 */
export function generateOptimizationCurve(state) {
    const { inputs, derived } = state;
    const { Q, D, L, method } = inputs;
    const { epsilon_m, nu }   = derived;

    const cacheKey = `${Q}-${L}-${epsilon_m}-${nu}-${D}-${method}`;
    if (_optimCache?.key === cacheKey) return _optimCache.data;

    const datasets = { valid: [], low: [], high: [] };
    const D_min = Math.max(1e-4, 0.5 * D);
    const D_max = 2.5 * D;

    let prevHf = Infinity;

    for (let i = 0; i <= N_OPTIM_POINTS; i++) {
        const Di = D_min + (i / N_OPTIM_POINTS) * (D_max - D_min);
        if (Di < 1e-4) continue;

        const area = Math.PI * Di * Di / 4;
        const v    = Q / area;
        if (v > VELOCITY_HARD_MAX) continue;

        const e_D = epsilon_m / Di;
        const f   = getFrictionFactor(v * Di / nu, e_D, method);
        const hf  = (f * (L / Di) + K_MINOR) * (v * v / (2 * G));

        if (!isFiniteNum(hf) || hf < 0 || hf > HEAD_LOSS_MAX) continue;

        // Hf strictly decreases as Di increases (for fixed Q); skip any
        // non-monotone point caused by friction-factor blend noise near
        // the laminar/transition boundary. (v is already monotonically
        // decreasing by construction, so no separate check is needed.)
        if (i > 0 && hf > prevHf + 1e-7) continue;

        prevHf = hf;

        const point = { x: Di, y: hf, velocity: v };
        if      (v < VELOCITY_MIN_SAFE) datasets.low.push(point);
        else if (v > VELOCITY_MAX_SAFE) datasets.high.push(point);
        else                             datasets.valid.push(point);
    }

    const sortFn = (a, b) => a.x - b.x;
    datasets.valid.sort(sortFn);
    datasets.low.sort(sortFn);
    datasets.high.sort(sortFn);

    _optimCache = { key: cacheKey, data: datasets };
    return datasets;
}


// ═══════════════════════════════════════════════════════════════
//  DECISION ENGINE (was optimization.js)
// ═══════════════════════════════════════════════════════════════

/**
 * Finds the best commercial pipe diameter for the current operating
 * conditions. Score: 65% energy improvement / 35% relative cost.
 */
export function findCommercialSolutions(state, baseResults) {
    const { inputs, derived } = state;
    const { Q, L, method }    = inputs;
    const { epsilon_m, nu }   = derived;
    const D_base  = inputs.D;
    const hf_base = baseResults.headLoss;

    if (!isFiniteNum(D_base) || D_base <= 0)   return null;
    if (!isFiniteNum(hf_base) || hf_base <= 0) return null;

    const solutions = [];

    COMMERCIAL_DIAMETERS.forEach(D => {
        if (Math.abs(D - D_base) / D_base > 1.5) return;

        const area = Math.PI * D * D / 4;
        const v    = safeDivide(Q, area);
        if (v < VELOCITY_MIN_SAFE || v > VELOCITY_MAX_SAFE) return;

        const Re  = safeDivide(v * D, nu);
        const e_D = safeDivide(epsilon_m, D);
        const f   = getFrictionFactor(Re, e_D, method);
        const hf  = (f * safeDivide(L, D) + K_MINOR) * (v * v / (2 * G));

        if (!isFiniteNum(hf) || hf <= 0) return;

        let improvement = safeDivide(hf_base - hf, hf_base);
        improvement = Math.max(0, improvement);
        if (improvement < OPT_MIN_IMPROVEMENT) return;

        const costFactor     = Math.pow(safeDivide(D, D_base), OPT_COST_EXPONENT);
        const normalizedCost = costFactor - 1;
        const combinedScore  = (improvement * OPT_WEIGHT_ENERGY) - (normalizedCost * OPT_WEIGHT_COST);

        solutions.push({ D, hf, v, improvement, costFactor, normalizedCost, score: { combined: combinedScore } });
    });

    if (solutions.length === 0) return null;

    const unique = [...new Map(solutions.map(s => [s.D, s])).values()];
    unique.sort((a, b) => {
        if (Math.abs(b.score.combined - a.score.combined) > 1e-6) return b.score.combined - a.score.combined;
        if (Math.abs(a.D - b.D) > 1e-6) return a.D - b.D;
        return a.v - b.v;
    });

    return unique[0];
}

/**
 * Pure status data for the Decision Engine panel — NO html, NO inline
 * styles. simulator.js renders this via .status-banner + a namespaced
 * "phl-" velocity gauge.
 *
 * @returns {{ level: string, message: string, velocity: number,
 *             minSafe: number, maxSafe: number, gaugeMax: number }}
 */
export function getOptimizationStatus(best, isOptimized, hasValidZone, state) {
    const vCurrent = safeDivide(state.inputs.Q, Math.PI * state.inputs.D * state.inputs.D / 4);

    let level   = 'info';
    let message = 'Analyzing optimization potential…';

    if (!hasValidZone) {
        level   = 'danger';
        message = 'Physically infeasible system in the analyzed range due to velocity constraints.';
    } else if (isOptimized) {
        level   = 'success';
        message = 'The system is already operating under optimal conditions. Excellent sizing.';
    } else if (best) {
        if (vCurrent > VELOCITY_MAX_SAFE) {
            level = 'warning';
            message = 'Erosion risk (v > 3 m/s). Consider increasing to the recommended diameter.';
        } else if (vCurrent < VELOCITY_MIN_SAFE) {
            level = 'warning';
            message = 'Sedimentation risk (v < 0.5 m/s). Consider reducing the diameter.';
        } else {
            level = 'info';
            message = 'There is significant optimization potential by adjusting the diameter.';
        }
    }

    return {
        level, message,
        velocity: vCurrent,
        minSafe:  VELOCITY_MIN_SAFE,
        maxSafe:  VELOCITY_MAX_SAFE,
        gaugeMax: 4.0,
    };
}
