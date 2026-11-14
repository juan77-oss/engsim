/**
 * pressure-vessel-plot.js
 * Drawing layer. Every function returns an SVG markup string and touches no DOM,
 * so it can be tested in Node. simulator.js injects the strings with innerHTML.
 * Colours use the platform CSS variables so light/dark themes keep working.
 */

const C_OK = 'var(--color-success, #16a34a)';
const C_WARN = 'var(--color-warning, #d97706)';
const C_BAD = 'var(--color-danger, #dc2626)';
const C_ACCENT = 'var(--brand-accent, #3b82f6)';
const C_TEXT = 'var(--text-primary, #e5e7eb)';
const C_MUTED = 'var(--text-secondary, #9ca3af)';
const C_LINE = 'var(--border-strong, #4b5563)';
const FONT = 'var(--font-mono, monospace)';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n1 = (x) => (Math.round(x * 10) / 10).toString();
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Colour for a utilization ratio (demand / capacity). */
export function utilColor(u) {
  if (!Number.isFinite(u)) return C_MUTED;
  if (u < 0.85) return C_OK;
  if (u <= 1) return C_WARN;
  return C_BAD;
}

/** Blue (low) to red (high) colour map, x in [0, 1]. */
export function stressColor(x) {
  const h = 240 - 240 * clamp(x, 0, 1);
  return `hsl(${Math.round(h)}, 72%, 52%)`;
}

function arrow(x1, y1, x2, y2, color, width = 2, extra = '') {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const hl = 8 + width;
  const hw = 4 + width * 0.6;
  const bx = x2 - Math.cos(ang) * hl;
  const by = y2 - Math.sin(ang) * hl;
  const px = Math.cos(ang + Math.PI / 2) * hw;
  const py = Math.sin(ang + Math.PI / 2) * hw;
  return `<g ${extra}><line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(bx)}" y2="${n1(by)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>` +
    `<polygon points="${n1(x2)},${n1(y2)} ${n1(bx + px)},${n1(by + py)} ${n1(bx - px)},${n1(by - py)}" fill="${color}"/></g>`;
}

function text(x, y, s, opts = {}) {
  const { size = 12, anchor = 'start', fill = C_TEXT, weight = 400 } = opts;
  return `<text x="${n1(x)}" y="${n1(y)}" font-size="${size}" text-anchor="${anchor}" fill="${fill}" font-weight="${weight}" font-family="${FONT}">${esc(s)}</text>`;
}

/* ------------------------------------------------------------------ *
 * Vessel cross-section with animated pressure
 * ------------------------------------------------------------------ */

/**
 * shape: 'cylinder' | 'sphere'
 * util:  demand / capacity of the wall (colours the wall)
 * pFrac: pressure as a fraction of the slider maximum (sizes the arrows)
 * labels: { P, hoop, long } already formatted with units
 */
