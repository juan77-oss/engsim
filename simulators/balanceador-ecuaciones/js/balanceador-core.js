/**
 * balanceador-core.js — Motor Educativo (Arquitectura Solve-Then-Explain)
 * ─────────────────────────────────────────────────────────────────────────
 * PURPOSE : Módulo puro. Zero DOM. Zero side effects.
 *
 * FILOSOFÍA: El Solver (Gauss-Jordan) obtiene la solución correcta.
 *            El Pedagogy Engine decide cómo enseñarla, siguiendo reglas
 *            didácticas — no heurísticas algorítmicas.
 *
 * PIPELINE:
 *   equationStr
 *     → parseEquation()          [chem-parser]
 *     → balanceEquation()        [chem-balance — algebraic solver]
 *     → detectReactionType()     [classifies the reaction]
 *     → generatePedagogicalPath() [orders elements didactically]
 *     → generateEducationalSteps() [produces step array for UI]
 *
 * EXPORTS :
 *   Re-exported:  parseMolecularFormula, parseEquation, formatEquation,
 *                 formatFormula, ATOMIC_MASS, isBalanced, balanceEquation
 *   Own exports:
 *     countAtoms(parsed) → { reactants, products, allElements, imbalanced }
 *     buildCountTable(parsed) → TableRow[]
 *     getElementStatus(r, p) → 'balanced'|'excess-left'|'excess-right'
 *     detectReactionType(parsed) → string
 *     generatePedagogicalPath(parsedInput, balancedResult) → PathResult
 *     generateEducationalSteps(equationStr, options) → { steps[], metadata }
 *     difficultyScore(parsedInput, balancedResult) → number (1-15)
 *     detectErrors(userParsed, correctParsed) → ErrorReport[]
 *     validateUserCoefficient(userCoeff, expected, context) → FeedbackObj

 *     BANK_EXAMPLES — curated example bank
 *     getExamplesByFilter(filter) → Example[]
 *     getExampleById(id) → Example | undefined
 * ─────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  RE-EXPORTACIONES — chem-parser.js y chem-balance.js
//  Zero duplicación de lógica existente.
// ─────────────────────────────────────────────────────────────────────────────

import {
    parseMolecularFormula,
    parseEquation,
    formatEquation,
    formatFormula,
    ATOMIC_MASS,
} from './chem-parser.js';

import {
    isBalanced,
    balanceEquation,
} from './chem-balance.js';

export {
    parseMolecularFormula,
    parseEquation,
    formatEquation,
    formatFormula,
    ATOMIC_MASS,
    isBalanced,
    balanceEquation,
};


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 1 — CONTEO ATÓMICO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye los mapas de conteo atómico para ambos lados de la ecuación.
 * Considera los coeficientes vigentes de cada especie.
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {{ reactants, products, allElements, imbalanced }}
 */
export function countAtoms(parsed) {
    const rCounts = {};
    const pCounts = {};

    const tabulate = (arr, target) => {
        arr.forEach(s => {
            const coeff = s.coeff || 1;
            for (const [el, n] of Object.entries(s.elements)) {
                target[el] = (target[el] || 0) + n * coeff;
            }
        });
    };

    tabulate(parsed.reactants, rCounts);
    tabulate(parsed.products, pCounts);

    const allElements = Array.from(
        new Set([...Object.keys(rCounts), ...Object.keys(pCounts)])
    ).sort();

    const imbalanced = allElements.filter(el => rCounts[el] !== pCounts[el]);

    return { reactants: rCounts, products: pCounts, allElements, imbalanced };
}

/**
 * Estado de balance de un elemento.
 * @param {number} r
 * @param {number} p
 * @returns {'balanced' | 'excess-left' | 'excess-right'}
 */
export function getElementStatus(r, p) {
    if (r === p) return 'balanced';
    return r > p ? 'excess-left' : 'excess-right';
}

/**
 * Construye la tabla de conteo completa para renderizado en la UI.
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {Array<{ elemento, reactivos, productos, estado }>}
 */
export function buildCountTable(parsed) {
    const { reactants, products, allElements } = countAtoms(parsed);
    return allElements.map(el => ({
        elemento: el,
        reactivos: reactants[el] || 0,
        productos: products[el] || 0,
        estado: getElementStatus(reactants[el] || 0, products[el] || 0),
    }));
}

