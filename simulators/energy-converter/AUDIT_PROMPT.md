# Audit request — Energy Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toJoule` factor in `constants.js` against authoritative sources (NIST SP 811, CODATA 2018):
  - J=1, kJ=1e3, MJ=1e6, GJ=1e9, Wh=3600, kWh=3.6e6, MWh=3.6e9
  - cal (thermochemical) = 4.184
  - kcal = 4184
  - BTU (IT) = 1055.05585262
  - therm (US) = 105,480,400 (100,000 BTU at 59°F, per EIA/NIST)
  - ft·lb = 1.3558179483314004
  - eV = 1.602176634e-19 (exact, 2019 SI redefinition)
  - erg = 1e-7
  - L·atm = 101.325
- Confirm `convertAll()` round-trips correctly: converting 1 kWh should show ~3,600,000 J, ~3412.14 BTU, ~860,420 cal, etc.
- Confirm no unit is accidentally non-linear (all should be pure factor conversions — unlike Power Converter's dBm).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: should this be blocked or allowed? (Currently allowed — energy deltas can be negative in engineering contexts; confirm this is the intended behavior, not a bug.)
- Changing the unit selector should recalculate the table live without needing to click "Convert".
- The row matching the currently selected input unit should be visually highlighted (`.enc-row--active`) — verify this always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold: confirm values that round to "0" at a unit's configured decimals (e.g. converting into eV or erg with too few decimals) correctly switch to exponential notation instead of displaying "0".

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.enc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
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
