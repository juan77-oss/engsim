/**
 * constants.js — Physical constants & reference data
 * Pipe Head Loss · EngSim
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all numeric constants.
 * No imports. No side effects.
 */

// ── Fluid: Water at 20 °C ──────────────────────────────────────────
export const G         = 9.81;   // m/s²  — gravitational acceleration
export const RHO_WATER = 1000;   // kg/m³ — density
export const NU_WATER  = 1e-6;   // m²/s  — kinematic viscosity at 20 °C

// ── Flow Regime Thresholds ─────────────────────────────────────────
export const FLOW_REGIMES = Object.freeze({
    LAMINAR_MAX:   2300,
    TURBULENT_MIN: 4000,
    LAMINAR:       'laminar',
    TRANSITION:    'transition',
    TURBULENT:     'turbulent',
});

// ── Velocity Safety Limits ─────────────────────────────────────────
export const VELOCITY_MIN_SAFE = 0.5;  // m/s — below: sedimentation risk
export const VELOCITY_MAX_SAFE = 3.0;  // m/s — above: erosion risk
export const VELOCITY_HARD_MAX = 10;   // m/s — physical hard limit

// ── Numerical Limits ───────────────────────────────────────────────
export const HEAD_LOSS_MAX        = 1e5;  // m
export const COLEBROOK_TOLERANCE  = 1e-7;
export const COLEBROOK_MAX_ITER   = 20;
export const ROUGHNESS_WARN_RATIO = 0.05; // e/D above this → warn

// ── Commercial Pipe Diameters — ISO 4065 / DIN (m) ─────────────────
export const COMMERCIAL_DIAMETERS = Object.freeze([
    0.015, 0.02, 0.025, 0.032, 0.04, 0.05,
    0.063, 0.075, 0.09,  0.11,  0.125, 0.16,
    0.2,   0.25,  0.315, 0.4,   0.5,   0.63,
    0.8,   1.0,
]);

// ── Decision Engine — Score Weights ────────────────────────────────
export const OPT_WEIGHT_ENERGY   = 0.65;  // head-loss improvement
export const OPT_WEIGHT_COST     = 0.35;  // relative cost penalty
export const OPT_COST_EXPONENT   = 1.6;   // cost ~ (D/D_base)^1.6
export const OPT_MIN_IMPROVEMENT = 0.005; // 0.5 % — ignore marginal gains

// ── Curve Resolution ────────────────────────────────────────────────
export const N_OPTIM_POINTS = 30; // H vs D curve resolution

// ── Fine-sensitivity base steps (Q, roughness) ─────────────────────
export const BASE_STEPS = Object.freeze({
    Q:      0.0001,
    eps_mm: 0.0001,
});
