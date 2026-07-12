/* ================================================================
   DUODROP — Data Layer (localStorage CRUD + Seed Data)
   ================================================================ */

const DB = (() => {
  const KEY = 'duodrop_v2';

  const defaults = () => ({
    users:      [],
    songs:      [],
    artists:    [],
    playlists:  [],
    comments:   {},
    likes:      {},
    follows:    {},
    plays:      {},
    history:    [],
    earnings:   {},
    fanEarnings:{},
    referrals:  {},
    uploads:    [],
    settings:   { theme: 'dark' },
    currentUser: null,
  });

  let _data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      _data = raw ? JSON.parse(raw) : defaults();
      const def = defaults();
      Object.keys(def).forEach(k => { if (_data[k] === undefined) _data[k] = def[k]; });
      return _data;
    } catch { _data = defaults(); return _data; }
  }

  function save() { localStorage.setItem(KEY, JSON.stringify(_data)); }

  function get() { if (!_data) load(); return _data; }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ── Users / Auth ──────────────────────────────────────────
  const Users = {
    all()              { return get().users; },
    find(id)           { return get().users.find(u => u.id === id); },
    findByEmail(email) { return get().users.find(u => u.email.toLowerCase() === email.toLowerCase()); },
    findByUsername(u)  { return get().users.find(x => x.username.toLowerCase() === u.toLowerCase()); },

    create(data) {
      const user = {
        id:        uid(),
        username:  data.username,
        name:      data.name,
        email:     data.email,
        password:  data.password,
        role:      data.role || 'fan',
        phone:     data.phone || '',
        avatar:    data.avatar || '',
        bio:       '',
        status:    'active',
        social:    { website:'', facebook:'', instagram:'', twitter:'' },
        refCode:   'REF-' + data.username.toUpperCase().slice(0,8) + Math.floor(Math.random()*999),
        createdAt: new Date().toISOString(),
      };
      get().users.push(user);
      if (data.referral) {
        const referrer = Object.entries(get().referrals).find(([code]) => code === data.referral);
        if (referrer) {
          const refUserId = referrer[1];
          FanEarnings.credit(refUserId, 2, 'Referral: new user registered via your link');
        }
      }
      get().referrals[user.refCode] = user.id;
      save();
      return user;
    },

    update(id, updates) {
      const idx = get().users.findIndex(u => u.id === id);
      if (idx >= 0) { Object.assign(get().users[idx], updates); save(); return get().users[idx]; }
    },

    login(email, password) {
      const u = this.findByEmail(email);
      if (!u || u.password !== password) return null;
      get().currentUser = u.id;
      save();
      return u;
    },

    logout() { get().currentUser = null; save(); },

    current() {
      const id = get().currentUser;
      return id ? this.find(id) : null;
    },

    setSession(id) { get().currentUser = id; save(); },
  };

  // ── Songs ─────────────────────────────────────────────────
  const Songs = {
    all()           { return get().songs; },
    find(id)        { return get().songs.find(s => s.id === id); },
    byArtist(uid)   { return get().songs.filter(s => s.artistId === uid); },

    create(data, artistId) {
      const song = {
        id:          uid(),
        title:       data.title,
        genre:       data.genre,
        desc:        data.desc  || '',
        tags:        (data.tags || '').split(',').map(t => t.trim()).filter(Boolean),
        type:        data.type  || 'free',
        price:       parseFloat(data.price || 0),
        artwork:     data.artwork || '',
        audioUrl:    data.audioUrl || '',
        artistId:    artistId,
        plays:       0,
        downloads:   0,
        likes:       0,
        duration:    data.duration || '0:00',
        txref:       data.txref,
        status:      'approved',
        createdAt:   new Date().toISOString(),
      };
      get().songs.push(song);
      get().plays[song.id] = 0;
      save();
      return song;
    },

    incrementPlay(id) {
      const s = this.find(id);
      if (!s) return;
      s.plays = (s.plays || 0) + 1;
      get().plays[id] = s.plays;
      ArtistEarnings.creditPlay(s.artistId, id);
      const cu = Users.current();
      if (cu) History.add(cu.id, id);
      save();
    },

    trending(limit = 20, genre = '') {
      return [...get().songs]
        .filter(s => s.status === 'approved' && (!genre || s.genre === genre))
        .sort((a, b) => (b.plays || 0) - (a.plays || 0))
        .slice(0, limit);
    },

    recent(limit = 10) {
      return [...get().songs]
        .filter(s => s.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    },

    search(q) {
      const lq = q.toLowerCase();
      return get().songs.filter(s =>
        s.status === 'approved' && (
          s.title.toLowerCase().includes(lq) ||
          s.genre.toLowerCase().includes(lq) ||
          (s.tags || []).some(t => t.toLowerCase().includes(lq))
        )
      );
    },
  };

  // ── Artists ───────────────────────────────────────────────
  const Artists = {
    all()         { return get().users.filter(u => u.role === 'artist' || u.role === 'admin'); },
    find(id)      { return get().users.find(u => u.id === id && (u.role === 'artist' || u.role === 'admin')); },
    search(q)     { const lq = q.toLowerCase(); return get().users.filter(u => (u.role==='artist'||u.role==='admin') && (u.name.toLowerCase().includes(lq) || u.username.toLowerCase().includes(lq))); },

    followerCount(id) { return Object.values(get().follows).filter(set => set.includes(id)).length; },

    topArtists(limit = 10) {
      return get().users.filter(u => u.role === 'artist')
        .map(a => ({ ...a, _plays: Songs.byArtist(a.id).reduce((s, x) => s + (x.plays || 0), 0) }))
        .sort((a, b) => b._plays - a._plays)
        .slice(0, limit);
    },
  };

  // ── Likes ─────────────────────────────────────────────────
  const Likes = {
    get(userId)        { return get().likes[userId] || []; },
    isLiked(userId, songId) { return this.get(userId).includes(songId); },
    toggle(userId, songId) {
      if (!get().likes[userId]) get().likes[userId] = [];
      const arr = get().likes[userId];
      const idx = arr.indexOf(songId);
      const song = Songs.find(songId);
      if (idx >= 0) {
        arr.splice(idx, 1);
        if (song) song.likes = Math.max(0, (song.likes || 0) - 1);
      } else {
        arr.push(songId);
        if (song) song.likes = (song.likes || 0) + 1;
      }
      save();
      return idx < 0;
    },
  };

  // ── Follows ───────────────────────────────────────────────
  const Follows = {
    get(userId)               { return get().follows[userId] || []; },
    isFollowing(userId, artId){ return this.get(userId).includes(artId); },
    toggle(userId, artId) {
      if (!get().follows[userId]) get().follows[userId] = [];
      const arr = get().follows[userId];
      const idx = arr.indexOf(artId);
      if (idx >= 0) arr.splice(idx, 1);
      else arr.push(artId);
      save();
      return idx < 0;
    },
  };

  // ── Comments ──────────────────────────────────────────────
  const Comments = {
    get(songId)    { return get().comments[songId] || []; },
    add(songId, userId, text) {
      if (!get().comments[songId]) get().comments[songId] = [];
      const user = Users.find(userId);
      const c = { id: uid(), userId, username: user?.username || 'Anonymous', text, ts: new Date().toISOString() };
      get().comments[songId].unshift(c);
      save();
      return c;
    },
    delete(songId, commentId, userId) {
      if (!get().comments[songId]) return;
      get().comments[songId] = get().comments[songId].filter(c => !(c.id === commentId && c.userId === userId));
      save();
    },
  };

  // ── History ───────────────────────────────────────────────
  const History = {
    add(userId, songId)  { get().history.unshift({ userId, songId, ts: new Date().toISOString() }); if (get().history.length > 500) get().history.pop(); save(); },
    forUser(userId, n=20){ return get().history.filter(h => h.userId === userId).slice(0, n); },
  };

  // ── Artist Earnings ───────────────────────────────────────
  const ArtistEarnings = {
    get(artistId) { return get().earnings[artistId] || { balance: 0, totalPlays: 0, history: [] }; },

    creditPlay(artistId, songId) {
      const artist = Users.find(artistId);
      if (!artist) return;
      const followers = Artists.followerCount(artistId);
      const song      = Songs.find(songId);
      if (!song) return;
      if (followers >= 100) {
        if (!get().earnings[artistId]) get().earnings[artistId] = { balance: 0, totalPlays: 0, history: [] };
        const e = get().earnings[artistId];
        e.balance    += 1;
        e.totalPlays  = (e.totalPlays || 0) + 1;
        e.history.unshift({ type: 'play', amount: 1, songId, songTitle: song.title, ts: new Date().toISOString() });
        if (e.history.length > 200) e.history.pop();
      }
    },

    canWithdraw(artistId) {
      const e = this.get(artistId);
      const followers = Artists.followerCount(artistId);
      const songs     = Songs.byArtist(artistId);
      const hasSongWith1000Plays = songs.some(s => (s.plays || 0) >= 1000);
      return followers >= 100 && hasSongWith1000Plays && e.balance >= 1;
    },

    withdraw(artistId, amount) {
      const e = get().earnings[artistId];
      if (!e || e.balance < amount) return false;
      e.balance -= amount;
      e.history.unshift({ type: 'withdraw', amount: -amount, ts: new Date().toISOString() });
      save();
      return true;
    },
  };

  // ── Fan Earnings ─────────────────────────────────────────
  const FanEarnings = {
    get(userId) { return get().fanEarnings[userId] || { balance: 0, shares: [] }; },

    credit(userId, amount, note) {
      if (!get().fanEarnings[userId]) get().fanEarnings[userId] = { balance: 0, shares: [] };
      get().fanEarnings[userId].balance += amount;
      get().fanEarnings[userId].shares.unshift({ amount, note, ts: new Date().toISOString() });
      save();
    },

    shareLink(userId) {
      const user = Users.find(userId);
      return user ? `https://duodrop.mw/join?ref=${user.refCode}` : '';
    },

    recordShare(userId, songId) {
      FanEarnings.credit(userId, 2, `Shared song: ${Songs.find(songId)?.title || songId}`);
    },
  };

  // ── Playlists ─────────────────────────────────────────────
  const Playlists = {
    all()     { return get().playlists; },
    find(id)  { return get().playlists.find(p => p.id === id); },
    curated() { return get().playlists.filter(p => p.curated); },
  };

  // ── Settings ─────────────────────────────────────────────
  const Settings = {
    get()         { return get().settings; },
    set(k, v)     { get().settings[k] = v; save(); },
    theme()       { return get().settings.theme || 'dark'; },
    setTheme(t)   { this.set('theme', t); },
  };

  // ── Stats ─────────────────────────────────────────────────
  const Stats = {
    total() {
      const songs   = Songs.all().length;
      const artists = get().users.filter(u => u.role === 'artist').length;
      const plays   = Object.values(get().plays).reduce((a, b) => a + b, 0);
      const fans    = get().users.filter(u => u.role === 'fan').length;
      return { songs, artists, plays, fans, users: get().users.length };
    },
  };

  // ── Seed stub ──────────────────────────────────────────────
  // Demo data is now seeded from the server via POST /api/seed.
  // No hardcoded credentials, passwords, or personal emails live here.
  // See server/routes/seed.js and server/SETUP.md for details.
  function seed() {
    // Client-side seeding has been removed.
    // Call POST /api/seed (with secret) from the admin panel or a script.
  }

  return { get, save, load, seed, uid, Users, Songs, Artists, Likes, Follows, Comments, History, ArtistEarnings, FanEarnings, Playlists, Settings, Stats };
})();

// Initialize local cache from localStorage (server data merges in on boot via loadServerData)
DB.load();
