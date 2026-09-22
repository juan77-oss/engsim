// constants.js — Length Converter
// All factors are "1 unit = X meters". Meter (m) is the base unit (SI).
// Sources: NIST SP 811 / international yard-and-pound agreement (1959) for
// the exact in/ft/yd/mi definitions; IAU for the light-year.

export const UNITS = {
  nm:   { label: 'Nanometer',      symbol: 'nm',  group: 'SI',       toMeter: 1e-9,               decimals: 2 },
  um:   { label: 'Micrometer',     symbol: 'μm',  group: 'SI',       toMeter: 1e-6,               decimals: 2 },
  mm:   { label: 'Millimeter',     symbol: 'mm',  group: 'SI',       toMeter: 0.001,              decimals: 3 },
  cm:   { label: 'Centimeter',     symbol: 'cm',  group: 'SI',       toMeter: 0.01,               decimals: 4 },
  m:    { label: 'Meter',          symbol: 'm',   group: 'SI',       toMeter: 1,                  decimals: 6 },
  km:   { label: 'Kilometer',      symbol: 'km',  group: 'SI',       toMeter: 1000,               decimals: 9 },

  mil:  { label: 'Mil (thou)',     symbol: 'mil', group: 'Imperial', toMeter: 2.54e-5,            decimals: 2 },
  in:   { label: 'Inch',           symbol: 'in',  group: 'Imperial', toMeter: 0.0254,             decimals: 4 },
  ft:   { label: 'Foot',           symbol: 'ft',  group: 'Imperial', toMeter: 0.3048,             decimals: 4 },
  yd:   { label: 'Yard',           symbol: 'yd',  group: 'Imperial', toMeter: 0.9144,             decimals: 4 },
  mi:   { label: 'Mile',           symbol: 'mi',  group: 'Imperial', toMeter: 1609.344,           decimals: 6 },

  nmi:  { label: 'Nautical Mile',  symbol: 'nmi', group: 'Nautical', toMeter: 1852,               decimals: 6 },

  ly:   { label: 'Light-year',     symbol: 'ly',  group: 'Astronomical', toMeter: 9.4607304725808e15, decimals: 2 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['nm', 'um', 'mm', 'cm', 'm', 'km', 'mil', 'in', 'ft', 'yd', 'mi', 'nmi', 'ly'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'm';
