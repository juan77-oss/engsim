// core.js — Length Converter
// Pure conversion logic, no DOM access. All length units are linear
// (same as Energy Converter), so this is a straight factor system
// through the base unit (meter).

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into meters.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in meters
 */
export function toMeters(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toMeter;
}

/**
 * Convert a value in meters into a given unit.
 * @param {number} meters
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromMeters(meters, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return meters / unit.toMeter;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const meters = toMeters(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromMeters(meters, key);
  }
  return result;
}
