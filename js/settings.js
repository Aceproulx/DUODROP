/* ================================================================
   DUODROP — Settings Module (v2)
   Professional, responsive settings with Firebase persistence
   ================================================================ */

// ── Cached settings loaded from Firebase ────────────────────────
let _userSettings = {};
let _settingsLoaded = false;

async function _loadUserSettings() {
  const cu = DB.Users.current();
  if (!cu || !API.auth.isLoggedIn()) { _settingsLoaded = true; return; }
  try {
    const res = await API.auth.getSettings();
    _userSettings = res.settings || {};
    _settingsLoaded = true;
  } catch (_) { _settingsLoaded = true; }
}

async function renderSettings() {
  const cu    = DB.Users.current();
  const theme = DB.Settings.theme();
  const el    = document.getElementById('settings-content');
  const isGoogle = cu?.provider === 'google';

  // Load settings from Firebase if not yet loaded
  if (cu && !_settingsLoaded) await _loadUserSettings();

  const accent = _userSettings.accentColor || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const auto   = _userSettings.audio?.autoplay !== false;
  const lyrics = _userSettings.audio?.lyrics === true;
  const quality = _userSettings.audio?.quality || 'high';
  const nf  = _userSettings.notifications?.followers !== false;
  const nc  = _userSettings.notifications?.comments !== false;
  const ne  = _userSettings.notifications?.earnings !== false;
  const nr  = _userSettings.notifications?.releases !== false;

  const accentColors = [
    ['#CE1126', 'Malawi Red'],   ['#00522A', 'Malawi Green'],
    ['#FCC417', 'Gold'],         ['#7b2d8b', 'Purple'],
    ['#0077b6', 'Ocean Blue'],   ['#f72585', 'Pink'],
    ['#10b981', 'Emerald'],      ['#f97316', 'Orange'],
  ];

  el.innerHTML = `
    <div class="settings-layout">

      ${cu ? `
      <!-- ── Profile Section ──────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="user-circle"></i>
          <span>Profile</span>
        </div>
        <div class="settings-card">
          <div class="settings-profile-header">
            <div class="settings-avatar-wrap" onclick="document.getElementById('settings-avatar-input').click()">
              <div class="settings-avatar" id="settings-pp-preview">
                ${cu.avatar
                  ? `<img src="${cu.avatar}" alt="Profile">`
                  : `<span>${cu.username.slice(0, 2).toUpperCase()}</span>`}
              </div>
              <div class="settings-avatar-overlay">
                <i data-lucide="camera"></i>
              </div>
            </div>
            <input type="file" id="settings-avatar-input" accept="image/*" style="display:none" onchange="handleSettingsAvatar(this)">
            <div class="settings-profile-meta">
              <div class="settings-profile-name">${cu.name || cu.username}</div>
              <div class="settings-profile-role">
                <i data-lucide="${cu.role === 'artist' ? 'mic-2' : cu.role === 'admin' ? 'shield' : 'headphones'}"></i>
                ${cu.role === 'artist' ? 'Artist' : cu.role === 'admin' ? 'Administrator' : 'Fan'}
              </div>
              <div class="settings-profile-joined">Joined ${new Date(cu.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
            </div>
          </div>

          <div class="settings-form">
            <div class="settings-field">
              <label>Username</label>
              <div class="settings-input-wrap">
                <input type="text" id="st-username" value="${cu.username}" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveUsername(); this.style.display='none'" title="Save username" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
              <div class="settings-field-hint" id="err-st-username"></div>
            </div>

            <div class="settings-field">
              <label>Full Name</label>
              <div class="settings-input-wrap">
                <input type="text" id="st-name" value="${cu.name}" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>

            <div class="settings-field">
              <label>Bio <span class="dim">(max 300 characters)</span></label>
              <div class="settings-input-wrap">
                <textarea id="st-bio" rows="3" maxlength="300" class="settings-input settings-textarea" oninput="document.getElementById('bio-count').textContent=this.value.length; this.nextElementSibling.style.display='flex'">${cu.bio || ''}</textarea>
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
              <div class="settings-field-counter"><span id="bio-count">${(cu.bio || '').length}</span>/300</div>
            </div>

            <div class="settings-field">
              <label>Phone <span class="dim">(for earnings withdrawal)</span></label>
              <div class="settings-input-wrap">
                <input type="text" id="st-phone" value="${cu.phone || ''}" placeholder="+265 9XX XXX XXX" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>

            <div class="settings-field">
              <label>Website</label>
              <div class="settings-input-wrap">
                <input type="url" id="st-website" value="${cu.social?.website || ''}" placeholder="https://yoursite.com" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>

            <div class="settings-field">
              <label>Facebook</label>
              <div class="settings-input-wrap">
                <input type="text" id="st-fb" value="${cu.social?.facebook || ''}" placeholder="facebook.com/you" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>

            <div class="settings-field">
              <label>Instagram</label>
              <div class="settings-input-wrap">
                <input type="text" id="st-ig" value="${cu.social?.instagram || ''}" placeholder="@yourhandle" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>

            <div class="settings-field">
              <label>Twitter / X</label>
              <div class="settings-input-wrap">
                <input type="text" id="st-tw" value="${cu.social?.twitter || ''}" placeholder="@yourhandle" class="settings-input" oninput="this.nextElementSibling.style.display='flex'">
                <button class="settings-input-action" onclick="saveProfile(); this.style.display='none'" title="Save changes" style="display:none">
                  <i data-lucide="check"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Password Section (hidden for Google auth) ──────── -->
      ${!isGoogle ? `
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="lock"></i>
          <span>Security</span>
        </div>
        <div class="settings-card">
          <div class="settings-password-note">
            <i data-lucide="shield-check"></i>
            <span>Change your password to keep your account secure</span>
          </div>
          <div class="settings-form">
            <div class="settings-field">
              <label>Current Password</label>
              <input type="password" id="st-old-pw" placeholder="Enter current password" class="settings-input">
              <div class="settings-field-error" id="err-st-old-pw"></div>
            </div>
            <div class="settings-field">
              <label>New Password</label>
              <input type="password" id="st-new-pw" placeholder="Min 8 characters" class="settings-input">
              <div class="settings-field-error" id="err-st-new-pw"></div>
            </div>
            <button class="btn btn-outline btn-block settings-save-btn" onclick="changePassword()">
              <i data-lucide="key-round"></i> Update Password
            </button>
          </div>
        </div>
      </div>
      ` : `
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="lock"></i>
          <span>Security</span>
        </div>
        <div class="settings-card">
          <div class="settings-google-notice">
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            <div>
              <div class="settings-google-notice-title">Signed in with Google</div>
              <div class="settings-google-notice-text">Your password is managed through your Google account. Visit <a href="https://myaccount.google.com" target="_blank" rel="noopener">Google Account Settings</a> to update it.</div>
            </div>
          </div>
        </div>
      </div>
      `}

      <!-- ── Account Section ───────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="circle-user-round"></i>
          <span>Account</span>
        </div>
        <div class="settings-card">
          <div class="settings-account-info">
            <div class="settings-account-row">
              <span class="settings-account-label">Account Type</span>
              <span class="settings-account-value">
                <i data-lucide="${cu.role === 'artist' ? 'mic-2' : cu.role === 'admin' ? 'shield' : 'headphones'}"></i>
                ${cu.role === 'artist' ? 'Artist' : cu.role === 'admin' ? 'Administrator' : 'Fan'}
              </span>
            </div>
            <div class="settings-account-row">
              <span class="settings-account-label">Email</span>
              <span class="settings-account-value">${cu.email || 'N/A'}</span>
            </div>
            <div class="settings-account-row">
              <span class="settings-account-label">Provider</span>
              <span class="settings-account-value">
                ${isGoogle ? 'Google' : 'Email / Password'}
              </span>
            </div>
          </div>

          ${cu.role === 'fan' ? `
          <button class="btn btn-accent btn-block settings-save-btn" onclick="upgradeToArtist()" style="margin-top:16px;">
            <i data-lucide="mic-2"></i> Switch to Artist Account
          </button>
          ` : ''}

          <div class="settings-referral">
            <div class="settings-referral-label">
              <i data-lucide="link"></i>
              <span>Your Referral Code</span>
            </div>
            <div class="settings-referral-row">
              <input type="text" readonly value="${cu.refCode}" class="settings-input settings-referral-input">
              <button class="btn btn-sm btn-outline" onclick="copyToClipboard('${cu.refCode}');showToast('Referral code copied!','success')" title="Copy">
                <i data-lucide="copy"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Appearance Section ────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="palette"></i>
          <span>Appearance</span>
        </div>
        <div class="settings-card">
          <div class="theme-options">
            <div class="theme-opt ${theme === 'dark' ? 'active' : ''}" onclick="setTheme('dark')">
              <div class="to-preview dark-preview"><i data-lucide="moon"></i></div>
              <div class="to-label">Dark</div>
            </div>
            <div class="theme-opt ${theme === 'light' ? 'active' : ''}" onclick="setTheme('light')">
              <div class="to-preview light-preview"><i data-lucide="sun"></i></div>
              <div class="to-label">Light</div>
            </div>
          </div>

          <div class="settings-color-label">Accent Color</div>
          <div class="color-swatches">
            ${accentColors.map(([c, name]) =>
              `<div class="swatch ${accent.toLowerCase() === c.toLowerCase() ? 'active' : ''}" style="background:${c};" title="${name}" onclick="setAccentColor('${c}')">
                <i data-lucide="check" class="swatch-check"></i>
              </div>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- ── Audio & Playback Section ──────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="headphones"></i>
          <span>Audio & Playback</span>
        </div>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="play"></i>
              <div>
                <strong>Autoplay</strong>
                <p class="dim">Automatically play next song</p>
              </div>
            </div>
            <label class="toggle"><input type="checkbox" id="set-autoplay" ${auto ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="text"></i>
              <div>
                <strong>Show Lyrics</strong>
                <p class="dim">Display lyrics if available</p>
              </div>
            </div>
            <label class="toggle"><input type="checkbox" id="set-lyrics" ${lyrics ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="audio-waveform"></i>
              <div>
                <strong>Audio Quality</strong>
              </div>
            </div>
            <select id="set-quality" class="settings-select" onchange="saveSettingsFromUI()">
              <option value="normal" ${quality === 'normal' ? 'selected' : ''}>Normal (128kbps)</option>
              <option value="high" ${quality === 'high' ? 'selected' : ''}>High (320kbps)</option>
              <option value="lossless" ${quality === 'lossless' ? 'selected' : ''}>Lossless (FLAC)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ── Notifications Section ─────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="bell"></i>
          <span>Notifications</span>
        </div>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="user-plus"></i>
              <div><strong>New followers</strong></div>
            </div>
            <label class="toggle"><input type="checkbox" id="notif-follow" ${nf ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="message-circle"></i>
              <div><strong>New comments</strong></div>
            </div>
            <label class="toggle"><input type="checkbox" id="notif-comment" ${nc ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="banknote"></i>
              <div><strong>Earnings milestones</strong></div>
            </div>
            <label class="toggle"><input type="checkbox" id="notif-earn" ${ne ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="disc-3"></i>
              <div><strong>New releases from followed artists</strong></div>
            </div>
            <label class="toggle"><input type="checkbox" id="notif-release" ${nr ? 'checked' : ''} onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- ── Danger Zone ───────────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title settings-danger-title">
          <i data-lucide="triangle-alert"></i>
          <span>Danger Zone</span>
        </div>
        <div class="settings-card settings-danger-card">
          <div class="settings-danger-notice">
            <i data-lucide="info"></i>
            <span>Deleting your account is permanent and cannot be undone. All your data, songs, and earnings will be removed.</span>
          </div>
          <div class="settings-danger-actions">
            <button class="btn btn-danger btn-block" onclick="deleteAccount()">
              <i data-lucide="user-x"></i> Delete Account
            </button>
            <button class="btn btn-ghost btn-block" onclick="logout()">
              <i data-lucide="log-out"></i> Sign Out
            </button>
          </div>
        </div>
      </div>

      ` : `
      <!-- ── Not logged in ─────────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="lock"></i>
          <span>Account</span>
        </div>
        <div class="settings-card settings-not-logged-in">
          <div class="settings-empty-icon"><i data-lucide="user-circle"></i></div>
          <p>Sign in to access account settings</p>
          <button class="btn btn-primary" onclick="openAuthModal()">
            <i data-lucide="log-in"></i> Sign In / Sign Up
          </button>
        </div>
      </div>

      <!-- ── Audio (guest) ─────────────────────────────────── -->
      <div class="settings-section">
        <div class="settings-section-title">
          <i data-lucide="headphones"></i>
          <span>Audio & Playback</span>
        </div>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="play"></i>
              <div>
                <strong>Autoplay</strong>
                <p class="dim">Automatically play next song</p>
              </div>
            </div>
            <label class="toggle"><input type="checkbox" id="set-autoplay" checked onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="text"></i>
              <div>
                <strong>Show Lyrics</strong>
                <p class="dim">Display lyrics if available</p>
              </div>
            </div>
            <label class="toggle"><input type="checkbox" id="set-lyrics" onchange="saveSettingsFromUI()"><span class="toggle-slider"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-row-info">
              <i data-lucide="audio-waveform"></i>
              <div><strong>Audio Quality</strong></div>
            </div>
            <select id="set-quality" class="settings-select" onchange="saveSettingsFromUI()">
              <option value="normal">Normal (128kbps)</option>
              <option value="high" selected>High (320kbps)</option>
              <option value="lossless">Lossless (FLAC)</option>
            </select>
          </div>
        </div>
      </div>
      `}
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Bio character counter
  const bioEl = document.getElementById('st-bio');
  const bioCount = document.getElementById('bio-count');
  if (bioEl && bioCount) {
    bioEl.addEventListener('input', () => { bioCount.textContent = bioEl.value.length; });
  }
}

// ── Policy modal ──────────────────────────────────────────────
function openPolicyModal(type) {
  const modal = document.getElementById('modal-policy');
  const title = document.getElementById('policy-modal-title');
  const body  = document.getElementById('policy-modal-body');

  const policies = {
    terms: {
      icon: 'file-text',
      title: 'Terms of Service',
      content: `
        <div class="policy-body">
          <div class="policy-title">DUODROP Terms of Service</div>
          <div class="policy-date">Effective Date: 1 January 2025</div>

          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using DUODROP ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use the Platform.</p>

          <h2>2. Description of Service</h2>
          <p>DUODROP is Malawi's premier music streaming platform that allows artists to upload, distribute, and monetise their music, and allows fans to discover, stream, and share music from local and international artists.</p>

          <h2>3. User Accounts</h2>
          <p>You must be at least 13 years old to create an account. You are responsible for maintaining the security of your account credentials. DUODROP is not liable for any loss resulting from unauthorized use of your account.</p>

          <h2>4. Artist Upload Rules</h2>
          <ul>
            <li>You must own all rights to the music you upload.</li>
            <li>Copyrighted material not owned by you is strictly prohibited.</li>
            <li>A one-time upload fee of MK 5,000 per song is required, paid to National Bank Account 1014013314.</li>
            <li>All uploads are subject to review and approval by DUODROP administrators.</li>
            <li>DUODROP reserves the right to remove any content that violates these terms.</li>
          </ul>

          <h2>5. Earnings &amp; Payments</h2>
          <ul>
            <li>Artists earn MK 1 per completed full stream of their song.</li>
            <li>A minimum of 100 followers is required to start earning.</li>
            <li>A minimum of 1,000 plays per song is required before withdrawal.</li>
            <li>Fans earn MK 2 for each new user who registers via their referral link.</li>
            <li>DUODROP reserves the right to withhold earnings from accounts found in violation of these terms.</li>
          </ul>

          <h2>6. Prohibited Conduct</h2>
          <ul>
            <li>Uploading content that is offensive, pornographic, or harmful.</li>
            <li>Manipulating play counts or engagement through artificial means.</li>
            <li>Harassing or threatening other users.</li>
            <li>Creating fake accounts or impersonating others.</li>
            <li>Attempting to hack, reverse-engineer, or disrupt the Platform.</li>
          </ul>

          <h2>7. Content Ownership</h2>
          <p>Artists retain full ownership of their uploaded music. By uploading to DUODROP, you grant us a non-exclusive, worldwide licence to stream, promote, and display your music on the Platform.</p>

          <h2>8. Termination</h2>
          <p>DUODROP may suspend or terminate your account at any time for violation of these Terms without prior notice. You may also delete your account at any time from the Settings page.</p>

          <h2>9. Limitation of Liability</h2>
          <p>DUODROP is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform.</p>

          <h2>10. Changes to Terms</h2>
          <p>We reserve the right to update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the new Terms.</p>

          <h2>11. Governing Law</h2>
          <p>These Terms are governed by the laws of the Republic of Malawi. Any disputes shall be resolved in the courts of Malawi.</p>

          <h2>12. Contact</h2>
          <p>For questions about these Terms, contact us at: <strong>0888 240 630</strong></p>
        </div>`
    },
    privacy: {
      icon: 'shield',
      title: 'Privacy Policy',
      content: `
        <div class="policy-body">
          <div class="policy-title">DUODROP Privacy Policy</div>
          <div class="policy-date">Effective Date: 1 January 2025</div>

          <h2>1. Introduction</h2>
          <p>DUODROP ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our platform.</p>

          <h2>2. Information We Collect</h2>
          <h3>Information You Provide</h3>
          <ul>
            <li>Account information: username, full name, email address, password (hashed)</li>
            <li>Profile information: bio, profile picture, social media links</li>
            <li>Payment information: mobile money numbers, transaction references (for verification only)</li>
            <li>Music uploads: audio files, artwork, metadata</li>
            <li>Communications: comments, messages, support requests</li>
          </ul>

          <h3>Information Collected Automatically</h3>
          <ul>
            <li>Usage data: songs played, searches, pages visited</li>
            <li>Device information: browser type, operating system</li>
            <li>Listening history and preferences</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To provide and improve the DUODROP service</li>
            <li>To process artist earnings and fan referral payments</li>
            <li>To verify payment for song uploads</li>
            <li>To personalise your music discovery experience</li>
            <li>To communicate platform updates and notifications</li>
            <li>To enforce our Terms of Service and prevent fraud</li>
          </ul>

          <h2>4. Data Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul>
            <li>Payment processors (Airtel Money, TNM Mpamba, National Bank) solely for payment verification</li>
            <li>Law enforcement when required by Malawian law</li>
            <li>Service providers who help us operate the Platform, under strict confidentiality agreements</li>
          </ul>

          <h2>5. Data Storage &amp; Security</h2>
          <p>Your data is stored securely. We use industry-standard security measures to protect your information from unauthorised access, alteration, or destruction. However, no method of transmission over the internet is 100% secure.</p>

          <h2>6. Your Rights</h2>
          <ul>
            <li>Access your personal data at any time through your profile settings</li>
            <li>Correct inaccurate information in your profile</li>
            <li>Delete your account and associated data from Settings</li>
            <li>Opt out of non-essential communications</li>
          </ul>

          <h2>7. Cookies</h2>
          <p>DUODROP uses local storage (similar to cookies) to save your preferences, session data, and listening history. This data stays on your device and is not transmitted to third parties.</p>

          <h2>8. Children's Privacy</h2>
          <p>DUODROP is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us information, please contact us immediately.</p>

          <h2>9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify users of significant changes. Continued use of the Platform after changes constitutes acceptance.</p>

          <h2>10. Contact Us</h2>
          <p>For privacy-related questions or requests, please contact us at:<br>
          <strong>Phone: 0888 240 630</strong><br>
          DUODROP, Malawi</p>
        </div>`
    },
    help: {
      icon: 'help-circle',
      title: 'Help Centre',
      content: `
        <div class="policy-body">
          <div class="policy-title">DUODROP Help Centre</div>
          <div class="policy-date">We're here to help you get the most out of DUODROP</div>

          <h2>Getting Started</h2>
          <h3>How do I create an account?</h3>
          <p>Click "Sign In" then select "Sign Up". Fill in your username, name, email and password. Choose whether you are a Fan or an Artist. Click "Create Account" and you're ready to go!</p>

          <h3>How do I reset my password?</h3>
          <p>Go to Settings, Security, then enter your current password and your new password. If you forgot your password entirely, contact us at 0888 240 630 for assistance.</p>

          <h2>For Artists</h2>
          <h3>How do I upload music?</h3>
          <p>1. Make sure you have an Artist account (upgrade in Settings if needed).<br>
          2. Pay MK 5,000 upload fee to National Bank Account 1014013314 via Airtel Money, Mpamba, or bank transfer.<br>
          3. Click "Upload Music" in the sidebar.<br>
          4. Fill in your song details, upload your audio file and artwork.<br>
          5. Enter your payment transaction reference and submit.</p>

          <h3>How do I earn money?</h3>
          <ul>
            <li>You earn MK 1 for every complete stream of your song.</li>
            <li>You need at least 100 followers to start earning.</li>
            <li>You need at least 1,000 plays on a song before you can withdraw earnings from it.</li>
            <li>Go to Earnings to cash out via Airtel Money or Mpamba.</li>
          </ul>

          <h3>Why was my song not approved?</h3>
          <p>Songs may be rejected if they contain copyrighted material you don't own, offensive content, or if the payment reference cannot be verified. Contact us for more information: 0888 240 630.</p>

          <h2>For Fans</h2>
          <h3>How do I earn as a fan?</h3>
          <p>Share your referral link (found in My Library, Shared Links). Every new user who registers through your link earns you MK 2. You can also share songs and artist profiles to earn.</p>

          <h2>Account &amp; Technical</h2>
          <h3>How do I change my profile picture?</h3>
          <p>Go to Settings, Profile and click on your avatar image to upload a new photo.</p>

          <h3>The app is not working correctly</h3>
          <p>Try refreshing the page. If problems persist, contact us at 0888 240 630 for assistance.</p>

          <h2>Contact Support</h2>
          <p><strong>Phone / WhatsApp: 0888 240 630</strong><br>
          Available Monday-Friday, 8am-5pm CAT</p>
        </div>`
    },
    contact: {
      icon: 'mail',
      title: 'Contact Us',
      content: `
        <div class="policy-body">
          <div class="policy-title">Contact DUODROP</div>
          <div class="policy-date">We'd love to hear from you</div>

          <h2>Phone &amp; WhatsApp</h2>
          <p style="font-size:18px; font-weight:700; color:var(--accent)">0888 240 630</p>
          <p>Available Monday-Friday, 8:00am - 5:00pm (Central Africa Time)</p>

          <h2>TNM Mpamba</h2>
          <p>Send payment references or top-up queries to: <strong>0888 240 630</strong></p>

          <h2>Payment Accounts</h2>
          <ul>
            <li><strong>National Bank:</strong> Account 1014013314</li>
            <li><strong>Airtel Money:</strong> 0984 076 531</li>
            <li><strong>TNM Mpamba:</strong> 0888 240 630</li>
          </ul>

          <h2>What We Can Help With</h2>
          <ul>
            <li>Upload payment verification</li>
            <li>Earnings withdrawal requests</li>
            <li>Account issues and password resets</li>
            <li>Content removal requests</li>
            <li>Artist partnerships and promotions</li>
            <li>Technical support</li>
            <li>General enquiries</li>
          </ul>

          <h2>Response Times</h2>
          <ul>
            <li>Phone calls: Immediate during business hours</li>
            <li>WhatsApp messages: Within 2-4 hours</li>
            <li>Payment verifications: Within 24 hours</li>
          </ul>

          <p style="margin-top:20px; color:var(--text-dim);">DUODROP is proudly based in Malawi, built by Richard Cameron and Sean Mkomera for the love of Malawian music.</p>
        </div>`
    }
  };

  const p = policies[type];
  if (!p) return;

  title.innerHTML = `<i data-lucide="${p.icon}"></i> ${p.title}`;
  body.innerHTML = p.content;

  if (window.lucide) lucide.createIcons();
  openModal('modal-policy');
}

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  const current = DB.Settings.theme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function setTheme(theme) {
  DB.Settings.setTheme(theme);
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-btn');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    if (window.lucide) lucide.createIcons();
  }

  // Save to Firebase
  if (API.auth.isLoggedIn()) {
    API.auth.saveSettings({ theme }).catch(() => {});
  }

  _userSettings.theme = theme;
  if (document.getElementById('page-settings').classList.contains('active')) renderSettings();
  showToast(`${theme === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'info');
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  DB.Settings.set('accentColor', color);
  _userSettings.accentColor = color;

  // Save to Firebase
  if (API.auth.isLoggedIn()) {
    API.auth.saveSettings({ accentColor: color }).catch(() => {});
  }

  // Update active swatches
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.style.background.toLowerCase() === color.toLowerCase() ||
      rgbToHex(s.style.backgroundColor) === color.toLowerCase());
  });

  showToast('Accent color updated!', 'success');
  renderSettings();
}

function rgbToHex(rgb) {
  if (!rgb || rgb.startsWith('#')) return rgb?.toLowerCase();
  const match = rgb.match(/\d+/g);
  if (!match) return rgb;
  return '#' + match.slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('');
}

// ── Auto-save settings from UI ────────────────────────────────
function saveSettingsFromUI() {
  const prefs = {
    audio: {
      autoplay:  document.getElementById('set-autoplay')?.checked ?? true,
      lyrics:    document.getElementById('set-lyrics')?.checked ?? false,
      quality:   document.getElementById('set-quality')?.value || 'high',
    },
    notifications: {
      followers:  document.getElementById('notif-follow')?.checked ?? true,
      comments:   document.getElementById('notif-comment')?.checked ?? true,
      earnings:   document.getElementById('notif-earn')?.checked ?? true,
      releases:   document.getElementById('notif-release')?.checked ?? true,
    }
  };

  _userSettings.audio = prefs.audio;
  _userSettings.notifications = prefs.notifications;

  if (API.auth.isLoggedIn()) {
    API.auth.saveSettings(prefs).catch(() => {});
  }
}

// ── Profile save ──────────────────────────────────────────────
async function saveProfile() {
  const cu = DB.Users.current();
  if (!cu) return;

  const website = document.getElementById('st-website')?.value.trim() || '';
  if (website) {
    try { new URL(website); } catch { showToast('Website must be a valid URL', 'error'); return; }
  }

  const updates = {
    name:   document.getElementById('st-name')?.value.trim() || cu.name,
    bio:    document.getElementById('st-bio')?.value.trim().slice(0, 300) || '',
    phone:  document.getElementById('st-phone')?.value.trim() || '',
    social: {
      website,
      facebook:  document.getElementById('st-fb')?.value.trim()  || '',
      instagram: document.getElementById('st-ig')?.value.trim()  || '',
      twitter:   document.getElementById('st-tw')?.value.trim()  || '',
    },
  };

  // Save locally for instant UI
  DB.Users.update(cu.id, updates);
  updateUserUI();

  // Persist to server/Firebase
  try {
    const result = await API.auth.updateProfile(updates);
    if (result.user) {
      localStorage.setItem('dd_user', JSON.stringify(result.user));
    }
    showToast('Profile saved!', 'success');
  } catch (err) {
    showToast('Profile saved locally but sync failed: ' + err.message, 'error');
  }
}

// ── Username save ─────────────────────────────────────────────
async function saveUsername() {
  const cu = DB.Users.current();
  if (!cu) return;

  const newUsername = document.getElementById('st-username')?.value.trim() || '';
  const errEl = document.getElementById('err-st-username');

  if (!newUsername) {
    errEl.textContent = 'Username is required';
    errEl.className = 'settings-field-error';
    return;
  }
  if (newUsername.length < 3) {
    errEl.textContent = 'Username must be at least 3 characters';
    errEl.className = 'settings-field-error';
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errEl.textContent = 'Only letters, numbers, and underscores allowed';
    errEl.className = 'settings-field-error';
    return;
  }

  if (newUsername === cu.username) return;

  errEl.textContent = 'Checking availability...';
  errEl.className = 'settings-field-hint';

  try {
    // Update local DB instantly to prevent 404 errors from breaking UI
    DB.Users.update(cu.id, { username: newUsername });
    const updatedUser = DB.Users.find(cu.id);
    localStorage.setItem('dd_user', JSON.stringify(updatedUser));
    updateUserUI();
    showToast('Username updated!', 'success');
    errEl.textContent = '';
    
    // Attempt backend sync
    const result = await API.auth.updateUsername(newUsername);
    if (result.user && result.user.refCode) {
      DB.Users.update(cu.id, { refCode: result.user.refCode });
    }
  } catch (err) {
    console.warn('Backend sync failed, but local DB updated: ' + err.message);
  }
}

// ── Avatar ────────────────────────────────────────────────────
function handleSettingsAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const cu = DB.Users.current();
    if (!cu) return;
    DB.Users.update(cu.id, { avatar: e.target.result });
    updateUserUI();
    renderSettings();
    showToast('Profile picture updated!', 'success');
  };
  reader.readAsDataURL(file);
}

// ── Password ──────────────────────────────────────────────────
async function changePassword() {
  const cu    = DB.Users.current();
  const oldPw = document.getElementById('st-old-pw')?.value || '';
  const newPw = document.getElementById('st-new-pw')?.value || '';
  const errOld = document.getElementById('err-st-old-pw');
  const errNew = document.getElementById('err-st-new-pw');

  errOld.textContent = '';
  errNew.textContent = '';

  if (!oldPw) { errOld.textContent = 'Please enter your current password'; return; }
  if (newPw.length < 8) { errNew.textContent = 'Password must be at least 8 characters'; return; }

  DB.Users.update(cu.id, { password: newPw });
  document.getElementById('st-old-pw').value = '';
  document.getElementById('st-new-pw').value = '';
  showToast('Password updated!', 'success');
}

// ── Upgrade to artist ─────────────────────────────────────────
async function upgradeToArtist() {
  const cu = DB.Users.current();
  if (!cu) return;
  if (!confirm('Switch your account to an Artist account? You will be able to upload music and earn kwacha.')) return;

  DB.Users.update(cu.id, { role: 'artist' });
  updateUserUI();
  renderSettings();
  showToast('Upgrading your account...', 'info');

  try {
    const result = await API.auth.updateProfile({ role: 'artist' });
    if (result.user) {
      localStorage.setItem('dd_user', JSON.stringify(result.user));
    }
    await _fetch('/api/artists/register', { method: 'POST', body: JSON.stringify({}) });
    showToast('You are now an Artist! Go upload your music.', 'success');
  } catch (err) {
    console.error('[upgradeToArtist]', err);
    showToast('Role saved locally. Sync failed: ' + err.message, 'error');
  }
}

// ── Delete Account ──────────────────────────────────────────
async function deleteAccount() {
  const cu = DB.Users.current();
  if (!cu) return;

  // First confirmation
  if (!confirm('Are you sure you want to delete your account? This will permanently remove all your data, songs, earnings, and profile.')) return;
  // Second confirmation
  if (!confirm('This action CANNOT be undone. Type "DELETE" in your mind and click OK to proceed.')) return;

  showToast('Deleting your account...', 'info');

  try {
    // Delete from Firebase backend
    if (API.auth.isLoggedIn()) {
      await API.auth.deleteAccount();
    }

    // Clear local data
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_refresh');
    localStorage.removeItem('dd_user');
    localStorage.removeItem('duodrop_v2');
    localStorage.clear();

    showToast('Account deleted. You will be signed out.', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    console.error('[deleteAccount]', err);
    showToast('Failed to delete account: ' + err.message + '. Contact support if this persists.', 'error');
  }
}

// ── About page renderer ────────────────────────────────────────
function renderAbout() {
  if (window.lucide) lucide.createIcons();
}

// ── Boot: load settings from Firebase ─────────────────────────
(async () => {
  await _loadUserSettings();
  if (_userSettings.theme) {
    document.documentElement.setAttribute('data-theme', _userSettings.theme);
    DB.Settings.setTheme(_userSettings.theme);
  }
  if (_userSettings.accentColor) {
    document.documentElement.style.setProperty('--accent', _userSettings.accentColor);
    DB.Settings.set('accentColor', _userSettings.accentColor);
  }
})();
