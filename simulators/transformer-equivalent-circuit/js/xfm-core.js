/**
 * xfm-core.js
 * Pure physics core for the Transformer Equivalent Circuit Calculator.
 * No DOM access. All functions are deterministic and side-effect free.
 *
 * Conventions:
 *  - All "phase" quantities are single-phase (per-phase) RMS values.
 *  - For three-phase mode, callers must reduce total (3-phase) test power
 *    and line/phase voltages to per-phase values BEFORE calling the
 *    single-phase test/solve functions below (see reduceThreePhase()).
 *  - Impedance referral uses ratio a = U1_phase / U2_phase (primary/secondary).
 *  - Complex numbers are plain objects {re, im}.
 */

// ---------- Complex number helpers ----------

function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function cMul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return { re: Infinity, im: Infinity };
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cInv(a) { return cDiv({ re: 1, im: 0 }, a); }
function cMag(a) { return Math.hypot(a.re, a.im); }
function cAngle(a) { return Math.atan2(a.im, a.re); } // radians
function cFromPolar(mag, angleRad) { return { re: mag * Math.cos(angleRad), im: mag * Math.sin(angleRad) }; }
function toDegrees(rad) { return rad * 180 / Math.PI; }
function toRadians(deg) { return deg * Math.PI / 180; }

// ---------- Three-phase reduction ----------

/**
 * Reduces a set of (possibly line, possibly total 3-phase) test/rating
 * readings to single-phase (per-phase) values.
 * @param {{V:number,I:number,P:number}} raw
 * @param {'single'|'three'} systemType
 * @param {'phase'|'line'} voltageMode - only used when systemType==='three'
 * @param {boolean} powerIsTotal - true if P is the TOTAL 3-phase power (standard wattmeter-method lab reading)
 */
function reduceThreePhase(raw, systemType, voltageMode, powerIsTotal) {
  if (systemType === 'single') {
    return { V: raw.V, I: raw.I, P: raw.P };
  }
  const V = voltageMode === 'line' ? raw.V / Math.sqrt(3) : raw.V;
  const I = raw.I; // assumed line current == phase current (star-equivalent assumption)
  const P = powerIsTotal ? raw.P / 3 : raw.P;
  return { V, I, P };
}

// ---------- Short-circuit / open-circuit test reduction ----------

/**
 * @param {{V:number,I:number,P:number}} t - per-phase short-circuit test readings
 * @returns {{Z:number,R:number,X:number,cosPhi:number}}
 */
function shortCircuitTest(t) {
  const Z = t.V / t.I;
  const R = t.P / (t.I * t.I);
  const X2 = Z * Z - R * R;
  const X = X2 > 0 ? Math.sqrt(X2) : 0;
  const cosPhi = R / Z;
  return { Z, R, X, cosPhi };
}

/**
 * @param {{V:number,I:number,P:number}} t - per-phase open-circuit test readings
 * @returns {{cosPhi0:number,Ife:number,Imag:number,Rfe:number,Xm:number}}
 */
function openCircuitTest(t) {
  const cosPhi0 = t.P / (t.V * t.I);
  const clamped = Math.max(-1, Math.min(1, cosPhi0));
  const sinPhi0 = Math.sqrt(Math.max(0, 1 - clamped * clamped));
  const Ife = t.I * clamped;
  const Imag = t.I * sinPhi0;
  const Rfe = (t.V * t.V) / t.P;
  const Xm = Imag > 0 ? t.V / Imag : Infinity;
  return { cosPhi0: clamped, Ife, Imag, Rfe, Xm };
}

// ---------- Rated currents & referral ----------

/**
 * @param {{Sn:number, U1nPhase:number, U2nPhase:number, systemType:'single'|'three'}} p Sn in VA (already total)
 */
function ratedCurrents(p) {
  const SnPhase = p.systemType === 'three' ? p.Sn / 3 : p.Sn;
  return {
    SnPhase,
    I1n: SnPhase / p.U1nPhase,
    I2n: SnPhase / p.U2nPhase
  };
}

/** a = U1_phase / U2_phase */
function turnsRatio(U1nPhase, U2nPhase) { return U1nPhase / U2nPhase; }

/**
 * Refers an R/X pair measured on `fromSide` to `toSide`.
 * Impedance scales by a^2 going primary->secondary is division, secondary->primary is multiplication.
 */
