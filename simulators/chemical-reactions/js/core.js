/**
 * core.js — Chemical Reactions Simulator
 * engsimapp.com
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE: Pure calculation engine. Zero DOM. Zero side effects.
 *          All physics/chemistry logic lives here. Reads its
 *          reference data from constants.js.
 *
 * SECTIONS:
 *   1. Formula & equation parsing        (molar mass, tokenizing)
 *   2. Equation balancing                (Gauss-Jordan, exact fractions)
 *   3. Limiting reagent engine           (5-step stoichiometric method)
 *   4. Redox lookup                      (ion-electron method, pre-defined set)
 *
 * THEORY NOTES:
 *   Limiting reagent: ratio = moles / stoichiometric coefficient;
 *   the smallest ratio identifies the limiting reagent.
 *   Balancing: Ax = 0 solved by Gauss-Jordan elimination over the
 *   stoichiometric matrix (reactants +, products −), exact fraction
 *   arithmetic avoids floating-point drift, then normalized to the
 *   smallest positive integer coefficients.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import { ATOMIC_MASS, REDOX_REACTIONS } from './constants.js';

// ═══════════════════════════════════════════════════════════════
// 1. FORMULA & EQUATION PARSING
// ═══════════════════════════════════════════════════════════════

/**
 * Parses a molecular formula into an element→count map.
 * Recursive implementation supports parenthesized groups.
 * Ex: "H2O" → {H:2, O:1} | "Ca(OH)2" → {Ca:1, O:2, H:2}
 *
 * @param {string} formula
 * @returns {Record<string, number>}
 */
export function parseMolecularFormula(formula) {
    if (typeof formula !== 'string' || formula.length === 0) {
        throw new Error('Formula must be a non-empty string.');
    }
    function parseSegment(s, start) {
        const counts = {};
        let i = start;

        while (i < s.length) {
            const ch = s[i];

            if (ch === '(') {
                const result = parseSegment(s, i + 1);
                i = result.end + 1;

                let multiplier = '';
                while (i < s.length && /\d/.test(s[i])) { multiplier += s[i]; i++; }
                const mult = multiplier === '' ? 1 : parseInt(multiplier, 10);

                for (const [elem, cnt] of Object.entries(result.counts)) {
                    counts[elem] = (counts[elem] || 0) + cnt * mult;
                }

            } else if (ch === ')') {
                return { counts, end: i };

            } else if (/[A-Z]/.test(ch)) {
                let symbol = ch;
                i++;
                while (i < s.length && /[a-z]/.test(s[i])) { symbol += s[i]; i++; }

                let subscript = '';
                while (i < s.length && /\d/.test(s[i])) { subscript += s[i]; i++; }
                const count = subscript === '' ? 1 : parseInt(subscript, 10);
                counts[symbol] = (counts[symbol] || 0) + count;

            } else {
                i++; // Skip unknown characters (ionic charges, etc.)
            }
        }
        return { counts, end: i };
    }

    const { counts, end } = parseSegment(formula, 0);
    if (end !== formula.length) {
        throw new Error(`Malformed formula: "${formula}". Check for unbalanced parentheses.`);
    }
    return counts;
}

/**
 * Computes molar mass (g/mol) from an element→count map.
 *
 * @param {Record<string, number>} elementsMap
 * @returns {number}
 */
export function calculateMolarMass(elementsMap) {
    if (!elementsMap || typeof elementsMap !== 'object') {
        throw new Error('calculateMolarMass expects an element→count object.');
    }
    let molarMass = 0;
    for (const [elem, count] of Object.entries(elementsMap)) {
        if (ATOMIC_MASS[elem] === undefined) {
            throw new Error(`Unknown element: "${elem}". Check the molecular formula.`);
        }
        molarMass += ATOMIC_MASS[elem] * count;
    }
    return molarMass;
}

