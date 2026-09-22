/**
 * ui/dom.js — DOM Controller · Combustión FASE 1
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Lectura de entradas del DOM y escritura de resultados.
 *           No contiene lógica física ni importa core.js.
 *
 * EXPORTS :
 *   renderSliders(composition, humidity)  → construye sliders en el panel izquierdo
 *   renderDryBasis(dryComp)               → muestra composición base seca
 *   renderWetBasis(fuelState)             → muestra composición base húmeda
 *   renderBasisBanner(fuelState)          → muestra el banner de base activa
 *   renderError(msg)                      → muestra / limpia error
 *   bindSliderEvents(onComponentChange, onHumidityChange) → cableado de eventos
 * ─────────────────────────────────────────────────────────────────
 */

import { COMPONENT_META } from './constants.js';


// ═══════════════════════════════════════════════
//  SCOPING — Selectores acotados al .sim-shell
// ═══════════════════════════════════════════════

const root = () => document.querySelector('.sim-layout__main') || document.body;

/**
 * querySelector acotado al .sim-shell
 * @param {string} sel
 * @returns {Element|null}
 */
export function qs(sel) {
    return root()?.querySelector(sel) ?? null;
}

/**
 * querySelectorAll acotado al .sim-shell
 * @param {string} sel
 * @returns {Element[]}
 */
export function qsa(sel) {
    return Array.from(root()?.querySelectorAll(sel) ?? []);
}


// ═══════════════════════════════════════════════
//  HELPERS — Formato numérico
// ═══════════════════════════════════════════════

/**
 * Formatea un número como porcentaje con 1 decimal.
 * @param {number} val
 * @returns {string}
 */
function fmt(val) {
    if (!isFinite(val) || val === null) return '—';
    return Number(val).toFixed(1);
}


// ═══════════════════════════════════════════════
//  renderSliders()
//  Construye el panel izquierdo de sliders.
//  Se llama UNA VEZ en el arranque.
// ═══════════════════════════════════════════════

/**
 * Construye los controles de composición (sliders) y el control de humedad
 * en el panel [data-container="inputs"].
 *
 * Cada slider tiene:
 *  - data-component="X"  para composición base seca
 *  - data-role="slider"
 *
 * El slider de humedad tiene:
 *  - data-humidity="true"
 *  - data-role="slider"
 *
 * @param {object} composition  - { C, H, O, N, S, Z } valores iniciales
 * @param {number} humidity     - valor inicial de humedad
 */
export function renderSliders(composition, humidity) {
    const container = qs('[data-container="inputs"]');
    if (!container) {
        console.warn('[dom.js] renderSliders: [data-container="inputs"] no encontrado en el DOM. Asegúrate de que el contenedor exista.');
        return; // Fail safely
    }

    container.innerHTML = '';

    // ── Composición base seca ──────────────────────────
    const compSection = document.createElement('div');
    compSection.style.marginBottom = 'var(--space-6)';

    const compTitle = document.createElement('h3');
    compTitle.style.fontSize = 'var(--font-size-sm)';
    compTitle.style.fontWeight = 'var(--font-weight-bold)';
    compTitle.style.marginBottom = 'var(--space-4)';
    compTitle.style.color = 'var(--text-primary)';
    compTitle.textContent = 'Dry-Basis Composition';
    compSection.appendChild(compTitle);

    // Suma restante (ayuda visual)
    const sumRow = document.createElement('div');
    sumRow.className = 'comb-sum-row';
    sumRow.innerHTML = `
        <span class="comb-sum-label">Total</span>
        <span class="comb-sum-value" data-sum-display>100.0 %</span>
    `;
    compSection.appendChild(sumRow);

    COMPONENT_META.forEach(meta => {
        const field = _buildComponentField(meta, composition[meta.key] ?? 0);
        compSection.appendChild(field);
    });

    container.appendChild(compSection);

    // ── Humedad ─────────────────────────────────────────
    const humSection = document.createElement('div');

    const humTitle = document.createElement('h3');
    humTitle.style.fontSize = 'var(--font-size-sm)';
    humTitle.style.fontWeight = 'var(--font-weight-bold)';
    humTitle.style.marginBottom = 'var(--space-4)';
    humTitle.style.color = 'var(--text-primary)';
    humTitle.textContent = 'Fuel Moisture';
    humSection.appendChild(humTitle);

    const humField = _buildHumidityField(humidity);
    humSection.appendChild(humField);

    container.appendChild(humSection);
}


