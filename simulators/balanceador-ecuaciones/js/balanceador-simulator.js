/**
 * balanceador-simulator.js — Orchestrator for Equation Balancer
 * ──────────────────────────────────────────────────────────────
 * PURPOSE : Wires DOM events to core logic and UI rendering.
 *           Manages global state (current mode, equation, steps).
 * PLATFORM: EngSim (engsim.app)
 *
 * CHANGES FROM IEM VERSION:
 *   - Error display: uses #sim-error (.sim-error) for fatal/parse
 *     errors shown above the layout; #input-error (.sim-error +
 *     .is-visible) for inline field validation.
 *   - No more cacheDOM().DOM.emptyState reference to a .card —
 *     now targets .bal-empty-state.
 *   - Example click handler now matches .bal-example-btn.
 *   - Import paths updated: core and ui are siblings in ./js/.
 */

'use strict';

import {
    parseEquation,
    formatEquation,
    generateEducationalSteps,
    BANK_EXAMPLES,
    buildCountTable,
    isBalanced,
    detectErrors,
    getAllTopics,
    getExamplesByTopic,
} from './balanceador-core.js';

import * as UI from './balanceador-ui.js';

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL STATE
// ─────────────────────────────────────────────────────────────────────────────
const STATE = {
    mode: 'aprendizaje',   // 'aprendizaje' | 'entrenamiento'
    rawInput: '',
    parsedInput: null,
    stepsData: null,
    currentStep: 0,
    trainingState: null,
    previousTrainingState: null,
};

// ─────────────────────────────────────────────────────────────────────────────
//  DOM CACHE
// ─────────────────────────────────────────────────────────────────────────────
const DOM = {};

function cacheDOM() {
    // Mode tabs
    DOM.modeTabs = document.querySelectorAll('.bal-tab-btn');

    // Input
    DOM.equationInput = document.getElementById('equation-input');
    DOM.btnAnalyze = document.getElementById('btn-calculate');
    DOM.inputError = document.getElementById('input-error');   // inline field error
    DOM.simError = document.getElementById('sim-error');     // platform-level error bar

    // Exercise bank
    DOM.examplesContainer = document.getElementById('examples-container');

    // State panels
    DOM.emptyState = document.getElementById('empty-state');
    DOM.resultsContainer = document.getElementById('results-container');

    // Shared display
    DOM.equationDisplay = document.getElementById('equation-display');
    DOM.molecularView = document.getElementById('molecular-view');
    DOM.countTableBody = document.querySelector('#count-table tbody');

    // Learning mode
    DOM.learningView = document.getElementById('learning-view');
    DOM.stepsTimeline = document.getElementById('steps-timeline');
    DOM.btnPrevStep = document.getElementById('btn-prev-step');
    DOM.btnNextStep = document.getElementById('btn-next-step');
    DOM.stepCounter = document.getElementById('step-counter');

    // Training mode
    DOM.trainingView = document.getElementById('training-view');
    DOM.trainingInputs = document.getElementById('training-inputs');
    DOM.trainingFeedback = document.getElementById('training-feedback');
    DOM.trainingStats = document.getElementById('training-stats');
    DOM.statDifficulty = document.getElementById('stat-difficulty');
}

// ─────────────────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    cacheDOM();
    bindEvents();

    // Render topic filters above the example list
    UI.renderTopicFilters(getAllTopics(), DOM.examplesContainer, (topic) => {
        const examples = topic === 'all' ? BANK_EXAMPLES : getExamplesByTopic(topic);
        UI.renderExamples(examples, DOM.examplesContainer);
    });

    UI.renderExamples(BANK_EXAMPLES, DOM.examplesContainer);
});

