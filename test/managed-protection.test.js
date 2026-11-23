const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const source = ['managed_policy.js','incident_reporting.js','security.js']
    .map(file => fs.readFileSync(file,'utf8')).join('\n');
const endpoint = 'https://soc.example.test/ingest';
const token = 'fixture-send-token-123456789';
const id = index => 'a1c8080d-5c2e-491e-a163-' + String(index).padStart(12,'0');
const policy = { schemaVersion:1, revision:7, links:{}, attachments:{}, reporting:{ mode:'suspicious', endpoint } };
const malicious = {id:id(1),kind:'link_open',mode:'block',reason:'malicious',finding:'phishing',indicator:'https://test.example/secret?token=example'};

function fixture(managed = policy, local = {}) {
    let now = 1770000000000;
    let alarmListener, permissionAdded, permissionRemoved;
    const requests = [];
    const state = {allowed:true,status:204, retryAfter:null};
    const browser = {
        storage: {
            managed: { get: async () => {
                if (managed instanceof Error) throw managed;
                return { thundyPolicy: structuredClone(managed) };
            } },
            local: {
                get: async key => ({[key]:structuredClone(local[key])}),
                set: async values => Object.assign(local,structuredClone(values)),
                remove: async key => { delete local[key]; }
            }
        },
        permissions: {
            contains: async () => state.allowed,
            getAll: async () => ({data_collection:['technicalAndInteraction','personalCommunications']}),
            onAdded:{addListener:fn => { permissionAdded=fn; }},
            onRemoved:{addListener:fn => { permissionRemoved=fn; }}
        },
        runtime:{id:'addon',getURL:file => 'moz-extension://addon/'+file},
        alarms:{create: async () => {},onAlarm:{addListener:fn => { alarmListener=fn; }}}
    };
    const context = vm.createContext({
        browser, URL, AbortController, setTimeout, clearTimeout, crypto:webcrypto, TextEncoder,
        Date:class extends Date {static now() {return now;}},
        fetch: async (address, request) => {
            requests.push({address,request,event:JSON.parse(request.body)});
            if (state.status === 'offline') throw Error('network');
            return {ok:state.status>=200&&state.status<300,status:state.status,headers:{get:()=>state.retryAfter}};
        }
    });
    vm.runInContext(source+'\nObject.assign(globalThis,{managed:ThundyManagedPolicy,reports:ThundyIncidentReporting,security:ThundySecurity});',context);
    const {security,reports} = context;
    const sender = {id:'addon',url:browser.runtime.getURL('options.html'),tab:{id:1}};
    return {
        ...context, local, state, requests, sender,
        advance: ms => { now += ms; },
        togglePermission: allowed => {
            state.allowed=allowed;
            (allowed ? permissionAdded : permissionRemoved)?.();
        },
        retry: () => alarmListener({name:'thundy-incident-retry'}),
        enable: async (credential=token) => security.command({op:'enableReporting',consent:true,endpoint,credential},sender),
        stop: () => security.command({op:'disableReporting'},sender),
        status: async () => (await security.status(sender)).reporting
    };
}

async function until(condition) {
    for (let i=0; i<100; i++) {
        if (await condition()) return;
        await new Promise(resolve => setTimeout(resolve,5));
    }
    assert.fail('Timed out waiting for reporting state');
}

test('managed fields are read-only even to an authenticated local administrator',async () => {
    const f = fixture();
    const before = await f.security.status(f.sender);
    assert.equal(before.policy.enabled,true);
    assert.equal(before.policy.threshold,50);
    assert.equal(before.attachmentPolicy.threshold,70);
    await f.security.command({op:'configure',adminPassword:'fixture-admin-password'},f.sender);
    const {token} = await f.security.command({op:'unlock',password:'fixture-admin-password'},f.sender);
    await assert.rejects(f.security.command({op:'configure',token,policy:{enabled:false,threshold:99,unknown:'warn'}},f.sender),/POLICY_MANAGED/);
    await assert.rejects(f.security.command({op:'configure',token,attachmentPolicy:{mode:'off',threshold:70,unknown:'warn'}},f.sender),/POLICY_MANAGED/);
    await assert.rejects(f.security.write({timeOfClickProtection:false},f.sender,token),/POLICY_MANAGED/);
    assert.equal((await f.security.status(f.sender,token)).unlocked,true);
});

test('missing policy, malformed declarations, thresholds and unknown evidence are distinct',async () => {
    const local = fixture(new Error('Managed storage manifest not found'));
    assert.equal((await local.security.effective()).policy.enabled,false);
    const f = fixture({...policy,links:{action:'block',threshold:70,unknown:'warn'},attachments:{threshold:101}});
    const effective = await f.security.effective();
    const score = (score, verdict='CLEAN') => f.security.decision(effective.policy,{score,coverage:'checked',verdict});
    assert.equal(score(69).mode,'allow');
    assert.equal(score(70).mode,'block');
    assert.equal(score(0,'MALICIOUS').reason,'malicious');
    assert.equal(score(null,'UNKNOWN').mode,'warn');
    assert.equal(effective.attachmentPolicy.invalid,true);
    assert.equal(f.managed.decision(effective.attachmentPolicy,{}).reason,'policy_invalid');
    const insecure = fixture({...policy,reporting:{mode:'malicious',endpoint:'http://soc.example.test'}});
    assert.equal((await insecure.status()).state,'invalid');
    assert.equal((await insecure.security.effective()).policy.threshold,50);
});