/** @private Parses a species token (e.g. "2H2O") into a structured object. */
function parseSpeciesToken(token) {
    token = token.trim();
    const match = token.match(/^(\d*)([A-Z].*)$/);
    if (!match) {
        throw new Error(`Invalid token: "${token}". Format must be like "2H2O" or "Fe2O3".`);
    }
    const coeff    = match[1] === '' ? 1 : parseInt(match[1], 10);
    const formula  = match[2];
    const elements = parseMolecularFormula(formula);
    const molarMass = calculateMolarMass(elements);
    return { coeff, formula, elements, molarMass };
}

/**
 * Parses a full chemical equation.
 * Accepted format: "2H2 + O2 -> 2H2O"
 *
 * @param {string} equationStr
 * @returns {{ reactants: object[], products: object[] }}
 */
export function parseEquation(equationStr) {
    if (!equationStr || typeof equationStr !== 'string') {
        throw new Error('The equation cannot be empty.');
    }
    const normalized = equationStr.trim().replace(/\s+/g, ' ').replace(/→|⇒|=>/g, '->');
    if (!normalized.includes('->')) {
        throw new Error('Invalid format. Use "->" as an arrow. Example: "2H2 + O2 -> 2H2O"');
    }
    const [leftSide, rightSide] = normalized.split('->');
    if (!leftSide || !rightSide) {
        throw new Error('The equation must have reactants and products separated by "->".');
    }
    const reactants = leftSide.split('+').map(t => parseSpeciesToken(t));
    const products  = rightSide.split('+').map(t => parseSpeciesToken(t));
    if (reactants.length === 0) throw new Error('No reactants found in the equation.');
    if (products.length === 0)  throw new Error('No products found in the equation.');
    return { reactants, products };
}

const SUBSCRIPT_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/** @private Shared guard for the {reactants, products} shape that
 *  parseEquation/balanceEquation produce and formatEquation/isBalanced/
 *  stringifyEquation consume. Throws a clear error instead of letting
 *  a malformed argument surface as a raw "Cannot read properties of
 *  undefined" TypeError deep inside .map()/.forEach(). */
function _assertParsedEquation(parsed, fnName) {
    if (!parsed || !Array.isArray(parsed.reactants) || !Array.isArray(parsed.products)) {
        throw new Error(`${fnName} expects a parsed equation ({ reactants: [], products: [] }), e.g. the output of parseEquation().`);
    }
}

/**
 * Replaces digits in a formula with Unicode subscript equivalents.
 * Ex: "H2O" → "H₂O"
 *
 * @param {string} formula
 * @returns {string}
 */
export function formatFormula(formula) {
    if (typeof formula !== 'string') {
        throw new Error('formatFormula expects a string.');
    }
    return formula.replace(/(\d+)/g, n => n.replace(/[0-9]/g, d => SUBSCRIPT_MAP[d]));
}

/**
 * Converts a parsed equation to a display string with subscripts.
 * Ex: parsed → "2 H₂ + O₂ → 2 H₂O"
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {string}
 */
export function formatEquation(parsed) {
    _assertParsedEquation(parsed, 'formatEquation');
    const side = arr =>
        arr.map(s => `${s.coeff > 1 ? s.coeff + ' ' : ''}${formatFormula(s.formula)}`).join(' + ');
    return `${side(parsed.reactants)} → ${side(parsed.products)}`;
}

// ═══════════════════════════════════════════════════════════════
// 2. EQUATION BALANCING — Gauss-Jordan with exact fractions
// ═══════════════════════════════════════════════════════════════

/** @private Fraction arithmetic — avoids floating-point drift.
 *  Uses standard doubles (safe up to 2^53-1), not BigInt: sufficient
 *  for any realistic chemical equation, but pathologically large
 *  coefficients could theoretically lose precision silently. */
