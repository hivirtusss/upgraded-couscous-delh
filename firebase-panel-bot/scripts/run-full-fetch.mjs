#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchAllPanels } from '../lib/panelCore.mjs';

const dir = dirname(fileURLToPath(import.meta.url));
const panels = JSON.parse(readFileSync(join(dir, '..', '.bot-data', 'panels.json'), 'utf8'));
const out = join(dir, '..', '.bot-data', 'last-fetch.json');

console.error(`Fetch ${panels.length} panels...`);
const t0 = Date.now();
const devices = await fetchAllPanels(panels, {
  batch: 25,
  onProgress(done, total, count) {
    if (done % 50 === 0 || done === total) {
      console.error(`${done}/${total} · devices ${count}`);
    }
  },
});

const online = devices.filter(d => d.status);
writeFileSync(
  out,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      panels: panels.length,
      devices: devices.length,
      online: online.length,
      withPin: devices.filter(d => d.hasPin).length,
      elapsedSec: (Date.now() - t0) / 1000,
      devices,
    },
    null,
    0
  )
);
console.error(`Done: ${devices.length} devices, ${online.length} online → ${out}`);
