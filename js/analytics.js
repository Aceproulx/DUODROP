/* ================================================================
   DUODROP — Analytics Dashboard & Earnings (v2)
   Professional analytics with Lucide icons
   ================================================================ */

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const cu = DB.Users.current();
  const el = document.getElementById('dashboard-content');

  if (!cu) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon"><i data-lucide="bar-chart-2"></i></div>
        <p>Sign in as an artist to see analytics</p>
        <button class="btn btn-primary" onclick="openAuthModal()"><i data-lucide="log-in"></i> Sign In</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const songs      = DB.Songs.byArtist(cu.id);
  const earnings   = DB.ArtistEarnings.get(cu.id);
  const followers  = DB.Artists.followerCount(cu.id);
  const totalPlays = songs.reduce((s, x) => s + (x.plays || 0), 0);
  const totalLikes = songs.reduce((s, x) => s + (x.likes || 0), 0);
  const canWithdraw = DB.ArtistEarnings.canWithdraw(cu.id);

  const approvedSongs = songs.filter(s => s.status === 'approved');
  const pendingSongs  = songs.filter(s => s.status === 'pending');
  const topSong       = [...approvedSongs].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];

  // Milestones
  const milestones = [
    {
      label: 'Followers to Start Earning',
      val: followers, target: 100, met: followers >= 100,
      icon: 'users',
      color: 'var(--blue)',
    },
    {
      label: topSong ? `Best song "${topSong.title}" — plays to withdraw` : 'Upload a song and reach 1,000 plays',
      val: topSong ? (topSong.plays || 0) : 0,
      target: 1000,
      met: topSong && topSong.plays >= 1000,
      icon: 'play-circle',
      color: 'var(--accent)',
    },
  ];

  el.innerHTML = `
    <div class="dash-welcome">
      <div class="dash-welcome-text">
        <h2>Welcome back, ${cu.name || cu.username}</h2>
        <p>Here is how your music is performing</p>
      </div>
      <div class="dash-welcome-actions">
        <button class="btn btn-accent btn-sm" onclick="showPage('upload')"><i data-lucide="upload-cloud"></i> Upload Music</button>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="dash-stats-grid">
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:var(--blue); background:rgba(0,119,182,0.12);">
          <i data-lucide="play"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">${fmtNum(totalPlays)}</div>
          <div class="dsg-lbl">Total Plays</div>
        </div>
      </div>
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:var(--green-lt); background:rgba(34,197,94,0.12);">
          <i data-lucide="banknote"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">MK ${earnings.balance.toLocaleString()}</div>
          <div class="dsg-lbl">Earnings Balance</div>
        </div>
      </div>
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:var(--gold); background:rgba(252,196,23,0.12);">
          <i data-lucide="users"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">${fmtNum(followers)}</div>
          <div class="dsg-lbl">Followers</div>
        </div>
      </div>
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:#f43f5e; background:rgba(244,63,94,0.12);">
          <i data-lucide="heart"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">${fmtNum(totalLikes)}</div>
          <div class="dsg-lbl">Total Likes</div>
        </div>
      </div>
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:var(--purple); background:rgba(123,45,139,0.12);">
          <i data-lucide="disc-3"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">${songs.length}</div>
          <div class="dsg-lbl">Songs</div>
        </div>
      </div>
      <div class="dsg-card">
        <div class="dsg-icon-wrap" style="color:#8b5cf6; background:rgba(139,92,246,0.12);">
          <i data-lucide="clock"></i>
        </div>
        <div class="dsg-body">
          <div class="dsg-val">${pendingSongs.length}</div>
          <div class="dsg-lbl">Pending Review</div>
        </div>
      </div>
    </div>

    <div class="dash-grid-2">
      <!-- Song Performance Table -->
      <div class="dash-card">
        <div class="dash-card-header">
          <div class="dash-card-title">
            <i data-lucide="music"></i>
            <span>Song Performance</span>
          </div>
          ${songs.length ? `<span class="dash-card-badge">${songs.length} songs</span>` : ''}
        </div>
        ${approvedSongs.length ? `
          <div class="dash-table-wrap">
            <table class="analytics-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Song</th>
                  <th>Genre</th>
                  <th>Plays</th>
                  <th>Likes</th>
                  <th>Type</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                ${approvedSongs.sort((a,b) => (b.plays||0) - (a.plays||0)).map((s, i) => {
                  const songEarn = s.plays >= 1000 && followers >= 100 ? s.plays : 0;
                  return `<tr>
                    <td class="dash-rank">${i + 1}</td>
                    <td>
                      <div class="dash-song-cell">
                        <div class="dash-song-art" style="background:${genreColor(s.genre)};">
                          ${s.artwork ? `<img src="${s.artwork}" alt="">` : `<i data-lucide="music"></i>`}
                        </div>
                        <span class="dash-song-title">${s.title}</span>
                      </div>
                    </td>
                    <td><span class="badge-genre">${s.genre}</span></td>
                    <td>
                      <div class="dash-play-count">
                        <i data-lucide="play"></i>
                        ${fmtNum(s.plays || 0)}
                      </div>
                    </td>
                    <td>
                      <div class="dash-like-count">
                        <i data-lucide="heart"></i>
                        ${s.likes || 0}
                      </div>
                    </td>
                    <td><span class="badge-type ${s.type}">${s.type === 'premium' ? 'Premium' : 'Free'}</span></td>
                    <td class="dash-earn-cell">MK ${songEarn.toLocaleString()}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>` : `
          <div class="dash-empty">
            <i data-lucide="upload-cloud"></i>
            <p>No songs uploaded yet</p>
            <button class="btn btn-primary btn-sm" onclick="showPage('upload')"><i data-lucide="plus"></i> Upload your first song</button>
          </div>`}
      </div>

      <!-- Milestones & Rules -->
      <div class="dash-card">
        <div class="dash-card-header">
          <div class="dash-card-title">
            <i data-lucide="target"></i>
            <span>Milestones</span>
          </div>
        </div>

        ${milestones.map(m => `
          <div class="milestone">
            <div class="ml-header">
              <div class="ml-icon-wrap" style="background:${m.met ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)'}; color:${m.met ? 'var(--green-lt)' : 'var(--text-dim)'};">
                <i data-lucide="${m.met ? 'check-circle' : m.icon}"></i>
              </div>
              <span class="ml-label">${m.label}</span>
              <span class="ml-status ${m.met ? 'met' : ''}">${m.met ? 'Achieved' : `${Math.min(100, (m.val / m.target * 100)).toFixed(0)}%`}</span>
            </div>
            <div class="ml-prog-track">
              <div class="ml-prog-fill" style="width:${Math.min(100, (m.val / m.target) * 100).toFixed(1)}%;background:${m.met ? 'var(--green-lt)' : 'var(--accent)'}"></div>
            </div>
            <div class="ml-values">${fmtNum(m.val)} / ${fmtNum(m.target)}</div>
          </div>`).join('')}

        <div class="dash-section-divider"></div>

        <div class="dash-card-header" style="margin-bottom:12px;">
          <div class="dash-card-title">
            <i data-lucide="coins"></i>
            <span>How You Earn</span>
          </div>
        </div>
        <div class="rules-list">
          <div class="rule-item">
            <div class="rule-icon-wrap" style="color:var(--blue); background:rgba(0,119,182,0.1);">
              <i data-lucide="play"></i>
            </div>
            <div class="rule-text">
              <strong>MK 1 per full play</strong>
              <p>Every completed stream of your song</p>
            </div>
          </div>
          <div class="rule-item">
            <div class="rule-icon-wrap" style="color:var(--gold); background:rgba(252,196,23,0.1);">
              <i data-lucide="users"></i>
            </div>
            <div class="rule-text">
              <strong>100 followers required</strong>
              <p>Reach 100 followers to activate earnings</p>
            </div>
          </div>
          <div class="rule-item">
            <div class="rule-icon-wrap" style="color:var(--accent); background:rgba(206,17,38,0.1);">
              <i data-lucide="bar-chart-2"></i>
            </div>
            <div class="rule-text">
              <strong>1,000 plays to withdraw</strong>
              <p>Minimum per song before cash-out</p>
            </div>
          </div>
          <div class="rule-item">
            <div class="rule-icon-wrap" style="color:var(--green-lt); background:rgba(34,197,94,0.1);">
              <i data-lucide="link"></i>
            </div>
            <div class="rule-text">
              <strong>Fans earn MK 2/share</strong>
              <p>Referral earnings for fans</p>
            </div>
          </div>
        </div>

        ${canWithdraw
          ? `<button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="showPage('earnings')"><i data-lucide="arrow-up-right"></i> Withdraw Earnings</button>`
          : `<div class="lock-msg"><i data-lucide="lock"></i> <span>Reach 100 followers and 1,000 plays on one song to unlock withdrawal</span></div>`}
      </div>
    </div>

    <!-- Earnings History -->
    <div class="dash-card" style="margin-top:20px;">
      <div class="dash-card-header">
        <div class="dash-card-title">
          <i data-lucide="history"></i>
          <span>Recent Activity</span>
        </div>
        ${earnings.history.length ? `<span class="dash-card-badge">Last 10</span>` : ''}
      </div>
      ${earnings.history.length ? `
        <div class="dash-table-wrap">
          <table class="analytics-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Song</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${earnings.history.slice(0, 10).map(h => `<tr>
                <td>
                  <div class="dash-activity-type">
                    <i data-lucide="${h.type === 'play' ? 'play-circle' : h.type === 'withdraw' ? 'arrow-up-right' : 'activity'}"></i>
                    ${h.type === 'play' ? 'Play' : h.type === 'withdraw' ? 'Withdrawal' : h.type}
                  </div>
                </td>
                <td class="dash-earn-cell" style="color:${h.amount < 0 ? 'var(--accent)' : 'var(--green-lt)'}">
                  ${h.amount < 0 ? '' : '+'}MK ${Math.abs(h.amount).toLocaleString()}
                </td>
                <td>${h.songTitle || '—'}</td>
                <td class="dim">${timeAgo(h.ts)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `
        <div class="dash-empty">
          <i data-lucide="inbox"></i>
          <p>No transactions yet. Start earning by building your audience!</p>
        </div>`}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ── EARNINGS ─────────────────────────────────────────────────
function renderEarnings() {
  const cu = DB.Users.current();
  const el = document.getElementById('earnings-content');

  if (!cu) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="es-icon"><i data-lucide="wallet"></i></div>
        <p>Sign in to view earnings</p>
        <button class="btn btn-primary" onclick="openAuthModal('login')"><i data-lucide="log-in"></i> Sign In</button>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const artEarn     = DB.ArtistEarnings.get(cu.id);
  const fanEarn     = DB.FanEarnings.get(cu.id);
  const canWithdraw = DB.ArtistEarnings.canWithdraw(cu.id);
  const totalEarn   = artEarn.balance + fanEarn.balance;

  el.innerHTML = `
    <div class="earnings-hero">
      <div class="eh-bal-wrap">
        <div class="eh-bal-icon"><i data-lucide="wallet"></i></div>
        <div class="eh-bal">
          <span>Total Available Balance</span>
          <strong class="eh-amount">MK ${totalEarn.toLocaleString()}</strong>
        </div>
      </div>
      <div class="eh-btns">
        ${canWithdraw
          ? `<button class="btn btn-primary btn-lg" onclick="openWithdrawModal(${artEarn.balance})"><i data-lucide="arrow-up-right"></i> Withdraw Artist Earnings</button>`
          : `<div class="lock-msg"><i data-lucide="lock"></i> <span>Artist earnings locked — need 100 followers & 1,000 plays on one song</span></div>`}
      </div>
    </div>

    <div class="earnings-grid">
      <div class="eg-card">
        <div class="eg-card-hdr">
          <div class="eg-icon-wrap" style="color:var(--accent); background:rgba(206,17,38,0.1);">
            <i data-lucide="music"></i>
          </div>
          <div>
            <h3>Artist Earnings <span class="eg-bal">(MK ${artEarn.balance.toLocaleString()})</span></h3>
            <p class="dim">Earn MK 1 per full stream (100+ followers)</p>
          </div>
        </div>
        <div class="earn-hist-list">
          ${artEarn.history.length ? artEarn.history.slice(0, 15).map(h => `
            <div class="earn-hist-row">
              <div class="ehr-icon ${h.amount < 0 ? 'withdraw' : 'play'}">
                <i data-lucide="${h.type === 'play' ? 'play-circle' : 'arrow-up-right'}"></i>
              </div>
              <div class="ehr-details">
                <span class="ehr-title">${h.songTitle || (h.type === 'withdraw' ? 'Withdrawal' : h.type)}</span>
                <span class="ehr-time">${timeAgo(h.ts)}</span>
              </div>
              <div class="ehr-amount" style="color:${h.amount < 0 ? 'var(--text)' : 'var(--green)'};">
                ${h.amount < 0 ? '' : '+'}MK ${Math.abs(h.amount)}
              </div>
            </div>`).join('') : '<div class="empty-hist"><i data-lucide="inbox"></i><p>No earnings yet</p></div>'}
        </div>
      </div>

      <div class="eg-card">
        <div class="eg-card-hdr">
          <div class="eg-icon-wrap" style="color:#10b981; background:rgba(16,185,129,0.1);">
            <i data-lucide="users"></i>
          </div>
          <div>
            <h3>Referral Earnings <span class="eg-bal">(MK ${fanEarn.balance.toLocaleString()})</span></h3>
            <p class="dim">Earn MK 2 per successful referral join</p>
          </div>
        </div>

        <div class="ref-link-box">
          <div class="ref-row">
            <input type="text" readonly value="${DB.FanEarnings.shareLink(cu.id)}" class="ref-input" id="earn-ref-link">
            <button class="btn btn-accent btn-sm" onclick="copyEarnRef()"><i data-lucide="copy"></i> Copy</button>
          </div>
        </div>

        <div class="earn-hist-list">
          ${fanEarn.shares.length ? fanEarn.shares.slice(0, 15).map(s => `
            <div class="earn-hist-row">
              <div class="ehr-icon ref">
                <i data-lucide="user-plus"></i>
              </div>
              <div class="ehr-details">
                <span class="ehr-title">${s.note}</span>
                <span class="ehr-time">${timeAgo(s.ts)}</span>
              </div>
              <div class="ehr-amount" style="color:var(--green);">
                +MK ${s.amount}
              </div>
            </div>`).join('') : '<div class="empty-hist"><i data-lucide="link"></i><p>Share your link to earn!</p></div>'}
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function copyEarnRef() {
  const val = document.getElementById('earn-ref-link')?.value;
  if (val) { copyToClipboard(val); showToast('Referral link copied!', 'success'); }
}

// ── Withdraw Modal ────────────────────────────────────────────
function openWithdrawModal(maxAmount) {
  const cu = DB.Users.current();
  document.getElementById('withdraw-body').innerHTML = `
    <p class="dim" style="margin-bottom:16px;">Minimum withdrawal: MK 1,000</p>
    <div class="fg">
      <label>Amount to Withdraw (MK)</label>
      <input type="number" id="wd-amount" placeholder="1000" min="1000" max="${maxAmount}" value="${Math.min(maxAmount, 5000)}">
      <div class="fe" id="err-wd-amount"></div>
    </div>
    <div class="fg">
      <label>Withdrawal Method</label>
      <select id="wd-method">
        <option value="airtel">Airtel Money</option>
        <option value="mpamba">Mpamba / TNM</option>
        <option value="bank">National Bank Transfer</option>
      </select>
    </div>
    <div class="fg">
      <label>Phone / Account Number</label>
      <input type="text" id="wd-account" placeholder="${cu?.phone || '+265 9XX XXX XXX'}">
      <div class="fe" id="err-wd-account"></div>
    </div>
    <div class="fe" id="err-wd-form"></div>
    <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="processWithdraw(${maxAmount})"><i data-lucide="arrow-up-right"></i> Request Withdrawal</button>
  `;
  if (window.lucide) lucide.createIcons();
  openModal('modal-withdraw');
}

function processWithdraw(maxAmount) {
  const cu     = DB.Users.current();
  const amount = parseInt(document.getElementById('wd-amount').value || 0);
  const method = document.getElementById('wd-method').value;
  const account= document.getElementById('wd-account').value.trim();

  const schema = z.schemas.withdraw();
  const result = z.validateForm(schema, { amount, method, account }, {
    amount:  'err-wd-amount',
    account: 'err-wd-account',
  });

  if (!result.success) return;
  if (amount > maxAmount) { document.getElementById('err-wd-amount').textContent = `Max available: MK ${maxAmount.toLocaleString()}`; return; }

  const ok = DB.ArtistEarnings.withdraw(cu.id, amount);
  if (!ok) { document.getElementById('err-wd-form').textContent = 'Insufficient balance'; return; }

  closeModal('modal-withdraw');
  showToast(`Withdrawal of MK ${amount.toLocaleString()} requested via ${method}. Processing in 1-3 business days.`, 'success');
  renderEarnings();
  renderDashboard();
}
