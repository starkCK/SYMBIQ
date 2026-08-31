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
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
