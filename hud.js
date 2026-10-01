(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};

  var STORE = 'symbiq.solverpath.v1';
  var COH_KEY = 'coherence.v1';
  var COH_BASE = 55;
  var CKEY = 'symbiq_contract_v1';

  var ACTS = [
    { id: 'golf',    act: 'Act I',   place: 'The Quantum Realm' },
    { id: 'grover',  act: 'Act II',  place: 'The Locked Corridor' },
    { id: 'maxcut',  act: 'Act III', place: 'Graph City' },
    { id: 'volcano', act: 'Act IV',  place: 'The Volcano' },
    { id: 'chsh',    act: 'Act V',   place: 'The Shore of Twins' },
    { id: 'knot',    act: 'Act VI',  place: 'The Knot' }
  ];

  function progress() {
    var d = {};
    var S = window.SymbiQ.save;
    if (S && typeof S.data === 'function') {
      try { d = S.data() || {}; } catch (e) { d = {}; }
    } else {
      try { d = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { d = {}; }
    }

    var missions = d.missions || {}, kv = d.kv || {};
    var done = 0, next = null;
    for (var i = 0; i < ACTS.length; i++) {
      if (missions[ACTS[i].id] && missions[ACTS[i].id].complete) done++;
      else if (!next) next = ACTS[i];
    }

    var raw = kv[COH_KEY];
    var coh = (raw === undefined || raw === null || isNaN(raw))
      ? COH_BASE : Math.max(0, Math.min(100, Math.round(raw)));

    var codex = 0;
    try { codex = Object.keys(d.codex || {}).length; } catch (e) {}

    return {
      done: done,
      total: ACTS.length,
      next: next,
      codex: codex,
      coh: coh,
      seen: done > 0 || codex > 0 || !!d.avatar || raw !== undefined
    };
  }

  function level(v) { return v < 15 ? 'static' : v < 40 ? 'low' : v < 75 ? 'mid' : 'high'; }

  function contractInfo() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { c = {}; }
    var last = c.lastDate || null, streak = c.streak || 0;
    var today = new Date().toISOString().slice(0, 10);
    var gap = last
      ? Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(last + 'T00:00:00Z')) / 86400000)
      : null;
    var hist = (c.history && c.history[today]) || null;
    return {
      streak: streak,
      doneToday: !!(hist && hist.done) || gap === 0,
      gap: gap,
      lapsed: gap !== null && gap >= 3,
      active: streak > 0 || !!last
    };
  }

  var esc = window.SymbiQ.core.esc;

  function chipHTML(p, ci) {
    var where = p.next
      ? p.next.act + ' awaits, ' + p.next.place
      : 'The Path is complete';
    var title = 'Coherence ' + p.coh + '% · ' + p.done + ' of ' + p.total +
                ' missions cleared · ' + p.codex + ' codex fragment' +
                (p.codex === 1 ? '' : 's') + '. ' + where + '.';
    if (ci && ci.streak > 0 && !ci.lapsed) {
      title += ' 🔥 ' + ci.streak + '-day Contract streak' +
               (ci.doneToday ? ' (today cleared).' : ', today still open.');
    }
    return '<a class="hud-chip" href="journey.html" title="' + esc(title) + '"' +
             ' style="--hud-p:' + p.coh + '%" data-level="' + level(p.coh) + '">' +
             '<b class="hud-num" aria-hidden="true">' + p.done + '/' + p.total + '</b>' +
             '<span class="hud-sr">' + esc(title) + '</span>' +
           '</a>';
  }

  function medalCount() {
    var n = 0, s = {};
    try { s = JSON.parse(localStorage.getItem('symbiq_ladder_v1')) || {}; } catch (e) { s = {}; }
    Object.keys(s).forEach(function (id) {
      var m = (s[id] && s[id].medal) || {};
      Object.keys(m).forEach(function (k) { if (m[k]) n++; });
    });
    return n;
  }
  function fillYou(host, p, ci) {
    var medals = medalCount();
    var live = !!(ci && ci.streak > 0 && !ci.lapsed);
    if (!p.seen && !medals && !live) return;
    var rows = (p.seen || medals) ?
      '<dt>Coherence</dt><dd>' + p.coh + '%</dd>' +
      '<dt>Path</dt><dd>' + p.done + ' of ' + p.total + ' missions' + '</dd>' +
      '<dt>Codex</dt><dd>' + p.codex + ' fragment' + (p.codex === 1 ? '' : 's') + '</dd>' +
      '<dt>Medals</dt><dd>' + medals + '</dd>' : '';
    if (live) {
      rows += '<dt>Contract</dt><dd>' + ci.streak + '-day streak' + (ci.doneToday ? ', today cleared' : ', today open') + '</dd>';
    }
    var where = p.next ? p.next.act + ' awaits in ' + p.next.place : (p.done ? 'The Path is complete' : '');
    host.innerHTML = '<dl class="you-rows">' + rows + '</dl>' +
      (where ? '<p class="sub" style="margin:8px 0 0">' + esc(where) + '. Saved in this browser only.</p>'
             : '<p class="sub" style="margin:8px 0 0">Saved in this browser only.</p>');
  }

  function mountChip(p, ci) {
    var you = document.querySelector('.you-progress');
    if (you) { fillYou(you, p, ci); return; }
    var nav = document.querySelector('nav');
    if (!nav) return;
    var host = nav.querySelector('.hud-slot');

    if (!p.seen) {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    if (!host) {
      host = document.createElement('span');
      host.className = 'hud-slot';
      var account = nav.querySelector('.sq-account');
      if (account) nav.insertBefore(host, account);
      else nav.appendChild(host);
    }
    host.innerHTML = chipHTML(p, ci);
  }

  function mountReturn(p) {
    if (!document.body.hasAttribute('data-hud-return')) return;
    var old = document.querySelector('.hud-return');

    if (!p.seen) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }

    var tagline = document.querySelector('h1 + .tagline') || document.querySelector('.tagline');
    if (!tagline) return;

    var bits = [];
    bits.push('<b>' + p.done + ' of ' + p.total + '</b> missions cleared');
    if (p.next) bits.push('<b>' + esc(p.next.act) + '</b> awaits in ' + esc(p.next.place));
    else bits.push('the Path is <b>complete</b>');

    var card = old || document.createElement('p');
    card.className = 'hud-return';
    card.innerHTML = '<span class="hud-return-lab">Welcome back.</span> ' +
                     bits.join(' <span class="hud-dot">·</span> ') +
                     ' <a class="hud-return-go" href="' + (p.next ? 'journey.html' : 'play.html') + '">' +
                     (p.next ? 'Resume the Path' : 'Into the Arcade') + ' &#9656;</a>';
    if (!old) tagline.parentNode.insertBefore(card, tagline.nextSibling);
  }

  function mountContract(ci) {
    if (!document.body.hasAttribute('data-hud-return')) return;
    var old = document.querySelector('.hud-contract');

    if (!ci.active) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }

    var anchor = document.querySelector('.hud-return') ||
                 document.querySelector('h1 + .tagline') || document.querySelector('.tagline');
    if (!anchor) return;

    var body;
    if (ci.doneToday) {
      body = '<span class="hud-c-ok">✓</span> today’s Contract cleared' +
             (ci.streak > 1 ? ' <span class="hud-dot">·</span> 🔥 <b>' + ci.streak + '</b>-day streak' : '');
    } else if (ci.lapsed) {
      body = 'today’s Contract is live <span class="hud-dot">·</span> your <b>' + ci.streak +
             '</b>-day streak lapsed, start a new one';
    } else {
      body = 'today’s Contract is live' +
             (ci.streak > 0
               ? ' <span class="hud-dot">·</span> 🔥 <b>' + ci.streak + '</b>-day streak on the line'
               : '');
    }
    var go = ci.doneToday ? 'Open the Arcade' : 'Take it';

    var card = old || document.createElement('p');
    card.className = 'hud-contract';
    card.innerHTML = '<span class="hud-c-lab">Contract of the Day</span> ' + body +
                     ' <a class="hud-return-go" href="play.html">' + go + ' &#9656;</a>';
    if (!old) anchor.parentNode.insertBefore(card, anchor.nextSibling);
  }

  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    var soon = window.requestAnimationFrame
      ? function (fn) { window.requestAnimationFrame(fn); }
      : function (fn) { window.setTimeout(fn, 16); };
    soon(function () {
      pending = false;
      try {
        var p = progress();
        var ci = contractInfo();
        mountChip(p, ci);
        mountReturn(p);
        mountContract(ci);
      } catch (e) { }
    });
  }

  function start() {
    render();

    try {
      var S = window.SymbiQ.save;
      if (S && !S._hudChained) {
        var prev = S.onchange;
        S.onchange = function () {
          if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) {} }
          render();
        };
        S._hudChained = true;
      }
    } catch (e) {}

    try {
      window.addEventListener('storage', function (e) {
        if (!e || e.key === null || e.key === STORE || e.key === CKEY) render();
      });
      window.addEventListener('pageshow', render);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) render();
      });
    } catch (e) {}
  }

  window.SymbiQ.hud = { refresh: render, progress: progress, contract: contractInfo, acts: ACTS };

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  } catch (e) { }
})();
