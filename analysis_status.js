/* Shared, local-only provenance. Never store URLs, hashes, IPs, keys or mail text here. */
const ThundyAnalysis = (() => {
    const providers = typeof ThundyProviders !== 'undefined' ? Object.keys(ThundyProviders.registry) : ['hybridanalysis', 'virustotal', 'urlhaus', 'abuseipdb', 'urlscan'];
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
        if(typeof ThundyProviders !== 'undefined'){try{const {provider,scope}=ThundyProviders.identify(address,method);return {provider,scope};}catch(_){return null;}}
        let url; try { url = new URL(address); } catch (_) { return null; }
        const host = url.hostname, path = url.pathname;
        if (host === 'hybrid-analysis.com' || host.endsWith('.hybrid-analysis.com')) return { provider: 'hybridanalysis', scope: path.includes('quick-scan/file') ? 'file' : path.includes('quick-scan/url') ? 'url' : (path.includes('/report/') || path.includes('/quick-scan/')) ? 'report' : 'hash' };
        if (host === 'virustotal.com' || host.endsWith('.virustotal.com')) return { provider: 'virustotal', scope: path.includes('/ip_addresses/') ? 'ip' : 'hash' };
        if (host === 'urlhaus-api.abuse.ch') return { provider: 'urlhaus', scope: 'domain' };
        if (host === 'api.abuseipdb.com') return { provider: 'abuseipdb', scope: 'ip' };
        if (host === 'urlscan.io' || host.endsWith('.urlscan.io')) return { provider: 'urlscan', scope: 'url' };
        return null;
    }
    function uiText(key, fallback, params = []) {
        try {
            if (typeof ThundyI18n !== 'undefined' && typeof ThundyI18n.get === 'function') {
                const translated = ThundyI18n.get(key, params);
                if (translated && translated !== key) return translated;
            }
            if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
                const translated = browser.i18n.getMessage(key, params);
                if (translated) return translated;
            }
        } catch (_) {}
        if (params && params.length && typeof fallback === 'string') {
            return params.reduce((text, value, i) => text.replaceAll('$' + (i + 1), String(value)), fallback);
        }
        return fallback || key;
    }
    function response(info, status, data) {
        const result = { state: 'received', verdict: 'unknown' };
        if(info.provider==='urlscan'&&status===400){
            const errorCode=ThundyProviderResults.urlscanRejection(data);
            const messages={domain_unresolvable:['urlscanDnsError','The provider could not resolve the target domain.'],invalid_request:['urlscanInvalidRequest','The provider rejected invalid submission parameters.'],submission_rejected:['urlscanSubmissionRejected','The provider rejected the submission; the response does not establish a DNS failure.']};
            return {state:'failed',verdict:'unknown',errorCode,errorDetails:uiText(...messages[errorCode])};
        }
        if (status === 404) {
            if (info.provider === 'urlscan') return { state: 'incomplete', verdict: 'unknown' };
            let errorDetails = null;
            if (info.provider === 'virustotal') errorDetails = uiText('virustotalNotFound', 'Element not yet recorded in VirusTotal database.');
            else if (info.provider === 'hybridanalysis') errorDetails = uiText('hybridNotFound', 'Element not yet recorded in Hybrid Analysis (no previous analysis found).');
            return { state: 'not_found', verdict: 'unknown', ...(errorDetails ? { errorDetails } : {}) };
        }
        if (status === 429) {
            const retrySeconds = (data && typeof data === 'object' && Number.isFinite(data.retry_after) && data.retry_after > 0) ? Math.ceil(data.retry_after) : null;
            let errorDetails = retrySeconds
                ? uiText('rateLimitWithWait', `Rate limit or quota reached. Please try again in ${retrySeconds} seconds.`, [retrySeconds])
                : 'Rate limit or quota reached';
            if (!retrySeconds) {
                if (info.provider === 'virustotal') errorDetails = uiText('virustotalRateLimited', 'The VirusTotal rate limit or quota was reached. Please try again later.');
                else if (info.provider === 'abuseipdb') errorDetails = uiText('abuseipdbRateLimited', 'The AbuseIPDB rate limit or quota was reached. Please try again later.');
                else if (info.provider === 'urlhaus') errorDetails = uiText('urlhausRateLimited', 'The URLhaus rate limit or quota was reached. Please try again later.');
                else if (info.provider === 'urlscan') errorDetails = uiText('urlscanRateLimited', 'The urlscan.io rate limit or quota was reached. Please try again later.');
            }
            return {
                state: 'failed',
                verdict: 'unknown',
                errorCode: 'rate_limited',
                errorDetails,
                ...(retrySeconds ? { retryAfter: retrySeconds } : {})
            };
        }
        if (status === 401 || status === 403) {
            let errorDetails = 'Invalid API key';
            if (info.provider === 'virustotal') errorDetails = uiText('virustotalInvalidKey', 'Invalid or unauthorized VirusTotal API key.');
            else if (info.provider === 'abuseipdb') errorDetails = uiText('abuseipdbInvalidKey', 'Invalid or unauthorized AbuseIPDB API key.');
            else if (info.provider === 'urlhaus') errorDetails = uiText('urlhausInvalidKey', 'Invalid or unauthorized URLhaus API key.');
            else if (info.provider === 'urlscan') errorDetails = uiText('urlscanInvalidKey', 'Invalid or unauthorized urlscan.io API key.');
            return { state: 'failed', verdict: 'unknown', errorCode: 'invalid_key', errorDetails };
        }
        if (!(status >= 200 && status < 300)) return { state: 'failed', verdict: 'unknown' };
        if (['hybridanalysis','urlscan'].includes(info.provider)) { const a=ThundyProviderResults.evaluate(info.provider,data,info.scope);return {state:a.state,verdict:a.verdict}; }
        if (info.provider === 'virustotal') {
            const stats = data?.data?.attributes?.last_analysis_stats || data?.attributes?.last_analysis_stats || data?.last_analysis_stats;
            if (Number.isFinite(stats?.malicious)) return { state: 'checked', verdict: stats.malicious > 0 ? 'malicious' : stats.suspicious > 0 ? 'suspicious' : 'none' };
        }
        if (info.provider === 'urlhaus') {
            if (data?.query_status === 'invalid_api_key') {
                return { state: 'failed', verdict: 'unknown', errorCode: 'invalid_key', errorDetails: uiText('urlhausInvalidKey', 'Invalid or unauthorized URLhaus API key.') };
            }
            if (['host_not_found', 'not_found'].includes(data?.query_status)) {
                return { state: 'not_found', verdict: 'unknown' };
            }
            if (['ok', 'no_results'].includes(data?.query_status)) {
                const hasHit = data.query_status === 'ok' && (Number(data.url_count) > 0 || (Array.isArray(data.urls) && data.urls.length > 0) || Boolean(data.url_status || data.threat));
                return { state: 'checked', verdict: hasHit ? 'malicious' : 'none' };
            }
        }
        if (info.provider === 'abuseipdb' && Number.isFinite(data?.data?.abuseConfidenceScore)) {
            const score = data.data.abuseConfidenceScore;
            const whitelisted = data.data.isWhitelisted === true;
            return { state: 'checked', verdict: whitelisted ? 'none' : score > 50 ? 'malicious' : score >= 25 ? 'suspicious' : 'none' };
        }
        return result;
    }
    const worst = (a, b) => verdicts[Math.max(verdicts.indexOf(a), verdicts.indexOf(b), 0)];
    // References point into existing message records; never duplicate resource contents.
    const validResource = ref => ref === 'message' || typeof ref === 'string' && (/^attachment:[0-9]+(?:\.[0-9]+)*$/.test(ref) && ref.length <= 80 || /^link:[0-9]{1,6}$/.test(ref));
    const rowKey = row => [row.provider, row.scope, row.resource || 'unknown'].join(':');
    const storedObject = value => value && typeof value === 'object' && !Array.isArray(value);
    // Read-only projection: preserve link slots before skipping invalid entries.
    function resources(record) {
        let incomplete = record != null && !storedObject(record) || record?.sourceDataIncomplete === true;
        const read = (value, links = false) => {
            if (value == null) return [];
            if (!Array.isArray(value)) { incomplete = true; return []; }
            return value.flatMap((item,index) => {
                if (!storedObject(item)) { incomplete = true; return []; }
                return [links ? {...item,analysisResourceRef:validResource(item.analysisResourceRef) ? item.analysisResourceRef : 'link:' + index} : item];
            });
        };
        const attachments = read(record?.attachments), links = read(record?.links,true);
        return {...(storedObject(record) ? record : {}),attachments,links,...(incomplete ? {sourceDataIncomplete:true} : {})};
    }
    function create(stored = {}) {
        const invalidRoot = stored != null && !storedObject(stored);
        if (!storedObject(stored)) stored = {};
        const data = { schemaVersion: 2, local: { state: 'unrecorded', observedAt: null }, rows: [], truncated: stored.truncated === true };
        if (invalidRoot || stored.sourceDataIncomplete === true) data.sourceDataIncomplete = true;
        if ([1, 2].includes(stored.schemaVersion)) {
            if (stored.rows != null && !Array.isArray(stored.rows)) data.sourceDataIncomplete = true;
            if (['checked','incomplete','failed'].includes(stored.local?.state)) data.local = { state: stored.local.state, observedAt: Number.isFinite(stored.local.observedAt) ? stored.local.observedAt : null, source: 'stored', ...(['decryption_unavailable','text_unavailable','read_failed'].includes(stored.local.reason) ? {reason:stored.local.reason} : {}) };
            for (const old of (Array.isArray(stored.rows) ? stored.rows : []).slice(0, 1200)) {
                if (!storedObject(old) || !providers.includes(old.provider) || !scopes.includes(old.scope)) { data.sourceDataIncomplete = true; continue; }
                const row = { provider: old.provider, scope: old.scope, resource: validResource(old.resource) ? old.resource : null, source: 'stored', active: 0, state: states.includes(old.state) && old.state !== 'running' ? old.state : 'incomplete', verdict: verdicts.includes(old.verdict) ? old.verdict : 'unknown', responses: Number.isSafeInteger(old.responses) && old.responses > 0 ? Math.min(old.responses, 100000) : 0, failures: Number.isSafeInteger(old.failures) && old.failures > 0 ? Math.min(old.failures, 100000) : 0, cacheHits: Number.isSafeInteger(old.cacheHits) && old.cacheHits > 0 ? Math.min(old.cacheHits, 100000) : 0, observedAt: Number.isFinite(old.observedAt) ? old.observedAt : null, findingAt: Number.isFinite(old.findingAt) ? old.findingAt : null, attemptedAt: Number.isFinite(old.attemptedAt) ? old.attemptedAt : null, errorCode: typeof old.errorCode === 'string' ? old.errorCode.slice(0, 50) : null, errorDetails: typeof old.errorDetails === 'string' ? old.errorDetails.slice(0, 200) : null, retryAfter: Number.isFinite(old.retryAfter) ? old.retryAfter : null };
                Object.assign(row,ThundyProviderResults.project(old));
                if(typeof old.providerJobId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(old.providerJobId))row.providerJobId=old.providerJobId;
                for(const key of ['httpStatus','maliciousCount','suspiciousCount','totalCount','providerScore','reportCount']) if(Number.isFinite(old[key])&&old[key]>=0)row[key]=old[key];
                if(typeof old.providerVerdict==='string'&&/^[a-z _-]{1,40}$/i.test(old.providerVerdict))row.providerVerdict=old.providerVerdict;
                if (!data.rows.some(current => rowKey(current) === rowKey(row))) data.rows.push(row);
            }
            if (stored.rows?.length > 1200) data.truncated = true;
        }
        function event(e) {
            if (!e || !providers.includes(e.provider) || !scopes.includes(e.scope) || !['start', 'finish', 'cache', 'assessment'].includes(e.phase) || e.resource != null && !validResource(e.resource)) return false;
            if (e.phase !== 'start' && (!states.includes(e.state) || !verdicts.includes(e.verdict))) return false;
            if(e.phase==='assessment'&&e.assessmentVersion!==1)return false;
            const resource = e.resource || null;
            let row = data.rows.find(r => r.provider === e.provider && r.scope === e.scope && r.resource === resource);
            if (!row) {
                if(e.phase==='assessment')return false;
                if (data.rows.length >= 1200) { data.truncated = true; return false; }
                row = { provider: e.provider, scope: e.scope, resource, state: 'running', verdict: 'unknown', source: 'attempt', active: 0, responses: 0, failures: 0, cacheHits: 0, observedAt: null, attemptedAt: null };
                data.rows.push(row);
            }
            if (e.phase === 'start') { row.active++; row.attemptedAt = Date.now(); row.state = 'running'; return true; }
            if (e.phase === 'finish') row.active = Math.max(0, row.active - 1);
            if (e.phase === 'cache') { row.cacheHits++; row.source = 'cache'; }
            else if(e.phase!=='assessment')row.source = e.responded ? 'remote' : row.responses ? row.source : 'attempt';
            if(e.phase!=='assessment'){if (e.state === 'failed') row.failures++;
            else row.responses++;}
            Object.assign(row,ThundyProviderResults.project(ThundyProviderResults.merge(row,e)));
            if(e.state==='failed'&&row.assessmentVersion)row.completion='failed';
            if(typeof e.providerJobId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(e.providerJobId))row.providerJobId=e.providerJobId;
            for(const key of ['httpStatus','maliciousCount','suspiciousCount','totalCount','providerScore','reportCount']) if(Number.isFinite(e[key])&&e[key]>=0)row[key]=e[key];
            if(typeof e.providerVerdict==='string'&&/^[a-z _-]{1,40}$/i.test(e.providerVerdict))row.providerVerdict=e.providerVerdict;
            if (e.errorCode && typeof e.errorCode === 'string') row.errorCode = e.errorCode;
            if (e.errorDetails && typeof e.errorDetails === 'string') row.errorDetails = e.errorDetails;
            if (Number.isFinite(e.retryAfter) && e.retryAfter > 0) row.retryAfter = e.retryAfter;
            if (e.state !== 'failed' && Number.isFinite(e.observedAt)) row.observedAt = Math.max(row.observedAt || 0, e.observedAt);
            if (e.verdict !== 'unknown' && verdicts.indexOf(e.verdict) >= verdicts.indexOf(row.verdict)) row.findingAt = Number.isFinite(e.observedAt) ? e.observedAt : row.findingAt || null;
            row.verdict = worst(row.verdict, e.verdict);
            row.state = row.active ? 'running' : e.state;
            return true;
        }
        return { data, event };
    }
    function legacy(record) {
        record = resources(record);
        const model = create(record?.analysisStatus);
        if (record.sourceDataIncomplete) model.data.sourceDataIncomplete = true;
        const documented = new Set(model.data.rows.map(rowKey));
        const attachments = Array.isArray(record?.attachments) ? record.attachments : [];
        const links = Array.isArray(record?.links) ? record.links : [];
        for (const [item, resource] of [...attachments.map(item => [item, validResource('attachment:' + item.partName) ? 'attachment:' + item.partName : null]), ...links.map((item,index) => [item, validResource(item.analysisResourceRef) ? item.analysisResourceRef : 'link:' + index])]) {
            const report = item.report;
            const hvVerdict = ({MALICIOUS:'malicious',SUSPICIOUS:'suspicious',CLEAN:'none'})[item.hybrid_verdict?.status];
            if (!report && hvVerdict && item.url) {
                const info = { provider: 'hybridanalysis', scope: 'url', resource };
                if (!documented.has(rowKey(info))) model.event({ ...info, phase: 'cache', state: 'checked', verdict: hvVerdict, observedAt: Number.isFinite(item.hybrid_verdict.observedAt) ? item.hybrid_verdict.observedAt : null });
            } else if (report || ['KNOWN', 'UPLOADED'].includes(item.state)) {
                const info = { provider: 'hybridanalysis', scope: report ? 'report' : item.url ? 'url' : item.state === 'UPLOADED' ? 'file' : 'hash', resource };
                if (!documented.has(rowKey(info)) || report && !model.data.rows.find(r=>rowKey(r)===rowKey(info))?.assessmentVersion) model.event({ ...info, phase: 'cache', ...(report ? ThundyProviderResults.stored('hybridanalysis',item) : { state: item.state === 'UPLOADED' ? 'submitted' : 'received', verdict: 'unknown' }), observedAt: report && Number.isFinite(Date.parse(item.report_fetched_at)) ? Date.parse(item.report_fetched_at) : null });
            }
            const vt = {provider:'virustotal',scope:'hash',resource};
            if (!documented.has(rowKey(vt)) && Number.isFinite(item.virustotal_stats?.malicious)) model.event({ ...vt, phase: 'cache', state: 'checked', verdict: item.virustotal_stats.malicious > 0 ? 'malicious' : item.virustotal_stats.suspicious > 0 ? 'suspicious' : 'none', observedAt: null });
            const us = {provider:'urlscan',scope:'url',resource};
            const usVerdict = item.urlscan?.assessment?.assessmentVersion===1?ThundyProviderResults.stored('urlscan',item.urlscan).verdict:({MALICIOUS_VISUAL:'malicious',MALICIOUS:'malicious',SUSPICIOUS:'suspicious',CLEAN:'none'})[item.urlscan?.status];
            if (!documented.has(rowKey(us)) && usVerdict) model.event({ ...us, phase: 'cache', state: item.urlscan?.status==='ERROR'?'failed':item.urlscan?.assessment?.assessmentVersion===1?ThundyProviderResults.stored('urlscan',item.urlscan).state:'checked', verdict: usVerdict, ...(item.urlscan?.errorCode?{errorCode:item.urlscan.errorCode}:{}), ...ThundyProviderResults.project(item.urlscan?.assessment),observedAt: Number.isFinite(item.urlscan?.observedAt) ? item.urlscan.observedAt : null });
        }
        for (const row of model.data.rows) row.source = 'stored';
        return model.data;
    }
    function bind(context, resources) {
        if (!context) return null;
        const refs = [...new Set(resources.filter(ref => ref == null || validResource(ref)))];
        const apply = event => {
            if (!refs.length) return context.event(event);
            let valid = false;
            for (const resource of refs) valid = context.event({...event, resource}) || valid;
            return valid;
        };
        return {event:apply, cached(provider,scope,verdict,observedAt) { return apply({provider,scope,verdict,observedAt,phase:'cache',state:verdict === 'unknown' ? 'received' : 'checked'}); }};
    }
    function history(record, excludeId = null) {
        const result = {rows:[],truncated:false}, seen = new Set();
        if (!record) return result;
        record = resources(record);
        if (record.sourceDataIncomplete) result.sourceDataIncomplete = true;
        const add = stored => {
            if (!stored || typeof stored !== 'object') return;
            if (result.rows.length >= 1200) { result.truncated = true; return; }
            const restored = create(stored);
            if (restored.data.sourceDataIncomplete) result.sourceDataIncomplete = true;
            result.truncated ||= restored.data.truncated;
            for (const row of restored.data.rows) {
                const entry = {...row,resource:null,source:'stored'};
                const key = JSON.stringify(entry);
                if (seen.has(key)) continue;
                if (result.rows.length >= 1200) { result.truncated = true; break; }
                seen.add(key);result.rows.push(entry);
            }
        };
        add(legacy({attachments:(record.attachments || []).slice(0,100),links:(record.links || []).slice(0,500)}));
        result.truncated ||= (record.attachments?.length || 0) > 100 || (record.links?.length || 0) > 500;
        add(record.analysisStatusLegacy);add(record.analysisStatus);
        const archived = record.analysisReportArchive;
        if (archived?.schemaVersion === 1 && Array.isArray(archived.entries)) {
            for (const entry of archived.entries.slice(0,128)) {
                if (entry?.resource && ['attachment','link'].includes(entry.kind)) add(legacy({[entry.kind === 'attachment' ? 'attachments' : 'links']:[entry.resource]}));
            }
            result.truncated ||= archived.entries.length > 128;
        }
        for (const map of [record.analysisStatusByMessage,record.analysisSourceSnapshots]) {
            if (!map || typeof map !== 'object') continue;
            let count = 0;
            for (const id in map) {
                if (!Object.prototype.hasOwnProperty.call(map,id)) continue;
                if (id === excludeId && map === record.analysisSourceSnapshots) continue;
                if (++count > 128 || result.rows.length >= 1200) { result.truncated = true; break; }
                add(map === record.analysisSourceSnapshots ? map[id]?.snapshot : map[id]);
            }
        }
        return result;
    }
    // Self-contained renderer: serialized into the message's isolated world too.
    function render(data, labels, theme = '') {
        const document = globalThis.document;
        if (document.documentElement.dataset.thundyAnalysisMessage && document.documentElement.dataset.thundyAnalysisMessage !== String(data.messageId)) return null;
        let host = document.getElementById('thundy-analysis-status');
        const wasPresent = !!host;
        const opened = new Set(Array.from(host?.shadowRoot?.querySelectorAll('details[open]') || []).map(node => node.dataset.key));
        const focused = host?.shadowRoot?.activeElement?.dataset.focusKey;
        const n = (tag, text, cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
        const t = key => labels[key] || labels.analysisUnknown;
        if (!host) { host = document.createElement('section'); host.id = 'thundy-analysis-status'; host.attachShadow({mode:'open'}); }
        host.setAttribute('aria-label', labels.analysisTitle); host.style.cssText = 'all:initial!important;display:block!important;visibility:visible!important;opacity:1!important;margin:12px!important;' + theme.split(';').filter(Boolean).map(rule => rule + '!important').join(';');
        const root = host.shadowRoot;
        let live = root.querySelector('.live');
        if (!live) { live = n('div','','live'); live.setAttribute('role','status'); live.setAttribute('aria-live','polite'); live.setAttribute('aria-atomic','true'); }
        const style = document.createElement('style'); style.textContent = ':host{font:14px/1.5 system-ui,sans-serif;color:var(--text-color,#192b40)}*{box-sizing:border-box}.card{font:14px/1.5 system-ui,sans-serif;color:var(--text-color,#192b40);padding:var(--surface-pad,18px);border:1px solid var(--card-border,#cbd5e1);border-left:4px solid var(--link-color,#146b80);border-radius:12px;background:var(--card-bg,#fff);overflow-wrap:anywhere}h2{font:700 16px/1.4 system-ui;margin:0 0 8px}p{margin:6px 0}.mode,.phase{font-weight:700}.muted,small{color:var(--text-muted,#536579)}ul{padding-left:20px;margin:8px 0}li{margin:8px 0}summary{cursor:pointer}:is(summary,button,li):focus-visible{outline:3px solid var(--link-color,#146b80);outline-offset:3px}.history-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap}button{font:inherit;min-height:44px;padding:8px 12px;color:var(--text-color,#192b40);background:var(--input-bg,#fff);border:1px solid var(--input-border,#8091a5);border-radius:8px;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}.warning{color:var(--color-danger,#b32642)}.live{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}details{margin:8px 0}';
        const date = value => Number.isFinite(value) ? new Date(value).toLocaleString(document.documentElement.lang || undefined) : t('analysisTimeUnknown');
        style.textContent += '.services{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.services>li{min-width:0;margin:0;padding:12px;border:1px solid var(--card-border,#cbd5e1);border-radius:10px;background:var(--input-bg,var(--card-bg,#fff))}.services>li.has-warning{border-color:var(--color-danger,#b32642)}.service-results{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.service-verdict{display:inline-block;padding:3px 8px;border:1px solid currentColor;border-radius:8px;font-weight:600}.service-origin{margin:6px 0;font-size:.95em}';
        const inputRows = Array.isArray(data.rows) ? data.rows : [];
        const rows = inputRows.filter(row => row && typeof row === 'object' && !Array.isArray(row) && Object.prototype.hasOwnProperty.call(data.providerNames || {hybridanalysis:1,virustotal:1,urlhaus:1,abuseipdb:1,urlscan:1},row.provider));
        const sourceDataIncomplete = data.sourceDataIncomplete || data.sourceHistory?.sourceDataIncomplete || data.rows != null && !Array.isArray(data.rows) || rows.length !== inputRows.length;
        const local = data.local?.state === 'checked', localLimited = ['incomplete','failed'].includes(data.local?.state);
        const running = rows.some(row => row.state === 'running'), waiting = rows.some(row => row.state === 'submitted'), incomplete = rows.some(row => row.state === 'incomplete');
        const failures = rows.some(row => row.failures > 0 || row.state === 'failed'), received = rows.some(row => row.responses > 0 || row.cacheHits > 0);
        const usable = rows.some(row => ['none','suspicious','malicious'].includes(row.verdict) && (row.responses > 0 || row.cacheHits > 0));
        const jobBusy=['queued','running'].includes(data.scanJob?.state);
        const mode = t(jobBusy ? 'scanRunning' : data.unavailable ? 'analysisUnavailable' : rows.length ? local || localLimited ? 'analysisMixed' : 'analysisExternal' : local || localLimited ? 'analysisLocal' : 'analysisModeUnknown');
        const phase = t(running ? 'analysisModeRunning' : waiting ? 'analysisModeSubmitted' : failures ? usable ? 'analysisModePartial' : received ? 'analysisModeResponsesFailed' : 'analysisModeFailed' : incomplete ? 'analysisModeIncomplete' : usable ? 'analysisModeResults' : received ? 'analysisModeResponses' : 'analysisModeUnknown');
        const card = n('div', '', 'card'); card.append(n('h2', t('analysisTitle')), n('p', mode, 'mode'));
        if (rows.length) card.append(n('p',phase, failures ? 'phase warning' : 'phase'));
        const localLabel = t(data.local?.state === 'failed' ? 'analysisLocalUnavailable' : localLimited ? 'analysisLocalIncomplete' : local ? 'analysisLocalChecked' : 'analysisLocalPending');
        card.append(n('p', localLabel, localLimited ? 'warning' : 'muted'));
        const brands = data.providerNames || { hybridanalysis: 'Hybrid Analysis', virustotal: 'VirusTotal', urlhaus: 'URLhaus', abuseipdb: 'AbuseIPDB', urlscan: 'urlscan.io' };
        const warningTargets = {};
        const providersByResource = new Map();
        for (const row of rows) if (Object.prototype.hasOwnProperty.call(brands,row.provider)) {
            if (!providersByResource.has(row.resource)) providersByResource.set(row.resource,new Set());
            providersByResource.get(row.resource).add(brands[row.provider]);
        }
        const list = document.createElement('ul'), inactive = document.createElement('ul');
        list.className='services';list.setAttribute('role','list');
        const detailBodies = new WeakMap();
        const hydrate = entry => {
            const body = detailBodies.get(entry);
            if (!body) return;
            detailBodies.delete(entry);
            const {brand,verdict,warning,findingAt,observedAt,attemptedAt,errorDetails} = body;
            const summary=entry.querySelector('summary');summary.setAttribute('aria-label',brand+' · '+summary.textContent);
            entry.append(n('p',brand,'service-status'));
            if (verdict && verdict !== 'unknown') entry.append(n('p', t('analysisVerdict_' + verdict), warning ? 'warning' : ''));
            if (errorDetails) entry.append(n('p', errorDetails, 'warning'));
            if(body.completion)entry.append(n('p',t('assessmentCompletion')+': '+t('assessmentCompletion_'+body.completion)));
            if(body.providerJobId)entry.append(n('p',t('assessmentJob')+': '+body.providerJobId));
            if(body.conflicts?.includes('mixed_verdicts'))entry.append(n('p',t('assessmentConflict'),'warning'));
            if(body.signals?.length){entry.append(n('strong',t('assessmentSignals')));const list=n('ul','');for(const signal of body.signals){const item=n('li',t('assessmentSignal_'+signal.code)+' · '+t('analysisVerdict_'+signal.verdict)+(Number.isFinite(signal.value)?' · '+signal.value:'')+(Number.isFinite(signal.total)?' / '+signal.total:''));list.append(item);}entry.append(list);}

            entry.append(n('p', t('analysisFindingObserved') + ': ' + date(findingAt)));
            entry.append(n('small', t('analysisObserved') + ': ' + date(observedAt) + ' · ' + t('analysisAttempted') + ': ' + date(attemptedAt)));
        };
        // toggle does not bubble; capture handles all active details with one listener.
        list.addEventListener('toggle',event => { if (event.target.open) hydrate(event.target); },true);
        const details = (key, title) => { const node = document.createElement('details'); node.dataset.key = key; node.open = opened.has(key); const summary = n('summary',title); summary.dataset.focusKey = key; node.append(summary); return node; };
        const resourceName = row => {
            if (row.resource === 'message') return t('analysisResourceMessage');
            if (typeof row.resource === 'string' && row.resource.startsWith('attachment:')) return t('analysisResourceAttachment') + ' · ' + (data.resourceLabels?.[row.resource] || row.resource.slice(11));
            if (typeof row.resource === 'string' && row.resource.startsWith('link:')) return t('analysisResourceLink') + ' ' + (Number(row.resource.slice(5)) + 1) + (data.resourceLabels?.[row.resource] ? ' · ' + data.resourceLabels[row.resource] : '');
            return t('analysisResourceUnknown');
        };
        for (const [provider, brand] of Object.entries(brands)) {
            const items = rows.filter(row => row.provider === provider), li = document.createElement('li'); li.append(n('strong', brand));
            if (items.length) {
                li.dataset.provider=provider;
                const results=n('div','','service-results');
                for (const verdict of ['malicious','suspicious','none','unknown']) if (items.some(row => (row.verdict || 'unknown')===verdict)) {
                    results.append(n('span',t('analysisVerdict_'+verdict),'service-verdict'+(['malicious','suspicious'].includes(verdict)?' warning':'')));
                }
                if (items.some(row => ['malicious','suspicious'].includes(row.verdict))) li.className='has-warning';
                li.append(results);
                li.append(n('div', [...new Set(items.map(row => t('analysisState_' + row.state)))].join(' · '), 'service-status'));
                li.append(n('div',[...new Set(items.map(row=>t('analysisSource_'+row.source)))].join(' · '),'service-origin muted'));
                if (items.some(row => row.failures && row.responses)) li.append(n('div',t(items.some(row => ['none','suspicious','malicious'].includes(row.verdict)) ? 'analysisPartial' : 'analysisModeResponsesFailed'),'warning'));
                if (['disabled','permission','authorization','policy','unconfigured'].includes(data.availability?.[provider])) li.append(n('div', t('analysisCurrentAvailability') + ': ' + t('analysisReason_' + data.availability[provider]), 'muted'));
                for (const row of items) {
                    const key = [provider,row.scope,row.resource || 'unknown'].join(':');
                    const warning = ['malicious','suspicious'].includes(row.verdict);
                    const entry = details(key, resourceName(row) + ' · ' + t('analysisScope_' + row.scope) + ' · ' + t('analysisState_' + row.state) + ' · ' + t('analysisSource_' + row.source) + (warning ? ' · ' + t('analysisVerdict_' + row.verdict) : ''));
                    if (warning) entry.querySelector('summary').className = 'warning';
                    detailBodies.set(entry,{brand,verdict:row.verdict,warning,findingAt:row.findingAt,observedAt:row.observedAt,attemptedAt:row.attemptedAt,errorDetails:row.errorDetails,completion:row.completion,signals:row.signals,conflicts:row.conflicts,providerJobId:row.providerJobId});
                    if (entry.open) hydrate(entry);
                    if (warning && !warningTargets[row.verdict]) warningTargets[row.verdict] = entry;
                    li.append(entry);
                }
                list.append(li);
            } else { li.append(n('div', t('analysisReason_' + (data.availability?.[provider] || 'unrecorded')), 'muted')); inactive.append(li); }
        }
        const strongest = rows.some(row => row.verdict === 'malicious') ? 'malicious' : rows.some(row => row.verdict === 'suspicious') ? 'suspicious' : null;
        if (strongest) {
            card.style.borderColor = 'var(--color-danger,#b32642)';card.append(n('p', t('analysisVerdict_' + strongest), 'warning'));
            if (warningTargets[strongest]) {
                const jump=n('button',t('analysisCurrentFindWarning'));jump.type='button';jump.dataset.focusKey='current-find-warning';
                jump.addEventListener('click',() => {const entry=warningTargets[strongest];entry.open=true;hydrate(entry);entry.querySelector('summary').focus();});card.append(jump);
            }
        }
        card.append(list);
        // This renderer also runs serialized in the message's isolated world.
        // All provider data is projected in the background, never interpreted as HTML.
        for(const [ref,report] of Object.entries(data.hybridReports||{})){
            if(data.displayPreferences?.hybridDetails===false)break;
            if(!(typeof ref==='string'&&ref.length<=80&&/^(?:attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(ref))||report?.schemaVersion!==1||!Array.isArray(report.sections))continue;
            const panel=details('hybrid:'+ref,'Hybrid Analysis · '+t('hybridExpertTitle')+' · '+resourceName({resource:ref}));
            panel.className='hybrid-expert';
            panel.append(n('p',t('hybridExpertScope'),'muted'),n('p',t('analysisObserved')+': '+date(report.observedAt)));
            const groups=['identity','assessment','scanners','antivirus','reports','counts','signatures','mitre','network','processes','extracted','certificates'];
            const present=new Set();
            for(const section of report.sections.slice(0,12)){
                if(!groups.includes(section?.id)||!Array.isArray(section.rows))continue;
                present.add(section.id);
                const group=details('hybrid:'+ref+':'+section.id,t('hybridExpert_'+section.id)+' · '+section.rows.length);
                const hydrateGroup=()=>{
                    if(group.dataset.loaded)return;group.dataset.loaded='true';
                    const rows=n('ol','');
                    for(const fields of section.rows.slice(0,50)){
                        if(!Array.isArray(fields))continue;
                        const row=n('li',''),dl=n('dl','');
                        for(const field of fields.slice(0,25)){
                            if(typeof field?.key!=='string'||!['string','number','boolean'].includes(typeof field.value))continue;
                            dl.append(n('dt',field.key),n('dd',typeof field.value==='boolean'?t(field.value?'hybridExpertYes':'hybridExpertNo'):String(field.value)));
                        }
                        row.append(dl);rows.append(row);
                    }
                    group.append(rows);
                };
                group.addEventListener('toggle',()=>{if(group.open)hydrateGroup();});
                if(group.open)hydrateGroup();panel.append(group);
            }
            const empty=groups.filter(key=>Array.isArray(report.emptySections)&&report.emptySections.includes(key)&&!present.has(key));
            if(empty.length)panel.append(n('p',t('hybridExpertEmpty')+': '+empty.map(key=>t('hybridExpert_'+key)).join(' · '),'muted'));
            const missing=groups.filter(key=>!present.has(key)&&!empty.includes(key));
            if(missing.length)panel.append(n('p',t('hybridExpertMissing')+': '+missing.map(key=>t('hybridExpert_'+key)).join(' · '),'muted'));
            if(report.truncated)panel.append(n('p',t('analysisTruncated'),'warning'));
            card.append(panel);
        }
        if(data.hybridReportsTruncated)card.append(n('p',t('analysisTruncated'),'warning'));
        style.textContent+='.hybrid-expert{margin:12px 0;padding:12px;border:1px solid var(--card-border,#cbd5e1);border-radius:8px}.hybrid-expert details{margin:10px 0}.hybrid-expert dl{margin:8px 0}.hybrid-expert dt{font-weight:600}.hybrid-expert dd{margin:0 0 6px 12px;white-space:pre-wrap;overflow-wrap:anywhere}';
        if (inactive.childElementCount) { const other = details('other',t('analysisOtherServices')); other.append(inactive); card.append(other); }
        const refs = Object.keys(data.resourceLabels || {}).filter(ref => /^attachment:[0-9]+(?:\.[0-9]+)*$/.test(ref) || /^link:[0-9]{1,6}$/.test(ref));
        if (refs.length) {
            const inventory = details('resources', t('analysisResources'));
            const resources = document.createElement('ul');
            for (const resource of refs.slice(0,500)) {
                const item = n('li',resourceName({resource}));
                item.append(n('div',t(resource.startsWith('attachment:') ? 'analysisResourceLocal' : 'analysisResourceTarget'),'muted'));
                const providers = [...(providersByResource.get(resource) || [])];
                item.append(n('div', providers.length ? providers.join(' · ') : t('analysisResourceNoExternal')));
                resources.append(item);
            }
            if (refs.length > 500) resources.append(n('li',t('analysisTruncated'),'warning'));
            inventory.append(resources); card.append(inventory);
        }
        if (data.truncated) card.append(n('p',t('analysisTruncated'),'warning'));
        const historyRows = (Array.isArray(data.sourceHistory?.rows) ? data.sourceHistory.rows : []).slice(0,1200).filter(row => row && Object.prototype.hasOwnProperty.call(brands,row.provider) && Object.prototype.hasOwnProperty.call(labels,'analysisScope_' + row.scope) && Object.prototype.hasOwnProperty.call(labels,'analysisState_' + row.state));
        const historicalWarning = historyRows.some(row => ['malicious','suspicious'].includes(row.verdict));
        if (historyRows.length || data.sourceHistory?.truncated) {
            const names = [...new Set(historyRows.map(row => brands[row.provider]))];
            const history = details('unbound-history',t('analysisHistoryTitle') + (names.length ? ' · ' + names.join(' · ') : '') + (historicalWarning ? ' · ' + t('analysisHistoryFlagged') : ''));
            history.append(n('p',t('analysisHistoryWarning'),'warning'));
            const entries = document.createElement('ul');
            entries.className = 'history-entries';
            const pageSize = 30, lastPage = Math.max(0,Math.ceil(historyRows.length/pageSize)-1);
            let page = Number(host.dataset.historyPage);
            page = Number.isSafeInteger(page) && page >= 0 ? Math.min(page,lastPage) : 0;
            const controls = n('div','','history-controls');controls.setAttribute('role','group');controls.setAttribute('aria-label',t('analysisHistoryPages'));
            const previous = n('button',t('auditPrevious')), next = n('button',t('auditNext')), range = n('span');
            previous.type = next.type = 'button';previous.dataset.focusKey='history-previous';next.dataset.focusKey='history-next';
            range.className='history-range';
            function paintHistory(announce = false) {
                host.dataset.historyPage=String(page);entries.replaceChildren();
                for (const row of historyRows.slice(page*pageSize,(page+1)*pageSize)) {
                    const li = n('li', brands[row.provider] + ' · ' + t('analysisScope_' + row.scope) + ' · ' + t('analysisState_' + row.state) + ' · ' + t('analysisSource_stored'));
                    const flagged = ['malicious','suspicious'].includes(row.verdict);
                    li.tabIndex=-1;li.dataset.focusKey='history-row:'+JSON.stringify([row.provider,row.scope,row.state,row.verdict,row.observedAt,row.findingAt,row.attemptedAt]);
                    if (flagged) li.dataset.historyWarning='true';
                    li.append(n('div',t('analysisVerdict_' + (Object.prototype.hasOwnProperty.call(labels,'analysisVerdict_' + row.verdict) ? row.verdict : 'unknown')),flagged ? 'warning' : ''));
                    li.append(n('small',t('analysisFindingObserved') + ': ' + date(row.findingAt) + ' · ' + t('analysisObserved') + ': ' + date(row.observedAt) + ' · ' + t('analysisAttempted') + ': ' + date(row.attemptedAt)));
                    entries.append(li);
                }
                range.textContent=t('analysisHistoryEntries')+': '+(historyRows.length ? page*pageSize+1 : 0)+'–'+Math.min(historyRows.length,(page+1)*pageSize)+' / '+historyRows.length;
                previous.disabled=page===0;next.disabled=page===lastPage;
                if (announce) live.textContent=t('analysisHistoryTitle')+' · '+range.textContent;
            }
            previous.addEventListener('click',() => { page=Math.max(0,page-1);paintHistory(true);(previous.disabled ? next : previous).focus(); });
            next.addEventListener('click',() => { page=Math.min(lastPage,page+1);paintHistory(true);(next.disabled ? previous : next).focus(); });
            if (historyRows.length > pageSize) controls.append(previous,next);
            if (historyRows.length) controls.append(range);
            if (historicalWarning) {
                const jump=n('button',t('analysisHistoryFindWarning'));jump.type='button';jump.dataset.focusKey='history-find-warning';
                jump.addEventListener('click',() => {page=Math.floor(historyRows.findIndex(row=>['malicious','suspicious'].includes(row.verdict))/pageSize);paintHistory(true);entries.querySelector('[data-history-warning]')?.focus();});
                controls.append(jump);
            }
            paintHistory();history.append(controls);
            history.append(entries);
            if (data.sourceHistory.truncated || data.sourceHistory.rows?.length > 1200) history.append(n('p',t('analysisTruncated'),'warning'));
            card.append(history);
        }
        if (sourceDataIncomplete) card.append(n('p',t('analysisStoredDataIncomplete'),'warning'));
        if (data.sourcePersistenceFailed) card.append(n('p',t('analysisPersistenceFailed'),'warning'));
        if (data.reportArchiveBlocked) card.append(n('p',t('analysisReportArchiveBlocked'),'warning'));
        card.append(n('p', t('analysisLimit'), 'muted'));
        const announcement = [mode, localLabel, sourceDataIncomplete ? t('analysisStoredDataIncomplete') : '', rows.length ? phase : '', data.sourceHistory?.rows?.length ? t('analysisHistoryTitle') : '', historicalWarning ? t('analysisHistoryFlagged') : '', data.sourcePersistenceFailed ? t('analysisPersistenceFailed') : '', data.reportArchiveBlocked ? t('analysisReportArchiveBlocked') : '', ...Object.entries(brands).filter(([provider]) => rows.some(row => row.provider === provider)).map(([,brand]) => brand), strongest ? t('analysisVerdict_' + strongest) : ''].filter(Boolean).join(' · ');
        const changed = host.dataset.announcement !== announcement;
        for(const row of rows) { const technical=['httpStatus','providerVerdict','providerScore','reportCount','maliciousCount','suspiciousCount','totalCount','retryAfter','errorCode'].filter(key=>row[key]!=null).map(key=>key+': '+row[key]);if(technical.length)card.append(n('p',(brands[row.provider]||row.provider)+' · '+(row.resource||'message')+' · '+technical.join(' · '))); }
        for(const [id,access] of Object.entries(data.providerAccess||{})){card.append(n('p',(brands[id]||id)+' · '+t(access.configured?'analysisProviderConfigured':'analysisProviderNoKey')+' · '+t('analysisReason_'+(data.availability?.[id]||'unrecorded'))+' · '+(access.testStatus||'—')+' · '+date(access.testedAt)));}
        const overview=n('div','','card');
        const flagged=rows.filter(row=>['malicious','suspicious'].includes(row.verdict));
        const danger=flagged.some(row=>row.verdict==='malicious');
        const uncertain=jobBusy||['pending','incomplete','failed'].includes(data.scanJob?.state)||data.unavailable||sourceDataIncomplete||!local||failures||running||waiting||incomplete||rows.some(row=>['unknown'].includes(row.verdict));
        const title=danger?'analysisSimpleDanger':flagged.length||data.local?.score>=50?'analysisSimpleCaution':uncertain?'analysisSimpleIncomplete':'analysisSimpleNone';
        overview.append(n('h2',t(title)),n('p',localLabel),n('p',t('analysisSimpleBasis')+': '+new Set(rows.filter(row=>['none','suspicious','malicious'].includes(row.verdict)).map(row=>row.provider)).size+' / '+new Set(rows.filter(row=>row.state==='failed'||row.failures>0).map(row=>row.provider)).size));
        if(rows.some(r=>r.completion==='pending'))overview.append(n('p',t('assessmentCompletion_pending')));
        if(rows.some(r=>r.completion==='complete'&&r.verdict==='unknown'))overview.append(n('p',t('assessmentCompletion_unknown')));
        if(rows.some(r=>r.completion==='failed'))overview.append(n('p',t('assessmentCompletion_failed'),'warning'));
        if(rows.some(r=>r.conflicts?.includes('mixed_verdicts')))overview.append(n('p',t('assessmentConflict'),'warning'));
        const reasons=n('ul','');
        const topReasons=[...(Array.isArray(data.local?.reasons)?data.local.reasons:[]),...flagged.map(row=>(brands[row.provider]||row.provider)+': '+t('analysisVerdict_'+row.verdict))].slice(0,3);
        for(const reason of topReasons)reasons.append(n('li',String(reason)));
        if(topReasons.length)overview.append(reasons);
        const times=rows.map(row=>row.observedAt).filter(Number.isFinite);if(times.length)overview.append(n('p',t('analysisObserved')+': '+date(Math.max(...times))));
        if(data.protection?.required)overview.append(n('p',t('analysisApprovalRequired'),'warning'));else overview.append(n('p',t('analysisContinueWarning')));
        overview.append(n('p',t('analysisScoreExplanation'),'muted'));
        if(flagged.length&&rows.some(row=>row.verdict==='none')){overview.append(n('p',t('analysisConflict'),'warning'));card.prepend(n('p',t('analysisConflict'),'warning'));}
        card.append(n('p',t('analysisScoreExplanation'),'muted'),n('p',t('analysisExportSensitive'),'muted'));
        if(Array.isArray(data.local?.reasons)){const allReasons=n('ul','');for(const reason of data.local.reasons.slice(0,20))allReasons.append(n('li',String(reason)));card.append(allReasons);}
        if(data.local?.score!=null)card.append(n('p',t('auditLocalScore')+': '+data.local.score+' / 100'));
        if(data.protection?.required)card.append(n('p',t('analysisApprovalRequired')+' · '+data.protection.reason+' · '+data.protection.revision,'warning'));
        const switcher=n('button','');switcher.type='button';switcher.dataset.focusKey='view-switch';
        const preference=['simple','expert'].includes(data.displayPreferences?.view)?data.displayPreferences.view:null;
        if(preference&&host.dataset.viewPreference!==preference){
            // The first settings response can arrive after the user switched
            // the loading view. Later explicit setting changes still apply.
            if(host.dataset.viewPreference!==undefined||host.dataset.viewChosen!=='true')host.dataset.view=preference;
            host.dataset.viewPreference=preference;
        }
        if(!host.dataset.view)host.dataset.view=document.body.dataset.thundyAnalysisView==='expert'?'expert':'simple';
        const applyView=()=>{const expert=host.dataset.view==='expert';card.hidden=!expert;overview.hidden=expert;switcher.textContent=t(expert?'analysisSimple':'analysisExpert');switcher.setAttribute('aria-expanded',String(expert));document.body.dataset.thundyAnalysisView=expert?'expert':'simple';};
        switcher.addEventListener('click',()=>{host.dataset.viewChosen='true';host.dataset.view=host.dataset.view==='expert'?'simple':'expert';applyView();});applyView();
        style.textContent+='[hidden]{display:none!important}.scan-actions{font:14px/1.5 system-ui;color:var(--text-color,#192b40);background:var(--card-bg,#fff);overflow-wrap:anywhere;padding:12px;border:1px solid var(--card-border,#cbd5e1);border-radius:10px;margin-bottom:12px}.scan-actions button{margin:4px;max-width:100%;white-space:normal;overflow-wrap:anywhere}';
        const actions=n('section','','scan-actions');actions.setAttribute('aria-label',t('scanActions'));
        if(data.scanJob){
            const job=data.scanJob;const needsRefresh=job.pending||job.state==='pending';const state=n('p',t('scanState_'+(job.state||'idle')));state.setAttribute('role','status');actions.append(state);
            if(job.total)actions.append(n('p',t('scanProgress')+': '+job.completed+' / '+job.total));
            const button=n('button',t(jobBusy?'scanRunning':needsRefresh?'scanRefresh':['completed','incomplete','failed'].includes(job.state)?'scanRepeat':'scanStart'));button.type='button';button.dataset.focusKey='scan-start';button.disabled=jobBusy||job.manualAllowed===false;
            button.addEventListener('click',async()=>{button.disabled=true;state.textContent=t('scanRunning');try{const response=await browser.runtime.sendMessage({action:'requestScan',messageId:data.messageId,contextToken:data.contextToken,operation:needsRefresh?'refresh':'scan'});if(!response?.success)throw Error('scan');state.textContent=t('scanState_'+(response.state||'queued'));}catch(_){state.textContent=t('scanState_failed');button.disabled=false;}});actions.append(button);
            const settings=n('button',t('bannerOpenOptions'));settings.type='button';settings.dataset.focusKey='scan-settings';settings.addEventListener('click',()=>browser.runtime.sendMessage({action:'openScanSettings'}));actions.append(settings);
            if(job.migration)actions.append(n('p',t('scanMigrationNotice')));
            const reasons=n('ul','');for(const [id,value] of Object.entries(job.providers||{})){const unique=[...new Set((value.checks||[]).map(c=>c.reason).filter(reason=>reason&&(reason!=='no_resources'||!value.checks.some(c=>!c.reason))))];if(value.state==='failed')unique.push(value.error==='rate_limited'?'quota':'provider_error');if(unique.length)reasons.append(n('li',(brands[id]||id)+': '+unique.map(reason=>t('analysisReason_'+reason)).join(' · ')));}if(reasons.childElementCount)actions.append(reasons);
        }
        root.replaceChildren(style, live, ...(data.scanJob?[actions]:[]), switcher, card, overview);
        if (wasPresent && changed) live.textContent = announcement;
        host.dataset.announcement = announcement;
        if (!wasPresent) { const mount = document.getElementById('analysisSourceMount'); if (mount) mount.append(host); else document.body.prepend(host); }
        if (focused) {
            const target=Array.from(root.querySelectorAll('[data-focus-key]')).find(node => node.dataset.focusKey === focused && !node.disabled);
            (target || (focused.startsWith('history-') ? root.querySelector('[data-key="unbound-history"] summary') : null))?.focus({preventScroll:true});
        }
        return host;
    }
    function withCache(context, provider, scope, key) {
        if (!context) return context;
        return { ...context, cached: (...args) => context.cached?.(...args), event(event) {
            if (event.phase === 'finish' && event.state !== 'failed' && Number.isFinite(event.observedAt)) cacheTime(provider, scope, key, event.observedAt);
            return context.event(event);
        } };
    }
    function labels(get) {
        const keys = ['hybridExpertEmpty','hybridExpertTitle','hybridExpertScope','hybridExpertMissing','hybridExpertYes','hybridExpertNo','hybridExpert_identity','hybridExpert_assessment','hybridExpert_scanners','hybridExpert_antivirus','hybridExpert_reports','hybridExpert_counts','hybridExpert_signatures','hybridExpert_mitre','hybridExpert_network','hybridExpert_processes','hybridExpert_extracted','hybridExpert_certificates','assessmentCompletion','assessmentCompletion_pending','assessmentCompletion_complete','assessmentCompletion_unknown','assessmentCompletion_failed','assessmentConflict','assessmentSignals','assessmentJob',...['verdict','scanner','threat_score','multiscan_result','threat_level','whitelist','overall','urlscan','engines','brand','report'].map(c=>'assessmentSignal_'+c),'scanActions','scanStart','scanRepeat','scanRefresh','scanRunning','scanProgress','scanMigrationNotice','scanState_idle','scanState_queued','scanState_running','scanState_completed','scanState_pending','scanState_incomplete','scanState_failed','scanState_blocked','bannerOpenOptions','auditLocalScore','analysisProviderConfigured','analysisProviderNoKey','analysisSimple','analysisExpert','analysisSimpleNone','analysisSimpleCaution','analysisSimpleDanger','analysisSimpleIncomplete','analysisSimpleBasis','analysisScoreExplanation','analysisApprovalRequired','analysisContinueWarning','analysisConflict','analysisExportSensitive','analysisModeResponses','analysisModeResponsesFailed','analysisCurrentAvailability','analysisStoredDataIncomplete','analysisCurrentFindWarning','analysisHistoryPages','analysisHistoryEntries','analysisHistoryFlagged','analysisHistoryFindWarning','auditPrevious','auditNext','analysisReportArchiveBlocked','analysisHistoryTitle','analysisHistoryWarning','analysisPersistenceFailed','analysisResources','analysisResourceLocal','analysisResourceTarget','analysisResourceNoExternal','analysisModeUnknown','analysisModeRunning','analysisModeSubmitted','analysisModeIncomplete','analysisModePartial','analysisModeFailed','analysisModeResults','analysisResourceMessage','analysisResourceAttachment','analysisResourceLink','analysisResourceUnknown','analysisTruncated','analysisUnavailable','analysisTitle','analysisUnknown','analysisTimeUnknown','analysisMixed','analysisExternal','analysisLocal','analysisLocalChecked','analysisLocalIncomplete','analysisLocalUnavailable','analysisLocalPending','analysisObserved','analysisFindingObserved','analysisAttempted','analysisPartial','analysisOtherServices','analysisLimit'];
        for (const [prefix, values] of [['Scope',scopes],['State',states],['Source',['remote','cache','stored','attempt']],['Verdict',verdicts],['Reason',['unconfigured','disabled','permission','authorization','policy','on_action','unrecorded','manual','sender','links_disabled','no_resources','quota','running','provider_error']]]) for (const value of values) keys.push('analysis'+prefix+'_'+value);
        return Object.fromEntries(keys.map(key => [key, get(key)]));
    }
    return { providers, scopes, create, spec, response, resources, legacy, history, render, cacheTime, labels, withCache, bind, validResource, rowKey };
})();
