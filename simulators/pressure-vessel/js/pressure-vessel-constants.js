/**
 * pressure-vessel-constants.js
 * UI constants only: unit systems, default values and slider ranges.
 * NEVER put physics in this file. All numbers below are stored in US units
 * (psi, in, lbf, lbf*in); the UI converts for display.
 */

export const UNIT_SYSTEMS = {
  US: {
    length: { unit: 'in', f: 1 },
    stress: { unit: 'psi', f: 1 },
    force: { unit: 'lbf', f: 1 },
    area: { unit: 'in\u00B2', f: 1 },
    moment: { unit: 'lbf\u00B7in', f: 1 },
    none: { unit: '', f: 1 }
  },
  SI: {
    length: { unit: 'mm', f: 25.4 },
    stress: { unit: 'MPa', f: 0.006894757 },
    force: { unit: 'kN', f: 0.004448222 },
    area: { unit: 'mm\u00B2', f: 645.16 },
    moment: { unit: 'N\u00B7m', f: 0.1129848 },
    none: { unit: '', f: 1 }
  }
};

/** Default input values per input id (US units). */
export const DEFAULTS = {
  // Thin wall
  'th-P': 150,
  'th-Ri': 36,
  'th-S': 20000,
  'th-E': 0.85,
  'th-CA': 0.0625,
  'th-t': 0.5,
  'th-C': 0.33,
  // Thick wall
  'tk-Pi': 15000,
  'tk-Po': 0,
  'tk-Ri': 2,
  'tk-t': 1.6,
  'tk-S': 30000,
  'tk-E': 1,
  'tk-CA': 0,
  // Flange and bolts
  'fl-P': 600,
  'fl-gid': 10.75,
  'fl-gN': 0.75,
  'fl-b0': 0.375,
  'fl-m': 3,
  'fl-y': 10000,
  'fl-Sa': 20000,
  'fl-Sb': 20000,
  'fl-Sfo': 20000,
  'fl-Sfa': 20000,
  'fl-A': 19,
  'fl-B': 10,
  'fl-C': 16,
  'fl-t': 2.5,
  'fl-nb': 12,
  'fl-d': 1,
  'fl-area': 0
};

/** Pressure slider ranges in US units: [min, max, step]. */
export const PRESSURE_SLIDERS = {
  'th-P': [0, 600, 1],
  'tk-Pi': [0, 40000, 50],
  'fl-P': [0, 2500, 5]
};

/** b0 rules for the gasket: fraction of the contact width N. */
export const B0_RULES = {
  half: 0.5,
  threeEighths: 0.375,
  quarter: 0.25
};

/** Torispherical head proportions used in the head comparison (L = D, r = 0.06 D). */
export const TORI_L_OVER_D = 1.0;
export const TORI_R_OVER_D = 0.06;

/** Utilization thresholds for the colour coding. */
export const UTIL_WARN = 0.85;
export const UTIL_FAIL = 1.0;
