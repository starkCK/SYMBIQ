#!/usr/bin/env python3
"""Ship guard for the SymbiQ public site.

Runs in CI on every push. Self-contained on purpose: the desk repo's sweep.py
is in a PRIVATE repo this workflow cannot see, so the public site carries its
own guard.

The check that matters most is SCRIPTS: on 2026-07-24 an unescaped apostrophe
in the prose "this game's whole budget" landed inside a single-quoted JS string
in journey.html. It threw SyntaxError, the whole inline script never ran, and
the Solver's Path was dead on the live site for a day. Nothing caught it --
not the math verification, not a manual console check (the preview pane
reports no errors for exactly this failure). A parser is the only reliable
witness, so one runs here on every push.

Exit code 0 = clean, 1 = at least one FAIL.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from html.parser import HTMLParser

# Root defaults to the repo, but may be overridden so CI can run the guard
# against a deliberately-broken copy and prove the checks actually fire.
ROOT = (sys.argv[1] if len(sys.argv) > 1
        else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

FAILS = []
WARNS = []
OKS = []


def fail(check, msg):
    FAILS.append(f"{check}: {msg}")


def warn(check, msg):
    WARNS.append(f"{check}: {msg}")


def ok(msg):
    OKS.append(msg)


class Page(HTMLParser):
    """Pull out the bits we assert on. HTMLParser rather than regex so that
    attribute quoting and stray '<' inside scripts don't produce phantom hits."""

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.ids = []
        self.links = []        # (attr_value, tag)
        self.scripts = []      # (type, src, content)
        self.reveal_in_html = []
        self._script_type = None
        self._script_src = None
        self._in_script = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.append(a["id"])
        cls = a.get("class") or ""
        if "reveal" in cls.split():
            self.reveal_in_html.append(cls)
        for key in ("href", "src"):
            if a.get(key):
                self.links.append((a[key], tag))
        if tag == "script":
            self._in_script = True
            self._script_type = (a.get("type") or "").lower()
            self._script_src = a.get("src")
            if self._script_src:
                self.scripts.append((self._script_type, self._script_src, ""))

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_script = False
            self._script_type = None
            self._script_src = None

    def handle_data(self, data):
        if self._in_script and not self._script_src and data.strip():
            self.scripts.append((self._script_type, None, data))


def html_files():
    return sorted(f for f in os.listdir(ROOT) if f.endswith(".html"))


def js_files():
    """Top-level .js and .mjs, plus every vendored tree under vendor/. The
    vendored files are third-party and minified, which is exactly why they
    should be parse-checked rather than assumed good. Generalised from pq-only
    on 2026-09-18 when vendor/supabase/ joined it."""
    out = sorted(f for f in os.listdir(ROOT) if f.endswith((".js", ".mjs")))
    vroot = os.path.join(ROOT, "vendor")
    if os.path.isdir(vroot):
        for pkg in sorted(os.listdir(vroot)):
            vend = os.path.join(vroot, pkg)
            if os.path.isdir(vend):
                out += sorted(os.path.join("vendor", pkg, f)
                              for f in os.listdir(vend) if f.endswith((".js", ".mjs")))
    return out


def node_check(source, label, module=False):
    """Parse-check JS. `node --check` compiles without executing, so it is a
    pure syntax test -- no DOM, no side effects.

    The temp file's EXTENSION decides how node parses it: a .js file is treated
    as CommonJS, where a top-level `import` is a syntax error. So ES modules
    must be written to .mjs or the guard fails valid code. This bit us on
    sizecliff.mjs and on pqc.html's inline <script type="module">."""
    with tempfile.NamedTemporaryFile("w", suffix=".mjs" if module else ".js",
                                     delete=False,
                                     encoding="utf-8") as fh:
        fh.write(source)
        tmp = fh.name
    try:
        r = subprocess.run([NODE, "--check", tmp],
                           capture_output=True, text=True)
        if r.returncode != 0:
            err = (r.stderr or "").strip().splitlines()
            detail = " / ".join(l.strip() for l in err[:4] if l.strip())
            fail("scripts", f"{label} does NOT parse -> {detail}")
            return False
        return True
    finally:
        os.unlink(tmp)


# --------------------------------------------------------------------------

NODE = shutil.which("node")

pages = {}
for f in html_files():
    with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
        raw = fh.read()
    p = Page()
    p.feed(raw)
    pages[f] = (p, raw)

if not pages:
    fail("setup", "no .html files found at repo root")

