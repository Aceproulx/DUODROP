/* =================================================================
   DUODROP — Artists Routes
   GET  /api/artists        — list all artists (public)
   GET  /api/artists/:id    — artist profile + songs (public)
   POST /api/artists/:id/follow — follow / unfollow (auth)
   ================================================================= */
const router = require('express').Router();
const { dbGet, dbSet, dbUpdate, dbDelete } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

// ── List artists ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const raw = await dbGet('artists');
    if (!raw) return res.json({ artists: [] });
    const artists = Object.entries(raw)
      .map(([id, a]) => ({ ...a, id }))
      .filter(a => a.name);
    res.json({ artists });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
});

// ── Artist profile ────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [artist, allSongs] = await Promise.all([
      dbGet(`artists/${req.params.id}`),
      dbGet('songs'),
    ]);

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const songs = allSongs
      ? Object.entries(allSongs)
          .map(([id, s]) => ({ ...s, id }))
          .filter(s => s.artistId === req.params.id && (s.status === 'approved' || s.status === 'active'))
          .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      : [];

    res.json({ artist: { ...artist, id: req.params.id }, songs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
});

// ── Follow / unfollow ─────────────────────────────────────────
router.post('/:id/follow', requireAuth, async (req, res) => {
  try {
    const uid      = req.user.localId;
    const artistId = req.params.id;

    if (uid === artistId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const followKey = `follows/${uid}/${artistId}`;
    const existing  = await dbGet(followKey, req.idToken);
    const artist    = await dbGet(`artists/${artistId}`);
    const curFollowers = artist?.followers || 0;

    if (existing) {
      await dbDelete(followKey, req.idToken);
      await dbUpdate(`artists/${artistId}`, { followers: Math.max(0, curFollowers - 1) }, req.idToken);
      res.json({ following: false, followers: Math.max(0, curFollowers - 1) });
    } else {
      await dbSet(followKey, true, req.idToken);
      await dbUpdate(`artists/${artistId}`, { followers: curFollowers + 1 }, req.idToken);
      res.json({ following: true, followers: curFollowers + 1 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle follow' });
  }
});

// ── Self-register as artist (fan → artist upgrade) ───────────
router.post('/register', requireAuth, async (req, res) => {
  try {
    const uid = req.user.localId;

    // Fetch user profile
    const userProfile = await dbGet(`users/${uid}`, req.idToken);
    if (!userProfile) return res.status(404).json({ error: 'User profile not found' });

    // Idempotent — if already an artist node, just return success
    const existing = await dbGet(`artists/${uid}`);
    if (!existing) {
      await dbSet(`artists/${uid}`, {
        id:        uid,
        username:  userProfile.username || '',
        name:      userProfile.name || '',
        avatar:    userProfile.avatar || '',
        bio:       userProfile.bio || '',
        followers: 0,
        verified:  false,
        createdAt: new Date().toISOString(),
      }, req.idToken);
    }

    // Ensure role is set to artist in users node
    await dbUpdate(`users/${uid}`, { role: 'artist' }, req.idToken);

    res.json({ message: 'Artist account activated', artistId: uid });
  } catch (err) {
    console.error('[artists/register]', err.message);
    res.status(500).json({ error: 'Failed to register artist account' });
  }
});

module.exports = router;
