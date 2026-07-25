/* SymbiQ — the Lattice launcher.
 *
 * Replaces the old six-dropdown menu bar. One trigger opens a full-screen field
 * of destinations you can also type to filter, with arrow-key + Enter selection.
 * Every link is a real <a> already present in the page HTML (the overlay is only
 * hidden), so nothing here affects crawlability or internal linking.
 */
(function () {
  try {
    var pad = document.getElementById('lattice');
    var trig = document.getElementById('latch');
    if (!pad || !trig) return;

    var find = pad.querySelector('.lattice-find');
    var closeBtn = pad.querySelector('.lattice-close');
    var links = [].slice.call(pad.querySelectorAll('a'));
    var sects = [].slice.call(pad.querySelectorAll('section'));
    var none = pad.querySelector('.lattice-none');
    var cursor = -1;

    function visible() { return links.filter(function (a) { return !a.hidden; }); }

    function mark(i) {
      links.forEach(function (a) { a.classList.remove('cursor'); });
      var v = visible();
      if (!v.length) { cursor = -1; return; }
      cursor = (i + v.length) % v.length;
      v[cursor].classList.add('cursor');
      v[cursor].scrollIntoView({ block: 'nearest' });
    }

    function filter(q) {
      q = (q || '').trim().toLowerCase();
      links.forEach(function (a) {
        // data-k carries invisible aliases, so searching "grover" or "annealing"
        // still lands you on the Arcade even though the games are not listed here
        var hay = (a.textContent + ' ' + (a.getAttribute('data-k') || '')).toLowerCase();
        a.hidden = !!q && hay.indexOf(q) < 0;
      });
      // hide a whole section once every one of its links is filtered out
      sects.forEach(function (s) {
        s.hidden = !s.querySelector('a:not([hidden])');
      });
      if (none) none.hidden = !!visible().length;
      cursor = -1;
      if (q) mark(0);
    }

    function open() {
      pad.hidden = false;
      document.body.classList.add('latched');
      trig.setAttribute('aria-expanded', 'true');
      if (find) { find.value = ''; filter(''); setTimeout(function () { find.focus(); }, 30); }
    }
    function close() {
      pad.hidden = true;
      document.body.classList.remove('latched');
      trig.setAttribute('aria-expanded', 'false');
      cursor = -1;
    }

    trig.addEventListener('click', function (e) {
      e.preventDefault();
      if (pad.hidden) open(); else close();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    pad.addEventListener('click', function (e) { if (e.target === pad) close(); });
    if (find) find.addEventListener('input', function () { filter(find.value); });

    document.addEventListener('keydown', function (e) {
      // "/" or Ctrl/Cmd-K opens it from anywhere you are not already typing
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
      if (pad.hidden && !typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
        e.preventDefault(); open(); return;
      }
      if (pad.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); trig.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); mark(cursor + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(cursor - 1); }
      else if (e.key === 'Enter') {
        var v = visible();
        if (cursor >= 0 && v[cursor]) { e.preventDefault(); v[cursor].click(); }
      }
    });
  } catch (err) { /* nav is progressive enhancement — a failure must never hide content */ }
})();

/* Scroll reveal: fade + rise as sections enter view.
   SAFETY RULE: this script is the ONLY thing that ever adds `.reveal`, so if the
   file fails to load or throws, nothing is hidden — pages render fully visible.
   Belt and braces: a timer force-reveals everything after 2.5s no matter what. */
(function () {
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = [].slice.call(document.querySelectorAll('h2, .card, .grid, table, .formula, .cabs, .gate'))
      .filter(function (el) {
        return !el.closest('nav') && !el.closest('.lattice') &&
               !(el.parentElement && el.parentElement.closest('.card'));
      });
    if (!targets.length) return;

    function show(el) { el.classList.add('in'); }

    if (reduce || !('IntersectionObserver' in window)) return;   // leave everything visible
    targets.forEach(function (el) { el.classList.add('reveal'); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });

    // anything already on screen reveals immediately — no flash of hidden content
    requestAnimationFrame(function () {
      targets.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.95) show(el);
      });
    });
    // last-resort guarantee: never leave content invisible
    setTimeout(function () { targets.forEach(show); }, 2500);
  } catch (err) {
    [].slice.call(document.querySelectorAll('.reveal')).forEach(function (el) { el.classList.add('in'); });
  }
})();
