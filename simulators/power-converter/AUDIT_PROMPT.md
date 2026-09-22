# Audit Prompt — Power Converter (EngSim)

You are auditing a new unit converter simulator for the EngSim platform (static HTML/CSS/JS, no framework). Review the attached files:

- `index.html`
- `js/core.js`
- `js/constants.js`
- `js/simulator.js`
- `simulator-css-addition.css`

## What to check

1. **Conversion factor accuracy** — verify every `toWatt` factor in `constants.js` against standard engineering references (NIST, ASHRAE, ISO). Flag any factor that is wrong, mislabeled, or uses an outdated convention.
2. **dBm logic** — confirm `wattsToDbm` / `dbmToWatts` in `core.js` are mathematically correct (dBm = 10·log10(P_mW / 1mW)) and that edge cases are handled: zero watts, negative watts, and dBm round-trip consistency (convert W→dBm→W and check it returns the original value within floating-point tolerance).
3. **`convertToAll` correctness** — for a handful of test values (e.g. 1 kW, 5 hp, 100 mW, 0), manually verify every unit in the returned `results` map against a trusted external converter or hand calculation.
4. **Input validation** — empty input, non-numeric input, negative numbers, extremely large/small numbers (e.g. 1e20, 1e-20). Confirm `showError`/`clearError` behave correctly and the results table hides/shows appropriately.
5. **UI/DOM correctness** — confirm `simulator.js` correctly targets every element ID referenced in `index.html`, the `<select>` unit list matches the keys in `POWER_UNITS` plus `dbm`, and the active-row highlight (`pwc-row--active`) matches the currently selected input unit.
6. **Formatting** — check `fmt()` in `simulator.js` for sane output across magnitudes (very small numbers like erg/s from a small watt input, very large numbers like erg/s from a large kW input) — does it correctly switch to scientific notation, and is the decimal precision per unit (`decimals` field in `constants.js`) reasonable?
7. **Console errors** — confirm no runtime errors/warnings in the browser console on page load and on every interaction (typing, changing unit, clicking Convert).
8. **Accessibility/semantics** — `aria-live` on the error box, `<label>`/`for` pairing on inputs, table headers.

## Known assumption to flag if wrong

`simulator.js` toggles an `is-visible` class on `#sim-error` to show/hide it, and relies on `.sim-error.is-visible` styling already existing in EngSim's shared `simulator.css` (the actual class/mechanism used by other simulators like Static Beam or Natural Draft wasn't available at authoring time). **Please confirm this matches the real shared CSS mechanism**, and flag it if the visibility toggle needs to change to match the platform's actual pattern.

Report bugs as a numbered list with severity (critical / minor) and a suggested fix for each.
