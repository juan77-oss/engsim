/**
 * simulators/dc-circuit-analyzer/js/constants.js
 * DC Circuit Analyzer (Constants Layer)
 */

'use strict';

// Guided Analysis: the method selector changes which equivalent diagram
// and explanation are shown, but the underlying numeric derivation always
// follows the actual topology (series/parallel) since that is the network
// that is physically built.
export const RESOLUTION_METHODS = [
    { value: 'none', label: 'Standard Circuit (no analysis)' },
    { value: 'nodos', label: 'Node Voltages' },
    { value: 'mallas', label: 'Mesh Currents' },
    { value: 'thevenin', label: "Thevenin's Theorem" },
    { value: 'norton', label: "Norton's Theorem" },
    { value: 'delta-wye', label: 'Delta - Wye' }
];

export const METHOD_EXPLANATIONS = {
    thevenin: "Thevenin's theorem replaces the network with an equivalent voltage source and a series resistance as seen from the load terminals.",
    norton: "Norton's theorem replaces the network with an equivalent current source in parallel with an equivalent resistance.",
    nodos: 'Node-voltage analysis determines the unknown node voltage and then derives the branch currents from it.',
    mallas: 'Mesh-current analysis assigns a current to each independent loop and applies Kirchhoff\'s Voltage Law to solve for those currents.',
    'delta-wye': 'This network is already in a Wye (star) configuration, so a Delta-to-Wye conversion is not required here.'
};
