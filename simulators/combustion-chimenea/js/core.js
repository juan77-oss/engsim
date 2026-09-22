/**
 * core.js — Combustion Chimney Analyser — Calculation Engine
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Pure engineering/calculation module.
 *           Zero DOM access. Zero side effects.
 *           Implements the Siegert method for combustion efficiency.
 *
 * EXPORTS :
 *   calculate — main calculation entry point
 *
 * FORMULAS (Siegert method):
 *   If CO2 mode:
 *     D  = CO2max / CO2medido
 *     EA = (D - 1) * 100                            [%]
 *   If O2 mode:
 *     CO2est = CO2max * (1 - O2 / 21)               (derived inside this module)
 *     EA = (O2 / (21 - O2)) * 100                   [%]
 *   Losses (q) = K * (T_gases - T_amb) / CO2        [%]  (Siegert)
 *                clamped to [0, 100]
 *   Efficiency (eta) = 100 - q                       [%]
 *                clamped to [0, 100]
 *
 * SOURCES :
 *   Bibliografía técnica de calderas y normas europeas
 *   de eficiencia EN 303.
 *
 * AUDIT NOTES (resolved):
 *   - Efficiency/losses are now clamped to a physically valid [0, 100]
 *     range on both ends (previously only the upper bound was capped,
 *     which allowed negative efficiency under high-loss inputs).
 *   - The O2 → CO2 conversion used to live in the UI layer
 *     (simulator.js). It has been moved here so the engine owns 100%
 *     of the thermodynamics and stays callable/testable on its own.
 *   - The engine no longer trusts the UI for O2 bounds: O2 <= 0 is
 *     now rejected here too, not just O2 >= 21.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * calculate()
 *
 * Executes the thermodynamic formulas in order.
 * Uses CO2 (directly measured, or derived here from O2) as the basis.
 * Fuel constants are injected by the caller (see constants.js) —
 * this module has no knowledge of the fuel table itself.
 *
 * @param {Object} p              - Input parameter object
 * @param {Object} p.fuel         - Fuel object { label, co2max, K }
 * @param {number|undefined} p.co2 - Measured CO2 [%] — required when p.mode === 'co2'
 * @param {number|undefined} p.o2  - Measured O2 [%]  — required when p.mode === 'o2'
 * @param {number} p.Tg           - Flue gas temperature [°C]
 * @param {number} p.Ta           - Ambient temperature [°C]
 * @param {string} p.mode         - 'co2' | 'o2'
 *
 * @returns {Object} results
 * @returns {number} results.co2max     - Theoretical max CO2 [%]
 * @returns {number} results.dilucion   - Dilution factor D [dimensionless]
 * @returns {number} results.exceso     - Excess air EA [%]
 * @returns {number} results.perdidas   - Sensible heat losses q [%], clamped [0, 100]
 * @returns {number} results.eficiencia - Combustion efficiency eta [%], clamped [0, 100]
 *
 * @throws {Error} if inputs are physically invalid (CO2 <= 0, or O2 outside (0, 21))
 */
export function calculate(p) {
    // 1. Validación física estricta — el motor no confía en la UI.
    if (p.mode === 'o2') {
        if (p.o2 === undefined || isNaN(p.o2) || p.o2 <= 0 || p.o2 >= 21) {
            throw new Error("O2 must be > 0 and < 21");
        }
    } else {
        if (p.co2 === undefined || isNaN(p.co2) || p.co2 <= 0) {
            throw new Error("CO2 must be > 0");
        }
    }

    // 2. CO2 efectivo — medido directamente, o derivado de O2 aquí mismo
    //    (antes esta conversión vivía en simulator.js; ahora es
    //    responsabilidad exclusiva del motor).
    const co2 = p.mode === 'o2'
        ? p.fuel.co2max * (1 - p.o2 / 21)
        : p.co2;

    // 3. Dilución (D)
    const dilucion = p.fuel.co2max / co2;

    // 4. Exceso de aire (EA)
    let exceso;
    if (p.mode === 'o2') {
        exceso = (p.o2 / (21 - p.o2)) * 100;
    } else {
        exceso = (dilucion - 1) * 100;
    }

    // 5. Pérdidas por calor sensible (Siegert), acotadas a un rango físico válido
    const perdidas = Math.max(0, Math.min(100, p.fuel.K * (p.Tg - p.Ta) / co2));

    // 6. Eficiencia de combustión, acotada a [0, 100]
    const eficiencia = Math.max(0, Math.min(100, 100 - perdidas));

    return {
        co2max: p.fuel.co2max,
        dilucion,
        exceso,
        perdidas,
        eficiencia
    };
}
