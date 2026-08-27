/* ================================================================
   ATMOSPHERE (2026-08-27)

   Two things that share one idea -- the page reacts to where you are:

     1. THE LATTICE. A generative background of drifting nodes that couple to
        their neighbours. Not decoration borrowed from somewhere else: the
        brand mark IS a lattice, the dot grid in style.css is a lattice, and
        the homepage's own thesis is that coupling many identical circuits is
        what turns a qubit story into an optimisation machine. So the
        background is the same object the site is about, actually behaving
        like one.

        This is the answer to "put a video behind it". A video would be the
        first photographic byte this site has ever shipped, would cost
        megabytes, would not theme, would not respond, and would say nothing.
        This costs no network request and reacts to the cursor.

     2. THE SHEEN. Cards get a light source that follows the pointer, by
        writing --mo-x / --mo-y for motion.css §4 to consume.

   HIDDEN, item 2 of 2 (the other lives in qubit.js): clicking a node
   injects an excitation, which propagates outward along the couplings at
   finite speed, losing amplitude at every hop. That is a discrete wave on a
   weighted graph -- the same picture as an excitation moving through a
   coupled-oscillator lattice -- and it is why the propagation is delayed by
   distance rather than lighting the whole graph at once. Clicking empty
   space does nothing, so it is found by aiming, not by flailing.
   ================================================================ */
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var reduced = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- */
  /* Colour, read from the cascade rather than hardcoded, so the lattice
     re-themes with everything else instead of becoming the one violet thing
     on a light page. Re-read on scheme change; --violet and --teal both have
     different values in the light block of style.css.                       */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /* THE LATTICE                                                       */
  /* ---------------------------------------------------------------- */
  var cvs, ctx, dpr = 1, w = 0, h = 0;
  var nodes = [], raf = 0, running = false;
  var pointer = { x: -9999, y: -9999, live: false };
  var coherence = 0;            /* driven by qubit.js; see setCoherence below */

  var LINK = 132;               /* px: coupling range. Beyond this, no bond. */
  var CURSOR = 190;             /* px: how far the pointer's influence reaches */
  var WAVE = 0.42;              /* px per ms: propagation speed of an excitation */
  var HOP_LOSS = 0.72;          /* amplitude retained per hop */
  var MIN_AMP = 0.06;           /* below this an excitation is dead */
  var MAX_EVENTS = 400;         /* hard ceiling per click, so a dense graph cannot avalanche */

  function sizeCanvas() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);   /* capped: 3x on a phone is heat, not sharpness */
    w = W.innerWidth;
    h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    /* Density by area, not a fixed count -- a phone gets a sparse lattice and
       a 4K monitor gets a full one, at roughly the same visual weight. */
    var n = Math.max(24, Math.min(88, Math.round((w * h) / 21000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        r: 1.1 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,   /* per-node phase, so pulses desynchronise */
        amp: 0,                            /* current excitation amplitude */
        teal: Math.random() < 0.42
      });
    }
  }

  /* Excitation: a breadth-first wave across the coupling graph, delayed by
     real distance / WAVE and attenuated by HOP_LOSS per hop. Scheduled with
     timers rather than integrated per-frame because the delay is what makes
     it read as propagation instead of a flash. */
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
      if (d > LINK) continue;                       /* not coupled: no path */
      var next = amp * HOP_LOSS * (1 - d / LINK * 0.4);
      if (next < MIN_AMP) continue;
      if (o.amp > next) continue;                   /* already carrying more; don't re-excite */
      (function (jj, nn) {
        setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function hitTest(x, y) {
    var best = -1, bestD = 22;      /* generous: the nodes are 2px, the target is not */
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

      /* Wrap rather than bounce: a bounce reads as a wall, and there is no
         wall -- the lattice is meant to continue past the viewport. */
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      /* Pointer coupling: a weak pull, capped, so the lattice leans toward
         the cursor without collapsing into it. */
      if (pointer.live) {
        var dx = pointer.x - n.x, dy = pointer.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 1) {
          var f = (1 - d / CURSOR) * 0.00028 * dt;
          n.vx += dx * f;
          n.vy += dy * f;
        }
      }

      /* Drag, so the pointer pull cannot accumulate into a stampede. */
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

    /* Bonds first, so nodes sit on top of their own couplings. */
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;

        var base = (1 - d / LINK) * 0.16;
        var lift = (a.amp + b.amp) * 0.5;                 /* excitation brightens the bond */
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

    /* Bonds to the pointer. Drawn separately and brighter: this is the part
       that makes the thing feel aware of you. */
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

      /* An excited node throws a halo. Only while it is actually carrying
         amplitude, so a resting lattice stays quiet. */
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
    var dt = last ? Math.min(t - last, 48) : 16;   /* clamp: a backgrounded tab must not teleport */
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
  /* Always tear down before arming. A page that LOADS in a background tab
     gets running=true but never a single rAF callback -- requestAnimationFrame
     does not fire while the document is hidden -- so a later start() would
     see running===true, return early, and leave the loop permanently dead
     with a stale frame id. Restarting through stop() is what makes becoming
     visible actually recover. Found 2026-08-27 against a hidden pane, which
     is the same state as opening the site in a background tab. */
  function restart() { stop(); start(); }

  /* The width at which rails.css puts furniture in the margins. Kept in step
     with that file and with rails.js by hand; all three name the same number
     for the same reason, and if one moves they all move. */
  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  function initLattice() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (cvs) return;   /* already built: the wide-screen path can call twice */

    /* WHERE THE LATTICE RUNS, revised 2026-08-28.
       It began homepage-only, on the argument that it belongs behind the
       hero that argues for it. That held while the margins on every other
       page were empty background. They are not any more: rails.css now puts
       a section index, the ladder and a progress readout out there at 1440px
       and up, and a still background behind live furniture reads as the
       furniture having replaced something. So on a screen wide enough to
       have margins at all, every page gets the lattice; below that, nothing
       changes and it stays exactly where it was. Phones and ordinary laptops
       pay nothing new -- no canvas, no loop, no battery.
       data-lattice still wins at every width, which is what keeps the
       homepage's own reading intact on a narrow screen. */
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

    /* Resize is wired in BOTH paths. The reduced-motion branch returns before
       the rest of the listeners, and an early version of this file returned
       before this one too -- which left a static lattice drawn at the old
       viewport size for anyone who resized their window, i.e. permanently
       wrong for exactly the users who cannot see it redraw. */
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
      /* One static frame. The lattice is still there, still themed, still
         part of the composition -- it simply does not move. */
      draw(0);
      cvs.classList.add('on');
      return;
    }

    /* One frame now, synchronously, before any rAF. Two reasons: the lattice
       is present on the very first paint instead of one frame late, and a
       page that opens in a background tab still has a drawn lattice waiting
       when it is finally looked at, rather than an empty canvas. */
    draw(0);
    if (!D.hidden) start();

    /* Faded in rather than popped: at load the page already has enough
       arriving at once. */
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    W.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { pointer.live = false; });
    W.addEventListener('blur', function () { pointer.live = false; });

    /* The excitation. Listens on window because the canvas is
       pointer-events:none -- the lattice must never eat a click meant for a
       link. Only a click that lands ON a node does anything at all.

       Not wired under reduced motion, and that is the right call rather than
       a shortcut: a wave crossing the whole viewport is intrinsically motion,
       which is the exact thing the preference opts out of. The lattice is
       still drawn, still themed, still part of the composition -- it just
       does not have a hidden animation waiting in it. */
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

  /* ---------------------------------------------------------------- */
  /* THE SHEEN                                                         */
  /* ---------------------------------------------------------------- */
  function initSheen() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (reduced) return;

    var pending = null, tick = 0;

    D.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card, .introute-card');
      if (!card) return;
      pending = { el: card, x: e.clientX, y: e.clientY };
      if (tick) return;
      /* One write per frame. A pointermove handler that touches style on
         every event is the classic way to make a smooth page feel sticky. */
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var r = pending.el.getBoundingClientRect();
        pending.el.style.setProperty('--mo-x', ((pending.x - r.left) / r.width * 100).toFixed(1) + '%');
        pending.el.style.setProperty('--mo-y', ((pending.y - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Public surface. qubit.js drives setCoherence with |2 alpha beta*| --
     the off-diagonal term of the density matrix, which is literally the
     quantity that survives only while the page is unmeasured. So the
     lattice shimmers exactly when, and as much as, the site is in
     superposition, and goes still the instant it is measured.            */
  /* ---------------------------------------------------------------- */
  W.SymbiQ.lattice = {
    setCoherence: function (c) {
      coherence = Math.max(0, Math.min(1, c || 0));
      /* Repaint if nothing else is going to. Under reduced motion, or in a
         background tab, there is no loop to pick this up -- without this the
         canvas would keep showing the shimmer level from whenever it last
         drew, which for a reduced-motion visitor is forever. */
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
    /* Someone who drags a window out to a second monitor should get the
       lattice then, not on their next navigation. Only ever builds -- there
       is no matching teardown, because a canvas that already exists costs a
       rAF loop the page is paying for anyway, and tearing it down on every
       drag of a window edge would flicker. initLattice returns early once
       cvs exists, so this cannot build a second one. */
    if (WIDE) {
      if (WIDE.addEventListener) WIDE.addEventListener('change', initLattice);
      else if (WIDE.addListener) WIDE.addListener(initLattice);
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
