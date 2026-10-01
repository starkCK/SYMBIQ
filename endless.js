(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};
  var KEY = 'symbiq_endless_v1';
  var TIERS = ['Learn', 'Play', 'Play', 'Master', 'Boss'];

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { var h = 2166136261 >>> 0, i; for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function dailySeed(cab, date) { return hash('endless-daily:' + cab + ':' + (date || today())); }
  function tierOf(i, n) { return n === TIERS.length ? TIERS[i] : (i === 0 ? 'Learn' : i === n - 1 ? 'Boss' : i === n - 2 ? 'Master' : 'Play'); }

  function load() { var s = W.SymbiQ.core && W.SymbiQ.core.store ? W.SymbiQ.core.store.getJSON(KEY, {}) : {}; return s && typeof s === 'object' ? s : {}; }
  function save(s) { if (W.SymbiQ.core && W.SymbiQ.core.store) W.SymbiQ.core.store.setJSON(KEY, s); }
  function stats(cab) { var s = load()[cab] || {}; return { streak: s.streak || 0, best: s.best || 0, played: s.played || 0, golds: s.golds || 0 }; }
  function record(cab, medal) {
    var all = load(), s = all[cab] || { streak: 0, best: 0, played: 0, golds: 0 };
    s.played++; if (medal === 'gold') { s.golds++; s.streak++; if (s.streak > s.best) s.best = s.streak; } else s.streak = 0;
    all[cab] = s; save(all); return stats(cab);
  }
  function score(medal) { return medal === 'gold' ? 3 : medal === 'silver' ? 2 : 1; }
  function dailyRecord(cab, medal) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.daily ? f.daily.record('endless:' + cab, score(medal)) : false; }
  function dailyBest(cab) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.daily ? f.daily.best('endless:' + cab) : 0; }

  function bar(mode) {
    return '<div class="en-bar" role="group" aria-label="Mode">' + [['ladder', 'The Ladder'], ['endless', 'Endless'], ['daily', 'Daily']].map(function (m) {
      return '<button type="button" class="en-b' + (mode === m[0] ? ' on' : '') + '" data-em="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + '</button>';
    }).join('') + '</div>';
  }
  function line(cab, mode, k) {
    if (mode === 'endless') { var s = stats(cab); return '<p class="en-line">Endless level <b>' + (k + 1) + '</b> &middot; gold streak <b>' + s.streak + '</b> &middot; best streak <b>' + s.best + '</b> &middot; generated from a seed and solved exhaustively before you see it. No points: only the ladder&rsquo;s medals count toward your rank.</p>'; }
    if (mode === 'daily') { var b = dailyBest(cab); return '<p class="en-line">Daily &middot; <b>' + today() + '</b> &middot; the same level for everyone today' + (b ? ' &middot; your best today <b>' + ['', 'bronze', 'silver', 'gold'][b] + '</b>' : '') + '. No points.</p>'; }
    return '';
  }

  W.SymbiQ.endless = { rng: rng, hash: hash, today: today, dailySeed: dailySeed, tierOf: tierOf, TIERS: TIERS, stats: stats, record: record, score: score, dailyRecord: dailyRecord, dailyBest: dailyBest, bar: bar, line: line, KEY: KEY };
})();
