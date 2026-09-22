// core.js — Volume Converter
// Pure conversion logic, no DOM access. All volume units are linear
// (same pattern as Energy/Length/Mass Converter), so this is a straight
// factor system through the base unit (liter).

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into liters.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in liters
 */
export function toLiters(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toLiter;
}

/**
 * Convert a value in liters into a given unit.
 * @param {number} liters
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromLiters(liters, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return liters / unit.toLiter;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const liters = toLiters(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromLiters(liters, key);
  }
  return result;
}
