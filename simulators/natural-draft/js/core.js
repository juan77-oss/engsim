/**
 * core.js — Natural Draft Calculator
 * engsim.app
 *
 * Pure engineering calculations for chimney natural draft analysis.
 * No DOM access, no UI logic — inputs in, numbers out.
 *
 * THEORY NOTES:
 *   Natural draft (thermal buoyancy):
 *     Δ = H · γ₀ · α · (tg − ta) / [(1 + α·ta)·(1 + α·tg)]
 *
 *   Kinetic head (energy needed to accelerate the gas to velocity w):
 *     h = ρ · w² / (2g)
 *
 *   Resistive losses (friction + local losses, coefficient J):
 *     Rh = J · ρ · w² / (2g)
 *
 *   All pressures are expressed in mmH2O, which is numerically
 *   equivalent to kg/m² — the standard convention in draft calculations.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import {
    ATMOSPHERIC_PRESSURE,
    MMH2O_TO_PA,
    KELVIN_OFFSET,
    MARGIN_THRESHOLDS
} from './constants.js';

/* ───────────────────────── Geometry ────────────────────────── */

/**
 * Cross-sectional area of a circular duct.
 * @param {number} d - Internal diameter [m]
 * @returns {number} Area [m²]
 */
export function calculateCircularArea(d) {
    if (!Number.isFinite(d) || d <= 0) return 0;
    return (Math.PI * Math.pow(d, 2)) / 4;
}

/**
 * Wetted perimeter of a circular duct.
 * @param {number} d - Internal diameter [m]
 * @returns {number} Perimeter [m]
 */
export function calculateCircularPerimeter(d) {
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Math.PI * d;
}

/**
 * Cross-sectional area of a rectangular duct.
 * @param {number} a - Width [m]
 * @param {number} b - Height [m]
 * @returns {number} Area [m²]
 */
export function calculateRectangularArea(a, b) {
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(b) || b <= 0) return 0;
    return a * b;
}

/**
 * Wetted perimeter of a rectangular duct.
 * @param {number} a - Width [m]
 * @param {number} b - Height [m]
 * @returns {number} Perimeter [m]
 */
export function calculateRectangularWettedPerimeter(a, b) {
    if (!Number.isFinite(a) || a < 0 || !Number.isFinite(b) || b < 0) return 0;
    return 2 * (a + b);
}

/**
 * Generalized hydraulic diameter, Dh = 4·A / P.
 * @param {number} area - Cross-sectional area [m²]
 * @param {number} wettedPerimeter - Wetted perimeter [m]
 * @returns {number} Hydraulic diameter [m]
 */
export function calculateHydraulicDiameter(area, wettedPerimeter) {
    if (!Number.isFinite(area) || !Number.isFinite(wettedPerimeter) || wettedPerimeter <= 0) {
        return 0;
    }
    return (4 * area) / wettedPerimeter;
}

/* ─────────────────────── Gas properties ───────────────────── */

/**
 * Absolute pressure of the gas from a manometric (gauge) reading.
 * @param {number} pm - Manometric pressure [mmH2O]
 * @returns {number} Absolute pressure [Pa]
 */
export function calculateAbsolutePressure(pm) {
    if (!Number.isFinite(pm)) return ATMOSPHERIC_PRESSURE;
    return ATMOSPHERIC_PRESSURE + pm * MMH2O_TO_PA;
}

/**
 * Real gas density using a simplified ideal-gas correction:
 *   ρ = ρ₀ · (P_abs / P_atm) · (T0 / T_abs)
 *
 * @param {Object} params
 * @param {number} params.absolutePressure - Absolute pressure [Pa]
 * @param {number} params.temperatureC - Gas temperature [°C]
 * @param {number} params.baseDensity - Density at 0°C and atmospheric pressure [kg/m³]
 * @returns {number} Actual gas density [kg/m³]
 */
export function calculateGasDensity({ absolutePressure, temperatureC, baseDensity }) {
    if (!Number.isFinite(absolutePressure) || !Number.isFinite(temperatureC)) return baseDensity;

    const temperatureK = temperatureC + KELVIN_OFFSET;
    if (temperatureK <= 0) return baseDensity;

    const pressureFactor = absolutePressure / ATMOSPHERIC_PRESSURE;
    const temperatureFactor = KELVIN_OFFSET / temperatureK;

    const density = baseDensity * pressureFactor * temperatureFactor;

    return Number.isFinite(density) ? Math.max(0, density) : baseDensity;
}

/* ─────────────────────── Fluid mechanics ──────────────────── */

/**
 * Gas velocity from a dynamic pressure reading.
 * w = sqrt(2 · Pdin[Pa] / ρ)
 *
 * @param {number} dynamicPressureMmH2O - Dynamic pressure [mmH2O]
 * @param {number} density - Gas density [kg/m³]
 * @returns {number} Velocity [m/s]
 */
