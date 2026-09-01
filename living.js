/* SymbiQ, living.js
 * ============================================================================
 * THE LIVING LAYER.  Opt-in via <body data-living>.  Pairs with living.css.
 *
 * Its own file with its own cache-buster, for the reason motion.css / vivid.css
 * / alive.css / glass.css each have one: style.css is shared by 24 pages and
 * touching it forces a bump on every one of them (the 2026-07-24 scar).  A
 * layer should never be a 24-page deploy.
 *
 * WHAT THIS LAYER DOES.  Almost all of "living" is CSS -- see living.css: a
 * full-bleed breakout for the one big figure on a page, a longer stagger on
 * the reveals nav.js already owns, and the homepage Loop's flow dots driven
 * by scroll instead of a timer.  This script owns exactly one thing that is
 * not decoration:
 *
 *   THE COUPLING STRIP.  A line of independent phase oscillators, coupled to
 *   their neighbours by the Kuramoto mean-field rule, that pulls itself into
 *   phase while you watch.  It mounts into any [data-living-strip] element;
 *   the homepage puts one directly under the sentence it illustrates --
 *   "Couple many of the same circuits instead, and you get the machine
 *   operations research already runs on."  It is the same object every
 *   oscillator-Ising-machine widget on the site already runs (analog.html,
 *   games.js), shown at rest.
 *
 * The exact model, its constants and its claims are brute-forced in
 * tools/verify_living.py -- keep the two in sync.
 *
 * SAFETY CONTRACT, same as alive.js / nav.js.  Pure enhancement.  Adds no
 * class that hides content, removes nothing, every entry point in its own
 * try/catch.  If this file 404s, throws on line one, or is blocked, every
 * page is byte-for-byte what it was before it existed -- a [data-living-strip]
 * that never gets a canvas is an empty 0-height div nobody sees.
 * ==========================================================================*/
