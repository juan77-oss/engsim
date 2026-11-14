/**
 * pressure-vessel-simulator.js
 * Orchestration only: reads inputs, calls core + plot, writes the DOM.
 * Physics lives in pressure-vessel-core.js (never modified here).
 */
import * as core from './pressure-vessel-core.js';
import { UNIT_SYSTEMS, DEFAULTS, PRESSURE_SLIDERS, B0_RULES, TORI_L_OVER_D, TORI_R_OVER_D, UTIL_WARN } from './pressure-vessel-constants.js';
import { vesselSectionSVG, lameRingSVG, lameChartSVG, flangeSVG } from './pressure-vessel-plot.js';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const ES = {}; // Spanish strings are added when the /es/ version is built
function _t(s) {
  const lang = (document.documentElement.lang || 'en').toLowerCase();
  return (lang.startsWith('es') && ES[s]) || s;
}

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = { system: 'US', module: 'thin' };
const usStore = {}; // canonical values in US units, so unit switches do not accumulate rounding
let rafId = 0;

const factor = (q) => UNIT_SYSTEMS[state.system][q || 'none'].f;
const unitOf = (q) => UNIT_SYSTEMS[state.system][q || 'none'].unit;

function fmt(x, sig = 4) {
  if (!Number.isFinite(x)) return '\u2014';
  const ax = Math.abs(x);
  if (ax === 0) return '0';
  if (ax >= 1000) return Math.round(x).toLocaleString('en-US');
  if (ax >= 100) return x.toFixed(1);
  return parseFloat(x.toPrecision(sig)).toString();
}
const fmtQ = (us, q, sig = 4) => fmt(us * factor(q), sig);
const fmtQU = (us, q, sig = 4) => `${fmtQ(us, q, sig)} ${unitOf(q)}`;
const pct = (x) => (Number.isFinite(x) ? `${fmt(x * 100, 3)} %` : '\u2014');

function inputQ(el) { return el.getAttribute('data-q') || 'none'; }

/** Value of an input in US units, NaN when empty. */
function read(id) {
  const el = $(id);
  if (!el || el.value === '') return NaN;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v / factor(inputQ(el)) : NaN;
}

function writeUS(id, us) {
  const el = $(id);
  if (!el) return;
  usStore[id] = us;
  el.value = String(parseFloat((us * factor(inputQ(el))).toPrecision(6)));
}

function setText(id, s) { const el = $(id); if (el) el.textContent = s; }
function setHTML(id, s) { const el = $(id); if (el) el.innerHTML = s; }

function showError(msg) {
  const el = $('sim-error');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function setBanner(prefix, kind, title, message) {
  const b = $(`${prefix}-banner`);
  if (!b) return;
  ['success', 'warning', 'danger', 'info'].forEach((k) => b.classList.remove(`status-banner--${k}`));
  b.classList.add(`status-banner--${kind}`);
  setText(`${prefix}-banner-title`, title);
  setText(`${prefix}-banner-msg`, message || '');
}

function clearOutputs(prefix, hosts = []) {
  $$(`[id^="${prefix}-out-"]`).forEach((el) => { el.textContent = '\u2014'; });
  hosts.forEach((h) => setHTML(h, ''));
  setBanner(prefix, 'info', _t('Check the inputs'), _t('Fill in every field with a valid positive number.'));
}

function utilKind(u) {
  if (!Number.isFinite(u)) return 'info';
  if (u > 1) return 'danger';
  if (u > UTIL_WARN) return 'warning';
  return 'success';
}

function markCard(id, u) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('sim-result-card--limiting');
  if (Number.isFinite(u) && u > 1) el.classList.add('sim-result-card--limiting');
}

/* ------------------------------------------------------------------ *
 * Units
 * ------------------------------------------------------------------ */

function refreshUnitLabels() {
  $$('.pv-u').forEach((el) => { el.textContent = unitOf(el.getAttribute('data-uq')); });
}

