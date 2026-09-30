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
      return !already;
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

    get: function (key, dflt) {
      var kv = load().kv || {};
      return Object.prototype.hasOwnProperty.call(kv, key) ? kv[key] : dflt;
    },
    set: function (key, value) {
      var d = load(); d.kv = d.kv || {};
      d.kv[key] = value; store(d); this._fire();
    },

    exportCode: function () {
      try {
        var json = JSON.stringify(load());
        return btoa(unescape(encodeURIComponent(json)));
      } catch (e) { return ''; }
    },
    importCode: function (code) {
      try {
        var json = decodeURIComponent(escape(atob(String(code || '').trim())));
        var d = JSON.parse(json);
        if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
        store(mergeProgress(load(), d)); this._fire();
        return true;
      } catch (e) { return false; }
    },

    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} this._fire(); },
    _fire: function () {
      try { if (typeof this.onchange === 'function') this.onchange(); } catch (e) {}
      this._pushRemote();
    },

    _remote: null,
    _pushTimer: null,

    connectRemote: function (client, userId) {
      var self = this;
      this._remote = { client: client, userId: userId };
      return Promise.resolve(client.from('profiles').select('progress').eq('id', userId).single())
        .then(function (res) {
          var remoteProgress = (res && res.data && res.data.progress) || {};
          var hasRemote = remoteProgress && Object.keys(remoteProgress).length > 0;
          if (hasRemote) {
            store(mergeProgress(load(), remoteProgress));
          }
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
