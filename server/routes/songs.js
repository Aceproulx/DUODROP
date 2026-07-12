/* =================================================================
   DUODROP — Songs Routes
   GET  /api/songs           — list approved songs (public)
   GET  /api/songs/trending  — trending songs (public)
   GET  /api/songs/:id       — single song (public)
   POST /api/songs           — create song (auth required)
   POST /api/songs/:id/play  — increment play count
   POST /api/songs/:id/like  — toggle like (auth required)
   GET  /api/songs/:id/comments — list comments
   POST /api/songs/:id/comments — post comment (auth required)
   ================================================================= */
const router = require('express').Router();
const { dbGet, dbSet, dbPush, dbUpdate, dbDelete } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// ── List all approved songs ───────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const raw = await dbGet('songs');
    if (!raw) return res.json({ songs: [] });

    const songs = Object.entries(raw)
      .map(([id, s]) => ({ ...s, id }))
      .filter(s => s.status === 'approved' || s.status === 'active')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ songs });
  } catch (err) {
    console.error('[songs/list]', err.message);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// ── Trending songs ────────────────────────────────────────────
router.get('/trending', async (req, res) => {
  try {
    const { genre = '', limit = 50 } = req.query;
    const raw = await dbGet('songs');
    if (!raw) return res.json({ songs: [] });

    const songs = Object.entries(raw)
      .map(([id, s]) => ({ ...s, id }))
      .filter(s => (s.status === 'approved' || s.status === 'active') && (!genre || s.genre === genre))
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, parseInt(limit));

    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending songs' });
  }
});

// ── Single song ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const song = await dbGet(`songs/${req.params.id}`);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json({ song: { ...song, id: req.params.id } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// ── Create song (after Cloudinary upload) ─────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.localId;
    const { title, genre, desc, tags, type, price, txref, amount, audioUrl, artworkUrl, duration } = req.body;

    if (!title || !genre || !audioUrl) {
      return res.status(400).json({ error: 'title, genre, and audioUrl are required' });
    }

    const userProfile = await dbGet(`users/${uid}`, req.idToken);

    const song = {
      title,
      genre,
      desc:       desc || '',
      tags:       Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      type:       type || 'free',
      price:      parseFloat(price) || 0,
      txref:      txref || '',
      amountPaid: parseFloat(amount) || 0,
      audioUrl,
      artwork:    artworkUrl || '',
      duration:   duration || '0:00',
      artistId:   uid,
      artist:     userProfile?.username || userProfile?.name || 'Unknown',
      plays:      0,
      downloads:  0,
      likes:      0,
      status:     'pending',  // admin must approve
      createdAt:  new Date().toISOString(),
    };

    const result = await dbPush('songs', song, req.idToken);
    const songId = result.name;

    // Register artist node if first upload
    const existingArtist = await dbGet(`artists/${uid}`);
    if (!existingArtist && userProfile) {
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

    res.status(201).json({
      song:    { ...song, id: songId },
      message: 'Song submitted! It will appear after admin approval.',
    });
  } catch (err) {
    console.error('[songs/create]', err.message);
    res.status(500).json({ error: 'Failed to create song' });
  }
});

// ── Record a play ─────────────────────────────────────────────
router.post('/:id/play', optionalAuth, async (req, res) => {
  try {
    const songId = req.params.id;
    // Use a no-auth token for the play update if we have one; otherwise skip DB update
    // (Firebase rules require auth for writes — user must be logged in to count plays)
    if (req.idToken) {
      const song = await dbGet(`songs/${songId}`, req.idToken);
      if (song) {
        const newPlays = (song.plays || 0) + 1;
        await dbUpdate(`songs/${songId}`, { plays: newPlays }, req.idToken);

        // Credit artist earnings (MK 1 per play if >= 100 followers)
        const artistId = song.artistId;
        if (artistId) {
          const artist = await dbGet(`artists/${artistId}`);
          const followers = artist?.followers || 0;
          if (followers >= 100) {
            const earningsKey = `earnings/${artistId}`;
            const existing = await dbGet(earningsKey, req.idToken) || { balance: 0, totalPlays: 0, history: [] };
            await dbSet(earningsKey, {
              balance:    (existing.balance || 0) + 1,
              totalPlays: (existing.totalPlays || 0) + 1,
              history:    [
                { type: 'play', amount: 1, songId, songTitle: song.title, ts: new Date().toISOString() },
                ...(existing.history || []).slice(0, 199),
              ],
            }, req.idToken);
          }
        }

        return res.json({ plays: newPlays });
      }
    }
    res.json({ plays: null }); // guest play — not persisted
  } catch (err) {
    console.error('[songs/play]', err.message);
    res.status(500).json({ error: 'Failed to record play' });
  }
});

// ── Toggle like ───────────────────────────────────────────────
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const uid    = req.user.localId;
    const songId = req.params.id;
    const likeKey = `likes/${uid}/${songId}`;

    const current = await dbGet(likeKey, req.idToken);
    const song    = await dbGet(`songs/${songId}`, req.idToken);
    const curLikes = song?.likes || 0;

    if (current) {
      await dbDelete(likeKey, req.idToken);
      await dbUpdate(`songs/${songId}`, { likes: Math.max(0, curLikes - 1) }, req.idToken);
      res.json({ liked: false, likes: Math.max(0, curLikes - 1) });
    } else {
      await dbSet(likeKey, true, req.idToken);
      await dbUpdate(`songs/${songId}`, { likes: curLikes + 1 }, req.idToken);
      res.json({ liked: true, likes: curLikes + 1 });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ── Comments ──────────────────────────────────────────────────
router.get('/:id/comments', async (req, res) => {
  try {
    const raw = await dbGet(`comments/${req.params.id}`);
    if (!raw) return res.json({ comments: [] });
    const comments = Object.entries(raw)
      .map(([id, c]) => ({ ...c, id }))
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const uid  = req.user.localId;
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });

    const userProfile = await dbGet(`users/${uid}`, req.idToken);
    const comment = {
      userId:   uid,
      username: userProfile?.username || 'User',
      avatar:   userProfile?.avatar || '',
      text:     text.trim().slice(0, 500),
      ts:       new Date().toISOString(),
    };

    const result = await dbPush(`comments/${req.params.id}`, comment, req.idToken);
    res.status(201).json({ comment: { ...comment, id: result.name } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ── Delete comment ────────────────────────────────────────────
router.delete('/:songId/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const uid = req.user.localId;
    const { songId, commentId } = req.params;
    const comment = await dbGet(`comments/${songId}/${commentId}`, req.idToken);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    if (comment.userId !== uid) return res.status(403).json({ error: 'Not your comment' });
    await dbDelete(`comments/${songId}/${commentId}`, req.idToken);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

module.exports = router;
