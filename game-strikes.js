(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};
  var engine = {};

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
  function orth4(r) {
    var rows = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var v = [gauss(r), gauss(r), gauss(r), gauss(r)];
      for (j = 0; j < i; j++) { var dot = 0; for (k = 0; k < 4; k++) dot += v[k] * rows[j][k]; for (k = 0; k < 4; k++) v[k] -= dot * rows[j][k]; }
      var nm = Math.sqrt(v.reduce(function (a, b) { return a + b * b; }, 0));
      rows.push(v.map(function (x) { return x / nm; }));
    }
    return rows;
  }
  var CZG = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, -1]];

  function pairsOf(n, layer) { var p = [], s = layer % 2 === 1 ? 0 : 1; for (var i = s; i + 1 < n; i += 2) p.push(i); return p; }
  function circuit(n, d, seed, fam) {
    var r = rng(seed), th = [], gs = [], l, q;
    for (l = 0; l < d; l++) {
      var row = [];
      if (fam !== 'haar') for (q = 0; q < n; q++) row.push(r() * 2 * Math.PI);
      th.push(row);
      gs.push(pairsOf(n, l + 1).map(function () { return fam === 'haar' ? orth4(r) : CZG; }));
    }
    return { n: n, d: d, th: th, gs: gs, fam: fam === 'haar' ? 'haar' : 'cz' };
  }
  function gateCount(n, d) { var g = 0; for (var l = 1; l <= d; l++) g += pairsOf(n, l).length; return g; }
  function rankCaps(n, d, fam) {
    var caps = [];
    for (var c = 1; c < n; c++) {
      var cross = 0; for (var l = 1; l <= d; l++) if (pairsOf(n, l).indexOf(c - 1) >= 0) cross++;
      caps.push(Math.pow(2, Math.min(c, n - c, fam === 'haar' ? 2 * cross : cross)));
    }
    return caps;
  }
  function exactChi(n, d, fam) { return Math.max.apply(null, rankCaps(n, d, fam)); }

  function svCost(n, d, fam) { return ((fam === 'haar' ? 0 : 3 * n * d) + 4 * gateCount(n, d)) * Math.pow(2, n); }
  function svBytes(n) { return 8 * Math.pow(2, n); }
  function stateVector(C) {
    var n = C.n, N = Math.pow(2, n), v = new Float64Array(N), ops = 0, l, q, i; v[0] = 1;
    for (l = 1; l <= C.d; l++) {
      for (q = 0; q < (C.th[l - 1].length ? n : 0); q++) {
        var c = Math.cos(C.th[l - 1][q] / 2), s = Math.sin(C.th[l - 1][q] / 2), bit = Math.pow(2, n - 1 - q);
        for (i = 0; i < N; i++) if (Math.floor(i / bit) % 2 === 0) { var a = v[i], b = v[i + bit]; v[i] = c * a - s * b; v[i + bit] = s * a + c * b; }
        ops += 3 * N;
      }
      pairsOf(n, l).forEach(function (p, pi) {
        var G = C.gs[l - 1][pi], b1 = Math.pow(2, n - 1 - p), b2 = Math.pow(2, n - 2 - p), x = [0, 0, 0, 0], ix, u, w, sm;
        for (var i2 = 0; i2 < N; i2++) if (Math.floor(i2 / b1) % 2 === 0 && Math.floor(i2 / b2) % 2 === 0) {
          ix = [i2, i2 + b2, i2 + b1, i2 + b1 + b2];
          for (u = 0; u < 4; u++) x[u] = v[ix[u]];
          for (u = 0; u < 4; u++) { sm = 0; for (w = 0; w < 4; w++) sm += G[u][w] * x[w]; v[ix[u]] = sm; }
        }
        ops += 4 * N;
      });
    }
    var tot = 0, k;
    for (k = 0; k < n - 1; k++) {
      var c1 = Math.pow(2, n - 1 - k), c2 = Math.pow(2, n - 2 - k), z = 0;
      for (i = 0; i < N; i++) z += ((Math.floor(i / c1) % 2) ^ (Math.floor(i / c2) % 2) ? -1 : 1) * v[i] * v[i];
      tot += z;
    }
    return { value: tot / (n - 1), ops: ops, fidelity: 1, state: v };
  }

  function svd(A, m, k) {
    var tr = m < k, M = m, K = k, W;
    if (tr) { W = new Float64Array(A.length); for (var i = 0; i < m; i++) for (var j = 0; j < k; j++) W[j * m + i] = A[i * k + j]; M = k; K = m; } else W = A;
    var cols = [], V = [], i2, j2, p, q;
    for (j2 = 0; j2 < K; j2++) { var c = new Float64Array(M); for (i2 = 0; i2 < M; i2++) c[i2] = W[i2 * K + j2]; cols.push(c); var e = new Float64Array(K); e[j2] = 1; V.push(e); }
    for (var sweep = 0; sweep < 40; sweep++) {
      var rot = 0;
      for (p = 0; p < K - 1; p++) for (q = p + 1; q < K; q++) {
        var cp = cols[p], cq = cols[q], al = 0, be = 0, ga = 0;
        for (i2 = 0; i2 < M; i2++) { al += cp[i2] * cp[i2]; be += cq[i2] * cq[i2]; ga += cp[i2] * cq[i2]; }
        if (ga === 0 || Math.abs(ga) <= 1e-15 * Math.sqrt(al * be)) continue;
        rot++;
        var z = (be - al) / (2 * ga), t = (z >= 0 ? 1 : -1) / (Math.abs(z) + Math.sqrt(1 + z * z)), cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
        for (i2 = 0; i2 < M; i2++) { var a = cp[i2], b = cq[i2]; cp[i2] = cs * a - sn * b; cq[i2] = sn * a + cs * b; }
        var vp = V[p], vq = V[q];
        for (i2 = 0; i2 < K; i2++) { var a2 = vp[i2], b2 = vq[i2]; vp[i2] = cs * a2 - sn * b2; vq[i2] = sn * a2 + cs * b2; }
      }
      if (!rot) break;
    }
    var sv = cols.map(function (cc, idx) { var s = 0; for (var x = 0; x < M; x++) s += cc[x] * cc[x]; return { s: Math.sqrt(s), idx: idx }; });
    sv.sort(function (x, y) { return y.s - x.s; });
    var s0 = sv[0].s || 1, r = 0; while (r < sv.length && sv[r].s > 1e-13 * s0) r++; if (!r) r = 1;
    var Um = new Float64Array(M * r), Vm = new Float64Array(K * r), S = new Float64Array(r);
    for (var c2 = 0; c2 < r; c2++) { var o = sv[c2], col = cols[o.idx], vv = V[o.idx]; S[c2] = o.s; for (i2 = 0; i2 < M; i2++) Um[i2 * r + c2] = o.s ? col[i2] / o.s : 0; for (i2 = 0; i2 < K; i2++) Vm[i2 * r + c2] = vv[i2]; }
    return tr ? { U: Vm, S: S, V: Um, r: r } : { U: Um, S: S, V: Vm, r: r };
  }
  function svdCost(m, k) { return 6 * m * k * Math.min(m, k); }

  function mps(C, chi, budget) {
    var n = C.n, A = [], ops = 0, fid = 1, disc = 0, i, maxBond = 1, cen = 0, over = false;
    for (i = 0; i < n; i++) A.push({ l: 1, r: 1, d: Float64Array.from([1, 0]) });
    function shift(c, dir) {
      var T, m, k, f, r, N, nd, a, s, b, x;
      if (dir > 0) {
        T = A[c]; m = T.l * 2; k = T.r; f = svd(T.d, m, k); ops += svdCost(m, k);
        r = f.r; N = A[c + 1]; nd = new Float64Array(r * 2 * N.r);
        A[c] = { l: T.l, r: r, d: f.U };
        for (a = 0; a < r; a++) for (x = 0; x < k; x++) { var w = f.S[a] * f.V[x * r + a]; if (!w) continue; for (s = 0; s < 2; s++) for (b = 0; b < N.r; b++) nd[(a * 2 + s) * N.r + b] += w * N.d[(x * 2 + s) * N.r + b]; }
        A[c + 1] = { l: r, r: N.r, d: nd }; ops += r * k * 2 * N.r;
      } else {
        T = A[c]; m = T.l; k = 2 * T.r; f = svd(T.d, m, k); ops += svdCost(m, k);
        r = f.r; var P = A[c - 1], o = new Float64Array(r * k), q, j;
        for (q = 0; q < r; q++) for (j = 0; j < k; j++) o[q * k + j] = f.V[j * r + q];
        A[c] = { l: r, r: T.r, d: o };
        nd = new Float64Array(P.l * 2 * r);
        for (a = 0; a < P.l * 2; a++) for (b = 0; b < r; b++) { var sum = 0; for (x = 0; x < P.r; x++) sum += P.d[a * P.r + x] * f.U[x * r + b] * f.S[b]; nd[a * r + b] = sum; }
        A[c - 1] = { l: P.l, r: r, d: nd }; ops += P.l * 2 * P.r * r;
      }
    }
    function moveTo(t) { while (cen < t) { shift(cen, 1); cen++; } while (cen > t) { shift(cen, -1); cen--; } }
    function gate(p, G) {
      var X = A[p], Y = A[p + 1], l = X.l, r = Y.r, c = X.r, T4 = new Float64Array(l * 4 * r), M = new Float64Array(l * 4 * r), a, s, t, b, x, s2, t2;
      for (a = 0; a < l; a++) for (s = 0; s < 2; s++) for (t = 0; t < 2; t++) for (b = 0; b < r; b++) { var sum = 0; for (x = 0; x < c; x++) sum += X.d[(a * 2 + s) * c + x] * Y.d[(x * 2 + t) * r + b]; T4[((a * 2 + s) * 2 + t) * r + b] = sum; }
      for (a = 0; a < l; a++) for (b = 0; b < r; b++) for (s2 = 0; s2 < 2; s2++) for (t2 = 0; t2 < 2; t2++) { var g = 0; for (s = 0; s < 2; s++) for (t = 0; t < 2; t++) g += G[s2 * 2 + t2][s * 2 + t] * T4[((a * 2 + s) * 2 + t) * r + b]; M[(a * 2 + s2) * (2 * r) + t2 * r + b] = g; }
      ops += l * 4 * c * r + l * r * 16;
      var m = l * 2, k = 2 * r; ops += svdCost(m, k);
      if (budget && ops > budget) { over = true; return; }
      var f = svd(M, m, k), keep = Math.min(chi, f.r), tot = 0, kept = 0, q;
      for (q = 0; q < f.r; q++) { tot += f.S[q] * f.S[q]; if (q < keep) kept += f.S[q] * f.S[q]; }
      var dl = tot > 0 ? (tot - kept) / tot : 0; fid *= (1 - dl); disc += dl; if (keep > maxBond) maxBond = keep;
      var U = new Float64Array(m * keep), V = new Float64Array(keep * k), nr = Math.sqrt(kept) || 1;
      for (a = 0; a < m; a++) for (q = 0; q < keep; q++) U[a * keep + q] = f.U[a * f.r + q];
      for (q = 0; q < keep; q++) for (x = 0; x < k; x++) V[q * k + x] = f.S[q] / nr * f.V[x * f.r + q];
      A[p] = { l: l, r: keep, d: U }; A[p + 1] = { l: keep, r: r, d: V }; cen = p + 1;
    }
    for (var L = 1; L <= C.d && !over; L++) {
      for (i = 0; i < (C.th[L - 1].length ? n : 0); i++) {
        var c0 = Math.cos(C.th[L - 1][i] / 2), s0 = Math.sin(C.th[L - 1][i] / 2), T = A[i], d = new Float64Array(T.d.length);
        for (var a = 0; a < T.l; a++) for (var b = 0; b < T.r; b++) { var u = T.d[(a * 2) * T.r + b], w = T.d[(a * 2 + 1) * T.r + b]; d[(a * 2) * T.r + b] = c0 * u - s0 * w; d[(a * 2 + 1) * T.r + b] = s0 * u + c0 * w; }
        A[i] = { l: T.l, r: T.r, d: d }; ops += 3 * T.d.length;
      }
      var ps = pairsOf(n, L).map(function (p, k) { return [p, C.gs[L - 1][k]]; }); if (L % 2 === 0) ps.reverse();
      for (var pi = 0; pi < ps.length && !over; pi++) {
        moveTo(ps[pi][0]);
        if (budget && ops > budget) { over = true; break; }
        gate(ps[pi][0], ps[pi][1]);
      }
    }
    if (over || (budget && ops > budget)) return { ok: false, over: true, ops: ops };
    var z = [1, -1], tot = 0, norm = 1;
    for (i = 0; i < n - 1; i++) {
      moveTo(i);
      if (budget && ops > budget) return { ok: false, over: true, ops: ops };
      var X = A[i], Y = A[i + 1], l = X.l, c = X.r, r = Y.r, val = 0, nrm = 0, a, s, t, b, x;
      for (a = 0; a < l; a++) for (s = 0; s < 2; s++) for (t = 0; t < 2; t++) for (b = 0; b < r; b++) {
        var sum = 0; for (x = 0; x < c; x++) sum += X.d[(a * 2 + s) * c + x] * Y.d[(x * 2 + t) * r + b];
        val += z[s] * z[t] * sum * sum; nrm += sum * sum;
      }
      ops += l * 4 * c * r; tot += val / nrm;
    }
    norm = 1;
    return { ok: true, over: false, value: tot / norm / (n - 1), ops: ops, fidelity: fid, discarded: disc, maxBond: maxBond, bonds: A.map(function (t) { return t.r; }).slice(0, n - 1) };
  }

  var LAND = 0.99;
  var CHIS = [2, 4, 8, 16, 32, 64];
  var MEGA = 1e6;
  var LEVELS = [
    { id: 'warm', name: 'Warm-up', fam: 'cz', n: 16, d: 4, seed: 3, budget: 100,
      brief: 'Sixteen qubits, four layers of mild gates. Everything works here, so the only question is which setting costs least.' },
    { id: 'wide', name: 'Wide and shallow', fam: 'cz', n: 40, d: 6, seed: 11, budget: 10,
      brief: 'Forty qubits, six layers of mild gates. Holding the whole state would take 2<sup>40</sup> numbers, about 8 TiB. A chain of small tables needs almost nothing.' },
    { id: 'wider', name: 'Wider, deeper', fam: 'cz', n: 48, d: 10, seed: 11, budget: 50,
      brief: 'Forty-eight qubits, ten layers. Too small a table and the answer drifts; too large and you cannot afford it. Find the one that lands.' },
    { id: 'narrow', name: 'Narrow and deep', fam: 'haar', n: 20, d: 12, seed: 5, budget: 520,
      brief: 'Twenty qubits, twelve layers of scrambling gates. Here the chain of tables fills up faster than it pays, and the plain state vector, a million numbers, is small enough to hold.' },
    { id: 'scrambled', name: 'Scrambled and wide', fam: 'haar', n: 40, d: 6, seed: 11, budget: 100,
      brief: 'Forty qubits, scrambling gates, six layers. The state vector is out of reach and the tables have to be large. On the Ledger, classical teams posted methods against D-Wave&rsquo;s 2025 simulation claim; that entry has the sources.',
      link: 'claim-dwave-magnetic-simulation-supremacy-2025.html', linkText: 'The D-Wave entry on the Ledger' },
    { id: 'boss', name: 'The stand-in', fam: 'haar', n: 30, d: 10, seed: 5, budget: 1000, boss: true,
      brief: 'Thirty qubits, ten layers, fully scrambling: the hardest circuit this toolbox can still land, and a stand-in sized for a browser, not the circuit of any real announcement. On 30 July 2026 IBM and Qedma announced a quantum-advantage result on a two-dimensional Floquet Ising model of up to 74 qubits and released the circuits to the Quantum Advantage Tracker for classical benchmarking. The Ledger logs that announcement without a verdict.',
      link: 'claim-ibm-verified-quantum-advantage-2026.html', linkText: 'The IBM entry on the Ledger' }
  ];
  var circuits = {}, results = {};
  function circuitOf(L) { return circuits[L.id] || (circuits[L.id] = circuit(L.n, L.d, L.seed, L.fam)); }
  function svAllowed(L) { return L.n <= 22 && svCost(L.n, L.d, L.fam) <= L.budget * MEGA; }
  function runOption(L, method, chi) {
    var key = L.id + ':' + method + ':' + (method === 'mps' ? chi : 0);
    if (results[key]) return results[key];
    var r;
    if (method === 'sv') {
      if (!svAllowed(L)) r = { ok: false, over: true, refused: true, ops: svCost(L.n, L.d, L.fam), bytes: svBytes(L.n) };
      else { var s = stateVector(circuitOf(L)); r = { ok: true, over: false, value: s.value, ops: s.ops, fidelity: 1, maxBond: 0, bonds: null }; }
    } else r = mps(circuitOf(L), chi, L.budget * MEGA);
    r.method = method; r.chi = chi || 0;
    r.lands = !!(r.ok && r.fidelity >= LAND && r.ops <= L.budget * MEGA);
    results[key] = r; return r;
  }
  function par(L) {
    var best = null, cand = [];
    if (svAllowed(L)) cand.push(runOption(L, 'sv', 0));
    for (var i = 0; i < CHIS.length; i++) { var r = runOption(L, 'mps', CHIS[i]); cand.push(r); if (r.lands || r.over) break; }
    cand.forEach(function (r) { if (r.lands && (!best || r.ops < best.ops)) best = r; });
    return best;
  }
  function medalOf(L, r) {
    if (!r || !r.lands) return null;
    var p = par(L);
    return r.ops <= p.ops ? 'gold' : (r.ops <= 4 * p.ops ? 'silver' : 'bronze');
  }
  engine.circuit = circuit; engine.stateVector = stateVector; engine.mps = mps; engine.svd = svd; engine.pairsOf = pairsOf; engine.rankCaps = rankCaps; engine.exactChi = exactChi;
  engine.svCost = svCost; engine.svBytes = svBytes; engine.gateCount = gateCount; engine.LEVELS = LEVELS; engine.CHIS = CHIS; engine.LAND = LAND;
  engine.runOption = runOption; engine.par = par; engine.medalOf = medalOf; engine.svAllowed = svAllowed;

  var KEY = 'strikes';
  var def = {
    id: 'strikes', title: 'Classical Strikes Back', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'A quantum circuit, a compute budget, and two ways to simulate it on an ordinary computer. Can the classical side hold the line?',
    about: {
      goal: 'Reproduce what a quantum circuit would compute using only an ordinary computer, inside a counted budget of operations, and cheaply enough to earn the gold.',
      how: 'Choose a level, then a method: the <strong>state vector</strong> (exact, but doubles in cost with every qubit) or a <strong>tensor network</strong> with a table-size setting. Press <strong>Run</strong>. A strike lands when the estimated fidelity is at least 0.99 inside the budget.',
      inspired: 'Classical simulation of quantum circuits: state-vector simulators, and matrix product states (tensor networks) in the line of White, Vidal and Schollw&ouml;ck. It is the same contest the quantum-advantage claims on the Ledger go through.',
      learn: 'That the cost of simulating a circuit is set by how much entanglement it makes, not by how many qubits it has, that mild circuits fall to a small tensor network at any width, and that scrambling ones do not.',
      link: 'race.html', linkText: 'The Race, who is ahead and why &#9656;', tier: 'Proven',
      or: 'Whether a quantum computer has beaten every classical method is decided by exactly this kind of contest'
    },
    honest: 'Honest model: the circuits are random one-dimensional brickworks, chosen so the page can compute them. The real advantage circuits are different (the IBM and Qedma announcement concerns a two-dimensional Floquet Ising model of up to 74 qubits), and real classical attempts use more methods than the two here. Cost is a count of arithmetic operations, tallied by the code, not a clock; the refusal for a state vector that is too large is arithmetic (2<sup>n</sup> numbers of eight bytes each), not a guess. The rule that a strike lands at an estimated fidelity of 0.99 is a convention of this game: the estimate multiplies one minus the weight discarded at each truncation, which is the standard bookkeeping and a good guide when the discarded weight is small, but it is an estimate, not a proof, for circuits too large to check exactly. What is proved here, and re-checked by an independent script, is that the tensor network gives the state vector&rsquo;s answer exactly when the table size is at least the largest rank the circuit can reach, and that the rank bound is attained. The boss is a stand-in of the kind of circuit a claim is made on, not that circuit, and nothing here says whether any real claim holds.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function human(n) { return n >= 1e12 ? (n / 1e12).toFixed(1) + ' trillion' : n >= 1e9 ? (n / 1e9).toFixed(1) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' million' : Math.round(n).toLocaleString('en'); }
  function bytes(b) { var u = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'], i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + ' ' + u[i]; }

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, method = 'mps', ci = 2, runs = [], busy = false;
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'arc'; root.appendChild(wrap);
    function frame() { return W.SymbiQ.games && W.SymbiQ.games.frame; }
    function ladderState(k) { var f = frame(); return f && f.ladder ? f.ladder.state(k) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = frame(); return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function mark(n, med) { try { var f = frame(); if (f && f.ladder && med) f.ladder.markCleared(KEY, n, med); } catch (x) { } }
    var G = { gold: '🥇', silver: '🥈', bronze: '🥉' };
    function resume() { var st = ladderState(KEY), r = 0; for (var i = 1; i <= LEVELS.length; i++) if (st.cleared[i]) r = Math.min(i, LEVELS.length - 1); return r; }

    function picture(L, r) {
      var caps = rankCaps(L.n, L.d, L.fam), lg = Math.log2(Math.max.apply(null, caps)) || 1, nb = caps.length, w = 204, bw = w / nb;
      var bars = r && r.bonds ? r.bonds.map(function (b, i) { var h = Math.max(1, Math.log2(b) / lg * 56); return '<rect x="' + (i * bw + 0.5).toFixed(1) + '" y="' + (62 - h).toFixed(1) + '" width="' + Math.max(1, bw - 1).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="var(--teal)"/>'; }).join('') : '';
      var cap = '<polyline fill="none" stroke="var(--violet)" stroke-dasharray="3 2" points="' + caps.map(function (c, i) { return (i * bw + bw / 2).toFixed(1) + ',' + (62 - Math.log2(c) / lg * 56).toFixed(1); }).join(' ') + '"/>';
      var label = r && r.bonds ? 'Table size at each of the ' + nb + ' cuts in the chain, against the most the circuit can need (dashed). Largest used: ' + r.maxBond + '.' : 'The most table size the circuit can need at each of the ' + nb + ' cuts in the chain (dashed). Run a tensor network to see what you used.';
      return '<svg class="ar-pic" viewBox="0 0 204 70" role="img" aria-label="' + esc(label) + '"><line x1="0" x2="204" y1="62" y2="62" stroke="var(--border)"/>' + bars + cap +
        '<text x="2" y="8" font-size="6" fill="var(--muted)">table size (log scale), dashed = the most needed</text></svg>';
    }
    function costBar(L, r) {
      var B = L.budget * MEGA, f = r ? Math.min(1, r.ops / B) : 0, over = r && r.ops > B;
      return '<svg class="ar-chart" viewBox="0 0 220 24" role="img" aria-label="' + (r ? 'Operations spent: ' + human(r.ops) + (over ? ', over the budget of ' : ' of a budget of ') + human(B) : 'Budget ' + human(B) + ' operations, none spent') + '">' +
        '<rect x="8" y="6" width="204" height="10" rx="3" fill="none" stroke="var(--border)"/><rect x="8" y="6" width="' + (204 * f).toFixed(1) + '" height="10" rx="3" fill="' + (over ? 'var(--rose, #fb7185)' : 'var(--teal)') + '"/>' +
        '<text x="8" y="23" font-size="6" fill="var(--muted)">0</text><text x="212" y="23" font-size="6" text-anchor="end" fill="var(--muted)">budget ' + human(B) + ' operations</text></svg>';
    }
    function html() {
      var L = LEVELS[lvl], st = ladderState(KEY), last = runs[runs.length - 1], caps = rankCaps(L.n, L.d, L.fam), need = Math.max.apply(null, caps);
      var chips = '<div class="ar-strip" role="list" aria-label="Levels">' + LEVELS.map(function (l, i) { var med = st.medal[i + 1], g = med ? G[med] : (unlocked(i + 1) ? (i + 1) : '🔒');
        return '<button type="button" role="listitem" class="ar-chip' + (i === lvl ? ' now' : '') + '" data-lv="' + i + '"' + (unlocked(i + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(i + 1) ? '' : ', locked') + '">' + g + ' ' + esc(l.name) + '</button>'; }).join('') + '</div>';
      var methods = '<div class="ar-methods" role="radiogroup" aria-label="Method">' +
        '<button type="button" role="radio" class="ar-m' + (method === 'sv' ? ' now' : '') + '" aria-checked="' + (method === 'sv') + '" data-m="sv"><b>State vector</b></button>' +
        '<button type="button" role="radio" class="ar-m' + (method === 'mps' ? ' now' : '') + '" aria-checked="' + (method === 'mps') + '" data-m="mps"><b>Tensor network</b></button></div>';
      var knobs = method === 'mps' ? '<div class="ar-knobs" role="radiogroup" aria-label="Table size">' + CHIS.map(function (c, i) { return '<button type="button" role="radio" class="ar-k' + (i === ci ? ' now' : '') + '" aria-checked="' + (i === ci) + '" data-k="' + i + '">size ' + c + '</button>'; }).join('') + '</div>'
        : '<p class="ar-knobs-none">No setting: it keeps every amplitude. ' + (svAllowed(L) ? 'It fits this budget.' : 'It will be refused here.') + '</p>';
      var blurb = method === 'sv' ? 'Keeps all 2<sup>n</sup> amplitudes and applies every gate exactly. Needs ' + human(Math.pow(2, L.n)) + ' numbers (' + bytes(svBytes(L.n)) + ') and about ' + human(svCost(L.n, L.d, L.fam)) + ' operations here.'
        : 'Keeps a chain of small tables and cuts the weakest correlations after every gate so none is wider than the size you pick. Exact if the size reaches ' + need + ' (the most this circuit can need); an approximation below that.';
      var table = runs.length ? '<table class="ar-runs"><caption>Your runs on this level</caption><thead><tr><th scope="col">#</th><th scope="col">Method</th><th scope="col">Answer</th><th scope="col">Est. fidelity</th><th scope="col">Operations</th><th scope="col">Result</th></tr></thead><tbody>' +
        runs.map(function (r, i) { return '<tr' + (r.lands ? ' class="best"' : '') + '><td>' + (i + 1) + '</td><td>' + (r.method === 'sv' ? 'State vector' : 'Tensor network, size ' + r.chi) + '</td><td>' + (r.ok ? r.value.toFixed(4) : 'none') + '</td><td>' + (r.ok ? r.fidelity.toFixed(4) : 'none') + '</td><td>' + human(r.ops) + '</td><td>' + (r.lands ? 'lands ' + (r.med ? G[r.med] : '') : (r.refused ? 'refused' : r.over ? 'over budget' : 'misses')) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
      return chips + '<p class="ar-brief">' + L.brief + (L.link ? ' <a href="' + L.link + '">' + L.linkText + ' &#9656;</a>' : '') + '</p>' +
        '<p class="ar-facts"><b>Circuit</b> ' + L.n + ' qubits, ' + L.d + ' layers, ' + (L.fam === 'haar' ? 'scrambling' : 'mild') + ' gates &middot; <b>Budget</b> ' + human(L.budget * MEGA) + ' operations &middot; <b>Lands at</b> estimated fidelity &ge; ' + LAND + ' &middot; <b>Exact at table size</b> ' + need + '</p>' +
        '<div class="ar-board">' + picture(L, last && last.bonds ? last : null) + costBar(L, last) + '</div>' +
        methods + '<p class="ar-blurb">' + blurb + '</p>' + knobs +
        '<div class="ar-act"><button type="button" class="preset ar-run" data-a="run"' + (busy ? ' disabled' : '') + '>Run ' + (method === 'sv' ? 'the state vector' : 'the tensor network, size ' + CHIS[ci]) + '</button> <button type="button" class="preset" data-a="clear"' + (runs.length ? '' : ' disabled') + '>Clear runs</button></div>' +
        table + '<p class="ar-say" id="cs-say" role="status" aria-live="polite">' + (busy ? 'Running...' : (last ? say(L, last) : 'Pick a method and run it. Try a small table first and watch what the estimated fidelity does.')) + '</p>';
    }
    function say(L, r) {
      if (r.refused) return '<strong>Refused.</strong> The state vector needs ' + human(Math.pow(2, L.n)) + ' numbers, ' + bytes(r.bytes) + ' of memory and about ' + human(r.ops) + ' operations; this level allows ' + human(L.budget * MEGA) + (L.n > 22 ? ' and this page will not hold that much' : '') + '. Try the tensor network.';
      if (r.over) return '<strong>Out of budget</strong> after ' + human(r.ops) + ' operations: that table size costs more than the level allows. Try a smaller one.';
      if (!r.lands) return '<strong>Misses.</strong> Estimated fidelity ' + r.fidelity.toFixed(4) + ', short of ' + LAND + ': the weight thrown away is too large to trust the answer. Try a larger table' + (r.method === 'sv' ? '' : ' (' + human(r.ops) + ' operations spent)') + '.';
      var p = par(L), msg = '<strong>Lands.</strong> Answer ' + r.value.toFixed(4) + ' at estimated fidelity ' + r.fidelity.toFixed(4) + ' for ' + human(r.ops) + ' operations. ' + (r.med ? G[r.med] + ' ' + r.med + '. ' : '');
      return msg + 'The cheapest setting that lands here costs ' + human(p.ops) + ' operations (' + (p.method === 'sv' ? 'the state vector' : 'tensor network, size ' + p.chi) + ').';
    }
    function bind() {
      wrap.querySelectorAll('[data-lv]').forEach(function (b) { b.addEventListener('click', function () { start(+b.getAttribute('data-lv')); }); });
      wrap.querySelectorAll('[data-m]').forEach(function (b) { b.addEventListener('click', function () { method = b.getAttribute('data-m'); draw('[data-m="' + method + '"]'); }); });
      wrap.querySelectorAll('[data-k]').forEach(function (b) { b.addEventListener('click', function () { ci = +b.getAttribute('data-k'); draw('[data-k="' + ci + '"]'); }); });
      var run = wrap.querySelector('[data-a=run]'), clr = wrap.querySelector('[data-a=clear]');
      if (run) run.addEventListener('click', go);
      if (clr) clr.addEventListener('click', function () { runs = []; draw(); });
    }
    function draw(focus) {
      var ae = document.activeElement, key = focus || null;
      if (!key && ae && ae.getAttribute && wrap.contains(ae)) { if (ae.hasAttribute('data-k')) key = '[data-k="' + ae.getAttribute('data-k') + '"]'; else if (ae.hasAttribute('data-m')) key = '[data-m="' + ae.getAttribute('data-m') + '"]'; }
      wrap.innerHTML = html(); bind();
      if (key) { var t = wrap.querySelector(key); if (t) t.focus(); }
    }
    function start(i) { lvl = i; runs = []; draw(); }
    function go() {
      if (busy) return; busy = true; draw();
      setTimeout(function () {
        var L = LEVELS[lvl], r = runOption(L, method, CHIS[ci]), copy = {}, k;
        for (k in r) copy[k] = r[k];
        copy.med = medalOf(L, r); runs.push(copy);
        if (copy.med) mark(lvl + 1, copy.med);
        busy = false; draw();
      }, 30);
    }
    wrap.addEventListener('keydown', function (e) {
      var g = e.target.closest && e.target.closest('[role="radiogroup"]'); if (!g || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      var items = [].slice.call(g.querySelectorAll('[role="radio"]')), i = items.indexOf(e.target); if (i < 0) return;
      e.preventDefault(); items[(i + (/Left|Up/.test(e.key) ? -1 : 1) + items.length) % items.length].click();
    });
    start(resume());
    return { state: function () { return { lvl: lvl, method: method, chi: CHIS[ci], runs: runs.length, busy: busy }; }, runs: function () { return runs.map(function (r) { return { method: r.method, chi: r.chi, lands: r.lands, med: r.med, fid: r.fidelity, ops: r.ops, over: !!r.over, refused: !!r.refused }; }); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.strikes = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
