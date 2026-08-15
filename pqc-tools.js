/* SymbiQ — THE PQC TOOLS (pqc.html only)
 * =============================================================================
 * Four tools that only ever appear together, on one page, in this order:
 * discover what you have (the Inventory) → position it against the wire cost
 * (the Size Cliff) → sequence a migration (the Sequencer) → price the wait
 * against a real survey (the Odds). Merged from four separate files into one
 * on 2026-08-07 — they were never independently reusable, so four files was
 * fragmentation, not modularity. Nothing below was rewritten; each section
 * keeps its own IIFE exactly as it shipped, so this is a concatenation with
 * the file-level banners tightened, not a rewrite. Diff the git history
 * (`cbom.js`/`estate.js`/`odds.js`/`sizecliff.mjs`, pre-2026-08-07) against
 * any section here if you need to confirm that.
 * ========================================================================== */

import { ml_kem768, ml_kem1024 } from './vendor/pq/ml-kem.mjs';
import { ml_dsa44, ml_dsa65, ml_dsa87 } from './vendor/pq/ml-dsa.mjs';
import { slh_dsa_sha2_128s } from './vendor/pq/slh-dsa.mjs';

/* ── 1 · THE SIZE CLIFF ──────────────────────────────────────────────────
 * What a post-quantum TLS handshake actually costs on the wire.
 *
 * THE RULE THIS WIDGET IS BUILT ON: every cryptographic byte on screen is the
 * .length of a key, ciphertext or signature that THIS BROWSER JUST GENERATED.
 * Nothing is copied from a table. That is not a stylistic preference — it is
 * the only defence against the failure this project keeps repeating, where a
 * correct formula is fed an input nobody checked. It has already paid for
 * itself: the published secondary sources say an ML-DSA-65 signature is 3,293
 * bytes. Measured, it is 3,309. FIPS 204 agrees with the measurement.
 *
 * WHAT IS MEASURED AND WHAT IS MODELLED — the distinction is load-bearing and
 * is surfaced per row in the UI, never averaged away:
 *   MEASURED  keys, ciphertexts, signatures. Exact, from real operations.
 *   MODELLED  TLS record/handshake framing and X.509 certificate structure.
 *             Real handshakes vary with client, server and extension set.
 *
 * So the ABSOLUTE totals here are a model. The DELTA between a classical and a
 * post-quantum choice is measured exactly, because the framing is identical on
 * both sides of the comparison and cancels. The delta is what the cliff is.
 *
 * SECURITY: the vendored @noble/post-quantum tree is NOT independently audited
 * and has no side-channel protection. This is a measuring instrument. It must
 * never be used to protect a real secret, and it never handles one here — every
 * key generated is discarded on the next render.
 * ────────────────────────────────────────────────────────────────────── */
