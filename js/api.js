/* =================================================================
   DUODROP — API Client
   Thin wrapper around fetch() that calls the Express backend.
   Because Express serves both the frontend and /api/* routes,
   we use relative URLs (no localhost:3000 prefix needed).
   ================================================================= */

// ── Token management ──────────────────────────────────────────
const _token = {
  get()            { return localStorage.getItem('dd_token'); },
  getRefresh()     { return localStorage.getItem('dd_refresh'); },
  set(id, refresh) {
    if (id)      localStorage.setItem('dd_token', id);
    if (refresh) localStorage.setItem('dd_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('dd_token');
    localStorage.removeItem('dd_refresh');
    localStorage.removeItem('dd_user');
  },
  isLoggedIn() { return !!this.get(); },
};

// ── Base fetch ────────────────────────────────────────────────
async function _fetch(path, opts = {}) {
  const token = _token.get();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(path, { ...opts, headers });

  // Auto refresh on 401
  if (res.status === 401 && _token.getRefresh()) {
    try {
      const rr = await fetch('/api/auth/refresh', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken: _token.getRefresh() }),
      });
      if (rr.ok) {
        const { idToken, refreshToken } = await rr.json();
        _token.set(idToken, refreshToken);
        headers['Authorization'] = `Bearer ${idToken}`;
        res = await fetch(path, { ...opts, headers });
      } else {
        _token.clear();
      }
    } catch (_) { _token.clear(); }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── API object ────────────────────────────────────────────────
const API = {

  // ── Auth ─────────────────────────────────────────────────
  auth: {
    async register(payload) {
      const data = await _fetch('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
      if (data.idToken) _token.set(data.idToken, data.refreshToken);
      if (data.user)    localStorage.setItem('dd_user', JSON.stringify(data.user));
      return data;
    },

    async login(email, password, cfToken) {
      const data = await _fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, cfToken }) });
      if (data.idToken) _token.set(data.idToken, data.refreshToken);
      if (data.user)    localStorage.setItem('dd_user', JSON.stringify(data.user));
      return data;
    },

    async me() {
      return _fetch('/api/auth/me');
    },

    async updateProfile(payload) {
      const data = await _fetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(payload) });
      if (data.user) localStorage.setItem('dd_user', JSON.stringify(data.user));
      return data;
    },

    async updateUsername(username) {
      const data = await _fetch('/api/auth/username', { method: 'PATCH', body: JSON.stringify({ username }) });
      if (data.user) localStorage.setItem('dd_user', JSON.stringify(data.user));
      return data;
    },

    async saveSettings(prefs) {
      return _fetch('/api/auth/settings', { method: 'PATCH', body: JSON.stringify(prefs) });
    },

    async getSettings() {
      return _fetch('/api/auth/settings');
    },

    logout() {
      _token.clear();
    },

    deleteAccount() {
      return _fetch('/api/auth/account', { method: 'DELETE' });
    },

    currentUser() {
      try { return JSON.parse(localStorage.getItem('dd_user')); } catch { return null; }
    },

    isLoggedIn: () => _token.isLoggedIn(),
    getToken:   () => _token.get(),
  },

  // ── Songs ─────────────────────────────────────────────────
  songs: {
    list()          { return _fetch('/api/songs'); },
    trending(genre) { return _fetch(`/api/songs/trending${genre ? `?genre=${encodeURIComponent(genre)}` : ''}`); },
    get(id)         { return _fetch(`/api/songs/${id}`); },
    create(payload) { return _fetch('/api/songs', { method: 'POST', body: JSON.stringify(payload) }); },
    play(id)        { return _fetch(`/api/songs/${id}/play`, { method: 'POST' }).catch(() => {}); },
    like(id)        { return _fetch(`/api/songs/${id}/like`, { method: 'POST' }); },
    comments(id)    { return _fetch(`/api/songs/${id}/comments`); },
    comment(id, text) {
      return _fetch(`/api/songs/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
    },
    deleteComment(songId, commentId) {
      return _fetch(`/api/songs/${songId}/comments/${commentId}`, { method: 'DELETE' });
    },
  },

  // ── Artists ───────────────────────────────────────────────
  artists: {
    list()     { return _fetch('/api/artists'); },
    get(id)    { return _fetch(`/api/artists/${id}`); },
    follow(id) { return _fetch(`/api/artists/${id}/follow`, { method: 'POST' }); },
  },

  // ── Upload (Cloudinary signed params) ─────────────────────
  upload: {
    async signAudio() {
      return _fetch('/api/upload/audio-sign', { method: 'POST', body: JSON.stringify({}) });
    },
    async signImage() {
      return _fetch('/api/upload/image-sign', { method: 'POST', body: JSON.stringify({}) });
    },
    async signAvatar() {
      return _fetch('/api/upload/avatar-sign', { method: 'POST', body: JSON.stringify({}) });
    },

    /**
     * Upload a file directly to Cloudinary using signed params.
     * Returns the Cloudinary response (secure_url, public_id, duration, etc.)
     */
    async toCloudinary(file, signedParams, onProgress) {
      const { signature, timestamp, folder, resource_type, cloudName, apiKey } = signedParams;
      const formData = new FormData();
      formData.append('file',      file);
      formData.append('api_key',   apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder',    folder);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resource_type}/upload`);

        if (onProgress) {
          xhr.upload.addEventListener('progress', e => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
          });
        }

        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status === 200) resolve(data);
            else reject(new Error(data.error?.message || 'Upload failed'));
          } catch { reject(new Error('Upload response parse error')); }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    },
  },

  // ── Admin ─────────────────────────────────────────────────
  admin: {
    stats()              { return _fetch('/api/admin/stats'); },
    allSongs()           { return _fetch('/api/admin/songs'); },
    pendingSongs()       { return _fetch('/api/admin/songs/pending'); },
    approveSong(id, status) {
      return _fetch(`/api/admin/songs/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    },
    deleteSong(id) {
      return _fetch(`/api/admin/songs/${id}`, { method: 'DELETE' });
    },
    users()              { return _fetch('/api/admin/users'); },
    banUser(id, banned)  {
      return _fetch(`/api/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned }) });
    },
  },
};

window.API    = API;
window._fetch = _fetch;
