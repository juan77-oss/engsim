/* ==========================================================================
   welded-joints-core.js
   Pure physics for the Welded Joints simulator. No DOM.

   Method (the standard "weld as a line" model):
   - Every fillet weld is treated as a line of unit width. The throat is
     0.707\u00B7h, so A = 0.707\u00B7h\u00B7\u03A3L, J = 0.707\u00B7h\u00B7Ju, I = 0.707\u00B7h\u00B7Iu .
   - Direct shear   \u03C4' = F/A                     
   - Torsion        \u03C4'' = M\u00B7r/J                  
   - Bending        \u03C4'' = M\u00B7c/I                  
   - Combined       \u03C4 = |\u03C4' + \u03C4''|               (vector sum)
   Because every property is a sum over line segments, ANY weld pattern works,
   not only the nine cases of Tables 9-1 and 9-2 (they are special cases).

   Unit systems (consistent, no hidden conversions inside the maths):
     SI: mm, N,   MPa
     US: in, kip, ksi
   ========================================================================== */

export const THROAT = 0.707;                 // throat factor of a 45-degree fillet
export const KSI_TO_MPA = 6.894757293;
export const SYSTEMS = {
  SI: { length: 'mm', force: 'N',   stress: 'MPa' },
  US: { length: 'in', force: 'kip', stress: 'ksi' },
};

/* -------------------------------------------------------------------------
   Material data
   ------------------------------------------------------------------------- */

// Minimum filler-metal properties by electrode class. `nominal_ksi` is the EXX level,
// which is what the AISC allowable is built on: 0.30*EXX.
export const ELECTRODES = {
  E60:  { label: 'E60xx',  nominal_ksi: 60,  Sut: { US: 62,  SI: 427 }, Sy: { US: 50,  SI: 345 } },
  E70:  { label: 'E70xx',  nominal_ksi: 70,  Sut: { US: 70,  SI: 482 }, Sy: { US: 57,  SI: 393 } },
  E80:  { label: 'E80xx',  nominal_ksi: 80,  Sut: { US: 80,  SI: 551 }, Sy: { US: 67,  SI: 462 } },
  E90:  { label: 'E90xx',  nominal_ksi: 90,  Sut: { US: 90,  SI: 620 }, Sy: { US: 77,  SI: 531 } },
  E100: { label: 'E100xx', nominal_ksi: 100, Sut: { US: 100, SI: 689 }, Sy: { US: 87,  SI: 600 } },
  E120: { label: 'E120xx', nominal_ksi: 120, Sut: { US: 120, SI: 827 }, Sy: { US: 107, SI: 737 } },
};

// Base metals available in the selector (ksi). Add more as needed.
export const BASE_METALS = {
  A36:      { label: 'ASTM A36',      Sut_ksi: 58, Sy_ksi: 36 },
  '1018HR': { label: 'AISI 1018 HR',  Sut_ksi: 58, Sy_ksi: 32 },
};

// Fatigue stress-concentration factors for welds.
export const FATIGUE_KFS = [
  { id: 'butt-reinforced',       Kfs: 1.2 },
  { id: 'fillet-transverse-toe', Kfs: 1.5 },
  { id: 'fillet-parallel-end',   Kfs: 2.7 },
  { id: 't-butt-sharp-corner',   Kfs: 2.0 },
];

const toSys = (ksi, sys) => (sys === 'SI' ? ksi * KSI_TO_MPA : ksi);

export function electrodeProps(id, sys) {
  const e = ELECTRODES[id];
  if (!e) throw new Error('Unknown electrode: ' + id);
  const nominal = toSys(e.nominal_ksi, sys);
  return {
    id, label: e.label,
    Sut: e.Sut[sys], Sy: e.Sy[sys],
    nominal,
    tauAllow: 0.30 * nominal,            // AISC: shear 0.30*Sut(EXX)
  };
}

export function baseProps(id, sys) {
  const m = BASE_METALS[id];
  if (!m) throw new Error('Unknown base metal: ' + id);
  return { id, label: m.label, Sut: toSys(m.Sut_ksi, sys), Sy: toSys(m.Sy_ksi, sys) };
}

