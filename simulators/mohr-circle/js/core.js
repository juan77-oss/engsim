/**
 * @module core
 * @description
 * Pure physics core for Mohr's Circle analysis under plane stress.
 *
 * Implements:
 *  - Principal stresses (σ₁, σ₂)
 *  - Average stress and radius
 *  - Maximum shear stress
 *  - Angle of principal planes (radians and degrees)
 *  - Stress transformation at an arbitrary angle
 *  - Automated validation suite (runValidationSuite)
 *
 * Conventions:
 *  - Positive normal stress  → tension
 *  - Positive shear stress   → counter-clockwise on positive face (engineering sign convention)
 *  - All angles in RADIANS internally; degrees provided for convenience
 *  - θ is the PHYSICAL rotation angle; Mohr's Circle uses 2θ internally
 *
 * No DOM, no UI, no side effects.
 * ES Module syntax — import specific functions or use the default export object.
 *
 * @version 1.1.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert radians to degrees.
 * @param {number} rad
 * @returns {number}
 */
function toDegrees(rad) {
    return rad * (180 / Math.PI);
}

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
function toRadians(deg) {
    return deg * (Math.PI / 180);
}


// ─────────────────────────────────────────────────────────────────────────────
// SIGN CONVENTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Available sign conventions for the Mohr's Circle diagram.
 *
 * PHYSICS IS IDENTICAL IN BOTH — only the diagram orientation differs:
 *
 *  MATERIALS ('materials') — default, mathematical convention:
 *    Positive τ plots UPWARD  on the diagram.
 *    As θ increases, the radius sweeps COUNTER-CLOCKWISE on the circle.
 *    Used in: Callister, Shackelford, most European textbooks.
 *
 *  MECHANICS ('mechanics') — engineering convention:
 *    Positive τ plots DOWNWARD on the diagram.
 *    As θ increases, the radius sweeps CLOCKWISE on the circle.
 *    Used in: Hibbeler, Beer & Johnston, most US engineering textbooks.
 *
 * KEY RULE: σ_avg, R, σ₁, σ₂, τ_max are IDENTICAL in both conventions.
 * Only the y-axis direction of the Mohr's diagram changes.
 *
 * @readonly
 * @enum {string}
 */
const CONVENTIONS = Object.freeze({
    MATERIALS: 'materials',   // τ+ upward,   CCW sweep  (default)
    MECHANICS: 'mechanics',   // τ+ downward, CW  sweep
});

/**
 * Return the sign multiplier for shear stress under the active convention.
 *
 * Usage in renderers:
 *   const tauMul = getConventionSign(convention);
 *   canvas.toCanvas(sigma, tauMul * tau);   // flips y-axis for mechanics
 *
 * Note: this NEVER changes the physics. It is purely a display transform.
 *
 * @param {string} convention - One of CONVENTIONS.MATERIALS | CONVENTIONS.MECHANICS
 * @returns {1 | -1}
 */
function getConventionSign(convention) {
    return convention === CONVENTIONS.MECHANICS ? -1 : 1;
}

/**
 * Guard against non-finite inputs.
 * Throws a descriptive error if any value is NaN or Infinity.
 * @param {Object} params - Named stress component values.
 */
