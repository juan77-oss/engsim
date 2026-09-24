/**
 * constants.js — Mohr's Circle Calculator
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - UI-only constants: default field values, unit labels, slider ranges
 *   - Anything that is NOT physics (physics enums like CONVENTIONS live in
 *     core.js and are imported directly from there — see simulator.js)
 *
 * WHAT DOES NOT GO HERE:
 *   - Physics formulas or computed values (→ core.js)
 *   - Canvas rendering (→ plot.js)
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/** Example plane-stress state used to pre-fill the inputs on first load. */
export const DEFAULT_SIGMA_X = 80;
export const DEFAULT_SIGMA_Y = -20;
export const DEFAULT_TAU_XY = 30;

/**
 * Stress unit labels offered in the unit selector.
 *
 * IMPORTANT: the physics core is unit-agnostic (see core.js docblock) — it
 * only requires σx, σy, τxy to share the SAME unit. Switching this selector
 * does NOT convert values; it only changes the label shown next to the
 * inputs and results, exactly matching what the user typed. That's why no
 * conversion factors are defined here.
 */
export const STRESS_UNITS = Object.freeze(['MPa', 'ksi', 'psi']);
export const DEFAULT_STRESS_UNIT = 'MPa';

/** Angle slider — physical rotation angle θ, in degrees, shown to the user. */
export const THETA_MIN_DEG = -90;
export const THETA_MAX_DEG = 90;
export const THETA_STEP_DEG = 1;
export const DEFAULT_THETA_DEG = 0;