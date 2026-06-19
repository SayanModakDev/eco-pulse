/**
 * @fileoverview Lightweight in-memory cache utility.
 * EFFICIENCY (Medium Impact): Provides O(1) time complexity for reads/writes.
 * Supports time-based expiry (TTL) and size-bounded eviction (LRU-style) to prevent memory leaks.
 * Used to store static emission factors, computed results, and frequently accessed data
 * to eliminate redundant processing overhead.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ENTRIES = 500;

class MemoryCache {
  /**
   * @param {object} options
   * @param {number} [options.ttlMs] - Time-to-live in milliseconds for each entry.
   * @param {number} [options.maxEntries] - Maximum entries before oldest are evicted.
   */
  constructor({
    ttlMs = DEFAULT_TTL_MS,
    maxEntries = DEFAULT_MAX_ENTRIES,
  } = {}) {
    /** @type {Map<string, { value: any, expiresAt: number }>} */
    this._store = new Map();
    this._ttlMs = ttlMs;
    this._maxEntries = maxEntries;
  }

  /**
   * Retrieve a value from the cache.
   * Returns undefined if the key is missing or expired.
   * @param {string} key
   * @returns {any | undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }

    // Move to end of Map iteration order (most recently accessed)
    // EFFICIENCY: Ensures active entries resist LRU eviction
    this._store.delete(key);
    this._store.set(key, entry);
    return entry.value;
  }

  /**
   * Store a value in the cache with an optional per-key TTL override.
   * @param {string} key
   * @param {any} value
   * @param {number} [ttlMs] - Optional TTL override for this specific entry.
   */
  set(key, value, ttlMs) {
    // Evict oldest entries if at capacity
    if (this._store.size >= this._maxEntries && !this._store.has(key)) {
      const oldestKey = this._store.keys().next().value;
      this._store.delete(oldestKey);
    }

    // Remove existing entry to refresh insertion order
    this._store.delete(key);

    this._store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this._ttlMs),
    });
  }

  /**
   * Check if a non-expired entry exists for the given key.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Remove a specific key from the cache.
   * @param {string} key
   * @returns {boolean} - Whether the key existed.
   */
  delete(key) {
    return this._store.delete(key);
  }

  /**
   * Remove all entries from the cache.
   */
  clear() {
    this._store.clear();
  }

  /**
   * Return the current number of (possibly expired) entries.
   * @returns {number}
   */
  get size() {
    return this._store.size;
  }

  /**
   * Return cache statistics for diagnostics.
   * @returns {{ size: number, maxEntries: number, ttlMs: number }}
   */
  stats() {
    return {
      size: this._store.size,
      maxEntries: this._maxEntries,
      ttlMs: this._ttlMs,
    };
  }
}

// Pre-built singleton caches for specific use cases

/** Cache for emission factor lookups — very long TTL since factors are static */
export const emissionFactorCache = new MemoryCache({
  ttlMs: 60 * 60 * 1000, // 1 hour (factors never change at runtime)
  maxEntries: 200,
});

/** Cache for recent orchestration results — shorter TTL for freshness */
export const resultCache = new MemoryCache({
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
});

/** General-purpose cache instance */
export default MemoryCache;
