/**
 * welded-joints-plot.js - Welded Joints Analyzer
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - SVG rendering (diagram with stress map, AWS weld symbol, fatigue
 *     diagram, pattern thumbnails). Every function returns/sets markup only.
 *
 * WHAT DOES NOT GO HERE:
 *   - Physics (-> welded-joints-core.js), DOM reading, event handling
 *     (-> welded-joints-simulator.js)
 *
 * THEMING: colours that must follow light/dark mode are applied through CSS
 * classes (see css/welded-joints.css). Only the heat-map colours, which carry
 * meaning, are inline.
 *
 * Non-ASCII characters are written as \u escapes on purpose (encoding safety).
 */

'use strict';

export const VIEW_W = 760;
export const VIEW_H = 520;

const TAU = '\u03C4';
const P1 = '\u2032';   // prime
const P2 = '\u2033';   // double prime
const DOT = '\u00B7';

const C_DIRECT = '#3b82f6';
const C_TORS = '#f59e0b';
const C_SUM = '#ef4444';

/* -- Formatting helpers (also used by simulator.js) ----------- */

export function fmtNum(v, extra = 0) {
    if (!isFinite(v)) return '\u2014';
    const a = Math.abs(v);
    if (a >= 1e5) return v.toExponential(3).replace('e+', 'e');
    let d;
    if (a >= 1000) d = 0;
    else if (a >= 100) d = 1;
    else if (a >= 1) d = 2;
    else if (a >= 0.01) d = 3;
    else d = a === 0 ? 0 : 4;
    return v.toFixed(Math.max(0, d + extra));
}

/** Short label: 4 significant digits, no trailing zeros (25, 110.4, 0.375). */
export function fmtLabel(v) {
    if (!isFinite(v)) return '\u2014';
    return String(Number(v.toPrecision(4)));
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/** Leg size: 3/8 style fractions for US inches when close to n/16. */
export function fmtLeg(h, sys) {
    if (sys === 'US') {
        const k = Math.round(h * 16);
        if (k > 0 && Math.abs(h - k / 16) < 0.002) {
            const g = gcd(k, 16);
            const n = k / g, d = 16 / g;
            return d === 1 ? String(n) : `${n}/${d}`;
        }
    }
    return fmtLabel(h);
}

const r1 = (n) => Math.round(n * 10) / 10;

/* -- Heat map ------------------------------------------------- */
// t = tau / tau_allow. 1.0 is the allowable stress of the weld metal.
const STOPS = [
    [0.0, [56, 189, 248]],
    [0.4, [52, 211, 153]],
    [0.7, [250, 204, 21]],
    [1.0, [251, 146, 60]],
    [1.2, [239, 68, 68]]
];
const T_MAX = 1.2;

export function heatColor(t) {
    if (!isFinite(t)) t = 0;
    t = Math.max(0, Math.min(T_MAX, t));
    for (let i = 1; i < STOPS.length; i++) {
        if (t <= STOPS[i][0]) {
            const [t0, c0] = STOPS[i - 1];
            const [t1, c1] = STOPS[i];
            const u = (t - t0) / (t1 - t0);
            const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * u));
            return `rgb(${c[0]},${c[1]},${c[2]})`;
        }
    }
    return 'rgb(239,68,68)';
}

/* -- World <-> screen transform ------------------------------- */

export function makeTransform(segments) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    segments.forEach((s) => {
        minx = Math.min(minx, s.x1, s.x2); maxx = Math.max(maxx, s.x1, s.x2);
        miny = Math.min(miny, s.y1, s.y2); maxy = Math.max(maxy, s.y1, s.y2);
    });
    const bw = maxx - minx, bh = maxy - miny;
    // World window wide enough for the group AND the load handle.
    const ww = Math.max(2.9 * bh, 2.2 * bw, 1e-9);
    return { cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, s: VIEW_W / ww, minx, maxx, miny, maxy, bw, bh };
}

/* -- Main diagram --------------------------------------------- */

