/* =================================================================
   DUODROP — Firebase REST API Helper
   Uses Firebase REST API (no Admin SDK required).
   All auth via Firebase ID tokens from the client.
   ================================================================= */

const fetch = require('node-fetch');

const WEB_API_KEY    = process.env.FIREBASE_WEB_API_KEY;
const DATABASE_URL   = process.env.FIREBASE_DATABASE_URL;

// ── Token verification ────────────────────────────────────────
/**
 * Verify a Firebase ID token using the REST API.
 * Returns the Firebase user record (localId, email, etc.)
 */
async function verifyIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken }),
    }
  );
  const data = await res.json();
  if (data.error || !data.users?.length) {
    throw new Error(data.error?.message || 'Invalid token');
  }
  return data.users[0]; // { localId, email, displayName, ... }
}

// ── Firebase Auth REST ────────────────────────────────────────
async function signUp(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data; // { localId, idToken, refreshToken, ... }
}

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

async function refreshToken(refreshToken) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${WEB_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { idToken: data.id_token, refreshToken: data.refresh_token };
}

// ── Realtime Database REST ────────────────────────────────────
async function dbGet(path, idToken = null) {
  const auth = idToken ? `?auth=${idToken}` : '';
  const res  = await fetch(`${DATABASE_URL}/${path}.json${auth}`);
  if (res.status === 401) throw new Error('Unauthorized — check Firebase rules');
  return res.json();
}

async function dbSet(path, data, idToken) {
  const res = await fetch(`${DATABASE_URL}/${path}.json?auth=${idToken}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`DB SET failed: ${res.status}`);
  return res.json();
}

async function dbPush(path, data, idToken) {
  const res = await fetch(`${DATABASE_URL}/${path}.json?auth=${idToken}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`DB PUSH failed: ${res.status}`);
  return res.json(); // returns { name: "-NxxxxxKey" }
}

async function dbUpdate(path, data, idToken) {
  const res = await fetch(`${DATABASE_URL}/${path}.json?auth=${idToken}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`DB UPDATE failed: ${res.status}`);
  return res.json();
}

async function dbDelete(path, idToken) {
  const res = await fetch(`${DATABASE_URL}/${path}.json?auth=${idToken}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`DB DELETE failed: ${res.status}`);
  return null;
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = {
  verifyIdToken,
  signUp,
  signIn,
  refreshToken,
  dbGet,
  dbSet,
  dbPush,
  dbUpdate,
  dbDelete,
  uid,
};
