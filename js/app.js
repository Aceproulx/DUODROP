/* ================================================================
   DUODROP — App Core (routing, navigation, auth, search, utils)
   ================================================================ */

// ── Page routing ──────────────────────────────────────────────
let _currentPage = 'discover';

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  const nav = document.querySelector(`[data-page="${name}"]`);
  if (nav) nav.classList.add('active');

  _currentPage = name;
  closeSidebar();

  const refreshers = {
    discover:        renderDiscover,
    trending:        renderTrending,
    charts:          renderCharts,
    playlists:       renderPlaylists,
    artists:         renderArtists,
    library:         renderLibrary,
    dashboard:       renderDashboard,
    earnings:        renderEarnings,
    settings:        renderSettings,
    profile:         renderMyProfile,
    admin:           renderAdminDashboard,
    about:           renderAbout,
  };
  if (refreshers[name]) refreshers[name]();
}

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ── Nav click wiring ──────────────────────────────────────────
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page); });
});

// ── Toast ────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.className = `toast show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.className = 'toast', 3500);
}

// ── Modals ────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ── CAPTCHA (Cloudflare Turnstile) ─────────────────────────
let _loginCaptchaToken = null;
let _regCaptchaToken   = null;

// Called by Turnstile before the widget becomes interactive (still loading)
function onLoginTurnstileBeforeInteractive() {
  document.getElementById('login-turnstile')?.closest('.turnstile-wrap')?.classList.add('captcha-loading');
}
function onRegTurnstileBeforeInteractive() {
  document.getElementById('reg-turnstile')?.closest('.turnstile-wrap')?.classList.add('captcha-loading');
}

function onLoginTurnstileSuccess(token) {
  _loginCaptchaToken = token;
  document.getElementById('err-login-captcha').textContent = '';
  document.getElementById('login-turnstile')?.closest('.turnstile-wrap')?.classList.remove('captcha-loading');
}
function onRegTurnstileSuccess(token) {
  _regCaptchaToken = token;
  document.getElementById('err-reg-captcha').textContent = '';
  document.getElementById('reg-turnstile')?.closest('.turnstile-wrap')?.classList.remove('captcha-loading');
}
function onTurnstileError() {
  _loginCaptchaToken = null;
  _regCaptchaToken = null;
  document.querySelectorAll('.turnstile-wrap').forEach(w => w.classList.remove('captcha-loading'));
  showToast('Captcha verification failed. Please try again.', 'error');
}

function verifyLoginCaptcha() {
  // ⚠ CAPTCHA DISABLED FOR TESTING — re-enable before going live
  return true;
  // const errEl = document.getElementById('err-login-captcha');
  // if (!_loginCaptchaToken) { errEl.textContent = '⚠ Please complete the captcha.'; return false; }
  // errEl.textContent = '';
  // return true;
}

function verifyRegCaptcha() {
  // ⚠ CAPTCHA DISABLED FOR TESTING — re-enable before going live
  return true;
  // const errEl = document.getElementById('err-reg-captcha');
  // if (!_regCaptchaToken) { errEl.textContent = '⚠ Please complete the captcha.'; return false; }
  // errEl.textContent = '';
  // return true;
}

// ── Auth ─────────────────────────────────────────────────────
function openAuthModal(tab) {
  // Guard: if called with a MouseEvent (from onclick), default to 'login'
  if (!tab || typeof tab !== 'string') tab = 'login';
  switchAuthTab(tab);
  openModal('modal-auth');
}

function switchAuthTab(tab) {
  // Normalize: anything that isn't explicitly 'register' defaults to 'login'
  const active = tab === 'register' ? 'register' : 'login';
  document.getElementById('auth-login').style.display    = active === 'login'    ? '' : 'none';
  document.getElementById('auth-register').style.display = active === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    active === 'login');
  document.getElementById('tab-register').classList.toggle('active', active === 'register');
  ['err-login','err-register','err-login-captcha','err-reg-captcha'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = '';
  });
  // Reset captchas
  if (window.turnstile) {
    _loginCaptchaToken = null;
    _regCaptchaToken   = null;
    try { turnstile.reset('#login-turnstile'); } catch (e) {}
    try { turnstile.reset('#reg-turnstile'); } catch (e) {}
  }
}

