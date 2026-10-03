# Audit prompt — Transformer Equivalent Circuit Calculator

Paste this to Antigravity once the files are integrated into the repo.

---

Audit the simulator at `simulators/transformer-equivalent-circuit/` in this repo. Check, in order:

## 1. Physics (js/xfm-core.js)
- Run `node js/xfm-core.js`-style validation: the file exports `runValidationSuite()`. Execute it (e.g. via a small Node script requiring the file) and confirm all tests pass.
- Manually re-derive at least 2 of the worked numbers using a second method (hand calc or a different tool) to catch a systematic error the test suite itself might share:
  - Short-circuit test reduction (Z, R, X) from Vcc/Icc/Pcc.
  - Open-circuit test reduction (Rfe, Xm) from V0/I0/P0.
  - The exact (T-model) solver at Spct=0 (open circuit): I2 should be exactly 0 and I1 should equal the magnetizing/excitation current.
  - The exact (T-model) solver with Zload=0 and U1 set to the short-circuit test's own Vcc: I1 should reproduce Icc from the test (this is xfm-core.js's own T6 test — re-derive it independently).
- Check `buildLoadImpedance`: confirm the load impedance is sized so that, AT RATED SECONDARY VOLTAGE, it draws exactly Spct% of Sn at the given cosφ (constant-impedance load model, not constant-power).
- Check the three-phase reduction (`reduceThreePhase`): line→phase voltage division by √3, total→per-phase power division by 3, current unchanged (star-equivalent assumption). Confirm %Zcc comes out numerically identical whether computed from primary-side or secondary-side test data (referral-invariance — should hold exactly).
- Check sign conventions: leading power factor should give LOWER (or negative) voltage regulation than lagging, for the same |cosφ| and load %, in both the approximate (Kapp) and exact models.

## 2. UI / simulator.js
- Confirm `btn-calculate` validates all required fields before computing, and that invalid inputs get `.sim-input--invalid` + `aria-invalid="true"` with a clear message in `#sim-error`.
- Confirm the "Short circuit" shortcut button forces the model selector to "Exact (T)" (the approximate Kapp formula is not valid at Zload=0) and that this is visible to the user (the select's displayed value should change).
- Confirm moving the load slider after using "Open circuit" / "Short circuit" correctly returns to normal percentage-based loading (no stuck state).
- Confirm switching "Show parameters referred to" (primary/secondary) updates the circuit diagram's R/X labels AND the U1/U2' labels, without changing the "Operating point" results (U2, regulation%, I1, I2), which are real physical quantities and must be reference-side-independent.
- Confirm the three-phase-only fields (`u1n-mode`, `u2n-mode`, `power-total` checkbox) are hidden by default (single-phase) and appear when "Three-phase" is selected.

## 3. Diagram (js/xfm-plot.js)
- Confirm the SVG has no `NaN` in any coordinate for a range of inputs (try very small and very large Sn, extreme load%, cosφ≈1 and cosφ≈0.01).
- Confirm the equivalent circuit diagram changes shape correctly between the Approximate (L) and Exact (T) layouts, and that the load box correctly switches between "OPEN CIRCUIT" (two dots), "SHORT CIRCUIT" (thick line), and a labeled impedance box.
- Confirm all `<text>` and `<path>` elements render inside the declared viewBox (no obviously off-canvas labels) at both desktop and the 640px mobile breakpoint.

## 4. Consistency with the rest of the site
- `.xfm-*` CSS block pasted into the CURRENT `assets/css/simulator.css` (not an old copy) — confirm no class name collisions with existing global classes, especially `.xfm-results-grid` and `.xfm-checkbox-label` (these were added as local fallbacks in case no equivalent global component existed — check whether one does, and if so, migrate to the global class and delete the duplicate).
- `.sim-error` is a direct sibling of `.sim-layout`, not nested inside a panel.
- `#btn-calculate` exists with `type="button"`.
- lucide icons have `aria-hidden="true"`, explicit `width`/`height`, `stroke="currentColor"`, `stroke-width="2"`.
- Canonical stays commented until launch; JSON-LD is `SoftwareApplication`; breadcrumb structure matches other simulators.
- Mobile: diagram/phasor wrappers have `overflow-x: auto` and don't force the page to scroll horizontally.
- Browser console: no errors/warnings on load, on Calculate, on switching every selector, and on dragging the load slider to its extremes.

Report bugs grouped by severity (HIGH/MEDIUM/LOW) with the exact file and line, like previous audits.
