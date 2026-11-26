/**
 * firebase-config.txt parse — har line: key=value
 */
export function parseFirebaseConfigTxt(raw) {
  const config = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    config[key] = value;
  }
  const required = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];
  const missing = required.filter((k) => !config[k] || config[k].includes('YOUR_'));
  if (missing.length) {
    return { ok: false, error: `Config incomplete: ${missing.join(', ')}`, config: null };
  }
  return { ok: true, config, error: null };
}
