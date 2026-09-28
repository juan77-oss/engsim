/**
 * plot.js — Parallel Transformers Calculator
 * engsimapp.com
 *
 * WHAT GOES HERE:
 *   - Canvas rendering only: phasor diagram (I1, I2, Ic, U2) and the
 *     dual overload progress bars.
 *   - No physics, no DOM reads beyond the canvas elements passed in.
 *
 * WHAT DOES NOT GO HERE:
 *   - Physics (→ core.js)
 *   - Input reading / orchestration (→ simulator.js)
 *
 * NOTES:
 *   - Phasor diagram follows the same visual-anchor-vs-logical-anchor
 *     and HiDPI/fullscreen patterns established in kapp-diagram and
 *     mohr-circle (see /projects/engsim learnings).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/* ── HiDPI canvas setup (shared pattern) ─────────────────────────
   Sizes the canvas backing store to the container's actual pixel
   dimensions × devicePixelRatio, so it stays sharp at any zoom or
   fullscreen size. Must be called before every draw, since fullscreen
   toggles resize the container.
*/
function setupHiDPI(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, cssWidth: rect.width, cssHeight: rect.height };
}

/* ── Color tokens (read from CSS custom properties, theme-aware) ──
   Real variable names from base.css (NOT invented --sim-* names) ── */
function getColors() {
    const style = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (style.getPropertyValue(name).trim() || fallback);
    return {
        text: v('--text-primary', '#0f172a'),
        muted: v('--text-muted', '#94a3b8'),
        grid: v('--border', '#e2e8f0'),
        i1: v('--brand-accent', '#2563eb'),
        i2: '#7c3aed', // distinct hue for I2, not tied to a status color
        ic: v('--color-danger', '#dc2626'),
        u2: v('--color-success', '#16a34a'),
        green: v('--color-success', '#16a34a'),
        yellow: v('--color-warning', '#d97706'),
        red: v('--color-danger', '#dc2626'),
    };
}

