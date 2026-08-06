/* SymbiQ — THE ODDS
 * =============================================================================
 * The Sequencer above answers "when does my plan finish protecting this asset"
 * with a single number: breakevenZ, the year a quantum computer would have to
 * arrive BEFORE for you to be exposed. That number is exact arithmetic, and it
 * is also a trap -- it invites reading "breakevenZ = 15.75 years" as a verdict,
 * when it is really a THRESHOLD on a quantity nobody knows.
 *
 * So this tool puts a real distribution behind it. The Global Risk Institute's
 * Quantum Threat Timeline Report 2024 (Mosca & Piani, December 2024) asked 32
 * named experts for likelihood ranges at five time horizons. Their answers are
 * not a shrug -- they are five hard numbers this tool anchors to exactly, and
 * everything between those five points is a stated modelling choice (linear
 * interpolation), not a sixth number pretending to be measured.
 *
 * THE HONEST LIMIT, taken as seriously as the rest of this page's tools take
 * theirs: the survey stops at 30 years. Past that this tool refuses to invent
 * a tail -- it reports a FLOOR (the probability mass already accounted for by
 * year 30) rather than a number dressed as precise.
 *
 * THE SECOND HONEST MOVE: there is exactly one true quantum-computing future,
 * not one per asset. Every asset in your estate is judged against the SAME
 * drawn year, because that is what "nobody knows Z" actually means -- Z is a
 * single unknown, not an independent coin flip per line in your table.
 *
 * THIS VERSION adds three things a first cut didn't: a live chart so the curve
 * is something you look at, not just read a percentage off of; three named
 * scenarios (a hospital, a bank, a utility) so the numbers land on a concrete
 * estate instead of an abstract one; and a one-line recommendation plus a
 * downloadable briefing, because "here is a probability" is not the same
 * thing as "here is what to do about it."
 * ========================================================================== */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  /* Read directly off the report's own figure ("2024 opinion-based estimates
   * of the likelihood of a quantum computer able to break RSA-2048 in 24h, as
   * function of time"), not digitised from pixels -- these are the numbers
   * printed on the chart. OPT = the optimistic-about-progress interpretation
   * (upper bound of each expert's range: quantum computing arrives SOONER,
   * which is the worse case for a defender). PESS = the lower bound (slower
   * progress, the more cautious case). (0,0) is our own anchor, not the
   * report's -- justified by the report's own text ("today's quantum
   * processors are still far from being CRQCs"), and stated as an assumption
   * rather than hidden as data. The report explicitly did not ask about 25
   * years, so the 20->30 segment interpolates across twice the gap of every
   * other segment -- flagged on the page, not smoothed over. */
  var ANCHORS_OPT  = [[0, 0], [5, 0.14], [10, 0.34], [15, 0.62], [20, 0.82], [30, 0.92]];
  var ANCHORS_PESS = [[0, 0], [5, 0.05], [10, 0.19], [15, 0.39], [20, 0.60], [30, 0.77]];
  var HORIZON = 30; // years -- the edge of what the survey actually measured

  function cdf(t, anchors) {
    if (t <= anchors[0][0]) return anchors[0][1];
    if (t >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
    for (var i = 0; i < anchors.length - 1; i++) {
      var t0 = anchors[i][0], p0 = anchors[i][1], t1 = anchors[i + 1][0], p1 = anchors[i + 1][1];
      if (t >= t0 && t <= t1) return p0 + (t - t0) / (t1 - t0) * (p1 - p0);
    }
    return anchors[anchors.length - 1][1];
  }
  // trust 0 = fully cautious curve, 1 = fully bullish-on-progress curve
  function blendCdf(t, trust) {
    var po = cdf(t, ANCHORS_OPT), pp = cdf(t, ANCHORS_PESS);
    return pp + trust * (po - pp);
  }
  /* Inverse-CDF sample of "years from today until a CRQC exists", at a given
   * trust setting. Returns null for "beyond the 30-year horizon" -- that mass
   * is real (up to 23% of it, at full bullish) but WHERE beyond 30 it falls is
   * not something these five data points can tell you, so it is never turned
   * into a fake year. */
  function sampleZ(trust) {
    var Fmax = blendCdf(HORIZON, trust);
    var u = Math.random();
    if (u > Fmax) return null;
    var prevT = 0, prevF = 0;
    for (var i = 1; i < ANCHORS_OPT.length; i++) {
      var t = ANCHORS_OPT[i][0];
      var F = blendCdf(t, trust);
      if (u <= F) {
        if (F === prevF) return prevT;
        return prevT + (u - prevF) / (F - prevF) * (t - prevT);
      }
      prevT = t; prevF = F;
    }
    return HORIZON;
  }

  function yearsUntil(year) {
    var now = new Date(), end = new Date(year, 11, 31);
    return Math.max(0, (end - now) / (1000 * 60 * 60 * 24 * 365.25));
  }

  SymbiQ.odds = { cdf: cdf, blendCdf: blendCdf, sampleZ: sampleZ, ANCHORS_OPT: ANCHORS_OPT,
                  ANCHORS_PESS: ANCHORS_PESS, HORIZON: HORIZON };

  /* ============================ practical scenarios ========================
   * Three named, recognisable estates -- not because they are audited (they
   * are explicitly not: same illustrative status as the Sequencer's own
   * default template), but because "51.2% breach odds" lands very differently
   * once it is attached to a genomic-records archive or a substation fleet
   * instead of a row labelled "Asset 4". Each pairs a plausible algorithm
   * mix with a shelf-life shape that is the actual point of the scenario:
   * the hospital's problem is DATA that outlives any deadline; the bank's is
   * a REGULATOR-shaped deadline; the utility's is EQUIPMENT that outlives the
   * people who installed it. */
  var SCENARIOS = {
    hospital: {
      label: 'A Hospital', icon: '🏥', dlYear: 2030, policy: 'risk-first',
      blurb: 'The failure mode here is not the deadline — it is that a genome captured today is still someone’s genome in 2056. Harvest-now-decrypt-later is not a hypothetical for this estate; it is the estate.',
      assets: [
        { id: 'portal', name: 'Patient portal TLS',            alg: 'ECDSA P-256', shelf: 3,  effort: 2, deps: [],          owned: true },
        { id: 'ca',     name: 'Internal certificate authority', alg: 'RSA-4096',    shelf: 10, effort: 3, deps: [],          owned: true },
        { id: 'genom',  name: 'Genomic records archive signing', alg: 'RSA-3072',  shelf: 40, effort: 6, deps: ['ca'],       owned: true },
        { id: 'device', name: 'Bedside monitor fleet (embedded)', alg: 'RSA-2048', shelf: 15, effort: 9, deps: ['ca'],       owned: true },
        { id: 'claims', name: 'Insurance claims EDI (vendor)',  alg: 'ECDSA P-256', shelf: 7,  effort: 3, deps: [],          owned: false },
        { id: 'ehr',    name: 'Records database at rest',       alg: 'AES-256',    shelf: 40, effort: 0, deps: [],           owned: true }
      ]
    },
    bank: {
      label: 'A Bank', icon: '🏦', dlYear: 2030, policy: 'risk-first',
      blurb: 'The failure mode here is a regulator, not physics — most financial supervisors are converging on the same NIST timeline this page opened with. The lever that matters is capacity, not cleverness.',
      assets: [
        { id: 'online', name: 'Online-banking TLS',        alg: 'ECDSA P-256', shelf: 2,  effort: 2, deps: [],           owned: true },
        { id: 'ca',     name: 'Internal certificate authority', alg: 'RSA-4096', shelf: 10, effort: 4, deps: [],         owned: true },
        { id: 'swift',  name: 'Payment messaging signing',  alg: 'RSA-3072',   shelf: 10, effort: 4, deps: ['ca'],       owned: true },
        { id: 'hsm',    name: 'ATM network HSM keys',       alg: 'RSA-2048',   shelf: 8,  effort: 6, deps: ['ca'],       owned: true },
        { id: 'gw',     name: 'Card-network gateway (vendor)', alg: 'ECDSA P-256', shelf: 5, effort: 3, deps: [],        owned: false },
        { id: 'ledger', name: 'Transaction ledger at rest', alg: 'AES-256',    shelf: 15, effort: 0, deps: [],           owned: true }
      ]
    },
    utility: {
      label: 'A Utility', icon: '⚡', dlYear: 2033, policy: 'deepest-first',
      blurb: 'The failure mode here is the dependency chain, not any one asset: firmware is signed by a pipeline that trusts a CA, and the fleet in the field will outlive several of your migration plans regardless of order.',
      assets: [
        { id: 'scada',  name: 'SCADA operator TLS',         alg: 'ECDSA P-256', shelf: 5,  effort: 3,  deps: [],          owned: true },
        { id: 'ca',     name: 'Internal certificate authority', alg: 'RSA-4096', shelf: 10, effort: 4, deps: [],         owned: true },
        { id: 'fw',     name: 'Firmware signing pipeline',  alg: 'RSA-3072',   shelf: 20, effort: 5,  deps: ['ca'],      owned: true },
        { id: 'field',  name: 'Substation embedded fleet',  alg: 'RSA-2048',   shelf: 25, effort: 16, deps: ['fw'],      owned: true },
        { id: 'tele',   name: 'Grid telemetry vendor link', alg: 'ECDH P-256', shelf: 6,  effort: 3,  deps: [],          owned: false },
        { id: 'hist',   name: 'Historian database at rest', alg: 'AES-256',    shelf: 25, effort: 0,  deps: [],          owned: true }
      ]
    }
  };

  /* ================================ the UI ================================ */
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pct = function (x) { return (x * 100).toFixed(1) + '%'; };
  var band = function (p) { return p >= 0.40 ? 'hi' : p >= 0.15 ? 'mid' : 'lo'; };
  var bandColor = function (b) { return b === 'hi' ? 'var(--red)' : b === 'mid' ? 'var(--yellow)' : 'var(--teal)'; };

  SymbiQ.odds.mount = function (root, opts) {
    opts = opts || {};
    var live = null;                 // last published {assets, cap, policy, dlYear} from the Sequencer
    var trust = 0.5;
    var testYear = null;             // a chosen or rolled specific year, or null
    var testNote = '';                // how we got testYear -- chip or roll
    var rolledBeyond = false;         // last roll drew "no CRQC within 30 years"
    var batch = null;                 // cached {n, perAsset:{id:count}, anyCount, beyond} or null until run
    var shellBuilt = false;           // the slider/chips/scenario buttons are built once and never destroyed,
                                       // so a mid-drag slider doesn't get pulled out from under the pointer

    var nowY = new Date().getFullYear();
    var CHIPS = (SymbiQ.estate.DEADLINES || []).map(function (d) { return { y: d.y, label: d.label }; })
      .concat([{ y: nowY + 14, label: 'a generation out' }, { y: nowY + 24, label: 'two generations out' }]);

    /* ------------------------------------------------------------- chart -- */
    function chartSVG(rows, worst) {
      /* Font sizes here are picked for a phone, not a desktop -- the last
       * mobile-legibility bug on this site (2026-07-24) was exactly this:
       * a viewBox sized for desktop scaled to ~45% on a 375px screen, and a
       * "readable" 15-unit label rendered at under 7px. Verified live: at
       * 375px this container renders ~287px wide (scale .448), so 22 units
       * lands at ~9.9px -- the floor this site already treats as legible. */
      var W = 640, H = 258, ML = 64, MR = 14, MT = 16, MB = 36;
      var plotW = W - ML - MR, plotH = H - MT - MB;
      function X(t) { return ML + (Math.min(t, HORIZON) / HORIZON) * plotW; }
      function Y(p) { return MT + (1 - p) * plotH; }

      var gridH = [0, 25, 50, 75, 100].map(function (p) {
        var y = Y(p / 100);
        return '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>' +
          '<text x="' + (ML - 8) + '" y="' + (y + 5) + '" text-anchor="end" font-size="22" fill="var(--muted)">' + p + '%</text>';
      }).join('');
      var gridV = ANCHORS_OPT.map(function (a, i) {
        var x = X(a[0]);
        // edge labels anchor inward, not centred, so a 4-digit year never
        // hangs half off the viewBox at either end (a real overflow, caught
        // by measuring getBBox rather than reading the code)
        var anchor = i === 0 ? 'start' : i === ANCHORS_OPT.length - 1 ? 'end' : 'middle';
        return '<line x1="' + x + '" x2="' + x + '" y1="' + MT + '" y2="' + (H - MB) + '" stroke="var(--border)" stroke-width="1" opacity=".55"/>' +
          '<text x="' + x + '" y="' + (H - MB + 24) + '" text-anchor="' + anchor + '" font-size="22" fill="var(--muted)">' + (nowY + a[0]) + '</text>';
      }).join('');

      var optPts = ANCHORS_OPT.map(function (a) { return X(a[0]) + ',' + Y(a[1]); });
      var pessPtsRev = ANCHORS_PESS.slice().reverse().map(function (a) { return X(a[0]) + ',' + Y(a[1]); });
      var bandPath = 'M ' + optPts.join(' L ') + ' L ' + pessPtsRev.join(' L ') + ' Z';
      var blendPath = 'M ' + ANCHORS_OPT.map(function (a) { return X(a[0]) + ',' + Y(blendCdf(a[0], trust)); }).join(' L ');

      var markers = rows.map(function (x) {
        var b = band(x.breakevenZ <= HORIZON ? blendCdf(x.breakevenZ, trust) : blendCdf(HORIZON, trust));
        var xx = X(x.breakevenZ);
        var beyond = x.breakevenZ > HORIZON;
        return '<line x1="' + xx + '" x2="' + xx + '" y1="' + MT + '" y2="' + (H - MB) + '" stroke="' + bandColor(b) +
          '" stroke-width="2" stroke-dasharray="4 3" opacity="' + (beyond ? '.4' : '.85') + '"/>';
      }).join('');

      var dot = '';
      if (testYear != null && !rolledBeyond) {
        var yf = yearsUntil(testYear);
        if (yf <= HORIZON) {
          var px = X(yf), py = Y(blendCdf(yf, trust));
          dot = '<line x1="' + px + '" x2="' + px + '" y1="' + py + '" y2="' + (H - MB) + '" stroke="var(--violet)" stroke-width="2" stroke-dasharray="2 3"/>' +
            '<circle cx="' + px + '" cy="' + py + '" r="6.5" fill="var(--violet)" stroke="var(--bg, #0b0f1a)" stroke-width="1.5"/>';
        }
      }

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="od-svg" role="img" aria-label="Cumulative probability, from the Global Risk Institute survey, that a cryptographically relevant quantum computer exists by a given year, with your plan\'s exposed assets marked">' +
        gridH + gridV +
        '<path d="' + bandPath + '" fill="var(--violet)" opacity=".12"/>' +
        '<path d="' + blendPath + '" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
        markers + dot + '</svg>';
    }

    /* --------------------------------------------------------- scenario --- */
    function scenarioRows(rows) {
      if (rolledBeyond) {
        return '<div class="verdict warn">This roll drew <b>no CRQC within the surveyed 30-year window</b> — ' +
          'beyond what these five data points can say anything specific about. Every asset here is safe against ' +
          'this particular draw, for whatever that is worth.</div>';
      }
      if (testYear == null) return '<p class="od-p">Pick a year above, or roll one, to see a pass/fail table for this exact plan.</p>';
      var yf = yearsUntil(testYear);
      var breached = 0;
      var body = rows.map(function (x) {
        var hit = yf < x.breakevenZ;
        if (hit) breached++;
        return '<tr><th scope="row">' + esc(x.a.name) + '</th>' +
          '<td class="es-n">' + x.breakevenZ + ' y</td>' +
          '<td><span class="cb-tag ' + (hit ? 'bad' : 'ok') + '">' + (hit ? 'BREACHED' : 'safe') + '</span></td></tr>';
      }).join('');
      var pAtYear = blendCdf(Math.min(yf, HORIZON), trust);
      var verdictClass = breached ? 'bad' : 'good';
      var verdictText = breached
        ? '<b>' + breached + ' of ' + rows.length + ' assets already lost</b> if a CRQC exists by ' + testYear + '.'
        : '<b>All ' + rows.length + ' assets still safe</b> if a CRQC exists by ' + testYear + '.';
      return '<div class="verdict ' + verdictClass + '">' + verdictText + ' ' + esc(testNote) + '</div>' +
        '<p class="od-p">Experts put roughly <b>' + pct(pAtYear) + '</b> cumulative likelihood on a CRQC existing by ' +
        testYear + ' (' + yf.toFixed(1) + ' years out), at your current trust setting.</p>' +
        '<div class="es-scroll"><table class="es"><thead><tr><th>Asset</th><th>Exposed unless further off than</th><th>At ' + testYear + '</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>';
    }

    function runBatch(rows, n) {
      var perAsset = {}; rows.forEach(function (x) { perAsset[x.a.id] = 0; });
      var anyCount = 0, beyond = 0;
      for (var i = 0; i < n; i++) {
        var z = sampleZ(trust);
        if (z === null) { beyond++; continue; }
        var any = false;
        rows.forEach(function (x) { if (z < x.breakevenZ) { perAsset[x.a.id]++; any = true; } });
        if (any) anyCount++;
      }
      return { n: n, perAsset: perAsset, anyCount: anyCount, beyond: beyond };
    }

    function batchOut(rows, worst) {
      if (!batch) return '<p class="es-add"><button type="button" class="preset bigger" id="od-batch">🎲 Run 2,000 simulated futures</button></p>';
      var b = batch;
      var exactWorst = worst <= HORIZON ? blendCdf(worst, trust) : null;
      var floorWorst = blendCdf(Math.min(worst, HORIZON), trust);
      var rowsHtml = rows.map(function (x) {
        var emp = b.perAsset[x.a.id] / b.n;
        var exact = x.breakevenZ <= HORIZON ? blendCdf(x.breakevenZ, trust) : null;
        return '<div class="sc-row"><span class="sc-rl">' + esc(x.a.name) + '</span>' +
          '<span class="sc-rv es-z ' + band(emp) + '">' + pct(emp) + '</span>' +
          '<span class="sc-rl">' + (exact != null ? 'exact: ' + pct(exact) : '≥ ' + pct(floorWorst) + ' (beyond 30y)') + '</span></div>';
      }).join('');
      return '<p class="od-p"><b>' + b.n.toLocaleString() + ' simulated futures</b>, ' + b.beyond +
        ' of them (' + pct(b.beyond / b.n) + ') drew no CRQC within the surveyed 30-year window at all.</p>' +
        '<div class="sc-grid">' + rowsHtml + '</div>' +
        '<p class="od-p"><b>Your whole plan is breached in ' + pct(b.anyCount / b.n) + ' of these futures</b> ' +
        (exactWorst != null ? '(exact figure from the curve: ' + pct(exactWorst) + ' — dice and formula should agree within simulation noise).'
                             : '(your longest breakeven, ' + worst + ' years, is beyond the 30-year survey — this is a floor, not the true figure).') +
        '</p><p class="es-add"><button type="button" class="preset" id="od-batch">Roll another 2,000</button></p>';
    }

    /* ------------------------------------------------------ the one lever - */
    function policySweep(cap) {
      var pols = ['risk-first', 'quick-wins', 'deepest-first', 'as-listed'];
      return pols.map(function (p) {
        var a2 = JSON.parse(JSON.stringify(live.assets));
        var w = SymbiQ.estate.assess(a2, cap, p).worst;
        return { p: p, worst: w, odds: blendCdf(Math.min(w, HORIZON), trust) };
      }).sort(function (a, b) { return a.odds - b.odds; });
    }

    function recommendation(worst) {
      var curOdds = blendCdf(Math.min(worst, HORIZON), trust);
      var pols = policySweep(live.cap);
      var bestPol = pols[0];
      var polGain = curOdds - bestPol.odds;

      var a3 = JSON.parse(JSON.stringify(live.assets));
      var w2 = SymbiQ.estate.assess(a3, live.cap + 1, bestPol.p).worst;
      var capOdds = blendCdf(Math.min(w2, HORIZON), trust);
      var capGain = bestPol.odds - capOdds;

      var lines = [];
      if (polGain > 0.005 && bestPol.p !== live.policy) {
        lines.push('<p class="od-p"><b>The one free lever:</b> switching migration order to <b>' + esc(bestPol.p) +
          '</b> cuts breach odds from <b>' + pct(curOdds) + '</b> to <b>' + pct(bestPol.odds) +
          '</b> — same team, same deadline, only the sequence changes.</p>');
      } else {
        lines.push('<p class="od-p"><b>Ordering is already doing its job here</b> — your current policy is at or near the best of the four, ' +
          pct(curOdds) + '.</p>');
      }
      if (capGain > 0.01) {
        lines.push('<p class="od-p"><b>The one paid lever:</b> one more unit of capacity per quarter (' + live.cap + ' → ' + (live.cap + 1) +
          ') would cut it further, to <b>' + pct(capOdds) + '</b> — that one costs hiring or reprioritising, the ordering change above does not.</p>');
      }
      return lines.join('');
    }

    /* ---------------------------------------------------------- briefing -- */
    function download(rows, worst) {
      var odds = blendCdf(Math.min(worst, HORIZON), trust);
      var L = [];
      L.push('SYMBIQ — THE ODDS: A QUANTUM-RISK BRIEFING');
      L.push('Generated ' + new Date().toISOString().slice(0, 10) + ' · https://starkck.github.io/SYMBIQ/pqc.html#odds');
      L.push('');
      L.push('Calibrated to: Global Risk Institute, Quantum Threat Timeline Report 2024 (Mosca & Piani; 32 named experts).');
      L.push('Trust setting used: ' + Math.round(trust * 100) + '/100 (0 = cautious experts, 100 = bullish-on-progress experts).');
      L.push('Plan: capacity ' + live.cap + ' quarter-unit(s)/quarter · policy "' + live.policy + '" · deadline ' + live.dlYear + '.');
      L.push('');
      L.push('PER-ASSET, AT THIS TRUST SETTING:');
      rows.forEach(function (x) {
        var p = x.breakevenZ <= HORIZON ? blendCdf(x.breakevenZ, trust) : null;
        L.push('  - ' + x.a.name + ' (' + x.a.alg + '): exposed unless a CRQC is ' + x.breakevenZ + '+ years off -> ' +
          (p != null ? pct(p) + ' breach odds' : '>= ' + pct(blendCdf(HORIZON, trust)) + ' (beyond the 30-year survey — floor, not exact)'));
      });
      L.push('');
      L.push('OVERALL: this plan is breached in ' + (worst <= HORIZON ? pct(odds) : '>= ' + pct(odds)) + ' of simulated futures at this trust setting.');
      L.push('');
      L.push(recommendation(worst).replace(/<[^>]+>/g, ''));
      L.push('');
      L.push('This is arithmetic against a published expert survey, not a prediction and not investment or legal advice.');
      var blob = new Blob([L.join('\n')], { type: 'text/plain' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'symbiq-odds-briefing.txt'; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* ----------------------------------------------------- policy compare - */
    function policyCmp() {
      var cmp = policySweep(live.cap);
      return '<p class="es-cmp"><b>Breach probability by policy</b>, computed exactly from the curve (no dice): ' +
        cmp.map(function (c) { return esc(c.p) + ' <b>' + (c.worst > HORIZON ? '≥' : '') + pct(c.odds) + '</b>'; }).join(' · ') + '.</p>';
    }

    /* ----------------------------------------------------------- render --- */
    function renderDynamic() {
      var host = root.querySelector('#od-dynamic');
      if (!host) return;
      var r = SymbiQ.estate.assess(live.assets, live.cap, live.policy);
      var rows = r.rows.filter(function (x) { return x.vuln && !x.stuck; })
                        .sort(function (a, b) { return b.breakevenZ - a.breakevenZ; });
      if (!rows.length) {
        host.innerHTML = '<p class="od-p">Nothing in the current plan is exposed — every vulnerable asset already has a finish quarter, ' +
          'or there is nothing vulnerable to migrate. Add or edit an asset in the Sequencer above, or load a scenario, to see odds here.</p>';
        return;
      }
      var worst = Math.max.apply(null, rows.map(function (x) { return x.breakevenZ; }));
      host.innerHTML =
        '<div class="od-chartwrap">' + chartSVG(rows, worst) + '</div>' +
        '<p class="od-legend"><span><i class="od-sw" style="background:var(--violet);opacity:.35"></i>cautious-to-bullish range</span>' +
          '<span><i class="od-sw" style="background:var(--teal)"></i>your trust setting</span>' +
          '<span><i class="od-sw dash" style="border-color:var(--red)"></i>an asset’s breakeven</span>' +
          '<span><i class="od-sw dot" style="background:var(--violet)"></i>tested year</span></p>' +
        '<div id="od-scenario">' + scenarioRows(rows) + '</div>' +
        '<h3 class="cb-h">Or run the dice two thousand times</h3>' +
        '<p class="od-p">Same experts, same plan — instead of one drawn year, sample the whole distribution.</p>' +
        '<div id="od-batchout">' + batchOut(rows, worst) + '</div>' +
        '<h3 class="cb-h">What actually helps</h3>' +
        recommendation(worst) + policyCmp() +
        '<p class="es-add"><button type="button" class="preset" id="od-dl">⤓ Download this as a risk briefing</button></p>';
    }

    function ensureShell() {
      if (shellBuilt) return;
      var scenBtns = Object.keys(SCENARIOS).map(function (k) {
        var s = SCENARIOS[k];
        return '<button type="button" class="preset" data-scn="' + k + '">' + s.icon + ' ' + esc(s.label) + '<em>load a named example</em></button>';
      }).join('');
      var chipsHtml = CHIPS.map(function (c) {
        return '<button type="button" class="preset" data-y="' + c.y + '">' + c.y + '<em>' + esc(c.label) + '</em></button>';
      }).join('') + '<button type="button" class="preset" id="od-roll">🎲 Roll a year<em>weighted by the trust slider</em></button>';

      root.innerHTML =
        '<p class="es-lab">Start from a named scenario <em class="od-opt">(optional — the Sequencer’s own estate works fine too)</em></p>' +
        '<div class="es-opts">' + scenBtns + '</div>' +
        '<div id="od-scnblurb"></div>' +
        '<div class="es-ctl"><label class="es-lab">Which experts do you believe? <b id="od-trustv">' + Math.round(trust * 100) + '</b>' +
          '<input type="range" id="od-trust" min="0" max="100" value="' + Math.round(trust * 100) + '"></label>' +
          '<p class="od-scale" id="od-scale"></p></div>' +
        '<p class="es-lab">Test a specific year against your current plan</p>' +
        '<div class="es-opts" id="od-chips">' + chipsHtml + '</div>' +
        '<div id="od-dynamic"></div>';
      shellBuilt = true;
    }

    function updateScale() {
      var el = root.querySelector('#od-scale');
      if (!el) return;
      var pOpt10 = cdf(10, ANCHORS_OPT), pPess10 = cdf(10, ANCHORS_PESS);
      el.innerHTML = '<span>Cautious — ' + pct(pPess10) + ' by ' + (nowY + 10) + '</span><span>Bullish — ' + pct(pOpt10) + ' by ' + (nowY + 10) + '</span>';
    }

    function render() {
      if (!live) {
        root.innerHTML = '<p class="sc-wait">Build a plan in the Sequencer above, or load a scenario here — this tool reads it live.</p>';
        shellBuilt = false;
        return;
      }
      ensureShell();
      updateScale();
      renderDynamic();
    }

    SymbiQ.estate.subscribe(function (state) { live = state; batch = null; render(); });

    root.addEventListener('input', function (e) {
      if (e.target.id === 'od-trust') {
        trust = (+e.target.value) / 100;
        root.querySelector('#od-trustv').textContent = e.target.value;
        batch = null;
        if (live) renderDynamic();
      }
    });

    root.addEventListener('click', function (e) {
      var scn = e.target.closest('[data-scn]');
      if (scn) {
        var s = SCENARIOS[scn.dataset.scn];
        SymbiQ.estate.loadScenario(s.assets, { label: s.label, dlYear: s.dlYear, policy: s.policy });
        var blurbHost = root.querySelector('#od-scnblurb');
        if (blurbHost) blurbHost.innerHTML = '<p class="od-p"><b>' + s.icon + ' ' + esc(s.label) + '.</b> ' + esc(s.blurb) + '</p>';
        testYear = null; rolledBeyond = false;
        return;
      }
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.y) {
        testYear = +b.dataset.y; testNote = ''; rolledBeyond = false;
        root.querySelectorAll('#od-chips [data-y]').forEach(function (btn) {
          btn.classList.toggle('on', +btn.dataset.y === testYear);
        });
        if (live) renderDynamic();
      }
      else if (b.id === 'od-roll') {
        var z = sampleZ(trust);
        root.querySelectorAll('#od-chips [data-y]').forEach(function (btn) { btn.classList.remove('on'); });
        if (z === null) { testYear = null; rolledBeyond = true; }
        else { testYear = Math.round(nowY + z); testNote = '(rolled, not chosen)'; rolledBeyond = false; }
        if (live) renderDynamic();
      }
      else if (b.id === 'od-batch') {
        var rr = SymbiQ.estate.assess(live.assets, live.cap, live.policy);
        var rows2 = rr.rows.filter(function (x) { return x.vuln && !x.stuck; });
        batch = runBatch(rows2, 2000);
        renderDynamic();
      }
      else if (b.id === 'od-dl') {
        var rr2 = SymbiQ.estate.assess(live.assets, live.cap, live.policy);
        var rows3 = rr2.rows.filter(function (x) { return x.vuln && !x.stuck; }).sort(function (a, c) { return c.breakevenZ - a.breakevenZ; });
        if (rows3.length) download(rows3, Math.max.apply(null, rows3.map(function (x) { return x.breakevenZ; })));
      }
    });

    render();
  };
})();
