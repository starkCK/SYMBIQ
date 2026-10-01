(function () {
  'use strict';
  var W = window, D = document;

  var RATE = {
    name:      ['Name only', 1, 'The word is real. The physics in the scene is not.'],
    seed:      ['Real seed', 2, 'One true idea sits underneath. Everything built on it is invented.'],
    stretched: ['Stretched', 3, 'The mechanism is real, and the scene pushes it past what it does.'],
    faithful:  ['Faithful',  4, 'A working physicist would nod.']
  };
  function mk(tag, cls, text) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  function safePage(p, a) {
    if (!/^[a-z0-9_-]+\.html$/i.test(p || '')) return null;
    return p + (a && /^[\w-]+$/.test(a) ? '#' + a : '');
  }

  function buildDiscover() {
    var day = Math.floor(Date.now() / 864e5);
    var rc = D.getElementById('dc-reality'), tm = D.getElementById('dc-term');

    if (rc) getJSON('data/reality.json').then(function (d) {
      var cards = (d.cards || []).filter(function (c) {
        return RATE.hasOwnProperty(c.rating) && /^[\w-]+$/.test(c.slug || '');
      });
      if (!cards.length) return;
      var i = day % cards.length;
      var show = function (refocus) {
        var c = cards[i], r = RATE[c.rating];
        rc.textContent = '';
        rc.appendChild(mk('span', 'dc-eyebrow', 'Reality Check · ' + c.kind));
        rc.appendChild(mk('p', 'dc-title', c.title));
        var meta = mk('div', 'dc-meta'), m = mk('span', 'dc-meter');
        m.setAttribute('aria-hidden', 'true');
        for (var k = 1; k <= 4; k++) m.appendChild(mk('i', k <= r[1] ? 'on' : ''));
        meta.appendChild(m);
        meta.appendChild(mk('b', '', r[0] + ' (' + r[1] + ' of 4)'));
        rc.appendChild(meta);
        rc.appendChild(mk('p', 'dc-body', r[2]));
        var row = mk('div', 'dc-row'), a = mk('a', 'dc-link', 'Read the full card →');
        a.href = 'reality.html#' + c.slug;
        row.appendChild(a);
        if (cards.length > 1) {
          var b = mk('button', 'dc-again', 'Another one');
          b.type = 'button';
          b.addEventListener('click', function () { i = (i + 1) % cards.length; show(true); });
          row.appendChild(b);
        }
        rc.appendChild(row);
        if (refocus) { var nb = rc.querySelector('.dc-again'); if (nb) nb.focus(); }
      };
      show(false);
      if (W.SymbiQ && W.SymbiQ.pre) W.SymbiQ.pre('dc-reality', rc.innerHTML);
    }).catch(function () {});

    if (tm) getJSON('data/concepts.json').then(function (d) {
      var list = (d.concepts || []).filter(function (c) {
        return c.kind === 'concept' && c.blurb && c.term && safePage(c.page, c.anchor);
      });
      if (!list.length) return;
      var c = list[day % list.length];
      tm.textContent = '';
      tm.appendChild(mk('span', 'dc-eyebrow', 'Term of the day'));
      tm.appendChild(mk('p', 'dc-title', c.term));
      tm.appendChild(mk('p', 'dc-body', c.blurb));
      var row = mk('div', 'dc-row'), a = mk('a', 'dc-link', 'Where it is taught →');
      a.href = safePage(c.page, c.anchor);
      row.appendChild(a);
      var g = mk('a', 'dc-link', 'All terms');
      g.href = 'glossary.html';
      row.appendChild(g);
      tm.appendChild(row);
      if (W.SymbiQ && W.SymbiQ.pre) W.SymbiQ.pre('dc-term', tm.innerHTML);
    }).catch(function () {});
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', buildDiscover);
  else buildDiscover();
})();
