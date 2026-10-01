(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};
  var engine = {};

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  engine.rng = rng;

  function isqrt10(dx, dy) { return Math.round(Math.sqrt(dx * dx + dy * dy) * 10); }
  function tspDist(inst) { var n = inst.pts.length, D = []; for (var i = 0; i < n; i++) { D[i] = []; for (var j = 0; j < n; j++) D[i][j] = isqrt10(inst.pts[i][0] - inst.pts[j][0], inst.pts[i][1] - inst.pts[j][1]); } return D; }

  var TSP = {
    kind: 'tsp', unit: 'tour length (tenths of a unit)',
    size: function (inst) { return inst.pts.length; },
    eval: function (inst, seq) { var D = inst._D || (inst._D = tspDist(inst)), n = seq.length, s = 0; for (var i = 0; i < n; i++) s += D[seq[i]][seq[(i + 1) % n]]; return { cost: s, score: s }; },
    greedy: function (inst) {
      var D = inst._D || (inst._D = tspDist(inst)), n = inst.pts.length, seen = [0], used = { 0: 1 };
      while (seen.length < n) { var c = seen[seen.length - 1], b = -1, bd = 1e9; for (var j = 0; j < n; j++) if (!used[j] && D[c][j] < bd) { bd = D[c][j]; b = j; } seen.push(b); used[b] = 1; }
      return seen;
    },
    optimum: function (inst) {
      var D = inst._D || (inst._D = tspDist(inst)), n = inst.pts.length, N = 1 << (n - 1), INF = 1e9, dp = [];
      for (var m = 0; m < N; m++) { dp[m] = []; for (var j = 0; j < n - 1; j++) dp[m][j] = INF; }
      for (var j0 = 0; j0 < n - 1; j0++) dp[1 << j0][j0] = D[n - 1][j0];
      for (var mask = 1; mask < N; mask++) for (var j1 = 0; j1 < n - 1; j1++) { var cur = dp[mask][j1]; if (cur >= INF || !(mask & (1 << j1))) continue;
        for (var k = 0; k < n - 1; k++) { if (mask & (1 << k)) continue; var nm = mask | (1 << k), v = cur + D[j1][k]; if (v < dp[nm][k]) dp[nm][k] = v; } }
      var best = INF; for (var e = 0; e < n - 1; e++) best = Math.min(best, dp[N - 1][e] + D[e][n - 1]); return best;
    },
    move: function (seq, r) { var n = seq.length, i = Math.floor(r() * n), j = Math.floor(r() * n); if (i > j) { var t = i; i = j; j = t; } var o = seq.slice(); while (i < j) { var x = o[i]; o[i] = o[j]; o[j] = x; i++; j--; } return o; }
  };

  var BP = {
    kind: 'bp', unit: 'bins used',
    size: function (inst) { return inst.items.length; },
    eval: function (inst, seq) {
      var rem = [], C = inst.cap, fill = [];
      for (var i = 0; i < seq.length; i++) { var w = inst.items[seq[i]], placed = false;
        for (var b = 0; b < rem.length; b++) if (rem[b] >= w) { rem[b] -= w; placed = true; break; }
        if (!placed) rem.push(C - w); }
      var bins = rem.length, sq = 0, tot = 0; for (var k = 0; k < bins; k++) { var f = C - rem[k]; sq += f * f; tot += f; }
      return { cost: bins - (sq / (C * C)) / (bins * 1.0001), score: bins };
    },
    greedy: function (inst) { var idx = inst.items.map(function (_, i) { return i; }); idx.sort(function (a, b) { return inst.items[b] - inst.items[a] || a - b; }); return idx; },
    optimum: function (inst) {
      var items = inst.items.slice().sort(function (a, b) { return b - a; }), C = inst.cap, n = items.length, total = items.reduce(function (a, b) { return a + b; }, 0);
      var lb = Math.ceil(total / C), best = n, bins = [];
      (function dfs(i) {
        if (bins.length >= best) return;
        if (i === n) { best = bins.length; return; }
        if (best === lb) return;
        var seen = {};
        for (var b = 0; b < bins.length; b++) { if (bins[b] + items[i] > C || seen[bins[b]]) continue; seen[bins[b]] = 1; bins[b] += items[i]; dfs(i + 1); bins[b] -= items[i]; if (best === lb) return; }
        if (bins.length + 1 < best) { bins.push(items[i]); dfs(i + 1); bins.pop(); }
      })(0);
      return best;
    },
    move: function (seq, r) { var n = seq.length, i = Math.floor(r() * n), j = Math.floor(r() * n), o = seq.slice();
      if (r() < 0.5) { var t = o[i]; o[i] = o[j]; o[j] = t; } else { var x = o.splice(i, 1)[0]; o.splice(j, 0, x); } return o; }
  };

  var JS = {
    kind: 'js', unit: 'makespan (time units)',
    size: function (inst) { return inst.jobs.reduce(function (a, j) { return a + j.length; }, 0); },
    eval: function (inst, seq) {
      var nJ = inst.jobs.length, nxt = [], jr = [], mr = {}, mk = 0;
      for (var j = 0; j < nJ; j++) { nxt[j] = 0; jr[j] = 0; }
      for (var i = 0; i < seq.length; i++) { var job = seq[i], op = inst.jobs[job][nxt[job]++], s = Math.max(jr[job], mr[op[0]] || 0), e = s + op[1]; jr[job] = e; mr[op[0]] = e; if (e > mk) mk = e; }
      return { cost: mk, score: mk };
    },
    greedy: function (inst) {
      var nJ = inst.jobs.length, nxt = [], rem = [], seq = [], jr = [], mr = {}, total = 0;
      for (var j = 0; j < nJ; j++) { nxt[j] = 0; jr[j] = 0; rem[j] = inst.jobs[j].reduce(function (a, o) { return a + o[1]; }, 0); total += inst.jobs[j].length; }
      for (var k = 0; k < total; k++) { var bj = -1, bw = -1; for (var jj = 0; jj < nJ; jj++) if (nxt[jj] < inst.jobs[jj].length && rem[jj] > bw) { bw = rem[jj]; bj = jj; }
        var op = inst.jobs[bj][nxt[bj]++]; rem[bj] -= op[1]; seq.push(bj); }
      return seq;
    },
    optimum: function (inst) {
      var nJ = inst.jobs.length, nxt = [], jr = [], mr = {}, best = 1e9, left = [], total = 0, mach = {};
      inst.jobs.forEach(function (jb, j) { nxt[j] = 0; jr[j] = 0; left[j] = jb.reduce(function (a, o) { return a + o[1]; }, 0); total += jb.length; jb.forEach(function (o) { mach[o[0]] = (mach[o[0]] || 0) + o[1]; }); });
      (function dfs(done, mk) {
        if (mk >= best) return;
        if (done === total) { best = mk; return; }
        for (var j = 0; j < nJ; j++) if (nxt[j] < inst.jobs[j].length) { if (jr[j] + left[j] >= best) return; }
        for (var m in mach) if ((mr[m] || 0) + remMach(m) >= best) return;
        for (var j2 = 0; j2 < nJ; j2++) {
          if (nxt[j2] >= inst.jobs[j2].length) continue;
          var op = inst.jobs[j2][nxt[j2]], s = Math.max(jr[j2], mr[op[0]] || 0), e = s + op[1], oj = jr[j2], om = mr[op[0]];
          nxt[j2]++; jr[j2] = e; mr[op[0]] = e; left[j2] -= op[1];
          dfs(done + 1, Math.max(mk, e));
          nxt[j2]--; jr[j2] = oj; mr[op[0]] = om; left[j2] += op[1];
        }
      })(0, 0);
      function remMach(m) { var s = 0; for (var j = 0; j < nJ; j++) for (var k = nxt[j]; k < inst.jobs[j].length; k++) if (String(inst.jobs[j][k][0]) === String(m)) s += inst.jobs[j][k][1]; return s; }
      return best;
    },
    move: function (seq, r) { var n = seq.length, i = Math.floor(r() * n), j = Math.floor(r() * n), o = seq.slice();
      if (r() < 0.5) { var t = o[i]; o[i] = o[j]; o[j] = t; } else { var x = o.splice(i, 1)[0]; o.splice(j, 0, x); } return o; }
  };
  var PROBLEMS = { tsp: TSP, bp: BP, js: JS };
  engine.PROBLEMS = PROBLEMS;

  function baseSeq(P, inst) {
    if (P.kind === 'js') { var s = []; inst.jobs.forEach(function (jb, j) { for (var k = 0; k < jb.length; k++) s.push(j); }); return s; }
    var n = P.size(inst), a = []; for (var i = 0; i < n; i++) a.push(i); return a;
  }
  function shuffle(a, r) { var o = a.slice(); for (var i = o.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; } return o; }

  var METHODS = [
    { id: 'greedy', name: 'Greedy', knob: null, blurb: 'Build one answer by a simple rule and stop. Costs one candidate.' },
    { id: 'hill', name: 'Hill-climbing', knob: ['Restart after 20 tries', 'Restart after 60 tries', 'Restart after 200 tries'], blurb: 'Keep any change that helps, drop any that does not. On tours this is 2-opt. Restarts when stuck.' },
    { id: 'anneal', name: 'Simulated annealing', knob: ['Cool start', 'Warm start', 'Hot start'], blurb: 'Accept some worse changes early, fewer as it cools, so it can climb out of a dip.' },
    { id: 'tabu', name: 'Tabu search', knob: ['Remember 3 moves', 'Remember 8 moves', 'Remember 20 moves'], blurb: 'Always take the best of a handful of changes, but forbid undoing recent ones.' },
    { id: 'ga', name: 'Genetic algorithm', knob: ['Population 10', 'Population 30', 'Population 80'], blurb: 'Breed a population: keep the fit, cross two parents, mutate a little.' },
    { id: 'aco', name: 'Ant colony', knob: ['Forget slowly', 'Forget at a medium rate', 'Forget fast'], blurb: 'Ants build answers; good answers leave a trail that later ants prefer, and trails fade.' },
    { id: 'lns', name: 'Large-neighbourhood search', knob: ['Remove 2 items', 'Remove 4 items', 'Remove 6 items'], blurb: 'Pull a few items out and put each back where it fits best, then keep it if it is no worse.' }
  ];
  engine.METHODS = METHODS;

  function runMethod(level, methodId, knob) {
    var P = PROBLEMS[level.problem], inst = level.inst, B = level.budget, r = rng(level.seed * 7919 + methodIndex(methodId) * 104729 + (knob | 0) * 1299709);
    var evals = 0, best = null, trace = [], step = Math.max(1, Math.floor(B / 40)), first = null;
    function ev(seq) {
      evals++; var e = P.eval(inst, seq);
      if (!best || e.cost < best.cost) { best = { seq: seq.slice(), score: e.score, cost: e.cost }; }
      if (first === null) first = e.score;
      if (evals % step === 0 || evals === 1) trace.push([evals, best.score]);
      return e.cost;
    }
    function evq(seq) { evals++; return P.eval(inst, seq).cost; }
    var base = baseSeq(P, inst), n = base.length;
    function done() { return evals >= B; }
    function randomStart() { return shuffle(base, r); }

    if (methodId === 'greedy') { ev(P.greedy(inst)); }
    else if (methodId === 'hill') {
      var patience = [20, 60, 200][knob | 0], cur = randomStart(), cc = ev(cur), fails = 0;
      while (!done()) { var nb = P.move(cur, r), nc = ev(nb); if (nc < cc) { cur = nb; cc = nc; fails = 0; } else if (++fails >= patience && !done()) { cur = randomStart(); cc = ev(cur); fails = 0; } }
    }
    else if (methodId === 'anneal') {
      var cur2 = randomStart(), cc2 = ev(cur2), sum = 0, k;
      for (k = 0; k < 30 && !done(); k++) { var t0 = P.move(cur2, r), c0 = ev(t0); sum += Math.abs(c0 - cc2); }
      var T0 = Math.max(1e-6, (sum / 30)) * [0.15, 0.6, 2.5][knob | 0], T1 = T0 * 0.002, rem = B - evals, start = evals;
      while (!done()) { var T = T0 * Math.pow(T1 / T0, (evals - start) / Math.max(1, rem)), nb2 = P.move(cur2, r), nc2 = ev(nb2);
        if (nc2 <= cc2 || r() < Math.exp(-(nc2 - cc2) / T)) { cur2 = nb2; cc2 = nc2; } }
    }
    else if (methodId === 'tabu') {
      var ten = [3, 8, 20][knob | 0], cur3 = randomStart(), cc3 = ev(cur3), tabu = [];
      while (!done()) {
        var bn = null, bc = 1e18, bsig = '';
        for (var t = 0; t < 12 && !done(); t++) { var nb3 = P.move(cur3, r), sig = nb3.join(','), nc3 = ev(nb3), isTabu = tabu.indexOf(sig) >= 0;
          if (isTabu && !(best && nc3 <= best.cost)) continue; if (nc3 < bc) { bc = nc3; bn = nb3; bsig = sig; } }
        if (bn) { cur3 = bn; cc3 = bc; tabu.push(bsig); if (tabu.length > ten) tabu.shift(); }
      }
    }
    else if (methodId === 'ga') {
      var pop = [10, 30, 80][knob | 0], popu = [], i;
      for (i = 0; i < pop && !done(); i++) { var s0 = randomStart(); popu.push({ s: s0, c: ev(s0) }); }
      while (!done() && popu.length > 1) {
        var kids = [];
        for (i = 0; i < pop && !done(); i++) {
          var a = tour(popu, r), b = tour(popu, r), child = cross(P, a.s, b.s, r); if (r() < 0.3) child = P.move(child, r);
          kids.push({ s: child, c: ev(child) });
        }
        popu = popu.concat(kids).sort(function (x, y) { return x.c - y.c; }).slice(0, pop);
      }
    }
    else if (methodId === 'aco') {
      var rho = [0.05, 0.2, 0.5][knob | 0], tau = [], antsN = 8, i2, j2;
      for (i2 = 0; i2 < n; i2++) { tau[i2] = []; for (j2 = 0; j2 < n; j2++) tau[i2][j2] = 1; }
      var items = P.kind === 'js' ? null : base;
      while (!done()) {
        var ants = [];
        for (var a2 = 0; a2 < antsN && !done(); a2++) { var seq = antBuild(P, inst, tau, r); ants.push({ s: seq, c: ev(seq) }); }
        for (i2 = 0; i2 < n; i2++) for (j2 = 0; j2 < n; j2++) tau[i2][j2] *= (1 - rho);
        ants.sort(function (x, y) { return x.c - y.c; });
        var elite = ants[0]; if (elite) { var depo = 1 / (1 + elite.c) * (P.kind === 'tsp' ? 1000 : n); if (P.kind === 'tsp') { for (i2 = 0; i2 < n; i2++) { var u = elite.s[i2], vv = elite.s[(i2 + 1) % n]; tau[u][vv] += depo; tau[vv][u] += depo; } } else for (i2 = 0; i2 < n; i2++) tau[i2][elite.s[i2]] += depo; }
      }
    }
    else if (methodId === 'lns') {
      var kk = [2, 4, 6][knob | 0], cur4 = randomStart(), cc4 = ev(cur4);
      while (!done()) {
        var cand = cur4.slice(), removed = [], full = null;
        for (var q = 0; q < kk && cand.length > 2; q++) removed.push(cand.splice(Math.floor(r() * cand.length), 1)[0]);
        for (var rr = 0; rr < removed.length && !done(); rr++) {
          var last = rr === removed.length - 1, bp = 0, bcst = 1e18, complete = true;
          for (var pos = 0; pos <= cand.length; pos++) {
            if (done()) { complete = false; break; }
            var t2 = cand.slice(); t2.splice(pos, 0, removed[rr]);
            var tc = last ? ev(t2) : evq(t2);
            if (tc < bcst) { bcst = tc; bp = pos; }
          }
          if (!complete) break;
          cand.splice(bp, 0, removed[rr]);
          if (last) full = bcst;
        }
        if (full !== null && full <= cc4) { cur4 = cand; cc4 = full; }
      }
    }
    return { best: best, evals: evals, trace: trace, first: first };
  }
  function methodIndex(id) { for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) return i; return 0; }
  function tour(popu, r) { var a = popu[Math.floor(r() * popu.length)], b = popu[Math.floor(r() * popu.length)]; return a.c <= b.c ? a : b; }
  function cross(P, a, b, r) {
    var n = a.length, i = Math.floor(r() * n), j = Math.floor(r() * n); if (i > j) { var t = i; i = j; j = t; }
    var keep = a.slice(i, j + 1), need = {}, out = [], x;
    for (x = 0; x < keep.length; x++) need[keep[x]] = (need[keep[x]] || 0) + 1;
    var rest = []; for (x = 0; x < n; x++) { var g = b[x]; if (need[g]) need[g]--; else rest.push(g); }
    return rest.slice(0, i).concat(keep, rest.slice(i));
  }
  function antBuild(P, inst, tau, r) {
    var base = baseSeq(P, inst), n = base.length, out = [], pool = base.slice(), k, w, x, c, q;
    if (P.kind === 'tsp') {
      var D = inst._D || (inst._D = tspDist(inst)), cur = 0; out.push(0); pool.splice(0, 1);
      while (pool.length) {
        w = 0; var ws = []; for (k = 0; k < pool.length; k++) { var v = tau[cur][pool[k]] * Math.pow(1 / (D[cur][pool[k]] + 1), 2); ws.push(v); w += v; }
        x = r() * w; c = pool.length - 1; for (q = 0; q < pool.length; q++) { x -= ws[q]; if (x <= 0) { c = q; break; } }
        cur = pool.splice(c, 1)[0]; out.push(cur);
      }
      return out;
    }
    for (var pos = 0; pos < n; pos++) {
      w = 0; var ws2 = []; for (k = 0; k < pool.length; k++) { var v2 = tau[pos][pool[k]] + 0.01; ws2.push(v2); w += v2; }
      x = r() * w; c = pool.length - 1; for (q = 0; q < pool.length; q++) { x -= ws2[q]; if (x <= 0) { c = q; break; } }
      out.push(pool.splice(c, 1)[0]);
    }
    return out;
  }

  var LEVELS = [
    { id: 'tsp-ten', name: 'Ten towns', problem: 'tsp', budget: 200, seed: 1,
      brief: 'A courier must visit ten towns once each and come home. You may score <b>200</b> candidate tours. The first rule that comes to mind (always go to the nearest town) is not the shortest.',
      inst: { pts: [[43,2],[27,4],[45,28],[29,9],[15,33],[11,5],[42,28],[47,52],[19,41],[17,40]] } },
    { id: 'tsp-clusters', name: 'Three clusters', problem: 'tsp', budget: 150, seed: 1,
      brief: 'Eleven stops in three tight clusters, only <b>150</b> candidates to spend. Most settings burn the budget before they find the cheapest way to hop between clusters.',
      inst: { pts: [[9,10],[43,38],[81,8],[10,6],[52,33],[90,10],[9,0],[46,34],[92,4],[10,10],[43,30]] } },
    { id: 'bp-fourteen', name: 'Fourteen parcels', problem: 'bp', budget: 250, seed: 1,
      brief: 'Fourteen parcels go into bins of 100, placed first-fit in the order you search for. The textbook rule (biggest first) uses one bin too many.',
      inst: { items: [36,47,41,44,34,34,27,24,22,49,47,25,32,32], cap: 100 } },
    { id: 'bp-tight', name: 'A tight fit', problem: 'bp', budget: 250, seed: 1,
      brief: 'Another fourteen, and the optimum is packed almost to the brim. Biggest-first again misses it by a bin.',
      inst: { items: [39,49,33,25,22,29,35,22,37,46,35,46,29,45], cap: 100 } },
    { id: 'js-four', name: 'Four jobs, three machines', problem: 'js', budget: 250, seed: 1,
      brief: 'Four jobs, each a fixed route over three machines. Order the operations so that the last one finishes as early as possible. A machine does one thing at a time.',
      inst: { jobs: [[[1,6],[2,5],[0,1]],[[0,8],[1,3],[2,1]],[[1,3],[0,3],[2,3]],[[0,4],[1,5],[2,2]]] } },
    { id: 'js-bottleneck', name: 'The bottleneck', problem: 'js', budget: 250, seed: 1,
      brief: 'The same shop with a machine everyone queues for. The rule of thumb (most work left goes first) is badly wrong here.',
      inst: { jobs: [[[0,2],[1,1],[2,7]],[[1,8],[2,3],[0,3]],[[1,3],[0,5],[2,7]],[[0,6],[1,6],[2,4]]] } }
  ];
  engine.LEVELS = LEVELS;
  var optCache = {};
  function optimum(L) { return optCache[L.id] != null ? optCache[L.id] : (optCache[L.id] = PROBLEMS[L.problem].optimum(L.inst)); }
  function gapOf(L, score) { var o = optimum(L); return (score - o) / o; }
  function medalOf(L, score) { var g = gapOf(L, score); return g === 0 ? 'gold' : (g <= 0.03 ? 'silver' : (g <= 0.12 ? 'bronze' : null)); }
  engine.optimum = optimum; engine.gapOf = gapOf; engine.medalOf = medalOf; engine.run = runMethod;

  function jsSchedule(inst, seq) {
    var nxt = [], jr = [], mr = {}, ops = [];
    inst.jobs.forEach(function (_, j) { nxt[j] = 0; jr[j] = 0; });
    seq.forEach(function (job) { var op = inst.jobs[job][nxt[job]++], s = Math.max(jr[job], mr[op[0]] || 0), e = s + op[1]; jr[job] = e; mr[op[0]] = e; ops.push({ job: job, m: op[0], s: s, e: e }); });
    return ops;
  }
  function binsOf(inst, seq) {
    var bins = []; seq.forEach(function (i) { var w = inst.items[i], placed = false; for (var b = 0; b < bins.length; b++) if (bins[b].used + w <= inst.cap) { bins[b].used += w; bins[b].items.push(w); placed = true; break; } if (!placed) bins.push({ used: w, items: [w] }); });
    return bins;
  }
  engine.jsSchedule = jsSchedule; engine.binsOf = binsOf;

  function fsSets(seed0) { var out = []; for (var s = 1; s <= 12; s++) { var r = rng(seed0 * 1000 + s * 31), items = []; for (var i = 0; i < 16; i++) items.push(22 + Math.floor(r() * 28)); out.push({ items: items, cap: 100 }); } return out; }
  var FS = { train: fsSets(29), held: fsSets(36) };
  function fsPack(set, fn) {
    var n = set.items.length, keys = [], idx = [], i; for (i = 0; i < n; i++) { keys.push(fn(set.items[i], i, set.items.slice())); idx.push(i); }
    idx.sort(function (a, b) { return keys[b] - keys[a] || a - b; });
    return BP.eval(set, idx).score;
  }
  var FS_REF = 'return size + 2 * (size % 9);';
  var FS_STARTERS = { ff: ['First-fit', 'return -i;'], ffd: ['First-fit decreasing', 'return size;'], ref: ['The best known rule', FS_REF] };
  function fsTotals() {
    if (FS.totals) return FS.totals;
    var sum = function (a, f) { return a.reduce(function (x, s) { return x + f(s); }, 0); };
    var ff = function (s) { return fsPack(s, function (z, i) { return -i; }); }, ffd = function (s) { return fsPack(s, function (z) { return z; }); }, ref = function (s) { return fsPack(s, function (z) { return z + 2 * (z % 9); }); };
    FS.totals = { opt: sum(FS.train, function (s) { return BP.optimum(s); }), ff: sum(FS.train, ff), ffd: sum(FS.train, ffd), ref: sum(FS.train, ref),
      heldOpt: sum(FS.held, function (s) { return BP.optimum(s); }), heldFfd: sum(FS.held, ffd), heldRef: sum(FS.held, ref) };
    return FS.totals;
  }
  function fsMedal(total) { var t = fsTotals(); return total <= t.ref ? 'gold' : (total < t.ffd ? 'silver' : (total <= t.ffd ? 'bronze' : null)); }
  engine.fs = { sets: FS, totals: fsTotals, medal: fsMedal, pack: fsPack, REF: FS_REF, starters: FS_STARTERS };

  var KEY = 'arena', KEYFS = 'arenafs';
  var FSLEVEL = 1;
  var def = {
    id: 'arena', title: 'Heuristic Arena', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'Seven ways to search, one budget, and a problem whose best answer is known. Which method earns its keep? Then write the rule yourself.',
    about: {
      goal: 'Pick a search method and its one setting, spend the budget, and get as close as you can to the proven best answer. In the second tab, write the scoring rule yourself and see if it generalises.',
      how: 'Choose a level, choose a method and a setting, press <strong>Run</strong>. Every run uses the same budget of candidate answers and is repeatable. Compare runs on the chart and in the table.',
      inspired: 'The standard toolbox of metaheuristics (hill-climbing, simulated annealing, tabu search, genetic algorithms, ant colonies, large-neighbourhood search), and FunSearch (Romera-Paredes et al., Nature 625, 2024), which searches over programs.',
      learn: 'That no method wins everywhere, that the setting matters as much as the method, that a clever method can lose to a plain one with the right budget, and that a rule that scores well on the sets you tuned it on may not on fresh ones.',
      link: 'feasible.html', linkText: 'The Feasible Region, the optimisation course ▸', tier: 'Proven',
      or: 'Searching for good solutions when the best one cannot be found by trying everything is the heart of combinatorial optimisation'
    },
    honest: 'Honest model: the three problems are small on purpose so the optimum can be proved in the page (Held-Karp for tours, branch and bound for bins, a complete search over dispatch orders for the job shop). Real problems are far too large for that. A run is one seeded attempt, so a method that missed here might hit with another seed; the point of the arena is the shape of the comparison, not a ranking. In Be FunSearch the best-known rule was found by a search over a small family on these sets, so it is not proved best, and you are the program generator where FunSearch used a language model.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, tab = 'arena', meth = 'hill', knob = 1, runs = [], best = null;
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'arc'; root.appendChild(wrap);
    function frame() { return W.SymbiQ.games && W.SymbiQ.games.frame; }
    function ladderState(k) { var f = frame(); return f && f.ladder ? f.ladder.state(k) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = frame(); return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function mark(k, n, med) { try { var f = frame(); if (f && f.ladder && med) f.ladder.markCleared(k, n, med); } catch (x) { } }
    var G = { gold: '🥇', silver: '🥈', bronze: '🥉' };
    function resume() { var st = ladderState(KEY), r = 0; for (var i = 1; i <= LEVELS.length; i++) if (st.cleared[i]) r = Math.min(i, LEVELS.length - 1); return r; }

    function tabsHTML() { return '<div class="ar-tabs" role="tablist" aria-label="Arena, the Volcano and Bench, or Be FunSearch">' +
      '<button type="button" role="tab" class="ar-tab' + (tab === 'arena' ? ' now' : '') + '" aria-selected="' + (tab === 'arena') + '" data-tab="arena">The Arena</button>' +
      '<button type="button" role="tab" class="ar-tab' + (tab === 'family' ? ' now' : '') + '" aria-selected="' + (tab === 'family') + '" data-tab="family">Volcano and Bench</button>' +
      '<button type="button" role="tab" class="ar-tab' + (tab === 'fs' ? ' now' : '') + '" aria-selected="' + (tab === 'fs') + '" data-tab="fs">Be FunSearch</button></div>'; }

    function pictureHTML(L, b) {
      if (L.problem === 'tsp') {
        var pts = L.inst.pts, xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; }), x0 = Math.min.apply(null, xs) - 6, x1 = Math.max.apply(null, xs) + 6, y0 = Math.min.apply(null, ys) - 6, y1 = Math.max.apply(null, ys) + 6;
        var path = b ? b.seq.map(function (i, k) { return (k ? 'L' : 'M') + pts[i][0] + ' ' + pts[i][1]; }).join(' ') + ' Z' : '';
        return '<svg class="ar-pic" viewBox="' + x0 + ' ' + y0 + ' ' + (x1 - x0) + ' ' + (y1 - y0) + '" role="img" aria-label="' + (b ? 'The best tour so far, length ' + (b.score / 10).toFixed(1) : 'The towns, no tour yet') + '">' +
          (path ? '<path d="' + path + '" fill="none" stroke="var(--teal)" stroke-width="0.9" stroke-linejoin="round"/>' : '') +
          pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.6" fill="var(--violet)"/>'; }).join('') + '</svg>';
      }
      if (L.problem === 'bp') {
        var bins = b ? binsOf(L.inst, b.seq) : [], shade = ['#8b5cf6', '#2dd4bf', '#fbbf24', '#fb7185', '#7dd3fc', '#a3e635'];
        return '<svg class="ar-pic" viewBox="0 0 204 ' + Math.max(1, bins.length) * 16 + '" role="img" aria-label="' + (b ? b.score + ' bins' : 'No packing yet') + '">' + bins.map(function (bn, r) { var x = 0;
          return '<rect x="0" y="' + (r * 16) + '" width="200" height="13" rx="2" fill="none" stroke="var(--border)"/>' + bn.items.map(function (w, k) { var g = '<rect x="' + (x * 2) + '" y="' + (r * 16) + '" width="' + (w * 2 - 1) + '" height="13" rx="2" fill="' + shade[k % shade.length] + '"/><text x="' + (x * 2 + w) + '" y="' + (r * 16 + 10) + '" font-size="8" text-anchor="middle" fill="#0b1020">' + w + '</text>'; x += w; return g; }).join(''); }).join('') + '</svg>';
      }
      var ops = b ? jsSchedule(L.inst, b.seq) : [], mk = ops.reduce(function (a, o) { return Math.max(a, o.e); }, 1), col = ['#8b5cf6', '#2dd4bf', '#fbbf24', '#fb7185'], sc = 200 / mk;
      return '<svg class="ar-pic" viewBox="0 0 204 56" role="img" aria-label="' + (b ? 'Schedule on three machines finishing at ' + mk : 'No schedule yet') + '">' + ops.map(function (o) {
        return '<rect x="' + (o.s * sc) + '" y="' + (o.m * 18) + '" width="' + Math.max(1, (o.e - o.s) * sc - 1) + '" height="15" rx="2" fill="' + col[o.job % col.length] + '"/><text x="' + ((o.s + o.e) / 2 * sc) + '" y="' + (o.m * 18 + 11) + '" font-size="8" text-anchor="middle" fill="#0b1020">J' + (o.job + 1) + '</text>'; }).join('') + '</svg>';
    }
    function chartHTML(L) {
      if (!runs.length) return '';
      var o = optimum(L), hi = Math.max.apply(null, runs.map(function (r) { return r.first; }).concat([o * 1.2])), lo = o * 0.98, colr = ['#8b5cf6', '#2dd4bf', '#fbbf24', '#fb7185', '#7dd3fc', '#a3e635'];
      var X = function (e) { return 8 + (e / L.budget) * 204; }, Y = function (v) { return 6 + (1 - (v - lo) / (hi - lo)) * 78; };
      return '<svg class="ar-chart" viewBox="0 0 220 96" role="img" aria-label="Best answer found against candidates spent, one line per run, with the proven best as a dashed line">' +
        '<line x1="8" x2="212" y1="' + Y(o) + '" y2="' + Y(o) + '" stroke="var(--teal)" stroke-dasharray="3 3"/><text x="212" y="' + (Y(o) - 2) + '" font-size="6" text-anchor="end" fill="var(--muted)">proven best</text>' +
        runs.map(function (r, i) { return '<polyline fill="none" stroke="' + colr[i % colr.length] + '" stroke-width="1.2" points="' + r.trace.map(function (t) { return X(t[0]).toFixed(1) + ',' + Y(t[1]).toFixed(1); }).join(' ') + ' ' + X(L.budget).toFixed(1) + ',' + Y(r.score).toFixed(1) + '"/>'; }).join('') +
        '<text x="8" y="94" font-size="6" fill="var(--muted)">0</text><text x="212" y="94" font-size="6" text-anchor="end" fill="var(--muted)">' + L.budget + ' candidates</text></svg>';
    }
    function fmt(L, v) { return L.problem === 'tsp' ? (v / 10).toFixed(1) : String(v); }

    function arenaHTML() {
      var L = LEVELS[lvl], P = PROBLEMS[L.problem], M = METHODS.filter(function (m) { return m.id === meth; })[0], st = ladderState(KEY);
      var chips = '<div class="ar-strip" role="list" aria-label="Levels">' + LEVELS.map(function (l, i) { var med = st.medal[i + 1], g = med ? G[med] : (unlocked(i + 1) ? (i + 1) : '🔒');
        return '<button type="button" role="listitem" class="ar-chip' + (i === lvl ? ' now' : '') + '" data-lv="' + i + '"' + (unlocked(i + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(i + 1) ? '' : ', locked') + '">' + g + ' ' + esc(l.name) + '</button>'; }).join('') + '</div>';
      var methods = '<div class="ar-methods" role="radiogroup" aria-label="Method">' + METHODS.map(function (m) { return '<button type="button" role="radio" class="ar-m' + (m.id === meth ? ' now' : '') + '" aria-checked="' + (m.id === meth) + '" data-m="' + m.id + '"><b>' + esc(m.name) + '</b></button>'; }).join('') + '</div>';
      var knobs = M.knob ? '<div class="ar-knobs" role="radiogroup" aria-label="Setting for ' + esc(M.name) + '">' + M.knob.map(function (k, i) { return '<button type="button" role="radio" class="ar-k' + (i === knob ? ' now' : '') + '" aria-checked="' + (i === knob) + '" data-k="' + i + '">' + esc(k) + '</button>'; }).join('') + '</div>' : '<p class="ar-knobs-none">No setting: greedy builds one answer and stops.</p>';
      var last = runs[runs.length - 1];
      var table = runs.length ? '<table class="ar-runs"><caption>Your runs on this level</caption><thead><tr><th scope="col">#</th><th scope="col">Method</th><th scope="col">Setting</th><th scope="col">Result</th><th scope="col">Gap to proven best</th></tr></thead><tbody>' +
        runs.map(function (r, i) { return '<tr' + (r === best ? ' class="best"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.setting) + '</td><td>' + fmt(L, r.score) + '</td><td>' + (r.gap === 0 ? 'none: the optimum ' + (r.med ? G[r.med] : '') : (r.gap * 100).toFixed(1) + '%' + (r.med ? ' ' + G[r.med] : '')) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
      return tabsHTML() + chips + '<p class="ar-brief">' + L.brief + '</p>' +
        '<p class="ar-facts"><b>Par</b> ' + fmt(L, optimum(L)) + ' (' + P.unit + ', proved by exhaustive search) &middot; <b>Budget</b> ' + L.budget + ' candidate answers &middot; <b>Greedy gets</b> ' + fmt(L, runMethod(L, 'greedy', 0).best.score) + '</p>' +
        '<div class="ar-board">' + pictureHTML(L, best ? best.best : null) + '</div>' +
        methods + '<p class="ar-blurb">' + esc(M.blurb) + '</p>' + knobs +
        '<div class="ar-act"><button type="button" class="preset ar-run" data-a="run">Run ' + esc(M.name) + '</button> <button type="button" class="preset" data-a="clear"' + (runs.length ? '' : ' disabled') + '>Clear runs</button></div>' +
        chartHTML(L) + table +
        '<p class="ar-say" role="status" aria-live="polite">' + (last ? sayRun(L, last) : 'Pick a method and a setting, then run. Compare several: no one method wins every level.') + '</p>';
    }
    function sayRun(L, r) { var o = optimum(L);
      return '<strong>' + fmt(L, r.score) + (r.gap === 0 ? ': the proven best.' : ' against a best of ' + fmt(L, o) + ' (' + (r.gap * 100).toFixed(1) + '% over).') + '</strong> ' + (r.med ? G[r.med] + ' ' + r.med + '. ' : 'Not close enough for a medal: try another method or setting. ') + 'It scored ' + r.evals + ' candidates.'; }

    var fsBusy = false, fsLast = null;
    function loadBoard() { try { var v = JSON.parse(localStorage.getItem('symbiq_arena_v1')); return v && Array.isArray(v.fs) ? v.fs.filter(function (e) { return e && typeof e.code === 'string' && typeof e.total === 'number'; }).slice(0, 3) : []; } catch (e) { return []; } }
    function saveBoard(entry) { try { var b = loadBoard().filter(function (e) { return e.code !== entry.code; }); b.push(entry); b.sort(function (x, y) { return x.total - y.total; }); localStorage.setItem('symbiq_arena_v1', JSON.stringify({ fs: b.slice(0, 3) })); } catch (e) { } }
    function fsHTML() {
      var T = fsTotals(), board = loadBoard(), starter = fsLast ? fsLast.code : FS_STARTERS.ff[1];
      return tabsHTML() + '<p class="ar-brief">FunSearch searches the space of <b>programs</b>: a model writes a small scoring function, a fast evaluator scores it, the best survive. Here you are the model. Write the body of a function of <code>size</code>, <code>i</code> (the item&rsquo;s position) and <code>sizes</code> (all sixteen). It returns a number; items are packed first-fit in <b>descending</b> order of that number, into bins of 100.</p>' +
        '<p class="ar-facts"><b>Twelve sets</b> of sixteen items &middot; <b>Proven optimum</b> ' + T.opt + ' bins in total &middot; <b>First-fit</b> ' + T.ff + ' &middot; <b>First-fit decreasing</b> ' + T.ffd + ' &middot; <b>Best known rule</b> ' + T.ref + ' (found by a search over a small family of rules; not proved best)</p>' +
        '<label class="ar-lab" for="ar-code">Your rule (JavaScript, the body of a function)</label>' +
        '<textarea id="ar-code" class="ar-code" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off">' + esc(starter) + '</textarea>' +
        '<div class="ar-act"><button type="button" class="preset ar-run" data-a="fsrun"' + (fsBusy ? ' disabled' : '') + '>Run my rule</button> ' +
        Object.keys(FS_STARTERS).filter(function (k) { return k !== 'ref'; }).map(function (k) { return '<button type="button" class="preset" data-load="' + k + '">Load ' + esc(FS_STARTERS[k][0]) + '</button>'; }).join(' ') + '</div>' +
        '<p class="ar-note">Your rule runs in a sandboxed Worker: no page, no network, stopped after two seconds. It is yours alone; nothing is sent anywhere.</p>' +
        '<p class="ar-say" id="ar-fs-say" role="status" aria-live="polite">' + (fsLast ? sayFs(fsLast) : 'Start from first-fit, or load first-fit decreasing and try to beat it. Hint: a bin that fits an item <i>exactly</i>, or leaves a useful gap, is worth more than the item&rsquo;s size alone.') + '</p>' +
        (board.length ? '<table class="ar-runs"><caption>Your three best rules on this device</caption><thead><tr><th scope="col">Total bins</th><th scope="col">Fresh sets</th><th scope="col">Rule</th></tr></thead><tbody>' + board.map(function (e) { return '<tr><td>' + e.total + '</td><td>' + (e.held == null ? '' : e.held) + '</td><td><code>' + esc(e.code.replace(/\s+/g, ' ').slice(0, 80)) + '</code></td></tr>'; }).join('') + '</tbody></table>' : '');
    }
    function sayFs(r) {
      if (!r.ok) return '<strong>No score.</strong> ' + esc(r.error);
      var T = fsTotals(), med = fsMedal(r.total), g = med ? G[med] + ' ' + med + '. ' : 'Not yet as good as first-fit decreasing. ';
      return '<strong>' + r.total + ' bins</strong> over the twelve sets (optimum ' + T.opt + ', first-fit decreasing ' + T.ffd + ', best known ' + T.ref + '). ' + g +
        'On <b>twelve fresh sets</b> the rule has never seen: <b>' + r.heldTotal + '</b> bins (optimum ' + T.heldOpt + ', first-fit decreasing ' + T.heldFfd + ', best known ' + T.heldRef + '). ' +
        (r.heldTotal - T.heldFfd > r.total - T.ffd + 1 ? 'Against first-fit decreasing it did worse on the fresh sets than on the ones you tuned on: that is overfitting.' : 'A rule that keeps its edge on fresh sets has found something real.');
    }
    function runFs() {
      var ta = wrap.querySelector('#ar-code'), code = ta ? ta.value : '', say = wrap.querySelector('#ar-fs-say');
      if (fsBusy) return; fsBusy = true; if (say) say.textContent = 'Running your rule in the sandbox...';
      var btn = wrap.querySelector('[data-a="fsrun"]'); if (btn) btn.disabled = true;
      var done = false, w, timer;
      function finish(res) {
        if (done) return; done = true; fsBusy = false; W.clearTimeout(timer); try { w.terminate(); } catch (e) { }
        fsLast = { ok: !!res.ok, error: res.error, total: res.total, heldTotal: res.heldTotal, code: code };
        if (res.ok) { saveBoard({ code: code, total: res.total, held: res.heldTotal }); var med = fsMedal(res.total); if (med) mark(KEYFS, 1, med); }
        API.lastFs = fsLast; paintKeep(code);
      }
      try { w = new Worker(workerUrl()); } catch (e) { finish({ ok: false, error: 'This browser could not start a Worker, so the sandbox is not available. The Arena tab does not need one.' }); return; }
      timer = W.setTimeout(function () { finish({ ok: false, error: 'Stopped: your rule ran for more than two seconds.' }); }, 2000);
      w.onmessage = function (e) { finish(e.data || { ok: false, error: 'No answer from the sandbox.' }); };
      w.onerror = function (e) { finish({ ok: false, error: 'The rule crashed: ' + (e && e.message ? e.message : 'error') }); };
      w.postMessage({ code: code, sets: FS.train, held: FS.held });
    }
    function workerUrl() { var t = document.getElementById('arena-worker-src'); return t && t.getAttribute('src') ? t.getAttribute('src') : 'arena-worker.js'; }
    function paintKeep(code) { paint(); var ta = wrap.querySelector('#ar-code'); if (ta) ta.value = code; var b = wrap.querySelector('[data-a="fsrun"]'); if (b) b.focus(); }

    var vRules = null;
    function familyHTML() {
      var st = ladderState('volcano'), cleared = Object.keys(st.cleared || {}).length, medals = Object.keys(st.medal || {}).map(function (k) { return G[st.medal[k]] || ''; }).join('');
      var total = vRules && vRules.ladders && vRules.ladders.volcano ? vRules.ladders.volcano.levels : null;
      return tabsHTML() + '<p class="ar-brief">Two older machines are the arena&rsquo;s first level and its race mode. They keep their own saves and addresses; nothing you earned there moves.</p>' +
        '<div class="ar-fam"><h3>Level 1: The Annealing Volcano</h3><p>You are not the climber, you are the temperature. Simulated annealing is the third method in the arena; here you hold the cooling schedule yourself and feel why a method that never accepts a worse move cannot leave a valley.</p>' +
        '<p class="ar-facts"><b>Your ladder</b> ' + cleared + (total ? ' of ' + total : '') + ' levels cleared ' + medals + '</p>' +
        '<p><a class="preset" href="play.html#volcano">Play the Volcano</a></p></div>' +
        '<div class="ar-fam"><h3>Race mode: The Bench</h3><p>One run proves nothing, so the Bench replays three very different methods many times on the same problem and shows the spread, the same discipline the arena applies with a fixed budget and a proven best.</p>' +
        '<p><a class="preset" href="analog.html#bench">Open the Bench</a></p></div>';
    }
    function paint() { wrap.innerHTML = tab === 'arena' ? arenaHTML() : (tab === 'family' ? familyHTML() : fsHTML()); }
    try { var P = W.SymbiQ.progress; if (P && P.rules) P.rules().then(function (r) { vRules = r; if (tab === 'family') paint(); })['catch'](function () {}); } catch (e) { }
    function start(n) { lvl = n; runs = []; best = null; paint(); }
    function doRun() {
      var L = LEVELS[lvl], M = METHODS.filter(function (m) { return m.id === meth; })[0], res = runMethod(L, meth, M.knob ? knob : 0), gap = gapOf(L, res.best.score), med = medalOf(L, res.best.score);
      var r = { name: M.name, setting: M.knob ? M.knob[knob] : 'none', score: res.best.score, gap: gap, med: med, evals: res.evals, trace: res.trace, first: res.first, best: res.best };
      runs.push(r); if (!best || r.score < best.score) best = r;
      if (med) mark(KEY, lvl + 1, med);
      paint(); var b = wrap.querySelector('[data-a="run"]'); if (b) b.focus();
    }
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-tab')) { tab = b.getAttribute('data-tab'); paint(); var t = wrap.querySelector('[data-tab="' + tab + '"]'); if (t) t.focus(); return; }
      if (b.hasAttribute('data-lv')) { var n = +b.getAttribute('data-lv'); if (unlocked(n + 1)) start(n); return; }
      if (b.hasAttribute('data-m')) { meth = b.getAttribute('data-m'); knob = 1; paint(); var m = wrap.querySelector('[data-m="' + meth + '"]'); if (m) m.focus(); return; }
      if (b.hasAttribute('data-k')) { knob = +b.getAttribute('data-k'); paint(); var k = wrap.querySelector('[data-k="' + knob + '"]'); if (k) k.focus(); return; }
      if (b.hasAttribute('data-load')) { var ta = wrap.querySelector('#ar-code'); ta.value = FS_STARTERS[b.getAttribute('data-load')][1]; ta.focus(); return; }
      var a = b.getAttribute('data-a');
      if (a === 'run') doRun(); else if (a === 'clear') { runs = []; best = null; paint(); } else if (a === 'fsrun') runFs();
    });
    wrap.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('[role="radiogroup"]'); if (!g || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      var items = [].slice.call(g.querySelectorAll('[role="radio"]')), i = items.indexOf(e.target); if (i < 0) return;
      e.preventDefault(); var j = (i + (/Left|Up/.test(e.key) ? -1 : 1) + items.length) % items.length; items[j].click();
    });
    start(resume());
    return { state: function () { return { lvl: lvl, tab: tab, meth: meth, knob: knob, runs: runs.length }; }, runs: function () { return runs.map(function (r) { return { name: r.name, score: r.score, gap: r.gap, med: r.med }; }); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null, lastFs: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.arena = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
