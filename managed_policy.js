/* Read-only Thunderbird enterprise policy. The platform caches it until restart. */
const ThundySeverity = (() => {
    const colors = Object.freeze({low:'#24764a',unknown:'#a15b12',caution:'#b24c0d',high:'#bf2c36',critical:'#a30e29'});
    function presentation({mode,score,malicious,incomplete}, palette) {
        const severity = malicious || mode === 'block' || score >= 80 ? 'critical' :
            score >= 50 ? 'high' : score >= 25 || mode === 'approval' ? 'caution' :
                incomplete || !Number.isFinite(score) ? 'unknown' : mode === 'warn' ? 'caution' : 'low';
        return {severity,color:palette?.[severity] || colors[severity]};
    }
    return {colors,presentation};
})();

const ThundyManagedPolicy = (() => {
    const key = 'thundyPolicy';
    const invalid = Object.freeze({ invalid: true });
    const empty = Object.freeze({ revision: null, links: null, attachments: null, reporting: null });
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const only = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
    let loading;

    const automaticThreshold = value => value === null || Number.isInteger(value) && value >= 1 && value <= 100;
    const historyDefaults = Object.freeze({maxRecords:2000,retentionDays:30});
    function audit(value) {
        if (!only(value,['maxRecords','retentionDays'])) return invalid;
        const result = {...historyDefaults,...value};
        return Object.values(result).every(limit=>limit === null || Number.isSafeInteger(limit) && limit >= 1) ? result : invalid;
    }
    function palette(value) {
        if (!only(value,Object.keys(ThundySeverity.colors)) || !Object.values(value).every(color=>typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color))) return invalid;
        return {...value};
    }
    function rule(value, threshold, link = false) {
        const openingKeys = link ? ['waitForResults','autoOpenBelow'] : [];
        if (!only(value, ['threshold', 'action', 'unknown',...openingKeys])) return invalid;
        const result = { threshold, action: 'warn', unknown: 'warn', ...value };
        return Number.isInteger(result.threshold) && result.threshold >= 0 && result.threshold <= 100 &&
            (!Object.hasOwn(result,'waitForResults') || typeof result.waitForResults === 'boolean') &&
            (!Object.hasOwn(result,'autoOpenBelow') || automaticThreshold(result.autoOpenBelow)) &&
            ['warn', 'block'].includes(result.action) && ['warn', 'block'].includes(result.unknown) ? result : invalid;
    }

    function reporting(value) {
        if (!only(value, ['mode', 'endpoint', 'indicators', 'details', 'detections'])) return invalid;
        const { mode = 'off', endpoint, indicators = false, details = false, detections = false } = value;
        if (!['off', 'malicious', 'suspicious'].includes(mode) || typeof indicators !== 'boolean' ||
            typeof details !== 'boolean' || typeof detections !== 'boolean' || detections && !details) return invalid;
        if (mode === 'off') return { mode };
        try {
            if (typeof endpoint !== 'string' || endpoint.length > 2048 || !/^https:\/\//i.test(endpoint)) return invalid;
            const url = new URL(endpoint);
            if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[?#]/.test(endpoint)) return invalid;
            return { mode, endpoint: url.href, origin: `https://${url.hostname}/*`, indicators, details, ...(detections ? {detections} : {}) };
        } catch (_) { return invalid; }
    }

    function parse(value) {
        if (value === undefined) return empty;
        if (!only(value, ['schemaVersion', 'revision', 'links', 'attachments', 'reporting','severityColors','linkAudit']) ||
            value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1) {
            return { revision: null, links: invalid, attachments: invalid, reporting: invalid };
        }
        const parsed = {
            revision: value.revision,
            links: Object.hasOwn(value, 'links') ? rule(value.links, 50, true) : null,
            attachments: Object.hasOwn(value, 'attachments') ? rule(value.attachments, 70) : null,
            reporting: Object.hasOwn(value, 'reporting') ? reporting(value.reporting) : null
        };
        if (Object.hasOwn(value,'severityColors')) parsed.severityColors = palette(value.severityColors);
        if (Object.hasOwn(value,'linkAudit')) parsed.linkAudit = audit(value.linkAudit);
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

    return { read, decision, audit, historyDefaults, automaticThreshold };
})();
