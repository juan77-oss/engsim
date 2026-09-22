/**
 * core.js — Power Unit Converter
 * Pure conversion logic. No DOM access here.
 *
 * Strategy: every linear unit stores a factor that converts
 * 1 unit -> N watts (the SI base unit for power). To convert
 * between any two linear units we normalize to watts first,
 * then divide by the target factor.
 *
 * dBm is the one non-linear unit here (logarithmic, referenced
 * to 1 mW) so it gets its own pair of functions instead of a
 * simple factor.
 */

import { POWER_UNITS, DBM_UNIT_ID } from './constants.js';

/**
 * Convert a watt value into dBm.
 * dBm = 10 * log10( P[mW] / 1mW )
 * Undefined for P <= 0 (dBm has no representation for zero/negative power).
 */
export function wattsToDbm(watts) {
  if (!(watts > 0)) return null;
  const milliwatts = watts * 1000;
  return 10 * Math.log10(milliwatts);
}

/**
 * Convert a dBm value into watts.
 * P[mW] = 10 ^ (dBm / 10)
 */
export function dbmToWatts(dbm) {
  if (typeof dbm !== 'number' || Number.isNaN(dbm)) return null;
  const milliwatts = Math.pow(10, dbm / 10);
  return milliwatts / 1000;
}

/**
 * Normalize an input value (in unitId) to watts.
 * Returns null if the value can't be represented in watts
 * (e.g. a dBm value of -Infinity equivalent, or bad input).
 */
export function toWatts(value, unitId) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;

  if (unitId === DBM_UNIT_ID) {
    return dbmToWatts(value);
  }

  const unit = POWER_UNITS[unitId];
  if (!unit) return null;

  return value * unit.toWatt;
}

/**
 * Convert a watt value into the target unit.
 */
export function fromWatts(watts, unitId) {
  if (typeof watts !== 'number' || Number.isNaN(watts)) return null;

  if (unitId === DBM_UNIT_ID) {
    return wattsToDbm(watts);
  }

  const unit = POWER_UNITS[unitId];
  if (!unit) return null;

  // Non-linear/negative-power guard: linear power units are not physically
  // meaningful for negative power in this converter's context, but we still
  // allow negative values through (e.g. representing a power deficit/loss
  // convention some users adopt) since it's a pure unit conversion, not a
  // physical constraint check.
  return watts / unit.toWatt;
}

/**
 * Convert a value from one unit to every unit defined in POWER_UNITS
 * (plus dBm). Returns a map keyed by unit id -> converted value (number
 * or null if not representable, e.g. dBm from a zero/negative watt value).
 *
 * This is the core function driving the "convert to all units at once"
 * table in the UI.
 */
export function convertToAll(value, fromUnitId) {
  const watts = toWatts(value, fromUnitId);
  const results = {};

  if (watts === null) {
    Object.keys(POWER_UNITS).forEach((id) => { results[id] = null; });
    results[DBM_UNIT_ID] = null;
    return { watts: null, results };
  }

  Object.keys(POWER_UNITS).forEach((id) => {
    results[id] = fromWatts(watts, id);
  });
  results[DBM_UNIT_ID] = fromWatts(watts, DBM_UNIT_ID);

  return { watts, results };
}

/**
 * Convenience single from -> to conversion (used by the quick-pick
 * "classic" fields at the top of the page, e.g. example calculators
 * in the educational content).
 */
export function convert(value, fromUnitId, toUnitId) {
  const watts = toWatts(value, fromUnitId);
  if (watts === null) return null;
  return fromWatts(watts, toUnitId);
}