test('consent and exact host grant gate a minimized, idempotent HTTPS event',async () => {
    const f = fixture();
    f.reports.initialize();
    await f.reports.capture(malicious);
    assert.equal(f.requests.length,0);
    f.togglePermission(false);
    await assert.rejects(f.enable(),/REPORTING_SETUP_INVALID/);
    f.togglePermission(true);
    await f.enable();
    await f.reports.capture({...malicious,id:id(2),reason:'unknown'});
    await f.reports.capture(malicious);
    await until(async () => f.requests.length === 1 && (await f.status()).queued === 0);
    const ready = await f.status();
    assert.equal(ready.lastReceiptAt,1770000000000);
    assert.equal(ready.lastReceiptId,id(1));
    assert.equal(ready.oldestPendingId,null);
    const [post] = f.requests;
    assert.equal(post.address,endpoint);
    assert.equal(post.request.redirect,'error');
    assert.equal(post.request.credentials,'omit');
    assert.equal(post.request.headers.Authorization,'Bearer '+token);
    assert.equal(post.request.headers['Idempotency-Key'],id(1));
    assert.deepEqual(post.event, {schemaVersion:1,id:id(1),observedAt:new Date(1770000000000).toISOString(),
        action:'link_open',finding:'phishing',decision:'block',policyRevision:7});
    assert.ok(!JSON.stringify(await f.status()).includes(token));
});

test('offline delivery survives restart with the original event ID and respects permission withdrawal',async () => {
    const f = fixture({...policy,reporting:{...policy.reporting,indicators:true}});
    f.state.status='offline';
    await f.enable();
    await f.reports.capture(malicious);
    await until(() => f.local.thundyIncidentReportingV1.events[0]?.attempts === 1);
    const pending = await f.status();
    assert.equal(pending.lastReceiptId,null);
    assert.equal(pending.oldestPendingId,id(1));
    assert.equal(pending.oldestPendingAt,1770000000000);
    const next = fixture({...policy,reporting:{...policy.reporting,indicators:true}},f.local);
    next.togglePermission(false);
    next.advance(60000);
    next.reports.initialize();
    await until(async () => (await next.status()).state === 'permission');
    assert.equal(next.requests.length,0);
    next.togglePermission(true);
    await until(async () => next.requests.length === 1 && (await next.status()).queued === 0);
    assert.deepEqual(next.requests[0].event,f.requests[0].event);
    assert.equal(next.requests[0].event.hostname,'test.example');
    assert.ok(!next.requests[0].request.body.includes('secret'));
    await next.stop();
    assert.equal((await next.status()).state,'consent');
    assert.equal(next.local.thundyIncidentReportingV1,undefined);
});

test('detailed evidence requires its own consent and rebuilds only known provider links',async () => {
    const f = fixture({...policy,reporting:{...policy.reporting,details:true}});
    await assert.rejects(f.enable(),/REPORTING_SETUP_INVALID/);
    await f.security.command({op:'enableReporting',consent:true,details:true,endpoint,credential:token},f.sender);
    const digest = 'a'.repeat(64);
    await f.reports.capture({...malicious,kind:'attachment_open',finding:'malware',score:80,threshold:70,name:'test.pdf',
        evidence:[{provider:'hybridanalysis',verdict:'malicious',source:'stored',reference:digest,jobId:'job-42',
            reportUrl:'https://other.example/injected',secret:'do not forward'},
        {provider:'virustotal',verdict:'suspicious',source:'stored',suspiciousCount:2}]});
    await until(() => f.requests.length === 1);
    const {event} = f.requests[0];
    assert.equal(event.sha256,undefined);
    assert.equal(event.details.attachmentName,'test.pdf');
    assert.equal(event.details.providers[0].reportUrl,'https://www.hybrid-analysis.com/sample/'+digest);
    assert.equal(event.details.providers[0].jobId,'job-42');
    assert.equal(event.details.providers[1].suspiciousCount,2);
    assert.ok(!JSON.stringify(event).includes('do not forward'));
    assert.ok(!JSON.stringify(event).includes('other.example'));
});

test('authentication failure pauses delivery and the queue is capped and expired',async () => {
    const f = fixture();
    f.state.status=401;
    f.reports.initialize();
    await f.enable();
    await f.reports.capture(malicious);
    await until(async () => (await f.status()).failure === 'authentication');
    for (let i=2; i<=102; i++) {
        await f.reports.capture({...malicious,id:id(i),kind:'attachment_save',finding:'malware'});
    }
    assert.equal((await f.status()).queued,100);
    assert.equal(f.requests.length,1);
    f.advance(24*60*60*1000);
    f.retry();
    await until(() => f.local.thundyIncidentReportingV1.events.length === 0);
    assert.equal(f.requests.length,1);
});
