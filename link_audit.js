// Local audit records are independent of provider caches and the optional reporting queue.
const LINK_AUDIT_KEY = 'linkAuditLog';
const LINK_AUDIT_DAYS = 30;
const LINK_AUDIT_LIMIT = 2000;
const LINK_AUDIT_BYTES = 2 * 1024 * 1024;
let linkAuditQueue = Promise.resolve();
let auditDatabase;
const linkAuditSessions = new ExpiringMap(60 * 60 * 1000);

function pruneLinkAudit(records, now = Date.now()) {
    const retained = records.filter(record => record && Number.isFinite(record.clickedAt) && now - record.clickedAt <= LINK_AUDIT_DAYS * 86400000)
        .sort((a, b) => b.clickedAt - a.clickedAt).slice(0, LINK_AUDIT_LIMIT);
    let size = 2;
    return retained.filter(record => { size += new TextEncoder().encode(JSON.stringify(record)).length + 1; return size <= LINK_AUDIT_BYTES; });
}

const LINK_AUDIT_WAIT = 5000;
function auditTimeout() { return Object.assign(new Error('Local audit storage timed out'), {code:'AUDIT_STORAGE_TIMEOUT'}); }
function withinAuditDeadline(work, deadline, fallback) {
    let timer;
    return Promise.race([work, new Promise((resolve, reject) => {
        timer = setTimeout(() => fallback ? resolve(fallback()) : reject(auditTimeout()), Math.max(0, deadline - Date.now()));
    })]).finally(() => clearTimeout(timer));
}

function queueLinkAudit(run, deadline) {
    let expired = false;
    const check = () => { if (expired || Date.now() >= deadline) throw auditTimeout(); };
    const job = linkAuditQueue.then(async () => {
        check();
        return run(check);
    });
    linkAuditQueue = job.catch(() => {});
    // A delayed commit must finish before a second edit may proceed.
    return withinAuditDeadline(job, deadline).catch(error => { expired = true; throw error; });
}

function editLinkAudit(edit, {readOnly = false, deadline, operation} = {}) {
    return queueLinkAudit(async check => {
        const configured = typeof ThundySecurity === 'undefined' ? null : await ThundySecurity.auditConfiguration?.();
        const limits = configured?.invalid ? {maxRecords:null,retentionDays:null} : configured || {maxRecords:LINK_AUDIT_LIMIT,retentionDays:LINK_AUDIT_DAYS};
        const custom = limits.maxRecords !== LINK_AUDIT_LIMIT || limits.retentionDays !== LINK_AUDIT_DAYS;
        const marker = operation && typeof indexedDB !== 'undefined' ? await browser.storage.local.get('linkAuditIndexed') : {};
        if (operation && (custom || marker.linkAuditIndexed)) return indexedLinkAudit(operation,limits,check);
        const stored = await browser.storage.local.get([LINK_AUDIT_KEY, 'linkAuditProfileId']);
        check();
        const original = Array.isArray(stored[LINK_AUDIT_KEY]) ? stored[LINK_AUDIT_KEY] : [];
        const records = pruneLinkAudit(original);
        const result = edit(records);
        const profileId = stored.linkAuditProfileId || crypto.randomUUID();
        const unchanged = readOnly && stored.linkAuditProfileId && original.length === records.length && records.every((record, index) => record === original[index]);
        check();
        if (!unchanged) await browser.storage.local.set({ [LINK_AUDIT_KEY]: readOnly ? records : pruneLinkAudit(records), linkAuditProfileId: profileId });
        return { result, profileId, limits:{...limits,maxBytes:LINK_AUDIT_BYTES} };
    }, deadline ?? Date.now() + LINK_AUDIT_WAIT);
}

function openAuditDatabase() {
    auditDatabase ??= new Promise((resolve,reject) => {
        const request = indexedDB.open('thundy-link-audit',1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('events',{keyPath:'id'}).createIndex('clickedAt','clickedAt');
            request.result.createObjectStore('metadata');
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); auditDatabase = null; };
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    }).catch(error => { auditDatabase = null; throw error; });
    return auditDatabase;
}

function auditTransaction(db, run) {
    return new Promise((resolve,reject) => {
        const transaction = db.transaction(['events','metadata'],'readwrite');
        let value;
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = () => reject(transaction.error || Error('Audit transaction aborted'));
        run(transaction.objectStore('events'),transaction.objectStore('metadata'),result=>{value=result;});
    });
}

