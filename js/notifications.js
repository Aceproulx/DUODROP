/* ================================================================
   DUODROP — Notifications Center
   Bell badge + feed + preference panel for the topbar.
   Notifications are stored locally per user via DB.Notifications
   and generated on: song approval/rejection, likes, comments,
   new followers, and earnings milestones.
   ================================================================ */

const NOTIF_META = {
  approvals: { icon: 'shield-check', color: '#10b981' },
  likes:     { icon: 'heart',        color: '#f72585' },
  comments:  { icon: 'message-circle', color: '#3a86ff' },
  followers: { icon: 'user-plus',    color: '#FCC417' },
  earnings:  { icon: 'banknote',     color: '#CE1126' },
};

function notifIcon(n) {
  const meta = NOTIF_META[n.type] || { icon: 'bell', color: 'var(--accent)' };
  return `<i data-lucide="${meta.icon}" style="color:${meta.color};"></i>`;
}

// ── Unread badge on the topbar bell ────────────────────────────
function refreshNotifBadge() {
  const cu = DB.Users.current();
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (!cu) { badge.style.display = 'none'; return; }
  const count = DB.Notifications.unreadCount(cu.id);
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count > 0 ? 'block' : 'none';
  const bell = document.querySelector('.bell-btn');
  if (bell) bell.classList.toggle('has-unread', count > 0);
}

// ── Feed view ─────────────────────────────────────────────────
function renderNotifications() {
  const cu = DB.Users.current();
  const el = document.getElementById('notif-list');
  if (!el) return;

  const items = cu ? DB.Notifications.all(cu.id) : [];

  if (!items.length) {
    el.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i data-lucide="bell-off"></i></div>
        <div class="notif-empty-title">You're all caught up</div>
        <div class="notif-empty-sub">Song approvals, likes, comments and more will show up here.</div>
      </div>`;
  } else {
    el.innerHTML = items.map(n => `
      <div class="notif-item ${n.read ? 'read' : 'unread'}">
        <div class="notif-ico">${notifIcon(n)}</div>
        <div class="notif-content">
          <div class="notif-title">${escHtml(n.title || '')}</div>
          <div class="notif-body">${escHtml(n.body || '')}</div>
          <div class="notif-time">${typeof timeAgo === 'function' ? timeAgo(n.ts) : n.ts}</div>
        </div>
      </div>`).join('');
  }

  if (window.lucide) lucide.createIcons();
}

function markAllNotificationsRead() {
  const cu = DB.Users.current();
  if (!cu) return;
  DB.Notifications.markAllRead(cu.id);
  renderNotifications();
  refreshNotifBadge();
  showToast('All notifications marked as read', 'info');
}

function clearNotifications() {
  const cu = DB.Users.current();
  if (!cu) return;
  DB.Notifications.clear(cu.id);
  renderNotifications();
  refreshNotifBadge();
  showToast('Notifications cleared', 'info');
}

// ── View switching (feed ↔ settings) ─────────────────────────
function showNotifFeed() {
  const feed = document.getElementById('notif-feed-view');
  const set  = document.getElementById('notif-settings-view');
  const title = document.getElementById('notif-modal-title');
  if (feed) feed.style.display = '';
  if (set)  set.style.display  = 'none';
  if (title) title.innerHTML = '<i data-lucide="bell"></i> Notifications';
  if (window.lucide) lucide.createIcons();
}

function showNotifSettings() {
  const feed = document.getElementById('notif-feed-view');
  const set  = document.getElementById('notif-settings-view');
  const title = document.getElementById('notif-modal-title');
  if (feed) feed.style.display = 'none';
  if (set)  set.style.display  = '';
  if (title) title.innerHTML = '<i data-lucide="settings"></i> Notification Settings';
  if (window.lucide) lucide.createIcons();
}

// ── Seed some demo notifications for artists without any ──────
function _seedDemoNotifications() {
  const cu = DB.Users.current();
  if (!cu || cu.role !== 'artist') return;
  if (DB.Notifications.all(cu.id).length > 0) return;

  const song = DB.Songs.byArtist(cu.id)[0];
  if (song) {
    DB.Notifications.add(cu.id, {
      type: 'approvals',
      title: 'Song approved',
      body: `Your song "${song.title}" has been approved and is now live on DUODROP.`,
      refId: song.id,
    });
  }
}
