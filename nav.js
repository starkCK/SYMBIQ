/* SymbiQ — the structured nav (replaces the Lattice launcher, 2026-08-07).
 *
 * Five visible categories (native <details class="navcat">), each its own
 * dropdown at desktop width and its own accordion section at mobile width --
 * the SAME markup serves both, only the CSS positioning changes per
 * breakpoint. <summary> already opens/closes its <details> with no JS at
 * all; everything below is enhancement on top of that native behaviour:
 * only one dropdown open at a time on desktop, Escape/outside-click closes,
 * and a single mobile "Menu" trigger shows/hides the whole category list so
 * five triggers don't have to fit in one row on a phone. If this script
 * fails to load or throws, every <details> still opens on click/tap and
 * every link is still a real, crawlable <a> -- nothing here is required for
 * the nav to work, only for it to behave like one coordinated menu.
 */
(function () {
  try {
    var cats = [].slice.call(document.querySelectorAll('.navcat'));
    var navtrig = document.getElementById('navtrig');
    var navcats = document.getElementById('navcats');

    // Only one category dropdown open at a time.
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

    // Mobile: one "Menu" button shows/hides the whole category list.
    if (navtrig && navcats) {
      navtrig.addEventListener('click', function () {
        var open = navcats.classList.toggle('open');
        navtrig.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) closeAll();
      });
      // picking a link closes the mobile panel behind it
      navcats.addEventListener('click', function (e) {
        if (e.target.closest('a')) { navcats.classList.remove('open'); navtrig.setAttribute('aria-expanded', 'false'); }
      });
    }
  } catch (err) { /* nav is progressive enhancement -- a failure must never hide content */ }
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
