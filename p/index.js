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
  /* ---- THE STANDING, loaded only if this reader actually reaches a question
     ----------------------------------------------------------------------
     standing.js records a correct/incorrect answer as a "proof" in the
     reader's own record. It is ~15 KB and irrelevant to anyone who never
     reaches a .cyu block, so it is NOT in these pages' bundles: they carry an
     inert <script id="standing-src" type="text/symbiq-lazy"> whose unrecognised
     type stops the browser fetching it, and it is fetched from here instead.

     ⚠ WHY THIS EXISTS AT ALL. The first version of The Standing (2026-09-22)
     hooked recordCyu() from the click handler below, guarded, and shipped
     standing.js on exactly two pages -- ledger.html and standing.html -- while
     the .cyu blocks live on ten OTHERS. The intersection was empty, so the
     hook could never once fire and half the feature was an empty room. The
     guard that makes the hook safe is the same guard that hid it being
     unwired, which is why the pairing is now checked in check_site.py §13.

     Belt and braces, on purpose: preload() warms it when a question comes into
     view, and record() still loads-then-records if it somehow has not arrived
     (a reader who answers instantly, or an IntersectionObserver-less browser).
     loadScript is memoised, so the two paths cost one fetch between them. */
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

  /* Record one answer. Never allowed to throw into the click handler, and
     never allowed to change what the reader sees -- a page with no standing
     tag at all behaves exactly as it did before this existed. */
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

  /* 2026-09-23: speculation-rules.json can fetch this page's HTML into the
     cache on a mere HOVER, well before a reader has visited it (it never
     runs page JavaScript, so this guard only matters if a rule ever grows
     into "prerender" -- currently the site uses "prefetch" only, which does
     not execute this file at all). If it ever does, appending the beacon
     script here would count a hover as a visit. document.prerendering is
     true only while the page is being rendered in the background; wait for
     it to actually become the active page before sending anything. Browsers
     without prerendering support don't define the property, so this is a
     no-op there and the script loads immediately as it always has. */
  function fire() { document.head.appendChild(s); }
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', fire, { once: true });
  } else {
    fire();
  }

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
/* --- archive.js --- */
/* SymbiQ, The Question archive, defined once and mounted anywhere.
 *
 *   SymbiQ.archive.mount(el, { limit, open })
 *
 * Used by archive.html (the full back catalogue) and by index.html, where it
 * sits collapsed inside The Question card.
 *
 * WHY IT IS ON THE HOMEPAGE: the archive existed from 2026-07-29 but was
 * reachable only from inside the Lattice overlay. A reader standing on the
 * homepage, noticing yesterday's question had gone, had no visible way back
 * to it, so as far as they were concerned the questions still vanished.
 * Reported by Chinmoy 2026-07-30. Discoverability is not a smaller problem
 * than storage; a thing you cannot find is a thing you do not have.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var TIER = { g: '🟢 Beginner', y: '🟡 Intermediate', r: '🔴 Expert' };

  var esc = window.SymbiQ.core.esc;   /* plan 24 §2.2 -- one copy, in core.js */

  function renderOne(q) {
    var Q = q.question, opts = Q.options || [];
    return '<p class="archq-full">' + esc(Q.text) + '</p>' +
      '<ol class="archq-opts">' + opts.map(function (o, i) {
        return '<li' + (i === Q.answerIndex ? ' class="right"' : '') + '>' + esc(o) +
               (i === Q.answerIndex ? ' <b>← the answer</b>' : '') + '</li>';
      }).join('') + '</ol>' +
      (Q.hint ? '<p class="archq-hint"><b>Hint given on the day:</b> ' + esc(Q.hint) + '</p>' : '') +
      ['g', 'y', 'r'].map(function (t) {
        var txt = Q.explain && Q.explain[t];
        return txt ? '<div class="archq-ex"><h4>' + TIER[t] + '</h4><p>' + esc(txt) + '</p></div>' : '';
      }).join('') +
      (q.signal ? '<p class="archq-signal"><b>The Signal that day:</b> ' + esc(q.signal) + '</p>' : '');
  }

  function mount(host, o) {
    if (!host) return;
    o = o || {};
    var base = o.base || '';
    host.innerHTML = '<p class="archq-loading">Loading previous questions…</p>';

    fetch(base + 'data/archive/index.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (idx) {
        var entries = (idx && idx.entries) || [];
        if (!entries.length) { host.innerHTML = '<p class="archq-loading">Nothing archived yet.</p>'; return; }
        entries.sort(function (a, b) { return b.qnum - a.qnum; });
        var shown = o.limit ? entries.slice(0, o.limit) : entries;

        host.innerHTML =
          (o.heading ? '<p class="archq-count">' + entries.length + ' question' +
            (entries.length === 1 ? '' : 's') + ' asked so far. Newest first, open any one for the answer ' +
            'and all three explanations.</p>' : '') +
          shown.map(function (e) {
            return '<details class="archq" data-date="' + esc(e.date) + '">' +
                     '<summary>' +
                       '<span class="archq-num">#' + esc(e.qnum) + '</span>' +
                       '<span class="archq-txt">' + esc(e.question) + '…</span>' +
                       '<span class="orbadge">' + esc(TIER[e.tier] || e.tier) + '</span>' +
                       '<span class="orbadge">' + esc(e.date) + '</span>' +
                     '</summary>' +
                     '<div class="archq-body"><p class="archq-loading">Opening…</p></div>' +
                   '</details>';
          }).join('') +
          (o.limit && entries.length > o.limit
            ? '<p class="archq-more"><a href="' + base + 'archive.html">See all ' + entries.length +
              ' questions in the full archive →</a></p>'
            : '');

        // fetch each full record the first time its row is opened
        host.addEventListener('toggle', function (ev) {
          var d = ev.target;
          if (d.tagName !== 'DETAILS' || !d.open || d.dataset.loaded) return;
          d.dataset.loaded = '1';
          var body = d.querySelector('.archq-body');
          fetch(base + 'data/archive/' + d.dataset.date + '.json', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (q) { body.innerHTML = renderOne(q); })
            .catch(function (err) {
              body.innerHTML = '<p class="archq-loading">Could not load this one (' + esc(err.message) + ').</p>';
              d.dataset.loaded = '';
            });
        }, true);
      })
      .catch(function (err) {
        host.innerHTML = '<p class="archq-loading">The archive could not be loaded (' + esc(err.message) +
          '). It lives at <code>data/archive/index.json</code>.</p>';
      });
  }

  window.SymbiQ.archive = { mount: mount };
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
/* --- living.js --- */
/* SymbiQ, living.js
 * ============================================================================
 * THE LIVING LAYER.  Opt-in via <body data-living>.  Pairs with living.css.
 *
 * Its own file with its own cache-buster, for the reason motion.css / vivid.css
 * / alive.css / glass.css each have one: style.css is shared by 24 pages and
 * touching it forces a bump on every one of them (the 2026-07-24 scar).  A
 * layer should never be a 24-page deploy.
 *
 * WHAT THIS LAYER DOES.  Almost all of "living" is CSS -- see living.css: a
 * full-bleed breakout for the one big figure on a page, a longer stagger on
 * the reveals nav.js already owns, and the homepage Loop's flow dots driven
 * by scroll instead of a timer.  This script owns exactly one thing that is
 * not decoration:
 *
 *   THE COUPLING STRIP.  A line of independent phase oscillators, coupled to
 *   their neighbours by the Kuramoto mean-field rule, that pulls itself into
 *   phase while you watch.  It mounts into any [data-living-strip] element;
 *   the homepage puts one directly under the sentence it illustrates --
 *   "Couple many of the same circuits instead, and you get the machine
 *   operations research already runs on."  It is the same object every
 *   oscillator-Ising-machine widget on the site already runs (analog.html,
 *   games.js), shown at rest.
 *
 * The exact model, its constants and its claims are brute-forced in
 * tools/verify_living.py -- keep the two in sync.
 *
 * SAFETY CONTRACT, same as alive.js / nav.js.  Pure enhancement.  Adds no
 * class that hides content, removes nothing, every entry point in its own
 * try/catch.  If this file 404s, throws on line one, or is blocked, every
 * page is byte-for-byte what it was before it existed -- a [data-living-strip]
 * that never gets a canvas is an empty 0-height div nobody sees.
 * ==========================================================================*/
