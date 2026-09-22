# Audit request — Temperature Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Unlike Energy/Length/Mass Converter, this simulator has NO factor system — verify the offset-based formulas directly in `core.js`:
  - `toCelsius`: F→C = (F−32)×5/9; K→C = K−273.15; R→C = (R−491.67)×5/9; Ré→C = Ré×5/4
  - `fromCelsius`: C→F = C×9/5+32; C→K = C+273.15; C→R = (C+273.15)×9/5; C→Ré = C×4/5
- Confirm round-trips: 25°C → 77°F, 98.6°F → 37°C, 20°C → 293.15K, 77K → 138.6°R, 0°C → 0°Ré, 100°C → 80°Ré.
- Confirm converting a unit to itself is a no-op (e.g. 25°C → 25°C exactly, no floating-point drift beyond display rounding).
- Confirm `convertAll()` uses Celsius consistently as the bridge for every pair (no direct shortcuts that could introduce a different rounding error).

## 2. Absolute zero validation — the core UX difference from other converters
- `isBelowAbsoluteZero()` converts the input to Celsius and compares against -273.15 with a 1e-6 epsilon tolerance for floating-point safety.
- Verify the boundary is inclusive/correct: -273.15°C, 0K, -459.67°F, 0°R, -218.52°Ré should all be ACCEPTED (they equal absolute zero exactly, not below it).
- Verify values just below the boundary are REJECTED: -273.16°C, -0.001K, -459.68°F should all show the error.
- Verify the error message correctly reports the boundary value AND unit for whichever unit the user is currently in (e.g. entering -1 in Kelvin should say "cannot be below absolute zero (0K)", not the Celsius value).
- Confirm entering an invalid value (empty, non-numeric) is checked BEFORE the absolute-zero check, so the error messages don't conflict or show in the wrong order.
- Confirm changing the unit selector after an absolute-zero error correctly re-validates against the new unit's boundary (not stuck showing the old error).

## 3. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.tpc-row--active`) and always matches `input-unit`'s value.
- Since temperature values stay in a human-readable range, `fmt()` intentionally has NO scientific-notation branch (unlike Energy/Length/Mass Converter) — confirm this is fine for all 5 units and no result ever needs exponential notation in practice.

## 4. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.tpc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 5. Console
- Load the page and confirm zero console errors/warnings, including on unit change, boundary values, and repeated invalid/below-absolute-zero input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
