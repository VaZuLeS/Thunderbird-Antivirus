/* Read-only, resource-bound Hybrid Analysis snapshots. No provider transport. */
const ThundyHybridReport = (() => {
    const groups = ['identity','assessment','scanners','antivirus','reports','counts','signatures','mitre','network','processes','extracted','certificates'];
    const warningRank = {suspicious:1,malicious:2};
    const validRef = value => typeof value === 'string' && /^(attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(value) && value.length <= 80;
    const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,8192) : null;
    function project(item, resourceRef, local = null, rows = []) {
        if (!item || !validRef(resourceRef)) throw Error('REPORT_UNAVAILABLE');
        const roots = (Array.isArray(item.report) ? item.report : [item.report]).filter(v => v && typeof v === 'object' && !Array.isArray(v));
        const expected = typeof item.hybrid_sha256 === 'string' && /^[a-f0-9]{64}$/i.test(item.hybrid_sha256) ? item.hybrid_sha256.toLowerCase() : null;
        let budget = 450000, truncated = roots.length > 20;
        const reports = [];
        for (const root of roots.slice(0,20)) {
            if (root.sha256 != null && (typeof root.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(root.sha256) || expected && root.sha256.toLowerCase() !== expected)) { truncated = true;continue; }
            const details = ThundyProviderResults.hybridDetails(root, expected);
            const evaluation = ThundyProviderResults.evaluate('hybridanalysis', root);
            const report = {index:reports.length + 1,sections:details.sections,emptySections:details.emptySections,
                truncated:details.truncated,verdict:evaluation.verdict,completion:evaluation.completion,conflicts:evaluation.conflicts,
                observedAt:Number.isFinite(Date.parse(item.report_fetched_at)) ? Date.parse(item.report_fetched_at) : null,
                origin:'stored',referenceBinding:expected && root.sha256 ? 'hash' : 'resource',
                missingSections:groups.filter(id => !details.sections.some(s => s.id === id) && !details.emptySections.includes(id))};
            const length = JSON.stringify(report).length;
            if (length > budget) { truncated = true;break; }
            budget -= length;reports.push(report);
        }
        if (!reports.length) throw Error('REPORT_UNAVAILABLE');
        let target = null, urlTruncated = false;
        try { const url = new URL(item.url);if (['http:','https:'].includes(url.protocol)) {target = clean(url.href);urlTruncated = url.href.length > 8192;} } catch (_) { /* attachment */ }
        const retained = (rows || []).filter(row => row?.provider === 'hybridanalysis' &&
            row.resource === resourceRef && (resourceRef.startsWith('link:')
                ? ['url','report'].includes(row.scope) : ['hash','file','report'].includes(row.scope)) &&
            Object.hasOwn(warningRank,row.verdict))
            .sort((a,b) => warningRank[b.verdict] - warningRank[a.verdict] || (b.findingAt || 0) - (a.findingAt || 0))[0];
        const retainedFinding = retained ? {verdict:retained.verdict,
            findingAt:Number.isFinite(retained.findingAt) ? retained.findingAt : null,
            attemptedAt:Number.isFinite(retained.attemptedAt) ? retained.attemptedAt : null} : null;
        return {schemaVersion:2,kind:'thundy-hybrid-report',resourceRef,
            resource:{name:clean(item.attachment_name),url:target,quickScanId:typeof item.hybrid_quick_scan_id==='string' && /^[a-z0-9_-]{1,128}$/i.test(item.hybrid_quick_scan_id) ? item.hybrid_quick_scan_id : null,urlTruncated,sha256:expected},
            local:local && Number.isFinite(local.score) ? {score:local.score,state:local.state} : null,
            capturedAt:Date.now(),reports,truncated,retainedFinding};
    }
    function broker(api, resolve, clock = Date.now, uuid = () => crypto.randomUUID()) {
        let generation = 0;
        const views = new Map(), page = api.runtime.getURL('hybrid_report.html');
        const prune = () => { for (const [key,v] of views) if (v.expires <= clock()) views.delete(key); };
        async function command(request, sender) {
            if (sender?.id !== api.runtime.id) throw Error('REPORT_UNAVAILABLE');
            prune();
            if (request.action === 'openHybridReport') {
                if (!Number.isSafeInteger(request.messageId) || request.messageId < 1 || !validRef(request.resourceRef) || typeof request.contextToken !== 'string' || request.contextToken.length > 128) throw Error('REPORT_UNAVAILABLE');
                const own = generation, report = await resolve(request);
                if (own !== generation) throw Error('REPORT_UNAVAILABLE');
                if (report?.schemaVersion !== 2 || report.resourceRef !== request.resourceRef) throw Error('REPORT_UNAVAILABLE');
                while (views.size >= 20) views.delete(views.keys().next().value);
                const token = uuid(), view = {report,expires:clock()+5*60000,tabId:null,ready:null};
                views.set(token,view);
                try {
                    view.ready = api.tabs.create({url:page+'#'+token});
                    const tab = await view.ready;view.tabId = tab.id;
                } catch (error) { views.delete(token);throw error; }
                return {success:true};
            }
            if (request.action !== 'readHybridReport' || typeof request.token !== 'string' || request.token.length > 128 || sender.url?.split('#')[0] !== page) throw Error('REPORT_UNAVAILABLE');
            const view = views.get(request.token);
            if (!view || sender.url !== page+'#'+request.token) throw Error('REPORT_UNAVAILABLE');
            const tab = await view.ready;
            if (views.get(request.token) !== view || view.expires <= clock() || sender.tab?.id !== tab.id) throw Error('REPORT_UNAVAILABLE');
            return {success:true,report:JSON.parse(JSON.stringify(view.report))};
        }
        api.tabs.onRemoved?.addListener(id => {for (const [key,v] of views) if (v.tabId === id) views.delete(key);});
        return {command,clear:() => {generation++;views.clear();}};
    }
    function mount(api, document, location) {
        const get = id => document.getElementById(id), t = key => ThundyI18n.get(key);
        const status = get('hybridReportStatus');
        const overview = get('hybridReportOverview'), content = get('hybridReportContent');
        const filters = get('hybridReportFilters'), select = get('hybridReportSelect');
        const search = get('hybridReportSearch'), sectionFilter = get('hybridReportSection');
        const previous = get('hybridReportPrevious'), next = get('hybridReportNext');
        const pages = get('hybridReportPages'), countStatus = get('hybridReportCount');
        const pageSize = 50;
        let snapshot = null, disposed = false, pageIndex = 0, copyGeneration = 0, loadGeneration = 0;
        const text = (tag,value,cls='') => {
            const el = document.createElement(tag);
            el.textContent = String(value);
            el.className = cls;
            return el;
        };
        const fieldLabel = key => t(key === 'quickScanId' ? 'hybridReportResource_quickScanId' : 'hybridField_'+key);
        const valueText = value => typeof value === 'boolean' ? t(value ? 'hybridExpertYes' : 'hybridExpertNo') : String(value);
        const date = value => new Date(value).toLocaleString(document.documentElement.lang || undefined);
        const activeReport = () => snapshot.reports[Number(select.value) || 0];
        const assessment = report => report.sections.find(section => section.id === 'assessment')?.rows?.[0] || [];
        const appendField = (list,label,value) => list.append(text('dt',label),text('dd',value));
        const appendTime = (list,label,value) => {
            if (!Number.isFinite(value) || Number.isNaN(new Date(value).getTime())) return;
            const time = text('time',date(value));
            time.dateTime = new Date(value).toISOString();
            const valueCell = text('dd','','report-time');
            valueCell.append(time,copy(time.dateTime,label,t('hybridReportCopyUtc')));
            list.append(text('dt',label),valueCell);
        };
        const copy = (value, label = '', action = t('hybridReportCopy')) => {
            const button = text('button',action);
            button.type = 'button';
            if (label) button.setAttribute('aria-label',action+' · '+label);
            button.addEventListener('click',async () => {
                const own = ++copyGeneration;
                try {
                    await document.defaultView.navigator.clipboard.writeText(value);
                    if (!disposed && own === copyGeneration) status.textContent = t('hybridReportCopied');
                } catch (_) {
                    if (!disposed && own === copyGeneration) status.textContent = t('hybridReportCopyFailed');
                }
            });
            return button;
        };
        function paintOverview() {
            const report = activeReport();
            const card = text('section','','card report-overview');
            const identity = snapshot.resource.url || snapshot.resource.name;
            const identityRow = text('div','','report-value');
            identityRow.append(text('h2',identity || t('hybridExpert_identity'),'report-identity'));
            if (identity) {
                const label = t(snapshot.resource.url ? 'hybridReportResource_url' : 'hybridReportResource_name');
                identityRow.append(copy(identity,label));
            }
            card.append(identityRow);
            const verdict = text('p','Hybrid Analysis · '+t('analysisVerdict_'+(report.verdict || 'unknown')),
                Object.hasOwn(warningRank,report.verdict) ? 'report-verdict warning' : 'report-verdict');
            card.append(verdict,text('p',t('hybridReportSaved')+' · '+select.options[Number(select.value) || 0].textContent,'report-run'));
            const fields = text('dl','');
            appendField(fields,t('assessmentCompletion'),t('hybridReportProcessing_'+(report.completion || 'unknown')));
            const local = snapshot.local;
            appendField(fields,t('localScoreMessage'),local?.state !== 'failed' && Number.isFinite(local?.score)
                ? local.score+' / 100' : t('auditUnavailable'));
            for (const key of ['verdict','threat_score','threat_level','vx_family','analysis_start_time']) {
                const field = assessment(report).find(field => field.key === key);
                if (field) appendField(fields,fieldLabel(key),valueText(field.value));
            }
            appendTime(fields,t('hybridReportRetrievedAt'),report.observedAt);
            appendTime(fields,t('hybridReportCapturedAt'),snapshot.capturedAt);
            card.append(fields);
            const retained = snapshot.retainedFinding;
            if (retained && warningRank[retained.verdict] > (warningRank[report.verdict] || 0)) {
                const notice = text('div','','warning retained-finding');
                notice.append(text('strong',t('hybridReportRetainedFinding')+' · '+t('analysisVerdict_'+retained.verdict)));
                const times = text('dl','');
                appendTime(times,t('analysisFindingObserved'),retained.findingAt);
                appendTime(times,t('analysisAttempted'),retained.attemptedAt);
                if (times.childElementCount) notice.append(times);
                card.append(notice);
            }
            if (report.conflicts?.includes('mixed_verdicts')) card.append(text('p',t('assessmentConflict'),'warning'));
            if (snapshot.truncated || report.truncated || snapshot.resource.urlTruncated) card.append(text('p',t('analysisTruncated'),'warning'));
            if (report.missingSections.length || report.emptySections.length) {
                const availability = text('details','');
                availability.append(text('summary',t('hybridReportAvailability')));
                if (report.missingSections.length) availability.append(text('p',t('hybridExpertMissing')+': '+report.missingSections.map(id=>t('hybridExpert_'+id)).join(', ')));
                if (report.emptySections.length) availability.append(text('p',t('hybridExpertEmpty')+': '+report.emptySections.map(id=>t('hybridExpert_'+id)).join(', ')));
                card.append(availability);
            }
            overview.replaceChildren(card);
        }
        function paintSections() {
            if (!snapshot || disposed) return;
            const report = activeReport(), query = search.value.trim().toLocaleLowerCase();
            const matches = new Map(groups.map(id => [id,[]]));
            const add = (id,fields) => {
                const searchable = [t('hybridExpert_'+id),id,...fields.map(f => fieldLabel(f.key)+' '+f.key+' '+valueText(f.value))].join(' ').toLocaleLowerCase();
                if (!query || searchable.includes(query)) matches.get(id).push(fields);
            };
            const identityRows = report.sections.find(section => section.id === 'identity')?.rows || [];
            const resourceFields = ['sha256','quickScanId'].flatMap(key => {
                const value = snapshot.resource[key];
                if (!value || identityRows.some(row => row.some(field => field.key === key && field.value === value))) return [];
                return [{key,value}];
            });
            if (resourceFields.length) add('identity',resourceFields);
            for (const section of report.sections) {
                for (const fields of section.rows) add(section.id,fields);
            }
            const selected = sectionFilter.value;
            const total = [...matches.values()].reduce((sum,rows) => sum+rows.length,0);
            sectionFilter.replaceChildren();
            const addOption = (value,label,count) => {
                const option = text('option',label+' ('+count+')');
                option.value = value;
                sectionFilter.append(option);
            };
            addOption('',t('hybridReportAllSections'),total);
            for (const id of groups) addOption(id,t('hybridExpert_'+id),matches.get(id).length);
            sectionFilter.value = selected;
            const selectedCount = selected ? matches.get(selected).length : total;
            const pageCount = selected ? Math.max(1,Math.ceil(selectedCount/pageSize)) : 1;
            pageIndex = Math.min(pageIndex,pageCount-1);
            countStatus.textContent = selectedCount+' · '+t('hybridReportAvailableOnly');
            pages.hidden = pageCount === 1;
            get('hybridReportPage').textContent = (pageIndex+1)+' / '+pageCount;
            previous.disabled = pageIndex === 0;
            next.disabled = pageIndex+1 >= pageCount;
            const open = new Set([...content.querySelectorAll('details[open]')].map(el=>el.dataset.section));
            content.replaceChildren();
            for (const id of selected ? [selected] : groups) {
                const matchesInSection = matches.get(id);
                if (!matchesInSection.length) continue;
                const rows = matchesInSection.slice(pageIndex*pageSize,(pageIndex+1)*pageSize);
                const section = text('details','','card');
                section.dataset.section = id;
                section.open = !!(open.has(id) || id === 'identity' || query || selected);
                section.append(text('summary',t('hybridExpert_'+id)+' · '+matchesInSection.length));
                const list = text('ol','');
                for (const fields of rows) {
                    const li = text('li',''), dl = text('dl','');
                    for (const field of fields) {
                        const label = fieldLabel(field.key), value = valueText(field.value);
                        const dt = text('dt',label), dd = text('dd',value);
                        dt.append(text('code',field.key));
                        if (['sha256','sha1','md5','sha512','imphash','domains','hosts','compromised_hosts','domain','host','ip','quickScanId'].includes(field.key)) dd.append(copy(value,label));
                        dl.append(dt,dd);
                    }
                    li.append(dl);
                    list.append(li);
                }
                section.append(list);
                if (!selected && matchesInSection.length > pageSize) {
                    const show = text('button',t('hybridReportSection')+' · '+t('hybridExpert_'+id));
                    show.type = 'button';
                    show.addEventListener('click',() => {
                        sectionFilter.value = id;
                        sectionFilter.focus();
                        restartSections();
                    });
                    section.append(show);
                }
                content.append(section);
            }
            if (!selectedCount) content.append(text('p',t('hybridReportNoMatches')));
        }
        function restartSections() {
            pageIndex = 0;
            paintSections();
        }
        select.addEventListener('change',() => {paintOverview();restartSections();});
        search.addEventListener('input',restartSections);
        sectionFilter.addEventListener('change',restartSections);
        function movePage(step) {
            const active = document.activeElement;
            pageIndex += step;
            paintSections();
            if (active === previous && previous.disabled) next.focus();
            else if (active === next && next.disabled) previous.focus();
        }
        previous.addEventListener('click',() => movePage(-1));
        next.addEventListener('click',() => movePage(1));
        const reset = () => {
            loadGeneration++;
            snapshot = null;
            copyGeneration++;
            overview.replaceChildren();
            content.replaceChildren();
            select.replaceChildren();
            sectionFilter.replaceChildren();
            search.value = '';
            search.disabled = true;
            filters.hidden = true;
            pages.hidden = true;
            countStatus.textContent = '';
            status.textContent = t('hybridReportUnavailable');
        };
        const listener = request => {if(request?.action==='memoryCachesCleared')reset();};api.runtime.onMessage.addListener(listener);
        const ready = (async () => {
            try {
                const own = loadGeneration, token=location.hash.slice(1);if(!/^[a-f0-9-]{36}$/i.test(token))throw Error('token');
                const result=await api.runtime.sendMessage({action:'readHybridReport',token});
                if(disposed || own !== loadGeneration)return;
                if(!result?.success || result.report?.schemaVersion!==2 || !result.report.reports?.length)throw Error('report');
                snapshot = result.report;
                for (const [index,report] of snapshot.reports.entries()) {
                    const metadata = assessment(report);
                    const env = metadata.find(f => f.key === 'environment_description')?.value ?? metadata.find(f => f.key === 'environment_id')?.value;
                    const job = metadata.find(f => f.key === 'job_id')?.value;
                    const label = [t('hybridReportRun')+' '+(index+1),env,job].filter(value => value != null && value !== '').join(' · ');
                    const option = text('option',label);
                    option.value = String(index);
                    select.append(option);
                }
                get('hybridReportRunFilter').hidden = snapshot.reports.length === 1;
                filters.hidden = false;
                search.disabled = false;
                status.textContent = '';
                paintOverview();
                restartSections();
            } catch (_) {if(!disposed)reset();}
        })();
        const dispose=()=>{disposed=true;reset();api.runtime.onMessage.removeListener(listener);};document.defaultView.addEventListener('pagehide',dispose,{once:true});
        return {ready,dispose};
    }
    return {project,broker,mount};
})();
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('hybridReportContent'))ThundyHybridReport.mount(browser,document,location);},{once:true});
