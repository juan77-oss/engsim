/**
 * welded-joints-simulator.js - Welded Joints Analyzer
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - Input reading and validation
 *   - Orchestration of core (physics) and plot (SVG rendering)
 *   - Output writing to the DOM, drag interaction, fullscreen toggle
 *
 * WHAT DOES NOT GO HERE:
 *   - Navbar, footer, theme toggle (-> platform.js)
 *   - Layout or styling (-> simulator.css / css/welded-joints.css)
 *   - Physics (-> welded-joints-core.js)
 *   - SVG drawing (-> welded-joints-plot.js)
 *
 * THEORY NOTES:
 *   Sign / unit conventions: the core works in mm-N-MPa (SI) or in-kip-ksi (US).
 *   The UI shows forces in kN (SI) or kip (US); simulator.js converts kN -> N.
 *   Switching the unit system converts the typed values, so the problem stays
 *   the same. Non-ASCII characters are written as \u escapes (encoding safety).
 *
 * ---------------------------------------------------------------
 */

'use strict';

import * as core from './welded-joints-core.js';
import * as plot from './welded-joints-plot.js';
import {
    UNIT_LABELS, MM_PER_IN, KN_PER_KIP, MPA_PER_KSI, DEFAULT_SYSTEM,
    PATTERN_ORDER, PATTERN_LABELS, RUN_LABELS, KFS_LABELS,
    EXAMPLES, DEFAULT_EXAMPLE
} from './welded-joints-constants.js';

const { fmtNum, fmtLabel } = plot;
const $ = (id) => document.getElementById(id);
const TAU = '\u03C4';
const GE = '\u2265';
const DOT = '\u00B7';

/* -- Module state ------------------------------------------------ */

let mode = 'inplane';          // 'inplane' | 'bending'
let pattern = 'C';
let currentSystem = DEFAULT_SYSTEM;
let lastRender = null;         // { tf, props } of the last successful render
let rafId = 0;

/* -- Error / validation helpers (same pattern as other simulators) */

function showError(msg, scroll = false) {
    const el = $('sim-error');
    el.textContent = msg;
    el.classList.add('is-visible');
    if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearError() {
    const el = $('sim-error');
    el.textContent = '';
    el.classList.remove('is-visible');
}

function markInvalid(input) {
    const target = input.closest('.sim-input-wrap') || input;
    target.classList.remove('sim-input--invalid');
    void target.offsetWidth;
    target.classList.add('sim-input--invalid');
}

function clearAllInvalid() {
    document.querySelectorAll('.sim-input--invalid').forEach((el) => el.classList.remove('sim-input--invalid'));
}

/* -- Small helpers ----------------------------------------------- */

const num = (id) => {
    const v = $(id).value.trim();
    return v === '' ? NaN : parseFloat(v);
};

const setVal = (id, v) => {
    const el = $(id);
    if (el) el.value = (v === undefined || v === null) ? '' : String(v);
};

const patternParams = () => core.PRESETS.find((p) => p.id === pattern).params;

function fmtN(n) {
    if (!isFinite(n)) return '\u221E';
    if (n > 99) return '>99';
    return n.toFixed(2);
}

function roundInput(v) {
    return Number(v.toPrecision(4));
}

/* -- Static select options --------------------------------------- */

function populateSelects() {
    $('select-electrode').innerHTML = Object.entries(core.ELECTRODES)
        .map(([id, e]) => `<option value="${id}">${e.label}</option>`).join('');
    $('select-electrode').value = 'E70';

    $('select-base').innerHTML = Object.entries(core.BASE_METALS)
        .map(([id, m]) => `<option value="${id}">${m.label}</option>`).join('')
        + '<option value="custom">Custom (enter Sy and Sut)</option>';
    $('select-base').value = 'A36';

    $('select-kfs').innerHTML = core.FATIGUE_KFS
        .map((k) => `<option value="${k.id}">${KFS_LABELS[k.id]}</option>`).join('')
        + '<option value="custom">Custom value</option>';
    $('select-kfs').value = 'fillet-parallel-end';

    $('select-example').innerHTML = '<option value="">Load an example\u2026</option>'
        + Object.entries(EXAMPLES).map(([id, e]) => `<option value="${id}">${e.label}</option>`).join('');
}

function buildPatternGrid() {
    const grid = $('pattern-grid');
    grid.innerHTML = PATTERN_ORDER.map((id) => {
        const seg = core.buildGroup(id, { b: 0.6, d: 1, r: 0.5 });
        return `<button type="button" class="wj-pattern" data-pattern="${id}" aria-pressed="false" title="${PATTERN_LABELS[id]}">
${plot.patternThumbSvg(seg)}<span>${PATTERN_LABELS[id]}</span></button>`;
    }).join('');
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.wj-pattern');
        if (btn) setPattern(btn.dataset.pattern);
    });
}

