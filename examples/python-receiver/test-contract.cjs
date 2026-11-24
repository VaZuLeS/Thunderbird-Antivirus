// Generate wire specimens using the shipped sender rather than a second implementation.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../incident_reporting.js'), 'utf8');
const providerSource = fs.readFileSync(path.resolve(__dirname, '../../provider_results.js'), 'utf8');

async function capture(attempt, indicators, details, mode = 'suspicious', detections = false) {
    const endpoint = 'https://soc.example.org/thundy/events';
    const reporting = {mode, endpoint, origin:'https://soc.example.org/*', indicators, details, detections};
    const policy = {revision:7, links:{}, attachments:{}, reporting};
    const storage = {};
    const credential = 'contract-test-token-never-deploy';
    let resolve;
    let deadline;
    const posted = new Promise((result, reject) => {
        resolve = result;
        deadline = setTimeout(() => reject(Error('Thundy did not send the fixture')), 2000);
    });
    const browser = {
        storage:{local:{get:async key => ({[key]:storage[key]}), set:async values => Object.assign(storage,values)}},
        permissions:{contains:async () => true, getAll:async () => ({data_collection:['technicalAndInteraction','personalCommunications']})}
    };
    const sandbox = vm.createContext({browser,ThundyManagedPolicy:{read:async () => policy},URL,AbortController,setTimeout,clearTimeout,
        fetch:async (_url, options) => {
            resolve({body:options.body,key:options.headers['Idempotency-Key']});
            return {ok:true,status:204};
        }});
    const sender = vm.runInContext(providerSource+'\n'+source+'\nThundyIncidentReporting',sandbox);
    try {
        await sender.configure(reporting,{op:'enableReporting',consent:true,details,detections,endpoint,credential});
        await new Promise(setImmediate);
        await sender.capture(attempt);
        return await posted;
    } finally {
        clearTimeout(deadline);
    }
}

async function main() {
    const id = number => `a1c8080d-5c2e-491e-a163-${String(number).padStart(12,'0')}`;
    const digest = 'a'.repeat(64);
    const observedAt = Date.parse('2026-11-23T08:58:00.123Z');
    const link = {kind:'link_open',mode:'block',reason:'malicious',finding:'phishing',indicator:'https://example.org/private?secret=canary'};
    const file = {kind:'attachment_open',mode:'block',reason:'malicious',finding:'malware',indicator:digest,name:'Prüfung & <probe>.pdf'};
    const hybrid = {provider:'hybridanalysis',verdict:'malicious',source:'stored',observedAt,score:91,reference:digest,jobId:'sample-job_42'};
    const result = await Promise.all([
        capture({...link,id:id(1)},false,false,'malicious'),
        capture({...link,id:id(2),mode:'warn',reason:'threshold',score:50,threshold:50},true,true),
        capture({...link,id:id(3),evidence:[{...hybrid,source:'live'},
            {provider:'urlscan',verdict:'suspicious',source:'live',observedAt,reference:id(90)}]},true,true),
        capture({...file,id:id(4),score:91,threshold:70,evidence:[{...hybrid,source:'archive'},
            {provider:'virustotal',verdict:'malicious',source:'stored',maliciousCount:3,suspiciousCount:0}]},true,true),
        capture({...file,id:id(5),kind:'attachment_save',score:0,threshold:0,mode:'warn',reason:'threshold'},false,true),
        capture({...file,id:id(6),kind:'attachment_save'},true,false),
        capture({...file,id:id(7),evidence:[{...hybrid,detections:[{kind:'family',value:'Emotet'},
            {kind:'signature',value:'Trojan:Win32/Emotet!X'},{kind:'category',value:'trojan'}]}]},false,true,'malicious',true),
        capture({...link,id:id(8),evidence:[{provider:'urlscan',verdict:'malicious',source:'stored',reference:id(90),
            detections:[{kind:'category',value:'phishing'},{kind:'brand',value:'PayPal'}]}]},false,true,'malicious',true),
    ]);
    process.stdout.write(JSON.stringify(result));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
