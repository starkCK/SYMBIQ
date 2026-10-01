'use strict';
(function () {
  var scope = self;
  ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'caches', 'BroadcastChannel', 'SharedWorker', 'Worker'].forEach(function (k) {
    try { Object.defineProperty(scope, k, { value: undefined, configurable: false, writable: false }); } catch (e) { try { scope[k] = undefined; } catch (e2) { } }
  });
  var post = scope.postMessage.bind(scope);
  try { Object.defineProperty(scope, 'postMessage', { value: undefined, configurable: false, writable: false }); } catch (e) { }
  try { if (scope.navigator) Object.defineProperty(scope.navigator, 'sendBeacon', { value: undefined }); } catch (e) { }

  function pack(set, fn) {
    var n = set.items.length, keys = new Array(n), idx = new Array(n), i;
    for (i = 0; i < n; i++) {
      var v = fn(set.items[i], i, set.items.slice());
      if (typeof v !== 'number' || !isFinite(v)) throw new Error('The rule must return a finite number for every item. It returned ' + String(v) + ' for the item of size ' + set.items[i] + '.');
      keys[i] = v; idx[i] = i;
    }
    idx.sort(function (a, b) { return keys[b] - keys[a] || a - b; });
    var rem = [];
    for (i = 0; i < n; i++) {
      var w = set.items[idx[i]], placed = false;
      for (var b = 0; b < rem.length; b++) if (rem[b] >= w) { rem[b] -= w; placed = true; break; }
      if (!placed) rem.push(set.cap - w);
    }
    return rem.length;
  }

  scope.onmessage = function (e) {
    var d = e.data || {}, fn;
    try {
      fn = new Function('size', 'i', 'sizes', '"use strict";\n' + String(d.code || ''));
    } catch (err) { post({ ok: false, error: 'The rule does not compile: ' + err.message }); return; }
    try {
      var per = d.sets.map(function (s) { return pack(s, fn); }), held = (d.held || []).map(function (s) { return pack(s, fn); });
      var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
      post({ ok: true, per: per, total: sum(per), heldTotal: sum(held) });
    } catch (err) { post({ ok: false, error: String(err && err.message || err) }); }
  };
})();
