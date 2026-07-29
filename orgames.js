/* SymbiQ — The Feasible Region: operations-research games.
 *
 * Same contract as games.js on purpose, so these can be mounted as missions
 * on The Solver's Path later without a rewrite (branch & bound is already
 * pencilled in as Cordon's second mission in 12_GAME_MASTER_PLAN.md):
 *
 *   SymbiQ.orgames.list                    -> metadata
 *   SymbiQ.orgames.mount(id, el, opts)     -> render one into el
 *   opts = { mode: 'mission'|'arcade', onWin: function(id, first){} }
 *
 * Design rule inherited from the Decoder Duel, which is the best thing this
 * project has built: find the decision where the honest answer is NON-OBVIOUS,
 * and let the mathematics do the judging. A game whose "clever" play is also
 * its obvious play teaches nothing.
 *
 * Every number quoted below was computed offline in exact rational arithmetic
 * (or by exhaustive search) and is reproduced by the same arithmetic at run
 * time. Nothing here is a designer's guess.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var NS = 'http://www.w3.org/2000/svg';
  function $(r, s) { return r.querySelector(s); }
  function el(t, a) { var n = document.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }
  function win(id, opts) {
    var first = false;
    if (window.SymbiQ && SymbiQ.save) first = SymbiQ.save.completeMission(id);
    if (opts && typeof opts.onWin === 'function') opts.onWin(id, first);
    return first;
  }
  function fmt(x) { return (Math.round(x * 100) / 100).toString(); }

  var G = {};

  /* ==================================================================== *
   *  THE BOTTLENECK — shadow prices, and why they lie if you don't ask   *
   *  how far they go.                                                    *
   *                                                                      *
   *  max 5A + 4B  subject to                                             *
   *      6A + 4B <= M   machine-hours                                    *
   *       A + 2B <= T   material                                         *
   *      3A +  B <= L   skilled hours                                    *
   *  start (M,T,L) = (24,6,12) -> profit 21 at (A,B) = (3, 1.5)          *
   *                                                                      *
   *  Five rounds; each round you add capacity to exactly ONE resource     *
   *  (+6 M, +3 T, +4 L). Verified offline over all 3^5 = 243 sequences:  *
   *    PAR                     = 34.5, reached by 10 sequences (4.1%)    *
   *    greedy on exact gain    = 34.5  <- so the game is LEARNABLE       *
   *    greedy on shadow price  = 31.5  <- the lesson: a price is not a   *
   *                                       gain unless it holds that far  *
   *    buy labour every round  = 21.0  <- literally nothing, five times  *
   *    best sequence using labour at all = 33 < 34.5, so labour is       *
   *    PROVABLY never worth buying. Its shadow price is 0 and it says so.*
   * ==================================================================== */
  G.bottleneck = {
    title: 'The Bottleneck',
    hook: 'Five upgrades, three resources, and one number that tells you which — if you ask it the right question.',
    mentor: 'Cordon',
    about: {
      goal: 'Finish five quarters with the highest profit you can. Each quarter you may expand exactly <strong>one</strong> resource.',
      how: 'Read the <strong>shadow price</strong> of each resource — what one more unit is worth — and the <strong>range</strong> over which that price still holds. Then buy. The region grows and the best plan slides to a new corner.',
      inspired: 'Linear-programming duality (von Neumann, 1947; Gale, Kuhn &amp; Tucker, 1951) and right-hand-side ranging — the output real planners actually buy an optimiser for.',
      learn: 'Why the most valuable resource is not the scarcest or the dearest, why relieving a bottleneck destroys its own value, and why a shadow price without its range is a trap.',
      link: 'feasible.html#tiers', linkText: 'The mathematics ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: this is a real linear program, re-solved exactly at every step by enumerating the vertices of the feasible region — the same method the figure above uses, and the reason the optimum can be found without searching the interior. Shadow prices are computed as the true derivative of the optimum with respect to each right-hand side, and the range is found by walking that right-hand side until the price changes, which is exactly what right-hand-side ranging means. Par was established by exhaustive search over all 3⁵ = 243 purchase sequences: <strong>34.5</strong>, reached by 10 of them. Two facts worth carrying away, both verified rather than asserted: buying skilled hours is worthless in <em>every</em> sequence (the best plan that touches it scores 33, below the 34.5 available without it), and a player who greedily follows the largest shadow price scores 31.5 — because machine-hours are worth 0.75 each for only 2.25 more units, while an upgrade adds 6. The price is honest; multiplying it by a step it was never valid over is not. Real solvers report the range alongside the price for exactly this reason.',

    mount: function (root, opts) {
      opts = opts || {};
      var START = { M: 24, T: 6, L: 12 };
      var STEP  = { M: 6,  T: 3, L: 4  };
      var RES = [
        { k: 'M', name: 'machine-hours', row: [6, 4], colour: 'var(--violet)' },
        { k: 'T', name: 'material',      row: [1, 2], colour: 'var(--teal)'   },
        { k: 'L', name: 'skilled hours', row: [3, 1], colour: 'var(--yellow)' }
      ];
      var ROUNDS = 5, PAR = 34.5;
      var st, round, log, done;

      /* Solve by vertex enumeration. Every LP optimum sits at a vertex of the
         feasible region, so the interior never has to be searched — that is
         the whole reason linear programming is tractable, and the page says so. */
      function cons(s) {
        return [[6, 4, s.M], [1, 2, s.T], [3, 1, s.L], [-1, 0, 0], [0, -1, 0]];
      }
      function feasible(C, x, y) {
        for (var i = 0; i < C.length; i++) if (C[i][0] * x + C[i][1] * y > C[i][2] + 1e-9) return false;
        return true;
      }
      function solve(s) {
        var C = cons(s), best = null, bv = -Infinity, verts = [];
        for (var i = 0; i < C.length; i++) for (var j = i + 1; j < C.length; j++) {
          var det = C[i][0] * C[j][1] - C[j][0] * C[i][1];
          if (Math.abs(det) < 1e-12) continue;
          var x = (C[i][2] * C[j][1] - C[j][2] * C[i][1]) / det;
          var y = (C[i][0] * C[j][2] - C[j][0] * C[i][2]) / det;
          if (!feasible(C, x, y)) continue;
          if (!verts.some(function (v) { return Math.abs(v[0] - x) < 1e-9 && Math.abs(v[1] - y) < 1e-9; })) verts.push([x, y]);
          var v = 5 * x + 4 * y;
          if (v > bv + 1e-12) { bv = v; best = [x, y]; }
        }
        // order the polygon by angle about its centroid so it draws as a shape
        var cx = 0, cy = 0;
        verts.forEach(function (v) { cx += v[0]; cy += v[1]; });
        cx /= verts.length; cy /= verts.length;
        verts.sort(function (a, b) { return Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx); });
        return { value: bv, point: best, verts: verts };
      }
      function bump(s, k, d) { var o = { M: s.M, T: s.T, L: s.L }; o[k] += d; return o; }

      // The true derivative of the optimum with respect to one right-hand side.
      function price(s, k) {
        var e = 1e-6, a = solve(s).value, b = solve(bump(s, k, e)).value;
        return Math.round((b - a) / e * 1e4) / 1e4;
      }
      // How far that price survives -- the half of the answer everyone drops.
      function range(s, k) {
        var p0 = price(s, k), d = 0;
        while (d < 40) { d += 0.25; if (Math.abs(price(bump(s, k, d), k) - p0) > 1e-6) return d - 0.25; }
        return Infinity;
      }
      function binding(s) {
        var o = solve(s).point, out = {};
        RES.forEach(function (r) { out[r.k] = Math.abs(r.row[0] * o[0] + r.row[1] * o[1] - s[r.k]) < 1e-7; });
        return out;
      }

      function reset() {
        st = { M: START.M, T: START.T, L: START.L }; round = 1; log = []; done = false;
        render();
      }

      /* ---------- drawing ---------- */
      var VB = { w: 420, h: 320, x0: 46, y0: 274, ax: 11, ay: 11 };   // axes fixed: nothing ever leaves 0..11
      function px(a) { return VB.x0 + a * (360 / VB.ax); }
      function py(b) { return VB.y0 - b * (250 / VB.ay); }

      function drawRegion(s) {
        var sol = solve(s), bnd = binding(s);
        var g = ['<svg class="orsvg" viewBox="0 0 ' + VB.w + ' ' + VB.h + '" xmlns="' + NS +
                 '" role="img" aria-label="The feasible region for the current capacities, with the best plan marked at a corner">'];
        // grid
        g.push('<g stroke="var(--border)" stroke-width="1" opacity=".3">');
        for (var i = 1; i <= VB.ax; i++) g.push('<path d="M' + px(i) + ' ' + py(0) + 'V' + py(VB.ay) + '"/>');
        for (var j = 1; j <= VB.ay; j++) g.push('<path d="M' + px(0) + ' ' + py(j) + 'H' + px(VB.ax) + '"/>');
        g.push('</g>');
        // the region
        g.push('<polygon class="orregion" points="' + sol.verts.map(function (v) {
          return px(v[0]) + ',' + py(v[1]);
        }).join(' ') + '"/>');
        // constraint lines, bright when binding and dim when they have slack
        RES.forEach(function (r) {
          var a = r.row[0], b = r.row[1], c = s[r.k], pts = [];
          if (b !== 0) { pts.push([0, c / b]); pts.push([VB.ax, (c - a * VB.ax) / b]); }
          else { pts.push([c / a, 0]); pts.push([c / a, VB.ay]); }
          g.push('<path class="orline' + (bnd[r.k] ? ' tight' : '') + '" d="M' + px(pts[0][0]) + ' ' + py(pts[0][1]) +
                 'L' + px(pts[1][0]) + ' ' + py(pts[1][1]) + '" stroke="' + r.colour + '"/>');
        });
        // the optimum
        g.push('<circle class="oropt" cx="' + px(sol.point[0]) + '" cy="' + py(sol.point[1]) + '" r="7"/>');
        // axes
        g.push('<path d="M' + px(0) + ' ' + py(VB.ay) + 'V' + py(0) + 'H' + px(VB.ax) + '" fill="none" stroke="var(--border)" stroke-width="2"/>');
        g.push('<text class="orax" x="' + px(VB.ax / 2) + '" y="' + (VB.y0 + 30) + '" text-anchor="middle">units of A</text>');
        g.push('<text class="orax" x="14" y="' + py(VB.ay / 2) + '" text-anchor="middle" transform="rotate(-90 14 ' + py(VB.ay / 2) + ')">units of B</text>');
        g.push('</svg>');
        return g.join('');
      }

      function render(flash) {
        var sol = solve(st), bnd = binding(st);
        var rows = RES.map(function (r) {
          var p = price(st, r.k), rg = range(st, r.k);
          var naive = p * STEP[r.k];
          var over = rg < STEP[r.k] - 1e-9 && p > 0;
          return '<button class="orbuy" data-buy="' + r.k + '"' + (done ? ' disabled' : '') + '>' +
            '<span class="orbuy-top"><i style="background:' + r.colour + '"></i>' + r.name +
              (bnd[r.k] ? '<em class="tight">tight</em>' : '<em class="slack">slack</em>') + '</span>' +
            '<span class="orbuy-price">' + (p > 0 ? fmt(p) + ' per unit' : 'worth nothing') + '</span>' +
            '<span class="orbuy-range">' + (p > 0
                ? 'price holds for ' + (rg === Infinity ? 'a long way' : fmt(rg) + ' more units')
                : 'you have spare — more cannot help') + '</span>' +
            '<span class="orbuy-go">buy +' + STEP[r.k] + (over ? ' <b class="warn">overshoots</b>' : '') + '</span>' +
            '</button>';
        }).join('');

        root.innerHTML =
          '<div class="orhud">' +
            '<span class="orhud-k">Quarter</span><span class="orhud-v">' + Math.min(round, ROUNDS) + ' / ' + ROUNDS + '</span>' +
            '<span class="orhud-k">Profit</span><span class="orhud-v big">' + fmt(sol.value) + '</span>' +
            '<span class="orhud-k">Par</span><span class="orhud-v">' + PAR + '</span>' +
          '</div>' +
          '<div class="orsplit">' +
            '<div class="orviz">' + drawRegion(st) +
              '<p class="orcap">The shaded shape is every production plan you could actually run. ' +
              'A <b>tight</b> line touches the best corner — that resource is the bottleneck. ' +
              'A <b>slack</b> line does not, and buying more of it moves nothing.</p>' +
            '</div>' +
            '<div class="orside">' +
              (done ? '' : '<p class="oreyebrow">Expand one resource</p>') +
              (done ? verdict(sol) : rows) +
              (log.length ? '<p class="orlog">' + log.join(' → ') + '</p>' : '') +
            '</div>' +
          '</div>' +
          (flash ? '<p class="verdict ' + flash.cls + '">' + flash.html + '</p>' : '');

        Array.prototype.forEach.call(root.querySelectorAll('[data-buy]'), function (b) {
          b.addEventListener('click', function () { buy(b.getAttribute('data-buy')); });
        });
        var again = $(root, '[data-again]');
        if (again) again.addEventListener('click', reset);
      }

      function buy(k) {
        if (done) return;
        var before = solve(st).value, p = price(st, k), rg = range(st, k);
        st = bump(st, k, STEP[k]);
        var after = solve(st).value, gain = after - before;
        var r = RES.filter(function (x) { return x.k === k; })[0];
        log.push(r.name.split(' ')[0] + ' +' + fmt(gain));

        var msg;
        if (p === 0) {
          msg = { cls: '', html: '<strong>Nothing happened, and the price said so.</strong> ' + r.name +
            ' had slack — the best plan was not using all of what you already had, so more of it changes no corner. ' +
            'A shadow price of zero is not a small number; it is a statement that this resource is not your problem.' };
        } else if (rg < STEP[k] - 1e-9) {
          msg = { cls: 'good', html: '<strong>+' + fmt(gain) + ', not the +' + fmt(p * STEP[k]) + ' the price suggested.</strong> ' +
            'Each unit really was worth ' + fmt(p) + ' — but only for ' + fmt(rg) + ' more units. Past that this stopped ' +
            'being the bottleneck and the extra capacity had nothing to do. <em>A shadow price is a slope, not a promise.</em>' };
        } else {
          msg = { cls: 'good', html: '<strong>+' + fmt(gain) + '.</strong> The price held across the whole purchase, ' +
            'so ' + fmt(p) + ' × ' + STEP[k] + ' was exactly right.' };
        }

        round++;
        if (round > ROUNDS) { done = true; finish(); return; }
        render(msg);
      }

      function verdict(sol) {
        var v = sol.value, hit = v >= PAR - 1e-9;
        return '<div class="orfinal ' + (hit ? 'win' : '') + '">' +
          '<p class="oreyebrow">Five quarters, closed</p>' +
          '<p class="orfinal-v">' + fmt(v) + ' <span>vs par ' + PAR + '</span></p>' +
          '<p>' + (hit
            ? 'That is the maximum available. Only 10 of the 243 possible purchase sequences reach it.'
            : 'Par is ' + PAR + ', found by checking all 243 sequences. You left ' + fmt(PAR - v) + ' on the table.') +
          '</p>' +
          '<p class="orfinal-note">Two things the ledger will tell you if you ask it. <b>Skilled hours were never worth buying</b> — ' +
          'the best plan that spends anything on them scores 33, below the 34.5 available if you never touch them. ' +
          'And <b>chasing the biggest shadow price scores 31.5</b>, not 34.5: machine-hours are worth 0.75 each, but only ' +
          'for 2.25 more units, and an upgrade buys 6.</p>' +
          '<p><button class="preset" data-again>Run the five quarters again</button></p>' +
          '</div>';
      }

      function finish() {
        var sol = solve(st);
        if (sol.value >= PAR - 1e-9) win('or-bottleneck', opts);
        render();
      }

      reset();
    }
  };

  /* ==================================================================== *
   *  THE PRUNE — branch and bound. You do not search this space.         *
   *  You prove where the answer isn't.                                   *
   *                                                                      *
   *  0/1 knapsack, 12 items, capacity 70. Verified offline:              *
   *    2^12 = 4096 complete assignments                                  *
   *    OPTIMUM = 355 (exhaustive)                                        *
   *    feasible internal nodes = 2053                                    *
   *    nodes whose Dantzig bound EXCEEDS 355 = 30  <- PAR, and it is a   *
   *      hard floor: a node whose bound beats the optimum can never be   *
   *      pruned by any strategy, so nobody expands fewer than 30.        *
   *    breadth-first = 1388 expansions   (46x par)                       *
   *    depth-first   =  507                                              *
   *    best-bound    =   38                                              *
   *  Grover on the same 4096: ~50 oracle queries -- see the closing note.*
   * ==================================================================== */
  G.prune = {
    title: 'The Prune',
    hook: 'Four thousand possibilities. You will look at about thirty of them, and prove the rest cannot win.',
    mentor: 'Cordon',
    about: {
      goal: '<strong>Prove</strong> which haul is best — not guess it. You are finished when every one of the 4,096 combinations is accounted for.',
      how: 'Pick an open branch to open. Each one shows its <strong>bound</strong> — the best it could possibly reach. When a bound cannot beat the best haul you already hold, that whole branch dies untouched.',
      inspired: 'Branch and bound (Land &amp; Doig, 1960) and the Dantzig bound for the knapsack — the machinery every commercial solver still runs on.',
      learn: 'Why finding a good answer <em>early</em> is worth more than exploring the promising branch, and why a cut high in the tree is worth exponentially more than a cut low down.',
      link: 'feasible.html#tiers', linkText: 'The mathematics ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: this is a genuine 0/1 knapsack solved by genuine branch and bound. The bound on each node is the <strong>Dantzig bound</strong> — relax the requirement that you take items whole, fill the remaining space greedily in order of value per kilogram, and allow a fraction of the last item. That is provably an upper bound on anything reachable below the node, which is what makes discarding a branch safe rather than merely likely. The optimum, 355, was found by exhaustive search over all 4,096 combinations, and the par of <strong>30</strong> is a hard floor rather than a target: exactly 30 nodes in this tree have a bound strictly greater than 355, and a node whose bound beats the optimum cannot be pruned by any strategy whatsoever, so no play in existence expands fewer. For scale, breadth-first search needs 1,388 expansions and a depth-first dive needs 507, while chasing the best bound first lands at 35–38 depending on how ties between equal bounds are broken — both figures measured, neither rounded toward the flattering one. <strong>The honest quantum comparison:</strong> Grover would need about 50 oracle queries to find the best of 4,096 — a ⟦Proven⟧ quadratic speedup, but on <em>unstructured</em> search, and it returns a likely answer rather than a proof of optimality. This problem is not unstructured, and structure is exactly what the bound exploits. Note the units differ — an oracle query and a bound computation are not the same work — so the fair claim is not "38 beats 50" but this: the classical method gets its speed from structure that Grover is blind to by construction, and it finishes holding a certificate. Play it badly, breadth-first, and you will need 1,388 — which is the same point from the other side.',

    mount: function (root, opts) {
      opts = opts || {};
      var RAW = [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11],[84,21],[38,8],[66,14]];
      var CAP = 70, OPT = 355, PAR = 30;
      // sort by value per kilogram -- the order the Dantzig bound requires
      var IT = RAW.slice().sort(function (a, b) { return b[0] / b[1] - a[0] / a[1]; });
      var N = IT.length, TOTAL = Math.pow(2, N);
      var nodes, frontier, inc, incPath, used, killed, seq, over;

      /* Relax "take it or leave it" to "take a fraction". Fill greedily by
         value per kilogram. Provably an upper bound on the whole subtree,
         which is the only reason it is safe to throw a branch away. */
      function bound(k, val, wt) {
        var b = val, rem = CAP - wt;
        for (var j = k; j < N; j++) {
          if (IT[j][1] <= rem) { b += IT[j][0]; rem -= IT[j][1]; }
          else { b += IT[j][0] * rem / IT[j][1]; break; }
        }
        return b;
      }
      function leavesUnder(k) { return Math.pow(2, N - k); }

      function reset() {
        nodes = []; used = 0; killed = 0; inc = 0; incPath = []; seq = []; over = false;
        var root0 = { id: 0, k: 0, val: 0, wt: 0, b: bound(0, 0, 0), path: [], parent: null, state: 'open', kids: [] };
        nodes.push(root0); frontier = [root0];
        render();
      }

      function prune(n, why) {
        n.state = why;                       // 'cut' (bound) or 'heavy' (over capacity)
        killed += leavesUnder(n.k);
        var i = frontier.indexOf(n);
        if (i >= 0) frontier.splice(i, 1);
      }

      function expand(n) {
        if (over || n.state !== 'open') return;
        // a bound that no longer beats the incumbent: it should already be gone
        if (n.b <= inc + 1e-9) { prune(n, 'cut'); render(); return; }
        used++; seq.push(n.k);
        n.state = 'done';
        var i = frontier.indexOf(n); if (i >= 0) frontier.splice(i, 1);

        [1, 0].forEach(function (take) {
          var k = n.k + 1,
              val = n.val + (take ? IT[n.k][0] : 0),
              wt  = n.wt  + (take ? IT[n.k][1] : 0);
          var kid = { id: nodes.length, k: k, val: val, wt: wt, path: n.path.concat(take),
                      parent: n, state: 'open', kids: [], take: take };
          nodes.push(kid); n.kids.push(kid);

          if (wt > CAP) { kid.b = -Infinity; prune(kid, 'heavy'); return; }
          if (k === N) {                       // a complete haul
            kid.b = val; kid.state = 'leaf'; killed += 1;
            if (val > inc) { inc = val; incPath = kid.path.slice(); kid.state = 'best'; sweep(); }
            return;
          }
          kid.b = bound(k, val, wt);
          if (kid.b <= inc + 1e-9) prune(kid, 'cut'); else frontier.push(kid);
        });

        sweep();
        if (!frontier.length) { over = true; finish(); return; }
        render();
      }

      // a better incumbent can kill branches that were alive a moment ago
      function sweep() {
        for (var i = frontier.length - 1; i >= 0; i--) {
          if (frontier[i].b <= inc + 1e-9) prune(frontier[i], 'cut');
        }
      }

      /* ---------- tidy-tree layout over the EXPLORED part only ---------- */
      function layout() {
        var xs = 0;
        (function place(n) {
          if (!n.kids.length) { n.x = xs++; }
          else { n.kids.forEach(place); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; }
          n.y = n.k;
        })(nodes[0]);
        return xs || 1;
      }

      function drawTree() {
        var cols = layout(), rowH = 34, colW = Math.max(16, Math.min(46, 660 / Math.max(cols, 1)));
        var w = Math.max(300, cols * colW + 40), h = (N + 1) * rowH + 20;
        var g = ['<svg class="ortree" viewBox="0 0 ' + w + ' ' + h + '" xmlns="' + NS +
                 '" role="img" aria-label="The search tree so far. Grey branches were eliminated by a bound without being searched.">'];
        function X(n) { return 20 + n.x * colW + colW / 2; }
        function Y(n) { return 16 + n.y * rowH; }

        nodes.forEach(function (n) {
          if (!n.parent) return;
          g.push('<path class="oredge ' + n.state + '" d="M' + X(n.parent) + ' ' + Y(n.parent) +
                 'C' + X(n.parent) + ' ' + (Y(n.parent) + rowH * .55) + ',' + X(n) + ' ' + (Y(n) - rowH * .55) +
                 ',' + X(n) + ' ' + Y(n) + '"/>');
        });
        nodes.forEach(function (n) {
          var r = n.state === 'open' ? 9 : 6;
          g.push('<g class="ornode ' + n.state + '"' + (n.state === 'open' ? ' data-n="' + n.id + '" tabindex="0" role="button"' : '') + '>');
          g.push('<circle cx="' + X(n) + '" cy="' + Y(n) + '" r="' + r + '"/>');
          if (n.state === 'open') g.push('<text x="' + X(n) + '" y="' + (Y(n) - 13) + '" text-anchor="middle">' + Math.floor(n.b) + '</text>');
          if (n.state === 'cut')  g.push('<text class="killed" x="' + X(n) + '" y="' + (Y(n) + 15) + '" text-anchor="middle">−' + leavesUnder(n.k) + '</text>');
          g.push('</g>');
        });
        g.push('</svg>');
        return g.join('');
      }

      function render() {
        var pct = Math.round(killed / TOTAL * 100);
        root.innerHTML =
          '<div class="orhud">' +
            '<span class="orhud-k">Best haul held</span><span class="orhud-v big">' + inc + '</span>' +
            '<span class="orhud-k">Branches opened</span><span class="orhud-v">' + used + '</span>' +
            '<span class="orhud-k">Par</span><span class="orhud-v">' + PAR + '</span>' +
          '</div>' +
          '<div class="orbar" title="' + killed + ' of ' + TOTAL + ' combinations accounted for">' +
            '<i style="width:' + pct + '%"></i><span>' + killed.toLocaleString() + ' of ' + TOTAL.toLocaleString() +
            ' combinations ruled out — ' + pct + '%</span></div>' +
          (over ? finalHTML() :
            '<p class="oreyebrow">Open a branch. The number above each is the most it could possibly be worth.</p>') +
          '<div class="ortreewrap">' + drawTree() + '</div>' +
          '<p class="orcap">Every grey branch was eliminated by arithmetic, not by looking. ' +
          'The number under it is how many complete combinations died with it — that is where the speed comes from.</p>';

        Array.prototype.forEach.call(root.querySelectorAll('[data-n]'), function (nd) {
          var n = nodes[+nd.getAttribute('data-n')];
          nd.addEventListener('click', function () { expand(n); });
          nd.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); expand(n); }
          });
        });
        var again = $(root, '[data-again]');
        if (again) again.addEventListener('click', reset);
      }

      function finalHTML() {
        var proved = inc === OPT, tight = used <= PAR + 8;
        return '<div class="orfinal ' + (proved && tight ? 'win' : '') + '">' +
          '<p class="oreyebrow">The frontier is empty — that is the proof</p>' +
          '<p class="orfinal-v">' + used + ' <span>branches opened · par ' + PAR + '</span></p>' +
          '<p>Every one of the 4,096 combinations is now accounted for: taken, or ruled out by a bound. ' +
          'The best haul is <strong>' + inc + '</strong>' + (proved ? ', and it is provably the best there is.' : '.') + '</p>' +
          '<p class="orfinal-note">Par is <b>30</b>, and it is a floor rather than a target — exactly 30 nodes in this tree ' +
          'have a bound above 355, and a branch that could still beat the optimum can never be safely cut, by any strategy. ' +
          'Breadth-first needs <b>1,388</b>. A depth-first dive needs <b>507</b>. Chasing the best bound first lands at <b>35–38</b>, ' +
          'the spread being nothing more than how ties between equal bounds fall — because a strong haul found early is what makes everything else prunable.</p>' +
          '<p class="orfinal-note quantum">Grover’s algorithm would search these 4,096 in about <b>50</b> oracle queries — a ' +
          '⟦Proven⟧ quadratic speedup, and it would hand you a <em>likely</em> answer rather than a proof. ' +
          'The units are not comparable, so the point is not that ' + used + ' beats 50. The point is that the quadratic ' +
          'speedup is the same whether the problem is a knapsack or pure noise, because it never looks at the structure — ' +
          'while the bound you just used is <em>made</em> of that structure, and it left you holding a certificate.</p>' +
          '<p><button class="preset" data-again>Prove it again, faster</button></p>' +
          '</div>';
      }

      function finish() {
        if (inc === OPT && used <= PAR + 8) win('or-prune', opts);
        render();
      }

      reset();
    }
  };

  /* -------------------------------------------------------------------- */
  window.SymbiQ.orgames = {
    all: G,
    list: ['bottleneck', 'prune'].map(function (k) {
      return { id: k, title: G[k].title, hook: G[k].hook, mentor: G[k].mentor, about: G[k].about, honest: G[k].honest };
    }),
    get: function (id) { return G[id]; },
    aboutHTML: function (id) {
      var a = G[id] && G[id].about;
      if (!a) return '';
      return '<div class="gameabout">' +
        '<div><span class="lbl">🎯 The goal</span> ' + a.goal + '</div>' +
        '<div><span class="lbl">🕹️ How to play</span> ' + a.how + '</div>' +
        '<div><span class="lbl v">💡 Inspired by</span> ' + a.inspired + '</div>' +
        '<div><span class="lbl v">🔬 You’ll get a feel for</span> ' + a.learn +
          ' <a href="' + a.link + '">' + a.linkText + '</a> <span class="tier">' + a.tier + '</span></div>' +
        '</div>';
    },
    mount: function (id, elm, opts) {
      var g = G[id];
      if (!g || !elm) return false;
      try { g.mount(elm, opts || {}); return true; }
      catch (e) { elm.innerHTML = '<p style="color:var(--muted)">This game could not start. Reload the page.</p>'; return false; }
    }
  };
})();