async function doLogin() {
  if (!verifyLoginCaptcha()) return;

  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-password').value;

  if (!email)    { document.getElementById('err-l-email').textContent = '⚠ Email is required.'; return; }
  if (!password) { document.getElementById('err-l-password').textContent = '⚠ Password is required.'; return; }

  const loginBtn = document.querySelector('#auth-login .btn-primary');
  if (loginBtn) loginBtn.disabled = true;

  try {
    const result = await API.auth.login(email, password, _loginCaptchaToken);
    const user   = result.user;
    // Sync into local DB cache
    DB.get().currentUser = user.id;
    if (!DB.Users.find(user.id)) DB.get().users.push(user);
    else Object.assign(DB.Users.find(user.id), user);
    DB.save();

    closeModal('modal-auth');
    updateUserUI();
    await loadServerData();
    showToast(`Welcome back, ${user.username}!`, 'success');
    showPage('discover');
  } catch (err) {
    document.getElementById('err-login').textContent = '⚠ ' + err.message;
    // Reset Turnstile on failed login
    if (window.turnstile) try { turnstile.reset('#login-turnstile'); } catch(e){}
    _loginCaptchaToken = null;
  } finally {
    if (loginBtn) loginBtn.disabled = false;
  }
}

async function doRegister() {
  if (!verifyRegCaptcha()) return;

  const username = document.getElementById('r-username').value.trim();
  const name     = document.getElementById('r-name').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const password = document.getElementById('r-password').value;
  const role     = document.getElementById('r-role').value;
  const phone    = document.getElementById('r-phone').value.trim();
  const referral = document.getElementById('r-referral').value.trim();

  let valid = true;
  if (!username) { document.getElementById('err-r-username').textContent = '⚠ Username is required.'; valid = false; }
  if (!name)     { document.getElementById('err-r-name').textContent = '⚠ Full name is required.'; valid = false; }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { document.getElementById('err-r-email').textContent = '⚠ Valid email required.'; valid = false; }
  if (!password || password.length < 8) { document.getElementById('err-r-password').textContent = '⚠ Password must be at least 8 characters.'; valid = false; }
  if (!valid) return;

  const regBtn = document.querySelector('#auth-register .btn-primary');
  if (regBtn) regBtn.disabled = true;

  try {
    const result = await API.auth.register({ username, name, email, password, role, phone, referral, cfToken: _regCaptchaToken });
    const user   = result.user;
    // Sync into local DB cache
    DB.get().currentUser = user.id;
    if (!DB.Users.find(user.id)) DB.get().users.push(user);
    DB.save();

    closeModal('modal-auth');
    updateUserUI();
    await loadServerData();
    showToast(`Welcome to DUODROP, ${username}!`, 'success');
    if (role === 'artist') showPage('upload');
    else showPage('discover');
  } catch (err) {
    document.getElementById('err-register').textContent = '⚠ ' + err.message;
    // Reset Turnstile on failed register
    if (window.turnstile) try { turnstile.reset('#reg-turnstile'); } catch(e){}
    _regCaptchaToken = null;
  } finally {
    if (regBtn) regBtn.disabled = false;
  }
}

function logout() {
  API.auth.logout();
  DB.Users.logout();
  updateUserUI();
  showToast('Signed out. See you soon!', 'info');
  showPage('discover');
}

window.handleAvatarClick = function() {
  const user = DB.Users.current();
  if (user) {
    showPage('profile');
  } else {
    openAuthModal('login');
  }
};