// Allowable force per unit length of fillet weld.
// f = 0.707*h*tau_allow
export function allowableLinearForce(h, electrodeId, sys) {
  return THROAT * h * electrodeProps(electrodeId, sys).tauAllow;
}

// Minimum fillet size by thickness of the thicker part (AISC / AWS).
// Also: the leg should not exceed the thickness of the thinner part.
const MIN_FILLET_IN = [
  [0.25, 1 / 8], [0.5, 3 / 16], [0.75, 1 / 4], [1.5, 5 / 16],
  [2.25, 3 / 8], [6, 1 / 2], [Infinity, 5 / 8],
];
export function minFilletSize(thickerPart, sys) {
  const t = sys === 'SI' ? thickerPart / 25.4 : thickerPart;
  const row = MIN_FILLET_IN.find(([lim]) => t <= lim);
  return sys === 'SI' ? row[1] * 25.4 : row[1];
}
export function checkFilletSize(h, thickerPart, thinnerPart, sys) {
  const min = minFilletSize(thickerPart, sys);
  const max = thinnerPart;
  return { min, max, okMin: h >= min - 1e-9, okMax: h <= max + 1e-9 };
}

/* -------------------------------------------------------------------------
   Weld group geometry (a list of line segments in the plane of the joint)
   ------------------------------------------------------------------------- */

export const PRESETS = [
  { id: 'line',           params: ['d'] },
  { id: 'two-vertical',   params: ['b', 'd'] },
  { id: 'two-horizontal', params: ['b', 'd'] },
  { id: 'L',              params: ['b', 'd'] },
  { id: 'C',              params: ['b', 'd'] },
  { id: 'U',              params: ['b', 'd'] },
  { id: 'rectangle',      params: ['b', 'd'] },
  { id: 'circle',         params: ['r'] },
];

export function buildGroup(preset, { b = 0, d = 0, r = 0 } = {}) {
  const S = (run, x1, y1, x2, y2) => ({ run, x1, y1, x2, y2 });
  switch (preset) {
    case 'line':           return [S('vertical', 0, 0, 0, d)];
    case 'two-vertical':   return [S('vertical', 0, 0, 0, d), S('vertical', b, 0, b, d)];
    case 'two-horizontal': return [S('horizontal', 0, 0, b, 0), S('horizontal', 0, d, b, d)];
    case 'L':              return [S('vertical', 0, 0, 0, d), S('horizontal', 0, 0, b, 0)];
    case 'C':              return [S('vertical', 0, 0, 0, d), S('horizontal', 0, d, b, d), S('horizontal', 0, 0, b, 0)];
    case 'U':              return [S('horizontal', 0, 0, b, 0), S('vertical', 0, 0, 0, d), S('vertical', b, 0, b, d)];
    case 'rectangle':      return [S('horizontal', 0, 0, b, 0), S('horizontal', 0, d, b, d),
                                   S('vertical', 0, 0, 0, d),   S('vertical', b, 0, b, d)];
    case 'circle': {
      const n = 72, out = [];
      for (let i = 0; i < n; i++) {
        const a1 = (2 * Math.PI * i) / n, a2 = (2 * Math.PI * (i + 1)) / n;
        out.push(S('circle', r + r * Math.cos(a1), r + r * Math.sin(a1), r + r * Math.cos(a2), r + r * Math.sin(a2)));
      }
      return out;
    }
    default: throw new Error('Unknown preset: ' + preset);
  }
}

export const segmentLength = (s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);

