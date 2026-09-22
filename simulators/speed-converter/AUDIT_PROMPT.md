# Audit request — Speed Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toMps` factor in `constants.js`:
  - ms = 1
  - kmh = 1000/3600 (= 0.277778 repeating)
  - mph = 0.44704 (exact, derived from mile=1609.344m and hour=3600s)
  - fts = 0.3048 (exact)
  - knot = 1852/3600 (= 0.514444 repeating, derived from the exact nautical mile)
  - mach = 343 (**approximation** — speed of sound in dry air at 20°C, sea level; verify this is clearly flagged as approximate everywhere it appears, not presented as an exact physical constant)
  - c = 299792458 (exact, by SI definition of the meter)
- Confirm `convertAll()` round-trips correctly: 120 km/h → ~74.5645 mph, 20 knots → 37.04 km/h, Mach 2 → 2469.6 km/h (using the 343 m/s approximation), 30,000 km/h → ~0.0000278c.
- Confirm all units are pure linear factor conversions (no offsets).

## 2. Physical limit validation — the two-sided floor/ceiling unique to this simulator
- `exceedsSpeedOfLight()` compares `Math.abs(toMps(value, fromKey))` against 299792458 m/s.
- Verify negative values are rejected BEFORE the speed-of-light check runs (so a large negative number shows "Speed cannot be negative", not the speed-of-light error) — check the order of validation in `calculate()`.
- Verify the speed-of-light boundary is inclusive: entering exactly `1` in unit `c` should be ACCEPTED (equals c, not over it). Entering something like `1.0000001` in unit `c`, or `299792459` in m/s, should be REJECTED.
- Verify a huge value in a "slow" unit like km/h (e.g. 2,000,000,000 km/h, which does exceed c) is correctly caught — this requires converting to m/s first before comparing, not comparing the raw input number to the m/s value of c.
- Confirm changing the unit selector after either error correctly re-validates against the new unit (not stuck showing the old error).

## 3. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.spc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here, especially for the speed-of-light column at small input values (e.g. 1 m/s → c column should show a very small number in proper exponential form, not "0").

## 4. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.spc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 5. Console
- Load the page and confirm zero console errors/warnings, including on unit change, boundary values (0, exactly c), and repeated invalid/negative/above-c input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
