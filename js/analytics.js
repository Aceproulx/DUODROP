/* ================================================================
   DUODROP — Analytics Dashboard & Earnings (v2)
   Professional YouTube-style analytics with Lucide icons
   ================================================================ */

// ── Analytics state ───────────────────────────────────────────
let _anaRange   = 28;      // days; 0 = lifetime
let _anaSortKey = 'plays';
let _anaSortDir = 'desc';

function setAnaRange(days) { _anaRange = Number(days) || 0; renderDashboard(); }

function setAnaSort(key) {
  if (_anaSortKey === key) _anaSortDir = _anaSortDir === 'desc' ? 'asc' : 'desc';
  else { _anaSortKey = key; _anaSortDir = 'desc'; }
  renderDashboard();
}

// ── Date / series helpers ─────────────────────────────────────
function _isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _periodSeries(map, days) {
  const series = [];
  const today  = new Date();
  if (days > 0) {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = _isoDate(d);
      series.push({ label: k, value: map[k] || 0 });
    }
    return series;
  }
  // Lifetime — earliest recorded day (capped at ~12 months)
  const keys = Object.keys(map).sort();
  if (!keys.length) return [];
  const start = new Date(Math.max(new Date(keys[0] + 'T00:00:00').getTime(), today.getTime() - 364 * 86400000));
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    series.push({ label: _isoDate(d), value: map[_isoDate(d)] || 0 });
  }
  return series;
}

function _sumSeries(series) { return series.reduce((a, p) => a + p.value, 0); }

function _deltaPct(series) {
  if (!series || series.length < 2) return null;
  const mid  = Math.floor(series.length / 2);
  const cur  = series.slice(mid).reduce((a, p) => a + p.value, 0);
  const prev = series.slice(0, mid).reduce((a, p) => a + p.value, 0);
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

function _durSec(d) {
  if (!d) return 0;
  const p = String(d).split(':').map(Number);
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return 0;
}

function _niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base;
}

// ── UI builders ───────────────────────────────────────────────
function _rangePills() {
  const opts = [['7', 'Last 7 days'], ['28', 'Last 28 days'], ['90', 'Last 90 days'], ['0', 'Lifetime']];
  return `
    <div class="range-pills">
      ${opts.map(([v, label]) =>
        `<button class="range-pill ${String(_anaRange) === v ? 'active' : ''}" onclick="setAnaRange(${v})">${label}</button>`
      ).join('')}
    </div>`;
}

function _rangeSuffix() {
  if (_anaRange === 7) return 'in the last 7 days';
  if (_anaRange === 28) return 'in the last 28 days';
  if (_anaRange === 90) return 'in the last 90 days';
  return 'of all time';
}

function _sparkline(values, color = 'var(--accent)') {
  if (!values.length) return '';
  const w = 140, h = 34, pad = 3;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const rng = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / rng) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="spark-svg"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function _kpiCard({ icon, color, bg, label, value, delta, spark }) {
  let chip;
  if (delta === null) chip = '<span class="kpi-chip neutral">All time</span>';
  else if (delta >= 0) chip = `<span class="kpi-chip up"><i data-lucide="trending-up"></i> ${delta.toFixed(0)}%</span>`;
  else chip = `<span class="kpi-chip down"><i data-lucide="trending-down"></i> ${Math.abs(delta).toFixed(0)}%</span>`;
  return `
    <div class="kpi-card">
      <div class="kpi-top">
        <div class="kpi-icon" style="color:${color}; background:${bg};"><i data-lucide="${icon}"></i></div>
        ${chip}
      </div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${label}</div>
      ${spark ? `<div class="kpi-spark">${spark}</div>` : ''}
    </div>`;
}

function _th(key, label) {
  const active = _anaSortKey === key;
  const dir    = active && _anaSortDir === 'asc' ? 'up' : 'down';
  return `<th class="sort-th ${active ? 'sorted' : ''}" data-sort="${key}" onclick="setAnaSort('${key}')">${label}${active ? ` <i data-lucide="chevron-${dir}"></i>` : ''}</th>`;
}

