/* SymbiQ, the game engines, defined ONCE and mounted anywhere.
 *
 * Why this file exists: every game used to live inline in play.html, while The
 * Solver's Path linked out to that same page, so a player met each game twice,
 * identically. Now each engine is a module that renders into whatever container
 * you hand it, and the *frame* around it differs:
 *     mode 'mission', in-world, mentor voice, story stakes (journey.html)
 *     mode 'arcade', free play, scores and pars (play.html)
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
   *  THE ANNEALING VOLCANO, Vesh's mission (new)                        *
   *                                                                      *
   *  You are not the walker. You are the COOLING SCHEDULE.               *
   *                                                                      *
   *  Engine (verified in Python, see outputs/VERIFY_VOLCANO.md):         *
   *    state  : integer position on a 1-D landscape of integer heights   *
   *    move   : propose x+/-1 with equal probability; an out-of-range    *
   *             proposal is REJECTED and the walker stays, that keeps   *
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
    hook: 'You are not the climber. You are the temperature, and the only question that matters is how fast you let it fall.',
    about: {
      goal: 'End the run <strong>frozen on the deepest point</strong> of the landscape. Not merely visit it, finish there.',
      how: 'Twelve times, choose <strong>Cool</strong>, <strong>Hold</strong> or <strong>Stoke</strong>. Each choice runs twenty random steps at that temperature. Hot lets the walker climb out of valleys; cold locks it wherever it stands. <strong>The Descent</strong> mode makes it endless: a fresh landscape every time, one 10-choice schedule, and a pass mark you must beat over 500 replays. Clear it and the next one is deeper. Score is how far down you get.',
      inspired: 'Simulated annealing (Kirkpatrick, Gelatt &amp; Vecchi, <em>Science</em> 1983), metallurgy borrowed as an algorithm, and the classical baseline that quantum annealers are measured against.',
      learn: 'The exploration/exploitation trade-off you can feel in your hands, and why a method that never accepts a worse move can never escape a valley.',
      link: 'ai.html', linkText: 'Quantum optimisation ▸', tier: 'Heuristic',
      or: 'Simulated annealing is a <b>metaheuristic</b>, operations research’s answer to problems too hard to solve exactly. It is the classical baseline quantum annealing has to beat.'
    },
    honest: 'Honest model: this is real simulated annealing. Each step proposes a move to an adjacent cell and accepts it outright if the landscape drops; if it rises by ΔE it is accepted with probability <strong>exp(−ΔE/T)</strong>, the Metropolis rule, which is why a hot walker can climb out of a valley and a cold one cannot. Proposals that would leave the landscape are rejected, keeping the proposal symmetric as detailed balance requires. Every landscape here was checked by brute force (each global minimum is unique) and every claim the game makes was measured over 20,000 simulated runs per volcano. Crash-cooling misses the true floor on <strong>88 / 93 / 98 / 93%</strong> of runs across the four landscapes that have structure. On the three with a single trap it freezes in that first ditch specifically (76–93%); on the Comb it freezes in whichever of the seven traps it happens to be nearest, which is why "the first ditch" is the wrong picture there and only 12% of its runs end in the first one. Against that, a shaped schedule wins about <strong>six-fold</strong> on the gentlest of the four and about <strong>forty-fold</strong> on the cruellest. Clearing is judged on your <em>schedule</em>, replayed 500 times, because a single win proves nothing. The honest limit: annealing is <strong>heuristic</strong>. There <em>is</em> a schedule proven to find the global optimum, cool as T<sub>k</sub> = c/log(k+2), with c at least the deepest barrier (Geman &amp; Geman 1984), and it is useless in practice: the deepest barrier here is 4, so that schedule needs ~3,000 steps just to reach T = 0.5 (twelve times this game’s entire 240-step budget) and ~500 million to reach T = 0.2. It converges precisely because it refuses to cool. And the Salt Flat is the counter-example on purpose: <strong>no search method beats any other averaged over all possible landscapes</strong> (No Free Lunch, Wolpert &amp; Macready 1997). Methods win by exploiting structure. Where there is none, nothing helps. The <strong>🔴 Ruthless</strong> card ("the Deep Country") runs five harder landscapes on a tighter <strong>10-epoch</strong> budget; each pass mark was re-established the same way, below crash-cooling is impossible, and a shaped schedule found by search clears it by at least three points. <strong>The Descent</strong> (a Standard-mode option) generates each landscape at run time from a seed and a difficulty that rises every time you clear one; the pass mark adapts as <em>max(0.44 − 0.05·d, crash + 0.12)</em>, floored at 18%, and the game only serves a landscape once it has measured that some cooling ramp beats that mark by a margin, so no generated level is ever a dud. The generator, the accept rule and the pass mark are all proven in <code>tools/verify_volcano_deepdive.py</code>. A <strong>Daily Descent</strong> option seeds the whole sequence, including the acceptance check, from the date, so every browser gets the identical descent today, with a per-day best kept beside the all-time one (<code>tools/verify_daily.py</code>).',
    // Landscapes verified offline: every global minimum unique; pass marks set
    // below the best schedule found by search, above what crash-cooling scores.
    // `crash` = the measured clear rate of a crash-cool (all-Cool) schedule on
    // that landscape, transcribed from the honest-model note above: miss rates
    // 88/93/98/93% on the four structured levels -> clears 12/7/2/7; the Salt
    // Flat is the inversion where crash-cooling is the BEST play, at 69%.
    // Display only -- the engine never reads it.
    LV: [
      { n: 'The First Ditch', h: [8,6,4,2,3,4,5,4,3,2,1,0,1,2,3], start: 0, T0: 2.0, bar: 0.50, best: 0.71, crash: 12, gmin: 11,
        note: 'One shallow ditch on the way down, one true floor beyond it. Cool too fast and you will spend the rest of the run in the ditch, that is not a metaphor, it happens in 88% of runs, measured.' },
      { n: 'The Twin Calderas', h: [7,5,3,1,2,3,4,5,4,3,2,1,0,1,2,3,5], start: 0, T0: 2.5, bar: 0.40, best: 0.55, crash: 7, gmin: 12,
        note: 'Two deep basins, and the first one you fall into is the wrong one. The ridge between them is four units tall, the walker can only cross it while it is hot enough to accept climbing.' },
      { n: 'The Comb', h: [8,7,8,6,7,5,6,4,5,3,4,2,3,1,2,0,2], start: 0, T0: 2.0, bar: 0.50, best: 0.66, crash: 2, gmin: 15,
        note: 'Seven little traps, every one only a single unit deep. No single trap is dangerous. Being cold near any of them is, crash-cooling ends the run stuck in one of them 98% of the time, and rarely the first.' },
      { n: 'The Salt Flat', h: [5,5,5,5,5,5,5,5,5,5,5,5,5,5,0,5,5,5,5,5,5,5,5], start: 0, T0: 2.0, bar: 0.50, best: 0.69, crash: 69, gmin: 14,
        flat: true,
        note: 'A dead flat plain with one hole in it. Out on the plain every move costs exactly nothing, so temperature <em>provably</em> cannot change your odds of stumbling onto the hole. It only decides whether you stay once you fall in, which is why crash-cooling, the worst play on every other volcano, is the best play here. This level is built to humble the method.' },
      { n: 'The Long Descent', h: [9,7,5,3,4,5,6,5,4,2,3,4,3,2,1,0,1,2], start: 0, T0: 3.0, bar: 0.40, best: 0.55, crash: 7, gmin: 15,
        note: 'Two traps, then the floor. Survive the first ridge and the second will take you if you have already gone cold. Shape the whole descent, not just the start.' }
    ],
    COOL: 0.60, HOLD: 1.00, STOKE: 1.70, TMIN: 0.02, TMAX: 8.0, EPOCH: 20, EPOCHS: 12, REPLAYS: 500,

    /* 🔴 RUTHLESS, "The Deep Country". Five harder landscapes on a TIGHTER
       10-epoch budget (Standard is 12). `bar` is a pass mark, not a proven
       optimum, annealing is heuristic, so tools/verify_volcano_ruthless.py
       re-establishes each one: the global minimum is unique, crash-cooling's
       clear rate sits below `bar`, and a search over cooling-shaped schedules
       finds a rate at least three points above it. `crash`/`best` are the
       display percentages, transcribed from that run. verify_frame.mjs drives
       the shipped engine on this budget. */
    LV_RUTHLESS: [
      { n: 'The Antechamber', h: [7,5,3,1,3,5,7,5,3,1,3,2,1,0,1,2], start: 0, T0: 2.5, bar: 0.30, best: 0.38, crash: 1, gmin: 13,
        note: 'Two basins with a seven-high wall between them, and only ten moves to get over it hot and back down cold. The first basin is not the floor.' },
      { n: 'The Serrated Ridge', h: [9,7,9,6,8,5,7,4,6,3,5,2,4,1,3,0,2], start: 0, T0: 2.0, bar: 0.22, best: 0.29, crash: 0, gmin: 15,
        note: 'A descending saw: every tooth is a trap two or three deep, and cold anywhere on it ends the run in whichever one you are nearest.' },
      { n: 'The Deep Well', h: [6,4,2,1,3,5,3,1,3,4,3,2,1,2,3,2,0,2], start: 0, T0: 2.5, bar: 0.17, best: 0.22, crash: 0, gmin: 16,
        note: 'The true floor is buried past two decoy basins that look, from a distance, just as deep. You have to stay hot across both.' },
      { n: 'The Two Passes', h: [6,3,1,4,7,4,1,3,5,3,1,0,2,3], start: 0, T0: 2.5, bar: 0.30, best: 0.39, crash: 0, gmin: 11,
        note: 'Two ridges, three ditches, one floor. Survive the first pass and the second takes you if you have already gone cold.' },
      { n: 'The Long Haul', h: [9,8,7,6,4,2,3,4,5,4,3,1,2,3,4,3,1,0,1,2,3], start: 0, T0: 3.0, bar: 0.22, best: 0.27, crash: 1, gmin: 17,
        note: 'The longest country on the card, and the same ten moves. Shape the whole descent, there is no budget left for a second try.' }
    ],

    mount: function (root, opts) {
      var g = this, mission = opts && opts.mode === 'mission';
      var ruthless = !mission && opts && opts.level === 'ruthless';
      var LV = ruthless ? g.LV_RUTHLESS : g.LV;
      var EPOCHS = ruthless ? 10 : g.EPOCHS;
      var winIdx = ruthless ? LV.length - 1 : 1;   // Standard: Twin Calderas. Ruthless: The Long Haul.

      /* ---- THE DESCENT: an endless, generated score-chase ------------------
         Standard/Guided arcade only (Ruthless + missions untouched). Each
         landscape is generated from (seed, difficulty d); you get one 10-epoch
         cooling schedule; clearing = your schedule, replayed 500x, beats an
         ADAPTIVE pass mark, max(passFloor(d), crash + 0.12), where crash is the
         all-Cool schedule's own clear rate. Clear -> d rises (deeper, harder,
         lower pass floor). Fail -> the descent ends. Score = descents cleared,
         saved. The generator, the accept rule and the pass mark are proven in
         tools/verify_volcano_deepdive.py (same PRNG, same engine). */
      var SAVE = window.SymbiQ && SymbiQ.save;
      var DESC_KEY = 'volcano.descent.best';
      var descent = { on: false, daily: false, d: 0, over: false, crash: 0, passMark: 0,
                      best: (SAVE && SAVE.get) ? (+SAVE.get(DESC_KEY, 0) || 0) : 0, newBest: false };
      function mulberry32(a) {
        a = a >>> 0;
        return function () {
          a = (a + 0x6D2B79F5) >>> 0;
          var t = a;
          t = Math.imul(t ^ (t >>> 15), 1 | a) >>> 0;
          t = (t + (Math.imul(t ^ (t >>> 7), 61 | t) >>> 0)) >>> 0;
          t = (t ^ (t >>> 14)) >>> 0;
          return t / 4294967296;
        };
      }
      function dPassFloor(d) { return Math.max(0.18, 0.44 - 0.05 * d); }
      function dPassMark(d, crash) { return Math.max(dPassFloor(d), crash + 0.12); }
      function dCrashCeil(d) { return Math.max(0.16, 0.52 - 0.03 * d); }
      function genLandscape(seed, d) {
        var rnd = mulberry32(seed >>> 0);
        function ri(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
        var nTraps = Math.min(1 + Math.floor(d / 4), 2);
        var basins = nTraps + 1;
        var ridgeH = Math.min(3 + Math.floor(d / 5), 4);
        var T0 = Math.max(2.4, 2.9 - d * 0.02);
        var targetLen = Math.min(13 + d, 19);
        var ridgeCells = 3 * (basins - 1);
        var segLen = Math.max(2, Math.floor((targetLen - ridgeCells) / basins));
        var h = [], topBase = ridgeH + 2, b, c;
        for (b = 0; b < basins; b++) {
          var isLast = b === basins - 1;
          if (b > 0) {
            var peak = ridgeH + (isLast ? 1 : ri(0, 1));
            h.push(Math.max(1, peak - 1)); h.push(peak); h.push(Math.max(1, peak - 1));
          }
          var bf = isLast ? 1 : ri(1, 2);
          var descTop = b === 0 ? topBase : Math.max(bf + 1, ridgeH - 1);
          var cells = segLen + (isLast ? 2 : 0);
          for (c = 0; c < cells; c++) {
            var frac = cells <= 1 ? 1 : c / (cells - 1);
            h.push(Math.max(1, Math.round(descTop - (descTop - bf) * frac)));
          }
        }
        var gi = h.length - 1 - ri(0, 1);
        h[gi] = 0;
        if (gi - 1 >= 0) h[gi - 1] = Math.max(1, h[gi - 1]);
        if (gi + 1 < h.length) h[gi + 1] = Math.max(1, h[gi + 1]);
        return { h: h, start: 0, T0: T0, gmin: gi, n: 'Descent ' + (d + 1),
                 bar: 0, best: 0, crash: 0, flat: false };
      }
      function schedOf() {
        var out = [];
        for (var i = 0; i < arguments.length; i += 2)
          for (var k = 0; k < arguments[i + 1]; k++) out.push(arguments[i]);
        return out;
      }
      var DCANON = [
        schedOf(g.STOKE,2,g.HOLD,3,g.COOL,5), schedOf(g.STOKE,3,g.HOLD,3,g.COOL,4),
        schedOf(g.STOKE,4,g.HOLD,2,g.COOL,4), schedOf(g.STOKE,4,g.HOLD,3,g.COOL,3),
        schedOf(g.STOKE,5,g.HOLD,2,g.COOL,3), schedOf(g.STOKE,5,g.HOLD,3,g.COOL,2),
        schedOf(g.STOKE,6,g.HOLD,1,g.COOL,3), schedOf(g.STOKE,2,g.HOLD,5,g.COOL,3),
        schedOf(g.STOKE,1,g.HOLD,4,g.COOL,5), schedOf(g.HOLD,5,g.COOL,5),
        schedOf(g.STOKE,3,g.HOLD,1,g.COOL,6), schedOf(g.STOKE,6,g.HOLD,2,g.COOL,2)
      ];
      var DCOOL10 = schedOf(g.COOL, 10);
      function quickRate(L, sched, n, rnd) {
        var w = 0, floor = L.h[L.gmin];
        for (var i = 0; i < n; i++) if (L.h[replay(L, sched, rnd)] === floor) w++;
        return w / n;
      }
      function descAccepts(L, d, rnd) {
        var crash = quickRate(L, DCOOL10, 150, rnd);
        L.crash = crash;
        if (crash > dCrashCeil(d)) return false;
        for (var i = 0, best = 0; i < DCANON.length; i++) {
          best = Math.max(best, quickRate(L, DCANON[i], 150, rnd));
          if (best >= dPassMark(d, crash) + 0.06) return true;
        }
        return false;
      }
      function makeDescent(d) {
        // Daily mode: a seed fixed for (game, today) so every browser gets the
        // same descent. Practice mode: a fresh seed each run. In Daily mode the
        // acceptance check runs on a seeded PRNG too, so the reseed loop lands
        // on the same landscape everywhere -- not just the same generator input.
        var base = descent.daily
          ? (FRAME.daily.seed('volcano') ^ Math.imul(d + 1, 2654435761)) >>> 0
          : ((Date.now() >>> 0) ^ Math.imul(d + 1, 2654435761)) >>> 0;
        for (var att = 0; att < 8; att++) {
          var seed = (base + att) >>> 0;
          var L = genLandscape(seed, d);
          var accRnd = descent.daily ? mulberry32((seed ^ 0x9e3779b9) >>> 0) : null;
          if (descAccepts(L, d, accRnd)) return L;
        }
        // never a dud: fall back to a hand-authored Standard volcano
        var fb = g.LV[d % g.LV.length];
        var F = { h: fb.h.slice(), start: fb.start, T0: fb.T0, gmin: 0,
                  n: fb.n + ' (reserve)', bar: 0, best: 0, crash: 0, flat: !!fb.flat };
        F.gmin = F.h.indexOf(Math.min.apply(null, F.h));
        F.crash = quickRate(F, DCOOL10, 150,
          descent.daily ? mulberry32((base ^ 0x51ed2701) >>> 0) : null);
        return F;
      }
      function startDescentLevel() {
        var L = makeDescent(descent.d);
        descent.crash = L.crash;
        descent.passMark = dPassMark(descent.d, L.crash);
        L.bar = descent.passMark;
        L.best = Math.min(0.62, descent.passMark + 0.12);   // display only
        LV = [L]; li = 0; EPOCHS = 10;
        cleared = [];
        fresh();
      }

      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Mode</span>' +
            '<button class="preset" type="button" data-gm="volc">Volcanoes</button>' +
            '<button class="preset" type="button" data-gm="desc">The Descent</button>' +
            '<button class="preset" type="button" data-gm="daily">Daily Descent</button>' +
            '<span data-r="descbest" style="color:var(--muted)"></span>' +
          '</div>') +
        '<div class="holes" data-r="chips"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<div class="vwrap">' +
          '<svg class="vterrain" viewBox="0 0 320 190" xmlns="' + NS + '" aria-label="The volcano landscape, height is energy, the walker seeks the lowest point"></svg>' +
          '<div class="vtherm"><div class="vtherm-fill" data-r="tfill"></div><span class="vtherm-lbl" data-r="tlbl">T</span></div>' +
        '</div>' +
        '<p class="legend" style="text-align:center"><span style="color:var(--yellow)">● the walker</span> · <span style="color:var(--teal)">▼ the true floor</span> · faint marks are cells it has already visited this run.</p>' +
        '<div class="vsched" data-r="sched" aria-label="your cooling schedule"></div>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset vbtn" data-a="stoke" title="T x1.7, let it climb">Stoke ▲</button>' +
          '<button class="preset vbtn" data-a="hold" title="T unchanged">Hold ═</button>' +
          '<button class="preset vbtn" data-a="cool" title="T x0.6, start locking it down">Cool ▼</button>' +
          '<button class="preset" data-a="reset">New run</button>' +
        '</p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '.vterrain'), li = 0, cleared = [], st = null;

      function fresh() {
        var L = LV[li];
        st = { x: L.start, T: L.T0, e: 0, sched: [], seen: {}, best: L.h[L.start], over: false, rate: null };
        st.seen[L.start] = 1;
      }
      function acc(dE, T) { return dE <= 0 ? 1 : Math.exp(-dE / T); }

      // one epoch of EPOCH proposals at temperature T, the whole engine.
      // `rnd` (optional): a seeded 0..1 source. Live play passes none (uses
      // Math.random); the Daily-mode ACCEPTANCE check passes a seeded one so
      // every browser generates the identical landscape.
      function epoch(h, x, T, seen, rnd) {
        var rand = rnd || Math.random;
        for (var i = 0; i < g.EPOCH; i++) {
          var y = x + (rand() < 0.5 ? 1 : -1);
          if (y < 0 || y >= h.length) continue;          // out of range: reject, stay put
          var dE = h[y] - h[x];
          if (dE <= 0 || rand() < Math.exp(-dE / T)) { x = y; if (seen) seen[x] = (seen[x] || 0) + 1; }
        }
        return x;
      }
      // replay a schedule from scratch, used for the 500-run honesty check
      function replay(L, sched, rnd) {
        var x = L.start, T = L.T0;
        for (var i = 0; i < sched.length; i++) {
          T = Math.min(g.TMAX, Math.max(g.TMIN, T * sched[i]));
          x = epoch(L.h, x, T, null, rnd);
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
        var L = LV[li], gm = geom(L), i;
        svg.innerHTML = '';
        var defs = el('defs', {}), grad = el('linearGradient', { id: 'vgrad', x1: '0', y1: '0', x2: '0', y2: '1' });
        grad.appendChild(el('stop', { offset: '0', 'stop-color': 'var(--violet)', 'stop-opacity': '.22' }));
        grad.appendChild(el('stop', { offset: '1', 'stop-color': 'var(--teal)', 'stop-opacity': '.10' }));
        defs.appendChild(grad); svg.appendChild(defs);

        var d = '';
        for (i = 0; i < gm.n; i++) d += (i ? 'L' : 'M') + gm.x(i).toFixed(1) + ' ' + gm.y(i).toFixed(1);
        svg.appendChild(el('path', { 'class': 'vfill', d: d + 'L' + gm.x(gm.n - 1).toFixed(1) + ' 176L' + gm.x(0).toFixed(1) + ' 176Z', fill: 'url(#vgrad)' }));
        svg.appendChild(el('path', { 'class': 'vline', d: d }));

        // the floor, marked, the landscape is fully visible, nothing is hidden
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
        if (descent.on) {
          var dailyBest = descent.daily ? FRAME.daily.best('volcano') : 0;
          $(root, '[data-r=chips]').innerHTML =
            '<div style="text-align:center;font-size:.9rem"><strong>' +
            (descent.daily ? 'Daily Descent ' : 'Descent ') + (descent.d + 1) + '</strong> · ' +
            LV[0].h.length + ' cells · schedule must clear <strong>' + Math.round(descent.passMark * 100) + '%</strong>' +
            (descent.daily
              ? ' &nbsp;<span style="color:var(--muted)">' + FRAME.daily.date() +
                (dailyBest > 0 ? ' · today’s best ' + dailyBest : '') +
                (descent.best > 0 ? ' · all-time ' + descent.best : '') + '</span>'
              : (descent.d > 0 ? ' &nbsp;<span style="color:var(--muted)">' + descent.d + ' behind you' +
                  (descent.best > 0 ? ' · deepest ' + descent.best : '') + '</span>' : '')) + '</div>';
          return;
        }
        $(root, '[data-r=chips]').innerHTML = LV.map(function (L, i) {
          return '<span class="hole' + (i === li ? ' now' : '') + (cleared[i] ? ' done' : '') + '" data-l="' + i +
                 '" title="' + L.n + '">' + (i + 1) + '</span>';
        }).join('');
        Array.prototype.forEach.call(root.querySelectorAll('[data-r=chips] .hole'), function (c) {
          c.addEventListener('click', function () { li = +c.getAttribute('data-l'); fresh(); render(); });
        });
      }

      function drawSched() {
        var out = '';
        for (var i = 0; i < EPOCHS; i++) {
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
        var L = LV[li], p = $(root, '[data-r=say]');
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; return; }
        p.className = 'verdict';
        p.innerHTML = '<strong>' + L.n + '.</strong> ' + EPOCHS + ' choices, ' + g.EPOCH + ' steps each. End <em>standing on</em> the floor, finding it is not keeping it. ' +
          '<span style="color:var(--muted)">Pass mark: a schedule that wins <strong>' + Math.round(L.bar * 100) + '%</strong> of the time.</span>';
      }

      function rows() {
        var L = LV[li];
        var here = L.h[st.x], floor = L.h[L.gmin];
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Epoch</dt><dd>' + Math.min(st.e, EPOCHS) + ' of ' + EPOCHS + ' &nbsp;<span style="color:var(--muted)">(' + (EPOCHS - Math.min(st.e, EPOCHS)) * g.EPOCH + ' steps left)</span></dd>' +
          '<dt>Temperature</dt><dd>' + st.T.toFixed(2) + ' &nbsp;<span style="color:var(--muted)">' +
            (st.T >= 2 ? 'molten, it will climb almost anything' : st.T >= 0.6 ? 'warm, small climbs only' : 'frozen, downhill or nothing') + '</span></dd>' +
          '<dt>Standing on</dt><dd>depth ' + here + (here === floor ? ', <strong style="color:var(--teal)">the floor</strong>' : '') + '</dd>' +
          '<dt>Deepest touched</dt><dd>depth ' + st.best + (st.best === floor && here !== floor ? ' <span style="color:var(--yellow)">, you were there and left</span>' : '') + '</dd>' +
          (st.rate == null ? '' :
            '<dt>Your schedule</dt><dd>wins <strong>' + Math.round(st.rate * 100) + '%</strong> of the time ' +
            '<span style="color:var(--muted)">(replayed ' + g.REPLAYS + '×; pass mark ' + Math.round(L.bar * 100) + '%, best we found ' + Math.round(L.best * 100) + '%)</span></dd>');
      }

      function render(msg) {
        drawChips(); drawTerrain(); drawSched(); drawTherm(); verdict(msg); rows();
        /* OUTBOUND ONLY, see Grover's emitter. Act IV's scene draws the
           landscape ITSELF from `heights`, so the ridge line on screen is the
           very array this sampler is walking. Nothing here reads back, and no
           replay, pass mark or acceptance test consults a listener. */
        if (opts && typeof opts.onState === 'function') {
          var L = LV[li];
          try {
            opts.onState({ phase: st.over ? 'finished' : 'render',
                           li: li, name: L.n, heights: L.h.slice(), gmin: L.gmin,
                           x: st.x, pos: st.x / Math.max(1, L.h.length - 1),
                           T: st.T, Tnorm: Math.max(0, Math.min(1, st.T / 4)),
                           epoch: Math.min(st.e, EPOCHS), epochs: EPOCHS,
                           here: L.h[st.x], floor: L.h[L.gmin], best: st.best,
                           onFloor: L.h[st.x] === L.h[L.gmin],
                           rate: st.rate, bar: L.bar, over: st.over,
                           cleared: cleared.filter(Boolean).length, total: LV.length });
          } catch (e) {}
        }
      }

      function step(mult) {
        if (st.over) return;
        var L = LV[li];
        st.T = Math.min(g.TMAX, Math.max(g.TMIN, st.T * mult));
        st.sched.push(mult);
        st.x = epoch(L.h, st.x, st.T, st.seen);
        if (L.h[st.x] < st.best) st.best = L.h[st.x];
        st.e++;
        if (st.e >= EPOCHS) return finish();
        render();
      }

      function descentFinish() {
        var L = LV[0], floor = L.h[L.gmin], frozeRight = L.h[st.x] === floor, frozeDepth = L.h[st.x];
        st.over = true;
        descent.newBest = false;
        // capture BEFORE startDescentLevel() replaces `st` and descent.passMark
        var myRate = scheduleRate(L, st.sched);        // 500 honest replays of YOUR schedule
        var mark = descent.passMark, touched = st.best === floor;
        st.rate = myRate;
        if (myRate >= mark) {
          descent.d++;
          if (descent.d > descent.best) {
            descent.best = descent.d; descent.newBest = true;
            if (SAVE && SAVE.set) SAVE.set(DESC_KEY, descent.d);
          }
          if (descent.daily) FRAME.daily.record('volcano', descent.d);
          startDescentLevel();
          syncVmode();
          render({ k: 'good', t:
            '<strong>Descent ' + descent.d + ' cleared.</strong> Your schedule froze on the floor <strong>' +
            Math.round(myRate * 100) + '%</strong> of 500 replays, past its ' + Math.round(mark * 100) + '% mark. ' +
            'Ahead: <strong>' + LV[0].h.length + ' cells</strong>, ' + Math.round(descent.passMark * 100) + '% to clear.' +
            (descent.newBest ? ' <strong style="color:var(--yellow)">Deepest descent yet: ' + descent.best + '.</strong>' : '') });
          return;
        }
        descent.over = true;
        var head = frozeRight
          ? '<strong>Froze on the floor, but the schedule does not hold.</strong> '
          : (touched ? '<strong>You touched the floor and drifted off it.</strong> '
             : '<strong>Froze at depth ' + frozeDepth + '</strong>, a trap, not the floor. ');
        render({ k: frozeRight ? 'split' : 'bad', t: head +
          'Replayed 500 times it clears only <strong>' + Math.round(myRate * 100) + '%</strong> (mark ' +
          Math.round(mark * 100) + '%). <strong>The descent ends at ' + descent.d + '.</strong>' +
          (descent.d > 0 && descent.d >= descent.best ? ' Your best.' : descent.best > 0 ? ' Best: ' + descent.best + '.' : '') +
          ' <button class="preset" type="button" data-a="descnew">New descent</button>' });
        syncVmode();
        var nb = $(root, '[data-r=say]').querySelector('[data-a=descnew]');
        if (nb) nb.addEventListener('click', function () {
          descent.d = 0; descent.over = false; descent.newBest = false;
          startDescentLevel(); syncVmode(); render();
        });
      }

      function finish() {
        if (descent.on) return descentFinish();
        var L = LV[li], floor = L.h[L.gmin], frozeRight = L.h[st.x] === floor;
        st.over = true;
        st.rate = scheduleRate(L, st.sched);           // 500 honest replays of YOUR schedule
        var passed = st.rate >= L.bar;
        if (passed && !cleared[li]) cleared[li] = true;

        var runLine = frozeRight
          ? '<strong>You froze on the floor.</strong> '
          : (st.best === floor
              ? '<strong>You reached the floor and drifted off it.</strong> Still too hot at the end. '
              : '<strong>You froze at depth ' + L.h[st.x] + '</strong>, ' + (L.h[st.x] > floor ? 'a trap, not the floor. ' : ''));
        var judge = passed
          ? 'And it was not luck: replayed ' + g.REPLAYS + ' times, this schedule wins <strong>' + Math.round(st.rate * 100) + '%</strong> of the time, past the ' + Math.round(L.bar * 100) + '% mark. <strong>Pass.</strong>'
          : 'Replayed ' + g.REPLAYS + ' times, this schedule wins only <strong>' + Math.round(st.rate * 100) + '%</strong> of the time' +
            (frozeRight ? ', so that run was luck. ' : '. ') + 'The mark is ' + Math.round(L.bar * 100) + '%.';

        var hint = '', allCool = false, noCool = false;
        if (!passed) {
          allCool = st.sched.every(function (m) { return m === g.COOL; });
          noCool = st.sched.every(function (m) { return m !== g.COOL; });
          if (allCool && !L.flat) hint = ' <span style="color:var(--muted)">You cooled from the first move, so the walker could never accept a single uphill step. It went downhill until it could not, and stopped.</span>';
          else if (noCool) hint = ' <span style="color:var(--muted)">You never went cold, so nothing ever settled, the walker was still wandering when the run ended. Heat finds; cold keeps.</span>';
          else hint = ' <span style="color:var(--muted)">Try holding the heat while it crosses the ridges, then cooling hard over the last few epochs.</span>';
        }

        var firstWin = (passed && li === winIdx) ? win('volcano', opts) : false;   // Twin Calderas (Std) / The Long Haul (Ruthless)

        /* FRAME, arcade only; mission mode has missions.js's own scene layer. */
        var frame = '';
        if (!mission && !passed) {
          var line = FRAME.loss('volcano', (allCool && !L.flat) ? 'crashcooled'
                                          : noCool ? 'neversettled'
                                          : frozeRight ? 'luck' : 'trapped');
          if (line) frame = '<div class="g-mentor">Vesh: ' + line + '</div>';
        } else if (!mission && passed) {
          frame = FRAME.ceremony('volcano', {
            first: firstWin, head: 'Schedule holds',
            lines: [
              'Your schedule clears <strong>' + Math.round(st.rate * 100) + '%</strong> of ' + g.REPLAYS +
                ' replays, pass mark ' + Math.round(L.bar * 100) + '%, and the best schedule we found reaches ' +
                Math.round(L.best * 100) + '%.',
              'Crash-cooling, the fastest schedule there is, clears ' + (L.n) + ' about <strong>' + L.crash + '%</strong>' +
                (L.flat ? ' of the time. On the flat, that is the <em>best</em> play there is.' : '.')
            ]
          });
        }

        render({ k: passed ? 'good' : (frozeRight ? 'split' : 'bad'), t: runLine + judge + hint + frame });
        if (passed && L.flat) {
          $(root, '[data-r=say]').innerHTML += '<br><span style="color:var(--muted)">Notice what just happened: on this level even <em>cooling instantly</em> passes. ' +
            'The plain is flat, so every step is accepted at any temperature, your control did nothing until the walker stumbled into the hole. That is <strong>No Free Lunch</strong>, felt rather than stated.</span>';
        }
      }

      Array.prototype.forEach.call(root.querySelectorAll('.vbtn'), function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-a');
          step(a === 'cool' ? g.COOL : a === 'stoke' ? g.STOKE : g.HOLD);
        });
      });
      $(root, '[data-a=reset]').addEventListener('click', function () {
        if (descent.on && descent.over) {
          descent.d = 0; descent.over = false; descent.newBest = false;
          startDescentLevel(); syncVmode();
        } else {
          fresh();
        }
        render();
      });

      /* ---- The Descent mode toggle (arcade Standard/Guided only) ---------- */
      function syncVmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = !descent.on ? 'volc' : descent.daily ? 'daily' : 'desc';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-gm]'), function (b) {
          var on = b.getAttribute('data-gm') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        var db = $(root, '[data-r=descbest]');
        if (db) db.textContent = descent.daily
          ? (FRAME.daily.best('volcano') > 0 ? '· today: ' + FRAME.daily.best('volcano') : '')
          : (descent.best > 0 ? ('· deepest descent: ' + descent.best) : '');
      }
      (function wireVmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        bar.querySelector('[data-gm=volc]').addEventListener('click', function () {
          descent.on = false; descent.daily = false; descent.over = false;
          LV = ruthless ? g.LV_RUTHLESS : g.LV;
          EPOCHS = ruthless ? 10 : g.EPOCHS;
          li = 0; cleared = []; fresh(); syncVmode(); render();
        });
        function startDescent(isDaily) {
          descent.on = true; descent.daily = isDaily; descent.d = 0;
          descent.over = false; descent.newBest = false;
          startDescentLevel(); syncVmode(); render();
        }
        bar.querySelector('[data-gm=desc]').addEventListener('click', function () { startDescent(false); });
        bar.querySelector('[data-gm=daily]').addEventListener('click', function () { startDescent(true); });
        syncVmode();
      })();

      fresh(); render();
    }
  };

  /* ==================================================================== *
   *  CIRCUIT GOLF, Ada's mission                                        *
   *  Six real 2x2 unitaries; pars are PROVEN MINIMA (breadth-first over  *
   *  all gate words, re-checked exhaustively at every shorter length).   *
   * ==================================================================== */
  G.golf = {
    id: 'golf', title: 'Circuit Golf', mentor: 'Ada',
    hook: 'Golf, but the ball is a qubit and every club is a rotation.',
    about: {
      goal: 'Turn a qubit from <span class="ket">|0⟩</span> into a given target state in as few gates as you can.',
      how: 'Tap gates to rotate the qubit until your <span style="color:var(--teal)">solid arrow</span> lands on the <span style="color:var(--violet)">dashed target</span>. <strong>Par is a proven minimum</strong>, no shorter route exists anywhere. <strong>The Long Game</strong> mode makes it endless: the par climbs 1→5, the target name is hidden after the second hole, and one gate budget runs the whole game, miss and it empties. Score is how many holes deep you get.',
      inspired: 'The Bloch sphere and the real one-qubit gate set, X, Y, Z, H, S, T, that every quantum program is built from.',
      learn: 'Superposition and phase, and why quantum gates are <em>rotations</em> rather than 0-to-1 flips.',
      link: 'quantum-mechanics.html#bloch', linkText: 'See the sphere ▸', tier: 'Proven'
    },
    honest: 'Honest model: the six gates are the real 2×2 unitaries and the sphere is a projection of the actual complex arithmetic, the same engine as <a href="quantum-mechanics.html#bloch">the Bloch sphere explorer</a>. Par values were computed by breadth-first search over all gate words and independently re-checked by exhaustive search at every shorter length, so each is a <strong>proven minimum</strong> rather than a designer’s guess. States are compared by Bloch vector, which ignores global phase, as physics does, since global phase is unobservable. The <strong>🔴 Ruthless</strong> card (“the Back Nine”) swaps in nine longer holes, par 3–5, every target off every Bloch pole so a T gate is unavoidable; their pars were proven minimal the same exhaustive way. <strong>The Long Game</strong> (a Standard-mode option) is a curated rotating ladder through par classes 1–5 rather than a generator, from |0⟩ the one-qubit gate set reaches only a handful of distinct states at each short length, so novelty runs out where the physics does, and every one of its 17 targets has a proven-minimal par (<code>tools/verify_golf_longgame.py</code>, exact Z[ζ8] BFS). One gate budget runs the whole game: par+8 to start, +par+2 per hole cleared, −1 per gate. A <strong>Daily Ladder</strong> option rotates the whole ladder by a per-day offset seeded from the date, different targets from each par-class pool, the same pars (still proven minima), the same for every browser, with a per-day best beside the all-time one (<code>tools/verify_daily.py</code>).',
    mount: function (root, opts) {
      // In-world voice. Display strings only, never logic, so the Path and the
      // Arcade run the identical engine and only the words differ.
      var mission = opts && opts.mode === 'mission';
      var VO = mission ? {
        unit: 'Door', unitLow: 'door', turn: 'turn', turns: 'turns',
        ask: function (n, name, par) { return 'Door ' + n + ', the coin must read <strong>' + name +
          '</strong>. It takes <strong>' + par + '</strong> ' + (par === 1 ? 'turn' : 'turns') + '.'; },
        par: 'The door opens. Nothing shorter exists, Ada proved that.',
        over: function (n, par) { return 'It opens, but you took ' + n + ' turns where ' + par + ' would do.'; },
        lost: 'You are forcing it. <strong>Steady the coin</strong> and turn again.',
        rowA: 'This door', rowB: 'Doors opened', rowC: 'Turns',
        allDone: 'every door, the short way'
      } : {
        unit: 'Hole', unitLow: 'hole', turn: 'gate', turns: 'gates',
        ask: function (n, name, par) { return 'Hole ' + n + ', reach <strong>' + name +
          '</strong> in <strong>' + par + '</strong> ' + (par === 1 ? 'gate' : 'gates') + '.'; },
        par: 'Par. Proven optimal, nothing shorter exists.',
        over: function (n, par) { return n + ' gates against par ' + par + '. There is a shorter route.'; },
        lost: 'Well over par. <strong>Retry hole</strong> to reset, or keep going.',
        rowA: 'This hole', rowB: 'Holes done', rowC: 'Total',
        allDone: 'perfect round'
      };
      var ruthless = !mission && opts && opts.level === 'ruthless';   // needed by the mode bar below
      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Mode</span>' +
            '<button class="preset" type="button" data-gm="holes">Holes</button>' +
            '<button class="preset" type="button" data-gm="lg">The Long Game</button>' +
            '<button class="preset" type="button" data-gm="daily">Daily Ladder</button>' +
            '<span data-r="lgbest" style="color:var(--muted)"></span>' +
          '</div>') +
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
      var HOLES_STD = [
        { name: '|1⟩',        path: ['X'],         par: 1, hint: 'The bit flip.' },
        { name: '|+⟩',        path: ['H'],         par: 1, hint: 'An even superposition of 0 and 1.' },
        { name: '|−⟩',        path: ['X','H'],     par: 2, hint: 'Like |+⟩, but the two halves carry opposite sign.' },
        { name: '|i⟩',        path: ['H','S'],     par: 2, hint: 'On the equator, a quarter turn round from |+⟩.' },
        { name: 'T|+⟩',       path: ['H','T'],     par: 2, hint: 'Halfway between |+⟩ and |i⟩.' },
        { name: '|−i⟩',       path: ['X','H','S'], par: 3, hint: 'Opposite |i⟩. Two gates will not reach it, that is proven.' },
        { name: 'Z|+⟩ again', path: ['H','Z'],     par: 2, hint: 'Z does nothing to |0⟩, so lead with something else.' },
        { name: 'S H |1⟩',    path: ['X','H','S'], par: 3, hint: 'Same place as hole 6. Try a different route.' },
        { name: 'T T H |0⟩',  path: ['H','S'],     par: 2, hint: 'Two T gates equal one S. Find the short way.' }
      ];
      /* 🔴 RUTHLESS, "The Back Nine". Nine longer holes, par 3–5, every target
         off every Bloch pole so a T is unavoidable. Each par is a PROVEN
         minimum: tools/verify_golf_backnine.py exhausts every gate word of every
         shorter length (up to 1,555 of them) in exact Z[ζ8] arithmetic and
         confirms none reaches the target. This array mirrors that script's
         BACK_NINE, checked by tools/verify_frame.mjs, keep them in step. */
      var HOLES_RUTHLESS = [
        { name: 'H T H',     path: ['H','T','H'],         par: 3, hint: 'Tilt to the equator, an eighth-turn of phase, tilt back. Off every pole, no Clifford route exists, and none of two gates.' },
        { name: 'H T H S',   path: ['H','T','H','S'],     par: 4, hint: 'The H T H tilt, then a quarter-turn of phase on top. Nothing under four gates closes the gap.' },
        { name: 'H T H Z',   path: ['H','T','H','Z'],     par: 4, hint: 'The tilt, then a half-turn of phase, or move the flip inside. H T X H lands the same state in the same four.' },
        { name: 'H S T H',   path: ['H','S','T','H'],     par: 4, hint: 'A three-eighths turn on the equator, then tilt back. More than one four-gate route reaches it; no shorter one does.' },
        { name: 'H T H T',   path: ['H','T','H','T'],     par: 4, hint: 'Tilt, phase, tilt, phase, two eighth-turns about different axes. Every one of the 259 shorter words misses.' },
        { name: 'X H T H',   path: ['X','H','T','H'],     par: 4, hint: 'Flip to |1⟩, then the H T H tilt. Same place as H T H X and H T Z H, four gates whichever end the flip goes.' },
        { name: 'H T H T H', path: ['H','T','H','T','H'], par: 5, hint: 'Three tilts, two eighth-turns between them. All 1,555 shorter words miss.' },
        { name: 'H T H T X', path: ['H','T','H','T','X'], par: 5, hint: 'The H T H T run, then a flip to the far side. The flip will not fold back in.' },
        { name: 'H T H S T', path: ['H','T','H','S','T'], par: 5, hint: 'Tilt, phase, tilt, quarter-phase, eighth-phase. Five things, in order, no four-gate shortcut.' }
      ];
      var HOLES = ruthless ? HOLES_RUTHLESS : HOLES_STD;

      /* ---- THE LONG GAME: an endless, par-ascending score-chase -------------
         Standard/Guided arcade only. From |0> the one-qubit gate set reaches
         only a handful of distinct states at each short word length, so this is
         a curated ROTATING LADDER through par classes 1..5, not a generator,
         and every par in it is a proven minimum (tools/verify_golf_longgame.py,
         exact Z[zeta8] BFS). One gate budget runs the whole game (starts par+8,
         +par+2 per hole cleared, -1 per gate); par is shown for the first two
         holes then hidden; the run ends when the budget empties before you land
         on the target. Score = holes cleared, best saved. */
      var G_SAVE = window.SymbiQ && SymbiQ.save;
      var LG_KEY = 'golf.longgame.best';
      var LG_LADDER = { 1:['X','H'], 2:['XH','HS','HT'], 3:['HTH','XHS','HTS','HTZ'],
                        4:['HTHS','HTHZ','HSTH','HTHT','XHTH'], 5:['HTHTH','HTHTX','HTHST'] };
      var LG_HINT = { 1:'A single gate lands it.', 2:'Two gates, a tilt and a turn.',
                      3:'Three gates. Off a pole now: a T is in there somewhere.',
                      4:'Four gates, two axes. No Clifford shortcut exists.',
                      5:'Five gates in order. Nothing shorter reaches it, proven.' };
      var lg = { on:false, daily:false, d:0, budget:0, over:false, cleared:0, newBest:false,
                 best:(G_SAVE&&G_SAVE.get)?(+G_SAVE.get(LG_KEY,0)||0):0 };
      function lgParClass(d) { return Math.min(5, 1 + Math.floor((d + 1) / 2)); }
      function lgShowPar() { return lg.cleared < 2; }
      // Daily mode rotates the whole ladder by a per-day offset, so today's run
      // draws different targets from each par-class pool than the practice run.
      // The pars are unchanged -- still proven minima (verify_golf_longgame.py).
      function lgDayOff() { return lg.daily ? (FRAME.daily.seed('golf') >>> 0) : 0; }
      function lgMakeHole(d) {
        var cls = lgParClass(d), pool = LG_LADDER[cls];
        var idx = (lg.cleared + d * 3 + (cls * 7) + lgDayOff()) % pool.length;
        var route = pool[idx].split('');
        return { name: (lgShowPar() ? pool[idx] : '???'), path: route, par: cls,
                 hint: LG_HINT[cls] };
      }
      function lgStart(d) {
        lg.d = d;
        HOLES = [ lgMakeHole(d) ];
        hi = 0; cur = Z0; moves = []; done = [null];
      }
      function lgReset() {
        lg.d = 0; lg.cleared = 0; lg.over = false; lg.newBest = false;
        HOLES = [ lgMakeHole(0) ];
        lg.budget = HOLES[0].par + 8;
        hi = 0; cur = Z0; moves = []; done = [null]; strokes = 0;
      }
      function lgAdvance() {
        lg.cleared++;
        if (lg.cleared > lg.best) { lg.best = lg.cleared; lg.newBest = true;
          if (G_SAVE && G_SAVE.set) G_SAVE.set(LG_KEY, lg.cleared); }
        if (lg.daily) FRAME.daily.record('golf', lg.cleared);
        lgStart(lg.d + 1);
        lg.budget += HOLES[0].par + 2;
      }
      function lgBestLabel() {
        var b = $(root, '[data-r=lgbest]');
        if (!b) return;
        b.textContent = lg.daily
          ? (FRAME.daily.best('golf') > 0 ? '· today: ' + FRAME.daily.best('golf') + ' hole' + (FRAME.daily.best('golf') === 1 ? '' : 's') : '')
          : (lg.best > 0 ? ('· longest game: ' + lg.best + ' hole' + (lg.best === 1 ? '' : 's')) : '');
      }

      /* `done` MUST be pre-filled to full length. It used to start as [] and be
         written sparsely, so after clearing hole 1 it had length 1 -- and the
         auto-advance below, which does done.findIndex(d == null && i > hi),
         could only ever scan index 0. It therefore found nothing and silently
         left you sitting on the hole you had just finished, forever. Shipped
         that way since the game was built; found 2026-08-02 by driving the
         engine from Act I's dial, where nobody clicks a hole chip by hand.
         Pars, scoring and physics are untouched by this -- it only fixes which
         hole you are standing on. */
      var hi = 0, cur = Z0, moves = [], strokes = 0, done = [], roundCeremony = false;
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
        if (lg.on) {
          var lgDB = lg.daily ? FRAME.daily.best('golf') : 0;
          $(root, '[data-r=holes]').innerHTML =
            '<div style="text-align:center;font-size:.9rem"><strong>' + (lg.daily ? 'Daily Hole ' : 'Hole ') + (lg.cleared + 1) +
            '</strong> · target ' +
            (lgShowPar() ? '<strong>' + H.name + '</strong> in ' + H.par : '<strong>hidden</strong> (par ' + H.par + ' unshown)') +
            (lg.daily ? ' <span style="color:var(--muted)">· ' + FRAME.daily.date() +
              (lgDB > 0 ? ' · today’s best ' + lgDB : '') + (lg.best > 0 ? ' · all-time ' + lg.best : '') + '</span>' : '') +
            '<br><span style="color:var(--muted)">gates left this game: </span>' +
            '<strong style="color:' + (lg.budget <= 3 ? 'var(--yellow)' : 'inherit') + '">' + lg.budget + '</strong></div>';
        } else {
          $(root, '[data-r=holes]').innerHTML = HOLES.map(function (h, i) {
            return '<span class="hole' + (i === hi ? ' now' : '') + (done[i] != null ? (done[i] <= h.par ? ' done' : ' over') : '') +
                   '" data-h="' + i + '" title="' + VO.unit + ' ' + (i+1) + ', par ' + h.par + '">' + (i+1) + '</span>';
          }).join('');
          Array.prototype.forEach.call(root.querySelectorAll('[data-r=holes] .hole'), function (b) {
            b.addEventListener('click', function () { hi = +b.getAttribute('data-h'); cur = Z0; moves = []; render(); });
          });
        }
        var p = $(root, '[data-r=say]'), hit = same(me, tgt);
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; }
        else if (hit && moves.length) { p.className = 'verdict good'; p.innerHTML = 'Reached <strong>' + H.name + '</strong>.'; }
        else if (lg.on) {
          p.className = 'verdict';
          p.innerHTML = '<strong>Hole ' + (lg.cleared + 1) + '.</strong> ' +
            (lgShowPar() ? 'Reach <strong>' + H.name + '</strong> in <strong>' + H.par + '</strong> gate' + (H.par === 1 ? '' : 's') + '. '
                         : 'The target is off the board, no par shown. ') +
            '<span style="color:var(--muted);font-weight:400">' + H.hint + ' Every gate spends your game budget.</span>';
        }
        else { p.className = 'verdict'; p.innerHTML = VO.ask(hi+1, H.name, H.par) + ' <span style="color:var(--muted);font-weight:400">' + H.hint + '</span>'; }
        var totPar = HOLES.reduce(function (a, h) { return a + h.par; }, 0);
        var played = done.filter(function (d) { return d != null; }).length;
        if (!lg.on && played === HOLES.length) {
          var firstGolf = win('golf', opts);
          if (!mission && !roundCeremony) {
            roundCeremony = true;
            var perfect = strokes === totPar;
            p.innerHTML += FRAME.ceremony('golf', {
              first: firstGolf, head: perfect ? 'Perfect round' : 'Round complete',
              lines: [
                'All ' + HOLES.length + ' holes in <strong>' + strokes + '</strong> gates against a total par of ' + totPar +
                  (perfect ? ', matched exactly.' : '.'),
                perfect
                  ? 'Every route was a proven minimum, and there is no shorter round. Breadth-first search says so.'
                  : 'Retry the holes you went long on, each par is a proven minimum, so each is reachable.'
              ]
            });
          }
        }
        if (lg.on) {
          $(root, '[data-r=rows]').innerHTML =
            '<dt>Gates this hole</dt><dd>' + moves.length +
              (lgShowPar() ? ' / par ' + H.par : '') +
              (moves.length ? ' &nbsp;<span class="chip">' + moves.join('</span><span class="chip">') + '</span>' : '') + '</dd>' +
            '<dt>Game budget</dt><dd>' + lg.budget + ' gate' + (lg.budget === 1 ? '' : 's') + ' left</dd>' +
            '<dt>Holes cleared</dt><dd><strong>' + lg.cleared + '</strong>' +
              (lg.best > 0 ? ' &nbsp;<span style="color:var(--muted)">longest game ' + lg.best + '</span>' : '') + '</dd>';
        } else {
          $(root, '[data-r=rows]').innerHTML =
            '<dt>' + VO.rowA + '</dt><dd>' + moves.length + ' / par ' + H.par + (moves.length ? ' &nbsp;<span class="chip">' + moves.join('</span><span class="chip">') + '</span>' : '') + '</dd>' +
            '<dt>' + VO.rowB + '</dt><dd>' + played + ' of ' + HOLES.length + '</dd>' +
            '<dt>' + VO.rowC + '</dt><dd>' + strokes + ' ' + VO.turns + ', par ' + totPar +
              (played === HOLES.length ? (strokes === totPar ? ', <strong style="color:var(--teal)">' + VO.allDone + '</strong>' : ', ' + (strokes - totPar) + ' over') : '') + '</dd>';
        }
        /* OUTBOUND ONLY, see the note on Grover's emitter. Act I's scene needs
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
      function lgFinishHole() {
        var used = moves.length, oldPar = HOLES[0].par;
        lgAdvance();                       // cleared++, maybe best, regen HOLES[0], grant budget, reset cur/moves/done
        syncGGmode();
        render({ k: 'good', t:
          '<strong>Hole ' + lg.cleared + ' cleared</strong> in ' + used + ' gate' + (used === 1 ? '' : 's') +
          (used === oldPar ? ', at par.' : ', ' + (used - oldPar) + ' over par.') +
          ' Budget: <strong>' + lg.budget + '</strong> gates.' +
          (lg.newBest ? ' <strong style="color:var(--yellow)">Longest game yet: ' + lg.best + '.</strong>' : '') });
      }
      function lgOut() {
        lg.over = true;
        syncGGmode();
        render({ k: 'bad', t:
          '<strong>Out of gates, the game ends here.</strong> You cleared <strong>' + lg.cleared + '</strong> hole' +
          (lg.cleared === 1 ? '' : 's') +
          (lg.cleared > 0 && lg.cleared >= lg.best ? ', your best.' : lg.best > 0 ? ' (best: ' + lg.best + ').' : '.') +
          ' <button class="preset" type="button" data-a="lgnew">New game</button>' });
        var nb = $(root, '[data-r=say]').querySelector('[data-a=lgnew]');
        if (nb) nb.addEventListener('click', function () { lgReset(); syncGGmode(); render(); });
      }
      function play(g) {
        var H = HOLES[hi];
        if (done[hi] != null || (lg.on && lg.over)) return;
        cur = ap(g, cur); moves.push(g);
        if (lg.on) lg.budget--;
        if (same(bloch(cur), bloch(seq(H.path)))) {
          if (lg.on) { lgFinishHole(); return; }
          done[hi] = moves.length; strokes += moves.length;
          var par = moves.length === H.par;
          var overLine = (!par && !mission) ? FRAME.loss('golf', 'overpar') : '';
          render({ k: par ? 'good' : 'split', t: '<strong>' + H.name + ' reached.</strong> ' +
            (par ? VO.par : VO.over(moves.length, H.par)) +
            (overLine ? '<div class="g-mentor">Ada: ' + overLine + '</div>' : '') });
          var nxt = done.findIndex(function (d, i) { return d == null && i > hi; });
          if (nxt < 0) nxt = done.findIndex(function (d) { return d == null; });
          if (nxt >= 0) setTimeout(function () { hi = nxt; cur = Z0; moves = []; render(); }, 1400);
        } else if (lg.on && lg.budget <= 0) {
          lgOut();
        } else if (!lg.on && moves.length >= H.par + 4) {
          var forceLine = !mission ? FRAME.loss('golf', 'forcing') : '';
          render({ k: 'bad', t: VO.lost + (forceLine ? '<div class="g-mentor">Ada: ' + forceLine + '</div>' : '') });
        } else render();
      }
      Array.prototype.forEach.call(root.querySelectorAll('.gatebtn'), function (b) {
        b.addEventListener('click', function () { play(b.getAttribute('data-g')); });
      });
      $(root, '[data-a=undo]').addEventListener('click', function () {
        if (lg.on || !moves.length || done[hi] != null) return;
        moves.pop(); cur = seq(moves); render();
      });
      $(root, '[data-a=retry]').addEventListener('click', function () {
        if (lg.on) return;
        if (done[hi] != null) { strokes -= done[hi]; done[hi] = null; roundCeremony = false; }
        cur = Z0; moves = []; render();
      });

      /* ---- The Long Game mode toggle (arcade Standard/Guided only) -------- */
      function syncGGmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = !lg.on ? 'holes' : lg.daily ? 'daily' : 'lg';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-gm]'), function (b) {
          var on = b.getAttribute('data-gm') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        ['undo', 'retry'].forEach(function (a) {
          var b = $(root, '[data-a=' + a + ']');
          if (b) b.style.display = lg.on ? 'none' : '';
        });
        lgBestLabel();
      }
      (function wireGGmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        bar.querySelector('[data-gm=holes]').addEventListener('click', function () {
          lg.on = false; lg.daily = false; lg.over = false;
          HOLES = ruthless ? HOLES_RUTHLESS : HOLES_STD;
          done = []; for (var i = 0; i < HOLES.length; i++) done.push(null);
          hi = 0; cur = Z0; moves = []; strokes = 0; roundCeremony = false;
          syncGGmode(); render();
        });
        bar.querySelector('[data-gm=lg]').addEventListener('click', function () {
          lg.on = true; lg.daily = false; lgReset(); syncGGmode(); render();
        });
        bar.querySelector('[data-gm=daily]').addEventListener('click', function () {
          lg.on = true; lg.daily = true; lgReset(); syncGGmode(); render();
        });
        syncGGmode();
      })();

      render();
    }
  };

  /* ==================================================================== *
   *  GROVER'S ESCAPE, Rue's mission                                     *
   *  Exit probability is exactly sin^2((2k+1)theta), sin theta = 1/sqrt(N)*
   * ==================================================================== */
  G.grover = {
    id: 'grover', title: "Grover's Escape", mentor: 'Rue',
    hook: 'A vault of identical doors, one exit, and a way to find it in far fewer tries than knocking.',
    about: {
      goal: 'Measure the exit using about <strong>√N</strong> tries, where knocking door-to-door needs roughly half of all N.',
      how: 'Hit <strong>Amplify</strong> to pump the exit’s odds up its bar, then <strong>Measure</strong> at the peak. Amplify too many times and you overshoot, the odds fall back down. <strong>Deep Dive</strong> mode makes it endless: the door count grows every corridor, the peak marker is hidden after the second, and one amplification budget runs the whole dive, poke around blindly and it runs dry. Score is how deep you get.',
      inspired: "Grover's search algorithm (1996), after Shor's, the most famous quantum speedup there is.",
      learn: 'Why quantum search is <em>quadratically</em> faster, √N, not exponential, and that a measurement is a dice-roll you can load but never force.',
      link: 'ai.html', linkText: 'Where speedups help ▸', tier: 'Proven'
    },
    honest: 'Honest model: this is real Grover search. Every door starts with amplitude 1/√N; one amplification is the exact oracle-then-diffusion step, which rotates the state by a fixed angle in the plane spanned by “exit” versus “everything else”. After <em>k</em> steps the exit’s probability is exactly <strong>sin²((2k+1)θ)</strong> with sin θ = 1/√N, so it climbs to a peak near <em>k</em> ≈ (π/4)√N and then <strong>falls</strong>, which is exactly why over-amplifying loses. The speedup is <strong>quadratic, not exponential</strong>, √N versus N, and Grover is <strong>proven</strong> optimal for unstructured search (Grover 1996; Bennett, Bernstein, Brassard &amp; Vazirani 1997). Measurement here is a genuine weighted draw over the bars, so even a perfect peak is a gamble, that is the physics, not the game. The rotation itself is phase kickback plus interference, the same engine <a href="formalism.html#f08">derived from scratch, one bit at a time, on The Machinery</a>, scaled up from a single query to about √N of them. The <strong>🔴 Ruthless</strong> card ("the Long Corridors") runs N from 96 up to 512, par 7 to 17: each par is the first maximum of that curve, proven the same way, and the clear is strict, only a measurement taken at the peak lights the corridor. <strong>Deep Dive</strong> (a Standard-mode option) never stops: N grows as <em>nextN = round(1.7·N)</em> from 4, the par is recomputed live as <em>round(π/(4·asin(1/√N)) − ½)</em> and hidden after the second corridor, and a single amplification budget, starting at par+12, growing by par+3 per corridor cleared, spending one per Amplify, makes blind probing unaffordable. Every N, its par, the ≥90% peak probability and the budget maths are checked in <code>tools/verify_grover_deepdive.py</code>. A <strong>Daily Dive</strong> option fixes the exit door of every corridor from the date (the N sequence and pars are already deterministic), so everyone searches the identical dive today, with a per-day best beside the all-time one (<code>tools/verify_daily.py</code>).',
    mount: function (root, opts) {
      // Display-only voice layer (see Circuit Golf). Rue's fixation is timing:
      // the arcade says "par", the corridor says "the moment to look".
      var mission = opts && opts.mode === 'mission';
      var VO = mission ? {
        ask: function (n, par) { return '<strong>' + n + ' doors</strong>, one way out. Tilt the odds toward it, about <strong>' +
          par + '</strong> ' + (par === 1 ? 'pass' : 'passes') + ', then look <em>once</em>.'; },
        peak: 'Out. You looked at exactly the right moment, that is the whole trick.',
        early: function (par) { return 'Out, but you looked early (the moment is ' + par + '). The draw was kind.'; },
        late: 'Out, though you kept tilting past the moment. The draw covered for you.',
        rowCleared: 'Corridors behind you'
      } : {
        ask: function (n, par) { return '<strong>' + n + ' doors.</strong> Amplify toward the peak (about <strong>' +
          par + '</strong> ' + (par === 1 ? 'round' : 'rounds') + '), then measure.'; },
        peak: 'Measured right at the <strong>peak</strong>, par.',
        early: function (par) { return 'Measured <strong>early</strong> (par is ' + par + '), but the draw went your way.'; },
        late: 'You <strong>over-amplified</strong> past the peak, yet the draw still landed home.',
        rowCleared: 'Corridors cleared'
      };
      var ruthless = !mission && opts && opts.level === 'ruthless';   // needed by the mode bar below
      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Mode</span>' +
            '<button class="preset" type="button" data-gm="corridors">Corridors</button>' +
            '<button class="preset" type="button" data-gm="dd">Deep Dive</button>' +
            '<button class="preset" type="button" data-gm="daily">Daily Dive</button>' +
            '<span data-r="ddbest" style="color:var(--muted)"></span>' +
          '</div>') +
        '<div class="holes" data-r="corr"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<div class="gr-bars" data-r="bars" aria-label="Probability of each door being the exit"></div>' +
        '<p class="legend" style="text-align:center"><span style="color:var(--teal)">▮ the exit’s odds</span> · <span style="color:var(--muted)">▮ every other door</span>, bar height is the chance a measurement lands there.</p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset" data-a="amp">Amplify ↑</button>' +
          '<button class="preset" data-a="measure">Measure</button>' +
          '<button class="preset" data-a="reset">Reset corridor</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var barsEl = $(root, '[data-r=bars]');
      var CORR_STD = [{n:4,par:1},{n:8,par:2},{n:16,par:3},{n:32,par:4},{n:64,par:6}];
      /* 🔴 RUTHLESS, "The Long Corridors". Every N longer than the Standard
         card's longest, so you can no longer eyeball a dozen bars: you have to
         know the peak sits near (π/4)√N and count to it. `par` is the FIRST
         maximum of sin²((2k+1)θ), proven by tools/verify_grover_ruthless.py and
         mirrored here; verify_frame.mjs drives the shipped engine to each peak.
         And the clear is strict, see finish(): only a measurement AT the peak
         ticks the corridor, a lucky early/late escape does not. */
      var CORR_RUTHLESS = [{n:96,par:7},{n:140,par:9},{n:192,par:10},{n:256,par:12},{n:384,par:15},{n:512,par:17}];
      var CORR = ruthless ? CORR_RUTHLESS : CORR_STD;
      var ci = 0, k = 0, mark = 0, measured = false, busy = false, bestP = 0, solved = [];

      /* ---- DEEP DIVE ----------------------------------------------------------
         The "amplitude game" as a score-chase instead of a five-rung ladder you
         clear once. Corridors never stop; N grows each time you escape; and the
         par (the peak) is hidden after the second corridor, so from there on you
         are running on "the peak sits near (π/4)√N" and nothing else. One
         amplification budget for the whole run, grown by par+3 each corridor,
         spent one per Amplify, so poking blindly at the bars empties it in a
         few rooms. A missed measurement ends the run. Score = corridors cleared;
         your deepest run is saved. Every N and its par are recomputed live from
         the exact Grover curve (verified: tools/verify_grover_deepdive.py). */
      var SAVE = window.SymbiQ && SymbiQ.save;
      var DD_KEY = 'grover.deepdive.best';
      function parOf(n) { return Math.round(Math.PI / (4 * Math.asin(1 / Math.sqrt(n))) - 0.5); }
      function nextN(n) { return Math.min(4096, 2 * Math.round(n * 1.7 / 2)); }
      var dd = { on: false, daily: false, n: 4, depth: 0, budget: 0, over: false,
                 best: (SAVE && SAVE.get) ? (+SAVE.get(DD_KEY, 0) || 0) : 0, newBest: false };
      function ddReset() {
        dd.n = 4; dd.depth = 0; dd.over = false; dd.newBest = false;
        dd.budget = parOf(4) + 12;   // a cushion for early fumbles; +3/corridor after
        CORR = [{ n: dd.n, par: parOf(dd.n) }]; ci = 0; fresh();
      }
      function ddAdvance() {
        dd.depth++;
        if (dd.depth > dd.best) { dd.best = dd.depth; dd.newBest = true;
          if (SAVE && SAVE.set) SAVE.set(DD_KEY, dd.depth); }
        if (dd.daily) FRAME.daily.record('grover', dd.depth);
        dd.n = nextN(dd.n);
        dd.budget += parOf(dd.n) + 3;
        CORR = [{ n: dd.n, par: parOf(dd.n) }]; ci = 0; fresh();
      }
      function ddBestLabel() {
        var b = $(root, '[data-r=ddbest]');
        if (!b) return;
        b.textContent = dd.daily
          ? (FRAME.daily.best('grover') > 0 ? '· today: ' + FRAME.daily.best('grover') + ' corridor' + (FRAME.daily.best('grover') === 1 ? '' : 's') : '')
          : (dd.best > 0 ? ('· best dive: ' + dd.best + ' corridor' + (dd.best === 1 ? '' : 's')) : '');
      }
      function ddShowPar() { return dd.depth < 2; }   // par hidden from the 3rd corridor on

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
      function fresh() {
        k = 0; measured = false; bestP = pExit(CORR[ci].n, 0);
        // Daily mode: the exit door is fixed for (game, day, depth) so every
        // browser searches the identical corridor. The N-sequence and pars are
        // already deterministic; this closes the last bit of variance.
        mark = (dd.on && dd.daily)
          ? ((FRAME.daily.seed('grover') ^ Math.imul(dd.depth + 1, 2654435761)) >>> 0) % CORR[ci].n
          : Math.floor(Math.random() * CORR[ci].n);
      }
      function chips() {
        if (dd.on) {
          var ddDB = dd.daily ? FRAME.daily.best('grover') : 0;
          $(root, '[data-r=corr]').innerHTML =
            '<div style="text-align:center;font-size:.9rem">' +
              '<strong>' + (dd.daily ? 'Daily Corridor ' : 'Corridor ') + (dd.depth + 1) + '</strong> · ' + dd.n + ' doors' +
              (ddShowPar() ? ' · <span style="color:var(--muted)">peak at ' + CORR[0].par + '</span>'
                           : ' · <span style="color:var(--muted)">peak ≈ (π/4)√N, uncounted</span>') +
              (dd.daily ? ' <span style="color:var(--muted)">· ' + FRAME.daily.date() +
                (ddDB > 0 ? ' · today’s best ' + ddDB : '') + (dd.best > 0 ? ' · all-time ' + dd.best : '') + '</span>' : '') +
              '<br><span style="color:var(--muted)">amplifications left this dive: </span>' +
              '<strong style="color:' + (dd.budget <= 3 ? 'var(--yellow)' : 'inherit') + '">' + dd.budget + '</strong>' +
            '</div>';
          return;
        }
        $(root, '[data-r=corr]').innerHTML = CORR.map(function (c, i) {
          return '<span class="hole' + (i === ci ? ' now' : '') + (solved[i] != null ? ' done' : '') + '" data-c="' + i +
                 '" title="' + c.n + ' doors, par ' + c.par + '">' + c.n + '</span>';
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
        if (dd.on) {
          return '<dt>Amplifications</dt><dd>' + k +
              (ddShowPar() ? ' &nbsp;<span style="color:var(--muted)">(peak ' + CORR[ci].par + ')</span>' : '') + '</dd>' +
            '<dt>Exit odds now</dt><dd>' + (pExit(n,k)*100).toFixed(1) + '% &nbsp;<span style="color:var(--muted)">this run peaked at ' + (bestP*100).toFixed(1) + '%</span></dd>' +
            '<dt>Dive budget</dt><dd>' + dd.budget + ' amplification' + (dd.budget === 1 ? '' : 's') + ' left</dd>' +
            '<dt>Corridors cleared</dt><dd><strong>' + dd.depth + '</strong>' +
              (dd.best > 0 ? ' &nbsp;<span style="color:var(--muted)">best dive ' + dd.best + '</span>' : '') + '</dd>';
        }
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
        else if (dd.on) {
          p.className = 'verdict';
          p.innerHTML = ddShowPar()
            ? '<strong>Corridor ' + (dd.depth + 1) + '.</strong> ' + n + ' doors, peak at ' + CORR[ci].par + '. Exit odds now: <strong>' + Math.round(pm*100) + '%</strong>.'
            : '<strong>Corridor ' + (dd.depth + 1) + '.</strong> ' + n + ' doors, no peak marker, it sits near (π/4)√N, and every stray Amplify is spent from your dive budget. Exit odds now: <strong>' + Math.round(pm*100) + '%</strong>.';
        }
        else {
          p.className = 'verdict';
          p.innerHTML = VO.ask(n, CORR[ci].par) + ' Exit odds now: <strong>' + Math.round(pm*100) + '%</strong>.';
        }
        $(root, '[data-r=rows]').innerHTML = rowsHTML();
        emit(dd.on ? 'dd-render' : 'render');
      }
      $(root, '[data-a=amp]').addEventListener('click', function () {
        if (busy || measured) return;
        if (dd.on) {
          if (dd.over) return;
          if (dd.budget <= 0) { render({ k: 'bad', t: '<strong>Dive budget spent.</strong> No amplifications left for this run, <strong>Measure</strong> from where you are.' }); return; }
          dd.budget--;
        }
        var n = CORR[ci].n, par = CORR[ci].par;
        if (k >= par * 2 + 3) { render({ k: 'split', t: 'The odds just <strong>oscillate</strong> from here, that is Grover being a rotation, not a ratchet. <strong>Reset</strong> and stop at the peak.' }); return; }
        var pprev = pExit(n, k); k++;
        var pm = pExit(n, k);
        if (pm < pprev - 1e-9) render({ k: 'bad', t: 'Over the top, the exit’s odds <strong>fell</strong> from ' + Math.round(pprev*100) + '% to ' + Math.round(pm*100) + '%. You rotated past it.' });
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
      function ddFinish(landed) {
        var n = CORR[ci].n, par = CORR[ci].par, p = $(root, '[data-r=say]'), usedK = k;
        if (landed === mark) {
          ddAdvance();                       // grows dd.n, dd.depth, dd.budget; may set dd.newBest
          bars();                            // redraw for the new (larger) door count
          p.className = 'verdict good';
          p.innerHTML = '<strong>Corridor ' + dd.depth + ' cleared</strong> in ' + usedK + ' amplification' + (usedK === 1 ? '' : 's') +
            (usedK === par ? ', dead on the peak.' : usedK < par ? ', a step early; the draw was kind.' : ', past the peak, and it still landed.') +
            ' Ahead: <strong>' + dd.n + ' doors</strong>, ' + dd.budget + ' amplifications banked.' +
            (dd.newBest ? ' <strong style="color:var(--yellow)">Deepest dive yet: ' + dd.best + '.</strong>' : '');
        } else {
          dd.over = true;
          p.className = 'verdict bad';
          p.innerHTML = '<strong>Wrong door, the dive ends here.</strong> Measured with <strong>' + Math.round(pExit(n, k) * 100) +
            '%</strong> on the exit' + (k > par ? ', past the peak.' : k < par ? ', short of the peak.' : ', the peak, and still a losing roll.') +
            ' You went <strong>' + dd.depth + ' corridor' + (dd.depth === 1 ? '' : 's') + '</strong> deep' +
            (dd.depth > 0 && dd.depth >= dd.best ? ', your best.' : dd.best > 0 ? ' · best is ' + dd.best + '.' : '.') +
            ' <button class="preset" type="button" data-a="ddnew">New dive</button>';
          var nb = p.querySelector('[data-a=ddnew]');
          if (nb) nb.addEventListener('click', function () { if (busy) return; ddReset(); syncGmode(); render(); });
        }
        $(root, '[data-r=rows]').innerHTML = rowsHTML(); chips();
        if ($(root, '[data-a=reset]')) $(root, '[data-a=reset]').style.display = dd.over ? 'none' : '';
        emit('dd-measured', { escaped: landed === mark, depth: dd.depth, doors: dd.n, over: dd.over });
      }
      function finish(landed) {
        if (dd.on) { ddFinish(landed); return; }
        var n = CORR[ci].n, par = CORR[ci].par, pm = pExit(n, k), p = $(root, '[data-r=say]');
        if (landed === mark) {
          var firstWin = win('grover', opts);
          /* Standard: any escape records the corridor. 🔴 Ruthless: only a
             measurement taken AT the peak counts, a lucky early or late draw
             gets you through the door but leaves the corridor unlit. */
          if (k === par || (!ruthless && solved[ci] == null)) solved[ci] = k;
          p.className = 'verdict good';
          p.innerHTML = '<strong>Escaped.</strong> ' + (k === par ? VO.peak : k < par ? VO.early(par) : VO.late) +
            (ruthless && k !== par ? ' <strong>Off the peak, the corridor still stands.</strong>' : '') +
            ' A classical searcher averages ~' + (n/2) + ' door' + (n/2 === 1 ? '' : 's') + '; you used <strong>' + k + '</strong>.';
          if (!mission && k === par) {
            p.innerHTML += FRAME.ceremony('grover', {
              first: firstWin, head: 'Corridor cleared',
              lines: [
                'You escaped in <strong>' + k + '</strong> amplification' + (k === 1 ? '' : 's') +
                  ', par is ' + par + ', the peak of the curve.',
                'A classical search of ' + n + ' doors averages <strong>' + (n / 2) + '</strong> checks; you used ' + k + '.'
              ]
            });
          }
        } else {
          p.className = 'verdict bad';
          p.innerHTML = '<strong>Wrong door.</strong> You measured with only <strong>' + Math.round(pm*100) + '%</strong> on the exit' +
            (k > par ? ', you had rotated past the peak.' : k < par ? ', amplify closer to the peak (par ' + par + ') first.'
             : ', even at the peak it is a weighted draw. Unlucky roll.') + ' <strong>Reset corridor</strong> to try again.';
          if (!mission) {
            var line = FRAME.loss('grover', k > par ? 'overrotated' : k < par ? 'early' : 'peak');
            if (line) p.innerHTML += '<div class="g-mentor">Rue: ' + line + '</div>';
          }
        }
        $(root, '[data-r=rows]').innerHTML = rowsHTML(); chips();
        emit('measured', { escaped: landed === mark, landed: landed, atPeak: k === par });
      }
      $(root, '[data-a=reset]').addEventListener('click', function () {
        if (busy) return;
        if (dd.on && dd.over) return;   // a finished dive restarts with "New dive", not Reset
        fresh(); render();
      });

      /* ---- Deep Dive mode toggle (arcade Standard / Guided only) ---------- */
      function syncGmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = !dd.on ? 'corridors' : dd.daily ? 'daily' : 'dd';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-gm]'), function (b) {
          var on = b.getAttribute('data-gm') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        var rb = $(root, '[data-a=reset]');
        if (rb) rb.style.display = (dd.on && dd.over) ? 'none' : '';
        ddBestLabel();
      }
      (function wireGmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        bar.querySelector('[data-gm=corridors]').addEventListener('click', function () {
          if (busy) return;
          dd.on = false; dd.daily = false; CORR = ruthless ? CORR_RUTHLESS : CORR_STD; ci = 0; solved = [];
          fresh(); syncGmode(); render();
        });
        bar.querySelector('[data-gm=dd]').addEventListener('click', function () {
          if (busy) return;
          dd.on = true; dd.daily = false; ddReset(); syncGmode(); render();
        });
        bar.querySelector('[data-gm=daily]').addEventListener('click', function () {
          if (busy) return;
          dd.on = true; dd.daily = true; ddReset(); syncGmode(); render();
        });
        syncGmode();
      })();

      fresh(); render();
    }
  };

  /* ==================================================================== *
   *  MAX-CUT / GRAPH CITY, Cordon's mission                             *
   *  Pars are PROVEN MAXIMA (brute force over all 2^n colourings).       *
   * ==================================================================== */
  G.maxcut = {
    id: 'maxcut', title: 'Max-Cut, the district split', mentor: 'Cordon',
    hook: 'Split a city in two so the fewest neighbours end up on the same side, the moment operations research and quantum become the same problem.',
    about: {
      goal: 'Colour every district one of two colours to satisfy the most roads, a road counts when its two ends differ. Par is the true maximum.',
      how: 'Click a district to flip its colour; <span style="color:var(--yellow)">bright roads</span> are satisfied, dim ones wasted. District 5 hides a trap where no single flip helps, that is the whole lesson. <strong>The Sprawl</strong> mode makes it endless: a fresh, larger, more frustrated city every time, generated with its true maximum cut brute-forced at load, on one flip budget. Score is how many cities you clear.',
      inspired: "Max-Cut, one of Karp's original NP-hard problems (1972), and its Ising form (Lucas 2014), the exact thing a quantum annealer or QAOA solves.",
      learn: 'How a hard optimisation problem becomes “find the Ising ground state”, and why local search gets stuck, the reason annealing exists.',
      link: 'ai.html', linkText: 'Quantum optimisation ▸', tier: 'Proven',
      or: 'Max-Cut is a classic <b>operations research</b> problem, NP-hard since Karp 1972, and the reason the whole QUBO/Ising bridge exists.'
    },
    honest: 'Honest model: this is Max-Cut, and it is <strong>proven</strong> NP-hard (Karp 1972), no efficient exact algorithm is known for the general case, which is why the pars here were found by brute force over all 2ⁿ colourings. The bridge to quantum is exact: label the colours ±1, and the satisfied-road count is Σ w<sub>ij</sub>(1−s<sub>i</sub>s<sub>j</sub>)/2, so <strong>maximising the cut is minimising the Ising energy</strong> Σ w<sub>ij</sub>s<sub>i</sub>s<sub>j</sub>, the ground state of an antiferromagnet. Every classic combinatorial problem (routing, scheduling, colouring) maps to this same Ising form (<strong>proven</strong> formulation, Lucas 2014), which is the whole reason quantum optimisation exists. The honest caveat: a quantum <em>advantage</em> on these problems is <strong>heuristic</strong> and unproven, classical solvers often match or beat today’s quantum ones. District 5 shows why the problem is hard even to approximate by hand: local search gets trapped. The <strong>🔴 Ruthless</strong> card ("the Frustrated Ward") runs four larger graphs, including the Petersen graph and a patch of triangular lattice, with pars brute-forced the same way; on the lattice, steepest-ascent single-flip search reaches the true maximum from only about 6% of starts. <strong>The Sprawl</strong> (a Standard-mode option) generates each city from a seed and a difficulty that rises every time you clear one, on a circulant frustration core plus random chords; its maximum cut is brute-forced over all 2ⁿ colourings at generation (n ≤ 12), a proven par, and you open at least two flips below it with no single-flip shortcut. One flip budget runs the whole run: opening-distance + 6, then +next-distance + 2 per city, −1 per click. Generator and accept rule proven in <code>tools/verify_maxcut_longgame.py</code>. A <strong>Daily Sprawl</strong> option seeds the city sequence from the date, the generator is pure, so it is byte-identical in every browser, with a per-day best beside the all-time one (<code>tools/verify_daily.py</code>).',
    mount: function (root, opts) {
      var mission = opts && opts.mode === 'mission';
      var ruthless = !mission && opts && opts.level === 'ruthless';
      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Mode</span>' +
            '<button class="preset" type="button" data-gm="dist">Districts</button>' +
            '<button class="preset" type="button" data-gm="sprawl">The Sprawl</button>' +
            '<button class="preset" type="button" data-gm="daily">Daily Sprawl</button>' +
            '<span data-r="spbest" style="color:var(--muted)"></span>' +
          '</div>') +
        '<div class="holes" data-r="dist"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<svg class="mcsvg" viewBox="0 0 300 250" xmlns="' + NS + '" aria-label="A city graph, click a district to recolour it"></svg>' +
        '<p class="legend" style="text-align:center">Click a district to flip its colour · <span style="color:var(--yellow)">━ bright road = satisfied</span> · <span style="color:var(--muted)">┅ dim = wasted</span>.</p>' +
        '<p style="margin:10px 0 4px;text-align:center">' +
          '<button class="preset" data-a="invert">Invert all</button><button class="preset" data-a="reset">Reset district</button></p>' +
        '<dl class="rows" data-r="rows"></dl>';

      var svg = $(root, '.mcsvg');
      var DIST_STD = [
        { n:3, E:[[0,1],[1,2],[2,0]], par:2, name:'the triangle',
          note:'An odd loop, you can never satisfy all three roads. Something must clash, and that unavoidable clash is called <em>frustration</em>. It is real physics, not a flaw in your play.' },
        { n:4, E:[[0,1],[1,2],[2,3],[3,0]], par:4, name:'the square',
          note:'An even loop: alternate the two colours and <strong>every</strong> road is satisfied.' },
        { n:5, E:[[0,1],[1,2],[2,3],[3,4],[4,0]], par:4, name:'the ring of five',
          note:'Odd again, four of five is the most any split can reach.' },
        { n:4, E:[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]], par:4, name:'the clique',
          note:'Every district borders every other. A 2–2 split satisfies four of the six roads.' },
        { n:6, E:[[4,5],[3,5],[0,5],[1,3],[2,4],[0,2]], par:6, name:'the trap', start:[0,0,1,1,0,1],
          note:'You begin at <strong>5 of 6</strong>, one road short. Try it: <strong>every single flip keeps you at 5 or drops you lower</strong>, yet 6 is reachable. Local search is stuck in a valley, and escaping needs two moves at once. This exact wall is what <strong>simulated annealing</strong> and <strong>QAOA</strong> are built to climb.' },
        { n:6, E:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]], par:7, name:'the prism',
          note:'Two triangles braced together. Seven of nine, find the split.' }
      ];
      /* 🔴 RUTHLESS, "The Frustrated Ward". Four larger graphs; each par is the
         true maximum cut, brute-forced over all 2ⁿ colourings by
         tools/verify_maxcut_ruthless.py and mirrored here (verify_frame.mjs
         drives the shipped engine to each par). Districts 3 and 4 are traps in
         the District-5 sense: steepest-ascent single-flip search reaches the
         maximum from only ~6% of starts on the lattice, and "the basin" opens
         two roads short of a split that exists, with no single flip that helps. */
      var DIST_RUTHLESS = [
        { n:6, name:'the full council',
          E:[[0,1],[0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5],[3,4],[3,5],[4,5]],
          par:9, note:'Every district borders every other. Only a perfect 3–3 split reaches par; six roads can never be satisfied, whatever you do.' },
        { n:10, name:'the pentagram',
          E:[[0,1],[1,2],[2,3],[3,4],[4,0],[5,7],[7,9],[9,6],[6,8],[8,5],[0,5],[1,6],[2,7],[3,8],[4,9]],
          par:12, note:'The Petersen graph. No two-colouring beats 12 of its 15 roads, and there are five different ways to reach that, none obvious.' },
        { n:12, name:'the frustrated lattice',
          E:[[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[8,9],[9,10],[10,11],
             [0,4],[1,5],[2,6],[3,7],[1,4],[2,5],[3,6],
             [4,8],[5,9],[6,10],[7,11],[5,8],[6,9],[7,10]],
          par:17, note:'A patch of triangular lattice, every face an odd loop. This is the geometric frustration a real antiferromagnet cannot escape, and greedy clicking almost never finds the true maximum.' },
        { n:12, name:'the basin', start:[0,0,1,1,0,1,0,0,1,1,0,1],
          E:[[4,5],[3,5],[0,5],[1,3],[2,4],[0,2],[10,11],[9,11],[6,11],[7,9],[8,10],[6,8]],
          par:12, note:'You open in a valley: every single flip holds the cut or drops it, and a perfect split still exists, it just takes more than one move at once to reach. The wall annealing and QAOA are for.' }
      ];
      var DIST = ruthless ? DIST_RUTHLESS : DIST_STD;
      var winIdx = ruthless ? DIST.length - 1 : 4;    // Standard: the trap (D5). Ruthless: the basin.
      var di = 0, color = [], solved = [];

      /* ---- THE SPRAWL: an endless, generated score-chase -------------------
         Standard/Guided arcade only. Each city is generated from (seed, d) on a
         circulant frustration core (every three consecutive districts a
         triangle) plus long chords; the true maximum cut is brute-forced over
         all 2^n colourings at generation (n<=12), a PROVEN par, exactly like
         the fixed districts, and you open at least two flips below it, so
         single-flip greedy is stuck. One flip budget runs the whole run
         (starts opening-distance + 6, +next-distance + 2 per city cleared, -1
         per click); reach the max cut and the city grows; run out and it ends.
         Score = cities cleared. Generator + accept rule proven in
         tools/verify_maxcut_longgame.py. */
      var MC_SAVE = window.SymbiQ && SymbiQ.save;
      var SP_KEY = 'maxcut.sprawl.best';
      var sp = { on:false, daily:false, d:0, over:false, budget:0, cleared:0, newBest:false,
                 dist:0, opts:null,
                 best:(MC_SAVE&&MC_SAVE.get)?(+MC_SAVE.get(SP_KEY,0)||0):0 };
      function spMul(a) {
        a = a >>> 0;
        return function () {
          a = (a + 0x6D2B79F5) >>> 0;
          var t = a;
          t = Math.imul(t ^ (t >>> 15), 1 | a) >>> 0;
          t = (t + (Math.imul(t ^ (t >>> 7), 61 | t) >>> 0)) >>> 0;
          t = (t ^ (t >>> 14)) >>> 0;
          return t / 4294967296;
        };
      }
      function spNodes(d) { return Math.min(5 + Math.floor(d / 2), 12); }
      function cutBits(E, bits) {
        var c = 0;
        for (var i = 0; i < E.length; i++) if ((((bits >> E[i][0]) ^ (bits >> E[i][1])) & 1)) c++;
        return c;
      }
      function popcount(x) { x = x - ((x >> 1) & 0x55555555); x = (x & 0x33333333) + ((x >> 2) & 0x33333333); return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24; }
      function spAnalyse(n, E) {
        var par = -1, opts = [], OPTCAP = 4096;
        for (var b = 0; b < (1 << n); b++) {
          var c = cutBits(E, b);
          if (c > par) { par = c; opts = [b]; }
          else if (c === par && opts.length < OPTCAP) opts.push(b);
        }
        return { par: par, opts: opts };
      }
      function spDistTo(bits, opts) {
        var m = 99;
        for (var i = 0; i < opts.length; i++) { var h = popcount(bits ^ opts[i]); if (h < m) m = h; }
        return m;
      }
      function spStrictLocalOpt(n, E, bits) {
        var base = cutBits(E, bits);
        for (var i = 0; i < n; i++) if (cutBits(E, bits ^ (1 << i)) > base) return false;
        return true;
      }
      function spRawGraph(rnd, n, d) {
        var ri = function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); };
        var E = [], seen = {};
        function addE(a, b) { if (a === b) return; var k = a < b ? a + ',' + b : b + ',' + a; if (seen[k]) return; seen[k] = 1; E.push(a < b ? [a, b] : [b, a]); }
        for (var i = 0; i < n; i++) { addE(i, (i + 1) % n); addE(i, (i + 2) % n); }
        var nCh = Math.max(1, Math.round(n * (0.20 + 0.05 * d))), added = 0, tries = 0;
        while (added < nCh && tries < 600) { tries++; var a = ri(0, n - 1), b = ri(0, n - 1); var k = a < b ? a + ',' + b : b + ',' + a; if (a !== b && !seen[k]) { seen[k] = 1; E.push(a < b ? [a, b] : [b, a]); added++; } }
        return E;
      }
      function spGenGraph(seed, d) {
        var rnd = spMul(seed >>> 0);
        var ri = function (lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); };
        var n = spNodes(d);
        for (var regen = 0; regen < 3; regen++) {
          var E = spRawGraph(rnd, n, d);
          var A = spAnalyse(n, E), par = A.par, opts = A.opts;
          var best = null, bestScore = -1;
          for (var t = 0; t < 12; t++) {
            var bits = 0;
            for (var i = 0; i < n; i++) if (ri(0, 1)) bits |= (1 << i);
            if (cutBits(E, bits) >= par) continue;
            var dd = spDistTo(bits, opts);
            if (dd < 2) continue;
            var sc = dd + (spStrictLocalOpt(n, E, bits) ? 1000 : 0);
            if (sc > bestScore) { bestScore = sc; best = bits; }
          }
          if (best !== null)
            return { n: n, E: E, par: par, opts: opts, startBits: best,
                     start: bitsToCol(best, n), dist: spDistTo(best, opts),
                     name: 'City ' + (d + 1) };
        }
        var E2 = spRawGraph(rnd, n, d), A2 = spAnalyse(n, E2);
        return { n: n, E: E2, par: A2.par, opts: A2.opts, startBits: 0,
                 start: bitsToCol(0, n), dist: spDistTo(0, A2.opts), name: 'City ' + (d + 1) };
      }
      function bitsToCol(bits, n) { var c = []; for (var i = 0; i < n; i++) c.push((bits >> i) & 1); return c; }
      function spStartLevel() {
        // Daily mode: a seed fixed for (game, today), so every browser gets the
        // same city sequence. spGenGraph is pure -- no Math.random -- so this is
        // exactly identical everywhere. Practice mode: a fresh seed each run.
        var seed = sp.daily
          ? (FRAME.daily.seed('maxcut') ^ Math.imul(sp.d + 1, 2654435761)) >>> 0
          : ((Date.now() >>> 0) ^ Math.imul(sp.d + 1, 2654435761)) >>> 0;
        var G = spGenGraph(seed, sp.d);
        sp.dist = G.dist; sp.opts = G.opts;
        DIST = [G]; di = 0; solved = [];
        initDist();
      }
      function spReset() {
        sp.d = 0; sp.cleared = 0; sp.over = false; sp.newBest = false;
        spStartLevel();
        sp.budget = sp.dist + 6;
      }
      function spAdvance() {
        sp.cleared++;
        if (sp.cleared > sp.best) { sp.best = sp.cleared; sp.newBest = true;
          if (MC_SAVE && MC_SAVE.set) MC_SAVE.set(SP_KEY, sp.cleared); }
        if (sp.daily) FRAME.daily.record('maxcut', sp.cleared);
        sp.d++;
        spStartLevel();
        sp.budget += sp.dist + 2;
      }
      function spBestLabel() {
        var b = $(root, '[data-r=spbest]');
        if (!b) return;
        b.textContent = sp.daily
          ? (FRAME.daily.best('maxcut') > 0 ? '· today: ' + FRAME.daily.best('maxcut') : '')
          : (sp.best > 0 ? ('· biggest sprawl: ' + sp.best + ' cit' + (sp.best === 1 ? 'y' : 'ies')) : '');
      }

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
        if (sp.on) {
          var g = DIST[0], dBest = sp.daily ? FRAME.daily.best('maxcut') : 0;
          $(root, '[data-r=dist]').innerHTML =
            '<div style="text-align:center;font-size:.9rem"><strong>' + (sp.daily ? 'Daily City ' : 'City ') + (sp.cleared + 1) +
            '</strong> · ' + g.n + ' districts · target cut <strong>' + g.par + '</strong>' +
            (sp.daily ? ' <span style="color:var(--muted)">· ' + FRAME.daily.date() +
              (dBest > 0 ? ' · today’s best ' + dBest : '') + (sp.best > 0 ? ' · all-time ' + sp.best : '') + '</span>' : '') +
            '<br><span style="color:var(--muted)">flips left this run: </span>' +
            '<strong style="color:' + (sp.budget <= 3 ? 'var(--yellow)' : 'inherit') + '">' + sp.budget + '</strong></div>';
          return;
        }
        $(root, '[data-r=dist]').innerHTML = DIST.map(function (d, i) {
          return '<span class="hole' + (i === di ? ' now' : '') + (solved[i] ? ' done' : '') + '" data-d="' + i +
                 '" title="District ' + (i+1) + ', par ' + d.par + '">' + (i+1) + '</span>';
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
          c.addEventListener('click', function () {
            color[i] = color[i] ? 0 : 1;
            if (sp.on) { sprawlClick(); } else render();
          });
          svg.appendChild(c);
        });
        var cut = cutVal(), W = d.E.length, energy = W - 2*cut, groundE = W - 2*d.par;
        var newlyOptimal = !sp.on && cut === d.par && !solved[di];
        if (newlyOptimal) solved[di] = true;
        var firstCut = (!sp.on && cut === d.par && di === winIdx) ? win('maxcut', opts) : false;
        var p = $(root, '[data-r=say]');
        if (msg) { p.className = 'verdict ' + msg.k; p.innerHTML = msg.t; }
        else if (sp.on) {
          p.className = 'verdict';
          p.innerHTML = '<strong>City ' + (sp.cleared + 1) + ', ' + d.n + ' districts.</strong> ' +
            'Two-colour it to <strong>cut ' + d.par + '</strong> of ' + W + ' roads, the proven maximum. ' +
            '<span style="color:var(--muted)">You open ' + sp.dist + ' flip' + (sp.dist === 1 ? '' : 's') +
            ' short, and no single flip is a shortcut. Every click spends a flip from your run budget.</span>';
        }
        else if (cut === d.par) {
          p.className = 'verdict good';
          p.innerHTML = '<strong>Maximum cut, ' + cut + '/' + d.par + '.</strong> This colouring is the Ising ground state (energy ' + groundE + '). ' + d.note;
          if (newlyOptimal && !mission) {
            var frustrated = d.par < W, shortfall = W - d.par;
            p.innerHTML += FRAME.ceremony('maxcut', {
              first: firstCut, head: 'Cut maximised',
              lines: [
                'Cut <strong>' + cut + '</strong> of ' + W + ' roads on ' + d.name + ', the proven maximum, brute-forced over all 2<sup>' + d.n + '</sup> colourings.',
                frustrated
                  ? 'The ' + shortfall + ' road' + (shortfall === 1 ? '' : 's') + ' left unsatisfied ' + (shortfall === 1 ? 'is' : 'are') +
                    ' frustration, an odd-loop theorem, not a shortfall of effort.'
                  : 'Every road satisfied, an even graph splits clean in two.'
              ]
            });
          }
        }
        else { p.className = 'verdict'; p.innerHTML = 'District ' + (di+1) + ', <strong>' + d.name + '</strong>. Satisfy as many roads as you can (par <strong>' + d.par + '</strong>). <span style="color:var(--muted)">' + d.note + '</span>'; }
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Cut</dt><dd>' + cut + ' / ' + d.par + (cut === d.par ? ', <strong style="color:var(--teal)">optimal</strong>' : '') + '</dd>' +
          '<dt>Ising energy</dt><dd>' + energy + ' <span style="color:var(--muted)">(ground state at ' + groundE + ')</span></dd>' +
          (sp.on
            ? '<dt>Flip budget</dt><dd>' + sp.budget + ' left</dd>' +
              '<dt>Cities cleared</dt><dd><strong>' + sp.cleared + '</strong>' +
                (sp.best > 0 ? ' &nbsp;<span style="color:var(--muted)">biggest sprawl ' + sp.best + '</span>' : '') + '</dd>'
            : '<dt>Districts solved</dt><dd>' + solved.filter(Boolean).length + ' of ' + DIST.length + '</dd>');
        chips();
        /* OUTBOUND ONLY, see Grover's emitter. Act III's scene needs to know
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
        if (sp.on && sp.over) return;
        for (var i = 0; i < DIST[di].n; i++) color[i] = color[i] ? 0 : 1;
        render({ k: 'split', t: '<strong>Same cut.</strong> Swapping every colour gives the identical partition, the two sides are interchangeable. That symmetry is why the Ising ground state always comes as a matched pair.' });
      });
      $(root, '[data-a=reset]').addEventListener('click', function () { if (sp.on) return; initDist(); render(); });

      /* ---- The Sprawl: run flow + mode toggle (arcade Standard/Guided) ---- */
      function sprawlClick() {
        if (sp.over) { render(); return; }
        sp.budget--;
        var cut = cutVal();
        if (cut === DIST[0].par) {
          spAdvance();                 // cleared++, best, sp.d++, new city, budget += dist+2
          syncMCmode();
          render({ k: 'good', t:
            '<strong>City ' + sp.cleared + ' cleared</strong>, cut maximised. Next: <strong>' + DIST[0].n +
            ' districts</strong>, target cut ' + DIST[0].par + ', ' + sp.budget + ' flips banked.' +
            (sp.newBest ? ' <strong style="color:var(--yellow)">Biggest sprawl yet: ' + sp.best + '.</strong>' : '') });
        } else if (sp.budget <= 0) {
          sp.over = true;
          syncMCmode();
          render({ k: 'bad', t:
            '<strong>Out of flips, the sprawl ends here.</strong> You cleared <strong>' + sp.cleared + '</strong> cit' +
            (sp.cleared === 1 ? 'y' : 'ies') +
            (sp.cleared > 0 && sp.cleared >= sp.best ? ', your best.' : sp.best > 0 ? ' (best: ' + sp.best + ').' : '.') +
            ' <button class="preset" type="button" data-a="spnew">New sprawl</button>' });
          var nb = $(root, '[data-r=say]').querySelector('[data-a=spnew]');
          if (nb) nb.addEventListener('click', function () { spReset(); syncMCmode(); render(); });
        } else render();
      }
      function syncMCmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = !sp.on ? 'dist' : sp.daily ? 'daily' : 'sprawl';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-gm]'), function (b) {
          var on = b.getAttribute('data-gm') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        var rb = $(root, '[data-a=reset]');
        if (rb) rb.style.display = sp.on ? 'none' : '';
        spBestLabel();
      }
      (function wireMCmode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        bar.querySelector('[data-gm=dist]').addEventListener('click', function () {
          sp.on = false; sp.daily = false; sp.over = false;
          DIST = ruthless ? DIST_RUTHLESS : DIST_STD; di = 0; solved = [];
          initDist(); syncMCmode(); render();
        });
        bar.querySelector('[data-gm=sprawl]').addEventListener('click', function () {
          sp.on = true; sp.daily = false; spReset(); syncMCmode(); render();
        });
        bar.querySelector('[data-gm=daily]').addEventListener('click', function () {
          sp.on = true; sp.daily = true; spReset(); syncMCmode(); render();
        });
        syncMCmode();
      })();

      initDist(); render();
    }
  };

  /* ==================================================================== *
   *  QUANTUM TIC-TAC-TOE, Kai & Lyra's mission                          *
   *  Goff, Am. J. Phys. 74, 962 (2006). Collapse engine verified on      *
   *  4,000 random entanglement tangles.                                  *
   * ==================================================================== */
  G.qttt = {
    id: 'qttt', title: 'Quantum Tic-Tac-Toe', mentor: 'Kai & Lyra',
    hook: 'Tic-tac-toe, but every move lands in two squares at once, until reality is forced to pick one.',
    about: {
      goal: 'Get three <strong>real</strong> marks in a line, after the collapses shake out. Two players, one board.',
      how: 'Each turn, place your mark in <strong>two</strong> squares at once. When your moves close a <strong>loop</strong>, that tangle is <strong>measured</strong> and collapses, a loop always forces this, because a chain of pushes that closes on itself has to agree with itself, and only two arrangements can, and your opponent chooses which way it falls.',
      inspired: 'Allan Goff’s <em>Quantum Tic-Tac-Toe</em> (<em>Am. J. Phys.</em> <strong>74</strong>, 962, 2006), a real teaching game used in classrooms.',
      learn: 'Superposition, entanglement and measurement-collapse, as a faithful <em>analogy</em>, not a literal qubit simulation.',
      link: 'quantum-mechanics.html#chsh', linkText: 'Real entanglement ▸', tier: 'analogy'
    },
    honest: 'Honest model: this is Allan Goff’s Quantum Tic-Tac-Toe (<em>Am. J. Phys.</em> <strong>74</strong>, 962 (2006)), a teaching game, a faithful <em>analogy</em> for superposition, entanglement and measurement, not a simulation of a physical qubit system. What is genuinely quantum-like: marks exist in two places until measured, a closed loop of entanglement forces a measurement, and a collapse has exactly two consistent outcomes. What is stylised: the collapse is <em>chosen</em> by a player rather than drawn at random, which is a game-design decision Goff made to keep it strategic. The collapse engine here was verified on 4,000 randomly generated entanglement tangles, every one produced a valid assignment with two distinct outcomes. The <strong>🔴 Ruthless</strong> card ("the Adversary") replaces the second person with a one-ply heuristic O: on a forced measurement it takes the collapse that denies you a line and builds one for itself, and on its own turn it plays its open lines and avoids handing you the choice. It is a sparring partner, not a solver, tested by playing it against a random opponent, where it wins by a wide margin.',
    mount: function (root, opts) {
      var mission = opts && opts.mode === 'mission';
      /* 🔴 RUTHLESS, "The Adversary". O is played by a one-ply heuristic
         instead of a second person: on a forced measurement it picks the
         collapse that denies you a line and takes one for itself; on its own
         turn it plays into its open lines, blocks yours, and avoids handing
         you the collapse. A sparring partner, not a solver, QTTT is a
         teaching analogy and the honest note says so. Verified behaviourally:
         verify_frame.mjs plays 120 games and checks it beats a random O by a
         clear margin and never stalls; tools/verify_qttt_ruthless.py unit-
         tests the two pure decision functions. */
      var ruthless = !mission && opts && opts.level === 'ruthless';

      /* ---- A1–A3: opponent + pass-a-link -----------------------------------
         Orthogonal to the 🟢/🟡/🔴 level system. 🔴 Ruthless keeps its
         meaning, "The Adversary", so it locks the hard AI and hides the
         picker. Everywhere else the picker defaults to pass-and-play, which
         is exactly the two-human hot-seat that shipped. A game can also be
         handed back and forth by link: the whole board state rides in a
         ?qg= query param, no server involved. */
      var opponent = ruthless ? 'ai' : 'human';   // 'human' | 'ai'
      var aiStrength = 'hard';                      // 'easy' | 'hard'
      var handoff = false;                          // A2: pass-the-device interstitial (pass & play only)
      var linkMode = false, localSide = 'X';
      var LINKPARAM = 'qg';
      var incoming = null;
      if (!mission && !ruthless) {
        try {
          var _qg = new URLSearchParams(location.search || '').get(LINKPARAM);
          if (_qg) incoming = decodeState(_qg);
        } catch (e) { incoming = null; }
      }

      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Opponent</span>' +
            '<button class="preset" type="button" data-opp="human">Pass &amp; play</button>' +
            '<button class="preset" type="button" data-opp="ai">vs Computer</button>' +
            '<button class="preset" type="button" data-opp="link">Pass a link</button>' +
            '<span data-r="diffwrap" style="display:none;align-items:center;gap:6px">' +
              '<span style="color:var(--muted)">·&nbsp;level</span>' +
              '<button class="preset" type="button" data-diff="easy">Easy</button>' +
              '<button class="preset" type="button" data-diff="hard">Hard</button>' +
            '</span>' +
            '<label data-r="handoffwrap" style="display:none;align-items:center;gap:5px;color:var(--muted);cursor:pointer">' +
              '<input type="checkbox" data-r="handoff"> pass-the-device prompt</label>' +
          '</div>') +
        '<div class="turnbar"><span class="who X on" data-r="wx">X</span>' +
        '<span style="color:var(--muted);font-size:.85rem" data-r="phase">pick two squares</span>' +
        '<span class="who O" data-r="wo">O</span></div>' +
        '<div class="qboard" style="position:relative">' +
          '<div class="qgrid" data-r="grid"></div>' +
          '<svg class="qthreads" data-r="threads" aria-hidden="true"></svg>' +
        '</div>' +
        '<p class="legend" style="text-align:center">Each <strong>thread</strong> ties the two squares one mark is living in. ' +
          'A thread is entanglement you can see, and when the threads close a <em>ring</em>, reality has to choose.</p>' +
        '<div class="verdict" style="text-align:center;margin-top:14px" data-r="say"></div>' +
        '<p style="margin:8px 0 4px;text-align:center">' +
          '<button class="preset" data-a="new">New game</button></p>' +
        '<div data-r="linkpanel" style="display:none;max-width:460px;margin:10px auto 0;text-align:center"></div>' +
        '<dl class="rows" data-r="rows"></dl>';

      var grid = $(root, '[data-r=grid]');
      var threads = $(root, '[data-r=threads]');
      var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      var moves, classical, turn, sel, moveNo, phase, pending, score;
      function reset() {
        moves = []; classical = {}; turn = 'X'; sel = []; moveNo = 1;
        phase = 'place'; pending = null; score = { X: 0, O: 0 };
        var veil = root.querySelector('.qhandoff');
        if (veil && veil.parentNode) veil.parentNode.removeChild(veil);
        draw('Place a mark in <strong>two</strong> squares, it lives in both until a loop forces a measurement.');
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
            ' squares</strong> are being measured together, two ways it can fall</dd>' : '') +
          '<dt>Score</dt><dd>X ' + score.X + ' · O ' + score.O + '</dd>';
        refreshLinkPanel();
      }
      // threads are measured from live layout, so they must be re-measured on resize
      window.addEventListener('resize', drawThreads);

      /* A2, the pass-the-device interstitial. Opt-in (a checkbox in the mode
         bar), pass & play only. On a turn change it lays a veil over the board
         naming whose turn it now is, cleared by a "ready" tap. QTTT is open
         information, so this is a turn-boundary marker on a shared device, not
         a secrecy screen -- and it is off by default, because the two-human
         hot-seat already worked without it. Inline-styled like the mode bars. */
      function showHandoff() {
        if (!handoff || linkMode || opponent !== 'human' || phase === 'over') return;
        var board = $(root, '.qboard');
        if (!board) return;
        var old = board.querySelector('.qhandoff');
        if (old) old.parentNode.removeChild(old);
        var veil = document.createElement('div');
        veil.className = 'qhandoff';
        veil.setAttribute('style',
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'background:var(--panel,#0d1117);border-radius:10px;z-index:5;text-align:center');
        veil.innerHTML =
          '<div><p style="margin:0 0 10px;font-size:.95rem">Pass the device to <strong>' + turn + '</strong>.</p>' +
          '<button type="button" class="preset" data-r="handoff-go">' + turn + ' is ready ▸</button></div>';
        veil.querySelector('[data-r=handoff-go]').addEventListener('click', function () {
          if (veil.parentNode) veil.parentNode.removeChild(veil);
        });
        board.appendChild(veil);
      }

      function click(s) {
        if (phase === 'collapse' || phase === 'over' || classical[s]) return;
        if (opponent === 'ai' && turn === 'O') return;   // O is the computer's to play
        if (linkMode && turn !== localSide) return;       // wait for the other player's link
        var k = sel.indexOf(s);
        if (k >= 0) { sel.splice(k, 1); draw('Pick two squares for ' + turn + '<sub>' + moveNo + '</sub>.'); return; }
        if (sel.length === 2) return;
        sel.push(s);
        if (sel.length < 2) { draw('Now pick the second square, the mark will live in both.'); return; }
        var placed = sel.slice(); sel = [];
        commitPair(placed[0], placed[1]);
      }
      /* Place `turn`'s pair, resolve the ring question, advance. Extracted from
         click() so the Ruthless AI drives the identical path a finger does. */
      function commitPair(a, b) {
        moves.push({ p: turn, n: moveNo, a: a, b: b });
        var all = edgesOf(), nid = all.length - 1;
        if (findCycle(all.filter(function (e) { return e[0] !== nid; }), a, b)) {
          pending = { opts: [collapse(0), collapse(1)] };
          phase = 'collapse';
          var chooser = turn === 'X' ? 'O' : 'X';
          turn = chooser;
          draw('<strong>The threads closed a ring, measurement.</strong> ' + chooser +
            ' decides how it falls. <em>Hover a glowing mark to see the whole outcome it drags with it</em>, then click to make that reality the real one. ' +
            'There are exactly two, and they are opposites: every square on the ring flips together.', 'split');
        } else {
          var last = moves[moves.length - 1];
          moveNo++; turn = turn === 'X' ? 'O' : 'X';   // advance BEFORE drawing: the HUD shows whose turn it now is
          draw('<strong>' + last.p + '<sub>' + last.n + '</sub> is now in two squares at once.</strong> ' +
            'The thread between them is real, neither square is decided until something forces the question. No ring yet.');
        }
        showHandoff();
        maybeAI();
      }
      function chooseGhost(sq, mi) {
        if (opponent === 'ai' && turn === 'O') return;   // O's collapse is the computer's to make
        if (linkMode && turn !== localSide) return;       // not this device's collapse to choose
        var o = pending.opts;
        var pick = (o[0] && o[0][sq] === mi) ? 0 : ((o[1] && o[1][sq] === mi) ? 1 : -1);
        if (pick < 0) return;
        applyChoice(pick);
      }
      function applyChoice(pick) {
        var o = pending.opts;
        clearPreview();
        applyCollapse(o[pick]);
        pending = null; phase = 'place'; moveNo++;
        var w = winners();
        if (w.length) {
          var firstQttt = win('qttt', opts);
          var best = w.slice().sort(function (a, b) { return a.max - b.max; });
          if (w.length === 1) score[best[0].p] += 1;
          else { score[best[0].p] += 1; if (best[1].p !== best[0].p) score[best[1].p] += 0.5; }
          // B1 medals: a win by the human (X) against the Hard computer / the
          // Ruthless Adversary is one tick toward a Quantum Tic-Tac-Toe medal.
          // Pass & play and "Pass a link" (opponent 'human') never count, nor
          // does the Easy computer.
          if (opponent === 'ai' && aiStrength === 'hard' && best[0].p === 'X') {
            try { MEDALS.bump('qttt'); } catch (e) {}
          }
          var cer = mission ? '' : FRAME.ceremony('qttt', {
            first: firstQttt, head: best[0].p + ' completed a line',
            lines: [
              'Three real marks, and every one of them began life in two squares at once.',
              'Each collapse was forced by a closed loop of entanglement: a chain of pushes that closes on itself has to agree with itself, and only two arrangements can.'
            ]
          });
          draw('<strong>' + best[0].p + ' takes a line.</strong> ' +
            (w.length > 1 ? 'Two lines formed, the one completed with the lower move number scores full. ' : '') +
            'Score: X ' + score.X + ' · O ' + score.O + '. <strong>New game</strong> to play again.' + cer, 'good');
          phase = 'over';
          return;
        }
        turn = turn === 'X' ? 'O' : 'X';
        draw('Collapsed. The ghosts in that tangle are now real. Play on.', 'good');
        showHandoff();
        maybeAI();
      }

      /* ---- 🔴 The Adversary: a one-ply heuristic O ------------------------ */
      // Lines completed for each side under a classical map (hypothetical or real).
      function tallyLines(cm) {
        var x = 0, o = 0;
        LINES.forEach(function (L) {
          if (!L.every(function (s) { return cm[s]; })) return;
          var ps = {}; L.forEach(function (s) { ps[cm[s].p] = 1; });
          if (Object.keys(ps).length === 1) { if (ps.X) x++; else o++; }
        });
        return { x: x, o: o };
      }
      // "open threats": lines with two of one side classical and the third empty.
      function threats(cm) {
        var x = 0, o = 0;
        LINES.forEach(function (L) {
          var cx = 0, co = 0, empty = 0;
          L.forEach(function (s) { var c = cm[s]; if (!c) empty++; else if (c.p === 'X') cx++; else co++; });
          if (empty === 1 && cx === 2) x++;
          if (empty === 1 && co === 2) o++;
        });
        return { x: x, o: o };
      }
      function hypo(assign) {
        var cm = {}; for (var s in classical) cm[s] = classical[s];
        Object.keys(assign).forEach(function (sq) { var m = moves[assign[sq]]; cm[sq] = { p: m.p, n: m.n }; });
        return cm;
      }
      // Higher = better FOR O. X lines are catastrophic; O lines are the goal.
      function scoreOutcome(assign) {
        var cm = hypo(assign), l = tallyLines(cm), t = threats(cm);
        return 1000 * l.o - 1200 * l.x + 8 * t.o - 10 * t.x;
      }
      function aiCollapse() {
        var o = pending.opts;
        applyChoice(scoreOutcome(o[0]) >= scoreOutcome(o[1]) ? 0 : 1);
      }
      // Score a candidate O pair (a, b). A ring-closing move is judged by the
      // outcome O is FORCED into (X will pick the collapse worst for O); a
      // non-closing move by how it builds O's lines and blunts X's.
      function placementScore(a, b) {
        moves.push({ p: 'O', n: moveNo, a: a, b: b });
        var all = edgesOf(), nid = all.length - 1;
        var closes = !!findCycle(all.filter(function (e) { return e[0] !== nid; }), a, b);
        var forced = null;
        if (closes) {
          // X, the chooser, minimises O's score -> O plans for the worse one
          forced = Math.min(scoreOutcome(collapse(0)), scoreOutcome(collapse(1)));
        }
        moves.pop();
        if (closes) return forced - 15;            // -15: handing X the choice is a mild cost

        // presence: classical = 1, each ghost in a square = 0.5
        var pres = [];
        for (var s = 0; s < 9; s++) pres[s] = { X: 0, O: 0 };
        for (var s2 = 0; s2 < 9; s2++) if (classical[s2]) pres[s2][classical[s2].p] = 1;
        moves.forEach(function (m) {
          if (!classical[m.a]) pres[m.a][m.p] += 0.5;
          if (!classical[m.b]) pres[m.b][m.p] += 0.5;
        });
        var sc = 0, oNear = 0;
        LINES.forEach(function (L) {
          var px = 0, po = 0;
          L.forEach(function (s) {
            px += pres[s].X;
            po += pres[s].O + ((s === a || s === b) ? 0.5 : 0);
          });
          if (px === 0 && po > 0) { sc += po * po * 4; if (po >= 2) oNear++; }   // O's own line
          if (po === 0 && px > 0) sc += px * px * 2.4;                           // sit on X's line
        });
        if (oNear >= 2) sc += 25;                  // a double threat X cannot answer in one move
        return sc;
      }
      function aiPlace() {
        var empt = [];
        for (var s = 0; s < 9; s++) if (!classical[s]) empt.push(s);
        if (empt.length < 2) { phase = 'over'; draw('The board is full, a draw. <strong>New game</strong>.', 'split'); return; }
        var bp = null, bs = -Infinity;
        for (var i = 0; i < empt.length; i++) for (var j = i + 1; j < empt.length; j++) {
          var v = placementScore(empt[i], empt[j]);
          if (v > bs) { bs = v; bp = [empt[i], empt[j]]; }
        }
        commitPair(bp[0], bp[1]);
      }
      /* Easy computer: a legal-but-thoughtless O, random pair, random
         collapse. The heuristic O above (used by 🔴 Ruthless and by the
         "Hard" pick) is the sparring partner; this is the one a newcomer
         can actually beat while learning the rules. */
      function aiPlaceEasy() {
        var empt = [];
        for (var s = 0; s < 9; s++) if (!classical[s]) empt.push(s);
        if (empt.length < 2) { phase = 'over'; draw('The board is full, a draw. <strong>New game</strong>.', 'split'); return; }
        var i = Math.floor(Math.random() * empt.length), j;
        do { j = Math.floor(Math.random() * empt.length); } while (j === i);
        commitPair(empt[i], empt[j]);
      }
      function aiCollapseEasy() { applyChoice(Math.random() < 0.5 ? 0 : 1); }
      var aiDelay = (opts && typeof opts.aiDelayMs === 'number') ? opts.aiDelayMs : 460;  // 0 = test seam
      function maybeAI() {
        if (opponent !== 'ai' || phase === 'over' || turn !== 'O') return;
        setTimeout(function () {
          if (turn !== 'O' || phase === 'over') return;
          if (phase === 'collapse' && pending) (aiStrength === 'easy' ? aiCollapseEasy : aiCollapse)();
          else if (phase === 'place') (aiStrength === 'easy' ? aiPlaceEasy : aiPlace)();
        }, aiDelay);
      }

      /* ---- pass-a-link: serialise the whole board into a URL --------------- */
      function b64urlEnc(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
      function b64urlDec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return atob(s); }
      function assignToArr(a) { return a ? Object.keys(a).map(function (k) { return [+k, a[k]]; }) : null; }
      function arrToAssign(x) { var o = {}; (x || []).forEach(function (p) { o[p[0]] = p[1]; }); return o; }
      function encodeState() {
        var st = {
          v: 1,
          m: moves.map(function (x) { return [x.p === 'X' ? 0 : 1, x.n, x.a, x.b]; }),
          c: Object.keys(classical).map(function (k) { return [+k, classical[k].p === 'X' ? 0 : 1, classical[k].n]; }),
          t: turn, mn: moveNo, ph: phase,
          pd: (phase === 'collapse' && pending) ? [assignToArr(pending.opts[0]), assignToArr(pending.opts[1])] : null,
          s: [score.X, score.O]
        };
        return b64urlEnc(JSON.stringify(st));
      }
      function decodeState(code) {
        try {
          var st = JSON.parse(b64urlDec(code));
          if (!st || st.v !== 1 || !Array.isArray(st.m)) return null;
          for (var i = 0; i < st.m.length; i++) {
            var mm = st.m[i];
            if (!mm || mm.length !== 4 || mm[2] < 0 || mm[2] > 8 || mm[3] < 0 || mm[3] > 8) return null;
          }
          return st;
        } catch (e) { return null; }
      }
      function applyIncoming(st) {
        moves = st.m.map(function (a) { return { p: a[0] ? 'O' : 'X', n: a[1], a: a[2], b: a[3] }; });
        classical = {}; (st.c || []).forEach(function (a) { classical[a[0]] = { p: a[1] ? 'O' : 'X', n: a[2] }; });
        turn = st.t === 'O' ? 'O' : 'X';
        moveNo = st.mn || (moves.length + 1);
        phase = (st.ph === 'collapse' || st.ph === 'over') ? st.ph : 'place';
        sel = [];
        score = { X: (st.s && st.s[0]) || 0, O: (st.s && st.s[1]) || 0 };
        pending = (phase === 'collapse' && st.pd) ? { opts: [arrToAssign(st.pd[0]), arrToAssign(st.pd[1])] } : null;
      }
      function refreshLinkPanel() {
        var panel = $(root, '[data-r=linkpanel]');
        if (!panel) return;
        if (!linkMode) { panel.style.display = 'none'; panel.innerHTML = ''; return; }
        panel.style.display = 'block';
        if (phase === 'over') {
          panel.innerHTML = '<span style="color:var(--muted);font-size:.85rem">Game over. ' +
            '<b>New game</b> starts a fresh one, you play X and send the first link.</span>';
          return;
        }
        if (turn === localSide) {
          panel.innerHTML = '<span style="color:var(--muted);font-size:.85rem">You are <strong>' + localSide +
            '</strong>. Make your move' + (phase === 'collapse' ? ', choose the collapse' : '') +
            '; a link to send back will appear here.</span>';
          return;
        }
        var url = location.origin + location.pathname + '?' + LINKPARAM + '=' + encodeState() + '#play/qttt';
        panel.innerHTML =
          '<span style="color:var(--muted);font-size:.85rem">Your move is in. Send this link to <strong>' + turn + '</strong>:</span>' +
          '<span style="display:flex;gap:6px;margin-top:6px">' +
            '<input type="text" readonly data-r="linkinput" value="' + url.replace(/"/g, '&quot;') + '" ' +
              'style="flex:1;min-width:0;font-size:.78rem;padding:6px 8px;border:1px solid var(--muted);' +
              'border-radius:6px;background:transparent;color:inherit">' +
            '<button class="preset" type="button" data-a="copylink">Copy</button>' +
          '</span>' +
          '<span data-r="copymsg" style="display:block;color:var(--teal);font-size:.78rem;min-height:1.1em;margin-top:4px"></span>';
        var inp = $(panel, '[data-r=linkinput]');
        $(panel, '[data-a=copylink]').addEventListener('click', function () {
          var say = function () { var m = $(panel, '[data-r=copymsg]'); if (m) m.textContent = 'Copied, paste it to the other player.'; };
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(inp.value).then(say, function () { inp.select(); say(); });
            } else { inp.select(); try { document.execCommand('copy'); } catch (e) {} say(); }
          } catch (e) { try { inp.select(); } catch (e2) {} }
        });
      }
      function newMatch() { if (linkMode) localSide = 'X'; reset(); }
      function wireModeBar() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        Array.prototype.forEach.call(bar.querySelectorAll('[data-opp]'), function (b) {
          b.addEventListener('click', function () {
            var v = b.getAttribute('data-opp');
            if (v === 'link') { linkMode = true; opponent = 'human'; localSide = 'X'; }
            else { linkMode = false; opponent = v; }
            try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
            syncModeUI(); reset();
          });
        });
        Array.prototype.forEach.call(bar.querySelectorAll('[data-diff]'), function (b) {
          b.addEventListener('click', function () { aiStrength = b.getAttribute('data-diff'); syncModeUI(); reset(); });
        });
        var hb = $(root, '[data-r=handoff]');
        if (hb) hb.addEventListener('change', function () { handoff = !!this.checked; });
      }
      function syncModeUI() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = linkMode ? 'link' : opponent;
        Array.prototype.forEach.call(bar.querySelectorAll('[data-opp]'), function (b) {
          var on = b.getAttribute('data-opp') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        var dw = $(root, '[data-r=diffwrap]');
        if (dw) dw.style.display = (opponent === 'ai' && !linkMode) ? 'inline-flex' : 'none';
        var hw = $(root, '[data-r=handoffwrap]');
        if (hw) hw.style.display = (opponent === 'human' && !linkMode) ? 'inline-flex' : 'none';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-diff]'), function (b) {
          var on = b.getAttribute('data-diff') === aiStrength;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
      }

      $(root, '[data-a=new]').addEventListener('click', newMatch);
      wireModeBar();
      syncModeUI();
      if (incoming) {
        linkMode = true; opponent = 'human';
        applyIncoming(incoming);
        localSide = turn;
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
        syncModeUI();
        draw((phase === 'collapse'
          ? '<strong>A game arrived by link, you are ' + localSide + '.</strong> The last move closed a ring: choose how it falls. Hover a glowing mark to preview the whole outcome, then click it.'
          : '<strong>A game arrived by link, you are ' + localSide + '.</strong> Make your move, then send the link back.'),
          phase === 'collapse' ? 'split' : '');
      } else {
        reset();
      }
    }
  };

  /* ==================================================================== *
   *  THE CHSH GAME, Kai & Lyra's mission                                *
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
      goal: 'Alice and Bob each get a random bit and answer with a bit. You win when <strong>a XOR b = x AND y</strong>. Beat <strong>75%</strong>, the provable classical ceiling.',
      how: 'Pick a strategy and play rounds. <strong>Best classical</strong> tops out at 75%, provably. <strong>Entangled pair</strong> reaches 85.4% and no further, that limit is Tsirelson’s bound.',
      inspired: 'The CHSH inequality (Clauser, Horne, Shimony &amp; Holt 1969), the experiment that won the 2022 Nobel Prize in Physics.',
      learn: 'That entanglement is <em>provably</em> not just hidden pre-arranged answers, and that it still cannot send a single bit.',
      link: 'quantum-mechanics.html#chsh', linkText: 'The full explainer ▸', tier: 'Proven'
    },
    honest: 'Honest model: the quantum side samples the <strong>exact</strong> Bell-state joint distribution P(a,b|x,y) = [1 + (−1)<sup>a+b</sup>cos(α−β)]/4 at the optimal angles, so nothing is scripted, the 85.4% emerges from the arithmetic. The classical side plays the best deterministic strategy, which wins on three of the four input pairs and therefore <strong>cannot</strong> exceed 75%; that bound is brute-forced over all 16 deterministic strategies. The quantum ceiling cos²(π/8) = 85.36% is <strong>Tsirelson’s bound</strong> and is also provable. The honest caveat, computed rather than guessed: over only 20 rounds a purely classical run posts a win rate above the 75% ceiling about <strong>40%</strong> of the time, a spurious "violation" that washes out with more data, which is exactly why real Bell tests need enormous trial counts. Over those same 20 rounds the classical strategy even out-scores an actual entangled pair about <strong>15%</strong> of the time; only the long run tells them apart. And crucially, <strong>both marginals are exactly 1/2 regardless of the other side’s setting</strong>, so this correlation is <strong>proven</strong> unable to carry a message.',
    mount: function (root, opts) {
      var mission = opts && opts.mode === 'mission';
      var NSVG = NS, W = 480, H = 200, L = 34, Rp = 8, TP = 12, BP = 26;
      var AA = [0, Math.PI / 2], BB = [Math.PI / 4, -Math.PI / 4];
      var CLASSICAL = 0.75, QUANTUM = Math.cos(Math.PI / 8) * Math.cos(Math.PI / 8);
      var quantum = true, n = 0, wins = 0, curve = [];
      var breached = false;
      // marginals[y][a], how often Alice answered a, split by Bob's setting
      var marg = [[0, 0], [0, 0]], margN = [0, 0];

      root.innerHTML =
        '<div class="chsh-inputs" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0">' +
          '<button class="preset on" data-a="q">Entangled pair</button>' +
          '<button class="preset" data-a="c">Best classical</button></div>' +
        '<div class="verdict" style="text-align:center" data-r="say"></div>' +
        '<svg viewBox="0 0 480 200" xmlns="' + NSVG + '" data-r="svg" style="display:block;width:100%;max-width:480px;margin:0 auto;height:auto" aria-label="Running win rate against the classical and quantum bounds"></svg>' +
        '<p class="legend" style="text-align:center">Alice sees <b data-r="x">, </b> and answers <b data-r="a">, </b> · Bob sees <b data-r="y">, </b> and answers <b data-r="b">, </b></p>' +
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
          'classical ceiling 75%, provable');
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
          $(root, '[data-r=' + k + ']').textContent = last ? last[k] : ', ';
        });
        var v = $(root, '[data-r=say]');
        if (!last) { v.className = 'verdict'; v.textContent = 'Pick a strategy and play a round.'; }
        else {
          v.className = 'verdict ' + (last.win ? 'good' : 'bad');
          v.innerHTML = last.win
            ? 'Won, answers ' + (last.a === last.b ? 'matched' : 'differed') + ', and both bits were ' +
              (last.x && last.y ? '1' : 'not both 1') + '.'
            : 'Lost, answers ' + (last.a === last.b ? 'matched' : 'differed') + ' when they should have ' +
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
        var line = !n ? ', '
          : real ? '<span style="color:var(--teal)">above the classical ceiling, beyond sampling noise</span>'
          : rate > CLASSICAL ? 'above 75%, but within sampling noise (&plusmn;' + (200 * se).toFixed(1) + ' pts)'
          : 'at or below the classical ceiling';
        $(root, '[data-r=rows]').innerHTML =
          '<dt>Strategy</dt><dd>' + (quantum ? 'entangled pair, optimal angles' : 'best possible classical') + '</dd>' +
          '<dt>Rounds</dt><dd>' + n.toLocaleString('en-US') + '</dd>' +
          '<dt>Win rate</dt><dd><strong>' + (100 * rate).toFixed(1) + '%</strong>' + (n ? ', ' + line : '') + '</dd>' +
          '<dt>Theory says</dt><dd>' + (quantum ? '85.4%' : '75.0%') + '</dd>';
        if (quantum && real) {                        // only a real breach counts
          var firstChsh = win('chsh', opts);
          if (!mission) {
            // re-appended every breached draw (draw() rewrites the verdict each
            // round), the badge + codex show only on the first breach render.
            v.innerHTML += FRAME.ceremony('chsh', {
              first: firstChsh && !breached, head: 'Classical ceiling broken',
              lines: [
                'Win rate <strong>' + (100 * rate).toFixed(1) + '%</strong> over ' + n.toLocaleString('en-US') +
                  ' rounds, past 75% by more than two standard errors. No strategy agreed in advance can stand here.',
                'And Alice’s answer split stays the same whichever setting Bob used, this correlation still carries no message.'
              ]
            });
            breached = true;
          }
        } else if (!quantum && n >= 200 && !mission) {
          // draw() rebuilds the verdict each round, so a plain re-append never doubles up
          v.innerHTML += '<div class="g-mentor">Kai &amp; Lyra: ' + FRAME.loss('chsh', 'classicalwall') + '</div>';
        }
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
        breached = false;
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

  /* ==================================================================== *
   *  THE DECODER DUEL, the finale's engine (Act VI, The Knot, Halden)   *
   *                                                                      *
   *  Ported out of qec.html so the Path and the Arcade can mount the     *
   *  same machine the explainer runs, exactly as CHSH was ported for     *
   *  Act V. THE ARITHMETIC IS UNCHANGED, same layout, same check        *
   *  structure, same exhaustive minimum-weight decoder over all 512      *
   *  bit-flip patterns, same round mix. Only the DOM plumbing differs:   *
   *  this copy builds its own markup inside whatever element it is       *
   *  handed instead of reaching for page ids.                            *
   *                                                                      *
   *  Verified independently in Python before the port (a reimplementation *
   *  written from the physics, not from this code):                      *
   *    · exactly 6 of the 12 adjacent pairs fool matching, all six      *
   *      VERTICAL, i.e. along the logical-X direction                    *
   *    · matching holds 9/9 single flips, 0/6 pure pair firings, and     *
   *      14/42 pair-plus-stray rounds                                    *
   *    · expected score over the ten-round structure: matching 4.67,     *
   *      "always repair the pair" 7.93, informed-optimal 9.26            *
   *    · the residue is real: one or two of the nine single flips per    *
   *      chip trip the IDENTICAL alarm as the coupled pair, so even a    *
   *      perfect player loses those, 81.5% on single rounds             *
   *                                                                      *
   *  ONE DELIBERATE ADDITION over the qec.html copy: `onState` carries   *
   *  matching's proposed repair BEFORE you commit. That is the           *
   *  opponent's public bet, not the truth, the truth (`truth`) is       *
   *  emitted only once the round is revealed, and the finale needs it,  *
   *  because automation bias is only possible when the machine's answer  *
   *  is available to take. Nothing about scoring consults it.            *
   * ==================================================================== */
  G.duel = {
    id: 'duel', title: 'Decoder Duel', mentor: 'Halden',
    hook: 'Ten rounds against the decoder the field has run since 2001, on a chip nobody told it about.',
    about: {
      goal: 'Read the alarms, repair what you think flipped, and hold the logical qubit more often than <strong>minimum-weight matching</strong> does over ten rounds.',
      how: 'Click the qubits you would repair, then <strong>Commit</strong>. The truth is revealed after every round and kept in the history table, that history is your training data.',
      inspired: 'Minimum-weight matching (Edmonds 1965; Dennis, Kitaev, Landahl &amp; Preskill 2001) against a learned decoder, the AlphaQubit result (Bausch et al., <em>Nature</em> 2024).',
      learn: 'Why a decoder that was handed an idealised noise model loses to one that reads the device it is actually running on.',
      link: 'qec.html#duel', linkText: 'The full explainer ▸', tier: 'Proven',
      or: 'Matching is an operations-research algorithm'
    },
    honest: 'Honest model: the lattice, the checks and the matching decoder are exact, the standard d=3 rotated surface code (Tomita &amp; Svore 2014) with true minimum-weight inference over all 512 bit-flip patterns. The fiction is the defect: one fixed, always-on coupled pair is far more blatant than real chip noise, which is a drifting mess of leakage, cross-talk and correlated readout spread over a d=3 or d=5 patch and 25 measurement rounds, inferred from hundreds of millions of simulated shots and thousands of real ones rather than ten. Measured over every chip and every round this game can deal: matching holds <strong>9 of 9</strong> single flips, <strong>0 of 6</strong> coupled-pair firings and <strong>14 of 42</strong> pair-plus-stray rounds, an expected <strong>4.7 of 10</strong>. Simply repairing the pair whenever its alarm fires reaches <strong>7.9</strong>; playing every round properly reaches <strong>9.3</strong>, and no further, because on each chip one or two of the nine single flips trip the <em>identical</em> alarm as the pair. Those rounds are genuinely undecidable and nobody wins them reliably, that irreducible residue is the <em>floor</em> under the logical error rate, not a flaw in the game.',
    mount: function (root, opts) {
      var mission = !!(opts && opts.mode === 'mission');
      var OPP = mission ? 'The reading' : 'Matching';
      // same surface-17 conventions and decoder as qec.html's explorer widget
      var ZS = [[0, 1, 3, 4], [4, 5, 7, 8], [2, 5], [3, 6]];
      var XS = [[0, 1], [1, 2, 4, 5], [3, 4, 6, 7], [7, 8]];
      var ZNAME = ['Z₁', 'Z₂', 'Z₃', 'Z₄'];
      var POS = [[90, 75], [180, 75], [270, 75], [90, 165], [180, 165], [270, 165], [90, 255], [180, 255], [270, 255]];
      // Vertical neighbour pairs only. Verified exhaustively: each of these,
      // firing as a unit, lands minimum-weight matching in the WRONG logical
      // class every time. The six horizontal ones do not, matching survives
      // those, so they would make a pointless duel.
      var PAIRS = [[0, 3], [3, 6], [1, 4], [4, 7], [2, 5], [5, 8]];
      var ROUNDS = 10;

      function mask(l) { var m = 0; for (var i = 0; i < l.length; i++) m |= 1 << l[i]; return m; }
      function weight(e) { var w = 0; while (e) { w += e & 1; e >>= 1; } return w; }
      var zM = ZS.map(mask), xM = XS.map(mask);
      function synd(e) { var o = 0; for (var i = 0; i < 4; i++) if (weight(e & zM[i]) & 1) o |= 1 << i; return o; }

      var xGroup = {};
      for (var st = 0; st < 16; st++) {
        var gg = 0;
        for (var gi = 0; gi < 4; gi++) if (st & (1 << gi)) gg ^= xM[gi];
        xGroup[gg] = true;
      }
      var order = [];
      for (var pp = 0; pp < 512; pp++) order.push(pp);
      order.sort(function (a, b) { return (weight(a) - weight(b)) || (a - b); });
      function decode(t) { for (var i = 0; i < order.length; i++) if (synd(order[i]) === t) return order[i]; return 0; }
      // A repair succeeds when the leftover is a stabilizer: something happened, nothing changed.
      function held(resid) { return synd(resid) === 0 && !!xGroup[resid]; }

      function rnd(n) { return Math.floor(Math.random() * n); }
      function qlist(e) { var o = []; for (var i = 0; i < 9; i++) if (e & (1 << i)) o.push('q' + i); return o.join(' + '); }
      function chips(e, kind) {
        if (!e) return '<span class="chip">nothing</span>';
        var o = [];
        for (var i = 0; i < 9; i++) if (e & (1 << i)) o.push('<span class="chip ' + kind + '">q' + i + '</span>');
        return o.join('');
      }
      function fired(s) { var nm = []; for (var i = 0; i < 4; i++) if (s & (1 << i)) nm.push(ZNAME[i]); return nm.length ? nm.join(', ') : 'none'; }

      // 4 ordinary single flips, 4 crosstalk-pair firings, 2 pair-plus-a-stray.
      // Round 1 is always an ordinary flip so the interface is learned on a fair round.
      function buildRounds(pair) {
        var pe = mask(pair), list = [1 << rnd(9)], kinds = [], i;
        for (i = 0; i < 3; i++) kinds.push('single');
        for (i = 0; i < 4; i++) kinds.push('pair');
        for (i = 0; i < 2; i++) kinds.push('both');
        for (i = kinds.length - 1; i > 0; i--) { var j = rnd(i + 1), t = kinds[i]; kinds[i] = kinds[j]; kinds[j] = t; }
        kinds.forEach(function (k) {
          if (k === 'single') list.push(1 << rnd(9));
          else if (k === 'pair') list.push(pe);
          else { var x; do { x = rnd(9); } while (pair.indexOf(x) >= 0); list.push(pe | (1 << x)); }
        });
        return list;
      }

      root.innerHTML =
        '<div class="duelwrap">' +
          '<div class="hud">' +
            '<div class="hud-side"><span class="hud-label">You</span><span class="hud-score" data-r="you">0</span></div>' +
            '<div class="hud-mid" data-r="round">Round 1 of 10</div>' +
            '<div class="hud-side right"><span class="hud-label">' + OPP + '</span><span class="hud-score" data-r="dec">0</span></div>' +
          '</div>' +
          '<div class="dotrow"><span class="who">You</span><span class="dots" data-r="dots-you"></span></div>' +
          '<div class="dotrow"><span class="who">' + OPP + '</span><span class="dots" data-r="dots-dec"></span></div>' +
          '<svg class="duelboard" viewBox="0 0 360 330" xmlns="' + NS + '" data-r="svg" ' +
            'aria-label="Decoder duel: a distance-3 surface code with hidden errors"></svg>' +
          '<p class="legend">◼ amber = a check firing · <span style="color:var(--teal)">◯ teal ring = your repair</span> · ' +
            '<span style="color:var(--violet)">◌ violet dashed = ' + (mission ? 'the cheapest explanation' : 'matching&rsquo;s repair') +
            '</span> · ⬤ red = what actually flipped (revealed after you commit)</p>' +
          '<p class="duelctl">' +
            '<button type="button" class="preset" data-a="commit">Commit repair</button>' +
            '<button type="button" class="preset" data-a="next">Next round</button>' +
            '<button type="button" class="preset" data-a="clear">Clear picks</button>' +
            '<button type="button" class="preset" data-a="new">New chip</button></p>' +
          '<div data-r="out" aria-live="polite"></div>' +
          '<div data-r="log"></div>' +
        '</div>';

      var svg = $(root, '[data-r=svg]'),
          out = $(root, '[data-r=out]'),
          logBox = $(root, '[data-r=log]'),
          hudYou = $(root, '[data-r=you]'),
          hudDec = $(root, '[data-r=dec]'),
          hudRound = $(root, '[data-r=round]'),
          dotsYou = $(root, '[data-r=dots-you]'),
          dotsDec = $(root, '[data-r=dots-dec]'),
          bCommit = $(root, '[data-a=commit]'),
          bNext = $(root, '[data-a=next]'),
          bClear = $(root, '[data-a=clear]');

      function sel(tag, attrs) { var n = el(tag, attrs); svg.appendChild(n); return n; }
      sel('rect', { 'class': 'px', x: 180, y: 75, width: 90, height: 90 });
      sel('rect', { 'class': 'px', x: 90, y: 165, width: 90, height: 90 });
      sel('path', { 'class': 'px', d: 'M90 75 A45 45 0 0 1 180 75 Z' });
      sel('path', { 'class': 'px', d: 'M180 255 A45 45 0 0 0 270 255 Z' });
      var zEls = [
        sel('rect', { 'class': 'pq', x: 90, y: 75, width: 90, height: 90 }),
        sel('rect', { 'class': 'pq', x: 180, y: 165, width: 90, height: 90 }),
        sel('path', { 'class': 'pq', d: 'M270 75 A45 45 0 0 1 270 165 Z' }),
        sel('path', { 'class': 'pq', d: 'M90 165 A45 45 0 0 0 90 255 Z' })
      ];
      var zLbl = [[129, 124], [219, 214], [286, 124], [74, 214]];
      for (var li = 0; li < 4; li++) {
        sel('text', { 'class': 'plabel', x: zLbl[li][0], y: zLbl[li][1] }).textContent = ZNAME[li];
      }
      var decRings = POS.map(function (q) { return sel('circle', { 'class': 'decring', cx: q[0], cy: q[1], r: 27, visibility: 'hidden' }); });
      var pickRings = POS.map(function (q) { return sel('circle', { 'class': 'pickring', cx: q[0], cy: q[1], r: 21, visibility: 'hidden' }); });
      var qEls = POS.map(function (q, idx) {
        /* The qubit a player taps is drawn at r=15, which is 30px only when the
           board is at its full 360. On a phone the board sits at ~258px and that
           becomes 21px, half the 44px touch minimum, on the primary control of
           the whole mission. So each qubit carries an INVISIBLE r=31 hit circle
           (44px rendered at a 256px board, and 62px across against a 90px grid
           pitch, so no two of them can overlap). The drawn geometry is the
           referee-verified surface-17 layout and is not touched. */
        var g = sel('g', { 'class': 'dqwrap' });
        // data-q is plumbing, not physics: it lets a mission scene drive these
        // the way a finger does, which is the only channel it is allowed.
        var c = el('circle', { 'class': 'dq', cx: q[0], cy: q[1], r: 15, tabindex: 0, role: 'button',
                               'aria-pressed': 'false', 'data-q': idx });
        var hit = el('circle', { 'class': 'dqhit', cx: q[0], cy: q[1], r: 31 });
        g.appendChild(c); g.appendChild(hit);
        function toggle() {
          if (!Gm || Gm.revealed || Gm.done) return;
          Gm.pick ^= 1 << idx;
          render();
        }
        g.addEventListener('click', toggle);
        c.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
        });
        return c;
      });

      var Gm = null;
      function newChip() {
        var pair = PAIRS[rnd(PAIRS.length)];
        Gm = { pair: pair, rounds: buildRounds(pair), i: 0, pick: 0, revealed: false, done: false, you: 0, dec: 0, log: [] };
        render();
      }

      function emit(extra) {
        if (!opts || typeof opts.onState !== 'function') return;
        var R = Gm.rounds[Gm.i], s = synd(R), dec = decode(s), show = Gm.revealed || Gm.done;
        var o = {
          phase: Gm.done ? 'finished' : 'render',
          round: Gm.i + 1, of: ROUNDS, syndrome: s, fired: fired(s),
          proposal: dec,                       // the opponent's public bet
          pick: Gm.pick, revealed: Gm.revealed, done: Gm.done,
          you: Gm.you, dec: Gm.dec, plays: Gm.log.length,
          truth: show ? R : null,              // never before the reveal
          pairFired: show ? ((R & mask(Gm.pair)) === mask(Gm.pair)) : null,
          pair: Gm.done ? Gm.pair.slice() : null,
          last: Gm.log.length ? Gm.log[Gm.log.length - 1] : null
        };
        if (extra) for (var k in extra) o[k] = extra[k];
        try { opts.onState(o); } catch (e) {}
      }

      function render() {
        var R = Gm.rounds[Gm.i], s = synd(R), dec = decode(s), show = Gm.revealed || Gm.done;
        for (var i = 0; i < 9; i++) {
          var bit = 1 << i, cls = 'dq';
          if (show && (R & bit)) { cls += ' flip'; if (Gm.pop) cls += ' popin'; }
          else if (!show && (Gm.pick & bit)) cls += ' armed';
          qEls[i].setAttribute('class', cls);
          qEls[i].setAttribute('aria-pressed', (Gm.pick & bit) ? 'true' : 'false');
          pickRings[i].setAttribute('visibility', (Gm.pick & bit) ? 'visible' : 'hidden');
          decRings[i].setAttribute('visibility', (show && (dec & bit)) ? 'visible' : 'hidden');
        }
        for (var j = 0; j < 4; j++) zEls[j].setAttribute('class', (s & (1 << j)) ? 'pq lit' : 'pq');

        hudYou.textContent = Gm.you;
        hudDec.textContent = Gm.dec;
        hudYou.className = 'hud-score' + (Gm.you > Gm.dec ? ' lead' : '');
        hudDec.className = 'hud-score' + (Gm.dec > Gm.you ? ' lead' : '');
        hudRound.textContent = Gm.done ? 'Final' : 'Round ' + (Gm.i + 1) + ' of ' + ROUNDS;
        renderDots();

        bCommit.disabled = Gm.revealed || Gm.done;
        bNext.disabled = !Gm.revealed || Gm.done;
        bClear.disabled = Gm.revealed || Gm.done;

        Gm.pop = false;
        if (Gm.done) { finalWord(); return; }
        if (!Gm.revealed) {
          out.innerHTML = 'Checks firing: <strong>' + fired(s) + '</strong>.<br>' +
            'Click the qubits you would repair, then <strong>Commit repair</strong>. Repairing nothing is a legal bet, sometimes the right one.';
        }
        renderLog();
        emit();
      }

      function commit() {
        if (Gm.revealed || Gm.done) return;
        var R = Gm.rounds[Gm.i], s = synd(R), dec = decode(s),
            youOk = held(R ^ Gm.pick), decOk = held(R ^ dec),
            stray = synd(Gm.pick) !== s;
        if (youOk) Gm.you++;
        if (decOk) Gm.dec++;
        Gm.revealed = true;
        Gm.log.push({ n: Gm.i + 1, s: s, R: R, youOk: youOk, decOk: decOk });

        var cls, head;
        if (youOk && !decOk) { cls = 'good'; head = '★ You held the logical qubit, ' + (mission ? 'the reading' : 'matching') + ' lost it.'; }
        else if (youOk && decOk) { cls = 'good'; head = 'Both of you held it.'; }
        else if (!youOk && decOk) { cls = 'bad'; head = (mission ? 'The reading' : 'Matching') + ' held it. You lost it.'; }
        else { cls = 'split'; head = 'Logical error, both of you.'; }

        function tail(okFlag, strayFlag) {
          if (strayFlag) return 'does not explain the alarms, a detectable error is left behind ✗';
          return okFlag ? 'residue is a product of checks, logically nothing happened ✓'
                        : 'residue is a logical operator, the encoded qubit flipped ✗';
        }
        var note = '';
        if (!decOk && (R & mask(Gm.pair)) === mask(Gm.pair)) {
          note = '<p class="duelnote"><em>It bought the cheapest explanation that fits the alarms. On this chip, that was the wrong bet.</em></p>';
        }
        out.innerHTML =
          '<div class="verdict ' + cls + '">' + head + '</div>' +
          '<dl class="rows">' +
          '<dt>Actually flipped</dt><dd>' + chips(R, 'err') + '</dd>' +
          '<dt>Your repair</dt><dd>' + chips(Gm.pick, 'you') +
            '<span style="color:var(--muted)">' + tail(youOk, stray) + '</span></dd>' +
          '<dt>' + (mission ? 'The reading’s repair' : 'Matching’s repair') + '</dt><dd>' + chips(dec, 'dec') +
            '<span style="color:var(--muted)">' + tail(decOk, false) + '</span></dd>' +
          '</dl>' + note;
        Gm.pop = true;
        render();
      }

      // Two rows of ten dots: the whole story of the game at a glance, and the
      // place where the textbook model's blind spot becomes a run of red.
      function renderDots() {
        function row(host, key) {
          var h = '';
          for (var r = 0; r < ROUNDS; r++) {
            var rec = Gm.log[r], c = 'dot';
            if (rec) c += rec[key] ? ' win' : ' lose';
            if (r === Gm.i && !Gm.done) c += ' now';
            if (rec && r === Gm.log.length - 1 && Gm.revealed) c += ' pop';
            h += '<span class="' + c + '" title="Round ' + (r + 1) + '"></span>';
          }
          host.innerHTML = h;
        }
        row(dotsYou, 'youOk');
        row(dotsDec, 'decOk');
      }

      function renderLog() {
        if (!Gm.log.length) { logBox.innerHTML = ''; return; }
        var h = '<details open class="duellog"><summary>Chip history, your training data (' + Gm.log.length +
          ' round' + (Gm.log.length === 1 ? '' : 's') + ')</summary><div class="overflow"><table>' +
          '<tr><th>#</th><th>Checks fired</th><th>What actually flipped</th><th>You</th><th>' + OPP + '</th></tr>';
        Gm.log.forEach(function (r) {
          h += '<tr><td>' + r.n + '</td><td>' + fired(r.s) + '</td><td>' + (r.R ? qlist(r.R) : ', ') +
            '</td><td>' + (r.youOk ? '✓' : '✗') + '</td><td>' + (r.decOk ? '✓' : '✗') + '</td></tr>';
        });
        logBox.innerHTML = h + '</table></div></details>';
      }

      function finalWord() {
        var cls, lead, frame = '';
        if (Gm.you > Gm.dec) {
          cls = 'good';
          lead = 'You beat minimum-weight matching, ' + Gm.you + '–' + Gm.dec + '. ' +
            'You did it the only way it can be done: you stopped assuming the chip was textbook and learned what it actually does. ' +
            'That is exactly AlphaQubit’s edge, a decoder that reads a real device’s noise off its own data instead of being handed an idealised model of it. ' +
            '(The architecture is new too: a recurrent transformer that eats the analog readout signal, not just a 0 or a 1.)';
          var firstDuel = win('duel', opts);
          if (!mission) frame = FRAME.ceremony('duel', {
            first: firstDuel, head: 'You out-read the decoder',
            lines: [
              'Final <strong>' + Gm.you + '–' + Gm.dec + '</strong>. You beat minimum-weight matching by reading this chip, not the textbook model it was handed.',
              'That is AlphaQubit’s edge in a sentence: the reading is never wrong about what it sees, only about what it cannot.'
            ]
          });
        } else if (Gm.you === Gm.dec) {
          cls = 'split';
          lead = 'Dead heat, ' + Gm.you + '–' + Gm.dec + '. Matching is genuinely hard to beat, it is optimal ' +
            'right up until its noise model is wrong. Run it again and watch which alarms keep lying to you.';
          if (!mission) { var tiedLine = FRAME.loss('duel', 'tied'); if (tiedLine) frame = '<div class="g-mentor">Halden: ' + tiedLine + '</div>'; }
        } else {
          cls = 'bad';
          lead = 'Matching won, ' + Gm.dec + '–' + Gm.you + '. No shame: it is a very good algorithm, ' +
            'and the field has agreed with it since 2001. The way past it is not to out-think it round by round, it is to notice the pattern it is structurally blind to.';
          if (!mission) { var lostLine = FRAME.loss('duel', 'lost'); if (lostLine) frame = '<div class="g-mentor">Halden: ' + lostLine + '</div>'; }
        }
        out.innerHTML = '<div class="verdict ' + cls + '" style="font-weight:400">' + lead + '</div>' +
          '<p style="margin:0">The defect on this chip: <strong>q' + Gm.pair[0] + ' ↔ q' + Gm.pair[1] + '</strong>, coupled neighbours that flipped together. ' +
          'Matching was handed the textbook noise model, not this chip’s, so it always bought the single cheapest flip instead, and paid for it in logical errors. ' +
          'Tell a matching decoder about this pair and it wins most of those rounds back; the whole point is that nobody has to tell a learned decoder. ' +
          '<strong>New chip</strong> moves the defect.</p>' + frame;
        renderLog();
        emit();
      }

      bCommit.addEventListener('click', commit);
      bNext.addEventListener('click', function () {
        if (!Gm.revealed || Gm.done) return;
        Gm.i++;
        if (Gm.i >= ROUNDS) { Gm.i = ROUNDS - 1; Gm.done = true; render(); return; }
        Gm.pick = 0; Gm.revealed = false;
        render();
      });
      bClear.addEventListener('click', function () { if (!Gm.revealed && !Gm.done) { Gm.pick = 0; render(); } });
      $(root, '[data-a=new]').addEventListener('click', newChip);
      newChip();
    }
  };

  /* ==================================================================== *
   *  THE CALIBRATION, a calibration agent, not a qubit, in your hands    *
   *                                                                      *
   *  You do not drive the qubit. Each of ten rounds you choose the       *
   *  AGENT's behaviour -- Trust / Nudge / Recalibrate -- while the       *
   *  qubit's true detuning drifts, and occasionally jumps, out of sight. *
   *                                                                      *
   *  Physics: the generalized (detuned) Rabi formula, of which           *
   *  circuits.html's own shipped P1(t)=sin^2(Omega t/2) is the Delta=0   *
   *  special case (verified to match exactly, see                       *
   *  tools/verify_calibration_agent.py, check 1). Every measurement is a *
   *  genuine Bernoulli shot -- shot noise, not an exact readout.         *
   *                                                                      *
   *  Design found empirically, not picked to look good: the same script *
   *  confirms a REACTIVE strategy (Recalibrate only after a low-fidelity *
   *  round, else Nudge) beats every fixed always-the-same-strategy       *
   *  baseline on average (0.693 vs best-fixed 0.668 over 8,000 games),   *
   *  but NOT on every single game -- on some drift trajectories a fixed  *
   *  strategy wins anyway (checked on 5 example seeds). That is the      *
   *  honest, non-rigged shape: skill pays off on average, luck still     *
   *  matters, exactly like this site's other games.                     *
   * ==================================================================== */
  G.calibration = {
    id: 'calibration', title: 'The Calibration',
    hook: 'You never touch the qubit. You configure the agent that has to find it, blind, while it drifts underneath you.',
    about: {
      goal: 'Ten rounds. Each round, choose the agent\'s behaviour, then see the TRUE fidelity it actually achieved. Beat your own best-fixed-strategy replay on the identical drift you just faced.',
      how: '<strong>Trust</strong>: spend the whole shot budget refining the last calibration, no exploring. <strong>Recalibrate</strong>: a coarse scan across the full range, rediscovering roughly where the peak is. <strong>Nudge</strong>: a narrow, precise scan near the last answer, catches small drift cheaply, misses big jumps completely. <strong>The Long Watch</strong> mode makes it endless: successive ten-round shifts, each with a target average you must clear, the churn rising and the shot budget shrinking as you go. Score is how many shifts you hold.',
      inspired: 'Real closed-loop qubit calibration under reinforcement learning: Baum et al. (Q-CTRL), <em>PRX Quantum</em> 2, 040324 (2021), RL designing gates directly against real superconducting hardware, no model supplied; and Sivak, Morvan et al., arXiv:2511.08493 (<em>Nature</em>, 2026), RL steering Google\'s Willow processor\'s own error correction in real time.',
      learn: 'Why real qubits need periodic recalibration at all, and the explore/exploit trade-off that decides how often.',
      link: 'circuits.html#calibration', linkText: 'The physics this reuses ▸', tier: 'Proven',
      or: 'Choosing when to explore vs. exploit under a fixed budget is a bandit problem'
    },
    honest: 'Honest model: the physics is the generalized detuned Rabi formula, P1(t;&Omega;,&Delta;) = (&Omega;&sup2;/(&Omega;&sup2;+&Delta;&sup2;))&middot;sin&sup2;(&radic;(&Omega;&sup2;+&Delta;&sup2;)&middot;t/2), standard driven-two-level-system physics, and at &Delta;=0 it reduces <strong>exactly</strong> to <a href="circuits.html#calibration">circuits.html\'s own shipped Rabi formula</a> (checked to machine precision). &Omega; is fixed, a device constant; only the detuning &Delta; drifts round to round (small continuous drift, plus a 25% chance each round of a real jump to a fresh value), the realistic scenario, since drive amplitude is normally calibrated separately from the resonance frequency drift that flux and TLS noise actually cause. Every measurement shown is a genuine Bernoulli sample of the true P1 at that drive duration, not an exact readout. <strong>Found empirically, not tuned to look good:</strong> Trust averages 0.640 fidelity, Nudge 0.634, Recalibrate 0.668, all measured over 8,000 simulated games, and a simple reactive rule (Recalibrate only right after a low-fidelity round, else Nudge) reaches 0.693, beating every fixed strategy, confirmed across three independent seed blocks and four reactive thresholds. That margin is real but not total: on some individual drift trajectories a fixed strategy still wins (checked directly, Nudge alone beats the reactive rule on 3 of 5 example seeds), because reading a genuinely noisy signal and reacting to it is better <em>on average</em>, not a guarantee. A human reading the actual scan trace below has more information than this simple threshold rule ever used, and may well do better still. The <strong>🔴 Ruthless</strong> card ("Budget Crunch") halves the shot budget to 12 a round: measured the same way over 8,000 games, Recalibrate, the best fixed play at full budget, <strong>collapses from 0.667 to 0.602, below Trust at 0.640</strong>, because a two-shot probe is mostly noise; a reactive reader still clears every fixed strategy at 0.655. <strong>The Long Watch</strong> (a Standard-mode option) is an endless run of ten-round shifts. The physics is <em>unchanged</em>,  same detuning range, same Rabi formula,  but each shift raises the jump rate and the drift speed, shrinks the shot budget, and lifts the target average you must hit, from a gentle 58.5% toward 71%,  which sits about a third of a standard deviation above a reactive reader&rsquo;s mean, so a strong shift still clears it (roughly a third of the time) and an average one does not. Clear a shift and the next is harder; miss the target and the watch ends. Measured over 6,000 games per shift by <code>tools/verify_calibration_longwatch.py</code>: a reactive reader beats the best fixed strategy on average fidelity at <em>every</em> difficulty (by 2.4&ndash;3.4 points), its clear rate exceeds any fixed strategy&rsquo;s by 5&ndash;14 points once the target bites, and holds near 37% (36.8% at the deepest) even at the hardest shift,  a stretch, never a wall. A <strong>Daily Watch</strong> option keeps a per-day best of the shift count: the escalation curve is already a pure function of the shift number, so it is the same challenge for everyone today, and only the drift luck differs,  the same honesty the base game already states. That also makes it the two-player mode: both players run the day&rsquo;s Daily Watch and compare shift counts, on the leaderboard or side by side. Verification scripts: <code>tools/verify_calibration_agent.py</code>, <code>tools/verify_calibration_ruthless.py</code>, <code>tools/verify_calibration_longwatch.py</code>, <code>tools/verify_daily.py</code>.',
    OMEGA: 1.5, TMAX: 2.6, NBINS: 26, SHOTS: 24, ROUNDS: 10, PJUMP: 0.25, DDRIFT: 0.05,
    DMIN: -1.6, DMAX: 1.6, NPROBES: 6, NUDGEWIN: 1,

    mount: function (root, opts) {
      var g = this, NSVG = NS;
      var NBINS = g.NBINS, TMAX = g.TMAX, OMEGA = g.OMEGA;
      /* 🔴 RUTHLESS, "Budget Crunch". Half the shots per round (12, not 24).
         Every probe is read from far fewer samples, so a coarse Recalibrate
         scan (2 shots per probe) can no longer pay for itself. Measured over
         8,000 games by tools/verify_calibration_ruthless.py: Recalibrate falls
         from 0.667 to 0.602, below Trust (0.640), while a reactive reader
         still clears every fixed strategy (0.655). Only SHOTS changes. */
      var mission = opts && opts.mode === 'mission';
      var ruthless = !mission && opts && opts.level === 'ruthless';
      var SHOTS = ruthless ? 12 : g.SHOTS;
      var TGRID = []; for (var i = 0; i < NBINS; i++) TGRID.push(0.05 + (TMAX - 0.05) * i / (NBINS - 1));

      /* ---- THE LONG WATCH: an endless, escalating score-chase --------------
         Standard/Guided arcade only (Ruthless + missions untouched). Each
         "shift" is a full 10-round run; clearing = your average fidelity >=
         wMark(d). Clear -> d rises: more jumps, faster drift, fewer shots, a
         higher target. Miss the target -> the watch ends. Score = shifts held.
         The detuning RANGE and the Rabi formula are unchanged from the base
         game -- only the churn, the budget and the mark move with d. Every
         property (skill-ordered at every d, target within a strong reactive
         shift's reach, monotone difficulty) is proved over 6,000 games/shift
         in tools/verify_calibration_longwatch.py. */
      var W_SAVE = window.SymbiQ && SymbiQ.save, WATCH_KEY = 'calibration.watch.best';
      var watch = { on: false, daily: false, d: 0, shifts: 0, over: false, newBest: false,
                    best: (W_SAVE && W_SAVE.get) ? (+W_SAVE.get(WATCH_KEY, 0) || 0) : 0 };
      function wPjump(d)  { return Math.min(0.20 + 0.025 * d, 0.55); }
      function wDdrift(d) { return 0.05 + 0.010 * d; }
      function wShots(d)  { return Math.max(14, 24 - 2 * Math.floor(d / 4)); }
      function wMark(d)   { return Math.min(0.71, 0.585 + 0.014 * d); }
      function curShots()  { return watch.on ? wShots(watch.d) : SHOTS; }
      function curPjump()  { return watch.on ? wPjump(watch.d) : g.PJUMP; }
      function curDdrift() { return watch.on ? wDdrift(watch.d) : g.DDRIFT; }

      function p1(t, delta) {
        var omEff = Math.sqrt(OMEGA * OMEGA + delta * delta);
        return (OMEGA * OMEGA / (OMEGA * OMEGA + delta * delta)) * Math.pow(Math.sin(omEff * t / 2), 2);
      }
      function binomialFrac(n, p) {
        var hits = 0;
        for (var i = 0; i < n; i++) if (Math.random() < p) hits++;
        return hits / n;
      }
      function shotsAt(idx, delta, n) { return binomialFrac(n, p1(TGRID[idx], delta)); }

      function resolve(name, lastIdx, delta) {
        var idxs, probes = [];
        if (name === 'trust') {
          idxs = [lastIdx];
        } else if (name === 'recalibrate') {
          idxs = []; for (var k = 0; k < g.NPROBES; k++) idxs.push(Math.round(k * (NBINS - 1) / (g.NPROBES - 1)));
        } else { // nudge
          idxs = [];
          for (var j = Math.max(0, lastIdx - g.NUDGEWIN); j <= Math.min(NBINS - 1, lastIdx + g.NUDGEWIN); j++) idxs.push(j);
        }
        var shots = curShots();
        var per = Math.floor(shots / idxs.length), extra = shots - per * idxs.length;
        var best = idxs[0], bestEst = -1;
        idxs.forEach(function (idx, k) {
          var n = per + (k < extra ? 1 : 0);
          var est = shotsAt(idx, delta, n);
          probes.push({ idx: idx, est: est, n: n });
          if (est > bestEst) { bestEst = est; best = idx; }
        });
        return { idx: best, probes: probes };
      }

      function newDelta(prev) {
        if (prev === null || Math.random() < curPjump()) {
          return { delta: g.DMIN + Math.random() * (g.DMAX - g.DMIN), jumped: prev !== null };
        }
        var d = prev + (Math.random() * 2 - 1) * curDdrift() * 1.6;
        return { delta: Math.max(g.DMIN, Math.min(g.DMAX, d)), jumped: false };
      }

      var S = {
        round: 0, lastIdx: Math.floor(NBINS / 2), delta: null,
        deltaHistory: [], fidHistory: [], lastProbes: [], over: false
      };

      root.innerHTML =
        (mission || ruthless ? '' :
          '<div class="qmodebar" data-r="modebar" style="display:flex;flex-wrap:wrap;gap:8px 10px;' +
            'align-items:center;justify-content:center;margin:0 0 12px;font-size:.85rem">' +
            '<span style="color:var(--muted)">Mode</span>' +
            '<button class="preset" type="button" data-gm="cal">Calibration</button>' +
            '<button class="preset" type="button" data-gm="watch">The Long Watch</button>' +
            '<button class="preset" type="button" data-gm="daily">Daily Watch</button>' +
            '<span data-r="watchbest" style="color:var(--muted)"></span>' +
          '</div>') +
        '<div class="hud" data-r="hud"></div>' +
        '<div class="verdict" style="text-align:center" data-r="say">Round 1 of ' + g.ROUNDS + ', the qubit is already drifting. Pick a behaviour.</div>' +
        '<svg viewBox="0 0 480 150" xmlns="' + NSVG + '" data-r="svg" style="display:block;width:100%;max-width:480px;margin:8px auto" aria-label="This round\'s measurement shots along the drive-duration axis"></svg>' +
        '<p class="legend" style="text-align:center">Each dot: one probed drive duration, height = measured fraction of shots that flipped. <span style="color:var(--teal)">&#9679;</span> the duration this round locked in.</p>' +
        '<div style="text-align:center;margin:10px 0">' +
          '<button class="preset" data-a="trust">Trust</button>' +
          '<button class="preset" data-a="nudge">Nudge</button>' +
          '<button class="preset" data-a="recalibrate">Recalibrate</button></div>' +
        '<div class="holes" data-r="dots" style="justify-content:center"></div>' +
        '<dl class="rows" data-r="summary"></dl>';

      var svg = $(root, '[data-r=svg]');
      function ael(tag, a, txt) {
        var e = document.createElementNS(NSVG, tag);
        for (var k in a) e.setAttribute(k, a[k]);
        if (txt != null) e.textContent = txt;
        svg.appendChild(e); return e;
      }
      var W = 480, H = 150, L = 30, TP = 14, BP = 26;
      function xOf(idx) { return L + (W - L - 14) * idx / (NBINS - 1); }
      function yOf(p) { return TP + (H - TP - BP) * (1 - Math.max(0, Math.min(1, p))); }

      function drawTrace() {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        ael('line', { x1: L, y1: yOf(0), x2: W - 10, y2: yOf(0), stroke: 'var(--border)' });
        ael('text', { x: (L + W - 10) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': '9', fill: 'var(--muted)' }, 'drive duration ->');
        S.lastProbes.forEach(function (pr) {
          var x = xOf(pr.idx), y = yOf(pr.est);
          var chosen = pr.idx === S.lastIdx;
          ael('line', { x1: x, y1: yOf(0), x2: x, y2: y, stroke: 'var(--muted)', 'stroke-width': '1', opacity: '0.5' });
          ael('circle', { cx: x, cy: y, r: chosen ? 6 : 4, fill: chosen ? 'var(--teal)' : 'var(--violet)' });
        });
      }

      function fidColor(f) { return f >= 0.75 ? 'var(--teal)' : f >= 0.5 ? 'var(--yellow)' : 'var(--red)'; }

      function renderHud() {
        var avg = S.fidHistory.length ? S.fidHistory.reduce(function (a, b) { return a + b; }, 0) / S.fidHistory.length : 0;
        var wTail = watch.daily
          ? ' · ' + FRAME.daily.date() + (FRAME.daily.best('calibration') > 0 ? ' · today ' + FRAME.daily.best('calibration') : '')
          : (watch.best > 0 ? ' · longest watch ' + watch.best : '');
        var mid = watch.on
          ? 'Shift ' + (watch.shifts + 1) + ', hold an average of <strong>' + (100 * wMark(watch.d)).toFixed(1) +
            '%</strong>.<br><span style="color:var(--muted)">' + wShots(watch.d) + ' shots/round · jumps ' +
            Math.round(wPjump(watch.d) * 100) + '% likely' + wTail + '</span>'
          : 'Detuning drifts every round.<br>You never see it directly.' +
            (ruthless ? '<br><span style="color:var(--red)">12 shots a round, half the usual.</span>' : '');
        $(root, '[data-r=hud]').innerHTML =
          '<div class="hud-side"><span class="hud-label">' + (watch.on ? 'Shift ' + (watch.shifts + 1) + ' · Round' : 'Round') +
            '</span><span class="hud-score">' + Math.min(S.round + 1, g.ROUNDS) + ' / ' + g.ROUNDS + '</span></div>' +
          '<div class="hud-mid">' + mid + '</div>' +
          '<div class="hud-side right"><span class="hud-label">Avg fidelity</span><span class="hud-score" style="color:' +
            fidColor(avg) + '">' + (100 * avg).toFixed(1) + '%</span></div>';
      }

      function renderDots() {
        // Colored TEXT + border on the existing neutral chip background (never a
        // solid colored fill with hardcoded text color) -- var(--teal/yellow/red)
        // are already chosen per light/dark theme site-wide, so this stays
        // correctly contrasted in both themes automatically, unlike a fixed
        // dark-on-bright fill that fails once the theme's colors darken.
        $(root, '[data-r=dots]').innerHTML = S.fidHistory.map(function (f, i) {
          var c = fidColor(f);
          return '<span class="hole" style="color:' + c + ';border-color:' + c + '" title="round ' + (i + 1) + ': ' +
            (100 * f).toFixed(0) + '%">' + (100 * f).toFixed(0) + '</span>';
        }).join('');
      }

      function playRound(name) {
        if (S.over) return;
        var nd = newDelta(S.delta);
        S.delta = nd.delta;
        var r = resolve(name, S.lastIdx, S.delta);
        S.lastIdx = r.idx; S.lastProbes = r.probes;
        var fid = p1(TGRID[S.lastIdx], S.delta);
        S.deltaHistory.push(S.delta);
        S.fidHistory.push(fid);
        S.round++;

        drawTrace();
        renderHud();
        renderDots();
        var v = $(root, '[data-r=say]');
        v.className = 'verdict';
        v.innerHTML = 'Played <b>' + name.charAt(0).toUpperCase() + name.slice(1) + '</b>, true fidelity this round: ' +
          '<b style="color:' + fidColor(fid) + '">' + (100 * fid).toFixed(1) + '%</b>' +
          (nd.jumped ? ' <span style="color:var(--red)">(something changed underneath you)</span>' : '');

        if (S.round >= g.ROUNDS) finish();
        emit();
      }

      function replayFixed(name) {
        // Re-run this exact recorded delta trajectory under one fixed strategy,
        // fresh shot noise each time (matches how the Python harness scores
        // fixed baselines) -- an honest, paired, same-qubit comparison.
        var idx = Math.floor(NBINS / 2), total = 0;
        for (var i = 0; i < S.deltaHistory.length; i++) {
          var rr = resolve(name, idx, S.deltaHistory[i]);
          idx = rr.idx;
          total += p1(TGRID[idx], S.deltaHistory[i]);
        }
        return total / S.deltaHistory.length;
      }

      function avgFid() { return S.fidHistory.reduce(function (a, b) { return a + b; }, 0) / S.fidHistory.length; }

      /* THE LONG WATCH, one shift resolved. Clear = your average >= wMark(d).
         The fixed-strategy replay is still shown, for context, but the GATE is
         the absolute mark (verify_calibration_longwatch.py proves the mark is
         skill-ordered and always below the reactive ceiling). */
      function watchFinish() {
        S.over = true;
        var avg = avgFid(), mark = wMark(watch.d);
        var base = { trust: replayFixed('trust'), nudge: replayFixed('nudge'), recalibrate: replayFixed('recalibrate') };
        var bestFixed = Math.max(base.trust, base.nudge, base.recalibrate);
        $(root, '[data-r=summary]').innerHTML =
          '<dt>Your average this shift</dt><dd><strong style="color:' + fidColor(avg) + '">' + (100 * avg).toFixed(1) + '%</strong></dd>' +
          '<dt>Shift target</dt><dd>' + (100 * mark).toFixed(1) + '%</dd>' +
          '<dt>Best fixed strategy, same drift</dt><dd>' + (100 * bestFixed).toFixed(1) + '%</dd>';
        var v = $(root, '[data-r=say]');
        if (avg >= mark) {
          watch.shifts++;
          if (watch.shifts === 1) win('calibration', opts);   // first shift held = the mission tick, once
          if (watch.shifts > watch.best) {
            watch.best = watch.shifts; watch.newBest = true;
            if (W_SAVE && W_SAVE.set) W_SAVE.set(WATCH_KEY, watch.shifts);
          }
          if (watch.daily) FRAME.daily.record('calibration', watch.shifts);
          watch.d++;
          watchStartShift();
          syncCalMode();
          v.className = 'verdict good';
          v.innerHTML = '<strong>Shift ' + watch.shifts + ' held.</strong> Average <strong>' + (100 * avg).toFixed(1) +
            '%</strong>, past the ' + (100 * mark).toFixed(1) + '% mark. Next: target <strong>' +
            (100 * wMark(watch.d)).toFixed(1) + '%</strong>, ' + wShots(watch.d) + ' shots/round, jumps ' +
            Math.round(wPjump(watch.d) * 100) + '% likely.' +
            (watch.newBest ? ' <strong style="color:var(--yellow)">Longest watch yet: ' + watch.best + '.</strong>' : '');
          return;
        }
        watch.over = true;
        syncCalMode();
        ['trust', 'nudge', 'recalibrate'].forEach(function (n) { $(root, '[data-a=' + n + ']').disabled = true; });
        v.className = 'verdict bad';
        v.innerHTML = '<strong>Below the ' + (100 * mark).toFixed(1) + '% mark, the watch ends.</strong> You held <strong>' +
          watch.shifts + '</strong> shift' + (watch.shifts === 1 ? '' : 's') +
          (watch.shifts > 0 && watch.shifts >= watch.best ? ', your best.' : watch.best > 0 ? ' (best: ' + watch.best + ').' : '.') +
          ' <button class="preset" data-a="wnew">New watch</button>';
        var nb = $(root, '[data-r=say]').querySelector('[data-a=wnew]');
        if (nb) nb.addEventListener('click', function () { watchReset(); syncCalMode(); });
        emit();
      }
      function watchStartShift() {
        S.round = 0; S.lastIdx = Math.floor(NBINS / 2); S.delta = null;
        S.deltaHistory = []; S.fidHistory = []; S.lastProbes = []; S.over = false;
        ['trust', 'nudge', 'recalibrate'].forEach(function (n) { var b = $(root, '[data-a=' + n + ']'); if (b) b.disabled = false; });
        // the summary is NOT cleared here: on a held shift it carries the shift
        // you just cleared into the next one as context, and is overwritten when
        // the next shift ends. watchReset() clears it for a fresh watch.
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        renderHud(); renderDots();
      }
      function watchReset() {
        watch.d = 0; watch.shifts = 0; watch.over = false; watch.newBest = false;
        watchStartShift();
        $(root, '[data-r=summary]').innerHTML = '';
        $(root, '[data-r=say]').className = 'verdict';
        $(root, '[data-r=say]').innerHTML = 'Shift 1, hold an average of <strong>' + (100 * wMark(0)).toFixed(1) +
          '%</strong> over ' + g.ROUNDS + ' rounds. The drift is already moving.';
      }

      function finish() {
        if (watch.on) { watchFinish(); return; }
        S.over = true;
        var avg = avgFid();
        var baselines = { trust: replayFixed('trust'), nudge: replayFixed('nudge'), recalibrate: replayFixed('recalibrate') };
        var bestFixed = Math.max(baselines.trust, baselines.nudge, baselines.recalibrate);
        var beat = avg > bestFixed;
        $(root, '[data-r=summary]').innerHTML =
          '<dt>Your average fidelity</dt><dd><strong style="color:' + fidColor(avg) + '">' + (100 * avg).toFixed(1) + '%</strong></dd>' +
          '<dt>Always Trust, same drift</dt><dd>' + (100 * baselines.trust).toFixed(1) + '%</dd>' +
          '<dt>Always Nudge, same drift</dt><dd>' + (100 * baselines.nudge).toFixed(1) + '%</dd>' +
          '<dt>Always Recalibrate, same drift</dt><dd>' + (100 * baselines.recalibrate).toFixed(1) + '%</dd>';
        var v = $(root, '[data-r=say]');
        v.className = 'verdict ' + (beat ? 'good' : 'bad');
        v.innerHTML = beat
          ? 'You beat every fixed strategy on the exact drift you faced (best fixed: ' + (100 * bestFixed).toFixed(1) + '%). <button class="preset" data-a="again">Play again</button>'
          : 'A fixed strategy would have done better this time (' + (100 * bestFixed).toFixed(1) + '% vs your ' + (100 * avg).toFixed(1) + '%), the qubit\'s own drift can still out-luck a reader. <button class="preset" data-a="again">Play again</button>';
        ['trust', 'nudge', 'recalibrate'].forEach(function (n) { $(root, '[data-a=' + n + ']').disabled = true; });
        var again = $(root, '[data-a=again]');
        if (again) again.addEventListener('click', reset);
        if (beat) win('calibration', opts);   // the endless-mode best (The Long Watch) is what carries the medal
        emit();
      }

      function reset() {
        S.round = 0; S.lastIdx = Math.floor(NBINS / 2); S.delta = null;
        S.deltaHistory = []; S.fidHistory = []; S.lastProbes = []; S.over = false;
        ['trust', 'nudge', 'recalibrate'].forEach(function (n) { $(root, '[data-a=' + n + ']').disabled = false; });
        $(root, '[data-r=summary]').innerHTML = '';
        $(root, '[data-r=say]').className = 'verdict';
        $(root, '[data-r=say]').textContent = 'Round 1 of ' + g.ROUNDS + ', the qubit is already drifting. Pick a behaviour.';
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        renderHud(); renderDots();
      }

      function emit() {
        if (!opts || typeof opts.onState !== 'function') return;
        try {
          opts.onState({
            phase: 'render', round: S.round, rounds: g.ROUNDS, over: S.over,
            fidHistory: S.fidHistory.slice(), avg: S.fidHistory.length ? avgFid() : 0,
            watch: watch.on, shift: watch.shifts, wd: watch.d, watchOver: watch.over
          });
        } catch (e) {}
      }

      /* ---- The Long Watch mode toggle (arcade Standard/Guided only) ------- */
      function syncCalMode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        var cur = !watch.on ? 'cal' : watch.daily ? 'daily' : 'watch';
        Array.prototype.forEach.call(bar.querySelectorAll('[data-gm]'), function (b) {
          var on = b.getAttribute('data-gm') === cur;
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.style.borderColor = on ? 'var(--teal)' : '';
          b.style.color = on ? 'var(--teal)' : '';
        });
        var wb = $(root, '[data-r=watchbest]');
        if (wb) wb.textContent = watch.daily
          ? (FRAME.daily.best('calibration') > 0 ? '· today: ' + FRAME.daily.best('calibration') + ' shift' + (FRAME.daily.best('calibration') === 1 ? '' : 's') : '')
          : (watch.best > 0 ? ('· longest watch: ' + watch.best + ' shift' + (watch.best === 1 ? '' : 's')) : '');
      }
      (function wireCalMode() {
        var bar = $(root, '[data-r=modebar]');
        if (!bar) return;
        bar.querySelector('[data-gm=cal]').addEventListener('click', function () {
          watch.on = false; watch.daily = false; watch.over = false;
          reset(); syncCalMode();
        });
        bar.querySelector('[data-gm=watch]').addEventListener('click', function () {
          watch.on = true; watch.daily = false; watchReset(); syncCalMode();
        });
        bar.querySelector('[data-gm=daily]').addEventListener('click', function () {
          watch.on = true; watch.daily = true; watchReset(); syncCalMode();
        });
        syncCalMode();
      })();

      ['trust', 'nudge', 'recalibrate'].forEach(function (n) {
        $(root, '[data-a=' + n + ']').addEventListener('click', function () { playRound(n); });
      });
      renderHud();
    }
  };

  /* ==================================================================== *
   *  THE FRAME, the cross-cutting layer, shared by every cabinet.       *
   *                                                                      *
   *  Scorekeeper plan, Part 4: the engines are correct and the framing   *
   *  undersells them, flat wins, failure without drama, no seed for a   *
   *  daily challenge. The FRAME adds those WITHOUT reaching into a        *
   *  verified engine: it only builds strings a game appends to the       *
   *  verdict it was already going to show, and a deterministic RNG the   *
   *  Contract of the Day (next) will seed from.                          *
   *                                                                      *
   *    FRAME.rng(seed)          mulberry32, same seed, same stream      *
   *    FRAME.daySeed(id[,date]) a stable 32-bit seed for "today + game"  *
   *    FRAME.loss(id, tags)     the mentor's line for THIS failure, in  *
   *                             their voice, about the flaw their act is *
   *                             built on. Character + consequence only;  *
   *                             the physics stays in `honest`.           *
   *    FRAME.ceremony(id, o)    a small "you cleared it" panel: the win, *
   *                             the already-true comparison to the       *
   *                             verified baseline, a codex line once.    *
   *                                                                      *
   *  Nothing here is scored, replayed, or read back by an engine.        *
   * ==================================================================== */
  var FRAME = (function () {
    function rng(seed) {
      var a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function daySeed(id, date) {
      var s = (date || new Date().toISOString().slice(0, 10)) + ':' + (id || '');
      var h = 2166136261;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }

    /* Every act is built on a flaw (see 12_ §3). This is that flaw spoken at
       the moment the player has just felt it. Keyed game -> failure tag. */
    var LOSS = {
      volcano: {
        crashcooled: 'You slammed it shut on the first move. The walker went downhill until it could not, and there it has sat since. Heat is what finds a floor, you never gave it any.',
        neversettled: 'You never once let it go cold. It wandered the whole budget and was still wandering when the run ended. Heat finds; cold keeps, you only did the first half.',
        trapped: 'You shaped it, and then went cold with the walker still on the wrong side of the ridge. A trap you can see is still a trap you are standing in.',
        luck: 'That descent froze on the floor, and replayed five hundred times, this same schedule mostly does not. One good run is not a rule. I know that better than anyone.'
      },
      grover: {
        overrotated: 'I said one more would make it certain. It made it worse, the exit’s odds fell as the turn carried past it. That one is on me. Stop at the top, not when I say so.',
        early: 'You committed while the exit was still climbing. Take it to the peak, then measure, not a step before.',
        peak: 'The peak, and it still went wide. That is the draw, not a mistake you made, even a tall bar is a gamble. Run the corridor again.'
      },
      golf: {
        overpar: 'You reached it, but not by the short road. Par here is a proven minimum: every gate past it is one the state did not need. Undo and look for the shorter word.',
        forcing: 'You are well past par and still turning. Reset the hole and find the key, I searched every gate word, and a shorter one exists.'
      },
      chsh: {
        classicalwall: 'That is the wall, and it is a theorem. The best script wins three of the four input pairs and loses the fourth every time, seventy-five percent, and no arrangement of answers agreed in advance gets past it. Only the shared pair does.'
      },
      duel: {
        lost: 'Matching out-scored you. It is a strong algorithm handed the wrong map, the way past it is to learn this chip, not to out-guess it round by round.',
        tied: 'A draw. Matching is optimal right up until its noise model is wrong; you have to catch the rounds where the alarm it trusts is the alarm that is lying.'
      }
    };
    function loss(id, tags) {
      var t = LOSS[id] || {}, list = [].concat(tags || []);
      for (var i = 0; i < list.length; i++) if (t[list[i]]) return t[list[i]];
      return '';
    }

    /* One line per game, shown only on a first-ever clear. Mirrors the Codex
       entry missions.js writes in mission mode, here it is just a sentence. */
    var CODEX = {
      volcano: 'Vesh: a schedule is a promise about when to stop looking. Made too early it traps you; made too late it never lands.',
      grover: 'Rue: amplitude is a rotation, not a climb. Past the peak, every extra turn is a step back toward the noise.',
      golf: 'Ada: the shortest word to a state is a fact about the state, not about your cleverness. Some doors have no two-gate key.',
      maxcut: 'Cordon: an odd loop cannot be split in two. The gap you cannot close is a theorem, not a shortfall of effort.',
      chsh: 'Kai & Lyra: the correlation breaks the classical ceiling and still cannot carry a word. Both are provable; neither is intuitive.',
      duel: 'Halden: the reading is never wrong about what it sees. It is wrong about what it cannot see, that is where you come in.',
      qttt: 'Kai & Lyra: a mark in two places is not indecision, it is the board owing reality an answer. A closed loop is reality collecting the debt.'
    };

    function ceremony(id, o) {
      o = o || {};
      var lines = [].concat(o.lines || []).filter(Boolean)
        .map(function (l) { return '<div class="g-cr-line">' + l + '</div>'; }).join('');
      var codex = (o.first && CODEX[id])
        ? '<div class="g-cr-codex">Codex, ' + CODEX[id] + '</div>' : '';
      return '<div class="g-ceremony">' +
        '<div class="g-cr-head">' + (o.head || 'Cleared') +
          (o.first ? ' <span class="g-cr-first">first time</span>' : '') + '</div>' +
        lines + codex + '</div>';
    }

    /* ---- THE CONTRACT OF THE DAY ------------------------------------------
       One challenge across the whole arcade, the same for everyone on a given
       date, drawn from daySeed. It is checked against the `onState` payload a
       cabinet already emits -- no engine change, no new scoring path. Clearing
       it feeds its own streak (symbiq_contract_v1), the daily-ritual sibling of
       the Question's streak. The public `mount` wrapper below feeds every
       cabinet's state here automatically, so any page that mounts a game
       advances the contract without wiring anything. */
    var CKEY = 'symbiq_contract_v1';

    function daysBetween(a, b) {
      return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
    }
    function cLoad() { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (e) { return {}; } }
    function cSave(s) { try { localStorage.setItem(CKEY, JSON.stringify(s)); } catch (e) {} }

    /* Every check reads only fields the named game's emit() already sends.
       Pars are proven minima, so "<=" can only ever be met with equality --
       it is written that way so a contract can never be literally impossible. */
    var CONTRACTS = [
      { game: 'grover', text: 'Grover’s Escape, clear the <b>16-door</b> corridor in <b>3 amplifications</b> (the peak).',
        check: function (s) { return s.phase === 'measured' && s.escaped && s.n === 16 && s.k <= 3; } },
      { game: 'grover', text: 'Grover’s Escape, clear the <b>64-door</b> corridor in <b>6 amplifications or fewer</b>.',
        check: function (s) { return s.phase === 'measured' && s.escaped && s.n === 64 && s.k <= 6; } },
      { game: 'grover', text: 'Grover’s Escape, clear the <b>8-door</b> corridor without over-rotating (measure at <b>k ≤ 2</b>).',
        check: function (s) { return s.phase === 'measured' && s.escaped && s.n === 8 && s.k <= 2; } },
      { game: 'golf', text: 'Circuit Golf, finish <b>Hole 6, |−i⟩</b>, at its proven par of <b>3</b>.',
        check: function (s) { return s.holeDone && s.hi === 5 && s.holeScore <= 3; } },
      { game: 'golf', text: 'Circuit Golf, finish <b>Hole 9, T T H |0⟩</b>, at par <b>2</b> (find the short way).',
        check: function (s) { return s.holeDone && s.hi === 8 && s.holeScore <= 2; } },
      { game: 'golf', text: 'Circuit Golf, clear <b>Holes 1 through 3</b> in one visit, each at par.',
        check: function (s) { return s.holeDone && s.hi <= 2 && s.played >= 3
          && s.holeScore <= [1, 1, 2][s.hi]; } },
      { game: 'maxcut', text: 'Max-Cut, reach the maximum cut on <b>the prism</b> (7 of 9 roads).',
        check: function (s) { return s.di === 5 && (s.optimal || s.cut === s.par); } },
      { game: 'maxcut', text: 'Max-Cut, reach the maximum cut on <b>the ring of five</b> (4 of 5).',
        check: function (s) { return s.di === 2 && (s.optimal || s.cut === s.par); } },
      { game: 'maxcut', text: 'Max-Cut, escape <b>the trap</b>: get its cut to <b>6</b> (it starts stuck at 5).',
        check: function (s) { return s.di === 4 && (s.optimal || s.cut === s.par); } },
      { game: 'volcano', text: 'The Annealing Volcano, clear <b>The Twin Calderas</b> (schedule past its 40% mark).',
        check: function (s) { return s.phase === 'finished' && s.li === 1 && s.rate >= s.bar; } },
      { game: 'volcano', text: 'The Annealing Volcano, clear <b>The Comb</b> with a schedule scoring <b>≥ 55%</b> over 500 replays.',
        check: function (s) { return s.phase === 'finished' && s.li === 2 && s.rate >= 0.55; } },
      { game: 'volcano', text: 'The Annealing Volcano, clear <b>The Long Descent</b> (schedule past its 40% mark).',
        check: function (s) { return s.phase === 'finished' && s.li === 4 && s.rate >= s.bar; } },
      { game: 'chsh', text: 'The CHSH Game, break the classical 75% ceiling with real significance over <b>≥ 200 quantum rounds</b>.',
        check: function (s) { return s.quantum && s.beatsClassical && s.rounds >= 200; } },
      { game: 'duel', text: 'The Decoder Duel, beat the reading by <b>3 or more</b> across the ten rounds.',
        check: function (s) { return s.phase === 'finished' && (s.you - s.dec) >= 3; } },
      { game: 'duel', text: 'The Decoder Duel, out-score the reading <b>at all</b> over the ten rounds, then name the coupled pair.',
        check: function (s) { return s.phase === 'finished' && s.you > s.dec; } },
      { game: 'calibration', text: 'The Calibration, finish the run with an <b>average fidelity ≥ 0.70</b>.',
        check: function (s) { return s.over && typeof s.avg === 'number' && s.avg >= 0.70; } }
    ];

    function contractFor(date) {
      date = date || new Date().toISOString().slice(0, 10);
      var c = CONTRACTS[daySeed('contract', date) % CONTRACTS.length];
      var s = cLoad(), h = (s.history && s.history[date]) || null;
      return { game: c.game, text: c.text, check: c.check, date: date, done: !!(h && h.done) };
    }
    function contractState() {
      var s = cLoad();
      return { streak: s.streak || 0, lastDate: s.lastDate || null,
               graceDate: s.graceDate || null, history: s.history || {} };
    }
    function contractRecord(t) {
      var s = cLoad();
      s.history = s.history || {};
      if (s.history[t.date] && s.history[t.date].done) return false;
      s.history[t.date] = { game: t.game, done: true };
      var gap = s.lastDate ? daysBetween(s.lastDate, t.date) : null;
      if (gap === null || gap === 1) s.streak = (s.streak || 0) + 1;
      else if (gap <= 0) { /* same day or a backward clock: leave the streak be */ }
      else if (gap === 2 && (!s.graceDate || daysBetween(s.graceDate, t.date) > 7)) {
        s.streak = (s.streak || 0) + 1; s.graceDate = t.date;
      } else s.streak = 1;
      s.lastDate = t.date;
      cSave(s);
      return true;
    }
    var contract = {
      onchange: null,
      today: contractFor,
      state: contractState,
      list: CONTRACTS,
      _observe: function (gameId, s) {
        var t = contractFor();
        if (t.done || gameId !== t.game || !s) return;
        var ok = false;
        try { ok = !!t.check(s); } catch (e) { ok = false; }
        if (!ok) return;
        if (contractRecord(t) && typeof contract.onchange === 'function') {
          try { contract.onchange(contractFor(), contractState()); } catch (e) {}
        }
      }
    };

    /* ---- THE DAILY CHALLENGE (B3) ---------------------------------------
       The Contract of the Day is ONE curated challenge for the whole
       arcade. This is its per-cabinet sibling: each endless mode can seed
       its generator from `daily.seed(id)` -- a value fixed for (game, day)
       and identical in every browser -- so everyone faces the same
       generated run today, and a per-day best is kept beside the all-time
       one. It is pure localStorage; the per-day record rolls over on its
       own when the date changes. This is the substrate a leaderboard (B4)
       reads: daily.todayAll() is a ready payload. */
    var DKEY = 'symbiq_daily_v1';
    function dToday() { return new Date().toISOString().slice(0, 10); }
    function dLoad() { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch (e) { return {}; } }
    function dSave(s) { try { localStorage.setItem(DKEY, JSON.stringify(s)); } catch (e) {} }
    var daily = {
      date: dToday,
      // a 32-bit seed unique to (game, date); the same everywhere, new at midnight
      seed: function (id, date) { return daySeed('daily:' + (id || ''), date || dToday()); },
      // this browser's best for `id` on `date` (default today); 0 if none
      best: function (id, date) {
        date = date || dToday();
        var rec = dLoad()[id];
        return (rec && rec.date === date) ? (rec.best || 0) : 0;
      },
      // keep the max score for the day; roll over on a new date. Returns true
      // on a new personal daily best (for a "new best!" flourish).
      record: function (id, score, date) {
        date = date || dToday();
        var s = dLoad(), rec = s[id];
        if (!rec || rec.date !== date) { s[id] = { date: date, best: score }; dSave(s); return true; }
        if (score > (rec.best || 0)) { rec.best = score; dSave(s); return true; }
        return false;
      },
      // {id: best} for every cabinet recorded today -- a leaderboard payload
      todayAll: function () {
        var s = dLoad(), t = dToday(), out = {};
        for (var k in s) if (s.hasOwnProperty(k) && s[k] && s[k].date === t) out[k] = s[k].best;
        return out;
      }
    };

    return { rng: rng, daySeed: daySeed, loss: loss, ceremony: ceremony, daily: daily,
             CODEX: CODEX, contract: contract };
  })();

  /* ==================================================================== *
   *  MEDALS, personal bests + bronze / silver / gold, per cabinet.      *
   *                                                                      *
   *  Scorekeeper plan, Part 4 (B1): the arcade records a best for each   *
   *  score-chase cabinet and shows almost none of it. This surfaces one  *
   *  number per machine and puts a medal on it. localStorage ONLY, no   *
   *  back end (that is B4). It never touches an engine's physics: for    *
   *  the four endless modes it just READS the best the mode already      *
   *  saves; for the two that had no score-chase it adds a plain +1       *
   *  counter, written from the same win path the ceremony already fires  *
   *  on (a save-bag write, exactly like grover.deepdive.best).           *
   *                                                                      *
   *    golf / grover / maxcut / volcano / calibration                    *
   *        -> the endless mode's own saved best (holes / corridors /     *
   *           cities / descents / shifts)                                *
   *    qttt -> wins against The Adversary (the Hard computer): the one   *
   *           cabinet with no score-chase, so a plain +1 counter        *
   *                                                                      *
   *  THRESHOLDS are difficulty calls, NOT proven optima, the same       *
   *  status as the Ruthless `bar` pass marks. tools/verify_medals.py     *
   *  proves what can be proved: strict ordering everywhere; every        *
   *  endless bronze == 1 (= clear the mode's first level, which that     *
   *  mode's own accept gate already proves winnable); every endless      *
   *  gold below its mode's structural ceiling and reachable by flawless  *
   *  play (it re-uses the budget_perfect / longwatch proof from each     *
   *  mode's own verifier); the qttt thresholds ascending positive ints.  *
   * ==================================================================== */
  var MEDALS = (function () {
    // The key each cabinet's best lives under. The first five are the exact
    // keys the endless modes already write (DD_KEY / DESC_KEY / SP_KEY /
    // LG_KEY / WATCH_KEY above); qttt is new, written only by bump() below.
    var KEY = {
      golf: 'golf.longgame.best', grover: 'grover.deepdive.best',
      maxcut: 'maxcut.sprawl.best', volcano: 'volcano.descent.best',
      calibration: 'calibration.watch.best', qttt: 'qttt.medalcount'
    };
    // bronze < silver < gold, per cabinet. verify_medals.py enforces the order
    // and the attainability of gold.
    var TIERS = {
      golf:        { bronze: 1, silver: 6, gold: 12, unit: 'holes',     mode: 'The Long Game' },
      grover:      { bronze: 1, silver: 5, gold: 10, unit: 'corridors', mode: 'Deep Dive' },
      maxcut:      { bronze: 1, silver: 5, gold: 10, unit: 'cities',    mode: 'The Sprawl' },
      volcano:     { bronze: 1, silver: 4, gold: 8,  unit: 'descents',  mode: 'The Descent' },
      calibration: { bronze: 1, silver: 4, gold: 8,  unit: 'shifts',    mode: 'The Long Watch' },
      qttt:        { bronze: 1, silver: 5, gold: 12, unit: 'wins',      mode: 'vs The Adversary' }
    };
    var ORDER = ['golf', 'grover', 'maxcut', 'volcano', 'qttt', 'calibration'];

    function save() { return window.SymbiQ && SymbiQ.save; }
    function bestOf(id) {
      var S = save();
      var v = (S && S.get) ? +S.get(KEY[id], 0) : 0;
      return (isFinite(v) && v > 0) ? Math.floor(v) : 0;
    }
    // +1 to the COUNT cabinet's tally (qttt only -- it has no score-chase).
    // The five endless modes never call this; they write their own best.
    function bump(id) {
      var S = save();
      if (!S || !S.set || id !== 'qttt') return bestOf(id);
      var n = bestOf(id) + 1;
      try { S.set(KEY[id], n); } catch (e) {}
      return n;
    }
    function medalOf(id) {
      var t = TIERS[id], b = bestOf(id);
      var got = b >= t.gold ? 'gold' : b >= t.silver ? 'silver' : b >= t.bronze ? 'bronze' : 'none';
      var next = got === 'gold' ? null
               : got === 'silver' ? { tier: 'gold', at: t.gold }
               : got === 'bronze' ? { tier: 'silver', at: t.silver }
               : { tier: 'bronze', at: t.bronze };
      return { medal: got, best: b, next: next };
    }
    function table() {
      return ORDER.map(function (id) {
        var m = medalOf(id), t = TIERS[id];
        return { id: id, title: (G[id] && G[id].title) || id, mode: t.mode, unit: t.unit,
                 best: m.best, medal: m.medal, next: m.next,
                 bronze: t.bronze, silver: t.silver, gold: t.gold };
      });
    }
    function summary() {
      var c = { gold: 0, silver: 0, bronze: 0, none: 0 };
      ORDER.forEach(function (id) { c[medalOf(id).medal]++; });
      return c;
    }
    return { KEY: KEY, TIERS: TIERS, order: ORDER,
             bestOf: bestOf, bump: bump, medalOf: medalOf, table: table, summary: summary };
  })();

  /* ==================================================================== *
   *  DIFFICULTY, one selector, in the site's own language, in the chrome *
   *                                                                      *
   *  Scorekeeper plan, Part 4: "every cabinet gets 🟢 First time (guided, *
   *  narrated), 🟡 Standard (today's game), 🔴 Ruthless (new constraints).*
   *  One selector component in games.js chrome, not per-engine forks."    *
   *                                                                      *
   *  It never reaches into an engine. All it does:                       *
   *    - persist ONE global choice (games.level in the save bag)         *
   *    - stamp data-glevel on the game root so CSS can show or hide the  *
   *      guidance the engine ALREADY renders (the .legend strips, the    *
   *      rules panel), this is INFORMATION, not softened physics, the   *
   *      same honesty the Calibration's "training wheels are info" note  *
   *      already states.                                                 *
   *    - hand the engine opts.level, which today's engines ignore. That  *
   *      is the seam the per-game Ruthless levels (each with its own     *
   *      tools/verify_*.py) will read later.                             *
   * ==================================================================== */
  var LEVELS = (function () {
    var IDS = ['guided', 'standard', 'ruthless'];
    var META = {
      guided:   { icon: '🟢', label: 'Guided',
                  blurb: 'Every hint on screen, the rules open, and a plain-language orientation for the cabinet.' },
      standard: { icon: '🟡', label: 'Standard',
                  blurb: 'The game as it is built, pars, bars and the honest model, nothing added or removed.' },
      ruthless: { icon: '🔴', label: 'Ruthless',
                  blurb: 'No orientation, no legend, rules closed, and every cabinet has a harder card: the Back Nine, the Long Corridors, the Frustrated Ward, the Deep Country, the Adversary, Budget Crunch.' }
    };
    /* One plain sentence per cabinet, shown ONLY at 🟢. Chrome text, no logic,
       it says what the buttons do, never changes what they do. */
    var ORIENT = {
      golf:        'Tap a gate to rotate the qubit. Land the solid teal arrow on the dashed target in as few gates as par allows.',
      grover:      'Amplify pumps the exit’s odds up; Measure takes the shot. Stop at the peak, extra amplifies push the odds back down.',
      maxcut:      'Click a district to flip its colour. A road counts only when its two ends differ. Match par and you have the Ising ground state.',
      volcano:     'You set the temperature, not the walker. Hot lets it climb out of traps; cold locks it in place. End the run frozen on the floor.',
      qttt:        'Each turn you place one mark in TWO squares at once. When your marks close a loop, that loop is measured, and your opponent picks how it falls.',
      calibration: 'You configure the agent, never the qubit. Each round pick Trust, Nudge or Recalibrate while the detuning drifts out of sight.',
      chsh:        'Pick a strategy and play rounds. Best classical tops out at 75%; the entangled pair reaches 85.4%, and still cannot send a message.',
      duel:        'Read the alarms, click the qubits you would repair, then Commit. The truth shows after every round, that history is your training data.'
    };
    var LKEY = 'games.level', LS = 'symbiq_games_level', mem = null, subs = [];

    function get() {
      var v = mem;
      try {
        if (window.SymbiQ && SymbiQ.save && SymbiQ.save.get) { var sv = SymbiQ.save.get(LKEY, null); if (sv != null) v = sv; }
        if (v == null) v = localStorage.getItem(LS);
      } catch (e) {}
      return IDS.indexOf(v) >= 0 ? v : 'standard';
    }
    function set(id) {
      if (IDS.indexOf(id) < 0) return get();
      mem = id;
      try {
        if (window.SymbiQ && SymbiQ.save && SymbiQ.save.set) SymbiQ.save.set(LKEY, id);
        else localStorage.setItem(LS, id);
      } catch (e) {}
      for (var i = 0; i < subs.length; i++) { try { subs[i](id); } catch (e) {} }
      return id;
    }
    function onChange(fn) { if (typeof fn === 'function') subs.push(fn); }

    function orientInner(id) {
      return (get() === 'guided' && ORIENT[id])
        ? '<p class="glevel-orient">🟢 ' + ORIENT[id] + '</p>' : '';
    }
    // selector + an orientation slot the wiring refills on change
    function chromeHTML(id) {
      var cur = get();
      return '<div class="gamechrome">' +
        '<div class="glevel" role="group" aria-label="Difficulty">' +
          IDS.map(function (k) {
            var m = META[k];
            return '<button type="button" class="glevel-b" data-lvl="' + k + '" aria-pressed="' +
              (k === cur ? 'true' : 'false') + '">' +
              '<span class="glevel-i" aria-hidden="true">' + m.icon + '</span>' + m.label + '</button>';
          }).join('') +
          '<p class="glevel-blurb" data-r="blurb">' + META[cur].blurb + '</p>' +
        '</div>' +
        '<div class="glevel-orient-slot" data-r="orient">' + orientInner(id) + '</div>' +
      '</div>';
    }
    /* Wire a rendered selector. `scope` holds the .glevel; `gameEl` (optional)
       is the mounted game root to re-stamp; `rules` (optional) is the <details>
       to open/close. Live, no remount, so a game in progress is untouched. */
    function wire(scope, gameEl, id, rules) {
      if (!scope) return;
      var pick = scope.querySelector('.glevel');
      if (!pick) return;
      var blurb = pick.querySelector('[data-r=blurb]');
      var slot = scope.querySelector('[data-r=orient]');
      Array.prototype.forEach.call(pick.querySelectorAll('.glevel-b'), function (b) {
        b.addEventListener('click', function () {
          var v = set(b.getAttribute('data-lvl'));
          Array.prototype.forEach.call(pick.querySelectorAll('.glevel-b'), function (x) {
            x.setAttribute('aria-pressed', x.getAttribute('data-lvl') === v ? 'true' : 'false');
          });
          if (blurb) blurb.textContent = META[v].blurb;
          if (slot) slot.innerHTML = orientInner(id);
          if (gameEl) gameEl.setAttribute('data-glevel', v);
          if (rules) rules.open = (v === 'guided');
        });
      });
    }

    return { IDS: IDS, get: get, set: set, onChange: onChange,
             chromeHTML: chromeHTML, orientInner: orientInner, wire: wire };
  })();

  /* -------------------------------------------------------------------- */
  window.SymbiQ.games = {
    all: G,
    frame: FRAME,
    medals: MEDALS,
    levels: LEVELS.IDS,
    level: LEVELS.get,
    setLevel: LEVELS.set,
    onLevelChange: LEVELS.onChange,
    chromeHTML: function (id) { return LEVELS.chromeHTML(id); },
    wireLevel: function (scope, gameEl, id, rules) { return LEVELS.wire(scope, gameEl, id, rules); },
    list: ['golf', 'grover', 'maxcut', 'volcano', 'qttt', 'calibration'].map(function (k) {
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
      // difficulty overrides the seen-once default: 🟢 always open, 🔴 always shut
      var lvl = LEVELS.get();
      var open = lvl === 'guided' || (lvl !== 'ruthless' && !seen);
      return '<details class="gamerules"' + (open ? ' open' : '') + '>' +
        '<summary><span class="gr-ico" aria-hidden="true">🕹️</span>' +
          '<span class="gr-txt"><b>How to play</b>' +
          '<i>the goal, the rules, and what you will get a feel for</i></span>' +
          '<span class="gr-x" aria-hidden="true"></span></summary>' +
        '<div class="gameabout">' +
        '<div><span class="lbl">🎯 The goal</span> ' + a.goal + '</div>' +
        '<div data-f="how"><span class="lbl">🕹️ How to play</span> ' + a.how + '</div>' +
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
      opts = opts || {};
      /* Difficulty stamp, CSS reads data-glevel to show/hide the guidance the
         engine already renders. opts.level is the seam the per-game Ruthless
         levels will read; today's engines ignore it (no fork). */
      elm.setAttribute('data-g', id);
      elm.setAttribute('data-glevel', LEVELS.get());
      if (opts.level == null) opts.level = LEVELS.get();
      /* Feed every cabinet's state to the Contract of the Day, on any page,
         without the game or the page wiring anything. The game's own
         onState (if the caller passed one) is chained, not replaced. */
      var caller = opts.onState;
      /* The Contract of the Day is a Standard-mode ritual: its checks are
         written against the Standard cabinets (specific holes, districts,
         corridors). A 🔴 Ruthless run is a different challenge with different
         pars, so it does not feed the contract, a Ruthless player who wants
         the day's contract plays it on Standard. */
      var feedsContract = opts.level !== 'ruthless';
      opts.onState = function (s) {
        if (feedsContract) { try { FRAME.contract._observe(id, s); } catch (e) {} }
        if (typeof caller === 'function') { try { caller(s); } catch (e) {} }
      };
      try { g.mount(elm, opts); return true; }
      catch (e) { elm.innerHTML = '<p style="color:var(--muted)">This mission could not start. Reload the page.</p>'; return false; }
    }
  };
})();