function updateUserUI() {
  const user = DB.Users.current();
  if (user) {
    const av = user.avatar
      ? `<img src="${user.avatar}" alt="">`
      : user.username.slice(0, 2).toUpperCase();
    ['su-avatar','tb-avatar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = av;
    });
    const nameEl = document.getElementById('su-name'); if (nameEl) nameEl.textContent = user.username;
    const roleEl = document.getElementById('su-role'); if (roleEl) roleEl.textContent = user.role === 'artist' ? 'Artist' : user.role === 'admin' ? 'Admin' : 'Fan';
    const btnEl  = document.querySelector('.su-btn'); if (btnEl) { btnEl.textContent = 'Sign Out'; btnEl.onclick = logout; }
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.style.display = user.role === 'admin' ? '' : 'none';
  } else {
    ['su-avatar','tb-avatar'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = '?'; });
    const nameEl = document.getElementById('su-name'); if (nameEl) nameEl.textContent = 'Guest';
    const roleEl = document.getElementById('su-role'); if (roleEl) roleEl.textContent = 'Fan';
    const btnEl  = document.querySelector('.su-btn'); if (btnEl) { btnEl.textContent = 'Sign In'; btnEl.onclick = () => openAuthModal('login'); }
    const adminLink = document.getElementById('admin-nav-link');
    if (adminLink) adminLink.style.display = 'none';
  }
}

// ── Global Search ─────────────────────────────────────────────
let _searchTimer;
function handleSearch(query) {
  const dd = document.getElementById('search-dropdown');
  clearTimeout(_searchTimer);
  if (!query.trim()) { dd.innerHTML = ''; dd.classList.remove('open'); return; }

  _searchTimer = setTimeout(() => {
    const songs   = DB.Songs.search(query).slice(0, 5);
    const artists = DB.Artists.search(query).slice(0, 3);

    if (!songs.length && !artists.length) { dd.innerHTML = '<div class="sdd-empty">No results found</div>'; dd.classList.add('open'); return; }

    let html = '';
    if (songs.length) {
      html += '<div class="sdd-section">🎵 Songs</div>';
      html += songs.map(s => {
        const artist = DB.Users.find(s.artistId);
        return `<div class="sdd-item" onclick="playSong('${s.id}');closeDd()">
          <div class="sdd-art">${s.artwork ? `<img src="${s.artwork}">` : '🎵'}</div>
          <div class="sdd-info"><div class="sdd-title">${s.title}</div><div class="sdd-sub">${artist?.name || '—'} · ${s.genre}</div></div>
          <span class="sdd-badge">${s.type === 'premium' ? '⭐' : '🆓'}</span>
        </div>`;
      }).join('');
    }
    if (artists.length) {
      html += '<div class="sdd-section">🎤 Artists</div>';
      html += artists.map(a => `<div class="sdd-item" onclick="viewArtist('${a.id}');closeDd()">
        <div class="sdd-art">${a.avatar ? `<img src="${a.avatar}">` : initials(a.username)}</div>
        <div class="sdd-info"><div class="sdd-title">${a.name}</div><div class="sdd-sub">@${a.username}</div></div>
      </div>`).join('');
    }

    dd.innerHTML = html;
    dd.classList.add('open');
  }, 250);
}

function closeDd() {
  document.getElementById('search-dropdown').classList.remove('open');
  document.getElementById('search-input').value = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.topbar-search')) closeDd();
});

