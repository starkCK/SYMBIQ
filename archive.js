/* SymbiQ, The Question archive, defined once and mounted anywhere.
 *
 *   SymbiQ.archive.mount(el, { limit, open })
 *
 * Used by archive.html (the full back catalogue) and by index.html, where it
 * sits collapsed inside The Question card.
 *
 * WHY IT IS ON THE HOMEPAGE: the archive existed from 2026-07-29 but was
 * reachable only from inside the Lattice overlay. A reader standing on the
 * homepage, noticing yesterday's question had gone, had no visible way back
 * to it, so as far as they were concerned the questions still vanished.
 * Reported by Chinmoy 2026-07-30. Discoverability is not a smaller problem
 * than storage; a thing you cannot find is a thing you do not have.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var TIER = { g: '🟢 Beginner', y: '🟡 Intermediate', r: '🔴 Expert' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderOne(q) {
    var Q = q.question, opts = Q.options || [];
    return '<p class="archq-full">' + esc(Q.text) + '</p>' +
      '<ol class="archq-opts">' + opts.map(function (o, i) {
        return '<li' + (i === Q.answerIndex ? ' class="right"' : '') + '>' + esc(o) +
               (i === Q.answerIndex ? ' <b>← the answer</b>' : '') + '</li>';
      }).join('') + '</ol>' +
      (Q.hint ? '<p class="archq-hint"><b>Hint given on the day:</b> ' + esc(Q.hint) + '</p>' : '') +
      ['g', 'y', 'r'].map(function (t) {
        var txt = Q.explain && Q.explain[t];
        return txt ? '<div class="archq-ex"><h4>' + TIER[t] + '</h4><p>' + esc(txt) + '</p></div>' : '';
      }).join('') +
      (q.signal ? '<p class="archq-signal"><b>The Signal that day:</b> ' + esc(q.signal) + '</p>' : '');
  }

  function mount(host, o) {
    if (!host) return;
    o = o || {};
    var base = o.base || '';
    host.innerHTML = '<p class="archq-loading">Loading previous questions…</p>';

    fetch(base + 'data/archive/index.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (idx) {
        var entries = (idx && idx.entries) || [];
        if (!entries.length) { host.innerHTML = '<p class="archq-loading">Nothing archived yet.</p>'; return; }
        entries.sort(function (a, b) { return b.qnum - a.qnum; });
        var shown = o.limit ? entries.slice(0, o.limit) : entries;

        host.innerHTML =
          (o.heading ? '<p class="archq-count">' + entries.length + ' question' +
            (entries.length === 1 ? '' : 's') + ' asked so far. Newest first, open any one for the answer ' +
            'and all three explanations.</p>' : '') +
          shown.map(function (e) {
            return '<details class="archq" data-date="' + esc(e.date) + '">' +
                     '<summary>' +
                       '<span class="archq-num">#' + esc(e.qnum) + '</span>' +
                       '<span class="archq-txt">' + esc(e.question) + '…</span>' +
                       '<span class="orbadge">' + esc(TIER[e.tier] || e.tier) + '</span>' +
                       '<span class="orbadge">' + esc(e.date) + '</span>' +
                     '</summary>' +
                     '<div class="archq-body"><p class="archq-loading">Opening…</p></div>' +
                   '</details>';
          }).join('') +
          (o.limit && entries.length > o.limit
            ? '<p class="archq-more"><a href="' + base + 'archive.html">See all ' + entries.length +
              ' questions in the full archive →</a></p>'
            : '');

        // fetch each full record the first time its row is opened
        host.addEventListener('toggle', function (ev) {
          var d = ev.target;
          if (d.tagName !== 'DETAILS' || !d.open || d.dataset.loaded) return;
          d.dataset.loaded = '1';
          var body = d.querySelector('.archq-body');
          fetch(base + 'data/archive/' + d.dataset.date + '.json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (q) { body.innerHTML = renderOne(q); })
            .catch(function (err) {
              body.innerHTML = '<p class="archq-loading">Could not load this one (' + esc(err.message) + ').</p>';
              d.dataset.loaded = '';
            });
        }, true);
      })
      .catch(function (err) {
        host.innerHTML = '<p class="archq-loading">The archive could not be loaded (' + esc(err.message) +
          '). It lives at <code>data/archive/index.json</code>.</p>';
      });
  }

  window.SymbiQ.archive = { mount: mount };
})();
