# Audit request — Length Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toMeter` factor in `constants.js`:
  - nm=1e-9, um=1e-6, mm=0.001, cm=0.01, m=1, km=1000
  - mil (thou) = 2.54e-5 (0.001 inch)
  - in = 0.0254 (exact, international yard-and-pound agreement 1959)
  - ft = 0.3048 (exact)
  - yd = 0.9144 (exact)
  - mi (statute mile) = 1609.344 (exact)
  - nmi (nautical mile) = 1852 (exact, international definition)
  - ly (light-year) = 9.4607304725808e15 (IAU Julian-year definition)
- Confirm `convertAll()` round-trips correctly: 5 mi → 8.04672 km, 15 in → 38.1 cm, 0.05 mm → ~1.9685 mil, 1 m → ~3.28084 ft.
- Confirm all units are pure linear factor conversions (no offsets — length has none, unlike temperature).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (e.g. for displacement/relative position in engineering contexts) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.lnc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold: confirm values that round to "0" at a unit's configured decimals (e.g. converting into nm or light-years with too few decimals) correctly switch to exponential notation instead of displaying "0". Also check the reverse: converting a huge light-year-scale distance into millimeters doesn't produce a broken/overflowing number in the table.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.lnc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 4. Console
- Load the page and confirm zero console errors/warnings, including on unit change, extreme values (nm ↔ light-year), and repeated invalid input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
