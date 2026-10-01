(function () {
  'use strict';
  var W = window, D = document;
  var btn = D.getElementById('w3-enter'), host = D.getElementById('w3-host'), msg = D.getElementById('w3-msg'), tag = D.getElementById('world3d-src'), dataEl = D.getElementById('world-data');
  if (!btn || !host || !tag || !dataEl) return;
  var data; try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var handle = null, loading = null;
  function show(on) { host.hidden = !on; btn.setAttribute('aria-expanded', String(on)); btn.textContent = on ? 'Leave the town' : 'Enter the town'; }
  function fail() { msg.textContent = 'This browser could not start the 3D town. The list below is the same map, with the same links.'; msg.hidden = false; show(false); }
  btn.addEventListener('click', function () {
    if (!host.hidden) { show(false); if (handle) handle.setActive(false); return; }
    msg.hidden = true; show(true);
    if (handle) { handle.setActive(true); return; }
    loading = loading || import(tag.src);
    loading.then(function (m) {
      handle = m.mount({ host: host, data: data });
      if (!handle) { fail(); return; }
      W.SymbiQ = W.SymbiQ || {}; W.SymbiQ.world3d = handle;
    }).catch(fail);
  });
  if (/[?&]enter=1\b/.test(W.location.search)) btn.click();
})();
