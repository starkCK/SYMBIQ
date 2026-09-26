/* SymbiQ, form delivery for a site with no back end.
 *
 * GitHub Pages cannot send email, so every form here posts to a third-party
 * relay. Until one is configured it falls back to opening the visitor's own
 * mail client, which is worse UX but is never a dead end.
 *
 * ── TO SWITCH ON REAL INBOX DELIVERY (about 30 seconds, no password) ───────
 *   1. Go to https://web3forms.com, enter dsechinmoy@gmail.com, and they
 *      email you an "access key" (a UUID). No account, no password.
 *   2. Paste it into ACCESS_KEY below. That is the entire change.
 *   Formspree / Formsubmit work the same way if you prefer them; only
 *   post() below would need editing.
 *
 * The destination address is NEVER written into the HTML or into this file in
 * one piece, an address in public source gets harvested by spam crawlers
 * within days. The access key is a public token by design: it identifies the
 * inbox without revealing it, and can be rotated if it is ever abused.
 */
(function () {
  'use strict';

  // Live since 2026-07-30. Public by design, this token identifies the inbox
  // without revealing it, and it must sit in client-side source to work at all.
  var ACCESS_KEY = 'e475f594-d5a7-4cc2-a89d-fd4b12deb5ef';
  var ENDPOINT   = 'https://api.web3forms.com/submit';

  // Reassembled at runtime so the literal string never appears in the source.
  function fallbackAddress() {
    return ['dsechinmoy', String.fromCharCode(64), 'gmail', '.', 'com'].join('');
  }

  function msg(form, text, kind) {
    var el = form.querySelector('.sqmsg');
    if (!el) { el = document.createElement('p'); el.className = 'sqmsg'; form.appendChild(el); }
    el.className = 'sqmsg ' + (kind || '');
    el.textContent = text;
  }

  function values(form) {
    var out = {}, els = form.querySelectorAll('input[name], textarea[name], select[name]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], t = (el.type || '').toLowerCase();
      // A checkbox or radio reports .value ("on") whether or not it is ticked,
      // so reading .value alone would submit every checkbox as checked. Only a
      // ticked one counts -- which is what the waitlist checkbox (plan 23 §7.6)
      // needs before it can be added to the newsletter form.
      if (t === 'checkbox' || t === 'radio') {
        if (el.checked) out[el.name] = (el.value && el.value !== 'on') ? el.value : 'yes';
        continue;
      }
      out[el.name] = el.value.trim();
    }
    return out;
  }

  // No JS-side email validation beyond the browser's own: over-strict regexes
  // reject real addresses, and the relay validates properly anyway.
  function post(form, kind, data) {
    var body = { access_key: ACCESS_KEY, subject: 'SymbiQ ' + kind, from_name: 'SymbiQ site' };
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) body[k] = data[k];

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || j.success !== true) throw new Error((j && j.message) || 'relay refused it');
        return true;
      });
  }

  function mailto(kind, data) {
    var lines = [];
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) lines.push(k + ': ' + data[k]);
    return 'mailto:' + fallbackAddress() +
           '?subject=' + encodeURIComponent('SymbiQ ' + kind) +
           '&body='    + encodeURIComponent(lines.join('\n\n'));
  }

  function handle(form) {
    // Guard against double-binding: a form injected after load can be wired by
    // SymbiQ.forms.wire() and then swept up again by a later init(). Two
    // listeners would submit the same message twice.
    if (form.dataset.sqWired) return;
    form.dataset.sqWired = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.getAttribute('data-sq') || 'message';
      var data = values(form);
      var btn  = form.querySelector('button[type=submit], button:not([type])');

      // Honeypot: a field no human sees. Bots fill it; if it has content we
      // silently pretend to succeed rather than telling the bot it was caught.
      if (data._gotcha) { msg(form, 'Thanks, that’s in.', 'ok'); form.reset(); return; }
      delete data._gotcha;

      var required = form.querySelectorAll('[required]');
      for (var i = 0; i < required.length; i++) {
        if (!required[i].value.trim()) {
          msg(form, 'Please fill in ' + (required[i].getAttribute('data-label') || 'every required field') + '.', 'err');
          required[i].focus();
          return;
        }
      }

      if (btn) { btn.disabled = true; btn.dataset.was = btn.textContent; btn.textContent = 'Sending…'; }

      var done = function (ok, text) {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.was || 'Send'; }
        msg(form, text, ok ? 'ok' : 'err');
        if (ok) form.reset();
      };

      if (!ACCESS_KEY) {
        // Not configured yet, hand off to the visitor's mail client. Honest
        // about what just happened rather than silently doing nothing.
        window.location.href = mailto(kind, data);
        done(true, 'Opening your email app, press send there and it reaches us. ' +
                   '(Direct sending is not switched on yet.)');
        return;
      }

      post(form, kind, data)
        .then(function () {
          if (kind === 'newsletter') remember('subscribed');
          done(true, kind === 'newsletter'
            ? 'You’re on the list. Nothing else needed.'
            : kind === 'community-post'
              ? 'Received. It goes to the desk for review, which can take up to 48 hours.'
              : kind === 'creator-application'
                ? 'Received. The desk reads every application itself.'
                : 'Got it, thank you. Every report is read by a human.');
        })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.was || 'Send'; }
          var a = document.createElement('a');
          a.href = mailto(kind, data);
          a.textContent = 'send it by email instead';
          msg(form, 'That didn’t go through (' + err.message + '). You can ', 'err');
          form.querySelector('.sqmsg').appendChild(a);
          form.querySelector('.sqmsg').appendChild(document.createTextNode('.'));
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-sq]');
    for (var i = 0; i < forms.length; i++) handle(forms[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  /* Forms that are injected after load (the Ledger builds its no-account claim
     form only once it knows nobody is signed in) never see init(), so they
     need a way in. handle() guards itself with a data-sq-wired flag, so a
     form reached by both paths is still bound exactly once. */
  /* ASK AT THE WIN. The only newsletter form used to sit at the bottom of the
     home page. People say yes right after they win something, so a game or the
     Question can call capture(host) at that moment. It shows at most once per
     page load, never again after a subscription (from any form), and not for
     three weeks after "Not now". The whole state is one localStorage key. */
  var CAP_KEY = 'symbiq.capture.v1', capShown = false, capN = 0;
  function capState() { try { return JSON.parse(localStorage.getItem(CAP_KEY)) || {}; } catch (e) { return {}; } }
  function remember(state) { try { localStorage.setItem(CAP_KEY, JSON.stringify({ state: state, at: Date.now() })); } catch (e) {} }
  var CAP_COPY = {
    question: 'One letter a week: the move of the week, a claim that moved, and the Question with last week’s answer.',
    game: 'One letter a week from the desk: the move of the week, a claim that moved, and a seeded board to beat.'
  };
  function ensureCapStyle() {
    if (document.getElementById('sq-cap-style')) return;
    var st = document.createElement('style');
    st.id = 'sq-cap-style';
    st.textContent =
      '.sqcap{margin:14px 0 4px;padding:14px 16px;border:1px dashed var(--border);border-radius:12px;text-align:left;font-weight:400}' +
      '.sqcap-lead{margin:0;font-size:.93rem}' +
      '.sqcap .sqform{margin:10px 0 0}' +
      '.sqcap-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';
    document.head.appendChild(st);
  }
  /* HIDDEN-UNTIL-HOSTED (2026-09-24): there is no newsletter yet. This form
     promised "one letter a week" and "the first issue will find you" while
     the address only reached an inbox, so it is off. Set to true once a
     newsletter platform is sending issues. */
  var CAPTURE_ON = false;
  function capture(host, o) {
    o = o || {};
    if (!CAPTURE_ON || !host || capShown) return false;
    var s = capState();
    if (s.state === 'subscribed') return false;
    if (s.state === 'dismissed' && Date.now() - (s.at || 0) < 21 * 86400000) return false;
    capShown = true; capN++;
    var id = 'sqcap-email-' + capN, ctx = String(o.context || 'site').replace(/[^a-z]/g, '');
    ensureCapStyle();
    host.innerHTML =
      '<div class="sqcap">' +
        '<p class="sqcap-lead"><strong>' + (o.lead || 'Nice.') + '</strong> ' +
          (ctx === 'question' ? CAP_COPY.question : CAP_COPY.game) + ' The first issue will find you.</p>' +
        '<form class="sqform" data-sq="newsletter">' +
          '<label class="sqcap-sr" for="' + id + '">Your email address</label>' +
          '<input type="email" id="' + id + '" name="email" data-label="your email" required placeholder="you@example.com">' +
          '<input type="hidden" name="source" value="' + ctx + '">' +
          '<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
          '<button type="submit">Send me the letter</button>' +
          '<button type="button" class="ghost" data-sqcap-no>Not now</button>' +
        '</form>' +
      '</div>';
    handle(host.querySelector('form'));
    host.querySelector('[data-sqcap-no]').addEventListener('click', function () { remember('dismissed'); host.innerHTML = ''; });
    return true;
  }

  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.forms = { wire: function (form) { if (form) handle(form); }, capture: capture };
})();
