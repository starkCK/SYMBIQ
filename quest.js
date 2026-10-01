(function () {
  'use strict';
  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};
  var KEY = 'symbiq.solverpath.v1';

  function raw() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function put(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } }
  function saved() { var S = W.SymbiQ.save; return (S && S.data) ? S.data() : raw(); }
  function kvSet(k, v) { var S = W.SymbiQ.save; if (S && S.set) { S.set(k, v); return; } var d = raw(); d.kv = d.kv || {}; d.kv[k] = v; put(d); }
  function answeredBitcoin() { return !!((saved().kv || {})['pr:cyu:bitcoin.html:0']); }
  function staked() {
    try { var s = JSON.parse(localStorage.getItem('symbiq_standing_v1')); return !!(s && s.predictions && Object.keys(s.predictions).length); } catch (e) { return false; }
  }
  var esc = W.SymbiQ.core.esc;

  var QUESTS = {
    qday: {
      name: 'Q-Day', codex: 'qday-complete',
      blurb: 'Four steps from the headline to a forecast of your own. Any order.',
      steps: [
        { id: 'read', label: 'Answer the Bitcoin page’s check question', href: 'bitcoin.html', test: answeredBitcoin },
        { id: 'shor', label: 'Find a period yourself in the Shor explorer', href: 'machinery-13.html#try' },
        { id: 'check', label: 'Run the Quick Check on a certificate or a domain', href: 'pqc.html#quickcheck' },
        { id: 'stake', label: 'Put a forecast on a Ledger claim', href: 'standing.html', test: staked }
      ]
    }
  };

  var Q = { onchange: null };

  function isDone(qid, s) {
    if (s.test) return !!s.test();
    return !!(saved().kv || {})['qd:' + qid + ':' + s.id];
  }
  function settle(qid) {
    var q = QUESTS[qid], d = saved(), m = (d.missions || {})[q.codex];
    if (m && m.complete) return;
    if (!q.steps.every(function (s) { return isDone(qid, s); })) return;
    var S = W.SymbiQ.save;
    if (S && S.completeMission) S.completeMission(q.codex, { via: 'quest' });
    else { var r = raw(); r.missions = r.missions || {}; r.missions[q.codex] = { complete: true, at: Date.now(), via: 'quest' }; put(r); }
    try { if (typeof Q.onchange === 'function') Q.onchange(); } catch (e) { }
  }

  Q.step = function (qid, id) {
    try {
      var q = QUESTS[qid], s = q && q.steps.filter(function (x) { return x.id === id && !x.test; })[0];
      if (!s) return false;
      var had = !!(saved().kv || {})['qd:' + qid + ':' + id];
      if (!had) kvSet('qd:' + qid + ':' + id, Date.now());
      settle(qid);
      try { if (typeof Q.onchange === 'function') Q.onchange(); } catch (e) { }
      return !had;
    } catch (e) { return false; }
  };

  Q.state = function (qid) {
    var q = QUESTS[qid];
    if (!q) return null;
    settle(qid);
    var steps = q.steps.map(function (s) { return { id: s.id, label: s.label, href: s.href, done: isDone(qid, s) }; });
    var done = steps.filter(function (s) { return s.done; }).length, m = (saved().missions || {})[q.codex];
    return { name: q.name, blurb: q.blurb, steps: steps, done: done, total: steps.length, complete: !!(m && m.complete) };
  };

  Q.mount = function (el) {
    var qid = el.getAttribute('data-quest'), st = Q.state(qid);
    if (!st) return;
    el.innerHTML = '<section class="quest" aria-label="Quest: ' + esc(st.name) + '"><p class="quest-k">Quest</p><h2 class="quest-h">' + esc(st.name) +
      '</h2><p class="quest-b">' + esc(st.blurb) + ' <span class="quest-n">' + st.done + ' of ' + st.total + '</span></p><ol class="quest-steps">' +
      st.steps.map(function (s) {
        return '<li class="' + (s.done ? 'is-done' : '') + '"><span class="quest-ck" aria-hidden="true">' + (s.done ? '✓' : '○') + '</span><a href="' + esc(s.href) + '">' + esc(s.label) + '</a>' +
          '<span class="sr">' + (s.done ? ' (done)' : ' (not yet)') + '</span></li>';
      }).join('') + '</ol>' +
      (st.complete ? '<p class="quest-done">Done. A Codex entry unlocked: <a href="journey.html#codex">see it on The Solver’s Path</a>.</p>' : '') + '</section>';
  };

  W.SymbiQ.quest = Q;
  function mountAll() { [].slice.call(D.querySelectorAll('[data-quest]')).forEach(Q.mount); }
  Q.onchange = function () { mountAll(); };
  (function () { var P = W.SymbiQ.progress; if (!P) return; var prev = P.onchange; P.onchange = function () { try { if (typeof prev === 'function') prev.apply(this, arguments); } finally { mountAll(); } }; })();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', mountAll); else mountAll();
})();