// ═══════════════════════════════════════════════
//  _buildComponentField()  — Interno
//  Construye un campo slider para un componente.
// ═══════════════════════════════════════════════

/**
 * @param {{ key, label, symbol, color, info }} meta
 * @param {number} value  - Valor inicial
 * @returns {HTMLElement}
 */
function _buildComponentField(meta, value) {
    const field = document.createElement('div');
    field.className = 'sim-field comb-comp-field';

    // Cabecera: etiqueta + valor + unidad
    const header = document.createElement('div');
    header.className = 'sim-field__header';

    const label = document.createElement('label');
    label.className = 'sim-label';
    label.htmlFor = `sl-${meta.key}`;
    label.innerHTML = `
        <span class="comb-symbol" style="--comp-color: ${meta.color}">${meta.symbol}</span>
        ${meta.label}
        <span class="info-tooltip" tabindex="0" aria-label="Information" data-tooltip="${meta.info}">ⓘ</span>
    `;

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'sim-unit comb-value-display';
    valueDisplay.dataset.componentValue = meta.key;
    valueDisplay.textContent = `${fmt(value)} %`;

    header.appendChild(label);
    header.appendChild(valueDisplay);

    // Slider
    const slider = document.createElement('input');
    slider.id = `sl-${meta.key}`;
    slider.type = 'range';
    slider.className = 'sim-slider comb-slider';
    slider.dataset.component = meta.key;
    slider.dataset.role = 'slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '0.1';
    slider.value = String(value);
    slider.style.setProperty('--slider-color', meta.color);

    if (meta.key === 'Z') {
        slider.disabled = true;
        slider.style.cursor = 'not-allowed';
        slider.style.opacity = '0.6';
        field.classList.add('comb-comp-field--readonly');
    }

    const inputWrap = document.createElement('div');
    inputWrap.className = 'sim-input-wrap';
    inputWrap.appendChild(slider);

    field.appendChild(header);
    field.appendChild(inputWrap);

    return field;
}


// ═══════════════════════════════════════════════
//  _buildHumidityField()  — Interno
// ═══════════════════════════════════════════════

/**
 * @param {number} value  - Valor inicial de humedad
 * @returns {HTMLElement}
 */
function _buildHumidityField(value) {
    const field = document.createElement('div');
    field.className = 'sim-field';

    const header = document.createElement('div');
    header.className = 'sim-field__header';

    const label = document.createElement('label');
    label.className = 'sim-label';
    label.htmlFor = 'sl-humidity';
    label.textContent = 'Moisture (Hu)';

    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'sim-unit comb-value-display';
    valueDisplay.dataset.humidityValue = 'true';
    valueDisplay.textContent = `${fmt(value)} %`;

    header.appendChild(label);
    header.appendChild(valueDisplay);

    const slider = document.createElement('input');
    slider.id = 'sl-humidity';
    slider.type = 'range';
    slider.className = 'sim-slider comb-slider comb-slider--humidity';
    slider.dataset.humidity = 'true';
    slider.dataset.role = 'slider';
    slider.min = '0';
    slider.max = '80';
    slider.step = '0.5';
    slider.value = String(value);

    // Nota pedagógica
    const note = document.createElement('p');
    note.className = 'comb-field-note';
    note.textContent = 'Hu = 0 → dry basis   |   Hu > 0 → dilutes the fuel';

    const inputWrap = document.createElement('div');
    inputWrap.className = 'sim-input-wrap';
    inputWrap.appendChild(slider);

    field.appendChild(header);
    field.appendChild(inputWrap);
    field.appendChild(note);

    return field;
}


// ═══════════════════════════════════════════════
//  updateSliderDisplay()
//  Actualiza visualmente un slider tras recalcular.
//  Evita feedback loops: solo actualiza .value y label.
// ═══════════════════════════════════════════════

/**
 * Actualiza el atributo value de un slider de composición
 * y su etiqueta de valor, sin disparar eventos.
 *
 * @param {string} key    - Componente: 'C'|'H'|'O'|'N'|'S'|'Z'
 * @param {number} value  - Nuevo valor en %
 */
