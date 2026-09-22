/**
 * core.js — Combustión · Motor de Cálculo (FASE 1)
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Funciones matemáticas puras para la construcción del
 *           combustible en base seca y húmeda.
 *
 * REGLAS  :
 *   - Sin acceso al DOM
 *   - Sin efectos secundarios
 *   - Sin dependencias externas
 *
 * FASE 1 — Construcción del combustible:
 *   normalizeComposition()  → garantiza que C+H+O+N+S+Z = 100 %
 *   convertToWetBasis()     → aplica X_BH = X_BS × (1 − Hu/100)
 *   validateComposition()   → verifica coherencia física
 *   buildFuelState()        → función central que devuelve estado completo
 * ─────────────────────────────────────────────────────────────────
 */


// ═══════════════════════════════════════════════
//  CONSTANTES
//  (movidas a constants.js — se importan aquí)
// ═══════════════════════════════════════════════

import { DRY_COMPONENTS, EPSILON } from './constants.js';


// ═══════════════════════════════════════════════
//  normalizeComposition()
//  Ajusta proporcionalmente el resto de componentes
//  para que la suma siempre sea exactamente 100.
// ═══════════════════════════════════════════════

/**
 * Calcula la composición basándose en el modelo de diferencia.
 * Z (Cenizas) = 100 - (C + H + O + N + S)
 *
 * @param {object} composition - Composición actual {C, H, O, N, S, Z}
 * @param {string} changedKey  - Clave que se está modificando
 * @param {number} newValue    - Nuevo valor para la clave
 * @returns {object}           - Composición actualizada y validada
 */
export function updateCompositionByDifference(composition, changedKey, newValue) {
    const activeKeys = ['C', 'H', 'O', 'N', 'S'];
    const result = { ...composition };

    if (activeKeys.includes(changedKey)) {
        // 1. Calcular suma de los OTROS componentes activos (excluyendo el que cambia)
        const othersSum = activeKeys
            .filter(k => k !== changedKey)
            .reduce((acc, k) => acc + (composition[k] ?? 0), 0);

        // 2. Limitar el nuevo valor para que la suma total no supere 100
        const maxAllowed = 100 - othersSum;
        const clampedValue = Math.max(0, Math.min(newValue, maxAllowed));

        result[changedKey] = clampedValue;

        // 3. Recalcular Z por diferencia
        const newActiveSum = othersSum + clampedValue;
        result.Z = Math.max(0, 100 - newActiveSum);
    }

    return result;
}


// ═══════════════════════════════════════════════
//  convertToWetBasis()
//  Aplica la conversión base seca → base húmeda.
//  Fórmula: X_BH = X_BS × (1 − Hu/100)
// ═══════════════════════════════════════════════

/**
 * Convierte una composición de base seca a base húmeda.
 *
 * La suma en base húmeda será < 100 % cuando Hu > 0,
 * porque la fracción restante corresponde al agua.
 *
 * @param {object} dryComposition  - { C, H, O, N, S, Z } en base seca (%)
 * @param {number} humidity        - Humedad Hu en % [0, 80]
 * @returns {object}               - { C, H, O, N, S, Z } en base húmeda (%)
 */
export function convertToWetBasis(dryComposition, humidity) {
    const Hu     = Math.max(0, Math.min(80, humidity ?? 0));
    const factor = 1 - Hu / 100;           // fracción de combustible seco en la mezcla húmeda

    const result = {};
    DRY_COMPONENTS.forEach(k => {
        const val = dryComposition[k] ?? 0;
        result[k] = val * factor;
    });

    return result;
}


// ═══════════════════════════════════════════════
//  validateComposition()
//  Verifica coherencia física de la composición.
// ═══════════════════════════════════════════════

/**
 * Valida que la composición en base seca sea coherente.
 *
 * Comprueba:
 *  - Que todos los valores sean finitos y ≥ 0
 *  - Que la suma sea ≈ 100 % (tolerancia: ±0.01)
 *
 * @param {object} composition  - { C, H, O, N, S, Z }
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateComposition(composition) {
    for (const k of DRY_COMPONENTS) {
        const v = composition[k] ?? 0;
        if (!isFinite(v) || v < 0) {
            return { valid: false, error: `Valor inválido para ${k}: ${v}` };
        }
    }

    const total = DRY_COMPONENTS.reduce((acc, k) => acc + (composition[k] ?? 0), 0);

    if (Math.abs(total - 100) > EPSILON) {
        return {
            valid: false,
            error: `La suma de la composición es ${total.toFixed(2)} % (debe ser 100 %)`
        };
    }

    return { valid: true, error: null };
}


// ═══════════════════════════════════════════════
//  buildFuelState()
//  Función central: construye el estado completo
//  del combustible a partir de entradas del usuario.
// ═══════════════════════════════════════════════

/**
 * Construye el estado completo del combustible.
 *
 * Recibe la composición normalizada y la humedad,
 * y retorna:
 *  - composición base seca
 *  - composición base húmeda
 *  - humedad
 *  - fracción de agua en base húmeda
 *  - suma en base húmeda
 *  - validación
 *
 * @param {object} dryComposition  - { C, H, O, N, S, Z } normalizados a 100 %
 * @param {number} humidity        - Hu en % [0, 80]
 * @returns {object}               - Estado completo del combustible
 */
