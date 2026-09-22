/* --- nav.js --- */
/* SymbiQ, the structured nav (replaces the Lattice launcher, 2026-08-07).
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
   file fails to load or throws, nothing is hidden, pages render fully visible.
   Belt and braces: a timer force-reveals everything after 2.5s no matter what. */
(function () {
  try {
    var reduce = window.SymbiQ.core.reduced();
    /* .introute, .spine and footer added 2026-08-27, closing the gap that made
       the footer the one block on every page that never animated in.

       `section` was CONSIDERED AND DELIBERATELY LEFT OUT. It looks like the
       obvious fourth addition -- index.html's three .orhero blocks are
       sections -- but a revealed container drags its children with it:
       `.reveal.in > *` fires fadeUp, which has fill `both` and ends at
       opacity 1, so it would force any child that is ITSELF a pending
       .reveal to become visible before its own observer fired. Every
       <section> on this site contains an h2, and h2 is a target. The result
       would be a coarse whole-block fade REPLACING the per-element reveals
       those sections already get, which is worse, not better.

       That is the test any future addition has to pass: does the new
       selector match anything that contains an existing target? Measured
       across all 24 pages before this change -- .introute, .spine and footer
       swallow nothing, and no page loses a single existing reveal. */
    var targets = [].slice.call(document.querySelectorAll(
        'h2, .card, .grid, table, .formula, .cabs, .gate, .introute, .spine, footer'))
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

    // anything already on screen reveals immediately, no flash of hidden content
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

/* Deep links into a folded section.
   Any <details> can now hold real content (see .foldsec in style.css), which
   means a fragment link can point INSIDE something that is shut. Browsers
   disagree about whether they auto-expand for that, so do it ourselves: on
   load and on every hash change, open every <details> ancestor of the target
   and then bring it into view. Purely additive, pages that fold nothing are
   unaffected, and feasible.html/formalism.html keep their own richer handlers
   (which also update their progress tally); this one runs first and only ever
   opens things, so the two never fight. */
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
        // Layout has just changed under the browser's own scroll attempt, and
        // the scroll-reveal pass above is still adding/removing transforms.
        // Two frames plus a load-time retry is what it actually takes for the
        // final position to be correct; one rAF lands short.
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
/* --- depth.js --- */
/* SymbiQ, depth.js: the reader's remembered light/deep preference.
 *
 * A separate, small module from save.js on purpose: depth preference is not
 * Solver's Path progress, and importing/resetting one must never touch the
 * other. Same fault-tolerant pattern as save.js -- every localStorage call is
 * try/caught, so a private-browsing tab or a full quota degrades to "no
 * preference recorded" rather than throwing.
 *
 * This is a DEFAULT only. It never overrides an explicit choice already
 * present in the page -- tiers.js's URL hash and feasible.html's own
 * per-topic layer toggle both still win if present. The whole point of
 * keeping depth in the hash on quantum pages (see tiers.js's own header
 * comment) is that a shared link carries the sender's depth; this module
 * adds the one thing that mechanism deliberately does not do on its own --
 * remembering what a *returning* reader picked, for the pages they land on
 * with no hash and no anchor at all.
 */
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
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // 'light' | 'deep' | null (never asked, or storage unavailable)
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
/* --- tiers.js --- */
/* SymbiQ, depth toggle, check-your-understanding, and onward pathways.
 *
 * Zero dependencies, no build step, GitHub Pages safe.
 *
 * THREE SAFETY RULES, learned the hard way on this site:
 *
 * 1. PROGRESSIVE ENHANCEMENT ONLY. The HTML ships with every tier visible. This
 *    script hides things only AFTER it has successfully built the control that
 *    shows them again. If it throws, dies, or is cached stale, the reader gets
 *    the full page, never a blank one. Same lesson as the `.reveal` rule in
 *    nav.js: a stale script must never be able to hide content permanently.
 *
 * 2. NO localStorage. Depth lives in the URL hash, so a link carries the depth
 *    the sender was reading at. Explicitly required, and it also makes the
 *    state shareable, which localStorage never is.
 *
 * 3. DEEP LINKS OUTRANK DEPTH. #red / #qec-widget / #duel etc. must still work.
 *    If the hash names a real element, we reveal whatever tier contains it
 *    rather than fighting the anchor.
 */
(function () {
  'use strict';

  var TIERS = ['g', 'y', 'r'];
  /* Names match the inline .tier chip text used inline on every pillar page
     ("No math" / "Some math" / "Real math") -- this toggle used to say
     "Plain / Working / Formal" instead, a second, unexplained name for the
     same three depths sitting right above the chip that names them properly. */
  var META = {
    g: { chip: '🟢', name: 'No math',   blurb: 'One analogy. No equations.' },
    y: { chip: '🟡', name: 'Some math', blurb: 'Mechanism, and a worked number.' },
    r: { chip: '🔴', name: 'Real math', blurb: 'Derivations, sources, open problems.' }
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function all(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ---------- hash helpers: several keys share one hash, order preserved ---- */
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
    // replaceState: changing depth should not stack twenty history entries.
    try { history.replaceState(null, '', '#' + out.join('&')); }
    catch (e) { location.hash = out.join('&'); }
  }
  /* A bare anchor like #red or #duel, not one of our key=value pairs. */
  function bareAnchor() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h.indexOf('=') > -1) return null;
    return h;
  }

  /* =======================================================================
     1. DEPTH TOGGLE
     A page opts in with data-tiers on <body>. Sections are marked by the
     existing `.tier.g|y|r` chips already in the HTML: a chip opens a run of
     content that ends at the next chip. We wrap each run so it can be hidden
     as a unit without touching the document's reading order.
     ======================================================================= */
  function buildToggle() {
    // Tag siblings in place rather than wrapping them. Wrapping reorders the
    // DOM and fights anything that already holds a node reference; tagging
    // cannot break the document even if this function is wrong.
    var host = $('.wrap') || document.body;
    var kids = [].slice.call(host.children);

    var cur = null;          // tier we are currently inside
    var keeping = false;     // inside a data-tier-keep run (widgets, games)
    var stopped = false;     // past data-tier-stop, everything after is shared
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
        keeping = false;     // a new heading ends the keep run
      }

      if (cur && !keeping) {
        el.setAttribute('data-in-tier', cur);
        groups[cur].push(el);
      }
    });

    var present = TIERS.filter(function (t) { return groups[t].length; });
    if (present.length < 2 || !firstChip) return null;

    // Build the control BEFORE anything is hidden.
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
        // A reader picking an extreme here has stated a real preference, the
        // same way picking "light" or "deep" on feasible.html/formalism.html/
        // journey.html's own toggle already does -- so it should travel with
        // them the same way. 'y' (the middle) and 'all' don't map onto that
        // toggle's light/deep binary, so they deliberately leave whatever
        // preference already exists untouched rather than guessing at one.
        if (window.SymbiQ && SymbiQ.depth) {
          if (t === 'g') SymbiQ.depth.set('light');
          else if (t === 'r') SymbiQ.depth.set('deep');
        }
        // Keep the bar in view; the reader's eye is on the control they clicked.
        var top = bar.getBoundingClientRect().top;
        if (top < 0) bar.scrollIntoView({ block: 'start' });
      }
      return true;
    }

    // ---- initial state -------------------------------------------------
    // A bare anchor wins: if the URL names an element, show the tier holding it.
    var anch = bareAnchor(), start = null;
    if (anch) {
      var target = document.getElementById(anch);
      if (target) {
        var owner = target.closest('[data-in-tier]');
        if (owner) start = owner.getAttribute('data-in-tier');
        else start = 'all';   // it lives outside the tiers, show everything
      }
    }
    if (!start) {
      var want = hashGet('depth');
      if (want && (want === 'all' || present.indexOf(want) > -1)) {
        start = want;
      } else {
        // No hash, no anchor: fall back to the reader's remembered light/deep
        // choice (depth.js), if one exists and this page actually has that
        // tier. Still just a default -- an explicit hash above always won.
        var pref = (window.SymbiQ && SymbiQ.depth) ? SymbiQ.depth.get() : null;
        var prefTier = pref === 'deep' ? 'r' : pref === 'light' ? 'g' : null;
        start = (prefTier && present.indexOf(prefTier) > -1) ? prefTier : present[0];
      }
    }
    pick(start, false);

    // Re-anchor after we changed what is visible, or the browser's own jump
    // landed on an element that was hidden at the time.
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

  /* =======================================================================
     1b. CORRECTIONS FILTER
     ======================================================================= */
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

  /* =======================================================================
     2. CHECK YOUR UNDERSTANDING
     Authored in the HTML as <div class="cyu" data-a="1">, with the options and
     an explanation as children. No answer key in JS, so the markup stays
     readable and a scripts-off reader can still see the question and reasoning.
     ======================================================================= */
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
          /* Optional: The Standing, when it has loaded on this page. Guarded
             so a page without standing.js behaves exactly as before. */
          try { window.SymbiQ && SymbiQ.standing && SymbiQ.standing.recordCyu(right); } catch (e) {}
        });
      });
    });
  }

  /* =======================================================================
     3. ONWARD PATHWAY + a gentle, honest nudge
     No modals, no timers, no exit-intent, nothing that interrupts reading.
     The nudge only ever appears after the reader has actually done something,
     and it says a true thing about what they did.
     ======================================================================= */
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

  /* ---------------------------------------------------------------------- */
  function boot() {
    try { if (document.body.hasAttribute('data-tiers')) buildToggle(); }
    catch (e) { /* leave every tier visible, the failure mode must be "shows too much" */ }
    try { buildChecks(); } catch (e) {}
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
/* --- analytics.js --- */
/* SymbiQ, analytics, off by default and switched on with one word.
 *
 * WHY THIS FILE EXISTS: as of 2026-07-29 nothing on this site was measured.
 * The daily question published automatically to a page nobody was told about,
 * and every success criterion in the plan ("do six of ten players finish the
 * act?") was unanswerable. That is not a missing feature, it is a missing
 * instrument, and no product decision below is worth making without it.
 *
 * ── TO SWITCH ON (one of these, then set PROVIDER) ────────────────────────
 *   'goatcounter'  free for non-commercial, no cookies, no consent banner.
 *                  Sign up at goatcounter.com, set SITE_CODE to your subdomain.
 *   'plausible'    paid, self-hostable, no cookies. Set DOMAIN.
 *   'cloudflare'   free, needs a Cloudflare account. Set CF_TOKEN.
 *   ''             off. Nothing is loaded and nothing is sent. (default)
 *
 * All three are cookieless and store no personal data, which is why none of
 * them needs a consent banner. Do not replace this with Google Analytics
 * without also adding one, and without deciding you are happy handing your
 * readers' behaviour to an ad company, on a site whose whole argument is
 * that it treats its readers straight.
 */
(function () {
  'use strict';

  // Live since 2026-07-30. Dashboard: https://symbiq.goatcounter.com
  var PROVIDER  = 'goatcounter';         // 'goatcounter' | 'plausible' | 'cloudflare' | ''
  var SITE_CODE = 'symbiq';              // goatcounter subdomain
  var DOMAIN    = 'starkck.github.io';   // plausible
  var CF_TOKEN  = '';                    // cloudflare beacon token

  if (!PROVIDER) return;

  // Respect an explicit Do Not Track signal. Costs a little data; it is the
  // consistent position for a site that asks readers to trust it.
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

  document.head.appendChild(s);

  /* Report a named event (a mission cleared, a question answered) if the
   * provider supports it. Safe to call whether or not analytics is on, so
   * calling code never needs to check. */
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.track = function (name, meta) {
    try {
      if (PROVIDER === 'plausible' && window.plausible) window.plausible(name, { props: meta || {} });
      if (PROVIDER === 'goatcounter' && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'event/' + name, title: name, event: true });
      }
    } catch (e) { /* analytics must never break the page */ }
  };
})();

/* No-op stub so callers can always use SymbiQ.track without a guard. */
window.SymbiQ = window.SymbiQ || {};
if (typeof window.SymbiQ.track !== 'function') window.SymbiQ.track = function () {};
;
/* --- forms.js --- */
/* SymbiQ, form delivery for a site with no back end.
 *
 * GitHub Pages cannot send email, so every form here posts to a third-party
 * relay. Until one is configured it falls back to opening the visitor's own
 * mail client, which is worse UX but is never a dead end.
 *
 * ── TO SWITCH ON REAL INBOX DELIVERY (about 30 seconds, no password) ───────
 *   1. Go to https://web3forms.com, enter dsechinmoy@gmail.com, and they
 *      email you an "access key" (a UUID). No account, no password.
 *   2. Paste it into ACCESS_KEY below. That is the entire change.
 *   Formspree / Formsubmit work the same way if you prefer them; only
 *   post() below would need editing.
 *
 * The destination address is NEVER written into the HTML or into this file in
 * one piece, an address in public source gets harvested by spam crawlers
 * within days. The access key is a public token by design: it identifies the
 * inbox without revealing it, and can be rotated if it is ever abused.
 */
