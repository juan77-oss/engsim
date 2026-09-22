// core.js — Force Converter
// Pure conversion logic, no DOM access. All force units are linear
// (same pattern as Energy/Length/Mass/Volume/Area/Speed/Pressure
// Converter), so this is a straight factor system through the base
// unit (newton).

import { UNITS } from './constants.js';

export function toNewtons(value, fromKey) {
  const unit = UNITS[fromKey];
  if (!unit) throw new Error(`Unknown unit: ${fromKey}`);
  return value * unit.toNewton;
}

export function fromNewtons(newtons, toKey) {
  const unit = UNITS[toKey];
  if (!unit) throw new Error(`Unknown unit: ${toKey}`);
  return newtons / unit.toNewton;
}

export function convertAll(value, fromKey) {
  const newtons = toNewtons(value, fromKey);
  const result = {};
  for (const key in UNITS) {
    result[key] = fromNewtons(newtons, key);
  }
  return result;
}
