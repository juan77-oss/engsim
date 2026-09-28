/**
 * constants.js — Parallel Transformers Calculator
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - UI-only constants: default field values, unit labels, slider ranges
 *   - Anything that is NOT physics (physics lives in core.js)
 *
 * WHAT DOES NOT GO HERE:
 *   - Physics formulas or computed values (→ core.js)
 *   - Canvas rendering (→ plot.js)
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Default nameplate values — pre-fill the form with TP3.B1 Problem 1
 * (Máquinas Eléctricas 2018), a real, worked example: two single-phase
 * rural transformers, 5 kVA and 2.3 kVA, 7620/231 V.
 */
export const DEFAULT_T1 = Object.freeze({
    Sn: 5,        // kVA
    Ucc: 345.85,  // V, referred to the HV (primary) winding — u_cc% = 4.54%
    Pcc: 133,     // W — u_r% = 2.66%
    Un_hv: 7620,  // V
    Un_lv: 231,   // V
});

export const DEFAULT_T2 = Object.freeze({
    Sn: 2.3,
    Ucc: 285.75,  // V — u_cc% = 3.75%
    Pcc: 62.1,    // W — u_r% = 2.70%
    Un_hv: 7620,
    Un_lv: 231,
});

export const DEFAULT_LOAD = Object.freeze({
    S: 6.5,       // kVA
    cosPhi: 0.8,  // inductive
    U2: 220,      // V
});

/* ── Slider ranges ───────────────────────────────────────────────
   The load slider goes from 0 up to 1.5x the combined nameplate
   power (Sn1+Sn2) so the user can see both machines pass 100% and
   watch the traffic light turn red — that headroom past nominal is
   the point of the exercise.
*/
export const LOAD_SLIDER_MIN = 0;
export const LOAD_SLIDER_MAX_MULTIPLIER = 1.5; // × (Sn1 + Sn2)
export const LOAD_SLIDER_STEP = 0.1; // kVA

export const COSPHI_MIN = 0.5;
export const COSPHI_MAX = 1.0;
export const COSPHI_STEP = 0.01;

/* ── Overload traffic-light thresholds ─────────────────────────── */
export const OVERLOAD_YELLOW_THRESHOLD_PCT = 90;
export const OVERLOAD_RED_THRESHOLD_PCT = 100;
export const OVERLOAD_IMBALANCE_THRESHOLD_PP = 5; // percentage points

/* ── Eligibility tolerances (mirrors core.js, kept here only for
   display purposes — e.g. showing "tolerance: 0.5%" next to the
   ratio-mismatch result) ─────────────────────────────────────── */
export const RATIO_MISMATCH_TOLERANCE_PCT = 0.5;
export const CIRCULATING_CURRENT_TOLERANCE_PCT = 10;

/* ── Units ────────────────────────────────────────────────────── */
export const POWER_UNIT = 'kVA';
export const VOLTAGE_UNIT = 'V';
export const CURRENT_UNIT = 'A';
export const ANGLE_UNIT = '°';
