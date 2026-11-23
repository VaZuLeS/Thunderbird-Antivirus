/* Read-only Thunderbird enterprise policy. The platform caches it until restart. */
const ThundyManagedPolicy = (() => {
    const key = 'thundyPolicy';
    const invalid = Object.freeze({ invalid: true });
    const empty = Object.freeze({ revision: null, links: null, attachments: null, reporting: null });
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
    let loading;

    function rule(value, threshold) {
        if (!only(value, ['threshold', 'action', 'unknown'])) return invalid;
        const result = { threshold, action: 'warn', unknown: 'warn', ...value };
        return Number.isInteger(result.threshold) && result.threshold >= 0 && result.threshold <= 100 &&
            ['warn', 'block'].includes(result.action) && ['warn', 'block'].includes(result.unknown) ? result : invalid;
    }

    function reporting(value) {
        if (!only(value, ['mode', 'endpoint', 'indicators', 'details'])) return invalid;
        const { mode = 'off', endpoint, indicators = false, details = false } = value;
        if (!['off', 'malicious', 'suspicious'].includes(mode) || typeof indicators !== 'boolean' || typeof details !== 'boolean') return invalid;
        if (mode === 'off') return { mode };
        try {
            if (typeof endpoint !== 'string' || endpoint.length > 2048 || !/^https:\/\//i.test(endpoint)) return invalid;
            const url = new URL(endpoint);
            if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[?#]/.test(endpoint)) return invalid;
            return { mode, endpoint: url.href, origin: `https://${url.hostname}/*`, indicators, details };
        } catch (_) { return invalid; }
    }

    function parse(value) {
        if (value === undefined) return empty;
        if (!only(value, ['schemaVersion', 'revision', 'links', 'attachments', 'reporting']) ||
            value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1) {
            return { revision: null, links: invalid, attachments: invalid, reporting: invalid };
        }
        const parsed = {
            revision: value.revision,
            links: Object.hasOwn(value, 'links') ? rule(value.links, 50) : null,
            attachments: Object.hasOwn(value, 'attachments') ? rule(value.attachments, 70) : null,
            reporting: Object.hasOwn(value, 'reporting') ? reporting(value.reporting) : null
        };
        if (parsed.reporting?.endpoint && ![parsed.links, parsed.attachments].some(rule => rule && !rule.invalid)) {
            parsed.reporting = invalid;
        }
        return parsed;
    }

    function read() {
        if (!loading) loading = (async () => {
            try {
                if (!browser.storage.managed) return empty;
                return parse((await browser.storage.managed.get(key))[key]);
            } catch (error) {
                // Gecko raises this error when no policy or native manifest exists.
                return error?.message === 'Managed storage manifest not found' ? empty : parse(null);
            }
        })();
        return loading;
    }

    function decision(rule, { score, malicious, incomplete }) {
        if (rule.invalid) return { mode: 'block', reason: 'policy_invalid' };
        if (malicious) return { mode: 'block', reason: 'malicious' };
        if (Number.isFinite(score) && score >= rule.threshold) return { mode: rule.action, reason: 'threshold' };
        if (incomplete) return { mode: rule.unknown, reason: 'unknown' };
        return { mode: 'allow', reason: null };
    }

    return { read, decision };
})();
