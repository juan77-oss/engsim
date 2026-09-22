# Audit request — Data Storage Converter (EngSim)

Please audit this simulator against the following:

## 1. Physics / conversion logic (js/core.js + js/constants.js)
- Verify every `toByte` factor in `constants.js`:
  - bit = 0.125 (1/8 byte)
  - byte = 1
  - Decimal (SI, base 1000): kb=1e3, mb=1e6, gb=1e9, tb=1e12, pb=1e15
  - Binary (IEC, base 1024): kib=1024, mib=1024², gib=1024³, tib=1024⁴, pib=1024⁵
- Confirm `convertAll()` round-trips correctly: 1 TB → ~931.32 GiB, 5 MB → exactly 5,000 KB, 25 GiB → ~26.8435 GB.
- Confirm decimal and binary units are never mixed up in `constants.js` or in the reference table in `index.html` — this is the single most important thing to get right in this simulator, since a swapped KB/KiB factor would be a silent, hard-to-notice bug.
- Confirm all units are pure linear factor conversions (no offsets).

## 2. UI / validation logic (js/simulator.js)
- Empty input → error shown, shake animation triggers, results table hidden.
- Non-numeric input → error shown.
- **Negative values are blocked here** (unlike Energy/Length/Mass/Volume Converter, which allow negatives for deltas) — a data size has no meaningful negative interpretation. Verify: entering a negative number shows "Data size cannot be negative." and hides the results table. Verify 0 is still accepted (0 bytes is valid, just not negative).
- Changing the unit selector recalculates the table live without needing to click "Convert".
- The row matching the currently selected input unit is highlighted (`.dsc-row--active`) and always matches `input-unit`'s value.
- `fmt()` scientific-notation threshold and the `.replace(/\+/g, '')` regex fix (carried over from the Mass Converter audit) — confirm both work correctly here, especially for petabyte-scale and bit-scale extremes.

## 3. Consistency checklist (per EngSim standards)
- [ ] No hardcoded hex colors — everything through CSS variables (`var(--border)`, `var(--bg-hover)`, `var(--brand-accent)`, `var(--text-primary)`, `var(--text-secondary)`).
- [ ] `.dsc-table-wrap` has `overflow-x: auto` and is usable on mobile (375px width) without breaking page layout.
- [ ] SEO: title/description/OG tags present, canonical commented out (not yet live), JSON-LD present and valid.
- [ ] `.sim-layout` uses plain `<aside>`/`<div>` children, no invented BEM classes.
- [ ] No slider present — confirm none was accidentally needed/expected.
- [ ] All `<th>` elements have `scope="col"`.
- [ ] All decorative SVGs have `aria-hidden="true"`.
- [ ] `#btn-calculate` has `type="button"`.
- [ ] Input has `aria-invalid` toggled correctly on error/clear.

## 4. Console
- Load the page and confirm zero console errors/warnings, including on unit change, extreme values (bit ↔ petabyte), zero, and repeated invalid/negative input.

Report all findings as a numbered list of bugs (if any) with the exact fix, or confirm PASS if none found.
