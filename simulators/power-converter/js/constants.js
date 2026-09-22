/**
 * constants.js — Power Unit Converter
 * Unit definitions, display metadata, and static config.
 */

// Every linear unit: 1 <unit> = toWatt watts.
// Values are standard engineering constants (NIST / SI definitions
// where the unit has an exact legal definition, e.g. mechanical hp).
export const POWER_UNITS = {
  watt: {
    label: 'Watt',
    plural: 'Watts',
    symbol: 'W',
    toWatt: 1,
    group: 'SI',
    decimals: 4,
  },
  milliwatt: {
    label: 'Milliwatt',
    plural: 'Milliwatts',
    symbol: 'mW',
    toWatt: 0.001,
    group: 'SI',
    decimals: 2,
  },
  kilowatt: {
    label: 'Kilowatt',
    plural: 'Kilowatts',
    symbol: 'kW',
    toWatt: 1000,
    group: 'SI',
    decimals: 6,
  },
  megawatt: {
    label: 'Megawatt',
    plural: 'Megawatts',
    symbol: 'MW',
    toWatt: 1_000_000,
    group: 'SI',
    decimals: 9,
  },
  hp_mechanical: {
    label: 'Horsepower (mechanical)',
    plural: 'Horsepower (mechanical)',
    symbol: 'hp',
    toWatt: 745.6998715822702,
    group: 'Imperial / US',
    decimals: 6,
  },
  hp_metric: {
    label: 'Horsepower (metric)',
    plural: 'Horsepower (metric)',
    symbol: 'PS',
    toWatt: 735.49875,
    group: 'Imperial / US',
    decimals: 6,
  },
  hp_electric: {
    label: 'Horsepower (electric)',
    plural: 'Horsepower (electric)',
    symbol: 'hp(E)',
    toWatt: 746,
    group: 'Imperial / US',
    decimals: 6,
  },
  btu_per_hour: {
    label: 'BTU per hour',
    plural: 'BTU per hour',
    symbol: 'BTU/h',
    toWatt: 0.29307107017222,
    group: 'Thermal',
    decimals: 4,
  },
  btu_per_minute: {
    label: 'BTU per minute',
    plural: 'BTU per minute',
    symbol: 'BTU/min',
    toWatt: 17.584264210333,
    group: 'Thermal',
    decimals: 6,
  },
  btu_per_second: {
    label: 'BTU per second',
    plural: 'BTU per second',
    symbol: 'BTU/s',
    toWatt: 1055.05585262,
    group: 'Thermal',
    decimals: 8,
  },
  kcal_per_hour: {
    label: 'Kilocalorie per hour',
    plural: 'Kilocalories per hour',
    symbol: 'kcal/h',
    toWatt: 1.163,
    group: 'Thermal',
    decimals: 4,
  },
  cal_per_second: {
    label: 'Calorie per second',
    plural: 'Calories per second',
    symbol: 'cal/s',
    toWatt: 4.1868,
    group: 'Thermal',
    decimals: 6,
  },
  ft_lb_per_second: {
    label: 'Foot-pound per second',
    plural: 'Foot-pounds per second',
    symbol: 'ft·lb/s',
    toWatt: 1.3558179483314004,
    group: 'Imperial / US',
    decimals: 6,
  },
  ft_lb_per_minute: {
    label: 'Foot-pound per minute',
    plural: 'Foot-pounds per minute',
    symbol: 'ft·lb/min',
    toWatt: 0.022596965805523,
    group: 'Imperial / US',
    decimals: 6,
  },
  erg_per_second: {
    label: 'Erg per second',
    plural: 'Ergs per second',
    symbol: 'erg/s',
    toWatt: 1e-7,
    group: 'CGS',
    decimals: 2,
  },
  ton_refrigeration: {
    label: 'Ton of refrigeration',
    plural: 'Tons of refrigeration',
    symbol: 'TR',
    toWatt: 3516.8528420667,
    group: 'Thermal',
    decimals: 8,
  },
};

// dBm is logarithmic (referenced to 1 mW), handled separately in core.js.
export const DBM_UNIT_ID = 'dbm';
export const DBM_UNIT_META = {
  label: 'Decibel-milliwatt',
  plural: 'Decibel-milliwatts',
  symbol: 'dBm',
  group: 'Telecom (logarithmic)',
  decimals: 4,
};

// Display order for the conversion table (grouped for readability).
export const UNIT_DISPLAY_ORDER = [
  'watt',
  'milliwatt',
  'kilowatt',
  'megawatt',
  'hp_mechanical',
  'hp_metric',
  'hp_electric',
  'ft_lb_per_second',
  'ft_lb_per_minute',
  'btu_per_hour',
  'btu_per_minute',
  'btu_per_second',
  'kcal_per_hour',
  'cal_per_second',
  'ton_refrigeration',
  'erg_per_second',
  'dbm',
];

// Default state when the page loads.
export const DEFAULT_INPUT_VALUE = 1;
export const DEFAULT_INPUT_UNIT = 'kilowatt';

// Quick reference factors for the educational "conversion factors" table
// (most commonly looked-up pairs), shown as static content for SEO/UX
// independent of the live converter above.
export const QUICK_REFERENCE_PAIRS = [
  { from: 'kilowatt', to: 'hp_mechanical', label: '1 kW to hp' },
  { from: 'hp_mechanical', to: 'kilowatt', label: '1 hp to kW' },
  { from: 'watt', to: 'btu_per_hour', label: '1 W to BTU/h' },
  { from: 'btu_per_hour', to: 'watt', label: '1 BTU/h to W' },
  { from: 'kilowatt', to: 'btu_per_hour', label: '1 kW to BTU/h' },
  { from: 'hp_mechanical', to: 'hp_metric', label: '1 hp to PS' },
  { from: 'kilowatt', to: 'ton_refrigeration', label: '1 kW to tons of refrigeration' },
  { from: 'watt', to: 'dbm', label: '1 W to dBm' },
];