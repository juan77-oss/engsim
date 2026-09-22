# Audit request — Torque Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toNm` factor in `constants.js`:
  - nm=1, knm=1000
  - lbfft = 1.3558179483314003 (= lbf × ft = 4.4482216152605 × 0.3048)
  - lbfin = 0.11298482902761668 (= lbf × in = 4.4482216152605 × 0.0254)
  - kgfm = 9.80665 (exact, standard gravity)
  - dyncm = 1e-7 (= dyn × cm = 1e-5 × 1e-2)
- Confirm `convertAll()` round-trips correctly: 100 N·m → ~73.7562 lbf·ft, 15 lbf·in → ~1.6948 N·m, 5 kgf·m → ~49.0332 N·m, 8 lbf·ft → exactly 96 lbf·in.
- Confirm lbf·ft = 12 × lbf·in exactly (since 1 ft = 12 in) — a good internal-consistency check.
- Confirm all units are pure linear factor conversions (no offsets).
- Note for the auditor: torque and energy share the same base unit (N·m = J) but are different physical quantities (vector vs. scalar) — this is intentional and explained in the educational content, not a naming bug to flag.

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (torque is a vector — negative represents opposite rotational direction) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.trq-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.trq-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
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
