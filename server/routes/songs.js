/* =================================================================
   DUODROP — Songs Routes
   GET  /api/songs           — list all live songs (public)
   GET  /api/songs/trending  — trending songs (public)
   GET  /api/songs/:id       — single song (public)
   POST /api/songs           — create song (auth required)
   POST /api/songs/:id/play     — increment play count
   POST /api/songs/:id/download — increment download count
   POST /api/songs/:id/like     — toggle like (auth required)
   GET  /api/songs/:id/comments — list comments
   POST /api/songs/:id/comments — post comment (auth required)
   DELETE /api/songs/:id        — delete song (owner only, auth required)
   ================================================================= */
const router = require('express').Router();
const { dbGet, dbSet, dbPush, dbUpdate, dbDelete } = require('../config/firebase');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { verifyPaychanguTransaction } = require('../utils/paychangu');

// Attach the real per-song comment count from the comments collection.
async function attachCommentCounts(songs) {
  if (!songs || !songs.length) return songs;
  let raw = null;
  try { raw = await dbGet('comments'); } catch (_) { /* ignore */ }
  const counts = {};
  if (raw) {
    Object.entries(raw).forEach(([songId, list]) => {
      counts[songId] = (list ? Object.keys(list).length : 0);
    });
  }
  return songs.map(s => ({ ...s, commentCount: counts[s.id] || 0 }));
}

// Attach the real per-day play log (playsDaily/{songId}/{YYYY-MM-DD}).
// The client uses this to build weekly/monthly charts from real data.
async function attachPlaysDaily(songs) {
  if (!songs || !songs.length) return songs;
  let raw = null;
  try { raw = await dbGet('playsDaily'); } catch (_) { /* ignore */ }
  if (!raw) return songs;
  return songs.map(s => ({ ...s, playsDaily: raw[s.id] || {} }));
}

function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ── List all live songs (excludes only rejected/banned) ───────
router.get('/', async (req, res) => {
  try {
    const raw = await dbGet('songs');
    if (!raw) return res.json({ songs: [] });

    const songs = Object.entries(raw)
      .map(([id, s]) => ({ ...s, id }))
      .filter(s => s.status !== 'rejected' && s.status !== 'banned')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ songs: await attachPlaysDaily(await attachCommentCounts(songs)) });
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
      .filter(s => s.status !== 'rejected' && s.status !== 'banned' && (!genre || s.genre === genre))
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, parseInt(limit));

    res.json({ songs: await attachPlaysDaily(await attachCommentCounts(songs)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending songs' });
  }
});

// ── Single song ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const song = await dbGet(`songs/${req.params.id}`);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    const withDaily = (await attachPlaysDaily([{ ...song, id: req.params.id }]))[0];
    res.json({ song: withDaily });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch song' });
  }
});

// ── Create song (after Cloudinary upload) ─────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const uid = req.user.localId;
    const { artist, title, genre, desc, tags, type, price, txref, amount, audioUrl, artworkUrl, duration, lyrics } = req.body;

    if (!title || !genre || !audioUrl) {
      return res.status(400).json({ error: 'title, genre, and audioUrl are required' });
    }

    // ── Upload type enforcement ───────────────────────────────
    // 'monetized' = artist paid via PayChangu; 'free' = no payment required.
    // We normalise to exactly these two values — any unknown value defaults to 'free'.
    const uploadType = req.body.uploadType === 'monetized' ? 'monetized' : 'free';

    if (uploadType === 'monetized') {
      // A payment reference is mandatory for monetized uploads.
      if (!txref) {
        return res.status(402).json({
          error: 'A payment reference (tx_ref) is required for monetized uploads.',
        });
      }
      // Re-verify the payment server-side — the frontend already verified it, but we
      // guard against forged requests that skip the PayChangu popup entirely.
      try {
        const verifyResult = await verifyPaychanguTransaction(txref);
        if (verifyResult.status !== 'success') {
          return res.status(402).json({
            error: 'Payment could not be verified. Please contact support if you were charged.',
          });
        }
      } catch (verifyErr) {
        console.error('[songs/create] PayChangu re-verify failed:', verifyErr.message);
        return res.status(402).json({
          error: 'Payment verification service is unavailable. Please try again shortly.',
        });
      }
    }
    // For free uploads: strip any stray txref so a free song is never associated
    // with a payment reference, preventing any future confusion.
    const safeTxref = uploadType === 'monetized' ? (txref || '') : '';

    const userProfile = await dbGet(`users/${uid}`, req.idToken);

    const song = {
      title,
      genre,
      desc:       desc || '',
      tags:       Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      type:       type || 'free',
      uploadType, // 'free' | 'monetized'
      monetized:  uploadType === 'monetized', // boolean convenience flag
      price:      parseFloat(price) || 0,
      txref:      safeTxref,
      amountPaid: uploadType === 'monetized' ? (parseFloat(amount) || 0) : 0,
      audioUrl,
      artwork:    artworkUrl || '',
      lyrics:     (typeof lyrics === 'string' ? lyrics.slice(0, 20000) : ''),
      downloadable: req.body.downloadable !== false, // default true
      duration:   duration || '0:00',
      artistId:   uid,
      artist:     artist || userProfile?.username || userProfile?.name || 'Unknown',
      plays:      0,
      downloads:  0,
      likes:      0,
      status:     'active',   // live immediately; admin can verify or reject
      verified:   false,       // becomes true when admin approves
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
      message: 'Song uploaded successfully! It is now live on the platform.',
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

        // Record the play in the per-day log (real weekly/monthly charts)
        const today = dayKey(new Date());
        const dailyKey = `playsDaily/${songId}/${today}`;
        const todayCount = await dbGet(dailyKey, req.idToken);
        await dbSet(dailyKey, (todayCount || 0) + 1, req.idToken);

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

// ── Record a download ─────────────────────────────────────────
router.post('/:id/download', optionalAuth, async (req, res) => {
  try {
    const songId = req.params.id;
    // Only persist if we have an auth token (Firebase rules require auth for writes)
    if (req.idToken) {
      const song = await dbGet(`songs/${songId}`, req.idToken);
      if (song) {
        const newDownloads = (song.downloads || 0) + 1;
        await dbUpdate(`songs/${songId}`, { downloads: newDownloads }, req.idToken);
        return res.json({ downloads: newDownloads });
      }
    }
    res.json({ downloads: null }); // guest download — not persisted
  } catch (err) {
    console.error('[songs/download]', err.message);
    res.status(500).json({ error: 'Failed to record download' });
  }
});

// ── Delete song (owner only) ──────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const uid  = req.user.localId;
    const song = await dbGet(`songs/${req.params.id}`, req.idToken);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    if (song.artistId !== uid) {
      return res.status(403).json({ error: 'You can only delete your own songs' });
    }

    await dbDelete(`songs/${req.params.id}`, req.idToken);
    // Best-effort cleanup: remove the song's comments
    try { await dbDelete(`comments/${req.params.id}`, req.idToken); } catch (_) {}

    res.json({ message: 'Song deleted successfully' });
  } catch (err) {
    console.error('[songs/delete]', err.message);
    res.status(500).json({ error: 'Failed to delete song' });
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
