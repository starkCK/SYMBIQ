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
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { }
  }

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
