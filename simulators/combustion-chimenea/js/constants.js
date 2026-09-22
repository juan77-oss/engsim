/**
 * constants.js — Combustion Chimney Analyser — Fuel Constants
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Static reference data. Zero logic, zero DOM access.
 *
 * co2max : Maximum theoretical CO2 percentage for stoichiometric
 *          combustion of the given fuel [%].
 * K      : Siegert constant for sensible heat loss calculation
 *          [dimensionless, calibrated per fuel type].
 *
 * SOURCES :
 *   Bibliografía técnica de calderas y normas europeas
 *   de eficiencia EN 303.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

export const FUEL_DATA = {
    gas_natural: { label: 'Natural Gas', co2max: 11.7, K: 0.39 },
    fuel_oil:    { label: 'Fuel Oil',    co2max: 15.7, K: 0.50 },
    glp:         { label: 'LPG',         co2max: 13.7, K: 0.42 }
};
