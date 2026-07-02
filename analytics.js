/* ============================================================
   Analytics — Performance trends over time
   ============================================================ */

async function renderAnalytics() {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="view active" id="view-analytics">
    <div class="view-title">Analytics</div>
    <div class="view-subtitle">Performance trends over time</div>

    <div id="analytics-content">
      <div class="loading-spinner"></div>
    </div>

    <div style="height: var(--space-xl)"></div>
  </div>`;

  await loadAnalyticsData();
}

async function loadAnalyticsData() {
  const allMetrics = await storage.getMetrics({ limit: 20 });
  const contentEl  = document.getElementById('analytics-content');

  if (allMetrics.length < 1) {
    contentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📈</div>
        <div class="empty-state-title">No data for analytics</div>
        <div class="empty-state-sub">Import multiple weeks of metrics to see performance trends and comparisons</div>
      </div>
      <button class="btn btn-primary btn-full mt-md" onclick="openImportModal('metrics')">Import Metrics</button>
    `;
    return;
  }

  // Sort by week (oldest first for charts)
  const sorted = [...allMetrics].sort((a,b) => String(a.week).localeCompare(String(b.week)));

  // Build per-week aggregates
  const weekData = sorted.map(w => {
    const drivers = w.drivers || [];
    const validDrivers = drivers.filter(d => d.score !== undefined && d.score !== null);
    return {
      week:       w.week,
      label:      getWeekLabel(w.week),
      avgScore:   avg(validDrivers.map(d => d.score)),
      totalParcels: sum(drivers.map(d => d.parcels)),
      fpCount:    drivers.filter(d => (d.status||'').toLowerCase().includes('fantastic')).length,
      poorCount:  drivers.filter(d => (d.status||'').toLowerCase().includes('poor')).length,
      totalDrivers: drivers.length,
      concessions: w.concessions?.length || 0,
      avgDCR:     avg(drivers.filter(d => d.dcr > 0).map(d => d.dcr))
    };
  });

  const latest  = weekData[weekData.length - 1];
  const prev    = weekData[weekData.length - 2];
  const labels  = weekData.map(w => `W${String(w.week).split('-')[1] || w.week}`);

  contentEl.innerHTML = `
    <!-- Summary comparison -->
    ${prev ? `
    <div class="section-header">
      <span class="section-title">Week-on-Week</span>
      <span class="text-sm text-muted">${latest.label} vs ${prev.label}</span>
    </div>
    <div class="stat-grid mb-md">
      ${deltaCard('Avg Score', latest.avgScore?.toFixed(0), prev.avgScore?.toFixed(0), '')}
      ${deltaCard('Fantastic+', latest.fpCount, prev.fpCount, '')}
    </div>
    <div class="stat-grid mb-md">
      ${deltaCard('Poor Count', latest.poorCount, prev.poorCount, '', true)}
      ${deltaCard('Concessions', latest.concessions, prev.concessions, '', true)}
    </div>
    ` : ''}

    <!-- Score trend -->
    <div class="section-header mt-lg">
      <span class="section-title">Score Trend</span>
    </div>
    <div class="card mb-sm">
      <div class="card-header">
        <span class="card-title">Average Total Score</span>
      </div>
      <div class="chart-wrapper">
        <canvas id="score-trend-chart"></canvas>
      </div>
    </div>

    <!-- Parcel trend -->
    <div class="card mb-sm">
      <div class="card-header">
        <span class="card-title">Total Parcels Delivered</span>
      </div>
      <div class="chart-wrapper">
        <canvas id="parcels-trend-chart"></canvas>
      </div>
    </div>

    <!-- Concession trend -->
    <div class="card mb-sm">
      <div class="card-header">
        <span class="card-title">Concessions per Week</span>
      </div>
      <div class="chart-wrapper">
        <canvas id="concessions-trend-chart"></canvas>
      </div>
    </div>

    <!-- Standing distribution -->
    <div class="section-header mt-lg">
      <span class="section-title">Standing Distribution</span>
      <span class="text-sm text-muted">${latest.label}</span>
    </div>
    <div class="card mb-sm">
      <div style="display:flex;gap:var(--space-md);align-items:center">
        <div style="flex-shrink:0;width:120px;height:120px">
          <canvas id="standing-donut"></canvas>
        </div>
        <div style="flex:1" id="standing-legend"></div>
      </div>
    </div>

    <!-- Insights -->
    <div class="section-header mt-lg">
      <span class="section-title">Insights</span>
    </div>
    <div id="analytics-insights"></div>

    <!-- DNR Analysis -->
    <div class="section-header mt-lg">
      <span class="section-title">DNR Analysis</span>
      <span class="text-sm text-muted">${latest.label}</span>
    </div>
    <div id="analytics-dnr"></div>
  `;

  // Render charts after layout
  setTimeout(() => {
    renderAnalyticsCharts(weekData, labels, latest, sorted);
  }, 50);
}

