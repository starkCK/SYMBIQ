/* SymbiQ — Supabase project config. Public by design: this is the
 * "publishable" (anon) key, meant to sit in client-side source. It cannot
 * read or write anything Row-Level Security doesn't already allow an
 * anonymous or signed-in visitor to do -- same reasoning as forms.js's
 * ACCESS_KEY. The database password (never used here, and never put in a
 * file like this) is what actually needs protecting; this key is not it.
 */
(function () {
  window.SymbiQ = window.SymbiQ || {};
  window.SymbiQ.SUPABASE_URL = 'https://ymtjedmqptiwhktxdwmv.supabase.co';
  window.SymbiQ.SUPABASE_ANON_KEY = 'sb_publishable_j9ugu-qEEh9ZSaB0wsSCUw_tPRn6D_h';
})();