// ── Artist profile ─────────────────────────────────────────────
function viewArtist(id) {
  const artist  = DB.Users.find(id);
  if (!artist) return;

  const songs     = DB.Songs.byArtist(id).filter(s => s.status === 'approved').sort((a,b) => (b.plays||0)-(a.plays||0));
  const followers = DB.Artists.followerCount(id);
  const cu        = DB.Users.current();
  const isFollowing = cu ? DB.Follows.isFollowing(cu.id, id) : false;
  const totalPlays  = songs.reduce((s, x) => s + (x.plays||0), 0);

  const avatarHtml = artist.avatar
    ? `<img src="${artist.avatar}" alt="${artist.username}">`
    : artist.username.slice(0,2).toUpperCase();

  const html = `
    <div class="artist-hero">
      <div class="ah-bg"></div>
      <div class="ah-content">
        <div class="ah-avatar">${avatarHtml}</div>
        <div class="ah-info">
          <h1 class="ah-name">${artist.name}</h1>
          <div class="ah-username">@${artist.username}</div>
          <p class="ah-bio">${artist.bio || 'No bio yet.'}</p>
          <div class="ah-stats">
            <div class="ahs"><strong>${followers}</strong><span>Followers</span></div>
            <div class="ahs"><strong>${songs.length}</strong><span>Songs</span></div>
            <div class="ahs"><strong>${fmtNum(totalPlays)}</strong><span>Plays</span></div>
          </div>
          <div class="ah-actions">
            ${cu && cu.id !== id
              ? `<button class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'}" onclick="toggleFollow('${id}',this)">${isFollowing ? '✓ Following' : '+ Follow'}</button>`
              : ''}
            <button class="btn btn-outline" onclick="shareArtist('${id}')">🔗 Share</button>
          </div>
        </div>
      </div>
    </div>
    <div class="page-content">
      <div class="section">
        <h2 class="section-title">🎵 Songs (${songs.length})</h2>
        ${songs.length ? `<div class="song-list">${songs.map((s,i) => songRow(s, i+1)).join('')}</div>`
          : '<p class="dim">No songs uploaded yet.</p>'}
      </div>
    </div>`;

  document.getElementById('artist-profile-content').innerHTML = html;
  showPage('artist-profile');
}

function toggleFollow(artistId, btn) {
  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); return; }
  const isNow = DB.Follows.toggle(cu.id, artistId);
  if (btn) { btn.className = isNow ? 'btn btn-outline' : 'btn btn-primary'; btn.textContent = isNow ? '✓ Following' : '+ Follow'; }
  showToast(isNow ? 'Following! 🎤' : 'Unfollowed', isNow ? 'success' : 'info');
}

function shareArtist(id) {
  const cu = DB.Users.current();
  const link = `https://duodrop.mw/artist/${id}${cu ? `?ref=${DB.Users.find(cu.id)?.refCode||''}` : ''}`;
  copyToClipboard(link);
  if (cu) DB.FanEarnings.credit(cu.id, 2, 'Shared artist profile');
  showToast('🔗 Artist link copied! You earned MK 2!', 'success');
}

// ── Song actions ─────────────────────────────────────────────
function toggleLikeSong(songId, btn) {
  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); return; }
  const isLiked = DB.Likes.toggle(cu.id, songId);
  if (btn) btn.textContent = isLiked ? '❤️' : '🤍';
  showToast(isLiked ? '❤️ Added to Liked Songs' : 'Removed from liked', isLiked ? 'success' : 'info');
  updateLikeBtn(songId);
}

function updateLikeBtn(songId) {
  const cu = DB.Users.current();
  const liked = cu ? DB.Likes.isLiked(cu.id, songId) : false;
  document.querySelectorAll(`[data-like-id="${songId}"]`).forEach(b => b.textContent = liked ? '❤️' : '🤍');
  const pbLike = document.getElementById('pb-like-btn');
  if (pbLike && window._currentSong?.id === songId) pbLike.textContent = liked ? '❤️' : '🤍';
}

function toggleLikeCurrent() {
  if (window._currentSong) toggleLikeSong(window._currentSong.id);
}

function openComments(songId) {
  const song     = DB.Songs.find(songId);
  const comments = DB.Comments.get(songId);
  window._commentSongId = songId;
  document.getElementById('comment-modal-title').textContent = `💬 ${song?.title || 'Comments'}`;
  renderComments(comments);
  openModal('modal-comment');
}

function renderComments(comments) {
  const cu = DB.Users.current();
  const el = document.getElementById('comments-list');
  if (!comments.length) { el.innerHTML = '<p class="dim" style="padding:12px;">No comments yet. Be the first!</p>'; return; }
  el.innerHTML = comments.map(c => `
    <div class="comment-item">
      <div class="ci-avatar">${c.username.slice(0,2).toUpperCase()}</div>
      <div class="ci-body">
        <div class="ci-meta"><strong>${c.username}</strong> <span>${timeAgo(c.ts)}</span></div>
        <div class="ci-text">${escHtml(c.text)}</div>
      </div>
      ${cu && cu.id === c.userId ? `<button class="ci-del" onclick="deleteComment('${c.id}')">✕</button>` : ''}
    </div>`).join('');
}