# 1. SCRIPTS PARSE ---------------------------------------------------------
if not NODE:
    warn("scripts", "node not on PATH -- syntax check SKIPPED (CI installs it)")
else:
    n = 0
    for f in js_files():
        with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
            if node_check(fh.read(), f, module=f.endswith(".mjs")):
                n += 1
    for f, (p, _) in pages.items():
        inline = [(t, c) for (t, s, c) in p.scripts if s is None]
        for i, (typ, content) in enumerate(inline):
            label = f"{f} inline#{i}"
            if typ == "application/ld+json":
                try:
                    json.loads(content)
                    n += 1
                except Exception as e:
                    fail("json-ld", f"{label} does not parse -> {e}")
            elif typ in ("", "text/javascript", "module"):
                if node_check(content, label, module=(typ == "module")):
                    n += 1
    ok(f"scripts: {n} script/JSON-LD blocks parse")

# 2. ASSET VERSIONS ARE UNIFORM -------------------------------------------
# Derived from the pages, never hardcoded: a stale hardcoded expectation once
# faked 14 failures. Missing the bump on some pages is the real recurring bug.
for asset in ("style.css", "nav.js", "games.js"):
    seen = {}
    for f, (p, _) in pages.items():
        # Parsed href/src only -- matching raw text also hits the asset's name
        # inside comments and prose, which is not a reference at all.
        for href, _tag in p.links:
            path, _, query = href.partition("?")
            if os.path.basename(path) != asset:
                continue
            m = re.fullmatch(r"v=(\d+)", query) if query else None
            seen.setdefault(m.group(1) if m else None, []).append(f)
    if not seen:
        continue
    if len(seen) > 1:
        detail = "; ".join(
            f"v={k or 'NONE'} on {len(v)} page(s): {', '.join(sorted(set(v))[:4])}"
            for k, v in sorted(seen.items(), key=lambda kv: -len(kv[1])))
        fail("asset-version", f"{asset} cache-buster is not uniform -> {detail}")
    else:
        v = next(iter(seen))
        n_refs = len(set(next(iter(seen.values()))))
        ok(f"asset-version: {asset} uniformly at v={v or 'none'} "
           f"on all {n_refs} page(s) that load it")

# 3. LINKS RESOLVE ---------------------------------------------------------
all_ids = {f: set(p.ids) for f, (p, _) in pages.items()}
missing_files, missing_anchors = [], []
for f, (p, _) in pages.items():
    for href, _tag in p.links:
        if href.startswith(("http://", "https://", "mailto:", "data:", "//")):
            continue
        path, _, frag = href.partition("#")
        path = path.split("?")[0]            # ignore ?v= cache-busters
        target = path or f
        if path:
            if not os.path.exists(os.path.join(ROOT, path)):
                missing_files.append(f"{f} -> {href}")
                continue
        if frag and target.endswith(".html"):
            if frag not in all_ids.get(target, set()):
                # Some anchors are mounted by JS at runtime (the Arcade opens
                # play.html#volcano itself), so this cannot be fatal.
                missing_anchors.append(f"{f} -> {href}")
if missing_files:
    fail("links", f"{len(missing_files)} link(s) point at files that do not exist: "
                  + "; ".join(missing_files[:6]))
else:
    ok("links: every internal file link resolves")
if missing_anchors:
    warn("anchors", f"{len(missing_anchors)} anchor(s) have no static id "
                    f"(may be JS-mounted): " + "; ".join(missing_anchors[:6]))

# 4. DUPLICATE IDS ---------------------------------------------------------
dupes = []
for f, (p, _) in pages.items():
    for i, c in Counter(p.ids).items():
        if c > 1:
            dupes.append(f"{f}#{i} x{c}")
if dupes:
    fail("ids", "duplicate id(s): " + "; ".join(dupes[:8]))
else:
    ok("ids: no duplicates on any page")

# 5. PLACEHOLDERS ----------------------------------------------------------
placeholders = []
for f, (p, raw) in pages.items():
    if "FILL BEFORE LAUNCH" in raw:
        placeholders.append(f"{f} still contains FILL BEFORE LAUNCH")
    # Any bracketed [FILL: ...] marker, not just the launch one. Six of these
    # sat live on privacy.html and terms.html for weeks -- a contact email, a
    # date, a copyright holder and a jurisdiction -- because this check only
    # ever looked for the exact string "FILL BEFORE LAUNCH". A legal page that
    # tells the reader to fill in its own blanks is the worst possible place
    # to leave one.
    for m in re.findall(r"\[FILL[^\]]*\]", raw):
        placeholders.append(f"{f} still contains {m}")
    for href, tag in p.links:
        if href == "#" and tag == "a":
            placeholders.append(f"{f} has a dead href=\"#\"")
