/* Local, allowlisted projection. Never export resource labels or raw protocols. */
const ThundySourceExport = (() => {
    const providers = ['hybridanalysis','virustotal','urlhaus','abuseipdb','urlscan'];
    const scopes = ['hash','file','url','domain','ip','report'];
    const states = ['running','checked','received','submitted','not_found','failed','incomplete'];
    const sources = ['remote','cache','stored','attempt'];
    const verdicts = ['unknown','none','suspicious','malicious'];
    const reasons = ['unconfigured','disabled','permission','authorization','policy','on_action','unrecorded','manual','sender','links_disabled','no_resources','quota','running','provider_error'];
    const time = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8640000000000000 ? value : null;
    const count = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value,100000) : 0;
    function project(snapshot, createdAt = Date.now()) {
        const ordinals = new Map(), totals = {attachment:0,link:0};
        const resource = ref => {
            if (ref === 'message') return {kind:'message'};
            const kind = typeof ref === 'string' && ref.length <= 80 && /^attachment:[0-9]+(?:\.[0-9]+)*$/.test(ref) ? 'attachment' : typeof ref === 'string' && /^link:[0-9]{1,6}$/.test(ref) ? 'link' : null;
            if (!kind) return {kind:'unknown'};
            if (!ordinals.has(ref)) ordinals.set(ref,{kind,ordinal:++totals[kind]});
            return {...ordinals.get(ref)};
        };
        const rows = (input, historical) => (Array.isArray(input) ? input : []).slice(0,1200)
            .filter(row => row && providers.includes(row.provider) && scopes.includes(row.scope))
            .map(row => ({...ThundyProviderResults.project(row),provider:row.provider,scope:row.scope,resource:historical ? {kind:'unbound'} : resource(row.resource),
                state:states.includes(row.state) ? row.state : 'incomplete',source:historical ? 'stored' : sources.includes(row.source) ? row.source : 'unknown',
                verdict:verdicts.includes(row.verdict) ? row.verdict : 'unknown',
                active:historical ? 0 : count(row.active),responses:count(row.responses),failures:count(row.failures),cacheHits:count(row.cacheHits),
                observedAt:time(row.observedAt),findingAt:time(row.findingAt),attemptedAt:time(row.attemptedAt),
                errorCode:typeof row.errorCode === 'string' && /^[a-z0-9_-]{1,50}$/i.test(row.errorCode) ? row.errorCode : null,
                errorDetails:typeof row.errorDetails === 'string' ? row.errorDetails.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').slice(0,200) : null,
                retryAfter:Number.isFinite(row.retryAfter) && row.retryAfter > 0 ? Math.min(row.retryAfter, 86400) : null}));
        const local = snapshot?.local || {};
        return {schemaVersion:1,kind:'thundy-analysis-sources',authenticatedSource:false,createdAt:time(createdAt),
            current:{local:{state:['checked','incomplete','failed','unrecorded'].includes(local.state) ? local.state : 'unrecorded',
                source:['local','stored'].includes(local.source) ? local.source : 'unknown',observedAt:time(local.observedAt),
                reason:['decryption_unavailable','text_unavailable','read_failed'].includes(local.reason) ? local.reason : null},
                rows:rows(snapshot?.rows,false),truncated:snapshot?.truncated === true || (snapshot?.rows?.length || 0) > 1200,
                availability:Object.fromEntries(providers.map(provider => [provider,reasons.includes(snapshot?.availability?.[provider]) ? snapshot.availability[provider] : 'unknown'])),
                diagnostics:{unavailable:snapshot?.unavailable === true,sourcePersistenceFailed:snapshot?.sourcePersistenceFailed === true,reportArchiveBlocked:snapshot?.reportArchiveBlocked === true,backoffs:typeof snapshot?.diagnostics?.backoffs === 'object' && snapshot?.diagnostics?.backoffs !== null ? Object.fromEntries(Object.entries(snapshot.diagnostics.backoffs).filter(([host, data]) => typeof host === 'string' && host.length <= 100 && typeof data === 'object' && data !== null).map(([host, data]) => [host, { active: data.active === true, remainingSeconds: Number.isFinite(data.remainingSeconds) ? Math.min(Math.max(0, data.remainingSeconds), 86400) : 0 }])) : {}}},
            history:{association:'unconfirmed',rows:rows(snapshot?.sourceHistory?.rows,true),truncated:snapshot?.sourceHistory?.truncated === true || (snapshot?.sourceHistory?.rows?.length || 0) > 1200}};
    }
    function mount(api, document, location, urls = URL, BlobType = Blob) {
        const get = id => document.getElementById(id), t = key => ThundyI18n.get(key);
        const previewButton = get('sourceExportPreview'),save = get('sourceExportSave'),cancel = get('sourceExportCancel'),content = get('sourceExportContent'),status = get('sourceExportStatus');
        const rawId = new URL(location.href).searchParams.get('messageId');
        const token = new URL(location.href).searchParams.get('contextToken');
        const messageId = rawId && /^[0-9]+$/.test(rawId) ? Number(rawId) : null;
        let generation = 0, preview = null, saving = false, disposed = false;
        const reset = key => { generation++;preview=null;content.textContent='';content.hidden=true;save.disabled=true;status.textContent=key ? t(key) : ''; };
        const read = async () => {
            if (!Number.isSafeInteger(messageId) || messageId <= 0 || !token || token.length>128) throw new Error('unavailable');
            const result = await api.runtime.sendMessage({action:'getMessageAnalysis',messageId});
            if (!result?.success || result.messageId !== messageId || result.contextToken !== token) throw new Error('unavailable');
            return result;
        };
        previewButton.addEventListener('click',async () => {
            reset();const own=generation;
            try {
                const report=project(await read());
                if (disposed || own!==generation) return;
                preview=JSON.stringify(report,null,2);content.textContent=preview;content.hidden=false;save.disabled=false;content.focus();status.textContent=t('sourceExportReady');
            } catch (_) { if (!disposed && own===generation) reset('sourceExportUnavailable'); }
        });
        cancel.addEventListener('click',() => { reset();previewButton.focus(); });
        save.addEventListener('click',async () => {
            if (!preview || saving || disposed) return;
            const own=generation, expected=preview;let url;
            saving=true;save.disabled=true;
            try {
                const current=project(await read(),JSON.parse(expected).createdAt);
                if (disposed || own!==generation) return;
                if (JSON.stringify(current,null,2)!==expected) { reset('sourceExportChanged');return; }
                url=urls.createObjectURL(new BlobType([expected],{type:'application/json'}));
                await api.downloads.download({url,filename:'thundy-analysis-sources.json',saveAs:true});
                if (!disposed && own===generation) status.textContent=t('sourceExportRequested');
            } catch (_) { if (!disposed && own===generation) reset('sourceExportFailed'); }
            finally { if (url) urls.revokeObjectURL(url);saving=false;save.disabled=!preview || disposed; }
        });
        const onMessage = request => {
            if (request?.action==='memoryCachesCleared' || request?.action==='analysisStatusChanged' && request.messageId===messageId) reset('sourceExportChanged');
        };
        api.runtime.onMessage.addListener(onMessage);
        const dispose = () => { disposed=true;reset();api.runtime.onMessage.removeListener(onMessage); };
        document.defaultView.addEventListener('pagehide',dispose,{once:true});
        return {dispose};
    }
    return {project,mount};
})();
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',() => {
    ThundySourceExport.mount(browser,document,location);
},{once:true});
