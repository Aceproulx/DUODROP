/* =================================================================
   DUODROP — Seed Route
   POST /api/seed   — push demo data to Firebase Realtime Database
   This replaces the client-side localStorage seed in data.js.
   Credentials never leave the server — they live in .env only.
   ================================================================= */
const router = require('express').Router();
const { dbGet, dbSet, dbUpdate, signUp, uid } = require('../config/firebase');
const cloudinary = require('../config/cloudinary');

/* ── Demo artists ─────────────────────────────────────────── */
const DEMO_ARTISTS = [
  {
    username: 'Helis-Aeon', name: 'Helis Aeon',
    email: 'helis@duodrop.demo', bio: 'Afrobeats artist from Blantyre. Inspired by the streets and the stars.',
    genre: 'Afrobeats',
  },
  {
    username: 'Five-Dino', name: 'Five G Dino',
    email: 'fivedino@duodrop.demo', bio: 'Gospel and praise artist bringing hope through music from Lilongwe.',
    genre: 'Gospel',
  },
  {
    username: 'TamandaVox', name: 'Tamanda Vox',
    email: 'tamanda@duodrop.demo', bio: 'R&B songstress with a voice that moves mountains. Based in Mzuzu.',
    genre: 'R&B / Soul',
  },
  {
    username: 'BlakeCool', name: 'Blake C. Phiri',
    email: 'blake@duodrop.demo', bio: 'Hip-hop lyricist. Words are my weapon. Born and bred in Zomba.',
    genre: 'Hip-Hop',
  },
  {
    username: 'GraceSound', name: 'Grace Banda',
    email: 'grace@duodrop.demo', bio: 'Traditional Malawian sounds with a modern twist. Balaka born.',
    genre: 'Traditional',
  },
];

const SONG_TITLES = [
  ['Dzuka Dzuka', 'Malawi Night', 'Sunrise Vibes', 'Street Dreams', 'Mvura Ya Chisomo'],
  ['Yesu Ndi Wanga', 'Hallelujah Malawi', 'Praise Him Always', 'Glory to God', 'Chikondi Cha Ambuye'],
  ['Ndikukonda', 'My Heart Sings', 'Beautiful Soul', 'Love in Lilongwe', 'City Lights'],
  ['Mau Anga', 'Street Bars', 'Lyrically Blessed', 'Zomba City', 'Real Talk'],
  ['Gule Wamkulu', 'Nyimbo Za Makolo', 'Traditional Love', 'Roots & Culture', 'Ku Malawi'],
];

const GENRES = ['Afrobeats','Gospel','R&B / Soul','Hip-Hop','Traditional','Malawi Pop','Praise & Worship','Reggae'];

const DEMO_PASSWORD = 'DuoDrop@Demo2025!'; // single safe password for all demo accounts

/* ── Generate a Cloudinary placeholder artwork via URL transformation ── */
function cloudinaryPlaceholder(artistName, songTitle, colorHex) {
  // Uses Cloudinary text overlay on a colored background — no upload needed
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const color  = colorHex.replace('#', '');
  const text   = encodeURIComponent(songTitle.slice(0, 20));
  const artist = encodeURIComponent(artistName.slice(0, 16));
  return `https://res.cloudinary.com/${cloud}/image/upload/` +
    `b_rgb:${color},w_500,h_500,c_fill/` +
    `l_text:Arial_Bold_40:${text},co_white,g_center,y_-30/` +
    `l_text:Arial_26:${artist},co_white,g_center,y_30/` +
    `v1/duodrop/placeholder`;
}

const GENRE_COLORS = {
  'Afrobeats': '#f72585', 'Gospel': '#00522A', 'Hip-Hop': '#7209b7',
  'R&B / Soul': '#3a0ca3', 'Reggae': '#2dc653', 'Malawi Pop': '#CE1126',
  'Praise & Worship': '#FCC417', 'Traditional': '#7b2d8b', 'Other': '#555',
};

