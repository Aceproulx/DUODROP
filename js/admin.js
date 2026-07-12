/* ================================================================
   DUODROP — Administrator Dashboard
   ================================================================ */

function renderAdminDashboard() {
  const cu = DB.Users.current();
  const el = document.getElementById('admin-dashboard-content');
  if (!el) return;

  if (!cu || cu.role !== 'admin') {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🔒</div><p>Access denied. Admins only.</p></div>`;
    return;
  }

  const allUsers   = DB.Users.all();
  const allSongs   = DB.Songs.all();
  const allArtists = DB.Artists.all();
  const stats      = DB.Stats.total();
  const pending    = allSongs.filter(s => s.status === 'pending');
  const uploads    = DB.get().uploads || [];

  el.innerHTML = `
    <div class="admin-stats">
      <div class="admin-stat"><div class="aval">${allUsers.length}</div><div class="albl">Total Users</div></div>
      <div class="admin-stat"><div class="aval">${allArtists.length}</div><div class="albl">Artists</div></div>
      <div class="admin-stat"><div class="aval">${allSongs.length}</div><div class="albl">Songs</div></div>
      <div class="admin-stat"><div class="aval">${pending.length}</div><div class="albl">Pending Songs</div></div>
      <div class="admin-stat"><div class="aval">${fmtNum(stats.plays)}</div><div class="albl">Total Plays</div></div>
      <div class="admin-stat"><div class="aval">${allUsers.filter(u=>u.status==='banned').length}</div><div class="albl">Banned Users</div></div>
    </div>

    <div class="admin-tabs">
      <button class="admin-tab active" onclick="adminTab(this,'admin-users')">👥 Users</button>
      <button class="admin-tab" onclick="adminTab(this,'admin-songs')">🎵 Songs</button>
      <button class="admin-tab" onclick="adminTab(this,'admin-pending')">⏳ Pending (${pending.length})</button>
    </div>

    <div id="admin-users">
      ${renderAdminUsers()}
    </div>
    <div id="admin-songs" style="display:none;">
      ${renderAdminSongs()}
    </div>
    <div id="admin-pending" style="display:none;">
      ${renderAdminPending()}
    </div>
  `;
}

function adminTab(btn, panelId) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['admin-users','admin-songs','admin-pending'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === panelId ? '' : 'none';
  });
}

function renderAdminUsers() {
  const users = DB.Users.all();
  if (!users.length) return '<p class="dim">No users yet.</p>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.name}</strong><br><span class="dim">@${u.username}</span></td>
              <td>${u.email}</td>
              <td><span class="status-badge ${u.role}">${u.role === 'admin' ? '🛡 Admin' : u.role === 'artist' ? '🎤 Artist' : '🎵 Fan'}</span></td>
              <td><span class="status-badge ${u.status || 'active'}">${u.status || 'active'}</span></td>
              <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                ${u.role !== 'admin' ? `
                  <button class="btn btn-sm btn-outline" onclick="adminBanUser('${u.id}')">${u.status === 'banned' ? '✅ Unban' : '🚫 Ban'}</button>
                  <button class="btn btn-sm btn-ghost" onclick="adminDeleteUser('${u.id}')">🗑</button>
                ` : '<span class="dim">—</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminSongs() {
  const songs = DB.Songs.all();
  if (!songs.length) return '<p class="dim">No songs yet.</p>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Song</th><th>Artist</th><th>Genre</th><th>Plays</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${songs.map(s => {
            const artist = DB.Users.find(s.artistId);
            return `
              <tr>
                <td><strong>${s.title}</strong></td>
                <td>${artist ? artist.name : '—'}</td>
                <td>${s.genre}</td>
                <td>▶ ${fmtNum(s.plays||0)}</td>
                <td><span class="status-badge ${s.status || 'pending'}">${s.status || 'pending'}</span></td>
                <td>
                  ${s.status !== 'approved' ? `<button class="btn btn-sm btn-green" onclick="adminApproveSong('${s.id}')">✅ Approve</button>` : ''}
                  <button class="btn btn-sm btn-danger" onclick="adminRemoveSong('${s.id}')">🗑 Remove</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminPending() {
  const pending = DB.Songs.all().filter(s => s.status === 'pending');
  if (!pending.length) return '<div class="empty-state"><div class="es-icon">✅</div><p>No pending songs — all clear!</p></div>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Song</th><th>Artist</th><th>Genre</th><th>Tx Ref</th><th>Submitted</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${pending.map(s => {
            const artist = DB.Users.find(s.artistId);
            return `
              <tr>
                <td><strong>${s.title}</strong></td>
                <td>${artist ? artist.name : '—'}</td>
                <td>${s.genre}</td>
                <td><code>${s.txref || '—'}</code></td>
                <td>${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <button class="btn btn-sm btn-green" onclick="adminApproveSong('${s.id}')">✅ Approve</button>
                  <button class="btn btn-sm btn-danger" onclick="adminRejectSong('${s.id}')">❌ Reject</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function adminBanUser(userId) {
  const u = DB.Users.find(userId);
  if (!u) return;
  const newStatus = u.status === 'banned' ? 'active' : 'banned';
  DB.Users.update(userId, { status: newStatus });
  showToast(newStatus === 'banned' ? `🚫 ${u.username} banned` : `✅ ${u.username} unbanned`, newStatus === 'banned' ? 'error' : 'success');
  renderAdminDashboard();
}

function adminDeleteUser(userId) {
  const u = DB.Users.find(userId);
  if (!u) return;
  if (!confirm(`Delete user "${u.username}"? This cannot be undone.`)) return;
  const data = DB.get();
  data.users = data.users.filter(x => x.id !== userId);
  data.songs = data.songs.filter(s => s.artistId !== userId);
  DB.save();
  showToast(`🗑 User ${u.username} deleted`, 'info');
  renderAdminDashboard();
}

function adminApproveSong(songId) {
  const s = DB.Songs.find(songId);
  if (!s) return;
  const data = DB.get();
  const idx  = data.songs.findIndex(x => x.id === songId);
  if (idx >= 0) { data.songs[idx].status = 'approved'; DB.save(); }
  showToast(`✅ "${s.title}" approved and published!`, 'success');
  renderAdminDashboard();
}

function adminRejectSong(songId) {
  const s = DB.Songs.find(songId);
  if (!s) return;
  if (!confirm(`Reject and remove "${s.title}"?`)) return;
  const data = DB.get();
  data.songs = data.songs.filter(x => x.id !== songId);
  DB.save();
  showToast(`❌ "${s.title}" rejected and removed`, 'error');
  renderAdminDashboard();
}

function adminRemoveSong(songId) {
  const s = DB.Songs.find(songId);
  if (!s) return;
  if (!confirm(`Remove song "${s.title}"? This is permanent.`)) return;
  const data = DB.get();
  data.songs = data.songs.filter(x => x.id !== songId);
  DB.save();
  showToast(`🗑 "${s.title}" removed`, 'info');
  renderAdminDashboard();
}