(function () {
  window.SymbiQ = window.SymbiQ || {};

/* --- the wire limits we are measuring against ---------------------------- */
/* A 1500-byte Ethernet MTU less 20 bytes IPv4 and 20 bytes TCP leaves 1460
 * bytes of payload. A ClientHello past that is split across two packets — the
 * boundary a generation of middleboxes silently assumed would never be crossed.
 * initcwnd 10 is the Linux default since kernel 2.6.39 (RFC 6928): ten segments
 * before the server must wait for an ACK. A server flight past it costs a
 * round trip on EVERY new connection, which is the expensive kind of cost. */
const MSS = 1460;
const INITCWND = 10 * MSS;   // 14,600 bytes

/* --- modelled framing ----------------------------------------------------
 * Stated, not hidden. A Chrome ClientHello with no PQC lands around 300–500
 * bytes depending on extensions; we model the non-key_share part as a single
 * visible constant so the reader can see exactly how much of the total is
 * assumption rather than measurement. */
const M = {
  chFraming: 330,   // ClientHello minus the key_share entry
  shFraming: 90,    // ServerHello minus its key_share entry
  encExt: 30,       // EncryptedExtensions
  certBase: 400,    // one X.509 cert minus its public key and issuer signature
  certMsgHdr: 13,   // Certificate message framing + list headers
  cvHdr: 13,        // CertificateVerify framing + algorithm id + length
  finished: 41,     // Finished
  sct: 120,         // one SCT, still ECDSA-signed in practice
};

/* --- helpers -------------------------------------------------------------- */
const enc = new TextEncoder().encode('SymbiQ size cliff');

async function webcryptoLen(algo, usages, want) {
  try {
    const kp = await crypto.subtle.generateKey(algo, true, usages);
    const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
    return { n: raw.byteLength, measured: true };
  } catch (e) {
    return { n: want, measured: false };   // labelled honestly in the UI
  }
}

/* Sign something real, so a classical signature length is measured on exactly
 * the same footing as a post-quantum one. WebCrypto returns ECDSA in the raw
 * P1363 form; X.509 carries it DER-encoded, and that encoding overhead belongs
 * to the certificate framing model rather than to the signature itself.
 * Measuring the public key and then labelling the SIGNATURE row from that flag
 * was the original bug here — the tag has to name the quantity it describes. */
async function webcryptoSigLen(algo, signAlgo, want) {
  try {
    const kp = await crypto.subtle.generateKey(algo, true, ['sign', 'verify']);
    const s = await crypto.subtle.sign(signAlgo, kp.privateKey, enc);
    return { n: s.byteLength, measured: true };
  } catch (e) {
    return { n: want, measured: false };
  }
}

/* --- key exchange options -------------------------------------------------
 * The client sends a key share; the server answers with one. For ML-KEM the
 * server's share is the CIPHERTEXT, not a public key — a detail that decides
 * which direction actually grows, and one most size comparisons get wrong. */
const KEX = {
  x25519: {
    label: 'X25519', note: 'classical', tier: 'classical',
    async sizes() {
      const c = await webcryptoLen({ name: 'X25519' }, ['deriveBits'], 32);
      return { client: c.n, server: c.n, measured: c.measured, pq: 0 };
    },
  },
  x25519mlkem768: {
    label: 'X25519MLKEM768', note: 'hybrid — what Chrome ships today', tier: 'hybrid',
    async sizes() {
      const c = await webcryptoLen({ name: 'X25519' }, ['deriveBits'], 32);
      const k = ml_kem768.keygen();
      const { cipherText } = ml_kem768.encapsulate(k.publicKey);
      // the hybrid share is a concatenation — shown as arithmetic, not hidden
      return {
        client: k.publicKey.length + c.n, server: cipherText.length + c.n,
        measured: c.measured, pq: k.publicKey.length,
        parts: `${k.publicKey.length} + ${c.n}`,
      };
    },
  },
  mlkem768: {
    label: 'ML-KEM-768', note: 'post-quantum only', tier: 'pq',
    async sizes() {
      const k = ml_kem768.keygen();
      const { cipherText } = ml_kem768.encapsulate(k.publicKey);
      return { client: k.publicKey.length, server: cipherText.length, measured: true, pq: k.publicKey.length };
    },
  },
  mlkem1024: {
    label: 'ML-KEM-1024', note: 'post-quantum, highest level', tier: 'pq',
    async sizes() {
      const k = ml_kem1024.keygen();
      const { cipherText } = ml_kem1024.encapsulate(k.publicKey);
      return { client: k.publicKey.length, server: cipherText.length, measured: true, pq: k.publicKey.length };
    },
  },
};

/* --- signature options ----------------------------------------------------
 * THE TRAP LIVES HERE. SLH-DSA has a 32-byte public key — smaller than
 * ML-DSA-65's 1,952 and the same as Ed25519's — and a 7,856-byte signature.
 * Choosing a signature scheme by key size gives exactly the wrong answer, and
 * a certificate chain carries far more signatures than public keys. */
const SIG = {
  ed25519: {
    label: 'Ed25519', note: 'classical', tier: 'classical',
    async sizes() {
      const k = await webcryptoLen({ name: 'Ed25519' }, ['sign', 'verify'], 32);
      const s = await webcryptoSigLen({ name: 'Ed25519' }, { name: 'Ed25519' }, 64);
      return { pk: k.n, sig: s.n, pkMeasured: k.measured, sigMeasured: s.measured };
    },
  },
  p256: {
    label: 'ECDSA P-256', note: 'classical, the web default', tier: 'classical',
    async sizes() {
      const a = { name: 'ECDSA', namedCurve: 'P-256' };
      const k = await webcryptoLen(a, ['sign', 'verify'], 65);
      const s = await webcryptoSigLen(a, { name: 'ECDSA', hash: 'SHA-256' }, 64);
      return { pk: k.n, sig: s.n, pkMeasured: k.measured, sigMeasured: s.measured };
    },
  },
  mldsa44: { label: 'ML-DSA-44', note: 'post-quantum', tier: 'pq', async sizes() { return dsa(ml_dsa44); } },
  mldsa65: { label: 'ML-DSA-65', note: 'post-quantum, the likely default', tier: 'pq', async sizes() { return dsa(ml_dsa65); } },
  mldsa87: { label: 'ML-DSA-87', note: 'post-quantum, highest level', tier: 'pq', async sizes() { return dsa(ml_dsa87); } },
  slhdsa: {
    label: 'SLH-DSA-128s', note: 'hash-based — tiny key, enormous signature', tier: 'pq',
    async sizes() { return dsa(slh_dsa_sha2_128s); },
  },
};

function dsa(alg) {
  const k = alg.keygen();
  const s = alg.sign(enc, k.secretKey);
  return { pk: k.publicKey.length, sig: s.length, pkMeasured: true, sigMeasured: true };
}

/* --- the computation ------------------------------------------------------
 * A chain of depth d carries d certificates. Each is signed by its issuer, so
 * each contributes one public key and one issuer signature. CertificateVerify
 * adds one more signature — the handshake's proof of possession. */
async function compute(opts) {
  const kex = KEX[opts.kex], sig = SIG[opts.sig];
  const k = await kex.sizes(), s = await sig.sizes();
  const depth = opts.depth, scts = opts.scts ? 2 : 0;

  const clientHello = M.chFraming + 4 + k.client;
  const certBytes = depth * (M.certBase + s.pk + s.sig);
  const sctBytes = scts * M.sct;
  const serverFlight =
    M.shFraming + 4 + k.server + M.encExt +
    M.certMsgHdr + certBytes + sctBytes +
    M.cvHdr + s.sig + M.finished;

  const chPackets = Math.ceil(clientHello / MSS);
  const sfPackets = Math.ceil(serverFlight / MSS);
  const extraRtt = serverFlight > INITCWND ? 1 : 0;

  return {
    kex, sig, k, s, depth, scts,
    clientHello, serverFlight, certBytes, sctBytes,
    chPackets, sfPackets, extraRtt,
    chOverMtu: clientHello > MSS,
    /* measured vs modelled, so the split is never averaged away */
    measuredBytes: k.client + k.server + depth * (s.pk + s.sig) + s.sig,
    modelledBytes: M.chFraming + 4 + M.shFraming + 4 + M.encExt +
                   M.certMsgHdr + depth * M.certBase + sctBytes + M.cvHdr + M.finished,
  };
}

const OPTIONS = { KEX, SIG, MSS, INITCWND, MODEL: M };

/* =============================================================================
 * THE UI. Mounted the same way games.js mounts an engine, so this can later sit
 * inside a mission frame without being rewritten.
 * ========================================================================== */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (x) => x.toLocaleString('en-GB');

function bar(bytes, limit, longLabel, shortLabel, segs) {
  const scale = Math.max(limit * 1.15, bytes * 1.02);
  const over = bytes > limit;
  const pct = (v) => (v / scale) * 100;
  const at = pct(limit);
  /* The limit caption sits beside its marker line. Past halfway there is not
   * enough room to its right, so it flips to the other side — otherwise it
   * runs off the bar and takes the whole page sideways with it, which is
   * exactly what it did at 375px the first time. */
  const flip = at > 50;
  const fill = segs.map((s) =>
    `<span class="sc-seg ${s.cls}" style="width:${pct(s.v).toFixed(3)}%" title="${esc(s.label)}: ${n(s.v)} bytes"></span>`
  ).join('');
  return `<div class="sc-bar ${over ? 'over' : ''}">
      <div class="sc-fill">${fill}</div>
      <div class="sc-limit ${flip ? 'flip' : ''}" style="left:${at.toFixed(3)}%"><span
        ><b class="sc-lg">${esc(longLabel)}</b><b class="sc-sm">${esc(shortLabel)}</b></span></div>
    </div>`;
}

function row(label, value, kind) {
  return `<div class="sc-row"><span class="sc-rl">${esc(label)}</span>
    <span class="sc-rv">${n(value)}</span>
    <span class="sc-tag ${kind}">${kind === 'meas' ? 'measured' : 'modelled'}</span></div>`;
}

function mount(root, opts) {
  const state = { kex: 'x25519', sig: 'p256', depth: 2, scts: true, ...(opts || {}) };

  const chips = (group, map, key) => Object.keys(map).map((id) =>
    `<button type="button" class="preset sc-opt ${state[key] === id ? 'on' : ''}" data-g="${group}" data-v="${id}">
       ${esc(map[id].label)}<em>${esc(map[id].note)}</em></button>`).join('');

  root.innerHTML = `
    <div class="sc">
      <div class="sc-ctl">
        <p class="sc-lab">Key exchange</p><div class="sc-opts">${chips('kex', KEX, 'kex')}</div>
        <p class="sc-lab">Certificate signature</p><div class="sc-opts">${chips('sig', SIG, 'sig')}</div>
        <p class="sc-lab">Chain depth &amp; transparency</p>
        <div class="sc-opts">
          <button type="button" class="preset sc-opt" data-g="depth" data-v="1">1 cert<em>leaf only</em></button>
          <button type="button" class="preset sc-opt" data-g="depth" data-v="2">2 certs<em>leaf + intermediate</em></button>
          <button type="button" class="preset sc-opt" data-g="depth" data-v="3">3 certs<em>+ cross-sign</em></button>
          <button type="button" class="preset sc-opt" data-g="scts" data-v="t">2 SCTs<em>certificate transparency</em></button>
        </div>
      </div>
      <div class="sc-out" aria-live="polite"><p class="sc-wait">Generating real keys…</p></div>
    </div>`;

  const out = root.querySelector('.sc-out');

  async function render() {
    root.querySelectorAll('.sc-opt').forEach((b) => {
      const g = b.dataset.g, v = b.dataset.v;
      const on = g === 'depth' ? state.depth === +v : g === 'scts' ? state.scts : state[g] === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    const r = await compute(state);
    const cls = (t) => (t === 'pq' ? 'pq' : t === 'hybrid' ? 'hy' : 'cl');

    // ClientHello: framing + the client's key share
    const chSegs = [
      { v: M.chFraming + 4, label: 'TLS framing', cls: 'fr' },
      { v: r.k.client, label: 'client key share', cls: cls(r.kex.tier) },
    ];
    // Server flight: framing, server key share, certificates, CertificateVerify
    const sfSegs = [
      { v: M.shFraming + 4 + M.encExt + M.certMsgHdr + r.depth * M.certBase + r.sctBytes + M.cvHdr + M.finished, label: 'TLS + X.509 framing', cls: 'fr' },
      { v: r.k.server, label: 'server key share', cls: cls(r.kex.tier) },
      { v: r.depth * r.s.pk, label: 'certificate public keys', cls: cls(r.sig.tier) },
      { v: r.depth * r.s.sig, label: 'issuer signatures', cls: cls(r.sig.tier) },
      { v: r.s.sig, label: 'CertificateVerify', cls: cls(r.sig.tier) },
    ];

    const verdict = r.extraRtt
      ? `<div class="verdict bad">The server flight needs ${r.sfPackets} packets. The congestion window allows 10.
         <b>Every new connection pays an extra round trip</b> before the page starts loading.</div>`
      : r.chOverMtu
      ? `<div class="verdict split">The ClientHello no longer fits one packet.
         Chrome and Firefox split it across two on purpose — a middlebox that cannot cope drops the connection.</div>`
      : `<div class="verdict good">Everything fits. ClientHello in one packet, server flight inside the initial congestion window.</div>`;

    out.innerHTML = `
      ${verdict}
      <h4 class="sc-h">ClientHello <span>${n(r.clientHello)} bytes</span></h4>
      ${bar(r.clientHello, MSS, '1,460 B — one packet', '1,460 B', chSegs)}
      <h4 class="sc-h">Server flight <span>${n(r.serverFlight)} bytes</span></h4>
      ${bar(r.serverFlight, INITCWND, '14,600 B — initial congestion window', '14,600 B', sfSegs)}
      <div class="sc-grid">
        ${row('Client key share', r.k.client, r.k.measured === false ? 'mod' : 'meas')}
        ${row('Server key share' + (r.kex.tier === 'classical' ? '' : ' (ciphertext)'), r.k.server, r.k.measured === false ? 'mod' : 'meas')}
        ${row('Certificate public key', r.s.pk, r.s.pkMeasured ? 'meas' : 'mod')}
        ${row('One signature', r.s.sig, r.s.sigMeasured ? 'meas' : 'mod')}
        ${row('× ' + r.depth + ' certificates + CertificateVerify', r.depth * (r.s.pk + r.s.sig) + r.s.sig,
              r.s.pkMeasured && r.s.sigMeasured ? 'meas' : 'mod')}
        ${row('TLS and X.509 framing', r.modelledBytes, 'mod')}
      </div>
      <p class="sc-split"><b>${n(r.measuredBytes)} bytes measured</b> from keys this browser just generated ·
         ${n(r.modelledBytes)} bytes modelled framing.
         ${r.kex.parts ? `The hybrid share is a concatenation: <b>${r.kex.parts}</b> bytes.` : ''}</p>`;
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('.sc-opt'); if (!b) return;
    const g = b.dataset.g, v = b.dataset.v;
    if (g === 'depth') state.depth = +v;
    else if (g === 'scts') state.scts = !state.scts;
    else state[g] = v;
    render();
  });

  render();
  return { state, rerender: render };
}


  SymbiQ.sizecliff = { compute: compute, OPTIONS: OPTIONS, mount: mount };
})();

/* ── 2 · THE INVENTORY ───────────────────────────────────────────────────
 * Paste the cryptographic artefacts you already have. This reads them — really
 * reads them, byte by byte, out of the DER — and tells you what you are holding,
 * what breaks, and in what order. Then it writes a CycloneDX 1.6 cryptographic
 * bill of materials, which is the artefact CISA has to define the minimum
 * elements of by roughly 20 March 2027 (Executive Order 14412, 270 days).
 *
 * WHY THIS PARSES INSTEAD OF ASKING. The estate model one section down is only
 * as good as what you type into it, and its own honest-limits list says so. The
 * fix is not a longer form. It is to read the objects you already possess: a
 * certificate states its algorithms, its key size, its validity and its issuer
 * in bytes that cannot be misremembered. Everything in the table below is read
 * out of the artefact. Nothing is entered, and nothing is looked up in a table
 * of expected values — the failure mode this project keeps catching is a correct
 * formula fed a wrong constant, and a parser that measures cannot have one.
 *
 * THE PARSE IS CHECKED AGAINST A SECOND IMPLEMENTATION. For every key the
 * browser's own WebCrypto can import, we import it and read the algorithm and
 * size back from the browser rather than from us. When the two agree the row is
 * tagged CONFIRMED. When WebCrypto has no algorithm for it — ML-DSA, SLH-DSA,
 * and Ed25519 on older browsers — the row is tagged PARSED, meaning our decoder
 * alone read it. The tag names exactly which quantity was double-checked, which
 * is the discipline the rest of this site is held to.
 *
 * THE FINDING THAT IS WORTH THE WHOLE TOOL. A certificate contains TWO
 * algorithms, not one: the key it carries, and the algorithm its issuer used to
 * sign it. They are usually different, they usually belong to different people,
 * and an inventory that records one field per certificate silently loses half
 * the estate. Rotating a leaf to ML-DSA changes nothing while the CA above it
 * still signs with RSA — and if that CA is public, the migration is not yours
 * to schedule at all.
 *
 * AND THE ONE IT WILL NOT LET YOU MISS. Your certificates do not contain your
 * harvest-now-decrypt-later exposure. In TLS 1.3 the certificate key signs; it
 * never encrypts. The key exchange that actually protects the traffic is an
 * ephemeral ECDHE or X25519 share that appears in no certificate and no
 * inventory. So a CBOM built from certificates alone systematically under-reads
 * the retroactive risk, and this tool says so rather than quietly scoring you.
 *
 * NOTHING LEAVES YOUR BROWSER. There is no server to send it to. Paste a real
 * certificate if you like — they are public objects — but the point is that it
 * would not matter either way.
 * ────────────────────────────────────────────────────────────────────── */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  /* ========================================================================
   * 1. DER / ASN.1
   * A distinguished-encoding-rules reader. Tag, length, value, recursively.
   * Deliberately small: X.509 uses a narrow slice of ASN.1, and a parser that
   * only accepts what a certificate may legally contain is a parser that fails
   * loudly on anything else instead of guessing.
   * ==================================================================== */

  function readTLV(b, off) {
    if (off + 2 > b.length) throw new Error('truncated');
    var tag = b[off], p = off + 1;
    if ((tag & 0x1f) === 0x1f) {              // high-tag-number form
      while (p < b.length && (b[p] & 0x80)) p++;
      p++;
    }
    var len = b[p++];
    if (len & 0x80) {
      var n = len & 0x7f;
      if (n === 0) throw new Error('indefinite length is not DER');
      if (n > 4) throw new Error('length too large');
      len = 0;
      for (var i = 0; i < n; i++) len = (len * 256) + b[p++];
    }
    if (p + len > b.length) throw new Error('length runs past the end');
    return { tag: tag, num: tag & 0x1f, cons: !!(tag & 0x20),
             hStart: off, vStart: p, vEnd: p + len, end: p + len, len: len };
  }

  function kids(b, t) {
    var out = [], p = t.vStart;
    while (p < t.vEnd) { var c = readTLV(b, p); out.push(c); p = c.end; }
    return out;
  }

  /* First arc packs two numbers: value = 40*X + Y, X in {0,1,2}. When the value
   * is 80 or more, X is 2 and Y is value-80 — the case every naive decoder gets
   * wrong, and the case every NIST OID (2.16.840.1.101...) lands in. */
  function oid(b, t) {
    var s = [], n = 0, first = true;
    for (var i = t.vStart; i < t.vEnd; i++) {
      n = n * 128 + (b[i] & 0x7f);
      if (!(b[i] & 0x80)) {
        if (first) {
          if (n >= 80) { s.push(2, n - 80); } else { s.push(Math.floor(n / 40), n % 40); }
          first = false;
        } else s.push(n);
        n = 0;
      }
    }
    return s.join('.');
  }

  function str(b, t) {
    var s = '';
    for (var i = t.vStart; i < t.vEnd; i++) s += String.fromCharCode(b[i]);
    // UTF8String is common in modern certificates; decode it properly.
    if (t.num === 12) { try { return decodeURIComponent(escape(s)); } catch (e) { return s; } }
    return s;
  }

  /* UTCTime is two-digit-year, and the rule is fixed by RFC 5280: 00-49 means
   * 20xx, 50-99 means 19xx. GeneralizedTime is four-digit and used past 2049. */
  function time(b, t) {
    var s = str(b, t).replace(/Z$/, ''), y;
    if (t.num === 23) { y = +s.slice(0, 2); y = y < 50 ? 2000 + y : 1900 + y; s = s.slice(2); }
    else { y = +s.slice(0, 4); s = s.slice(4); }
    return new Date(Date.UTC(y, +s.slice(0, 2) - 1, +s.slice(2, 4),
                             +s.slice(4, 6) || 0, +s.slice(6, 8) || 0, +s.slice(8, 10) || 0));
  }

  /* An RDNSequence rendered the way openssl renders it, so a reader can compare
   * this table against `openssl x509 -noout -text` line for line. */
  var ATTR = { '2.5.4.3': 'CN', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.6': 'C',
               '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.5': 'serialNumber',
               '1.2.840.113549.1.9.1': 'emailAddress' };
  function name(b, t) {
    var parts = [];
    kids(b, t).forEach(function (rdn) {
      kids(b, rdn).forEach(function (av) {
        var k = kids(b, av);
        if (k.length < 2) return;
        var o = oid(b, k[0]);
        parts.push((ATTR[o] || o) + '=' + str(b, k[1]));
      });
    });
    return parts.join(', ');
  }

  function bitLength(b, from, to) {           // of a big-endian integer
    while (from < to && b[from] === 0) from++;     // strip the DER sign byte
    if (from >= to) return 0;
    var top = b[from], bits = 0;
    while (top) { bits++; top >>= 1; }
    return bits + (to - from - 1) * 8;
  }

  /* ========================================================================
   * 2. What the OIDs mean
   * Every identifier here was read out of `openssl list` on OpenSSL 3.5.6
   * rather than transcribed from a blog post, and the post-quantum ones are the
   * NIST CSOR arcs that FIPS 203/204/205 registered.
   * ==================================================================== */

  var SIG = {
    '1.2.840.113549.1.1.5':  { n: 'sha1WithRSAEncryption',   f: 'RSA',    hash: 'SHA-1' },
    '1.2.840.113549.1.1.11': { n: 'sha256WithRSAEncryption', f: 'RSA',    hash: 'SHA-256' },
    '1.2.840.113549.1.1.12': { n: 'sha384WithRSAEncryption', f: 'RSA',    hash: 'SHA-384' },
    '1.2.840.113549.1.1.13': { n: 'sha512WithRSAEncryption', f: 'RSA',    hash: 'SHA-512' },
    '1.2.840.113549.1.1.10': { n: 'RSASSA-PSS',              f: 'RSA',    hash: '' },
    '1.2.840.10045.4.1':     { n: 'ecdsa-with-SHA1',         f: 'ECDSA',  hash: 'SHA-1' },
    '1.2.840.10045.4.3.2':   { n: 'ecdsa-with-SHA256',       f: 'ECDSA',  hash: 'SHA-256' },
    '1.2.840.10045.4.3.3':   { n: 'ecdsa-with-SHA384',       f: 'ECDSA',  hash: 'SHA-384' },
    '1.2.840.10045.4.3.4':   { n: 'ecdsa-with-SHA512',       f: 'ECDSA',  hash: 'SHA-512' },
    '1.3.101.112':           { n: 'Ed25519',                 f: 'EdDSA',  hash: '' },
    '1.3.101.113':           { n: 'Ed448',                   f: 'EdDSA',  hash: '' },
    '1.2.840.10040.4.3':     { n: 'dsa-with-SHA1',           f: 'DSA',    hash: 'SHA-1' },
    '2.16.840.1.101.3.4.3.17': { n: 'ML-DSA-44', f: 'ML-DSA', pq: true },
    '2.16.840.1.101.3.4.3.18': { n: 'ML-DSA-65', f: 'ML-DSA', pq: true },
    '2.16.840.1.101.3.4.3.19': { n: 'ML-DSA-87', f: 'ML-DSA', pq: true }
  };
  // the twelve SLH-DSA parameter sets share one arc, so they are generated
  ['sha2-128s', 'sha2-128f', 'sha2-192s', 'sha2-192f', 'sha2-256s', 'sha2-256f',
   'shake-128s', 'shake-128f', 'shake-192s', 'shake-192f', 'shake-256s', 'shake-256f']
    .forEach(function (p, i) {
      SIG['2.16.840.1.101.3.4.3.' + (20 + i)] =
        { n: 'SLH-DSA-' + p.toUpperCase().replace('SHA2', 'SHA2').replace('SHAKE', 'SHAKE'),
          f: 'SLH-DSA', pq: true, param: p };
    });

  var KEY = {
    '1.2.840.113549.1.1.1': { n: 'rsaEncryption',  f: 'RSA' },
    '1.2.840.10045.2.1':    { n: 'id-ecPublicKey', f: 'EC' },
    /* bits here is the PUBLIC KEY SIZE, which is what the CBOM's `size` field
     * asks for -- 32 bytes for Ed25519, 57 for Ed448. It is not the group order
     * bit length (255) and not the security level (128); those are three
     * different numbers that get quoted interchangeably. */
    '1.3.101.112':          { n: 'Ed25519',        f: 'EdDSA', bits: 256 },
    '1.3.101.113':          { n: 'Ed448',          f: 'EdDSA', bits: 456 },
    '1.3.101.110':          { n: 'X25519',         f: 'XDH',   bits: 256 },
    '1.3.101.111':          { n: 'X448',           f: 'XDH',   bits: 448 },
    '1.2.840.10040.4.1':    { n: 'id-dsa',         f: 'DSA' },
    '1.2.840.113549.1.3.1': { n: 'dhKeyAgreement', f: 'DH' },
    '2.16.840.1.101.3.4.4.1': { n: 'ML-KEM-512',  f: 'ML-KEM', pq: true },
    '2.16.840.1.101.3.4.4.2': { n: 'ML-KEM-768',  f: 'ML-KEM', pq: true },
    '2.16.840.1.101.3.4.4.3': { n: 'ML-KEM-1024', f: 'ML-KEM', pq: true }
  };
  ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'].forEach(function (n, i) {
    KEY['2.16.840.1.101.3.4.3.' + (17 + i)] = { n: n, f: 'ML-DSA', pq: true };
  });
  Object.keys(SIG).forEach(function (o) {
    if (SIG[o].f === 'SLH-DSA') KEY[o] = { n: SIG[o].n, f: 'SLH-DSA', pq: true };
  });

  var CURVE = {
    '1.2.840.10045.3.1.7': { n: 'P-256', bits: 256 },
    '1.3.132.0.34':        { n: 'P-384', bits: 384 },
    '1.3.132.0.35':        { n: 'P-521', bits: 521 },
    '1.3.132.0.10':        { n: 'secp256k1', bits: 256 },
    '1.3.132.0.33':        { n: 'P-224', bits: 224 }
  };

  /* ========================================================================
   * 3. The certificate
   * ==================================================================== */

  function parseCert(b) {
    var root = readTLV(b, 0);
    if (!root.cons || root.num !== 16) throw new Error('not a certificate');
    var top = kids(b, root);
    if (top.length < 3) throw new Error('not a certificate');
    var tbs = top[0], sigAlgT = top[1];
    var t = kids(b, tbs), i = 0, out = { version: 1 };

    if (t[0] && (t[0].tag & 0xa0) === 0xa0 && t[0].num === 0) {   // [0] EXPLICIT version
      out.version = kids(b, t[0])[0] ? bigInt(b, kids(b, t[0])[0]) + 1 : 1;
      i = 1;
    }
    out.serial    = hex(b, t[i++]);
    var innerSig  = t[i++];                       // must equal the outer one
    out.issuer    = name(b, t[i++]);
    var validity  = kids(b, t[i++]);
    out.notBefore = time(b, validity[0]);
    out.notAfter  = time(b, validity[1]);
    out.subject   = name(b, t[i++]);
    var spki      = t[i++];

    /* The two algorithms. The outer one is what the ISSUER used; the inner copy
     * inside the TBS must match it, and RFC 5280 says a mismatch means the
     * certificate is malformed — so it is worth actually checking. */
    var sigK = kids(b, sigAlgT);
    out.sigOid = oid(b, sigK[0]);
    out.sigInnerOid = oid(b, kids(b, innerSig)[0]);
    out.sigMismatch = out.sigOid !== out.sigInnerOid;
    out.sig = SIG[out.sigOid] || { n: out.sigOid, f: 'unknown' };

    var sk = kids(b, spki), algK = kids(b, sk[0]);
    out.keyOid = oid(b, algK[0]);
    out.key = KEY[out.keyOid] || { n: out.keyOid, f: 'unknown' };
    out.spki = b.slice(spki.hStart, spki.end);       // exact DER, for WebCrypto

    var bitstr = sk[1];                              // BIT STRING, 1 unused-bits byte
    var kFrom = bitstr.vStart + 1, kTo = bitstr.vEnd;
    out.keyBytes = kTo - kFrom;

    if (out.key.f === 'RSA') {
      var rsa = kids(b, readTLV(b, kFrom));          // SEQUENCE { modulus, e }
      out.bits = bitLength(b, rsa[0].vStart, rsa[0].vEnd);
    } else if (out.key.f === 'EC') {
      var c = algK[1] ? CURVE[oid(b, algK[1])] : null;
      out.curve = c ? c.n : (algK[1] ? oid(b, algK[1]) : 'unnamed');
      out.bits = c ? c.bits : null;
    } else if (out.key.bits) {
      out.bits = out.key.bits;
    } else if (out.key.f === 'DSA' || out.key.f === 'DH') {
      // the modulus lives in the parameters, not the key
      try { out.bits = bitLength(b, kids(b, algK[1])[0].vStart, kids(b, algK[1])[0].vEnd); }
      catch (e) { out.bits = null; }
    } else out.bits = null;

    out.isCA = false; out.sans = []; out.keyUsage = [];
    for (; i < t.length; i++) {
      if ((t[i].tag & 0xa0) === 0xa0 && t[i].num === 3) {        // [3] extensions
        kids(b, kids(b, t[i])[0]).forEach(function (ext) {
          var e = kids(b, ext), eo = oid(b, e[0]);
          var val = e[e.length - 1];                              // OCTET STRING
          var inner;
          try { inner = readTLV(b, val.vStart); } catch (err) { return; }
          if (eo === '2.5.29.19') {                               // basicConstraints
            var bc = kids(b, inner);
            out.isCA = !!(bc[0] && bc[0].num === 1 && b[bc[0].vStart] !== 0);
          } else if (eo === '2.5.29.17') {                        // subjectAltName
            kids(b, inner).forEach(function (gn) {
              if (gn.num === 2) out.sans.push(str(b, gn));        // [2] dNSName
            });
          } else if (eo === '2.5.29.15') {                        // keyUsage
            var bits = b[inner.vStart + 1], names =
              ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment',
               'keyAgreement', 'keyCertSign', 'cRLSign'];
            names.forEach(function (nm, k) { if (bits & (0x80 >> k)) out.keyUsage.push(nm); });
          }
        });
      }
    }
    out.selfSigned = out.issuer === out.subject;
    return out;
  }

  function hex(b, t) {
    var s = '';
    for (var i = t.vStart; i < t.vEnd; i++) s += ('0' + b[i].toString(16)).slice(-2);
    return s.replace(/^00/, '');
  }
  function bigInt(b, t) { var n = 0; for (var i = t.vStart; i < t.vEnd; i++) n = n * 256 + b[i]; return n; }

  /* ========================================================================
   * 4. SSH public keys and JWKs
   * Both are length-prefixed formats that state their own algorithm, so both
   * can be read exactly rather than pattern-matched on the comment.
   * ==================================================================== */

  /* A minimal DER writer. It exists so an SSH key can be re-encoded as the SPKI
   * WebCrypto expects, which turns "we think this is a 3072-bit RSA key" into
   * something the browser will either accept or reject. A malformed encoding is
   * refused, so acceptance is evidence about the parse and not just about us.
   * OIDs are encoded from their dotted form rather than pasted in as bytes —
   * the same rule the rest of this page runs on. */
  function dLen(n) {
    if (n < 0x80) return [n];
    var b = []; while (n > 0) { b.unshift(n & 0xff); n = Math.floor(n / 256); }
    return [0x80 | b.length].concat(b);
  }
  function dTLV(tag, bytes) { return [tag].concat(dLen(bytes.length), bytes); }
  function dSeq() { return dTLV(0x30, [].concat.apply([], [].slice.call(arguments))); }
  function dInt(u8) {                       // unsigned big-endian → DER INTEGER
    var i = 0; while (i < u8.length - 1 && u8[i] === 0) i++;
    var v = [].slice.call(u8, i);
    if (v[0] & 0x80) v.unshift(0);          // keep it positive
    return dTLV(0x02, v);
  }
  function dBits(bytes) { return dTLV(0x03, [0].concat([].slice.call(bytes))); }
  function dOid(s) {
    var a = s.split('.').map(Number), out = [40 * a[0] + a[1]];
    for (var i = 2; i < a.length; i++) {
      var n = a[i], chunk = [n & 0x7f];
      n = Math.floor(n / 128);
      while (n > 0) { chunk.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
      out = out.concat(chunk);
    }
    return dTLV(0x06, out);
  }
  var SSH_CURVE = { nistp256: '1.2.840.10045.3.1.7', nistp384: '1.3.132.0.34', nistp521: '1.3.132.0.35' };

  function parseSSH(line) {
    var m = line.trim().match(/^(?:[\w@.\-]+\s+)?(ssh-[\w-]+|ecdsa-sha2-[\w-]+|sk-[\w@.\-]+)\s+([A-Za-z0-9+/=]+)\s*(.*)$/);
    if (!m) return null;
    var b = b64(m[2]), p = 0;
    function chunk() {
      var n = (b[p] * 16777216) + (b[p + 1] * 65536) + (b[p + 2] * 256) + b[p + 3];
      p += 4; var v = b.slice(p, p + n); p += n; return v;
    }
    var type = ascii(chunk());
    if (type !== m[1]) return null;               // the wire format must agree with the label
    var out = { kind: 'ssh', type: type, comment: m[3] || '', bits: null, curve: null };
    if (type === 'ssh-rsa') {
      var e = chunk(), n = chunk();
      out.bits = bitLength(n, 0, n.length); out.f = 'RSA'; out.keyName = 'rsaEncryption'; out.oid = '1.2.840.113549.1.1.1';
      out.spki = new Uint8Array(dSeq(dSeq(dOid('1.2.840.113549.1.1.1'), [0x05, 0x00]),
                                     dBits(dSeq(dInt(n), dInt(e)))));
    } else if (type.indexOf('ecdsa-sha2-') === 0) {
      var cn = ascii(chunk()), point = chunk();
      out.curve = cn.replace('nistp', 'P-'); out.f = 'EC'; out.keyName = 'id-ecPublicKey'; out.oid = '1.2.840.10045.2.1';
      out.bits = +cn.replace('nistp', '') || null;
      if (SSH_CURVE[cn]) out.spki = new Uint8Array(dSeq(dSeq(dOid('1.2.840.10045.2.1'), dOid(SSH_CURVE[cn])), dBits(point)));
    } else if (type === 'ssh-ed25519') {
      var k = chunk();
      out.f = 'EdDSA'; out.bits = 256; out.keyName = 'Ed25519'; out.oid = '1.3.101.112';
      out.spki = new Uint8Array(dSeq(dSeq(dOid('1.3.101.112')), dBits(k)));
    } else if (type === 'ssh-dss') {
      var pmod = chunk(); out.f = 'DSA'; out.bits = bitLength(pmod, 0, pmod.length); out.keyName = 'id-dsa'; out.oid = '1.2.840.10040.4.1';
    } else return null;
    return out;
  }

  /* A JWKS is usually pasted on its own, but people paste it alongside a chain
   * too — so the whole blob is tried first and then any embedded JSON object
   * that actually looks like key material. Anything else is left alone rather
   * than guessed at. */
  function parseJWKS(text) {
    var j = null;
    try { j = JSON.parse(text); } catch (e) {
      var m = text.match(/\{[\s\S]*"(?:keys|kty)"[\s\S]*\}/);
      if (m) { try { j = JSON.parse(m[0]); } catch (e2) { return null; } }
    }
    if (!j || typeof j !== 'object') return null;
    var keys = j.keys || (j.kty ? [j] : null);
    if (!keys || !keys.length) return null;
    return keys.map(function (k) {
      var o = { kind: 'jwk', kid: k.kid || '', f: k.kty, curve: null, bits: null };
      /* `use` is the key's own statement of what it is for, so it decides
       * whether the exposure is retroactive. Only fall back to the family
       * default when the key does not say. */
      o.role = k.use === 'enc' ? 'conf' : k.use === 'sig' ? 'auth' : null;
      if (k.kty === 'RSA' && k.n) {
        var n = b64(k.n.replace(/-/g, '+').replace(/_/g, '/'));
        o.bits = bitLength(n, 0, n.length);
        if (!o.role) o.role = 'both';
      } else if (k.kty === 'EC') {
        o.f = 'EC'; o.curve = k.crv; o.bits = +String(k.crv).replace(/\D/g, '') || null;
        if (!o.role) o.role = 'both';
      } else if (k.kty === 'OKP') {
        o.curve = k.crv;
        o.f = (k.crv === 'X25519' || k.crv === 'X448') ? 'XDH' : 'EdDSA';
        o.bits = /448/.test(k.crv || '') ? 456 : 256;
        o.role = o.f === 'XDH' ? 'conf' : (o.role || 'auth');
      } else if (!o.role) o.role = 'auth';
      return o;
    });
  }

  function b64(s) {
    var raw = atob(s.replace(/\s+/g, '').replace(/=+$/, '') + '===='.slice(0, (4 - s.replace(/\s+/g, '').replace(/=+$/, '').length % 4) % 4));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function ascii(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return s; }

  /* ========================================================================
   * 5. What breaks, and how
   * Two different failure modes that people constantly merge into one score.
   * Confidentiality fails RETROACTIVELY — traffic captured today is decrypted
   * whenever the capability arrives. Authentication fails from Q-day FORWARD —
   * nobody can forge yesterday's signature after the fact. So a signing key's
   * confidentiality lifetime is not its exposure window, and treating it as one
   * is how these inventories end up overstated.
   * ==================================================================== */

  var FAM = {
    RSA:      { shor: true,  role: 'both' },
    EC:       { shor: true,  role: 'both' },
    ECDSA:    { shor: true,  role: 'auth' },
    EdDSA:    { shor: true,  role: 'auth' },
    XDH:      { shor: true,  role: 'conf' },
    DSA:      { shor: true,  role: 'auth' },
    DH:       { shor: true,  role: 'conf' },
    'ML-DSA': { shor: false, role: 'auth' },
    'SLH-DSA':{ shor: false, role: 'auth' },
    'ML-KEM': { shor: false, role: 'conf' }
  };

  /* The estate model's algorithm list, which the sequencer's dropdown is built
   * from. Mapping to an exact entry when we can and to an honest catch-all when
   * we cannot beats inventing a specificity the artefact did not contain. */
  function estateAlg(r) {
    var f = r.f, bits = r.bits, curve = r.curve;
    if (f === 'RSA') {
      if (bits <= 1024) return 'RSA-1024';
      if (bits <= 2048) return 'RSA-2048';
      if (bits <= 3072) return 'RSA-3072';
      return 'RSA-4096';
    }
    if (f === 'EC' || f === 'ECDSA') {
      if (curve === 'P-256') return r.role === 'conf' ? 'ECDH P-256' : 'ECDSA P-256';
      if (curve === 'P-384') return 'ECDSA P-384';
      if (curve === 'P-521') return 'ECDSA P-521';
      return 'Other — Shor-breakable';
    }
    if (f === 'EdDSA') return 'Ed25519';
    if (f === 'XDH') return 'X25519';
    if (f === 'DSA') return 'DSA-2048';
    if (f === 'DH') return 'DH-2048';
    if (f === 'ML-DSA') return /-(44|65|87)$/.test(r.keyName || '') ? r.keyName : 'ML-DSA-65';
    if (f === 'ML-KEM') return 'ML-KEM-768';
    if (f === 'SLH-DSA') return 'SLH-DSA-128s';
    return 'Other — Shor-breakable';
  }

  /* ========================================================================
   * 6. WebCrypto: the second opinion
   * We do not ask the browser what the key is. We hand it the exact SPKI bytes
   * and let it decide, then compare. Agreement is the only thing that earns the
   * CONFIRMED tag; where the browser has no algorithm at all, the row says so.
   * ==================================================================== */

  function crossCheck(rec) {
    if (!window.crypto || !crypto.subtle || !rec.spki) return Promise.resolve(rec);
    var alg = null;
    if (rec.f === 'RSA') alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    else if (rec.f === 'EC' && /^P-(256|384|521)$/.test(rec.curve || '')) alg = { name: 'ECDSA', namedCurve: rec.curve };
    else if (rec.f === 'EdDSA' && rec.keyName === 'Ed25519') alg = { name: 'Ed25519' };
    if (!alg) { rec.check = 'none'; return Promise.resolve(rec); }
    return crypto.subtle.importKey('spki', rec.spki, alg, true, ['verify']).then(function (k) {
      /* Compare like for like. Each family has a different quantity worth
       * checking, and saying "confirmed" about a quantity the browser never
       * reported would be the exact mislabelling this site keeps catching:
       * RSA reports a modulus length, EC reports a curve name, and Ed25519
       * reports only that it accepted the bytes as an Ed25519 key. */
      var got, mine;
      if (rec.f === 'RSA')      { got = k.algorithm.modulusLength; mine = rec.bits; }
      else if (rec.f === 'EC')  { got = k.algorithm.namedCurve;    mine = rec.curve; }
      else                      { got = k.algorithm.name;          mine = 'Ed25519'; }
      rec.check = (got != null && String(got) === String(mine)) ? 'confirmed' : 'disagree';
      rec.checkGot = got;
      rec.checkWhat = rec.f === 'RSA' ? 'modulus length' : rec.f === 'EC' ? 'curve' : 'algorithm';
      return rec;
    }).catch(function () {
      /* We had an algorithm to try and the browser refused the bytes. That is
       * information, not an absence of it — either the key is unusual or our
       * reading of it is wrong — so it does not get to hide behind PARSED. */
      rec.check = 'rejected'; return rec;
    });
  }

  /* ========================================================================
   * 7. Reading a paste
   * ==================================================================== */

  function parse(text) {
    var recs = [], errors = [];
    var pem = /-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----/g, m;
    while ((m = pem.exec(text))) {
      try {
        var der = b64(m[1]);
        var c = parseCert(der);
        var f = c.key.f, role = (FAM[f] || {}).role || 'auth';
        // a certificate key's role is what the certificate says it is
        if (c.keyUsage.indexOf('keyEncipherment') >= 0 || c.keyUsage.indexOf('keyAgreement') >= 0) role = 'conf';
        else if (c.keyUsage.length) role = 'auth';
        recs.push({
          kind: 'cert', label: shortName(c.subject) || 'certificate', cert: c,
          f: f, keyName: c.key.n, bits: c.bits, curve: c.curve, spki: c.spki,
          role: role, pq: !!c.key.pq, isCA: c.isCA, sans: c.sans,
          issuer: c.issuer, subject: c.subject,
          notAfter: c.notAfter, notBefore: c.notBefore,
          sigName: c.sig.n, sigFam: c.sig.f, sigPQ: !!c.sig.pq, sigHash: c.sig.hash,
          sigMismatch: c.sigMismatch, selfSigned: c.selfSigned
        });
      } catch (e) { errors.push('A certificate block could not be read: ' + e.message); }
    }
    text.split(/\r?\n/).forEach(function (line) {
      if (!/^(?:[\w@.\-]+\s+)?(ssh-|ecdsa-sha2-|sk-)/.test(line.trim())) return;
      var s = parseSSH(line);
      if (s) recs.push({ kind: 'ssh', label: s.comment || s.type, f: s.f, keyName: s.keyName,
                         wire: s.type, bits: s.bits, curve: s.curve, spki: s.spki,
                         keyOid: s.oid, role: 'auth', pq: false });
      else errors.push('A line looked like an SSH key and did not parse.');
    });
    var jw = parseJWKS(text);
    if (jw) jw.forEach(function (k) {
      recs.push({ kind: 'jwk', label: k.kid || ('JWK ' + k.f), f: k.f,
                  keyName: k.f + (k.curve ? ' ' + k.curve : ''),
                  bits: k.bits, curve: k.curve, role: k.role, pq: false });
    });
    return { records: recs, errors: errors };
  }

  function shortName(dn) {
    var m = /CN=([^,]+)/.exec(dn || '');
    return m ? m[1] : (dn || '').split(',')[0];
  }

  /* ========================================================================
   * 8. Findings
   * Each one is derived from a field that was actually read. Nothing here fires
   * on a guess, and nothing fires on a vibe about your maturity level.
   * ==================================================================== */

  var DEADLINE = [
    { y: 2030, what: 'EO 14412 requires post-quantum key establishment for federal high-value assets' },
    { y: 2031, what: 'EO 14412 requires post-quantum signatures' },
    { y: 2035, what: 'NIST IR 8547 disallows RSA and elliptic-curve public-key cryptography' }
  ];

  function findings(recs) {
    var out = [], certs = recs.filter(function (r) { return r.kind === 'cert'; });

    // (1) two algorithms, two owners
    certs.forEach(function (r) {
      if (r.pq && r.sigPQ) return;
      if (r.sigFam !== r.f && !r.selfSigned) {
        var haveIssuer = certs.some(function (o) { return o.subject === r.issuer && o !== r; });
        out.push({ k: 'split', t: shortName(r.subject) + ' carries one algorithm and is signed with another',
          d: 'Its key is <b>' + keyLabel(r) + '</b>. Its issuer signed it with <b>' + r.sigName +
             '</b>. Replacing the key does not touch the signature — that is the issuer\'s migration, on the issuer\'s schedule. ' +
             (haveIssuer ? 'The issuing certificate is in this paste, so the sequencer below will make it a prerequisite.'
                         : 'The issuing certificate is <b>not</b> in this paste. If <b>' + shortName(r.issuer) +
                           '</b> is a public CA, this item is procurement, not engineering.') });
      }
    });

    // (2) validity that outlives the algorithm's permission to exist
    certs.forEach(function (r) {
      if (r.pq) return;
      var y = r.notAfter.getUTCFullYear();
      for (var i = DEADLINE.length - 1; i >= 0; i--) {
        if (y > DEADLINE[i].y) {
          out.push({ k: 'date', t: shortName(r.subject) + ' is valid until ' + y + ', past a date its algorithm is not',
            d: 'It expires <b>' + r.notAfter.toISOString().slice(0, 10) + '</b>. ' + DEADLINE[i].what +
               ' from <b>' + DEADLINE[i].y + '</b>. Something has to re-issue it before then, so the only question is whether that happens on your plan or on an incident.' });
          break;
        }
      }
    });

    // (3) a CA is a gate
    certs.filter(function (r) { return r.isCA; }).forEach(function (r) {
      var under = certs.filter(function (o) { return o.issuer === r.subject && o !== r; });
      out.push({ k: 'ca', t: shortName(r.subject) + ' is a certificate authority',
        d: under.length
          ? 'It signs <b>' + under.length + '</b> of the certificates here. Everything it signs has to wait for it, which is exactly the precedence the sequencer below schedules against — and the reason an estate rarely migrates as fast as its individual efforts suggest.'
          : 'Nothing in this paste was signed by it, so its dependants are elsewhere. A CA migration is almost never the small item it looks like on a list.' });
    });

    // (4) SHA-1 is not a quantum problem
    certs.filter(function (r) { return r.sigHash === 'SHA-1'; }).forEach(function (r) {
      out.push({ k: 'now', t: shortName(r.subject) + ' is signed with SHA-1',
        d: 'That is broken today, classically, and has nothing to do with quantum computers. Collision attacks on SHA-1 have been practical since 2017. This is not a 2030 item.' });
    });

    // (5) RSA below 2048
    recs.filter(function (r) { return r.f === 'RSA' && r.bits && r.bits < 2048; }).forEach(function (r) {
      out.push({ k: 'now', t: (r.label || 'A key') + ' is RSA-' + r.bits,
        d: 'Below the 112-bit security strength floor NIST set in 2030 terms, and weak against classical factoring effort long before any quantum computer is relevant. Also not a 2030 item.' });
    });

    // (6) already done
    var pq = recs.filter(function (r) { return r.pq; });
    if (pq.length) out.push({ k: 'ok', t: pq.length + ' artefact' + (pq.length > 1 ? 's are' : ' is') + ' already post-quantum',
      d: pq.map(function (r) { return '<b>' + esc(r.keyName) + '</b>'; }).join(', ') +
         '. These are excluded from the migration plan, because they are not migration work.' });

    // (7) the one the certificates cannot tell you
    if (certs.length) out.push({ k: 'gap', t: 'Your harvest-now exposure is not in any of these files',
      d: 'In TLS 1.3 the certificate key <em>signs</em>; it never encrypts. The key exchange that actually protects the traffic is an ephemeral ECDHE or X25519 share negotiated per connection, and it appears in no certificate and no certificate inventory. ' +
         'A signature that breaks in 2032 cannot forge a 2026 handshake retroactively — but a key exchange broken in 2032 decrypts every 2026 recording of it. ' +
         '<b>Add your key exchange to the sequencer by hand.</b> It is usually the highest-exposure line in the estate and the one no scanner reads off a file.' });

    /* (8) an RSA certificate that never says what its key is for. The default
     * assumption below is signing, because that is what a certificate key does
     * in TLS 1.3 — but if this key does key transport or protects data at rest,
     * its exposure is retroactive and its lifetime is not zero. The tool will
     * not guess that for you in either direction. */
    certs.filter(function (r) { return r.role === 'both' && !r.cert.keyUsage.length && !r.pq; }).forEach(function (r) {
      out.push({ k: 'ask', t: shortName(r.subject) + ' does not say what its key is for',
        d: 'It carries no key-usage extension, so the certificate itself does not distinguish signing from key transport. ' +
           'This tool assumed <b>signing</b> — the TLS 1.3 behaviour — and therefore gave it a confidentiality lifetime of zero in the sequencer. ' +
           'If that key actually encrypts anything, set the lifetime by hand: its exposure is retroactive and it is probably your worst line.' });
    });

    // (9) a malformed certificate is worth saying out loud
    certs.filter(function (r) { return r.sigMismatch; }).forEach(function (r) {
      out.push({ k: 'now', t: shortName(r.subject) + ' declares two different signature algorithms',
        d: 'RFC 5280 requires the algorithm inside the signed body to match the one outside it. This one does not, which means the certificate is malformed and some clients will reject it.' });
    });

    return out;
  }

  function keyLabel(r) {
    if (r.f === 'RSA') return 'RSA-' + (r.bits || '?');
    if (r.f === 'EC' || r.f === 'ECDSA') return 'ECDSA ' + (r.curve || '?');
    return r.keyName || r.f;
  }

  /* ========================================================================
   * 9. The CycloneDX 1.6 CBOM
   * Field names and enum values are taken from the published 1.6 JSON schema,
   * not from memory. Each certificate becomes three linked components — the
   * certificate, the algorithm of the key it carries, and the algorithm its
   * issuer signed with — because that is the split the format was designed to
   * express and the split most inventories lose.
   * ==================================================================== */

  /* NIST SP 800-57 Part 1 Rev 5, Table 2 — the comparable classical strengths.
   * Only the tabulated sizes appear. RSA-4096 is deliberately absent: NIST does
   * not assign it a figure, and writing 128 there would be quoting a number
   * more precisely than the source supports. An omitted field says "not stated";
   * a wrong one says something false in a machine-readable document. */
  var CLASSICAL = { 'RSA:2048': 112, 'RSA:3072': 128, 'RSA:7680': 192, 'RSA:15360': 256,
                    'EC:256': 128, 'EC:384': 192, 'EC:521': 256,
                    /* RFC 8032 states the design targets for the Edwards curves. */
                    'EdDSA:256': 128, 'EdDSA:456': 224 };
  var NISTQ = { 'ML-DSA-44': 2, 'ML-DSA-65': 3, 'ML-DSA-87': 5,
                'ML-KEM-512': 1, 'ML-KEM-768': 3, 'ML-KEM-1024': 5 };

  function algComponent(ref, nm, fam, bits, curve, fns, oidStr, prim) {
    var props = { primitive: prim || 'unknown', executionEnvironment: 'unknown',
                  implementationPlatform: 'unknown', cryptoFunctions: fns };
    if (fam === 'EC') props.curve = curve;
    else if (fam === 'EdDSA') props.curve = nm === 'Ed448' ? 'Ed448' : 'Ed25519';
    /* parameterSetIdentifier is what the schema calls the variant selector —
     * "2048" in AES128's sense. A key length is that for RSA; a curve is not,
     * so an EC key carries `curve` instead and no invented parameter set. */
    if (fam === 'RSA' && bits) props.parameterSetIdentifier = String(bits);
    else if (/^(ML-DSA|ML-KEM)/.test(nm)) props.parameterSetIdentifier = nm.split('-').pop();
    else if (fam === 'SLH-DSA') props.parameterSetIdentifier = nm.replace(/^SLH-DSA-/, '');
    /* classicalSecurityLevel is strength against a CLASSICAL attacker, which is
     * the question the field asks. It is not reduced to reflect Shor — that
     * would be answering a different question. The quantum position is carried
     * by nistQuantumSecurityLevel, where 0 is defined as meeting no category. */
    var cl = CLASSICAL[fam + ':' + bits];
    if (cl) props.classicalSecurityLevel = cl;
    props.nistQuantumSecurityLevel = NISTQ[nm] || 0;
    var c = { type: 'cryptographic-asset', 'bom-ref': ref, name: nm,
              cryptoProperties: { assetType: 'algorithm', algorithmProperties: props } };
    if (oidStr) c.cryptoProperties.oid = oidStr;
    return c;
  }

  function bom(recs) {
    var comps = [], seen = {};
    function alg(nm, fam, bits, curve, fns, oidStr, prim) {
      var ref = 'alg:' + (nm + (fam === 'EC' && curve && nm.indexOf(curve) < 0 ? '-' + curve : ''))
                  .toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (!seen[ref]) { seen[ref] = true; comps.push(algComponent(ref, nm, fam, bits, curve, fns, oidStr, prim)); }
      return ref;
    }
    recs.forEach(function (r, i) {
      /* The primitive follows what the key DOES, not what its family can do.
       * An RSA key that signs is a signature primitive; calling it `pke`
       * because RSA can also encrypt would put a wrong noun in a field a
       * downstream tool will act on. */
      var conf = r.role === 'conf';
      var prim = r.f === 'ML-KEM' ? 'kem' : conf ? (r.f === 'RSA' ? 'pke' : 'key-agree') : 'signature';
      var keyRef = alg(keyLabel(r), r.f, r.bits, r.curve, conf ? ['encapsulate', 'decapsulate'] : ['sign', 'verify'],
                       r.kind === 'cert' ? r.cert.keyOid : r.keyOid, prim);
      if (r.kind === 'cert') {
        var sigRef = alg(r.sigName, r.sigFam, null, null, ['sign', 'verify'], r.cert.sigOid, 'signature');
        comps.push({
          type: 'cryptographic-asset', 'bom-ref': 'cert:' + i, name: shortName(r.subject),
          cryptoProperties: {
            assetType: 'certificate',
            certificateProperties: {
              subjectName: r.subject, issuerName: r.issuer,
              notValidBefore: r.notBefore.toISOString(), notValidAfter: r.notAfter.toISOString(),
              signatureAlgorithmRef: sigRef, subjectPublicKeyRef: keyRef,
              certificateFormat: 'X.509', certificateExtension: 'crt'
            }
          }
        });
      } else {
        comps.push({
          type: 'cryptographic-asset', 'bom-ref': r.kind + ':' + i,
          name: r.label || r.keyName,
          cryptoProperties: {
            assetType: 'related-crypto-material',
            relatedCryptoMaterialProperties: {
              type: 'public-key', state: 'active', algorithmRef: keyRef,
              size: r.bits || undefined, format: r.kind === 'ssh' ? 'OpenSSH' : 'JWK'
            }
          }
        });
      }
    });
    return {
      bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
      serialNumber: 'urn:uuid:' + uuid(),
      metadata: {
        timestamp: new Date().toISOString(),
        lifecycles: [{ phase: 'operations' }],
        tools: { components: [{ type: 'application', name: 'SymbiQ Inventory',
                                description: 'Client-side cryptographic inventory. Fields are read from the artefacts, not entered.' }] },
        properties: [
          { name: 'symbiq:scope', value: 'Certificates, SSH public keys and JWKs pasted by the operator. This BOM does not include ephemeral TLS key exchange, which appears in no certificate.' },
          { name: 'symbiq:confirmed', value: String(recs.filter(function (r) { return r.check === 'confirmed'; }).length) + ' of ' + recs.length + ' keys were independently confirmed by WebCrypto' }
        ]
      },
      components: comps
    };
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ========================================================================
   * 10. Handing the estate to the sequencer
   * The payoff of parsing rather than asking: the dependency edges are read out
   * of the chain. A certificate whose issuer is also in the paste depends on it.
   * ==================================================================== */

  function toEstate(recs) {
    var certs = recs.filter(function (r) { return r.kind === 'cert'; });
    var idOf = {}, assets = [];
    recs.forEach(function (r, i) {
      if (r.pq) return;                                  // not migration work
      var id = 'd' + i;
      idOf[r.subject || ('#' + i)] = id;
      assets.push({ _r: r, id: id, name: label(r), alg: estateAlg(r),
        /* An authentication key has no confidentiality lifetime — nobody can
         * forge yesterday's signature after the fact. Putting a shelf life on
         * one overstates the estate, which is the failure this tool exists to
         * avoid, so it goes in as 0 and the page says why. */
        shelf: r.role === 'conf' ? 5 : 0,
        effort: r.isCA ? 3 : 2, deps: [], owned: true });
    });
    assets.forEach(function (a) {
      var r = a._r;
      if (r.kind !== 'cert' || r.selfSigned) return;
      var parent = certs.filter(function (o) { return o.subject === r.issuer && o !== r; })[0];
      if (parent && !parent.pq) {
        var pid = idOf[parent.subject];
        if (pid && pid !== a.id) a.deps = [pid];
      }
    });
    return assets.map(function (a) { delete a._r; return a; });
  }

  function label(r) {
    if (r.kind === 'cert') return shortName(r.subject) + (r.isCA ? ' (CA)' : '');
    if (r.kind === 'ssh') return 'SSH key — ' + (r.label || r.keyName);
    return 'JWK — ' + (r.label || r.keyName);
  }

  /* ========================================================================
   * 11. The UI
   * ==================================================================== */

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var EXAMPLE = [
    '# Internal root CA  (RSA-4096, signs everything below)',
    '-----BEGIN CERTIFICATE-----',
    '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',
    '6l7dByywcJneTX/fRxHSssS5b7KaaSyJmQ==',
    '-----END CERTIFICATE-----',
    '# api.example.com   (an ECDSA P-256 key, signed by that RSA CA)',
    '-----BEGIN CERTIFICATE-----',
    'MIIDkTCCAXmgAwIBAgIUXfDNXv9p+UwdUwUCEWhjL20JoEgwDQYJKoZIhvcNAQEL',
    'BQAwOjEhMB8GA1UEAwwYRXhhbXBsZSBJbnRlcm5hbCBSb290IENBMRUwEwYDVQQK',
    'DAxFeGFtcGxlIENvcnAwHhcNMjYwODA2MDI0NTUwWhcNMzIwMTI3MDI0NTUwWjAa',
    'MRgwFgYDVQQDDA9hcGkuZXhhbXBsZS5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMB',
    'BwNCAAQvinyJVa+RVRiG3PNxwYeFuIlcLjKfAwg3hB6SHKHj55IPiRGyuOw0P2VA',
    '7Sf0cwjJcwCd10l/vRAViH10b1Qjo3oweDArBgNVHREEJDAigg9hcGkuZXhhbXBs',
    'ZS5jb22CD3d3dy5leGFtcGxlLmNvbTAJBgNVHRMEAjAAMB0GA1UdDgQWBBSPus0+',
    'gaY37tm+IfoLy2nacwEPoTAfBgNVHSMEGDAWgBRgjiOXU/AEW6ayWFluUFJe9ViC',
    'pTANBgkqhkiG9w0BAQsFAAOCAgEAVuPfkngQo0PErukhxFh8akjz1DzqeeAVGwW5',
    'vIGGqTTXdODZl8rPpP2pbrkQHxsI/+w7c1xz2lLIbf1IypQmuVkO83t96lwweEFN',
    'CSfMd1X/bIOxOeyV6hCP5OjeItH914LKEBKZ2fbg1SzMSO0pzrpkPhjeByOsTKWQ',
    '02SGjlZ1zeN/Sf/nB71SbP7sETEJRFEB/PzvdzGmtJN0zO3yuEeVrBoIOTcBq58p',
    'RzNuL/+TKeOb9103LLXE5RK91bTvDj9FIQ0dHZl7Qrp4OqMV18WBIICXg8LGLQpl',
    'DSTXE8uJ3XK9aN2E2pQ1Xd7xEYhbLtbdLSnbhrBw7GJq9JEjrKCsZHowEpAYsQZZ',
    '27r8ck6U8dOKYsARZYbMoU1I2ZUhdaQdGmPqtLV9+uzRG24Kp619VTjPWe17Ab2n',
    'a50gil0sGSXk8+aSPb0uvXWcSykvt+v/JRAMrhGGJB5v4/WfQk0+4ciRTm0L6byD',
    'sX7BBlXhnyz4DNXq4M6LbAPNKNAUykzf2EvLW3SyMaVk1a1i8tZ+0Vq7WnwrSSom',
    'IDHhkZamqevwC4Yql5k//vSMfNC59WRvjeJdQ/yeHmem8IjhHUrnxg0rcl1MUZZl',
    'u5dU6JGqzYe2zKP4A0NnOCK3aHN/zJJOcXByAeeXZlhBTqn6aYQxfmBUuUZF8YGb',
    '32EDDBE=',
    '-----END CERTIFICATE-----',
    '# device-fleet.example.com  (RSA-2048, valid well past 2035)',
    '-----BEGIN CERTIFICATE-----',
    'MIIELTCCAhWgAwIBAgIUXfDNXv9p+UwdUwUCEWhjL20JoEkwDQYJKoZIhvcNAQEL',
    'BQAwOjEhMB8GA1UEAwwYRXhhbXBsZSBJbnRlcm5hbCBSb290IENBMRUwEwYDVQQK',
    'DAxFeGFtcGxlIENvcnAwHhcNMjYwODA2MDI0NTUwWhcNMzcwNzE5MDI0NTUwWjAj',
    'MSEwHwYDVQQDDBhkZXZpY2UtZmxlZXQuZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3',
    'DQEBAQUAA4IBDwAwggEKAoIBAQCxBQrhbYV/AZSD4xjhcJW/xCDNzF63CR5MhqAe',
    'VFJkXmWNmCocsNAM1NMQ4SBgsj7MU5QrYLprmPhQArasNMPbPHNjcMnlwJvJLaJC',
    'wh6xqz2ryreJutCWL+gYAM89PNETC8LOEZ2Zi9dx1r/YG0oXEk7OQPAG/ybNxQeq',
    'wLK3JPInKoV97KLblh9376il3JeIHsnXFzpQLz9AWsoEBVXBWud4ML2X+46eJZ25',
    'ETkQdBr2nUpcTzSC4sbkUf67Z/ijQ4pRF7zwDNXap+jT0zm3Kt+G6x/HCOHweK5x',
    'RHP+o8JEPUJfoQZ3gwyu0w1mOf6TZ5DPlREVr3rmHhvUg5HvAgMBAAGjQjBAMB0G',
    'A1UdDgQWBBTUpT3ZPdt9M7ST0VW8Lsk1iXvNTDAfBgNVHSMEGDAWgBRgjiOXU/AE',
    'W6ayWFluUFJe9ViCpTANBgkqhkiG9w0BAQsFAAOCAgEAinwj3SPzmvUZKRpAX63x',
    'n3MVGpdA7qSn07skQY80WeR32dciENp3bL0+AekXRCs2NxwqsS/d0bzl0cOapfTj',
    'JuUwfnzKAGH50WxkhoTIENFfQMOUR7zYcCxpuB4lXN2pFJAvy8kl7RYo8Wb5pFJV',
    '2FnDbNmECHOSwWB3pVeUxF6q4ZQC06DzWW5aWAu60doUZ6XkX+nmC1fNsBINalj4',
    'NRKS4gQ1ZdC0Rn32jbOKmG5CA9glk12+2dl0gFtZ3a2/xrtucmmMxL2Ua00iAiCM',
    'IrKStHp8bGlA4r0d4+8zFO76lSvnH6hvgFnZ3B7p4+VYLUpprYdtJXsPNod9BPTA',
    'aebDGppvBBrpIxDyVYXtPXqwUAMpST7aS1TBIbs/PCy6XUJc8olViGtBN7hRy80P',
    'IgPlSzPHsntSH0kwZq3gmWKPr/8uu1H+uXuvbtzjx74Dww6flYnw6tZbLsfXWu7W',
    'zmVdK54WeTtx7EWd+vRwwZmjKoRP+b+0Q5b4aLyUvB+sfhr5EIxpRDsYCUl0732B',
    'T18bcJtSKEEztJxdpbWJshzyCHUMIvkt/yo8Sqk2q2OnXeNQXcWyRdRUT92xMoVz',
    'rDNN6t/s5JwZrLRGALxnCbONVaLLwyegE/usNi8N5RO8b+cAPYcNnn7azP1qnRuB',
    'XHgZ0FuaYWrGa25f8Ist0gQ=',
    '-----END CERTIFICATE-----',
    '# pq.example.com    (already migrated: a real ML-DSA-65 certificate)',
    '-----BEGIN CERTIFICATE-----',
    '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',
    '-----END CERTIFICATE-----',
    '# Three OpenSSH public keys from the same estate',
    'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDaH5u1u0c1Y5xOMJH5XckDJvTuuCbKO8WySiuPEYVwOuYvSoHISenniVhGQ+416UyIcTZOeKJvonTCAJP0ORIgg/JPR+iupLy6tnMnBlgs7xNpG8A/2oMhDNhtYJKPzZLJXbVz15a1nNjz9Ei+fQxyqEqu+LeNfisZvmZaWVirFjkx1Bosk3gd5ppSjWzJJHdjqCEfU5iPMNk390UEmn7vfI0nr1HwTCPs3MmNs4bKuB1oNIuI4Q90S9FLtFI/1htF6KjJRBHrvAQPVEpvLMi+dO8Py9tmMsenfo7+3JwlUBVSU6tkO5DbGf9/CwxAmBStOE4GH6kEdQY2pxKtCbM9XIeOwbfK0WIJKyJ+gpF0GIGLGtW/d7Psbn/CAfcfXhci4RmLW76owYJDwFAaTueZRWxg1zaBnHpdLhMskpM9rCR/wKAgp6o98oq6ArFaZfSODEgofswTJ+emFuncVM1Kb5pJFuxsWK38j9AG9OPvQL7z0INRnwevO4Hws56e0NU= deploy@build-server',
    'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBAthLOZFhwGm1g4l+C5qkpTmVdpsqoPa/370WdOjLbDnZu9/VsOl1R8MkrWWOhKvFh7KJpiHsNm0Sq/op6Zl2UA= ops@bastion',
    'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAbOqqUwZDf9Xlt3V+8TsoA0zQkGT8s4cPFB0ZcSqg4L ci@runner',
    ''
  ].join('\n');

  SymbiQ.cbom = { parse: parse, parseCert: parseCert, parseSSH: parseSSH, findings: findings,
                  bom: bom, toEstate: toEstate, estateAlg: estateAlg, crossCheck: crossCheck,
                  EXAMPLE: EXAMPLE, oidOf: { SIG: SIG, KEY: KEY, CURVE: CURVE } };

  SymbiQ.cbom.mount = function (root, opts) {
    opts = opts || {};
    var state = { records: [], errors: [], parsed: false };

    function shell() {
      return '<div class="cb-wrap">' +
        '<label class="cb-lab" for="cb-in">Paste PEM certificates, SSH public keys, or a JWKS. As many as you like, mixed together.</label>' +
        '<textarea id="cb-in" class="cb-in" spellcheck="false" rows="7" placeholder="-----BEGIN CERTIFICATE-----&#10;MIIF...&#10;-----END CERTIFICATE-----&#10;&#10;ssh-ed25519 AAAAC3Nza... ci@runner"></textarea>' +
        '<p class="cb-btns">' +
          '<button type="button" class="preset on" id="cb-go">Read them</button>' +
          '<button type="button" class="preset" id="cb-eg">Load an example estate</button>' +
          '<button type="button" class="preset" id="cb-clr">Clear</button>' +
        '</p>' +
        '<p class="cb-priv">Nothing you paste is transmitted. There is no server behind this page — the parsing, the checking and the export all happen in this tab.</p>' +
        '<div class="cb-out" id="cb-out"></div></div>';
    }

    function tag(r) {
      if (r.check === 'confirmed') return '<span class="cb-tag ok" title="Your browser\'s own WebCrypto imported these exact bytes and reported the same ' +
        (r.checkWhat || 'value') + ' our decoder read">CONFIRMED</span>';
      if (r.check === 'disagree') return '<span class="cb-tag bad" title="WebCrypto reported ' + esc(r.checkGot) +
        ' where our decoder read ' + esc(r.f === 'EC' ? r.curve : r.bits) + '. Treat this row as unreliable, and please tell us">DISAGREE</span>';
      if (r.check === 'rejected') return '<span class="cb-tag bad" title="Your browser refused to import these bytes as the algorithm we read. Either the key is unusual or our reading of it is wrong">REJECTED</span>';
      return '<span class="cb-tag" title="Read out of the artefact by this page\'s decoder. Your browser has no algorithm for this one, so there was nothing independent to check it against">PARSED</span>';
    }

    function fails(r) {
      if (r.pq) return '<span class="cb-ok">already post-quantum</span>';
      if (r.role === 'conf') return 'Shor, <b class="cb-retro">retroactively</b> — recorded traffic is decrypted later';
      if (r.role === 'both') return 'Shor. <b>Depends what the key does</b> — signing fails at Q-day, key transport fails <b class="cb-retro">retroactively</b>';
      return 'Shor, <b>at Q-day</b> — forgery from then on, not backwards';
    }

    function results() {
      if (!state.parsed) return '';
      var recs = state.records;
      if (!recs.length) {
        return '<div class="verdict bad"><b>Nothing readable in that.</b> ' +
          (state.errors.length ? esc(state.errors[0]) : 'Expecting PEM certificate blocks, OpenSSH public-key lines, or a JWKS document.') +
          '</div>';
      }
      var vulnerable = recs.filter(function (r) { return !r.pq; });
      var conf = recs.filter(function (r) { return r.role === 'conf' && !r.pq; }).length;
      var confirmed = recs.filter(function (r) { return r.check === 'confirmed'; }).length;

      var head = '<div class="verdict ' + (vulnerable.length ? 'warn' : 'good') + '">' +
        '<b>' + recs.length + ' artefact' + (recs.length > 1 ? 's' : '') + ' read.</b> ' +
        vulnerable.length + ' of them rest on a problem Shor\'s algorithm solves. ' +
        (conf ? conf + ' of those protect confidentiality, so ' + (conf > 1 ? 'their' : 'its') + ' exposure is <b>retroactive</b>. ' : '') +
        confirmed + ' key' + (confirmed === 1 ? ' was' : 's were') + ' independently confirmed by your browser\'s own WebCrypto.' +
        '</div>';

      var rows = recs.map(function (r) {
        return '<tr><th scope="row">' + esc(label(r)) + '<span class="cb-src">' +
            (r.kind === 'cert' ? 'X.509' : r.kind === 'ssh' ? 'OpenSSH' : 'JWK') + '</span></th>' +
          '<td>' + esc(keyLabel(r)) + ' ' + tag(r) + '</td>' +
          '<td>' + (r.kind === 'cert' ? esc(r.sigName) : '<span class="cb-na">—</span>') + '</td>' +
          '<td>' + fails(r) + '</td>' +
          '<td class="cb-n">' + (r.kind === 'cert' ? r.notAfter.toISOString().slice(0, 10) : '<span class="cb-na">—</span>') + '</td></tr>';
      }).join('');

      var fs = findings(recs);
      var flist = fs.map(function (f) {
        return '<li class="cb-f cb-' + f.k + '"><b>' + esc(f.t) + '</b><span>' + f.d + '</span></li>';
      }).join('');

      return head +
        '<div class="cb-scroll"><table class="cb"><thead><tr>' +
          '<th>Artefact</th><th>The key it carries</th><th>Signed with</th>' +
          '<th>How it fails</th><th>Valid until</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (state.errors.length ? '<p class="cb-err">' + state.errors.map(esc).join('<br>') + '</p>' : '') +
        '<h4 class="cb-h">What that means for you</h4><ul class="cb-fs">' + flist + '</ul>' +
        '<p class="cb-btns">' +
          '<button type="button" class="preset" id="cb-dl">⤓ Download the CBOM (CycloneDX 1.6)</button>' +
          '<button type="button" class="preset on" id="cb-send">Send to the sequencer ▸</button>' +
        '</p>' +
        '<p class="cb-note">The sequencer below will inherit the dependency edges read out of the chain — a certificate whose issuer is also in this list waits for it. ' +
        'Signing keys arrive with a confidentiality lifetime of <b>0</b>, because a signature cannot be forged backwards; set it yourself only if that key also protects data at rest.</p>';
    }

    function render() { root.querySelector('#cb-out').innerHTML = results(); }

    function read(text) {
      var r = parse(text);
      state.records = r.records; state.errors = r.errors; state.parsed = true;
      render();                                   // draw immediately, PARSED tags
      Promise.all(state.records.map(crossCheck)).then(render).catch(function () {});
    }

    root.innerHTML = shell();
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var ta = root.querySelector('#cb-in');
      if (b.id === 'cb-go') read(ta.value);
      else if (b.id === 'cb-eg') { ta.value = EXAMPLE; read(EXAMPLE); }
      else if (b.id === 'cb-clr') { ta.value = ''; state.parsed = false; render(); }
      else if (b.id === 'cb-dl') {
        var blob = new Blob([JSON.stringify(bom(state.records), null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'cbom.cdx.json'; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } else if (b.id === 'cb-send') {
        var assets = toEstate(state.records);
        if (!assets.length) { b.textContent = 'Nothing to migrate — it is all post-quantum'; return; }
        if (SymbiQ.estate && SymbiQ.estate.load) {
          SymbiQ.estate.load(assets);
          var t = document.getElementById('estate');
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
    if (opts.example) { root.querySelector('#cb-in').value = EXAMPLE; read(EXAMPLE); }
    else if (opts.restoreText) { root.querySelector('#cb-in').value = opts.restoreText; read(opts.restoreText); }
  };
})();

/* ── 3 · THE SEQUENCER (the estate model) ────────────────────────────────
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
 * ────────────────────────────────────────────────────────────────────── */
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

  /* A live estate has exactly one true future -- there is no per-page reason
   * for a second tool (the Odds, below) to make you re-type it. Every render()
   * publishes the current {assets, cap, policy, dlYear} to anyone listening,
   * late subscribers included, so mount order between the two tools never
   * matters. */
  var listeners = [], lastState = null;
  function publish(state) {
    lastState = state;
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
  }
  function subscribe(fn) {
    listeners.push(fn);
    if (lastState) fn(lastState);
  }

  SymbiQ.estate = { ALGS: ALGS, TEMPLATE: TEMPLATE, plan: plan, assess: assess,
                    feasibility: feasibility, depth: depth, subscribe: subscribe };

  /* ================================ the UI ================================ */
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* Real deadlines, counted from today rather than hardcoded, so the numbers
   * stay true as the deadline approaches instead of quietly going stale. */
  function quartersUntil(year) {
    var now = new Date(), end = new Date(year, 11, 31);
    return Math.max(1, Math.round((end - now) / (1000 * 60 * 60 * 24 * 365.25) * 4));
  }
  /* Four distinct YEARS to test, not four instruments -- EO 14412 supplies two
   * of them, and 2030 is independently the CNSA 2.0 exclusive-use date for
   * signing and networking and the EU roadmap's high-risk date. Labels name
   * every instrument that actually binds at that year, because a compliance row
   * that under-names its year lets a reader plan against the wrong one.
   * CNSA 2.0 exclusive use is NOT a single date: signing and traditional
   * networking are 2030, web/cloud/OS are 2033. Collapsing it to 2033 (as this
   * list did until the 2026-08-14 referee pass) understates the binding date by
   * three years for anyone who signs code. Do not add a fifth row at 2030 --
   * this array also drives the Sequencer's deadline buttons and the Odds tool's
   * test-year chips, so a duplicate year renders as two identical controls. */
  var DEADLINES = [
    { y: 2030, label: 'EO 14412 key establishment · CNSA 2.0 signing & networking', short: '2030' },
    { y: 2031, label: 'EO 14412 — digital signatures', short: '2031' },
    { y: 2033, label: 'CNSA 2.0 — web, cloud & OS exclusive', short: '2033' },
    { y: 2035, label: 'NIST IR 8547 (still a draft) — disallowed', short: '2035' }
  ];
  // The Odds (below) tests specific years against these same real deadlines --
  // one list, so a date fixed here can never drift out of sync with there.
  SymbiQ.estate.DEADLINES = DEADLINES;
  SymbiQ.estate.quartersUntil = quartersUntil;

  SymbiQ.estate.mount = function (root, opts) {
    opts = opts || {};
    var assets = JSON.parse(JSON.stringify(TEMPLATE));
    var cap = 3, policy = 'risk-first', dlYear = 2030, source = 'example', scenarioLabel = '';

    /* Restoring a saved session is a separate door from `load`/`loadScenario`
     * for the same reason those two are separate from each other -- the
     * banner text must tell the truth about where the estate came from. */
    if (opts.restore && opts.restore.assets && opts.restore.assets.length) {
      assets = JSON.parse(JSON.stringify(opts.restore.assets));
      if (opts.restore.cap) cap = opts.restore.cap;
      if (opts.restore.policy) policy = opts.restore.policy;
      if (opts.restore.dlYear) dlYear = opts.restore.dlYear;
      source = 'restored';
    }

    function ids() { return assets.map(function (a) { return a.id; }); }

    /* The inventory above hands its findings down to here. Everything else on
     * the page keeps working if that never happens — this is an entry point,
     * not a dependency, so a broken parser can never take the sequencer with
     * it. Capacity, deadline and policy survive the load deliberately: you are
     * dropping a new estate into a plan you have already been tuning. */
    function banner() {
      if (source === 'inventory') {
        return '<p class="es-from"><b>This estate was read from your artefacts, not typed.</b> ' +
          'Dependency edges come from the certificate chain — anything whose issuer is also in the paste waits for it. ' +
          'Signing keys arrived with a confidentiality lifetime of 0, because a signature cannot be forged backwards; ' +
          'raise it by hand for any key that also protects data. Effort is a placeholder in every row — only you know that number.</p>';
      }
      if (source === 'scenario') {
        return '<p class="es-from"><b>Loaded the ' + esc(scenarioLabel) + ' scenario.</b> ' +
          'Illustrative, not audited — a starting shape for a plausible estate, not a real one. Edit any row to make it yours.</p>';
      }
      if (source === 'restored') {
        return '<p class="es-from"><b>Restored from your last visit on this device.</b> ' +
          'Nothing was sent anywhere to do this — it was saved in this browser\'s own local storage.</p>' +
          '<p class="es-add"><button type="button" class="preset" id="es-restclr">Clear it and start fresh</button></p>';
      }
      return '';
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

    function publishNow() {
      publish({ assets: JSON.parse(JSON.stringify(assets)), cap: cap, policy: policy, dlYear: dlYear });
    }

    function render() {
      root.innerHTML = '<div class="es-wrap">' + banner() + controls() + editor() +
        '<div class="es-out">' + results() + '</div></div>';
      publishNow();
    }

    SymbiQ.estate.load = function (next) {
      if (!next || !next.length) return false;
      assets = JSON.parse(JSON.stringify(next));
      source = 'inventory';
      render();
      return true;
    };

    /* A separate door from `load` on purpose -- that one's banner claims the
     * estate was READ from real artefacts, which would be a lie for a canned
     * scenario. Capacity and policy are left alone (same reasoning as load);
     * the deadline is scenario-specific because "when do I actually need to
     * be done" is part of what makes a scenario a scenario. */
    SymbiQ.estate.loadScenario = function (next, opts) {
      if (!next || !next.length) return false;
      opts = opts || {};
      assets = JSON.parse(JSON.stringify(next));
      source = 'scenario';
      scenarioLabel = opts.label || '';
      if (opts.dlYear) dlYear = opts.dlYear;
      if (opts.policy) policy = opts.policy;
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
      publishNow();
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
      else if (b.id === 'es-restclr') {
        assets = JSON.parse(JSON.stringify(TEMPLATE)); source = 'example';
        if (SymbiQ.pqPersist) SymbiQ.pqPersist.clear();
        render();
      }
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

/* ── 4 · THE ODDS ────────────────────────────────────────────────────────
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
 * ────────────────────────────────────────────────────────────────────── */
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

/* ── 5 · LIVE DOMAIN LOOKUP ────────────────────────────────────────────────
 * The one thing on this page that contacts anything outside the browser.
 * There is no way for page JS to read the certificate actually presented on
 * a live TLS connection — browsers deliberately do not expose that to
 * scripts, CORS or not. The only client-side path to "what certs does this
 * domain have" is a public Certificate Transparency log, which is HISTORY
 * (every certificate ever logged for the name), not proof of what is live
 * right now. That distinction is stated on the page, not buried here.
 *
 * crt.sh is the obvious first choice and was tested live during planning:
 * it returned 502 (it runs on a single, often-overloaded Postgres instance)
 * and has no reliable CORS story for browser JS. SSLMate's Cert Spotter
 * (api.certspotter.com) was tested live instead — 200 OK,
 * Access-Control-Allow-Origin: *, and `expand=cert` returns the actual
 * certificate as base64 DER. That is what this section wraps, and it hands
 * the result to the already-verified Inventory parser rather than reading
 * any field itself — this section's only job is "get PEM text," nothing
 * downstream trusts it more than a hand-pasted paste. */
(function () {
  var SymbiQ = window.SymbiQ = window.SymbiQ || {};
  var API = 'https://api.certspotter.com/v1/issuances';

  function toPEM(b64) {
    var lines = [];
    for (var i = 0; i < b64.length; i += 64) lines.push(b64.slice(i, i + 64));
    return '-----BEGIN CERTIFICATE-----\n' + lines.join('\n') + '\n-----END CERTIFICATE-----';
  }

  /* Resolves to { pem, entries, error } — never rejects. A network failure, a
   * CORS failure, a rate limit and "nothing logged" are all reported through
   * `error` rather than thrown, because the caller's whole job is to show
   * something honest, not to catch an exception. */
  function lookupDomain(domain) {
    domain = String(domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!domain || domain.indexOf('.') < 0 || /\s/.test(domain)) {
      return Promise.resolve({ pem: '', entries: [],
        error: 'That does not look like a domain name — try "example.com", not a full URL.' });
    }
    var url = API + '?domain=' + encodeURIComponent(domain) + '&include_subdomains=false&expand=cert';
    return fetch(url).then(function (r) {
      if (r.status === 429) throw new Error('rate-limited');
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (list) {
      if (!Array.isArray(list) || !list.length) {
        return { pem: '', entries: [], error:
          'No certificates found for "' + domain + '" in public CT logs. That can mean the domain has never had ' +
          'a publicly-trusted certificate, or it is too new for the logs to have caught up. You can still read its ' +
          'chain yourself: openssl s_client -connect ' + domain + ':443 -showcerts' };
      }
      // Most-recent, not-revoked first. CT logs are append-only and not
      // recency-ordered, so this is a sort, not a filter — a revoked cert is
      // still a real artefact worth reading, just not the one to lead with.
      list.sort(function (a, b) {
        if (!!a.revoked !== !!b.revoked) return a.revoked ? 1 : -1;
        return new Date(b.not_before) - new Date(a.not_before);
      });
      var top = list.slice(0, 8).filter(function (e) { return e.cert && e.cert.data; });
      var pem = top.map(function (e) { return toPEM(e.cert.data); }).join('\n\n');
      return { pem: pem, entries: top,
        error: pem ? '' : 'Certificates were found but this browser could not read their bytes.' };
    }).catch(function (e) {
      var msg = (e && e.message === 'rate-limited')
        ? 'The public lookup service is rate-limiting this browser right now. Wait a moment, or paste the certificate manually below.'
        : 'The live lookup did not work in this browser (network error, or the service refused the request). ' +
          'Paste the certificate manually instead — get it with: openssl s_client -connect ' + domain + ':443 -showcerts';
      return { pem: '', entries: [], error: msg };
    });
  }

  SymbiQ.cbom = SymbiQ.cbom || {};
  SymbiQ.cbom.lookupDomain = lookupDomain;
})();

/* ── 6 · QUICK CHECK ─────────────────────────────────────────────────────
 * The front door for someone who wants one answer, not four instruments.
 * Two ways in — paste what you have, or look up a domain — both funnel
 * through the exact same Inventory parser and the exact same hand-off to
 * the Sequencer that the Inventory's own "send to sequencer" button uses.
 * Deliberately renders no verdict of its own: the moment it hands assets to
 * the Sequencer, the live Scorecard directly below it (subscribed to the
 * same estate.publish() this hand-off triggers) already shows the answer —
 * one render path, not two that could quietly disagree. */
(function () {
  var SymbiQ = window.SymbiQ = window.SymbiQ || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  SymbiQ.quickcheck = {};
  SymbiQ.quickcheck.mount = function (root, opts) {
    opts = opts || {};
    var mode = 'paste';

    function shell() {
      return '<div class="qc-wrap">' +
        '<div class="qc-tabs" role="tablist">' +
          '<button type="button" class="preset qc-tab on" data-m="paste" role="tab" aria-selected="true">Paste what you have</button>' +
          '<button type="button" class="preset qc-tab" data-m="domain" role="tab" aria-selected="false">Look up a domain</button>' +
        '</div>' +
        '<div id="qc-paste">' +
          '<label class="cb-lab" for="qc-in">Paste a certificate, an SSH public key, or a JWKS.</label>' +
          '<textarea id="qc-in" class="cb-in" spellcheck="false" rows="4" placeholder="-----BEGIN CERTIFICATE-----&#10;MIIF..."></textarea>' +
          '<p class="es-add"><button type="button" class="preset on" id="qc-go">Check it</button>' +
          '<button type="button" class="preset" id="qc-eg">Try an example estate instead</button></p>' +
        '</div>' +
        '<div id="qc-domain" hidden>' +
          '<label class="cb-lab" for="qc-dom">A domain name. <b>This is the one control on this page that contacts anything ' +
          'outside your browser</b> — it queries a public Certificate Transparency log, not your server or ours, so it can only see ' +
          'certificates that were already publicly logged, which is usually but not provably what is live right now.</label>' +
          '<p class="qc-domrow"><input type="text" id="qc-dom" class="es-in" placeholder="example.com" autocomplete="off" spellcheck="false">' +
          '<button type="button" class="preset on" id="qc-look">Look it up</button></p>' +
        '</div>' +
        '<div id="qc-out" class="qc-out"></div>' +
      '</div>';
    }

    function run(text, sourceLabel) {
      var out = root.querySelector('#qc-out');
      if (!SymbiQ.cbom || !SymbiQ.cbom.parse) return;
      var r = SymbiQ.cbom.parse(text || '');
      if (!r.records.length) {
        out.innerHTML = '<div class="verdict bad"><b>Nothing readable in that.</b> ' +
          (r.errors.length ? esc(r.errors[0]) : 'Expecting a PEM certificate, an OpenSSH public-key line, or a JWKS document.') + '</div>';
        return;
      }
      var assets = SymbiQ.cbom.toEstate(r.records);
      var vuln = r.records.filter(function (x) { return !x.pq; }).length;
      out.innerHTML = '<div class="verdict ' + (vuln ? 'warn' : 'good') + '">' +
        '<b>' + r.records.length + ' artefact' + (r.records.length > 1 ? 's' : '') + ' read' + sourceLabel + '.</b> ' +
        (vuln ? vuln + ' of them rest on a problem Shor\'s algorithm solves — your result is below.'
              : 'None of them do — already post-quantum.') +
        (assets.length ? ' <a href="#pq-score">See your result ↓</a>' : '') + '</div>';
      if (assets.length && SymbiQ.estate && SymbiQ.estate.load) {
        SymbiQ.estate.load(assets);
        var score = document.getElementById('pq-score');
        if (score) score.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    root.innerHTML = shell();
    root.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-m]');
      if (tab) {
        mode = tab.dataset.m;
        root.querySelectorAll('.qc-tab').forEach(function (b) {
          var on = b.dataset.m === mode;
          b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
        });
        root.querySelector('#qc-paste').hidden = mode !== 'paste';
        root.querySelector('#qc-domain').hidden = mode !== 'domain';
        return;
      }
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'qc-go') run(root.querySelector('#qc-in').value, '');
      else if (b.id === 'qc-eg') {
        var eg = SymbiQ.cbom.EXAMPLE;
        root.querySelector('#qc-in').value = eg; run(eg, '');
      }
      else if (b.id === 'qc-look') {
        if (!SymbiQ.cbom.lookupDomain) return;
        var dom = root.querySelector('#qc-dom').value;
        var out = root.querySelector('#qc-out');
        out.innerHTML = '<p class="sc-wait">Looking up ' + esc(dom) + '…</p>';
        b.disabled = true;
        SymbiQ.cbom.lookupDomain(dom).then(function (res) {
          b.disabled = false;
          if (!res.pem) { out.innerHTML = '<div class="verdict warn"><b>Could not read it.</b> ' + esc(res.error) + '</div>'; return; }
          run(res.pem, ' from public CT logs for ' + esc(dom));
        });
      }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'qc-dom') {
        e.preventDefault();
        var look = root.querySelector('#qc-look'); if (look) look.click();
      }
    });
  };
})();

/* ── 7 · LIVE SCORECARD, COMPLIANCE & REPORTS ───────────────────────────────
 * Pure orchestration over already-verified functions — assess(),
 * feasibility() and DEADLINES are all unchanged. This section's only job is
 * turning "the current published estate state" into three things worth
 * showing without re-typing anything: a scorecard strip, a per-deadline
 * compliance checklist, and a downloadable report. All three subscribe to
 * SymbiQ.estate.subscribe — a late mount replays the last known state
 * immediately (estate.js's own documented behaviour), so mount order
 * relative to the Sequencer never matters, exactly like the Odds tool. */
(function () {
  var SymbiQ = window.SymbiQ = window.SymbiQ || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function headline(state) {
    var dq = SymbiQ.estate.quartersUntil(state.dlYear);
    var f = SymbiQ.estate.feasibility(state.assets, state.cap, state.policy, dq);
    var r = f.assess;
    var vulnCount = r.rows.filter(function (x) { return x.vuln; }).length;
    var status = (f.deadlocked || f.capacityBound || f.chainBound) ? { t: 'Infeasible', c: 'bad' } : { t: 'Feasible', c: 'good' };
    if (f.deadlocked) status.t = 'Deadlocked';
    return { state: state, f: f, r: r, total: state.assets.length, vuln: vulnCount, worst: r.worst, status: status };
  }

  function complianceRows(state) {
    return (SymbiQ.estate.DEADLINES || []).map(function (d) {
      var dq = SymbiQ.estate.quartersUntil(d.y);
      var f = SymbiQ.estate.feasibility(state.assets, state.cap, state.policy, dq);
      return { d: d, f: f, on: f.feasible };
    });
  }

  function reportText(h, comp) {
    var L = [];
    L.push('SYMBIQ — POST-QUANTUM MIGRATION ASSESSMENT');
    L.push('Generated client-side in your browser: ' + new Date().toISOString());
    L.push('');
    L.push('PLAN: capacity ' + h.state.cap + ' quarter-unit(s)/quarter · policy "' + h.state.policy + '" · deadline ' + h.state.dlYear + '.');
    L.push('Assets tracked: ' + h.total + '. Exposed (pre-quantum): ' + h.vuln + '. Worst-case breakeven: ' +
      (h.worst ? h.worst.toFixed(2) + ' years' : 'n/a') + '. Plan status: ' + h.status.t + '.');
    L.push('');
    L.push('PER-ASSET:');
    h.r.rows.filter(function (x) { return x.vuln; }).sort(function (a, b) { return b.breakevenZ - a.breakevenZ; })
      .forEach(function (x) {
        L.push('  - ' + x.a.name + ' (' + x.a.alg + '): secret for ' + x.a.shelf + 'y, migrated ' +
          (x.quarter == null ? 'never (stuck)' : 'Q' + x.quarter) + ', exposed unless a quantum computer is further off than ' +
          (x.breakevenZ == null ? 'n/a' : x.breakevenZ + 'y') + '.');
      });
    L.push('');
    L.push('COMPLIANCE AGAINST NAMED DEADLINES:');
    comp.forEach(function (c) {
      L.push('  - ' + c.d.label + ' (' + c.d.y + '): ' + (c.on ? 'on track' : 'will not make it as currently sequenced') + '.');
    });
    L.push('');
    L.push('This is arithmetic over what you typed or looked up, not a certified audit — see symbiq\'s pqc.html for the full method and honest limits.');
    return L.join('\n');
  }

  function reportJSON(h, comp) {
    return {
      generatedAt: new Date().toISOString(),
      plan: { capacity: h.state.cap, policy: h.state.policy, deadlineYear: h.state.dlYear },
      assetsTracked: h.total, exposed: h.vuln, worstBreakevenYears: h.worst, status: h.status.t,
      assets: h.r.rows.filter(function (x) { return x.vuln; }).map(function (x) {
        return { name: x.a.name, algorithm: x.a.alg, secretForYears: x.a.shelf,
                 migratedQuarter: x.quarter, breakevenYears: x.breakevenZ, stuck: !!x.stuck };
      }),
      compliance: comp.map(function (c) { return { deadline: c.d.label, year: c.d.y, onTrack: c.on }; }),
      note: 'Client-side estimate from the SymbiQ PQC tools, not a certified audit.'
    };
  }

  function fireDownload(name, contents, type) {
    var blob = new Blob([contents], { type: type });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ------------------------------------------------------------ scorecard */
  SymbiQ.scorecard = {};
  SymbiQ.scorecard.mount = function (root, opts) {
    opts = opts || {};
    var last = null;
    function render(state) {
      if (!state || !state.assets || !state.assets.length) {
        root.innerHTML = '<p class="sc-wait">Nothing tracked yet — paste something in Quick Check above, or edit the Sequencer below.</p>';
        last = null;
        return;
      }
      var h = headline(state); last = h;
      root.innerHTML =
        '<div class="pq-score">' +
          '<div class="pq-stat"><span class="hud-label">Assets tracked</span><span class="hud-score">' + h.total + '</span></div>' +
          '<div class="pq-stat"><span class="hud-label">Exposed now</span><span class="hud-score' + (h.vuln ? ' warn' : '') + '">' + h.vuln + '</span></div>' +
          '<div class="pq-stat"><span class="hud-label">Worst breakeven</span><span class="hud-score">' + (h.worst ? h.worst.toFixed(1) + 'y' : '—') + '</span></div>' +
          '<div class="pq-stat"><span class="hud-label">Plan</span><span class="hud-score' + (h.status.c === 'bad' ? ' bad' : '') + '">' + h.status.t + '</span></div>' +
        '</div>' +
        (opts.compact ? '' :
          '<p class="es-add"><button type="button" class="preset" id="pq-dltxt">⤓ Download full report (text)</button>' +
          '<button type="button" class="preset" id="pq-dljson">⤓ Download as JSON</button>' +
          '<button type="button" class="preset" id="pq-clearsaved">Clear saved data</button></p>');
    }
    SymbiQ.estate.subscribe(render);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'pq-clearsaved') {
        if (SymbiQ.pqPersist) SymbiQ.pqPersist.clear();
        location.reload();
        return;
      }
      if (!last) return;
      var comp = complianceRows(last.state);
      if (b.id === 'pq-dltxt') fireDownload('symbiq-pqc-assessment.txt', reportText(last, comp), 'text/plain');
      else if (b.id === 'pq-dljson') fireDownload('symbiq-pqc-assessment.json', JSON.stringify(reportJSON(last, comp), null, 2), 'application/json');
    });
  };

  /* ----------------------------------------------------------- compliance */
  SymbiQ.compliance = {};
  SymbiQ.compliance.mount = function (root, opts) {
    function render(state) {
      if (!state || !state.assets || !state.assets.length) {
        root.innerHTML = '<p class="sc-wait">Build a plan above to see it checked against these deadlines.</p>';
        return;
      }
      var comp = complianceRows(state);
      root.innerHTML = '<ul class="pq-comp">' + comp.map(function (c) {
        return '<li class="pq-comp-row"><span class="cb-tag ' + (c.on ? 'ok' : 'bad') + '">' +
          (c.on ? 'ON TRACK' : 'AT RISK') + '</span><b>' + esc(c.d.label) + '</b>' +
          '<span class="sc-rl">by ' + c.d.y + '</span></li>';
      }).join('') + '</ul>';
    }
    SymbiQ.estate.subscribe(render);
  };
})();

/* ── 8 · SESSION PERSISTENCE ─────────────────────────────────────────────
 * Nothing on this page has ever left the browser; this section does not
 * change that. It writes into this browser's own localStorage, namespaced
 * the same way save.js already does elsewhere on the site, so a refreshed
 * tab does not throw away what was typed. Reading it back is opt-in and
 * visible — pqc.html's own mount script decides whether to pass it to
 * estate.mount/cbom.mount as opts.restore/opts.restoreText, and the
 * Sequencer's own banner says plainly when an estate was restored rather
 * than typed, with a one-click way to clear it. */
(function () {
  var SymbiQ = window.SymbiQ = window.SymbiQ || {};
  var KEY = 'symbiq.pqc.v1';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function write(next) {
    try {
      var cur = read() || {};
      var merged = Object.assign({}, cur, next);
      localStorage.setItem(KEY, JSON.stringify(merged));
    } catch (e) { /* private browsing / storage disabled — fail silent, nothing else breaks */ }
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  SymbiQ.pqPersist = { read: read, write: write, clear: clear };
})();

/* ── 9 · THE HARVEST CLOCK ────────────────────────────────────────────────
 * Every other tool on this page positions, discovers or sequences. This one
 * plays the single sentence "Why this has a date on it" states in prose:
 * Mosca's inequality, X + Y > Z, made playable rather than read once and
 * forgotten. It is deliberately the simplest tool on the page -- three
 * sliders, one verdict -- and it is deliberately NOT a replacement for the
 * Sequencer (which sequences your real estate) or the Odds (which turns Z
 * into a real distribution from 32 named experts instead of one guess).
 * It says so on screen, with a link to each, rather than quietly competing
 * with tools that already do this more rigorously.
 *
 * X and Y are the visitor's own numbers -- never claimed as ours. Z is a
 * single slider standing in for a whole distribution, so it is labelled
 * ⟦Heuristic⟧ and sourced on screen, and its default sits on 15 years --
 * the Global Risk Institute report's own middle surveyed horizon, the same
 * number the Odds tool's anchor table above already anchors to, so the two
 * tools never quietly disagree about which year counts as "the middle".
 *
 * Verified in Python first (see outputs/VERIFY_MOSCA.md): a 51x21x31 sweep
 * of every (X,Y,Z) integer triple in the sliders' full range confirms all
 * three verdict bands are reachable and the X+Y==Z boundary (441 of the
 * 33,201 triples) always renders as its own third state -- never silently
 * folded into "late" or "safe" by a stray > vs >=. */
(function () {
  var SymbiQ = window.SymbiQ = window.SymbiQ || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var PRESETS = [
    { id: 'bank',     label: 'A bank',            x: 15, note: 'account records, regulator-driven retention' },
    { id: 'hospital', label: 'A hospital record', x: 30, note: 'a diagnosis outlives the system that recorded it' },
    { id: 'tls',      label: 'A TLS session',      x: 0,  note: 'gone when the connection closes -- unless someone logged it' },
    { id: 'state',    label: 'A state secret',     x: 50, note: 'the harvest-now case the inequality was written for' }
  ];

  // The arithmetic itself: ⟦Proven⟧, and nothing more than an inequality.
  function verdict(x, y, z) {
    var gap = x + y - z;
    if (gap > 0) return { state: 'late', gap: gap };
    if (gap === 0) return { state: 'exact', gap: gap };
    return { state: 'safe', gap: gap };
  }

  function banner(v) {
    if (v.state === 'late') {
      return '<div class="verdict bad"><b>Already late.</b> Data you encrypt today is readable by an adversary for ' +
        '<b>' + v.gap + ' year' + (v.gap === 1 ? '' : 's') + '</b> before you finish migrating -- assuming Z arrives ' +
        'when you guessed.</div>';
    }
    if (v.state === 'exact') {
      return '<div class="verdict warn"><b>Zero margin.</b> You finish migrating the same year Z arrives, if it ' +
        'arrives when you guessed. That is not a safety margin -- it is a coin flip dressed as a plan.</div>';
    }
    return '<div class="verdict good"><b>Not yet, under these numbers.</b> You finish migrating <b>' + (-v.gap) +
      ' year' + (-v.gap === 1 ? '' : 's') + '</b> before Z, if Z arrives when you guessed. That margin is only as ' +
      'trustworthy as the Z slider -- move it and watch the margin disappear.</div>';
  }

  SymbiQ.mosca = { verdict: verdict }; // verdict exported for the in-browser cross-check against the Python sweep

  SymbiQ.mosca.mount = function (root, opts) {
    opts = opts || {};
    var x = 15, y = 5, z = 15, activePreset = 'bank';

    function render() {
      var v = verdict(x, y, z);
      root.innerHTML =
        '<div class="es-opts" role="group" aria-label="Presets">' +
        PRESETS.map(function (p) {
          return '<button type="button" class="preset' + (p.id === activePreset ? ' on' : '') + '" data-preset="' +
            p.id + '">' + esc(p.label) + '<em>' + esc(p.note) + '</em></button>';
        }).join('') + '</div>' +
        '<div class="es-ctl"><label class="es-lab">X -- years this data must stay secret: <b>' + x + '</b> ' +
          '<span class="cb-tag">your input</span></label>' +
          '<input type="range" id="mo-x" min="0" max="50" step="1" value="' + x + '" aria-label="X, years data must stay secret"></div>' +
        '<div class="es-ctl"><label class="es-lab">Y -- years your migration takes: <b>' + y + '</b> ' +
          '<span class="cb-tag">your input</span></label>' +
          '<input type="range" id="mo-y" min="0" max="20" step="1" value="' + y + '" aria-label="Y, years migration takes"></div>' +
        '<div class="es-ctl"><label class="es-lab">Z -- years until a cryptographically relevant quantum computer: <b>' + z + '</b> ' +
          '<span class="cb-tag">⟦Heuristic⟧ estimate</span></label>' +
          '<input type="range" id="mo-z" min="0" max="30" step="1" value="' + z + '" aria-label="Z, years until a cryptographically relevant quantum computer"></div>' +
        '<div class="es-out">' + banner(v) + '</div>' +
        '<p class="cb-note">This tells you <b>when</b> you are late. It never tells you <b>what</b> to deploy -- that ' +
        'answer depends on your protocol, your hardware and your threat model, not on three sliders. X and Y are your ' +
        'own numbers, not a claim of ours -- move them to match your actual estate. Z is not a measurement: the ' +
        'default (15) is the middle of the five horizons ' +
        '<a href="https://globalriskinstitute.org/publication/2024-quantum-threat-timeline-report/">the Global Risk ' +
        'Institute\'s Quantum Threat Timeline Report 2024</a> (Mosca &amp; Piani, 32 named experts) actually surveyed ' +
        '-- an opinion, not physics. For the full distribution behind that one guess, use <a href="#odds">the Odds ' +
        'above</a>; for the hardware-side resource estimates behind how far off a real machine looks, see ' +
        '<a href="bitcoin.html">the Bitcoin page</a>.</p>';
    }

    root.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'mo-x') x = +t.value;
      else if (t.id === 'mo-y') y = +t.value;
      else if (t.id === 'mo-z') z = +t.value;
      else return;
      activePreset = null;
      render();
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-preset]'); if (!b) return;
      var p = PRESETS.filter(function (p) { return p.id === b.dataset.preset; })[0];
      if (!p) return;
      x = p.x; activePreset = p.id;
      render();
    });

    render();
  };
})();

/* ── 8 · THE PROOF ────────────────────────────────────────────────────────
 * Everything above this point on the page is a measurement or a model. The
 * Size Cliff measures bytes, the Inventory reads artefacts, the Sequencer
 * models a schedule, the Odds models a distribution, the Harvest Clock is
 * arithmetic. Not one of them ever runs the cryptography end to end — so
 * "post-quantum cryptography works" has been an assertion on this page,
 * carried entirely by citation. This section runs it instead.
 *
 * Three acts, all of them in the visitor's own browser:
 *   1. A real ML-KEM-768 exchange, both sides, the two shared secrets
 *      compared byte for byte — then deliberately broken.
 *   2. A real ML-DSA-65 or SLH-DSA-128s signature over text the visitor
 *      supplies, followed by five attacks on it, each one expected to be
 *      rejected, and shown being rejected.
 *   3. What all of that costs in milliseconds on the machine reading the page.
 *
 * WHY THE TAMPERING IS THE POINT, AND THE HAPPY PATH IS NEARLY WORTHLESS.
 * Watching a signature verify proves almost nothing: a function that returned
 * true unconditionally would look identical on screen. The evidence lives in
 * the rejections. Flip one bit of a 3,309-byte signature, or one bit of the
 * message, and verification must fail. That asymmetry IS the security
 * property, and it is observable in a browser in about twenty milliseconds.
 * So this tool never shows an accept without also showing the refusals that
 * make it mean something.
 *
 * ONE FINDING WORTH THE WHOLE SECTION — and it is not what most people expect.
 * A tampered ML-KEM ciphertext does NOT raise an error. FIPS 203 specifies
 * implicit rejection: decapsulating a malformed ciphertext returns a
 * different shared secret, deterministically derived from a rejection value
 * stored inside the private key, and returns it silently. The KEM never says
 * "this was tampered with." Both sides simply end up holding different keys,
 * and the handshake dies later, somewhere that looks unrelated. Anyone
 * building on a KEM while expecting an exception is building on a
 * misunderstanding. Measured here rather than described: the tampered secret
 * comes back the same 32 bytes long, with roughly half its bits different.
 *
 * SECURITY, RESTATED BECAUSE THIS SECTION GENERATES REAL KEYS. The vendored
 * @noble/post-quantum tree is not independently audited and has no
 * side-channel protection. Every key here exists for one click and is dropped
 * on the next. Nothing typed into this section is transmitted — there is no
 * server to transmit it to.
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It demonstrates that this
 * implementation obeys the behaviour FIPS 203/204/205 specify, on this
 * machine, today. It says nothing about whether the schemes are secure — that
 * is a mathematical question no browser can settle — and nothing whatsoever
 * about whether the visitor's own systems are migrated. Both limits are
 * printed in the UI, not buried here.
 * ─────────────────────────────────────────────────────────────────────── */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var n = function (x) { return Number(x).toLocaleString('en-GB'); };

  /* performance.now() is deliberately coarsened by browsers as a Spectre
   * mitigation -- typically to 100us, and cross-origin-isolated pages get
   * better resolution than this one will. A single measurement of a 0.4ms
   * operation is therefore mostly quantisation noise, which is why nothing
   * below ever reports one: every timing is a median over many runs, after
   * warm-up runs that are thrown away. */
  var perf = function () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  };

  /* Bytes as hex for display. The full value is never the interesting part --
   * what matters is whether two of them are the same -- so we show enough to
   * make a difference obvious at a glance and say how many were hidden. */
  function hex(u8, take) {
    take = take || 12;
    var out = [];
    for (var i = 0; i < Math.min(take, u8.length); i++) out.push(('0' + u8[i].toString(16)).slice(-2));
    return out.join(' ') + (u8.length > take ? ' … (+' + n(u8.length - take) + ' more)' : '');
  }

  function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  /* How many bits actually changed between two equal-length buffers. Used on
   * the two shared secrets: a good KEM's rejection path is a hash, so a
   * one-bit change to the ciphertext should flip about half the output bits,
   * not a few. Reporting the real count makes that checkable instead of
   * claimed. */
  function bitsDiffering(a, b) {
    var count = 0;
    for (var i = 0; i < Math.min(a.length, b.length); i++) {
      var x = a[i] ^ b[i];
      while (x) { count += x & 1; x >>= 1; }
    }
    return count;
  }

  /* Flip exactly one bit, at a named index, on a copy. Returning the copy
   * rather than mutating matters: the caller still needs the untouched
   * original to verify against, and an in-place flip here was the obvious way
   * to write it and would have quietly made every subsequent check operate on
   * damaged input. */
  function flipBit(u8, byteIndex, bitIndex) {
    var copy = Uint8Array.from(u8);
    copy[byteIndex] ^= (1 << bitIndex);
    return copy;
  }

  /* Let the browser paint before a long synchronous operation. SLH-DSA-128s
   * signing takes seconds (measured, see the timing act) and blocks the main
   * thread solid while it runs -- without a yield here the "working…" state
   * would never appear on screen, and the page would look frozen with no
   * explanation. */
  function yieldToPaint() {
    return new Promise(function (resolve) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () { setTimeout(resolve, 0); });
      } else { setTimeout(resolve, 0); }
    });
  }

  var SIGALGS = {
    mldsa65: {
      label: 'ML-DSA-65', alg: function () { return ml_dsa65; },
      note: 'lattice — the likely default', slow: false,
      spec: 'FIPS 204', pk: 1952, sig: 3309,
    },
    slhdsa: {
      label: 'SLH-DSA-128s', alg: function () { return slh_dsa_sha2_128s; },
      note: 'hash-based — conservative, and slow', slow: true,
      spec: 'FIPS 205', pk: 32, sig: 7856,
    },
  };

  /* =========================================================================
   * ACT 1 — the exchange, run for real, then broken on purpose.
   * ====================================================================== */
  function runKem() {
    var t0 = perf();
    var k = ml_kem768.keygen();
    var tKeygen = perf() - t0;

    var t1 = perf();
    var e = ml_kem768.encapsulate(k.publicKey);
    var tEncap = perf() - t1;

    var t2 = perf();
    var received = ml_kem768.decapsulate(e.cipherText, k.secretKey);
    var tDecap = perf() - t2;

    /* The tamper: one bit, in one byte, of a 1,088-byte ciphertext. */
    var byteIndex = 7, bitIndex = 0;
    var tamperedCt = flipBit(e.cipherText, byteIndex, bitIndex);
    var tamperedResult, tamperThrew = null;
    try {
      tamperedResult = ml_kem768.decapsulate(tamperedCt, k.secretKey);
    } catch (err) {
      tamperThrew = err && err.message ? err.message : String(err);
    }

    return {
      pk: k.publicKey.length, sk: k.secretKey.length,
      ct: e.cipherText.length,
      sent: e.sharedSecret, received: received,
      agree: bytesEqual(e.sharedSecret, received),
      tKeygen: tKeygen, tEncap: tEncap, tDecap: tDecap,
      tamper: {
        byteIndex: byteIndex, bitIndex: bitIndex,
        before: e.cipherText[byteIndex], after: tamperedCt[byteIndex],
        threw: tamperThrew,
        result: tamperedResult,
        sameLength: tamperedResult ? tamperedResult.length === e.sharedSecret.length : null,
        equal: tamperedResult ? bytesEqual(tamperedResult, e.sharedSecret) : null,
        bitsChanged: tamperedResult ? bitsDiffering(tamperedResult, e.sharedSecret) : null,
        totalBits: e.sharedSecret.length * 8,
      },
    };
  }

  function renderKem(r) {
    if (r.error) {
      return '<p class="verdict bad">The exchange could not run in this browser: ' + esc(r.error) + '</p>';
    }
    var agreeRow = r.agree
      ? '<p class="verdict good">Both sides derived the same 32 bytes. That is the whole point of a key ' +
        'encapsulation mechanism, and it just happened in this tab.</p>'
      : '<p class="verdict bad">The two secrets do not match. That is a real failure — please report it via ' +
        'the corrections page, because it should be impossible.</p>';

    var t = r.tamper;
    var tamperBlock;
    if (t.threw) {
      /* Kept deliberately, even though it did not fire on any browser tested:
       * an implementation that throws here is not wrong, it is just not doing
       * what FIPS 203 describes, and silently rendering the expected story
       * instead of what happened is exactly the failure this page exists to
       * avoid. */
      tamperBlock = '<p class="verdict split">This implementation <b>threw</b> on the tampered ciphertext: ' +
        esc(t.threw) + '. FIPS 203 describes silent implicit rejection instead — worth knowing about ' +
        'whichever library you deploy, because the two behaviours need different error handling.</p>';
    } else {
      tamperBlock = '<p class="verdict split">No error. No exception. No warning. Decapsulation returned ' +
        (t.sameLength ? 'a perfectly well-formed 32-byte secret' : 'a secret of a different length') +
        ' — just <b>not the same one</b>: ' + n(t.bitsChanged) + ' of its ' + n(t.totalBits) +
        ' bits differ (' + Math.round((t.bitsChanged / t.totalBits) * 100) + '%, and about half is what a ' +
        'hash-derived rejection value should look like).</p>' +
        '<p class="cb-note">This is <b>implicit rejection</b>, and it is specified behaviour, not a bug: the ' +
        'private key carries a secret rejection value, and a ciphertext that fails its internal re-encryption ' +
        'check gets a secret derived from that instead. The receiver cannot tell the difference. Your handshake ' +
        'fails later, in a decrypt step that looks unrelated to the real cause. <b>If you are integrating a KEM ' +
        'and your error path waits for an exception, it will wait forever.</b></p>';
    }

    return '' +
      '<dl class="rows">' +
      '<dt>Public key</dt><dd>' + n(r.pk) + ' bytes <span class="cb-tag ok">measured</span></dd>' +
      '<dt>Private key</dt><dd>' + n(r.sk) + ' bytes</dd>' +
      '<dt>Ciphertext</dt><dd>' + n(r.ct) + ' bytes — what crosses the wire</dd>' +
      '<dt>Sender derived</dt><dd><code class="pf-hex">' + esc(hex(r.sent)) + '</code></dd>' +
      '<dt>Receiver derived</dt><dd><code class="pf-hex">' + esc(hex(r.received)) + '</code></dd>' +
      '</dl>' +
      agreeRow +
      '<p class="pf-step">Now break it. One bit, flipped in byte ' + n(t.byteIndex) + ' of ' + n(r.ct) +
      ' (0x' + ('0' + t.before.toString(16)).slice(-2) + ' → 0x' + ('0' + t.after.toString(16)).slice(-2) +
      '), and decapsulate again:</p>' +
      tamperBlock;
  }

  /* =========================================================================
   * ACT 2 — a signature over the visitor's own text, then five attacks.
   *
   * Every attack states, before it runs, what SHOULD happen. The table then
   * reports what DID happen and whether the two agree, so a row can fail
   * loudly rather than being quietly re-described as a success.
   * ====================================================================== */
  function runSignature(text, algId) {
    var conf = SIGALGS[algId] || SIGALGS.mldsa65;
    var alg = conf.alg();
    var msg = new TextEncoder().encode(text);
    if (!msg.length) msg = new TextEncoder().encode(' ');

    var t0 = perf();
    var k = alg.keygen();
    var tKeygen = perf() - t0;

    var t1 = perf();
    var sig = alg.sign(msg, k.secretKey);
    var tSign = perf() - t1;

    /* verify() returns a boolean for a well-formed input and throws for a
     * malformed one (wrong length). Both count as a rejection; they are
     * reported differently because they are different, and a caller has to
     * handle both. */
    function attempt(signature, message, publicKey) {
      try { return { accepted: alg.verify(signature, message, publicKey) === true, threw: null }; }
      catch (err) { return { accepted: false, threw: err && err.message ? err.message : String(err) }; }
    }

    var t2 = perf();
    var clean = attempt(sig, msg, k.publicKey);
    var tVerify = perf() - t2;

    /* Pick a flip site inside the message that a reader can actually see. */
    var msgByte = Math.min(msg.length - 1, Math.floor(msg.length / 2));
    var flippedMsg = flipBit(msg, msgByte, 0);
    var sigByte = Math.min(sig.length - 1, 100);
    var other = alg.keygen();

    var checks = [
      { id: 'clean', what: 'Nothing touched', detail: 'The signature exactly as produced.',
        expect: true, got: clean },
      { id: 'msgbit', what: 'One bit flipped in the message',
        detail: 'Byte ' + n(msgByte) + ' of ' + n(msg.length) + ': 0x' +
          ('0' + msg[msgByte].toString(16)).slice(-2) + ' → 0x' +
          ('0' + flippedMsg[msgByte].toString(16)).slice(-2) + charNote(msg[msgByte], flippedMsg[msgByte]),
        expect: false, got: attempt(sig, flippedMsg, k.publicKey) },
      { id: 'sigbit', what: 'One bit flipped in the signature',
        detail: 'Byte ' + n(sigByte) + ' of ' + n(sig.length) + ', message untouched.',
        expect: false, got: attempt(flipBit(sig, sigByte, 0), msg, k.publicKey) },
      { id: 'wrongkey', what: 'A different signer’s public key',
        detail: 'Valid signature, valid message, wrong identity — the impersonation case.',
        expect: false, got: attempt(sig, msg, other.publicKey) },
      { id: 'truncated', what: 'Signature truncated by one byte',
        detail: 'Malformed input rather than wrong input — the parser’s problem, not the maths’.',
        expect: false, got: attempt(sig.slice(0, sig.length - 1), msg, k.publicKey) },
    ];

    var passed = checks.filter(function (c) { return c.got.accepted === c.expect; }).length;

    return {
      conf: conf, msgLen: msg.length, pk: k.publicKey.length, sig: sig.length,
      tKeygen: tKeygen, tSign: tSign, tVerify: tVerify,
      checks: checks, passed: passed, total: checks.length,
      sigHex: hex(sig, 16),
    };
  }

  function charNote(before, after) {
    var printable = function (b) { return b >= 32 && b <= 126; };
    if (!printable(before)) return '';
    return ' — the character “' + String.fromCharCode(before) + '” became ' +
      (printable(after) ? '“' + String.fromCharCode(after) + '”' : 'unprintable');
  }

  function renderSignature(r) {
    if (r.error) return '<p class="verdict bad">Signing could not run in this browser: ' + esc(r.error) + '</p>';

    var rows = r.checks.map(function (c) {
      var ok = c.got.accepted === c.expect;
      var outcome = c.got.accepted ? 'ACCEPTED' : (c.got.threw ? 'REJECTED (refused to parse)' : 'REJECTED');
      return '<tr class="' + (ok ? '' : 'pf-bad') + '">' +
        '<td><b>' + esc(c.what) + '</b><br><span class="pf-detail">' + esc(c.detail) + '</span></td>' +
        '<td class="pf-expect">' + (c.expect ? 'must accept' : 'must reject') + '</td>' +
        '<td class="pf-got ' + (c.got.accepted ? 'yes' : 'no') + '">' + outcome + '</td>' +
        '<td class="pf-ok">' + (ok ? '✓' : '✗') + '</td>' +
      '</tr>';
    }).join('');

    var allGood = r.passed === r.total;
    var verdict = allGood
      ? '<p class="verdict good">' + r.passed + ' of ' + r.total + ' behaved exactly as ' + esc(r.conf.spec) +
        ' requires. One accept, four refusals — and the four refusals are the evidence.</p>'
      : '<p class="verdict bad">' + r.passed + ' of ' + r.total + ' behaved as specified. A row marked ✗ is a ' +
        'real finding — please <a href="corrections.html#report">report it</a>.</p>';

    return '' +
      '<dl class="rows">' +
      '<dt>Scheme</dt><dd>' + esc(r.conf.label) + ' <span class="cb-tag ok">' + esc(r.conf.spec) + '</span></dd>' +
      '<dt>Your message</dt><dd>' + n(r.msgLen) + ' bytes</dd>' +
      '<dt>Public key</dt><dd>' + n(r.pk) + ' bytes</dd>' +
      '<dt>Signature</dt><dd>' + n(r.sig) + ' bytes — <code class="pf-hex">' + esc(r.sigHex) + '</code></dd>' +
      '</dl>' +
      verdict +
      '<div class="pf-scroll"><table class="cb pf-table"><thead><tr>' +
      '<th scope="col">What was done to it</th><th scope="col">Should</th>' +
      '<th scope="col">Did</th><th scope="col">✓</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="cb-note">Signature sizes here are the ones <a href="#cliff">the Size Cliff</a> charges you for ' +
      'on the wire. This is the same operation, on your text, with the result checked instead of tabulated.</p>';
  }

  /* =========================================================================
   * ACT 3 — what it costs on the machine reading the page.
   *
   * The honest comparison problem: the post-quantum work below is synchronous
   * JavaScript, and the classical baseline is asynchronous native code behind
   * WebCrypto. Their measured times are not like for like -- the classical
   * figure carries promise scheduling the PQ figure does not, and the PQ
   * figure carries the interpreter's overhead the classical one does not.
   * Both distortions are stated in the UI, and the baseline is offered anyway,
   * because "will this slow us down" is the actual question and refusing to
   * answer it is worse than answering it with the caveat attached.
   * ====================================================================== */
  function medianOf(fn, runs, warmup) {
    var i;
    /* `warmup || 3` would have turned an explicit 0 into 3 -- and for SLH-DSA,
     * whose sign is measured in seconds, three discarded warm-up runs is ten
     * seconds of frozen tab that nobody asked for. Explicit undefined check. */
    warmup = (warmup === undefined) ? 3 : warmup;
    for (i = 0; i < warmup; i++) fn();               // JIT warm-up, discarded
    var samples = [];
    for (i = 0; i < runs; i++) {
      var t0 = perf();
      fn();
      samples.push(perf() - t0);
    }
    samples.sort(function (a, b) { return a - b; });
    return samples[Math.floor(samples.length / 2)];
  }

  function timePq(includeSlow) {
    var msg = new TextEncoder().encode('The quick brown fox jumps over the lazy dog. '.repeat(5));
    var out = [];

    var kk = ml_kem768.keygen();
    var ke = ml_kem768.encapsulate(kk.publicKey);
    out.push({ group: 'ML-KEM-768', op: 'keygen', ms: medianOf(function () { ml_kem768.keygen(); }, 25) });
    out.push({ group: 'ML-KEM-768', op: 'encapsulate', ms: medianOf(function () { ml_kem768.encapsulate(kk.publicKey); }, 25) });
    out.push({ group: 'ML-KEM-768', op: 'decapsulate', ms: medianOf(function () { ml_kem768.decapsulate(ke.cipherText, kk.secretKey); }, 25) });

    var dk = ml_dsa65.keygen();
    var dsig = ml_dsa65.sign(msg, dk.secretKey);
    out.push({ group: 'ML-DSA-65', op: 'keygen', ms: medianOf(function () { ml_dsa65.keygen(); }, 15) });
    out.push({ group: 'ML-DSA-65', op: 'sign', ms: medianOf(function () { ml_dsa65.sign(msg, dk.secretKey); }, 15) });
    out.push({ group: 'ML-DSA-65', op: 'verify', ms: medianOf(function () { ml_dsa65.verify(dsig, msg, dk.publicKey); }, 15) });

    if (includeSlow) {
      /* One run, not twenty-five. On the machine this was written against,
       * one SLH-DSA-128s signature took 2.9 SECONDS -- twenty-five would be a
       * minute and a quarter of frozen tab, and even three is nine seconds.
       * So: one run, and the UI says "single run" rather than hiding a
       * sample of one behind the same word "median" as the rest. */
      var sk = slh_dsa_sha2_128s.keygen();
      var ssig = slh_dsa_sha2_128s.sign(msg, sk.secretKey);
      out.push({ group: 'SLH-DSA-128s', op: 'keygen', ms: medianOf(function () { slh_dsa_sha2_128s.keygen(); }, 1, 0), small: true });
      out.push({ group: 'SLH-DSA-128s', op: 'sign', ms: medianOf(function () { slh_dsa_sha2_128s.sign(msg, sk.secretKey); }, 1, 0), small: true });
      out.push({ group: 'SLH-DSA-128s', op: 'verify', ms: medianOf(function () { slh_dsa_sha2_128s.verify(ssig, msg, sk.publicKey); }, 3, 1), small: true });
    }
    return out;
  }

  /* The classical baseline, via WebCrypto. Every step is guarded: Ed25519 is
   * not universally available, and a browser without it must lose one row, not
   * the whole act. */
  async function timeClassical() {
    var msg = new TextEncoder().encode('The quick brown fox jumps over the lazy dog. '.repeat(5));
    var out = [];

    async function medianAsync(fn, runs) {
      try {
        for (var w = 0; w < 2; w++) await fn();
        var s = [];
        for (var i = 0; i < runs; i++) { var t0 = perf(); await fn(); s.push(perf() - t0); }
        s.sort(function (a, b) { return a - b; });
        return s[Math.floor(s.length / 2)];
      } catch (e) { return null; }
    }

    try {
      var p256 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      var p256sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, p256.privateKey, msg);
      var st = await medianAsync(function () { return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, p256.privateKey, msg); }, 15);
      var vt = await medianAsync(function () { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, p256.publicKey, p256sig, msg); }, 15);
      if (st !== null) out.push({ group: 'ECDSA P-256', op: 'sign', ms: st, classical: true });
      if (vt !== null) out.push({ group: 'ECDSA P-256', op: 'verify', ms: vt, classical: true });
    } catch (e) { /* no P-256: drop the rows, keep the act */ }

    try {
      var x = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
      var y = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
      var dt = await medianAsync(function () {
        return crypto.subtle.deriveBits({ name: 'X25519', public: y.publicKey }, x.privateKey, 256);
      }, 15);
      if (dt !== null) out.push({ group: 'X25519', op: 'derive shared secret', ms: dt, classical: true });
    } catch (e) { /* no X25519 here: it is genuinely absent in some browsers */ }

    return out;
  }

  function fmtMs(ms) {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + ' s';
    if (ms >= 10) return ms.toFixed(0) + ' ms';
    if (ms >= 1) return ms.toFixed(1) + ' ms';
    return ms.toFixed(2) + ' ms';
  }

  function renderTiming(rows) {
    if (!rows.length) return '<p class="verdict bad">No timings could be taken in this browser.</p>';

    var body = rows.map(function (r) {
      var perSec = r.ms > 0 ? Math.round(1000 / r.ms) : null;
      return '<tr class="' + (r.classical ? 'pf-classical' : '') + '">' +
        '<td>' + esc(r.group) + (r.classical ? ' <span class="pf-detail">(native, async)</span>' : '') + '</td>' +
        '<td>' + esc(r.op) + '</td>' +
        '<td class="pf-num">' + fmtMs(r.ms) + (r.small ? ' <span class="pf-detail">single run</span>' : '') + '</td>' +
        '<td class="pf-num">' + (perSec !== null ? n(perSec) + '/s' : '—') + '</td>' +
      '</tr>';
    }).join('');

    var slow = rows.filter(function (r) { return r.group === 'SLH-DSA-128s' && r.op === 'sign'; })[0];
    var slowNote = slow
      ? '<p class="verdict split">SLH-DSA-128s signing took <b>' + fmtMs(slow.ms) + '</b> here. That is not a ' +
        'defect and it is not the browser being slow — it is what a hash-based signature costs. The usual ' +
        'objection to SLH-DSA is its 7,856-byte signature; the number above is the one that actually decides ' +
        'whether you can put it on a busy signing path. Verification, meanwhile, stayed fast — so this is a ' +
        'scheme you can afford to check constantly and can barely afford to produce.</p>'
      : '';

    return '' +
      '<div class="pf-scroll"><table class="cb pf-table"><thead><tr>' +
      '<th scope="col">Scheme</th><th scope="col">Operation</th>' +
      '<th scope="col">Median</th><th scope="col">Throughput</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      slowNote +
      '<p class="cb-note"><b>Read these as ceilings, and read the ratios, not the absolutes.</b> This is portable ' +
      'JavaScript on one main thread in your browser. A server runs a native, vectorised implementation and is ' +
      'substantially quicker. The classical rows are worse than that: WebCrypto is native code behind a promise, ' +
      'so their figures carry scheduling overhead these post-quantum rows do not, and the post-quantum rows carry ' +
      'interpreter overhead the classical rows do not. Neither distortion is small enough to ignore, so treat the ' +
      'classical numbers as orientation rather than a benchmark. What survives all of that: ML-KEM is cheap ' +
      'everywhere, ML-DSA is affordable, and SLH-DSA is a different order of thing.</p>';
  }

  SymbiQ.proof = {
    runKem: runKem, runSignature: runSignature, timePq: timePq,
    bytesEqual: bytesEqual, bitsDiffering: bitsDiffering, flipBit: flipBit,
    SIGALGS: SIGALGS,
  };

  /* Shell built once, three result regions updated independently. Re-rendering
   * the whole tool on every action would wipe the textarea the visitor is
   * typing in -- the same shape as the bug the Odds tool hit mid-drag on its
   * trust slider, and fixed there the same way. */
  SymbiQ.proof.mount = function (root, opts) {
    opts = opts || {};
    var algId = 'mldsa65';

    var DEFAULT_TEXT = 'Payment instruction 2026-08-10: release 250,000 EUR to supplier account on delivery.';

    root.innerHTML = '' +
      '<div class="pf-act">' +
        '<h3 class="pf-h">1 · The exchange, actually performed</h3>' +
        '<p class="pf-lead">ML-KEM-768: generate a keypair, encapsulate a secret to the public key, decapsulate ' +
        'it with the private one, and compare what the two sides ended up holding. Then flip a single bit of ' +
        'the ciphertext and watch what a broken exchange really looks like.</p>' +
        '<p><button type="button" class="preset pf-run" id="pf-kem-go">Run a real ML-KEM-768 exchange</button></p>' +
        '<div id="pf-kem-out"></div>' +
      '</div>' +

      '<div class="pf-act">' +
        '<h3 class="pf-h">2 · The signature, accepted — and refused</h3>' +
        '<p class="pf-lead">Put your own text in. It is signed in this tab, then attacked five ways. Four of ' +
        'those attacks must fail, and the failures are the only part that proves anything.</p>' +
        '<label class="pf-lab" for="pf-msg">Text to sign</label>' +
        '<textarea id="pf-msg" class="pf-ta" rows="2" spellcheck="false">' + esc(DEFAULT_TEXT) + '</textarea>' +
        '<p class="pf-chips">' +
          Object.keys(SIGALGS).map(function (id) {
            return '<button type="button" class="preset' + (id === algId ? ' on' : '') + '" data-alg="' + id + '">' +
              esc(SIGALGS[id].label) + '<em>' + esc(SIGALGS[id].note) + '</em></button>';
          }).join('') +
        '</p>' +
        '<p><button type="button" class="preset pf-run" id="pf-sig-go">Sign it, then try to break it</button></p>' +
        '<div id="pf-sig-out"></div>' +
      '</div>' +

      '<div class="pf-act">' +
        '<h3 class="pf-h">3 · What it costs on this machine</h3>' +
        '<p class="pf-lead">Not a specification table — the actual cost, measured here, on whatever you are ' +
        'reading this on. Medians over many runs, warm-up discarded.</p>' +
        '<p><button type="button" class="preset pf-run" id="pf-time-go">Time it on this machine</button> ' +
        '<button type="button" class="preset" id="pf-time-slow">Include SLH-DSA-128s (takes seconds)</button></p>' +
        '<div id="pf-time-out"></div>' +
      '</div>' +

      '<p class="cb-note pf-foot"><b>What this does and does not settle.</b> It shows this implementation behaving ' +
      'the way FIPS 203, 204 and 205 say it must, on your hardware, right now. It is not evidence that the schemes ' +
      'are secure — no browser can settle that — and it is not evidence that anything you own has been migrated. ' +
      'For that, start with <a href="#inventory">the Inventory</a>. Keys generated here are thrown away on the ' +
      'next click and never leave the tab.</p>';

    var kemOut = root.querySelector('#pf-kem-out');
    var sigOut = root.querySelector('#pf-sig-out');
    var timeOut = root.querySelector('#pf-time-out');

    function busy(el, msg) { el.innerHTML = '<p class="sc-wait pf-busy">' + esc(msg) + '</p>'; }

    root.addEventListener('click', function (ev) {
      var algBtn = ev.target.closest('button[data-alg]');
      if (algBtn) {
        algId = algBtn.dataset.alg;
        Array.prototype.forEach.call(root.querySelectorAll('button[data-alg]'), function (b) {
          b.classList.toggle('on', b.dataset.alg === algId);
        });
        return;
      }

      var btn = ev.target.closest('button');
      if (!btn) return;

      if (btn.id === 'pf-kem-go') {
        busy(kemOut, 'Generating a keypair and running the exchange…');
        yieldToPaint().then(function () {
          var r;
          try { r = runKem(); } catch (e) { r = { error: e && e.message ? e.message : String(e) }; }
          kemOut.innerHTML = renderKem(r);
        });
        return;
      }

      if (btn.id === 'pf-sig-go') {
        var ta = root.querySelector('#pf-msg');
        var text = ta ? ta.value : DEFAULT_TEXT;
        var conf = SIGALGS[algId];
        busy(sigOut, conf.slow
          ? 'Signing with ' + conf.label + '. This one genuinely takes several seconds — that is the finding, not a fault…'
          : 'Signing with ' + conf.label + ', then attacking it five ways…');
        yieldToPaint().then(function () {
          var r;
          try { r = runSignature(text, algId); } catch (e) { r = { error: e && e.message ? e.message : String(e) }; }
          sigOut.innerHTML = renderSignature(r);
        });
        return;
      }

      if (btn.id === 'pf-time-go' || btn.id === 'pf-time-slow') {
        var slow = btn.id === 'pf-time-slow';
        busy(timeOut, slow
          ? 'Timing everything including SLH-DSA-128s. The tab will freeze for a few seconds — that is the point…'
          : 'Timing ML-KEM-768 and ML-DSA-65 on this machine…');
        yieldToPaint().then(function () {
          var pq;
          try { pq = timePq(slow); } catch (e) { pq = []; }
          return timeClassical().then(function (cl) {
            timeOut.innerHTML = renderTiming(pq.concat(cl));
          }, function () {
            timeOut.innerHTML = renderTiming(pq);
          });
        });
      }
    });
  };
})();
