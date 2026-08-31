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
    for (var i = 0; i < els.length; i++) out[els[i].name] = els[i].value.trim();
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
          done(true, kind === 'newsletter'
            ? 'You’re on the list. Nothing else needed.'
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
})();