function referImpedance(RX, fromSide, toSide, a) {
  if (fromSide === toSide) return { R: RX.R, X: RX.X };
  const factor = fromSide === 'primary' && toSide === 'secondary' ? 1 / (a * a) : a * a;
  return { R: RX.R * factor, X: RX.X * factor };
}

function referScalarImpedanceMag(Z, fromSide, toSide, a) {
  if (fromSide === toSide) return Z;
  const factor = fromSide === 'primary' && toSide === 'secondary' ? 1 / (a * a) : a * a;
  return Z * factor;
}

/** %Z = Z_testside * In_testside / Un_testside * 100 (general form, valid even if Icc_test != In) */
function percentZ(Z, UnTestSide, InTestSide) {
  return (Z * InTestSide / UnTestSide) * 100;
}

// ---------- T-model split (classic 50/50 assumption) ----------

/** Splits a series Rcc/Xcc (given on one side) evenly between primary and secondary branches. */
function splitTModel(Rcc, Xcc) {
  return { R1: Rcc / 2, X1: Xcc / 2, R2: Rcc / 2, X2: Xcc / 2 };
}

// ---------- Load impedance ----------

/**
 * Builds the load impedance (secondary side, actual, NOT referred) as a
 * constant-impedance load sized to draw Spct% of Sn2 at rated secondary
 * voltage U2n, at the given power factor.
 * @param {number} Spct - 0..(>100) percent of Sn
 * @param {number} Sn2 - rated apparent power on secondary side (phase, VA)
 * @param {number} U2n - rated secondary phase voltage
 * @param {number} cosPhi - power factor magnitude (0,1]
 * @param {'lag'|'lead'} pfType
 * @returns {{re:number,im:number}|null} null means open circuit (Spct===0)
 */
function buildLoadImpedance(Spct, Sn2, U2n, cosPhi, pfType) {
  if (Spct <= 0) return null; // open circuit
  const S = Sn2 * (Spct / 100);
  const Zmag = (U2n * U2n) / S;
  const phi = Math.acos(Math.max(-1, Math.min(1, cosPhi)));
  const angle = pfType === 'lead' ? -phi : phi;
  return cFromPolar(Zmag, angle);
}

// ---------- Exact (T-model) load-point solver ----------

/**
 * Solves the classic T equivalent circuit for one operating point.
 * All impedances are referred to the PRIMARY side (caller's responsibility).
 * U1 is taken as the phase reference (angle 0).
 *
 * @param {object} p
 * @param {number} p.U1 - primary phase voltage magnitude (reference, angle 0)
 * @param {number} p.R1 @param {number} p.X1
 * @param {number} p.R2p @param {number} p.X2p - secondary branch, referred to primary
 * @param {number} p.Rfe @param {number} p.Xm - excitation branch (as seen at node A, referred to primary)
 * @param {{re:number,im:number}|null} p.ZloadPrimary - load impedance referred to primary, null = open circuit
 * @returns {{Va:object, I1:object, I2p:object, U2p:object}} complex phasors (referred to primary except noted)
 */
function solveExactTModel(p) {
  const U1 = { re: p.U1, im: 0 };
  const Z1 = { re: p.R1, im: p.X1 };
  const Z2p = { re: p.R2p, im: p.X2p };
  const Yfe = p.Rfe > 0 ? { re: 1 / p.Rfe, im: 0 } : { re: 0, im: 0 };
  const Ym = isFinite(p.Xm) && p.Xm > 0 ? { re: 0, im: -1 / p.Xm } : { re: 0, im: 0 };
  const Yexc = cAdd(Yfe, Ym);

  let Va, I2p;
  if (!p.ZloadPrimary) {
    // Open circuit: I2p = 0. Node: (U1-Va)/Z1 = Va*Yexc
    // => U1 = Va*(1 + Z1*Yexc)
    const coeff = cAdd({ re: 1, im: 0 }, cMul(Z1, Yexc));
    Va = cDiv(U1, coeff);
    I2p = { re: 0, im: 0 };
  } else {
    // Branch impedance from node A to reference through load: Z2p + ZloadPrimary
    const Zbranch = cAdd(Z2p, p.ZloadPrimary);
    // (U1-Va)/Z1 = Va*Yexc + Va/Zbranch
    // U1/Z1 = Va*(1/Z1 + Yexc + 1/Zbranch)
    const coeff = cAdd(cAdd(cInv(Z1), Yexc), cInv(Zbranch));
    Va = cDiv(cDiv(U1, Z1), coeff);
    I2p = cDiv(Va, Zbranch);
  }
  const I1 = cDiv(cSub(U1, Va), Z1);
  const U2p = p.ZloadPrimary ? cMul(I2p, p.ZloadPrimary) : Va; // open circuit: U2p == Va (no drop across Z2p, I2p=0)
  return { Va, I1, I2p, U2p };
}

