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

async function checkAbuseIPDB(ip, apikey) {
    if (!mayTransmitExternally()) return null;
    await requireHostPermission('https://api.abuseipdb.com/api/v2/check');
    try {
        const response = await apiGateway.fetchWithTimeout(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
            method: 'GET',
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

async function checkVirusTotalIP(ip, apikey) {
    if (!mayTransmitExternally()) return null;
    await requireHostPermission('https://www.virustotal.com/api/v3/ip_addresses/' + ip);
    try {
        const response = await apiGateway.fetchWithTimeout(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            method: 'GET',
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

async function checkVirusTotal(hash, apikey) {
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    if (vtCache.has(hash)) {
        return await vtCache.get(hash);
    }

    let checkPromise = (async () => {
        const url = `https://www.virustotal.com/api/v3/files/${hash}`;
        const options = {
            method: 'GET',
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

async function checkURLhaus(domain, apikey) {
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    try {
        await requireHostPermission('https://urlhaus-api.abuse.ch/v1/host/');
        const body = new URLSearchParams();
        body.append('host', domain);
        const response = await apiGateway.fetchWithTimeout('https://urlhaus-api.abuse.ch/v1/host/', {
            method: 'POST',
            headers: {
                'Auth-Key': apikey,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data.query_status === 'ok') return data.url_count > 0;
        if (data.query_status === 'no_results') return false;
    } catch (e) {
        Logger.error("Fehler bei URLhaus Abfrage", e);
    }
    return null;
}

async function checkUrlscanIo(url, apikey) {
    if (!apikey) return null;
    if (!mayTransmitExternally()) return null;
    if (!tierAtLeast('max')) return { status: 'NOT_CHECKED' };
    try {
        await requireHostPermission('https://urlscan.io/api/v1/scan/');
        // Start Scan
        // 🛡️ Sentinel: Prevent sensitive URL leakage by defaulting to 'unlisted' instead of 'public' visibility
        const scanRes = await apiGateway.fetchWithTimeout('https://urlscan.io/api/v1/scan/', {
            method: 'POST',
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

        return await pollUrlscanIoResult(uuid, apikey);
    } catch (e) {
        Logger.error("Fehler bei urlscan.io Abfrage", e);
        return { status: 'ERROR', details: e.message };
    }
}

async function pollUrlscanIoResult(uuid, apikey) {
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
            method: 'GET',
            headers: {
                'API-Key': apikey,
                'Accept': 'application/json'
            }
        }, Math.min(15000, deadline - Date.now()));
        if (resultRes.status === 200) {
            const resultData = await resultRes.json();

            let isMalicious = false;
            let reasons = [];

            if (resultData.verdicts && resultData.verdicts.overall && resultData.verdicts.overall.malicious) {
                isMalicious = true;
                addReason(reasons, "ui_102", "Die URL wurde von urlscan.io generell als bösartig eingestuft.");
            }

            if (resultData.verdicts && resultData.verdicts.urlscan && resultData.verdicts.urlscan.brands && resultData.verdicts.urlscan.brands.length > 0) {
                 // Check if it's visually trying to spoof a brand
                 if (resultData.verdicts.urlscan.malicious) {
                    isMalicious = true;
                    addReason(reasons, 'visualImpersonation', 'Visuelle Erkennung: Die Seite gibt sich als $1 aus (Phishing-Verdacht).', [resultData.verdicts.urlscan.brands.join(', ')]);
                 }
            }

            if (isMalicious) {
                return { status: 'MALICIOUS_VISUAL', reasons: reasons };
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
