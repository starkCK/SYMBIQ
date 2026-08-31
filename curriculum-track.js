/* SymbiQ -- curriculum topic tracking, shared by formalism.html and
 * feasible.html. Both pages ship 15-19 substantial topics (formalism.html's
 * own words: "not another tier of the same explanations") with zero reward
 * loop -- a reader who clears all of them gets exactly the same page they'd
 * get from reading none of them. Every game on this site writes progress;
 * the curriculum, this month's biggest single addition to the site, wrote
 * none. This file is the fix.
 *
 * Deliberately self-report, not auto-tracked: a "Mark as understood" click,
 * not scroll depth or time-open. Guessing at comprehension from dwell time
 * is exactly the kind of thing this project's own honesty rule forbids --
 * it would be lying to the reader about what the checkmark means. Toggleable
 * (click again to unmark), so a stray click costs nothing.
 *
 * Storage: SymbiQ.save's existing kv bag (site/save.js), one array of
 * cleared ids per page -- no new schema, no new persistence mechanism.
 * Finishing every topic on a page fires SymbiQ.save.completeMission() with
 * a real mission id, so journey.html's *existing* Codex mechanism picks it
 * up for free: no second reward system, the one that already works for six
 * missions now works for two curriculum pages too.
 */
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
