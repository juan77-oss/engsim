/**
 * chem-balance.js
 * IEM Platform — Chemical Reactions Simulator
 * ─────────────────────────────────────────────
 * Automatic Balancing Engine
 *
 * Method:
 * 1. Build stoichiometric matrix A (Elements x Species)
 * 2. Solve A·x = 0 using Gaussian elimination (Fraction-based)
 * 3. Normalize to smallest integer coefficients
 *
 * Constraints:
 * - No external libraries
 * - Handles underdetermined systems
 * - Validates result correctness
 */

'use strict';

/**
 * Basic Fraction logic for exact arithmetic
 */
const Fraction = {
    gcd: (a, b) => {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            a %= b;
            [a, b] = [b, a];
        }
        return a;
    },
    lcm: (a, b) => (a * b) / Fraction.gcd(a, b),
    simplify: (f) => {
        const common = Fraction.gcd(f.n, f.d);
        return { n: f.n / common, d: f.d / common };
    },
    add: (f1, f2) => Fraction.simplify({ n: f1.n * f2.d + f2.n * f1.d, d: f1.d * f2.d }),
    sub: (f1, f2) => Fraction.simplify({ n: f1.n * f2.d - f2.n * f1.d, d: f1.d * f2.d }),
    mul: (f1, f2) => Fraction.simplify({ n: f1.n * f2.n, d: f1.d * f2.d }),
    div: (f1, f2) => {
        if (f2.n === 0) throw new Error("Division by zero in Fraction");
        let n = f1.n * f2.d;
        let d = f1.d * f2.n;
        if (d < 0) { n = -n; d = -d; }
        return Fraction.simplify({ n, d });
    },
    fromInt: (n) => ({ n, d: 1 }),
    zero: () => ({ n: 0, d: 1 }),
    one: () => ({ n: 1, d: 1 })
};

/**
 * Checks if the parsed equation is already balanced.
 */
export function isBalanced(parsed) {
    const counts = { reactants: {}, products: {} };

    const tabulate = (speciesArr, targetMap) => {
        speciesArr.forEach(s => {
            const coeff = s.coeff || 1;
            for (const [el, count] of Object.entries(s.elements)) {
                targetMap[el] = (targetMap[el] || 0) + count * coeff;
            }
        });
    };

    tabulate(parsed.reactants, counts.reactants);
    tabulate(parsed.products, counts.products);

    const allElements = new Set([
        ...Object.keys(counts.reactants),
        ...Object.keys(counts.products)
    ]);

    for (const el of allElements) {
        if (counts.reactants[el] !== counts.products[el]) return false;
    }
    return true;
}

/**
 * Extracts unique elements from the equation.
 */
function extractElements(parsed) {
    const elements = new Set();
    [...parsed.reactants, ...parsed.products].forEach(s => {
        Object.keys(s.elements).forEach(e => elements.add(e));
    });
    return Array.from(elements).sort();
}

/**
 * Builds the stoichiometric matrix (Fraction-based)
 */
function buildMatrix(parsed, elements) {
    const allSpecies = [...parsed.reactants, ...parsed.products];
    const matrix = [];

    for (const el of elements) {
        const row = [];
        // Reactants (positive)
        parsed.reactants.forEach(s => {
            row.push(Fraction.fromInt(s.elements[el] || 0));
        });
        // Products (negative)
        parsed.products.forEach(s => {
            row.push(Fraction.fromInt(-(s.elements[el] || 0)));
        });
        matrix.push(row);
    }
    return matrix;
}

/**
 * Solves the matrix using Gaussian elimination to find a non-trivial solution.
 */
function solveMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    let pivotRow = 0;
    let pivotCol = 0;

    // To RREF
    while (pivotRow < rows && pivotCol < cols) {
        let selRow = pivotRow;
        while (selRow < rows && matrix[selRow][pivotCol].n === 0) {
            selRow++;
        }

        if (selRow === rows) {
            pivotCol++;
            continue;
        }

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

        pivotRow++;
        pivotCol++;
    }

    // After RREF, if there's a free variable (usually the last one), we set it to 1.
    // For chemical equations, we assume one degree of freedom at the end.
    const result = Array(cols).fill(null).map(() => Fraction.zero());

    // Simplest case: fix the last variable to 1 and back-calculate
    result[cols - 1] = Fraction.one();

    for (let i = 0; i < cols - 1; i++) {
        // Find pivot for this row
        let pivotIdx = -1;
        for (let j = 0; j < cols - 1; j++) {
            if (matrix[i] && matrix[i][j].n !== 0) {
                pivotIdx = j;
                break;
            }
        }

        if (pivotIdx !== -1) {
            // x_pivot + Sum(coeff_j * x_j) = 0 => x_pivot = - Sum(coeff_j * x_j)
            // Here we only care about the last column (the one we fixed to 1)
            // because in RREF of [A|0], x_i = - matrix[i][last] * 1
            result[pivotIdx] = { n: -matrix[i][cols - 1].n, d: matrix[i][cols - 1].d };
        }
    }

    return result;
}

/**
 * Normalizes coefficients to smallest positive integers.
 */
function normalizeCoefficients(coeffs) {
    // 1. Remove negatives/zeros (all should be the same sign if physical)
    let firstNonZero = coeffs.find(c => c.n !== 0);
    if (!firstNonZero) throw new Error("Trivial solution");

    const multiplier = firstNonZero.n < 0 ? -1 : 1;
    const absCoeffs = coeffs.map(c => ({ n: Math.abs(c.n), d: Math.abs(c.d) }));

    // 2. Find LCM of denominators
    let commonDenom = 1;
    absCoeffs.forEach(c => {
        commonDenom = Fraction.lcm(commonDenom, c.d);
    });

    // 3. Multiply all by commonDenom to get integers
    const integers = absCoeffs.map(c => (c.n * commonDenom) / c.d);

    // 4. Divide by overall GCD
    let overallGcd = integers[0];
    for (let i = 1; i < integers.length; i++) {
        overallGcd = Fraction.gcd(overallGcd, integers[i]);
    }

    return integers.map(n => n / overallGcd);
}

/**
 * Main Balancing Function
 */
export function balanceEquation(parsed) {
    // 0. Safety deep copy
    const workingParsed = JSON.parse(JSON.stringify(parsed));

    // 1. Check if already balanced
    if (isBalanced(workingParsed)) {
        return { balanced: workingParsed, wasChanged: false };
    }

    // 2. Extract elements and build matrix
    const elements = extractElements(workingParsed);
    const matrix = buildMatrix(workingParsed, elements);

    // 3. Check common elements (Pre-check)
    const reactantElements = new Set();
    workingParsed.reactants.forEach(s => Object.keys(s.elements).forEach(e => reactantElements.add(e)));
    const productElements = new Set();
    workingParsed.products.forEach(s => Object.keys(s.elements).forEach(e => productElements.add(e)));

    for (const el of reactantElements) {
        if (!productElements.has(el)) throw new Error(`Impossible equation: no common elements for ${el}`);
    }
    for (const el of productElements) {
        if (!reactantElements.has(el)) throw new Error(`Impossible equation: no common elements for ${el}`);
    }

    // 4. Solve
    try {
        const rawCoeffs = solveMatrix(matrix);
        const finalCoeffs = normalizeCoefficients(rawCoeffs);

        // 5. Apply coefficients
        let idx = 0;
        workingParsed.reactants.forEach(s => s.coeff = finalCoeffs[idx++]);
        workingParsed.products.forEach(s => s.coeff = finalCoeffs[idx++]);

        // 6. Post-validate
        if (!isBalanced(workingParsed)) {
            throw new Error("Validation failed after balancing");
        }

        return { balanced: workingParsed, wasChanged: true };
    } catch (err) {
        console.error("Balancing failed:", err);
        throw new Error("No se pudo balancear la ecuación automáticamente");
    }
}

/**
 * Converts a parsed object back to a raw equation string (no subscripts).
 */
export function stringifyEquation(parsed) {
    const side = arr => arr.map(s => `${s.coeff > 1 ? s.coeff : ''}${s.formula}`).join(' + ');
    return `${side(parsed.reactants)} -> ${side(parsed.products)}`;
}