/* -- Mode / pattern / visibility ---------------------------------- */

function setMode(m, recalc = true) {
    mode = m;
    document.querySelectorAll('.wj-seg__btn').forEach((b) => {
        const on = b.dataset.mode === m;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
    });
    refreshVisibility();
    if (recalc) schedule();
}

// Fill any dimension the pattern needs but the user has not typed yet.
function ensureDims() {
    const US = $('select-system').value === 'US';
    const def = US ? { b: 2, d: 4, r: 1 } : { b: 50, d: 100, r: 25 };
    patternParams().forEach((k) => {
        const el = $(`input-${k}`);
        const v = parseFloat(el.value);
        if (!isFinite(v) || v <= 0) el.value = String(def[k]);
    });
}

function setPattern(p, recalc = true) {
    pattern = p;
    ensureDims();
    document.querySelectorAll('.wj-pattern').forEach((b) => {
        const on = b.dataset.pattern === p;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
    });
    refreshVisibility();
    if (recalc) schedule();
}

function refreshVisibility() {
    const params = patternParams();
    $('field-b').classList.toggle('is-hidden', !params.includes('b'));
    $('field-d').classList.toggle('is-hidden', !params.includes('d'));
    $('field-r').classList.toggle('is-hidden', !params.includes('r'));
    $('group-inplane').classList.toggle('is-hidden', mode !== 'inplane');
    $('group-bending').classList.toggle('is-hidden', mode !== 'bending');
    $('drag-hint').classList.toggle('is-hidden', mode !== 'inplane');
    $('base-custom').classList.toggle('is-hidden', $('select-base').value !== 'custom');
    const fat = $('check-fatigue').checked;
    $('group-fatigue').classList.toggle('is-hidden', !fat);
    $('fatigue-panel').classList.toggle('is-hidden', !fat);
    $('field-kfs-custom').classList.toggle('is-hidden', $('select-kfs').value !== 'custom');
    $('angle-value').textContent = `${$('input-angle').value}\u00B0`;
    $('ratio-value').textContent = Number($('input-ratio').value).toFixed(2);
}

function updateUnits() {
    const U = UNIT_LABELS[$('select-system').value];
    document.querySelectorAll('.js-u-length').forEach((el) => { el.textContent = U.length; });
    document.querySelectorAll('.js-u-force').forEach((el) => { el.textContent = U.force; });
    document.querySelectorAll('.js-u-stress').forEach((el) => { el.textContent = U.stress; });
    document.querySelectorAll('.js-u-moment').forEach((el) => { el.textContent = U.moment; });
    document.querySelectorAll('.js-u-area').forEach((el) => { el.textContent = U.area; });
}

/* -- Unit-system switch: convert typed values --------------------- */

const LENGTH_FIELDS = ['input-b', 'input-d', 'input-r', 'input-h', 'input-ex', 'input-ey', 'input-arm', 'input-t-thick', 'input-t-thin'];
const FORCE_FIELDS = ['input-force', 'input-shear'];
const STRESS_FIELDS = ['input-base-sy', 'input-base-sut'];

function convertSystem(from, to) {
    if (from === to) return;
    const toUS = to === 'US';
    const fl = toUS ? 1 / MM_PER_IN : MM_PER_IN;
    const ff = toUS ? 1 / KN_PER_KIP : KN_PER_KIP;
    const fs = toUS ? 1 / MPA_PER_KSI : MPA_PER_KSI;
    const conv = (ids, f) => ids.forEach((id) => {
        const el = $(id);
        const v = parseFloat(el.value);
        if (isFinite(v)) el.value = String(Number((v * f).toPrecision(5)));
    });
    conv(LENGTH_FIELDS, fl);
    conv(FORCE_FIELDS, ff);
    conv(STRESS_FIELDS, fs);
}

