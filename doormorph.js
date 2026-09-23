/* SymbiQ, doormorph.js
 * ============================================================================
 * CARD -> PAGE MORPH (2026-09-23), item 1 of the researched top-10. OUTGOING
 * half only -- index.html's three router doors. The INCOMING half (reading
 * the handoff and naming the destination's h1) lives in journey.html /
 * feasible.html / pqc.html's own <head>, not here, and not by choice: see
 * that inline script's own comment for why a deferred file can't do it.
 *
 * The site already runs a cross-document view transition on every navigation
 * (motion.css section 2): the brand and the h1 carry view-transition-name so
 * they glide rather than flash between any two of the 24 pages. This adds
 * ONE specific case on top of that generic continuity: when a reader clicks
 * one of the three router doors on the home page, the CARD THEY CLICKED
 * grows into the destination page's headline, instead of the headline doing
 * its usual generic fade-in.
 *
 * HOW. view-transition-name is normally a static CSS property, but the two
 * documents involved in one click are different pages that never share a
 * stylesheet moment -- so the name has to be assigned dynamically, once, for
 * this one navigation only, on both sides. On a plain click of a tracked
 * door, this file writes view-transition-name directly onto the clicked
 * card and drops a short-lived flag in sessionStorage naming which door was
 * used; the destination reads it back.
 *
 * SAFE BY CONSTRUCTION. Every entry point is try/catched; nothing here calls
 * preventDefault, so the door still navigates normally in a browser that
 * ignores all of this (Firefox, at the time of writing, has neither
 * cross-document view transitions nor `pagereveal`). The sessionStorage flag
 * carries its own timestamp and is only honoured for 4 seconds and only once
 * (read == cleared), so a click that never becomes a same-tab navigation (a
 * new-tab open, a cancelled press) cannot mis-tag some unrelated later visit
 * to one of the three destination pages.
 * ==========================================================================*/
(function () {
  'use strict';
  var D = document;

  function bindDoors() {
    var doors = [].slice.call(D.querySelectorAll('.introute-card[data-track]'));
    if (!doors.length) return;
    doors.forEach(function (card) {
      card.addEventListener('click', function (e) {
        /* A modified click opens a new tab (or does nothing) -- this
           document never unloads, so nothing here should run. */
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var track = card.getAttribute('data-track');
        if (!track) return;
        try { sessionStorage.setItem('sq-vt-door', track + ':' + Date.now()); } catch (er) {}
        try { card.style.viewTransitionName = 'sq-door-' + track; } catch (er2) {}
      });
    });
  }

  try { bindDoors(); } catch (e) {}
})();
