/**
 * chem-parser.js
 * IEM Platform — Chemical Reactions Simulator
 * ─────────────────────────────────────────────
 * Responsibilities:
 *   1. Parse a balanced chemical equation string (e.g. "2H2 + O2 -> 2H2O")
 *   2. Return structured reactant/product objects
 *   3. Parse molecular formulas into element maps (e.g. H2SO4 → {H:2, S:1, O:4})
 *   4. Calculate molar masses using the built-in atomic mass table
 *
 * EQUATION FORMAT ACCEPTED:
 *   "2H2 + O2 -> 2H2O"
 *   "N2 + 3H2 -> 2NH3"
 *   "Fe + S -> FeS"
 *   Coefficients are optional (default = 1).
 *   Arrow must be "->" (not → or ⇒).
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// ATOMIC MASS TABLE (standard atomic weights, IUPAC 2021)
// All masses in g/mol
// ═══════════════════════════════════════════════════════════════
export const ATOMIC_MASS = {
    H: 1.008,
    He: 4.003,
    Li: 6.941,
    Be: 9.012,
    B: 10.811,
    C: 12.011,
    N: 14.007,
    O: 15.999,
    F: 18.998,
    Ne: 20.180,
    Na: 22.990,
    Mg: 24.305,
    Al: 26.982,
    Si: 28.086,
    P: 30.974,
    S: 32.06,
    Cl: 35.45,
    Ar: 39.948,
    K: 39.098,
    Ca: 40.078,
    Sc: 44.956,
    Ti: 47.867,
    V: 50.942,
    Cr: 51.996,
    Mn: 54.938,
    Fe: 55.845,
    Co: 58.933,
    Ni: 58.693,
    Cu: 63.546,
    Zn: 65.38,
    Ga: 69.723,
    Ge: 72.630,
    As: 74.922,
    Se: 78.971,
    Br: 79.904,
    Kr: 83.798,
    Rb: 85.468,
    Sr: 87.62,
    Y: 88.906,
    Zr: 91.224,
    Nb: 92.906,
    Mo: 95.96,
    Tc: 98.000,
    Ru: 101.07,
    Rh: 102.906,
    Pd: 106.42,
    Ag: 107.868,
    Cd: 112.411,
    In: 114.818,
    Sn: 118.710,
    Sb: 121.760,
    Te: 127.60,
    I: 126.904,
    Xe: 131.293,
    Cs: 132.905,
    Ba: 137.327,
    La: 138.905,
    Ce: 140.116,
    Pr: 140.908,
    Nd: 144.242,
    Pm: 145.000,
    Sm: 150.36,
    Eu: 151.964,
    Gd: 157.25,
    Tb: 158.925,
    Dy: 162.500,
    Ho: 164.930,
    Er: 167.259,
    Tm: 168.934,
    Yb: 173.045,
    Lu: 174.967,
    Hf: 178.49,
    Ta: 180.948,
    W: 183.84,
    Re: 186.207,
    Os: 190.23,
    Ir: 192.217,
    Pt: 195.084,
    Au: 196.967,
    Hg: 200.592,
    Tl: 204.38,
    Pb: 207.2,
    Bi: 208.980,
    Po: 209.000,
    At: 210.000,
    Rn: 222.000,
    Fr: 223.000,
    Ra: 226.000,
    Ac: 227.000,
    Th: 232.038,
    Pa: 231.036,
    U: 238.029,
    Np: 237.000,
    Pu: 244.000,
    Am: 243.000,
    Cm: 247.000,
    Bk: 247.000,
    Cf: 251.000,
    Es: 252.000,
    Fm: 257.000,
    Md: 258.000,
    No: 259.000,
    Lr: 262.000,
    Rf: 267.000,
    Db: 268.000,
    Sg: 271.000,
    Bh: 272.000,
    Hs: 270.000,
    Mt: 276.000,
    Ds: 281.000,
    Rg: 280.000,
    Cn: 285.000,
    Nh: 284.000,
    Fl: 289.000,
    Mc: 288.000,
    Lv: 293.000,
    Ts: 294.000,
    Og: 294.000,
};

// ═══════════════════════════════════════════════════════════════
// MOLECULAR FORMULA PARSER
// Converts a formula string into an element-count map.
//
// Algorithm:
//   Scan the string character by character.
//   - Uppercase letter  → start of a new element symbol
//   - Lowercase letter  → continuation of current symbol
//   - Digit             → subscript count for current element or group
//   - '('/')'           → group multiplier (recursive)
//
// Examples:
//   "H2O"    → {H: 2, O: 1}
//   "H2SO4"  → {H: 2, S: 1, O: 4}
//   "Ca(OH)2"→ {Ca: 1, O: 2, H: 2}
//   "Fe2O3"  → {Fe: 2, O: 3}
// ═══════════════════════════════════════════════════════════════
export function parseMolecularFormula(formula) {
    // Recursive parser — returns element map for a substring and the
    // index position where parsing stopped (needed for closing parenthesis).
    function parseSegment(s, start) {
        const counts = {};
        let i = start;

        while (i < s.length) {
            const ch = s[i];

            if (ch === '(') {
                // Parse the group inside parentheses
                const result = parseSegment(s, i + 1);
                i = result.end + 1; // move past the closing ')'

                // Read the multiplier after ')'
                let multiplier = '';
                while (i < s.length && /\d/.test(s[i])) {
                    multiplier += s[i];
                    i++;
                }
                const mult = multiplier === '' ? 1 : parseInt(multiplier, 10);

                // Merge the group elements into current counts with multiplier
                for (const [elem, cnt] of Object.entries(result.counts)) {
                    counts[elem] = (counts[elem] || 0) + cnt * mult;
                }

            } else if (ch === ')') {
                // Signal the end of a group back to the caller
                return { counts, end: i };

            } else if (/[A-Z]/.test(ch)) {
                // Begin reading an element symbol (first letter always uppercase)
                let symbol = ch;
                i++;
                while (i < s.length && /[a-z]/.test(s[i])) {
                    symbol += s[i];
                    i++;
                }

                // Read the subscript digits that follow the symbol
                let subscript = '';
                while (i < s.length && /\d/.test(s[i])) {
                    subscript += s[i];
                    i++;
                }
                const count = subscript === '' ? 1 : parseInt(subscript, 10);
                counts[symbol] = (counts[symbol] || 0) + count;

            } else {
                // Skip any unrecognized characters (spaces, charges removed upstream)
                i++;
            }
        }

        return { counts, end: i };
    }

    const { counts } = parseSegment(formula, 0);
    return counts;
}

// ═══════════════════════════════════════════════════════════════
// MOLAR MASS CALCULATOR
// Given an element map {H:2, O:1}, returns the molar mass in g/mol.
// Throws if an element symbol is not in the atomic mass table.
// ═══════════════════════════════════════════════════════════════
export function calculateMolarMass(elementsMap) {
    let molarMass = 0;
    for (const [elem, count] of Object.entries(elementsMap)) {
        if (ATOMIC_MASS[elem] === undefined) {
            throw new Error(`Elemento desconocido: "${elem}". Verifica la fórmula molecular.`);
        }
        molarMass += ATOMIC_MASS[elem] * count;
    }
    return molarMass;
}

// ═══════════════════════════════════════════════════════════════
// SPECIES TOKEN PARSER
// Parses a single species token like "2H2O" or "Fe2O3" into:
//   { coeff: number, formula: string, elements: {}, molarMass: number }
//
// The coefficient is the leading integer (1 if absent).
// Everything after the coefficient is treated as the molecular formula.
// ═══════════════════════════════════════════════════════════════
function parseSpeciesToken(token) {
    token = token.trim();

    // Match leading integer coefficient (optional)
    const match = token.match(/^(\d*)([A-Z].*)$/);
    if (!match) {
        throw new Error(`Token inválido: "${token}". El formato debe ser como "2H2O" o "Fe2O3".`);
    }

    const coeff = match[1] === '' ? 1 : parseInt(match[1], 10);
    const formula = match[2];

    // Build element map and compute molar mass
    const elements = parseMolecularFormula(formula);
    const molarMass = calculateMolarMass(elements);

    return { coeff, formula, elements, molarMass };
}

// ═══════════════════════════════════════════════════════════════
// EQUATION PARSER  (main export)
// Parses a full balanced chemical equation string.
//
// Expected format: "2H2 + O2 -> 2H2O"
//   - Arrow must be "->" (spaces around it are optional)
//   - Species separated by "+"
//   - Coefficients are non-negative integers
//
// Returns:
//   {
//     reactants: [{coeff, formula, elements, molarMass}, ...],
//     products:  [{coeff, formula, elements, molarMass}, ...]
//   }
// ═══════════════════════════════════════════════════════════════
export function parseEquation(equationStr) {
    if (!equationStr || typeof equationStr !== 'string') {
        throw new Error('La ecuación no puede estar vacía.');
    }

    // Normalize: trim + collapse multiple spaces
    const normalized = equationStr.trim().replace(/\s+/g, ' ');

    // Reject malformed arrows before checking for "->"
    // Catches: "-->" "- >" "→" "⇒" "=>" etc.
    if (/(-{2,}>|={1,}>|[^-]>|→|⇒|⇌)/.test(normalized)) {
        throw new Error(
            'Flecha inválida. Usa únicamente "->" como separador. Ejemplo: "2H2 + O2 -> 2H2O"'
        );
    }

    // Require the "->" arrow
    if (!normalized.includes('->')) {
        throw new Error(
            'Formato inválido. Usa "->" como flecha. Ejemplo: "2H2 + O2 -> 2H2O"'
        );
    }

    // Reject multiple arrows (e.g. "A -> B -> C")
    if (normalized.split('->').length > 2) {
        throw new Error(
            'Flecha inválida. La ecuación debe tener una sola "->".'
        );
    }

    const [leftSide, rightSide] = normalized.split('->');

    if (!leftSide || !rightSide) {
        throw new Error('La ecuación debe tener reactivos y productos separados por "->".');
    }

    // Split each side on "+" and parse each species token
    const reactants = leftSide.split('+').map(t => parseSpeciesToken(t));
    const products = rightSide.split('+').map(t => parseSpeciesToken(t));

    if (reactants.length === 0) throw new Error('No se encontraron reactivos en la ecuación.');
    if (products.length === 0) throw new Error('No se encontraron productos en la ecuación.');

    return { reactants, products };
}

// ═══════════════════════════════════════════════════════════════
// EQUATION FORMATTER
// Returns a display-ready string for the parsed equation.
// Example: "2 H₂ + O₂ → 2 H₂O"
// Note: subscripts are rendered as Unicode subscript characters.
// ═══════════════════════════════════════════════════════════════
const SUBSCRIPT_MAP = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };

function toSubscript(str) {
    return String(str).replace(/[0-9]/g, d => SUBSCRIPT_MAP[d]);
}

export function formatFormula(formula) {
    // Replace trailing digits (subscripts) in the formula
    return formula.replace(/(\d+)/g, n => toSubscript(n));
}

export function formatEquation(parsed) {
    const side = arr =>
        arr.map(s => `${s.coeff > 1 ? s.coeff + ' ' : ''}${formatFormula(s.formula)}`).join(' + ');
    return `${side(parsed.reactants)} → ${side(parsed.products)}`;
}