/* -- Input reading ------------------------------------------------ */

function readInputs() {
    const bad = [];
    const need = (id, test) => {
        const v = num(id);
        if (!isFinite(v) || !test(v)) bad.push(id);
        return v;
    };
    const sys = $('select-system').value;
    const params = patternParams();
    const out = { sys, U: UNIT_LABELS[sys], mode, pattern };

    out.b = params.includes('b') ? need('input-b', (v) => v > 0) : 0;
    out.d = params.includes('d') ? need('input-d', (v) => v > 0) : 0;
    out.r = params.includes('r') ? need('input-r', (v) => v > 0) : 0;
    out.h = need('input-h', (v) => v > 0);
    out.nd = need('input-nd', (v) => v > 0);

    if (mode === 'inplane') {
        out.force = need('input-force', (v) => v >= 0);
        out.angle = need('input-angle', () => true);
        out.ex = need('input-ex', () => true);
        out.ey = need('input-ey', () => true);
    } else {
        out.shear = need('input-shear', (v) => v >= 0);
        out.arm = need('input-arm', (v) => v >= 0);
    }

    out.electrodeId = $('select-electrode').value;
    out.baseId = $('select-base').value;
    if (out.baseId === 'custom') {
        out.baseSy = need('input-base-sy', (v) => v > 0);
        out.baseSut = need('input-base-sut', (v) => v > 0);
    }

    // Optional plate thicknesses (code size limits)
    const tk = num('input-t-thick'), tn = num('input-t-thin');
    out.tThick = isFinite(tk) && tk > 0 ? tk : null;
    out.tThin = isFinite(tn) && tn > 0 ? tn : null;
    if ($('input-t-thick').value.trim() !== '' && out.tThick === null) bad.push('input-t-thick');
    if ($('input-t-thin').value.trim() !== '' && out.tThin === null) bad.push('input-t-thin');

    out.fatigue = $('check-fatigue').checked;
    if (out.fatigue) {
        out.ratio = need('input-ratio', (v) => v >= -1 && v <= 1);
        out.kfsId = $('select-kfs').value;
        if (out.kfsId === 'custom') out.kfsCustom = need('input-kfs-custom', (v) => v > 0);
        out.method = $('select-method').value;
    }

    if (bad.length) {
        bad.forEach((id) => markInvalid($(id)));
        return { error: 'Please enter valid values in the highlighted fields.' };
    }
    return out;
}

/* -- Core calculation --------------------------------------------- */