function setupSliders() {
  $$('.pv-range').forEach((r) => {
    const target = r.getAttribute('data-for');
    const spec = PRESSURE_SLIDERS[target];
    if (!spec) return;
    const f = factor('stress');
    r.min = String(spec[0] * f);
    r.max = String(spec[1] * f);
    r.step = String((spec[1] - spec[0]) * f / 400);
    const el = $(target);
    if (el && el.value !== '') {
      const v = parseFloat(el.value);
      if (v > parseFloat(r.max)) r.max = String(v * 1.5);
      r.value = String(v);
    }
  });
}

function sliderFrac(targetId) {
  const r = document.querySelector(`.pv-range[data-for="${targetId}"]`);
  const v = parseFloat($(targetId).value);
  if (!r || !Number.isFinite(v)) return 0.5;
  const mx = parseFloat(r.max);
  return mx > 0 ? v / mx : 0.5;
}

function switchSystem(next) {
  if (next === state.system) return;
  const entries = $$('.pv-live[data-q]').filter((el) => inputQ(el) !== 'none' && el.value !== '');
  const us = entries.map((el) => [el, usStore[el.id] !== undefined ? usStore[el.id] : parseFloat(el.value) / factor(inputQ(el))]);
  state.system = next;
  us.forEach(([el, v]) => { el.value = String(parseFloat((v * factor(inputQ(el))).toPrecision(6))); });
  refreshUnitLabels();
  setupSliders();
  schedule();
}

/* ------------------------------------------------------------------ *
 * Module: thin wall
 * ------------------------------------------------------------------ */