/* ── Phasor diagram: I1, I2, Ic, U2 ──────────────────────────────
   U2 is drawn along the reference axis (angle 0). I1, I2 are drawn
   at their computed angles (lagging, since load is inductive). Ic is
   drawn as the vector connecting the tip of I2 to the tip of I1
   (I1 = I2 + Ic in the balanced-ratio decomposition), matching the
   BC segment described in the faculty's diagram.
*/
function drawPhasorDiagram(canvas, result, labels) {
    if (!canvas) return;
    const { ctx, cssWidth, cssHeight } = setupHiDPI(canvas);
    const colors = getColors();
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const cx = cssWidth * 0.5;
    const cy = cssHeight * 0.58;

    const { I1, I2, Ic } = result.currents;
    const magnitudes = [I1.re, I1.im, I2.re, I2.im].map(Math.abs);
    const maxMag = Math.max(
        Math.hypot(I1.re, I1.im),
        Math.hypot(I2.re, I2.im),
        1e-6
    );

    // Fixed scale so vectors don't resize as angle/magnitude changes
    // between recalculations (same anti-jitter pattern as kapp-diagram).
    const maxRadiusPx = Math.min(cssWidth, cssHeight) * 0.38;
    const scale = maxRadiusPx / maxMag;

    function toCanvas(re, im) {
        // im is negative for lagging (inductive) currents; flip for
        // conventional "below the axis" screen drawing.
        return { x: cx + re * scale, y: cy - im * scale };
    }

    // Axes
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - cssWidth * 0.42, cy);
    ctx.lineTo(cx + cssWidth * 0.42, cy);
    ctx.moveTo(cx, cy - cssHeight * 0.42);
    ctx.lineTo(cx, cy + cssHeight * 0.42);
    ctx.stroke();

    function drawVector(re, im, color, label) {
        const tip = toCanvas(re, im);
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();

        // Arrowhead
        const angle = Math.atan2(tip.y - cy, tip.x - cx);
        const headLen = 9;
        ctx.beginPath();
        ctx.moveTo(tip.x, tip.y);
        ctx.lineTo(tip.x - headLen * Math.cos(angle - Math.PI / 7), tip.y - headLen * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(tip.x - headLen * Math.cos(angle + Math.PI / 7), tip.y - headLen * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fill();

        // Label, offset both perpendicular to and along the vector (radially
        // outward past the arrowhead) so I1/I2 labels don't collide with
        // each other or with Ic's label when the currents are nearly
        // collinear (common when the load is close to unity-ratio).
        const perpX = -Math.sin(angle) * 20;
        const perpY = -Math.cos(angle) * 20;
        const outX = Math.cos(angle) * 8;
        const outY = Math.sin(angle) * 8;
        ctx.font = '700 15px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, tip.x + perpX * 0.5 + outX, tip.y - perpY * 0.5 + outY);

        return tip;
    }

    // U2 reference phasor (arbitrary fixed length along +x axis)
    const u2Len = maxRadiusPx * 0.5;
    ctx.strokeStyle = colors.u2;
    ctx.fillStyle = colors.u2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + u2Len, cy);
    ctx.stroke();
    ctx.font = '700 15px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(labels.u2 || 'U\u2082', cx + u2Len + 8, cy + 5);

    // I1, I2
    const tip1 = drawVector(I1.re, I1.im, colors.i1, labels.i1 || 'I\u2081');
    const tip2 = drawVector(I2.re, I2.im, colors.i2, labels.i2 || 'I\u2082');

    // Ic — drawn from tip2 to tip1 (I1 - I2 direction), dashed
    if (Math.hypot(Ic.re, Ic.im) > 1e-6) {
        ctx.strokeStyle = colors.ic;
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tip2.x, tip2.y);
        ctx.lineTo(tip1.x, tip1.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = colors.ic;
        ctx.font = '700 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        // Offset perpendicular to the Ic segment itself (not a fixed vertical
        // nudge) so the label clears the line regardless of its angle, and
        // pushed out further to clear the nearby I1/I2 tip labels too.
        const icAngle = Math.atan2(tip1.y - tip2.y, tip1.x - tip2.x);
        const icPerpX = -Math.sin(icAngle) * 16;
        const icPerpY = -Math.cos(icAngle) * 16;
        ctx.fillText(labels.ic || 'I_C', (tip1.x + tip2.x) / 2 + icPerpX, (tip1.y + tip2.y) / 2 - icPerpY);
    }

    // Origin dot
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
}