function calculate({ scroll = false } = {}) {
    clearError();
    clearAllInvalid();

    const inp = readInputs();
    if (inp.error) {
        showError(inp.error, scroll);
        return;
    }
    const { sys, U } = inp;

    // 1. Geometry and load
    const segments = core.buildGroup(inp.pattern, { b: inp.b, d: inp.d, r: inp.r });
    const props = core.groupProperties(segments, inp.h);
    const fs = U.forceToCore;
    let load;
    if (inp.mode === 'inplane') {
        const F = inp.force * fs;
        const a = (inp.angle * Math.PI) / 180;
        load = { Fx: F * Math.cos(a), Fy: F * Math.sin(a), px: props.xg + inp.ex, py: props.yg + inp.ey };
    } else {
        load = { V: inp.shear * fs, M: inp.shear * fs * inp.arm };
    }

    // 2. Stress analysis
    const samples = segments.length > 20 ? 2 : 10;
    const analysis = core.analyze(segments, inp.h, inp.mode, load, { samples });
    const endpoints = core.stressAtEndpoints(analysis, segments);

    // 3. Static verification
    const base = inp.baseId === 'custom'
        ? { Sy: inp.baseSy, Sut: inp.baseSut }
        : core.baseProps(inp.baseId, sys);
    const sc = core.staticCheck({ tau: analysis.tauMax, electrodeId: inp.electrodeId, base, sys, nd: inp.nd });
    const tauAllow = sc.electrode.tauAllow;
    const design = core.designFilletSize({
        segments, mode: inp.mode, load, electrodeId: inp.electrodeId, base, sys, thickerPart: inp.tThick
    });

    let member = null;
    if (inp.mode === 'bending' && inp.pattern === 'two-vertical' && load.M > 0) {
        member = core.memberBendingCheck({ M: load.M, t: inp.b, d: inp.d, Sy: base.Sy });
        member.status = member.util > 1 || member.n < inp.nd ? 'fail' : member.n < inp.nd * 1.1 ? 'warn' : 'ok';
    }

    // 4. Fatigue (optional)
    let fat = null;
    if (inp.fatigue) {
        const R = inp.ratio;
        const loadMin = inp.mode === 'inplane'
            ? { Fx: load.Fx * R, Fy: load.Fy * R, px: load.px, py: load.py }
            : { V: load.V * R, M: load.M * R };
        const Kfs = inp.kfsId === 'custom' ? inp.kfsCustom : core.FATIGUE_KFS.find((k) => k.id === inp.kfsId).Kfs;
        const Sut = Math.min(sc.electrode.Sut, base.Sut);
        fat = core.fatigueAnalysis({ segments, h: inp.h, mode: inp.mode, loadMax: load, loadMin, Kfs, Sut, method: inp.method, sys });
        fat.curve = core.fatigueCurve(fat.Sse, fat.Ssu, inp.method);
        fat.Sut = Sut;
        fat.status = fat.nf < inp.nd ? 'fail' : fat.nf < inp.nd * 1.1 ? 'warn' : 'ok';
        fat.unit = U.stress;
    }

    // 5. Code size limits (minimum / maximum fillet size)
    const sizeMsgs = [];
    if (inp.tThick !== null) {
        const hmin = core.minFilletSize(inp.tThick, sys);
        if (inp.h < hmin - 1e-9) sizeMsgs.push(`Leg ${plot.fmtLeg(inp.h, sys)} ${U.length} is below the code minimum of ${plot.fmtLeg(hmin, sys)} ${U.length} for the thicker plate.`);
    }
    if (inp.tThin !== null && inp.h > inp.tThin + 1e-9) {
        sizeMsgs.push(`Leg ${plot.fmtLeg(inp.h, sys)} ${U.length} exceeds the thickness of the thinner plate (${fmtNum(inp.tThin)} ${U.length}).`);
    }

    // 6. Write results
    writeResults({ inp, props, analysis, endpoints, sc, design, member, fat, sizeMsgs, tauAllow });

    // 7. Diagram, tables, symbols
    const params = patternParams();
    const dimLabels = {};
    if (params.includes('b')) dimLabels.b = `b = ${fmtLabel(inp.b)} ${U.length}`;
    if (params.includes('d')) dimLabels.d = `d = ${fmtLabel(inp.d)} ${U.length}`;
    if (params.includes('r')) dimLabels.r = `r = ${fmtLabel(inp.r)} ${U.length}`;

    const loadView = inp.mode === 'inplane'
        ? {
            ex: inp.ex, ey: inp.ey, angleDeg: inp.angle,
            label: `F = ${fmtLabel(inp.force)} ${U.force}`,
            armLabel: `e = ${fmtLabel(Math.hypot(inp.ex, inp.ey))} ${U.length}`
        }
        : {
            Vlabel: `V = ${fmtLabel(inp.shear)} ${U.force}`,
            Mlabel: `M = V${DOT}a = ${fmtLabel(analysis.M * U.momentFromCore)} ${U.moment}`
        };

    const tf = plot.renderDiagram($('weld-svg'), {
        segments, analysis, endpoints, mode: inp.mode, tauAllow, h: inp.h,
        load: loadView, dimLabels, units: { stress: U.stress, length: U.length },
        show: { map: $('check-map').checked, vectors: $('check-vectors').checked, dims: $('check-dims').checked }
    });
    lastRender = { tf, props, sys };

    writePointsTable(endpoints, analysis, props, tauAllow, U);
    writeSymbols(segments, inp, sc);
    if (fat) {
        plot.renderFatigueDiagram($('fatigue-svg'), fat);
        writeFatigue(fat, inp, U);
    }
}

/* -- Result writers ------------------------------------------------ */

function setStatus(id, status) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('wj-status--ok', 'wj-status--warn', 'wj-status--fail');
    if (status) el.classList.add(`wj-status--${status}`);
}

