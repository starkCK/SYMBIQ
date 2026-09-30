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
