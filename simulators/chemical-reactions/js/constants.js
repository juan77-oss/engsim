/**
 * constants.js — Chemical Reactions Simulator
 * engsim.app
 * ─────────────────────────────────────────────────────────────────
 * PURPOSE: Pure data. Zero logic. Zero DOM.
 *          Static reference tables consumed by core.js.
 *
 * EXPORTS:
 *   ATOMIC_MASS      — IUPAC 2021 standard atomic weights (g/mol)
 *   REDOX_REACTIONS  — Pre-defined redox reactions with full
 *                       step-by-step ion-electron breakdowns
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
//  TOKEN-BOUNDARY MATCH HELPER
//  Used by each reaction's match() below instead of raw .includes(),
//  so a token like "cl2" doesn't false-positive inside "bacl2".
//  The input is pre-normalized (whitespace stripped) before this
//  runs, so '+', '-', '(', ')' remain as natural token separators.
//  Boundary is "not a LETTER" rather than "not alphanumeric": chemical
//  tokens are routinely followed by digits or charge signs (fe2+,
//  mno4-), so only an adjacent letter should disqualify a match.
// ─────────────────────────────────────────────────────────────────

function _escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _hasToken(haystack, token) {
    const pattern = new RegExp('(?:^|[^a-z])' + _escapeRegExp(token) + '(?:[^a-z]|$)');
    return pattern.test(haystack);
}

// ─────────────────────────────────────────────────────────────────
//  ATOMIC MASS TABLE (IUPAC 2021) — g/mol
// ─────────────────────────────────────────────────────────────────

export const ATOMIC_MASS = {
    H: 1.008,   He: 4.003,  Li: 6.941,  Be: 9.012,  B: 10.811,
    C: 12.011,  N: 14.007,  O: 15.999,  F: 18.998,  Ne: 20.180,
    Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.086, P: 30.974,
    S: 32.06,   Cl: 35.45,  Ar: 39.948, K: 39.098,  Ca: 40.078,
    Sc: 44.956, Ti: 47.867, V: 50.942,  Cr: 51.996, Mn: 54.938,
    Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
    Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904,
    Kr: 83.798, Rb: 85.468, Sr: 87.62,  Y: 88.906,  Zr: 91.224,
    Nb: 92.906, Mo: 95.96,  Tc: 98.000, Ru: 101.07, Rh: 102.906,
    Pd: 106.42, Ag: 107.868,Cd: 112.411,In: 114.818,Sn: 118.710,
    Sb: 121.760,Te: 127.60, I: 126.904, Xe: 131.293,Cs: 132.905,
    Ba: 137.327,La: 138.905,Ce: 140.116,Pr: 140.908,Nd: 144.242,
    Pm: 145.000,Sm: 150.36, Eu: 151.964,Gd: 157.25, Tb: 158.925,
    Dy: 162.500,Ho: 164.930,Er: 167.259,Tm: 168.934,Yb: 173.045,
    Lu: 174.967,Hf: 178.49, Ta: 180.948,W: 183.84,  Re: 186.207,
    Os: 190.23, Ir: 192.217,Pt: 195.084,Au: 196.967,Hg: 200.592,
    Tl: 204.38, Pb: 207.2,  Bi: 208.980,Po: 209.000,At: 210.000,
    Rn: 222.000,Fr: 223.000,Ra: 226.000,Ac: 227.000,Th: 232.038,
    Pa: 231.036,U: 238.029, Np: 237.000,Pu: 244.000,Am: 243.000,
    Cm: 247.000,Bk: 247.000,Cf: 251.000,Es: 252.000,Fm: 257.000,
    Md: 258.000,No: 259.000,Lr: 262.000,Rf: 267.000,Db: 268.000,
    Sg: 271.000,Bh: 272.000,Hs: 270.000,Mt: 276.000,Ds: 281.000,
    Rg: 280.000,Cn: 285.000,Nh: 284.000,Fl: 289.000,Mc: 288.000,
    Lv: 293.000,Ts: 294.000,Og: 294.000,
};

// ─────────────────────────────────────────────────────────────────
//  PRE-DEFINED REDOX REACTIONS — Ion-Electron (Half-Reaction) Method
// ─────────────────────────────────────────────────────────────────
//  Each entry is a fully worked reaction: oxidation numbers,
//  identification, and a step-by-step breakdown ready for display.
// ─────────────────────────────────────────────────────────────────

export const REDOX_REACTIONS = {
  'permanganate_fe': {
    id: 'permanganate_fe',
    name: 'Permanganate + Fe²⁺ (acidic medium)',
    inputExample: 'MnO4- + Fe2+ -> Mn2+ + Fe3+',
    medium: 'acidic',

    match(input) {
      return (
        (_hasToken(input, 'mno4') && _hasToken(input, 'fe2+')) ||
        (_hasToken(input, 'permanganato') && _hasToken(input, 'fe')) ||
        (_hasToken(input, 'permanganate') && _hasToken(input, 'fe'))
      );
    },

    oxidationNumbers: [
      { species: 'MnO₄⁻', element: 'Mn', oxidationState: '+7',  note: 'x + 4(−2) = −1 → x = +7' },
      { species: 'MnO₄⁻', element: 'O',  oxidationState: '−2',  note: 'Standard state of O' },
      { species: 'Fe²⁺',  element: 'Fe', oxidationState: '+2',  note: 'Given by ionic charge' },
      { species: 'Mn²⁺',  element: 'Mn', oxidationState: '+2',  note: 'Given by ionic charge' },
      { species: 'Fe³⁺',  element: 'Fe', oxidationState: '+3',  note: 'Given by ionic charge' },
    ],

    redoxIdentification: {
      oxidized:  { species: 'Fe²⁺', from: '+2', to: '+3', change: 'loses 1 e⁻ (OXIDATION)' },
      reduced:   { species: 'MnO₄⁻', from: '+7', to: '+2', change: 'gains 5 e⁻ (REDUCTION)' },
      agent: {
        oxidizing: 'MnO₄⁻ (oxidizing agent)',
        reducing:  'Fe²⁺ (reducing agent)',
      },
    },

    steps: [
      {
        title: 'Step 1 — Assign oxidation numbers',
        type:  'info',
        content: [
          'Mn in MnO₄⁻:  x + 4(−2) = −1  →  x = +7',
          'O  in MnO₄⁻:  −2  (standard value for oxygen)',
          'Fe in Fe²⁺:   +2  (ionic charge)',
          'Mn in Mn²⁺:   +2  (ionic charge)',
          'Fe in Fe³⁺:   +3  (ionic charge)',
        ],
      },
      {
        title: 'Step 2 — Identify oxidation and reduction',
        type:  'info',
        content: [
          '▲ Fe²⁺ → Fe³⁺  |  +2 → +3  |  loses 1 e⁻  → OXIDATION',
          '▼ Mn in MnO₄⁻ → Mn²⁺  |  +7 → +2  |  gains 5 e⁻  → REDUCTION',
        ],
      },
      {
        title: 'Step 3 — Oxidation half-reaction',
        type:  'oxidation',
        content: [
          'Fe²⁺ → Fe³⁺ + e⁻',
          '',
          'Atom check: 1 Fe = 1 Fe ✓',
          'Charge check: +2 = +3 + (−1) = +2 ✓',
        ],
      },
      {
        title: 'Step 4 — Reduction half-reaction (acidic medium)',
        type:  'reduction',
        content: [
          'MnO₄⁻ → Mn²⁺',
          '',
          '① Balance Mn:  MnO₄⁻ → Mn²⁺  (already balanced: 1 Mn = 1 Mn)',
          '② Balance O with H₂O:  MnO₄⁻ → Mn²⁺ + 4H₂O',
          '③ Balance H with H⁺:   MnO₄⁻ + 8H⁺ → Mn²⁺ + 4H₂O',
          '④ Balance charge with e⁻:',
          '   Left side charge: −1 + 8(+1) = +7',
          '   Right side charge: +2',
          '   Add 5 e⁻ to the left side:',
          '   MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O  ✓',
        ],
      },
      {
        title: 'Step 5 — Equalize electrons (LCM)',
        type:  'info',
        content: [
          'Oxidation ×5:   5Fe²⁺ → 5Fe³⁺ + 5e⁻',
          'Reduction ×1:   MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O',
          '',
          'LCM(1, 5) = 5  → 5 electrons are transferred in total.',
        ],
      },
      {
        title: 'Step 6 — Final balanced equation',
        type:  'combined',
        content: [
          'Adding both half-reactions:',
          '',
          'MnO₄⁻ + 8H⁺ + 5Fe²⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O',
          '',
          'Verification:',
          '  Mn: 1 = 1 ✓   |   Fe: 5 = 5 ✓   |   O: 4 = 4 ✓   |   H: 8 = 8 ✓',
          '  Left charge: −1 + 8 + 10 = +17  |  Right charge: 2 + 15 = +17 ✓',
        ],
      },
    ],

    finalEquation: 'MnO₄⁻ + 8H⁺ + 5Fe²⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O',
  },

  'dichromate_iodide': {
    id: 'dichromate_iodide',
    name: 'Dichromate + I⁻ (acidic medium)',
    inputExample: 'Cr2O7(2-) + I- -> Cr3+ + I2',
    medium: 'acidic',

    match(input) {
      return (
        (_hasToken(input, 'cr2o7') || _hasToken(input, 'dicromato') || _hasToken(input, 'dichromate')) &&
        _hasToken(input, 'i-')
      );
    },

    oxidationNumbers: [
      { species: 'Cr₂O₇²⁻', element: 'Cr', oxidationState: '+6', note: '2x + 7(−2) = −2 → x = +6' },
      { species: 'Cr₂O₇²⁻', element: 'O',  oxidationState: '−2', note: 'Standard state of O' },
      { species: 'I⁻',       element: 'I',  oxidationState: '−1', note: 'Given by ionic charge' },
      { species: 'Cr³⁺',     element: 'Cr', oxidationState: '+3', note: 'Given by ionic charge' },
      { species: 'I₂',       element: 'I',  oxidationState: '0',  note: 'Free element' },
    ],

    redoxIdentification: {
      oxidized:  { species: 'I⁻',       from: '−1', to: '0',  change: 'loses 1 e⁻ (OXIDATION)' },
      reduced:   { species: 'Cr₂O₇²⁻', from: '+6', to: '+3', change: 'each Cr gains 3 e⁻ (REDUCTION)' },
      agent: {
        oxidizing: 'Cr₂O₇²⁻ (oxidizing agent)',
        reducing:  'I⁻ (reducing agent)',
      },
    },

    steps: [
      {
        title: 'Step 1 — Assign oxidation numbers',
        type:  'info',
        content: [
          'Cr in Cr₂O₇²⁻:  2x + 7(−2) = −2  →  x = +6',
          'O  in Cr₂O₇²⁻:  −2  (standard value)',
          'I  in I⁻:        −1  (ionic charge)',
          'Cr in Cr³⁺:      +3  (ionic charge)',
          'I  in I₂:         0  (free element)',
        ],
      },
      {
        title: 'Step 2 — Identify oxidation and reduction',
        type:  'info',
        content: [
          '▲ I⁻ → I₂  |  −1 → 0  |  each I loses 1 e⁻  → OXIDATION',
          '▼ Cr in Cr₂O₇²⁻ → Cr³⁺  |  +6 → +3  |  each Cr gains 3 e⁻  → REDUCTION',
        ],
      },
      {
        title: 'Step 3 — Oxidation half-reaction',
        type:  'oxidation',
        content: [
          '2I⁻ → I₂ + 2e⁻',
          '',
          '① Balance I:   2I⁻ → I₂  (2 iodine = 2 iodine ✓)',
          '② Balance charge:',
          '   Left side charge: 2(−1) = −2',
          '   Right side charge: 0 + (−2) = −2  ✓  (loses 2 e⁻)',
        ],
      },
      {
        title: 'Step 4 — Reduction half-reaction (acidic medium)',
        type:  'reduction',
        content: [
          'Cr₂O₇²⁻ → 2Cr³⁺',
          '',
          '① Balance Cr:  Cr₂O₇²⁻ → 2Cr³⁺',
          '② Balance O with H₂O:  Cr₂O₇²⁻ → 2Cr³⁺ + 7H₂O',
          '③ Balance H with H⁺:   Cr₂O₇²⁻ + 14H⁺ → 2Cr³⁺ + 7H₂O',
          '④ Balance charge with e⁻:',
          '   Left side charge: −2 + 14 = +12',
          '   Right side charge: 2(+3) = +6',
          '   Add 6 e⁻ to the left side:',
          '   Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O  ✓',
        ],
      },
      {
        title: 'Step 5 — Equalize electrons (LCM)',
        type:  'info',
        content: [
          'Oxidation ×3:   6I⁻ → 3I₂ + 6e⁻',
          'Reduction ×1:   Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O',
          '',
          'LCM(2, 6) = 6  → 6 electrons are transferred in total.',
        ],
      },
      {
        title: 'Step 6 — Final balanced equation',
        type:  'combined',
        content: [
          'Adding both half-reactions:',
          '',
          'Cr₂O₇²⁻ + 14H⁺ + 6I⁻ → 2Cr³⁺ + 3I₂ + 7H₂O',
          '',
          'Verification:',
          '  Cr: 2 = 2 ✓   |   O: 7 = 7 ✓   |   H: 14 = 14 ✓   |   I: 6 = 6 ✓',
          '  Left charge: −2 + 14 − 6 = +6  |  Right charge: 6 + 0 + 0 = +6 ✓',
        ],
      },
    ],

    finalEquation: 'Cr₂O₇²⁻ + 14H⁺ + 6I⁻ → 2Cr³⁺ + 3I₂ + 7H₂O',
  },

  'cl2_naoh': {
    id: 'cl2_naoh',
    name: 'Cl₂ + NaOH (disproportionation, basic medium)',
    inputExample: 'Cl2 + NaOH -> NaCl + NaClO + H2O',
    medium: 'basic',

    match(input) {
      return (
        _hasToken(input, 'cl2') &&
        (_hasToken(input, 'naoh') || _hasToken(input, 'oh'))
      );
    },

    oxidationNumbers: [
      { species: 'Cl₂',   element: 'Cl', oxidationState: '0',  note: 'Free element' },
      { species: 'NaCl',  element: 'Cl', oxidationState: '−1', note: 'Charge of Cl⁻ ion' },
      { species: 'NaClO', element: 'Cl', oxidationState: '+1', note: 'Na(+1) + Cl(x) + O(−2) = 0 → x = +1' },
      { species: 'NaOH',  element: 'Na', oxidationState: '+1', note: 'Alkali metal, always +1' },
      { species: 'NaOH',  element: 'O',  oxidationState: '−2', note: 'Standard state of O' },
    ],

    redoxIdentification: {
      oxidized: { species: 'Cl₂', from: '0', to: '+1', change: 'loses 1 e⁻ (OXIDATION) → forms ClO⁻' },
      reduced:  { species: 'Cl₂', from: '0', to: '−1', change: 'gains 1 e⁻ (REDUCTION) → forms Cl⁻' },
      agent: {
        oxidizing: 'Cl₂ (acts as oxidizing agent)',
        reducing:  'Cl₂ (acts as reducing agent — disproportionation)',
      },
    },

    steps: [
      {
        title: 'Step 1 — Assign oxidation numbers',
        type:  'info',
        content: [
          'Cl in Cl₂:    0  (free element, by definition)',
          'Cl in NaCl:  −1  (charge of the Cl⁻ anion)',
          'Cl in NaClO: +1  (Na=+1, O=−2 → Na+Cl+O=0 → Cl=+1)',
          '',
          '→ This is a DISPROPORTIONATION: Cl₂ is simultaneously oxidized and reduced.',
        ],
      },
      {
        title: 'Step 2 — Identify oxidation and reduction',
        type:  'info',
        content: [
          '▲ Cl₂ → 2ClO⁻  |  0 → +1  |  loses 1 e⁻ per Cl  → OXIDATION',
          '▼ Cl₂ → 2Cl⁻   |  0 → −1  |  gains 1 e⁻ per Cl   → REDUCTION',
          '',
          'Note: in basic medium, OH⁻ is used instead of H⁺.',
        ],
      },
      {
        title: 'Step 3 — Oxidation half-reaction (basic medium)',
        type:  'oxidation',
        content: [
          'Cl₂ → 2ClO⁻',
          '',
          '① Balance Cl:  Cl₂ → 2ClO⁻  (2 Cl = 2 Cl ✓)',
          '② Balance O with H₂O:  Cl₂ + 2H₂O → 2ClO⁻  (add 2H₂O for 2 O)',
          '③ Balance H with OH⁻:  Cl₂ + 2H₂O → 2ClO⁻ + 4H⁺',
          '   Basic medium: neutralize 4H⁺ with 4OH⁻:',
          '   Cl₂ + 2H₂O + 4OH⁻ → 2ClO⁻ + 4H₂O',
          '   Simplify:  Cl₂ + 4OH⁻ → 2ClO⁻ + 2H₂O',
          '④ Balance charge with e⁻:',
          '   Left side charge: 0 + 4(−1) = −4',
          '   Right side charge: 2(−1) + 0 = −2',
          '   Add 2e⁻ to the right side:',
          '   Cl₂ + 4OH⁻ → 2ClO⁻ + 2H₂O + 2e⁻  ✓',
        ],
      },
      {
        title: 'Step 4 — Reduction half-reaction (basic medium)',
        type:  'reduction',
        content: [
          'Cl₂ + 2e⁻ → 2Cl⁻',
          '',
          '① Balance Cl: Cl₂ → 2Cl⁻  (2 Cl = 2 Cl ✓)',
          '② There are no O or H to balance.',
          '③ Balance charge with e⁻:',
          '   Left side charge: 0',
          '   Right side charge: 2(−1) = −2',
          '   Add 2e⁻ to the left side:',
          '   Cl₂ + 2e⁻ → 2Cl⁻  ✓',
        ],
      },
      {
        title: 'Step 5 — Equalize electrons (LCM)',
        type:  'info',
        content: [
          'Oxidation:  Cl₂ + 4OH⁻ → 2ClO⁻ + 2H₂O + 2e⁻  (produces 2e⁻)',
          'Reduction:  Cl₂ + 2e⁻ → 2Cl⁻                  (consumes 2e⁻)',
          '',
          'LCM(2, 2) = 2  → already equalized, factor ×1 for each half-reaction.',
        ],
      },
      {
        title: 'Step 6 — Final balanced equation',
        type:  'combined',
        content: [
          'Adding both half-reactions:',
          '',
          '2Cl₂ + 4OH⁻ → 2Cl⁻ + 2ClO⁻ + 2H₂O',
          '',
          '÷ 2 (simplify):',
          '',
          'Cl₂ + 2OH⁻ → Cl⁻ + ClO⁻ + H₂O',
          '',
          'Molecular form (with NaOH):',
          '',
          'Cl₂ + 2NaOH → NaCl + NaClO + H₂O',
          '',
          'Verification:',
          '  Cl: 2 = 1+1 = 2 ✓  |  Na: 2 = 2 ✓  |  O: 2 = 1+1 = 2 ✓  |  H: 2 = 2 ✓',
        ],
      },
    ],

    finalEquation: 'Cl₂ + 2NaOH → NaCl + NaClO + H₂O',
  },
};
