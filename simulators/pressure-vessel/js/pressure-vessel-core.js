/**
 * pressure-vessel-core.js
 * Physics engine for the EngSim "Pressure Vessel" simulator.
 *
 * RULES
 *  - Pure physics only: no DOM, no UI strings, no Chart.js.
 *  - Units are US customary: psi, in, lbf, lbf*in. The UI layer converts if needed.
 *  - Every public function returns a plain object. Invalid input returns
 *    { ok: false, error: '...' } instead of throwing.
 *  - Material allowable stresses (S, Sa, Sb, Sf) and gasket factors (m, y) are
 *    ALWAYS user inputs. No material or gasket database lives in this file.
 *
 * MODULES
 *  1. Thin-wall shells and heads  (cylinder, sphere, hemispherical, ellipsoidal,
 *     torispherical, flat plate)
 *  2. Thick-wall cylinder         (Lame stresses, required thickness)
 *  3. Bolted flange + gasket      (gasket geometry, bolt loads and areas)
 *  4. Ring flange stress          (classic constant-thickness ring, no hub)
 *
 * CONVENTIONS
 *  - Corrosion allowance (CA) is on the inside face: the corroded radius is
 *    Ri + CA and the total thickness is the calculated thickness + CA.
 *  - Tension is positive, compression is negative.
 *  - The class convention pi/4 ~= 0.785 is used for hydrostatic end force.
 *  - Edition-sensitive items (flat plate coefficient, flange stress method) are
 *    kept isolated in their own functions so they can be updated later.
 */

export const VERSION = '0.1.0';
export const FLANGE_AREA_CONST = 0.785;

const sq = (x) => x * x;
const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const bad = (error) => ({ ok: false, error });

/* ------------------------------------------------------------------ *
 * 1. THIN-WALL SHELLS AND HEADS
 * ------------------------------------------------------------------ */