function pruneIndexedAudit(events, limits, done) {
    const cutoff = limits.retentionDays === null ? -Infinity : Date.now() - limits.retentionDays * 86400000;
    if (cutoff === -Infinity && limits.maxRecords === null) { done(); return; }
    const count = events.count();
    count.onsuccess = () => {
        let excess = limits.maxRecords === null ? 0 : count.result - limits.maxRecords;
        const request = events.index('clickedAt').openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor || excess <= 0 && cursor.key >= cutoff) { done(); return; }
            cursor.delete();
            excess--;
            cursor.continue();
        };
    };
}

async function indexedLinkAudit(operation, limits, check) {
    const db = await openAuditDatabase();
    const stored = await browser.storage.local.get(['linkAuditIndexed','linkAuditProfileId',LINK_AUDIT_KEY]);
    check();
    let profileId = stored.linkAuditProfileId;
    if (!stored.linkAuditIndexed || !profileId) {
        profileId = await auditTransaction(db,(events,metadata,done) => {
            const request = metadata.get('profileId');
            request.onsuccess = () => {
                if (request.result) { done(request.result); return; }
                const id = profileId || crypto.randomUUID();
                const legacy = Array.isArray(stored[LINK_AUDIT_KEY]) ? stored[LINK_AUDIT_KEY] : [];
                for (const event of legacy) if (event?.id && Number.isFinite(event.clickedAt)) events.put(event);
                metadata.put(id,'profileId');
                done(id);
            };
        });
        await browser.storage.local.set({linkAuditIndexed:true,linkAuditProfileId:profileId,[LINK_AUDIT_KEY]:[]});
    }
    check();
    const result = await auditTransaction(db,(events,_,done) => {
        const index = events.index('clickedAt');
        if (operation.type === 'clear') { events.clear(); return; }
        if (operation.type === 'insert') events.put(operation.record);
        if (operation.type === 'update') {
            const request = events.get(operation.id);
            request.onsuccess = () => {
                const event = request.result;
                if (!event) { done(false); return; }
                events.put({...event,...operation.changes});
                done(true);
            };
            return;
        }
        pruneIndexedAudit(events,limits,()=>{
            if (operation.type !== 'read') return;
            const request = index.getAll();
            request.onsuccess = () => done(request.result.reverse());
        });
    });
    return {result,profileId,limits:{...limits,maxBytes:null}};
}

function reportLinkAuditFailure() {
    Logger.warn('Local link audit could not be persisted');
    notify('notificationTitleError', 'auditFailure');
}

function auditSessionKey(request, sender) {
    if (!sender || !sender.tab || sender.tab.id == null || typeof request.interactionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(request.interactionId)) return null;
    return sender.tab.id + ':' + request.interactionId;
}

async function updateLinkAudit(id, changes, options) {
    changes = copyAuditValue(changes);
    const { result } = await editLinkAudit(records => {
        const record = records.find(record => record.id === id);
        if (!record) return false; // Retention or explicit deletion removed this interaction.
        Object.assign(record, changes);
        return pruneLinkAudit(records).some(retained => retained.id === id);
    }, {...options,operation:{type:'update',id,changes}});
    return result;
}