// Unit-width properties (Ju, Iux, Iuy) plus the real throat properties for size h.
export function groupProperties(segments, h) {
  if (!segments.length) throw new Error('Empty weld group');
  const lens = segments.map(segmentLength);
  let L = 0, sx = 0, sy = 0;
  segments.forEach((s, i) => {
    L += lens[i];
    sx += lens[i] * (s.x1 + s.x2) / 2;
    sy += lens[i] * (s.y1 + s.y2) / 2;
  });
  const xg = sx / L, yg = sy / L;
  let Ju = 0, Iux = 0, Iuy = 0, cmax = 0, rmax = 0;
  segments.forEach((s, i) => {
    const l = lens[i];
    const mx = (s.x1 + s.x2) / 2 - xg, my = (s.y1 + s.y2) / 2 - yg;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    Ju  += l ** 3 / 12 + l * (mx * mx + my * my);      // parallel-axis theorem
    Iux += l * (dy * dy / 12 + my * my);                // about horizontal axis through G
    Iuy += l * (dx * dx / 12 + mx * mx);                // about vertical axis through G
    [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => {
      cmax = Math.max(cmax, Math.abs(y - yg));
      rmax = Math.max(rmax, Math.hypot(x - xg, y - yg));
    });
  });
  const t = THROAT * h;
  return { L, xg, yg, Ju, Iux, Iuy, cmax, rmax, h, throat: t, A: t * L, J: t * Ju, Ix: t * Iux, Iy: t * Iuy };
}

// Unique endpoints (for labelling A, B, C, D ...).
export function labeledEndpoints(segments, tol = 1e-6) {
  const pts = [];
  segments.forEach((s) => {
    [[s.x1, s.y1], [s.x2, s.y2]].forEach(([x, y]) => {
      if (!pts.some((p) => Math.hypot(p.x - x, p.y - y) < tol)) pts.push({ x, y });
    });
  });
  if (pts.length > 12) return [];            // circle: too many to label
  return pts.map((p, i) => ({ ...p, label: String.fromCharCode(65 + i) }));
}

/* -------------------------------------------------------------------------
   Stress analysis
     mode 'inplane': load = { Fx, Fy, px, py }   force at point (px,py)  -> torsion
     mode 'bending': load = { V, M }             shear + moment about the
                                                  horizontal axis        -> bending
   ------------------------------------------------------------------------- */
export function analyze(segments, h, mode, load, { samples = 12 } = {}) {
  const props = groupProperties(segments, h);
  const { A, J, Ix, xg, yg } = props;
  let fieldFn, M = 0, V = 0;

  if (mode === 'inplane') {
    const { Fx = 0, Fy = 0, px = xg, py = yg } = load;
    M = (px - xg) * Fy - (py - yg) * Fx;                 // moment about G (CCW +)
    V = Math.hypot(Fx, Fy);
    fieldFn = (x, y) => ({
      v1: [Fx / A, Fy / A],
      v2: [-M * (y - yg) / J, M * (x - xg) / J],         // perpendicular to r
    });
  } else if (mode === 'bending') {
    ({ V = 0, M = 0 } = load);
    fieldFn = (x, y) => ({
      v1: [0, V / A],
      v2: [M * (y - yg) / Ix, 0],                        // drawn horizontal; \u27C2 to v1 as in Eq. (e)
    });
  } else throw new Error('Unknown mode: ' + mode);

  const points = [];
  segments.forEach((s, si) => {
    for (let k = 0; k <= samples; k++) {
      const u = k / samples;
      const x = s.x1 + (s.x2 - s.x1) * u, y = s.y1 + (s.y2 - s.y1) * u;
      const { v1, v2 } = fieldFn(x, y);
      const vx = v1[0] + v2[0], vy = v1[1] + v2[1];
      points.push({
        seg: si, u, x, y, v1, v2, vx, vy,
        tau1: Math.hypot(v1[0], v1[1]),
        tau2: Math.hypot(v2[0], v2[1]),
        tau: Math.hypot(vx, vy),
      });
    }
  });
  const critical = points.reduce((a, p) => (p.tau > a.tau ? p : a), points[0]);
  const tauMin = points.reduce((a, p) => Math.min(a, p.tau), Infinity);
  return { mode, props, M, V, points, critical, tauMax: critical.tau, tauMin, field: fieldFn };
}

// Stress at the labelled endpoints (A, B, C, D ...)
export function stressAtEndpoints(analysis, segments) {
  return labeledEndpoints(segments).map((p) => {
    const { v1, v2 } = analysis.field(p.x, p.y);
    const vx = v1[0] + v2[0], vy = v1[1] + v2[1];
    return { ...p, v1, v2, tau1: Math.hypot(...v1), tau2: Math.hypot(...v2), tau: Math.hypot(vx, vy) };
  });
}