export function calculateVelocityFromDynamicPressure(dynamicPressureMmH2O, density) {
    if (
        !Number.isFinite(dynamicPressureMmH2O) ||
        !Number.isFinite(density) ||
        density <= 0 ||
        dynamicPressureMmH2O <= 0
    ) {
        return 0;
    }

    const dynamicPressurePa = dynamicPressureMmH2O * MMH2O_TO_PA;
    const velocity = Math.sqrt((2 * dynamicPressurePa) / density);

    return Number.isFinite(velocity) ? velocity : 0;
}

/**
 * Volumetric flow rate. Q = A · w
 * @param {number} area - Duct cross-sectional area [m²]
 * @param {number} velocity - Gas velocity [m/s]
 * @returns {number} Flow rate [m³/s]
 */
export function calculateFlowRate(area, velocity) {
    if (!Number.isFinite(area) || !Number.isFinite(velocity) || area < 0 || velocity < 0) {
        return 0;
    }
    return area * velocity;
}

/* ───────────────────────── Energy ─────────────────────────── */

/**
 * Kinetic head: the useful energy needed to bring the gas to velocity w.
 * h = ρ · w² / (2g)
 *
 * @param {number} w - Gas velocity [m/s]
 * @param {number} density - Real gas density [kg/m³]
 * @param {number} g - Gravity [m/s²]
 * @returns {number} Kinetic head [mmH2O]
 */
export function calculateKineticHead(w, density, g) {
    if (!Number.isFinite(w) || !Number.isFinite(density)) {
        console.warn('[core] Invalid parameters in calculateKineticHead. Returning 0.');
        return 0;
    }

    w = Math.max(0, w);
    if (w === 0) return 0;

    const h = (density * Math.pow(w, 2)) / (2 * g);
    return Number.isFinite(h) ? h : 0;
}

/**
 * Resistive losses: energy dissipated by friction and fittings.
 * Rh = J · ρ · w² / (2g)
 *
 * @param {number} w - Gas velocity [m/s]
 * @param {number} density - Real gas density [kg/m³]
 * @param {number} J - Dimensionless loss coefficient
 * @param {number} g - Gravity [m/s²]
 * @returns {number} Resistive losses [mmH2O]
 */
export function calculateResistiveLosses(w, density, J, g) {
    if (!Number.isFinite(w) || !Number.isFinite(density) || !Number.isFinite(J)) {
        console.warn('[core] Invalid parameters in calculateResistiveLosses. Returning 0.');
        return 0;
    }

    w = Math.max(0, w);
    J = Math.max(0, J);
    if (w === 0 || J === 0) return 0;

    const dynamicPressure = (density * Math.pow(w, 2)) / (2 * g);
    const rh = J * dynamicPressure;

    return Number.isFinite(rh) ? rh : 0;
}

/* ─────────────────────── Natural draft ────────────────────── */

/**
 * Natural (thermal) draft available from the chimney.
 * Δ = H · γ₀ · α · (tg − ta) / [(1 + α·ta)·(1 + α·tg)]
 *
 * @param {number} H - Chimney height [m]
 * @param {number} tg - Flue gas temperature [°C]
 * @param {number} ta - Ambient temperature [°C]
 * @param {number} baseDensity - Gas density at 0°C [kg/m³]
 * @param {number} alpha - Gas expansion coefficient [1/K]
 * @returns {number} Available natural draft [mmH2O]
 */
export function calculateNaturalDraft(H, tg, ta, baseDensity, alpha) {
    if (!Number.isFinite(H) || !Number.isFinite(tg) || !Number.isFinite(ta)) {
        console.warn('[core] Invalid parameters in calculateNaturalDraft. Returning 0.');
        return 0;
    }

    if (H <= 0) return 0;

    const numerator = H * baseDensity * alpha * (tg - ta);
    const denominator = (1 + alpha * ta) * (1 + alpha * tg);

    const draft = numerator / denominator;

    if (!Number.isFinite(draft)) return 0;

    // A negative result (tg <= ta) is physically a lack of draft, not a
    // negative pressure in this context — clamp at zero.
    return Math.max(0, draft);
}

/* ─────────────────────── Draft balance ────────────────────── */

/**
 * Evaluates the draft balance to determine the operating status.
 *
 * @param {number} availableDraft - Available natural draft [mmH2O]
 * @param {number} totalRequirement - Kinetic head + resistive losses [mmH2O]
 * @returns {{margin: number, status: string, message: string, severity: string, isSufficient: boolean}}
 */
