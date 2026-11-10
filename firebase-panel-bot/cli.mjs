#!/usr/bin/env node
import { readFileSync } from 'fs';
import { parseTxtCredentials, fetchAllPanels, fetchPanelDevices } from './lib/panelCore.mjs';

const args = process.argv.slice(2);

function help() {
  console.log(`
Firebase Panel Bot — local CLI (Telegram se pehle yahan test karo)

  npm run cli -- <path-to-credentials.txt>
  npm run cli -- --url <firebase-url> --key <database-secret>
  npm run cli:demo

Commands flow:
  1) TXT / URL+key load
  2) clients.json fetch
  3) online / PIN count print
`);
}

async function runDemo() {
  const panels = parseTxtCredentials(
    'https://demo-default-rtdb.firebaseio.com\nDEMO_SECRET_NOT_REAL\n'
  );
  console.log('Demo parse:', panels.length, 'panel(s) from sample lines');
  console.log('Asli test: apni TXT file path do ya --url + --key');
}

async function main() {
  if (args.includes('--help') || args.includes('-h')) {
    help();
    return;
  }
  if (args.includes('--demo')) {
    await runDemo();
    return;
  }

  let panels = [];
  const urlIdx = args.indexOf('--url');
  const keyIdx = args.indexOf('--key');
  if (urlIdx >= 0 && keyIdx >= 0) {
    panels = parseTxtCredentials(`${args[urlIdx + 1]}\n${args[keyIdx + 1]}`);
  } else if (args[0] && !args[0].startsWith('-')) {
    const text = readFileSync(args[0], 'utf8');
    panels = parseTxtCredentials(text);
  } else {
    help();
    process.exit(1);
  }

  if (!panels.length) {
    console.error('Koi valid Firebase URL + key nahi mila.');
    process.exit(1);
  }

  console.log(`Panels: ${panels.length} — fetch shuru...`);
  const t0 = Date.now();
  let lastPct = 0;

  if (panels.length === 1) {
    try {
      const devices = await fetchPanelDevices(panels[0]);
      printSummary(devices, 1, 1, Date.now() - t0);
      printSample(devices);
      return;
    } catch (e) {
      console.error('Fetch fail:', e.message);
      process.exit(1);
    }
  }

  try {
    const devices = await fetchAllPanels(panels, {
      batch: 15,
      onProgress(done, total, count) {
        const pct = Math.floor((done / total) * 100);
        if (pct >= lastPct + 10) {
          lastPct = pct;
          console.log(`  ${done}/${total} panels · ${count} devices`);
        }
      },
    });
    printSummary(devices, panels.length, panels.length, Date.now() - t0);
    printSample(devices);
  } catch (e) {
    console.error('Fetch fail:', e.message);
    process.exit(1);
  }
}

function printSummary(devices, panelsOk, panelsTotal, ms) {
  const online = devices.filter(d => d.status).length;
  const withPin = devices.filter(d => d.hasPin).length;
  console.log('\n── Summary ──');
  console.log(`Time: ${(ms / 1000).toFixed(1)}s`);
  console.log(`Panels tried: ${panelsTotal}`);
  console.log(`Devices: ${devices.length} | Online: ${online} | With PIN: ${withPin}`);
}

function printSample(devices) {
  const sample = devices.filter(d => d.status).slice(0, 5);
  if (!sample.length) {
    console.log('\nKoi online device sample nahi (ya sab offline).');
    return;
  }
  console.log('\n── Online sample (max 5) ──');
  for (const d of sample) {
    console.log(`  ${d.id} | ${d.name} | PIN:${d.hasPin ? 'YES' : 'NO'} | bat:${d.battery ?? '—'}`);
  }
}

main();
