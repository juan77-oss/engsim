// constants.js — Mass / Weight Converter
// All factors are "1 unit = X kilograms". Kilogram (kg) is the base unit (SI).
// Sources: NIST SP 811 (international avoirdupois pound = 0.45359237 kg exact,
// grain = 64.79891 mg exact) and CODATA 2018 for the atomic mass unit.

export const UNITS = {
  mg:     { label: 'Milligram',        symbol: 'mg',   group: 'SI',        toKilogram: 1e-6,            decimals: 3 },
  g:      { label: 'Gram',             symbol: 'g',    group: 'SI',        toKilogram: 1e-3,            decimals: 4 },
  kg:     { label: 'Kilogram',         symbol: 'kg',   group: 'SI',        toKilogram: 1,               decimals: 6 },
  tonne:  { label: 'Metric Ton',       symbol: 't',    group: 'SI',        toKilogram: 1000,            decimals: 9 },

  grain:  { label: 'Grain',            symbol: 'gr',   group: 'Imperial',  toKilogram: 6.479891e-5,     decimals: 3 },
  oz:     { label: 'Ounce',            symbol: 'oz',   group: 'Imperial',  toKilogram: 0.028349523125,  decimals: 5 },
  lb:     { label: 'Pound',            symbol: 'lb',   group: 'Imperial',  toKilogram: 0.45359237,      decimals: 6 },
  stone:  { label: 'Stone',            symbol: 'st',   group: 'Imperial',  toKilogram: 6.35029318,      decimals: 6 },
  ustonn: { label: 'US Ton (short)',   symbol: 'US ton', group: 'Imperial',toKilogram: 907.18474,       decimals: 9 },
  ukton:  { label: 'UK Ton (long)',    symbol: 'UK ton', group: 'Imperial',toKilogram: 1016.0469088,    decimals: 9 },

  amu:    { label: 'Atomic Mass Unit', symbol: 'u',    group: 'Scientific',toKilogram: 1.66053906660e-27, decimals: 2 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['mg', 'g', 'kg', 'tonne', 'grain', 'oz', 'lb', 'stone', 'ustonn', 'ukton', 'amu'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'kg';