function writeResults(r) {
    const { inp, props, analysis, sc, design, member, fat, sizeMsgs } = r;
    const { U, sys } = inp;

    $('out-tau').textContent = fmtNum(analysis.tauMax);
    $('out-n-weld').textContent = fmtN(sc.weld.n);
    $('out-n-base').textContent = fmtN(sc.base.n);
    $('out-h-min').textContent = plot.fmtLeg(design.hRequired, sys);
    const govText = { weld: 'weld metal governs', base: 'base metal governs', 'code-min': 'code minimum governs' }[design.governs];
    $('out-h-note').textContent = govText;
    setStatus('card-n-weld', sc.weld.status);
    setStatus('card-n-base', sc.base.status);
    setStatus('card-h-min', inp.h >= design.hRequired - 1e-9 ? 'ok' : 'fail');

    $('out-A').textContent = fmtNum(props.A);
    $('label-J').textContent = inp.mode === 'inplane' ? 'Polar moment J' : 'Moment of area I';
    $('out-J').textContent = fmtNum(inp.mode === 'inplane' ? props.J : props.Ix);
    $('unit-J').textContent = U.inertia;
    $('out-centroid').textContent = `${fmtNum(props.xg)}, ${fmtNum(props.yg)}`;
    $('out-M').textContent = fmtNum(Math.abs(analysis.M) * U.momentFromCore);
    $('card-member').classList.toggle('is-hidden', !member);
    if (member) {
        $('out-n-member').textContent = fmtN(member.n);
        setStatus('card-member', member.status);
    }
    updateUnits();

    // Verdict banner
    const msgs = [];
    const ord = { ok: 0, warn: 1, fail: 2 };
    let worst = 'ok';
    const bump = (s) => { if (ord[s] > ord[worst]) worst = s; };
    const cmp = (n) => (n >= inp.nd ? GE : '<');

    msgs.push(`Weld metal: n = ${fmtN(sc.weld.n)} ${cmp(sc.weld.n)} ${inp.nd}`); bump(sc.weld.status);
    msgs.push(`Base metal: n = ${fmtN(sc.base.n)} ${cmp(sc.base.n)} ${inp.nd}`); bump(sc.base.status);
    if (member) { msgs.push(`Bar in bending: n = ${fmtN(member.n)} ${cmp(member.n)} ${inp.nd}`); bump(member.status); }
    if (fat) { msgs.push(`Fatigue: nf = ${fmtN(fat.nf)} ${cmp(fat.nf)} ${inp.nd}`); bump(fat.status); }
    if (inp.h < design.hRequired - 1e-9) bump('fail');
    if (sizeMsgs.length) { msgs.push(...sizeMsgs); bump('warn'); }

    const banner = $('verdict-banner');
    banner.classList.remove('status-banner--success', 'status-banner--warning', 'status-banner--danger');
    banner.classList.add({ ok: 'status-banner--success', warn: 'status-banner--warning', fail: 'status-banner--danger' }[worst]);
    $('verdict-title').textContent = { ok: 'Joint meets the design factor', warn: 'Marginal \u2014 check the notes', fail: 'Joint does not meet the design factor' }[worst];
    $('verdict-message').textContent = msgs.join(`  ${DOT}  `)
        + (worst === 'fail' ? `.  Required leg: ${plot.fmtLeg(design.hRequired, sys)} ${U.length}.` : '.');

    // Size hint
    const t = 0.707 * inp.h;
    $('hint-h').textContent = `Throat = 0.707 h = ${fmtNum(t, 1)} ${U.length}. Code minimum for the thicker plate is shown in the results.`;
}

function writePointsTable(endpoints, analysis, props, tauAllow, U) {
    const rows = (endpoints.length ? endpoints : [{ ...analysis.critical, label: 'max' }]).map((p) =>
        `<tr><td><span class="wj-badge-inline">${p.label}</span></td>
<td>${fmtNum(Math.hypot(p.x - props.xg, p.y - props.yg))}</td>
<td>${fmtNum(p.tau1)}</td><td>${fmtNum(p.tau2)}</td>
<td><strong>${fmtNum(p.tau)}</strong></td>
<td>${(100 * p.tau / tauAllow).toFixed(0)}%</td></tr>`).join('');
    $('points-body').innerHTML = rows;
    $('points-unit').textContent = U.stress;
    $('points-len').textContent = U.length;
}

