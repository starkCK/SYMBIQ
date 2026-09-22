/* SymbiQ, The Standing -- a persistent, cross-page record of the reader's own
 * calibrated reasoning, threaded through the pages that already generate a
 * checkable claim: a game's medal, a curriculum check-your-understanding
 * question, a Ledger claim staked locally.
 *
 * TWO TRACKS, NEVER BLENDED. A game medal and a curriculum answer are
 * resolved the instant they happen, against a KNOWN-OPTIMAL or KNOWN-RIGHT
 * answer -- these are PROOFS, scored as a hit rate. A Ledger claim is a
 * genuine forecast: a probability split across verified / partially_verified
 * / not_verified, resolved only when the claim's own deadline and evidence
 * say so, months or years later -- these are PREDICTIONS, scored with a real
 * multi-class Brier score. Mixing the two into one fake number would be
 * exactly the false-precision failure this project's own verification
 * discipline exists to catch, so summary() keeps them apart.
 *
 * PERSISTENCE: one localStorage key (symbiq_standing_v1), through
 * SymbiQ.core.store so a full/blocked store degrades to "nothing saved"
 * rather than throwing. Entirely local -- no account, no server, matches
 * every other piece of local state on this site (save.js, the ladder, the
 * question streak). Cross-device sync is a stated Phase 2, gated on the
 * Cloudflare Worker; this file does not attempt it.
 *
 * SAFE EVERYWHERE, EVEN WHERE NOT LOADED. recordCyu() is called from
 * tiers.js's existing check-your-understanding handler through a guarded
 * `window.SymbiQ && SymbiQ.standing && ...` check, so pages that have not
 * yet added this script keep working exactly as before -- the hook is inert
 * until standing.js is actually present.
 *
 * API: window.SymbiQ.standing = {
 *   stake(slug, p, note), getPrediction(slug), checkResolutions(),
 *   recordCyu(right), summary(), mountLedgerStakes(), mountStandingPage()
 * }
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (!W.SymbiQ || !W.SymbiQ.core) return; // core.js must load first; see check_site.py §10
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

  /* Brier's own multi-category score (Brier 1950): sum over classes of
   * (forecast probability - actual outcome)^2, outcome 1 for the class that
   * happened and 0 for the others. 0 = perfect, 2 = maximally wrong for a
   * 3-class forecast. A uniform 33/33/34 guess scores ~0.33 regardless of
   * outcome, which is the honest baseline "I have no information" gets. */
  function brier(p, verdict) {
    var sum = 0;
    CLASSES.forEach(function (c) {
      var o = (c === verdict) ? 1 : 0;
      var pc = (+p[c] || 0) / 100;
      sum += (pc - o) * (pc - o);
    });
    return sum;
  }

  /* -------------------------------------------------------- predictions */

  function stake(slug, p, note) {
    if (!slug || !p) return null;
    var total = CLASSES.reduce(function (t, c) { return t + (+p[c] || 0); }, 0);
    if (Math.abs(total - 100) > 1) return null; // must sum to ~100, same rule the crowd form enforces client-side
    var s = load();
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

  /* Checks every un-resolved local stake against data/claims/index.json --
   * the same lightweight, git-committed summary ledger.js's own claim list
   * reads from. No account, no push: a claim resolves by its JSON changing
   * on disk, and the next visit here notices. */
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
          rec.resolved_at = new Date().toISOString().slice(0, 10);
          rec.brier = brier(rec.p, e.verdict);
          newlyResolved.push({ slug: slug, verdict: e.verdict, brier: rec.brier, headline: e.headline });
        });
        if (newlyResolved.length) save(s);
        return newlyResolved;
      })
      .catch(function () { return []; }); // offline / no network: fail quiet, try again next visit
  }

  /* ------------------------------------------------------------- proofs */

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

  /* --------------------------------------------------- mount: ledger.html */

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

  function wireStakePanel(slug, el) {
    el.innerHTML = renderStakePanel(slug);
    var form = el.querySelector('.stg-stake-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var p = {};
      CLASSES.forEach(function (c) { p[c] = form.querySelector('[data-k="' + c + '"]').value; });
      var status = form.querySelector('.stg-status');
      if (stake(slug, p)) {
        wireStakePanel(slug, el); // re-render to the saved/resolved-aware state
      } else if (status) {
        status.textContent = 'The three shares must add to 100%.';
      }
    });
  }

  /* Reacts to claim bodies ledger.js renders asynchronously (each claim's
   * <details> fetches its own JSON on first open) rather than guessing a
   * timing -- a MutationObserver on the list container is the one thing
   * that is correct regardless of how long ledger.js's own fetch takes,
   * and needs no change to ledger.js itself. */
  function mountLedgerStakes() {
    checkResolutions();
    function mountOne(fEl) {
      if (fEl.dataset.stgMounted) return;
      fEl.dataset.stgMounted = '1';
      var slug = fEl.getAttribute('data-slug');
      if (!slug) return;
      var panel = D.createElement('div');
      panel.className = 'ldg-section stg-stake';
      fEl.parentNode.insertBefore(panel, fEl.nextSibling);
      wireStakePanel(slug, panel);
    }
    all('.ldg-forecast[data-slug]').forEach(mountOne);
    var list = D.getElementById('ldg-mount') || D.body;
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches('.ldg-forecast[data-slug]')) mountOne(n);
          if (n.querySelectorAll) all('.ldg-forecast[data-slug]', n).forEach(mountOne);
        });
      });
    }).observe(list, { childList: true, subtree: true });
  }

  function all(sel, root) { return Array.prototype.slice.call((root || D).querySelectorAll(sel)); }

  /* ------------------------------------------------------- mount: standing.html */

  /* Reads SymbiQ.games.medals -- read-only, zero changes to games.js -- so
   * this only has something to show once games.js has actually loaded
   * somewhere in this tab's session (The Arcade, a mission, or the ladder).
   * standing.html does not load games.js/save.js itself (336 KB, against
   * the site's own 2026-09-21 lazy-loading rule); this page says so rather
   * than pretending "no medals" means "never played". */
  function medalRow(m) {
    if (!m) return '<p class="stg-nr">No Arcade data in this tab yet -- visit ' +
      '<a href="play.html">The Arcade</a> first, then come back to this page in the same tab.</p>';
    return '<p class="stg-nr"><strong>' + m.gold + '</strong> gold (proven optimal) · ' +
      '<strong>' + m.silver + '</strong> silver · <strong>' + m.bronze + '</strong> bronze, of 6 cabinets.</p>';
  }

  function predictionRow(r) {
    if (r.resolved) {
      return '<li class="stg-pred is-resolved"><span class="stg-pred-slug">' + esc(r.slug) + '</span>' +
        '<span class="stg-pred-verdict">' + esc(CLASS_LABEL[r.verdict] || r.verdict) + '</span>' +
        '<span class="stg-pred-brier">Brier ' + r.brier.toFixed(2) + '</span></li>';
    }
    return '<li class="stg-pred"><span class="stg-pred-slug"><a href="ledger.html#c-' + esc(r.slug) + '">' + esc(r.slug) + '</a></span>' +
      '<span class="stg-pred-stake">' + r.p.verified + '% / ' + r.p.partially_verified + '% / ' + r.p.not_verified + '%</span>' +
      '<span class="stg-pred-pending">pending</span></li>';
  }

  function renderStandingPage(root) {
    checkResolutions().then(function () { render(); }); // may flip a pending row to resolved
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
          predBlock += '<p class="stg-nr">' + sum.predictions.pending.length + ' pending, 0 resolved -- ' +
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