if placeholders:
    fail("placeholders", "; ".join(sorted(set(placeholders))[:8]))
else:
    ok("placeholders: no dead href=\"#\" and no [FILL ...] markers")

# 6. .reveal IS JS-ONLY ----------------------------------------------------
# Hand-written class="reveal" is banned: nav.js is the sole thing allowed to add
# it, so that a stale or broken script can never leave content stuck at opacity 0.
bad_reveal = [f for f, (p, _) in pages.items() if p.reveal_in_html]
if bad_reveal:
    fail("reveal", "class=\"reveal\" hand-written in HTML (only nav.js may add it): "
         + ", ".join(bad_reveal))
else:
    ok("reveal: not hand-written in any page")

# 6b. EVERY PAGE CARRIES THE SAME NAV --------------------------------------
# The nav is generated for all 24 pages by tools/build_nav.py, which lives in
# the private desk repo -- so this repo's CI cannot re-run the generator to
# check for drift. It can do something almost as good and entirely local:
# every page's <nav> must be BYTE-IDENTICAL apart from the active-page markers.
# Stripping " navcat-cur" / " active" collapses all 24 to one block, whitespace
# included, so a hand-edit, a half-applied regeneration OR an indentation drift
# all show up here.
#
# Written 2026-09-04, after feasible.html and formalism.html sat one space out
# of indent for weeks: harmless in the render (measured), invisible in review,
# and caught only by a desk tool nobody had run. A drift that is merely cosmetic
# today is a merge conflict tomorrow, and the next real nav change would have
# landed on two pages that no longer matched the template.
NAV_RE = re.compile(r"<nav\b[^>]*>.*?</nav>", re.S)


def _nav_norm(block):
    """Strip ONLY the two active-page markers -- whitespace is compared exactly.

    An earlier draft of this check collapsed whitespace too, and so did not
    catch the very drift it was written for: two pages one space out of indent.
    All 24 nav blocks are byte-identical once the markers are removed, so the
    exact comparison costs nothing and catches both kinds of divergence.
    """
    return block.replace(" navcat-cur", "").replace(" active", "")


nav_groups = {}
nav_missing = []
for f in sorted(pages):
    body = open(os.path.join(ROOT, f), encoding="utf-8").read()
    m = NAV_RE.search(body)
    if not m:
        nav_missing.append(f)
        continue
    nav_groups.setdefault(_nav_norm(m.group(0)), []).append(f)

if nav_missing:
    fail("nav", "page(s) with no <nav> block: " + ", ".join(nav_missing))
elif len(nav_groups) > 1:
    biggest = max(nav_groups.values(), key=len)
    odd = [f for g in nav_groups.values() if g is not biggest for f in g]
    fail("nav", "%d page(s) carry a <nav> that differs from the other %d "
                "(ignoring only the active-page marker): %s -- re-run "
                "tools/build_nav.py in the desk repo"
         % (len(odd), len(biggest), ", ".join(odd)))
else:
    ok("nav: all %d pages carry a byte-identical nav (bar the active-page marker)" % len(pages))

# 7. data/today.json ------------------------------------------------------
# The homepage Question reads this file. It is rewritten every day by the
# content pipeline, which makes it the most frequently-changed file on the site
# and the easiest one to break -- and a malformed feed silently kills the single
# mechanic the operating plan calls sacred. Validate it like an API payload.
TODAY = os.path.join(ROOT, "data", "today.json")
if not os.path.exists(TODAY):
    warn("today.json", "data/today.json is absent (homepage falls back gracefully)")