/** @private Helper: extrae todos los elementos únicos de la ecuación. */
function getUniqueElements(parsed) {
    return Array.from(new Set([
        ...parsed.reactants.flatMap(s => Object.keys(s.elements)),
        ...parsed.products.flatMap(s => Object.keys(s.elements)),
    ]));
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 2 — REGLAS PEDAGÓGICAS Y DETECCIÓN DE TIPO DE REACCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catálogo de reglas pedagógicas.
 * Cada regla define:
 *   - type: identificador
 *   - label: nombre legible
 *   - detect(parsed): boolean — ¿aplica esta regla a la ecuación?
 *   - getOrder(parsed, allElements): string[] — orden didáctico de elementos
 */
const REACTION_RULES = [
    {
        type: 'organic-combustion',
        label: 'Organic Combustion',
        pedagogicalNote: 'In organic combustions: balance C first, then H, and lastly O.',

        detect(parsed) {
            // Reactivos tienen C y H; productos contienen CO2 y H2O
            const rElems = new Set(parsed.reactants.flatMap(s => Object.keys(s.elements)));
            const pFormulas = parsed.products.map(s => s.formula.toUpperCase());
            return (
                rElems.has('C') &&
                rElems.has('H') &&
                pFormulas.some(f => f === 'CO2') &&
                pFormulas.some(f => f === 'H2O')
            );
        },

        getOrder(parsed, allElements) {
            // C → otros (excepto H y O) → H → O
            const others = allElements.filter(e => !['C', 'H', 'O'].includes(e));
            return ['C', ...others, 'H', 'O'].filter(e => allElements.includes(e));
        },
    },

    {
        type: 'inorganic-ionic',
        label: 'Inorganic Reaction with Ions',
        pedagogicalNote: 'With polyatomic ions: treat the ion as a unit; balance H and O last.',

        detect(parsed) {
            // Tiene grupos con paréntesis en la fórmula (iones poliatómicos)
            return [...parsed.reactants, ...parsed.products].some(s => s.formula.includes('('));
        },

        getOrder(parsed, allElements) {
            // Metales/cationes primero; H y O al final
            const heavy = allElements.filter(e => !['H', 'O', 'N', 'S', 'P', 'C'].includes(e));
            const mid = allElements.filter(e => ['N', 'S', 'P', 'C'].includes(e));
            return [...heavy, ...mid, 'H', 'O'].filter(e => allElements.includes(e));
        },
    },

    {
        type: 'simple-synthesis',
        label: 'Simple Synthesis',
        pedagogicalNote: 'Single product: balance the element with the highest subscript first.',

        detect(parsed) {
            return parsed.products.length === 1 && parsed.reactants.length >= 2;
        },

        getOrder(parsed, allElements) {
            return _sortByAtomCount(allElements, parsed);
        },
    },

    {
        type: 'decomposition',
        label: 'Decomposition',
        pedagogicalNote: 'Decomposition: a single reactant breaks into products. Balance the element with the highest subscript first.',

        detect(parsed) {
            return parsed.reactants.length === 1 && parsed.products.length >= 2;
        },

        getOrder(parsed, allElements) {
            return _sortByAtomCount(allElements, parsed);
        },
    },

    {
        type: 'double-displacement',
        label: 'Double Displacement (Metathesis)',
        pedagogicalNote: 'Double displacement: ion exchange. Balance metallic cations first, then anions; H and O last.',

        detect(parsed) {
            // 2 reactivos + 2 productos, con los mismos elementos reordenados
            if (parsed.reactants.length !== 2 || parsed.products.length !== 2) return false;
            const rElems = new Set(parsed.reactants.flatMap(s => Object.keys(s.elements)));
            const pElems = new Set(parsed.products.flatMap(s => Object.keys(s.elements)));
            return [...rElems].every(e => pElems.has(e)) && [...pElems].every(e => rElems.has(e));
        },

        getOrder(parsed, allElements) {
            const HALOGENS = ['Cl', 'F', 'Br', 'I'];
            const NON_METALS = ['H', 'O', 'N', 'S', 'P', 'C', ...HALOGENS];
            const metals = allElements.filter(e => !NON_METALS.includes(e));
            const halogens = allElements.filter(e => HALOGENS.includes(e));
            const other = allElements.filter(e => !metals.includes(e) && !halogens.includes(e) && !['H', 'O'].includes(e));
            return [...metals, ...halogens, ...other, 'H', 'O'].filter(e => allElements.includes(e));
        },
    },

    {
        type: 'neutralization',
        label: 'Acid-Base Neutralization',
        pedagogicalNote: 'Neutralization: acid + base → salt + water. Balance the metallic cation first, then the acid anion, and water last.',

        detect(parsed) {
            // Requiere que entre los productos haya H2O y que los reactivos aporten H y O (ácido + base)
            const pFormulas = parsed.products.map(s => s.formula.toUpperCase());
            const rElems = new Set(parsed.reactants.flatMap(s => Object.keys(s.elements)));
            return pFormulas.some(f => f === 'H2O') && rElems.has('H') && rElems.has('O');
        },

        getOrder(parsed, allElements) {
            const HALOGENS = ['Cl', 'F', 'Br', 'I'];
            const NON_METALS = ['H', 'O', 'N', 'S', 'P', 'C', ...HALOGENS];
            const metals = allElements.filter(e => !NON_METALS.includes(e));
            const acidAnions = allElements.filter(e => ['N', 'S', 'P', 'C', ...HALOGENS].includes(e));
            return [...metals, ...acidAnions, 'H', 'O'].filter(e => allElements.includes(e));
        },
    },

    {
        type: 'general',
        label: 'General Reaction',
        pedagogicalNote: 'General rule: highest atom count first; H and O last.',

        detect() { return true; }, // Fallback siempre activo

        getOrder(parsed, allElements) {
            return _sortByAtomCount(allElements, parsed);
        },
    },
];

/**
 * @private Ordena elementos: más átomos primero; H y O al final.
 */
function _sortByAtomCount(elements, parsed) {
    const allSpecies = [...parsed.reactants, ...parsed.products];

    const scored = elements.map(el => {
        const maxAtoms = Math.max(...allSpecies.map(s => s.elements[el] || 0));
        const priority = el === 'O' ? -2 : el === 'H' ? -1 : maxAtoms;
        return { el, priority };
    });

    scored.sort((a, b) => b.priority - a.priority);
    return scored.map(s => s.el);
}

/**
 * Detecta el tipo de reacción y retorna la regla aplicable.
 *
 * @param {{ reactants: object[], products: object[] }} parsed
 * @returns {object} — regla de REACTION_RULES
 */
export function detectReactionType(parsed) {
    return REACTION_RULES.find(rule => rule.detect(parsed));
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 3 — PEDAGOGY ENGINE: GENERACIÓN DEL PATH DIDÁCTICO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el path pedagógico: qué compuestos cambiar y en qué orden,
 * utilizando los coeficientes correctos del Solver como referencia.
 *
 * Principio: El Solver sabe el RESULTADO. El Pedagogy Engine sabe el CAMINO.
 *
 * @param {{ reactants: object[], products: object[] }} parsedInput - Ecuación original (coeff=1)
 * @param {{ reactants: object[], products: object[] }} balancedResult - Ecuación balanceada (Solver)
 * @returns {{
 *   elementOrder: string[],
 *   finalCoeffs: Record<string, number>,
 *   reactionType: string,
 *   pedagogicalNote: string,
 *   coefficientMoves: Array<{ formula, side, antes, despues, primaryElement }>
 * }}
 */
export function generatePedagogicalPath(parsedInput, balancedResult) {
    // 1. Mapa fórmula → coeficiente final (del Solver)
    const finalCoeffs = {};
    [...balancedResult.reactants, ...balancedResult.products].forEach(s => {
        finalCoeffs[s.formula] = s.coeff || 1;
    });

    // 2. Detectar tipo y obtener orden didáctico
    const rule = detectReactionType(parsedInput);
    const allElements = getUniqueElements(parsedInput);
    const elementOrder = rule.getOrder(parsedInput, allElements);

    // 3. Simular la aplicación de coeficientes en orden didáctico
    const workingState = _deepCopy(parsedInput);
    const coefficientMoves = [];

    // Elementos pendientes = todos los que están desbalanceados inicialmente
    const { imbalanced: initialImbalanced } = countAtoms(workingState);
    const pending = new Set(
        elementOrder.filter(el => initialImbalanced.includes(el))
    );

    // Procesar en orden didáctico, iterando si hay efectos secundarios
    const MAX_ROUNDS = 3;
    for (let round = 0; round < MAX_ROUNDS; round++) {
        let madeChange = false;

        for (const element of elementOrder) {
            if (!pending.has(element)) continue;

            const { imbalanced: nowImbalanced } = countAtoms(workingState);
            if (!nowImbalanced.includes(element)) {
                pending.delete(element); // Se balanceó como efecto secundario
                continue;
            }

            const move = _findBestMove(element, workingState, finalCoeffs);
            if (!move) continue;

            // Registrar el movimiento
            const { antes, despues } = move;
            if (antes !== despues) {
                coefficientMoves.push({ ...move, primaryElement: element });

                // Aplicar en workingState
                const species = workingState[move.side].find(s => s.formula === move.formula);
                if (species) {
                    species.coeff = despues;
                    madeChange = true;
                }

                // Detectar elementos recién desbalanceados (efecto cascada)
                const { imbalanced: afterImbalanced } = countAtoms(workingState);
                afterImbalanced.forEach(el => {
                    if (!pending.has(el) && elementOrder.includes(el)) {
                        pending.add(el);
                    }
                });
            }

            pending.delete(element);
        }

        if (!madeChange) break;
    }

    return {
        elementOrder,
        finalCoeffs,
        reactionType: rule.type,
        pedagogicalNote: rule.pedagogicalNote,
        coefficientMoves,
    };
}

/**
 * @private Encuentra el mejor movimiento para balancear un elemento.
 * "Mejor" = el compuesto del lado deficiente con finalCoeff conocido.
 */
function _findBestMove(element, workingState, finalCoeffs) {
    const { reactants: rC, products: pC } = countAtoms(workingState);
    const rCount = rC[element] || 0;
    const pCount = pC[element] || 0;

    if (rCount === pCount) return null;

    const deficientSide = rCount > pCount ? 'products' : 'reactants';
    const candidates = workingState[deficientSide]
        .filter(s => (s.elements[element] || 0) > 0)
        .map(s => ({
            formula: s.formula,
            side: deficientSide,
            antes: s.coeff || 1,
            despues: finalCoeffs[s.formula] || 1,
            atomsPerMolecule: s.elements[element],
        }))
        .filter(c => c.antes !== c.despues) // Solo los que cambian
        .sort((a, b) => b.atomsPerMolecule - a.atomsPerMolecule); // Mayor eficiencia primero

    if (candidates.length > 0) return candidates[0];

    // Fallback: intentar en el otro lado
    const otherSide = deficientSide === 'reactants' ? 'products' : 'reactants';
    const fallback = workingState[otherSide]
        .filter(s => (s.elements[element] || 0) > 0)
        .map(s => ({
            formula: s.formula,
            side: otherSide,
            antes: s.coeff || 1,
            despues: finalCoeffs[s.formula] || 1,
            atomsPerMolecule: s.elements[element],
        }))
        .filter(c => c.antes !== c.despues)
        .sort((a, b) => b.atomsPerMolecule - a.atomsPerMolecule);

    return fallback[0] || null;
}

/** @private Deep copy via JSON (suficiente para objetos parseados sin Date/Function). */
function _deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 4 — GENERACIÓN DE EXPLICACIONES DINÁMICAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el texto pedagógico para cada tipo de paso.
 * Las explicaciones se construyen a partir de los datos reales del paso,
 * no son strings hardcoded.
 */
function _generateExplanation(tipo, datos) {
    switch (tipo) {
        case 'analysis': {
            const { reactants, products } = datos;
            const rStr = reactants.map(s => formatFormula(s.formula)).join(', ');
            const pStr = products.map(s => formatFormula(s.formula)).join(', ');
            return (
                `The equation has ${reactants.length} reactant${reactants.length > 1 ? 's' : ''} ` +
                `(${rStr}) and ${products.length} product${products.length > 1 ? 's' : ''} (${pStr}). ` +
                `All coefficients implicitly start at 1. ` +
                `The goal is to find the lowest integers that conserve the number of atoms for each element.`
            );
        }

        case 'count': {
            const { tabla } = datos;
            const balanced = tabla.filter(r => r.estado === 'balanced').length;
            const total = tabla.length;
            if (balanced === total) {
                return 'With the current coefficients, all elements are balanced. No adjustments are required.';
            }
            if (balanced === 0) {
                return (
                    `We count the atoms on both sides with coefficient 1. ` +
                    `None of the ${total} element${total > 1 ? 's' : ''} is balanced yet. ` +
                    `Numbers in red indicate excess in reactants; in blue, excess in products.`
                );
            }
            return (
                `With coefficient 1, ${balanced} out of ${total} element${total > 1 ? 's' : ''} ` +
                `are already balanced. We must adjust the remaining ones.`
            );
        }

        case 'imbalance': {
            const { imbalanced, details } = datos;
            if (imbalanced.length === 0) return 'All elements are balanced!';
            const detail = imbalanced.map(el => {
                const d = details[el];
                return `${el}: ${d.reactivos} (reactants) ≠ ${d.productos} (products), difference of ${d.diferencia}`;
            }).join('; ');
            return (
                `We detected ${imbalanced.length} unbalanced element${imbalanced.length > 1 ? 's' : ''}: ` +
                `${imbalanced.join(', ')}. Detail: ${detail}. ` +
                `We begin adjusting following the didactic order established by the reaction type.`
            );
        }

        case 'reactionType': {
            const { typeName, note } = datos;
            return (
                `This equation is classified as: <strong>${typeName}</strong>. ` +
                `${note} ` +
                `This order minimizes the necessary readjustments and follows the standard convention in textbooks.`
            );
        }

        case 'selection': {
            const { element, reason, remaining } = datos;
            const remainingStr = remaining.length > 0
                ? ` We will process later: ${remaining.join(' → ')}.`
                : ' This is the last element to adjust.';
            return (
                `We work on the element <strong>${element}</strong> because ${reason}.${remainingStr}`
            );
        }

        case 'coefficient': {
            const { formula, side, antes, despues, element } = datos;
            const sideLabel = side === 'products' ? 'products' : 'reactants';
            const fmtCompound = formatFormula(formula);
            const action = despues > antes
                ? `we multiply by ${despues} (increase from ${antes} to ${despues})`
                : `we reduce from ${antes} to ${despues}`;
            return (
                `To equalize <strong>${element}</strong>, ${action} the coefficient of ` +
                `<strong>${fmtCompound}</strong> on the ${sideLabel} side. ` +
                `This change affects all atoms in ${fmtCompound}: ` +
                `verify the full count in the next step.`
            );
        }

        case 'update': {
            const { tabla, imbalancedRemaining } = datos;
            const newlyBalanced = tabla.filter(r => r.estado === 'balanced').map(r => r.elemento);
            const stillOff = tabla.filter(r => r.estado !== 'balanced').map(r => r.elemento);
            let msg = 'We recalculate the full count. ';
            if (newlyBalanced.length > 0) msg += `Balanced: ${newlyBalanced.join(', ')}. `;
            if (stillOff.length > 0) {
                msg += `Still pending: ${stillOff.join(', ')}. `;
            }
            if (imbalancedRemaining.length > 0) {
                msg += `The previous adjustment may have created an imbalance in ${imbalancedRemaining.join(', ')}: this is normal and will be corrected in subsequent steps.`;
            }
            return msg;
        }

        case 'verification': {
            const { allBalanced, tabla } = datos;
            if (allBalanced) {
                return (
                    `Complete verification: all elements have the same number of atoms on both sides. ` +
                    `The <strong>Law of Conservation of Mass</strong> is fulfilled: no atom is created nor destroyed, ` +
                    `they are only reorganized during the reaction.`
                );
            }
            const off = tabla.filter(r => r.estado !== 'balanced').map(r => r.elemento);
            return `Verification failed. Elements that still do not match: ${off.join(', ')}.`;
        }

        case 'result': {
            const { ecuacionBalanceada, coeficientes, reactionType } = datos;
            const coeffStr = Object.entries(coeficientes)
                .map(([f, c]) => `${formatFormula(f)}×${c}`)
                .join(', ');
            return (
                `Final balanced equation. Coefficients: ${coeffStr}. ` +
                `Verified by the algebraic method (Gauss-Jordan elimination) with exact fraction arithmetic.`
            );
        }

        case 'algebraic': {
            return (
                'The algebraic method builds a system of linear equations: ' +
                'each element generates an equation of the form "sum in reactants = sum in products". ' +
                'The stoichiometric matrix (elements × species) is solved by Gauss-Jordan elimination ' +
                'with exact fraction arithmetic, guaranteeing minimal integer coefficients. ' +
                'This is the same technique used in linear algebra to solve Ax = 0 systems.'
            );
        }

        default:
            return '';
    }
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 5 — GENERADOR DE PASOS PEDAGÓGICOS ⭐ FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el array completo de pasos pedagógicos para una ecuación.
 * Arquitectura Solve-Then-Explain:
 *   1. El Solver obtiene la solución algebraicamente correcta.
 *   2. El Pedagogy Engine genera una narrativa didáctica que lleva al estudiante
 *      a esa misma solución usando convenciones de aula.
 *
 * @param {string} equationStr - Ecuación sin balancear, ej. "H2 + O2 -> H2O"
 */
export function generateEducationalSteps(equationStr) {

    // ── 1. Parsear entrada ───────────────────────────────────────────────────
    const parsedInput = parseEquation(equationStr);
    parsedInput.reactants.forEach(s => { s.coeff = 1; });
    parsedInput.products.forEach(s => { s.coeff = 1; });

    const steps = [];
    let idx = 1;

    // ── 2. Resolver algebraicamente ──────────────────────────────────────────
    let balancedResult;
    let alreadyBalanced = false;

    if (isBalanced(parsedInput)) {
        balancedResult = _deepCopy(parsedInput);
        alreadyBalanced = true;
    } else {
        try {
            const res = balanceEquation(parsedInput);
            balancedResult = res.balanced;
        } catch (err) {
            throw new Error(`Could not solve the equation: ${err.message}`);
        }
    }

    // ── 3. Generar path pedagógico ───────────────────────────────────────────
    const {
        elementOrder,
        finalCoeffs,
        reactionType,
        pedagogicalNote,
        coefficientMoves,
    } = generatePedagogicalPath(parsedInput, balancedResult);

    // ── 4. Construir los steps ───────────────────────────────────────────────

    // PASO 1: Análisis
    steps.push({
        tipo: 'analysis',
        index: idx++,
        titulo: 'Identification of reactants and products',
        icono: '🔬',
        explicacion: _generateExplanation('analysis', {
            reactants: parsedInput.reactants,
            products: parsedInput.products,
        }),
        datos: {
            reactants: parsedInput.reactants,
            products: parsedInput.products,
        },
    });

    // PASO 2: Tipo de reacción (novedad v2)
    const ruleUsed = detectReactionType(parsedInput);
    steps.push({
        tipo: 'reactionType',
        index: idx++,
        titulo: 'Classification and balancing strategy',
        icono: '📋',
        explicacion: _generateExplanation('reactionType', {
            typeName: ruleUsed.label,
            note: pedagogicalNote,
        }),
        datos: {
            reactionType,
            typeName: ruleUsed.label,
            elementOrder,
            pedagogicalNote,
        },
    });

    // PASO 3: Conteo inicial
    const initialTable = buildCountTable(parsedInput);
    steps.push({
        tipo: 'count',
        index: idx++,
        titulo: 'Initial atom count (coefficients = 1)',
        icono: '📊',
        explicacion: _generateExplanation('count', { tabla: initialTable }),
        datos: { tabla: initialTable },
    });

    // PASO 4: Detección de desbalances
    if (alreadyBalanced) {
        steps.push({
            tipo: 'verification',
            index: idx++,
            titulo: 'Verification — Equation already balanced',
            icono: '✅',
            explicacion: 'The equation was already correctly balanced from the start. No adjustments are required.',
            datos: { tabla: initialTable, allBalanced: true },
        });
    } else {
        const { imbalanced, reactants, products } = countAtoms(parsedInput);
        const details = {};
        imbalanced.forEach(el => {
            details[el] = {
                reactivos: reactants[el] || 0,
                productos: products[el] || 0,
                diferencia: Math.abs((reactants[el] || 0) - (products[el] || 0)),
            };
        });
        steps.push({
            tipo: 'imbalance',
            index: idx++,
            titulo: 'Detection of unbalanced elements',
            icono: '⚠️',
            explicacion: _generateExplanation('imbalance', { imbalanced, details }),
            datos: { imbalanced, details },
        });

        // PASOS 5-N: Selección → Coeficiente → Actualización (un grupo por movimiento)
        const workingState = _deepCopy(parsedInput);

        coefficientMoves.forEach((move, i) => {
            const remaining = elementOrder.filter((el, elIdx) => {
                const moveIdx = coefficientMoves.findIndex(m => m.primaryElement === el);
                return moveIdx > i;
            }).map(el => el);

            // Determinar razón pedagógica de la selección
            const reason = _getSelectionReason(move.primaryElement, ruleUsed.type, workingState);

            // Sub-paso A: Selección
            steps.push({
                tipo: 'selection',
                index: idx++,
                titulo: `We select: element ${move.primaryElement}`,
                icono: '🎯',
                explicacion: _generateExplanation('selection', {
                    element: move.primaryElement,
                    reason,
                    remaining: [...new Set(remaining.slice(0, 3))],
                }),
                datos: {
                    selected: move.primaryElement,
                    reason,
                    remaining,
                    reactionType,
                },
            });

            // Sub-paso B: Aplicación de coeficiente
            // parsedStateBefore: snapshot previo al cambio — usado por detectErrors(ERROR-01)
            // y por la UI para renderizar la ecuación en su estado anterior.
            steps.push({
                tipo: 'coefficient',
                index: idx++,
                titulo: `Adjustment: coefficient of ${formatFormula(move.formula)}`,
                icono: '✏️',
                explicacion: _generateExplanation('coefficient', {
                    formula: move.formula,
                    side: move.side,
                    antes: move.antes,
                    despues: move.despues,
                    element: move.primaryElement,
                }),
                datos: {
                    formula: move.formula,
                    side: move.side,
                    antes: move.antes,
                    despues: move.despues,
                    element: move.primaryElement,
                    affectedElements: Object.keys(
                        workingState[move.side].find(s => s.formula === move.formula)?.elements || {}
                    ),
                    // Estado de la ecuación ANTES de aplicar este coeficiente.
                    // Permite al Simulator pasar prevState a detectErrors().
                    parsedStateBefore: _deepCopy(workingState),
                },
            });

            // Aplicar en workingState
            const species = workingState[move.side].find(s => s.formula === move.formula);
            if (species) species.coeff = move.despues;

            // Sub-paso C: Actualización
            const newTable = buildCountTable(workingState);
            const { imbalanced: nowImbalanced } = countAtoms(workingState);
            steps.push({
                tipo: 'update',
                index: idx++,
                titulo: 'Count update',
                icono: '🔄',
                explicacion: _generateExplanation('update', {
                    tabla: newTable,
                    imbalancedRemaining: nowImbalanced,
                }),
                datos: {
                    tabla: newTable,
                    imbalancedRemaining: nowImbalanced,
                    changedElement: move.primaryElement,
                    // Estado intermedio de la ecuación DESPUÉS del ajuste.
                    // La UI debe usar este objeto para renderizar la ecuación
                    // parcialmente balanceada en cada paso, en lugar del parsedInput inicial.
                    parsedIntermediate: _deepCopy(workingState),
                },
            });
        });

        // PASO N+1: Verificación final
        const finalTable = buildCountTable(workingState);
        const allOk = isBalanced(workingState);
        steps.push({
            tipo: 'verification',
            index: idx++,
            titulo: 'Final verification',
            icono: '✅',
            explicacion: _generateExplanation('verification', {
                tabla: finalTable,
                allBalanced: allOk,
            }),
            datos: { tabla: finalTable, allBalanced: allOk },
        });
    }

    // PASO FINAL: Resultado
    const coeficientes = {};
    [...balancedResult.reactants, ...balancedResult.products].forEach(s => {
        coeficientes[s.formula] = s.coeff || 1;
    });
    steps.push({
        tipo: 'result',
        index: idx++,
        titulo: 'Balanced equation',
        icono: '🎓',
        explicacion: _generateExplanation('result', {
            ecuacionBalanceada: formatEquation(balancedResult),
            coeficientes,
            reactionType,
        }),
        datos: {
            ecuacionOriginal: formatEquation(parsedInput),
            ecuacionBalanceada: formatEquation(balancedResult),
            coeficientes,
            parsedBalanced: balancedResult,
            reactionType,
        },
    });



    // Computar metadata
    const score = difficultyScore(parsedInput, balancedResult);
    const complexity = score <= 3 ? 'basic' : score <= 6 ? 'intermediate' : score <= 10 ? 'advanced' : 'expert';

    return {
        steps,
        metadata: {
            totalSteps: steps.length,
            reactionType,
            complexity,
            difficultyScore: score,
            elementOrder,
            alreadyBalanced,
            balancedEquation: formatEquation(balancedResult),
        },
    };
}

/** @private Genera la razón pedagógica de selección de un elemento. */
function _getSelectionReason(element, reactionType, parsed) {
    if (reactionType === 'organic-combustion') {
        if (element === 'C') return 'in organic combustions, carbon is balanced first as it is the central element';
        if (element === 'H') return 'hydrogen is adjusted after carbon, before resolving oxygen';
        if (element === 'O') return 'oxygen is always balanced last in combustions, since it depends on CO₂ and H₂O';
    }
    if (element === 'O') return 'oxygen is generally reserved for last, as it appears in multiple compounds';
    if (element === 'H') return 'hydrogen is adjusted near the end alongside oxygen';
    const allSpecies = [...parsed.reactants, ...parsed.products];
    const count = allSpecies.filter(s => element in s.elements).length;
    return `it appears in ${count} compound${count > 1 ? 's' : ''} and has a significant weight in the equation's structure`;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 6 — DIFFICULTY SCORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la dificultad de una ecuación en escala 1–15.
 * Las variables son completamente computables sin input manual.
 *
 * Variables:
 *   species      — número de compuestos distintos
 *   elements     — número de elementos distintos
 *   maxCoeff     — coeficiente máximo en la solución
 *   changes      — cuántos compuestos cambian su coeficiente desde 1
 *   hasParens    — presencia de grupos parentéticos (Ca(OH)₂, etc.)
 *
 * Nota: la fórmula está calibrada para dar 1–2 en ecuaciones triviales
 * y 10-15 en ecuaciones avanzadas. Requiere ajuste fino con el banco completo.
 *
 * @param {{ reactants: object[], products: object[] }} parsedInput
 * @param {{ reactants: object[], products: object[] }} balancedResult
 * @returns {number} 1–15
 */
export function difficultyScore(parsedInput, balancedResult) {
    const allSpeciesInput = [...parsedInput.reactants, ...parsedInput.products];
    const allSpeciesBalanced = [...balancedResult.reactants, ...balancedResult.products];

    const species = allSpeciesInput.length;
    const elements = getUniqueElements(parsedInput).length;
    const coefficients = allSpeciesBalanced.map(s => s.coeff || 1);
    const maxCoeff = Math.max(...coefficients);
    const changes = coefficients.filter(c => c !== 1).length;
    const hasParens = allSpeciesInput.some(s => s.formula.includes('('));

    const raw =
        (species - 2) * 0.5 +
        (elements - 1) * 0.8 +
        (maxCoeff - 1) * 0.35 +
        changes * 0.55 +
        (hasParens ? 2.0 : 0);

    return Math.max(1, Math.min(15, Math.round(raw)));
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 7 — CATÁLOGO DE ERRORES TÍPICOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Catálogo de errores frecuentes de estudiantes al balancear ecuaciones.
 * Cada error define un detector automático y un mensaje pedagógico.
 */
export const ERROR_CATALOG = [
    {
        id: 'ERROR-01',
        tipo: 'propagation',
        titulo: 'Fix one, break another',
        /**
         * Detects if the user balanced an element but unbalanced another that was previously correct.
         * Requires prevState (snapshot before the user's last change).
         * If prevState is null, the detector silently skips (best-effort).
         *
         * INTEGRATION: the Simulator must pass steps[i].datos.parsedStateBefore
         * as the third argument when calling detectErrors() in training mode.
         *
         * @param {object} userParsed  — user's current state
         * @param {object} correctParsed — reference correct equation
         * @param {object|null} prevState — snapshot of the user's previous state
         */
        detector(userParsed, correctParsed, prevState = null) {
            if (!prevState) return false;
            const { reactants: pR, products: pP } = countAtoms(prevState);
            const { reactants: cR, products: cP } = countAtoms(userParsed);
            const allEls = new Set([...Object.keys(pR), ...Object.keys(pP)]);
            for (const el of allEls) {
                const wasBalanced = (pR[el] || 0) === (pP[el] || 0);
                const nowUnbalanced = (cR[el] || 0) !== (cP[el] || 0);
                if (wasBalanced && nowUnbalanced) return true;
            }
            return false;
        },
        mensaje:
            'By adjusting a coefficient, all elements in that molecule are affected. ' +
            'Check the full count after every change, not just the element you corrected.',
        consejo: 'Use the count table to check ALL elements before moving to the next step.',
    },

    {
        id: 'ERROR-02',
        tipo: 'structural',
        titulo: 'Subscript instead of coefficient',
        detector(userParsed, correctParsed) {
            const correctFormulas = new Set([
                ...correctParsed.reactants.map(s => s.formula),
                ...correctParsed.products.map(s => s.formula),
            ]);
            return [...userParsed.reactants, ...userParsed.products]
                .some(s => !correctFormulas.has(s.formula));
        },
        mensaje:
            'You have modified the molecular formula (the subscripts), not the coefficient. ' +
            'Subscripts are part of the formula and represent the composition of the compound: they cannot be changed.',
        consejo: 'The coefficient goes BEFORE the formula (2H₂O), never inside (H₂O₂ is hydrogen peroxide, not water×2).',
    },

    {
        id: 'ERROR-03',
        tipo: 'counting',
        titulo: 'Unreduced coefficients (non-minimal solution)',
        detector(userParsed, correctParsed) {
            if (!isBalanced(userParsed)) return false;
            const coefficients = [...userParsed.reactants, ...userParsed.products].map(s => s.coeff || 1);
            const gcd = coefficients.reduce((a, b) => { let x = a, y = b; while (y) { [x, y] = [y, x % y]; } return x; });
            return gcd > 1;
        },
        mensaje:
            'The equation is balanced, but the coefficients are not minimal. ' +
            'By convention, the smallest possible positive integers are used.',
        consejo: (userParsed) => {
            const coefficients = [...userParsed.reactants, ...userParsed.products].map(s => s.coeff || 1);
            const gcd = coefficients.reduce((a, b) => { let x = a, y = b; while (y) { [x, y] = [y, x % y]; } return x; });
            return `Divide all coefficients by ${gcd}.`;
        },
    },

    {
        id: 'ERROR-04',
        tipo: 'counting',
        titulo: 'Oxygen unverified (combustions)',
        detector(userParsed, correctParsed) {
            const { reactants: uR, products: uP, imbalanced } = countAtoms(userParsed);
            if (!imbalanced.includes('O')) return false;
            const elems = getUniqueElements(userParsed);
            const allExceptO = elems.filter(e => e !== 'O');
            const { imbalanced: imb } = countAtoms(userParsed);
            const onlyOIsOff = allExceptO.every(e => !imb.includes(e)) && imb.includes('O');
            return onlyOIsOff;
        },
        mensaje:
            'Carbon and hydrogen are balanced, but oxygen does not match yet. ' +
            'In combustions, O₂ is always the last adjustment, because its coefficient depends on how much CO₂ and H₂O are produced.',
        consejo: 'Add up the oxygens in CO₂ and H₂O on the products side to know how many O₂ molecules you need.',
    },

    {
        id: 'ERROR-05',
        tipo: 'structural',
        titulo: 'Omitted compound',
        detector(userParsed, correctParsed) {
            const correctCount = correctParsed.reactants.length + correctParsed.products.length;
            const userCount = userParsed.reactants.length + userParsed.products.length;
            return userCount < correctCount;
        },
        mensaje:
            'Your equation has fewer compounds than the original. ' +
            'When balancing, you can only change coefficients, not eliminate species.',
        consejo: 'Write the complete equation with all reactants and products before adjusting coefficients.',
    },

    {
        id: 'ERROR-06',
        tipo: 'conceptual',
        titulo: 'Zero or negative coefficient',
        detector(userParsed) {
            return [...userParsed.reactants, ...userParsed.products]
                .some(s => (s.coeff || 1) <= 0);
        },
        mensaje:
            'Coefficients in a chemical equation are always positive integers (≥ 1). ' +
            'There are no zero or negative coefficients in this context.',
        consejo: 'If a compound "is left over", the problem is in another coefficient, not in eliminating that term.',
    },

    {
        id: 'ERROR-07',
        tipo: 'input',
        titulo: 'Non-integer coefficient',
        detector(userParsed) {
            return [...userParsed.reactants, ...userParsed.products]
                .some(s => !Number.isInteger(Number(s.coeff ?? 1)));
        },
        mensaje:
            'Coefficients must be positive integers. ' +
            'A decimal or fractional value is not valid in standard chemical equation notation.',
        consejo:
            'If your calculation yields 1.5, multiply the entire equation by the denominator ' +
            '(×2 in this case) to obtain integer coefficients: 1, 2, 3...',
    },
];

/**
 * Detecta errores en la ecuación propuesta por el usuario.
 *
 * @param {{ reactants: object[], products: object[] }} userParsed - Ecuación del usuario
 * @param {{ reactants: object[], products: object[] }} correctParsed - Ecuación correcta
 * @returns {Array<{ id, titulo, mensaje, consejo }>}
 */
/**
 * Detecta errores en la ecuación propuesta por el usuario.
 *
 * @param {{ reactants: object[], products: object[] }} userParsed   — Ecuación del usuario
 * @param {{ reactants: object[], products: object[] }} correctParsed — Ecuación correcta
 * @param {{ reactants: object[], products: object[] }|null} prevState
 *   — Snapshot del estado anterior del usuario, requerido para ERROR-01.
 *   Pasar `steps[i].datos.parsedStateBefore` desde el Simulator en modo entrenamiento.
 * @returns {Array<{ id, tipo, titulo, mensaje, consejo }>}
 */
export function detectErrors(userParsed, correctParsed, prevState = null) {
    const found = [];

    for (const error of ERROR_CATALOG) {
        try {
            if (error.detector(userParsed, correctParsed, prevState)) {
                found.push({
                    id: error.id,
                    tipo: error.tipo,
                    titulo: error.titulo,
                    mensaje: error.mensaje,
                    consejo: typeof error.consejo === 'function'
                        ? error.consejo(userParsed)
                        : error.consejo,
                });
            }
        } catch (_) {
            // Silenciar errores del detector; son best-effort
        }
    }

    return found;
}


// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 8 — VALIDACIÓN (MODO ENTRENAMIENTO Y EXAMEN)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida el coeficiente propuesto por el usuario en modo entrenamiento.
 *
 * @param {number} userCoeff  - Propuesta del usuario
 * @param {number} expected   - Coeficiente correcto
 * @param {{ formula: string, element: string, side: string }} context
 * @returns {{ status: string, message: string, hint: string | null, nextSuggestion: string | null }}
 */
export function validateUserCoefficient(userCoeff, expected, context) {
    const fmtFormula = formatFormula(context.formula);

    if (!Number.isInteger(userCoeff) || userCoeff < 1) {
        return {
            status: 'invalid',
            message: 'The coefficient must be a positive integer (≥ 1).',
            hint: 'Coefficients in chemistry are always positive integers. Try 1, 2, 3...',
            nextSuggestion: null,
        };
    }

    if (userCoeff === expected) {
        return {
            status: 'correct',
            message: `Correct. The coefficient ${expected} in ${fmtFormula} balances the ${context.element}.`,
            hint: null,
            nextSuggestion: 'Check the updated count and advance to the next element.',
        };
    }

    const diff = expected - userCoeff;
    const hint = diff > 0
        ? `The coefficient is too small. With ${userCoeff}, the ${context.element} in ${context.side === 'products' ? 'products' : 'reactants'} falls short.`
        : `The coefficient is too large. With ${userCoeff}, the ${context.element} in ${context.side === 'products' ? 'products' : 'reactants'} exceeds the needed amount.`;

    return {
        status: 'incorrect',
        message: `The coefficient ${userCoeff} in ${fmtFormula} does not balance the ${context.element}.`,
        hint,
        nextSuggestion: 'Check the count table and adjust the value.',
    };
}




// ─────────────────────────────────────────────────────────────────────────────
//  SECCIÓN 9 — BANCO DE EJEMPLOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Banco de ejemplos predefinidos con difficultyScore pre-calculado.
 * Los scores se calcularon con difficultyScore() y están fijados para consistencia.
 */
export const BANK_EXAMPLES = [

    // ══════════════════════════════════════════════════════════════════════════
    //  FREE — BASIC  (difficultyScore 1–3)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'agua',
        label: 'Water Synthesis',
        subtitle: 'H₂ + O₂',
        input: 'H2 + O2 -> H2O',
        balanced: '2H2 + O2 -> 2H2O',
        difficulty: 'basic',
        topic: 'sintesis',
        tier: 'free',
        difficultyScore: 2,
    },
    {
        id: 'co2',
        label: 'Carbon Combustion',
        subtitle: 'C + O₂',
        input: 'C + O2 -> CO2',
        balanced: 'C + O2 -> CO2',
        difficulty: 'basic',
        topic: 'combustion',
        difficultyScore: 1,
    },
    {
        id: 'hcl-sintesis',
        label: 'Hydrogen Chloride Synthesis',
        subtitle: 'H₂ + Cl₂',
        input: 'H2 + Cl2 -> HCl',
        balanced: 'H2 + Cl2 -> 2HCl',
        difficulty: 'basic',
        topic: 'sintesis',
        tier: 'free',
        difficultyScore: 2,
    },
    {
        id: 'caco3-desc',
        label: 'Calcium Carbonate Decomposition',
        subtitle: 'CaCO₃ → CaO + CO₂',
        input: 'CaCO3 -> CaO + CO2',
        balanced: 'CaCO3 -> CaO + CO2',
        difficulty: 'basic',
        topic: 'descomposicion',
        tier: 'free',
        difficultyScore: 2,
        note: 'Already balanced — illustrates thermal decomposition reactions.',
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  FREE — INTERMEDIATE  (difficultyScore 4–6)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'amoniaco',
        label: 'Ammonia Synthesis',
        subtitle: 'N₂ + H₂',
        input: 'N2 + H2 -> NH3',
        balanced: 'N2 + 3H2 -> 2NH3',
        difficulty: 'intermediate',
        topic: 'sintesis',
        tier: 'free',
        difficultyScore: 4,
    },
    {
        id: 'hierro',
        label: 'Iron (III) Oxide',
        subtitle: 'Fe + O₂',
        input: 'Fe + O2 -> Fe2O3',
        balanced: '4Fe + 3O2 -> 2Fe2O3',
        difficulty: 'intermediate',
        topic: 'oxidacion',
        tier: 'free',
        difficultyScore: 5,
    },
    {
        id: 'metano',
        label: 'Methane Combustion',
        subtitle: 'CH₄ + O₂',
        input: 'CH4 + O2 -> CO2 + H2O',
        balanced: 'CH4 + 2O2 -> CO2 + 2H2O',
        difficulty: 'intermediate',
        topic: 'combustion',
        tier: 'free',
        difficultyScore: 6,
    },
    {
        id: 'aluminio',
        label: 'Aluminum Oxide',
        subtitle: 'Al + O₂',
        input: 'Al + O2 -> Al2O3',
        balanced: '4Al + 3O2 -> 2Al2O3',
        difficulty: 'intermediate',
        topic: 'oxidacion',
        tier: 'free',
        difficultyScore: 5,
    },
    {
        id: 'kclo3',
        label: 'Potassium Chlorate Decomposition',
        subtitle: 'KClO₃ → KCl + O₂',
        input: 'KClO3 -> KCl + O2',
        balanced: '2KClO3 -> 2KCl + 3O2',
        difficulty: 'intermediate',
        topic: 'descomposicion',
        tier: 'free',
        difficultyScore: 4,
    },
    {
        id: 'al-hcl',
        label: 'Aluminum with Hydrochloric Acid',
        subtitle: 'Al + HCl',
        input: 'Al + HCl -> AlCl3 + H2',
        balanced: '2Al + 6HCl -> 2AlCl3 + 3H2',
        difficulty: 'intermediate',
        topic: 'desplazamiento',
        tier: 'free',
        difficultyScore: 6,
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  FREE — ADVANCED  (difficultyScore 7–9)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'etano',
        label: 'Ethane Combustion',
        subtitle: 'C₂H₆ + O₂',
        input: 'C2H6 + O2 -> CO2 + H2O',
        balanced: '2C2H6 + 7O2 -> 4CO2 + 6H2O',
        difficulty: 'advanced',
        topic: 'combustion',
        tier: 'free',
        difficultyScore: 8,
    },
    {
        id: 'glucosa',
        label: 'Glucose Combustion',
        subtitle: 'C₆H₁₂O₆ + O₂',
        input: 'C6H12O6 + O2 -> CO2 + H2O',
        balanced: 'C6H12O6 + 6O2 -> 6CO2 + 6H2O',
        difficulty: 'advanced',
        topic: 'combustion',
        tier: 'free',
        difficultyScore: 9,
    },
    {
        id: 'termita',
        label: 'Thermite Reaction',
        subtitle: 'Al + Fe₂O₃',
        input: 'Al + Fe2O3 -> Al2O3 + Fe',
        balanced: '2Al + Fe2O3 -> Al2O3 + 2Fe',
        difficulty: 'advanced',
        topic: 'desplazamiento',
        tier: 'free',
        difficultyScore: 7,
    },
    {
        id: 'neutralizacion',
        label: 'Neutralization NaOH + H₂SO₄',
        subtitle: 'NaOH + H₂SO₄',
        input: 'NaOH + H2SO4 -> Na2SO4 + H2O',
        balanced: '2NaOH + H2SO4 -> Na2SO4 + 2H2O',
        difficulty: 'advanced',
        topic: 'neutralizacion',
        tier: 'free',
        difficultyScore: 7,
    },
    {
        id: 'propano',
        label: 'Propane Combustion',
        subtitle: 'C₃H₈ + O₂',
        input: 'C3H8 + O2 -> CO2 + H2O',
        balanced: 'C3H8 + 5O2 -> 3CO2 + 4H2O',
        difficulty: 'advanced',
        topic: 'combustion',
        tier: 'free',
        difficultyScore: 8,
    },
    {
        id: 'ca-oh2-hcl',
        label: 'Ca(OH)₂ with Hydrochloric Acid',
        subtitle: 'Ca(OH)₂ + HCl',
        input: 'Ca(OH)2 + HCl -> CaCl2 + H2O',
        balanced: 'Ca(OH)2 + 2HCl -> CaCl2 + 2H2O',
        difficulty: 'advanced',
        topic: 'neutralizacion',
        tier: 'free',
        difficultyScore: 7,
        note: 'Introduces parenthetical groups Ca(OH)₂ — complexity penalty active.',
    },
    {
        id: 'fe-hcl',
        label: 'Iron with Hydrochloric Acid',
        subtitle: 'Fe + HCl',
        input: 'Fe + HCl -> FeCl3 + H2',
        balanced: '2Fe + 6HCl -> 2FeCl3 + 3H2',
        difficulty: 'advanced',
        topic: 'desplazamiento',
        tier: 'free',
        difficultyScore: 7,
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  FREE — EXPERT  (difficultyScore 10–15)
    // ══════════════════════════════════════════════════════════════════════════

    {
        id: 'butano',
        label: 'Butane Combustion',
        subtitle: 'C₄H₁₀ + O₂',
        input: 'C4H10 + O2 -> CO2 + H2O',
        balanced: '2C4H10 + 13O2 -> 8CO2 + 10H2O',
        difficulty: 'expert',
        topic: 'combustion',
        tier: 'free',
        difficultyScore: 10,
        note: 'Coefficient 13 in O₂ — case with intermediate fractions (×2 the whole equation).',
    },
    {
        id: 'h3po4-naoh',
        label: 'Neutralization H₃PO₄ + NaOH',
        subtitle: 'H₃PO₄ + NaOH',
        input: 'H3PO4 + NaOH -> Na3PO4 + H2O',
        balanced: 'H3PO4 + 3NaOH -> Na3PO4 + 3H2O',
        difficulty: 'expert',
        topic: 'neutralizacion',
        tier: 'free',
        difficultyScore: 10,
    },
    {
        id: 'na2o2',
        label: 'Sodium Peroxide with Water',
        subtitle: 'Na₂O₂ + H₂O',
        input: 'Na2O2 + H2O -> NaOH + O2',
        balanced: '2Na2O2 + 2H2O -> 4NaOH + O2',
        difficulty: 'expert',
        topic: 'descomposicion',
        tier: 'free',
        difficultyScore: 9,
        note: 'Partial disproportionation of O²⁻ — appears on both sides of the equation.',
    },
];

/**
 * Retorna ejemplos filtrados por tier y/o dificultad.
 * Si tier='pro', se devuelven todos.
 *
 * @param {{ tier?: string, difficulty?: string }} filter
 * @returns {object[]}
 */
export function getExamplesByFilter(filter = {}) {
    return BANK_EXAMPLES.filter(ex => {

        if (filter.difficulty && ex.difficulty !== filter.difficulty) return false;
        return true;
    });
}

/**
 * Retorna un ejemplo por ID.
 * @param {string} id
 * @returns {object | undefined}
 */
export function getExampleById(id) {
    return BANK_EXAMPLES.find(ex => ex.id === id);
}

/**
 * Retorna todos los ejemplos de un tópico dado.
 * Tópicos disponibles: 'sintesis', 'combustion', 'oxidacion', 'descomposicion',
 *                      'desplazamiento', 'neutralizacion'.
 *
 * @param {string} topic
 * @returns {object[]}
 */
export function getExamplesByTopic(topic) {
    return BANK_EXAMPLES.filter(ex => ex.topic === topic);
}

/**
 * Retorna la lista de tópicos únicos presentes en el banco.
 * Útil para construir filtros dinámicos en la UI.
 *
 * @returns {string[]}
 */
export function getAllTopics() {
    return [...new Set(BANK_EXAMPLES.map(ex => ex.topic))];
}