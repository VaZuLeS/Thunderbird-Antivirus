// Consent, scan authorization, privacy tiers and provider host permissions.
const EXTERNAL_ANALYSIS_DISABLED = 'EXTERNAL_ANALYSIS_DISABLED';
const HOST_PERMISSION_MISSING = 'HOST_PERMISSION_MISSING';
const TIER_BLOCKS_UPLOAD = 'TIER_BLOCKS_UPLOAD';
const TIER_REQUIRES_MAX = 'TIER_REQUIRES_MAX';

function typedError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

async function authorizeMessageScan(message, userAction = false) {
    const settings = await browser.storage.local.get(['externalAnalysisConsent', 'scanningEnabledSenders', 'alwaysManual']);
    if (settings.externalAnalysisConsent !== true) return false;
    if (userAction) return true;
    const email = extractEmailAddress(message.author || '').toLowerCase();
    return !settings.alwaysManual && !!email && (settings.scanningEnabledSenders || []).includes(email);
}

function mayTransmitExternally() {
    return externalAnalysisConsent === true;
}

function assertExternalAnalysisAllowed() {
    if (!mayTransmitExternally()) {
        const error = new Error(msg('bannerConsentMissing'));
        error.code = EXTERNAL_ANALYSIS_DISABLED;
        throw error;
    }
}

// Privacy tiers are ordered: strict < balanced < max. The tier limits what may
// leave the machine, and it applies to the automatic scans as well as to the
// manual actions in the popup/context menu (see docs/privacy_policy.md §3.3).
const TIER_ORDER = { strict: 0, balanced: 1, max: 2 };

function tierAtLeast(minimumTier) {
    const current = TIER_ORDER[privacyTier] === undefined ? 0 : TIER_ORDER[privacyTier];
    const required = TIER_ORDER[minimumTier] === undefined ? 0 : TIER_ORDER[minimumTier];
    return current >= required;
}

/**
 * Every provider request must be covered by a host permission the user granted
 * when saving that provider's key (options.js). Without it the request would fail
 * with an opaque network error, so we raise a typed error that the UI can explain.
 */
async function requireHostPermission(url) {
    if (await hasHostPermissionFor(url)) return;
    throw typedError(HOST_PERMISSION_MISSING, msg('errorHostPermissionMissing'));
}

// Host origins that are declared in manifest.json -> optional_host_permissions
const PROVIDER_ORIGINS = {
    hybridanalysis: 'https://hybrid-analysis.com/*',
    virustotal: 'https://www.virustotal.com/*',
    urlscan: 'https://urlscan.io/*',
    urlhaus: 'https://urlhaus-api.abuse.ch/*',
    abuseipdb: 'https://api.abuseipdb.com/*'
};

function originForUrl(url) {
    try {
        const host = new URL(url).hostname;
        if (host === 'hybrid-analysis.com' || host.endsWith('.hybrid-analysis.com')) return PROVIDER_ORIGINS.hybridanalysis;
        if (host === 'virustotal.com' || host.endsWith('.virustotal.com')) return PROVIDER_ORIGINS.virustotal;
        if (host === 'urlscan.io' || host.endsWith('.urlscan.io')) return PROVIDER_ORIGINS.urlscan;
        if (host === 'urlhaus-api.abuse.ch') return PROVIDER_ORIGINS.urlhaus;
        if (host === 'api.abuseipdb.com') return PROVIDER_ORIGINS.abuseipdb;
    } catch (e) { /* invalid URL */ }
    return null;
}

async function hasHostPermissionFor(url) {
    const origin = originForUrl(url);
    if (!origin) return false;
    try {
        return await browser.permissions.contains({ origins: [origin] });
    } catch (e) {
        Logger.error('permissions.contains failed', e);
        return false;
    }
}

