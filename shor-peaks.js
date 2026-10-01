(function (root) {
  'use strict';

  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function powmod(a, e, N) { var r = 1; a %= N; while (e > 0) { if (e & 1) r = (r * a) % N; a = (a * a) % N; e = Math.floor(e / 2); } return r; }
  function orderOf(a, N) { var x = a % N, r = 1; while (x !== 1) { x = (x * a) % N; r++; if (r > N) return 0; } return r; }
  function qFor(N) { return Math.pow(2, 2 * Math.ceil(Math.log(N) / Math.LN2 - 1e-12)); }

  function fft(re, im) {
    var n = re.length, i, j = 0, k, t;
    for (i = 1; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = 2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ur = re[i + k], ui = im[i + k];
          var vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  function support(N, a, x0, Q) {
    var r = orderOf(a, N), xs = [], y0 = powmod(a, x0, N);
    for (var x = 0; x < Q; x++) if (powmod(a, x, N) === y0) xs.push(x);
    return { r: r, y0: y0, xs: xs };
  }
  function spectrum(xs, Q) {
    var re = new Float64Array(Q), im = new Float64Array(Q), k;
    for (var i = 0; i < xs.length; i++) re[xs[i]] = 1;
    fft(re, im);
    var P = new Float64Array(Q), norm = xs.length * Q;
    for (k = 0; k < Q; k++) P[k] = (re[k] * re[k] + im[k] * im[k]) / norm;
    return P;
  }
  function convergents(k, Q) {
    var out = [], a = k, b = Q, h1 = 1, h0 = 0, k1 = 0, k0 = 1;
    while (b) {
      var q = Math.floor(a / b), t = a % b; a = b; b = t;
      var h = q * h1 + h0, kk = q * k1 + k0; h0 = h1; h1 = h; k0 = k1; k1 = kk;
      out.push([h, kk]);
    }
    return out;
  }
  function reduceOrder(d, a, N) {
    var p = 2, m = d;
    while (m > 1) {
      if (m % p === 0) { while (m % p === 0) m /= p; while (d % p === 0 && powmod(a, d / p, N) === 1) d /= p; }
      p++;
    }
    return d;
  }
  function recover(k, Q, N, a) {
    var cs = convergents(k, Q);
    for (var i = 0; i < cs.length; i++) { var d = cs[i][1]; if (d > 0 && d < N && powmod(a, d, N) === 1) return { r: reduceOrder(d, a, N), convergents: cs }; }
    return { r: 0, convergents: cs };
  }
  function successProb(P, Q, N, a, r) { var s = 0; for (var k = 0; k < Q; k++) if (recover(k, Q, N, a).r === r) s += P[k]; return s; }
  function basesFor(N) { var o = []; for (var a = 2; a < N; a++) if (gcd(a, N) === 1 && orderOf(a, N) > 1) o.push(a); return o; }

  var api = { gcd: gcd, powmod: powmod, orderOf: orderOf, qFor: qFor, fft: fft, support: support, spectrum: spectrum, convergents: convergents, reduceOrder: reduceOrder, recover: recover, successProb: successProb, basesFor: basesFor };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof document === 'undefined') return;

  var D = document, C = root.SymbiQ && root.SymbiQ.core;
  var host = D.getElementById('shor-peaks');
  if (!host) return;
  var reduced = function () { return !!(C && C.reduced && C.reduced()); };
  var NS = [15, 21, 33, 35];
  var DEFAULT = { N: 15, a: 7 };

  var st = { N: 15, a: 7, Q: 256, r: 4, xs: [], P: null, k: 64, x0: 0, tries: 0, wins: 0, play: false, zoom: false, expect: 0 };
  host.innerHTML =
    '<div class="sp-ctl">' +
    '<label>Number to factor <select class="sp-N" aria-label="The number N to factor"></select></label>' +
    '<label>Base a <select class="sp-a" aria-label="The base a, coprime to N"></select></label>' +
    '<span class="sp-info"></span></div>' +
    '<div class="sp-grid"><figure class="sp-fig"><canvas class="sp-spec" role="img" aria-label="The measurement probabilities for every outcome k. Tall spikes mark the likely outcomes."></canvas>' +
    '<figcaption>Every outcome k, and how likely the machine is to measure it. Click to pick one.</figcaption></figure>' +
    '<figure class="sp-fig"><canvas class="sp-walk" role="img" aria-label="The arrows that add up to the probability of the chosen outcome, laid end to end."></canvas>' +
    '<figcaption class="sp-wcap"></figcaption></figure></div>' +
    '<div class="sp-ctl2"><label class="sp-kl">Outcome k <input type="range" class="sp-k" min="0" value="0" aria-label="The outcome k to look at"></label>' +
    '<button type="button" class="preset sp-peak">Jump to a peak</button><button type="button" class="preset sp-play" aria-pressed="false">Sweep k</button>' +
    '<label class="sp-zl"><input type="checkbox" class="sp-zoom"> Zoom in on the arrows</label></div>' +
    '<div class="sp-run"><button type="button" class="preset sp-one">Run it once</button><button type="button" class="preset sp-many">Run it 50 times</button><button type="button" class="preset sp-reset">Reset tally</button></div>' +
    '<p class="sp-read formula" aria-live="polite"></p><p class="sp-tally"></p>';
  var selN = host.querySelector('.sp-N'), selA = host.querySelector('.sp-a'), info = host.querySelector('.sp-info');
  var cSpec = host.querySelector('.sp-spec'), cWalk = host.querySelector('.sp-walk'), wcap = host.querySelector('.sp-wcap');
  var slider = host.querySelector('.sp-k'), read = host.querySelector('.sp-read'), tally = host.querySelector('.sp-tally');
  NS.forEach(function (n) { var o = D.createElement('option'); o.value = n; o.textContent = n; selN.appendChild(o); });

  function colors() {
    var cs = getComputedStyle(D.documentElement), g = function (n, f) { return (cs.getPropertyValue(n) || '').trim() || f; };
    return { teal: g('--teal', '#2dd4bf'), violet: g('--violet', '#a78bfa'), text: g('--text', '#e8ecf6'), muted: g('--muted', '#9aa5bd'), border: g('--border', '#232d45'), panel: g('--panel', '#131a2b') };
  }
  function fitCanvas(c, h) {
    var w = c.clientWidth || 300, r = Math.min(root.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * r) || c.height !== Math.round(h * r)) { c.width = Math.round(w * r); c.height = Math.round(h * r); }
    var g = c.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0); return { g: g, w: w, h: h };
  }

  function pickBases() {
    var bs = basesFor(st.N); selA.innerHTML = '';
    bs.forEach(function (a) { var o = D.createElement('option'); o.value = a; o.textContent = a + '  (period ' + orderOf(a, st.N) + ')'; selA.appendChild(o); });
    if (bs.indexOf(st.a) < 0) st.a = (st.N === DEFAULT.N && bs.indexOf(DEFAULT.a) >= 0) ? DEFAULT.a : bs[0];
    selA.value = st.a;
  }
  function rebuild(x0) {
    st.Q = qFor(st.N); st.r = orderOf(st.a, st.N);
    st.x0 = x0 == null ? 0 : x0;
    var s = support(st.N, st.a, st.x0, st.Q); st.xs = s.xs; st.P = spectrum(st.xs, st.Q);
    slider.max = st.Q - 1;
    st.expect = successProb(st.P, st.Q, st.N, st.a, st.r);
    info.textContent = 'period r = ' + st.r + ' · counting register Q = ' + st.Q + ' (' + Math.round(Math.log(st.Q) / Math.LN2) + ' qubits) · ' + st.xs.length + ' values of x in the state';
  }
  function peakK() { return Math.round(st.Q / st.r * (1 + Math.floor(Math.random() * Math.max(1, st.r - 1)))) % st.Q; }

  function drawSpec() {
    var f = fitCanvas(cSpec, 190), g = f.g, W = f.w, H = f.h, c = colors(), Q = st.Q, P = st.P, i, k;
    g.clearRect(0, 0, W, H);
    var padB = 30, padT = 10, plotH = H - padB - padT, max = 0;
    for (k = 0; k < Q; k++) if (P[k] > max) max = P[k];
    var cols = Math.min(Q, Math.floor(W)), colW = W / cols;
    g.fillStyle = c.teal;
    for (i = 0; i < cols; i++) {
      var k0 = Math.floor(i * Q / cols), k1 = Math.max(k0 + 1, Math.floor((i + 1) * Q / cols)), m = 0;
      for (k = k0; k < k1; k++) if (P[k] > m) m = P[k];
      var h = plotH * (m / max); g.fillRect(i * colW, padT + plotH - h, Math.max(1, colW - (cols < 200 ? 1 : 0)), h);
    }
    g.strokeStyle = c.border; g.beginPath(); g.moveTo(0, padT + plotH + 0.5); g.lineTo(W, padT + plotH + 0.5); g.stroke();
    g.fillStyle = c.muted; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
    for (var s = 0; s < st.r; s++) { var x = (s * Q / st.r) / Q * W; g.fillRect(x - 0.5, padT + plotH + 2, 1, 6); if (st.r <= 12) g.fillText(s + '/' + st.r, Math.min(W - 12, Math.max(12, x + 2)), padT + plotH + 22); }
    if (st.r > 12) g.fillText('ticks at s/r, for s = 0 … r−1', W / 2, padT + plotH + 24);
    var kx = (st.k + 0.5) / Q * W; g.strokeStyle = c.violet; g.lineWidth = 2; g.beginPath(); g.moveTo(kx, padT); g.lineTo(kx, padT + plotH); g.stroke(); g.lineWidth = 1;
  }

  function drawWalk() {
    var f = fitCanvas(cWalk, 190), g = f.g, W = f.w, H = f.h, c = colors(), Q = st.Q, k = st.k, xs = st.xs, n = xs.length, i;
    g.clearRect(0, 0, W, H);
    var zr = new Float64Array(n + 1), zi = new Float64Array(n + 1), maxAbs = 0;
    for (i = 0; i < n; i++) { var ang = 2 * Math.PI * ((k * xs[i]) % Q) / Q; zr[i + 1] = zr[i] + Math.cos(ang); zi[i + 1] = zi[i] + Math.sin(ang); var m = Math.hypot(zr[i + 1], zi[i + 1]); if (m > maxAbs) maxAbs = m; }
    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.44;
    var scale = st.zoom ? R / Math.max(maxAbs, 1e-9) : R / n;
    g.strokeStyle = c.border; g.beginPath(); g.arc(cx, cy, st.zoom ? R : R, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    g.strokeStyle = c.teal; g.lineWidth = 1.5; g.beginPath();
    var step = Math.max(1, Math.floor(n / 1500));
    for (i = 0; i <= n; i += step) { var px = cx + zr[i] * scale, py = cy - zi[i] * scale; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); }
    g.stroke(); g.lineWidth = 1;
    var ex = cx + zr[n] * scale, ey = cy - zi[n] * scale;
    g.strokeStyle = c.violet; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke(); g.lineWidth = 1;
    g.fillStyle = c.violet; g.beginPath(); g.arc(ex, ey, 3.5, 0, 7); g.fill();
    var len = Math.hypot(zr[n], zi[n]), p = (len * len) / (n * Q);
    wcap.innerHTML = '<b>' + n + ' arrows</b>, one per x, laid end to end. Net length <b>' + (len >= 100 ? Math.round(len) : len.toFixed(1)) + '</b> of a possible ' + n + '. Chance of measuring this k: <b>' + (p >= 0.01 ? (100 * p).toFixed(1) : (100 * p).toFixed(3)) + '%</b>.';
    return p;
  }
  function setK(k) {
    st.k = ((k % st.Q) + st.Q) % st.Q; slider.value = st.k; drawSpec(); drawWalk();
    var frac = (st.k * st.r) / st.Q, d = Math.abs(frac - Math.round(frac));
    read.innerHTML = 'k = <b>' + st.k + '</b> of ' + st.Q + ', so k/Q = ' + (st.k / st.Q).toFixed(4) + '. The arrows turn by k·r/Q = ' + frac.toFixed(3) + ' of a full turn per step of r' +
      (d < 0.02 ? ': a whole number of turns, so they all point the same way and add up.' : d < 0.15 ? ': almost a whole number, so they mostly line up.' : ': a fraction that is not whole, so they curl round and cancel.');
  }

  function sample() {
    var u = Math.random(), s = 0, k;
    for (k = 0; k < st.Q; k++) { s += st.P[k]; if (u < s) return k; }
    return st.Q - 1;
  }
  function frText(cs) { return cs.map(function (c) { return c[0] + '/' + c[1]; }).join(', '); }
  function questStep() { try { if (window.SymbiQ && window.SymbiQ.quest) window.SymbiQ.quest.step('qday', 'shor'); } catch (e) { } }
  function once(quiet) {
    rebuild(Math.floor(Math.random() * st.r));
    var k = sample(), res = recover(k, st.Q, st.N, st.a);
    st.tries++; if (res.r === st.r) { st.wins++; if (!quiet) questStep(); }
    if (!quiet) {
      setK(k);
      var head = 'Measured <b>k = ' + k + '</b>, so k/Q = ' + k + '/' + st.Q + ' = ' + (k / st.Q).toFixed(4) + '. Convergents: ' + frText(res.convergents) + '. ';
      read.innerHTML = head + (res.r
        ? 'Denominator <b>' + res.r + '</b> passes the test ' + st.a + '<sup>' + res.r + '</sup> mod ' + st.N + ' = 1. <b>Period found: r = ' + res.r + '.</b> ' + factorText(res.r)
        : 'No convergent gives a denominator d with ' + st.a + '<sup>d</sup> mod ' + st.N + ' = 1. <b>This run fails</b>: k/Q reduced to a fraction whose denominator is a proper divisor of r (or k was 0). Runs like this are expected, and the fix is to run again.');
    }
    paintTally();
    return res.r === st.r;
  }
  function factorText(r) {
    if (r % 2) return 'r is odd, so this a cannot give a factor: pick another base.';
    var x = powmod(st.a, r / 2, st.N);
    if (x === st.N - 1) return st.a + '<sup>' + (r / 2) + '</sup> mod ' + st.N + ' = ' + x + ' = −1, so this a gives nothing: pick another base.';
    var p = gcd(x - 1, st.N), q = gcd(x + 1, st.N);
    return 'Then gcd(' + st.a + '<sup>' + (r / 2) + '</sup> − 1, ' + st.N + ') = ' + p + ' and gcd(' + st.a + '<sup>' + (r / 2) + '</sup> + 1, ' + st.N + ') = ' + q + ', so <b>' + st.N + ' = ' + p + ' × ' + (st.N / p) + '</b>.';
  }
  function paintTally() {
    tally.innerHTML = st.tries
      ? 'Tally: <b>' + st.wins + '</b> of <b>' + st.tries + '</b> runs found r (' + Math.round(100 * st.wins / st.tries) + '%). The exact chance of success per run for N = ' + st.N + ', a = ' + st.a + ' is <b>' + (100 * st.expect).toFixed(1) + '%</b>.'
      : 'The exact chance that one run finds r, for N = ' + st.N + ' and a = ' + st.a + ', is <b>' + (100 * st.expect).toFixed(1) + '%</b>. Run it and compare.';
  }
  function many() { for (var i = 0; i < 50; i++) once(true); if (st.wins) questStep(); rebuild(0); var k = sample(); setK(k); read.innerHTML = 'Fifty runs done. Each one measured a k from the spectrum above and tried the continued-fraction step. The tally below is the result; it should sit near the exact chance.'; paintTally(); }

  function loop() {
    if (!st.play) return;
    st.k = (st.k + Math.max(1, Math.round(st.Q / 240))) % st.Q; slider.value = st.k; drawSpec(); drawWalk();
    var frac = (st.k * st.r) / st.Q, d = Math.abs(frac - Math.round(frac));
    read.innerHTML = 'k = <b>' + st.k + '</b>: ' + (d < 0.02 ? 'a peak, the arrows line up.' : 'the arrows are curling round.');
    root.requestAnimationFrame(loop);
  }
  function setPlay(on) { st.play = on; host.querySelector('.sp-play').setAttribute('aria-pressed', String(on)); host.querySelector('.sp-play').textContent = on ? 'Stop' : 'Sweep k'; if (on) root.requestAnimationFrame(loop); }

  selN.addEventListener('change', function () { st.N = +selN.value; pickBases(); st.a = +selA.value; rebuild(0); st.tries = st.wins = 0; setK(peakK()); paintTally(); });
  selA.addEventListener('change', function () { st.a = +selA.value; rebuild(0); st.tries = st.wins = 0; setK(peakK()); paintTally(); });
  slider.addEventListener('input', function () { setPlay(false); setK(+slider.value); });
  host.querySelector('.sp-peak').addEventListener('click', function () { setPlay(false); setK(peakK()); });
  host.querySelector('.sp-play').addEventListener('click', function () { setPlay(!st.play); });
  host.querySelector('.sp-zoom').addEventListener('change', function (e) { st.zoom = e.target.checked; drawWalk(); });
  host.querySelector('.sp-one').addEventListener('click', function () { setPlay(false); once(false); });
  host.querySelector('.sp-many').addEventListener('click', function () { setPlay(false); many(); });
  host.querySelector('.sp-reset').addEventListener('click', function () { st.tries = st.wins = 0; paintTally(); });
  cSpec.addEventListener('click', function (e) { var r = cSpec.getBoundingClientRect(); setPlay(false); setK(Math.floor((e.clientX - r.left) / r.width * st.Q)); });

  selN.value = DEFAULT.N; pickBases(); st.a = DEFAULT.a; selA.value = st.a; rebuild(0);
  root.SymbiQ = root.SymbiQ || {}; root.SymbiQ.shorPeaks = { state: st, setK: setK, once: once, redraw: function () { drawSpec(); drawWalk(); }, api: api };
  var det = host.closest('details');
  if (det) det.addEventListener('toggle', function () { if (det.open) root.setTimeout(function () { setK(st.k); paintTally(); }, 0); });
  if (root.ResizeObserver) new root.ResizeObserver(function () { if (host.offsetParent !== null) { drawSpec(); drawWalk(); } }).observe(host);
  setK(peakK() || st.k); paintTally();
  if (reduced()) setPlay(false);
})(typeof window !== 'undefined' ? window : globalThis);
