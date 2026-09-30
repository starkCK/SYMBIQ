(function () {
  'use strict';
  var D = document;

  function bindDoors() {
    var doors = [].slice.call(D.querySelectorAll('.introute-card[data-track]'));
    if (!doors.length) return;
    doors.forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var track = card.getAttribute('data-track');
        if (!track) return;
        try { sessionStorage.setItem('sq-vt-door', track + ':' + Date.now()); } catch (er) {}
        try { card.style.viewTransitionName = 'sq-door-' + track; } catch (er2) {}
      });
    });
  }

  try { bindDoors(); } catch (e) {}
})();