(function () {
  'use strict';

  // Live since 2026-07-30. Public by design, this token identifies the inbox
  // without revealing it, and it must sit in client-side source to work at all.
  var ACCESS_KEY = 'e475f594-d5a7-4cc2-a89d-fd4b12deb5ef';
  var ENDPOINT   = 'https://api.web3forms.com/submit';

  // Reassembled at runtime so the literal string never appears in the source.
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
      // A checkbox or radio reports .value ("on") whether or not it is ticked,
      // so reading .value alone would submit every checkbox as checked. Only a
      // ticked one counts -- which is what the waitlist checkbox (plan 23 §7.6)
      // needs before it can be added to the newsletter form.
      if (t === 'checkbox' || t === 'radio') {
        if (el.checked) out[el.name] = (el.value && el.value !== 'on') ? el.value : 'yes';
        continue;
      }
      out[el.name] = el.value.trim();
    }
    return out;
  }

  // No JS-side email validation beyond the browser's own: over-strict regexes
  // reject real addresses, and the relay validates properly anyway.
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
    // Guard against double-binding: a form injected after load can be wired by
    // SymbiQ.forms.wire() and then swept up again by a later init(). Two
    // listeners would submit the same message twice.
    if (form.dataset.sqWired) return;
    form.dataset.sqWired = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.getAttribute('data-sq') || 'message';
      var data = values(form);
      var btn  = form.querySelector('button[type=submit], button:not([type])');

      // Honeypot: a field no human sees. Bots fill it; if it has content we
      // silently pretend to succeed rather than telling the bot it was caught.
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
        // Not configured yet, hand off to the visitor's mail client. Honest
        // about what just happened rather than silently doing nothing.
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

  /* Forms that are injected after load (the Ledger builds its no-account claim
     form only once it knows nobody is signed in) never see init(), so they
     need a way in. handle() guards itself with a data-sq-wired flag, so a
     form reached by both paths is still bound exactly once. */
  /* ASK AT THE WIN. The only newsletter form used to sit at the bottom of the
     home page. People say yes right after they win something, so a game or the
     Question can call capture(host) at that moment. It shows at most once per
     page load, never again after a subscription (from any form), and not for
     three weeks after "Not now". The whole state is one localStorage key. */
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
  function capture(host, o) {
    o = o || {};
    if (!host || capShown) return false;
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
/* --- supabase-config.js --- */
/* SymbiQ, Supabase project config. Public by design: this is the
 * "publishable" (anon) key, meant to sit in client-side source. It cannot
 * read or write anything Row-Level Security doesn't already allow an
 * anonymous or signed-in visitor to do -- same reasoning as forms.js's
 * ACCESS_KEY. The database password (never used here, and never put in a
 * file like this) is what actually needs protecting; this key is not it.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.SUPABASE_URL = 'https://ymtjedmqptiwhktxdwmv.supabase.co';
  window.SymbiQ.SUPABASE_ANON_KEY = 'sb_publishable_j9ugu-qEEh9ZSaB0wsSCUw_tPRn6D_h';
})();
;
/* --- auth.js --- */
/* SymbiQ, accounts (L1). Email magic-link only for now; no GitHub OAuth
 * yet (that needs a separate GitHub OAuth App, a later, optional step).
 *
 * The account control (2026-08-28 redesign) is a small circular button in
 * the nav -- a person icon signed out, the account's own initial signed in
 * -- that opens a popover on click. It's a <details class="navcat"> like
 * the five category menus beside it, so nav.js's existing dropdown
 * coordination (one open at a time, outside-click and Escape close it)
 * applies for free; nothing there had to change.
 *
 * PROGRESSIVE ENHANCEMENT, same rule as nav.js/tiers.js: `#sq-account`
 * ships `hidden` in every page's nav, and this only clears that once the
 * project is actually configured. If supabase-config.js is missing or
 * blank, the button simply never appears -- nothing else on the page
 * depends on it, and no page is worse off than it was before L1.
 * `#sq-auth` is the popover's content div, inside the `<details>`.
 *
 * On sign-in, this hands the session to SymbiQ.save.connectRemote() so
 * local progress starts mirroring to the account. On sign-out, it calls
 * disconnectRemote() -- local storage keeps working exactly as it always did.
 *
 * ---------------------------------------------------------------------------
 * THE CLIENT IS LOADED ON DEMAND (plan 24 SS7.2, done 2026-09-21).
 *
 * vendor/supabase/supabase.js is 218 KB -- 21% of the bytes on a page, and
 * until now every visitor downloaded it on all 26 pages whether or not they
 * ever signed in. Almost nobody does: a reader with no session has nothing
 * for it to do but sit in memory.
 *
 * So: if localStorage holds a Supabase session, the library is fetched
 * immediately and everything below runs exactly as it always did -- the
 * signed-in path is the old path, step for step. If there is no session, the
 * library is not fetched at all. `ensure()` fetches it later, at the first
 * moment something actually needs it:
 *   - the reader opens the account popover (prefetch on intent), or
 *   - they focus or submit the sign-in form, or
 *   - ledger.js opens a claim's forecast panel and needs to read the crowd.
 *
 * The contract three modules (ledger.js, leaderboard.js, frontier.js) rely on
 * is preserved, and is now stated rather than implied:
 *   - `window.SymbiQ.auth` exists from the moment this file executes, not
 *     from whenever a network fetch resolves.
 *   - `symbiq:authchange` still fires exactly once for the initial state and
 *     again on every change. With no stored session it fires SOONER than it
 *     used to (at DOMContentLoaded, not after two round trips), which is why
 *     the announce is deferred by a task -- every module registers its
 *     listener during DOMContentLoaded, and the event must land after them.
 *   - `auth.client` stays null until the library is really loaded, so the
 *     existing `!auth.client` guards keep meaning what they meant.
 *   - `auth.ready` is the new "the signed-in/out answer is known" flag, for
 *     callers that want the answer but not the library.
 *
 * API: window.SymbiQ.auth = { client, ready, getUser(), signOut(), ensure() }
 *      ensure() -> Promise<client|null>, null if unavailable. Safe to call
 *      any number of times; the library is fetched at most once.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var esc = window.SymbiQ.core.esc;   /* plan 24 SS2.2 -- one copy, in core.js */

  var client = null;
  var currentUser = null;
  var loadPromise = null;
  var mount = null, wrap = null, avatar = null;

  /* Exposed synchronously, before any network work, so the modules that
     consume it can ask questions without racing a fetch. */
  var API = {
    client: null,
    ready: false,
    getUser: function () { return currentUser; },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    ensure: ensure
  };
  window.SymbiQ.auth = API;

  function configured() {
    return !!(window.SymbiQ.SUPABASE_URL && window.SymbiQ.SUPABASE_ANON_KEY);
  }

  /* The key supabase-js will itself use for the persisted session:
     `sb-${hostname.split('.')[0]}-auth-token`. Reading it costs nothing and
     answers the only question that decides whether the 218 KB is worth
     fetching up front. If that shape ever changes upstream the worst case is
     that a signed-in reader takes the lazy path and the library arrives a
     moment later -- they still end up signed in, because onAuthStateChange
     reads the same storage once the client exists. */
  function hasStoredSession() {
    try {
      var host = new URL(window.SymbiQ.SUPABASE_URL).hostname.split('.')[0];
      return !!localStorage.getItem('sb-' + host + '-auth-token');
    } catch (e) { return false; }
  }

  /* plan 24 SS2.2 again: this used to be auth.js's own copy. core.loadScript
     is the same thing, memoised per URL, and shared with the pages that mount
     a game on demand. */
  var loadScript = window.SymbiQ.core.loadScript;

  /* Vendored, pinned and hashed -- NOT a CDN URL, and this matters.
   *
   * Until 2026-09-18 this line read
   *     https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
   * which is a floating tag: `@2` resolves to whatever the newest 2.x is at
   * the moment a reader loads the page, so the bytes being executed were
   * never the bytes anyone reviewed. No Subresource Integrity hash was
   * possible either, because a hash pinned to a floating tag breaks on every
   * patch release. This script runs on all 26 pages with full DOM access and
   * holds the sign-in session, so a compromised upstream package would have
   * owned every visitor.
   *
   * Now it is site/vendor/supabase/supabase.js -- @supabase/supabase-js
   * pinned to one exact version, with its sha256 recorded in
   * vendor/supabase/MANIFEST.json and checked by
   * `python tools/vendor_dep.py --verify`. Same origin, no third party in the
   * request path, and an upgrade is a reviewable commit rather than something
   * that happens to readers overnight. This follows the pattern vendor/pq/
   * already set for the post-quantum library.
   */
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
        return null;   /* stays null for this page load, same as it always did */
      });
    return loadPromise;
  }

  // Keeps the trigger button in sync with mount's content: the icon when
  // signed out, the account initial once signed in -- so the "you're signed
  // in" state is visible without opening the popover at all, which is the
  // actual "have a profile" ask this answers.
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
    /* Reaching for the field is a clear enough statement of intent to start
       the download, so the library is usually here before the button is hit. */
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
    // The trigger becomes the account's own initial -- a real avatar, not
    // just a menu that happens to contain profile info.
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    setTrigger(true, name + ', account menu');
    document.getElementById('sq-auth-out').addEventListener('click', function () {
      client.auth.signOut();
    });
  }

  // Other modules (ledger.js's forecast form, frontier.js's propose form,
  // leaderboard.js) don't know when the library resolves, so they can't just
  // read getUser() once at their own render time -- they listen for this
  // event instead, fired on every state change including the initial one,
  // same shape as SymbiQ.save's own onchange.
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

  /* Runs once, the moment a real client exists -- whether it was fetched
     eagerly for a stored session or lazily on a reader's first move. */
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
    mount = document.getElementById('sq-auth');       // the popover's content
    wrap = document.getElementById('sq-account');      // the <details> trigger + popover
    avatar = document.getElementById('sq-avatar');

    /* No account control on the page, or no Supabase project configured at
       all -- someone's fork of this repo, say. Either way the account button
       stays hidden and there is no sign-in to wait for, so the answer to "is
       anyone signed in" is a definite no and must still be announced. Before
       this, nothing fired, and ledger.js's submit panel and frontier.js's
       propose panel sat on "Checking sign-in status…" for the life of the
       page -- both of their signed-out branches work without Supabase. */
    if (!mount || !wrap || !configured()) { setTimeout(announce, 0); return; }

    wrap.hidden = false;
    renderSignedOut(null);

    /* Opening the popover is the clearest statement of intent there is. */
    wrap.addEventListener('toggle', function () { if (wrap.open) ensure(); });

    if (hasStoredSession()) {
      ensure();          // a session to restore: the library is worth its weight
    } else {
      /* No session, so no library. Announce the answer we already have -- on a
         task boundary, because every consumer registers its listener during
         DOMContentLoaded and this runs first among them. */
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
/* --- atmosphere.js --- */
/* ================================================================
   ATMOSPHERE (2026-08-27)

   Two things that share one idea -- the page reacts to where you are:

     1. THE LATTICE. A generative background of drifting nodes that couple to
        their neighbours. Not decoration borrowed from somewhere else: the
        brand mark IS a lattice, the dot grid in style.css is a lattice, and
        the homepage's own thesis is that coupling many identical circuits is
        what turns a qubit story into an optimisation machine. So the
        background is the same object the site is about, actually behaving
        like one.

        This is the answer to "put a video behind it". A video would be the
        first photographic byte this site has ever shipped, would cost
        megabytes, would not theme, would not respond, and would say nothing.
        This costs no network request and reacts to the cursor.

     2. THE SHEEN. Cards get a light source that follows the pointer, by
        writing --mo-x / --mo-y for motion.css §4 to consume.

   HIDDEN, item 2 of 2 (the other lives in qubit.js): clicking a node
   injects an excitation, which propagates outward along the couplings at
   finite speed, losing amplitude at every hop. That is a discrete wave on a
   weighted graph -- the same picture as an excitation moving through a
   coupled-oscillator lattice -- and it is why the propagation is delayed by
   distance rather than lighting the whole graph at once. Clicking empty
   space does nothing, so it is found by aiming, not by flailing.
   ================================================================ */
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var reduced = window.SymbiQ.core.reduced();

  /* ---------------------------------------------------------------- */
  /* Colour, read from the cascade rather than hardcoded, so the lattice
     re-themes with everything else instead of becoming the one violet thing
     on a light page. Re-read on scheme change; --violet and --teal both have
     different values in the light block of style.css.                       */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /* THE LATTICE                                                       */
  /* ---------------------------------------------------------------- */
  var cvs, ctx, dpr = 1, w = 0, h = 0;
  var nodes = [], raf = 0, running = false;
  var pointer = { x: -9999, y: -9999, live: false };
  var coherence = 0;            /* driven by qubit.js; see setCoherence below */

  var LINK = 132;               /* px: coupling range. Beyond this, no bond. */
  var CURSOR = 190;             /* px: how far the pointer's influence reaches */
  var WAVE = 0.42;              /* px per ms: propagation speed of an excitation */
  var HOP_LOSS = 0.72;          /* amplitude retained per hop */
  var MIN_AMP = 0.06;           /* below this an excitation is dead */
  var MAX_EVENTS = 400;         /* hard ceiling per click, so a dense graph cannot avalanche */

  function sizeCanvas() {
    dpr = Math.min(W.devicePixelRatio || 1, 2);   /* capped: 3x on a phone is heat, not sharpness */
    w = W.innerWidth;
    h = W.innerHeight;
    cvs.width = Math.round(w * dpr);
    cvs.height = Math.round(h * dpr);
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    /* Density by area, not a fixed count -- a phone gets a sparse lattice and
       a 4K monitor gets a full one, at roughly the same visual weight. */
    var n = Math.max(24, Math.min(88, Math.round((w * h) / 21000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.13,
        vy: (Math.random() - 0.5) * 0.13,
        r: 1.1 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,   /* per-node phase, so pulses desynchronise */
        amp: 0,                            /* current excitation amplitude */
        teal: Math.random() < 0.42
      });
    }
  }

  /* Excitation: a breadth-first wave across the coupling graph, delayed by
     real distance / WAVE and attenuated by HOP_LOSS per hop. Scheduled with
     timers rather than integrated per-frame because the delay is what makes
     it read as propagation instead of a flash. */
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
      if (d > LINK) continue;                       /* not coupled: no path */
      var next = amp * HOP_LOSS * (1 - d / LINK * 0.4);
      if (next < MIN_AMP) continue;
      if (o.amp > next) continue;                   /* already carrying more; don't re-excite */
      (function (jj, nn) {
        setTimeout(function () { excite(jj, nn, budget); }, d / WAVE);
      })(j, next);
    }
  }

  function hitTest(x, y) {
    var best = -1, bestD = 22;      /* generous: the nodes are 2px, the target is not */
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

      /* Wrap rather than bounce: a bounce reads as a wall, and there is no
         wall -- the lattice is meant to continue past the viewport. */
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;

      /* Pointer coupling: a weak pull, capped, so the lattice leans toward
         the cursor without collapsing into it. */
      if (pointer.live) {
        var dx = pointer.x - n.x, dy = pointer.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 1) {
          var f = (1 - d / CURSOR) * 0.00028 * dt;
          n.vx += dx * f;
          n.vy += dy * f;
        }
      }

      /* Drag, so the pointer pull cannot accumulate into a stampede. */
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

    /* Bonds first, so nodes sit on top of their own couplings. */
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      a = nodes[i];
      for (j = i + 1; j < nodes.length; j++) {
        b = nodes[j];
        dx = b.x - a.x; dy = b.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d > LINK) continue;

        var base = (1 - d / LINK) * 0.16;
        var lift = (a.amp + b.amp) * 0.5;                 /* excitation brightens the bond */
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

    /* Bonds to the pointer. Drawn separately and brighter: this is the part
       that makes the thing feel aware of you. */
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

      /* An excited node throws a halo. Only while it is actually carrying
         amplitude, so a resting lattice stays quiet. */
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
    var dt = last ? Math.min(t - last, 48) : 16;   /* clamp: a backgrounded tab must not teleport */
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
  /* Always tear down before arming. A page that LOADS in a background tab
     gets running=true but never a single rAF callback -- requestAnimationFrame
     does not fire while the document is hidden -- so a later start() would
     see running===true, return early, and leave the loop permanently dead
     with a stale frame id. Restarting through stop() is what makes becoming
     visible actually recover. Found 2026-08-27 against a hidden pane, which
     is the same state as opening the site in a background tab. */
  function restart() { stop(); start(); }

  /* The width at which rails.css puts furniture in the margins. Kept in step
     with that file and with rails.js by hand; all three name the same number
     for the same reason, and if one moves they all move. */
  var WIDE = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  function initLattice() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (cvs) return;   /* already built: the wide-screen path can call twice */

    /* WHERE THE LATTICE RUNS, revised 2026-08-28.
       It began homepage-only, on the argument that it belongs behind the
       hero that argues for it. That held while the margins on every other
       page were empty background. They are not any more: rails.css now puts
       a section index, the ladder and a progress readout out there at 1440px
       and up, and a still background behind live furniture reads as the
       furniture having replaced something. So on a screen wide enough to
       have margins at all, every page gets the lattice; below that, nothing
       changes and it stays exactly where it was. Phones and ordinary laptops
       pay nothing new -- no canvas, no loop, no battery.
       data-lattice still wins at every width, which is what keeps the
       homepage's own reading intact on a narrow screen. */
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

    /* Resize is wired in BOTH paths. The reduced-motion branch returns before
       the rest of the listeners, and an early version of this file returned
       before this one too -- which left a static lattice drawn at the old
       viewport size for anyone who resized their window, i.e. permanently
       wrong for exactly the users who cannot see it redraw. */
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
      /* One static frame. The lattice is still there, still themed, still
         part of the composition -- it simply does not move. */
      draw(0);
      cvs.classList.add('on');
      return;
    }

    /* One frame now, synchronously, before any rAF. Two reasons: the lattice
       is present on the very first paint instead of one frame late, and a
       page that opens in a background tab still has a drawn lattice waiting
       when it is finally looked at, rather than an empty canvas. */
    draw(0);
    if (!D.hidden) start();

    /* Faded in rather than popped: at load the page already has enough
       arriving at once. */
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    W.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.live = true;
    }, { passive: true });
    W.addEventListener('pointerleave', function () { pointer.live = false; });
    W.addEventListener('blur', function () { pointer.live = false; });

    /* The excitation. Listens on window because the canvas is
       pointer-events:none -- the lattice must never eat a click meant for a
       link. Only a click that lands ON a node does anything at all.

       Not wired under reduced motion, and that is the right call rather than
       a shortcut: a wave crossing the whole viewport is intrinsically motion,
       which is the exact thing the preference opts out of. The lattice is
       still drawn, still themed, still part of the composition -- it just
       does not have a hidden animation waiting in it. */
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

  /* ---------------------------------------------------------------- */
  /* THE SHEEN                                                         */
  /* ---------------------------------------------------------------- */
  function initSheen() {
    if (!D.body || !D.body.hasAttribute('data-motion')) return;
    if (reduced) return;

    var pending = null, tick = 0;

    D.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.card, .introute-card');
      if (!card) return;
      pending = { el: card, x: e.clientX, y: e.clientY };
      if (tick) return;
      /* One write per frame. A pointermove handler that touches style on
         every event is the classic way to make a smooth page feel sticky. */
      tick = W.requestAnimationFrame(function () {
        tick = 0;
        if (!pending) return;
        var r = pending.el.getBoundingClientRect();
        pending.el.style.setProperty('--mo-x', ((pending.x - r.left) / r.width * 100).toFixed(1) + '%');
        pending.el.style.setProperty('--mo-y', ((pending.y - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- */
  /* Public surface. qubit.js drives setCoherence with |2 alpha beta*| --
     the off-diagonal term of the density matrix, which is literally the
     quantity that survives only while the page is unmeasured. So the
     lattice shimmers exactly when, and as much as, the site is in
     superposition, and goes still the instant it is measured.            */
  /* ---------------------------------------------------------------- */
  W.SymbiQ.lattice = {
    setCoherence: function (c) {
      coherence = Math.max(0, Math.min(1, c || 0));
      /* Repaint if nothing else is going to. Under reduced motion, or in a
         background tab, there is no loop to pick this up -- without this the
         canvas would keep showing the shimmer level from whenever it last
         drew, which for a reduced-motion visitor is forever. */
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
    /* Someone who drags a window out to a second monitor should get the
       lattice then, not on their next navigation. Only ever builds -- there
       is no matching teardown, because a canvas that already exists costs a
       rAF loop the page is paying for anyway, and tearing it down on every
       drag of a window edge would flicker. initLattice returns early once
       cvs exists, so this cannot build a second one. */
    if (WIDE) {
      if (WIDE.addEventListener) WIDE.addEventListener('change', initLattice);
      else if (WIDE.addListener) WIDE.addListener(initLattice);
    }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
/* --- qubit.js --- */
/* ================================================================
   THE PAGE IS A QUBIT (2026-08-27)

   HIDDEN, item 1 of 2 (the other is the lattice excitation in
   atmosphere.js). Undocumented on purpose. Nothing on the site explains
   this, and nothing should.

   WHAT IT IS
   The site carries a real single-qubit state. Press a gate letter anywhere
   -- H X Y Z S T -- and the actual 2x2 complex unitary is applied to it.
   Press M to measure. Press R to reset. The state follows you across pages
   for the session.

   WHY IT IS NOT A GIMMICK
   Every visible consequence is the honest reading of a real quantity, and
   the two visual channels are independent because the two physical
   quantities are:

     |beta|^2  -- the probability of measuring 1 -- drives LIGHTNESS, via
                  invert(). The X gate is a bit flip; invert() is a bit flip
                  on pixels. They are the same operation, which is the whole
                  reason this maps to a filter rather than a theme toggle.
                  A superposition renders as a genuinely half-inverted page,
                  because that is what refusing to measure looks like.

     arg(beta) - arg(alpha)  -- the relative phase -- drives HUE. Phase as
                  hue is the standard domain-colouring convention, and it is
                  the right one here: phase is exactly the thing that is
                  invisible in the populations and visible in interference.

     2|alpha||beta|  -- the off-diagonal coherence of the density matrix --
                  drives the lattice shimmer in atmosphere.js. It is maximal
                  in equal superposition and identically zero the instant a
                  measurement lands, so the background goes still exactly
                  when the physics says the coherence is gone.

   THE PAYOFF FOR ANYONE WHO ACTUALLY KNOWS
   The accumulated unitary is tracked, not just the state, and named when it
   matches something. Type HZH and the readout says net = X, because HZH IS
   X. Type SS and it says net = Z, because S^2 = Z. Type HH and it says
   net = I, and nothing happens, which is correct. Press Z on a fresh page
   and it reports no observable change, because Z|0> = |0> and a global
   phase is not a thing you can see. None of those are special cases in this
   file -- they all fall out of multiplying the matrices. That is the point.
   There is no list of tricks here to get wrong.

   FINDING IT
   One breadcrumb: a dim readout in the corner showing |0>. It is describing
   the page, not decorating it, and it changes when the theme does. That is
   the whole hint. Anyone who presses a gate key gets a visible response
   immediately, including the correct non-response.

   ESCAPE HATCH
   R resets. So does clicking the readout. A visitor who lands on an
   inverted page by accident has a labelled way out that is one click from
   wherever they are.
   ================================================================ */
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  var SS_KEY = 'symbiq.qz.v1';        /* session: the state follows you across pages */
  var LS_KEY = 'symbiq.qz.seen.v1';   /* forever: the one-time hint has been shown */
  var EPS = 1e-9;

  var reduced = window.SymbiQ.core.reduced();

  /* ---------------------------------------------------------------- */
  /* Complex arithmetic. Same [re, im] convention as the try-it engine in
     index.html and as games.js's Circuit Golf, deliberately -- three copies
     of one convention is fine; three conventions would not be.            */
  /* ---------------------------------------------------------------- */
  function cm(p, q) { return [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; }
  function cadd(p, q) { return [p[0] + q[0], p[1] + q[1]]; }
  function cabs2(p) { return p[0] * p[0] + p[1] * p[1]; }
  function carg(p) { return Math.atan2(p[1], p[0]); }
  function cconj(p) { return [p[0], -p[1]]; }

  /* Gates as [m00, m01, m10, m11]. */
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
  function matMul(a, b) {   /* a . b */
    return [cadd(cm(a[0], b[0]), cm(a[1], b[2])),
            cadd(cm(a[0], b[1]), cm(a[1], b[3])),
            cadd(cm(a[2], b[0]), cm(a[3], b[2])),
            cadd(cm(a[2], b[1]), cm(a[3], b[3]))];
  }

  /* Name the accumulated unitary, UP TO GLOBAL PHASE -- which is the only
     honest way to compare two unitaries, since a global phase is not
     observable. Normalise by the phase of the first non-negligible entry,
     then compare entrywise. */
  function nameOf(u) {
    var i, k, ref = null;
    for (i = 0; i < 4; i++) { if (cabs2(u[i]) > 1e-12) { ref = u[i]; break; } }
    if (!ref) return null;
    var r = Math.sqrt(cabs2(ref));
    var unphase = [ref[0] / r, -ref[1] / r];      /* conj(ref)/|ref| */
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

  /* ---------------------------------------------------------------- */
  /* State                                                             */
  /* ---------------------------------------------------------------- */
  var st = {
    v: [[1, 0], [0, 0]],   /* |0> */
    u: G.I.slice(),        /* accumulated unitary since the last reset/measure */
    n: 0,                  /* gates applied since the last reset/measure */
    last: ''               /* the gate letter most recently applied */
  };

  function load() {
    try {
      var raw = W.sessionStorage.getItem(SS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o && o.v && o.v.length === 2 && o.u && o.u.length === 4) {
        st.v = o.v; st.u = o.u; st.n = o.n || 0; st.last = o.last || '';
      }
    } catch (e) { /* a corrupt key just means the page starts at |0>, which is fine */ }
  }
  function save() {
    try { W.sessionStorage.setItem(SS_KEY, JSON.stringify(st)); } catch (e) {}
  }

  function p1() { return Math.min(1, Math.max(0, cabs2(st.v[1]))); }
  function p0() { return Math.min(1, Math.max(0, cabs2(st.v[0]))); }
  function phase() {
    /* Undefined unless BOTH amplitudes are present -- with one of them zero
       there is no relative phase to speak of, only a global one, and a global
       phase is not observable. Returning 0 here is not a fudge; it is the
       statement that there is nothing to show. */
    if (cabs2(st.v[0]) < 1e-12 || cabs2(st.v[1]) < 1e-12) return 0;
    var d = carg(st.v[1]) - carg(st.v[0]);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function coherence() { return 2 * Math.sqrt(p0() * p1()); }

  /* What is actually visible: populations and relative phase. Two states
     agreeing on both are indistinguishable by any measurement, so this is
     the correct equality test for "did anything happen". */
  function observable() { return [p1(), phase()]; }
  function sameObservable(a, b) {
    return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
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
    /* e^{i\theta} with the exponent as superscript, so the pill stays one line */
    var map = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴',
                5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    var s = String(deg).split('').map(function (c) { return map[c] || c; }).join('');
    return 'ⁱ' + s + '°';   /* superscript i, digits, degree */
  }

  function paint(note) {
    var pb = p1();
    var hue = 180 * pb + phase() * 180 / Math.PI;

    if (fx) {
      /* Drop the filter entirely at |0>: an untouched page should not be
         paying for a full-viewport backdrop filter that resolves to identity. */
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
    void pill.offsetWidth;              /* restart the animation */
    pill.classList.add('flash');
  }

  /* One-time nudge, the first time a gate ever lands. It names the two keys
     that are not gates -- the measurement and the way out -- and never
     explains the mapping. */
  function maybeHint() {
    try {
      if (W.localStorage.getItem(LS_KEY)) return null;
      W.localStorage.setItem(LS_KEY, '1');
    } catch (e) { return null; }
    clearTimeout(hintTimer);
    hintTimer = W.setTimeout(function () { paint(null); }, 7000);
    return 'M measures · R resets';
  }

  /* ---------------------------------------------------------------- */
  /* Operations                                                        */
  /* ---------------------------------------------------------------- */
  function applyGate(k) {
    var before = observable();
    st.v = matVec(G[k], st.v);
    st.u = matMul(G[k], st.u);
    st.n++;
    st.last = k;

    var note = maybeHint();
    if (!note) {
      /* Two independent facts, and a sequence can carry both. S,S is the
         case that proves it: the net unitary really is Z, AND nothing
         observable happened, because Z|0> = |0>. Reporting only one of those
         would look like the simulator had missed the other. */
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
    /* A real draw. crypto.getRandomValues where it exists, because on a site
       whose argument is "the mathematics does the judging" the randomness
       should be the best the platform has, not Math.random. */
    var r;
    try {
      var buf = new Uint32Array(1);
      W.crypto.getRandomValues(buf);
      r = buf[0] / 4294967296;
    } catch (e) { r = Math.random(); }

    var got = r < pb ? 1 : 0;
    st.v = got ? [[0, 0], [1, 0]] : [[1, 0], [0, 0]];
    st.u = G.I.slice();          /* the accumulated unitary died with the coherence */
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

  /* ---------------------------------------------------------------- */
  /* Input                                                             */
  /* ---------------------------------------------------------------- */
  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }

  function onKey(e) {
    /* Never steal a shortcut. Ctrl/Cmd/Alt combinations belong to the
       browser and to the user, not to this. */
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target)) return;
    if (editable(D.activeElement)) return;

    var k = (e.key || '').toUpperCase();
    if (G[k] && k !== 'I') { applyGate(k); return; }
    if (k === 'M') { measure(); return; }
    if (k === 'R') { reset(); return; }
  }

  /* ---------------------------------------------------------------- */
  /* Boot                                                              */
  /* ---------------------------------------------------------------- */
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
    /* Labelled, because a mystery button is still a button and a screen
       reader user should not have to guess. The label says what it DOES
       (resets) without explaining what the rest of it is. */
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

  /* Deliberately small public surface: enough for a page to drive the state
     from a widget later, nothing that hands out the key mapping. */
  W.SymbiQ.qubit = {
    apply: function (k) { k = String(k).toUpperCase(); if (G[k] && k !== 'I') applyGate(k); },
    measure: measure,
    reset: reset,
    state: function () { return { p1: p1(), phase: phase(), coherence: coherence(), net: nameOf(st.u) }; }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
/* --- rails.js --- */
/* SymbiQ, rails.js: the peripheral layer (added 2026-08-28).
 *
 * Companion to rails.css, which carries the full rationale. In short: the
 * reading column is capped at 1040px because prose wider than that stops
 * being readable, which on a 1920px monitor leaves 432px of empty
 * background on the left and 447px on the right, and past 2000px leaves
 * over 700px a side. This file puts orientation into that space.
 *
 * SAFETY, in the same shape as nav.js, rung.js, tiers.js and depth.js:
 *
 *   - Opt-in. A page whose body carries no data-rails gets nothing.
 *   - Gated. Nothing is built below 1440px, where there is no room for it,
 *     and the gate is the same matchMedia query rails.css uses, so the DOM
 *     and the styling can never disagree.
 *   - Additive. Every insertion is a sibling of .wrap, never inside it. The
 *     one thing this file changes about existing markup is adding an id to
 *     an h2 that has none, which nothing else on the site depends on.
 *   - Wrapped. Every module builds inside its own try/catch, so a single
 *     bad read cannot take the whole rail down with it, and the whole boot
 *     is wrapped again on top of that. A failure anywhere leaves the page
 *     exactly as it was before this file existed.
 *
 * WHAT IT DOES NOT DO, on purpose:
 *
 *   - No scroll reveals. nav.js has owned those site-wide since long before
 *     this file; a second reveal system overrides the first rather than
 *     complementing it. See motion.css section 3.
 *   - No new persistence. The progress module reads the two keys the
 *     homepage router already reads, and writes nothing at all.
 *   - No key map. The state module asks SymbiQ.qubit for its own summary
 *     after any keypress. It never learns, stores or reveals which keys
 *     matter, so the keyboard layer stays something you find rather than
 *     something you are told.
 */
(function () {
  'use strict';

  var D = document;
  var W = window;

  /* The same breakpoint rails.css gates on. Below it the reading column
     leaves under 200px a side, which is not enough for a legible rail. */
  var MQ = W.matchMedia ? W.matchMedia('(min-width: 1440px)') : null;

  /* Where each page hands the reader on. One link, curated, not derived,
     the ladder order is not the reading order for every page, and guessing
     would produce confident nonsense on the pages that sit off the spine.
     A page missing from this map simply gets no "where next" module. */
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
    'race.html':            ['frontier.html',         'The open frontier',          'What nobody has settled yet'],
    'frontier.html':        ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'ledger.html':          ['corrections.html',      'Corrections',                'What we got wrong, and when'],
    'corrections.html':     ['ledger.html',           'The ledger',                 'Every claim on this site, and its source'],
    'signals.html':         ['archive.html',          'The archive',                'Everything asked and answered so far'],
    'archive.html':         ['signals.html',          'Signals',                    'What moved this week, and why it matters']
  };

  /* The ladder, identical to rung.js's own table. Duplicated rather than
     imported because rung.js exposes nothing and is a plain IIFE; two short
     literal tables are a smaller liability than a new global. If the ladder
     itself ever changes, both files change together. */
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

  /* The fork mark, drawn rather than typed. It was U+2482 BRANCH, which is
     the right character and the wrong idea: it is in no common Windows UI
     font, so Chrome fell back and rendered a small capital letter next to
     "coupled circuits instead", visible in a screenshot from the live site
     on 2026-08-28. A glyph that depends on the reader having a font is not
     an icon. Nine bytes of path says exactly what the ladder means by a
     fork: one line running down, one branch leaving it, currentColor and
     the same stroke weight as everything else in the rail. */
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

  /* ------------------------------------------------------------------ */
  /* Left column: on this page, plus the scroll spine and back-to-top    */
  /* ------------------------------------------------------------------ */

  /* What to print for a heading. Several h2s on this site are two things in
     one element -- formalism.html and feasible.html write the section name
     in a block-level span and let the standfirst follow it as bare text, so
     a plain textContent read returns "The Formal FrameworkFour topics, each
     taught four ways" with no space at the seam. innerText would split them
     correctly but also applies text-transform, and those spans are set in
     uppercase, so the rail would start shouting.

     So: if the heading opens with a block-level element and has more content
     after it, that element is the title and the rest is the standfirst. The
     full text is kept on the title attribute either way, so hovering still
     gives you the whole heading. */
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
    /* Only headings the reader can actually reach. tiers.js hides whole
       depth tiers on some pages, and an index entry that scrolls to
       nothing is worse than no entry. getClientRects() is the cheap test
       that catches display:none, hidden ancestors and empty boxes alike. */
    var all = [].slice.call(D.querySelectorAll('h2')).filter(function (h) {
      if (h.closest('.sqrail, nav, footer')) return false;
      return h.getClientRects().length > 0;
    });
    /* Two entries is a list, not an index. Below that the module says less
       than the page already does. Returning false hands the left column to
       the ladder instead, see build(). journey.html, archive.html and
       signals.html all render their bodies from script and have no static
       section headings at all, so this is not a rare branch. */
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
      /* The hover text carries the whole heading, with the seam the source
         markup leaves out put back -- otherwise it reads "The Formal
         FrameworkFour topics". */
      a.title = (full !== lab && full.indexOf(lab) === 0)
        ? lab + ', ' + full.slice(lab.length).trim()
        : full;
      a.appendChild(el('span', 'sqrail-dot'));
      a.appendChild(el('span', 'sqrail-txt', lab));
      a.addEventListener('click', function (ev) {
        /* Own the scroll so the landing point clears the sticky header,
           which a bare fragment jump does not. Reduced motion gets the
           same landing point with no travel. */
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

  /* ------------------------------------------------------------------ */
  /* Right column: the ladder, progress, where next, state              */
  /* ------------------------------------------------------------------ */

  /* Drawn on every rails page, not only the twelve that carry data-rung.
     On a rung page it says where you are; on the homepage, on play.html or
     on the ledger it is a standing map of the site's own spine, the
     argument the homepage makes in prose, kept in view while you read the
     rest of it. The horizontal pill is only ever hidden on the pages that
     actually have one, so nothing is lost either way. */
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
    /* Suppressed on the homepage: the three-door router at the top of that
       page already reports the same three numbers, and saying one fact
       twice on one screen is clutter, not reinforcement. */
    if (page() === 'index.html') return;

    /* Denominators verified 2026-08-28 by counting .mod[id] in each page's
       parsed document: formalism 20, feasible 24. The homepage router had
       been claiming 17 and 20 since those pages last grew, and was
       corrected in the same change that added this file. Six acts is the
       length of the mission list immediately below, so that one cannot
       drift. If either page gains topics, these two numbers move with it. */
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

    if (!acts && !form && !feas && !pqcStarted) return;   /* no empty meters */

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

  /* No eyebrow over this one, unlike the modules above it. "Where next" sat
     directly above the card's own bold title, which is a kicker over a
     heading, the heading was already carrying the sentence, and the label
     only repeated the arrow. The other rail labels stay because each of them
     IS its module's heading with no second heading beneath: a bare list of
     section names could be site navigation, and L0 through L4 mean nothing
     unless something says "The Ladder". */
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

  /* The state module. It asks the qubit for its own summary after any
     keypress and reveals itself the first time that summary stops being
     the ground state. It does not know, and must never learn, which keys
     do anything, that is the whole reason the keyboard layer is worth
     finding. */
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
        /* Deliberately unlabelled. It read "This page", one line under a
           left rail already labelled "On this page", two headings saying
           the same three words in one viewport, for two unrelated things.
           Dropping it also suits what this module is: the only other trace
           of the keyboard layer is a dim readout in the corner that explains
           nothing either. A reader who has got this far does not need a
           caption; a reader who has not should not be handed one. */
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

    /* After the key, not on it: qubit.js handles the same event and this
       must read the state it leaves behind, not the one before it. */
    D.addEventListener('keydown', function () { setTimeout(paint, 0); });
    paint();
  }

  /* ------------------------------------------------------------------ */
  /* Scroll: the spine fill, the scroll-spy, the top button              */
  /* ------------------------------------------------------------------ */

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

        /* The current section is the last heading whose top has passed the
           sticky header. Everything before it is behind you. */
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
      } catch (e) { /* a bad frame must not kill the listener */ }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Build and teardown                                                  */
  /* ------------------------------------------------------------------ */

  function build() {
    if (built) return;
    built = true;

    /* No aria-label on either gutter: a plain div has no role, so a label
       there is announced by nothing and only looks like accessibility work.
       The landmarks that matter are the two nav elements inside, and each
       carries its own label. */
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

    /* The left column answers "where am I", the right one "what is mine and
       what is next". Where a page has sections, "where am I" is the section
       index. Where it has none, the three pages that render their whole
       body from script, the honest answer is the wider one, so the ladder
       moves left rather than leaving that margin holding nothing but a
       hairline. Each module is wrapped on its own: a bad read in one must
       not take the other three down with it. */
    var haveIndex = false;
    try { haveIndex = buildIndex(lc) === true; } catch (e) { }
    try { buildLadder(haveIndex ? rc : lc); } catch (e) { }
    try { buildTop(lc); } catch (e) { }
    try { buildProgress(rc); } catch (e) { }
    try { buildNext(rc); } catch (e) { }
    try { buildState(rc); } catch (e) { }

    /* An empty column is furniture with nothing on it. Only attach the
       side that earned a place. The spine is measurement, not content, so
       it alone is enough reason to keep the left side. */
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
    /* Give the horizontal rung pill back: below the gate it is the only
       copy of the ladder there is. */
    D.documentElement.classList.remove('sq-vrung');
    left = right = spineFill = topBtn = stateBox = null;
    items = []; heads = []; stateShown = false;
  }

  function sync() {
    if (MQ && MQ.matches) build(); else destroy();
  }

  /* Two independent triggers for the same check, on purpose. The
     matchMedia change event is the right one and fires once per crossing;
     the debounced resize is the belt to its braces, because a change event
     that never arrives (seen under an emulated viewport while testing this
     file) would otherwise strand the rails in whichever state they were
     last in. sync() is idempotent, build() returns early when built and
     destroy() returns early when not, so a duplicate trigger costs one
     boolean test. */
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
    } catch (e) { /* additive only: a failure here leaves the page as it was */ }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
/* --- alive.js --- */
/* SymbiQ, alive.js
 * ============================================================================
 * THE RESPONSE LAYER.  Pairs with alive.css; both are gated on
 * <body data-alive>.  Three things, all of them replies to something the
 * visitor did:
 *
 *   1. ARRIVAL      a deep link resolves -> the target says "me"
 *   2. PERMALINK    every id'd heading can hand you its own deep link
 *   3. UNFOLD       <details> opens and closes with a height instead of a cut
 *   4. READBAR      the one page that never got tiers.js gets its progress bar
 *   5. VERDICT      a widget re-answers -> the banner resolves in its own colour
 *   7. MARKER       a corner section-jumper for < 1440px, where the rail is gone
 *   8. KEYS         ? opens a shortcut list; j / k step sections; m opens 7
 *
 * SAFETY CONTRACT, same as nav.js's: this file is pure enhancement.  It adds
 * no class that hides content, it removes nothing from the DOM, every entry
 * point is inside its own try/catch, and every <details> it touches is left
 * with its native behaviour intact.  If this script 404s, throws on line one,
 * or is blocked entirely, every page behaves exactly as it did before it
 * existed.  That is not a nice-to-have here -- the fold handler intercepts the
 * most common interaction on the site, so its failure mode has to be "native
 * <details>", never "a section that will not open".
 *
 * ORDERING.  Must load AFTER nav.js.  nav.js owns opening the <details>
 * ancestors of a hash target and scrolling to it; this file only marks what
 * arrived.  It also owns `.reveal` -- nothing here adds that class, for the
 * reason motion.css section 3 sets out at length.
 * ==========================================================================*/
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-alive')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { /* treat an unreadable preference as "no preference" */ }

  /* ======================================================================
     1. ARRIVAL
     ----------------------------------------------------------------------
     Fires on first paint if the URL carries a hash, and on every hashchange
     after that.  nav.js has already opened any folded ancestors and started
     the scroll; all this does is mark the target so alive.css can resolve a
     ring over it.

     The mark is an attribute rather than a class so it cannot collide with
     the several hundred classes already in play, and it is removed when the
     animation ends so a second visit to the same anchor plays again.  The
     timeout is a backstop for the case where the animation never starts
     (element removed, tab backgrounded before first frame): without it the
     attribute would stick and the second visit would be silent.
     ==================================================================== */
  var ARRIVE_MS = 1350;

  function announce(hash) {
    try {
      var id = String(hash || '').replace(/^#/, '');
      if (!id) return;

      var target = null;
      try { target = document.getElementById(id) || document.querySelector('#' + CSS.escape(id)); }
      catch (e) { target = document.getElementById(id); }
      if (!target) return;

      /* A <details> lights up as a whole block, which on a 3,000px topic is a
         ring around most of a screenful of nothing.  Mark its summary
         instead: that is the line the reader is actually looking at, and it
         is where the eye lands after the scroll. */
      if (target.tagName === 'DETAILS') {
        var sum = target.querySelector(':scope > summary');
        if (sum) target = sum;
      }

      var el = target;
      if (el.hasAttribute('data-sq-arrived')) return;   // already mid-flare

      /* animationend BUBBLES, and the things this site marks are full of
         descendants that animate: `growbar` on an h2's accent bar, `fadeUp` on
         every child of a revealed block, `qpulse`, the widget kit's own
         keyframes. Without this filter the very first descendant animation to
         finish -- often within one frame -- tore the mark off again and the
         arrival was invisible. Only this element's own sq-arrive* animations
         may end it. */
      function clear(e) {
        if (e && (e.target !== el ||
                  String(e.animationName || '').indexOf('sq-arrive') !== 0)) return;
        el.removeAttribute('data-sq-arrived');
        el.removeEventListener('animationend', clear);
      }
      el.addEventListener('animationend', clear);
      window.setTimeout(function () { clear(null); }, ARRIVE_MS + 400);
      el.setAttribute('data-sq-arrived', '');
    } catch (e) { /* an unannounced arrival is the old behaviour, not a fault */ }
  }

  try {
    if (location.hash) {
      /* nav.js scrolls on a double rAF (and again on load) when it had to
         open something.  Land after that so the flare starts once the target
         has stopped moving -- a cue that fires mid-scroll reads as a glitch. */
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          window.setTimeout(function () { announce(location.hash); }, 120);
        });
      });
    }
    window.addEventListener('hashchange', function () { announce(location.hash); });

    /* A same-page anchor click does NOT fire hashchange when the hash is
       already current (click the same link twice), and this is a site where
       re-clicking the nav chip you are already parked on is a normal thing to
       do.  Catch the click as well; the guard inside announce() stops the two
       paths from double-firing. */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || a.closest('nav')) return;              // nav links land via hashchange
      var href = a.getAttribute('href') || '';
      var hash = href.indexOf('#') === 0 ? href
               : (a.pathname === location.pathname && a.hash) ? a.hash : '';
      if (!hash || hash === '#') return;
      window.setTimeout(function () { announce(hash); }, 140);
    }, true);
  } catch (e) {}

  /* ======================================================================
     2. THE SECTION PERMALINK
     ----------------------------------------------------------------------
     One button per id'd heading.  Drawn SVG, not a "#" glyph.  Copies the
     absolute URL; falls back to putting it in the address bar when the
     clipboard is unavailable (insecure origin, denied permission, older
     browser) rather than failing silently.
     ==================================================================== */
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

  /* `host` is the heading itself, which alive.css has already made
     position:relative via .sq-anchored -- so the note lands under the heading
     it belongs to, not under whatever container happens to be positioned. */
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
    /* Headings only, and only ones that already carry an id -- this never
       invents an id, because an invented id is a permalink that breaks the
       first time the page is edited.  Skips the nav, the peripheral rails and
       anything inside a widget's own chrome. */
    var heads = [].slice.call(document.querySelectorAll('h2[id], h3[id]'))
      .filter(function (h) {
        return !h.closest('nav') && !h.closest('.sqrail') && !h.closest('.hud') &&
               !h.querySelector('.sq-permalink');
      });
    if (!heads.length) return;

    /* Read every label BEFORE appending anything.  innerText forces a layout,
       and appending inside the same loop would invalidate it again on every
       iteration -- twenty-four forced reflows on the curriculum pages for a
       string each.  Two passes, one layout.

       innerText rather than textContent because these headings routinely wrap
       a block-level span, and textContent welds the two runs into one word
       ("The courseTwenty-four topics"). innerText honours the break, which
       collapses here into a plain space.

       Deliberately NOT "take the first line": which line carries the title
       varies. On feasible.html #course the eyebrow is second ("The course" /
       "Twenty-four topics, each taught four ways") and on #game-theory it is
       first ("The flagship" / "Game theory: when the thing you're optimising
       against..."). Keeping the whole string is longer but is never wrong
       about what the heading says, and the label's job is only to tell forty
       buttons apart. */
    var labels = heads.map(function (h) {
      var t = h.innerText || h.textContent || '';
      return t.trim().replace(/\s+/g, ' ').slice(0, 70);
    });

    heads.forEach(function (h, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq-permalink';
      btn.innerHTML = LINK_SVG;
      /* The accessible name names the section, so a screen-reader user pulling
         up a list of buttons gets forty distinct labels rather than forty
         identical ones. */
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

  /* ======================================================================
     3. THE UNFOLD
     ----------------------------------------------------------------------
     Height-animates <details> open and closed.  The recipe is the standard
     one -- intercept the summary click, animate an explicit height, then hand
     the element back to `height: auto` -- with four guards this site
     specifically needs:
     ==================================================================== */
  var FOLD_MIN = 180;    /* ms for a short fold */
  var FOLD_MAX = 420;    /* ms for a tall one   */
  /* px of new content beyond which the HEIGHT is not animated.  Not a
     performance superstition -- a height transition on a tall <details>
     relayouts everything below it once per frame, and on the curriculum pages
     that is 24 modules and a quarter of a megabyte of markup.  It is also the
     case where the animation buys least: the viewport is ~700px, so nobody can
     watch 3,000px unfold. Past the cap the fold still resolves, it just
     resolves in opacity, which costs no layout at all.  Measured against the
     real pages: the tallest feasible.html module is 2,311px and the tallest
     .foldsec on qec.html is well under 1,000px. */
  var FOLD_CAP = 2600;

  function foldable(d) {
    /* (a) The nav categories are absolutely-positioned popovers with their own
           coordinated open/close logic in nav.js.  Animating their height
           would fight it and would animate a box that is not in flow anyway.
       (b) The peripheral rails build and rebuild their own <details>.
       (c) A <details> whose content is taller than FOLD_CAP is left alone:
           animating 3,000px of height is a full-page relayout every frame,
           and the jump-cut is the lesser cost. */
    return !d.closest('nav') && !d.closest('.sqrail') && !d.classList.contains('navcat');
  }

  function contentHeight(d) {
    /* Sum of everything that is not the summary, measured while open. */
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

    /* Measure the destination by putting the element in its target state for
       one synchronous read.  `content-visibility` and lazy images make a
       cached measurement wrong often enough that it is not worth caching. */
    var to;
    if (opening) {
      d.open = true;
      to = summaryHeight(d) + contentHeight(d);
    } else {
      to = summaryHeight(d);
    }

    var delta = Math.abs(to - from);

    if (delta < 8) {                              // nothing to reveal
      d.open = opening;
      settle(d);
      return;
    }

    /* Too tall to animate the height.  Open instantly, but resolve the content
       in -- opacity only, no layout, and the reader still gets told that
       something arrived rather than being cut to it.  Closing a tall one is
       instant either way: an exit nobody watches is just latency. */
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
    if (!opening) dur = Math.round(dur * 0.72);   // exit faster than entrance

    d.style.setProperty('--sq-fold-dur', dur + 'ms');
    d.setAttribute('data-sq-folding', opening ? 'in' : 'out');
    d.style.height = from + 'px';
    d.__sqAnim = opening;

    /* Two frames: one for the browser to accept the starting height, one to
       change it.  A single rAF lands often enough to be a bug and rarely
       enough to be missed in testing. */
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (d.__sqAnim !== opening) return;       // superseded by a newer click
        d.style.height = to + 'px';
      });
    });

    var done = function (e) {
      if (e && e.target !== d) return;            // a descendant's transition
      if (d.__sqAnim !== opening) return;
      d.removeEventListener('transitionend', done);
      d.open = opening;
      settle(d);
    };
    d.addEventListener('transitionend', done);
    /* Backstop: transitionend does not fire for a transition that never
       started (element hidden, tab backgrounded, height unchanged).  Without
       this the element keeps an inline height forever. */
    window.setTimeout(function () { if (d.__sqAnim === opening) done(null); }, dur + 90);
  }

  function bindFolds() {
    if (reduce) return;   // geometry is the one thing reduced motion removes

    document.addEventListener('click', function (e) {
      try {
        var s = e.target.closest && e.target.closest('summary');
        if (!s) return;
        var d = s.parentElement;
        if (!d || d.tagName !== 'DETAILS' || !foldable(d)) return;

        /* A click on a real control inside the summary (this site puts
           permalink buttons and chips in there) is that control's, not the
           fold's. */
        if (e.target !== s && e.target.closest('a, button, input, select, label')) return;

        e.preventDefault();
        fold(d, !d.open);
      } catch (err) {
        /* Never swallow the toggle: if anything above threw before
           preventDefault, the native behaviour has already run and we are
           done; if it threw after, force the state so the section still
           opens. */
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

    /* Anything that opens a <details> programmatically -- nav.js's deep-link
       handler, the curriculum trackers, "open all" -- sets .open directly and
       never goes through the click path.  Those must not be animated (they
       often open twenty at once), but they can leave a stale inline height
       behind if they land mid-fold.  This clears up after them. */
    document.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d || d.tagName !== 'DETAILS') return;
      if (d.__sqAnim === undefined || d.__sqAnim === null) return;
      if (d.__sqAnim === d.open) return;
      d.__sqAnim = null;
      settle(d);
    }, true);
  }

  /* ======================================================================
     4. THE MISSING READBAR
     ----------------------------------------------------------------------
     tiers.js draws the 2px reading-progress bar, unconditionally, on every
     page that loads it -- which is 23 of the 24.  formalism.html is the one
     that does not load tiers.js, and it is also the second-longest page on
     the site (177KB, twenty topics).  Rather than pull a 14KB script onto one
     page for a 2px bar, mount the same component here, from the same class,
     when nothing else has: one progress bar, one visual language, and it
     self-heals if another page is ever added without tiers.js.
     ==================================================================== */
  function buildReadbar() {
    if (reduce) return;                              // tiers.js sits this out too
    if (document.querySelector('.readbar')) return;  // tiers.js already built one

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

  /* ---------------------------------------------------------------------- */

  /* --nav-h keeps html's scroll-padding-top honest.  style.css ships a static
     82px, correct for the one-row header at every width it is actually sticky
     at; this replaces it with the measured value so a header that wraps to two
     rows still parks its deep-link targets in the open.  Cheap, and the only
     reason it is JS at all is that the height is content-dependent. */
  function measureNav() {
    try {
      var nav = document.querySelector('nav:not(.rung-rail)');
      if (!nav) return;
      var h = Math.round(nav.getBoundingClientRect().height);
      if (h > 0 && h < 260) document.documentElement.style.setProperty('--nav-h', h + 'px');
    } catch (e) {}
  }

  /* ======================================================================
     7. THE MARKER
     ----------------------------------------------------------------------
     rails.js's section index, but for < 1440px, where the gutter it lives
     in does not exist. A frosted corner pill that names the section you
     are in and opens the full list on a tap. Same heading-label handling
     as rails.js (some h2s here are a title span plus a bare standfirst),
     same owned scroll so the landing clears the sticky header, and it
     opens any <details> the target sits inside on the way.

     Bottom-left (bottom-right is #qz-pill's). Built only where there are
     enough sections to be an index and the page is long enough to get
     lost in; a resize across 1439 just lets alive.css's media query hide
     or show it, no rebuild.
     ==================================================================== */
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

  /* Focus is in a field (or a contenteditable): a document-level key
     handler must not touch it. Shared by the marker's roving arrows and by
     bindKeys below. Mirrors qubit.js's own guard so the two layers agree. */
  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
  }

  function buzz() {
    if (reduce) return;   /* a reduced-motion preference covers haptics too */
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
  }

  /* One place that owns "go to this heading": open every <details> it sits
     inside, then an owned scroll that lands it clear of the sticky header.
     Used by the marker's rows, its "top" row, and the j / k keys. */
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

  /* Set by buildMarker so bindKeys can drive the same section list and the
     same open/close state instead of keeping a second copy. */
  var MARKER = null;

  function buildMarker() {
    var mq = window.matchMedia ? window.matchMedia('(max-width: 1439px)') : null;
    if (mq && !mq.matches) return;   /* the rail owns >= 1440; CSS also guards */

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

    /* a <div>, not a <nav>: style.css's `nav:not(.rung-rail)` rule would
       otherwise style this as the sticky site header. */
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
    /* While the list is open its own arrow keys move focus row to row, so
       a keyboard user is not tabbing through 13 buttons to reach the one
       they want. Enter / Space are the buttons' own; Escape closes. */
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

    /* Touch: a short swipe UP on the collapsed pill opens it; a swipe DOWN
       on the open panel closes it. Bounded to this element, so it never
       argues with the browser's own edge gestures. */
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

  /* ======================================================================
     8. THE KEYS
     ----------------------------------------------------------------------
     rails.css already admits it: the shortcut layer (qubit.js's X-T / M / R)
     is "something you find rather than" are shown, with only a dim corner
     readout as a clue. `?` is the near-universal "show me the keys" key,
     and this overlay is where every shortcut on the page gets a printed
     home. j / k step between section headings (n / p alias); m toggles the
     marker. Everything here is inert while a field has focus or a modifier
     is down, so it never eats a real shortcut or a letter someone typed.
     ==================================================================== */
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
    /* Own list of headings, computed the same way the marker does, so j / k
       work even where the marker is not built (>= 1440, or a 3-section
       page). Rebuilt lazily on first use so a script-rendered page that
       adds its sections late is still covered. */
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

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (editable(e.target) || editable(document.activeElement)) return;

      if (e.key === '?') { e.preventDefault(); buildHelp().toggle(); return; }
      if (e.key === 'm' && MARKER) { e.preventDefault(); MARKER.toggle(); return; }
      /* while the section list is open, its own arrow keys drive it */
      if (MARKER && MARKER.isOpen()) return;
      if (e.key === 'j' || e.key === 'n') { e.preventDefault(); step(1); return; }
      if (e.key === 'k' || e.key === 'p') { e.preventDefault(); step(-1); return; }
    });
  }

  /* ======================================================================
     5. THE VERDICT
     ----------------------------------------------------------------------
     Every widget answers you through a .verdict banner. The first answer
     fades up (style.css); the ones after it just swap text. This marks a
     .verdict for ~0.9s whenever its content actually changes AFTER the
     page has settled, so alive.css can resolve light in the banner's own
     colour. #dq-out (the daily Question's result box) carries no .verdict
     class of its own but plays the same role, so it is watched too.

     One MutationObserver per element, childList + characterData + subtree.
     A short arm-delay after boot keeps the initial render from counting as
     a change. The attribute is cleared on animationend with a timeout
     backstop, exactly like arrival. Pure enhancement: no observer, no
     harm; the widgets already worked without this.
     ==================================================================== */
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
      /* force the animation to restart even if the attribute was just cleared */
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
        /* debounce a burst of mutations into one flare; setTimeout rather
           than rAF so a backgrounded tab still resolves it on return */
        window.clearTimeout(pending);
        pending = window.setTimeout(function () {
          if (el.offsetParent !== null || el.getClientRects().length) flareVerdict(el);
        }, 40);
      });
      try {
        mo.observe(el, { childList: true, characterData: true, subtree: true });
      } catch (e) {}
    }
    /* .verdict is the banner class, but most widgets start their result box
       WITHOUT it and add it on the first answer. Watch those boxes too, by
       the id shapes this codebase uses for them, so the observer is already
       in place before the class ever lands. */
    var SEL = '.verdict, #dq-out, #tryit-out, [id$="-out"], [id$="-verdict"],'
            + ' [id$="-readout"], [id$="-say"], [id$="-out2"]';
    function sweep() {
      try { [].slice.call(document.querySelectorAll(SEL)).forEach(watch); } catch (e) {}
    }
    sweep();
    /* Cabinets and tools that mount on first click bring their result box in
       later; a few spaced re-sweeps catch them without a document-wide
       observer running on every game frame. */
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
/* --- hud.js --- */
/* SymbiQ, hud.js: make progress visible.
 *
 * Two surfaces, one file:
 *   1. THE CHIP, a small persistent readout in the nav, on every page.
 *   2. THE RETURN CARD, on the homepage only (<body data-hud-return>), the
 *      hero gains one personal line for a visitor who has been here before.
 *
 * WHY
 * ---
 * The Solver's Path records everything and shows almost none of it. Coherence
 * moves, missions complete, codex fragments unlock -- and then you navigate to
 * any of the other twenty-two pages and the site behaves as though it has never
 * met you. Invisible progress is not progress; it is a diary nobody reads.
 *
 * THE HONEST-NUMBERS RULE
 * -----------------------
 * This shows only quantities the site actually computes today: coherence,
 * missions cleared, codex fragments. It deliberately does NOT show a streak, a
 * Fidelity score or a rank. Those are real, but they belong to the Discord
 * economy (an operator-run ledger, and the Discord has not launched); there is
 * no such number in this browser to display, and inventing one would be the
 * first fake number on a site whose entire argument is that it has none.
 *
 * SAFETY RULES, the same three every injected script here follows (nav.js,
 * tiers.js, rung.js):
 *   1. PURE PROGRESSIVE ENHANCEMENT. Everything is wrapped. If this file
 *      throws, fails to load, or is served stale, every page is exactly what
 *      it was before it existed. It only ever ADDS a node; it never hides,
 *      moves or rewrites page content.
 *   2. IT DOES NOT REQUIRE save.js. save.js loads on five pages and
 *      coherence.js on two, but the chip has to be right on all twenty-four,
 *      so this reads the same localStorage key directly and merely PREFERS the
 *      real API when it happens to be present. One store, one truth.
 *   3. NOTHING FOR A STRANGER. A first-time visitor has no progress, so no
 *      chip and no return card are rendered at all -- an empty scoreboard is
 *      clutter, not an invitation.
 *
 * API: window.SymbiQ.hud.refresh()   (mostly for the console; it self-updates)
 */
