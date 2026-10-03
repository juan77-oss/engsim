import { EXAMPLE_VALUES } from './xfm-constants.js';

const C = window.XfmCore;
const P = window.XfmPlot;

const el = (id) => document.getElementById(id);

// Canonical internal state: everything referred to PRIMARY, computed once
// per "Calculate" press. Load-only controls re-render from this without
// needing the button again.
let base = null;
let forcedLoadState = null; // null | 'short' — 'open' is just loadPct=0, no flag needed

function fmt(n, d = 4) {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

function setText(id, txt) { const e = el(id); if (e) e.textContent = txt; }

function showError(msg) {
  const box = el('sim-error');
  if (!msg) { box.classList.remove('is-visible'); box.textContent = ''; return; }
  box.classList.add('is-visible');
  box.textContent = msg;
}

function markInvalid(id, invalid) {
  const wrap = el(id)?.closest('.sim-input-wrap') || el(id);
  if (!wrap) return;
  wrap.classList.toggle('sim-input--invalid', !!invalid);
  el(id)?.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

function numVal(id) {
  const raw = el(id).value.trim();
  return raw === '' ? NaN : parseFloat(raw);
}

function updateThreePhaseVisibility() {
  const isThree = el('system-type').value === 'three';
  document.querySelectorAll('.xfm-three-only').forEach(n => n.classList.toggle('is-hidden', !isThree));
}

function validateInputs() {
  const errors = [];
  const fields = ['sn-kva', 'u1n', 'u2n', 'sc-v', 'sc-i', 'sc-p', 'oc-v', 'oc-i', 'oc-p', 'load-cosphi'];
  fields.forEach(f => markInvalid(f, false));

  const Sn = numVal('sn-kva'), U1n = numVal('u1n'), U2n = numVal('u2n');
  const scV = numVal('sc-v'), scI = numVal('sc-i'), scP = numVal('sc-p');
  const ocV = numVal('oc-v'), ocI = numVal('oc-i'), ocP = numVal('oc-p');
  const cosPhi = numVal('load-cosphi');

  const req = [
    ['sn-kva', Sn, v => v > 0, 'Rated power must be a positive number.'],
    ['u1n', U1n, v => v > 0, 'Primary rated voltage must be a positive number.'],
    ['u2n', U2n, v => v > 0, 'Secondary rated voltage must be a positive number.'],
    ['sc-v', scV, v => v >= 0, 'Short-circuit voltage must be a non-negative number.'],
    ['sc-i', scI, v => v > 0, 'Short-circuit current must be a positive number.'],
    ['sc-p', scP, v => v > 0, 'Short-circuit power must be a positive number.'],
    ['oc-v', ocV, v => v > 0, 'Open-circuit voltage must be a positive number.'],
    ['oc-i', ocI, v => v > 0, 'Open-circuit current must be a positive number.'],
    ['oc-p', ocP, v => v > 0, 'Open-circuit power must be a positive number.'],
    ['load-cosphi', cosPhi, v => v > 0 && v <= 1, 'Power factor must be between 0 (exclusive) and 1.']
  ];
  req.forEach(([id, v, ok, msg]) => {
    if (isNaN(v) || !ok(v)) { markInvalid(id, true); errors.push(msg); }
  });

  // Physical consistency: SC test impedance triangle must be valid (Z >= R)
  if (!isNaN(scV) && !isNaN(scI) && !isNaN(scP) && scI > 0) {
    const Ztest = scV / scI, Rtest = scP / (scI * scI);
    if (Rtest > Ztest * 1.0001) {
      markInvalid('sc-p', true);
      errors.push('Short-circuit test is inconsistent: the measured power implies a resistance larger than the measured impedance (Vcc·Icc). Double-check Vcc, Icc and Pcc.');
    }
  }
  // OC test: cosPhi0 must be <= 1
  if (!isNaN(ocV) && !isNaN(ocI) && !isNaN(ocP) && ocV > 0 && ocI > 0) {
    const cosPhi0 = ocP / (ocV * ocI);
    if (cosPhi0 > 1.0001) {
      markInvalid('oc-p', true);
      errors.push('Open-circuit test is inconsistent: the measured power exceeds V0·I0 (implies a power factor greater than 1). Double-check V0, I0 and P0.');
    }
  }

  return { errors, values: { Sn, U1n, U2n, scV, scI, scP, ocV, ocI, ocP, cosPhi } };
}

function computeBase() {
  const systemType = el('system-type').value;
  const u1nMode = systemType === 'three' ? el('u1n-mode').value : 'phase';
  const u2nMode = systemType === 'three' ? el('u2n-mode').value : 'phase';
  const powerIsTotal = systemType === 'three' ? el('power-total').checked : false;
  const scSide = el('sc-side').value;
  const ocSide = el('oc-side').value;

  const { Sn, U1n, U2n, scV, scI, scP, ocV, ocI, ocP } = validateInputs().values;
  const SnVA = Sn * 1000;

  const U1nPhase = systemType === 'three' && u1nMode === 'line' ? U1n / Math.sqrt(3) : U1n;
  const U2nPhase = systemType === 'three' && u2nMode === 'line' ? U2n / Math.sqrt(3) : U2n;
  const a = C.turnsRatio(U1nPhase, U2nPhase);

  const scMode = scSide === 'primary' ? u1nMode : u2nMode;
  const ocMode = ocSide === 'primary' ? u1nMode : u2nMode;
  const scReduced = C.reduceThreePhase({ V: scV, I: scI, P: scP }, systemType, scMode, powerIsTotal);
  const ocReduced = C.reduceThreePhase({ V: ocV, I: ocI, P: ocP }, systemType, ocMode, powerIsTotal);

  const sc = C.shortCircuitTest(scReduced);
  const oc = C.openCircuitTest(ocReduced);

  const rc = C.ratedCurrents({ Sn: SnVA, U1nPhase, U2nPhase, systemType });

  const RccP = C.referImpedance({ R: sc.R, X: sc.X }, scSide, 'primary', a);
  const RfeXmP = C.referImpedance({ R: oc.Rfe, X: oc.Xm }, ocSide, 'primary', a);

  const scUn = scSide === 'primary' ? U1nPhase : U2nPhase;
  const scIn = scSide === 'primary' ? rc.I1n : rc.I2n;
  const pctZcc = C.percentZ(sc.Z, scUn, scIn);
  const pctRcc = C.percentZ(sc.R, scUn, scIn);
  const pctXcc = C.percentZ(sc.X, scUn, scIn);

  return {
    systemType, u1nMode, u2nMode, SnVA, SnPhaseVA: rc.SnPhase, U1nPhase, U2nPhase, a,
    scSide, ocSide, sc, oc, rc,
    RccP: RccP.R, XccP: RccP.X, RfeP: RfeXmP.R, XmP: RfeXmP.X,
    pctZcc, pctRcc, pctXcc
  };
}

function currentLoadInputs() {
  const loadPct = parseFloat(el('load-pct').value);
  const cosPhi = numVal('load-cosphi');
  const pfType = el('load-pf-type').value;
  const modelType = el('model-type').value;
  const refSide = el('ref-side').value;
  return { loadPct, cosPhi, pfType, modelType, refSide };
}

function renderCircuitParams() {
  setText('res-a', fmt(base.a, 4));
  setText('res-i1n', fmt(base.rc.I1n, 3));
  setText('res-i2n', fmt(base.rc.I2n, 3));
  setText('res-zcc', fmt(base.sc.Z, 4));
  setText('res-pctzcc', fmt(base.pctZcc, 2));
  setText('res-pctrcc', fmt(base.pctRcc, 2));
  setText('res-pctxcc', fmt(base.pctXcc, 2));
  setText('res-cosphi0', fmt(base.oc.cosPhi0, 4));
}

function refer(RX, refSide) {
  return C.referImpedance({ R: RX.R, X: RX.X }, 'primary', refSide, base.a);
}

function renderReferredTable(refSide) {
  const Rcc = refer({ R: base.RccP, X: base.XccP }, refSide);
  const RfeXm = refer({ R: base.RfeP, X: base.XmP }, refSide);
  setText('res-rcc', fmt(Rcc.R, 5));
  setText('res-xcc', fmt(Rcc.X, 5));
  setText('res-rfe', isFinite(RfeXm.R) ? fmt(RfeXm.R, 2) : '∞');
  setText('res-xm', isFinite(RfeXm.X) ? fmt(RfeXm.X, 2) : '∞');
  setText('res-refside-label', refSide === 'primary' ? 'Primary' : 'Secondary');
  return { Rcc, RfeXm };
}

function solvePhysicalOperatingPoint(loadPct, cosPhi, pfType) {
  const split = C.splitTModel(base.RccP, base.XccP);
  const isShort = forcedLoadState === 'short';
  const ZloadSecondary = isShort ? { re: 0, im: 0 } : C.buildLoadImpedance(loadPct, base.SnPhaseVA, base.U2nPhase, cosPhi, pfType);
  const ZloadPrimary = ZloadSecondary ? { re: ZloadSecondary.re * base.a * base.a, im: ZloadSecondary.im * base.a * base.a } : null;

  const exact = C.solveExactTModel({
    U1: base.U1nPhase, R1: split.R1, X1: split.X1, R2p: split.R2, X2p: split.X2,
    Rfe: base.RfeP, Xm: base.XmP, ZloadPrimary
  });

  const I1mag = C.cMag(exact.I1);
  const I1angDeg = C.toDegrees(C.cAngle(exact.I1));
  const I2actual = { re: exact.I2p.re * base.a, im: exact.I2p.im * base.a };
  const U2actual = { re: exact.U2p.re / base.a, im: exact.U2p.im / base.a };
  const I2mag = C.cMag(I2actual);
  const I2angDeg = C.toDegrees(C.cAngle(I2actual));
  const U2mag = C.cMag(U2actual);
  const U2angDeg = C.toDegrees(C.cAngle(U2actual));
  const regulationPct = ((base.U2nPhase - U2mag) / base.U2nPhase) * 100;

  return { exact, I1mag, I1angDeg, I2mag, I2angDeg, U2mag, U2angDeg, regulationPct, ZloadSecondary };
}

function solveApproxOperatingPoint(loadPct, cosPhi, pfType) {
  const kapp = C.solveApproxKapp({ RccPct: base.pctRcc, XccPct: base.pctXcc, U2n: base.U2nPhase, Spct: loadPct, cosPhi, pfType, a: base.a });
  if (loadPct <= 0) {
    // The ideal-ratio approximation (I1 = I2/a) gives I1 = 0 at no load, which
    // hides the magnetizing current entirely. Show the actual open-circuit
    // excitation current instead, taken from the OC test and referred to the
    // primary — this only matters at Spct=0, the approximation is unaffected
    // anywhere else.
    const I0mag = Math.hypot(base.oc.Ife, base.oc.Imag);
    const I0primary = base.ocSide === 'primary' ? I0mag : I0mag / base.a;
    const phi0Deg = C.toDegrees(Math.acos(Math.max(-1, Math.min(1, base.oc.cosPhi0))));
    return { epsilonPct: kapp.epsilonPct, U2mag: kapp.U2, I1mag: I0primary, I2mag: 0, I1angDeg: -phi0Deg, I2angDeg: 0 };
  }
  const I2mag = (loadPct / 100) * base.rc.I2n;
  const I1mag = I2mag / base.a;
  const phi = Math.acos(Math.max(-1, Math.min(1, cosPhi)));
  const signedPhiDeg = C.toDegrees(phi) * (pfType === 'lead' ? 1 : -1);
  return { epsilonPct: kapp.epsilonPct, U2mag: kapp.U2, I1mag, I2mag, I1angDeg: signedPhiDeg, I2angDeg: signedPhiDeg };
}

function renderOperatingPoint() {
  const { loadPct, cosPhi, pfType } = currentLoadInputs();
  let { modelType, refSide } = currentLoadInputs();
  if (isNaN(cosPhi) || cosPhi <= 0 || cosPhi > 1) return;

  const isShort = forcedLoadState === 'short';
  if (isShort && modelType !== 'exact') {
    // Kapp's linear approximation is not valid at Zload=0; force the exact model.
    el('model-type').value = 'exact';
    modelType = 'exact';
  }

  let U2mag, U2angDeg, regulationPct, I1mag, I2mag, I1angDeg, I2angDeg;
  if (modelType === 'exact') {
    const r = solvePhysicalOperatingPoint(loadPct, cosPhi, pfType);
    U2mag = r.U2mag; U2angDeg = r.U2angDeg; regulationPct = r.regulationPct;
    I1mag = r.I1mag; I2mag = r.I2mag; I1angDeg = r.I1angDeg; I2angDeg = r.I2angDeg;
  } else {
    const r = solveApproxOperatingPoint(loadPct, cosPhi, pfType);
    U2mag = r.U2mag; U2angDeg = 0; regulationPct = r.epsilonPct;
    I1mag = r.I1mag; I2mag = r.I2mag; I1angDeg = r.I1angDeg; I2angDeg = r.I2angDeg;
  }

  setText('res-u2', fmt(U2mag, 3));
  setText('res-regulation', fmt(regulationPct, 3));
  setText('res-i1-op', fmt(I1mag, 3));
  setText('res-i1-op-unit', 'A ∠ ' + fmt(I1angDeg, 2) + '°');
  setText('res-i2-op', fmt(I2mag, 3));
  setText('res-i2-op-unit', 'A ∠ ' + fmt(I2angDeg, 2) + '°');

  const loadState = isShort ? 'short' : (loadPct <= 0 ? 'open' : 'loaded');
  el('load-pct-value').textContent = isShort ? '— Short circuit (Z_load = 0)' : '— ' + loadPct + '%';

  const disp = renderReferredTable(refSide);
  const split = C.splitTModel(disp.Rcc.R, disp.Rcc.X);

  let loadLabelRef = '';
  if (loadState === 'loaded') {
    const zs = C.buildLoadImpedance(loadPct, base.SnPhaseVA, base.U2nPhase, cosPhi, pfType);
    const zr = refSide === 'secondary' ? zs : { re: zs.re * base.a * base.a, im: zs.im * base.a * base.a };
    loadLabelRef = `${fmt(zr.re, 3)} + j${fmt(zr.im, 3)} Ω`;
  }

  const diagramSvg = P.buildCircuitDiagramSVG({
    modelType,
    R1: modelType === 'exact' ? split.R1 : disp.Rcc.R,
    X1: modelType === 'exact' ? split.X1 : disp.Rcc.X,
    R2: split.R2, X2: split.X2,
    Rfe: disp.RfeXm.R, Xm: disp.RfeXm.X,
    loadState,
    loadLabel: loadLabelRef,
    U1Label: refSide === 'primary' ? fmt(base.U1nPhase, 2) + ' V' : fmt(base.U1nPhase / base.a, 2) + ' V',
    U2Label: refSide === 'primary' ? fmt(U2mag * base.a, 2) + ' V' : fmt(U2mag, 2) + ' V',
    refSideLabel: refSide === 'primary' ? 'Referred to primary' : 'Referred to secondary'
  });
  el('xfm-diagram').innerHTML = diagramSvg;

  // "U2'"/"I2'" (primed) means "referred to the other side"; when refSide is
  // secondary these are the actual secondary quantities, so drop the prime.
  const phasorSvg = P.buildPhasorSVG({
    U1: { mag: base.U1nPhase, angleDeg: 0 },
    U2: { mag: refSide === 'primary' ? U2mag * base.a : U2mag, angleDeg: U2angDeg, label: refSide === 'secondary' ? 'U2' : "U2'" },
    I1: { mag: I1mag, angleDeg: I1angDeg },
    I2: { mag: I2mag, angleDeg: I2angDeg, label: refSide === 'secondary' ? 'I2' : "I2'" }
  });
  el('xfm-phasor').innerHTML = phasorSvg;
}

function fullCompute() {
  const { errors } = validateInputs();
  if (errors.length) {
    showError(errors[0]);
    el('results-wrap')?.classList.add('is-hidden');
    return;
  }
  showError('');
  try {
    base = computeBase();
  } catch (e) {
    showError('Could not solve the equivalent circuit with these test values. Please review the short-circuit and open-circuit readings.');
    return;
  }
  el('results-wrap')?.classList.remove('is-hidden');
  renderCircuitParams();
  renderOperatingPoint();
}

function setupExample() {
  el('system-type').value = EXAMPLE_VALUES.systemType;
  el('sn-kva').value = EXAMPLE_VALUES.SnKVA;
  el('u1n').value = EXAMPLE_VALUES.U1n;
  el('u2n').value = EXAMPLE_VALUES.U2n;
  el('frequency').value = EXAMPLE_VALUES.frequency;
  el('sc-side').value = EXAMPLE_VALUES.scSide;
  el('sc-v').value = EXAMPLE_VALUES.scV;
  el('sc-i').value = EXAMPLE_VALUES.scI;
  el('sc-p').value = EXAMPLE_VALUES.scP;
  el('oc-side').value = EXAMPLE_VALUES.ocSide;
  el('oc-v').value = EXAMPLE_VALUES.ocV;
  el('oc-i').value = EXAMPLE_VALUES.ocI;
  el('oc-p').value = EXAMPLE_VALUES.ocP;
  el('model-type').value = EXAMPLE_VALUES.modelType;
  el('ref-side').value = EXAMPLE_VALUES.refSide;
  el('load-pct').value = EXAMPLE_VALUES.loadPct;
  el('load-pct-value').textContent = '— ' + EXAMPLE_VALUES.loadPct + '%';
  el('load-cosphi').value = EXAMPLE_VALUES.loadCosPhi;
  el('load-pf-type').value = EXAMPLE_VALUES.loadPfType;
  updateThreePhaseVisibility();
}

function wireEvents() {
  el('system-type').addEventListener('change', updateThreePhaseVisibility);
  el('btn-calculate').addEventListener('click', fullCompute);

  ['load-pct', 'load-cosphi', 'load-pf-type', 'model-type', 'ref-side'].forEach(id => {
    el(id).addEventListener('input', () => { if (base) renderOperatingPoint(); });
  });
  el('load-pct').addEventListener('input', () => {
    forcedLoadState = null;
    el('load-pct-value').textContent = '— ' + el('load-pct').value + '%';
  });
  el('btn-load-open').addEventListener('click', () => {
    forcedLoadState = null;
    el('load-pct').value = 0;
    el('load-pct-value').textContent = '— 0%';
    if (base) renderOperatingPoint();
  });
  el('btn-load-short').addEventListener('click', () => {
    forcedLoadState = 'short';
    if (base) renderOperatingPoint();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupExample();
  wireEvents();
  // Run once with the pre-filled worked example so the page never loads
  // empty — the student sees a live result immediately and can then change
  // any field and press Calculate to replace it with their own case.
  fullCompute();

  if (window.location.hash === '#selftest') {
    const r = C.runValidationSuite();
    console.log(`[xfm self-test] ${r.pass}/${r.total} passed`, r.results);
  }
});
