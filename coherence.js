(function () {
  window.SymbiQ = window.SymbiQ || {};
  var S = window.SymbiQ.save;
  var KEY = 'coherence.v1';
  var BASE = 55;
  var meters = [];
  var reduce = window.SymbiQ.core.reduced();

  function clamp(n) { return Math.max(0, Math.min(100, Math.round(n))); }
  function read() {
    if (!S) return BASE;
    var v = S.get(KEY, null);
    return (v === null || isNaN(v)) ? BASE : clamp(v);
  }
  function levelOf(v) { return v < 15 ? 'static' : v < 40 ? 'low' : v < 75 ? 'mid' : 'high'; }

  var C = {
    onchange: null,

    get: function () { return read(); },
    level: function () { return levelOf(read()); },

    _apply: function (delta, reason) {
      var before = read(), after = clamp(before + delta), real = after - before;
      if (S) S.set(KEY, after);
      var lv = levelOf(after);
      try { document.documentElement.setAttribute('data-coh', lv); } catch (e) {}
      meters.forEach(function (m) { paint(m, after, real, reason); });
      try { if (typeof this.onchange === 'function') this.onchange(after, real, reason); } catch (e) {}
      return after;
    },
    restore: function (n, reason) { return this._apply(Math.abs(n || 0), reason || ''); },
    spend: function (n, reason) { return this._apply(-Math.abs(n || 0), reason || ''); },

    mountMeter: function (host) {
      if (!host) return;
      host.innerHTML =
        '<div class="coh" data-level="' + levelOf(read()) + '">' +
          '<div class="coh-top"><span class="coh-name">Coherence</span>' +
            '<span class="coh-val">' + read() + '%</span></div>' +
          '<div class="coh-track"><i class="coh-fill"></i><span class="coh-pips"></span></div>' +
          '<div class="coh-note" role="status" aria-live="polite"></div>' +
        '</div>';
      var m = host.querySelector('.coh');
      meters.push(m);
      var fill = m.querySelector('.coh-fill');
      fill.style.transition = 'none';
      fill.style.width = read() + '%';
      void fill.offsetWidth;
      fill.style.transition = '';
      try { document.documentElement.setAttribute('data-coh', levelOf(read())); } catch (e) {}
      return m;
    }
  };

  function paint(m, value, delta, reason) {
    if (!m || !m.isConnected) return;
    m.setAttribute('data-level', levelOf(value));
    var fill = m.querySelector('.coh-fill'), val = m.querySelector('.coh-val');
    if (fill) fill.style.width = value + '%';
    if (val) val.textContent = value + '%';
    if (!delta) return;
    var pips = m.querySelector('.coh-pips');
    if (pips) {
      var pip = document.createElement('b');
      pip.className = 'coh-pip ' + (delta > 0 ? 'up' : 'down');
      pip.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
      pips.appendChild(pip);
      var kill = function () { if (pip.parentNode) pip.parentNode.removeChild(pip); };
      if (reduce) setTimeout(kill, 900); else pip.addEventListener('animationend', kill);
    }
    var note = m.querySelector('.coh-note');
    if (note && reason) {
      note.textContent = reason + '  (' + (delta > 0 ? '+' : '−') + Math.abs(delta) + ')';
      note.classList.remove('show'); void note.offsetWidth; note.classList.add('show');
      clearTimeout(note._t);
      note._t = setTimeout(function () { note.classList.remove('show'); }, 3200);
    }
  }

  window.SymbiQ.coherence = C;
})();
