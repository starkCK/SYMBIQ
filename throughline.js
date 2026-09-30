(function () {
  'use strict';
  var W = window, D = document;
  if (!D.body || !D.body.hasAttribute('data-throughline')) return;
  if (!('IntersectionObserver' in W)) return;

  var sections = Array.prototype.slice.call(D.querySelectorAll('[data-fig-state]'));
  if (!sections.length) return;

  var DKEY = 'symbiq.tl.dismissed';
  var dismissed = false;
  try { dismissed = sessionStorage.getItem(DKEY) === '1'; } catch (e) {}
  if (dismissed) return;

  var CAPTIONS = {
    1: 'One physical qubit. It fails, and there is nothing to compare it to.',
    2: 'Spread across a patch. Now something can be checked against something else.',
    3: 'A flip lights its neighbours. The dashed ring is the decoder’s repair — not always right.',
    4: 'Below threshold, the same patch simply stops failing.',
    5: 'The same patch, in the notation the formal section uses.'
  };

  var NS = 'http://www.w3.org/2000/svg';
  function el(t, a) { var n = D.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }

  var panel = D.createElement('div');
  panel.className = 'tl-panel';
  panel.innerHTML =
    '<div class="tl-head"><span class="tl-eyebrow">Following along</span>' +
    '<button type="button" class="tl-close" aria-label="Dismiss">×</button></div>' +
    '<svg class="tl-svg" viewBox="0 0 120 120" xmlns="' + NS + '" aria-hidden="true"></svg>' +
    '<p class="tl-cap" data-r="cap"></p>';
  var anchor = D.querySelector('.wrap h1 + .tagline') || D.querySelector('.wrap .tagline') || D.querySelector('.wrap h1');
  if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
  else D.body.appendChild(panel);

  function place() {
    var w = W.innerWidth;
    if (w < 720 || w >= 1440) { panel.style.top = ''; return; }
    var nav = D.querySelector('nav');
    var navH = nav ? nav.offsetHeight : 82;
    var tb = D.querySelector('.tbar');
    panel.style.top = (Math.max(navH, tb ? 60 + tb.offsetHeight : 0) + 8) + 'px';
  }
  place();
  W.addEventListener('resize', place);
  W.addEventListener('load', place);

  var svg = panel.querySelector('.tl-svg');
  var cap = panel.querySelector('[data-r="cap"]');
  panel.querySelector('.tl-close').addEventListener('click', function () {
    panel.classList.remove('on');
    try { sessionStorage.setItem(DKEY, '1'); } catch (e) {}
  });

  var GX = [20, 55, 90], GY = [20, 55, 90];
  var cells = [], checks = [], fix = null, labels = [];
  GY.forEach(function (y, ry) {
    GX.forEach(function (x, rx) {
      cells.push(el('rect', { 'class': 'tl-cell', x: x - 14, y: y - 14, width: 28, height: 28, rx: 5 }));
    });
  });
  [[37, 20], [90, 37], [37, 90], [20, 55]].forEach(function (p) {
    checks.push(el('circle', { 'class': 'tl-check', cx: p[0], cy: p[1], r: 7 }));
  });
  fix = el('circle', { 'class': 'tl-fix', cx: 55, cy: 55, r: 22 });
  var lZ = el('text', { 'class': 'tl-label', x: 6, y: 24 }); lZ.textContent = 'Z̄';
  var lX = el('text', { 'class': 'tl-label', x: 96, y: 24 }); lX.textContent = 'X̄';
  labels = [lZ, lX];
  cells.forEach(function (c) { svg.appendChild(c); });
  checks.forEach(function (c) { svg.appendChild(c); });
  svg.appendChild(fix);
  labels.forEach(function (l) { svg.appendChild(l); });

  var CENTER = 4;
  var FLIPPED = 1;

  function setVisible(n, v) { n.style.opacity = v ? '1' : '0'; }

  function apply(n) {
    cells.forEach(function (c, i) {
      if (n === 1) { setVisible(c, i === CENTER); c.classList.toggle('flip', i === CENTER); }
      else { setVisible(c, true); c.classList.toggle('flip', n === 3 && i === FLIPPED); }
    });
    checks.forEach(function (c, i) {
      setVisible(c, n >= 2);
      c.classList.toggle('lit', n === 3 && (i === 0 || i === 3));
    });
    setVisible(fix, n === 3);
    labels.forEach(function (l) { setVisible(l, n === 5); });
    cap.textContent = CAPTIONS[n] || '';
    panel.classList.add('on');
  }

  apply(1);

  var current = 1;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var n = +e.target.getAttribute('data-fig-state');
      if (n && n !== current) { current = n; apply(n); }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
  sections.forEach(function (s) { io.observe(s); });
})();
