/* ============================================================
   Home — Dashboard view
   ============================================================ */

async function renderHome() {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="view active" id="view-home">
    <div class="view-title">Dashboard</div>
    <div class="view-subtitle" id="home-date">Loading…</div>

    <!-- Quick Stats Row -->
    <div class="stat-grid stat-grid-3" id="home-quick-stats">
      <div class="stat-block">
        <div class="stat-value accent" id="hs-total-drivers">—</div>
        <div class="stat-label">Drivers W26</div>
      </div>
      <div class="stat-block">
        <div class="stat-value success" id="hs-fp-count">—</div>
        <div class="stat-label">Fantastic+</div>
      </div>
      <div class="stat-block">
        <div class="stat-value danger" id="hs-poor-count">—</div>
        <div class="stat-label">At Risk</div>
      </div>
    </div>

    <!-- Latest Metrics Card -->
    <div class="section-header">
      <span class="section-title">Latest Metrics</span>
      <button class="section-link" onclick="app.navigate('metrics')">View All</button>
    </div>
    <div class="card" id="home-metrics-card">
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">No metrics imported</div>
        <div class="empty-state-sub">Import your weekly DA Stats file to see performance data</div>
      </div>
      <button class="btn btn-primary btn-full mt-md" onclick="openImportModal('metrics')">
        Import Metrics File
      </button>
    </div>

    <!-- Wave Plan Card -->
    <div class="section-header">
      <span class="section-title">Wave Plan</span>
      <button class="section-link" onclick="app.navigate('waveplan')">View All</button>
    </div>
    <div class="card" id="home-wave-card">
      <div class="empty-state">
        <div class="empty-state-icon">🌊</div>
        <div class="empty-state-title">No wave plan</div>
        <div class="empty-state-sub">Import a wave plan screenshot to see today's routes</div>
      </div>
      <button class="btn btn-ghost btn-full mt-md" onclick="openImportModal('waveplan')">
        Import Wave Plan
      </button>
    </div>

    <!-- Alerts -->
    <div id="home-alerts"></div>

    <!-- Score Distribution Chart -->
    <div class="section-header mt-lg">
      <span class="section-title">Score Distribution</span>
    </div>
    <div class="card" id="home-chart-card">
      <div class="card-header">
        <span class="card-title">Total Score — W26</span>
      </div>
      <div class="chart-wrapper">
        <canvas id="score-dist-chart"></canvas>
      </div>
    </div>

    <!-- Top Drivers Card -->
    <div class="section-header mt-lg">
      <span class="section-title">Top Drivers</span>
    </div>
    <div class="card" id="home-top-drivers">
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-title">Import metrics to see rankings</div>
      </div>
    </div>

    <!-- My Performance (if driver set) -->
    <div id="home-my-performance"></div>

    <div style="height: var(--space-xl)"></div>
  </div>`;

  // Set date
  const d = new Date();
  document.getElementById('home-date').textContent =
    d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Load data
  await refreshHomeData();
}

async function refreshHomeData() {
  const allMetrics = await storage.getMetrics({ limit: 1 });
  if (!allMetrics.length) return;

  const latest = allMetrics[0];
  const drivers = latest.drivers || [];

  // Quick stats
  const fpCount   = drivers.filter(d => d.status?.toLowerCase().includes('fantastic_plus') || d.status?.toLowerCase().includes('fantastic plus')).length;
  const poorCount = drivers.filter(d => d.status?.toLowerCase().includes('poor')).length;

  document.getElementById('hs-total-drivers').textContent = formatNum(drivers.length);
  document.getElementById('hs-fp-count').textContent      = formatNum(fpCount);
  document.getElementById('hs-poor-count').textContent    = formatNum(poorCount);

  // Metrics card
  const weekLabel = getWeekLabel(latest.week);
  document.getElementById('home-metrics-card').innerHTML = `
    <div class="card-header">
      <span class="card-title">${weekLabel}</span>
      <span class="tier-badge fp">Loaded</span>
    </div>
    <div class="stat-grid">
      <div class="stat-block">
        <div class="stat-value accent">${drivers.length}</div>
        <div class="stat-label">Drivers</div>
      </div>
      <div class="stat-block">
        <div class="stat-value">${latest.concessions?.length || 0}</div>
        <div class="stat-label">Concessions</div>
      </div>
    </div>
    <div class="stat-grid mt-sm">
      <div class="stat-block">
        <div class="stat-value success">${fpCount}</div>
        <div class="stat-label">Fantastic+</div>
      </div>
      <div class="stat-block">
        <div class="stat-value danger">${poorCount}</div>
        <div class="stat-label">Poor</div>
      </div>
    </div>
    <button class="btn btn-ghost btn-full btn-sm mt-md" onclick="app.navigate('metrics')">Full Report →</button>
  `;

  // Score distribution chart
  const scoreBuckets = [0,0,0,0,0,0]; // <0, 0-19, 20-49, 50-79, 80-99, 100
  drivers.forEach(d => {
    const s = d.score;
    if (s < 0)       scoreBuckets[0]++;
    else if (s < 20) scoreBuckets[1]++;
    else if (s < 50) scoreBuckets[2]++;
    else if (s < 80) scoreBuckets[3]++;
    else if (s < 100)scoreBuckets[4]++;
    else             scoreBuckets[5]++;
  });

  const scoreCanvas = document.getElementById('score-dist-chart');
  if (scoreCanvas && drivers.length) {
    setTimeout(() => {
      drawBarChart(scoreCanvas, scoreBuckets,
        ['<0','0-19','20-49','50-79','80-99','100'],
        { colors: ['danger','warning','warning','info','success','purple'].map(c => {
          const m = { danger:'#f87171', warning:'#fbbf24', info:'#60a5fa', success:'#34d399', purple:'#a78bfa' };
          return m[c];
        }) }
      );
    }, 50);
  }

  // Top 5 drivers by score
  const top5 = [...drivers].sort((a,b) => b.score - a.score).slice(0,5);
  document.getElementById('home-top-drivers').innerHTML = top5.map((d, i) => `
    <div class="driver-row">
      <span class="driver-rank">${i+1}</span>
      <div class="driver-avatar">${initials(d.name)}</div>
      <div class="driver-info">
        <div class="driver-name">${d.name}</div>
        <div class="driver-meta">${tierLabel(d.status)} · ${formatNum(d.parcels)} parcels</div>
      </div>
      <div class="driver-score" style="color:${scoreColor(d.score)}">${d.score}</div>
    </div>
  `).join('');

  // Alerts
  const alerts = buildAlerts(latest);
  const alertsEl = document.getElementById('home-alerts');
  if (alerts.length) {
    alertsEl.innerHTML = `
      <div class="section-header mt-lg">
        <span class="section-title">Alerts</span>
        <span class="tag-chip">${alerts.length}</span>
      </div>
      ${alerts.map(a => `
        <div class="alert-item ${a.type}">
          <span class="alert-icon">${a.icon}</span>
          <span class="alert-text">${a.text}</span>
        </div>
      `).join('')}
    `;
  }

  // My performance
  const settings = await getSettings();
  if (settings.driverId) {
    const myDriver = drivers.find(d => d.tid === settings.driverId || d.name.toLowerCase().includes(settings.driverName?.toLowerCase()));
    if (myDriver) renderMyPerformance(myDriver);
  }
}

function buildAlerts(data) {
  const alerts = [];
  const drivers = data.drivers || [];
  const poor    = drivers.filter(d => d.status?.toLowerCase().includes('poor'));
  const penalties = drivers.filter(d => d.penalty && d.penalty.trim());

  if (poor.length > 10) {
    alerts.push({ type: 'danger', icon: '🚨', text: `${poor.length} drivers currently in Poor standing — action required` });
  }
  if (data.concessions?.length > 50) {
    alerts.push({ type: 'warning', icon: '⚠️', text: `${data.concessions.length} concessions this week — review delivery performance` });
  }
  if (penalties.length > 5) {
    alerts.push({ type: 'warning', icon: '📋', text: `${penalties.length} drivers with penalties on record` });
  }
  return alerts;
}

function renderMyPerformance(driver) {
  const el = document.getElementById('home-my-performance');
  el.innerHTML = `
    <div class="section-header mt-lg">
      <span class="section-title">My Performance</span>
      <span class="tier-badge ${tierClass(driver.status)}">${tierLabel(driver.status)}</span>
    </div>
    <div class="card card-accent">
      <div class="flex items-center gap-md">
        <div class="score-ring">
          <svg viewBox="0 0 80 80">
            <circle class="score-ring-bg" cx="40" cy="40" r="35"/>
            <circle class="score-ring-fill" cx="40" cy="40" r="35"/>
          </svg>
          <div class="score-ring-value">
            <span class="score-ring-number">${driver.score}</span>
            <span class="score-ring-label">Score</span>
          </div>
        </div>
        <div style="flex:1">
          <div class="driver-name" style="font-size:16px;font-weight:700">${driver.name}</div>
          <div class="data-row">
            <span class="data-row-label">Parcels</span>
            <span class="data-row-value">${formatNum(driver.parcels)}</span>
          </div>
          <div class="data-row">
            <span class="data-row-label">DCR</span>
            <span class="data-row-value">${formatPct(driver.dcr)}</span>
          </div>
          <div class="data-row">
            <span class="data-row-label">POD</span>
            <span class="data-row-value">${formatPct(driver.pod)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  // Animate ring after render
  setTimeout(() => {
    const ring = el.querySelector('.score-ring');
    if (ring) updateScoreRing(ring, driver.score, 100);
  }, 100);
}

function initials(name) {
  return name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
}

function scoreColor(s) {
  if (s >= 95)  return '#a78bfa';
  if (s >= 80)  return '#34d399';
  if (s >= 60)  return '#60a5fa';
  if (s >= 40)  return '#fbbf24';
  if (s >= 0)   return '#f87171';
  return '#f87171';
}

window.renderHome = renderHome;
window.refreshHomeData = refreshHomeData;
