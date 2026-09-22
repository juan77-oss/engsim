// constants.js — Area Converter
// All factors are "1 unit = X square meters". Square meter (m²) is the
// base unit (SI). Imperial units are derived by squaring the exact
// international length definitions (in=0.0254m, ft=0.3048m, etc.).

export const UNITS = {
  mm2:    { label: 'Square Millimeter', symbol: 'mm²',  group: 'SI',       toSqMeter: 1e-6,             decimals: 3 },
  cm2:    { label: 'Square Centimeter', symbol: 'cm²',  group: 'SI',       toSqMeter: 1e-4,             decimals: 4 },
  m2:     { label: 'Square Meter',      symbol: 'm²',   group: 'SI',       toSqMeter: 1,                decimals: 6 },
  km2:    { label: 'Square Kilometer',  symbol: 'km²',  group: 'SI',       toSqMeter: 1e6,              decimals: 9 },

  in2:    { label: 'Square Inch',       symbol: 'in²',  group: 'Imperial', toSqMeter: 0.00064516,       decimals: 6 },
  ft2:    { label: 'Square Foot',       symbol: 'ft²',  group: 'Imperial', toSqMeter: 0.09290304,       decimals: 6 },
  yd2:    { label: 'Square Yard',       symbol: 'yd²',  group: 'Imperial', toSqMeter: 0.83612736,       decimals: 6 },
  mi2:    { label: 'Square Mile',       symbol: 'mi²',  group: 'Imperial', toSqMeter: 2589988.110336,   decimals: 9 },

  acre:   { label: 'Acre',              symbol: 'ac',   group: 'Land',     toSqMeter: 4046.8564224,     decimals: 6 },
  hectare:{ label: 'Hectare',           symbol: 'ha',   group: 'Land',     toSqMeter: 10000,            decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['mm2', 'cm2', 'm2', 'km2', 'in2', 'ft2', 'yd2', 'mi2', 'acre', 'hectare'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'm2';
