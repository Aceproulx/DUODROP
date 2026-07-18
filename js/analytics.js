/* ================================================================
   DUODROP — Analytics Dashboard & Earnings
   ================================================================ */

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const cu = DB.Users.current();
  const el = document.getElementById('dashboard-content');

  if (!cu) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">📊</div><p>Sign in as an artist to see analytics</p><button class="btn btn-primary" onclick="openAuthModal()">Sign In</button></div>`;
    return;
  }

  const songs     = DB.Songs.byArtist(cu.id);
  const earnings  = DB.ArtistEarnings.get(cu.id);
  const followers = DB.Artists.followerCount(cu.id);
  const totalPlays = songs.reduce((s, x) => s + (x.plays || 0), 0);
  const totalLikes = songs.reduce((s, x) => s + (x.likes || 0), 0);
  const canWithdraw = DB.ArtistEarnings.canWithdraw(cu.id);

  const topSong = songs.sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];

  // Milestones
  const milestones = [
    { label: '100 Followers to Earn',    val: followers, target: 100,  icon: '👥', met: followers >= 100 },
    { label: '1,000 Plays to Withdraw',  val: topSong ? (topSong.plays||0) : 0, target: 1000, icon: '▶',  met: topSong && topSong.plays >= 1000 },
  ];

  el.innerHTML = `
    <div class="dash-stats-grid">
      <div class="dsg-card dsg-blue">
        <div class="dsg-icon">▶</div>
        <div class="dsg-val">${fmtNum(totalPlays)}</div>
        <div class="dsg-lbl">Total Plays</div>
      </div>
      <div class="dsg-card dsg-green">
        <div class="dsg-icon">💰</div>
        <div class="dsg-val">MK ${earnings.balance.toLocaleString()}</div>
        <div class="dsg-lbl">Earnings Balance</div>
      </div>
      <div class="dsg-card dsg-yellow">
        <div class="dsg-icon">👥</div>
        <div class="dsg-val">${fmtNum(followers)}</div>
        <div class="dsg-lbl">Followers</div>
      </div>
      <div class="dsg-card dsg-red">
        <div class="dsg-icon">❤️</div>
        <div class="dsg-val">${fmtNum(totalLikes)}</div>
        <div class="dsg-lbl">Total Likes</div>
      </div>
      <div class="dsg-card dsg-purple">
        <div class="dsg-icon">🎵</div>
        <div class="dsg-val">${songs.length}</div>
        <div class="dsg-lbl">Songs Uploaded</div>
      </div>
    </div>

    <div class="dash-grid-2">
      <div class="dash-card">
        <h3>📊 Song Performance</h3>
        ${songs.length ? `
          <table class="analytics-table">
            <thead><tr><th>Song</th><th>Genre</th><th>Plays</th><th>Likes</th><th>Type</th><th>Earnings</th></tr></thead>
            <tbody>
              ${songs.map(s => {
                const songEarn = s.plays >= 1000 && followers >= 100 ? s.plays : 0;
                return `<tr>
                  <td><strong>${s.title}</strong></td>
                  <td><span class="badge-genre">${s.genre}</span></td>
                  <td>▶ ${fmtNum(s.plays||0)}</td>
                  <td>❤ ${s.likes||0}</td>
                  <td><span class="badge-type ${s.type}">${s.type === 'premium' ? '⭐ Premium' : '🆓 Free'}</span></td>
                  <td>MK ${songEarn.toLocaleString()}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>` : '<p class="dim">No songs uploaded yet. <a href="#" onclick="showPage(\'upload\')">Upload your first song →</a></p>'}
      </div>

      <div class="dash-card">
        <h3>🎯 Milestones</h3>
        ${milestones.map(m => `
          <div class="milestone">
            <div class="ml-header">
              <span class="ml-icon">${m.icon}</span>
              <span class="ml-label">${m.label}</span>
              <span class="ml-status ${m.met ? 'met' : ''}">${m.met ? '✅ Met' : '🔒 Locked'}</span>
            </div>
            <div class="ml-prog-track">
              <div class="ml-prog-fill" style="width:${Math.min(100,(m.val/m.target)*100).toFixed(1)}%;background:${m.met?'var(--green)':'var(--accent)'}"></div>
            </div>
            <div class="ml-values">${fmtNum(m.val)} / ${fmtNum(m.target)}</div>
          </div>`).join('')}

        <h3 style="margin-top:20px;">💡 Earnings Rules</h3>
        <div class="rules-list">
          <div class="rule-item"><span class="ri-icon">🎵</span><div><strong>MK 1</strong> per full song play</div></div>
          <div class="rule-item"><span class="ri-icon">👥</span><div><strong>100 followers</strong> required to activate earnings</div></div>
          <div class="rule-item"><span class="ri-icon">📊</span><div><strong>1,000 plays</strong> per song to unlock withdrawal</div></div>
          <div class="rule-item"><span class="ri-icon">🔗</span><div>Fans earn <strong>MK 2</strong> per referral share</div></div>
        </div>

        ${canWithdraw
          ? `<button class="btn btn-primary btn-block" style="margin-top:16px;" onclick="showPage('earnings')">💸 Withdraw Earnings</button>`
          : `<div class="lock-msg">🔒 Reach 100 followers AND 1,000 plays on one song to unlock withdrawal.</div>`}
      </div>
    </div>

    <div class="dash-card" style="margin-top:20px;">
      <h3>📈 Earnings History (last 10 transactions)</h3>
      ${earnings.history.length ? `
        <table class="analytics-table">
          <thead><tr><th>Type</th><th>Amount</th><th>Song</th><th>Date</th></tr></thead>
          <tbody>${earnings.history.slice(0,10).map(h => `<tr>
            <td><span class="badge-type ${h.type}">${h.type === 'play' ? '▶ Play' : h.type === 'withdraw' ? '💸 Withdrawal' : h.type}</span></td>
            <td style="color:${h.amount < 0 ? 'var(--danger)' : 'var(--green)'};">${h.amount < 0 ? '' : '+'}MK ${Math.abs(h.amount).toLocaleString()}</td>
            <td>${h.songTitle || '—'}</td>
            <td class="dim">${timeAgo(h.ts)}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<p class="dim">No transactions yet. Start earning by building your audience!</p>'}
    </div>
  `;
}

// ── EARNINGS ─────────────────────────────────────────────────
function renderEarnings() {
  const cu = DB.Users.current();
  const el = document.getElementById('earnings-content');

  if (!cu) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon"><i data-lucide="wallet"></i></div><p>Sign in to view earnings</p><button class="btn btn-primary" onclick="openAuthModal('login')">Sign In</button></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const artEarn  = DB.ArtistEarnings.get(cu.id);
  const fanEarn  = DB.FanEarnings.get(cu.id);
  const canWithdraw = DB.ArtistEarnings.canWithdraw(cu.id);
  const totalEarn = artEarn.balance + fanEarn.balance;

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
          : `<div class="lock-msg"><i data-lucide="lock"></i> <span>Artist earnings locked — need 100 followers &amp; 1,000 plays on one song</span></div>`}
      </div>
    </div>

    <div class="earnings-grid">
      <div class="eg-card">
        <div class="eg-card-hdr">
          <div class="eg-icon-wrap" style="color:var(--accent); background:rgba(var(--accent-rgb, 255, 77, 79), 0.1);"><i data-lucide="music"></i></div>
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
          <div class="eg-icon-wrap" style="color:#10b981; background:rgba(16,185,129,0.1);"><i data-lucide="users"></i></div>
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
          ${fanEarn.shares.length ? fanEarn.shares.slice(0,15).map(s => `
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
  if (val) { copyToClipboard(val); showToast('🔗 Referral link copied!', 'success'); }
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
    <button class="btn btn-primary btn-block" style="margin-top:12px;" onclick="processWithdraw(${maxAmount})">💸 Request Withdrawal</button>
  `;
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
  if (amount > maxAmount) { document.getElementById('err-wd-amount').textContent = `⚠ Max available: MK ${maxAmount.toLocaleString()}`; return; }

  const ok = DB.ArtistEarnings.withdraw(cu.id, amount);
  if (!ok) { document.getElementById('err-wd-form').textContent = '⚠ Insufficient balance'; return; }

  closeModal('modal-withdraw');
  showToast(`✅ Withdrawal of MK ${amount.toLocaleString()} requested via ${method}. Processing in 1–3 business days.`, 'success');
  renderEarnings();
  renderDashboard();
}
