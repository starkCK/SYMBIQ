(function () {
  var box = document.getElementById('daily-q');
  if (!box) return;
  var KEY = 'symbiq_dq_v1';
  var TIER = { g: ['<i class="dpt dpt-1" aria-hidden="true"></i>', 'Plain'], y: ['<i class="dpt dpt-2" aria-hidden="true"></i>', 'Working'], r: ['<i class="dpt dpt-3" aria-hidden="true"></i>', 'Formal'] };
  var TICK = { true: '🟩', false: '🟥' };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var esc = window.SymbiQ.core.esc;

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function daysBetween(a, b) {
    return Math.floor((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }

  function fromBank(stale) {
    return fetch('data/qbank.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (bank) {
        var pool = bank.pool || [];
        if (!pool.length) throw 0;
        var since = daysBetween(bank.anchor, todayISO());
        if (since < 0) since = 0;
        var pick = pool[((since % pool.length) + pool.length) % pool.length];
        var id = (typeof pick === 'string') ? pick : pick.id;
        var src = (typeof pick === 'string') ? 'archive' : (pick.src || 'archive');
        var path = (src === 'bank' ? 'data/qbank/' : 'data/archive/') + id + '.json';
        return fetch(path, { cache: 'no-store' })
          .then(function (r) { if (!r.ok) throw 0; return r.json(); })
          .then(function (A) {
            A.date = todayISO();
            A.qnum = ((stale && stale.qnum) || 7) + since;
            if (src === 'bank') A._fromBank = true; else A._fromArchive = true;
            return A;
          });
      })
      .catch(function () { return stale; });
  }

  fetch('data/today.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (D) {
      return (D && D.date && daysBetween(D.date, todayISO()) > 2) ? fromBank(D) : D;
    })
    .then(init)
    .catch(function () {
      document.getElementById('dq-out').innerHTML =
        '<p style="color:var(--muted)">The Question reads <code>data/today.json</code>, so it needs the site to be served (it will work on the live site; for a local preview run <code>python -m http.server 8642 --directory site</code>).</p>';
      document.getElementById('dq-hint').style.display = 'none';
    });

  function init(D) {
    var s = load(), q = D.question, done = s.history && s.history[D.date];
    var streak = s.streak || 0;
    var label = D._fromArchive
      ? '<span style="color:var(--muted)"> From the archive, the daily feed is paused</span>'
      : D._fromBank
        ? '<span style="color:var(--muted)"> From the question bank, the daily feed is paused</span>'
        : '<span style="color:var(--muted)"> Question #' + D.qnum + '</span>';
    document.getElementById('dq-meta').innerHTML =
      '<span class="tier ' + D.tier + '">' + TIER[D.tier][0] + ' ' + TIER[D.tier][1] + '</span> ' +
      label +
      (streak > 0 ? ' <span class="dq-streak">🔥 ' + streak + '-question streak</span>' : '');
    document.getElementById('dq-q').textContent = q.text;

    var opts = document.getElementById('dq-opts');
    opts.textContent = '';
    q.options.forEach(function (o, i) {
      var b = document.createElement('button');
      b.className = 'preset dq-opt';
      b.textContent = String.fromCharCode(65 + i) + '. ' + o;
      b.setAttribute('data-i', i);
      b.addEventListener('click', function () { answer(D, i); });
      opts.appendChild(b);
    });
    var hint = document.getElementById('dq-hint');
    hint.addEventListener('click', function () {
      hint.outerHTML = '<p style="color:var(--muted)"><em>Hint: ' + esc(q.hint) + '</em></p>';
    });
    if (D.lattice && D.lattice.f > 0) {
      document.getElementById('dq-lattice').innerHTML =
        'The Lattice: <strong>' + D.lattice.f.toLocaleString('en-US') + ' F</strong> of ' +
        D.lattice.goal.toLocaleString('en-US') + ' to reach code distance d=' + D.lattice.nextD +
        '.';
    }
    if (done) reveal(D, done.pick, null);
    ['dq-meta', 'dq-q', 'dq-opts'].forEach(function (i) { window.SymbiQ.pre(i, document.getElementById(i).innerHTML); });
  }

  function answer(D, pick) {
    var s = load();
    s.history = s.history || {};
    if (s.history[D.date]) return;
    var ok = pick === D.question.answerIndex;
    var grace = false;
    if (s.lastQnum == null) { s.streak = 1; }
    else {
      var gap = D.qnum - s.lastQnum;
      if (gap === 1) { s.streak = (s.streak || 0) + 1; }
      else if (gap === 2 && (s.graceQnum == null || D.qnum - s.graceQnum > 7)) {
        s.streak = (s.streak || 0) + 1; s.graceQnum = D.qnum; grace = true;
      }
      else if (gap > 1) { s.streak = 1; }
    }
    s.lastQnum = D.qnum;
    s.history[D.date] = { pick: pick, ok: ok, q: D.qnum };
    save(s);
    reveal(D, pick, grace);
  }

  function reveal(D, pick, grace) {
    var s = load(), q = D.question, ok = pick === q.answerIndex;
    Array.prototype.forEach.call(document.querySelectorAll('.dq-opt'), function (b) {
      var i = +b.getAttribute('data-i');
      b.disabled = true;
      if (i === q.answerIndex) b.className = 'preset dq-opt dq-ok';
      else if (i === pick) b.className = 'preset dq-opt dq-no';
      else b.style.opacity = '.45';
    });
    var h = document.getElementById('dq-hint'); if (h) h.style.display = 'none';
    var streak = s.streak || 1;
    var line = ok
      ? '<strong style="color:var(--teal)">Correct.</strong>'
      : '<strong style="color:var(--red)">Not this one.</strong> Wrong answers still keep your streak alive; showing up is the mechanic.';
    var gnote = grace ? ' <span style="color:var(--teal)">(error corrected ✓: one missed day repaired, fault-tolerant streaks survive a single error)</span>' : '';
    var out = document.getElementById('dq-out');
    out.innerHTML =
      '<p style="margin-top:12px">' + line + ' Coherence streak: <strong>' + streak + '</strong> day' + (streak === 1 ? '' : 's') + '.' + gnote + '</p>' +
      '<details' + ' open><summary>🟢 Why (Plain)</summary><p>' + esc(q.explain.g) + '</p></details>' +
      '<details><summary>🟡 Why (some math)</summary><p>' + esc(q.explain.y) + '</p></details>' +
      '<details><summary>🔴 Why (real math)</summary><p>' + esc(q.explain.r) + '</p></details>' +
      '<div class="dq-heat" id="dq-heat" title="Your last 12 weeks"></div>' +
      '<p style="margin-top:10px"><button class="preset" id="dq-share">Share result</button></p>';
    heat(s);
    document.getElementById('dq-share').addEventListener('click', function () { share(D, ok, streak); });
    if (grace !== null && window.SymbiQ && SymbiQ.forms && SymbiQ.forms.capture) {
      var cap = document.createElement('div');
      out.appendChild(cap);
      SymbiQ.forms.capture(cap, { context: 'question', lead: 'Keep the habit?' });
    }
  }

  function heat(s) {
    var el = document.getElementById('dq-heat'), hist = s.history || {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var html = '', wk = '<span class="w">';
    for (var i = 83; i >= 0; i--) {
      var d = new Date(today.getTime() - i * 86400000);
      var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      var c = hist[k] ? (hist[k].ok ? 'background:var(--teal)' : 'background:#8B5CF6;opacity:.6') : '';
      wk += '<i style="' + c + '" title="' + k + '"></i>';
      if (i % 7 === 0) { html += wk + '</span>'; wk = '<span class="w">'; }
    }
    el.innerHTML = html;
  }

  function share(D, ok, streak) {
    var s = load(), hist = s.history || {};
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var row = '';
    for (var i = 6; i >= 0; i--) {
      var d = new Date(today.getTime() - i * 86400000);
      var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      row += hist[k] ? TICK[hist[k].ok] : '⬛';
    }
    var txt = 'SymbiQ Daily #' + D.qnum + ' ' + TIER[D.tier][1] + ' ' + (ok ? '✅' : '❌') +
      '\nCoherence streak: ' + streak + '\n' + row + '\n' + location.origin + location.pathname;
    var btn = document.getElementById('dq-share');
    function done() { btn.textContent = 'Copied ✓'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(txt, done); });
    } else { fallback(txt, done); }
  }
  function fallback(txt, done) {
    var t = document.createElement('textarea');
    t.value = txt; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copy your result:', txt); }
    document.body.removeChild(t);
  }

  var st = document.createElement('style');
  st.textContent =
    '.dq-opt{display:block;width:100%;text-align:left;margin:6px 0}' +
    '.dq-opt:disabled{cursor:default}' +
    '.dq-ok{border-color:var(--teal)!important;box-shadow:0 0 0 1px var(--teal)}' +
    '.dq-no{border-color:var(--red)!important;opacity:.8}' +
    '#daily-q details{margin:6px 0;padding:6px 10px;border:1px solid var(--border);border-radius:8px}' +
    '#daily-q summary{cursor:pointer}' +
    '.dq-heat{display:flex;gap:3px;margin-top:12px}' +
    '.dq-heat .w{display:flex;flex-direction:column;gap:3px}' +
    '.dq-heat i{width:9px;height:9px;border-radius:2px;background:var(--border);display:block}' +
    '.dq-streak{font-weight:600;color:var(--teal)}' +
    '@media (prefers-color-scheme:light){.dq-streak{color:#0f766e}}';
  document.head.appendChild(st);
})();

(function () {
  var d = document.querySelector(".dq-prev"), host = document.getElementById("dq-archive");
  if (!d || !host) return;
  d.addEventListener("toggle", function once() {
    if (!d.open) return;
    d.removeEventListener("toggle", once);
    if (window.SymbiQ && SymbiQ.archive) SymbiQ.archive.mount(host, { limit: 5 });
  });
})();
