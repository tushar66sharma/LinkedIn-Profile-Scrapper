/**
 * Simple in-memory LRU-style cache for profile data.
 * Profiles are cached for CACHE_TTL_MS milliseconds.
 * Max CACHE_MAX_SIZE entries — oldest entry is evicted first.
 */

const CACHE_TTL_MS   = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 100;             // max 100 profiles in memory

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export function cacheGet(username: string): any | null {
  const entry = store.get(username);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(username);
    return null;
  }
  console.log(`[Cache] HIT for "${username}" — skipping LinkedIn API call.`);
  return entry.data;
}

export function cacheSet(username: string, data: any): void {
  // Evict oldest entry if we've hit the size limit
  if (store.size >= CACHE_MAX_SIZE) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(username, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  console.log(`[Cache] SET for "${username}" — cached for 1 hour.`);
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}
