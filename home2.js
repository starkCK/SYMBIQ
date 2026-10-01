(function () {
  'use strict';
  var D = document, W = window;
  var root = D.querySelector('[data-home]');
  if (!root) return;

  function $(s, r) { return (r || D).querySelector(s); }
  function all(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var esc = window.SymbiQ.core.esc;

  var h1 = $('#hero-h');
  try {
    var lines = JSON.parse(h1.getAttribute('data-taglines'));
    if (Array.isArray(lines) && lines.length) h1.textContent = lines[Math.floor(Math.random() * lines.length)];
  } catch (e) { }

  var JOURNEY = {
    learn:    { name: 'Learn: Quantum × AI', go: ['basics.html', 'Start the first lesson'], more: [['inside.html', 'See inside the machine'], ['glossary.html', 'Look up a term']] },
    see:      { name: 'See inside the machine', go: ['inside.html', 'Open the 3D machine'], more: [['qec.html', 'How the errors are fixed'], ['basics.html', 'Start the first lesson']] },
    play:     { name: 'Play', go: ['playhub.html', 'Open the games'], more: [['playhub.html#daily-q', 'Today\'s question'], ['play.html', 'The Arcade']] },
    check:    { name: 'Check', go: ['check.html', 'See what is being checked'], more: [['ledger.html', 'The claim ledger'], ['reality.html', 'Reality Check cards']] },
    secure:   { name: 'Secure', go: ['secure.html', 'Is your encryption ready?'], more: [['pqc.html#quickcheck', 'Run the quick check'], ['bitcoin.html', 'Can quantum break Bitcoin?']] },
    optimise: { name: 'Learn: Optimisation', go: ['analog.html', 'Start with analog optimisation'], more: [['region-02.html', 'The first course topic'], ['region-05.html', 'A harder one']] }
  };
  var DEPTH = { g: 'Plain', y: 'Working', r: 'Formal' };
  var quiz = $('#hh-quiz'), findBtn = $('#hh-find'), out = $('#hh-quiz-out');
  function openQuiz() {
    quiz.hidden = false;
    findBtn.setAttribute('aria-expanded', 'true');
  }
  if (quiz && findBtn) {
    findBtn.addEventListener('click', function () {
      if (quiz.hidden) openQuiz(); else { quiz.hidden = true; findBtn.setAttribute('aria-expanded', 'false'); }
    });
    var link = $('#hh-quiz-link');
    if (link) link.addEventListener('click', function () {
      openQuiz();
      if (quiz.scrollIntoView) quiz.scrollIntoView({ block: 'center' });
      var first = $('input', quiz); if (first) first.focus();
    });
    quiz.addEventListener('submit', function (ev) {
      ev.preventDefault();
      function v(n) { var c = quiz.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : ''; }
      var goal = v('goal') || 'learn', maths = v('maths') || 'g';
      var j = JOURNEY[goal] || JOURNEY.learn;
      var lead = j.go[0] + (j.go[0].indexOf('#') < 0 ? '#depth=' + maths : '');
      out.innerHTML = 'Your first stop: <b>' + esc(j.name) + '</b> at <b>' + DEPTH[maths] + '</b> depth. <a href="' + lead + '">' + esc(j.go[1]) + '</a>' +
        '<span class="hh-more">Then: ' + j.more.map(function (m) { return '<a href="' + m[0] + '">' + esc(m[1]) + '</a>'; }).join(' &middot; ') + '</span>';
      if (W.SymbiQ && SymbiQ.depth && SymbiQ.depth.set) {
        if (maths === 'g') SymbiQ.depth.set('light'); else if (maths === 'r') SymbiQ.depth.set('deep');
      }
      var a = $('a', out); if (a) a.focus();
    });
  }

  var take = $('#hh-take'), fig = $('#hh-machine');
  if (take && fig) {
    take.addEventListener('click', function () {
      var f = D.createElement('iframe');
      f.src = 'inside.html?embed=1';
      f.title = 'The 3D quantum computer. Drag to turn it; the tabs open each level.';
      f.setAttribute('allow', '');
      take.parentNode.replaceChild(f, take);
      var p = D.createElement('p');
      p.className = 'hh-open';
      p.innerHTML = '<a href="inside.html">Open the full page, with the parts listed ▸</a>';
      fig.appendChild(p);
      f.focus();
    });
  }

  var last = read('sq-last'), seen = read('sq-seen') || {};
  var returning = !!(last && last.u) || Object.keys(seen).length > 0;
  function depthKey() {
    var p = (W.SymbiQ && SymbiQ.depth && SymbiQ.depth.get) ? SymbiQ.depth.get() : null;
    return p === 'light' ? 'g' : p === 'deep' ? 'r' : 'y';
  }
  function setVerdict(v) {
    if (!v) return;
    var d = new Date(v.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    var a = $('#hh-back-verdict');
    if (a) { a.href = 'claim-' + v.slug + '.html'; a.textContent = 'Next verdict: ' + v.claimant + ', by ' + d; }
  }
  fetch('data/home.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data) return;
    var dk = depthKey();
    all('.track').forEach(function (card) {
      var t = (data.tracks || []).filter(function (x) { return x.id === card.getAttribute('data-track'); })[0];
      if (!t) return;
      var n = t.chips.filter(function (c) { return seen[c.page]; }).length;
      var ring = $('.t-ring', card);
      if (ring && n > 0) {
        ring.style.setProperty('--p', Math.round(100 * n / t.chips.length) + '%');
        ring.innerHTML = '<span>' + n + '/' + t.chips.length + '</span>';
        ring.setAttribute('role', 'img');
        ring.setAttribute('aria-label', n + ' of ' + t.chips.length + ' modules opened');
        ring.hidden = false;
      }
    });
    if (returning) {
      var cont = $('#hh-continue'), title = $('#hh-continue-t'), meta = $('#hh-continue-m');
      if (last && last.u && /^[\w.-]+\.html$/.test(last.u)) {
        cont.href = last.u;
        title.textContent = last.t || last.u;
        var tr = (data.tracks || []).filter(function (x) { return x.chips.some(function (c) { return c.page === last.u; }); })[0];
        if (tr) {
          var done = tr.chips.filter(function (c) { return seen[c.page]; }).length;
          var left = tr.chips.filter(function (c) { return !seen[c.page]; }).reduce(function (a, c) { return a + (c.min[dk] || 0); }, 0);
          meta.textContent = tr.name + ': ' + done + ' of ' + tr.chips.length + ' modules opened' + (left ? ', about ' + left + ' min left' : ', all done');
        }
      }
      setVerdict(data.next_verdict);
    }
  }).catch(function () { });

  if (returning) {
    root.classList.add('is-returning');
    var back = $('#hh-back');
    if (back) back.hidden = false;
  }
  ['noise', 'decoder'].forEach(function (m) {
    var b = $('#hp-' + m);
    if (b) b.addEventListener('click', function () { if (typeof W.SymbiQ.play === 'function') W.SymbiQ.play(m); });
  });
})();
