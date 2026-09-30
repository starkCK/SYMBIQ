(function () {
  'use strict';
  var W = window, D = document;

  function pageBasename() {
    var p = (W.location && W.location.pathname) || '';
    return p.split('/').pop() || 'index.html';
  }

  function buildHtml(r) {
    var deriv = '';
    if (r.formula) deriv += r.formula;
    if (r.inputs) deriv += (deriv ? ' · ' : '') + r.inputs;
    var html = '<p class="sig-card-title">' + r.value + '</p>';
    if (deriv) html += '<p class="sig-card-formula">' + deriv + '</p>';
    var origin = r.tool ? 'brute-forced by <code>' + r.tool + '</code>' : (r.source || '');
    var meta = origin + (r.verified_at ? ' · verified ' + r.verified_at : '');
    if (meta) html += '<p class="sig-card-meta">' + meta + '</p>';
    if (r.falsifier) html += '<p class="sig-card-wrong">wrong if: ' + r.falsifier + '</p>';
    return html;
  }

  function wireTrigger(span, html) {
    span.addEventListener('click', function (e) {
      e.stopPropagation();
      if (span.getAttribute('aria-expanded') === 'true') W.SymbiQ.sig.close(true);
      else W.SymbiQ.sig.open(span, html, { sticky: true });
    });
    span.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); span.click(); }
    });
    if (W.SymbiQ.sig.fineHover) {
      var showTimer;
      span.addEventListener('pointerenter', function () {
        W.SymbiQ.sig.clearHide();
        showTimer = setTimeout(function () {
          if (span.getAttribute('aria-expanded') !== 'true') W.SymbiQ.sig.open(span, html, { sticky: false });
        }, 120);
      });
      span.addEventListener('pointerleave', function () {
        clearTimeout(showTimer);
        W.SymbiQ.sig.scheduleHide(false);
      });
    }
  }

  function buildToggle(count) {
    var row = D.createElement('div');
    row.className = 'rcpt-toggle-row';
    var btn = D.createElement('button');
    btn.type = 'button';
    btn.className = 'rcpt-toggle';
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = '<span class="rcpt-toggle-dot" aria-hidden="true"></span><span data-r="label">Show the receipts</span>';
    var note = D.createElement('span');
    note.className = 'rcpt-toggle-note';
    note.textContent = count + (count === 1 ? ' verified figure on this page' : ' verified figures on this page');
    btn.addEventListener('click', function () {
      var on = D.body.classList.toggle('rcpt-on');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.querySelector('[data-r="label"]').textContent = on ? 'Hide the receipts' : 'Show the receipts';
    });
    row.appendChild(btn);
    row.appendChild(note);
    return row;
  }

  function run(all) {
    var here = pageBasename();
    var mine = all.filter(function (r) { return r.page === here; });
    if (!mine.length) return;
    if (!W.SymbiQ || !W.SymbiQ.sig) return;

    var wired = 0;
    mine.forEach(function (r) {
      var span = D.querySelector('.rcpt[data-rcpt="' + r.id + '"]');
      if (!span) return;
      wireTrigger(span, buildHtml(r));
      wired++;
    });
    if (!wired) return;

    var h1 = D.querySelector('.wrap h1');
    if (!h1) return;
    var row = buildToggle(wired);
    h1.insertAdjacentElement('afterend', row);
  }

  function boot() {
    try {
      fetch('data/receipts.json').then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (data) {
        if (!data || !data.receipts) return;
        run(data.receipts);
      }).catch(function () {});
    } catch (e) {}
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
