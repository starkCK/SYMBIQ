(function () {
  'use strict';

  if (!document.body || !document.body.hasAttribute('data-glass')) return;

  var reduce = false;
  try {
    reduce = window.SymbiQ.core.reduced();
  } catch (e) { }

  try {
    var root = document.documentElement;
    var ticking = false;
    var on = false;

    var evaluate = function () {
      ticking = false;
      var y = window.pageYOffset || root.scrollTop || 0;
      if (!on && y > 40) { on = true; root.setAttribute('data-scrolled', ''); }
      else if (on && y < 24) { on = false; root.removeAttribute('data-scrolled'); }
    };

    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(evaluate);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    evaluate();
  } catch (e) { }

  if (!reduce) try {
    var nav = document.querySelector('nav:not(.rung-rail)');
    if (nav) {
      var navTick = false;
      var mx = 50, my = -20;

      var paint = function () {
        navTick = false;
        nav.style.setProperty('--dyn-x', mx + '%');
        nav.style.setProperty('--dyn-y', my + '%');
      };

      nav.addEventListener('pointermove', function (ev) {
        var w = window.innerWidth || 1;
        var h = window.innerHeight || 1;
        mx = (ev.clientX / w) * 100;
        my = (ev.clientY / h) * 100;
        if (navTick) return;
        navTick = true;
        window.requestAnimationFrame(paint);
      }, { passive: true });

      nav.addEventListener('pointerleave', function () {
        nav.style.removeProperty('--dyn-x');
        nav.style.removeProperty('--dyn-y');
      });
    }
  } catch (e) { }

  try {
    var fine = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (fine && window.innerWidth >= 720) {
      var menus = [].slice.call(document.querySelectorAll('.navcat'));

      menus.forEach(function (cat) {
        if (cat.classList.contains('sq-account')) return;
        var shutT;

        cat.addEventListener('pointerenter', function (ev) {
          if (ev.pointerType === 'touch') return;
          window.clearTimeout(shutT);
          if (!cat.open) cat.open = true;
        });

        cat.addEventListener('pointerleave', function (ev) {
          if (ev.pointerType === 'touch') return;
          window.clearTimeout(shutT);
          shutT = window.setTimeout(function () {
            if (!cat.contains(document.activeElement)) cat.open = false;
          }, 220);
        });
      });
    }
  } catch (e) { }

})();
