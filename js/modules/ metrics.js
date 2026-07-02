/* ============================================================
   Metrics — Weekly DA Performance view
   ============================================================ */

let metricsState = {
  data:       null,
  filtered:   [],
  sortKey:    'score',
  sortDir:    -1,
  search:     '',
  tab:        'all'
};

async function renderMetrics() {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="view active" id="view-metrics">
    <div class="flex items-center justify-between">
      <div>
        <div class="view-title">Metrics</div>
        <div class="view-subtitle" id="metrics-week">No data imported</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openImportModal('metrics')">+ Import</button>
    </div>

    <!-- Summary cards -->
    <div class="stat-grid mb-md" id="metrics-summary">
      <div class="stat-block">
        <div class="stat-value accent" id="ms-total">—</div>
        <div class="stat-label">Total Drivers</div>
      </div>
      <div class="stat-block">
        <div class="stat-value" id="ms-avg-score">—</div>
        <div class="stat-label">Avg Score</div>
      </div>
    </div>
    <div class="stat-grid mb-md">
      <div class="stat-block">
        <div class="stat-value success" id="ms-fp">—</div>
        <div class="stat-label">Fantastic+</div>
      </div>
      <div class="stat-block">
        <div class="stat-value" id="ms-f">—</div>
        <div class="stat-label">Fantastic</div>
      </div>
      <div class="stat-block">
        <div class="stat-value" id="ms-g">—</div>
        <div class="stat-label">Great</div>
      </div>
      <div class="stat-block">
        <div class="stat-value danger" id="ms-poor">—</div>
        <div class="stat-label">Poor</div>
      </div>
    </div>

    <!-- Charts row -->
    <div id="metrics-charts" class="hidden">
      <div class="card mb-sm">
        <div class="card-header">
          <span class="card-title">DCR Distribution</span>
        </div>
        <div class="chart-wrapper" style="height:140px">
          <canvas id="dcr-chart"></canvas>
        </div>
      </div>
      <div class="card mb-sm">
        <div class="card-header">
          <span class="card-title">Parcels Delivered</span>
        </div>
        <div class="chart-wrapper" style="height:140px">
          <canvas id="parcels-chart"></canvas>
        </div>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button class="tab-btn active" data-metrics-tab="all" onclick="metricsSetTab('all',this)">All</button>
      <button class="tab-btn" data-metrics-tab="fp" onclick="metricsSetTab('fp',this)">FP</button>
      <button class="tab-btn" data-metrics-tab="poor" onclick="metricsSetTab('poor',this)">Poor</button>
      <button class="tab-btn" data-metrics-tab="penalties" onclick="metricsSetTab('penalties',this)">Penalties</button>
      <button class="tab-btn" data-metrics-tab="concessions" onclick="metricsSetTab('concessions',this)">Concessions</button>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" id="metrics-search" placeholder="Search driver name or ID…" oninput="metricsSearch(this.value)">
    </div>

    <!-- Sort controls -->
    <div class="flex gap-sm mb-md" style="flex-wrap:wrap">
      ${['score','parcels','dcr','concessions','name'].map(k => `
        <button class="tag-chip" onclick="metricsSort('${k}')" id="ms-sort-${k}"
          style="${k === 'score' ? 'color:var(--accent);border-color:var(--accent)' : ''}">
          ${k === 'dcr' ? 'DCR' : k.charAt(0).toUpperCase() + k.slice(1)}
        </button>
      `).join('')}
    </div>

    <!-- Driver list -->
    <div id="metrics-driver-list">
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-title">No metrics loaded</div>
        <div class="empty-state-sub">Import a DA Stats XLSX file to see driver performance data</div>
      </div>
    </div>

    <div style="height: var(--space-xl)"></div>
  </div>`;

  await loadMetricsData();
}

async function loadMetricsData() {
  const allMetrics = await storage.getMetrics({ limit: 1 });
  if (!allMetrics.length) return;

  const data = allMetrics[0];
  metricsState.data     = data;
  metricsState.filtered = data.drivers || [];

  // Week label
  document.getElementById('metrics-week').textContent = getWeekLabel(data.week);

  // Counts by tier
  const drivers = data.drivers || [];
  const countTier = (t) => drivers.filter(d => (d.status || '').toLowerCase().includes(t)).length;
  const fpCount   = countTier('fantastic_plus') + drivers.filter(d => {
    const s = (d.status||'').toLowerCase();
    return s.includes('fantastic plus');
  }).length;
  const fCount  = drivers.filter(d => {
    const s = (d.status||'').toLowerCase();
    return s.includes('fantastic') && !s.includes('fantastic_plus') && !s.includes('fantastic plus');
  }).length;
  const gCount  = countTier('great');
  const pCount  = countTier('poor');

  document.getElementById('ms-total').textContent     = drivers.length;
  document.getElementById('ms-fp').textContent        = fpCount;
  document.getElementById('ms-f').textContent         = fCount;
  document.getElementById('ms-g').textContent         = gCount;
  document.getElementById('ms-poor').textContent      = pCount;

  const avgScore = drivers.length ? (drivers.reduce((s, d) => s + (d.score || 0), 0) / drivers.length) : 0;
  document.getElementById('ms-avg-score').textContent = avgScore.toFixed(0);

  // Charts
  document.getElementById('metrics-charts').classList.remove('hidden');
  setTimeout(() => renderMetricsCharts(drivers), 50);

  // Driver list
  metricsRenderList();
}

function renderMetricsCharts(drivers) {
  // DCR chart — bucket by DCR score
  const dcrBuckets = [0,0,0,0,0]; // <0.95, 0.95-0.97, 0.97-0.99, 0.99-0.999, 1.0
  drivers.forEach(d => {
    const v = d.dcr;
    if (!v || v === 0)  return;
    if (v < 0.95)       dcrBuckets[0]++;
    else if (v < 0.97)  dcrBuckets[1]++;
    else if (v < 0.99)  dcrBuckets[2]++;
    else if (v < 1.0)   dcrBuckets[3]++;
    else                dcrBuckets[4]++;
  });

  const dcrCanvas = document.getElementById('dcr-chart');
  if (dcrCanvas) {
    drawBarChart(dcrCanvas, dcrBuckets,
      ['<95%','95-97','97-99','99-100','100%'],
      { colors: ['#f87171','#fbbf24','#60a5fa','#34d399','#a78bfa'] }
    );
  }

  // Parcels chart — top 8 by parcel count
  const top8 = [...drivers].filter(d => d.parcels > 0).sort((a,b) => b.parcels - a.parcels).slice(0,8);
  const parcelsCanvas = document.getElementById('parcels-chart');
  if (parcelsCanvas && top8.length) {
    drawBarChart(parcelsCanvas,
      top8.map(d => d.parcels),
      top8.map(d => d.name.split(' ')[0]),
      { colors: top8.map(() => '#ff9900') }
    );
  }
}

function metricsRenderList() {
  const { data, filtered, tab } = metricsState;
  if (!data) return;

  const listEl = document.getElementById('metrics-driver-list');

  if (tab === 'concessions') {
    const concessions = data.concessions || [];
    if (!concessions.length) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">No concessions this week</div></div>';
      return;
    }
    // Group by driver
    const byDriver = {};
    concessions.forEach(c => {
      const k = c.daName || 'Unknown';
      byDriver[k] = (byDriver[k] || 0) + 1;
    });
    const sorted = Object.entries(byDriver).sort((a,b) => b[1]-a[1]);
    listEl.innerHTML = `
      <div class="card mb-sm">
        <div class="card-header">
          <span class="card-title">Total Concessions</span>
          <span class="stat-value danger" style="font-size:20px">${concessions.length}</span>
        </div>
        ${sorted.map(([name, count]) => `
          <div class="data-row">
            <span class="data-row-label">${name.split(' ').slice(0,2).join(' ')}</span>
            <span class="data-row-value" style="color:${count >= 5 ? 'var(--danger)' : count >= 3 ? 'var(--warning)' : 'var(--text-primary)'}">${count}</span>
          </div>
        `).join('')}
      </div>
    `;
    return;
  }

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-title">No drivers found</div></div>';
    return;
  }

  // Get concession counts per driver
  const concMap = {};
  (data.concessions || []).forEach(c => {
    const k = c.daName || '';
    concMap[k] = (concMap[k] || 0) + 1;
  });

  listEl.innerHTML = filtered.map(d => {
    const tc   = tierClass(d.status);
    const tl   = tierLabel(d.status);
    const conc = concMap[d.name] || 0;
    const dcrClass = d.dcr >= 0.99 ? 'success' : d.dcr >= 0.97 ? '' : 'danger';

    return `
    <div class="card mb-sm" onclick="metricsShowDriver(${JSON.stringify(d).replace(/"/g,"'")})" style="cursor:pointer">
      <div class="flex items-center gap-md">
        <div class="driver-avatar">${initials(d.name)}</div>
        <div style="flex:1;min-width:0">
          <div class="flex items-center justify-between">
            <div class="driver-name">${d.name}</div>
            <span class="tier-badge ${tc}">${tl}</span>
          </div>
          <div class="stat-grid stat-grid-3 mt-sm" style="gap:4px">
            <div style="text-align:center">
              <div style="font-size:15px;font-weight:700;font-family:var(--font-mono);color:${scoreColor(d.score)}">${d.score}</div>
              <div class="stat-label">Score</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:13px;font-weight:600;font-family:var(--font-mono)">${formatNum(d.parcels)}</div>
              <div class="stat-label">Parcels</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:13px;font-weight:600;font-family:var(--font-mono)" class="${dcrClass}">${formatPct(d.dcr)}</div>
              <div class="stat-label">DCR</div>
            </div>
          </div>
          ${d.penalty || conc ? `
          <div class="flex gap-sm mt-sm" style="flex-wrap:wrap">
            ${d.penalty ? `<span class="tag-chip" style="color:var(--danger);border-color:rgba(248,113,113,0.3)">⚠ ${d.penalty}</span>` : ''}
            ${conc ? `<span class="tag-chip" style="color:var(--warning);border-color:rgba(251,191,36,0.3)">${conc} concession${conc>1?'s':''}</span>` : ''}
            ${d.deduction ? `<span class="tag-chip" style="color:var(--danger)">-${d.deduction}pts</span>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');
}

