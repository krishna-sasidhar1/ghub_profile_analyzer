/* ==============================================
   GitScope — GitHub Profile Analyzer + Compare
   ============================================== */

const GITHUB_API = 'https://api.github.com';

// ── Chart palette ──────────────────────────────
const COLORS = ['#58a6ff','#3fb950','#d29922','#db61a2','#f85149','#8957e5','#39d353','#ff7b72'];

// ── Chart instances ────────────────────────────
let langChart    = null;
let actChart     = null;
let cmpBarChart  = null;
let cmpLangChart = null;
let cmpRadar     = null;

// ==============================================
//  MODE SWITCHER
// ==============================================
function switchMode(mode) {
  document.getElementById('tabAnalyze').classList.toggle('active', mode === 'analyze');
  document.getElementById('tabCompare').classList.toggle('active', mode === 'compare');
  document.getElementById('analyzeMode').classList.toggle('hidden', mode !== 'analyze');
  document.getElementById('compareMode').classList.toggle('hidden', mode !== 'compare');
}

// ==============================================
//  ANALYZE MODE
// ==============================================
const searchBtn     = document.getElementById('searchBtn');
const usernameInput = document.getElementById('usernameInput');
const errorMessage  = document.getElementById('errorMessage');
const loadingEl     = document.getElementById('loading');
const dashboard     = document.getElementById('dashboard');

searchBtn.addEventListener('click', handleSearch);
usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });

async function handleSearch() {
  const username = usernameInput.value.trim();
  if (!username) return;

  setUI('loading');
  try {
    const [profile, repos] = await Promise.all([
      fetchJSON(`${GITHUB_API}/users/${username}`),
      fetchJSON(`${GITHUB_API}/users/${username}/repos?per_page=100&sort=updated`)
    ]);

    if (profile.message === 'Not Found') throw new Error('User not found');

    const stats = analyzeRepos(repos);
    renderProfile(profile);
    renderStats(stats, profile);
    renderCharts(stats, repos);
    renderInsights(stats, profile);

    setUI('dashboard');
  } catch (err) {
    setUI('error', err.message);
  }
}

function setUI(state, msg = '') {
  errorMessage.classList.add('hidden');
  loadingEl.classList.add('hidden');
  dashboard.classList.add('hidden');

  if (state === 'loading')   loadingEl.classList.remove('hidden');
  if (state === 'dashboard') dashboard.classList.remove('hidden');
  if (state === 'error') {
    errorMessage.classList.remove('hidden');
    errorMessage.querySelector('span').textContent = msg || 'Error fetching data';
  }
}

function renderProfile(p) {
  document.getElementById('profileAvatar').src = p.avatar_url;
  document.getElementById('profileName').textContent = p.name || p.login;

  const link = document.getElementById('profileUsername');
  link.textContent = `@${p.login}`;
  link.href = p.html_url;

  document.getElementById('profileBio').textContent      = p.bio || 'No bio provided';
  document.getElementById('followers').textContent       = fmt(p.followers);
  document.getElementById('following').textContent       = fmt(p.following);
  document.getElementById('location').textContent        = p.location || 'Unknown';
  document.getElementById('publicRepos').textContent     = p.public_repos;
}

function renderStats(stats, profile) {
  document.getElementById('totalStars').textContent  = fmt(stats.totalStars);
  document.getElementById('totalForks').textContent  = fmt(stats.totalForks);
  document.getElementById('mainLanguage').textContent = stats.mainLanguage;

  const score = calcScore(profile, stats);
  const scoreEl = document.getElementById('devScore');
  scoreEl.textContent = score + '%';
}

function renderCharts(stats, repos) {
  // Language doughnut
  const langCtx = document.getElementById('languageChart').getContext('2d');
  const topLangs = Object.entries(stats.languages).sort((a,b) => b[1]-a[1]).slice(0,7);

  if (langChart) langChart.destroy();
  langChart = new Chart(langCtx, {
    type: 'doughnut',
    data: {
      labels: topLangs.map(x => x[0]),
      datasets: [{ data: topLangs.map(x => x[1]), backgroundColor: COLORS, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#8b949e', boxWidth: 12, padding: 10 } }
      }
    }
  });

  // Top-repo bar chart
  const actCtx = document.getElementById('activityChart').getContext('2d');
  const top5 = [...repos].sort((a,b) => b.stargazers_count - a.stargazers_count).slice(0,5);

  if (actChart) actChart.destroy();
  actChart = new Chart(actCtx, {
    type: 'bar',
    data: {
      labels: top5.map(r => r.name),
      datasets: [
        { label: 'Stars', data: top5.map(r => r.stargazers_count), backgroundColor: '#d29922' },
        { label: 'Forks', data: top5.map(r => r.forks_count),      backgroundColor: '#58a6ff' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { display: false } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }
      },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });
}

function renderInsights(stats, profile) {
  const pts  = calcScore(profile, stats);
  let grade  = 'D';
  if (pts >= 75) grade = 'A';
  else if (pts >= 55) grade = 'B';
  else if (pts >= 35) grade = 'C';

  const scoreEl = document.getElementById('consistencyScore');
  scoreEl.textContent = grade;
  scoreEl.style.color = grade === 'A' ? '#3fb950' : grade === 'B' ? '#58a6ff' : grade === 'C' ? '#d29922' : '#f85149';

  const list  = document.getElementById('suggestionsList');
  list.innerHTML = '';
  const tips  = buildTips(stats, profile);
  tips.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = `<i class="ph ph-lightbulb"></i><span>${t}</span>`;
    list.appendChild(li);
  });
}

