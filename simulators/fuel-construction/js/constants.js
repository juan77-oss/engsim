/**
 * constants.js — Fuel Construction (Combustión) · Constantes
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Punto único de constantes compartidas por core.js, state.js,
 *           dom.js, chart.js e insights.js. Antes estaban repartidas
 *           en varios archivos; se consolidan aquí para evitar
 *           duplicación y facilitar el mantenimiento.
 * ─────────────────────────────────────────────────────────────────
 */


// ═══════════════════════════════════════════════
//  COMPOSICIÓN — claves y tolerancia numérica
//  (antes en core.js)
// ═══════════════════════════════════════════════

/** Componentes de la composición en base seca */
export const DRY_COMPONENTS = ['C', 'H', 'O', 'N', 'S', 'Z'];

/** Tolerancia numérica para validación de sumas */
export const EPSILON = 0.01;


// ═══════════════════════════════════════════════
//  METADATOS DE COMPONENTES — etiqueta, color, info
//  (antes en ui/dom.js)
// ═══════════════════════════════════════════════

/** @type {Array<{ key: string, label: string, symbol: string, color: string, info: string }>} */
export const COMPONENT_META = [
    {
        key: 'C',
        label: 'Carbon',
        symbol: 'C',
        color: '#6366f1',   // indigo
        info: 'Main energy carrier. Higher %C increases heating value.'
    },
    {
        key: 'H',
        label: 'Hydrogen',
        symbol: 'H',
        color: '#3b82f6',   // blue
        info: 'High heating value per kg. Produces H₂O during combustion.'
    },
    {
        key: 'O',
        label: 'Oxygen',
        symbol: 'O',
        color: '#10b981',   // emerald
        info: 'Inherent fuel oxygen. Reduces external air demand.'
    },
    {
        key: 'N',
        label: 'Nitrogen',
        symbol: 'N',
        color: '#f59e0b',   // amber
        info: 'Energetically inert. Generates NOx at high concentrations.'
    },
    {
        key: 'S',
        label: 'Sulfur',
        symbol: 'S',
        color: '#f97316',   // orange
        info: 'Contributes energy but generates SO₂. Undesirable in clean fuels.'
    },
    {
        key: 'Z',
        label: 'Ash',
        symbol: 'Z',
        color: '#9ca3af',   // gray
        info: 'Non-combustible inorganic matter. Pure diluent.'
    }
];


// ═══════════════════════════════════════════════
//  UMBRALES PEDAGÓGICOS — insights
//  (antes en ui/insights.js)
// ═══════════════════════════════════════════════

export const THRESHOLDS = {
    humidityLow:    10,
    humidityMed:    30,
    humidityHigh:   60,
    ashHigh:        20,
    sulfurHigh:      3,
    carbonLow:      40,
    carbonHigh:     85,
};


// ═══════════════════════════════════════════════
//  VALORES POR DEFECTO — estado inicial
//  (antes en simulador-combustion.js)
// ═══════════════════════════════════════════════

/** @type {{ C: number, H: number, O: number, N: number, S: number, Z: number }} */
export const DEFAULT_DRY = {
    C: 75.0,
    H:  5.0,
    O: 10.0,
    N:  2.0,
    S:  2.0,
    Z:  6.0     // Z = 100 - sum(C,H,O,N,S)
};

/** Humedad inicial (0 = base seca) */
export const DEFAULT_HUMIDITY = 0;

/** Exceso de aire inicial (lambda = 1.0) */
export const DEFAULT_EXCESS_AIR = 1.0;

/** Temperatura inicial (25°C = 298.15 K) */
export const DEFAULT_TEMPERATURE = 298.15;

/** Presión inicial (1 atm = 101325 Pa) */
export const DEFAULT_PRESSURE = 101325;
