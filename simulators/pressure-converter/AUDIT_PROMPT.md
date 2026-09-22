# Audit request — Pressure Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toPascal` factor in `constants.js`:
  - pa=1, hpa=100, kpa=1000, mpa=1e6, bar=1e5
  - atm = 101325 (exact, standard atmosphere by definition)
  - psi = 6894.757293168361 (exact: lbf/in², using standard gravity 9.80665 m/s² and exact lb=0.45359237kg, in=0.0254m)
  - mmhg = 133.322387415 (exact conventional value: 13595.1 kg/m³ mercury density × 9.80665 m/s² × 0.001 m)
  - inhg = 3386.388640341 (= mmhg × 25.4)
  - kgfcm2 = 98066.5 (exact: 9.80665 / 1e-4 m²)
- Confirm `convertAll()` round-trips correctly: 2.2 bar → ~31.9083 psi, 1 atm → exactly 101.325 kPa, 120 mmHg → ~15.9987 kPa, 20 MPa → ~203.9432 kgf/cm², 1 atm → 760 mmHg exactly (watch for floating-point display showing 759.9999 instead of 760 — check whether `fmt()`'s decimal rounding for mmHg's `decimals: 6` setting displays this cleanly).
- Confirm all units are pure linear factor conversions (no offsets).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- **Negative values are blocked** — this tool converts absolute pressure, where 0 = perfect vacuum is the physical floor (similar in spirit to Data Storage and Speed Converter's floors). Verify: entering a negative number shows "Absolute pressure cannot be negative (0 represents a perfect vacuum)." and hides the results table. Verify 0 is still accepted.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.prc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here.

## 3. Content accuracy — gauge vs. absolute pressure
- The educational content explicitly states this tool converts ABSOLUTE pressure and explains the gauge-pressure distinction in the FAQ. Verify this claim is consistent throughout (How to Use section, FAQ) and that no example or default value implies gauge pressure is being converted.

## 4. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.prc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 5. Console
- Load the page and confirm zero console errors/warnings, including on unit change, zero, and repeated invalid/negative input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
