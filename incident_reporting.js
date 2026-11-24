/* Optional delivery of minimized opening-attempt events to a managed HTTPS endpoint. */
const ThundyIncidentReporting = (() => {
    const key = 'thundyIncidentReportingV1';
    const alarm = 'thundy-incident-retry';
    const maxAge = 24 * 60 * 60 * 1000;
    const maxEvents = 100;
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    const tokenPattern = /^[A-Za-z0-9._~+\/=-]{16,1024}$/;
    let writes = Promise.resolve();
    let delivery;
    let activeRequest;
    let storageError = false;

    function serialize(work) {
        const result = writes.then(work);
        writes = result.catch(() => {});
        return result;
    }

    function fingerprint(config) {
        const settings = [config.endpoint, config.mode, config.indicators];
        if (config.details) settings.push(true);
        if (config.detections) settings.push('detections');
        return JSON.stringify(settings);
    }

    async function read(config) {
        const saved = (await browser.storage.local.get(key))[key];
        if (saved?.configuration === fingerprint(config) && Array.isArray(saved.events)) return saved;
        return { configuration: fingerprint(config), credential: null, events: [], failure: null, authRejected: false };
    }

    async function save(state) {
        try {
            await browser.storage.local.set({ [key]: state });
            storageError = false;
        } catch (error) {
            storageError = true;
            throw error;
        }
    }

    function prune(state, now) {
        const remaining = state.events.filter(item => item.created + maxAge > now);
        if (remaining.length === state.events.length) return false;
        state.events = remaining;
        state.failure = 'expired';
        return true;
    }

    async function hasPermission(config) {
        try {
            if (!await browser.permissions.contains({ origins: [config.origin] })) return false;
            const granted = await browser.permissions.getAll();
            if (!Object.hasOwn(granted, 'data_collection')) return true;
            return granted.data_collection.includes('technicalAndInteraction') &&
                (!(config.indicators || config.details) || granted.data_collection.includes('personalCommunications'));
        } catch (_) { return false; }
    }

    function enabled(config) {
        return !!config && !config.invalid && config.mode !== 'off';
    }

    async function status(config) {
        if (config?.invalid) return { state: 'invalid' };
        if (!enabled(config)) return { state: 'off' };
        const [saved, permission] = await Promise.all([read(config), hasPermission(config)]);
        const state = !saved.credential ? 'consent' : !permission ? 'permission' : 'ready';
        const now = Date.now();
        const pending = saved.events.filter(item => item.created + maxAge > now);
        const oldest = pending.reduce((first,item) => !first || item.created < first.created ? item : first,null);
        return {
            state, endpoint: config.endpoint, origin: config.origin, mode: config.mode,
            indicators: config.indicators, details: config.details, detections: config.detections === true, queued: pending.length,
            lastReceiptAt: saved.lastReceiptAt ?? null, lastReceiptId: saved.lastReceiptId ?? null,
            oldestPendingAt: oldest?.created ?? null, oldestPendingId: oldest?.event.id ?? null,
            failure: storageError ? 'storage' : saved.authRejected ? 'authentication' : saved.failure
        };
    }

    async function configure(config, request) {
        if (request.op === 'disableReporting') {
            activeRequest?.abort();
            await serialize(() => browser.storage.local.remove(key));
            return;
        }
        if (!enabled(config) || request.consent !== true || (config.details && request.details !== true) ||
            (config.detections && request.detections !== true) || !tokenPattern.test(request.credential || '') ||
            request.endpoint !== config.endpoint || !await hasPermission(config)) {
            throw Object.assign(new Error('REPORTING_SETUP_INVALID'), { code: 'REPORTING_SETUP_INVALID' });
        }
        activeRequest?.abort();
        await serialize(async () => {
            const saved = await read(config);
            saved.credential = request.credential;
            saved.failure = null;
            saved.authRejected = false;
            await save(saved);
        });
        wake();
    }

    function projectDetails({ kind, reason, score, threshold, name, evidence, includeDetections }) {
        const numericScore = value => Number.isFinite(value) && value >= 0 && value <= 100;
        const details = { reason };
        if (numericScore(score)) details.score = score;
        if (numericScore(threshold)) details.threshold = threshold;
        if (kind !== 'link_open' && typeof name === 'string' && name) {
            details.attachmentName = Array.from(name.toWellFormed()).slice(0,180).join('');
        }
        const providers = [];
        for (const entry of Array.isArray(evidence) ? evidence : []) {
            if (!['hybridanalysis','urlscan','virustotal'].includes(entry?.provider) ||
                !['malicious','suspicious','no_detection'].includes(entry.verdict) ||
                !['live','stored','archive'].includes(entry.source) ||
                providers.some(row => row.provider === entry.provider)) continue;
            const row = { provider:entry.provider, verdict:entry.verdict, source:entry.source };
            if (Number.isFinite(entry.observedAt) && entry.observedAt >= 0 && entry.observedAt <= 8640000000000000) {
                row.observedAt = new Date(entry.observedAt).toISOString();
            }
            if (entry.provider === 'hybridanalysis') {
                if (numericScore(entry.score)) row.score = entry.score;
                if (/^[a-f0-9]{64}$/i.test(entry.reference || '')) {
                    row.reference = entry.reference.toLowerCase();
                    row.reportUrl = 'https://www.hybrid-analysis.com/sample/' + row.reference;
                }
                if (/^[a-z0-9_-]{1,128}$/i.test(entry.jobId || '') &&
                    !['MANUAL_CHECK','PENDING_UPLOAD','N/A'].includes(entry.jobId)) row.jobId = entry.jobId;
            } else if (entry.provider === 'urlscan' && uuid.test(entry.reference || '')) {
                row.reference = entry.reference.toLowerCase();
                row.reportUrl = 'https://urlscan.io/result/' + row.reference + '/';
            } else if (entry.provider === 'virustotal') {
                for (const key of ['maliciousCount','suspiciousCount']) {
                    if (Number.isSafeInteger(entry[key]) && entry[key] >= 0) row[key] = entry[key];
                }
            }
            if (includeDetections && row.verdict !== 'no_detection') {
                const detections = ThundyProviderResults.projectDetections(entry.detections).filter(entry =>
                    entry.kind !== 'brand' || row.provider === 'urlscan' && row.verdict === 'malicious');
                if (detections.length) row.detections = detections;
            }
            providers.push(row);
        }
        details.providers = providers;
        return details;
    }

    async function capture({ id, kind, mode, reason, finding, indicator, score, threshold, name, evidence }) {
        const policy = await ThundyManagedPolicy.read();
        const config = policy.reporting;
        if (!enabled(config) || !uuid.test(id || '') || !['link_open','attachment_open','attachment_save'].includes(kind) ||
            !(kind === 'link_open' ? policy.links : policy.attachments) ||
            (reason !== 'malicious' && !(reason === 'threshold' && config.mode === 'suspicious'))) return;
        try {
            const queued = await serialize(async () => {
                const saved = await read(config);
                if (!saved.credential || !await hasPermission(config)) return false;
                const now = Date.now();
                const pruned = prune(saved, now);
                if (saved.events.some(entry => entry.event.id === id)) {
                    if (pruned) await save(saved);
                    return false;
                }
                if (saved.events.length >= maxEvents) {
                    saved.failure = 'full';
                    await save(saved);
                    return false;
                }
                const event = {
                    schemaVersion: 1, id, observedAt: new Date(now).toISOString(), action: kind,
                    finding: reason === 'threshold' ? 'suspicious' : finding,
                    decision: mode, policyRevision: policy.revision
                };
                if (config.indicators && indicator) {
                    if (kind === 'link_open') event.hostname = new URL(indicator).hostname;
                    else if (/^[a-f0-9]{64}$/i.test(indicator)) event.sha256 = indicator.toLowerCase();
                }
                if (config.details) {
                    event.details = projectDetails({kind,reason,score,threshold,name,evidence,includeDetections:config.detections});
                    if (event.details.providers.some(row => row.detections)) event.schemaVersion = 2;
                }
                saved.events.push({ event, created: now, attempts: 0, next: now });
                await save(saved);
                return true;
            });
            if (queued) wake();
        } catch (_) { storageError = true; }
    }

    async function send(config, credential, item, controller) {
        const deadline = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(config.endpoint, {
                method: 'POST', body: JSON.stringify(item.event), signal: controller.signal,
                credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential}`, 'Idempotency-Key': item.event.id }
            });
            if (response.ok) return { sent: true };
            if (response.status === 408 || response.status === 429 || response.status >= 500) {
                const header = response.headers.get('Retry-After');
                const retryAt = /^\d+$/.test(header || '') ? Date.now() + Number(header) * 1000 : Date.parse(header);
                return { retry: true, retryAt };
            }
            return { failure: response.status === 401 || response.status === 403 ? 'authentication' : 'rejected' };
        } catch (_) {
            return { retry: true };
        } finally { clearTimeout(deadline); }
    }

    async function drain() {
        const { reporting: config } = await ThundyManagedPolicy.read();
        if (!enabled(config)) return;
        while (true) {
            const pending = await serialize(async () => {
                const saved = await read(config);
                const now = Date.now();
                if (prune(saved, now)) await save(saved);
                if (!saved.credential || saved.authRejected || !await hasPermission(config)) return null;
                const item = saved.events.find(entry => entry.next <= now);
                if (!item) return null;
                const controller = new AbortController();
                activeRequest = controller;
                return { item, credential: saved.credential, controller };
            });
            if (!pending) return;
            const { item, credential, controller } = pending;
            const result = controller.signal.aborted ? null : await send(config, credential, item, controller);
            if (activeRequest === controller) activeRequest = null;
            if (!result) return;
            await serialize(async () => {
                const saved = await read(config);
                const entry = saved.events.find(entry => entry.event.id === item.event.id);
                if (!entry || saved.credential !== credential) return;
                if (result.retry) {
                    entry.attempts++;
                    const next = Date.now() + Math.min(60 * 60 * 1000, 60000 * 2 ** Math.min(entry.attempts - 1, 6));
                    entry.next = Math.min(entry.created + maxAge, Math.max(next, result.retryAt || 0));
                } else if (result.failure === 'authentication') {
                    saved.authRejected = true;
                } else {
                    saved.events = saved.events.filter(entry => entry.event.id !== item.event.id);
                    if (result.failure) saved.failure = result.failure;
                    if (result.sent) {
                        saved.lastReceiptAt = Date.now();
                        saved.lastReceiptId = item.event.id;
                    }
                }
                await save(saved);
            });
            if (result.failure === 'authentication') return;
        }
    }

    function wake() {
        if (!delivery) delivery = drain().catch(() => { storageError = true; }).finally(() => { delivery = null; });
        return delivery;
    }

    function initialize() {
        browser.alarms.onAlarm.addListener(event => { if (event.name === alarm) void wake(); });
        browser.permissions.onAdded?.addListener(() => { void wake(); });
        browser.permissions.onRemoved?.addListener(() => { activeRequest?.abort(); });
        ThundyManagedPolicy.read().then(async ({ reporting }) => {
            await serialize(async () => {
                const saved = (await browser.storage.local.get(key))[key];
                if (saved && (!enabled(reporting) || saved.configuration !== fingerprint(reporting))) {
                    await browser.storage.local.remove(key);
                }
            });
            if (!enabled(reporting)) return;
            await browser.alarms.create(alarm, { periodInMinutes: 1 });
            await wake();
        }).catch(() => { storageError = true; });
    }

    return { initialize, capture, status, configure };
})();