async function handleAuditedLinkCheck(request, sender) {
    const clickedAt = Date.now();
    const deadline = clickedAt + LINK_AUDIT_WAIT;
    const bounded = (work, fallback) => withinAuditDeadline(work, deadline, () => fallback);
    const key = auditSessionKey(request, sender);
    if (!key || linkAuditSessions.has(key)) return { status: 'ERROR', auditSaved: false };
    if (linkAuditSessions.size >= LINK_AUDIT_LIMIT) linkAuditSessions.delete(linkAuditSessions.keys().next().value);
    const session = { auditSaved: true, url: request.url, messageId: request.messageId, checked: false, terminal: false, opening: false, score: null, local: {state:'pending',score:null,reasons:[],observedAt:null,scope:'link-in-message'} };
    const controller = new AbortController();
    session.stopChecking = () => controller.abort();
    linkAuditSessions.set(key, session);
    session.ready = withinAuditDeadline((async () => {
        const url = new URL(request.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid link scheme');
        const message = await getFirstDisplayedMessage(sender.tab.id, { throwOnError: true });
        if (!message || message.id !== request.messageId) throw new Error('Message context changed');
        const record = { id: crypto.randomUUID(), clickedAt, decidedAt: null, messageId: message.id, url: url.href, score: null, scoreSource: 'decision-message-and-link', riskModelVersion: 2, heuristicScore: null, heuristicScoreAtDecision: null, scoreAtDecision: null, verdict: 'UNKNOWN', verdictAtDecision: null, providerAtDecision: null, provider: 'none', reasons: [], outcome: 'PENDING', cancelReason: null, openAttempts: 0, extensionVersion: browser.runtime.getManifest().version };
        session.record = record;
        session.auditReady = (async () => { try {
            if (new TextEncoder().encode(JSON.stringify(record)).length + 2 > LINK_AUDIT_BYTES) throw new Error('Audit event exceeds retention budget');
            const initial = copyAuditValue(record);
            await editLinkAudit(records => records.unshift(initial), {deadline,operation:{type:'insert',record:initial}});
            return true;
        }
        catch (error) { session.auditSaved = false; reportLinkAuditFailure(); return false; } })();
        return message;
    })(), deadline);
    try {
        const message = await session.ready;
        // Read policy while checks are running. Starting it only at the end
        // would incorrectly exhaust its budget after a provider timeout.
        const security = typeof ThundyLinkSecurity === 'undefined' ? Promise.resolve(null) : bounded(
            Promise.resolve().then(() => ThundySecurity.effective()).catch(() => null), null);
        const securityEnabled = security.then(saved => saved?.policy || (typeof ThundyLinkSecurity === 'undefined' ? false : 'unavailable'));
        const managedAssessment = securityEnabled.then(policy => policy?.managed && !policy.invalid ?
            ThundyLinkSecurity.evaluate(session,sender).catch(() => null) : null);
        let localActive=true;
        const localCheck = (async () => {
            try {
                const fullMessage = await readFullForAnalysis(message);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls: [request.url], messageText, allowExternal: false });
                const threat = calculateThreatScore(message.author, [request.url], options);
                if(!localActive)return;
                session.score = Number.isFinite(threat.score) ? Math.max(0, Math.min(100, threat.score)) : null;
                session.heuristicScore = Number.isFinite(threat.heuristicScore) ? threat.heuristicScore : null;
                session.scoredAt = Date.now();
                session.local = {state:session.score===null?'failed':typeof localContentCoverage==='function'?localContentCoverage(fullMessage).state:'checked',score:session.heuristicScore ?? session.score,decisionScore:session.score,providerReasons:copyAuditValue((threat.providerReasons||[]).slice(0,20)),reasons:copyAuditValue((threat.heuristicReasons||threat.reasons||[]).slice(0,20)),reasonDetails:copyAuditValue((threat.reasonDetails||[]).slice(0,20)),observedAt:session.scoredAt,scope:'link-in-message'};
                session.local.localRawScore = threat.localRawScore;
                session.local.localContributions = copyAuditValue((threat.localContributions || []).slice(0,20));
                session.reasons = copyAuditValue((threat.reasons || []).slice(0, 20));
                session.reasonDetails = copyAuditValue((threat.reasonDetails || []).slice(0, 20));
            } catch (error) { if(localActive){session.score = null;session.local={state:'failed',score:null,reasons:[],observedAt:null,scope:'link-in-message'};} }
        })();
        const localReady=bounded(localCheck,null).finally(()=>{localActive=false;if(session.local.state==='pending')session.local={...session.local,state:'failed',reason:'timeout'};});
        const unavailable={status:'UNKNOWN',provider:'none',check:{origin:'none',outcome:'no_result',errorCode:'LINK_CHECK_TIMEOUT',attemptedAt:clickedAt,observedAt:null}};
        const enabled = await securityEnabled;
        const wait = enabled?.waitForResults === true;
        const providerDeadline = wait ? Date.now() + 30000 : deadline;
        const check = enabled === 'unavailable' ? Promise.resolve(unavailable) : new Promise(resolve => {
            if (wait) {
                controller.signal.addEventListener('abort',()=>resolve(unavailable),{once:true});
                if (controller.signal.aborted) return resolve(unavailable);
            }
            Promise.resolve().then(()=>handleCheckLinkState(request,sender,resolve,
                {waitForResults:wait,deadline:providerDeadline,signal:controller.signal})).catch(()=>resolve(unavailable));
        });
        const {incidentEvidence,...verdict} = await withinAuditDeadline(check,providerDeadline,()=>unavailable);
        controller.abort();
        if (wait && session.terminal) return {status:'ERROR',auditSaved:session.auditSaved};
        session.incidentEvidence = incidentEvidence;
        session.providerReasons = copyAuditValue((verdict.reasons || []).slice(0, 20));
        session.check = verdict.check || null;
        session.scanReports = new Map((verdict.scans || []).filter(row=>row.report).map(row=>[row.provider,row.report]));
        session.verdict = verdict.status || 'UNKNOWN'; session.provider = verdict.provider || 'none'; session.checked = true; session.providerCheckedAt = Date.now();
        await localReady;
        const finalDeadline = wait ? Date.now() + LINK_AUDIT_WAIT : deadline;
        let saved = false;
        try { if (await session.auditReady) saved = await updateLinkAudit(session.record.id, {
            score: session.score, heuristicScore:session.heuristicScore, scoredAt: session.scoredAt || null,
            reasons: session.reasons || [], reasonDetails: session.reasonDetails || [],
            verdict: session.verdict,
            provider: session.provider,
            checkedAt: verdict.check?.origin === 'live' && verdict.check.outcome === 'success' ? verdict.check.observedAt : null,
            check: verdict.check || null,
            errorCode: verdict.check?.errorCode || verdict.errorCode || null,
            errorDetails: verdict.check?.errorDetails || verdict.errorDetails || null,
            httpStatus: verdict.check?.httpStatus ?? null,
            retryAfter: verdict.check?.retryAfter || verdict.retryAfter || null,
            providerReasons: (verdict.reasons || []).slice(0, 20)
        }, {deadline:finalDeadline}); }
        catch (error) { reportLinkAuditFailure(); }
        if (session.terminal) return {status:session.verdict,auditSaved:saved};
        let protection=null, assessment;
        if (enabled?.enabled || Number.isInteger(enabled?.autoOpenBelow)) {
            const fallback = enabled.managed || enabled.invalid ? {mode:'block',reason:enabled.invalid?'policy_invalid':'context_changed',revision:enabled.revision} :
                {required:true,reason:'context_changed'};
            if (enabled.managed) {
                assessment = wait ? await withinAuditDeadline(ThundyLinkSecurity.evaluate(session,sender).catch(()=>null),finalDeadline,()=>null) :
                    await bounded(managedAssessment,null);
                protection = assessment ? ThundySecurity.decision(assessment.policy,
                    {...assessment.input,verdict:session.verdict,check:session.check}) : fallback;
            } else {
                assessment = enabled.invalid ? null : await withinAuditDeadline(ThundyLinkSecurity.evaluate(session,sender).catch(() => null),finalDeadline,()=>null);
                protection = assessment?.decision || fallback;
            }
            if (enabled.managed) {
                session.managedDecision = protection;
                if (protection.mode === 'block') {
                    void updateLinkAudit(session.record.id,{blockedAt:Date.now(),blockReason:protection.reason,policyRevision:protection.revision}).catch(reportLinkAuditFailure);
                }
                void reportManagedLinkAttempt(session,protection,assessment);
            }
        } else if (enabled === 'unavailable') protection = {required:true,reason:'context_changed'};
        if (protection && assessment) protection = linkDecisionPresentation(protection,assessment);
        const auditSaved = saved && session.auditSaved;
        session.localOnly = verdict.attempted === false && verdict.check?.outcome === 'not_requested';
        session.automaticEligible = !!(auditSaved && assessment && automaticLinkOpening(assessment.policy,
            {...assessment.input,verdict:session.verdict,check:session.check},protection,session));
        const managed = (await security)?.managed;
        const presentation = typeof ThundySeverity === 'undefined' ? null : ThundySeverity.presentation({
            mode:protection?.mode || (protection?.required ? 'approval' : session.verdict === 'SUSPICIOUS' ? 'warn' : undefined),score:protection?.score ?? session.score,
            incomplete:verdict.check?.outcome !== 'success' || session.local.state !== 'checked',
            malicious:['MALICIOUS','MALICIOUS_VISUAL'].includes(session.verdict) || protection?.reason === 'malicious'
        },managed?.severityColors);
        return { ...verdict, score: session.score, local: copyAuditValue(session.local), protection, auditSaved,
            presentation,autoOpen:session.automaticEligible };
    } catch (error) {
        // Consume ready rejection even when cancellation arrives while initialising.
        reportLinkAuditFailure();
        return { status: 'ERROR', score: session.score, local:{...session.local,state:'failed'}, auditSaved: false };
    }
}

