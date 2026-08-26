/* SymbiQ — The Ledger: the claim tracker, defined once and mounted on
 * ledger.html.
 *
 *   SymbiQ.ledger.mount(el, { base })
 *
 * Same shape as archive.js/signals.js on purpose: a lightweight index.json
 * lists every tracked claim, and the full record -- verbatim quote, frozen
 * criteria, resolver sources, the check-in timeline -- is fetched lazily the
 * first time a reader opens one. claimants.json and scorecards.json are
 * small enough to fetch eagerly alongside the index.
 *
 * scorecards.json is GENERATED (tools/gen_claim_scorecards.py) -- this file
 * only ever reads it, never computes reputation client-side.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var STATUS_LABEL = {
    draft: 'Draft', tracking: 'Tracking', resolvable: 'Awaiting resolution',
    proposed: 'Proposed', resolved: 'Resolved', void: 'Void', superseded: 'Superseded',
  };
  var VERDICT_LABEL = {
    verified: 'Verified', partially_verified: 'Partially verified', not_verified: 'Not verified',
    unfalsifiable: 'Unfalsifiable', overtaken: 'Overtaken',
  };
  var DOMAIN_LABEL = { quantum: 'Quantum', ai: 'AI', or: 'Optimisation', crypto: 'Crypto / PQC' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(s) {
    if (!s) return '';
    try {
      var d = new Date(s + 'T00:00:00Z');
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch (e) { return s; }
  }

  function statusBadge(status) {
    return '<span class="status-badge ' + esc(status) + '">' + esc(STATUS_LABEL[status] || status) + '</span>';
  }
  function verdictBadge(v) {
    if (!v) return '';
    return '<span class="verdict-badge ' + esc(v) + '">' + esc(VERDICT_LABEL[v] || v) + '</span>';
  }

  function renderTimeline(checkins) {
    if (!checkins || !checkins.length) {
      return '<p class="ldg-nr">No check-ins logged yet.</p>';
    }
    return '<ol class="ldg-timeline">' + checkins.map(function (ci) {
      return '<li class="' + esc(ci.signal || '') + '">' +
        '<span class="tl-date">' + esc(fmtDate(ci.at)) + '</span>' +
        '<p class="tl-note">' + esc(ci.note) +
        (ci.source_url ? ' <a href="' + esc(ci.source_url) + '" rel="noopener noreferrer">source →</a>' : '') +
        '</p></li>';
    }).join('') + '</ol>';
  }

  function renderOne(c, claimantName) {
    var out = '';
    out += '<blockquote class="ldg-quote">“' + esc(c.verbatim) + '”' +
      '<cite>' + (c.speaker ? esc(c.speaker) + ', ' : '') + esc(claimantName) +
      ' — <a href="' + esc(c.source_url) + '" rel="noopener noreferrer">' +
      esc(c.source_kind || 'source') + '</a>, ' + esc(fmtDate(c.source_date)) +
      (c.source_archive_url ? ' (<a href="' + esc(c.source_archive_url) + '" rel="noopener noreferrer">archived</a>)' : '') +
      '</cite></blockquote>';

    out += '<div class="ldg-section"><h4>Resolution criteria — frozen ' +
      esc(fmtDate(c.criteria_frozen_at)) + '</h4><p>' + esc(c.resolution_criteria) + '</p></div>';

    if (c.resolver_sources && c.resolver_sources.length) {
      out += '<div class="ldg-section"><h4>Where we will look</h4><ul class="ldg-resolver-list">' +
        c.resolver_sources.map(function (s) {
          var isUrl = /^https?:\/\//.test(s);
          return '<li>' + (isUrl ? '<a href="' + esc(s) + '" rel="noopener noreferrer">' + esc(s) + '</a>' : esc(s)) + '</li>';
        }).join('') + '</ul></div>';
    }

    if (c.sourcing_note) {
      out += '<div class="ldg-sourcing"><strong>Sourcing note:</strong> ' + esc(c.sourcing_note) + '</div>';
    }

    out += '<div class="ldg-section"><h4>Check-ins</h4>' + renderTimeline(c.checkins) + '</div>';

    if (c.status === 'resolved') {
      out += '<div class="ldg-section"><h4>Verdict — ' + verdictBadge(c.verdict) + '</h4>' +
        (c.verdict_reasoning ? '<p>' + esc(c.verdict_reasoning) + '</p>' : '') + '</div>';
    }
    if (c.claimant_response) {
      out += '<div class="ldg-section"><h4>Right of reply</h4><p>' + esc(c.claimant_response) +
        (c.claimant_response_url ? ' <a href="' + esc(c.claimant_response_url) + '" rel="noopener noreferrer">→</a>' : '') +
        '</p></div>';
    }

    out += '<p class="ldg-nr">Domain: ' + esc(DOMAIN_LABEL[c.domain] || c.domain) +
      ' · Kind: ' + esc(c.kind) + ' · Resolves by ' + esc(fmtDate(c.resolves_by)) +
      (c.grace_days ? ' (+' + c.grace_days + ' day grace)' : '') + '</p>';

    return out;
  }

  function renderScorecards(sc, claimantMap) {
    if (!sc) return '';
    var rows = sc.claimants.slice().sort(function (a, b) {
      if (a.rankable !== b.rankable) return a.rankable ? -1 : 1;
      return (b.weighted_rate || 0) - (a.weighted_rate || 0);
    });
    var body = rows.map(function (r) {
      return '<tr>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td class="num">' + r.n_tracked + '</td>' +
        '<td class="num">' + r.n_resolved + '</td>' +
        '<td class="num">' + (r.rankable ? (r.weighted_rate * 100).toFixed(0) + '%' : '<span class="ldg-nr">n&lt;5</span>') + '</td>' +
        '<td class="num">' + (r.slip_days_median == null ? '—' : (r.slip_days_median > 0 ? '+' : '') + r.slip_days_median + 'd') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="overflow"><table class="ldg-scorecard">' +
      '<tr><th>Claimant</th><th class="num">Tracked</th><th class="num">Resolved</th>' +
      '<th class="num">Weighted rate</th><th class="num">Median slip</th></tr>' +
      body + '</table></div>' +
      '<p class="n">Weighted rate needs ≥5 resolved claims before it ranks (n=' +
      rows.filter(function (r) { return r.rankable; }).length + ' of ' + rows.length +
      ' claimants qualify so far). Slip is median days between the promised date and the actual one — ' +
      'positive means late.</p>';
  }

  function renderOurs(sc) {
    if (!sc || !sc.ours) return '';
    var o = sc.ours;
    return '<div class="ldg-ours">' +
      '<div class="stat"><b>' + o.n_captured + '</b><span>claims captured</span></div>' +
      '<div class="stat"><b>' + o.n_resolved + '</b><span>resolved</span></div>' +
      '<div class="stat"><b>' + o.n_void + '</b><span>void (our error)</span></div>' +
      '<div class="stat"><b>' + o.corrections_from_right_of_reply + '</b><span>verdicts changed by right of reply</span></div>' +
      '</div><p class="ldg-nr">' + esc(o.note) + '</p>';
  }

  function mount(host, o) {
    if (!host) return;
    o = o || {};
    var base = o.base || '';
    host.innerHTML = '<p class="archq-loading">Loading The Ledger…</p>';

    Promise.all([
      fetch(base + 'data/claims/index.json', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }),
      fetch(base + 'data/claims/claimants.json', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
      }),
      fetch(base + 'data/claims/scorecards.json', { cache: 'no-store' }).then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; }),
    ]).then(function (results) {
      var idx = results[0], claimantsData = results[1], scorecards = results[2];
      var entries = (idx && idx.entries) || [];
      var claimantMap = {};
      (claimantsData.claimants || []).forEach(function (c) { claimantMap[c.slug] = c; });

      var scHost = document.getElementById('ldg-scorecards');
      if (scHost) scHost.innerHTML = renderScorecards(scorecards, claimantMap);
      var oursHost = document.getElementById('ldg-ours');
      if (oursHost) oursHost.innerHTML = renderOurs(scorecards);

      if (!entries.length) {
        host.innerHTML = '<p class="archq-loading">Nothing tracked yet.</p>';
        return;
      }

      // newest source first
      entries.sort(function (a, b) { return (b.source_date || '').localeCompare(a.source_date || ''); });

      var domains = {}, statuses = {};
      entries.forEach(function (e) { domains[e.domain] = 1; statuses[e.status] = 1; });

      var filterBar = '<div class="ldg-filters" role="group" aria-label="Filter claims">' +
        '<button class="on" data-f="status" data-v="">All statuses</button>' +
        Object.keys(statuses).sort().map(function (s) {
          return '<button data-f="status" data-v="' + esc(s) + '">' + esc(STATUS_LABEL[s] || s) + '</button>';
        }).join('') +
        '<span class="sep" aria-hidden="true"></span>' +
        '<button class="on" data-f="domain" data-v="">All domains</button>' +
        Object.keys(domains).sort().map(function (d) {
          return '<button data-f="domain" data-v="' + esc(d) + '">' + esc(DOMAIN_LABEL[d] || d) + '</button>';
        }).join('') +
        '</div>';

      var listHtml = entries.map(function (e) {
        var cl = claimantMap[e.claimant];
        return '<details class="archq ldg-item" id="c-' + esc(e.slug) + '" data-slug="' + esc(e.slug) +
          '" data-domain="' + esc(e.domain) + '" data-status="' + esc(e.status) + '">' +
          '<summary>' +
            '<span class="archq-txt"><span class="ldg-claimant">' + esc(cl ? cl.name : e.claimant) + '</span>' +
            '<span class="ldg-headline">' + esc(e.headline) + '</span></span>' +
            statusBadge(e.status) + verdictBadge(e.verdict) +
            '<span class="orbadge">by ' + esc(fmtDate(e.resolves_by)) + '</span>' +
          '</summary>' +
          '<div class="ldg-body archq-body"><p class="archq-loading">Opening…</p></div>' +
        '</details>';
      }).join('');

      host.innerHTML =
        '<p class="ldg-count" id="ldg-visible-count"></p>' +
        filterBar +
        '<div id="ldg-list">' + listHtml + '</div>';

      var listEl = document.getElementById('ldg-list');
      var countEl = document.getElementById('ldg-visible-count');
      var active = { status: '', domain: '' };

      function applyFilters() {
        var visible = 0;
        [].slice.call(listEl.children).forEach(function (el) {
          var show = (!active.status || el.dataset.status === active.status) &&
                     (!active.domain || el.dataset.domain === active.domain);
          el.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        countEl.textContent = visible + ' of ' + entries.length + ' claim' + (entries.length === 1 ? '' : 's') +
          ' shown — newest source first.';
      }
      applyFilters();

      host.querySelectorAll('.ldg-filters button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var f = btn.dataset.f, v = btn.dataset.v;
          active[f] = v;
          host.querySelectorAll('.ldg-filters button[data-f="' + f + '"]').forEach(function (b) {
            b.classList.toggle('on', b === btn);
          });
          applyFilters();
        });
      });

      listEl.addEventListener('toggle', function (ev) {
        var d = ev.target;
        if (d.tagName !== 'DETAILS' || !d.open || d.dataset.loaded) return;
        d.dataset.loaded = '1';
        var body = d.querySelector('.ldg-body');
        var slug = d.dataset.slug;
        fetch(base + 'data/claims/' + slug + '.json', { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (c) {
            var cl = claimantMap[c.claimant];
            body.innerHTML = renderOne(c, cl ? cl.name : c.claimant);
          })
          .catch(function (err) {
            body.innerHTML = '<p class="archq-loading">Could not load this one (' + esc(err.message) + ').</p>';
            d.dataset.loaded = '';
          });
      }, true);

      // Deep link: #c-<slug> opens that claim and clears any active filter
      // that would otherwise hide it (deep links outrank filters, same rule
      // tiers.js uses for depth vs. anchors).
      function openFromHash() {
        var m = /^#c-(.+)$/.exec(location.hash);
        if (!m) return;
        var el = document.getElementById('c-' + m[1]);
        if (!el) return;
        active.status = ''; active.domain = '';
        host.querySelectorAll('.ldg-filters button').forEach(function (b) {
          b.classList.toggle('on', b.dataset.v === '');
        });
        applyFilters();
        el.open = true;
        el.scrollIntoView({ block: 'start' });
      }
      openFromHash();
      window.addEventListener('hashchange', openFromHash);
    }).catch(function (err) {
      host.innerHTML = '<p class="archq-loading">The Ledger could not be loaded (' + esc(err.message) + ').</p>';
    });
  }

  window.SymbiQ.ledger = { mount: mount };
})();
