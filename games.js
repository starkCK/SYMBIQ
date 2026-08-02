/* SymbiQ — the game engines, defined ONCE and mounted anywhere.
 *
 * Why this file exists: every game used to live inline in play.html, while The
 * Solver's Path linked out to that same page — so a player met each game twice,
 * identically. Now each engine is a module that renders into whatever container
 * you hand it, and the *frame* around it differs:
 *     mode 'mission' — in-world, mentor voice, story stakes (journey.html)
 *     mode 'arcade'  — free play, scores and pars (play.html)
 * The physics is byte-identical in both. Only the chrome changes.
 *
 * API:  SymbiQ.games.list                     -> metadata for every game
 *       SymbiQ.games.mount(id, el, opts)      -> render one into el
 *       opts = { mode: 'mission'|'arcade', onWin: function(id){} }
 *
 * Every par, pass mark and probability quoted here was computed offline and is
 * reproduced by the same arithmetic at run time. Nothing is a designer's guess.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  var NS = 'http://www.w3.org/2000/svg';

  function el(t, a) { var n = document.createElementNS(NS, t); for (var k in a) n.setAttribute(k, a[k]); return n; }
  function win(id, opts) {
    var first = false;
    if (window.SymbiQ && SymbiQ.save) first = SymbiQ.save.completeMission(id);
    if (opts && typeof opts.onWin === 'function') opts.onWin(id, first);
    return first;
  }
  function $(root, sel) { return root.querySelector(sel); }

  var G = {};

  /* ==================================================================== *
   *  THE ANNEALING VOLCANO — Vesh's mission (new)                        *
   *                                                                      *
   *  You are not the walker. You are the COOLING SCHEDULE.               *
   *                                                                      *
   *  Engine (verified in Python, see outputs/VERIFY_VOLCANO.md):         *
   *    state  : integer position on a 1-D landscape of integer heights   *
   *    move   : propose x+/-1 with equal probability; an out-of-range    *
   *             proposal is REJECTED and the walker stays — that keeps   *
   *             the proposal symmetric, which is what Metropolis         *
   *             detailed balance requires                                *
   *    accept : always if dE <= 0, else with probability exp(-dE/T)      *
   *    budget : 12 epochs x 20 steps = 240 proposals                     *
   *    WIN    : the walker's FINAL cell is the unique global minimum     *
   *                                                                      *
   *  Clearing is judged on your SCHEDULE, not your run: the schedule is  *
   *  replayed 500 times and scored against a pass mark. Anyone can get   *
   *  lucky once.                                                         *
   * ==================================================================== */
  G.volcano = {
    id: 'volcano', title: 'The Annealing Volcano', mentor: 'Vesh',
    hook: 'You are not the climber. You are the temperature — and the only question that matters is how fast you let it fall.',
    about: {
      goal: 'End the run <strong>frozen on the deepest point</strong> of the landscape. Not merely visit it — finish there.',
      how: 'Twelve times, choose <strong>Cool</strong>, <strong>Hold</strong> or <strong>Stoke</strong>. Each choice runs twenty random steps at that temperature. Hot lets the walker climb out of valleys; cold locks it wherever it stands.',
      inspired: 'Simulated annealing (Kirkpatrick, Gelatt &amp; Vecchi, <em>Science</em> 1983) — metallurgy borrowed as an algorithm, and the classical baseline that quantum annealers are measured against.',
      learn: 'The exploration/exploitation trade-off you can feel in your hands, and why a method that never accepts a worse move can never escape a valley.',
      link: 'ai.html', linkText: 'Quantum optimisation ▸', tier: '⟦Heuristic⟧',
      or: 'Simulated annealing is a <b>metaheuristic</b> — operations research’s answer to problems too hard to solve exactly. It is the classical baseline quantum annealing has to beat.'
    },
    honest: 'Honest model: this is real simulated annealing. Each step proposes a move to an adjacent cell and accepts it outright if the landscape drops; if it rises by ΔE it is accepted with probability <strong>exp(−ΔE/T)</strong> — the Metropolis rule, which is why a hot walker can climb out of a valley and a cold one cannot. Proposals that would leave the landscape are rejected, keeping the proposal symmetric as detailed balance requires. Every landscape here was checked by brute force (each global minimum is unique) and every claim the game makes was measured over 20,000 simulated runs per volcano. Crash-cooling misses the true floor on <strong>88 / 93 / 98 / 93%</strong> of runs across the four landscapes that have structure. On the three with a single trap it freezes in that first ditch specifically (76–93%); on the Comb it freezes in whichever of the seven traps it happens to be nearest, which is why "the first ditch" is the wrong picture there and only 12% of its runs end in the first one. Against that, a shaped schedule wins about <strong>six-fold</strong> on the gentlest of the four and about <strong>forty-fold</strong> on the cruellest. Clearing is judged on your <em>schedule</em>, replayed 500 times — because a single win proves nothing. The honest limit: annealing is <strong>⟦heuristic⟧</strong>. There <em>is</em> a schedule proven to find the global optimum — cool as T<sub>k</sub> = c/log(k+2), with c at least the deepest barrier (Geman &amp; Geman 1984) — and it is useless in practice: the deepest barrier here is 4, so that schedule needs ~3,000 steps just to reach T = 0.5 (twelve times this game’s entire 240-step budget) and ~500 million to reach T = 0.2. It converges precisely because it refuses to cool. And the Salt Flat is the counter-example on purpose: <strong>no search method beats any other averaged over all possible landscapes</strong> (No Free Lunch — Wolpert &amp; Macready 1997). Methods win by exploiting structure. Where there is none, nothing helps.',
    // Landscapes verified offline: every global minimum unique; pass marks set
    // below the best schedule found by search, above what crash-cooling scores.
    LV: [
      { n: 'The First Ditch', h: [8,6,4,2,3,4,5,4,3,2,1,0,1,2,3], start: 0, T0: 2.0, bar: 0.50, best: 0.71, gmin: 11,
        note: 'One shallow ditch on the way down, one true floor beyond it. Cool too fast and you will spend the rest of the run in the ditch — that is not a metaphor, it happens in 88% of runs, measured.' },
      { n: 'The Twin Calderas', h: [7,5,3,1,2,3,4,5,4,3,2,1,0,1,2,3,5], start: 0, T0: 2.5, bar: 0.40, best: 0.55, gmin: 12,
        note: 'Two deep basins, and the first one you fall into is the wrong one. The ridge between them is four units tall — the walker can only cross it while it is hot enough to accept climbing.' },
      { n: 'The Comb', h: [8,7,8,6,7,5,6,4,5,3,4,2,3,1,2,0,2], start: 0, T0: 2.0, bar: 0.50, best: 0.66, gmin: 15,
        note: 'Seven little traps, every one only a single unit deep. No single trap is dangerous. Being cold near any of them is — crash-cooling ends the run stuck in one of them 98% of the time, and rarely the first.' },
      { n: 'The Salt Flat', h: [5,5,5,5,5,5,5,5,5,5,5,5,5,5,0,5,5,5,5,5,5,5,5], start: 0, T0: 2.0, bar: 0.50, best: 0.69, gmin: 14,
        flat: true,
        note: 'A dead flat plain with one hole in it. Out on the plain every move costs exactly nothing, so temperature <em>provably</em> cannot change your odds of stumbling onto the hole. It only decides whether you stay once you fall in — which is why crash-cooling, the worst play on every other volcano, is the best play here. This level is built to humble the method.' },
      { n: 'The Long Descent', h: [9,7,5,3,4,5,6,5,4,2,3,4,3,2,1,0,1,2], start: 0, T0: 3.0, bar: 0.40, best: 0.55, gmin: 15,
        note: 'Two traps, then the floor. Survive the first ridge and the second will take you if you have already gone cold. Shape the whole descent, not just the start.' }
    ],
    COOL: 0.60, HOLD: 1.00, STOKE: 1.70, TMIN: 0.02, TMAX: 8.0, EPOCH: 20, EPOCHS: 12, REPLAYS: 500,

    mount: function (root, opts) {
      var g = this, mission = opts && opts.mode === 'mission';
      root.innerHTML =
        '<div class="holes" data-r="chips"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<div class="vwrap">' +
          '<svg class="vterrain" viewBox="0 0 320 190" xmlns="' + NS + '" aria-label="The volcano landscape — height is energy, the walker seeks the lowest point"></svg>' +
          '<div class="vtherm"><div class="vtherm-fill" data-r="tfill"></div><span class="vtherm-lbl" data-r="tlbl">T</span></div>' +
        '</div>' +
        '<p class="legend" style="text-align:center"><span style="color:var(--yellow)">● the walker</span> · <span style="color:var(--teal)">▼ the true floor</span> · faint marks are cells it has already visited this run.</p>' +
        '<div class="vsched" data-r="sched" aria-label="your cooling schedule"></div>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset vbtn" data-a="stoke" title="T x1.7 — let it climb">Stoke ▲</button>' +
          '<button class="preset vbtn" data-a="hold" title="T unchanged">Hold ═</button>' +
          '<button class="preset vbtn" data-a="cool" title="T x0.6 — start locking it down">Cool ▼</button>' +
          '<button class="preset" data-a="reset">New run</button>' +
        '</p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '.vterrain'), li = 0, cleared = [], st = null;

      function fresh() {
        var L = g.LV[li];
        st = { x: L.start, T: L.T0, e: 0, sched: [], seen: {}, best: L.h[L.start], over: false, rate: null };
        st.seen[L.start] = 1;
      }
      function acc(dE, T) { return dE <= 0 ? 1 : Math.exp(-dE / T); }

      // one epoch of EPOCH proposals at temperature T — the whole engine
      function epoch(h, x, T, seen) {
        for (var i = 0; i < g.EPOCH; i++) {
          var y = x + (Math.random() < 0.5 ? 1 : -1);
          if (y < 0 || y >= h.length) continue;          // out of range: reject, stay put
          var dE = h[y] - h[x];
          if (dE <= 0 || Math.random() < Math.exp(-dE / T)) { x = y; if (seen) seen[x] = (seen[x] || 0) + 1; }
        }
        return x;
      }
      // replay a schedule from scratch — used for the 500-run honesty check
      function replay(L, sched) {
        var x = L.start, T = L.T0;
        for (var i = 0; i < sched.length; i++) {
          T = Math.min(g.TMAX, Math.max(g.TMIN, T * sched[i]));
          x = epoch(L.h, x, T, null);
        }
        return x;
      }
      function scheduleRate(L, sched) {
        var w = 0;
        for (var i = 0; i < g.REPLAYS; i++) if (L.h[replay(L, sched)] === L.h[L.gmin]) w++;
        return w / g.REPLAYS;
      }

      function geom(L) {
        var n = L.h.length, mx = Math.max.apply(null, L.h), w = 300 / n;
        return { n: n, w: w, mx: mx,
          x: function (i) { return 10 + (i + 0.5) * w; },
          y: function (i) { return 24 + (1 - L.h[i] / mx) * 118; } };
      }

      function drawTerrain() {
        var L = g.LV[li], gm = geom(L), i;
        svg.innerHTML = '';
        var defs = el('defs', {}), grad = el('linearGradient', { id: 'vgrad', x1: '0', y1: '0', x2: '0', y2: '1' });
        grad.appendChild(el('stop', { offset: '0', 'stop-color': 'var(--violet)', 'stop-opacity': '.22' }));
        grad.appendChild(el('stop', { offset: '1', 'stop-color': 'var(--teal)', 'stop-opacity': '.10' }));
        defs.appendChild(grad); svg.appendChild(defs);

        var d = '';
        for (i = 0; i < gm.n; i++) d += (i ? 'L' : 'M') + gm.x(i).toFixed(1) + ' ' + gm.y(i).toFixed(1);
        svg.appendChild(el('path', { 'class': 'vfill', d: d + 'L' + gm.x(gm.n - 1).toFixed(1) + ' 176L' + gm.x(0).toFixed(1) + ' 176Z', fill: 'url(#vgrad)' }));
        svg.appendChild(el('path', { 'class': 'vline', d: d }));

        // the floor, marked — the landscape is fully visible, nothing is hidden
        var fx = gm.x(L.gmin), fy = gm.y(L.gmin);
        svg.appendChild(el('path', { 'class': 'vgoal', d: 'M' + (fx - 5) + ' ' + (fy + 12) + 'L' + (fx + 5) + ' ' + (fy + 12) + 'L' + fx + ' ' + (fy + 4) + 'Z' }));

        // cells already visited this run
        for (i = 0; i < gm.n; i++) {
          if (!st.seen[i]) continue;
          var op = Math.min(0.5, 0.10 + st.seen[i] * 0.045);
          svg.appendChild(el('circle', { 'class': 'vseen', cx: gm.x(i).toFixed(1), cy: gm.y(i).toFixed(1), r: 3, opacity: op.toFixed(2) }));
        }

        var w = el('g', { 'class': 'vwalker' });
        w.appendChild(el('circle', { 'class': 'vhalo', cx: 0, cy: 0, r: 11 }));
        w.appendChild(el('circle', { 'class': 'vcore', cx: 0, cy: 0, r: 5.5 }));
        w.setAttribute('transform', 'translate(' + gm.x(st.x).toFixed(1) + ' ' + (gm.y(st.x) - 8).toFixed(1) + ')');
        svg.appendChild(w);
      }

      function drawChips() {
        $(root, '[data-r=chips]').innerHTML = g.LV.map(function (L, i) {
          return '<span class="hole' + (i === li ? ' now' : '') + (cleared[i] ? ' done' : '') + '" data-l="' + i +
                 '" title="' + L.n + '">' + (i + 1) + '</span>';
        }).join('');
        Array.prototype.forEach.call(root.querySelectorAll('[data-r=chips] .hole'), function (c) {
          c.addEventListener('click', function () { li = +c.getAttribute('data-l'); fresh(); render(); });
        });
      }

      function drawSched() {
        var out = '';
        for (var i = 0; i < g.EPOCHS; i++) {
          var m = st.sched[i], k = m === g.COOL ? 'c' : m === g.STOKE ? 's' : m === g.HOLD ? 'h' : '';
          var t = m === g.COOL ? '▼' : m === g.STOKE ? '▲' : m === g.HOLD ? '═' : (i + 1);
          out += '<span class="vslot ' + k + (i === st.e && !st.over ? ' now' : '') + '">' + t + '</span>';
        }
        $(root, '[data-r=sched]').innerHTML = out;
      }

      function drawTherm() {
        var pct = Math.max(2, Math.min(100, (st.T / 6) * 100));
        $(root, '[data-r=tfill]').style.height = pct.toFixed(0) + '%';
        $(root, '[data-r=tlbl]').textContent = 'T ' + st.T.toFixed(2);
        var f = $(root, '[data-r=tfill]');
        f.className = 'vtherm-fill ' + (st.T >= 2 ? 'hot' : st.T >= 0.6 ? 'warm' : 'cold');
      }

      function verdict(msg) {
        var L = g.LV[li], p = $(root, '[data-r=say]');
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; return; }
        p.className = 'verdict';
        p.innerHTML = '<strong>' + L.n + '.</strong> Twelve choices, twenty steps each. End <em>standing on</em> the floor — finding it is not keeping it. ' +
          '<span style="color:var(--muted)">Pass mark: a schedule that wins <strong>' + Math.round(L.bar * 100) + '%</strong> of the time.</span>';
      }

      function rows() {
        var L = g.LV[li];
        var here = L.h[st.x], floor = L.h[L.gmin];
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Epoch</dt><dd>' + Math.min(st.e, g.EPOCHS) + ' of ' + g.EPOCHS + ' &nbsp;<span style="color:var(--muted)">(' + (g.EPOCHS - Math.min(st.e, g.EPOCHS)) * g.EPOCH + ' steps left)</span></dd>' +
          '<dt>Temperature</dt><dd>' + st.T.toFixed(2) + ' &nbsp;<span style="color:var(--muted)">' +
            (st.T >= 2 ? 'molten — it will climb almost anything' : st.T >= 0.6 ? 'warm — small climbs only' : 'frozen — downhill or nothing') + '</span></dd>' +
          '<dt>Standing on</dt><dd>depth ' + here + (here === floor ? ' — <strong style="color:var(--teal)">the floor</strong>' : '') + '</dd>' +
          '<dt>Deepest touched</dt><dd>depth ' + st.best + (st.best === floor && here !== floor ? ' <span style="color:var(--yellow)">— you were there and left</span>' : '') + '</dd>' +
          (st.rate == null ? '' :
            '<dt>Your schedule</dt><dd>wins <strong>' + Math.round(st.rate * 100) + '%</strong> of the time ' +
            '<span style="color:var(--muted)">(replayed ' + g.REPLAYS + '×; pass mark ' + Math.round(L.bar * 100) + '%, best we found ' + Math.round(L.best * 100) + '%)</span></dd>');
      }

      function render(msg) {
        drawChips(); drawTerrain(); drawSched(); drawTherm(); verdict(msg); rows();
        /* OUTBOUND ONLY — see Grover's emitter. Act IV's scene draws the
           landscape ITSELF from `heights`, so the ridge line on screen is the
           very array this sampler is walking. Nothing here reads back, and no
           replay, pass mark or acceptance test consults a listener. */
        if (opts && typeof opts.onState === 'function') {
          var L = g.LV[li];
          try {
            opts.onState({ phase: st.over ? 'finished' : 'render',
                           li: li, name: L.n, heights: L.h.slice(), gmin: L.gmin,
                           x: st.x, pos: st.x / Math.max(1, L.h.length - 1),
                           T: st.T, Tnorm: Math.max(0, Math.min(1, st.T / 4)),
                           epoch: Math.min(st.e, g.EPOCHS), epochs: g.EPOCHS,
                           here: L.h[st.x], floor: L.h[L.gmin], best: st.best,
                           onFloor: L.h[st.x] === L.h[L.gmin],
                           rate: st.rate, bar: L.bar, over: st.over,
                           cleared: cleared.filter(Boolean).length, total: g.LV.length });
          } catch (e) {}
        }
      }

      function step(mult) {
        if (st.over) return;
        var L = g.LV[li];
        st.T = Math.min(g.TMAX, Math.max(g.TMIN, st.T * mult));
        st.sched.push(mult);
        st.x = epoch(L.h, st.x, st.T, st.seen);
        if (L.h[st.x] < st.best) st.best = L.h[st.x];
        st.e++;
        if (st.e >= g.EPOCHS) return finish();
        render();
      }

      function finish() {
        var L = g.LV[li], floor = L.h[L.gmin], frozeRight = L.h[st.x] === floor;
        st.over = true;
        st.rate = scheduleRate(L, st.sched);           // 500 honest replays of YOUR schedule
        var passed = st.rate >= L.bar;
        if (passed && !cleared[li]) cleared[li] = true;

        var runLine = frozeRight
          ? '<strong>You froze on the floor.</strong> '
          : (st.best === floor
              ? '<strong>You reached the floor and drifted off it.</strong> Still too hot at the end. '
              : '<strong>You froze at depth ' + L.h[st.x] + '</strong> — ' + (L.h[st.x] > floor ? 'a trap, not the floor. ' : ''));
        var judge = passed
          ? 'And it was not luck: replayed ' + g.REPLAYS + ' times, this schedule wins <strong>' + Math.round(st.rate * 100) + '%</strong> of the time — past the ' + Math.round(L.bar * 100) + '% mark. <strong>Pass.</strong>'
          : 'Replayed ' + g.REPLAYS + ' times, this schedule wins only <strong>' + Math.round(st.rate * 100) + '%</strong> of the time' +
            (frozeRight ? ' — so that run was luck. ' : '. ') + 'The mark is ' + Math.round(L.bar * 100) + '%.';

        var hint = '';
        if (!passed) {
          var allCool = st.sched.every(function (m) { return m === g.COOL; });
          var noCool = st.sched.every(function (m) { return m !== g.COOL; });
          if (allCool && !L.flat) hint = ' <span style="color:var(--muted)">You cooled from the first move, so the walker could never accept a single uphill step. It went downhill until it could not, and stopped.</span>';
          else if (noCool) hint = ' <span style="color:var(--muted)">You never went cold, so nothing ever settled — the walker was still wandering when the run ended. Heat finds; cold keeps.</span>';
          else hint = ' <span style="color:var(--muted)">Try holding the heat while it crosses the ridges, then cooling hard over the last few epochs.</span>';
        }

        if (passed && li === 1) win('volcano', opts);   // the Twin Calderas is the mission
        render({ k: passed ? 'good' : (frozeRight ? 'split' : 'bad'), t: runLine + judge + hint });
        if (passed && L.flat) {
          $(root, '[data-r=say]').innerHTML += '<br><span style="color:var(--muted)">Notice what just happened: on this level even <em>cooling instantly</em> passes. ' +
            'The plain is flat, so every step is accepted at any temperature — your control did nothing until the walker stumbled into the hole. That is <strong>No Free Lunch</strong>, felt rather than stated.</span>';
        }
      }

      Array.prototype.forEach.call(root.querySelectorAll('.vbtn'), function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-a');
          step(a === 'cool' ? g.COOL : a === 'stoke' ? g.STOKE : g.HOLD);
        });
      });
      $(root, '[data-a=reset]').addEventListener('click', function () { fresh(); render(); });

      fresh(); render();
    }
  };

  /* ==================================================================== *
   *  CIRCUIT GOLF — Ada's mission                                        *
   *  Six real 2x2 unitaries; pars are PROVEN MINIMA (breadth-first over  *
   *  all gate words, re-checked exhaustively at every shorter length).   *
   * ==================================================================== */
  G.golf = {
    id: 'golf', title: 'Circuit Golf', mentor: 'Ada',
    hook: 'Golf, but the ball is a qubit and every club is a rotation.',
    about: {
      goal: 'Turn a qubit from <span class="ket">|0⟩</span> into a given target state in as few gates as you can.',
      how: 'Tap gates to rotate the qubit until your <span style="color:var(--teal)">solid arrow</span> lands on the <span style="color:var(--violet)">dashed target</span>. <strong>Par is a proven minimum</strong> — no shorter route exists anywhere.',
      inspired: 'The Bloch sphere and the real one-qubit gate set — X, Y, Z, H, S, T — that every quantum program is built from.',
      learn: 'Superposition and phase, and why quantum gates are <em>rotations</em> rather than 0-to-1 flips.',
      link: 'quantum-mechanics.html#bloch', linkText: 'See the sphere ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: the six gates are the real 2×2 unitaries and the sphere is a projection of the actual complex arithmetic — the same engine as <a href="quantum-mechanics.html#bloch">the Bloch sphere explorer</a>. Par values were computed by breadth-first search over all gate words and independently re-checked by exhaustive search at every shorter length, so each is a <strong>proven minimum</strong> rather than a designer’s guess. States are compared by Bloch vector, which ignores global phase — as physics does, since global phase is unobservable.',
    mount: function (root, opts) {
      // In-world voice. Display strings only — never logic, so the Path and the
      // Arcade run the identical engine and only the words differ.
      var mission = opts && opts.mode === 'mission';
      var VO = mission ? {
        unit: 'Door', unitLow: 'door', turn: 'turn', turns: 'turns',
        ask: function (n, name, par) { return 'Door ' + n + ' — the coin must read <strong>' + name +
          '</strong>. It takes <strong>' + par + '</strong> ' + (par === 1 ? 'turn' : 'turns') + '.'; },
        par: 'The door opens. Nothing shorter exists — Ada proved that.',
        over: function (n, par) { return 'It opens, but you took ' + n + ' turns where ' + par + ' would do.'; },
        lost: 'You are forcing it. <strong>Steady the coin</strong> and turn again.',
        rowA: 'This door', rowB: 'Doors opened', rowC: 'Turns',
        allDone: 'every door, the short way'
      } : {
        unit: 'Hole', unitLow: 'hole', turn: 'gate', turns: 'gates',
        ask: function (n, name, par) { return 'Hole ' + n + ' — reach <strong>' + name +
          '</strong> in <strong>' + par + '</strong> ' + (par === 1 ? 'gate' : 'gates') + '.'; },
        par: 'Par. Proven optimal — nothing shorter exists.',
        over: function (n, par) { return n + ' gates against par ' + par + '. There is a shorter route.'; },
        lost: 'Well over par. <strong>Retry hole</strong> to reset — or keep going.',
        rowA: 'This hole', rowB: 'Holes done', rowC: 'Total',
        allDone: 'perfect round'
      };
      root.innerHTML =
        '<div class="holes" data-r="holes"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<svg class="golfsvg" viewBox="0 0 260 250" xmlns="' + NS + '" aria-label="Bloch sphere: your state against the target"></svg>' +
        '<p class="legend" style="text-align:center"><span style="color:var(--teal)">━ solid teal = you</span> · <span style="color:var(--violet)">┅ dashed violet = the target</span></p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          ['X','Y','Z','H','S','T'].map(function (k) { return '<button class="preset gatebtn" data-g="' + k + '">' + k + '</button>'; }).join('') +
          '<button class="preset" data-a="undo">Undo</button><button class="preset" data-a="retry">Retry hole</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '.golfsvg'), R = 82, CX = 130, CY = 118;
      var S2 = 1 / Math.sqrt(2), C4 = Math.cos(Math.PI / 4), S4 = Math.sin(Math.PI / 4);
      function cm(p, q) { return [p[0]*q[0] - p[1]*q[1], p[0]*q[1] + p[1]*q[0]]; }
      function cadd(p, q) { return [p[0]+q[0], p[1]+q[1]]; }
      var GT = {
        X: [[0,0],[1,0],[1,0],[0,0]], Y: [[0,0],[0,-1],[0,1],[0,0]], Z: [[1,0],[0,0],[0,0],[-1,0]],
        H: [[S2,0],[S2,0],[S2,0],[-S2,0]], S: [[1,0],[0,0],[0,0],[0,1]], T: [[1,0],[0,0],[0,0],[C4,S4]]
      };
      function ap(g, s) { var m = GT[g]; return [cadd(cm(m[0],s[0]),cm(m[1],s[1])), cadd(cm(m[2],s[0]),cm(m[3],s[1]))]; }
      function bloch(s) {
        var a = s[0], b = s[1], acb = cm([a[0], -a[1]], b);
        return [2*acb[0], 2*acb[1], (a[0]*a[0]+a[1]*a[1]) - (b[0]*b[0]+b[1]*b[1])];
      }
      var Z0 = [[1,0],[0,0]];
      function seq(l) { var s = Z0; l.forEach(function (g) { s = ap(g, s); }); return s; }
      var HOLES = [
        { name: '|1⟩',        path: ['X'],         par: 1, hint: 'The bit flip.' },
        { name: '|+⟩',        path: ['H'],         par: 1, hint: 'An even superposition of 0 and 1.' },
        { name: '|−⟩',        path: ['X','H'],     par: 2, hint: 'Like |+⟩, but the two halves carry opposite sign.' },
        { name: '|i⟩',        path: ['H','S'],     par: 2, hint: 'On the equator, a quarter turn round from |+⟩.' },
        { name: 'T|+⟩',       path: ['H','T'],     par: 2, hint: 'Halfway between |+⟩ and |i⟩.' },
        { name: '|−i⟩',       path: ['X','H','S'], par: 3, hint: 'Opposite |i⟩. Two gates will not reach it — that is proven.' },
        { name: 'Z|+⟩ again', path: ['H','Z'],     par: 2, hint: 'Z does nothing to |0⟩ — so lead with something else.' },
        { name: 'S H |1⟩',    path: ['X','H','S'], par: 3, hint: 'Same place as hole 6. Try a different route.' },
        { name: 'T T H |0⟩',  path: ['H','S'],     par: 2, hint: 'Two T gates equal one S. Find the short way.' }
      ];
      /* `done` MUST be pre-filled to full length. It used to start as [] and be
         written sparsely, so after clearing hole 1 it had length 1 -- and the
         auto-advance below, which does done.findIndex(d == null && i > hi),
         could only ever scan index 0. It therefore found nothing and silently
         left you sitting on the hole you had just finished, forever. Shipped
         that way since the game was built; found 2026-08-02 by driving the
         engine from Act I's dial, where nobody clicks a hole chip by hand.
         Pars, scoring and physics are untouched by this -- it only fixes which
         hole you are standing on. */
      var hi = 0, cur = Z0, moves = [], strokes = 0, done = [];
      for (var _h = 0; _h < HOLES.length; _h++) done.push(null);
      var AZ = -35 * Math.PI / 180, EL = 18 * Math.PI / 180;
      function proj(v) {
        return [CX + R * (-v[0]*Math.sin(AZ) + v[1]*Math.cos(AZ)),
                CY + R * (v[0]*Math.cos(AZ)*Math.sin(EL) + v[1]*Math.sin(AZ)*Math.sin(EL) - v[2]*Math.cos(EL))];
      }
      function add(t, a, txt) { var n = el(t, a); if (txt != null) n.textContent = txt; svg.appendChild(n); return n; }
      add('circle', { 'class': 'gsphere', cx: CX, cy: CY, r: R });
      var eq = '';
      for (var i = 0; i <= 64; i++) { var t = i/64*2*Math.PI, p = proj([Math.cos(t), Math.sin(t), 0]); eq += (i?'L':'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
      add('path', { 'class': 'gequator', d: eq });
      [[[0,0,1],'|0⟩'],[[0,0,-1],'|1⟩'],[[1,0,0],'|+⟩'],[[0,1,0],'|i⟩']].forEach(function (ax) {
        var p = proj(ax[0]), o = proj([0,0,0]);
        add('line', { 'class': 'gaxis', x1: o[0], y1: o[1], x2: p[0], y2: p[1] });
        add('text', { 'class': 'gaxlab', x: p[0], y: p[1] + (ax[0][2] > 0 ? -7 : 13) }, ax[1]);
      });
      var tLine = add('line', { 'class': 'gtarget', x1: CX, y1: CY, x2: CX, y2: CY });
      var tDot  = add('circle', { 'class': 'gtargetdot', cx: CX, cy: CY, r: 4.5 });
      var vLine = add('line', { 'class': 'gvec', x1: CX, y1: CY, x2: CX, y2: CY - R });
      var vDot  = add('circle', { 'class': 'gdot', cx: CX, cy: CY - R, r: 5 });
      function same(a, b) { for (var i = 0; i < 3; i++) if (Math.abs(a[i]-b[i]) > 1e-9) return false; return true; }

      function render(msg) {
        var H = HOLES[hi], tgt = bloch(seq(H.path)), me = bloch(cur);
        var pt = proj(tgt), pm = proj(me);
        tLine.setAttribute('x2', pt[0]); tLine.setAttribute('y2', pt[1]);
        tDot.setAttribute('cx', pt[0]); tDot.setAttribute('cy', pt[1]);
        vLine.setAttribute('x2', pm[0]); vLine.setAttribute('y2', pm[1]);
        vDot.setAttribute('cx', pm[0]); vDot.setAttribute('cy', pm[1]);
        $(root, '[data-r=holes]').innerHTML = HOLES.map(function (h, i) {
          return '<span class="hole' + (i === hi ? ' now' : '') + (done[i] != null ? (done[i] <= h.par ? ' done' : ' over') : '') +
                 '" data-h="' + i + '" title="' + VO.unit + ' ' + (i+1) + ' — par ' + h.par + '">' + (i+1) + '</span>';
        }).join('');
        Array.prototype.forEach.call(root.querySelectorAll('[data-r=holes] .hole'), function (b) {
          b.addEventListener('click', function () { hi = +b.getAttribute('data-h'); cur = Z0; moves = []; render(); });
        });
        var p = $(root, '[data-r=say]'), hit = same(me, tgt);
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; }
        else if (hit && moves.length) { p.className = 'verdict good'; p.innerHTML = 'Reached <strong>' + H.name + '</strong>.'; }
        else { p.className = 'verdict'; p.innerHTML = VO.ask(hi+1, H.name, H.par) + ' <span style="color:var(--muted);font-weight:400">' + H.hint + '</span>'; }
        var totPar = HOLES.reduce(function (a, h) { return a + h.par; }, 0);
        var played = done.filter(function (d) { return d != null; }).length;
        if (played === HOLES.length) win('golf', opts);
        $(root, '[data-r=rows]').innerHTML =
          '<dt>' + VO.rowA + '</dt><dd>' + moves.length + ' / par ' + H.par + (moves.length ? ' &nbsp;<span class="chip">' + moves.join('</span><span class="chip">') + '</span>' : '') + '</dd>' +
          '<dt>' + VO.rowB + '</dt><dd>' + played + ' of ' + HOLES.length + '</dd>' +
          '<dt>' + VO.rowC + '</dt><dd>' + strokes + ' ' + VO.turns + ', par ' + totPar +
            (played === HOLES.length ? (strokes === totPar ? ' — <strong style="color:var(--teal)">' + VO.allDone + '</strong>' : ' — ' + (strokes - totPar) + ' over') : '') + '</dd>';
        /* OUTBOUND ONLY — see the note on Grover's emitter. Act I's scene needs
           to know which door is open and whether it was opened at par; it never
           writes back, and no par, stroke or scoring path reads a listener. */
        if (opts && typeof opts.onState === 'function') {
          try {
            opts.onState({ phase: 'render', hi: hi, name: H.name, hint: H.hint, par: H.par,
                           moves: moves.length, route: moves.slice(), strokes: strokes,
                           played: played, total: HOLES.length,
                           holeDone: done[hi] != null, holeScore: done[hi] });
          } catch (e) {}
        }
      }
      function play(g) {
        var H = HOLES[hi];
        if (done[hi] != null) return;
        cur = ap(g, cur); moves.push(g);
        if (same(bloch(cur), bloch(seq(H.path)))) {
          done[hi] = moves.length; strokes += moves.length;
          var par = moves.length === H.par;
          render({ k: par ? 'good' : 'split', t: '<strong>' + H.name + ' reached.</strong> ' +
            (par ? VO.par : VO.over(moves.length, H.par)) });
          var nxt = done.findIndex(function (d, i) { return d == null && i > hi; });
          if (nxt < 0) nxt = done.findIndex(function (d) { return d == null; });
          if (nxt >= 0) setTimeout(function () { hi = nxt; cur = Z0; moves = []; render(); }, 1400);
        } else if (moves.length >= H.par + 4) {
          render({ k: 'bad', t: VO.lost });
        } else render();
      }
      Array.prototype.forEach.call(root.querySelectorAll('.gatebtn'), function (b) {
        b.addEventListener('click', function () { play(b.getAttribute('data-g')); });
      });
      $(root, '[data-a=undo]').addEventListener('click', function () {
        if (!moves.length || done[hi] != null) return;
        moves.pop(); cur = seq(moves); render();
      });
      $(root, '[data-a=retry]').addEventListener('click', function () {
        if (done[hi] != null) { strokes -= done[hi]; done[hi] = null; }
        cur = Z0; moves = []; render();
      });
      render();
    }
  };

  /* ==================================================================== *
   *  GROVER'S ESCAPE — Rue's mission                                     *
   *  Exit probability is exactly sin^2((2k+1)theta), sin theta = 1/sqrt(N)*
   * ==================================================================== */
  G.grover = {
    id: 'grover', title: "Grover's Escape", mentor: 'Rue',
    hook: 'A vault of identical doors, one exit — and a way to find it in far fewer tries than knocking.',
    about: {
      goal: 'Measure the exit using about <strong>√N</strong> tries, where knocking door-to-door needs roughly half of all N.',
      how: 'Hit <strong>Amplify</strong> to pump the exit’s odds up its bar, then <strong>Measure</strong> at the peak. Amplify too many times and you overshoot — the odds fall back down.',
      inspired: "Grover's search algorithm (1996) — after Shor's, the most famous quantum speedup there is.",
      learn: 'Why quantum search is <em>quadratically</em> faster — √N, not exponential — and that a measurement is a dice-roll you can load but never force.',
      link: 'ai.html', linkText: 'Where speedups help ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: this is real Grover search. Every door starts with amplitude 1/√N; one amplification is the exact oracle-then-diffusion step, which rotates the state by a fixed angle in the plane spanned by “exit” versus “everything else”. After <em>k</em> steps the exit’s probability is exactly <strong>sin²((2k+1)θ)</strong> with sin θ = 1/√N — so it climbs to a peak near <em>k</em> ≈ (π/4)√N and then <strong>falls</strong>, which is exactly why over-amplifying loses. The speedup is <strong>quadratic, not exponential</strong> — √N versus N — and Grover is <strong>⟦proven⟧</strong> optimal for unstructured search (Grover 1996; Bennett, Bernstein, Brassard &amp; Vazirani 1997). Measurement here is a genuine weighted draw over the bars, so even a perfect peak is a gamble — that is the physics, not the game.',
    mount: function (root, opts) {
      // Display-only voice layer (see Circuit Golf). Rue's fixation is timing:
      // the arcade says "par", the corridor says "the moment to look".
      var mission = opts && opts.mode === 'mission';
      var VO = mission ? {
        ask: function (n, par) { return '<strong>' + n + ' doors</strong>, one way out. Tilt the odds toward it — about <strong>' +
          par + '</strong> ' + (par === 1 ? 'pass' : 'passes') + ' — then look <em>once</em>.'; },
        peak: 'Out. You looked at exactly the right moment — that is the whole trick.',
        early: function (par) { return 'Out, but you looked early (the moment is ' + par + '). The draw was kind.'; },
        late: 'Out — though you kept tilting past the moment. The draw covered for you.',
        rowCleared: 'Corridors behind you'
      } : {
        ask: function (n, par) { return '<strong>' + n + ' doors.</strong> Amplify toward the peak (about <strong>' +
          par + '</strong> ' + (par === 1 ? 'round' : 'rounds') + '), then measure.'; },
        peak: 'Measured right at the <strong>peak</strong> — par.',
        early: function (par) { return 'Measured <strong>early</strong> (par is ' + par + '), but the draw went your way.'; },
        late: 'You <strong>over-amplified</strong> past the peak, yet the draw still landed home.',
        rowCleared: 'Corridors cleared'
      };
      root.innerHTML =
        '<div class="holes" data-r="corr"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<div class="gr-bars" data-r="bars" aria-label="Probability of each door being the exit"></div>' +
        '<p class="legend" style="text-align:center"><span style="color:var(--teal)">▮ the exit’s odds</span> · <span style="color:var(--muted)">▮ every other door</span> — bar height is the chance a measurement lands there.</p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset" data-a="amp">Amplify ↑</button>' +
          '<button class="preset" data-a="measure">Measure</button>' +
          '<button class="preset" data-a="reset">Reset corridor</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var barsEl = $(root, '[data-r=bars]');
      var CORR = [{n:4,par:1},{n:8,par:2},{n:16,par:3},{n:32,par:4},{n:64,par:6}];
      var ci = 0, k = 0, mark = 0, measured = false, busy = false, bestP = 0, solved = [];

      /* OUTBOUND ONLY. A narrative layer (scene.js / missions.js) needs to know
         when the player is standing on the peak so Rue can be wrong out loud.
         This pushes a snapshot out; nothing here ever reads anything back, and
         no engine, threshold or scoring path consults a listener. Same contract
         as onWin, and the same rule as the display-only `mode` flag above. */
      function emit(phase, extra) {
        if (!opts || typeof opts.onState !== 'function') return;
        var n = CORR[ci].n, par = CORR[ci].par;
        var s = { phase: phase, n: n, k: k, par: par, p: pExit(n, k), best: bestP,
                  level: ci, levels: CORR.length, measured: measured, busy: busy,
                  cleared: solved.filter(function (x) { return x != null; }).length };
        if (extra) for (var key in extra) if (extra.hasOwnProperty(key)) s[key] = extra[key];
        try { opts.onState(s); } catch (e) {}
      }
      function theta(n) { return Math.asin(1 / Math.sqrt(n)); }
      function pExit(n, kk) { var s = Math.sin((2*kk + 1) * theta(n)); return s * s; }
      function fresh() { k = 0; measured = false; bestP = pExit(CORR[ci].n, 0); mark = Math.floor(Math.random() * CORR[ci].n); }
      function chips() {
        $(root, '[data-r=corr]').innerHTML = CORR.map(function (c, i) {
          return '<span class="hole' + (i === ci ? ' now' : '') + (solved[i] != null ? ' done' : '') + '" data-c="' + i +
                 '" title="' + c.n + ' doors — par ' + c.par + '">' + c.n + '</span>';
        }).join('');
        Array.prototype.forEach.call(root.querySelectorAll('[data-r=corr] .hole'), function (h) {
          h.addEventListener('click', function () { if (busy) return; ci = +h.getAttribute('data-c'); fresh(); render(); });
        });
      }
      function bars() {
        var n = CORR[ci].n, pm = pExit(n, k), pu = (1 - pm) / (n - 1);
        barsEl.style.gap = (n > 32 ? 1 : n > 16 ? 2 : 3) + 'px';
        barsEl.innerHTML = '';
        for (var i = 0; i < n; i++) {
          var b = document.createElement('div');
          b.className = 'gr-bar' + (i === mark ? ' exit' : '');
          b.style.height = Math.max(2, (i === mark ? pm : pu) * 138).toFixed(1) + 'px';
          barsEl.appendChild(b);
        }
      }
      function rowsHTML() {
        var n = CORR[ci].n;
        return '<dt>Amplifications</dt><dd>' + k + ' &nbsp;<span style="color:var(--muted)">(par ' + CORR[ci].par + ' = the peak)</span></dd>' +
          '<dt>Exit odds now</dt><dd>' + (pExit(n,k)*100).toFixed(1) + '% &nbsp;<span style="color:var(--muted)">best this run ' + (bestP*100).toFixed(1) + '%</span></dd>' +
          '<dt>Classical vs you</dt><dd>~' + (n/2) + ' doors tried on average · you need √N ≈ ' + Math.round(Math.sqrt(n)) + '</dd>' +
          '<dt>' + VO.rowCleared + '</dt><dd>' + solved.filter(function (x) { return x != null; }).length + ' of ' + CORR.length + '</dd>';
      }
      function render(msg) {
        var n = CORR[ci].n, pm = pExit(n, k);
        if (pm > bestP) bestP = pm;
        chips(); bars();
        var p = $(root, '[data-r=say]');
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; }
        else {
          p.className = 'verdict';
          p.innerHTML = VO.ask(n, CORR[ci].par) + ' Exit odds now: <strong>' + Math.round(pm*100) + '%</strong>.';
        }
        $(root, '[data-r=rows]').innerHTML = rowsHTML();
        emit('render');
      }
      $(root, '[data-a=amp]').addEventListener('click', function () {
        if (busy || measured) return;
        var n = CORR[ci].n, par = CORR[ci].par;
        if (k >= par * 2 + 3) { render({ k: 'split', t: 'The odds just <strong>oscillate</strong> from here — that is Grover being a rotation, not a ratchet. <strong>Reset</strong> and stop at the peak.' }); return; }
        var pprev = pExit(n, k); k++;
        var pm = pExit(n, k);
        if (pm < pprev - 1e-9) render({ k: 'bad', t: 'Over the top — the exit’s odds <strong>fell</strong> from ' + Math.round(pprev*100) + '% to ' + Math.round(pm*100) + '%. You rotated past it.' });
        else render();
      });
      $(root, '[data-a=measure]').addEventListener('click', function () {
        if (busy || measured) return;
        var n = CORR[ci].n, pm = pExit(n, k), pu = (1 - pm) / (n - 1);
        var r = Math.random(), acc = 0, landed = n - 1;
        for (var i = 0; i < n; i++) { acc += (i === mark) ? pm : pu; if (r <= acc) { landed = i; break; } }
        busy = true;
        var allBars = barsEl.querySelectorAll('.gr-bar'), f = 0;
        var timer = setInterval(function () {
          Array.prototype.forEach.call(allBars, function (b) { b.classList.remove('flash'); });
          if (f < 9) { var j = Math.floor(Math.random() * n); if (allBars[j]) allBars[j].classList.add('flash'); f++; }
          else {
            clearInterval(timer);
            if (allBars[landed]) allBars[landed].classList.add(landed === mark ? 'hit' : 'miss');
            measured = true; busy = false; finish(landed);
          }
        }, 90);
      });
      function finish(landed) {
        var n = CORR[ci].n, par = CORR[ci].par, pm = pExit(n, k), p = $(root, '[data-r=say]');
        if (landed === mark) {
          win('grover', opts);
          if (solved[ci] == null || k === par) solved[ci] = k;
          p.className = 'verdict good';
          p.innerHTML = '<strong>Escaped.</strong> ' + (k === par ? VO.peak : k < par ? VO.early(par) : VO.late) +
            ' A classical searcher averages ~' + (n/2) + ' door' + (n/2 === 1 ? '' : 's') + '; you used <strong>' + k + '</strong>.';
        } else {
          p.className = 'verdict bad';
          p.innerHTML = '<strong>Wrong door.</strong> You measured with only <strong>' + Math.round(pm*100) + '%</strong> on the exit' +
            (k > par ? ' — you had rotated past the peak.' : k < par ? ' — amplify closer to the peak (par ' + par + ') first.'
             : ' — even at the peak it is a weighted draw. Unlucky roll.') + ' <strong>Reset corridor</strong> to try again.';
        }
        $(root, '[data-r=rows]').innerHTML = rowsHTML(); chips();
        emit('measured', { escaped: landed === mark, landed: landed, atPeak: k === par });
      }
      $(root, '[data-a=reset]').addEventListener('click', function () { if (busy) return; fresh(); render(); });
      fresh(); render();
    }
  };

  /* ==================================================================== *
   *  MAX-CUT / GRAPH CITY — Cordon's mission                             *
   *  Pars are PROVEN MAXIMA (brute force over all 2^n colourings).       *
   * ==================================================================== */
  G.maxcut = {
    id: 'maxcut', title: 'Max-Cut — the district split', mentor: 'Cordon',
    hook: 'Split a city in two so the fewest neighbours end up on the same side — the moment operations research and quantum become the same problem.',
    about: {
      goal: 'Colour every district one of two colours to satisfy the most roads — a road counts when its two ends differ. Par is the true maximum.',
      how: 'Click a district to flip its colour; <span style="color:var(--yellow)">bright roads</span> are satisfied, dim ones wasted. District 5 hides a trap where no single flip helps — that is the whole lesson.',
      inspired: "Max-Cut, one of Karp's original NP-hard problems (1972), and its Ising form (Lucas 2014) — the exact thing a quantum annealer or QAOA solves.",
      learn: 'How a hard optimisation problem becomes “find the Ising ground state”, and why local search gets stuck — the reason annealing exists.',
      link: 'ai.html', linkText: 'Quantum optimisation ▸', tier: '⟦Proven⟧',
      or: 'Max-Cut is a classic <b>operations research</b> problem — NP-hard since Karp 1972, and the reason the whole QUBO/Ising bridge exists.'
    },
    honest: 'Honest model: this is Max-Cut, and it is <strong>⟦proven⟧</strong> NP-hard (Karp 1972) — no efficient exact algorithm is known for the general case, which is why the pars here were found by brute force over all 2ⁿ colourings. The bridge to quantum is exact: label the colours ±1, and the satisfied-road count is Σ w<sub>ij</sub>(1−s<sub>i</sub>s<sub>j</sub>)/2, so <strong>maximising the cut is minimising the Ising energy</strong> Σ w<sub>ij</sub>s<sub>i</sub>s<sub>j</sub> — the ground state of an antiferromagnet. Every classic combinatorial problem (routing, scheduling, colouring) maps to this same Ising form (<strong>⟦proven⟧</strong> formulation, Lucas 2014), which is the whole reason quantum optimisation exists. The honest caveat: a quantum <em>advantage</em> on these problems is <strong>⟦heuristic⟧</strong> and unproven — classical solvers often match or beat today’s quantum ones. District 5 shows why the problem is hard even to approximate by hand: local search gets trapped.',
    mount: function (root, opts) {
      root.innerHTML =
        '<div class="holes" data-r="dist"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<svg class="mcsvg" viewBox="0 0 300 250" xmlns="' + NS + '" aria-label="A city graph — click a district to recolour it"></svg>' +
        '<p class="legend" style="text-align:center">Click a district to flip its colour · <span style="color:var(--yellow)">━ bright road = satisfied</span> · <span style="color:var(--muted)">┅ dim = wasted</span>.</p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset" data-a="invert">Invert all</button><button class="preset" data-a="reset">Reset district</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '.mcsvg');
      var DIST = [
        { n:3, E:[[0,1],[1,2],[2,0]], par:2, name:'the triangle',
          note:'An odd loop — you can never satisfy all three roads. Something must clash, and that unavoidable clash is called <em>frustration</em>. It is real physics, not a flaw in your play.' },
        { n:4, E:[[0,1],[1,2],[2,3],[3,0]], par:4, name:'the square',
          note:'An even loop: alternate the two colours and <strong>every</strong> road is satisfied.' },
        { n:5, E:[[0,1],[1,2],[2,3],[3,4],[4,0]], par:4, name:'the ring of five',
          note:'Odd again — four of five is the most any split can reach.' },
        { n:4, E:[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]], par:4, name:'the clique',
          note:'Every district borders every other. A 2–2 split satisfies four of the six roads.' },
        { n:6, E:[[4,5],[3,5],[0,5],[1,3],[2,4],[0,2]], par:6, name:'the trap', start:[0,0,1,1,0,1],
          note:'You begin at <strong>5 of 6</strong> — one road short. Try it: <strong>every single flip keeps you at 5 or drops you lower</strong>, yet 6 is reachable. Local search is stuck in a valley, and escaping needs two moves at once. This exact wall is what <strong>simulated annealing</strong> and <strong>QAOA</strong> are built to climb.' },
        { n:6, E:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]], par:7, name:'the prism',
          note:'Two triangles braced together. Seven of nine — find the split.' }
      ];
      var di = 0, color = [], solved = [];
      function initDist() {
        var d = DIST[di];
        color = d.start ? d.start.slice() : [];
        for (var i = 0; i < d.n; i++) if (color[i] == null) color[i] = 0;
      }
      function cutVal() { var c = 0; DIST[di].E.forEach(function (e) { if (color[e[0]] !== color[e[1]]) c++; }); return c; }
      function pos(n) {
        var cx = 150, cy = 123, r = n <= 3 ? 66 : 92, out = [];
        for (var i = 0; i < n; i++) { var a = -Math.PI/2 + i*2*Math.PI/n; out.push([cx + r*Math.cos(a), cy + r*Math.sin(a)]); }
        return out;
      }
      function chips() {
        $(root, '[data-r=dist]').innerHTML = DIST.map(function (d, i) {
          return '<span class="hole' + (i === di ? ' now' : '') + (solved[i] ? ' done' : '') + '" data-d="' + i +
                 '" title="District ' + (i+1) + ' — par ' + d.par + '">' + (i+1) + '</span>';
        }).join('');
        Array.prototype.forEach.call(root.querySelectorAll('[data-r=dist] .hole'), function (h) {
          h.addEventListener('click', function () { di = +h.getAttribute('data-d'); initDist(); render(); });
        });
      }
      function render(msg) {
        var d = DIST[di], P = pos(d.n);
        svg.innerHTML = '';
        d.E.forEach(function (e) {
          svg.appendChild(el('line', { 'class': 'mc-edge ' + (color[e[0]] !== color[e[1]] ? 'cut' : 'uncut'),
            x1: P[e[0]][0].toFixed(1), y1: P[e[0]][1].toFixed(1), x2: P[e[1]][0].toFixed(1), y2: P[e[1]][1].toFixed(1) }));
        });
        P.forEach(function (p, i) {
          var c = el('circle', { 'class': 'mc-node ' + (color[i] ? 'B' : 'A'), cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 15 });
          c.addEventListener('click', function () { color[i] = color[i] ? 0 : 1; render(); });
          svg.appendChild(c);
        });
        var cut = cutVal(), W = d.E.length, energy = W - 2*cut, groundE = W - 2*d.par;
        if (cut === d.par && !solved[di]) solved[di] = true;
        if (cut === d.par && di === 4) win('maxcut', opts);
        var p = $(root, '[data-r=say]');
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; }
        else if (cut === d.par) { p.className = 'verdict good'; p.innerHTML = '<strong>Maximum cut — ' + cut + '/' + d.par + '.</strong> This colouring is the Ising ground state (energy ' + groundE + '). ' + d.note; }
        else { p.className = 'verdict'; p.innerHTML = 'District ' + (di+1) + ' — <strong>' + d.name + '</strong>. Satisfy as many roads as you can (par <strong>' + d.par + '</strong>). <span style="color:var(--muted)">' + d.note + '</span>'; }
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Cut</dt><dd>' + cut + ' / ' + d.par + (cut === d.par ? ' — <strong style="color:var(--teal)">optimal</strong>' : '') + '</dd>' +
          '<dt>Ising energy</dt><dd>' + energy + ' <span style="color:var(--muted)">(ground state at ' + groundE + ')</span></dd>' +
          '<dt>Districts solved</dt><dd>' + solved.filter(Boolean).length + ' of ' + DIST.length + '</dd>';
        chips();
        /* OUTBOUND ONLY — see Grover's emitter. Act III's scene needs to know
           how far the border has been drawn and whether this district is one
           of the frustrated ones. It never writes back. */
        if (opts && typeof opts.onState === 'function') {
          try {
            opts.onState({ phase: 'render', di: di, name: d.name, n: d.n, roads: W,
                           cut: cut, par: d.par, optimal: cut === d.par,
                           energy: energy, groundE: groundE,
                           solved: solved.filter(Boolean).length, total: DIST.length });
          } catch (e) {}
        }
      }
      $(root, '[data-a=invert]').addEventListener('click', function () {
        for (var i = 0; i < DIST[di].n; i++) color[i] = color[i] ? 0 : 1;
        render({ k: 'split', t: '<strong>Same cut.</strong> Swapping every colour gives the identical partition — the two sides are interchangeable. That symmetry is why the Ising ground state always comes as a matched pair.' });
      });
      $(root, '[data-a=reset]').addEventListener('click', function () { initDist(); render(); });
      initDist(); render();
    }
  };

  /* ==================================================================== *
   *  QUANTUM TIC-TAC-TOE — Kai & Lyra's mission                          *
   *  Goff, Am. J. Phys. 74, 962 (2006). Collapse engine verified on      *
   *  4,000 random entanglement tangles.                                  *
   * ==================================================================== */
  G.qttt = {
    id: 'qttt', title: 'Quantum Tic-Tac-Toe', mentor: 'Kai & Lyra',
    hook: 'Tic-tac-toe, but every move lands in two squares at once — until reality is forced to pick one.',
    about: {
      goal: 'Get three <strong>real</strong> marks in a line, after the collapses shake out. Two players, one board.',
      how: 'Each turn, place your mark in <strong>two</strong> squares at once. When your moves close a loop, that tangle is <strong>measured</strong> and collapses — and your opponent chooses which way it falls.',
      inspired: 'Allan Goff’s <em>Quantum Tic-Tac-Toe</em> (<em>Am. J. Phys.</em> <strong>74</strong>, 962, 2006) — a real teaching game used in classrooms.',
      learn: 'Superposition, entanglement and measurement-collapse — as a faithful <em>analogy</em>, not a literal qubit simulation.',
      link: 'quantum-mechanics.html#chsh', linkText: 'Real entanglement ▸', tier: 'analogy'
    },
    honest: 'Honest model: this is Allan Goff’s Quantum Tic-Tac-Toe (<em>Am. J. Phys.</em> <strong>74</strong>, 962 (2006)), a teaching game — a faithful <em>analogy</em> for superposition, entanglement and measurement, not a simulation of a physical qubit system. What is genuinely quantum-like: marks exist in two places until measured, a closed loop of entanglement forces a measurement, and a collapse has exactly two consistent outcomes. What is stylised: the collapse is <em>chosen</em> by a player rather than drawn at random, which is a game-design decision Goff made to keep it strategic. The collapse engine here was verified on 4,000 randomly generated entanglement tangles — every one produced a valid assignment with two distinct outcomes.',
    mount: function (root, opts) {
      root.innerHTML =
        '<div class="turnbar"><span class="who X on" data-r="wx">X</span>' +
        '<span style="color:var(--muted);font-size:.85rem" data-r="phase">pick two squares</span>' +
        '<span class="who O" data-r="wo">O</span></div>' +
        '<div class="qboard">' +
          '<div class="qgrid" data-r="grid"></div>' +
          '<svg class="qthreads" data-r="threads" aria-hidden="true"></svg>' +
        '</div>' +
        '<p class="legend" style="text-align:center">Each <strong>thread</strong> ties the two squares one mark is living in. ' +
          'A thread is entanglement you can see — and when the threads close a <em>ring</em>, reality has to choose.</p>' +
        '<div class="verdict" style="text-align:center;margin-top:14px" data-r="say"></div>' +
        '<p style="margin:8px 0 4px;text-align:center">' +
          '<button class="preset" data-a="new">New game</button><button class="preset" data-a="rules">Rules</button></p>' +
        '<div data-r="rulesbox" style="display:none"></div>' +
        '<dl class="rows" data-r="rows"></dl>';

      var grid = $(root, '[data-r=grid]');
      var threads = $(root, '[data-r=threads]');
      var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      var moves, classical, turn, sel, moveNo, phase, pending, score;
      function reset() {
        moves = []; classical = {}; turn = 'X'; sel = []; moveNo = 1;
        phase = 'place'; pending = null; score = { X: 0, O: 0 };
        draw('Place a mark in <strong>two</strong> squares — it lives in both until a loop forces a measurement.');
      }
      function edgesOf() { return moves.map(function (m, i) { return [i, m.a, m.b]; }); }
      function findCycle(edges, u, v) {
        var adj = {};
        edges.forEach(function (e) {
          (adj[e[1]] = adj[e[1]] || []).push([e[0], e[2]]);
          (adj[e[2]] = adj[e[2]] || []).push([e[0], e[1]]);
        });
        var prev = {}; prev[u] = null; var q = [u], seen = {}; seen[u] = 1;
        while (q.length) {
          var x = q.shift();
          if (x === v) break;
          (adj[x] || []).forEach(function (p) { if (!seen[p[1]]) { seen[p[1]] = 1; prev[p[1]] = [x, p[0]]; q.push(p[1]); } });
        }
        if (!(v in prev)) return null;
        var path = [], c = v;
        while (c !== u) { var pr = prev[c]; path.push([pr[1], c]); c = pr[0]; }
        return path.reverse();
      }
      function collapse(choice) {
        var all = edgesOf(), nid = all.length - 1, nu = moves[nid].a, nv = moves[nid].b;
        var path = findCycle(all.filter(function (e) { return e[0] !== nid; }), nu, nv);
        if (!path) return null;
        var cycV = [nu].concat(path.map(function (p) { return p[1]; }));
        var cycE = path.map(function (p) { return p[0]; }).concat([nid]);
        var k = cycV.length, assign = {}, used = {};
        for (var j = 0; j < k; j++) {
          assign[(choice === 0) ? cycV[j] : cycV[(j+1) % k]] = cycE[j]; used[cycE[j]] = 1;
        }
        var adj = {};
        all.forEach(function (e) {
          (adj[e[1]] = adj[e[1]] || []).push([e[0], e[2]]);
          (adj[e[2]] = adj[e[2]] || []).push([e[0], e[1]]);
        });
        var q = cycV.slice(), seen = {}; cycV.forEach(function (x) { seen[x] = 1; });
        while (q.length) {
          var x = q.shift();
          (adj[x] || []).forEach(function (p) {
            if (used[p[0]] || seen[p[1]]) return;
            assign[p[1]] = p[0]; used[p[0]] = 1; seen[p[1]] = 1; q.push(p[1]);
          });
        }
        return assign;
      }
      function applyCollapse(assign) {
        Object.keys(assign).forEach(function (sq) { var m = moves[assign[sq]]; classical[sq] = { p: m.p, n: m.n }; });
        moves = moves.filter(function (m, i) { return Object.keys(assign).every(function (s) { return assign[s] !== i; }); });
      }
      function winners() {
        var out = [];
        LINES.forEach(function (L) {
          if (L.every(function (s) { return classical[s]; })) {
            var ps = {}; L.forEach(function (s) { ps[classical[s].p] = 1; });
            var keys = Object.keys(ps);
            if (keys.length === 1) out.push({ p: keys[0], max: Math.max.apply(null, L.map(function (s) { return classical[s].n; })), line: L });
          }
        });
        return out;
      }
      // --- the ring: which squares/threads are actually being measured -----------
      // Derived, not tracked: a vertex is on the cycle exactly when the two
      // outcomes disagree about which mark lands there. Everything else in the
      // tangle is a tree hanging off the ring and resolves the same way either way.
      function ringOf() {
        if (!(phase === 'collapse' && pending)) return { v: {}, e: {} };
        var o = pending.opts, v = {}, e = {};
        Object.keys(o[0] || {}).forEach(function (s) {
          if (o[1] && o[1][s] !== o[0][s]) { v[s] = 1; e[o[0][s]] = 1; e[o[1][s]] = 1; }
        });
        return { v: v, e: e };
      }

      function cellCentre(s) {
        var c = grid.children[s];
        return { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight / 2 };
      }

      // Threads ARE the entanglement, drawn. Two squares tied by one mark get one
      // curve; when the curves close a ring, that ring is what gets measured.
      function drawThreads() {
        var w = grid.offsetWidth, h = grid.offsetHeight;
        if (!w || !h) return;
        threads.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        threads.setAttribute('width', w);
        threads.setAttribute('height', h);
        var ring = ringOf(), out = '';
        moves.forEach(function (m, mi) {
          var A = cellCentre(m.a), B = cellCentre(m.b);
          var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
          var dx = B.x - A.x, dy = B.y - A.y;
          var len = Math.sqrt(dx * dx + dy * dy) || 1;
          var bow = 13 + (mi % 3) * 8;                       // fan overlapping pairs apart
          var cx = mx - dy / len * bow, cy = my + dx / len * bow;
          var lx = (A.x + 2 * cx + B.x) / 4, ly = (A.y + 2 * cy + B.y) / 4;  // Bezier midpoint
          out += '<path class="qthread ' + m.p + (ring.e[mi] ? ' ring' : '') + '" data-mi="' + mi +
                 '" d="M' + A.x.toFixed(1) + ' ' + A.y.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) +
                 ' ' + B.x.toFixed(1) + ' ' + B.y.toFixed(1) + '"/>';
          out += '<circle class="qthreadpip ' + m.p + (ring.e[mi] ? ' ring' : '') + '" data-mi="' + mi +
                 '" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="8.5"/>';
          out += '<text class="qthreadnum" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '">' + m.n + '</text>';
        });
        threads.innerHTML = out;
      }

      // Hovering a choosable ghost previews the WHOLE outcome. This is the fix for
      // the old ambiguity: you are not picking a square, you are picking which of
      // two consistent realities the entire tangle falls into.
      function preview(assign) {
        clearPreview();
        if (!assign) return;
        Object.keys(assign).forEach(function (sq) {
          var cell = grid.children[+sq];
          if (!cell) return;
          cell.classList.add('previewing');
          Array.prototype.forEach.call(cell.querySelectorAll('.spooky'), function (sp) {
            sp.classList.add(+sp.getAttribute('data-mi') === assign[sq] ? 'willland' : 'willvanish');
          });
          var t = threads.querySelector('.qthread[data-mi="' + assign[sq] + '"]');
          if (t) t.classList.add('resolving');
          var p = threads.querySelector('.qthreadpip[data-mi="' + assign[sq] + '"]');
          if (p) p.classList.add('resolving');
        });
      }
      function clearPreview() {
        Array.prototype.forEach.call(grid.querySelectorAll('.previewing'), function (c) { c.classList.remove('previewing'); });
        Array.prototype.forEach.call(grid.querySelectorAll('.willland, .willvanish'), function (s) {
          s.classList.remove('willland'); s.classList.remove('willvanish');
        });
        Array.prototype.forEach.call(threads.querySelectorAll('.resolving'), function (t) { t.classList.remove('resolving'); });
      }

      function draw(msg, cls) {
        var wins = winners(), winSq = {};
        wins.forEach(function (w) { w.line.forEach(function (s) { winSq[s] = 1; }); });
        var ring = ringOf();
        grid.innerHTML = '';
        for (var s = 0; s < 9; s++) {
          var d = document.createElement('div');
          var locked = !!classical[s] || phase === 'collapse';
          d.className = 'qcell' + (locked ? ' locked' : '') + (sel.indexOf(s) >= 0 ? ' sel' : '') + (winSq[s] ? ' win' : '');
          d.setAttribute('data-s', s);
          if (classical[s]) {
            d.innerHTML = '<span class="classical ' + classical[s].p + '">' + classical[s].p +
              '<sub style="font-size:.42em">' + classical[s].n + '</sub></span>';
          } else {
            d.innerHTML = moves.map(function (m, mi) {
              if (m.a !== s && m.b !== s) return '';
              var pick = '';
              if (phase === 'collapse' && pending) {
                var o = pending.opts;
                if ((o[0] && o[0][s] === mi) || (o[1] && o[1][s] === mi)) pick = ' choosable';
              }
              return '<span class="spooky ' + m.p + pick + '" data-mi="' + mi + '" data-sq="' + s + '">' + m.p + '<sub>' + m.n + '</sub></span>';
            }).join('');
            if (ring.v[s]) d.className += ' cyc';
          }
          grid.appendChild(d);
        }
        Array.prototype.forEach.call(grid.querySelectorAll('.qcell'), function (c) {
          c.addEventListener('click', function () { click(+c.getAttribute('data-s')); });
        });
        Array.prototype.forEach.call(grid.querySelectorAll('.spooky.choosable'), function (sp) {
          var sq = +sp.getAttribute('data-sq'), mi = +sp.getAttribute('data-mi');
          function outcome() {
            var o = pending.opts;
            return (o[0] && o[0][sq] === mi) ? o[0] : ((o[1] && o[1][sq] === mi) ? o[1] : null);
          }
          sp.addEventListener('click', function (ev) { ev.stopPropagation(); chooseGhost(sq, mi); });
          sp.addEventListener('mouseenter', function () { preview(outcome()); });
          sp.addEventListener('focus', function () { preview(outcome()); });
          sp.addEventListener('mouseleave', clearPreview);
          sp.addEventListener('blur', clearPreview);
          sp.setAttribute('tabindex', '0');
        });
        drawThreads();
        $(root, '[data-r=wx]').className = 'who X' + (turn === 'X' ? ' on' : '');
        $(root, '[data-r=wo]').className = 'who O' + (turn === 'O' ? ' on' : '');
        $(root, '[data-r=phase]').textContent =
          phase === 'collapse' ? 'choose a collapse' : (sel.length === 1 ? 'pick the second square' : 'pick two squares');
        var m = $(root, '[data-r=say]');
        m.className = 'verdict' + (cls ? ' ' + cls : ''); m.innerHTML = msg;
        var ringN = Object.keys(ring.v).length;
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Move</dt><dd>' + moveNo + '</dd>' +
          '<dt>Threads live</dt><dd>' + moves.length + ' mark' + (moves.length === 1 ? '' : 's') +
            ' still in two places at once</dd>' +
          (ringN ? '<dt>Ring closed</dt><dd><strong style="color:var(--yellow)">' + ringN +
            ' squares</strong> are being measured together — two ways it can fall</dd>' : '') +
          '<dt>Score</dt><dd>X ' + score.X + ' · O ' + score.O + '</dd>';
      }
      // threads are measured from live layout, so they must be re-measured on resize
      window.addEventListener('resize', drawThreads);
      function click(s) {
        if (phase === 'collapse' || phase === 'over' || classical[s]) return;
        var k = sel.indexOf(s);
        if (k >= 0) { sel.splice(k, 1); draw('Pick two squares for ' + turn + '<sub>' + moveNo + '</sub>.'); return; }
        if (sel.length === 2) return;
        sel.push(s);
        if (sel.length < 2) { draw('Now pick the second square — the mark will live in both.'); return; }
        moves.push({ p: turn, n: moveNo, a: sel[0], b: sel[1] });
        var placed = sel.slice(); sel = [];
        var all = edgesOf(), nid = all.length - 1;
        if (findCycle(all.filter(function (e) { return e[0] !== nid; }), placed[0], placed[1])) {
          pending = { opts: [collapse(0), collapse(1)] };
          phase = 'collapse';
          var chooser = turn === 'X' ? 'O' : 'X';
          turn = chooser;
          draw('<strong>The threads closed a ring — measurement.</strong> ' + chooser +
            ' decides how it falls. <em>Hover a glowing mark to see the whole outcome it drags with it</em>, then click to make that reality the real one. ' +
            'There are exactly two, and they are opposites: every square on the ring flips together.', 'split');
        } else {
          var last = moves[moves.length - 1];
          moveNo++; turn = turn === 'X' ? 'O' : 'X';   // advance BEFORE drawing: the HUD shows whose turn it now is
          draw('<strong>' + last.p + '<sub>' + last.n + '</sub> is now in two squares at once.</strong> ' +
            'The thread between them is real — neither square is decided until something forces the question. No ring yet.');
        }
      }
      function chooseGhost(sq, mi) {
        var o = pending.opts;
        var pick = (o[0] && o[0][sq] === mi) ? 0 : ((o[1] && o[1][sq] === mi) ? 1 : -1);
        if (pick < 0) return;
        clearPreview();
        applyCollapse(o[pick]);
        pending = null; phase = 'place'; moveNo++;
        var w = winners();
        if (w.length) {
          win('qttt', opts);
          var best = w.slice().sort(function (a, b) { return a.max - b.max; });
          if (w.length === 1) score[best[0].p] += 1;
          else { score[best[0].p] += 1; if (best[1].p !== best[0].p) score[best[1].p] += 0.5; }
          draw('<strong>' + best[0].p + ' takes a line.</strong> ' +
            (w.length > 1 ? 'Two lines formed — the one completed with the lower move number scores full. ' : '') +
            'Score: X ' + score.X + ' · O ' + score.O + '. <strong>New game</strong> to play again.', 'good');
          phase = 'over';
          return;
        }
        turn = turn === 'X' ? 'O' : 'X';
        draw('Collapsed. The ghosts in that tangle are now real. Play on.', 'good');
      }
      $(root, '[data-a=new]').addEventListener('click', reset);
      $(root, '[data-a=rules]').addEventListener('click', function () {
        var b = $(root, '[data-r=rulesbox]');
        if (b.style.display === 'none') {
          b.style.display = 'block';
          b.innerHTML = '<div class="formula" style="font-family:inherit">' +
            '<strong>How to play</strong><br>' +
            '1. On your turn, place your mark in <strong>two</strong> empty squares. A <strong>thread</strong> appears between them: the mark is in both, and neither is real yet.<br>' +
            '2. Squares can hold any number of faint marks. Faint = undecided.<br>' +
            '3. When the threads close a <strong>ring</strong>, that ring is <strong>measured</strong> and every square on it becomes real at once.<br>' +
            '4. A ring has exactly <strong>two</strong> consistent outcomes, and they are opposites — <em>the player who did not close it</em> chooses. Hover a glowing mark to see the whole outcome before you commit.<br>' +
            '5. Real marks are big and solid. Three real marks in a line wins.<br>' +
            '6. If one collapse makes two lines, the line finished with the lower move number scores 1, the other 0.5.<br><br>' +
            '<strong>Why the ring forces a measurement</strong><br>' +
            'Follow a chain of threads: if mark 1 lands <em>here</em>, mark 2 is pushed <em>there</em>, which pushes mark 3, and so on. In an open chain the pushing runs off the end and nothing is forced. In a <em>ring</em> it comes back to where it started — so the whole ring has to agree with itself, and only two arrangements can. That is the entire mechanic, and it is why closing a loop is the move that collapses things.<br><br>' +
            '<strong>What is real physics here, and what is not</strong><br>' +
            'Real: a mark in two places until measured; measuring one square deciding distant squares instantly; exactly two consistent outcomes. Not real: <em>choosing</em> the outcome — nature draws it at random, and Goff made it a player decision to keep the game strategic. Also not real: this is a teaching analogy on nine squares, not a simulation of nine qubits.</div>';
        } else b.style.display = 'none';
      });
      reset();
    }
  };

  /* ==================================================================== *
   *  THE CHSH GAME — Kai & Lyra's mission                                *
   *                                                                      *
   *  Ported unchanged from quantum-mechanics.html#chsh, which was        *
   *  verified in Python: S = 2sqrt(2) exactly at the optimal angles,     *
   *  P(win) = cos^2(pi/8) = 0.853553 matching 1/2 + S/8, the classical   *
   *  bound brute-forced over all 16 deterministic strategies = exactly   *
   *  3/4, and both marginals exactly 1/2 (no-signalling, so it cannot    *
   *  send a message). The arithmetic below is byte-identical to that     *
   *  widget; only the DOM plumbing changed, because the original was     *
   *  wired to hard-coded element ids on one page.                        *
   *                                                                      *
   *  MARGINALS ARE TRACKED HERE ON PURPOSE. Act V's whole point is that  *
   *  Kai and Lyra cannot signal, and a scene may only claim that if the  *
   *  game can show it: Alice's answer distribution must come out the     *
   *  same whatever Bob chose.                                            *
   * ==================================================================== */
  G.chsh = {
    id: 'chsh', title: 'The CHSH Game', mentor: 'Kai & Lyra',
    hook: 'Two players who cannot talk, one question each, and a win rate that no classical strategy on earth can reach.',
    about: {
      goal: 'Alice and Bob each get a random bit and answer with a bit. You win when <strong>a XOR b = x AND y</strong>. Beat <strong>75%</strong> — the provable classical ceiling.',
      how: 'Pick a strategy and play rounds. <strong>Best classical</strong> tops out at 75%, provably. <strong>Entangled pair</strong> reaches 85.4% and no further — that limit is Tsirelson’s bound.',
      inspired: 'The CHSH inequality (Clauser, Horne, Shimony &amp; Holt 1969) — the experiment that won the 2022 Nobel Prize in Physics.',
      learn: 'That entanglement is <em>provably</em> not just hidden pre-arranged answers — and that it still cannot send a single bit.',
      link: 'quantum-mechanics.html#chsh', linkText: 'The full explainer ▸', tier: '⟦Proven⟧'
    },
    honest: 'Honest model: the quantum side samples the <strong>exact</strong> Bell-state joint distribution P(a,b|x,y) = [1 + (−1)<sup>a+b</sup>cos(α−β)]/4 at the optimal angles, so nothing is scripted — the 85.4% emerges from the arithmetic. The classical side plays the best deterministic strategy, which wins on three of the four input pairs and therefore <strong>cannot</strong> exceed 75%; that bound is brute-forced over all 16 deterministic strategies. The quantum ceiling cos²(π/8) = 85.36% is <strong>Tsirelson’s bound</strong> and is also provable. The honest caveat, computed rather than guessed: over only 20 rounds a classical player beats the quantum <em>rate</em> about 9% of the time, which is exactly why real Bell tests need enormous trial counts. And crucially, <strong>both marginals are exactly 1/2 regardless of the other side’s setting</strong> — so this correlation is <strong>⟦proven⟧</strong> unable to carry a message.',
    mount: function (root, opts) {
      var mission = opts && opts.mode === 'mission';
      var NSVG = NS, W = 480, H = 200, L = 34, Rp = 8, TP = 12, BP = 26;
      var AA = [0, Math.PI / 2], BB = [Math.PI / 4, -Math.PI / 4];
      var CLASSICAL = 0.75, QUANTUM = Math.cos(Math.PI / 8) * Math.cos(Math.PI / 8);
      var quantum = true, n = 0, wins = 0, curve = [];
      // marginals[y][a] — how often Alice answered a, split by Bob's setting
      var marg = [[0, 0], [0, 0]], margN = [0, 0];

      root.innerHTML =
        '<div class="chsh-inputs" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0">' +
          '<button class="preset on" data-a="q">Entangled pair</button>' +
          '<button class="preset" data-a="c">Best classical</button></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<svg viewBox="0 0 480 200" xmlns="' + NSVG + '" data-r="svg" style="display:block;width:100%;max-width:480px;margin:0 auto;height:auto" aria-label="Running win rate against the classical and quantum bounds"></svg>' +
        '<p class="legend" style="text-align:center">Alice sees <b data-r="x">—</b> and answers <b data-r="a">—</b> · Bob sees <b data-r="y">—</b> and answers <b data-r="b">—</b></p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset" data-a="p1">Play 1</button>' +
          '<button class="preset" data-a="p100">Play 100</button>' +
          '<button class="preset" data-a="p1000">Play 1,000</button>' +
          '<button class="preset" data-a="reset">Reset</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '[data-r=svg]');
      function ael(tag, a, txt) {
        var e = document.createElementNS(NSVG, tag);
        for (var k in a) e.setAttribute(k, a[k]);
        if (txt != null) e.textContent = txt;
        svg.appendChild(e); return e;
      }
      function yOf(p) { return TP + (H - TP - BP) * (1 - (p - 0.4) / 0.6); }   // axis 0.4 .. 1.0

      ael('line', { x1: L, y1: yOf(0.4), x2: W - Rp, y2: yOf(0.4), stroke: 'var(--border)' });
      [0.5, 0.6, 0.7, 0.8, 0.9, 1.0].forEach(function (t) {
        ael('text', { x: L - 6, y: yOf(t) + 3, 'text-anchor': 'end', 'font-size': '9', fill: 'var(--muted)' },
            Math.round(t * 100) + '%');
      });
      ael('line', { x1: L, y1: yOf(CLASSICAL), x2: W - Rp, y2: yOf(CLASSICAL), stroke: 'var(--muted)', 'stroke-dasharray': '4 4' });
      ael('text', { x: W - Rp, y: yOf(CLASSICAL) - 5, 'text-anchor': 'end', 'font-size': '9', fill: 'var(--muted)' },
          'classical ceiling 75% — provable');
      ael('line', { x1: L, y1: yOf(QUANTUM), x2: W - Rp, y2: yOf(QUANTUM), stroke: 'var(--violet)', 'stroke-dasharray': '4 4' });
      ael('text', { x: W - Rp, y: yOf(QUANTUM) - 5, 'text-anchor': 'end', 'font-size': '9', fill: 'var(--violet)' },
          'quantum limit 85.4% (Tsirelson)');
      var wrPath = ael('path', { d: '', fill: 'none', stroke: 'var(--teal)', 'stroke-width': '2' });
      ael('text', { x: (W + L) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': '9', fill: 'var(--muted)' }, 'rounds played →');

      function sampleQ(x, y) {
        var c = Math.cos(AA[x] - BB[y]);
        var p = [(1 + c) / 4, (1 - c) / 4, (1 - c) / 4, (1 + c) / 4];   // (0,0)(0,1)(1,0)(1,1)
        var r = Math.random(), acc = 0;
        for (var i = 0; i < 4; i++) { acc += p[i]; if (r < acc) return [i >> 1, i & 1]; }
        return [1, 1];
      }
      function play() {
        var x = Math.random() < .5 ? 0 : 1, y = Math.random() < .5 ? 0 : 1;
        var ab = quantum ? sampleQ(x, y) : [0, 0];
        var w = (ab[0] ^ ab[1]) === (x & y);
        n++; if (w) wins++;
        marg[y][ab[0]]++; margN[y]++;
        curve.push(wins / n);
        if (curve.length > 1200) curve = curve.slice(curve.length - 1200);
        return { x: x, y: y, a: ab[0], b: ab[1], win: w };
      }
      function draw(last) {
        var d = '';
        if (curve.length) {
          var step = (W - Rp - L) / Math.max(curve.length - 1, 1);
          d = curve.map(function (p, i) {
            return (i ? 'L' : 'M') + (L + i * step).toFixed(1) + ' ' + yOf(Math.max(0.4, Math.min(1, p))).toFixed(1);
          }).join('');
        }
        wrPath.setAttribute('d', d);
        ['x', 'y', 'a', 'b'].forEach(function (k) {
          $(root, '[data-r=' + k + ']').textContent = last ? last[k] : '—';
        });
        var v = $(root, '[data-r=say]');
        if (!last) { v.className = 'verdict'; v.textContent = 'Pick a strategy and play a round.'; }
        else {
          v.className = 'verdict ' + (last.win ? 'good' : 'bad');
          v.innerHTML = last.win
            ? 'Won — answers ' + (last.a === last.b ? 'matched' : 'differed') + ', and both bits were ' +
              (last.x && last.y ? '1' : 'not both 1') + '.'
            : 'Lost — answers ' + (last.a === last.b ? 'matched' : 'differed') + ' when they should have ' +
              ((last.x & last.y) ? 'differed' : 'matched') + '.';
        }
        var rate = n ? wins / n : 0;
        /* A finite sample of a strategy whose TRUE rate is exactly 0.75 sits
           above 0.75 about half the time. Calling that "above the classical
           ceiling" says the player beat a provable bound, which is impossible
           -- 20,000 classical rounds came out at 75.24% while testing this,
           and the old wording announced it in teal as a breach. Require the
           excess to clear two standard errors before claiming anything, and
           name sampling noise when it does not. This is the same lesson the
           page's own caveat teaches: separation only shows up in the long run,
           which is why real Bell tests need enormous trial counts. */
        var se = n ? Math.sqrt(CLASSICAL * (1 - CLASSICAL) / n) : 0;
        var real = n > 0 && (rate - CLASSICAL) > 2 * se;
        var line = !n ? '—'
          : real ? '<span style="color:var(--teal)">above the classical ceiling — beyond sampling noise</span>'
          : rate > CLASSICAL ? 'above 75%, but within sampling noise (&plusmn;' + (200 * se).toFixed(1) + ' pts)'
          : 'at or below the classical ceiling';
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Strategy</dt><dd>' + (quantum ? 'entangled pair, optimal angles' : 'best possible classical') + '</dd>' +
          '<dt>Rounds</dt><dd>' + n.toLocaleString('en-US') + '</dd>' +
          '<dt>Win rate</dt><dd><strong>' + (100 * rate).toFixed(1) + '%</strong>' + (n ? ' — ' + line : '') + '</dd>' +
          '<dt>Theory says</dt><dd>' + (quantum ? '85.4%' : '75.0%') + '</dd>';
        if (quantum && real) win('chsh', opts);      // only a real breach counts
        emit(last, real, se);
      }
      function emit(last, real, se) {
        if (!opts || typeof opts.onState !== 'function') return;
        try {
          opts.onState({
            phase: 'render', quantum: quantum, rounds: n, wins: wins,
            rate: n ? wins / n : 0, classical: CLASSICAL, tsirelson: QUANTUM,
            // "beats" means beyond two standard errors, not merely above 0.75
            beatsClassical: !!real, stderr: se || 0,
            last: last || null,
            /* Alice's answer distribution, split by BOB's setting. If these two
               agree, nothing Bob does changes what Alice sees, and no message
               can cross. That is no-signalling, measured. */
            aliceGivenBob0: margN[0] ? marg[0][1] / margN[0] : null,
            aliceGivenBob1: margN[1] ? marg[1][1] / margN[1] : null,
            margN: margN.slice()
          });
        } catch (e) {}
      }
      function batch(k) { var last = null; for (var i = 0; i < k; i++) last = play(); draw(last); }
      function setMode(q) {
        quantum = q; n = 0; wins = 0; curve = []; marg = [[0, 0], [0, 0]]; margN = [0, 0];
        $(root, '[data-a=q]').className = 'preset' + (q ? ' on' : '');
        $(root, '[data-a=c]').className = 'preset' + (q ? '' : ' on');
        draw(null);
      }
      $(root, '[data-a=q]').addEventListener('click', function () { setMode(true); });
      $(root, '[data-a=c]').addEventListener('click', function () { setMode(false); });
      $(root, '[data-a=p1]').addEventListener('click', function () { batch(1); });
      $(root, '[data-a=p100]').addEventListener('click', function () { batch(100); });
      $(root, '[data-a=p1000]').addEventListener('click', function () { batch(1000); });
      $(root, '[data-a=reset]').addEventListener('click', function () { setMode(quantum); });
      draw(null);
    }
  };

  /* -------------------------------------------------------------------- */
  window.SymbiQ.games = {
    all: G,
    list: ['golf', 'grover', 'maxcut', 'volcano', 'qttt'].map(function (k) {
      return { id: k, title: G[k].title, hook: G[k].hook, mentor: G[k].mentor, about: G[k].about, honest: G[k].honest };
    }),
    get: function (id) { return G[id]; },
    /* The rules live behind one obvious button rather than a wall of text you
       must scroll past to reach the game. It opens itself the FIRST time you
       meet a given machine and stays shut on every return, so a newcomer is
       never left guessing and a returning player is never made to scroll. */
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
        '</div>' +
        (a.or ? '<a class="orjump" href="feasible.html"><span>◆ ' + a.or +
                '<span class="arr"> The Feasible Region ▸</span></span></a>' : '') +
        '</details>';
    },
    mount: function (id, elm, opts) {
      var g = G[id];
      if (!g || !elm) return false;
      try { g.mount(elm, opts || {}); return true; }
      catch (e) { elm.innerHTML = '<p style="color:var(--muted)">This mission could not start. Reload the page.</p>'; return false; }
    }
  };
})();
