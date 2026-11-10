/** Bank SMS: credit/debit/send/received + saari banks — spam skip */

const REAL_BANKS =
  /\b(HDFC|HDFCBANK|SBI|STATE\s*BANK|ONLINESBI|ICICI|ICICIBANK|AXIS|AXISBANK|KOTAK|KOTAKBANK|PNB|PUNJAB\s*NATIONAL|CANARA|CANARA\s*BANK|BOI|BANK\s*OF\s*INDIA|UNION\s*BANK|YES\s*BANK|YESBANK|IDBI|INDUSIND|FEDERAL|FEDERAL\s*BANK|RBL|RBL\s*BANK|IDFC|IDFC\s*FIRST|BARODA|BANK\s*OF\s*BARODA|BOB|INDIAN\s*BANK|UCO|UCO\s*BANK|CENTRAL\s*BANK|IOB|INDIAN\s*OVERSEAS|BANDHAN|AU\s*BANK|KARNATAKA\s*BANK|KARUR\s*VYSYA|KVBL|SOUTH\s*INDIAN|TMB|CITY\s*UNION|DCB|CSB|SBM|STANDARD\s*CHARTERED|CITI|HSBC|DBS|AMEX|NPCI|BOB|PSB|POST\s*OFFICE|IPPB|JAN\s*SMALL|ESAF|Dhanlaxmi|Lakshmi\s*Vilas|LVB|Tamilnad\s*Mercantil|J\s*&\s*K\s*Bank|JK\s*Bank|DCB\s*Bank|PAYTM\s*PAYMENTS|PAYTM)\b/i;

const VERIFIED_BANK_CODES = new Set([
  'BOIIND', 'HDFCBK', 'HDFCBN', 'SBIIN', 'SBIPSG', 'SBICRD', 'ICICIB', 'ICICIT', 'ICICIP',
  'AXISBK', 'UTIBBK', 'KOTAKB', 'KMBL', 'PNBSMS', 'PNBANK', 'CANBNK', 'CANBK', 'UNIONB', 'UBINBK',
  'YESBNK', 'YESB', 'IDFCBK', 'IDFCFB', 'FEDBNK', 'FEDBANK', 'RBLBNK', 'RBLBKL', 'BARODX', 'BARBNK',
  'INDBNK', 'INDIANB', 'UCOBNK', 'UCOBK', 'CENTBK', 'IOBBNK', 'IOBBK', 'BKIDIN', 'BKID', 'BANDHN',
  'AUBANK', 'KARBK', 'KVBLBK', 'KVB', 'CSBBNK', 'SBMINB', 'SCBANK', 'CITIBK', 'HSBCBK', 'DBSBK',
  'IPBMSG', 'IPPB', 'BAJAJF', 'BAJAJFI', 'BAJAJFN', 'NPCI',
  'PYTM', 'PAYTM', 'PHONEPE', 'PHONPE', 'GPAY', 'GOOGPAY', 'AMZPAY', 'MOBIKW', 'AIRPAY', 'JIOPAY',
]);

const SCAM_SENDER_CODES =
  /NCDPL|ARHAMS|PRSSAT|SRVIFY|SERVIFY|URDO|CDNSE|BILLAR|SMG888|MARKS|RHAMS|D1H7N|Z1R6N|D1H8N|ICAM|RHAMSH|BILLARH/i;
const DLT_PREFIX = /^(?:VM|JD|JX|AD|BZ|VK|TM|AX|BP|CP|HP|IP|DG|DM|AM|BT|SP|QP|TX|VA|BW|JM|ID|BK|QP)-/i;
const BANK_IN_SENDER =
  /HDFC|SBI|ICICI|AXIS|KOTAK|PNB|CANARA|BOI|UNION|YES|FEDERAL|RBL|IDFC|BARODA|BANK|BK|BNK|INDUS|KVB|IOB|UCO|CENT|BANDHAN|AU|IPPB|BKID/i;

const SCAM_BLOCK =
  /dearcustomer|betting|casino|rummy|teenpatti|matka|satta|jackpot|aviator|bet365|1xbet|slot|poker|fantasy|dream11|mpl\b|winzo|gambling|telegram|t\.me|bit\.ly|tinyurl|goo\.gl|wa\.me|whatsapp|click\s*here|play\s*now|install|download|\.apk|congratul|you\s+won|lottery|loan\s*approv|pre[\s-]?approved|instant\s+loan|reward\s*point|referral|invite\s*code|cashback\s+offer|unsubscribe|dlwagame|wagering|91club|colourwiz|wingo|diamond\s*exch|satsport|fairplay|parimatch|betway|crickex/i;