function validateInputs({ sigma_x, sigma_y, tau_xy }) {
    const entries = { sigma_x, sigma_y, tau_xy };
    for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== 'number' || !isFinite(value)) {
            throw new TypeError(
                `[mohr-core] Invalid input: "${key}" must be a finite number. Received: ${value}`
            );
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CORE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the full Mohr's Circle solution for a plane stress state.
 *
 * @param {number} sigma_x  - Normal stress in the x-direction [Pa, MPa, ksi, or any consistent unit]
 * @param {number} sigma_y  - Normal stress in the y-direction [same unit]
 * @param {number} tau_xy   - Shear stress on the xy-plane [same unit]
 *
 * @returns {MohrResult} A structured object with all computed quantities.
 *
 * @throws {TypeError} If any input is not a finite number.
 *
 * @example
 * const result = computeMohrCircle(80, -20, 30);
 * console.log(result.sigma1);  // → 90.0
 */
function computeMohrCircle(sigma_x, sigma_y, tau_xy) {
    validateInputs({ sigma_x, sigma_y, tau_xy });

    // ── Average (center of Mohr's Circle on the σ-axis) ──────────────────────
    const sigma_avg = (sigma_x + sigma_y) / 2;

    // ── Radius ────────────────────────────────────────────────────────────────
    // R = √[ ((σx - σy)/2)² + τxy² ]
    const half_diff = (sigma_x - sigma_y) / 2;
    const R = Math.sqrt(half_diff ** 2 + tau_xy ** 2);

    // ── Principal stresses ────────────────────────────────────────────────────
    // σ₁ ≥ σ₂ by definition
    const sigma1 = sigma_avg + R;
    const sigma2 = sigma_avg - R;

    // ── Maximum shear stress ──────────────────────────────────────────────────
    // τ_max = R  (occurs on planes rotated 45° from principal planes)
    const tau_max = R;

    // ── Angle of principal plane 1 (θ_p) ─────────────────────────────────────
    // Using atan2 for full-quadrant correctness.
    // Formula: θ_p = (1/2) · atan2(2·τxy, σx - σy)
    // Result is in the range (-π/2, π/2].
    //
    // NOTE: When σx === σy and τxy === 0 (hydrostatic state),
    //       atan2(0, 0) = 0, which is numerically stable and physically correct
    //       (any direction is principal).
    const theta_p_rad = 0.5 * Math.atan2(2 * tau_xy, sigma_x - sigma_y);
    const theta_p_deg = toDegrees(theta_p_rad);

    // ── Angle of principal plane 2 ────────────────────────────────────────────
    // Perpendicular to plane 1
    const theta_p2_rad = theta_p_rad + Math.PI / 2;
    const theta_p2_deg = toDegrees(theta_p2_rad);

    // ── Angle of maximum shear stress plane ───────────────────────────────────
    // Rotated 45° from principal planes
    const theta_s_rad = theta_p_rad - Math.PI / 4;
    const theta_s_deg = toDegrees(theta_s_rad);

    // ── Hydrostatic flag ──────────────────────────────────────────────────────
    // A state is hydrostatic when the Mohr's Circle degenerates to a single point
    // (R ≈ 0), meaning all planes carry the same normal stress and zero shear.
    //
    // Threshold choice:
    //   We use a RELATIVE tolerance: R < |sigma_avg| * REL_TOL + ABS_TOL
    //   because inputs from sliders or typed fields may differ by ~1e-10 even
    //   when the user intends an exact hydrostatic state.
    //   Number.EPSILON (≈2.2e-16) is too tight for floating-point arithmetic on
    //   typical engineering magnitudes (10–500 MPa).
    //
    //   REL_TOL = 1e-9 → a circle of R = 1e-7 MPa on a 100 MPa field is hydrostatic.
    //   ABS_TOL = 1e-12 → catches the exact-zero case when sigma_avg === 0.
    const REL_TOL = 1e-9;
    const ABS_TOL = 1e-12;
    const isHydrostatic = R < Math.abs(sigma_avg) * REL_TOL + ABS_TOL;

    /**
     * @typedef {Object} MohrResult
     * @property {number} sigma_x       - Input: normal stress σx
     * @property {number} sigma_y       - Input: normal stress σy
     * @property {number} tau_xy        - Input: shear stress τxy
     * @property {number} sigma_avg     - Center of Mohr's Circle (average normal stress)
     * @property {number} R             - Radius of Mohr's Circle
     * @property {number} sigma1        - Maximum principal stress
     * @property {number} sigma2        - Minimum principal stress
     * @property {number} tau_max       - Maximum in-plane shear stress
     * @property {number} theta_p_rad   - Angle to principal plane 1 [rad]
     * @property {number} theta_p_deg   - Angle to principal plane 1 [degrees]
     * @property {number} theta_p2_rad  - Angle to principal plane 2 [rad]
     * @property {number} theta_p2_deg  - Angle to principal plane 2 [degrees]
     * @property {number} theta_s_rad   - Angle to max shear plane [rad]
     * @property {number} theta_s_deg   - Angle to max shear plane [degrees]
     * @property {boolean} isHydrostatic - True when σx = σy and τxy = 0
     */
    return {
        // ── Inputs (echoed for traceability) ──────────────────────────────────
        sigma_x,
        sigma_y,
        tau_xy,

        // ── Circle geometry ───────────────────────────────────────────────────
        sigma_avg,
        R,

        // ── Principal stresses ────────────────────────────────────────────────
        sigma1,
        sigma2,

        // ── Shear ─────────────────────────────────────────────────────────────
        tau_max,

        // ── Angles ────────────────────────────────────────────────────────────
        theta_p_rad,
        theta_p_deg,
        theta_p2_rad,
        theta_p2_deg,
        theta_s_rad,
        theta_s_deg,

        // ── Diagnostics ───────────────────────────────────────────────────────
        isHydrostatic,
    };
}


// ─────────────────────────────────────────────────────────────────────────────
// STRESS TRANSFORMATION AT ARBITRARY ANGLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the normal and shear stresses on a plane inclined at angle θ
 * from the x-axis, using the general stress transformation equations.
 *
 * Equations — TWO EQUIVALENT FORMS (both are implemented; the expanded form
 * is used here because it avoids a separate call to computeMohrCircle):
 *
 *   COMPACT: σ(θ) = σ_avg + R · cos(2θ − 2θp)
 *            τ(θ) = −R · sin(2θ − 2θp)
 *
 *   EXPANDED (used here — algebraically identical, no θp dependency):
 *            σ(θ) = (σx+σy)/2 + (σx-σy)/2·cos(2θ) + τxy·sin(2θ)
 *            τ(θ) = −(σx-σy)/2·sin(2θ) + τxy·cos(2θ)
 *
 * Sign convention for τ(θ):
 *   Positive τ = counter-clockwise shear on the positive-normal face.
 *   This matches the plotting convention used in mohr-plot.js where τ
 *   increases upward on the σ–τ diagram.
 *
 * θ is the PHYSICAL rotation angle of the plane (not 2θ).
 * The factor 2 is applied internally: two_theta = 2 * theta.
 *
 * Key identities (easy sanity checks):
 *   θ = 0          → σ = σx,    τ = τxy
 *   θ = θp         → σ = σ1,   τ ≈ 0
 *   θ = θp + 90°   → σ = σ2,   τ ≈ 0
 *   θ = θp + 45°   → σ = σ_avg, τ = +τmax or −τmax (sign depends on quadrant)
 *   θ = θp − 45°   → σ = σ_avg, τ = −τmax or +τmax
 *
 * @param {number} sigma_x  - Normal stress in x [consistent unit]
 * @param {number} sigma_y  - Normal stress in y [consistent unit]
 * @param {number} tau_xy   - Shear stress [consistent unit]
 * @param {number} theta    - Rotation angle [radians] measured from x-axis
 *
 * @returns {{ sigma_theta: number, tau_theta: number }}
 *   Normal stress and shear stress on the rotated plane.
 *
 * @throws {TypeError} If any input is not a finite number.
 *
 * @example
 * const { sigma_theta, tau_theta } = getStressAtAngle(80, -20, 30, Math.PI / 6);
 */
function getStressAtAngle(sigma_x, sigma_y, tau_xy, theta) {
    validateInputs({ sigma_x, sigma_y, tau_xy });

    if (typeof theta !== 'number' || !isFinite(theta)) {
        throw new TypeError(
            `[mohr-core] Invalid input: "theta" must be a finite number in radians. Received: ${theta}`
        );
    }

    const two_theta = 2 * theta;
    const cos2 = Math.cos(two_theta);
    const sin2 = Math.sin(two_theta);
    const half_diff = (sigma_x - sigma_y) / 2;
    const sigma_avg = (sigma_x + sigma_y) / 2;

    // Normal stress on rotated plane
    const sigma_theta = sigma_avg + half_diff * cos2 + tau_xy * sin2;

    // Shear stress on rotated plane
    const tau_theta = -half_diff * sin2 + tau_xy * cos2;

    return { sigma_theta, tau_theta };
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATED VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a set of physics invariant checks for a given stress state.
 *
 * Tests verified:
 *
 *  TEST 1 — Identity at θ = 0
 *    σ(0) === σx        (transformation returns original x-face)
 *    τ(0) === τxy
 *
 *  TEST 2 — Principal plane 1 (θ = θp)
 *    τ(θp) ≈ 0          (no shear on principal plane)
 *    σ(θp) ≈ σ1        (max principal stress)
 *
 *  TEST 3 — Principal plane 2 (θ = θp + 90°)
 *    τ(θp + 90°) ≈ 0
 *    σ(θp + 90°) ≈ σ2
 *
 *  TEST 4 — Max shear plane (θ = θp + 45°)
 *    σ(θp + 45°) ≈ σ_avg
 *    |τ(θp + 45°)| ≈ τmax = R
 *
 *  TEST 5 — Circle equation: every point must satisfy
 *    (σ - σ_avg)² + τ² ≈ R²
 *    (checked at θ = 0, θp, θp+45°, θp+90°, θp+135°)
 *
 *  TEST 6 — Hydrostatic state: R = 0, σ1 = σ2 = σ_avg
 *    (only runs when sigma_x === sigma_y and tau_xy === 0)
 *
 * All comparisons use an absolute tolerance of 1e-9 (appropriate for
 * double-precision floating-point at typical engineering magnitudes).
 *
 * @param {number} sigma_x
 * @param {number} sigma_y
 * @param {number} tau_xy
 * @returns {ValidationReport} Structured report with pass/fail and details.
 *
 * @typedef {Object} TestResult
 * @property {string}  name     - Descriptive name of the check
 * @property {boolean} pass     - True if the check passed
 * @property {number}  expected - Expected value
 * @property {number}  actual   - Computed value
 * @property {number}  delta    - Absolute difference
 *
 * @typedef {Object} ValidationReport
 * @property {boolean}      allPass  - True when every individual test passed
 * @property {TestResult[]} tests    - Ordered list of individual results
 * @property {MohrResult}   mohr     - Full Mohr's Circle result for reference
 * @property {string}       summary  - Human-readable one-liner
 */
function runValidationSuite(sigma_x, sigma_y, tau_xy) {
    const TOL = 1e-9;   // absolute tolerance
    const mohr = computeMohrCircle(sigma_x, sigma_y, tau_xy);
    const { sigma_avg, R, sigma1, sigma2, tau_max, theta_p_rad } = mohr;

    /** @param {number} a @param {number} b @returns {boolean} */
    const near = (a, b) => Math.abs(a - b) < TOL;

    /** Helper: build a TestResult */
    function check(name, expected, actual) {
        const delta = Math.abs(actual - expected);
        return { name, pass: delta < TOL, expected, actual, delta };
    }

    const tests = [];

    // ── TEST 1: Identity at θ = 0 ──────────────────────────────────────────────
    {
        const { sigma_theta, tau_theta } = getStressAtAngle(sigma_x, sigma_y, tau_xy, 0);
        tests.push(check('T1a: σ(0) = σx', sigma_x, sigma_theta));
        tests.push(check('T1b: τ(0) = τxy', tau_xy, tau_theta));
    }

    // ── TEST 2: Principal plane 1 at θ = θp ─────────────────────────────────
    // On a principal plane: shear vanishes, normal = σ1
    {
        const { sigma_theta, tau_theta } = getStressAtAngle(sigma_x, sigma_y, tau_xy, theta_p_rad);
        tests.push(check('T2a: σ(θp) = σ1', sigma1, sigma_theta));
        tests.push(check('T2b: τ(θp) = 0', 0, tau_theta));
    }

    // ── TEST 3: Principal plane 2 at θ = θp + 90° ────────────────────────────
    {
        const { sigma_theta, tau_theta } = getStressAtAngle(
            sigma_x, sigma_y, tau_xy, theta_p_rad + Math.PI / 2
        );
        tests.push(check('T3a: σ(θp+90°) = σ2', sigma2, sigma_theta));
        tests.push(check('T3b: τ(θp+90°) = 0', 0, tau_theta));
    }

    // ── TEST 4: Max shear at θ = θp + 45° ─────────────────────────────────────
    // σ = σ_avg;  |τ| = τ_max = R
    // Note: the SIGN of τ at this angle depends on the orientation of the state.
    // We check the magnitude to avoid a sign-sensitive failure.
    {
        const { sigma_theta, tau_theta } = getStressAtAngle(
            sigma_x, sigma_y, tau_xy, theta_p_rad + Math.PI / 4
        );
        tests.push(check('T4a: σ(θp+45°) = σ_avg', sigma_avg, sigma_theta));
        tests.push(check('T4b: |τ(θp+45°)| = τmax', tau_max, Math.abs(tau_theta)));
    }

    // ── TEST 5: Circle equation (σ-σ_avg)² + τ² = R² ─────────────────────────
    // Verified at five distinct angles
    const circleAngles = [
        0,
        theta_p_rad,
        theta_p_rad + Math.PI / 4,
        theta_p_rad + Math.PI / 2,
        theta_p_rad + (3 * Math.PI) / 4,
    ];
    circleAngles.forEach((angle, i) => {
        const { sigma_theta, tau_theta } = getStressAtAngle(sigma_x, sigma_y, tau_xy, angle);
        const lhs = (sigma_theta - sigma_avg) ** 2 + tau_theta ** 2;
        const rhs = R ** 2;
        tests.push(check(`T5.${String.fromCharCode(97 + i)
            }: circle eq at angle ${i}`, rhs, lhs));
    });

    // ── TEST 6: Hydrostatic state (only when applicable) ─────────────────────
    if (mohr.isHydrostatic) {
        tests.push(check('T6a: hydrostatic σ1 = σ_avg', sigma_avg, sigma1));
        tests.push(check('T6b: hydrostatic σ2 = σ_avg', sigma_avg, sigma2));
        tests.push(check('T6c: hydrostatic R = 0', 0, R));
    }

    const allPass = tests.every(t => t.pass);
    const nFail = tests.filter(t => !t.pass).length;
    const summary = allPass
        ? `✅ All ${tests.length} physics checks passed.`
        : `❌ ${nFail} of ${tests.length} checks FAILED. Review results.tests for details.`;

    return { allPass, tests, mohr, summary };
}


// ─────────────────────────────────────────────────────────────────────────────
// CIRCLE POINT GENERATION  (utility for rendering)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate an array of (σ, τ) points on Mohr's Circle for plotting.
 *
 * Parameterises the circle as:
 *   σ(α) = σ_avg + R · cos(α)
 *   τ(α) = R · sin(α)
 * where α sweeps [0, 2π).
 *
 * NOTE: This is the plotting circle in stress-space, NOT the physical rotation.
 *       One full revolution on the circle = 180° physical rotation.
 *
 * @param {MohrResult} mohrResult  - Result from computeMohrCircle()
 * @param {number}     [steps=360] - Number of discrete points (resolution)
 *
 * @returns {Array<{sigma: number, tau: number}>}
 */
function generateCirclePoints(mohrResult, steps = 360) {
    const { sigma_avg, R } = mohrResult;
    const points = [];

    for (let i = 0; i <= steps; i++) {
        const alpha = (2 * Math.PI * i) / steps;
        points.push({
            sigma: sigma_avg + R * Math.cos(alpha),
            tau: R * Math.sin(alpha),
        });
    }

    return points;
}


// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS  (ES Module)
// ─────────────────────────────────────────────────────────────────────────────

export {
    computeMohrCircle,
    getStressAtAngle,
    generateCirclePoints,
    runValidationSuite,
    getConventionSign,
    CONVENTIONS,
    toDegrees,
    toRadians,
};

/** Default export — convenience object grouping all public functions */
export default {
    computeMohrCircle,
    getStressAtAngle,
    generateCirclePoints,
    runValidationSuite,
    getConventionSign,
    CONVENTIONS,
    toDegrees,
    toRadians,
};