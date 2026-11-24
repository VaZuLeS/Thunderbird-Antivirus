/* Profile-local administration. Secrets are verified only in the background. */
const ThundySecurity = (() => {
    const KEY = 'thundySecurityV1', ITERATIONS = 600000;
    const sessions = new Map(), failures = new Map(), verificationQueues = new Map();
    let queue = Promise.resolve();
    const defaults = { enabled: false, threshold: 50, unknown: 'warn', revision: 0 };
    const attachmentDefaults = { mode: 'off', threshold: 70, unknown: 'warn', revision: 0 };
    function validAttachmentPolicy(policy) {
        return !!policy && ['off','warn','approval','block'].includes(policy.mode) &&
            Number.isInteger(policy.threshold) && policy.threshold >= 0 && policy.threshold <= 100 &&
            ['warn','block'].includes(policy.unknown);
    }
    const error = code => Object.assign(new Error(code), { code });
    const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
    function page(sender, name) { return sender?.id === browser.runtime.id && sender.url?.split(/[?#]/)[0] === browser.runtime.getURL(name); }
    function identity(sender) { return `${sender?.tab?.id ?? 'none'}:${sender?.documentId || sender?.url || ''}`; }
    function adminPage(sender) { return ['options.html','audit.html','onboarding.html','enterprise_setup.html'].some(name => page(sender,name)); }
    async function read() {
        const saved=(await browser.storage.local.get(KEY))[KEY];
        if(saved===undefined)return {schemaVersion:1,policy:{...defaults}};
        const validVerifier=value=>value && value.algorithm==='PBKDF2-SHA-256' && value.iterations===ITERATIONS && /^[0-9a-f]{64}$/.test(value.salt) && /^[0-9a-f]{64}$/.test(value.hash);
        if(!saved || saved.schemaVersion!==1 || (saved.apiDebugEnabled!==undefined&&typeof saved.apiDebugEnabled!=='boolean') || !saved.policy || typeof saved.policy.enabled!=='boolean' || !Number.isInteger(saved.policy.threshold) || saved.policy.threshold<0 || saved.policy.threshold>100 || !['warn','approval'].includes(saved.policy.unknown) || !Number.isSafeInteger(saved.policy.revision) || saved.policy.revision<0 || ['admin','approval','recovery'].some(key=>saved[key]!==undefined&&!validVerifier(saved[key])))throw error('SECURITY_STATE_INVALID');
        if (saved.attachmentPolicy !== undefined && (!validAttachmentPolicy(saved.attachmentPolicy) ||
            !Number.isSafeInteger(saved.attachmentPolicy.revision) || saved.attachmentPolicy.revision < 1)) {
            throw error('SECURITY_STATE_INVALID');
        }
        if (Object.hasOwn(saved.policy,'waitForResults') && typeof saved.policy.waitForResults !== 'boolean' ||
            Object.hasOwn(saved.policy,'autoOpenBelow') && !ThundyManagedPolicy.automaticThreshold(saved.policy.autoOpenBelow)) {
            throw error('SECURITY_STATE_INVALID');
        }
        return saved;
    }
    async function effective(saved) {
        const managed = await ThundyManagedPolicy.read();
        const { links, attachments, revision } = managed;
        let localInvalid = false;
        try {
            saved ??= await read();
        } catch (error) {
            if (!links && !attachments) throw error;
            saved = {};
            localInvalid = true;
        }
        return {
            managed,
            policy: links ? { waitForResults:false,...links, enabled: true, revision, managed: true } :
                { waitForResults:false,...defaults, ...saved.policy, ...(localInvalid ? {enabled:true,invalid:true} : {}) },
            attachmentPolicy: attachments ? { ...attachments, mode: attachments.invalid ? 'block' : attachments.action, revision, managed: true } :
                { ...attachmentDefaults, ...saved.attachmentPolicy, ...(localInvalid ? {mode:'block',invalid:true} : {}) },
            linkAudit: managed.linkAudit || auditSettings(saved),
            approval: saved.approval, localInvalid
        };
    }
    async function auditConfiguration() {
        const managed = await ThundyManagedPolicy.read();
        return managed.linkAudit || auditSettings((await browser.storage.local.get(KEY))[KEY]);
    }
    function auditSettings(saved) {
        return saved?.linkAudit === undefined ? ThundyManagedPolicy.historyDefaults : ThundyManagedPolicy.audit(saved.linkAudit);
    }
    async function digest(password, salt) {
        const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
        return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt.match(/../g).map(x=>parseInt(x,16))),iterations:ITERATIONS}, material, 256)));
    }
    async function verifier(password) {
        if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw error('PASSWORD_LENGTH');
        const salt = random(); return { algorithm:'PBKDF2-SHA-256',iterations:ITERATIONS,salt,hash:await digest(password,salt) };
    }
    async function verifyOne(password, saved, kind) {
        const f = failures.get(kind) || {count:0,until:0};
        if (f.until > Date.now()) throw error('PASSWORD_WAIT');
        let valid = false;
        if (saved && typeof password === 'string' && password.length <= 1024) {
            const actual = await digest(password,saved.salt);
            let diff = actual.length ^ saved.hash.length;
            for (let i=0;i<actual.length;i++) diff |= actual.charCodeAt(i) ^ saved.hash.charCodeAt(i);
            valid = diff === 0;
        }
        if (!valid) { f.count++; f.until = Date.now()+Math.min(60000,1000*2**Math.min(f.count-1,6)); failures.set(kind,f); throw error('PASSWORD_INVALID'); }
        failures.delete(kind);
    }
    function verify(password,saved,kind) {
        const job=(verificationQueues.get(kind)||Promise.resolve()).then(()=>verifyOne(password,saved,kind));
        verificationQueues.set(kind,job.catch(()=>{}));return job;
    }
    async function authorized(sender, token, touch = true, diagnostic = false) {
        if (!adminPage(sender)&&!(diagnostic&&page(sender,'api_debug.html'))) throw error('ADMIN_PAGE_REQUIRED');
        const saved = await read();
        if (!saved.admin) return true;
        const session = sessions.get(token);
        if (!session || session.identity !== identity(sender) || Date.now()-session.at >= 300000) { sessions.delete(token); throw error('ADMIN_LOCKED'); }
        if (touch) session.at = Date.now();
        return true;
    }
    async function status(sender, token) {
        const saved = await read(); let unlocked = !saved.admin;
        if (saved.admin) { try { await authorized(sender,token,false,page(sender,'api_debug.html')); unlocked=true; } catch (_) {} }
        const current = await effective(saved);
        const reporting = typeof ThundyIncidentReporting === 'undefined' ? undefined :
            await ThundyIncidentReporting.status(current.managed.reporting).catch(() => ({ state: 'storage' }));
        return {protected:!!saved.admin,unlocked,approvalConfigured:!!saved.approval,policy:current.policy,attachmentPolicy:current.attachmentPolicy,
            linkAudit:{...current.linkAudit,managed:!!current.managed.linkAudit},
            severityColorsManaged:!!current.managed.severityColors,severityColorsInvalid:current.managed.severityColors?.invalid === true,reporting};
    }
    function serialized(fn) { const job=queue.then(fn);queue=job.catch(()=>{});return job; }
    async function command(request,sender) {
        const {op,token}=request;
        const diagnostic=page(sender,'api_debug.html');
        if(diagnostic&&!['status','unlock','lock','touch','apiDebugStatus','apiDebugReport','apiDebugClear'].includes(op))throw error('ADMIN_PAGE_REQUIRED');
        if (!adminPage(sender)&&!diagnostic) throw error('ADMIN_PAGE_REQUIRED');
        if (op==='status') return status(sender,token);
        if (op==='touch') { await authorized(sender,token,true,diagnostic);return {}; }
        if (op==='enableReporting' || op==='disableReporting') {
            if (!page(sender,'options.html')) throw error('ADMIN_PAGE_REQUIRED');
            if (op==='enableReporting') await authorized(sender,token);
            await ThundyIncidentReporting.configure((await ThundyManagedPolicy.read()).reporting,request);
            return {};
        }
        if (op==='lock') { sessions.delete(token);return {unlocked:false}; }
        if (op==='unlock') {
            await verify(request.password,(await read()).admin,'admin');
            if(sessions.size>=200)sessions.delete(sessions.keys().next().value);
            const next=random();sessions.set(next,{identity:identity(sender),at:Date.now()});return {token:next};
        }
        return serialized(async()=>{
            const saved=await read();
            if (op==='recover') {
                await verify(request.recovery,saved.recovery,'recovery');
                if(saved.approval && typeof request.password==='string' && await digest(request.password,saved.approval.salt)===saved.approval.hash)throw error('PASSWORDS_DISTINCT');
                saved.admin=await verifier(request.password); const recovery=random();saved.recovery=await verifier(recovery);
                sessions.clear(); saved.policy={...defaults,...saved.policy,revision:(saved.policy?.revision||0)+1};await browser.storage.local.set({[KEY]:saved});return {recovery};
            }
            await authorized(sender,token,!['apiDebugStatus','apiDebugReport'].includes(op),diagnostic);
            if (['apiDebugStatus','apiDebugSet','apiDebugReport','apiDebugClear'].includes(op)) {
                if(op==='apiDebugSet') {
                    if(typeof request.enabled!=='boolean')throw error('SETTINGS_INVALID');
                    saved.apiDebugEnabled=request.enabled;
                    await browser.storage.local.set({[KEY]:saved});
                    ThundyApiDiagnostics.reset();
                }
                if(op==='apiDebugClear')ThundyApiDiagnostics.reset();
                return {enabled:saved.apiDebugEnabled===true,...(op==='apiDebugReport'?{report:ThundyApiDiagnostics.report()}:{} )};
            }
            let recovery;
            if (op==='configure') {
                const { managed } = await effective(saved);
                if (managed.links && request.policy !== undefined || managed.attachments && request.attachmentPolicy !== undefined ||
                    managed.linkAudit && request.linkAudit !== undefined) throw error('POLICY_MANAGED');
                if (request.adminPassword) {
                    if (request.adminPassword===request.approvalPassword) throw error('PASSWORDS_DISTINCT');
                    if (saved.approval && await digest(request.adminPassword,saved.approval.salt)===saved.approval.hash) throw error('PASSWORDS_DISTINCT');
                    saved.admin=await verifier(request.adminPassword);
                    recovery=random();saved.recovery=await verifier(recovery);
                }
                if (request.approvalPassword) {
                    if (saved.admin && await digest(request.approvalPassword,saved.admin.salt)===saved.admin.hash) throw error('PASSWORDS_DISTINCT');
                    saved.approval=await verifier(request.approvalPassword);
                }
                const policy=request.policy;
                if (!managed.links && (!policy || typeof policy.enabled!=='boolean' || !Number.isInteger(policy.threshold) || policy.threshold<0 || policy.threshold>100 || !['warn','approval'].includes(policy.unknown))) throw error('POLICY_INVALID');
                if (policy && (Object.hasOwn(policy,'waitForResults') && typeof policy.waitForResults !== 'boolean' ||
                    Object.hasOwn(policy,'autoOpenBelow') && !ThundyManagedPolicy.automaticThreshold(policy.autoOpenBelow))) throw error('POLICY_INVALID');
                if (request.linkAudit !== undefined) {
                    const next = ThundyManagedPolicy.audit(request.linkAudit);
                    if (next.invalid) throw error('POLICY_INVALID');
                    saved.linkAudit = next;
                }
                if (request.attachmentPolicy !== undefined) {
                    const next = request.attachmentPolicy;
                    if (!validAttachmentPolicy(next)) throw error('POLICY_INVALID');
                    const current = saved.attachmentPolicy || attachmentDefaults;
                    const { mode, threshold, unknown } = next;
                    if (mode !== current.mode || threshold !== current.threshold || unknown !== current.unknown) {
                        saved.attachmentPolicy = {mode, threshold, unknown, revision:current.revision+1};
                    }
                }
                if (policy) saved.policy={...policy,revision:(saved.policy?.revision||0)+1};
                await browser.storage.local.set({[KEY]:saved});sessions.clear();return {recovery};
            }
            if (op==='disableAdmin') {
                delete saved.admin;delete saved.recovery; sessions.clear();await browser.storage.local.set({[KEY]:saved});return {};
            }
            throw error('COMMAND_INVALID');
        });
    }
    async function write(values,sender,token) {
        return serialized(async()=>{
        if (!values || typeof values!=='object' || Array.isArray(values) || Object.keys(values).some(k=>[KEY,'__proto__','constructor','prototype'].includes(k))) throw error('SETTINGS_INVALID');
        // Stopping transfers is always available, but cannot smuggle other edits.
        if (!(Object.keys(values).length===1 && values.externalAnalysisConsent===false)) await authorized(sender,token);
        else if (!sender?.id || sender.id!==browser.runtime.id) throw error('ADMIN_PAGE_REQUIRED');
        const allowed = new Set(['apikey','virustotalApikey','urlhausApikey','urlscanApikey','disabledProviders','privacyTier','alwaysManual','scanMode','autoScanLinks','timeOfClickProtection','ipReputationEnabled','ipReputationProvider','ipReputationApiKey','externalAnalysisConsent','scanningEnabledSenders','trustedAuthServers','customWhitelist','customBlacklist','onboardingState','thundyAppearance','thundyAccent','thundyDensity','analysisDefaultView','analysisShowHybridDetails','enterpriseProfile','enterpriseConfiguration','enterpriseProfileSelection']);
        if (Object.keys(values).some(k=>!allowed.has(k))) throw error('SETTINGS_INVALID');
        if ('timeOfClickProtection' in values && (await effective()).managed.links) throw error('POLICY_MANAGED');
        if('scanMode' in values && !['allDisplayed','approvedSenders','manual'].includes(values.scanMode))throw error('SETTINGS_INVALID');
        if('analysisDefaultView' in values && !['simple','expert'].includes(values.analysisDefaultView))throw error('SETTINGS_INVALID');
        if('analysisShowHybridDetails' in values && typeof values.analysisShowHybridDetails!=='boolean')throw error('SETTINGS_INVALID');
        if ('disabledProviders' in values && (!Array.isArray(values.disabledProviders) || values.disabledProviders.length > 4 ||
            new Set(values.disabledProviders).size !== values.disabledProviders.length ||
            values.disabledProviders.some(id=>!['hybridanalysis','virustotal','urlhaus','urlscan'].includes(id)))) throw error('SETTINGS_INVALID');
        if ('ipReputationEnabled' in values && typeof values.ipReputationEnabled !== 'boolean') throw error('SETTINGS_INVALID');
        const changedKeys=['apikey','virustotalApikey','urlhausApikey','urlscanApikey','ipReputationApiKey','ipReputationProvider'];
        if(changedKeys.some(key=>Object.prototype.hasOwnProperty.call(values,key))) {
            const old=await browser.storage.local.get([...changedKeys,'providerConnectionTests']);
            const tests={...old.providerConnectionTests};
            const providers={apikey:['hybridanalysis'],virustotalApikey:['virustotal'],urlhausApikey:['urlhaus'],urlscanApikey:['urlscan'],ipReputationApiKey:['virustotal','abuseipdb'],ipReputationProvider:['virustotal','abuseipdb']};
            for(const key of changedKeys)if(Object.prototype.hasOwnProperty.call(values,key)&&values[key]!==old[key])for(const provider of providers[key])delete tests[provider];
            await browser.storage.local.set({...values,providerConnectionTests:tests});
        }else await browser.storage.local.set(values);
        return {success:true};
        });
    }
    function decision(policy,input) {
        if (policy.invalid) return {mode:'block',reason:'policy_invalid',revision:policy.revision};
        const incomplete = !Number.isFinite(input.score) || input.coverage !== 'checked' || !['CLEAN','MALICIOUS','MALICIOUS_VISUAL','SUSPICIOUS'].includes(input.verdict) || !!input.check && !['success','not_requested'].includes(input.check.outcome);
        const malicious = ['MALICIOUS','MALICIOUS_VISUAL'].includes(input.verdict) || input.malicious===true;
        if (policy.managed) return { ...ThundyManagedPolicy.decision(policy,{...input,malicious,incomplete}), incomplete, revision:policy.revision };
        const reason = malicious ? 'malicious' : Number.isFinite(input.score)&&input.score>=policy.threshold ? 'threshold' : incomplete&&policy.unknown==='approval' ? 'incomplete' : null;
        return {required:policy.enabled&&!!reason,reason:policy.enabled?reason:null,incomplete,revision:policy.revision};
    }
    if (browser.runtime.onConnect) browser.runtime.onConnect.addListener(port=>{
        if(port.name!=='thundy-admin-session')return;let bound;port.onMessage.addListener(value=>{const session=sessions.get(value.token);if(session?.identity===identity(port.sender))bound=value.token;});port.onDisconnect.addListener(()=>{sessions.delete(bound);});
    });
    return {read,effective,auditConfiguration,status,command,authorized,write,decision,verify,identity,page,defaults,attachmentDefaults,serialized};
})();
