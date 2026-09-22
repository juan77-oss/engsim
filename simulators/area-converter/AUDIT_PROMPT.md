# Audit request — Area Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toSqMeter` factor in `constants.js`:
  - mm2=1e-6, cm2=1e-4, m2=1, km2=1e6
  - in2 = 0.00064516 (= 0.0254²)
  - ft2 = 0.09290304 (= 0.3048²)
  - yd2 = 0.83612736 (= 0.9144²)
  - mi2 = 2,589,988.110336 (= 1609.344²)
  - acre = 4,046.8564224 (= 43,560 ft² exactly, using the international foot)
  - hectare = 10,000 (exact, 100m × 100m)
- Confirm every imperial area factor is the exact square of the corresponding Length Converter factor (in, ft, yd, mi) — this is the main thing to double-check here, since a typo in squaring is an easy silent error.
- Confirm `convertAll()` round-trips correctly: 150 m² → ~1614.5866 ft², 40 acres → ~16.1874 ha, 500 km² → ~193.0511 mi², 20 in² → exactly 129.032 cm².
- Confirm all units are pure linear factor conversions (no offsets).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (consistent with Energy/Length/Mass/Volume Converter's precedent for deltas) — confirm this is intended, not a bug. (Note: this differs from Data Storage Converter, which blocks negatives — that's intentional, not an inconsistency to "fix".)
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.are-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.are-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 4. Console
- Load the page and confirm zero console errors/warnings, including on unit change and repeated invalid input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
