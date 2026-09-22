// core.js — Area Converter
// Pure conversion logic, no DOM access. All area units are linear
// (same pattern as Energy/Length/Mass/Volume/Data Storage Converter),
// so this is a straight factor system through the base unit (m²).

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into square meters.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in square meters
 */
export function toSqMeters(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toSqMeter;
}

/**
 * Convert a value in square meters into a given unit.
 * @param {number} sqMeters
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromSqMeters(sqMeters, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return sqMeters / unit.toSqMeter;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const sqMeters = toSqMeters(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromSqMeters(sqMeters, key);
  }
  return result;
}