function writeSymbols(segments, inp, sc) {
    const U = inp.U;
    const field = $('check-field').checked;
    const syms = core.symbolsForGroup(segments, inp.h);
    $('symbol-grid').innerHTML = syms.map((s) => {
        const spec = {
            ...s.spec, field,
            sizeText: plot.fmtLeg(inp.h, inp.sys),
            lengthText: s.lengthEach != null ? fmtLabel(s.lengthEach) : ''
        };
        const title = s.run === 'all'
            ? RUN_LABELS.all
            : `${RUN_LABELS[s.run]}${s.count > 1 ? ` (${s.count}\u00D7)` : ''}`;
        const parts = [`Fillet weld, leg ${plot.fmtLeg(inp.h, inp.sys)} ${U.length}`];
        if (spec.lengthText) parts.push(`length ${spec.lengthText} ${U.length}`);
        if (spec.otherSide) parts.push('both sides (arrow + other side)');
        if (spec.allAround) parts.push('all around');
        if (field) parts.push('field weld');
        return `<div class="wj-symbol-card" data-run="${s.run}" tabindex="0">
<div class="wj-symbol-card__title">${title}</div>
${plot.weldSymbolSvg(spec, { tail: sc.electrode.label })}
<p class="wj-symbol-card__desc">${parts.join(', ')}.</p></div>`;
    }).join('');
}

function writeFatigue(fat, inp, U) {
    $('out-sse').textContent = fmtNum(fat.Sse);
    $('out-ssu').textContent = fmtNum(fat.Ssu);
    $('out-taua').textContent = fmtNum(fat.tauA);
    $('out-taum').textContent = fmtNum(fat.tauM);
    $('out-nf').textContent = fat.nf >= 1 && isFinite(fat.nf) && fat.nf > 99 ? '>99' : (isFinite(fat.nf) ? fat.nf.toFixed(2) : '\u221E');
    setStatus('card-nf', fat.status);
    $('fatigue-note').textContent =
        `Kfs = ${fat.Kfs} ${DOT} ka = ${fat.ka.toFixed(3)} ${DOT} kc = ${fat.kc} ${DOT} Sut = ${fmtNum(fat.Sut)} ${U.stress} (the weaker of electrode and base metal) ${DOT} ${fat.method === 'goodman' ? 'modified Goodman' : 'Gerber'}. `
        + (fat.nf >= 1 ? 'Predicted infinite life.' : 'Predicted finite life \u2014 the point is outside the safe region.');
}

/* -- Schedule (coalesce rapid input events into one frame) --------- */

function schedule() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        rafId = 0;
        refreshVisibility();
        calculate();
    });
}

/* -- Drag the load point on the diagram ---------------------------- */

