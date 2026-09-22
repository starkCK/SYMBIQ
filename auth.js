/* SymbiQ, accounts (L1). Email magic-link only for now; no GitHub OAuth
 * yet (that needs a separate GitHub OAuth App, a later, optional step).
 *
 * The account control (2026-08-28 redesign) is a small circular button in
 * the nav -- a person icon signed out, the account's own initial signed in
 * -- that opens a popover on click. It's a <details class="navcat"> like
 * the five category menus beside it, so nav.js's existing dropdown
 * coordination (one open at a time, outside-click and Escape close it)
 * applies for free; nothing there had to change.
 *
 * PROGRESSIVE ENHANCEMENT, same rule as nav.js/tiers.js: `#sq-account`
 * ships `hidden` in every page's nav, and this only clears that once the
 * project is actually configured. If supabase-config.js is missing or
 * blank, the button simply never appears -- nothing else on the page
 * depends on it, and no page is worse off than it was before L1.
 * `#sq-auth` is the popover's content div, inside the `<details>`.
 *
 * On sign-in, this hands the session to SymbiQ.save.connectRemote() so
 * local progress starts mirroring to the account. On sign-out, it calls
 * disconnectRemote() -- local storage keeps working exactly as it always did.
 *
 * ---------------------------------------------------------------------------
 * THE CLIENT IS LOADED ON DEMAND (plan 24 SS7.2, done 2026-09-21).
 *
 * vendor/supabase/supabase.js is 218 KB -- 21% of the bytes on a page, and
 * until now every visitor downloaded it on all 26 pages whether or not they
 * ever signed in. Almost nobody does: a reader with no session has nothing
 * for it to do but sit in memory.
 *
 * So: if localStorage holds a Supabase session, the library is fetched
 * immediately and everything below runs exactly as it always did -- the
 * signed-in path is the old path, step for step. If there is no session, the
 * library is not fetched at all. `ensure()` fetches it later, at the first
 * moment something actually needs it:
 *   - the reader opens the account popover (prefetch on intent), or
 *   - they focus or submit the sign-in form, or
 *   - ledger.js opens a claim's forecast panel and needs to read the crowd.
 *
 * The contract three modules (ledger.js, leaderboard.js, frontier.js) rely on
 * is preserved, and is now stated rather than implied:
 *   - `window.SymbiQ.auth` exists from the moment this file executes, not
 *     from whenever a network fetch resolves.
 *   - `symbiq:authchange` still fires exactly once for the initial state and
 *     again on every change. With no stored session it fires SOONER than it
 *     used to (at DOMContentLoaded, not after two round trips), which is why
 *     the announce is deferred by a task -- every module registers its
 *     listener during DOMContentLoaded, and the event must land after them.
 *   - `auth.client` stays null until the library is really loaded, so the
 *     existing `!auth.client` guards keep meaning what they meant.
 *   - `auth.ready` is the new "the signed-in/out answer is known" flag, for
 *     callers that want the answer but not the library.
 *
 * API: window.SymbiQ.auth = { client, ready, getUser(), signOut(), ensure() }
 *      ensure() -> Promise<client|null>, null if unavailable. Safe to call
 *      any number of times; the library is fetched at most once.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  var esc = window.SymbiQ.core.esc;   /* plan 24 SS2.2 -- one copy, in core.js */

  var client = null;
  var currentUser = null;
  var loadPromise = null;
  var mount = null, wrap = null, avatar = null;

  /* Exposed synchronously, before any network work, so the modules that
     consume it can ask questions without racing a fetch. */
  var API = {
    client: null,
    ready: false,
    getUser: function () { return currentUser; },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    ensure: ensure
  };
  window.SymbiQ.auth = API;

  function configured() {
    return !!(window.SymbiQ.SUPABASE_URL && window.SymbiQ.SUPABASE_ANON_KEY);
  }

  /* The key supabase-js will itself use for the persisted session:
     `sb-${hostname.split('.')[0]}-auth-token`. Reading it costs nothing and
     answers the only question that decides whether the 218 KB is worth
     fetching up front. If that shape ever changes upstream the worst case is
     that a signed-in reader takes the lazy path and the library arrives a
     moment later -- they still end up signed in, because onAuthStateChange
     reads the same storage once the client exists. */
  function hasStoredSession() {
    try {
      var host = new URL(window.SymbiQ.SUPABASE_URL).hostname.split('.')[0];
      return !!localStorage.getItem('sb-' + host + '-auth-token');
    } catch (e) { return false; }
  }

  /* plan 24 SS2.2 again: this used to be auth.js's own copy. core.loadScript
     is the same thing, memoised per URL, and shared with the pages that mount
     a game on demand. */
  var loadScript = window.SymbiQ.core.loadScript;

  /* Vendored, pinned and hashed -- NOT a CDN URL, and this matters.
   *
   * Until 2026-09-18 this line read
   *     https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
   * which is a floating tag: `@2` resolves to whatever the newest 2.x is at
   * the moment a reader loads the page, so the bytes being executed were
   * never the bytes anyone reviewed. No Subresource Integrity hash was
   * possible either, because a hash pinned to a floating tag breaks on every
   * patch release. This script runs on all 26 pages with full DOM access and
   * holds the sign-in session, so a compromised upstream package would have
   * owned every visitor.
   *
   * Now it is site/vendor/supabase/supabase.js -- @supabase/supabase-js
   * pinned to one exact version, with its sha256 recorded in
   * vendor/supabase/MANIFEST.json and checked by
   * `python tools/vendor_dep.py --verify`. Same origin, no third party in the
   * request path, and an upgrade is a reviewable commit rather than something
   * that happens to readers overnight. This follows the pattern vendor/pq/
   * already set for the post-quantum library.
   */
  function ensure() {
    if (loadPromise) return loadPromise;
    if (!configured()) { loadPromise = Promise.resolve(null); return loadPromise; }
    loadPromise = loadScript('vendor/supabase/supabase.js?v=2116')
      .then(function () {
        if (!window.supabase || !window.supabase.createClient) throw new Error('supabase-js did not load');
        client = window.supabase.createClient(window.SymbiQ.SUPABASE_URL, window.SymbiQ.SUPABASE_ANON_KEY);
        API.client = client;
        watch();
        return client;
      })
      .catch(function (err) {
        try { console.warn('SymbiQ auth: not available', err); } catch (e) {}
        return null;   /* stays null for this page load, same as it always did */
      });
    return loadPromise;
  }

  // Keeps the trigger button in sync with mount's content: the icon when
  // signed out, the account initial once signed in -- so the "you're signed
  // in" state is visible without opening the popover at all, which is the
  // actual "have a profile" ask this answers.
  function setTrigger(signedIn, label) {
    wrap.classList.toggle('signed-in', signedIn);
    var summary = wrap.querySelector('summary');
    if (summary) summary.setAttribute('aria-label', label);
  }

  function renderSignedOut(status) {
    mount.innerHTML =
      '<form id="sq-auth-form" class="sqform sq-auth-form">' +
        '<input type="email" id="sq-auth-email" placeholder="you@example.com" required aria-label="Email for a sign-in link">' +
        '<button type="submit">Sign in &rarr;</button>' +
      '</form>' +
      (status ? '<p class="sq-auth-status">' + esc(status) + '</p>' : '');
    if (avatar) avatar.textContent = '👤';
    setTrigger(false, 'Sign in');
    var form = document.getElementById('sq-auth-form');
    /* Reaching for the field is a clear enough statement of intent to start
       the download, so the library is usually here before the button is hit. */
    var email0 = document.getElementById('sq-auth-email');
    if (email0) email0.addEventListener('focus', function () { ensure(); }, { once: true });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = document.getElementById('sq-auth-email').value.trim();
      if (!email) return;
      var btn = form.querySelector('button');
      btn.disabled = true; btn.textContent = 'Sending…';
      ensure().then(function (c) {
        if (!c) { renderSignedOut('Sign-in is unavailable right now. Please try again in a minute.'); return; }
        return Promise.resolve(c.auth.signInWithOtp({
          email: email,
          options: { emailRedirectTo: location.href.split('#')[0] }
        })).then(function (res) {
          if (res && res.error) throw res.error;
          renderSignedOut('Check ' + email + ' for a sign-in link.');
        });
      }).catch(function (err) {
        renderSignedOut('Could not send a link (' + (err && err.message || 'unknown error') + ').');
      });
    });
  }

  function renderSignedIn(user, profile) {
    var name = (profile && profile.handle) || (user.email || '').split('@')[0];
    mount.innerHTML =
      '<div class="sq-auth-me">' +
        '<span class="sq-auth-name">' + esc(name) +
        (profile && profile.symbiont_no ? ' <span class="sq-auth-no">#' + esc(profile.symbiont_no) + '</span>' : '') +
        '</span>' +
        '<button id="sq-auth-out" type="button">Sign out</button>' +
      '</div>';
    // The trigger becomes the account's own initial -- a real avatar, not
    // just a menu that happens to contain profile info.
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    setTrigger(true, name + ', account menu');
    document.getElementById('sq-auth-out').addEventListener('click', function () {
      client.auth.signOut();
    });
  }

  // Other modules (ledger.js's forecast form, frontier.js's propose form,
  // leaderboard.js) don't know when the library resolves, so they can't just
  // read getUser() once at their own render time -- they listen for this
  // event instead, fired on every state change including the initial one,
  // same shape as SymbiQ.save's own onchange.
  function announce() {
    API.ready = true;
    window.dispatchEvent(new CustomEvent('symbiq:authchange', { detail: { user: currentUser } }));
  }

  function onSignedIn(user) {
    currentUser = user;
    Promise.resolve(
      client.from('profiles').select('handle,symbiont_no').eq('id', user.id).single()
    ).then(function (res) {
      renderSignedIn(user, res && res.data);
    }).catch(function () {
      renderSignedIn(user, null);
    });
    if (window.SymbiQ.save && window.SymbiQ.save.connectRemote) {
      window.SymbiQ.save.connectRemote(client, user.id);
    }
    announce();
  }

  function onSignedOut() {
    currentUser = null;
    if (window.SymbiQ.save && window.SymbiQ.save.disconnectRemote) {
      window.SymbiQ.save.disconnectRemote();
    }
    renderSignedOut(null);
    announce();
  }

  /* Runs once, the moment a real client exists -- whether it was fetched
     eagerly for a stored session or lazily on a reader's first move. */
  function watch() {
    client.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (session && session.user) onSignedIn(session.user);
      else announce();
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (session && session.user) onSignedIn(session.user);
      else onSignedOut();
    });
  }

  function init() {
    mount = document.getElementById('sq-auth');       // the popover's content
    wrap = document.getElementById('sq-account');      // the <details> trigger + popover
    avatar = document.getElementById('sq-avatar');

    /* No account control on the page, or no Supabase project configured at
       all -- someone's fork of this repo, say. Either way the account button
       stays hidden and there is no sign-in to wait for, so the answer to "is
       anyone signed in" is a definite no and must still be announced. Before
       this, nothing fired, and ledger.js's submit panel and frontier.js's
       propose panel sat on "Checking sign-in status…" for the life of the
       page -- both of their signed-out branches work without Supabase. */
    if (!mount || !wrap || !configured()) { setTimeout(announce, 0); return; }

    wrap.hidden = false;
    renderSignedOut(null);

    /* Opening the popover is the clearest statement of intent there is. */
    wrap.addEventListener('toggle', function () { if (wrap.open) ensure(); });

    if (hasStoredSession()) {
      ensure();          // a session to restore: the library is worth its weight
    } else {
      /* No session, so no library. Announce the answer we already have -- on a
         task boundary, because every consumer registers its listener during
         DOMContentLoaded and this runs first among them. */
      setTimeout(announce, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
