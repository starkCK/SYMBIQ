(function () {
  'use strict';
  var D = document;
  var hub = D.querySelector('[data-track-hub]');
  if (!hub) return;

  function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var seen = read('sq-seen') || {};
  var LEVEL = { g: 'Plain', y: 'Working', r: 'Formal' };
  var pref = (window.SymbiQ && SymbiQ.depth && SymbiQ.depth.get) ? SymbiQ.depth.get() : null;
  var dk = pref === 'light' ? 'g' : pref === 'deep' ? 'r' : 'y';

  var mods = [].slice.call(hub.querySelectorAll('.tr-mod'));
  function mins(li) { try { return JSON.parse(li.getAttribute('data-min')); } catch (e) { return null; } }
  function opened(p) { return !!seen[p]; }

  mods.forEach(function (li) {
    var m = mins(li), t = li.querySelector('[data-time]');
    if (m && t) t.textContent = 'about ' + m[dk] + ' min at ' + LEVEL[dk];
    if (opened(li.getAttribute('data-page'))) li.classList.add('is-done');
  });

  var done = mods.filter(function (li) { return li.classList.contains('is-done'); }).length;
  var next = null;
  for (var i = 0; i < mods.length && !next; i++) {
    var li = mods[i];
    if (li.classList.contains('is-done')) continue;
    var after = (li.getAttribute('data-after') || '').split(' ').filter(Boolean);
    if (after.every(opened)) next = li;
  }
  if (!next) next = mods.filter(function (li) { return !li.classList.contains('is-done'); })[0] || null;

  var kicker = D.getElementById('tr-kicker'), link = D.getElementById('tr-nextlink'),
      title = D.getElementById('tr-nexttitle'), meta = D.getElementById('tr-nextmeta'), prog = D.getElementById('tr-progress');

  if (next) {
    next.classList.add('is-next');
    next.setAttribute('aria-current', 'step');
    var a = next.querySelector('h3 a'), m = mins(next);
    link.href = a.getAttribute('href');
    title.textContent = next.getAttribute('data-title');
    meta.textContent = m ? 'about ' + m[dk] + ' min at ' + LEVEL[dk] : '';
    kicker.textContent = done ? 'Your next step' : 'Start here';
    var grp = next.closest('details'); if (grp) grp.open = true;
  } else {
    var nextTrack = hub.querySelector('.enddoors a:last-child');
    kicker.textContent = 'Track complete';
    if (nextTrack) {
      link.href = nextTrack.getAttribute('href');
      title.textContent = nextTrack.querySelector('b').textContent;
    }
    meta.textContent = 'You have opened every module here.';
  }
  prog.textContent = done + ' of ' + mods.length + ' modules opened in this browser';
})();
