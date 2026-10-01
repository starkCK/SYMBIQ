(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  var KMAX = 5;
  function dot(a, b) { var s = 0, i; for (i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function norm2(a) { return dot(a, a); }
  function cloneB(B) { return B.map(function (v) { return v.slice(); }); }
  function key(B) { return B.map(function (v) { return v.join(','); }).join('|'); }
  function apply(B, mv) {
    var C = cloneB(B), d;
    if (mv.t === 'swap') { var t = C[mv.i]; C[mv.i] = C[mv.j]; C[mv.j] = t; }
    else for (d = 0; d < C[mv.i].length; d++) C[mv.i][d] += mv.k * C[mv.j][d];
    return C;
  }
  function allMoves(n) {
    var out = [], i, j, k;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (i !== j) for (k = -KMAX; k <= KMAX; k++) if (k) out.push({ t: 'add', i: i, j: j, k: k });
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) out.push({ t: 'swap', i: i, j: j });
    return out;
  }
  function det2(B) { return B[0][0] * B[1][1] - B[0][1] * B[1][0]; }
  function shortest2(R, box) {
    var n = R.length, c = new Array(n).fill(-box), best = Infinity, bestV = null, d;
    for (;;) {
      var nz = false, v = new Array(R[0].length).fill(0);
      for (d = 0; d < n; d++) { if (c[d]) nz = true; for (var e = 0; e < v.length; e++) v[e] += c[d] * R[d][e]; }
      if (nz) { var s = norm2(v); if (s < best) { best = s; bestV = v; } }
      var i = 0; for (; i < n; i++) { if (c[i] < box) { c[i]++; break; } c[i] = -box; } if (i === n) break;
    }
    return { norm2: best, v: bestV };
  }
  function solved(L, B) { return norm2(B[0]) === L.lam; }
  function bfs(L, start, maxDepth) {
    var moves = allMoves(start.length), seen = new Set([key(start)]), frontier = [start], depth = 0, visited = 1;
    if (solved(L, start)) return { moves: 0, visited: 1 };
    while (frontier.length && depth < maxDepth) {
      depth++; var next = [];
      for (var f = 0; f < frontier.length; f++) for (var m = 0; m < moves.length; m++) {
        var C = apply(frontier[f], moves[m]), k = key(C);
        if (seen.has(k)) continue;
        seen.add(k); visited++;
        if (solved(L, C)) return { moves: depth, visited: visited };
        next.push(C);
      }
      frontier = next;
    }
    return { moves: null, visited: visited };
  }
  function greedy(L, start, cap) {
    var B = cloneB(start), n = B.length, moves = 0, changed = true, guard = 0;
    while (changed && guard++ < 200 && !solved(L, B)) {
      changed = false;
      var order = B.map(function (v, i) { return i; }).sort(function (a, b) { return norm2(B[a]) - norm2(B[b]) || a - b; });
      for (var a = 0; a < n && !solved(L, B); a++) for (var b = a + 1; b < n && !solved(L, B); b++) {
        var i = order[a], j = order[b], q = Math.round(dot(B[j], B[i]) / norm2(B[i]));
        while (q !== 0) { var k = Math.max(-KMAX, Math.min(KMAX, -q)); B = apply(B, { t: 'add', i: j, j: i, k: k }); q += k; moves++; changed = true; }
      }
      if (solved(L, B)) break;
      var short = 0; for (var s = 1; s < n; s++) if (norm2(B[s]) < norm2(B[short])) short = s;
      if (short !== 0 && !solved(L, B)) { B = apply(B, { t: 'swap', i: 0, j: short }); moves++; changed = true; }
    }
    return { moves: solved(L, B) ? moves : null, basis: B };
  }
  function medalOf(moves, par) { return moves <= par ? 'gold' : moves <= par + 2 ? 'silver' : 'bronze'; }

  function gen(seed, k) {
    var r = (function (a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(seed >>> 0);
    var ri = function (a, b) { return a + Math.floor(r() * (b - a + 1)); }, t, i, j;
    var dim = (k >= 3 && r() < 0.5) ? 3 : 2;
    for (t = 0; t < 4000; t++) {
      var Rb = [];
      for (i = 0; i < dim; i++) { var v = []; for (j = 0; j < dim; j++) v.push(ri(-5, 5)); Rb.push(v); }
      Rb.sort(function (a, b) { return norm2(a) - norm2(b); });
      var ok = norm2(Rb[0]) >= 2;
      for (i = 0; i < dim; i++) for (j = i + 1; j < dim; j++) if (2 * Math.abs(dot(Rb[i], Rb[j])) > norm2(Rb[i])) ok = false;
      if (!ok) continue;
      if (dim === 2 ? det2(Rb) === 0 : (Rb[0][0] * (Rb[1][1] * Rb[2][2] - Rb[1][2] * Rb[2][1]) - Rb[0][1] * (Rb[1][0] * Rb[2][2] - Rb[1][2] * Rb[2][0]) + Rb[0][2] * (Rb[1][0] * Rb[2][1] - Rb[1][1] * Rb[2][0])) === 0) continue;
      var lam = shortest2(Rb, 8).norm2;
      if (shortest2(Rb, 12).norm2 !== lam || lam !== norm2(Rb[0])) continue;
      var L = { id: 'gen', name: 'Endless ' + (k + 1), dim: dim, lam: lam, reduced: Rb, start: null, par: 0, window: 0, brief: '' };
      var B = cloneB(Rb), mv = allMoves(dim), m = dim === 2 ? 4 + Math.min(3, Math.floor(k / 2)) : 3;
      for (i = 0; i < m; i++) B = apply(B, mv[ri(0, mv.length - 1)]);
      if (solved(L, B)) continue;
      var parv;
      if (dim === 2) { var bf = bfs(L, B, 5); if (bf.moves == null || bf.moves < 3) continue; parv = bf.moves; }
      else { if (bfs(L, B, 2).moves != null) continue; parv = 3; }
      var mx = 0; Rb.forEach(function (vv) { vv.forEach(function (x) { mx = Math.max(mx, Math.abs(x)); }); });
      L.start = B; L.par = parv; L.window = 3 * mx + 2;
      L.brief = 'A generated vault in ' + dim + ' dimensions. The fewest moves that open it are found by exhaustive search before you see it.';
      return L;
    }
    return null;
  }

  var engine = { gen: gen, KMAX: KMAX, dot: dot, norm2: norm2, apply: apply, allMoves: allMoves, key: key, shortest2: shortest2, solved: solved, bfs: bfs, greedy: greedy, medalOf: medalOf, det2: det2 };

  var LEVELS = [
    { id: 'warm', name: 'The first vault', dim: 2, window: 17, lam: 29, par: 4,
      reduced: [[-5, -2], [-2, 5]],
      start: [[-106, 91], [97, -83]],
      brief: 'Two long, nearly parallel vectors span a lattice with a short vector hiding inside it.' },
    { id: 'skew', name: 'The skewed vault', dim: 2, window: 17, lam: 9, par: 4,
      reduced: [[0, 3], [5, -1]],
      start: [[125, -274], [-140, 307]],
      brief: 'The same trick with longer vectors. Look at the multiple that brings one closest to zero.' },
    { id: 'needle', name: 'The needle vault', dim: 2, window: 17, lam: 17, par: 5,
      reduced: [[1, 4], [5, -3]],
      start: [[-477, 185], [629, -244]],
      brief: 'Vectors in the hundreds, a shortest vector of length about four. It takes more than one round of the recipe.' },
    { id: 'three', name: 'Three dimensions', dim: 3, window: 17, lam: 30, par: 3,
      reduced: [[2, -5, -1], [5, 1, 2], [-1, 3, -5]],
      start: [[22, -1, 7], [-237, 12, -75], [9, 5, -1]],
      brief: 'Three vectors. Following the two-dimensional recipe takes 15 moves here; the par is 3.' },
    { id: 'deep', name: 'The deep vault', dim: 3, window: 17, lam: 20, par: 4,
      reduced: [[2, -4, 0], [5, 1, 2], [3, 4, -5]],
      start: [[-184, -315, 319], [425, 727, -736], [-54, -93, 93]],
      brief: 'A long basis of a small lattice. The recipe takes 15 moves; the par is 4.' }
  ];
  engine.LEVELS = LEVELS;

  var def = {
    id: 'lattice', title: 'Lattice Heist', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'The vault\'s secret is the shortest vector of a lattice, hidden behind a long, skewed basis. Find the short one in the fewest moves.',
    about: {
      goal: 'Make the first basis vector a shortest nonzero vector of the lattice, using as few moves as possible. Each move keeps the lattice exactly the same.',
      how: 'Choose <strong>which vector to change</strong>, <strong>which one to use</strong> and a whole number <strong>k</strong> (up to 5 either way), then <strong>Add</strong>: b<sub>i</sub> becomes b<sub>i</sub> + k b<sub>j</sub>. Or <strong>swap</strong> two. <strong>Undo</strong> takes a move back.',
      inspired: 'Lagrange and Gauss&rsquo;s reduction in the plane and the Lenstra-Lenstra-Lov&aacute;sz algorithm (1982) beyond it. The lattice problems under ML-KEM and ML-DSA are the same idea in hundreds of dimensions.',
      learn: 'Why one lattice can have a terrible basis and a lovely one, what the two-dimensional recipe is, and why the same recipe does not simply scale up.',
      link: 'pqc.html', linkText: 'The post-quantum page ▸', tier: 'Proven',
      or: 'Finding the fewest moves through a space of states is a search problem, an operations-research one'
    },
    honest: 'Honest model: the lattices are tiny (two and three dimensions) so that every move can be tried; the par is the fewest moves found by breadth-first search over all reachable bases, so nothing shorter exists. The real problems under the post-quantum standards are in hundreds of dimensions with noise added, and nothing here measures their difficulty.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, B = [], hist = [], done = false;
    var KEY = 'lattice', cur = null, mode = 'ladder', ek = 0, nonce = (Date.now() % 1000000007) >>> 0;
    var EN = W.SymbiQ.endless;
    function cL() { return cur || LEVELS[lvl]; }
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'ltc';
    root.appendChild(wrap);
    var sel = { i: 1, j: 0, k: -1 };

    function ladderState() { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.ladder ? f.ladder.state(KEY) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function resume() { var st = ladderState(), r = 0; for (var q = 1; q <= LEVELS.length; q++) if (st.cleared[q]) r = Math.min(q, LEVELS.length - 1); return r; }

    function picture(L) {
      if (L.dim !== 2) return '';
      var Wd = L.window, S = 300, sc = S / (2 * Wd), pts = '', a, b, R = L.reduced;
      for (a = -12; a <= 12; a++) for (b = -12; b <= 12; b++) {
        var x = a * R[0][0] + b * R[1][0], y = a * R[0][1] + b * R[1][1];
        if (Math.abs(x) <= Wd && Math.abs(y) <= Wd) pts += '<circle cx="' + (S / 2 + x * sc).toFixed(1) + '" cy="' + (S / 2 - y * sc).toFixed(1) + '" r="2.2" class="lt-pt"/>';
      }
      var arrows = B.map(function (v, idx) {
        var m = Math.max(Math.abs(v[0]), Math.abs(v[1])), f = m > Wd ? Wd / m : 1, ex = S / 2 + v[0] * f * sc, ey = S / 2 - v[1] * f * sc;
        return '<line x1="' + S / 2 + '" y1="' + S / 2 + '" x2="' + ex.toFixed(1) + '" y2="' + ey.toFixed(1) + '" class="lt-arr lt-a' + idx + '"/><circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4" class="lt-end lt-a' + idx + '"/>' +
          '<text x="' + (ex + 6).toFixed(1) + '" y="' + (ey - 6).toFixed(1) + '" class="lt-lab">b' + (idx + 1) + (f < 1 ? ' (runs off)' : '') + '</text>';
      }).join('');
      return '<svg class="lt-svg" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="The lattice points near the origin and the current basis vectors. The text below gives the exact vectors."><rect x="0" y="0" width="' + S + '" height="' + S + '" class="lt-bg"/>' + pts + arrows + '<circle cx="' + S / 2 + '" cy="' + S / 2 + '" r="3" class="lt-o"/></svg>';
    }
    function paint() {
      var L = cL(), st = ladderState(), n = L.dim, isDone = solved(L, B);
      var html = (EN ? EN.bar(mode) : '') + (mode !== 'ladder' ? EN.line(KEY, mode, ek) : '<div class="lt-strip" role="list" aria-label="The vaults">' + LEVELS.map(function (l, k) {
        var med = st.medal[k + 1], glyph = med ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[med] : (unlocked(k + 1) ? (k + 1) : '🔒');
        return '<button type="button" role="listitem" class="lt-chip' + (k === lvl ? ' now' : '') + '" data-lv="' + k + '"' + (unlocked(k + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(k + 1) ? '' : ', locked') + '">' + glyph + (EN ? ' <small>' + EN.tierOf(k, LEVELS.length) + '</small>' : '') + ' ' + esc(l.name) + '</button>';
      }).join('') + '</div>') + '<p class="lt-brief">' + L.brief + '</p>' +
        '<p class="lt-facts"><b>Dimension</b> ' + n + ' &middot; <b>The shortest vector</b> has length&sup2; <b>' + L.lam + '</b> &middot; <b>Par</b> ' + L.par + ' moves (proven fewest) &middot; <b>Your moves</b> <b class="lt-mv">' + hist.length + '</b></p>';
      html += '<div class="lt-body">' + picture(L) + '<ol class="lt-vecs">' + B.map(function (v, idx) {
        var l2 = norm2(v); return '<li class="lt-v' + (idx === 0 && isDone ? ' win' : '') + '"><b>b' + (idx + 1) + '</b> = (' + v.join(', ') + ') &middot; length&sup2; <b>' + l2 + '</b>' + (l2 === L.lam ? ' <span class="lt-hit">a shortest vector</span>' : '') + '</li>';
      }).join('') + '</ol></div>';
      if (!done) {
        var opts = function (name, cur) { var o = ''; for (var q = 0; q < n; q++) o += '<option value="' + q + '"' + (q === cur ? ' selected' : '') + '>b' + (q + 1) + '</option>'; return o; };
        var ks = ''; for (var k2 = -KMAX; k2 <= KMAX; k2++) if (k2) ks += '<option value="' + k2 + '"' + (k2 === sel.k ? ' selected' : '') + '>' + (k2 > 0 ? '+' + k2 : k2) + '</option>';
        html += '<div class="lt-ctl"><label>Change <select class="lt-s" data-s="i" aria-label="The vector to change">' + opts('i', sel.i) + '</select></label>' +
          '<label>using <select class="lt-s" data-s="j" aria-label="The vector to add a multiple of">' + opts('j', sel.j) + '</select></label>' +
          '<label>times <select class="lt-s" data-s="k" aria-label="The whole number k">' + ks + '</select></label>' +
          '<button type="button" class="preset" data-a="add">Add</button><button type="button" class="preset" data-a="swap">Swap them</button></div>';
      }
      html += '<div class="lt-act">' + (done
        ? '<button type="button" class="preset" data-a="reset">Try again</button>' + (mode === 'endless' ? ' <button type="button" class="preset" data-a="next">Next endless vault</button>' : mode === 'ladder' && lvl < LEVELS.length - 1 ? ' <button type="button" class="preset" data-a="next"' + (unlocked(lvl + 2) ? '' : ' disabled') + '>Next vault</button>' : '')
        : '<button type="button" class="preset" data-a="undo"' + (hist.length ? '' : ' disabled') + '>Undo</button> <button type="button" class="preset" data-a="reset">Start again</button>') + '</div>' +
        '<p class="lt-say" role="status" aria-live="polite">' + (done ? sayResult(L) : (sel.i === sel.j ? 'Pick two different vectors.' : 'Make b1 as short as the shortest vector (length&sup2; ' + L.lam + ').')) + '</p>';
      wrap.innerHTML = html;
    }
    function sayResult(L) {
      var med = medalOf(hist.length, L.par), glyph = { gold: '🥇', silver: '🥈', bronze: '🥉' }[med];
      return '<strong>Open in ' + hist.length + ' move' + (hist.length === 1 ? '' : 's') + (hist.length <= L.par ? ': the par, no sequence of moves is shorter.' : ' against a par of ' + L.par + '.') + '</strong> ' + glyph + ' ' + med +
        (hist.length <= L.par ? '' : ' Subtract the multiple that brings the longer vector closest to zero, then swap the shorter one to the front.');
    }
    function start(n) { mode = 'ladder'; cur = null; lvl = n; B = cloneB(LEVELS[n].start); hist = []; done = false; sel = { i: 1, j: 0, k: -1 }; paint(); }
    function startGen(m) {
      mode = m; var seed = m === 'daily' ? EN.dailySeed(KEY) : EN.hash('endless:' + KEY + ':' + nonce + ':' + ek);
      cur = gen(seed, m === 'daily' ? 2 : ek) || LEVELS[Math.min(ek, LEVELS.length - 1)];
      B = cloneB(cur.start); hist = []; done = false; sel = { i: 1, j: 0, k: -1 }; paint();
    }
    function doMove(mv) {
      if (done) return; B = apply(B, mv); hist.push(mv);
      if (solved(cL(), B)) {
        done = true; var med = medalOf(hist.length, cL().par);
        if (mode === 'endless') EN.record(KEY, med); else if (mode === 'daily') EN.dailyRecord(KEY, med);
        else try { var f = W.SymbiQ.games && W.SymbiQ.games.frame; if (f && f.ladder) f.ladder.markCleared(KEY, lvl + 1, med); } catch (x) { }
      }
      paint();
    }
    wrap.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.getAttribute || !t.getAttribute('data-s')) return;
      sel[t.getAttribute('data-s')] = +t.value; paint(); var s = wrap.querySelector('.lt-s[data-s="' + t.getAttribute('data-s') + '"]'); if (s) s.focus();
    });
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-em')) { var m = b.getAttribute('data-em'); if (m === 'ladder') start(resume()); else { if (m === 'endless') ek = 0; startGen(m); } return; }
      if (b.hasAttribute('data-lv')) { var n2 = +b.getAttribute('data-lv'); if (unlocked(n2 + 1)) start(n2); return; }
      var a = b.getAttribute('data-a');
      if (a === 'add') { if (sel.i !== sel.j) doMove({ t: 'add', i: sel.i, j: sel.j, k: sel.k }); }
      else if (a === 'swap') { if (sel.i !== sel.j) doMove({ t: 'swap', i: Math.min(sel.i, sel.j), j: Math.max(sel.i, sel.j) }); }
      else if (a === 'undo') { if (hist.length && !done) { hist.pop(); B = cloneB(cL().start); hist.forEach(function (m) { B = apply(B, m); }); paint(); } }
      else if (a === 'reset') { if (mode === 'ladder') start(lvl); else { B = cloneB(cur.start); hist = []; done = false; sel = { i: 1, j: 0, k: -1 }; paint(); } }
      else if (a === 'next') { if (mode === 'endless') { ek++; startGen('endless'); } else start(lvl + 1); }
    });
    start(resume());
    return { state: function () { return { lvl: lvl, basis: cloneB(B), moves: hist.length, done: done, mode: mode, level: cL() }; }, play: function (mv) { doMove(mv); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.lattice = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
