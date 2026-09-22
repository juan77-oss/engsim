// constants.js — Temperature Converter
// Unlike Energy/Length/Mass, temperature scales are NOT pure factors —
// each has its own offset. Celsius is used as the bridge unit in core.js.
// Absolute zero in each unit is listed here for validation.

export const UNITS = {
  c:  { label: 'Celsius',    symbol: '°C', absoluteZero: -273.15, decimals: 4 },
  f:  { label: 'Fahrenheit', symbol: '°F', absoluteZero: -459.67, decimals: 4 },
  k:  { label: 'Kelvin',     symbol: 'K',  absoluteZero: 0,       decimals: 4 },
  r:  { label: 'Rankine',    symbol: '°R', absoluteZero: 0,       decimals: 4 },
  re: { label: 'Réaumur',    symbol: '°Ré', absoluteZero: -218.52, decimals: 4 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['c', 'f', 'k', 'r', 're'];

export const DEFAULT_VALUE = 20;
export const DEFAULT_UNIT = 'c';

// Small tolerance for floating-point comparisons against absolute zero
export const ABSOLUTE_ZERO_EPSILON = 1e-6;