function automaticLinkOpening(policy, input, decision, session) {
    const {autoOpenBelow,threshold,enabled} = policy;
    const complete = input.verdict === 'CLEAN' && input.check?.outcome === 'success';
    const localOnly = !policy.managed && session.localOnly && input.check?.outcome === 'not_requested';
    return Number.isInteger(autoOpenBelow) && !policy.invalid && !!decision && !decision.required &&
        (!decision.mode || decision.mode === 'allow') && (Number.isFinite(input.score) && input.score < autoOpenBelow) &&
        (!enabled || input.score < threshold) && input.coverage === 'checked' && (complete || localOnly) &&
        !input.malicious && !input.suspicious && session.local?.state === 'checked';
}

function linkDecisionPresentation(decision, assessment) {
    const providers = {hybridanalysis:'Hybrid Analysis',urlscan:'urlscan.io'};
    const evidence = assessment.incidentEvidence || [];
    return {...decision, managed:assessment.policy.managed === true, threshold:assessment.policy.threshold,
        score:assessment.input.score,
        providers:[...new Set(evidence.filter(row => row.verdict === 'malicious').map(row => providers[row.provider]).filter(Boolean))]};
}

async function reportManagedLinkAttempt(session,decision,assessment) {
    if (typeof ThundyIncidentReporting === 'undefined' || !['malicious','threshold'].includes(decision.reason)) return;
    const { reporting } = await ThundyManagedPolicy.read();
    if (!reporting?.endpoint || session.incidentReported ||
        decision.reason === 'threshold' && reporting.mode !== 'suspicious') return;
    session.incidentReported = true;
    const evidence = [...(session.incidentEvidence || []),...(assessment?.incidentEvidence || [])];
    const phishing = session.verdict === 'MALICIOUS_VISUAL' || evidence.some(row => row.verdict === 'malicious' &&
        row.detections?.some(entry=>entry.kind==='category' && ['phishing','phishing_shop'].includes(entry.value)));
    await ThundyIncidentReporting.capture({id:session.record.id,kind:'link_open',mode:decision.mode,reason:decision.reason,
        finding:phishing ? 'phishing' : 'malicious',indicator:session.url,
        score:assessment?.input.score,threshold:assessment?.policy.threshold,
        evidence});
}

