/* Shared, local-only provenance. Never store URLs, hashes, IPs, keys or mail text here. */
const ThundyAnalysis = (() => {
    const providers = ['hybridanalysis', 'virustotal', 'urlhaus', 'abuseipdb', 'urlscan'];
    const scopes = ['hash', 'file', 'url', 'domain', 'ip', 'report'];
    const states = ['running', 'checked', 'received', 'submitted', 'not_found', 'failed', 'incomplete'];
    const verdicts = ['unknown', 'none', 'suspicious', 'malicious'];
    const times = new Map();
    function cacheTime(provider, scope, key, write = false) {
        const id = provider + ':' + scope + ':' + key;
        if (write) { if (times.size >= 5000) times.delete(times.keys().next().value); times.set(id, Number.isFinite(write) && typeof write === 'number' ? write : Date.now()); }
        const time = times.get(id); return Number.isFinite(time) && Date.now() - time < 900000 ? time : null;
    }
    function spec(address, method = 'GET') {
        let url; try { url = new URL(address); } catch (_) { return null; }
        const host = url.hostname, path = url.pathname;
        if (host === 'hybrid-analysis.com' || host.endsWith('.hybrid-analysis.com')) return { provider: 'hybridanalysis', scope: path.includes('quick-scan/file') ? 'file' : path.includes('quick-scan/url') ? 'url' : path.includes('/report/') ? 'report' : 'hash' };
        if (host === 'virustotal.com' || host.endsWith('.virustotal.com')) return { provider: 'virustotal', scope: path.includes('/ip_addresses/') ? 'ip' : 'hash' };
        if (host === 'urlhaus-api.abuse.ch') return { provider: 'urlhaus', scope: 'domain' };
        if (host === 'api.abuseipdb.com') return { provider: 'abuseipdb', scope: 'ip' };
        if (host === 'urlscan.io' || host.endsWith('.urlscan.io')) return { provider: 'urlscan', scope: 'url' };
        return null;
    }
    function response(info, status, data) {
        const result = { state: 'received', verdict: 'unknown' };
        if (status === 404) return { state: info.provider === 'urlscan' ? 'incomplete' : 'not_found', verdict: 'unknown' };
        if (!(status >= 200 && status < 300)) return { state: 'failed', verdict: 'unknown' };
        if (info.provider === 'hybridanalysis') {
            if ((info.scope === 'file' || info.scope === 'url') && (data?.submission_id || data?.job_id)) return { state: 'submitted', verdict: 'unknown' };
            if (data?.state === 'IN_PROGRESS') return { state: 'incomplete', verdict: 'unknown' };
            const value = typeof data?.verdict === 'string' ? data.verdict.toLowerCase() : '';
            if (['malicious', 'suspicious', 'no specific threat', 'clean'].includes(value)) return { state: 'checked', verdict: ['no specific threat', 'clean'].includes(value) ? 'none' : value };
        }
        if (info.provider === 'virustotal') {
            const stats = data?.data?.attributes?.last_analysis_stats;
            if (Number.isFinite(stats?.malicious)) return { state: 'checked', verdict: stats.malicious > 0 ? 'malicious' : stats.suspicious > 0 ? 'suspicious' : 'none' };
        }
        if (info.provider === 'urlhaus' && ['ok', 'no_results'].includes(data?.query_status)) return { state: 'checked', verdict: data.query_status === 'ok' && data.url_count > 0 ? 'malicious' : 'none' };
        if (info.provider === 'abuseipdb' && Number.isFinite(data?.data?.abuseConfidenceScore)) return { state: 'checked', verdict: data.data.abuseConfidenceScore > 50 ? 'malicious' : 'none' };
        if (info.provider === 'urlscan') {
            if (typeof data?.uuid === 'string' && !data?.verdicts) return { state: 'submitted', verdict: 'unknown' };
            if (typeof data?.verdicts?.overall?.malicious === 'boolean' || typeof data?.verdicts?.urlscan?.malicious === 'boolean') return { state: 'checked', verdict: data.verdicts.overall?.malicious || data.verdicts.urlscan?.malicious ? 'malicious' : 'none' };
        }
        return result;
    }
    const worst = (a, b) => verdicts[Math.max(verdicts.indexOf(a), verdicts.indexOf(b), 0)];
    function create(stored = {}) {
        const data = { schemaVersion: 1, local: { state: 'unrecorded', observedAt: null }, rows: [] };
        if (stored.schemaVersion === 1) {
            if (stored.local?.state === 'checked') data.local = { state: 'checked', observedAt: stored.local.observedAt || null, source: 'stored' };
            for (const old of (Array.isArray(stored.rows) ? stored.rows : []).slice(0, 30)) if (providers.includes(old.provider) && scopes.includes(old.scope)) {
                const row = { provider: old.provider, scope: old.scope, source: 'stored', active: 0, state: states.includes(old.state) && old.state !== 'running' ? old.state : 'incomplete', verdict: verdicts.includes(old.verdict) ? old.verdict : 'unknown', responses: Number.isSafeInteger(old.responses) && old.responses > 0 ? Math.min(old.responses, 100000) : 0, failures: Number.isSafeInteger(old.failures) && old.failures > 0 ? Math.min(old.failures, 100000) : 0, cacheHits: Number.isSafeInteger(old.cacheHits) && old.cacheHits > 0 ? Math.min(old.cacheHits, 100000) : 0, observedAt: Number.isFinite(old.observedAt) ? old.observedAt : null, findingAt: Number.isFinite(old.findingAt) ? old.findingAt : null, attemptedAt: Number.isFinite(old.attemptedAt) ? old.attemptedAt : null };
                data.rows.push(row);
            }
        }
        function event(e) {
            if (!e || !providers.includes(e.provider) || !scopes.includes(e.scope) || !['start', 'finish', 'cache'].includes(e.phase)) return false;
            if (e.phase !== 'start' && (!states.includes(e.state) || !verdicts.includes(e.verdict))) return false;
            let row = data.rows.find(r => r.provider === e.provider && r.scope === e.scope);
            if (!row) { row = { provider: e.provider, scope: e.scope, state: 'running', verdict: 'unknown', active: 0, responses: 0, failures: 0, cacheHits: 0, observedAt: null, attemptedAt: null }; data.rows.push(row); }
            if (e.phase === 'start') { row.active++; row.attemptedAt = Date.now(); row.state = 'running'; return true; }
            if (e.phase === 'finish') row.active = Math.max(0, row.active - 1);
            if (e.phase === 'cache') { row.cacheHits++; row.source = 'cache'; }
            else row.source = e.responded ? 'remote' : row.responses ? row.source : 'attempt';
            if (e.state === 'failed') row.failures++;
            else row.responses++;
            if (e.state !== 'failed' && Number.isFinite(e.observedAt)) row.observedAt = Math.max(row.observedAt || 0, e.observedAt);
            if (e.verdict !== 'unknown' && verdicts.indexOf(e.verdict) >= verdicts.indexOf(row.verdict)) row.findingAt = Number.isFinite(e.observedAt) ? e.observedAt : row.findingAt || null;
            row.verdict = worst(row.verdict, e.verdict);
            row.state = row.active ? 'running' : e.state;
            return true;
        }
        return { data, event };
    }
    function legacy(record) {
        const model = create(record?.analysisStatus);
        const documented = new Set(model.data.rows.map(row => row.provider + ':' + row.scope));
        for (const item of [...(Array.isArray(record?.attachments) ? record.attachments : []), ...(Array.isArray(record?.links) ? record.links : [])]) {
            const report = item.report;
            if (report || ['KNOWN', 'UPLOADED'].includes(item.state)) {
                const info = { provider: 'hybridanalysis', scope: report ? 'report' : item.url ? 'url' : item.state === 'UPLOADED' ? 'file' : 'hash' };
                if (!documented.has(info.provider + ':' + info.scope)) model.event({ ...info, phase: 'cache', ...(report ? response(info, 200, report) : { state: item.state === 'UPLOADED' ? 'submitted' : 'received', verdict: 'unknown' }), observedAt: report && Number.isFinite(Date.parse(item.report_fetched_at)) ? Date.parse(item.report_fetched_at) : null });
            }
            if (!documented.has('virustotal:hash') && Number.isFinite(item.virustotal_stats?.malicious)) model.event({ provider: 'virustotal', scope: 'hash', phase: 'cache', state: 'checked', verdict: item.virustotal_stats.malicious > 0 ? 'malicious' : item.virustotal_stats.suspicious > 0 ? 'suspicious' : 'none', observedAt: null });
        }
        for (const row of model.data.rows) row.source = 'stored';
        return model.data;
    }
    // Self-contained renderer: serialized into the message's isolated world too.
    function render(data, labels, theme = '') {
        const document = globalThis.document;
        if (document.documentElement.dataset.thundyAnalysisMessage && document.documentElement.dataset.thundyAnalysisMessage !== String(data.messageId)) return null;
        const previous = document.getElementById('thundy-analysis-status');
        const open = previous?.shadowRoot?.querySelector('details')?.open || false;
        const focus = previous?.shadowRoot?.activeElement?.tagName === 'SUMMARY';
        previous?.remove();
        const host = document.createElement('section'); host.id = 'thundy-analysis-status';
        host.setAttribute('aria-label', labels.analysisTitle); host.style.cssText = 'all:initial!important;display:block!important;visibility:visible!important;opacity:1!important;margin:12px!important;' + theme.split(';').filter(Boolean).map(rule => rule + '!important').join(';');
        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style'); style.textContent = ':host{font:14px/1.5 system-ui,sans-serif;color:var(--text-color,#192b40)}*{box-sizing:border-box}.card{font:14px/1.5 system-ui,sans-serif;color:var(--text-color,#192b40);padding:var(--surface-pad,18px);border:1px solid var(--card-border,#cbd5e1);border-left:4px solid var(--link-color,#146b80);border-radius:12px;background:var(--card-bg,#fff);overflow-wrap:anywhere}h2{font:700 16px/1.4 system-ui;margin:0 0 8px}p{margin:6px 0}.mode{font-weight:700}.muted,small{color:var(--text-muted,#536579)}ul{padding-left:20px;margin:8px 0}li{margin:8px 0}summary{cursor:pointer;font-weight:600}summary:focus-visible{outline:3px solid var(--link-color,#146b80);outline-offset:3px}.warning{color:var(--color-danger,#b32642)}';
        const n = (tag, text, cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
        const t = key => labels[key] || labels.analysisUnknown;
        const date = value => Number.isFinite(value) ? new Date(value).toLocaleString(document.documentElement.lang || undefined) : t('analysisTimeUnknown');
        const rows = data.rows || [], external = rows.some(row => row.responses > 0 || row.cacheHits > 0), local = data.local?.state === 'checked';
        const card = n('div', '', 'card'); card.append(n('h2', t('analysisTitle')), n('p', t(data.unavailable ? 'analysisUnavailable' : external ? local ? 'analysisMixed' : 'analysisExternal' : 'analysisLocal'), 'mode'));
        const status = n('p', t(local ? 'analysisLocalChecked' : 'analysisLocalPending'), 'muted'); status.setAttribute('role', 'status'); card.append(status);
        const brands = { hybridanalysis: 'Hybrid Analysis', virustotal: 'VirusTotal', urlhaus: 'URLhaus', abuseipdb: 'AbuseIPDB', urlscan: 'urlscan.io' };
        const list = document.createElement('ul'), inactive = document.createElement('ul');
        for (const [provider, brand] of Object.entries(brands)) {
            const items = rows.filter(row => row.provider === provider), li = document.createElement('li'); li.append(n('strong', brand));
            if (items.length) {
                if (['disabled','permission','authorization','policy','unconfigured'].includes(data.availability?.[provider])) li.append(n('div', t('analysisReason_' + data.availability[provider]), 'muted'));
                const scopes = document.createElement('ul');
                for (const row of items) {
                    const entry = document.createElement('li');
                    entry.append(n('span', t('analysisScope_' + row.scope) + ' · ' + t('analysisState_' + row.state) + ' · ' + t('analysisSource_' + row.source)));
                    if (row.verdict && row.verdict !== 'unknown') entry.append(n('div', t('analysisVerdict_' + row.verdict), row.verdict === 'malicious' || row.verdict === 'suspicious' ? 'warning' : ''));
                    entry.append(n('div', t('analysisFindingObserved') + ': ' + date(row.findingAt)));
                    entry.append(n('small', t('analysisObserved') + ': ' + date(row.observedAt) + ' · ' + t('analysisAttempted') + ': ' + date(row.attemptedAt)));
                    if (row.failures && row.responses) entry.append(n('div', t('analysisPartial'), 'warning'));
                    scopes.append(entry);
                }
                li.append(scopes); list.append(li);
            } else { li.append(n('div', t('analysisReason_' + (data.availability?.[provider] || 'unrecorded')), 'muted')); inactive.append(li); }
        }
        if (rows.some(row => ['malicious','suspicious'].includes(row.verdict))) { card.style.borderColor = 'var(--color-danger,#b32642)'; card.append(n('p', t(rows.some(row => row.verdict === 'malicious') ? 'analysisVerdict_malicious' : 'analysisVerdict_suspicious'), 'warning')); }
        card.append(list);
        if (inactive.childElementCount) { const details = document.createElement('details'); details.open = open; details.append(n('summary', t('analysisOtherServices')), inactive); card.append(details); }
        card.append(n('p', t('analysisLimit'), 'muted')); root.append(style, card);
        const mount = document.getElementById('analysisSourceMount'); if (mount) mount.append(host); else document.body.prepend(host);
        if (focus) root.querySelector('summary')?.focus();
        return host;
    }
    function withCache(context, provider, scope, key) {
        if (!context) return context;
        return { cached: (...args) => context.cached?.(...args), event(event) {
            if (event.phase === 'finish' && event.state !== 'failed' && Number.isFinite(event.observedAt)) cacheTime(provider, scope, key, event.observedAt);
            return context.event(event);
        } };
    }
    function labels(get) {
        const keys = ['analysisUnavailable','analysisTitle','analysisUnknown','analysisTimeUnknown','analysisMixed','analysisExternal','analysisLocal','analysisLocalChecked','analysisLocalPending','analysisObserved','analysisFindingObserved','analysisAttempted','analysisPartial','analysisOtherServices','analysisLimit'];
        for (const [prefix, values] of [['Scope',scopes],['State',states],['Source',['remote','cache','stored','attempt']],['Verdict',verdicts],['Reason',['unconfigured','disabled','permission','authorization','policy','on_action','unrecorded']]]) for (const value of values) keys.push('analysis'+prefix+'_'+value);
        return Object.fromEntries(keys.map(key => [key, get(key)]));
    }
    return { providers, scopes, create, spec, response, legacy, render, cacheTime, labels, withCache };
})();
