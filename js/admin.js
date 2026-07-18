/* ================================================================
   DUODROP — Administrator Dashboard
   ================================================================ */

let _adminData = { stats: null, users: [], songs: [], pending: [] };

async function renderAdminDashboard() {
  const cu = DB.Users.current();
  const el = document.getElementById('admin-dashboard-content');
  if (!el) return;

  if (!cu || cu.role !== 'admin') {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🔒</div><p>Access denied. Admins only.</p></div>`;
    return;
  }

  el.innerHTML = `<div class="empty-state"><div class="google-spinner" style="border-color:var(--accent);border-top-color:transparent;width:32px;height:32px;margin:0 auto 16px;"></div><p>Loading admin data...</p></div>`;

  try {
    const [st, usr, sng, pnd] = await Promise.all([
      API.admin.stats(),
      API.admin.users(),
      API.admin.allSongs(),
      API.admin.pendingSongs()
    ]);
    
    _adminData.stats = st || {};
    _adminData.users = usr?.users || [];
    _adminData.songs = sng?.songs || [];
    _adminData.pending = pnd?.songs || [];
    
    const allUsers   = _adminData.users;
    const allSongs   = _adminData.songs;
    const allArtists = allUsers.filter(u => u.role === 'artist');
    const pending    = _adminData.pending;
    const stats      = _adminData.stats;

    el.innerHTML = `
      <div class="admin-stats">
        <div class="admin-stat"><div class="aval">${stats.totalUsers || 0}</div><div class="albl">Total Users</div></div>
        <div class="admin-stat"><div class="aval">${stats.totalArtists || 0}</div><div class="albl">Artists</div></div>
        <div class="admin-stat"><div class="aval">${stats.totalSongs || 0}</div><div class="albl">Approved Songs</div></div>
        <div class="admin-stat"><div class="aval">${stats.pendingSongs || 0}</div><div class="albl">Pending Songs</div></div>
        <div class="admin-stat"><div class="aval">${fmtNum(stats.totalPlays || 0)}</div><div class="albl">Total Plays</div></div>
        <div class="admin-stat"><div class="aval">${stats.bannedUsers || 0}</div><div class="albl">Banned Users</div></div>
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
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><p>Error loading admin data: ${err.message}</p></div>`;
  }
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
  const users = _adminData.users;
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
              <td><span class="status-badge ${u.role}">${u.role === 'admin' ? '<i data-lucide="shield" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Admin' : u.role === 'artist' ? '<i data-lucide="mic" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Artist' : '<i data-lucide="music" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Fan'}</span></td>
              <td><span class="status-badge ${u.status || 'active'}">${u.status || 'active'}</span></td>
              <td>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                ${u.role !== 'admin' ? `
                  <button class="btn btn-sm btn-outline" onclick="adminBanUser('${u.id}', ${u.status === 'banned' ? 'false' : 'true'})">${u.status === 'banned' ? '<i data-lucide="check-circle" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Unban' : '<i data-lucide="ban" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Ban'}</button>
                ` : '<span class="dim">—</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminSongs() {
  const songs = _adminData.songs;
  if (!songs.length) return '<p class="dim">No songs yet.</p>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Song</th><th>Artist</th><th>Genre</th><th>Plays</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${songs.map(s => {
            const artist = _adminData.users.find(u => u.id === s.artistId);
            const isApproved = s.status === 'approved';
            const isRejected = s.status === 'rejected';
            return `
              <tr>
                <td><strong>${s.title}</strong></td>
                <td>${artist ? artist.name : '—'}</td>
                <td>${s.genre}</td>
                <td><i data-lucide="play" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> ${fmtNum(s.plays||0)}</td>
                <td><span class="status-badge ${s.status || 'pending'}">${s.status || 'pending'}</span></td>
                <td>
                  <div class="admin-actions">
                    <button class="admin-kebab" onclick="toggleAdminDropdown(event, this)" title="Actions"><i data-lucide="ellipsis-vertical"></i></button>
                    <div class="admin-dropdown">
                      ${!isApproved ? `<button class="admin-dropdown-item" data-action="approve" onclick="closeAllAdminDropdowns();adminApproveSong('${s.id}')"><i data-lucide="check-circle"></i> Approve</button>` : ''}
                      ${!isRejected ? `<button class="admin-dropdown-item" data-action="reject" onclick="closeAllAdminDropdowns();adminRejectSong('${s.id}')"><i data-lucide="x-circle"></i> Reject</button>` : ''}
                      ${(!isApproved || !isRejected) ? '<div class="admin-dropdown-divider"></div>' : ''}
                      <button class="admin-dropdown-item" data-action="delete" onclick="closeAllAdminDropdowns();adminDeleteSong('${s.id}', '${s.title.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i> Delete</button>
                    </div>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAdminPending() {
  const pending = _adminData.pending;
  if (!pending.length) return '<div class="empty-state"><div class="es-icon" style="color:#10b981;"><i data-lucide="check-circle"></i></div><p>No pending songs - all clear!</p></div>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>
          <th>Song</th><th>Artist</th><th>Genre</th><th>Tx Ref</th><th>Submitted</th><th></th>
        </tr></thead>
        <tbody>
          ${pending.map(s => {
            const artist = _adminData.users.find(u => u.id === s.artistId);
            return `
              <tr>
                <td><strong>${s.title}</strong></td>
                <td>${artist ? artist.name : '—'}</td>
                <td>${s.genre}</td>
                <td><code>${s.txref || '—'}</code></td>
                <td>${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  <div class="admin-actions">
                    <button class="admin-kebab" onclick="toggleAdminDropdown(event, this)" title="Actions"><i data-lucide="ellipsis-vertical"></i></button>
                    <div class="admin-dropdown">
                      <button class="admin-dropdown-item" data-action="approve" onclick="closeAllAdminDropdowns();adminApproveSong('${s.id}')"><i data-lucide="check-circle"></i> Approve</button>
                      <button class="admin-dropdown-item" data-action="reject" onclick="closeAllAdminDropdowns();adminRejectSong('${s.id}')"><i data-lucide="x-circle"></i> Reject</button>
                      <div class="admin-dropdown-divider"></div>
                      <button class="admin-dropdown-item" data-action="delete" onclick="closeAllAdminDropdowns();adminDeleteSong('${s.id}', '${s.title.replace(/'/g, "\\'")}')"><i data-lucide="trash-2"></i> Delete</button>
                    </div>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function adminBanUser(userId, banStatus) {
  if (!confirm(banStatus ? `Ban this user?` : `Unban this user?`)) return;
  try {
    await window.API.admin.banUser(userId, banStatus);
    showToast(banStatus ? `<i data-lucide="ban" style="width:16px;height:16px;vertical-align:middle"></i> User banned` : `<i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:middle"></i> User unbanned`, banStatus ? 'error' : 'success');
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function adminApproveSong(songId) {
  try {
    await window.API.admin.approveSong(songId, 'approved');
    showToast(`<i data-lucide="check-circle" style="width:16px;height:16px;vertical-align:middle"></i> Song approved and published!`, 'success');
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function adminRejectSong(songId) {
  if (!confirm(`Reject this song?`)) return;
  try {
    await window.API.admin.approveSong(songId, 'rejected');
    showToast(`<i data-lucide="x-circle" style="width:16px;height:16px;vertical-align:middle"></i> Song rejected`, 'error');
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function adminDeleteSong(songId, songTitle) {
  if (!confirm(`Delete "${songTitle}"? This cannot be undone.`)) return;
  if (!confirm(`Are you absolutely sure? The song will be permanently removed.`)) return;
  try {
    await window.API.admin.deleteSong(songId);
    showToast(`<i data-lucide="trash-2" style="width:16px;height:16px;vertical-align:middle"></i> "${songTitle}" deleted`, 'success');
    renderAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleAdminDropdown(e, btn) {
  e.stopPropagation();
  const dd = btn.nextElementSibling;
  const wasOpen = dd.classList.contains('open');
  closeAllAdminDropdowns();
  if (!wasOpen) {
    dd.classList.add('open');
    if (window.lucide) lucide.createIcons({ nodes: [dd] });
  }
}

function closeAllAdminDropdowns() {
  document.querySelectorAll('.admin-dropdown.open').forEach(d => d.classList.remove('open'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.admin-actions')) closeAllAdminDropdowns();
});
