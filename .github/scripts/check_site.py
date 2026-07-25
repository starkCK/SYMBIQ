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
    return sorted(f for f in os.listdir(ROOT) if f.endswith(".js"))


def node_check(source, label):
    """Parse-check JS. `node --check` compiles without executing, so it is a
    pure syntax test -- no DOM, no side effects."""
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False,
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
            if node_check(fh.read(), f):
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
                if node_check(content, label):
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
    for href, tag in p.links:
        if href == "#" and tag == "a":
            placeholders.append(f"{f} has a dead href=\"#\"")
if placeholders:
    fail("placeholders", "; ".join(sorted(set(placeholders))[:8]))
else:
    ok("placeholders: no dead href=\"#\" and no FILL BEFORE LAUNCH markers")

# 6. .reveal IS JS-ONLY ----------------------------------------------------
# Hand-written class="reveal" is banned: nav.js is the sole thing allowed to add
# it, so that a stale or broken script can never leave content stuck at opacity 0.
bad_reveal = [f for f, (p, _) in pages.items() if p.reveal_in_html]
if bad_reveal:
    fail("reveal", "class=\"reveal\" hand-written in HTML (only nav.js may add it): "
         + ", ".join(bad_reveal))
else:
    ok("reveal: not hand-written in any page")

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
