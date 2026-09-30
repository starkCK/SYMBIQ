(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var reduced = window.SymbiQ.core.reduced();

  var RGB = { v: [167, 139, 250], t: [45, 212, 191] };

  function hexToRgb(s) {
    s = (s || '').trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function readColours() {
    var cs = getComputedStyle(D.documentElement);
    var v = hexToRgb(cs.getPropertyValue('--violet'));
    var t = hexToRgb(cs.getPropertyValue('--teal'));
    if (v) RGB.v = v;
    if (t) RGB.t = t;
  }

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  var cvs, ctx, dpr = 1, w = 0, h = 0;
  var nodes = [], raf = 0, running = false;
  var pointer = { x: -9999, y: -9999, live: false };
  var coherence = 0;

  var LINK = 132;
  var CURSOR = 190;
  var WAVE = 0.42;
  var HOP_LOSS = 0.72;
  var MIN_AMP = 0.06;
  var MAX_EVENTS = 400;

  function sizeCanvas() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    w = W.innerWidth;
    h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    var n = Math.max(24, Math.min(88, Math.round((w * h) / 21000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        r: 1.1 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,
        amp: 0,
        teal: Math.random() < 0.42
      });
    }
  }

  function excite(idx, amp, budget) {
    var nd = nodes[idx];
    if (!nd || amp < MIN_AMP || budget.n > MAX_EVENTS) return;
    budget.n++;
    nd.amp = Math.min(1, nd.amp + amp);

    for (var j = 0; j < nodes.length; j++) {
      if (j === idx) continue;
      var o = nodes[j];
      var dx = o.x - nd.x, dy = o.y - nd.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > LINK) continue;
      var next = amp * HOP_LOSS * (1 - d / LINK * 0.4);
      if (next < MIN_AMP) continue;
      if (o.amp > next) continue;
      (function (jj, nn) {
        setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function hitTest(x, y) {
    var best = -1, bestD = 22;
    for (var i = 0; i < nodes.length; i++) {
      var dx = nodes[i].x - x, dy = nodes[i].y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function step(dt, t) {
    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      if (pointer.live) {
        var dx = pointer.x - n.x, dy = pointer.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 1) {
          var f = (1 - d / CURSOR) * 0.00028 * dt;
          n.vx += dx * f;
          n.vy += dy * f;
        }
      }

      n.vx *= 0.992;
      n.vy *= 0.992;
      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > 0.42) { n.vx = n.vx / sp * 0.42; n.vy = n.vy / sp * 0.42; }
      if (sp < 0.02) { n.vx += (Math.random() - 0.5) * 0.02; n.vy += (Math.random() - 0.5) * 0.02; }

      n.amp *= Math.pow(0.9975, dt);
      if (n.amp < 0.004) n.amp = 0;
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    var i, j, a, b, dx, dy, d, o;

    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;

        var base = (1 - d / LINK) * 0.16;
        var lift = (a.amp + b.amp) * 0.5;
        var shim = coherence * 0.10 * (0.5 + 0.5 * Math.sin(t * 0.0016 + (a.ph + b.ph)));
        var alpha = Math.min(0.62, base + lift * 0.55 + shim);
        if (alpha < 0.012) continue;

        ctx.strokeStyle = rgba(a.teal && b.teal ? RGB.t : RGB.v, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    if (pointer.live) {
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        dx = pointer.x - a.x; dy = pointer.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > CURSOR) continue;
        ctx.strokeStyle = rgba(RGB.t, (1 - d / CURSOR) * 0.20);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    for (i = 0; i < nodes.length; i++) {
      o = nodes[i];
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.0011 + o.ph);
      var rad = o.r * (1 + pulse * 0.28 + o.amp * 2.6);
      var al = 0.30 + pulse * 0.16 + o.amp * 0.62 + coherence * 0.12;
      ctx.fillStyle = rgba(o.teal ? RGB.t : RGB.v, Math.min(0.95, al));
      ctx.beginPath();
      ctx.arc(o.x, o.y, rad, 0, Math.PI * 2);
      ctx.fill();

      if (o.amp > 0.05) {
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 26 * o.amp + 6);
        g.addColorStop(0, rgba(o.teal ? RGB.t : RGB.v, o.amp * 0.34));
        g.addColorStop(1, rgba(o.teal ? RGB.t : RGB.v, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 26 * o.amp + 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  var last = 0;
  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 48) : 16;
    last = t;
    step(dt, t);
    draw(t);
    raf = W.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    last = 0;
    raf = W.requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) W.cancelAnimationFrame(raf);
    raf = 0;
  }
  function restart() { stop(); start(); }

  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  function initLattice() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (cvs) return;

    if (!D.body.hasAttribute('data-lattice') && !(WIDE && WIDE.matches)) return;

    cvs = D.createElement('canvas');
    cvs.id = 'mo-lattice';
    cvs.setAttribute('aria-hidden', 'true');
    D.body.appendChild(cvs);
    ctx = cvs.getContext('2d');
    if (!ctx) { cvs.remove(); return; }

    readColours();
    sizeCanvas();
    seed();

    var rt;
    W.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = W.setTimeout(function () {
        sizeCanvas();
        seed();
        if (!running) draw(W.performance ? W.performance.now() : 0);
      }, 160);
    });

    if (reduced) {
      draw(0);
      cvs.classList.add('on');
      return;
    }

    draw(0);
    if (!D.hidden) start();

    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    W.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { pointer.live = false; });
    W.addEventListener('blur', function () { pointer.live = false; });

    W.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, summary, label')) return;
      var i = hitTest(e.clientX, e.clientY);
      if (i < 0) return;
      excite(i, 1, { n: 0 });
    }, { passive: true });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stop(); else restart();
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () { readColours(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
  }

  function initSheen() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (reduced) return;

    var pending = null, tick = 0;

    D.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card, .introute-card');
      if (!card) return;
      pending = { el: card, x: e.clientX, y: e.clientY };
      if (tick) return;
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var r = pending.el.getBoundingClientRect();
        pending.el.style.setProperty('--mo-x', ((pending.x - r.left) / r.width * 100).toFixed(1) + '%');
        pending.el.style.setProperty('--mo-y', ((pending.y - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  W.SymbiQ.lattice = {
    setCoherence: function (c) {
      coherence = Math.max(0, Math.min(1, c || 0));
      if (ctx && !running) draw(W.performance ? W.performance.now() : 0);
    },
    pulse: function () {
      if (!nodes.length) return;
      excite(Math.floor(Math.random() * nodes.length), 0.85, { n: 0 });
    },
    ready: function () { return !!ctx; }
  };

  function boot() {
    initLattice();
    initSheen();
    if (WIDE) {
      if (WIDE.addEventListener) WIDE.addEventListener('change', initLattice);
      else if (WIDE.addListener) WIDE.addListener(initLattice);
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