(function () {
  'use strict';
  window.SymbiQ = window.SymbiQ || {};

  var STORE = 'symbiq.solverpath.v1';   // save.js's key -- keep in step with it
  var COH_KEY = 'coherence.v1';         // coherence.js's kv slot
  var COH_BASE = 55;                    // coherence.js's BASE
  var CKEY = 'symbiq_contract_v1';      // games.js FRAME.contract's own key

  /* The six missions in campaign order.
     SOURCE OF TRUTH is missions.js's own M table. This is a deliberate copy:
     missions.js is ~1,800 lines and loads on two pages, while the chip has to
     name "Act IV, The Volcano" on all twenty-four. Copying six rows beats
     shipping the whole campaign engine site-wide to read six strings from it.
     tools/sweep.py asserts this table still agrees with missions.js, so the
     copy cannot drift quietly -- which is the only thing wrong with a copy. */
  var ACTS = [
    { id: 'golf',    act: 'Act I',   place: 'The Quantum Realm' },
    { id: 'grover',  act: 'Act II',  place: 'The Locked Corridor' },
    { id: 'maxcut',  act: 'Act III', place: 'Graph City' },
    { id: 'volcano', act: 'Act IV',  place: 'The Volcano' },
    { id: 'chsh',    act: 'Act V',   place: 'The Shore of Twins' },
    { id: 'knot',    act: 'Act VI',  place: 'The Knot' }
  ];

  /* ------------------------------------------------------------------ read */
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
      next: next,                       // null once the campaign is finished
      codex: codex,
      coh: coh,
      // "Has this browser ever done anything here?" Coherence only counts once
      // it has actually MOVED -- the 55 everyone starts at is not progress.
      seen: done > 0 || codex > 0 || !!d.avatar || raw !== undefined
    };
  }

  // Mirrors coherence.js's own thresholds so the colours agree across surfaces.
  function level(v) { return v < 15 ? 'static' : v < 40 ? 'low' : v < 75 ? 'mid' : 'high'; }

  /* The Contract of the Day's streak lives in its OWN localStorage key, written
     by games.js FRAME.contract on play.html (and any page that mounts a game).
     Read it directly -- same rule as everything else here: games.js is on five
     pages, this line has to be right on the homepage whether or not it loaded.
     The streak IS a real number in this browser (unlike the Discord Fidelity /
     rank), so the honest-numbers rule permits it. */
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
      gap: gap,                          // null never | 0 today | 1 yesterday | ...
      lapsed: gap !== null && gap >= 3,  // past the 1-miss grace -- the streak is spent
      active: streak > 0 || !!last       // has this browser ever taken a Contract?
    };
  }

  var esc = window.SymbiQ.core.esc;   /* plan 24 §2.2 -- one copy, in core.js */

  /* ------------------------------------------------------------- the chip */
  function chipHTML(p, ci) {
    var where = p.next
      ? p.next.act + ' awaits, ' + p.next.place
      : 'The Path is complete';
    var title = 'Coherence ' + p.coh + '% · ' + p.done + ' of ' + p.total +
                ' missions cleared · ' + p.codex + ' codex fragment' +
                (p.codex === 1 ? '' : 's') + '. ' + where + '.';
    // one extra clause when a Contract streak is live -- tooltip / SR only
    if (ci && ci.streak > 0 && !ci.lapsed) {
      title += ' 🔥 ' + ci.streak + '-day Contract streak' +
               (ci.doneToday ? ' (today cleared).' : ', today still open.');
    }
    /* Forty pixels, round, exactly like the account avatar beside it -- and not
       one pixel more. MEASURED: the nav's first row has room for 40-49px and
       nothing else (a 50px control wraps it to a second row, adding 58px of
       header to all 24 pages, on every page, forever). So the chip is a dial,
       not a pill.

       Each number gets the encoding it deserves: coherence is a percentage, so
       it is the ring; missions cleared is a count, so it is the numeral. The
       full sentence lives in the tooltip and in the screen-reader span. */
    return '<a class="hud-chip" href="journey.html" title="' + esc(title) + '"' +
             ' style="--hud-p:' + p.coh + '%" data-level="' + level(p.coh) + '">' +
             '<b class="hud-num" aria-hidden="true">' + p.done + '/' + p.total + '</b>' +
             '<span class="hud-sr">' + esc(title) + '</span>' +
           '</a>';
  }

  function mountChip(p, ci) {
    var nav = document.querySelector('nav');
    if (!nav) return;
    var host = nav.querySelector('.hud-slot');

    if (!p.seen) {                       // a stranger: leave the nav untouched
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    if (!host) {
      host = document.createElement('span');
      host.className = 'hud-slot';
      // Before the account control if there is one, so the reading order is
      // "where you are" then "who you are"; otherwise at the end of the nav.
      var account = nav.querySelector('.sq-account');
      if (account) nav.insertBefore(host, account);
      else nav.appendChild(host);
    }
    host.innerHTML = chipHTML(p, ci);
  }

  /* ------------------------------------------------------ the return card */
  function mountReturn(p) {
    if (!document.body.hasAttribute('data-hud-return')) return;
    var old = document.querySelector('.hud-return');

    if (!p.seen) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }

    // After the tagline, before the call to action: the hero still argues the
    // same thing to a stranger, and gains one line for someone coming back.
    var tagline = document.querySelector('h1 + .tagline') || document.querySelector('.tagline');
    if (!tagline) return;

    /* Two facts and a door, deliberately. Coherence is NOT repeated here: the
       chip in the nav is showing it four inches above, and the card's job is
       orientation ("where was I, what is next"), not a second dashboard. The
       third stat also pushed the line just past the hero's width at common
       progress states, wrapping a one-line greeting onto two. */
    var bits = [];
    bits.push('<b>' + p.done + ' of ' + p.total + '</b> missions cleared');
    if (p.next) bits.push('<b>' + esc(p.next.act) + '</b> awaits in ' + esc(p.next.place));
    else bits.push('the Path is <b>complete</b>');

    var card = old || document.createElement('p');
    card.className = 'hud-return';
    card.innerHTML = '<span class="hud-return-lab">Welcome back.</span> ' +
                     bits.join(' <span class="hud-dot">·</span> ') +
                     ' <a class="hud-return-go" href="' + (p.next ? 'journey.html' : 'play.html') + '">' +
                     // "the Path is complete ... Resume the Path" argues with itself.
                     (p.next ? 'Resume the Path' : 'Into the Arcade') + ' &#9656;</a>';
    if (!old) tagline.parentNode.insertBefore(card, tagline.nextSibling);
  }

  /* -------------------------------------------------- the contract line */
  /* Homepage only, a sibling of the return card. The return card is "where was
     I on the Path"; this is "today's cross-arcade Contract and the streak
     riding on it". It is INDEPENDENT of Path progress -- a visitor who only
     ever plays Contracts in the Arcade still gets this line -- so it is gated
     on contractInfo().active, not progress().seen. Nothing for someone who has
     never taken one. The full challenge text + Play button live on play.html;
     this is the nudge that points there. */
  function mountContract(ci) {
    if (!document.body.hasAttribute('data-hud-return')) return;   // = the homepage hero
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

  /* ------------------------------------------------------------ lifecycle */
  var pending = false;
  function render() {
    if (pending) return;
    pending = true;
    // Coalesce: completeMission() fires onchange, and so does the coherence
    // restore that usually follows it one line later.
    // Called through window, not bare -- an unbound requestAnimationFrame
    // throws "Illegal invocation".
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
      } catch (e) { /* additive only -- never break the page */ }
    });
  }

  function start() {
    render();

    /* save.js exposes ONE onchange slot rather than a listener list, so chain
       it instead of claiming it -- whatever was already there keeps working.
       hud.js is loaded last among the deferred scripts precisely so that the
       thing it chains is already in place. */
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

    // Backstops: another tab making progress, and coming back to a bfcached page.
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
  } catch (e) { /* additive only */ }
})();
;
/* --- theme.js --- */
/* SymbiQ, theme.js
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
;
/* --- dynamics.js --- */
/* SymbiQ, dynamics.js
 * ============================================================================
 * Pairs with dynamics.css; gated on <body data-glass> (all 24 pages as of
 * 2026-08-30).  Two pointer/scroll feeds the CSS cannot get on its own:
 *
 *   1. SCROLLED   sets data-scrolled on <html> once the page passes ~40px,
 *                 so the frosted header can deepen its cast (dynamics.css §4)
 *   2. GLINT      writes --dyn-x / --dyn-y while the pointer is over the
 *                 header, so the glass catches a moving highlight (§2)
 *
 * SAFETY CONTRACT (same as nav.js / alive.js): pure enhancement.  Adds no
 * class that hides content, removes nothing, every feature is in its own
 * try/catch, and if this file 404s or throws on line one every page behaves
 * exactly as it did without it.  Load AFTER nav.js and atmosphere.js.
 * ==========================================================================*/
