import {
  BALANCE_HIGH_TO_LOW,
  BALANCE_LOW_TO_HIGH,
} from '../constants/balanceRanges';
import { filterEntries } from './parseDeviceListTxt';
import { applySmsAgeFilter } from './deviceFilters';

export function parseBalance(raw) {
  if (raw == null || raw === '') return 0;
  const s = String(raw).trim().toLowerCase().replace(/,/g, '');
  if (s.endsWith('l') || s.endsWith('lac') || s.endsWith('lakh')) {
    const n = parseFloat(s);
    return Number.isNaN(n) ? 0 : Math.round(n * 100_000);
  }
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

export function parseOnline(raw) {
  if (raw == null || raw === '') return false;
  const s = String(raw).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'online' || s === 'on';
}

export function countPanels(entries) {
  const names = new Set();
  entries.forEach((e) => {
    const p = (e.panel || '').trim();
    if (p) names.add(p);
    else names.add('(no panel)');
  });
  return { count: names.size, names: [...names].sort() };
}

function inBalanceRange(balance, sortOrder) {
  const range =
    sortOrder === 'high_to_low' ? BALANCE_HIGH_TO_LOW : BALANCE_LOW_TO_HIGH;
  return balance >= range.min && balance <= range.max;
}

/**
 * Filters select karo → Start Phase Fetch
 */
export function runPhaseFetch(entries, options, now = Date.now()) {
  const pinKey = options.pinMode === 'both' ? 'all' : options.pinMode;

  let list = filterEntries(entries, pinKey);
  list = applySmsAgeFilter(list, options.smsAgeKey, now);

  list = list.filter((e) => {
    const bal = e.balance ?? 0;
    return inBalanceRange(bal, options.sortOrder);
  });

  if (options.onlineMode === 'online') {
    list = list.filter((e) => e.online);
  } else if (options.onlineMode === 'offline') {
    list = list.filter((e) => !e.online);
  }

  list.sort((a, b) => {
    const ba = a.balance ?? 0;
    const bb = b.balance ?? 0;
    if (options.sortOrder === 'low_to_high') return ba - bb;
    return bb - ba;
  });

  if (options.onlineMode === 'both') {
    list.sort((a, b) => {
      if (a.online === b.online) return 0;
      return a.online ? -1 : 1;
    });
  }

  return list;
}
