(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};
  var KEY = 'symbiq.solverpath.v1', PFX = 'pr:';
  var TRACKS = ['q', 'o', 's'];

  function raw() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function put(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { } }
  function kvAll() { var S = W.SymbiQ.save; return (S && S.data ? S.data().kv : raw().kv) || {}; }
  function kvSet(k, v) {
    var S = W.SymbiQ.save;
    if (S && S.set) { S.set(k, v); return; }
    var d = raw(); d.kv = d.kv || {}; d.kv[k] = v; put(d);
  }

  var P = { onchange: null };
  var rulesP = null, RULES = null;

  P.award = function (id, track, points) {
    try {
      if (TRACKS.indexOf(track) < 0) return { first: false, gained: 0 };
      var pts = Math.max(0, Math.floor(+points || 0));
      var key = PFX + String(id).slice(0, 80), cur = kvAll()[key];
      var have = (cur && cur[0] === track) ? (+cur[1] || 0) : 0;
      if (pts <= have) return { first: false, gained: 0 };
      kvSet(key, [track, pts]);
      try { if (typeof P.onchange === 'function') P.onchange(); } catch (e) { }
      return { first: !have, gained: pts - have };
    } catch (e) { return { first: false, gained: 0 }; }
  };

  P.points = function () {
    var out = { q: 0, o: 0, s: 0 }, kv = kvAll();
    for (var k in kv) if (Object.prototype.hasOwnProperty.call(kv, k) && k.indexOf(PFX) === 0) {
      var v = kv[k];
      if (v && out.hasOwnProperty(v[0])) out[v[0]] += Math.max(0, Math.floor(+v[1] || 0));
    }
    return out;
  };

  P.rules = function () {
    if (rulesP) return rulesP;
    rulesP = W.fetch('data/progress-rules.json').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { RULES = j; return j; })['catch'](function () { return null; });
    return rulesP;
  };

  P.trackOfPage = function (page) {
    var p = String(page || '').split('#')[0];
    if (!RULES) return null;
    if (RULES.pages[p]) return RULES.pages[p];
    var m = /^(machinery|region)-\d\d\.html$/.exec(p);
    return m ? RULES.kinds[m[1]] : null;
  };

  P.rank = function (rules, pts) {
    pts = pts || P.points();
    var ranks = rules.ranks, top = rules.top, n = ranks.length - 1;
    var frac = {}, weakest = null;
    TRACKS.forEach(function (t) {
      var cap = rules.tracks[t].cap;
      frac[t] = cap > 0 ? Math.min(1, pts[t] / cap) : 1;
      if (weakest === null || frac[t] < frac[weakest]) weakest = t;
    });
    var k = Math.min(n, Math.floor((frac[weakest] / top) * n + 1e-9));
    var out = { k: k, d: ranks[k], frac: frac, limiting: weakest, top: k >= n, next: null };
    if (k < n) {
      var cap = rules.tracks[weakest].cap, need = Math.ceil(((k + 1) / n) * top * cap - 1e-9);
      out.next = { d: ranks[k + 1], track: weakest, have: pts[weakest], need: need };
    }
    return out;
  };

  var DAY = 86400000, STEPS = [1, 3, 7, 21];
  var CODEX_KEYS = ['golf', 'grover', 'maxcut', 'volcano', 'chsh', 'knot', 'qttt', 'machinery-complete', 'feasible-complete', 'qday-complete'];
  P.codexKeys = CODEX_KEYS.slice();
  function saved() { var S = W.SymbiQ.save; return (S && S.data) ? S.data() : raw(); }
  P.codex = function (now) {
    now = now || Date.now();
    var d = saved(), ms = d.missions || {}, kv = d.kv || {}, out = [];
    CODEX_KEYS.forEach(function (key) {
      var m = ms[key];
      if (!(m && m.complete)) return;
      var v = kv['cx:' + key], stage = (Array.isArray(v) && +v[0] > 0) ? Math.min(4, Math.floor(+v[0])) : 0;
      var base = stage ? (+v[1] || now) : (+m.at || now);
      var due = stage >= 4 ? Infinity : base + STEPS[stage] * DAY;
      out.push({ key: key, stage: stage, due: due, settled: stage >= 4, faded: stage < 4 && now > due });
    });
    return out;
  };
  P.codexReview = function (key, now) {
    try {
      now = now || Date.now();
      var cur = P.codex(now).filter(function (e) { return e.key === key; })[0];
      if (!cur || cur.stage >= 4) return cur ? cur.stage : 0;
      kvSet('cx:' + key, [cur.stage + 1, now]);
      try { if (typeof P.onchange === 'function') P.onchange(); } catch (e) { }
      return cur.stage + 1;
    } catch (e) { return 0; }
  };

  W.SymbiQ.progress = P;
})();
