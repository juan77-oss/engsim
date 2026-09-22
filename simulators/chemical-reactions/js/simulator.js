/**
 * simulator.js — Chemical Reactions Simulator
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - DOM references & input reading
 *   - UI rendering (presentation layer, no calculation logic)
 *   - Event listeners, global state, and initialization (orchestration)
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ platform.js)
 *   - Physics/chemistry calculations (→ core.js)
 *   - Reference data tables (→ constants.js)
 *
 * THEORY NOTES:
 *   This file renders results computed by core.js. It performs no
 *   DOM-independent calculation itself — see core.js for the
 *   stoichiometric and redox algorithms.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import * as Core from './core.js';

// ═══════════════════════════════════════════════════════════════
// LOCAL DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════

function fmt(n, decimals = 4) {
  if (typeof n !== 'number' || isNaN(n)) return '—';
  return parseFloat(n.toFixed(decimals)).toString();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function show(el) { el && el.classList.remove('is-hidden'); }
function hide(el) { el && el.classList.add('is-hidden'); }

// Formula display helper — SECURITY: formulas can originate from the
// user's own typed equation (parsed, not sanitized, by core.js), so any
// value inserted via innerHTML MUST be escaped first. Subscript digits
// are then applied via Core's own formatter (single source of truth —
// no duplicated SUBSCRIPT_MAP here).
function formatDisplayFormula(formula) {
  return Core.formatFormula(escapeHtml(formula));
}

// ═══════════════════════════════════════════════════════════════
// UI — PRESENTATION LAYER (DOM manipulation only)
// ═══════════════════════════════════════════════════════════════

const UI = {

  // ── Tab Navigation ───────────────────────────────────────────
  activateTab(tabId, elements) {
    const { tabLimiting, tabRedox, panelLimiting, panelRedox } = elements;
    tabLimiting.classList.toggle('active', tabId === 'limiting');
    tabRedox.classList.toggle('active', tabId === 'redox');
    tabLimiting.setAttribute('aria-selected', String(tabId === 'limiting'));
    tabRedox.setAttribute('aria-selected', String(tabId === 'redox'));
    panelLimiting.classList.toggle('is-hidden', tabId !== 'limiting');
    panelRedox.classList.toggle('is-hidden', tabId !== 'redox');
  },

  // ── Error Display (uses the shared .sim-error / .is-visible pattern) ──
  showError(container, message) {
    container.textContent = message;
    container.classList.add('is-visible');
  },

  clearError(container) {
    container.textContent = '';
    container.classList.remove('is-visible');
  },

  // ── Reactant Rows ────────────────────────────────────────────
  buildReactantRows(container, reactants) {
    container.innerHTML = '';
    if (!reactants || reactants.length === 0) {
      container.innerHTML = '<p class="reactants-placeholder">Enter an equation above to display the reactant input fields.</p>';
      return;
    }
    reactants.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'reactant-row';
      row.dataset.index = i;

      row.innerHTML = `
        <div class="reactant-row__label">
          <span class="reactant-formula">${formatDisplayFormula(r.formula)}</span>
          <span class="reactant-mass">M = ${fmt(r.molarMass, 3)} g/mol</span>
        </div>
        <div class="reactant-row__input">
          <input
            type="number"
            id="lr-reactant-value-${i}"
            class="sim-input reactant-value"
            placeholder="Quantity"
            min="0"
            step="any"
            data-index="${i}"
            aria-label="Quantity of ${escapeHtml(r.formula)}"
          />
          <select
            id="lr-reactant-unit-${i}"
            class="sim-select reactant-unit"
            data-index="${i}"
            aria-label="Unit for ${escapeHtml(r.formula)}"
          >
            <option value="g">g</option>
            <option value="mol">mol</option>
          </select>
        </div>
      `;
      container.appendChild(row);
    });
  },

  collectReactantInputs(container) {
    const inputs = [];
    const rows = container.querySelectorAll('.reactant-row');
    rows.forEach((row, i) => {
      const valInput = document.getElementById(`lr-reactant-value-${i}`);
      const unitInput = document.getElementById(`lr-reactant-unit-${i}`);
      inputs.push({
        value: valInput ? parseFloat(valInput.value) : NaN,
        unit: unitInput ? unitInput.value : 'g'
      });
    });
    return inputs;
  },

  setReactantInputs(container, values) {
    values.forEach((v, i) => {
      const valInput  = document.getElementById(`lr-reactant-value-${i}`);
      const unitInput = document.getElementById(`lr-reactant-unit-${i}`);
      if (valInput)  valInput.value  = v.value;
      if (unitInput) unitInput.value = v.unit;
    });
  },

  // ── Quiz Mode Toggle ─────────────────────────────────────────
  toggleQuizButton(btn, isQuizMode) {
    if (btn.type === 'checkbox') {
      btn.checked = isQuizMode;
    } else {
      btn.classList.toggle('active', isQuizMode);
      btn.textContent = isQuizMode ? 'Quiz Mode: ON' : 'Quiz Mode: OFF';
    }
  },

  // ── Limiting Reagent Render ──────────────────────────────────
  renderLimitingResults(area, result, state) {
    area.innerHTML = '';
    show(area);

    if (state.autoBalanced) {
      const banner = document.createElement('div');
      banner.className = 'status-banner status-banner--info';
      banner.innerHTML = `
        <span class="status-banner__title">Equation auto-balanced</span>
        <span class="status-banner__message">The equation was not balanced. Coefficients have been adjusted to conserve atom counts.</span>
      `;
      area.appendChild(banner);
    }

    // Section 1: Balanced Equation
    const sec1 = document.createElement('section');
    sec1.className = 'result-section';
    let equationDisplayHTML = `
      <div class="equation-display">
        <span class="equation-string">${escapeHtml(result.equationFormatted)}</span>
      </div>`;

    if (state.autoBalanced) {
      equationDisplayHTML = `
        <div class="equation-comparison">
          <div class="eq-comp-item">
            <span class="eq-comp-label">Input:</span>
            <span class="eq-comp-str text-muted">${escapeHtml(state.originalEquation)}</span>
          </div>
          <div class="eq-comp-item">
            <span class="eq-comp-label">Balanced:</span>
            <span class="eq-comp-str highlight">${escapeHtml(result.equationFormatted)}</span>
          </div>
        </div>`;
    }

    sec1.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">1</span> Balanced equation
      </h3>
      ${equationDisplayHTML}`;
    area.appendChild(sec1);

    // Section 2: Conversion Table
    const sec2 = document.createElement('section');
    sec2.className = 'result-section';
    let convRows = result.conversionTable.map(r => {
      const gramsCell = r.inputUnit === 'g' ? `${fmt(r.inputValue, 3)} g` : '<span class="text-muted">—</span>';
      return `
        <tr>
          <td class="formula-cell">${formatDisplayFormula(r.formula)}</td>
          <td>${gramsCell}</td>
          <td>${fmt(r.molarMass, 4)} g/mol</td>
          <td class="formula-cell">${fmt(r.moles, 6)} mol</td>
          <td class="conversion-eq text-muted">${r.conversionSteps.equation}</td>
        </tr>`;
    }).join('');

    sec2.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">2</span> Conversion to moles
      </h3>
      <div class="chem-table-scroll">
        <table class="result-table" aria-label="Conversion to moles">
          <thead>
            <tr>
              <th>Reactant</th><th>Mass (g)</th><th>Molar mass</th>
              <th>Moles (n)</th><th>Calculation</th>
            </tr>
          </thead>
          <tbody>${convRows}</tbody>
        </table>
      </div>`;
    area.appendChild(sec2);

    // Section 3: Ratio Table
    const sec3 = document.createElement('section');
    sec3.className = 'result-section';
    let ratioRows = result.ratioTable.map(r => {
      const cls = r.isLimiting ? 'limiting-row' : '';
      const badge = r.isLimiting ? '<span class="limiting-badge">LIMITING</span>' : '<span class="excess-badge">Excess</span>';
      return `
        <tr class="${cls}">
          <td class="formula-cell">${formatDisplayFormula(r.formula)}</td>
          <td>${fmt(r.moles, 6)} mol</td>
          <td>${r.coeff}</td>
          <td class="ratio-cell">${fmt(r.ratio, 6)}</td>
          <td>${badge}</td>
        </tr>`;
    }).join('');

    sec3.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">3</span> Molar ratio table
        <span class="section-note">Ratio = moles ÷ coefficient</span>
      </h3>
      <div class="chem-table-scroll">
        <table class="result-table" aria-label="Molar ratio table">
          <thead>
            <tr>
              <th>Reactant</th><th>Moles</th><th>Coeff.</th>
              <th>Ratio</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${ratioRows}</tbody>
        </table>
      </div>
      <p class="ratio-explanation">
        The <strong>limiting reagent</strong> is the one with the <strong>smallest ratio</strong>
        (moles / coefficient), because it determines how many times the reaction can proceed.
      </p>`;
    area.appendChild(sec3);

    // Section 4: Conclusion
    const sec4 = document.createElement('section');
    sec4.className = 'result-section';
    const quizClass = state.quizMode && !state.quizAnswerRevealed ? 'quiz-hidden' : '';

    let kpiGridHTML = `
      <div class="sim-results-grid ${quizClass}" aria-live="polite">
        <div class="sim-result-card sim-result-card--limiting">
          <div class="sim-result-label">Limiting Reagent</div>
          <div class="sim-result-value">${formatDisplayFormula(result.limitingReagent.formula)}</div>
          <div class="sim-result-unit">${fmt(result.limitingReagent.moles, 4)} mol</div>
        </div>
    `;

    result.productsFormed.forEach(p => {
      kpiGridHTML += `
        <div class="sim-result-card sim-result-card--product">
          <div class="sim-result-label">Product (${formatDisplayFormula(p.formula)})</div>
          <div class="sim-result-value">${fmt(p.gramsFormed, 2)}</div>
          <div class="sim-result-unit">g</div>
        </div>`;
    });

    const excessList = result.excessData.filter(r => !r.isLimiting);
    if (excessList.length > 0) {
      excessList.forEach(r => {
        kpiGridHTML += `
          <div class="sim-result-card sim-result-card--excess">
            <div class="sim-result-label">Excess (${formatDisplayFormula(r.formula)})</div>
            <div class="sim-result-value">${fmt(r.gramsExcess, 2)}</div>
            <div class="sim-result-unit">g</div>
          </div>`;
      });
    } else {
      kpiGridHTML += `
        <div class="sim-result-card sim-result-card--excess">
          <div class="sim-result-label">Excess Reagents</div>
          <div class="sim-result-value">0</div>
          <div class="sim-result-unit">g</div>
        </div>`;
    }

    kpiGridHTML += `</div>`;

    let quizSection = '';
    if (state.quizMode && !state.quizAnswerRevealed) {
      quizSection = `
        <div class="quiz-prompt">
          <p class="quiz-question">🧪 Which is the limiting reagent?</p>
          <button id="quiz-reveal-btn" class="btn-secondary quiz-reveal-btn">Reveal answer</button>
        </div>`;
    }

    sec4.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">4</span> Conclusion
      </h3>
      ${quizSection}
      ${kpiGridHTML}`;
    area.appendChild(sec4);

    // Visualization: Bar Chart
    this._renderBarChart(result, area);
  },

  _renderBarChart(result, container) {
    const chartSection = document.createElement('section');
    chartSection.className = 'result-section';
    chartSection.innerHTML = `
      <h3 class="result-section__title">Consumption visualisation</h3>
      <div class="sim-chart-wrap"><div class="sim-chart-label">Reactant consumption vs. excess</div></div>
    `;

    const chart = document.createElement('div');
    chart.className = 'bar-chart';
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Bar chart showing the fraction of each reactant consumed versus remaining');

    result.excessData.forEach(r => {
      const isLimiting = r.isLimiting;
      const initial    = r.molesInitial;
      const consumed   = r.molesConsumed;
      const leftover   = r.molesExcess;

      const consumedPct  = initial > 0 ? (consumed / initial) * 100 : 0;
      const leftoverPct  = initial > 0 ? (leftover / initial) * 100 : 0;

      const row = document.createElement('div');
      row.className = `bar-row ${isLimiting ? 'bar-row--limiting' : ''}`;

      row.innerHTML = `
        <div class="bar-label">
          <span class="bar-formula">${formatDisplayFormula(r.formula)}</span>
          ${isLimiting ? '<span class="limiting-badge">LIMITING</span>' : ''}
        </div>
        <div class="bar-track" title="${escapeHtml(r.formula)}">
          <div class="bar-segment bar-consumed"
               style="width: 0%"
               data-target="${consumedPct.toFixed(2)}%"
               title="Consumed: ${fmt(consumed, 4)} mol">
          </div>
          <div class="bar-segment bar-leftover"
               style="width: 0%"
               data-target="${leftoverPct.toFixed(2)}%"
               title="Remaining: ${fmt(leftover, 4)} mol">
          </div>
        </div>
        <div class="bar-legend">
          <span class="legend-consumed">▪ Consumed: ${fmt(consumed, 4)} mol</span>
          <span class="legend-leftover">▪ Remaining: ${fmt(leftover, 4)} mol</span>
        </div>`;

      chart.appendChild(row);
    });

    chartSection.querySelector('.sim-chart-wrap').appendChild(chart);
    container.appendChild(chartSection);

    requestAnimationFrame(() => {
      setTimeout(() => {
        const segments = chart.querySelectorAll('.bar-segment[data-target]');
        segments.forEach(seg => {
          seg.style.width = seg.dataset.target;
        });
      }, 100);
    });
  },

  // ── Redox Render ─────────────────────────────────────────────
  renderRedoxResults(area, reaction) {
    area.innerHTML = '';
    show(area);

    const header = document.createElement('div');
    header.className = 'redox-header';
    const mediumLabel = reaction.medium === 'acidic' ? 'Acidic medium' : 'Basic medium';
    header.innerHTML = `
      <h3 class="redox-title">${reaction.name}</h3>
      <span class="edu-process-badge edu-process-badge--${reaction.medium}">${mediumLabel}</span>`;
    area.appendChild(header);

    const finalEqBox = document.createElement('div');
    finalEqBox.className = 'final-equation-box';
    finalEqBox.innerHTML = `
      <span class="final-equation-label">Final balanced equation</span>
      <span class="final-equation-str">${reaction.finalEquation}</span>`;
    area.appendChild(finalEqBox);

    const oxSection = document.createElement('section');
    oxSection.className = 'result-section';
    const oxRows = reaction.oxidationNumbers.map(ox => `
      <tr>
        <td>${ox.species}</td>
        <td>${ox.element}</td>
        <td class="ox-number">${ox.oxidationState}</td>
        <td class="text-muted">${ox.note}</td>
      </tr>`).join('');

    oxSection.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">1</span> Oxidation numbers
      </h3>
      <div class="chem-table-scroll">
        <table class="result-table" aria-label="Oxidation numbers">
          <thead>
            <tr><th>Species</th><th>Element</th><th>Oxidation No.</th><th>Justification</th></tr>
          </thead>
          <tbody>${oxRows}</tbody>
        </table>
      </div>`;
    area.appendChild(oxSection);

    const idSection = document.createElement('section');
    idSection.className = 'result-section';
    const { oxidized, reduced, agent } = reaction.redoxIdentification;
    idSection.innerHTML = `
      <h3 class="result-section__title">
        <span class="step-number">2</span> Redox identification
      </h3>
      <div class="redox-identification">
        <div class="redox-id-card id-oxidation">
          <div class="id-card__label">OXIDATION</div>
          <div class="id-card__species">${oxidized.species}</div>
          <div class="id-card__change">${oxidized.from} → ${oxidized.to}</div>
          <div class="id-card__note">${oxidized.change}</div>
          <div class="id-card__agent">${agent.reducing}</div>
        </div>
        <div class="redox-id-card id-reduction">
          <div class="id-card__label">REDUCTION</div>
          <div class="id-card__species">${reduced.species}</div>
          <div class="id-card__change">${reduced.from} → ${reduced.to}</div>
          <div class="id-card__note">${reduced.change}</div>
          <div class="id-card__agent">${agent.oxidizing}</div>
        </div>
      </div>`;
    area.appendChild(idSection);

    const flowSection = document.createElement('section');
    flowSection.className = 'result-section';
    flowSection.innerHTML = `
      <h3 class="result-section__title">Electron flow</h3>
      <div class="electron-flow" role="img" aria-label="Electron transfer diagram from ${oxidized.species} to ${reduced.species}">
        <div class="ef-species ef-oxidation">${oxidized.species}</div>
        <div class="ef-arrow-container">
          <div class="ef-arrow">
            <div class="ef-electrons">e⁻</div>
            <svg class="ef-svg" viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6"
                        refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="var(--brand-accent)"/>
                </marker>
              </defs>
              <line x1="10" y1="20" x2="185" y2="20"
                    stroke="var(--brand-accent)" stroke-width="2"
                    stroke-dasharray="6 3" marker-end="url(#arrowhead)"
                    class="ef-line"/>
            </svg>
          </div>
          <div class="ef-label">electron transfer</div>
        </div>
        <div class="ef-species ef-reduction">${reduced.species}</div>
      </div>`;
    area.appendChild(flowSection);

    const stepsSection = document.createElement('section');
    stepsSection.className = 'result-section';
    const stepsId = 'redox-steps-content';
    stepsSection.innerHTML = `
      <h3 class="result-section__title">
        Step-by-step breakdown
        <button class="steps-toggle-btn" id="btn-toggle-steps" aria-expanded="true">
          Hide steps
        </button>
      </h3>
      <div id="${stepsId}" class="steps-container">
        ${reaction.steps.map((step) => `
          <div class="edu-example edu-example--${step.type}">
            <div class="edu-example__title">${step.title}</div>
            <div>
              ${step.content.map(line =>
                line === '' ? '<br>' : `<div class="step-line">${escapeHtml(line)}</div>`
              ).join('')}
            </div>
          </div>`).join('')}
      </div>`;
    area.appendChild(stepsSection);
  },

  // ── Hide Areas ───────────────────────────────────────────────
  hideElement(el) { hide(el); },
  showElement(el) { show(el); },

  toggleStepsVisibility(containerId, btn) {
    const targetEl = document.getElementById(containerId);
    if (!targetEl) return;
    const isHidden = targetEl.classList.toggle('is-hidden');
    if (btn) {
      btn.textContent = isHidden ? 'Show steps' : 'Hide steps';
      btn.setAttribute('aria-expanded', String(!isHidden));
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATION — global state, DOM cache, events, initialization
// ═══════════════════════════════════════════════════════════════

const State = {
  currentTab: 'limiting',
  limitingResult: null,
  quizMode: false,
  quizAnswerRevealed: false,
  autoBalanced: false,
  originalEquation: '',
};

const DOM = {};

function cacheDOM() {
  DOM.tabLimiting = document.getElementById('tab-limiting');
  DOM.tabRedox = document.getElementById('tab-redox');
  DOM.panelLimiting = document.getElementById('panel-limiting');
  DOM.panelRedox = document.getElementById('panel-redox');
  DOM.equationInput = document.getElementById('lr-equation');
  DOM.reactantsContainer = document.getElementById('lr-reactants-container');
  DOM.calcButton = document.getElementById('btn-calculate');
  DOM.quizToggle = document.getElementById('lr-quiz-toggle');
  DOM.exampleBtnsLR = document.querySelectorAll('[data-example-lr]');
  DOM.resultsArea = document.getElementById('lr-results');
  DOM.errorArea = document.getElementById('lr-error');
  DOM.redoxInput = document.getElementById('redox-equation');
  DOM.redoxMedium = document.getElementById('redox-medium');
  DOM.redoxCalcBtn = document.getElementById('redox-calculate-btn');
  DOM.exampleBtnsRX = document.querySelectorAll('[data-example-rx]');
  DOM.redoxResultsArea = document.getElementById('redox-results');
  DOM.redoxErrorArea = document.getElementById('redox-error');
  DOM.lrEmptyState = document.getElementById('lr-empty-state');
  DOM.redoxEmptyState = document.getElementById('redox-empty-state');
}

// ── LOGIC PIPELINE: LIMITING REAGENT ──────────────────────────

function refreshReactantRows() {
  const eqStr = DOM.equationInput.value.trim();
  if (!eqStr) {
    UI.buildReactantRows(DOM.reactantsContainer, []);
    return;
  }
  try {
    const parsed = Core.parseEquation(eqStr);
    UI.buildReactantRows(DOM.reactantsContainer, parsed.reactants);
  } catch (_) {
    // Ignore errors while typing — keep the last valid rows on screen
  }
}

function attachQuizListeners() {
  const revealBtn = document.getElementById('quiz-reveal-btn');
  if (revealBtn) {
    revealBtn.addEventListener('click', () => {
      State.quizAnswerRevealed = true;
      UI.renderLimitingResults(DOM.resultsArea, State.limitingResult, State);
      attachQuizListeners();
    });
  }
}

function onCalculateLimiting() {
  UI.clearError(DOM.errorArea);
  UI.hideElement(DOM.resultsArea);
  UI.hideElement(DOM.lrEmptyState);
  State.quizAnswerRevealed = false;

  let eqStr = DOM.equationInput.value.trim();
  let parsed;

  try {
    parsed = Core.parseEquation(eqStr);
    State.originalEquation = Core.formatEquation(parsed); // Capture pre-balance display form
    const balanceResult = Core.balanceEquation(parsed);
    State.autoBalanced = balanceResult.wasChanged;
    if (State.autoBalanced) {
      parsed = balanceResult.balanced;
      eqStr = Core.stringifyEquation(parsed);
    }
  } catch (err) {
    UI.showError(DOM.errorArea, err.message);
    UI.showElement(DOM.lrEmptyState);
    return;
  }

  let reactantInputs;
  try {
    reactantInputs = UI.collectReactantInputs(DOM.reactantsContainer);
  } catch (err) {
    UI.showError(DOM.errorArea, 'Error reading reactant quantities.');
    UI.showElement(DOM.lrEmptyState);
    return;
  }

  const validationErrors = Core.validateLimitingReagentInput(eqStr, reactantInputs);
  if (validationErrors.length > 0) {
    UI.showError(DOM.errorArea, validationErrors.join(' | '));
    UI.showElement(DOM.lrEmptyState);
    return;
  }

  let result;
  try {
    result = Core.calculateLimitingReagent(eqStr, reactantInputs);
  } catch (err) {
    UI.showError(DOM.errorArea, err.message);
    UI.showElement(DOM.lrEmptyState);
    return;
  }

  State.limitingResult = result;
  UI.renderLimitingResults(DOM.resultsArea, result, State);
  attachQuizListeners();
}

function onToggleQuiz(e) {
  State.quizMode = e.target.checked;
  State.quizAnswerRevealed = false;
  UI.toggleQuizButton(DOM.quizToggle, State.quizMode);

  if (State.limitingResult) {
    UI.renderLimitingResults(DOM.resultsArea, State.limitingResult, State);
    attachQuizListeners();
  }
}

function loadLimitingExample(btn) {
  const eq = btn.dataset.exampleLr;
  const values = JSON.parse(btn.dataset.values);

  DOM.equationInput.value = eq;
  try {
    const parsed = Core.parseEquation(eq);
    UI.buildReactantRows(DOM.reactantsContainer, parsed.reactants);
    UI.setReactantInputs(DOM.reactantsContainer, values);
  } catch (err) {
    UI.showError(DOM.errorArea, err.message);
  }
}

// ── LOGIC PIPELINE: REDOX ──────────────────────────────────────

function attachRedoxListeners() {
  const toggleStepsBtn = document.getElementById('btn-toggle-steps');
  if (toggleStepsBtn) {
    toggleStepsBtn.addEventListener('click', () => {
      UI.toggleStepsVisibility('redox-steps-content', toggleStepsBtn);
    });
  }
}

function onCalculateRedox() {
  UI.clearError(DOM.redoxErrorArea);
  UI.hideElement(DOM.redoxResultsArea);
  UI.hideElement(DOM.redoxEmptyState);

  const input = DOM.redoxInput.value.trim();
  if (!input) {
    UI.showError(DOM.redoxErrorArea, 'Enter a redox equation to analyse.');
    UI.showElement(DOM.redoxEmptyState);
    return;
  }

  const reaction = Core.getRedoxReaction(input);
  if (!reaction) {
    UI.showError(DOM.redoxErrorArea, 'Reaction not supported in this version. Use the example buttons.');
    UI.showElement(DOM.redoxEmptyState);
    return;
  }

  // The medium dropdown is informational only (disabled) — the engine
  // detects it from the matched reaction, so keep it in sync with the
  // actual result rather than whatever the user last selected.
  if (DOM.redoxMedium) DOM.redoxMedium.value = reaction.medium;

  UI.renderRedoxResults(DOM.redoxResultsArea, reaction);
  attachRedoxListeners();
}

function loadRedoxExample(btn) {
  const id = btn.dataset.exampleRx;
  const reaction = Core.getReactionById(id);
  if (!reaction) return;

  DOM.redoxInput.value = reaction.inputExample;
  if (DOM.redoxMedium) DOM.redoxMedium.value = reaction.medium;
}

// ── INITIALIZATION ──────────────────────────────────────────────

function init() {
  cacheDOM();

  if (DOM.tabLimiting) {
    DOM.tabLimiting.addEventListener('click', () => {
      State.currentTab = 'limiting';
      UI.activateTab('limiting', DOM);
    });
  }
  if (DOM.tabRedox) {
    DOM.tabRedox.addEventListener('click', () => {
      State.currentTab = 'redox';
      UI.activateTab('redox', DOM);
    });
  }

  if (DOM.equationInput) {
    DOM.equationInput.addEventListener('input', refreshReactantRows);
    DOM.equationInput.addEventListener('change', refreshReactantRows);
    DOM.equationInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') onCalculateLimiting();
    });
  }

  if (DOM.calcButton) {
    DOM.calcButton.addEventListener('click', onCalculateLimiting);
  }
  if (DOM.quizToggle) {
    DOM.quizToggle.addEventListener('change', onToggleQuiz);
  }
  if (DOM.redoxCalcBtn) {
    DOM.redoxCalcBtn.addEventListener('click', onCalculateRedox);
  }
  if (DOM.redoxInput) {
    DOM.redoxInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') onCalculateRedox();
    });
  }

  DOM.exampleBtnsLR.forEach(btn => {
    btn.addEventListener('click', () => loadLimitingExample(btn));
  });
  DOM.exampleBtnsRX.forEach(btn => {
    btn.addEventListener('click', () => loadRedoxExample(btn));
  });

  UI.activateTab('limiting', DOM);
}

document.addEventListener('DOMContentLoaded', init);

