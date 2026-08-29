/* SymbiQ — hud.js: make progress visible.
 *
 * Two surfaces, one file:
 *   1. THE CHIP  — a small persistent readout in the nav, on every page.
 *   2. THE RETURN CARD — on the homepage only (<body data-hud-return>), the
 *      hero gains one personal line for a visitor who has been here before.
 *
 * WHY
 * ---
 * The Solver's Path records everything and shows almost none of it. Coherence
 * moves, missions complete, codex fragments unlock -- and then you navigate to
 * any of the other twenty-two pages and the site behaves as though it has never
 * met you. Invisible progress is not progress; it is a diary nobody reads.
 *
 * THE HONEST-NUMBERS RULE
 * -----------------------
 * This shows only quantities the site actually computes today: coherence,
 * missions cleared, codex fragments. It deliberately does NOT show a streak, a
 * Fidelity score or a rank. Those are real, but they belong to the Discord
 * economy (an operator-run ledger, and the Discord has not launched); there is
 * no such number in this browser to display, and inventing one would be the
 * first fake number on a site whose entire argument is that it has none.
 *
 * SAFETY RULES, the same three every injected script here follows (nav.js,
 * tiers.js, rung.js):
 *   1. PURE PROGRESSIVE ENHANCEMENT. Everything is wrapped. If this file
 *      throws, fails to load, or is served stale, every page is exactly what
 *      it was before it existed. It only ever ADDS a node; it never hides,
 *      moves or rewrites page content.
 *   2. IT DOES NOT REQUIRE save.js. save.js loads on five pages and
 *      coherence.js on two, but the chip has to be right on all twenty-four,
 *      so this reads the same localStorage key directly and merely PREFERS the
 *      real API when it happens to be present. One store, one truth.
 *   3. NOTHING FOR A STRANGER. A first-time visitor has no progress, so no
 *      chip and no return card are rendered at all -- an empty scoreboard is
 *      clutter, not an invitation.
 *
 * API: window.SymbiQ.hud.refresh()   (mostly for the console; it self-updates)
 */
