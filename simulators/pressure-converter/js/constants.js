// constants.js — Pressure Converter
// All factors are "1 unit = X pascals". Pascal (Pa) is the base unit (SI).
// This tool converts ABSOLUTE pressure (see educational content for the
// gauge-vs-absolute distinction). Sources: NIST SP 811.
// - atm = 101325 Pa exact (standard atmosphere, by definition)
// - psi = 6894.757293168361 Pa exact (lbf/in², using standard gravity
//   9.80665 m/s² and the exact pound/inch definitions)
// - mmHg (Torr, conventional) = 133.322387415 Pa exact (13595.1 kg/m³
//   mercury density × standard gravity × 1 mm)
// - inHg = mmHg × 25.4 = 3386.388640341 Pa
// - kgf/cm² = 98066.5 Pa exact (standard gravity / 1 cm²)

export const UNITS = {
  pa:      { label: 'Pascal',              symbol: 'Pa',      group: 'SI',    toPascal: 1,                  decimals: 4 },
  hpa:     { label: 'Hectopascal',         symbol: 'hPa',     group: 'SI',    toPascal: 100,                decimals: 6 },
  kpa:     { label: 'Kilopascal',          symbol: 'kPa',     group: 'SI',    toPascal: 1000,               decimals: 6 },
  mpa:     { label: 'Megapascal',          symbol: 'MPa',     group: 'SI',    toPascal: 1e6,                decimals: 9 },
  bar:     { label: 'Bar',                 symbol: 'bar',     group: 'SI',    toPascal: 1e5,                decimals: 6 },

  atm:     { label: 'Standard Atmosphere', symbol: 'atm',     group: 'Reference', toPascal: 101325,         decimals: 6 },
  psi:     { label: 'Pound per Square Inch', symbol: 'psi',   group: 'Imperial',  toPascal: 6894.757293168361, decimals: 6 },

  mmhg:    { label: 'Millimeter of Mercury', symbol: 'mmHg',  group: 'Reference', toPascal: 133.322387415,  decimals: 6 },
  inhg:    { label: 'Inch of Mercury',     symbol: 'inHg',    group: 'Reference', toPascal: 3386.388640341, decimals: 6 },
  kgfcm2:  { label: 'Kilogram-force per Square Centimeter', symbol: 'kgf/cm²', group: 'Technical', toPascal: 98066.5, decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['pa', 'hpa', 'kpa', 'mpa', 'bar', 'atm', 'psi', 'mmhg', 'inhg', 'kgfcm2'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'bar';