function arrowLine(x1, y1, x2, y2, cls, marker, w = 2.2) {
    return `<line class="${cls}" x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" stroke-width="${w}" marker-end="url(#${marker})"/>`;
}

function dimH(x1, x2, y, label) {
    return `<g class="wj-dim">
<line x1="${r1(x1)}" y1="${r1(y - 7)}" x2="${r1(x1)}" y2="${r1(y + 7)}"/>
<line x1="${r1(x2)}" y1="${r1(y - 7)}" x2="${r1(x2)}" y2="${r1(y + 7)}"/>
<line x1="${r1(x1)}" y1="${r1(y)}" x2="${r1(x2)}" y2="${r1(y)}"/>
<text class="wj-text wj-text--sm" x="${r1((x1 + x2) / 2)}" y="${r1(y + 18)}" text-anchor="middle">${label}</text></g>`;
}

function dimV(x, y1, y2, label) {
    const my = (y1 + y2) / 2;
    return `<g class="wj-dim">
<line x1="${r1(x - 7)}" y1="${r1(y1)}" x2="${r1(x + 7)}" y2="${r1(y1)}"/>
<line x1="${r1(x - 7)}" y1="${r1(y2)}" x2="${r1(x + 7)}" y2="${r1(y2)}"/>
<line x1="${r1(x)}" y1="${r1(y1)}" x2="${r1(x)}" y2="${r1(y2)}"/>
<text class="wj-text wj-text--sm" x="${r1(x - 10)}" y="${r1(my)}" text-anchor="middle" transform="rotate(-90 ${r1(x - 10)} ${r1(my)})">${label}</text></g>`;
}

/**
 * renderDiagram(svg, v)
 *   v.segments, v.analysis, v.endpoints, v.mode, v.tauAllow, v.h
 *   v.load      { ex, ey, angleDeg, label }       (in-plane)  /  { Vlabel, Mlabel } (bending)
 *   v.show      { map, vectors, dims }
 *   v.dimLabels { b, d, r }  (already formatted strings, may be undefined)
 *   v.units     { stress, length }
 * Returns the transform used (needed by the simulator for dragging).
 */
