const { getCache, setCache } = require('../db/database');

class CacheManager {
  constructor() {
    this.inFlight = new Map();
  }

  async getOrFetch(key, ttlMs, fetchFn, provider = 'unknown') {
    const cached = getCache(key);
    if (cached && !cached.stale) {
      return { data: cached.data, fromCache: true, fetchedAt: cached.fetched_at, provider: cached.provider };
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      try {
        const data = await fetchFn();
        setCache(key, data, ttlMs, provider);
        return { data, fromCache: false, fetchedAt: Date.now(), provider };
      } catch (err) {
        if (cached) {
          return {
            data: cached.data,
            fromCache: true,
            stale: true,
            fetchedAt: cached.fetched_at,
            provider: cached.provider,
            error: err.message
          };
        }
        throw err;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

module.exports = new CacheManager();