const Fraction = {
    gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { a %= b; [a, b] = [b, a]; } return a; },
    lcm: (a, b) => (a * b) / Fraction.gcd(a, b),
    simplify: f => { const c = Fraction.gcd(f.n, f.d); return { n: f.n / c, d: f.d / c }; },
    add: (f1, f2) => Fraction.simplify({ n: f1.n * f2.d + f2.n * f1.d, d: f1.d * f2.d }),
    sub: (f1, f2) => Fraction.simplify({ n: f1.n * f2.d - f2.n * f1.d, d: f1.d * f2.d }),
    mul: (f1, f2) => Fraction.simplify({ n: f1.n * f2.n, d: f1.d * f2.d }),
    div: (f1, f2) => {
        if (f2.n === 0) throw new Error('Division by zero in fraction arithmetic');
        let n = f1.n * f2.d, d = f1.d * f2.n;
        if (d < 0) { n = -n; d = -d; }
        return Fraction.simplify({ n, d });
    },
    fromInt: n => ({ n, d: 1 }),
    zero:    ()  => ({ n: 0, d: 1 }),
    one:     ()  => ({ n: 1, d: 1 }),
};

/**
 * Checks whether a parsed equation is already balanced.
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {boolean}
 */
export function isBalanced(parsed) {
    _assertParsedEquation(parsed, 'isBalanced');
    const rCounts = {}, pCounts = {};

    const tabulate = (arr, target) =>
        arr.forEach(s => {
            const coeff = s.coeff || 1;
            for (const [el, count] of Object.entries(s.elements)) {
                target[el] = (target[el] || 0) + count * coeff;
            }
        });

    tabulate(parsed.reactants, rCounts);
    tabulate(parsed.products,  pCounts);

    const allElements = new Set([...Object.keys(rCounts), ...Object.keys(pCounts)]);
    for (const el of allElements) {
        if (rCounts[el] !== pCounts[el]) return false;
    }
    return true;
}

/** @private Unique elements present in the equation. */
function _extractElements(parsed) {
    const elements = new Set();
    [...parsed.reactants, ...parsed.products]
        .forEach(s => Object.keys(s.elements).forEach(e => elements.add(e)));
    return Array.from(elements).sort();
}

/** @private Builds the stoichiometric matrix (reactants +, products −). */
function _buildMatrix(parsed, elements) {
    const matrix = [];
    for (const el of elements) {
        const row = [];
        parsed.reactants.forEach(s => row.push(Fraction.fromInt(s.elements[el] || 0)));
        parsed.products.forEach(s  => row.push(Fraction.fromInt(-(s.elements[el] || 0))));
        matrix.push(row);
    }
    return matrix;
}

/** @private Solves Ax=0 via Gauss-Jordan elimination (RREF).
 *  Returns both the solution (with the last free variable fixed to 1)
 *  and the pivot count, so callers can detect systems with more than
 *  one degree of freedom (which this single-free-variable approach
 *  cannot resolve correctly — e.g. equations describing more than
 *  one independent reaction at once). */
function _solveMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    let pivotRow = 0, pivotCol = 0;

    while (pivotRow < rows && pivotCol < cols) {
        let selRow = pivotRow;
        while (selRow < rows && matrix[selRow][pivotCol].n === 0) selRow++;
        if (selRow === rows) { pivotCol++; continue; }

        [matrix[pivotRow], matrix[selRow]] = [matrix[selRow], matrix[pivotRow]];
        const pivotVal = matrix[pivotRow][pivotCol];
        for (let j = 0; j < cols; j++) {
            matrix[pivotRow][j] = Fraction.div(matrix[pivotRow][j], pivotVal);
        }
        for (let i = 0; i < rows; i++) {
            if (i !== pivotRow) {
                const factor = matrix[i][pivotCol];
                for (let j = 0; j < cols; j++) {
                    matrix[i][j] = Fraction.sub(matrix[i][j], Fraction.mul(factor, matrix[pivotRow][j]));
                }
            }
        }
        pivotRow++; pivotCol++;
    }

    const pivotCount = pivotRow;

    // Fix the last free variable at 1 and back-solve the rest
    const result = Array(cols).fill(null).map(() => Fraction.zero());
    result[cols - 1] = Fraction.one();

    for (let i = 0; i < cols - 1; i++) {
        let pivotIdx = -1;
        for (let j = 0; j < cols - 1; j++) {
            if (matrix[i] && matrix[i][j].n !== 0) { pivotIdx = j; break; }
        }
        if (pivotIdx !== -1) {
            result[pivotIdx] = { n: -matrix[i][cols - 1].n, d: matrix[i][cols - 1].d };
        }
    }
    return { result, pivotCount };
}

