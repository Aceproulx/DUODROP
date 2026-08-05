/* ================================================================
   DUODROP — Audio Player
   ================================================================ */

let _queue      = [];
let _queueIdx   = -1;
let _shuffle    = false;
let _repeat     = 'off'; // 'off' | 'one' | 'all'
let _muted      = false;
let _played75    = false; // true once the current track has credited a play
let _listenedSec = 0;     // cumulative seconds actually heard for the current track
let _lastTime    = 0;     // last reported playback position (for seek-safe accumulation)

// ── Play counting ──────────────────────────────────────────────
// A track is credited a "play" once the listener has actually heard
// 30 seconds of it, or 50% of the track for shorter songs
// (whichever comes first — industry-standard interval).
const PLAY_COUNT_SECONDS = 30;  // seconds of cumulative listening
const PLAY_COUNT_PCT     = 0.5; // share of the track, for short songs

let _npOpen     = false;
let _playPos    = 0;  // shared playback position (seconds) — real audio or demo
let _playDur    = 0;  // shared duration (seconds)

// ── Lyrics ────────────────────────────────────────────────────
let _lyricsVisible  = false;  // lyrics panel open?
let _lyricsSpeed    = 1.0;    // scroll-rate multiplier (0.5×–2×)
let _lyricsLines    = [];     // parsed lines for current track
let _lyricsActiveIdx = -1;    // currently highlighted line

window._currentSong = null;

const audio = document.getElementById('audio-engine');

// ── Play a song by ID ─────────────────────────────────────────
function playSong(id, queue) {
  const song = DB.Songs.find(id);
  if (!song) return;

  // Build a queue if not given
  if (queue) {
    _queue = queue;
    _queueIdx = queue.indexOf(id);
  } else if (_queue.length === 0 || !_queue.includes(id)) {
    // Build queue from same context (all songs sorted by plays)
    _queue    = DB.Songs.trending(50).map(s => s.id);
    _queueIdx = _queue.indexOf(id);
    if (_queueIdx < 0) { _queue.unshift(id); _queueIdx = 0; }
  } else {
    _queueIdx = _queue.indexOf(id);
  }

  window._currentSong = song;
  _resetPlayTracking();

  // Reset lyrics for the new track
  _lyricsLines = [];
  _lyricsActiveIdx = -1;

  // Visuals
  updatePlayerUI(song);
  if (_npOpen) updateNowPlayingUI(song);
  if (_npOpen) renderNpQueue();
  if (_lyricsVisible) renderLyrics(song);

  // Audio
  if (song.audioUrl && song.audioUrl.trim()) {
    audio.src = song.audioUrl;
    
    // Show spinner while buffering
    const pbPlayBtn = document.getElementById('pbc-play');
    if (pbPlayBtn) pbPlayBtn.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i>';
    const npPlayBtn = document.getElementById('np-play');
    if (npPlayBtn) npPlayBtn.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i>';
    if (window.lucide) lucide.createIcons();
    
    audio.load();
    audio.play().catch(err => {
      console.warn('[Player] Audio failed to play:', song.title, song.audioUrl, err);
      showToast('Audio failed to load. Trying next track...', 'error');
      nextTrack();
    });
  } else {
    console.warn('[Player] No audio URL for:', song.title, '| id:', song.id, '| audioUrl:', song.audioUrl);
    showToast(`"${song.title}" has no audio file. Skipping...`, 'error');
    // Auto-skip to next playable track
    if (_queue.length > 1) {
      setTimeout(() => nextTrack(), 800);
    } else {
      simulateDemoPlay(song);
    }
  }

  // Animate vinyl on hero
  const vinyl = document.getElementById('hero-vinyl');
  if (vinyl) vinyl.classList.add('spinning');
}

