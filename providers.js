// Provider adapters. All calls enforce the shared consent and host policy.
function getHybridAnalysisOptions(method, body = null, isUrl = false) {
    if (!apikey_hybridanalysis) throw new Error(uiText("ui_086", "API-Key fehlt."));
    const options = {
        method: method,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis
        }
    };
    if (body) {
        options.body = body;
    }
    if (isUrl) {
        options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    return options;
}

async function checkAbuseIPDB(ip, apikey, analysisContext = null) {
    if (typeof ThundyAnalysis !== 'undefined') analysisContext = ThundyAnalysis.withCache(analysisContext, 'abuseipdb', 'ip', ip);
    if (!mayTransmitExternally()) return null;
    await requireHostPermission('https://api.abuseipdb.com/api/v2/check');
    try {
        const response = await apiGateway.fetchWithTimeout(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
            method: 'GET', analysisContext,
            headers: {
                'Key': apikey,
                'Accept': 'application/json'
            }
        });
        if (response.status === 200) {
            const data = await response.json();
            if (data?.data?.isWhitelisted === true) return false;
            if (Number.isFinite(data?.data?.abuseConfidenceScore)) return data.data.abuseConfidenceScore > 50;
        } else if (response.status === 429) {
            Logger.warn("AbuseIPDB: " + uiText('abuseipdbRateLimited', 'The AbuseIPDB rate limit or quota was reached. Please try again later.'));
        } else if (response.status === 401 || response.status === 403) {
            Logger.warn("AbuseIPDB: " + uiText('abuseipdbInvalidKey', 'Invalid or unauthorized AbuseIPDB API key.'));
        }
    } catch (e) {
        Logger.error("Fehler bei AbuseIPDB Abfrage", e);
    }
    return null;
}

async function checkVirusTotalIP(ip, apikey, analysisContext = null) {
    if (typeof ThundyAnalysis !== 'undefined') analysisContext = ThundyAnalysis.withCache(analysisContext, 'virustotal', 'ip', ip);
    if (!mayTransmitExternally()) return null;
    await requireHostPermission('https://www.virustotal.com/api/v3/ip_addresses/' + ip);
    try {
        const response = await apiGateway.fetchWithTimeout(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            method: 'GET', analysisContext,
            headers: {
                'x-apikey': apikey,
                'Accept': 'application/json'
            }
        });
        if (response.status === 200) {
            const data = await response.json();
            const count = data?.data?.attributes?.last_analysis_stats?.malicious;
            if (Number.isFinite(count)) return count > 0;
        } else if (response.status === 404) {
            Logger.info("VirusTotal IP: " + uiText('virustotalNotFound', 'Element not yet recorded in VirusTotal database.'));
        } else if (response.status === 429) {
            Logger.warn("VirusTotal IP: " + uiText('virustotalRateLimited', 'The VirusTotal rate limit or quota was reached. Please try again later.'));
        } else if (response.status === 401 || response.status === 403) {
            Logger.warn("VirusTotal IP: " + uiText('virustotalInvalidKey', 'Invalid or unauthorized VirusTotal API key.'));
        }
    } catch (e) {
        Logger.error("Fehler bei VirusTotal IP Abfrage", e);
    }
    return null;
}

