/**
 * constants.js — Entropy T-s Diagram Simulator
 * ─────────────────────────────────────────────────────────────────
 * Physical constants (air as ideal gas) and UI input ranges.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// Gas constant for air [kJ/kg·K]
export const GAS_R = 0.287;

// Specific heat ratio (γ) for air — dimensionless
export const GAS_K = 1.4;

// Specific heat at constant volume for air [kJ/kg·K]
export const GAS_CV = 0.718;

// Specific heat at constant pressure for air [kJ/kg·K]
export const GAS_CP = 1.005;

// Process types shown in the select dropdown.
// "target" says which quantity the user provides for state 2:
//   'P2' → final pressure (isothermal/adiabatic/polytropic)
//   'T2' → final temperature (isobaric: P is fixed; isochoric: v is fixed,
//          so pressure alone can't describe the process — temperature drives it)
export const PROCESS_TYPES = [
    { value: 'isothermal', label: 'Isothermal (T = constant)', target: 'P2' },
    { value: 'adiabatic', label: 'Adiabatic (Q = 0)', target: 'P2' },
    { value: 'polytropic', label: 'Polytropic (P·vⁿ = constant)', target: 'P2' },
    { value: 'isobaric', label: 'Isobaric (P = constant)', target: 'T2' },
    { value: 'isochoric', label: 'Isochoric (v = constant)', target: 'T2' }
];

// Slider/input ranges and defaults
export const INPUT_RANGES = {
    T1:  { min: 200, max: 600, step: 1, default: 300 },
    P1:  { min: 50,  max: 500, step: 1, default: 100 },
    P2:  { min: 50,  max: 500, step: 1, default: 200 },
    T2:  { min: 200, max: 600, step: 1, default: 400 },
    n:   { min: 1.0, max: 1.67, step: 0.01, default: 1.3 },
    eta: { min: 0.5, max: 1.0, step: 0.01, default: 0.85 }
};

// Label/unit/range for the dynamic "target" field, keyed by PROCESS_TYPES[].target
export const TARGET_FIELD_CONFIG = {
    P2: { label: 'Final Pressure (P₂)', unit: 'kPa', range: INPUT_RANGES.P2 },
    T2: { label: 'Final Temperature (T₂)', unit: 'K', range: INPUT_RANGES.T2 }
};
