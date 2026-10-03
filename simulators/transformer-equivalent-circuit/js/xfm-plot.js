/**
 * xfm-plot.js
 * Builds SVG markup strings for:
 *  - the equivalent circuit diagram (approximate/L or exact/T model, with the
 *    load shown as open / short / a loaded impedance box)
 *  - the voltage/current phasor diagram for the current operating point
 * Colors come from CSS custom properties (currentColor + var(--brand-accent))
 * so the diagram follows the site's light/dark theme automatically.
 */

// ---------- low-level symbol paths ----------

function resistorPathH(x0, y, w, amp = 9, peaks = 4) {
  const lead = w * 0.14;
  const bodyStart = x0 + lead;
  const bodyW = w - 2 * lead;
  const seg = bodyW / (peaks + 1);
  let d = `M ${x0} ${y} L ${bodyStart} ${y}`;
  for (let i = 1; i <= peaks; i++) {
    const vx = bodyStart + seg * i;
    const vy = i % 2 === 1 ? y - amp : y + amp;
    d += ` L ${vx.toFixed(2)} ${vy.toFixed(2)}`;
  }
  d += ` L ${(bodyStart + bodyW).toFixed(2)} ${y} L ${(x0 + w).toFixed(2)} ${y}`;
  return d;
}

function inductorPathH(x0, y, w, amp = 9, loops = 3) {
  const lead = w * 0.14;
  const bodyStart = x0 + lead;
  const bodyW = w - 2 * lead;
  const loopW = bodyW / loops;
  let d = `M ${x0} ${y} L ${bodyStart} ${y}`;
  let cx = bodyStart;
  for (let i = 0; i < loops; i++) {
    const rx = loopW / 2;
    d += ` A ${rx.toFixed(2)} ${amp} 0 0 1 ${(cx + loopW).toFixed(2)} ${y}`;
    cx += loopW;
  }
  d += ` L ${(x0 + w).toFixed(2)} ${y}`;
  return d;
}

function resistorPathV(x, y0, h, amp = 9, peaks = 3) {
  const lead = h * 0.14;
  const bodyStart = y0 + lead;
  const bodyH = h - 2 * lead;
  const seg = bodyH / (peaks + 1);
  let d = `M ${x} ${y0} L ${x} ${bodyStart}`;
  for (let i = 1; i <= peaks; i++) {
    const vy = bodyStart + seg * i;
    const vx = i % 2 === 1 ? x - amp : x + amp;
    d += ` L ${vx.toFixed(2)} ${vy.toFixed(2)}`;
  }
  d += ` L ${x} ${(bodyStart + bodyH).toFixed(2)} L ${x} ${(y0 + h).toFixed(2)}`;
  return d;
}

