/* Capability and data contract shared by transport, settings and result views. */
const ThundyProviders = (() => {
    const registry = {
        hybridanalysis:{name:'Hybrid Analysis',hosts:['hybrid-analysis.com','www.hybrid-analysis.com'],origin:'https://hybrid-analysis.com/*',header:'api-key',key:'apikey',capabilities:{hash:'strict',report:'strict',file:'balanced',url:'max'},test:{url:'https://hybrid-analysis.com/api/v2/overview/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}},
        virustotal:{name:'VirusTotal',hosts:['www.virustotal.com','virustotal.com'],origin:'https://www.virustotal.com/*',header:'x-apikey',key:'virustotalApikey',capabilities:{hash:'strict',ip:'strict'},test:{url:'https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8'}},
        urlhaus:{name:'URLhaus',hosts:['urlhaus-api.abuse.ch'],origin:'https://urlhaus-api.abuse.ch/*',header:'Auth-Key',key:'urlhausApikey',capabilities:{domain:'strict'},test:{url:'https://urlhaus-api.abuse.ch/v1/host/',method:'POST',body:'host=example.com'}},
        abuseipdb:{name:'AbuseIPDB',hosts:['api.abuseipdb.com'],origin:'https://api.abuseipdb.com/*',header:'Key',key:'ipReputationApiKey',capabilities:{ip:'strict'},test:{url:'https://api.abuseipdb.com/api/v2/check?ipAddress=1.1.1.1&maxAgeInDays=90'}},
        urlscan:{name:'urlscan.io',hosts:['urlscan.io','www.urlscan.io'],origin:'https://urlscan.io/*',header:'API-Key',key:'urlscanApikey',capabilities:{url:'max',report:'max'},test:{url:'https://urlscan.io/api/v1/search/?q=domain:example.com&size=1'}}
    };
    function identify(address,method='GET') {
        const url=new URL(address);if(url.protocol!=='https:'||url.username||url.password) throw Error('PROVIDER_URL_INVALID');
        const entry=Object.entries(registry).find(([,v])=>v.hosts.includes(url.hostname));if(!entry)throw Error('PROVIDER_UNKNOWN');
        const [provider,config]=entry;const path=url.pathname;
        let scope;
        if(provider==='hybridanalysis') scope=path.includes('quick-scan/file')?'file':path.includes('quick-scan/url')?'url':path.includes('/report/')||path.includes('/quick-scan/')?'report':'hash';
        else if(provider==='virustotal')scope=path.includes('/ip_addresses/')?'ip':'hash';
        else scope=provider==='urlhaus'?'domain':provider==='abuseipdb'?'ip':path.includes('/result/')?'report':'url';
        return {provider,config,scope};
    }
    for(const [id,config] of Object.entries(registry))config.normalize=(info,status,data)=>ThundyAnalysis.response({...info,provider:id},status,data);
    async function enforce(address,options={}) {
        const {config,scope}=identify(address,options.method);
        if(!await browser.permissions.contains({origins:[config.origin]}))throw Object.assign(Error('HOST_PERMISSION_MISSING'),{code:'HOST_PERMISSION_MISSING'});
        const test=options.keyTest===true;
        if(test) {
            if(address!==config.test.url || (options.method||'GET')!==(config.test.method||'GET') || (options.body||'')!==(config.test.body||''))throw Error('KEY_TEST_INVALID');
            return;
        }
        const settings=await browser.storage.local.get(['externalAnalysisConsent','privacyTier']);
        if(settings.externalAnalysisConsent!==true)throw Object.assign(Error('EXTERNAL_ANALYSIS_DISABLED'),{code:'EXTERNAL_ANALYSIS_DISABLED'});
        const order={strict:0,balanced:1,max:2};
        if((order[settings.privacyTier]??0)<order[config.capabilities[scope]||'max'])throw Object.assign(Error('TIER_BLOCKS_REQUEST'),{code:'TIER_BLOCKS_REQUEST'});
    }
    async function test(provider,key,authorization=null) {
        const config=registry[provider];if(!config||typeof key!=='string'||!key.trim())return {status:'empty'};
        const options={method:config.test.method||'GET',headers:{[config.header]:key.trim(),Accept:'application/json'},keyTest:true,keyTestAuthorization:authorization};
        if(provider==='hybridanalysis')options.headers['User-Agent']='Falcon activity client';
        if(config.test.body){options.body=config.test.body;options.headers['Content-Type']='application/x-www-form-urlencoded';}
        try {
            const response=await apiGateway.fetchWithTimeout(config.test.url,options,10000);
            const data=typeof response.json==='function'?await response.json().catch(()=>null):null;
            const status=response.status===401||response.status===403||data?.query_status==='invalid_api_key'?'invalid_key':response.status===429?'rate_limited':response.status===200||response.status===404?'valid':'error';
            return {status,...(status==='error'?{code:response.status}:{}),httpStatus:response.status,capability:'read-test',uploadVerified:false,observedAt:Date.now()};
        }catch(e){return {status:e.code==='HOST_PERMISSION_MISSING'?'permission_denied':'error',message:'Connection failed'};}
    }
    function metadata(provider,data,httpStatus) {
        const result={httpStatus};
        const stats=provider==='virustotal'?data?.data?.attributes?.last_analysis_stats:null;
        if(stats){if(Number.isFinite(stats.malicious))result.maliciousCount=stats.malicious;if(Number.isFinite(stats.suspicious))result.suspiciousCount=stats.suspicious;result.totalCount=Object.values(stats).filter(Number.isFinite).reduce((a,b)=>a+b,0);}
        if(provider==='abuseipdb'){if(Number.isFinite(data?.data?.abuseConfidenceScore))result.providerScore=data.data.abuseConfidenceScore;if(Number.isFinite(data?.data?.totalReports))result.reportCount=data.data.totalReports;if(data?.data?.isWhitelisted===true)result.providerVerdict='whitelisted';}
        if(provider==='urlscan'&&Number.isFinite(data?.verdicts?.overall?.score))result.providerScore=data.verdicts.overall.score;
        if(provider==='hybridanalysis'&&Number.isFinite(data?.threat_score))result.providerScore=data.threat_score;
        if(provider==='urlhaus'&&['ok','no_results','invalid_api_key'].includes(data?.query_status))result.providerVerdict=data.query_status;
        const verdict=data?.verdict;
        if(['malicious','suspicious','clean','whitelisted','no specific threat'].includes(verdict))result.providerVerdict=verdict;
        return result;
    }
    return {registry,identify,enforce,test,metadata};
})();
