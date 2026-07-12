/* ================================================================
   DUODROP — Audio Player
   ================================================================ */

let _queue      = [];
let _queueIdx   = -1;
let _shuffle    = false;
let _repeat     = 'off'; // 'off' | 'one' | 'all'
let _muted      = false;
let _played75   = false; // track if 75% played (= "full play" for earnings)

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
  _played75 = false;

  // Visuals
  updatePlayerUI(song);

  // Audio
  if (song.audioUrl) {
    audio.src = song.audioUrl;
    audio.load();
    audio.play().catch(() => {});
  } else {
    // Demo mode — no real audio, simulate play
    simulateDemoPlay(song);
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

  if (window.lucide) lucide.createIcons();
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

    updateProgress(elapsed, durationSecs);

    // Credit play at 75% mark
    if (pct >= 0.75 && !_played75) {
      _played75 = true;
      DB.Songs.incrementPlay(song.id);
    }

    if (pct >= 1) {
      clearInterval(_demoTimer);
      onTrackEnd();
    }
  }, 1000);

  document.getElementById('pbc-play').textContent = '⏸';
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
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// ── HTML5 Audio events ─────────────────────────────────────────
audio.addEventListener('timeupdate', () => {
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  updateProgress(audio.currentTime, audio.duration);

  if (pct >= 75 && !_played75) {
    _played75 = true;
    if (window._currentSong) {
      DB.Songs.incrementPlay(window._currentSong.id);
      // Also persist to server
      if (window.API) API.songs.play(window._currentSong.id);
    }
  }
});

audio.addEventListener('ended', onTrackEnd);
audio.addEventListener('play',  () => {
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="pause"></i>';
  if (window.lucide) lucide.createIcons();
});
audio.addEventListener('pause', () => {
  document.getElementById('pbc-play').innerHTML = '<i data-lucide="play"></i>';
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
