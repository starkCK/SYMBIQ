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
    var cont = one('.nav-continue', nav);
    if (cont && saved && saved.u && saved.u !== page && /^[\w.-]+\.html$/.test(saved.u)) {
      cont.href = saved.u;
      cont.hidden = false;
      cont.setAttribute('aria-label', 'Continue: ' + (saved.t || saved.u));
      cont.title = 'Back to ' + (saved.t || saved.u);
    }
  } catch (err) { }
})();