function copyAuditValue(value) { return value == null ? null : JSON.parse(JSON.stringify(value)); }

function decisionReasons(session, decidedAt) {
    return {
        reasonsAtDecision: session.scoredAt <= decidedAt ? copyAuditValue(session.reasons || []) : null,
        reasonDetailsAtDecision: session.scoredAt <= decidedAt ? copyAuditValue(session.reasonDetails || []) : null,
        providerReasonsAtDecision: session.checked && session.providerCheckedAt <= decidedAt ? copyAuditValue(session.providerReasons || []) : null,
        checkAtDecision: session.checked && session.providerCheckedAt <= decidedAt ? copyAuditValue(session.check) : null
    };
}

async function handleCancelAuditedLink(request, sender) {
    const session = linkAuditSessions.get(auditSessionKey(request, sender));
    if (!session || session.url !== request.url || session.messageId !== request.messageId || session.opening || session.terminal) return { success: false };
    const decidedAt = Date.now();
    session.terminal = true;
    session.stopChecking?.();
    const deadline = decidedAt + LINK_AUDIT_WAIT;
    const reason = ['cancel', 'escape', 'destination_changed', 'context_closed'].includes(request.reason) ? request.reason : 'cancel';
    const changes = { outcome:'ABORTED', decidedAt, cancelReason:reason, scoreAtDecision:session.scoredAt <= decidedAt ? session.score : null, heuristicScoreAtDecision:session.scoredAt <= decidedAt ? session.heuristicScore ?? null : null, verdictAtDecision:session.verdict || 'UNKNOWN', providerAtDecision:session.provider || 'none', ...decisionReasons(session, decidedAt) };
    try {
        await withinAuditDeadline(session.ready, deadline);
        if (!await withinAuditDeadline(session.auditReady, deadline)) return {success:false};
        const saved = await updateLinkAudit(session.record.id, changes, {deadline});
        return { success: saved };
    } catch (error) { reportLinkAuditFailure(); return { success: false }; }
}