else:
    try:
        with open(TODAY, encoding="utf-8") as fh:
            t = json.load(fh)
    except Exception as e:
        t = None
        fail("today.json", f"does not parse -> {e}")
    if t is not None:
        def need(cond, msg):
            if not cond:
                fail("today.json", msg)

        need(t.get("schema") == 1, f"schema must be 1, got {t.get('schema')!r}")
        need(isinstance(t.get("qnum"), int) and t["qnum"] >= 1,
             f"qnum must be a positive int, got {t.get('qnum')!r}")
        need(t.get("tier") in ("g", "y", "r"), f"tier must be g|y|r, got {t.get('tier')!r}")
        need(bool(str(t.get("signal", "")).strip()), "signal is empty")

        d = str(t.get("date", ""))
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            fail("today.json", f"date must be YYYY-MM-DD, got {d!r}")

        q = t.get("question") or {}
        need(bool(str(q.get("text", "")).strip()), "question.text is empty")
        need(bool(str(q.get("hint", "")).strip()), "question.hint is empty")
        opts = q.get("options")
        if not (isinstance(opts, list) and len(opts) == 4):
            fail("today.json", f"question.options must be exactly 4, got "
                               f"{len(opts) if isinstance(opts, list) else type(opts).__name__}")
        else:
            need(all(str(o).strip() for o in opts), "an option is blank")
            need(len(set(map(str, opts))) == 4, "two options are identical")
        ai_ = q.get("answerIndex")
        need(isinstance(ai_, int) and 0 <= ai_ <= 3,
             f"answerIndex must be 0-3, got {ai_!r}")
        ex = q.get("explain") or {}
        for k in ("g", "y", "r"):
            need(bool(str(ex.get(k, "")).strip()),
                 f"explain.{k} is missing or empty (all three tiers are required)")

        lat = t.get("lattice") or {}
        for k in ("f", "goal", "nextD"):
            need(isinstance(lat.get(k), (int, float)), f"lattice.{k} must be numeric")

        if not [f for f in FAILS if f.startswith("today.json")]:
            ok(f"today.json: schema 1 valid (q#{t['qnum']}, tier {t['tier']}, dated {d})")
        # Staleness is a content problem, not a build problem -- warn, never block
        # an unrelated push.
        try:
            import datetime
            age = (datetime.date.today() - datetime.date.fromisoformat(d)).days
            if age > 2:
                warn("today.json", f"the question feed is {age} days old "
                                   f"(dated {d}) -- the feed has gone stale")
        except Exception:
            pass

# 7b. data/qbank.json --------------------------------------------------------
# When today.json goes stale (>2 days) the homepage widget rotates a pool, one
# entry per day. An entry is {id, src}: src "archive" is a question we really
# asked (data/archive/, listed on archive.html); src "bank" is one written for
# the rotation that has never run (data/qbank/, deliberately NOT in the
# archive, because archive.html promises "every question we have ever asked").
# Bare strings are still read as archive ids. A broken pool degrades to the
# stale question, but a dangling id would 404 -- so validate it like the feed.
QBANK = os.path.join(ROOT, "data", "qbank.json")
if os.path.exists(QBANK):
    try:
        qb = json.load(open(QBANK, encoding="utf-8"))
    except Exception as e:
        qb = None
        fail("qbank.json", f"does not parse -> {e}")
    if qb is not None:
        anchor = qb.get("anchor", "")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(anchor)):
            fail("qbank.json", f"anchor must be YYYY-MM-DD, got {anchor!r}")
        pool = qb.get("pool")
        if not isinstance(pool, list) or not pool:
            fail("qbank.json", "pool must be a non-empty list of rotation entries")
            pool = []
        else:
            missing, bad = [], []
            for p in pool:
                if isinstance(p, str):
                    qid, src = p, "archive"
                elif isinstance(p, dict):
                    qid, src = p.get("id"), p.get("src", "archive")
                else:
                    bad.append(repr(p))
                    continue
                if src not in ("archive", "bank") or not qid:
                    bad.append(repr(p))
                    continue
                sub = "archive" if src == "archive" else "qbank"
                if not os.path.exists(os.path.join(ROOT, "data", sub, f"{qid}.json")):
                    missing.append(f"{qid} (data/{sub}/)")
            if bad:
                fail("qbank.json", f"malformed pool entries: {', '.join(bad)}")
            if missing:
                fail("qbank.json", f"pool entries with no file: {', '.join(missing)}")
        if not [f for f in FAILS if f.startswith("qbank.json")]:
            n_arch = sum(1 for p in pool if isinstance(p, str) or p.get("src", "archive") == "archive")
            ok(f"qbank.json: {len(pool)} question(s) in the stale-feed rotation "
               f"({n_arch} asked, {len(pool) - n_arch} written for the bank)")

