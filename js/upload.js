/* ================================================================
   DUODROP — Upload Module
   Payment is REQUIRED via PayChangu before any song is saved.
   Flow:
     1. Artist fills form & selects files → clicks "Upload"
     2. Guidelines modal → "Proceed to payment with PayChangu"
     3. Files upload to Cloudinary (so URLs are ready)
     4. PaychanguCheckout() popup opens
     5. On success PayChangu redirects to ?payment=success&tx_ref=...
     6. We verify the tx_ref with PayChangu API (server-side)
     7. If verified, song is saved — otherwise, upload is rejected
   ================================================================ */

let _audioFile   = null;
let _artworkFile = null;
let _artworkUrl  = '';

/* ── On page load: handle PayChangu return callback ───────────── */
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('payment') === 'success') {
    const txRef      = urlParams.get('tx_ref');
    const pendingJson = localStorage.getItem('_pendingPaychanguUpload');

    if (pendingJson && txRef) {
      const progressEl = document.getElementById('upload-progress');
      const barFill    = document.getElementById('upload-bar-fill');
      const progText   = document.getElementById('upload-prog-text');

      if (progressEl) progressEl.style.display = 'block';
      if (barFill)    barFill.style.width = '80%';
      if (progText)   progText.textContent = 'Verifying payment…';

      try {
        const pendingData = JSON.parse(pendingJson);

        // ── Verify payment with server before saving ──────────
        if (barFill)  barFill.style.width = '88%';
        if (progText) progText.textContent = 'Confirming payment with PayChangu…';

        const verifyRes = await _fetch(`/api/payments/verify?tx_ref=${encodeURIComponent(txRef)}`, 'GET');

        if (!verifyRes || verifyRes.status !== 'success') {
          throw new Error('Payment could not be verified. Please contact support.');
        }

        // ── Payment confirmed — save the song ─────────────────
        if (barFill)  barFill.style.width = '95%';
        if (progText) progText.textContent = 'Saving your song…';

        await API.songs.create({ ...pendingData, txref: txRef });
        localStorage.removeItem('_pendingPaychanguUpload');

        window.history.replaceState({}, document.title, window.location.pathname);
        showToast(`"${pendingData.title}" submitted! It will go live after admin review.`, 'success');
        if (typeof showPage === 'function') showPage('dashboard');

      } catch (err) {
        console.error('Payment verification / save error:', err);
        localStorage.removeItem('_pendingPaychanguUpload');
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('❌ ' + err.message, 'error');
      } finally {
        if (progressEl) progressEl.style.display = 'none';
      }

    } else if (!pendingJson) {
      // No pending upload — ignore stale redirect
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  if (urlParams.get('payment') === 'cancelled') {
    localStorage.removeItem('_pendingPaychanguUpload');
    window.history.replaceState({}, document.title, window.location.pathname);
    showToast('Payment was cancelled. Your files are safe — try again when ready.', 'warning');
  }
});

/* ── File handlers ─────────────────────────────────────────────── */
function handleAudioFile(input) {
  const file = input.files[0];
  if (!file) return;

  const schema = z.file()
    .maxSize(50 * 1024 * 1024, 'Audio file must be max 50 MB')
    .accept(['audio/'], 'Only audio files are accepted (MP3, WAV, FLAC, AAC)');

  const result = schema.safeParse(file);
  if (!result.success) {
    showFieldError('err-u-audio', result.error.issues[0].message); return;
  }
  clearFieldError('err-u-audio');
  _audioFile = file;

  const label = document.getElementById('audio-fd-content');
  label.innerHTML = `<div class="fd-icon"><i data-lucide="check-circle" style="color:#10b981;"></i></div><div class="fd-label">${escHtml(file.name)}</div><div class="fd-hint">${(file.size/1024/1024).toFixed(2)} MB</div>
  <button class="btn btn-sm btn-danger" style="margin-top:10px; position:relative; z-index:10;" onclick="removeAudioFile(event)">Remove</button>`;
  if (window.lucide) lucide.createIcons();
  document.getElementById('audio-drop').classList.add('has-file');

  const url = URL.createObjectURL(file);
  const tmpAudio = new Audio(url);
  tmpAudio.onloadedmetadata = () => {
    const dur = fmtTime(tmpAudio.duration);
    label.innerHTML += `<div class="fd-hint">Duration: ${dur}</div>`;
  };

  const preview = document.getElementById('audio-preview');
  if (preview) { preview.src = url; preview.style.display = 'block'; }
}

