(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function powmod(a, e, N) { var r = 1 % N, b = a % N; while (e > 0) { if (e & 1) r = (r * b) % N; b = (b * b) % N; e = Math.floor(e / 2); } return r; }
  function order(a, N) { var x = a % N, r = 1; while (x !== 1) { x = (x * a) % N; r++; if (r > N) return null; } return r; }
  function chainLength(e) {
    if (e === 1) return { len: 0, chain: [1] };
    for (var maxd = 1; maxd < 40; maxd++) {
      var chain = [1];
      if (dfs(chain, maxd, e)) return { len: maxd, chain: chain.slice() };
    }
    return null;
  }
  function dfs(chain, maxd, e) {
    var d = chain.length - 1, last = chain[d];
    if (last === e) return true;
    if (d === maxd) return false;
    if (last * Math.pow(2, maxd - d) < e) return false;
    var i, j, s, tried = {};
    for (i = d; i >= 0; i--) for (j = i; j >= 0; j--) {
      s = chain[i] + chain[j];
      if (s <= last || s > e || tried[s]) continue;
      tried[s] = true; chain.push(s);
      if (dfs(chain, maxd, e)) return true;
      chain.pop();
    }
    return false;
  }
  function binaryCost(e) { var bits = Math.floor(Math.log2(e)) + 1, ones = 0, t = e; while (t) { ones += t & 1; t >>= 1; } return (bits - 1) + (ones - 1); }
  function medalOf(steps, par) { return steps <= par ? 'gold' : steps <= par + 1 ? 'silver' : 'bronze'; }
  function canStep(chain, i, j, e) { if (i < 0 || j < 0 || i >= chain.length || j >= chain.length) return 'no such gear'; var s = chain[i] + chain[j]; if (s > e) return 'larger than the target'; if (chain.indexOf(s) >= 0) return 'that gear exists already'; return null; }
  function finish(L) { var x = powmod(L.a, L.e, L.N); return { x: x, g1: gcd((x - 1 + L.N) % L.N, L.N), g2: gcd((x + 1) % L.N, L.N) }; }

  function gen(seed, k) {
    var r = (function (a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(seed >>> 0);
    var PR = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97], t;
    var ri = function (a, b) { return a + Math.floor(r() * (b - a + 1)); };
    for (t = 0; t < 600; t++) {
      var p = PR[ri(0, PR.length - 1)], q = PR[ri(0, PR.length - 1)];
      if (p === q) continue;
      var N = p * q, a = ri(2, 11);
      if (gcd(a, N) !== 1) continue;
      var rr = order(a, N); if (!rr || rr % 2) continue;
      var e = rr / 2, hi = Math.min(200, 40 + 30 * k); if (e < 12 || e > hi) continue;
      var x = powmod(a, e, N); if (x === 1 || x === N - 1) continue;
      var g1 = gcd((x - 1 + N) % N, N), g2 = gcd((x + 1) % N, N); if (g1 === 1 || g1 === N || g2 === 1 || g2 === N) continue;
      var c = chainLength(e); if (!c || c.len >= binaryCost(e)) continue;
      return { id: 'gen', N: N, a: a, r: rr, e: e, par: c.len, brief: 'A generated number, N = ' + Math.min(p, q) + ' &times; ' + Math.max(p, q) + '. The shortest chain is found by exhaustive search before you see it.' };
    }
    return null;
  }

  var engine = { gen: gen, gcd: gcd, powmod: powmod, order: order, chainLength: chainLength, binaryCost: binaryCost, medalOf: medalOf, canStep: canStep, finish: finish };

  var LEVELS = [
    { id: 'first', N: 77, a: 2, r: 30, e: 15, par: 5,
      brief: 'N = 7 &times; 11. Exponent 15 is the smallest where the binary rule is not the shortest: it takes 6 gears, and 5 is enough.' },
    { id: 'thirty', N: 183, a: 2, r: 60, e: 30, par: 6,
      brief: 'N = 3 &times; 61. The order is 60, so the target exponent is 30.' },
    { id: 'thirtynine', N: 237, a: 2, r: 78, e: 39, par: 7,
      brief: 'N = 3 &times; 79. Reuse what you built: a gear can be used again and again.' },
    { id: 'seventyeight', N: 395, a: 2, r: 156, e: 78, par: 8,
      brief: 'N = 5 &times; 79. Exponent 78: find the shortest chain, then compare it with the binary rule.' },
    { id: 'deep', N: 581, a: 2, r: 246, e: 123, par: 9,
      brief: 'N = 7 &times; 83. Exponent 123: the binary rule uses 11 gears. The shortest chain uses 9.' }
  ];
  engine.LEVELS = LEVELS;

  var def = {
    id: 'clockwork', title: 'Shor\'s Clockwork', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'Shor\'s algorithm ends with a power. Build the chain of multiplications that reaches it in the fewest gears.',
    about: {
      goal: 'Reach the exponent r/2 from the single gear 1 with as few gears as possible. Each gear is the sum of two earlier ones, so each costs one modular multiplication. The last gear opens the number.',
      how: 'Pick <strong>two gears</strong> (the same one twice is a squaring) and <strong>Add them</strong>: a new gear appears with the sum of the exponents and the product of the residues. Reach the <strong>target exponent</strong>; the gcds then split N.',
      inspired: 'The classical finish of Shor&rsquo;s algorithm (1994), and the old puzzle of addition chains, the fewest multiplications to compute a power, which is also the cost the quantum circuit pays for modular exponentiation.',
      learn: 'What the quantum computer hands over (the order r), what is left to do with it, why a power takes few multiplications, and why the textbook binary rule is not always the fewest.',
      link: 'pqc.html', linkText: 'The post-quantum page ▸', tier: 'Proven',
      or: 'Finding the shortest sequence of operations to reach a value is a search problem, an operations-research one'
    },
    honest: 'Honest model: the number of gears is a stand-in for the cost of modular exponentiation; real circuits use windowed arithmetic, not plain addition chains. The numbers are tiny so that every residue can be shown, and you are told the order r, while the quantum computer\'s task is finding it. The par is the exact shortest addition chain to the target, found by exhaustive search and cross-checked.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, chain = [1], hist = [], done = false;
    var KEY = 'clockwork', sel = { i: 0, j: 0 }, note = '', cur = null, mode = 'ladder', ek = 0, nonce = (Date.now() % 1000000007) >>> 0;
    var EN = W.SymbiQ.endless;
    function cL() { return cur || LEVELS[lvl]; }
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'cwk';
    root.appendChild(wrap);

    function ladderState() { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.ladder ? f.ladder.state(KEY) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function resume() { var st = ladderState(), r = 0; for (var q = 1; q <= LEVELS.length; q++) if (st.cleared[q]) r = Math.min(q, LEVELS.length - 1); return r; }

    function paint() {
      var L = cL(), st = ladderState(), steps = chain.length - 1;
      var html = (EN ? EN.bar(mode) : '') + (mode !== 'ladder' ? EN.line(KEY, mode, ek) : '<div class="cw-strip" role="list" aria-label="The numbers">' + LEVELS.map(function (l, k) {
        var med = st.medal[k + 1], glyph = med ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[med] : (unlocked(k + 1) ? (k + 1) : '🔒');
        return '<button type="button" role="listitem" class="cw-chip' + (k === lvl ? ' now' : '') + '" data-lv="' + k + '"' + (unlocked(k + 1) ? '' : ' disabled') + ' aria-label="N = ' + l.N + (unlocked(k + 1) ? '' : ', locked') + '">' + glyph + (EN ? ' <small>' + EN.tierOf(k, LEVELS.length) + '</small>' : '') + ' N = ' + l.N + '</button>';
      }).join('') + '</div>') + '<p class="cw-brief">' + L.brief + '</p>' +
        '<p class="cw-facts"><b>N</b> = ' + L.N + ' &middot; <b>a</b> = ' + L.a + ' &middot; <b>The order</b> r = ' + L.r + ' (what the quantum computer found) &middot; <b>Target exponent</b> r/2 = <b>' + L.e + '</b> &middot; <b>Par</b> ' + L.par + ' gears (proven fewest) &middot; <b>Your gears</b> <b class="cw-n">' + steps + '</b></p>';
      html += '<table class="cw-tab"><caption class="sr">The gears so far: each is a power of a, with its exponent and its residue modulo N</caption><thead><tr><th scope="col">Gear</th><th scope="col">Exponent</th><th scope="col">Residue a<sup>exponent</sup> mod N</th></tr></thead><tbody>' +
        chain.map(function (x, k) { return '<tr class="' + (x === L.e ? 'win' : '') + '"><th scope="row">' + k + '</th><td>' + x + '</td><td>' + powmod(L.a, x, L.N) + '</td></tr>'; }).join('') + '</tbody></table>';
      if (!done) {
        var o = function (cur) { var s = ''; chain.forEach(function (x, k) { s += '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>gear ' + k + ' (exponent ' + x + ')</option>'; }); return s; };
        html += '<div class="cw-ctl"><label>Take <select class="cw-s" data-s="i" aria-label="The first gear">' + o(sel.i) + '</select></label><label>and <select class="cw-s" data-s="j" aria-label="The second gear">' + o(sel.j) + '</select></label>' +
          '<button type="button" class="preset" data-a="add">Add them</button></div>';
      }
      html += '<div class="cw-act">' + (done
        ? '<button type="button" class="preset" data-a="reset">Try again</button>' + (mode === 'endless' ? ' <button type="button" class="preset" data-a="next">Next endless number</button>' : mode === 'ladder' && lvl < LEVELS.length - 1 ? ' <button type="button" class="preset" data-a="next"' + (unlocked(lvl + 2) ? '' : ' disabled') + '>Next number</button>' : '')
        : '<button type="button" class="preset" data-a="undo"' + (hist.length ? '' : ' disabled') + '>Undo</button> <button type="button" class="preset" data-a="reset">Start again</button>') + '</div>' +
        '<p class="cw-say" role="status" aria-live="polite">' + (done ? sayResult(L) : (note || 'Add two gears to make a new one. Reach exponent ' + L.e + '.')) + '</p>';
      wrap.innerHTML = html;
    }
    function sayResult(L) {
      var steps = chain.length - 1, med = medalOf(steps, L.par), glyph = { gold: '🥇', silver: '🥈', bronze: '🥉' }[med], f = finish(L), bin = binaryCost(L.e);
      return '<strong>' + steps + ' gears' + (steps <= L.par ? ': the par, no chain is shorter.' : ' against a par of ' + L.par + '.') + '</strong> ' + glyph + ' ' + med +
        ' a<sup>' + L.e + '</sup> mod ' + L.N + ' = <b>' + f.x + '</b>, so gcd(' + f.x + ' &minus; 1, ' + L.N + ') = <b>' + f.g1 + '</b> and gcd(' + f.x + ' + 1, ' + L.N + ') = <b>' + f.g2 + '</b>: ' + L.N + ' = ' + f.g1 + ' &times; ' + f.g2 + '. ' +
        'Square and multiply by the binary digits would have used ' + bin + (bin > L.par ? ', ' + (bin - L.par) + ' more than the par.' : ', the same as the par.');
    }
    function start(n) { mode = 'ladder'; cur = null; lvl = n; chain = [1]; hist = []; done = false; sel = { i: 0, j: 0 }; note = ''; paint(); }
    function startGen(m) {
      mode = m; var seed = m === 'daily' ? EN.dailySeed(KEY) : EN.hash('endless:' + KEY + ':' + nonce + ':' + ek);
      cur = gen(seed, m === 'daily' ? 2 : ek) || LEVELS[Math.min(ek, LEVELS.length - 1)];
      chain = [1]; hist = []; done = false; sel = { i: 0, j: 0 }; note = ''; paint();
    }
    function doAdd(i, j) {
      var L = cL(), why = canStep(chain, i, j, L.e);
      if (why) { note = 'That move is not allowed: ' + why + '.'; paint(); return; }
      chain.push(chain[i] + chain[j]); hist.push([i, j]); note = ''; sel = { i: chain.length - 1, j: chain.length - 1 };
      if (chain[chain.length - 1] === L.e) {
        done = true; var med = medalOf(chain.length - 1, L.par);
        if (mode === 'endless') EN.record(KEY, med); else if (mode === 'daily') EN.dailyRecord(KEY, med);
        else try { var f = W.SymbiQ.games && W.SymbiQ.games.frame; if (f && f.ladder) f.ladder.markCleared(KEY, lvl + 1, med); } catch (x) { }
      }
      paint();
    }
    wrap.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.getAttribute || !t.getAttribute('data-s')) return;
      sel[t.getAttribute('data-s')] = +t.value; note = ''; var k = t.getAttribute('data-s'); paint(); var s = wrap.querySelector('.cw-s[data-s="' + k + '"]'); if (s) s.focus();
    });
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-em')) { var m = b.getAttribute('data-em'); if (m === 'ladder') start(resume()); else { if (m === 'endless') ek = 0; startGen(m); } return; }
      if (b.hasAttribute('data-lv')) { var n2 = +b.getAttribute('data-lv'); if (unlocked(n2 + 1)) start(n2); return; }
      var a = b.getAttribute('data-a');
      if (a === 'add') doAdd(sel.i, sel.j);
      else if (a === 'undo') { if (hist.length && !done) { hist.pop(); chain.pop(); note = ''; sel = { i: chain.length - 1, j: chain.length - 1 }; paint(); } }
      else if (a === 'reset') { if (mode === 'ladder') start(lvl); else { chain = [1]; hist = []; done = false; sel = { i: 0, j: 0 }; note = ''; paint(); } }
      else if (a === 'next') { if (mode === 'endless') { ek++; startGen('endless'); } else start(lvl + 1); }
    });
    start(resume());
    return { state: function () { return { lvl: lvl, chain: chain.slice(), done: done, mode: mode, level: cL() }; }, add: doAdd };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.clockwork = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
