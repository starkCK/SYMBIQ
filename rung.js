/* SymbiQ — the rung rail (added 2026-08-23, item 07 of "The Ladder").
 *
 * Same safety rule as nav.js and tiers.js: pure progressive enhancement. A
 * page that carries no data-rung on <body> gets nothing inserted. A page
 * that does gets one small, persistent strip -- "where am I on the climb
 * from the circuit up to the consequence" -- right under its <h1>. If this
 * script fails to load, throws, or is served stale, the page is exactly
 * what it was before this file existed: nothing here is required for any
 * page to work, only for it to say where it sits.
 *
 * Rungs and their front-door pages match the spine's own thesis (see the
 * homepage's .spine paragraph and the Ladder proposal): L0 the circuit,
 * L1 the qubit, L2 what makes it survive, L3 the algorithm it's pointed
 * at, L4 the consequence. The fork (coupled circuits instead of one) is
 * drawn as a branch off the line, not a sixth rung on it.
 */
(function () {
  try {
    var body = document.body;
    var rung = body.getAttribute('data-rung');
    if (!rung) return;

    var RUNGS = [
      { id: 'L0', label: 'the circuit',     href: 'circuits.html' },
      { id: 'L1', label: 'the qubit',       href: 'quantum-mechanics.html' },
      { id: 'L2', label: 'what makes it survive', href: 'qec.html' },
      { id: 'L3', label: 'the algorithm',   href: 'phase-kickback.html' },
      { id: 'L4', label: 'the consequence', href: 'pqc.html' }
    ];
    var FORK = { label: 'the fork — coupled circuits instead', href: 'analog.html' };

    // Not scoped to ".wrap > h1": formalism.html and feasible.html wrap
    // their h1 in their own <header class="fr-mast">, one level deeper than
    // every other page's flat structure. One h1 per page either way.
    var h1 = document.querySelector('h1');
    if (!h1) return;
    // After the tagline, not straight after the h1 -- title and subtitle
    // read as one unit, and the rail is orientation for what comes next,
    // not part of the headline.
    var anchor = h1.nextElementSibling;
    if (!(anchor && anchor.classList && anchor.classList.contains('tagline'))) anchor = h1;
    var isFork = (rung === 'FORK');

    var nav = document.createElement('nav');
    nav.className = 'rung-rail';
    nav.setAttribute('aria-label', "Where this page sits on SymbiQ's ladder, from the circuit to the consequence");

    var html = '<span class="rung-rail-lab">The Ladder</span><span class="rung-rail-track">';
    RUNGS.forEach(function (r, i) {
      var cur = (!isFork && r.id === rung);
      html += '<a href="' + r.href + '" class="rung-dot' + (cur ? ' is-cur' : '') + '" title="' +
              r.id + ' — ' + r.label + '"' + (cur ? ' aria-current="page"' : '') + '>' +
              '<span aria-hidden="true">' + r.id + '</span><span class="rung-sr">' + r.label + '</span></a>';
      if (i < RUNGS.length - 1) html += '<span class="rung-seg" aria-hidden="true"></span>';
    });
    html += '</span>';
    html += '<a href="' + FORK.href + '" class="rung-fork' + (isFork ? ' is-cur' : '') +
            '"' + (isFork ? ' aria-current="page"' : '') + '>⑂ ' + FORK.label + '</a>';
    nav.innerHTML = html;

    anchor.parentNode.insertBefore(nav, anchor.nextSibling);
  } catch (e) { /* additive only -- a failure here must never hide or break the page */ }
})();
