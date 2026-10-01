(function () {
  try {
    var cats = [].slice.call(document.querySelectorAll('.navcat'));
    var navtrig = document.getElementById('navtrig');
    var navcats = document.getElementById('navcats');

    cats.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        cats.forEach(function (o) { if (o !== d) o.open = false; });
      });
    });

    function closeAll() { cats.forEach(function (d) { d.open = false; }); }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('nav')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      closeAll();
      if (navcats && navcats.classList.contains('open')) {
        navcats.classList.remove('open');
        if (navtrig) { navtrig.setAttribute('aria-expanded', 'false'); navtrig.focus(); }
      }
    });

    if (navtrig && navcats) {
      navtrig.addEventListener('click', function () {
        var open = navcats.classList.toggle('open');
        navtrig.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) closeAll();
      });
      navcats.addEventListener('click', function (e) {
        if (e.target.closest('a')) { navcats.classList.remove('open'); navtrig.setAttribute('aria-expanded', 'false'); }
      });
    }
  } catch (err) { }
})();

(function () {
  try {
    var reduce = window.SymbiQ.core.reduced();
    var targets = [].slice.call(document.querySelectorAll(
        'h2, .card, .grid, table, .formula, .cabs, .gate, .introute, .spine, footer'))
      .filter(function (el) {
        return !el.closest('nav') && !el.closest('.lattice') &&
               !(el.parentElement && el.parentElement.closest('.card'));
      });
    if (!targets.length) return;

    function show(el) { el.classList.add('in'); }

    if (reduce || !('IntersectionObserver' in window)) return;
    targets.forEach(function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });

    requestAnimationFrame(function () {
      targets.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.95) show(el);
      });
    });
    setTimeout(function () { targets.forEach(show); }, 2500);
  } catch (err) {
    [].slice.call(document.querySelectorAll('.reveal')).forEach(function (el) { el.classList.add('in'); });
  }
})();

(function () {
  function openTo(hash) {
    try {
      var id = String(hash || '').replace(/^#/, '');
      if (!id) return;
      var t = document.getElementById(id);
      if (!t) return;
      var opened = false, n = t;
      while (n && n !== document.body) {
        if (n.tagName === 'DETAILS' && !n.open) { n.open = true; opened = true; }
        n = n.parentElement;
      }
      if (opened) {
        var go = function () { t.scrollIntoView({ block: 'start', behavior: 'auto' }); };
        requestAnimationFrame(function () { requestAnimationFrame(go); });
        if (document.readyState !== 'complete') {
          window.addEventListener('load', function () { setTimeout(go, 0); }, { once: true });
        }
      }
    } catch (e) {}
  }
  openTo(location.hash);
  window.addEventListener('hashchange', function () { openTo(location.hash); });
})();
;
(function () {
  'use strict';
  var D = document;
  var core = (window.SymbiQ && window.SymbiQ.core) || {};
  var store = core.store;
  var KEY = 'sq-last';

  function all(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  function one(s, r) { return (r || D).querySelector(s); }

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }

  try {
    var nav = one('nav');
    if (!nav || !one('.navtabs', nav)) return;

    var groups = all('.navtab, .nav-you', nav).map(function (host) {
      return {
        host: host,
        btn: one('.navtab-arrow, .you-btn', host),
        panel: one('.navpanel2', host),
        hoverable: host.classList.contains('navtab'),
        timer: 0
      };
    }).filter(function (g) { return g.btn && g.panel; });

    function setOpen(g, open) {
      clearTimeout(g.timer);
      g.panel.hidden = !open;
      g.btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) g.host.setAttribute('data-open', ''); else g.host.removeAttribute('data-open');
    }
    function closeAll(except) {
      groups.forEach(function (g) { if (g !== except && !g.panel.hidden) setOpen(g, false); });
    }
    function open(g) { closeAll(g); setOpen(g, true); }

    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 720px)');

    groups.forEach(function (g) {
      g.btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (g.panel.hidden) open(g); else setOpen(g, false);
      });
      g.btn.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          open(g);
          var first = one('a', g.panel);
          if (first) first.focus();
        }
      });
      if (g.hoverable) {
        g.host.addEventListener('mouseenter', function () {
          if (!fine || !fine.matches) return;
          clearTimeout(g.timer);
          g.timer = setTimeout(function () { open(g); }, 110);
        });
        g.host.addEventListener('mouseleave', function () {
          if (!fine || !fine.matches) return;
          clearTimeout(g.timer);
          g.timer = setTimeout(function () { setOpen(g, false); }, 220);
        });
      }
      g.panel.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        var links = all('a', g.panel), i = links.indexOf(D.activeElement);
        if (i < 0) return;
        e.preventDefault();
        var n = e.key === 'ArrowDown' ? Math.min(links.length - 1, i + 1) : Math.max(0, i - 1);
        links[n].focus();
      });
    });

    D.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('nav')) closeAll();
    });
    D.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var openOne = groups.filter(function (g) { return !g.panel.hidden; })[0];
      if (!openOne) return;
      setOpen(openOne, false);
      openOne.btn.focus();
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.navpanel2 a')) closeAll();
    });

    var page = (location.pathname.split('/').pop() || 'index.html');
    var here = one('.navtab-link.cur', nav);
    var saved = read();
    if (here) {
      var title = (D.title || '').split(' · ')[0];
      write({ u: page, t: title, at: Date.now() });
    }
    if (page !== 'index.html') {
      var seenMap = {};
      try { seenMap = JSON.parse(localStorage.getItem('sq-seen')) || {}; } catch (e) { seenMap = {}; }
      seenMap[page] = Date.now();
      var keys = Object.keys(seenMap);
      if (keys.length > 300) {
        keys.sort(function (a, b) { return seenMap[a] - seenMap[b]; });
        keys.slice(0, keys.length - 300).forEach(function (k) { delete seenMap[k]; });
      }
      try { localStorage.setItem('sq-seen', JSON.stringify(seenMap)); } catch (e) {}
    }
    var cont = one('.nav-continue', nav);
    if (cont && saved && saved.u && saved.u !== page && /^[\w.-]+\.html$/.test(saved.u)) {
      cont.href = saved.u;
      cont.hidden = false;
      cont.setAttribute('aria-label', 'Continue: ' + (saved.t || saved.u));
      cont.title = 'Back to ' + (saved.t || saved.u);
    }
  } catch (err) { }
})();
;
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var KEY = 'symbiq.depth.v1';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function store(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
  }

  function get() {
    var d = load();
    return (d.pref === 'light' || d.pref === 'deep') ? d.pref : null;
  }
  function set(pref) {
    if (pref !== 'light' && pref !== 'deep') return;
    var d = load();
    d.pref = pref;
    d.setAt = Date.now();
    store(d);
  }

  window.SymbiQ.depth = { get: get, set: set };
})();
;
(function () {
  'use strict';

  var TIERS = ['g', 'y', 'r'];
  var META = {
    g: { chip: '<i class="dpt dpt-1" aria-hidden="true"></i>', name: 'Plain',     blurb: 'One analogy. No equations.' },
    y: { chip: '<i class="dpt dpt-2" aria-hidden="true"></i>', name: 'Working',   blurb: 'Mechanism, and a worked number.' },
    r: { chip: '<i class="dpt dpt-3" aria-hidden="true"></i>', name: 'Formal',    blurb: 'Derivations, sources, open problems.' }
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function all(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  function hashGet(key) {
    var h = location.hash.replace(/^#/, '');
    if (!h) return null;
    var parts = h.split('&');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (kv[0] === key && kv.length > 1) return decodeURIComponent(kv[1]);
    }
    return null;
  }
  function hashSet(key, val) {
    var h = location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    var out = [], hit = false;
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (kv[0] === key) { out.push(key + '=' + encodeURIComponent(val)); hit = true; }
      else if (parts[i]) out.push(parts[i]);
    }
    if (!hit) out.push(key + '=' + encodeURIComponent(val));
    try { history.replaceState(null, '', '#' + out.join('&')); }
    catch (e) { location.hash = out.join('&'); }
  }
  function bareAnchor() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h.indexOf('=') > -1) return null;
    return h;
  }

  function buildToggle() {
    var host = $('.wrap') || document.body;
    var kids = [].slice.call(host.children);

    var cur = null;
    var keeping = false;
    var stopped = false;
    var groups = { g: [], y: [], r: [] };
    var firstChip = null;

    kids.forEach(function (el) {
      if (stopped) return;
      if (el.hasAttribute('data-tier-stop')) { stopped = true; return; }

      var isChip = el.classList.contains('tier') &&
                   TIERS.some(function (t) { return el.classList.contains(t); });
      if (isChip) {
        cur = TIERS.filter(function (t) { return el.classList.contains(t); })[0];
        keeping = false;
        if (!firstChip) firstChip = el;
      } else if (el.hasAttribute('data-tier-keep')) {
        keeping = true;
      } else if (keeping && /^H[12]$/.test(el.tagName)) {
        keeping = false;
      }

      if (cur && !keeping) {
        el.setAttribute('data-in-tier', cur);
        groups[cur].push(el);
      }
    });

    var present = TIERS.filter(function (t) { return groups[t].length; });
    if (present.length < 2 || !firstChip) return null;

    var bar = document.createElement('div');
    bar.className = 'tbar';
    bar.innerHTML =
      '<span class="tbar-lab">Read this at</span>' +
      '<div class="tbar-btns" role="group" aria-label="Choose reading depth"></div>' +
      '<span class="tbar-blurb" aria-live="polite"></span>';
    var btns = $('.tbar-btns', bar);
    var blurb = $('.tbar-blurb', bar);

    present.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tbtn t-' + t;
      b.setAttribute('data-t', t);
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span class="tbtn-chip">' + META[t].chip + '</span>' +
                    '<span class="tbtn-name">' + META[t].name + '</span>';
      b.addEventListener('click', function () { pick(t, true); });
      btns.appendChild(b);
    });
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'tbtn t-all';
    allBtn.setAttribute('data-t', 'all');
    allBtn.setAttribute('aria-pressed', 'false');
    allBtn.innerHTML = '<span class="tbtn-name">All three</span>';
    allBtn.addEventListener('click', function () { pick('all', true); });
    btns.appendChild(allBtn);

    firstChip.parentNode.insertBefore(bar, firstChip);

    function pick(t, fromClick) {
      var showAll = (t === 'all');
      TIERS.forEach(function (tt) {
        var hide = !showAll && tt !== t;
        groups[tt].forEach(function (el) { el.hidden = hide; });
      });
      all('.tbtn', bar).forEach(function (b) {
        var on = b.getAttribute('data-t') === t;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      blurb.textContent = showAll ? 'Everything, in order.' : META[t].blurb;
      document.body.setAttribute('data-depth', t);
      if (fromClick) {
        hashSet('depth', t);
        if (window.SymbiQ && SymbiQ.depth) {
          if (t === 'g') SymbiQ.depth.set('light');
          else if (t === 'r') SymbiQ.depth.set('deep');
        }
        var top = bar.getBoundingClientRect().top;
        if (top < 0) bar.scrollIntoView({ block: 'start' });
      }
      return true;
    }

    var anch = bareAnchor(), start = null;
    if (anch) {
      var target = document.getElementById(anch);
      if (target) {
        var owner = target.closest('[data-in-tier]');
        if (owner) start = owner.getAttribute('data-in-tier');
        else start = 'all';
      }
    }
    if (!start) {
      var want = hashGet('depth');
      if (want && (want === 'all' || present.indexOf(want) > -1)) {
        start = want;
      } else {
        var pref = (window.SymbiQ && SymbiQ.depth) ? SymbiQ.depth.get() : null;
        var prefTier = pref === 'deep' ? 'r' : pref === 'light' ? 'g' : null;
        start = (prefTier && present.indexOf(prefTier) > -1) ? prefTier : present[0];
      }
    }
    pick(start, false);

    if (anch) {
      var t2 = document.getElementById(anch);
      if (t2) setTimeout(function () { t2.scrollIntoView({ block: 'start' }); }, 0);
    }

    window.addEventListener('hashchange', function () {
      var a = bareAnchor();
      if (a) {
        var el = document.getElementById(a);
        if (el) {
          var own = el.closest('[data-in-tier]');
          if (own && own.hidden) pick(own.getAttribute('data-in-tier'), false);
          el.scrollIntoView({ block: 'start' });
        }
        return;
      }
      var w = hashGet('depth');
      if (w && (w === 'all' || present.indexOf(w) > -1)) pick(w, false);
    });

    return { groups: groups, present: present };
  }

  function buildCorrFilters() {
    var btns = all('.corr-f');
    if (!btns.length) return;
    var items = all('.corr');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-k');
        items.forEach(function (it) {
          it.hidden = (k !== 'all' && it.getAttribute('data-k') !== k);
        });
        btns.forEach(function (x) {
          var on = x === b;
          x.classList.toggle('is-on', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    });
  }

  function standingSrc() {
    var tag = document.getElementById('standing-src');
    return tag ? tag.getAttribute('src') : null;
  }

  function ensureStanding() {
    var S = window.SymbiQ;
    if (S && S.standing) return Promise.resolve(S.standing);
    var src = standingSrc();
    if (!src || !S || !S.core || !S.core.loadScript) return Promise.resolve(null);
    return S.core.loadScript(src).then(function () {
      return window.SymbiQ.standing || null;
    });
  }

  function recordProof(right) {
    try {
      var S = window.SymbiQ;
      if (S && S.standing) { S.standing.recordCyu(right); return; }
      ensureStanding().then(function (st) {
        if (st) { try { st.recordCyu(right); } catch (e) {} }
      })['catch'](function () {});
    } catch (e) {}
  }

  function preloadStanding() {
    try {
      var first = $('.cyu');
      if (!first || !standingSrc()) return;
      var S = window.SymbiQ;
      if (S && S.core && S.core.onNear) {
        S.core.onNear(first, function () { ensureStanding()['catch'](function () {}); }, 400);
      }
    } catch (e) {}
  }

  function buildChecks() {
    all('.cyu').forEach(function (box, n) {
      var opts = all('[data-opt]', box);
      var why = $('.cyu-why', box);
      if (!opts.length || !why) return;
      var answer = parseInt(box.getAttribute('data-a'), 10);
      if (isNaN(answer)) return;

      why.hidden = true;
      var done = false;
      var out = document.createElement('p');
      out.className = 'cyu-out';
      out.setAttribute('aria-live', 'polite');
      why.parentNode.insertBefore(out, why);

      opts.forEach(function (o, i) {
        o.setAttribute('type', 'button');
        o.addEventListener('click', function () {
          if (done) return;
          done = true;
          var right = (i === answer);
          opts.forEach(function (x, j) {
            x.classList.add('locked');
            if (j === answer) x.classList.add('is-right');
            else if (j === i) x.classList.add('is-wrong');
          });
          out.textContent = right
            ? 'Right, and here is why that is the answer:'
            : 'Not this one. The reasoning matters more than the guess:';
          out.className = 'cyu-out ' + (right ? 'ok' : 'no');
          why.hidden = false;
          bump(right);
          recordProof(right);
        });
      });
    });
  }

  var acted = 0;
  function bump(right) {
    acted++;
    var box = $('.pathway-nudge');
    if (!box || box.getAttribute('data-shown')) return;
    if (acted < 1) return;
    box.setAttribute('data-shown', '1');
    box.hidden = false;
    if (right) box.classList.add('warm');
  }

  function buildProgress() {
    var bar = document.createElement('div');
    bar.className = 'readbar';
    bar.innerHTML = '<i></i>';
    var fill = bar.firstChild;
    document.body.appendChild(bar);
    var tick = false;
    function draw() {
      tick = false;
      var h = document.documentElement;
      var max = (h.scrollHeight - h.clientHeight);
      var p = max > 40 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      fill.style.width = (p * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; window.requestAnimationFrame(draw); }
    }, { passive: true });
    draw();
  }

  function boot() {
    try { if (document.body.hasAttribute('data-tiers')) buildToggle(); }
    catch (e) { }
    try { buildChecks(); } catch (e) {}
    try { preloadStanding(); } catch (e) {}
    try { buildCorrFilters(); } catch (e) {}
    try {
      if (!window.SymbiQ.core.reduced()) {
        buildProgress();
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
;
(function () {
  try {
    var body = document.body;
    var rung = body.getAttribute('data-rung');
    if (!rung) return;

    var RUNGS = [
      { id: 'L0', label: 'the circuit',     href: 'circuits.html' },
      { id: 'L1', label: 'the qubit',       href: 'quantum-mechanics.html' },
      { id: 'L2', label: 'what makes it survive', href: 'qec.html' },
      { id: 'L3', label: 'the algorithm',   href: 'phase-kickback.html' },
      { id: 'L4', label: 'the consequence', href: 'pqc.html' }
    ];
    var FORK = { label: 'the fork, coupled circuits instead', href: 'analog.html' };

    var h1 = document.querySelector('h1');
    if (!h1) return;
    var anchor = h1.nextElementSibling;
    if (!(anchor && anchor.classList && anchor.classList.contains('tagline'))) anchor = h1;
    var isFork = (rung === 'FORK');

    var nav = document.createElement('nav');
    nav.className = 'rung-rail';
    nav.setAttribute('aria-label', "Where this page sits on SymbiQ's ladder, from the circuit to the consequence");

    var html = '<span class="rung-rail-lab">The Ladder</span><span class="rung-rail-track">';
    RUNGS.forEach(function (r, i) {
      var cur = (!isFork && r.id === rung);
      html += '<a href="' + r.href + '" class="rung-dot' + (cur ? ' is-cur' : '') + '" title="' +
              r.id + ', ' + r.label + '"' + (cur ? ' aria-current="page"' : '') + '>' +
              '<span aria-hidden="true">' + r.id + '</span><span class="rung-sr">' + r.label + '</span></a>';
      if (i < RUNGS.length - 1) html += '<span class="rung-seg" aria-hidden="true"></span>';
    });
    html += '</span>';
    html += '<a href="' + FORK.href + '" class="rung-fork' + (isFork ? ' is-cur' : '') +
            '"' + (isFork ? ' aria-current="page"' : '') + '>⑂ ' + FORK.label + '</a>';
    nav.innerHTML = html;

    anchor.parentNode.insertBefore(nav, anchor.nextSibling);
  } catch (e) { }
})();
;
(function () {
  'use strict';

  var PROVIDER  = 'goatcounter';
  var SITE_CODE = 'symbiq';
  var DOMAIN    = 'starkck.github.io';
  var CF_TOKEN  = '';

  if (!PROVIDER) return;

  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var s = document.createElement('script');
  s.defer = true;

  if (PROVIDER === 'goatcounter') {
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + SITE_CODE + '.goatcounter.com/count');
  } else if (PROVIDER === 'plausible') {
    s.src = 'https://plausible.io/js/script.js';
    s.setAttribute('data-domain', DOMAIN);
  } else if (PROVIDER === 'cloudflare') {
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token":"' + CF_TOKEN + '"}');
  } else {
    return;
  }

  function fire() { document.head.appendChild(s); }
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', fire, { once: true });
  } else {
    fire();
  }

  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.track = function (name, meta) {
    try {
      if (PROVIDER === 'plausible' && window.plausible) window.plausible(name, { props: meta || {} });
      if (PROVIDER === 'goatcounter' && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'event/' + name, title: name, event: true });
      }
    } catch (e) { }
  };
})();

