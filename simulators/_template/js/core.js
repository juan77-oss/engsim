/**
 * @module core
 * @description
 * Pure physics core for the Simulator.
 *
 * Implements:
 *  - Example calculation
 *  - Automated validation suite (runValidationSuite)
 *
 * No DOM, no UI, no side effects.
 * ES Module syntax — import specific functions or use the default export object.
 *
 * THEORY NOTES:
 *   Document any formulas, standards, or sign conventions used.
 *   Especially note if your faculty's approach differs from textbooks.
 *   Example:
 *     Shear stress sign convention: Materials (Callister) — τ+ on +x face
 *     is counter-clockwise. This differs from Hibbeler (τ+ clockwise).
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Example helper function.
 * @param {number} val
 * @returns {number}
 */
function doubleValue(val) {
    return val * 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the main result.
 * @param {number} inputVal
 * @returns {Object} result
 */
export function computeResult(inputVal) {
    return {
        input: inputVal,
        output: doubleValue(inputVal)
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs a self-contained test suite of physical invariants and known cases.
 *
 * @returns {Object} ValidationReport
 */
export function runValidationSuite() {
    const TOL = 1e-9;

    /** Helper: build a TestResult */
    function check(name, expected, actual) {
        const delta = Math.abs(actual - expected);
        return { name, pass: delta < TOL, expected, actual, delta };
    }

    const tests = [];

    // ── TEST 1: Basic functionality ──────────────────────────────────────────
    {
        const res = computeResult(5);
        tests.push(check('T1: output is doubled', 10, res.output));
    }

    const allPass = tests.every(t => t.pass);
    const summary = allPass
        ? `✅ ALL ${tests.length} TESTS PASSED`
        : `❌ FAIL: ${tests.filter(t => !t.pass).length}/${tests.length} failed`;

    return { allPass, tests, summary };
}

export default {
    computeResult,
    runValidationSuite
};