function metricsSearch(val) {
  metricsState.search = val.toLowerCase();
  applyMetricsFilters();
}

function metricsSetTab(tab, btn) {
  metricsState.tab = tab;
  document.querySelectorAll('[data-metrics-tab]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyMetricsFilters();
}

function metricsSort(key) {
  if (metricsState.sortKey === key) metricsState.sortDir *= -1;
  else { metricsState.sortKey = key; metricsState.sortDir = -1; }

  document.querySelectorAll('[id^="ms-sort-"]').forEach(b => {
    b.style.color = '';
    b.style.borderColor = '';
  });
  const activeBtn = document.getElementById(`ms-sort-${key}`);
  if (activeBtn) { activeBtn.style.color = 'var(--accent)'; activeBtn.style.borderColor = 'var(--accent)'; }

  applyMetricsFilters();
}

function applyMetricsFilters() {
  const { data, search, tab, sortKey, sortDir } = metricsState;
  if (!data) return;

  let drivers = [...(data.drivers || [])];

  // Tab filter
  if (tab === 'fp')        drivers = drivers.filter(d => (d.status||'').toLowerCase().includes('fantastic'));
  if (tab === 'poor')      drivers = drivers.filter(d => (d.status||'').toLowerCase().includes('poor'));
  if (tab === 'penalties') drivers = drivers.filter(d => d.penalty && d.penalty.trim());

  // Search
  if (search) {
    drivers = drivers.filter(d =>
      d.name.toLowerCase().includes(search) ||
      d.tid.toLowerCase().includes(search)
    );
  }

  // Sort
  const concMap = {};
  (data.concessions || []).forEach(c => { concMap[c.daName || ''] = (concMap[c.daName||'']||0)+1; });

  drivers.sort((a,b) => {
    let va, vb;
    if (sortKey === 'concessions') { va = concMap[a.name]||0; vb = concMap[b.name]||0; }
    else if (sortKey === 'name')   { return sortDir * a.name.localeCompare(b.name); }
    else { va = a[sortKey]||0; vb = b[sortKey]||0; }
    return sortDir * (va - vb);
  });

  metricsState.filtered = drivers;
  metricsRenderList();
}

function metricsShowDriver(driver) {
  // Show driver detail modal
  const modal = document.getElementById('import-modal');
  document.getElementById('import-modal-title').textContent = driver.name.split(' ').slice(0,2).join(' ');

  const dnrData = metricsState.data?.dnr?.filter(d => d.daId === driver.tid) || [];
  const totalDNR = dnrData.reduce((s,d) => s + (d.dnrCount||0), 0);
  const totalDelivered = dnrData.reduce((s,d) => s + (d.delivered||0), 0);

  document.getElementById('import-modal-body').innerHTML = `
    <div class="flex items-center gap-md mb-md">
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
      <div>
        <span class="tier-badge ${tierClass(driver.status)}">${tierLabel(driver.status)}</span>
        <div class="text-sm text-muted mt-sm font-mono">${driver.tid}</div>
        ${driver.penalty ? `<div class="alert-item warning mt-sm" style="padding:4px 8px;font-size:12px">⚠ ${driver.penalty}</div>` : ''}
      </div>
    </div>

    <div class="card mb-sm">
      <div class="card-title mb-md">Performance Scores</div>
      ${[
        ['Total Score', driver.score, 100],
        ['Delivered Parcels', driver.parcels, null],
        ['DCR', formatPct(driver.dcr), null],
        ['Photo on Delivery', formatPct(driver.pod), null],
        ['Contact Compliance', formatPct(driver.cc), null],
        ['IADC', formatPct(driver.iadc), null],
        ['Pickup', driver.pickup || '—', null],
      ].map(([label, val, max]) => `
        <div class="data-row">
          <span class="data-row-label">${label}</span>
          <span class="data-row-value">${val}</span>
        </div>
        ${max ? `<div class="progress-bar"><div class="progress-fill ${val >= 80 ? 'success' : val >= 50 ? '' : 'danger'}" style="width:${Math.min(100,val)}%"></div></div>` : ''}
      `).join('')}
    </div>

    <div class="card mb-sm">
      <div class="card-title mb-md">Safety</div>
      ${[
        ['Speed Violations', driver.speed],
        ['Signal Violations', driver.signal],
        ['Distractions', driver.distraction],
        ['Following Distance', driver.following],
        ['CDF (DPMO)', formatNum(driver.cdf)],
      ].map(([label, val]) => `
        <div class="data-row">
          <span class="data-row-label">${label}</span>
          <span class="data-row-value" style="color:${val > 0 ? 'var(--danger)' : 'var(--success)'}">${val}</span>
        </div>
      `).join('')}
    </div>

    ${totalDelivered ? `
    <div class="card mb-sm">
      <div class="card-title mb-md">DNR Summary</div>
      <div class="data-row"><span class="data-row-label">Delivered</span><span class="data-row-value">${formatNum(totalDelivered)}</span></div>
      <div class="data-row"><span class="data-row-label">DNR Count</span><span class="data-row-value" style="color:${totalDNR > 3 ? 'var(--danger)' : 'var(--text-primary)'}">${totalDNR}</span></div>
    </div>` : ''}

    <div style="height:40px"></div>
  `;

  modal.hidden = false;
  setTimeout(() => {
    const ring = modal.querySelector('.score-ring');
    if (ring) updateScoreRing(ring, driver.score, 100);
  }, 50);
}

function scoreColor(s) {
  if (s >= 95) return '#a78bfa';
  if (s >= 80) return '#34d399';
  if (s >= 60) return '#60a5fa';
  if (s >= 40) return '#fbbf24';
  return '#f87171';
}

function initials(name) {
  return (name||'').split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
}

window.renderMetrics     = renderMetrics;
window.metricsSearch     = metricsSearch;
window.metricsSetTab     = metricsSetTab;
window.metricsSort       = metricsSort;
window.metricsShowDriver = metricsShowDriver;
