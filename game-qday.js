(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  function corePlan(list, cap) {
    var done = {}, out = {}, spent = {}, q = 0, guard = 0, remaining = list.slice(), i;
    list.forEach(function (a) { spent[a.id] = 0; });
    while (remaining.length && guard++ < 500) {
      q++;
      var budget = cap, ready = remaining.filter(function (a) { return a.deps.every(function (d) { return done[d]; }); }), completed = [];
      for (i = 0; i < ready.length && budget > 0; i++) {
        var a = ready[i], take = Math.min(budget, a.effort - spent[a.id]);
        spent[a.id] += take; budget -= take;
        if (spent[a.id] >= a.effort) { out[a.id] = q; completed.push(a); }
      }
      completed.forEach(function (a2) { var k = remaining.indexOf(a2); if (k >= 0) remaining.splice(k, 1); });
      Object.keys(out).forEach(function (id) { if (out[id] <= q) done[id] = true; });
      if (budget === cap && ready.length === 0 && remaining.length) break;
    }
    return { finish: out, quarters: q, stuck: remaining.map(function (a) { return a.id; }) };
  }
  function ownedIds(L) { return L.assets.filter(function (a) { return a.owned !== false; }).map(function (a) { return a.id; }); }
  function byId(L) { var m = {}; L.assets.forEach(function (a) { m[a.id] = a; }); return m; }

  function schedule(L, order) {
    var m = byId(L), list = order.map(function (id) { return m[id]; }), p = corePlan(list, L.cap), fin = {}, k;
    for (k in p.finish) fin[k] = p.finish[k];
    L.assets.forEach(function (a) { if (a.owned === false) fin[a.id] = a.vendorQ; });
    return { finish: fin, quarters: p.quarters, stuck: p.stuck };
  }
  function exposure(L, a, q) {
    var stale = 4 * Math.max(0, L.Z - a.shelf), expQ = q == null ? 0 : Math.max(0, q - stale), late = (L.deadline != null && a.reg && q != null) ? Math.max(0, q - L.deadline) : 0;
    return { expQ: expQ, late: late, loss: a.value * (expQ + late) };
  }
  function judge(L, order) {
    var s = schedule(L, order), total = 0, lostIds = [], rows = L.assets.map(function (a) {
      var q = s.finish[a.id], x = exposure(L, a, q), why = null;
      if (q == null) { x.loss = a.value * 99; why = 'never reached'; }
      else {
        var parts = [];
        if (x.expQ > 0) parts.push(x.expQ + ' quarters of recorded traffic can still be read (secret for ' + a.shelf + ' years, migrated in quarter ' + q + ', machine in ' + L.Z + ' years)');
        if (x.late > 0) parts.push('finished ' + x.late + ' quarters after the deadline');
        why = parts.join('; ') || null;
      }
      total += x.loss; if (x.loss > 0) lostIds.push(a.id);
      return { id: a.id, finish: q, year: q == null ? Infinity : q / 4, loss: x.loss, expQ: x.expQ, late: x.late, lost: x.loss > 0, why: why };
    });
    return { lost: total, lostIds: lostIds, rows: rows, finish: s.finish, quarters: s.quarters, stuck: s.stuck };
  }
  function best(L) {
    var ids = ownedIds(L), n = ids.length, c = new Array(n).fill(0), a = ids.slice(), par = Infinity, count = 0, worst = 0, order = null, total = 0;
    function visit() {
      var v = judge(L, a).lost; total++;
      if (v < par) { par = v; count = 1; order = a.slice(); } else if (v === par) count++;
      if (v > worst) worst = v;
    }
    visit();
    var i = 0;
    while (i < n) {
      if (c[i] < i) { var j = i % 2 === 0 ? 0 : c[i], t = a[j]; a[j] = a[i]; a[i] = t; visit(); c[i]++; i = 0; } else { c[i] = 0; i++; }
    }
    return { par: par, count: count, of: total, worst: worst, order: order };
  }
  function sortBy(L, key, dir) {
    var m = byId(L), ids = ownedIds(L);
    return ids.map(function (id, i) { return { id: id, i: i, k: key(m[id]) }; }).sort(function (x, y) { return (dir * (x.k - y.k)) || (x.i - y.i); }).map(function (x) { return x.id; });
  }
  function heuristics(L) {
    return {
      risk: judge(L, sortBy(L, function (a) { return a.shelf; }, -1)).lost,
      quick: judge(L, sortBy(L, function (a) { return a.effort; }, 1)).lost,
      value: judge(L, sortBy(L, function (a) { return a.value; }, -1)).lost
    };
  }
  function medalOf(lost, par) { return lost <= par ? 'gold' : lost <= par + Math.ceil(par * 0.1) ? 'silver' : 'bronze'; }

  var engine = { corePlan: corePlan, schedule: schedule, exposure: exposure, judge: judge, best: best, heuristics: heuristics, medalOf: medalOf, ownedIds: ownedIds };

  var LEVELS = [
    { id: 'startup', name: 'A twelve-person startup', cap: 3, Z: 8, par: 33,
      brief: 'Five systems and one engineer to spare. The internal CA signs what the services present, so anything behind it has to wait for it.',
      assets: [
        { id: 'ca', name: 'Internal CA', alg: 'RSA-2048', shelf: 13, effort: 2, value: 1, deps: [] },
        { id: 'svc', name: 'Customer data service', alg: 'ECDH P-256', shelf: 15, effort: 4, value: 4, deps: ['ca'] },
        { id: 'sign', name: 'Release signing', alg: 'RSA-3072', shelf: 12, effort: 6, value: 4, deps: ['ca'] },
        { id: 'web', name: 'Marketing site TLS', alg: 'ECDSA P-256', shelf: 4, effort: 3, value: 3, deps: [] },
        { id: 'api', name: 'Partner API tokens', alg: 'RSA-2048', shelf: 7, effort: 3, value: 4, deps: [] }
      ] },
    { id: 'hospital', name: 'A regional hospital', cap: 5, Z: 9, par: 32,
      brief: 'Imaging archives and patient records outlive almost everything else on the network, and the device fleet cannot be touched until the CA is.',
      assets: [
        { id: 'ca', name: 'Internal CA', alg: 'RSA-2048', shelf: 11, effort: 3, value: 1, deps: [] },
        { id: 'dev', name: 'Device fleet certificates', alg: 'ECDSA P-256', shelf: 12, effort: 7, value: 3, deps: ['ca'] },
        { id: 'ehr', name: 'Patient records link', alg: 'RSA-2048', shelf: 21, effort: 6, value: 5, deps: [] },
        { id: 'pacs', name: 'Imaging archive', alg: 'RSA-3072', shelf: 18, effort: 4, value: 4, deps: [] },
        { id: 'portal', name: 'Patient portal', alg: 'ECDSA P-256', shelf: 2, effort: 2, value: 3, deps: [] },
        { id: 'vpn', name: 'Clinic VPN', alg: 'RSA-2048', shelf: 8, effort: 1, value: 3, deps: [] }
      ] },
    { id: 'bank', name: 'A mid-size bank', cap: 3, Z: 9, par: 56,
      brief: 'Card data lives for years and payments messaging for longer. The open-banking API belongs to a vendor, who migrates it in their own quarter.',
      assets: [
        { id: 'ca', name: 'Internal CA', alg: 'RSA-2048', shelf: 10, effort: 3, value: 2, deps: [] },
        { id: 'mtls', name: 'Service mesh mTLS', alg: 'ECDSA P-256', shelf: 9, effort: 3, value: 3, deps: ['ca'] },
        { id: 'mob', name: 'Mobile app channel', alg: 'ECDSA P-256', shelf: 9, effort: 3, value: 4, deps: ['ca'] },
        { id: 'swift', name: 'Payments messaging link', alg: 'RSA-2048', shelf: 13, effort: 3, value: 4, deps: [] },
        { id: 'vpn', name: 'Branch VPN', alg: 'RSA-2048', shelf: 3, effort: 2, value: 3, deps: [] },
        { id: 'card', name: 'Card vault', alg: 'RSA-3072', shelf: 15, effort: 6, value: 4, deps: ['ca'] },
        { id: 'api', name: 'Open-banking API (vendor)', alg: 'ECDSA P-256', shelf: 3, effort: 4, value: 3, deps: [], owned: false, vendorQ: 10 }
      ] },
    { id: 'agency', name: 'A federal agency', cap: 4, Z: 11, deadline: 12, par: 15,
      brief: 'Three systems are regulated and must be finished by the deadline. The cloud tenant is the vendor&rsquo;s to migrate, and the signing service gates two others.',
      assets: [
        { id: 'ca', name: 'Internal CA', alg: 'RSA-2048', shelf: 16, effort: 3, value: 2, deps: [] },
        { id: 'sign', name: 'Signing service', alg: 'RSA-3072', shelf: 9, effort: 2, value: 5, deps: ['ca'], reg: true },
        { id: 'fleet', name: 'Device fleet', alg: 'ECDSA P-256', shelf: 10, effort: 5, value: 3, deps: ['sign'], reg: true },
        { id: 'mtls', name: 'Service mesh mTLS', alg: 'ECDSA P-256', shelf: 7, effort: 6, value: 2, deps: ['ca'], reg: true },
        { id: 'vpn', name: 'Staff VPN', alg: 'RSA-2048', shelf: 5, effort: 1, value: 2, deps: [] },
        { id: 'mail', name: 'Signed mail', alg: 'RSA-2048', shelf: 5, effort: 4, value: 3, deps: ['sign'] },
        { id: 'db', name: 'Records database link', alg: 'RSA-3072', shelf: 23, effort: 5, value: 5, deps: [] },
        { id: 'cloud', name: 'Cloud tenant (vendor)', alg: 'ECDSA P-256', shelf: 8, effort: 0, value: 3, deps: [], owned: false, vendorQ: 8 }
      ] }
  ];
  engine.LEVELS = LEVELS;

  var def = {
    id: 'qday', title: 'Q-Day Command', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'A harvest-now-decrypt-later adversary has been recording you for years. Decide what gets migrated first, before the date.',
    about: {
      goal: 'Set the order in which your systems migrate to post-quantum cryptography so that as little value as possible is still secret and still unmigrated when the machine arrives.',
      how: 'Reorder the systems with the arrows, then <strong>run the migration</strong>. Each quarter your team spends its capacity on the systems at the top that are ready; a system that needs another one (the certificate authority gates what it signs) waits for it.',
      inspired: 'Mosca&rsquo;s inequality (X + Y &gt; Z), and the migration dates in Executive Order 14412, CNSA 2.0 and the EU coordinated roadmap, as laid out on the post-quantum page.',
      learn: 'Why the order matters as much as the budget, why the system that holds no secrets can be the one to do first, and why no simple rule (riskiest first, easiest first, most valuable first) is the answer.',
      link: 'pqc.html', linkText: 'The Sequencer, with your own estate ▸', tier: 'Proven',
      or: 'Choosing an order under capacity and precedence is a scheduling problem, an operations-research one'
    },
    honest: 'Honest model: the rule is Mosca&rsquo;s inequality applied to each system (an asset is lost when how long its data must stay secret plus when the migration reached it is more than the scenario&rsquo;s planning date), and the schedule is the one the Sequencer on the post-quantum page uses (capacity per quarter, precedence, a priority list), cross-checked against that code. The date is a scenario&rsquo;s stated assumption, not a forecast. Effort in whole units per quarter is a planning fiction, vendors finish on their own clock, and AES-256 is not migration work. Each level&rsquo;s par is the best over every possible order, all of them tried.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, order = [], ran = false;
    var KEY = 'qday';
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'qdc';
    root.appendChild(wrap);

    function ladderState() { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.ladder ? f.ladder.state(KEY) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function resume() { var st = ladderState(), r = 0; for (var i = 1; i <= LEVELS.length; i++) if (st.cleared[i]) r = Math.min(i, LEVELS.length - 1); return r; }

    function head(L) {
      var m = byId(L), pars = L.par;
      return '<div class="qd-strip" role="list" aria-label="The four organisations">' + LEVELS.map(function (l, i) {
        var st = ladderState(), med = st.medal[i + 1], glyph = med ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[med] : (unlocked(i + 1) ? (i + 1) : '🔒');
        return '<button type="button" role="listitem" class="qd-chip' + (i === lvl ? ' now' : '') + '" data-lv="' + i + '"' + (unlocked(i + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(i + 1) ? '' : ', locked') + '">' + glyph + ' ' + esc(l.name) + '</button>';
      }).join('') + '</div>' +
        '<p class="qd-brief">' + L.brief + '</p>' +
        '<p class="qd-facts"><b>Capacity</b> ' + L.cap + ' units of effort a quarter &middot; <b>The date</b> the machine arrives in <b>' + L.Z + ' years</b> (a stated assumption)' +
        (L.deadline != null ? ' &middot; <b>The deadline</b> regulated systems must finish by quarter ' + L.deadline : '') + ' &middot; <b>Par</b> ' + pars + ' exposure (proven best)</p>';
    }
    function rowHTML(L, id, i, res) {
      var a = byId(L)[id], r = res && res.rows.filter(function (x) { return x.id === id; })[0];
      var deps = a.deps.length ? ' &middot; needs <b>' + a.deps.map(function (d) { return esc(byId(L)[d].name); }).join(', ') + '</b> first' : '';
      var cls = 'qd-row' + (r ? (r.lost ? ' lost' : ' safe') : '');
      return '<li class="' + cls + '" data-id="' + id + '"><span class="qd-n" aria-hidden="true">' + (i + 1) + '</span><div class="qd-b"><b>' + esc(a.name) + '</b> <span class="qd-alg">' + esc(a.alg) + '</span>' +
        '<p class="qd-m">secret for <b>' + a.shelf + '</b> years &middot; effort <b>' + a.effort + '</b> &middot; value <b>' + a.value + '</b>' + deps + '</p>' +
        (r ? '<p class="qd-r">' + (r.lost ? '<b>Lost.</b> ' + esc(r.why) : '<b>Safe.</b> migrated by quarter ' + r.finish + ' (year ' + (r.finish / 4) + '): ' + a.shelf + ' + ' + (r.finish / 4) + ' is not more than ' + L.Z) + '</p>' : '') + '</div>' +
        (ran ? '' : '<span class="qd-mv"><button type="button" class="preset" data-up="' + i + '" aria-label="Move ' + esc(a.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
         '<button type="button" class="preset" data-dn="' + i + '" aria-label="Move ' + esc(a.name) + ' down"' + (i === order.length - 1 ? ' disabled' : '') + '>&darr;</button></span>') + '</li>';
    }
    function vendorsHTML(L, res) {
      return L.assets.filter(function (a) { return a.owned === false; }).map(function (a) {
        var r = res && res.rows.filter(function (x) { return x.id === a.id; })[0];
        return '<li class="qd-row vendor' + (r ? (r.lost ? ' lost' : ' safe') : '') + '"><span class="qd-n" aria-hidden="true">&middot;</span><div class="qd-b"><b>' + esc(a.name) + '</b> <span class="qd-alg">' + esc(a.alg) + ' &middot; vendor</span>' +
          '<p class="qd-m">secret for <b>' + a.shelf + '</b> years &middot; value <b>' + a.value + '</b> &middot; the vendor migrates it in quarter <b>' + a.vendorQ + '</b>, on their clock and not yours</p>' +
          (r ? '<p class="qd-r">' + (r.lost ? '<b>Lost.</b> ' + esc(r.why) : '<b>Safe.</b>') + '</p>' : '') + '</div></li>';
      }).join('');
    }
    function paint(res) {
      var L = LEVELS[lvl];
      var html = head(L) + '<ol class="qd-list">' + order.map(function (id, i) { return rowHTML(L, id, i, res); }).join('') + vendorsHTML(L, res) + '</ol>';
      if (L.decoy) html += '<p class="qd-decoy"><b>Not on the list:</b> ' + L.decoy + '</p>';
      html += '<div class="qd-act">' + (ran
        ? '<button type="button" class="preset" data-a="again">Try another order</button>' + (lvl < LEVELS.length - 1 ? ' <button type="button" class="preset" data-a="next"' + (unlocked(lvl + 2) ? '' : ' disabled') + '>Next organisation</button>' : '')
        : '<button type="button" class="preset qd-run" data-a="run">Run the migration</button> <button type="button" class="preset" data-a="reset">Reset the order</button>') + '</div>' +
        '<p class="qd-say" role="status" aria-live="polite">' + (res ? sayResult(L, res) : 'Reorder the systems, then run the migration. The first one gets the capacity first, among those that are ready.') + '</p>';
      wrap.innerHTML = html;
    }
    function sayResult(L, res) {
      var med = medalOf(res.lost, L.par), glyph = { gold: '🥇', silver: '🥈', bronze: '🥉' }[med];
      return '<strong>' + res.lost + ' exposure' + (res.lost === L.par ? ': the par, the best any order can do.' : ' against a par of ' + L.par + '.') + '</strong> ' + glyph + ' ' + med +
        (res.lost === L.par ? '' : ' No simple rule finds it: try putting first the system that unlocks others.') + ' The migration finished in ' + res.quarters + ' quarters.';
    }
    function start(n) { lvl = n; order = ownedIds(LEVELS[lvl]); ran = false; paint(null); }
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      var L = LEVELS[lvl], i;
      if (b.hasAttribute('data-lv')) { var n2 = +b.getAttribute('data-lv'); if (unlocked(n2 + 1)) start(n2); return; }
      if (b.hasAttribute('data-up') && !ran) { i = +b.getAttribute('data-up'); if (i > 0) { var t = order[i]; order[i] = order[i - 1]; order[i - 1] = t; paint(null); var nb = wrap.querySelector('[data-up="' + (i - 1) + '"]') || wrap.querySelector('[data-dn="' + (i - 1) + '"]'); if (nb) nb.focus(); } return; }
      if (b.hasAttribute('data-dn') && !ran) { i = +b.getAttribute('data-dn'); if (i < order.length - 1) { var t2 = order[i]; order[i] = order[i + 1]; order[i + 1] = t2; paint(null); var nb2 = wrap.querySelector('[data-dn="' + (i + 1) + '"]') || wrap.querySelector('[data-up="' + (i + 1) + '"]'); if (nb2) nb2.focus(); } return; }
      var a = b.getAttribute('data-a');
      if (a === 'reset') { order = ownedIds(L); paint(null); }
      else if (a === 'run') {
        var res = judge(L, order); ran = true;
        var med = medalOf(res.lost, L.par);
        try { var f = W.SymbiQ.games && W.SymbiQ.games.frame; if (f && f.ladder) f.ladder.markCleared(KEY, lvl + 1, med); } catch (x) { }
        paint(res);
      }
      else if (a === 'again') { ran = false; paint(null); }
      else if (a === 'next') { start(lvl + 1); }
    });
    start(resume());
    return { state: function () { return { lvl: lvl, order: order.slice(), ran: ran }; },
             setOrder: function (o) { order = o.slice(); paint(null); }, run: function () { wrap.querySelector('[data-a="run"]').click(); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.qday = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
