/* SymbiQ, contradiction.js — the ledger, inline, where the claim is made.
 * ============================================================================
 * PART A3 of outputs/22_SIGNATURE_UX_AND_GAME_LADDER.md.
 *
 * A page author drops one placeholder next to the paragraph making a tracked
 * claim:
 *
 *   <div class="contra" data-claim="dwave-magnetic-simulation-supremacy-2025">
 *     <a href="ledger.html#c-dwave-magnetic-simulation-supremacy-2025">Tracked on The Ledger →</a>
 *   </div>
 *
 * and this fills it in from site/data/claims/ — the same records ledger.js
 * reads and tools/check_claims.py validates. The static link inside the
 * placeholder is the JS-off / fetch-failed state and is never removed until
 * the real card is ready to replace it.
 *
 * WHY FETCHED RATHER THAN BAKED INTO THE HTML
 * -------------------------------------------
 * A claim's status changes: check-ins get added, deadlines pass, verdicts
 * land. Summarising a claim into prose on three pages creates three copies
 * that drift, which is not hypothetical here -- race.html carried the same
 * wrong sentence in three hand-copied places for three days (correction 1).
 * One record, N renderings, zero copies. The cost is that a crawler sees the
 * fallback link instead of the card, which is the right trade for a
 * supplementary card whose whole value is being current.
 *
 * SAFETY CONTRACT — the house rule, same as lexicon.js / receipts.js /
 * throughline.js:
 *   1. PROGRESSIVE ENHANCEMENT. If a fetch fails, the JSON is malformed, or
 *      anything here throws, the placeholder keeps its static link. No prose
 *      is ever hidden, moved or rewritten.
 *   2. NEVER ASSERTS ANYTHING THE LEDGER DOES NOT. Every line rendered is a
 *      field from the record. Nothing is computed except "has this deadline
 *      passed", which is a date comparison against grace_days, exactly as
 *      tools/sweep_claims.py does it.
 *   3. ONE FETCH PER SLUG PER PAGE, even if two placeholders name the same
 *      claim.
 * ============================================================================
 */
