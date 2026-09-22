// core.js — Data Storage Converter
// Pure conversion logic, no DOM access. All storage units are linear
// (same pattern as Energy/Length/Mass/Volume Converter), so this is a
// straight factor system through the base unit (byte). The only twist
// vs. the other converters is that two competing bases exist side by
// side (decimal 1000 vs. binary 1024) — both are just factors to core.js.

import { UNITS } from './constants.js';

/**
 * Convert a value from a given unit into bytes.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in bytes
 */
export function toBytes(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toByte;
}

/**
 * Convert a value in bytes into a given unit.
 * @param {number} bytes
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromBytes(bytes, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return bytes / unit.toByte;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const bytes = toBytes(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromBytes(bytes, key);
  }
  return result;
}