function buildTips(stats, profile) {
  const tips = [];
  if (!profile.bio)             tips.push('Add a bio to make your profile more discoverable.');
  if (profile.public_repos < 5) tips.push('Publish more repositories to showcase your projects.');
  if (stats.totalStars < 5)     tips.push('Promote your repos on social media to earn stars.');
  if (!profile.location)        tips.push('Add your location to connect with local developers.');
  if (!profile.blog)            tips.push('Link a personal site or portfolio to your profile.');
  if (profile.followers < 10)   tips.push('Follow other developers and engage with the community.');
  if (tips.length === 0) tips.push('Excellent profile! Keep building and sharing open-source projects. 🚀');
  return tips;
}

// ==============================================
//  COMPARE MODE
// ==============================================
document.getElementById('cmpUser1').addEventListener('keypress', e => { if (e.key==='Enter') runComparison(); });
document.getElementById('cmpUser2').addEventListener('keypress', e => { if (e.key==='Enter') runComparison(); });

async function runComparison() {
  const u1 = document.getElementById('cmpUser1').value.trim();
  const u2 = document.getElementById('cmpUser2').value.trim();
  const errEl = document.getElementById('cmpError');
  const errTxt = document.getElementById('cmpErrorText');

  errEl.classList.add('hidden');
  document.getElementById('compareResults').classList.add('hidden');

  if (!u1 || !u2) {
    errTxt.textContent = 'Please enter both usernames.';
    errEl.classList.remove('hidden');
    return;
  }

  document.getElementById('cmpLoading').classList.remove('hidden');

  try {
    const [p1, p2, r1, r2] = await Promise.all([
      fetchJSON(`${GITHUB_API}/users/${u1}`),
      fetchJSON(`${GITHUB_API}/users/${u2}`),
      fetchJSON(`${GITHUB_API}/users/${u1}/repos?per_page=100`),
      fetchJSON(`${GITHUB_API}/users/${u2}/repos?per_page=100`)
    ]);

    if (p1.message === 'Not Found') throw new Error(`"${u1}" not found`);
    if (p2.message === 'Not Found') throw new Error(`"${u2}" not found`);

    const s1 = analyzeRepos(r1);
    const s2 = analyzeRepos(r2);

    renderCompare(p1, s1, p2, s2);

    document.getElementById('cmpLoading').classList.add('hidden');
    document.getElementById('compareResults').classList.remove('hidden');

  } catch (err) {
    document.getElementById('cmpLoading').classList.add('hidden');
    errTxt.textContent = err.message || 'Error fetching data';
    errEl.classList.remove('hidden');
  }
}

function renderCompare(p1, s1, p2, s2) {
  const score1 = calcScore(p1, s1);
  const score2 = calcScore(p2, s2);

  // Profile cards
  document.getElementById('cmpCard1').innerHTML = buildCmpCard(p1, s1, score1);
  document.getElementById('cmpCard2').innerHTML = buildCmpCard(p2, s2, score2);

  // Winner highlight
  const card1 = document.getElementById('cmpCard1');
  const card2 = document.getElementById('cmpCard2');
  card1.classList.remove('winner-card');
  card2.classList.remove('winner-card');

  const banner = document.getElementById('winnerBanner');
  if (score1 > score2) {
    card1.classList.add('winner-card');
    banner.innerHTML = `🏆 <strong>${p1.name || p1.login}</strong> has the stronger profile! (${score1}% vs ${score2}%)`;
  } else if (score2 > score1) {
    card2.classList.add('winner-card');
    banner.innerHTML = `🏆 <strong>${p2.name || p2.login}</strong> has the stronger profile! (${score2}% vs ${score1}%)`;
  } else {
    banner.innerHTML = `🤝 Both profiles are equally strong! (${score1}%)`;
  }

  // Stat table
  renderStatTable(p1, s1, p2, s2);

  // Bar chart
  renderCmpBarChart(p1, s1, p2, s2);

  // Language chart
  renderCmpLangChart(p1, s1, p2, s2);

  // Radar chart
  renderCmpRadar(p1, s1, score1, p2, s2, score2);
}

