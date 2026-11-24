/* Every protected message-link opening ends here, including legacy callers. */
const ThundyLinkSecurity = (() => {
    const challenges=new Map(), handoffs=new Map();
    const failure=code=>({success:false,code});
    const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
    async function evaluate(session,sender) {
        const scanRevision=typeof ThundyScans!=='undefined'?ThundyScans.revision(session.messageId):null;
        const message=await getFirstDisplayedMessage(sender.tab.id,{throwOnError:true});
        if(!message||message.id!==session.messageId)throw Error('MESSAGE_CONTEXT_CHANGED');
        const full=await readFullForAnalysis(message);
        const text=extractTextFromParts(full.parts||full);
        const urls=typeof messageUrlInventory==='function'?messageUrlInventory(full):extractUrls(text);
        if(!urls.some(value=>{try{return new URL(value).href===new URL(session.url).href;}catch(_){return false;}}))throw Error('LINK_CONTEXT_CHANGED');
        const options=await collectThreatEvaluationOptions({message,fullMessage:full,filteredUrls:[session.url],messageText:text,allowExternal:false});
        const {policy} = await ThundySecurity.effective();
        const linkFindings = (options.linkFindings || []).filter(finding => finding.url === new URL(session.url).href);
        const threat=calculateThreatScore(message.author,[session.url],policy.managed ?
            {...options,linkFindings,attachmentFindings:[]} : options);
        let scan=typeof ThundyScans!=='undefined'?ThundyScans.get?.(message.id):null;
        // A capacity rejection has no admitted job. Its local display context
        // still records incomplete coverage and must not authorize as complete.
        if(!scan && typeof getMessageAnalysisContext==='function')scan=(await getMessageAnalysisContext(message))?.scanJob;
        const findings = policy.managed ? linkFindings : [...(options.linkFindings || []), ...(options.attachmentFindings || [])];
        const input={score:threat.score,coverage:scan?.assessmentIncomplete?'incomplete':localContentCoverage(full).state,verdict:session.verdict||'UNKNOWN',check:session.check,malicious:findings.some(x=>x.verdict==='malicious'),
            suspicious:findings.some(x=>x.verdict==='suspicious')};
        const reasons=(threat.reasons||[]).slice(0,20);
        const reasonDetails=(threat.reasonDetails||[]).slice(0,20);
        const token=await fingerprint({scanRevision,messageId:message.id,url:session.url,text,parts:full,score:input.score,coverage:input.coverage,verdict:input.verdict,check:session.check,reasons,reasonDetails,revision:policy.revision});
        if (typeof ThundyScans!=='undefined'&&ThundyScans.revision(message.id)!==scanRevision) throw Error('APPROVAL_CHANGED');
        const incidentEvidence = linkFindings.map(({provider,verdict,source}) => ({
            provider:provider === 'Hybrid Analysis' ? 'hybridanalysis' : 'urlscan',verdict,source:source || 'stored'
        }));
        return {policy,input,heuristicScore:threat.heuristicScore,scanRevision,reasons,reasonDetails,incidentEvidence,
            decision:ThundySecurity.decision(policy,input),fingerprint:token};
    }
    function boundedValidation(work) {
        let timer;
        const timeout = new Promise((_,reject) => {
            timer = setTimeout(() => reject(Error('LINK_PREFLIGHT_TIMEOUT')),5000);
        });
        return Promise.race([work,timeout]).finally(() => clearTimeout(timer));
    }
    async function prepareOpening(request,sender,session) {
        const saved = await ThundySecurity.effective();
        let current;
        if (saved.policy?.enabled || request.automatic === true) {
            if (!session || !session.checked || session.terminal || session.url !== request.url ||
                session.messageId !== request.messageId) return failure('LINK_CHECK_REQUIRED');
            current = await evaluate(session,sender);
            if (request.automatic === true) {
                const latest = await new Promise((resolve,reject)=>{
                    Promise.resolve(handleCheckLinkState(request,sender,resolve,{waitForResults:false})).catch(reject);
                });
                const input = {...current.input,verdict:latest.status,check:latest.check};
                const refreshed = ThundySecurity.decision(current.policy,input);
                if (!automaticLinkOpening(current.policy,input,refreshed,{
                    ...session,localOnly:latest.attempted === false && latest.check?.outcome === 'not_requested'
                })) return failure('LINK_AUTOMATIC_UNAVAILABLE');
            }
        }
        const url=new URL(request.url);
        if (!['http:','https:'].includes(url.protocol)) return failure('LINK_SCHEME_INVALID');
        const message=await getFirstDisplayedMessage(sender.tab.id,{throwOnError:true});
        if (!message || message.id !== request.messageId) return failure('MESSAGE_CONTEXT_CHANGED');
        return {saved,current,url,messageId:message.id};
    }
    async function open(request,sender,{deferHandoff=false,approval=null}={}) {
        const key=auditSessionKey(request,sender), session=key&&linkAuditSessions.get(key);
        const prepared=await ThundySecurity.serialized(async()=>{
            let ready;
            try { ready=await boundedValidation(prepareOpening(request,sender,session)); }
            catch (error) { return failure(['LINK_PREFLIGHT_TIMEOUT','APPROVAL_CHANGED'].includes(error.message) ? error.message : 'LINK_CONTEXT_CHANGED'); }
            if (!ready.url) return ready;
            const {saved,current,url,messageId}=ready;
            if (request.automatic === true && (!session.automaticEligible || approval ||
                !automaticLinkOpening(current.policy,current.input,current.decision,session))) return failure('LINK_AUTOMATIC_UNAVAILABLE');
            const destination=JSON.stringify([sender.tab.id,messageId,url.href]);
            if (handoffs.has(destination)) return failure('LINK_HANDOFF_PENDING');
            if (handoffs.size >= 100) return failure('LINK_PREFLIGHT_TIMEOUT');
            if (approval && (!current?.decision.required || !saved.approval || approval.until<=Date.now() ||
                approval.fingerprint!==current.fingerprint || approval.revision!==current.policy.revision)) {
                return failure('APPROVAL_CHANGED');
            }
            if (current) {
                if (typeof ThundyScans!=='undefined'&&ThundyScans.revision(messageId)!==current.scanRevision) {
                    return failure('APPROVAL_CHANGED');
                }
                const d=current.decision;
                if (current.policy.managed && typeof reportManagedLinkAttempt === 'function') void reportManagedLinkAttempt(session,d,current);
                if (d.mode === 'block') {
                    void updateLinkAudit(session.record.id,{blockedAt:Date.now(),blockReason:d.reason,policyRevision:d.revision}).catch(()=>{});
                    const blocked = failure(d.reason === 'policy_invalid' ? 'POLICY_INVALID' : 'LINK_POLICY_BLOCKED');
                    const protection = typeof linkDecisionPresentation === 'function' ? linkDecisionPresentation(d,current) : d;
                    const presentation = typeof ThundySeverity === 'undefined' ? null :
                        ThundySeverity.presentation({mode:'block'},saved.managed?.severityColors);
                    return {...blocked,protection:{...protection,presentation}};
                }
                if (current.policy.managed && (session.managedDecision?.mode !== d.mode || session.managedDecision?.reason !== d.reason)) {
                    return failure('APPROVAL_CHANGED');
                }
                if (d.required && !approval) {
                    void updateLinkAudit(session.record.id,{blockedAt:Date.now(),blockReason:d.reason,policyRevision:current.policy.revision,approvalDecision:'required'}).catch(()=>{});
                    return {...failure(saved.approval?'APPROVAL_REQUIRED':'APPROVAL_NOT_CONFIGURED'),required:true,reason:d.reason};
                }
                session.score=current.input.score;
                session.heuristicScore=current.heuristicScore;
                session.reasons=current.reasons;
                session.reasonDetails=current.reasonDetails;
                session.scoredAt=Date.now();
            }
            // Dispatch inside the protected decision; waiting for its reply belongs to the caller.
            const handoff=Promise.resolve(browser.windows.openDefaultBrowser(url.href))
                .then(()=>({success:true}),()=>failure('LINK_OPEN_FAILED'))
                .finally(()=>handoffs.delete(destination));
            handoffs.set(destination,handoff);
            const granted=approval ? {approvalDecision:'granted',approvedAt:Date.now(),policyRevision:current.policy.revision} :
                request.automatic === true ? {automaticOpen:true,policyRevision:current.policy.revision} : null;
            return {handoff,granted};
        });
        if (!prepared.handoff || deferHandoff) return prepared;
        return prepared.handoff;
    }
    async function start(request,sender) {
        const session=linkAuditSessions.get(auditSessionKey(request,sender));
        if(!session||session.terminal||session.opening||session.url!==request.url||session.messageId!==request.messageId||!session.checked)throw Error('LINK_CHECK_REQUIRED');
        const [current,saved]=await boundedValidation(Promise.all([evaluate(session,sender),ThundySecurity.read()]));
        if(!current.decision.required||!saved.approval)throw Error('APPROVAL_NOT_CONFIGURED');
        for(const [id,c] of challenges)if(c.until<Date.now())challenges.delete(id);
        if(challenges.size>=100)throw Error('APPROVAL_CAPACITY');
        const id=crypto.randomUUID();
        const challenge={session,request:{...request},sender:{...sender},fingerprint:current.fingerprint,revision:current.policy.revision,
            score:current.input.score,heuristicScore:current.heuristicScore,until:Date.now()+60000,busy:false};
        challenges.set(id,challenge);
        try{const tab=await browser.tabs.create({url:browser.runtime.getURL('security.html')+'?approval='+id});challenge.tabId=tab.id;return {success:true};}
        catch(e){challenges.delete(id);throw e;}
    }
    async function command(request,sender) {
        if(!ThundySecurity.page(sender,'security.html'))throw Error('APPROVAL_PAGE_REQUIRED');
        const c=challenges.get(request.challenge);
        if(!c||c.until<Date.now()||c.tabId!==sender.tab?.id||c.session.terminal||c.busy)throw Error('APPROVAL_EXPIRED');
        if(request.op==='status')return {url:c.session.url,score:c.score,heuristicScore:c.heuristicScore,until:c.until};
        if(request.op!=='approve'||request.confirmed!==true)throw Error('APPROVAL_CONFIRM_REQUIRED');
        c.busy=true;
        try{
            await boundedValidation(ThundySecurity.read().then(saved=>ThundySecurity.verify(request.password,saved.approval,'approval')));
            const current=await boundedValidation(evaluate(c.session,c.sender));
            if(c.until<=Date.now()||current.fingerprint!==c.fingerprint||current.policy.revision!==c.revision)throw Error('APPROVAL_CHANGED');
            const approval={fingerprint:c.fingerprint,revision:c.revision,until:c.until};
            challenges.delete(request.challenge);
            return await handleOpenAuditedLink(c.request,c.sender,{approval});
        }finally{c.busy=false;}
    }
    return {open,start,command,evaluate};
})();