export function updateSliderDisplay(key, value) {
    const slider = qs(`[data-component="${key}"]`);
    if (slider) slider.value = String(value);

    const display = qs(`[data-component-value="${key}"]`);
    if (display) display.textContent = `${fmt(value)} %`;
}

/**
 * Actualiza visualmente el slider y etiqueta de humedad.
 * @param {number} value
 */
export function updateHumidityDisplay(value) {
    const slider = qs('[data-humidity="true"]');
    if (slider) slider.value = String(value);

    const display = qs('[data-humidity-value]');
    if (display) display.textContent = `${fmt(value)} %`;
}


// ═══════════════════════════════════════════════
//  updateSumDisplay()
//  Muestra la suma actual de la base seca (debe = 100).
// ═══════════════════════════════════════════════

/**
 * @param {number} sum
 */
export function updateSumDisplay(sum) {
    const el = qs('[data-sum-display]');
    if (!el) return;

    el.textContent = `${fmt(sum)} %`;
    el.className = Math.abs(sum - 100) < 0.1
        ? 'comb-sum-value comb-sum-value--ok'
        : 'comb-sum-value comb-sum-value--error';
}


// ═══════════════════════════════════════════════
//  renderBasisBanner()
//  Banner que indica si el combustible está en
//  base seca o base húmeda.
// ═══════════════════════════════════════════════

/**
 * @param {{ basis: 'dry'|'wet', humidity: number }} fuelState
 */
export function renderBasisBanner(fuelState) {
    const el = qs('[data-basis-banner]');
    if (!el) return;

    if (fuelState.basis === 'dry') {
        el.className = 'comb-basis-banner comb-basis-banner--dry';
        el.innerHTML = `
            <span class="comb-basis-icon">◎</span>
            <span><strong>Dry basis</strong> — Hu = 0 %</span>
        `;
    } else {
        el.className = 'comb-basis-banner comb-basis-banner--wet';
        el.innerHTML = `
            <span class="comb-basis-icon">💧</span>
            <span>
                <strong>Wet basis</strong> — Hu = ${fmt(fuelState.humidity)} %
                &nbsp;·&nbsp; Moisture <em>dilutes</em> the fuel.
            </span>
        `;
    }
}


// ═══════════════════════════════════════════════
//  renderDryBasis()
//  Actualiza la columna de base seca en el panel
//  de resultados (tabla de composición).
// ═══════════════════════════════════════════════

/**
 * @param {{ C, H, O, N, S, Z }} dryComp
 */
export function renderDryBasis(dryComp) {
    COMPONENT_META.forEach(meta => {
        const el = qs(`[data-dry="${meta.key}"]`);
        if (el) el.textContent = `${fmt(dryComp[meta.key])} %`;
    });

    const sumEl = qs('[data-dry="sum"]');
    const sum = Object.values(dryComp).reduce((a, v) => a + v, 0);
    if (sumEl) sumEl.textContent = `${fmt(sum)} %`;
}


// ═══════════════════════════════════════════════
//  renderWetBasis()
//  Actualiza la columna de base húmeda en el panel
//  de resultados.
// ═══════════════════════════════════════════════

/**
 * @param {{ valid: boolean, wet: object, waterFraction: number, sumWet: number, humidity: number }} fuelState
 */
export function renderWetBasis(fuelState) {
    if (!fuelState || !fuelState.valid) return;

    const { wet, waterFraction, sumWet, humidity } = fuelState;

    COMPONENT_META.forEach(meta => {
        const el = qs(`[data-wet="${meta.key}"]`);
        if (el) el.textContent = `${fmt(wet[meta.key])} %`;
    });

    const waterEl = qs('[data-wet="water"]');
    if (waterEl) waterEl.textContent = `${fmt(waterFraction)} %`;

    const sumEl = qs('[data-wet="sum"]');
    if (sumEl) sumEl.textContent = `${fmt(sumWet + waterFraction)} %`;

    // Resalta la columna húmeda solo si Hu > 0
    const wetCol = qsa('[data-wet-col]');
    wetCol.forEach(el => {
        el.classList.toggle('comb-col--active', humidity > 0);
        el.classList.toggle('comb-col--inactive', humidity === 0);
    });

    // FASE 2 — Renderizado de Poderes Caloríficos
    if (fuelState.heating) {
        renderHeatingValues(fuelState.heating);
    }
}


