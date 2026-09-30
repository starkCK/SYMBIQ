(function () {
  'use strict';

  var W = window, D = document;
  if (!D.body || !D.body.hasAttribute('data-living')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { }

  var N = 14;
  var K = 1.6;
  var SPREAD = 0.20;
  var NOISE = 0.012;
  var DT = 1 / 60;

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

      ctx.strokeStyle = rgba(COL.m, 0.10 + r * 0.10);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gap * 0.5, mid);
      ctx.lineTo(w - gap * 0.5, mid);
      ctx.stroke();

      for (i = 0; i < N; i++) {
        x = gap * (i + 0.5);
        var b = (1 + Math.cos(st.theta[i])) / 2;
        var yoff = Math.sin(st.theta[i]) * (2.2 + r * 1.6);
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
    } catch (e) { }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
