/**
 * ui/insights.js — Pedagogical Insights · Combustion Phase 1
 * -------------------------------------------------------------------
 * PURPOSE : Generates and renders contextual educational messages
 *           based on the current fuel state.
 *
 *           Pedagogical objective PHASE 1:
 *           - Help the user understand what they are building
 *           - Show the effect of moisture on the fuel
 *           - Clarify that moisture DILUTES, it does not add energy
 *
 * RULES   :
 *   - No physical logic (only interprets results from core.js)
 *   - Returns HTML strings — does not manipulate the DOM directly
 *
 * EXPORTS :
 *   generateInsights(fuelState) -> Array of insight objects
 *   renderInsights(insights)    -> HTML string to inject
 * -------------------------------------------------------------------
 */

// Pedagogical thresholds (movidos a constants.js — se importan aquí)
import { THRESHOLDS } from './constants.js';


/**
 * Analyzes the fuel state and generates pedagogical insights.
 *
 * @param {{ valid, dry, wet, humidity, waterFraction, basis }} fuelState
 * @returns {Array<{ type: string, title: string, body: string }>}
 */
export function generateInsights(fuelState) {
    if (!fuelState || !fuelState.valid) return [];

    const insights = [];
    const { dry, humidity, waterFraction, basis } = fuelState;

    // 1. Active basis insight
    if (basis === 'dry') {
        insights.push({
            type:  'info',
            title: 'Fuel on dry basis',
            body:  'Hu = 0 %. The composition represents the fuel without moisture. ' +
                   'This is the reference basis for all calculations.'
        });
    } else {
        const dampingPct = (humidity).toFixed(1);

        if (humidity < THRESHOLDS.humidityLow) {
            insights.push({
                type:  'info',
                title: 'Low moisture detected',
                body:  `Hu = ${dampingPct} %. Moisture slightly dilutes the fuel. ` +
                       `The conversion factor is (1 - ${dampingPct}/100) = ${(1 - humidity/100).toFixed(3)}.`
            });
        } else if (humidity < THRESHOLDS.humidityMed) {
            insights.push({
                type:  'warning',
                title: 'Visible moisture dilution',
                body:  `Hu = ${dampingPct} %. Water occupies ${waterFraction.toFixed(1)} % of the wet mixture. ` +
                       `This reduces the concentration of all combustible components without contributing any energy.`
            });
        } else if (humidity < THRESHOLDS.humidityHigh) {
            insights.push({
                type:  'warning',
                title: 'Moderate moisture — significant dilution',
                body:  `Hu = ${dampingPct} %. Water represents ${waterFraction.toFixed(1)} % of the wet fuel. ` +
                       `Notice how the wet-basis composition is noticeably lower than the dry basis. ` +
                       `The actual available energy is substantially reduced.`
            });
        } else {
            insights.push({
                type:  'danger',
                title: 'High moisture — severely diluted fuel',
                body:  `Hu = ${dampingPct} %. Water represents ${waterFraction.toFixed(1)} % of the mixture. ` +
                       `At this level, ignition may be difficult and combustion efficiency drops sharply. ` +
                       `The fuel delivers much less energy per kg.`
            });
        }
    }

    // 2. Fuel quality (dry basis)
    if (dry.C > THRESHOLDS.carbonHigh) {
        insights.push({
            type:  'success',
            title: 'High carbon content — premium fuel',
            body:  `C = ${dry.C.toFixed(1)} %. High carbon concentration, ` +
                   `characteristic of anthracitic coals or graphite. ` +
                   `Typical of solid fuels with high energy density.`
        });
    } else if (dry.C < THRESHOLDS.carbonLow) {
        insights.push({
            type:  'warning',
            title: 'Low carbon content — lean fuel',
            body:  `C = ${dry.C.toFixed(1)} %. Low carbon content. ` +
                   `The calculated heating value will be reduced. ` +
                   `This may correspond to peat, wet biomass, or organic waste.`
        });
    }

    // 3. Ash content
    if (dry.Z > THRESHOLDS.ashHigh) {
        insights.push({
            type:  'warning',
            title: 'High ash content',
            body:  `Z = ${dry.Z.toFixed(1)} %. Ash is inert matter: it contributes no energy ` +
                   `and does not participate in the reaction. High ash content reduces the heating value ` +
                   `and creates operational issues in boilers.`
        });
    }

    // 4. Sulfur
    if (dry.S > THRESHOLDS.sulfurHigh) {
        insights.push({
            type:  'warning',
            title: 'Elevated sulfur — environmental impact',
            body:  `S = ${dry.S.toFixed(1)} %. Sulfur contributes some energy when burned, ` +
                   `but produces SO2 (sulfur dioxide), a regulated pollutant. ` +
                   `Fuels with S > 3 % require flue gas treatment.`
        });
    }

    // 5. Hydrogen/water analysis (formerly PRO-locked, now free for all)
    if (dry.H > 5) {
        insights.push({
            type:  'info',
            title: 'Hydrogen/water impact analysis',
            body:  `Notice that the high hydrogen content (${dry.H.toFixed(1)}%) significantly increases ` +
                   `the PCS-PCI difference due to combustion water formation. This represents latent ` +
                   `energy that is not recovered unless flue gas condensation occurs.`
        });
    }

    return insights;
}


/**
 * Converts an array of insights into an HTML block.
 * All insights are rendered without any access restrictions.
 *
 * @param {Array<{ type, title, body }>} insights
 * @returns {string} - HTML string to inject
 */
export function renderInsights(insights) {
    if (!insights || insights.length === 0) return '';

    const icons = {
        info:    'i',
        warning: '!',
        danger:  'x',
        success: 'v'
    };

    const emojiIcons = {
        info:    '\u2139\uFE0F',
        warning: '\u26A0\uFE0F',
        danger:  '\uD83D\uDD34',
        success: '\u2705'
    };

    const items = insights.map(ins => {
        const typeClass = ins.type ?? 'info';
        const icon      = emojiIcons[ins.type] ?? emojiIcons.info;

        // Truncate long bodies with a Read more toggle
        const isLong = ins.body.length > 140;
        const bodyContent = isLong
            ? `<div class="insight-body-wrapper" data-full-text="${ins.body}">
                 <span class="insight-text-short">${ins.body.substring(0, 110)}...</span>
                 <button class="insight-read-more" onclick="this.parentElement.classList.toggle('expanded')">Read more</button>
                 <span class="insight-text-full">${ins.body}</span>
               </div>`
            : ins.body;

        return `
            <div class="comb-insight comb-insight--${typeClass}">
                <div class="comb-insight__icon">${icon}</div>
                <div class="comb-insight__content">
                    <div class="comb-insight__title">${ins.title}</div>
                    <div class="comb-insight__body">${bodyContent}</div>
                </div>
            </div>
        `;
    }).join('');

    return `<div class="comb-insights">${items}</div>`;
}