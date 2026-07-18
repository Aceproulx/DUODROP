/* ================================================================
   DUODROP — Upload Module (with Zod validation)
   ================================================================ */

let _audioFile   = null;
let _artworkFile = null;
let _artworkUrl  = '';

// ── File handlers ─────────────────────────────────────────────
function handleAudioFile(input) {
  const file = input.files[0];
  if (!file) return;

  // Zod file validation
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
  label.innerHTML = `<div class="fd-icon">✅</div><div class="fd-label">${escHtml(file.name)}</div><div class="fd-hint">${(file.size/1024/1024).toFixed(2)} MB</div>`;
  document.getElementById('audio-drop').classList.add('has-file');

  // Try to read duration and setup preview
  const url = URL.createObjectURL(file);
  const tmpAudio = new Audio(url);
  tmpAudio.onloadedmetadata = () => {
    const dur = fmtTime(tmpAudio.duration);
    label.innerHTML += `<div class="fd-hint">Duration: ${dur}</div>`;
    // We do NOT revoke the object URL here because we need it for the preview player
  };
  
  // Set up preview player
  const preview = document.getElementById('audio-preview');
  if (preview) {
    preview.src = url;
    preview.style.display = 'block';
  }
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

// Drag-and-drop support
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
    else { document.getElementById('u-art').files   = e.dataTransfer.files; handleArtwork(document.getElementById('u-art')); }
  });
});

// ── Submit ────────────────────────────────────────────────────
function submitUpload(e) {
  e.preventDefault();

  const cu = DB.Users.current();
  if (!cu) { openAuthModal(); showToast('Sign in to upload music', 'error'); return; }

  if (cu.role !== 'artist') {
    showToast('Only artist accounts can upload music. Change your role in Settings.', 'error'); return;
  }

  // Gather values
  const title    = document.getElementById('u-title').value.trim();
  const genre    = document.getElementById('u-genre').value;
  const desc     = document.getElementById('u-desc').value.trim();
  const tags     = document.getElementById('u-tags').value.trim();
  const type     = document.getElementById('u-type').value;
  const price    = parseFloat(document.getElementById('u-price').value || 0);
  const txref    = document.getElementById('u-txref').value.trim();
  
  // Amount paid checkbox logic
  const amountCb = document.getElementById('u-amount-cb');
  let amount = 0;
  if (amountCb && amountCb.checked) {
    amount = 5000;
    // Set hidden field so zod validation (which might check id 'u-amount') passes if it expects a number
    document.getElementById('u-amount').value = 5000;
  } else {
    document.getElementById('u-amount').value = 0;
  }

  const agree    = document.getElementById('u-agree').checked;

  // Zod schema validation
  const schema = z.schemas.upload();
  const values = { title, genre, desc, tags, type, txref, amount, agree };

  const result = z.validateForm(schema, values, {
    title:  'err-u-title',
    genre:  'err-u-genre',
    desc:   'err-u-desc',
    txref:  'err-u-txref',
    amount: 'err-u-amount',
    agree:  'err-u-agree',
  });

  // Show Zod validation result
  z.showStatus('zod-status', result);

  if (!result.success) {
    showToast('❌ Please fix the validation errors below', 'error');
    return;
  }

  // File validation
  if (!_audioFile) { showFieldError('err-u-audio', 'Please upload your audio file'); return; }
  if (!_artworkFile && !_artworkUrl) { showFieldError('err-u-art', 'Please upload cover artwork'); return; }

  // Simulate upload progress
  doUpload({ title, genre, desc, tags, type, price, txref, amount, artistId: cu.id });
}

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
    // ── Step 1: Sign audio upload ────────────────────────────
    setProgress(10, 'Preparing secure upload…');
    const audioSign = await API.upload.signAudio();

    // ── Step 2: Upload audio to Cloudinary ───────────────────
    setProgress(15, 'Uploading audio file…');
    const audioRes = await API.upload.toCloudinary(_audioFile, audioSign, pct => {
      setProgress(15 + Math.round(pct * 0.45), `Uploading audio… ${pct}%`);
    });
    const audioUrl   = audioRes.secure_url;
    const audioDur   = audioRes.duration
      ? `${Math.floor(audioRes.duration / 60)}:${String(Math.floor(audioRes.duration % 60)).padStart(2,'0')}`
      : '0:00';

    // ── Step 3: Upload artwork to Cloudinary ─────────────────
    let artworkUrl = '';
    if (_artworkFile) {
      setProgress(62, 'Uploading cover artwork…');
      const artSign  = await API.upload.signImage();
      const artRes   = await API.upload.toCloudinary(_artworkFile, artSign, pct => {
        setProgress(62 + Math.round(pct * 0.18), `Uploading artwork… ${pct}%`);
      });
      artworkUrl = artRes.secure_url;
    } else if (_artworkUrl) {
      artworkUrl = _artworkUrl; // base64 fallback
    }

    // ── Step 4: Save metadata to backend ─────────────────────
    setProgress(82, 'Saving song metadata…');
    const cu = DB.Users.current();
    await API.songs.create({
      ...data,
      audioUrl,
      artworkUrl,
      duration: audioDur,
    });

    setProgress(100, 'Done! Your song is under review.');
    await new Promise(r => setTimeout(r, 800));

    _resetUploadForm();
    showToast(`"${data.title}" submitted! It will go live after admin review.`, 'success');
    showPage('dashboard');

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Upload failed: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    progressEl.style.display = 'none';
  }
}

function _resetUploadForm() {
  document.getElementById('upload-form').reset();
  _audioFile   = null;
  _artworkFile = null;
  _artworkUrl  = '';
  document.getElementById('audio-fd-content').innerHTML =
    '<div class="fd-icon"><i data-lucide="music"></i></div><div class="fd-label">Drop audio here or <span>click to browse</span></div><div class="fd-hint">MP3, WAV, FLAC, AAC — max 50 MB</div>';
  
  const preview = document.getElementById('audio-preview');
  if (preview) {
    preview.style.display = 'none';
    preview.src = '';
  }

  document.getElementById('art-preview-inner').innerHTML =
    '<div class="fd-icon"><i data-lucide="image"></i></div><div class="fd-label">Click to upload artwork</div><div class="fd-hint">JPG or PNG — min 500×500px</div>';
  ['audio-drop','art-drop'].forEach(id => document.getElementById(id)?.classList.remove('has-file'));
  document.getElementById('zod-status').innerHTML = '';
  if (window.lucide) lucide.createIcons();
}

// ── Field error helpers ───────────────────────────────────────
function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = '⚠ ' + msg; el.className = 'fe show'; }
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.className = 'fe'; }
}