function setupDrag() {
    const svg = $('weld-svg');
    let dragging = false;

    const moveTo = (e) => {
        if (!lastRender) return;
        const m = svg.getScreenCTM();
        if (!m) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(m.inverse());
        const { tf, props } = lastRender;
        const vx = Math.max(34, Math.min(plot.VIEW_W - 34, p.x));
        const vy = Math.max(44, Math.min(plot.VIEW_H - 70, p.y));
        let ex = (vx - plot.VIEW_W / 2) / tf.s + tf.cx - props.xg;
        let ey = -((vy - plot.VIEW_H / 2) / tf.s) + tf.cy - props.yg;
        // Snap to the axes through G (concentric / pure-torque cases)
        if (Math.abs(ex * tf.s) < 7) ex = 0;
        if (Math.abs(ey * tf.s) < 7) ey = 0;
        setVal('input-ex', roundInput(ex));
        setVal('input-ey', roundInput(ey));
        schedule();
    };

    svg.addEventListener('pointerdown', (e) => {
        if (mode !== 'inplane' || !e.target.closest('[data-drag]')) return;
        dragging = true;
        svg.classList.add('is-dragging');
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    svg.addEventListener('pointermove', (e) => { if (dragging) moveTo(e); });
    const end = () => { dragging = false; svg.classList.remove('is-dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
}

/* -- Symbol card hover: highlight the matching welds --------------- */

function focusRun(run) {
    const svg = $('weld-svg');
    svg.classList.toggle('is-run-focus', !!run);
    svg.querySelectorAll('[data-run]').forEach((el) => {
        el.classList.toggle('is-focus', !!run && (run === 'all' || el.dataset.run === run));
    });
}

function setupSymbolHover() {
    const grid = $('symbol-grid');
    grid.addEventListener('mouseover', (e) => {
        const c = e.target.closest('.wj-symbol-card');
        focusRun(c ? c.dataset.run : null);
    });
    grid.addEventListener('mouseleave', () => focusRun(null));
    grid.addEventListener('focusin', (e) => {
        const c = e.target.closest('.wj-symbol-card');
        if (c) focusRun(c.dataset.run);
    });
    grid.addEventListener('focusout', () => focusRun(null));
}

/* -- Built-in examples --------------------------------------------- */

function applyExample(id) {
    const ex = EXAMPLES[id];
    if (!ex) { $('example-note').textContent = ''; return; }
    currentSystem = ex.sys;
    $('select-system').value = ex.sys;
    setMode(ex.mode, false);
    setPattern(ex.pattern, false);
    if (ex.b !== undefined) setVal('input-b', ex.b);
    if (ex.d !== undefined) setVal('input-d', ex.d);
    if (ex.r !== undefined) setVal('input-r', ex.r);
    setVal('input-h', ex.h);
    $('select-electrode').value = ex.electrode;
    $('select-base').value = ex.base;
    setVal('input-nd', ex.nd);
    setVal('input-t-thick', ''); setVal('input-t-thin', '');
    if (ex.mode === 'inplane') {
        setVal('input-force', ex.force); setVal('input-angle', ex.angle);
        setVal('input-ex', ex.ex); setVal('input-ey', ex.ey);
    } else {
        setVal('input-shear', ex.shear); setVal('input-arm', ex.arm);
    }
    $('check-fatigue').checked = !!ex.fatigue;
    if (ex.fatigue) {
        setVal('input-ratio', ex.ratio);
        $('select-kfs').value = ex.kfs;
        setVal('input-kfs-custom', ex.kfsCustom);
        $('select-method').value = ex.method;
    }
    $('example-note').textContent = ex.note;
    refreshVisibility();
    updateUnits();
    calculate();
}

/* -- Fullscreen diagram toggle -------------------------------------- */
// Native Fullscreen API on the wrapper (label + button stay visible).

const requestFs = (el) => { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) f.call(el); };
const exitFs = () => { const f = document.exitFullscreen || document.webkitExitFullscreen; if (f) f.call(document); };
const currentFs = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function setupFullscreen() {
    document.querySelectorAll('.sim-chart-fullscreen-btn').forEach((btn) => {
        const wrap = btn.closest('.sim-chart-wrap');
        if (!wrap) return;
        btn.addEventListener('click', () => (currentFs() === wrap ? exitFs() : requestFs(wrap)));
    });
    const onChange = () => {
        document.querySelectorAll('.sim-chart-wrap').forEach((wrap) => {
            const on = currentFs() === wrap;
            const btn = wrap.querySelector('.sim-chart-fullscreen-btn');
            if (btn) { btn.classList.toggle('is-fullscreen', on); btn.setAttribute('aria-pressed', String(on)); }
        });
        calculate();
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
}

/* -- Event wiring ---------------------------------------------------- */

function wire() {
    document.querySelectorAll('.wj-live').forEach((el) => {
        el.addEventListener('input', schedule);
        el.addEventListener('change', schedule);
    });

    document.querySelectorAll('.wj-seg__btn').forEach((b) => {
        b.addEventListener('click', () => setMode(b.dataset.mode));
    });

    $('select-system').addEventListener('change', () => {
        const to = $('select-system').value;
        convertSystem(currentSystem, to);
        currentSystem = to;
        updateUnits();
        schedule();
    });

    $('select-example').addEventListener('change', () => applyExample($('select-example').value));
    $('btn-calculate').addEventListener('click', () => { refreshVisibility(); calculate({ scroll: true }); });
}

/* -- Init -------------------------------------------------------------- */

populateSelects();
buildPatternGrid();
setupDrag();
setupSymbolHover();
setupFullscreen();
wire();
$('select-example').value = DEFAULT_EXAMPLE;
applyExample(DEFAULT_EXAMPLE);

// Open the page with #selftest to run the physics validation suite (reference cases).
if (location.hash === '#selftest') {
    const r = core.runValidationSuite();
    console.log(`[welded-joints] validation: ${r.passed}/${r.total} passed`);
    console.table(r.results.map((x) => ({ test: x.name, actual: x.actual, expected: x.expected, ok: x.pass })));
}
