(function () {
  'use strict';
  var D = document;
  var S = window.SymbiQ && window.SymbiQ.save;

  function one(s, r) { return (r || D).querySelector(s); }
  function all(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }

  var root = one('[data-course]');
  if (!root) return;
  var page = root.getAttribute('data-page');
  var mission = root.getAttribute('data-mission');
  var total = +root.getAttribute('data-count') || 0;
  var KV = 'curriculum.' + page;

  function cleared() {
    var a = [];
    try { a = S ? S.get(KV, []) : []; } catch (e) { a = []; }
    return Array.isArray(a) ? a : [];
  }
  function setCleared(a) { try { if (S) S.set(KV, a); } catch (e) {} }

  var h = location.hash;
  var old = /^#([ft])(\d\d)$/.exec(h);
  if (old && root.hasAttribute('data-course-index')) {
    var want = (page === 'formalism' && old[1] === 'f') ? 'machinery-' : (page === 'feasible' && old[1] === 't') ? 'region-' : null;
    if (want) { location.replace(want + old[2] + '.html'); return; }
  }

  function tick() {
    var done = cleared();
    all('[data-id]', root).forEach(function (el) {
      var on = done.indexOf(el.getAttribute('data-id')) !== -1;
      el.classList.toggle('is-done', on);
      var mark = one('.cp-ck', el);
      if (mark) mark.textContent = on ? '✓' : '';
      if (on) el.setAttribute('data-done', ''); else el.removeAttribute('data-done');
    });
    var n = done.length;
    var label = one('#mod-progress-label'), bar = one('#mod-progress-bar');
    if (label) label.textContent = n === 0 ? 'Your progress: 0 of ' + total + ' understood'
      : n >= total ? 'Every topic understood ✓' : 'Your progress: ' + n + ' of ' + total + ' understood';
    if (bar) bar.style.width = (100 * n / Math.max(1, total)) + '%';
    var resume = one('#cp-resume');
    if (resume) {
      var next = all('.coursetopic', root).filter(function (a) { return done.indexOf(a.getAttribute('data-id')) === -1; })[0];
      if (next && n > 0) {
        resume.hidden = false;
        resume.href = next.getAttribute('href');
        one('b', resume).textContent = one('.ct-t', next).textContent;
      } else resume.hidden = true;
    }
  }

  function markToggle(id) {
    var a = cleared(), i = a.indexOf(id);
    if (i === -1) a.push(id); else a.splice(i, 1);
    setCleared(a);
    tick();
    syncButton(id);
    if (a.length >= total && total && S && S.completeMission) {
      var first = false;
      try { first = S.completeMission(mission, { via: 'curriculum' }); } catch (e) {}
      if (first) {
        var host = one('.cp-foot');
        if (host && !one('#mod-complete-note')) {
          var p = D.createElement('p');
          p.id = 'mod-complete-note'; p.className = 'mod-complete-note';
          p.innerHTML = 'You’ve cleared every topic here. A new Codex entry unlocked, <a href="journey.html#codex">see it on The Solver’s Path ▸</a>';
          host.appendChild(p);
        }
      }
    }
  }
  function syncButton(id) {
    var b = one('.cp-mark');
    if (!b) return;
    var on = cleared().indexOf(id) !== -1;
    b.textContent = on ? '✓ Understood' : 'Mark as understood';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('on', on);
  }

  tick();

  var id = root.getAttribute('data-topic');
  if (!id) return;
  var steps = all('.cp-step', root);
  var bar = one('.cp-stepper', root);
  if (!steps.length || !bar) return;

  var btns = all('button[data-step]', bar);
  var cur = 0;
  function show(i, fromUser) {
    cur = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, k) { s.hidden = (k !== cur); });
    btns.forEach(function (b, k) {
      b.setAttribute('aria-current', k === cur ? 'step' : 'false');
      b.classList.toggle('is-on', k === cur);
      b.classList.toggle('is-past', k < cur);
    });
    var prev = one('.cp-prev', root), next = one('.cp-next', root), last = cur === steps.length - 1;
    if (prev) prev.disabled = cur === 0;
    if (next) next.hidden = last;
    var fin = one('.cp-finish', root);
    if (fin) fin.hidden = !last;
    if (fromUser) {
      var slug = steps[cur].getAttribute('data-step');
      try { history.replaceState(null, '', '#' + slug); } catch (e) {}
      var top = bar.getBoundingClientRect().top;
      if (top < 0) bar.scrollIntoView({ block: 'start' });
    }
  }
  root.classList.add('is-stepped');
  btns.forEach(function (b, k) { b.addEventListener('click', function () { show(k, true); }); });
  var pv = one('.cp-prev', root), nx = one('.cp-next', root);
  if (pv) pv.addEventListener('click', function () { show(cur - 1, true); });
  if (nx) nx.addEventListener('click', function () { show(cur + 1, true); });
  bar.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); var b = btns[cur]; if (b) b.focus(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); var c = btns[cur]; if (c) c.focus(); }
  });
  var mark = one('.cp-mark', root);
  if (mark) mark.addEventListener('click', function () { markToggle(id); });
  syncButton(id);

  var start = 0, hh = location.hash.replace(/^#/, '');
  steps.forEach(function (s, k) { if (s.getAttribute('data-step') === hh) start = k; });
  show(start, false);
  window.addEventListener('hashchange', function () {
    var x = location.hash.replace(/^#/, '');
    steps.forEach(function (s, k) { if (s.getAttribute('data-step') === x) show(k, false); });
  });
})();