(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-glass')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { /* unreadable preference -> treat as no-preference */ }

  /* ======================================================================
     1. SCROLLED, data-scrolled on <html>
     ----------------------------------------------------------------------
     rAF-coalesced: the scroll event only ever schedules one frame, and the
     attribute is written only when the boolean actually flips, so a fast
     scroll is a couple of attribute writes, not hundreds.  A 40px / 24px
     split gives it hysteresis so a scroll that hovers on the line does not
     strobe.
     ==================================================================== */
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
    evaluate(); // honour a mid-page reload
  } catch (e) { /* header just never gets the scrolled state */ }

  /* ======================================================================
     2. GLINT, --dyn-x / --dyn-y over the header
     ----------------------------------------------------------------------
     Reduced motion opts out entirely (the highlight is movement).  The
     pointermove handler is rAF-coalesced like the scroll one.  Values are
     viewport percentages so the CSS radial can be positioned without the
     JS knowing the nav's box.  Cleared on leave so the glint fades to its
     resting off-screen position rather than freezing under the cursor's
     last spot.
     ==================================================================== */
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
  } catch (e) { /* no glint; the frost still stands on its own */ }

  /* ======================================================================
     3. HOVER-OPEN, the category menus open on approach, not just click
     ----------------------------------------------------------------------
     Desktop, fine-pointer only.  The five <details class="navcat"> menus
     open on pointer-enter and close a beat after leave; nav.js's own
     `toggle` listener still closes the siblings, so exclusivity is free.
     Everything native survives: click still toggles, the summary is still
     a real focus target, and keyboard use is unaffected (the close is
     cancelled while focus is inside the menu).  The account menu is left
     click-only on purpose -- a user menu that springs open on a passing
     cursor reads as a misfire, not a feature.
     ==================================================================== */
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
            /* don't yank a menu the keyboard is still inside */
            if (!cat.contains(document.activeElement)) cat.open = false;
          }, 220);
        });
      });
    }
  } catch (e) { /* menus stay click-to-open, exactly as before */ }

})();
;
/* --- lexicon.js --- */
/* SymbiQ, lexicon.js — the first half of "the signature."
 * ============================================================================
 * Auto-links technical terms, once each, to the page and anchor that teaches
 * them, using the 126-entry site/data/concepts.json index this project has
 * carried since 2026-08-05 and validated with tools/check_concepts.py ever
 * since -- read by the news pipeline and by index.html's own "since you left"
 * diff, but never once by the pages themselves. This is that.
 *
 * WHY IT IS DEPTH-AWARE, NOT A GENERIC GLOSSARY
 * ----------------------------------------------
 * The card's "read it in full" link points at concept.page + concept.anchor,
 * and tiers.js already reveals whichever 🟢🟡🔴 tier owns a deep-linked anchor
 * rather than fighting it (see tiers.js's own header). So a 🟢 reader who
 * opens a term taught at 🔴 lands on the plain-language treatment of it, not
 * a wall of bra-kets, with zero code shared between the two scripts.
 *
 * SAFETY CONTRACT — same shape as tiers.js / nav.js / rung.js / hud.js:
 *   1. PROGRESSIVE ENHANCEMENT ONLY. If concepts.json 404s, is malformed, or
 *      this script throws anywhere, the page is exactly the prose it always
 *      was. Every entry point is try/caught; nothing here can hide content.
 *   2. NEVER innerHTML A WHOLE PAGE. Other scripts (alive.js, tiers.js,
 *      games.js) bind listeners and hold references into this DOM; this
 *      module walks real Text nodes and splits them individually, so nothing
 *      outside a matched run is ever touched, let alone re-parsed.
 *   3. CASE-SENSITIVE, EXACT-STRING MATCHING. Several concept aliases are
 *      short acronyms (OR, LP, RL, T1, T2, HHL...) that collide with common
 *      English words or generic notation the moment case is ignored -- "OR"
 *      case-insensitively matches the word "or" in every sentence on the
 *      site. Terms are written in their canonical case in concepts.json, and
 *      this only matches that exact case, at the (small, honest) cost of
 *      missing a differently-cased occurrence.
 *   4. FIRST OCCURRENCE PER CONCEPT, PER PAGE. Sprinkling every occurrence
 *      of "qubit" with an underline is noise, not signal.
 *
 * API: window.SymbiQ.sig — the shared popover engine, exposed so receipts.js
 * (the second consumer of the same underline) reuses it instead of building
 * a second floating-card mechanism.
 *   .open(triggerEl, innerHTML, {sticky})
 *   .close(force)
 * ============================================================================
 */
