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

  W.SymbiQ.progress = P;
})();
