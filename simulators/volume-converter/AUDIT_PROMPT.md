# Audit request — Volume Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toLiter` factor in `constants.js`:
  - ml=0.001, l=1, m3=1000, cm3=0.001
  - in3 = 0.016387064 (exact, from inch=0.0254m exact)
  - ft3 = 28.316846592 (exact, from foot=0.3048m exact)
  - usgal = 3.785411784 (exact, US liquid gallon)
  - ukgal = 4.54609 (exact, UK imperial gallon)
  - usqt = 0.946352946, uspt = 0.473176473, uscup = 0.2365882365, usfloz = 0.0295735295625, ustbsp = 0.0147867647813, ustsp = 0.00492892159375 (all US customary, derived from the US gallon)
- Confirm `convertAll()` round-trips correctly: 20 L → ~5.2834 US gal, 2 cups → 473.176473 mL exactly, 1 m³ → ~264.172 US gal, 1 UK gal → ~1.2009 US gal, 1 L → ~4.2268 cups.
- Confirm mL and cm³ are both present and numerically identical (1 mL = 1 cm³) — verify this isn't accidentally treated as a bug/duplicate to remove; it's intentional (see note in educational content).
- Confirm all units are pure linear factor conversions (no offsets).
- Double-check the US/UK gallon distinction isn't mixed up anywhere — they differ by about 20% and are easy to swap by mistake.

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (consistent with Energy/Length/Mass Converter's precedent) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.vol-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (already applied from the Mass Converter audit) — confirm both work correctly here too.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.vol-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
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
