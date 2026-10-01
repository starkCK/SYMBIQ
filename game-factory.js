(function () {
  'use strict';
  var W = window;
  W.SymbiQ = W.SymbiQ || {};

  var A = new Array(16).fill(0), i, m;
  for (m = 0; m < 32768; m++) {
    var syn = 0, w = 0;
    for (i = 0; i < 15; i++) if (m & (1 << i)) { syn ^= (i + 1); w++; }
    if (syn === 0) A[w]++;
  }
  var DISTANCES = [3, 5, 7, 9, 11, 13, 15, 17];
  var C_FAULTS = 15, P_TH = 0.01;

  function round15(e) {
    var pa = 0, bad = 0, w, t;
    for (w = 0; w <= 15; w++) {
      if (!A[w]) continue;
      t = A[w] * Math.pow(e, w) * Math.pow(1 - e, 15 - w);
      pa += t; if (w % 2) bad += t;
    }
    return { accept: pa, out: bad / pa };
  }
  function pL(d, p) { return 0.1 * Math.pow(p / P_TH, (d + 1) / 2); }
  function evaluate(L, plan) {
    var e = L.raw, rows = [], r;
    for (r = 0; r < plan.length; r++) {
      var rd = round15(e), clifford = C_FAULTS * pL(plan[r], L.phys), out = Math.min(0.5, rd.out + clifford);
      rows.push({ d: plan[r], inErr: e, accept: rd.accept, distilled: rd.out, clifford: clifford, out: out, vol: Math.pow(plan[r], 3) });
      e = out;
    }
    var runs = 1, total = 0;
    for (r = plan.length - 1; r >= 0; r--) {
      runs = runs / rows[r].accept; rows[r].runs = runs; total += runs * rows[r].vol;
      runs = runs * 15;
    }
    return { rows: rows, error: e, volume: total, raw: Math.pow(15, plan.length) , meets: e <= L.target };
  }
  function plans() {
    var out = [], a, b, c;
    DISTANCES.forEach(function (x) { out.push([x]); });
    DISTANCES.forEach(function (x) { DISTANCES.forEach(function (y) { out.push([x, y]); }); });
    DISTANCES.forEach(function (x) { DISTANCES.forEach(function (y) { DISTANCES.forEach(function (z) { out.push([x, y, z]); }); }); });
    return out;
  }
  var ALL = plans();
  function best(L) {
    var par = Infinity, count = 0, plan = null, feasible = 0;
    ALL.forEach(function (p) {
      var ev = evaluate(L, p);
      if (!ev.meets) return;
      feasible++;
      if (ev.volume < par * (1 - 1e-12)) { par = ev.volume; count = 1; plan = p; } else if (Math.abs(ev.volume - par) <= par * 1e-12) count++;
    });
    return { par: par, count: count, plan: plan, feasible: feasible, of: ALL.length };
  }
  function bestUniform(L) {
    var par = Infinity, plan = null;
    ALL.forEach(function (p) {
      if (p.some(function (x) { return x !== p[0]; })) return;
      var ev = evaluate(L, p); if (ev.meets && ev.volume < par) { par = ev.volume; plan = p; }
    });
    return { vol: par, plan: plan };
  }
  function medalOf(volume, par) { return volume <= par * (1 + 1e-12) ? 'gold' : volume <= par * 1.15 ? 'silver' : 'bronze'; }

  var engine = { A: A, round15: round15, pL: pL, evaluate: evaluate, best: best, bestUniform: bestUniform, medalOf: medalOf, plans: ALL, DISTANCES: DISTANCES, C_FAULTS: C_FAULTS };

  var LEVELS = [
    { id: 'first', name: 'The first factory', raw: 0.02, phys: 0.0003, target: 1e-06, par: 1309.176095789427, start: [7],
      brief: 'Raw states are wrong 2% of the time and the hardware is good (0.03% per operation). Two rounds are enough. Get below one in a million.' },
    { id: 'noisy', name: 'Noisier hardware', raw: 0.01, phys: 0.001, target: 1e-08, par: 10925.386305000062, start: [7],
      brief: 'Operations fail 0.1% of the time, which makes every distance dear. The raw states are better (1%). Get below 10&#8315;&#8312;.' },
    { id: 'three', name: 'Three rounds', raw: 0.02, phys: 0.0003, target: 1e-10, par: 12555.354571703265, start: [7],
      brief: 'From 2% raw states, below 10&#8315;&#185;&#8304; needs a third round. The question is where to spend the protection.' },
    { id: 'clean', name: 'Cleaner raw states', raw: 0.005, phys: 0.0003, target: 1e-12, par: 8922.489407690282, start: [7],
      brief: 'The target is harder (10&#8315;&#185;&#178;) but the raw states are only 0.5% wrong. More rounds are not the answer here.' },
    { id: 'deep', name: 'The deep target', raw: 0.02, phys: 0.0001, target: 1e-15, par: 13541.16882239191, start: [7],
      brief: 'Below 10&#8315;&#185;&#8309; from 2% raw states, on very good hardware (0.01% per operation).' }
  ];
  engine.LEVELS = LEVELS;

  var def = {
    id: 'factory', title: 'Magic State Factory', mentor: '', home: 'No mission on the Path yet.', noLevels: true,
    hook: 'A quantum computer\'s T gates are made from noisy states you have to distil. Build the cheapest factory that gets clean enough.',
    about: {
      goal: 'Choose how many rounds of 15-to-1 magic-state distillation to run, and the code distance of each, so the output error reaches the target with the least volume.',
      how: 'Pick <strong>1, 2 or 3 rounds</strong>, then a <strong>distance</strong> for each round. The table shows every round&rsquo;s error going in and out, how often it is accepted, and what it costs. <strong>Build the factory</strong> when the last row is below the target.',
      inspired: 'Bravyi and Kitaev&rsquo;s 15-to-1 protocol (2005), in which a batch of 15 noisy states yields one whose error is about 35 times the cube of the input error, and the surface-code rule of thumb for how fast a larger distance suppresses a round&rsquo;s own errors.',
      learn: 'Why distillation squares-and-cubes an error away so fast, why the later rounds can afford to be cheap in count but heavy in protection, and why the same distance everywhere is never the cheapest way.',
      link: 'qec.html', linkText: 'Error correction ▸', tier: 'Proven',
      or: 'Allocating a cost across stages that feed each other is a resource-allocation problem, an operations-research one'
    },
    honest: 'Honest model: the distillation figures are counted exactly from the [15,11] Hamming code (every one of the 32,768 error patterns), and the &ldquo;35 e&sup3;&rdquo; is only its leading term. Everything else is a stated assumption: independent input errors, 15 fault paths per round at the surface-code rule of thumb 0.1 (p / 0.01)<sup>(d+1)/2</sup>, volume d&sup3; per run, rejected batches thrown away. It is a stylised cost model, not any published factory&rsquo;s footprint. Each level&rsquo;s par is the cheapest plan that meets the target, all 584 plans tried.',
    mount: function (root, opts) { var h = mountGame(root, opts || {}); API.last = h; return h; }
  };

  function sci(x) { if (!isFinite(x)) return '&infin;'; if (x === 0) return '0'; var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); if (m >= 9.995) { m = 1; e++; } return m.toFixed(1) + '&times;10<sup>' + e + '</sup>'; }
  function vol(x) { return x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : x >= 1e4 ? (x / 1e3).toFixed(1) + 'k' : Math.round(x).toLocaleString(); }

  function mountGame(root, opts) {
    var esc = W.SymbiQ.core.esc, lvl = 0, plan = [], built = false;
    var KEY = 'factory';
    root.innerHTML = '';
    var wrap = document.createElement('div'); wrap.className = 'mfc';
    root.appendChild(wrap);

    function ladderState() { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return f && f.ladder ? f.ladder.state(KEY) : { cleared: {}, medal: {} }; }
    function unlocked(n) { var f = W.SymbiQ.games && W.SymbiQ.games.frame; return n <= 1 || !f || !f.ladder || f.ladder.isUnlocked(KEY, n); }
    function resume() { var st = ladderState(), r = 0; for (var k = 1; k <= LEVELS.length; k++) if (st.cleared[k]) r = Math.min(k, LEVELS.length - 1); return r; }

    function paint() {
      var L = LEVELS[lvl], ev = evaluate(L, plan), st = ladderState();
      var html = '<div class="mf-strip" role="list" aria-label="The factories">' + LEVELS.map(function (l, k) {
        var med = st.medal[k + 1], glyph = med ? { gold: '🥇', silver: '🥈', bronze: '🥉' }[med] : (unlocked(k + 1) ? (k + 1) : '🔒');
        return '<button type="button" role="listitem" class="mf-chip' + (k === lvl ? ' now' : '') + '" data-lv="' + k + '"' + (unlocked(k + 1) ? '' : ' disabled') + ' aria-label="' + esc(l.name) + (unlocked(k + 1) ? '' : ', locked') + '">' + glyph + ' ' + esc(l.name) + '</button>';
      }).join('') + '</div><p class="mf-brief">' + L.brief + '</p>' +
        '<p class="mf-facts"><b>Raw state error</b> ' + sci(L.raw) + ' &middot; <b>Physical error rate</b> ' + sci(L.phys) + ' &middot; <b>Target</b> below ' + sci(L.target) + ' &middot; <b>Par</b> ' + vol(L.par) + ' volume (proven best)</p>';
      html += '<fieldset class="mf-rounds"><legend>Rounds of 15-to-1</legend>' + [1, 2, 3].map(function (n) {
        return '<label class="mf-o' + (plan.length === n ? ' on' : '') + '"><input type="radio" name="mf-n" value="' + n + '"' + (plan.length === n ? ' checked' : '') + (built ? ' disabled' : '') + '><span>' + n + (n === 1 ? ' round' : ' rounds') + '</span></label>';
      }).join('') + '</fieldset>';
      html += '<div class="mf-tabw"><table class="mf-tab"><caption class="sr">Each round, in order: its distance, the error going in, the error coming out, how often a batch is accepted, how many runs one output costs, and its volume</caption><thead><tr><th scope="col">Round</th><th scope="col">Distance</th><th scope="col">Error in</th><th scope="col">Error out</th><th scope="col">Accepted</th><th scope="col">Runs per output</th><th scope="col">Volume</th></tr></thead><tbody>' +
        ev.rows.map(function (r, k) {
          var sel = '<select class="mf-d" data-r="' + k + '" aria-label="Distance for round ' + (k + 1) + '"' + (built ? ' disabled' : '') + '>' + DISTANCES.map(function (d) { return '<option value="' + d + '"' + (d === plan[k] ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>';
          return '<tr><th scope="row">' + (k + 1) + '</th><td>' + sel + '</td><td>' + sci(r.inErr) + '</td><td>' + sci(r.out) + '</td><td>' + (r.accept * 100).toFixed(1) + '%</td><td>' + r.runs.toFixed(1) + '</td><td>' + vol(r.runs * r.vol) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      html += '<p class="mf-plan" role="status" aria-live="polite"><b>Your factory:</b> output error <b>' + sci(ev.error) + '</b> ' + (ev.meets ? '(meets the target)' : '<strong class="mf-over">(not below ' + sci(L.target) + ')</strong>') + ', total volume <b>' + vol(ev.volume) + '</b>, from <b>' + ev.raw.toLocaleString() + '</b> raw states per output at the first round&rsquo;s input</p>';
      html += '<div class="mf-act">' + (built
        ? '<button type="button" class="preset" data-a="again">Change the factory</button>' + (lvl < LEVELS.length - 1 ? ' <button type="button" class="preset" data-a="next"' + (unlocked(lvl + 2) ? '' : ' disabled') + '>Next factory</button>' : '')
        : '<button type="button" class="preset mf-run" data-a="run"' + (ev.meets ? '' : ' disabled') + '>Build the factory</button> <button type="button" class="preset" data-a="reset">Start again</button>') + '</div>' +
        '<p class="mf-say" role="status" aria-live="polite">' + (built ? sayResult(L, ev) : (ev.meets ? 'This factory reaches the target. Can it do it for less volume?' : 'Not clean enough yet: add a round, or raise a distance where the error is still large.')) + '</p>';
      wrap.innerHTML = html;
    }
    function sayResult(L, ev) {
      var med = medalOf(ev.volume, L.par), glyph = { gold: '🥇', silver: '🥈', bronze: '🥉' }[med];
      return '<strong>' + vol(ev.volume) + ' volume' + (med === 'gold' ? ': the par, the cheapest factory that meets the target.' : ' against a par of ' + vol(L.par) + '.') + '</strong> ' + glyph + ' ' + med +
        (med === 'gold' ? '' : ' Try a different distance in each round: the last rounds run the fewest times, so protection is cheapest there.');
    }
    function start(n) { lvl = n; plan = LEVELS[n].start.slice(); built = false; paint(); }
    wrap.addEventListener('change', function (e) {
      var t = e.target; if (!t || built) return;
      if (t.name === 'mf-n') { var n = +t.value; while (plan.length < n) plan.push(plan[plan.length - 1] || 7); plan.length = n; paint(); var again = wrap.querySelector('input[name="mf-n"]:checked'); if (again) again.focus(); }
      else if (t.classList && t.classList.contains('mf-d')) { var r = +t.getAttribute('data-r'); plan[r] = +t.value; paint(); var s = wrap.querySelector('.mf-d[data-r="' + r + '"]'); if (s) s.focus(); }
    });
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      var L = LEVELS[lvl];
      if (b.hasAttribute('data-lv')) { var n2 = +b.getAttribute('data-lv'); if (unlocked(n2 + 1)) start(n2); return; }
      var a = b.getAttribute('data-a');
      if (a === 'reset') { plan = L.start.slice(); paint(); }
      else if (a === 'run') {
        var ev = evaluate(L, plan); if (!ev.meets) return;
        built = true; var med = medalOf(ev.volume, L.par);
        try { var f = W.SymbiQ.games && W.SymbiQ.games.frame; if (f && f.ladder) f.ladder.markCleared(KEY, lvl + 1, med); } catch (x) { }
        paint();
      }
      else if (a === 'again') { built = false; paint(); }
      else if (a === 'next') { start(lvl + 1); }
    });
    start(resume());
    return { state: function () { return { lvl: lvl, plan: plan.slice(), built: built }; }, setPlan: function (p) { plan = p.slice(); paint(); }, run: function () { wrap.querySelector('[data-a="run"]').click(); } };
  }

  engine.def = def;
  var API = { engine: engine, def: def, last: null };
  W.SymbiQ.games = W.SymbiQ.games || {};
  W.SymbiQ.games.factory = API;
  if (W.SymbiQ.games.register) W.SymbiQ.games.register(def);
})();
