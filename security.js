/* Profile-local administration. Secrets are verified only in the background. */
const ThundySecurity = (() => {
    const KEY = 'thundySecurityV1', ITERATIONS = 600000;
    const sessions = new Map(), failures = new Map(), verificationQueues = new Map();
    let queue = Promise.resolve();
    const defaults = { enabled: false, threshold: 50, unknown: 'warn', revision: 0 };
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
        if(!saved || saved.schemaVersion!==1 || !saved.policy || typeof saved.policy.enabled!=='boolean' || !Number.isInteger(saved.policy.threshold) || saved.policy.threshold<0 || saved.policy.threshold>100 || !['warn','approval'].includes(saved.policy.unknown) || !Number.isSafeInteger(saved.policy.revision) || saved.policy.revision<0 || ['admin','approval','recovery'].some(key=>saved[key]!==undefined&&!validVerifier(saved[key])))throw error('SECURITY_STATE_INVALID');
        return saved;
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
    async function authorized(sender, token, touch = true) {
        if (!adminPage(sender)) throw error('ADMIN_PAGE_REQUIRED');
        const saved = await read();
        if (!saved.admin) return true;
        const session = sessions.get(token);
        if (!session || session.identity !== identity(sender) || Date.now()-session.at >= 300000) { sessions.delete(token); throw error('ADMIN_LOCKED'); }
        if (touch) session.at = Date.now();
        return true;
    }
    async function status(sender, token) {
        const saved = await read(); let unlocked = !saved.admin;
        if (saved.admin) { try { await authorized(sender,token,false); unlocked=true; } catch (_) {} }
        return {protected:!!saved.admin,unlocked,approvalConfigured:!!saved.approval,policy:{...defaults,...saved.policy}};
    }
    function serialized(fn) { const job=queue.then(fn);queue=job.catch(()=>{});return job; }
    async function command(request,sender) {
        const {op,token}=request;
        if (!adminPage(sender)) throw error('ADMIN_PAGE_REQUIRED');
        if (op==='status') return status(sender,token);
        if (op==='touch') { await authorized(sender,token);return {}; }
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
            await authorized(sender,token);
            let recovery;
            if (op==='configure') {
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
                if (!policy || typeof policy.enabled!=='boolean' || !Number.isInteger(policy.threshold) || policy.threshold<0 || policy.threshold>100 || !['warn','approval'].includes(policy.unknown)) throw error('POLICY_INVALID');
                saved.policy={...policy,revision:(saved.policy?.revision||0)+1};
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
        const allowed = new Set(['apikey','virustotalApikey','urlhausApikey','urlscanApikey','privacyTier','alwaysManual','scanMode','autoScanLinks','timeOfClickProtection','ipReputationProvider','ipReputationApiKey','externalAnalysisConsent','scanningEnabledSenders','trustedAuthServers','customWhitelist','customBlacklist','onboardingState','thundyAppearance','thundyAccent','thundyDensity','enterpriseProfile','enterpriseConfiguration','enterpriseProfileSelection']);
        if (Object.keys(values).some(k=>!allowed.has(k))) throw error('SETTINGS_INVALID');
        if('scanMode' in values && !['allDisplayed','approvedSenders','manual'].includes(values.scanMode))throw error('SETTINGS_INVALID');
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
        const incomplete = !Number.isFinite(input.score) || input.coverage !== 'checked' || !['CLEAN','MALICIOUS','MALICIOUS_VISUAL','SUSPICIOUS'].includes(input.verdict) || !!input.check && !['success','not_requested'].includes(input.check.outcome);
        const malicious = ['MALICIOUS','MALICIOUS_VISUAL'].includes(input.verdict) || input.malicious===true;
        const reason = malicious ? 'malicious' : Number.isFinite(input.score)&&input.score>=policy.threshold ? 'threshold' : incomplete&&policy.unknown==='approval' ? 'incomplete' : null;
        return {required:policy.enabled&&!!reason,reason:policy.enabled?reason:null,incomplete,revision:policy.revision};
    }
    if (browser.runtime.onConnect) browser.runtime.onConnect.addListener(port=>{
        if(port.name!=='thundy-admin-session')return;let bound;port.onMessage.addListener(value=>{const session=sessions.get(value.token);if(session?.identity===identity(port.sender))bound=value.token;});port.onDisconnect.addListener(()=>{sessions.delete(bound);});
    });
    return {read,status,command,authorized,write,decision,verify,identity,page,defaults,serialized};
})();
