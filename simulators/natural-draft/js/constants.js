/**
 * constants.js — Natural Draft Calculator
 * engsimapp.com
 *
 * Physical constants and default parameters shared by core.js and simulator.js.
 */

'use strict';

// Standard gravity [m/s²]
export const GRAVITY = 9.81;

// Base flue gas density at 0°C and atmospheric pressure [kg/m³]
// Used both as the default "base density" input and internally in core.js.
export const DEFAULT_BASE_DENSITY = 1.293;

// Thermal expansion coefficient for gases [1/K]
export const GAS_EXPANSION_COEFFICIENT = 0.00366;

// Standard atmospheric pressure [Pa]
export const ATMOSPHERIC_PRESSURE = 101325;

// Conversion factor: mmH2O to Pa
export const MMH2O_TO_PA = 9.80665;

// Absolute zero offset [°C -> K]
export const KELVIN_OFFSET = 273.15;

export const SECTION_TYPES = {
    CIRCULAR: 'circular',
    RECTANGULAR: 'rectangular'
};

export const FLOW_INPUT_MODES = {
    VELOCITY: 'velocity',
    DYNAMIC_PRESSURE: 'dynamic-pressure'
};

// Margin thresholds, relative to total requirement, used to classify
// the draft balance status (see evaluateDraftBalance in core.js).
export const MARGIN_THRESHOLDS = {
    SAFE: 0.25,
    CRITICAL: 0.10
};