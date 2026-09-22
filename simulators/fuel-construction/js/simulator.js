/**
 * simulator.js — Orquestador · Combustión FASE 1
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Capa de pegamento entre la UI (dom.js, chart.js, insights.js,
 *           interpretation.js) y la lógica del combustible (state.js → core.js).
 *
 * FLUJO DE DATOS:
 *   evento slider → setComponent() / setHumidity()
 *              → computeFuel() [core.js puro]
 *              → renderDryBasis() + renderWetBasis()
 *              → updateChart() + renderInsights()
 *
 * REGLAS  :
 *   - Sin acceso directo al DOM (delegar a dom.js)
 *   - Sin lógica física (delegar a state.js)
 *   - El estado es única fuente de verdad (en state.js)
 * ─────────────────────────────────────────────────────────────────
 */

import {
    // DOM
    renderSliders,
    updateSliderDisplay,
    updateHumidityDisplay,
    updateSumDisplay,
    renderBasisBanner,
    renderDryBasis,
    renderWetBasis,
    renderHeatingValues,
    renderProSection,
    renderError,
    bindSliderEvents,
    updateExploration,
    qs
} from './dom.js';

import { COMPONENT_META, DRY_COMPONENTS } from './constants.js';

import {
    initChart,
    updateChart
} from './chart.js';

import {
    generateInsights,
    renderInsights
} from './insights.js';

import {
    generateInterpretation,
    renderTutorCard
} from './interpretation.js';

import {
    setComponent,
    setHumidity,
    setTemperature,
    setPressure,
    getDryComposition,
    getHumidity,
    computeFuel,
    resetFuel
} from './state.js';


// ═══════════════════════════════════════════════
//  GLOBAL STATE SYSTEM
// ═══════════════════════════════════════════════

/**
 * Single source of truth for UI state and shared parameters.
 * Note: Core physics state resides in state.js for now.
 */
const state = {
    learningMode: false,
    explorationMode: false,
    labMode: false,       // Vista de Engineering Lab (Dashboard)
    interpretation: "",
    sweepResults: [],
    inputs: {
        temperature: null,
        pressure: null,
        airFuelRatio: null
    },
    results: {
        efficiency: null,
        excessAir: null
    }
};

/**
 * Updates the global state and triggers a re-render.
 * @param {Object} newState - The partial state to update.
 */
function setState(newState) {
    // Top-level merge
    Object.assign(state, newState);
    
    // Nested inputs merge if provided
    if (newState.inputs) {
        state.inputs = { ...state.inputs, ...newState.inputs };
    }
    
    // Nested results merge if provided
    if (newState.results) {
        state.results = { ...state.results, ...newState.results };
    }
    
    scheduleUpdate();
}


// ═══════════════════════════════════════════════
//  PERFORMANCE — Debounce con requestAnimationFrame
// ═══════════════════════════════════════════════

let _rafId = null;

function scheduleUpdate() {
    if (_rafId !== null) cancelAnimationFrame(_rafId);
    _rafId = requestAnimationFrame(() => {
        _rafId = null;
        update();
    });
}


// ═══════════════════════════════════════════════
//  update() — Ciclo principal de simulación
//  Ejecuta en cada cambio de input y en el arranque.
// ═══════════════════════════════════════════════

