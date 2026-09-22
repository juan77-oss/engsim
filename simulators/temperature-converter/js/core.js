// core.js — Temperature Converter
// Pure conversion logic, no DOM access. Every temperature scale converts
// through Celsius, but — unlike Energy/Length/Mass — each formula has its
// own offset, so there is no single "factor" system here.

import { UNITS, ABSOLUTE_ZERO_EPSILON } from './constants.js';

/**
 * Convert a value from a given unit into Celsius.
 * @param {number} value
 * @param {string} fromKey - key of UNITS
 * @returns {number} value in Celsius
 */
export function toCelsius(value, fromKey) {
  switch (fromKey) {
    case 'c':  return value;
    case 'f':  return (value - 32) * 5 / 9;
    case 'k':  return value - 273.15;
    case 'r':  return (value - 491.67) * 5 / 9;
    case 're': return value * 5 / 4;
    default:   throw new Error(`Unknown unit: ${fromKey}`);
  }
}

/**
 * Convert a value in Celsius into a given unit.
 * @param {number} celsius
 * @param {string} toKey - key of UNITS
 * @returns {number}
 */
export function fromCelsius(celsius, toKey) {
  switch (toKey) {
    case 'c':  return celsius;
    case 'f':  return celsius * 9 / 5 + 32;
    case 'k':  return celsius + 273.15;
    case 'r':  return (celsius + 273.15) * 9 / 5;
    case 're': return celsius * 4 / 5;
    default:   throw new Error(`Unknown unit: ${toKey}`);
  }
}

/**
 * Check whether a value in a given unit falls below absolute zero.
 * Converts to Celsius internally so it works regardless of input unit.
 * @param {number} value
 * @param {string} fromKey
 * @returns {boolean}
 */
export function isBelowAbsoluteZero(value, fromKey) {
  const celsius = toCelsius(value, fromKey);
  return celsius < UNITS.c.absoluteZero - ABSOLUTE_ZERO_EPSILON;
}

/**
 * Convert a single input value+unit into every unit defined in UNITS.
 * @param {number} value
 * @param {string} fromKey
 * @returns {Object<string, number>} map of unit key -> converted value
 */
export function convertAll(value, fromKey) {
  const celsius = toCelsius(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromCelsius(celsius, key);
  }
  return result;
}