async function checkVirusTotal(hash, apikey, analysisContext = null) {
    if (typeof ThundyAnalysis !== 'undefined') analysisContext = ThundyAnalysis.withCache(analysisContext, 'virustotal', 'hash', hash);
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    if (vtCache.has(hash)) {
        const stats = await vtCache.get(hash);
        if (stats && analysisContext && typeof ThundyAnalysis !== 'undefined') analysisContext.cached('virustotal', 'hash', !Number.isFinite(stats.malicious) ? 'unknown' : stats.malicious > 0 ? 'malicious' : stats.suspicious > 0 ? 'suspicious' : 'none', ThundyAnalysis.cacheTime('virustotal', 'hash', hash));
        return stats;
    }

    let checkPromise = (async () => {
        const url = `https://www.virustotal.com/api/v3/files/${hash}`;
        const options = {
            method: 'GET', analysisContext,
            headers: {
                'x-apikey': apikey,
                'accept': 'application/json'
            }
        };
        try {
            await requireHostPermission(url);
            const response = await apiGateway.fetchWithTimeout(url, options);
            if (response.status === 200) {
                const data = await response.json();
                if (data && data.data && data.data.attributes && data.data.attributes.last_analysis_stats) {
                    return data.data.attributes.last_analysis_stats;
                }
            } else if (response.status === 404) {
                Logger.info("VirusTotal: " + uiText('virustotalNotFound', 'Element not yet recorded in VirusTotal database.'));
            } else if (response.status === 429) {
                Logger.warn("VirusTotal: " + uiText('virustotalRateLimited', 'The VirusTotal rate limit or quota was reached. Please try again later.'));
            } else if (response.status === 401 || response.status === 403) {
                Logger.warn("VirusTotal: " + uiText('virustotalInvalidKey', 'Invalid or unauthorized VirusTotal API key.'));
            }
            return null;
        } catch (e) {
            Logger.error("Fehler bei VirusTotal Abfrage:", e);
            return null;
        }
    })();

    if (vtCache.size >= MAX_VT_CACHE_SIZE) {
        const firstKey = vtCache.keys().next().value;
        vtCache.delete(firstKey);
    }
    vtCache.set(hash, checkPromise);

    let stats = await checkPromise;
    if (stats === null) {
        // Remove from cache on failure so it can be retried
        vtCache.delete(hash);
    }

    return stats;
}

