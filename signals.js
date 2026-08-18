/* SymbiQ — The Signal: the news feed, defined once and mounted on signals.html.
 *
 *   SymbiQ.signals.mount(el, { limit, base })
 *
 * Same shape as archive.js on purpose: a lightweight index.json lists every
 * published Signal (headline, dek, date, tier, source), and the full record
 * -- body, the concept-card, uncertain-claims already resolved by the human
 * who approved it -- is fetched lazily the first time a reader opens one.
 * That keeps the list fast even after a year of daily stories, and matches
 * the archive's proven pattern of "index is cheap, detail is fetched once".
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var TIER_ICON = { Proven: '🟢', Heuristic: '🟡', Inspired: '🟣' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function tierBadge(tier) {
    var icon = TIER_ICON[tier] || '';
    return '<span class="orbadge">' + icon + ' ⟦' + esc(tier) + '⟧</span>';
  }

  function renderOne(a) {
    var src = a.source || {};
    return '<div class="sig-body">' + a.body_html + '</div>' +
      (a.concept_card_html || '') +
      '<p class="sig-source">Source: ' +
      (src.link ? '<a href="' + esc(src.link) + '" rel="noopener noreferrer">' : '') +
      esc(src.name || '') + (src.title ? ' — ' + esc(src.title) : '') +
      (src.link ? '</a>' : '') + '</p>';
  }

  function mount(host, o) {
    if (!host) return;
    o = o || {};
    var base = o.base || '';
    host.innerHTML = '<p class="archq-loading">Loading Signals…</p>';

    fetch(base + 'data/signals/index.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (idx) {
        var entries = (idx && idx.entries) || [];
        if (!entries.length) {
          host.innerHTML = '<p class="archq-loading">No Signals published yet. The pipeline drafts one a '
            + 'day when there is a story worth writing about, but nothing goes out until a human replies '
            + '<code>post</code> — check back soon.</p>';
          return;
        }
        // Appended oldest-first as they publish; show newest first.
        var ordered = entries.slice().reverse();
        var shown = o.limit ? ordered.slice(0, o.limit) : ordered;

        host.innerHTML =
          (o.heading ? '<p class="archq-count">' + entries.length + ' Signal'
            + (entries.length === 1 ? '' : 's') + ' published so far. Newest first — every one names its '
            + 'source and says what it does NOT mean.</p>' : '') +
          shown.map(function (e) {
            return '<details class="archq" data-slug="' + esc(e.slug) + '">' +
                     '<summary>' +
                       '<span class="archq-txt">' + esc(e.headline) + '<br>'
                       + '<span class="sig-dek">' + esc(e.dek) + '</span></span>' +
                       tierBadge(e.evidence_tier) +
                       '<span class="orbadge">' + esc(e.date) + '</span>' +
                     '</summary>' +
                     '<div class="archq-body"><p class="archq-loading">Opening…</p></div>' +
                   '</details>';
          }).join('') +
          (o.limit && entries.length > o.limit
            ? '<p class="archq-more"><a href="' + base + 'signals.html">See all ' + entries.length
              + ' Signals →</a></p>'
            : '');

        host.addEventListener('toggle', function (ev) {
          var d = ev.target;
          if (d.tagName !== 'DETAILS' || !d.open || d.dataset.loaded) return;
          d.dataset.loaded = '1';
          var body = d.querySelector('.archq-body');
          fetch(base + 'data/signals/' + d.dataset.slug + '.json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (a) { body.innerHTML = renderOne(a); })
            .catch(function (err) {
              body.innerHTML = '<p class="archq-loading">Could not load this one (' + esc(err.message) + ').</p>';
              d.dataset.loaded = '';
            });
        }, true);

        // Per-article permalink: signals.html#<slug>. This is what the social
        // posts link to -- without it there is no addressable URL for a single
        // Signal, only the whole feed. Opening it fires the toggle listener
        // above, which lazy-loads the same way a manual click would.
        var wanted = decodeURIComponent((location.hash || '').replace(/^#/, ''));
        if (wanted) {
          var all = [].slice.call(host.querySelectorAll('details'));
          var target = all.filter(function (d) { return d.dataset.slug === wanted; })[0];
          if (target) {
            target.open = true;
            target.scrollIntoView({ block: 'start' });
          }
        }
      })
      .catch(function (err) {
        host.innerHTML = '<p class="archq-loading">The Signal feed could not be loaded (' + esc(err.message) +
          '). It lives at <code>data/signals/index.json</code>.</p>';
      });
  }

  window.SymbiQ.signals = { mount: mount };
})();
