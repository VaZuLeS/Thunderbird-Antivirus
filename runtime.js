// Local caches: expiry is observable on every read/iteration; optional idle disposal.
class ExpiringMap extends Map {
    constructor(ttl = 15 * 60 * 1000, clock = () => Date.now(), options = {}) {
        super();
        if (!(ttl >= 0) || !Number.isFinite(ttl)) throw new RangeError('Invalid cache TTL');
        this.ttl = ttl; this.clock = clock; this.expires = new Map();
        this.maxSize = options.maxSize ?? Infinity;
        if (this.maxSize !== Infinity && (!Number.isSafeInteger(this.maxSize) || this.maxSize < 1)) throw new RangeError('Invalid cache size');
        this.onEvict = options.onEvict;
        this.autoExpire = options.autoExpire === true;
        this.timer = null; this.pruning = false;
    }
    remove(key, reason) {
        if (!super.has(key)) return false;
        const value = super.get(key);
        super.delete(key); this.expires.delete(key);
        try { this.onEvict?.(value, key, reason)?.catch?.(() => {}); } catch (_) { /* cleanup must continue */ }
        return true;
    }
    schedule() {
        if (!this.autoExpire || typeof setTimeout !== 'function') return;
        if (this.timer != null) clearTimeout(this.timer);
        this.timer = null;
        if (!this.expires.size) return;
        let next = Infinity;
        for (const deadline of this.expires.values()) next = Math.min(next, deadline);
        this.timer = setTimeout(() => { this.timer = null; this.prune(); }, Math.min(2147483647, Math.max(1, next - this.clock())));
        this.timer?.unref?.();
    }
    prune() {
        if (this.pruning) return;
        this.pruning = true;
        try {
            const now = this.clock();
            for (const [key, deadline] of this.expires) if (deadline <= now) this.remove(key, 'expired');
        } finally { this.pruning = false; }
        this.schedule();
    }
    set(key, value) {
        this.prune();
        if (super.has(key) && super.get(key) !== value) this.remove(key, 'replaced');
        this.expires.set(key, this.clock() + this.ttl); super.set(key, value);
        while (super.size > this.maxSize) this.remove(super.keys().next().value, 'capacity');
        this.schedule(); return this;
    }
    touch(key) {
        this.prune();
        if (!super.has(key)) return false;
        const value = super.get(key);
        super.delete(key); super.set(key, value);
        this.expires.set(key, this.clock() + this.ttl); this.schedule(); return true;
    }
    has(key) { this.prune(); return super.has(key); }
    get(key) { this.prune(); return super.get(key); }
    get size() { this.prune(); return super.size; }
    delete(key) { const found = this.remove(key, 'deleted'); this.schedule(); return found; }
    clear() {
        for (const key of super.keys()) this.remove(key, 'cleared');
        if (this.timer != null) clearTimeout(this.timer);
        this.timer = null;
    }
    *keys() { this.prune(); yield* super.keys(); }
    *values() { this.prune(); yield* super.values(); }
    *entries() { this.prune(); yield* super.entries(); }
    [Symbol.iterator]() { return this.entries(); }
    forEach(callback, thisArg) { this.prune(); return super.forEach(callback, thisArg); }
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