async function checkURLhaus(domain, apikey, analysisContext = null) {
    if (typeof ThundyAnalysis !== 'undefined') analysisContext = ThundyAnalysis.withCache(analysisContext, 'urlhaus', 'domain', domain);
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    try {
        await requireHostPermission('https://urlhaus-api.abuse.ch/v1/host/');
        const body = new URLSearchParams();
        body.append('host', domain);
        const response = await apiGateway.fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST', analysisContext,
            headers: {
                'Auth-Key': apikey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        if (response.status === 200) {
            const data = await response.json();
            if (data.query_status === 'ok') return Number(data.url_count) > 0 || (Array.isArray(data.urls) && data.urls.length > 0);
            if (data.query_status === 'no_results') return false;
            if (data.query_status === 'invalid_api_key') Logger.warn("URLhaus: " + uiText('urlhausInvalidKey', 'Invalid or unauthorized URLhaus API key.'));
        } else if (response.status === 429) {
            Logger.warn("URLhaus: " + uiText('urlhausRateLimited', 'The URLhaus rate limit or quota was reached. Please try again later.'));
        } else if (response.status === 401 || response.status === 403) {
            Logger.warn("URLhaus: " + uiText('urlhausInvalidKey', 'Invalid or unauthorized URLhaus API key.'));
        }
    } catch (e) {
        Logger.error("Fehler bei URLhaus Abfrage", e);
    }
    return null;
}

function extractUrlscanBrandNames(verdicts) {
    const rawBrands = [
        ...(Array.isArray(verdicts?.urlscan?.brands) ? verdicts.urlscan.brands : []),
        ...(Array.isArray(verdicts?.overall?.brands) ? verdicts.overall.brands : [])
    ];
    const names = [];
    const seen = new Set();
    for (const item of rawBrands) {
        const label = typeof item === 'string'
            ? item.trim()
            : (item && typeof item === 'object' ? String(item.name || item.key || '').trim() : '');
        if (label && !seen.has(label.toLowerCase())) {
            seen.add(label.toLowerCase());
            names.push(label);
        }
    }
    return names;
}

async function checkUrlscanIo(url, apikey, analysisContext = null) {
    let submittedUuid=null;
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    if (!tierAtLeast('max')) return { status: 'NOT_CHECKED' };
    try {
        await requireHostPermission('https://urlscan.io/api/v1/scan/');
        // Start Scan
        // 🛡️ Sentinel: Prevent sensitive URL leakage by defaulting to 'unlisted' instead of 'public' visibility
        const scanRes = await apiGateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/', {
            method: 'POST', analysisContext,
            headers: {
                'API-Key': apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: url, visibility: 'unlisted' })
        });

        let errData = null;
        if (!scanRes.ok) {
            try { errData = await scanRes.json(); } catch (_) {}
        }

        if (scanRes.status === 400) {
            const errorCode=ThundyProviderResults.urlscanRejection(errData),dns=errorCode==='domain_unresolvable',invalid=errorCode==='invalid_request';
            Logger.warn('urlscan.io: HTTP 400 ('+errorCode+')');
            return { status: 'ERROR',errorCode,httpStatus:400,details:uiText(dns?'urlscanDnsError':invalid?'urlscanInvalidRequest':'urlscanSubmissionRejected',dns?'The provider could not resolve the target domain.':invalid?'The provider rejected invalid submission parameters.':'The provider rejected the submission; the response does not establish a DNS failure.') };
        }

        if (scanRes.status === 429) {
            const retryAfter = errData?.retry_after || Number(scanRes.headers?.get?.('retry-after')) || null;
            return {
                status: 'ERROR',
                errorCode: 'rate_limited',
                retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
                details: errData?.message || uiText('urlscanRateLimited', 'The urlscan.io rate limit or quota was reached. Please try again later.')
            };
        }

        if (scanRes.status === 401 || scanRes.status === 403) {
            return { status: 'ERROR', errorCode: 'invalid_key', details: errData?.message || uiText('urlscanInvalidKey', 'Invalid or unauthorized urlscan.io API key.') };
        }

        if (!scanRes.ok) throw new Error(uiText("ui_100", "Fehler beim Starten des Scans (urlscan.io): ") + scanRes.status);

        const scanData = await scanRes.json();
        const uuid = scanData.uuid;submittedUuid=uuid;

        if (!uuid) throw new Error(uiText("ui_101", "Keine UUID von urlscan.io erhalten."));

        if(analysisContext?.submitted)await analysisContext.submitted(uuid);
        const result=await pollUrlscanIoResult(uuid, apikey, analysisContext, {fresh:true});
        return {...result,uuid};
    } catch (e) {
        Logger.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', errorCode: 'fetch_failed', details: e.message,...(submittedUuid?{uuid:submittedUuid}:{}) };
    }
}

