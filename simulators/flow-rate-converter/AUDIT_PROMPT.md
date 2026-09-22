# Audit request — Flow Rate Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toM3s` factor in `constants.js`:
  - m3s=1, m3h=1/3600
  - ls=0.001, lmin=0.001/60, lh=0.001/3600
  - usgpm = 3.785411784e-3 / 60 (US gallon per minute, using the exact US gallon = 3.785411784 L)
  - cfm = 0.028316846592 / 60 (cubic foot per minute, using the exact cubic foot = 0.028316846592 m³)
- Confirm `convertAll()` round-trips correctly: 10 GPM → ~37.8541 L/min, 400 CFM → ~188.779 L/s, 5 m³/h → ~83.3333 L/min, 50 L/min → ~13.2086 GPM.
- Confirm all units are pure linear factor conversions (no offsets).
- Confirm GPM is clearly documented as US gallons per minute (not UK/imperial) — verify this is stated in the educational content and that no UK GPM value was accidentally used.

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (a negative flow rate can represent reverse/backflow) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.flr-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.flr-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
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
