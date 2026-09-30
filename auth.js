(function () {
  window.SymbiQ = window.SymbiQ || {};

  var esc = window.SymbiQ.core.esc;

  var client = null;
  var currentUser = null;
  var loadPromise = null;
  var mount = null, wrap = null, avatar = null;

  var API = {
    client: null,
    ready: false,
    getUser: function () { return currentUser; },
    signOut: function () { return client ? client.auth.signOut() : Promise.resolve(); },
    ensure: ensure
  };
  window.SymbiQ.auth = API;

  var ACCOUNTS = false;
  function accountsOn() {
    if (ACCOUNTS) return true;
    try { return localStorage.getItem('symbiq.dev.accounts') === 'on'; } catch (e) { return false; }
  }
  API.enabled = accountsOn();

  function configured() {
    return accountsOn() && !!(window.SymbiQ.SUPABASE_URL && window.SymbiQ.SUPABASE_ANON_KEY);
  }

  function hasStoredSession() {
    try {
      var host = new URL(window.SymbiQ.SUPABASE_URL).hostname.split('.')[0];
      return !!localStorage.getItem('sb-' + host + '-auth-token');
    } catch (e) { return false; }
  }

  var loadScript = window.SymbiQ.core.loadScript;

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
        return null;
      });
    return loadPromise;
  }

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
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    setTrigger(true, name + ', account menu');
    document.getElementById('sq-auth-out').addEventListener('click', function () {
      client.auth.signOut();
    });
  }

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
    mount = document.getElementById('sq-auth');
    wrap = document.getElementById('sq-account');
    avatar = document.getElementById('sq-avatar');

    if (!mount || !wrap || !configured()) { setTimeout(announce, 0); return; }

    wrap.hidden = false;
    renderSignedOut(null);

    wrap.addEventListener('toggle', function () { if (wrap.open) ensure(); });

    if (hasStoredSession()) {
      ensure();
    } else {
      setTimeout(announce, 0);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
