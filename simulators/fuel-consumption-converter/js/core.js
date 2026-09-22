// core.js — Fuel Consumption Converter
// Pure conversion logic, no DOM access. km/L is the bridge unit.
// mpg (US), mpg (UK) and km/L are directly proportional to km/L (simple
// factor, like every other converter in this series). L/100km is
// INVERSELY proportional — it measures volume per distance instead of
// distance per volume — so converting to/from it is a division (100/x),
// not a multiplication by a fixed factor.

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into km/L (the bridge unit).
 * Throws if the value is zero or negative — fuel economy is only
 * meaningful for a positive value (0 or negative implies infinite or
 * undefined consumption, handled as a validation error in the UI layer).
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in km/L
 */
export function toKmPerLiter(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);

  if (unit.kind === 'volume-per-distance') {
    // L/100km -> km/L is a reciprocal relationship: km/L = 100 / (L/100km)
    return 100 / value;
  }
  return value * unit.toKmPerLiter;
}

/**
 * Convert a value in km/L into a given unit.
 * @param {number} kmPerLiter
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromKmPerLiter(kmPerLiter, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);

  if (unit.kind === 'volume-per-distance') {
    // km/L -> L/100km is the same reciprocal relationship, applied in reverse
    return 100 / kmPerLiter;
  }
  return kmPerLiter / unit.toKmPerLiter;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const kmPerLiter = toKmPerLiter(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromKmPerLiter(kmPerLiter, key);
  }
  return result;
}
