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
  var _tracks = null;
  function tracksData() {
    if (!_tracks) _tracks = window.fetch('data/tracks.json').then(function (r) { return r.ok ? r.json() : null; })['catch'](function () { return null; });
    return _tracks;
  }
  function hasPoints() {
    try { var P = window.SymbiQ.progress, t = P && P.points(); return !!(t && (t.q + t.o + t.s)); } catch (e) { return false; }
  }
  function nextStep(td, letter) {
    var tr = td && td.tracks && td.tracks[letter], seen = {};
    try { seen = JSON.parse(localStorage.getItem('sq-seen')) || {}; } catch (e) { seen = {}; }
    if (!tr) return null;
    var open = tr.modules.filter(function (m) { return !seen[m.p]; });
    for (var i = 0; i < open.length; i++) {
      if (open[i].after.every(function (a) { return seen[a]; })) return { href: open[i].p, label: open[i].t, track: tr.name, hub: tr.hub };
    }
    return open[0] ? { href: open[0].p, label: open[0].t, track: tr.name, hub: tr.hub } : { href: tr.hub, label: 'Open the ' + tr.name + ' map', track: tr.name, hub: tr.hub };
  }
  function richen(host) {
    var P = window.SymbiQ.progress;
    if (!P || !P.rules) return;
    Promise.all([P.rules(), tracksData()]).then(function (r) {
      var rules = r[0], td = r[1];
      if (!rules || !host.isConnected) return;
      var rk = P.rank(rules, P.points()), dl = host.querySelector('.you-rows');
      if (!dl) { dl = document.createElement('dl'); dl.className = 'you-rows'; host.insertBefore(dl, host.firstChild); }
      dl.querySelectorAll('[data-rank]').forEach(function (n) { n.parentNode.removeChild(n); });
      var html = '<dt data-rank>Rank</dt><dd data-rank>d' + rk.d + '</dd>';
      var step = rk.top ? null : nextStep(td, rk.limiting);
      if (step) html += '<dt data-rank>Next step</dt><dd data-rank><a href="' + esc(step.href) + '">' + esc(step.label) + '</a></dd>';
      dl.insertAdjacentHTML('afterbegin', html);
      var sub = host.querySelector('[data-rank-note]');
      if (sub && sub.parentNode) sub.parentNode.removeChild(sub);
      var note = rk.top ? 'Top rank: d' + rk.d + '.'
        : 'd' + rk.next.d + ' needs ' + Math.max(0, rk.next.need - rk.next.have) + ' more point' + (rk.next.need - rk.next.have === 1 ? '' : 's') +
          ' in ' + esc(rules.tracks[rk.limiting].name) + ', your weakest track. Points come from correct checks and games finished at or near par.';
      host.insertAdjacentHTML('beforeend', '<p class="sub" data-rank-note style="margin:6px 0 0">' + note + '</p>');
      var any = rk.frac.q + rk.frac.o + rk.frac.s > 0, old = host.querySelector('[data-share-rank]');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      if (any) {
        host.insertAdjacentHTML('beforeend', '<p data-share-rank style="margin:8px 0 0"><button type="button" class="preset" data-share="rank">Share my rank</button></p>');
        host.querySelector('[data-share="rank"]').addEventListener('click', function () { shareRank(rules, P.rank(rules, P.points())); });
      }
    })['catch'](function () {});
  }

  function fadedNote() {
    try {
      var P = window.SymbiQ.progress, n = P && P.codex ? P.codex().filter(function (e) { return e.faded; }).length : 0;
      return n ? ', ' + n + ' faded: <a href="journey.html#codex">review</a>' : '';
    } catch (e) { return ''; }
  }

  function fillYou(host, p, ci) {
    var medals = medalCount();
    var live = !!(ci && ci.streak > 0 && !ci.lapsed);
    var pts = hasPoints();
    if (!p.seen && !medals && !live && !pts) return;
    var rows = (p.seen || medals) ?
      '<dt>Coherence</dt><dd>' + p.coh + '%</dd>' +
      '<dt>Path</dt><dd>' + p.done + ' of ' + p.total + ' missions' + '</dd>' +
      '<dt>Codex</dt><dd>' + p.codex + ' fragment' + (p.codex === 1 ? '' : 's') + fadedNote() + '</dd>' +
      '<dt>Medals</dt><dd>' + medals + '</dd>' : '';
    if (live) {
      rows += '<dt>Contract</dt><dd>' + ci.streak + '-day streak' + (ci.doneToday ? ', today cleared' : ', today open') + '</dd>';
    }
    var where = p.next ? p.next.act + ' awaits in ' + p.next.place : (p.done ? 'The Path is complete' : '');
    host.innerHTML = '<dl class="you-rows">' + rows + '</dl>' +
      (where ? '<p class="sub" style="margin:8px 0 0">' + esc(where) + '. Saved in this browser only.</p>'
             : '<p class="sub" style="margin:8px 0 0">Saved in this browser only.</p>');
    richen(host);
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

  var SITE_URL = 'https://starkck.github.io/SYMBIQ/';
  function drawCard(c, spec) {
    var x = c.getContext('2d'), W = c.width, H = c.height, g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(1, '#1a1f3d');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#2dd4bf'; x.fillRect(0, 0, 14, H);
    var font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#2dd4bf'; x.font = '700 30px ' + font; x.fillText(String(spec.kicker || '').toUpperCase(), 70, 90);
    x.fillStyle = '#ffffff'; x.font = '800 150px ' + font; x.fillText(String(spec.big || ''), 66, 250);
    x.fillStyle = '#c9d2e6'; x.font = '500 34px ' + font;
    var sub = String(spec.sub || ''), words = sub.split(' '), line = '', y = 310, lines = 0;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (x.measureText(t).width > 1000 && line) { x.fillText(line, 70, y); y += 44; line = words[i]; if (++lines > 2) break; } else line = t;
    }
    if (line && lines <= 2) x.fillText(line, 70, y);
    var rows = spec.rows || [], ry = 435;
    rows.forEach(function (r) {
      x.fillStyle = '#e8edf8'; x.font = '600 30px ' + font; x.fillText(r.label, 70, ry);
      for (var k = 0; k < 10; k++) {
        x.fillStyle = k < Math.round(Math.max(0, Math.min(1, r.frac)) * 10) ? '#2dd4bf' : 'rgba(255,255,255,.14)';
        x.fillRect(430 + k * 52, ry - 26, 44, 30);
      }
      x.fillStyle = '#9aa8c4'; x.font = '500 26px ' + font; x.fillText(r.note || '', 970, ry);
      ry += 54;
    });
    x.fillStyle = '#9aa8c4'; x.font = '500 26px ' + font; x.fillText(String(spec.foot || ''), 70, H - 40);
    x.textAlign = 'right'; x.fillStyle = '#ffffff'; x.font = '700 30px ' + font; x.fillText('SymbiQ', W - 60, H - 40); x.textAlign = 'left';
  }
  function shareCard(spec) {
    var dlg = document.createElement('dialog');
    dlg.className = 'sq-share';
    dlg.setAttribute('aria-label', 'Share');
    dlg.innerHTML = '<form method="dialog" class="sq-share-in"><h2>Share</h2>' +
      '<canvas width="1200" height="630" role="img"></canvas><p class="sq-share-msg" role="status" aria-live="polite"></p>' +
      '<div class="sq-share-act"><button type="button" class="preset" data-a="dl">Download image</button>' +
      '<button type="button" class="preset" data-a="copy">Copy text</button><button class="preset" value="close">Close</button></div></form>';
    document.body.appendChild(dlg);
    var cv = dlg.querySelector('canvas'), msg = dlg.querySelector('.sq-share-msg');
    cv.setAttribute('aria-label', spec.alt || spec.text || 'A SymbiQ share card');
    drawCard(cv, spec);
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-a]');
      if (!b) return;
      if (b.getAttribute('data-a') === 'dl') {
        cv.toBlob(function (blob) {
          if (!blob) { msg.textContent = 'Could not make the image in this browser. Use Copy text instead.'; return; }
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = spec.filename || 'symbiq.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
          msg.textContent = 'Image saved.';
        }, 'image/png');
      } else {
        var ok = function () { msg.textContent = 'Copied.'; }, manual = function () { window.prompt('Copy this and send it:', spec.text); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(spec.text).then(ok, manual); else manual();
      }
    });
    dlg.addEventListener('close', function () { if (dlg.parentNode) dlg.parentNode.removeChild(dlg); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    return dlg;
  }
  function grid(frac) { var n = Math.round(Math.max(0, Math.min(1, frac)) * 10), s = ''; for (var i = 0; i < 10; i++) s += i < n ? '🟩' : '⬛'; return s; }
  function shareRank(rules, rk) {
    var names = { q: rules.tracks.q.name, o: rules.tracks.o.name, s: rules.tracks.s.name };
    var rows = ['q', 'o', 's'].map(function (t) { return { label: names[t], frac: rk.frac[t], note: Math.round(rk.frac[t] * 100) + '%' }; });
    var pad = 14, text = 'SymbiQ rank d' + rk.d + ' (code distance)\n' + rows.map(function (r) { return (r.label + '              ').slice(0, pad + 8) + grid(r.frac); }).join('\n') + '\n' + SITE_URL;
    return shareCard({ kicker: 'Rank, by code distance', big: 'd' + rk.d, sub: 'Earned only by correct checks and games finished at or near par, in all three tracks.',
      rows: rows, foot: new Date().toISOString().slice(0, 10), text: text, filename: 'symbiq-rank-d' + rk.d + '.png',
      alt: 'SymbiQ rank d' + rk.d + '. ' + rows.map(function (r) { return r.label + ' ' + r.note; }).join('; ') });
  }
  function shareBadge(name, tier, sub) {
    var text = 'SymbiQ Codex: ' + name + (tier ? ' (' + tier + ')' : '') + '\n' + SITE_URL + 'journey.html';
    return shareCard({ kicker: 'Codex entry earned', big: '✦', sub: name + (sub ? '. ' + sub : ''), rows: [], foot: tier || '', text: text,
      filename: 'symbiq-codex-' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png', alt: 'Codex entry earned: ' + name });
  }
  function dailyText() {
    var today = new Date().toISOString().slice(0, 10), cab = [['golf', 'Golf'], ['grover', 'Grover'], ['maxcut', 'Max-Cut'], ['volcano', 'Volcano'], ['calibration', 'Calibration']];
    var c = {}, d = {};
    try { c = JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { c = {}; }
    try { d = JSON.parse(localStorage.getItem('symbiq_daily_v1')) || {}; } catch (e) { d = {}; }
    var contractDone = !!(c.history && c.history[today] && c.history[today].done), cells = [contractDone ? '✅' : '⬜'];
    cab.forEach(function (k) { var r = d[k[0]]; cells.push(r && r.date === today && r.best > 0 ? '🟩' : '⬛'); });
    var live = c.streak > 0 && c.lastDate && (Date.parse(today) - Date.parse(c.lastDate)) / 86400000 <= 2;
    return { today: today, cells: cells, streak: live ? c.streak : 0, labels: ['Contract'].concat(cab.map(function (k) { return k[1]; })),
      text: 'SymbiQ daily ' + today + (live ? ' 🔥' + c.streak : '') + '\n' + cells.join(' ') + '\nContract · ' + cab.map(function (k) { return k[1]; }).join(' · ') + '\n' + SITE_URL + 'play.html#contract-card' };
  }
  function shareDaily() {
    var t = dailyText(), played = t.cells.filter(function (x) { return x === '✅' || x === '🟩'; }).length;
    return shareCard({ kicker: 'Daily, ' + t.today, big: played + ' of ' + t.cells.length, sub: (t.streak ? t.streak + '-day streak. ' : '') + 'The contract and the five endless modes, today’s seeded run.',
      rows: t.cells.map(function (x, i) { return { label: t.labels[i], frac: (x === '✅' || x === '🟩') ? 1 : 0, note: (x === '✅' || x === '🟩') ? 'done' : '' }; }).slice(0, 3),
      foot: t.today, text: t.text, filename: 'symbiq-daily-' + t.today + '.png', alt: 'SymbiQ daily ' + t.today + ': ' + played + ' of ' + t.cells.length });
  }

  window.SymbiQ.hud = { refresh: render, progress: progress, contract: contractInfo, acts: ACTS, share: shareCard, shareRank: shareRank, shareBadge: shareBadge, shareDaily: shareDaily, dailyText: dailyText };

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  } catch (e) { }
})();
