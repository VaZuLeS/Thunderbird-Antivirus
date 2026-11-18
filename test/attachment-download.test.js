const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createHash,webcrypto} = require('node:crypto');
const {JSDOM} = require('jsdom');

const sources = ['provider_results.js','attachment_download.js'].map(path=>fs.readFileSync(path,'utf8')).join('\n');
const hash = buffer => createHash('sha256').update(Buffer.from(buffer)).digest('hex');
const digest = value => hash(Buffer.from(value));
const target = {tabId:3,messageId:7,partName:'1.2'};
const basePolicy = {mode:'block',unknown:'warn',threshold:70,revision:1};

function fixture() {
    const downloads = [], opened = [], reportRequests = [];
    let notifyDisplayed;
    let securityWork = Promise.resolve();
    const state = {record:{attachments:[]},application:{attachmentPolicy:basePolicy},current:target.messageId,
        contents:'abc',revision:'r1',pending:false};
    const browser = {
        runtime:{id:'addon',getURL:path=>'moz-extension://addon/'+path},
        tabs:{create:async ({url})=>{opened.push(url);return {id:100+opened.length};}},
        messageDisplay:{
            getDisplayedMessages:async ()=>({messages:[{id:state.current}]}),
            onMessagesDisplayed:{addListener:listener=>{notifyDisplayed = listener;}}
        },
        messages:{
            listAttachments:async ()=>[{partName:'1.2',name:'same.pdf'},{partName:'1.3',name:'same.pdf'}],
            getAttachmentFile:async ()=>new File([state.contents],'same.pdf',{type:'application/pdf'})
        },
        storage:{local:{get:async ()=>({})}},
        downloads:{download:async request=>{
            downloads.push({options:request,contents:await (await fetch(request.url)).text()});
            return downloads.length;
        }}
    };
    const timers = new Map();
    const context = vm.createContext({crypto:webcrypto,Date,URL,Uint8Array,
        setTimeout:(run,delay)=>{const id = Symbol();timers.set(id,{run,delay});return id;},
        clearTimeout:id=>{timers.delete(id);}
    });
    vm.runInContext(sources+'\nglobalThis.moduleApi=ThundyAttachmentDownload;',context);
    const deps = {
        security:{
            attachmentDefaults:{mode:'off',unknown:'warn',threshold:70,revision:0},read:async ()=>state.application,
            serialized:task=>{
                const job = securityWork.then(task);
                securityWork = job.catch(()=>{});
                return job;
            },
            verify:async value=>{if(value!=='correct password')throw Error('PASSWORD_INVALID');}
        },
        hash,record:async ()=>state.record,revision:()=>state.revision,pending:()=>state.pending,
        openReport:async (request, resource)=>{reportRequests.push({request,digest:resource.digest});return {success:true};}
    };
    const module = context.moduleApi, gate = module.create(browser,deps);
    const command = (op,extra={},num=0,sender={}) => {
        const url = opened[num];
        return gate.command({challenge:url.split('#')[1],op,...extra},{id:'addon',url,tab:{id:101+num},...sender});
    };
    const withScore = (score,report={},sha=digest('abc'),partName='1.2') =>
        ({partName,attachment_name:'same.pdf',hybrid_sha256:sha,report:{sha256:sha,state:'SUCCESS',threat_score:score,...report}});
    return {state,downloads,opened,browser,module,gate,command,withScore,reportRequests,deps,timers,
        display:id=>{state.current=id;notifyDisplayed({id:target.tabId},{messages:[{id}]});}};
}

test('attachment policy uses the exact 0–100 score and preserves explicit provider warnings', () => {
    const f = fixture();
    for (const score of [0,69,70,71,100]) {
        const evidence = f.module.evidence(f.withScore(score),digest('abc'));
        assert.equal(evidence.score,score);
        assert.equal(evidence.malicious,false);
        assert.equal(f.module.decision(basePolicy,evidence).mode,score>=70?'block':'allow');
    }
    assert.equal(f.module.decision({...basePolicy,threshold:90},f.module.evidence(f.withScore(80),digest('abc'))).mode,'allow');
    assert.equal(f.module.decision({...basePolicy,threshold:90},f.module.evidence(f.withScore(2,{verdict:'malicious'}),digest('abc'))).reason,'malicious');
    assert.equal(f.module.evidence(f.withScore(101),digest('abc')).score,null);
    assert.equal(f.module.evidence(f.withScore(80,{sha256:digest('different')}),digest('abc')).score,null);
    const partial = f.module.evidence(f.withScore(90,{finished:false}),digest('abc'));
    assert.equal(partial.state,'pending');
    assert.equal(f.module.decision(basePolicy,partial).mode,'block');
});

