/* SymbiQ — leaderboard.js: the daily arcade leaderboard (Scorekeeper Part 4 / B4).
 *
 * B3 gave every endless cabinet a Daily mode seeded from the date, so everyone
 * faces the identical generated run today. This submits a signed-in player's
 * daily bests to `daily_scores` and paints "Today's leaderboard" on the Arcade.
 *
 * GATED, and honest about it: like auth.js this is pure progressive
 * enhancement. It does nothing at all unless
 *   - SymbiQ.auth.client exists (a real Supabase client — needs the back end
 *     Chinmoy has not stood up yet: schema.sql unrun, no completed sign-in), AND
 *   - a user is signed in, AND
 *   - SymbiQ.games.frame.daily is present (games.js loaded).
 * With none of that, `#leaderboard` stays `hidden` and no request is made.
 *
 * Scores are self-reported client numbers. The schema comment says it and so
 * does this: a friendly board, never an input to a badge, tier or certificate.
 *
 * API: window.SymbiQ.leaderboard = { refresh() }
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var GAMES = ['golf', 'grover', 'maxcut', 'volcano', 'calibration'];
  var TITLES = {
    golf: 'Circuit Golf', grover: "Grover's Escape", maxcut: 'Max-Cut',
    volcano: 'The Annealing Volcano', calibration: 'The Calibration'
  };
  var UNITS = {
    golf: 'holes', grover: 'corridors', maxcut: 'cities',
    volcano: 'descents', calibration: 'shifts'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function daily() {
    try { return window.SymbiQ.games && SymbiQ.games.frame && SymbiQ.games.frame.daily; }
    catch (e) { return null; }
  }
  function host() { return document.getElementById('leaderboard'); }

  var submitTimer = null, lastSig = '';

  // Push today's daily bests. Append-only insert; the board reduces to max.
  // Debounced and deduplicated so a burst of save changes costs one round trip
  // and an unchanged score is never re-sent.
  function submitScores(client, userId) {
    var D = daily();
    if (!D || !client || !userId) return;
    var all = {};
    try { all = D.todayAll() || {}; } catch (e) { all = {}; }
    var rows = [];
    GAMES.forEach(function (g) {
      var s = all[g];
      if (typeof s === 'number' && s > 0) rows.push({ user_id: userId, game: g, day: D.date(), score: s });
    });
    if (!rows.length) return;
    var sig = JSON.stringify(rows);
    if (sig === lastSig) return;
    lastSig = sig;
    Promise.resolve(client.from('daily_scores').insert(rows))
      .then(function () { fetchBoard(client); })
      .catch(function (e) { try { console.warn('SymbiQ leaderboard: submit failed', e); } catch (e2) {} });
  }

  function scheduleSubmit(client, userId) {
    if (submitTimer) clearTimeout(submitTimer);
    submitTimer = setTimeout(function () { submitTimer = null; submitScores(client, userId); }, 1500);
  }

  function fetchBoard(client) {
    if (!client) return;
    Promise.resolve(
      client.from('daily_leaderboard').select('game,handle,symbiont_no,best').order('best', { ascending: false })
    ).then(function (res) {
      if (!res || res.error) throw (res && res.error) || new Error('no data');
      render(res.data || []);
    }).catch(function (e) {
      try { console.warn('SymbiQ leaderboard: fetch failed', e); } catch (e2) {}
    });
  }

  function render(rows) {
    var h = host();
    if (!h) return;
    var D = daily();
    var byGame = {};
    GAMES.forEach(function (g) { byGame[g] = []; });
    rows.forEach(function (r) { if (byGame[r.game]) byGame[r.game].push(r); });

    var any = GAMES.some(function (g) { return byGame[g].length; });
    if (!any) {
      h.innerHTML = '<div class="lb-head"><span class="lb-tag">Today’s leaderboard</span>' +
        '<span class="lb-date">' + esc(D && D.date()) + '</span></div>' +
        '<p class="lb-empty">No daily runs logged yet. Play a <strong>Daily</strong> mode in any cabinet — your best is submitted automatically.</p>';
      h.hidden = false;
      return;
    }

    var cols = GAMES.filter(function (g) { return byGame[g].length; }).map(function (g) {
      var top = byGame[g].slice(0, 5).map(function (r, i) {
        var who = r.handle || ('Symbiont #' + (r.symbiont_no || '?'));
        return '<li><span class="lb-rank">' + (i + 1) + '</span>' +
          '<span class="lb-who">' + esc(who) + '</span>' +
          '<span class="lb-score">' + esc(r.best) + '</span></li>';
      }).join('');
      return '<div class="lb-col"><h4>' + esc(TITLES[g]) + '</h4>' +
        '<ol class="lb-list">' + top + '</ol>' +
        '<p class="lb-unit">' + esc(UNITS[g]) + ' cleared</p></div>';
    }).join('');

    h.innerHTML =
      '<div class="lb-head"><span class="lb-tag">Today’s leaderboard</span>' +
      '<span class="lb-date">' + esc(D && D.date()) + '</span></div>' +
      '<div class="lb-grid">' + cols + '</div>' +
      '<p class="lb-foot">Everyone plays the same date-seeded run. Self-reported scores — a friendly board, nothing more.</p>';
    h.hidden = false;
  }

  var wired = false;
  function wire() {
    if (wired) return;
    wired = true;

    function onAuth(ev) {
      var user = ev && ev.detail && ev.detail.user;
      var client = window.SymbiQ.auth && window.SymbiQ.auth.client;
      if (!client || !user) {
        var h = host(); if (h) { h.hidden = true; h.innerHTML = ''; }
        lastSig = '';
        return;
      }
      submitScores(client, user.id);
      fetchBoard(client);

      // A new daily best (save.js fires onchange) -> resubmit, debounced.
      try {
        var S = window.SymbiQ.save;
        if (S && !S._lbChained) {
          var prev = S.onchange;
          S.onchange = function () {
            if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) {} }
            var u = window.SymbiQ.auth && window.SymbiQ.auth.getUser && window.SymbiQ.auth.getUser();
            if (u) scheduleSubmit(client, u.id);
          };
          S._lbChained = true;
        }
      } catch (e) {}
    }

    window.addEventListener('symbiq:authchange', onAuth);
    // If auth.js already resolved before we wired, catch the current state.
    try {
      var u = window.SymbiQ.auth && window.SymbiQ.auth.getUser && window.SymbiQ.auth.getUser();
      if (u) onAuth({ detail: { user: u } });
    } catch (e) {}
  }

  window.SymbiQ.leaderboard = {
    refresh: function () {
      var client = window.SymbiQ.auth && window.SymbiQ.auth.client;
      if (client) fetchBoard(client);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
