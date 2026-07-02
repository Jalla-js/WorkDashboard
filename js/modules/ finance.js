/* ============================================================
   Finance — Invoice tracking and earnings analytics
   Derives estimated pay from imported metrics data
   ============================================================ */

async function renderFinance() {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="view active" id="view-finance">
    <div class="flex items-center justify-between">
      <div>
        <div class="view-title">Finance</div>
        <div class="view-subtitle">Earnings & tax tracking</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="openFinanceSettings()">⚙ Tax Rate</button>
    </div>

    <!-- Total earnings -->
    <div class="card card-success mb-md" id="finance-total-card">
      <div class="finance-total">
        <div class="finance-total-label">Total Estimated Earnings</div>
        <div class="finance-total-value" id="fin-total">£0.00</div>
        <div class="finance-total-sub" id="fin-total-sub">From imported metrics data</div>
      </div>
    </div>

    <!-- Summary row -->
    <div class="stat-grid mb-md">
      <div class="stat-block">
        <div class="stat-value accent" id="fin-weeks">0</div>
        <div class="stat-label">Weeks Data</div>
      </div>
      <div class="stat-block">
        <div class="stat-value warning" id="fin-tax">£0</div>
        <div class="stat-label">Est. Tax (20%)</div>
      </div>
    </div>
    <div class="stat-grid mb-md">
      <div class="stat-block">
        <div class="stat-value success" id="fin-net">£0</div>
        <div class="stat-label">Est. Net</div>
      </div>
      <div class="stat-block">
        <div class="stat-value info" id="fin-avg-week">£0</div>
        <div class="stat-label">Avg / Week</div>
      </div>
    </div>

    <!-- Tax reminder -->
    <div class="alert-item info mb-md">
      <span class="alert-icon">💡</span>
      <span class="alert-text">Set aside your tax estimate each week. Adjust the rate in settings if needed.</span>
    </div>

    <!-- Per-driver breakdown (from metrics) -->
    <div class="section-header">
      <span class="section-title">Pay Breakdown</span>
      <span class="text-sm text-muted" id="fin-week-label">—</span>
    </div>
    <div id="finance-driver-list">
      <div class="loading-spinner"></div>
    </div>

    <!-- Pay rate reference -->
    <div class="section-header mt-lg">
      <span class="section-title">Pay Rates</span>
    </div>
    <div class="card mb-md">
      ${[
        ['Super Stars', '£178/shift'],
        ['Fantastic+',  '£168/shift'],
        ['Fantastic',   '£153/shift'],
        ['Great',       '£147/shift'],
        ['Fair',        '£136.70/shift'],
        ['Poor',        '£136.70/shift'],
        ['Rescue Pay',  '£45–160 bonus'],
        ['Induction',   '£2/occurrence'],
      ].map(([tier, rate]) => `
        <div class="data-row">
          <span class="data-row-label">${tier}</span>
          <span class="data-row-value font-mono">${rate}</span>
        </div>
      `).join('')}
    </div>

    <div style="height: var(--space-xl)"></div>
  </div>`;

  await loadFinanceData();
}

async function loadFinanceData() {
  const allMetrics = await storage.getMetrics({ limit: 20 });
  const settings   = await getSettings();
  const taxRate    = settings.taxRate || 0.20;

  if (!allMetrics.length) {
    document.getElementById('finance-driver-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💷</div>
        <div class="empty-state-title">No pay data yet</div>
        <div class="empty-state-sub">Import weekly metrics files to calculate earnings from pay tier data</div>
      </div>
      <button class="btn btn-primary btn-full mt-md" onclick="openImportModal('metrics')">Import Metrics</button>
    `;
    return;
  }

  // Calculate totals across all imported weeks
  let grandTotal = 0;
  const weekTotals = [];

  allMetrics.forEach(w => {
    const drivers = w.drivers || [];
    const weekPay = drivers.reduce((s, d) => s + (d.payAmount || 0) + (d.rescuePay || 0), 0);
    weekTotals.push({ week: w.week, pay: weekPay, drivers: drivers.length });
    grandTotal += weekPay;
  });

  const estTax = grandTotal * taxRate;
  const estNet = grandTotal - estTax;
  const avgWeek = weekTotals.length ? grandTotal / weekTotals.length : 0;

  document.getElementById('fin-total').textContent    = formatCurrency(grandTotal);
  document.getElementById('fin-weeks').textContent    = allMetrics.length;
  document.getElementById('fin-tax').textContent      = '£' + Math.round(estTax).toLocaleString();
  document.getElementById('fin-net').textContent      = '£' + Math.round(estNet).toLocaleString();
  document.getElementById('fin-avg-week').textContent = '£' + Math.round(avgWeek).toLocaleString();

  // Show latest week breakdown
  const latest = allMetrics[0];
  document.getElementById('fin-week-label').textContent = getWeekLabel(latest.week);

  const driversWithPay = (latest.drivers || [])
    .filter(d => d.payAmount > 0)
    .sort((a,b) => b.payAmount - a.payAmount);

  document.getElementById('finance-driver-list').innerHTML = driversWithPay.length
    ? driversWithPay.map(d => `
      <div class="card mb-sm">
        <div class="flex items-center gap-md">
          <div class="driver-avatar">${initials(d.name)}</div>
          <div style="flex:1;min-width:0">
            <div class="driver-name">${d.name}</div>
            <div class="driver-meta">${tierLabel(d.status)} · ${d.numShifts} shift${d.numShifts !== 1 ? 's' : ''}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:700;color:var(--success);font-family:var(--font-mono)">${formatCurrency(d.payAmount)}</div>
            ${d.rescuePay ? `<div class="text-sm" style="color:var(--accent)">+${formatCurrency(d.rescuePay)} rescue</div>` : ''}
          </div>
        </div>
      </div>
    `).join('')
    : `<div class="alert-item info">
        <span class="alert-icon">ℹ️</span>
        <span class="alert-text">Pay amounts could not be calculated from this file. Ensure the metrics sheet includes shift/payment columns.</span>
      </div>`;
}

