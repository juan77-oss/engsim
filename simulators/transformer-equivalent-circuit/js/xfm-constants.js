/**
 * xfm-constants.js
 * UI-only constants. No physics here (that lives in xfm-core.js).
 */

export const SYSTEM_TYPES = [
  { value: 'single', label: 'Single-phase' },
  { value: 'three', label: 'Three-phase (per-phase equivalent)' }
];

export const VOLTAGE_MODES = [
  { value: 'phase', label: 'Phase voltage' },
  { value: 'line', label: 'Line voltage' }
];

export const SIDES = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' }
];

export const MODEL_TYPES = [
  { value: 'approx', label: 'Approximate (L, Kapp)' },
  { value: 'exact', label: 'Exact (T)' }
];

export const PF_TYPES = [
  { value: 'lag', label: 'Lagging (inductive)' },
  { value: 'lead', label: 'Leading (capacitive)' }
];

export const LIMITS = {
  Sn_kVA: { min: 0.05, max: 500000, step: 0.01 },
  voltage: { min: 0.1, max: 800000, step: 0.1 },
  frequency: [50, 60],
  testV: { min: 0.01, max: 800000, step: 0.01 },
  testI: { min: 0.001, max: 100000, step: 0.001 },
  testP: { min: 0.001, max: 5000000, step: 0.001 },
  loadPct: { min: 0, max: 150, step: 1 },
  cosPhi: { min: 0.01, max: 1, step: 0.01 }
};

// Classic worked example (50 kVA, 2400/240 V single-phase) used to pre-fill
// the form so the user always has a valid, physically consistent starting point.
export const EXAMPLE_VALUES = {
  systemType: 'single',
  SnKVA: 50,
  U1n: 2400,
  U2n: 240,
  U1nMode: 'phase',
  U2nMode: 'phase',
  frequency: 60,
  scSide: 'primary',
  scV: 48,
  scI: 20.8,
  scP: 617,
  ocSide: 'secondary',
  ocV: 240,
  ocI: 5.41,
  ocP: 186,
  modelType: 'approx',
  refSide: 'primary',
  loadPct: 100,
  loadCosPhi: 0.8,
  loadPfType: 'lag'
};
