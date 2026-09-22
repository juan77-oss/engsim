// constants.js — Force Converter
// All factors are "1 unit = X newtons". Newton (N) is the base unit (SI).
// kgf, lbf and pdl are exact by definition using standard gravity
// (9.80665 m/s²) and the exact kg/lb/ft conversions.

export const UNITS = {
  n:    { label: 'Newton',      symbol: 'N',    group: 'SI',       toNewton: 1,                 decimals: 4 },
  kn:   { label: 'Kilonewton',  symbol: 'kN',   group: 'SI',       toNewton: 1000,              decimals: 6 },
  mn:   { label: 'Meganewton',  symbol: 'MN',   group: 'SI',       toNewton: 1e6,               decimals: 9 },
  dyn:  { label: 'Dyne',        symbol: 'dyn',  group: 'CGS',      toNewton: 1e-5,              decimals: 3 },

  kgf:  { label: 'Kilogram-force', symbol: 'kgf', group: 'Technical', toNewton: 9.80665,        decimals: 6 },
  lbf:  { label: 'Pound-force', symbol: 'lbf',  group: 'Imperial', toNewton: 4.4482216152605,   decimals: 6 },
  pdl:  { label: 'Poundal',     symbol: 'pdl',  group: 'Imperial', toNewton: 0.13825495437600002, decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['n', 'kn', 'mn', 'dyn', 'kgf', 'lbf', 'pdl'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'n';
