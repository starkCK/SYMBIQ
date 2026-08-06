/* SymbiQ — THE ESTATE MODEL
 * =============================================================================
 * Describe your cryptographic estate; get your own exposure, your own plan,
 * and — the output that is actually worth having — a proof when the plan
 * cannot be finished in time.
 *
 * THE IDEA THAT DECIDES THE DESIGN. Mosca's inequality is X + Y > Z, where X is
 * how long the data must stay secret and Y is how long migration takes. Almost
 * everyone plugs in an asset's OWN effort as Y. That is wrong whenever anything
 * depends on anything: your real Y for an asset is WHEN THE PLAN REACHES IT.
 * An embedded fleet behind a CA behind a code-signing pipeline does not take
 * eight quarters, it takes however long the three of them take in sequence
 * under your actual capacity. So the schedule feeds back into the risk, and
 * REORDERING THE PLAN CHANGES WHO IS EXPOSED. That is the thing to play with.
 *
 * THE SECOND HONEST MOVE. Nobody knows Z. Predicting it is the thing every
 * other tool in this space does and none of them can justify. So this reports
 * the BREAKEVEN Z per asset instead: "exposed unless a cryptographically
 * relevant quantum computer is more than N years away." That is a statement a
 * reader can check against their own belief rather than adopt from ours.
 *
 * WHAT THIS IS NOT. It does not scan anything. It has no access to your
 * systems. You type your estate in, so it is exactly as good as what you type
 * — and it never leaves your browser, because there is no server to send it to.
 * ========================================================================== */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  /* Shor breaks RSA/DH/ECC outright. Grover halves symmetric strength, which
   * AES-256 absorbs — so it is NOT a migration item, and pretending otherwise
   * is the most common way these inventories get padded. */
  var ALGS = {
    'RSA-1024':    { vuln: true,  why: 'Shor — and already below the classical floor' },
    'RSA-2048':    { vuln: true,  why: 'Shor — broken outright' },
    'RSA-3072':    { vuln: true,  why: 'Shor — broken outright' },
    'RSA-4096':    { vuln: true,  why: 'Shor — broken outright' },
    'ECDSA P-256': { vuln: true,  why: 'Shor — broken outright' },
    'ECDSA P-384': { vuln: true,  why: 'Shor — broken outright' },
    'ECDSA P-521': { vuln: true,  why: 'Shor — broken outright' },
    'ECDH P-256':  { vuln: true,  why: 'Shor — broken outright' },
    'Ed25519':     { vuln: true,  why: 'Shor — broken outright' },
    'X25519':      { vuln: true,  why: 'Shor — broken outright' },
    'DSA-2048':    { vuln: true,  why: 'Shor — broken outright' },
    'DH-2048':     { vuln: true,  why: 'Shor — broken outright' },
    'Other — Shor-breakable': { vuln: true, why: 'Shor — broken outright' },
    'AES-256':     { vuln: false, why: 'Grover halves it to 128-bit — still safe' },
    'SHA-256':     { vuln: false, why: 'Grover/BHT gives no practical break' },
    'ML-KEM-768':  { vuln: false, why: 'already post-quantum' },
    'ML-DSA-44':   { vuln: false, why: 'already post-quantum' },
    'ML-DSA-65':   { vuln: false, why: 'already post-quantum' },
    'ML-DSA-87':   { vuln: false, why: 'already post-quantum' },
    'SLH-DSA-128s':{ vuln: false, why: 'already post-quantum' },
    'Other — post-quantum': { vuln: false, why: 'already post-quantum' }
  };

  /* A realistic starting estate. Nobody engages with a blank page, and the
   * dependency chain here is the one that bites in real migrations:
   * the CA gates mTLS and code signing, and code signing gates the fleet. */
  var TEMPLATE = [
    { id: 'tls',   name: 'Public TLS endpoints',   alg: 'ECDSA P-256', shelf: 3,  effort: 2, deps: [],               owned: true },
    { id: 'ca',    name: 'Internal certificate authority', alg: 'RSA-4096', shelf: 10, effort: 3, deps: [],          owned: true },
    { id: 'mtls',  name: 'Service-to-service mTLS', alg: 'ECDSA P-256', shelf: 5,  effort: 4, deps: ['ca'],          owned: true },
    { id: 'sign',  name: 'Code signing pipeline',   alg: 'RSA-3072', shelf: 15, effort: 3, deps: ['ca'],             owned: true },
    { id: 'fleet', name: 'Embedded device fleet',   alg: 'RSA-2048', shelf: 12, effort: 8, deps: ['sign'],           owned: true },
    { id: 'vpn',   name: 'Site-to-site VPN',        alg: 'DH-2048',  shelf: 7,  effort: 2, deps: [],                 owned: true },
    { id: 'db',    name: 'Database at rest',        alg: 'AES-256',  shelf: 20, effort: 0, deps: [],                 owned: true },
    { id: 'psp',   name: 'Payment provider (vendor)', alg: 'ECDSA P-256', shelf: 6, effort: 4, deps: [],             owned: false }
  ];

  /* ------------------------------------------------------------------ plan --
   * Schedule under a capacity of `cap` effort-units per quarter, respecting
   * precedence. Returns a completion quarter per asset. Policy decides only
   * the ORDER in which ready assets are picked -- capacity and precedence bind
   * identically in every policy, which is what makes the comparison fair. */
  function plan(assets, cap, policy) {
    var byId = {}; assets.forEach(function (a) { byId[a.id] = a; });
    var todo = assets.filter(function (a) { return ALGS[a.alg] && ALGS[a.alg].vuln; });
    var done = {}, out = {}, q = 0, guard = 0;
    // non-vulnerable assets are complete before we start; they are not work
    assets.forEach(function (a) { if (todo.indexOf(a) < 0) done[a.id] = true; });

    var rank = {
      'risk-first':  function (a, b) { return b.shelf - a.shelf; },
      'quick-wins':  function (a, b) { return a.effort - b.effort; },
      'as-listed':   function () { return 0; },
      'deepest-first': function (a, b) { return depth(b, byId) - depth(a, byId); }
    }[policy] || function () { return 0; };

    var remaining = todo.slice();
    while (remaining.length && guard++ < 500) {
      q++;
      var budget = cap;
      // a thing is ready when every dependency is already finished
      var ready = remaining.filter(function (a) {
        return a.deps.every(function (d) { return done[d]; });
      }).sort(rank);
      /* Collect completions and remove them AFTER the sweep. Removing from
       * `remaining` while indexing `ready` was a real bug: the compensating
       * i-- re-visited a finished asset, whose indexOf then returned -1, and
       * splice(-1, 1) deletes the LAST element of the queue — quietly dropping
       * an unrelated asset from the plan entirely. */
      var completed = [];
      for (var i = 0; i < ready.length && budget > 0; i++) {
        var a = ready[i];
        a._spent = (a._spent || 0);
        var take = Math.min(budget, a.effort - a._spent);
        a._spent += take; budget -= take;
        if (a._spent >= a.effort) { out[a.id] = q; completed.push(a); }
      }
      completed.forEach(function (a) {
        var k = remaining.indexOf(a);
        if (k >= 0) remaining.splice(k, 1);
      });
      // mark finished at quarter end, so precedence never resolves same-quarter
      Object.keys(out).forEach(function (id) { if (out[id] <= q) done[id] = true; });
      if (budget === cap && ready.length === 0 && remaining.length) break;  // deadlock
    }
    assets.forEach(function (a) { delete a._spent; });
    return { finish: out, quarters: q, stuck: remaining.map(function (a) { return a.id; }) };
  }

  function depth(a, byId, seen) {
    seen = seen || {};
    if (seen[a.id]) return 0;
    seen[a.id] = 1;
    if (!a.deps.length) return 0;
    return 1 + Math.max.apply(null, a.deps.map(function (d) {
      return byId[d] ? depth(byId[d], byId, seen) : 0; }));
  }

  /* ------------------------------------------------------------- exposure --
   * Y is the completion quarter converted to years -- NOT the asset's own
   * effort. breakevenZ is X + Y: the asset is exposed unless a CRQC is further
   * away than that. */
  function assess(assets, cap, policy) {
    var p = plan(assets, cap, policy);
    var rows = assets.map(function (a) {
      var info = ALGS[a.alg] || { vuln: false, why: 'unknown algorithm' };
      if (!info.vuln) return { a: a, vuln: false, why: info.why };
      var qs = p.finish[a.id];
      var y = qs == null ? null : qs / 4;
      return { a: a, vuln: true, why: info.why, quarter: qs, y: y,
               breakevenZ: y == null ? null : +(a.shelf + y).toFixed(2),
               stuck: qs == null };
    });
    var live = rows.filter(function (r) { return r.vuln && !r.stuck; });
    return {
      rows: rows, quarters: p.quarters, stuck: p.stuck,
      worst: live.length ? Math.max.apply(null, live.map(function (r) { return r.breakevenZ; })) : 0,
      totalEffort: assets.reduce(function (s, a) {
        return s + ((ALGS[a.alg] && ALGS[a.alg].vuln) ? a.effort : 0); }, 0)
    };
  }

  /* --------------------------------------------------------- feasibility ---
   * The valuable output. Two independent reasons a plan fails, and they need
   * different answers, so they are reported separately rather than merged into
   * one RAG status.  */
  function feasibility(assets, cap, policy, deadlineQuarters) {
    var r = assess(assets, cap, policy);
    var capacityShortfall = Math.max(0, r.totalEffort - cap * deadlineQuarters);
    var chainQuarters = r.quarters;
    return {
      assess: r,
      deadlineQuarters: deadlineQuarters,
      /* not enough total capacity, at any ordering */
      capacityBound: capacityShortfall > 0,
      capacityShortfall: capacityShortfall,
      minCapacityNeeded: Math.ceil(r.totalEffort / deadlineQuarters),
      /* enough capacity, but the dependency chain is too long to fit */
      chainBound: capacityShortfall === 0 && chainQuarters > deadlineQuarters,
      overrunQuarters: Math.max(0, chainQuarters - deadlineQuarters),
      feasible: chainQuarters <= deadlineQuarters && !r.stuck.length,
      deadlocked: r.stuck.length > 0
    };
  }

  SymbiQ.estate = { ALGS: ALGS, TEMPLATE: TEMPLATE, plan: plan, assess: assess,
                    feasibility: feasibility, depth: depth };

  /* ================================ the UI ================================ */
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* Real deadlines, counted from today rather than hardcoded, so the numbers
   * stay true as the deadline approaches instead of quietly going stale. */
  function quartersUntil(year) {
    var now = new Date(), end = new Date(year, 11, 31);
    return Math.max(1, Math.round((end - now) / (1000 * 60 * 60 * 24 * 365.25) * 4));
  }
  var DEADLINES = [
    { y: 2030, label: 'EO 14412 — key establishment', short: '2030' },
    { y: 2031, label: 'EO 14412 — digital signatures', short: '2031' },
    { y: 2033, label: 'CNSA 2.0 — exclusive use', short: '2033' },
    { y: 2035, label: 'NIST IR 8547 — disallowed', short: '2035' }
  ];

  SymbiQ.estate.mount = function (root, opts) {
    opts = opts || {};
    var assets = JSON.parse(JSON.stringify(TEMPLATE));
    var cap = 3, policy = 'risk-first', dlYear = 2030, source = 'example';

    function ids() { return assets.map(function (a) { return a.id; }); }

    /* The inventory above hands its findings down to here. Everything else on
     * the page keeps working if that never happens — this is an entry point,
     * not a dependency, so a broken parser can never take the sequencer with
     * it. Capacity, deadline and policy survive the load deliberately: you are
     * dropping a new estate into a plan you have already been tuning. */
    function banner() {
      if (source !== 'inventory') return '';
      return '<p class="es-from"><b>This estate was read from your artefacts, not typed.</b> ' +
        'Dependency edges come from the certificate chain — anything whose issuer is also in the paste waits for it. ' +
        'Signing keys arrived with a confidentiality lifetime of 0, because a signature cannot be forged backwards; ' +
        'raise it by hand for any key that also protects data. Effort is a placeholder in every row — only you know that number.</p>';
    }

    function editor() {
      return '<div class="es-scroll"><table class="es"><thead><tr>' +
        '<th>Asset</th><th>Algorithm</th><th>Secret for<br><span>years</span></th>' +
        '<th>Effort<br><span>quarters</span></th><th>Depends on</th><th></th></tr></thead><tbody>' +
        assets.map(function (a, i) {
          return '<tr><td><input class="es-in es-name" data-i="' + i + '" data-f="name" value="' +
              esc(a.name) + '" aria-label="Asset name"></td>' +
            '<td><select class="es-in" data-i="' + i + '" data-f="alg" aria-label="Algorithm">' +
              Object.keys(ALGS).map(function (k) {
                return '<option' + (k === a.alg ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') +
            '</select></td>' +
            '<td><input class="es-in es-num" type="number" min="0" max="50" data-i="' + i +
              '" data-f="shelf" value="' + a.shelf + '" aria-label="Confidentiality lifetime, years"></td>' +
            '<td><input class="es-in es-num" type="number" min="0" max="40" data-i="' + i +
              '" data-f="effort" value="' + a.effort + '" aria-label="Migration effort, quarters"></td>' +
            '<td><select class="es-in" data-i="' + i + '" data-f="deps" aria-label="Depends on">' +
              '<option value="">—</option>' +
              assets.filter(function (o) { return o.id !== a.id; }).map(function (o) {
                return '<option value="' + esc(o.id) + '"' +
                  (a.deps.indexOf(o.id) >= 0 ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') +
            '</select></td>' +
            '<td><button type="button" class="es-del" data-i="' + i + '" aria-label="Remove ' +
              esc(a.name) + '">✕</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="es-add"><button type="button" class="preset" id="es-addrow">+ Add an asset</button>' +
        '<button type="button" class="preset" id="es-reset">Reset to the example estate</button>' +
        '<button type="button" class="preset" id="es-export">⤓ Export as JSON</button></p>';
    }

    function controls() {
      return '<div class="es-ctl">' +
        '<label class="es-lab">Team capacity <b id="es-capv">' + cap + '</b> quarter-units per quarter' +
        '<input type="range" id="es-cap" min="1" max="12" value="' + cap + '"></label>' +
        '<p class="es-lab">Deadline</p><div class="es-opts">' +
          DEADLINES.map(function (d) {
            return '<button type="button" class="preset' + (d.y === dlYear ? ' on' : '') +
              '" data-dl="' + d.y + '">' + d.short + '<em>' + esc(d.label) + '</em></button>'; }).join('') +
        '</div>' +
        '<p class="es-lab">Migration order</p><div class="es-opts">' +
          [['risk-first', 'Longest-secret first'], ['quick-wins', 'Quickest first'],
           ['deepest-first', 'Deepest chain first'], ['as-listed', 'As listed']].map(function (p) {
            return '<button type="button" class="preset' + (p[0] === policy ? ' on' : '') +
              '" data-pol="' + p[0] + '">' + p[1] + '</button>'; }).join('') +
        '</div></div>';
    }

    function results() {
      var dq = quartersUntil(dlYear);
      var f = feasibility(assets, cap, policy, dq);
      var r = f.assess;

      var verdict;
      if (f.deadlocked) {
        verdict = '<div class="verdict bad"><b>The plan cannot run at all.</b> These assets depend on ' +
          'each other in a circle, so none of them can start: <b>' + esc(f.assess.stuck.join(', ')) +
          '</b>. That is a finding about the estate, not about the deadline.</div>';
      } else if (f.capacityBound) {
        verdict = '<div class="verdict bad"><b>Infeasible — and no ordering can fix it.</b> The vulnerable ' +
          'assets need <b>' + r.totalEffort + '</b> quarter-units of work. By ' + dlYear + ' you have ' +
          '<b>' + (cap * dq) + '</b> (' + cap + ' × ' + dq + ' quarters). You are <b>' + f.capacityShortfall +
          '</b> short. Reordering moves who is exposed; it cannot create capacity. ' +
          'The floor is <b>' + f.minCapacityNeeded + '</b> per quarter.</div>';
      } else if (f.chainBound) {
        verdict = '<div class="verdict bad"><b>Infeasible — and money will not fix this one.</b> You have ' +
          'enough total capacity, but the dependency chain is <b>' + r.quarters + ' quarters</b> long and ' +
          'the deadline is <b>' + dq + '</b>. Work that must happen in sequence cannot be parallelised by ' +
          'hiring. Shorten the chain or start sooner — <b>' + f.overrunQuarters + ' quarter(s)</b> over.</div>';
      } else {
        verdict = '<div class="verdict good"><b>Feasible.</b> The plan finishes in <b>' + r.quarters +
          '</b> quarters against a deadline of <b>' + dq + '</b>. Slack: <b>' + (dq - r.quarters) +
          '</b> quarters. That is the schedule — the exposure below is a separate question.</div>';
      }

      var vuln = r.rows.filter(function (x) { return x.vuln; })
                       .sort(function (a, b) { return b.breakevenZ - a.breakevenZ; });
      var safe = r.rows.filter(function (x) { return !x.vuln; });

      var body = vuln.map(function (x) {
        var band = x.breakevenZ >= 15 ? 'hi' : x.breakevenZ >= 8 ? 'mid' : 'lo';
        return '<tr><th scope="row">' + esc(x.a.name) +
          (x.a.owned ? '' : ' <span class="es-vend">vendor</span>') + '</th>' +
          '<td>' + esc(x.a.alg) + '</td>' +
          '<td class="es-n">' + x.a.shelf + ' y</td>' +
          '<td class="es-n">' + (x.quarter == null ? '—' : 'Q' + x.quarter) + '</td>' +
          '<td class="es-n"><b class="es-z ' + band + '">' + x.breakevenZ + ' y</b></td></tr>';
      }).join('');

      var cmp = ['risk-first', 'quick-wins', 'deepest-first', 'as-listed'].map(function (p) {
        var a2 = JSON.parse(JSON.stringify(assets));
        return { p: p, worst: assess(a2, cap, p).worst };
      }).sort(function (a, b) { return a.worst - b.worst; });
      var best = cmp[0], worstPol = cmp[cmp.length - 1];

      return verdict +
        '<div class="es-scroll"><table class="es es-res"><thead><tr><th>Asset</th><th>Algorithm</th>' +
        '<th>Secret for</th><th>Migrated</th><th>Exposed unless a quantum computer is further off than</th>' +
        '</tr></thead><tbody>' + body + '</tbody></table></div>' +
        (safe.length ? '<p class="es-safe"><b>Not migration work:</b> ' + safe.map(function (x) {
          return esc(x.a.name) + ' <span>(' + esc(x.why) + ')</span>'; }).join(' · ') + '</p>' : '') +
        '<p class="es-cmp"><b>Ordering is worth ' +
          (worstPol.worst - best.worst).toFixed(2) + ' years here.</b> Worst-case breakeven by policy: ' +
          cmp.map(function (c) { return esc(c.p) + ' <b>' + c.worst.toFixed(2) + '</b>'; }).join(' · ') +
          '. Same capacity, same constraints — only the order changes.' +
          /* A zero spread is a real result, not a broken widget, and it has a
           * cause worth naming: sequencing buys nothing when every asset is
           * exposed for the same reason. Estates read from certificates land
           * here by default, because signing keys all carry a lifetime of 0. */
          ((worstPol.worst - best.worst) === 0
            ? ' <b>Zero is a finding.</b> Ordering only moves exposure when your assets differ in how long they must stay secret — ' +
              'and when every line here is an authentication key, they do not. Set a real confidentiality lifetime on anything that ' +
              'protects data rather than proving identity, and the spread appears.'
            : '') + '</p>';
    }

    function render() {
      root.innerHTML = '<div class="es-wrap">' + banner() + controls() + editor() +
        '<div class="es-out">' + results() + '</div></div>';
    }

    SymbiQ.estate.load = function (next) {
      if (!next || !next.length) return false;
      assets = JSON.parse(JSON.stringify(next));
      source = 'inventory';
      render();
      return true;
    };

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'es-cap') { cap = +t.value; render(); return; }
      if (!t.classList.contains('es-in')) return;
      var a = assets[+t.dataset.i], f = t.dataset.f;
      if (!a) return;
      if (f === 'deps') a.deps = t.value ? [t.value] : [];
      else if (f === 'shelf' || f === 'effort') a[f] = Math.max(0, +t.value || 0);
      else a[f] = t.value;
      // keep focus: only the results need redrawing on a field edit
      root.querySelector('.es-out').innerHTML = results();
    });

    root.addEventListener('change', function (e) {
      if (e.target.dataset && e.target.dataset.f === 'alg') render();
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.dl) { dlYear = +b.dataset.dl; render(); }
      else if (b.dataset.pol) { policy = b.dataset.pol; render(); }
      else if (b.classList.contains('es-del')) {
        var gone = assets.splice(+b.dataset.i, 1)[0];
        assets.forEach(function (a) {
          a.deps = a.deps.filter(function (d) { return d !== gone.id; }); });
        render();
      }
      else if (b.id === 'es-addrow') {
        assets.push({ id: 'a' + Date.now().toString(36), name: 'New asset', alg: 'RSA-2048',
                      shelf: 5, effort: 2, deps: [], owned: true });
        render();
      }
      else if (b.id === 'es-reset') { assets = JSON.parse(JSON.stringify(TEMPLATE)); source = 'example'; render(); }
      else if (b.id === 'es-export') {
        var blob = new Blob([JSON.stringify({ estate: assets, capacity: cap, policy: policy,
          deadlineYear: dlYear }, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob), a2 = document.createElement('a');
        a2.href = url; a2.download = 'pqc-estate.json'; a2.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
    });

    render();
  };
})();
