/**
 * welded-joints-constants.js - Welded Joints Analyzer
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - UI-only constants: unit labels, conversion factors between the two
 *     unit systems, default values, slider ranges, built-in examples
 *
 * WHAT DOES NOT GO HERE:
 *   - Physics, material tables, code allowables (-> welded-joints-core.js)
 *   - SVG drawing (-> welded-joints-plot.js)
 *
 * Non-ASCII characters are written as \u escapes on purpose (encoding safety).
 */

'use strict';

/** Unit systems. The core works in mm/N/MPa (SI) or in/kip/ksi (US). */
export const UNIT_LABELS = Object.freeze({
    SI: {
        length: 'mm', force: 'kN', stress: 'MPa',
        area: 'mm\u00B2', inertia: 'mm\u2074', moment: 'N\u00B7m',
        forceToCore: 1000,        // kN -> N
        momentFromCore: 1 / 1000  // N*mm -> N*m
    },
    US: {
        length: 'in', force: 'kip', stress: 'ksi',
        area: 'in\u00B2', inertia: 'in\u2074', moment: 'kip\u00B7in',
        forceToCore: 1,
        momentFromCore: 1
    }
});

/** Factors used when the user switches system: the PROBLEM stays the same. */
export const MM_PER_IN = 25.4;
export const KN_PER_KIP = 4.4482216153;
export const MPA_PER_KSI = 6.894757293;

export const DEFAULT_SYSTEM = 'SI';

/** Pattern picker order and short labels. Parameters come from core PRESETS. */
export const PATTERN_ORDER = Object.freeze([
    'line', 'two-vertical', 'two-horizontal', 'L', 'C', 'U', 'rectangle', 'circle'
]);
export const PATTERN_LABELS = Object.freeze({
    'line': 'Single line',
    'two-vertical': 'Two vertical',
    'two-horizontal': 'Two horizontal',
    'L': 'L-shape',
    'C': 'C-shape',
    'U': 'U-shape',
    'rectangle': 'Rectangle',
    'circle': 'Circle'
});

/** Human names for weld "runs" (used by the AWS symbol cards). */
export const RUN_LABELS = Object.freeze({
    vertical: 'Vertical weld',
    horizontal: 'Horizontal weld',
    circle: 'Circular weld',
    all: 'Weld all around'
});

/** Fatigue stress-concentration factors for welds (labels only; values live in core). */
export const KFS_LABELS = Object.freeze({
    'butt-reinforced': 'Reinforced butt weld (1.2)',
    'fillet-transverse-toe': 'Transverse fillet, at toe (1.5)',
    'fillet-parallel-end': 'Parallel fillet, at end (2.7)',
    't-butt-sharp-corner': 'T-butt, sharp corners (2.0)'
});

/** Slider ranges. */
export const ANGLE_MIN_DEG = 0;
export const ANGLE_MAX_DEG = 360;
export const ANGLE_STEP_DEG = 5;
export const RATIO_MIN = -1;
export const RATIO_MAX = 1;
export const RATIO_STEP = 0.05;

/**
 * Built-in examples. Loads are stored in the UI units of
 * the example's own system (kN or kip). Offsets ex/ey are measured from the
 * centroid G of the weld group.
 */
export const EXAMPLES = Object.freeze({
    'eccentric-c': {
        label: 'Eccentric load on a C-shaped weld (SI)',
        note: 'One side plate carries 25 kN at 110.4 mm from G. Reference result: \u03C4max \u2248 43.9 MPa at the ends of the vertical weld.',
        sys: 'SI', mode: 'inplane', pattern: 'C',
        b: 56, d: 190, h: 6,
        electrode: 'E70', base: 'A36', nd: 2,
        force: 25, angle: 270, ex: -110.4, ey: 0,
        fatigue: false
    },
    'cantilever-static': {
        label: 'Welded cantilever, static load (US)',
        note: '500 lbf at 6 in, 3/8 in fillets, E6010 on 1018 HR, design factor 3. The weld passes (n = 3.39) but the cantilever bar fails (n = 2.67).',
        sys: 'US', mode: 'bending', pattern: 'two-vertical',
        b: 0.375, d: 2, h: 0.375,
        electrode: 'E60', base: '1018HR', nd: 3,
        shear: 0.5, arm: 6,
        fatigue: false
    },
    'fatigue-reversed': {
        label: 'Fully reversed load, fatigue (US)',
        note: '1 000 lbf fully reversed (R = \u22121), Kfs = 2.7. Reference result: nf = 4.72.',
        sys: 'US', mode: 'bending', pattern: 'two-vertical',
        b: 0.375, d: 2, h: 0.375,
        electrode: 'E60', base: '1018HR', nd: 1.5,
        shear: 1, arm: 0,
        fatigue: true, ratio: -1, kfs: 'fillet-parallel-end', method: 'gerber'
    },
    'fatigue-repeated': {
        label: 'Repeated load, fatigue with Gerber (US)',
        note: '2 000 lbf repeatedly applied (R = 0) with a custom Kfs = 2. Reference result: nf \u2248 5.86.',
        sys: 'US', mode: 'bending', pattern: 'two-vertical',
        b: 0.375, d: 2, h: 0.375,
        electrode: 'E60', base: '1018HR', nd: 1.5,
        shear: 2, arm: 0,
        fatigue: true, ratio: 0, kfs: 'custom', kfsCustom: 2, method: 'gerber'
    }
});

export const DEFAULT_EXAMPLE = 'eccentric-c';