function postComment() {
  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); return; }
  const input = document.getElementById('comment-input');
  const text  = input.value.trim();
  if (!text || text.length < 1) { showToast('Comment cannot be empty', 'error'); return; }
  if (text.length > 500) { showToast('Comment too long (max 500 chars)', 'error'); return; }
  DB.Comments.add(window._commentSongId, cu.id, text);
  input.value = '';
  renderComments(DB.Comments.get(window._commentSongId));
}

function deleteComment(commentId) {
  const cu = DB.Users.current();
  if (!cu) return;
  DB.Comments.delete(window._commentSongId, commentId, cu.id);
  renderComments(DB.Comments.get(window._commentSongId));
}

function shareCurrentSong() {
  if (window._currentSong) shareSong(window._currentSong.id);
}

function shareSong(songId) {
  const cu   = DB.Users.current();
  const song = DB.Songs.find(songId);
  const link = `https://duodrop.mw/song/${songId}${cu ? `?ref=${DB.Users.find(cu.id)?.refCode||''}` : ''}`;
  copyToClipboard(link);
  if (cu) DB.FanEarnings.credit(cu.id, 2, `Shared: ${song?.title || songId}`);
  showToast(`🔗 Link copied! ${cu ? 'You earned MK 2!' : 'Sign in to earn when friends join.'}`, 'success');
}

function downloadCurrentSong() {
  if (!window._currentSong) return;
  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); showToast('Sign in to download', 'info'); return; }
  const song = window._currentSong;
  if (song.type === 'premium' && song.price > 0) {
    showToast(`⭐ Premium song — MK ${song.price} required to download`, 'info');
  } else {
    showToast(`⬇ Downloading "${song.title}"…`, 'success');
    song.downloads = (song.downloads || 0) + 1;
    DB.save();
  }
}

// ── Song card/row builders ────────────────────────────────────
function songCard(song) {
  const artist = DB.Users.find(song.artistId);
  const cu     = DB.Users.current();
  const liked  = cu ? DB.Likes.isLiked(cu.id, song.id) : false;
  const color  = genreColor(song.genre);

  return `<div class="song-card" onclick="playSong('${song.id}')">
    <div class="sc-art" style="background:${color};">
      ${song.artwork ? `<img src="${song.artwork}" alt="">` : `<div class="sc-art-emoji">🎵</div>`}
      <div class="sc-overlay">▶</div>
      ${song.type === 'premium' ? '<div class="sc-premium">⭐</div>' : ''}
    </div>
    <div class="sc-info">
      <div class="sc-title" title="${song.title}">${song.title}</div>
      <div class="sc-artist" onclick="event.stopPropagation();viewArtist('${song.artistId}')">${artist?.name || '?'}</div>
      <div class="sc-meta">
        <span>▶ ${fmtNum(song.plays||0)}</span>
        <span>❤ ${song.likes||0}</span>
        <span class="sc-genre">${song.genre}</span>
      </div>
    </div>
    <div class="sc-actions">
      <button class="icon-btn" data-like-id="${song.id}" onclick="event.stopPropagation();toggleLikeSong('${song.id}',this)">${liked?'❤️':'🤍'}</button>
      <button class="icon-btn" onclick="event.stopPropagation();openComments('${song.id}')">💬</button>
      <button class="icon-btn" onclick="event.stopPropagation();shareSong('${song.id}')">🔗</button>
    </div>
  </div>`;
}

function songRow(song, rank) {
  const artist = DB.Users.find(song.artistId);
  const cu     = DB.Users.current();
  const liked  = cu ? DB.Likes.isLiked(cu.id, song.id) : false;

  return `<div class="song-row" onclick="playSong('${song.id}')">
    ${rank ? `<div class="sr-rank">${rank}</div>` : ''}
    <div class="sr-art" style="background:${genreColor(song.genre)};">${song.artwork ? `<img src="${song.artwork}">` : '🎵'}</div>
    <div class="sr-info">
      <div class="sr-title">${song.title} ${song.type==='premium'?'<span class="badge-prem">⭐ Premium</span>':''}</div>
      <div class="sr-artist" onclick="event.stopPropagation();viewArtist('${song.artistId}')">${artist?.name||'?'} · ${song.genre}</div>
    </div>
    <div class="sr-plays">▶ ${fmtNum(song.plays||0)}</div>
    <div class="sr-dur">${song.duration||'—'}</div>
    <div class="sr-acts">
      <button class="icon-btn" data-like-id="${song.id}" onclick="event.stopPropagation();toggleLikeSong('${song.id}',this)">${liked?'❤️':'🤍'}</button>
      <button class="icon-btn" onclick="event.stopPropagation();openComments('${song.id}')">💬</button>
      <button class="icon-btn" onclick="event.stopPropagation();shareSong('${song.id}')">🔗</button>
      ${song.type==='free' ? `<button class="icon-btn" onclick="event.stopPropagation();downloadCurrentSong()">⬇</button>` : ''}
    </div>
  </div>`;
}