window.SymbiQ = window.SymbiQ || {};
if (typeof window.SymbiQ.track !== 'function') window.SymbiQ.track = function () {};
;
(function () {
  'use strict';

  var ACCESS_KEY = 'e475f594-d5a7-4cc2-a89d-fd4b12deb5ef';
  var ENDPOINT   = 'https://api.web3forms.com/submit';

  function fallbackAddress() {
    return ['dsechinmoy', String.fromCharCode(64), 'gmail', '.', 'com'].join('');
  }

  function msg(form, text, kind) {
    var el = form.querySelector('.sqmsg');
    if (!el) { el = document.createElement('p'); el.className = 'sqmsg'; form.appendChild(el); }
    el.className = 'sqmsg ' + (kind || '');
    el.textContent = text;
  }

  function values(form) {
    var out = {}, els = form.querySelectorAll('input[name], textarea[name], select[name]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], t = (el.type || '').toLowerCase();
      if (t === 'checkbox' || t === 'radio') {
        if (el.checked) out[el.name] = (el.value && el.value !== 'on') ? el.value : 'yes';
        continue;
      }
      out[el.name] = el.value.trim();
    }
    return out;
  }

  function post(form, kind, data) {
    var body = { access_key: ACCESS_KEY, subject: 'SymbiQ ' + kind, from_name: 'SymbiQ site' };
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) body[k] = data[k];

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.success !== true) throw new Error((j && j.message) || 'relay refused it');
        return true;
      });
  }

  function mailto(kind, data) {
    var lines = [];
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) lines.push(k + ': ' + data[k]);
    return 'mailto:' + fallbackAddress() +
           '?subject=' + encodeURIComponent('SymbiQ ' + kind) +
           '&body='    + encodeURIComponent(lines.join('\n\n'));
  }

  function handle(form) {
    if (form.dataset.sqWired) return;
    form.dataset.sqWired = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.getAttribute('data-sq') || 'message';
      var data = values(form);
      var btn  = form.querySelector('button[type=submit], button:not([type])');

      if (data._gotcha) { msg(form, 'Thanks, that’s in.', 'ok'); form.reset(); return; }
      delete data._gotcha;

      var required = form.querySelectorAll('[required]');
      for (var i = 0; i < required.length; i++) {
        if (!required[i].value.trim()) {
          msg(form, 'Please fill in ' + (required[i].getAttribute('data-label') || 'every required field') + '.', 'err');
          required[i].focus();
          return;
        }
      }

      if (btn) { btn.disabled = true; btn.dataset.was = btn.textContent; btn.textContent = 'Sending…'; }

      var done = function (ok, text) {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.was || 'Send'; }
        msg(form, text, ok ? 'ok' : 'err');
        if (ok) form.reset();
      };

      if (!ACCESS_KEY) {
        window.location.href = mailto(kind, data);
        done(true, 'Opening your email app, press send there and it reaches us. ' +
                   '(Direct sending is not switched on yet.)');
        return;
      }

      post(form, kind, data)
        .then(function () {
          if (kind === 'newsletter') remember('subscribed');
          done(true, kind === 'newsletter'
            ? 'You’re on the list. Nothing else needed.'
            : kind === 'community-post'
              ? 'Received. It goes to the desk for review, which can take up to 48 hours.'
              : kind === 'creator-application'
                ? 'Received. The desk reads every application itself.'
                : 'Got it, thank you. Every report is read by a human.');
        })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.was || 'Send'; }
          var a = document.createElement('a');
          a.href = mailto(kind, data);
          a.textContent = 'send it by email instead';
          msg(form, 'That didn’t go through (' + err.message + '). You can ', 'err');
          form.querySelector('.sqmsg').appendChild(a);
          form.querySelector('.sqmsg').appendChild(document.createTextNode('.'));
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-sq]');
    for (var i = 0; i < forms.length; i++) handle(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  var CAP_KEY = 'symbiq.capture.v1', capShown = false, capN = 0;
  function capState() { try { return JSON.parse(localStorage.getItem(CAP_KEY)) || {}; } catch (e) { return {}; } }
  function remember(state) { try { localStorage.setItem(CAP_KEY, JSON.stringify({ state: state, at: Date.now() })); } catch (e) {} }
  var CAP_COPY = {
    question: 'One letter a week: the move of the week, a claim that moved, and the Question with last week’s answer.',
    game: 'One letter a week from the desk: the move of the week, a claim that moved, and a seeded board to beat.'
  };
  function ensureCapStyle() {
    if (document.getElementById('sq-cap-style')) return;
    var st = document.createElement('style');
    st.id = 'sq-cap-style';
    st.textContent =
      '.sqcap{margin:14px 0 4px;padding:14px 16px;border:1px dashed var(--border);border-radius:12px;text-align:left;font-weight:400}' +
      '.sqcap-lead{margin:0;font-size:.93rem}' +
      '.sqcap .sqform{margin:10px 0 0}' +
      '.sqcap-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';
    document.head.appendChild(st);
  }
  var CAPTURE_ON = false;
  function capture(host, o) {
    o = o || {};
    if (!CAPTURE_ON || !host || capShown) return false;
    var s = capState();
    if (s.state === 'subscribed') return false;
    if (s.state === 'dismissed' && Date.now() - (s.at || 0) < 21 * 86400000) return false;
    capShown = true; capN++;
    var id = 'sqcap-email-' + capN, ctx = String(o.context || 'site').replace(/[^a-z]/g, '');
    ensureCapStyle();
    host.innerHTML =
      '<div class="sqcap">' +
        '<p class="sqcap-lead"><strong>' + (o.lead || 'Nice.') + '</strong> ' +
          (ctx === 'question' ? CAP_COPY.question : CAP_COPY.game) + ' The first issue will find you.</p>' +
        '<form class="sqform" data-sq="newsletter">' +
          '<label class="sqcap-sr" for="' + id + '">Your email address</label>' +
          '<input type="email" id="' + id + '" name="email" data-label="your email" required placeholder="you@example.com">' +
          '<input type="hidden" name="source" value="' + ctx + '">' +
          '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
          '<button type="submit">Send me the letter</button>' +
          '<button type="button" class="ghost" data-sqcap-no>Not now</button>' +
        '</form>' +
      '</div>';
    handle(host.querySelector('form'));
    host.querySelector('[data-sqcap-no]').addEventListener('click', function () { remember('dismissed'); host.innerHTML = ''; });
    return true;
  }

  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.forms = { wire: function (form) { if (form) handle(form); }, capture: capture };
})();
;
(function () {
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.SUPABASE_URL = 'https://ymtjedmqptiwhktxdwmv.supabase.co';
  window.SymbiQ.SUPABASE_ANON_KEY = 'sb_publishable_j9ugu-qEEh9ZSaB0wsSCUw_tPRn6D_h';
})();
;
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var esc = window.SymbiQ.core.esc;

  var client = null;
  var currentUser = null;
  var loadPromise = null;
  var mount = null, wrap = null, avatar = null;

  var API = {
    client: null,
    ready: false,
    getUser: function () { return currentUser; },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    ensure: ensure
  };
  window.SymbiQ.auth = API;

  var ACCOUNTS = false;
  function accountsOn() {
    if (ACCOUNTS) return true;
    try { return localStorage.getItem('symbiq.dev.accounts') === 'on'; } catch (e) { return false; }
  }
  API.enabled = accountsOn();

  function configured() {
    return accountsOn() && !!(window.SymbiQ.SUPABASE_URL && window.SymbiQ.SUPABASE_ANON_KEY);
  }

  function hasStoredSession() {
    try {
      var host = new URL(window.SymbiQ.SUPABASE_URL).hostname.split('.')[0];
      return !!localStorage.getItem('sb-' + host + '-auth-token');
    } catch (e) { return false; }
  }

  var loadScript = window.SymbiQ.core.loadScript;

  function ensure() {
    if (loadPromise) return loadPromise;
    if (!configured()) { loadPromise = Promise.resolve(null); return loadPromise; }
    loadPromise = loadScript('vendor/supabase/supabase.js?v=2116')
      .then(function () {
        if (!window.supabase || !window.supabase.createClient) throw new Error('supabase-js did not load');
        client = window.supabase.createClient(window.SymbiQ.SUPABASE_URL, window.SymbiQ.SUPABASE_ANON_KEY);
        API.client = client;
        watch();
        return client;
      })
      .catch(function (err) {
        try { console.warn('SymbiQ auth: not available', err); } catch (e) {}
        return null;
      });
    return loadPromise;
  }

  function setTrigger(signedIn, label) {
    wrap.classList.toggle('signed-in', signedIn);
    var summary = wrap.querySelector('summary');
    if (summary) summary.setAttribute('aria-label', label);
  }

  function renderSignedOut(status) {
    mount.innerHTML =
      '<form id="sq-auth-form" class="sqform sq-auth-form">' +
        '<input type="email" id="sq-auth-email" placeholder="you@example.com" required aria-label="Email for a sign-in link">' +
        '<button type="submit">Sign in &rarr;</button>' +
      '</form>' +
      (status ? '<p class="sq-auth-status">' + esc(status) + '</p>' : '');
    if (avatar) avatar.textContent = '👤';
    setTrigger(false, 'Sign in');
    var form = document.getElementById('sq-auth-form');
    var email0 = document.getElementById('sq-auth-email');
    if (email0) email0.addEventListener('focus', function () { ensure(); }, { once: true });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = document.getElementById('sq-auth-email').value.trim();
      if (!email) return;
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      ensure().then(function (c) {
        if (!c) { renderSignedOut('Sign-in is unavailable right now. Please try again in a minute.'); return; }
        return Promise.resolve(c.auth.signInWithOtp({
          email: email,
          options: { emailRedirectTo: location.href.split('#')[0] }
        })).then(function (res) {
          if (res && res.error) throw res.error;
          renderSignedOut('Check ' + email + ' for a sign-in link.');
        });
      }).catch(function (err) {
        renderSignedOut('Could not send a link (' + (err && err.message || 'unknown error') + ').');
      });
    });
  }

  function renderSignedIn(user, profile) {
    var name = (profile && profile.handle) || (user.email || '').split('@')[0];
    mount.innerHTML =
      '<div class="sq-auth-me">' +
        '<span class="sq-auth-name">' + esc(name) +
        (profile && profile.symbiont_no ? ' <span class="sq-auth-no">#' + esc(profile.symbiont_no) + '</span>' : '') +
        '</span>' +
        '<button id="sq-auth-out" type="button">Sign out</button>' +
      '</div>';
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    setTrigger(true, name + ', account menu');
    document.getElementById('sq-auth-out').addEventListener('click', function () {
      client.auth.signOut();
    });
  }

  function announce() {
    API.ready = true;
    window.dispatchEvent(new CustomEvent('symbiq:authchange', { detail: { user: currentUser } }));
  }

  function onSignedIn(user) {
    currentUser = user;
    Promise.resolve(
      client.from('profiles').select('handle,symbiont_no').eq('id', user.id).single()
    ).then(function (res) {
      renderSignedIn(user, res && res.data);
    }).catch(function () {
      renderSignedIn(user, null);
    });
    if (window.SymbiQ.save && window.SymbiQ.save.connectRemote) {
      window.SymbiQ.save.connectRemote(client, user.id);
    }
    announce();
  }

  function onSignedOut() {
    currentUser = null;
    if (window.SymbiQ.save && window.SymbiQ.save.disconnectRemote) {
      window.SymbiQ.save.disconnectRemote();
    }
    renderSignedOut(null);
    announce();
  }

  function watch() {
    client.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) onSignedIn(session.user);
      else announce();
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) onSignedIn(session.user);
      else onSignedOut();
    });
  }

  function init() {
    mount = document.getElementById('sq-auth');
    wrap = document.getElementById('sq-account');
    avatar = document.getElementById('sq-avatar');

    if (!mount || !wrap || !configured()) { setTimeout(announce, 0); return; }

    wrap.hidden = false;
    renderSignedOut(null);

    wrap.addEventListener('toggle', function () { if (wrap.open) ensure(); });

    if (hasStoredSession()) {
      ensure();
    } else {
      setTimeout(announce, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
;
(function () {
  'use strict';
  var W = window, D = document, S = (W.SymbiQ = W.SymbiQ || {}), C = S.core;
  if (!C || S.play) return;
  var tag = D.getElementById('play-src');
  if (!tag) return;

  var api = function (mode, opts) {
    return C.loadScript(tag.src).then(function () { return S.play.start(mode, opts); }, function (e) { try { W.console.warn('SymbiQ play layer failed to load', e); } catch (x) { } });
  };
  S.play = api;

  var DOTS = [
    '.sqp-dots{display:inline-flex;align-items:center;vertical-align:middle;margin-left:6px}',
    '.sqp-dot{width:44px;height:44px;border:0;padding:0;background:transparent;display:inline-grid;place-items:center;cursor:pointer;opacity:.6}',
    '.sqp-dot i{width:9px;height:9px;border-radius:50%;display:block;transition:transform .25s,box-shadow .25s;background:currentColor}',
    '.sqp-dot.n{color:#a78bfa}.sqp-dot.d{color:#2dd4bf}',
    '.sqp-dot:hover,.sqp-dot:focus-visible{opacity:1}',
    '.sqp-dot:hover i,.sqp-dot:focus-visible i{transform:scale(1.5);box-shadow:0 0 12px currentColor}',
    '.sqp-dot:focus-visible{outline:2px solid currentColor;outline-offset:-8px;border-radius:50%}'
  ].join('\n');
  var DOOR = [
    '.sqp-bg{position:fixed;inset:0;z-index:2147482290;background:transparent}',
    '.sqp-door{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147482300;width:min(430px,calc(100vw - 24px));padding:18px 20px;border-radius:18px;background:rgba(9,13,24,.97);border:1px solid rgba(255,255,255,.2);color:#e8ecf6;font:500 14px/1.5 Inter,"Segoe UI",system-ui,sans-serif;box-shadow:0 20px 80px rgba(0,0,0,.6)}',
    '.sqp-door h3{margin:0 0 6px;font-size:17px;color:#fff}.sqp-door p{margin:0 0 10px;color:#cfd6e6}.sqp-door .sqp-fine{font-size:12.5px;color:#9aa5bd}',
    '.sqp-door .sqp-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}',
    '.sqp-door .sqp-row button{flex:1 1 150px;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;font:600 14px/1.2 Inter,"Segoe UI",system-ui,sans-serif;cursor:pointer;padding:6px 10px}',
    '.sqp-door .sqp-row button small{display:block;font:500 11.5px/1.3 Inter,"Segoe UI",system-ui,sans-serif;color:#aeb8ce;margin-top:2px}',
    '.sqp-door .sqp-row button.n{border-color:#a78bfa}.sqp-door .sqp-row button.d{border-color:#2dd4bf}',
    '.sqp-door .sqp-row button:hover,.sqp-door .sqp-row button:focus-visible{background:rgba(255,255,255,.14);outline:none}',
    '.sqp-door .sqp-x{position:absolute;right:8px;top:8px;width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer}',
    '.sqp-door button:focus-visible{outline:2px solid #fff;outline-offset:2px}'
  ].join('\n');
  function css(id, text) { if (D.getElementById(id)) return; var s = D.createElement('style'); s.id = id; s.textContent = text; D.head.appendChild(s); }

  var prev = null;
  function closeDoor(restore) {
    var d = D.querySelector('.sqp-door'), bg = D.querySelector('.sqp-bg');
    if (bg) bg.remove();
    if (d) { d.remove(); D.removeEventListener('keydown', onKey, true); }
    if (restore && prev && prev.focus && D.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) { } }
    prev = null;
  }
  function onKey(e) {
    var d = D.querySelector('.sqp-door'); if (!d) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeDoor(true); return; }
    if (e.key === 'Tab') {
      var f = d.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!d.contains(D.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }
  function go(mode, room) { closeDoor(false); api(mode, room ? { room: room } : undefined); }
  function openDoor(room) {
    css('sqp-door-css', DOOR);
    var keep = prev || D.activeElement; closeDoor(false); prev = keep;
    var bg = D.createElement('div'); bg.className = 'sqp-bg'; bg.addEventListener('click', function () { closeDoor(true); }); D.body.appendChild(bg);
    var d = D.createElement('div'); d.className = 'sqp-door'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Play with this page');
    var code = room ? C.esc(room) : '';
    d.innerHTML = '<button type="button" class="sqp-x" aria-label="Close">✕</button><h3>' + (room ? 'A room is open' : 'Two ways to play with this page') + '</h3>' +
      '<p>' + (room ? 'Room <b>' + code + '</b>, in another window of this browser. Pick a side and you will see their cursor and their effects on this same page.' : 'The page is a fragile quantum state. One of you gives it errors, the other one fixes them.') + '</p>' +
      '<div class="sqp-row"><button type="button" class="n" data-m="noise">Be the Noise<small>break things, physically</small></button><button type="button" class="d" data-m="decoder">Be the Decoder<small>mend, shield, draw</small></button></div>' +
      '<p class="sqp-fine">Nothing is deleted: it is all drawn over the page, and Esc puts everything back. ' + (room ? 'Picking a side here joins that room. ' : '') + 'Nothing is sent anywhere; a room connects windows of this browser.</p>';
    D.body.appendChild(d);
    d.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.classList.contains('sqp-x')) closeDoor(true); else go(b.getAttribute('data-m'), room); });
    D.addEventListener('keydown', onKey, true);
    var f = d.querySelector('button[data-m]'); if (f) f.focus();
  }
  S.play.door = openDoor;

  function boot() {
    var foot = D.querySelector('footer');
    if (foot && !foot.querySelector('.sqp-dots')) {
      css('sqp-dots-css', DOTS);
      var w = D.createElement('span'); w.className = 'sqp-dots';
      w.innerHTML = '<button type="button" class="sqp-dot n" aria-label="Play as the Noise"><i></i></button><button type="button" class="sqp-dot d" aria-label="Play as the Decoder"><i></i></button>';
      w.addEventListener('click', function (e) { var b = e.target.closest('.sqp-dot'); if (b) api(b.classList.contains('n') ? 'noise' : 'decoder'); });
      foot.appendChild(w);
    }
    D.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href$="#play-noise"]');
      if (a) { e.preventDefault(); openDoor(); }
    });
    var n = 0, t = 0;
    D.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('#qz-pill')) return;
      var now = Date.now(); n = now - t < 900 ? n + 1 : 1; t = now;
      if (n >= 3) { n = 0; openDoor(); }
    });
    try { W.console.info('%cSymbiQ%c There is a way to play with this page: SymbiQ.play("noise") or SymbiQ.play("decoder"). Nothing is ever deleted, and Esc puts it all back.', 'background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px', 'color:inherit'); } catch (e) { }
    var m = /[?&]play=([A-Za-z]{4}-?\d{2})\b/.exec(W.location.search);
    if (m) { var code = m[1].toUpperCase().replace(/^([A-Z]{4})-?(\d{2})$/, '$1-$2'); openDoor(code); }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