/* -------------------------------------------------------------------------
   Static verification (sections 9-5 and 9-6)
   ------------------------------------------------------------------------- */
export function staticCheck({ tau, electrodeId, base, sys, nd = 1 }) {
  const e = electrodeProps(electrodeId, sys);
  const SsyW = 0.577 * e.Sy;                      // distortion-energy shear yield, filler metal
  const nWeld = SsyW / tau;                       // conventional method
  const utilWeld = tau / e.tauAllow;              // code method (AISC)
  const tauBase = THROAT * tau;                   // shear on the leg plane in the base metal
  const tauAllowBase = 0.40 * base.Sy;            // AISC: base metal shear 0.40*Sy
  const nBase = (0.577 * base.Sy) / tauBase;
  const utilBase = tauBase / tauAllowBase;
  const status = (n, util) => (util > 1 || n < nd ? 'fail' : n < nd * 1.1 ? 'warn' : 'ok');
  return {
    weld: { tau, Ssy: SsyW, n: nWeld, tauAllow: e.tauAllow, util: utilWeld, status: status(nWeld, utilWeld) },
    base: { tau: tauBase, tauAllow: tauAllowBase, n: nBase, util: utilBase, status: status(nBase, utilBase) },
    electrode: e,
    governs: utilBase > utilWeld ? 'base' : 'weld',
  };
}

// Member (the bar/plate itself) next to the weld.
export function memberBendingCheck({ M, t, d, Sy }) {
  const sigma = (6 * Math.abs(M)) / (t * d * d);
  return { sigma, n: Sy / sigma, sigmaAllow: 0.60 * Sy, util: sigma / (0.60 * Sy) };
}
export function memberTensionCheck({ F, area, Sy }) {
  const sigma = Math.abs(F) / area;
  return { sigma, n: Sy / sigma, sigmaAllow: 0.60 * Sy, util: sigma / (0.60 * Sy) };
}

/* -------------------------------------------------------------------------
   Inverse design
   Every stress is exactly \u221D 1/h (A, J, I are linear in h), so the minimum
   leg size comes from a single analysis at h = 1 (no iteration needed).
   ------------------------------------------------------------------------- */
export function designFilletSize({ segments, mode, load, electrodeId, base, sys, thickerPart }) {
  const unit = analyze(segments, 1, mode, load, { samples: 2 });
  const tau1 = unit.tauMax;
  const e = electrodeProps(electrodeId, sys);
  const hWeld = tau1 / e.tauAllow;
  const hBase = (THROAT * tau1) / (0.40 * base.Sy);
  const hCode = thickerPart != null ? minFilletSize(thickerPart, sys) : 0;
  const hRequired = Math.max(hWeld, hBase, hCode);
  const governs = hRequired === hCode && hCode > Math.max(hWeld, hBase) ? 'code-min'
                : hWeld >= hBase ? 'weld' : 'base';
  return { hWeld, hBase, hCode, hRequired, governs };
}

// Asymmetric welds so that the load passes through the centroid
// of the angle (no moment on the welds).  F1 = F*ybar/spacing.
export function designAsymmetricWelds({ F, spacing, ybar, h, electrodeId, base, sys }) {
  const F1 = (F * ybar) / spacing, F2 = F - F1;
  const e = electrodeProps(electrodeId, sys);
  const fWeld = THROAT * h * e.tauAllow, fBase = h * 0.40 * base.Sy;
  const f = Math.min(fWeld, fBase);
  return {
    F1, F2, ratio: F2 / F1,
    l1Weld: F1 / fWeld, l2Weld: F2 / fWeld,
    l1Base: F1 / fBase, l2Base: F2 / fBase,
    l1: F1 / f, l2: F2 / f,
    governs: fBase < fWeld ? 'base' : 'weld',
  };
}