function renderAnalyticsCharts(weekData, labels, latest, sorted) {
  // Score trend
  const scoreCanvas = document.getElementById('score-trend-chart');
  if (scoreCanvas && weekData.length > 0) {
    drawLineChart(scoreCanvas,
      [{ data: weekData.map(w => w.avgScore || 0), color: 'accent' }],
      labels, { min: 0, max: 110 }
    );
  }

  // Parcels trend
  const parcelsCanvas = document.getElementById('parcels-trend-chart');
  if (parcelsCanvas && weekData.length > 0) {
    drawLineChart(parcelsCanvas,
      [{ data: weekData.map(w => w.totalParcels || 0), color: 'success' }],
      labels, { yFormat: v => Math.round(v/1000)+'k' }
    );
  }

  // Concessions trend
  const concCanvas = document.getElementById('concessions-trend-chart');
  if (concCanvas && weekData.length > 0) {
    drawBarChart(concCanvas,
      weekData.map(w => w.concessions),
      labels,
      { colors: weekData.map(w => w.concessions > 100 ? '#f87171' : w.concessions > 50 ? '#fbbf24' : '#34d399') }
    );
  }

  // Standing donut
  const donutCanvas = document.getElementById('standing-donut');
  const lastDrivers = sorted[sorted.length - 1]?.drivers || [];
  if (donutCanvas && lastDrivers.length) {
    const fp   = lastDrivers.filter(d => (d.status||'').toLowerCase().includes('fantastic')).length;
    const g    = lastDrivers.filter(d => (d.status||'').toLowerCase().includes('great')).length;
    const poor = lastDrivers.filter(d => (d.status||'').toLowerCase().includes('poor')).length;
    const other = lastDrivers.length - fp - g - poor;

    drawDonutChart(donutCanvas, [
      { value: fp,    color: 'purple', label: 'Fantastic+' },
      { value: g,     color: 'success', label: 'Great' },
      { value: other, color: 'info', label: 'Other' },
      { value: poor,  color: 'danger', label: 'Poor' }
    ], { centerText: lastDrivers.length, centerLabel: 'Drivers' });

    document.getElementById('standing-legend').innerHTML = [
      ['#a78bfa', 'Fantastic+', fp],
      ['#34d399', 'Great', g],
      ['#60a5fa', 'Other', other],
      ['#f87171', 'Poor', poor]
    ].map(([color, label, count]) => `
      <div class="data-row" style="padding:4px 0;border:none">
        <div class="flex items-center gap-sm">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></div>
          <span class="data-row-label">${label}</span>
        </div>
        <span class="data-row-value">${count}</span>
      </div>
    `).join('');
  }

  // Insights
  renderInsights(weekData, sorted);

  // DNR analysis
  renderDNRAnalysis(sorted[sorted.length - 1]);
}