/* ── Seed endpoint ──────────────────────────────────────────── */
router.post('/', async (req, res) => {
  // Protect with a simple secret so only admins can trigger it
  const { secret } = req.body;
  if (secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: 'Invalid seed secret' });
  }

  const results = { artists: [], songs: [], skipped: 0, errors: [] };

  try {
    for (let ai = 0; ai < DEMO_ARTISTS.length; ai++) {
      const a = DEMO_ARTISTS[ai];

      /* 1. Create Firebase Auth account */
      let authData;
      try {
        authData = await signUp(a.email, DEMO_PASSWORD);
      } catch (err) {
        if (err.message.includes('EMAIL_EXISTS')) {
          results.skipped++;
          results.errors.push(`${a.email}: already exists (skipped)`);
          continue;
        }
        throw err;
      }

      const { localId, idToken } = authData;
      const refCode = 'REF-' + a.username.toUpperCase().slice(0, 8) + Math.floor(Math.random() * 999);

      /* 2. Save user profile to RTDB */
      const profile = {
        id: localId, username: a.username, name: a.name,
        email: a.email, role: 'artist', bio: a.bio,
        avatar: '', status: 'active', refCode,
        phone: '', social: {}, createdAt: new Date().toISOString(),
      };
      await dbSet(`users/${localId}`, profile, idToken);

      /* 3. Create artist node */
      const artistNode = {
        id: localId, username: a.username, name: a.name,
        avatar: '', bio: a.bio, followers: 80 + ai * 15,
        verified: false, genre: a.genre,
        createdAt: new Date().toISOString(),
      };
      await dbSet(`artists/${localId}`, artistNode, idToken);
      results.artists.push(a.username);

      /* 4. Upload songs */
      const titles = SONG_TITLES[ai] || SONG_TITLES[0];
      for (let si = 0; si < titles.length; si++) {
        const title  = titles[si];
        const genre  = GENRES[(ai + si) % GENRES.length];
        const color  = GENRE_COLORS[genre] || '#333';
        const plays  = 200 + ai * 300 + si * 150 + Math.floor(Math.random() * 500);
        const isPrem = si === 2;

        /* 4a. Generate Cloudinary artwork (text overlay — no upload needed) */
        const artworkUrl = cloudinaryPlaceholder(a.name, title, color);

        /* 4b. We don't have real audio files for demo songs.
               We set audioUrl to empty; admin can upload real audio later.
               The song still appears in listings. */
        const song = {
          title, genre,
          desc:      `An amazing track from ${a.name}. Feel the Malawian rhythm.`,
          tags:      ['malawi', genre.toLowerCase().replace(/\s+/g, '-')],
          type:      isPrem ? 'premium' : 'free',
          price:     isPrem ? 500 : 0,
          txref:     'DEMO-' + uid(),
          artwork:   artworkUrl,
          audioUrl:  '',       // No real audio for demo seeds
          duration:  `${2 + Math.floor(Math.random() * 3)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
          artistId:  localId,
          artist:    a.username,
          plays,
          downloads: 0,
          likes:     Math.floor(plays * 0.1),
          status:    'approved',
          createdAt: new Date().toISOString(),
        };

        const songRef = await fetch(
          `${process.env.FIREBASE_DATABASE_URL}/songs.json?auth=${idToken}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(song) }
        );
        const { name: songId } = await songRef.json();

        /* 4c. Store play counts */
        await fetch(
          `${process.env.FIREBASE_DATABASE_URL}/plays/${songId}.json?auth=${idToken}`,
          { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(plays) }
        );

        results.songs.push(`${a.username}: ${title}`);
      }
    }

    /* 5. Seed curated playlists */
    const allSongsRes = await dbGet('songs');
    if (allSongsRes) {
      const allSongs = Object.entries(allSongsRes).map(([id, s]) => ({ ...s, id }));
      const playlists = [
        { name: 'Malawi Hits 2024',   desc: 'Top tracks from Malawi this year',        curated: true, color: '#CE1126' },
        { name: 'Gospel Vibes',       desc: 'Praise and worship to lift your spirit',  curated: true, color: '#00522A' },
        { name: 'Friday Night Jams',  desc: 'Start your weekend with these bangers',   curated: true, color: '#FCC417' },
        { name: 'Chill Afternoon',    desc: 'Relax and unwind with smooth sounds',     curated: true, color: '#0077b6' },
        { name: 'Afrobeats Party Mix',desc: 'Get the party started with Afro energy', curated: true, color: '#f72585' },
        { name: 'Traditional Roots',  desc: 'Authentic Malawian cultural sounds',      curated: true, color: '#7b2d8b' },
      ];
      for (let i = 0; i < playlists.length; i++) {
        const pl = playlists[i];
        pl.songs    = allSongs.filter((_, idx) => idx % 6 === i).map(s => s.id);
        pl.coverArt = pl.color;
        pl.createdAt = new Date().toISOString();
        await fetch(
          `${process.env.FIREBASE_DATABASE_URL}/playlists.json`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pl) }
        );
      }
    }

    res.json({
      message: 'Seed complete!',
      artists: results.artists,
      songsCreated: results.songs.length,
      skipped: results.skipped,
      warnings: results.errors,
    });

  } catch (err) {
    console.error('[seed]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
