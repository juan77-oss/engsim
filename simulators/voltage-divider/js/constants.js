/**
 * constants.js — Voltage Divider — Shared constants
 * engsimapp.com
 *
 * PURE MODULE — default values, validation limits, and tuning constants.
 * No DOM access. No physics logic. Just numbers other modules import.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Default input values (populated into the form on page load) ──
export const DEFAULTS = {
  V: 12,
  R1: 1000,
  R2: 1000,
  VOUT_TARGET: 5
};

// ── Input validation limits ───────────────────────────────────────
export const LIMITS = {
  V_MIN: 0,
  V_MAX: 1000,   // V — generous upper bound, covers most bench supplies
  R_MIN: 0,      // Ω — zero allowed (short), negative is rejected in core.js
  R_MAX: 1e9     // Ω — 1 GΩ, effectively "very large" for UI sanity checks
};

// ── Resistor power rating used to flag overload in the results ───
export const P_MAX_DEFAULT = 0.25; // W — standard 1/4 W through-hole resistor

// ── Chart sweep resolution (Vout vs R2 curve, two-resistor mode) ─
export const SWEEP_POINTS = 60;

// ── Series chain (N-resistor) mode ────────────────────────────────
export const CHAIN = {
  MIN_RESISTORS: 2,
  MAX_RESISTORS: 8,
  DEFAULT_RESISTORS: [1000, 1000]
};

// ── Chart colors (fallbacks — simulator.js prefers reading the
//    live CSS custom properties so charts follow light/dark mode) ─
export const CHART_COLORS = {
  curve: '#0284c7',
  highlight: '#f97316',
  bar: '#0284c7',
  barOverload: '#dc2626',
  grid: 'rgba(148, 163, 184, 0.18)'
};
