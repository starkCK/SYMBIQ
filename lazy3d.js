(function () {
  'use strict';
  var W = window, D = document, S = W.SymbiQ, C = S && S.core;
  if (!C) return;
  var tag = D.getElementById('sq3d-src');
  var hosts = D.querySelectorAll('[data-sq3d]');
  if (!tag || !hosts.length) return;

  var loading = null;
  function mod() { return loading || (loading = import(tag.src)); }
  S.sq3d = S.sq3d || {};

  function note(el, text) { if (!el) return; el.textContent = text; el.hidden = false; }

  function bloch(card) {
    var svg = card.querySelector('#bloch-svg'), api = S.bloch2d;
    if (!svg || !api) return;
    var bar = D.createElement('div');
    bar.className = 'sq3d-view'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Sphere view');
    bar.innerHTML = '<button type="button" class="preset" data-v="flat" aria-pressed="true">Flat</button>' +
                    '<button type="button" class="preset" data-v="3d" aria-pressed="false">3D</button>';
    svg.parentNode.insertBefore(bar, svg);
    var wrap = D.createElement('div');
    wrap.className = 'b3d'; wrap.hidden = true;
    wrap.innerHTML = '<div class="b3d-stage"></div><p class="b3d-msg" hidden></p>' +
                     '<p class="b3d-hint">Drag to turn it. It shows the same state as the flat view: the gate buttons drive both, and each gate sweeps the arrow along the rotation it really is. Click the sphere, then scroll or pinch to zoom.</p>';
    svg.parentNode.insertBefore(wrap, svg.nextSibling);
    var stageEl = wrap.querySelector('.b3d-stage'), msg = wrap.querySelector('.b3d-msg'), h = null, pending = false;

    function show(on) {
      Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String((b.getAttribute('data-v') === '3d') === on));
      });
      svg.classList.toggle('sq3d-off', on); wrap.hidden = !on;
      if (on) ensure(); else if (h) h.setActive(false);
    }
    function ensure() {
      if (h) { h.setActive(true); return; }
      if (pending) return;
      pending = true;
      mod().then(function (m) {
        h = m.mounts.bloch({ host: stageEl, api: api, isVisible: function () { return !wrap.hidden; } });
        if (!h) { note(msg, 'This browser could not start 3D graphics, so the flat sphere stays.'); show(false); return; }
        S.sq3d.bloch = h;
      }).catch(function () {
        note(msg, 'The 3D view could not load. The flat sphere still works.'); show(false);
      }).then(function () { pending = false; });
    }
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (b) show(b.getAttribute('data-v') === '3d');
    });
  }

  function surface(card) {
    var host = card.querySelector('.s3d-stage'); if (!host) return;
    var hs = (card.getAttribute('data-sq3d-h') || '').split(',');
    var want = +(W.innerWidth < 720 ? hs[1] : hs[0]);
    if (want) card.style.minHeight = want + 'px';
    function release() { card.style.minHeight = ''; }
    C.onNear(card, function () {
      mod().then(function (m) {
        var h = m.mounts.surface({ card: card });
        if (!h) { note(card.querySelector('.s3d-msg'), 'This browser could not start 3D graphics. The flat surface-17 explorer above does the same job.'); release(); return; }
        S.sq3d.surface = h; release();
      }).catch(function () {
        note(card.querySelector('.s3d-msg'), 'The 3D view could not load. Reload the page to try again.'); release();
      });
    }, 1400);
  }

  Array.prototype.forEach.call(hosts, function (card) {
    var kind = card.getAttribute('data-sq3d');
    if (kind === 'bloch') bloch(card); else if (kind === 'surface') surface(card);
  });
})();