/* -------------------------------------------------------------------------
   Fatigue: weld shear, Marin factors for a forged surface,
   Gerber (default) or modified Goodman, Ssu = 0.67\u00B7Sut.
   ------------------------------------------------------------------------- */
export function marinKa(Sut, sys) {
  const a = sys === 'SI' ? 272 : 39.9;            // forged surface (Marin factor)
  return a * Math.pow(Sut, -0.995);
}

export function shearFatigueFactor(tauA, tauM, Sse, Ssu, method = 'gerber') {
  if (tauA <= 0 && tauM <= 0) return Infinity;
  if (method === 'goodman') return 1 / (tauA / Sse + tauM / Ssu);
  if (tauM === 0) return Sse / tauA;
  if (tauA === 0) return Ssu / tauM;
  const r = Ssu / tauM;
  return 0.5 * r * r * (tauA / Sse) * (-1 + Math.sqrt(1 + Math.pow((2 * tauM * Sse) / (Ssu * tauA), 2)));
}

// Fatigue-limit curve (taum, taua) for plotting the diagram.
export function fatigueCurve(Sse, Ssu, method = 'gerber', n = 40) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const tm = (Ssu * i) / n;
    out.push({ tm, ta: method === 'goodman' ? Sse * (1 - tm / Ssu) : Sse * (1 - (tm / Ssu) ** 2) });
  }
  return out;
}

// Works for non-proportional loads too: amplitude/mean come from the vector
// difference/sum of the stress at Fmax and Fmin, evaluated at every sample point.
export function fatigueAnalysis({ segments, h, mode, loadMax, loadMin, Kfs, Sut, method = 'gerber', sys, factors = {} }) {
  const a1 = analyze(segments, h, mode, loadMax);
  const a2 = analyze(segments, h, mode, loadMin);
  const { kb = 1, kd = 1, ke = 1, kf = 1 } = factors;
  const ka = marinKa(Sut, sys), kc = 0.59;        // kc: torsion/shear load factor
  const Sse = ka * kb * kc * kd * ke * kf * 0.5 * Sut;
  const Ssu = 0.67 * Sut;
  let worst = null;
  a1.points.forEach((p, i) => {
    const q = a2.points[i];
    const tauA = (Kfs * Math.hypot(p.vx - q.vx, p.vy - q.vy)) / 2;
    const tauM = (Kfs * Math.hypot(p.vx + q.vx, p.vy + q.vy)) / 2;
    const nf = shearFatigueFactor(tauA, tauM, Sse, Ssu, method);
    if (!worst || nf < worst.nf) worst = { nf, tauA, tauM, x: p.x, y: p.y };
  });
  return { ka, kb, kc, kd, ke, kf, Sse, Ssu, Kfs, method, ...worst, infiniteLife: worst.nf >= 1 };
}

/* -------------------------------------------------------------------------
   AWS weld symbol: data only; drawing lives in plot.js
   ------------------------------------------------------------------------- */
export function weldSymbolSpec({
  type = 'fillet', size, length = null, pitch = null,
  arrowSide = true, otherSide = false, allAround = false, field = false,
} = {}) {
  return {
    type, size, length, pitch,
    arrowSide: !!arrowSide, otherSide: !!otherSide,
    allAround: !!allAround, field: !!field,
  };
}

// Suggested symbols for a group: one per run of equal welds.
// Closed patterns (rectangle, circle) get a single "all around" symbol.
export function symbolsForGroup(segments, h) {
  const circular = segments[0].run === 'circle';
  const runNames = new Set(segments.map((s) => s.run));
  const closed = segments.length === 4 && runNames.size === 2;          // rectangle
  if (circular || closed) {
    return [{
      run: 'all', count: segments.length, lengthEach: null,
      spec: weldSymbolSpec({ type: 'fillet', size: h, length: null, arrowSide: true, allAround: true }),
    }];
  }
  const runs = new Map();
  segments.forEach((s) => {
    const l = segmentLength(s);
    const r = runs.get(s.run) || { run: s.run, count: 0, lengthEach: l };
    r.count += 1;
    runs.set(s.run, r);
  });
  return [...runs.values()].map((r) => ({
    run: r.run, count: r.count, lengthEach: r.lengthEach,
    spec: weldSymbolSpec({
      type: 'fillet', size: h, length: r.lengthEach,
      arrowSide: true, otherSide: r.count === 2, allAround: false,
    }),
  }));
}

