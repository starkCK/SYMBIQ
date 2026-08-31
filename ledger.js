/* SymbiQ, The Ledger: the claim tracker, defined once and mounted on
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

  // ---- L2: forecasting -----------------------------------------------------
  // Slugs of currently-open (loaded) claim panels, so a sign-in/out event can
  // re-render just the ones actually on screen rather than re-fetching
  // everything. Populated in the toggle handler in mount(), read here.
  var openForecasts = {};

  function bucketPct(n) { return Math.round((n || 0) * 100); }

  function crowdSummary(rows) {
    if (!rows.length) return { n: 0 };
    var sum = { verified: 0, partially_verified: 0, not_verified: 0 };
    rows.forEach(function (r) {
      var p = r.p || {};
      sum.verified += +p.verified || 0;
      sum.partially_verified += +p.partially_verified || 0;
      sum.not_verified += +p.not_verified || 0;
    });
    var n = rows.length;
    return {
      n: n,
      verified: sum.verified / n,
      partially_verified: sum.partially_verified / n,
      not_verified: sum.not_verified / n,
    };
  }

  function forecastFormHTML(slug) {
    return (
      '<form class="sqform ldg-forecast-form" data-slug="' + esc(slug) + '">' +
        '<div class="ldg-fsliders">' +
          '<label>Verified<input type="number" min="0" max="100" step="1" value="34" data-k="verified"> %</label>' +
          '<label>Partially<input type="number" min="0" max="100" step="1" value="33" data-k="partially_verified"> %</label>' +
          '<label>Not verified<input type="number" min="0" max="100" step="1" value="33" data-k="not_verified"> %</label>' +
        '</div>' +
        '<textarea placeholder="Why (optional)" maxlength="500"></textarea>' +
        '<button type="submit">Submit forecast →</button>' +
        '<p class="ldg-nr ldg-fstatus"></p>' +
      '</form>'
    );
  }

  function renderForecastInner(slug, crowd, signedIn) {
    var summary = crowd.n
      ? '<p class="ldg-nr">' + crowd.n + ' forecast' + (crowd.n === 1 ? '' : 's') + ' so far, average ' +
        bucketPct(crowd.verified) + '% verified / ' + bucketPct(crowd.partially_verified) + '% partial / ' +
        bucketPct(crowd.not_verified) + '% not verified.</p>'
      : '<p class="ldg-nr">No forecasts yet, be the first.</p>';
    var action = signedIn
      ? forecastFormHTML(slug)
      : '<p class="ldg-nr">Sign in (top of the page) to add your own forecast.</p>';
    return summary + action;
  }

  function wireForecast(slug, el) {
    var auth = window.SymbiQ.auth;
    if (!auth || !auth.client) {
      el.innerHTML = '<h4>Forecast</h4><p class="ldg-nr">Checking sign-in status…</p>';
      return; // symbiq:authchange fires once auth.js finishes loading; see mount()'s listener
    }
    Promise.resolve(auth.client.from('claim_forecasts').select('p').eq('claim_slug', slug))
      .then(function (res) {
        // supabase-js resolves (not rejects) on an API error, packing it into
        // res.error -- checking res.data alone would silently read a real
        // failure as "zero forecasts exist yet."
        if (res && res.error) throw res.error;
        var crowd = crowdSummary((res && res.data) || []);
        var user = auth.getUser();
        el.innerHTML = '<h4>Forecast</h4>' + renderForecastInner(slug, crowd, !!user);
        var form = el.querySelector('.ldg-forecast-form');
        if (!form) return;
        form.addEventListener('submit', function (ev) {
          ev.preventDefault();
          var btn = form.querySelector('button'), status = form.querySelector('.ldg-fstatus');
          var raw = {};
          form.querySelectorAll('input[data-k]').forEach(function (inp) { raw[inp.dataset.k] = +inp.value || 0; });
          var total = raw.verified + raw.partially_verified + raw.not_verified;
          if (total <= 0) { status.textContent = 'Enter at least one non-zero percentage.'; return; }
          var p = {
            verified: raw.verified / total,
            partially_verified: raw.partially_verified / total,
            not_verified: raw.not_verified / total,
          };
          var rationale = (form.querySelector('textarea').value || '').trim().slice(0, 500);
          btn.disabled = true; btn.textContent = 'Submitting…';
          Promise.resolve(auth.client.from('claim_forecasts').insert({
            claim_slug: slug, user_id: user.id, p: p, rationale: rationale || null
          })).then(function (r) {
            if (r && r.error) throw r.error;
            wireForecast(slug, el); // re-render with the new forecast folded into the crowd summary
          }).catch(function (err) {
            btn.disabled = false; btn.textContent = 'Submit forecast →';
            status.textContent = 'Could not submit (' + (err && err.message || 'unknown error') + ').';
          });
        });
      })
      .catch(function (err) {
        el.innerHTML = '<h4>Forecast</h4><p class="ldg-nr">Could not load forecasts (' + esc(err.message) + ').</p>';
      });
  }

  function renderOne(c, claimantName) {
    var out = '';
    out += '<blockquote class="ldg-quote">“' + esc(c.verbatim) + '”' +
      '<cite>' + (c.speaker ? esc(c.speaker) + ', ' : '') + esc(claimantName) +
      ', <a href="' + esc(c.source_url) + '" rel="noopener noreferrer">' +
      esc(c.source_kind || 'source') + '</a>, ' + esc(fmtDate(c.source_date)) +
      (c.source_archive_url ? ' (<a href="' + esc(c.source_archive_url) + '" rel="noopener noreferrer">archived</a>)' : '') +
      '</cite></blockquote>';

    out += '<div class="ldg-section"><h4>Resolution criteria, frozen ' +
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
      out += '<div class="ldg-section"><h4>Verdict, ' + verdictBadge(c.verdict) + '</h4>' +
        (c.verdict_reasoning ? '<p>' + esc(c.verdict_reasoning) + '</p>' : '') + '</div>';
    }
    if (c.claimant_response) {
      out += '<div class="ldg-section"><h4>Right of reply</h4><p>' + esc(c.claimant_response) +
        (c.claimant_response_url ? ' <a href="' + esc(c.claimant_response_url) + '" rel="noopener noreferrer">→</a>' : '') +
        '</p></div>';
    }

    // Forecasting only makes sense while a verdict is still genuinely open.
    if (c.status === 'tracking' || c.status === 'resolvable') {
      out += '<div class="ldg-section ldg-forecast" id="ldgf-' + esc(c.slug) + '" data-slug="' + esc(c.slug) + '">' +
        '<h4>Forecast</h4><p class="ldg-nr">Loading…</p></div>';
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
        '<td class="num">' + (r.slip_days_median == null ? ', ' : (r.slip_days_median > 0 ? '+' : '') + r.slip_days_median + 'd') + '</td>' +
        '</tr>';
    }).join('');
    return '<div class="overflow"><table class="ldg-scorecard">' +
      '<tr><th>Claimant</th><th class="num">Tracked</th><th class="num">Resolved</th>' +
      '<th class="num">Weighted rate</th><th class="num">Median slip</th></tr>' +
      body + '</table></div>' +
      '<p class="n">Weighted rate needs ≥5 resolved claims before it ranks (n=' +
      rows.filter(function (r) { return r.rankable; }).length + ' of ' + rows.length +
      ' claimants qualify so far). Slip is median days between the promised date and the actual one, ' +
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
          ' shown, newest source first.';
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
            var fEl = body.querySelector('.ldg-forecast');
            if (fEl) { openForecasts[c.slug] = true; wireForecast(c.slug, fEl); }
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

  // Re-render every forecast panel currently open when sign-in state changes
  // -- covers both "auth.js finished loading after this panel was opened"
  // and "the user actually signed in/out while looking at this claim."
  window.addEventListener('symbiq:authchange', function () {
    Object.keys(openForecasts).forEach(function (slug) {
      var el = document.getElementById('ldgf-' + slug);
      if (el) wireForecast(slug, el);
    });
    var subEl = document.getElementById('ldg-submit');
    if (subEl) wireSubmitForm(subEl);
  });

  // ---- L2: propose a claim --------------------------------------------------
  function submitFormHTML() {
    return (
      '<form class="sqform" id="ldg-submit-form">' +
        '<div class="sqfield">' +
          '<label for="ldg-sub-url">Source URL</label>' +
          '<input type="url" id="ldg-sub-url" required placeholder="https://…">' +
        '</div>' +
        '<div class="sqfield">' +
          '<label for="ldg-sub-quote">The claim, as close to verbatim as you can get it</label>' +
          '<textarea id="ldg-sub-quote" required placeholder="Quote the actual sentence, and who said it"></textarea>' +
        '</div>' +
        '<div class="sqfield">' +
          '<label for="ldg-sub-why">Why this belongs on the Ledger (optional)</label>' +
          '<textarea id="ldg-sub-why" placeholder="What would prove it true or false, and by when?"></textarea>' +
        '</div>' +
        '<div class="sqfield">' +
          '<label for="ldg-sub-deadline">Suggested deadline (optional)</label>' +
          '<input type="date" id="ldg-sub-deadline">' +
        '</div>' +
        '<button type="submit">Submit for review →</button>' +
        '<p class="ldg-nr" id="ldg-sub-status"></p>' +
      '</form>'
    );
  }

  function wireSubmitForm(container) {
    var auth = window.SymbiQ.auth;
    if (!auth || !auth.client) {
      container.innerHTML = '<p class="ldg-nr">Checking sign-in status…</p>';
      return;
    }
    var user = auth.getUser();
    if (!user) {
      container.innerHTML = '<p class="ldg-nr">Sign in (top of the page) to propose a claim. Every submission is reviewed by the desk before anything publishes, nothing here goes live automatically.</p>';
      container.dataset.wired = '';
      return;
    }
    container.innerHTML = submitFormHTML();
    container.dataset.wired = '1';
    var form = document.getElementById('ldg-submit-form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = form.querySelector('button'), status = document.getElementById('ldg-sub-status');
      var row = {
        submitter_id: user.id,
        raw_url: document.getElementById('ldg-sub-url').value.trim(),
        raw_quote: document.getElementById('ldg-sub-quote').value.trim(),
        why: document.getElementById('ldg-sub-why').value.trim() || null,
        suggested_deadline: document.getElementById('ldg-sub-deadline').value || null,
      };
      btn.disabled = true; btn.textContent = 'Submitting…';
      Promise.resolve(auth.client.from('claim_submissions').insert(row)).then(function (r) {
        if (r && r.error) throw r.error;
        container.innerHTML = '<p class="ldg-nr">Thank you, queued for review. Nothing publishes automatically; ' +
          'if it clears the intake bar (attributed, dated, falsifiable, deadlined) the desk will write it up as ' +
          'a real entry, criteria frozen before tracking starts.</p>';
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Submit for review →';
        status.textContent = 'Could not submit (' + (err && err.message || 'unknown error') + ').';
      });
    });
  }

  window.SymbiQ.ledger = { mount: mount, wireSubmitForm: wireSubmitForm };
})();