# 8. CACHE-BUSTERS MATCH THE BYTES THEY STAND FOR --------------------------
# Section 2 proves every page agrees on a version. It cannot prove the version
# is the RIGHT one: edit tiers.js, leave it at ?v=3, and all 22 pages still
# agree -- on a number that now points browsers at a cached copy of the OLD
# file. That exact bug has shipped twice, once on JS and once on CSS, in a
# single session.
#
# data/asset-versions.json records the sha256 each ?v= stands for. Recompute
# and compare: if the bytes moved and the number did not, the build fails here
# instead of on a reader's stale cache. Regenerate with the desk repo's
# `python tools/bump_assets.py`, which does the bump and the rewrite for you.
MANIFEST = os.path.join(ROOT, "data", "asset-versions.json")
if not os.path.exists(MANIFEST):
    warn("cache-bust", "data/asset-versions.json is missing -- an edited asset "
                       "can still ship under its old ?v=. Run tools/bump_assets.py.")
else:
    try:
        recorded = json.load(open(MANIFEST, encoding="utf-8")).get("assets", {})
    except Exception as e:
        recorded = {}
        fail("cache-bust", f"data/asset-versions.json does not parse -> {e}")

    # What the pages actually ask for right now, parsed (never regex over prose).
    asked = {}
    for f, (p_, _) in pages.items():
        for href, _tag in p_.links:
            path, _, query = href.partition("?")
            path = path.lstrip("./")
            if not path.lower().endswith((".js", ".mjs", ".css")):
                continue
            if path.startswith(("http://", "https://", "//")):
                continue
            m = re.fullmatch(r"v=(\d+)", query) if query else None
            if m:
                asked.setdefault(path, set()).add(int(m.group(1)))

    stale, moved, n_ok = [], [], 0
    for path, rec in sorted(recorded.items()):
        full = os.path.join(ROOT, path)
        if not os.path.exists(full):
            stale.append(f"{path} is in the manifest but not in the repo")
            continue
        h = hashlib.sha256()
        with open(full, "rb") as fh:
            for chunk in iter(lambda: fh.read(65536), b""):
                h.update(chunk)
        digest = h.hexdigest()
        if digest != rec.get("sha256"):
            moved.append(path)
            continue
        want = rec.get("v")
        got = asked.get(path)
        if got is not None and got != {want}:
            stale.append(f"{path} is recorded at v={want} but the pages ask for "
                         f"v={','.join(str(x) for x in sorted(got))}")
            continue
        n_ok += 1

    if moved:
        fail("cache-bust", f"{len(moved)} asset(s) changed without a ?v= bump -- "
                           f"readers would be served the cached old copy: "
                           + ", ".join(moved[:6])
                           + ". Run `python tools/bump_assets.py` in the desk repo.")
    for line in stale:
        fail("cache-bust", line)
    if not moved and not stale:
        ok(f"cache-bust: all {n_ok} versioned asset(s) match the sha256 their ?v= stands for")

# 9. VENDORED CODE MATCHES ITS MANIFEST -------------------------------------
# Every directory under vendor/ carries a MANIFEST.json (written by the desk's
# tools/vendor_dep.py) that pins the package to one exact version and records,
# per file, sha256_local: the hash of the bytes AS THEY SIT ON DISK. That is
# the field checked here, and the distinction matters. vendor/pq/ spent from
# 2026-08-05 to 2026-09-18 with only sha256_upstream recorded, and its files
# had been edited after download (CDN import paths rewritten to local ones), so
# the recorded hash could never match and the manifest verified nothing. A
# checksum that cannot match cannot detect tampering. This check fails on a
# changed file, an unlisted script, or a package that is not pinned; it warns
# on a file that has no sha256_local yet, because that file is unverifiable
# rather than known-bad.
VROOT = os.path.join(ROOT, "vendor")
if os.path.isdir(VROOT):
    v_checked, v_unverifiable = 0, []
    for pkg in sorted(os.listdir(VROOT)):
        vdir = os.path.join(VROOT, pkg)
        if not os.path.isdir(vdir):
            continue
        mpath = os.path.join(vdir, "MANIFEST.json")
        if not os.path.exists(mpath):
            fail("vendor", f"vendor/{pkg}/ has no MANIFEST.json -- unrecorded third-party code")
            continue
        try:
            man = json.load(open(mpath, encoding="utf-8"))
        except Exception as e:
            fail("vendor", f"vendor/{pkg}/MANIFEST.json does not parse -> {e}")
            continue
        pkg_id = str(man.get("package", ""))
        if "@" not in pkg_id.lstrip("@"):
            fail("vendor", f"vendor/{pkg}: package {pkg_id!r} is not pinned to an exact version")
        listed = set()
        for entry in man.get("files", []):
            local = entry.get("local", "")
            listed.add(local)
            fpath = os.path.join(vdir, local)
            if not os.path.exists(fpath):
                fail("vendor", f"vendor/{pkg}/{local} is in the manifest but missing from disk")
                continue
            want = entry.get("sha256_local")
            if not want:
                v_unverifiable.append(f"vendor/{pkg}/{local}")
                continue
            h = hashlib.sha256()
            with open(fpath, "rb") as fh:
                for chunk in iter(lambda: fh.read(65536), b""):
                    h.update(chunk)
            if h.hexdigest() != want:
                fail("vendor", f"vendor/{pkg}/{local} CHANGED since it was recorded "
                               f"(on disk {h.hexdigest()[:12]}, manifest {want[:12]}) -- "
                               f"if deliberate, re-run tools/vendor_dep.py in the desk repo")
            else:
                v_checked += 1
        # Any script in the directory that the manifest does not list is
        # exactly the thing this check exists to catch.
        for name in sorted(os.listdir(vdir)):
            if name.endswith((".js", ".mjs")) and name not in listed:
                fail("vendor", f"vendor/{pkg}/{name} is a script the manifest does not list")
    if v_unverifiable:
        warn("vendor", f"{len(v_unverifiable)} vendored file(s) have no sha256_local and cannot be "
                       f"verified: {', '.join(v_unverifiable[:4])} -- run "
                       f"`python tools/vendor_dep.py --backfill` in the desk repo")
    if not [f for f in FAILS if f.startswith("vendor")]:
        ok(f"vendor: {v_checked} vendored file(s) match the sha256 recorded for them")

