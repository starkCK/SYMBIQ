/* SymbiQ — dynamics.js
 * ============================================================================
 * Pairs with dynamics.css; gated on <body data-glass>.  Two pointer/scroll
 * feeds the CSS cannot get on its own:
 *
 *   1. SCROLLED   sets data-scrolled on <html> once the page passes ~40px,
 *                 so the frosted header can deepen its cast (dynamics.css §4)
 *   2. GLINT      writes --dyn-x / --dyn-y while the pointer is over the
 *                 header, so the glass catches a moving highlight (§2)
 *
 * SAFETY CONTRACT (same as nav.js / alive.js): pure enhancement.  Adds no
 * class that hides content, removes nothing, every feature is in its own
 * try/catch, and if this file 404s or throws on line one every page behaves
 * exactly as it did without it.  Load AFTER nav.js and atmosphere.js.
 * ==========================================================================*/
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-glass')) return;

  var reduce = false;
  try {
    reduce = !!(window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) { /* unreadable preference -> treat as no-preference */ }

  /* ======================================================================
     1. SCROLLED  — data-scrolled on <html>
     ----------------------------------------------------------------------
     rAF-coalesced: the scroll event only ever schedules one frame, and the
     attribute is written only when the boolean actually flips, so a fast
     scroll is a couple of attribute writes, not hundreds.  A 40px / 24px
     split gives it hysteresis so a scroll that hovers on the line does not
     strobe.
     ==================================================================== */
  try {
    var root = document.documentElement;
    var ticking = false;
    var on = false;

    var evaluate = function () {
      ticking = false;
      var y = window.pageYOffset || root.scrollTop || 0;
      if (!on && y > 40) { on = true; root.setAttribute('data-scrolled', ''); }
      else if (on && y < 24) { on = false; root.removeAttribute('data-scrolled'); }
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate(); // honour a mid-page reload
  } catch (e) { /* header just never gets the scrolled state */ }

  /* ======================================================================
     2. GLINT  — --dyn-x / --dyn-y over the header
     ----------------------------------------------------------------------
     Reduced motion opts out entirely (the highlight is movement).  The
     pointermove handler is rAF-coalesced like the scroll one.  Values are
     viewport percentages so the CSS radial can be positioned without the
     JS knowing the nav's box.  Cleared on leave so the glint fades to its
     resting off-screen position rather than freezing under the cursor's
     last spot.
     ==================================================================== */
  if (!reduce) try {
    var nav = document.querySelector('nav:not(.rung-rail)');
    if (nav) {
      var navTick = false;
      var mx = 50, my = -20;

      var paint = function () {
        navTick = false;
        nav.style.setProperty('--dyn-x', mx + '%');
        nav.style.setProperty('--dyn-y', my + '%');
      };

      nav.addEventListener('pointermove', function (ev) {
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        mx = (ev.clientX / w) * 100;
        my = (ev.clientY / h) * 100;
        if (navTick) return;
        navTick = true;
        window.requestAnimationFrame(paint);
      }, { passive: true });

      nav.addEventListener('pointerleave', function () {
        nav.style.removeProperty('--dyn-x');
        nav.style.removeProperty('--dyn-y');
      });
    }
  } catch (e) { /* no glint; the frost still stands on its own */ }

})();