// ---------- Approximate (Kapp) load-point solver ----------

/**
 * @param {object} p
 * @param {number} p.RccPct @param {number} p.XccPct - short-circuit R/X as % of rated impedance
 * @param {number} p.U2n - rated secondary phase voltage
 * @param {number} p.Spct - % of Sn (0 = open circuit)
 * @param {number} p.cosPhi
 * @param {'lag'|'lead'} p.pfType
 * @param {number} p.a - turns ratio U1n/U2n
 */
function solveApproxKapp(p) {
  if (p.Spct <= 0) {
    return { epsilonPct: 0, U2: p.U2n, I2: 0, I1: 0, phiDeg: 0 };
  }
  const phi = Math.acos(Math.max(-1, Math.min(1, p.cosPhi)));
  const sinPhi = (p.pfType === 'lead' ? -1 : 1) * Math.sin(phi);
  const loadFactor = p.Spct / 100;
  const Rl = p.RccPct * loadFactor;
  const Xl = p.XccPct * loadFactor;
  const cosPhiSigned = p.cosPhi;
  const epsilonPct = (Rl * cosPhiSigned + Xl * sinPhi) +
    Math.pow(Xl * cosPhiSigned - Rl * sinPhi, 2) / 200;
  const U2 = p.U2n * (1 - epsilonPct / 100);
  const S = (p.Spct / 100); // fraction of Sn, used with Sn2 by caller to get actual current
  const I2 = null; // caller fills using Sn2 and U2 (kept out of this pure fn to avoid double Sn coupling)
  return { epsilonPct, U2, phiDeg: toDegrees(phi) * (p.pfType === 'lead' ? -1 : 1) };
}

// ---------- Validation suite ----------

function approxEqual(a, b, tol) { return Math.abs(a - b) <= tol; }