function artistCard(artist) {
  const songs     = DB.Songs.byArtist(artist.id);
  const plays     = songs.reduce((s, x) => s + (x.plays||0), 0);
  const followers = DB.Artists.followerCount(artist.id);
  const avatarHtml = artist.avatar
    ? `<img src="${artist.avatar}" alt="${artist.username}">`
    : artist.username.slice(0,2).toUpperCase();
  return `<div class="artist-card" onclick="viewArtist('${artist.id}')">
    <div class="ac-avatar">${avatarHtml}</div>
    <div class="ac-name">${artist.name}</div>
    <div class="ac-username">@${artist.username}</div>
    <div class="ac-stats">
      <span>👥 ${followers}</span>
      <span>▶ ${fmtNum(plays)}</span>
    </div>
    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();toggleFollow('${artist.id}',this)">+ Follow</button>
  </div>`;
}

// ── Library tabs ─────────────────────────────────────────────
function renderLibrary() {
  document.querySelector('.lib-tab.active')?.click() || showLibTab(document.querySelector('.lib-tab'), 'liked');
}
function showLibTab(btn, tab) {
  document.querySelectorAll('.lib-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const cu = DB.Users.current();
  const el = document.getElementById('library-content');

  if (!cu) { el.innerHTML = '<div class="empty-state"><div class="es-icon">🔐</div><p>Sign in to access your library</p><button class="btn btn-primary" onclick="openAuthModal()">Sign In</button></div>'; return; }

  if (tab === 'liked') {
    const liked = DB.Likes.get(cu.id).map(id => DB.Songs.find(id)).filter(Boolean);
    el.innerHTML = liked.length ? `<div class="song-list">${liked.map(s => songRow(s)).join('')}</div>` : '<div class="empty-state"><div class="es-icon">💔</div><p>No liked songs yet</p></div>';
  } else if (tab === 'following') {
    const following = DB.Follows.get(cu.id).map(id => DB.Users.find(id)).filter(Boolean);
    el.innerHTML = following.length ? `<div class="artist-grid">${following.map(a => artistCard(a)).join('')}</div>` : '<div class="empty-state"><div class="es-icon">🎤</div><p>You&apos;re not following any artists yet</p></div>';
  } else if (tab === 'history') {
    const hist = DB.History.forUser(cu.id).map(h => DB.Songs.find(h.songId)).filter(Boolean);
    el.innerHTML = hist.length ? `<div class="song-list">${hist.map(s => songRow(s)).join('')}</div>` : '<div class="empty-state"><div class="es-icon">🕐</div><p>Your listening history is empty</p></div>';
  } else if (tab === 'shared') {
    const fe = DB.FanEarnings.get(cu.id);
    el.innerHTML = `<div class="earnings-summary">
      <div class="es-bal"><span>Fan Earnings Balance</span><strong>MK ${fe.balance.toLocaleString()}</strong></div>
      <div class="ref-link-box">
        <label>Your Referral Link (earn MK 2 per new signup)</label>
        <div class="ref-row">
          <input type="text" readonly value="${DB.FanEarnings.shareLink(cu.id)}" class="ref-input" id="ref-link-val">
          <button class="btn btn-accent btn-sm" onclick="copyRefLink()">📋 Copy</button>
        </div>
      </div>
      <h3 style="margin-top:20px;">Share History</h3>
      ${fe.shares.length ? fe.shares.map(s => `<div class="hist-row"><span>+MK ${s.amount}</span><span>${s.note}</span><span class="dim">${timeAgo(s.ts)}</span></div>`).join('') : '<p class="dim">No share earnings yet</p>'}
    </div>`;
  }
}

function copyRefLink() {
  const val = document.getElementById('ref-link-val')?.value;
  if (val) { copyToClipboard(val); showToast('🔗 Referral link copied!', 'success'); }
}

// ── My Profile ────────────────────────────────────────────────
function renderMyProfile() {
  const cu = DB.Users.current();
  if (!cu) {
    document.getElementById('my-profile-content').innerHTML = '<div class="empty-state"><div class="es-icon">👤</div><p>Sign in to view your profile</p><button class="btn btn-primary" onclick="openAuthModal()">Sign In</button></div>';
    return;
  }
  const songs   = DB.Songs.byArtist(cu.id).filter(s => s.status === 'approved');
  const follows = DB.Follows.get(cu.id).length;

  const avatarHtml = cu.avatar
    ? `<img src="${cu.avatar}" alt="${cu.username}"><div class="ph-avatar-overlay">📷</div>`
    : `<span>${cu.username.slice(0,2).toUpperCase()}</span><div class="ph-avatar-overlay">📷</div>`;

  const html = `
    <div class="profile-hero">
      <div class="ph-avatar" onclick="openProfileEdit()" title="Change profile picture">
        ${avatarHtml}
      </div>
      <div class="ph-info">
        <h1>${cu.name}</h1>
        <div class="ph-username">@${cu.username} · <span class="badge-role">${cu.role === 'artist' ? '🎤 Artist' : cu.role === 'admin' ? '🛡 Admin' : '🎵 Fan'}</span></div>
        <p class="ph-bio">${cu.bio || '<span style="opacity:.5">No bio yet — click Edit Profile to add one.</span>'}</p>
        <div class="ph-stats">
          <div class="phs"><strong>${songs.length}</strong><span>Songs</span></div>
          <div class="phs"><strong>${DB.Artists.followerCount(cu.id)}</strong><span>Followers</span></div>
          <div class="phs"><strong>${follows}</strong><span>Following</span></div>
        </div>
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="openProfileEdit()">✏️ Edit Profile</button>
          <button class="btn btn-outline btn-sm" onclick="showPage('settings')">⚙️ Settings</button>
          <button class="btn btn-ghost btn-sm" onclick="logout()">Sign Out</button>
        </div>
      </div>
    </div>
    ${cu.role === 'artist' ? `
    <div class="section"><h2 class="section-title">🎵 My Songs (${songs.length})</h2>
      ${songs.length ? `<div class="song-list">${songs.map(s => songRow(s)).join('')}</div>` : '<p class="dim">No songs uploaded yet. <a href="#" onclick="showPage(\'upload\')">Upload your first track →</a></p>'}
    </div>` : ''}`;

  document.getElementById('my-profile-content').innerHTML = html;
}

function openProfileEdit() {
  const cu = DB.Users.current();
  if (!cu) return;
  const preview = document.getElementById('pp-edit-preview');
  const initEl  = document.getElementById('pp-edit-initials');
  if (cu.avatar) {
    preview.innerHTML = `<img src="${cu.avatar}" alt="">`;
  } else {
    if (initEl) initEl.textContent = cu.username.slice(0,2).toUpperCase();
  }
  document.getElementById('pe-name').value  = cu.name || '';
  document.getElementById('pe-bio').value   = cu.bio  || '';
  document.getElementById('pe-phone').value = cu.phone|| '';
  openModal('modal-profile-edit');
}

let _pendingAvatarFile = null;

function handleProfilePicEdit(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
  _pendingAvatarFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('pp-edit-preview');
    preview.innerHTML = `<img src="${e.target.result}" alt="">`;
  };
  reader.readAsDataURL(file);
}

