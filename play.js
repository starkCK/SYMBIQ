(function () {
  'use strict';
  var W = window, D = document, S = (W.SymbiQ = W.SymbiQ || {}), C = S.core || {};
  if (S.play && S.play.__ready) return;
  var stub = typeof S.play === 'function' ? S.play : null;

  var TAU = Math.PI * 2, hypot = Math.hypot;
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function reduced() { return !!(C.reduced && C.reduced()); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fnv(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); }
  function $(sel, root) { return (root || D).querySelector(sel); }
  var esc = C.esc || function (v) { return String(v).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  function el(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var LS = 'symbiq_play_v1';
  var stats = { v: 1, un: { n: 1, d: 1 }, hits: 0, repairs: 0, minF: 1, ruined: 0, mended: 0, sound: false, seen: false, bestStorm: 0 };
  (function loadStats() {
    try { var raw = C.store ? C.store.get(LS) : W.localStorage.getItem(LS); if (raw) { var o = JSON.parse(raw); if (o && o.v === 1) { for (var k in stats) if (Object.prototype.hasOwnProperty.call(o, k)) stats[k] = o[k]; } } } catch (e) { }
    ['hits', 'repairs', 'ruined', 'mended', 'bestStorm'].forEach(function (k) { var v = +stats[k]; stats[k] = isFinite(v) && v > 0 ? Math.floor(v) : 0; });
    var m = +stats.minF; stats.minF = isFinite(m) ? clamp(m, 0, 1) : 1; stats.sound = stats.sound === true; stats.seen = stats.seen === true;
    var u = stats.un && typeof stats.un === 'object' ? stats.un : {};
    stats.un = { n: clamp(Math.floor(+u.n) || 1, 1, 5), d: clamp(Math.floor(+u.d) || 1, 1, 5) };
  })();
  var saveTimer = 0;
  function writeStats() { saveTimer = 0; try { var s = JSON.stringify(stats); if (C.store) C.store.set(LS, s); else W.localStorage.setItem(LS, s); } catch (e) { } }
  function saveStats() { if (!saveTimer) saveTimer = W.setTimeout(writeStats, 400); }
  function flushStats() { if (saveTimer) { W.clearTimeout(saveTimer); writeStats(); } }

  var COL = { noise: '#a78bfa', dec: '#2dd4bf', amber: '#facc15', red: '#f87171', ink: '#e8ecf6' };

  var CSS = [
    '[data-sqp]{transition:none!important}',
    '[data-sqp~="m"]{-webkit-mask-image:var(--sqp-mask);mask-image:var(--sqp-mask);-webkit-mask-composite:source-in;mask-composite:intersect}',
    '[data-sqp~="x"]{rotate:var(--sqp-rot,180deg)}',
    '[data-sqp~="z"]{filter:invert(var(--sqp-inv,1)) hue-rotate(calc(var(--sqp-inv,1)*180deg))!important}',
    '[data-sqp~="g"]{visibility:hidden!important}',
    '[data-sqp~="f"]{opacity:var(--sqp-fade,1)!important}',
    '[data-sqp~="j"]{translate:var(--sqp-jx,0) var(--sqp-jy,0)}',
    '[data-sqp~="c"]{text-shadow:var(--sqp-ghost,none)!important}',
    '#sqp-fx{position:fixed;inset:0;width:100%;height:100%;z-index:2147482000;pointer-events:none}',
    '#sqp-input{position:fixed;inset:0;z-index:2147482100;cursor:none;touch-action:pan-y pinch-zoom;-webkit-tap-highlight-color:transparent}',
    '#sqp-input.sqp-off{pointer-events:none;cursor:auto}',
    '#sqp-root{position:fixed;inset:0;z-index:2147482200;pointer-events:none;font:500 14px/1.4 Inter,"Segoe UI",system-ui,sans-serif;color:#e8ecf6}',
    '#sqp-root *{box-sizing:border-box}',
    '#sqp-root button{font:inherit;color:inherit;cursor:pointer}',
    '.sqp-bar:focus{outline:none}',
    '.sqp-bar{position:absolute;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:16px;background:rgba(9,13,24,.9);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(10px);pointer-events:auto;max-width:calc(100vw - 16px);box-shadow:0 10px 40px rgba(0,0,0,.45)}',
    '.sqp-f{display:flex;flex-direction:column;gap:3px;min-width:104px}',
    '.sqp-f b{font-size:15px;font-variant-numeric:tabular-nums;line-height:1}',
    '.sqp-f span{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#9aa5bd}',
    '.sqp-fb{height:6px;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}',
    '.sqp-fb i{display:block;height:100%;width:100%;border-radius:4px;background:linear-gradient(90deg,#a78bfa,#2dd4bf);transform-origin:left;transition:transform .2s}',
    '.sqp-tools{display:flex;gap:6px}',
    '.sqp-t{position:relative;width:46px;height:46px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);display:grid;place-items:center;padding:0}',
    '.sqp-t svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.sqp-t kbd{position:absolute;right:4px;bottom:2px;font:600 9px/1 Inter,system-ui,sans-serif;opacity:.65}',
    '.sqp-t[aria-pressed="true"]{border-color:var(--sqp-c,#a78bfa);background:color-mix(in srgb,var(--sqp-c,#a78bfa) 22%,transparent);color:#fff}',
    '.sqp-t:disabled{opacity:.32;cursor:not-allowed}',
    '.sqp-t:disabled::after{content:"\\1F512";position:absolute;top:2px;left:4px;font-size:9px}',
    '.sqp-a{display:flex;gap:6px}',
    '.sqp-b{min-width:46px;height:46px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;white-space:nowrap}',
    '.sqp-b:hover,.sqp-t:hover:not(:disabled){border-color:rgba(255,255,255,.4)}',
    '.sqp-b:focus-visible,.sqp-t:focus-visible,.sqp-x:focus-visible{outline:2px solid #fff;outline-offset:2px}',
    '.sqp-b svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
    '.sqp-b.sqp-me{border-color:var(--sqp-c,#a78bfa);background:color-mix(in srgb,var(--sqp-c,#a78bfa) 18%,transparent)}',
    '.sqp-toast{position:absolute;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);max-width:min(560px,calc(100vw - 24px));padding:10px 16px;border-radius:14px;background:rgba(9,13,24,.92);border:1px solid rgba(255,255,255,.16);text-align:center;opacity:0;transition:opacity .25s;pointer-events:none;font-size:14px}',
    '.sqp-toast.on{opacity:1}',
    '.sqp-toast b{color:var(--sqp-c,#a78bfa)}',
    '.sqp-roster{position:absolute;right:12px;top:calc(env(safe-area-inset-top) + 88px);display:flex;flex-direction:column;gap:5px;align-items:flex-end;pointer-events:none}',
    '.sqp-p{padding:3px 10px;border-radius:999px;background:rgba(9,13,24,.85);border:1px solid rgba(255,255,255,.16);font-size:12px;display:inline-flex;gap:6px;align-items:center}',
    '.sqp-p i{width:8px;height:8px;border-radius:50%;display:inline-block}',
    '.sqp-timer{padding:4px 12px;border-radius:999px;background:rgba(9,13,24,.9);border:1px solid rgba(255,255,255,.2);font-variant-numeric:tabular-nums;font-size:13px}',
    '.sqp-panel{position:absolute;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 66px);transform:translateX(-50%);width:min(560px,calc(100vw - 16px));max-height:min(70vh,560px);overflow:auto;padding:16px 18px;border-radius:16px;background:rgba(9,13,24,.96);border:1px solid rgba(255,255,255,.18);pointer-events:auto;box-shadow:0 10px 50px rgba(0,0,0,.55)}',
    '.sqp-panel h3{margin:0 0 6px;font-size:15px}',
    '.sqp-panel h4{margin:14px 0 4px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#9aa5bd}',
    '.sqp-panel p,.sqp-panel li{margin:0 0 6px;font-size:13.5px;color:#cfd6e6}',
    '.sqp-panel ul{margin:0;padding-left:18px}',
    '.sqp-panel kbd{font:600 11px/1 Inter,system-ui,sans-serif;padding:1px 5px;border-radius:5px;border:1px solid rgba(255,255,255,.3)}',
    '.sqp-x{position:absolute;right:8px;top:8px;width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent}',
    '.sqp-row{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0}',
    '.sqp-row input{min-height:40px;padding:4px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff;font:inherit;text-transform:uppercase;width:120px}',
    '.sqp-note{font-size:12.5px!important;color:#9aa5bd!important}',
    '.sqp-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    '#sqp-root.sqp-hud-off .sqp-bar,#sqp-root.sqp-hud-off .sqp-roster,#sqp-root.sqp-hud-off .sqp-toast,#sqp-root.sqp-hud-off .sqp-panel{display:none}',
    '.sqp-peek{position:absolute;right:10px;bottom:10px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(9,13,24,.7);pointer-events:auto;display:none}',
    '#sqp-root.sqp-hud-off .sqp-peek{display:block}',
    '@media (max-width:640px){.sqp-bar{flex-wrap:wrap;justify-content:center;gap:6px;padding:6px}.sqp-f{min-width:0;width:100%;flex-direction:row;align-items:center;gap:8px}.sqp-fb{flex:1}.sqp-lbl{display:none}.sqp-t{width:42px;height:42px}.sqp-b{min-width:42px;height:42px;padding:0 8px}.sqp-b span{display:none}.sqp-roster{top:calc(env(safe-area-inset-top) + 64px)}}'
  ].join('\n');
  function injectCSS() {
    if ($('#sqp-css')) return;
    var st = el('style'); st.id = 'sqp-css'; st.textContent = CSS; D.head.appendChild(st);
  }

  var CAND = /^(P|LI|H1|H2|H3|H4|H5|H6|A|BUTTON|IMG|SVG|CANVAS|FIGURE|FIGCAPTION|TABLE|TR|TD|TH|LABEL|SUMMARY|DETAILS|BLOCKQUOTE|PRE|SECTION|ARTICLE|ASIDE|DIV|FOOTER|HEADER|UL|OL|DL|DT|DD|FORM|INPUT|SELECT|TEXTAREA|NAV|SPAN)$/;
  function inOurs(e) { return !!(e.closest && e.closest('#sqp-root,#sqp-fx,#sqp-input,.sqp-door,[data-sqp-ignore]')); }
  function qualifies(e) {
    if (!e || e.nodeType !== 1 || !CAND.test(e.tagName) || inOurs(e)) return false;
    var r = e.getBoundingClientRect(), vw = W.innerWidth, vh = W.innerHeight;
    if (r.width < 14 || r.height < 8 || r.width * r.height < 320) return false;
    if (r.width > vw * 0.985 && r.height > vh * 0.55) return false;
    if (r.width * r.height > vw * vh * 0.7) return false;
    var cs = W.getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false;
    if (e.tagName === 'SPAN' && cs.display === 'inline') return false;
    return true;
  }
  function blockOf(e) {
    while (e && e !== D.body && e !== D.documentElement) {
      if (CAND.test(e.tagName)) { var d = W.getComputedStyle(e).display; if (d !== 'inline' && d !== 'contents') return e; }
      e = e.parentElement;
    }
    return null;
  }
  function targetAt(x, y) {
    var st = D.elementsFromPoint(x, y);
    for (var i = 0; i < st.length; i++) {
      var b = blockOf(st[i]); if (b && qualifies(b)) return b;
    }
    return null;
  }
  function targetsIn(x, y, R, cap) {
    var out = [], seen = new Set(), pts = [[x, y]];
    if (R > 6) { var n = R > 60 ? 12 : 8; for (var i = 0; i < n; i++) { var a = i / n * TAU; pts.push([x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8]); if (R > 70) pts.push([x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.4]); } }
    for (var k = 0; k < pts.length && out.length < (cap || 14); k++) {
      var px = pts[k][0]; if (px < 0 || px > W.innerWidth || pts[k][1] < 0 || pts[k][1] > W.innerHeight) continue;
      var st = D.elementsFromPoint(px, pts[k][1]);
      for (var j = 0; j < st.length; j++) { var b = blockOf(st[j]); if (b && !seen.has(b) && qualifies(b)) { seen.add(b); out.push(b); } }
    }
    return out;
  }

  function headText(e) {
    var out = '', w = D.createTreeWalker(e, NodeFilter.SHOW_TEXT, null), n, guard = 0;
    while (out.length < 60 && guard++ < 40 && (n = w.nextNode())) { var v = n.nodeValue; if (v && !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentNode.nodeName)) out += ' ' + v; }
    return out.replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  function sigOf(e) {
    var c = e.id || (typeof e.className === 'string' ? (e.className.split(/\s+/)[0] || '') : '');
    return e.tagName + '|' + headText(e) + '|' + c;
  }
  var idx = { map: null, dirty: true, at: -1e9 };
  var mo = W.MutationObserver ? new W.MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) { var t = ms[i].target; if (t && t.nodeType === 1 && !inOurs(t) && !(t.getAttribute && t.getAttribute('data-sqp') != null && ms[i].type === 'attributes')) { idx.dirty = true; return; } }
  }) : null;
  function buildIndex() {
    var m = Object.create(null), all = D.body.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,a,button,img,svg,canvas,figure,figcaption,table,tr,td,th,label,summary,details,blockquote,pre,section,article,aside,div,footer,header,ul,ol,dl,dt,dd,form,input,select,textarea,nav,span');
    for (var i = 0; i < all.length; i++) { var e = all[i]; if (inOurs(e)) continue; var k = fnv(sigOf(e)); (m[k] || (m[k] = [])).push(e); }
    idx.map = m; idx.dirty = false; idx.at = performance.now();
  }
  function ensureIndex(miss) {
    if (!idx.map || ((idx.dirty || miss) && performance.now() - idx.at > 300)) buildIndex();
  }
  function eidOf(e) {
    ensureIndex(false);
    var k = fnv(sigOf(e)), l = idx.map[k], i = l ? l.indexOf(e) : -1;
    if (i < 0) { ensureIndex(true); l = idx.map[k]; i = l ? l.indexOf(e) : -1; }
    return i < 0 ? null : k + '.' + i;
  }
  function elOf(eid) {
    if (typeof eid !== 'string') return null;
    ensureIndex(false);
    var p = eid.split('.'), l = idx.map[p[0]];
    if (!l) { ensureIndex(true); l = idx.map[p[0]]; }
    var e = l && l[+p[1]]; return e && e.isConnected ? e : null;
  }


  var recs = new Map();
  var MAXHOLES = 22;
  var VARS = ['--sqp-mask', '--sqp-rot', '--sqp-inv', '--sqp-fade', '--sqp-jx', '--sqp-jy', '--sqp-ghost'];

  function recOf(e, make) {
    var r = recs.get(e);
    if (!r && make) {
      r = { el: e, eid: null, holes: [], x: 0, xa: 0, z: 0, za: 0, g: 0, fa: 1, patch: null, link: null, jit: 0, jx: 0, jy: 0, ghost: 0, dirty: true, w: 0, h: 0,
            hadStyle: e.hasAttribute('style'), origStyle: e.getAttribute('style'), origSqp: e.getAttribute('data-sqp') };
      recs.set(e, r);
    }
    return r;
  }
  function measure(r) { var e = r.el; r.w = e.offsetWidth || e.getBoundingClientRect().width; r.h = e.offsetHeight || e.getBoundingClientRect().height; }
  function isEmpty(r) { return !r.holes.length && !r.x && !r.z && !r.g && r.xa < 0.002 && r.za < 0.002 && r.fa > 0.998 && !r.patch && !r.link && !r.jit && !r.ghost; }

  function applyRec(r) {
    var e = r.el;
    if (!e.isConnected) return false;
    measure(r);
    var parts = [], i;
    for (i = 0; i < r.holes.length; i++) {
      var o = r.holes[i], rad = o.r * o.s; if (rad < 0.6) continue;
      parts.push('radial-gradient(circle at ' + (o.u * r.w).toFixed(1) + 'px ' + (o.v * r.h).toFixed(1) + 'px,transparent 0,transparent ' + rad.toFixed(1) + 'px,#000 ' + (rad + 2.5).toFixed(1) + 'px)');
    }
    var f = [];
    if (parts.length) { f.push('m'); e.style.setProperty('--sqp-mask', parts.join(',')); } else e.style.removeProperty('--sqp-mask');
    if (r.xa > 0.002) { f.push('x'); e.style.setProperty('--sqp-rot', (r.xa * 180).toFixed(1) + 'deg'); } else e.style.removeProperty('--sqp-rot');
    if (r.za > 0.002) { f.push('z'); e.style.setProperty('--sqp-inv', r.za.toFixed(3)); } else e.style.removeProperty('--sqp-inv');
    if (r.g && r.fa <= 0.002) f.push('g');
    if (r.fa < 0.998 && r.fa > 0.002) { f.push('f'); e.style.setProperty('--sqp-fade', r.fa.toFixed(3)); } else e.style.removeProperty('--sqp-fade');
    if (r.jit) { f.push('j'); e.style.setProperty('--sqp-jx', r.jx.toFixed(1) + 'px'); e.style.setProperty('--sqp-jy', r.jy.toFixed(1) + 'px'); } else { e.style.removeProperty('--sqp-jx'); e.style.removeProperty('--sqp-jy'); }
    if (r.ghost) { f.push('c'); e.style.setProperty('--sqp-ghost', r.ghost + 'px 0 rgba(255,60,110,.6),' + (-r.ghost) + 'px 0 rgba(60,220,255,.6)'); } else e.style.removeProperty('--sqp-ghost');
    if (f.length) e.setAttribute('data-sqp', f.join(' ')); else if (r.origSqp == null) e.removeAttribute('data-sqp');
    r.dirty = false;
    return true;
  }
  function clearRec(r) {
    var e = r.el; if (!e) return;
    for (var i = 0; i < VARS.length; i++) e.style.removeProperty(VARS[i]);
    if (r.origSqp == null) e.removeAttribute('data-sqp'); else e.setAttribute('data-sqp', r.origSqp);
    if (!r.hadStyle && e.getAttribute('style') === '') e.removeAttribute('style');
  }
  function dropRec(r) { clearRec(r); recs.delete(r.el); if (r.link && r.link.link === r) r.link.link = null; }

  function coverage(r) { measure(r); var A = Math.max(1, r.w * r.h), s = 0; for (var i = 0; i < r.holes.length; i++) { var o = r.holes[i]; s += Math.PI * o.r * o.r * (o.cl ? 0 : 1); } return Math.min(1, s / A); }
  function addHole(r, u, v, rad) {
    measure(r);
    for (var i = 0; i < r.holes.length; i++) {
      var o = r.holes[i], d = hypot((o.u - u) * r.w, (o.v - v) * r.h);
      if (!o.cl && d < Math.max(o.r, rad) * 0.5) { o.r = Math.min(260, Math.max(o.r, d + Math.min(o.r, rad) * 0.9, rad)); o.s = Math.max(o.s, 0.5); return o; }
    }
    var n = { u: u, v: v, r: Math.min(rad, 260), s: 0.35, cl: 0 }; r.holes.push(n); return n;
  }

  function areaOfPage() {
    var w = $('.wrap'), rc = (w || D.body).getBoundingClientRect(), vw = W.innerWidth, vh = W.innerHeight;
    return clamp(rc.width * Math.max(rc.height, vh) * 0.5, vw * vh * 0.35, vw * vh * 1.5);
  }
  function computeF() {
    var A = areaOfPage(), Dm = 0;
    recs.forEach(function (r) {
      var a = r.w * r.h; if (!a) return;
      var d = 0, i;
      if (r.g) d = a;
      else { for (i = 0; i < r.holes.length; i++) { var o = r.holes[i]; d += Math.PI * o.r * o.r * (o.cl ? o.s : 1); } if (r.x) d += a * 0.3; if (r.z) d += a * 0.16; d = Math.min(a, d); }
      Dm += d;
    });
    return clamp(1 - Dm / A, 0, 1);
  }
  var F = { v: 1, shown: 1, dirty: true };
  function markF() { F.dirty = true; }

  function hitElement(e, kind, u, v, rad, mirrored) {
    var r = recOf(e, true); measure(r);
    if (r.patch && r.patch.hp > 0) {
      r.patch.hp--; r.patch.flash = 1;
      if (r.patch.hp <= 0) r.patch = null;
      r.dirty = true; if (isEmpty(r)) dropRec(r);
      return { absorbed: true };
    }
    var res = { absorbed: false, gone: false };
    if (kind === 'x') { r.x = r.x ? 0 : 1; }
    else if (kind === 'z') { r.z = r.z ? 0 : 1; }
    else if (kind === 'b') {
      addHole(r, u, v, rad);
      if (r.holes.length >= MAXHOLES || coverage(r) >= 0.6) { r.g = 1; r.fa = 0; r.holes.length = 0; res.gone = true; }
    } else if (kind === 'g') { r.g = 1; r.fa = 0; r.holes.length = 0; res.gone = true; }
    r.dirty = true; markF();
    if (r.link && !mirrored) { var p = r.link; if (p.el.isConnected) hitElement(p.el, kind, u, v, rad, true); }
    return res;
  }
  function fixIn(x, y, R) {
    var out = { holes: [], flags: 0, gone: 0 };
    recs.forEach(function (r) {
      var e = r.el; if (!e.isConnected) return;
      var rc = e.getBoundingClientRect();
      var near = x > rc.left - R && x < rc.right + R && y > rc.top - R && y < rc.bottom + R; if (!near) return;
      var cx = clamp(x, rc.left, rc.right), cy = clamp(y, rc.top, rc.bottom), inside = hypot(cx - x, cy - y) <= R;
      var i;
      for (i = 0; i < r.holes.length; i++) {
        var o = r.holes[i]; if (o.cl) continue;
        var hx = rc.left + o.u * rc.width, hy = rc.top + o.v * rc.height;
        if (hypot(hx - x, hy - y) <= R + o.r) { o.cl = 1; out.holes.push({ e: e, x: hx, y: hy, r: o.r }); }
      }
      if (inside) {
        if (r.x) { r.x = 0; out.flags++; }
        if (r.z) { r.z = 0; out.flags++; }
        if (r.g) { r.g = 0; r.fa = 0.001; out.gone++; out.holes.push({ e: e, x: rc.left + rc.width / 2, y: rc.top + rc.height / 2, r: Math.min(rc.width, rc.height) / 2, whole: true }); }
        if (r.ghost) r.ghost = 0;
        if (r.jit) r.jit = 0;
      }
      r.dirty = true;
    });
    if (out.holes.length || out.flags) markF();
    return out;
  }
  function healAll() { var s = { holes: [], flags: 0, gone: 0 }; recs.forEach(function (r) { r.holes.forEach(function (o) { o.cl = 1; }); if (r.x) { r.x = 0; s.flags++; } if (r.z) { r.z = 0; s.flags++; } if (r.g) { r.g = 0; r.fa = 0.001; s.gone++; } r.ghost = 0; r.jit = 0; r.dirty = true; }); markF(); return s; }

  function stepModel(dt) {
    if (reduced()) dt *= 1000;
    recs.forEach(function (r) {
      var ch = false, i;
      var tx = r.x ? 1 : 0; if (r.xa !== tx) { r.xa = tx > r.xa ? Math.min(tx, r.xa + dt * 4.2) : Math.max(tx, r.xa - dt * 3.2); ch = true; }
      var tz = r.z ? 1 : 0; if (r.za !== tz) { r.za = tz > r.za ? Math.min(tz, r.za + dt * 5) : Math.max(tz, r.za - dt * 3.4); ch = true; }
      if (!r.g && r.fa < 1) { r.fa = Math.min(1, r.fa + dt * 2.2); ch = true; }
      for (i = r.holes.length - 1; i >= 0; i--) {
        var o = r.holes[i];
        if (o.cl) { o.s -= dt * 2.6; ch = true; if (o.s <= 0) r.holes.splice(i, 1); }
        else if (o.s < 1) { o.s = Math.min(1, o.s + dt * 9); ch = true; }
      }
      if (ch || r.dirty) { markF(); if (!applyRec(r)) { recs.delete(r.el); return; } }
      if (isEmpty(r)) { dropRec(r); markF(); }
    });
  }
  function restoreAll() { recs.forEach(function (r) { clearRec(r); }); recs.clear(); markF(); }


  var fx = { cv: null, g: null, w: 0, h: 0, dpr: 1, parts: [], proj: [], t: 0, last: 0, raf: 0, shake: 0, hitstop: 0, low: false, ema: 16, slow: 0,
             noise: null, scan: null, bars: [], nextBar: 0, gdir: Math.PI / 2, ghostT: 0, jitT: 0, wrap: null, shakeOK: false,
             debris: [], floor: null, fg: null, floorDirty: false, budget: 480 };
  var me = { x: 0, y: 0, vx: 0, vy: 0, aimx: 0, aimy: 0, side: 'n', charge: 0, squash: 0, has: false, scan: false, t: 0 };
  var peers = new Map();
  var inks = [], stamps = [], pings = [];

  function sizeCanvas() {
    var dpr = Math.min(W.devicePixelRatio || 1, 2); fx.dpr = dpr; fx.w = W.innerWidth; fx.h = W.innerHeight;
    fx.cv.width = Math.round(fx.w * dpr); fx.cv.height = Math.round(fx.h * dpr); fx.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!fx.floor) fx.floor = D.createElement('canvas');
    fx.floor.width = fx.cv.width; fx.floor.height = fx.cv.height; fx.fg = fx.floor.getContext('2d'); fx.fg.setTransform(dpr, 0, 0, dpr, 0, 0); fx.floorDirty = true;
  }
  function bakeGlyph(p) {
    var g = fx.fg; if (!g) return;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = 0.92; g.font = p.font; g.fillStyle = p.color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.ch, 0, 0); g.restore();
    fx.debris.push({ ch: p.ch, x: p.x, y: p.y, rot: p.rot, font: p.font, color: p.color, src: p.src, hu: p.hu, hv: p.hv });
    if (fx.debris.length > 900) { fx.debris.shift(); fx.floorDirty = true; }
  }
  function redrawFloor() {
    var g = fx.fg; fx.floorDirty = false; if (!g) return;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fx.floor.width, fx.floor.height); g.restore();
    for (var i = 0; i < fx.debris.length; i++) { var d = fx.debris[i]; g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.globalAlpha = 0.92; g.font = d.font; g.fillStyle = d.color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.ch, 0, 0); g.restore(); }
  }
  function clearDebris() { fx.debris.length = 0; fx.floorDirty = true; }
  function addPart(p) {
    var cap = fx.low ? 400 : 1000;
    if (fx.parts.length >= cap) { for (var i = 0; i < fx.parts.length; i++) { var q = fx.parts[i]; if (q.rest || q.t === 's' || q.t === 'd') { fx.parts.splice(i, 1); break; } } if (fx.parts.length >= cap) fx.parts.shift(); }
    fx.parts.push(p); return p;
  }
  function sparks(x, y, col, n, speed) {
    if (fx.low) n = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), s = rnd(0.25, 1) * speed; addPart({ t: 's', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.12, life: rnd(0.25, 0.6), max: 0.6, col: col, size: rnd(1.3, 3) }); }
  }
  function ringFx(x, y, R, col, life, w) { addPart({ t: 'r', x: x, y: y, r: 4, R: R, life: life, max: life, col: col, w: w || 2 }); }

  function glyphPoints(e, x, y, R, cap) {
    var out = [], walker = D.createTreeWalker(e, NodeFilter.SHOW_TEXT, null), n, nodes = 0, range = D.createRange();
    while ((n = walker.nextNode()) && nodes < 70) {
      var v = n.nodeValue; if (!v || !v.trim()) continue;
      var pe = n.parentElement; if (!pe || inOurs(pe)) continue; nodes++;
      range.selectNodeContents(n);
      var rects = range.getClientRects(), hit = false, i;
      for (i = 0; i < rects.length; i++) { var q = rects[i]; if (q.right >= x - R && q.left <= x + R && q.bottom >= y - R && q.top <= y + R) { hit = true; break; } }
      if (!hit) continue;
      var cs = W.getComputedStyle(pe), color = cs.color, fill = cs.webkitTextFillColor;
      if (fill && /rgba\(0, 0, 0, 0\)|transparent/.test(fill)) color = '#e8ecf6';
      var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, size = parseFloat(cs.fontSize) || 14;
      for (var k = 0; k < v.length; k++) {
        var ch = v.charAt(k); if (/\s/.test(ch)) continue;
        range.setStart(n, k); range.setEnd(n, k + 1);
        var rc = range.getBoundingClientRect(); if (!rc.width) continue;
        var gx = rc.left + rc.width / 2, gy = rc.top + rc.height / 2, d = hypot(gx - x, gy - y);
        if (d > R) continue;
        out.push({ ch: ch, x: gx, y: gy, d: d, font: font, color: color, size: size });
      }
    }
    if (out.length > cap) { out.sort(function () { return Math.random() - 0.5; }); out.length = cap; }
    return out;
  }
  function scatter(e, cx, cy, R, power, cap) {
    cap = Math.min(cap, fx.budget); if (cap <= 0) return 0;
    var gs = glyphPoints(e, cx, cy, R, fx.low ? Math.ceil(cap / 2) : cap), i, rc = e.getBoundingClientRect(), bw = rc.width || 1, bh = rc.height || 1;
    fx.budget -= gs.length;
    for (i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (reduced()) { addPart({ t: 'd', ch: g.ch, x: g.x, y: g.y, font: g.font, color: g.color, life: 0.7, max: 0.7 }); continue; }
      var dx = g.x - cx, dy = g.y - cy, d = Math.max(6, hypot(dx, dy)), k = (1 - Math.min(1, d / (R + 1))) * 0.75 + 0.25, sp = power * k * rnd(0.6, 1.25);
      addPart({ t: 'g', ch: g.ch, x: g.x, y: g.y, vx: dx / d * sp + rnd(-40, 40), vy: dy / d * sp - power * rnd(0.15, 0.55), rot: rnd(-0.4, 0.4), vr: rnd(-9, 9), font: g.font, color: g.color, life: 9 + rnd(0, 4), max: 13, rest: false, src: e, hu: (g.x - rc.left) / bw, hv: (g.y - rc.top) / bh });
    }
    return gs.length;
  }
  function gather(e, cx, cy, R, dur, cap) {
    var rc = e.getBoundingClientRect(), conv = 0, i, d, hx, hy;
    for (i = fx.debris.length - 1; i >= 0; i--) {
      d = fx.debris[i]; if (d.src !== e) continue;
      hx = rc.left + d.hu * rc.width; hy = rc.top + d.hv * rc.height; if (hypot(hx - cx, hy - cy) > R + 2) continue;
      fx.debris.splice(i, 1); fx.floorDirty = true; conv++;
      if (reduced()) continue;
      addPart({ t: 'g', mode: 'ret', ch: d.ch, hx: hx, hy: hy, x: d.x, y: d.y, x0: d.x, y0: d.y, rot: d.rot, font: d.font, color: d.color, tt: -rnd(0, 0.16), dur: dur * rnd(0.75, 1.1) + 0.2, life: 5, max: 5 });
    }
    for (i = fx.parts.length - 1; i >= 0; i--) {
      d = fx.parts[i]; if (d.t !== 'g' || d.mode || d.src !== e) continue;
      hx = rc.left + d.hu * rc.width; hy = rc.top + d.hv * rc.height; if (hypot(hx - cx, hy - cy) > R + 2) continue;
      conv++;
      if (reduced()) { fx.parts.splice(i, 1); continue; }
      d.mode = 'ret'; d.hx = hx; d.hy = hy; d.x0 = d.x; d.y0 = d.y; d.tt = -rnd(0, 0.16); d.dur = dur * rnd(0.75, 1.1) + 0.2; d.life = 5; d.max = 5; d.rest = false;
    }
    var gs = glyphPoints(e, cx, cy, R, fx.low ? Math.ceil(cap / 2) : cap);
    if (conv) { gs.sort(function () { return Math.random() - 0.5; }); gs.length = Math.max(0, gs.length - conv); }
    for (i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (reduced()) { addPart({ t: 'd', ch: g.ch, x: g.x, y: g.y, font: g.font, color: COL.dec, life: 0.5, max: 0.5 }); continue; }
      var a = rnd(0, TAU), far = R * rnd(1.4, 2.6) + 40;
      addPart({ t: 'g', mode: 'ret', ch: g.ch, hx: g.x, hy: g.y, x: g.x + Math.cos(a) * far, y: g.y + Math.sin(a) * far, x0: g.x + Math.cos(a) * far, y0: g.y + Math.sin(a) * far, rot: rnd(-3, 3), font: g.font, color: g.color, tt: -rnd(0, 0.16), dur: dur * rnd(0.75, 1.1), life: 5, max: 5 });
    }
    return gs.length + conv;
  }
  function shards(x, y, col, n, speed) {
    if (fx.low) n = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), s = rnd(0.3, 1) * speed; addPart({ t: 'h', x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, rot: rnd(0, TAU), vr: rnd(-8, 8), w: rnd(3, 10), h: rnd(2, 6), col: col, life: 2.2 + rnd(0, 1.5), max: 3.7 }); }
  }

  function updateFloor() { var b = ui.bar, h = b && G.hud ? b.offsetHeight : 0; fx.floorY = fx.h - (h ? h + 24 : 3); }
  function stepParts(dt) {
    var G = 1450, fl = fx.floorY || fx.h - 3, gx = Math.cos(fx.gdir) * G, gy = Math.sin(fx.gdir) * G, i;
    for (i = fx.parts.length - 1; i >= 0; i--) {
      var p = fx.parts[i];
      if (p.t === 'g' && p.mode === 'ret') {
        p.tt += dt; var u = clamp(p.tt / p.dur, 0, 1), e = easeOut(u);
        p.x = lerp(p.x0, p.hx, e); p.y = lerp(p.y0, p.hy, e); p.rot *= (1 - 0.12);
        if (u >= 1) { if (!fx.low && Math.random() < 0.35) sparks(p.hx, p.hy, COL.dec, 2, 90); fx.parts.splice(i, 1); }
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
      if (p.t === 'g' || p.t === 'h') {
        if (!p.rest) {
          p.vy += gy * dt; p.vx += gx * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          if (p.y > fl) { p.y = fl; p.vy = -p.vy * 0.36; p.vx *= 0.74; p.vr *= 0.55; if (Math.abs(p.vy) < 60) { p.rest = true; p.vx = p.vy = p.vr = 0; if (p.t === 'g') p.rot = Math.round(p.rot / 1.5708) * 1.5708 + rnd(-0.25, 0.25); } }
          if (p.x < 4) { p.x = 4; p.vx = Math.abs(p.vx) * 0.5; } else if (p.x > fx.w - 4) { p.x = fx.w - 4; p.vx = -Math.abs(p.vx) * 0.5; }
        }
        if (p.rest && p.t === 'g') { bakeGlyph(p); fx.parts.splice(i, 1); continue; }
      } else if (p.t === 's') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.vx *= 0.96; }
      else if (p.t === 'r') { var k = 1 - p.life / p.max; p.r = lerp(4, p.R, easeOut(k)); }
      else if (p.t === 'd') { p.y -= 14 * dt; }
    }
    for (i = fx.proj.length - 1; i >= 0; i--) {
      var q = fx.proj[i], dx = q.tx - q.x, dy = q.ty - q.y, d = hypot(dx, dy), step = q.speed * dt;
      if (d <= step + 2) { fx.proj.splice(i, 1); q.hit(); continue; }
      q.x += dx / d * step; q.y += dy / d * step; q.trail.push([q.x, q.y]); if (q.trail.length > 9) q.trail.shift();
    }
  }

  function rectCenterRot(r, rc, u, v) {
    var ang = r.xa * Math.PI, dx = (u - 0.5) * r.w, dy = (v - 0.5) * r.h, c = Math.cos(ang), s = Math.sin(ang);
    return [rc.left + rc.width / 2 + dx * c - dy * s, rc.top + rc.height / 2 + dx * s + dy * c];
  }
  function drawDecals(g) {
    var now = fx.t, vh = fx.h;
    recs.forEach(function (r) {
      var rc = r.el.getBoundingClientRect(); if (rc.bottom < -50 || rc.top > vh + 50) return;
      for (var i = 0; i < r.holes.length; i++) {
        var o = r.holes[i], rad = o.r * o.s; if (rad < 3) continue;
        var p = rectCenterRot(r, rc, o.u, o.v);
        g.beginPath(); g.arc(p[0], p[1], rad + 1, 0, TAU); g.strokeStyle = 'rgba(8,10,20,.6)'; g.lineWidth = 3.5; g.stroke();
        var ember = o.cl ? 0.5 : clamp(1 - (o.age || 0) / 3.5, 0, 1) * 0.65;
        o.age = (o.age || 0) + 0.016;
        if (ember > 0.02) { g.beginPath(); g.arc(p[0], p[1], rad + 3, 0, TAU); g.strokeStyle = 'rgba(167,139,250,' + ember.toFixed(3) + ')'; g.lineWidth = 2; g.stroke(); }
        if (o.cl) { g.beginPath(); g.arc(p[0], p[1], rad + 2, 0, TAU); g.strokeStyle = 'rgba(45,212,191,.75)'; g.lineWidth = 2; g.stroke(); }
      }
      if (r.patch) drawPatch(g, r, rc);
    });
  }
  function drawPatch(g, r, rc) {
    var d = r.patch.d, n = d, w = rc.width, h = rc.height, cell = Math.max(10, Math.min(w, h) / (n + 1)), ox = rc.left + (w - cell * (n - 1)) / 2, oy = rc.top + (h - cell * (n - 1)) / 2;
    var fl = r.patch.flash || 0; r.patch.flash = Math.max(0, fl - 0.05);
    g.save(); g.beginPath(); g.rect(rc.left, rc.top, w, h); g.clip();
    g.fillStyle = 'rgba(45,212,191,' + (0.07 + fl * 0.25).toFixed(3) + ')'; g.fillRect(rc.left, rc.top, w, h);
    g.strokeStyle = 'rgba(45,212,191,' + (0.34 + fl * 0.5).toFixed(3) + ')'; g.lineWidth = 1.2;
    for (var i = 0; i < n; i++) { g.beginPath(); g.moveTo(ox, oy + i * cell); g.lineTo(ox + (n - 1) * cell, oy + i * cell); g.moveTo(ox + i * cell, oy); g.lineTo(ox + i * cell, oy + (n - 1) * cell); g.stroke(); }
    g.fillStyle = 'rgba(159,243,230,.9)';
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) { g.beginPath(); g.arc(ox + a * cell, oy + b * cell, 2.4, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(45,212,191,' + (0.6 + fl * 0.4).toFixed(2) + ')'; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.strokeRect(rc.left + 1, rc.top + 1, w - 2, h - 2); g.setLineDash([]);
    g.fillStyle = 'rgba(9,13,24,.85)'; g.fillRect(rc.left + 4, rc.top + 4, 74, 18); g.fillStyle = COL.dec; g.font = '600 11px Inter,system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('d=' + d + ' · shield ' + r.patch.hp + '/' + r.patch.max, rc.left + 8, rc.top + 13);
  }
  function drawLinks(g) {
    var seen = new Set();
    recs.forEach(function (r) {
      if (!r.link || seen.has(r)) return; seen.add(r); seen.add(r.link);
      var a = r.el.getBoundingClientRect(), b = r.link.el.getBoundingClientRect();
      var ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var mx = (ax + bx) / 2, my = (ay + by) / 2 - Math.min(160, hypot(ax - bx, ay - by) * 0.25);
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, bx, by);
      g.strokeStyle = 'rgba(167,139,250,.75)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.lineDashOffset = -fx.t * 40; g.stroke(); g.setLineDash([]);
      g.fillStyle = COL.noise; g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.arc(bx, by, 4, 0, TAU); g.fill();
    });
  }
  function drawInks(g) {
    for (var i = 0; i < inks.length; i++) {
      var k = inks[i]; if (!k.e.isConnected) continue; var rc = k.e.getBoundingClientRect(); if (rc.bottom < -80 || rc.top > fx.h + 80) continue;
      g.beginPath();
      for (var j = 0; j < k.pts.length; j++) { var x = rc.left + k.pts[j][0] * rc.width, y = rc.top + k.pts[j][1] * rc.height; if (j) g.lineTo(x, y); else g.moveTo(x, y); }
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(45,212,191,.22)'; g.lineWidth = 9; g.stroke();
      g.strokeStyle = 'rgba(159,243,230,.95)'; g.lineWidth = 2.4; g.stroke();
    }
  }
  var STAMPS = [['|0⟩', '#9ff3e6'], ['|1⟩', '#d4c6ff'], ['H', '#ffd76a'], ['X', '#ff8a8a'], ['Z', '#7fd0ff'], ['●─●', '#e8ecf6']];
  function drawStamps(g) {
    for (var i = 0; i < stamps.length; i++) {
      var s = stamps[i]; if (!s.e.isConnected) continue; var rc = s.e.getBoundingClientRect(), x = rc.left + s.u * rc.width, y = rc.top + s.v * rc.height;
      if (y < -60 || y > fx.h + 60) continue;
      var d = STAMPS[s.g] || STAMPS[0], wd = d[0].length > 3 ? 62 : 44;
      g.fillStyle = 'rgba(9,13,24,.88)'; g.strokeStyle = d[1]; g.lineWidth = 2; roundRect(g, x - wd / 2, y - 20, wd, 40, 10); g.fill(); g.stroke();
      g.fillStyle = d[1]; g.font = '600 18px Inter,system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d[0], x, y + 1);
    }
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function drawParts(g) {
    var i, p;
    for (i = 0; i < fx.parts.length; i++) {
      p = fx.parts[i];
      if (p.t === 'g') {
        var a = p.mode === 'ret' ? clamp(0.25 + p.tt / p.dur, 0, 1) : clamp(p.life / 1.2, 0, 1);
        if (p.tt < 0) continue;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = a; g.font = p.font; g.fillStyle = p.mode === 'ret' ? COL.dec : p.color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.ch, 0, 0); g.restore();
      } else if (p.t === 'd') { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.font = p.font; g.fillStyle = p.color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.ch, p.x, p.y); g.globalAlpha = 1; }
      else if (p.t === 's') { g.globalAlpha = clamp(p.life / p.max, 0, 1); g.fillStyle = p.col; g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); g.globalAlpha = 1; }
      else if (p.t === 'r') { g.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.9; g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.strokeStyle = p.col; g.lineWidth = p.w; g.stroke(); g.globalAlpha = 1; }
      else if (p.t === 'h') { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = clamp(p.life / 1.0, 0, 1); g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    }
    for (i = 0; i < fx.proj.length; i++) {
      var q = fx.proj[i];
      for (var j = 0; j < q.trail.length; j++) { g.globalAlpha = (j + 1) / q.trail.length * 0.5; g.fillStyle = q.col; g.beginPath(); g.arc(q.trail[j][0], q.trail[j][1], q.r * (j + 1) / q.trail.length, 0, TAU); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, q.r * 0.7, 0, TAU); g.fill(); g.strokeStyle = q.col; g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawNoise(g, x, y, t, charge, sq, scale, label) {
    var r = (11 + charge * 12) * scale * (1 + sq * 0.18), i;
    var grd = g.createRadialGradient(x, y, 0, x, y, r * 3.4); grd.addColorStop(0, 'rgba(167,139,250,.55)'); grd.addColorStop(1, 'rgba(167,139,250,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * 3.4, 0, TAU); g.fill();
    g.beginPath();
    for (i = 0; i <= 12; i++) { var a = i / 12 * TAU, k = 0.82 + 0.26 * Math.sin(a * 3 + t * 6) * Math.cos(a * 2 - t * 4) + charge * 0.12 * Math.sin(t * 40 + i); var px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * (1 - sq * 0.18); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.closePath(); g.fillStyle = '#1b1240'; g.fill(); g.strokeStyle = '#c4b5fd'; g.lineWidth = 2; g.stroke();
    for (i = 0; i < 4; i++) { var b = t * (1.9 + i * 0.35) + i * 1.57; g.fillStyle = i % 2 ? '#e9d5ff' : '#a78bfa'; g.beginPath(); g.arc(x + Math.cos(b) * r * 1.9, y + Math.sin(b * 1.13) * r * 1.35, 2.3 * scale, 0, TAU); g.fill(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + (me.aimx - x) / 260 * r * 0.4, y + (me.aimy - y) / 260 * r * 0.4, r * 0.28, 0, TAU); g.fill();
    if (label) { g.font = '600 11px Inter,system-ui,sans-serif'; g.fillStyle = 'rgba(232,236,246,.9)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(label, x, y - r * 2.1); }
  }
  function drawDecoder(g, x, y, t, charge, sq, scale, label) {
    var r = (12 + charge * 10) * scale, i;
    var grd = g.createRadialGradient(x, y, 0, x, y, r * 3.2); grd.addColorStop(0, 'rgba(45,212,191,.5)'); grd.addColorStop(1, 'rgba(45,212,191,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill();
    g.beginPath(); for (i = 0; i < 6; i++) { var a = i / 6 * TAU + Math.PI / 6, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath();
    g.fillStyle = '#062a27'; g.fill(); g.strokeStyle = '#5eead4'; g.lineWidth = 2; g.stroke();
    g.lineWidth = 2.4; g.strokeStyle = '#99f6e4';
    for (i = 0; i < 3; i++) { var s0 = t * 1.6 + i * TAU / 3; g.beginPath(); g.arc(x, y, r * (1.7 + charge * 0.6), s0, s0 + 1.35); g.stroke(); }
    for (i = 0; i < 2; i++) { var b = -t * 2.3 + i * Math.PI; g.fillStyle = '#ccfbf1'; g.beginPath(); g.arc(x + Math.cos(b) * r * 2.3, y + Math.sin(b) * r * 2.3, 2.6 * scale, 0, TAU); g.fill(); }
    g.fillStyle = '#ecfeff'; g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
    if (label) { g.font = '600 11px Inter,system-ui,sans-serif'; g.fillStyle = 'rgba(232,236,246,.9)'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(label, x, y - r * 2.1); }
  }
  function drawReticle(g, x, y, R, col) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6; g.globalAlpha = 0.85;
    if (R > 6) { g.setLineDash([5, 5]); g.lineDashOffset = -fx.t * 30; g.beginPath(); g.arc(x, y, R, 0, TAU); g.stroke(); g.setLineDash([]); }
    g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 12, y); g.moveTo(x, y - 12); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 12); g.stroke();
    g.globalAlpha = 1;
  }
  function drawPings(g) {
    for (var i = 0; i < pings.length; i++) {
      var p = pings[i], a = 0.55 + 0.45 * Math.sin(fx.t * 7 + i * 1.7), s = 7 + 2 * Math.sin(fx.t * 5 + i);
      g.globalAlpha = a; g.fillStyle = COL.amber; g.beginPath(); g.moveTo(p.x, p.y - s); g.lineTo(p.x + s, p.y); g.lineTo(p.x, p.y + s); g.lineTo(p.x - s, p.y); g.closePath(); g.fill();
      g.strokeStyle = COL.amber; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, s + 5 + (fx.t * 20 % 10), 0, TAU); g.globalAlpha = a * 0.4; g.stroke(); g.globalAlpha = 1;
    }
  }

  function makeTiles() {
    var c = D.createElement('canvas'); c.width = c.height = 96; var g = c.getContext('2d'), im = g.createImageData(96, 96);
    for (var i = 0; i < im.data.length; i += 4) { var v = 90 + Math.random() * 120 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); fx.noise = fx.g.createPattern(c, 'repeat');
    var s = D.createElement('canvas'); s.width = 4; s.height = 4; var sg = s.getContext('2d'); sg.fillStyle = 'rgba(0,0,0,1)'; sg.fillRect(0, 0, 4, 1); fx.scan = fx.g.createPattern(s, 'repeat');
  }
  function drawGlobal(g, Fv, dt) {
    var lev = 1 - Fv; if (lev < 0.08) return;
    var W2 = fx.w, H2 = fx.h;
    if (!fx.low && fx.scan) { g.globalAlpha = Math.min(0.13, (lev - 0.08) * 0.2); g.fillStyle = fx.scan; g.fillRect(0, 0, W2, H2); }
    var na = lev < 0.42 ? 0 : Math.min(0.24, (lev - 0.42) * 0.42);
    if (Fv < 0.03) na = Math.min(0.94, na + (0.03 - Fv) / 0.03 * 0.7);
    if (na > 0.005 && fx.noise && !fx.low) { g.save(); g.globalAlpha = na; g.translate((Math.random() * 96) | 0, (Math.random() * 96) | 0); g.fillStyle = fx.noise; g.fillRect(-96, -96, W2 + 192, H2 + 192); g.restore(); }
    else if (Fv < 0.03) { g.globalAlpha = 0.85; g.fillStyle = '#0c0f18'; g.fillRect(0, 0, W2, H2); }
    g.globalAlpha = 1;
    if (Fv < 0.03) { g.fillStyle = 'rgba(12,15,24,' + Math.min(0.55, (0.03 - Fv) * 18).toFixed(2) + ')'; g.fillRect(0, 0, W2, H2); }
    fx.nextBar -= dt;
    if (lev > 0.3 && fx.nextBar <= 0 && !reduced()) { fx.bars.push({ y: rnd(0, H2), h: rnd(4, 22), life: 0.14, dx: rnd(-40, 40), c: pick(['rgba(255,60,110,.16)', 'rgba(60,220,255,.16)', 'rgba(167,139,250,.18)']) }); fx.nextBar = rnd(0.5, 1.6) / lev; }
    for (var i = fx.bars.length - 1; i >= 0; i--) { var b = fx.bars[i]; b.life -= dt; if (b.life <= 0) { fx.bars.splice(i, 1); continue; } g.fillStyle = b.c; g.fillRect(b.dx, b.y, W2, b.h); }
    fx.ghostT -= dt;
    if (fx.ghostT <= 0) {
      fx.ghostT = 0.25; var gh = lev > 0.3 ? clamp((lev - 0.3) * 4.2, 0, 2.6) : 0;
      recs.forEach(function (r) { var want = (r.holes.length || r.x || r.z || r.g) ? +gh.toFixed(1) : 0; if (r.ghost !== want) { r.ghost = want; r.dirty = true; } });
    }
    fx.jitT -= dt;
    if (fx.jitT <= 0) {
      fx.jitT = 0.12; var arr = [], chosen = new Set();
      if (lev > 0.5 && !reduced()) recs.forEach(function (r) { if (r.holes.length || r.x || r.z) arr.push(r); });
      for (var n = 0; n < Math.min(3, arr.length); n++) chosen.add(pick(arr));
      recs.forEach(function (r) { var want = chosen.has(r) ? 1 : 0; if (want) { r.jx = rnd(-3, 3) * lev; r.jy = rnd(-1.5, 1.5) * lev; } if (want || r.jit) { r.jit = want; r.dirty = true; } });
    }
  }

  function shakeStep(dt) {
    if (!fx.wrap) return;
    if (fx.shake > 0.02 && fx.shakeOK && !reduced()) { fx.wrap.style.translate = rnd(-1, 1) * fx.shake + 'px ' + rnd(-1, 1) * fx.shake + 'px'; fx.shake *= Math.pow(0.0009, dt); }
    else if (fx.wrap.style.translate) { fx.wrap.style.translate = ''; if (!fx.wrapHadStyle && fx.wrap.getAttribute('style') === '') fx.wrap.removeAttribute('style'); fx.shake = 0; }
  }


  var TOOLS = {
    n: [
      { id: 'flipx', name: 'Bit flip', key: '1', d: 'Turn a block upside down. In a real machine this is an X error: a 0 becomes a 1.', need: null },
      { id: 'flipz', name: 'Phase flip', key: '2', d: 'Invert a block’s colours. A Z error: reading the qubit as a 0 or a 1 would give the same answer, but its phase, which interference depends on, is flipped.', need: { hits: 6 } },
      { id: 'blast', name: 'Decoherence', key: '3', d: 'Hold to charge, release to blow holes through the page and scatter its letters. The environment leaking in.', need: { F: 0.86 } },
      { id: 'entangle', name: 'Correlate', key: '4', d: 'Click one block, then another. From now on an error on either strikes both. Correlated noise is a kind error correction finds especially hard.', need: { F: 0.62 } },
      { id: 'vacuum', name: 'Depolarise', key: '5', d: 'A shockwave of depolarising noise. Everything it reaches ends up maximally mixed: no outcome any likelier than another.', need: { F: 0.34 } }
    ],
    d: [
      { id: 'repair', name: 'Repair', key: '1', d: 'Click to mend errors nearby: holes close, blocks turn back, letters fly home. Hold to widen the beam.', need: null },
      { id: 'patch', name: 'Patch', key: '2', d: 'Cover a block with a code patch that absorbs errors. Its strength is the code distance: d = 3 absorbs one error, d = 5 two, d = 7 three. Click a patch again to raise it, for points.', need: { repairs: 4 } },
      { id: 'ink', name: 'Ink', key: '3', d: 'Draw glowing wires across the page. They stay attached to the block you start on.', need: { repairs: 10 } },
      { id: 'stamp', name: 'Stamp', key: '4', d: 'Place a qubit or a gate. [ and ] choose which.', need: { repairs: 18 } },
      { id: 'decode', name: 'Run the decoder', key: '5', d: 'One sweeping wave that mends everything it reaches.', need: { repairs: 28 } }
    ]
  };
  var ICON = {
    flipx: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5"/><path d="M18 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M6 21v-4h4"/></svg>',
    flipz: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
    blast: '<svg viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></svg>',
    entangle: '<svg viewBox="0 0 24 24"><circle cx="6" cy="8" r="2.6"/><circle cx="18" cy="16" r="2.6"/><path d="M8 9.4c4 1 4 4 8 5.2" stroke-dasharray="2 2"/></svg>',
    vacuum: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="10.5" stroke-dasharray="2 3"/></svg>',
    repair: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/></svg>',
    patch: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>',
    ink: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L17 4l3 3L8 19z"/><path d="M14 7l3 3"/></svg>',
    stamp: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M6 20h12M9 13h6l1 7H8z"/></svg>',
    decode: '<svg viewBox="0 0 24 24"><path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/></svg>'
  };
  var G = { on: false, side: 'n', tool: 0, hud: true, panel: null, room: null, id: '', nameIdx: 0, pts: 0, spent: 0, down: null, cool: 0, pendingLink: null, stroke: null, stampIdx: 0,
            vac: null, dec: null, storm: null, mile: {}, prevFocus: null, sound: false, keyAim: { dx: 0, dy: 0 } };
  var api = stub || function (mode, opts) { return start(mode, opts); };

  function curTool() { return TOOLS[G.side][G.tool]; }
  function isUnlocked(side, i) { return i < (stats.un[side] || 1); }
  function needText(t) { if (!t.need) return ''; if (t.need.hits) return 'Unlocks after ' + t.need.hits + ' hits'; if (t.need.repairs) return 'Unlocks after ' + t.need.repairs + ' repairs'; if (t.need.F) return 'Unlocks when the page falls below ' + Math.round(t.need.F * 100) + '% page health'; return ''; }
  function checkUnlocks() {
    ['n', 'd'].forEach(function (s) {
      var list = TOOLS[s];
      for (var i = stats.un[s] || 1; i < list.length; i++) {
        var nd = list[i].need, ok = false;
        if (nd) ok = (nd.hits && stats.hits >= nd.hits) || (nd.repairs && stats.repairs >= nd.repairs) || (nd.F && stats.minF <= nd.F);
        if (!ok) break;
        stats.un[s] = i + 1; saveStats(); buildTools();
        if (s === G.side) toast('New tool: <b>' + list[i].name + '</b> (key ' + list[i].key + ')');
        sfx.unlock();
      }
    });
  }
  function unlockAll() { stats.un = { n: 5, d: 5 }; saveStats(); if (G.on) buildTools(); }

  var netSend = function () {};
  function relOf(e, x, y) { var rc = e.getBoundingClientRect(); return { u: rc.width ? (x - rc.left) / rc.width : 0.5, v: rc.height ? (y - rc.top) / rc.height : 0.5 }; }

  function announceHit(e, res, x, y, R, kind) {
    var rc = e.getBoundingClientRect(), cx = clamp(x, rc.left, rc.right), cy = clamp(y, rc.top, rc.bottom);
    if (res.absorbed) { sparks(cx, cy, COL.dec, 12, 200); ringFx(cx, cy, 46, COL.dec, 0.4, 2); sfx.absorb(); return; }
    if (res.gone) {
      var mx = rc.left + rc.width / 2, my = rc.top + rc.height / 2, Rr = Math.max(rc.width, rc.height) * 0.6;
      scatter(e, mx, my, Rr, 640, 150); shards(mx, my, 'rgba(120,110,170,.9)', 14, 420); ringFx(mx, my, Math.min(260, Rr), COL.noise, 0.55, 3); fx.shake = Math.max(fx.shake, 7); fx.hitstop = Math.max(fx.hitstop, 0.05); sfx.crumble();
    }
  }
  function doFlip(kind, x, y, local) {
    var e = targetAt(x, y);
    if (!e) { sparks(x, y, COL.noise, 6, 120); sfx.miss(); return null; }
    var p = relOf(e, x, y), res = hitElement(e, kind, p.u, p.v, 0);
    if (!res.absorbed) { sparks(x, y, kind === 'x' ? COL.noise : COL.amber, 16, 240); ringFx(x, y, 40, kind === 'x' ? COL.noise : COL.amber, 0.4, 2); sfx.zap(); }
    announceHit(e, res, x, y, 0, kind);
    if (local) { stats.hits++; saveStats(); }
    return { e: e, u: p.u, v: p.v, k: kind };
  }
  function doBlast(x, y, power, local) {
    var R = 46 + power * 104, tg = targetsIn(x, y, R, 14), batch = [], i;
    ringFx(x, y, R * 1.25, COL.noise, 0.5, 3); sparks(x, y, COL.noise, 22 + power * 26 | 0, 320 + power * 220);
    for (i = 0; i < tg.length; i++) {
      var e = tg[i], p = relOf(e, x, y), res = hitElement(e, 'b', p.u, p.v, R);
      if (res.absorbed) { announceHit(e, res, x, y, R, 'b'); batch.push({ e: e, u: p.u, v: p.v, r: R, k: 'b' }); continue; }
      if (!res.gone) scatter(e, x, y, R, 430 + power * 300, 34 + Math.round(power * 70));
      announceHit(e, res, x, y, R, 'b'); batch.push({ e: e, u: p.u, v: p.v, r: R, k: 'b' });
    }
    fx.shake = Math.max(fx.shake, 3 + power * 9); fx.hitstop = Math.max(fx.hitstop, 0.02 + power * 0.05);
    if (tg.length) sfx.thud(power); else sfx.miss();
    if (local && tg.length) { stats.hits += tg.length; saveStats(); }
    return batch;
  }
  function doEntangle(x, y) {
    var e = targetAt(x, y); if (!e) { sfx.miss(); return null; }
    if (!G.pendingLink) { G.pendingLink = e; var rc0 = e.getBoundingClientRect(); ringFx(rc0.left + rc0.width / 2, rc0.top + rc0.height / 2, 60, COL.noise, 0.6, 3); toast('Now click the block to tie it to.'); sfx.zap(); return null; }
    if (G.pendingLink === e) { G.pendingLink = null; toast('Cancelled.'); return null; }
    var a = G.pendingLink; G.pendingLink = null; linkPair(a, e, true); return { e: a, e2: e };
  }
  function linkPair(a, b, fanfare) {
    var ra = recOf(a, true), rb = recOf(b, true);
    if (ra.link && ra.link.link === ra) ra.link.link = null; if (rb.link && rb.link.link === rb) rb.link.link = null;
    ra.link = rb; rb.link = ra; ra.dirty = rb.dirty = true; measure(ra); measure(rb);
    if (fanfare) { toast('Tied together. An error on either now strikes both: correlated noise, which error correction finds especially hard.'); sfx.link(); var c = b.getBoundingClientRect(); ringFx(c.left + c.width / 2, c.top + c.height / 2, 60, COL.noise, 0.6, 3); }
  }
  function doVacuum(x, y) {
    var list = [], all = D.body.querySelectorAll('p,li,h1,h2,h3,h4,h5,h6,figure,img,svg,table,button,a,blockquote,pre,section,div,label,summary,footer,nav');
    for (var i = 0; i < all.length; i++) { var e = all[i]; if (!qualifies(e)) continue; var rc = e.getBoundingClientRect(); if (rc.width * rc.height > W.innerWidth * W.innerHeight * 0.3) continue; var cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2; list.push({ e: e, x: cx, y: cy, d: hypot(cx - x, cy - y) }); }
    list.sort(function (a, b) { return a.d - b.d; });
    G.vac = { x: x, y: y, R: 0, list: list, next: 0 }; sfx.vacuum(); ringFx(x, y, 80, COL.noise, 0.6, 4); fx.shake = Math.max(fx.shake, 5);
  }

  function doRepair(x, y, power, local) {
    var R = 70 + power * 130, res = fixIn(x, y, R), n = res.holes.length + res.flags;
    ringFx(x, y, R, COL.dec, 0.5, 2.5);
    if (!n) { sparks(x, y, COL.dec, 6, 120); sfx.miss(); return { R: R, n: 0 }; }
    for (var i = 0; i < res.holes.length; i++) { var h = res.holes[i]; gather(h.e, h.x, h.y, h.whole ? Math.max(h.r * 1.3, 40) : h.r * 1.15, 0.7, h.whole ? 120 : 60); }
    sparks(x, y, COL.dec, 18, 260); sfx.mend(n);
    if (local) { G.pts += n; stats.repairs += n; stats.mended += n; saveStats(); }
    return { R: R, n: n };
  }
  function doPatch(x, y, local) {
    var e = targetAt(x, y); if (!e) { sfx.miss(); return null; }
    var r = recOf(e, true); measure(r);
    if (!r.patch) { r.patch = { d: 3, hp: 1, max: 1, flash: 1 }; r.dirty = true; toast('Patch placed: distance <b>3</b>, absorbs one error.'); sfx.mend(1); return { e: e, d: 3 }; }
    var d = r.patch.d; if (d >= 7) { toast('Already at distance 7.'); return null; }
    var cost = d === 3 ? 4 : 8;
    if (G.pts - G.spent < cost) { toast('Raising the distance to ' + (d + 2) + ' costs <b>' + cost + '</b> points. Mend errors to earn them.'); sfx.miss(); return null; }
    G.spent += cost; r.patch.d = d + 2; r.patch.max = (d + 1) / 2; r.patch.hp = r.patch.max; r.patch.flash = 1;
    toast('Distance <b>' + (d + 2) + '</b>: it now absorbs ' + r.patch.max + ' errors.'); sfx.mend(3); updateMeter(true);
    return { e: e, d: d + 2 };
  }
  function doStamp(x, y) {
    var e = targetAt(x, y) || $('.wrap') || D.body, p = relOf(e, x, y);
    stamps.push({ e: e, u: p.u, v: p.v, g: G.stampIdx }); sparks(x, y, STAMPS[G.stampIdx][1], 10, 160); sfx.mend(1);
    return { e: e, u: p.u, v: p.v, g: G.stampIdx };
  }
  function doDecode(x, y) { G.dec = { x: x, y: y, R: 0 }; sfx.wave(); ringFx(x, y, 90, COL.dec, 0.6, 4); }

  function stepWaves(dt) {
    var maxR = hypot(fx.w, fx.h) * 1.1;
    if (G.vac) {
      var v = G.vac, t0 = performance.now(); v.R += 1250 * dt; ringFx(v.x, v.y, v.R, COL.noise, 0.25, 3);
      while (v.next < v.list.length && v.list[v.next].d <= v.R && performance.now() - t0 < 9) {
        var c = v.list[v.next++]; if (!c.e.isConnected) continue;
        var res = hitElement(c.e, 'g', 0.5, 0.5, 0); if (!res.absorbed) announceHit(c.e, { gone: true }, c.x, c.y, 0, 'g');
      }
      if (v.next >= v.list.length || (v.R > maxR && v.list[v.next].d > maxR)) G.vac = null;
    }
    if (G.dec) {
      var w = G.dec; w.R += 1500 * dt; ringFx(w.x, w.y, w.R, COL.dec, 0.25, 3);
      var res2 = fixIn(w.x, w.y, w.R), k = res2.holes.length + res2.flags;
      for (var j = 0; j < res2.holes.length; j++) { var h = res2.holes[j]; gather(h.e, h.x, h.y, h.whole ? Math.max(h.r * 1.3, 40) : h.r * 1.15, 0.6, h.whole ? 100 : 50); }
      if (k) { G.pts += k; stats.repairs += k; stats.mended += k; saveStats(); }
      if (w.R > maxR) { G.dec = null; }
    }
  }

  function fire(x, y, power) {
    if (G.cool > 0) return;
    var t = curTool();
    G.cool = t.id === 'blast' ? 0.3 : t.id === 'vacuum' || t.id === 'decode' ? 1.2 : 0.11;
    me.squash = 1; me.charge = 0;
    var col = G.side === 'n' ? COL.noise : COL.dec, ax = me.x, ay = me.y;
    var q = { x: ax, y: ay, tx: x, ty: y, speed: 2600, col: col, r: 4 + power * 5, trail: [], hit: function () { land(t.id, x, y, power); } };
    fx.proj.push(q); sfx.shoot(t.id);
  }
  function land(id, x, y, power) {
    var msg = null, r;
    if (id === 'flipx') { r = doFlip('x', x, y, true); if (r) msg = { t: 'hit', a: [{ e: eidOf(r.e), u: r.u, v: r.v, r: 0, k: 'x' }] }; }
    else if (id === 'flipz') { r = doFlip('z', x, y, true); if (r) msg = { t: 'hit', a: [{ e: eidOf(r.e), u: r.u, v: r.v, r: 0, k: 'z' }] }; }
    else if (id === 'blast') { var b = doBlast(x, y, power, true); if (b.length) msg = { t: 'hit', a: b.slice(0, 14).map(function (o) { return { e: eidOf(o.e), u: o.u, v: o.v, r: o.r, k: 'b' }; }) }; }
    else if (id === 'entangle') { r = doEntangle(x, y); if (r) msg = { t: 'link', e: eidOf(r.e), e2: eidOf(r.e2) }; }
    else if (id === 'vacuum') { var e0 = targetAt(x, y); doVacuum(x, y); var p0 = e0 ? relOf(e0, x, y) : null; msg = { t: 'vac', e: e0 ? eidOf(e0) : null, u: p0 ? p0.u : x / fx.w, v: p0 ? p0.v : y / fx.h }; }
    else if (id === 'repair') { var e1 = targetAt(x, y), rr = doRepair(x, y, power, true), p1 = e1 ? relOf(e1, x, y) : null; msg = { t: 'fix', e: e1 ? eidOf(e1) : null, u: p1 ? p1.u : x / fx.w, v: p1 ? p1.v : y / fx.h, r: rr.R }; }
    else if (id === 'patch') { r = doPatch(x, y, true); if (r) msg = { t: 'patch', e: eidOf(r.e), d: r.d }; }
    else if (id === 'stamp') { r = doStamp(x, y); msg = { t: 'stamp', e: eidOf(r.e), u: r.u, v: r.v, g: r.g }; }
    else if (id === 'decode') { var e2 = targetAt(x, y); doDecode(x, y); var p2 = e2 ? relOf(e2, x, y) : null; msg = { t: 'dec', e: e2 ? eidOf(e2) : null, u: p2 ? p2.u : x / fx.w, v: p2 ? p2.v : y / fx.h }; }
    if (msg) {
      if (msg.a) { msg.a = msg.a.filter(function (o) { return o.e; }); if (!msg.a.length) msg = null; }
      else if (msg.t !== 'fix' && msg.t !== 'vac' && msg.t !== 'dec' && !msg.e) msg = null;
    }
    if (msg) netSend(msg);
    afterChange();
  }

  function inkStart(x, y) {
    var e = targetAt(x, y) || $('.wrap') || D.body, p = relOf(e, x, y);
    G.stroke = { e: e, pts: [[p.u, p.v]], last: [x, y] }; inks.push(G.stroke);
  }
  function inkMove(x, y) {
    var s = G.stroke; if (!s) return; if (hypot(x - s.last[0], y - s.last[1]) < 5) return;
    var p = relOf(s.e, x, y); if (s.pts.length < 400) s.pts.push([p.u, p.v]); s.last = [x, y];
  }
  function inkEnd() {
    var s = G.stroke; G.stroke = null; if (!s) return;
    if (s.pts.length < 2) { inks.splice(inks.indexOf(s), 1); return; }
    var step = Math.max(1, Math.ceil(s.pts.length / 60)), pts = [], i; for (i = 0; i < s.pts.length; i += step) pts.push([+s.pts[i][0].toFixed(3), +s.pts[i][1].toFixed(3)]);
    var eid = eidOf(s.e); if (eid) netSend({ t: 'ink', e: eid, p: pts });
    sfx.mend(1);
  }

  function stormStart() {
    if (G.room) { toast('Storms are for solo play. In a room, the other players are the noise.'); return; }
    G.storm = { t: 0, rate: 0.7, acc: 0, low: 0, best: 0 }; toast('<b>Storm.</b> Noise arrives from the edges. Keep the page above 25%. It gets faster.'); announce('Storm started');
  }
  function stormStop(msg) {
    if (!G.storm) return; var t = G.storm.t; G.storm = null;
    var best = Math.max(stats.bestStorm || 0, Math.round(t)); var beat = best > (stats.bestStorm || 0); stats.bestStorm = best; saveStats();
    toast(msg + ' You held <b>' + Math.round(t) + ' s</b>' + (beat ? ' — a new best.' : '. Best: ' + best + ' s.')); announce('Storm over');
  }
  function stepStorm(dt) {
    var s = G.storm; if (!s) return; s.t += dt; s.rate = 0.7 + s.t / 22; s.acc += dt * s.rate;
    while (s.acc >= 1) {
      s.acc -= 1;
      var edge = Math.random() * 4 | 0, sx = edge === 0 ? -20 : edge === 1 ? fx.w + 20 : rnd(0, fx.w), sy = edge === 2 ? -20 : edge === 3 ? fx.h + 20 : rnd(0, fx.h);
      var tx = rnd(fx.w * 0.08, fx.w * 0.92), ty = rnd(fx.h * 0.1, fx.h * 0.9), kind = pick(['flipx', 'flipx', 'flipz', 'blast']);
      (function (kind, tx, ty) { fx.proj.push({ x: sx, y: sy, tx: tx, ty: ty, speed: 1500, col: COL.noise, r: 4, trail: [], hit: function () { if (kind === 'blast') doBlast(tx, ty, 0.35, false); else doFlip(kind === 'flipx' ? 'x' : 'z', tx, ty, false); afterChange(); } }); })(kind, tx, ty);
    }
    if (F.v < 0.25) s.low += dt; else s.low = Math.max(0, s.low - dt * 0.5);
    if (s.low > 4) stormStop('The code could not keep up.');
    else if (Math.round(s.t) === 30 && !s.m30) { s.m30 = 1; toast('Thirty seconds. The noise is now arriving faster than most hands can mend it: patches will help.'); }
  }


  var au = { ctx: null, master: null };
  function ac() {
    if (!G.sound) return null;
    if (!au.ctx) { var A = W.AudioContext || W.webkitAudioContext; if (!A) return null; try { au.ctx = new A(); au.master = au.ctx.createGain(); au.master.gain.value = 0.15; au.master.connect(au.ctx.destination); } catch (e) { return null; } }
    if (au.ctx.state === 'suspended') au.ctx.resume();
    return au.ctx;
  }
  function tone(f0, f1, dur, type, vol, delay) {
    var c = ac(); if (!c) return; var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 || f0), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(au.master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noiseBurst(dur, vol, lp) {
    var c = ac(); if (!c) return; var n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'lowpass'; f.frequency.value = lp || 2000; g.gain.value = vol || 0.2;
    s.connect(f); f.connect(g); g.connect(au.master); s.start();
  }
  var sfx = {
    shoot: function (id) { tone(id === 'repair' || G.side === 'd' ? 540 : 660, 170, 0.09, 'sawtooth', 0.11); },
    zap: function () { tone(900, 140, 0.13, 'square', 0.1); },
    thud: function (p) { tone(130, 38, 0.3, 'sine', 0.4 + 0.3 * (p || 0)); noiseBurst(0.24, 0.22, 1300); },
    crumble: function () { noiseBurst(0.5, 0.26, 2800); tone(200, 60, 0.3, 'triangle', 0.15); },
    miss: function () { tone(210, 150, 0.06, 'triangle', 0.06); },
    mend: function (n) { var k = Math.min(3, 1 + (n > 2) + (n > 6)); tone(392, 392, 0.1, 'sine', 0.16); if (k > 1) tone(523, 523, 0.1, 'sine', 0.16, 0.07); if (k > 2) tone(659, 659, 0.16, 'sine', 0.16, 0.14); },
    absorb: function () { tone(1250, 620, 0.12, 'triangle', 0.13); },
    link: function () { tone(330, 660, 0.25, 'sine', 0.16); tone(660, 330, 0.25, 'sine', 0.1, 0.1); },
    vacuum: function () { tone(80, 28, 1.3, 'sawtooth', 0.2); noiseBurst(1.2, 0.16, 600); },
    wave: function () { tone(280, 980, 1.0, 'sine', 0.17); },
    unlock: function () { tone(660, 990, 0.2, 'sine', 0.14); tone(990, 1320, 0.2, 'sine', 0.12, 0.12); }
  };

  var ui = {};
  var NAMES = ['Boson', 'Muon', 'Gluon', 'Kaon', 'Pion', 'Axion', 'Quark', 'Tau', 'Photon', 'Lepton', 'Neutrino', 'Fermion', 'Meson', 'Hadron', 'Phonon', 'Magnon'];
  function nameOf(i) { i = Math.abs(i | 0); return NAMES[i % NAMES.length] + '-' + (Math.floor(i / NAMES.length) % 90 + 10); }
  function rid() { var s = ''; for (var i = 0; i < 8; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function toast(html, ms) {
    if (!ui.toast) return; ui.toast.innerHTML = html; ui.toast.style.setProperty('--sqp-c', G.side === 'n' ? COL.noise : COL.dec); ui.toast.classList.add('on');
    W.clearTimeout(ui.toastT); ui.toastT = W.setTimeout(function () { if (ui.toast) ui.toast.classList.remove('on'); }, ms || 3800);
    announce(ui.toast.textContent);
  }
  function announce(t) { if (ui.live) { ui.live.textContent = ''; W.setTimeout(function () { if (ui.live) ui.live.textContent = t; }, 30); } }
  function sideCol() { return G.side === 'n' ? COL.noise : COL.dec; }
  function relayText() { var o = G.room && G.room.online; return o === 'off' ? '' : o === 'yes' ? 'Online relay: connected.' : o === 'checking' ? 'Online relay: connecting…' : 'Online relay: not reachable, so this device only.'; }

  function buildTools() {
    if (!ui.tools) return;
    var list = TOOLS[G.side], h = '';
    for (var i = 0; i < list.length; i++) {
      var t = list[i], un = isUnlocked(G.side, i);
      h += '<button type="button" class="sqp-t" data-t="' + i + '" aria-pressed="' + (i === G.tool) + '"' + (un ? '' : ' disabled') + ' aria-label="' + t.name + ', key ' + t.key + (un ? '' : '. Locked: ' + needText(t)) + '" title="' + t.name + (un ? '' : ' (' + needText(t) + ')') + '">' + ICON[t.id] + '<kbd>' + t.key + '</kbd></button>';
    }
    ui.tools.innerHTML = h; ui.root.style.setProperty('--sqp-c', sideCol());
    var sb = ui.root.querySelector('[data-a="side"]'); if (sb) { sb.innerHTML = (G.side === 'n' ? ICON.repair : ICON.flipx) + '<span>' + (G.side === 'n' ? 'Be the Decoder' : 'Be the Noise') + '</span>'; sb.setAttribute('aria-label', G.side === 'n' ? 'Switch to the Decoder' : 'Switch to the Noise'); }
  }
  function updateMeter(force) {
    if (!ui.fnum) return;
    var pct = Math.round(F.shown * 100); ui.fnum.textContent = pct + '%'; ui.fbar.style.transform = 'scaleX(' + Math.max(0.005, F.shown).toFixed(3) + ')';
    var pts = ui.root.querySelector('.sqp-pts'); if (G.side === 'd') { if (!pts) { pts = el('span', 'sqp-pts'); ui.fnum.parentNode.appendChild(pts); } pts.textContent = (G.pts - G.spent) + ' points'; } else if (pts) pts.remove();
  }
  function buildUI() {
    ui.root = el('div'); ui.root.id = 'sqp-root'; ui.root.setAttribute('data-sqp-ignore', ''); ui.root.setAttribute('role', 'region'); ui.root.setAttribute('aria-label', 'Noise and Decoder controls');
    ui.root.innerHTML =
      '<div class="sqp-toast" aria-hidden="true"></div><div class="sqp-roster"></div>' +
      '<div class="sqp-bar" tabindex="-1"><div class="sqp-f"><b>100%</b><div class="sqp-fb"><i></i></div><span class="sqp-lbl">page health</span></div><div class="sqp-tools" role="group" aria-label="Tools"></div>' +
      '<div class="sqp-a"><button type="button" class="sqp-b sqp-me" data-a="side"></button>' +
      '<button type="button" class="sqp-b" data-a="sound" aria-pressed="false" aria-label="Sound"><svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/></svg></button>' +
      '<button type="button" class="sqp-b" data-a="help" aria-label="Help, and playing with others"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg></button>' +
      '<button type="button" class="sqp-b" data-a="restore" aria-label="Restore the page"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg><span>Restore</span></button>' +
      '<button type="button" class="sqp-b" data-a="hide" aria-label="Hide the controls (for a clean look at the page)"><svg viewBox="0 0 24 24"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/></svg></button>' +
      '<button type="button" class="sqp-b" data-a="exit" aria-label="Leave and put the page back"><span>Leave</span><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>' +
      '<button type="button" class="sqp-peek" aria-label="Show the controls"></button><div class="sqp-sr" aria-live="polite" aria-atomic="true"></div>';
    ui.toast = $('.sqp-toast', ui.root); ui.roster = $('.sqp-roster', ui.root); ui.tools = $('.sqp-tools', ui.root); ui.fnum = $('.sqp-f b', ui.root); ui.fbar = $('.sqp-fb i', ui.root); ui.live = $('.sqp-sr', ui.root); ui.bar = $('.sqp-bar', ui.root);
    D.body.appendChild(ui.root);
    ui.root.addEventListener('click', onHudClick);
    ui.root.querySelector('[data-a="sound"]').setAttribute('aria-pressed', String(!!G.sound));
    buildTools(); updateMeter();
  }
  function onHudClick(e) {
    var t = e.target.closest('.sqp-t'); if (t) { pickTool(+t.getAttribute('data-t')); return; }
    if (e.target.closest('.sqp-peek')) { setHud(true); return; }
    var b = e.target.closest('[data-a]'); if (!b) return; var a = b.getAttribute('data-a');
    if (a === 'side') setSide(G.side === 'n' ? 'd' : 'n');
    else if (a === 'sound') { G.sound = !G.sound; stats.sound = G.sound; saveStats(); b.setAttribute('aria-pressed', String(G.sound)); if (G.sound) { ac(); sfx.unlock(); } toast(G.sound ? 'Sound on.' : 'Sound off.', 1500); }
    else if (a === 'help') togglePanel('help');
    else if (a === 'restore') { wipeAll(true); }
    else if (a === 'hide') setHud(false);
    else if (a === 'exit') stop();
    else if (a === 'storm') { if (G.storm) stormStop('Stopped.'); else stormStart(); }
    else if (a === 'room-new') { roomStart(); }
    else if (a === 'room-join') { var v = ui.panel && ui.panel.querySelector('.sqp-code'); if (v) roomJoin(v.value); }
    else if (a === 'room-leave') { roomLeave(); togglePanel('help', true); }
    else if (a === 'room-copy') { copyInvite(); }
    else if (a === 'room-window') { openWindow(); }
    else if (a === 'round') { roundStart(); }
    else if (a === 'panel-close') closePanel();
  }
  function setHud(on) { G.hud = on; ui.root.classList.toggle('sqp-hud-off', !on); if (!on) closePanel(); else announce('Controls shown.'); updateFloor(); }
  function setSide(side) {
    if (G.side === side) return;
    G.side = side; G.tool = 0; G.pendingLink = null; G.stroke = null; if (G.storm) stormStop('Stopped.'); buildTools(); updateMeter(); updateFloor();
    toast(side === 'n' ? 'You are the <b>Noise</b>. Give the page its errors.' : 'You are the <b>Decoder</b>. Read the errors and undo them.');
    if (G.room) presence(true);
    if (ui.panel) togglePanel('help', true);
  }
  function pickTool(i) {
    var list = TOOLS[G.side]; if (i < 0 || i >= list.length) return;
    if (!isUnlocked(G.side, i)) { toast('<b>' + list[i].name + '</b> is locked. ' + needText(list[i]) + '.'); return; }
    G.tool = i; G.pendingLink = null; buildTools();
    var t = list[i]; toast('<b>' + t.name + '</b>. ' + t.d, 4200);
    if (t.id === 'stamp') announce('Stamp ' + STAMPS[G.stampIdx][0]);
  }
  function cycleTool(dir) { var n = TOOLS[G.side].length, i = G.tool; for (var k = 0; k < n; k++) { i = (i + dir + n) % n; if (isUnlocked(G.side, i)) { pickTool(i); return; } } }

  function closePanel() { if (ui.panel) { ui.panel.remove(); ui.panel = null; G.panel = null; } }
  function togglePanel(kind, refresh) {
    if (G.panel === kind && !refresh) { closePanel(); return; }
    closePanel(); G.panel = kind;
    var p = el('div', 'sqp-panel'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Help and rooms'); ui.panel = p;
    var roomHtml;
    if (G.room) {
      roomHtml = '<p>In room <b>' + G.room.code + '</b> with <b>' + peers.size + '</b> other' + (peers.size === 1 ? '' : 's') + '. Same page, same damage, everyone’s cursor. <span class="sqp-relay">' + relayText() + '</span></p><div class="sqp-row">' + (CFG.online ? '<button type="button" class="sqp-b" data-a="room-copy">Copy invite link</button>' : '') + '<button type="button" class="sqp-b" data-a="room-window">Open a second window</button><button type="button" class="sqp-b" data-a="round">Start a 90 second round</button><button type="button" class="sqp-b" data-a="room-leave">Leave the room</button></div>' +
        '<p class="sqp-note">A round: Noise players try to push the page health meter down, Decoders to hold it up. The meter is a game score for how much of the page is still undamaged, not a measured fidelity. When the clock runs out, under 50% is a win for the Noise and 50% or over for the Decoders.</p>';
    } else {
      roomHtml = '<p>' + (CFG.online ? 'Share this page with someone else' : 'Play with a second window') + ' in real time: cursors, damage, repairs and drawings appear on both screens. ' + (CFG.online ? 'Only the room code you typed, the page you are on, and small numbers for positions and actions cross the wire.' : 'Nothing typed by a player crosses the wire, only positions and actions.') + '</p><div class="sqp-row"><button type="button" class="sqp-b" data-a="room-new">Start a room</button><input class="sqp-code" maxlength="7" placeholder="ROOM CODE" aria-label="Room code" autocomplete="off" spellcheck="false"><button type="button" class="sqp-b" data-a="room-join">Join</button></div>' +
        '<p class="sqp-note">' + (CFG.online ? 'Two windows on this device always work. Other devices join through an online relay (Supabase Realtime), which is contacted only when you start or join a room, and used only if it answers.' : 'For now a room connects windows of this browser. Nothing is sent anywhere.') + '</p>';
    }
    p.innerHTML = '<button type="button" class="sqp-x" data-a="panel-close" aria-label="Close">✕</button><h3>Noise and Decoder</h3>' +
      '<p>The page is one logical qubit. The Noise gives it the errors physics does; the Decoder reads them and undoes them. <b>Nothing is deleted:</b> the effects are temporary styles on the page plus a layer drawn over it, and they are all removed when you leave.</p>' +
      '<h4>Play</h4><ul><li><b>Click or tap</b> to fire. <b>Hold</b> to charge the tools that charge.</li><li><kbd>1</kbd>–<kbd>5</kbd> pick a tool, <kbd>Q</kbd> or right-click cycles them. New tools unlock as you play.</li><li>No mouse? Arrow keys move the aim, <kbd>Space</kbd> fires.</li><li><kbd>Esc</kbd> leaves. <b>Restore</b> puts the page back and stays.</li></ul>' +
      '<h4>What is what</h4><ul><li><b>Bit flip</b> and <b>phase flip</b> are the two basic quantum errors, X and Z. A Y is both.</li><li>A <b>patch</b> of code distance <i>d</i> absorbs ⌊(d−1)/2⌋ errors, so raising it from 3 to 5 buys one more.</li><li>The Decoder’s <b>Storm</b> is a toy version of a race a real decoder runs: it has to correct errors as fast as they arrive, or they pile up and the page is lost.</li></ul>' +
      (G.side === 'd' ? '<div class="sqp-row"><button type="button" class="sqp-b" data-a="storm">' + (G.storm ? 'Stop the storm' : 'Start a storm') + '</button></div>' : '') +
      '<h4>Play with someone</h4>' + roomHtml;
    ui.root.appendChild(p);
    var f = p.querySelector('button,input'); if (f) f.focus();
  }

  function setAim(x, y) { me.aimx = x; me.aimy = y; me.has = true; if (!me.x && !me.y) { me.x = x - 50; me.y = y + 34; } }
  function chargeTool() { var id = curTool().id; return id === 'blast' || id === 'repair'; }
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    setAim(e.clientX, e.clientY);
    try { ui.input.setPointerCapture(e.pointerId); } catch (x) { }
    G.down = { t: performance.now(), id: e.pointerId }; G.lastType = e.pointerType;
    if (curTool().id === 'ink') inkStart(e.clientX, e.clientY);
    if (netCursorNow) netCursorNow();
  }
  function onMove(e) {
    setAim(e.clientX, e.clientY);
    if (G.stroke) inkMove(e.clientX, e.clientY);
  }
  function onUp(e) {
    if (!G.down) return; var t = G.down; G.down = null;
    var tool = curTool();
    if (tool.id === 'ink') { inkEnd(); return; }
    var power = chargeTool() ? clamp((performance.now() - t.t) / 900, 0, 1) : 0;
    fire(e.clientX, e.clientY, power);
  }
  function onCancel() { G.down = null; me.charge = 0; if (G.stroke) inkEnd(); }
  function onKey(e) {
    if (!G.on || e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key, inField = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && inOurs(e.target), onHud = e.target && inOurs(e.target) && e.target !== D.body;
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (G.panel) closePanel(); else if (G.pendingLink) { G.pendingLink = null; toast('Cancelled.'); } else stop(); return; }
    if (inField) { if (k === 'Enter') { e.preventDefault(); roomJoin(e.target.value); } return; }
    if (k === 'Tab' || k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End' || k === 'Shift' || k === 'Control' || k === 'Alt' || k === 'Meta') return;
    if (onHud && (k === 'Enter' || k === ' ')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (k >= '1' && k <= '5') pickTool(+k - 1);
    else if (k === 'q' || k === 'Q') cycleTool(1);
    else if (k === '[') { G.stampIdx = (G.stampIdx + STAMPS.length - 1) % STAMPS.length; toast('Stamp: <b>' + STAMPS[G.stampIdx][0] + '</b>', 1400); }
    else if (k === ']') { G.stampIdx = (G.stampIdx + 1) % STAMPS.length; toast('Stamp: <b>' + STAMPS[G.stampIdx][0] + '</b>', 1400); }
    else if (k === '?') togglePanel('help');
    else if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      var s = e.shiftKey ? 60 : 26; setAim(clamp((me.aimx || fx.w / 2) + (k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0), 0, fx.w), clamp((me.aimy || fx.h / 2) + (k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0), 0, fx.h));
    }
    else if (k === ' ' || k === 'Enter') { if (curTool().id === 'ink') { inkStart(me.aimx, me.aimy); inkMove(me.aimx + 60, me.aimy); inkEnd(); } else fire(me.aimx || fx.w / 2, me.aimy || fx.h / 2, 0); }
  }
  function onResize() { sizeCanvas(); updateFloor(); markF(); }

  function wipeAll(announceIt) {
    restoreAll(); fx.parts.length = 0; fx.proj.length = 0; clearDebris(); inks.length = 0; stamps.length = 0; pings.length = 0; G.vac = G.dec = null; G.pendingLink = null; G.stroke = null;
    F.v = F.shown = 1; markF();
    if (announceIt) { toast('The page is back as it was.'); netSend({ t: 'wipe' }); }
  }
  function afterChange() { markF(); }
  function milestones() {
    var v = F.v, m = G.mile;
    if (v < 0.9 && !m.first) { m.first = 1; toast('The first error. Now something has to notice.'); }
    if (v < 0.5 && !m.half) { m.half = 1; toast('Half the page is gone.'); }
    if (v < 0.12 && !m.low) { m.low = 1; toast('Almost nothing left to read.'); }
    if (v <= 0.02 && !m.zero) { m.zero = 1; stats.ruined++; saveStats(); toast('<b>Almost nothing is left.</b> Fully depolarising noise would leave every outcome equally likely: the maximally mixed state. Someone should fix this.', 7000); sfx.vacuum(); }
    if (v > 0.6) { m.zero = 0; m.low = 0; }
    if (v > 0.9 && m.half) { m.half = 0; m.first = 0; if (m.hadLow) { m.hadLow = 0; toast('<b>The logical qubit is restored.</b> That is the core of error correction: notice the errors, and undo them faster than they arrive.', 7000); } }
    if (v < 0.4) m.hadLow = 1;
  }

  function tick(ts) {
    if (!G.on) return; fx.raf = W.requestAnimationFrame(tick);
    var raw = (ts - fx.last) / 1000; fx.last = ts; var dt = clamp(raw || 0.016, 0.001, 0.05);
    fx.ema = fx.ema * 0.95 + raw * 1000 * 0.05; if (fx.ema > 40 && !fx.low && ++fx.slow > 45) { fx.low = true; } if (fx.ema < 26) fx.slow = 0;
    fx.t += dt; me.t += dt; fx.budget = fx.low ? 180 : 480;
    var dtp = dt; if (fx.hitstop > 0) { fx.hitstop -= dt; dtp = 0; }
    G.cool = Math.max(0, G.cool - dt);
    if (G.down && chargeTool()) me.charge = clamp((performance.now() - G.down.t) / 900, 0, 1); else me.charge = Math.max(0, me.charge - dt * 4);
    me.squash = Math.max(0, me.squash - dt * 6);
    var tx = clamp(me.aimx - 52, 20, fx.w - 20), ty = clamp(me.aimy + 36, 20, fx.h - 20);
    if (reduced()) { me.x = tx; me.y = ty; me.vx = me.vy = 0; } else { me.vx += ((tx - me.x) * 90 - me.vx * 11) * dt; me.vy += ((ty - me.y) * 90 - me.vy * 11) * dt; me.x += me.vx * dt; me.y += me.vy * dt; }
    stepModel(dtp); stepParts(dtp); stepWaves(dtp); stepStorm(dtp); shakeStep(dt);
    fx.gdir = Math.PI / 2 + (F.v < 0.55 && !reduced() ? Math.sin(fx.t * 0.35) * (0.55 - F.v) * 1.6 : 0);
    if (F.dirty) { F.dirty = false; F.v = computeF(); if (F.v < stats.minF) { stats.minF = F.v; saveStats(); } milestones(); checkUnlocks(); presence(false); }
    F.shown += (F.v - F.shown) * Math.min(1, dt * 7); if (Math.abs(F.v - F.shown) < 0.002) F.shown = F.v; updateMeter();
    pings.length = 0;
    if (G.side === 'd' && me.has) recs.forEach(function (r) { var rc = r.el.getBoundingClientRect(); for (var i = 0; i < r.holes.length && pings.length < 24; i++) { var o = r.holes[i]; if (o.cl) continue; var p = rectCenterRot(r, rc, o.u, o.v); if (hypot(p[0] - me.aimx, p[1] - me.aimy) < 260) pings.push({ x: p[0], y: p[1] }); } if ((r.x || r.z || r.g) && pings.length < 24) { var cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2; if (hypot(cx - me.aimx, cy - me.aimy) < 260) pings.push({ x: cx, y: cy }); } });
    netTick(dt);
    var g = fx.g; g.clearRect(0, 0, fx.w, fx.h);
    drawDecals(g); drawLinks(g); drawInks(g); drawStamps(g);
    if (fx.floorDirty) redrawFloor();
    if (fx.debris.length) g.drawImage(fx.floor, 0, 0, fx.floor.width, fx.floor.height, 0, 0, fx.w, fx.h);
    if (G.pendingLink) { var pr = G.pendingLink.getBoundingClientRect(); g.strokeStyle = COL.noise; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(pr.left, pr.top, pr.width, pr.height); g.setLineDash([]); }
    drawPings(g); drawParts(g);
    drawPeers(g);
    if (me.has) {
      var R = 0, id = curTool().id;
      if (id === 'blast') R = 46 + me.charge * 104; else if (id === 'repair') R = 70 + me.charge * 130; else if (id === 'flipx' || id === 'flipz' || id === 'patch') R = 0;
      drawReticle(g, me.aimx, me.aimy, R, sideCol());
      (G.side === 'n' ? drawNoise : drawDecoder)(g, me.x, me.y, me.t, me.charge, me.squash, 1, null);
    }
    drawGlobal(g, F.shown, dt);
  }

  function start(mode, opts) {
    opts = opts || {};
    var side = (mode === 'decoder' || mode === 'd' || mode === 'D') ? 'd' : 'n';
    if (G.on) { setSide(side); if (opts.room) roomJoin(opts.room); return Promise.resolve(api); }
    injectCSS();
    G.on = true; G.side = side; G.tool = 0; G.hud = true; G.pts = G.spent = 0; G.mile = {}; G.id = rid(); G.nameIdx = Math.floor(Math.random() * 1600); G.sound = !!stats.sound;
    G.prevFocus = D.activeElement; G.cool = 0; G.down = null; G.stroke = null; G.pendingLink = null; G.storm = null; G.lastType = '';
    fx.shake = 0; fx.hitstop = 0; fx.bars.length = 0; fx.ema = 16; fx.slow = 0; me.charge = 0; me.squash = 0; NET.round = null;
    fx.cv = el('canvas'); fx.cv.id = 'sqp-fx'; fx.cv.setAttribute('aria-hidden', 'true'); fx.cv.setAttribute('data-sqp-ignore', ''); D.body.appendChild(fx.cv); fx.g = fx.cv.getContext('2d'); sizeCanvas(); makeTiles();
    ui.input = el('div'); ui.input.id = 'sqp-input'; ui.input.setAttribute('aria-hidden', 'true'); ui.input.setAttribute('data-sqp-ignore', ''); D.body.appendChild(ui.input);
    buildUI(); updateFloor();
    ui.input.addEventListener('pointerdown', onDown); ui.input.addEventListener('pointermove', onMove); ui.input.addEventListener('pointerup', onUp); ui.input.addEventListener('pointercancel', onCancel);
    ui.input.addEventListener('contextmenu', function (e) { e.preventDefault(); if (G.lastType !== 'touch') cycleTool(1); });
    D.addEventListener('keydown', onKey, true); W.addEventListener('resize', onResize); W.addEventListener('pagehide', stop);
    fx.wrap = $('.wrap'); fx.wrapHadStyle = fx.wrap ? fx.wrap.hasAttribute('style') : false; fx.shakeOK = false;
    if (fx.wrap) { fx.shakeOK = true; var all = fx.wrap.querySelectorAll('*'); for (var i = 0; i < all.length && i < 3000; i++) { if (W.getComputedStyle(all[i]).position === 'fixed') { fx.shakeOK = false; break; } } }
    if (mo) mo.observe(D.body, { childList: true, subtree: true });
    me.aimx = fx.w * 0.5; me.aimy = fx.h * 0.5; me.x = me.aimx - 52; me.y = me.aimy + 36; me.has = false;
    F.v = F.shown = 1; F.dirty = true; fx.last = performance.now(); fx.raf = W.requestAnimationFrame(tick);
    toast(side === 'n' ? 'You are the <b>Noise</b>. Click things. <kbd style="font:inherit;opacity:.7">Esc</kbd> leaves and nothing is lost.' : 'You are the <b>Decoder</b>. Errors are marked in amber. Click to mend. <kbd style="font:inherit;opacity:.7">Esc</kbd> leaves.', 5200);
    if (!stats.seen) { stats.seen = true; saveStats(); }
    ui.bar.focus({ preventScroll: true });
    if (opts.room) roomJoin(opts.room);
    return Promise.resolve(api);
  }
  function stop() {
    if (!G.on) return; G.on = false;
    roomLeave(true);
    W.cancelAnimationFrame(fx.raf); D.removeEventListener('keydown', onKey, true); W.removeEventListener('resize', onResize); W.removeEventListener('pagehide', stop);
    if (mo) mo.disconnect();
    flushStats();
    restoreAll(); fx.parts.length = 0; fx.proj.length = 0; clearDebris(); inks.length = 0; stamps.length = 0; pings.length = 0; peers.clear(); G.vac = G.dec = G.storm = null;
    if (fx.wrap) { fx.wrap.style.translate = ''; if (!fx.wrapHadStyle && fx.wrap.getAttribute('style') === '') fx.wrap.removeAttribute('style'); }
    ['sqp-fx', 'sqp-input', 'sqp-root', 'sqp-css'].forEach(function (id) { var n = D.getElementById(id); if (n) n.remove(); });
    W.clearTimeout(ui.toastT); ui = {}; closeDoor();
    try { if (G.prevFocus && G.prevFocus.focus && D.contains(G.prevFocus)) G.prevFocus.focus({ preventScroll: true }); } catch (e) { }
  }


  var CFG = { online: false };
  var NET = { lastHi: 0, lastCur: 0, lastRoster: 0, round: null, synced: 0, lastSyncReply: -1e9, buckets: new Map(), all: { t: 300, at: 0 } };
  var MAXPEERS = 8;
  var CODE_RE = /^[A-Z]{4}-\d{2}$/, EID_RE = /^[0-9a-z]{1,8}\.\d{1,4}$/, ID_RE = /^[0-9a-f]{8}$/;
  function pathKey() { return fnv(W.location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/'); }
  function makeCode() { var L = 'ABCDEFGHJKMNPQRSTUVWXYZ', s = ''; for (var i = 0; i < 4; i++) s += L.charAt(Math.floor(Math.random() * L.length)); return s + '-' + (10 + Math.floor(Math.random() * 90)); }
  function inviteUrl() { return W.location.origin + W.location.pathname + '?play=' + G.room.code; }

  function localTransport(code) {
    if (!W.BroadcastChannel) return null;
    var bc = new W.BroadcastChannel('sqp:' + code + ':' + pathKey()), tp = { kind: 'local', onmsg: null };
    tp.send = function (o) { try { bc.postMessage(o); } catch (e) { } };
    tp.close = function () { try { bc.close(); } catch (e) { } };
    bc.onmessage = function (ev) { if (tp.onmsg) tp.onmsg(ev.data); };
    return tp;
  }
  function realtimeUrl() {
    var u = S.SUPABASE_URL, k = S.SUPABASE_ANON_KEY; if (!u || !k) return null;
    return u.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:').replace(/\/$/, '') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(k) + '&vsn=1.0.0';
  }
  function onlineTransport(code, done) {
    var url = realtimeUrl(); if (!url || !W.WebSocket) return null;
    var topic = 'realtime:sqp-' + code + '-' + pathKey(), ws, ref = 0, tp = { kind: 'online', ready: false, onmsg: null }, settle = done;
    function fin(ok) { if (settle) { var d = settle; settle = null; d(ok); } }
    function push(t, ev, payload) { ws.send(JSON.stringify({ topic: t, event: ev, payload: payload, ref: String(++ref), join_ref: '1' })); }
    try { ws = new W.WebSocket(url); } catch (e) { return null; }
    var giveUp = W.setTimeout(function () { fin(false); }, 6000);
    ws.onopen = function () {
      push(topic, 'phx_join', { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, private: false }, access_token: S.SUPABASE_ANON_KEY });
      tp.hb = W.setInterval(function () { if (ws.readyState === 1) ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) })); }, 25000);
    };
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.event === 'phx_reply' && m.topic === topic) { if (m.payload && m.payload.status === 'ok') { tp.ready = true; W.clearTimeout(giveUp); fin(true); } else fin(false); }
      else if (m.event === 'broadcast' && m.topic === topic && m.payload && m.payload.event === 'm' && tp.onmsg) tp.onmsg(m.payload.payload);
    };
    ws.onerror = function () { fin(false); };
    ws.onclose = function () { tp.dead = true; tp.ready = false; W.clearInterval(tp.hb); W.clearTimeout(giveUp); fin(false); if (G.room && G.room.tps.indexOf(tp) >= 0) { G.room.online = 'no'; NET.rosterDirty = true; } };
    tp.send = function (o) { if (tp.ready && ws.readyState === 1) push(topic, 'broadcast', { type: 'broadcast', event: 'm', payload: o }); };
    tp.close = function () { W.clearInterval(tp.hb); W.clearTimeout(giveUp); settle = null; try { if (ws.readyState === 1) push(topic, 'phx_leave', {}); ws.close(); } catch (e) { } };
    return tp;
  }

  function num(v, lo, hi, d) { v = +v; return isFinite(v) ? clamp(v, lo, hi) : d; }
  function cleanEid(v) { return typeof v === 'string' && EID_RE.test(v) ? v : null; }
  function sane(m) {
    if (!m || typeof m !== 'object' || m._v !== 1 || typeof m.id !== 'string' || !ID_RE.test(m.id)) return null;
    var o = { id: m.id, t: m.t }, i;
    switch (m.t) {
      case 'hi': o.n = num(m.n, 0, 99999, 0) | 0; o.s = m.s === 'd' ? 'd' : 'n'; break;
      case 'bye': case 'wipe': break;
      case 'sync?': o.n = num(m.n, 0, 1e9, 0) | 0; break;
      case 'c': o.e = cleanEid(m.e); o.u = num(m.u, -3, 4, 0.5); o.v = num(m.v, -3, 4, 0.5); o.s = m.s === 'd' ? 'd' : 'n'; o.ch = num(m.ch, 0, 1, 0); break;
      case 'hit':
        if (!Array.isArray(m.a)) return null;
        o.a = m.a.slice(0, 14).map(function (q) { var e = cleanEid(q && q.e); if (!e) return null; return { e: e, u: num(q.u, -3, 4, 0.5), v: num(q.v, -3, 4, 0.5), r: num(q.r, 0, 260, 0), k: q.k === 'z' ? 'z' : q.k === 'b' ? 'b' : q.k === 'g' ? 'g' : 'x' }; }).filter(Boolean);
        if (!o.a.length) return null; break;
      case 'fix': o.e = cleanEid(m.e); o.u = num(m.u, -3, 4, 0.5); o.v = num(m.v, -3, 4, 0.5); o.r = num(m.r, 10, 320, 90); break;
      case 'patch': o.e = cleanEid(m.e); if (!o.e) return null; o.d = [3, 5, 7].indexOf(m.d | 0) >= 0 ? (m.d | 0) : 3; break;
      case 'ink':
        o.e = cleanEid(m.e); if (!o.e || !Array.isArray(m.p)) return null;
        o.p = m.p.slice(0, 64).map(function (q) { return Array.isArray(q) ? [num(q[0], -3, 4, 0.5), num(q[1], -3, 4, 0.5)] : null; }).filter(Boolean); if (o.p.length < 2) return null; break;
      case 'stamp': o.e = cleanEid(m.e); if (!o.e) return null; o.u = num(m.u, -3, 4, 0.5); o.v = num(m.v, -3, 4, 0.5); o.g = num(m.g, 0, STAMPS.length - 1, 0) | 0; break;
      case 'link': o.e = cleanEid(m.e); o.e2 = cleanEid(m.e2); if (!o.e || !o.e2) return null; break;
      case 'vac': case 'dec': o.e = cleanEid(m.e); o.u = num(m.u, -3, 4, 0.5); o.v = num(m.v, -3, 4, 0.5); break;
      case 'sync':
        if (typeof m.to !== 'string' || !ID_RE.test(m.to) || !m.s || typeof m.s !== 'object') return null; o.to = m.to; o.s = { r: [], k: [], st: [], lk: [] };
        for (i = 0; i < Math.min(300, (m.s.r || []).length); i++) { var q = m.s.r[i], e = cleanEid(q && q.e); if (!e) continue; o.s.r.push({ e: e, h: (Array.isArray(q.h) ? q.h : []).slice(0, MAXHOLES).map(function (h) { return Array.isArray(h) ? [num(h[0], -3, 4, 0.5), num(h[1], -3, 4, 0.5), num(h[2], 0, 260, 40)] : null; }).filter(Boolean), x: q.x ? 1 : 0, z: q.z ? 1 : 0, g: q.g ? 1 : 0, p: [3, 5, 7].indexOf(q.p | 0) >= 0 ? (q.p | 0) : 0 }); }
        for (i = 0; i < Math.min(60, (m.s.k || []).length); i++) { var k = m.s.k[i], ke = cleanEid(k && k.e); if (ke && Array.isArray(k.p)) o.s.k.push({ e: ke, p: k.p.slice(0, 64).map(function (a) { return Array.isArray(a) ? [num(a[0], -3, 4, 0.5), num(a[1], -3, 4, 0.5)] : null; }).filter(Boolean) }); }
        for (i = 0; i < Math.min(80, (m.s.st || []).length); i++) { var s = m.s.st[i], se = cleanEid(s && s.e); if (se) o.s.st.push({ e: se, u: num(s.u, -3, 4, 0.5), v: num(s.v, -3, 4, 0.5), g: num(s.g, 0, STAMPS.length - 1, 0) | 0 }); }
        for (i = 0; i < Math.min(60, (m.s.lk || []).length); i++) { var l = m.s.lk[i], a1 = cleanEid(l && l[0]), a2 = cleanEid(l && l[1]); if (a1 && a2) o.s.lk.push([a1, a2]); }
        break;
      case 'round': o.p = m.p === 'end' ? 'end' : 'start'; o.d = num(m.d, 10, 600, 90); o.F = num(m.F, 0, 1, 1); break;
      default: return null;
    }
    return o;
  }
  var HEAVY = { hit: 1, fix: 1, patch: 1, ink: 1, stamp: 1, link: 1, vac: 1, dec: 1, sync: 1, 'sync?': 1, round: 1, wipe: 1 };
  function allowed(id, type) {
    var cost = HEAVY[type] ? 6 : 1, now = performance.now(), g = NET.all, b = NET.buckets.get(id);
    g.t = Math.min(300, g.t + (now - g.at) / 1000 * 240); g.at = now;
    if (!b) { if (NET.buckets.size >= 64) NET.buckets.delete(NET.buckets.keys().next().value); b = { t: 60, at: now }; NET.buckets.set(id, b); }
    b.t = Math.min(90, b.t + (now - b.at) / 1000 * 70); b.at = now;
    if (b.t < cost || g.t < cost) return false;
    b.t -= cost; g.t -= cost; return true;
  }

  netSend = function () {};
  function presence(now) {
    if (!G.room) return; var t = performance.now(); if (!now && t - NET.lastHi < 2500) return; NET.lastHi = t;
    netSend({ t: 'hi', n: G.nameIdx, s: G.side });
  }
  var netCursorNow = function () {};
  function cursorMsg() {
    var e = targetAt(me.aimx, me.aimy), m = { t: 'c', s: G.side, ch: +me.charge.toFixed(2) };
    if (e) { var p = relOf(e, me.aimx, me.aimy), eid = eidOf(e); if (eid) { m.e = eid; m.u = +p.u.toFixed(3); m.v = +p.v.toFixed(3); return m; } }
    m.e = null; m.u = +(me.aimx / fx.w).toFixed(3); m.v = +(me.aimy / fx.h).toFixed(3); return m;
  }
  function netTick(dt) {
    if (!G.room) return; var t = performance.now();
    if (me.has && t - NET.lastCur > 80) { NET.lastCur = t; netSend(cursorMsg()); }
    presence(false);
    peers.forEach(function (p, id) { if (t - p.seen > 9000) { peers.delete(id); NET.rosterDirty = true; } });
    if (NET.rosterDirty || t - NET.lastRoster > 500) { NET.lastRoster = t; NET.rosterDirty = false; drawRoster(); }
    if (NET.round) {
      var left = NET.round.dur - (Date.now() - NET.round.t0);
      if (left <= -1500 && !NET.round.ended) endRound(F.v, false);
      else if (left <= 0 && NET.round.mine && !NET.round.ended) { netSend({ t: 'round', p: 'end', F: +F.v.toFixed(3) }); endRound(F.v, true); }
    }
  }
  netCursorNow = function () { if (G.room && me.has) { NET.lastCur = performance.now(); netSend(cursorMsg()); } };

  function drawRoster() {
    if (!ui.roster) return; var h = '';
    if (NET.round && !NET.round.ended) { var left = Math.max(0, Math.ceil((NET.round.dur - (Date.now() - NET.round.t0)) / 1000)); h += '<div class="sqp-timer" aria-hidden="true">round ' + left + ' s</div>'; }
    if (G.room) { h += '<div class="sqp-p"><i style="background:' + sideCol() + '"></i>You · ' + nameOf(G.nameIdx) + '</div>'; peers.forEach(function (p) { h += '<div class="sqp-p"><i style="background:' + (p.s === 'd' ? COL.dec : COL.noise) + '"></i>' + nameOf(p.n) + '</div>'; }); h += '<div class="sqp-p" style="opacity:.8">room ' + G.room.code + ' · ' + (G.room.online === 'yes' ? 'online' : G.room.online === 'checking' ? 'connecting' : 'this device') + '</div>'; }
    ui.roster.innerHTML = h;
  }
  function peerPos(p) {
    if (p.e) { var e = elOf(p.e); if (e) { var rc = e.getBoundingClientRect(); return [rc.left + p.u * rc.width, rc.top + p.v * rc.height]; } }
    return p.e ? null : [p.u * fx.w, p.v * fx.h];
  }
  function drawPeers(g) {
    peers.forEach(function (p) {
      var pos = peerPos(p); if (!pos) return;
      p.x = p.x == null ? pos[0] : lerp(p.x, pos[0], 0.35); p.y = p.y == null ? pos[1] : lerp(p.y, pos[1], 0.35);
      var col = p.s === 'd' ? COL.dec : COL.noise;
      drawReticle(g, p.x, p.y, 0, col);
      (p.s === 'd' ? drawDecoder : drawNoise)(g, p.x - 40, p.y + 28, me.t + p.n, p.ch || 0, 0, 0.78, nameOf(p.n));
    });
  }

  function pointOf(e, u, v) { var rc = e.getBoundingClientRect(); return [rc.left + u * rc.width, rc.top + v * rc.height]; }
  function applyHit(q) {
    var e = elOf(q.e); if (!e) return; var pt = pointOf(e, q.u, q.v), res = hitElement(e, q.k, q.u, q.v, q.r);
    if (res.absorbed) { announceHit(e, res, pt[0], pt[1], q.r, q.k); return; }
    if (q.k === 'x' || q.k === 'z') { sparks(pt[0], pt[1], q.k === 'x' ? COL.noise : COL.amber, 12, 220); ringFx(pt[0], pt[1], 38, q.k === 'x' ? COL.noise : COL.amber, 0.4, 2); sfx.zap(); }
    else if (q.k === 'b') { if (!res.gone) scatter(e, pt[0], pt[1], q.r, 430, 40); ringFx(pt[0], pt[1], q.r * 1.2, COL.noise, 0.45, 3); sfx.thud(0.3); }
    announceHit(e, res, pt[0], pt[1], q.r, q.k);
  }
  function applyFix(m) {
    var e = m.e ? elOf(m.e) : null, x, y;
    if (m.e && !e) return;
    if (e) { var pt = pointOf(e, m.u, m.v); x = pt[0]; y = pt[1]; } else { x = m.u * fx.w; y = m.v * fx.h; }
    var res = fixIn(x, y, m.r); ringFx(x, y, m.r, COL.dec, 0.5, 2.5);
    for (var i = 0; i < res.holes.length; i++) { var h = res.holes[i]; gather(h.e, h.x, h.y, h.whole ? Math.max(h.r * 1.3, 40) : h.r * 1.15, 0.7, h.whole ? 120 : 60); }
    if (res.holes.length || res.flags) sfx.mend(res.holes.length + res.flags);
  }
  function collectState() {
    var s = { r: [], k: [], st: [], lk: [] }, seen = new Set();
    recs.forEach(function (r) {
      var eid = eidOf(r.el); if (!eid || s.r.length >= 300) return;
      s.r.push({ e: eid, h: r.holes.filter(function (o) { return !o.cl; }).map(function (o) { return [+o.u.toFixed(3), +o.v.toFixed(3), Math.round(o.r)]; }), x: r.x, z: r.z, g: r.g, p: r.patch ? r.patch.d : 0 });
      if (r.link && !seen.has(r)) { var e2 = eidOf(r.link.el); if (e2) s.lk.push([eid, e2]); seen.add(r); seen.add(r.link); }
    });
    inks.slice(-60).forEach(function (k) { var eid = eidOf(k.e); if (eid) { var step = Math.max(1, Math.ceil(k.pts.length / 60)), p = []; for (var i = 0; i < k.pts.length; i += step) p.push([+k.pts[i][0].toFixed(3), +k.pts[i][1].toFixed(3)]); if (p.length > 1) s.k.push({ e: eid, p: p }); } });
    stamps.slice(-80).forEach(function (t) { var eid = eidOf(t.e); if (eid) s.st.push({ e: eid, u: +t.u.toFixed(3), v: +t.v.toFixed(3), g: t.g }); });
    return s;
  }
  function applyState(s) {
    var i;
    for (i = 0; i < s.r.length; i++) {
      var q = s.r[i], e = elOf(q.e); if (!e) continue; var r = recOf(e, true); measure(r);
      r.holes = q.h.map(function (h) { return { u: h[0], v: h[1], r: h[2], s: 1, cl: 0 }; }); r.x = q.x; r.z = q.z; r.g = q.g; r.fa = q.g ? 0 : 1; if (q.p) r.patch = { d: q.p, hp: (q.p - 1) / 2, max: (q.p - 1) / 2, flash: 0 }; r.dirty = true;
    }
    for (i = 0; i < s.lk.length; i++) { var a = elOf(s.lk[i][0]), b = elOf(s.lk[i][1]); if (a && b) linkPair(a, b, false); }
    for (i = 0; i < s.k.length; i++) { var ke = elOf(s.k[i].e); if (ke) inks.push({ e: ke, pts: s.k[i].p }); }
    for (i = 0; i < s.st.length; i++) { var se = elOf(s.st[i].e); if (se) stamps.push({ e: se, u: s.st[i].u, v: s.st[i].v, g: s.st[i].g }); }
    markF();
  }
  function onNetMsg(raw) {
    var m = sane(raw); if (!m || m.id === G.id || !G.on || !G.room) return;
    if (!allowed(m.id, m.t)) return;
    NET.acc = (NET.acc | 0) + 1;
    var t = performance.now(), p = peers.get(m.id);
    if (m.t === 'bye') { if (p) { peers.delete(m.id); NET.rosterDirty = true; } return; }
    if (!p && peers.size >= MAXPEERS) return;
    if (!p) { p = { id: m.id, n: 0, s: 'n', seen: t, e: null, u: 0.5, v: 0.5, ch: 0, x: null, y: null }; peers.set(m.id, p); NET.rosterDirty = true; toast('Someone joined the room.', 2200); presence(true); }
    p.seen = t;
    switch (m.t) {
      case 'hi': if (p.n !== m.n || p.s !== m.s) NET.rosterDirty = true; p.n = m.n; p.s = m.s; break;
      case 'c': p.e = m.e; p.u = m.u; p.v = m.v; p.s = m.s; p.ch = m.ch; break;
      case 'hit': for (var i = 0; i < m.a.length; i++) applyHit(m.a[i]); break;
      case 'fix': applyFix(m); break;
      case 'patch': { var e = elOf(m.e); if (e) { var r = recOf(e, true); measure(r); r.patch = { d: m.d, hp: (m.d - 1) / 2, max: (m.d - 1) / 2, flash: 1 }; r.dirty = true; sfx.mend(1); } break; }
      case 'ink': { var ie = elOf(m.e); if (ie) inks.push({ e: ie, pts: m.p }); break; }
      case 'stamp': { var se = elOf(m.e); if (se) { stamps.push({ e: se, u: m.u, v: m.v, g: m.g }); var sp = pointOf(se, m.u, m.v); sparks(sp[0], sp[1], STAMPS[m.g][1], 8, 140); } break; }
      case 'link': { var a = elOf(m.e), b = elOf(m.e2); if (a && b) linkPair(a, b, true); break; }
      case 'vac': { var ve = m.e ? elOf(m.e) : null, vp = ve ? pointOf(ve, m.u, m.v) : [m.u * fx.w, m.v * fx.h]; doVacuum(vp[0], vp[1]); break; }
      case 'dec': { var de = m.e ? elOf(m.e) : null, dp = de ? pointOf(de, m.u, m.v) : [m.u * fx.w, m.v * fx.h]; doDecode(dp[0], dp[1]); break; }
      case 'wipe': wipeAll(false); toast('Someone restored the page.'); break;
      case 'sync?': if ((recs.size || inks.length || stamps.length) && t - NET.lastSyncReply > 3000) { NET.lastSyncReply = t; W.setTimeout(function () { if (G.room) netSend({ t: 'sync', to: m.id, s: collectState() }); }, Math.random() * 300); } break;
      case 'sync': if (m.to === G.id && t - NET.synced > 2000) { NET.synced = t; applyState(m.s); toast('Caught up with the room.', 1800); } break;
      case 'round': if (m.p === 'start') beginRound(m.d, false); else endRound(m.F, false); break;
    }
    afterChange();
  }

  function beginRound(dur, mine) {
    NET.round = { t0: Date.now(), dur: dur * 1000, mine: mine, ended: false };
    toast('<b>Round.</b> ' + dur + ' seconds. Under 50% page health at the end, the Noise wins; 50% or more, the Decoders.', 5000); NET.rosterDirty = true;
  }
  function roundStart() { if (!G.room) return; closePanel(); beginRound(90, true); netSend({ t: 'round', p: 'start', d: 90 }); }
  function endRound(Fv, mine) {
    if (!NET.round || NET.round.ended) return; NET.round.ended = true; var win = Fv < 0.5 ? 'n' : 'd';
    toast('<b>Time.</b> Page health ' + Math.round(Fv * 100) + '%. The <b style="color:' + (win === 'n' ? COL.noise : COL.dec) + '">' + (win === 'n' ? 'Noise' : 'Decoders') + '</b> win' + (win === G.side ? ' — and that is you.' : '.'), 7000);
    sfx.unlock(); W.setTimeout(function () { NET.round = null; NET.rosterDirty = true; }, 200);
  }

  function roomStart() { roomJoin(makeCode()); }
  function roomJoin(code) {
    code = String(code || '').toUpperCase().replace(/\s+/g, '').trim(); if (/^[A-Z]{4}\d{2}$/.test(code)) code = code.slice(0, 4) + '-' + code.slice(4);
    if (!CODE_RE.test(code)) { toast('A room code looks like <b>KQTR-42</b>.'); return; }
    if (G.room) roomLeave(true);
    var L = localTransport(code), tps = [], room;
    if (L) tps.push(L);
    room = { code: code, tps: tps, online: CFG.online ? 'checking' : 'off' };
    G.room = room;
    if (L) L.onmsg = onNetMsg;
    netSend = function (o) { var r = G.room; if (!r) return; o._v = 1; o.id = G.id; for (var i = 0; i < r.tps.length; i++) r.tps[i].send(o); };
    var O = !CFG.online ? null : onlineTransport(code, function (ok) {
      if (G.room !== room) return;
      room.online = ok ? 'yes' : 'no'; NET.rosterDirty = true;
      if (ok) { toast('Online relay connected. Other devices can join <b>' + code + '</b>.', 3200); W.setTimeout(function () { if (G.room === room) netSend({ t: 'sync?', n: 1 }); }, 250); }
      else if (G.panel) togglePanel('help', true);
    });
    if (O) { O.onmsg = onNetMsg; tps.push(O); } else room.online = CFG.online ? 'no' : 'off';
    if (!tps.length) { G.room = null; netSend = function () {}; toast(CFG.online ? 'Rooms need a browser with BroadcastChannel or WebSocket. This one has neither.' : 'Rooms need a browser with BroadcastChannel. This one has none.'); return; }
    NET.synced = 0; presence(true); W.setTimeout(function () { if (G.room === room) netSend({ t: 'sync?', n: 1 }); }, 150);
    toast(CFG.online ? 'In room <b>' + code + '</b>. Share the link and it opens on this same page.' : 'In room <b>' + code + '</b>. Use "Open a second window" to join it from this browser.'); drawRoster(); if (G.panel) togglePanel('help', true);
  }
  function roomLeave(quiet) {
    if (!G.room) return; try { netSend({ t: 'bye' }); } catch (e) { }
    G.room.tps.forEach(function (tp) { tp.onmsg = null; tp.close(); }); G.room = null; peers.clear(); NET.round = null; netSend = function () {}; NET.rosterDirty = true;
    if (ui.roster) ui.roster.innerHTML = ''; if (!quiet) toast('Left the room.');
  }
  function copyInvite() {
    if (!G.room) return; var u = inviteUrl();
    try { if (W.navigator.clipboard) { W.navigator.clipboard.writeText(u).then(function () { toast('Invite link copied.'); }, function () { toast('Copy this: ' + esc(u)); }); return; } } catch (e) { }
    toast('Copy this: ' + esc(u));
  }
  function openWindow() { if (!G.room) return; W.open(inviteUrl(), '_blank', 'noopener'); }
  function closeDoor() { var d = $('.sqp-door'); if (d) d.remove(); }

  api.start = start; api.stop = stop; api.unlockAll = unlockAll;
  api.state = function () { return { on: G.on, side: G.side, F: F.v, room: G.room && G.room.code, peers: peers.size }; };
  api.__t = { recs: recs, computeF: computeF, F: F, G: G, stats: stats, fx: fx, me: me, land: land, fire: fire, targetAt: targetAt, targetsIn: targetsIn, eidOf: eidOf, elOf: elOf, hitElement: hitElement, fixIn: fixIn,
              wipeAll: wipeAll, peers: peers, NET: NET, collectState: collectState, applyState: applyState, sane: sane, roomJoin: roomJoin, roomLeave: roomLeave, inks: inks, stamps: stamps, pickTool: pickTool, setSide: setSide,
              TOOLS: TOOLS, CFG: CFG, healAll: healAll, clearDebris: clearDebris, doBlast: doBlast, doFlip: doFlip, doRepair: doRepair, doPatch: doPatch, stepModel: stepModel, roundStart: roundStart, onNetMsg: onNetMsg };
  api.__ready = true;
  S.play = api;
})();
