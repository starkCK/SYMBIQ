/* SymbiQ: the one copy of the helpers every other script needs.

   Built 2026-09-18 for plan 24 §2.2. Before this file the same four helpers
   were hand-written in file after file -- `esc()` in twelve, the
   reduced-motion test in twelve, guarded localStorage in eleven -- and the
   copies had drifted apart. That drift is the whole argument for this file:

   * Three of the twelve `esc()` copies were WEAKER than the rest.
     `missions.js` escaped only & < >, `hud.js` and `feasible-tools.js` left
     the apostrophe unescaped. None of the three was exploitable, because each
     wrote to text content or a double-quoted attribute -- but knowing that
     required auditing every call site by hand, which is exactly the audit
     this file is meant to abolish. A thirteenth copy, one line weaker, would
     have passed every check the repo had.

   * Ten of the twelve motion tests read ONLY the operating system's
     `prefers-reduced-motion`. SymbiQ has its OWN "Reduce motion" switch
     (theme.js, which writes `data-motion-pref="reduce"` on <html>), and
     `theme.css` honours it for CSS animation and transition. It did not
     reach the JavaScript: alive.js, atmosphere.js, scene.js, dynamics.js,
     nav.js, rails.js and tiers.js all keep their requestAnimationFrame loops
     running after the reader flips the switch. Only home.js and living.js
     got it right. `reduced()` below reads both, so the switch now means what
     the label says.

   ES5 on purpose, same as every other script here: no build step, no
   transpiler, works from `file://`.

   Loaded FIRST on all 26 pages, before any consumer. That is not a
   convention -- `check_site.py` §10 fails the build if a page loads a
   consumer without loading this file ahead of it.

   API: window.SymbiQ.core = { esc, reduced, store, $, all, on }  */
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  /* ------------------------------------------------------------------ esc */
  /* The canonical HTML escape: the strongest of the twelve it replaces.
     Five characters, which is what makes it safe in text content AND in
     either flavour of quoted attribute. Null and undefined become the empty
     string rather than the words "null" and "undefined" -- two of the old
     copies used a bare String(s) and printed those. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* -------------------------------------------------------------- reduced */
  /* True when motion should be suppressed, for EITHER reason: the reader's
     operating system says so, or the reader flipped SymbiQ's own switch.

     Deliberately a function, not a cached boolean. The old copies sampled
     once at script load, so a reader who flipped the switch mid-visit kept
     the animation until they reloaded. Call sites that still want the
     load-time value can keep caching it; call sites inside a loop now get
     the live answer for free. */
  function reduced() {
    if (D.documentElement.getAttribute('data-motion-pref') === 'reduce') return true;
    return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ---------------------------------------------------------------- store */
  /* localStorage that cannot throw. It throws for real reasons -- Safari
     private browsing, a full quota, third-party-cookie blocking in an iframe
     -- and a page that renders is worth more than a preference that persists.
     Every method swallows and degrades: reads give you the fallback, writes
     are silently dropped.

     getJSON/setJSON are the shape eleven callers were already hand-rolling
     around JSON.parse. */
  var store = {
    get: function (k, fallback) {
      try {
        var v = W.localStorage.getItem(k);
        return v === null ? (fallback === undefined ? null : fallback) : v;
      } catch (e) { return fallback === undefined ? null : fallback; }
    },
    set: function (k, v) {
      try { W.localStorage.setItem(k, v); return true; } catch (e) { return false; }
    },
    del: function (k) {
      try { W.localStorage.removeItem(k); return true; } catch (e) { return false; }
    },
    getJSON: function (k, fallback) {
      try {
        var raw = W.localStorage.getItem(k);
        if (raw === null) return fallback;
        var v = JSON.parse(raw);
        return v === null || v === undefined ? fallback : v;
      } catch (e) { return fallback; }
    },
    setJSON: function (k, v) {
      try { W.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
  };

  /* ------------------------------------------------------------------ DOM */
  function $(sel, root) { return (root || D).querySelector(sel); }

  /* A real Array, not a NodeList, so .map/.filter/.forEach all work in ES5
     without the slice dance every caller was doing. */
  function all(sel, root) {
    return Array.prototype.slice.call((root || D).querySelectorAll(sel));
  }

  /* Delegated listener: one handler on a container instead of N on children,
     which is what lets a list re-render without re-binding. Returns an
     unbind function. */
  function on(root, type, sel, fn) {
    function handler(ev) {
      var el = ev.target;
      if (!el || el.nodeType !== 1) el = el && el.parentElement;
      for (; el && el !== root; el = el.parentElement) {
        if (el.matches && el.matches(sel)) { fn.call(el, ev, el); return; }
      }
    }
    root.addEventListener(type, handler);
    return function () { root.removeEventListener(type, handler); };
  }

  /* -------------------------------------------------------------- loading */

  /* One fetch per URL however many callers ask, and a promise that resolves
     when the script has actually executed. Added 2026-09-21 so that "fetch
     this only when it is really needed" is one implementation rather than one
     per caller -- auth.js had its own copy, and the three pages that mount a
     game on demand would each have grown another. */
  var loaded = Object.create(null);
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = D.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      D.head.appendChild(s);
    });
    return loaded[src];
  }

  /* Run fn once, when el comes within `margin` px of the viewport -- for work
     a reader below the fold should not pay for until they are heading towards
     it. The margin is deliberately large: the point is to be finished by the
     time they arrive, not to start when they do.

     Two behaviours worth knowing. Without IntersectionObserver it runs fn
     immediately, because doing the work too early is a far better failure than
     never doing it. And an element inside a display:none ancestor never
     intersects, so a tier-hidden widget legitimately costs nothing until the
     reader picks a depth that reveals it -- at which point this fires. */
  function onNear(el, fn, margin) {
    var noop = function () {};
    if (!el) return noop;
    if (!W.IntersectionObserver) { fn(); return noop; }
    var io = new W.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); fn(); return; }
      }
    }, { rootMargin: (margin == null ? 1200 : margin) + 'px 0px' });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  W.SymbiQ.core = {
    esc: esc,
    reduced: reduced,
    store: store,
    $: $,
    all: all,
    on: on,
    loadScript: loadScript,
    onNear: onNear
  };
}());
