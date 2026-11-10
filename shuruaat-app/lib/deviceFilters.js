import { filterEntries } from './parseDeviceListTxt';

export const SORT_ORDERS = [
  { key: 'high_to_low', label: 'High→Low (50K–90L)' },
  { key: 'low_to_high', label: 'Low→High (2K–50K)' },
];

export const PIN_MODES = [
  { key: 'both', label: 'Both' },
  { key: 'with_pin', label: 'With PIN' },
  { key: 'without_pin', label: 'Without PIN' },
];

export const ONLINE_MODES = [
  { key: 'both', label: 'Both' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
];

/** Bank SMS — last N din ke andar */
export const SMS_AGE_FILTERS = [
  { key: 'all', label: 'All time', days: null },
  { key: '1d', label: '1 din', days: 1 },
  { key: '3d', label: '3 din', days: 3 },
  { key: '7d', label: '7 din', days: 7 },
  { key: '15d', label: '15 din', days: 15 },
  { key: '30d', label: '30 din', days: 30 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function applySmsAgeFilter(entries, smsAgeKey, now = Date.now()) {
  const opt = SMS_AGE_FILTERS.find((o) => o.key === smsAgeKey) ?? SMS_AGE_FILTERS[0];
  if (opt.days == null) return entries;
  const cutoff = now - opt.days * DAY_MS;
  return entries.filter((e) => e.lastSmsAt != null && e.lastSmsAt >= cutoff);
}

/** @deprecated use runPhaseFetch on Start button */
export function buildFilteredDeviceList(entries, { pinMode, smsAgeKey, sortOrder }) {
  const pinKey = pinMode === 'both' ? 'all' : pinMode;
  let list = filterEntries(entries, pinKey);
  list = applySmsAgeFilter(list, smsAgeKey);
  return list;
}