async function pollUrlscanIoResult(uuid, apikey, analysisContext = null, {fresh=false} = {}) {
    // Fresh scans need at least 30 seconds; refreshing an existing UUID can start sooner.
    let waitTime = fresh ? 30000 : 2000;
    let elapsed = 0;
    const maxTime = 90000;
    let retainedAssessment = null;
    const failure=(errorCode,details,extra={})=>({status:'ERROR',errorCode,details,...extra,...(retainedAssessment?{assessment:ThundyProviderResults.merge(retainedAssessment,{assessmentVersion:1,completion:'failed',signals:[],state:'failed'})}:{})});
    const deadline = Date.now() + maxTime;

    const pollContext = analysisContext ? {
        ...analysisContext,
        validateResponse:data=>{analysisContext.validateResponse?.(data);if(data?.task?.uuid&&data.task.uuid!==uuid)throw Object.assign(Error('RESOURCE_MISMATCH'),{code:'RESOURCE_MISMATCH'});},
        event: (evt) => {
            if (evt && evt.phase === 'finish' && evt.state === 'incomplete' && Date.now() < deadline) {
                return;
            }
            return analysisContext.event(evt);
        }
    } : null;

    while (elapsed < maxTime && Date.now() < deadline) {
        assertExternalAnalysisAllowed();
        analysisContext?.guard?.();
        if (analysisContext?.signal) await apiGateway.pause(Math.min(waitTime, Math.max(0, deadline - Date.now())),analysisContext.signal);
        else await new Promise(r => setTimeout(r, Math.min(waitTime, Math.max(0, deadline - Date.now()))));
        elapsed += waitTime;
        waitTime = Math.min(waitTime * 1.5, 10000); // 1.5x backoff, max 10s

        if (Date.now() >= deadline) break;
        let resultRes;
        try { resultRes = await apiGateway.fetchWithTimeout(`https://urlscan.io/api/v1/result/${encodeURIComponent(uuid)}/`, {
            method: 'GET', analysisContext: pollContext,
            headers: {
                'API-Key': apikey,
                'Accept': 'application/json'
            }
        }, Math.min(15000, deadline - Date.now()));
        } catch(error) {
            analysisContext?.guard?.();
            return failure(error.code==='RESOURCE_MISMATCH'?'resource_mismatch':'fetch_failed',error.message);
        }
        if (resultRes.status === 200) {
            const resultData = await resultRes.json();

            if(resultData?.task?.uuid && resultData.task.uuid!==uuid) return failure('resource_mismatch');
            const assessment=ThundyProviderResults.merge(retainedAssessment,ThundyProviderResults.evaluate('urlscan',resultData,'report'));
            retainedAssessment=assessment;
            const reasons=[];
            if(assessment.verdict==='malicious')addReason(reasons,'ui_102','Die URL wurde von urlscan.io generell als bösartig eingestuft.');
            else if(assessment.verdict==='suspicious')addReason(reasons,'providerSuspicious','The provider reported suspicious indicators.');
            const brandNames=extractUrlscanBrandNames(resultData.verdicts||{});
            if(assessment.verdict==='malicious'&&resultData.verdicts?.urlscan?.malicious===true&&brandNames.length)addReason(reasons,'visualImpersonation','Visuelle Erkennung: Die Seite gibt sich als $1 aus (Phishing-Verdacht).',[brandNames.join(', ')]);
            const rawReportUrl = typeof resultData?.task?.reportURL === 'string' && /^https:\/\/urlscan\.io\/result\//i.test(resultData.task.reportURL)
                ? resultData.task.reportURL
                : `https://urlscan.io/result/${encodeURIComponent(uuid)}/`;

            analysisContext?.event?.({...assessment,provider:'urlscan',scope:'url',phase:'assessment',observedAt:Date.now()});
            if(assessment.completion==='pending')continue;
            const visual=assessment.verdict==='malicious'&&resultData.verdicts?.urlscan?.malicious===true&&brandNames.length>0;
            return {status:ThundyProviderResults.urlscanStatus(assessment,visual),assessment,reasons,reportUrl:rawReportUrl,...(assessment.errorCode?{errorCode:assessment.errorCode}:{})};
        } else if (resultRes.status === 404) {
            // Not ready yet, continue polling
        } else if (resultRes.status === 410) {
            return failure('result_gone',uiText('urlscanResultGone','This result was deleted by urlscan.io. Updating cannot restore it; a new submission requires an explicit scan.'),{terminal:true,httpStatus:410});
        } else if (resultRes.status === 429) {
            let errData = null; try { errData = await resultRes.json(); } catch (_) {}
            return failure('rate_limited',errData?.message || uiText('urlscanRateLimited', 'The urlscan.io rate limit or quota was reached. Please try again later.'));
        } else if (resultRes.status === 401 || resultRes.status === 403) {
            let errData = null; try { errData = await resultRes.json(); } catch (_) {}
            return failure('invalid_key',errData?.message || uiText('urlscanInvalidKey', 'Invalid or unauthorized urlscan.io API key.'));
        } else {
            return failure('fetch_failed',uiText("ui_105", "Fehler beim Abrufen der Ergebnisse (urlscan.io): ") + resultRes.status);
        }
    }

    return { status: 'TIMEOUT', errorCode: 'timeout', ...(retainedAssessment?{assessment:retainedAssessment}:{}), details: uiText('urlscanTimeoutDetails', 'The result was not ready within the polling window. The accepted scan can be checked again without a new submission.') };
}
