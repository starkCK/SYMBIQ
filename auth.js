/* SymbiQ — accounts (L1). Email magic-link only for now; no GitHub OAuth
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
 * ships `hidden` in every page's nav, and this only clears that once a real
 * Supabase client exists. If the library fails to load, or
 * supabase-config.js is missing, or anything here throws, the button simply
 * never appears -- nothing else on the page depends on it, and no page is
 * worse off than it was before L1. `#sq-auth` is the popover's content div,
 * inside the `<details>`, mounted the same way it always was.
 *
 * On sign-in, this hands the session to SymbiQ.save.connectRemote() so
 * local progress starts mirroring to the account. On sign-out, it calls
 * disconnectRemote() -- local storage keeps working exactly as it always did.
 *
 * API: window.SymbiQ.auth = { getUser(), signOut() }
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function init() {
    var mount = document.getElementById('sq-auth');       // the popover's content
    var wrap = document.getElementById('sq-account');      // the <details> trigger + popover
    var avatar = document.getElementById('sq-avatar');
    if (!mount || !wrap) return;
    if (!window.SymbiQ.SUPABASE_URL || !window.SymbiQ.SUPABASE_ANON_KEY) return;

    loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js')
      .then(function () {
        if (!window.supabase || !window.supabase.createClient) throw new Error('supabase-js did not load');
        var client = window.supabase.createClient(window.SymbiQ.SUPABASE_URL, window.SymbiQ.SUPABASE_ANON_KEY);
        var API = {
          client: client,
          getUser: function () { return currentUser; },
          signOut: function () { return client.auth.signOut(); }
        };
        window.SymbiQ.auth = API;
        var currentUser = null;

        // Keeps the trigger button in sync with mount's content: the icon
        // when signed out, the account initial once signed in -- so the
        // "you're signed in" state is visible without opening the popover
        // at all, which is the actual "have a profile" ask this answers.
        function setTrigger(signedIn, label) {
          wrap.classList.toggle('signed-in', signedIn);
          var summary = wrap.querySelector('summary');
          if (summary) summary.setAttribute('aria-label', label);
        }

        function renderSignedOut(status) {
          mount.innerHTML =
            '<form id="sq-auth-form" class="sqform sq-auth-form">' +
              '<input type="email" id="sq-auth-email" placeholder="you@example.com" required aria-label="Email for a sign-in link">' +
              '<button type="submit">Sign in →</button>' +
            '</form>' +
            (status ? '<p class="sq-auth-status">' + esc(status) + '</p>' : '');
          if (avatar) avatar.textContent = '👤';
          setTrigger(false, 'Sign in');
          var form = document.getElementById('sq-auth-form');
          form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var email = document.getElementById('sq-auth-email').value.trim();
            if (!email) return;
            var btn = form.querySelector('button');
            btn.disabled = true; btn.textContent = 'Sending…';
            client.auth.signInWithOtp({
              email: email,
              options: { emailRedirectTo: location.href.split('#')[0] }
            }).then(function (res) {
              if (res && res.error) throw res.error;
              renderSignedOut('Check ' + email + ' for a sign-in link.');
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
          // The trigger becomes the account's own initial -- a real avatar,
          // not just a menu that happens to contain profile info.
          if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
          setTrigger(true, name + ' — account menu');
          document.getElementById('sq-auth-out').addEventListener('click', function () {
            client.auth.signOut();
          });
        }

        // Other modules (ledger.js's forecast/submission forms) don't know
        // when auth.js's async CDN load resolves, so they can't just read
        // getUser() once at their own render time -- they listen for this
        // event instead, fired on every state change including the initial
        // one, same shape as SymbiQ.save's own onchange.
        function announce() {
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

        wrap.hidden = false;   // the client is real -- safe to show the button now
        renderSignedOut(null);

        client.auth.getSession().then(function (res) {
          var session = res && res.data && res.data.session;
          if (session && session.user) onSignedIn(session.user);
          else announce();
        });

        client.auth.onAuthStateChange(function (event, session) {
          if (session && session.user) onSignedIn(session.user);
          else onSignedOut();
        });
      })
      .catch(function (err) {
        try { console.warn('SymbiQ auth: not available', err); } catch (e) {}
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