export function renderDiagram(svg, v) {
    const { segments, analysis, endpoints, mode, tauAllow, h, load, show, dimLabels = {}, units } = v;
    const props = analysis.props;
    const tf = makeTransform(segments);
    const X = (x) => VIEW_W / 2 + (x - tf.cx) * tf.s;
    const Y = (y) => VIEW_H / 2 - (y - tf.cy) * tf.s;
    const gx = X(props.xg), gy = Y(props.yg);
    const sw = Math.min(16, Math.max(4, h * tf.s));

    const out = [];

    /* defs: arrow heads + legend gradient */
    const stopsSvg = STOPS.map(([t]) => `<stop offset="${(t / T_MAX * 100).toFixed(1)}%" stop-color="${heatColor(t)}"/>`).join('');
    out.push(`<defs>
<marker id="wj-ah-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C_DIRECT}"/></marker>
<marker id="wj-ah-s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C_TORS}"/></marker>
<marker id="wj-ah-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C_SUM}"/></marker>
<marker id="wj-ah-f" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto"><path class="wj-ah-load" d="M0,0 L10,5 L0,10 z"/></marker>
<linearGradient id="wj-heat-grad" x1="0" y1="0" x2="1" y2="0">${stopsSvg}</linearGradient>
</defs>`);

    /* dimension lines */
    if (show.dims) {
        const L = X(tf.minx), R = X(tf.maxx), T = Y(tf.maxy), B = Y(tf.miny);
        if (dimLabels.b && tf.bw > 0) out.push(dimH(L, R, B + sw / 2 + 26, dimLabels.b));
        if (dimLabels.d && tf.bh > 0 && !dimLabels.r) out.push(dimV(L - sw / 2 - 26, B, T, dimLabels.d));
        if (dimLabels.r) out.push(`<text class="wj-text wj-text--sm" x="${r1(gx)}" y="${r1(B + sw / 2 + 24)}" text-anchor="middle">${dimLabels.r}</text>`);
    }

    /* welds: dark underlay + heat-coloured sub-lines */
    const bySeg = new Map();
    analysis.points.forEach((p) => {
        if (!bySeg.has(p.seg)) bySeg.set(p.seg, []);
        bySeg.get(p.seg).push(p);
    });
    const under = [], heat = [];
    segments.forEach((s, i) => {
        under.push(`<line class="wj-weld-under" data-run="${s.run}" x1="${r1(X(s.x1))}" y1="${r1(Y(s.y1))}" x2="${r1(X(s.x2))}" y2="${r1(Y(s.y2))}" stroke-width="${r1(sw + 5)}"/>`);
        const pts = bySeg.get(i) || [];
        for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k];
            const t = show.map ? ((a.tau + b.tau) / 2) / tauAllow : 0.35;
            const col = show.map ? heatColor(t) : 'var(--text-muted)';
            heat.push(`<line class="wj-weld" data-run="${s.run}" x1="${r1(X(a.x))}" y1="${r1(Y(a.y))}" x2="${r1(X(b.x))}" y2="${r1(Y(b.y))}" stroke="${col}" stroke-width="${r1(sw)}"/>`);
        }
    });
    out.push(`<g class="wj-welds">${under.join('')}${heat.join('')}</g>`);

    /* in-plane: moment arm + load arrow + drag handle */
    if (mode === 'inplane' && load) {
        const px = X(props.xg) + load.ex * tf.s;
        const py = Y(props.yg) - load.ey * tf.s;
        const th = (load.angleDeg * Math.PI) / 180;
        const dx = Math.cos(th), dy = -Math.sin(th);
        const len = 78;
        out.push(`<line class="wj-arm" x1="${r1(gx)}" y1="${r1(gy)}" x2="${r1(px)}" y2="${r1(py)}"/>`);
        const e = Math.hypot(load.ex, load.ey);
        if (e > 1e-9 && load.armLabel) {
            const lx2 = px + (gx - px) * 0.3, ly2 = py + (gy - py) * 0.3;
            out.push(`<text class="wj-text wj-text--sm" x="${r1(lx2)}" y="${r1(ly2 - 9)}" text-anchor="middle">${load.armLabel}</text>`);
        }
        out.push(arrowLine(px - dx * len, py - dy * len, px - dx * 9, py - dy * 9, 'wj-load-arrow', 'wj-ah-f', 3.2));
        out.push(`<text class="wj-text wj-text--strong" x="${r1(px - dx * len - dx * 8)}" y="${r1(py - dy * len - dy * 8 + 4)}" text-anchor="${dx > 0.3 ? 'end' : dx < -0.3 ? 'start' : 'middle'}">${load.label || 'F'}</text>`);
        out.push(`<g class="wj-handle" data-drag="load" tabindex="0" role="slider" aria-label="Load application point, drag to move">
<circle class="wj-handle__hit" cx="${r1(px)}" cy="${r1(py)}" r="24"/>
<circle class="wj-handle__ring" cx="${r1(px)}" cy="${r1(py)}" r="12"/>
<circle class="wj-handle__dot" cx="${r1(px)}" cy="${r1(py)}" r="5"/></g>`);
    }

    /* bending: V arrow and M arc beside the group */
    if (mode === 'bending' && load) {
        const bx = X(tf.maxx) + sw / 2 + 80;
        const by = gy;
        out.push(arrowLine(bx, by - 62, bx, by + 18, 'wj-load-arrow', 'wj-ah-f', 3.2));
        out.push(`<text class="wj-text wj-text--strong" x="${r1(bx + 12)}" y="${r1(by - 40)}">${load.Vlabel || 'V'}</text>`);
        const rr = 24, cx = bx, cy = by + 66;
        out.push(`<path class="wj-moment" d="M ${r1(cx - rr)} ${r1(cy)} A ${rr} ${rr} 0 1 1 ${r1(cx)} ${r1(cy + rr)}" marker-end="url(#wj-ah-f)"/>`);
        out.push(`<text class="wj-text wj-text--strong" x="${r1(cx + rr + 8)}" y="${r1(cy + 4)}">${load.Mlabel || 'M'}</text>`);
    }

    /* centroid G */
    out.push(`<g class="wj-g"><line x1="${r1(gx - 9)}" y1="${r1(gy)}" x2="${r1(gx + 9)}" y2="${r1(gy)}"/><line x1="${r1(gx)}" y1="${r1(gy - 9)}" x2="${r1(gx)}" y2="${r1(gy + 9)}"/><circle cx="${r1(gx)}" cy="${r1(gy)}" r="4.5"/></g>`);
    out.push(`<text class="wj-text wj-text--strong" x="${r1(gx + 10)}" y="${r1(gy - 9)}">G</text>`);

    /* stress vectors at labelled points */
    if (show.vectors && endpoints.length) {
        const tmax = Math.max(...endpoints.map((p) => p.tau), 1e-12);
        const k = 66 / tmax;
        endpoints.forEach((p) => {
            const sx = X(p.x), sy = Y(p.y);
            if (mode === 'inplane') {
                const a1 = [p.v1[0] * k, -p.v1[1] * k];
                const a2 = [p.v2[0] * k, -p.v2[1] * k];
                const sum = [a1[0] + a2[0], a1[1] + a2[1]];
                if (Math.hypot(...a1) > 6) out.push(arrowLine(sx, sy, sx + a1[0], sy + a1[1], 'wj-vec wj-vec--p', 'wj-ah-p', 2));
                if (Math.hypot(...a2) > 6) out.push(arrowLine(sx, sy, sx + a2[0], sy + a2[1], 'wj-vec wj-vec--s', 'wj-ah-s', 2));
                out.push(arrowLine(sx, sy, sx + sum[0], sy + sum[1], 'wj-vec wj-vec--r', 'wj-ah-r', 2.6));
            } else {
                const a1 = [0, -p.v1[1] * k];
                if (Math.hypot(...a1) > 6) out.push(arrowLine(sx, sy, sx + a1[0], sy + a1[1], 'wj-vec wj-vec--p', 'wj-ah-p', 2));
                const rad = Math.max(3, Math.min(14, (p.tau2 / tmax) * 14));
                if (p.tau2 > 1e-9) {
                    const pos = p.v2[0] >= 0;
                    out.push(`<g class="wj-vec wj-vec--s"><circle cx="${r1(sx + 20)}" cy="${r1(sy)}" r="${r1(rad)}" fill="none" stroke-width="2"/>${pos
                        ? `<circle cx="${r1(sx + 20)}" cy="${r1(sy)}" r="${r1(Math.max(1.5, rad / 4))}" fill="${C_TORS}" stroke="none"/>`
                        : `<line x1="${r1(sx + 20 - rad * 0.65)}" y1="${r1(sy - rad * 0.65)}" x2="${r1(sx + 20 + rad * 0.65)}" y2="${r1(sy + rad * 0.65)}" stroke-width="2"/><line x1="${r1(sx + 20 - rad * 0.65)}" y1="${r1(sy + rad * 0.65)}" x2="${r1(sx + 20 + rad * 0.65)}" y2="${r1(sy - rad * 0.65)}" stroke-width="2"/>`}</g>`);
                }
            }
        });
    }

    /* point badges A, B, C ... */
    endpoints.forEach((p) => {
        const sx = X(p.x), sy = Y(p.y);
        let ux = sx - gx, uy = sy - gy;
        const n = Math.hypot(ux, uy);
        if (n < 1e-6) { ux = 0; uy = -1; } else { ux /= n; uy /= n; }
        const bx = sx + ux * (sw / 2 + 16), by = sy + uy * (sw / 2 + 16);
        out.push(`<g class="wj-badge"><circle cx="${r1(bx)}" cy="${r1(by)}" r="10"/><text x="${r1(bx)}" y="${r1(by + 4)}" text-anchor="middle">${p.label}</text></g>`);
    });

    /* critical point ring */
    const c = analysis.critical;
    out.push(`<g class="wj-crit"><circle cx="${r1(X(c.x))}" cy="${r1(Y(c.y))}" r="${r1(sw / 2 + 7)}"/></g>`);

    /* legends */
    const lx = 24, ly = VIEW_H - 44, lw = 260;
    const tick = lx + (lw * 1.0) / T_MAX;
    out.push(`<g class="wj-legend">
<text class="wj-text wj-text--sm" x="${lx}" y="${ly - 8}">${show.map ? `${TAU} / ${TAU}allow  (1.0 = allowable, weld metal)` : 'Stress map off'}</text>
<rect x="${lx}" y="${ly}" width="${lw}" height="10" rx="5" fill="url(#wj-heat-grad)" opacity="${show.map ? 1 : 0.25}"/>
<line class="wj-legend__tick" x1="${r1(tick)}" y1="${ly - 3}" x2="${r1(tick)}" y2="${ly + 13}"/>
<text class="wj-text wj-text--xs" x="${lx}" y="${ly + 26}">0</text>
<text class="wj-text wj-text--xs" x="${r1(tick)}" y="${ly + 26}" text-anchor="middle">1.0</text>
<text class="wj-text wj-text--xs" x="${lx + lw}" y="${ly + 26}" text-anchor="end">1.2+</text></g>`);

    if (show.vectors) {
        const vx = VIEW_W - 300, vy = 26;
        const rows = mode === 'inplane'
            ? [[C_DIRECT, `${TAU}${P1} direct shear`], [C_TORS, `${TAU}${P2} torsion`], [C_SUM, `${TAU} resultant`]]
            : [[C_DIRECT, `${TAU}${P1} direct shear`], [C_TORS, `${TAU}${P2} bending (\u2299 / \u2297 out of plane)`]];
        out.push(`<g class="wj-legend">${rows.map(([col, t], i) => `<line x1="${vx}" y1="${vy + i * 18}" x2="${vx + 22}" y2="${vy + i * 18}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><text class="wj-text wj-text--xs" x="${vx + 30}" y="${vy + i * 18 + 4}">${t}</text>`).join('')}</g>`);
    }

    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.innerHTML = out.join('');
    return tf;
}

