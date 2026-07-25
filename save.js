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

    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} this._fire(); },
    _fire: function () { try { if (typeof this.onchange === 'function') this.onchange(); } catch (e) {} }
  };

  window.SymbiQ.save = S;
})();
