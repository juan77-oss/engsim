/**
 * diagram.js — Voltage Divider — Circuit diagram generator
 * engsim.app
 *
 * Builds the SVG markup for the schematic shown in the results panel.
 * PURE-ish MODULE: takes already-formatted display strings and returns
 * an SVG markup string. It does not touch the DOM itself — simulator.js
 * is responsible for writing the returned string into the page
 * (e.g. `container.innerHTML = renderDirectDiagram(...)`).
 *
 * Colors are CSS custom properties (var(--text-secondary), etc.) so
 * the diagram automatically follows light/dark mode once injected
 * into the live document.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/* ── Shared drawing primitives ───────────────────────────────────── */

/**
 * Builds an SVG path 'd' string for a standard zigzag resistor symbol
 * along a vertical line at x, between yTop and yBottom.
 */
function resistorZigzagPath(x, yTop, yBottom, zigW = 8, segments = 7) {
  const margin = (yBottom - yTop) * 0.18;
  const bodyTop = yTop + margin;
  const bodyBottom = yBottom - margin;
  const stepY = (bodyBottom - bodyTop) / segments;

  let d = `M ${x} ${yTop} L ${x} ${bodyTop}`;
  for (let i = 1; i < segments; i++) {
    const yy = bodyTop + stepY * i;
    const xx = x + (i % 2 === 1 ? zigW : -zigW);
    d += ` L ${xx} ${yy}`;
  }
  d += ` L ${x} ${bodyBottom} L ${x} ${yBottom}`;
  return d;
}

function resistorSymbol(x, yTop, yBottom) {
  return `<path d="${resistorZigzagPath(x, yTop, yBottom)}" fill="none" ` +
    `stroke="var(--text-secondary)" stroke-width="1.5" stroke-linejoin="round" />`;
}

function groundSymbol(x, y) {
  return `
    <line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="var(--text-secondary)" stroke-width="1.5" />
    <line x1="${x - 9}" y1="${y + 5}" x2="${x + 9}" y2="${y + 5}" stroke="var(--text-secondary)" stroke-width="1.5" />
    <line x1="${x - 4}" y1="${y + 10}" x2="${x + 4}" y2="${y + 10}" stroke="var(--text-secondary)" stroke-width="1.5" />
  `;
}

function currentArrow(x, yTop, yBottom) {
  const head = 4.5;
  return `
    <line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBottom - head}" stroke="var(--text-muted)" stroke-width="1.2" />
    <polygon points="${x - head},${yBottom - head} ${x + head},${yBottom - head} ${x},${yBottom}" fill="var(--text-muted)" />
  `;
}

function sourceTerminal(x, y) {
  return `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="var(--text-secondary)" stroke-width="2" />`;
}

function tapNode(x, y, branchX, labelText, valueText) {
  return `
    <circle cx="${x}" cy="${y}" r="3" fill="var(--brand-accent)" />
    <line x1="${x}" y1="${y}" x2="${branchX}" y2="${y}" stroke="var(--brand-accent)" stroke-width="1.5" />
    <circle cx="${branchX}" cy="${y}" r="3" fill="none" stroke="var(--brand-accent)" stroke-width="2" />
    <text x="${branchX + 10}" y="${y - 5}" font-size="10" font-weight="700" fill="var(--brand-accent)">${labelText}</text>
    <text x="${branchX + 10}" y="${y + 10}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${valueText}</text>
  `;
}

/* ══════════════════════════════════════════════════════════════════
   TWO-RESISTOR DIVIDER DIAGRAM
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {object} p
 * @param {string} p.vinLabel     - e.g. "12.00 V"
 * @param {string} p.voutLabel    - e.g. "6.00 V"
 * @param {string} p.currentLabel - e.g. "6.00 mA"
 * @param {string} p.r1Label      - e.g. "R1 = 1.00 kΩ"
 * @param {string} p.r2Label      - e.g. "R2 = 1.00 kΩ"
 */