/* -- AWS weld symbol ------------------------------------------ */

function triangle(x, y, up, size) {
    const yy = up ? y - size : y + size;
    return `M ${x} ${y} L ${x} ${yy} L ${x + size} ${y} Z`;
}

/**
 * weldSymbolSvg(spec, opt)
 *   spec : core weldSymbolSpec() (size/length already formatted by caller
 *          into spec.sizeText / spec.lengthText)
 *   opt  : { tail }  specification text drawn in the tail (e.g. "E70xx")
 * Standard AWS A2.4 layout: arrow side = below the reference line,
 * other side = above it, size to the LEFT of the triangle, length to the RIGHT.
 */
export function weldSymbolSvg(spec, opt = {}) {
    const refY = 66, x0 = 78, x1 = 250, tx = 150, sz = 20;
    const p = [];
    p.push(`<svg class="wj-sym" viewBox="0 0 340 140" role="img" aria-label="AWS fillet weld symbol" xmlns="http://www.w3.org/2000/svg">`);
    p.push(`<defs><marker id="wj-sym-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="wj-sym__fill" d="M0,0 L10,5 L0,10 z"/></marker></defs>`);
    // reference line + tail
    p.push(`<line class="wj-sym__line" x1="${x0}" y1="${refY}" x2="${x1}" y2="${refY}"/>`);
    if (opt.tail) {
        p.push(`<path class="wj-sym__line wj-sym__line--thin" d="M ${x1} ${refY} L ${x1 + 14} ${refY - 11} M ${x1} ${refY} L ${x1 + 14} ${refY + 11}"/>`);
        p.push(`<text class="wj-sym__text wj-sym__text--small" x="${x1 + 20}" y="${refY + 4}">${opt.tail}</text>`);
    }
    // arrow
    p.push(`<line class="wj-sym__line" x1="${x0}" y1="${refY}" x2="${x0 - 46}" y2="${refY + 56}" marker-end="url(#wj-sym-ah)"/>`);
    // fillet triangles
    if (spec.arrowSide) {
        p.push(`<path class="wj-sym__fill wj-sym__fill--tri" d="${triangle(tx, refY, false, sz)}"/>`);
        p.push(`<text class="wj-sym__text" x="${tx - 8}" y="${refY + sz - 3}" text-anchor="end">${spec.sizeText}</text>`);
        if (spec.lengthText) p.push(`<text class="wj-sym__text" x="${tx + sz + 8}" y="${refY + sz - 3}">${spec.lengthText}</text>`);
    }
    if (spec.otherSide) {
        p.push(`<path class="wj-sym__fill wj-sym__fill--tri" d="${triangle(tx, refY, true, sz)}"/>`);
        p.push(`<text class="wj-sym__text" x="${tx - 8}" y="${refY - 8}" text-anchor="end">${spec.sizeText}</text>`);
        if (spec.lengthText) p.push(`<text class="wj-sym__text" x="${tx + sz + 8}" y="${refY - 8}">${spec.lengthText}</text>`);
    }
    // all-around circle at the arrow/reference junction
    if (spec.allAround) p.push(`<circle class="wj-sym__line wj-sym__line--thin" cx="${x0}" cy="${refY}" r="8" fill="none"/>`);
    // field-weld flag
    if (spec.field) {
        p.push(`<line class="wj-sym__line wj-sym__line--thin" x1="${x0}" y1="${refY}" x2="${x0}" y2="${refY - 34}"/>`);
        p.push(`<path class="wj-sym__fill" d="M ${x0} ${refY - 34} L ${x0} ${refY - 20} L ${x0 + 16} ${refY - 27} Z"/>`);
    }
    p.push('</svg>');
    return p.join('');
}

