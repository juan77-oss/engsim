/**
 * simulators/dc-circuit-analyzer/js/core.js
 * DC Circuit Analyzer (Core Layer)
 * ─────────────────────────────────────────────────────────────────────────
 * Contiene exclusivamente:
 *   - Constantes de conversión física (UNIT_FACTORS)
 *   - Métodos puros de conversión (toOhms, fromOhms)
 *   - Motor de cálculo del circuito (calculateCC)
 *   - Motor de Thevenin / transferencia máxima de potencia (maxPowerTransfer)
 *
 * NO contiene DOM ni interacción visual.
 */

'use strict';

// --- Unit configuration ---
export const UNIT_FACTORS = {
    "mΩ": 1e-3,
    "Ω": 1,
    "kΩ": 1e3,
    "MΩ": 1e6
};

export function toOhms(value, unit) {
    return value * (UNIT_FACTORS[unit] || 1);
}

export function fromOhms(ohms, unit) {
    return ohms / (UNIT_FACTORS[unit] || 1);
}

/**
 * Thevenin equivalent as seen from the RL terminals (source shorted,
 * load removed).
 */
function thevenin({ V, R1, R2, networkType }) {
    if (networkType === 'series') {
        return { Rth: R1 + R2, Vth: V };
    }
    const Rth = (R1 + R2) > 0 ? (R1 * R2) / (R1 + R2) : 0;
    const Vth = (R1 + R2) > 0 ? V * (R2 / (R1 + R2)) : 0;
    return { Rth, Vth };
}

/**
 * Solves the circuit for the selected topology.
 *
 * "series"   → V — R1 — R2 — RL, all in series.
 * "parallel" → V — R1 — (R2 ∥ RL), R1 acts as the series/source resistance,
 *              R2 and the variable load RL share the same node.
 *
 * @param {{V:number, R1:number, R2:number, RL:number, networkType:'series'|'parallel'}} p
 */
export function calculateCC({ V, R1, R2, RL, networkType }) {
    const { Rth, Vth } = thevenin({ V, R1, R2, networkType });

    if (networkType === 'series') {
        const Req = R1 + R2 + RL;
        const Itotal = Req > 0 ? V / Req : 0;
        const I_R1 = Itotal, I_R2 = Itotal, I_RL = Itotal;
        const V_R1 = Itotal * R1, V_R2 = Itotal * R2, V_RL = Itotal * RL;
        const P_R1 = Itotal * Itotal * R1;
        const P_R2 = Itotal * Itotal * R2;
        const P_RL = Itotal * Itotal * RL;
        const PTotal = V * Itotal;
        const eta = PTotal > 0 ? P_RL / PTotal : 0; // fraction 0..1
        return { Req, Itotal, I_R1, I_R2, I_RL, V_R1, V_R2, V_RL, P_R1, P_R2, P_RL, PTotal, eta, Rth, Vth };
    }

    // parallel
    const Rp = (R2 + RL) > 0 ? (R2 * RL) / (R2 + RL) : 0;
    const Req = R1 + Rp;
    const Itotal = Req > 0 ? V / Req : 0;
    const Vnode = Itotal * Rp;
    const I_R1 = Itotal;
    const I_R2 = R2 > 0 ? Vnode / R2 : 0;
    const I_RL = RL > 0 ? Vnode / RL : 0;
    const V_R1 = Itotal * R1, V_R2 = Vnode, V_RL = Vnode;
    const P_R1 = Itotal * Itotal * R1;
    const P_R2 = R2 > 0 ? (Vnode * Vnode) / R2 : 0;
    const P_RL = RL > 0 ? (Vnode * Vnode) / RL : 0;
    const PTotal = V * Itotal;
    const eta = PTotal > 0 ? P_RL / PTotal : 0; // fraction 0..1
    return { Rp, Req, Itotal, Vnode, I_R1, I_R2, I_RL, V_R1, V_R2, V_RL, P_R1, P_R2, P_RL, PTotal, eta, Rth, Vth };
}

/**
 * Maximum power transfer point: RL_opt equals the Thevenin resistance
 * seen from the load terminals (RL_opt = Rth).
 */
export function maxPowerTransfer({ V, R1, R2, networkType }) {
    const { Rth, Vth } = thevenin({ V, R1, R2, networkType });
    const Pmax = Rth > 0 ? (Vth * Vth) / (4 * Rth) : 0;
    return { Rth, Vth, RL_opt: Rth, Pmax };
}
