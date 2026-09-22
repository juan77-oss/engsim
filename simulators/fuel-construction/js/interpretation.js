/**
 * ui/interpretation.js — Intelligent Interpretation Engine (Auto-Tutor)
 * -------------------------------------------------------------------
 * PURPOSE : Generates engineering interpretations based on results.
 *           Only active in Learning Mode.
 */

/**
 * Generates a technical interpretation of the current simulation results.
 * @param {Object} fuelState - The current fuel state from computeFuel()
 * @returns {string} - Technical interpretation text
 */
export function generateInterpretation(fuelState) {
    if (!fuelState || !fuelState.valid) return "";

    const { dry, humidity, waterFraction } = fuelState;
    let parts = [];

    // 1. Carbon analysis (energy density)
    if (dry.C > 80) {
        parts.push("We are looking at a fuel with <strong>high energy density</strong>. The predominance of carbon suggests a refined solid fuel or high-rank coal.");
    } else if (dry.C < 45) {
        parts.push("The low carbon concentration indicates a fuel with <strong>low heating value</strong>, characteristic of biomass or organic residues.");
    }

    // 2. Moisture analysis (operational impact)
    if (humidity > 30) {
        parts.push(`The moisture of ${humidity.toFixed(1)}% is <strong>critical</strong>. Water represents almost a third of the mass, which will severely penalize flame temperature and thermal efficiency.`);
    } else if (humidity > 5) {
        parts.push(`The presence of moisture (${humidity.toFixed(1)}%) dilutes the active components. Observe how the wet basis reduces the available energy per kg proportionally.`);
    } else if (humidity === 0) {
        parts.push("On a dry basis (Hu = 0%), we analyze the material in its pure energetic state — ideal for comparing fuel qualities without moisture interference.");
    }

    // 3. Sulfur and environmental impact
    if (dry.S > 1.5) {
        parts.push("<strong>Environmental warning:</strong> Sulfur content is elevated, which will result in SO₂ emissions that likely require flue gas treatment systems.");
    }

    // 4. Oxygen and reactivity
    if (dry.O > 20) {
        parts.push("The high inherent oxygen content favors initial reactivity, but reduces the heating value compared to a pure hydrocarbon.");
    }

    return parts.join(" ");
}

/**
 * Renders the Auto-Tutor card HTML.
 * @param {string} text - The interpretation text
 * @returns {string} - HTML string
 */
export function renderTutorCard(text) {
    if (!text) return "";

    return `
        <div class="tutor-card">
            <div class="tutor-card__header">
                <span style="font-size: 1.2rem;">🎓</span>
                <span>Auto-Tutor: System Interpretation</span>
            </div>
            <div class="tutor-card__body">
                ${text}
            </div>
            <div class="tutor-card__footer">
                Real-time analysis based on stoichiometric mass balances.
            </div>
        </div>
    `;
}