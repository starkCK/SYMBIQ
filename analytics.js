/* SymbiQ, analytics, off by default and switched on with one word.
 *
 * WHY THIS FILE EXISTS: as of 2026-07-29 nothing on this site was measured.
 * The daily question published automatically to a page nobody was told about,
 * and every success criterion in the plan ("do six of ten players finish the
 * act?") was unanswerable. That is not a missing feature, it is a missing
 * instrument, and no product decision below is worth making without it.
 *
 * ── TO SWITCH ON (one of these, then set PROVIDER) ────────────────────────
 *   'goatcounter'  free for non-commercial, no cookies, no consent banner.
 *                  Sign up at goatcounter.com, set SITE_CODE to your subdomain.
 *   'plausible'    paid, self-hostable, no cookies. Set DOMAIN.
 *   'cloudflare'   free, needs a Cloudflare account. Set CF_TOKEN.
 *   ''             off. Nothing is loaded and nothing is sent. (default)
 *
 * All three are cookieless and store no personal data, which is why none of
 * them needs a consent banner. Do not replace this with Google Analytics
 * without also adding one, and without deciding you are happy handing your
 * readers' behaviour to an ad company, on a site whose whole argument is
 * that it treats its readers straight.
 */
(function () {
  'use strict';

  // Live since 2026-07-30. Dashboard: https://symbiq.goatcounter.com
  var PROVIDER  = 'goatcounter';         // 'goatcounter' | 'plausible' | 'cloudflare' | ''
  var SITE_CODE = 'symbiq';              // goatcounter subdomain
  var DOMAIN    = 'starkck.github.io';   // plausible
  var CF_TOKEN  = '';                    // cloudflare beacon token

  if (!PROVIDER) return;

  // Respect an explicit Do Not Track signal. Costs a little data; it is the
  // consistent position for a site that asks readers to trust it.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var s = document.createElement('script');
  s.defer = true;

  if (PROVIDER === 'goatcounter') {
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + SITE_CODE + '.goatcounter.com/count');
  } else if (PROVIDER === 'plausible') {
    s.src = 'https://plausible.io/js/script.js';
    s.setAttribute('data-domain', DOMAIN);
  } else if (PROVIDER === 'cloudflare') {
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token":"' + CF_TOKEN + '"}');
  } else {
    return;
  }

  /* 2026-09-23: speculation-rules.json can fetch this page's HTML into the
     cache on a mere HOVER, well before a reader has visited it (it never
     runs page JavaScript, so this guard only matters if a rule ever grows
     into "prerender" -- currently the site uses "prefetch" only, which does
     not execute this file at all). If it ever does, appending the beacon
     script here would count a hover as a visit. document.prerendering is
     true only while the page is being rendered in the background; wait for
     it to actually become the active page before sending anything. Browsers
     without prerendering support don't define the property, so this is a
     no-op there and the script loads immediately as it always has. */
  function fire() { document.head.appendChild(s); }
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', fire, { once: true });
  } else {
    fire();
  }

  /* Report a named event (a mission cleared, a question answered) if the
   * provider supports it. Safe to call whether or not analytics is on, so
   * calling code never needs to check. */
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.track = function (name, meta) {
    try {
      if (PROVIDER === 'plausible' && window.plausible) window.plausible(name, { props: meta || {} });
      if (PROVIDER === 'goatcounter' && window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: 'event/' + name, title: name, event: true });
      }
    } catch (e) { /* analytics must never break the page */ }
  };
})();

/* No-op stub so callers can always use SymbiQ.track without a guard. */
window.SymbiQ = window.SymbiQ || {};
if (typeof window.SymbiQ.track !== 'function') window.SymbiQ.track = function () {};
