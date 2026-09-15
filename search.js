/* SymbiQ, site-wide search. An overlay, not a page.
 *
 * The site runs to dozens of pages and teaches every concept in
 * data/concepts.json across three separate tracks, and until now the only way
 * to reach a specific idea was to already know which track it lived under. Depth nobody can reach is the same
 * as depth that is not there.
 *
 * Opens on "/" or Ctrl/Cmd-K anywhere, or from the Search item in the nav.
 * The index (data/search.json, ~150 KB) is fetched the FIRST time the overlay
 * opens and never on page load, so a reader who does not search pays nothing.
 *
 * Two record kinds, ranked differently on purpose:
 *   c  a concept -- knows the exact page, anchor and depth tier it is taught
 *      at. Ranked above sections: "what does decoherence mean" should land on
 *      the definition, not on a paragraph that happens to say the word.
 *   s  a section heading, with a snippet of the prose under it.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var TIER_LABEL = { g: 'plain', y: 'working', r: 'formal' };
  var idx = null;          // loaded index
  var loading = null;      // in-flight promise
  var box = null;          // overlay root
  var input = null, list = null, status = null;
  var results = [], cursor = -1, lastFocus = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Highlight every query token in a already-escaped string. Done after
     escaping so a page whose prose contains "<" cannot inject markup. */
  function mark(escaped, tokens) {
    if (!tokens.length) return escaped;
    var re = new RegExp('(' + tokens.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function base() {
    // every page sits at the site root, so relative hrefs just work
    return '';
  }

  function load() {
    if (idx) return Promise.resolve(idx);
    if (loading) return loading;
    loading = fetch(base() + 'data/search.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        idx = j;
        /* The placeholder used to name the page and concept counts as typed
           literals, and was wrong within an hour of being written. Same bug as
           corrections 4 and 5: a number in prose that nothing recomputes. It
           is now read off the index it describes. */
        if (input) {
          var nC = 0;
          j.records.forEach(function (r) { if (r.k === 'c') nC++; });
          input.placeholder = 'Search ' + j.pages + ' pages and ' + nC + ' concepts…';
        }
        // pre-lowercase once, not on every keystroke
        idx.records.forEach(function (r) {
          r._h = (r.h || '').toLowerCase();
          r._x = (r.x || '').toLowerCase();
          r._t = (r.t || '').toLowerCase();
          r._a = (r.alias || []).join(' ').toLowerCase();
        });
        return idx;
      })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function score(r, q, tokens) {
    var s = 0;
    if (r._h === q) s += 120;                       // exact heading / term
    else if (r._h.indexOf(q) === 0) s += 70;        // heading starts with it
    else if (r._h.indexOf(q) >= 0) s += 45;         // heading contains it
    if (r._a && r._a.indexOf(q) >= 0) s += 40;      // a concept alias matches
    if (r._x.indexOf(q) >= 0) s += 12;              // phrase in the snippet
    if (r._t.indexOf(q) >= 0) s += 8;               // phrase in the page title

    var hitAll = true;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var inH = r._h.indexOf(t) >= 0, inX = r._x.indexOf(t) >= 0,
          inT = r._t.indexOf(t) >= 0, inA = r._a.indexOf(t) >= 0;
      if (inH) s += 14;
      if (inA) s += 10;
      if (inX) s += 4;
      if (inT) s += 2;
      if (!(inH || inX || inT || inA)) hitAll = false;
    }
    if (!hitAll) return 0;                          // every token must appear
    return s + (r.w || 1) * 3;
  }

  function search(qRaw) {
    var q = qRaw.trim().toLowerCase();
    if (q.length < 2 || !idx) return [];
    var tokens = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < idx.records.length; i++) {
      var s = score(idx.records[i], q, tokens);
      if (s > 0) out.push([s, idx.records[i]]);
    }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, 30).map(function (p) { return p[1]; });
  }

  function render(tokens) {
    if (!results.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = results.map(function (r, i) {
      /* A concept gets a pill, because "this is a definition" is the useful
         thing to say about it. A section gets the page it lives on, as plain
         muted text -- page titles here are full sentences ("Is quantum
         computing just quantum mechanics?") and a sentence set in an
         uppercase pill is unreadable. */
      var chip = r.k === 'c'
        ? '<span class="sr-kind sr-concept">concept</span>'
          + (TIER_LABEL[r.tier] ? '<span class="sr-tier t-' + esc(r.tier) + '">'
             + TIER_LABEL[r.tier] + '</span>' : '')
        : '<span class="sr-page">' + esc(r.t) + '</span>';
      return '<li><a class="sr-hit" id="sr-' + i + '" href="' + esc(r.p) + '"'
        + (i === cursor ? ' aria-current="true"' : '') + ' role="option">'
        + '<span class="sr-head">' + mark(esc(r.h), tokens) + chip + '</span>'
        + (r.x ? '<span class="sr-snip">' + mark(esc(r.x), tokens) + '</span>' : '')
        + '</a></li>';
    }).join('');
  }

  function setStatus(msg) { status.textContent = msg; }

  function update() {
    var qRaw = input.value;
    var tokens = qRaw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    results = search(qRaw);
    cursor = results.length ? 0 : -1;
    render(tokens);
    if (qRaw.trim().length < 2) setStatus('Type at least two letters.');
    else if (!results.length) setStatus('Nothing matches “' + qRaw.trim() + '”.');
    else setStatus(results.length + (results.length === 30 ? '+ matches' : ' match'
         + (results.length === 1 ? '' : 'es')) + '. Arrow keys to move, Enter to open.');
  }

  function move(d) {
    if (!results.length) return;
    cursor = (cursor + d + results.length) % results.length;
    render(input.value.trim().toLowerCase().split(/\s+/).filter(Boolean));
    var el = document.getElementById('sr-' + cursor);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function build() {
    if (box) return;
    /* The host is a real, static, empty element on every page (apply_search.py
       puts it there), not one conjured on first open. Three separate checkers
       -- smoke.mjs, sweep.py and check_site.py -- independently flagged the
       lazy version as a dead #search anchor, and they were right: a link whose
       target does not exist until you click it is a broken link with a
       workaround, and it would have been broken for anyone with JS off. */
    box = document.getElementById('search');
    if (!box) {
      box = document.createElement('div');
      box.id = 'search';
      document.body.appendChild(box);
    }
    box.className = 'sr-wrap';
    box.hidden = true;
    box.innerHTML =
      '<div class="sr-scrim" data-sr-close></div>' +
      '<div class="sr-panel" role="dialog" aria-modal="true" aria-label="Search SymbiQ">' +
        '<div class="sr-top">' +
          '<input id="sr-input" type="search" autocomplete="off" spellcheck="false" ' +
            'placeholder="Search every page and concept…" aria-label="Search SymbiQ" ' +
            'role="combobox" aria-expanded="true" aria-controls="sr-list" aria-autocomplete="list">' +
          '<button type="button" class="sr-x" data-sr-close aria-label="Close search">Esc</button>' +
        '</div>' +
        '<p class="sr-status" id="sr-status" role="status" aria-live="polite"></p>' +
        '<ul class="sr-list" id="sr-list" role="listbox" aria-label="Search results"></ul>' +
        '<p class="sr-foot">Concepts jump straight to the depth they are taught at. ' +
          'Nothing here leaves your browser.</p>' +
      '</div>';
    document.body.appendChild(box);
    input = box.querySelector('#sr-input');
    list = box.querySelector('#sr-list');
    status = box.querySelector('#sr-status');

    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        var el = document.getElementById('sr-' + cursor);
        if (el) { e.preventDefault(); window.location.href = el.getAttribute('href'); }
      }
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-sr-close]')) { e.preventDefault(); close(); }
    });
  }

  function open(seed) {
    build();
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('sr-open');
    setStatus('Loading the index…');
    if (seed) input.value = seed;
    input.focus();
    input.select();
    load().then(function () { update(); }).catch(function (err) {
      setStatus('The search index could not be loaded (' + err.message +
                '). It lives at data/search.json.');
    });
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove('sr-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box && !box.hidden) { close(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); open(); return;
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          (t && t.isContentEditable)) return;
      e.preventDefault(); open();
    }
  });

  // any link to #search opens the overlay instead of jumping
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#search"]');
    if (a) { e.preventDefault(); open(); }
  });

  SymbiQ.search = { open: open, close: close };
})();
