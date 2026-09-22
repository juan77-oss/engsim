// constants.js — Speed Converter
// All factors are "1 unit = X meters per second". m/s is the base unit (SI).
// Sources: NIST SP 811 for mph/ft-s/knot (all exact, derived from exact
// length/time definitions); speed of light is exact by SI definition.
// Mach 1 is an approximation (speed of sound varies with air temperature,
// pressure and humidity) — 343 m/s is the commonly cited value for dry air
// at 20°C at sea level. See educational content for the caveat.

export const UNITS = {
  ms:    { label: 'Meter per Second',   symbol: 'm/s',  group: 'SI',         toMps: 1,                decimals: 4 },
  kmh:   { label: 'Kilometer per Hour', symbol: 'km/h', group: 'SI',         toMps: 1000 / 3600,      decimals: 4 },

  mph:   { label: 'Mile per Hour',      symbol: 'mph',  group: 'Imperial',   toMps: 0.44704,          decimals: 4 },
  fts:   { label: 'Foot per Second',    symbol: 'ft/s', group: 'Imperial',   toMps: 0.3048,           decimals: 4 },

  knot:  { label: 'Knot',               symbol: 'kn',   group: 'Nautical',   toMps: 1852 / 3600,      decimals: 6 },
  mach:  { label: 'Mach (approx.)',     symbol: 'Ma',   group: 'Aerospace',  toMps: 343,              decimals: 6 },
  c:     { label: 'Speed of Light',     symbol: 'c',    group: 'Physics',    toMps: 299792458,        decimals: 2 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['ms', 'kmh', 'mph', 'fts', 'knot', 'mach', 'c'];

export const DEFAULT_VALUE = 100;
export const DEFAULT_UNIT = 'kmh';

// Physical limit: nothing can travel faster than light in a vacuum.
export const SPEED_OF_LIGHT_MPS = 299792458;
