// core.js — Energy Converter
// Pure conversion logic, no DOM access. All energy units are linear
// (unlike Power Converter's dBm), so this is a straight factor system
// through the base unit (Joule).

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into joules.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in joules
 */
export function toJoules(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toJoule;
}

/**
 * Convert a value in joules into a given unit.
 * @param {number} joules
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromJoules(joules, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return joules / unit.toJoule;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const joules = toJoules(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromJoules(joules, key);
  }
  return result;
}