function buildCmpCard(p, s, score) {
  return `
    <img class="avatar" src="${p.avatar_url}" alt="${p.login}" />
    <h3>${p.name || p.login}</h3>
    <a class="username-link" href="${p.html_url}" target="_blank">@${p.login}</a>
    <p style="font-size:.85rem;color:var(--muted);max-width:220px;">${p.bio || 'No bio'}</p>
    <div class="cmp-mini-stats">
      <div class="cmp-mini-stat"><i class="ph ph-book-bookmark"></i>${fmt(p.public_repos)} repos</div>
      <div class="cmp-mini-stat"><i class="ph ph-users"></i>${fmt(p.followers)} followers</div>
      <div class="cmp-mini-stat"><i class="ph ph-star"></i>${fmt(s.totalStars)} stars</div>
      <div class="cmp-mini-stat"><i class="ph ph-git-fork"></i>${fmt(s.totalForks)} forks</div>
      <div class="cmp-mini-stat"><i class="ph ph-code"></i>${s.mainLanguage}</div>
    </div>
    <div class="cmp-score-badge"><i class="ph ph-medal"></i> Dev Score: ${score}%</div>
  `;
}

function renderStatTable(p1, s1, p2, s2) {
  const rows = [
    { label: 'Repositories', v1: p1.public_repos, v2: p2.public_repos },
    { label: 'Followers',    v1: p1.followers,    v2: p2.followers    },
    { label: 'Following',    v1: p1.following,    v2: p2.following    },
    { label: 'Total Stars',  v1: s1.totalStars,   v2: s2.totalStars   },
    { label: 'Total Forks',  v1: s1.totalForks,   v2: s2.totalForks   },
  ];

  const container = document.getElementById('statTable');
  container.innerHTML = '';

  const headerRow = document.createElement('div');
  headerRow.className = 'stat-row';
  headerRow.innerHTML = `
    <div class="stat-val left" style="color:var(--accent);font-size:.9rem">${p1.name || p1.login}</div>
    <div class="stat-row-label">Metric</div>
    <div class="stat-val right" style="color:#3fb950;font-size:.9rem">${p2.name || p2.login}</div>
  `;
  container.appendChild(headerRow);

  rows.forEach(row => {
    const max = Math.max(row.v1, row.v2, 1);
    const pct1 = Math.round((row.v1 / max) * 100);
    const pct2 = Math.round((row.v2 / max) * 100);
    const w1 = row.v1 >= row.v2 ? 'winner-val' : 'loser-val';
    const w2 = row.v2 >= row.v1 ? 'winner-val' : 'loser-val';

    const el = document.createElement('div');
    el.className = 'stat-row';
    el.style.flexDirection = 'column';
    el.style.display = 'grid';
    el.innerHTML = `
      <div class="stat-val left ${w1}">${fmt(row.v1)}</div>
      <div class="stat-row-label">${row.label}</div>
      <div class="stat-val right ${w2}">${fmt(row.v2)}</div>
    `;
    container.appendChild(el);

    // Progress bars
    const barEl = document.createElement('div');
    barEl.className = 'bar-row';
    barEl.innerHTML = `
      <div class="bar-track" style="direction:rtl">
        <div class="bar-fill left" style="width:${pct1}%"></div>
      </div>
      <div style="width:2px"></div>
      <div class="bar-track">
        <div class="bar-fill right" style="width:${pct2}%"></div>
      </div>
    `;
    container.appendChild(barEl);
  });
}

function renderCmpBarChart(p1, s1, p2, s2) {
  if (cmpBarChart) cmpBarChart.destroy();
  const ctx = document.getElementById('cmpBarChart').getContext('2d');
  cmpBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Repos', 'Followers', 'Stars', 'Forks'],
      datasets: [
        {
          label: p1.name || p1.login,
          data: [p1.public_repos, p1.followers, s1.totalStars, s1.totalForks],
          backgroundColor: '#58a6ff',
          borderRadius: 6
        },
        {
          label: p2.name || p2.login,
          data: [p2.public_repos, p2.followers, s2.totalStars, s2.totalForks],
          backgroundColor: '#3fb950',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { display: false } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }
      },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });
}

