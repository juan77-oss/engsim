/**
 * simulator.js — T–s Diagram (Water)
 * engsim.app
 *
 * WHAT GOES HERE:
 *   - Chart.js setup and updates
 *   - Input reading, DOM references, event listeners
 *   - Orchestration between core.js and the page
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (→ theme.js / platform)
 *   - Layout or styling (→ simulator.css)
 *   - Physics / thermodynamic math (→ core.js)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { sfData, sgData } from './constants.js';
import { getSaturationAtTemperature, calculateThermodynamicState } from './core.js';

/* ── Chart configuration ─────────────────────────────────────── */

/**
 * Generates a constant-quality (x) iso-line dataset.
 * @param {number} xVal - Quality value (0-1)
 */
/**
 * Reads the current theme's border/muted-text colors from CSS variables,
 * so the chart's grid lines and axis labels adapt to light/dark mode.
 */
function getChartThemeColors() {
    const styles = getComputedStyle(document.body);
    return {
        grid: styles.getPropertyValue('--border').trim() || '#f1f5f9',
        axisText: styles.getPropertyValue('--text-muted').trim() || '#64748b'
    };
}

function generateQualityLine(xVal) {
    const lineData = [];
    // Reuse sfData's temperature steps to generate the points
    sfData.forEach(p => {
        const t = p.y;
        const sat = getSaturationAtTemperature(t);
        const s = sat.sf + xVal * (sat.sg - sat.sf);
        lineData.push({ x: s, y: t });
    });
    return lineData;
}

/**
 * Initializes the Chart.js instance for the T–s diagram.
 * @param {CanvasRenderingContext2D} ctx - 2D context of the canvas
 * @returns {Chart} Chart.js instance
 */
