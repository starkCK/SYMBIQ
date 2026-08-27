/* SymbiQ — rails.js: the peripheral layer (added 2026-08-28).
 *
 * Companion to rails.css, which carries the full rationale. In short: the
 * reading column is capped at 1040px because prose wider than that stops
 * being readable, which on a 1920px monitor leaves 432px of empty
 * background on the left and 447px on the right, and past 2000px leaves
 * over 700px a side. This file puts orientation into that space.
 *
 * SAFETY, in the same shape as nav.js, rung.js, tiers.js and depth.js:
 *
 *   - Opt-in. A page whose body carries no data-rails gets nothing.
 *   - Gated. Nothing is built below 1440px, where there is no room for it,
 *     and the gate is the same matchMedia query rails.css uses, so the DOM
 *     and the styling can never disagree.
 *   - Additive. Every insertion is a sibling of .wrap, never inside it. The
 *     one thing this file changes about existing markup is adding an id to
 *     an h2 that has none, which nothing else on the site depends on.
 *   - Wrapped. Every module builds inside its own try/catch, so a single
 *     bad read cannot take the whole rail down with it, and the whole boot
 *     is wrapped again on top of that. A failure anywhere leaves the page
 *     exactly as it was before this file existed.
 *
 * WHAT IT DOES NOT DO, on purpose:
 *
 *   - No scroll reveals. nav.js has owned those site-wide since long before
 *     this file; a second reveal system overrides the first rather than
 *     complementing it. See motion.css section 3.
 *   - No new persistence. The progress module reads the two keys the
 *     homepage router already reads, and writes nothing at all.
 *   - No key map. The state module asks SymbiQ.qubit for its own summary
 *     after any keypress. It never learns, stores or reveals which keys
 *     matter, so the keyboard layer stays something you find rather than
 *     something you are told.
 */
