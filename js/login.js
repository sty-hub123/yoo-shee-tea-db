/* ═══════════════════════════════════════
   羽曦堂 · Login Page JS (canvas + auth)
═══════════════════════════════════════ */

// ── Supabase ──
var SUPA_URL = 'https://sbhogbwaqzjlhqbckwef.supabase.co';
var SUPA_KEY = 'sb_publishable_JsnZRdnJSWPTu8_uAQtksA_ldGpXT0W';
var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

// Check session on load
sb.auth.getSession().then(function(res) {
  if (res.data && res.data.session) {
    // Already logged in — show app directly
    initAuth();
  }
}).catch(function() {});

// After OAuth redirect
sb.auth.onAuthStateChange(function(event, session) {
  if (event === 'SIGNED_IN' && session) {
    initAuth();
  }
});

// Google login
document.getElementById('btn-google').addEventListener('click', async function() {
  var btn = this;
  btn.disabled = true;
  document.getElementById('error-msg').classList.remove('show');
  var res = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (res.error) {
    document.getElementById('error-msg').textContent = '登入失敗：' + res.error.message;
    document.getElementById('error-msg').classList.add('show');
    btn.disabled = false;
  }
});
