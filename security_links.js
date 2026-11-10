/* Every protected message-link opening ends here, including legacy callers. */
const ThundyLinkSecurity = (() => {
    const challenges=new Map();
    const failure=code=>({success:false,code});
    const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('');
    async function evaluate(session,sender) {
        const message=await getFirstDisplayedMessage(sender.tab.id,{throwOnError:true});
        if(!message||message.id!==session.messageId)throw Error('MESSAGE_CONTEXT_CHANGED');
        const full=await readFullForAnalysis(message);
        const text=extractTextFromParts(full.parts||full);
        const urls=filterUrls(extractUrls(text));
        if(!urls.some(value=>{try{return new URL(value).href===new URL(session.url).href;}catch(_){return false;}}))throw Error('LINK_CONTEXT_CHANGED');
        const options=await collectThreatEvaluationOptions({message,fullMessage:full,filteredUrls:[session.url],messageText:text,allowExternal:false});
        const threat=calculateThreatScore(message.author,[session.url],options);
        let scan=typeof ThundyScans!=='undefined'?ThundyScans.get?.(message.id):null;
        // A capacity rejection has no admitted job. Its local display context
        // still records incomplete coverage and must not authorize as complete.
        if(!scan && typeof getMessageAnalysisContext==='function')scan=(await getMessageAnalysisContext(message)).scanJob;
        const input={score:threat.score,coverage:scan?.assessmentIncomplete?'incomplete':localContentCoverage(full).state,verdict:session.verdict||'UNKNOWN',check:session.check,malicious:[...(options.linkFindings||[]),...(options.attachmentFindings||[])].some(x=>x.verdict==='malicious')};
        const saved=await ThundySecurity.read();
        const policy={...ThundySecurity.defaults,...saved.policy};
        const scanRevision=typeof ThundyScans !== 'undefined' ? ThundyScans.revision(message.id) : null;
        return {policy,input,scanRevision,decision:ThundySecurity.decision(policy,input),fingerprint:await fingerprint({scanRevision,messageId:message.id,url:session.url,text,parts:full,score:input.score,coverage:input.coverage,verdict:input.verdict,check:session.check,reasons:threat.reasons,revision:policy.revision})};
    }
    async function open(request,sender) {
        return ThundySecurity.serialized(async()=>{
            const saved=await ThundySecurity.read();
            const key=auditSessionKey(request,sender), session=key&&linkAuditSessions.get(key);
            let openingRevision;
            if(saved.policy?.enabled) {
                if(!session||!session.checked||session.terminal||session.url!==request.url||session.messageId!==request.messageId)return failure('LINK_CHECK_REQUIRED');
                let current;try{current=await evaluate(session,sender);}catch(_){return failure('LINK_CONTEXT_CHANGED');}
                openingRevision=current.scanRevision;
                const d=current.decision;
                if(d.required) {
                    const approval=session.approval;delete session.approval;
                    const approved=approval&&approval.until>Date.now()&&approval.fingerprint===current.fingerprint&&approval.revision===current.policy.revision;
                    if(!approved){
                        try{await updateLinkAudit(session.record.id,{blockedAt:Date.now(),blockReason:d.reason,policyRevision:current.policy.revision,approvalDecision:'required'});}catch(_){}
                        return {...failure(saved.approval?'APPROVAL_REQUIRED':'APPROVAL_NOT_CONFIGURED'),required:true,reason:d.reason};
                    }
                }
                session.score=current.input.score;
            }
            const url=new URL(request.url);if(!['http:','https:'].includes(url.protocol))return failure('LINK_SCHEME_INVALID');
            const message=await getFirstDisplayedMessage(sender.tab.id,{throwOnError:true});
            if(!message||message.id!==request.messageId)return failure('MESSAGE_CONTEXT_CHANGED');
            if(openingRevision!==undefined&&typeof ThundyScans!=='undefined'&&ThundyScans.revision(message.id)!==openingRevision)return failure('APPROVAL_CHANGED');
            await browser.windows.openDefaultBrowser(url.href);return {success:true};
        });
    }
    async function start(request,sender) {
        const session=linkAuditSessions.get(auditSessionKey(request,sender));
        if(!session||session.terminal||session.opening||session.url!==request.url||session.messageId!==request.messageId||!session.checked)throw Error('LINK_CHECK_REQUIRED');
        const current=await evaluate(session,sender);
        if(!current.decision.required||!(await ThundySecurity.read()).approval)throw Error('APPROVAL_NOT_CONFIGURED');
        for(const [id,c] of challenges)if(c.until<Date.now())challenges.delete(id);
        if(challenges.size>=100)throw Error('APPROVAL_CAPACITY');
        const id=crypto.randomUUID();
        const challenge={session,request:{...request},sender:{...sender},fingerprint:current.fingerprint,revision:current.policy.revision,until:Date.now()+60000,busy:false};
        challenges.set(id,challenge);
        try{const tab=await browser.tabs.create({url:browser.runtime.getURL('security.html')+'?approval='+id});challenge.tabId=tab.id;return {success:true};}
        catch(e){challenges.delete(id);throw e;}
    }
    async function command(request,sender) {
        if(!ThundySecurity.page(sender,'security.html'))throw Error('APPROVAL_PAGE_REQUIRED');
        const c=challenges.get(request.challenge);
        if(!c||c.until<Date.now()||c.tabId!==sender.tab?.id||c.session.terminal||c.busy)throw Error('APPROVAL_EXPIRED');
        if(request.op==='status')return {url:c.session.url,score:c.session.score,until:c.until};
        if(request.op!=='approve'||request.confirmed!==true)throw Error('APPROVAL_CONFIRM_REQUIRED');
        c.busy=true;
        try{
            await ThundySecurity.verify(request.password,(await ThundySecurity.read()).approval,'approval');
            const current=await evaluate(c.session,c.sender);
            if(c.until<=Date.now()||current.fingerprint!==c.fingerprint||current.policy.revision!==c.revision)throw Error('APPROVAL_CHANGED');
            c.session.approval={fingerprint:c.fingerprint,revision:c.revision,until:c.until};challenges.delete(request.challenge);
            try{await updateLinkAudit(c.session.record.id,{approvalDecision:'granted',approvedAt:Date.now(),policyRevision:c.revision});}catch(_){}
            return await handleOpenAuditedLink(c.request,c.sender);
        }finally{c.busy=false;}
    }
    return {open,start,command,evaluate};
})();
