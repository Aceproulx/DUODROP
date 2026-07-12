/* =================================================================
   DUODROP — Admin Routes
   GET  /api/admin/stats             — platform stats
   GET  /api/admin/songs/pending     — pending uploads
   PATCH /api/admin/songs/:id        — approve / reject
   GET  /api/admin/users             — list all users
   PATCH /api/admin/users/:id/ban    — ban / unban user
   ================================================================= */
const router = require('express').Router();
const { dbGet, dbUpdate } = require('../config/firebase');
const { requireAuth } = require('../middleware/auth');

// ── Admin role check ──────────────────────────────────────────
async function requireAdmin(req, res, next) {
  try {
    const profile = await dbGet(`users/${req.user.localId}`, req.idToken);
    if (!profile || profile.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminProfile = profile;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Access denied' });
  }
}

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ── Platform stats ────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [songs, users] = await Promise.all([
      dbGet('songs', req.idToken),
      dbGet('users', req.idToken),
    ]);

    const songList = songs ? Object.values(songs) : [];
    const userList = users ? Object.values(users) : [];

    res.json({
      totalSongs:    songList.filter(s => s.status === 'approved').length,
      pendingSongs:  songList.filter(s => s.status === 'pending').length,
      rejectedSongs: songList.filter(s => s.status === 'rejected').length,
      totalUsers:    userList.length,
      totalArtists:  userList.filter(u => u.role === 'artist').length,
      totalFans:     userList.filter(u => u.role === 'fan').length,
      totalPlays:    songList.reduce((sum, s) => sum + (s.plays || 0), 0),
      bannedUsers:   userList.filter(u => u.status === 'banned').length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── Pending uploads ───────────────────────────────────────────
router.get('/songs/pending', async (req, res) => {
  try {
    const raw = await dbGet('songs', req.idToken);
    if (!raw) return res.json({ songs: [] });
    const pending = Object.entries(raw)
      .map(([id, s]) => ({ ...s, id }))
      .filter(s => s.status === 'pending')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    res.json({ songs: pending });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending songs' });
  }
});

// ── Approve / reject song ─────────────────────────────────────
router.patch('/songs/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    }
    await dbUpdate(`songs/${req.params.id}`, {
      status,
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.localId,
    }, req.idToken);
    res.json({ message: `Song ${status} successfully` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update song' });
  }
});

// ── List all users ────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const raw = await dbGet('users', req.idToken);
    if (!raw) return res.json({ users: [] });
    const users = Object.entries(raw)
      .map(([id, u]) => ({ ...u, id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── Ban / unban user ──────────────────────────────────────────
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body;
    await dbUpdate(`users/${req.params.id}`, { status: banned ? 'banned' : 'active' }, req.idToken);
    res.json({ message: banned ? 'User banned' : 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ── All songs (for admin view) ────────────────────────────────
router.get('/songs', async (req, res) => {
  try {
    const raw = await dbGet('songs', req.idToken);
    if (!raw) return res.json({ songs: [] });
    const songs = Object.entries(raw)
      .map(([id, s]) => ({ ...s, id }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

module.exports = router;