/* -------------------------------------------------------------------------
   Validation suite: reproduces reference cases (hand-calculation results).
   ------------------------------------------------------------------------- */
export function runValidationSuite() {
  const results = [];
  const check = (name, actual, expected, relTol = 0.005) => {
    const pass = Math.abs(actual - expected) <= relTol * Math.abs(expected) + 1e-12;
    results.push({ name, actual, expected, pass });
  };

  // Unit-width polar (Ju) and bending (Iu) properties of the standard patterns
  const b = 56, d = 190, r = 40;
  const P = (id, o) => groupProperties(buildGroup(id, o), 1);
  check('Single line: Ju = d\u00B3/12',            P('line', { d }).Ju, d ** 3 / 12);
  check('Two parallel: Ju = d(3b\u00B2+d\u00B2)/6',      P('two-vertical', { b, d }).Ju, d * (3 * b * b + d * d) / 6);
  check('C-shape: Ju (C-shape)',         P('C', { b, d }).Ju, (8 * b ** 3 + 6 * b * d * d + d ** 3) / 12 - b ** 4 / (2 * b + d));
  check('C-shape: x\u0304 = b\u00B2/(2b+d)',        P('C', { b, d }).xg, b * b / (2 * b + d));
  check('Rectangle: Ju = (b+d)\u00B3/6',     P('rectangle', { b, d }).Ju, (b + d) ** 3 / 6);
  check('Circle: Ju = 2\u03C0r\u00B3',            P('circle', { r }).Ju, 2 * Math.PI * r ** 3, 0.003);
  check('Two vertical, Iu: Iu = d\u00B3/6',            P('two-vertical', { b, d }).Iux, d ** 3 / 6);
  check('Two horizontal, Iu: Iu = bd\u00B2/2',           P('two-horizontal', { b, d }).Iux, b * d * d / 2);
  check('Rectangle, Iu: Iu = d\u00B2(3b+d)/6',   P('rectangle', { b, d }).Iux, d * d * (3 * b + d) / 6);

  // C-shaped group (SI): 25 kN on one side plate, 6 mm fillets
  {
    const seg = buildGroup('C', { b: 56, d: 190 });
    const a = analyze(seg, 6, 'inplane', { Fx: 0, Fy: -25000, px: -100, py: 95 });
    const pts = stressAtEndpoints(a, seg);
    check('C-weld case: A = 1280 mm\u00B2', a.props.A, 1280, 0.002);
    check('C-weld case: x\u0304 = 10.4 mm', a.props.xg, 10.4, 0.005);
    check('C-weld case: J = 7.07e6 mm\u2074', a.props.J, 7.07e6, 0.002);
    check('C-weld case: M = 2760 N\u00B7m', Math.abs(a.M) / 1000, 2760, 0.002);
    check('C-weld case: \u03C4_max = 43.9 MPa', a.tauMax, 43.9, 0.005);
    const corner = pts.find((p) => Math.abs(p.x - 56) < 1e-6 && Math.abs(p.y - 190) < 1e-6);
    check('C-weld case: \u03C4 at horizontal-weld end = 37.0 MPa', corner.tau, 37.0, 0.01);
  }

  // Plate welded on both sides (US): 16.5 kip on 2 welds of 2 in, h = 3/8, E70, base Sy = 27.5 ksi
  {
    const seg = buildGroup('two-vertical', { b: 0.5, d: 2 });
    const a = analyze(seg, 0.375, 'bending', { V: 16.5, M: 0 });
    const sc = staticCheck({ tau: a.tauMax, electrodeId: 'E70', base: { Sy: 27.5, Sut: 50 }, sys: 'US' });
    check('Plate welded both sides: allowable force 5.57 kip/in', allowableLinearForce(0.375, 'E70', 'US'), 5.57, 0.002);
    check('Plate welded both sides: base shear / allowable = 11/11', sc.base.util, 1.0, 0.005);
  }

  // Asymmetric welds (US): F = 24 kip, h = 5/16, E70, A36
  {
    const r3 = designAsymmetricWelds({ F: 24, spacing: 4, ybar: 1.67, h: 0.3125, electrodeId: 'E70', base: baseProps('A36', 'US'), sys: 'US' });
    check('Asymmetric welds: F1 = 10 kip', r3.F1, 10, 0.003);
    check('Asymmetric welds: l1 (weld) = 2.16 in', r3.l1Weld, 2.16, 0.01);
    check('Asymmetric welds: l1 (base, governs) = 2.22 in', r3.l1, 2.22, 0.01);
    check('Asymmetric welds: l2 = 3.11 in', r3.l2, 3.11, 0.01);
  }

  // Cantilever (US): 500 lbf at 6 in, h = 3/8, E6010, 1018 HR
  {
    const seg = buildGroup('two-vertical', { b: 0.375, d: 2 });
    const a = analyze(seg, 0.375, 'bending', { V: 0.5, M: 3.0 });
    const el = { Sy: 50, Sut: 62 };
    check('Cantilever case: A = 1.06 in\u00B2', a.props.A, 1.06, 0.002);
    check('Cantilever case: I = 0.353 in\u2074', a.props.Ix, 0.353, 0.003);
    check('Cantilever case: \u03C4\' = 0.472 ksi', a.critical.tau1, 0.472, 0.003);
    check('Cantilever case: \u03C4 = 8.51 ksi', a.tauMax, 8.51, 0.003);
    check('Cantilever case: n (weld) = 3.39', (0.577 * el.Sy) / a.tauMax, 3.39, 0.005);
    check('Cantilever case: n (member) = 2.67', memberBendingCheck({ M: 3.0, t: 0.375, d: 2, Sy: 32 }).n, 2.67, 0.003);
  }

  // Fatigue cases (US): base metal governs, Sut = 58 ksi
  {
    const seg = buildGroup('two-vertical', { b: 0.375, d: 2 });
    const f5 = fatigueAnalysis({ segments: seg, h: 0.375, mode: 'bending',
      loadMax: { V: 1, M: 0 }, loadMin: { V: -1, M: 0 }, Kfs: 2.7, Sut: 58, sys: 'US' });
    check('Reversed fatigue case: ka = 0.702', f5.ka, 0.702, 0.002);
    check('Reversed fatigue case: Sse = 12.0 ksi', f5.Sse, 12.0, 0.003);
    check('Reversed fatigue case: nf = 4.72', f5.nf, 4.72, 0.005);
    // The repeated-load reference case uses a custom Kfs = 2.
    const f6 = fatigueAnalysis({ segments: seg, h: 0.375, mode: 'bending',
      loadMax: { V: 2, M: 0 }, loadMin: { V: 0, M: 0 }, Kfs: 2.0, Sut: 58, sys: 'US' });
    check('Repeated fatigue case: nf (Gerber) = 5.85', f6.nf, 5.85, 0.01);
  }

  // Invariant: stress is exactly proportional to 1/h
  {
    const seg = buildGroup('C', { b: 56, d: 190 });
    const l = { Fx: 0, Fy: -25000, px: -100, py: 95 };
    const t6 = analyze(seg, 6, 'inplane', l).tauMax, t12 = analyze(seg, 12, 'inplane', l).tauMax;
    check('Invariant  \u03C4(h=6) = 2\u00B7\u03C4(h=12)', t6, 2 * t12, 1e-9);
    // Invariant: pure force through G gives uniform tau = F/A and zero moment
    const a = analyze(seg, 6, 'inplane', { Fx: 0, Fy: -1000, px: groupProperties(seg, 6).xg, py: 95 });
    check('Invariant  concentric load: M = 0', Math.abs(a.M), 0, 1e-9);
  }

  const failures = results.filter((x) => !x.pass);
  return { ok: failures.length === 0, total: results.length, passed: results.length - failures.length, failures, results };
}
