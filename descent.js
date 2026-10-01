(function () {
  'use strict';
  var D = document, W = window;
  var root = D.querySelector('[data-descent]');
  if (!root) return;

  function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var seen = read('sq-seen') || {};
  var data;
  try { data = JSON.parse(D.getElementById('descent-data').textContent); } catch (e) { return; }

  var TOPIC = /^(machinery|region)-\d\d\.html$/;
  var topics = Object.keys(seen).filter(function (p) { return TOPIC.test(p); }).length;
  var deepest = -1;
  data.layers.forEach(function (l, i) {
    var n = l.pages.filter(function (p) { return seen[p]; }).length;
    var extra = l.id === '800mk' ? topics : 0;
    l.opened = n + extra;
    var li = D.getElementById('layer-' + l.id), prog = li && li.querySelector('.ds-prog');
    if (!li) return;
    if (l.opened) {
      deepest = i;
      var count = prog.querySelector('.ds-count');
      var txt = l.id === '800mk'
        ? 'You have opened ' + topics + ' course topic' + (topics === 1 ? '' : 's') + '.'
        : 'You have opened ' + n + ' of ' + l.pages.length + '.';
      var sp = D.createElement('span'); sp.className = 'ds-mine'; sp.textContent = ' ' + txt;
      prog.appendChild(sp);
    }
  });
  if (deepest >= 0) {
    var li = D.getElementById('layer-' + data.layers[deepest].id); if (li) li.classList.add('is-here');
    var plate = root.querySelector('.ds-plate[data-layer="' + data.layers[deepest].id + '"]');
    if (plate) plate.classList.add('is-here');
  }
  var nextEl = D.getElementById('ds-next'), pick = null;
  for (var i = Math.max(0, deepest); i < data.layers.length && !pick; i++) {
    var ls = data.layers[i].links;
    for (var j = 0; j < ls.length && !pick; j++) {
      var pg = ls[j][0].split('#')[0];
      if (!seen[pg]) pick = { href: ls[j][0], label: ls[j][1], layer: data.layers[i] };
    }
  }
  if (nextEl && pick) {
    nextEl.textContent = '';
    nextEl.appendChild(D.createTextNode(deepest >= 0 ? 'Your next stop down: ' : 'Start at the top: '));
    var a = D.createElement('a'); a.href = pick.href; a.textContent = pick.label; nextEl.appendChild(a);
    nextEl.appendChild(D.createTextNode(' (' + pick.layer.temp + ', ' + pick.layer.short + ').'));
    nextEl.hidden = false;
  }

  var btn = D.getElementById('d3d-open'), host = D.getElementById('d3d-host'), msg = D.getElementById('d3d-msg'), tag = D.getElementById('descent3d-src');
  if (!btn || !host || !tag) return;
  var handle = null, loading = null;
  function show(on) {
    host.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
    btn.textContent = on ? 'Close the 3D map' : 'Open the 3D map';
  }
  function fail() {
    msg.textContent = 'This browser could not start the 3D map. The picture and the list do the same job.';
    msg.hidden = false; show(false);
  }
  btn.addEventListener('click', function () {
    if (!host.hidden) { show(false); if (handle) handle.setActive(false); return; }
    msg.hidden = true; show(true);
    if (handle) { handle.setActive(true); return; }
    loading = loading || import(tag.src);
    loading.then(function (m) {
      handle = m.mount({ host: host, data: data, seen: seen, deepest: deepest });
      if (!handle) { fail(); return; }
      W.SymbiQ = W.SymbiQ || {}; W.SymbiQ.descent3d = handle;
    }).catch(fail);
  });
})();