(function () {
  'use strict';
  var W = window, D = document;

  var STATUS_LABEL = {
    draft: 'Draft', tracking: 'Tracking', resolvable: 'Awaiting resolution',
    proposed: 'Proposed', resolved: 'Resolved', void: 'Void', superseded: 'Superseded'
  };
  var VERDICT_LABEL = {
    verified: 'Verified', partially_verified: 'Partially verified',
    not_verified: 'Not verified', unfalsifiable: 'Unfalsifiable', overtaken: 'Overtaken'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtDate(s) {
    if (!s) return '';
    try {
      return new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
      });
    } catch (e) { return s; }
  }

  /* Same rule as tools/sweep_claims.py: a claim is past due once its
     resolution date plus its own grace period is behind us. */
  function pastDue(rec) {
    if (!rec.resolves_by) return false;
    try {
      var due = new Date(rec.resolves_by + 'T00:00:00Z').getTime();
      due += (+rec.grace_days || 0) * 86400000;
      return Date.now() > due;
    } catch (e) { return false; }
  }

  /* The state every rendering agrees on. Returned as {cls, kicker} so the
     full card and the compact scoreboard cell can never disagree about
     whether a claim is in trouble. */
  function state(rec) {
    var ci = rec.checkins || [];
    /* `at_risk` and `off_track` are NOT the same finding and must never share
       a label. at_risk = someone published evidence AGAINST the claim (a
       rebuttal). off_track = nobody argued with it; the date came and went
       with nothing reported. Calling the second one "contested" credits a
       rebuttal that does not exist -- the exact class of mislabel this
       project keeps logging. */
    var rebutted = ci.filter(function (c) { return c.signal === 'at_risk'; });
    var missed = ci.filter(function (c) { return c.signal === 'off_track'; });
    var good = ci.filter(function (c) { return c.signal === 'on_track'; });
    var trouble = rebutted.concat(missed);

    if (rec.verdict) {
      return { cls: rec.verdict === 'verified' ? 'is-ontrack' : 'is-contested',
               kicker: 'Resolved · ' + (VERDICT_LABEL[rec.verdict] || rec.verdict),
               short: VERDICT_LABEL[rec.verdict] || rec.verdict, trouble: trouble, good: good };
    }
    if (rebutted.length >= 2) {
      return { cls: 'is-contested', kicker: rebutted.length + ' dated rebuttals are on the record',
               short: rebutted.length + ' rebuttals on the record', trouble: trouble, good: good };
    }
    if (rebutted.length === 1) {
      return { cls: 'is-contested', kicker: 'Contested — one dated rebuttal is on the record',
               short: 'one rebuttal on the record', trouble: trouble, good: good };
    }
    if (missed.length) {
      return { cls: 'is-overdue',
               kicker: 'Its own deadline passed with nothing reported',
               short: 'missed, nothing reported', trouble: trouble, good: good };
    }
    if (pastDue(rec)) {
      return { cls: 'is-overdue', kicker: 'This deadline has passed, unresolved',
               short: 'deadline passed, unresolved', trouble: trouble, good: good };
    }
    if (good.length) {
      return { cls: 'is-ontrack', kicker: 'Tracked · an interim milestone has landed',
               short: 'an interim milestone has landed', trouble: trouble, good: good };
    }
    return { cls: '', kicker: 'Tracked, and not resolved yet', short: 'tracked, not resolved',
             trouble: trouble, good: good };
  }

  /* The compact form, for race.html's scoreboard. Deliberately carries NO
     hand-written summary of the claim -- only its own dated state and a link
     -- because a summary in a table cell is exactly the copy that drifts. */
  function buildCell(rec) {
    var st = state(rec);
    return '<span class="contra-cell ' + esc(st.cls) + '">' +
      '<span class="contra-dot" aria-hidden="true"></span>' +
      '<a href="ledger.html#c-' + esc(rec.slug) + '">resolves ' +
      esc(fmtDate(rec.resolves_by)) + '</a>' +
      '<span class="contra-cell-note">' + esc(st.short) + '</span></span>';
  }

  function build(rec, claimantName) {
    var st = state(rec);
    var trouble = st.trouble, good = st.good;
    var cls = st.cls ? ' ' + st.cls : '';
    var kicker = st.kicker;

    /* The shown check-ins: whatever actually carries a signal. A no_signal
       "captured at seed" note says nothing and is left to the full record. */
    var shown = trouble.length ? trouble : good;

    var h = '<div class="contra-card' + cls + '">';
    h += '<span class="contra-kicker">' + esc(kicker) + '</span>';
    h += '<p class="contra-claim">' +
         (rec.verbatim ? '<q>' + esc(rec.verbatim) + '</q>' : esc(rec.headline)) +
         '</p>';
    h += '<span class="contra-who">' + esc(rec.speaker || claimantName || '') +
         (rec.source_date ? ' · ' + esc(fmtDate(rec.source_date)) : '') +
         (rec.source_url ? ' · <a href="' + esc(rec.source_url) +
            '" rel="noopener noreferrer">source →</a>' : '') +
         '</span>';

    if (shown.length) {
      h += '<ul class="contra-list">' + shown.map(function (c) {
        return '<li class="' + esc(c.signal || '') + '">' +
          '<span class="contra-when">' + esc(fmtDate(c.at)) + '</span>' +
          esc(c.note) +
          (c.source_url ? ' <a href="' + esc(c.source_url) +
             '" rel="noopener noreferrer">source →</a>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }

    h += '<p class="contra-foot">' +
         esc(STATUS_LABEL[rec.status] || rec.status || 'Tracked') +
         (rec.resolves_by ? ' · resolves by ' + esc(fmtDate(rec.resolves_by)) : '') +
         (rec.grace_days ? ' (+' + esc(rec.grace_days) + ' days’ grace)' : '') +
         ' · <a href="ledger.html#c-' + esc(rec.slug) +
         '">the frozen criteria and full record →</a></p>';
    h += '</div>';
    return h;
  }

  function boot() {
    var cards = Array.prototype.slice.call(D.querySelectorAll('.contra[data-claim]'));
    var cells = Array.prototype.slice.call(D.querySelectorAll('[data-claim-cell]'));
    if (!cards.length && !cells.length) return;

    /* One bucket per slug, so a page carrying both a card and a scoreboard
       cell for the same claim still fetches that record exactly once. */
    var byslug = {};
    function want(el, attr, kind) {
      var s = el.getAttribute(attr);
      if (!s) return;
      (byslug[s] = byslug[s] || []).push({ el: el, kind: kind });
    }
    cards.forEach(function (n) { want(n, 'data-claim', 'card'); });
    cells.forEach(function (n) { want(n, 'data-claim-cell', 'cell'); });

    var names = {};
    fetch('data/claims/claimants.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        (d && d.claimants || []).forEach(function (c) { names[c.slug] = c.name; });
      })
      .catch(function () {})
      .then(function () {
        Object.keys(byslug).forEach(function (slug) {
          fetch('data/claims/' + slug + '.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (rec) {
              if (!rec || !rec.slug) return;          // keep the fallback link
              var card = null, cell = null;
              byslug[slug].forEach(function (t) {
                if (t.kind === 'cell') {
                  if (cell === null) cell = buildCell(rec);
                  t.el.innerHTML = cell;
                } else {
                  if (card === null) card = build(rec, names[rec.claimant]);
                  t.el.innerHTML = card;
                }
              });
            })
            .catch(function () {});
        });
      });
  }

  try {
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
    else boot();
  } catch (e) {}
})();
