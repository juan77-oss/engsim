/**
 * state.js — Gestión de Estado del Combustible (FASE 1)
 * (antes: simulador-combustion.js)
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Mantiene el estado mutable del combustible y coordina
 *           las actualizaciones de composición.
 *
 * REGLAS  :
 *   - No accede al DOM
 *   - No importa módulos de dom.js / chart.js / etc.
 *   - Solo conoce core.js y constants.js
 *   - Expone funciones de mutación de estado controladas
 *
 * PATRÓN  : Estado centralizado + funciones de mutación puras.
 *           simulator.js consume este estado para renderizar.
 * ─────────────────────────────────────────────────────────────────
 */

import {
    updateCompositionByDifference,
    buildFuelState,
    calculateHeatingValues,
    calculateCombustionAir,
    calculateAirVolume
} from './core.js';

import {
    DRY_COMPONENTS,
    DEFAULT_DRY,
    DEFAULT_HUMIDITY,
    DEFAULT_EXCESS_AIR,
    DEFAULT_TEMPERATURE,
    DEFAULT_PRESSURE
} from './constants.js';


// ═══════════════════════════════════════════════
//  ESTADO INTERNO — única fuente de verdad
// ═══════════════════════════════════════════════

/** Composición en base seca */
let _dry = { ...DEFAULT_DRY };

/** Humedad en % */
let _humidity = DEFAULT_HUMIDITY;

/** Exceso de aire (lambda) */
let _excessAir = DEFAULT_EXCESS_AIR;

/** Temperatura en K */
let _temperature = DEFAULT_TEMPERATURE;

/** Presión en Pa */
let _pressure = DEFAULT_PRESSURE;

// PRO access control removed — all features are now free


// ═══════════════════════════════════════════════
//  setComponent()
//  Actualiza un componente de la composición base
//  seca y recalcula la ceniza por diferencia.
// ═══════════════════════════════════════════════

/**
 * Actualiza el valor de un componente (C,H,O,N,S) y
 * recalcula Z automáticamente.
 *
 * @param {string} key   - Componente a cambiar
 * @param {number} value - Nuevo valor en % [0, 100]
 */
export function setComponent(key, value) {
    if (key === 'Z') return; // Cenizas no se edita manualmente

    if (!DRY_COMPONENTS.includes(key)) {
        console.warn(`[simulador-combustion] Componente desconocido: "${key}"`);
        return;
    }

    const val = Number(value) || 0;
    _dry = updateCompositionByDifference(_dry, key, val);
}


// ═══════════════════════════════════════════════
//  setHumidity()
//  Actualiza la humedad del combustible.
// ═══════════════════════════════════════════════

/**
 * Actualiza la humedad.
 *
 * @param {number} value - Humedad en % [0, 80]
 */
export function setHumidity(value) {
    _humidity = Math.max(0, Math.min(80, Number(value) || 0));
}

/**
 * Actualiza el exceso de aire (lambda).
 * @param {number} value - Lambda >= 1.0
 */
export function setExcessAir(value) {
    _excessAir = Math.max(1.0, Number(value) || 1.0);
}

/**
 * Actualiza la temperatura de entrada del aire.
 * @param {number} value - Temperatura en K
 */
export function setTemperature(value) {
    _temperature = Math.max(1, Number(value) || DEFAULT_TEMPERATURE);
}

/**
 * Actualiza la presión del aire.
 * @param {number} value - Presión en Pa
 */
export function setPressure(value) {
    _pressure = Math.max(1, Number(value) || DEFAULT_PRESSURE);
}

// setIsPro / getIsPro removed — PRO access control no longer applicable

/**
 * @returns {number}
 */
export function getTemperature() { return _temperature; }

/**
 * @returns {number}
 */
export function getPressure() { return _pressure; }


// ═══════════════════════════════════════════════
//  getDryComposition()
//  Retorna copia de la composición base seca actual.
// ═══════════════════════════════════════════════

/**
 * @returns {{ C, H, O, N, S, Z }} Copia de la composición base seca
 */
export function getDryComposition() {
    return { ..._dry };
}


// ═══════════════════════════════════════════════
//  getHumidity()
// ═══════════════════════════════════════════════

/**
 * @returns {number} Humedad actual en %
 */
export function getHumidity() {
    return _humidity;
}


// ═══════════════════════════════════════════════
//  computeFuel()
//  Calcula el estado completo del combustible e integra la FASE 2 (Poderes Caloríficos).
// ═══════════════════════════════════════════════

/**
 * Calcula el estado completo del combustible e integra FASES 2 y 3.
 *
 * @returns {object} - Estado completo con .heating y .air
 */
export function computeFuel() {
    const fuelState = buildFuelState(_dry, _humidity);

    if (fuelState.valid) {
        // Fracciones másicas 0-1
        const composition = {
            C: _dry.C / 100,
            H: _dry.H / 100,
            O: _dry.O / 100,
            S: _dry.S / 100,
            moisture: _humidity / 100
        };

        // FASE 2 — Poder Calorífico
        fuelState.heating = calculateHeatingValues(composition);

        // FASE 3 — Aire de Combustión
        fuelState.air = calculateCombustionAir(composition, _excessAir);

        // FASE 3.1 — Condiciones Reales (Volumen)
        fuelState.airRealConditions = calculateAirVolume(
            fuelState.air.air_real,
            _temperature,
            _pressure
        );
    }

    return fuelState;
}


// ═══════════════════════════════════════════════
//  resetFuel()
//  Reinicia la composición a los valores por defecto.
// ═══════════════════════════════════════════════

/**
 * Reinicia el combustible a la composición y humedad por defecto.
 */
export function resetFuel() {
    _dry      = { ...DEFAULT_DRY };
    _humidity = DEFAULT_HUMIDITY;
}