function openFinanceSettings() {
  const modal = document.getElementById('import-modal');
  document.getElementById('import-modal-title').textContent = 'Tax Settings';
  document.getElementById('import-modal-body').innerHTML = `
    <div class="card mb-md">
      <div class="card-title mb-md">Tax Rate</div>
      <div class="data-row">
        <span class="data-row-label">Current rate</span>
        <span class="data-row-value" id="current-tax-display">Loading…</span>
      </div>
      <div class="mt-md">
        <input type="range" id="tax-rate-slider" min="0" max="50" step="1" value="20"
          style="width:100%;accent-color:var(--accent)"
          oninput="document.getElementById('tax-rate-val').textContent=this.value+'%'">
        <div class="flex justify-between mt-sm">
          <span class="text-sm text-muted">0%</span>
          <span class="text-sm text-accent font-bold" id="tax-rate-val">20%</span>
          <span class="text-sm text-muted">50%</span>
        </div>
      </div>
    </div>
    <button class="btn btn-primary btn-full" onclick="saveTaxRate()">Save Rate</button>
  `;

  getSettings().then(s => {
    const rate = Math.round((s.taxRate || 0.20) * 100);
    document.getElementById('current-tax-display').textContent = rate + '%';
    document.getElementById('tax-rate-slider').value = rate;
    document.getElementById('tax-rate-val').textContent = rate + '%';
  });

  modal.hidden = false;
}

async function saveTaxRate() {
  const rate = parseInt(document.getElementById('tax-rate-slider').value) / 100;
  await storage.setSetting('taxRate', rate);
  closeModal();
  showToast(`Tax rate set to ${Math.round(rate*100)}%`, 'success');
  await loadFinanceData();
}

function initials(name) {
  return (name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
}

window.renderFinance      = renderFinance;
window.openFinanceSettings= openFinanceSettings;
window.saveTaxRate        = saveTaxRate;
