/**
 * core.js — T–s Diagram (Water)
 * engsim.app
 *
 * Pure thermodynamic calculations for the T–s diagram engine.
 * No DOM access here, and no Chart.js — just math over the
 * saturation dataset defined in constants.js.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { criticalPoint, sfData, sgData } from './constants.js';

/**
 * Interpolates the saturation entropy values (sf and sg) at a given
 * temperature using the built-in saturation dataset.
 * @param {number} t - Temperature in °C
 * @returns {{sf: number, sg: number}}
 */
export function getSaturationAtTemperature(t) {
    if (t >= criticalPoint.y) {
        return { sf: criticalPoint.x, sg: criticalPoint.x };
    }

    let sf = 0;
    let sg = 0;

    // Interpolate sf
    for (let i = 0; i < sfData.length - 1; i++) {
        const p1 = sfData[i];
        const p2 = sfData[i + 1];
        if (t >= p1.y && t <= p2.y) {
            const ratio = (t - p1.y) / (p2.y - p1.y);
            sf = p1.x + ratio * (p2.x - p1.x);
            break;
        }
    }

    // Interpolate sg
    for (let i = 0; i < sgData.length - 1; i++) {
        const p1 = sgData[i];
        const p2 = sgData[i + 1];
        if (t >= p1.y && t <= p2.y) {
            const ratio = (t - p1.y) / (p2.y - p1.y);
            sg = p1.x + ratio * (p2.x - p1.x);
            break;
        }
    }

    return { sf: sf || sfData[0].x, sg: sg || sgData[0].x };
}

/**
 * Calculates the thermodynamic state of water from temperature and
 * specific entropy: region classification and, when applicable,
 * vapor quality.
 * @param {number} t - Temperature in °C
 * @param {number} s - Specific entropy in kJ/(kg·K)
 * @returns {Object} Calculated state: {t, s, region, qualityVal, isMixture, isCritical, sf, sg}
 */
export function calculateThermodynamicState(t, s) {
    const sat = getSaturationAtTemperature(t);
    const sf = sat.sf;
    const sg = sat.sg;

    let region = "";
    let qualityVal = 0;
    let isMixture = false;
    let isCritical = false;

    if (t > criticalPoint.y) {
        region = "Supercritical Fluid";
    } else {
        if (s < sf) {
            region = "Compressed Liquid";
        } else if (s > sg) {
            region = "Superheated Vapor";
        } else {
            region = "Two-phase Mixture";
            isMixture = true;
            // Quality x = (s - sf) / (sg - sf)
            const denom = sg - sf;
            if (denom > 0) {
                qualityVal = (s - sf) / denom;
                qualityVal = Math.max(0, Math.min(1, qualityVal));
            } else {
                qualityVal = 0.5;
                isCritical = true;
            }
        }
    }

    return {
        t,
        s,
        region,
        qualityVal,
        isMixture,
        isCritical,
        sf,
        sg
    };
}
