# Audit request — Mass & Weight Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toKilogram` factor in `constants.js`:
  - mg=1e-6, g=1e-3, kg=1, tonne=1000
  - grain = 6.479891e-5 (exact, 64.79891 mg)
  - oz (avoirdupois) = 0.028349523125 (exact)
  - lb (avoirdupois) = 0.45359237 (exact, international 1959 agreement)
  - stone = 6.35029318 (exact, 14 lb)
  - US ton (short, 2000 lb) = 907.18474
  - UK ton (long, 2240 lb) = 1016.0469088
  - amu/dalton = 1.66053906660e-27 (CODATA 2018)
- Confirm `convertAll()` round-trips correctly: 70 kg → ~154.32 lb, 8 oz → ~226.80 g, 168 lb → exactly 12 stone, 10 tonne → ~11.02 US ton / ~9.84 UK ton.
- Confirm all units are pure linear factor conversions (no offsets).
- Double check the two "ton" variants aren't mixed up anywhere (US short ton vs UK long ton vs metric tonne are three different values and easy to swap by mistake).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- Negative values: currently allowed (consistent with Energy/Length Converter's precedent for deltas) — confirm this is intended, not a bug.
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.msc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold: confirm values that round to "0" at a unit's configured decimals (e.g. converting into amu with too few decimals) correctly switch to exponential notation instead of displaying "0". Also check the reverse: converting a large tonne value into amu doesn't produce a broken/overflowing number in the table.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.msc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.
- [ ] The `&amp;` in the title/h1 ("Mass & Weight Converter") renders correctly and doesn't break the JSON-LD or meta tags.

## 4. Console
- Load the page and confirm zero console errors/warnings, including on unit change, extreme values (mg ↔ metric ton, amu), and repeated invalid input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