export function vesselSectionSVG({ shape = 'cylinder', Ri, t, util, pFrac = 0.5, labels }) {
  const W = 640, H = 360, cx = 175, cy = 175, Ro = 120;
  let tpx = (Ro * t) / (Ri + t);
  let exaggerated = false;
  if (tpx < 8) { tpx = 8; exaggerated = true; }
  const Rin = Ro - tpx;
  const wall = utilColor(util);
  const pf = clamp(pFrac, 0.15, 1);

  let out = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="pv-svg" role="img" aria-label="Pressure vessel cross-section with pressure and wall stresses">`;

  // wall ring (even-odd) and interior
  out += `<path fill-rule="evenodd" d="M ${cx - Ro} ${cy} a ${Ro} ${Ro} 0 1 0 ${2 * Ro} 0 a ${Ro} ${Ro} 0 1 0 ${-2 * Ro} 0 Z M ${cx - Rin} ${cy} a ${Rin} ${Rin} 0 1 1 ${2 * Rin} 0 a ${Rin} ${Rin} 0 1 1 ${-2 * Rin} 0 Z" fill="${wall}" opacity="0.9"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${n1(Rin)}" fill="${C_ACCENT}" opacity="0.12"/>`;

  // pressure arrows (animated by CSS)
  const nA = 14;
  for (let i = 0; i < nA; i++) {
    const ang = (i * 2 * Math.PI) / nA;
    const r0 = Rin * 0.18;
    const r1 = Rin * (0.3 + 0.62 * pf);
    const x1 = cx + Math.cos(ang) * r0, y1 = cy + Math.sin(ang) * r0;
    const x2 = cx + Math.cos(ang) * r1, y2 = cy + Math.sin(ang) * r1;
    out += arrow(x1, y1, x2, y2, C_ACCENT, 2, `class="pv-parrow" style="animation-delay:${(i % 4) * 0.18}s"`);
  }

  // dashed cut and hoop stress arrows on the wall
  out += `<line x1="${cx - Ro - 14}" y1="${cy}" x2="${cx + Ro + 14}" y2="${cy}" stroke="${C_MUTED}" stroke-width="1" stroke-dasharray="5 4"/>`;
  for (const sx of [-1, 1]) {
    const x = cx + sx * (Rin + tpx / 2);
    out += arrow(x, cy, x, cy - 42, C_TEXT, 2.5);
    out += arrow(x, cy, x, cy + 42, C_TEXT, 2.5);
  }
  out += text(cx + Ro + 20, cy - 6, shape === 'sphere' ? '\u03C3' : '\u03C3\u03B8', { size: 15, weight: 700 });
  out += text(cx - Ro - 20, cy - 6, shape === 'sphere' ? '\u03C3' : '\u03C3\u03B8', { size: 15, weight: 700, anchor: 'end' });

  // right side: side view (cylinder) or half sphere
  if (shape === 'sphere') {
    const cx2 = 480, R2 = 78;
    const t2 = Math.max(6, (R2 * t) / (Ri + t));
    out += `<path fill-rule="evenodd" d="M ${cx2 - R2} ${cy} a ${R2} ${R2} 0 1 0 ${2 * R2} 0 a ${R2} ${R2} 0 1 0 ${-2 * R2} 0 Z M ${cx2 - R2 + t2} ${cy} a ${R2 - t2} ${R2 - t2} 0 1 1 ${2 * (R2 - t2)} 0 a ${R2 - t2} ${R2 - t2} 0 1 1 ${-2 * (R2 - t2)} 0 Z" fill="${wall}" opacity="0.9"/>`;
    out += `<circle cx="${cx2}" cy="${cy}" r="${R2 - t2}" fill="${C_ACCENT}" opacity="0.12"/>`;
    out += `<line x1="${cx2 - R2 - 10}" y1="${cy}" x2="${cx2 + R2 + 10}" y2="${cy}" stroke="${C_MUTED}" stroke-width="1" stroke-dasharray="5 4"/>`;
    out += arrow(cx2, cy - R2 + t2 / 2, cx2 + 0.01, cy - R2 - 30, C_TEXT, 2.5);
    out += arrow(cx2, cy + R2 - t2 / 2, cx2 + 0.01, cy + R2 + 30, C_TEXT, 2.5);
    out += text(cx2, cy + R2 + 52, 'same stress in every direction', { size: 11, anchor: 'middle', fill: C_MUTED });
  } else {
    const x0 = 385, x1 = 600, yTop = cy - 70, yBot = cy + 70;
    const ts = Math.max(5, tpx * 0.55);
    out += `<rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${yBot - yTop}" rx="6" fill="${wall}" opacity="0.9"/>`;
    out += `<rect x="${x0 + ts}" y="${yTop + ts}" width="${x1 - x0 - 2 * ts}" height="${yBot - yTop - 2 * ts}" rx="3" fill="var(--bg-card, #111827)"/>`;
    out += `<rect x="${x0 + ts}" y="${yTop + ts}" width="${x1 - x0 - 2 * ts}" height="${yBot - yTop - 2 * ts}" rx="3" fill="${C_ACCENT}" opacity="0.12"/>`;
    for (let i = 0; i < 3; i++) {
      const y = cy - 36 + i * 36;
      out += arrow(x0 + 40, y, x0 + 40 + 60 * pf + 18, y, C_ACCENT, 2, `class="pv-parrow" style="animation-delay:${i * 0.2}s"`);
    }
    out += `<line x1="${x0 + 28}" y1="${yTop - 12}" x2="${x0 + 28}" y2="${yBot + 12}" stroke="${C_MUTED}" stroke-width="1" stroke-dasharray="5 4"/>`;
    out += arrow(x0 + 28, yTop + ts / 2, x0 + 4, yTop + ts / 2, C_TEXT, 2.5);
    out += arrow(x0 + 28, yBot - ts / 2, x0 + 4, yBot - ts / 2, C_TEXT, 2.5);
    out += text(x0 - 8, yTop - 6, '\u03C3z', { size: 15, weight: 700, anchor: 'end' });
    out += text((x0 + x1) / 2, yBot + 28, 'side view: end force on the wall', { size: 11, anchor: 'middle', fill: C_MUTED });
  }

  // labels
  out += text(18, 28, labels.P, { size: 13, weight: 700 });
  out += text(18, 48, labels.hoop, { size: 12, fill: C_MUTED });
  if (labels.long) out += text(18, 66, labels.long, { size: 12, fill: C_MUTED });
  if (exaggerated) out += text(W - 14, H - 12, 'wall thickness exaggerated for visibility', { size: 10.5, anchor: 'end', fill: C_MUTED });
  out += text(cx, H - 12, 'cross-section', { size: 11, anchor: 'middle', fill: C_MUTED });
  out += '</svg>';
  return out;
}

