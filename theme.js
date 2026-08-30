/* SymbiQ — theme.js
 * ============================================================================
 * The explicit-appearance layer.  Pairs with theme.css; loads site-wide.
 *
 *   - remembers a colour theme: System | Light | Dim | Dark
 *   - remembers two comfort switches: reduce motion, reduce transparency
 *   - writes data-theme / data-motion-pref / data-transparency-pref on <html>
 *   - keeps <meta name="theme-color"> in step so the mobile browser chrome
 *     matches the page
 *   - builds a small control in the footer and syncs it across tabs
 *
 * PRE-PAINT.  A tiny inline script in every page's <head> has ALREADY read
 * localStorage and set the attributes before first paint, so there is no
 * flash of the wrong theme.  This file re-applies them (a no-op), then does
 * the parts that need the DOM and can wait: the control, the meta tag, the
 * listeners.
 *
 * SAFETY.  Pure enhancement, one try/catch per concern.  If it fails or is
 * blocked, the inline script's work stands and the page follows the OS via
 * style.css's media queries, exactly as before this file existed.
 * ==========================================================================*/
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

  /* ---- apply state to <html> ------------------------------------------- */
  function currentTheme() {
    var t = store.get('sq-theme');
    return THEMES.indexOf(t) > 0 ? t : 'system';   // index 0 = 'system' = default
  }

  function applyTheme(t) {
    if (t === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);
    // keep the browser chrome colour in step
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

  /* follow the OS while in System mode, for the meta colour */
  try {
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onOS = function () { if (currentTheme() === 'system') applyTheme('system'); };
      if (mq.addEventListener) mq.addEventListener('change', onOS);
      else if (mq.addListener) mq.addListener(onOS);
    }
  } catch (e) {}

  /* ---- the footer control -------------------------------------------- */
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

  /* ---- cross-tab sync ------------------------------------------------- */
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
