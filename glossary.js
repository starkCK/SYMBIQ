(function () {
  'use strict';
  var list = document.getElementById('gl-list');
  if (!list) return;
  var q = document.getElementById('gl-q');
  var count = document.getElementById('gl-count');
  var none = document.getElementById('gl-none');
  var chips = [].slice.call(document.querySelectorAll('.gl-chip'));
  var items = [].slice.call(list.querySelectorAll('.gl-item'));
  var total = items.length, tier = 'all';

  function apply() {
    var needle = (q.value || '').trim().toLowerCase(), shown = 0;
    items.forEach(function (it) {
      var ok = (tier === 'all' || it.getAttribute('data-t') === tier) &&
               (!needle || it.getAttribute('data-hay').indexOf(needle) >= 0);
      it.hidden = !ok;
      if (ok) shown++;
    });
    [].forEach.call(list.querySelectorAll('.gl-group'), function (g) {
      var any = g.querySelector('.gl-item:not([hidden])');
      g.hidden = !any;
      var h = g.previousElementSibling;
      if (h && h.classList.contains('gl-letter')) h.hidden = !any;
    });
    count.textContent = shown === total ? total + ' terms' : shown + ' of ' + total + ' terms';
    none.hidden = shown !== 0;
  }

  q.addEventListener('input', apply);
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      tier = c.getAttribute('data-t');
      chips.forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
      apply();
    });
  });

  function land() {
    var id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    if (el.hidden) { q.value = ''; tier = 'all'; chips.forEach(function (o) { o.setAttribute('aria-pressed', o.getAttribute('data-t') === 'all' ? 'true' : 'false'); }); apply(); }
    el.scrollIntoView({ block: 'center' });
    el.classList.add('gl-hit');
    setTimeout(function () { el.classList.remove('gl-hit'); }, 2400);
  }
  window.addEventListener('hashchange', land);
  land();
})();
