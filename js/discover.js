/* ================================================================
   DUODROP — Discover, Trending, Playlists, Artists pages
   ================================================================ */

function renderDiscover() {
  const songs   = DB.Songs.trending(8);
  const artists = DB.Artists.topArtists(6);
  const recent  = DB.Songs.recent(6);
  const stats   = DB.Stats.total();

  // Hero stats
  animateCount('hs-songs',   stats.songs);
  animateCount('hs-artists', stats.artists);
  animateCount('hs-plays',   stats.plays);

  // Hot songs
  const hotEl = document.getElementById('hot-songs');
  if (hotEl) hotEl.innerHTML = songs.length
    ? songs.map(s => songCard(s)).join('')
    : '<p class="dim">No songs yet.</p>';

  // Featured artists
  const artEl = document.getElementById('featured-artists');
  if (artEl) artEl.innerHTML = artists.length
    ? artists.map(a => artistScrollCard(a)).join('')
    : '<p class="dim">No artists yet.</p>';

  // Curated playlists
  const plEl = document.getElementById('curated-playlists');
  if (plEl) {
    const pls = DB.Playlists.curated();
    plEl.innerHTML = pls.map(pl => `
      <div class="playlist-card" style="--pl-color:${pl.color||'#333'};" onclick="playPlaylist('${pl.id}')">
        <div class="plc-cover">${pl.emoji || '🎶'}</div>
        <div class="plc-name">${pl.name}</div>
        <div class="plc-count">${(pl.songs||[]).length} songs</div>
        <div class="plc-desc">${pl.desc||''}</div>
      </div>`).join('');
  }

  // New releases
  const newEl = document.getElementById('new-releases');
  if (newEl) newEl.innerHTML = recent.map((s, i) => songRow(s, i+1)).join('');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = fmtNum(current);
    if (current >= target) clearInterval(timer);
  }, 40);
}

function artistScrollCard(a) {
  const songs = DB.Songs.byArtist(a.id);
  const plays = songs.reduce((s, x) => s + (x.plays || 0), 0);
  return `<div class="artist-scroll-card" onclick="viewArtist('${a.id}')">
    <div class="asc-avatar">${a.username.slice(0,2).toUpperCase()}</div>
    <div class="asc-name">${a.name}</div>
    <div class="asc-plays">▶ ${fmtNum(plays)}</div>
  </div>`;
}

// ── Trending ──────────────────────────────────────────────────
let _activeGenre = '';

function renderTrending() {
  const genres = [...new Set(DB.Songs.all().map(s => s.genre))].filter(Boolean);
  const filterEl = document.getElementById('genre-filter');
  if (filterEl) {
    filterEl.innerHTML = `<button class="genre-pill ${!_activeGenre ? 'active' : ''}" onclick="filterGenre('')">All</button>` +
      genres.map(g => `<button class="genre-pill ${_activeGenre === g ? 'active' : ''}" onclick="filterGenre('${g}')">${g}</button>`).join('');
  }
  renderTrendingList();
}

function filterGenre(genre) {
  _activeGenre = genre;
  document.querySelectorAll('.genre-pill').forEach(p => p.classList.toggle('active', p.textContent === (genre || 'All')));
  renderTrendingList();
}

function renderTrendingList() {
  const songs = DB.Songs.trending(30, _activeGenre);
  const el    = document.getElementById('trending-list');
  if (!el) return;
  el.innerHTML = songs.length
    ? songs.map((s, i) => songRow(s, i + 1)).join('')
    : '<div class="empty-state"><div class="es-icon">🔥</div><p>No songs in this genre yet</p></div>';
}

// ── Playlists ─────────────────────────────────────────────────
function renderPlaylists() {
  const el = document.getElementById('page-playlists');
  if (!el) return;
  const pls = DB.Playlists.all();
  const cu = DB.Users.current();
  
  let gridHTML = pls.length
    ? pls.map(pl => `
      <div class="premium-playlist-card" onclick="playPlaylist('${pl.id}')" style="--pl-color: ${pl.color || '#CE1126'};">
        <div class="ppc-cover" style="background: linear-gradient(135deg, ${pl.color || '#CE1126'}, #111);">
          <div class="ppc-emoji">${pl.emoji || '🎶'}</div>
          <button class="ppc-play-btn"><i data-lucide="play" fill="currentColor"></i></button>
        </div>
        <div class="ppc-info">
          <h3 class="ppc-title">${pl.name}</h3>
          <div class="ppc-meta">${(pl.songs || []).length} songs</div>
          <p class="ppc-desc">${pl.desc || 'A collection of great tracks.'}</p>
        </div>
      </div>`).join('')
    : '<div class="empty-state"><div class="es-icon">🎶</div><p>No playlists yet. Be the first to create one!</p></div>';

  el.innerHTML = `
    <div class="page-content">
      <div class="premium-hero">
        <div class="ph-content">
          <div class="ph-badge">Curated Collections</div>
          <h1 class="ph-title">Discover <span class="ph-accent">Playlists</span></h1>
          <p class="ph-sub">Explore handcrafted vibes for every mood or create your own custom mix to share with the world.</p>
          ${cu ? `<button class="btn btn-primary btn-lg" style="margin-top:20px;" onclick="promptCreatePlaylist()">
            <i data-lucide="plus-circle"></i> Create Playlist
          </button>` : `<button class="btn btn-outline btn-lg" style="margin-top:20px;" onclick="openAuthModal('login')">
            <i data-lucide="log-in"></i> Log in to Create
          </button>`}
        </div>
        <div class="ph-visual">
          <div class="ph-card-stack">
            <div class="ph-card" style="background:#CE1126; transform:rotate(-10deg) translate(-20px, 20px);">🎵</div>
            <div class="ph-card" style="background:#FCC417; transform:rotate(0deg) translate(0, 0); z-index:2; font-size:48px;">🔥</div>
            <div class="ph-card" style="background:#00522A; transform:rotate(10deg) translate(20px, 20px);">🎧</div>
          </div>
        </div>
      </div>
      
      <div class="section-hdr" style="margin-top: 40px;">
        <h2 class="section-title">All Playlists</h2>
      </div>
      <div class="premium-playlist-grid">
        ${gridHTML}
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

window.promptCreatePlaylist = function() {
  const cu = DB.Users.current();
  if (!cu) return;
  const name = prompt('Enter a name for your new playlist:');
  if (!name) return;
  
  const colors = ['#CE1126', '#FCC417', '#00522A', '#0077b6', '#f72585', '#7b2d8b'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const emojis = ['🔥', '🎵', '🎧', '🎸', '🎹', '🥁', '🎷', '🎺', '🎻', '📻'];
  const emoji = emojis[Math.floor(Math.random() * emojis.length)];

  const pl = {
    id: 'pl_' + Date.now(),
    name,
    desc: 'Created by ' + cu.username,
    color,
    emoji,
    songs: [],
    creatorId: cu.id,
    createdAt: new Date().toISOString()
  };
  
  DB.get().playlists.push(pl);
  DB.save();
  renderPlaylists();
  showToast('Playlist created!', 'success');
};

// ── Artists grid ──────────────────────────────────────────────
function renderArtists() {
  const el = document.getElementById('artists-grid');
  if (!el) return;
  const artists = DB.Artists.topArtists(20);
  el.innerHTML = artists.length
    ? artists.map(a => artistCard(a)).join('')
    : '<div class="empty-state"><div class="es-icon">🎤</div><p>No artists yet</p></div>';
}