function update() {
    const fuelState = computeFuel();

    // ── CASO: Error ──────────────────────────────────────────
    if (!fuelState.valid) {
        renderError(fuelState.error);
        renderHeatingValues(null); // Mostrar mensaje "Ajusta los parámetros..."
        return;
    }

    renderError(null);

    // ── 1. Resultados Principales (KPI) ──────────────────────
    renderHeatingValues(fuelState);

    // ── 2. Actualizar sliders de composición (Inputs) ────────
    const dry = getDryComposition();
    DRY_COMPONENTS.forEach(key => {
        updateSliderDisplay(key, dry[key]);
    });

    // Suma de base seca (debe ser ≈ 100)
    const sumDry = DRY_COMPONENTS.reduce((acc, k) => acc + dry[k], 0);
    updateSumDisplay(sumDry);

    // Humedad
    updateHumidityDisplay(getHumidity());

    // ── 2. Banner de base activa ─────────────────────────────
    renderBasisBanner(fuelState);

    // ── 3. Panel de resultados — composición ────────────────
    renderDryBasis(fuelState.dry);
    renderWetBasis(fuelState);

    // ── 4. Gráfico (opcional) ────────────────────────────────
    updateChart(fuelState);

    // ── 5. Insights pedagógicos ──────────────────────────────
    const insights = generateInsights(fuelState);
    const insightsHTML = renderInsights(insights);

    const insightsContainer = qs('[data-container="insights"]');
    if (insightsContainer) {
        insightsContainer.innerHTML = insightsHTML;
    }

    // ── 6. Sección PRO — Condiciones Reales ───────────────────
    renderProSection(fuelState);

    // ── 7. Capa Educativa (Modo Docente) ───────────────────────
    updateEducationalLayer(state.learningMode, fuelState);

    // ── 8. Modo Exploración (What If) ──────────────────────────
    if (state.explorationMode) {
        state.sweepResults = runSweep(fuelState);
    } else {
        state.sweepResults = [];
    }
    updateExploration(state.sweepResults, state.explorationMode);
}

/**
 * Genera un barrido de parámetros para el modo exploración.
 * Simula cómo varía la eficiencia teórica en función del exceso de aire.
 */
function runSweep(fuelState) {
    const results = [];
    const baseEfficiency = 0.85; // 85% base
    
    // Barrido de relación lambda (aire real / aire estequiométrico)
    // de 1.0 a 2.0 (0% a 100% exceso de aire)
    for (let lambda = 1.0; lambda <= 2.0; lambda += 0.1) {
        // Penalización simplificada: a más aire en exceso, más calor se va por chimenea
        const penalty = (lambda - 1.0) * 0.12; 
        const efficiency = baseEfficiency - penalty;
        
        results.push({
            x: lambda,
            y: efficiency
        });
    }
    
    return results;
}

/**
 * Muestra/oculta información educativa basada en el estado del Modo Docente.
 */
function updateEducationalLayer(active, fuelState) {
    // 1. Resaltado de nota técnica
    const note = qs('.simulator-note');
    if (note) {
        note.style.borderColor = active ? 'var(--color-primary)' : 'var(--border-color)';
        note.style.boxShadow = active ? '0 0 15px rgba(99, 102, 241, 0.1)' : 'none';
    }
    
    // 2. Renderizado del Auto Tutor
    const tutorContainer = qs('[data-container="tutor"]');
    if (!tutorContainer) return;
    
    if (active) {
        const text = generateInterpretation(fuelState);
        state.interpretation = text; // Guardamos en estado para persistencia/auditoría
        tutorContainer.innerHTML = renderTutorCard(text);
    } else {
        tutorContainer.innerHTML = '';
    }
}


// ═══════════════════════════════════════════════
//  onComponentChange()
//  Callback desde dom.js al mover slider de composición.
// ═══════════════════════════════════════════════

/**
 * @param {string} key   - Componente: 'C'|'H'|'O'|'N'|'S'|'Z'
 * @param {number} value - Nuevo valor crudo del slider
 */
function onComponentChange(key, value) {
    setComponent(key, value);
    scheduleUpdate();
}


// ═══════════════════════════════════════════════
//  onHumidityChange()
//  Callback desde dom.js al mover slider de humedad.
// ═══════════════════════════════════════════════

/**
 * @param {number} value - Nuevo valor de humedad
 */
function onHumidityChange(value) {
    setHumidity(value);
    scheduleUpdate();
}


// ═══════════════════════════════════════════════
//  bindReset()
//  Conecta el botón de reset (si existe).
// ═══════════════════════════════════════════════

