const OPEN_PIN_VALUES = new Set(['', 'open', 'nopin', 'none', '0', '-']);

export function normalizePin(raw) {
  if (raw == null) return '';
  return String(raw).trim();
}

export function pinRequiresAuth(pinField) {
  const p = normalizePin(pinField);
  if (!p) return false;
  return !OPEN_PIN_VALUES.has(p.toLowerCase());
}

export function createDeviceEntry(deviceIdRaw, pinField, label = '') {
  const deviceId = String(deviceIdRaw).trim();
  if (!deviceId) return null;
  return {
    deviceId: deviceId.toLowerCase(),
    deviceIdRaw: deviceId,
    requiresPin: pinRequiresAuth(pinField),
    pin: pinRequiresAuth(pinField) ? normalizePin(pinField) : '',
    label: label ? String(label) : '',
  };
}

/** Firestore document → entry (fields flexible) */
export function mapFirestoreDocToEntry(docId, data) {
  const deviceIdRaw =
    data.deviceId ??
    data.device_id ??
    data.androidId ??
    data.android_id ??
    data.id ??
    docId;
  const pinField = data.pin ?? data.PIN ?? data.password ?? data.pass ?? '';
  const label = data.label ?? data.name ?? data.user ?? data.username ?? '';
  return createDeviceEntry(deviceIdRaw, pinField, label);
}
