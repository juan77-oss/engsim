/**
 * balanceador-ui.js — UI Module for Equation Balancer
 * ─────────────────────────────────────────────────────
 * PURPOSE : Pure DOM manipulation. Zero business logic.
 * PLATFORM: EngSim (engsim.app)
 *
 * CLASS MAP (old IEM → new EngSim):
 *   .alert-error          → .sim-error + .is-visible  (global platform component)
 *   .count-pill           → .count-pill        (unchanged, defined in custom CSS)
 *   .pill-balanced/etc.   → unchanged
 *   .molecule-group       → unchanged
 *   .step-card            → .bal-step-card
 *   .step-marker          → .bal-step-marker
 *   .step-header          → .bal-step-header
 *   .step-icon            → .bal-step-icon
 *   .step-title           → .bal-step-title
 *   .step-body            → .bal-step-body
 *   .example-btn          → .bal-example-btn
 *   .example-title        → .bal-example-title
 *   .example-formula      → .bal-example-formula
 *   .example-meta         → .bal-example-meta
 *   .example-diff         → .bal-example-diff
 *   .topic-filters-wrapper→ .bal-topic-filters
 *   .filter-chip          → .bal-filter-chip
 *   .feedback-correct     → .bal-feedback-correct
 *   .feedback-incorrect   → .bal-feedback-incorrect
 *   .training-grid        → .bal-training-grid (defined in custom CSS)
 *   .training-input-group → .training-input-group (unchanged)
 *   .training-coeff-input → .training-coeff-input (unchanged)
 */

import { formatFormula, formatEquation } from './balanceador-core.js';

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function showError(message, container) {
    if (!container) return;
    container.innerHTML = `<span>⚠️</span><span>${message}</span>`;
    container.classList.add('is-visible');

    // Shake the input wrap to draw attention
    const wrap = document.getElementById('equation-input-wrap');
    if (wrap) {
        wrap.classList.remove('sim-input--invalid');
        // Force reflow so the animation re-triggers if shown again
        void wrap.offsetWidth;
        wrap.classList.add('sim-input--invalid');
    }
}

export function hideError(container) {
    if (!container) return;
    container.classList.remove('is-visible');
    container.innerHTML = '';

    // Remove invalid state from the input wrap
    const wrap = document.getElementById('equation-input-wrap');
    if (wrap) wrap.classList.remove('sim-input--invalid');
}

export function clearContainer(container) {
    if (container) container.innerHTML = '';
}

// ─────────────────────────────────────────────────────────────────────────────
//  COUNT TABLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renders the atomic count table.
 * @param {Array<{elemento, reactivos, productos, estado}>} tableData
 * @param {HTMLElement} tbodyElement
 */
