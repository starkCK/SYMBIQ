(function () {
  'use strict';
  var W = window, D = document;
  if (!W.SymbiQ || !W.SymbiQ.core) return;
  var core = W.SymbiQ.core;
  var esc = core.esc, store = core.store;

  var KEY = 'symbiq_standing_v1';
  var CLASSES = ['verified', 'partially_verified', 'not_verified'];
  var CLASS_LABEL = { verified: 'Verified', partially_verified: 'Partially verified', not_verified: 'Not verified' };

  function load() {
    var s = store.getJSON(KEY, null);
    if (!s || typeof s !== 'object') s = { schema: 1, predictions: {}, cyu: { count: 0, correct: 0 } };
    if (!s.predictions) s.predictions = {};
    if (!s.cyu) s.cyu = { count: 0, correct: 0 };
    return s;
  }
  function save(s) { store.setJSON(KEY, s); }

  function brier(p, verdict) {
    var sum = 0;
    CLASSES.forEach(function (c) {
      var o = (c === verdict) ? 1 : 0;
      var pc = (+p[c] || 0) / 100;
      sum += (pc - o) * (pc - o);
    });
    return sum;
  }


  function stake(slug, p, note) {
    if (!slug || !p) return null;
    var total = CLASSES.reduce(function (t, c) { return t + (+p[c] || 0); }, 0);
    if (Math.abs(total - 100) > 1) return null;
    var s = load();
    if (s.predictions[slug] && s.predictions[slug].resolved) return null;
    s.predictions[slug] = {
      p: { verified: +p.verified || 0, partially_verified: +p.partially_verified || 0, not_verified: +p.not_verified || 0 },
      note: note ? String(note).slice(0, 500) : '',
      staked_at: new Date().toISOString().slice(0, 10),
      resolved: false, verdict: null, resolved_at: null, brier: null
    };
    save(s);
    return s.predictions[slug];
  }
  function getPrediction(slug) { return load().predictions[slug] || null; }

  function checkResolutions() {
    var s = load();
    var pending = Object.keys(s.predictions).filter(function (slug) { return !s.predictions[slug].resolved; });
    if (!pending.length) return Promise.resolve([]);
    return fetch('data/claims/index.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var bySlug = {};
        (j.entries || []).forEach(function (e) { bySlug[e.slug] = e; });
        var newlyResolved = [];
        pending.forEach(function (slug) {
          var e = bySlug[slug];
          if (!e || e.status !== 'resolved' || !e.verdict) return;
          var rec = s.predictions[slug];
          rec.resolved = true;
          rec.verdict = e.verdict;
          rec.resolved_at = e.resolved_at || new Date().toISOString().slice(0, 10);
          rec.brier = brier(rec.p, e.verdict);
          newlyResolved.push({ slug: slug, verdict: e.verdict, brier: rec.brier, headline: e.headline });
        });
        if (newlyResolved.length) save(s);
        return newlyResolved;
      })
      .catch(function () { return []; });
  }


  function recordCyu(right) {
    var s = load();
    s.cyu.count++;
    if (right) s.cyu.correct++;
    save(s);
  }

  function medalSummary() {
    try {
      return (W.SymbiQ.games && W.SymbiQ.games.medals) ? W.SymbiQ.games.medals.summary() : null;
    } catch (e) { return null; }
  }

  function summary() {
    var s = load();
    var preds = Object.keys(s.predictions).map(function (slug) {
      var r = s.predictions[slug]; return Object.assign({ slug: slug }, r);
    });
    var resolved = preds.filter(function (r) { return r.resolved; });
    var pending = preds.filter(function (r) { return !r.resolved; });
    var meanBrier = resolved.length
      ? resolved.reduce(function (t, r) { return t + r.brier; }, 0) / resolved.length
      : null;
    return {
      proofs: { medals: medalSummary(), cyu: s.cyu },
      predictions: { pending: pending, resolved: resolved, meanBrier: meanBrier }
    };
  }


  function stakeFormHTML(slug, existing) {
    var p = existing ? existing.p : { verified: 34, partially_verified: 33, not_verified: 33 };
    return (
      '<form class="sqform stg-stake-form" data-slug="' + esc(slug) + '">' +
        '<div class="stg-sliders">' +
          '<label>Verified<input type="number" min="0" max="100" step="1" value="' + p.verified + '" data-k="verified"> %</label>' +
          '<label>Partially<input type="number" min="0" max="100" step="1" value="' + p.partially_verified + '" data-k="partially_verified"> %</label>' +
          '<label>Not verified<input type="number" min="0" max="100" step="1" value="' + p.not_verified + '" data-k="not_verified"> %</label>' +
        '</div>' +
        '<button type="submit">' + (existing ? 'Restake →' : 'Stake your call →') + '</button>' +
        '<p class="stg-status" aria-live="polite"></p>' +
      '</form>'
    );
  }

  function renderStakePanel(slug) {
    var existing = getPrediction(slug);
    var head = '<h4>Your call <span class="stg-local">local, not the crowd</span></h4>';
    if (existing && existing.resolved) {
      return head + '<p class="stg-nr">Resolved ' + esc(existing.resolved_at) + ': ' +
        esc(CLASS_LABEL[existing.verdict] || existing.verdict) + '. Your call scored ' +
        existing.brier.toFixed(2) + ' (0 is perfect, 2 is maximally wrong). <a href="standing.html">Full record →</a></p>';
    }
    var note = existing
      ? '<p class="stg-nr">Staked ' + esc(existing.staked_at) + ': ' + existing.p.verified + '% / ' +
        existing.p.partially_verified + '% / ' + existing.p.not_verified + '%. Restaking replaces it.</p>'
      : '<p class="stg-nr">Saved in this browser only. When this claim resolves, come back (or check ' +
        '<a href="standing.html">The Standing</a>) to see how your call scored.</p>';
    return head + note + stakeFormHTML(slug, existing);
  }

  function renderResolvedCall(slug, resolvedAt) {
    var r = getPrediction(slug);
    if (!r) return '';
    var head = '<h4>Your call <span class="stg-local">local, not the crowd</span></h4>';
    var staked = 'You staked ' + r.p.verified + '% verified / ' + r.p.partially_verified + '% partially / ' +
      r.p.not_verified + '% not verified on ' + esc(r.staked_at) + '.';
    if (!r.resolved) {
      return head + '<p class="stg-nr">' + staked + ' Your score appears here once the verdict loads.</p>';
    }
    return head + '<p class="stg-nr">' + staked + ' The verdict' +
      (resolvedAt ? ', published ' + esc(resolvedAt) + ',' : '') + ' was ' +
      esc(CLASS_LABEL[r.verdict] || r.verdict) + '. Your call scored <strong>' + r.brier.toFixed(2) +
      '</strong> (0 is perfect, 2 is maximally wrong). <a href="standing.html">Full record →</a></p>';
  }

  function wireStakePanel(slug, el) {
    el.innerHTML = renderStakePanel(slug);
    var form = el.querySelector('.stg-stake-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var cur = getPrediction(slug);
      if (cur && cur.resolved) { wireStakePanel(slug, el); return; }
      var p = {};
      CLASSES.forEach(function (c) { p[c] = form.querySelector('[data-k="' + c + '"]').value; });
      var status = form.querySelector('.stg-status');
      if (stake(slug, p)) {
        wireStakePanel(slug, el);
      } else if (status) {
        status.textContent = 'The three shares must add to 100%.';
      }
    });
  }

  var MOUNT_SEL = '.ldg-forecast[data-slug], .ldg-yourcall[data-slug]';

  function mountLedgerStakes() {
    var ready = checkResolutions();
    function mountOne(fEl) {
      if (fEl.dataset.stgMounted) return;
      fEl.dataset.stgMounted = '1';
      var slug = fEl.getAttribute('data-slug');
      if (!slug) return;
      var panel = D.createElement('div');
      panel.className = 'ldg-section stg-stake';
      if (fEl.classList.contains('ldg-yourcall')) {
        ready.then(function () {
          var html = renderResolvedCall(slug, fEl.getAttribute('data-resolved-at'));
          if (!html) return;
          panel.innerHTML = html;
          fEl.parentNode.insertBefore(panel, fEl.nextSibling);
        });
        return;
      }
      fEl.parentNode.insertBefore(panel, fEl.nextSibling);
      wireStakePanel(slug, panel);
    }
    all(MOUNT_SEL).forEach(mountOne);
    var list = D.getElementById('ldg-mount') || D.body;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(MOUNT_SEL)) mountOne(n);
          if (n.querySelectorAll) all(MOUNT_SEL, n).forEach(mountOne);
        });
      });
    }).observe(list, { childList: true, subtree: true });
  }

  function all(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }


  function medalRow(m) {
    if (!m) return '<p class="stg-nr">No Arcade data in this tab yet — visit ' +
      '<a href="play.html">The Arcade</a> first, then come back to this page in the same tab.</p>';
    return '<p class="stg-nr"><strong>' + m.gold + '</strong> gold (proven optimal) · ' +
      '<strong>' + m.silver + '</strong> silver · <strong>' + m.bronze + '</strong> bronze, of 6 cabinets.</p>';
  }

  function predictionRow(r) {
    if (r.resolved) {
      return '<li class="stg-pred is-resolved"><span class="stg-pred-slug"><a href="ledger.html#c-' + esc(r.slug) + '">' + esc(r.slug) + '</a></span>' +
        '<span class="stg-pred-verdict">' + esc(CLASS_LABEL[r.verdict] || r.verdict) + '</span>' +
        '<span class="stg-pred-brier">Brier ' + r.brier.toFixed(2) + '</span></li>';
    }
    return '<li class="stg-pred"><span class="stg-pred-slug"><a href="ledger.html#c-' + esc(r.slug) + '">' + esc(r.slug) + '</a></span>' +
      '<span class="stg-pred-stake">' + r.p.verified + '% / ' + r.p.partially_verified + '% / ' + r.p.not_verified + '%</span>' +
      '<span class="stg-pred-pending">pending</span></li>';
  }

  function renderStandingPage(root) {
    checkResolutions().then(function () { render(); });
    function render() {
      var sum = summary();
      var out = [];
      out.push('<section class="stg-block"><h2>Proofs</h2>' +
        '<p class="stg-nr">Things checked immediately against a known-right answer: a game’s medal, a curriculum question.</p>' +
        medalRow(sum.proofs.medals) +
        (sum.proofs.cyu.count
          ? '<p class="stg-nr"><strong>' + sum.proofs.cyu.correct + '</strong> of <strong>' + sum.proofs.cyu.count +
            '</strong> check-your-understanding questions answered right.</p>'
          : '<p class="stg-nr">No check-your-understanding questions answered yet in this browser.</p>') +
        '</section>');

      var predBlock = '<section class="stg-block"><h2>Predictions</h2>' +
        '<p class="stg-nr">Ledger claims staked locally, scored with a real multi-class Brier score once each ' +
        'resolves (0 = perfect, 2 = maximally wrong). Nothing here happens until you stake a call from ' +
        '<a href="ledger.html">The Ledger</a>.</p>';
      if (!sum.predictions.pending.length && !sum.predictions.resolved.length) {
        predBlock += '<p class="stg-nr">No predictions staked yet.</p>';
      } else {
        if (sum.predictions.meanBrier !== null) {
          predBlock += '<p class="stg-nr">Mean Brier across ' + sum.predictions.resolved.length +
            ' resolved prediction' + (sum.predictions.resolved.length === 1 ? '' : 's') + ': <strong>' +
            sum.predictions.meanBrier.toFixed(2) + '</strong>.</p>';
        } else {
          predBlock += '<p class="stg-nr">' + sum.predictions.pending.length + ' pending, 0 resolved — ' +
            'not enough resolved predictions yet for a calibration score. Claims on this site resolve on ' +
            'their own dated deadline, not on demand.</p>';
        }
        predBlock += '<ul class="stg-pred-list">' +
          sum.predictions.resolved.map(predictionRow).join('') +
          sum.predictions.pending.map(predictionRow).join('') + '</ul>';
      }
      predBlock += '</section>';
      out.push(predBlock);
      root.innerHTML = out.join('');
    }
    render();
  }

  function mountStandingPage() {
    var root = D.getElementById('stg-mount');
    if (root) renderStandingPage(root);
  }

  W.SymbiQ.standing = {
    stake: stake, getPrediction: getPrediction, checkResolutions: checkResolutions,
    recordCyu: recordCyu, summary: summary,
    mountLedgerStakes: mountLedgerStakes, mountStandingPage: mountStandingPage
  };

  D.addEventListener('DOMContentLoaded', function () {
    if (D.getElementById('ldg-mount')) mountLedgerStakes();
    if (D.getElementById('stg-mount')) mountStandingPage();
  });
}());
