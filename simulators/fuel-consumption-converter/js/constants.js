// constants.js — Fuel Consumption Converter
// Unlike every other converter in this series, fuel economy units are
// NOT all directly proportional to each other. mpg (US), mpg (UK) and
// km/L all measure "distance per volume" and scale linearly with each
// other. But L/100km measures "volume per distance" — the reciprocal
// relationship — so converting to/from it requires a division, not a
// multiplication. km/L is used as the bridge unit in core.js.

export const UNITS = {
  mpgus:  { label: 'Miles per US Gallon', symbol: 'mpg (US)', group: 'US Customary', kind: 'distance-per-volume', toKmPerLiter: 0.425143707430272,  decimals: 6 },
  mpguk:  { label: 'Miles per UK Gallon', symbol: 'mpg (UK)', group: 'Imperial',     kind: 'distance-per-volume', toKmPerLiter: 0.3540061899346471, decimals: 6 },
  kml:    { label: 'Kilometers per Liter', symbol: 'km/L',    group: 'SI',           kind: 'distance-per-volume', toKmPerLiter: 1,                   decimals: 6 },
  l100km: { label: 'Liters per 100 Kilometers', symbol: 'L/100km', group: 'SI',      kind: 'volume-per-distance', decimals: 6 },
};

// Display order for the results table / reference table
export const UNIT_ORDER = ['mpgus', 'mpguk', 'kml', 'l100km'];

export const DEFAULT_VALUE = 8;
export const DEFAULT_UNIT = 'l100km';
