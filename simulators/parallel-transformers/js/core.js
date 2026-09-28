/**
 * @module core
 * @description
 * Pure physics core for two single-phase transformers connected in parallel.
 *
 * Implements:
 *  - Catalog-to-nameplate conversion (Ucc, Pcc, Sn → u_r%, u_x%, u_cc%)
 *  - Equivalent impedance referred to the secondary (Z_e2)
 *  - General-case load sharing (I2', I2'') for any k', k''
 *  - Circulating current I_C (arises when k' ≠ k'')
 *  - Primary voltage required for a given secondary load state
 *  - Maximum group power without overloading either machine
 *  - Parallel-connection eligibility checks (with tolerances)
 *  - Automated validation suite (runValidationSuite)
 *
 * Conventions:
 *  - Complex quantities represented as {re, im} plain objects (no
 *    external complex-number library — keeps core.js dependency-free)
 *  - All impedances referred to the SECONDARY side
 *  - Subscript convention: ' = transformer 1, '' = transformer 2
 *    (matches the faculty's own notation, see /projects/engsim notes)
 *
 * No DOM, no UI, no side effects.
 * ES Module syntax — import specific functions or use the default export object.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// COMPLEX NUMBER HELPERS (minimal, only what this module needs)
// ─────────────────────────────────────────────────────────────────────────────

/** @typedef {{re: number, im: number}} Complex */