function renderInsights(weekData, sorted) {
  const insights = [];
  const latest = weekData[weekData.length - 1];
  const prev   = weekData[weekData.length - 2];

  if (prev) {
    const scoreDelta = (latest.avgScore || 0) - (prev.avgScore || 0);
    if (Math.abs(scoreDelta) > 2) {
      insights.push({
        type: scoreDelta > 0 ? 'success' : 'warning',
        icon: scoreDelta > 0 ? '📈' : '📉',
        text: `Average score ${scoreDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(scoreDelta).toFixed(1)} points vs last week`
      });
    }

    if (latest.poorCount > prev.poorCount + 5) {
      insights.push({ type: 'danger', icon: '🚨', text: `Poor standings increased by ${latest.poorCount - prev.poorCount} this week — review performance` });
    }
    if (latest.concessions > prev.concessions * 1.2) {
      insights.push({ type: 'warning', icon: '⚠️', text: `Concessions up ${Math.round((latest.concessions/prev.concessions - 1)*100)}% week-on-week` });
    }
    if (latest.fpCount > prev.fpCount) {
      insights.push({ type: 'success', icon: '⭐', text: `${latest.fpCount - prev.fpCount} more drivers achieved Fantastic+ this week` });
    }
  }

  // Multi-week patterns
  if (weekData.length >= 3) {
    const avgPoor = avg(weekData.map(w => w.poorCount));
    if (latest.poorCount < avgPoor * 0.8) {
      insights.push({ type: 'success', icon: '🏆', text: `Poor standings are 20%+ below your average — great week!` });
    }
  }

  if (!insights.length) {
    insights.push({ type: 'info', icon: '📊', text: 'Import more weeks of data to generate trend insights' });
  }

  document.getElementById('analytics-insights').innerHTML =
    insights.map(i => `
      <div class="alert-item ${i.type} mb-sm">
        <span class="alert-icon">${i.icon}</span>
        <span class="alert-text">${i.text}</span>
      </div>
    `).join('');
}

function renderDNRAnalysis(weekData) {
  const el = document.getElementById('analytics-dnr');
  if (!weekData) { el.innerHTML = ''; return; }

  const allDNR = weekData.dnr || [];
  if (!allDNR.length) {
    el.innerHTML = '<div class="alert-item info"><span class="alert-icon">ℹ️</span><span class="alert-text">No DNR data in this file</span></div>';
    return;
  }

  // Top DNR offenders
  const topDNR = [...allDNR]
    .filter(d => d.dnrCount > 0)
    .sort((a,b) => b.dnrCount - a.dnrCount)
    .slice(0,5);

  el.innerHTML = `
    <div class="card mb-sm">
      <div class="card-title mb-md">Top DNR Drivers</div>
      ${topDNR.map(d => `
        <div class="driver-row">
          <div class="driver-avatar" style="width:28px;height:28px;font-size:10px">${initials(d.daName)}</div>
          <div class="driver-info">
            <div class="driver-name" style="font-size:12px">${d.daName?.split(' ').slice(0,2).join(' ')}</div>
            <div class="driver-meta">${d.station} · ${d.delivered} delivered</div>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--danger)">${d.dnrCount}</div>
            <div class="stat-label">${formatNum(d.dnrDpmo)} DPMO</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function deltaCard(label, current, previous, unit, lowerIsBetter = false) {
  const curr = parseFloat(current) || 0;
  const prev = parseFloat(previous) || 0;
  const diff = curr - prev;
  const isGood = lowerIsBetter ? diff <= 0 : diff >= 0;
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  const deltaClass = diff === 0 ? '' : isGood ? 'up' : 'down';

  return `
    <div class="stat-block">
      <div class="stat-value ${isGood && diff !== 0 ? 'success' : !isGood && diff !== 0 ? 'danger' : ''}">${current}${unit}</div>
      <div class="stat-label">${label}</div>
      ${diff !== 0 && prev ? `<div class="stat-delta ${deltaClass}">${arrow} ${Math.abs(diff).toFixed(diff % 1 === 0 ? 0 : 1)}${unit} vs prev</div>` : '<div class="stat-delta">—</div>'}
    </div>
  `;
}

function avg(arr) {
  const valid = arr.filter(v => v !== null && v !== undefined && !isNaN(v));
  return valid.length ? valid.reduce((s,v) => s+v, 0) / valid.length : 0;
}

function sum(arr) {
  return arr.filter(v => !isNaN(v)).reduce((s,v) => s+v, 0);
}

function initials(name) {
  return (name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
}

window.renderAnalytics = renderAnalytics;