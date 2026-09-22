// core.js — Torque Converter
// Pure conversion logic, no DOM access. All torque units are linear
// (same pattern as Energy/Length/Mass/Volume/Area/Speed/Pressure/Force
// Converter), so this is a straight factor system through the base
// unit (newton-meter).

import { UNITS } from './constants.js';

export function toNm(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toNm;
}

export function fromNm(nm, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return nm / unit.toNm;
}

export function convertAll(value, fromKey) {
  const nm = toNm(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromNm(nm, key);
  }
  return result;
}
