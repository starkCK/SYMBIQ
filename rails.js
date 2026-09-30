(function () {
  'use strict';

  var D = document;
  var W = window;

  var MQ = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  var NEXT = {
    'index.html':           ['journey.html',          'The story, end to end',      'Six acts, from the first qubit to the consequence'],
    'basics.html':          ['circuits.html',         'What a qubit is made of',    'The circuit underneath everything you just read'],
    'circuits.html':        ['quantum-mechanics.html','Mechanics vs computing',     'Same laws, a different question'],
    'quantum-mechanics.html':['qec.html',             'What keeps it alive',        'Error correction, and the door AI walked in through'],
    'qec.html':             ['logical-qubit.html',    'What a logical qubit is',    'Why a thousand physical qubits buy you one'],
    'logical-qubit.html':   ['phase-kickback.html',   'Why the algorithms work',    'One mechanism underneath four of them'],
    'phase-kickback.html':  ['ai.html',               'Will quantum boost AI?',     'Four routes, ranked honestly'],
    'ai.html':              ['bitcoin.html',          'Can it break Bitcoin?',      'The numbers, not the panic'],
    'bitcoin.html':         ['pqc.html',              'Check your own systems',     'Post-quantum exposure, on your estate'],
    'compare.html':         ['analog.html',           'The fork in the road',       'Coupled circuits instead of one'],
    'analog.html':          ['feasible.html',         'The Feasible Region',        'The field every optimisation headline is about'],
    'feasible.html':        ['play.html',             'Play it instead',            'Nine games where the maths does the judging'],
    'formalism.html':       ['play.html',             'Play it instead',            'Nine games where the maths does the judging'],
    'pqc.html':             ['race.html',             'Who is actually ahead',      'The race, without the press releases'],
    'play.html':            ['journey.html',          'The story, end to end',      'Six acts, from the first qubit to the consequence'],
    'journey.html':         ['play.html',             'The games themselves',       'Where the score cannot be faked'],
    'race.html':            ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'frontier.html':        ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'ledger.html':          ['corrections.html',      'Corrections',                'What we got wrong, and when'],
    'corrections.html':     ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'signals.html':         ['archive.html',          'The archive',                'Everything asked and answered so far'],
    'archive.html':         ['signals.html',          'Desk notes',                 'Dated notes from the desk on what moved, and why it matters']
  };

  var RUNGS = [
    { id: 'L0', label: 'the circuit',              href: 'circuits.html' },
    { id: 'L1', label: 'the qubit',                href: 'quantum-mechanics.html' },
    { id: 'L2', label: 'what makes it survive',    href: 'qec.html' },
    { id: 'L3', label: 'the algorithm',            href: 'phase-kickback.html' },
    { id: 'L4', label: 'the consequence',          href: 'pqc.html' }
  ];
  var FORK = { label: 'coupled circuits instead', href: 'analog.html' };

  var built = false;
  var left = null, right = null;
  var items = [], heads = [], spineFill = null, topBtn = null;
  var stateBox = null, stateShown = false;
  var ticking = false;

  function el(tag, cls, txt) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function forkMark() {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = D.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('width', '11');
    svg.setAttribute('height', '11');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var stem = D.createElementNS(NS, 'path');
    stem.setAttribute('d', 'M3.5 1.5v9');
    var branch = D.createElementNS(NS, 'path');
    branch.setAttribute('d', 'M3.5 6.75h3l2-2.5');
    svg.appendChild(stem);
    svg.appendChild(branch);
    return svg;
  }

  function page() {
    var p = location.pathname.split('/').pop();
    return p ? p : 'index.html';
  }

  function readJSON(k) {
    try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; }
  }


  function labelFor(h) {
    var t = '';
    var first = h.firstElementChild;
    if (first && h.childNodes.length > 1) {
      var d = W.getComputedStyle(first).display;
      if (d === 'block' || d === 'flex' || d === 'grid') t = first.textContent;
    }
    if (!t) t = h.textContent;
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  function buildIndex(col) {
    var all = [].slice.call(D.querySelectorAll('h2')).filter(function (h) {
      if (h.closest('.sqrail, nav, footer')) return false;
      return h.getClientRects().length > 0;
    });
    if (all.length < 3) return false;

    var wrapN = el('div', 'sqrail-mod');
    wrapN.appendChild(el('div', 'sqrail-lab', 'On this page'));

    var nav = el('nav', 'sqrail-idx');
    nav.setAttribute('aria-label', 'Sections on this page');

    all.forEach(function (h, i) {
      if (!h.id) h.id = 'sqs-' + i;
      var lab = labelFor(h);
      var full = (h.textContent || '').replace(/\s+/g, ' ').trim();
      var a = el('a', 'sqrail-item');
      a.href = '#' + h.id;
      a.title = (full !== lab && full.indexOf(lab) === 0)
        ? lab + ', ' + full.slice(lab.length).trim()
        : full;
      a.appendChild(el('span', 'sqrail-dot'));
      a.appendChild(el('span', 'sqrail-txt', lab));
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var reduce = window.SymbiQ.core.reduced();
        var y = h.getBoundingClientRect().top + W.pageYOffset - 88;
        W.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
        if (history.replaceState) history.replaceState(null, '', '#' + h.id);
      });
      nav.appendChild(a);
      items.push(a);
      heads.push(h);
    });

    wrapN.appendChild(nav);
    col.appendChild(wrapN);
    return true;
  }

  function buildTop(col) {
    topBtn = el('button', 'sqrail-top', '↑ Top');
    topBtn.type = 'button';
    topBtn.addEventListener('click', function () {
      var reduce = window.SymbiQ.core.reduced();
      W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    col.appendChild(topBtn);
  }


  function buildLadder(col) {
    var rung = D.body.getAttribute('data-rung');
    var isFork = (rung === 'FORK');
    var onLadder = !!rung;

    var mod = el('div', 'sqrail-mod');
    mod.appendChild(el('div', 'sqrail-lab', 'The Ladder'));

    var nav = el('nav', 'sqrail-ladder');
    nav.setAttribute('aria-label', onLadder
      ? "Where this page sits on SymbiQ's ladder, from the circuit to the consequence"
      : "SymbiQ's ladder, from the circuit to the consequence");

    RUNGS.forEach(function (r) {
      var cur = (!isFork && r.id === rung);
      var a = el('a', 'sqrail-rung' + (cur ? ' is-cur' : ''));
      a.href = r.href;
      if (cur) a.setAttribute('aria-current', 'page');
      var id = el('span', 'sqrail-id', r.id);
      id.setAttribute('aria-hidden', 'true');
      a.appendChild(id);
      a.appendChild(el('span', null, r.label));
      nav.appendChild(a);
    });

    var f = el('a', 'sqrail-fork' + (isFork ? ' is-cur' : ''));
    f.href = FORK.href;
    if (isFork) f.setAttribute('aria-current', 'page');
    f.appendChild(forkMark());
    f.appendChild(el('span', null, FORK.label));
    nav.appendChild(f);

    mod.appendChild(nav);
    col.appendChild(mod);
    if (onLadder) D.documentElement.classList.add('sq-vrung');
  }

  function meter(href, label, done, total) {
    var a = el('a', 'sqrail-meter');
    a.href = href;
    var top = el('div', 'sqrail-mtop');
    top.appendChild(el('span', null, label));
    top.appendChild(el('span', 'sqrail-mnum', done + '/' + total));
    a.appendChild(top);
    var bar = el('div', 'sqrail-bar');
    var i = el('i');
    i.style.setProperty('--sq-p', total ? (done / total) : 0);
    bar.appendChild(i);
    a.appendChild(bar);
    return a;
  }

  function buildProgress(col) {
    if (page() === 'index.html') return;

    var ACTS = ['grover', 'golf', 'maxcut', 'volcano', 'chsh', 'knot'];
    var FORMALISM_TOPICS = 20;
    var FEASIBLE_TOPICS = 24;

    var sp = readJSON('symbiq.solverpath.v1') || {};
    var pq = readJSON('symbiq.pqc.v1') || {};
    var kv = sp.kv || {};
    var missions = sp.missions || {};

    var acts = 0;
    ACTS.forEach(function (m) { if (missions[m] && missions[m].complete) acts++; });
    var form = (kv['curriculum.formalism'] || []).length;
    var feas = (kv['curriculum.feasible'] || []).length;
    var pqcStarted = !!(pq && (pq.assets || pq.estate || pq.estateText || pq.cbomText));

    if (!acts && !form && !feas && !pqcStarted) return;

    var mod = el('div', 'sqrail-mod');
    mod.appendChild(el('div', 'sqrail-lab', 'Your progress'));
    var box = el('div', 'sqrail-prog');
    if (acts) box.appendChild(meter('play.html', 'Acts cleared', acts, ACTS.length));
    if (form) box.appendChild(meter('formalism.html', 'The Machinery', form, FORMALISM_TOPICS));
    if (feas) box.appendChild(meter('feasible.html', 'Feasible Region', feas, FEASIBLE_TOPICS));
    if (pqcStarted) {
      var a = el('a', 'sqrail-meter');
      a.href = 'pqc.html';
      var t = el('div', 'sqrail-mtop');
      t.appendChild(el('span', null, 'Your estate'));
      t.appendChild(el('span', 'sqrail-mnum', 'saved'));
      a.appendChild(t);
      box.appendChild(a);
    }
    mod.appendChild(box);
    col.appendChild(mod);
  }

  function buildNext(col) {
    var n = NEXT[page()];
    if (!n) return;
    var mod = el('div', 'sqrail-mod');
    var a = el('a', 'sqrail-next');
    a.href = n[0];
    a.appendChild(el('b', null, n[1] + ' →'));
    a.appendChild(el('span', null, n[2]));
    mod.appendChild(a);
    col.appendChild(mod);
  }

  function buildState(col) {
    if (!(W.SymbiQ && W.SymbiQ.qubit && W.SymbiQ.qubit.state)) return;

    stateBox = el('div', 'sqrail-state sqrail-mod');
    stateBox.hidden = true;
    col.appendChild(stateBox);

    function read() {
      try { return W.SymbiQ.qubit.state(); } catch (e) { return null; }
    }
    function paint() {
      var s = read();
      if (!s) return;
      var moved = (s.p1 > 0.0001) || (s.net && s.net !== 'I');
      if (!moved && !stateShown) return;
      if (!stateShown) {
        stateShown = true;
        stateBox.hidden = false;
      }
      var pct = Math.round(s.p1 * 100);
      var dl = stateBox.querySelector('dl');
      if (!dl) { dl = D.createElement('dl'); stateBox.appendChild(dl); }
      dl.innerHTML = '';
      function row(k, v, cls) {
        dl.appendChild(el('dt', null, k));
        dl.appendChild(el('dd', cls || null, v));
      }
      row('measured |1⟩', pct + '%');
      row('phase', Math.round(s.phase) + '°');
      row('net', s.net || 'I', 'sqrail-ket');
    }

    D.addEventListener('keydown', function () { setTimeout(paint, 0); });
    paint();
  }


  function onScroll() {
    if (ticking) return;
    ticking = true;
    W.requestAnimationFrame(function () {
      ticking = false;
      try {
        var y = W.pageYOffset;
        var max = D.documentElement.scrollHeight - W.innerHeight;
        var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
        if (spineFill) spineFill.style.setProperty('--sq-read', p);
        if (topBtn) topBtn.classList.toggle('is-on', y > W.innerHeight * 1.5);

        var cur = -1;
        for (var i = 0; i < heads.length; i++) {
          if (heads[i].getBoundingClientRect().top <= 120) cur = i; else break;
        }
        for (var j = 0; j < items.length; j++) {
          items[j].classList.toggle('is-cur', j === cur);
          items[j].classList.toggle('is-done', j < cur);
          if (j === cur) items[j].setAttribute('aria-current', 'true');
          else items[j].removeAttribute('aria-current');
        }
      } catch (e) { }
    });
  }


  function build() {
    if (built) return;
    built = true;

    left = el('div', 'sqrail sqrail-l');
    var lc = el('div', 'sqrail-col');
    left.appendChild(lc);
    var spine = el('div', 'sqrail-spine');
    spine.setAttribute('aria-hidden', 'true');
    left.appendChild(spine);
    spineFill = spine;

    right = el('div', 'sqrail sqrail-r');
    var rc = el('div', 'sqrail-col');
    right.appendChild(rc);

    var haveIndex = false;
    try { haveIndex = buildIndex(lc) === true; } catch (e) { }
    try { buildLadder(haveIndex ? rc : lc); } catch (e) { }
    try { buildTop(lc); } catch (e) { }
    try { buildProgress(rc); } catch (e) { }
    try { buildNext(rc); } catch (e) { }
    try { buildState(rc); } catch (e) { }

    if (lc.children.length) D.body.appendChild(left); else left = null;
    if (rc.children.length) D.body.appendChild(right); else right = null;

    W.addEventListener('scroll', onScroll, { passive: true });
    W.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  function destroy() {
    if (!built) return;
    built = false;
    W.removeEventListener('scroll', onScroll);
    W.removeEventListener('resize', onScroll);
    if (left && left.parentNode) left.parentNode.removeChild(left);
    if (right && right.parentNode) right.parentNode.removeChild(right);
    D.documentElement.classList.remove('sq-vrung');
    left = right = spineFill = topBtn = stateBox = null;
    items = []; heads = []; stateShown = false;
  }

  function sync() {
    if (MQ && MQ.matches) build(); else destroy();
  }

  var syncTimer = null;
  function syncSoon() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 150);
  }

  function boot() {
    try {
      if (!D.body || !D.body.hasAttribute('data-rails')) return;
      if (!MQ) return;
      sync();
      if (MQ.addEventListener) MQ.addEventListener('change', sync);
      else if (MQ.addListener) MQ.addListener(sync);
      W.addEventListener('resize', syncSoon, { passive: true });
    } catch (e) { }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
