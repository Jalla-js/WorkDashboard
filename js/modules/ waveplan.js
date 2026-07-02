/* ============================================================
   Wave Plan — Import and view wave plan data
   ============================================================ */

async function renderWaveplan() {
  const el = document.getElementById('main-content');
  el.innerHTML = `<div class="view active" id="view-waveplan">
    <div class="flex items-center justify-between">
      <div>
        <div class="view-title">Wave Plans</div>
        <div class="view-subtitle">Route assignments</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openImportModal('waveplan')">+ Import</button>
    </div>

    <div id="waveplan-list">
      <div class="loading-spinner"></div>
    </div>

    <div style="height: var(--space-xl)"></div>
  </div>`;

  await loadWaveplans();
}

async function loadWaveplans() {
  const plans = await storage.getWaveplans({ limit: 20 });
  const listEl = document.getElementById('waveplan-list');

  if (!plans.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌊</div>
        <div class="empty-state-title">No wave plans yet</div>
        <div class="empty-state-sub">Import a wave plan screenshot to extract route assignments, load times, and driver allocations</div>
      </div>
      <button class="btn btn-primary btn-full mt-md" onclick="openImportModal('waveplan')">Import Wave Plan Image</button>
    `;
    return;
  }

  listEl.innerHTML = plans.map(plan => renderWaveCard(plan)).join('');
}

function renderWaveCard(plan) {
  const date = plan.date ? new Date(plan.date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'short' }) : 'Unknown date';
  const totalDrivers = (plan.waves || []).reduce((s, w) => s + (w.drivers?.length || 0), 0);

  return `
  <div class="card mb-sm">
    <div class="card-header">
      <div>
        <div class="card-title">${date}</div>
        <div class="text-sm text-muted mt-sm">${plan.station || 'DXM4'} · ${totalDrivers} drivers · ${plan.waves?.length || 0} waves</div>
      </div>
      <div class="flex gap-sm">
        <span class="tag-chip">${plan._source === 'ai' ? '🤖 AI' : '📥'}</span>
        <button class="icon-btn" onclick="deleteWaveplan(${plan.id})" style="width:28px;height:28px;font-size:11px">✕</button>
      </div>
    </div>

    ${(plan.waves || []).map(wave => `
      <div style="margin-bottom: var(--space-md)">
        <div class="flex items-center gap-sm mb-sm">
          <span class="tag-chip" style="background:var(--accent-dim);color:var(--accent);border-color:var(--accent-glow)">
            📦 ${wave.loadTime || '??:??'} Load
          </span>
          ${wave.holdingTime ? `<span class="tag-chip">Hold by ${wave.holdingTime}</span>` : ''}
          ${wave.stagingArea ? `<span class="tag-chip">Area: ${wave.stagingArea}</span>` : ''}
        </div>

        <div class="card" style="padding: var(--space-sm);background:rgba(255,255,255,0.02)">
          <table class="wave-table">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Route</th>
                <th>Van</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              ${(wave.drivers || []).map(d => `
                <tr>
                  <td>${d.name || '—'}</td>
                  <td><span class="wave-slot-${routeColor(d.route)} font-mono" style="font-size:10px">${d.route || '—'}</span></td>
                  <td class="font-mono" style="font-size:11px">${d.vanId || '—'}</td>
                  <td>
                    ${(d.flags || []).map(f =>
                      `<span class="tag-chip ${f.includes('HV') ? 'hv' : f.includes('HC') ? 'hc' : ''}" style="margin:1px;padding:1px 5px;font-size:10px">${f}</span>`
                    ).join('')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('')}

    ${plan._source === 'stub' ? `
      <div class="alert-item warning">
        <span class="alert-icon">⚠️</span>
        <span class="alert-text">AI parsing failed — data is a placeholder. Try re-importing a clearer image.</span>
      </div>
    ` : ''}
  </div>
  `;
}

function routeColor(route) {
  if (!route) return 'blue';
  const r = route.toUpperCase();
  if (r.includes('CRPD')) return 'red';
  if (r.includes('TBC'))  return 'green';
  return 'blue';
}

async function deleteWaveplan(id) {
  if (!confirm('Delete this wave plan?')) return;
  await storage.delete('waveplans', id);
  showToast('Wave plan deleted', 'success');
  await loadWaveplans();
}

window.renderWaveplan   = renderWaveplan;
window.deleteWaveplan   = deleteWaveplan;
