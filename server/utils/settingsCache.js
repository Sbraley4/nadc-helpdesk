// server/utils/settingsCache.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// In-memory cache
let cache = {};
let lastRefresh = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a setting value from cache (refreshes from DB if stale)
 */
async function getSetting(key) {
  const now = Date.now();

  // Refresh cache if stale
  if (now - lastRefresh > CACHE_TTL) {
    await refreshCache();
  }

  return cache[key] || null;
}

/**
 * Get multiple settings at once
 */
async function getSettings(keys) {
  const now = Date.now();

  if (now - lastRefresh > CACHE_TTL) {
    await refreshCache();
  }

  const result = {};
  for (const key of keys) {
    result[key] = cache[key] || null;
  }
  return result;
}

/**
 * Set a setting value (updates DB and cache)
 */
async function setSetting(key, value) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });

  cache[key] = String(value);
}

/**
 * Refresh cache from database
 */
async function refreshCache() {
  const settings = await prisma.appSetting.findMany();
  cache = settings.reduce((acc, s) => {
    acc[s.key] = s.value;
    return acc;
  }, {});
  lastRefresh = Date.now();
}

/**
 * Clear the cache (forces refresh on next read)
 */
function clearCache() {
  cache = {};
  lastRefresh = 0;
}

module.exports = {
  getSetting,
  getSettings,
  setSetting,
  refreshCache,
  clearCache,
};
