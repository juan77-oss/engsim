/**
 * constants.js — Simulator Configuration
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for all limits, modes, labels and magic numbers.
 * Import from any module — zero side effects.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Hard physical boundaries applied before sending inputs to core.js.
 */
export const LIMITS = Object.freeze({
    value_min: 0,
    value_max: 100
});

/**
 * CSS variable names used by charts and SVG.
 */
export const CHART_COLORS = Object.freeze({
    primary: '--brand-accent',
    success: '--color-success',
    warning: '--color-warning',
    danger:  '--color-danger'
});

/**
 * Initial simulator state — must match what the HTML inputs default to.
 */
export const DEFAULT_STATE = Object.freeze({
    value: 10
});

/**
 * UI Labels
 */
export const LABELS = Object.freeze({
    result: 'Result Value',
    unit: 'U'
});
