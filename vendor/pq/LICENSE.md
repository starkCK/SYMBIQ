# Third-party code — @noble

The `.mjs` files in this directory are **not written by SymbiQ**. They are a
vendored, dependency-closed build of Paul Miller's `@noble` cryptography
libraries, fetched from jsDelivr's `+esm` endpoint and rewritten so every
import points at a sibling file here. `MANIFEST.json` records the exact upstream
URL and a SHA-256 of each file as fetched, so the tree is reproducible and
auditable rather than trusted.

The bundler strips comments, so the upstream licence headers did not survive
minification. They are restored here, which is what the MIT licence requires.

| Package | Version | Files |
|---|---|---|
| [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum) | 0.6.1 | `ml-kem.mjs`, `ml-dsa.mjs`, `slh-dsa.mjs` |
| [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) | 2.2.0 | `noble-hashes-*.mjs` |
| [`@noble/curves`](https://github.com/paulmillr/noble-curves) | 2.2.0 | `noble-curves-*.mjs` |

## MIT License

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Security note, restated because it matters

Upstream states plainly that the library **has not been independently audited**
(it was self-audited at 0.6.1, April 2026) and that there is **no protection
against side-channel attacks**. SymbiQ uses it as a *measuring instrument* — to
generate a key and read its byte length — and never to protect a secret. Every
key generated on `pqc.html` is discarded on the next render. Do not lift this
directory into anything that guards real data without reading upstream's own
security section first.

Verification of this tree lives in `_verify.html`: 28 checks against the byte
lengths fixed by FIPS 203, 204 and 205, plus encapsulate/decapsulate agreement
and signature accept-and-reject.
