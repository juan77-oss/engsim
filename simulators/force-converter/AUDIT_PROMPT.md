# Audit request — Force Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toNewton` factor in `constants.js`:
  - n=1, kn=1000, mn=1e6, dyn=1e-5
  - kgf = 9.80665 (exact, standard gravity)
  - lbf = 4.4482216152605 (exact, lb × standard gravity)
  - pdl = 0.13825495437600002 (exact, lb-mass accelerated at 1 ft/s²)
- Confirm `convertAll()` round-trips correctly: 500 N → ~112.4045 lbf, 10 kgf → 98.0665 N exactly, 0.5 N → 50,000 dyn exactly, 20 lbf → ~643.481 pdl.
- Confirm all units are pure linear factor conversions (no offsets).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (force is a vector — negative represents opposite direction, e.g. tension vs. compression) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.frc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.frc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
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