export function renderCountTable(tableData, tbodyElement) {
    if (!tbodyElement) return;

    tbodyElement.innerHTML = tableData.map(row => {
        let pillClass = 'pill-unbalanced';
        let statusText = 'Unbalanced';

        if (row.estado === 'balanced') {
            pillClass = 'pill-balanced';
            statusText = 'Balanced';
        } else if (row.estado === 'excess-left') {
            pillClass = 'pill-excess';
            statusText = 'Excess Reactants';
        } else if (row.estado === 'excess-right') {
            pillClass = 'pill-excess';
            statusText = 'Excess Products';
        }

        return `
            <tr>
                <td>${row.elemento}</td>
                <td>${row.reactivos}</td>
                <td>${row.productos}</td>
                <td><span class="count-pill ${pillClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
//  EQUATION DISPLAY & MOLECULAR VIEW
// ─────────────────────────────────────────────────────────────────────────────

export function renderEquationDisplay(equationStr, container) {
    if (!container) return;
    container.innerHTML = equationStr;
}

const ATOM_STYLE = {
    'H': { radius: 8, cls: 'atom-h' },
    'C': { radius: 12, cls: 'atom-c' },
    'N': { radius: 11, cls: 'atom-n' },
    'O': { radius: 10, cls: 'atom-o' },
    'S': { radius: 14, cls: 'atom-s' },
    'Cl': { radius: 13, cls: 'atom-cl' },
    'Fe': { radius: 15, cls: 'atom-fe' },
    'Al': { radius: 14, cls: 'atom-al' },
    'DEFAULT': { radius: 12, cls: 'atom-default' },
};

/**
 * Renders SVG molecular representation.
 * @param {{ reactants: object[], products: object[] }} parsedEquation
 * @param {HTMLElement} container
 */
export function renderMolecularView(parsedEquation, container) {
    if (!container) return;

    const renderSide = (speciesList) => {
        let html = '';
        speciesList.forEach((species, i) => {
            if (i > 0) {
                html += `<div style="font-weight:700; font-size:1.2rem; color:var(--text-muted)">+</div>`;
            }

            const coeff = species.coeff || 1;
            const atomsHtml = Object.entries(species.elements).map(([el, count]) => {
                const style = ATOM_STYLE[el] || ATOM_STYLE['DEFAULT'];
                let circles = '';
                for (let k = 0; k < count; k++) {
                    circles += `<circle cx="${15 + k * 20}" cy="15" r="${style.radius}" class="atom-circle ${style.cls}" stroke-width="2" />`;
                }
                return `<svg width="${15 + count * 20 + 10}" height="30" class="atom-svg" title="${el}">${circles}</svg>`;
            }).join('');

            html += `
                <div class="molecule-group">
                    <span class="molecule-coeff">${coeff > 1 ? coeff : ''}</span>
                    <div style="display:flex; align-items:center; gap:2px;">${atomsHtml}</div>
                </div>
            `;
        });
        return html;
    };

    container.innerHTML =
        renderSide(parsedEquation.reactants) +
        `<div style="font-weight:700; font-size:1.3rem; margin:0 8px; color:var(--brand-accent)">→</div>` +
        renderSide(parsedEquation.products);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TIMELINE (LEARNING MODE)
// ─────────────────────────────────────────────────────────────────────────────

export function renderTimeline(steps, container) {
    if (!container) return;

    container.innerHTML = steps.map((step, idx) => `
        <div class="bal-step-card" id="step-card-${idx}">
            <div class="bal-step-marker">${step.index}</div>
            <div class="bal-step-header">
                <span class="bal-step-icon">${step.icono}</span>
                <h3 class="bal-step-title">${step.titulo}</h3>
            </div>
            <div class="bal-step-body">
                ${step.explicacion}
            </div>
        </div>
    `).join('');
}

export function advanceTimeline(currentStepIndex, totalSteps) {
    for (let i = 0; i < totalSteps; i++) {
        const card = document.getElementById(`step-card-${i}`);
        if (!card) continue;
        card.classList.remove('active', 'completed');
        if (i < currentStepIndex) {
            card.classList.add('completed');
        } else if (i === currentStepIndex) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXAMPLES PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function renderTopicFilters(topics, container, onChangeCallback) {
    if (!container) return;

    // Remove existing wrapper if present
    const existing = container.querySelector('.bal-topic-filters');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'bal-topic-filters';

    wrapper.addEventListener('click', (e) => {
        const chip = e.target.closest('.bal-filter-chip');
        if (!chip) return;
        wrapper.querySelectorAll('.bal-filter-chip').forEach(b => b.classList.remove('active'));
        chip.classList.add('active');
        onChangeCallback(chip.dataset.topic);
    });

    wrapper.innerHTML = `
        <button class="bal-filter-chip active" data-topic="all">All</button>
        ${topics.map(t => `
            <button class="bal-filter-chip" data-topic="${t}">
                ${t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
        `).join('')}
    `;

    // Insert before the examples container
    container.parentElement.insertBefore(wrapper, container);
}

export function renderExamples(examples, container) {
    if (!container) return;

    container.innerHTML = examples.map(ex => `
        <button class="bal-example-btn" data-id="${ex.id}">
            <div class="bal-example-title">${ex.label}</div>
            <div class="bal-example-formula">${ex.subtitle}</div>
            <div class="bal-example-meta">
                <span class="bal-example-diff">Level: ${ex.difficultyScore}</span>
            </div>
        </button>
    `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRAINING PANEL
// ─────────────────────────────────────────────────────────────────────────────

export function renderTrainingPanel(parsedEquation, container) {
    if (!container) return;

    const renderInputs = (speciesList, side) =>
        speciesList.map(species => `
            <div class="training-input-group">
                <input type="number" min="1" class="training-coeff-input"
                       data-formula="${species.formula}" data-side="${side}"
                       value="${species.coeff || 1}">
                <span>${formatFormula(species.formula)}</span>
            </div>
        `).join(`<span style="margin:0 8px; font-weight:700; color:var(--text-muted);">+</span>`);

    container.innerHTML =
        renderInputs(parsedEquation.reactants, 'reactants') +
        `<div style="font-weight:700; font-size:1.3rem; margin:0 12px; color:var(--brand-accent)">→</div>` +
        renderInputs(parsedEquation.products, 'products');
}

export function showTrainingFeedback(feedbackObj, container) {
    if (!container) return;

    const cls = feedbackObj.status === 'correct' ? 'bal-feedback-correct' : 'bal-feedback-incorrect';
    const icon = feedbackObj.status === 'correct' ? '✅' : '❌';

    container.innerHTML = `
        <div class="bal-feedback-panel ${cls}">
            <strong>${icon} ${feedbackObj.message}</strong>
            ${feedbackObj.hint ? `<div class="feedback-hint">💡 ${feedbackObj.hint}</div>` : ''}
            ${feedbackObj.nextSuggestion ? `<div style="margin-top:8px; font-weight:700;">➡️ ${feedbackObj.nextSuggestion}</div>` : ''}
        </div>
    `;
    container.style.display = 'block';
}

export function hideTrainingFeedback(container) {
    if (!container) return;
    container.style.display = 'none';
    container.innerHTML = '';
}