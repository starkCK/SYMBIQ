(function () {
  'use strict';
  var C = window.SymbiQ && window.SymbiQ.core;
  var root = document.getElementById('scale-ladder');
  if (!root) return;
  var esc = C ? C.esc : function (s) { return String(s); };

  var ROWS = [
    { n: 'The vacuum can', m: 0.8, r: 'about 0.5 to 1 m', t: 'The outside of the fridge.', level: 'cryostat' },
    { n: 'The chip package', m: 0.1, r: 'about 10 cm', t: 'The sealed box on the coldest plate.', level: 'package' },
    { n: 'The chip', m: 0.01, r: 'about 1 cm', t: 'Silicon with the circuits on top.', level: 'chip' },
    { n: 'A readout resonator', m: 0.004, r: 'a few mm', t: 'Folded back and forth to fit.' },
    { n: 'A transmon’s pad', m: 0.0004, r: 'a few hundred µm', t: 'One of the two islands of a qubit.', level: 'transmon' },
    { n: 'A human hair', m: 7e-5, r: 'about 50 to 100 µm', t: 'For comparison.' },
    { n: 'A wire bond', m: 2.5e-5, r: 'about 25 µm thick', t: 'The wire from board to chip.' },
    { n: 'The SQUID loop', m: 1e-5, r: 'about 10 µm', t: 'Two junctions joined in a loop.' },
    { n: 'A wavelength of green light', m: 5e-7, r: 'about 500 nm', t: 'The junction is about the same size or smaller, so labs image it with electron microscopes rather than light.' },
    { n: 'The Josephson junction', m: 1.5e-7, r: 'about 100 to 300 nm', t: 'The overlap of two aluminium films.', level: 'junction' },
    { n: 'A flu virus', m: 1e-7, r: 'about 80 to 120 nm', t: 'For comparison.' },
    { n: 'The aluminium film', m: 5e-8, r: 'tens of nm thick', t: 'How thick each electrode is.' },
    { n: 'DNA, across', m: 2e-9, r: 'about 2 nm', t: 'For comparison.' },
    { n: 'The oxide barrier', m: 1.5e-9, r: 'about 1 to 2 nm', t: 'The insulating layer in the middle of the junction.', level: 'junction' },
    { n: 'An aluminium atom', m: 2.9e-10, r: 'about 0.29 nm across', t: 'So the barrier is roughly four to eight atoms thick.' }
  ];
  var LEVEL_NAME = { cryostat: 'Level 2', package: 'Level 3', chip: 'Level 4', transmon: 'Level 5', junction: 'Level 6' };

  function len(m) {
    if (m >= 1) return trim(m) + ' m';
    if (m >= 1e-2) return trim(m * 100) + ' cm';
    if (m >= 1e-3) return trim(m * 1e3) + ' mm';
    if (m >= 1e-6) return trim(m * 1e6) + ' µm';
    return trim(m * 1e9) + ' nm';
  }
  function trim(x) { return (x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2)).toString().replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1'); }
  function times(x) {
    if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(/\.0$/, '') + ' million';
    if (x >= 1e3) return (x >= 1e5 ? Math.round(x / 1e3) : Math.round(x / 100) / 10) + ' thousand';
    return Math.round(x).toLocaleString('en-US');
  }

  var list = root.querySelector('.sl-list'), slider = root.querySelector('.sl-range'),
      cap = root.querySelector('.sl-view'), out = [];
  list.innerHTML = ROWS.map(function (r, i) {
    return '<li class="sl-row" data-i="' + i + '"><div class="sl-head"><button type="button" class="sl-name">' + esc(r.n) + '</button>' +
      (r.level ? '<button type="button" class="sl-lvl" data-level="' + r.level + '" title="Open this level of the model">' + LEVEL_NAME[r.level] + ' &#9656;</button>' : '') +
      '<span class="sl-size">' + esc(r.r) + '</span></div><div class="sl-track" aria-hidden="true"><i class="sl-bar"></i></div>' +
      '<p class="sl-txt">' + esc(r.t) + ' <span class="sl-note"></span></p></li>';
  }).join('');
  Array.prototype.forEach.call(list.children, function (li, i) { out[i] = { bar: li.querySelector('.sl-bar'), note: li.querySelector('.sl-note') }; });

  var MIN = -97, MAX = 5;
  function setView(v) {
    v = Math.max(MIN, Math.min(MAX, v));
    slider.value = String(v);
    var W = Math.pow(10, v / 10);
    slider.setAttribute('aria-valuetext', 'view is ' + len(W) + ' wide');
    cap.textContent = 'This view is ' + len(W) + ' wide.';
    ROWS.forEach(function (r, i) {
      var f = r.m / W, o = out[i];
      o.bar.style.width = Math.min(100, Math.max(f * 100, 0.6)) + '%';
      var kind = f > 1 ? 'over' : f < 0.004 ? 'tiny' : '';
      o.bar.parentNode.setAttribute('data-k', kind); o.note.setAttribute('data-k', kind);
      o.note.textContent = '· ' + (f > 1 ? 'off the edge, ' + times(f) + '× wider than this view'
        : f < 0.004 ? 'a speck, 1/' + Math.round(1 / f).toLocaleString('en-US') + ' of the view'
        : Math.round(f * 100) + '% of the view');
    });
  }
  slider.min = MIN; slider.max = MAX; slider.step = 1;
  slider.addEventListener('input', function () { setView(+slider.value); });

  function fit(i) { setView(Math.round(Math.log10(ROWS[i].m / 0.6) * 10)); }
  list.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('sl-name')) { fit(+b.closest('li').getAttribute('data-i')); return; }
    if (b.classList.contains('sl-lvl')) {
      var stage = document.getElementById('in-stage');
      if (location.hash !== '#' + b.getAttribute('data-level')) location.hash = b.getAttribute('data-level');
      if (stage) stage.scrollIntoView({ behavior: C && C.reduced() ? 'auto' : 'smooth', block: 'center' });
    }
  });
  Array.prototype.forEach.call(root.querySelectorAll('[data-fit]'), function (b) {
    b.addEventListener('click', function () {
      var want = { fridge: 'The vacuum can', chip: 'The chip', qubit: 'A transmon’s pad', junction: 'The Josephson junction', atom: 'An aluminium atom' }[b.getAttribute('data-fit')];
      for (var k = 0; k < ROWS.length; k++) if (ROWS[k].n === want) { fit(k); break; }
    });
  });
  setView(-20);
})();