(function () {
  'use strict';

  var W = window, D = document;
  if (!D.body || !D.body.hasAttribute('data-living')) return;

  var reduce = false;
  try {
    reduce = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (D.documentElement.getAttribute('data-motion-pref') === 'reduce') reduce = true;
  } catch (e) { /* unreadable preference -> treat as no preference */ }

  /* ---- constants: identical to tools/verify_living.py -------------------- */
  var N = 14;            /* oscillators in the strip */
  var K = 1.6;           /* coupling strength */
  var SPREAD = 0.20;     /* natural frequencies ~ uniform(-SPREAD, +SPREAD) */
  var NOISE = 0.012;     /* per-step phase noise amplitude */
  var DT = 1 / 60;       /* integrator step, seconds; frame dt is clamped to this */

  /* Colour read from the cascade so the strip re-themes with everything else,
     exactly as atmosphere.js does it. */
  function rgbOf(name, fallback) {
    try {
      var s = getComputedStyle(D.documentElement).getPropertyValue(name).trim();
      var m = /^#?([0-9a-f]{6})$/i.exec(s);
      if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
      if (m) return [+m[1], +m[2], +m[3]];
    } catch (e) {}
    return fallback;
  }
  var COL = { v: [167, 139, 250], t: [45, 212, 191], m: [154, 165, 189] };
  function readColours() {
    COL.v = rgbOf('--violet', COL.v);
    COL.t = rgbOf('--teal', COL.t);
    COL.m = rgbOf('--muted', COL.m);
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

  /* ---- the model: one Euler step, mirrors verify_living.step_kuramoto ---- */
  function stepKuramoto(theta, omega) {
    var i, j, n = theta.length, pull = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var acc = 0;
      for (j = 0; j < n; j++) acc += Math.sin(theta[j] - theta[i]);
      pull[i] = (K / n) * acc;
    }
    for (i = 0; i < n; i++) {
      theta[i] += DT * (omega[i] + pull[i]) + DT * NOISE * gauss();
      theta[i] = ((theta[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
  }
  /* Box-Muller; one cached spare. Good enough for a visual noise term. */
  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u = Math.random() || 1e-9, v = Math.random();
    var r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  function newState(seed) {
    var theta = new Float64Array(N), omega = new Float64Array(N), i;
    for (i = 0; i < N; i++) {
      theta[i] = Math.random() * 2 * Math.PI;
      omega[i] = (Math.random() * 2 - 1) * SPREAD;
    }
    return { theta: theta, omega: omega };
  }

  /* ---- one strip ------------------------------------------------------- */
  function mountStrip(host) {
    if (!host || host.__living) return;
    host.__living = true;

    var cvs = D.createElement('canvas');
    cvs.className = 'living-strip-cvs';
    cvs.setAttribute('aria-hidden', 'true');
    host.appendChild(cvs);
    var ctx = cvs.getContext('2d');
    if (!ctx) { host.__living = false; cvs.remove(); return; }

    var dpr = 1, w = 0, h = 0;
    function size() {
      dpr = Math.min(W.devicePixelRatio || 1, 2);
      var r = host.getBoundingClientRect();
      w = Math.max(240, Math.round(r.width));
      h = Math.round(r.height) || 44;
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = w + 'px';
      cvs.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var st = newState();

    function order() {
      var re = 0, im = 0, i;
      for (i = 0; i < N; i++) { re += Math.cos(st.theta[i]); im += Math.sin(st.theta[i]); }
      return Math.sqrt(re * re + im * im) / N;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var mid = h / 2, gap = w / N, r = order();
      var i, x;

      /* the coupling line: faint, brightens as the field orders */
      ctx.strokeStyle = rgba(COL.m, 0.10 + r * 0.10);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gap * 0.5, mid);
      ctx.lineTo(w - gap * 0.5, mid);
      ctx.stroke();

      for (i = 0; i < N; i++) {
        x = gap * (i + 0.5);
        var b = (1 + Math.cos(st.theta[i])) / 2;          /* brightness, [0,1] */
        var yoff = Math.sin(st.theta[i]) * (2.2 + r * 1.6); /* a hair of vertical life */
        /* colour: muted when the field is scattered, accent when it locks */
        var cc = i % 2 ? COL.t : COL.v;
        var col = [
          COL.m[0] + (cc[0] - COL.m[0]) * r,
          COL.m[1] + (cc[1] - COL.m[1]) * r,
          COL.m[2] + (cc[2] - COL.m[2]) * r
        ];
        var rad = 1.6 + b * 2.0 + r * 0.6;
        ctx.fillStyle = rgba(col, 0.22 + b * 0.42);
        ctx.beginPath();
        ctx.arc(x, mid + yoff, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* reduced motion: settle the model headlessly, draw one locked frame */
    if (reduce) {
      size();
      for (var k = 0; k < 14 * 60; k++) stepKuramoto(st.theta, st.omega);
      draw();
      cvs.classList.add('on');
      return;
    }

    var raf = 0, last = 0, running = false, visible = false;
    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min((t - last) / 1000, DT) : DT;
      last = t;
      /* fixed-step: advance the model by whole DT ticks, at most 3 a frame */
      var acc = dt, guard = 0;
      while (acc >= DT * 0.5 && guard++ < 3) { stepKuramoto(st.theta, st.omega); acc -= DT; }
      draw();
      raf = W.requestAnimationFrame(frame);
    }
    function start() { if (running || !visible || D.hidden) return; running = true; last = 0; raf = W.requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) W.cancelAnimationFrame(raf); raf = 0; }

    size();
    draw();
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    var rt;
    W.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = W.setTimeout(function () { size(); if (!running) draw(); }, 160);
    });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stop(); else start();
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onS = function () { readColours(); if (!running) draw(); };
      if (mq.addEventListener) mq.addEventListener('change', onS);
      else if (mq.addListener) mq.addListener(onS);
    }

    /* only spin the loop while the strip is actually on screen */
    if ('IntersectionObserver' in W) {
      new W.IntersectionObserver(function (ents) {
        visible = ents[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.01 }).observe(host);
    } else {
      visible = true; start();
    }
  }

  function boot() {
    try {
      readColours();
      var hosts = D.querySelectorAll('[data-living-strip]');
      for (var i = 0; i < hosts.length; i++) {
        try { mountStrip(hosts[i]); } catch (e) {}
      }
    } catch (e) { /* living is enhancement; a failure is a no-op */ }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
