#!/usr/bin/env node
/**
 * Telegram bot — TELEGRAM_BOT_TOKEN env required.
 * Local test: npm run cli
 */
import { Telegraf } from 'telegraf';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  parseTxtCredentials,
  fetchAllPanels,
  fetchPanelDevices,
} from './lib/panelCore.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATA_DIR = process.env.BOT_DATA_DIR || join(process.cwd(), '.bot-data');
const PANELS_FILE = join(DATA_DIR, 'panels.json');
const USER_PANELS = new Map();

if (!TOKEN) {
  console.error(`
TELEGRAM_BOT_TOKEN set nahi hai.

Local test (bina Telegram):
  cd firebase-panel-bot && npm install && npm run cli -- your-file.txt

Telegram ke liye:
  export TELEGRAM_BOT_TOKEN="123:ABC..."
  npm start
`);
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
    'Panel Search Bot (dev)\n\n' +
      '/status — kitne panels\n' +
      '/addtxt — credentials .txt file bhejo\n' +
      '/add URL|SECRET — ek panel\n' +
      '/fetch — saari panels se devices\n' +
      '/online — sirf online count\n\n' +
      'Pehle local test: npm run cli'
  );
});

bot.command('status', ctx => {
  const p = globalPanels.length;
  const cached = USER_PANELS.get(ctx.from.id);
  const devs = cached?.devices?.length ?? 0;
  ctx.reply(`Panels: ${p}\nCached devices (tumhare last fetch): ${devs}`);
});

bot.command('add', async ctx => {
  const text = ctx.message.text.replace(/^\/add\s*/i, '').trim();
  const parts = text.split(/[|,]/);
  if (parts.length < 2) {
    return ctx.reply('Format: /add https://xxx.firebaseio.com|your-secret-key');
  }
  const found = parseTxtCredentials(`${parts[0]}\n${parts[1]}`);
  if (!found.length) return ctx.reply('URL/key invalid.');
  const map = new Map(globalPanels.map(p => [p.url.toLowerCase(), p]));
  for (const p of found) map.set(p.url.toLowerCase(), p);
  globalPanels = [...map.values()];
  savePanels(globalPanels);
  ctx.reply(`OK. Total panels: ${globalPanels.length}`);
});

bot.on('document', async ctx => {
  const cap = (ctx.message.caption || '').toLowerCase();
  if (!cap.includes('addtxt') && !cap.includes('/addtxt')) {
    return ctx.reply('Caption mein likho: addtxt');
  }
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
    const res = await fetch(link.href);
    const text = await res.text();
    const found = parseTxtCredentials(text);
    if (!found.length) return ctx.reply('File mein koi Firebase URL+key nahi mila.');
    const map = new Map(globalPanels.map(p => [p.url.toLowerCase(), p]));
    for (const p of found) map.set(p.url.toLowerCase(), p);
    globalPanels = [...map.values()];
    savePanels(globalPanels);
    ctx.reply(`File se ${found.length} panel add. Total: ${globalPanels.length}`);
  } catch (e) {
    ctx.reply('File read fail: ' + e.message);
  }
});

bot.command('fetch', async ctx => {
  if (!globalPanels.length) return ctx.reply('Pehle /add ya addtxt se panels add karo.');
  const uid = ctx.from.id;
  const status = await ctx.reply(`⚡ Fetch start... ${globalPanels.length} panels`);
  try {
    const devices = await fetchAllPanels(globalPanels, {
      batch: 12,
      onProgress(done, total, count) {
        if (done % 20 === 0 || done === total) {
          ctx.telegram.editMessageText(
            ctx.chat.id,
            status.message_id,
            undefined,
            `⚡ ${done}/${total} panels · ${count} devices`
          ).catch(() => {});
        }
      },
    });
    USER_PANELS.set(uid, { devices, at: Date.now() });
    const online = devices.filter(d => d.status).length;
  await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      `✅ Done\nDevices: ${devices.length}\nOnline: ${online}\nPIN: ${devices.filter(d => d.hasPin).length}`
    );
  } catch (e) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      status.message_id,
      undefined,
      'Fail: ' + e.message
    );
  }
});

bot.command('online', ctx => {
  const cached = USER_PANELS.get(ctx.from.id);
  if (!cached?.devices?.length) return ctx.reply('Pehle /fetch chalao.');
  const online = cached.devices.filter(d => d.status);
  const lines = online.slice(0, 15).map((d, i) => `${i + 1}. ${d.id} PIN:${d.hasPin ? 'Y' : 'N'}`);
  ctx.reply(`Online: ${online.length}\n\n${lines.join('\n')}${online.length > 15 ? '\n...' : ''}`);
});

bot.launch();
console.log('Telegram bot polling...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
