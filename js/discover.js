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
  const el = document.getElementById('playlists-grid');
  if (!el) return;
  const pls = DB.Playlists.all();
  el.innerHTML = pls.length
    ? pls.map(pl => `
      <div class="playlist-grid-card" style="border-top:4px solid ${pl.color||'#333'};">
        <div class="pgc-top" onclick="playPlaylist('${pl.id}')">
          <div class="pgc-emoji">${pl.emoji || '🎶'}</div>
          <div>
            <div class="pgc-name">${pl.name}</div>
            <div class="pgc-count">${(pl.songs||[]).length} songs</div>
          </div>
        </div>
        <p class="pgc-desc">${pl.desc || ''}</p>
        <div class="pgc-songs">
          ${(pl.songs || []).slice(0,3).map(sid => {
            const s = DB.Songs.find(sid);
            const a = s ? DB.Users.find(s.artistId) : null;
            return s ? `<div class="pgc-song" onclick="playSong('${sid}')">🎵 ${s.title} — ${a?.name||'?'}</div>` : '';
          }).join('')}
        </div>
        <button class="btn btn-primary btn-sm btn-block" onclick="playPlaylist('${pl.id}')">▶ Play Playlist</button>
      </div>`).join('')
    : '<div class="empty-state"><div class="es-icon">🎶</div><p>No playlists yet</p></div>';
}

// ── Artists grid ──────────────────────────────────────────────
function renderArtists() {
  const el = document.getElementById('artists-grid');
  if (!el) return;
  const artists = DB.Artists.topArtists(20);
  el.innerHTML = artists.length
    ? artists.map(a => artistCard(a)).join('')
    : '<div class="empty-state"><div class="es-icon">🎤</div><p>No artists yet</p></div>';
}
