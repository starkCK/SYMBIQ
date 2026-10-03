(function () {
  'use strict';
  var W = window, D = document, S = (W.SymbiQ = W.SymbiQ || {}), C = S.core;
  if (!C || S.play) return;
  var tag = D.getElementById('play-src');
  if (!tag) return;

  var api = function (mode, opts) {
    return C.loadScript(tag.src).then(function () { return S.play.start(mode, opts); }, function (e) { try { W.console.warn('SymbiQ play layer failed to load', e); } catch (x) { } });
  };
  S.play = api;

  var DOTS = [
    '.sqp-dots{display:inline-flex;align-items:center;vertical-align:middle;margin-left:10px;gap:2px}',
    '.sqp-dot{width:48px;height:48px;border:0;padding:0;background:transparent;display:inline-grid;place-items:center;cursor:pointer;opacity:.85}',
    '.sqp-dot i{width:16px;height:16px;border-radius:50%;display:block;background:radial-gradient(circle at 35% 30%,#fff 0,currentColor 55%);box-shadow:0 0 6px currentColor;transition:transform .25s,box-shadow .25s;animation:sqpbreathe 3.2s ease-in-out infinite}',
    '.sqp-dot.d i{animation-delay:1.6s}',
    '.sqp-dot.n{color:#a78bfa}.sqp-dot.d{color:#2dd4bf}',
    '.sqp-dot:hover,.sqp-dot:focus-visible{opacity:1}',
    '.sqp-dot:hover i,.sqp-dot:focus-visible i{transform:scale(1.7);animation:none;box-shadow:0 0 10px currentColor,0 0 26px currentColor,0 0 48px currentColor}',
    '.sqp-dot:focus-visible{outline:2px solid currentColor;outline-offset:-6px;border-radius:50%}',
    '@keyframes sqpbreathe{0%,100%{box-shadow:0 0 4px currentColor;transform:scale(1)}50%{box-shadow:0 0 14px currentColor,0 0 28px currentColor;transform:scale(1.18)}}',
    '@media (prefers-reduced-motion:reduce){.sqp-dot i{animation:none}}',
    '#qz-pill{transition:box-shadow .3s}#qz-pill:hover{box-shadow:0 0 0 1px rgba(167,139,250,.6),0 0 16px rgba(167,139,250,.55),0 0 30px rgba(45,212,191,.4)}'
  ].join('\n');
  var DOOR = [
    '.sqp-bg{position:fixed;inset:0;z-index:2147482290;background:transparent}',
    '.sqp-door{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147482300;width:min(430px,calc(100vw - 24px));padding:18px 20px;border-radius:18px;background:rgba(9,13,24,.97);border:1px solid rgba(255,255,255,.2);color:#e8ecf6;font:500 14px/1.5 Inter,"Segoe UI",system-ui,sans-serif;box-shadow:0 20px 80px rgba(0,0,0,.6)}',
    '.sqp-door h3{margin:0 0 6px;font-size:17px;color:#fff}.sqp-door p{margin:0 0 10px;color:#cfd6e6}.sqp-door .sqp-fine{font-size:12.5px;color:#9aa5bd}',
    '.sqp-door .sqp-row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}',
    '.sqp-door .sqp-row button{flex:1 1 150px;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;font:600 14px/1.2 Inter,"Segoe UI",system-ui,sans-serif;cursor:pointer;padding:6px 10px}',
    '.sqp-door .sqp-row button small{display:block;font:500 11.5px/1.3 Inter,"Segoe UI",system-ui,sans-serif;color:#aeb8ce;margin-top:2px}',
    '.sqp-door .sqp-row button.n{border-color:#a78bfa}.sqp-door .sqp-row button.d{border-color:#2dd4bf}',
    '.sqp-door .sqp-row button:hover,.sqp-door .sqp-row button:focus-visible{background:rgba(255,255,255,.14);outline:none}',
    '.sqp-door .sqp-x{position:absolute;right:8px;top:8px;width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;cursor:pointer}',
    '.sqp-door button:focus-visible{outline:2px solid #fff;outline-offset:2px}'
  ].join('\n');
  function css(id, text) { if (D.getElementById(id)) return; var s = D.createElement('style'); s.id = id; s.textContent = text; D.head.appendChild(s); }

  var prev = null;
  function closeDoor(restore) {
    var d = D.querySelector('.sqp-door'), bg = D.querySelector('.sqp-bg');
    if (bg) bg.remove();
    if (d) { d.remove(); D.removeEventListener('keydown', onKey, true); }
    if (restore && prev && prev.focus && D.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) { } }
    prev = null;
  }
  function onKey(e) {
    var d = D.querySelector('.sqp-door'); if (!d) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeDoor(true); return; }
    if (e.key === 'Tab') {
      var f = d.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && D.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && D.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!d.contains(D.activeElement)) { e.preventDefault(); first.focus(); }
    }
  }
  function go(mode, room) { closeDoor(false); api(mode, room ? { room: room } : undefined); }
  function openDoor(room) {
    css('sqp-door-css', DOOR);
    var keep = prev || D.activeElement; closeDoor(false); prev = keep;
    var bg = D.createElement('div'); bg.className = 'sqp-bg'; bg.addEventListener('click', function () { closeDoor(true); }); D.body.appendChild(bg);
    var d = D.createElement('div'); d.className = 'sqp-door'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Play with this page');
    var code = room ? C.esc(room) : '';
    d.innerHTML = '<button type="button" class="sqp-x" aria-label="Close">✕</button><h3>' + (room ? 'A room is open' : 'Two ways to play with this page') + '</h3>' +
      '<p>' + (room ? 'Room <b>' + code + '</b>, in another window of this browser. Pick a side and you will see their cursor and their effects on this same page.' : 'The page is a fragile logical qubit. One of you gives it errors, the other one fixes them.') + '</p>' +
      '<div class="sqp-row"><button type="button" class="n" data-m="noise">Be the Noise<small>break things, physically</small></button><button type="button" class="d" data-m="decoder">Be the Decoder<small>mend, shield, draw</small></button></div>' +
      '<p class="sqp-fine">Nothing is deleted: the effects are temporary styles plus a layer drawn over the page, and Esc puts everything back. ' + (room ? 'Picking a side here joins that room. ' : '') + 'Nothing is sent anywhere; a room connects windows of this browser.</p>';
    D.body.appendChild(d);
    d.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.classList.contains('sqp-x')) closeDoor(true); else go(b.getAttribute('data-m'), room); });
    D.addEventListener('keydown', onKey, true);
    var f = d.querySelector('button[data-m]'); if (f) f.focus();
  }
  S.play.door = openDoor;

  function boot() {
    var foot = D.querySelector('footer');
    if (foot && !foot.querySelector('.sqp-dots')) {
      css('sqp-dots-css', DOTS);
      var w = D.createElement('span'); w.className = 'sqp-dots';
      w.innerHTML = '<button type="button" class="sqp-dot n" aria-label="Play as the Noise"><i></i></button><button type="button" class="sqp-dot d" aria-label="Play as the Decoder"><i></i></button>';
      w.addEventListener('click', function (e) { var b = e.target.closest('.sqp-dot'); if (b) api(b.classList.contains('n') ? 'noise' : 'decoder'); });
      foot.appendChild(w);
    }
    D.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href$="#play-noise"]');
      if (a) { e.preventDefault(); openDoor(); }
    });
    var n = 0, t = 0;
    D.addEventListener('click', function (e) {
      if (!e.target.closest || !e.target.closest('#qz-pill')) return;
      var now = Date.now(); n = now - t < 900 ? n + 1 : 1; t = now;
      if (n >= 2) { n = 0; openDoor(); }
    });
    try { W.console.info('%cSymbiQ%c There is a way to play with this page: SymbiQ.play("noise") or SymbiQ.play("decoder"). Nothing is ever deleted, and Esc puts it all back.', 'background:#8b5cf6;color:#fff;padding:2px 6px;border-radius:4px', 'color:inherit'); } catch (e) { }
    var m = /[?&]play=([A-Za-z]{4}-?\d{2})\b/.exec(W.location.search);
    if (m) { var code = m[1].toUpperCase().replace(/^([A-Z]{4})-?(\d{2})$/, '$1-$2'); openDoor(code); }
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