(function () {
  'use strict';
  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  /* ------------------------------------------------------------------ *
   *  THE SHARED POPOVER ENGINE                                          *
   * ------------------------------------------------------------------ */
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
    // Set explicitly rather than trusting the CSS max-width alone -- see
    // lexicon.css's note on min()+calc() resolving to 0px live on at least
    // one real engine.
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
    // Positioned SYNCHRONOUSLY, not via requestAnimationFrame: the card sits
    // at opacity:0/visibility:hidden rather than display:none, so its box is
    // already measurable the instant .open is applied -- no frame needs to
    // pass first. This also sidesteps a real trap: rAF callbacks are held by
    // a backgrounded/hidden tab, so an rAF-deferred placement can simply
    // never run. On a coarse pointer the sheet is fixed to the viewport, so
    // no placement is needed at all.
    var coarse = W.matchMedia && W.matchMedia('(pointer: coarse)').matches;
    if (!coarse) place(trigger);
    // a leftover inline max-width from a fine-pointer open must not survive
    // onto the fixed bottom sheet if the device's pointer type changes
    // between opens (a hybrid touch+mouse laptop, mainly)
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

  /* ------------------------------------------------------------------ *
   *  THE LEXICON ITSELF                                                 *
   * ------------------------------------------------------------------ */
  /* Escapes for a REGEX, not for HTML -- it shared the name `esc` with the
     site's HTML escaper until plan 24 §2.2 moved that one into core.js.
     Renamed so the collision cannot mislead a reader (or a grep) again. */
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
      if (c.page === here) return;              // never link a page to itself
      byId[c.id] = c;
      var forms = [c.term].concat(c.aliases || []);
      forms.forEach(function (t) {
        if (!t || t.length < 2) return;
        patterns.push({ text: t, id: c.id });
      });
    });
    if (!patterns.length) return;

    // longest-first so "Shor's algorithm" is preferred over "Shor's"
    patterns.sort(function (a, b) { return b.text.length - a.text.length; });
    var map = {};
    var alt = patterns.map(function (p) {
      if (!(p.text in map)) map[p.text] = p.id;
      return reEsc(p.text);
    }).join('|');
    var RE = new RegExp('(?<!\\w)(?:' + alt + ')(?!\\w)', 'g');

    var NF = W.NodeFilter;   // captured off window, not relied on as a bare global
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

    // one delegated set of listeners, since spans are created above and
    // never move — attach per-span rather than delegate on root so an
    // event never has to walk back up through arbitrary page markup
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
/* --- receipts.js --- */
/* SymbiQ, receipts.js — the second half of "the signature."
 * ============================================================================
 * Wires up the `.rcpt` spans a page author hand-marks around a load-bearing
 * figure (site/data/receipts.json holds the record; tools/check_receipts.py
 * keeps the two in sync) and adds the page's own "Show the receipts" toggle
 * -- the single control that lights every verified figure on the page at
 * once. See PART A2 of outputs/22_SIGNATURE_UX_AND_GAME_LADDER.md.
 *
 * Depends on lexicon.js's shared popover engine (window.SymbiQ.sig) rather
 * than building a second one -- both files are loaded on every page, and
 * lexicon.js is guaranteed to run first (apply_receipts.py anchors this
 * script immediately after lexicon.js's own tag on every page).
 *
 * SAFETY CONTRACT — same as lexicon.js. If receipts.json 404s or is
 * malformed, or SymbiQ.sig never appears, the page's hand-written .rcpt
 * spans simply render as plain text with an inert dotted underline: no
 * content is hidden, nothing throws past its own try/catch.
 * ============================================================================
 */
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
    if (!W.SymbiQ || !W.SymbiQ.sig) return;   // lexicon.js's engine did not load; nothing to hang off

    var wired = 0;
    mine.forEach(function (r) {
      var span = D.querySelector('.rcpt[data-rcpt="' + r.id + '"]');
      if (!span) return;   // check_receipts.py should already guarantee this exists; degrade quietly if not
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
/* --- search.js --- */
/* SymbiQ, site-wide search. An overlay, not a page.
 *
 * The site runs to dozens of pages and teaches every concept in
 * data/concepts.json across three separate tracks, and until now the only way
 * to reach a specific idea was to already know which track it lived under. Depth nobody can reach is the same
 * as depth that is not there.
 *
 * Opens on "/" or Ctrl/Cmd-K anywhere, or from the Search item in the nav.
 * The index (data/search.json, ~150 KB) is fetched the FIRST time the overlay
 * opens and never on page load, so a reader who does not search pays nothing.
 *
 * Two record kinds, ranked differently on purpose:
 *   c  a concept -- knows the exact page, anchor and depth tier it is taught
 *      at. Ranked above sections: "what does decoherence mean" should land on
 *      the definition, not on a paragraph that happens to say the word.
 *   s  a section heading, with a snippet of the prose under it.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var TIER_LABEL = { g: 'plain', y: 'working', r: 'formal' };
  var idx = null;          // loaded index
  var loading = null;      // in-flight promise
  var box = null;          // overlay root
  var input = null, list = null, status = null;
  var results = [], cursor = -1, lastFocus = null;

  var esc = window.SymbiQ.core.esc;   /* plan 24 §2.2 -- one copy, in core.js */

  /* Highlight every query token in a already-escaped string. Done after
     escaping so a page whose prose contains "<" cannot inject markup. */
  function mark(escaped, tokens) {
    if (!tokens.length) return escaped;
    var re = new RegExp('(' + tokens.map(function (t) {
      return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')', 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
  }

  function base() {
    // every page sits at the site root, so relative hrefs just work
    return '';
  }

  function load() {
    if (idx) return Promise.resolve(idx);
    if (loading) return loading;
    loading = fetch(base() + 'data/search.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        idx = j;
        /* The placeholder used to name the page and concept counts as typed
           literals, and was wrong within an hour of being written. Same bug as
           corrections 4 and 5: a number in prose that nothing recomputes. It
           is now read off the index it describes. */
        if (input) {
          var nC = 0;
          j.records.forEach(function (r) { if (r.k === 'c') nC++; });
          input.placeholder = 'Search ' + j.pages + ' pages and ' + nC + ' concepts…';
        }
        // pre-lowercase once, not on every keystroke
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
    if (r._h === q) s += 120;                       // exact heading / term
    else if (r._h.indexOf(q) === 0) s += 70;        // heading starts with it
    else if (r._h.indexOf(q) >= 0) s += 45;         // heading contains it
    if (r._a && r._a.indexOf(q) >= 0) s += 40;      // a concept alias matches
    if (r._x.indexOf(q) >= 0) s += 12;              // phrase in the snippet
    if (r._t.indexOf(q) >= 0) s += 8;               // phrase in the page title

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
    if (!hitAll) return 0;                          // every token must appear
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
      /* A concept gets a pill, because "this is a definition" is the useful
         thing to say about it. A section gets the page it lives on, as plain
         muted text -- page titles here are full sentences ("Is quantum
         computing just quantum mechanics?") and a sentence set in an
         uppercase pill is unreadable. */
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
    /* The host is a real, static, empty element on every page (apply_search.py
       puts it there), not one conjured on first open. Three separate checkers
       -- smoke.mjs, sweep.py and check_site.py -- independently flagged the
       lazy version as a dead #search anchor, and they were right: a link whose
       target does not exist until you click it is a broken link with a
       workaround, and it would have been broken for anyone with JS off. */
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
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
          (t && t.isContentEditable)) return;
      e.preventDefault(); open();
    }
  });

  // any link to #search opens the overlay instead of jumping
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href$="#search"]');
    if (a) { e.preventDefault(); open(); }
  });

  SymbiQ.search = { open: open, close: close };
})();
;
/* --- contradiction.js --- */
/* SymbiQ, contradiction.js — the ledger, inline, where the claim is made.
 * ============================================================================
 * PART A3 of outputs/22_SIGNATURE_UX_AND_GAME_LADDER.md.
 *
 * A page author drops one placeholder next to the paragraph making a tracked
 * claim:
 *
 *   <div class="contra" data-claim="dwave-magnetic-simulation-supremacy-2025">
 *     <a href="ledger.html#c-dwave-magnetic-simulation-supremacy-2025">Tracked on The Ledger →</a>
 *   </div>
 *
 * and this fills it in from site/data/claims/ — the same records ledger.js
 * reads and tools/check_claims.py validates. The static link inside the
 * placeholder is the JS-off / fetch-failed state and is never removed until
 * the real card is ready to replace it.
 *
 * WHY FETCHED RATHER THAN BAKED INTO THE HTML
 * -------------------------------------------
 * A claim's status changes: check-ins get added, deadlines pass, verdicts
 * land. Summarising a claim into prose on three pages creates three copies
 * that drift, which is not hypothetical here -- race.html carried the same
 * wrong sentence in three hand-copied places for three days (correction 1).
 * One record, N renderings, zero copies. The cost is that a crawler sees the
 * fallback link instead of the card, which is the right trade for a
 * supplementary card whose whole value is being current.
 *
 * SAFETY CONTRACT — the house rule, same as lexicon.js / receipts.js /
 * throughline.js:
 *   1. PROGRESSIVE ENHANCEMENT. If a fetch fails, the JSON is malformed, or
 *      anything here throws, the placeholder keeps its static link. No prose
 *      is ever hidden, moved or rewritten.
 *   2. NEVER ASSERTS ANYTHING THE LEDGER DOES NOT. Every line rendered is a
 *      field from the record. Nothing is computed except "has this deadline
 *      passed", which is a date comparison against grace_days, exactly as
 *      tools/sweep_claims.py does it.
 *   3. ONE FETCH PER SLUG PER PAGE, even if two placeholders name the same
 *      claim.
 * ============================================================================
 */