/** @returns {Complex} */
function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
/** @returns {Complex} */
function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
/** @returns {Complex} */
function cMul(a, b) {
    return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
/** @returns {Complex} */
function cDiv(a, b) {
    const denom = b.re * b.re + b.im * b.im;
    return {
        re: (a.re * b.re + a.im * b.im) / denom,
        im: (a.im * b.re - a.re * b.im) / denom,
    };
}
/** @returns {number} */
function cAbs(a) { return Math.hypot(a.re, a.im); }
/** @returns {number} angle in radians */
function cAngle(a) { return Math.atan2(a.im, a.re); }
/** @param {number} mag @param {number} angleRad @returns {Complex} */
function cFromPolar(mag, angleRad) {
    return { re: mag * Math.cos(angleRad), im: mag * Math.sin(angleRad) };
}

function toDegrees(rad) { return rad * (180 / Math.PI); }
function toRadians(deg) { return deg * (Math.PI / 180); }

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guard against non-finite or non-positive nameplate values.
 * @param {Object} t - Transformer input {Sn, Ucc, Pcc, Un_hv, Un_lv}
 * @param {string} label - "T1" or "T2", for error messages
 */
function validateTransformer(t, label) {
    const { Sn, Ucc, Pcc, Un_hv, Un_lv } = t;
    const entries = { Sn, Ucc, Pcc, Un_hv, Un_lv };
    for (const [key, value] of Object.entries(entries)) {
        if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
            throw new TypeError(
                `[parallel-transformers-core] Invalid ${label} input: "${key}" must be a finite positive number. Received: ${value}`
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — CATALOG → NAMEPLATE CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert catalog data (Ucc, Pcc, Sn) into nameplate percentages (u_r%, u_x%)
 * and the internal short-circuit angle φ2cc.
 *
 * IMPORTANT: Ucc (the short-circuit test voltage from a manufacturer
 * datasheet) is conventionally referred to the HIGH-VOLTAGE (primary)
 * winding — the test is run from the HV side because it draws lower,
 * easier-to-measure currents. Confirmed against TP3.B1 Problem 2 data:
 * 342.9V / 7620V = 4.5%, matching the ~4.5% range seen in Problems 1 & 3.
 *
 * u_cc% = Ucc / Un_hv · 100
 * u_r%  = Pcc / (10 · Sn[kVA])          (power is side-independent)
 * u_x%  = √(u_cc%² − u_r%²)
 * φ2cc  = atan2(u_x%, u_r%)
 *
 * @param {{Sn:number, Ucc:number, Pcc:number, Un_hv:number}} t
 * @returns {{u_cc_pct:number, u_r_pct:number, u_x_pct:number, phi2cc_rad:number, phi2cc_deg:number}}
 */
function catalogToNameplate({ Sn, Ucc, Pcc, Un_hv }) {
    const u_cc_pct = (Ucc / Un_hv) * 100;
    const u_r_pct = Pcc / (10 * Sn); // Sn in kVA, Pcc in W
    const radicand = u_cc_pct ** 2 - u_r_pct ** 2;
    if (radicand < 0) {
        throw new RangeError(
            `[parallel-transformers-core] Inconsistent catalog data: u_r% (${u_r_pct.toFixed(2)}) exceeds u_cc% (${u_cc_pct.toFixed(2)}). Check Ucc/Pcc/Sn.`
        );
    }
    const u_x_pct = Math.sqrt(radicand);
    const phi2cc_rad = Math.atan2(u_x_pct, u_r_pct);
    return { u_cc_pct, u_r_pct, u_x_pct, phi2cc_rad, phi2cc_deg: toDegrees(phi2cc_rad) };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — EQUIVALENT IMPEDANCE REFERRED TO THE SECONDARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ze2 = (u_cc% / 100) · (Un_lv² / Sn) , split into R + jX using φ2cc.
 * @param {{Sn:number, Un_lv:number}} t
 * @param {{u_cc_pct:number, phi2cc_rad:number}} nameplate
 * @returns {Complex} impedance in ohms, referred to the secondary
 */
function equivalentImpedance({ Sn, Un_lv }, { u_cc_pct, phi2cc_rad }) {
    const Zmag = (u_cc_pct / 100) * (Un_lv ** 2 / (Sn * 1000)); // Sn kVA → VA
    return cFromPolar(Zmag, phi2cc_rad);
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — TRANSFORMATION RATIO
// ─────────────────────────────────────────────────────────────────────────────

/** @param {{Un_hv:number, Un_lv:number}} t @returns {number} */
function transformationRatio({ Un_hv, Un_lv }) { return Un_hv / Un_lv; }

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4-5 — GENERAL CASE: LOAD SHARING + CIRCULATING CURRENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * General system (from the faculty derivation):
 *   I2' = [k''·Ze2''·I + (k''-k')·U2] / (k'·Ze2' + k''·Ze2'')
 *   I2'' = [k'·Ze2'·I  - (k''-k')·U2] / (k'·Ze2' + k''·Ze2'')
 *
 * The circulating current I_C is the value each expression takes at I=0
 * (transformers with different ratios, working on no load):
 *   I_C = [(k''-k')·U2] / (k'·Ze2' + k''·Ze2'')
 *
 * @param {number} k1 - ratio of T1
 * @param {number} k2 - ratio of T2
 * @param {Complex} Ze2_1 - impedance of T1 referred to secondary
 * @param {Complex} Ze2_2 - impedance of T2 referred to secondary
 * @param {Complex} I_load - total load current phasor (secondary side)
 * @param {number} U2 - secondary operating voltage (magnitude, taken as phase reference)
 * @returns {{I1: Complex, I2: Complex, Ic: Complex}}
 */
function solveGeneralCase(k1, k2, Ze2_1, Ze2_2, I_load, U2) {
    const denom = cAdd(cMul({ re: k1, im: 0 }, Ze2_1), cMul({ re: k2, im: 0 }, Ze2_2));
    const deltaK_U2 = { re: (k2 - k1) * U2, im: 0 };

    const Ic = cDiv(deltaK_U2, denom);

    const term1 = cAdd(cMul({ re: k2, im: 0 }, cMul(Ze2_2, I_load)), deltaK_U2);
    const I1 = cDiv(term1, denom);

    const term2 = cSub(cMul({ re: k1, im: 0 }, cMul(Ze2_1, I_load)), deltaK_U2);
    const I2 = cDiv(term2, denom);

    return { I1, I2, Ic };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — PRIMARY VOLTAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * U1 (referred to secondary, i.e. U12 = U1/k) = U2 + Ze2·I2, per transformer.
 * Both must (in a valid parallel connection) give the same U12 up to the
 * tolerance defined in checkEligibility(); this returns transformer 1's
 * primary voltage as the representative value, plus the discrepancy.
 *
 * @returns {{U1_t1: number, U1_t2: number, U12_t1: Complex, U12_t2: Complex}}
 */
function primaryVoltage(k1, k2, Ze2_1, Ze2_2, I1, I2, U2) {
    const U2c = { re: U2, im: 0 };
    const U12_t1 = cAdd(U2c, cMul(Ze2_1, I1));
    const U12_t2 = cAdd(U2c, cMul(Ze2_2, I2));
    return {
        U1_t1: k1 * cAbs(U12_t1),
        U1_t2: k2 * cAbs(U12_t2),
        U12_t1,
        U12_t2,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 7 — MAXIMUM GROUP POWER WITHOUT OVERLOADING EITHER MACHINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Finds the smallest positive S (total load, in the units implied by P/K)
 * at which |P·S + K| = In. Since I(S) is an affine function of the scalar
 * load S (see maxGroupPower docblock), this is a quadratic in S:
 *   |P|²·S² + 2·(P·K)·S + (|K|² − In²) = 0
 * Returns Infinity if no positive real root exists (shouldn't happen for
 * a valid nameplate + eligible circulating current, but guards against it).
 */
function solveLoadLimit(P, K, In) {
    const a = P.re * P.re + P.im * P.im;
    const c = (K.re * K.re + K.im * K.im) - In * In;
    // Already at/over rated current from the circulating current ALONE,
    // before any load is added — with an extreme enough ratio mismatch,
    // this is a real (if pathological) case. Reporting Infinity here would
    // be actively dangerous for a safety-relevant number: it reads as "no
    // limit", the opposite of the truth. In practice checkEligibility()
    // already flags this scenario hard (ratio/Ic tolerance both blown), so
    // this is a defensive fallback, not the primary safeguard.
    if (c >= 0) return 0;
    const b = 2 * (P.re * K.re + P.im * K.im);
    if (a === 0) return Infinity;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return Infinity;
    const sqrtDisc = Math.sqrt(disc);
    const roots = [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)].filter((r) => r > 0);
    return roots.length ? Math.min(...roots) : Infinity;
}

/**
 * Maximum total group load (S, kVA) before EITHER transformer exceeds its
 * own rated current — solved directly from the real current expressions,
 * so it correctly accounts for circulating current when k1 ≠ k2.
 *
 * From solveGeneralCase(), for a fixed power factor and U2, both I1 and I2
 * are AFFINE functions of the scalar total load S (not just proportional):
 *   I1(S) = P1·S + Ic      I2(S) = P2·S − Ic
 * where Ic (circulating current) is a load-INDEPENDENT constant — it only
 * depends on the ratio mismatch, U2, and the impedances — and P1, P2 are
 * fixed complex "current per kVA of load" coefficients. This is why a
 * ratio mismatch can make one transformer reach its rated current well
 * before the "naive" (u_cc%-only) proportional split would predict: Ic
 * adds onto one machine's current and subtracts from the other's,
 * regardless of how small the load is.
 *
 * Each transformer's own limit is solved independently as the smallest S
 * where |I(S)| = In (see solveLoadLimit); Smax_total is whichever comes
 * first, and it IS possible — though numerically unlikely — for both to
 * coincide exactly, reported as 'TIE'.
 *
 * @param {number} k1 @param {number} k2
 * @param {Complex} Ze2_1 @param {Complex} Ze2_2
 * @param {number} U2 - secondary operating voltage (V)
 * @param {number} cosPhi - load power factor (inductive)
 * @param {number} In1 - T1's rated Sn converted to a current AT U2 (Sn1·1000/U2, NOT the nameplate current Sn1·1000/Un_lv) — see the "% loading" note in computeParallelTransformers()
 * @param {number} In2 - T2's equivalent, Sn2·1000/U2
 * @returns {{Smax_total: number, limitingTransformer: 'T1'|'T2'|'TIE', d1: number, d2: number}}
 */
function maxGroupPower(k1, k2, Ze2_1, Ze2_2, U2, cosPhi, In1, In2) {
    const phiLoad = -Math.acos(cosPhi);
    const unitLoad = cFromPolar(1000 / U2, phiLoad); // I_load per 1 kVA of S

    const denom = cAdd(cMul({ re: k1, im: 0 }, Ze2_1), cMul({ re: k2, im: 0 }, Ze2_2));
    const Ic = cDiv({ re: (k2 - k1) * U2, im: 0 }, denom); // load-independent

    const P1 = cDiv(cMul({ re: k2, im: 0 }, cMul(Ze2_2, unitLoad)), denom);
    const P2 = cDiv(cMul({ re: k1, im: 0 }, cMul(Ze2_1, unitLoad)), denom);

    const S1max = solveLoadLimit(P1, Ic, In1);
    const S2max = solveLoadLimit(P2, { re: -Ic.re, im: -Ic.im }, In2);

    const TIE_TOLERANCE_KVA = 1e-6;
    const limiting = Math.abs(S1max - S2max) < TIE_TOLERANCE_KVA ? 'TIE' : (S1max < S2max ? 'T1' : 'T2');
    const Smax_total = Math.min(S1max, S2max);

    const I1_at_max = cAbs(cAdd(cMul(P1, { re: Smax_total, im: 0 }), Ic));
    const I2_at_max = cAbs(cSub(cMul(P2, { re: Smax_total, im: 0 }), Ic));

    return { Smax_total, limitingTransformer: limiting, d1: I1_at_max / In1, d2: I2_at_max / In2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 8 — ELIGIBILITY CHECKS (the "traffic light")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tolerances per the faculty notes:
 *  - ratio mismatch tolerance: 0.5%
 *  - circulating current tolerance: 10% of the smaller nominal current
 *
 * @returns {{
 *   ratioMismatchPct: number,
 *   ratioOk: boolean,
 *   IcOverNominalPct: number,
 *   IcOk: boolean,
 *   overallEligible: boolean
 * }}
 */
function checkEligibility(k1, k2, IcMag, t1, t2) {
    const ratioMismatchPct = (Math.abs(k2 - k1) / Math.min(k1, k2)) * 100;
    const ratioOk = ratioMismatchPct <= 0.5;

    const In1 = (t1.Sn * 1000) / t1.Un_lv;
    const In2 = (t2.Sn * 1000) / t2.Un_lv;
    const InMin = Math.min(In1, In2);
    const IcOverNominalPct = (IcMag / InMin) * 100;
    const IcOk = IcOverNominalPct <= 10;

    return { ratioMismatchPct, ratioOk, IcOverNominalPct, IcOk, overallEligible: ratioOk && IcOk };
}

/**
 * Overload "traffic light" per transformer.
 * Red at loading >= 100%. Yellow between 90-100% ONLY if there is an
 * imbalance vs. the other transformer beyond DIFF_THRESHOLD_PP
 * (percentage points). Otherwise green.
 *
 * @param {number} loadPct1 - T1 loading, 0-100+ (% of its Sn)
 * @param {number} loadPct2 - T2 loading, 0-100+ (% of its Sn)
 * @param {number} [diffThresholdPp=5] - imbalance threshold in percentage points
 * @returns {{status1: 'green'|'yellow'|'red', status2: 'green'|'yellow'|'red'}}
 */
function overloadTrafficLight(loadPct1, loadPct2, diffThresholdPp = 5) {
    const diff = Math.abs(loadPct1 - loadPct2);
    function statusFor(pct) {
        if (pct >= 100) return 'red';
        if (pct >= 90 && diff > diffThresholdPp) return 'yellow';
        return 'green';
    }
    return { status1: statusFor(loadPct1), status2: statusFor(loadPct2) };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD SHARE — how much of the TOTAL delivered load each transformer carries
// (as opposed to `loading`, which is each transformer's % of its OWN rating)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Splits the total delivered apparent power into each transformer's share.
 * S1 = U2·|I1| , S2 = U2·|I2| (kVA, magnitudes — phase is ignored here on
 * purpose: this answers "of the load, who's carrying how much", not a
 * phasor sum).
 *
 * pct1/pct2 are computed against the ACTUAL total load S the user entered
 * — NOT against S1+S2. Those two are usually close but not identical:
 * since I1 and I2 aren't perfectly collinear (their u_r/u_x angles differ
 * slightly between the two transformers, even with zero circulating
 * current), |I1|+|I2| can exceed |I_load| by a small amount. Dividing by
 * S1+S2 would force pct1+pct2 to sum to exactly 100 but silently redefine
 * "% of the load" as "% of S1+S2" instead — which doesn't match a plain
 * S2/S check against the number actually typed into the load field.
 * Dividing by S instead is what "share of the load" should mean, at the
 * cost of pct1+pct2 occasionally landing a hair over (or under) 100.
 *
 * @param {number} I1_mag - T1 secondary current magnitude (A)
 * @param {number} I2_mag - T2 secondary current magnitude (A)
 * @param {number} U2 - secondary operating voltage (V)
 * @param {number} S_total - the actual total load entered (kVA)
 * @returns {{S1:number, S2:number, pct1:number, pct2:number}}
 */
function loadShare(I1_mag, I2_mag, U2, S_total) {
    const S1 = (I1_mag * U2) / 1000; // kVA
    const S2 = (I2_mag * U2) / 1000;
    const pct1 = S_total > 0 ? (S1 / S_total) * 100 : 50;
    const pct2 = S_total > 0 ? (S2 / S_total) * 100 : 50;
    return { S1, S2, pct1, pct2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR — full solve in one call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {{Sn:number, Ucc:number, Pcc:number, Un_hv:number, Un_lv:number}} params.t1
 * @param {{Sn:number, Ucc:number, Pcc:number, Un_hv:number, Un_lv:number}} params.t2
 * @param {{S:number, cosPhi:number, U2:number}} params.load - S in kVA, U2 in V
 * @returns {Object} full result set (see return statement for shape)
 */
/**
 * Guard against non-finite or out-of-range load values. Unlike
 * validateTransformer(), S is allowed to be exactly 0 (a valid "no load,
 * circulating current only" case — see T-series tests) — everything else
 * must be strictly positive, and cosPhi must be a valid power factor.
 * @param {{S:number, cosPhi:number, U2:number}} load
 */
function validateLoad(load) {
    const { S, cosPhi, U2 } = load;
    if (typeof S !== 'number' || !isFinite(S) || S < 0) {
        throw new TypeError(`[parallel-transformers-core] Invalid load input: "S" must be a finite non-negative number. Received: ${S}`);
    }
    if (typeof U2 !== 'number' || !isFinite(U2) || U2 <= 0) {
        throw new TypeError(`[parallel-transformers-core] Invalid load input: "U2" must be a finite positive number. Received: ${U2}`);
    }
    if (typeof cosPhi !== 'number' || !isFinite(cosPhi) || cosPhi <= 0 || cosPhi > 1) {
        throw new TypeError(`[parallel-transformers-core] Invalid load input: "cosPhi" must be in (0, 1]. Received: ${cosPhi}`);
    }
}

function computeParallelTransformers({ t1, t2, load }) {
    validateTransformer(t1, 'T1');
    validateTransformer(t2, 'T2');
    validateLoad(load);

    const np1 = catalogToNameplate(t1);
    const np2 = catalogToNameplate(t2);

    const Ze2_1 = equivalentImpedance(t1, np1);
    const Ze2_2 = equivalentImpedance(t2, np2);

    const k1 = transformationRatio(t1);
    const k2 = transformationRatio(t2);

    const phiLoad = -Math.acos(load.cosPhi); // inductive load lags voltage
    const ILoadMag = (load.S * 1000) / load.U2;
    const I_load = cFromPolar(ILoadMag, phiLoad);

    const { I1, I2, Ic } = solveGeneralCase(k1, k2, Ze2_1, Ze2_2, I_load, load.U2);

    // "Delivered to the load" current per transformer — the actual I1/I2
    // include the circulating current riding on top of the load split
    // (that's the REAL current stressing the winding, correctly used for
    // `loading` below). This is the other half of the same superposition:
    // subtract Ic back out to see just the portion of each transformer's
    // current that's actually serving the customer. By construction
    // I1_load + I2_load = I_load (the total load current) — see T8.
    const I1_load = cSub(I1, Ic);
    const I2_load = cAdd(I2, Ic);

    const { U1_t1, U1_t2 } = primaryVoltage(k1, k2, Ze2_1, Ze2_2, I1, I2, load.U2);

    // "Reparto de carga" (loadShare, exposed below) answers "of the total
    // load, how much does each transformer actually DELIVER" — so it's
    // built from I1_load/I2_load (circulating current excluded), NOT the
    // actual total current. This is deliberately a DIFFERENT number from
    // `loading` right below, which measures thermal risk (including the
    // wasted circulating current) and must NOT be swapped to load-only
    // current, or the overload/traffic-light check would silently
    // understate real winding stress.
    const deliveredShare = loadShare(cAbs(I1_load), cAbs(I2_load), load.U2, load.S);

    // "% loading" is defined as delivered kVA / nameplate kVA (S/Sn) — NOT
    // current/rated-current. These differ whenever U2 (operating voltage)
    // isn't exactly Un_lv (nameplate voltage): S = U2·I, so at a lower U2
    // the same kVA needs more current. Uses the ACTUAL total current
    // (including circulating) — this is the thermally-real loading.
    const actualShare = loadShare(cAbs(I1), cAbs(I2), load.U2, load.S);
    const loadPct1 = (actualShare.S1 / t1.Sn) * 100;
    const loadPct2 = (actualShare.S2 / t2.Sn) * 100;

    // Rated current thresholds for maxGroupPower must match the SAME
    // convention: the "S1(S)=Sn1" kVA threshold is equivalent to solving
    // |I1(S)| = Sn1·1000/U2 (rated kVA converted to current AT THE
    // OPERATING voltage, not the nameplate voltage Un_lv).
    const InAtU2_1 = (t1.Sn * 1000) / load.U2;
    const InAtU2_2 = (t2.Sn * 1000) / load.U2;

    const eligibility = checkEligibility(k1, k2, cAbs(Ic), t1, t2);
    const trafficLight = overloadTrafficLight(loadPct1, loadPct2);
    const maxPower = maxGroupPower(k1, k2, Ze2_1, Ze2_2, load.U2, load.cosPhi, InAtU2_1, InAtU2_2);

    return {
        nameplate: { t1: np1, t2: np2 },
        impedance: { Ze2_1, Ze2_2 },
        ratios: { k1, k2 },
        currents: {
            I1_mag: cAbs(I1), I1_angle_deg: toDegrees(cAngle(I1)),
            I2_mag: cAbs(I2), I2_angle_deg: toDegrees(cAngle(I2)),
            Ic_mag: cAbs(Ic), Ic_angle_deg: toDegrees(cAngle(Ic)),
            I1_load_mag: cAbs(I1_load), I1_load_angle_deg: toDegrees(cAngle(I1_load)),
            I2_load_mag: cAbs(I2_load), I2_load_angle_deg: toDegrees(cAngle(I2_load)),
            I1, I2, Ic, I1_load, I2_load,
        },
        loading: { loadPct1, loadPct2 },
        loadShare: deliveredShare,
        primaryVoltage: { U1_t1, U1_t2 },
        eligibility,
        trafficLight,
        maxPower,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATED VALIDATION SUITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physics invariant checks:
 *  T1 — Equal ratios (k1=k2): Ic must be ≈0
 *  T2 — |I1|+|I2| phasor sum must equal the load current I_load
 *  T3 — Equal Sn and equal u_cc%: load must split 50/50
 *  T4 — Transformer with the smaller u_cc% must be the "limiting" one in maxGroupPower
 *
 * @returns {{allPass: boolean, tests: Array, summary: string}}
 */
function runValidationSuite() {
    const TOL = 1e-6;
    const near = (a, b, tol = TOL) => Math.abs(a - b) < tol;
    const tests = [];

    // Faculty TP3.B1, Problem 1 nameplate data, converted to catalog format
    // (Ucc in volts, referred to Un_hv = u_cc% · Un_hv / 100; Pcc in watts,
    // side-independent = u_r% · 10 · Sn[kVA]):
    //   T1: Sn=5kVA, u_r=2.66%, u_x=3.68% (u_cc=4.54%) → Ucc=345.85V, Pcc=133W
    //   T2: Sn=2.3kVA, u_r=2.7%, u_x=2.6% (u_cc=3.75%) → Ucc=285.75V, Pcc=62.1W

    // ── T1: equal ratios → Ic ≈ 0 ──────────────────────────────────────────
    {
        const t1 = { Sn: 5, Ucc: 7620 * 4.54 / 100, Pcc: 133, Un_hv: 7620, Un_lv: 231 };
        const t2 = { Sn: 2.3, Ucc: 7620 * 3.75 / 100, Pcc: 62.1, Un_hv: 7620, Un_lv: 231 }; // same Un_hv/Un_lv → same k
        const load = { S: 6, cosPhi: 0.8, U2: 231 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T1: k1=k2 → Ic≈0', pass: near(r.currents.Ic_mag, 0, 1e-6), actual: r.currents.Ic_mag });
    }

    // ── T2: current balance I1+I2 = I_load ──────────────────────────────────
    {
        const t1 = { Sn: 5, Ucc: 7620 * 4.54 / 100, Pcc: 133, Un_hv: 7620, Un_lv: 231 };
        const t2 = { Sn: 2.3, Ucc: 7620 * 3.75 / 100, Pcc: 62.1, Un_hv: 7620, Un_lv: 231 };
        const load = { S: 6.5, cosPhi: 0.8, U2: 220 };
        const r = computeParallelTransformers({ t1, t2, load });
        const sumRe = r.currents.I1.re + r.currents.I2.re;
        const sumIm = r.currents.I1.im + r.currents.I2.im;
        const ILoadMag = (load.S * 1000) / load.U2;
        const sumMag = Math.hypot(sumRe, sumIm);
        tests.push({ name: 'T2: |I1+I2| = I_load', pass: near(sumMag, ILoadMag, 1e-3), expected: ILoadMag, actual: sumMag });
    }

    // ── T3: equal Sn, equal u_cc% → 50/50 split ──────────────────────────────
    {
        const t1 = { Sn: 5, Ucc: 7620 * 4.54 / 100, Pcc: 133, Un_hv: 7620, Un_lv: 231 };
        const t2 = { Sn: 5, Ucc: 7620 * 4.54 / 100, Pcc: 133, Un_hv: 7620, Un_lv: 231 };
        const load = { S: 6, cosPhi: 0.8, U2: 231 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T3: identical machines → 50/50', pass: near(r.loading.loadPct1, r.loading.loadPct2, 1e-6), a: r.loading.loadPct1, b: r.loading.loadPct2 });
    }

    // ── T4: lower u_cc% is the limiting transformer (TP3.B1 Problem 1) ──────
    // Smax verified independently: evaluating computeParallelTransformers()
    // at S=6.4066 gives loadPct2 = 100.000000% exactly. "% loading" is
    // S/Sn (kVA delivered vs. nameplate kVA, at the actual U2) — NOT
    // current/rated-current — per the course's convention, which differs
    // from the current-based figure whenever U2 ≠ Un_lv (here 220V vs 231V).
    {
        const t1 = { Sn: 5, Ucc: 7620 * 4.54 / 100, Pcc: 133, Un_hv: 7620, Un_lv: 231 }; // u_cc=4.54%
        const t2 = { Sn: 2.3, Ucc: 7620 * 3.75 / 100, Pcc: 62.1, Un_hv: 7620, Un_lv: 231 }; // u_cc=3.75% (lower)
        const load = { S: 6.5, cosPhi: 0.8, U2: 220 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T4: lower u_cc% is limiting (Smax=6.41kVA expected)', pass: r.maxPower.limitingTransformer === 'T2' && near(r.maxPower.Smax_total, 6.4066, 0.001), actual: r.maxPower.limitingTransformer, Smax: r.maxPower.Smax_total });
    }

    // ── T5: TP3.B1 Problem 2 — real catalog data, different ratios ──────────
    // T1: 5kVA 7620/231V Ucc=342.9V Pcc=160W | T2: 10kVA 7620/225V Ucc=316.38V Pcc=211W
    // u_cc1=4.5%, u_cc2=4.152% — expect a non-zero circulating current.
    {
        const t1 = { Sn: 5, Ucc: 342.9, Pcc: 160, Un_hv: 7620, Un_lv: 231 };
        const t2 = { Sn: 10, Ucc: 316.38, Pcc: 211, Un_hv: 7620, Un_lv: 225 };
        const load = { S: 9.375, cosPhi: 0.8, U2: 225 }; // 7.5kW @ 0.8 pf
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T5: different ratios → Ic > 0 (Problem 2)', pass: r.currents.Ic_mag > 0.01, Ic: r.currents.Ic_mag });
    }

    // ── T6: equal u_cc%, different Sn → tie, no limiting transformer ────────
    // (regression test for the bug where equal u_cc% used to default to T1)
    {
        const t1 = { Sn: 25, Ucc: 594, Pcc: 600, Un_hv: 13200, Un_lv: 231 }; // u_cc=4.5%
        const t2 = { Sn: 16, Ucc: 594, Pcc: 390, Un_hv: 13200, Un_lv: 231 }; // u_cc=4.5% (same)
        const load = { S: 39, cosPhi: 0.8, U2: 220 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T6: equal u_cc% → TIE (no limiting transformer)', pass: r.maxPower.limitingTransformer === 'TIE' && near(r.maxPower.d1, 1, 1e-6) && near(r.maxPower.d2, 1, 1e-6), actual: r.maxPower.limitingTransformer });
    }

    // ── T7: ratio mismatch + circulating current → correct limiting transformer ──
    // (regression test for the bug where equal u_cc% but a real ratio
    // mismatch — Un_lv 230V vs 231V — was still reported as 'TIE', when in
    // fact the circulating current pushes T2 to its rated kVA first.
    // Verified independently: at S=39.0451kVA, loadPct2 = 100.000000% exactly.)
    {
        const t1 = { Sn: 25, Ucc: 594, Pcc: 600, Un_hv: 13200, Un_lv: 230 }; // u_cc=4.5%
        const t2 = { Sn: 16, Ucc: 594, Pcc: 390, Un_hv: 13200, Un_lv: 231 }; // u_cc=4.5% (same!) but different Un_lv → Ic ≠ 0
        const load = { S: 37.1, cosPhi: 0.8, U2: 220 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T7: ratio mismatch → T2 limiting (not TIE) despite equal u_cc%', pass: r.maxPower.limitingTransformer === 'T2' && near(r.maxPower.Smax_total, 39.0451, 0.001), actual: r.maxPower.limitingTransformer, Smax: r.maxPower.Smax_total });
    }

    // ── T8: I1_load + I2_load = I_load (delivered-current decomposition) ──
    {
        const t1 = { Sn: 25, Ucc: 594, Pcc: 600, Un_hv: 13200, Un_lv: 230 };
        const t2 = { Sn: 16, Ucc: 594, Pcc: 390, Un_hv: 13200, Un_lv: 231 };
        const load = { S: 37.1, cosPhi: 0.8, U2: 220 };
        const r = computeParallelTransformers({ t1, t2, load });
        const ILoadMag = (load.S * 1000) / load.U2;
        const sumRe = r.currents.I1_load.re + r.currents.I2_load.re;
        const sumIm = r.currents.I1_load.im + r.currents.I2_load.im;
        const sumMag = Math.hypot(sumRe, sumIm);
        tests.push({ name: 'T8: I1_load + I2_load = I_load', pass: near(sumMag, ILoadMag, 1e-6), expected: ILoadMag, actual: sumMag });
    }

    // ── T9: extreme ratio mismatch → already over rated at S=0 (Smax=0, not ∞) ──
    // (regression test: solveLoadLimit used to return Infinity here, which
    // reads as "no limit" — the opposite of the truth. checkEligibility
    // already flags this scenario hard; this is a defensive-engine check.)
    {
        const t1 = { Sn: 5, Ucc: 200, Pcc: 50, Un_hv: 10000, Un_lv: 100 };
        const t2 = { Sn: 5, Ucc: 200, Pcc: 50, Un_hv: 10000, Un_lv: 220 };
        const load = { S: 1, cosPhi: 0.8, U2: 150 };
        const r = computeParallelTransformers({ t1, t2, load });
        tests.push({ name: 'T9: extreme mismatch → Smax=0 (not Infinity)', pass: r.maxPower.Smax_total === 0 && isFinite(r.maxPower.Smax_total), actual: r.maxPower.Smax_total });
    }

    const allPass = tests.every(t => t.pass);
    const nFail = tests.filter(t => !t.pass).length;
    const summary = allPass
        ? `✅ All ${tests.length} physics checks passed.`
        : `❌ ${nFail} of ${tests.length} checks FAILED. Review results.tests for details.`;

    return { allPass, tests, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS (ES Module)
// ─────────────────────────────────────────────────────────────────────────────

export {
    computeParallelTransformers,
    catalogToNameplate,
    equivalentImpedance,
    transformationRatio,
    solveGeneralCase,
    primaryVoltage,
    maxGroupPower,
    checkEligibility,
    overloadTrafficLight,
    loadShare,
    runValidationSuite,
    toDegrees,
    toRadians,
};

export default {
    computeParallelTransformers,
    catalogToNameplate,
    equivalentImpedance,
    transformationRatio,
    solveGeneralCase,
    primaryVoltage,
    maxGroupPower,
    checkEligibility,
    overloadTrafficLight,
    loadShare,
    runValidationSuite,
    toDegrees,
    toRadians,
};
