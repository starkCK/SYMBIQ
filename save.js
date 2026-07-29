/* SymbiQ — The Solver's Path: local progress store.
   Namespaced localStorage, fault-tolerant. Local now; a real account back end
   (Supabase/Firebase) can replace the load/save pair later without touching callers.
   API: window.SymbiQ.save  */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var KEY = 'symbiq.solverpath.v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function store(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  var S = {
    onchange: null,
    data: function () { return load(); },

    getAvatar: function () { return load().avatar || null; },
    setAvatar: function (name) {
      var d = load();
      d.avatar = String(name || '').slice(0, 24);
      d.started = d.started || Date.now();
      store(d); this._fire();
    },

    isComplete: function (id) {
      var d = load();
      return !!(d.missions && d.missions[id] && d.missions[id].complete);
    },
    getMission: function (id) {
      var d = load();
      return (d.missions && d.missions[id]) || {};
    },
    setMissionMeta: function (id, meta) {
      var d = load(); d.missions = d.missions || {};
      d.missions[id] = Object.assign({}, d.missions[id], meta || {});
      store(d); this._fire();
    },
    completeMission: function (id, meta) {
      var d = load(); d.missions = d.missions || {};
      var already = d.missions[id] && d.missions[id].complete;
      d.missions[id] = Object.assign({}, d.missions[id], meta || {}, { complete: true, at: (d.missions[id] && d.missions[id].at) || Date.now() });
      store(d); this._fire();
      return !already; // true the first time
    },
    completedCount: function () {
      var m = load().missions || {}, n = 0;
      for (var k in m) if (m[k] && m[k].complete) n++;
      return n;
    },

    unlockCodex: function (key) {
      var d = load(); d.codex = d.codex || {};
      if (!d.codex[key]) { d.codex[key] = Date.now(); store(d); this._fire(); }
    },
    codex: function () { return load().codex || {}; },

    // Generic key-value bag, cleared by reset() with everything else. Coherence,
    // abilities and the Discovery Track all persist through here so a real back
    // end later swaps one load/store pair, not N. Values must be JSON-safe.
    get: function (key, dflt) {
      var kv = load().kv || {};
      return Object.prototype.hasOwnProperty.call(kv, key) ? kv[key] : dflt;
    },
    set: function (key, value) {
      var d = load(); d.kv = d.kv || {};
      d.kv[key] = value; store(d); this._fire();
    },

    /* ---- PORTABLE SAVE ------------------------------------------------
     * Until real accounts exist, a player's whole history lives in one
     * browser and dies with a cache clear. That is the honest limit of a
     * static site — but it does NOT require a back end to make survivable.
     * A save code is the entire progress state, base64'd, that a player can
     * copy to another device or keep as a backup.
     *
     * Deliberately not encrypted or signed: there is nothing to cheat at
     * here (no leaderboard, no paid tier yet), and an opaque blob a player
     * cannot inspect would contradict how this project treats its readers.
     * When real accounts land, importCode() becomes the migration path —
     * a returning player pastes their code once and keeps their history.
     * ------------------------------------------------------------------ */
    exportCode: function () {
      try {
        var json = JSON.stringify(load());
        // encodeURIComponent first so non-ASCII avatar names survive btoa
        return btoa(unescape(encodeURIComponent(json)));
      } catch (e) { return ''; }
    },
    importCode: function (code) {
      try {
        var json = decodeURIComponent(escape(atob(String(code || '').trim())));
        var d = JSON.parse(json);
        if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
        // Merge rather than overwrite: importing on a device that already has
        // progress must never silently delete it. Completions are unioned, and
        // the earliest completion time wins so the record stays truthful.
        var cur = load();
        var out = Object.assign({}, cur, d);
        out.missions = Object.assign({}, cur.missions || {});
        var inc = d.missions || {};
        for (var k in inc) if (Object.prototype.hasOwnProperty.call(inc, k)) {
          var a = out.missions[k] || {}, b = inc[k] || {};
          out.missions[k] = Object.assign({}, a, b, {
            complete: !!(a.complete || b.complete),
            at: Math.min(a.at || Infinity, b.at || Infinity) || Date.now()
          });
        }
        out.codex = Object.assign({}, cur.codex || {}, d.codex || {});
        out.kv    = Object.assign({}, cur.kv    || {}, d.kv    || {});
        out.avatar = d.avatar || cur.avatar || null;
        store(out); this._fire();
        return true;
      } catch (e) { return false; }
    },

    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} this._fire(); },
    _fire: function () { try { if (typeof this.onchange === 'function') this.onchange(); } catch (e) {} }
  };

  window.SymbiQ.save = S;
})();
