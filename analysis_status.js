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
    // References point into existing message records; never duplicate resource contents.
    const validResource = ref => ref === 'message' || typeof ref === 'string' && (/^attachment:[0-9]+(?:\.[0-9]+)*$/.test(ref) && ref.length <= 80 || /^link:[0-9]{1,6}$/.test(ref));
    const rowKey = row => [row.provider, row.scope, row.resource || 'unknown'].join(':');
    function create(stored = {}) {
        const data = { schemaVersion: 2, local: { state: 'unrecorded', observedAt: null }, rows: [], truncated: stored.truncated === true };
        if ([1, 2].includes(stored.schemaVersion)) {
            if (['checked','incomplete','failed'].includes(stored.local?.state)) data.local = { state: stored.local.state, observedAt: Number.isFinite(stored.local.observedAt) ? stored.local.observedAt : null, source: 'stored', ...(['decryption_unavailable','text_unavailable','read_failed'].includes(stored.local.reason) ? {reason:stored.local.reason} : {}) };
            for (const old of (Array.isArray(stored.rows) ? stored.rows : []).slice(0, 1200)) if (providers.includes(old.provider) && scopes.includes(old.scope)) {
                const row = { provider: old.provider, scope: old.scope, resource: validResource(old.resource) ? old.resource : null, source: 'stored', active: 0, state: states.includes(old.state) && old.state !== 'running' ? old.state : 'incomplete', verdict: verdicts.includes(old.verdict) ? old.verdict : 'unknown', responses: Number.isSafeInteger(old.responses) && old.responses > 0 ? Math.min(old.responses, 100000) : 0, failures: Number.isSafeInteger(old.failures) && old.failures > 0 ? Math.min(old.failures, 100000) : 0, cacheHits: Number.isSafeInteger(old.cacheHits) && old.cacheHits > 0 ? Math.min(old.cacheHits, 100000) : 0, observedAt: Number.isFinite(old.observedAt) ? old.observedAt : null, findingAt: Number.isFinite(old.findingAt) ? old.findingAt : null, attemptedAt: Number.isFinite(old.attemptedAt) ? old.attemptedAt : null };
                if (!data.rows.some(current => rowKey(current) === rowKey(row))) data.rows.push(row);
            }
            if (stored.rows?.length > 1200) data.truncated = true;
        }
        function event(e) {
            if (!e || !providers.includes(e.provider) || !scopes.includes(e.scope) || !['start', 'finish', 'cache'].includes(e.phase) || e.resource != null && !validResource(e.resource)) return false;
            if (e.phase !== 'start' && (!states.includes(e.state) || !verdicts.includes(e.verdict))) return false;
            const resource = e.resource || null;
            let row = data.rows.find(r => r.provider === e.provider && r.scope === e.scope && r.resource === resource);
            if (!row) {
                if (data.rows.length >= 1200) { data.truncated = true; return false; }
                row = { provider: e.provider, scope: e.scope, resource, state: 'running', verdict: 'unknown', source: 'attempt', active: 0, responses: 0, failures: 0, cacheHits: 0, observedAt: null, attemptedAt: null };
                data.rows.push(row);
            }
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
        const documented = new Set(model.data.rows.map(rowKey));
        const attachments = Array.isArray(record?.attachments) ? record.attachments : [];
        const links = Array.isArray(record?.links) ? record.links : [];
        for (const [item, resource] of [...attachments.map(item => [item, validResource('attachment:' + item.partName) ? 'attachment:' + item.partName : null]), ...links.map((item,index) => [item, validResource(item.analysisResourceRef) ? item.analysisResourceRef : 'link:' + index])]) {
            const report = item.report;
            if (report || ['KNOWN', 'UPLOADED'].includes(item.state)) {
                const info = { provider: 'hybridanalysis', scope: report ? 'report' : item.url ? 'url' : item.state === 'UPLOADED' ? 'file' : 'hash', resource };
                if (!documented.has(rowKey(info))) model.event({ ...info, phase: 'cache', ...(report ? response(info, 200, report) : { state: item.state === 'UPLOADED' ? 'submitted' : 'received', verdict: 'unknown' }), observedAt: report && Number.isFinite(Date.parse(item.report_fetched_at)) ? Date.parse(item.report_fetched_at) : null });
            }
            const vt = {provider:'virustotal',scope:'hash',resource};
            if (!documented.has(rowKey(vt)) && Number.isFinite(item.virustotal_stats?.malicious)) model.event({ ...vt, phase: 'cache', state: 'checked', verdict: item.virustotal_stats.malicious > 0 ? 'malicious' : item.virustotal_stats.suspicious > 0 ? 'suspicious' : 'none', observedAt: null });
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
        const add = stored => {
            if (!stored || typeof stored !== 'object') return;
            if (result.rows.length >= 1200) { result.truncated = true; return; }
            const restored = create(stored);
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
        const rows = data.rows || [], local = data.local?.state === 'checked', localLimited = ['incomplete','failed'].includes(data.local?.state);
        const running = rows.some(row => row.state === 'running'), waiting = rows.some(row => row.state === 'submitted'), incomplete = rows.some(row => row.state === 'incomplete');
        const failures = rows.some(row => row.failures > 0 || row.state === 'failed'), usable = rows.some(row => row.responses > 0 || row.cacheHits > 0);
        const mode = t(data.unavailable ? 'analysisUnavailable' : rows.length ? local || localLimited ? 'analysisMixed' : 'analysisExternal' : local || localLimited ? 'analysisLocal' : 'analysisModeUnknown');
        const phase = t(running ? 'analysisModeRunning' : waiting ? 'analysisModeSubmitted' : failures ? usable ? 'analysisModePartial' : 'analysisModeFailed' : incomplete ? 'analysisModeIncomplete' : usable ? 'analysisModeResults' : 'analysisModeUnknown');
        const card = n('div', '', 'card'); card.append(n('h2', t('analysisTitle')), n('p', mode, 'mode'));
        if (rows.length) card.append(n('p',phase, failures ? 'phase warning' : 'phase'));
        const localLabel = t(data.local?.state === 'failed' ? 'analysisLocalUnavailable' : localLimited ? 'analysisLocalIncomplete' : local ? 'analysisLocalChecked' : 'analysisLocalPending');
        card.append(n('p', localLabel, localLimited ? 'warning' : 'muted'));
        const brands = { hybridanalysis: 'Hybrid Analysis', virustotal: 'VirusTotal', urlhaus: 'URLhaus', abuseipdb: 'AbuseIPDB', urlscan: 'urlscan.io' };
        const list = document.createElement('ul'), inactive = document.createElement('ul');
        const details = (key, title) => { const node = document.createElement('details'); node.dataset.key = key; node.open = opened.has(key); const summary = n('summary',title); summary.dataset.focusKey = key; node.append(summary); return node; };
        const resourceName = row => {
            if (row.resource === 'message') return t('analysisResourceMessage');
            if (row.resource?.startsWith('attachment:')) return t('analysisResourceAttachment') + ' · ' + (data.resourceLabels?.[row.resource] || row.resource.slice(11));
            if (row.resource?.startsWith('link:')) return t('analysisResourceLink') + ' ' + (Number(row.resource.slice(5)) + 1) + (data.resourceLabels?.[row.resource] ? ' · ' + data.resourceLabels[row.resource] : '');
            return t('analysisResourceUnknown');
        };
        for (const [provider, brand] of Object.entries(brands)) {
            const items = rows.filter(row => row.provider === provider), li = document.createElement('li'); li.append(n('strong', brand));
            if (items.length) {
                li.append(n('div', [...new Set(items.map(row => t('analysisState_' + row.state)))].join(' · '), 'service-status'));
                if (items.some(row => row.failures && row.responses)) li.append(n('div',t('analysisPartial'),'warning'));
                if (['disabled','permission','authorization','policy','unconfigured'].includes(data.availability?.[provider])) li.append(n('div', t('analysisReason_' + data.availability[provider]), 'muted'));
                for (const row of items) {
                    const key = [provider,row.scope,row.resource || 'unknown'].join(':');
                    const warning = ['malicious','suspicious'].includes(row.verdict);
                    const entry = details(key, resourceName(row) + ' · ' + t('analysisScope_' + row.scope) + ' · ' + t('analysisState_' + row.state) + ' · ' + t('analysisSource_' + row.source) + (warning ? ' · ' + t('analysisVerdict_' + row.verdict) : ''));
                    if (warning) entry.querySelector('summary').className = 'warning';
                    if (row.verdict && row.verdict !== 'unknown') entry.append(n('p', t('analysisVerdict_' + row.verdict), warning ? 'warning' : ''));
                    entry.append(n('p', t('analysisFindingObserved') + ': ' + date(row.findingAt)));
                    entry.append(n('small', t('analysisObserved') + ': ' + date(row.observedAt) + ' · ' + t('analysisAttempted') + ': ' + date(row.attemptedAt)));
                    li.append(entry);
                }
                list.append(li);
            } else { li.append(n('div', t('analysisReason_' + (data.availability?.[provider] || 'unrecorded')), 'muted')); inactive.append(li); }
        }
        const strongest = rows.some(row => row.verdict === 'malicious') ? 'malicious' : rows.some(row => row.verdict === 'suspicious') ? 'suspicious' : null;
        if (strongest) { card.style.borderColor = 'var(--color-danger,#b32642)'; card.append(n('p', t('analysisVerdict_' + strongest), 'warning')); }
        card.append(list);
        if (inactive.childElementCount) { const other = details('other',t('analysisOtherServices')); other.append(inactive); card.append(other); }
        const refs = Object.keys(data.resourceLabels || {}).filter(ref => /^attachment:[0-9]+(?:\.[0-9]+)*$/.test(ref) || /^link:[0-9]{1,6}$/.test(ref));
        if (refs.length) {
            const inventory = details('resources', t('analysisResources'));
            const resources = document.createElement('ul');
            for (const resource of refs.slice(0,500)) {
                const item = n('li',resourceName({resource}));
                item.append(n('div',t(resource.startsWith('attachment:') ? 'analysisResourceLocal' : 'analysisResourceTarget'),'muted'));
                const providers = [...new Set(rows.filter(row => row.resource === resource).map(row => brands[row.provider]).filter(Boolean))];
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
        if (data.sourcePersistenceFailed) card.append(n('p',t('analysisPersistenceFailed'),'warning'));
        if (data.reportArchiveBlocked) card.append(n('p',t('analysisReportArchiveBlocked'),'warning'));
        card.append(n('p', t('analysisLimit'), 'muted'));
        const announcement = [mode, localLabel, rows.length ? phase : '', data.sourceHistory?.rows?.length ? t('analysisHistoryTitle') : '', historicalWarning ? t('analysisHistoryFlagged') : '', data.sourcePersistenceFailed ? t('analysisPersistenceFailed') : '', data.reportArchiveBlocked ? t('analysisReportArchiveBlocked') : '', ...Object.entries(brands).filter(([provider]) => rows.some(row => row.provider === provider)).map(([,brand]) => brand), strongest ? t('analysisVerdict_' + strongest) : ''].filter(Boolean).join(' · ');
        const changed = host.dataset.announcement !== announcement;
        root.replaceChildren(style, live, card);
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
        return { cached: (...args) => context.cached?.(...args), event(event) {
            if (event.phase === 'finish' && event.state !== 'failed' && Number.isFinite(event.observedAt)) cacheTime(provider, scope, key, event.observedAt);
            return context.event(event);
        } };
    }
    function labels(get) {
        const keys = ['analysisHistoryPages','analysisHistoryEntries','analysisHistoryFlagged','analysisHistoryFindWarning','auditPrevious','auditNext','analysisReportArchiveBlocked','analysisHistoryTitle','analysisHistoryWarning','analysisPersistenceFailed','analysisResources','analysisResourceLocal','analysisResourceTarget','analysisResourceNoExternal','analysisModeUnknown','analysisModeRunning','analysisModeSubmitted','analysisModeIncomplete','analysisModePartial','analysisModeFailed','analysisModeResults','analysisResourceMessage','analysisResourceAttachment','analysisResourceLink','analysisResourceUnknown','analysisTruncated','analysisUnavailable','analysisTitle','analysisUnknown','analysisTimeUnknown','analysisMixed','analysisExternal','analysisLocal','analysisLocalChecked','analysisLocalIncomplete','analysisLocalUnavailable','analysisLocalPending','analysisObserved','analysisFindingObserved','analysisAttempted','analysisPartial','analysisOtherServices','analysisLimit'];
        for (const [prefix, values] of [['Scope',scopes],['State',states],['Source',['remote','cache','stored','attempt']],['Verdict',verdicts],['Reason',['unconfigured','disabled','permission','authorization','policy','on_action','unrecorded']]]) for (const value of values) keys.push('analysis'+prefix+'_'+value);
        return Object.fromEntries(keys.map(key => [key, get(key)]));
    }
    return { providers, scopes, create, spec, response, legacy, history, render, cacheTime, labels, withCache, bind, validResource, rowKey };
})();
