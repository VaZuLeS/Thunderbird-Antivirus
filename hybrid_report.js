/* Read-only, resource-bound Hybrid Analysis snapshots. No provider transport. */
const ThundyHybridReport = (() => {
    const groups = ['identity','assessment','scanners','antivirus','reports','counts','signatures','mitre','network','processes','extracted','certificates'];
    const validRef = value => typeof value === 'string' && /^(attachment:[0-9]+(?:\.[0-9]+)*|link:[0-9]{1,6})$/.test(value) && value.length <= 80;
    const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,8192) : null;
    function project(item, resourceRef, local = null) {
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
        let target = null;
        try { const url = new URL(item.url);if (['http:','https:'].includes(url.protocol)) target = clean(item.url); } catch (_) { /* attachment */ }
        return {schemaVersion:2,kind:'thundy-hybrid-report',resourceRef,
            resource:{name:clean(item.attachment_name),url:target,quickScanId:typeof item.hybrid_quick_scan_id==='string' && /^[a-z0-9_-]{1,128}$/i.test(item.hybrid_quick_scan_id) ? item.hybrid_quick_scan_id : null,urlTruncated:typeof item.url === 'string' && item.url.length > 8192,sha256:expected},
            local:local && Number.isFinite(local.score) ? {score:local.score,state:local.state} : null,
            capturedAt:Date.now(),reports,truncated};
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
        const status = get('hybridReportStatus'), content = get('hybridReportContent'), select = get('hybridReportSelect'), search = get('hybridReportSearch');
        let snapshot = null, disposed = false, pageIndex = 0, copyGeneration = 0, loadGeneration = 0;
        const text = (tag,value,cls='') => {const el=document.createElement(tag);el.textContent=String(value);el.className=cls;return el;};
        const fieldLabel = key => t('hybridField_'+key);
        const valueText = value => typeof value === 'boolean' ? t(value ? 'hybridExpertYes' : 'hybridExpertNo') : String(value);
        const time = value => Number.isFinite(value) && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(document.documentElement.lang || undefined)+' · '+new Date(value).toISOString() : t('analysisTimeUnknown');
        const copy = (value, label = '') => {
            const button = text('button',t('hybridReportCopy'));button.type='button';if(label)button.setAttribute('aria-label',t('hybridReportCopy')+' · '+label);
            button.addEventListener('click',async () => {const own=++copyGeneration;try {await document.defaultView.navigator.clipboard.writeText(value);if(!disposed&&own===copyGeneration)status.textContent=t('hybridReportCopied');} catch (_) {if(!disposed&&own===copyGeneration)status.textContent=t('hybridReportCopyFailed');}});return button;
        };
        function paint() {
            if (!snapshot || disposed) return;
            const report = snapshot.reports[Number(select.value) || 0], query = search.value.trim().toLocaleLowerCase();
            const open = new Set([...content.querySelectorAll('details[open]')].map(el=>el.dataset.section));
            content.replaceChildren();
            const header = text('section','','card');header.append(text('h2',t('hybridReportSummary')),
                text('p',t('hybridReportSnapshot')+' · '+time(snapshot.capturedAt)),
                text('p',t('localScoreMessage')+': '+(snapshot.local?.state!=='failed' && Number.isFinite(snapshot.local?.score) ? snapshot.local.score+' / 100' : t('auditUnavailable'))),
                text('p','Hybrid Analysis · '+t('analysisVerdict_'+(report.verdict || 'unknown'))+' · '+t('assessmentCompletion_'+(report.completion || 'unknown'))),
                text('p',t('analysisObserved')+': '+time(report.observedAt)));
            const assessment = report.sections.find(section=>section.id==='assessment')?.rows?.[0] || [];
            for(const key of ['verdict','threat_score','threat_level','vx_family','environment_description','analysis_start_time']) {
                const field=assessment.find(field=>field.key===key);if(field)header.append(text('p',fieldLabel(key)+': '+valueText(field.value)));
            }
            if(report.conflicts?.includes('mixed_verdicts'))header.append(text('p',t('assessmentConflict'),'warning'));
            if (snapshot.truncated || report.truncated) header.append(text('p',t('analysisTruncated'),'warning'));
            header.append(text('p',t('hybridReportScope'),'muted'));content.append(header);
            const identity = text('section','','card');identity.append(text('h2',t('hybridExpert_identity')));
            for (const [key,value] of Object.entries(snapshot.resource)) if (['name','url','sha256','quickScanId'].includes(key) && value) {
                const row=text('div','','report-value');row.append(text('strong',t('hybridReportResource_'+key)),text('code',value),copy(value));identity.append(row);
            }
            if(snapshot.resource.urlTruncated)identity.append(text('p',t('analysisTruncated'),'warning'));
            content.append(identity);
            const matches = [];
            for (const section of report.sections) for (const fields of section.rows) {
                const searchable=(t('hybridExpert_'+section.id)+' '+section.id+' '+fields.map(f=>fieldLabel(f.key)+' '+f.key+' '+valueText(f.value)).join(' ')).toLocaleLowerCase();
                if(!query || searchable.includes(query))matches.push({section:section.id,fields});
            }
            const pages = Math.max(1,Math.ceil(matches.length/50));pageIndex=Math.min(pageIndex,pages-1);
            get('hybridReportCount').textContent=matches.length+' · '+t('hybridReportAvailableOnly')+' · '+(pageIndex+1)+' / '+pages;
            get('hybridReportPrevious').disabled=pageIndex===0;get('hybridReportNext').disabled=pageIndex+1>=pages;
            const visible=matches.slice(pageIndex*50,(pageIndex+1)*50);
            for (const id of groups) {
                const rows=visible.filter(row=>row.section===id);if(!rows.length)continue;
                const section=text('details','','card');section.dataset.section=id;section.open=open.has(id)||id==='identity'||!!query;
                section.append(text('summary',t('hybridExpert_'+id)+' · '+rows.length));
                const list=text('ol','');for(const row of rows){const li=text('li',''),dl=text('dl','');for(const field of row.fields){const dt=text('dt',fieldLabel(field.key));dt.append(text('code',field.key));const value=valueText(field.value),dd=text('dd',value);if(['sha256','sha1','md5','sha512','imphash','domains','hosts','compromised_hosts','domain','host','ip'].includes(field.key))dd.append(copy(value,fieldLabel(field.key)));dl.append(dt,dd);}li.append(dl);list.append(li);}section.append(list);content.append(section);
            }
            if(!matches.length)content.append(text('p',t('hybridReportNoMatches')));
            const absent = text('section','','card');absent.append(text('h2',t('hybridReportAvailability')),
                text('p',t('hybridExpertEmpty')+': '+(report.emptySections.map(id=>t('hybridExpert_'+id)).join(', ')||'—')),
                text('p',t('hybridExpertMissing')+': '+(report.missingSections.map(id=>t('hybridExpert_'+id)).join(', ')||'—')));content.append(absent);
        }
        select.addEventListener('change',()=>{pageIndex=0;paint();});search.addEventListener('input',()=>{pageIndex=0;paint();});
        get('hybridReportPrevious').addEventListener('click',()=>{pageIndex--;paint();});get('hybridReportNext').addEventListener('click',()=>{pageIndex++;paint();});
        const reset = () => {loadGeneration++;snapshot=null;copyGeneration++;content.replaceChildren();select.replaceChildren();search.disabled=true;select.disabled=true;get('hybridReportPrevious').disabled=true;get('hybridReportNext').disabled=true;get('hybridReportCount').textContent='';status.textContent=t('hybridReportUnavailable');};
        const listener = request => {if(request?.action==='memoryCachesCleared')reset();};api.runtime.onMessage.addListener(listener);
        const ready = (async () => {
            try {
                const own = loadGeneration, token=location.hash.slice(1);if(!/^[a-f0-9-]{36}$/i.test(token))throw Error('token');
                const result=await api.runtime.sendMessage({action:'readHybridReport',token});
                if(disposed || own !== loadGeneration)return;
                if(!result?.success || result.report?.schemaVersion!==2 || !result.report.reports?.length)throw Error('report');
                snapshot=result.report;for (const [index,report] of snapshot.reports.entries()){
                    const metadata=report.sections.find(s=>s.id==='assessment')?.rows?.[0]||[];
                    const env=metadata.find(f=>f.key==='environment_description')?.value || metadata.find(f=>f.key==='environment_id')?.value || '';
                    const job=metadata.find(f=>f.key==='job_id')?.value || '';
                    const option=text('option',t('hybridReportRun')+' '+(index+1)+' · '+env+' · '+job);option.value=String(index);select.append(option);
                }
                select.disabled=false;search.disabled=false;status.textContent=t('hybridReportReady');paint();
            } catch (_) {if(!disposed)reset();}
        })();
        const dispose=()=>{disposed=true;reset();api.runtime.onMessage.removeListener(listener);};document.defaultView.addEventListener('pagehide',dispose,{once:true});
        return {ready,dispose};
    }
    return {project,broker,mount};
})();
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',()=>{if(document.getElementById('hybridReportContent'))ThundyHybridReport.mount(browser,document,location);},{once:true});
