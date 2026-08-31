/* SymbiQ, The Solver's Path: local progress store.
   Namespaced localStorage, fault-tolerant.

   L1 (2026-08-27): a real account back end exists (Supabase), wired in as a
   background MIRROR rather than a hard replacement. Every caller below --
   missions.js, coherence.js, curriculum-track.js, rung.js -- keeps calling
   the same synchronous API and keeps working exactly as before, signed in or
   not. connectRemote() is the only new surface: once a session exists it
   pulls the account's saved progress down (merged in with the same
   union-and-earliest-wins rule importCode() already used for save codes,
   never overwritten), and every local mutation from then on is mirrored up
   in the background, debounced. Sign out and it goes back to being exactly
   the local-only store it always was.
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

  // Shared by importCode() (decodes a pasted save code first) and
  // connectRemote() (already has a parsed object from Supabase) -- one merge
  // algorithm, not two. Union of missions; earliest completion time wins so
  // the record stays truthful; codex/kv merged; avatar keeps whichever side
  // already had one. Never silently drops progress from either side.
  function mergeProgress(cur, incoming) {
    var out = Object.assign({}, cur, incoming);
    out.missions = Object.assign({}, cur.missions || {});
    var inc = incoming.missions || {};
    for (var k in inc) if (Object.prototype.hasOwnProperty.call(inc, k)) {
      var a = out.missions[k] || {}, b = inc[k] || {};
      out.missions[k] = Object.assign({}, a, b, {
        complete: !!(a.complete || b.complete),
        at: Math.min(a.at || Infinity, b.at || Infinity) || Date.now()
      });
    }
    out.codex = Object.assign({}, cur.codex || {}, incoming.codex || {});
    out.kv    = Object.assign({}, cur.kv    || {}, incoming.kv    || {});
    out.avatar = incoming.avatar || cur.avatar || null;
    return out;
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
     * static site, but it does NOT require a back end to make survivable.
     * A save code is the entire progress state, base64'd, that a player can
     * copy to another device or keep as a backup.
     *
     * Deliberately not encrypted or signed: there is nothing to cheat at
     * here (no leaderboard, no paid tier yet), and an opaque blob a player
     * cannot inspect would contradict how this project treats its readers.
     * When real accounts land, importCode() becomes the migration path,
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
        // progress must never silently delete it.
        store(mergeProgress(load(), d)); this._fire();
        return true;
      } catch (e) { return false; }
    },

    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} this._fire(); },
    _fire: function () {
      try { if (typeof this.onchange === 'function') this.onchange(); } catch (e) {}
      this._pushRemote();
    },

    /* ---- REMOTE MIRROR (Supabase, optional) ----------------------------
     * Local storage stays the single thing every caller reads and writes
     * synchronously. This only adds a background copy for a signed-in
     * account, so progress survives a cleared cache or a new device.
     * ------------------------------------------------------------------ */
    _remote: null,       // { client, userId } while connected, else null
    _pushTimer: null,

    connectRemote: function (client, userId) {
      var self = this;
      this._remote = { client: client, userId: userId };
      // Promise.resolve(...) adopts whatever thenable the query builder
      // returns into a real Promise, so .catch() below is always available
      // regardless of exactly what shape the client's builder returns.
      return Promise.resolve(client.from('profiles').select('progress').eq('id', userId).single())
        .then(function (res) {
          var remoteProgress = (res && res.data && res.data.progress) || {};
          var hasRemote = remoteProgress && Object.keys(remoteProgress).length > 0;
          if (hasRemote) {
            store(mergeProgress(load(), remoteProgress));
          }
          // Push once right away so a brand-new account gets today's local
          // progress immediately, rather than waiting for the next change.
          self._pushRemote(true);
          self._fire();
          return hasRemote;
        })
        .catch(function () { return false; });
    },
    disconnectRemote: function () {
      this._remote = null;
      if (this._pushTimer) { clearTimeout(this._pushTimer); this._pushTimer = null; }
    },
    // Debounced (2s) so a burst of local changes -- several missions ticking
    // over at once -- costs one write, not several. Fire-and-forget: a
    // failed push never blocks or breaks anything the player is doing.
    _pushRemote: function (immediate) {
      var self = this;
      if (!this._remote) return;
      if (this._pushTimer) clearTimeout(this._pushTimer);
      var go = function () {
        self._pushTimer = null;
        if (!self._remote) return;
        var d = load();
        Promise.resolve(
          self._remote.client.from('profiles').update({ progress: d }).eq('id', self._remote.userId)
        ).catch(function (e) { try { console.warn('SymbiQ.save: remote sync failed', e); } catch (e2) {} });
      };
      if (immediate) go(); else this._pushTimer = setTimeout(go, 2000);
    }
  };

  window.SymbiQ.save = S;
})();
