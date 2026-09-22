/**
 * constants.js — T–s Diagram (Water)
 * engsim.app
 *
 * Saturation dome dataset for water (approximate values).
 * T in °C, s in kJ/(kg·K)
 *
 * No logic here — only static data used by core.js and simulator.js.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

export const criticalPoint = { x: 4.43, y: 374.1 };

// Saturated liquid line (sf) — left boundary of the saturation dome
export const sfData = [
    { x: 0.000, y: 0.01 },
    { x: 0.573, y: 40 },
    { x: 1.075, y: 80 },
    { x: 1.528, y: 120 },
    { x: 1.943, y: 160 },
    { x: 2.331, y: 200 },
    { x: 2.702, y: 240 },
    { x: 3.067, y: 280 },
    { x: 3.449, y: 320 },
    { x: 3.659, y: 340 },
    { x: 3.916, y: 360 },
    criticalPoint
];

// Saturated vapor line (sg) — right boundary of the saturation dome
export const sgData = [
    { x: 9.155, y: 0.01 },
    { x: 8.250, y: 40 },
    { x: 7.550, y: 80 },
    { x: 7.000, y: 120 },
    { x: 6.550, y: 160 },
    { x: 6.150, y: 200 },
    { x: 5.800, y: 240 },
    { x: 5.450, y: 280 },
    { x: 5.080, y: 320 },
    { x: 4.850, y: 340 },
    { x: 4.650, y: 360 },
    criticalPoint
];
