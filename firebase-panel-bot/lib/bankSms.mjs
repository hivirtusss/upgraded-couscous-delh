const SCAM_BLOCK =
  /betting|casino|rummy|matka|satta|jackpot|aviator|bet365|1xbet|gambling|wagering|telegram|t\.me|bit\.ly|http|https|www\.|\.apk|deposit\s*now|play\s*now/i;
const CREDIT_WORDS = /\b(credited?|received|recd|deposited)\b/i;
const DEBIT_WORDS = /\b(debited?|withdrawn|sent|paid)\b/i;
const HAS_MONEY = /(?:Rs\.?\s*|INR\s*|₹\s*)[0-9,]+(?:\.[0-9]{1,2})?/i;
const AVL_PATTERNS = [
  /Avl\.?\s*Bal[^0-9]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /Available\s+Bal[^0-9]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

function extractSmsText(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  return String(raw.message || raw.body || raw.text || raw.msg || '').trim();
}

export function isScamSms(text) {
  if (!text || text.length < 8) return true;
  if (SCAM_BLOCK.test(text)) return true;
  return false;
}

export function isBankSms(text) {
  if (!text || text.length < 12) return false;
  if (isScamSms(text)) return false;
  if (!HAS_MONEY.test(text)) return false;
  return (
    CREDIT_WORDS.test(text) ||
    DEBIT_WORDS.test(text) ||
    /avl\s*bal|account|credited|debited|neft|imps/i.test(text)
  );
}

function parseAmount(s) {
  const v = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(v) ? v : 0;
}

export function extractAvlBalance(text) {
  for (const p of AVL_PATTERNS) {
    const m = text.match(p);
    if (m?.[1]) {
      const v = parseAmount(m[1]);
      if (v >= 1 && v < 99_999_999) return v;
    }
  }
  return 0;
}

export function extractTxnAmount(text) {
  const m = text.match(
    /(?:debited?|credited?|received)[^.\n]{0,50}(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
  );
  if (m?.[1]) return parseAmount(m[1]);
  return 0;
}

export function parseSmsTime(timeStr, fbKey = '') {
  if (fbKey && /^\d{10,}$/.test(String(fbKey))) return parseInt(fbKey, 10);
  const p = Date.parse(String(timeStr || ''));
  return Number.isFinite(p) ? p : 0;
}

export function processBankMessages(data, days = 0) {
  if (!data || typeof data !== 'object') {
    return { bankSms: [], maxBalance: 0, maxTxn: 0, bankSmsCount: 0 };
  }
  const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
  const bankSms = [];
  for (const [key, raw] of Object.entries(data)) {
    const text = extractSmsText(raw);
    if (!text || !isBankSms(text)) continue;
    const sender = String(raw?.sender || raw?.from || '?');
    const timeStr = String(raw?.dateTime || raw?.date || raw?.timestamp || '');
    const ts = parseSmsTime(timeStr, key);
    if (cutoff && ts && ts < cutoff) continue;
    const avlAmount = extractAvlBalance(text);
    const txnAmount = extractTxnAmount(text);
    bankSms.push({ text, sender, time: timeStr, ts, avlAmount, txnAmount });
  }
  bankSms.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const maxBalance = bankSms.reduce((m, x) => Math.max(m, x.avlAmount || 0), 0);
  const maxTxn = bankSms.reduce((m, x) => Math.max(m, x.txnAmount || 0), 0);
  return { bankSms, maxBalance, maxTxn, bankSmsCount: bankSms.length };
}
