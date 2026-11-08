const OPEN_PIN_VALUES = new Set(['', 'open', 'nopin', 'none', '0', '-']);

function normalizePin(raw) {
  if (raw == null) return '';
  return String(raw).trim();
}

function pinRequiresAuth(pinField) {
  const p = normalizePin(pinField);
  if (!p) return false;
  return !OPEN_PIN_VALUES.has(p.toLowerCase());
}

/**
 * Har line:
 *   deviceId|pin|label
 *   deviceId,pin,label
 * PIN khali / open / nopin → bina PIN
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
    const label = parts[2] ?? '';

    entries.push({
      deviceId: deviceId.toLowerCase(),
      deviceIdRaw: deviceId,
      requiresPin: pinRequiresAuth(pinField),
      pin: pinRequiresAuth(pinField) ? normalizePin(pinField) : '',
      label,
    });
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