test('hard block never invokes the file picker; same names and another MIME part cannot borrow a score', async () => {
    const f = fixture();
    f.state.record.attachments = [f.withScore(69),f.withScore(100,{verdict:'malicious'},digest('abc'),'1.3'),
        f.withScore(100,{verdict:'malicious'},digest('different'))];
    assert.equal((await f.gate.start(target)).saved,true);
    assert.equal(f.downloads[0].contents,'abc');
    assert.equal(f.downloads[0].options.saveAs,true);
    f.state.record.attachments[0] = f.withScore(70);
    assert.equal((await f.gate.start(target)).dialog,true);
    assert.equal((await f.command('status')).details.mode,'block');
    await assert.rejects(f.command('save',{password:'correct password'}),{code:'ATTACHMENT_BLOCKED'});
    await assert.rejects(f.command('status',{},0,{tab:{id:999}}),{code:'ATTACHMENT_DIALOG_EXPIRED'});
    assert.equal(f.downloads.length,1);
    await f.command('cancel');
    await assert.rejects(f.command('save'),{code:'ATTACHMENT_DIALOG_EXPIRED'});
});

test('unknown scores stay unknown; a late score or changed policy updates the decision before transfer', async () => {
    const f = fixture();
    f.state.pending = true;
    await f.gate.start(target);
    assert.equal((await f.command('status')).details.state,'pending');
    f.state.record.attachments = [f.withScore(94)];
    f.state.revision = 'r2';
    const update = await f.command('save');
    assert.equal(update.changed,true);
    assert.equal(update.details.mode,'block');
    assert.equal(update.details.score,94);
    assert.equal(f.downloads.length,0);
    f.state.application.attachmentPolicy = {...basePolicy,mode:'warn',revision:2};
    assert.equal((await f.command('save')).changed,true);
    assert.equal((await f.command('save')).saved,true);
    await assert.rejects(f.command('save'),{code:'ATTACHMENT_DIALOG_EXPIRED'});
    assert.equal(f.downloads.length,1);
});

test('approval reuses the approval verifier once for this file and the same policy', async () => {
    const f = fixture();
    f.state.application = {attachmentPolicy:{...basePolicy,mode:'approval'},approval:{hash:'approval-verifier'}};
    f.state.record.attachments = [f.withScore(92)];
    await f.gate.start(target);
    assert.equal((await f.command('status')).details.mode,'approval');
    await assert.rejects(f.command('save',{password:'wrong password'}),/PASSWORD_INVALID/);
    await f.command('report');
    assert.equal(f.reportRequests[0].digest,digest('abc'));
    assert.equal(f.downloads.length,0);
    assert.equal((await f.command('save',{password:'correct password'})).saved,true);
    await assert.rejects(f.command('save',{password:'correct password'}),{code:'ATTACHMENT_DIALOG_EXPIRED'});
    assert.equal(f.downloads.length,1);
    delete f.state.application.approval;
    await f.gate.start(target);
    await assert.rejects(f.command('save',{},1),{code:'APPROVAL_NOT_CONFIGURED'});
});

test('message changes, new bytes and unreadable files do not start saving', async () => {
    const f = fixture();
    await f.gate.start(target);
    f.state.current = 42;
    await assert.rejects(f.command('save'),{code:'ATTACHMENT_CONTEXT_CHANGED'});
    f.state.current = target.messageId;
    f.state.contents = 'xyz';
    await assert.rejects(f.command('save'),{code:'ATTACHMENT_CONTEXT_CHANGED'});
    assert.equal(f.downloads.length,0);
    f.browser.messages.getAttachmentFile = async ()=>{throw Error('unreadable');};
    await assert.rejects(f.gate.start(target),{code:'ATTACHMENT_READ_FAILED'});
    f.gate.clear();
});

