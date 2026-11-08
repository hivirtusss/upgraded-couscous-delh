import { parseSmsTime } from './parseSmsTime';

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

function parseSortValue(raw) {
  if (raw == null || raw === '') return 0;
  const n = Number(String(raw).trim());
  return Number.isNaN(n) ? 0 : n;
}

export function createDeviceEntry(deviceIdRaw, pinField, label = '', extra = {}) {
  const deviceId = String(deviceIdRaw).trim();
  if (!deviceId) return null;

  const lastSmsAt =
    extra.lastSmsAt != null
      ? extra.lastSmsAt
      : parseSmsTime(extra.lastSmsRaw);

  return {
    deviceId: deviceId.toLowerCase(),
    deviceIdRaw: deviceId,
    requiresPin: pinRequiresAuth(pinField),
    pin: pinRequiresAuth(pinField) ? normalizePin(pinField) : '',
    label: label ? String(label) : '',
    lastSmsAt: lastSmsAt ?? null,
    sortValue: parseSortValue(extra.sortValue),
  };
}

function readLastSmsFromFirestore(data) {
  const raw =
    data.lastSmsAt ??
    data.last_sms_at ??
    data.lastSms ??
    data.last_sms ??
    data.smsTime ??
    data.sms_time ??
    data.smsDate ??
    data.sms_date;

  if (raw && typeof raw === 'object' && typeof raw.toMillis === 'function') {
    return raw.toMillis();
  }
  return parseSmsTime(raw);
}

function readSortFromFirestore(data) {
  const raw =
    data.sortValue ??
    data.sort ??
    data.priority ??
    data.smsCount ??
    data.sms_count ??
    data.balance ??
    data.amount;
  return parseSortValue(raw);
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
  return createDeviceEntry(deviceIdRaw, pinField, label, {
    lastSmsAt: readLastSmsFromFirestore(data),
    sortValue: readSortFromFirestore(data),
  });
}

/** Firestore save ke liye plain object */
export function entryToFirestoreDoc(entry) {
  return {
    deviceId: entry.deviceIdRaw,
    pin: entry.requiresPin ? entry.pin : 'open',
    label: entry.label,
    lastSmsAt: entry.lastSmsAt ?? null,
    sortValue: entry.sortValue ?? 0,
    updatedAt: Date.now(),
  };
}
