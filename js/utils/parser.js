/* ============================================================
   Parser — XLSX / CSV / Image parsing for imported files
   Uses SheetJS (xlsx) loaded via CDN for spreadsheet parsing
   ============================================================ */

// Dynamically load SheetJS if not present
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ============================================================
   METRICS XLSX PARSER
   Understands the DA Stats spreadsheet format:
   - Sheet: Metrics (driver performance, scores, tiers)
   - Sheet: Concessions
   - Sheet: DNR By Driver(DXM4) / DCE1 / DWN2
   ============================================================ */
async function parseMetricsXLSX(file) {
  await loadSheetJS();
  const data = await file.arrayBuffer();
  const wb   = XLSX.read(data, { type: 'array', cellDates: true });

  const result = {
    week:       null,
    station:    'DXM4',
    drivers:    [],
    concessions:[],
    dnr:        [],
    rawSheets:  {}
  };

  // Parse Metrics sheet
  if (wb.SheetNames.includes('Metrics')) {
    const ws   = wb.Sheets['Metrics'];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // The real data starts at row index 1 (header row = 0)
    const headerRow = rows[0] || [];
    // Find column indices by header content
    const colIdx = {};
    headerRow.forEach((h, i) => {
      const hs = String(h).trim();
      if (hs === 'S No.')             colIdx.sno = i;
      if (hs === 'Transporter ID')    colIdx.tid = i;
      if (hs === 'Name')              colIdx.name = i;
      if (hs === 'DWC 2.0 %')        colIdx.dwc = i;
      if (hs === 'Penalty')           colIdx.penalty = i;
      if (hs === 'Points Deduction')  colIdx.deduction = i;
      if (hs === 'Status')            colIdx.status = i;
      if (hs === 'Total Score')       colIdx.score = i;
      if (hs === 'Delivered parcels') colIdx.parcels = i;
      if (hs === 'DCR')               colIdx.dcr = i;
      if (hs === 'DSC DPMO')          colIdx.dsc = i;
      if (hs === 'Photo on delivery') colIdx.pod = i;
      if (hs === 'Contact Compliance')colIdx.cc = i;
      if (hs === 'IADC')              colIdx.iadc = i;
      if (hs === 'CDF')               colIdx.cdf = i;
      if (hs === 'Pickup')            colIdx.pickup = i;
      if (hs === 'Speed Violation')   colIdx.speed = i;
      if (hs === 'Signal Violation')  colIdx.signal = i;
      if (hs === 'Distractions')      colIdx.distraction = i;
      if (hs === 'Following Distance')colIdx.following = i;
      if (hs === 'Rescue Pay')        colIdx.rescue = i;
      if (hs === 'Induction')         colIdx.induction = i;
      // Pay tier columns
      if (hs === 'Super Stars - £178') colIdx.paySuperStar = i;
      if (hs === 'FP - £168')         colIdx.payFP = i;
      if (hs === 'F - £153')          colIdx.payF = i;
      if (hs === 'G - £147')          colIdx.payG = i;
      if (hs === 'F - £136.70')       colIdx.payFr = i;
      if (hs === 'P - £136.70')       colIdx.payP = i;
    });

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const sno = r[colIdx.sno];
      if (!sno || isNaN(Number(sno))) continue;

      const status = String(r[colIdx.status] || '').trim();
      const score  = parseFloat(r[colIdx.score]) || 0;
      const parcels= parseInt(r[colIdx.parcels]) || 0;
      const dcr    = parseFloat(r[colIdx.dcr]) || 0;
      const name   = String(r[colIdx.name] || '').trim();
      const tid    = String(r[colIdx.tid] || '').trim();

      if (!name) continue;

      // Determine pay amount
      let payAmount = 0;
      let payTier   = status;
      const shifts  = r[colIdx.paySuperStar] || r[colIdx.payFP] || r[colIdx.payF] || r[colIdx.payG] || r[colIdx.payFr] || r[colIdx.payP];
      const numShifts = parseFloat(shifts) || 0;

      if (r[colIdx.paySuperStar] && !isNaN(parseFloat(r[colIdx.paySuperStar]))) payAmount = parseFloat(r[colIdx.paySuperStar]) * 178;
      else if (r[colIdx.payFP] && !isNaN(parseFloat(r[colIdx.payFP])))          payAmount = parseFloat(r[colIdx.payFP]) * 168;
      else if (r[colIdx.payF] && !isNaN(parseFloat(r[colIdx.payF])))            payAmount = parseFloat(r[colIdx.payF]) * 153;
      else if (r[colIdx.payG] && !isNaN(parseFloat(r[colIdx.payG])))            payAmount = parseFloat(r[colIdx.payG]) * 147;
      else if (r[colIdx.payFr] && !isNaN(parseFloat(r[colIdx.payFr])))          payAmount = parseFloat(r[colIdx.payFr]) * 136.70;
      else if (r[colIdx.payP] && !isNaN(parseFloat(r[colIdx.payP])))            payAmount = parseFloat(r[colIdx.payP]) * 136.70;

      const rescuePay = parseFloat(r[colIdx.rescue]) || 0;

      result.drivers.push({
        rank:       Number(sno),
        tid,
        name,
        status,
        score,
        parcels,
        dcr,
        dsc:        parseFloat(r[colIdx.dsc]) || 0,
        pod:        parseFloat(r[colIdx.pod]) || 0,
        cc:         parseFloat(r[colIdx.cc]) || 0,
        iadc:       parseFloat(r[colIdx.iadc]) || 0,
        cdf:        parseFloat(r[colIdx.cdf]) || 0,
        pickup:     parseFloat(r[colIdx.pickup]) || 0,
        speed:      parseFloat(r[colIdx.speed]) || 0,
        signal:     parseFloat(r[colIdx.signal]) || 0,
        distraction:parseFloat(r[colIdx.distraction]) || 0,
        following:  parseFloat(r[colIdx.following]) || 0,
        penalty:    String(r[colIdx.penalty] || '').trim(),
        deduction:  parseFloat(r[colIdx.deduction]) || 0,
        rescuePay,
        payAmount,
        numShifts
      });
    }
  }

  // Parse Concessions sheet
  if (wb.SheetNames.includes('Concessions')) {
    const ws   = wb.Sheets['Concessions'];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    result.concessions = rows.map(r => ({
      tracking:    r['Tracking number'],
      deliveryDate:r['Delivery Date'],
      concessionDate: r['Concession Date'],
      daId:        r['Delivery Associate Name'] || r['DA'],
      daName:      r['Delivery Associate Name'],
      address:     r['Address'],
      postalId:    r['Postal ID'],
      dropoff:     r['Drop-off Location']
    })).filter(r => r.tracking);
  }

  // Parse DNR sheets
  for (const sheetName of wb.SheetNames) {
    if (!sheetName.startsWith('DNR')) continue;
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const station = sheetName.match(/\((\w+)\)/)?.[1] || 'UNKNOWN';

    // Extract week from first row
    if (rows[0]?.['Week'] && !result.week) {
      result.week = String(rows[0]['Week']);
    }

    for (const r of rows) {
      result.dnr.push({
        station,
        week:       r['Week'],
        daName:     r['Delivery Associate Name'],
        daId:       r['Delivery Associate ID'],
        delivered:  parseFloat(r['Delivered Packages']) || 0,
        dnrCount:   parseFloat(r['Packages Delivered Not Received (DNR)']) || 0,
        dnrDpmo:    parseFloat(r['DNR DPMO']) || 0,
        dispatched: parseFloat(r['Dispatched Packages']) || 0,
        rts:        parseFloat(r['Packages Returned to Station (RTS)']) || 0,
        rtsDpmo:    parseFloat(r['Return To Station DPMO']) || 0
      });
    }
  }

  // Derive week from DNR data if not found
  if (!result.week && result.dnr.length) {
    result.week = result.dnr[0].week;
  }

  return result;
}