/* ── Dual overload progress bars ─────────────────────────────────
   Reuses the site's existing .bar-chart/.bar-row/.bar-track/
   .bar-segment components (same pattern as fuel-construction),
   with segment color driven by the traffic-light status instead of
   the consumed/leftover convention those classes were named for.
   Each bar is scaled to ITS OWN 100% (its own Sn), not a shared
   scale — the track's right edge IS that 100%, and the segment is
   clamped there; anything past it is reported in the "+x pp over" text.
*/
function drawOverloadBars(container, result, labels) {
    if (!container) return;
    const colors = getColors();
    const { loadPct1, loadPct2 } = result.loading;
    const { status1, status2 } = result.trafficLight;

    const statusColor = { green: colors.green, yellow: colors.yellow, red: colors.red };

    function row(pct, status, label) {
        const widthPct = Math.min(pct, 100); // segment never exceeds the track visually
        const overflowNote = pct > 100 ? ` (+${(pct - 100).toFixed(1)}pp over)` : '';
        return `
            <div class="bar-row${status === 'red' ? ' bar-row--limiting' : ''}">
                <div class="bar-label">
                    <span class="bar-formula">${label}</span>
                    <span style="color:${statusColor[status]}; font-weight:700;">${pct.toFixed(1)}%${overflowNote}</span>
                </div>
                <div class="bar-track">
                    <span class="bar-segment" style="width:${widthPct}%; background:${statusColor[status]};"></span>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="bar-chart">
            ${row(loadPct1, status1, labels.t1 || 'T1')}
            ${row(loadPct2, status2, labels.t2 || 'T2')}
        </div>
    `;
}

/* ── Load share chart (horizontal stacked bar, 0–100% axis) ─────
   Answers "of the total delivered load, how much does each
   transformer carry" — distinct from drawOverloadBars(), which
   scales each transformer against ITS OWN nameplate rating instead.
   Drawn as inline SVG (not canvas: no HiDPI/redraw-on-resize needed,
   it's crisp at any size and the container is a plain div). Colors
   reuse i1/i2 from the phasor diagram so both visuals read as the
   same two machines at a glance.
*/
function drawLoadShareBar(container, result, labels) {
    if (!container) return;
    const colors = getColors();
    const { pct1, pct2, S1, S2 } = result.loadShare;

    // Plot geometry (viewBox units, scales responsively via width:100%)
    const plotLeft = 8, plotRight = 292, plotWidth = plotRight - plotLeft;
    const barY = 34, barHeight = 34;
    const axisY = barY + barHeight;

    const xFor = (pct) => plotLeft + (pct / 100) * plotWidth;

    // T1 on the left (0 → pct1), T2 on the right (pct1 → 100)
    const w1 = (pct1 / 100) * plotWidth;
    const w2 = (pct2 / 100) * plotWidth;
    const x1 = plotLeft;
    const x2 = x1 + w1;

    // Gridlines + axis labels every 10%
    let gridlines = '';
    for (let p = 0; p <= 100; p += 10) {
        const x = xFor(p);
        gridlines += `
            <line x1="${x}" y1="${barY}" x2="${x}" y2="${axisY + 4}" stroke="${colors.grid}" stroke-width="1" />
            <text x="${x}" y="${axisY + 16}" text-anchor="middle" font-size="10" fill="${colors.muted}" font-family="Inter, sans-serif">${p}%</text>
        `;
    }

    function segmentLabel(xLeft, w, pct) {
        if (w <= 0) return '';
        const cx = xLeft + w / 2;
        return `<text x="${cx}" y="${barY - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="${colors.text}" font-family="Inter, sans-serif">${pct.toFixed(2)}%</text>`;
    }

    function legendItem(x, color, name, kva) {
        return `
            <rect x="${x}" y="${axisY + 30}" width="9" height="9" rx="2" fill="${color}" />
            <text x="${x + 13}" y="${axisY + 38}" font-size="11" fill="${colors.muted}" font-family="Inter, sans-serif">${name} (${kva.toFixed(2)} kVA)</text>
        `;
    }

    container.innerHTML = `
        <svg viewBox="0 0 300 ${axisY + 50}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Load share: ${labels.t1 || 'T1'} ${pct1.toFixed(2)}%, ${labels.t2 || 'T2'} ${pct2.toFixed(2)}%">
            ${gridlines}
            <line x1="${plotLeft}" y1="${axisY}" x2="${plotRight}" y2="${axisY}" stroke="${colors.grid}" stroke-width="1" />
            <rect x="${x1}" y="${barY}" width="${w1}" height="${barHeight}" fill="${colors.i1}" />
            <rect x="${x2}" y="${barY}" width="${w2}" height="${barHeight}" fill="${colors.i2}" />
            ${segmentLabel(x1, w1, pct1)}
            ${segmentLabel(x2, w2, pct2)}
            <text x="${plotLeft}" y="${axisY + 30}" font-size="10" fill="${colors.muted}" font-family="Inter, sans-serif">S / S_L %</text>
            ${legendItem(plotLeft + 60, colors.i1, labels.t1 || 'T1', S1)}
            ${legendItem(plotLeft + 160, colors.i2, labels.t2 || 'T2', S2)}
        </svg>
    `;
}

export { setupHiDPI, drawPhasorDiagram, drawOverloadBars, drawLoadShareBar, getColors };

export default { setupHiDPI, drawPhasorDiagram, drawOverloadBars, drawLoadShareBar, getColors };
