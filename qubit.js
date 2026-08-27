/* ================================================================
   THE PAGE IS A QUBIT (2026-08-27)

   HIDDEN, item 1 of 2 (the other is the lattice excitation in
   atmosphere.js). Undocumented on purpose. Nothing on the site explains
   this, and nothing should.

   WHAT IT IS
   The site carries a real single-qubit state. Press a gate letter anywhere
   -- H X Y Z S T -- and the actual 2x2 complex unitary is applied to it.
   Press M to measure. Press R to reset. The state follows you across pages
   for the session.

   WHY IT IS NOT A GIMMICK
   Every visible consequence is the honest reading of a real quantity, and
   the two visual channels are independent because the two physical
   quantities are:

     |beta|^2  -- the probability of measuring 1 -- drives LIGHTNESS, via
                  invert(). The X gate is a bit flip; invert() is a bit flip
                  on pixels. They are the same operation, which is the whole
                  reason this maps to a filter rather than a theme toggle.
                  A superposition renders as a genuinely half-inverted page,
                  because that is what refusing to measure looks like.

     arg(beta) - arg(alpha)  -- the relative phase -- drives HUE. Phase as
                  hue is the standard domain-colouring convention, and it is
                  the right one here: phase is exactly the thing that is
                  invisible in the populations and visible in interference.

     2|alpha||beta|  -- the off-diagonal coherence of the density matrix --
                  drives the lattice shimmer in atmosphere.js. It is maximal
                  in equal superposition and identically zero the instant a
                  measurement lands, so the background goes still exactly
                  when the physics says the coherence is gone.

   THE PAYOFF FOR ANYONE WHO ACTUALLY KNOWS
   The accumulated unitary is tracked, not just the state, and named when it
   matches something. Type HZH and the readout says net = X, because HZH IS
   X. Type SS and it says net = Z, because S^2 = Z. Type HH and it says
   net = I, and nothing happens, which is correct. Press Z on a fresh page
   and it reports no observable change, because Z|0> = |0> and a global
   phase is not a thing you can see. None of those are special cases in this
   file -- they all fall out of multiplying the matrices. That is the point.
   There is no list of tricks here to get wrong.

   FINDING IT
   One breadcrumb: a dim readout in the corner showing |0>. It is describing
   the page, not decorating it, and it changes when the theme does. That is
   the whole hint. Anyone who presses a gate key gets a visible response
   immediately, including the correct non-response.

   ESCAPE HATCH
   R resets. So does clicking the readout. A visitor who lands on an
   inverted page by accident has a labelled way out that is one click from
   wherever they are.
   ================================================================ */
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var SS_KEY = 'symbiq.qz.v1';        /* session: the state follows you across pages */
  var LS_KEY = 'symbiq.qz.seen.v1';   /* forever: the one-time hint has been shown */
  var EPS = 1e-9;

  var reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- */
  /* Complex arithmetic. Same [re, im] convention as the try-it engine in
     index.html and as games.js's Circuit Golf, deliberately -- three copies
     of one convention is fine; three conventions would not be.            */
  /* ---------------------------------------------------------------- */
  function cm(p, q) { return [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; }
  function cadd(p, q) { return [p[0] + q[0], p[1] + q[1]]; }
  function cabs2(p) { return p[0] * p[0] + p[1] * p[1]; }
  function carg(p) { return Math.atan2(p[1], p[0]); }
  function cconj(p) { return [p[0], -p[1]]; }

  /* Gates as [m00, m01, m10, m11]. */
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
  function matMul(a, b) {   /* a . b */
    return [cadd(cm(a[0], b[0]), cm(a[1], b[2])),
            cadd(cm(a[0], b[1]), cm(a[1], b[3])),
            cadd(cm(a[2], b[0]), cm(a[3], b[2])),
            cadd(cm(a[2], b[1]), cm(a[3], b[3]))];
  }

  /* Name the accumulated unitary, UP TO GLOBAL PHASE -- which is the only
     honest way to compare two unitaries, since a global phase is not
     observable. Normalise by the phase of the first non-negligible entry,
     then compare entrywise. */
  function nameOf(u) {
    var i, k, ref = null;
    for (i = 0; i < 4; i++) { if (cabs2(u[i]) > 1e-12) { ref = u[i]; break; } }
    if (!ref) return null;
    var r = Math.sqrt(cabs2(ref));
    var unphase = [ref[0] / r, -ref[1] / r];      /* conj(ref)/|ref| */
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

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */
  var st = {
    v: [[1, 0], [0, 0]],   /* |0> */
    u: G.I.slice(),        /* accumulated unitary since the last reset/measure */
    n: 0,                  /* gates applied since the last reset/measure */
    last: ''               /* the gate letter most recently applied */
  };

  function load() {
    try {
      var raw = W.sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.v && o.v.length === 2 && o.u && o.u.length === 4) {
        st.v = o.v; st.u = o.u; st.n = o.n || 0; st.last = o.last || '';
      }
    } catch (e) { /* a corrupt key just means the page starts at |0>, which is fine */ }
  }
  function save() {
    try { W.sessionStorage.setItem(SS_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function p1() { return Math.min(1, Math.max(0, cabs2(st.v[1]))); }
  function p0() { return Math.min(1, Math.max(0, cabs2(st.v[0]))); }
  function phase() {
    /* Undefined unless BOTH amplitudes are present -- with one of them zero
       there is no relative phase to speak of, only a global one, and a global
       phase is not observable. Returning 0 here is not a fudge; it is the
       statement that there is nothing to show. */
    if (cabs2(st.v[0]) < 1e-12 || cabs2(st.v[1]) < 1e-12) return 0;
    var d = carg(st.v[1]) - carg(st.v[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function coherence() { return 2 * Math.sqrt(p0() * p1()); }

  /* What is actually visible: populations and relative phase. Two states
     agreeing on both are indistinguishable by any measurement, so this is
     the correct equality test for "did anything happen". */
  function observable() { return [p1(), phase()]; }
  function sameObservable(a, b) {
    return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
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
    /* e^{i\theta} with the exponent as superscript, so the pill stays one line */
    var map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
                5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    var s = String(deg).split('').map(function (c) { return map[c] || c; }).join('');
    return 'ⁱ' + s + '°';   /* superscript i, digits, degree */
  }

  function paint(note) {
    var pb = p1();
    var hue = 180 * pb + phase() * 180 / Math.PI;

    if (fx) {
      /* Drop the filter entirely at |0>: an untouched page should not be
         paying for a full-viewport backdrop filter that resolves to identity. */
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
    void pill.offsetWidth;              /* restart the animation */
    pill.classList.add('flash');
  }

  /* One-time nudge, the first time a gate ever lands. It names the two keys
     that are not gates -- the measurement and the way out -- and never
     explains the mapping. */
  function maybeHint() {
    try {
      if (W.localStorage.getItem(LS_KEY)) return null;
      W.localStorage.setItem(LS_KEY, '1');
    } catch (e) { return null; }
    clearTimeout(hintTimer);
    hintTimer = W.setTimeout(function () { paint(null); }, 7000);
    return 'M measures · R resets';
  }

  /* ---------------------------------------------------------------- */
  /* Operations                                                        */
  /* ---------------------------------------------------------------- */
  function applyGate(k) {
    var before = observable();
    st.v = matVec(G[k], st.v);
    st.u = matMul(G[k], st.u);
    st.n++;
    st.last = k;

    var note = maybeHint();
    if (!note) {
      /* Two independent facts, and a sequence can carry both. S,S is the
         case that proves it: the net unitary really is Z, AND nothing
         observable happened, because Z|0> = |0>. Reporting only one of those
         would look like the simulator had missed the other. */
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
    /* A real draw. crypto.getRandomValues where it exists, because on a site
       whose argument is "the mathematics does the judging" the randomness
       should be the best the platform has, not Math.random. */
    var r;
    try {
      var buf = new Uint32Array(1);
      W.crypto.getRandomValues(buf);
      r = buf[0] / 4294967296;
    } catch (e) { r = Math.random(); }

    var got = r < pb ? 1 : 0;
    st.v = got ? [[0, 0], [1, 0]] : [[1, 0], [0, 0]];
    st.u = G.I.slice();          /* the accumulated unitary died with the coherence */
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

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */
  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }

  function onKey(e) {
    /* Never steal a shortcut. Ctrl/Cmd/Alt combinations belong to the
       browser and to the user, not to this. */
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target)) return;
    if (editable(D.activeElement)) return;

    var k = (e.key || '').toUpperCase();
    if (G[k] && k !== 'I') { applyGate(k); return; }
    if (k === 'M') { measure(); return; }
    if (k === 'R') { reset(); return; }
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */
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
    /* Labelled, because a mystery button is still a button and a screen
       reader user should not have to guess. The label says what it DOES
       (resets) without explaining what the rest of it is. */
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

  /* Deliberately small public surface: enough for a page to drive the state
     from a widget later, nothing that hands out the key mapping. */
  W.SymbiQ.qubit = {
    apply: function (k) { k = String(k).toUpperCase(); if (G[k] && k !== 'I') applyGate(k); },
    measure: measure,
    reset: reset,
    state: function () { return { p1: p1(), phase: phase(), coherence: coherence(), net: nameOf(st.u) }; }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