(function () {
  'use strict';

  var D = document;
  var W = window;

  /* The same breakpoint rails.css gates on. Below it the reading column
     leaves under 200px a side, which is not enough for a legible rail. */
  var MQ = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  /* Where each page hands the reader on. One link, curated, not derived —
     the ladder order is not the reading order for every page, and guessing
     would produce confident nonsense on the pages that sit off the spine.
     A page missing from this map simply gets no "where next" module. */
  var NEXT = {
    'index.html':           ['journey.html',          'The story, end to end',      'Six acts, from the first qubit to the consequence'],
    'basics.html':          ['circuits.html',         'What a qubit is made of',    'The circuit underneath everything you just read'],
    'circuits.html':        ['quantum-mechanics.html','Mechanics vs computing',     'Same laws, a different question'],
    'quantum-mechanics.html':['qec.html',             'What keeps it alive',        'Error correction, and the door AI walked in through'],
    'qec.html':             ['logical-qubit.html',    'What a logical qubit is',    'Why a thousand physical qubits buy you one'],
    'logical-qubit.html':   ['phase-kickback.html',   'Why the algorithms work',    'One mechanism underneath four of them'],
    'phase-kickback.html':  ['ai.html',               'Will quantum boost AI?',     'Four routes, ranked honestly'],
    'ai.html':              ['bitcoin.html',          'Can it break Bitcoin?',      'The numbers, not the panic'],
    'bitcoin.html':         ['pqc.html',              'Check your own systems',     'Post-quantum exposure, on your estate'],
    'compare.html':         ['analog.html',           'The fork in the road',       'Coupled circuits instead of one'],
    'analog.html':          ['feasible.html',         'The Feasible Region',        'The field every optimisation headline is about'],
    'feasible.html':        ['play.html',             'Play it instead',            'Nine games where the maths does the judging'],
    'formalism.html':       ['play.html',             'Play it instead',            'Nine games where the maths does the judging'],
    'pqc.html':             ['race.html',             'Who is actually ahead',      'The race, without the press releases'],
    'play.html':            ['journey.html',          'The story, end to end',      'Six acts, from the first qubit to the consequence'],
    'journey.html':         ['play.html',             'The games themselves',       'Where the score cannot be faked'],
    'race.html':            ['frontier.html',         'The open frontier',          'What nobody has settled yet'],
    'frontier.html':        ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'ledger.html':          ['corrections.html',      'Corrections',                'What we got wrong, and when'],
    'corrections.html':     ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'signals.html':         ['archive.html',          'The archive',                'Everything asked and answered so far'],
    'archive.html':         ['signals.html',          'Signals',                    'What moved this week, and why it matters']
  };

  /* The ladder, identical to rung.js's own table. Duplicated rather than
     imported because rung.js exposes nothing and is a plain IIFE; two short
     literal tables are a smaller liability than a new global. If the ladder
     itself ever changes, both files change together. */
  var RUNGS = [
    { id: 'L0', label: 'the circuit',              href: 'circuits.html' },
    { id: 'L1', label: 'the qubit',                href: 'quantum-mechanics.html' },
    { id: 'L2', label: 'what makes it survive',    href: 'qec.html' },
    { id: 'L3', label: 'the algorithm',            href: 'phase-kickback.html' },
    { id: 'L4', label: 'the consequence',          href: 'pqc.html' }
  ];
  var FORK = { label: 'coupled circuits instead', href: 'analog.html' };

  var built = false;
  var left = null, right = null;
  var items = [], heads = [], spineFill = null, topBtn = null;
  var stateBox = null, stateShown = false;
  var ticking = false;

  function el(tag, cls, txt) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function page() {
    var p = location.pathname.split('/').pop();
    return p ? p : 'index.html';
  }

  function readJSON(k) {
    try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; }
  }

  /* ------------------------------------------------------------------ */
  /* Left column: on this page, plus the scroll spine and back-to-top    */
  /* ------------------------------------------------------------------ */

  /* What to print for a heading. Several h2s on this site are two things in
     one element -- formalism.html and feasible.html write the section name
     in a block-level span and let the standfirst follow it as bare text, so
     a plain textContent read returns "The Formal FrameworkFour topics, each
     taught four ways" with no space at the seam. innerText would split them
     correctly but also applies text-transform, and those spans are set in
     uppercase, so the rail would start shouting.

     So: if the heading opens with a block-level element and has more content
     after it, that element is the title and the rest is the standfirst. The
     full text is kept on the title attribute either way, so hovering still
     gives you the whole heading. */
  function labelFor(h) {
    var t = '';
    var first = h.firstElementChild;
    if (first && h.childNodes.length > 1) {
      var d = W.getComputedStyle(first).display;
      if (d === 'block' || d === 'flex' || d === 'grid') t = first.textContent;
    }
    if (!t) t = h.textContent;
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  function buildIndex(col) {
    /* Only headings the reader can actually reach. tiers.js hides whole
       depth tiers on some pages, and an index entry that scrolls to
       nothing is worse than no entry. getClientRects() is the cheap test
       that catches display:none, hidden ancestors and empty boxes alike. */
    var all = [].slice.call(D.querySelectorAll('h2')).filter(function (h) {
      if (h.closest('.sqrail, nav, footer')) return false;
      return h.getClientRects().length > 0;
    });
    /* Two entries is a list, not an index. Below that the module says less
       than the page already does. Returning false hands the left column to
       the ladder instead — see build(). journey.html, archive.html and
       signals.html all render their bodies from script and have no static
       section headings at all, so this is not a rare branch. */
    if (all.length < 3) return false;

    var wrapN = el('div', 'sqrail-mod');
    wrapN.appendChild(el('div', 'sqrail-lab', 'On this page'));

    var nav = el('nav', 'sqrail-idx');
    nav.setAttribute('aria-label', 'Sections on this page');

    all.forEach(function (h, i) {
      if (!h.id) h.id = 'sqs-' + i;
      var lab = labelFor(h);
      var full = (h.textContent || '').replace(/\s+/g, ' ').trim();
      var a = el('a', 'sqrail-item');
      a.href = '#' + h.id;
      /* The hover text carries the whole heading, with the seam the source
         markup leaves out put back -- otherwise it reads "The Formal
         FrameworkFour topics". */
      a.title = (full !== lab && full.indexOf(lab) === 0)
        ? lab + ' — ' + full.slice(lab.length).trim()
        : full;
      a.appendChild(el('span', 'sqrail-dot'));
      a.appendChild(el('span', 'sqrail-txt', lab));
      a.addEventListener('click', function (ev) {
        /* Own the scroll so the landing point clears the sticky header,
           which a bare fragment jump does not. Reduced motion gets the
           same landing point with no travel. */
        ev.preventDefault();
        var reduce = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var y = h.getBoundingClientRect().top + W.pageYOffset - 88;
        W.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
        if (history.replaceState) history.replaceState(null, '', '#' + h.id);
      });
      nav.appendChild(a);
      items.push(a);
      heads.push(h);
    });

    wrapN.appendChild(nav);
    col.appendChild(wrapN);
    return true;
  }

  function buildTop(col) {
    topBtn = el('button', 'sqrail-top', '↑ Top');
    topBtn.type = 'button';
    topBtn.addEventListener('click', function () {
      var reduce = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;
      W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    col.appendChild(topBtn);
  }

  /* ------------------------------------------------------------------ */
  /* Right column: the ladder, progress, where next, state              */
  /* ------------------------------------------------------------------ */

  /* Drawn on every rails page, not only the twelve that carry data-rung.
     On a rung page it says where you are; on the homepage, on play.html or
     on the ledger it is a standing map of the site's own spine — the
     argument the homepage makes in prose, kept in view while you read the
     rest of it. The horizontal pill is only ever hidden on the pages that
     actually have one, so nothing is lost either way. */
  function buildLadder(col) {
    var rung = D.body.getAttribute('data-rung');
    var isFork = (rung === 'FORK');
    var onLadder = !!rung;

    var mod = el('div', 'sqrail-mod');
    mod.appendChild(el('div', 'sqrail-lab', 'The Ladder'));

    var nav = el('nav', 'sqrail-ladder');
    nav.setAttribute('aria-label', onLadder
      ? "Where this page sits on SymbiQ's ladder, from the circuit to the consequence"
      : "SymbiQ's ladder, from the circuit to the consequence");

    RUNGS.forEach(function (r) {
      var cur = (!isFork && r.id === rung);
      var a = el('a', 'sqrail-rung' + (cur ? ' is-cur' : ''));
      a.href = r.href;
      if (cur) a.setAttribute('aria-current', 'page');
      var id = el('span', 'sqrail-id', r.id);
      id.setAttribute('aria-hidden', 'true');
      a.appendChild(id);
      a.appendChild(el('span', null, r.label));
      nav.appendChild(a);
    });

    var f = el('a', 'sqrail-fork' + (isFork ? ' is-cur' : ''), '⑂ ' + FORK.label);
    f.href = FORK.href;
    if (isFork) f.setAttribute('aria-current', 'page');
    nav.appendChild(f);

    mod.appendChild(nav);
    col.appendChild(mod);
    if (onLadder) D.documentElement.classList.add('sq-vrung');
  }

  function meter(href, label, done, total) {
    var a = el('a', 'sqrail-meter');
    a.href = href;
    var top = el('div', 'sqrail-mtop');
    top.appendChild(el('span', null, label));
    top.appendChild(el('span', 'sqrail-mnum', done + '/' + total));
    a.appendChild(top);
    var bar = el('div', 'sqrail-bar');
    var i = el('i');
    i.style.setProperty('--sq-p', total ? (done / total) : 0);
    bar.appendChild(i);
    a.appendChild(bar);
    return a;
  }

  function buildProgress(col) {
    /* Suppressed on the homepage: the three-door router at the top of that
       page already reports the same three numbers, and saying one fact
       twice on one screen is clutter, not reinforcement. */
    if (page() === 'index.html') return;

    /* Denominators verified 2026-08-28 by counting .mod[id] in each page's
       parsed document: formalism 20, feasible 24. The homepage router had
       been claiming 17 and 20 since those pages last grew, and was
       corrected in the same change that added this file. Six acts is the
       length of the mission list immediately below, so that one cannot
       drift. If either page gains topics, these two numbers move with it. */
    var ACTS = ['grover', 'golf', 'maxcut', 'volcano', 'chsh', 'knot'];
    var FORMALISM_TOPICS = 20;
    var FEASIBLE_TOPICS = 24;

    var sp = readJSON('symbiq.solverpath.v1') || {};
    var pq = readJSON('symbiq.pqc.v1') || {};
    var kv = sp.kv || {};
    var missions = sp.missions || {};

    var acts = 0;
    ACTS.forEach(function (m) { if (missions[m] && missions[m].complete) acts++; });
    var form = (kv['curriculum.formalism'] || []).length;
    var feas = (kv['curriculum.feasible'] || []).length;
    var pqcStarted = !!(pq && (pq.assets || pq.estate || pq.estateText || pq.cbomText));

    if (!acts && !form && !feas && !pqcStarted) return;   /* no empty meters */

    var mod = el('div', 'sqrail-mod');
    mod.appendChild(el('div', 'sqrail-lab', 'Your progress'));
    var box = el('div', 'sqrail-prog');
    if (acts) box.appendChild(meter('play.html', 'Acts cleared', acts, ACTS.length));
    if (form) box.appendChild(meter('formalism.html', 'The Machinery', form, FORMALISM_TOPICS));
    if (feas) box.appendChild(meter('feasible.html', 'Feasible Region', feas, FEASIBLE_TOPICS));
    if (pqcStarted) {
      var a = el('a', 'sqrail-meter');
      a.href = 'pqc.html';
      var t = el('div', 'sqrail-mtop');
      t.appendChild(el('span', null, 'Your estate'));
      t.appendChild(el('span', 'sqrail-mnum', 'saved'));
      a.appendChild(t);
      box.appendChild(a);
    }
    mod.appendChild(box);
    col.appendChild(mod);
  }

  function buildNext(col) {
    var n = NEXT[page()];
    if (!n) return;
    var mod = el('div', 'sqrail-mod');
    mod.appendChild(el('div', 'sqrail-lab', 'Where next'));
    var a = el('a', 'sqrail-next');
    a.href = n[0];
    a.appendChild(el('b', null, n[1] + ' →'));
    a.appendChild(el('span', null, n[2]));
    mod.appendChild(a);
    col.appendChild(mod);
  }

  /* The state module. It asks the qubit for its own summary after any
     keypress and reveals itself the first time that summary stops being
     the ground state. It does not know, and must never learn, which keys
     do anything — that is the whole reason the keyboard layer is worth
     finding. */
  function buildState(col) {
    if (!(W.SymbiQ && W.SymbiQ.qubit && W.SymbiQ.qubit.state)) return;

    stateBox = el('div', 'sqrail-state sqrail-mod');
    stateBox.hidden = true;
    col.appendChild(stateBox);

    function read() {
      try { return W.SymbiQ.qubit.state(); } catch (e) { return null; }
    }
    function paint() {
      var s = read();
      if (!s) return;
      var moved = (s.p1 > 0.0001) || (s.net && s.net !== 'I');
      if (!moved && !stateShown) return;
      if (!stateShown) {
        stateShown = true;
        stateBox.hidden = false;
        stateBox.appendChild(el('div', 'sqrail-lab', 'This page'));
      }
      var pct = Math.round(s.p1 * 100);
      var dl = stateBox.querySelector('dl');
      if (!dl) { dl = D.createElement('dl'); stateBox.appendChild(dl); }
      dl.innerHTML = '';
      function row(k, v, cls) {
        dl.appendChild(el('dt', null, k));
        dl.appendChild(el('dd', cls || null, v));
      }
      row('measured |1⟩', pct + '%');
      row('phase', Math.round(s.phase) + '°');
      row('net', s.net || 'I', 'sqrail-ket');
    }

    /* After the key, not on it: qubit.js handles the same event and this
       must read the state it leaves behind, not the one before it. */
    D.addEventListener('keydown', function () { setTimeout(paint, 0); });
    paint();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll: the spine fill, the scroll-spy, the top button              */
  /* ------------------------------------------------------------------ */

  function onScroll() {
    if (ticking) return;
    ticking = true;
    W.requestAnimationFrame(function () {
      ticking = false;
      try {
        var y = W.pageYOffset;
        var max = D.documentElement.scrollHeight - W.innerHeight;
        var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        if (spineFill) spineFill.style.setProperty('--sq-read', p);
        if (topBtn) topBtn.classList.toggle('is-on', y > W.innerHeight * 1.5);

        /* The current section is the last heading whose top has passed the
           sticky header. Everything before it is behind you. */
        var cur = -1;
        for (var i = 0; i < heads.length; i++) {
          if (heads[i].getBoundingClientRect().top <= 120) cur = i; else break;
        }
        for (var j = 0; j < items.length; j++) {
          items[j].classList.toggle('is-cur', j === cur);
          items[j].classList.toggle('is-done', j < cur);
          if (j === cur) items[j].setAttribute('aria-current', 'true');
          else items[j].removeAttribute('aria-current');
        }
      } catch (e) { /* a bad frame must not kill the listener */ }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Build and teardown                                                  */
  /* ------------------------------------------------------------------ */

  function build() {
    if (built) return;
    built = true;

    /* No aria-label on either gutter: a plain div has no role, so a label
       there is announced by nothing and only looks like accessibility work.
       The landmarks that matter are the two nav elements inside, and each
       carries its own label. */
    left = el('div', 'sqrail sqrail-l');
    var lc = el('div', 'sqrail-col');
    left.appendChild(lc);
    var spine = el('div', 'sqrail-spine');
    spine.setAttribute('aria-hidden', 'true');
    left.appendChild(spine);
    spineFill = spine;

    right = el('div', 'sqrail sqrail-r');
    var rc = el('div', 'sqrail-col');
    right.appendChild(rc);

    /* The left column answers "where am I", the right one "what is mine and
       what is next". Where a page has sections, "where am I" is the section
       index. Where it has none — the three pages that render their whole
       body from script — the honest answer is the wider one, so the ladder
       moves left rather than leaving that margin holding nothing but a
       hairline. Each module is wrapped on its own: a bad read in one must
       not take the other three down with it. */
    var haveIndex = false;
    try { haveIndex = buildIndex(lc) === true; } catch (e) { }
    try { buildLadder(haveIndex ? rc : lc); } catch (e) { }
    try { buildTop(lc); } catch (e) { }
    try { buildProgress(rc); } catch (e) { }
    try { buildNext(rc); } catch (e) { }
    try { buildState(rc); } catch (e) { }

    /* An empty column is furniture with nothing on it. Only attach the
       side that earned a place. The spine is measurement, not content, so
       it alone is enough reason to keep the left side. */
    if (lc.children.length) D.body.appendChild(left); else left = null;
    if (rc.children.length) D.body.appendChild(right); else right = null;

    W.addEventListener('scroll', onScroll, { passive: true });
    W.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  function destroy() {
    if (!built) return;
    built = false;
    W.removeEventListener('scroll', onScroll);
    W.removeEventListener('resize', onScroll);
    if (left && left.parentNode) left.parentNode.removeChild(left);
    if (right && right.parentNode) right.parentNode.removeChild(right);
    /* Give the horizontal rung pill back: below the gate it is the only
       copy of the ladder there is. */
    D.documentElement.classList.remove('sq-vrung');
    left = right = spineFill = topBtn = stateBox = null;
    items = []; heads = []; stateShown = false;
  }

  function sync() {
    if (MQ && MQ.matches) build(); else destroy();
  }

  /* Two independent triggers for the same check, on purpose. The
     matchMedia change event is the right one and fires once per crossing;
     the debounced resize is the belt to its braces, because a change event
     that never arrives (seen under an emulated viewport while testing this
     file) would otherwise strand the rails in whichever state they were
     last in. sync() is idempotent — build() returns early when built and
     destroy() returns early when not — so a duplicate trigger costs one
     boolean test. */
  var syncTimer = null;
  function syncSoon() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 150);
  }

  function boot() {
    try {
      if (!D.body || !D.body.hasAttribute('data-rails')) return;
      if (!MQ) return;
      sync();
      if (MQ.addEventListener) MQ.addEventListener('change', sync);
      else if (MQ.addListener) MQ.addListener(sync);
      W.addEventListener('resize', syncSoon, { passive: true });
    } catch (e) { /* additive only: a failure here leaves the page as it was */ }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
