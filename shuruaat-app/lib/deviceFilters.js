import { filterEntries } from './parseDeviceListTxt';

export const SORT_ORDERS = [
  { key: 'high_to_low', label: 'High → Low' },
  { key: 'low_to_high', label: 'Low → High' },
];

export const PIN_MODES = [
  { key: 'all', label: 'All' },
  { key: 'with_pin', label: 'With PIN' },
  { key: 'without_pin', label: 'Without PIN' },
];

/** Last SMS kitne din ke andar (rolling window) */
export const SMS_AGE_FILTERS = [
  { key: 'all', label: 'All time', days: null },
  { key: '1d', label: '1 din', days: 1 },
  { key: '3d', label: '3 din', days: 3 },
  { key: '7d', label: '7 din', days: 7 },
  { key: '15d', label: '15 din', days: 15 },
  { key: '30d', label: '30 din', days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function sortKey(entry) {
  if (typeof entry.sortValue === 'number' && !Number.isNaN(entry.sortValue)) {
    return entry.sortValue;
  }
  if (entry.lastSmsAt != null) return entry.lastSmsAt;
  return 0;
}

export function applySmsAgeFilter(entries, smsAgeKey, now = Date.now()) {
  const opt = SMS_AGE_FILTERS.find((o) => o.key === smsAgeKey) ?? SMS_AGE_FILTERS[0];
  if (opt.days == null) return entries;
  const cutoff = now - opt.days * DAY_MS;
  return entries.filter((e) => e.lastSmsAt != null && e.lastSmsAt >= cutoff);
}

export function applySort(entries, sortOrder) {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    const va = sortKey(a);
    const vb = sortKey(b);
    return sortOrder === 'low_to_high' ? va - vb : vb - va;
  });
  return sorted;
}

export function buildFilteredDeviceList(entries, { pinMode, smsAgeKey, sortOrder }) {
  let list = filterEntries(entries, pinMode);
  list = applySmsAgeFilter(list, smsAgeKey);
  list = applySort(list, sortOrder);
  return list;
}
