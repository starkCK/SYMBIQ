/* SymbiQ, throughline.js — one figure that transforms as you read.
 * ============================================================================
 * PART B1 of outputs/22_SIGNATURE_UX_AND_GAME_LADDER.md. A fixed companion
 * panel, its state driven by which `[data-fig-state]` section is currently in
 * view (IntersectionObserver on a thin band near viewport centre — a
 * standard scrollspy technique). qec.html marks five: the problem, the
 * machine, where the line is, below threshold, the formalism.
 *
 * NOT the page's own referee-verified surface-17 widget, and never claims to
 * be: this is a stylised 3x3 companion, oriented by the same colour
 * vocabulary (.pq/.lit/.dq.flip/.fixring's palette) so it reads as the same
 * object, not a second diagram with its own claims. Every number this site
 * asserts still lives in the interactive widget and the prose beside it.
 *
 * SAFETY CONTRACT — same as every other opt-in layer here. If
 * IntersectionObserver is unsupported, or no [data-fig-state] elements exist
 * on the page, this quietly does nothing. Dismissing the panel (the × ) is
 * remembered for this tab only (sessionStorage) — a decorative companion is
 * not worth nagging a returning reader about.
 * ============================================================================
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (!D.body || !D.body.hasAttribute('data-throughline')) return;
  if (!('IntersectionObserver' in W)) return;

  var sections = Array.prototype.slice.call(D.querySelectorAll('[data-fig-state]'));
  if (!sections.length) return;

  var DKEY = 'symbiq.tl.dismissed';
  var dismissed = false;
  try { dismissed = sessionStorage.getItem(DKEY) === '1'; } catch (e) {}
  if (dismissed) return;

  var CAPTIONS = {
    1: 'One physical qubit. It fails, and there is nothing to compare it to.',
    2: 'Spread across a patch. Now something can be checked against something else.',
    3: 'A flip lights its neighbours. The dashed ring is the decoder’s repair — not always right.',
    4: 'Below threshold, the same patch simply stops failing.',
    5: 'The same patch, in the notation the formal section uses.'
  };

  var NS = 'http://www.w3.org/2000/svg';
  function el(t, a) { var n = D.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }

  var panel = D.createElement('div');
  panel.className = 'tl-panel';
  panel.innerHTML =
    '<div class="tl-head"><span class="tl-eyebrow">Following along</span>' +
    '<button type="button" class="tl-close" aria-label="Dismiss">×</button></div>' +
    '<svg class="tl-svg" viewBox="0 0 120 120" xmlns="' + NS + '" aria-hidden="true"></svg>' +
    '<p class="tl-cap" data-r="cap"></p>';
  /* Placed IN THE FLOW, immediately after the page's h1, rather than appended
     to <body>. On desktop the panel is position:fixed, so its DOM position is
     irrelevant and the corner card is unchanged (.wrap carries no transform,
     filter or contain, so it does not become a containing block). On mobile it
     is position:sticky instead, and being in the flow is the whole point: the
     band starts under the title, scrolls up with the page, and pins to the top
     -- "a sticky band above the fold", which is what 22_ Part B1 asked for.
     Below 720px this site's header is NOT sticky (see style.css's --nav-h
     note), so top:0 is the honest pin and nothing is ever covered. */
  /* After the tagline where there is one, so the band never lands inside the
     page's title block; after the h1 otherwise. receipts.js also inserts after
     the h1, so anchoring lower keeps the two out of each other's way whichever
     script happens to run first. */
  var anchor = D.querySelector('.wrap h1 + .tagline') || D.querySelector('.wrap .tagline') || D.querySelector('.wrap h1');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else D.body.appendChild(panel);

  var svg = panel.querySelector('.tl-svg');
  var cap = panel.querySelector('[data-r="cap"]');
  panel.querySelector('.tl-close').addEventListener('click', function () {
    panel.classList.remove('on');
    try { sessionStorage.setItem(DKEY, '1'); } catch (e) {}
  });

  // ---- draw the 3x3 patch once; state-setting only toggles attributes ----
  var GX = [20, 55, 90], GY = [20, 55, 90];
  var cells = [], checks = [], fix = null, labels = [];
  GY.forEach(function (y, ry) {
    GX.forEach(function (x, rx) {
      cells.push(el('rect', { 'class': 'tl-cell', x: x - 14, y: y - 14, width: 28, height: 28, rx: 5 }));
    });
  });
  // four checks sit between the four inner edges of the 3x3 grid
  [[37, 20], [90, 37], [37, 90], [20, 55]].forEach(function (p) {
    checks.push(el('circle', { 'class': 'tl-check', cx: p[0], cy: p[1], r: 7 }));
  });
  fix = el('circle', { 'class': 'tl-fix', cx: 55, cy: 55, r: 22 });
  var lZ = el('text', { 'class': 'tl-label', x: 6, y: 24 }); lZ.textContent = 'Z̄';
  var lX = el('text', { 'class': 'tl-label', x: 96, y: 24 }); lX.textContent = 'X̄';
  labels = [lZ, lX];
  cells.forEach(function (c) { svg.appendChild(c); });
  checks.forEach(function (c) { svg.appendChild(c); });
  svg.appendChild(fix);
  labels.forEach(function (l) { svg.appendChild(l); });

  var CENTER = 4;   // index of the middle cell in a row-major 3x3
  var FLIPPED = 1;  // top-middle, a different cell than centre -- see the doc's own "not the same cell twice" note

  function setVisible(n, v) { n.style.opacity = v ? '1' : '0'; }

  function apply(n) {
    cells.forEach(function (c, i) {
      if (n === 1) { setVisible(c, i === CENTER); c.classList.toggle('flip', i === CENTER); }
      else { setVisible(c, true); c.classList.toggle('flip', n === 3 && i === FLIPPED); }
    });
    checks.forEach(function (c, i) {
      setVisible(c, n >= 2);
      c.classList.toggle('lit', n === 3 && (i === 0 || i === 3));   // the two checks touching the flipped cell
    });
    setVisible(fix, n === 3);
    labels.forEach(function (l) { setVisible(l, n === 5); });
    cap.textContent = CAPTIONS[n] || '';
    panel.classList.add('on');
  }

  apply(1);   // visible from the top of the page, in its starting state

  var current = 1;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var n = +e.target.getAttribute('data-fig-state');
      if (n && n !== current) { current = n; apply(n); }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(function (s) { io.observe(s); });
})();
