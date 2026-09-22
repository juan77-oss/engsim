// constants.js — Energy Converter
// All factors are "1 unit = X joules". Joule (J) is the base unit.
// Sources: NIST SP 811 / CODATA 2018 (eV exact per 2019 SI redefinition).

export const UNITS = {
  j:    { label: 'Joule',              symbol: 'J',      group: 'SI',        toJoule: 1,                    decimals: 2 },
  kj:   { label: 'Kilojoule',          symbol: 'kJ',     group: 'SI',        toJoule: 1e3,                  decimals: 4 },
  mj:   { label: 'Megajoule',          symbol: 'MJ',     group: 'SI',        toJoule: 1e6,                  decimals: 6 },
  gj:   { label: 'Gigajoule',          symbol: 'GJ',     group: 'SI',        toJoule: 1e9,                  decimals: 9 },

  wh:   { label: 'Watt-hour',          symbol: 'Wh',     group: 'Electrical',toJoule: 3600,                 decimals: 3 },
  kwh:  { label: 'Kilowatt-hour',      symbol: 'kWh',    group: 'Electrical',toJoule: 3.6e6,                decimals: 6 },
  mwh:  { label: 'Megawatt-hour',      symbol: 'MWh',    group: 'Electrical',toJoule: 3.6e9,                decimals: 9 },

  cal:  { label: 'Calorie (thermochemical)', symbol: 'cal', group: 'Thermal',toJoule: 4.184,                decimals: 3 },
  kcal: { label: 'Kilocalorie (food Calorie)', symbol: 'kcal', group: 'Thermal', toJoule: 4184,             decimals: 6 },
  btu:  { label: 'British Thermal Unit (IT)', symbol: 'BTU', group: 'Thermal', toJoule: 1055.05585262,      decimals: 6 },
  therm:{ label: 'Therm (US)',         symbol: 'therm',  group: 'Thermal',   toJoule: 105480400,            decimals: 9 },

  ftlb: { label: 'Foot-pound',         symbol: 'ft·lb',  group: 'Imperial',  toJoule: 1.3558179483314004,   decimals: 4 },

  ev:   { label: 'Electronvolt',       symbol: 'eV',     group: 'Particle Physics', toJoule: 1.602176634e-19, decimals: 2 },
  erg:  { label: 'Erg',                symbol: 'erg',    group: 'CGS',       toJoule: 1e-7,                 decimals: 2 },
  latm: { label: 'Litre-atmosphere',   symbol: 'L·atm',  group: 'Chemistry', toJoule: 101.325,              decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['j', 'kj', 'mj', 'gj', 'wh', 'kwh', 'mwh', 'cal', 'kcal', 'btu', 'therm', 'ftlb', 'ev', 'erg', 'latm'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'kwh';