/** @private Normalizes fractional coefficients to smallest positive integers. */
function _normalizeCoefficients(coeffs) {
    const firstNonZero = coeffs.find(c => c.n !== 0);
    if (!firstNonZero) throw new Error('Trivial solution — equation without coefficients.');

    const absCoeffs = coeffs.map(c => ({ n: Math.abs(c.n), d: Math.abs(c.d) }));
    let commonDenom = 1;
    absCoeffs.forEach(c => { commonDenom = Fraction.lcm(commonDenom, c.d); });

    const integers = absCoeffs.map(c => (c.n * commonDenom) / c.d);
    let overallGcd = integers[0];
    for (let i = 1; i < integers.length; i++) {
        overallGcd = Fraction.gcd(overallGcd, integers[i]);
    }
    return integers.map(n => n / overallGcd);
}

/**
 * Automatically balances the parsed equation.
 * Returns `wasChanged: false` if it was already balanced.
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {{ balanced: object, wasChanged: boolean }}
 */
export function balanceEquation(parsed) {
    _assertParsedEquation(parsed, 'balanceEquation');
    const working = JSON.parse(JSON.stringify(parsed));

    if (isBalanced(working)) {
        return { balanced: working, wasChanged: false };
    }

    const elements = _extractElements(working);
    const matrix   = _buildMatrix(working, elements);

    // Pre-validate that every element appears on both sides
    const reactantElems = new Set(working.reactants.flatMap(s => Object.keys(s.elements)));
    const productElems  = new Set(working.products.flatMap(s => Object.keys(s.elements)));
    for (const el of reactantElems) {
        if (!productElems.has(el)) throw new Error(`Impossible equation: "${el}" does not appear in the products.`);
    }
    for (const el of productElems) {
        if (!reactantElems.has(el)) throw new Error(`Impossible equation: "${el}" does not appear in the reactants.`);
    }

    try {
        const { result: rawCoeffs, pivotCount } = _solveMatrix(matrix);

        // With N unknowns, a single well-defined reaction has exactly one
        // free variable (fixed to 1 above). If more than one column has no
        // pivot, the system is underdetermined — e.g. it describes more
        // than one independent reaction at once — and this solver cannot
        // pick a unique answer.
        const freeVariables = matrix[0].length - pivotCount;
        if (freeVariables > 1) {
            throw new Error('This equation has more than one valid solution (underdetermined system) and cannot be balanced automatically.');
        }

        const finalCoeffs = _normalizeCoefficients(rawCoeffs);

        let idx = 0;
        working.reactants.forEach(s => { s.coeff = finalCoeffs[idx++]; });
        working.products.forEach(s  => { s.coeff = finalCoeffs[idx++]; });

        if (!isBalanced(working)) throw new Error('Post-balance validation failed.');

        return { balanced: working, wasChanged: true };
    } catch (err) {
        if (err && /more than one valid solution/.test(err.message)) throw err;
        throw new Error('Could not automatically balance the equation.');
    }
}

/**
 * Converts a parsed equation back to a plain (no-subscript) string.
 * Used to re-feed the calculation engine after auto-balancing.
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {string}
 */
