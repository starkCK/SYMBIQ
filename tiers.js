(function () {
  'use strict';

  var TIERS = ['g', 'y', 'r'];
  var META = {
    g: { chip: '🟢', name: 'No math',   blurb: 'One analogy. No equations.' },
    y: { chip: '🟡', name: 'Some math', blurb: 'Mechanism, and a worked number.' },
    r: { chip: '🔴', name: 'Real math', blurb: 'Derivations, sources, open problems.' }
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
