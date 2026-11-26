import { normalizeFirebaseUrl, parseTxtCredentials, isFirebaseDbUrl } from './panelCore.mjs';

export function panelKey(url) {
  return normalizeFirebaseUrl(url).toLowerCase();
}

export function removePanelsFromList(panels, targets) {
  const remove = new Set();
  for (const t of targets) {
    const u = normalizeFirebaseUrl(t);
    if (u && isFirebaseDbUrl(u)) remove.add(u.toLowerCase());
  }
  const before = panels.length;
  const next = panels.filter(p => !remove.has(panelKey(p.url)));
  return { panels: next, removed: before - next.length, before };
}

export function urlsFromRemoveText(text) {
  const fromParse = parseTxtCredentials(text).map(p => p.url);
  const direct = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/(https?:\/\/[^\s]+(?:firebaseio\.com|firebasedatabase\.app)[^\s]*)/i);
    if (m) direct.push(normalizeFirebaseUrl(m[1]));
  }
  return [...new Set([...fromParse, ...direct])];
}