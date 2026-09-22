// constants.js — Flow Rate Converter
// All factors are "1 unit = X cubic meters per second". m³/s is the base
// unit (SI). Derived from the exact liter (0.001 m³), US gallon
// (3.785411784 L) and cubic foot (0.028316846592 m³) definitions.

export const UNITS = {
  m3s:   { label: 'Cubic Meter per Second', symbol: 'm³/s',  group: 'SI', toM3s: 1,                    decimals: 6 },
  m3h:   { label: 'Cubic Meter per Hour',   symbol: 'm³/h',  group: 'SI', toM3s: 1 / 3600,             decimals: 9 },

  ls:    { label: 'Liter per Second',       symbol: 'L/s',   group: 'SI', toM3s: 0.001,                decimals: 6 },
  lmin:  { label: 'Liter per Minute',       symbol: 'L/min', group: 'SI', toM3s: 0.001 / 60,           decimals: 9 },
  lh:    { label: 'Liter per Hour',         symbol: 'L/h',   group: 'SI', toM3s: 0.001 / 3600,         decimals: 9 },

  usgpm: { label: 'US Gallon per Minute',   symbol: 'GPM',   group: 'US Customary', toM3s: 3.785411784e-3 / 60, decimals: 9 },
  cfm:   { label: 'Cubic Foot per Minute',  symbol: 'CFM',   group: 'Imperial',     toM3s: 0.028316846592 / 60, decimals: 9 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['m3s', 'm3h', 'ls', 'lmin', 'lh', 'usgpm', 'cfm'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'lmin';