function inductorPathV(x, y0, h, amp = 9, loops = 3) {
  const lead = h * 0.14;
  const bodyStart = y0 + lead;
  const bodyH = h - 2 * lead;
  const loopH = bodyH / loops;
  let d = `M ${x} ${y0} L ${x} ${bodyStart}`;
  let cy = bodyStart;
  for (let i = 0; i < loops; i++) {
    const ry = loopH / 2;
    d += ` A ${amp} ${ry.toFixed(2)} 0 0 1 ${x} ${(cy + loopH).toFixed(2)}`;
    cy += loopH;
  }
  d += ` L ${x} ${(y0 + h).toFixed(2)}`;
  return d;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// ---------- circuit diagram ----------

/**
 * @param {object} p
 * @param {'approx'|'exact'} p.modelType
 * @param {number} p.R1 @param {number} p.X1 - primary-side series (for approx: the full Rcc/Xcc)
 * @param {number} p.R2 @param {number} p.X2 - secondary-side series, referred (unused in approx)
 * @param {number} p.Rfe @param {number} p.Xm - excitation branch, referred to the diagram's reference side
 * @param {'open'|'short'|'loaded'} p.loadState
 * @param {string} p.loadLabel - e.g. "92.2 + j69.1 Ω" shown next to the load box
 * @param {string} p.U1Label @param {string} p.U2Label
 * @param {string} p.refSideLabel - "Referred to primary" / "Referred to secondary"
 */
function buildCircuitDiagramSVG(p) {
  const W = 860, H = 240;
  const yTop = 78, yBot = 190;
  const xL = 130, xR = 640;
  const strokeW = 2.2;
  const boxW = 70, gap = 70; // width of each R/X symbol box + gap to the next one
  const wire = `stroke="currentColor" stroke-width="${strokeW}" fill="none"`;
  const symbol = `stroke="currentColor" stroke-width="${strokeW}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const accent = `stroke="var(--brand-accent)" stroke-width="${strokeW}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

  let parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Transformer equivalent circuit diagram">`);
  parts.push(`<style>.xfm-lbl{font:600 13px 'JetBrains Mono',monospace;fill:currentColor;} .xfm-val{font:600 12px 'JetBrains Mono',monospace;fill:var(--brand-accent);} .xfm-tag{font:600 11px Inter,sans-serif;fill:currentColor;opacity:.65;}</style>`);

  // bottom return rail (full width)
  parts.push(`<path d="M ${xL} ${yBot} L ${xR} ${yBot}" ${wire}/>`);

  // left terminal drop + U1 label (grows LEFTWARD from xL-10, so xL has a left margin reserved)
  parts.push(`<path d="M ${xL} ${yTop} L ${xL} ${yBot}" ${wire}/>`);
  parts.push(`<text x="${xL - 10}" y="${(yTop + yBot) / 2}" class="xfm-lbl" text-anchor="end">U1</text>`);
  parts.push(`<text x="${xL - 10}" y="${(yTop + yBot) / 2 + 16}" class="xfm-val" text-anchor="end">${esc(p.U1Label)}</text>`);

  let nodeAx;
  if (p.modelType === 'exact') {
    parts.push(`<path d="${resistorPathH(xL, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${xL + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">R1</text>`);
    parts.push(`<text x="${xL + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.R1.toFixed(4)} Ω</text>`);
    const indX = xL + gap;
    parts.push(`<path d="${inductorPathH(indX, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${indX + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">jX1</text>`);
    parts.push(`<text x="${indX + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.X1.toFixed(4)} Ω</text>`);
    nodeAx = indX + gap;
  } else {
    // Same horizontal span as the exact model's R1+jX1 block (just an empty
    // wire here) so the left-side label spacing is identical either way and
    // the Rfe/jXm labels never crowd the U1 label.
    nodeAx = xL + 2 * gap;
    parts.push(`<path d="M ${xL} ${yTop} L ${nodeAx} ${yTop}" ${wire}/>`);
  }

  // node A vertical drop to excitation branch
  parts.push(`<path d="M ${nodeAx} ${yTop} L ${nodeAx} ${yTop + 20}" ${wire}/>`);
  parts.push(`<circle cx="${nodeAx}" cy="${yTop}" r="3" fill="currentColor"/>`);

  const branchTop = yTop + 20, branchBot = yBot - 20;
  const rfeX = nodeAx - 32, xmX = nodeAx + 32;
  parts.push(`<path d="M ${rfeX} ${branchTop} L ${xmX} ${branchTop}" ${wire}/>`);
  parts.push(`<path d="M ${rfeX} ${branchBot} L ${xmX} ${branchBot}" ${wire}/>`);
  parts.push(`<path d="M ${nodeAx} ${branchBot} L ${nodeAx} ${yBot}" ${wire}/>`);
  parts.push(`<path d="${resistorPathV(rfeX, branchTop, branchBot - branchTop)}" ${symbol}/>`);
  parts.push(`<path d="${inductorPathV(xmX, branchTop, branchBot - branchTop)}" ${symbol}/>`);
  parts.push(`<text x="${rfeX - 12}" y="${branchTop + 10}" class="xfm-lbl" text-anchor="end">Rfe</text>`);
  parts.push(`<text x="${rfeX - 12}" y="${branchTop + 24}" class="xfm-val" text-anchor="end">${isFinite(p.Rfe) ? p.Rfe.toFixed(2) : '∞'} Ω</text>`);
  parts.push(`<text x="${xmX + 12}" y="${branchTop + 10}" class="xfm-lbl" text-anchor="start">jXm</text>`);
  parts.push(`<text x="${xmX + 12}" y="${branchTop + 24}" class="xfm-val" text-anchor="start">${isFinite(p.Xm) ? p.Xm.toFixed(2) : '∞'} Ω</text>`);

  const r2x = nodeAx + 20;
  parts.push(`<path d="M ${nodeAx} ${yTop} L ${r2x} ${yTop}" ${wire}/>`);
  let afterSeries2;
  if (p.modelType === 'exact') {
    parts.push(`<path d="${resistorPathH(r2x, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${r2x + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">R2'</text>`);
    parts.push(`<text x="${r2x + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.R2.toFixed(4)} Ω</text>`);
    const x2x = r2x + gap;
    parts.push(`<path d="${inductorPathH(x2x, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${x2x + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">jX2'</text>`);
    parts.push(`<text x="${x2x + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.X2.toFixed(4)} Ω</text>`);
    afterSeries2 = x2x + gap;
  } else {
    // approximate model: the single Rcc+jXcc block sits AFTER the shunt branch (input-referred excitation)
    parts.push(`<path d="${resistorPathH(r2x, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${r2x + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">Rcc</text>`);
    parts.push(`<text x="${r2x + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.R1.toFixed(4)} Ω</text>`);
    const x2x = r2x + gap;
    parts.push(`<path d="${inductorPathH(x2x, yTop, boxW)}" ${symbol}/>`);
    parts.push(`<text x="${x2x + boxW / 2}" y="${yTop - 14}" class="xfm-lbl" text-anchor="middle">jXcc</text>`);
    parts.push(`<text x="${x2x + boxW / 2}" y="${yTop - 28}" class="xfm-val" text-anchor="middle">${p.X1.toFixed(4)} Ω</text>`);
    afterSeries2 = x2x + gap;
  }

  // right terminal + load (U2' label grows RIGHTWARD from xR+10 — the gap between
  // xR and W is the reserved right margin for this label, mirroring the left margin)
  parts.push(`<path d="M ${afterSeries2} ${yTop} L ${xR} ${yTop}" ${wire}/>`);
  parts.push(`<path d="M ${xR} ${yTop} L ${xR} ${yBot}" ${wire}/>`);
  parts.push(`<text x="${xR + 10}" y="${(yTop + yBot) / 2}" class="xfm-lbl" text-anchor="start">U2'</text>`);
  parts.push(`<text x="${xR + 10}" y="${(yTop + yBot) / 2 + 16}" class="xfm-val" text-anchor="start">${esc(p.U2Label)}</text>`);

  // load box drawn on the top wire, between the series block and the right rail
  const loadW = Math.max(40, xR - afterSeries2 - 20);
  const loadMidX = afterSeries2 + (xR - afterSeries2) / 2;
  if (p.loadState === 'open') {
    parts.push(`<circle cx="${loadMidX - 6}" cy="${yTop}" r="4" ${accent}/>`);
    parts.push(`<circle cx="${loadMidX + 6}" cy="${yTop}" r="4" ${accent}/>`);
    parts.push(`<text x="${loadMidX}" y="${yTop - 14}" class="xfm-tag" text-anchor="middle">OPEN CIRCUIT</text>`);
  } else if (p.loadState === 'short') {
    parts.push(`<path d="M ${loadMidX} ${yTop} L ${loadMidX} ${yBot}" stroke="var(--brand-accent)" stroke-width="3"/>`);
    parts.push(`<text x="${loadMidX}" y="${yTop - 14}" class="xfm-tag" text-anchor="middle">SHORT CIRCUIT</text>`);
  } else {
    const bx = loadMidX - 24, by = (yTop + yBot) / 2 - 16;
    parts.push(`<rect x="${bx}" y="${by}" width="48" height="32" rx="4" ${accent}/>`);
    parts.push(`<text x="${bx + 24}" y="${by + 20}" class="xfm-lbl" text-anchor="middle">Z_L</text>`);
    parts.push(`<text x="${loadMidX}" y="${yTop - 14}" class="xfm-tag" text-anchor="middle">${esc(p.loadLabel || '')}</text>`);
  }

  parts.push(`<text x="${W / 2}" y="${H - 8}" class="xfm-tag" text-anchor="middle">${esc(p.refSideLabel || '')} — ${p.modelType === 'exact' ? 'Exact (T) model' : 'Approximate (L) model'}</text>`);
  parts.push('</svg>');
  return parts.join('');
}

// ---------- phasor diagram ----------

/**
 * @param {object} p
 * @param {{mag:number,angleDeg:number}} p.U1 @param {{mag:number,angleDeg:number}} p.U2
 * @param {{mag:number,angleDeg:number}} p.I1 @param {{mag:number,angleDeg:number}} p.I2
 */
function buildPhasorSVG(p) {
  const W = 420, H = 420;
  const cx = W / 2, cy = H / 2;
  const maxV = Math.max(p.U1.mag, p.U2.mag, 1e-9);
  const maxI = Math.max(p.I1.mag, p.I2.mag, 1e-9);
  const vScale = (W / 2 - 60) / maxV;
  const iScale = (W / 2 - 60) / maxI;

  const arrow = (mag, angleDeg, scale, color, label, dash) => {
    const rad = (angleDeg * Math.PI) / 180;
    const x2 = cx + mag * scale * Math.cos(rad);
    const y2 = cy - mag * scale * Math.sin(rad);
    const headLen = 9;
    const a1 = rad + Math.PI * 0.85;
    const a2 = rad - Math.PI * 0.85;
    const hx1 = x2 + headLen * Math.cos(a1), hy1 = y2 - headLen * Math.sin(a1);
    const hx2 = x2 + headLen * Math.cos(a2), hy2 = y2 - headLen * Math.sin(a2);
    const dashAttr = dash ? `stroke-dasharray="5,4"` : '';
    return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="2.4" ${dashAttr}/>` +
      `<path d="M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${hx1.toFixed(1)} ${hy1.toFixed(1)} M ${x2.toFixed(1)} ${y2.toFixed(1)} L ${hx2.toFixed(1)} ${hy2.toFixed(1)}" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<text x="${(x2 + 10 * Math.cos(rad)).toFixed(1)}" y="${(y2 - 10 * Math.sin(rad)).toFixed(1)}" font="600 13px Inter,sans-serif" fill="${color}" text-anchor="middle">${esc(label)}</text>`;
  };

  let parts = [];
  parts.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Voltage and current phasor diagram">`);
  parts.push(`<line x1="20" y1="${cy}" x2="${W - 20}" y2="${cy}" stroke="currentColor" stroke-width="1" opacity="0.25"/>`);
  parts.push(`<line x1="${cx}" y1="20" x2="${cx}" y2="${H - 20}" stroke="currentColor" stroke-width="1" opacity="0.25"/>`);
  parts.push(arrow(p.U1.mag, p.U1.angleDeg, vScale, 'currentColor', 'U1'));
  parts.push(arrow(p.U2.mag, p.U2.angleDeg, vScale, 'var(--brand-accent)', p.U2.label || "U2'"));
  parts.push(arrow(p.I1.mag, p.I1.angleDeg, iScale, '#e08a2c', 'I1', true));
  parts.push(arrow(p.I2.mag, p.I2.angleDeg, iScale, '#c0392b', p.I2.label || "I2'", true));
  parts.push(`<text x="12" y="${H - 8}" font="500 10px Inter,sans-serif" fill="currentColor" opacity="0.55">Solid = voltages · Dashed = currents (not to the same scale)</text>`);
  parts.push('</svg>');
  return parts.join('');
}

const XfmPlot = { buildCircuitDiagramSVG, buildPhasorSVG };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = XfmPlot;
} else {
  window.XfmPlot = XfmPlot;
}