function computeThin() {
  const shape = $('th-shape').value;
  const P = read('th-P'), Ri = read('th-Ri'), S = read('th-S'), E = read('th-E'), CA = read('th-CA'), t = read('th-t'), C = read('th-C');
  const hosts = ['th-svg-host', 'th-heads'];
  if (![P, Ri, S, E, CA, t, C].every(Number.isFinite) || P <= 0 || Ri <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0 || t <= 0 || C <= 0) {
    clearOutputs('th', hosts);
    showError(_t('Thin wall: enter positive values (E between 0 and 1, corrosion allowance 0 or more).'));
    return;
  }
  showError('');

  const shell = shape === 'sphere' ? core.sphericalShell({ P, Ri, S, E, CA }) : core.cylinderShell({ P, Ri, S, E, CA });
  if (!shell.ok) {
    clearOutputs('th', hosts);
    showError(_t('The pressure is too high for this S and E: no thickness works with the thin-wall formulas. Use the thick-wall module.'));
    return;
  }
  const treq = shell.tTotal;
  const util = treq / t;
  const mawp = shape === 'sphere' ? core.sphereMAWP({ Ri, tActual: t, S, E, CA }) : core.cylinderMAWP({ Ri, tActual: t, S, E, CA });
  const tNet = t - CA;
  const mem = tNet > 0 ? core.membraneStresses({ P, Ri: Ri + CA, t: tNet, shape }) : { ok: false };

  setText('th-out-treq', fmtQ(treq, 'length'));
  setText('th-out-util', pct(util));
  setText('th-out-mawp', mawp.ok ? fmtQ(mawp.P, 'stress') : '\u2014');
  setText('th-out-gov', shape === 'sphere' ? _t('Equal in all directions') : (shell.governs === 'circumferential' ? _t('Hoop') : _t('Axial')));
  setText('th-out-hoop', mem.ok ? fmtQ(mem.sigmaHoop, 'stress') : '\u2014');
  setText('th-out-long', mem.ok ? fmtQ(mem.sigmaLong, 'stress') : '\u2014');
  setText('th-out-tcirc', fmtQ(shape === 'sphere' ? shell.t : shell.tCirc, 'length'));
  setText('th-out-tlong', shape === 'sphere' ? '\u2014' : fmtQ(shell.tLong, 'length'));
  markCard('th-card-util', util);

  if (util > 1) {
    setBanner('th', 'danger', _t('Wall too thin'), `${_t('Required')} ${fmtQU(treq, 'length')} ${_t('but only')} ${fmtQU(t, 'length')} ${_t('provided.')}`);
  } else if (!shell.thinOk) {
    setBanner('th', 'warning', _t('Outside the thin-wall range'), _t('The pressure or thickness is too large for the thin-wall formulas. Check the thick-wall module.'));
  } else if (util > UTIL_WARN) {
    setBanner('th', 'warning', _t('Adequate, little margin'), `${_t('Utilization')} ${pct(util)}.`);
  } else {
    setBanner('th', 'success', _t('Wall is adequate'), `${_t('Utilization')} ${pct(util)}.`);
  }
  setText('th-validity', shell.thinOk
    ? _t('The thin-wall hypothesis is valid for these data.')
    : _t('Thin-wall hypothesis not valid: the thickness exceeds half the radius or the pressure is too high compared with S\u00B7E.'));

  // Heads comparison (same P, R, S, E, CA)
  const D = 2 * Ri;
  const rows = [];
  const cyl = core.cylinderShell({ P, Ri, S, E, CA });
  if (cyl.ok) rows.push([_t('Cylinder shell'), cyl.tTotal]);
  const hemi = core.hemisphericalHead({ P, Ri, S, E, CA });
  if (hemi.ok) rows.push([_t('Hemispherical head'), hemi.tTotal]);
  const ell = core.ellipsoidalHead({ P, D, ratio: 2, S, E, CA });
  if (ell.ok) rows.push([_t('Ellipsoidal 2:1 head'), ell.tTotal]);
  const tor = core.torisphericalHead({ P, L: D * TORI_L_OVER_D, r: D * TORI_R_OVER_D, S, E, CA });
  if (tor.ok) rows.push([_t('Torispherical head'), tor.tTotal]);
  const flat = core.flatHead({ P, d: D, C, S, E: 1, CA });
  if (flat.ok) rows.push([_t('Flat plate'), flat.tTotal]);
  setText('th-out-flat', flat.ok ? fmtQ(flat.tTotal, 'length') : '\u2014');
  const maxT = Math.max(...rows.map((r) => r[1]), 1e-12);
  const minT = Math.min(...rows.map((r) => r[1]));
  setHTML('th-heads', rows.map(([name, v]) => {
    const cls = v > t ? 'pv-bar__fill--bad' : (v === minT ? 'pv-bar__fill--min' : '');
    return `<div class="pv-bar"><span class="pv-bar__label">${name}</span>` +
      `<span class="pv-bar__track"><span class="pv-bar__fill ${cls}" style="width:${(100 * v / maxT).toFixed(1)}%"></span></span>` +
      `<span class="pv-bar__value">${fmtQ(v, 'length')} ${unitOf('length')}</span></div>`;
  }).join(''));

  // Diagram
  setHTML('th-svg-host', vesselSectionSVG({
    shape,
    Ri: Ri + CA,
    t: Math.max(tNet, 1e-6),
    util,
    pFrac: sliderFrac('th-P'),
    labels: {
      P: `P = ${fmtQU(P, 'stress', 4)}`,
      hoop: mem.ok ? `${shape === 'sphere' ? '\u03C3' : '\u03C3\u03B8'} = ${fmtQU(mem.sigmaHoop, 'stress', 4)}` : '',
      long: mem.ok && shape !== 'sphere' ? `\u03C3z = ${fmtQU(mem.sigmaLong, 'stress', 4)}` : ''
    }
  }));
}

/* ------------------------------------------------------------------ *
 * Module: thick wall
 * ------------------------------------------------------------------ */

