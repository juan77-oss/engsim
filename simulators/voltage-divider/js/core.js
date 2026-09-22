/**
 * core.js — Voltage Divider — Physics Engine
 * engsim.app
 *
 * PURE MODULE — no DOM access, no side effects, fully deterministic.
 * Every function here is stateless and can be unit-tested standalone.
 *
 * THEORY NOTES:
 *   Two-resistor divider (R1 on top / input side, R2 on bottom / ground
 *   side, output tap between them):
 *     I    = Vin / (R1 + R2)                  (A)
 *     Vout = Vin × R2 / (R1 + R2)              (V)
 *     P    = I² × R                            (W)   — per resistor
 *
 *   Series chain of N resistors: the same current flows through every
 *   resistor. Vout is measured across the LAST resistor in the chain
 *   (i.e. the tap closest to ground).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { P_MAX_DEFAULT } from './constants.js';

// ═══════════════════════════════════════════════════════════════════
//  TWO-RESISTOR DIVIDER — direct mode
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {number} V  - Input voltage (V)
 * @param {number} R1 - Upper resistor (Ω)
 * @param {number} R2 - Lower resistor, output tap (Ω)
 * @returns {object} results
 */
export function calculateVoltageDivider(V, R1, R2) {
  try {
    if (!isFinite(V) || !isFinite(R1) || !isFinite(R2)) {
      return { valid: false, error: 'Please enter valid numerical values.' };
    }
    if (V < 0) {
      return { valid: false, error: 'Input voltage cannot be negative.' };
    }
    if (R1 < 0 || R2 < 0) {
      return { valid: false, error: 'Resistance values cannot be negative.' };
    }

    const totalR = R1 + R2;
    if (totalR === 0) {
      return { valid: false, error: 'R1 + R2 cannot both be zero.' };
    }

    const current = V / totalR;             // A
    const vout    = V * (R2 / totalR);       // V

    const p_r1 = Math.pow(current, 2) * R1;  // W
    const p_r2 = Math.pow(current, 2) * R2;  // W
    const p_total = p_r1 + p_r2;             // W

    return {
      current,
      vout,
      p_r1,
      p_r2,
      p_total,
      p_r1_ok: p_r1 <= P_MAX_DEFAULT,
      p_r2_ok: p_r2 <= P_MAX_DEFAULT,
      p_max_rating: P_MAX_DEFAULT,
      valid: true,
      error: null
    };
  } catch (err) {
    return { valid: false, error: 'Calculation error.' };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SERIES CHAIN — N resistors, Vout measured across the last one
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {number}   V         - Input voltage (V)
 * @param {number[]} resistors - [R1, R2, ..., Rn] in series (Ω), top to bottom
 * @returns {object} results — current (A), vout (V, across Rn), totalR (Ω),
 *                    breakdown[] (per-resistor voltage drop + power),
 *                    p_total (W), valid, error
 */
export function calculateVoltageDividerN(V, resistors) {
  try {
    if (!Array.isArray(resistors) || resistors.length < 2) {
      return { valid: false, error: 'At least 2 resistors are required.' };
    }
    if (!isFinite(V) || resistors.some(r => !isFinite(r))) {
      return { valid: false, error: 'Please enter valid numerical values.' };
    }
    if (V < 0) {
      return { valid: false, error: 'Input voltage cannot be negative.' };
    }
    if (resistors.some(r => r < 0)) {
      return { valid: false, error: 'Resistance values cannot be negative.' };
    }

    const totalR = resistors.reduce((acc, r) => acc + r, 0);
    if (totalR === 0) {
      return { valid: false, error: 'Total resistance cannot be zero.' };
    }

    const current = V / totalR;                     // A — same through every resistor
    const Rn = resistors[resistors.length - 1];
    const vout = V * (Rn / totalR);                  // V — across the last resistor

    let p_total = 0;
    const breakdown = resistors.map((r, i) => {
      const vDrop = current * r;                     // V across this resistor
      const p = Math.pow(current, 2) * r;             // W dissipated by this resistor
      p_total += p;
      return {
        index: i + 1,
        r,
        vDrop,
        p,
        p_ok: p <= P_MAX_DEFAULT
      };
    });

    return {
      current,
      vout,
      totalR,
      breakdown,
      p_total,
      p_max_rating: P_MAX_DEFAULT,
      valid: true,
      error: null
    };
  } catch (err) {
    return { valid: false, error: 'Calculation error.' };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  CURVE DATA — Vout vs R2 sweep (two-resistor mode chart)
// ═══════════════════════════════════════════════════════════════════

/**
 * Generates { x, y } points for Vout as R2 varies from 0 to R2max,
 * holding V and R1 fixed. Used to plot the divider's characteristic
 * curve alongside the current operating point.
 *
 * Returns EXACTLY `points` samples (the first at R2=0, the last at
 * R2=R2max) — QA audit B-01 flagged an earlier off-by-one where the
 * loop produced points+1 samples, contradicting the JSDoc contract.
 *
 * @param {number} V      - Input voltage (V)
 * @param {number} R1     - Fixed R1 value (Ω)
 * @param {number} R2max  - Maximum R2 for the sweep (Ω)
 * @param {number} points - Number of sample points (default: 60, min: 2)
 * @returns {{ x: number, y: number }[]}
 */
export function sweepVout(V, R1, R2max, points = 60) {
  if (!isFinite(V) || !isFinite(R1) || !isFinite(R2max) || R2max <= 0) return [];
  if (!Number.isInteger(points) || points < 2) return [];

  const result = [];
  const steps = points - 1;
  for (let i = 0; i < points; i++) {
    const r2 = (R2max / steps) * i;
    const totalR = R1 + r2;
    const vout = totalR > 0 ? V * (r2 / totalR) : 0;
    result.push({ x: r2, y: vout });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
//  DESIGN MODE — solve for the missing resistor given a target Vout
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculates the resistor the user is NOT fixing, so that the divider
 * produces Vout_target from Vin. Two-resistor mode only.
 *
 * @param {number} Vin
 * @param {number} Vout_target
 * @param {number} fixedValue     - value of the resistor being held fixed (Ω)
 * @param {string} fixedResistor  - 'r1' or 'r2'
 * @returns {{ valid: boolean, r1?: number, r2?: number, error: string|null }}
 */
export function calculateResistorForVout(Vin, Vout_target, fixedValue, fixedResistor) {
  if (!isFinite(Vin) || !isFinite(Vout_target) || !isFinite(fixedValue) || Vin <= 0 || fixedValue <= 0) {
    return { valid: false, error: 'Please enter valid numerical values.' };
  }
  if (Vout_target <= 0) {
    return { valid: false, error: 'Target Vout must be greater than 0.' };
  }
  if (Vout_target >= Vin) {
    return { valid: false, error: 'Target Vout must be lower than Vin.' };
  }

  let r1, r2;
  if (fixedResistor === 'r1') {
    r1 = fixedValue;
    r2 = r1 * Vout_target / (Vin - Vout_target);
  } else {
    r2 = fixedValue;
    r1 = r2 * (Vin - Vout_target) / Vout_target;
  }

  if (!isFinite(r1) || !isFinite(r2) || r1 <= 0 || r2 <= 0) {
    return { valid: false, error: 'Calculation resulted in an invalid resistance.' };
  }

  return { valid: true, r1, r2, error: null };
}

/**
 * Suggests R1/R2 against a standard 10 kΩ total for a target Vout.
 * Not wired to the UI yet — kept available for a future "suggest
 * values" shortcut when neither resistor is fixed.
 *
 * @param {number} Vin
 * @param {number} Vout_target
 */
export function calculateDividerFromVout(Vin, Vout_target) {
  if (!isFinite(Vin) || !isFinite(Vout_target) || Vin <= 0) {
    return { valid: false, error: 'Please enter valid numerical values.' };
  }
  if (Vout_target <= 0) {
    return { valid: false, error: 'Target Vout must be greater than 0.' };
  }
  if (Vout_target >= Vin) {
    return { valid: false, error: 'Target Vout must be lower than Vin.' };
  }

  const ratio = Vout_target / Vin;
  const totalR = 10000;
  const suggested_r2 = totalR * ratio;
  const suggested_r1 = totalR - suggested_r2;

  if (!isFinite(suggested_r1) || !isFinite(suggested_r2) || suggested_r1 <= 0 || suggested_r2 <= 0) {
    return { valid: false, error: 'Calculation resulted in an invalid resistance.' };
  }

  return { valid: true, ratio, suggested_r1, suggested_r2, error: null };
}
