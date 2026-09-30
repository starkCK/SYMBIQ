(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) {}

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  function rgbOf(name, fallback) {
    try {
      var s = getComputedStyle(D.documentElement).getPropertyValue(name).trim();
      var m = /^#?([0-9a-f]{6})$/i.exec(s);
      if (m) {
        var n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
      if (m) return [+m[1], +m[2], +m[3]];
    } catch (e) {}
    return fallback;
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
  }

  var P_TH = 0.01;
  var A_PREF = 0.1;
  var ROUND_S = 1e-6;

  function pLogical(p, d) {
    return Math.min(0.5, A_PREF * Math.pow(p / P_TH, (d + 1) / 2));
  }
  function patchQubits(d) { return 2 * d * d - 1; }
  function lifetimeS(pL) { return ROUND_S / pL; }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
              '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
              '-': '⁻' };
  function sup(n) {
    return String(n).split('').map(function (c) { return SUP[c] || c; }).join('');
  }
  var log10 = Math.log10 || function (x) { return Math.log(x) / Math.LN10; };

  function sci(x) {
    if (!(x > 0)) return '0';
    if (x >= 0.01) return String(parseFloat(x.toPrecision(2)));
    var e = Math.floor(log10(x));
    var m = x / Math.pow(10, e);
    m = Math.round(m * 10) / 10;
    if (m >= 10) { m = m / 10; e += 1; m = Math.round(m * 10) / 10; }
    return m.toFixed(1) + '×' + '10' + sup(e);
  }

  function sigfig(v) {
    if (v >= 1000) return Math.round(v).toLocaleString('en-US');
    if (v >= 100) return String(Math.round(v));
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  function duration(s) {
    if (s < 999.5e-6) return [sigfig(s * 1e6), 'µs'];
    if (s < 0.9995) return [sigfig(s * 1e3), 'ms'];
    if (s < 60) return [sigfig(s), 's'];
    if (s < 3600) return [sigfig(s / 60), 'min'];
    if (s < 86400) return [sigfig(s / 3600), 'h'];
    if (s < 31557600) return [sigfig(s / 86400), 'days'];
    return [sigfig(s / 31557600), 'yr'];
  }

  W.SymbiQ.threshold = {
    pL: pLogical, qubits: patchQubits, lifetime: lifetimeS,
    sci: sci, duration: duration, pTh: P_TH, A: A_PREF, round: ROUND_S
  };

  function buildInstrument() {
    var box = $('#hero-inst');
    if (!box) return;
    var pIn = $('#ti-p', box), dIn = $('#ti-d', box);
    if (!pIn || !dIn) return;

    var pOut = $('#ti-pv', box), dOut = $('#ti-dv', box);
    var vPl = $('#ti-pl', box), vQb = $('#ti-qb', box), vLf = $('#ti-lf', box);
    var vLfU = $('#ti-lfu', box), vVer = $('#ti-verdict', box);
    var orb = $('#inst-orb'), orbRead = $('#ti-orb');

    function render() {
      var pTenths = +pIn.value;
      var p = pTenths / 1000;
      var d = +dIn.value;

      pOut.textContent = (pTenths / 10).toFixed(1) + '%';
      dOut.textContent = 'd = ' + d;
      pIn.setAttribute('aria-valuetext', (pTenths / 10).toFixed(1) + '% physical error rate');
      dIn.setAttribute('aria-valuetext', 'code distance ' + d);

      var pl = pLogical(p, d);
      vPl.textContent = sci(pl);
      vQb.textContent = patchQubits(d).toLocaleString('en-US');
      var lf = duration(lifetimeS(pl));
      vLf.textContent = lf[0];
      vLfU.textContent = lf[1];

      if (p < P_TH) {
        vVer.className = 'verdict good';
        vVer.textContent = 'Below threshold. Each step of two in d divides p'
          + 'ₗ by ' + sigfig(P_TH / p) + '×.';
      } else if (p === P_TH) {
        vVer.className = 'verdict split';
        vVer.textContent = 'Exactly at threshold. More qubits change nothing — the code treads water.';
      } else {
        vVer.className = 'verdict bad';
        vVer.textContent = 'Above threshold. More qubits make it worse, not better.';
      }

      if (orb && orbRead) {
        var v = p < P_TH ? 'good' : (p === P_TH ? 'split' : 'bad');
        orb.setAttribute('data-verdict', v);
        orbRead.innerHTML = v === 'good'
          ? '<b>' + lf[0] + ' ' + lf[1] + '</b> lifetime at d = ' + d
          : '<b>' + (v === 'split' ? 'At threshold' : 'Above threshold') + '</b> at '
            + (pTenths / 10).toFixed(1) + '%';
      }
    }

    pIn.addEventListener('input', render);
    dIn.addEventListener('input', render);
    render();
  }

  var FLOAT = null;
  var HEADER_CLEAR = 84;
  var EDGE = 12;
  var ROOM_MIN = 1024;

  function bindFloat() {
    var box = $('#hero-inst'), orb = $('#inst-orb'), hero = $('.hero2');
    if (!box || !orb || typeof box.showPopover !== 'function') return;

    var dragged = false;

    function isOpen() {
      try { return box.matches(':popover-open'); } catch (e) { return false; }
    }
    function sheet() { return W.innerWidth < 720; }
    function roomy() { return !!hero && !dragged && W.innerWidth >= ROOM_MIN; }
    function undock() {
      box.removeAttribute('data-dock');
      if (hero) hero.classList.remove('inst-room');
    }

    function put(left, top) {
      var w = box.offsetWidth || 304;
      var h = box.offsetHeight || 0;
      left = Math.max(EDGE, Math.min(left, W.innerWidth - w - EDGE));
      var maxTop = h ? W.innerHeight - h - EDGE : top;
      top = Math.max(HEADER_CLEAR, Math.min(top, maxTop));
      box.style.left = Math.round(left) + 'px';
      box.style.right = 'auto';
      box.style.setProperty('--inst-top', Math.round(top) + 'px');
    }

    function naturalSize() {
      var s = box.style;
      var keep = [s.display, s.visibility, s.position, s.maxHeight, s.transition];
      s.transition = 'none';
      s.display = 'block'; s.visibility = 'hidden'; s.position = 'fixed';
      s.maxHeight = 'none';
      var w = box.offsetWidth, h = box.offsetHeight + 8;
      s.display = keep[0]; s.visibility = keep[1]; s.position = keep[2];
      s.maxHeight = keep[3];
      void box.offsetHeight;
      s.transition = keep[4];
      return { w: w || 342, h: h || 520 };
    }

    function dock() {
      hero.classList.add('inst-room');
      box.setAttribute('data-dock', '');
      var w = naturalSize().w;
      var hr = hero.getBoundingClientRect(), r = orb.getBoundingClientRect();
      var sx = W.scrollX || W.pageXOffset || 0, sy = W.scrollY || W.pageYOffset || 0;
      var top = Math.max(hr.top, Math.min(r.top, HEADER_CLEAR));
      var left = hr.right - w;
      box.style.left = Math.round(left + sx) + 'px';
      box.style.right = 'auto';
      box.style.setProperty('--inst-top', Math.round(top + sy) + 'px');
      box.style.transformOrigin =
        Math.round(r.left + r.width / 2 - left) + 'px ' + Math.round(r.top + r.height / 2 - top) + 'px';
    }

    function place() {
      if (roomy()) { dock(); return; }
      undock();
      if (sheet()) {
        box.style.left = ''; box.style.right = '';
        box.style.removeProperty('--inst-top');
        box.style.transformOrigin = '';
        return;
      }
      if (dragged && box.style.left) {
        put(parseFloat(box.style.left), parseFloat(box.style.getPropertyValue('--inst-top')));
        return;
      }
      var r = orb.getBoundingClientRect();
      var m = naturalSize(), w = m.w, h = m.h;
      var right = (r.left + r.width / 2) > W.innerWidth / 2;
      var left = right ? r.right - w : r.left;
      var top = Math.max(HEADER_CLEAR, Math.min(r.top, W.innerHeight - h - EDGE));
      left = Math.max(EDGE, Math.min(left, W.innerWidth - w - EDGE));
      box.style.left = Math.round(left) + 'px';
      box.style.right = 'auto';
      box.style.setProperty('--inst-top', Math.round(top) + 'px');
      box.style.transformOrigin =
        Math.round(r.left + r.width / 2 - left) + 'px ' + Math.round(r.top + r.height / 2 - top) + 'px';
    }

    box.addEventListener('beforetoggle', function (e) {
      if (e.newState === 'open') place();
    });
    box.addEventListener('toggle', function (e) {
      var open = e.newState === 'open';
      orb.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && hero) hero.classList.remove('inst-room');
      if (open) {
        try { box.focus({ preventScroll: true }); } catch (err) {}
      } else if (D.activeElement === D.body || box.contains(D.activeElement)) {
        try { orb.focus({ preventScroll: true }); } catch (err) {}
      }
    });
    orb.setAttribute('aria-expanded', 'false');

    function close() {
      if (!isOpen()) return false;
      try { box.hidePopover(); } catch (e) { return false; }
      try { orb.focus({ preventScroll: true }); } catch (e) {}
      return true;
    }

    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (close()) { e.preventDefault(); e.stopPropagation(); }
    });

    box.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || !isOpen()) return;
      var t = e.target;
      if (!t.closest || !t.closest('.inst-top, .inst-grip')) return;
      if (t.closest('button, a, input')) return;
      var asSheet = sheet();
      if (!asSheet && !(W.matchMedia && W.matchMedia('(pointer: fine)').matches)) return;

      var sx = e.clientX, sy = e.clientY;
      var l0 = parseFloat(box.style.left) || box.getBoundingClientRect().left;
      var t0 = parseFloat(box.style.getPropertyValue('--inst-top')) || box.getBoundingClientRect().top;
      var docked = box.hasAttribute('data-dock');
      if (docked) {
        l0 -= W.scrollX || W.pageXOffset || 0;
        t0 -= W.scrollY || W.pageYOffset || 0;
      }
      var dy = 0;
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
      box.setAttribute('data-drag', '');
      e.preventDefault();

      function move(ev) {
        if (asSheet) {
          dy = Math.max(0, ev.clientY - sy);
          box.style.transform = 'translateY(' + dy + 'px)';
          return;
        }
        if (docked) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return;
          docked = false;
          dragged = true;
          undock();
        }
        put(l0 + ev.clientX - sx, t0 + ev.clientY - sy);
      }
      function up() {
        box.removeEventListener('pointermove', move);
        box.removeEventListener('pointerup', up);
        box.removeEventListener('pointercancel', up);
        box.removeAttribute('data-drag');
        if (asSheet) {
          box.style.transform = '';
          if (dy > 70) close();
        } else if (!docked) {
          dragged = true;
        }
      }
      box.addEventListener('pointermove', move);
      box.addEventListener('pointerup', up);
      box.addEventListener('pointercancel', up);
    });

    var rt;
    W.addEventListener('resize', function () {
      if (!isOpen()) return;
      W.clearTimeout(rt);
      rt = W.setTimeout(place, 120);
    }, { passive: true });

    FLOAT = { el: box, orb: orb, isOpen: isOpen, close: close };
  }

  function bindParallax() {
    if (reduce) return;
    if (!(W.matchMedia && W.matchMedia('(pointer: fine)').matches)) return;
    var root = D.documentElement, pending = null, tick = 0;
    W.addEventListener('pointermove', function (e) {
      pending = e;
      if (tick) return;
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var x = (pending.clientX / W.innerWidth) * 2 - 1;
        var y = (pending.clientY / W.innerHeight) * 2 - 1;
        root.style.setProperty('--px', x.toFixed(3));
        root.style.setProperty('--py', y.toFixed(3));
      });
    }, { passive: true });
  }

  var RING_R = 20;
  var RING_C = 2 * Math.PI * RING_R;

  function ringSVG(cls) {
    return '<svg class="sqco-ring ' + (cls || '') + '" viewBox="0 0 48 48" aria-hidden="true">'
      + '<circle class="rg-track" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"/>'
      + '<circle class="rg-fill" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"'
      + ' stroke-dasharray="0 ' + RING_C.toFixed(2) + '" transform="rotate(-90 24 24)"/>'
      + '<text class="rg-num" x="24" y="28" text-anchor="middle">0</text></svg>';
  }

  var STATION_NAME = {
    hero: 'The argument',
    threshold: 'The threshold instrument',
    spine: 'The short version',
    router: 'Three doors',
    evidence: 'The evidence board',
    question: 'The Question',
    loop: 'The loop',
    games: 'Nine games',
    depth: 'Three depths',
    or: 'Operations research',
    pqc: 'Post-quantum security',
    timing: 'Why the timing matters',
    join: 'Join the loop'
  };
  var DOOR_OF = {
    games: ['quantum', 'the games section read'],
    or: ['or', 'the OR section read'],
    pqc: ['pqc', 'the security section read']
  };

  var COMPANION = null;

  function buildCompanion(stations) {
    var box = D.createElement('div');
    box.className = 'sqco';

    var tab = D.createElement('button');
    tab.type = 'button';
    tab.className = 'sqco-tab';
    tab.setAttribute('aria-expanded', 'false');
    tab.setAttribute('aria-controls', 'sqco-card');
    tab.setAttribute('aria-label', 'Reading progress and keyboard shortcuts');
    tab.innerHTML = ringSVG('rg-tab');

    var card = D.createElement('div');
    card.className = 'sqco-card';
    card.id = 'sqco-card';
    card.innerHTML =
      '<div class="sqco-head">' + ringSVG('rg-card') +
        '<span class="sqco-count"><b id="sqco-n">0</b> of ' + stations.length +
        ' stations<span>on this page</span></span>' +
        '<button type="button" class="sqco-x" aria-label="Collapse">×</button>' +
      '</div>' +
      '<p class="sqco-here"><b>You are here</b><span id="sqco-here">—</span></p>' +
      '<div class="sqco-keys">' +
        '<div><span>g h</span><span>top of the page</span></div>' +
        '<div><span>g p</span><span>the games</span></div>' +
        '<div><span>1 2 3</span><span>the three depths</span></div>' +
        '<div><span>j k</span><span>next / previous section</span></div>' +
        '<div><span>m</span><span>this card</span></div>' +
      '</div>' +
      '<button type="button" class="sqco-more">Every shortcut (?) ›</button>';

    box.appendChild(tab);
    box.appendChild(card);
    D.body.appendChild(box);

    var fills = $$('.rg-fill', box);
    var nums = $$('.rg-num', box);
    var nEl = $('#sqco-n', box);
    var hereEl = $('#sqco-here', box);
    var open = false;

    function setOpen(v) {
      open = !!v;
      if (open) box.setAttribute('data-open', ''); else box.removeAttribute('data-open');
      tab.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var x = $('.sqco-x', box); if (x) x.focus(); }
      else if (D.activeElement && box.contains(D.activeElement)) tab.focus();
    }
    tab.addEventListener('click', function () { setOpen(true); });
    $('.sqco-x', box).addEventListener('click', function () { setOpen(false); });
    $('.sqco-more', box).addEventListener('click', function () { KEYMAP().toggle(true); });

    COMPANION = {
      el: box,
      isOpen: function () { return open; },
      toggle: function (force) { setOpen(typeof force === 'boolean' ? force : !open); },
      show: function (v) {
        if (v) box.setAttribute('data-on', '');
        else { box.removeAttribute('data-on'); setOpen(false); }
      },
      progress: function (n, total, label) {
        var frac = total ? n / total : 0;
        var on = (RING_C * frac).toFixed(2);
        fills.forEach(function (f) { f.setAttribute('stroke-dasharray', on + ' ' + RING_C.toFixed(2)); });
        nums.forEach(function (t) { t.textContent = String(n); });
        if (nEl) nEl.textContent = String(n);
        if (hereEl) hereEl.textContent = label || '—';
      }
    };
    return COMPANION;
  }

  function bindStations() {
    var stations = $$('[data-station]');
    if (!stations.length) return;

    var co = buildCompanion(stations);
    var seen = {}, nSeen = 0, ledeSwitched = false;

    function stampDoor(name) {
      var d = DOOR_OF[name];
      if (!d) return;
      var card = $('.introute-card[data-track="' + d[0] + '"]');
      if (!card) return;
      if (card.classList.contains('resume')) return;
      var pg = card.querySelector('.pg');
      if (!pg) return;
      pg.textContent = '↻ ' + d[1];
      pg.hidden = false;
    }

    function mark(el) {
      var name = el.getAttribute('data-station');
      if (seen[name]) return;
      seen[name] = true;
      nSeen++;
      stampDoor(name);
      if (!ledeSwitched && nSeen > 3) {
        ledeSwitched = true;
        var lede = $('#introute-lede');
        if (lede) lede.textContent = 'Pick up where you left off.';
      }
    }

    var current = stations[0];
    function paint() { co.progress(nSeen, stations.length, STATION_NAME[current.getAttribute('data-station')] || ''); }

    if ('IntersectionObserver' in W) {
      var io = new W.IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          mark(e.target);
          current = e.target;
        });
        paint();
      }, { rootMargin: '-38% 0px -38% 0px', threshold: 0 });
      stations.forEach(function (s) { io.observe(s); });

      var orbEl = $('#inst-orb'), panel = $('#hero-inst');
      var orbOn = !!orbEl, panelOn = false;
      var sync = function () { co.show(!orbOn && !panelOn); };
      if (orbEl) {
        new W.IntersectionObserver(function (entries) {
          orbOn = entries[0].isIntersecting;
          sync();
        }, { threshold: 0 }).observe(orbEl);
      }
      if (panel) {
        panel.addEventListener('toggle', function (e) {
          panelOn = e.newState === 'open';
          sync();
        });
      }
      sync();
    } else {
      co.show(false);
    }
    paint();
  }

  var JUMP_OFF = 78;
  var FLARE_MS = 1300;

  function flare(el) {
    if (!el || reduce || !el.animate) return;
    var t = rgbOf('--teal', [45, 212, 191]);
    try {
      el.animate([
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.55), backgroundColor: rgba(t, 0.09), offset: 0.14 },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.30), backgroundColor: rgba(t, 0.05), offset: 0.55 },
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) }
      ], { duration: FLARE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    } catch (e) {}
  }

  function layoutTop(el) {
    var y = 0, n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  function snapTo(y) {
    var de = D.documentElement, prev = de.style.scrollBehavior;
    de.style.scrollBehavior = 'auto';
    W.scrollTo(0, y);
    de.style.scrollBehavior = prev;
  }

  var LAND = 0;
  function landOn(el) {
    var mine = ++LAND;
    var lastY = null, stillFor = 0, tries = 0, ticks = 0;
    (function tick() {
      if (mine !== LAND) return;
      if (++ticks > 60) return;
      var y = Math.round(W.pageYOffset);
      stillFor = (y === lastY) ? stillFor + 1 : 0;
      lastY = y;
      if (stillFor >= 2) {
        var want = Math.max(0, layoutTop(el) - JUMP_OFF);
        if (Math.abs(want - y) <= 2 || tries >= 3) return;
        tries++;
        stillFor = 0;
        snapTo(want);
      }
      W.setTimeout(tick, 50);
    })();
  }

  function jumpTo(el) {
    if (!el) return;
    var d = el.closest ? el.closest('details') : null;
    while (d) { d.open = true; d = d.parentElement ? d.parentElement.closest('details') : null; }
    W.scrollTo({ top: Math.max(0, layoutTop(el) - JUMP_OFF), behavior: reduce ? 'auto' : 'smooth' });
    flare(el);
    landOn(el);
  }
  function jumpTop() {
    LAND++;
    W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var h = $('.wrap h1');
    if (h) flare(h);
  }

  var _keymap = null;
  function KEYMAP() {
    if (_keymap) return _keymap;
    var hasQubit = !!(W.SymbiQ && W.SymbiQ.qubit);
    var rows = [
      ['<kbd>g</kbd><kbd>h</kbd> or <kbd>g</kbd><kbd>g</kbd>', 'Back to the top'],
      ['<kbd>G</kbd>', 'Down to the footer'],
      ['<kbd>d</kbd>', 'Cycle the appearance: system, light, dim, dark'],
      ['<kbd>/</kbd> or <kbd>Ctrl</kbd><kbd>K</kbd>', 'Search the whole site'],
      ['<kbd>g</kbd><kbd>p</kbd>', 'The games section'],
      ['<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>', 'The three depths: plain, working, formal'],
      ['<kbd>j</kbd><kbd>k</kbd>', 'Next / previous section'],
      ['<kbd>m</kbd>', 'Open or close the corner companion'],
      ['<kbd>i</kbd>', 'Fall through the field into the 3D machine'],
      ['<kbd>?</kbd>', 'Show / hide this list'],
      ['<kbd>Esc</kbd>', 'Close whatever is open']
    ];
    if (hasQubit) {
      rows.push(['<kbd>X</kbd>…<kbd>T</kbd>', 'Turn the page-state qubit (bottom-right)']);
      rows.push(['<kbd>M</kbd> / <kbd>R</kbd>', 'Measure it / reset it']);
    }

    var ov = D.createElement('div');
    ov.className = 'sqov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Keyboard shortcuts');
    ov.innerHTML =
      '<div class="sqov-card" tabindex="-1">' +
        '<h2>Keyboard</h2>' +
        rows.map(function (r) {
          return '<div class="sqov-row"><span class="sqov-keys">' + r[0] +
                 '</span><span class="sqov-what">' + r[1] + '</span></div>';
        }).join('') +
        '<p class="sqov-hint">One more, undocumented on purpose: type the first four primes.</p>' +
        '<button type="button" class="sqov-shut">Close</button>' +
      '</div>';
    D.body.appendChild(ov);
    _keymap = overlay(ov);
    return _keymap;
  }

  function overlay(ov) {
    var card = $('.sqov-card', ov);
    var last = null;
    function shut() {
      if (!ov.hasAttribute('data-open')) return false;
      ov.removeAttribute('data-open');
      if (last && last.focus) { try { last.focus(); } catch (e) {} }
      return true;
    }
    function show() {
      last = D.activeElement;
      ov.setAttribute('data-open', '');
      if (card) card.focus();
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
    var btn = $('.sqov-shut', ov);
    if (btn) btn.addEventListener('click', shut);
    return {
      el: ov,
      isOpen: function () { return ov.hasAttribute('data-open'); },
      close: shut,
      toggle: function (force) {
        var want = (typeof force === 'boolean') ? force : !ov.hasAttribute('data-open');
        if (want) show(); else shut();
      }
    };
  }

  function editable(el) { return W.SymbiQ.core.editable(el); }

  var NAVBTN = null;
  function buildNavButton() {
    var nav = $('nav:not(.rung-rail)');
    if (!nav) return;

    NAVBTN = D.createElement('button');
    NAVBTN.type = 'button';
    NAVBTN.className = 'sq-keyhint';
    NAVBTN.textContent = '?';
    NAVBTN.title = 'Keyboard shortcuts (?)';
    NAVBTN.setAttribute('aria-label', 'Keyboard shortcuts');
    NAVBTN.addEventListener('click', function () { KEYMAP().toggle(); });

    function insert() {
      var acct = $('#sq-account', nav);
      if (acct) nav.insertBefore(NAVBTN, acct); else nav.appendChild(NAVBTN);
    }

    function measure() {
      if (NAVBTN.parentNode) NAVBTN.remove();
      var without = nav.getBoundingClientRect().height;
      insert();
      if (nav.getBoundingClientRect().height > without + 1) NAVBTN.remove();
    }

    measure();
    [400, 1200, 3000].forEach(function (t) { W.setTimeout(measure, t); });

    var rt;
    W.addEventListener('resize', function () {
      W.clearTimeout(rt);
      rt = W.setTimeout(measure, 200);
    }, { passive: true });
  }

  function bindKeys() {
    var gAt = 0;
    var G_WINDOW = 900;
    var buf = '';

    D.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (editable(e.target) || editable(D.activeElement)) return;

      var k = e.key;

      if (k === 'Escape') {
        var closed = false;
        if (_keymap && _keymap.isOpen()) closed = _keymap.close() || closed;
        if (_primes && _primes.isOpen()) closed = _primes.close() || closed;
        if (DIVE && DIVE.isOpen()) closed = DIVE.close() || closed;
        if (COMPANION && COMPANION.isOpen()) { COMPANION.toggle(false); closed = true; }
        if (!closed && FLOAT && FLOAT.isOpen()) closed = FLOAT.close();
        if (closed) { e.preventDefault(); e.stopPropagation(); }
        return;
      }

      if (k && k.length === 1) {
        buf = (buf + k).slice(-4);
        if (buf === '2357') {
          buf = '';
          e.preventDefault();
          e.stopPropagation();
          PRIMES().toggle(true);
          return;
        }
      }

      var now = Date.now();
      if (k === 'g') {
        e.preventDefault();
        if (gAt && now - gAt < G_WINDOW) { gAt = 0; e.stopPropagation(); jumpTop(); return; }
        gAt = now;
        return;
      }
      if (gAt && now - gAt < G_WINDOW && (k === 'h' || k === 'p')) {
        gAt = 0;
        e.preventDefault();
        e.stopPropagation();
        if (k === 'h') jumpTop();
        else jumpTo($('[data-station="games"]'));
        return;
      }
      if (k !== 'g') gAt = 0;

      if (k === '1' || k === '2' || k === '3') {
        var id = { '1': 'tier-g', '2': 'tier-y', '3': 'tier-r' }[k];
        var t = D.getElementById(id);
        if (t) { e.preventDefault(); jumpTo(t); }
        return;
      }

      if (k === '?') { e.preventDefault(); KEYMAP().toggle(); return; }

      if (k === 'i' && DIVE) { e.preventDefault(); DIVE.toggle(); return; }

      if (k === 'm' && COMPANION) {
        e.preventDefault();
        COMPANION.toggle();
        return;
      }
    }, true);
  }

  var _primes = null;
  function PRIMES() {
    if (_primes) return _primes;
    var ov = D.createElement('div');
    ov.className = 'sqov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Order-finding, by hand');
    ov.innerHTML =
      '<div class="sqov-card" tabindex="-1">' +
        '<h2>Order-finding, by hand</h2>' +
        '<p class="lede">Take <b>N = 15</b> and a number with no factor in common with it, <b>a = 7</b>. ' +
        'Multiply 7 by itself, modulo 15, until you come back to 1.</p>' +
        '<table class="sqov-work"><thead><tr>' +
          '<th>power</th><th>value</th><th>mod 15</th></tr></thead><tbody>' +
          '<tr><td>7¹</td><td>7</td><td class="n">7</td></tr>' +
          '<tr><td>7²</td><td>49</td><td class="n">4</td></tr>' +
          '<tr><td>7³</td><td>343</td><td class="n">13</td></tr>' +
          '<tr class="hit"><td>7⁴</td><td>2401</td><td class="n">1</td></tr>' +
        '</tbody></table>' +
        '<p>It closes at the fourth step, so the <b>period r = 4</b>. Because r is even, ' +
        '7<sup>r/2</sup> = 7² = 49 sits one step either side of a multiple of 15, and the ' +
        'two factors fall out of a schoolbook algorithm:</p>' +
        '<p><b>gcd(49 − 1, 15) = gcd(48, 15) = 3</b><br>' +
        '<b>gcd(49 + 1, 15) = gcd(50, 15) = 5</b><br>' +
        'and 3 × 5 = 15.</p>' +
        '<p>Everything you just read is classical. <b>Only the period-finding step is quantum</b> — ' +
        'the rest is multiplication and Euclid. That is why the cost estimates in the Bitcoin chart ' +
        'on this page move so far when somebody finds a cheaper way to run one subroutine: the ' +
        'attack is mostly ordinary arithmetic wrapped around a single quantum kernel.</p>' +
        '<button type="button" class="sqov-shut">Close</button>' +
      '</div>';
    D.body.appendChild(ov);
    _primes = overlay(ov);
    return _primes;
  }

  var LINK = 150;
  var CURSOR = 210;
  var GAIN = 1.45;
  var PULL = 0.105;
  var DAMP = 0.984;
  var VMAX = 2.6;
  var VMIN = 0.05;
  var WAVE = 0.42;
  var HOP_LOSS = 0.72;
  var MIN_AMP = 0.06;
  var MAX_EVENTS = 400;

  var cvs, ctx, w = 0, h = 0, dpr = 1;
  var nodes = [], raf = 0, running = false;
  var ptr = { x: -9999, y: -9999, live: false };
  var coherence = 0;
  var VIO = [167, 139, 250], TEA = [45, 212, 191];
  var LEAD = 900;
  var DWELL = 3000;
  var COLLAPSE = 750;
  var dw = { x: 0, y: 0, t: 0, down: false, touch: false, prog: 0, scrolled: 0 };
  var col = { on: false, t0: 0, x: 0, y: 0 };
  var labelFont = '600 12px system-ui, sans-serif';

  function readColours() {
    VIO = rgbOf('--violet', VIO);
    TEA = rgbOf('--teal', TEA);
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }


  function sizeField() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);
    w = W.innerWidth; h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedField() {
    var n = Math.max(44, Math.min(150, Math.round((w * h) / 12000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.15 + Math.random() * 1.65,
        ph: Math.random() * Math.PI * 2,
        sp: 0.6 + Math.random() * 0.8,
        amp: 0,
        heat: 0
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
      if (next < MIN_AMP || o.amp > next) continue;
      (function (jj, nn) {
        W.setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function stepField(dt) {
    var f = dt / 16.67;
    var live = col.on || (dw.touch && dw.down) || ptr.live;
    var ax = col.on ? col.x : (dw.touch && dw.down ? dw.x : ptr.x);
    var ay = col.on ? col.y : (dw.touch && dw.down ? dw.y : ptr.y);
    var reach = CURSOR * (1 + dw.prog * 0.55), boost = 1 + dw.prog * 2.2;
    var ck = col.on ? Math.min(1, (W.performance.now() - col.t0) / COLLAPSE) : 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      n.heat = 0;
      if (col.on) {
        var cx = ax - n.x, cy = ay - n.y, rate = (0.018 + 0.16 * ck * ck) * f;
        n.x += cx * rate; n.y += cy * rate;
        n.vx *= 0.8; n.vy *= 0.8;
        n.heat = 1;
        continue;
      }
      if (live) {
        var dx = ax - n.x, dy = ay - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < reach && d > 0.5) {
          var prox = 1 - d / reach;
          n.heat = prox;
          var a = prox * PULL * boost * f;
          n.vx += (dx / d) * a;
          n.vy += (dy / d) * a;
        }
      }

      n.vx *= Math.pow(DAMP, f);
      n.vy *= Math.pow(DAMP, f);

      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > VMAX) { n.vx = n.vx / sp * VMAX; n.vy = n.vy / sp * VMAX; }
      if (sp < VMIN) { n.vx += (Math.random() - 0.5) * 0.05; n.vy += (Math.random() - 0.5) * 0.05; }

      n.x += n.vx * f;
      n.y += n.vy * f;

      if (n.x < -24) n.x = w + 24; else if (n.x > w + 24) n.x = -24;
      if (n.y < -24) n.y = h + 24; else if (n.y > h + 24) n.y = -24;

      n.amp *= Math.pow(0.9975, dt);
      if (n.amp < 0.004) n.amp = 0;
    }
  }

  function drawField(t) {
    ctx.clearRect(0, 0, w, h);

    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;
        var heat = (a.heat + b.heat) * 0.5;
        var lift = (a.amp + b.amp) * 0.5;
        var al = (0.13 + heat * 0.32 + lift * 0.26) * (1 - d / LINK)
               + coherence * 0.06 * (1 - d / LINK);
        al *= GAIN;
        if (al < 0.008) continue;
        ctx.strokeStyle = rgba(mix(VIO, TEA, Math.min(1, heat + lift)), Math.min(0.46, al));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    for (var k = 0; k < nodes.length; k++) {
      var n = nodes[k];
      var tw = 0.5 + 0.5 * Math.sin(t * 0.0009 * n.sp + n.ph);
      var warm = Math.min(1, n.heat + n.amp);
      var colr = mix(VIO, TEA, warm);
      var al = (0.26 + tw * 0.14 + n.heat * 0.44 + n.amp * 0.5 + coherence * 0.08) * GAIN;
      var glow = (n.heat * 0.9 + n.amp) * 11;
      if (glow > 0.35) {
        ctx.shadowBlur = glow;
        ctx.shadowColor = rgba(colr, 0.55);
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = rgba(colr, Math.min(0.95, al));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * (1 + tw * 0.24 + n.heat * 0.55 + n.amp * 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (dw.prog > 0 && !col.on) {
      var vis = Math.min(1, dw.prog * 8);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = rgba(TEA, 0.22 * vis);
      ctx.beginPath(); ctx.arc(dw.x, dw.y, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(TEA, 0.95 * vis);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(dw.x, dw.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dw.prog); ctx.stroke();
      ctx.font = labelFont; ctx.textAlign = 'center';
      ctx.fillStyle = rgba(TEA, 0.9 * vis);
      ctx.fillText('Hold still to fall in', dw.x, dw.y + 48);
    }
  }

  var lastT = 0;
  function frame(t) {
    if (!running) return;
    var dt = lastT ? Math.min(t - lastT, 48) : 16;
    lastT = t;
    dwellStep(t);
    stepField(dt);
    drawField(t);
    raf = W.requestAnimationFrame(frame);
  }
  function startField() { if (running) return; running = true; lastT = 0; raf = W.requestAnimationFrame(frame); }
  function stopField() { running = false; if (raf) W.cancelAnimationFrame(raf); raf = 0; }

  function buildField() {
    if (reduce) return;
    if (!D.body || !D.body.hasAttribute('data-motion')) return;

    cvs = D.createElement('canvas');
    cvs.id = 'sq-field';
    cvs.setAttribute('aria-hidden', 'true');
    D.body.appendChild(cvs);
    ctx = cvs.getContext('2d');
    if (!ctx) { cvs.remove(); cvs = null; return; }

    readColours();
    labelFont = '600 12px ' + (W.getComputedStyle(D.body).fontFamily || 'system-ui, sans-serif');
    sizeField();
    seedField();
    drawField(0);
    if (!D.hidden) startField();
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    var rt;
    W.addEventListener('resize', function () {
      W.clearTimeout(rt);
      rt = W.setTimeout(function () {
        sizeField(); seedField();
        if (!running) drawField(0);
      }, 160);
    });

    W.addEventListener('pointermove', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { ptr.live = false; dw.t = W.performance.now(); });
    W.addEventListener('blur', function () { ptr.live = false; });
    bindDwell();

    W.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button, input, textarea, select, summary, label')) return;
      var best = -1, bestD = 22;
      for (var i = 0; i < nodes.length; i++) {
        var dx = nodes[i].x - e.clientX, dy = nodes[i].y - e.clientY;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) excite(best, 1, { n: 0 });
    }, { passive: true });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stopField(); else { stopField(); startField(); }
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onScheme = function () { readColours(); };
      if (mq.addEventListener) mq.addEventListener('change', onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }
  }

  function bindSheen() {
    if (reduce) return;
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
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
      if (ctx && !running) drawField(W.performance ? W.performance.now() : 0);
    },
    pulse: function () {
      if (!nodes.length) return;
      excite(Math.floor(Math.random() * nodes.length), 0.85, { n: 0 });
    },
    ready: function () { return !!ctx; }
  };

  var DIVE = null;
  var DIVE_BAD = 'sq-dive-x';
  var diveCool = 0;

  function openField(x, y) {
    var el = D.elementFromPoint(x, y);
    if (!el || el === D.documentElement) return false;
    return !el.closest('a, button, input, select, textarea, summary, label, p, h1, h2, h3, h4, h5, h6, li, dt, dd, ' +
      'blockquote, pre, code, table, figure, img, svg, canvas, video, iframe, details, nav, footer, header, aside, ' +
      'dialog, [popover], [role="dialog"], .card, [contenteditable]');
  }

  function diveQuiet() {
    try { if (parseInt(W.sessionStorage.getItem(DIVE_BAD) || '0', 10) >= 2) return true; } catch (e) {}
    return W.performance.now() < diveCool;
  }

  function dwellStep(t) {
    dw.prog = 0;
    if (col.on || !DIVE || DIVE.isOpen() || reduce) return;
    if (dw.touch ? !dw.down : !ptr.live) return;
    var age = t - dw.t;
    if (age < LEAD) return;
    if (diveQuiet() || !D.hasFocus() || t - dw.scrolled < 500 ||
        D.querySelector(':popover-open, .sqov[data-open]') || !openField(dw.x, dw.y)) {
      dw.t = t;
      return;
    }
    dw.prog = Math.min(1, (age - LEAD) / (DWELL - LEAD));
    if (age >= DWELL) { dw.prog = 0; DIVE.fall(dw.x, dw.y, 'dwell'); }
  }

  function bindDwell() {
    var now = function () { return W.performance.now(); };
    function restart(x, y) { dw.x = x; dw.y = y; dw.t = now(); dw.prog = 0; }
    W.addEventListener('pointermove', function (e) {
      var touch = e.pointerType === 'touch';
      if (touch && !dw.down) return;
      var moved = Math.abs(e.clientX - dw.x) + Math.abs(e.clientY - dw.y);
      if (moved > (touch ? 14 : 7)) { dw.touch = touch; restart(e.clientX, e.clientY); }
    }, { passive: true });
    W.addEventListener('pointerdown', function (e) {
      dw.touch = e.pointerType === 'touch'; dw.down = true; restart(e.clientX, e.clientY);
    }, { passive: true });
    var up = function () { dw.down = false; dw.t = now(); dw.prog = 0; };
    W.addEventListener('pointerup', up, { passive: true });
    W.addEventListener('pointercancel', up, { passive: true });
    W.addEventListener('scroll', function () { dw.scrolled = dw.t = now(); dw.prog = 0; }, { passive: true });
    W.addEventListener('wheel', function () { dw.scrolled = dw.t = now(); dw.prog = 0; }, { passive: true });
    W.addEventListener('keydown', function () { dw.t = now(); dw.prog = 0; }, true);
  }

  function buildDive() {
    var link = $('#dive-btn');
    var base = link ? link.getAttribute('href').split('#')[0] : 'inside.html';
    var SRC = base + '?embed=1#chip';
    var ov = D.createElement('div');
    ov.className = 'dive';
    ov.id = 'dive';
    ov.hidden = true;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Inside a quantum computer, in 3D');
    if (reduce) ov.setAttribute('data-calm', '');
    ov.innerHTML =
      '<div class="dive-bar">' +
        '<span class="dive-cap">A teaching model, not a photograph. Drag to turn it, scroll to zoom, click a part to open it.</span>' +
        '<a class="dive-full" href="' + base + '#chip">Open<span class="dive-long"> as a</span> full page</a>' +
        '<button type="button" class="dive-x">Back to the surface <kbd>Esc</kbd></button>' +
      '</div>' +
      '<div class="dive-well">' +
        '<iframe class="dive-frame" title="Interactive 3D model of a quantum computer" allow="fullscreen" tabindex="0"></iframe>' +
        '<p class="dive-load" role="status">Falling in&hellip;</p>' +
      '</div>';
    D.body.appendChild(ov);

    var frame = $('.dive-frame', ov), load = $('.dive-load', ov), shut = $('.dive-x', ov);
    var open = false, lastFocus = null, openedAt = 0, how = '', inerted = [], slow = 0, gone = 0;

    function inertOthers(on) {
      if (on) {
        inerted = [];
        [].forEach.call(D.body.children, function (c) {
          if (c === ov || c.tagName === 'SCRIPT' || c.hasAttribute('inert')) return;
          c.setAttribute('inert', '');
          inerted.push(c);
        });
      } else {
        inerted.forEach(function (c) { c.removeAttribute('inert'); });
        inerted = [];
      }
    }

    function ready() {
      W.clearTimeout(slow);
      ov.classList.add('is-ready');
    }
    function onMsg(e) {
      if (e.origin !== W.location.origin || e.source !== frame.contentWindow || !e.data) return;
      if (e.data.sq === 'inside-ready') ready();
      else if (e.data.sq === 'inside-close') close();
    }

    function fall(x, y, why) {
      if (open) return;
      open = true; how = why; openedAt = W.performance.now();
      W.clearTimeout(gone);
      if (FLOAT && FLOAT.isOpen()) FLOAT.close();
      if (_keymap && _keymap.isOpen()) _keymap.close();
      lastFocus = D.activeElement;
      var vw = W.innerWidth, vh = W.innerHeight;
      var r = Math.sqrt(Math.pow(Math.max(x, vw - x), 2) + Math.pow(Math.max(y, vh - y), 2)) + 24;
      ov.style.setProperty('--dx', Math.round(x) + 'px');
      ov.style.setProperty('--dy', Math.round(y) + 'px');
      ov.style.setProperty('--dr', Math.round(r) + 'px');
      var hasField = !!cvs && !reduce;
      ov.style.setProperty('--dd', hasField ? '.3s' : '0s');
      if (hasField) { col.on = true; col.t0 = W.performance.now(); col.x = x; col.y = y; }
      ov.classList.remove('is-ready');
      load.textContent = 'Falling in…';
      ov.hidden = false;
      frame.src = SRC;
      void ov.offsetWidth;
      ov.classList.add('is-open');
      D.documentElement.classList.add('dive-lock');
      inertOthers(true);
      W.addEventListener('message', onMsg);
      W.setTimeout(function () { try { shut.focus({ preventScroll: true }); } catch (e) {} }, 60);
      W.setTimeout(function () { if (open) stopField(); }, 1200);
      slow = W.setTimeout(function () {
        if (!ov.classList.contains('is-ready')) load.innerHTML = 'The model is taking a while. <a href="' + base + '#chip">Open it as a full page</a>.';
      }, 12000);
      frame.onload = function () { W.setTimeout(ready, 700); };
    }

    function close() {
      if (!open) return false;
      open = false;
      W.removeEventListener('message', onMsg);
      W.clearTimeout(slow);
      ov.classList.remove('is-open', 'is-ready');
      D.documentElement.classList.remove('dive-lock');
      inertOthers(false);
      var quick = how === 'dwell' && W.performance.now() - openedAt < 8000;
      diveCool = W.performance.now() + 45000;
      if (quick) {
        try { W.sessionStorage.setItem(DIVE_BAD, String(1 + parseInt(W.sessionStorage.getItem(DIVE_BAD) || '0', 10))); } catch (e) {}
      }
      if (col.on) {
        nodes.forEach(function (n) {
          var a = Math.random() * Math.PI * 2, v = 1.6 + Math.random() * 2.2;
          n.vx = Math.cos(a) * v; n.vy = Math.sin(a) * v;
        });
      }
      col.on = false; dw.prog = 0; dw.t = W.performance.now();
      if (cvs && !D.hidden) { stopField(); startField(); }
      var back = (lastFocus && lastFocus !== D.body && lastFocus !== frame) ? lastFocus : link;
      if (back && back.focus) { try { back.focus({ preventScroll: true }); } catch (e) {} }
      gone = W.setTimeout(function () {
        if (open) return;
        ov.hidden = true;
        frame.onload = null;
        frame.src = 'about:blank';
      }, 700);
      return true;
    }

    shut.addEventListener('click', close);

    if (link) {
      link.addEventListener('click', function (e) {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var r = link.getBoundingClientRect();
        fall(r.left + r.width / 2, r.top + r.height / 2, 'button');
      });
    }

    DIVE = {
      el: ov,
      isOpen: function () { return open; },
      close: close,
      fall: fall,
      toggle: function () {
        if (open) { close(); return; }
        var x = ptr.live ? ptr.x : W.innerWidth / 2, y = ptr.live ? ptr.y : W.innerHeight / 2;
        fall(x, y, 'key');
      }
    };
    W.SymbiQ.dive = DIVE;
  }

  var EV_SOURCES = {
    ledger: {
      url: 'data/claims/index.json',
      read: function (d) {
        var entries = d.entries || [];
        var resolved = entries.filter(function (e) { return e.status === 'resolved'; }).length;
        var verified = entries.filter(function (e) { return e.verdict === 'verified'; }).length;
        return {
          n: entries.length,
          sub: resolved + ' resolved' + (verified ? ', ' + verified + ' verified' : ', none yet verified')
        };
      }
    },
    signal: {
      url: 'data/signals/index.json',
      read: function (d) {
        return { n: d.count || (d.entries || []).length, sub: 'news items checked against the loop' };
      }
    },
    archive: {
      url: 'data/archive/index.json',
      read: function (d) {
        return { n: d.count || (d.entries || []).length, sub: 'questions really asked, every answer kept' };
      }
    },
    reality: {
      url: 'data/reality.json',
      read: function (d) {
        var n = (d.cards || []).length;
        return { n: n, sub: 'movie scenes, myths and claims rated against the physics' };
      }
    },
    frontier: {
      url: 'data/frontier/index.json',
      read: function (d) {
        var entries = d.entries || [];
        var open = entries.filter(function (e) { return e.status === 'open'; }).length;
        return { n: entries.length, sub: open + ' still open, put to a model panel' };
      }
    }
  };

  function mountOdometer(el, n) {
    var s = String(Math.max(0, Math.round(n) || 0));
    var rows = '';
    for (var i = 0; i <= 9; i++) rows += '<span>' + i + '</span>';
    el.setAttribute('data-value', s);
    el.innerHTML = '<span aria-hidden="true">' + s.split('').map(function () {
      return '<span class="dig"><span class="dig-roll">' + rows + '</span></span>';
    }).join('') + '</span><span class="rung-sr">' + s + '</span>';
    var rolls = $$('.dig-roll', el);
    function place(ch, i) { rolls[i].style.transform = 'translateY(-' + ((+ch) * 1.1).toFixed(2) + 'em)'; }
    if (reduce) { s.split('').forEach(place); return; }
    rolls.forEach(function (r) { r.style.transform = 'translateY(0)'; });
    void el.offsetHeight;
    W.requestAnimationFrame(function () { s.split('').forEach(place); });
  }

  function buildEvidence() {
    var tiles = $$('.ev-tile[data-ev]');
    if (!tiles.length) return;
    tiles.forEach(function (tile) {
      var src = EV_SOURCES[tile.getAttribute('data-ev')];
      if (!src) return;
      fetch(src.url, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (data) {
          var out = src.read(data);
          var numEl = $('.ev-num', tile), subEl = $('.ev-sub', tile);
          if (numEl && typeof out.n === 'number') mountOdometer(numEl, out.n);
          if (subEl && out.sub) subEl.textContent = out.sub;
          if (W.SymbiQ && W.SymbiQ.pre) W.SymbiQ.pre('ev:' + tile.getAttribute('data-ev'), JSON.stringify({ n: out.n, sub: out.sub }));
        })
        .catch(function () { });
    });
  }

  var RATE = {
    name:      ['Name only', 1, 'The word is real. The physics in the scene is not.'],
    seed:      ['Real seed', 2, 'One true idea sits underneath. Everything built on it is invented.'],
    stretched: ['Stretched', 3, 'The mechanism is real, and the scene pushes it past what it does.'],
    faithful:  ['Faithful',  4, 'A working physicist would nod.']
  };
  function mk(tag, cls, text) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  function safePage(p, a) {
    if (!/^[a-z0-9_-]+\.html$/i.test(p || '')) return null;
    return p + (a && /^[\w-]+$/.test(a) ? '#' + a : '');
  }

  function buildDiscover() {
    var day = Math.floor(Date.now() / 864e5);
    var rc = D.getElementById('dc-reality'), tm = D.getElementById('dc-term');

    if (rc) getJSON('data/reality.json').then(function (d) {
      var cards = (d.cards || []).filter(function (c) {
        return RATE.hasOwnProperty(c.rating) && /^[\w-]+$/.test(c.slug || '');
      });
      if (!cards.length) return;
      var i = day % cards.length;
      var show = function (refocus) {
        var c = cards[i], r = RATE[c.rating];
        rc.textContent = '';
        rc.appendChild(mk('span', 'dc-eyebrow', 'Reality Check · ' + c.kind));
        rc.appendChild(mk('p', 'dc-title', c.title));
        var meta = mk('div', 'dc-meta'), m = mk('span', 'dc-meter');
        m.setAttribute('aria-hidden', 'true');
        for (var k = 1; k <= 4; k++) m.appendChild(mk('i', k <= r[1] ? 'on' : ''));
        meta.appendChild(m);
        meta.appendChild(mk('b', '', r[0] + ' (' + r[1] + ' of 4)'));
        rc.appendChild(meta);
        rc.appendChild(mk('p', 'dc-body', r[2]));
        var row = mk('div', 'dc-row'), a = mk('a', 'dc-link', 'Read the full card →');
        a.href = 'reality.html#' + c.slug;
        row.appendChild(a);
        if (cards.length > 1) {
          var b = mk('button', 'dc-again', 'Another one');
          b.type = 'button';
          b.addEventListener('click', function () { i = (i + 1) % cards.length; show(true); });
          row.appendChild(b);
        }
        rc.appendChild(row);
        if (refocus) { var nb = rc.querySelector('.dc-again'); if (nb) nb.focus(); }
      };
      show(false);
      if (W.SymbiQ && W.SymbiQ.pre) W.SymbiQ.pre('dc-reality', rc.innerHTML);
    }).catch(function () {});

    if (tm) getJSON('data/concepts.json').then(function (d) {
      var list = (d.concepts || []).filter(function (c) {
        return c.kind === 'concept' && c.blurb && c.term && safePage(c.page, c.anchor);
      });
      if (!list.length) return;
      var c = list[day % list.length];
      tm.textContent = '';
      tm.appendChild(mk('span', 'dc-eyebrow', 'Term of the day'));
      tm.appendChild(mk('p', 'dc-title', c.term));
      tm.appendChild(mk('p', 'dc-body', c.blurb));
      var row = mk('div', 'dc-row'), a = mk('a', 'dc-link', 'Where it is taught →');
      a.href = safePage(c.page, c.anchor);
      row.appendChild(a);
      var g = mk('a', 'dc-link', 'All terms');
      g.href = 'glossary.html';
      row.appendChild(g);
      tm.appendChild(row);
      if (W.SymbiQ && W.SymbiQ.pre) W.SymbiQ.pre('dc-term', tm.innerHTML);
    }).catch(function () {});
  }

  var REC_KIND = { correction: 'Correction', claim: 'Ledger', signal: 'Signal', build: 'Site' };
  function recHref(h) {
    return /^[a-z0-9_-]+\.html(#[\w-]+)?$/i.test(h || '') ? h : 'changelog.html';
  }
  function buildRecord() {
    var host = D.getElementById('record');
    if (!host) return;
    getJSON('data/changelog.json').then(function (d) {
      var ev = (d.events || []).filter(function (e) { return e && e.at && e.title && REC_KIND.hasOwnProperty(e.kind); });
      if (!ev.length) return;
      ev.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
      var corr = ev.filter(function (e) { return e.kind === 'correction'; }).length;
      var lede = host.querySelector('.record-lede');
      host.textContent = '';
      if (lede) host.appendChild(lede);

      var stats = mk('div', 'rec-stats');
      function stat(tag, href, num, sub) {
        var s = mk(href ? 'a' : 'div', 'rec-stat');
        if (href) s.href = href;
        s.appendChild(mk('span', 'rec-num', num));
        s.appendChild(mk('span', 'rec-sub', sub));
        stats.appendChild(s);
      }
      stat('c', 'corrections.html', String(corr), 'corrections published, each with how long the error was live');
      stat('l', 'changelog.html', String(ev.length), 'changes logged on the public changelog');
      stat('d', 'changelog.html', ev[0].at, 'the last change');
      host.appendChild(stats);

      var ul = mk('ul', 'rec-feed'), seen = {}, rows = [];
      ev.forEach(function (e) { if (!seen[e.kind]) { seen[e.kind] = 1; rows.push(e); } });
      rows.forEach(function (e) {
        var li = mk('li'), a = mk('a', 'rec-row');
        a.href = recHref(e.href);
        a.appendChild(mk('span', 'rec-at', e.at));
        a.appendChild(mk('span', 'rec-kind', REC_KIND[e.kind]));
        a.appendChild(mk('span', 'rec-title', e.title));
        li.appendChild(a);
        ul.appendChild(li);
      });
      host.appendChild(ul);
    }).catch(function () {});
  }

  function boot() {
    try { buildInstrument(); } catch (e) {}
    try { bindFloat(); } catch (e) {}
    try { bindParallax(); } catch (e) {}
    try { bindStations(); } catch (e) {}
    try { buildNavButton(); } catch (e) {}
    try { bindKeys(); } catch (e) {}
    try { buildField(); } catch (e) {}
    try { buildDive(); } catch (e) {}
    try { bindSheen(); } catch (e) {}
    try { buildEvidence(); } catch (e) {}
    try { buildDiscover(); } catch (e) {}
    try { buildRecord(); } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
