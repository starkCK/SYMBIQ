(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var SS_KEY = 'symbiq.qz.v1';
  var LS_KEY = 'symbiq.qz.seen.v1';
  var EPS = 1e-9;

  var reduced = window.SymbiQ.core.reduced();

  function cm(p, q) { return [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; }
  function cadd(p, q) { return [p[0] + q[0], p[1] + q[1]]; }
  function cabs2(p) { return p[0] * p[0] + p[1] * p[1]; }
  function carg(p) { return Math.atan2(p[1], p[0]); }
  function cconj(p) { return [p[0], -p[1]]; }

  var S2 = 1 / Math.sqrt(2), C4 = Math.cos(Math.PI / 4), S4 = Math.sin(Math.PI / 4);
  var G = {
    I: [[1, 0], [0, 0], [0, 0], [1, 0]],
    X: [[0, 0], [1, 0], [1, 0], [0, 0]],
    Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
    Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
    H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
    S: [[1, 0], [0, 0], [0, 0], [0, 1]],
    T: [[1, 0], [0, 0], [0, 0], [C4, S4]]
  };

  function matVec(m, v) {
    return [cadd(cm(m[0], v[0]), cm(m[1], v[1])),
            cadd(cm(m[2], v[0]), cm(m[3], v[1]))];
  }
  function matMul(a, b) {
    return [cadd(cm(a[0], b[0]), cm(a[1], b[2])),
            cadd(cm(a[0], b[1]), cm(a[1], b[3])),
            cadd(cm(a[2], b[0]), cm(a[3], b[2])),
            cadd(cm(a[2], b[1]), cm(a[3], b[3]))];
  }

  function nameOf(u) {
    var i, k, ref = null;
    for (i = 0; i < 4; i++) { if (cabs2(u[i]) > 1e-12) { ref = u[i]; break; } }
    if (!ref) return null;
    var r = Math.sqrt(cabs2(ref));
    var unphase = [ref[0] / r, -ref[1] / r];
    var norm = [];
    for (i = 0; i < 4; i++) norm.push(cm(u[i], unphase));

    for (k in G) {
      if (!Object.prototype.hasOwnProperty.call(G, k)) continue;
      var g = G[k], gref = null;
      for (i = 0; i < 4; i++) { if (cabs2(g[i]) > 1e-12) { gref = g[i]; break; } }
      var gr = Math.sqrt(cabs2(gref));
      var gun = [gref[0] / gr, -gref[1] / gr];
      var ok = true;
      for (i = 0; i < 4; i++) {
        var gn = cm(g[i], gun);
        if (Math.abs(gn[0] - norm[i][0]) > 1e-7 || Math.abs(gn[1] - norm[i][1]) > 1e-7) { ok = false; break; }
      }
      if (ok) return k;
    }
    return null;
  }

  var st = {
    v: [[1, 0], [0, 0]],
    u: G.I.slice(),
    n: 0,
    last: ''
  };

  function load() {
    try {
      var raw = W.sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.v && o.v.length === 2 && o.u && o.u.length === 4) {
        st.v = o.v; st.u = o.u; st.n = o.n || 0; st.last = o.last || '';
      }
    } catch (e) { }
  }
  function save() {
    try { W.sessionStorage.setItem(SS_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function p1() { return Math.min(1, Math.max(0, cabs2(st.v[1]))); }
  function p0() { return Math.min(1, Math.max(0, cabs2(st.v[0]))); }
  function phase() {
    if (cabs2(st.v[0]) < 1e-12 || cabs2(st.v[1]) < 1e-12) return 0;
    var d = carg(st.v[1]) - carg(st.v[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function coherence() { return 2 * Math.sqrt(p0() * p1()); }

  function observable() { return [p1(), phase()]; }
  function sameObservable(a, b) {
    return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  }

  var fx, pill, sr, hintTimer = 0;

  function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }

  function ketText() {
    var pb = p1(), a = Math.sqrt(p0()), b = Math.sqrt(pb);
    if (pb < 1e-6) return '|0⟩';
    if (pb > 1 - 1e-6) return '|1⟩';
    var deg = Math.round(phase() * 180 / Math.PI);
    var bpart = fmt(b) + (deg ? 'e' + sup(deg) : '') + '|1⟩';
    return fmt(a) + '|0⟩ + ' + bpart;
  }
  function sup(deg) {
    var map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
                5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    var s = String(deg).split('').map(function (c) { return map[c] || c; }).join('');
    return 'ⁱ' + s + '°';
  }

  function paint(note) {
    var pb = p1();
    var hue = 180 * pb + phase() * 180 / Math.PI;

    if (fx) {
      var idle = pb < 1e-6 && Math.abs(phase()) < 1e-9;
      fx.classList.toggle('idle', idle);
      fx.style.setProperty('--qz-inv', pb.toFixed(4));
      fx.style.setProperty('--qz-hue', hue.toFixed(2) + 'deg');
    }

    if (W.SymbiQ.lattice && W.SymbiQ.lattice.setCoherence) {
      W.SymbiQ.lattice.setCoherence(coherence());
    }

    if (!pill) return;
    var bits = [];
    if (st.last) bits.push('<span class="qz-gate">' + st.last + '</span>');
    bits.push('<span class="qz-ket">' + ketText() + '</span>');
    if (note) bits.push('<span class="qz-hint">' + note + '</span>');
    pill.innerHTML = bits.join('');
    pill.classList.toggle('live', st.n > 0 || pb > 1e-6);
  }

  function announce(msg) {
    if (!sr) return;
    sr.textContent = '';
    W.setTimeout(function () { sr.textContent = msg; }, 30);
  }

  function flash() {
    if (!pill || reduced) return;
    pill.classList.remove('flash');
    void pill.offsetWidth;
    pill.classList.add('flash');
  }

  function maybeHint() {
    try {
      if (W.localStorage.getItem(LS_KEY)) return null;
      W.localStorage.setItem(LS_KEY, '1');
    } catch (e) { return null; }
    clearTimeout(hintTimer);
    hintTimer = W.setTimeout(function () { paint(null); }, 7000);
    return 'M measures · R resets';
  }

  function applyGate(k) {
    var before = observable();
    st.v = matVec(G[k], st.v);
    st.u = matMul(G[k], st.u);
    st.n++;
    st.last = k;

    var note = maybeHint();
    if (!note) {
      var parts = [];
      var net = nameOf(st.u);
      if (net && st.n > 1) parts.push('net = ' + net);
      if (sameObservable(before, observable())) parts.push('nothing observable');
      note = parts.length ? parts.join(' · ') : null;
    }

    save();
    paint(note);
    flash();
    announce('Applied ' + k + '. State ' + ketText() + '.');
  }

  function measure() {
    var pb = p1();
    var r;
    try {
      var buf = new Uint32Array(1);
      W.crypto.getRandomValues(buf);
      r = buf[0] / 4294967296;
    } catch (e) { r = Math.random(); }

    var got = r < pb ? 1 : 0;
    st.v = got ? [[0, 0], [1, 0]] : [[1, 0], [0, 0]];
    st.u = G.I.slice();
    st.n = 0;
    st.last = 'M';
    save();
    paint('measured ' + got + ' · p was ' + fmt(pb));
    flash();
    announce('Measured ' + got + '.');
  }

  function reset() {
    st.v = [[1, 0], [0, 0]];
    st.u = G.I.slice();
    st.n = 0;
    st.last = '';
    save();
    paint(null);
    announce('Reset to zero.');
  }

  function editable(el) { return W.SymbiQ.core.editable(el); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target)) return;
    if (editable(D.activeElement)) return;

    var k = (e.key || '').toUpperCase();
    if (G[k] && k !== 'I') { applyGate(k); return; }
    if (k === 'M') { measure(); return; }
    if (k === 'R') { reset(); return; }
  }

  function boot() {
    if (!D.body) return;

    fx = D.createElement('div');
    fx.id = 'qz-fx';
    fx.className = 'idle';
    fx.setAttribute('aria-hidden', 'true');
    D.body.appendChild(fx);

    pill = D.createElement('button');
    pill.id = 'qz-pill';
    pill.type = 'button';
    pill.setAttribute('aria-label', 'Page state. Activate to reset.');
    pill.addEventListener('click', reset);
    D.body.appendChild(pill);

    sr = D.createElement('div');
    sr.className = 'qz-sr';
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');
    D.body.appendChild(sr);

    load();
    paint(null);

    D.addEventListener('keydown', onKey);
  }

  W.SymbiQ.qubit = {
    say: function (msg, ms) {
      paint(msg);
      W.setTimeout(function () { paint(null); }, ms || 3200);
    },
    apply: function (k) { k = String(k).toUpperCase(); if (G[k] && k !== 'I') applyGate(k); },
    measure: measure,
    reset: reset,
    state: function () { return { p1: p1(), phase: phase(), coherence: coherence(), net: nameOf(st.u) }; }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