function initChart(ctx) {
    const theme = getChartThemeColors();
    return new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Saturated Liquid (sf)',
                    data: sfData,
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Saturated Vapor (sg)',
                    data: sgData,
                    borderColor: '#2563eb',
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'x = 0.2',
                    data: generateQualityLine(0.2),
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'x = 0.5',
                    data: generateQualityLine(0.5),
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'x = 0.8',
                    data: generateQualityLine(0.8),
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    tension: 0.4
                },
                {
                    label: 'Initial Point',
                    data: [],
                    backgroundColor: '#94a3b8',
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    pointRadius: 4,
                    showLine: false
                },
                {
                    label: 'Process Path',
                    data: [],
                    borderColor: '#f59e0b',
                    borderWidth: 3,
                    fill: false,
                    pointRadius: 0,
                    tension: 0
                },
                {
                    label: 'Current State',
                    data: [{ x: 2.0, y: 150 }],
                    backgroundColor: '#dc2626',
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Specific Entropy (s) [kJ/kg·K]', color: theme.axisText },
                    min: 0,
                    max: 10,
                    grid: { color: theme.grid }
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Temperature (T) [°C]', color: theme.axisText },
                    min: 0,
                    max: 500,
                    grid: { color: theme.grid }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return `s: ${context.raw.x.toFixed(2)}, T: ${context.raw.y.toFixed(1)}°C`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Updates the chart with the current state and, if active, the
 * process path.
 * @param {Chart} chart - Chart.js instance
 * @param {number} t - Current temperature
 * @param {number} s - Current entropy
 * @param {boolean} isProcessActive - Whether process mode is active
 * @param {Object} p1 - Initial process point {t, s}
 * @param {string} processType - 'isentropic' or 'isothermal'
 */
function updateChart(chart, t, s, isProcessActive, p1, processType) {
    // Update the current-state marker (last dataset)
    chart.data.datasets[chart.data.datasets.length - 1].data = [{ x: s, y: t }];

    // Update process data if active
    if (!isProcessActive || !p1) {
        chart.data.datasets[chart.data.datasets.length - 2].data = []; // Path
        chart.data.datasets[chart.data.datasets.length - 3].data = []; // Initial point
    } else {
        const trajData = [];
        const p1Data = [{ x: p1.s, y: p1.t }];

        if (processType === 'isentropic') {
            // s = constant (vertical)
            trajData.push({ x: p1.s, y: p1.t });
            trajData.push({ x: p1.s, y: t });
        } else if (processType === 'isothermal') {
            // T = constant (horizontal — clipped to saturation dome boundaries)
            const sat = getSaturationAtTemperature(p1.t);
            const finalStartS = Math.max(sat.sf, Math.min(sat.sg, p1.s));
            const finalEndS = Math.max(sat.sf, Math.min(sat.sg, s));

            trajData.push({ x: finalStartS, y: p1.t });
            trajData.push({ x: finalEndS, y: p1.t });
        }

        chart.data.datasets[chart.data.datasets.length - 3].data = p1Data;
        chart.data.datasets[chart.data.datasets.length - 2].data = trajData;
    }

    chart.update('none'); // No animation, for smoothness while dragging
}

/* ── DOM / orchestration ─────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chart
    const ctx = document.getElementById('ts-chart').getContext('2d');
    const tsChart = initChart(ctx);

    // Input elements
    const inputT = document.getElementById('input-t');
    const sliderT = document.getElementById('slider-t');
    const inputS = document.getElementById('input-s');
    const sliderS = document.getElementById('slider-s');

    // Result elements
    const resTemp = document.getElementById('res-temp');
    const resEntropy = document.getElementById('res-entropy');
    const resQuality = document.getElementById('res-quality');
    const resRegion = document.getElementById('res-region');

    // Process mode elements
    const checkProcess = document.getElementById('check-process');
    const selectProcess = document.getElementById('select-process');
    const processGroup = document.getElementById('process-selector-group');

    // Didactic analysis elements
    const didacticBox = document.getElementById('didactic-analysis');
    const equationValues = document.getElementById('equation-values');
    const equationResult = document.getElementById('equation-result');

    // Quality bar elements
    const qualityBarContainer = document.getElementById('quality-bar-container');
    const qualityBarFill = document.getElementById('quality-bar-fill');

    // Process state
    let isProcessActive = false;
    let p1 = null; // { t, s }

    /**
     * Updates the quality bar visualization.
     */
    function updateQualityBar(x, region) {
        if (!qualityBarContainer) return;

        if (region === "Two-phase Mixture") {
            qualityBarContainer.style.display = "block";
            if (qualityBarFill) qualityBarFill.style.width = (x * 100) + "%";
        } else {
            qualityBarContainer.style.display = "none";
        }
    }

    /**
     * Reads inputs, calculates state, and updates the UI and chart.
     */
    function updateState() {
        const t = parseFloat(inputT.value);
        const s = parseFloat(inputS.value);

        // Run the thermodynamic engine
        const state = calculateThermodynamicState(t, s);

        let xLabel = "-";
        if (state.isMixture) {
            xLabel = state.isCritical ? "x = 0.500 (Critical Point)" : "x = " + state.qualityVal.toFixed(3);
        }

        // Update UI
        resTemp.textContent = t.toFixed(1);
        resEntropy.textContent = s.toFixed(2);
        resRegion.textContent = state.region;
        resQuality.textContent = xLabel;

        // Update quality bar
        updateQualityBar(state.qualityVal, state.region);

        // Update didactic analysis
        if (state.region === "Two-phase Mixture") {
            didacticBox.style.display = "block";
            equationValues.innerHTML =
                `x = (${s.toFixed(2)} - ${state.sf.toFixed(2)}) / (${state.sg.toFixed(2)} - ${state.sf.toFixed(2)})`;
            equationResult.textContent = `x = ${state.qualityVal.toFixed(3)}`;
        } else {
            didacticBox.style.display = "none";
        }

        // Update chart
        updateChart(tsChart, t, s, isProcessActive, p1, selectProcess.value);
    }

    /* ── Event listeners ─────────────────────────────────────── */

    function syncInputs(val, targetInput, targetSlider) {
        targetInput.value = val;
        targetSlider.value = val;
        updateState();
    }

    inputT.addEventListener('input', (e) => syncInputs(e.target.value, inputT, sliderT));
    sliderT.addEventListener('input', (e) => syncInputs(e.target.value, inputT, sliderT));
    inputS.addEventListener('input', (e) => syncInputs(e.target.value, inputS, sliderS));
    sliderS.addEventListener('input', (e) => syncInputs(e.target.value, inputS, sliderS));

    // Process mode listeners
    checkProcess.addEventListener('change', (e) => {
        isProcessActive = e.target.checked;
        processGroup.style.display = isProcessActive ? 'block' : 'none';

        if (isProcessActive) {
            // Store the current state as the initial point
            p1 = {
                t: parseFloat(inputT.value),
                s: parseFloat(inputS.value)
            };
        } else {
            p1 = null;
        }
        updateState();
    });

    selectProcess.addEventListener('change', () => {
        updateState();
    });

    // Re-color the chart's grid/axis text when the theme toggle (in platform.js)
    // switches light/dark mode, so the diagram stays legible in both.
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#theme-toggle')) return;
        // Wait a tick so body.dark has already been toggled by platform.js
        setTimeout(() => {
            const theme = getChartThemeColors();
            tsChart.options.scales.x.grid.color = theme.grid;
            tsChart.options.scales.y.grid.color = theme.grid;
            tsChart.options.scales.x.title.color = theme.axisText;
            tsChart.options.scales.y.title.color = theme.axisText;
            tsChart.update('none');
        }, 0);
    });

    // Initial calculation on page load (chart was already initialized above)
    updateState();
});