const FAKE_SENDER = /PROMO|OFFER|ADVERT|SPAM|GAME|BET|WIN|LOAN|INFO|ALERT|UPDATE|NOTICE|VERIFY|OTP|CASH|PRIZE|REWARD|LUCKY|PLAY|SPIN|CLUB|SLOT|GAMING|CASINO|RUMMY|MATKA|SATTA|JEETO|KHELO|DAMAN|CLUB91|91CLUB/i;

const SKIP_FLTU =
  /\b(otp|one[\s-]?time\s*pass|verification\s*code|do\s+not\s+share|password|pin\s+is|valid\s+for\s*\d+\s*min|discount|recharge\s*plan|data\s+pack|loan\s*offer|unsubscribe|free\s+data|sim\s+port|courier|swiggy|zomato|blinkit|zepto|weather|news|mega\s+sale|festive\s+offer|kyc\s+pending\s*loan)\b/i;

const CREDIT_WORDS =
  /\b(credit|credited|credits|receive|received|recd|deposited|deposit|amt\s*credited|money\s+received|sent\s+to\s+you|transfer\s+from)\b/i;
const DEBIT_WORDS =
  /\b(debit|debited|debits|send|sent|paid|withdrawn|deducted|transfer\s+to|spent)\b/i;
const BANK_ACTION =
  /\b(debited?|credited?|credit|debit|received|recd|send|sent|withdrawn|deposited|paid|payment|transfer(?:red)?|avl\.?\s*bal|available\s+bal|imps|neft|rtgs|utr|upi)\b/i;

const HAS_MONEY = /(?:Rs\.?\s*|INR\s*|₹\s*)[0-9,]+(?:\.[0-9]{1,2})?|[0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?/i;
const HAS_LINKISH =
  /(?:https?:\/\/|www\.|\blink\b|t\.me\/|wa\.me\/|bit\.ly|cutt\.ly|tinyurl|goo\.gl)/i;
const FAKE_AC_PHONE = /A\/C\s*\d{10,}/i;
const BANK_TXN_HINT =
  /\b(A\/C|Acct|Account|a\/c|XX\d{4}|X{2,}\d{4}|UPI\/|VPA|ref\.?\s*no|UTR|IMPS|NEFT|RTGS|CR|DR)\b/i;

const AVL_PATTERNS = [
  /Avl\.?\s*Bal[^0-9]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /Aval\.?\s*Bal[^0-9]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /Available\s+Bal(?:ance)?[^0-9]*([0-9,]+(?:\.[0-9]{1,2})?)/i,
  /Bal\.?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
];

function extractSmsText(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw.trim();
  return String(raw.message || raw.body || raw.text || raw.msg || '').trim();
}

function normalizeSender(sender) {
  return String(sender || '').toUpperCase().replace(/\s/g, '');
}

function senderTokenOk(token) {
  const code = String(token || '').replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) return false;
  if (SCAM_SENDER_CODES.test(code)) return false;
  return VERIFIED_BANK_CODES.has(code);
}

function isVerifiedBankSender(sender) {
  const s = normalizeSender(sender);
  if (!s || s === '?') return false;
  if (SCAM_SENDER_CODES.test(s)) return false;
  if (senderTokenOk(s)) return true;
  return s.split('-').filter(Boolean).some(p => senderTokenOk(p));
}

function isBankishSender(sender) {
  if (isVerifiedBankSender(sender)) return true;
  const s = normalizeSender(sender);
  if (!s) return false;
  if (SCAM_SENDER_CODES.test(s)) return false;
  if (DLT_PREFIX.test(s) && BANK_IN_SENDER.test(s)) return true;
  return BANK_IN_SENDER.test(s);
}

function isTxnMessage(text) {
  return CREDIT_WORDS.test(text) || DEBIT_WORDS.test(text) || BANK_ACTION.test(text);
}

function isOtpOnly(text) {
  if (!/\b(otp|one\s*time)\b/i.test(text)) return false;
  return !isTxnMessage(text) || !HAS_MONEY.test(text);
}

export function isScamSms(text, sender = '') {
  if (!text || text.length < 8) return true;
  const s = normalizeSender(sender);
  if (SCAM_BLOCK.test(text)) return true;
  if (SCAM_SENDER_CODES.test(s)) return true;
  if (FAKE_AC_PHONE.test(text)) return true;
  if (FAKE_SENDER.test(s) && !isBankishSender(sender)) return true;
  if (HAS_LINKISH.test(text)) return true;
  if (isOtpOnly(text)) return true;
  if (!isBankishSender(sender) && /dear\s+customer|congratul|you\s+won/i.test(text)) return true;
  return false;
}

