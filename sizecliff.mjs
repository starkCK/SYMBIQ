/* SymbiQ — THE SIZE CLIFF
 * =============================================================================
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
 * =============================================================================
 */

import { ml_kem768, ml_kem1024 } from './vendor/pq/ml-kem.mjs';
import { ml_dsa44, ml_dsa65, ml_dsa87 } from './vendor/pq/ml-dsa.mjs';
import { slh_dsa_sha2_128s } from './vendor/pq/slh-dsa.mjs';

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
export async function compute(opts) {
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

export const OPTIONS = { KEX, SIG, MSS, INITCWND, MODEL: M };

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

export function mount(root, opts) {
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