(function () {
  'use strict';
  var W = window, D = document;

  var STATUS_LABEL = {
    draft: 'Draft', tracking: 'Tracking', resolvable: 'Awaiting resolution',
    proposed: 'Proposed', resolved: 'Resolved', void: 'Void', superseded: 'Superseded'
  };
  var VERDICT_LABEL = {
    verified: 'Verified', partially_verified: 'Partially verified',
    not_verified: 'Not verified', unfalsifiable: 'Unfalsifiable', overtaken: 'Overtaken'
  };

  var esc = window.SymbiQ.core.esc;   /* plan 24 §2.2 -- one copy, in core.js */

  function fmtDate(s) {
    if (!s) return '';
    try {
      return new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
      });
    } catch (e) { return s; }
  }

  /* Same rule as tools/sweep_claims.py: a claim is past due once its
     resolution date plus its own grace period is behind us. */
  function pastDue(rec) {
    if (!rec.resolves_by) return false;
    try {
      var due = new Date(rec.resolves_by + 'T00:00:00Z').getTime();
      due += (+rec.grace_days || 0) * 86400000;
      return Date.now() > due;
    } catch (e) { return false; }
  }

  /* The state every rendering agrees on. Returned as {cls, kicker} so the
     full card and the compact scoreboard cell can never disagree about
     whether a claim is in trouble. */
  function state(rec) {
    var ci = rec.checkins || [];
    /* `at_risk` and `off_track` are NOT the same finding and must never share
       a label. at_risk = someone published evidence AGAINST the claim (a
       rebuttal). off_track = nobody argued with it; the date came and went
       with nothing reported. Calling the second one "contested" credits a
       rebuttal that does not exist -- the exact class of mislabel this
       project keeps logging. */
    var rebutted = ci.filter(function (c) { return c.signal === 'at_risk'; });
    var missed = ci.filter(function (c) { return c.signal === 'off_track'; });
    var good = ci.filter(function (c) { return c.signal === 'on_track'; });
    var trouble = rebutted.concat(missed);

    if (rec.verdict) {
      return { cls: rec.verdict === 'verified' ? 'is-ontrack' : 'is-contested',
               kicker: 'Resolved · ' + (VERDICT_LABEL[rec.verdict] || rec.verdict),
               short: VERDICT_LABEL[rec.verdict] || rec.verdict, trouble: trouble, good: good };
    }
    if (rebutted.length >= 2) {
      return { cls: 'is-contested', kicker: rebutted.length + ' dated rebuttals are on the record',
               short: rebutted.length + ' rebuttals on the record', trouble: trouble, good: good };
    }
    if (rebutted.length === 1) {
      return { cls: 'is-contested', kicker: 'Contested — one dated rebuttal is on the record',
               short: 'one rebuttal on the record', trouble: trouble, good: good };
    }
    if (missed.length) {
      return { cls: 'is-overdue',
               kicker: 'Its own deadline passed with nothing reported',
               short: 'missed, nothing reported', trouble: trouble, good: good };
    }
    if (pastDue(rec)) {
      return { cls: 'is-overdue', kicker: 'This deadline has passed, unresolved',
               short: 'deadline passed, unresolved', trouble: trouble, good: good };
    }
    if (good.length) {
      return { cls: 'is-ontrack', kicker: 'Tracked · an interim milestone has landed',
               short: 'an interim milestone has landed', trouble: trouble, good: good };
    }
    return { cls: '', kicker: 'Tracked, and not resolved yet', short: 'tracked, not resolved',
             trouble: trouble, good: good };
  }

  /* The compact form, for race.html's scoreboard. Deliberately carries NO
     hand-written summary of the claim -- only its own dated state and a link
     -- because a summary in a table cell is exactly the copy that drifts. */
  function buildCell(rec) {
    var st = state(rec);
    return '<span class="contra-cell ' + esc(st.cls) + '">' +
      '<span class="contra-dot" aria-hidden="true"></span>' +
      '<a href="ledger.html#c-' + esc(rec.slug) + '">resolves ' +
      esc(fmtDate(rec.resolves_by)) + '</a>' +
      '<span class="contra-cell-note">' + esc(st.short) + '</span></span>';
  }

  function build(rec, claimantName) {
    var st = state(rec);
    var trouble = st.trouble, good = st.good;
    var cls = st.cls ? ' ' + st.cls : '';
    var kicker = st.kicker;

    /* The shown check-ins: whatever actually carries a signal. A no_signal
       "captured at seed" note says nothing and is left to the full record. */
    var shown = trouble.length ? trouble : good;

    var h = '<div class="contra-card' + cls + '">';
    h += '<span class="contra-kicker">' + esc(kicker) + '</span>';
    h += '<p class="contra-claim">' +
         (rec.verbatim ? '<q>' + esc(rec.verbatim) + '</q>' : esc(rec.headline)) +
         '</p>';
    h += '<span class="contra-who">' + esc(rec.speaker || claimantName || '') +
         (rec.source_date ? ' · ' + esc(fmtDate(rec.source_date)) : '') +
         (rec.source_url ? ' · <a href="' + esc(rec.source_url) +
            '" rel="noopener noreferrer">source →</a>' : '') +
         '</span>';

    if (shown.length) {
      h += '<ul class="contra-list">' + shown.map(function (c) {
        return '<li class="' + esc(c.signal || '') + '">' +
          '<span class="contra-when">' + esc(fmtDate(c.at)) + '</span>' +
          esc(c.note) +
          (c.source_url ? ' <a href="' + esc(c.source_url) +
             '" rel="noopener noreferrer">source →</a>' : '') +
          '</li>';
      }).join('') + '</ul>';
    }

    h += '<p class="contra-foot">' +
         esc(STATUS_LABEL[rec.status] || rec.status || 'Tracked') +
         (rec.resolves_by ? ' · resolves by ' + esc(fmtDate(rec.resolves_by)) : '') +
         (rec.grace_days ? ' (+' + esc(rec.grace_days) + ' days’ grace)' : '') +
         ' · <a href="ledger.html#c-' + esc(rec.slug) +
         '">the frozen criteria and full record →</a></p>';
    h += '</div>';
    return h;
  }

  function boot() {
    var cards = Array.prototype.slice.call(D.querySelectorAll('.contra[data-claim]'));
    var cells = Array.prototype.slice.call(D.querySelectorAll('[data-claim-cell]'));
    if (!cards.length && !cells.length) return;

    /* One bucket per slug, so a page carrying both a card and a scoreboard
       cell for the same claim still fetches that record exactly once. */
    var byslug = {};
    function want(el, attr, kind) {
      var s = el.getAttribute(attr);
      if (!s) return;
      (byslug[s] = byslug[s] || []).push({ el: el, kind: kind });
    }
    cards.forEach(function (n) { want(n, 'data-claim', 'card'); });
    cells.forEach(function (n) { want(n, 'data-claim-cell', 'cell'); });

    var names = {};
    fetch('data/claims/claimants.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        (d && d.claimants || []).forEach(function (c) { names[c.slug] = c.name; });
      })
      .catch(function () {})
      .then(function () {
        Object.keys(byslug).forEach(function (slug) {
          fetch('data/claims/' + slug + '.json')
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (rec) {
              if (!rec || !rec.slug) return;          // keep the fallback link
              var card = null, cell = null;
              byslug[slug].forEach(function (t) {
                if (t.kind === 'cell') {
                  if (cell === null) cell = buildCell(rec);
                  t.el.innerHTML = cell;
                } else {
                  if (card === null) card = build(rec, names[rec.claimant]);
                  t.el.innerHTML = card;
                }
              });
            })
            .catch(function () {});
        });
      });
  }

  try {
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
    else boot();
  } catch (e) {}
})();
;
