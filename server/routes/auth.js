/* =================================================================
   DUODROP — Auth Routes
   POST /api/auth/register  — create account
   POST /api/auth/login     — sign in
   POST /api/auth/google    — Google OAuth via Firebase
   GET  /api/auth/me        — get profile
   PATCH /api/auth/profile  — update profile
   POST /api/auth/refresh   — refresh ID token
   ================================================================= */
const router = require('express').Router();
const { signUp, signIn, refreshToken, verifyIdToken, dbGet, dbSet, dbUpdate, uid } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

// ── Turnstile Verification Helper ─────────────────────────────
async function verifyTurnstile(token) {
  if (!token) return false;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // skip if no secret configured
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`
    });
    const data = await res.json();
    return data.success;
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return false;
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, name, role, phone, referral, cfToken } = req.body;

    if (!email || !password || !username || !name) {
      return res.status(400).json({ error: 'email, password, username and name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify Captcha
    const isHuman = await verifyTurnstile(cfToken);
    if (!isHuman) {
      return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
    }

    // Create Firebase Auth user
    const authData = await signUp(email, password);
    const { localId: uid_val, idToken, refreshToken: rt } = authData;

    // Build user profile
    const refCode = 'REF-' + username.toUpperCase().slice(0, 8) + Math.floor(Math.random() * 999);
    const profile = {
      id:        uid_val,
      username,
      name,
      email,
      role:      role || 'fan',
      phone:     phone || '',
      avatar:    '',
      bio:       '',
      status:    'active',
      refCode,
      social:    { website: '', facebook: '', instagram: '', twitter: '' },
      createdAt: new Date().toISOString(),
    };

    // Save profile to RTDB
    await dbSet(`users/${uid_val}`, profile, idToken);

    // Handle referral bonus
    if (referral) {
      try {
        const allUsers = await dbGet('users', idToken);
        if (allUsers) {
          const referrer = Object.values(allUsers).find(u => u.refCode === referral);
          if (referrer) {
            const key = `fanEarnings/${referrer.id}`;
            const existing = await dbGet(key, idToken) || { balance: 0, shares: [] };
            await dbSet(key, {
              balance: (existing.balance || 0) + 2,
              shares:  [
                { amount: 2, note: `Referral: ${username} joined via your link`, ts: new Date().toISOString() },
                ...(existing.shares || []),
              ],
            }, idToken);
          }
        }
      } catch (_) { /* referral errors are non-fatal */ }
    }

    res.status(201).json({ user: profile, idToken, refreshToken: rt });
  } catch (err) {
    console.error('[register]', err.message);
    // Map Firebase error codes to friendly messages
    const msg = err.message.includes('EMAIL_EXISTS')
      ? 'Email already registered'
      : err.message.includes('WEAK_PASSWORD')
        ? 'Password too weak — use at least 6 characters'
        : err.message;
    res.status(400).json({ error: msg });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, cfToken } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Verify Captcha only if a token was sent (captcha optional on login)
    if (cfToken) {
      const isHuman = await verifyTurnstile(cfToken);
      if (!isHuman) {
        return res.status(400).json({ error: 'Captcha verification failed. Please try again.' });
      }
    }

    const authData = await signIn(email, password);
    const { localId: uid_val, idToken, refreshToken: rt } = authData;

    // Fetch user profile
    const profile = await dbGet(`users/${uid_val}`, idToken);

    if (profile?.status === 'banned') {
      return res.status(403).json({ error: 'Account banned. Contact support: 0888 240 630.' });
    }

    res.json({ user: profile || { id: uid_val, email }, idToken, refreshToken: rt });
  } catch (err) {
    console.error('[login]', err.message);
    const msg = err.message.includes('INVALID_LOGIN_CREDENTIALS') || err.message.includes('EMAIL_NOT_FOUND') || err.message.includes('INVALID_PASSWORD')
      ? 'Incorrect email or password'
      : err.message;
    res.status(401).json({ error: msg });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const profile = await dbGet(`users/${req.user.localId}`, req.idToken);
    res.json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, bio, phone, avatar, social, role } = req.body;
    const updates = {};
    if (name   !== undefined) updates.name   = name;
    if (bio    !== undefined) updates.bio    = bio;
    if (phone  !== undefined) updates.phone  = phone;
    if (avatar !== undefined) updates.avatar = avatar;
    if (social !== undefined) updates.social = social;
    if (role   !== undefined) updates.role   = role;

    await dbUpdate(`users/${req.user.localId}`, updates, req.idToken);
    const updated = await dbGet(`users/${req.user.localId}`, req.idToken);
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// PATCH /api/auth/settings — save user preferences to Firebase
router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const { theme, accentColor, audio, notifications } = req.body;
    const prefs = {};
    if (theme !== undefined) prefs.theme = theme;
    if (accentColor !== undefined) prefs.accentColor = accentColor;
    if (audio !== undefined) prefs.audio = audio;
    if (notifications !== undefined) prefs.notifications = notifications;

    await dbUpdate(`users/${req.user.localId}/settings`, prefs, req.idToken);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// GET /api/auth/settings — fetch user preferences
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await dbGet(`users/${req.user.localId}/settings`, req.idToken);
    res.json({ settings: settings || {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/auth/username — change username
router.patch('/username', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check username uniqueness
    const allUsers = await dbGet('users', req.idToken);
    if (allUsers) {
      const taken = Object.values(allUsers).find(u => u.username?.toLowerCase() === username.toLowerCase() && u.id !== req.user.localId);
      if (taken) {
        return res.status(400).json({ error: 'Username is already taken' });
      }
    }

    const refCode = 'REF-' + username.toUpperCase().slice(0, 8) + Math.floor(Math.random() * 999);
    await dbUpdate(`users/${req.user.localId}`, { username, refCode }, req.idToken);
    const updated = await dbGet(`users/${req.user.localId}`, req.idToken);
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// DELETE /api/auth/account — delete user account and all data
router.delete('/account', requireAuth, async (req, res) => {
  try {
    const uid_val = req.user.localId;
    const idToken = req.idToken;

    // Delete user data from RTDB
    await Promise.allSettled([
      dbDelete(`users/${uid_val}`, idToken),
      dbDelete(`artists/${uid_val}`, idToken),
      dbDelete(`fanEarnings/${uid_val}`, idToken),
      dbDelete(`settings/${uid_val}`, idToken).catch(() => {}),
    ]);

    // Delete Firebase Auth account via REST API
    const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
    if (WEB_API_KEY) {
      try {
        await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${WEB_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (_) { /* RTDB data already deleted — auth deletion is best-effort */ }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[deleteAccount]', err.message);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken: rt } = req.body;
    if (!rt) return res.status(400).json({ error: 'refreshToken required' });
    const tokens = await refreshToken(rt);
    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});

// POST /api/auth/google — Firebase Google OAuth
router.post('/google', async (req, res) => {
  try {
    const { idToken, role = 'fan', isNew = false } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    // 1. Verify the Firebase ID token (issued by Google via Firebase)
    const firebaseUser = await verifyIdToken(idToken);
    const uid_val      = firebaseUser.localId;
    const email        = firebaseUser.email || '';
    const displayName  = firebaseUser.displayName || email.split('@')[0] || 'User';
    const photoUrl     = firebaseUser.photoUrl || '';

    // 2. Check if profile already exists in RTDB
    let profile = await dbGet(`users/${uid_val}`, idToken);

    if (!profile) {
      // New user — create profile
      const username = displayName.replace(/\s+/g, '').slice(0, 20) + Math.floor(Math.random() * 99);
      const refCode  = 'REF-' + username.toUpperCase().slice(0, 8) + Math.floor(Math.random() * 999);

      profile = {
        id:        uid_val,
        username,
        name:      displayName,
        email,
        role:      role || 'fan',
        avatar:    photoUrl,
        bio:       '',
        phone:     '',
        status:    'active',
        refCode,
        provider:  'google',
        social:    {},
        createdAt: new Date().toISOString(),
      };
      await dbSet(`users/${uid_val}`, profile, idToken);

      // If registering as artist, create artist node too
      if (role === 'artist') {
        await dbSet(`artists/${uid_val}`, {
          id:        uid_val,
          username:  profile.username,
          name:      displayName,
          avatar:    photoUrl,
          bio:       '',
          followers: 0,
          verified:  false,
          createdAt: new Date().toISOString(),
        }, idToken);
      }
    } else {
      // Returning user — refresh avatar from Google if they don't have one
      if (!profile.avatar && photoUrl) {
        await dbUpdate(`users/${uid_val}`, { avatar: photoUrl }, idToken);
        profile.avatar = photoUrl;
      }
      if (profile.status === 'banned') {
        return res.status(403).json({ error: 'Account banned. Contact support: 0888 240 630.' });
      }
    }

    res.json({ user: profile, idToken, refreshToken: '' });
  } catch (err) {
    console.error('[auth/google]', err.message);
    res.status(401).json({ error: 'Google sign-in verification failed: ' + err.message });
  }
});

module.exports = router;

