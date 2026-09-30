(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function reduced() {
    if (D.documentElement.getAttribute('data-motion-pref') === 'reduce') return true;
    return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var store = {
    get: function (k, fallback) {
      try {
        var v = W.localStorage.getItem(k);
        return v === null ? (fallback === undefined ? null : fallback) : v;
      } catch (e) { return fallback === undefined ? null : fallback; }
    },
    set: function (k, v) {
      try { W.localStorage.setItem(k, v); return true; } catch (e) { return false; }
    },
    del: function (k) {
      try { W.localStorage.removeItem(k); return true; } catch (e) { return false; }
    },
    getJSON: function (k, fallback) {
      try {
        var raw = W.localStorage.getItem(k);
        if (raw === null) return fallback;
        var v = JSON.parse(raw);
        return v === null || v === undefined ? fallback : v;
      } catch (e) { return fallback; }
    },
    setJSON: function (k, v) {
      try { W.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    }
  };

  function $(sel, root) { return (root || D).querySelector(sel); }

  function all(sel, root) {
    return Array.prototype.slice.call((root || D).querySelectorAll(sel));
  }

  function on(root, type, sel, fn) {
    function handler(ev) {
      var el = ev.target;
      if (!el || el.nodeType !== 1) el = el && el.parentElement;
      for (; el && el !== root; el = el.parentElement) {
        if (el.matches && el.matches(sel)) { fn.call(el, ev, el); return; }
      }
    }
    root.addEventListener(type, handler);
    return function () { root.removeEventListener(type, handler); };
  }


  var loaded = Object.create(null);
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (resolve, reject) {
      var s = D.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      D.head.appendChild(s);
    });
    return loaded[src];
  }

  function onNear(el, fn, margin) {
    var noop = function () {};
    if (!el) return noop;
    if (!W.IntersectionObserver) { fn(); return noop; }
    var io = new W.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); fn(); return; }
      }
    }, { rootMargin: (margin == null ? 1200 : margin) + 'px 0px' });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  var TEXT_INPUT = /^(text|search|email|url|tel|password|number|date|datetime-local|month|time|week)$/i;
  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = String(el.tagName || '').toUpperCase();
    if (t === 'TEXTAREA' || t === 'SELECT') return true;
    if (t === 'INPUT') return TEXT_INPUT.test(el.type || 'text');
    return false;
  }

  function mailLinks(root) {
    all('[data-mail]', root).forEach(function (a) {
      var u = a.getAttribute('data-mail-u'), d = a.getAttribute('data-mail-d');
      if (!u || !d) return;
      a.href = 'mailto:' + u + String.fromCharCode(64) + d;
      a.removeAttribute('data-mail');
    });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { mailLinks(); });
  else mailLinks();

  function ev(t) {
    var w = String(t == null ? '' : t).split(/[\s·]+/)[0].toLowerCase();
    var known = { proven: 1, heuristic: 1, inspired: 1, frontier: 1 };
    return '<span class="ev' + (known[w] ? ' ev-' + w : '') + '">' + esc(t) + '</span>';
  }
  W.SymbiQ.ev = ev;

  function pre(id, html) {
    if (!W.__PRERENDER__) return;
    (W.__PRE = W.__PRE || {})[id] = html;
  }
  W.SymbiQ.pre = pre;

  W.SymbiQ.core = {
    editable: editable,
    esc: esc,
    reduced: reduced,
    store: store,
    $: $,
    all: all,
    on: on,
    loadScript: loadScript,
    onNear: onNear,
    mailLinks: mailLinks
  };
}());
