interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const caches = new WeakMap<object, Map<string, CacheEntry>>();

function ttl() {
  const configured = Number(process.env.METRICS_RESULT_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 15_000;
}

export function readMetricsCache<T>(database: object, key: string): T | undefined {
  const entry = caches.get(database)?.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    caches.get(database)?.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function writeMetricsCache<T>(database: object, key: string, value: T) {
  const cacheTtl = ttl();
  if (cacheTtl === 0) return;
  const cache = caches.get(database) ?? new Map<string, CacheEntry>();
  cache.set(key, { value, expiresAt: Date.now() + cacheTtl });
  caches.set(database, cache);
}

export function clearMetricsCache(database: object) {
  caches.delete(database);
}
