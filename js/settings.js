/* ================================================================
   DUODROP — Settings Module
   ================================================================ */

function renderSettings() {
  const cu     = DB.Users.current();
  const theme  = DB.Settings.theme();
  const el     = document.getElementById('settings-content');

  el.innerHTML = `
    <div class="settings-grid">

      <!-- Theme -->
      <div class="settings-card">
        <h3>🎨 Appearance</h3>
        <p class="dim">Customize the look and feel of DUODROP</p>
        <div class="theme-options">
          <div class="theme-opt ${theme === 'dark' ? 'active' : ''}" onclick="setTheme('dark')">
            <div class="to-preview dark-preview">🌙</div>
            <div class="to-label">Dark Mode</div>
          </div>
          <div class="theme-opt ${theme === 'light' ? 'active' : ''}" onclick="setTheme('light')">
            <div class="to-preview light-preview">☀️</div>
            <div class="to-label">Light Mode</div>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <strong>Accent Color</strong>
            <p class="dim">Change the primary accent color</p>
          </div>
          <div class="color-swatches">
            ${[['#CE1126','Malawi Red'],['#00522A','Malawi Green'],['#FCC417','Gold'],['#7b2d8b','Purple'],['#0077b6','Ocean Blue'],['#f72585','Pink']].map(([c,name]) =>
              `<div class="swatch" style="background:${c};" title="${name}" onclick="setAccentColor('${c}')"></div>`
            ).join('')}
          </div>
        </div>
      </div>

      <!-- Profile (if logged in) -->
      ${cu ? `
      <div class="settings-card">
        <h3>👤 Your Profile</h3>
        <div class="profile-pic-edit">
          <div class="pp-preview" id="settings-pp-preview" onclick="document.getElementById('settings-avatar-input').click()">
            ${cu.avatar ? `<img src="${cu.avatar}" alt="Profile">` : `<span>${cu.username.slice(0,2).toUpperCase()}</span>`}
          </div>
          <span class="pp-change" onclick="document.getElementById('settings-avatar-input').click()">📷 Change Profile Picture</span>
          <input type="file" id="settings-avatar-input" accept="image/*" style="display:none" onchange="handleSettingsAvatar(this)">
        </div>
        <div class="fg">
          <label>Username</label>
          <input type="text" id="st-username" value="${cu.username}" disabled>
        </div>
        <div class="fg">
          <label>Full Name</label>
          <input type="text" id="st-name" value="${cu.name}">
        </div>
        <div class="fg">
          <label>Bio <span style="opacity:.5">(max 300 chars)</span></label>
          <textarea id="st-bio" rows="3" maxlength="300">${cu.bio || ''}</textarea>
        </div>
        <div class="fg">
          <label>Phone (for earnings withdrawal)</label>
          <input type="text" id="st-phone" value="${cu.phone || ''}" placeholder="+265 9XX XXX XXX">
        </div>
        <div class="fg">
          <label>Website</label>
          <input type="url" id="st-website" value="${cu.social?.website || ''}" placeholder="https://yourwebsite.com">
        </div>
        <div class="fg">
          <label>Facebook</label>
          <input type="text" id="st-fb" value="${cu.social?.facebook || ''}" placeholder="facebook.com/yourpage">
        </div>
        <div class="fg">
          <label>Instagram</label>
          <input type="text" id="st-ig" value="${cu.social?.instagram || ''}" placeholder="@yourhandle">
        </div>
        <div class="fg">
          <label>Twitter / X</label>
          <input type="text" id="st-tw" value="${cu.social?.twitter || ''}" placeholder="@yourhandle">
        </div>
        <button class="btn btn-primary btn-block" onclick="saveProfile()">💾 Save Profile</button>
      </div>

      <div class="settings-card">
        <h3>🔑 Change Password</h3>
        <div class="fg">
          <label>Current Password</label>
          <input type="password" id="st-old-pw" placeholder="••••••••">
          <div class="fe" id="err-st-old-pw"></div>
        </div>
        <div class="fg">
          <label>New Password</label>
          <input type="password" id="st-new-pw" placeholder="Min 8 characters">
          <div class="fe" id="err-st-new-pw"></div>
        </div>
        <button class="btn btn-outline btn-block" onclick="changePassword()">🔑 Update Password</button>
      </div>

      <div class="settings-card">
        <h3>🎤 Account Type</h3>
        <p>You are currently a <strong>${cu.role === 'artist' ? '🎤 Artist' : cu.role === 'admin' ? '🛡 Administrator' : '🎵 Fan'}</strong>.</p>
        ${cu.role === 'fan' ? `<button class="btn btn-accent btn-block" onclick="upgradeToArtist()">🎤 Switch to Artist Account</button>` : ''}
        <div style="margin-top:16px;">
          <h4>Your Referral Code</h4>
          <div class="ref-row">
            <input type="text" readonly value="${cu.refCode}" class="ref-input">
            <button class="btn btn-sm btn-outline" onclick="copyToClipboard('${cu.refCode}');showToast('Copied!','success')">📋</button>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <h3>🗑 Danger Zone</h3>
        <p class="dim">These actions are permanent and cannot be undone.</p>
        <button class="btn btn-danger btn-block" onclick="clearAllData()">Clear All Data (Reset App)</button>
        <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="logout()">Sign Out</button>
      </div>` : `
      <div class="settings-card">
        <h3>🔐 Account</h3>
        <p class="dim">Sign in to access account settings</p>
        <button class="btn btn-primary btn-block" onclick="openAuthModal()">Sign In / Sign Up</button>
      </div>`}

      <!-- Audio Settings -->
      <div class="settings-card">
        <h3>🎵 Audio &amp; Playback</h3>
        <div class="setting-row">
          <div><strong>Autoplay</strong><p class="dim">Automatically play next song</p></div>
          <label class="toggle"><input type="checkbox" id="set-autoplay" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><strong>Show Lyrics</strong><p class="dim">Display lyrics if available</p></div>
          <label class="toggle"><input type="checkbox" id="set-lyrics"><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><strong>Audio Quality</strong></div>
          <select id="set-quality" style="background:var(--input-bg);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;">
            <option>Normal (128kbps)</option>
            <option selected>High (320kbps)</option>
            <option>Lossless (FLAC)</option>
          </select>
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-card">
        <h3>🔔 Notifications</h3>
        <div class="setting-row">
          <div><strong>New followers</strong></div>
          <label class="toggle"><input type="checkbox" id="notif-follow" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><strong>New comments</strong></div>
          <label class="toggle"><input type="checkbox" id="notif-comment" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><strong>Earnings milestones</strong></div>
          <label class="toggle"><input type="checkbox" id="notif-earn" checked><span class="toggle-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><strong>New releases from followed artists</strong></div>
          <label class="toggle"><input type="checkbox" id="notif-release" checked><span class="toggle-slider"></span></label>
        </div>
      </div>

      <!-- About -->
      <div class="settings-card">
        <h3>ℹ️ About DUODROP</h3>
        <div class="about-info">
          <div class="about-logo">🎵 DUODROP</div>
          <p>Version 1.0.0</p>
          <p class="dim">Malawi's Number one music streaming platform created by Richard Cameron and Sean Mkomera, built for artists and fans.</p>
          <div class="about-links">
            <a href="#" onclick="openPolicyModal('terms')">Terms of Service</a>
            <a href="#" onclick="openPolicyModal('privacy')">Privacy Policy</a>
            <a href="#" onclick="openPolicyModal('help')">Help Centre</a>
            <a href="#" onclick="openPolicyModal('contact')">Contact Us</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openPolicyModal(type) {
  const modal = document.getElementById('modal-policy');
  const title = document.getElementById('policy-modal-title');
  const body  = document.getElementById('policy-modal-body');

  if (type === 'terms') {
    title.textContent = '📋 Terms of Service';
    body.innerHTML = `
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
      </div>`;
  } else if (type === 'privacy') {
    title.textContent = '🔒 Privacy Policy';
    body.innerHTML = `
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
      </div>`;
  } else if (type === 'help') {
    title.textContent = '❓ Help Centre';
    body.innerHTML = `
      <div class="policy-body">
        <div class="policy-title">DUODROP Help Centre</div>
        <div class="policy-date">We're here to help you get the most out of DUODROP</div>

        <h2>Getting Started</h2>
        <h3>How do I create an account?</h3>
        <p>Click "Sign In" then select "Sign Up". Fill in your username, name, email and password. Choose whether you are a Fan or an Artist. Click "Create Account" and you're ready to go!</p>

        <h3>How do I reset my password?</h3>
        <p>Go to Settings → Change Password. Enter your current password and your new password. If you forgot your password entirely, contact us at 0888 240 630 for assistance.</p>

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
          <li>Go to Earnings → Withdraw to cash out via Airtel Money or Mpamba.</li>
        </ul>

        <h3>Why was my song not approved?</h3>
        <p>Songs may be rejected if they contain copyrighted material you don't own, offensive content, or if the payment reference cannot be verified. Contact us for more information: 0888 240 630.</p>

        <h2>For Fans</h2>
        <h3>How do I earn as a fan?</h3>
        <p>Share your referral link (found in My Library → Shared Links). Every new user who registers through your link earns you MK 2. You can also share songs and artist profiles to earn.</p>

        <h3>How do I download songs?</h3>
        <p>Free songs can be downloaded using the download button (⬇) in the player or song list. Premium songs require a one-time purchase at the artist's set price.</p>

        <h2>Account &amp; Technical</h2>
        <h3>How do I change my profile picture?</h3>
        <p>Go to Settings → Your Profile → click on your avatar image → upload a new photo. Or go to My Profile and click on your avatar to change it directly.</p>

        <h3>The app is not working correctly</h3>
        <p>Try refreshing the page. If problems persist, go to Settings → Danger Zone → Clear All Data to reset (note: this will delete your local data). Then contact us at 0888 240 630.</p>

        <h2>Contact Support</h2>
        <p>📞 <strong>Phone / WhatsApp: 0888 240 630</strong><br>
        Available Monday–Friday, 8am–5pm CAT</p>
      </div>`;
  } else if (type === 'contact') {
    title.textContent = '📬 Contact Us';
    body.innerHTML = `
      <div class="policy-body">
        <div class="policy-title">Contact DUODROP</div>
        <div class="policy-date">We'd love to hear from you</div>

        <h2>📞 Phone &amp; WhatsApp</h2>
        <p style="font-size:18px; font-weight:700; color:var(--accent)">0888 240 630</p>
        <p>Available Monday–Friday, 8:00am – 5:00pm (Central Africa Time)</p>
        <p>For urgent matters outside business hours, please send a WhatsApp message and we'll respond as soon as possible.</p>

        <h2>📱 TNM Mpamba</h2>
        <p>Send payment references or top-up queries to: <strong>0888 240 630</strong></p>

        <h2>🏦 Payment Accounts</h2>
        <ul>
          <li><strong>National Bank:</strong> Account 1014013314</li>
          <li><strong>Airtel Money:</strong> 0984 076 531</li>
          <li><strong>TNM Mpamba:</strong> 0888 240 630</li>
        </ul>

        <h2>💬 What We Can Help With</h2>
        <ul>
          <li>Upload payment verification</li>
          <li>Earnings withdrawal requests</li>
          <li>Account issues and password resets</li>
          <li>Content removal requests</li>
          <li>Artist partnerships and promotions</li>
          <li>Technical support</li>
          <li>General enquiries</li>
        </ul>

        <h2>⏱ Response Times</h2>
        <ul>
          <li>Phone calls: Immediate during business hours</li>
          <li>WhatsApp messages: Within 2–4 hours</li>
          <li>Payment verifications: Within 24 hours</li>
        </ul>

        <p style="margin-top:20px; color:var(--text-dim);">DUODROP is proudly based in Malawi, built by Richard Cameron and Sean Mkomera for the love of Malawian music.</p>
      </div>`;
  }

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
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (document.getElementById('page-settings').classList.contains('active')) renderSettings();
  showToast(`${theme === 'dark' ? '🌙 Dark' : '☀️ Light'} mode enabled`, 'info');
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  DB.Settings.set('accentColor', color);
  showToast('Accent color updated!', 'success');
}

// ── Profile save ──────────────────────────────────────────────
function saveProfile() {
  const cu = DB.Users.current();
  if (!cu) return;

  const website  = document.getElementById('st-website')?.value.trim() || '';
  if (website) {
    try { new URL(website); } catch { showToast('Website must be a valid URL', 'error'); return; }
  }

  DB.Users.update(cu.id, {
    name:   document.getElementById('st-name')?.value.trim() || cu.name,
    bio:    document.getElementById('st-bio')?.value.trim().slice(0, 300) || '',
    phone:  document.getElementById('st-phone')?.value.trim() || '',
    social: {
      website,
      facebook:  document.getElementById('st-fb')?.value.trim()  || '',
      instagram: document.getElementById('st-ig')?.value.trim()  || '',
      twitter:   document.getElementById('st-tw')?.value.trim()  || '',
    },
  });

  updateUserUI();
  showToast('✅ Profile saved!', 'success');
}

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
    showToast('✅ Profile picture updated!', 'success');
  };
  reader.readAsDataURL(file);
}

function changePassword() {
  const cu     = DB.Users.current();
  const oldPw  = document.getElementById('st-old-pw')?.value || '';
  const newPw  = document.getElementById('st-new-pw')?.value || '';

  if (cu.password !== oldPw) {
    document.getElementById('err-st-old-pw').textContent = '⚠ Incorrect current password'; return;
  }
  if (newPw.length < 8) {
    document.getElementById('err-st-new-pw').textContent = '⚠ Password must be at least 8 characters'; return;
  }

  DB.Users.update(cu.id, { password: newPw });
  document.getElementById('st-old-pw').value = '';
  document.getElementById('st-new-pw').value = '';
  showToast('🔑 Password updated!', 'success');
}

function upgradeToArtist() {
  const cu = DB.Users.current();
  if (!cu) return;
  if (confirm('Switch your account to an Artist account? You\'ll be able to upload music and earn kwacha.')) {
    DB.Users.update(cu.id, { role: 'artist' });
    updateUserUI();
    showToast('🎤 You are now an artist! Go upload your music.', 'success');
    renderSettings();
  }
}

function clearAllData() {
  if (!confirm('⚠️ This will delete ALL data including songs, users, and earnings. Are you sure?')) return;
  if (!confirm('This is permanent. Continue?')) return;
  localStorage.clear();
  showToast('All data cleared. Reloading…', 'info');
  setTimeout(() => location.reload(), 1500);
}
