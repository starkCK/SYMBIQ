/* SymbiQ — depth toggle, check-your-understanding, and onward pathways.
 *
 * Zero dependencies, no build step, GitHub Pages safe.
 *
 * THREE SAFETY RULES, learned the hard way on this site:
 *
 * 1. PROGRESSIVE ENHANCEMENT ONLY. The HTML ships with every tier visible. This
 *    script hides things only AFTER it has successfully built the control that
 *    shows them again. If it throws, dies, or is cached stale, the reader gets
 *    the full page — never a blank one. Same lesson as the `.reveal` rule in
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
  /* A bare anchor like #red or #duel — not one of our key=value pairs. */
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
    var stopped = false;     // past data-tier-stop — everything after is shared
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
        else start = 'all';   // it lives outside the tiers — show everything
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
            ? 'Right — and here is why that is the answer:'
            : 'Not this one. The reasoning matters more than the guess:';
          out.className = 'cyu-out ' + (right ? 'ok' : 'no');
          why.hidden = false;
          bump(right);
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
    catch (e) { /* leave every tier visible — the failure mode must be "shows too much" */ }
    try { buildChecks(); } catch (e) {}
    try { buildCorrFilters(); } catch (e) {}
    try {
      if (!window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