export function renderDirectDiagram({ vinLabel, voutLabel, currentLabel, r1Label, r2Label }) {
  const cx = 70;
  const arrowX = 40;
  const labelX = 90;
  const branchX = 150;

  const topY = 15;
  const r1Top = 40, r1Bottom = 110;
  const tapY = 110;
  const r2Top = 110, r2Bottom = 180;
  const groundY = 200;

  return `
<svg viewBox="0 0 230 235" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Two-resistor voltage divider schematic">

  <text x="8" y="${r1Top - 12}" font-size="9" fill="var(--text-muted)" font-family="var(--font-mono)">I = ${currentLabel}</text>

  ${sourceTerminal(cx, topY)}
  <text x="${cx}" y="${topY - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">Vin</text>
  <text x="${cx + 14}" y="${topY + 3}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${vinLabel}</text>
  <line x1="${cx}" y1="${topY + 4}" x2="${cx}" y2="${r1Top}" stroke="var(--text-secondary)" stroke-width="1.5" />

  ${resistorSymbol(cx, r1Top, r1Bottom)}
  <text x="${labelX}" y="${(r1Top + r1Bottom) / 2 + 3}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${r1Label}</text>

  ${tapNode(cx, tapY, branchX, 'Vout', voutLabel)}

  ${resistorSymbol(cx, r2Top, r2Bottom)}
  <text x="${labelX}" y="${(r2Top + r2Bottom) / 2 + 3}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${r2Label}</text>

  <line x1="${cx}" y1="${r2Bottom}" x2="${cx}" y2="${groundY}" stroke="var(--text-secondary)" stroke-width="1.5" />
  ${groundSymbol(cx, groundY)}
  <text x="${cx}" y="${groundY + 22}" text-anchor="middle" font-size="9" fill="var(--text-muted)">GND</text>

  ${currentArrow(arrowX, r1Top - 5, r2Bottom + 5)}
</svg>`;
}

/* ══════════════════════════════════════════════════════════════════
   SERIES CHAIN DIAGRAM (N resistors)
   ══════════════════════════════════════════════════════════════════ */

/**
 * @param {object} p
 * @param {string}   p.vinLabel
 * @param {string}   p.voutLabel
 * @param {string}   p.currentLabel
 * @param {string[]} p.resistorLabels - e.g. ["R1 = 1.00 kΩ", "R2 = 470 Ω", ...]
 *                    Vout is drawn at the node above the LAST resistor.
 */
export function renderChainDiagram({ vinLabel, voutLabel, currentLabel, resistorLabels }) {
  const n = resistorLabels.length;
  const cx = 70;
  const arrowX = 40;
  const labelX = 90;
  const branchX = 150;

  const topY = 15;
  const topMargin = 40;
  const segH = 55;    // vertical space per resistor (zigzag + connecting wire)
  const zigLen = 35;  // zigzag body length within each segment
  const bottomMargin = 45;
  const height = topMargin + n * segH + bottomMargin;

  let y = topMargin;
  let body = '';

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const zigTop = y;
    const zigBottom = y + zigLen;

    if (isLast) {
      body += tapNode(cx, zigTop, branchX, 'Vout', voutLabel);
    }

    body += resistorSymbol(cx, zigTop, zigBottom);
    body += `<text x="${labelX}" y="${(zigTop + zigBottom) / 2 + 3}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${resistorLabels[i]}</text>`;

    y = zigBottom;
    if (!isLast) {
      const wireEnd = y + (segH - zigLen);
      body += `<line x1="${cx}" y1="${y}" x2="${cx}" y2="${wireEnd}" stroke="var(--text-secondary)" stroke-width="1.5" />`;
      body += `<circle cx="${cx}" cy="${wireEnd - (segH - zigLen) / 2}" r="1.8" fill="var(--text-secondary)" />`;
      y = wireEnd;
    }
  }

  const groundY = y + 20;

  return `
<svg viewBox="0 0 230 ${height}" xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Series chain voltage divider schematic with ${n} resistors">

  <text x="8" y="${topMargin - 12}" font-size="9" fill="var(--text-muted)" font-family="var(--font-mono)">I = ${currentLabel}</text>

  ${sourceTerminal(cx, topY)}
  <text x="${cx}" y="${topY - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">Vin</text>
  <text x="${cx + 14}" y="${topY + 3}" font-size="10" fill="var(--text-primary)" font-family="var(--font-mono)">${vinLabel}</text>
  <line x1="${cx}" y1="${topY + 4}" x2="${cx}" y2="${topMargin}" stroke="var(--text-secondary)" stroke-width="1.5" />

  ${body}

  <line x1="${cx}" y1="${y}" x2="${cx}" y2="${groundY}" stroke="var(--text-secondary)" stroke-width="1.5" />
  ${groundSymbol(cx, groundY)}
  <text x="${cx}" y="${groundY + 22}" text-anchor="middle" font-size="9" fill="var(--text-muted)">GND</text>

  ${currentArrow(arrowX, topMargin - 5, y + 5)}
</svg>`;
}