/** Cylindrical shell: required thickness for circumferential and longitudinal stress. */
export function cylinderShell({ P, Ri, S, E = 1, CA = 0 }) {
  if (![P, Ri, S, E, CA].every(fin) || P <= 0 || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const R = Ri + CA;
  const denC = S * E - 0.6 * P;
  if (denC <= 0) return bad('pressure-too-high');
  const tCirc = (P * R) / denC;
  const tLong = (P * R) / (2 * S * E + 0.4 * P);
  const t = Math.max(tCirc, tLong);
  return {
    ok: true,
    R,
    tCirc,
    tLong,
    t,
    tTotal: t + CA,
    governs: tCirc >= tLong ? 'circumferential' : 'longitudinal',
    thinOk: t <= 0.5 * R && P <= 0.385 * S * E
  };
}

/** Spherical shell (also used for hemispherical heads). */
export function sphericalShell({ P, Ri, S, E = 1, CA = 0 }) {
  if (![P, Ri, S, E, CA].every(fin) || P <= 0 || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const R = Ri + CA;
  const den = 2 * S * E - 0.2 * P;
  if (den <= 0) return bad('pressure-too-high');
  const t = (P * R) / den;
  return {
    ok: true,
    R,
    t,
    tTotal: t + CA,
    thinOk: t <= 0.356 * R && P <= 0.665 * S * E
  };
}

export const hemisphericalHead = sphericalShell;

/** Ellipsoidal head. ratio = D / (2h); 2 means the standard 2:1 head. */
export function ellipsoidalHead({ P, D, ratio = 2, S, E = 1, CA = 0 }) {
  if (![P, D, ratio, S, E, CA].every(fin) || P <= 0 || D <= 0 || ratio <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const Dc = D + 2 * CA;
  const K = (2 + sq(ratio)) / 6;
  const den = 2 * S * E - 0.2 * P;
  if (den <= 0) return bad('pressure-too-high');
  const t = (P * Dc * K) / den;
  return { ok: true, K, t, tTotal: t + CA, depth: D / (2 * ratio) };
}

/** Torispherical head. L = crown radius, r = knuckle radius (inside, new condition). */
export function torisphericalHead({ P, L, r, S, E = 1, CA = 0 }) {
  if (![P, L, r, S, E, CA].every(fin) || P <= 0 || L <= 0 || r <= 0 || r > L || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const Lc = L + CA;
  const M = 0.25 * (3 + Math.sqrt(L / r));
  const den = 2 * S * E - 0.2 * P;
  if (den <= 0) return bad('pressure-too-high');
  const t = (P * Lc * M) / den;
  return { ok: true, M, t, tTotal: t + CA };
}

/**
 * Flat plate / flat head: t = d * sqrt(C P / (S E)).
 * C is the edge-fixity coefficient and is supplied by the user (it depends on
 * how the plate is attached). Edition-sensitive: keep this function isolated.
 */
export function flatHead({ P, d, C, S, E = 1, CA = 0 }) {
  if (![P, d, C, S, E, CA].every(fin) || P <= 0 || d <= 0 || C <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const dEff = d + 2 * CA;
  const t = dEff * Math.sqrt((C * P) / (S * E));
  return { ok: true, dEff, t, tTotal: t + CA };
}

/** Allowable pressure of a cylinder with a given actual thickness. */
export function cylinderMAWP({ Ri, tActual, S, E = 1, CA = 0 }) {
  if (![Ri, tActual, S, E, CA].every(fin) || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const t = tActual - CA;
  if (t <= 0) return bad('no-thickness-left');
  const R = Ri + CA;
  const Pcirc = (S * E * t) / (R + 0.6 * t);
  const Plong = (2 * S * E * t) / (R - 0.4 * t);
  return { ok: true, Pcirc, Plong, P: Math.min(Pcirc, Plong), governs: Pcirc <= Plong ? 'circumferential' : 'longitudinal' };
}

/** Allowable pressure of a spherical shell (or hemispherical head) with a given actual thickness. */
export function sphereMAWP({ Ri, tActual, S, E = 1, CA = 0 }) {
  if (![Ri, tActual, S, E, CA].every(fin) || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const t = tActual - CA;
  if (t <= 0) return bad('no-thickness-left');
  const R = Ri + CA;
  return { ok: true, P: (2 * S * E * t) / (R + 0.2 * t) };
}

/** Classic membrane stresses at the mean radius (for the animated visual). */
export function membraneStresses({ P, Ri, t, shape = 'cylinder' }) {
  if (![P, Ri, t].every(fin) || Ri <= 0 || t <= 0) return bad('invalid-input');
  const rm = Ri + t / 2;
  if (shape === 'sphere') {
    const s = (P * rm) / (2 * t);
    return { ok: true, sigmaHoop: s, sigmaLong: s };
  }
  return { ok: true, sigmaHoop: (P * rm) / t, sigmaLong: (P * rm) / (2 * t) };
}

/* ------------------------------------------------------------------ *
 * 2. THICK-WALL CYLINDER (LAME)
 * ------------------------------------------------------------------ */

/** Lame stresses at radius r. a = inner radius, b = outer radius. */
export function lameStress({ a, b, Pi, Po = 0, r }) {
  if (![a, b, Pi, Po, r].every(fin) || a <= 0 || b <= a || r < a - 1e-9 || r > b + 1e-9) {
    return bad('invalid-input');
  }
  const k = 1 / (sq(b) - sq(a));
  const A = (Pi * sq(a) - Po * sq(b)) * k;
  const B = (Pi - Po) * sq(a) * sq(b) * k;
  return {
    ok: true,
    sigmaR: A - B / sq(r),
    sigmaTheta: A + B / sq(r),
    sigmaZ: A // closed ends
  };
}

/** Stress profile across the wall, n points from inner to outer radius. */
export function lameProfile({ a, b, Pi, Po = 0, n = 41 }) {
  if (!Number.isInteger(n) || n < 2) return bad('invalid-input');
  const pts = [];
  for (let i = 0; i < n; i++) {
    const r = a + ((b - a) * i) / (n - 1);
    const s = lameStress({ a, b, Pi, Po, r });
    if (!s.ok) return s;
    pts.push({ r, sigmaR: s.sigmaR, sigmaTheta: s.sigmaTheta, sigmaZ: s.sigmaZ });
  }
  return { ok: true, points: pts };
}

/** Critical stresses at the bore, with Tresca and von Mises equivalents. */
export function lameBore({ a, b, Pi, Po = 0 }) {
  const s = lameStress({ a, b, Pi, Po, r: a });
  if (!s.ok) return s;
  const { sigmaR, sigmaTheta, sigmaZ } = s;
  const tresca = Math.max(sigmaR, sigmaTheta, sigmaZ) - Math.min(sigmaR, sigmaTheta, sigmaZ);
  const vonMises = Math.sqrt(0.5 * (sq(sigmaTheta - sigmaR) + sq(sigmaR - sigmaZ) + sq(sigmaZ - sigmaTheta)));
  return { ok: true, sigmaR, sigmaTheta, sigmaZ, tresca, vonMises };
}

/** Required thickness of a thick-wall cylinder: t = R (sqrt(Z) - 1), Z = (SE + P) / (SE - P). */
export function thickWallRequired({ P, Ri, S, E = 1, CA = 0 }) {
  if (![P, Ri, S, E, CA].every(fin) || P <= 0 || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0) {
    return bad('invalid-input');
  }
  const SE = S * E;
  if (P >= SE) return bad('pressure-too-high');
  const R = Ri + CA;
  const Z = (SE + P) / (SE - P);
  const t = R * (Math.sqrt(Z) - 1);
  return {
    ok: true,
    R,
    Z,
    t,
    tTotal: t + CA,
    outerRadius: R + t,
    thickRequired: t > 0.5 * R || P > 0.385 * SE
  };
}

/** Compare thin-wall and thick-wall answers for the same inputs. */
export function thinVsThick(inp) {
  const thin = cylinderShell(inp);
  const thick = thickWallRequired(inp);
  if (!thin.ok) return thin;
  if (!thick.ok) return thick;
  return {
    ok: true,
    tThin: thin.tCirc,
    tThick: thick.t,
    errorPct: (100 * (thin.tCirc - thick.t)) / thick.t
  };
}

/* ------------------------------------------------------------------ *
 * 3. BOLTED FLANGE + GASKET
 * ------------------------------------------------------------------ */

/**
 * Gasket effective geometry.
 *  - gasketId : inside diameter of the gasket contact face
 *  - widthN   : contact width of the gasket
 *  - b0Factor : basic seating width as a fraction of N (0.5 is the usual flat case)
 *  - b0Manual : overrides b0 directly when given
 */
export function gasketGeometry({ gasketId, widthN, b0Factor = 0.5, b0Manual = null }) {
  if (![gasketId, widthN, b0Factor].every(fin) || gasketId <= 0 || widthN <= 0 || b0Factor <= 0) {
    return bad('invalid-input');
  }
  if (b0Manual !== null && (!fin(b0Manual) || b0Manual <= 0)) return bad('invalid-input');
  const od = gasketId + 2 * widthN;
  const b0 = b0Manual !== null ? b0Manual : b0Factor * widthN;
  const narrow = b0 <= 0.25;
  const b = narrow ? b0 : 0.5 * Math.sqrt(b0);
  const G = narrow ? (gasketId + od) / 2 : od - 2 * b;
  return { ok: true, od, b0, b, G, narrow };
}

/**
 * Root area of one bolt from nominal diameter and threads per inch.
 * Uses the root diameter d - 1.299/n, which is an approximation: the UI should
 * also let the user type the root area directly from their own bolt data.
 */
export function boltRootArea({ d, tpi }) {
  if (![d, tpi].every(fin) || d <= 0 || tpi <= 0) return bad('invalid-input');
  return { ok: true, area: (Math.PI / 4) * sq(d - 1.299038 / tpi) };
}

/** Typical coarse-series threads per inch for common nominal sizes (in). */
export function defaultTpi(d) {
  const table = [
    [0.5, 13], [0.625, 11], [0.75, 10], [0.875, 9], [1, 8]
  ];
  if (d >= 1) return 8;
  let best = table[0];
  for (const row of table) if (Math.abs(row[0] - d) < Math.abs(best[0] - d)) best = row;
  return best[1];
}

/**
 * Bolt loads and areas.
 *  H   = 0.785 G^2 P              hydrostatic end force
 *  Hp  = 2 b pi G m P             gasket compression load in service
 *  Wm1 = H + Hp                   operating bolt load
 *  Wm2 = pi b G y                 gasket seating bolt load
 *  Am1 = Wm1 / Sb,  Am2 = Wm2 / Sa,  Am = max(Am1, Am2)
 *  W   = 0.5 (Am + Ab) Sa         seating design load (needs actual bolt area Ab)
 */
export function boltLoads({ P, G, b, m, y, Sa, Sb, Ab = null }) {
  if (![P, G, b, m, y, Sa, Sb].every(fin) || P < 0 || G <= 0 || b <= 0 || m < 0 || y < 0 || Sa <= 0 || Sb <= 0) {
    return bad('invalid-input');
  }
  const H = FLANGE_AREA_CONST * sq(G) * P;
  const Hp = 2 * b * Math.PI * G * m * P;
  const Wm1 = H + Hp;
  const Wm2 = Math.PI * b * G * y;
  const Am1 = Wm1 / Sb;
  const Am2 = Wm2 / Sa;
  const Am = Math.max(Am1, Am2);
  const out = {
    ok: true,
    H, Hp, Wm1, Wm2, Am1, Am2, Am,
    areaGoverns: Am1 >= Am2 ? 'operating' : 'seating'
  };
  if (Ab !== null) {
    if (!fin(Ab) || Ab <= 0) return bad('invalid-input');
    const W = 0.5 * (Am + Ab) * Sa;
    out.Ab = Ab;
    out.W = W;
    out.Wgov = Math.max(Wm1, W);
    out.boltsAdequate = Ab >= Am;
    out.margin = Ab / Am;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. RING FLANGE STRESS (classic method, constant thickness, no hub)
 *    Edition-sensitive: keep isolated so a newer method can be added.
 * ------------------------------------------------------------------ */

/** Shape factor Y for a ring flange, K = A / B (outside / inside diameter). */
export function flangeFactorY(K) {
  if (!fin(K) || K <= 1) return NaN;
  const K2 = sq(K);
  return (1 / (K - 1)) * (0.66845 + (5.7169 * K2 * Math.log10(K)) / (K2 - 1));
}

/**
 * Flange moments and tangential stress.
 *  A = outside diameter, B = bore, C = bolt circle, G = gasket reaction diameter,
 *  t = flange thickness. Wm1 and W come from boltLoads().
 *  Sfo / Sfa = allowable stress of the flange at design / ambient temperature.
 */
export function ringFlangeStress({ A, B, C, G, t, P, Wm1, W, Sfo, Sfa }) {
  if (![A, B, C, G, t, P, Wm1, W, Sfo, Sfa].every(fin) || B <= 0 || A <= B || C <= B || C >= A || G <= 0 || t <= 0) {
    return bad('invalid-input');
  }
  const K = A / B;
  const Y = flangeFactorY(K);
  const H = FLANGE_AREA_CONST * sq(G) * P;
  const HD = FLANGE_AREA_CONST * sq(B) * P;
  const HG = Wm1 - H;
  const HT = H - HD;
  const hD = (C - B) / 2;
  const hG = (C - G) / 2;
  const hT = (hD + hG) / 2;
  const MoOp = HD * hD + HT * hT + HG * hG;
  const MoSeat = W * hG;
  const STop = (Y * MoOp) / (sq(t) * B);
  const STseat = (Y * MoSeat) / (sq(t) * B);
  return {
    ok: true,
    K, Y, HD, HT, HG, hD, hG, hT,
    MoOp, MoSeat, STop, STseat,
    okOp: STop <= Sfo,
    okSeat: STseat <= Sfa
  };
}

/* ------------------------------------------------------------------ *
 * VALIDATION SUITE
 * ------------------------------------------------------------------ */

function near(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

export function runValidationSuite() {
  const results = [];
  const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });

  // 1. Thin-wall cylinder, hand-checked reference case (S assumed 20000 psi).
  const c = cylinderShell({ P: 100, Ri: 48, S: 20000, E: 0.85, CA: 0.125 });
  check('cylinder: circumferential thickness ~0.2841 in', c.ok && near(c.tCirc, 0.2841, 0.001), c.ok ? c.tCirc.toFixed(4) : c.error);
  check('cylinder: longitudinal thickness ~0.1414 in', c.ok && near(c.tLong, 0.1414, 0.001), c.ok ? c.tLong.toFixed(4) : c.error);
  check('cylinder: circumferential governs', c.ok && c.governs === 'circumferential');
  check('cylinder: total thickness ~0.4091 in', c.ok && near(c.tTotal, 0.4091, 0.001), c.ok ? c.tTotal.toFixed(4) : c.error);
  check('cylinder: thin-wall hypothesis valid', c.ok && c.thinOk);

  // 2. Hemispherical head.
  const h = hemisphericalHead({ P: 100, Ri: 48, S: 20000, E: 0.85, CA: 0.125 });
  check('hemisphere: thickness ~0.1416 in', h.ok && near(h.t, 0.1416, 0.001), h.ok ? h.t.toFixed(4) : h.error);
  check('hemisphere: total ~0.2666 in', h.ok && near(h.tTotal, 0.2666, 0.001));

  // 3. Hemisphere is thinner than cylinder for the same data.
  check('hemisphere thinner than cylinder', c.ok && h.ok && h.t < c.t);

  // 4. Ellipsoidal 2:1 reduces to the simple formula; torispherical equals the 0.885 form.
  const el = ellipsoidalHead({ P: 100, D: 96, ratio: 2, S: 20000, E: 1 });
  check('ellipsoidal 2:1: K = 1', el.ok && near(el.K, 1, 1e-12));
  check('ellipsoidal 2:1: t = PD / (2SE - 0.2P)', el.ok && near(el.t, (100 * 96) / (2 * 20000 - 20), 1e-9));
  const L = 96;
  const to = torisphericalHead({ P: 100, L, r: L / 16.6667, S: 20000, E: 1 });
  check('torispherical L/r=16.67: M ~1.77', to.ok && near(to.M, 1.7706, 0.001));
  check('torispherical: matches 0.885 P L / (SE - 0.1P)', to.ok && near(to.t, (0.885 * 100 * L) / (20000 - 10), 0.0005));

  // 5. Flat head.
  const fh = flatHead({ P: 2500, d: 24, C: 0.33, S: 17500, E: 1 });
  check('flat head: t = d sqrt(CP/SE) ~5.21 in', fh.ok && near(fh.t, 5.2109, 0.002), fh.ok ? fh.t.toFixed(4) : fh.error);

  // 6. MAWP consistency: thickness from P, then P back from that thickness.
  const back = cylinderMAWP({ Ri: 48, tActual: c.tTotal, S: 20000, E: 0.85, CA: 0.125 });
  check('MAWP round trip returns 100 psi', back.ok && near(back.Pcirc, 100, 0.01), back.ok ? back.Pcirc.toFixed(4) : back.error);

  const backS = sphereMAWP({ Ri: 48, tActual: h.tTotal, S: 20000, E: 0.85, CA: 0.125 });
  check('sphere MAWP round trip returns 100 psi', backS.ok && near(backS.P, 100, 0.01), backS.ok ? backS.P.toFixed(4) : backS.error);

  // 7. Monotonic: more pressure needs more thickness.
  const c2 = cylinderShell({ P: 200, Ri: 48, S: 20000, E: 0.85, CA: 0.125 });
  check('thickness grows with pressure', c.ok && c2.ok && c2.t > c.t);

  // 8. Thick-wall formula converges to thin-wall when P/SE is small.
  const tt = thinVsThick({ P: 10, Ri: 48, S: 20000, E: 1, CA: 0 });
  check('thick -> thin limit (error < 1 %)', tt.ok && Math.abs(tt.errorPct) < 1, tt.ok ? tt.errorPct.toFixed(4) + ' %' : tt.error);
  const tt2 = thinVsThick({ P: 12000, Ri: 10, S: 20000, E: 1, CA: 0 });
  check('thin-wall under-predicts at high P/SE (> 5 %)', tt2.ok && tt2.errorPct < -5, tt2.ok ? tt2.errorPct.toFixed(2) + ' %' : tt2.error);
  const tr = thickWallRequired({ P: 8000, Ri: 10, S: 20000, E: 1 });
  check('thick-wall flagged as required at P > 0.385 SE', tr.ok && tr.thickRequired);
  check('thick-wall: P >= SE rejected', thickWallRequired({ P: 20000, Ri: 10, S: 20000, E: 1 }).ok === false);

  // 9. Lame boundary conditions and force balance.
  const a = 10, b = 15, Pi = 5000, Po = 500;
  const sa = lameStress({ a, b, Pi, Po, r: a });
  const sb = lameStress({ a, b, Pi, Po, r: b });
  check('Lame: sigma_r(a) = -Pi', sa.ok && near(sa.sigmaR, -Pi, 1e-6));
  check('Lame: sigma_r(b) = -Po', sb.ok && near(sb.sigmaR, -Po, 1e-6));
  const prof = lameProfile({ a, b, Pi, Po, n: 2001 });
  let force = 0;
  if (prof.ok) {
    for (let i = 1; i < prof.points.length; i++) {
      const p0 = prof.points[i - 1], p1 = prof.points[i];
      force += 0.5 * (p0.sigmaTheta + p1.sigmaTheta) * (p1.r - p0.r);
    }
  }
  check('Lame: integral of hoop stress = Pi a - Po b', prof.ok && near(force, Pi * a - Po * b, 0.5), force.toFixed(3));
  const bore = lameBore({ a, b, Pi, Po: 0 });
  check('Lame: hoop stress is maximum at the bore', bore.ok && bore.sigmaTheta > lameStress({ a, b, Pi, Po: 0, r: b }).sigmaTheta);
  check('Lame: Tresca = sigma_theta - sigma_r at the bore', bore.ok && near(bore.tresca, bore.sigmaTheta - bore.sigmaR, 1e-6));

  // 10. Gasket geometry and bolt loads (reference case: m = 3, y = 10000 psi).
  const g = gasketGeometry({ gasketId: 13.75, widthN: 1 });
  check('gasket: b0 = N/2 = 0.5', g.ok && near(g.b0, 0.5, 1e-12));
  check('gasket: b = 0.5 sqrt(b0) ~0.3536', g.ok && near(g.b, 0.35355, 1e-4));
  check('gasket: G = OD - 2b ~15.043', g.ok && near(g.G, 15.0429, 1e-3));
  const narrow = gasketGeometry({ gasketId: 10, widthN: 0.4 });
  check('gasket: narrow case b = b0 and G = mean diameter', narrow.ok && narrow.narrow && near(narrow.b, 0.2, 1e-12) && near(narrow.G, 10.4, 1e-12));
  const bl = boltLoads({ P: 2000, G: g.G, b: g.b, m: 3, y: 10000, Sa: 20000, Sb: 20000 });
  check('bolts: H ~355,000 lb', bl.ok && near(bl.H, 355280, 600), bl.ok ? bl.H.toFixed(0) : bl.error);
  check('bolts: Hp ~200,500 lb', bl.ok && near(bl.Hp, 200490, 600), bl.ok ? bl.Hp.toFixed(0) : bl.error);
  check('bolts: Wm1 = H + Hp', bl.ok && near(bl.Wm1, bl.H + bl.Hp, 1e-6));
  check('bolts: Wm2 ~167,000 lb', bl.ok && near(bl.Wm2, 167084, 600), bl.ok ? bl.Wm2.toFixed(0) : bl.error);
  check('bolts: operating condition governs area', bl.ok && bl.areaGoverns === 'operating');
  check('bolts: Am1 = Wm1 / Sb and Am2 = Wm2 / Sa', bl.ok && near(bl.Am1, bl.Wm1 / 20000, 1e-9) && near(bl.Am2, bl.Wm2 / 20000, 1e-9));

  // 11. Force equilibrium of the flange: HG = Hp and HD + HT = H.
  const fl = ringFlangeStress({ A: 26.5, B: 12.75, C: 22.5, G: g.G, t: 5.48, P: 2000, Wm1: bl.Wm1, W: bl.Wm1, Sfo: 20000, Sfa: 20000 });
  check('flange: HG = Hp (gasket reaction)', fl.ok && near(fl.HG, bl.Hp, 1e-6));
  check('flange: HD + HT = H', fl.ok && near(fl.HD + fl.HT, bl.H, 1e-6));
  check('flange: moment equals sum of load x arm', fl.ok && near(fl.MoOp, fl.HD * fl.hD + fl.HT * fl.hT + fl.HG * fl.hG, 1e-6));
  check('flange: Y decreases as K grows', flangeFactorY(1.5) > flangeFactorY(2) && flangeFactorY(2) > flangeFactorY(3));
  const thin = ringFlangeStress({ A: 26.5, B: 12.75, C: 22.5, G: g.G, t: 4, P: 2000, Wm1: bl.Wm1, W: bl.Wm1, Sfo: 20000, Sfa: 20000 });
  check('flange: thinner flange has higher stress', fl.ok && thin.ok && thin.STop > fl.STop);

  // 12. Actual bolt area and seating load.
  const area = boltRootArea({ d: 1.5, tpi: defaultTpi(1.5) });
  const gross = (Math.PI / 4) * sq(1.5);
  check('bolt: root area is 70-90 % of the gross area', area.ok && area.area > 0.7 * gross && area.area < 0.9 * gross, area.ok ? area.area.toFixed(4) : area.error);
  const bl2 = boltLoads({ P: 2000, G: g.G, b: g.b, m: 3, y: 10000, Sa: 20000, Sb: 20000, Ab: 20 * area.area });
  check('bolts: W = 0.5 (Am + Ab) Sa', bl2.ok && near(bl2.W, 0.5 * (bl2.Am + bl2.Ab) * 20000, 1e-6));
  check('bolts: governing load = max(Wm1, W)', bl2.ok && near(bl2.Wgov, Math.max(bl2.Wm1, bl2.W), 1e-9));

  // 13. Invalid input never throws.
  check('invalid input returns ok:false', cylinderShell({ P: -1, Ri: 10, S: 100 }).ok === false && boltLoads({}).ok === false);

  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, allPassed: passed === results.length, results };
}
