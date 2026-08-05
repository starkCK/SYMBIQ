/* SymbiQ — THE VERDICT: five methods on one problem
 * =============================================================================
 * "Can quantum beat classical on optimisation?" is unanswerable in the
 * abstract and perfectly answerable on a named instance. This runs five real
 * methods over the same problem and reports, for each, the thing almost every
 * comparison omits: WHAT CERTIFICATE IT ENDS UP HOLDING.
 *
 * That is the whole point. A number without a certificate is a claim; a number
 * with one is a fact. Four of these five finish with a claim.
 *
 * DESIGNED TO BE REUSED. mount() takes an arbitrary {items, cap} instance, so
 * the PQC migration sequencer can mount this same engine on a real estate —
 * an asset's value is its risk reduction, its weight is its migration cost.
 * One engine, two doors, exactly as games.js already does for the games.
 *
 * The demo instances are NOT new numbers. They are The Prune's four levels,
 * whose optima (205/280/355/479) were found by exhaustive search and
 * re-verified 2026-07-30 by an exact port of expand()/sweep(). Every figure
 * this widget prints for branch and bound is recomputed live and asserted
 * against those optima — if it ever disagrees, the widget says so rather than
 * printing a number nobody checked.
 * ========================================================================== */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  /* --- the four verified instances, shared with The Prune ----------------- */
  var INSTANCES = [
    { name: 'The sampler', cap: 40, opt: 205, grover: 6,
      raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18]] },
    { name: 'The van', cap: 55, opt: 280, grover: 18,
      raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11]] },
    { name: 'The container', cap: 70, opt: 355, grover: 50,
      raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11],[84,21],[38,8],[66,14]] },
    { name: 'The freighter', cap: 95, opt: 479, grover: 201,
      raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11],[84,21],
            [38,8],[66,14],[72,16],[48,10],[93,22],[57,12]] }
  ];

  /* --- method 1: greedy by value per kilogram ----------------------------- */
  function greedy(items, cap) {
    var ord = items.map(function (it, i) { return { i: i, v: it[0], w: it[1], r: it[0] / it[1] }; })
                   .sort(function (a, b) { return b.r - a.r; });
    var w = 0, v = 0, steps = 0;
    for (var k = 0; k < ord.length; k++) {
      steps++;
      if (w + ord[k].w <= cap) { w += ord[k].w; v += ord[k].v; }
    }
    return { value: v, effort: steps, unit: 'items examined' };
  }

  /* --- method 2: the LP relaxation (Dantzig bound) ------------------------
   * Allow a FRACTION of the last item. Provably an upper bound on any integer
   * packing — which is exactly what makes branch and bound's cuts safe rather
   * than merely plausible. Its own answer is fractional, so you cannot load it. */
  function dantzig(items, cap) {
    var ord = items.map(function (it) { return { v: it[0], w: it[1], r: it[0] / it[1] }; })
                   .sort(function (a, b) { return b.r - a.r; });
    var w = 0, v = 0, frac = false;
    for (var k = 0; k < ord.length; k++) {
      if (w + ord[k].w <= cap) { w += ord[k].w; v += ord[k].v; }
      else { v += ord[k].r * (cap - w); w = cap; frac = true; break; }
    }
    return { value: v, effort: ord.length, unit: 'items examined', fractional: frac };
  }

  /* --- method 3: exact branch and bound, best-bound first ------------------
   * Counts expansions, and counts how many of the 2^n assignments each cut
   * kills. When killed + reached == 2^n the search PARTITIONS the space, and
   * that identity is the certificate — not a claim about the answer, a proof
   * that nothing was skipped. */
  function branchAndBound(items, cap) {
    var ord = items.map(function (it) { return { v: it[0], w: it[1], r: it[0] / it[1] }; })
                   .sort(function (a, b) { return b.r - a.r; });
    var n = ord.length, total = Math.pow(2, n), best = 0, nodes = 0, killed = 0;

    function bound(idx, w, v) {
      var bw = w, bv = v;
      for (var k = idx; k < n; k++) {
        if (bw + ord[k].w <= cap) { bw += ord[k].w; bv += ord[k].v; }
        else { return bv + ord[k].r * (cap - bw); }
      }
      return bv;
    }
    // best-bound frontier
    var open = [{ idx: 0, w: 0, v: 0, b: bound(0, 0, 0) }];
    while (open.length) {
      open.sort(function (a, b) { return b.b - a.b; });
      var node = open.shift();
      if (node.b <= best) { killed += Math.pow(2, n - node.idx); continue; }
      if (node.idx === n) { if (node.v > best) best = node.v; killed += 1; continue; }
      nodes++;
      var it = ord[node.idx];
      // take it, if it fits
      if (node.w + it.w <= cap) {
        var tv = node.v + it.v, tw = node.w + it.w;
        if (tv > best) best = tv;
        open.push({ idx: node.idx + 1, w: tw, v: tv, b: bound(node.idx + 1, tw, tv) });
      } else {
        killed += Math.pow(2, n - node.idx - 1);   // whole subtree infeasible
      }
      // leave it
      open.push({ idx: node.idx + 1, w: node.w, v: node.v, b: bound(node.idx + 1, node.w, node.v) });
    }
    return { value: best, effort: nodes, unit: 'nodes opened', killed: killed, total: total,
             partitions: killed === total };
  }

  /* --- method 4: simulated annealing --------------------------------------
   * The honest one to watch. It usually finds the optimum. It never knows that
   * it did, and on the runs where it does not, it also stops and reports. */
  function anneal(items, cap, runs) {
    var n = items.length, bestOverall = 0, hits = 0, worst = Infinity, steps = 300;
    function val(mask) {
      var v = 0, w = 0;
      for (var i = 0; i < n; i++) if (mask[i]) { v += items[i][0]; w += items[i][1]; }
      return w <= cap ? v : -1;
    }
    for (var r = 0; r < runs; r++) {
      var cur = new Array(n).fill(0), cv = 0, T = 60;
      for (var s = 0; s < steps; s++) {
        var i = (Math.random() * n) | 0;
        cur[i] ^= 1;
        var nv = val(cur);
        if (nv >= 0 && (nv > cv || Math.random() < Math.exp((nv - cv) / T))) cv = nv;
        else cur[i] ^= 1;
        T *= 0.985;
      }
      if (cv > bestOverall) bestOverall = cv;
      if (cv < worst) worst = cv;
    }
    return { value: bestOverall, worst: worst, effort: runs * steps, unit: 'moves' };
  }

  /* --- method 5: Grover, as a resource estimate rather than a result -------
   * ROUND, not ceil. (pi/4)*sqrt(2^n) is 6.28 / 17.77 / 50.27 / 201.06 on the
   * four instances. The Prune already ships 6 / 18 / 50 / 201 and those figures
   * are referee-verified, so ceil() here would have put two widgets on the same
   * site one apart on the same quantity. Caught by checking against the shipped
   * numbers instead of trusting a fresh implementation. */
  function grover(n) {
    var exact = (Math.PI / 4) * Math.sqrt(Math.pow(2, n));
    return { queries: Math.round(exact), exact: exact, n: n };
  }

  /* ---------------------------------------------------------------- run --- */
  function run(inst, saRuns) {
    var items = inst.raw, cap = inst.cap, n = items.length;
    var g = greedy(items, cap), lp = dantzig(items, cap), bb = branchAndBound(items, cap);
    // count how often annealing actually lands on the proven optimum
    var hits = 0, R = saRuns || 200;
    for (var r = 0; r < R; r++) { if (anneal(items, cap, 1).value === bb.value) hits++; }
    var sa = anneal(items, cap, R);
    return { inst: inst, n: n, greedy: g, lp: lp, bb: bb, sa: sa, saHitRate: hits / R,
             grover: grover(n),
             /* the widget refuses to print an unchecked number */
             agrees: inst.opt == null || bb.value === inst.opt };
  }

  SymbiQ.methods = { INSTANCES: INSTANCES, run: run, branchAndBound: branchAndBound,
                     greedy: greedy, dantzig: dantzig, anneal: anneal, grover: grover };

  /* ============================== the table ==============================
   * One row per method. The last column is the one that matters and the one
   * every marketing comparison leaves out. */
  var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
  var num = function (x) { return x.toLocaleString('en-GB'); };

  function tableRow(m) {
    return '<tr class="vm-' + m.kind + '">' +
      '<th scope="row">' + esc(m.name) + '<em>' + esc(m.note) + '</em></th>' +
      '<td class="vm-ans">' + m.answer + '</td>' +
      '<td class="vm-eff">' + m.effort + '</td>' +
      '<td class="vm-cert"><span class="vm-badge ' + (m.proof ? 'yes' : 'no') + '">' +
        (m.proof ? 'certificate' : 'no certificate') + '</span>' + m.cert + '</td></tr>';
  }

  SymbiQ.methods.mount = function (root, opts) {
    opts = opts || {};
    var idx = opts.level || 2;

    function render() {
      var inst = INSTANCES[idx];
      var r = run(inst, 120);

      if (!r.agrees) {                       // never print an unchecked number
        root.innerHTML = '<div class="verdict bad">This solver disagreed with the ' +
          'independently verified optimum for ' + esc(inst.name) + '. Refusing to show ' +
          'figures until that is resolved.</div>';
        return;
      }

      var gap = r.bb.value - r.greedy.value;
      var rows = [
        { kind: 'cl', name: 'Greedy', note: 'best value per kilogram, take it if it fits',
          answer: num(r.greedy.value),
          effort: num(r.greedy.effort) + ' items looked at',
          proof: false,
          cert: gap
            ? 'None. It is instant, and it cannot tell you it fell <b>' + num(gap) +
              '</b> short — you only know that because the exact method below proved it.'
            : 'None. It happens to be optimal here, and it has no way of knowing that.' },
        { kind: 'cl', name: 'LP relaxation', note: 'the Dantzig bound — allow a fraction of one crate',
          answer: r.lp.value.toFixed(2) + (r.lp.fractional ? ' <em>fractional</em>' : ''),
          effort: num(r.lp.effort) + ' items looked at',
          proof: true,
          cert: 'An <b>upper bound</b>: proves nothing can beat ' + r.lp.value.toFixed(2) +
                '. But its own answer splits a crate, so you cannot load it.' },
        { kind: 'ex', name: 'Branch & bound', note: 'exact — the machinery every commercial solver runs',
          answer: '<b>' + num(r.bb.value) + '</b> <span class="vm-opt">optimal</span>',
          effort: num(r.bb.effort) + ' nodes opened',
          proof: true,
          cert: '<b>Optimal, proven.</b> Every one of the ' + num(r.bb.total) +
                ' combinations is accounted for — taken, or killed by a bound. ' +
                'killed + reached = ' + num(r.bb.killed) + ' = 2<sup>' + r.n + '</sup>.' },
        { kind: 'he', name: 'Simulated annealing', note: 'the metaheuristic quantum annealing imitates',
          answer: num(r.sa.value),
          effort: num(r.sa.effort) + ' moves, 120 restarts',
          proof: false,
          cert: 'None — and this is the sharp one. It landed on the optimum in <b>' +
                Math.round(r.saHitRate * 100) + '%</b> of runs. In the other ' +
                Math.round((1 - r.saHitRate) * 100) + '% it also stopped, and also reported an answer.' },
        { kind: 'q', name: 'Grover', note: 'quantum, ⟦Proven⟧ quadratic — a resource estimate, not a result',
          answer: '<span class="vm-na">no answer to show</span>',
          effort: '~' + num(r.grover.queries) + ' oracle queries',
          proof: false,
          cert: 'None. Returns a <em>likely</em> answer, and needs a fault-tolerant machine ' +
                'that does not exist at this size. It never looks at the structure.' }
      ];

      var beats = r.grover.queries < r.bb.effort;
      var verdict = beats
        ? '<div class="verdict split"><b>Watch.</b> On an instance this small Grover&rsquo;s query count is ' +
          'below the number of nodes branch and bound opens. That is real — and it is also the ' +
          'last size at which it is true.</div>'
        : '<div class="verdict good"><b>Never</b> — for this problem, at this size. Branch and bound ' +
          'finished in ' + num(r.bb.effort) + ' nodes <em>holding a proof</em>; Grover would need ~' +
          num(r.grover.queries) + ' queries on hardware that does not exist, and finish holding a guess.</div>';

      root.innerHTML =
        '<div class="vm-pick">' + INSTANCES.map(function (I, i) {
          return '<button type="button" class="preset' + (i === idx ? ' on' : '') + '" data-i="' + i + '">' +
                 esc(I.name) + '<em>' + I.raw.length + ' crates · ' + num(Math.pow(2, I.raw.length)) +
                 ' ways</em></button>'; }).join('') + '</div>' +
        verdict +
        '<div class="vm-scroll"><table class="vm"><thead><tr><th>Method</th><th>Best it found</th>' +
        '<th>Effort</th><th>What it can prove</th></tr></thead><tbody>' +
        rows.map(tableRow).join('') + '</tbody></table></div>' +
        '<p class="vm-note"><b>The units are not comparable</b> — an oracle query and a bound ' +
        'computation are different work — so the scoreboard is not the point. The shape is. ' +
        'Grover&rsquo;s speedup is quadratic but still exponential, and identical on a knapsack or ' +
        'on pure noise, because it never reads the structure. The bound is <em>made</em> of that ' +
        'structure, so it barely grows. <b>Node counts depend on how ties between equal bounds ' +
        'fall</b>: this solver opens ' + num(r.bb.effort) + ' on ' + esc(inst.name) +
        ', while <a href="#prune">The Prune</a> — playable below, same instance — reports 14 / 27 / ' +
        '35&ndash;38 / 36 for the four. Both are honest; neither is <em>the</em> number.</p>';
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      idx = +b.dataset.i;
      render();
    });
    render();
  };
})();
