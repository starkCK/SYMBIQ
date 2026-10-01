(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  function build(d) {
    var n = d * d, zs = [], xs = [];
    var q = function (r, c) { return r * d + c; };
    function plaq(r, c) {
      var out = [];
      [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]].forEach(function (p) { if (p[0] >= 0 && p[0] < d && p[1] >= 0 && p[1] < d) out.push(q(p[0], p[1])); });
      return out;
    }
    for (var r = -1; r < d; r++) {
      for (var c = -1; c < d; c++) {
        var isZ = ((r + c) % 2 + 2) % 2 === 0, bulk = r >= 0 && r < d - 1 && c >= 0 && c < d - 1;
        var top = (r === -1 || r === d - 1) && c >= 0 && c < d - 1, side = (c === -1 || c === d - 1) && r >= 0 && r < d - 1;
        if (bulk) (isZ ? zs : xs).push({ q: plaq(r, c), r: r, c: c });
        else if (top && !isZ) xs.push({ q: plaq(r, c), r: r, c: c });
        else if (side && isZ) zs.push({ q: plaq(r, c), r: r, c: c });
      }
    }
    var zbar = [], xbar = [], zAt = [];
    for (var cc = 0; cc < d; cc++) zbar.push(q(0, cc));
    for (var rr = 0; rr < d; rr++) xbar.push(q(rr, 0));
    for (var i = 0; i < n; i++) zAt.push([]);
    zs.forEach(function (s, k) { s.q.forEach(function (x) { zAt[x].push(k); }); });
    return { d: d, n: n, zs: zs, xs: xs, zbar: zbar, xbar: xbar, zAt: zAt };
  }
  var CACHE = {};
  function lat(d) { return CACHE[d] || (CACHE[d] = build(d)); }

  function syndrome(L, e) {
    var s = new Uint8Array(L.zs.length);
    for (var k = 0; k < L.zs.length; k++) { var p = 0, qs = L.zs[k].q; for (var i = 0; i < qs.length; i++) p ^= e[qs[i]]; s[k] = p; }
    return s;
  }
  function logical(L, e) { var p = 0; for (var i = 0; i < L.zbar.length; i++) p ^= e[L.zbar[i]]; return p; }
  function xor(a, b) { var o = new Uint8Array(a.length); for (var i = 0; i < a.length; i++) o[i] = a[i] ^ b[i]; return o; }
  function weight(e) { var w = 0; for (var i = 0; i < e.length; i++) w += e[i]; return w; }

  function greedy(L, S) {
    var nz = L.zs.length, B = nz, adj = [], i;
    for (i = 0; i <= nz; i++) adj.push([]);
    for (var qd = 0; qd < L.n; qd++) {
      var a = L.zAt[qd];
      if (a.length === 2) { adj[a[0]].push([a[1], qd]); adj[a[1]].push([a[0], qd]); }
      else if (a.length === 1) { adj[a[0]].push([B, qd]); adj[B].push([a[0], qd]); }
    }
    var alarms = []; for (i = 0; i < nz; i++) if (S[i]) alarms.push(i);
    var repair = new Uint8Array(L.n);
    function bfs(src) {
      var dist = {}, par = {}, queue = [src]; dist[src] = 0;
      while (queue.length) {
        var u = queue.shift();
        for (var k = 0; k < adj[u].length; k++) { var v = adj[u][k][0]; if (dist[v] === undefined) { dist[v] = dist[u] + 1; par[v] = [u, adj[u][k][1]]; queue.push(v); } }
      }
      return { dist: dist, par: par };
    }
    function apply(src, dst, res) { var cur = dst; while (cur !== src) { var pr = res.par[cur]; repair[pr[1]] ^= 1; cur = pr[0]; } }
    var res = {}, k0;
    function dists() { alarms.forEach(function (a) { if (!res[a]) res[a] = bfs(a); }); }
    while (alarms.length) {
      dists();
      var best = null;
      for (var x = 0; x < alarms.length; x++) {
        var rx = res[alarms[x]], bx = rx.dist[B];
        for (var y = x + 1; y < alarms.length; y++) {
          var dd = rx.dist[alarms[y]], by = res[alarms[y]].dist[B];
          if (dd === undefined) continue;
          var save = (bx === undefined || by === undefined) ? 1e9 : bx + by - dd;
          if (save >= 0 && (!best || save > best.save || (save === best.save && dd < best.dd))) best = { save: save, dd: dd, a: x, b: y };
        }
      }
      if (best) {
        apply(alarms[best.a], alarms[best.b], res[alarms[best.a]]);
        alarms.splice(best.b, 1); alarms.splice(best.a, 1);
      } else {
        var a0 = alarms[0];
        if (res[a0].dist[B] === undefined) { alarms.shift(); continue; }
        apply(a0, B, res[a0]); alarms.shift();
      }
    }
    return repair;
  }

  var STAGES = [
    { d: 3, rounds: 8, p: 0.06, clock: 9, boss: 'measure', name: 'Measurement errors' },
    { d: 5, rounds: 8, p: 0.045, clock: 13, boss: 'leak', name: 'Leakage' },
    { d: 7, rounds: 10, p: 0.035, clock: 18, boss: 'pairs', name: 'Correlated pairs' },
    { d: 9, rounds: 10, p: 0.03, clock: 24, boss: 'burst', name: 'A cosmic-ray burst' }
  ];
  var MEASURE_ERR = 0.10, LEAK_ON = 0.5, LEAK_SCRAMBLE = 0.5, BURST_P = 0.4, BURST_ROUNDS = [3, 6];

  function vpairs(d) { var o = []; for (var r = 0; r < d - 1; r++) for (var c = 0; c < d; c++) o.push([r * d + c, (r + 1) * d + c]); return o; }

  function roundNoise(st, round, rng, state) {
    var L = lat(st.d), e = new Uint8Array(L.n), info = {}, i;
    if (st.boss === 'pairs') {
      var pr = vpairs(st.d), qp = (st.p * L.n / 4) / pr.length;
      for (i = 0; i < L.n; i++) if (rng() < st.p / 2) e[i] ^= 1;
      for (i = 0; i < pr.length; i++) if (rng() < qp) { e[pr[i][0]] ^= 1; e[pr[i][1]] ^= 1; info.pairs = (info.pairs || 0) + 1; }
    } else {
      for (i = 0; i < L.n; i++) if (rng() < st.p) e[i] ^= 1;
    }
    if (st.boss === 'burst' && BURST_ROUNDS.indexOf(round) >= 0) {
      var cr = 1 + Math.floor(rng() * (st.d - 2)), cc = 1 + Math.floor(rng() * (st.d - 2)), patch = [];
      for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) patch.push((cr + dr) * st.d + (cc + dc));
      patch.forEach(function (qq) { if (rng() < BURST_P) e[qq] ^= 1; });
      info.burst = { r: cr, c: cc, qubits: patch };
    }
    if (st.boss === 'leak') {
      if (state.leaked < 0 && rng() < LEAK_ON) { state.leaked = Math.floor(rng() * L.n); info.newLeak = state.leaked; }
      if (state.leaked >= 0 && rng() < LEAK_SCRAMBLE) e[state.leaked] ^= 1;
    }
    return { flips: e, info: info };
  }

  function reading(st, S, rng, state) {
    var L = lat(st.d), out = new Uint8Array(S), i;
    if (st.boss === 'measure') for (i = 0; i < out.length; i++) if (rng() < MEASURE_ERR) out[i] ^= 1;
    if (st.boss === 'leak' && state.leaked >= 0) L.zAt[state.leaked].forEach(function (k) { out[k] = rng() < 0.5 ? 1 : 0; });
    return out;
  }

  var engine = { build: build, lat: lat, syndrome: syndrome, logical: logical, xor: xor, weight: weight, greedy: greedy, roundNoise: roundNoise, reading: reading,
                 STAGES: STAGES, vpairs: vpairs, MEASURE_ERR: MEASURE_ERR, LEAK_ON: LEAK_ON, LEAK_SCRAMBLE: LEAK_SCRAMBLE, BURST_P: BURST_P, BURST_ROUNDS: BURST_ROUNDS };

  function resolve(L, e, repair) {
    var next = xor(e, repair), S = syndrome(L, next), alarms = weight(S);
    return { e: next, alarms: alarms, lost: alarms === 0 && logical(L, next) === 1 };
  }
  engine.resolve = resolve;
  engine.HITS_ALLOWED = 3;

  var NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }

  var def = {
    id: 'survival', title: 'Surface Code Survival', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'The chip flips qubits every round and does not wait for you. Hold one logical qubit while the code grows from d3 to d9.',
    about: {
      goal: 'Survive every round at each size without losing the logical qubit. Clear d9 to win; keep going past it for a score.',
      how: 'Click the qubits you think flipped (a red alarm sits on a check that disagrees), then <strong>Commit</strong> before the decoding clock runs out. Leftover alarms carry over, and more than three rounds ending with alarms still lit loses the run.',
      inspired: 'Surface-code decoding under a real-time deadline (Google Quantum AI, <em>Nature</em> 638, 920 (2025); the AlphaQubit decoder, Bausch et al., <em>Nature</em> 2024) and the failure modes that break an independent-error decoder.',
      learn: 'Why a bigger code only helps while you can still decode it in time, and what each real-world failure (a bad readout, a leaked qubit, correlated errors, a cosmic-ray burst) does to that.',
      link: 'qec.html', linkText: 'The error-correction explainer ▸', tier: 'Proven',
      or: 'Decoding is a minimum-weight matching problem, an operations-research algorithm'
    },
    honest: 'Honest model: the lattice, the checks and the logical operators are the exact rotated surface code (Tomita &amp; Svore 2014), and the logical qubit is lost exactly when the leftover error has no alarms and an odd overlap with the logical operator. Only bit flips are modelled (so only the Z checks are drawn), flips are independent except where a stage says otherwise, and the final readout is perfect. The "Ask the decoder" suggestion is a greedy pairing of alarms, not minimum-weight matching, and can be fooled. The rates and clocks are chosen for play, not measured from a chip.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function mountGame(root, opts) {
    var mission = opts.mode === 'mission';
    var stage = 0, round = 0, st, L, e, S, shown, prevShown, repair, over = false, hits = 0, state, clockMs = 0, clockT = 0, noClock = false, tool = 'repair', info = {}, readout = false, burstInfo = null;
    var rng = Math.random;
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'scs';
    wrap.innerHTML =
      '<div class="scs-hud" role="status" aria-live="polite"></div>' +
      '<div class="scs-clock" aria-hidden="true"><i></i></div>' +
      '<div class="scs-fig"><svg class="scs-svg" role="group" aria-label="The surface code lattice. Arrow keys move between qubits, Space toggles a repair."></svg></div>' +
      '<p class="scs-say" role="status" aria-live="polite"></p>' +
      '<div class="scs-act"><button type="button" class="preset scs-commit">Commit repairs</button>' +
      '<button type="button" class="preset scs-clear">Clear</button>' +
      '<button type="button" class="preset scs-ask">Ask the decoder</button>' +
      '<button type="button" class="preset scs-reset" hidden aria-pressed="false">Tool: reset leakage</button>' +
      '<label class="scs-nc"><input type="checkbox" class="scs-noclock"> Take your time (no clock, no medal)</label></div>';
    root.appendChild(wrap);
    var hud = wrap.querySelector('.scs-hud'), svg = wrap.querySelector('.scs-svg'), say = wrap.querySelector('.scs-say'), bar = wrap.querySelector('.scs-clock i');
    var bCommit = wrap.querySelector('.scs-commit'), bClear = wrap.querySelector('.scs-clear'), bAsk = wrap.querySelector('.scs-ask'), bReset = wrap.querySelector('.scs-reset'), cbNo = wrap.querySelector('.scs-noclock');
    var qEls = [];

    function startStage() {
      st = STAGES[stage]; L = lat(st.d); e = new Uint8Array(L.n); repair = new Uint8Array(L.n);
      round = 0; hits = 0; readout = false; state = { leaked: -1 }; prevShown = null; burstInfo = null;
      bReset.hidden = st.boss !== 'leak'; tool = 'repair'; bReset.setAttribute('aria-pressed', 'false');
      drawLattice(); nextRound();
    }
    var SP = 46, PAD = 34;
    function pos(i) { return [PAD + (i % st.d) * SP, PAD + Math.floor(i / st.d) * SP]; }
    function drawLattice() {
      svg.innerHTML = ''; qEls = [];
      var sp = SP, Wd = SP * (st.d - 1) + 2 * PAD, g = el('g', {}, svg), zEls = [];
      svg.setAttribute('viewBox', '0 0 ' + Wd + ' ' + Wd); svg.style.minWidth = Wd + 'px'; svg.style.maxWidth = Math.round(Wd * 2.1) + 'px'; svg.style.margin = '0 auto';
      L.xs.forEach(function (x) { var c = ctr(x); el('circle', { cx: c[0], cy: c[1], r: 3, 'class': 'scs-xchk' }, g); });
      L.zs.forEach(function (z, k) {
        var c = ctr(z), n = el('g', { 'class': 'scs-z', 'data-k': k }, g);
        el('rect', { x: c[0] - 11, y: c[1] - 11, width: 22, height: 22, rx: 4, 'class': 'scs-zbox' }, n);
        zEls.push(n);
      });
      svg._z = zEls;
      var r0 = 13;
      for (var i = 0; i < L.n; i++) {
        var p = pos(i), qg = el('g', { 'class': 'scs-q', tabindex: '0', role: 'button', 'aria-pressed': 'false', 'data-i': i, 'aria-label': 'qubit row ' + (Math.floor(i / st.d) + 1) + ' column ' + (i % st.d + 1) }, svg);
        el('circle', { cx: p[0], cy: p[1], r: r0, 'class': 'scs-qc' }, qg);
        el('circle', { cx: p[0], cy: p[1], r: 23, 'class': 'scs-hit', fill: 'transparent' }, qg);
        qEls.push(qg);
      }
      qEls.forEach(function (g2, i) {
        g2.addEventListener('click', function () { press(i); });
        g2.addEventListener('keydown', function (ev) {
          var k = ev.key, r = Math.floor(i / st.d), c = i % st.d, to = -1;
          if (k === ' ' || k === 'Enter') { ev.preventDefault(); press(i); return; }
          if (k === 'ArrowRight' && c < st.d - 1) to = i + 1; else if (k === 'ArrowLeft' && c > 0) to = i - 1;
          else if (k === 'ArrowDown' && r < st.d - 1) to = i + st.d; else if (k === 'ArrowUp' && r > 0) to = i - st.d;
          if (to >= 0) { ev.preventDefault(); qEls[to].focus(); }
        });
      });
      function ctr(s) { var sx = 0, sy = 0; s.q.forEach(function (q) { var p2 = pos(q); sx += p2[0]; sy += p2[1]; });
        var cx = sx / s.q.length, cy = sy / s.q.length;
        if (s.q.length === 2) { if (s.r === -1) cy -= sp * 0.28; else if (s.r === st.d - 1) cy += sp * 0.28; else if (s.c === -1) cx -= sp * 0.28; else cx += sp * 0.28; }
        return [cx, cy]; }
    }
    function press(i) {
      if (over) return;
      if (tool === 'reset') { if (state.leaked === i) { state.leaked = -1; say.textContent = 'Reset. That qubit is back in the code.'; } else say.textContent = 'That qubit is not leaked.'; paint(); return; }
      repair[i] ^= 1; paint();
    }
    function paint() {
      var sNow = shown;
      svg._z.forEach(function (n, k) {
        var on = sNow && sNow[k], chg = prevShown && sNow && sNow[k] !== prevShown[k];
        n.setAttribute('class', 'scs-z' + (on ? ' on' : '') + (chg ? ' chg' : ''));
      });
      qEls.forEach(function (g, i) {
        g.setAttribute('aria-pressed', String(!!repair[i]));
        var cls = 'scs-q' + (repair[i] ? ' mark' : '') + (state.leaked === i ? ' leak' : '') + (burstInfo && burstInfo.qubits.indexOf(i) >= 0 ? ' burst' : '');
        g.setAttribute('class', cls);
      });
      hud.innerHTML = '<b>d' + st.d + '</b> &middot; ' + esc(st.name) + ' &middot; round <b>' + (readout ? 'readout' : (round + 1) + ' of ' + st.rounds) + '</b> &middot; rounds that ended with alarms still lit: <b>' + hits + ' of ' + engine.HITS_ALLOWED + '</b> allowed' + (noClock ? ' &middot; no clock' : '');
    }
    var esc = W.SymbiQ.core.esc;

    function nextRound() {
      if (round >= st.rounds && !readout) { readout = true; info = {}; S = syndrome(L, e); shown = readingFor(S); say.textContent = 'Readout: no new errors. Clear every alarm to finish the stage.'; startClock(); paint(); return; }
      var n = roundNoise(st, round, rng, state);
      info = n.info; e = xor(e, n.flips); S = syndrome(L, e);
      prevShown = shown; shown = readingFor(S); burstInfo = info.burst || null; repair = new Uint8Array(L.n);
      var msg = 'Round ' + (round + 1) + ': ';
      if (info.burst) msg += 'a cosmic ray struck the highlighted patch. ';
      if (info.newLeak !== undefined) msg += 'a qubit has leaked (ringed): its checks will lie until you reset it. ';
      if (st.boss === 'measure') msg += 'checks that changed since last round are outlined: a real error stays, a false alarm flickers. ';
      say.textContent = msg + 'Mark the qubits you would repair, then commit.';
      startClock(); paint();
    }
    function readingFor(Sx) { return reading(st, Sx, rng, state); }
    function startClock() {
      clockMs = st.clock * 1000; clockT = performance.now(); cancelAnimationFrame(startClock._raf);
      if (noClock) { bar.style.width = '100%'; return; }
      (function tick() {
        var left = Math.max(0, clockMs - (performance.now() - clockT));
        bar.style.width = (100 * left / clockMs) + '%';
        if (left <= 0) { commit(true); return; }
        startClock._raf = requestAnimationFrame(tick);
      })();
    }
    function commit(timeout) {
      if (over) return;
      cancelAnimationFrame(startClock._raf);
      var res = resolve(L, e, repair);
      e = res.e; S = syndrome(L, e);
      if (res.lost) return end(false, 'The logical qubit flipped: the leftover error had no alarms and crossed the code. ' + (timeout ? 'The clock ran out.' : ''));
      if (res.alarms) hits++;
      if (hits > engine.HITS_ALLOWED) return end(false, 'Alarms were still lit at the end of too many rounds. The errors piled up faster than you cleared them.');
      if (readout) {
        if (res.alarms) { shown = readingFor(S); repair = new Uint8Array(L.n); say.textContent = 'Alarms are still lit. Clear them to finish the stage.'; startClock(); paint(); return; }
        return finishStage();
      }
      round++; nextRound();
    }
    function finishStage() {
      var medal = hits === 0 ? 'gold' : hits <= 2 ? 'silver' : 'bronze';
      if (!noClock && W.SymbiQ.games && W.SymbiQ.games.frame && W.SymbiQ.games.frame.ladder) W.SymbiQ.games.frame.ladder.markCleared('survival', stage + 1, medal);
      if (stage < STAGES.length - 1) {
        say.innerHTML = '<strong>d' + st.d + ' held' + (noClock ? '' : ' (' + medal + ')') + '.</strong> The code grows to d' + STAGES[stage + 1].d + '. Next: ' + esc(STAGES[stage + 1].name) + '. <button type="button" class="preset scs-go">Grow the code</button>';
        bCommit.disabled = true; over = true;
        say.querySelector('.scs-go').addEventListener('click', function () { over = false; bCommit.disabled = false; stage++; startStage(); });
        cancelAnimationFrame(startClock._raf);
      } else {
        end(true, '<strong>d9 held.</strong> You decoded through a measurement fault, a leaked qubit, correlated pairs and a cosmic-ray burst' + (noClock ? '' : ' (' + medal + ')') + '.');
      }
    }
    function end(won, msg) {
      over = true; cancelAnimationFrame(startClock._raf); bCommit.disabled = true;
      say.innerHTML = (won ? '' : '<strong>Lost at d' + st.d + '.</strong> ') + msg + ' <button type="button" class="preset scs-again">Play again</button>';
      say.querySelector('.scs-again').addEventListener('click', function () { over = false; bCommit.disabled = false; stage = 0; startStage(); });
      if (opts.onWin && won) { try { opts.onWin({ won: true }); } catch (x) { } }
      paint();
    }
    bCommit.addEventListener('click', function () { commit(false); });
    bClear.addEventListener('click', function () { repair = new Uint8Array(L.n); paint(); });
    bAsk.addEventListener('click', function () {
      if (over) return;
      repair = greedy(L, shown); say.textContent = 'The decoder suggests the marked qubits. It pairs alarms greedily and can be fooled: check it, then commit.'; paint();
    });
    bReset.addEventListener('click', function () { tool = tool === 'reset' ? 'repair' : 'reset'; bReset.setAttribute('aria-pressed', String(tool === 'reset')); bReset.textContent = tool === 'reset' ? 'Tool: reset leakage (on)' : 'Tool: reset leakage'; });
    cbNo.addEventListener('change', function () { noClock = cbNo.checked; startClock(); paint(); });

    startStage();
    return { state: function () { return { stage: stage, round: round, hits: hits, over: over, d: st.d, e: e, S: S, shown: shown, repair: repair, leaked: state.leaked, readout: readout }; },
             setRng: function (f) { rng = f; }, press: press, commit: commit,
             setError: function (arr) { e = new Uint8Array(arr); S = syndrome(L, e); shown = readingFor(S); paint(); },
             setLeak: function (i) { state.leaked = i; paint(); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.survival = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