# --------------------------------------------------------------------------
# 10. core.js -- the single copy of esc / reduced / store (plan 24 §2.2)
#
# Three rules, each replacing a thing a person used to have to remember:
#
#   a) every page loads core.js, FIRST, and NOT deferred. Ordering here is
#      not document order: a classic script runs at parse time and beats
#      every deferred script on the page. Four core.js consumers on this
#      site (scene.js, missions.js, coherence.js, feasible-tools.js) load
#      without `defer`, so a deferred core.js loses the race and they throw.
#      That exact bug shipped for the length of one verifier run.
#   b) no site script re-declares its own esc(). Twelve did, and three of
#      the twelve were weaker than the rest -- which is why the escaping
#      guarantee used to require auditing 300 call sites instead of reading
#      one function.
#   c) no site script reads the OS reduced-motion query directly. SymbiQ has
#      its own "Reduce motion" switch; ten of twelve motion files ignored it
#      and kept their rAF loops running. core.reduced() reads both.
# --------------------------------------------------------------------------
CORE_TAG = re.compile(r'<script\s+src="core\.js[^"]*"([^>]*)>')
ANY_SRC = re.compile(r'<script\s+src="([^"]+)"([^>]*)>')

core_ok = 0
for fname in pages:
    html = pages[fname][1]
    tags = ANY_SRC.findall(html)
    if not tags:
        continue
    first_src, first_attrs = tags[0]
    if not CORE_TAG.search(html):
        fail("core", f"{fname} does not load core.js -- run "
                     f"`python tools/apply_core.py` in the desk repo")
    elif not first_src.startswith("core.js"):
        fail("core", f"{fname} loads {first_src} before core.js; core.js must be "
                     f"the first script on the page")
    elif "defer" in first_attrs:
        fail("core", f"{fname} loads core.js with `defer` -- a classic script "
                     f"(save.js, games.js, scene.js, missions.js, coherence.js, "
                     f"feasible-tools.js) would run before it and throw")
    else:
        core_ok += 1

for f in js_files():
    name = os.path.basename(f)
    if name == "core.js" or "vendor" in f.replace("\\", "/"):
        continue
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    if re.search(r"function\s+esc\s*\(", src):
        fail("core", f"{name} declares its own esc() -- use window.SymbiQ.core.esc "
                     f"so the escaping guarantee stays one function")
    if re.search(r"matchMedia\s*\(\s*'\(prefers-reduced-motion", src):
        fail("core", f"{name} reads the OS reduced-motion query directly -- use "
                     f"window.SymbiQ.core.reduced(), which also honours SymbiQ's "
                     f"own Reduce-motion switch")

if not [f for f in FAILS if f.startswith("core")]:
    ok(f"core: core.js loads first and undeferred on {core_ok} pages; "
       f"no duplicate esc(), no OS-only motion check")

