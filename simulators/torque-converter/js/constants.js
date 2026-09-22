// constants.js — Torque Converter
// All factors are "1 unit = X newton-meters". N·m is the base unit (SI).
// Torque and energy share the same base units (N·m = J), but they are
// different physical quantities — torque is a vector (force × lever arm),
// energy is scalar — so this is kept as its own simulator rather than an
// alias of Energy Converter.

export const UNITS = {
  nm:    { label: 'Newton-meter',       symbol: 'N·m',   group: 'SI',       toNm: 1,                     decimals: 4 },
  knm:   { label: 'Kilonewton-meter',   symbol: 'kN·m',  group: 'SI',       toNm: 1000,                  decimals: 6 },

  lbfft: { label: 'Pound-force-foot',   symbol: 'lbf·ft',group: 'Imperial', toNm: 1.3558179483314003,    decimals: 6 },
  lbfin: { label: 'Pound-force-inch',   symbol: 'lbf·in',group: 'Imperial', toNm: 0.11298482902761668,   decimals: 6 },

  kgfm:  { label: 'Kilogram-force-meter', symbol: 'kgf·m', group: 'Technical', toNm: 9.80665,            decimals: 6 },
  dyncm: { label: 'Dyne-centimeter',    symbol: 'dyn·cm',group: 'CGS',      toNm: 1e-7,                  decimals: 3 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['nm', 'knm', 'lbfft', 'lbfin', 'kgfm', 'dyncm'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'nm';
