import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

const LEGACY_FILE = 'panels.json';

export function ownerTelegramId() {
  const raw = process.env.BOT_OWNER_TELEGRAM_ID || process.env.OWNER_TELEGRAM_ID || '';
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function userPanelsFile(dataDir, telegramUserId) {
  const usersDir = join(dataDir, 'users');
  return join(usersDir, `${telegramUserId}.json`);
}

function readJsonFile(file) {
  if (!existsSync(file)) return [];
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function ensureUserPanelsStore(dataDir) {
  const usersDir = join(dataDir, 'users');
  if (!existsSync(usersDir)) mkdirSync(usersDir, { recursive: true });

  const legacy = join(dataDir, LEGACY_FILE);
  const hold = join(usersDir, '_legacy_migrate_when_owner_set.json');
  const ownerId = ownerTelegramId();

  if (existsSync(legacy)) {
    const target = ownerId ? userPanelsFile(dataDir, ownerId) : hold;
    if (!existsSync(target)) {
      const panels = readJsonFile(legacy);
      writeFileSync(target, JSON.stringify(panels, null, 2));
    }
    try {
      renameSync(legacy, join(dataDir, `${LEGACY_FILE}.migrated`));
    } catch {
    }
  }

  if (ownerId && existsSync(hold)) {
    const ownerFile = userPanelsFile(dataDir, ownerId);
    if (!existsSync(ownerFile)) {
      const panels = readJsonFile(hold);
      writeFileSync(ownerFile, JSON.stringify(panels, null, 2));
    }
  }
}

export function loadUserPanels(dataDir, telegramUserId) {
  ensureUserPanelsStore(dataDir);
  return readJsonFile(userPanelsFile(dataDir, telegramUserId));
}

export function saveUserPanels(dataDir, telegramUserId, panels) {
  const file = userPanelsFile(dataDir, telegramUserId);
  const usersDir = join(dataDir, 'users');
  if (!existsSync(usersDir)) mkdirSync(usersDir, { recursive: true });
  writeFileSync(file, JSON.stringify(panels, null, 2));
}

export function isBotOwner(telegramUserId) {
  const oid = ownerTelegramId();
  return oid !== null && oid === telegramUserId;
}