# --------------------------------------------------------------------------
# 11. games.js is 336 KB, the largest file the site ships. play.html and
# journey.html ARE the games and load it outright; the three explainer pages
# that host a single cabinet load it on approach instead (2026-09-21), via a
# <script> whose unrecognised `type` stops the browser fetching it.
#
# That tag is inert, so if the inline loader beside it is ever deleted or
# renamed, nothing errors -- the widget just silently stops existing, on a page
# whose prose introduces it. Which is exactly the class of defect a reader
# reports and a checker should have caught, so: an inert tag must be paired
# with a loader that names it, and a page that mounts a cabinet must carry one
# of the two arrangements.
LAZY_TYPE = "text/symbiq-lazy"
games_eager, games_lazy = [], []
for fname, (p, raw) in pages.items():
    tags = [(a_type, src) for a_type, src, _ in p.scripts
            if src and src.split("?")[0] == "games.js"]
    # The exact invariant, not a guess from element ids: a page that reaches
    # for the module has to be a page that loads it. (Several pages use an
    # unrelated `*-mount` host, so matching on that name would be wrong.)
    uses = "SymbiQ.games" in raw
    if not tags:
        if uses:
            fail("games", f"{fname} uses SymbiQ.games but never loads games.js")
        continue
    if len(tags) > 1:
        fail("games", f"{fname} loads games.js {len(tags)} times")
        continue
    a_type, _src = tags[0]
    if not a_type:
        games_eager.append(fname)
        continue
    if a_type != LAZY_TYPE:
        fail("games", f'{fname} loads games.js with type="{a_type}" -- the browser '
                      f'will not run that. Use no type (eager) or "{LAZY_TYPE}".')
        continue
    games_lazy.append(fname)
    # Inert: the loader beside it is the only thing that will ever fetch it.
    if 'id="games-src"' not in raw:
        fail("games", f"{fname} has an inert games.js tag with no id=\"games-src\" "
                      f"for its loader to find")
    if "getElementById('games-src')" not in raw:
        fail("games", f"{fname} has an inert games.js tag that nothing loads -- "
                      f"the widget would silently never appear")
    if "loadScript" not in raw:
        fail("games", f"{fname} has an inert games.js tag but no loadScript call")
    # The host the loader names must actually exist in the page.
    for host_id in set(re.findall(r"getElementById\('([a-z-]+-mount)'\)", raw)):
        if f'id="{host_id}"' not in raw:
            fail("games", f"{fname}'s loader mounts into #{host_id}, which is not on the page")
    # The reserved height is what stops the page jumping under a fast scroller.
    if "minHeight" not in raw:
        fail("games", f"{fname} mounts a game on approach without reserving its "
                      f"height -- the page will jump when it lands")

if not [f for f in FAILS if f.startswith("games")]:
    ok(f"games: games.js eager on {len(games_eager)} page(s), "
       f"loaded on approach with a paired loader on {len(games_lazy)}")

# --------------------------------------------------------------------------
# 12. innerHTML-must-esc(), the companion S3-stage-2 rule plan 24 asks for
#     ("a check_site.py rule that fails any innerHTML assignment
#     concatenating a bare identifier not wrapped in esc()") -- built,
#     calibrated against the real 40-file corpus, and deliberately shipped
#     as ADVISORY (a WARN), not a FAIL, for a reason worth recording so a
#     future session does not re-derive it and does not "fix" it into a
#     FAIL either:
#
#     A literal "flag every bare identifier" rule was tried first and found
#     ~100 hits, all of them safe (NS, EPOCHS, pct, cls, out, html -- local
#     constants and accumulators the plan's own S7 audit already traced and
#     cleared). A narrower "flag .map() calls with zero esc() in the same
#     statement" rule was tried next and still found 12, still all safe
#     (LV/HOLES/BOARDS/CORR/DIST -- this codebase's own convention for
#     hardcoded, author-written game-data tables, mapped straight into HTML
#     with no external content anywhere in them). Even the narrowest version
#     -- flag known Supabase/external field NAMES (handle, bio, note,
#     rationale, why, question, reading, quote, raw_url, raw_quote,
#     why_open) appearing unescaped -- still found two: games.js's Max-Cut
#     district object carries its own `note` field, which is this
#     codebase's own authored flavour copy, not a database column that
#     happens to share the name.
#
#     Conclusion: this codebase's actual escaping risk is not "a bare
#     identifier" or "a .map() without esc()" -- both are its dominant SAFE
#     pattern, used for hardcoded game data everywhere. The field-name
#     signal is the only one with a plausible real positive (a NEW call
#     site rendering a genuinely external field), so that is what ships,
#     as a WARN: loud enough to make a human look, never loud enough to
#     block a page that reused `note` for a level's own flavour text.
# --------------------------------------------------------------------------
RISKY_FIELDS = ("handle", "bio", "rationale", "raw_url", "raw_quote", "why_open",
                "why", "question", "reading", "quote", "note")
