// Bounded local caches and work scheduling; no remote resources.
class ExpiringMap extends Map {
    constructor(ttl = 15 * 60 * 1000, clock = () => Date.now()) {
        super(); this.ttl = ttl; this.clock = clock; this.expires = new Map();
    }
    set(key, value) { this.expires.set(key, this.clock() + this.ttl); return super.set(key, value); }
    has(key) {
        if (super.has(key) && this.expires.get(key) <= this.clock()) this.delete(key);
        return super.has(key);
    }
    get(key) { return this.has(key) ? super.get(key) : undefined; }
    delete(key) { this.expires.delete(key); return super.delete(key); }
    clear() { this.expires.clear(); super.clear(); }
}

async function mapWithLimit(items, limit, task) {
    const results = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await task(items[index], index);
        }
    }));
    return results;
}
