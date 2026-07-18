/* ================================================================
   DUODROP — Music Charts
   ================================================================ */

let _chartPeriod = 'weekly';
let _chartGenre  = 'all';

function renderCharts() {
  const el = document.getElementById('charts-content');
  if (!el) return;

  const allSongs = DB.Songs.all().filter(s => s.status === 'approved');

  // Period filter (simulated via play-count tiers)
  function getSongScore(song) {
    const plays = song.plays || 0;
    if (_chartPeriod === 'weekly')   return Math.floor(plays * 0.08 + Math.random() * 20);
    if (_chartPeriod === 'monthly')  return Math.floor(plays * 0.35 + Math.random() * 50);
    return plays;
  }

  let songs = allSongs
    .filter(s => _chartGenre === 'all' || s.genre === _chartGenre)
    .map(s => ({ ...s, _score: getSongScore(s) }))
    .sort((a, b) => b._score - a._score);

  // Top artist spotlight — artist with most plays overall
  const topArtist = DB.Artists.topArtists(1)[0];
  const topArtistSongs = topArtist ? DB.Songs.byArtist(topArtist.id).filter(s => s.status === 'approved').slice(0, 3) : [];

  // Genre options
  const genres = ['all', ...new Set(allSongs.map(s => s.genre).filter(Boolean))];

  const cu = DB.Users.current();

  el.innerHTML = `
    <!-- Period tabs -->
    <div style="display:flex; gap:8px; margin-bottom:24px; flex-wrap:wrap;">
      ${['weekly','monthly','alltime'].map(p => `
        <button class="btn btn-sm ${_chartPeriod===p?'btn-primary':'btn-outline'}" onclick="setChartPeriod('${p}')">
          ${p==='weekly'?'📅 This Week':p==='monthly'?'📆 This Month':'🏆 All Time'}
        </button>`).join('')}
    </div>

    <!-- Genre filter pills -->
    <div class="genre-pills" style="margin-bottom:24px;">
      ${genres.map(g => `
        <span class="genre-pill ${_chartGenre===g?'active':''}" onclick="setChartGenre('${g}')">
          ${g === 'all' ? '🎵 All Genres' : g}
        </span>`).join('')}
    </div>

    <div class="charts-layout">
      <!-- Main chart list -->
      <div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
          <h2 class="section-title">
            ${_chartPeriod==='weekly'?'📅 Top Songs This Week':_chartPeriod==='monthly'?'📆 Top Songs This Month':'🏆 All-Time Top Songs'}
            ${_chartGenre!=='all'?` — ${_chartGenre}`:''}
          </h2>
          <span class="dim">${songs.length} tracks</span>
        </div>

        ${songs.length === 0 ? `<div class="empty-state"><div class="es-icon">🎵</div><p>No songs found for this filter</p></div>` : ''}

        <div class="song-list">
          ${songs.slice(0, 50).map((s, i) => {
            const artist  = DB.Users.find(s.artistId);
            const liked   = cu ? DB.Likes.isLiked(cu.id, s.id) : false;
            const rank    = i + 1;
            const medal   = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
            const isTop3  = rank <= 3;
            const maxScore = songs[0]?._score || 1;
            const pct     = Math.round((s._score / maxScore) * 100);

            return `
              <div class="song-row chart-row ${isTop3?'chart-top3':''}" onclick="playSong('${s.id}')" style="${isTop3?'background:var(--card);border-radius:12px;padding:12px 14px;border:1px solid var(--border);margin-bottom:6px;':''}">
                <div class="sr-rank" style="${isTop3?'font-size:20px;':''}">
                  ${isTop3 ? medal : `<span style="color:var(--text-dim)">${rank}</span>`}
                </div>
                <div class="sr-art" style="background:${genreColor(s.genre)};">
                  ${s.artwork ? `<img src="${s.artwork}">` : '🎵'}
                </div>
                <div class="sr-info" style="flex:1;">
                  <div class="sr-title">
                    ${s.title}
                    ${s.type==='premium'?'<span class="badge-prem">⭐</span>':''}
                    ${isTop3?`<span style="font-size:11px;background:rgba(206,17,38,.15);color:var(--accent);padding:1px 6px;border-radius:10px;margin-left:6px;">#${rank} Chart</span>`:''}
                  </div>
                  <div class="sr-artist" onclick="event.stopPropagation();viewArtist('${s.artistId}')">${artist?.name||'?'} · ${s.genre}</div>
                  ${isTop3 ? `
                  <div style="margin-top:6px;">
                    <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;width:200px;">
                      <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px;"></div>
                    </div>
                  </div>` : ''}
                </div>
                <div class="sr-plays">▶ ${fmtNum(s._score)}</div>
                <div class="sr-acts">
                  <button class="icon-btn" data-like-id="${s.id}" onclick="event.stopPropagation();toggleLikeSong('${s.id}',this)">${liked?'❤️':'🤍'}</button>
                  <button class="icon-btn" onclick="event.stopPropagation();openComments('${s.id}')">💬</button>
                  <button class="icon-btn" onclick="event.stopPropagation();shareSong('${s.id}')">🔗</button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Sidebar: Spotlight + Rising Artists -->
      <div style="display:flex;flex-direction:column;gap:20px;">

        ${topArtist ? `
        <!-- Artist Spotlight -->
        <div style="background:linear-gradient(135deg,rgba(206,17,38,.12),rgba(0,82,42,.12));border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:16px;">⭐ ARTIST SPOTLIGHT</div>
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:16px;">
            <div style="width:72px;height:72px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#fff;margin-bottom:10px;overflow:hidden;border:3px solid rgba(206,17,38,.4);">
              ${topArtist.avatar ? `<img src="${topArtist.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : topArtist.username.slice(0,2).toUpperCase()}
            </div>
            <div style="font-size:16px;font-weight:800;">${topArtist.name}</div>
            <div style="font-size:12px;color:var(--text-dim);">@${topArtist.username}</div>
            <div style="display:flex;gap:14px;margin:8px 0;font-size:12px;color:var(--text-dim);">
              <span>👥 ${DB.Artists.followerCount(topArtist.id)} followers</span>
              <span>▶ ${fmtNum(DB.Songs.byArtist(topArtist.id).reduce((s,x)=>s+(x.plays||0),0))} plays</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="viewArtist('${topArtist.id}')">View Artist</button>
          </div>
          ${topArtistSongs.length ? `
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--text-dim);margin-bottom:8px;">TOP TRACKS</div>
          ${topArtistSongs.map((s,i) => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;border-bottom:1px solid var(--border);" onclick="playSong('${s.id}')">
              <span style="color:var(--accent);font-weight:700;width:16px;">${i+1}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.title}</div>
                <div style="font-size:11px;color:var(--text-dim);">▶ ${fmtNum(s.plays||0)}</div>
              </div>
            </div>`).join('')}` : ''}
        </div>` : ''}

        <!-- Rising Artists -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:16px;">🚀 TOP ARTISTS</div>
          ${DB.Artists.topArtists(5).map((a, i) => {
            const plays = DB.Songs.byArtist(a.id).reduce((s,x)=>s+(x.plays||0),0);
            return `
              <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;" onclick="viewArtist('${a.id}')">
                <span style="color:var(--accent);font-weight:800;width:18px;text-align:center;">${i+1}</span>
                <div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0;">
                  ${a.avatar ? `<img src="${a.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : a.username.slice(0,2).toUpperCase()}
                </div>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13px;font-weight:600;">${a.name}</div>
                  <div style="font-size:11px;color:var(--text-dim);">▶ ${fmtNum(plays)} · 👥 ${DB.Artists.followerCount(a.id)}</div>
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Genre Breakdown -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:16px;">🎨 GENRE BREAKDOWN</div>
          ${(() => {
            const genreCounts = {};
            allSongs.forEach(s => { genreCounts[s.genre] = (genreCounts[s.genre]||0) + (s.plays||0); });
            const total = Object.values(genreCounts).reduce((a,b)=>a+b,0) || 1;
            return Object.entries(genreCounts)
              .sort((a,b)=>b[1]-a[1])
              .slice(0, 6)
              .map(([genre, plays]) => {
                const pct = Math.round((plays/total)*100);
                return `
                  <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                      <span>${genre}</span><span style="color:var(--text-dim)">${pct}%</span>
                    </div>
                    <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                      <div style="height:100%;width:${pct}%;background:${genreColor(genre)};border-radius:2px;"></div>
                    </div>
                  </div>`;
              }).join('');
          })()}
        </div>

      </div>
    </div>
  `;
}

function setChartPeriod(period) {
  _chartPeriod = period;
  renderCharts();
}

function setChartGenre(genre) {
  _chartGenre = genre;
  renderCharts();
}
