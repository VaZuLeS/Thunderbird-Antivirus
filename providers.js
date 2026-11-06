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
        if (response.status !== 200) return null;
        const data = await response.json();
        if (Number.isFinite(data?.data?.abuseConfidenceScore)) return data.data.abuseConfidenceScore > 50;
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
        if (response.status !== 200) return null;
        const data = await response.json();
        const count = data?.data?.attributes?.last_analysis_stats?.malicious;
        if (Number.isFinite(count)) return count > 0;
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
        if (!response.ok) return null;
        const data = await response.json();
        if (data.query_status === 'ok') return Number(data.url_count) > 0 || (Array.isArray(data.urls) && data.urls.length > 0);
        if (data.query_status === 'no_results') return false;
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

        if (scanRes.status === 400) {
           Logger.error("urlscan.io API Error 400 (e.g. Domain not resolvable)", await scanRes.json());
           return { status: 'ERROR', details: 'Domain not resolvable' };
        }

        if (!scanRes.ok) throw new Error(uiText("ui_100", "Fehler beim Starten des Scans (urlscan.io): ") + scanRes.status);

        const scanData = await scanRes.json();
        const uuid = scanData.uuid;

        if (!uuid) throw new Error(uiText("ui_101", "Keine UUID von urlscan.io erhalten."));

        return await pollUrlscanIoResult(uuid, apikey, analysisContext);
    } catch (e) {
        Logger.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', details: e.message };
    }
}

async function pollUrlscanIoResult(uuid, apikey, analysisContext = null) {
    let waitTime = 2000;
    let elapsed = 0;
    const maxTime = 30000;
    const deadline = Date.now() + maxTime;

    while (elapsed < maxTime && Date.now() < deadline) {
        assertExternalAnalysisAllowed();
        await new Promise(r => setTimeout(r, Math.min(waitTime, Math.max(0, deadline - Date.now()))));
        elapsed += waitTime;
        waitTime = Math.min(waitTime * 1.5, 10000); // 1.5x backoff, max 10s

        if (Date.now() >= deadline) break;
        const resultRes = await apiGateway.fetchWithTimeout(`https://urlscan.io/api/v1/result/${encodeURIComponent(uuid)}/`, {
            method: 'GET', analysisContext,
            headers: {
                'API-Key': apikey,
                'Accept': 'application/json'
            }
        }, Math.min(15000, deadline - Date.now()));
        if (resultRes.status === 200) {
            const resultData = await resultRes.json();

            let isMalicious = false;
            let isSuspicious = false;
            let reasons = [];

            const verdicts = resultData && resultData.verdicts ? resultData.verdicts : {};
            const overallScore = Number.isFinite(verdicts.overall?.score) ? verdicts.overall.score : null;
            const urlscanScore = Number.isFinite(verdicts.urlscan?.score) ? verdicts.urlscan.score : null;
            const enginesMalicious = Boolean(verdicts.engines?.malicious || (Number.isFinite(verdicts.engines?.maliciousTotal) && verdicts.engines.maliciousTotal > 0));

            if ((verdicts.overall && verdicts.overall.malicious) || enginesMalicious || (overallScore !== null && overallScore >= 80)) {
                isMalicious = true;
                addReason(reasons, "ui_102", "Die URL wurde von urlscan.io generell als bösartig eingestuft.");
            } else if ((overallScore !== null && overallScore >= 50) || (urlscanScore !== null && urlscanScore >= 50)) {
                isSuspicious = true;
                addReason(reasons, "ui_102", "Die URL wurde von urlscan.io generell als bösartig eingestuft.");
            }

            const brandNames = extractUrlscanBrandNames(verdicts);
            if (brandNames.length > 0) {
                 // Check if it's visually trying to spoof a brand
                 if ((verdicts.urlscan && verdicts.urlscan.malicious) || isMalicious || isSuspicious) {
                    isMalicious = true;
                    addReason(reasons, 'visualImpersonation', 'Visuelle Erkennung: Die Seite gibt sich als $1 aus (Phishing-Verdacht).', [brandNames.join(', ')]);
                 }
            }

            if (isMalicious) {
                return { status: 'MALICIOUS_VISUAL', reasons: reasons };
            } else if (isSuspicious) {
                return { status: 'SUSPICIOUS', reasons: reasons };
            } else {
                return { status: 'CLEAN' };
            }
        } else if (resultRes.status === 404) {
            // Not ready yet, continue polling
        } else {
            throw new Error(uiText("ui_105", "Fehler beim Abrufen der Ergebnisse (urlscan.io): ") + resultRes.status);
        }
    }

    return { status: 'TIMEOUT' }; // Took too long
}
