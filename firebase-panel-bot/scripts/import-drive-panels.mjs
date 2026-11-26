#!/usr/bin/env node
/** Import Telegram-style Firebase dump → panels.json + stats */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTxtCredentials, fetchAllPanels } from '../lib/panelCore.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BOT_DATA_DIR || join(__dir, '..', '.bot-data');
const PANELS_FILE = join(DATA_DIR, 'panels.json');

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/import-drive-panels.mjs <credentials.txt>');
  process.exit(1);
}

const text = readFileSync(input, 'utf8');
const parsed = parseTxtCredentials(text);

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let existing = [];
if (existsSync(PANELS_FILE)) {
  try {
    existing = JSON.parse(readFileSync(PANELS_FILE, 'utf8'));
  } catch {}
}

const map = new Map(existing.map(p => [p.url.toLowerCase(), p]));
let added = 0;
for (const p of parsed) {
  const k = p.url.toLowerCase();
  const prev = map.get(k);
  if (!prev || (p.key && (!prev.key || p.key.length > (prev.key?.length || 0)))) {
    if (!prev) added++;
    map.set(k, p);
  }
}

const panels = [...map.values()].sort((a, b) => a.url.localeCompare(b.url));
writeFileSync(PANELS_FILE, JSON.stringify(panels, null, 2));

const withKey = panels.filter(p => p.key);
const urlOnly = panels.filter(p => !p.key);

console.log(JSON.stringify({
  parsedFromFile: parsed.length,
  totalInBot: panels.length,
  newlyAdded: added,
  withAuthKey: withKey.length,
  urlOnly: urlOnly.length,
  savedTo: PANELS_FILE,
}, null, 2));

if (process.argv.includes('--fetch')) {
  console.error(`\nFetch ${panels.length} panels (with key only: ${withKey.length})...`);
  const toFetch = withKey.length ? withKey : panels;
  const t0 = Date.now();
  const devices = await fetchAllPanels(toFetch, {
    batch: 20,
    onProgress(done, total, count) {
      if (done % 100 === 0 || done === total) {
        console.error(`${done}/${total} panels · ${count} devices`);
      }
    },
  });
  const online = devices.filter(d => d.status);
  console.error(`Done ${((Date.now() - t0) / 1000).toFixed(0)}s · devices ${devices.length} · online ${online.length}`);
}