function handleArtwork(input) {
  const file = input.files[0];
  if (!file) return;

  const schema = z.file()
    .maxSize(5 * 1024 * 1024, 'Artwork must be max 5 MB')
    .accept(['image/'], 'Only image files are accepted (JPG, PNG)');

  const result = schema.safeParse(file);
  if (!result.success) {
    showFieldError('err-u-art', result.error.issues[0].message); return;
  }
  clearFieldError('err-u-art');
  _artworkFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    _artworkUrl = e.target.result;
    document.getElementById('art-preview-inner').innerHTML =
      `<img src="${_artworkUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
    document.getElementById('art-drop').classList.add('has-file');
  };
  reader.readAsDataURL(file);
}

/* Drag-and-drop */
['audio-drop', 'art-drop'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('dragover',  e => { e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', () => el.classList.remove('dragover'));
  el.addEventListener('drop', e => {
    e.preventDefault(); el.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (id === 'audio-drop') { document.getElementById('u-audio').files = e.dataTransfer.files; handleAudioFile(document.getElementById('u-audio')); }
    else { document.getElementById('u-art').files = e.dataTransfer.files; handleArtwork(document.getElementById('u-art')); }
  });
});

/* ── Form submit ─────────────────────────────────────────────── */
function submitUpload(e) {
  e.preventDefault();

  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); showToast('Sign in to upload music', 'error'); return; }

  if (cu.role !== 'artist') {
    document.getElementById('modal-become-artist').style.display = 'flex';
    return;
  }

  const title = document.getElementById('u-title').value.trim();
  const genre = document.getElementById('u-genre').value;
  const desc  = document.getElementById('u-desc').value.trim();
  const tags  = document.getElementById('u-tags').value.trim();
  const type  = document.getElementById('u-type').value;
  const price = parseFloat(document.getElementById('u-price').value || 0);

  // Generate a unique tx_ref for this upload
  const txref = 'DUODROP-' + Date.now() + '-' + Math.floor(Math.random() * 9999);

  // Validate required metadata fields only
  if (!title)  { showFieldError('err-u-title', 'Song title is required'); return; }
  if (!genre)  { showFieldError('err-u-genre', 'Please select a genre'); return; }
  if (!desc)   { showFieldError('err-u-desc',  'Please add a description'); return; }

  // File validation
  if (!_audioFile) { showFieldError('err-u-audio', 'Please upload your audio file'); return; }
  if (!_artworkFile && !_artworkUrl) { showFieldError('err-u-art', 'Please upload cover artwork'); return; }

  // Store data and show guidelines modal
  window._pendingUploadData = { title, genre, desc, tags, type, price, txref, amount: 5000, artistId: cu.id };
  document.getElementById('modal-upload-guidelines').style.display = 'flex';
}

window.agreeAndUpload = function() {
  closeModal('modal-upload-guidelines');
  if (window._pendingUploadData) {
    doUpload(window._pendingUploadData);
    window._pendingUploadData = null;
  }
};

window.activateArtistFromModal = async function() {
  const btn = document.querySelector('#modal-become-artist .btn-accent');
  btn.disabled = true;
  btn.innerHTML = '<i class="lucide-loader"></i> Activating...';
  
  try {
    const cu = DB.Users.current();
    if (cu) {
      await _fetch('/api/artists/register', 'POST', { name: cu.name, bio: 'New artist on DUODROP' });
      await _fetch('/api/auth/profile', 'PATCH', { role: 'artist' });
      cu.role = 'artist';
      DB.Users.update(cu);
      showToast('Artist account activated!', 'success');
      closeModal('modal-become-artist');
    }
  } catch(e) {
    showToast('Failed to activate artist account: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="zap"></i> Activate Artist Account';
    if (window.lucide) lucide.createIcons();
  }
};

window.removeAudioFile = function(e) {
  e.stopPropagation();
  _audioFile = null;
  document.getElementById('u-audio').value = '';
  document.getElementById('audio-fd-content').innerHTML = '<div class="fd-icon"><i data-lucide="music"></i></div><div class="fd-label">Drop audio here or <span>click to browse</span></div><div class="fd-hint">MP3, WAV, FLAC, AAC — max 50 MB</div>';
  const preview = document.getElementById('audio-preview');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }
  document.getElementById('audio-drop').classList.remove('has-file');
  if (window.lucide) lucide.createIcons();
};

/* ── Core upload pipeline ─────────────────────────────────────── */
async function doUpload(data) {
  const progressEl = document.getElementById('upload-progress');
  const barFill    = document.getElementById('upload-bar-fill');
  const progText   = document.getElementById('upload-prog-text');
  const submitBtn  = document.querySelector('#upload-form button[type="submit"]');

  submitBtn.disabled = true;
  progressEl.style.display = 'block';

  const setProgress = (pct, msg) => {
    barFill.style.width = pct + '%';
    progText.textContent = msg;
  };

  try {
    // Step 1: Sign audio upload
    setProgress(10, 'Preparing secure upload…');
    const audioSign = await API.upload.signAudio();

    // Step 2: Upload audio to Cloudinary
    setProgress(15, 'Uploading audio file…');
    const audioRes = await API.upload.toCloudinary(_audioFile, audioSign, pct => {
      setProgress(15 + Math.round(pct * 0.45), `Uploading audio… ${pct}%`);
    });
    const audioUrl = audioRes.secure_url;
    const audioDur = audioRes.duration
      ? `${Math.floor(audioRes.duration / 60)}:${String(Math.floor(audioRes.duration % 60)).padStart(2,'0')}`
      : '0:00';

    // Step 3: Upload artwork to Cloudinary
    let artworkUrl = '';
    if (_artworkFile) {
      setProgress(62, 'Uploading cover artwork…');
      const artSign = await API.upload.signImage();
      const artRes  = await API.upload.toCloudinary(_artworkFile, artSign, pct => {
        setProgress(62 + Math.round(pct * 0.13), `Uploading artwork… ${pct}%`);
      });
      artworkUrl = artRes.secure_url;
    } else if (_artworkUrl) {
      artworkUrl = _artworkUrl;
    }

    // Step 4: Save all data to localStorage, then open PayChangu checkout
    setProgress(78, 'Opening payment…');
    const cu = DB.Users.current();
    const finalData = { ...data, audioUrl, artworkUrl, duration: audioDur };
    localStorage.setItem('_pendingPaychanguUpload', JSON.stringify(finalData));

    const returnBase = window.location.origin + window.location.pathname;

    PaychanguCheckout({
      public_key:   'pub-test-w8Zu6ifqPUOWrk30m9bMKvarGK2wJrP8',
      tx_ref:       data.txref,
      amount:       5000,
      currency:     'MWK',
      callback_url: returnBase + '?payment=success&tx_ref=' + data.txref,
      return_url:   returnBase + '?payment=success&tx_ref=' + data.txref,
      customer: {
        email:      cu.email      || 'artist@duodrop.com',
        first_name: (cu.name || 'Artist').split(' ')[0],
        last_name:  (cu.name || '').split(' ').slice(1).join(' ') || 'Duodrop',
      },
      customization: {
        title:       'DUODROP Upload Fee',
        description: `MK 5,000 upload fee for "${data.title}"`,
      },
      onclose: () => {
        // User closed popup without paying
        showToast('Payment was not completed. Your files are ready — try again when you\'re ready.', 'warning');
        submitBtn.disabled = false;
        progressEl.style.display = 'none';
      }
    });

    // Execution pauses here — PayChangu takes over.
    // The page will redirect to ?payment=success on completion.

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed: ' + err.message, 'error');
    submitBtn.disabled = false;
    progressEl.style.display = 'none';
  }
}

/* ── Reset form ──────────────────────────────────────────────── */
function _resetUploadForm() {
  document.getElementById('upload-form').reset();
  _audioFile   = null;
  _artworkFile = null;
  _artworkUrl  = '';
  document.getElementById('audio-fd-content').innerHTML =
    '<div class="fd-icon"><i data-lucide="music"></i></div><div class="fd-label">Drop audio here or <span>click to browse</span></div><div class="fd-hint">MP3, WAV, FLAC, AAC — max 50 MB</div>';

  const preview = document.getElementById('audio-preview');
  if (preview) { preview.style.display = 'none'; preview.src = ''; }

  document.getElementById('art-preview-inner').innerHTML =
    '<div class="fd-icon"><i data-lucide="image"></i></div><div class="fd-label">Click to upload artwork</div><div class="fd-hint">JPG or PNG — min 500×500px</div>';
  ['audio-drop','art-drop'].forEach(id => document.getElementById(id)?.classList.remove('has-file'));
  document.getElementById('zod-status').innerHTML = '';
  if (window.lucide) lucide.createIcons();
}

/* ── Field error helpers ─────────────────────────────────────── */
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = '⚠ ' + msg; el.className = 'fe show'; }
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.className = 'fe'; }
}
