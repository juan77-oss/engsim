// core.js — Flow Rate Converter
// Pure conversion logic, no DOM access. All flow rate units are linear
// (same pattern as Energy/Length/Mass/Volume/Area/Speed/Pressure/
// Force/Torque Converter), so this is a straight factor system through
// the base unit (m³/s).

import { UNITS } from './constants.js';

export function toM3s(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toM3s;
}

export function fromM3s(m3s, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return m3s / unit.toM3s;
}

export function convertAll(value, fromKey) {
  const m3s = toM3s(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromM3s(m3s, key);
  }
  return result;
}