RISKY_TERM = re.compile(
    r"\.(?:" + "|".join(RISKY_FIELDS) + r"|value)\b")
ESC_CALL = re.compile(r"\besc\s*\(")

# Verified-safe as of 2026-09-22, each checked against the real source, not
# guessed: Max-Cut's district copy (a hardcoded flavour-text field that
# happens to share a name with a real Supabase column); the Bottleneck's
# `solve()` result (a computed profit number, run through fmt(), not text);
# a static English-copy lookup table (CAP_COPY = {question: '...', game:
# '...'} a few lines above its use, nothing dynamic in the key). Keyed on
# the exact statement text so a genuine future edit re-triggers review
# rather than silently inheriting the pass.
ESC_ALLOW = {
    ("games.js", "d.note"),
    ("feasible-tools.js", "sol.value"),
    ("forms.js", "CAP_COPY.question"),
}


def _statement_at(src, start, budget=1500):
    """Same bracket/string-aware scan as bump_assets' cousins: the RHS of an
    assignment up to its top-level terminating ';'. This is NOT a real JS
    tokenizer -- it does not know a regex literal's '/' from a division, so
    a quote character inside something like /"/g is misread as opening a
    string and can desync the whole scan (found live: it ran 17,500 chars
    past the real statement on games.js's share-link panel, which builds its
    URL with url.replace(/"/g, '&quot;')). Real innerHTML statements in this
    codebase top out at a few hundred characters, so budget is generous; if
    no terminator turns up inside it, the scan is untrustworthy and returns
    None rather than a wrong line number -- a missed check is safer than a
    misleading one."""
    depth, i, n, instr, esc = 0, start, len(src), None, False
    while i < n:
        if i - start > budget:
            return None
        c = src[i]
        if instr:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == instr:
                instr = None
            i += 1
            continue
        if c in ("'", '"', "`"):
            instr = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth < 0:
                return src[start:i]
        elif c == ";" and depth == 0:
            return src[start:i]
        i += 1
    return src[start:i]


esc_hits = 0
for f in js_files():
    name = os.path.basename(f)
    if "vendor" in f.replace("\\", "/"):
        continue
    src = open(os.path.join(ROOT, f), encoding="utf-8").read()
    for m in re.finditer(r"\.innerHTML\s*\+?=(?!=)", src):
        start = m.end()
        while start < len(src) and src[start] in " \t\n\r":
            start += 1
        rhs = _statement_at(src, start)
        if rhs is None:
            continue
        for term_m in RISKY_TERM.finditer(rhs):
            # The dotted access itself, e.g. "d.note" or "row.value".
            pre = rhs[:term_m.start()]
            recv_m = re.search(r"([A-Za-z_$][\w$]*)$", pre)
            recv = recv_m.group(1) if recv_m else "?"
            term_text = recv + term_m.group(0)
            if (name, term_text) in ESC_ALLOW:
                continue
            # Wrapped in esc(...) right around this exact term -- not flagged.
            window = rhs[max(0, term_m.start() - 40):term_m.end() + 2]
            if ESC_CALL.search(window):
                continue
            line = src.count("\n", 0, start + term_m.start()) + 1
            esc_hits += 1
            warn("innerHTML-esc",
                 f"{name}:{line} renders `{term_text}` (a name plan-24 flags as "
                 f"externally-sourced) without an esc() nearby -- if this is "
                 f"real user/DB content it needs escaping; if it is authored "
                 f"copy, add (\"{name}\", \"{term_text}\") to ESC_ALLOW with why")

if esc_hits == 0:
    ok("innerHTML-esc: no unescaped occurrence of a known external field name "
       f"({', '.join(RISKY_FIELDS)}, .value) outside the reviewed allowlist")

# --------------------------------------------------------------------------
print("=" * 66)
print(f"SymbiQ site guard -- {len(pages)} pages, {len(js_files())} js files")
print("=" * 66)
for line in OKS:
    print(f"  PASS  {line}")
for line in WARNS:
    print(f"  WARN  {line}")
for line in FAILS:
    print(f"  FAIL  {line}")
print("=" * 66)
if FAILS:
    print(f"{len(FAILS)} FAILURE(S) -- not fit to ship.")
    sys.exit(1)
print("ALL CLEAR" + (f" ({len(WARNS)} warning(s))" if WARNS else ""))
