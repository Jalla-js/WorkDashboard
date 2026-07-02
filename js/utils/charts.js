/* ============================================================
   Charts — Lightweight canvas-based charts (no dependency)
   Mobile-optimised, dark theme, animated
   ============================================================ */

const CHART_COLORS = {
  accent:  '#ff9900',
  success: '#34d399',
  info:    '#60a5fa',
  danger:  '#f87171',
  warning: '#fbbf24',
  purple:  '#a78bfa',
  grid:    'rgba(255,255,255,0.06)',
  text:    'rgba(240,240,248,0.4)'
};

/* ============ LINE CHART ============ */
function drawLineChart(canvas, datasets, labels, opts = {}) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const PAD = { top: 12, right: 12, bottom: 28, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  // Find range
  const allVals = datasets.flatMap(d => d.data.filter(v => v != null));
  const minVal  = opts.min ?? Math.min(...allVals) * 0.9;
  const maxVal  = opts.max ?? Math.max(...allVals) * 1.1;
  const range   = maxVal - minVal || 1;

  const xScale = (i) => PAD.left + (i / (labels.length - 1 || 1)) * chartW;
  const yScale = (v) => PAD.top  + chartH - ((v - minVal) / range) * chartH;

  // Grid lines
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD.top + (i / gridLines) * chartH;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();

    // Y labels
    const val = maxVal - (i / gridLines) * range;
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = `${9 * dpr / dpr}px -apple-system`;
    ctx.textAlign = 'right';
    ctx.fillText(opts.yFormat ? opts.yFormat(val) : Math.round(val), PAD.left - 4, y + 3);
  }

  // X labels
  ctx.textAlign = 'center';
  labels.forEach((lbl, i) => {
    const x = xScale(i);
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = `9px -apple-system`;
    ctx.fillText(String(lbl).slice(-4), x, H - 6);
  });

  // Draw each dataset
  datasets.forEach((ds) => {
    const color  = CHART_COLORS[ds.color] || ds.color || CHART_COLORS.accent;
    const points = ds.data.map((v, i) => ({ x: xScale(i), y: yScale(v ?? minVal) }));

    // Gradient fill
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
    grad.addColorStop(0, color.replace(')', ',0.2)').replace('rgb', 'rgba').replace('#', '').length < 9 ?
      hexToRgba(color, 0.2) : color);
    grad.addColorStop(1, hexToRgba(color, 0));

    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, PAD.top + chartH);
    ctx.lineTo(points[0].x, PAD.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,10,15,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  });
}

/* ============ BAR CHART ============ */
function drawBarChart(canvas, data, labels, opts = {}) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx  = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const PAD = { top: 12, right: 8, bottom: 32, left: 38 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top  - PAD.bottom;

  const maxVal  = opts.max ?? Math.max(...data) * 1.1 || 1;
  const barGap  = 6;
  const barW    = (chartW / data.length) - barGap;
  const colors  = opts.colors || data.map(() => CHART_COLORS.accent);

  // Grid
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = 1;
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = PAD.top + chartH * (1 - f);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '9px -apple-system';
    ctx.textAlign = 'right';
    ctx.fillText(opts.yFormat ? opts.yFormat(maxVal * f) : Math.round(maxVal * f), PAD.left - 4, y + 3);
  });

  // Bars
  data.forEach((val, i) => {
    const x  = PAD.left + i * (barW + barGap);
    const bH = (val / maxVal) * chartH;
    const y  = PAD.top + chartH - bH;
    const color = Array.isArray(colors) ? colors[i] || CHART_COLORS.accent
                                        : CHART_COLORS[colors] || CHART_COLORS.accent;

    // Gradient bar
    const grad = ctx.createLinearGradient(0, y, 0, y + bH);
    grad.addColorStop(0, hexToRgba(color, 0.9));
    grad.addColorStop(1, hexToRgba(color, 0.4));

    ctx.beginPath();
    roundedRect(ctx, x, y, barW, bH, 3);
    ctx.fillStyle = grad;
    ctx.fill();

    // Label
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '9px -apple-system';
    ctx.textAlign = 'center';
    const lbl = String(labels[i] || '');
    ctx.fillText(lbl.length > 6 ? lbl.slice(0, 6) : lbl, x + barW / 2, H - 8);
  });
}

/* ============ DONUT CHART ============ */
function drawDonutChart(canvas, segments, opts = {}) {
  const dpr  = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx  = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const cx = W / 2;
  const cy = H / 2;
  const r  = Math.min(W, H) / 2 - 8;
  const inner = r * 0.6;

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let angle = -Math.PI / 2;

  segments.forEach(seg => {
    const sweep = (seg.value / total) * 2 * Math.PI;
    const color = CHART_COLORS[seg.color] || seg.color || CHART_COLORS.accent;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(color, 0.85);
    ctx.fill();
    angle += sweep;
  });

  // Inner hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(10,10,15,0.9)';
  ctx.fill();

  // Center text
  if (opts.centerText) {
    ctx.fillStyle = '#f0f0f8';
    ctx.font = `bold 18px -apple-system`;
    ctx.textAlign = 'center';
    ctx.fillText(opts.centerText, cx, cy + 2);
    if (opts.centerLabel) {
      ctx.fillStyle = CHART_COLORS.text;
      ctx.font = '10px -apple-system';
      ctx.fillText(opts.centerLabel, cx, cy + 16);
    }
  }
}

/* ============ SCORE RING ============ */
function updateScoreRing(el, score, maxScore = 100) {
  const svg  = el.querySelector('svg');
  const fill = el.querySelector('.score-ring-fill');
  const num  = el.querySelector('.score-ring-number');

  if (!svg || !fill) return;

  const r = 35;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / maxScore));

  fill.setAttribute('cx', '40');
  fill.setAttribute('cy', '40');
  fill.setAttribute('r',  String(r));
  fill.style.strokeDasharray  = circumference;
  fill.style.strokeDashoffset = circumference * (1 - pct);

  const color = pct >= 0.9 ? '#a78bfa'   // FP range
              : pct >= 0.7 ? '#34d399'    // good
              : pct >= 0.5 ? '#fbbf24'    // warning
                           : '#f87171';   // poor
  fill.style.stroke = color;

  if (num) {
    num.textContent = Math.round(score);
    num.style.color = color;
  }
}

/* ============ HELPERS ============ */
function hexToRgba(hex, alpha = 1) {
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) {
    return hex.replace(/[\d.]+\)$/, `${alpha})`);
  }
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

window.drawLineChart   = drawLineChart;
window.drawBarChart    = drawBarChart;
window.drawDonutChart  = drawDonutChart;
window.updateScoreRing = updateScoreRing;
window.hexToRgba       = hexToRgba;