function computeThick() {
  const Pi = read('tk-Pi'), Po = read('tk-Po'), Ri = read('tk-Ri'), t = read('tk-t'), S = read('tk-S'), E = read('tk-E'), CA = read('tk-CA');
  const hosts = ['tk-ring-host', 'tk-chart-host'];
  if (![Pi, Po, Ri, t, S, E, CA].every(Number.isFinite) || Pi <= 0 || Po < 0 || Ri <= 0 || t <= 0 || S <= 0 || E <= 0 || E > 1 || CA < 0 || CA >= t) {
    clearOutputs('tk', hosts);
    setText('tk-validity', '');
    setText('tk-probe-read', '');
    showError(_t('Thick wall: enter positive values (the corrosion allowance must be smaller than the thickness).'));
    return;
  }
  showError('');

  const a = Ri + CA;
  const b = Ri + t;
  const profile = core.lameProfile({ a, b, Pi, Po, n: 81 });
  const bore = core.lameBore({ a, b, Pi, Po });
  if (!profile.ok || !bore.ok) { clearOutputs('tk', hosts); return; }

  const req = core.thickWallRequired({ P: Pi, Ri, S, E, CA });
  const thin = core.cylinderShell({ P: Pi, Ri, S, E, CA });
  const util = bore.sigmaTheta / (S * E);

  if (req.ok) {
    setText('tk-out-treq', fmtQ(req.tTotal, 'length'));
  } else {
    setText('tk-out-treq', _t('none'));
  }
  setText('tk-out-util', pct(util));
  setText('tk-out-hoop', fmtQ(bore.sigmaTheta, 'stress'));
  setText('tk-out-tresca', fmtQ(bore.tresca, 'stress'));
  setText('tk-out-ratio', fmt(b / a, 4));
  setText('tk-out-axial', fmtQ(bore.sigmaZ, 'stress'));
  if (req.ok && thin.ok) {
    const thinTotal = thin.tCirc + CA;
    setText('tk-out-thin', fmtQ(thinTotal, 'length'));
    setText('tk-out-err', `${fmt(100 * (thinTotal - req.tTotal) / req.tTotal, 3)} %`);
  } else {
    setText('tk-out-thin', '\u2014');
    setText('tk-out-err', '\u2014');
  }
  markCard('tk-card-util', util);

  if (!req.ok) {
    setBanner('tk', 'danger', _t('Pressure too high'), _t('The internal pressure reaches S\u00B7E: no wall thickness can carry it with this material.'));
  } else if (util > 1) {
    setBanner('tk', 'danger', _t('Wall too thin'), `${_t('Required')} ${fmtQU(req.tTotal, 'length')} ${_t('but only')} ${fmtQU(t, 'length')} ${_t('provided.')}`);
  } else if (util > UTIL_WARN) {
    setBanner('tk', 'warning', _t('Adequate, little margin'), `${_t('Hoop stress at the bore is')} ${pct(util)} ${_t('of S\u00B7E.')}`);
  } else {
    setBanner('tk', 'success', _t('Wall is adequate'), `${_t('Hoop stress at the bore is')} ${pct(util)} ${_t('of S\u00B7E.')}`);
  }
  let note = req.ok && req.thickRequired
    ? _t('The thick-wall method is required here (thickness above half the radius or pressure above 0.385 S\u00B7E).')
    : _t('The thin-wall formulas would also be acceptable for these data.');
  if (Po > 0) note += ' ' + _t('External pressure is included in the stresses; the thickness formula assumes internal pressure only and does not check buckling.');
  setText('tk-validity', note);

  // Probe
  const frac = parseFloat($('tk-probe').value) / 100;
  const rp = a + frac * (b - a);
  const sp = core.lameStress({ a, b, Pi, Po, r: rp });
  if (sp.ok) {
    setText('tk-probe-read', `r = ${fmtQU(rp, 'length')}   \u03C3\u03B8 = ${fmtQU(sp.sigmaTheta, 'stress')}   \u03C3r = ${fmtQU(sp.sigmaR, 'stress')}   \u03C3z = ${fmtQU(sp.sigmaZ, 'stress')}`);
  }

  const ths = profile.points.map((p) => p.sigmaTheta);
  setHTML('tk-ring-host', lameRingSVG({
    points: profile.points, a, b, probeFrac: frac,
    legend: { title: _t('hoop stress'), lo: fmtQU(Math.min(...ths), 'stress', 3), hi: fmtQU(Math.max(...ths), 'stress', 3) }
  }));
  setHTML('tk-chart-host', lameChartSVG({
    points: profile.points, a, b, probeFrac: frac,
    sf: factor('stress'), lf: factor('length'), allow: S * E,
    fmtS: (v) => fmtQ(v, 'stress', 3), fmtL: (v) => fmtQ(v, 'length', 3),
    units: { length: unitOf('length'), stress: unitOf('stress') }
  }));
}