export function stringifyEquation(parsed) {
    _assertParsedEquation(parsed, 'stringifyEquation');
    const side = arr => arr.map(s => `${s.coeff > 1 ? s.coeff : ''}${s.formula}`).join(' + ');
    return `${side(parsed.reactants)} -> ${side(parsed.products)}`;
}

// ═══════════════════════════════════════════════════════════════
// 3. LIMITING REAGENT ENGINE — strict stoichiometric method
// ═══════════════════════════════════════════════════════════════
//   Step 1 — Convert each reactant to moles (m/M or direct value)
//   Step 2 — Compute stoichiometric ratio (moles / coefficient)
//   Step 3 — Identify limiting reagent (smallest ratio)
//   Step 4 — Compute products formed
//   Step 5 — Compute excess remaining
// ═══════════════════════════════════════════════════════════════

/** @private Tie-tolerant comparison for stoichiometric ratios (floats). */
function _ratiosEqual(a, b) {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/**
 * Executes the 5 steps of the stoichiometric algorithm.
 *
 * @param {string} equationStr - Balanced equation, e.g. "2H2 + O2 -> 2H2O"
 * @param {Array<{value: number, unit: string}>} reactantInputs
 * @returns {object} Detailed result object
 */
export function calculateLimitingReagent(equationStr, reactantInputs) {

  if (!Array.isArray(reactantInputs)) {
    throw new Error('reactantInputs must be an array of { value, unit } objects.');
  }

  const parsed = parseEquation(equationStr);
  const { reactants, products } = parsed;

  if (reactantInputs.length !== reactants.length) {
    throw new Error(
      `Expected ${reactants.length} reactant(s), but received ${reactantInputs.length}.`
    );
  }

  // ── STEP 1: Convert each reactant to moles ────────────────────
  const reactantData = reactants.map((r, i) => {
    const input = reactantInputs[i];
    const { value, unit } = input;

    if (isNaN(value) || value <= 0) {
      throw new Error(
        `The quantity for reactant "${r.formula}" must be a positive number.`
      );
    }

    let moles;
    let conversionSteps = null;

    if (unit === 'g') {
      moles = value / r.molarMass;
      conversionSteps = {
        grams:     value,
        molarMass: r.molarMass,
        moles:     moles,
        equation:  `${value.toFixed(4)} g ÷ ${r.molarMass.toFixed(4)} g/mol = ${moles.toFixed(6)} mol`,
      };
    } else if (unit === 'mol') {
      moles = value;
      conversionSteps = {
        grams:     null,
        molarMass: r.molarMass,
        moles:     moles,
        equation:  `${value.toFixed(6)} mol (direct input)`,
      };
    } else {
      throw new Error(`Unknown unit "${unit}". Use "g" or "mol".`);
    }

    return {
      formula:         r.formula,
      elements:        r.elements,
      molarMass:       r.molarMass,
      coeff:           r.coeff,
      inputValue:      value,
      inputUnit:       unit,
      moles:           moles,
      conversionSteps: conversionSteps,
    };
  });

  // ── STEP 2: Stoichiometric ratios ──────────────────────────────
  const ratios = reactantData.map(r => ({
    formula: r.formula,
    moles:   r.moles,
    coeff:   r.coeff,
    ratio:   r.moles / r.coeff,
  }));

  // ── STEP 3: Identify the limiting reagent ─────────────────────
  let limitingIndex = 0;
  let limitingRatio = ratios[0].ratio;

  for (let i = 1; i < ratios.length; i++) {
    if (ratios[i].ratio < limitingRatio) {
      limitingRatio = ratios[i].ratio;
      limitingIndex = i;
    }
  }

  const limitingReagent = reactantData[limitingIndex];

  // ── STEP 4: Products formed ────────────────────────────────────
  const productsFormed = products.map(p => {
    const molesFormed = limitingRatio * p.coeff;
    const gramsFormed = molesFormed * p.molarMass;
    return {
      formula:     p.formula,
      coeff:       p.coeff,
      molarMass:   p.molarMass,
      molesFormed: molesFormed,
      gramsFormed: gramsFormed,
    };
  });

  // ── STEP 5: Excess reagents remaining ──────────────────────────
  const excessData = reactantData
    .map((r, i) => {
      const molesConsumed = limitingRatio * r.coeff;
      const molesExcess   = r.moles - molesConsumed;
      const gramsExcess   = molesExcess * r.molarMass;

      return {
        formula:       r.formula,
        molarMass:     r.molarMass,
        isLimiting:    _ratiosEqual(r.moles / r.coeff, limitingRatio),
        molesInitial:  r.moles,
        gramsInitial:  r.inputUnit === 'g' ? r.inputValue : r.moles * r.molarMass,
        molesConsumed: molesConsumed,
        molesExcess:   molesExcess,
        gramsExcess:   gramsExcess,
        percentUsed:   (molesConsumed / r.moles) * 100,
      };
    });

  return {
    equationFormatted: formatEquation(parsed),
    equationRaw:       equationStr,
    conversionTable: reactantData.map(r => ({
      formula:         r.formula,
      inputValue:      r.inputValue,
      inputUnit:       r.inputUnit,
      molarMass:       r.molarMass,
      moles:           r.moles,
      conversionSteps: r.conversionSteps,
    })),
    ratioTable: ratios.map((r, i) => ({
      formula:    r.formula,
      moles:      r.moles,
      coeff:      r.coeff,
      ratio:      r.ratio,
      isLimiting: _ratiosEqual(r.ratio, limitingRatio),
    })),
    limitingRatio:   limitingRatio,
    limitingReagent: {
      formula:   limitingReagent.formula,
      moles:     limitingReagent.moles,
      molarMass: limitingReagent.molarMass,
    },
    productsFormed: productsFormed,
    excessData:     excessData,
  };
}

/**
 * Validates raw limiting-reagent inputs before calculation.
 *
 * @param {string} equationStr
 * @param {Array<{value: any, unit: string}>} reactantInputs
 * @returns {string[]} List of error messages (empty if valid)
 */
export function validateLimitingReagentInput(equationStr, reactantInputs) {
  const errors = [];

  if (!equationStr || equationStr.trim() === '') {
    errors.push('The chemical equation cannot be empty.');
  }

  if (!equationStr.includes('->')) {
    errors.push('The equation must contain "->" as an arrow. Example: "2H2 + O2 -> 2H2O".');
  }

  for (let i = 0; i < reactantInputs.length; i++) {
    const inp = reactantInputs[i];
    if (inp.value === '' || inp.value === null || isNaN(Number(inp.value))) {
      errors.push(`Reactant #${i + 1} does not have a valid quantity.`);
    } else if (Number(inp.value) <= 0) {
      errors.push(`Reactant #${i + 1} must have a quantity greater than zero.`);
    }
  }

  return errors;
}

// ═══════════════════════════════════════════════════════════════
// 4. REDOX LOOKUP — Ion-Electron (Half-Reaction) Method
// ═══════════════════════════════════════════════════════════════
//   Matches free-text input against the pre-defined reaction set
//   in constants.js and returns the fully worked reaction object.
// ═══════════════════════════════════════════════════════════════

/**
 * Finds the pre-defined redox reaction matching a free-text input.
 *
 * @param {string} inputStr
 * @returns {object|null}
 */
export function getRedoxReaction(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return null;

  const normalized = inputStr
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/→|⇒|=>/g, '->')
    .replace(/²/g, '2')
    .replace(/⁻/g, '-');

  for (const reaction of Object.values(REDOX_REACTIONS)) {
    if (reaction.match(normalized)) {
      return reaction;
    }
  }

  return null;
}

/**
 * Looks up a pre-defined redox reaction by its id.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getReactionById(id) {
  return REDOX_REACTIONS[id] || null;
}