/* ============================================================
   WAVE PLAN IMAGE PARSER
   Parses the wave plan image using Claude AI (vision)
   to extract structured data from the table format.
   ============================================================ */
async function parseWavePlanImage(file) {
  // Convert image to base64
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  // Use Claude API to extract structured data
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64 }
            },
            {
              type: 'text',
              text: `Extract the wave plan data from this Amazon DSP wave plan image.
Return ONLY valid JSON with this exact structure:
{
  "date": "YYYY-MM-DD or null",
  "station": "station code or null",
  "waves": [
    {
      "loadTime": "HH:MM",
      "holdingTime": "HH:MM",
      "stagingArea": "area code",
      "drivers": [
        {
          "name": "driver first name",
          "route": "route code e.g. 2 CRPD - A125 - A.9",
          "vanId": "3-letter code",
          "flags": ["HV", "HC"] // any special flags shown
        }
      ]
    }
  ],
  "totalDrivers": 0
}
If you cannot extract specific fields, use null. Include all waves visible.`
            }
          ]
        }]
      })
    });

    if (!response.ok) throw new Error('API error');
    const data = await response.json();
    const text = data.content?.find(c => c.type === 'text')?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    parsed._source = 'ai';
    return parsed;

  } catch (err) {
    console.warn('AI wave parse failed, using stub:', err);
    // Return stub structure if AI fails
    return {
      date:   new Date().toISOString().split('T')[0],
      station: 'DXM4',
      waves:  [{ loadTime: null, holdingTime: null, stagingArea: null, drivers: [] }],
      totalDrivers: 0,
      _source: 'stub'
    };
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function tierClass(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s.includes('fantastic_plus') || s.includes('fantastic plus')) return 'fp';
  if (s.includes('fantastic'))  return 'f';
  if (s.includes('great'))      return 'g';
  if (s.includes('poor'))       return 'poor';
  return '';
}

function tierLabel(status) {
  if (!status) return '—';
  const s = status.toLowerCase();
  if (s.includes('fantastic_plus') || s.includes('fantastic plus')) return 'Fantastic+';
  if (s.includes('fantastic'))  return 'Fantastic';
  if (s.includes('great'))      return 'Great';
  if (s.includes('poor'))       return 'Poor';
  return status;
}

function formatPct(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return (val * 100).toFixed(1) + '%';
}

function formatCurrency(val) {
  if (!val && val !== 0) return '—';
  return '£' + Number(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatNum(val, decimals = 0) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return Number(val).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getWeekLabel(weekStr) {
  if (!weekStr) return 'Unknown';
  // e.g. "2026-26" -> "W26 · 2026"
  const parts = String(weekStr).split('-');
  if (parts.length === 2) return `W${parts[1]} · ${parts[0]}`;
  return weekStr;
}

window.parseMetricsXLSX   = parseMetricsXLSX;
window.parseWavePlanImage  = parseWavePlanImage;
window.tierClass           = tierClass;
window.tierLabel           = tierLabel;
window.formatPct           = formatPct;
window.formatCurrency      = formatCurrency;
window.formatNum           = formatNum;
window.getWeekLabel        = getWeekLabel;
