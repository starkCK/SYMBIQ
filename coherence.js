/* SymbiQ, Coherence: the health bar, reimagined into the game's whole thesis.
 *
 *   You SPEND coherence by looking  , measurement has a cost (back-action).
 *   You REGAIN it by understanding  , discovery, insight, learning.
 *
 * So the resource that keeps you alive is the same resource the Static feeds on,
 * and the only way to hold together is to understand. That is Ada's arc, and it
 * is the site's whole argument, made mechanical.
 *
 * Persisted through SymbiQ.save's kv bag, so reset() clears it and a real back
 * end later swaps one load/store pair rather than N.
 *
 * API: window.SymbiQ.coherence
 *      .get()                  -> integer 0..100
 *      .spend(n, reason)       -> new value (floored at 0)
 *      .restore(n, reason)     -> new value (capped at 100)
 *      .level()                -> 'static' | 'low' | 'mid' | 'high'
 *      .mountMeter(el)         -> render a live meter into el (may mount several)
 *      .onchange = fn(value, delta, reason)
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var S = window.SymbiQ.save;
  var KEY = 'coherence.v1';
  var BASE = 55;            // a fractured Solver begins here; understanding lifts it
  var meters = [];          // every mounted meter, kept in sync
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
  function read() {
    if (!S) return BASE;
    var v = S.get(KEY, null);
    return (v === null || isNaN(v)) ? BASE : clamp(v);
  }
  function levelOf(v) { return v < 15 ? 'static' : v < 40 ? 'low' : v < 75 ? 'mid' : 'high'; }

  var C = {
    onchange: null,

    get: function () { return read(); },
    level: function () { return levelOf(read()); },

    // delta > 0 restores, delta < 0 spends; clamped, persisted, then broadcast.
    _apply: function (delta, reason) {
      var before = read(), after = clamp(before + delta), real = after - before;
      if (S) S.set(KEY, after);
      var lv = levelOf(after);
      try { document.documentElement.setAttribute('data-coh', lv); } catch (e) {}
      meters.forEach(function (m) { paint(m, after, real, reason); });
      try { if (typeof this.onchange === 'function') this.onchange(after, real, reason); } catch (e) {}
      return after;
    },
    restore: function (n, reason) { return this._apply(Math.abs(n || 0), reason || ''); },
    spend: function (n, reason) { return this._apply(-Math.abs(n || 0), reason || ''); },

    mountMeter: function (host) {
      if (!host) return;
      host.innerHTML =
        '<div class="coh" data-level="' + levelOf(read()) + '">' +
          '<div class="coh-top"><span class="coh-name">Coherence</span>' +
            '<span class="coh-val">' + read() + '%</span></div>' +
          '<div class="coh-track"><i class="coh-fill"></i><span class="coh-pips"></span></div>' +
          '<div class="coh-note" role="status" aria-live="polite"></div>' +
        '</div>';
      var m = host.querySelector('.coh');
      meters.push(m);
      // set the width without a transition on first paint so it doesn't sweep in
      var fill = m.querySelector('.coh-fill');
      fill.style.transition = 'none';
      fill.style.width = read() + '%';
      // force reflow, then re-enable the transition for subsequent changes
      void fill.offsetWidth;
      fill.style.transition = '';
      try { document.documentElement.setAttribute('data-coh', levelOf(read())); } catch (e) {}
      return m;
    }
  };

  function paint(m, value, delta, reason) {
    if (!m || !m.isConnected) return;
    m.setAttribute('data-level', levelOf(value));
    var fill = m.querySelector('.coh-fill'), val = m.querySelector('.coh-val');
    if (fill) fill.style.width = value + '%';
    if (val) val.textContent = value + '%';
    if (!delta) return;
    // floating delta pip
    var pips = m.querySelector('.coh-pips');
    if (pips) {
      var pip = document.createElement('b');
      pip.className = 'coh-pip ' + (delta > 0 ? 'up' : 'down');
      pip.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
      pips.appendChild(pip);
      var kill = function () { if (pip.parentNode) pip.parentNode.removeChild(pip); };
      if (reduce) setTimeout(kill, 900); else pip.addEventListener('animationend', kill);
    }
    // one-line reason, briefly
    var note = m.querySelector('.coh-note');
    if (note && reason) {
      note.textContent = reason + '  (' + (delta > 0 ? '+' : '−') + Math.abs(delta) + ')';
      note.classList.remove('show'); void note.offsetWidth; note.classList.add('show');
      clearTimeout(note._t);
      note._t = setTimeout(function () { note.classList.remove('show'); }, 3200);
    }
  }

  window.SymbiQ.coherence = C;
})();
