// constants.js — Volume Converter
// All factors are "1 unit = X liters". Liter (L) is used as the base unit
// (more practical than m³ as a bridge, since most volume units are closer
// in magnitude to the liter). Sources: NIST SP 811 for US customary units.

export const UNITS = {
  ml:      { label: 'Milliliter',    symbol: 'mL',    group: 'SI',   toLiter: 0.001,               decimals: 3 },
  l:       { label: 'Liter',         symbol: 'L',     group: 'SI',   toLiter: 1,                   decimals: 6 },
  m3:      { label: 'Cubic Meter',   symbol: 'm³',    group: 'SI',   toLiter: 1000,                decimals: 9 },
  cm3:     { label: 'Cubic Centimeter', symbol: 'cm³', group: 'SI',  toLiter: 0.001,               decimals: 3 },

  in3:     { label: 'Cubic Inch',    symbol: 'in³',   group: 'Imperial', toLiter: 0.016387064,      decimals: 6 },
  ft3:     { label: 'Cubic Foot',    symbol: 'ft³',   group: 'Imperial', toLiter: 28.316846592,     decimals: 9 },

  usgal:   { label: 'US Gallon',     symbol: 'gal (US)', group: 'US Customary', toLiter: 3.785411784,     decimals: 6 },
  ukgal:   { label: 'UK Gallon',     symbol: 'gal (UK)', group: 'Imperial',     toLiter: 4.54609,         decimals: 6 },
  usqt:    { label: 'US Quart',      symbol: 'qt (US)',  group: 'US Customary', toLiter: 0.946352946,     decimals: 6 },
  uspt:    { label: 'US Pint',       symbol: 'pt (US)',  group: 'US Customary', toLiter: 0.473176473,     decimals: 6 },
  uscup:   { label: 'US Cup',        symbol: 'cup (US)', group: 'US Customary', toLiter: 0.2365882365,    decimals: 6 },
  usfloz:  { label: 'US Fluid Ounce',symbol: 'fl oz (US)', group: 'US Customary', toLiter: 0.0295735295625, decimals: 6 },
  ustbsp:  { label: 'US Tablespoon', symbol: 'tbsp (US)', group: 'US Customary', toLiter: 0.01478676478125, decimals: 6 },
  ustsp:   { label: 'US Teaspoon',   symbol: 'tsp (US)',  group: 'US Customary', toLiter: 0.00492892159375, decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['ml', 'l', 'm3', 'cm3', 'in3', 'ft3', 'usgal', 'ukgal', 'usqt', 'uspt', 'uscup', 'usfloz', 'ustbsp', 'ustsp'];

export const DEFAULT_VALUE = 1;
export const DEFAULT_UNIT = 'l';