export function evaluateDraftBalance(availableDraft, totalRequirement) {
    let status = 'Stable operation';
    let message = 'The system operates with a safe energy margin.';
    let severity = 'success';

    if (!Number.isFinite(availableDraft) || !Number.isFinite(totalRequirement)) {
        console.warn('[core] Non-finite values in evaluateDraftBalance.');
        return {
            margin: 0,
            status: 'Analysis unavailable',
            message: 'Valid physical parameters are missing.',
            severity: 'info',
            isSufficient: false
        };
    }

    const margin = availableDraft - totalRequirement;

    const safeMargin = totalRequirement * MARGIN_THRESHOLDS.SAFE;
    const criticalMargin = totalRequirement * MARGIN_THRESHOLDS.CRITICAL;

    if (margin < 0) {
        status = 'Insufficient draft';
        message = 'The natural draft cannot meet the total requirement.';
        severity = 'danger';
    } else if (margin < criticalMargin) {
        status = 'Risk of instability';
        message = 'Very low margin. Potential instability due to thermal variations.';
        severity = 'danger';
    } else if (margin < safeMargin) {
        status = 'Tight draft';
        message = 'Moderate margin. The system operates but with little reserve.';
        severity = 'warning';
    }

    return {
        margin: Number(margin.toFixed(3)),
        status,
        message,
        severity,
        isSufficient: margin >= 0
    };
}

/* ─────────────────── Physical interpretation ──────────────── */

/**
 * Generates an engineering diagnosis of the system's behavior.
 *
 * @param {Object} state - { tg, ta, w, sectionType, width, height, pm }
 * @param {number} margin - Free pressure margin [mmH2O]
 * @param {number} availableDraft - Available natural draft [mmH2O]
 * @param {number} totalRequirement - Kinetic head + resistive losses [mmH2O]
 * @param {Object} fluid - { velocity, flowRate, flowMode }
 * @returns {{title: string, message: string, severity: string}}
 */
export function generatePhysicalInterpretation(state, margin, availableDraft, totalRequirement, fluid) {
    // 0. Structural fallback
    if (!state || !Number.isFinite(margin) || !Number.isFinite(availableDraft)) {
        return {
            title: 'Physical Analysis',
            message: 'Waiting for valid values to process the interpretation.',
            severity: 'info'
        };
    }

    // 1. Absolute priority: no motive force
    if (state.tg <= state.ta) {
        return {
            title: 'Lack of Motive Force',
            message: 'There is insufficient thermal motive force to generate natural draft. Flue gas temperature must be higher than ambient.',
            severity: 'danger'
        };
    }

    // 2. Furnace pressure analysis (stability)
    if (state.pm < -2) {
        return {
            title: 'Furnace under Suction',
            message: 'Negative furnace pressure promotes combustion stability and reduces the risk of hot gas leakage to the exterior.',
            severity: 'success'
        };
    }

    // 3. Velocity analysis (quadratic impact)
    const velocityRef = fluid ? fluid.velocity : state.w;
    if (velocityRef > 12) {
        return {
            title: 'High Kinetic Requirement',
            message: 'Excessive velocity requires too much energy to move the gases, which can saturate the available natural draft.',
            severity: 'warning'
        };
    }

    // 4. Geometric analysis (flattened ducts)
    if (state.sectionType === 'rectangular' && state.width > 0 && state.height > 0) {
        const aspectRatio = Math.max(state.width, state.height) / Math.min(state.width, state.height);
        if (aspectRatio > 4) {
            return {
                title: 'Inefficient Geometry',
                message: 'Highly flattened geometries can increase actual flow losses compared to more compact ducts.',
                severity: 'warning'
            };
        }
    }

    // 5. Flow analysis (dynamic pressure mode)
    if (fluid && fluid.flowMode === 'dynamic-pressure' && fluid.velocity < 2) {
        return {
            title: 'Slow Flow',
            message: 'Low dynamic pressures for this section indicate slow flow, which reduces losses but may favor particle sedimentation.',
            severity: 'info'
        };
    }

    // 6. Margin and reserve analysis
    if (margin < 0) {
        return {
            title: 'Energy Deficit',
            message: 'Available energy does not overcome friction and acceleration. Flow will collapse unless artificial draft is provided.',
            severity: 'danger'
        };
    }

    if (totalRequirement > 0 && margin < totalRequirement * MARGIN_THRESHOLDS.CRITICAL) {
        return {
            title: 'Critical Margin',
            message: 'The system operates with low energy reserve and may become highly sensitive to thermal variations.',
            severity: 'warning'
        };
    }

    if (totalRequirement > 0 && margin < totalRequirement * MARGIN_THRESHOLDS.SAFE) {
        return {
            title: 'Tight Operation',
            message: 'The system operates stably, but has little reserve against potential increases in roughness or heat loss.',
            severity: 'info'
        };
    }

    // 7. Stable state
    if (availableDraft > 0 && margin >= totalRequirement * MARGIN_THRESHOLDS.SAFE) {
        return {
            title: 'Stable Operation',
            message: 'There is ample energy reserve to sustain the flue gas flow robustly and continuously.',
            severity: 'success'
        };
    }

    // Generic fallback
    return {
        title: 'Physical Analysis',
        message: 'The system is in a nominal steady state.',
        severity: 'info'
    };
}