async function saveProfileModal() {
  const cu = DB.Users.current();
  if (!cu) return;
  const saveBtn = document.querySelector('#modal-profile-edit .btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {
    const name  = document.getElementById('pe-name').value.trim();
    const bio   = document.getElementById('pe-bio').value.trim().slice(0, 300);
    const phone = document.getElementById('pe-phone').value.trim();
    const updates = { name: name || cu.name, bio, phone };

    // Upload avatar to Cloudinary if a new file was chosen
    if (_pendingAvatarFile && API.isLoggedIn?.() !== false) {
      try {
        const signData = await API.upload.signAvatar();
        const cldRes   = await API.upload.toCloudinary(_pendingAvatarFile, signData);
        updates.avatar = cldRes.secure_url;
      } catch (_) { /* fall back to keeping old avatar */ }
    }

    // Persist to server
    await API.auth.updateProfile(updates);

    // Sync local DB
    DB.Users.update(cu.id, updates);
    const cached = API.auth.currentUser();
    if (cached) { Object.assign(cached, updates); localStorage.setItem('dd_user', JSON.stringify(cached)); }

    closeModal('modal-profile-edit');
    _pendingAvatarFile = null;
    updateUserUI();
    renderMyProfile();
    showToast('Profile updated!', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
  }
}

// ── Utilities ─────────────────────────────────────────────────
function initials(name) { return (name||'?').split(' ').map(p=>p[0]).join('').toUpperCase().slice(0,2); }

function fmtNum(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n/1000).toFixed(1) + 'K';
  return String(n);
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

function escHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function copyToClipboard(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  else fallbackCopy(text);
}
function fallbackCopy(text) {
  const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); el.remove();
}

