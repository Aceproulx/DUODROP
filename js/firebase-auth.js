/* =================================================================
   DUODROP — Firebase Client Auth (Google Sign-In)
   Initializes Firebase on the frontend (client config is public —
   it only identifies the project, it is NOT a secret key).
   ================================================================= */

// ── Firebase client config (safe to be in frontend code) ────────
const _firebaseConfig = {
  apiKey:            'AIzaSyAvDlW4-OZFhKeDRyFySJmmxvjatsWVepo',
  authDomain:        window.location.hostname === 'localhost' ? 'duodrop.firebaseapp.com' : window.location.host,
  databaseURL:       'https://duodrop-default-rtdb.firebaseio.com',
  projectId:         'duodrop',
  storageBucket:     'duodrop.firebasestorage.app',
  messagingSenderId: '462525737691',
  appId:             '1:462525737691:web:2b5e1538b1c73a6ab83afe',
};

// Lazy-init Firebase app (avoids duplicate app error on hot reload)
let _firebaseApp  = null;
let _firebaseAuth = null;

function _getFirebaseAuth() {
  if (_firebaseAuth) return _firebaseAuth;

  if (!window.firebase) {
    console.error('Firebase SDK not loaded');
    return null;
  }

  if (!firebase.apps || firebase.apps.length === 0) {
    _firebaseApp = firebase.initializeApp(_firebaseConfig);
  } else {
    _firebaseApp = firebase.app();
  }

  _firebaseAuth = firebase.auth();
  return _firebaseAuth;
}

// ── Google Sign-In ────────────────────────────────────────────────
async function signInWithGoogle(role = 'fan') {
  const btn = document.getElementById('google-signin-btn') ||
              document.getElementById('google-register-btn');

  try {
    // Show loading state
    document.querySelectorAll('.google-auth-btn').forEach(b => {
      b.disabled = true;
      b.innerHTML = `<span class="google-spinner"></span> Connecting…`;
    });

    const auth     = _getFirebaseAuth();
    if (!auth) throw new Error('Firebase Auth not available');

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    // Open the Google popup
    const result  = await auth.signInWithPopup(provider);
    const idToken = await result.user.getIdToken();
    const isNew   = result.additionalUserInfo?.isNewUser;

    // Send token to our backend
    const res = await fetch('/api/auth/google', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken, role, isNew }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed');

    // Store token + user
    localStorage.setItem('dd_token',   data.idToken);
    localStorage.setItem('dd_refresh', data.refreshToken || '');
    localStorage.setItem('dd_user',    JSON.stringify(data.user));

    // Sync into local DB cache
    const u = data.user;
    DB.get().currentUser = u.id;
    const idx = DB.get().users.findIndex(x => x.id === u.id);
    if (idx >= 0) Object.assign(DB.get().users[idx], u);
    else          DB.get().users.push(u);
    DB.save();

    closeModal('modal-auth');
    updateUserUI();
    await loadServerData();
    showToast(`Welcome, ${u.name || u.username}!`, 'success');
    showPage('discover');

  } catch (err) {
    console.error('[google-signin]', err);
    // User cancelled the popup — don't show error
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showToast('Google sign-in failed: ' + err.message, 'error');
    }
  } finally {
    // Restore buttons
    document.querySelectorAll('.google-auth-btn').forEach(b => {
      b.disabled = false;
      b.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48" style="vertical-align:-3px;margin-right:8px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg> Continue with Google`;
    });
  }
}

window.signInWithGoogle = signInWithGoogle;