// ═══════════════════════════════════════════════
//  renderHeatingValues()
//  Actualiza la tarjeta de la FASE 2 con los
//  resultados de PCS, PCI y delta.
// ═══════════════════════════════════════════════

/**
 * @param {object} heating - Objeto con PCS, PCI, y delta (soporta diferentes estructuras de estado)
 */
export function renderHeatingValues(heating) {
    const kpiContainer = document.getElementById('kpi-calorifico');
    if (!kpiContainer) return;

    // Estado inicial / Datos inválidos
    if (!heating) {
        kpiContainer.innerHTML = `
            <div class="resultado-principal__message">
                Adjust parameters to calculate heating value
            </div>
        `;
        return;
    }

    // Extraer propiedades (soportar tanto formato plano como anidado en results/heating)
    const pcs = heating.PCS ?? heating.pcs ?? heating.results?.pcs ?? heating.heating?.PCS;
    const pci = heating.PCI ?? heating.pci ?? heating.results?.pci ?? heating.heating?.PCI;
    const delta = heating.delta ?? heating.results?.delta ?? heating.heating?.delta;

    // Validación de valores
    const isValidPCS = pcs != null && !isNaN(pcs) && pcs > 0;
    const isValidPCI = pci != null && !isNaN(pci) && pci > 0;

    if (!isValidPCS && !isValidPCI) {
        kpiContainer.innerHTML = `
            <div class="resultado-principal__message">
                Adjust parameters to calculate heating value
            </div>
        `;
        return;
    }

    const pcsFormatted = isValidPCS ? pcs.toFixed(1) : '--';
    const pciFormatted = isValidPCI ? pci.toFixed(1) : '--';
    const deltaFormatted = (delta != null && !isNaN(delta)) ? delta.toFixed(1) : '--';

    // Renderizado de resultados con jerarquía y tooltip
    kpiContainer.innerHTML = `
        <div class="resultado-principal__title">
            🔥 Heating Value
            <span class="info-tooltip" tabindex="0" aria-label="Information" 
                  data-tooltip="HHV includes the latent heat of water condensation, whereas LHV does not.">ⓘ</span>
        </div>
        <div class="resultado-principal__values">
            <div class="resultado-principal__kpi">
                <span class="resultado-principal__label">HHV (Higher)</span>
                <div class="resultado-principal__value resultado-principal__value--pcs">
                    ${pcsFormatted}<span class="resultado-principal__unit">MJ/kg</span>
                </div>
            </div>
            <div class="resultado-principal__kpi">
                <span class="resultado-principal__label">LHV (Lower)</span>
                <div class="resultado-principal__value resultado-principal__value--pci">
                    ${pciFormatted}<span class="resultado-principal__unit">MJ/kg</span>
                </div>
            </div>
        </div>
        <div class="resultado-principal__diff">
            Δ = ${deltaFormatted} MJ/kg (energy lost to water vapor)
        </div>
    `;
}


function animateValue(element, start, end, duration, decimals = 1, suffix = "") {
    if (!element) return;

    // 🛑 Validación inicial
    if (end == null || isNaN(end)) {
        console.warn('[animation] end inválido', { end });
        element.textContent = '--';
        return;
    }

    // 🛠 Normalización
    start = (start == null || isNaN(start)) ? 0 : start;

    console.log(`[ANIM START] ${element.dataset.pro || 'field'}: ${start.toFixed(2)} -> ${end.toFixed(2)}`);

    if (element._rafId) {
        cancelAnimationFrame(element._rafId);
    }

    if (Math.abs(start - end) < 0.005) {
        element.textContent = `${end.toFixed(decimals)}${suffix}`;
        return;
    }

    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);

        progress = 1 - Math.pow(1 - progress, 3);

        const current = start + (end - start) * progress;

        if (isNaN(current)) {
            element.textContent = '--';
            return;
        }

        element.textContent = `${current.toFixed(decimals)}${suffix}`;

        if (progress < 1) {
            element._rafId = requestAnimationFrame(update);
        } else {
            element._rafId = null;
        }
    }

    element._rafId = requestAnimationFrame(update);
}

// ═══════════════════════════════════════════════
//  renderProSection()
//  Ciclo de vida optimizado: No re-render, No re-animación.
// ═══════════════════════════════════════════════

/**
 * @param {object} state - Estado completo del combustible
 */