(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};

  var STORE = 'symbiq.solverpath.v1';   // save.js's key -- keep in step with it
  var COH_KEY = 'coherence.v1';         // coherence.js's kv slot
  var COH_BASE = 55;                    // coherence.js's BASE
  var CKEY = 'symbiq_contract_v1';      // games.js FRAME.contract's own key

  /* The six missions in campaign order.
     SOURCE OF TRUTH is missions.js's own M table. This is a deliberate copy:
     missions.js is ~1,800 lines and loads on two pages, while the chip has to
     name "Act IV — The Volcano" on all twenty-four. Copying six rows beats
     shipping the whole campaign engine site-wide to read six strings from it.
     tools/sweep.py asserts this table still agrees with missions.js, so the
     copy cannot drift quietly -- which is the only thing wrong with a copy. */
  var ACTS = [
    { id: 'golf',    act: 'Act I',   place: 'The Quantum Realm' },
    { id: 'grover',  act: 'Act II',  place: 'The Locked Corridor' },
    { id: 'maxcut',  act: 'Act III', place: 'Graph City' },
    { id: 'volcano', act: 'Act IV',  place: 'The Volcano' },
    { id: 'chsh',    act: 'Act V',   place: 'The Shore of Twins' },
    { id: 'knot',    act: 'Act VI',  place: 'The Knot' }
  ];

  /* ------------------------------------------------------------------ read */
  function progress() {
    var d = {};
    var S = window.SymbiQ.save;
    if (S && typeof S.data === 'function') {
      try { d = S.data() || {}; } catch (e) { d = {}; }
    } else {
      try { d = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { d = {}; }
    }

    var missions = d.missions || {}, kv = d.kv || {};
    var done = 0, next = null;
    for (var i = 0; i < ACTS.length; i++) {
      if (missions[ACTS[i].id] && missions[ACTS[i].id].complete) done++;
      else if (!next) next = ACTS[i];
    }

    var raw = kv[COH_KEY];
    var coh = (raw === undefined || raw === null || isNaN(raw))
      ? COH_BASE : Math.max(0, Math.min(100, Math.round(raw)));

    var codex = 0;
    try { codex = Object.keys(d.codex || {}).length; } catch (e) {}

    return {
      done: done,
      total: ACTS.length,
      next: next,                       // null once the campaign is finished
      codex: codex,
      coh: coh,
      // "Has this browser ever done anything here?" Coherence only counts once
      // it has actually MOVED -- the 55 everyone starts at is not progress.
      seen: done > 0 || codex > 0 || !!d.avatar || raw !== undefined
    };
  }

  // Mirrors coherence.js's own thresholds so the colours agree across surfaces.
  function level(v) { return v < 15 ? 'static' : v < 40 ? 'low' : v < 75 ? 'mid' : 'high'; }

  /* The Contract of the Day's streak lives in its OWN localStorage key, written
     by games.js FRAME.contract on play.html (and any page that mounts a game).
     Read it directly -- same rule as everything else here: games.js is on five
     pages, this line has to be right on the homepage whether or not it loaded.
     The streak IS a real number in this browser (unlike the Discord Fidelity /
     rank), so the honest-numbers rule permits it. */
  function contractInfo() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { c = {}; }
    var last = c.lastDate || null, streak = c.streak || 0;
    var today = new Date().toISOString().slice(0, 10);
    var gap = last
      ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(last + 'T00:00:00Z')) / 86400000)
      : null;
    var hist = (c.history && c.history[today]) || null;
    return {
      streak: streak,
      doneToday: !!(hist && hist.done) || gap === 0,
      gap: gap,                          // null never | 0 today | 1 yesterday | ...
      lapsed: gap !== null && gap >= 3,  // past the 1-miss grace -- the streak is spent
      active: streak > 0 || !!last       // has this browser ever taken a Contract?
    };
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------- the chip */
  function chipHTML(p, ci) {
    var where = p.next
      ? p.next.act + ' awaits — ' + p.next.place
      : 'The Path is complete';
    var title = 'Coherence ' + p.coh + '% · ' + p.done + ' of ' + p.total +
                ' missions cleared · ' + p.codex + ' codex fragment' +
                (p.codex === 1 ? '' : 's') + '. ' + where + '.';
    // one extra clause when a Contract streak is live -- tooltip / SR only
    if (ci && ci.streak > 0 && !ci.lapsed) {
      title += ' 🔥 ' + ci.streak + '-day Contract streak' +
               (ci.doneToday ? ' (today cleared).' : ' — today still open.');
    }
    /* Forty pixels, round, exactly like the account avatar beside it -- and not
       one pixel more. MEASURED: the nav's first row has room for 40-49px and
       nothing else (a 50px control wraps it to a second row, adding 58px of
       header to all 24 pages, on every page, forever). So the chip is a dial,
       not a pill.

       Each number gets the encoding it deserves: coherence is a percentage, so
       it is the ring; missions cleared is a count, so it is the numeral. The
       full sentence lives in the tooltip and in the screen-reader span. */
    return '<a class="hud-chip" href="journey.html" title="' + esc(title) + '"' +
             ' style="--hud-p:' + p.coh + '%" data-level="' + level(p.coh) + '">' +
             '<b class="hud-num" aria-hidden="true">' + p.done + '/' + p.total + '</b>' +
             '<span class="hud-sr">' + esc(title) + '</span>' +
           '</a>';
  }

  function mountChip(p, ci) {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var host = nav.querySelector('.hud-slot');

    if (!p.seen) {                       // a stranger: leave the nav untouched
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    if (!host) {
      host = document.createElement('span');
      host.className = 'hud-slot';
      // Before the account control if there is one, so the reading order is
      // "where you are" then "who you are"; otherwise at the end of the nav.
      var account = nav.querySelector('.sq-account');
      if (account) nav.insertBefore(host, account);
      else nav.appendChild(host);
    }
    host.innerHTML = chipHTML(p, ci);
  }

  /* ------------------------------------------------------ the return card */
  function mountReturn(p) {
    if (!document.body.hasAttribute('data-hud-return')) return;
    var old = document.querySelector('.hud-return');

    if (!p.seen) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }

    // After the tagline, before the call to action: the hero still argues the
    // same thing to a stranger, and gains one line for someone coming back.
    var tagline = document.querySelector('h1 + .tagline') || document.querySelector('.tagline');
    if (!tagline) return;

    /* Two facts and a door, deliberately. Coherence is NOT repeated here: the
       chip in the nav is showing it four inches above, and the card's job is
       orientation ("where was I, what is next"), not a second dashboard. The
       third stat also pushed the line just past the hero's width at common
       progress states, wrapping a one-line greeting onto two. */
    var bits = [];
    bits.push('<b>' + p.done + ' of ' + p.total + '</b> missions cleared');
    if (p.next) bits.push('<b>' + esc(p.next.act) + '</b> awaits in ' + esc(p.next.place));
    else bits.push('the Path is <b>complete</b>');

    var card = old || document.createElement('p');
    card.className = 'hud-return';
    card.innerHTML = '<span class="hud-return-lab">Welcome back.</span> ' +
                     bits.join(' <span class="hud-dot">·</span> ') +
                     ' <a class="hud-return-go" href="' + (p.next ? 'journey.html' : 'play.html') + '">' +
                     // "the Path is complete ... Resume the Path" argues with itself.
                     (p.next ? 'Resume the Path' : 'Into the Arcade') + ' &#9656;</a>';
    if (!old) tagline.parentNode.insertBefore(card, tagline.nextSibling);
  }

  /* -------------------------------------------------- the contract line */
  /* Homepage only, a sibling of the return card. The return card is "where was
     I on the Path"; this is "today's cross-arcade Contract and the streak
     riding on it". It is INDEPENDENT of Path progress -- a visitor who only
     ever plays Contracts in the Arcade still gets this line -- so it is gated
     on contractInfo().active, not progress().seen. Nothing for someone who has
     never taken one. The full challenge text + Play button live on play.html;
     this is the nudge that points there. */
  function mountContract(ci) {
    if (!document.body.hasAttribute('data-hud-return')) return;   // = the homepage hero
    var old = document.querySelector('.hud-contract');

    if (!ci.active) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }

    var anchor = document.querySelector('.hud-return') ||
                 document.querySelector('h1 + .tagline') || document.querySelector('.tagline');
    if (!anchor) return;

    var body;
    if (ci.doneToday) {
      body = '<span class="hud-c-ok">✓</span> today’s Contract cleared' +
             (ci.streak > 1 ? ' <span class="hud-dot">·</span> 🔥 <b>' + ci.streak + '</b>-day streak' : '');
    } else if (ci.lapsed) {
      body = 'today’s Contract is live <span class="hud-dot">·</span> your <b>' + ci.streak +
             '</b>-day streak lapsed — start a new one';
    } else {
      body = 'today’s Contract is live' +
             (ci.streak > 0
               ? ' <span class="hud-dot">·</span> 🔥 <b>' + ci.streak + '</b>-day streak on the line'
               : '');
    }
    var go = ci.doneToday ? 'Open the Arcade' : 'Take it';

    var card = old || document.createElement('p');
    card.className = 'hud-contract';
    card.innerHTML = '<span class="hud-c-lab">Contract of the Day</span> ' + body +
                     ' <a class="hud-return-go" href="play.html">' + go + ' &#9656;</a>';
    if (!old) anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }

  /* ------------------------------------------------------------ lifecycle */
  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    // Coalesce: completeMission() fires onchange, and so does the coherence
    // restore that usually follows it one line later.
    // Called through window, not bare -- an unbound requestAnimationFrame
    // throws "Illegal invocation".
    var soon = window.requestAnimationFrame
      ? function (fn) { window.requestAnimationFrame(fn); }
      : function (fn) { window.setTimeout(fn, 16); };
    soon(function () {
      pending = false;
      try {
        var p = progress();
        var ci = contractInfo();
        mountChip(p, ci);
        mountReturn(p);
        mountContract(ci);
      } catch (e) { /* additive only -- never break the page */ }
    });
  }

  function start() {
    render();

    /* save.js exposes ONE onchange slot rather than a listener list, so chain
       it instead of claiming it -- whatever was already there keeps working.
       hud.js is loaded last among the deferred scripts precisely so that the
       thing it chains is already in place. */
    try {
      var S = window.SymbiQ.save;
      if (S && !S._hudChained) {
        var prev = S.onchange;
        S.onchange = function () {
          if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) {} }
          render();
        };
        S._hudChained = true;
      }
    } catch (e) {}

    // Backstops: another tab making progress, and coming back to a bfcached page.
    try {
      window.addEventListener('storage', function (e) {
        if (!e || e.key === null || e.key === STORE || e.key === CKEY) render();
      });
      window.addEventListener('pageshow', render);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) render();
      });
    } catch (e) {}
  }

  window.SymbiQ.hud = { refresh: render, progress: progress, contract: contractInfo, acts: ACTS };

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  } catch (e) { /* additive only */ }
})();