/* ------------------------------------------------------------------ *
 * Module: flange and bolts
 * ------------------------------------------------------------------ */

function computeFlange() {
  const ids = ['fl-P', 'fl-gid', 'fl-gN', 'fl-m', 'fl-y', 'fl-Sa', 'fl-Sb', 'fl-Sfo', 'fl-Sfa', 'fl-A', 'fl-B', 'fl-C', 'fl-t', 'fl-nb', 'fl-d'];
  const v = {};
  ids.forEach((id) => { v[id] = read(id); });
  const rule = $('fl-b0rule').value;
  const b0Manual = rule === 'manual' ? read('fl-b0') : null;
  const areaOverride = read('fl-area');
  const hosts = ['fl-svg-host', 'fl-bars'];

  const bad = ids.some((id) => !Number.isFinite(v[id])) ||
    v['fl-P'] <= 0 || v['fl-gid'] <= 0 || v['fl-gN'] <= 0 || v['fl-m'] < 0 || v['fl-y'] < 0 ||
    v['fl-Sa'] <= 0 || v['fl-Sb'] <= 0 || v['fl-Sfo'] <= 0 || v['fl-Sfa'] <= 0 ||
    v['fl-A'] <= 0 || v['fl-B'] <= 0 || v['fl-C'] <= 0 || v['fl-t'] <= 0 || v['fl-nb'] < 1 || v['fl-d'] <= 0 ||
    (rule === 'manual' && !(b0Manual > 0));
  if (bad) {
    clearOutputs('fl', hosts);
    showError(_t('Flange: enter positive values in every field.'));
    return;
  }
  if (!(v['fl-A'] > v['fl-C'] && v['fl-C'] > v['fl-B'])) {
    clearOutputs('fl', hosts);
    showError(_t('Flange: the dimensions must satisfy A > C > B (outside diameter > bolt circle > bore).'));
    return;
  }

  const geom = core.gasketGeometry({
    gasketId: v['fl-gid'], widthN: v['fl-gN'],
    b0Factor: B0_RULES[rule] || 0.5, b0Manual
  });
  if (!geom.ok) { clearOutputs('fl', hosts); showError(_t('Gasket data not valid.')); return; }
  if (geom.G >= v['fl-C']) {
    clearOutputs('fl', hosts);
    showError(_t('The gasket reaction diameter G must be smaller than the bolt circle C. Check the gasket size.'));
    return;
  }
  showError('');

  const rootEach = areaOverride > 0 ? areaOverride : core.boltRootArea({ d: v['fl-d'], tpi: core.defaultTpi(v['fl-d']) }).area;
  const Ab = Math.round(v['fl-nb']) * rootEach;
  const bl = core.boltLoads({ P: v['fl-P'], G: geom.G, b: geom.b, m: v['fl-m'], y: v['fl-y'], Sa: v['fl-Sa'], Sb: v['fl-Sb'], Ab });
  if (!bl.ok) { clearOutputs('fl', hosts); showError(_t('Bolt data not valid.')); return; }
  const fs = core.ringFlangeStress({
    A: v['fl-A'], B: v['fl-B'], C: v['fl-C'], G: geom.G, t: v['fl-t'], P: v['fl-P'],
    Wm1: bl.Wm1, W: bl.W, Sfo: v['fl-Sfo'], Sfa: v['fl-Sfa']
  });
  if (!fs.ok) { clearOutputs('fl', hosts); showError(_t('Flange geometry not valid.')); return; }

  const boltUtil = bl.Am / Ab;
  const rOp = fs.STop / v['fl-Sfo'];
  const rSeat = fs.STseat / v['fl-Sfa'];
  const flUtil = Math.max(rOp, rSeat);
  const worstOp = rOp >= rSeat;

  setText('fl-out-Am', fmtQ(bl.Am, 'area'));
  setText('fl-out-Am-note', bl.areaGoverns === 'operating' ? _t('operating condition governs') : _t('gasket seating governs'));
  setText('fl-out-Ab', fmtQ(Ab, 'area'));
  setText('fl-out-Ab-note', `${Math.round(v['fl-nb'])} \u00D7 ${fmtQU(rootEach, 'area', 3)}`);
  setText('fl-out-Wgov', fmtQ(bl.Wgov, 'force'));
  setText('fl-out-ST', fmtQ(worstOp ? fs.STop : fs.STseat, 'stress'));
  setText('fl-out-ST-note', `${worstOp ? _t('operating') : _t('seating')}: ${pct(flUtil)} ${_t('of allowable')}`);
  setText('fl-out-b', `${fmtQ(geom.b0, 'length', 3)} / ${fmtQ(geom.b, 'length', 3)}`);
  setText('fl-out-G', fmtQ(geom.G, 'length'));
  setText('fl-out-H', fmtQ(bl.H, 'force'));
  setText('fl-out-Hp', fmtQ(bl.Hp, 'force'));
  setText('fl-out-Wm1', fmtQ(bl.Wm1, 'force'));
  setText('fl-out-Wm2', fmtQ(bl.Wm2, 'force'));
  setText('fl-out-MoOp', fmtQ(fs.MoOp, 'moment'));
  setText('fl-out-MoSeat', fmtQ(fs.MoSeat, 'moment'));
  setText('fl-out-STop', fmtQ(fs.STop, 'stress'));
  setText('fl-out-STseat', fmtQ(fs.STseat, 'stress'));
  markCard('fl-card-Ab', boltUtil);
  markCard('fl-card-ST', flUtil);

  const worst = Math.max(boltUtil, flUtil);
  if (boltUtil > 1 && flUtil > 1) {
    setBanner('fl', 'danger', _t('Bolts and flange fail'), _t('Add bolt area and increase the flange thickness.'));
  } else if (boltUtil > 1) {
    setBanner('fl', 'danger', _t('Not enough bolt area'), `${_t('Required')} ${fmtQU(bl.Am, 'area')} ${_t('but only')} ${fmtQU(Ab, 'area')} ${_t('provided.')}`);
  } else if (flUtil > 1) {
    setBanner('fl', 'danger', _t('Flange too thin'), `${_t('Tangential stress is')} ${pct(flUtil)} ${_t('of the allowable.')}`);
  } else if (worst > UTIL_WARN) {
    setBanner('fl', 'warning', _t('Adequate, little margin'), `${_t('Bolts')} ${pct(boltUtil)} / ${_t('flange')} ${pct(flUtil)}.`);
  } else {
    setBanner('fl', 'success', _t('Joint is adequate'), `${_t('Bolts')} ${pct(boltUtil)} / ${_t('flange')} ${pct(flUtil)}.`);
  }

  // Bars
  const bars = [
    [_t('Am1 operating'), bl.Am1, ''],
    [_t('Am2 seating'), bl.Am2, ''],
    [_t('Am required'), bl.Am, 'pv-bar__fill--min'],
    [_t('Ab provided'), Ab, Ab >= bl.Am ? '' : 'pv-bar__fill--bad']
  ];
  const maxA = Math.max(...bars.map((r) => r[1]), 1e-12);
  setHTML('fl-bars', bars.map(([name, val, cls]) =>
    `<div class="pv-bar"><span class="pv-bar__label">${name}</span>` +
    `<span class="pv-bar__track"><span class="pv-bar__fill ${cls}" style="width:${(100 * val / maxA).toFixed(1)}%"></span></span>` +
    `<span class="pv-bar__value">${fmtQ(val, 'area')} ${unitOf('area')}</span></div>`).join(''));

  // Diagram
  const lab = (f) => fmtQU(f, 'force', 3);
  setHTML('fl-svg-host', flangeSVG({
    g: { A: v['fl-A'], B: v['fl-B'], C: v['fl-C'], G: geom.G, gOD: geom.od, gID: v['fl-gid'], t: v['fl-t'], d: v['fl-d'] },
    loads: { W: bl.Wgov, HD: fs.HD, HT: fs.HT, HG: fs.HG },
    arms: { hD: fs.hD, hT: fs.hT, hG: fs.hG },
    labels: { W: `W = ${lab(bl.Wgov)}`, HD: lab(fs.HD), HT: lab(fs.HT), HG: lab(fs.HG), Mo: `Mo = ${fmtQU(fs.MoOp, 'moment', 4)}` },
    util: flUtil
  }));
}

