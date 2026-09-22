// core.js — Speed Converter
// Pure conversion logic, no DOM access. All speed units are linear
// (same pattern as Energy/Length/Mass/Volume/Area/Data Storage Converter),
// so this is a straight factor system through the base unit (m/s).

import { UNITS, SPEED_OF_LIGHT_MPS } from './constants.js';

/**
 * Convert a value from a given unit into meters per second.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in m/s
 */
export function toMps(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toMps;
}

/**
 * Convert a value in meters per second into a given unit.
 * @param {number} mps
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromMps(mps, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return mps / unit.toMps;
}

/**
 * Check whether a value in a given unit exceeds the speed of light —
 * nothing with mass can reach or exceed c in a vacuum.
 * @param {number} value
 * @param {string} fromKey
 * @returns {boolean}
 */
export function exceedsSpeedOfLight(value, fromKey) {
  return Math.abs(toMps(value, fromKey)) > SPEED_OF_LIGHT_MPS;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const mps = toMps(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromMps(mps, key);
  }
  return result;
}