(function () {
  'use strict';

  var W = window, D = document;
  if (!D.body || !D.body.hasAttribute('data-living')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { /* unreadable preference -> treat as no preference */ }

  /* ---- constants: identical to tools/verify_living.py -------------------- */
  var N = 14;            /* oscillators in the strip */
  var K = 1.6;           /* coupling strength */
  var SPREAD = 0.20;     /* natural frequencies ~ uniform(-SPREAD, +SPREAD) */
  var NOISE = 0.012;     /* per-step phase noise amplitude */
  var DT = 1 / 60;       /* integrator step, seconds; frame dt is clamped to this */

  /* Colour read from the cascade so the strip re-themes with everything else,
     exactly as atmosphere.js does it. */
  function rgbOf(name, fallback) {
    try {
      var s = getComputedStyle(D.documentElement).getPropertyValue(name).trim();
      var m = /^#?([0-9a-f]{6})$/i.exec(s);
      if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(s);
      if (m) return [+m[1], +m[2], +m[3]];
    } catch (e) {}
    return fallback;
  }
  var COL = { v: [167, 139, 250], t: [45, 212, 191], m: [154, 165, 189] };
  function readColours() {
    COL.v = rgbOf('--violet', COL.v);
    COL.t = rgbOf('--teal', COL.t);
    COL.m = rgbOf('--muted', COL.m);
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

  /* ---- the model: one Euler step, mirrors verify_living.step_kuramoto ---- */
  function stepKuramoto(theta, omega) {
    var i, j, n = theta.length, pull = new Float64Array(n);
    for (i = 0; i < n; i++) {
      var acc = 0;
      for (j = 0; j < n; j++) acc += Math.sin(theta[j] - theta[i]);
      pull[i] = (K / n) * acc;
    }
    for (i = 0; i < n; i++) {
      theta[i] += DT * (omega[i] + pull[i]) + DT * NOISE * gauss();
      theta[i] = ((theta[i] % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
  }
  /* Box-Muller; one cached spare. Good enough for a visual noise term. */
  var spare = null;
  function gauss() {
    if (spare !== null) { var s = spare; spare = null; return s; }
    var u = Math.random() || 1e-9, v = Math.random();
    var r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  function newState(seed) {
    var theta = new Float64Array(N), omega = new Float64Array(N), i;
    for (i = 0; i < N; i++) {
      theta[i] = Math.random() * 2 * Math.PI;
      omega[i] = (Math.random() * 2 - 1) * SPREAD;
    }
    return { theta: theta, omega: omega };
  }

  /* ---- one strip ------------------------------------------------------- */
  function mountStrip(host) {
    if (!host || host.__living) return;
    host.__living = true;

    var cvs = D.createElement('canvas');
    cvs.className = 'living-strip-cvs';
    cvs.setAttribute('aria-hidden', 'true');
    host.appendChild(cvs);
    var ctx = cvs.getContext('2d');
    if (!ctx) { host.__living = false; cvs.remove(); return; }

    var dpr = 1, w = 0, h = 0;
    function size() {
      dpr = Math.min(W.devicePixelRatio || 1, 2);
      var r = host.getBoundingClientRect();
      w = Math.max(240, Math.round(r.width));
      h = Math.round(r.height) || 44;
      cvs.width = Math.round(w * dpr);
      cvs.height = Math.round(h * dpr);
      cvs.style.width = w + 'px';
      cvs.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var st = newState();

    function order() {
      var re = 0, im = 0, i;
      for (i = 0; i < N; i++) { re += Math.cos(st.theta[i]); im += Math.sin(st.theta[i]); }
      return Math.sqrt(re * re + im * im) / N;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      var mid = h / 2, gap = w / N, r = order();
      var i, x;

      /* the coupling line: faint, brightens as the field orders */
      ctx.strokeStyle = rgba(COL.m, 0.10 + r * 0.10);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gap * 0.5, mid);
      ctx.lineTo(w - gap * 0.5, mid);
      ctx.stroke();

      for (i = 0; i < N; i++) {
        x = gap * (i + 0.5);
        var b = (1 + Math.cos(st.theta[i])) / 2;          /* brightness, [0,1] */
        var yoff = Math.sin(st.theta[i]) * (2.2 + r * 1.6); /* a hair of vertical life */
        /* colour: muted when the field is scattered, accent when it locks */
        var cc = i % 2 ? COL.t : COL.v;
        var col = [
          COL.m[0] + (cc[0] - COL.m[0]) * r,
          COL.m[1] + (cc[1] - COL.m[1]) * r,
          COL.m[2] + (cc[2] - COL.m[2]) * r
        ];
        var rad = 1.6 + b * 2.0 + r * 0.6;
        ctx.fillStyle = rgba(col, 0.22 + b * 0.42);
        ctx.beginPath();
        ctx.arc(x, mid + yoff, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* reduced motion: settle the model headlessly, draw one locked frame */
    if (reduce) {
      size();
      for (var k = 0; k < 14 * 60; k++) stepKuramoto(st.theta, st.omega);
      draw();
      cvs.classList.add('on');
      return;
    }

    var raf = 0, last = 0, running = false, visible = false;
    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min((t - last) / 1000, DT) : DT;
      last = t;
      /* fixed-step: advance the model by whole DT ticks, at most 3 a frame */
      var acc = dt, guard = 0;
      while (acc >= DT * 0.5 && guard++ < 3) { stepKuramoto(st.theta, st.omega); acc -= DT; }
      draw();
      raf = W.requestAnimationFrame(frame);
    }
    function start() { if (running || !visible || D.hidden) return; running = true; last = 0; raf = W.requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) W.cancelAnimationFrame(raf); raf = 0; }

    size();
    draw();
    W.setTimeout(function () { cvs.classList.add('on'); }, 90);

    var rt;
    W.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = W.setTimeout(function () { size(); if (!running) draw(); }, 160);
    });

    D.addEventListener('visibilitychange', function () {
      if (D.hidden) stop(); else start();
    });

    if (W.matchMedia) {
      var mq = W.matchMedia('(prefers-color-scheme: dark)');
      var onS = function () { readColours(); if (!running) draw(); };
      if (mq.addEventListener) mq.addEventListener('change', onS);
      else if (mq.addListener) mq.addListener(onS);
    }

    /* only spin the loop while the strip is actually on screen */
    if ('IntersectionObserver' in W) {
      new W.IntersectionObserver(function (ents) {
        visible = ents[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.01 }).observe(host);
    } else {
      visible = true; start();
    }
  }

  function boot() {
    try {
      readColours();
      var hosts = D.querySelectorAll('[data-living-strip]');
      for (var i = 0; i < hosts.length; i++) {
        try { mountStrip(hosts[i]); } catch (e) {}
      }
    } catch (e) { /* living is enhancement; a failure is a no-op */ }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
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
/* --- home.js --- */
/* SymbiQ, home.js
 * ============================================================================
 * THE HOME PAGE LAYER.  index.html only.  Pairs with home.css.
 *
 *   1. THE INSTRUMENT   two sliders, three computed readouts, one verdict
 *   1b. THE FLOAT       the orb's live figure; placing, dragging, closing the panel
 *   2. THE PARALLAX     --px / --py on <html>, consumed by home.css section 3
 *   3. THE STATIONS     an IntersectionObserver over [data-station]
 *   4. THE COMPANION    the bottom-left progress ring and its card
 *   5. THE KEYS         g h / g p / 1 2 3 / m / ? / Esc, plus the nav button
 *   6. THE GESTURE      undocumented; found by typing, not by reading
 *   7. THE FIELD        the pointer-reactive lattice, replacing atmosphere.js
 *
 * SAFETY CONTRACT, the same one nav.js and alive.js sign: this file is pure
 * enhancement.  It hides no content, removes nothing an unstyled reader
 * needs, and every entry point sits inside its own try/catch.  If it 404s or
 * throws on line one the page is a complete, readable, fully linked document
 * -- the instrument degrades to two labelled sliders with static markup
 * around them, and every section is still reachable by scrolling.  (Since
 * 2026-09-23 the instrument sits in a native popover the orb toggles; the
 * BROWSER opens and closes it, so that still holds without this file.)
 *
 * ORDERING.  Loads LAST, after nav.js, tiers.js, qubit.js and alive.js, so
 * section 5 can see what those bound and cooperate with it rather than
 * fight it.  See section 5 for exactly who gets which key and why.
 * ==========================================================================*/
(function () {
  'use strict';

  var W = window, D = document;
  W.SymbiQ = W.SymbiQ || {};

  /* The two ways a reader asks for less motion: the OS preference, and this
     site's own explicit switch (theme.js writes data-motion-pref on <html>).
     living.js reads both; so does this. */
  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) {}

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  /* Read a colour token out of the cascade rather than hardcoding it, so
     everything below re-themes with vivid.css / theme.css / the light block
     instead of becoming the one violet thing on a light page. */
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

  /* ======================================================================
     1. THE INSTRUMENT
     ----------------------------------------------------------------------
     The hero leads with something that computes.  Two sliders, three
     readouts, one verdict, and not a single hand-written number on its face.

     THE MODEL is the site's own, not a new one.  Below threshold a surface
     code suppresses errors as

         p_L(d) = A * (p / p_th) ^ floor((d+1)/2)          Fowler 1208.0928

     which qec.html's Threshold Explorer and race.html's threshold widget
     already run, and tools/verify_threshold.py already brute-forces (the
     exponent, the d -> d+2 ratio, the monotonicity flip at p_th, and the
     2d^2-1 cost).  Here A = 0.1 and p_th = 1%, and d is odd, so
     floor((d+1)/2) is exactly (d+1)/2.  tools/verify_home_threshold.py
     brute-forces THIS instrument: the arithmetic, the formatting, the
     boundary, and the agreement with the shared law.

     p_L is capped at 0.5 because a per-round logical error probability
     cannot exceed a coin flip; above threshold the scaling form runs away
     and the cap is what keeps the readout honest instead of absurd.
     ==================================================================== */
  var P_TH = 0.01;          /* threshold, 1% -- the line the whole page is about */
  var A_PREF = 0.1;         /* prefactor at p = p_th */
  var ROUND_S = 1e-6;       /* one syndrome round, one microsecond */

  function pLogical(p, d) {
    return Math.min(0.5, A_PREF * Math.pow(p / P_TH, (d + 1) / 2));
  }
  function patchQubits(d) { return 2 * d * d - 1; }   /* rotated surface-code patch */
  function lifetimeS(pL) { return ROUND_S / pL; }

  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
              '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
              '-': '⁻' };
  function sup(n) {
    return String(n).split('').map(function (c) { return SUP[c] || c; }).join('');
  }
  var log10 = Math.log10 || function (x) { return Math.log(x) / Math.LN10; };

  /* Scientific notation below 0.01, a plain two-significant-figure decimal at
     or above it.  The renormalise branch is not decoration: log10(1e-15) can
     land on -15.000000000000002, whose floor is -16, which would otherwise
     print "10.0x10^-16". */
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
  /* Seconds -> the largest unit that leaves a number a person can hold.
     A Julian year (365.25 days) so "yr" means the same thing here as it does
     in every other duration on the site.

     The two lowest boundaries are nudged down by half a printed digit
     (999.5us, 0.9995s) so a value that would ROUND UP to 1000 steps to the
     next unit instead. Not hypothetical: p = 0.1%, d = 3 gives p_L =
     1.0000000000000002e-3 in binary floating point, so the lifetime lands at
     999.9999999999998 microseconds and the naive ladder printed "1000 us".
     Caught by tools/verify_home_threshold.py check 8a. No higher boundary
     can reach 1000 (60 s, 60 min, 24 h, 365.25 days), so only these two
     need it. */
  function duration(s) {
    if (s < 999.5e-6) return [sigfig(s * 1e6), 'µs'];
    if (s < 0.9995) return [sigfig(s * 1e3), 'ms'];
    if (s < 60) return [sigfig(s), 's'];
    if (s < 3600) return [sigfig(s / 60), 'min'];
    if (s < 86400) return [sigfig(s / 3600), 'h'];
    if (s < 31557600) return [sigfig(s / 86400), 'days'];
    return [sigfig(s / 31557600), 'yr'];
  }

  /* Exposed so tools/verify_home_threshold.py's browser-side twin, and any
     future widget that wants to agree with this one, can call the same
     functions rather than reimplement them. */
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
    /* The orb's one live figure (section 1b). Outside the panel on purpose:
       it is what the closed instrument still says. */
    var orb = $('#inst-orb'), orbRead = $('#ti-orb');

    function render() {
      /* The p slider counts tenths of a percent (1..41) so every step is an
         exact integer and 1.0% is reachable exactly -- a float slider would
         put the one boundary the widget is about at 0.009999999999. */
      var pTenths = +pIn.value;
      var p = pTenths / 1000;
      var d = +dIn.value;

      pOut.textContent = (pTenths / 10).toFixed(1) + '%';
      dOut.textContent = 'd = ' + d;
      /* A range input announces its raw number; these say what the number
         means, so a screen-reader user hears "0.5 percent", not "5". */
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
        /* Lambda = p_th / p is the suppression per d -> d+2, which is what
           "below threshold" actually buys you. Computed, like everything
           else on this face. */
        vVer.textContent = 'Below threshold. Each step of two in d divides p'
          + 'ₗ by ' + sigfig(P_TH / p) + '×.';
      } else if (p === P_TH) {
        /* Exactly at threshold the scaling form is flat: p_L is A for every
           d. Saying "more qubits make it worse" here would be false, and
           1.0% is a position the slider can actually stop on. */
        vVer.className = 'verdict split';
        vVer.textContent = 'Exactly at threshold. More qubits change nothing — the code treads water.';
      } else {
        vVer.className = 'verdict bad';
        vVer.textContent = 'Above threshold. More qubits make it worse, not better.';
      }

      /* The closed instrument keeps talking: the orb carries the lifetime
         while the setting is below threshold, and the verdict itself when it
         is not, since a lifetime that SHRINKS with more qubits would be read
         as good news. Same colour law as the banner: mint / lavender / red. */
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

  /* ======================================================================
     1b. THE FLOAT  (2026-09-23)
     ----------------------------------------------------------------------
     The instrument is a native popover the orb opens (index.html). The
     browser already does the toggling, so this adds only what needs a
     script, and the page loses nothing but polish if it never runs:

       - PLACEMENT. Before the panel shows, it is moved to where the orb is:
         top edge on the orb's top edge, on the orb's side of the screen,
         clamped under the sticky header and inside the viewport, with its
         transform-origin on the orb's centre so the CSS arrival (home.css
         2b) grows it OUT of the orb rather than out of nowhere. Done in
         `beforetoggle`, i.e. before the first frame, so it never paints at
         the fallback position and then jumps.
       - DRAG, by the header, on a fine pointer. Once dragged it stays where
         the reader put it for the rest of the visit.
       - SWIPE DOWN to dismiss the phone sheet.
       - ESC from inside it (the sliders are inputs, so section 5's
         document handler, which ignores keys typed into inputs, never sees
         that Escape), with focus returned to the orb.
     ==================================================================== */
  var FLOAT = null;
  var HEADER_CLEAR = 84;    /* the sticky header's ~70px, plus air */
  var EDGE = 12;            /* nearest the panel gets to any screen edge */

  function bindFloat() {
    var box = $('#hero-inst'), orb = $('#inst-orb');
    if (!box || !orb || typeof box.showPopover !== 'function') return;

    var dragged = false;

    function isOpen() {
      try { return box.matches(':popover-open'); } catch (e) { return false; }
    }
    function sheet() { return W.innerWidth < 720; }

    function put(left, top) {
      var w = box.offsetWidth || 304;
      var h = box.offsetHeight || 0;
      left = Math.max(EDGE, Math.min(left, W.innerWidth - w - EDGE));
      /* A panel taller than the room left below the header scrolls inside
         itself (max-height in home.css), so only the top is clamped hard. */
      var maxTop = h ? W.innerHeight - h - EDGE : top;
      top = Math.max(HEADER_CLEAR, Math.min(top, maxTop));
      box.style.left = Math.round(left) + 'px';
      box.style.right = 'auto';
      box.style.setProperty('--inst-top', Math.round(top) + 'px');
    }

    /* The panel is still display:none when `beforetoggle` fires, so its
       height is measured by laying it out once, invisibly, at the width it
       will open at. An estimate was tried first and was 50px short: the
       panel opened with its last line cut off into an inner scrollbar on a
       screen with room to spare. The 8px covers the grip bar, which only
       exists in the open state. */
    function naturalHeight(w) {
      var s = box.style;
      var keep = [s.display, s.visibility, s.position, s.width, s.maxHeight, s.transition];
      /* transition off for the round trip: home.css transitions `display`
         (allow-discrete) for the exit, and without this the block -> none
         restore would itself start a 420ms exit, in the flow. */
      s.transition = 'none';
      s.display = 'block'; s.visibility = 'hidden'; s.position = 'fixed';
      s.width = w + 'px'; s.maxHeight = 'none';
      var h = box.offsetHeight + 8;
      s.display = keep[0]; s.visibility = keep[1]; s.position = keep[2];
      s.width = keep[3]; s.maxHeight = keep[4];
      void box.offsetHeight;            /* commit the restore with no transition */
      s.transition = keep[5];
      return h || 480;
    }

    function place() {
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
      var w = 304;
      var right = (r.left + r.width / 2) > W.innerWidth / 2;
      var left = right ? r.right - w : r.left;
      var h = naturalHeight(w);
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

    /* -- drag (card) and swipe-down (sheet), one pointer path -- */
    /* The handle is the header row and the grip bar above it. Listening on
       the panel and filtering by target covers both without two bindings. */
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
      var dy = 0;
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
      box.setAttribute('data-drag', '');
      e.preventDefault();

      function move(ev) {
        if (asSheet) {
          dy = Math.max(0, ev.clientY - sy);
          box.style.transform = 'translateY(' + dy + 'px)';
        } else {
          put(l0 + ev.clientX - sx, t0 + ev.clientY - sy);
        }
      }
      function up() {
        box.removeEventListener('pointermove', move);
        box.removeEventListener('pointerup', up);
        box.removeEventListener('pointercancel', up);
        box.removeAttribute('data-drag');
        if (asSheet) {
          box.style.transform = '';
          if (dy > 70) close();
        } else {
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

  /* ======================================================================
     2. THE PARALLAX
     ----------------------------------------------------------------------
     One rAF-batched write of --px / --py (each -1..1) on <html>; home.css
     section 3 does the rest.  Fine pointers only -- a touch drag is not a
     hover and must not shove the cards around under the finger.
     ==================================================================== */
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

  /* ======================================================================
     3 + 4. THE STATIONS AND THE COMPANION
     ----------------------------------------------------------------------
     Twelve [data-station] sections; a -38% / -38% root margin means a
     station counts as reached only when it is genuinely the thing in the
     middle of the screen, not when one pixel of it clips the bottom edge.

     Three consequences, all of them replies to something the reader did:
       - the ring fills;
       - past three stations the router's lede stops asking a stranger's
         question and starts offering to resume;
       - reaching games / OR / security stamps the matching router door,
         because the door is the page's memory of where you have been.

     WHY IT SUPERSEDES .sq-marker.  alive.css already owns bottom-left with a
     section index. Two fixed panels in one corner is not a design, so on
     this page the companion replaces it: home.css hides .sq-marker, and
     section 5 intercepts `m` before alive.js can toggle a hidden panel (an
     open-but-invisible marker would silently swallow j / k, which alive.js
     guards behind MARKER.isOpen()).
     ==================================================================== */
  var RING_R = 20;
  var RING_C = 2 * Math.PI * RING_R;

  function ringSVG(cls) {
    return '<svg class="sqco-ring ' + (cls || '') + '" viewBox="0 0 48 48" aria-hidden="true">'
      + '<circle class="rg-track" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"/>'
      + '<circle class="rg-fill" cx="24" cy="24" r="' + RING_R + '" fill="none" stroke-width="3"'
      + ' stroke-dasharray="0 ' + RING_C.toFixed(2) + '" transform="rotate(-90 24 24)"/>'
      + '<text class="rg-num" x="24" y="28" text-anchor="middle">0</text></svg>';
  }

  /* The reading name of each station, for the "you are here" line and the
     door stamps. Authored, not derived from a heading, because four of the
     twelve have no heading of their own. */
  var STATION_NAME = {
    hero: 'The argument',
    threshold: 'The threshold instrument',
    spine: 'The short version',
    router: 'Three doors',
    question: 'The Question',
    loop: 'The loop',
    games: 'Nine games',
    depth: 'Three depths',
    or: 'Operations research',
    pqc: 'Post-quantum security',
    timing: 'Why the timing matters',
    join: 'Join the loop'
  };
  /* station -> the router door it belongs to, and how the stamp reads */
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
      /* Never overwrite a real saved-progress line with a weaker one: the
         inline hub script in index.html reads localStorage and marks a door
         .resume when it has something true to say. This only fills doors
         that had nothing. */
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
      /* Past three stations the reader is no longer a stranger being asked
         which of three things they came for. */
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

      /* The companion must never occlude the hero instrument. Rather than
         trust a margin at some assumed viewport, watch the instrument
         itself: while any part of it is on screen the companion is not.
         That is a guarantee at every width and every zoom level, not an
         estimate.

         Since 2026-09-23 the instrument has two bodies: the orb in the
         hero, and the floating panel it opens, which can be carried (or
         dragged) anywhere on screen. So the companion stands down while the
         orb is in view OR the panel is open -- the open panel is by
         definition on screen, and at phone widths it is a sheet across the
         very corner the companion lives in. */
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
      /* No observer: no ring, but also no half-built furniture. */
      co.show(false);
    }
    paint();
  }

  /* ======================================================================
     5. THE KEYS
     ----------------------------------------------------------------------
     WHO OWNS WHICH KEY, and why this handler is on the CAPTURE phase.

     Three other listeners are already on this document by the time this one
     binds: nav.js (Escape closes the menus), alive.js (? j k n p m, bubble
     phase, and it honours e.defaultPrevented), and qubit.js (X Y Z H S T M R,
     bubble phase, and it does NOT check defaultPrevented -- deliberately, it
     is an easter egg that should be hard to disable by accident).

     So:
       - preventDefault is enough to stand alive.js down.
       - h inside the `g` window needs stopPropagation too, or the jump would
         also apply a Hadamard to the page-state qubit.
       - Escape only stops propagating when this file actually closed
         something; otherwise nav.js still needs it to shut the menus.
       - m is intercepted (preventDefault only) so alive.js cannot toggle the
         .sq-marker home.css hides -- an open-but-invisible marker swallows
         j / k. qubit.js still measures on m, exactly as on every other page.
       - h, p, j, k outside the `g` window are left entirely alone.

     THE HEADER OFFSET is 78px: the sticky header measures ~68-70px at the
     widths where it is sticky at all, and the remainder is the breathing
     room style.css's own scroll-padding-top adds.
     ==================================================================== */
  var JUMP_OFF = 78;
  var FLARE_MS = 1300;

  function flare(el) {
    if (!el || reduce || !el.animate) return;
    var t = rgbOf('--teal', [45, 212, 191]);
    try {
      /* Light only, no movement: alive.css's arrival rule. The target is
         already where it belongs, so nothing about it should move. */
      el.animate([
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.55), backgroundColor: rgba(t, 0.09), offset: 0.14 },
        { boxShadow: '0 0 0 1px ' + rgba(t, 0.30), backgroundColor: rgba(t, 0.05), offset: 0.55 },
        { boxShadow: '0 0 0 0 ' + rgba(t, 0), backgroundColor: rgba(t, 0) }
      ], { duration: FLARE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    } catch (e) {}
  }

  /* Where the element WILL be, not where it is being drawn.
     style.css's .reveal carries transform: translateY(14px) until nav.js
     reveals it, and .reveal.in > * runs fadeUp from another translateY(10px)
     on top of that. Both are transforms, so they move the rendered box
     without moving the layout -- and getBoundingClientRect() reports the
     rendered box. Reading it mid-reveal lands a jump up to ~27px off, and
     the target then slides out from under the landing.

     offsetTop is layout, not paint: it ignores every transform in the
     chain, so this is the settled position whether or not the target has
     been revealed yet. Measured 2026-09-05 on the games section (105px
     instead of 78px) and on #tier-g (74px). */
  function layoutTop(el) {
    var y = 0, n = el;
    while (n) { y += n.offsetTop; n = n.offsetParent; }
    return y;
  }

  /* An instant scroll, whatever the CSS says. html carries
     scroll-behavior: smooth site-wide, and behavior:'auto' defers to it, so
     the only portable way to move without animating is to switch the CSS off
     for the one call. ('instant' works in current browsers but not in the
     Safari versions this site still renders correctly in.) */
  function snapTo(y) {
    var de = D.documentElement, prev = de.style.scrollBehavior;
    de.style.scrollBehavior = 'auto';
    W.scrollTo(0, y);
    de.style.scrollBehavior = prev;
  }

  /* Land, then check you actually landed.

     The target can move AFTER the scroll has committed to a number. Measured
     2026-09-05: pressing g p scrolled to 2214, and while the smooth scroll
     was still running The Question finished its three-step fetch chain
     (today.json -> qbank.json -> the question file) and grew the page 27px
     ABOVE the games section, leaving the landing 27px short. nav.js already
     records the same class of problem for hash links ("one rAF lands
     short").

     So: wait for the scroll to stop moving, re-measure, and nudge instantly
     if it is off. Capped at three corrections and ~3s so a page that never
     settles cannot leave a timer running. The nudge is instant rather than
     smooth because it is a correction of a few pixels, not a journey. */
  var LAND = 0;      /* the jump a correction belongs to; a newer jump wins */
  function landOn(el) {
    var mine = ++LAND;
    var lastY = null, stillFor = 0, tries = 0, ticks = 0;
    (function tick() {
      /* A second jump while this one is still settling must not be dragged
         back by the first one's correction -- press g p then g h quickly
         and the top would snap back to the games section a second later. */
      if (mine !== LAND) return;
      if (++ticks > 60) return;                       /* ~3s ceiling */
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
    LAND++;                       /* cancel any correction still in flight */
    W.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    var h = $('.wrap h1');
    if (h) flare(h);
  }

  /* -- the keymap overlay ------------------------------------------------ */
  var _keymap = null;
  function KEYMAP() {
    if (_keymap) return _keymap;
    var hasQubit = !!(W.SymbiQ && W.SymbiQ.qubit);
    var rows = [
      ['<kbd>g</kbd><kbd>h</kbd>', 'Back to the top'],
      ['<kbd>g</kbd><kbd>p</kbd>', 'The games section'],
      ['<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>', 'The three depths: plain, working, formal'],
      ['<kbd>j</kbd><kbd>k</kbd>', 'Next / previous section'],
      ['<kbd>m</kbd>', 'Open or close the corner companion'],
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

  /* One open/close/focus implementation for both overlays. */
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

  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT';
  }

  /* -- the nav's discoverability button ----------------------------------
     Injected rather than written into the markup: check_site.py requires all
     24 <nav> blocks to be byte-identical, and this control belongs to one
     page.

     THE WIDTH BUDGET IS MEASURED, EVERY TIME. The 2026-08-28 note said a
     40px nav control fits; measured again 2026-09-05 it does not -- at the
     880px .wrap tier the row carries 832px in 840px, so eight pixels of
     slack, and ANY fifth item costs a whole 62px row (81px -> 143px). Below
     1024px the nav is already two rows, so the button is free; at 1440px and
     up the row has ~168px spare, so it is free again.

     Rather than hard-code that band -- which would be wrong the next time
     the nav gains or loses a link -- this inserts the button, measures the
     nav, and takes it straight back out if the height moved. A control that
     silently costs 62px of header is exactly the bug that note was written
     about, and this is the probe it recommends, run for real instead of
     remembered. Re-run on resize, so crossing 1440px gains it.

     Where it cannot go in the nav, the keymap is still one keystroke away
     (?) and one click away in the corner companion.                       */
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

    /* Measure BOTH heights every time, always taking the button out first --
       otherwise the "before" reading already includes it and the comparison
       is meaningless. Both reads happen inside one task, so the browser
       never paints the intermediate two-row state. */
    function measure() {
      if (NAVBTN.parentNode) NAVBTN.remove();
      var without = nav.getBoundingClientRect().height;
      insert();
      if (nav.getBoundingClientRect().height > without + 1) NAVBTN.remove();
    }

    measure();
    /* Re-measure after the nav has finished assembling itself. auth.js
       un-hides the 40px account disclosure AFTER this script runs, which at
       the 880px .wrap tier is exactly the 40px that turns "fits" into "costs
       a whole row" -- the first measurement said yes and was then quietly
       wrong. Same spaced-sweep shape alive.js uses for late-mounting widgets. */
    [400, 1200, 3000].forEach(function (t) { W.setTimeout(measure, t); });

    var rt;
    W.addEventListener('resize', function () {
      W.clearTimeout(rt);
      rt = W.setTimeout(measure, 200);
    }, { passive: true });
  }

  function bindKeys() {
    var gAt = 0;                 /* when `g` was pressed; 900ms window */
    var G_WINDOW = 900;
    var buf = '';                /* rolling four-character buffer, section 6 */

    D.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (editable(e.target) || editable(D.activeElement)) return;

      var k = e.key;

      /* Escape first: it closes, and only claims the event when it did. */
      if (k === 'Escape') {
        var closed = false;
        if (_keymap && _keymap.isOpen()) closed = _keymap.close() || closed;
        if (_primes && _primes.isOpen()) closed = _primes.close() || closed;
        if (COMPANION && COMPANION.isOpen()) { COMPANION.toggle(false); closed = true; }
        /* The floating instrument, when focus has wandered out of it (its
           own handler covers Escape typed inside it). One Escape, one
           thing closed: it goes only if nothing above did. */
        if (!closed && FLOAT && FLOAT.isOpen()) closed = FLOAT.close();
        if (closed) { e.preventDefault(); e.stopPropagation(); }
        return;   /* not closed by us: nav.js still needs it for the menus */
      }

      /* The rolling buffer. Kept before the jumps so a deliberate 2-3-5-7
         still lands even though 2 and 3 are also jumps. */
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

      /* g, then h or p, inside a 900ms window. */
      var now = Date.now();
      if (k === 'g') { gAt = now; e.preventDefault(); return; }
      if (gAt && now - gAt < G_WINDOW && (k === 'h' || k === 'p')) {
        gAt = 0;
        e.preventDefault();
        /* qubit.js does not check defaultPrevented, so h would ALSO apply a
           Hadamard without this. */
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

      /* m: claim it from alive.js (which honours defaultPrevented) so it can
         never toggle the .sq-marker home.css hides. Deliberately NOT
         stopPropagation: qubit.js's measure still runs on m here exactly as
         it does on the other 23 pages. */
      if (k === 'm' && COMPANION) {
        e.preventDefault();
        COMPANION.toggle();
        return;
      }
    }, true);
  }

  /* ======================================================================
     6. THE GESTURE
     ----------------------------------------------------------------------
     HIDDEN, and undocumented on purpose -- the keymap says only that there
     is one and that it is four primes. Nothing in the page body mentions it.

     Order-finding is the whole quantum content of Shor's algorithm, and it
     is the reason the numbers in the Bitcoin figure further down this page
     moved by 3,800x in four years: a cheaper way to run ONE subroutine
     re-costs the entire attack. So the panel does the arithmetic by hand,
     small enough to check, with N = 15 and a = 7.

     Every number below is verified by hand and by tools/verify_home_threshold.py:
       7^1 = 7,   7 mod 15 = 7
       7^2 = 49,  49 mod 15 = 4
       7^3 = 343, 343 mod 15 = 13
       7^4 = 2401, 2401 mod 15 = 1     -> the period r = 4, and it is even
       7^(r/2) = 7^2 = 49
       gcd(49 - 1, 15) = gcd(48, 15) = 3
       gcd(49 + 1, 15) = gcd(50, 15) = 5      and 3 x 5 = 15.
     ==================================================================== */
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

  /* ======================================================================
     7. THE FIELD
     ----------------------------------------------------------------------
     Replaces atmosphere.js's lattice on this page (index.html does not load
     that file at all any more), for one reason: the homepage argues that
     coupling many identical circuits is what turns a qubit story into an
     optimisation machine, and this version makes the coupling something you
     can put your hand into. The pointer is a weak ATTRACTOR, not a repeller
     -- nodes gather toward it and their bonds warm from lavender to mint as
     they arrive, which is the Colour Law running on the background.

     Still not a video. No network request, no photographic byte, and it
     re-themes from --violet / --teal like everything else.

     THE ALPHA BUDGET is the whole constraint. Text sits over this canvas, so
     the field has to be readable as texture and invisible as contrast: link
     alpha peaks at 0.25 and only where the cursor is, node alpha at rest is
     a fifth of that, and the glow is a shadowBlur that scales with proximity
     so a resting field throws none at all.

     HIDDEN, item 2 of 2 (the other is qubit.js): clicking a node injects an
     excitation that propagates outward along the couplings at finite speed,
     losing amplitude at every hop -- a discrete wave on a weighted graph.
     Carried over from atmosphere.js so this page does not quietly lose a
     site secret when it stops loading that file.
     ==================================================================== */
  var LINK = 150;         /* px: coupling range */
  var CURSOR = 210;       /* px: how far the pointer's pull reaches */
  /* The one number that makes the field louder or quieter. Everything below
     scales off it, and tools/verify_home_ux.mjs measures the CONSEQUENCE --
     the contrast body text actually renders at with the field composited
     behind it -- rather than trusting a constant. Raise it and the checker
     tells you when the prose starts paying for it. */
  var GAIN = 1.45;
  /* THE CURSOR RESPONSE, raised 2026-09-05. Chinmoy: the field followed the
     pointer more sluggishly than atmosphere.js's lattice does on the other
     23 pages. Steady-state speed under a constant pull is roughly
     PULL / (1 - DAMP), so both numbers matter and only raising PULL would
     have made it lunge and then crawl. Lifting the ceiling too keeps the
     gather quick without turning it into a swarm -- verify_home_ux.mjs
     measures the mean speed of the nodes actually inside the cursor radius
     and fails at both ends of the band. */
  var PULL = 0.105;       /* peak acceleration toward the cursor, per frame */
  var DAMP = 0.984;       /* velocity retained per frame */
  var VMAX = 2.6;         /* px/frame speed clamp */
  var VMIN = 0.05;        /* below this, re-inject jitter so it cannot clump */
  var WAVE = 0.42;        /* px per ms: excitation propagation speed */
  var HOP_LOSS = 0.72;    /* amplitude retained per hop */
  var MIN_AMP = 0.06;
  var MAX_EVENTS = 400;

  var cvs, ctx, w = 0, h = 0, dpr = 1;
  var nodes = [], raf = 0, running = false;
  var ptr = { x: -9999, y: -9999, live: false };
  var coherence = 0;
  var VIO = [167, 139, 250], TEA = [45, 212, 191];

  function readColours() {
    VIO = rgbOf('--violet', VIO);
    TEA = rgbOf('--teal', TEA);
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* AN EARLIER VERSION DIMMED THE FIELD BEHIND .wrap and ran it at full
     strength in the gutters. That was written when .wrap capped at 1040px
     and the gutters were hundreds of pixels wide. Widening the column (see
     home.css section 0) left 50px of gutter at 1280px -- less than the
     feather -- so the "quiet band" covered essentially the whole screen and
     the field came out DIMMER than before, which is the opposite of the
     brief. Measured, then deleted.

     The field is now uniformly bright, and readability is protected by the
     thing that actually matters: the contrast body text renders at with the
     field composited underneath it. verify_home_ux.mjs computes that number
     from the real pixels and fails under 7:1 -- comfortably inside the 4.5:1
     the Contrast Lock demands, with the margin left as headroom for GAIN. */

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
    /* Density by area, so a phone gets a sparse field and a 4K monitor a
       full one at the same visual weight. */
    var n = Math.max(44, Math.min(150, Math.round((w * h) / 12000)));
    nodes = [];
    for (var i = 0; i < n; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.15 + Math.random() * 1.65,
        ph: Math.random() * Math.PI * 2,          /* twinkle phase */
        sp: 0.6 + Math.random() * 0.8,            /* twinkle rate */
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
    var f = dt / 16.67;                 /* normalise the per-frame constants */
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      n.heat = 0;
      if (ptr.live) {
        var dx = ptr.x - n.x, dy = ptr.y - n.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < CURSOR && d > 0.5) {
          var prox = 1 - d / CURSOR;
          n.heat = prox;
          var a = prox * PULL * f;
          n.vx += (dx / d) * a;
          n.vy += (dy / d) * a;
        }
      }

      n.vx *= Math.pow(DAMP, f);
      n.vy *= Math.pow(DAMP, f);

      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (sp > VMAX) { n.vx = n.vx / sp * VMAX; n.vy = n.vy / sp * VMAX; }
      /* Below VMIN the gather would settle into a permanent clump around
         wherever the cursor last was. A little jitter keeps it a field. */
      if (sp < VMIN) { n.vx += (Math.random() - 0.5) * 0.05; n.vy += (Math.random() - 0.5) * 0.05; }

      n.x += n.vx * f;
      n.y += n.vy * f;

      /* Wrap rather than bounce: a bounce reads as a wall, and the field is
         meant to continue past the viewport. */
      if (n.x < -24) n.x = w + 24; else if (n.x > w + 24) n.x = -24;
      if (n.y < -24) n.y = h + 24; else if (n.y > h + 24) n.y = -24;

      n.amp *= Math.pow(0.9975, dt);
      if (n.amp < 0.004) n.amp = 0;
    }
  }

  function drawField(t) {
    ctx.clearRect(0, 0, w, h);

    /* Couplings first, so a node sits on top of its own bonds. */
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
        /* Lavender out in the cold, mint where your hand is. */
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
      /* The glow lives only inside the field: no shadow at rest, so a
         resting canvas costs nothing and shows nothing. */
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
  }

  var lastT = 0;
  function frame(t) {
    if (!running) return;
    var dt = lastT ? Math.min(t - lastT, 48) : 16;   /* a backgrounded tab must not teleport */
    lastT = t;
    stepField(dt);
    drawField(t);
    raf = W.requestAnimationFrame(frame);
  }
  function startField() { if (running) return; running = true; lastT = 0; raf = W.requestAnimationFrame(frame); }
  function stopField() { running = false; if (raf) W.cancelAnimationFrame(raf); raf = 0; }

  function buildField() {
    /* Bails out entirely under reduced motion. There is no "one static
       frame" worth drawing here: the whole point of this layer is that it
       answers the pointer, and a still copy of it is just noise over text. */
    if (reduce) return;
    if (!D.body || !D.body.hasAttribute('data-motion')) return;

    cvs = D.createElement('canvas');
    cvs.id = 'sq-field';
    cvs.setAttribute('aria-hidden', 'true');
    D.body.appendChild(cvs);
    ctx = cvs.getContext('2d');
    if (!ctx) { cvs.remove(); cvs = null; return; }

    readColours();
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
    W.addEventListener('pointerleave', function () { ptr.live = false; });
    W.addEventListener('blur', function () { ptr.live = false; });

    /* Listens on window, because the canvas is pointer-events:none and must
       never eat a click meant for a link. Only a click that lands ON a node
       does anything at all, so it is found by aiming, not by flailing. */
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

  /* THE SHEEN, carried over from atmosphere.js. motion.css section 4 reads
     --mo-x / --mo-y off a hovered card; dropping atmosphere.js from this page
     would otherwise have quietly removed the pointer-tracked light source
     from every card on it. One style write per frame. */
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

  /* qubit.js drives this with |2 alpha beta*|, the off-diagonal coherence of
     the density matrix -- the quantity that survives only while the page is
     unmeasured. Same public surface atmosphere.js published, so the easter
     egg's shimmer channel still exists on this page. */
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

  /* ====================================================================== */
  function boot() {
    try { buildInstrument(); } catch (e) {}
    try { bindFloat(); } catch (e) {}
    try { bindParallax(); } catch (e) {}
    try { bindStations(); } catch (e) {}
    try { buildNavButton(); } catch (e) {}
    try { bindKeys(); } catch (e) {}
    try { buildField(); } catch (e) {}
    try { bindSheen(); } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
;
/* --- doormorph.js --- */
/* SymbiQ, doormorph.js
 * ============================================================================
 * CARD -> PAGE MORPH (2026-09-23), item 1 of the researched top-10. OUTGOING
 * half only -- index.html's three router doors. The INCOMING half (reading
 * the handoff and naming the destination's h1) lives in journey.html /
 * feasible.html / pqc.html's own <head>, not here, and not by choice: see
 * that inline script's own comment for why a deferred file can't do it.
 *
 * The site already runs a cross-document view transition on every navigation
 * (motion.css section 2): the brand and the h1 carry view-transition-name so
 * they glide rather than flash between any two of the 24 pages. This adds
 * ONE specific case on top of that generic continuity: when a reader clicks
 * one of the three router doors on the home page, the CARD THEY CLICKED
 * grows into the destination page's headline, instead of the headline doing
 * its usual generic fade-in.
 *
 * HOW. view-transition-name is normally a static CSS property, but the two
 * documents involved in one click are different pages that never share a
 * stylesheet moment -- so the name has to be assigned dynamically, once, for
 * this one navigation only, on both sides. On a plain click of a tracked
 * door, this file writes view-transition-name directly onto the clicked
 * card and drops a short-lived flag in sessionStorage naming which door was
 * used; the destination reads it back.
 *
 * SAFE BY CONSTRUCTION. Every entry point is try/catched; nothing here calls
 * preventDefault, so the door still navigates normally in a browser that
 * ignores all of this (Firefox, at the time of writing, has neither
 * cross-document view transitions nor `pagereveal`). The sessionStorage flag
 * carries its own timestamp and is only honoured for 4 seconds and only once
 * (read == cleared), so a click that never becomes a same-tab navigation (a
 * new-tab open, a cancelled press) cannot mis-tag some unrelated later visit
 * to one of the three destination pages.
 * ==========================================================================*/
(function () {
  'use strict';
  var D = document;

  function bindDoors() {
    var doors = [].slice.call(D.querySelectorAll('.introute-card[data-track]'));
    if (!doors.length) return;
    doors.forEach(function (card) {
      card.addEventListener('click', function (e) {
        /* A modified click opens a new tab (or does nothing) -- this
           document never unloads, so nothing here should run. */
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var track = card.getAttribute('data-track');
        if (!track) return;
        try { sessionStorage.setItem('sq-vt-door', track + ':' + Date.now()); } catch (er) {}
        try { card.style.viewTransitionName = 'sq-door-' + track; } catch (er2) {}
      });
    });
  }

  try { bindDoors(); } catch (e) {}
})();
;