function _sortedSongs(songs, history) {
  const bySong = {};
  history.forEach(h => {
    if (h.type === 'play' && h.songId) bySong[h.songId] = (bySong[h.songId] || 0) + (h.amount || 1);
  });
  const rows = songs.map(s => ({
    song: s,
    plays: s.plays || 0,
    likes: s.likes || 0,
    comments: DB.Comments.get(s.id).length,
    downloads: s.downloads || 0,
    earned: bySong[s.id] || 0,
  }));
  const dir = _anaSortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => (a[_anaSortKey] - b[_anaSortKey]) * dir);
  return rows;
}

// ── Views area chart (SVG) ────────────────────────────────────
function _renderViewsChart(el, series) {
  if (!el) return;
  if (!series || series.length < 2) {
    el.innerHTML = `
      <div class="chart-empty">
        <i data-lucide="activity"></i>
        <p>Not enough data yet — as listeners play your music, your views over time will appear here.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const W    = el.offsetWidth || 700;
  const H    = 280;
  const padL = 48, padR = 12, padT = 16, padB = 32;
  const iw   = W - padL - padR;
  const ih   = H - padT - padB;
  const max  = _niceMax(Math.max(...series.map(p => p.value), 1));

  const x = i => padL + (i / (series.length - 1)) * iw;
  const y = v => padT + ih - (v / max) * ih;

  const line = series.map((p, i) => x(i).toFixed(1) + ',' + y(p.value).toFixed(1)).join(' ');
  const area = `${padL},${padT + ih} ${line} ${(padL + iw).toFixed(1)},${padT + ih}`;

  const grid = [0, .25, .5, .75, 1].map(f => {
    const gy = padT + ih - f * ih;
    const val = Math.round(max * f);
    return `<line x1="${padL}" y1="${gy}" x2="${padL + iw}" y2="${gy}" class="ana-gridline"/>
            <text x="${padL - 8}" y="${gy + 4}" class="ana-y" text-anchor="end">${fmtNum(val)}</text>`;
  }).join('');

  const labelCount = Math.min(series.length, 7);
  const labels = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (series.length - 1));
    const d = new Date(series[idx].label + 'T00:00:00');
    labels.push(`<text x="${x(idx).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="ana-x">${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>`);
  }

  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="ana-chart-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="ana-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity=".35"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      ${labels.join('')}
      <polygon points="${area}" fill="url(#ana-fill)"/>
      <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <line id="ana-guide" x1="0" y1="${padT}" x2="0" y2="${padT + ih}" class="ana-guide" visibility="hidden"/>
      <circle id="ana-dot" r="5" class="ana-dot" visibility="hidden"/>
      <rect x="${padL}" y="${padT}" width="${iw}" height="${ih}" fill="transparent" onmousemove="chartHover(event)" onmouseleave="chartLeave(event)"/>
    </svg>
    <div class="ana-tip" id="ana-tip"></div>`;

  el._chart = { x, y, series, padL, iw, W, H };
}

function chartHover(evt) {
  const svg  = evt.currentTarget.closest('svg');
  const wrap = svg.parentElement;
  const c    = wrap._chart;
  if (!c) return;
  const rect = svg.getBoundingClientRect();
  const px   = evt.clientX - rect.left;
  let idx = Math.round(((px - c.padL) / c.iw) * (c.series.length - 1));
  idx = Math.max(0, Math.min(c.series.length - 1, idx));
  const p    = c.series[idx];
  const xPos = c.x(idx);
  const yPos = c.y(p.value);

  const guide = svg.querySelector('#ana-guide');
  const dot   = svg.querySelector('#ana-dot');
  if (guide) { guide.setAttribute('x1', xPos); guide.setAttribute('x2', xPos); guide.setAttribute('visibility', 'visible'); }
  if (dot)   { dot.setAttribute('cx', xPos); dot.setAttribute('cy', yPos); dot.setAttribute('visibility', 'visible'); }

  const tip = wrap.querySelector('#ana-tip');
  if (tip) {
    const d = new Date(p.label + 'T00:00:00');
    tip.innerHTML = `<strong>${fmtNum(p.value)}</strong> plays<span style="color:var(--text-dim)"> · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>`;
    tip.style.display = 'block';
    const tw = tip.offsetWidth || 130;
    let left = xPos + 12;
    if (left + tw > c.W - 8) left = xPos - tw - 12;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = Math.max(8, yPos - 34) + 'px';
  }
}

function chartLeave(evt) {
  const wrap = evt.currentTarget.closest('svg').parentElement;
  const guide = wrap.querySelector('#ana-guide');
  const dot   = wrap.querySelector('#ana-dot');
  if (guide) guide.setAttribute('visibility', 'hidden');
  if (dot)   dot.setAttribute('visibility', 'hidden');
  const tip = wrap.querySelector('#ana-tip');
  if (tip) tip.style.display = 'none';
}

// ── DASHBOARD ─────────────────────────────────────────────────
function renderDashboard() {
  const cu = DB.Users.current();
  const el = document.getElementById('dashboard-content');
  if (!el) return;

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

  const songs       = DB.Songs.byArtist(cu.id);
  const liveSongs   = songs.filter(s => s.status !== 'rejected' && s.status !== 'banned');
  const pendingSongs= songs.filter(s => !s.verified && s.status !== 'rejected' && s.status !== 'banned');
  const earnings    = DB.ArtistEarnings.get(cu.id);
  const followers   = DB.Artists.followerCount(cu.id);
  const canWithdraw = DB.ArtistEarnings.canWithdraw(cu.id);

  // ── Daily aggregates (plays + earned plays by date) ──────────
  const playsMap = {};
  songs.forEach(s => {
    const day = (DB.get().playsDaily && DB.get().playsDaily[s.id]) || {};
    Object.entries(day).forEach(([d, cnt]) => { playsMap[d] = (playsMap[d] || 0) + cnt; });
  });
  const earnMap = {};
  earnings.history.forEach(h => {
    if (h.type === 'play') {
      const d = _isoDate(new Date(h.ts));
      earnMap[d] = (earnMap[d] || 0) + (h.amount || 1);
    }
  });

  const viewsSeries = _periodSeries(playsMap, _anaRange);
  const earnSeries  = _periodSeries(earnMap, _anaRange);
  const periodViews = _sumSeries(viewsSeries);
  const periodEarn  = _sumSeries(earnSeries);

  // Watch time estimate: period views × average track duration
  const totalDurSec = liveSongs.reduce((a, s) => a + _durSec(s.duration), 0) || 1;
  const avgDurSec   = totalDurSec / (liveSongs.length || 1);
  const watchHours  = (periodViews * avgDurSec) / 3600;
  const watchSeries = viewsSeries.map(p => ({ label: p.label, value: (p.value * avgDurSec) / 3600 }));

  const topSong = [...liveSongs].sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];

  // Milestones
  const milestones = [
    {
      label: 'Followers to Start Earning',
      val: followers, target: 100, met: followers >= 100,
      icon: 'users', color: 'var(--blue)',
    },
    {
      label: topSong ? `Best song "${topSong.title}" — plays to withdraw` : 'Upload a song and reach 1,000 plays',
      val: topSong ? (topSong.plays || 0) : 0,
      target: 1000,
      met: topSong && topSong.plays >= 1000,
      icon: 'play-circle', color: 'var(--accent)',
    },
  ];

  el.innerHTML = `
    <div class="ana-toolbar">
      ${_rangePills()}
      <button class="btn btn-accent btn-sm" onclick="showPage('upload')"><i data-lucide="upload-cloud"></i> Upload Music</button>
    </div>

    <!-- KPI Cards -->
    <div class="kpi-grid">
      ${_kpiCard({
        icon: 'play', color: 'var(--blue)', bg: 'rgba(0,119,182,0.12)',
        label: 'Views', value: fmtNum(periodViews),
        delta: _deltaPct(viewsSeries), spark: _sparkline(viewsSeries.map(p => p.value)),
      })}
      ${_kpiCard({
        icon: 'clock', color: 'var(--purple)', bg: 'rgba(123,45,139,0.12)',
        label: 'Watch time', value: watchHours >= 1 ? watchHours.toFixed(1) + ' hrs' : Math.round(watchHours * 60) + ' min',
        delta: _deltaPct(watchSeries), spark: _sparkline(watchSeries.map(p => p.value)),
      })}
      ${_kpiCard({
        icon: 'banknote', color: 'var(--green-lt)', bg: 'rgba(34,197,94,0.12)',
        label: 'Estimated earnings', value: 'MK ' + Math.round(periodEarn).toLocaleString(),
        delta: _deltaPct(earnSeries), spark: _sparkline(earnSeries.map(p => p.value), 'var(--green-lt)'),
      })}
      ${_kpiCard({
        icon: 'users', color: 'var(--gold)', bg: 'rgba(252,196,23,0.12)',
        label: 'Followers', value: fmtNum(followers), delta: null, spark: '',
      })}
    </div>

    <!-- Views Over Time Chart -->
    <div class="ana-layout">
      <div class="chart-card">
        <div class="chart-hdr">
          <div class="chart-title"><i data-lucide="activity"></i> Views over time</div>
          <div class="chart-summary">
            ${pendingSongs.length ? `<span class="dash-card-badge" style="margin-right:8px;">${pendingSongs.length} pending review</span>` : ''}
            ${fmtNum(periodViews)} plays ${_rangeSuffix()}
          </div>
        </div>
        <div class="ana-chart-wrap" id="ana-chart"></div>
      </div>
    </div>

    <div class="ana-columns">
      <!-- Top Content Table -->
      <div class="dash-card">
        <div class="dash-card-header">
          <div class="dash-card-title"><i data-lucide="music"></i> Top Content</div>
          <span class="dash-card-badge">All time</span>
        </div>
        ${liveSongs.length ? `
          <div class="dash-table-wrap">
            <table class="analytics-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Song</th>
                  ${_th('plays', 'Views')}
                  ${_th('likes', 'Likes')}
                  ${_th('comments', 'Comments')}
                  ${_th('downloads', 'Downloads')}
                  ${_th('earned', 'Earnings')}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${_sortedSongs(liveSongs, earnings.history).map((row, i) => {
                  const s = row.song;
                  return `<tr>
                    <td class="dash-rank">${i + 1}</td>
                    <td>
                      <div class="dash-song-cell">
                        <div class="dash-song-art" style="background:${genreColor(s.genre)};">
                          ${s.artwork ? `<img src="${s.artwork}" alt="">` : `<i data-lucide="music"></i>`}
                        </div>
                        <div class="dash-song-meta">
                          <span class="dash-song-title">${s.title}</span>
                          <span class="dash-song-sub">
                            <span class="badge-genre">${s.genre}</span>
                            <span class="badge-type ${s.type}">${s.type === 'premium' ? 'Premium' : 'Free'}</span>
                          </span>
                        </div>
                      </div>
                    </td>
                    <td><div class="dash-play-count"><i data-lucide="play"></i> ${fmtNum(row.plays)}</div></td>
                    <td><div class="dash-like-count"><i data-lucide="heart"></i> ${row.likes}</div></td>
                    <td><div class="dash-like-count"><i data-lucide="message-circle"></i> ${row.comments}</div></td>
                    <td><div class="dash-like-count"><i data-lucide="download"></i> ${row.downloads}</div></td>
                    <td class="dash-earn-cell">MK ${row.earned.toLocaleString()}</td>
                    <td>
                      <div class="dash-actions">
                        ${s.type === 'free' ? `<button class="icon-btn" title="Download" onclick="downloadSong('${s.id}')"><i data-lucide="download"></i></button>` : ''}
                        <button class="icon-btn danger" title="Delete song" onclick="deleteOwnSong('${s.id}')"><i data-lucide="trash-2"></i></button>
                      </div>
                    </td>
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
      <div class="ana-side">
        <div class="dash-card">
          <div class="dash-card-header">
            <div class="dash-card-title"><i data-lucide="target"></i> Milestones</div>
          </div>

          ${milestones.map(m => {
            const pct = Math.min(100, (m.val / m.target * 100));
            const fillColor = m.met
              ? 'linear-gradient(90deg, #22c55e, #4ade80)'
              : `linear-gradient(90deg, ${m.color}, color-mix(in srgb, ${m.color} 70%, #fff 30%))`;
            return `
            <div class="milestone${m.met ? ' met' : ''}">
              <div class="ml-header">
                <div class="ml-icon-wrap" style="background:${m.met ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)'}; color:${m.met ? 'var(--green-lt)' : m.color};">
                  <i data-lucide="${m.met ? 'check-circle' : m.icon}"></i>
                </div>
                <div class="ml-title-area">
                  <span class="ml-label">${m.label}</span>
                  <span class="ml-status ${m.met ? 'met' : ''}">${m.met ? '✓ Achieved' : `${pct.toFixed(0)}% complete`}</span>
                </div>
              </div>
              <div class="ml-prog-track">
                <div class="ml-prog-fill" style="width:${pct.toFixed(1)}%; background:${fillColor};"></div>
              </div>
              <div class="ml-footer">
                <span class="ml-values">${fmtNum(m.val)} / ${fmtNum(m.target)}</span>
                <span class="ml-pct">${pct.toFixed(0)}%</span>
              </div>
            </div>`;
          }).join('')}

          <div class="dash-section-divider"></div>

          <div class="dash-card-header" style="margin-bottom:12px;">
            <div class="dash-card-title"><i data-lucide="coins"></i> How You Earn</div>
          </div>
          <div class="rules-list">
            <div class="rule-item">
              <div class="rule-icon-wrap" style="color:var(--blue); background:rgba(0,119,182,0.1);"><i data-lucide="play"></i></div>
              <div class="rule-text"><strong>MK 1 per full play</strong><p>Every completed stream of your song</p></div>
            </div>
            <div class="rule-item">
              <div class="rule-icon-wrap" style="color:var(--gold); background:rgba(252,196,23,0.1);"><i data-lucide="users"></i></div>
              <div class="rule-text"><strong>100 followers required</strong><p>Reach 100 followers to activate earnings</p></div>
            </div>
            <div class="rule-item">
              <div class="rule-icon-wrap" style="color:var(--accent); background:rgba(206,17,38,0.1);"><i data-lucide="bar-chart-2"></i></div>
              <div class="rule-text"><strong>1,000 plays to withdraw</strong><p>Minimum per song before cash-out</p></div>
            </div>
            <div class="rule-item">
              <div class="rule-icon-wrap" style="color:var(--green-lt); background:rgba(34,197,94,0.1);"><i data-lucide="link"></i></div>
              <div class="rule-text"><strong>Fans earn MK 2/share</strong><p>Referral earnings for fans</p></div>
            </div>
          </div>

          ${canWithdraw
            ? `<button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="showPage('earnings')"><i data-lucide="arrow-up-right"></i> Withdraw Earnings</button>`
            : `<div class="lock-msg"><i data-lucide="lock"></i> <span>Reach 100 followers and 1,000 plays on one song to unlock withdrawal</span></div>`}
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="dash-card">
      <div class="dash-card-header">
        <div class="dash-card-title"><i data-lucide="history"></i> Recent Activity</div>
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

  _renderViewsChart(document.getElementById('ana-chart'), viewsSeries);
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


// Added snippet
// Real-Time Analytics Geographic Data Engine
function loadListenerMapData(analyticsData) {
  const container = document.getElementById('analytics-map');
  if (!container) return;

  container.innerHTML = `
    <div class="geo-analytics-summary">
      <h4>Top Stream Regions</h4>
      <ul>
        ${analyticsData.locations.map(loc => `
          <li>${loc.country}: <strong>${loc.streams.toLocaleString()} streams</strong></li>
        `).join('')}
      </ul>
    </div>
  `;
}
