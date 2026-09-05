/* SymbiQ, home.js
 * ============================================================================
 * THE HOME PAGE LAYER.  index.html only.  Pairs with home.css.
 *
 *   1. THE INSTRUMENT   two sliders, three computed readouts, one verdict
 *   2. THE PARALLAX     --px / --py on <html>, consumed by home.css section 3
 *   3. THE STATIONS     an IntersectionObserver over [data-station]
 *   4. THE COMPANION    the bottom-left progress ring and its card
 *   5. THE KEYS         g h / g p / 1 2 3 / m / ? / Esc, plus the nav button
 *   6. THE GESTURE      undocumented; found by typing, not by reading
 *   7. THE FIELD        the pointer-reactive lattice, replacing atmosphere.js
 *
 * SAFETY CONTRACT, the same one nav.js and alive.js sign: this file is pure
 * enhancement.  It hides no content, removes nothing an unstyled reader
 * needs, and every entry point sits inside its own try/catch.  If it 404s or
 * throws on line one the page is a complete, readable, fully linked document
 * -- the instrument degrades to two labelled sliders with static markup
 * around them, and every section is still reachable by scrolling.
 *
 * ORDERING.  Loads LAST, after nav.js, tiers.js, qubit.js and alive.js, so
 * section 5 can see what those bound and cooperate with it rather than
 * fight it.  See section 5 for exactly who gets which key and why.
 * ==========================================================================*/
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  /* The two ways a reader asks for less motion: the OS preference, and this
     site's own explicit switch (theme.js writes data-motion-pref on <html>).
     living.js reads both; so does this. */
  var reduce = false;
  try {
    reduce = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (D.documentElement.getAttribute('data-motion-pref') === 'reduce') reduce = true;
  } catch (e) {}

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  /* Read a colour token out of the cascade rather than hardcoding it, so
     everything below re-themes with vivid.css / theme.css / the light block
     instead of becoming the one violet thing on a light page. */
  function rgbOf(name, fallback) {
    try {
      var s = getComputedStyle(D.documentElement).getPropertyValue(name).trim();
      var m = /^#?([0-9a-f]{6})$/i.exec(s);
      if (m) {
        var n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
      if (m) return [+m[1], +m[2], +m[3]];
    } catch (e) {}
    return fallback;
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  }

  /* ======================================================================
     1. THE INSTRUMENT
     ----------------------------------------------------------------------
     The hero leads with something that computes.  Two sliders, three
     readouts, one verdict, and not a single hand-written number on its face.

     THE MODEL is the site's own, not a new one.  Below threshold a surface
     code suppresses errors as

         p_L(d) = A * (p / p_th) ^ floor((d+1)/2)          Fowler 1208.0928

     which qec.html's Threshold Explorer and race.html's threshold widget
     already run, and tools/verify_threshold.py already brute-forces (the
     exponent, the d -> d+2 ratio, the monotonicity flip at p_th, and the
     2d^2-1 cost).  Here A = 0.1 and p_th = 1%, and d is odd, so
     floor((d+1)/2) is exactly (d+1)/2.  tools/verify_home_threshold.py
     brute-forces THIS instrument: the arithmetic, the formatting, the
     boundary, and the agreement with the shared law.

     p_L is capped at 0.5 because a per-round logical error probability
     cannot exceed a coin flip; above threshold the scaling form runs away
     and the cap is what keeps the readout honest instead of absurd.
     ==================================================================== */
  var P_TH = 0.01;          /* threshold, 1% -- the line the whole page is about */
  var A_PREF = 0.1;         /* prefactor at p = p_th */
  var ROUND_S = 1e-6;       /* one syndrome round, one microsecond */

  function pLogical(p, d) {
    return Math.min(0.5, A_PREF * Math.pow(p / P_TH, (d + 1) / 2));
  }
  function patchQubits(d) { return 2 * d * d - 1; }   /* rotated surface-code patch */
  function lifetimeS(pL) { return ROUND_S / pL; }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
              '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
              '-': '⁻' };
  function sup(n) {
    return String(n).split('').map(function (c) { return SUP[c] || c; }).join('');
  }
  var log10 = Math.log10 || function (x) { return Math.log(x) / Math.LN10; };

  /* Scientific notation below 0.01, a plain two-significant-figure decimal at
     or above it.  The renormalise branch is not decoration: log10(1e-15) can
     land on -15.000000000000002, whose floor is -16, which would otherwise
     print "10.0x10^-16". */
  function sci(x) {
    if (!(x > 0)) return '0';
    if (x >= 0.01) return String(parseFloat(x.toPrecision(2)));
    var e = Math.floor(log10(x));
    var m = x / Math.pow(10, e);
    m = Math.round(m * 10) / 10;
    if (m >= 10) { m = m / 10; e += 1; m = Math.round(m * 10) / 10; }
    return m.toFixed(1) + '×' + '10' + sup(e);
  }

  function sigfig(v) {
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  /* Seconds -> the largest unit that leaves a number a person can hold.
     A Julian year (365.25 days) so "yr" means the same thing here as it does
     in every other duration on the site.

     The two lowest boundaries are nudged down by half a printed digit
     (999.5us, 0.9995s) so a value that would ROUND UP to 1000 steps to the
     next unit instead. Not hypothetical: p = 0.1%, d = 3 gives p_L =
     1.0000000000000002e-3 in binary floating point, so the lifetime lands at
     999.9999999999998 microseconds and the naive ladder printed "1000 us".
     Caught by tools/verify_home_threshold.py check 8a. No higher boundary
     can reach 1000 (60 s, 60 min, 24 h, 365.25 days), so only these two
     need it. */
  function duration(s) {
    if (s < 999.5e-6) return [sigfig(s * 1e6), 'µs'];
    if (s < 0.9995) return [sigfig(s * 1e3), 'ms'];
    if (s < 60) return [sigfig(s), 's'];
    if (s < 3600) return [sigfig(s / 60), 'min'];
    if (s < 86400) return [sigfig(s / 3600), 'h'];
    if (s < 31557600) return [sigfig(s / 86400), 'days'];
    return [sigfig(s / 31557600), 'yr'];
  }

  /* Exposed so tools/verify_home_threshold.py's browser-side twin, and any
     future widget that wants to agree with this one, can call the same
     functions rather than reimplement them. */
  W.SymbiQ.threshold = {
    pL: pLogical, qubits: patchQubits, lifetime: lifetimeS,
    sci: sci, duration: duration, pTh: P_TH, A: A_PREF, round: ROUND_S
  };

  function buildInstrument() {
    var box = $('#hero-inst');
    if (!box) return;
    var pIn = $('#ti-p', box), dIn = $('#ti-d', box);
    if (!pIn || !dIn) return;

    var pOut = $('#ti-pv', box), dOut = $('#ti-dv', box);
    var vPl = $('#ti-pl', box), vQb = $('#ti-qb', box), vLf = $('#ti-lf', box);
    var vLfU = $('#ti-lfu', box), vVer = $('#ti-verdict', box);

    function render() {
      /* The p slider counts tenths of a percent (1..41) so every step is an
         exact integer and 1.0% is reachable exactly -- a float slider would
         put the one boundary the widget is about at 0.009999999999. */
      var pTenths = +pIn.value;
      var p = pTenths / 1000;
      var d = +dIn.value;

      pOut.textContent = (pTenths / 10).toFixed(1) + '%';
      dOut.textContent = 'd = ' + d;
      /* A range input announces its raw number; these say what the number
         means, so a screen-reader user hears "0.5 percent", not "5". */
      pIn.setAttribute('aria-valuetext', (pTenths / 10).toFixed(1) + '% physical error rate');
      dIn.setAttribute('aria-valuetext', 'code distance ' + d);

      var pl = pLogical(p, d);
      vPl.textContent = sci(pl);
      vQb.textContent = patchQubits(d).toLocaleString('en-US');
      var lf = duration(lifetimeS(pl));
      vLf.textContent = lf[0];
      vLfU.textContent = lf[1];

      if (p < P_TH) {
        vVer.className = 'verdict good';
        /* Lambda = p_th / p is the suppression per d -> d+2, which is what
           "below threshold" actually buys you. Computed, like everything
           else on this face. */
        vVer.textContent = 'Below threshold. Each step of two in d divides p'
          + 'ₗ by ' + sigfig(P_TH / p) + '×.';
      } else if (p === P_TH) {
        /* Exactly at threshold the scaling form is flat: p_L is A for every
           d. Saying "more qubits make it worse" here would be false, and
           1.0% is a position the slider can actually stop on. */
        vVer.className = 'verdict split';
        vVer.textContent = 'Exactly at threshold. More qubits change nothing — the code treads water.';
      } else {
        vVer.className = 'verdict bad';
        vVer.textContent = 'Above threshold. More qubits make it worse, not better.';
      }
    }

    pIn.addEventListener('input', render);
    dIn.addEventListener('input', render);
    render();
  }

  /* ======================================================================
     2. THE PARALLAX
     ----------------------------------------------------------------------
     One rAF-batched write of --px / --py (each -1..1) on <html>; home.css
     section 3 does the rest.  Fine pointers only -- a touch drag is not a
     hover and must not shove the cards around under the finger.
     ==================================================================== */
  function bindParallax() {
    if (reduce) return;
    if (!(W.matchMedia && W.matchMedia('(pointer: fine)').matches)) return;
    var root = D.documentElement, pending = null, tick = 0;
    W.addEventListener('pointermove', function (e) {
      pending = e;
      if (tick) return;
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var x = (pending.clientX / W.innerWidth) * 2 - 1;
        var y = (pending.clientY / W.innerHeight) * 2 - 1;
        root.style.setProperty('--px', x.toFixed(3));
        root.style.setProperty('--py', y.toFixed(3));
      });
    }, { passive: true });
  }

  /* ======================================================================
     3 + 4. THE STATIONS AND THE COMPANION
     ----------------------------------------------------------------------
     Twelve [data-station] sections; a -38% / -38% root margin means a
     station counts as reached only when it is genuinely the thing in the
     middle of the screen, not when one pixel of it clips the bottom edge.

     Three consequences, all of them replies to something the reader did:
       - the ring fills;
       - past three stations the router's lede stops asking a stranger's
         question and starts offering to resume;
       - reaching games / OR / security stamps the matching router door,
         because the door is the page's memory of where you have been.

     WHY IT SUPERSEDES .sq-marker.  alive.css already owns bottom-left with a
     section index. Two fixed panels in one corner is not a design, so on
     this page the companion replaces it: home.css hides .sq-marker, and
     section 5 intercepts `m` before alive.js can toggle a hidden panel (an
     open-but-invisible marker would silently swallow j / k, which alive.js
     guards behind MARKER.isOpen()).
     ==================================================================== */
  var RING_R = 20;
  var RING_C = 2 * Math.PI * RING_R;

  function ringSVG(cls) {
    return '<svg class="sqco-ring ' + (cls || '') + '" viewBox="0 0 48 48" aria-hidden="true">'
      + '<circle class="rg-track" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"/>'
      + '<circle class="rg-fill" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"'
      + ' stroke-dasharray="0 ' + RING_C.toFixed(2) + '" transform="rotate(-90 24 24)"/>'
      + '<text class="rg-num" x="24" y="28" text-anchor="middle">0</text></svg>';
  }

  /* The reading name of each station, for the "you are here" line and the
     door stamps. Authored, not derived from a heading, because four of the
     twelve have no heading of their own. */
  var STATION_NAME = {
    hero: 'The argument',
    threshold: 'The threshold instrument',
    spine: 'The short version',
    router: 'Three doors',
    question: 'The Question',
    loop: 'The loop',
    games: 'Nine games',
    depth: 'Three depths',
    or: 'Operations research',
    pqc: 'Post-quantum security',
    timing: 'Why the timing matters',
    join: 'Join the loop'
  };
  /* station -> the router door it belongs to, and how the stamp reads */
  var DOOR_OF = {
    games: ['quantum', 'the games section read'],
    or: ['or', 'the OR section read'],
    pqc: ['pqc', 'the security section read']
  };

  var COMPANION = null;

  function buildCompanion(stations) {
    var box = D.createElement('div');
    box.className = 'sqco';

    var tab = D.createElement('button');
    tab.type = 'button';
    tab.className = 'sqco-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', 'sqco-card');
    tab.setAttribute('aria-label', 'Reading progress and keyboard shortcuts');
    tab.innerHTML = ringSVG('rg-tab');

    var card = D.createElement('div');
    card.className = 'sqco-card';
    card.id = 'sqco-card';
    card.innerHTML =
      '<div class="sqco-head">' + ringSVG('rg-card') +
        '<span class="sqco-count"><b id="sqco-n">0</b> of ' + stations.length +
        ' stations<span>on this page</span></span>' +
        '<button type="button" class="sqco-x" aria-label="Collapse">×</button>' +
      '</div>' +
      '<p class="sqco-here"><b>You are here</b><span id="sqco-here">—</span></p>' +
      '<div class="sqco-keys">' +
        '<div><span>g h</span><span>top of the page</span></div>' +
        '<div><span>g p</span><span>the games</span></div>' +
        '<div><span>1 2 3</span><span>the three depths</span></div>' +
        '<div><span>j k</span><span>next / previous section</span></div>' +
        '<div><span>m</span><span>this card</span></div>' +
      '</div>' +
      '<button type="button" class="sqco-more">Every shortcut (?) ›</button>';

    box.appendChild(tab);
    box.appendChild(card);
    D.body.appendChild(box);

    var fills = $$('.rg-fill', box);
    var nums = $$('.rg-num', box);
    var nEl = $('#sqco-n', box);
    var hereEl = $('#sqco-here', box);
    var open = false;

    function setOpen(v) {
      open = !!v;
      if (open) box.setAttribute('data-open', ''); else box.removeAttribute('data-open');
      tab.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var x = $('.sqco-x', box); if (x) x.focus(); }
      else if (D.activeElement && box.contains(D.activeElement)) tab.focus();
    }
    tab.addEventListener('click', function () { setOpen(true); });
    $('.sqco-x', box).addEventListener('click', function () { setOpen(false); });
    $('.sqco-more', box).addEventListener('click', function () { KEYMAP().toggle(true); });

    COMPANION = {
      el: box,
      isOpen: function () { return open; },
      toggle: function (force) { setOpen(typeof force === 'boolean' ? force : !open); },
      show: function (v) {
        if (v) box.setAttribute('data-on', '');
        else { box.removeAttribute('data-on'); setOpen(false); }
      },
      progress: function (n, total, label) {
        var frac = total ? n / total : 0;
        var on = (RING_C * frac).toFixed(2);
        fills.forEach(function (f) { f.setAttribute('stroke-dasharray', on + ' ' + RING_C.toFixed(2)); });
        nums.forEach(function (t) { t.textContent = String(n); });
        if (nEl) nEl.textContent = String(n);
        if (hereEl) hereEl.textContent = label || '—';
      }
    };
    return COMPANION;
  }

  function bindStations() {
    var stations = $$('[data-station]');
    if (!stations.length) return;

    var co = buildCompanion(stations);
    var seen = {}, nSeen = 0, ledeSwitched = false;

    function stampDoor(name) {
      var d = DOOR_OF[name];
      if (!d) return;
      var card = $('.introute-card[data-track="' + d[0] + '"]');
      if (!card) return;
      /* Never overwrite a real saved-progress line with a weaker one: the
         inline hub script in index.html reads localStorage and marks a door
         .resume when it has something true to say. This only fills doors
         that had nothing. */
      if (card.classList.contains('resume')) return;
      var pg = card.querySelector('.pg');
      if (!pg) return;
      pg.textContent = '↻ ' + d[1];
      pg.hidden = false;
    }

    function mark(el) {
      var name = el.getAttribute('data-station');
      if (seen[name]) return;
      seen[name] = true;
      nSeen++;
      stampDoor(name);
      /* Past three stations the reader is no longer a stranger being asked
         which of three things they came for. */
      if (!ledeSwitched && nSeen > 3) {
        ledeSwitched = true;
        var lede = $('#introute-lede');
        if (lede) lede.textContent = 'Pick up where you left off.';
      }
    }

    var current = stations[0];
    function paint() { co.progress(nSeen, stations.length, STATION_NAME[current.getAttribute('data-station')] || ''); }

    if ('IntersectionObserver' in W) {
      var io = new W.IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          mark(e.target);
          current = e.target;
        });
        paint();
      }, { rootMargin: '-38% 0px -38% 0px', threshold: 0 });
      stations.forEach(function (s) { io.observe(s); });

      /* The companion must never occlude the hero instrument. Rather than
         trust a margin at some assumed viewport, watch the instrument
         itself: while any part of it is on screen the companion is not.
         That is a guarantee at every width and every zoom level, not an
         estimate. */
      var inst = $('#hero-inst');
      if (inst) {
        new W.IntersectionObserver(function (entries) {
          co.show(!entries[0].isIntersecting);
        }, { threshold: 0 }).observe(inst);
      } else {
        co.show(true);
      }
    } else {
      /* No observer: no ring, but also no half-built furniture. */
      co.show(false);
    }
    paint();
  }

  /* ======================================================================
     5. THE KEYS
     ----------------------------------------------------------------------
     WHO OWNS WHICH KEY, and why this handler is on the CAPTURE phase.

     Three other listeners are already on this document by the time this one
     binds: nav.js (Escape closes the menus), alive.js (? j k n p m, bubble
     phase, and it honours e.defaultPrevented), and qubit.js (X Y Z H S T M R,
     bubble phase, and it does NOT check defaultPrevented -- deliberately, it
     is an easter egg that should be hard to disable by accident).

     So:
       - preventDefault is enough to stand alive.js down.
       - h inside the `g` window needs stopPropagation too, or the jump would
         also apply a Hadamard to the page-state qubit.
       - Escape only stops propagating when this file actually closed
         something; otherwise nav.js still needs it to shut the menus.
       - m is intercepted (preventDefault only) so alive.js cannot toggle the
         .sq-marker home.css hides -- an open-but-invisible marker swallows
         j / k. qubit.js still measures on m, exactly as on every other page.
       - h, p, j, k outside the `g` window are left entirely alone.

     THE HEADER OFFSET is 78px: the sticky header measures ~68-70px at the
     widths where it is sticky at all, and the remainder is the breathing
     room style.css's own scroll-padding-top adds.
     ==================================================================== */
  var JUMP_OFF = 78;
  var FLARE_MS = 1300;

  function flare(el) {
    if (!el || reduce || !el.animate) return;
    var t = rgbOf('--teal', [45, 212, 191]);
    try {
      /* Light only, no movement: alive.css's arrival rule. The target is
         already where it belongs, so nothing about it should move. */
      el.animate([
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.55), backgroundColor: rgba(t, 0.09), offset: 0.14 },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.30), backgroundColor: rgba(t, 0.05), offset: 0.55 },
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) }
      ], { duration: FLARE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    } catch (e) {}
  }

  /* Where the element WILL be, not where it is being drawn.
     style.css's .reveal carries transform: translateY(14px) until nav.js
     reveals it, and .reveal.in > * runs fadeUp from another translateY(10px)
     on top of that. Both are transforms, so they move the rendered box
     without moving the layout -- and getBoundingClientRect() reports the
     rendered box. Reading it mid-reveal lands a jump up to ~27px off, and
     the target then slides out from under the landing.

     offsetTop is layout, not paint: it ignores every transform in the
     chain, so this is the settled position whether or not the target has
     been revealed yet. Measured 2026-09-05 on the games section (105px
     instead of 78px) and on #tier-g (74px). */
  function layoutTop(el) {
    var y = 0, n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  /* An instant scroll, whatever the CSS says. html carries
     scroll-behavior: smooth site-wide, and behavior:'auto' defers to it, so
     the only portable way to move without animating is to switch the CSS off
     for the one call. ('instant' works in current browsers but not in the
     Safari versions this site still renders correctly in.) */
  function snapTo(y) {
    var de = D.documentElement, prev = de.style.scrollBehavior;
    de.style.scrollBehavior = 'auto';
    W.scrollTo(0, y);
    de.style.scrollBehavior = prev;
  }

  /* Land, then check you actually landed.

     The target can move AFTER the scroll has committed to a number. Measured
     2026-09-05: pressing g p scrolled to 2214, and while the smooth scroll
     was still running The Question finished its three-step fetch chain
     (today.json -> qbank.json -> the question file) and grew the page 27px
     ABOVE the games section, leaving the landing 27px short. nav.js already
     records the same class of problem for hash links ("one rAF lands
     short").

     So: wait for the scroll to stop moving, re-measure, and nudge instantly
     if it is off. Capped at three corrections and ~3s so a page that never
     settles cannot leave a timer running. The nudge is instant rather than
     smooth because it is a correction of a few pixels, not a journey. */
  var LAND = 0;      /* the jump a correction belongs to; a newer jump wins */
  function landOn(el) {
    var mine = ++LAND;
    var lastY = null, stillFor = 0, tries = 0, ticks = 0;
    (function tick() {
      /* A second jump while this one is still settling must not be dragged
         back by the first one's correction -- press g p then g h quickly
         and the top would snap back to the games section a second later. */
      if (mine !== LAND) return;
      if (++ticks > 60) return;                       /* ~3s ceiling */
      var y = Math.round(W.pageYOffset);
      stillFor = (y === lastY) ? stillFor + 1 : 0;
      lastY = y;
      if (stillFor >= 2) {
        var want = Math.max(0, layoutTop(el) - JUMP_OFF);
        if (Math.abs(want - y) <= 2 || tries >= 3) return;
        tries++;
        stillFor = 0;
        snapTo(want);
      }
      W.setTimeout(tick, 50);
    })();
  }

  function jumpTo(el) {
    if (!el) return;
    var d = el.closest ? el.closest('details') : null;
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
    W.scrollTo({ top: Math.max(0, layoutTop(el) - JUMP_OFF), behavior: reduce ? 'auto' : 'smooth' });
    flare(el);
    landOn(el);
  }
  function jumpTop() {
    LAND++;                       /* cancel any correction still in flight */
    W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var h = $('.wrap h1');
    if (h) flare(h);
  }

  /* -- the keymap overlay ------------------------------------------------ */
  var _keymap = null;
  function KEYMAP() {
    if (_keymap) return _keymap;
    var hasQubit = !!(W.SymbiQ && W.SymbiQ.qubit);
    var rows = [
      ['<kbd>g</kbd><kbd>h</kbd>', 'Back to the top'],
      ['<kbd>g</kbd><kbd>p</kbd>', 'The games section'],
      ['<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>', 'The three depths: plain, working, formal'],
      ['<kbd>j</kbd><kbd>k</kbd>', 'Next / previous section'],
      ['<kbd>m</kbd>', 'Open or close the corner companion'],
      ['<kbd>?</kbd>', 'Show / hide this list'],
      ['<kbd>Esc</kbd>', 'Close whatever is open']
    ];
    if (hasQubit) {
      rows.push(['<kbd>X</kbd>…<kbd>T</kbd>', 'Turn the page-state qubit (bottom-right)']);
      rows.push(['<kbd>M</kbd> / <kbd>R</kbd>', 'Measure it / reset it']);
    }

    var ov = D.createElement('div');
    ov.className = 'sqov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Keyboard shortcuts');
    ov.innerHTML =
      '<div class="sqov-card" tabindex="-1">' +
        '<h2>Keyboard</h2>' +
        rows.map(function (r) {
          return '<div class="sqov-row"><span class="sqov-keys">' + r[0] +
                 '</span><span class="sqov-what">' + r[1] + '</span></div>';
        }).join('') +
        '<p class="sqov-hint">One more, undocumented on purpose: type the first four primes.</p>' +
        '<button type="button" class="sqov-shut">Close</button>' +
      '</div>';
    D.body.appendChild(ov);
    _keymap = overlay(ov);
    return _keymap;
  }

  /* One open/close/focus implementation for both overlays. */
  function overlay(ov) {
    var card = $('.sqov-card', ov);
    var last = null;
    function shut() {
      if (!ov.hasAttribute('data-open')) return false;
      ov.removeAttribute('data-open');
      if (last && last.focus) { try { last.focus(); } catch (e) {} }
      return true;
    }
    function show() {
      last = D.activeElement;
      ov.setAttribute('data-open', '');
      if (card) card.focus();
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
    var btn = $('.sqov-shut', ov);
    if (btn) btn.addEventListener('click', shut);
    return {
      el: ov,
      isOpen: function () { return ov.hasAttribute('data-open'); },
      close: shut,
      toggle: function (force) {
        var want = (typeof force === 'boolean') ? force : !ov.hasAttribute('data-open');
        if (want) show(); else shut();
      }
    };
  }

  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
  }

  /* -- the nav's discoverability button ----------------------------------
     Injected rather than written into the markup: check_site.py requires all
     24 <nav> blocks to be byte-identical, and this control belongs to one
     page.

     THE WIDTH BUDGET IS MEASURED, EVERY TIME. The 2026-08-28 note said a
     40px nav control fits; measured again 2026-09-05 it does not -- at the
     880px .wrap tier the row carries 832px in 840px, so eight pixels of
     slack, and ANY fifth item costs a whole 62px row (81px -> 143px). Below
     1024px the nav is already two rows, so the button is free; at 1440px and
     up the row has ~168px spare, so it is free again.

     Rather than hard-code that band -- which would be wrong the next time
     the nav gains or loses a link -- this inserts the button, measures the
     nav, and takes it straight back out if the height moved. A control that
     silently costs 62px of header is exactly the bug that note was written
     about, and this is the probe it recommends, run for real instead of
     remembered. Re-run on resize, so crossing 1440px gains it.

     Where it cannot go in the nav, the keymap is still one keystroke away
     (?) and one click away in the corner companion.                       */
  var NAVBTN = null;
  function buildNavButton() {
    var nav = $('nav:not(.rung-rail)');
    if (!nav) return;

    NAVBTN = D.createElement('button');
    NAVBTN.type = 'button';
    NAVBTN.className = 'sq-keyhint';
    NAVBTN.textContent = '?';
    NAVBTN.title = 'Keyboard shortcuts (?)';
    NAVBTN.setAttribute('aria-label', 'Keyboard shortcuts');
    NAVBTN.addEventListener('click', function () { KEYMAP().toggle(); });

    function insert() {
      var acct = $('#sq-account', nav);
      if (acct) nav.insertBefore(NAVBTN, acct); else nav.appendChild(NAVBTN);
    }

    /* Measure BOTH heights every time, always taking the button out first --
       otherwise the "before" reading already includes it and the comparison
       is meaningless. Both reads happen inside one task, so the browser
       never paints the intermediate two-row state. */
    function measure() {
      if (NAVBTN.parentNode) NAVBTN.remove();
      var without = nav.getBoundingClientRect().height;
      insert();
      if (nav.getBoundingClientRect().height > without + 1) NAVBTN.remove();
    }

    measure();
    /* Re-measure after the nav has finished assembling itself. auth.js
       un-hides the 40px account disclosure AFTER this script runs, which at
       the 880px .wrap tier is exactly the 40px that turns "fits" into "costs
       a whole row" -- the first measurement said yes and was then quietly
       wrong. Same spaced-sweep shape alive.js uses for late-mounting widgets. */
    [400, 1200, 3000].forEach(function (t) { W.setTimeout(measure, t); });

    var rt;
    W.addEventListener('resize', function () {
      W.clearTimeout(rt);
      rt = W.setTimeout(measure, 200);
    }, { passive: true });
  }

  function bindKeys() {
    var gAt = 0;                 /* when `g` was pressed; 900ms window */
    var G_WINDOW = 900;
    var buf = '';                /* rolling four-character buffer, section 6 */

    D.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (editable(e.target) || editable(D.activeElement)) return;

      var k = e.key;

      /* Escape first: it closes, and only claims the event when it did. */
      if (k === 'Escape') {
        var closed = false;
        if (_keymap && _keymap.isOpen()) closed = _keymap.close() || closed;
        if (_primes && _primes.isOpen()) closed = _primes.close() || closed;
        if (COMPANION && COMPANION.isOpen()) { COMPANION.toggle(false); closed = true; }
        if (closed) { e.preventDefault(); e.stopPropagation(); }
        return;   /* not closed by us: nav.js still needs it for the menus */
      }

      /* The rolling buffer. Kept before the jumps so a deliberate 2-3-5-7
         still lands even though 2 and 3 are also jumps. */
      if (k && k.length === 1) {
        buf = (buf + k).slice(-4);
        if (buf === '2357') {
          buf = '';
          e.preventDefault();
          e.stopPropagation();
          PRIMES().toggle(true);
          return;
        }
      }

      /* g, then h or p, inside a 900ms window. */
      var now = Date.now();
      if (k === 'g') { gAt = now; e.preventDefault(); return; }
      if (gAt && now - gAt < G_WINDOW && (k === 'h' || k === 'p')) {
        gAt = 0;
        e.preventDefault();
        /* qubit.js does not check defaultPrevented, so h would ALSO apply a
           Hadamard without this. */
        e.stopPropagation();
        if (k === 'h') jumpTop();
        else jumpTo($('[data-station="games"]'));
        return;
      }
      if (k !== 'g') gAt = 0;

      if (k === '1' || k === '2' || k === '3') {
        var id = { '1': 'tier-g', '2': 'tier-y', '3': 'tier-r' }[k];
        var t = D.getElementById(id);
        if (t) { e.preventDefault(); jumpTo(t); }
        return;
      }

      if (k === '?') { e.preventDefault(); KEYMAP().toggle(); return; }

      /* m: claim it from alive.js (which honours defaultPrevented) so it can
         never toggle the .sq-marker home.css hides. Deliberately NOT
         stopPropagation: qubit.js's measure still runs on m here exactly as
         it does on the other 23 pages. */
      if (k === 'm' && COMPANION) {
        e.preventDefault();
        COMPANION.toggle();
        return;
      }
    }, true);
  }

  /* ======================================================================
     6. THE GESTURE
     ----------------------------------------------------------------------
     HIDDEN, and undocumented on purpose -- the keymap says only that there
     is one and that it is four primes. Nothing in the page body mentions it.

     Order-finding is the whole quantum content of Shor's algorithm, and it
     is the reason the numbers in the Bitcoin figure further down this page
     moved by 3,800x in four years: a cheaper way to run ONE subroutine
     re-costs the entire attack. So the panel does the arithmetic by hand,
     small enough to check, with N = 15 and a = 7.

     Every number below is verified by hand and by tools/verify_home_threshold.py:
       7^1 = 7,   7 mod 15 = 7
       7^2 = 49,  49 mod 15 = 4
       7^3 = 343, 343 mod 15 = 13
       7^4 = 2401, 2401 mod 15 = 1     -> the period r = 4, and it is even
       7^(r/2) = 7^2 = 49
       gcd(49 - 1, 15) = gcd(48, 15) = 3
       gcd(49 + 1, 15) = gcd(50, 15) = 5      and 3 x 5 = 15.
     ==================================================================== */
  var _primes = null;
  function PRIMES() {
    if (_primes) return _primes;
    var ov = D.createElement('div');
    ov.className = 'sqov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Order-finding, by hand');
    ov.innerHTML =
      '<div class="sqov-card" tabindex="-1">' +
        '<h2>Order-finding, by hand</h2>' +
        '<p class="lede">Take <b>N = 15</b> and a number with no factor in common with it, <b>a = 7</b>. ' +
        'Multiply 7 by itself, modulo 15, until you come back to 1.</p>' +
        '<table class="sqov-work"><thead><tr>' +
          '<th>power</th><th>value</th><th>mod 15</th></tr></thead><tbody>' +
          '<tr><td>7¹</td><td>7</td><td class="n">7</td></tr>' +
          '<tr><td>7²</td><td>49</td><td class="n">4</td></tr>' +
          '<tr><td>7³</td><td>343</td><td class="n">13</td></tr>' +
          '<tr class="hit"><td>7⁴</td><td>2401</td><td class="n">1</td></tr>' +
        '</tbody></table>' +
        '<p>It closes at the fourth step, so the <b>period r = 4</b>. Because r is even, ' +
        '7<sup>r/2</sup> = 7² = 49 sits one step either side of a multiple of 15, and the ' +
        'two factors fall out of a schoolbook algorithm:</p>' +
        '<p><b>gcd(49 − 1, 15) = gcd(48, 15) = 3</b><br>' +
        '<b>gcd(49 + 1, 15) = gcd(50, 15) = 5</b><br>' +
        'and 3 × 5 = 15.</p>' +
        '<p>Everything you just read is classical. <b>Only the period-finding step is quantum</b> — ' +
        'the rest is multiplication and Euclid. That is why the cost estimates in the Bitcoin chart ' +
        'on this page move so far when somebody finds a cheaper way to run one subroutine: the ' +
        'attack is mostly ordinary arithmetic wrapped around a single quantum kernel.</p>' +
        '<button type="button" class="sqov-shut">Close</button>' +
      '</div>';
    D.body.appendChild(ov);
    _primes = overlay(ov);
    return _primes;
  }

  /* ======================================================================
     7. THE FIELD
     ----------------------------------------------------------------------
     Replaces atmosphere.js's lattice on this page (index.html does not load
     that file at all any more), for one reason: the homepage argues that
     coupling many identical circuits is what turns a qubit story into an
     optimisation machine, and this version makes the coupling something you
     can put your hand into. The pointer is a weak ATTRACTOR, not a repeller
     -- nodes gather toward it and their bonds warm from lavender to mint as
     they arrive, which is the Colour Law running on the background.

     Still not a video. No network request, no photographic byte, and it
     re-themes from --violet / --teal like everything else.

     THE ALPHA BUDGET is the whole constraint. Text sits over this canvas, so
     the field has to be readable as texture and invisible as contrast: link
     alpha peaks at 0.25 and only where the cursor is, node alpha at rest is
     a fifth of that, and the glow is a shadowBlur that scales with proximity
     so a resting field throws none at all.

     HIDDEN, item 2 of 2 (the other is qubit.js): clicking a node injects an
     excitation that propagates outward along the couplings at finite speed,
     losing amplitude at every hop -- a discrete wave on a weighted graph.
     Carried over from atmosphere.js so this page does not quietly lose a
     site secret when it stops loading that file.
     ==================================================================== */
  var LINK = 150;         /* px: coupling range */
  var CURSOR = 210;       /* px: how far the pointer's pull reaches */
  /* The one number that makes the field louder or quieter. Everything below
     scales off it, and tools/verify_home_ux.mjs measures the CONSEQUENCE --
     the contrast body text actually renders at with the field composited
     behind it -- rather than trusting a constant. Raise it and the checker
     tells you when the prose starts paying for it. */
  var GAIN = 1.45;
  /* THE CURSOR RESPONSE, raised 2026-09-05. Chinmoy: the field followed the
     pointer more sluggishly than atmosphere.js's lattice does on the other
     23 pages. Steady-state speed under a constant pull is roughly
     PULL / (1 - DAMP), so both numbers matter and only raising PULL would
     have made it lunge and then crawl. Lifting the ceiling too keeps the
     gather quick without turning it into a swarm -- verify_home_ux.mjs
     measures the mean speed of the nodes actually inside the cursor radius
     and fails at both ends of the band. */
  var PULL = 0.105;       /* peak acceleration toward the cursor, per frame */
  var DAMP = 0.984;       /* velocity retained per frame */
  var VMAX = 2.6;         /* px/frame speed clamp */
  var VMIN = 0.05;        /* below this, re-inject jitter so it cannot clump */
  var WAVE = 0.42;        /* px per ms: excitation propagation speed */
  var HOP_LOSS = 0.72;    /* amplitude retained per hop */
  var MIN_AMP = 0.06;
  var MAX_EVENTS = 400;

  var cvs, ctx, w = 0, h = 0, dpr = 1;
  var nodes = [], raf = 0, running = false;
  var ptr = { x: -9999, y: -9999, live: false };
  var coherence = 0;
  var VIO = [167, 139, 250], TEA = [45, 212, 191];

  function readColours() {
    VIO = rgbOf('--violet', VIO);
    TEA = rgbOf('--teal', TEA);
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* AN EARLIER VERSION DIMMED THE FIELD BEHIND .wrap and ran it at full
     strength in the gutters. That was written when .wrap capped at 1040px
     and the gutters were hundreds of pixels wide. Widening the column (see
     home.css section 0) left 50px of gutter at 1280px -- less than the
     feather -- so the "quiet band" covered essentially the whole screen and
     the field came out DIMMER than before, which is the opposite of the
     brief. Measured, then deleted.

     The field is now uniformly bright, and readability is protected by the
     thing that actually matters: the contrast body text renders at with the
     field composited underneath it. verify_home_ux.mjs computes that number
     from the real pixels and fails under 7:1 -- comfortably inside the 4.5:1
     the Contrast Lock demands, with the margin left as headroom for GAIN. */

  function sizeField() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    w = W.innerWidth; h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedField() {
    /* Density by area, so a phone gets a sparse field and a 4K monitor a
       full one at the same visual weight. */
    var n = Math.max(44, Math.min(150, Math.round((w * h) / 12000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.15 + Math.random() * 1.65,
        ph: Math.random() * Math.PI * 2,          /* twinkle phase */
        sp: 0.6 + Math.random() * 0.8,            /* twinkle rate */
        amp: 0,
        heat: 0
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
      if (next < MIN_AMP || o.amp > next) continue;
      (function (jj, nn) {
        W.setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function stepField(dt) {
    var f = dt / 16.67;                 /* normalise the per-frame constants */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      n.heat = 0;
      if (ptr.live) {
        var dx = ptr.x - n.x, dy = ptr.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 0.5) {
          var prox = 1 - d / CURSOR;
          n.heat = prox;
          var a = prox * PULL * f;
          n.vx += (dx / d) * a;
          n.vy += (dy / d) * a;
        }
      }

      n.vx *= Math.pow(DAMP, f);
      n.vy *= Math.pow(DAMP, f);

      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > VMAX) { n.vx = n.vx / sp * VMAX; n.vy = n.vy / sp * VMAX; }
      /* Below VMIN the gather would settle into a permanent clump around
         wherever the cursor last was. A little jitter keeps it a field. */
      if (sp < VMIN) { n.vx += (Math.random() - 0.5) * 0.05; n.vy += (Math.random() - 0.5) * 0.05; }

      n.x += n.vx * f;
      n.y += n.vy * f;

      /* Wrap rather than bounce: a bounce reads as a wall, and the field is
         meant to continue past the viewport. */
      if (n.x < -24) n.x = w + 24; else if (n.x > w + 24) n.x = -24;
      if (n.y < -24) n.y = h + 24; else if (n.y > h + 24) n.y = -24;

      n.amp *= Math.pow(0.9975, dt);
      if (n.amp < 0.004) n.amp = 0;
    }
  }

  function drawField(t) {
    ctx.clearRect(0, 0, w, h);

    /* Couplings first, so a node sits on top of its own bonds. */
    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;
        var heat = (a.heat + b.heat) * 0.5;
        var lift = (a.amp + b.amp) * 0.5;
        var al = (0.13 + heat * 0.32 + lift * 0.26) * (1 - d / LINK)
               + coherence * 0.06 * (1 - d / LINK);
        al *= GAIN;
        if (al < 0.008) continue;
        /* Lavender out in the cold, mint where your hand is. */
        ctx.strokeStyle = rgba(mix(VIO, TEA, Math.min(1, heat + lift)), Math.min(0.46, al));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      var tw = 0.5 + 0.5 * Math.sin(t * 0.0009 * n.sp + n.ph);
      var warm = Math.min(1, n.heat + n.amp);
      var colr = mix(VIO, TEA, warm);
      var al = (0.26 + tw * 0.14 + n.heat * 0.44 + n.amp * 0.5 + coherence * 0.08) * GAIN;
      /* The glow lives only inside the field: no shadow at rest, so a
         resting canvas costs nothing and shows nothing. */
      var glow = (n.heat * 0.9 + n.amp) * 11;
      if (glow > 0.35) {
        ctx.shadowBlur = glow;
        ctx.shadowColor = rgba(colr, 0.55);
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = rgba(colr, Math.min(0.95, al));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (1 + tw * 0.24 + n.heat * 0.55 + n.amp * 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  var lastT = 0;
  function frame(t) {
    if (!running) return;
    var dt = lastT ? Math.min(t - lastT, 48) : 16;   /* a backgrounded tab must not teleport */
    lastT = t;
    stepField(dt);
    drawField(t);
    raf = W.requestAnimationFrame(frame);
  }
  function startField() { if (running) return; running = true; lastT = 0; raf = W.requestAnimationFrame(frame); }
  function stopField() { running = false; if (raf) W.cancelAnimationFrame(raf); raf = 0; }

  function buildField() {
    /* Bails out entirely under reduced motion. There is no "one static
       frame" worth drawing here: the whole point of this layer is that it
       answers the pointer, and a still copy of it is just noise over text. */
    if (reduce) return;
    if (!D.body || !D.body.hasAttribute('data-motion')) return;

    cvs = D.createElement('canvas');
    cvs.id = 'sq-field';
    cvs.setAttribute('aria-hidden', 'true');
    D.body.appendChild(cvs);
    ctx = cvs.getContext('2d');
    if (!ctx) { cvs.remove(); cvs = null; return; }

    readColours();
    sizeField();
    seedField();
    drawField(0);
    if (!D.hidden) startField();
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    var rt;
    W.addEventListener('resize', function () {
      W.clearTimeout(rt);
      rt = W.setTimeout(function () {
        sizeField(); seedField();
        if (!running) drawField(0);
      }, 160);
    });

    W.addEventListener('pointermove', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { ptr.live = false; });
    W.addEventListener('blur', function () { ptr.live = false; });

    /* Listens on window, because the canvas is pointer-events:none and must
       never eat a click meant for a link. Only a click that lands ON a node
       does anything at all, so it is found by aiming, not by flailing. */
    W.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, summary, label')) return;
      var best = -1, bestD = 22;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].x - e.clientX, dy = nodes[i].y - e.clientY;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) excite(best, 1, { n: 0 });
    }, { passive: true });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stopField(); else { stopField(); startField(); }
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () { readColours(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
  }

  /* THE SHEEN, carried over from atmosphere.js. motion.css section 4 reads
     --mo-x / --mo-y off a hovered card; dropping atmosphere.js from this page
     would otherwise have quietly removed the pointer-tracked light source
     from every card on it. One style write per frame. */
  function bindSheen() {
    if (reduce) return;
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
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

  /* qubit.js drives this with |2 alpha beta*|, the off-diagonal coherence of
     the density matrix -- the quantity that survives only while the page is
     unmeasured. Same public surface atmosphere.js published, so the easter
     egg's shimmer channel still exists on this page. */
  W.SymbiQ.lattice = {
    setCoherence: function (c) {
      coherence = Math.max(0, Math.min(1, c || 0));
      if (ctx && !running) drawField(W.performance ? W.performance.now() : 0);
    },
    pulse: function () {
      if (!nodes.length) return;
      excite(Math.floor(Math.random() * nodes.length), 0.85, { n: 0 });
    },
    ready: function () { return !!ctx; }
  };

  /* ====================================================================== */
  function boot() {
    try { buildInstrument(); } catch (e) {}
    try { bindParallax(); } catch (e) {}
    try { bindStations(); } catch (e) {}
    try { buildNavButton(); } catch (e) {}
    try { bindKeys(); } catch (e) {}
    try { buildField(); } catch (e) {}
    try { bindSheen(); } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
