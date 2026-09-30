(function () {
  'use strict';

  var ACCESS_KEY = 'e475f594-d5a7-4cc2-a89d-fd4b12deb5ef';
  var ENDPOINT   = 'https://api.web3forms.com/submit';

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
      if (t === 'checkbox' || t === 'radio') {
        if (el.checked) out[el.name] = (el.value && el.value !== 'on') ? el.value : 'yes';
        continue;
      }
      out[el.name] = el.value.trim();
    }
    return out;
  }

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
    if (form.dataset.sqWired) return;
    form.dataset.sqWired = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var kind = form.getAttribute('data-sq') || 'message';
      var data = values(form);
      var btn  = form.querySelector('button[type=submit], button:not([type])');

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