test('a manual result replaces earlier evidence and navigation during the lookup invalidates direct saving', async () => {
    const f = fixture();
    f.state.record.attachments = [f.withScore(10)];
    f.browser.storage.local.get = async () => {
        f.state.record.attachments = [f.withScore(98)];
        return {};
    };
    assert.equal((await f.gate.start(target)).dialog,true);
    assert.equal((await f.command('status')).details.score,98);
    await f.command('cancel');

    f.browser.storage.local.get = async () => ({});
    f.deps.record = async () => {
        f.display(42);
        return {attachments:[f.withScore(10)]};
    };
    await assert.rejects(f.gate.start(target),{code:'ATTACHMENT_CONTEXT_CHANGED'});
    assert.equal(f.downloads.length,0);
});

test('a stalled local assessment expires without saving late bytes or blocking a retry', async () => {
    const f = fixture();
    let release;
    const stalled = new Promise(resolve=>{release = resolve;});
    f.deps.record = () => stalled;
    const attempt = f.gate.start(target);
    await new Promise(setImmediate);
    const deadline = [...f.timers.values()].find(timer=>timer.delay===5000);
    const expired = assert.rejects(attempt,{code:'ATTACHMENT_CHECK_TIMEOUT'});
    const nextSecurityOperation = f.deps.security.serialized(()=>true);
    deadline.run();
    await expired;
    assert.equal(await nextSecurityOperation,true);
    release({attachments:[f.withScore(20)]});
    await new Promise(setImmediate);
    assert.equal(f.downloads.length,0);
    assert.equal(f.opened.length,0);

    f.deps.record = async () => ({attachments:[f.withScore(20)]});
    assert.equal((await f.gate.start(target)).saved,true);
    assert.equal(f.downloads.length,1);
});

test('attachment dialog hides save for a hard block and focuses cancel without sending on close', async () => {
    const lang = 'de';
    const dom = new JSDOM(fs.readFileSync('attachment_download.html','utf8'),{url:'https://extension.invalid/attachment_download.html#token'});
    try {
        const d = dom.window.document, requests = [];
        const labels = JSON.parse(fs.readFileSync('_locales/'+lang+'/messages.json'));
        const c = vm.createContext({document:d,location:dom.window.location,ThundyI18n:{get:key=>labels[key]?.message},
            browser:{runtime:{sendMessage:async request=>{
                requests.push(request);
                return request.op==='status' ? {success:true,details:{name:'<img>.pdf',score:70,threshold:70,state:'complete',
                    mode:'block',reason:'threshold',report:true}} : {success:true};
            }}}});
        vm.runInContext(fs.readFileSync('attachment_download_page.js','utf8'),c);
        await new Promise(setImmediate);
        assert.equal(d.querySelector('#attachmentSaveForm').hidden,true);
        assert.equal(d.querySelector('#attachmentReport').hidden,false);
        assert.equal(d.querySelector('#attachmentName').textContent,'<img>.pdf');
        assert.equal(d.querySelector('img'),null);
        assert.equal(d.activeElement.id,'attachmentCancel');
        assert.deepEqual(requests.map(r=>r.op),['status']);
        d.querySelector('#attachmentCancel').click();
        await new Promise(setImmediate);
        assert.deepEqual(requests.map(r=>r.op),['status','cancel']);
    } finally {dom.window.close();}
});

test('a bound archived warning survives slot replacement until a new completed score takes precedence', async () => {
    const f = fixture(), timestamp = '2026-11-18T15:00:00Z';
    const previous = {...f.withScore(91),report_fetched_at:timestamp};
    f.state.record = {attachments:[f.withScore(20,{},digest('other'))],analysisReportArchive:{entries:[
        {kind:'attachment',resource:previous},
        {kind:'attachment',resource:f.withScore(100,{},digest('other'))},
        {kind:'attachment',resource:f.withScore(100,{},digest('abc'),'1.3')}
    ]}};
    await f.gate.start(target);
    const status = (await f.command('status')).details;
    assert.equal(status.source,'archive');assert.equal(status.observedAt,Date.parse(timestamp));
    assert.equal(status.score,91);assert.equal(status.mode,'block');
    await assert.rejects(f.command('save'),{code:'ATTACHMENT_BLOCKED'});
    f.state.record.attachments = [f.withScore(20)];
    const update = await f.command('save');
    assert.equal(update.changed,true);assert.equal(update.details.source,'current');
    assert.equal(update.details.mode,'allow');assert.equal(f.downloads.length,0);
    assert.equal((await f.command('save')).saved,true);
});
