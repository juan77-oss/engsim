/**
 * ui/chart.js — Gráfico de Composición · Combustión FASE 1
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE : Gráfico de barras apiladas horizontales que visualiza
 *           la composición en base seca y base húmeda.
 *           En FASE 1 es opcional y no interrumpe la arquitectura.
 *
 * EXPORTS :
 *   initChart()            → crea la instancia Chart.js una vez
 *   updateChart(fuelState) → actualiza con nuevo estado del combustible
 * ─────────────────────────────────────────────────────────────────
 */

import { qs } from './dom.js';
import { COMPONENT_META } from './constants.js';


// ═══════════════════════════════════════════════
//  SINGLETON — Una instancia por página
// ═══════════════════════════════════════════════

let _chart = null;


// ═══════════════════════════════════════════════
//  initChart()
// ═══════════════════════════════════════════════

/**
 * Crea la instancia Chart.js en el canvas #mainChart.
 * Gráfico de barras horizontal apilado para FASE 1.
 * Safe to call even if Chart.js is not loaded.
 */
export function initChart() {
    const canvas = qs('#mainChart');
    if (!canvas) {
        console.warn('[chart.js] Canvas #mainChart no encontrado — gráfico omitido.');
        return;
    }

    if (typeof Chart === 'undefined') {
        console.warn('[chart.js] Chart.js no disponible — gráfico omitido.');
        return;
    }

    const colors = COMPONENT_META.map(m => m.color);
    const labels = COMPONENT_META.map(m => `${m.symbol} – ${m.label}`);

    _chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',

        data: {
            // Dos filas: base seca, base húmeda
            labels: ['Dry basis', 'Wet basis'],
            datasets: COMPONENT_META.map((meta, i) => ({
                label:           `${meta.symbol} ${meta.label}`,
                data:            [0, 0],
                backgroundColor: colors[i] + 'cc',  // leve transparencia
                borderColor:     colors[i],
                borderWidth:     1,
                borderRadius:    2
            }))
        },

        options: {
            indexAxis: 'y',          // barras horizontales
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 350,
                easing:   'easeOutQuart'
            },
            scales: {
                x: {
                    stacked: true,
                    min:     0,
                    max:     100,
                    title: {
                        display: true,
                        text:    'Composition (%)',
                        font:    { size: 11, weight: '600' },
                        color:   '#9ca3af'
                    },
                    ticks:  { color: '#9ca3af' },
                    grid:   { color: 'rgba(107,114,128,0.10)' },
                    border: { color: 'rgba(107,114,128,0.20)' }
                },
                y: {
                    stacked: true,
                    ticks:  { color: '#9ca3af' },
                    grid:   { color: 'rgba(107,114,128,0.06)' },
                    border: { color: 'rgba(107,114,128,0.20)' }
                }
            },
            plugins: {
                legend: {
                    display:  true,
                    position: 'bottom',
                    align:    'start',
                    labels: {
                        usePointStyle:    true,
                        pointStyleWidth:  12,
                        boxHeight:        8,
                        padding:          14,
                        color:            '#9ca3af',
                        font:             { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17,24,39,0.92)',
                    titleColor:      '#f9fafb',
                    bodyColor:       '#d1d5db',
                    borderColor:     'rgba(255,255,255,0.08)',
                    borderWidth:     1,
                    padding:         10,
                    callbacks: {
                        label: ctx => `  ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)} %`
                    }
                }
            }
        }
    });
}


// ═══════════════════════════════════════════════
//  updateChart()
// ═══════════════════════════════════════════════

/**
 * Alimenta el gráfico con el estado actual del combustible.
 *
 * @param {{ valid: boolean, dry: object, wet: object }} fuelState
 *         Output de buildFuelState() en core.js
 */
export function updateChart(fuelState) {
    if (!_chart || !fuelState || !fuelState.valid) return;

    COMPONENT_META.forEach((meta, i) => {
        _chart.data.datasets[i].data = [
            fuelState.dry[meta.key] ?? 0,
            fuelState.wet[meta.key] ?? 0
        ];
    });

    _chart.update();
}
