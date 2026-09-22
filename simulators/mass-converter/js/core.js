// core.js — Mass / Weight Converter
// Pure conversion logic, no DOM access. All mass units are linear
// (same pattern as Length/Energy Converter), so this is a straight
// factor system through the base unit (kilogram).

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into kilograms.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in kilograms
 */
export function toKilograms(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toKilogram;
}

/**
 * Convert a value in kilograms into a given unit.
 * @param {number} kilograms
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromKilograms(kilograms, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return kilograms / unit.toKilogram;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const kilograms = toKilograms(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromKilograms(kilograms, key);
  }
  return result;
}
