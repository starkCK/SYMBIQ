(function () {
  'use strict';
  var W = window, D = document;
  var esc = (W.SymbiQ && W.SymbiQ.core && W.SymbiQ.core.esc) || function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var enc = new TextEncoder();

  function sha256(bytes) { return W.crypto.subtle.digest('SHA-256', bytes).then(function (b) { return new Uint8Array(b); }); }
  function hex(u8) { var s = '', i; for (i = 0; i < u8.length; i++) s += (u8[i] < 16 ? '0' : '') + u8[i].toString(16); return s; }
  function bitsOf(u8) { var out = [], i, j; for (i = 0; i < u8.length; i++) for (j = 7; j >= 0; j--) out.push((u8[i] >> j) & 1); return out; }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
  function powmod(b, e, m) { var r = 1, x = b % m; while (e > 0) { if (e & 1) r = (r * x) % m; x = (x * x) % m; e = Math.floor(e / 2); } return r; }
  function modinv(a, m) { var t = 0, nt = 1, r = m, nr = a % m, q, tmp; while (nr) { q = Math.floor(r / nr); tmp = t - q * nt; t = nt; nt = tmp; tmp = r - q * nr; r = nr; nr = tmp; } return t < 0 ? t + m : t; }
  function mean(xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }
  function sd(xs) { var m = mean(xs); return Math.sqrt(mean(xs.map(function (x) { return (x - m) * (x - m); }))); }
  function el(html) { var t = D.createElement('div'); t.innerHTML = html; return t.firstElementChild; }

  function mountHash(root) {
    root.className = 'ct ct-hash';
    root.innerHTML =
      '<div class="ct-row"><label for="cth-a">First text</label><input id="cth-a" type="text" value="The quick brown fox jumps over the lazy dog" autocomplete="off" spellcheck="false"></div>' +
      '<div class="ct-row"><label for="cth-b">Second text</label><input id="cth-b" type="text" value="The quick brown fox jumps over the lazy cog" autocomplete="off" spellcheck="false"></div>' +
      '<p class="ct-out" data-r="da"></p><p class="ct-out" data-r="db"></p>' +
      '<p class="ct-big" role="status" aria-live="polite" data-r="diff"></p>' +
      '<div class="ct-strip" data-r="strip" role="img" aria-label="256 cells, one per output bit; shaded cells are the bits that differ"></div>' +
      '<div class="ct-act"><button type="button" class="preset" data-r="many">Try 1,000 random one-bit changes</button></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="stat"></p>';
    var a = root.querySelector('#cth-a'), b = root.querySelector('#cth-b'), seq = 0;
    function q(n) { return root.querySelector('[data-r="' + n + '"]'); }
    function run() {
      var my = ++seq;
      Promise.all([sha256(enc.encode(a.value)), sha256(enc.encode(b.value))]).then(function (r) {
        if (my !== seq) return;
        var ba = bitsOf(r[0]), bb = bitsOf(r[1]), diff = 0, cells = '', i;
        for (i = 0; i < 256; i++) { var d = ba[i] !== bb[i]; if (d) diff++; cells += '<i class="' + (d ? 'on' : '') + '"></i>'; }
        q('da').innerHTML = 'SHA-256 of the first: <code>' + hex(r[0]) + '</code>';
        q('db').innerHTML = 'SHA-256 of the second: <code>' + hex(r[1]) + '</code>';
        q('diff').innerHTML = a.value === b.value ? 'The two texts are identical, so the digests are too: 0 of 256 bits differ.' : '<b>' + diff + ' of 256</b> bits differ (about half is what a good hash gives).';
        q('strip').innerHTML = cells;
        root.setAttribute('data-diff', diff);
      });
    }
    a.addEventListener('input', run); b.addEventListener('input', run);
    q('many').addEventListener('click', function () {
      var btn = q('many'); btn.disabled = true; q('stat').textContent = 'Hashing 2,000 messages...';
      var counts = [], i = 0, rnd = new Uint8Array(32);
      (function step() {
        if (i >= 1000) {
          btn.disabled = false;
          q('stat').innerHTML = 'Over 1,000 random 32-byte messages, one input bit flipped each time: on average <b>' + mean(counts).toFixed(1) + '</b> output bits changed, spread (standard deviation) <b>' + sd(counts).toFixed(1) + '</b>. Theory for an ideal hash: 128 and 8.';
          root.setAttribute('data-mean', mean(counts).toFixed(2)); root.setAttribute('data-sd', sd(counts).toFixed(2));
          return;
        }
        W.crypto.getRandomValues(rnd);
        var m2 = rnd.slice(), bit = Math.floor(Math.random() * 256);
        m2[bit >> 3] ^= 1 << (bit & 7);
        Promise.all([sha256(rnd), sha256(m2)]).then(function (r) {
          var x = bitsOf(r[0]), y = bitsOf(r[1]), n = 0, k; for (k = 0; k < 256; k++) if (x[k] !== y[k]) n++;
          counts.push(n); i++;
          if (i % 100 === 0) setTimeout(step, 0); else step();
        });
      })();
    });
    run();
  }

  var DH_SETS = [{ p: 23, g: 5, a: 6, b: 15 }, { p: 101, g: 2, a: 37, b: 58 }, { p: 1019, g: 2, a: 411, b: 802 }, { p: 10007, g: 5, a: 3003, b: 7219 }];
  function mountDH(root) {
    root.className = 'ct ct-dh';
    root.innerHTML =
      '<div class="ct-row"><label for="ctd-set">Size of the prime p</label><select id="ctd-set">' + DH_SETS.map(function (s, i) { return '<option value="' + i + '">p = ' + s.p + ', g = ' + s.g + '</option>'; }).join('') + '</select></div>' +
      '<div class="ct-row"><label for="ctd-a">Alice’s secret a</label><input id="ctd-a" type="number" min="2" step="1"></div>' +
      '<div class="ct-row"><label for="ctd-b">Bob’s secret b</label><input id="ctd-b" type="number" min="2" step="1"></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="out"></p>' +
      '<div class="ct-act"><button type="button" class="preset" data-r="eve">Let the eavesdropper try every exponent</button></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="evo"></p>';
    var set = root.querySelector('#ctd-set'), ia = root.querySelector('#ctd-a'), ib = root.querySelector('#ctd-b');
    function q(n) { return root.querySelector('[data-r="' + n + '"]'); }
    function cur() { var s = DH_SETS[+set.value], a = Math.max(2, Math.min(s.p - 2, Math.floor(+ia.value) || 2)), b = Math.max(2, Math.min(s.p - 2, Math.floor(+ib.value) || 2)); return { p: s.p, g: s.g, a: a, b: b }; }
    function show() {
      var c = cur(), A = powmod(c.g, c.a, c.p), B = powmod(c.g, c.b, c.p), s1 = powmod(B, c.a, c.p), s2 = powmod(A, c.b, c.p);
      q('out').innerHTML = 'Public: p = ' + c.p + ', g = ' + c.g + '. Alice sends A = ' + c.g + '<sup>' + c.a + '</sup> mod ' + c.p + ' = <b>' + A + '</b>. Bob sends B = ' + c.g + '<sup>' + c.b + '</sup> mod ' + c.p + ' = <b>' + B + '</b>. ' +
        'Alice computes B<sup>a</sup> = <b>' + s1 + '</b>; Bob computes A<sup>b</sup> = <b>' + s2 + '</b>. ' + (s1 === s2 ? 'They agree.' : 'They differ (this should never happen).');
      root.setAttribute('data-shared', s1); root.setAttribute('data-A', A); root.setAttribute('data-B', B);
      q('evo').textContent = '';
    }
    function load() { var s = DH_SETS[+set.value]; ia.max = s.p - 2; ib.max = s.p - 2; ia.value = s.a; ib.value = s.b; show(); }
    set.addEventListener('change', load); ia.addEventListener('input', show); ib.addEventListener('input', show);
    q('eve').addEventListener('click', function () {
      var c = cur(), A = powmod(c.g, c.a, c.p), e, x = 1, steps = 0;
      for (e = 1; e < c.p; e++) { x = (x * c.g) % c.p; steps++; if (x === A) break; }
      var sec = powmod(powmod(c.g, c.b, c.p), e, c.p);
      q('evo').innerHTML = 'She saw only p, g, A and B. Trying exponents 1, 2, 3, ... she reached g<sup>' + e + '</sup> = ' + A + ' after <b>' + steps + '</b> steps, so a = ' + e + ', and the shared secret is B<sup>' + e + '</sup> = <b>' + sec + '</b>. ' +
        'With a 256-bit group the same search would need about 2<sup>256</sup> steps (or, with the best known method on a good curve, about 2<sup>128</sup>).';
      root.setAttribute('data-eve-a', e); root.setAttribute('data-eve-steps', steps); root.setAttribute('data-eve-secret', sec);
    });
    load();
  }

  var PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61], EXPS = [17, 19, 23, 29, 31, 37];
  function mountRSA(root) {
    root.className = 'ct ct-rsa';
    var opts = PRIMES.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
    root.innerHTML =
      '<div class="ct-row"><label for="ctr-p">Secret prime p</label><select id="ctr-p">' + opts + '</select></div>' +
      '<div class="ct-row"><label for="ctr-q">Secret prime q</label><select id="ctr-q">' + opts + '</select></div>' +
      '<div class="ct-row"><label for="ctr-m">A message (a number below n)</label><input id="ctr-m" type="number" min="2" step="1" value="65"></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="out"></p>' +
      '<div class="ct-act"><button type="button" class="preset" data-r="atk">Let the attacker factor n by trial division</button></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="ao"></p>';
    var sp = root.querySelector('#ctr-p'), sq = root.querySelector('#ctr-q'), im = root.querySelector('#ctr-m');
    sp.value = '61'; sq.value = '53';
    function q(n) { return root.querySelector('[data-r="' + n + '"]'); }
    function key() {
      var p = +sp.value, qq = +sq.value;
      if (p === qq) return null;
      var n = p * qq, phi = (p - 1) * (qq - 1), e = EXPS.filter(function (x) { return gcd(x, phi) === 1; })[0];
      return { p: p, q: qq, n: n, phi: phi, e: e, d: modinv(e, phi) };
    }
    function show() {
      var k = key(), o = q('out');
      q('ao').textContent = '';
      if (!k) { o.textContent = 'Pick two different primes.'; root.removeAttribute('data-n'); return; }
      var m = Math.max(2, Math.min(k.n - 1, Math.floor(+im.value) || 2)), c = powmod(m, k.e, k.n), back = powmod(c, k.d, k.n);
      o.innerHTML = 'Public: n = ' + k.p + ' &times; ' + k.q + ' = <b>' + k.n + '</b>, e = <b>' + k.e + '</b>. Secret: &phi; = ' + (k.p - 1) + ' &times; ' + (k.q - 1) + ' = ' + k.phi + ', d = <b>' + k.d + '</b> (because ' + k.e + ' &times; ' + k.d + ' = ' + (k.e * k.d) + ' = ' + ((k.e * k.d - 1) / k.phi) + ' &times; ' + k.phi + ' + 1). ' +
        'Encrypt: ' + m + '<sup>' + k.e + '</sup> mod ' + k.n + ' = <b>' + c + '</b>. Decrypt: ' + c + '<sup>' + k.d + '</sup> mod ' + k.n + ' = <b>' + back + '</b>' + (back === m ? '.' : ' (this should never differ).');
      root.setAttribute('data-n', k.n); root.setAttribute('data-e', k.e); root.setAttribute('data-d', k.d); root.setAttribute('data-c', c); root.setAttribute('data-back', back);
    }
    sp.addEventListener('change', show); sq.addEventListener('change', show); im.addEventListener('input', show);
    q('atk').addEventListener('click', function () {
      var k = key(); if (!k) return;
      var f, steps = 0;
      for (f = 2; f * f <= k.n; f++) { steps++; if (k.n % f === 0) break; }
      var other = k.n / f, phi2 = (f - 1) * (other - 1), e = EXPS.filter(function (x) { return gcd(x, phi2) === 1; })[0], d2 = modinv(e, phi2);
      q('ao').innerHTML = 'Dividing n = ' + k.n + ' by 2, 3, 4, ... the attacker finds <b>' + f + '</b> after ' + steps + ' step' + (steps === 1 ? '' : 's') + ', so q = ' + other + ', &phi; = ' + phi2 + ', and the private exponent comes out as d = <b>' + d2 + '</b>, the same as yours. ' +
        'A 2,048-bit n has 617 decimal digits; this search would never finish, and the best classical methods are far faster than trial division but still out of reach. Shor’s algorithm is not.';
      root.setAttribute('data-atk-factor', f); root.setAttribute('data-atk-steps', steps); root.setAttribute('data-atk-d', d2);
    });
    show();
  }

  function mountLamport(root) {
    root.className = 'ct ct-lamport';
    root.innerHTML =
      '<p class="ct-note">A toy with 8-bit digests (the first 8 bits of SHA-256) so that the weakness shows. A real scheme uses all 256 bits.</p>' +
      '<div class="ct-row"><label for="ctl-1">First message</label><input id="ctl-1" type="text" value="pay Alice 5" autocomplete="off" spellcheck="false"></div>' +
      '<div class="ct-row"><label for="ctl-2">Second message</label><input id="ctl-2" type="text" value="pay Bob 7" autocomplete="off" spellcheck="false"></div>' +
      '<div class="ct-act"><button type="button" class="preset" data-r="s1">Sign the first message</button> <button type="button" class="preset" data-r="s2" disabled>Sign the second with the same key</button> <button type="button" class="preset" data-r="forge" disabled>Forge a third message</button> <button type="button" class="preset" data-r="reset">New key</button></div>' +
      '<p class="ct-out" role="status" aria-live="polite" data-r="out"></p><div class="ct-keys" data-r="keys"></div>';
    var sk = null, pk = null, revealed = null, sigs = [];
    function q(n) { return root.querySelector('[data-r="' + n + '"]'); }
    function newKey() {
      sk = []; revealed = []; sigs = [];
      var i, j, ps = [];
      for (i = 0; i < 8; i++) { sk.push([W.crypto.getRandomValues(new Uint8Array(32)), W.crypto.getRandomValues(new Uint8Array(32))]); revealed.push([false, false]); }
      for (i = 0; i < 8; i++) for (j = 0; j < 2; j++) ps.push(sha256(sk[i][j]));
      return Promise.all(ps).then(function (h) { pk = []; for (var k = 0; k < 8; k++) pk.push([h[2 * k], h[2 * k + 1]]); render(); });
    }
    function digestBits(text) { return sha256(enc.encode(text)).then(function (d) { return bitsOf(d.slice(0, 1)); }); }
    function verify(text, sig) { return digestBits(text).then(function (bits) { return Promise.all(sig.map(function (s, i) { return sha256(s).then(function (h) { return hex(h) === hex(pk[i][bits[i]]); }); })).then(function (r) { return r.every(Boolean); }); }); }
    function render() {
      var n = 0, i, j, html = '<table class="ct-tab"><thead><tr><th scope="col">Position</th><th scope="col">Secret for 0</th><th scope="col">Secret for 1</th></tr></thead><tbody>';
      for (i = 0; i < 8; i++) { html += '<tr><th scope="row">' + (i + 1) + '</th>'; for (j = 0; j < 2; j++) { if (revealed[i][j]) n++; html += '<td class="' + (revealed[i][j] ? 'rev' : '') + '">' + (revealed[i][j] ? '<code>' + hex(sk[i][j]).slice(0, 10) + '&hellip;</code> revealed' : 'hidden') + '</td>'; } html += '</tr>'; }
      html += '</tbody></table>';
      q('keys').innerHTML = html;
      root.setAttribute('data-revealed', n);
      q('s1').disabled = sigs.length > 0; q('s2').disabled = sigs.length !== 1; q('forge').disabled = sigs.length !== 2;
    }
    function signWith(inputId, label) {
      var text = root.querySelector(inputId).value;
      return digestBits(text).then(function (bits) {
        var sig = bits.map(function (b, i) { revealed[i][b] = true; return sk[i][b]; });
        sigs.push({ text: text, bits: bits, sig: sig });
        return verify(text, sig).then(function (ok) {
          var n = 0; revealed.forEach(function (r) { n += (r[0] ? 1 : 0) + (r[1] ? 1 : 0); });
          q('out').innerHTML = label + ' signed. Digest bits: <b>' + bits.join('') + '</b>. The verifier hashes the 8 revealed secrets and compares them with the public key: ' + (ok ? '<b>valid</b>' : 'INVALID') + '. Secrets revealed so far: <b>' + n + ' of 16</b>.';
          render();
        });
      });
    }
    q('s1').addEventListener('click', function () { signWith('#ctl-1', 'The first message'); });
    q('s2').addEventListener('click', function () { signWith('#ctl-2', 'The second message'); });
    q('reset').addEventListener('click', function () { q('out').textContent = 'A fresh key: 16 new secrets, none revealed.'; newKey(); });
    q('forge').addEventListener('click', function () {
      var btn = q('forge'); btn.disabled = true; q('out').textContent = 'Searching for a message whose digest is covered by what has been revealed...';
      var n = 1;
      (function step() {
        var text = 'pay Mallory ' + n;
        digestBits(text).then(function (bits) {
          var covered = bits.every(function (b, i) { return revealed[i][b]; });
          if (covered) {
            var forged = bits.map(function (b, i) { return sk[i][b]; });
            verify(text, forged).then(function (ok) {
              q('out').innerHTML = 'Forged: <b>&ldquo;' + esc(text) + '&rdquo;</b> has digest bits <b>' + bits.join('') + '</b>, and every secret it needs was already revealed by the two honest signatures. The verifier says: ' + (ok ? '<b>valid</b>' : 'invalid') + '. That took ' + n + ' tries. This is why a Lamport key is one-time.';
              root.setAttribute('data-forged', ok ? text : ''); root.setAttribute('data-forge-tries', n);
            });
          } else if (n < 20000) { n++; (n % 50 === 0) ? setTimeout(step, 0) : step(); }
          else { q('out').textContent = 'No forgery found in 20,000 tries with this pair: the two digests agree in too many places. Try different messages.'; }
        });
      })();
    });
    newKey();
  }

  var MOUNT = { hash: mountHash, dh: mountDH, rsa: mountRSA, lamport: mountLamport };
  function boot() {
    [].slice.call(D.querySelectorAll('[data-ct]')).forEach(function (r) { var f = MOUNT[r.getAttribute('data-ct')]; if (f && !r.hasAttribute('data-ct-ready')) { r.setAttribute('data-ct-ready', ''); try { f(r); } catch (e) { r.textContent = 'This toy could not start in this browser.'; } } });
  }
  W.SymbiQ = W.SymbiQ || {};
  W.SymbiQ.cryptoTools = { mount: boot, powmod: powmod, modinv: modinv, DH_SETS: DH_SETS, PRIMES: PRIMES, EXPS: EXPS };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
