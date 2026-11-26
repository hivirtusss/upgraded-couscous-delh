import { createDeviceEntry } from './deviceEntry';

/**
 * Extended line (recommended):
 *   deviceId|pin|name|panel|balance|lastSms|online
 * Purana short format bhi chalega (5 column)
 */
export function parseDeviceListTxt(raw) {
  const entries = [];
  const errors = [];

  raw.split('\n').forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.includes('|')
      ? trimmed.split('|').map((s) => s.trim())
      : trimmed.split(',').map((s) => s.trim());

    const deviceId = parts[0];
    if (!deviceId) {
      errors.push(`Line ${index + 1}: device ID missing`);
      return;
    }

    const pinField = parts[1] ?? '';

    let label = '';
    let panel = '';
    let balanceRaw = '';
    let lastSmsRaw = '';
    let onlineRaw = '';

    if (parts.length >= 7) {
      label = parts[2] ?? '';
      panel = parts[3] ?? '';
      balanceRaw = parts[4] ?? '';
      lastSmsRaw = parts[5] ?? '';
      onlineRaw = parts[6] ?? '';
    } else {
      label = parts[2] ?? '';
      lastSmsRaw = parts[3] ?? '';
      balanceRaw = parts[4] ?? parts[3] ?? '';
    }

    const entry = createDeviceEntry(deviceId, pinField, label, {
      panel,
      balanceRaw,
      lastSmsRaw,
      onlineRaw,
    });
    if (entry) entries.push(entry);
  });

  return { entries, errors };
}

export function filterEntries(entries, mode) {
  if (mode === 'with_pin') return entries.filter((e) => e.requiresPin);
  if (mode === 'without_pin') return entries.filter((e) => !e.requiresPin);
  return entries;
}

export function findEntryForDevice(entries, deviceId) {
  if (!deviceId) return null;
  const key = deviceId.trim().toLowerCase();
  return entries.find((e) => e.deviceId === key) ?? null;
}