async function openAuditedScanReport(request,sender) {
    const session = linkAuditSessions.get(auditSessionKey(request,sender));
    if (!session?.checked || session.terminal || session.url !== request.url || session.messageId !== request.messageId) return {success:false};
    const report = session.scanReports?.get(request.provider);
    if (!report || (await getFirstDisplayedMessage(sender.tab.id))?.id !== session.messageId) return {success:false};
    await browser.windows.openDefaultBrowser(report);
    return {success:true};
}

async function finishLinkHandoff(session, result, granted) {
    session.record.openAttempts++;
    session.terminal = result.success || session.handoffUnconfirmed === true;
    const decidedAt = Date.now();
    const deadline = decidedAt + LINK_AUDIT_WAIT;
    const {automaticOpen,...authorization} = granted || {};
    const changes = {outcome:result.success ? 'OPENED' : 'OPEN_ERROR', decidedAt, openAttempts:session.record.openAttempts,
        scoreAtDecision:session.score, heuristicScoreAtDecision:session.heuristicScore ?? null,
        verdictAtDecision:session.verdict || 'UNKNOWN', providerAtDecision:session.provider || 'none',
        ...decisionReasons(session, decidedAt),...authorization,...(automaticOpen && result.success ? {automaticOpen:true} : {})};
    try {
        if (await withinAuditDeadline(session.auditReady, deadline)) {
            const saved = await updateLinkAudit(session.record.id, changes, {deadline});
            return {...result,auditSaved:saved};
        }
    } catch (_) { reportLinkAuditFailure(); }
    return {...result,auditSaved:false};
}

async function handleOpenAuditedLink(request, sender, {approval} = {}) {
    const session = linkAuditSessions.get(auditSessionKey(request, sender));
    if (!session || session.url !== request.url || session.messageId !== request.messageId || !session.checked || session.opening || session.terminal) return { success: false };
    session.opening = true;
    let dispatched = false;
    try {
        await withinAuditDeadline(session.ready, Date.now() + LINK_AUDIT_WAIT);
        if (request.automatic === true && (!session.automaticEligible || typeof ThundyLinkSecurity === 'undefined' ||
            !await updateLinkAudit(session.record.id,{automaticRequestedAt:Date.now()}))) {
            return {success:false,code:'LINK_AUTOMATIC_UNAVAILABLE',auditSaved:false};
        }
        const result = await handleOpenCheckedLink(request, sender, {deferHandoff:true,approval});
        if (result.handoff) {
            dispatched = true;
            const deadline = Date.now() + LINK_AUDIT_WAIT;
            const receipt = result.handoff.then(value=>finishLinkHandoff(session,value,result.granted))
                .finally(()=>{session.opening=false;});
            const acknowledgement = await withinAuditDeadline(result.handoff,deadline,()=>{
                session.handoffUnconfirmed = true;
                return null;
            });
            return acknowledgement ? await receipt : {success:false,code:'LINK_HANDOFF_PENDING',auditSaved:session.auditSaved};
        }
        if (result.required || ['LINK_AUTOMATIC_UNAVAILABLE','LINK_CHECK_REQUIRED','LINK_CONTEXT_CHANGED','MESSAGE_CONTEXT_CHANGED',
            'APPROVAL_CHANGED','LINK_PREFLIGHT_TIMEOUT','LINK_HANDOFF_PENDING','LINK_SCHEME_INVALID'].includes(result.code)) {
            return {...result,auditSaved:session.auditSaved};
        }
        return await finishLinkHandoff(session,result);
    } catch (_) { reportLinkAuditFailure(); return { success: false, auditSaved: false }; }
    finally { if (!dispatched) session.opening = false; }
}

async function readLinkAudit() {
    const { result, profileId, limits } = await editLinkAudit(records => records, {readOnly:true,operation:{type:'read'}});
    return {records:result,profileId,...limits};
}

const prepareLinkAudit = () => editLinkAudit(()=>{}, {readOnly:true,operation:{type:'prune'}});
const clearLinkAuditRecords = () => editLinkAudit(records=>{records.length=0;},{operation:{type:'clear'}});

function isLinkAuditAdminPage(sender) {
    return !!sender && sender.url === browser.runtime.getURL('audit.html');
}
