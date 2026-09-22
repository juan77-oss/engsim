/**
 * core.js — Gas Combustion Calculator
 * engsim.app / simulators/gas-combustion/
 * ──────────────────────────────────────────────────
 * Pure calculation engine. No DOM access here.
 *
 * THEORY NOTES:
 *   Basis: 1 kmol of pure gaseous fuel CxHyOz.
 *   Air composition assumed: 21% O2 / 79% N2 (by volume).
 *   Actual air (Lreal) is back-calculated from the measured DRY
 *   flue gas analysis via a carbon balance (N2 real from the
 *   dry-gas N2 percentage, scaled to a per-kmol-fuel basis using
 *   the carbon atoms found in CO2 + CO).
 *   Products: carbon is split between CO2 and CO in the same ratio
 *   as measured in the dry flue gas analysis (CO2_pct : CO_pct),
 *   so the products table stays consistent with the CO the user
 *   entered. Hydrogen is assumed to fully oxidize to H2O. This is
 *   still a stoichiometric teaching tool, not a full equilibrium
 *   solver — it does not model other incomplete-combustion species
 *   (soot, unburnt hydrocarbons, H2, etc.).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Parses fuel formulas of the form CxHyOz (e.g. CH4, C2H6, C2H4O).
 * @param {string} raw
 * @returns {object|null} { x, y, z, Mm, formulaStr } or null if invalid
 */
export function parseFormula(raw) {
  if (!raw) return null;
  const str = raw.trim().toUpperCase();
  if (!str) return null;

  let x = 0, y = 0, z = 0;
  let pos = 0;
  const len = str.length;

  while (pos < len) {
    const atom = str[pos];

    // Only C, H, O allowed
    if (atom !== 'C' && atom !== 'H' && atom !== 'O') {
      return null;
    }
    pos++;

    const numStart = pos;
    while (pos < len && str[pos] >= '0' && str[pos] <= '9') {
      pos++;
    }
    const count = (pos > numStart) ? parseInt(str.substring(numStart, pos), 10) : 1;
    if (count <= 0) return null;

    if (atom === 'C') {
      if (x > 0) return null;
      x = count;
    } else if (atom === 'H') {
      if (y > 0) return null;
      y = count;
    } else { // O
      if (z > 0) return null;
      z = count;
    }
  }

  // Minimum requirements
  if (x < 1 || y < 1) return null;

  // Theoretical O2 must be non-negative
  const o2teo = x + y / 4 - z / 2;
  if (o2teo < 0) return null;

  const Mm = 12 * x + y + 16 * z;
  const sub = (n) => (n > 1 ? String(n) : '');
  const formulaStr = 'C' + sub(x) + 'H' + sub(y) + (z > 0 ? 'O' + sub(z) : '');

  return { x, y, z, Mm, formulaStr };
}

/**
 * Runs the full combustion calculation.
 * @param {object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.z
 * @param {number} params.Mm
 * @param {number} params.CO2_pct
 * @param {number} params.CO_pct
 * @param {number} params.N2_pct
 * @returns {object|null} Results, or null if the gas analysis has no carbon
 */
export function calculateCombustion(params) {
  const { x, y, z, Mm, CO2_pct, CO_pct, N2_pct } = params;

  // Carbon atoms from gas analysis must be > 0
  const C_in_gas = CO2_pct + CO_pct;
  if (C_in_gas <= 0) return null;

  // Defensive guard: this module has no knowledge of how N2_pct was
  // derived by the caller, so it must not trust a negative value
  // (e.g. CO2+CO+O2 > 100 upstream). A negative N2 is not physical.
  if (N2_pct < 0) return null;

  // Step 1: Stoichiometric O2 (per kmol fuel)
  const O2teo = x + y / 4 - z / 2;

  // Step 2: Theoretical air (per kmol fuel)
  const L0 = O2teo / 0.21;

  // Theoretical air, mass basis (kg air / kg fuel)
  const L0_mass = (L0 * 29) / Mm;

  // Step 3: Actual air via carbon balance
  const n_dry = (x / C_in_gas) * 100;
  const N2_real = N2_pct * n_dry / 100;
  const Lreal = N2_real / 0.79;

  // Step 4: Lambda and excess/deficit
  const lambda = Lreal / L0;
  const excess_pct = (lambda - 1) * 100;

  // Step 5: Products (per kmol fuel)
  // Carbon (x kmol total) is split between CO2 and CO in the same
  // ratio measured in the dry gas analysis, so the products table
  // stays consistent with any CO the user entered (instead of
  // silently assuming all carbon became CO2).
  const CO2_prod = x * (CO2_pct / C_in_gas);
  const CO_prod = x * (CO_pct / C_in_gas);
  const H2O_prod = y / 2;
  const N2_prod = Lreal * 0.79;
  const O2_excess = Math.max(0, Lreal * 0.21 - O2teo);
  const Total_wet = CO2_prod + CO_prod + H2O_prod + N2_prod + O2_excess;

  const pct = (kmol) => (Total_wet > 0 ? (kmol / Total_wet * 100).toFixed(3) : '—');

  return {
    O2teo,
    L0,
    L0_mass,
    lambda,
    excess_pct,
    Lreal,
    CO2_prod,
    CO_prod,
    H2O_prod,
    N2_prod,
    O2_excess,
    Total_wet,
    pct
  };
}