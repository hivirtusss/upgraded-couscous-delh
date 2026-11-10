import { Markup } from 'telegraf';

export function extractSearchKeywords(rest) {
  const parts = rest
    .split(/[,|]/)
    .map(s => s.trim())
    .filter(Boolean);
  const skip = new Set([
    'online',
    'offline',
    'both',
    'high',
    'low',
    'high-low',
    'low-high',
    'bank',
    'bank online',
    '1d',
    '3d',
    '7d',
    '15d',
    '30d',
    'now',
    'start',
  ]);
  const keywords = parts.filter(p => {
    const l = p.toLowerCase();
    if (skip.has(l)) return false;
    if (/^\d+\s*d(ays?)?$/i.test(l)) return false;
    if (/^last\s*\d+/i.test(l)) return false;
    if (/^30-?90l$/i.test(l)) return false;
    return true;
  });
  if (!keywords.length) return ['avl/bal', 'bank'];
  return keywords;
}

export function tierFromRest(rest, isBankHigh = false) {
  if (isBankHigh) return 'bank70k';
  const l = rest.toLowerCase();
  if (l.includes('30-90l') || l.includes('30k')) return 'high_low';
  if (l.includes('high')) return 'high_low';
  return 'low_high';
}

export function optsFromWizard(w) {
  return {
    keywords: w.keywords || ['avl/bal', 'bank'],
    online: w.status === 'online',
    offline: w.status === 'offline',
    bothStatus: w.status === 'both',
    days: w.days ?? 1,
    pinBoth: w.pin === 'both',
    pinOnly: w.pin === 'with',
    noPinOnly: w.pin === 'without',
    tier: w.tier || 'low_high',
    bankOnly: true,
    avlBal: true,
  };
}

export function statusKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🟢 Online', 'sw|st|online'),
      Markup.button.callback('⚫ Offline', 'sw|st|offline'),
    ],
    [Markup.button.callback('🔄 Both', 'sw|st|both')],
  ]);
}

export function daysKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1 Day', 'sw|day|1'),
      Markup.button.callback('3 Days', 'sw|day|3'),
      Markup.button.callback('7 Days', 'sw|day|7'),
    ],
    [
      Markup.button.callback('15 Days', 'sw|day|15'),
      Markup.button.callback('30 Days', 'sw|day|30'),
      Markup.button.callback('All Time', 'sw|day|0'),
    ],
  ]);
}

export function pinKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ With PIN', 'sw|pin|with'),
      Markup.button.callback('❌ Without PIN', 'sw|pin|without'),
    ],
    [Markup.button.callback('🔄 Both (mix)', 'sw|pin|both')],
  ]);
}

export function sortKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 2K–50K (bada upar)', 'sw|sort|low'),
      Markup.button.callback('💰 30K–90L (bada upar)', 'sw|sort|high'),
    ],
    [Markup.button.callback('▶ START SEARCH', 'sw|go|start')],
  ]);
}

export function dayLabel(d) {
  if (d === 0) return 'All time';
  return `${d} day(s)`;
}

export function statusLabel(st) {
  if (st === 'online') return '🟢 Online';
  if (st === 'offline') return '⚫ Offline';
  return '🔄 Both';
}

export function pinLabel(pin) {
  if (pin === 'with') return 'With PIN';
  if (pin === 'without') return 'Without PIN';
  return 'Both (mix)';
}

export function sortLabel(sort) {
  if (sort === 'high') return '30K–90L · 90L upar → 30K niche';
  return '2K–50K · 50K upar → 2K niche';
}

/** Ek hi message update — nayi chat bar nahi */
export function wizardMessage(w, step) {
  const kw = (w.keywords || ['avl/bal', 'bank']).join(', ');
  const lines = [`🔎 Search · *${kw}*`, `📂 Saari loaded Firebase scan`, ''];
  if (w.status) lines.push(`✓ Status: ${statusLabel(w.status)}`);
  if (w.days !== null && w.days !== undefined) lines.push(`✓ Days: ${dayLabel(w.days)}`);
  if (w.pin) lines.push(`✓ PIN: ${pinLabel(w.pin)}`);
  if (w.sort) lines.push(`✓ Sort: ${sortLabel(w.sort)}`);
  lines.push('');
  if (step === 1) lines.push('*Step 1/4* — Device status tap karo:');
  else if (step === 2) lines.push('*Step 2/4* — Kitne din purane SMS?');
  else if (step === 3) lines.push('*Step 3/4* — UPI PIN filter:');
  else if (step === 4) lines.push('*Step 4/4* — Balance range + Start:');
  return lines.join('\n');
}

export async function editWizardStep(ctx, w, step, keyboard) {
  const text = wizardMessage(w, step);
  const extra = keyboard();
  try {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
  } catch {
    const m = await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
    w.wizardMsgId = m.message_id;
  }
}
