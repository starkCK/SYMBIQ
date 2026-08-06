/* SymbiQ — THE INVENTORY
 * =============================================================================
 * Paste the cryptographic artefacts you already have. This reads them — really
 * reads them, byte by byte, out of the DER — and tells you what you are holding,
 * what breaks, and in what order. Then it writes a CycloneDX 1.6 cryptographic
 * bill of materials, which is the artefact CISA has to define the minimum
 * elements of by roughly 19 December 2026 (Executive Order 14412, 180 days).
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
 * ========================================================================== */
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
    'MIIVjDCCCImgAwIBAgIUDwTHpjsRLj9tu6F3HnCGkSqjt6MwCwYJYIZIAWUDBAMS',
    'MBkxFzAVBgNVBAMMDnBxLmV4YW1wbGUuY29tMB4XDTI2MDgwNjAyNDU1MVoXDTI4',
    'MTAxNDAyNDU1MVowGTEXMBUGA1UEAwwOcHEuZXhhbXBsZS5jb20wggeyMAsGCWCG',
    'SAFlAwQDEgOCB6EAvhtA4FbobIeWPFNC58/Wotd45XpKo+FmBkCXX6TRhQjvcTtV',
    'kaefLwlUHM9+z8ZNyuwzE75b7Dl5izHz+4Abrs4b77X7HzUDXC8HvlevrVYHB0gB',
    'mX2Wb+vb2sNKJda5YwGVhqHE9idp9KAWgFMOWJ3LtEfK9oce/7b+uJUV7YwHgKnm',
    '3wQTiD4INrI7I5rH1rsBY2KFYassACROt9yaQxO62sJHISY2xUNDSNBfgxNQGsmf',
    'mGcMTS9KhrH2FvjlYfbW1IYJqziABHF7DZh+/lwn6LpFyWSPT0BU6XMdCchTUtsV',
    'jsME1w9+6oT2lIBRAiiB7xkDOz23Q2/LWSqZTZdul/0r/PDPY3DzvRUTF6th+HY1',
    '32IvLzPFOppflwlHSUl0fACKeM+y4bPTCpvXxu+69k/un/MVvcpK/W6eM7DOtcdR',
    'dd3wN2yOHUnSbAEDExFKRxWaK0jo1957+8t3etqOFxJfWnf8YseE8nlncIgx//A4',
    'W9QlU+ge7Oe1uOSTz54LkWC6/mhmgMt8yajI39Jgp1DFEuZX5XERlM7DuuIgH0KL',
    'C1pSuec/RSWPUVsYbsadRMdCOpadacxyOcpyzijrhZTzX5koBykqZK6cCFbP19eE',
    'sxygGnwIOclRpHTVpbdc90TnyiQE0DzO6Yk3Q9FWgh8THnAI5hUzdqQxDPTKn3F3',
    'M9uYMOF5xgW7b3XDm/4L5Vg4vPzWWmJXx5+TZyEqiRsToetUEGgHOKmbVfI0FUot',
    'MmfxKTpjwGqUBoUFk5AohItHzC4y6vGV/wKKIzddwGnOEewgY3T69CPcihGNT8c/',
    'oV2T34cYoHE7Mbee8rZf/cy/t/yyISAL7Ahto0AOlOP1RqfDcMA8VkxqG3xA7m3q',
    'iZm1zOQuGmJyW641QTnAj8haNv8VW2Yu2y6Q8c4lNEK1hlUwVaRp4JbMsxC4FouH',
    'QyzgHPkEvbIRQCtblvn7wbLNOuwciFXhTM2hnpwO31wuGR2rwo5bd+mldhibQhn6',
    'bBRINiK+k9NmMvFkZA7xQoc7MDWQ38qXFse7jfGGMMFALYZRsYvl3zYpUuM48qD+',
    'UIlf6izRXMGYcxsFTX7r/xDYQR1zRp7kVB83LK/k+aSFHdqb3Kdb7FlQGaxpUaR2',
    '3JhK2MUjDUQ4Rs9WZJMA1GOtoeK5Z7cEgBtRbHlTp00004slZ5piOF9j0kd9lJlo',
    '55ELndSgmCErXTfTgZppS3Q2SRMXPeOi10gpIvQ3YcMjkdAWnhKL5mZ0sYDx86g7',
    'oH9UMir45xmZOBxFxpl0ljW7a6K88IRzN42ckperH6fSZl4JVqVjWriR+Hfcs7Bp',
    'uaCFuv0RKBCYi6xNm/dSuiJjiPUdF7Wj9Gg1n+dyG9rlCLUcUVg0kQeWCKhYEe/t',
    'HhxFpchXLD08xrzvOex4QvrgomrQVPOyDN8yehn//BPbFpQBCfrRe1YNyDagwgcR',
    '9TsJ/N69zw6xXNmQAfcCnKbvrSGbIRFFqXeMyIljalBDLajumZdYeykwna7c6pec',
    'yhnWtvkx/d1xzslrrJts1/ejnYQxLQEJ2i0W1ORpePGBwqRxmSC2Inm67wpkRQPE',
    '8hrlkjyoVt2IUepNfMxq2h8tcglNA/SxptSaIXCHSFT2A9S1c8sLzY+cIChPTVhA',
    'QQLqSOe4yG+VykV3vw1Ft8MzhndY/oPmRLiU9/Xoh+RtEDGpSOh1YWryTXQPW4jz',
    'OzxMpXsbZ1X/UcUhkd5rsZ5PlKaSoO1NnCNSZ1ZZ2QAtYrqtggz4BkAb2Xuctjhv',
    'YRcNfBq/sDpbHaW7s5k3iibkvuZyhtIH2Cdcc6F1W5lnpJj9xpnrBSbx8ZCdBE6D',
    'X6QfVSQsvEc+5bduIb+0Dxza2aCz3rOPFMz+vtPjYhKdvVUBNsPwAf3lR7NZfg0G',
    '7oTlcfCtol7iEyjrT3yqRc8NHn1NgGK4UGXL6huKl7vH8ReNTM1n/eqkH7j0Omag',
    'X+kEZiKwOd+eubKu3kMXdD4gdHJ2G1s76x6YApfAkZpEw3Tov0d61AM8+QQb/GEY',
    'CVFhtVRCH5d64AsaH7TjFct2l7gr92JHsyZJDaZjFwaX5Q9Wh9nhdt5jrI6lcyTU',
    '9p5r4DN7OkjINxK3nrlroS0hPKOrgikRXCUTHgfUzkGNwCWPhXhNU0/9RNpszss8',
    'BSyFLyVd1baf3Dnu+CLskqujElxPDfwNxQ7WupCmd2EP+jKSHSGuPro+q1GQ8pKs',
    'btD3wcy+oBr8vRi67KqSPntJhi2jr6CGSAL+ir4TFUTp6lzRVfOxTZdybY+W6TVj',
    'XeLJHsojdQOIsirmdMvW0sf3Y1nm9wT9lIPbaWxRbyRBcOYXL/xGZSiXQbYtgAmS',
    'UXkSygyYunQPbG6IfAaZTWdIUkjWdd6Mj6ya0+cqA0fuK2yOAmXu8G2xp3Gw6igF',
    'tt+Fvpf8dHoCIYxSQ8jSRHritSs7RTChe1hqBpctlcA+xQXWJ6Pv1KaBSvRZPcHg',
    'ZBqmI32NIMzmlwpAYcehSj2So+w4HXWJvQNCSUxLYv6DxwC17ixfoGoltccLJ664',
    'x3Y2TxEIIIK2VhSy1RCT2Zwt0NP2cViQE/DlKX2j+GrZZD9hcjk4rl7eaGKjUzBR',
    'MB0GA1UdDgQWBBRvBr7tWHqRtqJ/KNAuQAgMAsdkrzAfBgNVHSMEGDAWgBRvBr7t',
    'WHqRtqJ/KNAuQAgMAsdkrzAPBgNVHRMBAf8EBTADAQH/MAsGCWCGSAFlAwQDEgOC',
    'DO4ABeUs5UOrm49398kn2UDSrsySfo/cWuqXmtRIQhzrfMX2yhSlPT7KlI2eqzy2',
    'Q8sx0PKqBvlMVDNWqVRNoCNV8AOSd6LF7rswRHB9h93h1WTbf1FXK/7RpmAY2tQB',
    '+sDgGKfM1FDpUhASaSDLGMeEGZbUBjxJMzZ9S7wy4+fVAuU8f7fSSCXjVC4QhXuq',
    'pG5AVAs6CRCRLg4J0DMpOdKd3vpA9blmiHqblaPxVddz+BQv5PqVfvYNXBZUaFgN',
    'dDT1Wccigmq2Yar/GrxnIEvXR4XKJ0Gp9V3d7ZotEgyEcBTOJT7e9hgP7JpcCnMu',
    '2N2fcnkhGvjPBe0bRgHWDf9umdxEF0ooFaBlZKLvpzDSu+1Fho9EE6bfqM0bpyxl',
    'HyZLGrzQ9V+7UMbj6aTGCaiCxVIa4E1kb/BdIGoRiBjtoLUHj1r8qqKZ4EwsmWGE',
    'X8agZd5QbWE8LNn8W4HwL36zPgcJkUJ8fbrego0OUv/ecrMmJ5K7EHEw2BluItSI',
    'G1x3lXIMOy4sq0Q67RDUAz6TxQpqdLlwqkKWNYPI5n8mQryX7rER6dhtoadLxWIM',
    'qqPi96t/fyMcro8Dgn2R9YiJfeTGbPe2IAZ6Ub0zJA420akZFo3+t4ZrczSyCsey',
    '/KkOpVf3/3J5ZCq1LDUYSxd1NZqOg5sWRGHb/NrlxJlC5FdtueI0YJeaQyjWphDX',
    'JxuIEuPGmV/thMrsLQu+K63sLStnhBqoh3MRzTSljmaMCH5S1hTzu5M/1qi3BAms',
    'PpowdVrjfpx1hcMDSk3KyBGeXvWLDR8++4Onh0QKj+lom3ilS+ketIJsGe449sWx',
    'XD3OwrTWpGPC6Fqf2XN7WSXmDjMKrfMMCloA3AqI35WJTgdPgUWEOGlNlQnwVIz0',
    'POyIxExqu792ZnRV/e+7qcwM7D6KK821WQ3CPqhq3Z+2g7iAU2PirjTSQLZHaC3H',
    '56YfxWBHvfO0k47PMVJsdwyeNr32n4Bzna8L2H4Rpc6kZ4aRFXQtVFqcKKm6P3o8',
    'xisbXW5duaWo0afwoz9WBd8YjtnsGFZjidzCH747zVpoKSYi+ec0KbCw1wgAJ6rR',
    'G9NWauHFqOJRL7GSchyOlmyFBZVyZljEt8n6Ejw1kkMKbwD8kfMFDxGLjfY0Ayjl',
    '4tfpvgIOA4vdmk3017uqBuiSjQ8RrUgUCfwJaNEGk8K6kY7s86ddTp3b4uMkOtjC',
    'pyT0veDjSiK52jiXdN4PMN/Pn5npsymG1FeaMQN4WXechIc8vaR/RfjhEO6EblC0',
    '/lJNWWEZg24QPs0fZQi3svnOPCvj1KEumXa/d1vLEaWGpUnGgdm+9ywphc6jTOuy',
    'ETzuuIaHbDr0qIibsQh98cC3j4gmMacKuzn7YTh0krCT0+QaLverAaVvYoxzaW+V',
    'f5ccPTgnFMlTeQt9Q7W4SK+5sjdmkADPagMxxkwVIdK6jXJniPKuKj7D+nrU8bU1',
    'UZLJFJ0d/vY/R9MjFcPqztqcfJ08XAVVjSOm4jOKXVmzdQLMOKtHQbrtLDOP2MRe',
    'uwUqr50MeseEH33pj3KQNjJuPlb5s9K4q4xKN07swhSMYEvzXn5yIhl+p0XAO1tC',
    'JxWpeZYD0m99M7Lwr3Ed4n1/5muuuNCCLbQgJ40kAsRieSf8REP3RcZOaeEhaVH0',
    'ev3mKtuNz6SRtomrzN1cknGlkxLvSI7R3uV+lEyK/IZk0j+HdCZATaD71S6oOkYR',
    'NP2uVZCnhb6QW2P6XdkNXHloSmaz9KdJfoAoLEFCdTcelOxG0WO0SQQZr0rkrZ61',
    'eMpQLpx/EHfN3SNWyn3sRPEtiQqQWnrB+UlxF/l9ldzWiwfenHmeDL69jDtmSGWE',
    'NceYBHfdHXUA7HC/ADHhsVWxf54eT3kP2PB2/5q0j+sXdsiMSJdpzo1ea2iVCu7j',
    'mombMXRdC/Wwsdrw29ILTvr0+GduysJRhjC+gks0EI8VpTJEPGdfITuJqn6IEHqT',
    'GL0WpXiVK1kB7mCViTp3wzP06sxP3virrFIYVWLvldRh1yi/IBncg7SsoV3suO1a',
    'z3OlnxHEOyF27eC6scIZ9eUWrW20g0Zf0tyLJuTlTCaMB7ZQzIirg7T2V5VfacW6',
    'sR0N8/BHtJLuui5Dei88w1Dmiqjpu6jjmQLojx4s6Tnpk+Klfc/d1J7f2Z0RMEj4',
    'UB5gp5ZXX8oxrzl21fmMelvYRTwUovsvGVtsVDUceWOxlsBVukLoTmdxvlorxbmF',
    'rp4naj1oRaqZ0UYaMQsyDMxYKkCij2r/SJhWOjSgf0tpHmstTXOtR+mZZieJVE0e',
    'C2s6IKp45pvfPsDS7IBAlCn836cL0/lhUqmMfENrj/isNOS4JQl5QmL+GXQzYq4f',
    'Im6O0F6coVCyKdZ6gMg/n+N1u96aMcr9Swd5yu6UIEFg/cBrRAHksThKqg0YGauS',
    'QdQkZo7bockb39uY5e9Lct0acBBhSKLed6n8tfDU0cnpKFBCOLIsT1rf3o8+E9tr',
    'p8cxEJr6GBcHcT0o45B6qOdglUUqiLaIEv0t94hnMIQYqgPYnVUjG3KUc3NEpnpx',
    'eozVoSbGhd29yGk2H9TG+oQln6A6RRRauUrcKM/6iD52191k2uBm3sXKRiyFvJv9',
    'zdBLn/B/D+8n+o3aZ/rkbwiSr8LYBx6iL1fG4sFkU/Yh+yii2F0fyjJXtxyXa2NE',
    'NkHXlDvwI4Yje2bQ1BVLmDlz9ACm2vXyX7+sensr8Au0OBZcoFjxAvd6vXM0ruc/',
    '4ZNGWxciQRSqT6sretB6fMRLNYESW/uT6R640sHq0+e6/SS5aX2rGegnI9S5ueHp',
    'R4g/AqbyPQsXhj+uQbA4xfmTETqiLYrEwOyXtxRfWnFMSuzuN9rRNxJPHPHpp3TO',
    '57hFQpjwPeeHZPjo13T8FOmN2+jf/LEOCi4ZqSZlIrn2ANHusm6jzIxMOQjdJDVy',
    'GENr90FCou214zFbU1jAZY6uAqSgTIrxU/DePjoIMHPut0UUY9lW2v56R3PCqztn',
    'XkhlkISvc/O8zN6Zox3TashsJVl8TxCkkoCbyK7c42spYRbiJxweRLnolXTFsDZK',
    'K0Wd8WBWJWa1FdY+exIgL7hqZ4H8EKg8N2iSROhpLyPLuHuW3aWho81ak6nR3yMo',
    'T7c13kQK2/S5Pdob2wRjqLd95pbDz0oF5EkVMgAdMNDFEmFZSu/KjCIo+IZpmdLY',
    'jnp62CJJqWdQ0h1Y89s8HtPInAx96lLyLoUqmbzhrSFIqa/wsXRPCHFEVHl10EAb',
    'sCbkC+LBKKaE2GnR8oEj3ZsnFwrUZycArr4BcwcTEFv6YaeXOCNHERmjYnMmg1ve',
    'ymmEaTvj/QvXvHwAw+5SS+KB0C5G2LWRrP7HH2fkLf1bfLkR5Skbasp8GxoXNH+m',
    'cW5+IOi43TirQiT+BgqcZss8SDnrKWMgG0R/IbfL/ac/lQm/WP2UZamwVTcDWf2u',
    '3Z4xS/Xfjs1BLPpMYnhBWDlw/xQsBR+72ZTdovcj8wYp9MQPWhUps4QfLxHKRJYc',
    'e6Q7/tUWdxtHRWQn4RW8hiTnUP0IGXUORYiV/QB8CIBr1wZ8AXy4zPQ0Mqlh7YAY',
    'lolME3symyQgUhJl4v62rt34miXkz5iaZCKHjtMzEJjtVzei/uKGx3l7FvEdyQgs',
    'vJ8szqp2MqL9GhNCB3mHbK5OBdgh8PVu1it6E7jq5wje/OvjIGlTg29Ewgk4eXI8',
    'is6YHdhwipta7GPFbNE36oS5hB92ZHc9IyTLYUatyODGGwC2ZyVWIXD/bHrMJOcO',
    'Nnh8a1279ZG6n3lHidTUybBtCqatz0tWCBmgkBYu/cwcM0x4oWbIQRSlx9hnj3sS',
    'rYrctgIVs/MUYicGvGEkvjwZSepbyjlyrq6qJVQGWZAJbnsvg6membwWRR20Pf4E',
    '2mykOKbCK50+csP1yEnrYw2p3KoCwz4pyNKaPhsOJoGo8Z0FgnybZxUTXuaxkQuS',
    '/KVK+4tdExgMC0bTmJy5+c4eCi1cfRvgyF7YJAXxiXxdhPg6NDuO5X92UhjZ5J2K',
    'IUto7lVD5yzy6eG1M50Otv7sf9goRr4VlA5eUgOrih+X5cEtVd/zINLNsHnr3DVI',
    '7FkkE7pS2RPuiH1kVe3ieZy2LR+//uCQZPMplDIqb6cj4abGXSYuf+2el0hPGc8K',
    'fstFWXtHPtK5o37xOKknN0uUjiPB3a/9QxLE5hKPnkVq5qamRKG/eqC9s53vo/gB',
    'f9wtIaj8U1RCKkXHSzhTMDih2VM811OLVJ4L0Uwo5aSnTY2QpnWmrf66CAdRCxpr',
    'bj5tKAXAtiUeUKUgvkU+7OV1uSPUFUA1kDfo6+i3kUNBvoMSFFZja4/E7A8RFxiQ',
    'oeANExuOnxCPlL/nBhtIaHKkq8P2K0pTiqTAAAAAAAAAAAAAAAAAAAAACA8UGSIo',
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
  };
})();
