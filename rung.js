(function () {
  try {
    var body = document.body;
    var rung = body.getAttribute('data-rung');
    if (!rung) return;

    var RUNGS = [
      { id: 'L0', label: 'the circuit',     href: 'circuits.html' },
      { id: 'L1', label: 'the qubit',       href: 'quantum-mechanics.html' },
      { id: 'L2', label: 'what makes it survive', href: 'qec.html' },
      { id: 'L3', label: 'the algorithm',   href: 'phase-kickback.html' },
      { id: 'L4', label: 'the consequence', href: 'pqc.html' }
    ];
    var FORK = { label: 'the fork, coupled circuits instead', href: 'analog.html' };

    var h1 = document.querySelector('h1');
    if (!h1) return;
    if (document.querySelector('nav.rung-rail')) return;
    var anchor = h1.nextElementSibling;
    if (!(anchor && anchor.classList && anchor.classList.contains('tagline'))) anchor = h1;
    var isFork = (rung === 'FORK');

    var nav = document.createElement('nav');
    nav.className = 'rung-rail';
    nav.setAttribute('aria-label', "Where this page sits on SymbiQ's ladder, from the circuit to the consequence");

    var html = '<span class="rung-rail-lab">The Ladder</span><span class="rung-rail-track">';
    RUNGS.forEach(function (r, i) {
      var cur = (!isFork && r.id === rung);
      html += '<a href="' + r.href + '" class="rung-dot' + (cur ? ' is-cur' : '') + '" title="' +
              r.id + ', ' + r.label + '"' + (cur ? ' aria-current="page"' : '') + '>' +
              '<span aria-hidden="true">' + r.id + '</span><span class="rung-sr">' + r.label + '</span></a>';
      if (i < RUNGS.length - 1) html += '<span class="rung-seg" aria-hidden="true"></span>';
    });
    html += '</span>';
    html += '<a href="' + FORK.href + '" class="rung-fork' + (isFork ? ' is-cur' : '') +
            '"' + (isFork ? ' aria-current="page"' : '') + '>⑂ ' + FORK.label + '</a>';
    nav.innerHTML = html;

    anchor.parentNode.insertBefore(nav, anchor.nextSibling);
  } catch (e) { }
})();