export function renderProSection(state = {}) {
    // ── 1. Optimizador λ ─────────────
    const energyContainer = qs('#pro-energy-breakdown-container');
    if (energyContainer && energyContainer.dataset.initialized !== "true") {
        energyContainer.innerHTML = `
            <div class="sim-card">
                <div class="sim-card__header">
                    <h2 class="sim-card__title">⚖️ Optimizer λ</h2>
                </div>
                <div class="sim-card__body">
                    [Optimization Algorithm Active]
                </div>
            </div>
        `;
        energyContainer.dataset.initialized = "true";
    }

    // ── 2. Mezclador Multicombustible ─────────────
    const comparatorContainer = qs('#pro-fuel-comparator-container');
    if (comparatorContainer && comparatorContainer.dataset.initialized !== "true") {
        comparatorContainer.innerHTML = `
            <div class="sim-card">
                <div class="sim-card__header">
                    <h2 class="sim-card__title">🚀 Engineering Mixer</h2>
                </div>
                <div class="sim-card__body">
                    [Parallel Mix Panel Active]
                </div>
            </div>
        `;
        comparatorContainer.dataset.initialized = "true";
    }

    // ── 3. Radar de Sensibilidad ────────────
    const radarContainer = qs('#pro-sensitivity-radar-container');
    if (radarContainer && radarContainer.dataset.initialized !== "true") {
        radarContainer.innerHTML = `
            <div class="sim-card">
                <div class="sim-card__header">
                    <h2 class="sim-card__title">🌪️ Sensitivity Radar</h2>
                </div>
                <div class="sim-card__body">
                    [Tornado Chart Active]
                </div>
            </div>
        `;
        radarContainer.dataset.initialized = "true";
    }

    // ── 4. Solucionador Inverso ────────────
    const solverContainer = qs('#pro-reverse-solver-container');
    if (solverContainer && solverContainer.dataset.initialized !== "true") {
        solverContainer.innerHTML = `
            <div class="sim-card">
                <div class="sim-card__header">
                    <h2 class="sim-card__title">🔄 Reverse Solver</h2>
                </div>
                <div class="sim-card__body">
                    [Constraint-Based Solver Active]
                </div>
            </div>
        `;
        solverContainer.dataset.initialized = "true";
    }

    // ── 5. Exportador de Reportes ────────────
    const reportContainer = qs('#pro-report-exporter-container');
    if (reportContainer && reportContainer.dataset.initialized !== "true") {
        reportContainer.innerHTML = `
            <div class="sim-card">
                <div class="sim-card__header">
                    <h2 class="sim-card__title">📄 Report Generator</h2>
                </div>
                <div class="sim-card__body">
                    <button class="sim-btn sim-btn--primary">Download PDF Report</button>
                </div>
            </div>
        `;
        reportContainer.dataset.initialized = "true";
    }

    // ── 6. Bloque Condiciones Reales ──────────────────
    const container = qs('[data-container="pro-section"]');
    if (!container) return;

    const {
        temperature = 298.15,
        pressure = 101325,
        air = {},
        airRealConditions = {}
    } = state;

    const isInitialized = container.dataset.initialized === "true";

    if (!isInitialized) {
        container.innerHTML = `
            <div class="sim-card comb-pro-card">
                <div class="sim-chart-card__header">
                    <h2 class="sim-chart-card__title">
                        System Real Conditions
                    </h2>
                </div>
                <div class="comb-pro-content">
                    <div class="comb-pro-grid">
                        <div class="comb-pro-controls">
                            <div class="sim-field">
                                <label class="sim-field__label">
                                    Temperature (T)
                                    <span class="info-tooltip" tabindex="0" aria-label="Information" data-tooltip="Working gas temperature. This simulator assumes air as an ideal gas.">ⓘ</span>
                                </label>
                                <input type="range" class="sim-slider" data-pro-slider="temperature" 
                                       min="273" max="350" step="1" value="${temperature}">
                                <div class="comb-pro-val-row" style="margin-top:5px">
                                    <span class="comb-pro-val-number" data-pro="temperature">--</span>
                                    <span class="comb-pro-delta" data-pro="temp-delta">Δ 0.0</span>
                                </div>
                            </div>
                            <div class="sim-field">
                                <label class="sim-field__label">
                                    Pressure (P)
                                    <span class="info-tooltip" tabindex="0" aria-label="Information" data-tooltip="Air pressure before the combustion process.">ⓘ</span>
                                </label>
                                <input type="range" class="sim-slider" data-pro-slider="pressure" 
                                       min="80000" max="120000" step="100" value="${pressure}">
                                <div class="comb-pro-val-row" style="margin-top:5px">
                                    <span class="comb-pro-val-number" data-pro="pressure">--</span>
                                    <span class="comb-pro-delta" data-pro="pres-delta">Δ 0</span>
                                </div>
                            </div>
                        </div>
                        <div class="comb-pro-results">
                            <div class="comb-pro-value-box">
                                <div class="comb-pro-val-label">
                                    Air-fuel ratio
                                    <span class="info-tooltip" tabindex="0" aria-label="Information" data-tooltip="Ratio between air and fuel mass. Determines combustion efficiency and temperature.">ⓘ</span>
                                </div>
                                <div class="comb-pro-val-number" data-pro-display="air_mass">0.0</div>
                                <div class="sim-field__unit">kg/kg_fuel</div>
                            </div>
                            <div class="comb-pro-value-box" style="margin-top:10px">
                                <div class="comb-pro-val-label">Volumetric consumption</div>
                                <div class="comb-pro-val-number" data-pro-display="air_volume">0.0</div>
                                <div class="sim-field__unit">m³/kg_fuel</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.dataset.initialized = "true";
    }

    // 3. CONTROL DE ANIMACIÓN Y DELTAS
    const currentTC = temperature - 273.15;
    const currentPkPa = pressure / 1000;

    const tempEl = container.querySelector('[data-pro="temperature"]');
    const presEl = container.querySelector('[data-pro="pressure"]');
    const currentStoredT = parseFloat(container.dataset.currentTC);
    const currentStoredP = parseFloat(container.dataset.currentPkPa);

    if (!tempEl || !presEl) return;

    // PRIMER RENDER → sin animación
    if (isNaN(currentStoredT)) {
        tempEl.textContent = currentTC.toFixed(1) + " °C";
        container.dataset.currentTC = currentTC;
    } else {
        const diffT = Math.abs(currentStoredT - currentTC);
        if (diffT > 0.05) {
            animateValue(tempEl, currentStoredT, currentTC, 400, 1, " °C");
            container.dataset.currentTC = currentTC;
        }
    }

    if (isNaN(currentStoredP)) {
        presEl.textContent = currentPkPa.toFixed(1) + " kPa";
        container.dataset.currentPkPa = currentPkPa;
    } else {
        const diffP = Math.abs(currentStoredP - currentPkPa);
        if (diffP > 0.1) {
            animateValue(presEl, currentStoredP, currentPkPa, 400, 1, " kPa");
            container.dataset.currentPkPa = currentPkPa;
        }
    }

    const lastTC = parseFloat(container.dataset.lastTC) ?? currentTC;
    const lastPkPa = parseFloat(container.dataset.lastPkPa) ?? currentPkPa;

    const elDT = container.querySelector('[data-pro="temp-delta"]');
    const elDP = container.querySelector('[data-pro="pres-delta"]');

    if (elDT) {
        const deltaT = currentTC - lastTC;
        elDT.textContent = `Δ ${deltaT > 0 ? '+' : ''}${deltaT.toFixed(1)}`;
        elDT.style.color = Math.abs(deltaT) > 0.05 ? 'var(--color-primary-light)' : 'transparent';
    }

    const elAM = container.querySelector('[data-pro-display="air_mass"]');
    const elAV = container.querySelector('[data-pro-display="air_volume"]');
    if (elAM) elAM.textContent = (air?.air_real ?? 0).toFixed(2);
    if (elAV) elAV.textContent = (airRealConditions?.air_volume_real ?? 0).toFixed(2);

    container.dataset.lastTC = currentTC;
    container.dataset.lastPkPa = currentPkPa;
}

// ═══════════════════════════════════════════════
//  renderError()
//  Muestra / limpia el mensaje de error.
/**
 * Renderiza los resultados del barrido de parámetros (Modo Exploración).
 * @param {Array<{x, y}>} data - Resultados del barrido
 * @param {boolean} enabled - Si el modo está activo
 */
export function updateExploration(data, enabled) {
    const el = document.getElementById("explorationContainer");
    if (!el) return;

    if (!enabled || !data || data.length === 0) {
        el.style.display = "none";
        return;
    }

    el.style.display = "block";
    el.innerHTML = `
        <div class="tutor-card" style="border-left-color: var(--color-success);">
            <div class="tutor-card__header">
                <span>🔎</span>
                <span>Exploration: Mixture Sensitivity</span>
            </div>
            <div class="tutor-card__body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-family: var(--font-mono); font-size: 0.75rem;">
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">A/F Ratio</div>
                <div style="font-weight: bold; border-bottom: 1px solid var(--border-color);">Efficiency</div>
                ${data.map(p => `
                    <div>${p.x.toFixed(2)}</div>
                    <div style="color: var(--color-success);">${(p.y * 100).toFixed(1)} %</div>
                `).join("")}
            </div>
            <div class="tutor-card__footer">
                Theoretical variation of efficiency as a function of excess air.
            </div>
        </div>
    `;
}


// ═══════════════════════════════════════════════

/**
 * @param {string|null} msg  - null o '' para limpiar
 */
export function renderError(msg) {
    const el = qs('[data-output="main"]');
    if (!el) return;
    el.textContent = msg ?? '';
}


// ═══════════════════════════════════════════════
//  bindSliderEvents()
//  Cableado de eventos. Se llama UNA VEZ en bootstrap.
//  Usa event delegation para eficiencia.
// ═══════════════════════════════════════════════

/**
 * Registra listeners en el panel de inputs.
 *
 * @param {function(key: string, value: number): void} onComponentChange
 *        Callback disparado al mover un slider de composición
 *
 * @param {function(value: number): void} onHumidityChange
 *        Callback disparado al mover el slider de humedad
 */
export function bindSliderEvents(onComponentChange, onHumidityChange) {
    const inputsPanel = qs('[data-container="inputs"]');
    if (!inputsPanel) return;

    // 1. Sliders de Composición y Humedad (Fase 1)
    inputsPanel.addEventListener('input', e => {
        const target = e.target;
        if (target.tagName !== 'INPUT' || target.type !== 'range') return;

        if (target.dataset.humidity === 'true') {
            const val = parseFloat(target.value) || 0;
            const display = qs('[data-humidity-value]');
            if (display) display.textContent = `${fmt(val)} %`;
            onHumidityChange(val);
        } else if (target.dataset.component) {
            const key = target.dataset.component;
            const val = parseFloat(target.value) || 0;
            onComponentChange(key, val);
        }
    });

    // 2. Sliders PRO (Versión Tactil y Segura)
    const proSection = qs('[data-container="pro-section"]');
    if (proSection) {
        proSection.addEventListener('input', e => {
            const target = e.target;
            const type = target.dataset.proSlider;
            if (!type) return;

            const val = parseFloat(target.value);

            //if (type === 'temperature') {
            //    const tempEl = proSection.querySelector('[data-pro="temperature"]');
            //    const currentTC = val - 273.15;

            // 1. Actualización INSTANTÁNEA (sin animación para que no rebote)
            // Esto quita la sensación de "lag" o valores raros
            //    tempEl.textContent = `${currentTC.toFixed(1)} °C`;

            // 2. Guardamos el target para que renderProSection no intente animar encima
            //    proSection.dataset.targetTC = currentTC;

            // 3. Avisamos al simulador (en Kelvin)
            //    window.dispatchEvent(new CustomEvent('pro:temp', { detail: val }));
            //}

            // Dentro de bindSliderEvents...
            if (type === 'temperature') {
                const tempEl = proSection.querySelector('[data-pro="temperature"]');
                const valC = val - 273.15;
                tempEl.textContent = `${valC.toFixed(1)} °C`; // Actualización manual rápida
                window.dispatchEvent(new CustomEvent('pro:temp', { detail: val }));
            }

            if (type === 'pressure') {
                const presEl = proSection.querySelector('[data-pro="pressure"]');
                const currentPkPa = val / 1000;
                presEl.textContent = `${currentPkPa.toFixed(1)} kPa`;
                window.dispatchEvent(new CustomEvent('pro:press', { detail: val }));
            }
        });
    }
}


/**
 * Inicializa los componentes colapsables del simulador.
 * Permite alternar la visibilidad de secciones técnicas para reducir carga visual.
 */
export function setupCollapsibles() {
    qsa('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const parent = header.closest('.collapsible');
            if (parent) {
                parent.classList.toggle('open');
            }
        });
    });
}