/* ------------------------------------------------------------------ *
 * Thick wall: coloured ring and Lame profile chart
 * ------------------------------------------------------------------ */

function niceTicks(min, max, n = 5) {
  const span = max - min || 1;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return ticks;
}

/**
 * Ring coloured by hoop stress. points come from lameProfile (US units).
 * probeFrac in [0, 1] places the dashed probe circle across the wall.
 */
export function lameRingSVG({ points, a, b, probeFrac = 0, legend }) {
  const W = 260, H = 290, cx = 130, cy = 125, Ro = 108;
  const Rin = (Ro * a) / b;
  const ths = points.map((p) => p.sigmaTheta);
  const lo = Math.min(...ths), hi = Math.max(...ths);
  const span = hi - lo || 1;
  const nSeg = 48;
  let out = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="pv-svg" role="img" aria-label="Thick-wall cylinder coloured by hoop stress">`;
  const stepPx = (Ro - Rin) / nSeg;
  for (let i = 0; i < nSeg; i++) {
    const rPx = Rin + (i + 0.5) * stepPx;
    const rReal = a + ((i + 0.5) / nSeg) * (b - a);
    // linear interpolation of hoop stress at rReal
    const k = ((rReal - a) / (b - a)) * (points.length - 1);
    const i0 = Math.floor(k), i1 = Math.min(points.length - 1, i0 + 1);
    const s = points[i0].sigmaTheta + (points[i1].sigmaTheta - points[i0].sigmaTheta) * (k - i0);
    out += `<circle cx="${cx}" cy="${cy}" r="${n1(rPx)}" fill="none" stroke="${stressColor((s - lo) / span)}" stroke-width="${n1(stepPx + 0.8)}"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${n1(Rin)}" fill="${C_ACCENT}" opacity="0.1"/>`;
  const rp = Rin + clamp(probeFrac, 0, 1) * (Ro - Rin);
  out += `<circle cx="${cx}" cy="${cy}" r="${n1(rp)}" fill="none" stroke="${C_TEXT}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
  // colour bar
  const bx = 30, bw = W - 60, by = 258;
  for (let i = 0; i < 40; i++) {
    out += `<rect x="${n1(bx + (bw / 40) * i)}" y="${by}" width="${n1(bw / 40 + 0.6)}" height="10" fill="${stressColor(i / 39)}"/>`;
  }
  out += text(bx, by + 24, legend.lo, { size: 10.5, fill: C_MUTED });
  out += text(bx + bw, by + 24, legend.hi, { size: 10.5, fill: C_MUTED, anchor: 'end' });
  out += text(W / 2, by - 6, legend.title, { size: 10.5, fill: C_MUTED, anchor: 'middle' });
  out += '</svg>';
  return out;
}

/**
 * Stress versus radius. sf and lf convert US stress and length to display units.
 */
export function lameChartSVG({ points, a, b, probeFrac = 0, sf = 1, lf = 1, allow = null, fmtS, fmtL, units }) {
  const W = 560, H = 340, m = { l: 66, r: 16, t: 46, b: 48 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = [];
  for (const p of points) vals.push(p.sigmaTheta * sf, p.sigmaR * sf, p.sigmaZ * sf);
  if (allow !== null) vals.push(allow * sf);
  let ymin = Math.min(0, ...vals), ymax = Math.max(0, ...vals);
  const pad = (ymax - ymin) * 0.08 || 1;
  ymin -= ymin < 0 ? pad : 0; ymax += pad;
  const X = (r) => m.l + ((r - a) / (b - a)) * iw;
  const Y = (v) => m.t + (1 - (v - ymin) / (ymax - ymin)) * ih;

  let out = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="pv-svg" role="img" aria-label="Radial, hoop and axial stress across the wall thickness">`;
  for (const v of niceTicks(ymin, ymax, 5)) {
    out += `<line x1="${m.l}" y1="${n1(Y(v))}" x2="${W - m.r}" y2="${n1(Y(v))}" stroke="${C_LINE}" stroke-width="${v === 0 ? 1.4 : 0.5}" opacity="${v === 0 ? 0.9 : 0.4}"/>`;
    out += text(m.l - 8, Y(v) + 4, fmtS(v / sf), { size: 10.5, fill: C_MUTED, anchor: 'end' });
  }
  const series = [
    ['sigmaTheta', C_ACCENT, '\u03C3\u03B8 hoop', ''],
    ['sigmaR', C_WARN, '\u03C3r radial', ''],
    ['sigmaZ', C_MUTED, '\u03C3z axial', '6 4']
  ];
  for (const [key, col, , dash] of series) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'} ${n1(X(a + ((b - a) * i) / (points.length - 1)))} ${n1(Y(p[key] * sf))}`).join(' ');
    out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`;
  }
  if (allow !== null) {
    out += `<line x1="${m.l}" y1="${n1(Y(allow * sf))}" x2="${W - m.r}" y2="${n1(Y(allow * sf))}" stroke="${C_BAD}" stroke-width="1.4" stroke-dasharray="3 4"/>`;
    out += text(W - m.r - 4, Y(allow * sf) - 5, 'S\u00B7E', { size: 10.5, fill: C_BAD, anchor: 'end' });
  }
  // probe
  const rp = a + clamp(probeFrac, 0, 1) * (b - a);
  const pp = points.length - 1;
  const kk = clamp(probeFrac, 0, 1) * pp;
  const i0 = Math.floor(kk), i1 = Math.min(pp, i0 + 1);
  out += `<line x1="${n1(X(rp))}" y1="${m.t}" x2="${n1(X(rp))}" y2="${m.t + ih}" stroke="${C_TEXT}" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>`;
  for (const [key, col] of series) {
    const v = points[i0][key] + (points[i1][key] - points[i0][key]) * (kk - i0);
    out += `<circle cx="${n1(X(rp))}" cy="${n1(Y(v * sf))}" r="4.5" fill="${col}" stroke="var(--bg-card, #111827)" stroke-width="1.5"/>`;
  }
  // x axis
  out += `<line x1="${m.l}" y1="${m.t + ih}" x2="${W - m.r}" y2="${m.t + ih}" stroke="${C_LINE}" stroke-width="1.2"/>`;
  out += text(m.l, H - 26, fmtL(a), { size: 10.5, fill: C_MUTED, anchor: 'middle' });
  out += text(W - m.r, H - 26, fmtL(b), { size: 10.5, fill: C_MUTED, anchor: 'middle' });
  out += text(X(rp), H - 26, fmtL(rp), { size: 10.5, fill: C_TEXT, anchor: 'middle' });
  out += text(m.l + iw / 2, H - 8, `radius r (${units.length})`, { size: 11, fill: C_MUTED, anchor: 'middle' });
  out += text(m.l - 56, 14, `stress (${units.stress})`, { size: 11, fill: C_MUTED });
  // legend
  let lx = m.l + 8;
  for (const [, col, name, dash] of series) {
    out += `<line x1="${lx}" y1="${m.t - 16}" x2="${lx + 22}" y2="${m.t - 16}" stroke="${col}" stroke-width="2.4" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
    out += text(lx + 27, m.t - 12, name, { size: 10.5, fill: C_MUTED });
    lx += 112;
  }
  out += '</svg>';
  return out;
}