// ─────────────────────────────────────────────────────────────────────────────
//  EVENT BINDING
// ─────────────────────────────────────────────────────────────────────────────
function bindEvents() {
    // Mode tabs
    DOM.modeTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            DOM.modeTabs.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            STATE.mode = btn.dataset.mode;
            applyMode();
        });
    });

    // Input analysis
    DOM.btnAnalyze.addEventListener('click', handleAnalyze);
    DOM.equationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAnalyze();
    });

    // Example selection — delegate on the container
    DOM.examplesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.bal-example-btn');
        if (!btn || btn.disabled) return;
        const example = BANK_EXAMPLES.find(ex => ex.id === btn.dataset.id);
        if (example) {
            DOM.equationInput.value = example.input;
            handleAnalyze();
        }
    });

    // Learning mode navigation
    DOM.btnPrevStep.addEventListener('click', () => changeStep(-1));
    DOM.btnNextStep.addEventListener('click', () => changeStep(1));

    // Training mode coefficient inputs
    DOM.trainingInputs.addEventListener('change', handleTrainingInputChange);
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODE SWITCHING
// ─────────────────────────────────────────────────────────────────────────────
function applyMode() {
    if (!STATE.parsedInput) return;

    if (STATE.mode === 'aprendizaje') {
        DOM.learningView.style.display = 'block';
        DOM.trainingView.style.display = 'none';
        DOM.trainingStats.style.display = 'none';
        renderCurrentStep();
    } else if (STATE.mode === 'entrenamiento') {
        DOM.learningView.style.display = 'none';
        DOM.trainingView.style.display = 'block';
        DOM.trainingStats.style.display = 'block';
        initTrainingMode();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────
function handleAnalyze() {
    const raw = DOM.equationInput.value.trim();
    if (!raw) return;

    // Clear errors
    UI.hideError(DOM.inputError);
    clearSimError();

    try {
        STATE.parsedInput = parseEquation(raw);
        STATE.rawInput = raw;
        STATE.stepsData = generateEducationalSteps(raw);
        STATE.currentStep = 0;

        // Update difficulty badge
        DOM.statDifficulty.textContent = STATE.stepsData.metadata.difficultyScore;

        DOM.emptyState.style.display = 'none';
        DOM.resultsContainer.style.display = 'block';

        applyMode();
    } catch (err) {
        // Show inline error near the input
        UI.showError(`Parse error: ${err.message}`, DOM.inputError);
        DOM.resultsContainer.style.display = 'none';
        DOM.emptyState.style.display = 'flex';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  LEARNING MODE
// ─────────────────────────────────────────────────────────────────────────────
function renderCurrentStep() {
    const { steps } = STATE.stepsData;
    if (!steps || steps.length === 0) return;

    if (STATE.currentStep === 0) {
        UI.renderTimeline(steps, DOM.stepsTimeline);
    }

    UI.advanceTimeline(STATE.currentStep, steps.length);

    const step = steps[STATE.currentStep];
    const total = steps.length;

    DOM.stepCounter.textContent = `Step ${STATE.currentStep + 1} of ${total}`;
    DOM.btnPrevStep.disabled = STATE.currentStep === 0;
    DOM.btnNextStep.disabled = STATE.currentStep === total - 1;

    if (step.datos) {
        if (step.datos.tabla) {
            UI.renderCountTable(step.datos.tabla, DOM.countTableBody);
        }

        if (step.tipo === 'result') {
            UI.renderEquationDisplay(step.datos.ecuacionBalanceada, DOM.equationDisplay);
            UI.renderMolecularView(step.datos.parsedBalanced, DOM.molecularView);
        } else {
            const parsedToRender =
                step.datos?.parsedIntermediate ??
                step.datos?.parsedStateBefore ??
                STATE.parsedInput;

            UI.renderEquationDisplay(formatEquation(parsedToRender), DOM.equationDisplay);
            UI.renderMolecularView(parsedToRender, DOM.molecularView);
        }
    }
}

function changeStep(delta) {
    const { steps } = STATE.stepsData;
    const next = STATE.currentStep + delta;
    if (next >= 0 && next < steps.length) {
        STATE.currentStep = next;
        renderCurrentStep();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRAINING MODE
// ─────────────────────────────────────────────────────────────────────────────
function initTrainingMode() {
    STATE.trainingState = JSON.parse(JSON.stringify(STATE.parsedInput));
    STATE.trainingState.reactants.forEach(s => { s.coeff = 1; });
    STATE.trainingState.products.forEach(s => { s.coeff = 1; });
    STATE.previousTrainingState = JSON.parse(JSON.stringify(STATE.trainingState));

    updateTrainingVisuals();
    UI.hideTrainingFeedback(DOM.trainingFeedback);
}

function updateTrainingVisuals() {
    UI.renderTrainingPanel(STATE.trainingState, DOM.trainingInputs);
    UI.renderEquationDisplay(formatEquation(STATE.trainingState), DOM.equationDisplay);
    UI.renderMolecularView(STATE.trainingState, DOM.molecularView);
    UI.renderCountTable(buildCountTable(STATE.trainingState), DOM.countTableBody);
}

function handleTrainingInputChange(e) {
    const input = e.target;
    if (!input.classList.contains('training-coeff-input')) return;

    const { formula, side } = input.dataset;
    let val = parseFloat(input.value);

    if (isNaN(val) || val <= 0) {
        val = 1;
        input.value = 1;
    }

    STATE.previousTrainingState = JSON.parse(JSON.stringify(STATE.trainingState));

    const species = STATE.trainingState[side].find(s => s.formula === formula);
    if (species) species.coeff = val;

    updateTrainingVisuals();

    // Pedagogical feedback
    try {
        const correctParsed = parseEquation(STATE.stepsData.metadata.balancedEquation);
        const errors = detectErrors(STATE.trainingState, correctParsed, STATE.previousTrainingState);

        if (errors.length > 0) {
            const err = errors[0];
            UI.showTrainingFeedback({
                status: 'incorrect',
                message: err.titulo,
                hint: err.mensaje + (err.consejo ? ' ' + err.consejo : ''),
            }, DOM.trainingFeedback);
        } else if (isBalanced(STATE.trainingState)) {
            UI.showTrainingFeedback({
                status: 'correct',
                message: 'Excellent! The equation is correctly balanced.',
                hint: 'Try another exercise from the bank.',
            }, DOM.trainingFeedback);
        } else {
            UI.hideTrainingFeedback(DOM.trainingFeedback);
        }
    } catch (_) {
        UI.hideTrainingFeedback(DOM.trainingFeedback);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM ERROR BAR HELPERS
//  Uses .sim-error (#sim-error) — shown above the sim-layout
// ─────────────────────────────────────────────────────────────────────────────
function showSimError(msg) {
    if (!DOM.simError) return;
    DOM.simError.textContent = msg;
    DOM.simError.classList.add('is-visible');
}

function clearSimError() {
    if (!DOM.simError) return;
    DOM.simError.textContent = '';
    DOM.simError.classList.remove('is-visible');
}
