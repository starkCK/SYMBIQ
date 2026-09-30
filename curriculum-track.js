(function () {
  var S = window.SymbiQ && window.SymbiQ.save;
  if (!S) return;

  function init(pageKey, missionId, missionLabel) {
    var mods = [].slice.call(document.querySelectorAll('.mod[id]'));
    if (!mods.length) return;
    var KV = 'curriculum.' + pageKey;

    function clearedSet() {
      var arr = S.get(KV, []);
      return Array.isArray(arr) ? arr : [];
    }
    function isCleared(id) { return clearedSet().indexOf(id) !== -1; }

    function toggle(id) {
      var arr = clearedSet();
      var i = arr.indexOf(id);
      if (i === -1) arr.push(id); else arr.splice(i, 1);
      S.set(KV, arr);
      renderAll();
      if (arr.length === mods.length) {
        var first = S.completeMission(missionId, { via: 'curriculum' });
        if (first) announceComplete();
      }
    }

    function badge(mod) {
      var title = mod.querySelector('.mod-t');
      if (!title) return;
      var existing = title.querySelector('.mod-check');
      if (isCleared(mod.id)) {
        if (!existing) {
          var b = document.createElement('span');
          b.className = 'mod-check';
          b.textContent = '✓';
          b.setAttribute('aria-label', 'Marked understood');
          title.appendChild(b);
        }
      } else if (existing) {
        existing.remove();
      }
    }

    function button(mod) {
      var out = mod.querySelector('.mod-out');
      if (!out) return;
      var btn = out.querySelector('.mod-mark');
      var on = isCleared(mod.id);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset mod-mark';
        out.insertBefore(btn, out.firstChild);
        btn.addEventListener('click', function () { toggle(mod.id); });
      }
      btn.textContent = on ? '✓ Understood' : 'Mark as understood';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.classList.toggle('on', on);
    }

    function stat() {
      var label = document.getElementById('mod-progress-label');
      var bar = document.getElementById('mod-progress-bar');
      if (!label || !bar) return;
      var n = clearedSet().length;
      label.textContent = n === 0
        ? 'Your progress: 0 of ' + mods.length + ' understood'
        : n === mods.length
          ? 'Every topic understood ✓'
          : 'Your progress: ' + n + ' of ' + mods.length + ' understood';
      bar.style.width = (100 * n / mods.length) + '%';
    }

    function announceComplete() {
      var host = document.getElementById('mod-progress-wrap');
      if (!host || document.getElementById('mod-complete-note')) return;
      var p = document.createElement('p');
      p.id = 'mod-complete-note';
      p.className = 'mod-complete-note';
      p.innerHTML = 'You’ve cleared every topic here. A new Codex entry unlocked, ' +
        '<a href="journey.html#codex">see it on The Solver’s Path ▸</a>';
      host.parentNode.insertBefore(p, host.nextSibling);
    }

    function renderAll() {
      mods.forEach(function (m) { badge(m); button(m); });
      stat();
      if (clearedSet().length === mods.length) announceComplete();
    }

    renderAll();
  }

  window.SymbiQ.curriculumTrack = { init: init };
})();
