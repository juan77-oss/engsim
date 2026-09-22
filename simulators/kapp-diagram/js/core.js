/**
 * core.js — Transformer Simulator — Physics Engine
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE: Physically correct transformer model based on infinite bus.
 *          Uses complex algebra exclusively. Independent of UI/DOM.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Calculates the transformer state using a physically correct infinite bus model.
 *
 * @param {object} params - Input parameters
 * @param {number} params.U1_nominal   - Grid voltage (V)
 * @param {number} params.I_mag        - Load current magnitude (A)
 * @param {number} params.cosPhi       - Power factor (-1 to 1)
 * @param {string} params.mode         - 'inductive' | 'capacitive'
 * @param {number} params.Vcc          - Short-circuit voltage (V or %)
 * @param {string} params.vccMode      - 'percent' | 'absolute'
 * @param {number} params.phi_cc       - Short-circuit angle (degrees)
 * @param {number} params.I_nominal    - Nominal current (A)
 * @returns {object} Resulting phasors, magnitudes and regulation
 */
export function calculateTransformerModel(params) {
    const {
        U1_nominal,
        I_mag,
        cosPhi,
        mode,
        Vcc,
        phi_cc,
        I_nominal
    } = params;

    // 1. Clamp cosPhi
    const cosPhiClamped = Math.max(-1, Math.min(1, cosPhi));

    // 2. Convert φcc to radians
    const phi_cc_rad = phi_cc * Math.PI / 180;

    // 3. Load angle φ
    // Inductive (lagging) -> negative angle
    // Capacitive (leading) -> positive angle
    const phi = Math.acos(cosPhiClamped) * (mode === 'inductive' ? -1 : 1);

    // 4. Complex Current
    const I = {
        re: I_mag * Math.cos(phi),
        im: I_mag * Math.sin(phi)
    };

    // 5. Equivalent Impedance from Short-Circuit Test
    // Zeq = Vcc / I_nominal
    // Adapt Vcc based on input mode (percent or absolute voltage)
    let Vcc_real;
    if (params.vccMode === 'percent') {
        Vcc_real = (Vcc / 100) * U1_nominal;
    } else {
        Vcc_real = Vcc;
    }

    const Zeq = I_nominal > 1e-6 ? Vcc_real / I_nominal : 0;

    const Req = Zeq * Math.cos(phi_cc_rad);
    const Xeq = Zeq * Math.sin(phi_cc_rad);

    const Z = { re: Req, im: Xeq };

    // 6. Voltage Drop (dV = Z * I)
    const dV = {
        re: Z.re * I.re - Z.im * I.im,
        im: Z.re * I.im + Z.im * I.re
    };

    // 7. Primary Voltage (FIXED — infinite bus)
    const U1 = {
        re: U1_nominal,
        im: 0
    };

    // 8. Secondary Voltage
    const U2 = {
        re: U1.re - dV.re,
        im: U1.im - dV.im
    };

    // 9. Magnitudes
    const U1_mag = U1_nominal;
    const U2_mag = Math.hypot(U2.re, U2.im);
    const dV_mag = Math.hypot(dV.re, dV.im);

    // 10. Regulation
    const deltaU_volts = U1_mag - U2_mag;

    const regulation_pct = U2_mag > 1e-6
        ? (deltaU_volts / U2_mag) * 100
        : 0;

    // 11. Return Object
    return {
        valid: true,
        U1,
        U2,
        I,
        dV,

        Req,
        Xeq,

        U1_mag,
        U2_mag,
        dV_mag,

        deltaU_volts,
        regulation_pct,

        phi,
        cosPhi: cosPhiClamped
    };
}