function bindReset() {
    const btn = document.getElementById('btn-reset-fuel');
    if (!btn) return;

    btn.addEventListener('click', () => {
        resetFuel();
        scheduleUpdate();
    });
}

/**
 * Conecta el toggle de Modo Docente.
 */
function bindLearningToggle() {
    const toggle = document.getElementById('learningModeToggle');
    if (!toggle) return;
    
    toggle.addEventListener('change', (e) => {
        setState({ learningMode: e.target.checked });
    });
}

/**
 * Conecta el toggle de Modo Exploración.
 */
function bindExplorationToggle() {
    const toggle = document.getElementById('explorationModeToggle');
    if (!toggle) return;
    
    toggle.addEventListener('change', (e) => {
        setState({ explorationMode: e.target.checked });
        scheduleUpdate();
    });
}

/**
 * Escucha eventos del Toggle Global de Lab Mode
 */
function bindLabToggle() {
    const btnStandard = document.getElementById('toggle-standard');
    const btnLab = document.getElementById('toggle-lab');

    if (!btnStandard || !btnLab) return;

    btnStandard.addEventListener('click', () => {
        setState({ labMode: false });
        document.body.classList.remove('theme-lab');
        btnStandard.classList.add('active');
        btnLab.classList.remove('active');
        // No es necesario un re-render pesado, solo el cambio CSS muestra/oculta el grid.
    });

    btnLab.addEventListener('click', () => {
        setState({ labMode: true });
        document.body.classList.add('theme-lab');
        btnLab.classList.add('active');
        btnStandard.classList.remove('active');
        
        // Disparamos evento para analytics si es necesario
        window.dispatchEvent(new CustomEvent('analytics:lab_mode_entered'));
    });
}

// bindUpgradeRequests removed — no PRO upgrade flow

/**
 * Cableado de eventos de condiciones reales (T, P)
 * Nota: pro:temp y pro:press son los eventos del panel de Condiciones Reales—
 * se preservan porque alimentan funcionalidad de ingeniería real desbloqueada.
 */
function bindProEvents() {
    // Temperature slider in Real Conditions panel
    window.addEventListener('pro:temp', e => {
        setTemperature(e.detail);
        scheduleUpdate();
    });

    // Pressure slider in Real Conditions panel
    window.addEventListener('pro:press', e => {
        setPressure(e.detail);
        scheduleUpdate();
    });
}


/**
 * Configura los paneles colapsables (ej. Detalle Técnico)
 * Se usa event delegation para no depender de que el DOM exista al instante.
 */
function setupCollapsibles() {
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.collapsible-header');
        if (!header) return;

        const collapsible = header.closest('.collapsible');
        if (collapsible) {
            collapsible.classList.toggle('open');
            
            // Animación del icono (si existe)
            const icon = header.querySelector('.collapsible-icon');
            if (icon) {
                if (collapsible.classList.contains('open')) {
                    icon.style.transform = 'rotate(90deg)';
                } else {
                    icon.style.transform = 'rotate(0deg)';
                }
            }
        }
    });
}


// ═══════════════════════════════════════════════
//  BOOTSTRAP — Secuencia de arranque
// ═══════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
    // 1. Construir panel izquierdo de sliders
    renderSliders(getDryComposition(), getHumidity());

    // 2. Cablear eventos de sliders
    bindSliderEvents(onComponentChange, onHumidityChange);

    // 3. Cablear botón de reset
    bindReset();

    // 4. Cablear toggle de Modo Docente
    bindLearningToggle();

    // 5. Cablear toggle de Modo Exploración
    bindExplorationToggle();

    // 6. Cablear Toggle Global de Engineering Lab
    bindLabToggle();

    // 7. Cablear eventos de Condiciones Reales (T, P)
    bindProEvents();

    // 9. Configurar componentes colapsables
    setupCollapsibles();

    // 8. Crear gráfico (opcional — falla silenciosamente si Chart.js no está)
    initChart();

    // 9. Primer render con valores por defecto
    scheduleUpdate();
});