export function isBankSms(text, sender = '') {
  if (!text || text.length < 10) return false;
  if (isScamSms(text, sender)) return false;
  if (SKIP_FLTU.test(text) && !isTxnMessage(text)) return false;
  if (!HAS_MONEY.test(text)) return false;

  const credited = CREDIT_WORDS.test(text);
  const debited = DEBIT_WORDS.test(text);
  const txn = credited || debited || BANK_ACTION.test(text);
  if (!txn) return false;

  const bankHint = BANK_TXN_HINT.test(text) || REAL_BANKS.test(text);
  const bankSender = isBankishSender(sender);

  if (bankSender && txn) return true;
  if (txn && bankHint) return true;
  if (txn && REAL_BANKS.test(text)) return true;
  if (/avl\s*bal|available\s+bal/i.test(text) && (bankSender || REAL_BANKS.test(text))) return true;

  if ((credited || debited) && HAS_MONEY.test(text) && text.length >= 20) {
    if (bankSender || bankHint) return true;
  }

  return false;
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
  const patterns = [
    /(?:debited?|credited?|credit|debit|received|recd|send|sent|paid|transfer)[\s\S]{0,100}(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)[\s\S]{0,50}(?:debited?|credited?|received|sent|paid)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = parseAmount(m[1]);
      if (v >= 1) return v;
    }
  }
  return 0;
}

export function maxMoneyInText(text) {
  let max = 0;
  const re = /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  let m;
  while ((m = re.exec(text))) {
    const v = parseAmount(m[1]);
    if (v > max && v < 99_999_999) max = v;
  }
  return max;
}

export function devicePeakAmount(row) {
  let peak = Math.max(row.maxBalance || 0, row.maxTxn || 0);
  for (const sms of row.bankSms || []) {
    peak = Math.max(peak, sms.avlAmount || 0, sms.txnAmount || 0, maxMoneyInText(sms.text));
  }
  return peak;
}

export function parseSmsTime(timeStr, fbKey = '') {
  if (fbKey && /^\d{10,}$/.test(String(fbKey))) {
    const n = parseInt(fbKey, 10);
    return n < 1e12 ? n * 1000 : n;
  }
  const raw = String(timeStr || '').trim();
  if (!raw) return 0;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(
      y,
      parseInt(dmy[2], 10) - 1,
      parseInt(dmy[1], 10),
      dmy[4] ? parseInt(dmy[4], 10) : 0,
      dmy[5] ? parseInt(dmy[5], 10) : 0
    );
    return dt.getTime() || 0;
  }
  const p = Date.parse(raw);
  return Number.isFinite(p) ? p : 0;
}

export function formatSmsWhen(ts, timeStr) {
  if (ts && ts > 0) {
    try {
      return new Date(ts).toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      /* fall through */
    }
  }
  const t = String(timeStr || '').trim();
  return t || '—';
}

export function processBankMessages(data, days = 0) {
  if (!data || typeof data !== 'object') {
    return { bankSms: [], maxBalance: 0, maxTxn: 0, bankSmsCount: 0 };
  }
  const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
  const bankSms = [];
  for (const [key, raw] of Object.entries(data)) {
    const text = extractSmsText(raw);
    const sender = String(raw?.sender || raw?.from || '?');
    if (!text || !isBankSms(text, sender)) continue;
    const timeStr = String(raw?.dateTime || raw?.date || raw?.timestamp || '');
    const ts = parseSmsTime(timeStr, key);
    if (cutoff && ts && ts < cutoff) continue;
    const avlAmount = extractAvlBalance(text);
    const txnAmount = extractTxnAmount(text);
    let txnType = 'bank';
    if (CREDIT_WORDS.test(text)) txnType = 'credit';
    else if (DEBIT_WORDS.test(text)) txnType = 'debit';
    bankSms.push({ text, sender, time: timeStr, ts, avlAmount, txnAmount, txnType });
  }
  bankSms.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  let maxBalance = 0;
  let maxTxn = 0;
  for (const x of bankSms) {
    maxBalance = Math.max(maxBalance, x.avlAmount || 0);
    maxTxn = Math.max(maxTxn, x.txnAmount || 0);
    const any = maxMoneyInText(x.text);
    if (/avl\s*bal|available\s+bal/i.test(x.text)) maxBalance = Math.max(maxBalance, any);
    else if (x.txnAmount || any) maxTxn = Math.max(maxTxn, any);
  }
  return { bankSms, maxBalance, maxTxn, bankSmsCount: bankSms.length };
}
