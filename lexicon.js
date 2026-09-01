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
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

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
      return esc(p.text);
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