function renderCmpLangChart(p1, s1, p2, s2) {
  if (cmpLangChart) cmpLangChart.destroy();
  const ctx = document.getElementById('cmpLangChart').getContext('2d');

  // Build merged language labels
  const allLangs = [...new Set([...Object.keys(s1.languages), ...Object.keys(s2.languages)])];
  const top8 = allLangs
    .map(l => ({ lang: l, total: (s1.languages[l] || 0) + (s2.languages[l] || 0) }))
    .sort((a,b) => b.total - a.total)
    .slice(0,8)
    .map(x => x.lang);

  cmpLangChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: top8,
      datasets: [
        {
          label: p1.name || p1.login,
          data: top8.map(l => s1.languages[l] || 0),
          backgroundColor: '#58a6ff',
          borderRadius: 4
        },
        {
          label: p2.name || p2.login,
          data: top8.map(l => s2.languages[l] || 0),
          backgroundColor: '#3fb950',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { display: false } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }
      },
      plugins: { legend: { labels: { color: '#e6edf3' } } }
    }
  });
}

function renderCmpRadar(p1, s1, score1, p2, s2, score2) {
  if (cmpRadar) cmpRadar.destroy();
  const ctx = document.getElementById('cmpRadarChart').getContext('2d');

  // Normalise each metric to 0–100
  const maxRepos     = Math.max(p1.public_repos,  p2.public_repos,  1);
  const maxFollowers = Math.max(p1.followers,      p2.followers,     1);
  const maxStars     = Math.max(s1.totalStars,     s2.totalStars,    1);
  const maxForks     = Math.max(s1.totalForks,     s2.totalForks,    1);
  const maxLangs     = Math.max(Object.keys(s1.languages).length, Object.keys(s2.languages).length, 1);

  const norm = (v, max) => Math.round((v / max) * 100);

  cmpRadar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Repositories', 'Followers', 'Stars', 'Forks', 'Languages', 'Dev Score'],
      datasets: [
        {
          label: p1.name || p1.login,
          data: [
            norm(p1.public_repos,                      maxRepos),
            norm(p1.followers,                         maxFollowers),
            norm(s1.totalStars,                        maxStars),
            norm(s1.totalForks,                        maxForks),
            norm(Object.keys(s1.languages).length,     maxLangs),
            score1
          ],
          backgroundColor: 'rgba(88,166,255,.2)',
          borderColor: '#58a6ff',
          pointBackgroundColor: '#58a6ff',
          borderWidth: 2
        },
        {
          label: p2.name || p2.login,
          data: [
            norm(p2.public_repos,                      maxRepos),
            norm(p2.followers,                         maxFollowers),
            norm(s2.totalStars,                        maxStars),
            norm(s2.totalForks,                        maxForks),
            norm(Object.keys(s2.languages).length,     maxLangs),
            score2
          ],
          backgroundColor: 'rgba(63,185,80,.2)',
          borderColor: '#3fb950',
          pointBackgroundColor: '#3fb950',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#8b949e', backdropColor: 'transparent', stepSize: 25 },
          grid:        { color: '#30363d' },
          angleLines:  { color: '#30363d' },
          pointLabels: { color: '#e6edf3', font: { size: 13 } }
        }
      },
      plugins: { legend: { labels: { color: '#e6edf3', boxWidth: 14 } } }
    }
  });
}

// ==============================================
//  HELPERS
// ==============================================
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok && res.status !== 404) throw new Error(`GitHub API error (${res.status})`);
  return res.json();
}

function analyzeRepos(repos) {
  const stats = { totalStars: 0, totalForks: 0, languages: {}, mainLanguage: 'None' };
  if (!repos || !Array.isArray(repos) || repos.length === 0) return stats;

  repos.forEach(r => {
    stats.totalStars += r.stargazers_count || 0;
    stats.totalForks += r.forks_count     || 0;
    if (r.language) stats.languages[r.language] = (stats.languages[r.language] || 0) + 1;
  });

  let max = 0;
  for (const [l, c] of Object.entries(stats.languages)) {
    if (c > max) { max = c; stats.mainLanguage = l; }
  }
  return stats;
}

function calcScore(profile, stats) {
  let pts = 0;
  pts += Math.min((profile.followers       / 200)  * 25, 25);
  pts += Math.min((profile.public_repos    / 50)   * 20, 20);
  pts += Math.min((stats.totalStars        / 100)  * 25, 25);
  pts += Math.min((stats.totalForks        / 50)   * 15, 15);
  if (profile.bio)      pts += 5;
  if (profile.location) pts += 5;
  if (profile.blog)     pts += 5;
  return Math.min(Math.round(pts), 100);
}

function fmt(num) {
  if (num === null || num === undefined) return '0';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1)     + 'k';
  return String(num);
}