export function buildFuelState(dryComposition, humidity) {
    const validation = validateComposition(dryComposition);

    if (!validation.valid) {
        return {
            valid: false,
            error: validation.error
        };
    }

    const Hu         = Math.max(0, Math.min(80, humidity ?? 0));
    const wetComp    = convertToWetBasis(dryComposition, Hu);

    // Fracción de agua en la mezcla húmeda (el resto hasta 100 %)
    const sumWet     = DRY_COMPONENTS.reduce((acc, k) => acc + wetComp[k], 0);
    const waterFrac  = 100 - sumWet;       // ≡ Hu cuando Hu > 0

    return {
        valid: true,

        // Base seca (entrada del usuario)
        dry: { ...dryComposition },

        // Base húmeda (resultado calculado)
        wet: wetComp,

        // Humedad
        humidity: Hu,

        // Agua en base húmeda (fracción que falta hasta 100 %)
        waterFraction: waterFrac,

        // Suma de base húmeda (debe ser < 100 cuando Hu > 0)
        sumWet,

        // Base activa: "dry" si Hu = 0, "wet" si Hu > 0
        basis: Hu === 0 ? 'dry' : 'wet'
    };
}

// ═══════════════════════════════════════════════
//  COMBUSTION AIR — Stoichiometry Calculation
// ═══════════════════════════════════════════════

/**
 * Calcula los requerimientos de aire para la combustión completa.
 * Basado en estequiometría másica.
 *
 * @param {object} composition - { C, H, O, S } como fracciones (0-1)
 * @param {number} excess_air   - Factor lambda (n), usualmente >= 1.0
 * @returns {object}            - Resultados de aire en kg_aire / kg_fuel
 */
export function calculateCombustionAir(composition, excess_air) {
    const { C, H, O, S } = composition;

    // 1. Oxígeno teórico necesario (kg O2 / kg combustible)
    // C + O2 -> CO2 (32/12 = 2.67)
    // 2H2 + O2 -> 2H2O (32/4 = 8)
    // S + O2 -> SO2 (32/32 = 1)
    // Se resta el oxígeno propio del combustible
    let O2_theoretical = 2.67 * C + 8 * H + 1 * S - O;

    // Garantizar que no sea negativo (físicamente imposible)
    O2_theoretical = Math.max(0, O2_theoretical);

    // 2. Aire teórico (Aire contiene ~23.2% de O2 en masa)
    const air_theoretical = O2_theoretical / 0.232;

    // 3. Aire real (incluyendo exceso)
    const n = Math.max(1.0, excess_air ?? 1.0); // Lambda >= 1
    const air_real = air_theoretical * n;

    // 4. Exceso de aire en porcentaje
    const excess_percent = (n - 1) * 100;

    return {
        O2_theoretical,
        air_theoretical,
        air_real,
        excess_percent
    };
}

// ═══════════════════════════════════════════════
//  HEATING VALUES — Dulong Calculation
// ═══════════════════════════════════════════════

/**
 * Calcula los poderes caloríficos (PCS y PCI) del combustible.
 * Utiliza la fórmula de Dulong para estimación termodinámica.
 *
 * @param {object} composition - { C, H, O, S, moisture } como fracciones (0-1)
 * @returns {object}           - { PCS, PCI, delta } en MJ/kg
 */
export function calculateHeatingValues(composition) {
    const { C, H, O, S, moisture } = composition;

    // Cálculo del Poder Calorífico Superior (PCS)
    const PCS = 338 * C + 1442 * (H - O / 8) + 94 * S;

    // Cálculo del Poder Calorífico Inferior (PCI)
    // Se resta el calor latente de vaporización del agua (2.442 MJ/kg)
    // generada por el Hidrógeno (9*H) y la humedad propia del combustible.
    const PCI = PCS - 2.442 * (9 * H + moisture);

    return {
        PCS,
        PCI,
        delta: PCS - PCI
    };
}
// -----------------------------------------------
//  REAL CONDITIONS � Ideal Gas Law
// -----------------------------------------------

/**
 * Convierte masa de aire en volumen real usando la ley de gases ideales.
 * V = (m * R * T) / P
 *
 * @param {number} air_mass - Masa de aire en kg_aire / kg_fuel
 * @param {number} T        - Temperatura en Kelvin (K)
 * @param {number} P        - Presi�n en Pascales (Pa)
 * @returns {object}        - { air_volume_real } en m�_aire / kg_fuel
 */
export function calculateAirVolume(air_mass, T, P) {
    const R_air = 287; // Constante espec�fica del aire [J/(kg�K)]

    // C�lculo del volumen real
    const air_volume_real = (air_mass * R_air * T) / P;

    return {
        air_volume_real
    };
}
