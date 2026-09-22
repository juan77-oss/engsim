/**
 * constants.js — Beam Simulator Configuration
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all limits, modes, labels and magic numbers.
 * Import from any module — zero side effects.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';


/** @enum {string} */
export const LOAD_TYPES = Object.freeze({
    POINT: 'point',
    DISTRIBUTED: 'distributed'
});


// ── Physical Limits ───────────────────────────────────────────────────────────

/**
 * Hard physical boundaries applied before sending inputs to core.js.
 * All values in SI engineering units (m, kN, GPa, cm⁴).
 */
export const BEAM_LIMITS = Object.freeze({
    // Beam geometry
    L_min: 0.1,       // m — minimum beam length
    L_max: 100,       // m — maximum beam length

    // Point load
    P_min: 0,         // kN
    P_max: 100_000,   // kN

    // Point load position
    a_min: 0,         // m
    a_max: undefined, // clamped dynamically to L

    // Distributed load magnitude
    w_min: 0,         // kN/m
    w_max: 100_000,   // kN/m

    // Distributed load span
    span_min: 1e-3,    // m — minimum span to avoid degenerate case

    // Material properties
    E_min: 1,         // GPa
    E_max: 500,       // GPa — tungsten carbide is ~700, practical steel max
    I_min: 1,         // cm⁴
    I_max: 1_000_000  // cm⁴
});


// ── Numerical Settings ────────────────────────────────────────────────────────

/**
 * Resolution and precision parameters for numerical integration.
 */
export const NUMERICS = Object.freeze({
    N_POINTS: 300,   // Base grid density for beam diagram sampling
    DEFLECTION_SCALE: 1000  // Converts m → mm for display
});


// ── Chart Colors (via CSS custom properties) ──────────────────────────────────

/**
 * CSS variable names used by charts and SVG.
 * getCssVar() resolves these at render time for dark mode compatibility.
 */
export const CHART_COLORS = Object.freeze({
    shear: '--color-success',
    moment: '--color-primary',
    deflection: '--color-warning',
    axis: '--color-text-muted'
});

/** Palette for multi-load card coloring. */
export const LOAD_PALETTE = Object.freeze(['primary', 'success', 'warning', 'error']);


// ── Default State ─────────────────────────────────────────────────────────────

/**
 * Initial simulator state — must match what the HTML inputs default to.
 */
export const DEFAULT_STATE = Object.freeze({
    L: 10,       // m
    E: 200,      // GPa
    I: 10_000,   // cm⁴
    loads: []        // Load list
});


// ── UI Labels ─────────────────────────────────────────────────────────────────

export const LABELS = Object.freeze({
    Ra: 'Support Reaction RA',
    Rb: 'Support Reaction RB',
    shear: 'Shear Force (Q)',
    moment: 'Bending Moment (M)',
    deflection: 'Deflection Curve (y)',
    unit_kN: 'kN',
    unit_kNm: 'kNm',
    unit_mm: 'mm',
    unit_m: 'm'
});