/* ------------------------------------------------------------------ *
 * Flange cross-section with load arrows
 * ------------------------------------------------------------------ */

/**
 * Half cross-section of a ring flange, drawn to scale in the radial direction.
 * g: { A, B, C, G, gOD, gID, t, d } geometry in US units
 * loads: { W, HD, HT, HG } in lbf; arms: { hD, hT, hG } in inches
 * labels: preformatted strings { W, HD, HT, HG, Mo }
 */
export function flangeSVG({ g, loads, arms, labels, util }) {
  const Wd = 640, Ht = 360;
  const rLeft = g.B / 2 - 0.35 * ((g.A - g.B) / 2);
  const rRight = g.A / 2 + 0.05 * ((g.A - g.B) / 2);
  const s = 470 / (rRight - rLeft);
  const X = (r) => 90 + (r - rLeft) * s;
  const blockTop = 120;
  const h = clamp(g.t * s, 36, 130);
  const color = utilColor(util);
  const gasketH = 9;

  let out = `<svg viewBox="0 0 ${Wd} ${Ht}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="pv-svg" role="img" aria-label="Bolted ring flange cross-section with bolt load and hydrostatic end force arrows">`;
  // mating flange (ghost)
  const yMate = blockTop + h + gasketH;
  out += `<rect x="${n1(X(g.B / 2))}" y="${n1(yMate)}" width="${n1((g.A / 2 - g.B / 2) * s)}" height="${n1(Math.min(h, 60))}" fill="${C_LINE}" opacity="0.25" rx="3"/>`;
  // flange block
  out += `<rect x="${n1(X(g.B / 2))}" y="${blockTop}" width="${n1((g.A / 2 - g.B / 2) * s)}" height="${n1(h)}" fill="${color}" opacity="0.85" rx="3"/>`;
  out += `<line x1="${n1(X(g.B / 2))}" y1="${blockTop - 12}" x2="${n1(X(g.B / 2))}" y2="${blockTop + h + 80}" stroke="${C_MUTED}" stroke-width="1" stroke-dasharray="5 4"/>`;
  out += text(X(g.B / 2) - 6, blockTop - 16, 'bore', { size: 10.5, fill: C_MUTED, anchor: 'end' });
  // gasket
  out += `<rect x="${n1(X(g.gID / 2))}" y="${blockTop + h}" width="${n1(((g.gOD - g.gID) / 2) * s)}" height="${gasketH}" fill="${C_ACCENT}" opacity="0.9"/>`;
  // bolt
  const bw = clamp(g.d * s, 7, 22);
  const xb = X(g.C / 2);
  out += `<rect x="${n1(xb - bw / 2)}" y="${blockTop - 18}" width="${n1(bw)}" height="${n1(h + gasketH + Math.min(h, 60) + 36)}" fill="${C_TEXT}" opacity="0.55" rx="2"/>`;
  out += `<rect x="${n1(xb - bw)}" y="${blockTop - 30}" width="${n1(bw * 2)}" height="12" fill="${C_TEXT}" opacity="0.8" rx="2"/>`;
  // arrows: bolt load down at the top, three upward loads below
  const maxF = Math.max(loads.W, loads.HD, loads.HT, loads.HG, 1);
  const L = (f) => 28 + 62 * (Math.max(f, 0) / maxF);
  out += arrow(xb, blockTop - 100, xb, blockTop - 34, C_BAD, 3);
  out += text(xb + 10, blockTop - 78, labels.W, { size: 11.5, weight: 700, fill: C_BAD });
  const yb = blockTop + h + gasketH + Math.min(h, 60) + 6;
  const ups = [
    { r: g.B / 2 + 0.0001, f: loads.HD, name: 'HD', col: C_OK },
    { r: g.C / 2 - arms.hT, f: loads.HT, name: 'HT', col: C_WARN },
    { r: g.C / 2 - arms.hG, f: loads.HG, name: 'HG', col: C_ACCENT }
  ];
  ups.forEach((u, i) => {
    const x = X(u.r);
    out += arrow(x, yb + L(u.f), x, yb, u.col, 3);
    out += text(x, yb + L(u.f) + 16 + (i % 2) * 14, `${u.name} ${labels[u.name]}`, { size: 11, weight: 700, fill: u.col, anchor: 'middle' });
  });
  // lever arm hint
  out += `<line x1="${n1(X(g.C / 2 - arms.hG))}" y1="${blockTop - 46}" x2="${n1(xb)}" y2="${blockTop - 46}" stroke="${C_MUTED}" stroke-width="1"/>`;
  out += text((X(g.C / 2 - arms.hG) + xb) / 2, blockTop - 52, 'hG', { size: 10.5, fill: C_MUTED, anchor: 'middle' });
  out += text(18, 28, labels.Mo, { size: 12.5, weight: 700 });
  out += text(18, 46, 'arrow length proportional to load', { size: 10.5, fill: C_MUTED });
  out += '</svg>';
  return out;
}