const GENRE_COLORS = {
  'Afrobeats':'#f72585','Gospel':'#00522A','Hip-Hop':'#7209b7',
  'R&B / Soul':'#3a0ca3','Reggae':'#2dc653','Malawi Pop':'#CE1126',
  'Praise & Worship':'#FCC417','Traditional':'#7b2d8b','Dance / EDM':'#0077b6',
  'Other':'#555',
};
function genreColor(genre) { return GENRE_COLORS[genre] || '#333'; }

// ── Load server data into local DB cache ─────────────────────
async function loadServerData() {
  try {
    const [songsRes, artistsRes] = await Promise.allSettled([
      API.songs.list(),
      API.artists.list(),
    ]);

    if (songsRes.status === 'fulfilled' && songsRes.value.songs) {
      // Merge server songs into local DB (server data wins)
      const serverSongs = songsRes.value.songs;
      const localSongs  = DB.get().songs;
      // Add new server songs not already cached
      serverSongs.forEach(ss => {
        const idx = localSongs.findIndex(ls => ls.id === ss.id);
        if (idx >= 0) Object.assign(localSongs[idx], ss);
        else localSongs.push(ss);
      });
    }

    if (artistsRes.status === 'fulfilled' && artistsRes.value.artists) {
      const serverArtists = artistsRes.value.artists;
      const localUsers    = DB.get().users;
      serverArtists.forEach(sa => {
        const idx = localUsers.findIndex(u => u.id === sa.id);
        if (idx >= 0) Object.assign(localUsers[idx], sa);
        else localUsers.push({ ...sa, role: 'artist' });
      });
    }

    // Restore logged-in user from token
    if (API.auth.isLoggedIn()) {
      try {
        const meRes = await API.auth.me();
        if (meRes.user) {
          const u = meRes.user;
          DB.get().currentUser = u.id;
          const idx = DB.get().users.findIndex(x => x.id === u.id);
          if (idx >= 0) Object.assign(DB.get().users[idx], u);
          else DB.get().users.push(u);
          localStorage.setItem('dd_user', JSON.stringify(u));
        }
      } catch (_) {
        // Token expired — clear it
        API.auth.logout();
        DB.Users.logout();
      }
    }

    DB.save();
    updateUserUI();
    // Re-render current page with fresh data
    if (typeof renderDiscover === 'function') renderDiscover();
  } catch (err) {
    console.warn('Server data load failed — using local data:', err.message);
  }
}

// ── Boot ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  const theme = DB.Settings.theme();
  document.documentElement.setAttribute('data-theme', theme);
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();
  updateUserUI();
  showPage('discover');
  // Load fresh data from server in background
  await loadServerData();
  // Re-initialize icons after dynamic content loads
  if (window.lucide) lucide.createIcons();
});
