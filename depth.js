/* SymbiQ — depth.js: the reader's remembered light/deep preference.
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