function runValidationSuite() {
  const results = [];
  const check = (name, cond, detail) => results.push({ name, pass: !!cond, detail: detail || '' });

  // T1: short-circuit test basic numbers (3-4-5 triangle style)
  {
    const t = shortCircuitTest({ V: 40, I: 10, P: 300 });
    check('T1 SC test: Z=4', approxEqual(t.Z, 4, 1e-9));
    check('T1 SC test: R=3', approxEqual(t.R, 3, 1e-9));
    check('T1 SC test: X≈2.6458', approxEqual(t.X, Math.sqrt(7), 1e-9));
  }

  // T2: open-circuit test basic numbers
  {
    const t = openCircuitTest({ V: 220, I: 2, P: 100 });
    const expectedCosPhi0 = 100 / (220 * 2);
    check('T2 OC test: cosPhi0', approxEqual(t.cosPhi0, expectedCosPhi0, 1e-9));
    check('T2 OC test: Rfe=484', approxEqual(t.Rfe, (220 * 220) / 100, 1e-9));
    const Ife = 2 * expectedCosPhi0;
    check('T2 OC test: Ife', approxEqual(t.Ife, Ife, 1e-9));
  }

  // T3: referral round-trip (primary -> secondary -> primary) recovers original
  {
    const a = 10;
    const RX = { R: 5, X: 8 };
    const toSec = referImpedance(RX, 'primary', 'secondary', a);
    const backToPrim = referImpedance(toSec, 'secondary', 'primary', a);
    check('T3 referral round-trip R', approxEqual(backToPrim.R, RX.R, 1e-9));
    check('T3 referral round-trip X', approxEqual(backToPrim.X, RX.X, 1e-9));
  }

  // T4: %Z reduces to V/Un*100 when test current equals rated current
  {
    const Un = 230, In = 20;
    const t = shortCircuitTest({ V: 9.2, I: In, P: 40 }); // Vcc chosen as 4% of Un
    const pct = percentZ(t.Z, Un, In);
    check('T4 %Z at rated current == Vcc/Un*100', approxEqual(pct, (9.2 / Un) * 100, 1e-9));
  }

  // T5: exact T-model at open circuit -> I2p = 0 and Va close to U1 (excitation >> series Z)
  {
    const p = {
      U1: 230, R1: 0.5, X1: 1.2, R2p: 0.5, X2p: 1.2,
      Rfe: 5000, Xm: 2000, ZloadPrimary: null
    };
    const r = solveExactTModel(p);
    check('T5 exact open-circuit: I2p=0', approxEqual(cMag(r.I2p), 0, 1e-9));
    check('T5 exact open-circuit: Va near U1', approxEqual(r.Va.re, p.U1, 3) && approxEqual(r.Va.im, 0, 3));
  }

  // T6: exact T-model consistency with the SC test itself.
  // If we apply U1 = Vcc_test (reduced to the value seen at the primary after
  // referring) and short the load (Zload=0), with an (idealised) excitation
  // branch removed (Rfe,Xm -> infinity, as assumed during a real SC test),
  // the resulting primary current must equal the SC test's own Icc.
  {
    const Vcc = 18, Icc = 12, Pcc = 130;
    const t = shortCircuitTest({ V: Vcc, I: Icc, P: Pcc });
    const split = splitTModel(t.R, t.X);
    const p = {
      U1: Vcc, R1: split.R1, X1: split.X1, R2p: split.R2, X2p: split.X2,
      Rfe: 1e12, Xm: 1e12, ZloadPrimary: { re: 0, im: 0 }
    };
    const r = solveExactTModel(p);
    check('T6 exact model reproduces SC test current', approxEqual(cMag(r.I1), Icc, 1e-6),
      `got ${cMag(r.I1).toFixed(6)} expected ${Icc}`);
  }

  // T7: solveExactTModel with Zload=0 behaves the same as passing {re:0,im:0} explicitly
  {
    const p = {
      U1: 230, R1: 0.4, X1: 1.0, R2p: 0.4, X2p: 1.0,
      Rfe: 3000, Xm: 1500, ZloadPrimary: { re: 0, im: 0 }
    };
    const r = solveExactTModel(p);
    check('T7 exact short-circuit: finite current', isFinite(cMag(r.I1)) && cMag(r.I1) > 0);
  }

  // T8: approximate Kapp regulation is ~0 at Spct=0
  {
    const r = solveApproxKapp({ RccPct: 3, XccPct: 4, U2n: 230, Spct: 0, cosPhi: 0.8, pfType: 'lag', a: 10 });
    check('T8 approx: epsilon=0 at no load', approxEqual(r.epsilonPct, 0, 1e-9));
    check('T8 approx: U2=U2n at no load', approxEqual(r.U2, 230, 1e-9));
  }

  // T9: approximate Kapp sign convention - leading PF reduces regulation vs lagging (classic Kapp behaviour)
  {
    const lag = solveApproxKapp({ RccPct: 2, XccPct: 5, U2n: 230, Spct: 100, cosPhi: 0.8, pfType: 'lag', a: 10 });
    const lead = solveApproxKapp({ RccPct: 2, XccPct: 5, U2n: 230, Spct: 100, cosPhi: 0.8, pfType: 'lead', a: 10 });
    check('T9 approx: leading PF gives lower (or negative) regulation than lagging', lead.epsilonPct < lag.epsilonPct);
  }

  const pass = results.filter(r => r.pass).length;
  return { pass, total: results.length, results };
}

// ---------- Exports ----------
const XfmCore = {
  cAdd, cSub, cMul, cDiv, cInv, cMag, cAngle, cFromPolar, toDegrees, toRadians,
  reduceThreePhase,
  shortCircuitTest, openCircuitTest,
  ratedCurrents, turnsRatio, referImpedance, referScalarImpedanceMag, percentZ,
  splitTModel, buildLoadImpedance,
  solveExactTModel, solveApproxKapp,
  runValidationSuite
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = XfmCore;
} else {
  window.XfmCore = XfmCore;
}