function updatePlayerUI(song) {
  const artist = DB.Users.find(song.artistId);
  const cu     = DB.Users.current();
  const liked  = cu ? DB.Likes.isLiked(cu.id, song.id) : false;

  document.getElementById('pb-title').textContent  = song.title;
  document.getElementById('pb-artist').textContent = artist?.name || song.artist || '?';

  const likeBtn = document.getElementById('pb-like-btn');
  likeBtn.innerHTML = liked
    ? '<i data-lucide="heart" style="fill:var(--accent);stroke:var(--accent)"></i>'
    : '<i data-lucide="heart"></i>';

  const art = document.getElementById('pb-art');
  if (song.artwork) {
    art.innerHTML = `<img src="${song.artwork}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
  } else {
    art.innerHTML = '<i data-lucide="disc-3"></i>';
    art.style.background = genreColor(song.genre);
  }

  document.getElementById('pb-duration').textContent = song.duration || '0:00';
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="pause"></i>';

  const dlBtn = document.getElementById('pb-dl-btn');
  if (dlBtn) dlBtn.style.display = (song.type === 'free' && song.downloadable !== false) ? 'inline-flex' : 'none';

  _syncLyricsButtons(song);

  if (window.lucide) lucide.createIcons();
}

/* ── Lyrics ────────────────────────────────────────────────── */
function _syncLyricsButtons(song) {
  const hasLyrics = !!(song && song.lyrics && song.lyrics.trim());
  const pbBtn = document.getElementById('pb-lyrics-btn');
  const npBtn = document.getElementById('np-lyrics-btn');
  if (pbBtn) pbBtn.style.display = hasLyrics ? '' : 'none';
  if (npBtn) npBtn.style.display = hasLyrics ? '' : 'none';

  if (!hasLyrics && _lyricsVisible) {
    _lyricsVisible = false;
    _lyricsLines = [];
    const panel = document.getElementById('np-lyrics');
    if (panel) panel.classList.remove('open');
    if (pbBtn) pbBtn.classList.remove('active');
    if (npBtn) npBtn.classList.remove('active');
  }
}

function toggleLyrics() {
  const song = window._currentSong;
  if (!song || !song.lyrics || !song.lyrics.trim()) {
    showToast('No lyrics available for this track', 'info');
    return;
  }

  if (!_npOpen) openNowPlaying(); // openNowPlaying renders lyrics if already visible
  _lyricsVisible = !_lyricsVisible;

  const panel = document.getElementById('np-lyrics');
  if (panel) panel.classList.toggle('open', _lyricsVisible);

  const pbBtn = document.getElementById('pb-lyrics-btn');
  const npBtn = document.getElementById('np-lyrics-btn');
  if (pbBtn) pbBtn.classList.toggle('active', _lyricsVisible);
  if (npBtn) npBtn.classList.toggle('active', _lyricsVisible);

  if (_lyricsVisible) {
    renderLyrics(song);
    updateLyrics(_playPos, _playDur);
  }
}

function renderLyrics(song) {
  const body = document.getElementById('np-lyrics-body');
  if (!body) return;

  const raw = (song && song.lyrics ? song.lyrics : '').trim();
  _lyricsLines = raw ? raw.split('\n').map(l => l.trim()).filter(Boolean) : [];
  _lyricsActiveIdx = -1;

  if (!_lyricsLines.length) {
    body.innerHTML = '<div class="np-lyrics-empty">No lyrics provided for this track.</div>';
    return;
  }

  body.innerHTML = _lyricsLines.map(line => `<div class="np-lyric-line">${escHtml(line)}</div>`).join('');
}

function updateLyrics(current, total) {
  if (!_lyricsVisible || !_lyricsLines.length) return;

  let idx = 0;
  if (total > 0 && _lyricsSpeed > 0) {
    const prog = Math.min((current / total) * _lyricsSpeed, 1);
    idx = Math.min(_lyricsLines.length - 1, Math.floor(prog * _lyricsLines.length));
  }

  if (idx === _lyricsActiveIdx) return;
  _lyricsActiveIdx = idx;

  const body = document.getElementById('np-lyrics-body');
  if (!body) return;
  const items = body.querySelectorAll('.np-lyric-line');
  items.forEach((el, i) => el.classList.toggle('active', i === idx));

  const active = items[idx];
  if (active) {
    const bodyRect = body.getBoundingClientRect();
    const lineRect = active.getBoundingClientRect();
    // Keep the active line centered inside the scrollable area
    body.scrollTop += (lineRect.top - bodyRect.top) - body.clientHeight / 2 + lineRect.height / 2;
  }
}

function setLyricsSpeed(val) {
  _lyricsSpeed = parseFloat(val) || 1;
  const label = document.getElementById('np-lyrics-speed-label');
  if (label) label.textContent = '×' + _lyricsSpeed.toFixed(1);
  _lyricsActiveIdx = -1;
  updateLyrics(_playPos, _playDur);
}

/* ── Play tracking ──────────────────────────────────────────── */
function _resetPlayTracking() {
  _played75    = false;
  _listenedSec = 0;
  _lastTime    = 0;
}

function _playProgress(current) {
  // Accumulate only forward movement — ignore seeks/jumps (>8s) so a
  // listener can't skip straight to the end to farm a play.
  const delta = current - _lastTime;
  if (delta > 0 && delta < 8) _listenedSec += delta;
  _lastTime = current;
}

function _shouldCountPlay(listened, total) {
  if (total <= 0) return false;
  const threshold = Math.min(PLAY_COUNT_SECONDS, total * PLAY_COUNT_PCT);
  return listened >= threshold;
}

function _creditPlay() {
  if (_played75) return;
  _played75 = true;
  const song = window._currentSong;
  if (!song) return;
  DB.Songs.incrementPlay(song.id);
  if (window.API) API.songs.play(song.id);
  _refreshPlayCountsUI(song);
}

function _refreshPlayCountsUI(song) {
  if (!song) return;
  const heroPlays = document.getElementById('hs-plays');
  if (heroPlays) heroPlays.textContent = fmtNum(DB.Stats.total().plays);
  const plays = fmtNum(song.plays || 0);
  document.querySelectorAll(`[data-song-plays-num="${song.id}"]`).forEach(el => {
    el.textContent = plays;
  });
}

// Demo play simulation (for songs without real audio URLs)
let _demoTimer = null;
function simulateDemoPlay(song) {
  clearInterval(_demoTimer);
  const durationSecs = parseDuration(song.duration || '3:00');
  let elapsed = 0;
  const start = Date.now();

  _demoTimer = setInterval(() => {
    elapsed = (Date.now() - start) / 1000;
    const pct = Math.min(elapsed / durationSecs, 1);
    _playPos = elapsed;
    _playDur = durationSecs;

    updateProgress(elapsed, durationSecs);

    // Credit play once the listening interval is met
    if (_shouldCountPlay(elapsed, durationSecs)) {
      _creditPlay();
    }

    if (pct >= 1) {
      clearInterval(_demoTimer);
      onTrackEnd();
    }
  }, 1000);

  document.getElementById('pbc-play').textContent = '⏸';
  const npPlay = document.getElementById('np-play');
  if (npPlay) npPlay.innerHTML = '<i data-lucide="pause"></i>';
  const wave = document.getElementById('np-wave');
  if (wave) wave.classList.add('active');
  if (window.lucide) lucide.createIcons();
}

function parseDuration(str) {
  const parts = str.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

function updateProgress(current, total) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('pb-prog-fill').style.width  = pct + '%';
  document.getElementById('pb-prog-thumb').style.left  = pct + '%';
  document.getElementById('pb-current').textContent    = fmtTime(current);
  document.getElementById('pb-duration').textContent   = fmtTime(total);
  if (_npOpen) updateNpProgress(current, total);
  updateLyrics(current, total);
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── HTML5 Audio events ─────────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  _playPos = audio.currentTime;
  _playDur = audio.duration;
  _playProgress(audio.currentTime);
  updateProgress(audio.currentTime, audio.duration);

  // Credit a play once the listening interval is met
  if (_shouldCountPlay(_listenedSec, audio.duration)) {
    _creditPlay();
  }
});

audio.addEventListener('ended', onTrackEnd);

audio.addEventListener('waiting', () => {
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="loader" class="lucide-spin"></i>';
  const npPlay = document.getElementById('np-play');
  if (npPlay) npPlay.innerHTML = '<i data-lucide="loader" class="lucide-spin"></i>';
  if (window.lucide) lucide.createIcons();
});

audio.addEventListener('playing',  () => {
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="pause"></i>';
  const npPlay = document.getElementById('np-play');
  if (npPlay) npPlay.innerHTML = '<i data-lucide="pause"></i>';
  const wave = document.getElementById('np-wave');
  if (wave) wave.classList.add('active');
  if (window.lucide) lucide.createIcons();
  
  // Preload next track's metadata only (after a delay so current track settles first)
  // Using 'metadata' instead of 'auto' avoids downloading the whole file and freezing the page
  clearTimeout(window._preloadTimer);
  window._preloadTimer = setTimeout(() => {
    if (_queue.length && _queueIdx < _queue.length - 1) {
      const nextId = _queue[_queueIdx + 1];
      const nextSong = DB.Songs.find(nextId);
      if (nextSong && nextSong.audioUrl) {
        if (!window._nextPreloader) window._nextPreloader = new Audio();
        if (window._nextPreloader.src !== nextSong.audioUrl) {
          window._nextPreloader.preload = 'metadata'; // headers only — no full download
          window._nextPreloader.src = nextSong.audioUrl;
        }
      }
    }
  }, 3000); // wait 3s so current track buffers first
});
audio.addEventListener('pause', () => {
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="play"></i>';
  const npPlay = document.getElementById('np-play');
  if (npPlay) npPlay.innerHTML = '<i data-lucide="play"></i>';
  if (window.lucide) lucide.createIcons();
});

function onTrackEnd() {
  if (_repeat === 'one') { playSong(_queue[_queueIdx]); return; }
  if (_repeat === 'all' || _queueIdx < _queue.length - 1) nextTrack();
}

// ── Controls ──────────────────────────────────────────────────
function togglePlay() {
  if (!window._currentSong) return;
  if (audio.src) {
    audio.paused ? audio.play() : audio.pause();
  } else {
    // Demo mode — toggle simulation
    if (_demoTimer) {
      clearInterval(_demoTimer);
      _demoTimer = null;
      document.getElementById('pbc-play').innerHTML = '<i data-lucide="play"></i>';
      const npPlay = document.getElementById('np-play');
      if (npPlay) npPlay.innerHTML = '<i data-lucide="play"></i>';
      if (window.lucide) lucide.createIcons();
    } else {
      simulateDemoPlay(window._currentSong);
    }
  }
}

function nextTrack() {
  if (!_queue.length) return;
  if (_shuffle) {
    _queueIdx = Math.floor(Math.random() * _queue.length);
  } else {
    _queueIdx = (_queueIdx + 1) % _queue.length;
  }
  playSong(_queue[_queueIdx]);
}

function prevTrack() {
  if (!_queue.length) return;
  _queueIdx = Math.max(0, _queueIdx - 1);
  playSong(_queue[_queueIdx]);
}

function seekTo(e) {
  const bar   = document.getElementById('pb-prog-bar');
  const rect  = bar.getBoundingClientRect();
  const pct   = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audio.duration) {
    audio.currentTime = pct * audio.duration;
  }
}

function shuffleToggle() {
  _shuffle = !_shuffle;
  const btn = document.getElementById('pbc-shuffle');
  btn.classList.toggle('active', _shuffle);
  showToast(_shuffle ? '⇄ Shuffle on' : 'Shuffle off', 'info');
}

function repeatToggle() {
  const modes = ['off', 'one', 'all'];
  _repeat = modes[(modes.indexOf(_repeat) + 1) % modes.length];
  const btn = document.getElementById('pbc-repeat');
  btn.classList.toggle('active', _repeat !== 'off');
  btn.textContent = _repeat === 'one' ? '↺¹' : '↺';
  showToast({ off: 'Repeat off', one: '↺ Repeat one', all: '↺ Repeat all' }[_repeat], 'info');
}

function toggleMute() {
  _muted = !_muted;
  audio.muted = _muted;
  const icon = _muted ? 'volume-x' : 'volume-2';
  document.getElementById('pbc-mute').innerHTML = `<i data-lucide="${icon}"></i>`;
  if (window.lucide) lucide.createIcons();
}

function setVolume(val) {
  audio.volume = val / 100;
  _muted = val == 0;
  const icon = _muted ? 'volume-x' : 'volume-2';
  document.getElementById('pbc-mute').innerHTML = `<i data-lucide="${icon}"></i>`;
  if (window.lucide) lucide.createIcons();
}

// Queue a playlist
function playPlaylist(playlistId) {
  const playlist = DB.Playlists.find(playlistId);
  if (!playlist || !playlist.songs.length) { showToast('Playlist is empty', 'info'); return; }
  _queue    = [...playlist.songs];
  _queueIdx = 0;
  playSong(_queue[0], _queue);
}

/* ================================================================
   NOW PLAYING — Full-screen overlay
   ================================================================ */

function openNowPlaying() {
  const ov = document.getElementById('np-overlay');
  if (!ov || !window._currentSong) return;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  _npOpen = true;
  updateNowPlayingUI(window._currentSong);
  renderNpQueue();
  startWaveform();
  if (_lyricsVisible && window._currentSong) {
    const panel = document.getElementById('np-lyrics');
    if (panel) panel.classList.add('open');
    renderLyrics(window._currentSong);
  }
  if (window.lucide) lucide.createIcons();
}

function closeNowPlaying() {
  const ov = document.getElementById('np-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  document.body.style.overflow = '';
  _npOpen = false;
  stopWaveform();
}

function toggleNowPlaying() {
  _npOpen ? closeNowPlaying() : openNowPlaying();
}

function updateNowPlayingUI(song) {
  const artist = DB.Users.find(song.artistId);
  const cu     = DB.Users.current();
  const liked  = cu ? DB.Likes.isLiked(cu.id, song.id) : false;

  // Title + artist
  const t = document.getElementById('np-title');
  const a = document.getElementById('np-artist');
  if (t) t.textContent = song.title;
  if (a) a.textContent = artist?.name || song.artist || '?';

  // Like button
  const lb = document.getElementById('np-like-btn');
  if (lb) lb.className = 'np-action-btn' + (liked ? ' liked' : '');

  // Artwork
  const art = document.getElementById('np-art');
  if (art) {
    if (song.artwork) {
      art.innerHTML = `<img src="${song.artwork}">`;
    } else {
      art.innerHTML = '<i data-lucide="disc-3"></i>';
      art.style.background = typeof genreColor === 'function' ? genreColor(song.genre) : 'var(--accent)';
    }
  }

  // Times
  const dur = song.duration || '0:00';
  const npDur = document.getElementById('np-duration');
  const pbDur = document.getElementById('pb-duration');
  if (npDur) npDur.textContent = dur;
  if (pbDur) pbDur.textContent = dur;

  // Play button icon
  const playing = audio.src && !audio.paused;
  const icon = playing ? 'pause' : 'play';
  const npPlay = document.getElementById('np-play');
  if (npPlay) npPlay.innerHTML = `<i data-lucide="${icon}"></i>`;

  // Shuffle / repeat active states
  const npSh = document.getElementById('np-shuffle');
  const npRp = document.getElementById('np-repeat');
  if (npSh) npSh.classList.toggle('active', _shuffle);
  if (npRp) npRp.classList.toggle('active', _repeat !== 'off');

  // Volume slider
  const vol = document.getElementById('np-vol-slider');
  if (vol) vol.value = audio.volume * 100;

  // Waveform state
  const wave = document.getElementById('np-wave');
  if (wave) wave.classList.toggle('active', playing);

  if (window.lucide) lucide.createIcons();
}

// Sync NP overlay progress with player
function updateNpProgress(current, total) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const npFill = document.getElementById('np-prog-fill');
  const npThumb = document.getElementById('np-prog-thumb');
  const npCur = document.getElementById('np-current');
  const npDur = document.getElementById('np-duration');
  if (npFill) npFill.style.width = pct + '%';
  if (npThumb) npThumb.style.left = pct + '%';
  if (npCur) npCur.textContent = fmtTime(current);
  if (npDur) npDur.textContent = fmtTime(total);
}

// Render queue list in the NP overlay
function renderNpQueue() {
  const list = document.getElementById('np-queue-list');
  if (!list) return;
  if (!_queue.length) { list.innerHTML = '<div class="dim" style="padding:8px;font-size:13px;">No tracks in queue</div>'; return; }

  list.innerHTML = _queue.map((sid, i) => {
    const s = DB.Songs.find(sid);
    if (!s) return '';
    const artist = DB.Users.find(s.artistId);
    const isCurrent = i === _queueIdx;
    return `
      <div class="np-q-item ${isCurrent ? 'current' : ''}" onclick="playSong('${s.id}')">
        <div class="np-q-art" style="background:${typeof genreColor === 'function' ? genreColor(s.genre) : 'var(--card)'};">
          ${s.artwork ? `<img src="${s.artwork}">` : '<i data-lucide="disc-3" style="font-size:14px;"></i>'}
        </div>
        <div class="np-q-info">
          <div class="np-q-title">${s.title}</div>
          <div class="np-q-artist">${artist?.name || '?'}</div>
        </div>
        <span class="np-q-duration">${s.duration || ''}</span>
        <div class="np-q-playing"><span></span><span></span><span></span></div>
      </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

/* ================================================================
   WAVEFORM — Animated canvas behind artwork
   ================================================================ */

let _waveRaf   = null;
let _waveCtx   = null;
let _waveData  = [];
let _wavePhase = 0;

function startWaveform() {
  const canvas = document.getElementById('np-wave');
  if (!canvas) return;
  _waveCtx = canvas.getContext('2d');

  // Size canvas to CSS size
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    _waveCtx.scale(devicePixelRatio, devicePixelRatio);
  };
  resize();
  window.addEventListener('resize', resize);

  // Generate random waveform data (heights 0-1) for visual variety
  if (_waveData.length === 0) {
    const count = 80;
    for (let i = 0; i < count; i++) {
      _waveData.push(0.2 + Math.random() * 0.8);
    }
  }

  _wavePhase = 0;
  _drawWave();
}

function stopWaveform() {
  cancelAnimationFrame(_waveRaf);
  _waveRaf = null;
  _waveCtx = null;
}

function _drawWave() {
  if (!_waveCtx) return;
  const canvas = _waveCtx.canvas;
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;

  _waveCtx.clearRect(0, 0, w, h);

  const bars = _waveData.length;
  const barW = w / bars;
  const gap  = 1.5;
  const midY = h * 0.85;

  // Get playback position for the "played" color split
  let pct = _playDur > 0 ? _playPos / _playDur : 0;

  const playing = audio.src && !audio.paused || _demoTimer !== null;

  for (let i = 0; i < bars; i++) {
    const base = _waveData[i];
    // Animate: subtle breathing when playing, static when paused
    const anim = playing
      ? base * (0.6 + 0.4 * Math.sin(_wavePhase + i * 0.35))
      : base * 0.45;
    const barH = Math.max(2, anim * h * 0.7);

    const x = i * barW + gap / 2;
    const bw = barW - gap;
    const y = midY - barH;

    // Color: accent for played portion, dim for unplayed
    const barPct = (i + 0.5) / bars;
    if (barPct < pct) {
      _waveCtx.fillStyle = 'rgba(206, 17, 38, 0.85)';  // accent
    } else {
      _waveCtx.fillStyle = 'rgba(255, 255, 255, 0.18)'; // dim
    }

    // Rounded bars
    const r = Math.min(bw / 2, 2);
    _waveCtx.beginPath();
    _waveCtx.moveTo(x + r, y);
    _waveCtx.lineTo(x + bw - r, y);
    _waveCtx.quadraticCurveTo(x + bw, y, x + bw, y + r);
    _waveCtx.lineTo(x + bw, midY);
    _waveCtx.lineTo(x, midY);
    _waveCtx.lineTo(x, y + r);
    _waveCtx.quadraticCurveTo(x, y, x + r, y);
    _waveCtx.fill();
  }

  if (playing) _wavePhase += 0.08;
  _waveRaf = requestAnimationFrame(_drawWave);
}

// Make seekTo work from NP overlay too
const _origSeekTo = typeof seekTo === 'function' ? seekTo : null;


// Added snippet
// Waveform & Comment Marker Enhancements
function renderCommentMarkers(comments, trackDuration) {
  const progressBar = document.querySelector('.player-progress-bar');
  if (!progressBar) return;
  
  // Clear old markers
  document.querySelectorAll('.comment-marker').forEach(m => m.remove());

  comments.forEach(comment => {
    const percentage = (comment.timestamp / trackDuration) * 100;
    const marker = document.createElement('div');
    marker.className = 'comment-marker';
    marker.style.left = `${percentage}%`;
    marker.title = `${comment.user}: "${comment.text}" at ${formatTime(comment.timestamp)}`;
    marker.onclick = () => seekToTime(comment.timestamp);
    progressBar.appendChild(marker);
  });
}