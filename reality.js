/* SymbiQ, Reality Check: a swipe deck of "how much physics was in that scene?" cards.
 *
 *   Cards live in data/reality.json. This file only renders them.
 *
 * The deck is a native horizontal scroll-snap track, so touch swiping, trackpad
 * scrolling and keyboard scrolling work with no script at all. Everything below is
 * enhancement: Prev/Next buttons, the counter, kind filters, #slug deep links, a
 * share button, and `inert` on the slides you are not looking at (so Tab does not
 * wander into an off-screen slide and yank the track sideways).
 *
 * Every string from the data file goes through esc(). Links are built from the
 * data too, but only same-site paths and https:// URLs are accepted.
 */
(function () {
  'use strict';
  var core = window.SymbiQ && window.SymbiQ.core;
  var esc = core.esc;
  var host = document.getElementById('rc-app');
  if (!host) return;

  var RATING = {
    name:      { n: 1, label: 'Name only',  meaning: 'The word is real. The physics in the scene is not.' },
    seed:      { n: 2, label: 'Real seed',  meaning: 'One true idea sits underneath. Everything built on it is invented.' },
    stretched: { n: 3, label: 'Stretched',  meaning: 'The mechanism is real, and the scene pushes it past what it does.' },
    faithful:  { n: 4, label: 'Faithful',   meaning: 'A working physicist would nod.' }
  };
  var UNRATED = { n: 0, label: 'Unrated', meaning: 'It has not aired, so there is nothing to rate yet.' };

  function safeHref(h) {
    h = String(h || '');
    if (/^https:\/\//i.test(h)) return h;
    if (/^[a-z0-9_-]+\.html(#[\w-]+)?$/i.test(h)) return h;
    return '#';
  }
  function link(l, ext) {
    return '<a href="' + esc(safeHref(l.h)) + '"' + (ext ? ' rel="noopener noreferrer"' : '') + '>' + esc(l.t) + '</a>';
  }

  function meter(key) {
    var r = RATING[key] || UNRATED, segs = '';
    for (var i = 1; i <= 4; i++) segs += '<i' + (i <= r.n ? ' class="on"' : '') + '></i>';
    return '<div class="rc-meter" data-r="' + esc(key || 'none') + '">' +
      '<span class="rc-bar" aria-hidden="true">' + segs + '</span>' +
      '<span class="rc-rlabel"><b>' + esc(r.label) + '</b><span class="rc-rmean">' + esc(r.meaning) + '</span></span>' +
      '<span class="sr-only-rc">Rating ' + (r.n ? r.n + ' of 4: ' : '') + esc(r.label) + '</span></div>';
  }

  /* A card's picture. Real photos carry their credit and licence in the caption (CC BY needs
     that next to the image, not on a credits page). An AI-generated picture is marked with a
     small badge on the image itself and says so in the caption. Width/height come from the data
     so the slide does not jump when the file arrives. */
  function figure(im) {
    if (!im || !/^img\/[\w\/.-]+$/.test(im.src || '')) return '';
    var credit = im.ai
      ? 'AI-generated illustration' + (im.tool ? ' (' + esc(im.tool) + ')' : '') + '. Not a photograph.'
      : esc(im.credit || '') + (im.license
          ? ' &middot; ' + (im.license_url ? '<a href="' + esc(safeHref(im.license_url)) + '" rel="noopener noreferrer">' + esc(im.license) + '</a>' : esc(im.license))
          : '') + (im.source_url ? ' &middot; <a href="' + esc(safeHref(im.source_url)) + '" rel="noopener noreferrer">source</a>' : '');
    return '<figure class="rc-fig' + (im.ai ? ' rc-ai' : '') + '">' +
      '<div class="rc-img' + (/\.svg$/i.test(im.src) ? ' rc-light' : '') + '"><img src="' + esc(im.src) + '" alt="' + esc(im.alt || '') + '"' +
        (im.w && im.h ? ' width="' + (+im.w) + '" height="' + (+im.h) + '"' : '') +
        ' loading="lazy" decoding="async">' +
        (im.ai ? '<span class="rc-aibadge">AI-generated</span>' : '') + '</div>' +
      '<figcaption>' + (im.caption ? esc(im.caption) + ' ' : '') + '<span class="rc-credit">' + credit + '</span></figcaption></figure>';
  }

  function slide(c, i, n) {
    var blocked = (c.blocked || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('');
    return '<article class="rc-slide" id="' + esc(c.slug) + '" data-slug="' + esc(c.slug) + '" data-kind="' + esc(c.kind) + '"' +
        ' role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '">' +
      '<p class="rc-top"><span class="rc-kind" data-k="' + esc(c.kind) + '">' + esc(c.kind) + '</span>' +
        '<span class="rc-src">' + esc(c.source) + '</span></p>' +
      '<h2 class="rc-title" aria-level="2">' + esc(c.title) + '</h2>' +
      figure(c.image) +
      meter(c.rating) +
      '<div class="rc-sec"><p class="rc-h">The story says</p><p class="rc-says">' + esc(c.says) + '</p></div>' +
      '<div class="rc-sec"><p class="rc-h">What is real</p><p>' + esc(c.real) + '</p></div>' +
      '<div class="rc-sec"><p class="rc-h">What stands in the way</p><ul>' + blocked + '</ul></div>' +
      '<div class="rc-sec rc-what"><p class="rc-h">What if <span class="rc-spec">speculation, not established</span></p><p>' + esc(c.whatif) + '</p></div>' +
      '<div class="rc-foot">' +
        (c.learn && c.learn.length ? '<p class="rc-learn"><span>On this site</span> ' + c.learn.map(function (l) { return link(l, false); }).join(' · ') + '</p>' : '') +
        (c.refs && c.refs.length ? '<p class="rc-refs"><span>Sources</span> ' + c.refs.map(function (l) { return link(l, true); }).join(' · ') + '</p>' : '') +
        '<p class="rc-act"><button type="button" class="preset rc-share" data-slug="' + esc(c.slug) + '">Copy link to this card</button>' +
        '<span class="rc-shared" role="status" aria-live="polite"></span></p>' +
      '</div></article>';
  }

  function build(data) {
    var cards = (data && data.cards) || [];
    if (!cards.length) { host.innerHTML = '<p class="rc-loading">No cards yet.</p>'; return; }

    var kinds = [];
    cards.forEach(function (c) { if (kinds.indexOf(c.kind) < 0) kinds.push(c.kind); });

    host.innerHTML =
      '<div class="rc-filters" role="group" aria-label="Filter cards by kind">' +
        '<button type="button" class="preset rc-chip" data-k="all" aria-pressed="true">All <span>' + cards.length + '</span></button>' +
        kinds.map(function (k) {
          var n = cards.filter(function (c) { return c.kind === k; }).length;
          return '<button type="button" class="preset rc-chip" data-k="' + esc(k) + '" aria-pressed="false">' + esc(k) + ' <span>' + n + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="rc-deck" role="region" aria-roledescription="carousel" aria-label="Reality Check cards">' +
        '<div class="rc-track" id="rc-track" tabindex="0" aria-label="Cards. Swipe, or use the arrow keys.">' +
          cards.map(function (c, i) { return slide(c, i, cards.length); }).join('') +
        '</div>' +
        '<div class="rc-nav">' +
          '<button type="button" class="preset rc-prev" aria-label="Previous card">←</button>' +
          '<span class="rc-count" id="rc-count" role="status" aria-live="polite"></span>' +
          '<button type="button" class="preset rc-next" aria-label="Next card">→</button>' +
        '</div>' +
      '</div>' +
      '<details class="rc-all"><summary>All ' + cards.length + ' cards in one list</summary><ol id="rc-list">' +
        cards.map(function (c) {
          return '<li><a href="#' + esc(c.slug) + '" data-slug="' + esc(c.slug) + '">' + esc(c.title) + '</a> <span class="rc-kind" data-k="' + esc(c.kind) + '">' + esc(c.kind) + '</span></li>';
        }).join('') +
      '</ol></details>';

    wire(cards);
  }

  function wire(cards) {
    var track = document.getElementById('rc-track');
    var count = document.getElementById('rc-count');
    var prev = host.querySelector('.rc-prev'), next = host.querySelector('.rc-next');
    var slides = [].slice.call(track.querySelectorAll('.rc-slide'));
    var cur = 0, filter = 'all';

    function visible() { return slides.filter(function (s) { return !s.hidden; }); }

    function fitHeight() {
      var s = visible()[cur];
      if (s) track.style.height = s.offsetHeight + 'px';
    }

    function setCurrent(i, quiet) {
      var v = visible();
      if (!v.length) return;
      cur = Math.max(0, Math.min(v.length - 1, i));
      slides.forEach(function (s) {
        var on = s === v[cur];
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      v.forEach(function (s, k) { s.setAttribute('aria-label', (k + 1) + ' of ' + v.length); });
      count.textContent = (cur + 1) + ' of ' + v.length;
      prev.disabled = cur === 0;
      next.disabled = cur === v.length - 1;
      fitHeight();
      if (!quiet) {
        var slug = v[cur].dataset.slug;
        try { history.replaceState(null, '', '#' + slug); } catch (e) {}
      }
    }

    function go(i, smooth, quiet) {
      var v = visible();
      if (!v.length) return;
      i = Math.max(0, Math.min(v.length - 1, i));
      var behavior = (smooth && !(core.reduced && core.reduced())) ? 'smooth' : 'auto';
      track.scrollTo({ left: v[i].offsetLeft, behavior: behavior });
      setCurrent(i, quiet);
    }

    // Native swipes move the track without going through go(): find the slide
    // that is centred once scrolling settles.
    var settle;
    track.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var v = visible(), best = 0, d = Infinity;
        v.forEach(function (s, k) {
          var gap = Math.abs(s.offsetLeft - track.scrollLeft);
          if (gap < d) { d = gap; best = k; }
        });
        if (best !== cur) setCurrent(best);
      }, 90);
    }, { passive: true });

    prev.addEventListener('click', function () { go(cur - 1, true); });
    next.addEventListener('click', function () { go(cur + 1, true); });

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { go(cur + 1, true); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { go(cur - 1, true); e.preventDefault(); }
      else if (e.key === 'Home') { go(0, true); e.preventDefault(); }
      else if (e.key === 'End') { go(visible().length - 1, true); e.preventDefault(); }
    });

    host.querySelector('.rc-filters').addEventListener('click', function (e) {
      var b = e.target.closest('.rc-chip');
      if (!b) return;
      filter = b.getAttribute('data-k');
      [].forEach.call(host.querySelectorAll('.rc-chip'), function (c) {
        c.setAttribute('aria-pressed', c === b ? 'true' : 'false');
      });
      slides.forEach(function (s) { s.hidden = !(filter === 'all' || s.dataset.kind === filter); });
      track.scrollLeft = 0;
      setCurrent(0);
    });

    host.addEventListener('click', function (e) {
      var sh = e.target.closest('.rc-share');
      if (sh) {
        var url = location.href.split('#')[0] + '#' + sh.getAttribute('data-slug');
        var say = sh.parentNode.querySelector('.rc-shared');
        var ok = function () { say.textContent = 'Link copied.'; setTimeout(function () { say.textContent = ''; }, 2500); };
        var bad = function () { say.textContent = url; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, bad);
        else bad();
        return;
      }
      var a = e.target.closest('#rc-list a');
      if (a) {
        e.preventDefault();
        openSlug(a.getAttribute('data-slug'));
        track.scrollIntoView({ block: 'start', behavior: (core.reduced && core.reduced()) ? 'auto' : 'smooth' });
      }
    });

    function openSlug(slug, quiet) {
      var target = slides.filter(function (s) { return s.dataset.slug === slug; })[0];
      if (!target) return false;
      if (target.hidden) {          // a filter is hiding it: fall back to All
        host.querySelector('.rc-chip[data-k="all"]').click();
      }
      go(visible().indexOf(target), false, quiet);
      return true;
    }

    window.addEventListener('hashchange', function () {
      var slug = decodeURIComponent((location.hash || '').replace(/^#/, ''));
      if (slug) openSlug(slug, true);
    });
    window.addEventListener('resize', function () { go(cur, false, true); });
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(fitHeight);
      slides.forEach(function (s) { ro.observe(s); });
    }
    slides.forEach(function (s) {
      [].forEach.call(s.querySelectorAll('img'), function (im) { im.addEventListener('load', fitHeight); });
    });

    setCurrent(0, true);
    var want = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (want) openSlug(want, true);
    // fonts and layout settle after first paint; re-measure once
    window.addEventListener('load', function () { fitHeight(); });
  }

  fetch('data/reality.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(build)
    .catch(function (err) {
      host.innerHTML = '<p class="rc-loading">The cards could not be loaded (' + esc(err.message) +
        '). They live at <code>data/reality.json</code>.</p>';
    });
})();