/* -- Fatigue diagram (tau_m vs tau_a) ------------------------- */

/**
 * renderFatigueDiagram(svg, f)
 *   f: { Sse, Ssu, method, tauA, tauM, nf, curve:[{tm,ta}], unit }
 */
export function renderFatigueDiagram(svg, f) {
    const W = 520, H = 340, m = { l: 62, r: 20, t: 22, b: 48 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const xMax = f.Ssu * 1.05;
    const yMax = f.Sse * 1.15;
    const X = (v) => m.l + (v / xMax) * pw;
    const Y = (v) => m.t + ph - (v / yMax) * ph;
    const out = [];

    // grid + axes ticks
    const nT = 4;
    for (let i = 0; i <= nT; i++) {
        const vx = (xMax * i) / nT, vy = (yMax * i) / nT;
        out.push(`<line class="wj-grid" x1="${r1(X(vx))}" y1="${m.t}" x2="${r1(X(vx))}" y2="${m.t + ph}"/>`);
        out.push(`<line class="wj-grid" x1="${m.l}" y1="${r1(Y(vy))}" x2="${m.l + pw}" y2="${r1(Y(vy))}"/>`);
        out.push(`<text class="wj-text wj-text--xs" x="${r1(X(vx))}" y="${m.t + ph + 16}" text-anchor="middle">${fmtNum(vx)}</text>`);
        out.push(`<text class="wj-text wj-text--xs" x="${m.l - 8}" y="${r1(Y(vy) + 4)}" text-anchor="end">${fmtNum(vy)}</text>`);
    }
    out.push(`<line class="wj-axis" x1="${m.l}" y1="${m.t + ph}" x2="${m.l + pw}" y2="${m.t + ph}"/><line class="wj-axis" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ph}"/>`);
    out.push(`<text class="wj-text wj-text--sm" x="${r1(m.l + pw / 2)}" y="${H - 8}" text-anchor="middle">Mean shear ${TAU}m (${f.unit})</text>`);
    out.push(`<text class="wj-text wj-text--sm" x="14" y="${r1(m.t + ph / 2)}" text-anchor="middle" transform="rotate(-90 14 ${r1(m.t + ph / 2)})">Alternating shear ${TAU}a (${f.unit})</text>`);

    // safe region + limit curve
    const pts = f.curve.map((c) => `${r1(X(c.tm))},${r1(Y(c.ta))}`);
    out.push(`<polygon class="wj-safe" points="${r1(X(0))},${r1(Y(0))} ${pts.join(' ')} ${r1(X(f.Ssu))},${r1(Y(0))}"/>`);
    out.push(`<polyline class="wj-curve" points="${pts.join(' ')}"/>`);

    // load line from the origin through the operating point, extended to the limit
    const nf = isFinite(f.nf) ? f.nf : 1;
    const hit = { tm: f.tauM * nf, ta: f.tauA * nf };
    if (f.tauA > 0 || f.tauM > 0) {
        out.push(`<line class="wj-loadline" x1="${r1(X(0))}" y1="${r1(Y(0))}" x2="${r1(X(Math.min(hit.tm, xMax)))}" y2="${r1(Y(Math.min(hit.ta, yMax)))}"/>`);
        out.push(`<circle class="wj-hit" cx="${r1(X(Math.min(hit.tm, xMax)))}" cy="${r1(Y(Math.min(hit.ta, yMax)))}" r="5"/>`);
    }
    const ok = f.nf >= 1;
    out.push(`<circle class="wj-op ${ok ? 'wj-op--ok' : 'wj-op--fail'}" cx="${r1(X(f.tauM))}" cy="${r1(Y(f.tauA))}" r="7"/>`);
    out.push(`<text class="wj-text wj-text--sm" x="${r1(X(f.tauM) + 12)}" y="${r1(Y(f.tauA) - 10)}">nf = ${isFinite(f.nf) ? fmtNum(f.nf) : '\u221E'}</text>`);
    out.push(`<text class="wj-text wj-text--xs" x="${r1(X(0) + 8)}" y="${r1(Y(f.Sse) - 6)}">Sse = ${fmtNum(f.Sse)}</text>`);
    out.push(`<text class="wj-text wj-text--xs" x="${r1(X(f.Ssu) - 4)}" y="${r1(Y(0) - 8)}" text-anchor="end">Ssu = ${fmtNum(f.Ssu)}</text>`);
    out.push(`<text class="wj-text wj-text--xs" x="${r1(m.l + pw - 4)}" y="${m.t + 12}" text-anchor="end">${f.method === 'goodman' ? 'Modified Goodman' : 'Gerber'} (safe below the curve)</text>`);

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = out.join('');
}

/* -- Pattern thumbnails --------------------------------------- */

export function patternThumbSvg(segments) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    segments.forEach((s) => {
        minx = Math.min(minx, s.x1, s.x2); maxx = Math.max(maxx, s.x1, s.x2);
        miny = Math.min(miny, s.y1, s.y2); maxy = Math.max(maxy, s.y1, s.y2);
    });
    const dim = Math.max(maxx - minx, maxy - miny, 1e-9);
    const k = 30 / dim;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const lines = segments.map((s) =>
        `<line x1="${r1(22 + (s.x1 - cx) * k)}" y1="${r1(22 - (s.y1 - cy) * k)}" x2="${r1(22 + (s.x2 - cx) * k)}" y2="${r1(22 - (s.y2 - cy) * k)}"/>`
    ).join('');
    return `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none">${lines}</svg>`;
}

/* Exposed for the simulator's tests and tooltips */
export const SYMBOLS = { TAU, P1, P2, DOT };
