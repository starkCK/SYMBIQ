/* SymbiQ — The Frontier (plan 21, phase L3): curated open questions, each
 * sent verbatim to a panel of frontier models, with the desk's own reviewed
 * answer alongside.
 *
 *   SymbiQ.frontier.mount(el, { base })
 *
 * Same shape as ledger.js / archive.js: a slim index.json lists every
 * question; the full record -- background, the model-panel answers, the desk
 * answer, the reading list -- is fetched lazily the first time a reader opens
 * one. The questions and answers are git-committed JSON, not database rows
 * (see site/supabase/schema.sql's L3 note). The database only holds what the
 * public writes: proposed questions, and votes on model answers.
 *
 * PROGRESSIVE ENHANCEMENT, same rule as the rest of the site: the page ships
 * readable HTML; this script only adds the interactive list. If it fails to
 * load, the static "how it works" prose still stands.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var STATUS_LABEL = {
    open: 'Open — no reviewed answer yet',
    under_review: 'Under desk review',
    answered: 'Answered',
    retired: 'Retired',
  };
  var TIER_LABEL = { g: 'Well established', y: 'Contested', r: 'Genuinely unresolved' };
  var ORIGIN_LABEL = {
    claim: 'from a claim on the Ledger that cannot be cleanly falsified',
    concept_gap: 'from a gap in what the site teaches',
    desk: 'set by the desk',
    submission: 'proposed by a reader, promoted by the desk',
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(s) {
    if (!s) return '';
    try {
      var d = new Date(String(s).length <= 10 ? s + 'T00:00:00Z' : s);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    } catch (e) { return s; }
  }
  function tierChip(t) {
    return '<span class="tier ' + esc(t) + '">' + esc(TIER_LABEL[t] || t) + '</span>';
  }
  function linkList(items) {
    if (!items || !items.length) return '';
    return '<ul class="frn-reading">' + items.map(function (r) {
      var isUrl = /^https?:\/\//.test(r.url || '');
      var href = esc(r.url || '');
      return '<li><a href="' + href + '"' + (isUrl ? ' rel="noopener noreferrer"' : '') + '>' +
        esc(r.label || r.url) + '</a></li>';
    }).join('') + '</ul>';
  }

  // ---- the model panel ---------------------------------------------------
  function scoreLine(s) {
    if (!s) return '';
    var parts = [];
    ['correct', 'calibrated', 'sourced', 'hedged'].forEach(function (k) {
      if (s[k] != null) parts.push(k + ' ' + esc(s[k]) + '/5');
    });
    return parts.length ? '<span class="frn-score">Desk: ' + parts.join(' · ') + '</span>' : '';
  }

  function renderPanel(q) {
    var answers = q.model_answers || [];
    if (!answers.length) {
      return '<div class="frn-section"><h4>The model panel</h4>' +
        '<p class="frn-nr">No panel answers recorded yet. When they are, each model’s reply ' +
        'appears here verbatim, tagged with its exact version and the date it was asked. ' +
        'The prompt every model receives is public — see “The model panel” section below.</p></div>';
    }
    var rows = answers.map(function (m) {
      return '<div class="frn-ans">' +
        '<div class="frn-ans-head">' +
          '<span class="frn-model">' + esc(m.model_id) + '</span>' +
          '<span class="frn-provider">' + esc(m.provider) + '</span>' +
          '<span class="frn-asked">asked ' + esc(fmtDate(m.asked_at)) + '</span>' +
          scoreLine(m.desk_score) +
        '</div>' +
        '<div class="frn-ans-body">' + esc(m.answer).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</div>' +
      '</div>';
    }).join('');
    return '<div class="frn-section"><h4>The model panel &mdash; ' + answers.length + ' answer' +
      (answers.length === 1 ? '' : 's') + ', published verbatim</h4>' +
      '<p class="frn-nr">Each answer is an entrant, graded &mdash; never presented as authoritative. ' +
      'The identical prompt went to every model.</p>' + rows + '</div>';
  }

  function renderDeskAnswer(q) {
    var da = q.desk_answer;
    if (!da) {
      return '<div class="frn-section"><h4>The reviewed answer</h4>' +
        '<p class="frn-nr">Not written yet. The desk’s answer is evidence-tiered, sourced, and ' +
        'reviewed by a second person before it publishes (the Ledger’s two-key rule). ' +
        'Until then, the model panel and The Floor are what this page offers.</p></div>';
    }
    return '<div class="frn-section frn-desk"><h4>The reviewed answer ' +
      (da.evidence_tier ? tierChip(da.evidence_tier) : '') + '</h4>' +
      '<div class="frn-desk-body"><p>' + esc(da.body).replace(/\n\n+/g, '</p><p>') + '</p></div>' +
      (da.sources && da.sources.length ? '<h5>Sources</h5>' + linkList(da.sources) : '') +
      '<p class="frn-nr">Authored ' + esc(fmtDate(da.authored_at)) +
      (da.author ? ' by ' + esc(da.author) : '') +
      (da.reviewed_by ? ', reviewed by ' + esc(da.reviewed_by) : '') + '.</p></div>';
  }

  function renderFloor(q) {
    var f = q.floor;
    if (!f) {
      return '<div class="frn-section"><h4>The Floor</h4>' +
        '<p class="frn-nr">Live discussion happens in Discord, one thread per question, ' +
        'moderated by the existing mods &mdash; nothing user-written is published on-site ' +
        '(locked rule 8). This link goes live when the Discord is wired.</p></div>';
    }
    return '<div class="frn-section"><h4>The Floor</h4>' +
      '<p>' + esc(f.participants) + ' people, ' + esc(f.messages) + ' messages. ' +
      (f.top_excerpt ? '<span class="frn-excerpt">“' + esc(f.top_excerpt) + '”</span> ' : '') +
      '<a href="' + esc(f.thread_url) + '" rel="noopener noreferrer">join the argument &rarr;</a></p>' +
      '<p class="frn-nr">Summary cached ' + esc(fmtDate(f.updated_at)) + '.</p></div>';
  }

  function renderOne(q) {
    var out = '';
    out += '<p class="frn-dek">' + esc(q.dek) + '</p>';
    out += '<div class="frn-section"><h4>Where this stands</h4><p>' + esc(q.background) + '</p></div>';
    out += renderPanel(q);
    out += renderDeskAnswer(q);
    out += renderFloor(q);
    if (q.reading && q.reading.length) {
      out += '<div class="frn-section"><h4>Reading</h4>' + linkList(q.reading) + '</div>';
    }
    var o = q.origin || {};
    out += '<p class="frn-nr">Opened ' + esc(fmtDate(q.opened_at)) + ' &middot; ' +
      esc(ORIGIN_LABEL[o.kind] || o.kind || '') +
      (o.ref ? ' (<a href="ledger.html#c-' + esc(o.ref) + '">' + esc(o.ref) + '</a>)' : '') + '.</p>';
    return out;
  }

  function mount(host, o) {
    if (!host) return;
    o = o || {};
    var base = o.base || '';
    host.innerHTML = '<p class="archq-loading">Loading The Frontier…</p>';

    fetch(base + 'data/frontier/index.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (idx) {
        var entries = (idx && idx.entries) || [];
        if (!entries.length) {
          host.innerHTML = '<p class="archq-loading">No questions opened yet.</p>';
          return;
        }
        entries.sort(function (a, b) { return (b.opened_at || '').localeCompare(a.opened_at || ''); });

        var listHtml = entries.map(function (e) {
          return '<details class="archq frn-item" id="q-' + esc(e.slug) + '" data-slug="' + esc(e.slug) + '">' +
            '<summary><span class="archq-txt"><span class="frn-q">' + esc(e.question) + '</span>' +
            '<span class="frn-meta">' + esc(STATUS_LABEL[e.status] || e.status) +
            ' &middot; ' + (e.n_model_answers || 0) + ' model answer' + (e.n_model_answers === 1 ? '' : 's') +
            '</span></span>' + tierChip(e.evidence_tier) + '</summary>' +
            '<div class="frn-body archq-body"><p class="archq-loading">Opening…</p></div>' +
          '</details>';
        }).join('');

        host.innerHTML = '<p class="frn-count">' + entries.length + ' question' +
          (entries.length === 1 ? '' : 's') + ' open &mdash; newest first. Nothing here has a reviewed ' +
          'answer yet; this is the scaffold.</p><div id="frn-list">' + listHtml + '</div>';

        var listEl = document.getElementById('frn-list');
        listEl.addEventListener('toggle', function (ev) {
          var d = ev.target;
          if (d.tagName !== 'DETAILS' || !d.open || d.dataset.loaded) return;
          d.dataset.loaded = '1';
          var body = d.querySelector('.frn-body');
          fetch(base + 'data/frontier/' + d.dataset.slug + '.json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (q) { body.innerHTML = renderOne(q); })
            .catch(function (err) {
              body.innerHTML = '<p class="archq-loading">Could not load this one (' + esc(err.message) + ').</p>';
              d.dataset.loaded = '';
            });
        }, true);

        function openFromHash() {
          var m = /^#q-(.+)$/.exec(location.hash);
          if (!m) return;
          var el = document.getElementById('q-' + m[1]);
          if (el) { el.open = true; el.scrollIntoView({ block: 'start' }); }
        }
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
      })
      .catch(function (err) {
        host.innerHTML = '<p class="archq-loading">The Frontier could not be loaded (' + esc(err.message) + ').</p>';
      });
  }

  // ---- propose a question ------------------------------------------------
  function proposeFormHTML() {
    return (
      '<form class="sqform" id="frn-propose-form">' +
        '<div class="sqfield">' +
          '<label for="frn-p-q">The question</label>' +
          '<textarea id="frn-p-q" required placeholder="One sentence, ending in a question mark. It has to be genuinely open — not something the site already answers."></textarea>' +
        '</div>' +
        '<div class="sqfield">' +
          '<label for="frn-p-why">Why it is open (optional)</label>' +
          '<textarea id="frn-p-why" placeholder="What makes this unresolved rather than just unfamiliar?"></textarea>' +
        '</div>' +
        '<div class="sqfield">' +
          '<label for="frn-p-reading">A relevant paper or link (optional)</label>' +
          '<input type="text" id="frn-p-reading" placeholder="https://…">' +
        '</div>' +
        '<button type="submit">Submit for review &rarr;</button>' +
        '<p class="frn-nr" id="frn-p-status"></p>' +
      '</form>'
    );
  }

  function wireProposeForm(container) {
    if (!container) return;
    var auth = window.SymbiQ.auth;
    if (!auth || !auth.client) {
      container.innerHTML = '<p class="frn-nr">Checking sign-in status…</p>';
      return; // symbiq:authchange re-calls this once auth.js finishes loading
    }
    var user = auth.getUser();
    if (!user) {
      container.innerHTML = '<p class="frn-nr">Sign in (top of the page) to propose a question. ' +
        'Every submission is reviewed by the desk before anything publishes — nothing here goes live automatically.</p>';
      return;
    }
    container.innerHTML = proposeFormHTML();
    var form = document.getElementById('frn-propose-form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = form.querySelector('button'), status = document.getElementById('frn-p-status');
      var row = {
        submitter_id: user.id,
        question: document.getElementById('frn-p-q').value.trim(),
        why_open: document.getElementById('frn-p-why').value.trim() || null,
        reading: document.getElementById('frn-p-reading').value.trim() || null,
      };
      if (!row.question) { status.textContent = 'The question field is required.'; return; }
      btn.disabled = true; btn.textContent = 'Submitting…';
      Promise.resolve(auth.client.from('frontier_submissions').insert(row)).then(function (r) {
        if (r && r.error) throw r.error;
        container.innerHTML = '<p class="frn-nr">Thank you — queued for review. If it clears the bar ' +
          '(genuinely open, one sentence, falsifiable in principle) the desk will open it as a real question ' +
          'and send it to the model panel.</p>';
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = 'Submit for review →';
        status.textContent = 'Could not submit (' + (err && err.message || 'unknown error') + ').';
      });
    });
  }

  window.addEventListener('symbiq:authchange', function () {
    wireProposeForm(document.getElementById('frn-propose'));
  });

  window.SymbiQ.frontier = { mount: mount, wireProposeForm: wireProposeForm };
})();