/* ------------------------------------------------------------------ *
 * Orchestration
 * ------------------------------------------------------------------ */

function compute() {
  rafId = 0;
  if (state.module === 'thin') computeThin();
  else if (state.module === 'thick') computeThick();
  else computeFlange();
}

function schedule() {
  if (rafId) return;
  rafId = requestAnimationFrame(compute);
}

function setModule(name) {
  state.module = name;
  $$('.pv-seg__btn').forEach((b) => {
    const on = b.getAttribute('data-module') === name;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  ['thin', 'thick', 'flange'].forEach((m) => {
    $(`group-${m}`).classList.toggle('is-hidden', m !== name);
    $(`view-${m}`).classList.toggle('is-hidden', m !== name);
  });
  showError('');
  schedule();
}

function setupFullscreen() {
  $$('.pv-fs-wrap').forEach((wrap) => {
    const btn = wrap.querySelector('.sim-chart-fullscreen-btn');
    if (!btn) return;
    const apply = (on) => {
      wrap.classList.toggle('is-fullscreen', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    btn.addEventListener('click', () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
      if (fsEl === wrap) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else if (req) {
        req.call(wrap);
      } else {
        wrap.classList.toggle('pv-fs-fallback');
        apply(wrap.classList.contains('pv-fs-fallback'));
      }
    });
    const onChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      apply(fsEl === wrap);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
  });
}

function setup() {
  // defaults (stored in US units)
  Object.entries(DEFAULTS).forEach(([id, us]) => writeUS(id, us));
  refreshUnitLabels();
  setupSliders();

  $('select-system').addEventListener('change', (e) => switchSystem(e.target.value));
  $$('.pv-seg__btn').forEach((b) => b.addEventListener('click', () => setModule(b.getAttribute('data-module'))));

  $$('.pv-live').forEach((el) => {
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      if (el.id === 'fl-b0rule') $('field-b0').classList.toggle('is-hidden', el.value !== 'manual');
      if (el.hasAttribute('data-q') && el.value !== '' && Number.isFinite(parseFloat(el.value))) usStore[el.id] = parseFloat(el.value) / factor(inputQ(el));
      const r = document.querySelector(`.pv-range[data-for="${el.id}"]`);
      if (r && el.value !== '') {
        const val = parseFloat(el.value);
        if (val > parseFloat(r.max)) r.max = String(val * 1.5);
        r.value = String(val);
      }
      schedule();
    });
  });

  $$('.pv-range').forEach((r) => {
    r.addEventListener('input', () => {
      const t = $(r.getAttribute('data-for'));
      t.value = String(parseFloat(parseFloat(r.value).toPrecision(5)));
      usStore[t.id] = parseFloat(t.value) / factor(inputQ(t));
      schedule();
    });
  });

  $('tk-probe').addEventListener('input', schedule);
  setupFullscreen();

  if (location.hash === '#selftest') {
    const res = core.runValidationSuite();
    console.table(res.results.map((r) => ({ test: r.name, pass: r.pass, detail: r.detail })));
    console.log(`Pressure vessel self-test: ${res.passed}/${res.total}`);
    if (!res.allPassed) showError(`Self-test failed: ${res.total - res.passed} check(s). See console.`);
  }

  setModule('thin');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
else setup();
