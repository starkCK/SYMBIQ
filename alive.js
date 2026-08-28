/* SymbiQ — alive.js
 * ============================================================================
 * THE RESPONSE LAYER.  Pairs with alive.css; both are gated on
 * <body data-alive>.  Three things, all of them replies to something the
 * visitor did:
 *
 *   1. ARRIVAL      a deep link resolves -> the target says "me"
 *   2. PERMALINK    every id'd heading can hand you its own deep link
 *   3. UNFOLD       <details> opens and closes with a height instead of a cut
 *   4. READBAR      the one page that never got tiers.js gets its progress bar
 *
 * SAFETY CONTRACT, same as nav.js's: this file is pure enhancement.  It adds
 * no class that hides content, it removes nothing from the DOM, every entry
 * point is inside its own try/catch, and every <details> it touches is left
 * with its native behaviour intact.  If this script 404s, throws on line one,
 * or is blocked entirely, every page behaves exactly as it did before it
 * existed.  That is not a nice-to-have here -- the fold handler intercepts the
 * most common interaction on the site, so its failure mode has to be "native
 * <details>", never "a section that will not open".
 *
 * ORDERING.  Must load AFTER nav.js.  nav.js owns opening the <details>
 * ancestors of a hash target and scrolling to it; this file only marks what
 * arrived.  It also owns `.reveal` -- nothing here adds that class, for the
 * reason motion.css section 3 sets out at length.
 * ==========================================================================*/
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-alive')) return;

  var reduce = false;
  try {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* treat an unreadable preference as "no preference" */ }

  /* ======================================================================
     1. ARRIVAL
     ----------------------------------------------------------------------
     Fires on first paint if the URL carries a hash, and on every hashchange
     after that.  nav.js has already opened any folded ancestors and started
     the scroll; all this does is mark the target so alive.css can resolve a
     ring over it.

     The mark is an attribute rather than a class so it cannot collide with
     the several hundred classes already in play, and it is removed when the
     animation ends so a second visit to the same anchor plays again.  The
     timeout is a backstop for the case where the animation never starts
     (element removed, tab backgrounded before first frame): without it the
     attribute would stick and the second visit would be silent.
     ==================================================================== */
  var ARRIVE_MS = 1350;

  function announce(hash) {
    try {
      var id = String(hash || '').replace(/^#/, '');
      if (!id) return;

      var target = null;
      try { target = document.getElementById(id) || document.querySelector('#' + CSS.escape(id)); }
      catch (e) { target = document.getElementById(id); }
      if (!target) return;

      /* A <details> lights up as a whole block, which on a 3,000px topic is a
         ring around most of a screenful of nothing.  Mark its summary
         instead: that is the line the reader is actually looking at, and it
         is where the eye lands after the scroll. */
      if (target.tagName === 'DETAILS') {
        var sum = target.querySelector(':scope > summary');
        if (sum) target = sum;
      }

      var el = target;
      if (el.hasAttribute('data-sq-arrived')) return;   // already mid-flare

      /* animationend BUBBLES, and the things this site marks are full of
         descendants that animate: `growbar` on an h2's accent bar, `fadeUp` on
         every child of a revealed block, `qpulse`, the widget kit's own
         keyframes. Without this filter the very first descendant animation to
         finish -- often within one frame -- tore the mark off again and the
         arrival was invisible. Only this element's own sq-arrive* animations
         may end it. */
      function clear(e) {
        if (e && (e.target !== el ||
                  String(e.animationName || '').indexOf('sq-arrive') !== 0)) return;
        el.removeAttribute('data-sq-arrived');
        el.removeEventListener('animationend', clear);
      }
      el.addEventListener('animationend', clear);
      window.setTimeout(function () { clear(null); }, ARRIVE_MS + 400);
      el.setAttribute('data-sq-arrived', '');
    } catch (e) { /* an unannounced arrival is the old behaviour, not a fault */ }
  }

  try {
    if (location.hash) {
      /* nav.js scrolls on a double rAF (and again on load) when it had to
         open something.  Land after that so the flare starts once the target
         has stopped moving -- a cue that fires mid-scroll reads as a glitch. */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          window.setTimeout(function () { announce(location.hash); }, 120);
        });
      });
    }
    window.addEventListener('hashchange', function () { announce(location.hash); });

    /* A same-page anchor click does NOT fire hashchange when the hash is
       already current (click the same link twice), and this is a site where
       re-clicking the nav chip you are already parked on is a normal thing to
       do.  Catch the click as well; the guard inside announce() stops the two
       paths from double-firing. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || a.closest('nav')) return;              // nav links land via hashchange
      var href = a.getAttribute('href') || '';
      var hash = href.indexOf('#') === 0 ? href
               : (a.pathname === location.pathname && a.hash) ? a.hash : '';
      if (!hash || hash === '#') return;
      window.setTimeout(function () { announce(hash); }, 140);
    }, true);
  } catch (e) {}

  /* ======================================================================
     2. THE SECTION PERMALINK
     ----------------------------------------------------------------------
     One button per id'd heading.  Drawn SVG, not a "#" glyph.  Copies the
     absolute URL; falls back to putting it in the address bar when the
     clipboard is unavailable (insecure origin, denied permission, older
     browser) rather than failing silently.
     ==================================================================== */
  var LINK_SVG =
    '<svg class="sq-pl-link" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.1-3.1a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3"/>' +
      '<path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3.1 3.1a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3"/>' +
    '</svg>' +
    '<svg class="sq-pl-done" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>' +
    '</svg>';

  function permalinkURL(id) {
    return location.origin + location.pathname + location.search + '#' + id;
  }

  /* `host` is the heading itself, which alive.css has already made
     position:relative via .sq-anchored -- so the note lands under the heading
     it belongs to, not under whatever container happens to be positioned. */
  function note(host, words) {
    try {
      if (!host) return;
      var old = host.querySelector(':scope > .sq-pl-note');
      if (old) old.remove();
      var n = document.createElement('span');
      n.className = 'sq-pl-note';
      n.setAttribute('aria-live', 'polite');
      n.textContent = words;
      host.appendChild(n);
      window.setTimeout(function () { if (n.parentElement) n.remove(); }, 2000);
    } catch (e) {}
  }

  function buildPermalinks() {
    /* Headings only, and only ones that already carry an id -- this never
       invents an id, because an invented id is a permalink that breaks the
       first time the page is edited.  Skips the nav, the peripheral rails and
       anything inside a widget's own chrome. */
    var heads = [].slice.call(document.querySelectorAll('h2[id], h3[id]'))
      .filter(function (h) {
        return !h.closest('nav') && !h.closest('.sqrail') && !h.closest('.hud') &&
               !h.querySelector('.sq-permalink');
      });
    if (!heads.length) return;

    /* Read every label BEFORE appending anything.  innerText forces a layout,
       and appending inside the same loop would invalidate it again on every
       iteration -- twenty-four forced reflows on the curriculum pages for a
       string each.  Two passes, one layout.

       innerText rather than textContent because these headings routinely wrap
       a block-level span, and textContent welds the two runs into one word
       ("The courseTwenty-four topics"). innerText honours the break, which
       collapses here into a plain space.

       Deliberately NOT "take the first line": which line carries the title
       varies. On feasible.html #course the eyebrow is second ("The course" /
       "Twenty-four topics, each taught four ways") and on #game-theory it is
       first ("The flagship" / "Game theory: when the thing you're optimising
       against..."). Keeping the whole string is longer but is never wrong
       about what the heading says, and the label's job is only to tell forty
       buttons apart. */
    var labels = heads.map(function (h) {
      var t = h.innerText || h.textContent || '';
      return t.trim().replace(/\s+/g, ' ').slice(0, 70);
    });

    heads.forEach(function (h, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq-permalink';
      btn.innerHTML = LINK_SVG;
      /* The accessible name names the section, so a screen-reader user pulling
         up a list of buttons gets forty distinct labels rather than forty
         identical ones. */
      var label = labels[i];
      btn.setAttribute('aria-label', label ? 'Copy link to "' + label + '"' : 'Copy link to this section');
      btn.title = 'Copy link to this section';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var url = permalinkURL(h.id);

        function ok() {
          btn.setAttribute('data-copied', '');
          note(h, 'link copied');
          window.setTimeout(function () { btn.removeAttribute('data-copied'); }, 1900);
        }
        function fallback() {
          try {
            history.replaceState(null, '', '#' + h.id);
            note(h, 'link in the address bar');
          } catch (e2) { note(h, 'copy failed'); }
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(ok, fallback);
          } else { fallback(); }
        } catch (e3) { fallback(); }
      });

      h.classList.add('sq-anchored');
      h.appendChild(btn);
    });
  }

  /* ======================================================================
     3. THE UNFOLD
     ----------------------------------------------------------------------
     Height-animates <details> open and closed.  The recipe is the standard
     one -- intercept the summary click, animate an explicit height, then hand
     the element back to `height: auto` -- with four guards this site
     specifically needs:
     ==================================================================== */
  var FOLD_MIN = 180;    /* ms for a short fold */
  var FOLD_MAX = 420;    /* ms for a tall one   */
  /* px of new content beyond which the HEIGHT is not animated.  Not a
     performance superstition -- a height transition on a tall <details>
     relayouts everything below it once per frame, and on the curriculum pages
     that is 24 modules and a quarter of a megabyte of markup.  It is also the
     case where the animation buys least: the viewport is ~700px, so nobody can
     watch 3,000px unfold. Past the cap the fold still resolves, it just
     resolves in opacity, which costs no layout at all.  Measured against the
     real pages: the tallest feasible.html module is 2,311px and the tallest
     .foldsec on qec.html is well under 1,000px. */
  var FOLD_CAP = 2600;

  function foldable(d) {
    /* (a) The nav categories are absolutely-positioned popovers with their own
           coordinated open/close logic in nav.js.  Animating their height
           would fight it and would animate a box that is not in flow anyway.
       (b) The peripheral rails build and rebuild their own <details>.
       (c) A <details> whose content is taller than FOLD_CAP is left alone:
           animating 3,000px of height is a full-page relayout every frame,
           and the jump-cut is the lesser cost. */
    return !d.closest('nav') && !d.closest('.sqrail') && !d.classList.contains('navcat');
  }

  function contentHeight(d) {
    /* Sum of everything that is not the summary, measured while open. */
    var h = 0;
    [].slice.call(d.children).forEach(function (c) {
      if (c.tagName === 'SUMMARY') return;
      h += c.getBoundingClientRect().height +
           parseFloat(getComputedStyle(c).marginTop || 0) +
           parseFloat(getComputedStyle(c).marginBottom || 0);
    });
    return h;
  }

  function summaryHeight(d) {
    var s = d.querySelector(':scope > summary');
    return s ? s.getBoundingClientRect().height : 0;
  }

  function settle(d) {
    d.removeAttribute('data-sq-folding');
    d.style.removeProperty('height');
    d.style.removeProperty('--sq-fold-dur');
    d.__sqAnim = null;
  }

  function fold(d, opening) {
    var from = d.getBoundingClientRect().height;

    /* Measure the destination by putting the element in its target state for
       one synchronous read.  `content-visibility` and lazy images make a
       cached measurement wrong often enough that it is not worth caching. */
    var to;
    if (opening) {
      d.open = true;
      to = summaryHeight(d) + contentHeight(d);
    } else {
      to = summaryHeight(d);
    }

    var delta = Math.abs(to - from);

    if (delta < 8) {                              // nothing to reveal
      d.open = opening;
      settle(d);
      return;
    }

    /* Too tall to animate the height.  Open instantly, but resolve the content
       in -- opacity only, no layout, and the reader still gets told that
       something arrived rather than being cut to it.  Closing a tall one is
       instant either way: an exit nobody watches is just latency. */
    if (delta > FOLD_CAP) {
      d.open = opening;
      settle(d);
      if (opening) {
        d.setAttribute('data-sq-folding', 'fade');
        d.style.setProperty('--sq-fold-dur', '260ms');
        window.setTimeout(function () {
          if (d.getAttribute('data-sq-folding') === 'fade') settle(d);
        }, 320);
      }
      return;
    }

    var dur = Math.round(Math.min(FOLD_MAX, Math.max(FOLD_MIN, delta * 0.35)));
    if (!opening) dur = Math.round(dur * 0.72);   // exit faster than entrance

    d.style.setProperty('--sq-fold-dur', dur + 'ms');
    d.setAttribute('data-sq-folding', opening ? 'in' : 'out');
    d.style.height = from + 'px';
    d.__sqAnim = opening;

    /* Two frames: one for the browser to accept the starting height, one to
       change it.  A single rAF lands often enough to be a bug and rarely
       enough to be missed in testing. */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (d.__sqAnim !== opening) return;       // superseded by a newer click
        d.style.height = to + 'px';
      });
    });

    var done = function (e) {
      if (e && e.target !== d) return;            // a descendant's transition
      if (d.__sqAnim !== opening) return;
      d.removeEventListener('transitionend', done);
      d.open = opening;
      settle(d);
    };
    d.addEventListener('transitionend', done);
    /* Backstop: transitionend does not fire for a transition that never
       started (element hidden, tab backgrounded, height unchanged).  Without
       this the element keeps an inline height forever. */
    window.setTimeout(function () { if (d.__sqAnim === opening) done(null); }, dur + 90);
  }

  function bindFolds() {
    if (reduce) return;   // geometry is the one thing reduced motion removes

    document.addEventListener('click', function (e) {
      try {
        var s = e.target.closest && e.target.closest('summary');
        if (!s) return;
        var d = s.parentElement;
        if (!d || d.tagName !== 'DETAILS' || !foldable(d)) return;

        /* A click on a real control inside the summary (this site puts
           permalink buttons and chips in there) is that control's, not the
           fold's. */
        if (e.target !== s && e.target.closest('a, button, input, select, label')) return;

        e.preventDefault();
        fold(d, !d.open);
      } catch (err) {
        /* Never swallow the toggle: if anything above threw before
           preventDefault, the native behaviour has already run and we are
           done; if it threw after, force the state so the section still
           opens. */
        try {
          var s2 = e.target.closest && e.target.closest('summary');
          if (s2 && s2.parentElement && s2.parentElement.tagName === 'DETAILS') {
            var d2 = s2.parentElement;
            d2.open = !d2.open;
            settle(d2);
          }
        } catch (e2) {}
      }
    });

    /* Anything that opens a <details> programmatically -- nav.js's deep-link
       handler, the curriculum trackers, "open all" -- sets .open directly and
       never goes through the click path.  Those must not be animated (they
       often open twenty at once), but they can leave a stale inline height
       behind if they land mid-fold.  This clears up after them. */
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS') return;
      if (d.__sqAnim === undefined || d.__sqAnim === null) return;
      if (d.__sqAnim === d.open) return;
      d.__sqAnim = null;
      settle(d);
    }, true);
  }

  /* ======================================================================
     4. THE MISSING READBAR
     ----------------------------------------------------------------------
     tiers.js draws the 2px reading-progress bar, unconditionally, on every
     page that loads it -- which is 23 of the 24.  formalism.html is the one
     that does not load tiers.js, and it is also the second-longest page on
     the site (177KB, twenty topics).  Rather than pull a 14KB script onto one
     page for a 2px bar, mount the same component here, from the same class,
     when nothing else has: one progress bar, one visual language, and it
     self-heals if another page is ever added without tiers.js.
     ==================================================================== */
  function buildReadbar() {
    if (reduce) return;                              // tiers.js sits this out too
    if (document.querySelector('.readbar')) return;  // tiers.js already built one

    var bar = document.createElement('div');
    bar.className = 'readbar';
    bar.innerHTML = '<i></i>';
    var fill = bar.firstChild;
    document.body.appendChild(bar);

    var ticking = false;
    function draw() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 40 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      fill.style.width = (p * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(draw); }
    }, { passive: true });
    draw();
  }

  /* ---------------------------------------------------------------------- */

  /* --nav-h keeps html's scroll-padding-top honest.  style.css ships a static
     82px, correct for the one-row header at every width it is actually sticky
     at; this replaces it with the measured value so a header that wraps to two
     rows still parks its deep-link targets in the open.  Cheap, and the only
     reason it is JS at all is that the height is content-dependent. */
  function measureNav() {
    try {
      var nav = document.querySelector('nav:not(.rung-rail)');
      if (!nav) return;
      var h = Math.round(nav.getBoundingClientRect().height);
      if (h > 0 && h < 260) document.documentElement.style.setProperty('--nav-h', h + 'px');
    } catch (e) {}
  }

  function boot() {
    try { measureNav(); } catch (e) {}
    try { buildPermalinks(); } catch (e) {}
    try { bindFolds(); } catch (e) {}
    try { buildReadbar(); } catch (e) {}

    try {
      if ('ResizeObserver' in window) {
        var nav = document.querySelector('nav:not(.rung-rail)');
        if (nav) new ResizeObserver(measureNav).observe(nav);
      } else {
        window.addEventListener('resize', measureNav, { passive: true });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