;
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var reduced = window.SymbiQ.core.reduced();

  var RGB = { v: [167, 139, 250], t: [45, 212, 191] };

  function hexToRgb(s) {
    s = (s || '').trim();
    var m = /^#?([0-9a-f]{6})$/i.exec(s);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
    return m ? [+m[1], +m[2], +m[3]] : null;
  }

  function readColours() {
    var cs = getComputedStyle(D.documentElement);
    var v = hexToRgb(cs.getPropertyValue('--violet'));
    var t = hexToRgb(cs.getPropertyValue('--teal'));
    if (v) RGB.v = v;
    if (t) RGB.t = t;
  }

  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }

  var cvs, ctx, dpr = 1, w = 0, h = 0;
  var nodes = [], raf = 0, running = false;
  var pointer = { x: -9999, y: -9999, live: false };
  var coherence = 0;

  var LINK = 132;
  var CURSOR = 190;
  var WAVE = 0.42;
  var HOP_LOSS = 0.72;
  var MIN_AMP = 0.06;
  var MAX_EVENTS = 400;

  function sizeCanvas() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    w = W.innerWidth;
    h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    var n = Math.max(24, Math.min(88, Math.round((w * h) / 21000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        r: 1.1 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,
        amp: 0,
        teal: Math.random() < 0.42
      });
    }
  }

  function excite(idx, amp, budget) {
    var nd = nodes[idx];
    if (!nd || amp < MIN_AMP || budget.n > MAX_EVENTS) return;
    budget.n++;
    nd.amp = Math.min(1, nd.amp + amp);

    for (var j = 0; j < nodes.length; j++) {
      if (j === idx) continue;
      var o = nodes[j];
      var dx = o.x - nd.x, dy = o.y - nd.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > LINK) continue;
      var next = amp * HOP_LOSS * (1 - d / LINK * 0.4);
      if (next < MIN_AMP) continue;
      if (o.amp > next) continue;
      (function (jj, nn) {
        setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function hitTest(x, y) {
    var best = -1, bestD = 22;
    for (var i = 0; i < nodes.length; i++) {
      var dx = nodes[i].x - x, dy = nodes[i].y - y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function step(dt, t) {
    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.x += n.vx * dt;
      n.y += n.vy * dt;

      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      if (pointer.live) {
        var dx = pointer.x - n.x, dy = pointer.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 1) {
          var f = (1 - d / CURSOR) * 0.00028 * dt;
          n.vx += dx * f;
          n.vy += dy * f;
        }
      }

      n.vx *= 0.992;
      n.vy *= 0.992;
      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > 0.42) { n.vx = n.vx / sp * 0.42; n.vy = n.vy / sp * 0.42; }
      if (sp < 0.02) { n.vx += (Math.random() - 0.5) * 0.02; n.vy += (Math.random() - 0.5) * 0.02; }

      n.amp *= Math.pow(0.9975, dt);
      if (n.amp < 0.004) n.amp = 0;
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    var i, j, a, b, dx, dy, d, o;

    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;

        var base = (1 - d / LINK) * 0.16;
        var lift = (a.amp + b.amp) * 0.5;
        var shim = coherence * 0.10 * (0.5 + 0.5 * Math.sin(t * 0.0016 + (a.ph + b.ph)));
        var alpha = Math.min(0.62, base + lift * 0.55 + shim);
        if (alpha < 0.012) continue;

        ctx.strokeStyle = rgba(a.teal && b.teal ? RGB.t : RGB.v, alpha);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    if (pointer.live) {
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        dx = pointer.x - a.x; dy = pointer.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > CURSOR) continue;
        ctx.strokeStyle = rgba(RGB.t, (1 - d / CURSOR) * 0.20);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    for (i = 0; i < nodes.length; i++) {
      o = nodes[i];
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.0011 + o.ph);
      var rad = o.r * (1 + pulse * 0.28 + o.amp * 2.6);
      var al = 0.30 + pulse * 0.16 + o.amp * 0.62 + coherence * 0.12;
      ctx.fillStyle = rgba(o.teal ? RGB.t : RGB.v, Math.min(0.95, al));
      ctx.beginPath();
      ctx.arc(o.x, o.y, rad, 0, Math.PI * 2);
      ctx.fill();

      if (o.amp > 0.05) {
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, 26 * o.amp + 6);
        g.addColorStop(0, rgba(o.teal ? RGB.t : RGB.v, o.amp * 0.34));
        g.addColorStop(1, rgba(o.teal ? RGB.t : RGB.v, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 26 * o.amp + 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  var last = 0;
  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(t - last, 48) : 16;
    last = t;
    step(dt, t);
    draw(t);
    raf = W.requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    last = 0;
    raf = W.requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) W.cancelAnimationFrame(raf);
    raf = 0;
  }
  function restart() { stop(); start(); }

  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  function initLattice() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (cvs) return;

    if (!D.body.hasAttribute('data-lattice') && !(WIDE && WIDE.matches)) return;

    cvs = D.createElement('canvas');
    cvs.id = 'mo-lattice';
    cvs.setAttribute('aria-hidden', 'true');
    D.body.appendChild(cvs);
    ctx = cvs.getContext('2d');
    if (!ctx) { cvs.remove(); return; }

    readColours();
    sizeCanvas();
    seed();

    var rt;
    W.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = W.setTimeout(function () {
        sizeCanvas();
        seed();
        if (!running) draw(W.performance ? W.performance.now() : 0);
      }, 160);
    });

    if (reduced) {
      draw(0);
      cvs.classList.add('on');
      return;
    }

    draw(0);
    if (!D.hidden) start();

    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    W.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { pointer.live = false; });
    W.addEventListener('blur', function () { pointer.live = false; });

    W.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, summary, label')) return;
      var i = hitTest(e.clientX, e.clientY);
      if (i < 0) return;
      excite(i, 1, { n: 0 });
    }, { passive: true });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stop(); else restart();
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () { readColours(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
  }

  function initSheen() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (reduced) return;

    var pending = null, tick = 0;

    D.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card, .introute-card');
      if (!card) return;
      pending = { el: card, x: e.clientX, y: e.clientY };
      if (tick) return;
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var r = pending.el.getBoundingClientRect();
        pending.el.style.setProperty('--mo-x', ((pending.x - r.left) / r.width * 100).toFixed(1) + '%');
        pending.el.style.setProperty('--mo-y', ((pending.y - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  W.SymbiQ.lattice = {
    setCoherence: function (c) {
      coherence = Math.max(0, Math.min(1, c || 0));
      if (ctx && !running) draw(W.performance ? W.performance.now() : 0);
    },
    pulse: function () {
      if (!nodes.length) return;
      excite(Math.floor(Math.random() * nodes.length), 0.85, { n: 0 });
    },
    ready: function () { return !!ctx; }
  };

  function boot() {
    initLattice();
    initSheen();
    if (WIDE) {
      if (WIDE.addEventListener) WIDE.addEventListener('change', initLattice);
      else if (WIDE.addListener) WIDE.addListener(initLattice);
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var SS_KEY = 'symbiq.qz.v1';
  var LS_KEY = 'symbiq.qz.seen.v1';
  var EPS = 1e-9;

  var reduced = window.SymbiQ.core.reduced();

  function cm(p, q) { return [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; }
  function cadd(p, q) { return [p[0] + q[0], p[1] + q[1]]; }
  function cabs2(p) { return p[0] * p[0] + p[1] * p[1]; }
  function carg(p) { return Math.atan2(p[1], p[0]); }
  function cconj(p) { return [p[0], -p[1]]; }

  var S2 = 1 / Math.sqrt(2), C4 = Math.cos(Math.PI / 4), S4 = Math.sin(Math.PI / 4);
  var G = {
    I: [[1, 0], [0, 0], [0, 0], [1, 0]],
    X: [[0, 0], [1, 0], [1, 0], [0, 0]],
    Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
    Z: [[1, 0], [0, 0], [0, 0], [-1, 0]],
    H: [[S2, 0], [S2, 0], [S2, 0], [-S2, 0]],
    S: [[1, 0], [0, 0], [0, 0], [0, 1]],
    T: [[1, 0], [0, 0], [0, 0], [C4, S4]]
  };

  function matVec(m, v) {
    return [cadd(cm(m[0], v[0]), cm(m[1], v[1])),
            cadd(cm(m[2], v[0]), cm(m[3], v[1]))];
  }
  function matMul(a, b) {
    return [cadd(cm(a[0], b[0]), cm(a[1], b[2])),
            cadd(cm(a[0], b[1]), cm(a[1], b[3])),
            cadd(cm(a[2], b[0]), cm(a[3], b[2])),
            cadd(cm(a[2], b[1]), cm(a[3], b[3]))];
  }

  function nameOf(u) {
    var i, k, ref = null;
    for (i = 0; i < 4; i++) { if (cabs2(u[i]) > 1e-12) { ref = u[i]; break; } }
    if (!ref) return null;
    var r = Math.sqrt(cabs2(ref));
    var unphase = [ref[0] / r, -ref[1] / r];
    var norm = [];
    for (i = 0; i < 4; i++) norm.push(cm(u[i], unphase));

    for (k in G) {
      if (!Object.prototype.hasOwnProperty.call(G, k)) continue;
      var g = G[k], gref = null;
      for (i = 0; i < 4; i++) { if (cabs2(g[i]) > 1e-12) { gref = g[i]; break; } }
      var gr = Math.sqrt(cabs2(gref));
      var gun = [gref[0] / gr, -gref[1] / gr];
      var ok = true;
      for (i = 0; i < 4; i++) {
        var gn = cm(g[i], gun);
        if (Math.abs(gn[0] - norm[i][0]) > 1e-7 || Math.abs(gn[1] - norm[i][1]) > 1e-7) { ok = false; break; }
      }
      if (ok) return k;
    }
    return null;
  }

  var st = {
    v: [[1, 0], [0, 0]],
    u: G.I.slice(),
    n: 0,
    last: ''
  };

  function load() {
    try {
      var raw = W.sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.v && o.v.length === 2 && o.u && o.u.length === 4) {
        st.v = o.v; st.u = o.u; st.n = o.n || 0; st.last = o.last || '';
      }
    } catch (e) { }
  }
  function save() {
    try { W.sessionStorage.setItem(SS_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function p1() { return Math.min(1, Math.max(0, cabs2(st.v[1]))); }
  function p0() { return Math.min(1, Math.max(0, cabs2(st.v[0]))); }
  function phase() {
    if (cabs2(st.v[0]) < 1e-12 || cabs2(st.v[1]) < 1e-12) return 0;
    var d = carg(st.v[1]) - carg(st.v[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function coherence() { return 2 * Math.sqrt(p0() * p1()); }

  function observable() { return [p1(), phase()]; }
  function sameObservable(a, b) {
    return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  }

  var fx, pill, sr, hintTimer = 0;

  function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }

  function ketText() {
    var pb = p1(), a = Math.sqrt(p0()), b = Math.sqrt(pb);
    if (pb < 1e-6) return '|0⟩';
    if (pb > 1 - 1e-6) return '|1⟩';
    var deg = Math.round(phase() * 180 / Math.PI);
    var bpart = fmt(b) + (deg ? 'e' + sup(deg) : '') + '|1⟩';
    return fmt(a) + '|0⟩ + ' + bpart;
  }
  function sup(deg) {
    var map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
                5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    var s = String(deg).split('').map(function (c) { return map[c] || c; }).join('');
    return 'ⁱ' + s + '°';
  }

  function paint(note) {
    var pb = p1();
    var hue = 180 * pb + phase() * 180 / Math.PI;

    if (fx) {
      var idle = pb < 1e-6 && Math.abs(phase()) < 1e-9;
      fx.classList.toggle('idle', idle);
      fx.style.setProperty('--qz-inv', pb.toFixed(4));
      fx.style.setProperty('--qz-hue', hue.toFixed(2) + 'deg');
    }

    if (W.SymbiQ.lattice && W.SymbiQ.lattice.setCoherence) {
      W.SymbiQ.lattice.setCoherence(coherence());
    }

    if (!pill) return;
    var bits = [];
    if (st.last) bits.push('<span class="qz-gate">' + st.last + '</span>');
    bits.push('<span class="qz-ket">' + ketText() + '</span>');
    if (note) bits.push('<span class="qz-hint">' + note + '</span>');
    pill.innerHTML = bits.join('');
    pill.classList.toggle('live', st.n > 0 || pb > 1e-6);
  }

  function announce(msg) {
    if (!sr) return;
    sr.textContent = '';
    W.setTimeout(function () { sr.textContent = msg; }, 30);
  }

  function flash() {
    if (!pill || reduced) return;
    pill.classList.remove('flash');
    void pill.offsetWidth;
    pill.classList.add('flash');
  }

  function maybeHint() {
    try {
      if (W.localStorage.getItem(LS_KEY)) return null;
      W.localStorage.setItem(LS_KEY, '1');
    } catch (e) { return null; }
    clearTimeout(hintTimer);
    hintTimer = W.setTimeout(function () { paint(null); }, 7000);
    return 'M measures · R resets';
  }

  function applyGate(k) {
    var before = observable();
    st.v = matVec(G[k], st.v);
    st.u = matMul(G[k], st.u);
    st.n++;
    st.last = k;

    var note = maybeHint();
    if (!note) {
      var parts = [];
      var net = nameOf(st.u);
      if (net && st.n > 1) parts.push('net = ' + net);
      if (sameObservable(before, observable())) parts.push('nothing observable');
      note = parts.length ? parts.join(' · ') : null;
    }

    save();
    paint(note);
    flash();
    announce('Applied ' + k + '. State ' + ketText() + '.');
  }

  function measure() {
    var pb = p1();
    var r;
    try {
      var buf = new Uint32Array(1);
      W.crypto.getRandomValues(buf);
      r = buf[0] / 4294967296;
    } catch (e) { r = Math.random(); }

    var got = r < pb ? 1 : 0;
    st.v = got ? [[0, 0], [1, 0]] : [[1, 0], [0, 0]];
    st.u = G.I.slice();
    st.n = 0;
    st.last = 'M';
    save();
    paint('measured ' + got + ' · p was ' + fmt(pb));
    flash();
    announce('Measured ' + got + '.');
  }

  function reset() {
    st.v = [[1, 0], [0, 0]];
    st.u = G.I.slice();
    st.n = 0;
    st.last = '';
    save();
    paint(null);
    announce('Reset to zero.');
  }

  function editable(el) { return W.SymbiQ.core.editable(el); }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target)) return;
    if (editable(D.activeElement)) return;

    var k = (e.key || '').toUpperCase();
    if (G[k] && k !== 'I') { applyGate(k); return; }
    if (k === 'M') { measure(); return; }
    if (k === 'R') { reset(); return; }
  }

  function boot() {
    if (!D.body) return;

    fx = D.createElement('div');
    fx.id = 'qz-fx';
    fx.className = 'idle';
    fx.setAttribute('aria-hidden', 'true');
    D.body.appendChild(fx);

    pill = D.createElement('button');
    pill.id = 'qz-pill';
    pill.type = 'button';
    pill.setAttribute('aria-label', 'Page state. Activate to reset.');
    pill.addEventListener('click', reset);
    D.body.appendChild(pill);

    sr = D.createElement('div');
    sr.className = 'qz-sr';
    sr.setAttribute('aria-live', 'polite');
    sr.setAttribute('aria-atomic', 'true');
    D.body.appendChild(sr);

    load();
    paint(null);

    D.addEventListener('keydown', onKey);
  }

  W.SymbiQ.qubit = {
    say: function (msg, ms) {
      paint(msg);
      W.setTimeout(function () { paint(null); }, ms || 3200);
    },
    apply: function (k) { k = String(k).toUpperCase(); if (G[k] && k !== 'I') applyGate(k); },
    measure: measure,
    reset: reset,
    state: function () { return { p1: p1(), phase: phase(), coherence: coherence(), net: nameOf(st.u) }; }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
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
;
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-alive')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { }

  var ARRIVE_MS = 1350;

  function announce(hash) {
    try {
      var id = String(hash || '').replace(/^#/, '');
      if (!id) return;

      var target = null;
      try { target = document.getElementById(id) || document.querySelector('#' + CSS.escape(id)); }
      catch (e) { target = document.getElementById(id); }
      if (!target) return;

      if (target.tagName === 'DETAILS') {
        var sum = target.querySelector(':scope > summary');
        if (sum) target = sum;
      }

      var el = target;
      if (el.hasAttribute('data-sq-arrived')) return;

      function clear(e) {
        if (e && (e.target !== el ||
                  String(e.animationName || '').indexOf('sq-arrive') !== 0)) return;
        el.removeAttribute('data-sq-arrived');
        el.removeEventListener('animationend', clear);
      }
      el.addEventListener('animationend', clear);
      window.setTimeout(function () { clear(null); }, ARRIVE_MS + 400);
      el.setAttribute('data-sq-arrived', '');
    } catch (e) { }
  }

  try {
    if (location.hash) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          window.setTimeout(function () { announce(location.hash); }, 120);
        });
      });
    }
    window.addEventListener('hashchange', function () { announce(location.hash); });

    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || a.closest('nav')) return;
      var href = a.getAttribute('href') || '';
      var hash = href.indexOf('#') === 0 ? href
               : (a.pathname === location.pathname && a.hash) ? a.hash : '';
      if (!hash || hash === '#') return;
      window.setTimeout(function () { announce(hash); }, 140);
    }, true);
  } catch (e) {}

  var LINK_SVG =
    '<svg class="sq-pl-link" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3.1-3.1a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3"/>' +
      '<path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3.1 3.1a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3"/>' +
    '</svg>' +
    '<svg class="sq-pl-done" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>' +
    '</svg>';

  function permalinkURL(id) {
    return location.origin + location.pathname + location.search + '#' + id;
  }

  function note(host, words) {
    try {
      if (!host) return;
      var old = host.querySelector(':scope > .sq-pl-note');
      if (old) old.remove();
      var n = document.createElement('span');
      n.className = 'sq-pl-note';
      n.setAttribute('aria-live', 'polite');
      n.textContent = words;
      host.appendChild(n);
      window.setTimeout(function () { if (n.parentElement) n.remove(); }, 2000);
    } catch (e) {}
  }

  function buildPermalinks() {
    var heads = [].slice.call(document.querySelectorAll('h2[id], h3[id]'))
      .filter(function (h) {
        return !h.closest('nav') && !h.closest('.sqrail') && !h.closest('.hud') &&
               !h.querySelector('.sq-permalink');
      });
    if (!heads.length) return;

    var labels = heads.map(function (h) {
      var t = h.innerText || h.textContent || '';
      return t.trim().replace(/\s+/g, ' ').slice(0, 70);
    });

    heads.forEach(function (h, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq-permalink';
      btn.innerHTML = LINK_SVG;
      var label = labels[i];
      btn.setAttribute('aria-label', label ? 'Copy link to "' + label + '"' : 'Copy link to this section');
      btn.title = 'Copy link to this section';

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var url = permalinkURL(h.id);

        function ok() {
          btn.setAttribute('data-copied', '');
          note(h, 'link copied');
          window.setTimeout(function () { btn.removeAttribute('data-copied'); }, 1900);
        }
        function fallback() {
          try {
            history.replaceState(null, '', '#' + h.id);
            note(h, 'link in the address bar');
          } catch (e2) { note(h, 'copy failed'); }
        }

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(ok, fallback);
          } else { fallback(); }
        } catch (e3) { fallback(); }
      });

      h.classList.add('sq-anchored');
      h.appendChild(btn);
    });
  }

  var FOLD_MIN = 180;
  var FOLD_MAX = 420;
  var FOLD_CAP = 2600;

  function foldable(d) {
    return !d.closest('nav') && !d.closest('.sqrail') && !d.classList.contains('navcat');
  }

  function contentHeight(d) {
    var h = 0;
    [].slice.call(d.children).forEach(function (c) {
      if (c.tagName === 'SUMMARY') return;
      h += c.getBoundingClientRect().height +
           parseFloat(getComputedStyle(c).marginTop || 0) +
           parseFloat(getComputedStyle(c).marginBottom || 0);
    });
    return h;
  }

  function summaryHeight(d) {
    var s = d.querySelector(':scope > summary');
    return s ? s.getBoundingClientRect().height : 0;
  }

  function settle(d) {
    d.removeAttribute('data-sq-folding');
    d.style.removeProperty('height');
    d.style.removeProperty('--sq-fold-dur');
    d.__sqAnim = null;
  }

  function fold(d, opening) {
    var from = d.getBoundingClientRect().height;

    var to;
    if (opening) {
      d.open = true;
      to = summaryHeight(d) + contentHeight(d);
    } else {
      to = summaryHeight(d);
    }

    var delta = Math.abs(to - from);

    if (delta < 8) {
      d.open = opening;
      settle(d);
      return;
    }

    if (delta > FOLD_CAP) {
      d.open = opening;
      settle(d);
      if (opening) {
        d.setAttribute('data-sq-folding', 'fade');
        d.style.setProperty('--sq-fold-dur', '260ms');
        window.setTimeout(function () {
          if (d.getAttribute('data-sq-folding') === 'fade') settle(d);
        }, 320);
      }
      return;
    }

    var dur = Math.round(Math.min(FOLD_MAX, Math.max(FOLD_MIN, delta * 0.35)));
    if (!opening) dur = Math.round(dur * 0.72);

    d.style.setProperty('--sq-fold-dur', dur + 'ms');
    d.setAttribute('data-sq-folding', opening ? 'in' : 'out');
    d.style.height = from + 'px';
    d.__sqAnim = opening;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (d.__sqAnim !== opening) return;
        d.style.height = to + 'px';
      });
    });

    var done = function (e) {
      if (e && e.target !== d) return;
      if (d.__sqAnim !== opening) return;
      d.removeEventListener('transitionend', done);
      d.open = opening;
      settle(d);
    };
    d.addEventListener('transitionend', done);
    window.setTimeout(function () { if (d.__sqAnim === opening) done(null); }, dur + 90);
  }

  function bindFolds() {
    if (reduce) return;

    document.addEventListener('click', function (e) {
      try {
        var s = e.target.closest && e.target.closest('summary');
        if (!s) return;
        var d = s.parentElement;
        if (!d || d.tagName !== 'DETAILS' || !foldable(d)) return;

        if (e.target !== s && e.target.closest('a, button, input, select, label')) return;

        e.preventDefault();
        fold(d, !d.open);
      } catch (err) {
        try {
          var s2 = e.target.closest && e.target.closest('summary');
          if (s2 && s2.parentElement && s2.parentElement.tagName === 'DETAILS') {
            var d2 = s2.parentElement;
            d2.open = !d2.open;
            settle(d2);
          }
        } catch (e2) {}
      }
    });

    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS') return;
      if (d.__sqAnim === undefined || d.__sqAnim === null) return;
      if (d.__sqAnim === d.open) return;
      d.__sqAnim = null;
      settle(d);
    }, true);
  }

  function buildReadbar() {
    if (reduce) return;
    if (document.querySelector('.readbar')) return;

    var bar = document.createElement('div');
    bar.className = 'readbar';
    bar.innerHTML = '<i></i>';
    var fill = bar.firstChild;
    document.body.appendChild(bar);

    var ticking = false;
    function draw() {
      ticking = false;
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 40 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      fill.style.width = (p * 100).toFixed(2) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(draw); }
    }, { passive: true });
    draw();
  }


  function measureNav() {
    try {
      var nav = document.querySelector('nav:not(.rung-rail)');
      if (!nav) return;
      var h = Math.round(nav.getBoundingClientRect().height);
      if (h > 0 && h < 260) document.documentElement.style.setProperty('--nav-h', h + 'px');
    } catch (e) {}
  }

  function labelFor(h) {
    var t = '';
    try {
      var first = h.firstElementChild;
      if (first && h.childNodes.length > 1) {
        var d = window.getComputedStyle(first).display;
        if (d === 'block' || d === 'flex' || d === 'grid') t = first.textContent;
      }
    } catch (e) {}
    if (!t) t = h.textContent;
    return String(t || '').replace(/\s+/g, ' ').trim();
  }

  function editable(el) { return window.SymbiQ.core.editable(el); }

  function buzz() {
    if (reduce) return;
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }

  function jumpToHeading(h, andThen) {
    if (!h) return;
    var d = h.closest ? h.closest('details') : null;
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
    var y = h.getBoundingClientRect().top + window.pageYOffset - 88;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    if (h.id && history.replaceState) history.replaceState(null, '', '#' + h.id);
    buzz();
    if (andThen) window.setTimeout(andThen, reduce ? 0 : 420);
  }

  var MARKER = null;

  function buildMarker() {
    var mq = window.matchMedia ? window.matchMedia('(max-width: 1439px)') : null;
    if (mq && !mq.matches) return;

    var wrap = document.querySelector('.wrap') || document.body;
    var heads = [].slice.call(wrap.querySelectorAll('h2')).filter(function (h) {
      if (h.closest('nav, footer, .sqrail, .sq-marker')) return false;
      return h.getClientRects().length > 0;
    });
    if (heads.length < 4) return;
    if (document.documentElement.scrollHeight < window.innerHeight * 3) return;

    heads.forEach(function (h, i) { if (!h.id) h.id = 'sqm-' + i; });

    var box = document.createElement('div');
    box.className = 'sq-marker';

    var listId = 'sq-marker-list';
    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'sq-marker-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', listId);
    tab.setAttribute('aria-label', 'Sections on this page');
    tab.innerHTML =
      '<span class="sq-marker-glyph" aria-hidden="true">◈</span>' +
      '<span class="sq-marker-count">1/' + heads.length + '</span>' +
      '<span class="sq-marker-here"></span>';

    var list = document.createElement('div');
    list.className = 'sq-marker-list';
    list.id = listId;
    list.setAttribute('role', 'navigation');
    list.setAttribute('aria-label', 'Sections on this page');

    var topRow = document.createElement('button');
    topRow.type = 'button';
    topRow.className = 'sq-marker-top';
    topRow.innerHTML = '<span aria-hidden="true">↑</span><span>Back to top</span>';
    topRow.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      buzz();
      close();
      window.setTimeout(spy, reduce ? 0 : 420);
    });
    list.appendChild(topRow);

    var items = heads.map(function (h, i) {
      var lab = labelFor(h);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq-marker-item';
      b.innerHTML = '<span class="sq-marker-idx">' + (i + 1) + '</span><span>' +
                    lab.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
      b.addEventListener('click', function () {
        close();
        jumpToHeading(h, spy);
      });
      list.appendChild(b);
      return b;
    });

    box.appendChild(list);
    box.appendChild(tab);
    document.body.appendChild(box);

    var here = tab.querySelector('.sq-marker-here');
    var count = tab.querySelector('.sq-marker-count');
    var open = false;

    function setOpen(v) {
      open = v;
      if (v) box.setAttribute('data-open', ''); else box.removeAttribute('data-open');
      tab.setAttribute('aria-expanded', v ? 'true' : 'false');
    }
    function close() {
      if (!open) return;
      setOpen(false);
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
    }
    function onDocClick(e) { if (!box.contains(e.target)) close(); }
    function onKey(e) {
      if (e.key === 'Escape') { close(); tab.focus(); return; }
      var focusables = [topRow].concat(items);
      var at = focusables.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (at < 0) at = 0;
        else at += (e.key === 'ArrowDown' ? 1 : -1);
        if (at < 0) at = focusables.length - 1;
        if (at >= focusables.length) at = 0;
        focusables[at].focus();
      } else if (e.key === 'Home') { e.preventDefault(); focusables[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); focusables[focusables.length - 1].focus(); }
    }
    function toggle(force) {
      var want = (typeof force === 'boolean') ? force : !open;
      if (want === open) return;
      if (want) {
        setOpen(true);
        var cur = list.querySelector('[aria-current="true"]') || items[0];
        if (cur) cur.focus();
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onKey, true);
      } else {
        close();
      }
    }
    tab.addEventListener('click', function () { toggle(); });

    var ty0 = 0, tx0 = 0;
    box.addEventListener('touchstart', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return; ty0 = t.clientY; tx0 = t.clientX;
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dy = t.clientY - ty0, dx = t.clientX - tx0;
      if (Math.abs(dy) < 34 || Math.abs(dx) > Math.abs(dy)) return;
      if (dy < 0 && !open) toggle(true);
      else if (dy > 0 && open) toggle(false);
    }, { passive: true });

    var raf = 0, curIdx = -1;
    function spy() {
      raf = 0;
      var idx = 0;
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].getBoundingClientRect().top <= 130) idx = i; else break;
      }
      if (idx === curIdx) return;
      curIdx = idx;
      count.textContent = (idx + 1) + '/' + heads.length;
      here.textContent = labelFor(heads[idx]);
      items.forEach(function (b, i) {
        if (i === idx) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }
    function onScroll() { if (!raf) raf = window.requestAnimationFrame(spy); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    spy();

    MARKER = {
      heads: heads,
      toggle: toggle,
      isOpen: function () { return open; },
      current: function () { return curIdx; }
    };
  }

  var HELP = null;

  function buildHelp() {
    if (HELP) return HELP;
    var wrapEl = document.querySelector('.wrap') || document.body;
    var hasSections = wrapEl.querySelectorAll('h2').length >= 2;
    var hasGates = !!(window.SymbiQ && window.SymbiQ.qubit);

    var rows = [];
    rows.push(['<kbd>?</kbd>', 'Show / hide this list']);
    if (hasSections) {
      rows.push(['<kbd>j</kbd><kbd>k</kbd>', 'Next / previous section']);
      if (MARKER) rows.push(['<kbd>m</kbd>', 'Open the section list']);
    }
    rows.push(['<kbd>g</kbd><kbd>g</kbd> / <kbd>G</kbd>', 'Top of the page / bottom']);
    rows.push(['<kbd>d</kbd>', 'Cycle the appearance: system, light, dim, dark']);
    rows.push(['<kbd>/</kbd> or <kbd>Ctrl</kbd><kbd>K</kbd>', 'Search the whole site']);
    rows.push(['<kbd>Esc</kbd>', 'Close a menu or overlay']);
    if (hasGates) {
      rows.push(['<kbd>X</kbd>&hairsp;&hellip;&hairsp;<kbd>T</kbd>', 'Turn the page-state qubit (bottom-right)']);
      rows.push(['<kbd>M</kbd> / <kbd>R</kbd>', 'Measure it / reset it']);
    }

    var ov = document.createElement('div');
    ov.className = 'sq-help';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Keyboard shortcuts');
    ov.innerHTML =
      '<div class="sq-help-card" tabindex="-1">' +
        '<h2>Keyboard</h2>' +
        rows.map(function (r) {
          return '<div class="sq-help-row"><span class="sq-help-keys">' + r[0] +
                 '</span><span class="sq-help-what">' + r[1] + '</span></div>';
        }).join('') +
        '<p class="sq-help-hint">Press <kbd>?</kbd> or <kbd>Esc</kbd> to close.</p>' +
      '</div>';
    document.body.appendChild(ov);

    var card = ov.querySelector('.sq-help-card');
    var lastFocus = null;
    function shut() {
      ov.removeAttribute('data-open');
      document.removeEventListener('keydown', trap, true);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function openIt() {
      lastFocus = document.activeElement;
      ov.setAttribute('data-open', '');
      card.focus();
      document.addEventListener('keydown', trap, true);
    }
    function trap(e) {
      if (e.key === 'Escape' || (e.key === '?' && !editable(e.target))) { e.preventDefault(); shut(); }
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });

    HELP = { el: ov, toggle: function () { ov.hasAttribute('data-open') ? shut() : openIt(); } };
    return HELP;
  }

  function bindKeys() {
    function heads() {
      if (MARKER && MARKER.heads.length) return MARKER.heads;
      var w = document.querySelector('.wrap') || document.body;
      return [].slice.call(w.querySelectorAll('h2')).filter(function (h) {
        return !h.closest('nav, footer, .sqrail, .sq-marker, .sq-help') &&
               h.getClientRects().length > 0;
      });
    }
    function step(dir) {
      var hs = heads();
      if (!hs.length) return;
      var y = window.pageYOffset + 132;
      var idx = -1;
      for (var i = 0; i < hs.length; i++) {
        if (hs[i].getBoundingClientRect().top + window.pageYOffset <= y) idx = i; else break;
      }
      var next = idx + dir;
      if (next < 0) next = 0;
      if (next >= hs.length) next = hs.length - 1;
      jumpToHeading(hs[next]);
    }

    var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                  'ArrowLeft', 'ArrowRight', 'b', 'a'];
    var kAt = 0, kBusy = false;
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || kBusy) return;
      if (editable(e.target) || editable(document.activeElement)) return;
      var k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === KONAMI[kAt]) kAt++; else kAt = (k === KONAMI[0]) ? 1 : 0;
      if (kAt < KONAMI.length) return;
      kAt = 0;
      var q = window.SymbiQ.qubit;
      if (!q || !q.apply) return;
      kBusy = true;
      if (q.reset) q.reset();
      var seq = ['X', 'X', 'Z', 'Z', 'H', 'H', 'Y', 'Y'], i = 0;
      (function next() {
        if (i < seq.length) { q.apply(seq[i++]); window.setTimeout(next, reduce ? 60 : 300); return; }
        if (q.say) q.say('8 gates, each undone by its twin. Back at |0\u27E9, exactly.', 5000);
        kBusy = false;
      })();
    });

    var gAt = 0;
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (editable(e.target) || editable(document.activeElement)) return;

      if (e.key === '?') { e.preventDefault(); buildHelp().toggle(); return; }
      if (e.key === 'm' && MARKER) { e.preventDefault(); MARKER.toggle(); return; }
      if (MARKER && MARKER.isOpen()) return;

      var now = Date.now();
      if (e.key === 'g') {
        if (gAt && now - gAt < 900) {
          gAt = 0; e.preventDefault();
          window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        } else { gAt = now; }
        return;
      }
      gAt = 0;
      if (e.key === 'G') {
        e.preventDefault();
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
      if (e.key === 'd' && window.SymbiQ.theme) {
        e.preventDefault();
        var t = window.SymbiQ.theme.cycle();
        if (window.SymbiQ.qubit && window.SymbiQ.qubit.say) window.SymbiQ.qubit.say('appearance: ' + t, 2200);
        return;
      }
      if (e.key === 'j' || e.key === 'n') { e.preventDefault(); step(1); return; }
      if (e.key === 'k' || e.key === 'p') { e.preventDefault(); step(-1); return; }
    });
  }

  var VERDICT_MS = 900;

  function flareVerdict(el) {
    try {
      if (el.hasAttribute('data-sq-verdict')) return;
      function clr(e) {
        if (e && e.target !== el) return;
        el.removeEventListener('animationend', clr);
        el.removeAttribute('data-sq-verdict');
      }
      el.addEventListener('animationend', clr);
      window.setTimeout(function () { clr(null); }, VERDICT_MS + 350);
      el.removeAttribute('data-sq-verdict');
      void el.offsetWidth;
      el.setAttribute('data-sq-verdict', '');
    } catch (e) {}
  }

  function bindVerdicts() {
    if (!('MutationObserver' in window)) return;
    var seen = [];
    function watch(el) {
      if (!el || seen.indexOf(el) !== -1) return;
      seen.push(el);
      var armed = false;
      window.setTimeout(function () { armed = true; }, 400);
      var pending = 0;
      var mo = new MutationObserver(function () {
        if (!armed) return;
        window.clearTimeout(pending);
        pending = window.setTimeout(function () {
          if (el.offsetParent !== null || el.getClientRects().length) flareVerdict(el);
        }, 40);
      });
      try {
        mo.observe(el, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
    }
    var SEL = '.verdict, #dq-out, #tryit-out, [id$="-out"], [id$="-verdict"],'
            + ' [id$="-readout"], [id$="-say"], [id$="-out2"]';
    function sweep() {
      try { [].slice.call(document.querySelectorAll(SEL)).forEach(watch); } catch (e) {}
    }
    sweep();
    [700, 1800, 4000].forEach(function (t) { window.setTimeout(sweep, t); });
  }

  function boot() {
    try { measureNav(); } catch (e) {}
    try { buildPermalinks(); } catch (e) {}
    try { bindFolds(); } catch (e) {}
    try { buildReadbar(); } catch (e) {}
    try { bindVerdicts(); } catch (e) {}
    try { buildMarker(); } catch (e) {}
    try { bindKeys(); } catch (e) {}

    try {
      if ('ResizeObserver' in window) {
        var nav = document.querySelector('nav:not(.rung-rail)');
        if (nav) new ResizeObserver(measureNav).observe(nav);
      } else {
        window.addEventListener('resize', measureNav, { passive: true });
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
;
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
;
(function () {
  'use strict';

  var root = document.documentElement;
  var THEMES = ['system', 'light', 'dim', 'dark'];
  var BG = { light: '#f8fafc', dim: '#0e1420', dark: '#0b0f1a' };

  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  function osDark() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
    catch (e) { return true; }
  }

  function currentTheme() {
    var t = store.get('sq-theme');
    return THEMES.indexOf(t) > 0 ? t : 'system';
  }

  function applyTheme(t) {
    if (t === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        var resolved = t === 'system' ? (osDark() ? BG.dark : BG.light) : BG[t];
        if (resolved) meta.setAttribute('content', resolved);
      }
    } catch (e) {}
  }

  function applyPref(name, key) {
    var v = store.get(key);
    if (v === 'reduce') root.setAttribute(name, 'reduce');
    else root.removeAttribute(name);
  }

  try {
    applyTheme(currentTheme());
    applyPref('data-motion-pref', 'sq-motion');
    applyPref('data-transparency-pref', 'sq-transparency');
  } catch (e) {}

  try {
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onOS = function () { if (currentTheme() === 'system') applyTheme('system'); };
      if (mq.addEventListener) mq.addEventListener('change', onOS);
      else if (mq.addListener) mq.addListener(onOS);
    }
  } catch (e) {}

  function build() {
    var foot = document.querySelector('footer');
    if (!foot || foot.querySelector('.sq-appear')) return;

    var wrap = document.createElement('div');
    wrap.className = 'sq-appear';

    var lab = document.createElement('span');
    lab.className = 'sq-appear-lab';
    lab.textContent = 'Appearance';
    wrap.appendChild(lab);

    var seg = document.createElement('div');
    seg.className = 'sq-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', 'Colour theme');
    var cur = currentTheme();
    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      b.setAttribute('data-theme-val', t);
      b.setAttribute('aria-pressed', String(t === cur));
      b.addEventListener('click', function () {
        if (t === 'system') store.del('sq-theme'); else store.set('sq-theme', t);
        applyTheme(t);
        syncSeg(seg);
      });
      seg.appendChild(b);
    });
    wrap.appendChild(seg);

    wrap.appendChild(makeToggle('Reduce motion', 'sq-motion', 'data-motion-pref'));
    wrap.appendChild(makeToggle('Reduce transparency', 'sq-transparency', 'data-transparency-pref'));

    foot.appendChild(wrap);
  }

  function makeToggle(text, key, attr) {
    var l = document.createElement('label');
    l.className = 'sq-appear-tog';
    var i = document.createElement('input');
    i.type = 'checkbox';
    i.checked = store.get(key) === 'reduce';
    i.addEventListener('change', function () {
      if (i.checked) store.set(key, 'reduce'); else store.del(key);
      applyPref(attr, key);
    });
    l.appendChild(i);
    l.appendChild(document.createTextNode(' ' + text));
    return l;
  }

  function cycleTheme() {
    var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    if (next === 'system') store.del('sq-theme'); else store.set('sq-theme', next);
    applyTheme(next);
    var seg = document.querySelector('.sq-appear .sq-seg');
    if (seg) syncSeg(seg);
    return next;
  }
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.theme = { cycle: cycleTheme, current: currentTheme };

  function syncSeg(seg) {
    var cur = currentTheme();
    [].forEach.call(seg.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-val') === cur));
    });
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', build);
    } else {
      build();
    }
  } catch (e) {}

  try {
    window.addEventListener('storage', function (ev) {
      if (!ev || ev.key === null || ev.key.indexOf('sq-') !== 0) return;
      applyTheme(currentTheme());
      applyPref('data-motion-pref', 'sq-motion');
      applyPref('data-transparency-pref', 'sq-transparency');
      var seg = document.querySelector('.sq-appear .sq-seg');
      if (seg) syncSeg(seg);
      var togs = document.querySelectorAll('.sq-appear-tog input');
      if (togs[0]) togs[0].checked = store.get('sq-motion') === 'reduce';
      if (togs[1]) togs[1].checked = store.get('sq-transparency') === 'reduce';
    });
  } catch (e) {}

})();
;
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-glass')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { }

  try {
    var root = document.documentElement;
    var ticking = false;
    var on = false;

    var evaluate = function () {
      ticking = false;
      var y = window.pageYOffset || root.scrollTop || 0;
      if (!on && y > 40) { on = true; root.setAttribute('data-scrolled', ''); }
      else if (on && y < 24) { on = false; root.removeAttribute('data-scrolled'); }
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate();
  } catch (e) { }

  if (!reduce) try {
    var nav = document.querySelector('nav:not(.rung-rail)');
    if (nav) {
      var navTick = false;
      var mx = 50, my = -20;

      var paint = function () {
        navTick = false;
        nav.style.setProperty('--dyn-x', mx + '%');
        nav.style.setProperty('--dyn-y', my + '%');
      };

      nav.addEventListener('pointermove', function (ev) {
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        mx = (ev.clientX / w) * 100;
        my = (ev.clientY / h) * 100;
        if (navTick) return;
        navTick = true;
        window.requestAnimationFrame(paint);
      }, { passive: true });

      nav.addEventListener('pointerleave', function () {
        nav.style.removeProperty('--dyn-x');
        nav.style.removeProperty('--dyn-y');
      });
    }
  } catch (e) { }

  try {
    var fine = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (fine && window.innerWidth >= 720) {
      var menus = [].slice.call(document.querySelectorAll('.navcat'));

      menus.forEach(function (cat) {
        if (cat.classList.contains('sq-account')) return;
        var shutT;

        cat.addEventListener('pointerenter', function (ev) {
          if (ev.pointerType === 'touch') return;
          window.clearTimeout(shutT);
          if (!cat.open) cat.open = true;
        });

        cat.addEventListener('pointerleave', function (ev) {
          if (ev.pointerType === 'touch') return;
          window.clearTimeout(shutT);
          shutT = window.setTimeout(function () {
            if (!cat.contains(document.activeElement)) cat.open = false;
          }, 220);
        });
      });
    }
  } catch (e) { }

})();
;
(function () {
  'use strict';
  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var card = null, backdrop = null, openTrigger = null, sticky = false;
  var hideTimer = null, showTimer = null;
  var fineHover = false;
  try { fineHover = !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) {}

  function ensureCard() {
    if (card) return card;
    card = D.createElement('div');
    card.className = 'sig-card';
    card.setAttribute('role', 'note');
    card.tabIndex = -1;
    card.addEventListener('pointerenter', function () { clearTimeout(hideTimer); });
    card.addEventListener('pointerleave', function () { scheduleHide(false); });
    D.body.appendChild(card);
    backdrop = D.createElement('div');
    backdrop.className = 'sig-backdrop';
    backdrop.addEventListener('click', function () { close(true); });
    D.body.appendChild(backdrop);
    return card;
  }

  function place(trigger) {
    card.style.maxWidth = Math.max(200, Math.min(320, D.documentElement.clientWidth - 24)) + 'px';
    var r = trigger.getBoundingClientRect();
    var cw = card.offsetWidth, ch = card.offsetHeight;
    var margin = 10;
    var left = r.left + W.scrollX;
    var maxLeft = D.documentElement.clientWidth - cw - margin + W.scrollX;
    if (left > maxLeft) left = Math.max(margin + W.scrollX, maxLeft);
    var top = r.bottom + W.scrollY + 8;
    var below = r.bottom + ch + 16;
    if (below > D.documentElement.clientHeight && r.top > ch + 16) {
      top = r.top + W.scrollY - ch - 8;
    }
    card.style.left = left + 'px';
    card.style.top = top + 'px';
  }

  function open(trigger, html, opts) {
    ensureCard();
    opts = opts || {};
    if (openTrigger && openTrigger !== trigger) openTrigger.setAttribute('aria-expanded', 'false');
    card.innerHTML = html;
    card.classList.add('open');
    if (backdrop) backdrop.classList.toggle('open', W.matchMedia && W.matchMedia('(pointer: coarse)').matches);
    trigger.setAttribute('aria-expanded', 'true');
    openTrigger = trigger;
    sticky = !!opts.sticky;
    var coarse = W.matchMedia && W.matchMedia('(pointer: coarse)').matches;
    if (!coarse) place(trigger);
    else { card.style.maxWidth = ''; card.style.left = ''; card.style.top = ''; }
  }

  function close(force) {
    if (!card || !card.classList.contains('open')) return;
    if (sticky && !force) return;
    card.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    if (openTrigger) { openTrigger.setAttribute('aria-expanded', 'false'); openTrigger = null; }
    sticky = false;
  }

  function scheduleHide(force) {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { close(force); }, 200);
  }

  D.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
  D.addEventListener('click', function (e) {
    if (!card || !card.classList.contains('open')) return;
    if (card.contains(e.target)) return;
    if (e.target.closest && (e.target.closest('.lx-term') || e.target.closest('.rcpt'))) return;
    close(true);
  }, true);

  W.SymbiQ.sig = { open: open, close: close, scheduleHide: scheduleHide, clearHide: function () { clearTimeout(hideTimer); }, fineHover: fineHover };

  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  var SKIP_SEL = 'nav, footer, script, style, noscript, textarea, select, svg, code, ' +
    '.formula, .ket, a, button, .hud, .lx-term, .rcpt, .navpanel, .cyu, .g-ceremony, ' +
    '.sq-account, .verdict, .sig-card, h1, h2, h3, [data-no-lexicon]';

  function pageBasename() {
    var p = (W.location && W.location.pathname) || '';
    var b = p.split('/').pop();
    return b || 'index.html';
  }

  function tierLabel(t) {
    return t === 'g' ? '🟢 Beginner' : t === 'y' ? '🟡 Working' : t === 'r' ? '🔴 Formal' : '';
  }

  function buildCardHtml(meta) {
    var tier = tierLabel(meta.tier);
    var foot = '<div class="sig-card-foot">';
    if (tier) foot += '<span class="tier ' + meta.tier + '">' + tier + '</span>';
    else foot += '<span class="sig-card-kind">' + (meta.kind === 'game' ? 'Game' : meta.kind === 'tool' ? 'Tool' : '') + '</span>';
    var href = meta.page + (meta.anchor ? '#' + meta.anchor : '');
    var linkText = meta.anchor ? 'read it in full ▸' : 'open the page ▸';
    foot += '<a class="sig-card-link cta" href="' + href + '">' + linkText + '</a></div>';
    return '<p class="sig-card-title">' + meta.term + '</p>' +
      '<p class="sig-card-body">' + meta.blurb + '</p>' + foot;
  }

  function run(concepts) {
    var here = pageBasename();
    var byId = {}, patterns = [];
    concepts.forEach(function (c) {
      if (!c.blurb || !c.page || c.generic) return;
      if (c.page === here) return;
      byId[c.id] = c;
      var forms = [c.term].concat(c.aliases || []);
      forms.forEach(function (t) {
        if (!t || t.length < 2) return;
        patterns.push({ text: t, id: c.id });
      });
    });
    if (!patterns.length) return;

    patterns.sort(function (a, b) { return b.text.length - a.text.length; });
    var map = {};
    var alt = patterns.map(function (p) {
      if (!(p.text in map)) map[p.text] = p.id;
      return reEsc(p.text);
    }).join('|');
    var RE = new RegExp('(?<!\\w)(?:' + alt + ')(?!\\w)', 'g');

    var NF = W.NodeFilter;
    var root = D.querySelector('.wrap') || D.body;
    var walker = D.createTreeWalker(root, NF.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NF.FILTER_REJECT;
        var el = n.parentElement;
        if (!el || (el.closest && el.closest(SKIP_SEL))) return NF.FILTER_REJECT;
        return NF.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    var used = {};
    var totalCap = Object.keys(byId).length;
    var usedCount = 0;

    nodes.forEach(function (node) {
      if (usedCount >= totalCap) return;
      var text = node.nodeValue;
      RE.lastIndex = 0;
      var m, last = 0, frag = null;
      while ((m = RE.exec(text))) {
        var matched = m[0];
        var id = map[matched];
        if (!id || used[id] || !byId[id]) continue;
        if (!frag) frag = D.createDocumentFragment();
        frag.appendChild(D.createTextNode(text.slice(last, m.index)));
        var span = D.createElement('span');
        span.className = 'lx-term';
        span.setAttribute('data-lx', id);
        span.setAttribute('tabindex', '0');
        span.setAttribute('role', 'button');
        span.setAttribute('aria-expanded', 'false');
        span.textContent = matched;
        frag.appendChild(span);
        last = m.index + matched.length;
        used[id] = true;
        usedCount++;
        if (usedCount >= totalCap) break;
      }
      if (frag) {
        frag.appendChild(D.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    });

    Array.prototype.forEach.call(D.querySelectorAll('.lx-term[data-lx]'), function (span) {
      var meta = byId[span.getAttribute('data-lx')];
      if (!meta) return;
      var html = buildCardHtml(meta);
      span.addEventListener('click', function (e) {
        e.stopPropagation();
        if (span.getAttribute('aria-expanded') === 'true') W.SymbiQ.sig.close(true);
        else W.SymbiQ.sig.open(span, html, { sticky: true });
      });
      span.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); span.click(); }
      });
      if (W.SymbiQ.sig.fineHover) {
        span.addEventListener('pointerenter', function () {
          W.SymbiQ.sig.clearHide();
          showTimer = setTimeout(function () {
            if (span.getAttribute('aria-expanded') !== 'true') W.SymbiQ.sig.open(span, html, { sticky: false });
          }, 120);
        });
        span.addEventListener('pointerleave', function () {
          clearTimeout(showTimer);
          W.SymbiQ.sig.scheduleHide(false);
        });
      }
    });
  }

  function boot() {
    try {
      fetch('data/concepts.json').then(function (res) {
        if (!res.ok) return null;
        return res.json();
      }).then(function (data) {
        if (!data || !data.concepts) return;
        run(data.concepts);
      }).catch(function () {});
    } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
(function () {
  'use strict';
  var W = window, D = document;

  function pageBasename() {
    var p = (W.location && W.location.pathname) || '';
    return p.split('/').pop() || 'index.html';
  }

  function buildHtml(r) {
    var deriv = '';
    if (r.formula) deriv += r.formula;
    if (r.inputs) deriv += (deriv ? ' · ' : '') + r.inputs;
    var html = '<p class="sig-card-title">' + r.value + '</p>';
    if (deriv) html += '<p class="sig-card-formula">' + deriv + '</p>';
    var origin = r.tool ? 'brute-forced by <code>' + r.tool + '</code>' : (r.source || '');
    var meta = origin + (r.verified_at ? ' · verified ' + r.verified_at : '');
    if (meta) html += '<p class="sig-card-meta">' + meta + '</p>';
    if (r.falsifier) html += '<p class="sig-card-wrong">wrong if: ' + r.falsifier + '</p>';
    return html;
  }

  function wireTrigger(span, html) {
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      if (span.getAttribute('aria-expanded') === 'true') W.SymbiQ.sig.close(true);
      else W.SymbiQ.sig.open(span, html, { sticky: true });
    });
    span.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); span.click(); }
    });
    if (W.SymbiQ.sig.fineHover) {
      var showTimer;
      span.addEventListener('pointerenter', function () {
        W.SymbiQ.sig.clearHide();
        showTimer = setTimeout(function () {
          if (span.getAttribute('aria-expanded') !== 'true') W.SymbiQ.sig.open(span, html, { sticky: false });
        }, 120);
      });
      span.addEventListener('pointerleave', function () {
        clearTimeout(showTimer);
        W.SymbiQ.sig.scheduleHide(false);
      });
    }
  }

  function buildToggle(count) {
    var row = D.createElement('div');
    row.className = 'rcpt-toggle-row';
    var btn = D.createElement('button');
    btn.type = 'button';
    btn.className = 'rcpt-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<span class="rcpt-toggle-dot" aria-hidden="true"></span><span data-r="label">Show the receipts</span>';
    var note = D.createElement('span');
    note.className = 'rcpt-toggle-note';
    note.textContent = count + (count === 1 ? ' verified figure on this page' : ' verified figures on this page');
    btn.addEventListener('click', function () {
      var on = D.body.classList.toggle('rcpt-on');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('[data-r="label"]').textContent = on ? 'Hide the receipts' : 'Show the receipts';
    });
    row.appendChild(btn);
    row.appendChild(note);
    return row;
  }

  function run(all) {
    var here = pageBasename();
    var mine = all.filter(function (r) { return r.page === here; });
    if (!mine.length) return;
    if (!W.SymbiQ || !W.SymbiQ.sig) return;

    var wired = 0;
    mine.forEach(function (r) {
      var span = D.querySelector('.rcpt[data-rcpt="' + r.id + '"]');
      if (!span) return;
      wireTrigger(span, buildHtml(r));
      wired++;
    });
    if (!wired) return;

    var h1 = D.querySelector('.wrap h1');
    if (!h1) return;
    var row = buildToggle(wired);
    h1.insertAdjacentElement('afterend', row);
  }

  function boot() {
    try {
      fetch('data/receipts.json').then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (data) {
        if (!data || !data.receipts) return;
        run(data.receipts);
      }).catch(function () {});
    } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var TIER_LABEL = { g: 'plain', y: 'working', r: 'formal' };
  var idx = null;
  var loading = null;
  var box = null;
  var input = null, list = null, status = null;
  var results = [], cursor = -1, lastFocus = null;

  var esc = window.SymbiQ.core.esc;

  function mark(escaped, tokens) {
    if (!tokens.length) return escaped;
    var re = new RegExp('(' + tokens.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function base() {
    return '';
  }

  function load() {
    if (idx) return Promise.resolve(idx);
    if (loading) return loading;
    loading = fetch(base() + 'data/search.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        idx = j;
        if (input) {
          var nC = 0;
          j.records.forEach(function (r) { if (r.k === 'c') nC++; });
          input.placeholder = 'Search ' + j.pages + ' pages and ' + nC + ' concepts…';
        }
        idx.records.forEach(function (r) {
          r._h = (r.h || '').toLowerCase();
          r._x = (r.x || '').toLowerCase();
          r._t = (r.t || '').toLowerCase();
          r._a = (r.alias || []).join(' ').toLowerCase();
        });
        return idx;
      })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function score(r, q, tokens) {
    var s = 0;
    if (r._h === q) s += 120;
    else if (r._h.indexOf(q) === 0) s += 70;
    else if (r._h.indexOf(q) >= 0) s += 45;
    if (r._a && r._a.indexOf(q) >= 0) s += 40;
    if (r._x.indexOf(q) >= 0) s += 12;
    if (r._t.indexOf(q) >= 0) s += 8;

    var hitAll = true;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var inH = r._h.indexOf(t) >= 0, inX = r._x.indexOf(t) >= 0,
          inT = r._t.indexOf(t) >= 0, inA = r._a.indexOf(t) >= 0;
      if (inH) s += 14;
      if (inA) s += 10;
      if (inX) s += 4;
      if (inT) s += 2;
      if (!(inH || inX || inT || inA)) hitAll = false;
    }
    if (!hitAll) return 0;
    return s + (r.w || 1) * 3;
  }

  function search(qRaw) {
    var q = qRaw.trim().toLowerCase();
    if (q.length < 2 || !idx) return [];
    var tokens = q.split(/\s+/).filter(Boolean);
    var out = [];
    for (var i = 0; i < idx.records.length; i++) {
      var s = score(idx.records[i], q, tokens);
      if (s > 0) out.push([s, idx.records[i]]);
    }
    out.sort(function (a, b) { return b[0] - a[0]; });
    return out.slice(0, 30).map(function (p) { return p[1]; });
  }

  function render(tokens) {
    if (!results.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = results.map(function (r, i) {
      var chip = r.k === 'c'
        ? '<span class="sr-kind sr-concept">concept</span>'
          + (TIER_LABEL[r.tier] ? '<span class="sr-tier t-' + esc(r.tier) + '">'
             + TIER_LABEL[r.tier] + '</span>' : '')
        : '<span class="sr-page">' + esc(r.t) + '</span>';
      return '<li><a class="sr-hit" id="sr-' + i + '" href="' + esc(r.p) + '"'
        + (i === cursor ? ' aria-current="true"' : '') + ' role="option">'
        + '<span class="sr-head">' + mark(esc(r.h), tokens) + chip + '</span>'
        + (r.x ? '<span class="sr-snip">' + mark(esc(r.x), tokens) + '</span>' : '')
        + '</a></li>';
    }).join('');
  }

  function setStatus(msg) { status.textContent = msg; }

  function update() {
    var qRaw = input.value;
    var tokens = qRaw.trim().toLowerCase().split(/\s+/).filter(Boolean);
    results = search(qRaw);
    cursor = results.length ? 0 : -1;
    render(tokens);
    if (qRaw.trim().length < 2) setStatus('Type at least two letters.');
    else if (!results.length) setStatus('Nothing matches “' + qRaw.trim() + '”.');
    else setStatus(results.length + (results.length === 30 ? '+ matches' : ' match'
         + (results.length === 1 ? '' : 'es')) + '. Arrow keys to move, Enter to open.');
  }

  function move(d) {
    if (!results.length) return;
    cursor = (cursor + d + results.length) % results.length;
    render(input.value.trim().toLowerCase().split(/\s+/).filter(Boolean));
    var el = document.getElementById('sr-' + cursor);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }

  function build() {
    if (box) return;
    box = document.getElementById('search');
    if (!box) {
      box = document.createElement('div');
      box.id = 'search';
      document.body.appendChild(box);
    }
    box.className = 'sr-wrap';
    box.hidden = true;
    box.innerHTML =
      '<div class="sr-scrim" data-sr-close></div>' +
      '<div class="sr-panel" role="dialog" aria-modal="true" aria-label="Search SymbiQ">' +
        '<div class="sr-top">' +
          '<input id="sr-input" type="search" autocomplete="off" spellcheck="false" ' +
            'placeholder="Search every page and concept…" aria-label="Search SymbiQ" ' +
            'role="combobox" aria-expanded="true" aria-controls="sr-list" aria-autocomplete="list">' +
          '<button type="button" class="sr-x" data-sr-close aria-label="Close search">Esc</button>' +
        '</div>' +
        '<p class="sr-status" id="sr-status" role="status" aria-live="polite"></p>' +
        '<ul class="sr-list" id="sr-list" role="listbox" aria-label="Search results"></ul>' +
        '<p class="sr-foot">Concepts jump straight to the depth they are taught at. ' +
          'Nothing here leaves your browser.</p>' +
      '</div>';
    document.body.appendChild(box);
    input = box.querySelector('#sr-input');
    list = box.querySelector('#sr-list');
    status = box.querySelector('#sr-status');

    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        var el = document.getElementById('sr-' + cursor);
        if (el) { e.preventDefault(); window.location.href = el.getAttribute('href'); }
      }
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-sr-close]')) { e.preventDefault(); close(); }
    });
  }

  function open(seed) {
    build();
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('sr-open');
    setStatus('Loading the index…');
    if (seed) input.value = seed;
    input.focus();
    input.select();
    load().then(function () { update(); }).catch(function (err) {
      setStatus('The search index could not be loaded (' + err.message +
                '). It lives at data/search.json.');
    });
  }

  function close() {
    if (!box || box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove('sr-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box && !box.hidden) { close(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault(); open(); return;
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (window.SymbiQ.core.editable(e.target)) return;
      e.preventDefault(); open();
    }
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#search"]');
    if (a) { e.preventDefault(); open(); }
  });

  SymbiQ.search = { open: open, close: close };
})();
;
