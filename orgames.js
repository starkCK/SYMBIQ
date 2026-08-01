/* SymbiQ — The Feasible Region: operations-research games, with levels.
 *
 * Same contract as games.js on purpose, so these can be mounted as missions
 * on The Solver's Path later without a rewrite (branch & bound is already
 * pencilled in as Cordon's second mission in 12_GAME_MASTER_PLAN.md):
 *
 *   SymbiQ.orgames.list                    -> metadata
 *   SymbiQ.orgames.mount(id, el, opts)     -> render one into el
 *   opts = { mode: 'mission'|'arcade', onWin: function(id, first){}, level: n }
 *
 * Design rule inherited from the Decoder Duel: find the decision where the
 * honest answer is NON-OBVIOUS, and let the mathematics do the judging.
 *
 * EVERY par below is a proven number, computed offline in exact rational
 * arithmetic or by exhaustive search, and reproduced by the same arithmetic
 * at run time. Nothing here is a designer's guess.
 *
 * Rebuilt 2026-07-30 with levels, after an audit found five real defects:
 * the knapsack's items were never shown to the player, neither game had a
 * mid-game restart, the Bottleneck never said what its products earned, the
 * tree squeezed instead of scrolling, and there was no undo anywhere.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var NS = 'http://www.w3.org/2000/svg';
  function $(r, s) { return r.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(x) { return (Math.round(x * 100) / 100).toString(); }
  function win(id, opts) {
    var first = false;
    if (window.SymbiQ && SymbiQ.save) first = SymbiQ.save.completeMission(id);
    if (opts && typeof opts.onWin === 'function') opts.onWin(id, first);
    return first;
  }

  /* Per-level clears, stored through the same save bag as everything else so
     a real back end later swaps one load/store pair rather than N. */
  function clears(key) {
    var S = window.SymbiQ && SymbiQ.save;
    var v = S ? S.get('or.' + key + '.cleared', []) : [];
    return Object.prototype.toString.call(v) === '[object Array]' ? v : [];
  }
  function markClear(key, lv) {
    var S = window.SymbiQ && SymbiQ.save; if (!S) return false;
    var c = clears(key);
    if (c.indexOf(lv) >= 0) return false;
    c.push(lv); S.set('or.' + key + '.cleared', c);
    return true;
  }
  function levelBar(key, levels, cur, go) {
    var done = clears(key);
    return '<div class="lvbar" role="tablist" aria-label="Levels">' +
      levels.map(function (L, i) {
        var cleared = done.indexOf(i) >= 0;
        return '<button class="lv' + (i === cur ? ' on' : '') + (cleared ? ' done' : '') + '"' +
          ' role="tab" aria-selected="' + (i === cur) + '" data-lv="' + i + '">' +
          '<span class="lv-n">' + (i + 1) + '</span>' +
          '<span class="lv-t">' + esc(L.name) + '</span>' +
          (cleared ? '<span class="lv-tick" aria-label="cleared">✓</span>' : '') +
          '</button>';
      }).join('') + '</div>';
  }

  /* The completion CTA. Chinmoy reported (2026-07-25, 07-29 and again on
     07-30) that after finishing a stage there is nothing telling you where to
     go next. In these two games there WAS a button, but it sat at the bottom
     of three paragraphs of explanation, which is the same as not existing.
     It is now a full-width `.nextup` block directly under the score, it names
     the level it leads to, and it takes keyboard focus when it appears. */
  /* Put the caret on the CTA the moment it appears, so a keyboard or screen
     reader user meets it first rather than last. Guarded: only when the CTA
     is newly rendered, and never steals focus from a field being typed in. */
  function focusNext(root) {
    var cta = root.querySelector('button[data-nextcta]');
    if (!cta || cta._focused) return;
    cta._focused = true;
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    try { cta.focus({ preventScroll: true }); } catch (e) { try { cta.focus(); } catch (e2) {} }
  }

  function nextCTA(cleared, last, cur, noun, levels) {
    if (!cleared) return '';
    if (last) {
      return '<div class="nextup" data-nextcta><span class="eyebrow">Every ' + noun +
        ' cleared</span><span class="headline">You have finished this game</span>' +
        '<span class="sub">The other game on this page teaches the opposite half of the field.</span>' +
        '<span class="go">Back to the course</span></div>';
    }
    var nx = levels[cur + 1];
    return '<button class="nextup" data-next data-nextcta>' +
      '<span class="eyebrow">Cleared &#183; ' + (cur + 2) + ' of ' + levels.length + '</span>' +
      '<span class="headline">Next ' + noun + ': ' + esc(nx.name) + '</span>' +
      '<span class="sub">' + esc(nx.story) + '</span>' +
      '<span class="go">Play it</span></button>';
  }

  var G = {};

  /* ==================================================================== *
   *  THE BOTTLENECK — shadow prices, and why they lie if you don't ask   *
   *  how far they go.  Three levels, three distinct lessons.             *
   *                                                                      *
   *  L1  2 resources, 3 rounds.  start 21  PAR 31.5                      *
   *      Both greedy strategies win. Tutorial: slack is worth zero.      *
   *  L2  3 resources, 5 rounds.  start 21  PAR 34.5 (10 of 243 = 4.1%)   *
   *      greedy-on-price 31.5 FAILS; greedy-on-exact-gain 34.5 wins.     *
   *      Skilled hours provably never worth buying (best with = 33).     *
   *  L3  3 resources, 4 rounds.  start 25.2  PAR 40.5 (6 of 81 = 7.4%)   *
   *      BOTH greedies fail at 36. Requires genuine lookahead.           *
   * ==================================================================== */
  G.bottleneck = {
    title: 'The Bottleneck',
    hook: 'Three factories, one upgrade a quarter, and one number that tells you which — if you ask it the right question.',
    mentor: 'Cordon',
    about: {
      goal: 'Finish each factory&#39;s run with the highest profit you can. Every quarter you may expand exactly <strong>one</strong> resource.',
      how: 'Read each resource&#39;s <strong>shadow price</strong> — what one more unit is worth — and the <strong>range</strong> over which that price still holds. Then buy. The region grows and the best plan slides to a new corner. Undo and restart are always there.',
      inspired: 'Linear-programming duality (von Neumann 1947; Gale, Kuhn &amp; Tucker 1951) and right-hand-side ranging — the output real planners actually buy an optimiser for.',
      learn: 'Why the most valuable resource is not the scarcest or the dearest, why relieving a bottleneck destroys its own value, and why a shadow price without its range is a trap.',
      link: 'feasible.html#t03', linkText: 'Topic 03: Duality ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: each level is a real linear program, re-solved exactly at every step by enumerating the vertices of the feasible region — the reason an optimum can be found without searching the interior. A shadow price here is the <em>right-hand</em> derivative of the optimum with respect to that right-hand side — one-sided on purpose, because the optimal-value function is piecewise linear and has a corner exactly where the binding set changes, which is the whole lesson of level 2. The range is found by walking that right-hand side until the price changes, which is exactly what right-hand-side ranging means. Every par was established by exhaustive search over all possible purchase sequences before any of this was drawn. <strong>Level 1</strong> (8 sequences) is a tutorial and both greedy strategies solve it. <strong>Level 2</strong> (243 sequences, par 34.5 reached by 10 of them) is the range trap — and the trap is more specific than it looks. Simply following the largest shadow price actually <em>wins</em> here (34.5), because after one purchase machine-hours&#39; price collapses and a price-follower correctly moves on. What scores 31.5 is multiplying the price by the size of the upgrade: machine-hours are worth 0.75 each but only for 2.25 more units, so an upgrade of 6 looks like 4.5 and delivers 1.8. A price without its range is what misleads you, not the price. Skilled hours, meanwhile, are worthless in <em>every</em> one of the 243 sequences — the best plan touching them scores 33 against the 34.5 available without. <strong>Level 3</strong> (81 sequences, par 40.5 reached by only 6) is where greedy play runs out: 44 of the 81 sequences score exactly 36 and greedy lands there unless a tie between equal-scoring resources happens to fall its way, in which case it stumbles onto par. The right first move is worth nothing on the quarter you make it and only pays through what it unblocks later. That is the honest limit of a shadow price: it is a slope, not a plan.',

    mount: function (root, opts) {
      opts = opts || {};
      var LEVELS = [
        { name: 'Two lines', rounds: 3, par: 31.5, profit: [5, 4],
          story: 'A small shop with two products and two limits. Warm-up: find the one number that matters.',
          res: [ { n:'machine-hours', row:[6,4], cap:24, step:6, c:'var(--violet)' },
                 { n:'material',      row:[1,2], cap:6,  step:3, c:'var(--teal)'   } ] },
        { name: 'The plant', rounds: 5, par: 34.5, profit: [5, 4],
          story: 'Three resources now, and one of them is a decoy. The board will fund five upgrades.',
          res: [ { n:'machine-hours', row:[6,4], cap:24, step:6, c:'var(--violet)' },
                 { n:'material',      row:[1,2], cap:6,  step:3, c:'var(--teal)'   },
                 { n:'skilled hours', row:[3,1], cap:12, step:4, c:'var(--yellow)' } ] },
        { name: 'The long game', rounds: 4, par: 40.5, profit: [9, 4],
          story: 'Only one resource is worth anything today. Buying it every time is not the answer.',
          res: [ { n:'furnace time', row:[3,2], cap:22, step:4, c:'var(--violet)' },
                 { n:'alloy',        row:[6,5], cap:21, step:3, c:'var(--teal)'   },
                 { n:'finishing',    row:[5,6], cap:14, step:6, c:'var(--yellow)' } ] }
      ];
      var lv = Math.min(Math.max(opts.level || 0, 0), LEVELS.length - 1);
      var L, st, round, hist, done;

      function cons(s) {
        var C = L.res.map(function (r, i) { return [r.row[0], r.row[1], s[i]]; });
        C.push([-1, 0, 0]); C.push([0, -1, 0]);
        return C;
      }
      function feas(C, x, y) {
        for (var i = 0; i < C.length; i++) if (C[i][0]*x + C[i][1]*y > C[i][2] + 1e-9) return false;
        return true;
      }
      function solve(s) {
        var C = cons(s), best = null, bv = -Infinity, verts = [];
        for (var i = 0; i < C.length; i++) for (var j = i+1; j < C.length; j++) {
          var det = C[i][0]*C[j][1] - C[j][0]*C[i][1];
          if (Math.abs(det) < 1e-12) continue;
          var x = (C[i][2]*C[j][1] - C[j][2]*C[i][1]) / det;
          var y = (C[i][0]*C[j][2] - C[j][0]*C[i][2]) / det;
          if (!feas(C, x, y)) continue;
          if (!verts.some(function (v) { return Math.abs(v[0]-x) < 1e-9 && Math.abs(v[1]-y) < 1e-9; })) verts.push([x,y]);
          var v = L.profit[0]*x + L.profit[1]*y;
          if (v > bv + 1e-12) { bv = v; best = [x,y]; }
        }
        var cx = 0, cy = 0;
        verts.forEach(function (v) { cx += v[0]; cy += v[1]; });
        cx /= verts.length; cy /= verts.length;
        verts.sort(function (a,b) { return Math.atan2(a[1]-cy, a[0]-cx) - Math.atan2(b[1]-cy, b[0]-cx); });
        return { value: bv, point: best, verts: verts };
      }
      function bump(s, i, d) { var o = s.slice(); o[i] += d; return o; }
      function price(s, i) {
        var e = 1e-6;
        return Math.round((solve(bump(s,i,e)).value - solve(s).value) / e * 1e4) / 1e4;
      }
      function range(s, i) {
        var p0 = price(s, i), d = 0;
        while (d < 40) { d += 0.25; if (Math.abs(price(bump(s,i,d), i) - p0) > 1e-6) return d - 0.25; }
        return Infinity;
      }
      function binding(s) {
        var o = solve(s).point;
        return L.res.map(function (r, i) { return Math.abs(r.row[0]*o[0] + r.row[1]*o[1] - s[i]) < 1e-7; });
      }

      function load(n) {
        lv = n; L = LEVELS[lv];
        st = L.res.map(function (r) { return r.cap; });
        round = 1; hist = []; done = false;
        render();
      }

      /* axes are fixed per level so the region visibly GROWS rather than the
         chart rescaling under it — the growth is the thing being taught */
      function axisMax() {
        var s = L.res.map(function (r, i) { return r.cap + r.step * L.rounds; });
        var mx = 0, my = 0;
        L.res.forEach(function (r, i) {
          if (r.row[0] > 0) mx = Math.max(mx, s[i] / r.row[0]);
          if (r.row[1] > 0) my = Math.max(my, s[i] / r.row[1]);
        });
        var m = Math.ceil(Math.min(Math.min(mx, my) * 1.15, 40));
        return Math.max(m, 4);
      }

      function drawRegion() {
        var AX = axisMax(), sol = solve(st), bnd = binding(st);
        var W = 430, H = 330, x0 = 48, y0 = 280, pw = 360, ph = 250;
        function px(a) { return x0 + a / AX * pw; }
        function py(b) { return y0 - b / AX * ph; }
        var g = ['<svg class="orsvg" viewBox="0 0 ' + W + ' ' + H + '" xmlns="' + NS +
                 '" role="img" aria-label="The feasible region for the current capacities. The best plan is marked at a corner.">'];
        g.push('<g stroke="var(--border)" stroke-width="1" opacity=".28">');
        for (var i = 1; i <= AX; i++) {
          if (AX > 14 && i % 2) continue;
          g.push('<path d="M' + px(i) + ' ' + py(0) + 'V' + py(AX) + '"/>');
          g.push('<path d="M' + px(0) + ' ' + py(i) + 'H' + px(AX) + '"/>');
        }
        g.push('</g>');
        g.push('<polygon class="orregion" points="' + sol.verts.map(function (v) {
          return px(v[0]) + ',' + py(v[1]); }).join(' ') + '"/>');
        L.res.forEach(function (r, i) {
          var a = r.row[0], b = r.row[1], c = st[i], p1, p2;
          if (b !== 0) { p1 = [0, c/b]; p2 = [AX, (c - a*AX)/b]; }
          else { p1 = [c/a, 0]; p2 = [c/a, AX]; }
          g.push('<path class="orline' + (bnd[i] ? ' tight' : '') + '" d="M' + px(p1[0]) + ' ' + py(p1[1]) +
                 'L' + px(p2[0]) + ' ' + py(p2[1]) + '" stroke="' + r.c + '"/>');
        });
        g.push('<circle class="oropt" cx="' + px(sol.point[0]) + '" cy="' + py(sol.point[1]) + '" r="7"/>');
        g.push('<path d="M' + px(0) + ' ' + py(AX) + 'V' + py(0) + 'H' + px(AX) +
               '" fill="none" stroke="var(--border)" stroke-width="2"/>');
        g.push('<text class="orax" x="' + px(AX/2) + '" y="' + (y0 + 30) + '" text-anchor="middle">units of A</text>');
        g.push('<text class="orax" x="14" y="' + py(AX/2) + '" text-anchor="middle" transform="rotate(-90 14 ' + py(AX/2) + ')">units of B</text>');
        g.push('</svg>');
        return g.join('');
      }

      /* THE FIX for "products A and B were never explained": the recipe is on
         screen, always, next to the region it produces. */
      function recipe() {
        return '<table class="orrec"><thead><tr><th></th>' +
          '<th>A</th><th>B</th><th>you have</th></tr></thead><tbody>' +
          L.res.map(function (r, i) {
            return '<tr><th scope="row"><i style="background:' + r.c + '"></i>' + esc(r.n) + '</th>' +
              '<td>' + r.row[0] + '</td><td>' + r.row[1] + '</td>' +
              '<td class="have">' + fmt(st[i]) +
              (st[i] > r.cap ? ' <span class="up">+' + fmt(st[i] - r.cap) + '</span>' : '') + '</td></tr>';
          }).join('') +
          '<tr class="profitrow"><th scope="row">earns you</th><td>' + L.profit[0] +
          '</td><td>' + L.profit[1] + '</td><td></td></tr></tbody></table>';
      }

      function offers() {
        var bnd = binding(st);
        return L.res.map(function (r, i) {
          var p = price(st, i), rg = range(st, i);
          var over = rg < r.step - 1e-9 && p > 0;
          return '<button class="orbuy" data-buy="' + i + '"' + (done ? ' disabled' : '') + '>' +
            '<span class="orbuy-top"><i style="background:' + r.c + '"></i>' + esc(r.n) +
              (bnd[i] ? '<em class="tight">binding</em>' : '<em class="slack">slack</em>') + '</span>' +
            '<span class="orbuy-price">' + (p > 0 ? fmt(p) + ' per unit' : 'worth nothing right now') + '</span>' +
            '<span class="orbuy-range">' + (p > 0
              ? 'that price holds for ' + (rg === Infinity ? 'a long way' : fmt(rg) + ' more units')
              : 'you already have spare — more cannot help') + '</span>' +
            '<span class="orbuy-go">buy +' + r.step + (over ? ' <b class="warn">overshoots the range</b>' : '') + '</span>' +
            '</button>';
        }).join('');
      }

      function render(flash) {
        var sol = solve(st), pct = Math.round((round - 1) / L.rounds * 100);
        root.innerHTML =
          levelBar('bottleneck', LEVELS, lv) +
          '<p class="orstory">' + esc(L.story) + '</p>' +
          '<div class="orhud">' +
            '<span class="orhud-k">Quarter</span><span class="orhud-v">' + Math.min(round, L.rounds) + ' / ' + L.rounds + '</span>' +
            '<span class="orhud-k">Profit</span><span class="orhud-v big">' + fmt(sol.value) + '</span>' +
            '<span class="orhud-k">Par</span><span class="orhud-v">' + L.par + '</span>' +
            '<span class="orctl">' +
              '<button class="orsm" data-undo' + (hist.length && !done ? '' : ' disabled') + '>↶ undo</button>' +
              '<button class="orsm" data-restart>↺ restart</button>' +
            '</span>' +
          '</div>' +
          '<div class="orprog"><i style="width:' + pct + '%"></i></div>' +
          '<div class="orsplit">' +
            '<div class="orviz">' + drawRegion() +
              '<p class="orcap">The shaded shape is every production plan you could actually run. ' +
              'A <b>binding</b> line touches the best corner — that resource is the bottleneck. ' +
              'A <b>slack</b> line does not, and buying more of it moves nothing.</p>' +
            '</div>' +
            '<div class="orside">' +
              '<p class="oreyebrow">The recipe</p>' + recipe() +
              (done ? verdict(sol) : '<p class="oreyebrow" style="margin-top:16px">Expand one resource</p>' + offers()) +
              (hist.length ? '<p class="orlog">' + hist.map(function (h) { return esc(h); }).join(' → ') + '</p>' : '') +
            '</div>' +
          '</div>' +
          (flash ? '<p class="verdict ' + flash.cls + '">' + flash.html + '</p>' : '');

        Array.prototype.forEach.call(root.querySelectorAll('[data-buy]'), function (b) {
          b.addEventListener('click', function () { buy(+b.getAttribute('data-buy')); });
        });
        Array.prototype.forEach.call(root.querySelectorAll('[data-lv]'), function (b) {
          b.addEventListener('click', function () { load(+b.getAttribute('data-lv')); });
        });
        var u = $(root, '[data-undo]'); if (u) u.addEventListener('click', undo);
        var r = $(root, '[data-restart]'); if (r) r.addEventListener('click', function () { load(lv); });
        var n = $(root, '[data-next]'); if (n) n.addEventListener('click', function () { load(lv + 1); });
        var a = $(root, '[data-again]'); if (a) a.addEventListener('click', function () { load(lv); });
        focusNext(root);
      }

      function undo() {
        if (!hist.length || done) return;
        var last = hist.pop();
        st = bump(st, last.i, -L.res[last.i].step);
        round--; render();
      }

      function buy(i) {
        if (done) return;
        var r = L.res[i], before = solve(st).value, p = price(st, i), rg = range(st, i);
        st = bump(st, i, r.step);
        var gain = solve(st).value - before;
        hist.push({ i: i, toString: function () { return r.n.split(' ')[0] + ' +' + fmt(gain); } });

        var msg;
        if (p === 0) {
          msg = { cls: '', html: '<strong>Nothing happened, and the price told you so.</strong> ' + esc(r.n) +
            ' had slack — the best plan was not using all of what you already had, so more of it changes no corner. ' +
            'A shadow price of zero is not a small number. It is a statement that this is not your problem.' };
        } else if (rg < r.step - 1e-9) {
          msg = { cls: 'good', html: '<strong>+' + fmt(gain) + ', not the +' + fmt(p * r.step) + ' the price appeared to promise.</strong> ' +
            'Each unit really was worth ' + fmt(p) + ' — but only for ' + fmt(rg) + ' more units. Past that this stopped being ' +
            'the bottleneck and the extra capacity had nothing to do. <em>A shadow price is a slope, not a promise.</em>' };
        } else {
          msg = { cls: 'good', html: '<strong>+' + fmt(gain) + '.</strong> The price held across the whole purchase, so ' +
            fmt(p) + ' × ' + r.step + ' was exactly right.' };
        }
        round++;
        if (round > L.rounds) { done = true; finish(); return; }
        render(msg);
      }

      function verdict(sol) {
        var v = sol.value, hit = v >= L.par - 1e-9, last = lv === LEVELS.length - 1;
        var notes = [
          'Both greedy strategies solve this one — that is why it is first. The habit to take forward: a resource with slack is worth <b>exactly</b> zero, not a little.',
          '<b>Skilled hours were never worth buying.</b> The best plan that spends anything on them scores 33, below the 34.5 available if you never touch them. And <b>a price times an upgrade size scores 31.5</b>: machine-hours are worth 0.75 each, but only for 2.25 more units, and an upgrade buys 6 — so it looks like 4.5 and pays 1.8. Following the price itself is fine; multiplying it out is the trap.',
          'This one runs greedy play out of road. Buying the best-looking resource every quarter lands on <b>36</b>, and so does buying the one with the largest true one-step gain — 44 of the 81 sequences score exactly that, and only 6 reach par. (A greedy player facing a tie between equal-scoring resources can stumble onto 40.5; that is luck, not method.) Par needs a purchase that is worth <b>nothing on the quarter you make it</b> and only pays through what it unblocks. A shadow price is a slope, not a plan.'
        ];
        return '<div class="orfinal ' + (hit ? 'win' : '') + '">' +
          '<p class="oreyebrow">' + esc(L.name) + ' — closed</p>' +
          '<p class="orfinal-v">' + fmt(v) + ' <span>vs par ' + L.par + '</span></p>' +
          // The next-level CTA goes HERE, directly under the score, not at the
          // bottom of the explanation. It was being missed because it sat
          // below three paragraphs of prose.
          nextCTA(hit, last, lv, 'factory', LEVELS) +
          '<p>' + (hit ? 'That is the maximum available on this factory.'
                       : 'Par is ' + L.par + ', found by checking every possible purchase sequence. You left ' +
                         fmt(L.par - v) + ' on the table.') + '</p>' +
          '<p class="orfinal-note">' + notes[lv] + '</p>' +
          '<p><button class="preset" data-again>Play this one again</button></p>' +
          '</div>';
      }

      function finish() {
        if (solve(st).value >= L.par - 1e-9) {
          markClear('bottleneck', lv);
          if (clears('bottleneck').length >= LEVELS.length) win('or-bottleneck', opts);
        }
        render();
      }

      load(lv);
    }
  };

  /* ==================================================================== *
   *  THE PRUNE — branch and bound over four sizes.                       *
   *                                                                      *
   *  All verified offline. PAR is the count of nodes whose Dantzig bound  *
   *  EXCEEDS the optimum: such a node can never be safely pruned by any   *
   *  strategy, so it is a hard floor rather than a target.                *
   *                                                                       *
   *   lvl items cap  combos  OPT  par  best-bound  dfs   bfs     Grover   *
   *    1    6   40      64   205   14      14        42     29      ~6    *
   *    2    9   55     512   280   27      27       151    204     ~18    *
   *    3   12   70   4,096   355   30   35-38        507  1,388     ~50    *
   *    4   16   95  65,536   479   24      36     1,203 19,829    ~201    *
   *                                                                       *
   *  Two figures in this table were corrected once and silently restored   *
   *  by a rewrite, so they are called out: Grover on level 2 is 17.77 and  *
   *  therefore ~18, NOT ~17 (int() truncation); and best-bound on level 3  *
   *  is 35-38, not a bare 38 — the spread is only how ties between equal   *
   *  bounds fall. Do not "tidy" either back. Re-verified 2026-07-30 by an  *
   *  exact port of expand()/sweep(): best 14/27/38/36, dfs 42/151/507/     *
   *  1203, bfs 29/204/1388/19829, and killed == 2^n on every level under   *
   *  every policy, which is the certificate claim.                         *
   *                                                                       *
   *  The arc across the levels is the honest lesson: Grover's ~sqrt(2^n)   *
   *  BEATS branch and bound on level 1 and is beaten five-fold by it on    *
   *  level 4, because the quadratic speedup still grows exponentially      *
   *  while structure-exploitation barely grows at all.                     *
   * ==================================================================== */
  G.prune = {
    title: 'The Prune',
    hook: 'Sixty-five thousand possibilities by the last level. You will look at about thirty-six, and prove the rest cannot win.',
    mentor: 'Cordon',
    about: {
      goal: '<strong>Prove</strong> which haul is best — not guess it. You are finished when every combination is accounted for: taken, or ruled out by a bound.',
      how: 'Pick an open branch to open. The number on each is its <strong>bound</strong> — the most it could possibly be worth. When a bound cannot beat the best haul you already hold, that whole branch dies untouched.',
      inspired: 'Branch and bound (Land &amp; Doig, 1960) and the Dantzig bound for the knapsack — the machinery every commercial solver still runs on.',
      learn: 'Why finding a good answer <em>early</em> beats exploring the promising branch, why a cut high in the tree is worth exponentially more than one low down, and what happens to a quantum speedup when the problem has structure.',
      link: 'feasible.html#t05', linkText: 'Topic 05: Branch and bound ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: genuine 0/1 knapsacks solved by genuine branch and bound. The bound on each node is the <strong>Dantzig bound</strong> — relax to fractional, fill greedily by value per kilogram, allow a fraction of the last item — which is provably an upper bound on anything below the node, and that is what makes discarding a branch safe rather than merely likely. Each optimum was found by exhaustive search, and each par is the count of nodes whose bound strictly exceeds that optimum: such a node can never be safely cut by <em>any</em> strategy, so par is a floor rather than a target. Measured on the four levels — best-bound play needs 14 / 27 / 35–38 / 36 expansions (the level-3 spread is nothing but how ties between equal bounds fall), a depth-first dive needs 42 / 151 / 507 / 1,203, and breadth-first needs 29 / 204 / 1,388 / <strong>19,829</strong>. <strong>The quantum comparison, and it is the reason the levels get bigger:</strong> Grover would need roughly 6 / 18 / 50 / 201 oracle queries on the same four search spaces. On level 1 that <em>beats</em> branch and bound. By level 4 it loses five-fold. The units are not comparable — an oracle query and a bound computation are different work — so the point is not the scoreboard. The point is the shape: Grover&#39;s ⟦Proven⟧ quadratic speedup is still exponential, and it is the same whether the problem is a knapsack or pure noise, because it never looks at the structure. The bound is <em>made</em> of that structure, so it barely grows at all — and it finishes holding a certificate rather than a likely answer.',

    mount: function (root, opts) {
      opts = opts || {};
      var LEVELS = [
        { name: 'The sampler', cap: 40, par: 14, gate: 18, opt: 205, bfs: 29, grover: 6,
          story: 'Six crates, a small van. Learn the move: open a branch, read its bound, watch what a bound can kill.',
          raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18]] },
        { name: 'The van', cap: 55, par: 27, gate: 31, opt: 280, bfs: 204, grover: 18,
          story: 'Nine crates. Five hundred and twelve ways to load them, and you will not look at most of them.',
          raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11]] },
        { name: 'The container', cap: 70, par: 30, gate: 42, opt: 355, bfs: 1388, grover: 50,
          story: 'Twelve crates, four thousand combinations. Breadth-first play needs 1,388 branches. Good play needs about 38.',
          raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11],[84,21],[38,8],[66,14]] },
        { name: 'The freighter', cap: 95, par: 24, gate: 40, opt: 479, bfs: 19829, grover: 201,
          story: 'Sixteen crates. Sixty-five thousand combinations. This is where the whole argument lands.',
          raw: [[60,10],[100,20],[120,30],[75,15],[45,9],[90,18],[30,7],[105,25],[52,11],[84,21],
                [38,8],[66,14],[72,16],[48,10],[93,22],[57,12]] }
      ];
      var lv = Math.min(Math.max(opts.level || 0, 0), LEVELS.length - 1);
      var L, IT, N, TOTAL, nodes, frontier, inc, incTaken, used, killed, over;

      function bound(k, val, wt) {
        var b = val, rem = L.cap - wt;
        for (var j = k; j < N; j++) {
          if (IT[j][1] <= rem) { b += IT[j][0]; rem -= IT[j][1]; }
          else { b += IT[j][0] * rem / IT[j][1]; break; }
        }
        return b;
      }
      function leaves(k) { return Math.pow(2, N - k); }

      function load(n) {
        lv = n; L = LEVELS[lv];
        IT = L.raw.slice().sort(function (a, b) { return b[0]/b[1] - a[0]/a[1]; });
        N = IT.length; TOTAL = Math.pow(2, N);
        nodes = []; used = 0; killed = 0; inc = 0; incTaken = []; over = false;
        var r0 = { id:0, k:0, val:0, wt:0, b:bound(0,0,0), taken:[], parent:null, state:'open', kids:[] };
        nodes.push(r0); frontier = [r0];
        render();
      }

      function prune(n, why) {
        n.state = why; killed += leaves(n.k);
        var i = frontier.indexOf(n); if (i >= 0) frontier.splice(i, 1);
      }
      function sweep() {
        for (var i = frontier.length - 1; i >= 0; i--)
          if (frontier[i].b <= inc + 1e-9) prune(frontier[i], 'cut');
      }
      function expand(n) {
        if (over || n.state !== 'open') return;
        if (n.b <= inc + 1e-9) { prune(n, 'cut'); render(); return; }
        used++; n.state = 'done';
        var i = frontier.indexOf(n); if (i >= 0) frontier.splice(i, 1);
        [1, 0].forEach(function (take) {
          var k = n.k + 1,
              val = n.val + (take ? IT[n.k][0] : 0),
              wt  = n.wt  + (take ? IT[n.k][1] : 0),
              taken = take ? n.taken.concat(n.k) : n.taken;
          var kid = { id:nodes.length, k:k, val:val, wt:wt, taken:taken,
                      parent:n, state:'open', kids:[], take:take };
          nodes.push(kid); n.kids.push(kid);
          if (wt > L.cap) { kid.b = -Infinity; prune(kid, 'heavy'); return; }
          if (k === N) {
            kid.b = val; kid.state = 'leaf'; killed += 1;
            if (val > inc) { inc = val; incTaken = taken.slice(); kid.state = 'best'; sweep(); }
            return;
          }
          kid.b = bound(k, val, wt);
          if (kid.b <= inc + 1e-9) prune(kid, 'cut'); else frontier.push(kid);
        });
        sweep();
        if (!frontier.length) { over = true; finish(); return; }
        render();
      }

      function layout() {
        var xs = 0;
        (function place(n) {
          if (!n.kids.length) n.x = xs++;
          else { n.kids.forEach(place); n.x = (n.kids[0].x + n.kids[n.kids.length-1].x) / 2; }
          n.y = n.k;
        })(nodes[0]);
        return xs || 1;
      }

      /* FIXED node spacing and a scrolling wrapper. The old build scaled the
         whole tree to a fixed width, so spacing collapsed as it grew. */
      /* TOP_PAD must clear the bound label, which is drawn 13px ABOVE the node
         centre with ~11px of ascender above its own baseline. It was 18, so
         the root's label was sheared off by the top of the viewBox on every
         level (reported 2026-07-30 with a screenshot). 28 leaves 4px of air. */
      function drawTree() {
        var cols = layout(), colW = 30, rowH = 32, TOP_PAD = 28;
        var w = Math.max(320, cols * colW + 60), h = TOP_PAD + N * rowH + 34;
        var g = ['<svg class="ortree" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
                 '" xmlns="' + NS + '" role="img" aria-label="The search tree so far. Grey branches were eliminated by a bound without ever being searched.">'];
        function X(n) { return 30 + n.x * colW; }
        function Y(n) { return TOP_PAD + n.y * rowH; }
        nodes.forEach(function (n) {
          if (!n.parent) return;
          g.push('<path class="oredge ' + n.state + '" d="M' + X(n.parent) + ' ' + Y(n.parent) +
                 'C' + X(n.parent) + ' ' + (Y(n.parent) + rowH*.55) + ',' + X(n) + ' ' + (Y(n) - rowH*.55) +
                 ',' + X(n) + ' ' + Y(n) + '"/>');
        });
        nodes.forEach(function (n) {
          var r = n.state === 'open' ? 9 : 6;
          g.push('<g class="ornode ' + n.state + '"' +
                 (n.state === 'open' ? ' data-n="' + n.id + '" tabindex="0" role="button" aria-label="Open branch, bound ' + Math.floor(n.b) + '"' : '') + '>');
          g.push('<circle cx="' + X(n) + '" cy="' + Y(n) + '" r="' + r + '"/>');
          if (n.state === 'open') g.push('<text x="' + X(n) + '" y="' + (Y(n) - 13) + '" text-anchor="middle">' + Math.floor(n.b) + '</text>');
          if (n.state === 'cut')  g.push('<text class="killed" x="' + X(n) + '" y="' + (Y(n) + 15) + '" text-anchor="middle">−' + leaves(n.k) + '</text>');
          g.push('</g>');
        });
        g.push('</svg>');
        return g.join('');
      }

      /* THE FIX for the blocker: you could not see what you were optimising.
         The crates, the capacity and the current best haul are now on screen. */
      function crates() {
        return '<div class="orcrates">' +
          '<p class="oreyebrow">The crates <span class="capnote">van holds ' + L.cap + ' kg</span></p>' +
          '<div class="cratelist">' + IT.map(function (it, i) {
            var inBest = incTaken.indexOf(i) >= 0;
            return '<span class="crate' + (inBest ? ' in' : '') + '" title="' +
              (Math.round(it[0]/it[1]*100)/100) + ' per kg">' +
              '<b>' + it[0] + '</b><i>' + it[1] + 'kg</i></span>';
          }).join('') + '</div>' +
          '<p class="orcap" style="margin-top:8px">Sorted by value per kilogram — the order the bound needs. ' +
          'Highlighted crates are in the best haul found so far' +
          (incTaken.length ? ' (' + incTaken.length + ' crates, ' +
            incTaken.reduce(function (a,i) { return a + IT[i][1]; }, 0) + ' kg, worth ' + inc + ')' : ' — none yet') + '.</p>' +
          '</div>';
      }

      function render() {
        var pct = Math.round(killed / TOTAL * 100);
        root.innerHTML =
          levelBar('prune', LEVELS, lv) +
          '<p class="orstory">' + esc(L.story) + '</p>' +
          '<div class="orhud">' +
            '<span class="orhud-k">Best haul</span><span class="orhud-v big">' + inc + '</span>' +
            '<span class="orhud-k">Branches opened</span><span class="orhud-v">' + used + '</span>' +
            '<span class="orhud-k">Par</span><span class="orhud-v">' + L.par + '</span>' +
            '<span class="orctl"><button class="orsm" data-restart>↺ restart</button></span>' +
          '</div>' +
          '<div class="orbar" title="' + killed + ' of ' + TOTAL + ' accounted for">' +
            '<i style="width:' + pct + '%"></i><span>' + killed.toLocaleString() + ' of ' +
            TOTAL.toLocaleString() + ' combinations ruled out — ' + pct + '%</span></div>' +
          crates() +
          (over ? finalHTML() :
            '<p class="oreyebrow" style="margin-top:16px">Open a branch — the number above it is the most it could possibly be worth</p>') +
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
        Array.prototype.forEach.call(root.querySelectorAll('[data-lv]'), function (b) {
          b.addEventListener('click', function () { load(+b.getAttribute('data-lv')); });
        });
        var r = $(root, '[data-restart]'); if (r) r.addEventListener('click', function () { load(lv); });
        var a = $(root, '[data-again]');   if (a) a.addEventListener('click', function () { load(lv); });
        var n2 = $(root, '[data-next]');   if (n2) n2.addEventListener('click', function () { load(lv + 1); });
        focusNext(root);
      }

      function finalHTML() {
        var proved = inc === L.opt, tight = used <= L.gate, last = lv === LEVELS.length - 1;
        var beatsGrover = used < L.grover;
        return '<div class="orfinal ' + (proved && tight ? 'win' : '') + '">' +
          '<p class="oreyebrow">The frontier is empty — that is the proof</p>' +
          '<p class="orfinal-v">' + used + ' <span>branches opened · par ' + L.par + '</span></p>' +
          nextCTA(proved && tight, last, lv, 'load', LEVELS) +
          '<p>All ' + TOTAL.toLocaleString() + ' combinations are accounted for: taken, or ruled out by a bound. ' +
          'The best haul is <strong>' + inc + '</strong>' + (proved ? ', and it is provably the best there is.' : '.') + '</p>' +
          '<p class="orfinal-note">Par is <b>' + L.par + '</b>, and it is a floor rather than a target — exactly ' + L.par +
          ' nodes in this tree have a bound above ' + L.opt + ', and a branch that could still beat the optimum can never be ' +
          'safely cut by any strategy — reaching it needs a perfect first guess. Clearing this level asks for <b>' + L.gate +
          '</b> or fewer, which best-bound play achieves. Breadth-first needs <b>' + L.bfs.toLocaleString() + '</b>.</p>' +
          '<p class="orfinal-note quantum">Grover would need about <b>' + L.grover + '</b> oracle queries on these ' +
          TOTAL.toLocaleString() + ' — ⟦Proven⟧ quadratic, and it returns a <em>likely</em> answer rather than a proof. ' +
          (beatsGrover
            ? 'You beat that. '
            : 'That is fewer than you used. <b>Grover genuinely wins at this size</b>, and saying otherwise would be dishonest. ') +
          (last
            ? 'Look back at level 1: Grover needed 6 there and you needed about 14. It needs 201 here. That is the whole argument — ' +
              'the quadratic speedup is still exponential, and it is identical whether the problem is a knapsack or pure noise, ' +
              'because it never looks at the structure. The bound is <em>made</em> of that structure, so it barely grows at all.'
            : 'Keep going — the gap moves as the problem grows, and which way it moves is the point of this game.') +
          '</p>' +
          '<p><button class="preset" data-again>Prove it again, faster</button></p>' +
          '</div>';
      }

      function finish() {
        if (inc === L.opt && used <= L.gate) {
          markClear('prune', lv);
          if (clears('prune').length >= LEVELS.length) win('or-prune', opts);
        }
        render();
      }

      load(lv);
    }
  };

  /* -------------------------------------------------------------------- */
  window.SymbiQ.orgames = {
    all: G,
    list: ['bottleneck', 'prune'].map(function (k) {
      return { id: k, title: G[k].title, hook: G[k].hook, mentor: G[k].mentor, about: G[k].about, honest: G[k].honest };
    }),
    get: function (id) { return G[id]; },
    /* Same contract as games.js: rules behind one obvious button, opened
       automatically the first time you meet this game and shut thereafter. */
    aboutHTML: function (id) {
      var a = G[id] && G[id].about;
      if (!a) return '';
      var S = window.SymbiQ && SymbiQ.save;
      var seen = S && S.get ? S.get('rules.seen.' + id, false) : false;
      if (S && S.set) S.set('rules.seen.' + id, true);
      return '<details class="gamerules"' + (seen ? '' : ' open') + '>' +
        '<summary><span class="gr-ico" aria-hidden="true">🕹️</span>' +
          '<span class="gr-txt"><b>How to play</b>' +
          '<i>the goal, the rules, and what you will get a feel for</i></span>' +
          '<span class="gr-x" aria-hidden="true"></span></summary>' +
        '<div class="gameabout">' +
        '<div><span class="lbl">🎯 The goal</span> ' + a.goal + '</div>' +
        '<div><span class="lbl">🕹️ How to play</span> ' + a.how + '</div>' +
        '<div><span class="lbl v">💡 Inspired by</span> ' + a.inspired + '</div>' +
        '<div><span class="lbl v">🔬 You’ll get a feel for</span> ' + a.learn +
          ' <a href="' + a.link + '">' + a.linkText + '</a> <span class="tier">' + a.tier + '</span></div>' +
        '</div></details>';
    },
    mount: function (id, elm, opts) {
      var g = G[id];
      if (!g || !elm) return false;
      try { g.mount(elm, opts || {}); return true; }
      catch (e) { elm.innerHTML = '<p style="color:var(--muted)">This game could not start. Reload the page.</p>'; return false; }
    }
  };
})();
