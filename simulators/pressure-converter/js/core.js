// core.js — Pressure Converter
// Pure conversion logic, no DOM access. All pressure units here are linear
// (same pattern as Energy/Length/Mass/Volume/Area/Speed Converter), so
// this is a straight factor system through the base unit (pascal).
// This converts ABSOLUTE pressure — see educational content for the
// gauge-vs-absolute distinction.

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into pascals.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in pascals
 */
export function toPascals(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toPascal;
}

/**
 * Convert a value in pascals into a given unit.
 * @param {number} pascals
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromPascals(pascals, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return pascals / unit.toPascal;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const pascals = toPascals(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromPascals(pascals, key);
  }
  return result;
}
