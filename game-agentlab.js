(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  var ATTEMPTS = [1, 2, 3];
  var EPS = 1e-9;

  function geo(r, m) { var s = 0, t = 1, i; for (i = 0; i < m; i++) { s += t; t *= r; } return s; }
  function stepStats(L, st, opt) {
    if (opt === 0) return { right: st.p, cost: st.c, attempts: 1 };
    var m = ATTEMPTS[opt], g = geo((1 - st.p) * L.d, m);
    return { right: st.p * g, cost: (st.c + st.k) * g, attempts: m };
  }
  function evaluate(L, plan) {
    var succ = 1, cost = 0, rows = L.steps.map(function (st, i) {
      var s = stepStats(L, st, plan[i]); succ *= s.right; cost += s.cost;
      return { id: st.id, opt: plan[i], right: s.right, cost: s.cost };
    });
    return { success: succ, cost: cost, rows: rows, fits: cost <= L.budget + EPS };
  }
  function trustAll(L) { return L.steps.map(function () { return 0; }); }
  function best(L) {
    var n = L.steps.length, plan = trustAll(L), par = -1, count = 0, total = 0, feasible = 0, bestPlan = null, i, ev;
    for (;;) {
      total++; ev = evaluate(L, plan);
      if (ev.fits) {
        feasible++;
        if (ev.success > par + EPS) { par = ev.success; count = 1; bestPlan = plan.slice(); } else if (Math.abs(ev.success - par) <= EPS) count++;
      }
      for (i = 0; i < n; i++) { if (plan[i] < 2) { plan[i]++; break; } plan[i] = 0; }
      if (i === n) break;
    }
    return { par: par, count: count, of: total, feasible: feasible, plan: bestPlan };
  }
  function upgradeInOrder(L, order, levels) {
    var plan = trustAll(L), k, i;
    for (k = 1; k <= levels; k++) for (i = 0; i < order.length; i++) {
      var t = plan.slice(); t[order[i]] = k;
      if (plan[order[i]] === k - 1 && evaluate(L, t).fits) plan = t;
    }
    return plan;
  }
  function idx(L, key, dir) { return L.steps.map(function (s, i) { return i; }).sort(function (a, b) { return (dir * (key(L.steps[a]) - key(L.steps[b]))) || (a - b); }); }
  function ratioGreedy(L) {
    var plan = trustAll(L), moved = true;
    while (moved) {
      moved = false; var bestI = -1, bestR = 0, cur = evaluate(L, plan), i;
      for (i = 0; i < plan.length; i++) if (plan[i] < 2) {
        var t = plan.slice(); t[i]++; var ev = evaluate(L, t);
        if (!ev.fits) continue;
        var dc = ev.cost - cur.cost, gain = Math.log(ev.success / cur.success), r = dc > 0 ? gain / dc : Infinity;
        if (gain > EPS && r > bestR) { bestR = r; bestI = i; }
      }
      if (bestI >= 0) { plan[bestI]++; moved = true; }
    }
    return plan;
  }
  function heuristics(L) {
    return {
      weakest: evaluate(L, upgradeInOrder(L, idx(L, function (s) { return s.p; }, 1), 1)).success,
      cheapest: evaluate(L, upgradeInOrder(L, idx(L, function (s) { return s.k; }, 1), 1)).success,
      ratio: evaluate(L, ratioGreedy(L)).success
    };
  }
  function medalOf(success, par) { return success >= par - EPS ? 'gold' : success >= par - 0.02 ? 'silver' : 'bronze'; }

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function simulate(L, plan, runs, seed) {
    var rand = rng(seed), ok = 0, spent = 0, r, i;
    for (r = 0; r < runs; r++) {
      var good = true;
      for (i = 0; i < L.steps.length; i++) {
        var st = L.steps[i], m = plan[i] === 0 ? 1 : ATTEMPTS[plan[i]], a, right = false;
        for (a = 0; a < m; a++) {
          spent += st.c + (plan[i] === 0 ? 0 : st.k);
          var wasRight = rand() < st.p;
          if (wasRight) { right = true; break; }
          if (plan[i] === 0) break;
          if (!(rand() < L.d)) break;
        }
        if (!right) good = false;
      }
      if (good) ok++;
    }
    return { rate: ok / runs, cost: spent / runs, runs: runs };
  }

  var engine = { geo: geo, stepStats: stepStats, evaluate: evaluate, best: best, heuristics: heuristics, ratioGreedy: ratioGreedy, upgradeInOrder: upgradeInOrder, medalOf: medalOf, simulate: simulate, rng: rng, ATTEMPTS: ATTEMPTS, trustAll: trustAll };

  var LEVELS = [
    { id: 'trip', name: 'Book a trip', d: 0.8, budget: 26, par: 0.801099403987,
      brief: 'Four steps and a thin budget. Checks are not free, so they cannot go everywhere: pick the steps where one earns its cost.',
      steps: [
        { id: 'find', name: 'Find flights', p: 0.85, c: 5, k: 4 },
        { id: 'rank', name: 'Compare fares', p: 0.88, c: 3, k: 3 },
        { id: 'seat', name: 'Choose seats', p: 0.85, c: 3, k: 2 },
        { id: 'pay', name: 'Pay and confirm', p: 0.96, c: 5, k: 2 }
      ] },
    { id: 'report', name: 'Write a research brief', d: 0.9, budget: 27, par: 0.855198863938,
      brief: 'Five steps, every one fairly reliable. Checking all of them costs more than you have.',
      steps: [
        { id: 'q', name: 'Plan the questions', p: 0.94, c: 4, k: 2 },
        { id: 'src', name: 'Find sources', p: 0.94, c: 3, k: 2 },
        { id: 'read', name: 'Read and extract', p: 0.9, c: 4, k: 2 },
        { id: 'cite', name: 'Attach citations', p: 0.96, c: 3, k: 2 },
        { id: 'draft', name: 'Write the draft', p: 0.94, c: 6, k: 2 }
      ] },
    { id: 'refactor', name: 'Refactor a codebase', d: 0.9, budget: 29, par: 0.801576221612,
      brief: 'Six steps. Two are cheap to run and expensive to check: the budget has to go where a check buys the most.',
      steps: [
        { id: 'map', name: 'Map the modules', p: 0.96, c: 1, k: 3 },
        { id: 'split', name: 'Split the large file', p: 0.8, c: 6, k: 4 },
        { id: 'tests', name: 'Update the tests', p: 0.98, c: 6, k: 1 },
        { id: 'rename', name: 'Rename the interfaces', p: 0.9, c: 1, k: 4 },
        { id: 'lint', name: 'Fix the lint errors', p: 0.94, c: 2, k: 1 },
        { id: 'docs', name: 'Rewrite the docs', p: 0.85, c: 2, k: 2 }
      ] },
    { id: 'audit', name: 'Run a compliance audit', d: 0.9, budget: 34, par: 0.646081256199,
      brief: 'Seven steps and a checker that misses one wrong step in ten. Two steps are only 80% reliable.',
      steps: [
        { id: 'inv', name: 'List the systems', p: 0.9, c: 6, k: 1 },
        { id: 'pol', name: 'Read the policies', p: 0.96, c: 5, k: 4 },
        { id: 'gap', name: 'Find the gaps', p: 0.8, c: 1, k: 3 },
        { id: 'ev', name: 'Collect the evidence', p: 0.96, c: 5, k: 1 },
        { id: 'map', name: 'Map controls to rules', p: 0.9, c: 2, k: 1 },
        { id: 'risk', name: 'Score the risks', p: 0.8, c: 4, k: 1 },
        { id: 'rep', name: 'Write the report', p: 0.92, c: 5, k: 1 }
      ] },
    { id: 'longrun', name: 'The long run', d: 0.9, budget: 38, par: 0.777410608936,
      brief: 'Eight steps, none worse than 88%. Trusting all of them finishes about half the time. Make the budget count.',
      steps: [
        { id: 'a', name: 'Gather inputs', p: 0.92, c: 6, k: 2 },
        { id: 'b', name: 'Clean the data', p: 0.9, c: 1, k: 2 },
        { id: 'c', name: 'Run the analysis', p: 0.88, c: 2, k: 3 },
        { id: 'd', name: 'Cross-check the totals', p: 0.95, c: 6, k: 4 },
        { id: 'e', name: 'Draft the findings', p: 0.97, c: 4, k: 3 },
        { id: 'f', name: 'Build the charts', p: 0.97, c: 3, k: 3 },
        { id: 'g', name: 'Check the claims', p: 0.88, c: 3, k: 1 },
        { id: 'h', name: 'Publish', p: 0.88, c: 1, k: 4 }
      ] }
  ];
  engine.LEVELS = LEVELS;

  var OPTS = ['Trust it', 'Check, 1 retry', 'Check, 2 retries'];
  var def = {
    id: 'agentlab', title: 'Agent Lab', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'An agent that is right 95% of the time at each of twenty steps finishes about a third of its jobs. Spend a budget on checking.',
    about: {
      goal: 'Choose, for each step of an AI agent&rsquo;s task, whether to trust it or check it (and how many retries to allow) so that the whole task finishes as often as possible within a budget.',
      how: 'Set each step to <strong>Trust it</strong>, <strong>Check, 1 retry</strong> or <strong>Check, 2 retries</strong>. The plan&rsquo;s expected cost has to fit the budget. <strong>Run the pipeline</strong> to see the exact chance of finishing, and 2,000 seeded runs beside it.',
      inspired: 'The arithmetic every long agent run lives under: a chain of steps multiplies its failure rates, so reliability per step has to be far higher than reliability for the task. Verification and retry loops are how tool-using agents are made dependable in practice.',
      learn: 'Why a long chain of &ldquo;pretty reliable&rdquo; steps is unreliable, why checking everything is usually unaffordable, why the weak step is not always the one to check, and what a budget buys.',
      link: 'ai.html', linkText: 'The AI page ▸', tier: 'Proven',
      or: 'Allocating a budget across steps that multiply is a resource-allocation problem, an operations-research one'
    },
    honest: 'Honest model: a run succeeds only if every step is right, so the chance is the product of the steps&rsquo; chances; a checker catches a wrong step with a fixed probability and never raises a false alarm; caught steps are retried independently up to the attempts you bought. Real mistakes are correlated, real checkers have false alarms, and real pipelines branch; none of that is modelled, and no AI model runs in this cabinet. The reliabilities and costs are the scenario&rsquo;s, not a measurement of any product. Each level&rsquo;s par is the best over every plan that fits the budget, all of them tried.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function pct(x) { return (Math.round(x * 1000) / 10).toFixed(1) + '%'; }

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, plan = [], ran = false, sim = null;
    var KEY = 'agentlab';
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'agl';
    root.appendChild(wrap);

    function ladderState() { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.ladder ? f.ladder.state(KEY) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function resume() { var st = ladderState(), r = 0; for (var i = 1; i <= LEVELS.length; i++) if (st.cleared[i]) r = Math.min(i, LEVELS.length - 1); return r; }

    function head(L, ev) {
      return '<div class="ag-strip" role="list" aria-label="The tasks">' + LEVELS.map(function (l, i) {
        var st = ladderState(), med = st.medal[i + 1], glyph = med ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[med] : (unlocked(i + 1) ? (i + 1) : '🔒');
        return '<button type="button" role="listitem" class="ag-chip' + (i === lvl ? ' now' : '') + '" data-lv="' + i + '"' + (unlocked(i + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(i + 1) ? '' : ', locked') + '">' + glyph + ' ' + esc(l.name) + '</button>';
      }).join('') + '</div>' +
        '<p class="ag-brief">' + L.brief + '</p>' +
        '<p class="ag-facts"><b>Budget</b> ' + L.budget + ' (expected cost) &middot; <b>The checker</b> catches ' + Math.round(L.d * 100) + '% of wrong steps and never cries wolf &middot; <b>Par</b> ' + pct(L.par) + ' finish (proven best) &middot; <b>Trusting every step</b> finishes ' + pct(evaluate(L, trustAll(L)).success) + '</p>' +
        '<p class="ag-plan" role="status" aria-live="polite"><b>Your plan:</b> finishes <b>' + pct(ev.success) + '</b>, expected cost <b>' + ev.cost.toFixed(2) + '</b> of ' + L.budget + (ev.fits ? '' : ' <strong class="ag-over">&mdash; over budget</strong>') + '</p>';
    }
    function rowHTML(L, st, i, ev) {
      var r = ev.rows[i], opt = plan[i];
      var sel = OPTS.map(function (o, k) { return '<label class="ag-o' + (opt === k ? ' on' : '') + '"><input type="radio" name="ag-s' + i + '" value="' + k + '"' + (opt === k ? ' checked' : '') + (ran ? ' disabled' : '') + ' data-step="' + i + '"><span>' + o + '</span></label>'; }).join('');
      return '<li class="ag-row" data-id="' + esc(st.id) + '"><div class="ag-b"><b>' + (i + 1) + '. ' + esc(st.name) + '</b>' +
        '<p class="ag-m">right <b>' + pct(st.p) + '</b> of the time &middot; costs <b>' + st.c + '</b> a try &middot; checking adds <b>' + st.k + '</b></p>' +
        '<fieldset class="ag-sel"><legend class="sr">What to do at step ' + (i + 1) + ', ' + esc(st.name) + '</legend>' + sel + '</fieldset>' +
        '<p class="ag-r">this step: right <b>' + pct(r.right) + '</b> &middot; expected cost <b>' + r.cost.toFixed(2) + '</b></p></div></li>';
    }
    function paint() {
      var L = LEVELS[lvl], ev = evaluate(L, plan);
      var html = head(L, ev) + '<ol class="ag-list">' + L.steps.map(function (st, i) { return rowHTML(L, st, i, ev); }).join('') + '</ol>';
      html += '<div class="ag-act">' + (ran
        ? '<button type="button" class="preset" data-a="again">Change the plan</button>' + (lvl < LEVELS.length - 1 ? ' <button type="button" class="preset" data-a="next"' + (unlocked(lvl + 2) ? '' : ' disabled') + '>Next task</button>' : '')
        : '<button type="button" class="preset ag-run" data-a="run"' + (ev.fits ? '' : ' disabled') + '>Run the pipeline</button> <button type="button" class="preset" data-a="reset">Trust every step</button>') + '</div>' +
        '<p class="ag-say" role="status" aria-live="polite">' + (ran ? sayResult(L, ev) : (ev.fits ? 'Choose what to do at each step, then run the pipeline.' : 'This plan costs more than the budget. Trust a step or take a retry away.')) + '</p>';
      wrap.innerHTML = html;
    }
    function sayResult(L, ev) {
      var med = medalOf(ev.success, L.par), glyph = { gold: '🥇', silver: '🥈', bronze: '🥉' }[med];
      return '<strong>' + pct(ev.success) + ' finish' + (ev.success >= L.par - EPS ? ': the par, the best any plan within the budget can do.' : ' against a par of ' + pct(L.par) + '.') + '</strong> ' + glyph + ' ' + med +
        (ev.success >= L.par - EPS ? '' : ' Checking the weakest step first is not always the best use of the budget: weigh what each check costs against what it buys.') +
        ' Measured over ' + sim.runs.toLocaleString() + ' seeded runs: <b>' + pct(sim.rate) + '</b> finished, average cost <b>' + sim.cost.toFixed(2) + '</b>.';
    }
    function start(n) { lvl = n; plan = trustAll(LEVELS[lvl]); ran = false; sim = null; paint(); }
    wrap.addEventListener('change', function (e) {
      var t = e.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-step') || ran) return;
      var i = +t.getAttribute('data-step'); plan[i] = +t.value; paint();
      var again = wrap.querySelector('input[data-step="' + i + '"]:checked'); if (again) again.focus();
    });
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      var L = LEVELS[lvl];
      if (b.hasAttribute('data-lv')) { var n2 = +b.getAttribute('data-lv'); if (unlocked(n2 + 1)) start(n2); return; }
      var a = b.getAttribute('data-a');
      if (a === 'reset') { plan = trustAll(L); paint(); }
      else if (a === 'run') {
        var ev = evaluate(L, plan); if (!ev.fits) return;
        ran = true; sim = simulate(L, plan, 2000, 1000 + lvl);
        var med = medalOf(ev.success, L.par);
        try { var f = W.SymbiQ.games && W.SymbiQ.games.frame; if (f && f.ladder) f.ladder.markCleared(KEY, lvl + 1, med); } catch (x) { }
        paint();
      }
      else if (a === 'again') { ran = false; sim = null; paint(); }
      else if (a === 'next') { start(lvl + 1); }
    });
    start(resume());
    return { state: function () { return { lvl: lvl, plan: plan.slice(), ran: ran }; },
             setPlan: function (p) { plan = p.slice(); paint(); }, run: function () { wrap.querySelector('[data-a="run"]').click(); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.agentlab = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
