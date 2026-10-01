(function () {
  'use strict';
  var D = document;
  if (!D.body || !D.body.hasAttribute('data-home')) return;
  var core = (window.SymbiQ && window.SymbiQ.core) || {};
  function editable(el) { return core.editable ? core.editable(el) : false; }

  var ov = null, last = null;
  function build() {
    ov = D.createElement('div');
    ov.className = 'sqov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Order-finding, by hand');
    ov.innerHTML =
      '<div class="sqov-card" tabindex="-1">' +
        '<h2>Order-finding, by hand</h2>' +
        '<p class="lede">Take <b>N = 15</b> and a number with no factor in common with it, <b>a = 7</b>. ' +
        'Multiply 7 by itself, modulo 15, until you come back to 1.</p>' +
        '<table class="sqov-work"><thead><tr><th>power</th><th>value</th><th>mod 15</th></tr></thead><tbody>' +
          '<tr><td>7¹</td><td>7</td><td class="n">7</td></tr>' +
          '<tr><td>7²</td><td>49</td><td class="n">4</td></tr>' +
          '<tr><td>7³</td><td>343</td><td class="n">13</td></tr>' +
          '<tr class="hit"><td>7⁴</td><td>2401</td><td class="n">1</td></tr>' +
        '</tbody></table>' +
        '<p>It closes at the fourth step, so the <b>period r = 4</b>. Because r is even, ' +
        '7<sup>r/2</sup> = 7² = 49 sits one step either side of a multiple of 15, and the ' +
        'two factors fall out of a schoolbook algorithm:</p>' +
        '<p><b>gcd(49 − 1, 15) = gcd(48, 15) = 3</b><br><b>gcd(49 + 1, 15) = gcd(50, 15) = 5</b><br>and 3 × 5 = 15.</p>' +
        '<p>Everything you just read is classical. <b>Only the period-finding step is quantum</b>: ' +
        'the rest is multiplication and Euclid. That is why the cost estimates for breaking Bitcoin move so far when ' +
        'somebody finds a cheaper way to run one subroutine: the attack is mostly ordinary arithmetic wrapped around ' +
        'a single quantum kernel.</p>' +
        '<button type="button" class="sqov-shut">Close</button>' +
      '</div>';
    D.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
    ov.querySelector('.sqov-shut').addEventListener('click', shut);
  }
  function isOpen() { return !!ov && ov.hasAttribute('data-open'); }
  function shut() {
    if (!isOpen()) return false;
    ov.removeAttribute('data-open');
    if (last && last.focus) { try { last.focus(); } catch (e) { } }
    return true;
  }
  function show() {
    if (!ov) build();
    last = D.activeElement;
    ov.setAttribute('data-open', '');
    ov.querySelector('.sqov-card').focus();
  }

  var buf = '';
  D.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (editable(e.target) || editable(D.activeElement)) return;
    var k = e.key;
    if (k === 'Escape') { if (shut()) { e.preventDefault(); e.stopPropagation(); } return; }
    if (k === 'm') { e.preventDefault(); return; }
    if (k && k.length === 1) {
      buf = (buf + k).slice(-4);
      if (buf === '2357') { buf = ''; e.preventDefault(); e.stopPropagation(); show(); }
    }
  }, true);
})();
