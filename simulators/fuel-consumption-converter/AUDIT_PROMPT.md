# Audit request — Fuel Consumption Converter (EngSim)

Please audit this simulator against the following. This is the most physically/mathematically unusual converter in the series — pay special attention to Section 2.

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify the direct factors: mpgus = 0.425143707430272 km/L (= 1.609344 km ÷ 3.785411784 L), mpguk = 0.3540061899346471 km/L (= 1.609344 km ÷ 4.54609 L), kml = 1 (base/identity).
- Confirm `toKmPerLiter()` and `fromKmPerLiter()` correctly branch on `unit.kind`: `'distance-per-volume'` units (mpgus, mpguk, kml) use a simple multiply/divide by `toKmPerLiter`; `'volume-per-distance'` (l100km) uses `100 / value` in both directions instead.
- Confirm `convertAll()` round-trips correctly: 8 L/100km → ~29.4018 mpg (US) / ~35.3101 mpg (UK) / 12.5 km/L; 30 mpg (US) → ~7.8405 L/100km.
- **Critical round-trip check**: convert a value from L/100km to any other unit, then convert that result back to L/100km, and confirm you land back on the original number (within floating-point tolerance) — e.g. 8 L/100km → mpg (US) → back to L/100km should return exactly 8 (or extremely close). This is the test that would catch a broken reciprocal implementation.
- Confirm mpg (US) and mpg (UK) are genuinely different units in the code (not accidentally using the same gallon factor) — 40 mpg (US) should NOT equal 40 mpg (UK) when both are converted to km/L (correct values: ~17.006 km/L vs. ~14.160 km/L).

## 2. Physical/mathematical constraint — the reciprocal relationship's edge case
- Unlike every other converter in this series, a value of exactly 0 is mathematically undefined here (division by zero in the `100 / value` reciprocal), not just physically implausible. Verify `calculate()` in `simulator.js` blocks BOTH zero and negative values with `value <= 0` (not just `value < 0` like Speed/Pressure/Data Storage Converter) — check this exact operator, since a `< 0` here would let 0 through and crash or show `Infinity`/`NaN` in the L/100km column.
- Confirm the error message ("Fuel consumption must be a positive number.") displays correctly and the results table hides, exactly like the other validation errors.
- Confirm changing the unit selector after this error correctly re-validates (not stuck showing the old error).

## 3. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.fcc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here. Note: values in this domain are all human-scale (no eV/light-year-style extremes expected), so scientific notation should rarely if ever trigger — flag it if it does for a normal input like 8 L/100km.

## 4. Content accuracy
- Verify the educational content's explanation of the reciprocal relationship is accurate and doesn't contradict the worked examples (Example 1 and 2 should be consistent with each other as an approximate round-trip).
- Verify the US vs. UK gallon distinction is clearly flagged, since this is the single biggest source of real-world confusion in this unit category.

## 5. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.fcc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 6. Console
- Load the page and confirm zero console errors/warnings, including on unit change, the value 0 specifically, and repeated invalid/non-positive input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
