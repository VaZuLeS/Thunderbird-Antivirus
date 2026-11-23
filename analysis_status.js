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
        if(info.provider==='urlscan'&&status===410)return {state:'failed',verdict:'unknown',errorCode:'result_gone',errorDetails:uiText('urlscanResultGone','This result was deleted by urlscan.io. Updating cannot restore it; a new submission requires an explicit scan.')};
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
                Object.assign(row,ThundyProviderResults.projectQuota(old));
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
            if(e.phase==='finish'&&(e.responded===true||e.localBackoff))for(const key of Object.keys(ThundyProviderResults.projectQuota(row)))delete row[key];
            if(e.phase==='finish'&&e.responded===true)for(const key of ['errorCode','errorDetails','retryAfter'])delete row[key];
            Object.assign(row,ThundyProviderResults.projectQuota(e));
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
            if (hvVerdict && item.url) {
                const info = { provider: 'hybridanalysis', scope: 'url', resource };
                if (!documented.has(rowKey(info))) model.event({ ...info, phase: 'cache', state: item.hybrid_verdict.completion === 'incomplete' ? 'incomplete' : 'checked', verdict: hvVerdict, observedAt: Number.isFinite(item.hybrid_verdict.observedAt) ? item.hybrid_verdict.observedAt : null });
            }
            // A URL verdict and a pending raw report are distinct observations.
            if (report || !(hvVerdict && item.url) && ['KNOWN', 'UPLOADED'].includes(item.state)) {
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
    // Reconcile current, content-bound stored resources without replaying events
    // or counting another response. Active/live attempts stay authoritative;
    // stored failure counters remain history beside any newer stored finding.
    function refreshStored(model, record) {
        for (const row of legacy(record).rows) {
            const active = model.data.rows.find(old => rowKey(old) === rowKey(row));
            if (!active) {
                if (model.data.rows.length < 1200) model.data.rows.push(row);
                else model.data.truncated = true;
                continue;
            }
            if (active.source !== 'stored' || active.active) continue;
            const oldTime = Number.isFinite(active.observedAt) ? active.observedAt : null;
            const newTime = Number.isFinite(row.observedAt) ? row.observedAt : null;
            if (oldTime !== null && (newTime === null || newTime < oldTime)) continue;
            const newer = newTime !== null && (oldTime === null || newTime > oldTime);
            const completed = ['pending','unknown','failed'].includes(active.completion) && row.completion === 'complete';
            if (!newer && !completed) continue;
            const verdict = worst(active.verdict, row.verdict);
            Object.assign(active, ThundyProviderResults.project(ThundyProviderResults.merge(active,row)), {
                state:row.state, verdict, observedAt:newTime === null ? oldTime : newTime,
                findingAt:verdicts.indexOf(row.verdict) >= verdicts.indexOf(active.verdict) ? row.findingAt ?? active.findingAt ?? null : active.findingAt ?? null
            });
        }
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
        return {diagnosticRun:context.diagnosticRun||null,event:apply, cached(provider,scope,verdict,observedAt) { return apply({provider,scope,verdict,observedAt,phase:'cache',state:verdict === 'unknown' ? 'received' : 'checked'}); }};
    }
    function history(record, excludeId = null, unboundRows = []) {
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
        add({schemaVersion:2,rows:unboundRows});
        add(record.analysisStatusLegacy);add(record.analysisStatus);
        const archived = record.analysisReportArchive;
        if (archived?.schemaVersion === 1 && Array.isArray(archived.entries)) {
            for (const entry of archived.entries.slice(0,128)) {
                if (entry?.resource && ['attachment','link'].includes(entry.kind)) add(legacy({[entry.kind === 'attachment' ? 'attachments' : 'links']:[entry.resource]}));
            }
            result.truncated ||= archived.truncated === true || archived.entries.length > 128;
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
    function render(data, labels, theme = '', presentation = {}) {
        const inline = presentation.surface === 'message';
        const document = globalThis.document;
        const displayedId = document.documentElement.dataset.thundyAnalysisMessage;
        if ((displayedId || presentation.bound) && displayedId !== String(data.messageId)) return null;
        let host = document.getElementById('thundy-analysis-status');
        const wasPresent = !!host;
        const opened = new Set(Array.from(host?.shadowRoot?.querySelectorAll('details[open]') || []).map(node => node.dataset.key));
        const focused = host?.shadowRoot?.activeElement?.dataset.focusKey;
        const n = (tag, text, cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
        const t = key => labels[key] || labels.analysisUnknown;
        if (!host) { host = document.createElement('section'); host.id = 'thundy-analysis-status'; host.attachShadow({mode:'open'}); }
        host.setAttribute('aria-label', labels.analysisTitle);
        host.style.cssText = 'all:initial!important;display:block!important;visibility:visible!important;opacity:1!important;margin:12px!important;';
        host.dataset.surface = inline ? 'message' : 'popup';
        const root = host.shadowRoot;
        const palette = root.querySelector('style[data-thundy-theme]') || document.createElement('style');
        palette.dataset.thundyTheme = 'analysis';
        if (!palette.textContent && theme) palette.textContent = '.card,.inline-toolbar{' + theme + '}';
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
        const archivedReasons = Array.isArray(data.local?.archivedAttachmentReasons)
            ? data.local.archivedAttachmentReasons.slice(0,20).filter(value => typeof value === 'string' && value) : [];
        const mode = t(jobBusy ? 'scanRunning' : data.unavailable ? 'analysisUnavailable' : rows.length ? local || localLimited ? 'analysisMixed' : 'analysisExternal' : data.sourcePersistenceFailed ? 'analysisModeUnknown' : archivedReasons.length ? 'analysisLocalOnly' : local || localLimited ? 'analysisLocal' : 'analysisModeUnknown');
        const phase = t(running ? 'analysisModeRunning' : waiting ? 'analysisModeSubmitted' : failures ? usable ? 'analysisModePartial' : received ? 'analysisModeResponsesFailed' : 'analysisModeFailed' : incomplete ? 'analysisModeIncomplete' : usable ? 'analysisModeResults' : received ? 'analysisModeResponses' : 'analysisModeUnknown');
        const card = n('div', '', 'card'); card.append(n('h2', t('analysisTitle')), n('p', mode, 'mode'));
        if (rows.length) card.append(n('p',phase, failures ? 'phase warning' : 'phase'));
        const heuristicScore = data.local?.heuristicScore ?? data.local?.score;
        const localScoreValid=Number.isFinite(heuristicScore)&&heuristicScore>=0&&heuristicScore<=100&&data.local?.state!=='failed';
        const localScoreText=t('localScoreMessage')+': '+(localScoreValid ? heuristicScore+' / 100' : t('auditUnavailable'));
        const localLabel = t(data.local?.state === 'failed' ? 'analysisLocalUnavailable' : localLimited ? 'analysisLocalIncomplete' : local ? 'analysisLocalChecked' : 'analysisLocalPending');
        card.append(n('p', localLabel, localLimited ? 'warning' : 'muted'));
        const brands = data.providerNames || { hybridanalysis: 'Hybrid Analysis', virustotal: 'VirusTotal', urlhaus: 'URLhaus', abuseipdb: 'AbuseIPDB', urlscan: 'urlscan.io' };
        const warningTargets = {};
        const rowsByResource = new Map();
        for (const row of rows) {
            if (!rowsByResource.has(row.resource)) rowsByResource.set(row.resource,[]);
            rowsByResource.get(row.resource).push(row);
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
        const flagged = rows.filter(row => ['malicious','suspicious'].includes(row.verdict));
        const strongest = flagged.some(row => row.verdict === 'malicious') ? 'malicious' : flagged[0]?.verdict;
        const hasBoundResource = row => Object.hasOwn(data.resourceLabels || {}, row.resource) &&
            /^(?:attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(row.resource);
        const warningRow = flagged.filter(row => row.verdict === strongest)
            .sort((a,b) => Number(hasBoundResource(b)) - Number(hasBoundResource(a)) ||
                (b.findingAt || 0) - (a.findingAt || 0))[0];
        const comparable = row => hasBoundResource(row) && (row.resource.startsWith('attachment:')
            ? ['hash','file','report'].includes(row.scope)
            : ['url','report'].includes(row.scope));
        const cleanFindings = new Map();
        for (const row of rows) {
            if (row.verdict !== 'none' || !comparable(row)) continue;
            if (!cleanFindings.has(row.resource)) cleanFindings.set(row.resource, new Set());
            cleanFindings.get(row.resource).add(row.provider);
        }
        const conflicting = flagged.some(row => comparable(row) &&
            [...(cleanFindings.get(row.resource) || [])].some(provider => provider !== row.provider));

        const openFinding = entry => {
            entry.open = true;
            hydrate(entry);
            entry.querySelector('summary').focus();
        };
        const inlineReports = new Set();
        const reportAction = (ref, inOverview = false, key = '', urlscanReport = null) => {
            const row = n('div','',inOverview && !key ? 'overview-report-link' : 'hybrid-report-link');
            const label = t(urlscanReport ? 'urlscanReportLink' : inOverview ? 'analysisOverviewOpenReport' : 'hybridReportOpen');
            const button = n('button',label);
            button.type = 'button';
            button.dataset.focusKey = key + (urlscanReport ? 'urlscan-report:' : inOverview ? 'overview-hybrid-report:' : 'hybrid-report:')+ref;
            button.setAttribute('aria-label', label+' · '+resourceName({resource:ref}));
            const status = n('span','');
            status.setAttribute('role','status');
            row.append(button,status);
            button.addEventListener('click', async () => {
                if (button.getAttribute('aria-disabled') === 'true') return;
                button.setAttribute('aria-disabled','true');
                try {
                    const binding = {messageId:data.messageId,contextToken:data.contextToken,resourceRef:ref};
                    const result = await browser.runtime.sendMessage(urlscanReport
                        ? {...binding,action:'openUrlscanReport',reportUrl:urlscanReport}
                        : {...binding,action:'openHybridReport',resourceToken:data.hybridReports[ref].resourceToken});
                    if (!result?.success) throw Error('report');
                    status.textContent = '';
                } catch (_) { status.textContent = t(urlscanReport ? 'analysisUnavailable' : 'hybridReportUnavailable'); }
                finally { button.removeAttribute('aria-disabled'); }
            });
            return row;
        };
        const hasReport = ref => data.displayPreferences?.hybridDetails !== false &&
            /^(?:attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(ref) &&
            ref.length <= 80 && data.hybridReports?.[ref]?.schemaVersion === 1 &&
            Array.isArray(data.hybridReports[ref].sections);
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
                    if (warning && (!warningTargets[row.verdict] || row === warningRow)) warningTargets[row.verdict] = entry;
                    if (inline && provider === 'hybridanalysis' && hasReport(row.resource) &&
                        !inlineReports.has(row.resource)) {
                        const resourceRow = n('div','','service-resource');
                        resourceRow.append(entry,reportAction(row.resource));
                        li.append(resourceRow);
                        inlineReports.add(row.resource);
                    } else li.append(entry);
                }
                list.append(li);
            } else { li.append(n('div', t('analysisReason_' + (data.availability?.[provider] || 'unrecorded')), 'muted')); inactive.append(li); }
        }
        if (strongest) {
            card.style.borderColor = 'var(--color-danger,#b32642)';card.append(n('p', inline ? [t('analysisVerdict_'+strongest),brands[warningRow.provider],resourceName(warningRow)].join(' · ') : t('analysisVerdict_'+strongest), 'warning'));
            if (warningTargets[strongest]) {
                const jump=n('button',t('analysisCurrentFindWarning'));jump.type='button';jump.dataset.focusKey='current-find-warning';
                jump.addEventListener('click',() => openFinding(warningTargets[strongest]));card.append(jump);
            }
        }
        card.append(list);
        if(rows.some(row=>row.state==='failed'||row.failures>0))card.append(n('p',t('apiDebugFailureHint'),'muted'));
        if(data.sourcePersistenceFailed||rows.some(row=>row.state==='failed')){const debug=n('button',t('apiDebugOpen'));debug.type='button';debug.addEventListener('click',()=>browser.runtime.sendMessage({action:'openApiDebug',runId:data.diagnosticRun||null}).catch(()=>{}));card.append(debug);}
        // This renderer also runs serialized in the message's isolated world.
        // All provider data is projected in the background, never interpreted as HTML.
        for(const [ref,report] of Object.entries(data.hybridReports||{})){
            if(data.displayPreferences?.hybridDetails===false)break;
            if(!(typeof ref==='string'&&ref.length<=80&&/^(?:attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(ref))||report?.schemaVersion!==1||!Array.isArray(report.sections))continue;
            if (inline) {
                if (!inlineReports.has(ref)) {
                    const resourceRow = n('div','','service-resource');
                    resourceRow.append(n('strong','Hybrid Analysis · '+resourceName({resource:ref})),reportAction(ref));
                    card.append(resourceRow);
                }
                continue;
            }
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
        const verdictRank = {malicious:3,suspicious:2,none:1};
        const verdictLabels = {malicious:'providerMalicious',suspicious:'providerSuspicious',
            none:'providerNoDetection',unknown:'providerUnknown'};
        const rank = row => verdictRank[row.verdict] || 0;
        const sortedRefs = refs.map(ref => ({
            ref, strength: (rowsByResource.get(ref) || []).reduce((maximum,row) => Math.max(maximum,rank(row)),0)
        })).sort((left,right) => right.strength - left.strength);
        function inventory(key, simple) {
            const section = details(key,t('analysisResources')+' · '+refs.length);
            if (simple && !root.querySelector('[data-key="overview-resources"]')) section.open = true;
            const groups = {link:n('ul',''),attachment:n('ul','')};
            for (const {ref:resource} of sortedRefs.slice(0,500)) {
                const item = n('li','');
                item.dataset.resource = resource;
                item.append(n('strong',resourceName({resource})));
                const attachment = resource.startsWith('attachment:');
                const findings = (rowsByResource.get(resource) || []).slice().sort((a,b) =>
                    rank(b) - rank(a) || (b.findingAt || b.observedAt || 0) - (a.findingAt || a.observedAt || 0));
                if (!simple) item.append(n('div',t(attachment ? 'analysisResourceLocal' : 'analysisResourceTarget'),'muted'));
                const providers = new Map();
                for (const row of findings) {
                    if (!providers.has(row.provider)) providers.set(row.provider,[]);
                    providers.get(row.provider).push(row);
                }
                for (const [provider,observed] of providers) {
                    const first = observed[0];
                    const verdict = rank(first) ? first.verdict : 'unknown';
                    const parts = [brands[provider],t(verdictLabels[verdict]),t('analysisSource_'+first.source)];
                    const score = first.signals?.find(signal => signal.code === 'threat_score' &&
                        Number.isFinite(signal.value) && signal.value >= 0 && signal.value <= 100)?.value;
                    if (provider === 'hybridanalysis' && Number.isFinite(score)) parts.push(t('assessmentSignal_threat_score')+' '+score+' / 100');
                    if (observed.some(row => row.completion === 'pending' || ['submitted','running'].includes(row.state))) parts.push(t('assessmentCompletion_pending'));
                    if (observed.some(row => row.completion === 'failed' || row.state === 'failed' || row.failures > 0)) parts.push(t('assessmentCompletion_failed'));
                    else if (observed.some(row => row.completion === 'unknown' || row.state === 'incomplete')) parts.push(t('analysisSimpleIncomplete'));
                    item.append(n('div',parts.join(' · '),rank(first) >= 2 ? 'warning' : ''));
                }
                const comparableFindings = findings.filter(comparable);
                const positive = comparableFindings.filter(row => rank(row) >= 2);
                if (findings.some(row => row.conflicts?.includes('mixed_verdicts')) ||
                    positive.some(row => comparableFindings.some(other => other.verdict === 'none' && other.provider !== row.provider))) {
                    item.append(n('p',t('analysisConflict'),'warning'));
                }
                if (!findings.length) item.append(n('div',t('analysisResourceNoExternal'),'muted'));
                if (hasReport(resource)) item.append(reportAction(resource,simple,key+':'));
                const urlscanReport = data.urlscanReports?.[resource];
                if (!attachment && urlscanReport) item.append(reportAction(resource,simple,key+':',urlscanReport));
                if (data.attachmentActions && attachment) {
                    const status = n('span','');
                    status.setAttribute('role','status');
                    for (const [operation,label] of [['save','attachmentSaveWithThundy'],['open','attachmentOpenWithThundy']]) {
                        const button = n('button',t(label));
                        button.type = 'button';
                        button.dataset.focusKey = key+':'+operation+':'+resource;
                        button.setAttribute('aria-label',t(label)+' · '+resourceName({resource}));
                        button.addEventListener('click',async () => {
                            if (button.getAttribute('aria-disabled') === 'true') return;
                            button.setAttribute('aria-disabled','true');
                            try {
                                const result = await browser.runtime.sendMessage({action:'startAttachmentDownload',
                                    messageId:data.messageId,partName:resource.slice('attachment:'.length),...(operation === 'open' ? {operation} : {})});
                                if (!result?.success) throw Error(result?.code);
                                status.textContent = result.opened ? t('attachmentOpenRequested') : result.saved ? t('attachmentSaveRequested') : '';
                            } catch (error) {
                                status.textContent = t(error.message === 'ATTACHMENT_CONTEXT_CHANGED' ? 'attachmentContextChanged' :
                                    error.message === 'ATTACHMENT_READ_FAILED' ? 'attachmentReadFailed' :
                                    error.message === 'ATTACHMENT_CHECK_TIMEOUT' ? 'scanFailure_timeout' : operation === 'open' ? 'attachmentOpenFailed' : 'attachmentFailed');
                            } finally {button.removeAttribute('aria-disabled');}
                        });
                        item.append(button);
                    }
                    item.append(status);
                }
                groups[attachment ? 'attachment' : 'link'].append(item);
            }
            const groupOrder = sortedRefs[0]?.ref.startsWith('attachment:') ? ['attachment','link'] : ['link','attachment'];
            for (const group of groupOrder) {
                const label = group === 'link' ? 'analysisLinksGroup' : 'analysisAttachmentsGroup';
                if (groups[group].children.length) section.append(n('h3',t(label)),groups[group]);
            }
            if (refs.length > 500) section.append(n('p',t('analysisTruncated'),'warning'));
            return section;
        }
        if (refs.length) card.append(inventory('resources',false));
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
        const persistenceReason = ['snapshot_invalid','snapshot_collision','snapshot_count','snapshot_bytes','storage_failed'].includes(data.sourcePersistenceReason) ? data.sourcePersistenceReason : null;
        const persistenceMessage = [t('analysisPersistenceFailed'),persistenceReason ? t('analysisPersistence_'+persistenceReason) : ''].filter(Boolean).join(' ');
        if (data.sourcePersistenceFailed) {const code=['QuotaExceededError','InvalidStateError','AbortError','UnknownError','DataCloneError','NotFoundError','TransactionInactiveError','SecurityError'].includes(data.sourcePersistenceError)?data.sourcePersistenceError:null;card.append(n('p',persistenceMessage+(code?' ('+code+')':''),'warning'));}
        if (data.reportArchiveBlocked) card.append(n('p',t('analysisReportArchiveBlocked'),'warning'));
        card.append(n('p', t('analysisLimit'), 'muted'));
        const announcement = [mode, localLabel, localScoreText, archivedReasons[0], sourceDataIncomplete ? t('analysisStoredDataIncomplete') : '', rows.length ? phase : '', data.sourceHistory?.rows?.length ? t('analysisHistoryTitle') : '', historicalWarning ? t('analysisHistoryFlagged') : '', data.sourcePersistenceFailed ? persistenceMessage : '', data.reportArchiveBlocked ? t('analysisReportArchiveBlocked') : '', ...Object.entries(brands).filter(([provider]) => rows.some(row => row.provider === provider)).map(([,brand]) => brand), strongest ? t('analysisVerdict_' + strongest) : ''].filter(Boolean).join(' · ');
        const changed = host.dataset.announcement !== announcement;
        const technicalDetails = inline ? details('provider-technical',t('hybridReportTechnical')) : card;
        for(const row of rows) {
            const technical=['httpStatus','providerVerdict','providerScore','reportCount','maliciousCount','suspiciousCount','totalCount','retryAfter','errorCode','quotaAction','quotaScope','quotaWindow','quotaLimit','quotaRemaining'].filter(key=>row[key]!=null).map(key=>key+': '+row[key]);
            if(technical.length)technicalDetails.append(n('p',(brands[row.provider]||row.provider)+' · '+(row.resource||'message')+' · '+technical.join(' · ')));
            if(row.quotaResetAt)technicalDetails.append(n('p',t('analysisQuotaReset')+': '+date(row.quotaResetAt)));
            if(row.retryAt)technicalDetails.append(n('p',t('analysisRetryAt')+': '+date(row.retryAt)));
            if(row.localBackoff)technicalDetails.append(n('p',t('analysisLocalBackoff'),'muted'));
        }
        for(const [id,access] of Object.entries(data.providerAccess||{})){technicalDetails.append(n('p',(brands[id]||id)+' · '+t(access.configured?'analysisProviderConfigured':'analysisProviderNoKey')+' · '+t('analysisReason_'+(data.availability?.[id]||'unrecorded'))+' · '+(access.testStatus||'—')+' · '+date(access.testedAt)));}
        if(inline && technicalDetails.children.length>1)card.append(technicalDetails);
        const overview=n('div','','card');
        const scanRunning = jobBusy || running || waiting || rows.some(row => row.completion === 'pending') ||
            ['unrecorded','pending'].includes(data.local?.state);
        const uncertain = data.scanJob?.coverage?.incomplete === true || data.scanJob?.assessmentIncomplete === true ||
            ['pending','incomplete','failed','deferred'].includes(data.scanJob?.state) || data.unavailable ||
            sourceDataIncomplete || localLimited || !local || !localScoreValid || failures || incomplete || rows.some(row => row.verdict === 'unknown');
        const title = strongest === 'malicious' ? 'analysisSimpleDanger' :
            flagged.length || archivedReasons.length || localScoreValid && heuristicScore > 0 ? 'analysisSimpleCaution' :
            scanRunning && !data.unavailable ? 'analysisRunningHeading' :
            uncertain ? 'analysisSimpleIncomplete' : data.sourcePersistenceFailed || data.reportArchiveBlocked ?
                'analysisSimpleDocumentationIncomplete' : 'analysisLocalNoFinding';
        const summaryCard = n('div','','card finding-card');
        summaryCard.append(n('h2',t(title),strongest === 'malicious' || title === 'analysisSimpleCaution' ? 'warning' : ''),
            n('p',localScoreText,'local-score'));
        if (archivedReasons.length && localScoreValid && Number.isFinite(data.local?.score)) {
            summaryCard.append(n('p',t('auditDecisionScore')+' · '+data.local.score+' / 100'));
        }
        const countProviders = predicate => new Set(rows.filter(predicate).map(row => row.provider)).size;
        const counts = [
            ['analysisProviderFindingsCount',countProviders(row => rank(row) > 0)],
            ['analysisProviderPendingCount',countProviders(row => ['running','submitted'].includes(row.state) || row.completion === 'pending')],
            ['analysisProviderErrorsCount',countProviders(row => row.state === 'failed' || row.completion === 'failed' || row.failures > 0)]
        ].filter(([,count]) => count > 0).map(([label,count]) => t(label)+': '+count);
        summaryCard.append(n('p',local && !rows.length ? t('analysisLocalOnly') : localLabel));
        if (counts.length) summaryCard.append(n('p',counts.join(' · '),'provider-counts'));
        const reasons=n('ul','');
        const allReasons=Array.isArray(data.local?.reasons)?data.local.reasons:[];
        const providerReasons = flagged.filter(row => row !== warningRow || !inline).map(row =>
            [brands[row.provider],resourceName(row),t('analysisVerdict_'+row.verdict)].join(' · '));
        const topReasons = [...new Set([...providerReasons,...archivedReasons,...allReasons])].slice(0,inline && warningRow ? 2 : 3);
        if (inline && warningRow) {
            const focus = n('p',[brands[warningRow.provider],resourceName(warningRow),t('analysisVerdict_'+warningRow.verdict)].join(' · '),'warning finding-summary');
            const summary = n('div','','finding-overview');
            summary.append(focus);
            if (warningRow.provider === 'hybridanalysis' && comparable(warningRow) && hasReport(warningRow.resource)) {
                summary.append(reportAction(warningRow.resource,true));
            } else if (warningTargets[strongest] && (hasBoundResource(warningRow) || warningRow.resource === 'message') &&
                rows.filter(row => row.provider === warningRow.provider && row.scope === warningRow.scope &&
                    row.resource === warningRow.resource).length === 1) {
                const jump = n('button',t('analysisOverviewOpenFinding'));
                jump.type = 'button';
                jump.dataset.focusKey = 'overview-find-warning';
                jump.addEventListener('click',() => {
                    showView('expert');
                    openFinding(warningTargets[strongest]);
                });
                summary.append(jump);
            }
            summaryCard.append(summary);
        }
        for (const reason of topReasons) reasons.append(n('li',String(reason),archivedReasons.includes(reason)?'warning':''));
        if (topReasons.length) summaryCard.append(reasons);
        if (refs.length) overview.append(inventory('overview-resources',true));
        if (data.sourcePersistenceFailed && title !== 'analysisSimpleDocumentationIncomplete') {
            overview.append(n('p',t('analysisSimpleDocumentationIncomplete'),'warning'));
        }
        if (inline && warningRow) {
            const times = [['analysisFindingObserved',warningRow.findingAt],['analysisAttempted',warningRow.attemptedAt]]
                .filter(([,value]) => Number.isFinite(value)).map(([key,value]) => t(key)+': '+date(value));
            if (times.length) overview.append(n('p',times.join(' · '),'muted'));
        } else {
            const times=rows.map(row=>row.observedAt).filter(Number.isFinite);
            if(times.length)overview.append(n('p',t('analysisObserved')+': '+date(Math.max(...times))));
        }
        if (data.protection?.required) overview.append(n('p',t('analysisApprovalRequired'),'warning'));
        overview.append(n('p',t('analysisScoreExplanation'),'muted'));
        if(conflicting){overview.append(n('p',t('analysisConflict'),'warning'));card.prepend(n('p',t('analysisConflict'),'warning'));}
        card.append(n('p',t('analysisScoreExplanation'),'muted'),n('p',t('analysisExportSensitive'),'muted'));
        const expertReasons = [...new Set([...archivedReasons,...allReasons])].slice(0,20);
        if (expertReasons.length) {
            const list=n('ul','');
            for (const reason of expertReasons) list.append(n('li',String(reason),archivedReasons.includes(reason)?'warning':''));
            card.append(list);
        }
        if (data.local?.riskModelVersion === 2 && localScoreValid) {
            card.append(n('p',t('auditDecisionScore')+' · '+data.local.score+' / 100'));
        }
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
        function showView(view) {
            host.dataset.viewChosen = 'true';
            host.dataset.view = view;
            applyView();
        }
        switcher.addEventListener('click',()=>showView(host.dataset.view==='expert'?'simple':'expert'));
        applyView();
        style.textContent+='[hidden]{display:none!important}.scan-actions{font:14px/1.5 system-ui;color:var(--text-color,#192b40);background:var(--card-bg,#fff);overflow-wrap:anywhere;padding:12px;border:1px solid var(--card-border,#cbd5e1);border-radius:10px;margin-bottom:12px}.scan-actions button{margin:4px;max-width:100%;white-space:normal;overflow-wrap:anywhere}';
        const actions=n('section','','scan-actions');actions.setAttribute('aria-label',t('scanActions'));
        if(data.scanJob){
            const job=data.scanJob;const needsRefresh=job.pending||job.state==='pending';const state=n('p',t('scanState_'+(job.state||'idle')));state.setAttribute('role','status');actions.append(state);
            if(job.total)actions.append(n('p',t('scanProgress')+': '+job.completed+' / '+job.total));
            if(['source_capacity','cancelled','timeout','scan_failed'].includes(job.reason))actions.append(n('p',t('scanFailure_'+job.reason),'warning'));
            const coverage=job.coverage;
            if(coverage?.incomplete===true){
                const details=n('div','','warning');details.append(n('p',t('scanCoverage')));
                const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
                details.append(n('p',t('scanCoverageAttachments')+': '+count(coverage.attachments?.prepared)+' / '+count(coverage.attachments?.total)),n('p',t('scanCoverageLinks')+': '+count(coverage.urls?.selected)+' / '+count(coverage.urls?.total)));
                const reasons=n('ul','');
                for(const [key,present] of [['read_failed',coverage.attachments?.readFailed>0],['size_limit',coverage.attachments?.sizeLimited>0],['resource_limit',coverage.attachments?.omitted>0||coverage.urls?.omitted>0],['inventory_incomplete',coverage.inventoryIncomplete===true]])if(present)reasons.append(n('li',t('scanCoverage_'+key)));
                details.append(reasons);actions.append(details);
            }
            const button=n('button',t(jobBusy?'scanRunning':needsRefresh?'scanRefresh':['completed','incomplete','failed'].includes(job.state)?'scanRepeat':'scanStart'));button.type='button';button.dataset.focusKey='scan-start';button.disabled=jobBusy||job.manualAllowed===false;
            button.addEventListener('click',async()=>{
                if(button.disabled)return;
                button.disabled=true;state.textContent=t('scanRunning');
                try {
                    // A message document can outlive its expiring background
                    // context. Renew the read-only snapshot at this explicit
                    // click; requestScan still verifies the displayed message
                    // and this current token before admitting any provider work.
                    const current=await browser.runtime.sendMessage({action:'getMessageAnalysis',messageId:data.messageId});
                    if(!current?.success || current.messageId!==data.messageId || typeof current.contextToken!=='string' || !current.contextToken || current.contextToken.length>128)throw Error('context');
                    const response=await browser.runtime.sendMessage({action:'requestScan',messageId:data.messageId,contextToken:current.contextToken,operation:needsRefresh?'refresh':'scan'});
                    if(!response?.success)throw Error('scan');
                    state.textContent=t('scanState_'+(response.state||'queued'));
                } catch(_) {state.textContent=t('scanState_failed');button.disabled=false;}
            });actions.append(button);
            const settings=n('button',t('bannerOpenOptions'));settings.type='button';settings.dataset.focusKey='scan-settings';settings.addEventListener('click',()=>browser.runtime.sendMessage({action:'openScanSettings'}));actions.append(settings);
            if(job.migration)actions.append(n('p',t('scanMigrationNotice')));
            const reasons=n('ul','');for(const [id,value] of Object.entries(job.providers||{})){const unique=[...new Set((value.checks||[]).map(c=>c.reason).filter(reason=>reason&&(reason!=='no_resources'||!value.checks.some(c=>!c.reason))))];if(value.state==='failed')unique.push(value.error==='rate_limited'?'quota':'provider_error');if(unique.length)reasons.append(n('li',(brands[id]||id)+': '+unique.map(reason=>t('analysisReason_'+reason)).join(' · ')));}if(reasons.childElementCount)actions.append(reasons);
        }
        if (inline) {
            style.textContent += ':host([data-surface="message"]){--inline-pad:calc(var(--surface-pad,24px) / 2);font:14px/1.4 system-ui}.finding-card{margin-bottom:6px}.inline-toolbar{background:var(--card-bg,#fff);border:1px solid var(--card-border,#cbd5e1);border-radius:8px;padding:4px 8px;display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;font:14px/1.4 system-ui;color:var(--text-color,#192b40);margin-bottom:6px}.finding-card .local-score{font-weight:700}.inline-toolbar>.scan-actions{display:flex;align-items:center;flex:1;flex-wrap:wrap;gap:4px 8px;border:0;padding:0;margin:0;background:transparent;min-width:0}.inline-toolbar>.scan-actions>p{margin:0}.inline-toolbar>.scan-actions>ul,.inline-toolbar>.scan-actions>.warning{flex-basis:100%}.inline-toolbar button{margin:0}.card{padding:var(--inline-pad);font:14px/1.4 system-ui;border-radius:8px}h2{font-size:15px;margin:0 0 4px}p{margin:4px 0}li,details{margin:4px 0}summary{min-height:24px;padding-block:2px}ul{margin:4px 0}.services{gap:6px}.services>li{padding:8px}.service-results,.service-origin{margin:4px 0}.service-results{gap:4px}.service-verdict{padding:1px 6px}button{min-height:var(--control-size,44px);padding:4px 10px}.hybrid-report-link{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0}.hybrid-report-link>span{overflow-wrap:anywhere;min-width:0}.service-resource{min-width:0}.finding-summary{font-weight:650}.finding-overview,.overview-report-link{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.finding-overview p,.overview-report-link span{overflow-wrap:anywhere;min-width:0}.overview-report-link span:empty{display:none}button[aria-disabled=true]{opacity:.65;cursor:wait}.inline-explanation{color:var(--text-muted,#536579)}';
            const toolbar=n('div','','inline-toolbar');
            if(data.scanJob)toolbar.append(actions);toolbar.append(switcher);
            const explanationTexts = new Set([t('analysisLimit'),t('analysisScoreExplanation'),t('analysisExportSensitive')]);
            for(const view of [card,overview]) {
                const explanation=details(view===card?'expert-explanation':'simple-explanation',t('hybridReportExplanation'));explanation.className='inline-explanation';
                for(const node of [...view.children])if(node.tagName==='P'&&explanationTexts.has(node.textContent))explanation.append(node);
                if(explanation.children.length>1)view.append(explanation);
            }
            if(data.sourcePersistenceFailed)overview.append(n('p',persistenceMessage,'warning'));
            if(data.reportArchiveBlocked)overview.append(n('p',t('analysisReportArchiveBlocked'),'warning'));
            root.replaceChildren(style,palette,live,summaryCard,toolbar,card,overview);
        } else root.replaceChildren(style,palette,live,summaryCard,switcher,...(data.scanJob?[actions]:[]),card,overview);
        if (inline) document.__thundyMessageAppearance?.(palette);
        if (wasPresent && changed) live.textContent = [t(title),announcement].join(' · ');
        host.dataset.announcement = announcement;
        if (!wasPresent) { const mount = document.getElementById('analysisSourceMount'); if (mount) mount.append(host); else document.body.prepend(host); }
        if (focused) {
            const target=Array.from(root.querySelectorAll('[data-focus-key]')).find(node => {
                if (node.dataset.focusKey !== focused || node.disabled || node.closest('[hidden]')) return false;
                const disclosure = node.parentElement?.closest('details:not([open])');
                return !disclosure || node.tagName === 'SUMMARY' && disclosure === node.parentElement &&
                    !disclosure.parentElement?.closest('details:not([open])');
            });
            const fallback = focused.startsWith('history-') ? root.querySelector('[data-key="unbound-history"] summary') : switcher;
            (target || fallback)?.focus({preventScroll:true});
        }
        return host;
    }
    function withCache(context, provider, scope, key) {
        if (!context) return context;
        return { ...context, cached: (...args) => context.cached?.(...args), event(event) {
            if(event.phase==='cache'&&typeof ThundyApiDiagnostics!=='undefined')ThundyApiDiagnostics.event(context.diagnosticRun,'cache',{provider,state:event.state,verdict:event.verdict});
            if (event.phase === 'finish' && event.state !== 'failed' && Number.isFinite(event.observedAt)) cacheTime(provider, scope, key, event.observedAt);
            return context.event(event);
        } };
    }
    function labels(get) {
        const keys = ['providerMalicious','providerSuspicious','providerNoDetection','providerUnknown','urlscanReportLink','analysisRunningHeading','analysisLocalNoFinding','analysisLinksGroup','analysisAttachmentsGroup','auditUnavailable','auditDecisionScore','attachmentSaveWithThundy','attachmentSaveRequested','attachmentOpenWithThundy','attachmentOpenRequested','attachmentOpenFailed','attachmentFailed','attachmentReadFailed','attachmentContextChanged','analysisOverviewOpenReport','analysisOverviewOpenFinding','analysisLocalOnly','analysisProviderFindingsCount','analysisProviderPendingCount','analysisProviderErrorsCount','hybridReportOpen','hybridReportUnavailable','hybridReportTechnical','hybridReportExplanation','localScoreMessage','apiDebugOpen','apiDebugFailureHint',...['snapshot_invalid','snapshot_collision','snapshot_count','snapshot_bytes','storage_failed'].map(reason=>'analysisPersistence_'+reason),'analysisQuotaReset','analysisRetryAt','analysisLocalBackoff','hybridExpertEmpty','hybridExpertTitle','hybridExpertScope','hybridExpertMissing','hybridExpertYes','hybridExpertNo','hybridExpert_identity','hybridExpert_assessment','hybridExpert_scanners','hybridExpert_antivirus','hybridExpert_reports','hybridExpert_counts','hybridExpert_signatures','hybridExpert_mitre','hybridExpert_network','hybridExpert_processes','hybridExpert_extracted','hybridExpert_certificates','assessmentCompletion','assessmentCompletion_pending','assessmentCompletion_complete','assessmentCompletion_unknown','assessmentCompletion_failed','assessmentConflict','assessmentSignals','assessmentJob',...['verdict','scanner','threat_score','multiscan_result','threat_level','whitelist','overall','urlscan','engines','brand','report'].map(c=>'assessmentSignal_'+c),'scanCoverage','scanCoverageAttachments','scanCoverageLinks','scanCoverage_read_failed','scanCoverage_size_limit','scanCoverage_resource_limit','scanCoverage_inventory_incomplete','scanFailure_source_capacity','scanFailure_cancelled','scanFailure_timeout','scanFailure_scan_failed','scanActions','scanStart','scanRepeat','scanRefresh','scanRunning','scanProgress','scanMigrationNotice','scanState_idle','scanState_queued','scanState_running','scanState_completed','scanState_pending','scanState_incomplete','scanState_failed','scanState_blocked','scanState_deferred','bannerOpenOptions','auditLocalScore','analysisProviderConfigured','analysisProviderNoKey','analysisSimple','analysisExpert','analysisSimpleDocumentationIncomplete','analysisSimpleNone','analysisSimpleCaution','analysisSimpleDanger','analysisSimpleIncomplete','analysisSimpleBasis','analysisScoreExplanation','analysisApprovalRequired','analysisContinueWarning','analysisConflict','analysisExportSensitive','analysisModeResponses','analysisModeResponsesFailed','analysisCurrentAvailability','analysisStoredDataIncomplete','analysisCurrentFindWarning','analysisHistoryPages','analysisHistoryEntries','analysisHistoryFlagged','analysisHistoryFindWarning','auditPrevious','auditNext','analysisReportArchiveBlocked','analysisHistoryTitle','analysisHistoryWarning','analysisPersistenceFailed','analysisResources','analysisResourceLocal','analysisResourceTarget','analysisResourceNoExternal','analysisModeUnknown','analysisModeRunning','analysisModeSubmitted','analysisModeIncomplete','analysisModePartial','analysisModeFailed','analysisModeResults','analysisResourceMessage','analysisResourceAttachment','analysisResourceLink','analysisResourceUnknown','analysisTruncated','analysisUnavailable','analysisTitle','analysisUnknown','analysisTimeUnknown','analysisMixed','analysisExternal','analysisLocal','analysisLocalChecked','analysisLocalIncomplete','analysisLocalUnavailable','analysisLocalPending','analysisObserved','analysisFindingObserved','analysisAttempted','analysisPartial','analysisOtherServices','analysisLimit'];
        for (const [prefix, values] of [['Scope',scopes],['State',states],['Source',['remote','cache','stored','attempt']],['Verdict',verdicts],['Reason',['unconfigured','disabled','permission','authorization','policy','on_action','unrecorded','manual','sender','links_disabled','no_resources','quota','running','provider_error']]]) for (const value of values) keys.push('analysis'+prefix+'_'+value);
        return Object.fromEntries(keys.map(key => [key, get(key)]));
    }
    return { refreshStored, providers, scopes, create, spec, response, resources, legacy, history, render, cacheTime, labels, withCache, bind, validResource, rowKey };
})();
