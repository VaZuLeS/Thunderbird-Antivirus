/**
 * Returns the localized string for a key and falls back to the German text that
 * is part of the call site. The fallback keeps the popup working on platforms
 * without i18n (for example in the unit tests).
 */
function t(key, fallback, subs) {
    try {
        const i18n = (typeof browser !== 'undefined') ? browser.i18n : null;
        if (i18n && typeof i18n.getMessage === 'function') {
            const message = i18n.getMessage(key, subs);
            if (message) return message;
        }
    } catch (e) { /* fall through to the fallback text */ }
    return fallback;
}

/**
 * Applies the localizations declared in popup.html via data-i18n* attributes.
 * Never throws: the popup must stay usable even if the DOM or i18n is missing.
 */
function applyI18n() {
    try {
        const i18n = (typeof browser !== 'undefined') ? browser.i18n : null;
        if (!i18n || typeof i18n.getMessage !== 'function') return;
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        const resolve = (element, attribute) => {
            const key = element.getAttribute(attribute);
            if (!key) return null;
            const subs = element.getAttribute('data-i18n-subs');
            return i18n.getMessage(key, subs ? subs.split(',') : undefined) || null;
        };
        for (const element of document.querySelectorAll('[data-i18n]')) {
            const message = resolve(element, 'data-i18n');
            if (message) element.textContent = message;
        }
        for (const element of document.querySelectorAll('[data-i18n-aria-label]')) {
            const message = resolve(element, 'data-i18n-aria-label');
            if (message) element.setAttribute('aria-label', message);
        }
        if (typeof i18n.getUILanguage === 'function') {
            const language = i18n.getUILanguage();
            if (language) document.documentElement.lang = language;
        }
    } catch (e) { /* localization is best effort */ }
}

applyI18n();

const HYBRID_ANALYSIS_ORIGIN = 'https://hybrid-analysis.com/*';

/**
 * The banner in the message view asks for the host permission from a message
 * handler (runtime.sendMessage), where the user gesture is not guaranteed to
 * survive (store readiness A-12/P0-1). The popup is an extension page, so a
 * click here is always a user gesture - this is the reliable place to grant it.
 */
async function requestHybridAnalysisAccess(button) {
    try {
        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        }
        const granted = await browser.permissions.request({ origins: [HYBRID_ANALYSIS_ORIGIN] });
        if (granted && typeof location !== 'undefined' && typeof location.reload === 'function') {
            location.reload();
        }
        return granted === true;
    } catch (e) {
        console.error('Host permission request failed', e);
        if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
        }
        return false;
    }
}

/**
 * Shows a notice with a "grant access" button when an API key is configured but
 * the Hybrid Analysis host permission is missing. Returns true when the notice
 * was shown. Never throws.
 */
async function renderHostPermissionNotice() {
    try {
        const permissionsApi = (typeof browser !== 'undefined') ? browser.permissions : null;
        if (!permissionsApi || typeof permissionsApi.contains !== 'function' ||
            typeof permissionsApi.request !== 'function') {
            return false;
        }
        if (await permissionsApi.contains({ origins: [HYBRID_ANALYSIS_ORIGIN] })) return false;

        const statusArea = document.getElementById('status_message');
        if (!statusArea) return true;
        statusArea.textContent = '';

        const notice = document.createElement('div');
        notice.className = 'card card-warn mb-3';
        notice.setAttribute('role', 'status');

        const text = document.createElement('p');
        text.textContent = t('popupHostPermissionMissing',
            'Thundy AV darf den Analysedienst noch nicht kontaktieren. Bitte erteilen Sie den Zugriff.');
        notice.appendChild(text);

        const grantButton = document.createElement('button');
        grantButton.className = 'btn-primary mt-2';
        grantButton.textContent = t('popupGrantAccess', 'Zugriff erteilen');
        grantButton.addEventListener('click', () => requestHybridAnalysisAccess(grantButton));
        notice.appendChild(grantButton);

        const hint = document.createElement('p');
        hint.className = 'text-muted';
        hint.textContent = t('popupGrantAccessHint',
            'Der Zugriff wird nur für Hybrid Analysis benötigt und kann jederzeit in den Add-on-Berechtigungen entzogen werden.');
        notice.appendChild(hint);

        statusArea.appendChild(notice);
        return true;
    } catch (e) {
        console.error('Host permission notice failed', e);
        return false;
    }
}

/**
 * Surfaces the diagnostics written by background.js when the in-message banner
 * could not be inserted (store readiness P1-11). A user - or a reviewer - gets a
 * concrete error message instead of a silently missing UI element, and can
 * dismiss the notice once it has been reported.
 */
async function renderInjectionDiagnostics() {
    try {
        const stored = await browser.storage.local.get('messageDisplayInjectionFailed');
        const failure = stored ? stored.messageDisplayInjectionFailed : null;
        if (!failure || !failure.message) return false;

        const statusArea = document.getElementById('status_message');
        if (!statusArea) return true;

        const card = document.createElement('div');
        card.className = 'card card-warn mb-3';
        card.setAttribute('role', 'status');

        const text = document.createElement('p');
        text.textContent = t('popupInjectionFailed',
            `Das Banner konnte zuletzt nicht in die Nachrichtenansicht eingefügt werden (letzter Fehler: ${failure.message}). Bitte melden Sie das mit Ihrer Thunderbird-Version.`,
            [String(failure.message)]);
        card.appendChild(text);

        const dismissButton = document.createElement('button');
        dismissButton.className = 'btn-primary mt-2';
        dismissButton.textContent = t('popupDismiss', 'Ausblenden');
        dismissButton.addEventListener('click', async () => {
            try {
                await browser.storage.local.remove('messageDisplayInjectionFailed');
            } catch (e) {
                console.error('Could not clear the injection diagnostics', e);
            }
            card.remove();
        });
        card.appendChild(dismissButton);

        statusArea.appendChild(card);
        return true;
    } catch (e) {
        console.error('Injection diagnostics could not be rendered', e);
        return false;
    }
}

const byteToHex = new Array(256);
for (let n = 0; n <= 255; n++) {
    byteToHex[n] = n.toString(16).padStart(2, '0');
}

const HTML_ESCAPE_FAST_REGEX = /[&<>"']/;

function escapeHTML(str) {
    if (!str) return '';
    const s = String(str);

    // ⚡ Bolt Optimization: Use non-global regex to fast-path clean strings
    if (!HTML_ESCAPE_FAST_REGEX.test(s)) return s;

    // ⚡ Bolt Optimization: Use manual loop and substring instead of regex dictionary callback for faster escaping
    let res = '';
    let last = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === '&') { res += s.substring(last, i) + '&amp;'; last = i + 1; }
        else if (c === '<') { res += s.substring(last, i) + '&lt;'; last = i + 1; }
        else if (c === '>') { res += s.substring(last, i) + '&gt;'; last = i + 1; }
        else if (c === '"') { res += s.substring(last, i) + '&quot;'; last = i + 1; }
        else if (c === "'") { res += s.substring(last, i) + '&#39;'; last = i + 1; }
    }
    return res + s.substring(last);
}

let apikey_hybridanalysis;

(async () => {
let result = await browser.storage.local.get('apikey');
apikey_hybridanalysis = result.apikey;

if (!apikey_hybridanalysis) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let alertDiv = document.createElement('div');
    alertDiv.className = 'alert-error';
    alertDiv.setAttribute('role', 'alert');
    let strong = document.createElement('strong');
    strong.textContent = t('popupWarningLabel', 'Warnung:');
    alertDiv.appendChild(strong);

    let messageSpan = document.createElement('span');
    messageSpan.id = 'api-key-error-msg';
    messageSpan.textContent = ' ' + t('popupNoApiKey', 'Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.');
    alertDiv.appendChild(messageSpan);

    let btnSettings = document.createElement('button');
    btnSettings.className = 'btn-primary mt-2 ml-2';
    btnSettings.textContent = t('popupOpenSettings', 'Einstellungen öffnen');
    btnSettings.setAttribute('aria-describedby', 'api-key-error-msg');
    btnSettings.addEventListener('click', () => {
        browser.runtime.openOptionsPage();
    });
    alertDiv.appendChild(document.createElement('br'));
    alertDiv.appendChild(btnSettings);

    container.appendChild(alertDiv);
    return;
}

// Fehlt die Host-Berechtigung (zum Beispiel, weil sie beim Scan aus dem Banner
// nicht erteilt werden konnte), laesst sie sich hier nachholen: der Klick auf
// den Button ist eine echte Nutzer-Geste.
await renderHostPermissionNotice();

// Eine fehlgeschlagene Banner-Injektion sichtbar machen (Diagnose aus dem Hintergrundskript).
await renderInjectionDiagnostics();

// Der Benutzer hat auf unseren Button geklickt, holen Sie sich den aktiven Tab im aktuellen Fenster mit
// der Tabs API.
let tabs = await browser.tabs.query({ active: true, currentWindow: true });

// Holen Sie sich die aktuell angezeigte Nachricht im aktiven Tab, mit der
// messageDisplay API. Hinweis: Dies benötigt die messagesRead Berechtigung.
// Manifest V3 in Thunderbird: getDisplayedMessages() liefert eine MessageList.
// Der in MV3 entfernte Aufruf getDisplayedMessage() wird nicht mehr verwendet.
let message = null;
if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
    const messageList = await browser.messageDisplay.getDisplayedMessages(tabs[0].id);
    const messages = Array.isArray(messageList) ? messageList : (messageList && messageList.messages) || [];
    message = messages[0] || null;
} else {
    console.error('messageDisplay.getDisplayedMessages is unavailable in this Thunderbird version');
}

// Ohne Zustimmung zu externer Analyse wird nichts übertragen - das muss im
// Popup sichtbar sein, bevor der Nutzer Uploads auslöst.
const settings = await browser.storage.local.get(['externalAnalysisConsent']);
const externalAnalysisConsent = settings.externalAnalysisConsent === true;

if (!message) {
    let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let emptyCard = document.createElement('div');
    emptyCard.className = 'card card-info mt-3';
    emptyCard.setAttribute('role', 'status');
    let msg = document.createElement('p');
    msg.className = 'text-info';
    msg.textContent = t('popupNoMessageSelected', 'Bitte wählen Sie eine E-Mail aus, um sie zu überprüfen.');
    emptyCard.appendChild(msg);
    container.appendChild(emptyCard);
    return;
}

// Aktualisieren Sie die HTML-Felder mit dem Betreff und dem Absender der Nachricht.
const updateGridField = (id, value, fallbackText) => {
    const el = document.getElementById(id);
    if (value && String(value).trim() !== '') {
        el.textContent = value;
        el.style.color = "";
        el.style.fontStyle = "normal";
    } else {
        el.textContent = fallbackText;
        el.style.color = "var(--text-muted)";
        el.style.fontStyle = "italic";
    }
};

updateGridField("subject", message.subject, t('popupNoSubject', '(Kein Betreff)'));
updateGridField("from", message.author, t('popupUnknownSender', '(Unbekannter Absender)'));
updateGridField("MessageHeaderID", message.headerMessageId, t('popupNoId', '(Keine ID)'));

// Initialen Lade-Status für async Operationen setzen
let apiContainer = document.getElementById('hybrid_analysis_api_content');
if (apiContainer) {
    let cardDiv = document.createElement('div');
    cardDiv.id = 'thundy-initial-loading';
    cardDiv.className = 'card card-info mb-3';

    let loadingP = document.createElement('p');
    loadingP.setAttribute('aria-live', 'polite');
    loadingP.setAttribute('role', 'status');
        loadingP.setAttribute('aria-busy', 'true');
    loadingP.className = 'text-info';
    loadingP.textContent = t('popupLoading', 'Lade Analyseergebnisse...');

    cardDiv.appendChild(loadingP);
    apiContainer.appendChild(cardDiv);
}

// Hinweis, wenn die externe Analyse (Datenübermittlung) nicht freigegeben ist.
if (!externalAnalysisConsent && apiContainer) {
    let consentCard = document.createElement('div');
    consentCard.id = 'thundy-consent-notice';
    consentCard.className = 'card card-warn mb-3';
    consentCard.setAttribute('role', 'status');

    let consentP = document.createElement('p');
    consentP.textContent = t('popupConsentInactive', 'Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.');
    consentCard.appendChild(consentP);

    let consentButton = document.createElement('button');
    consentButton.type = 'button';
    consentButton.className = 'btn-primary mt-2';
    consentButton.textContent = t('popupOpenSettings', 'Einstellungen öffnen');
    consentButton.addEventListener('click', () => browser.runtime.openOptionsPage());
    consentCard.appendChild(consentButton);

    apiContainer.appendChild(consentCard);
}

try {

    // Öffnen Sie die Datenbank
    let openRequest = indexedDB.open("thunderbird_av", 3);

    openRequest.onupgradeneeded = function (e) {
        let db = e.target.result;

        if (!db.objectStoreNames.contains('hybridanalysis')) {
            db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
        }
    };


    openRequest.onsuccess = async function (e) {
        let db = e.target.result;
        // Erstellen Sie eine Transaktion und öffnen Sie den Object Store
        let transaction = db.transaction(["hybridanalysis"], "readonly");
        let store = transaction.objectStore("hybridanalysis");
        // Führen Sie eine Anfrage aus, um den Hash für die angegebene MessageHeaderId zu finden.
        let getRequest = store.get(message.headerMessageId);
        getRequest.onsuccess = async function (e) {
            const record = getRequest.result;
            const hasAttachments = record && record.attachments && record.attachments.length > 0;
            const hasLinks = record && record.links && record.links.length > 0;

            if (hasAttachments || hasLinks) {
                document.getElementById('hybrid_analysis_api_content').textContent = ''; // clear

                let fetchTasks = [];

                if (hasAttachments) {
                    for (const att of record.attachments) {
                        const hash256 = att.hybrid_sha256;
                        if (att.state === 'UNKNOWN') {
                            renderManualUploadUI(hash256, att.attachment_name, message.id, att.partName, message.headerMessageId, syncFragment);
                        } else {
                            fetchTasks.push((frag) =>
                                get_hybrid_report_by_sha256({
                                    hybrid_sha: hash256,
                                    attachmentName: att.attachment_name,
                                    messageId: message.id,
                                    partName: att.partName,
                                    headerMessageId: message.headerMessageId,
                                    virustotal_stats: att.virustotal_stats
                                }, frag)
                            );
                        }
                    }
                }

                if (hasLinks) {
                    processRecordLinks(record.links, message.headerMessageId, syncFragment, fetchTasks);
                }

                if (fetchTasks.length > 0) {
                    await Promise.all(fetchTasks.map(async task => {
                        let taskFragment = document.createDocumentFragment();
                        await task(taskFragment);
                        if (taskFragment.hasChildNodes()) {
                            container.appendChild(taskFragment);
                        }
                    }));
                }
            } else {
                let container = document.getElementById('hybrid_analysis_api_content');
                if (container) container.textContent = '';
                let emptyCard = document.createElement('div');
                emptyCard.className = 'card card-info mb-3';
                emptyCard.setAttribute('role', 'status');
                let p1 = document.createElement('p');
                p1.className = 'text-info';
                p1.textContent = t('popupNoAttachments', 'Keine Anhänge oder URLs für diese E-Mail gefunden.');
                emptyCard.appendChild(p1);
                container.appendChild(emptyCard);
            }
        };
    };

    openRequest.onerror = function(e) {
        let container = document.getElementById('hybrid_analysis_api_content');
        if (container) container.textContent = '';
        let emptyCard = document.createElement('div');
        emptyCard.className = 'card card-info mb-3';
        emptyCard.setAttribute('role', 'status');
        let p2 = document.createElement('p');
        p2.className = 'text-info';
        p2.textContent = t('popupNoResults', 'Keine Analyseergebnisse für diese E-Mail vorhanden.');
        emptyCard.appendChild(p2);
        container.appendChild(emptyCard);
    }
} catch (error) {
    let container = document.getElementById('hybrid_analysis_api_content');
    if (container) {
        container.textContent = '';
        let errDiv = document.createElement('div');
        errDiv.className = 'alert-error';
        errDiv.setAttribute('role', 'alert');

        let errMsg = document.createElement('span');
        errMsg.id = 'unexpected-error-msg';
        errMsg.textContent = t('popupUnexpectedError', 'Unerwarteter Fehler beim Laden der Analyseergebnisse.');
        errDiv.appendChild(errMsg);

        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = t('popupOpenSettings', 'Einstellungen öffnen');
        btnSettings.setAttribute('aria-describedby', 'unexpected-error-msg');
        btnSettings.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });
        errDiv.appendChild(document.createElement('br'));
        errDiv.appendChild(btnSettings);

        container.appendChild(errDiv);
    }
}
})();

function createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function renderInProgressStatus(json_data, hybrid_sha, card) {
    const pStatus = document.createElement('p');
    pStatus.className = "text-warning";
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = t('popupStatusLabel', 'Status:');
    pStatus.appendChild(statusStrong);
    pStatus.appendChild(document.createTextNode(' ' + t('popupInProgress', 'Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.')));
    card.appendChild(pStatus);

    const pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${json_data.sha256 || hybrid_sha}`;
    card.appendChild(pHash);
}

function renderThreatInfo(json_data, card) {
    let threatClass = "text-success";
    let semanticLabel = t('popupSemanticNormal', ' (Normal)');
    if (json_data.threat_score > 50) {
        threatClass = "text-warning";
        semanticLabel = t('popupSemanticSuspicious', ' (Suspicious)');
    }
    if (json_data.threat_score > 80) {
        threatClass = "text-danger";
        semanticLabel = t('popupSemanticCritical', ' (Critical)');
    }

    const pThreat = document.createElement('p');
    const threatStrong = document.createElement('strong');
    threatStrong.className = `head_line ${threatClass}`;
    threatStrong.textContent = t('popupThreatScoreLabel', 'Bedrohungsscore:');
    pThreat.appendChild(threatStrong);
    pThreat.appendChild(document.createTextNode(" "));
    const threatSpan = document.createElement('span');
    threatSpan.className = threatClass;
    threatSpan.textContent = json_data.threat_score + semanticLabel;
    pThreat.appendChild(threatSpan);
    card.appendChild(pThreat);

    const pVerdict = document.createElement('p');
    const verdictStrong = document.createElement('strong');
    verdictStrong.className = `head_line ${threatClass}`;
    verdictStrong.textContent = t('popupVerdictLabel', 'Urteil:');
    pVerdict.appendChild(verdictStrong);
    pVerdict.appendChild(document.createTextNode(" "));
    const verdictSpan = document.createElement('span');
    verdictSpan.className = threatClass;
    verdictSpan.textContent = json_data.verdict;
    pVerdict.appendChild(verdictSpan);
    card.appendChild(pVerdict);

    const pVxFamily = document.createElement('p');
    const vxStrong = document.createElement('strong');
    vxStrong.textContent = t('popupVxFamilyLabel', 'Vx-Familie:');
    pVxFamily.appendChild(vxStrong);
    pVxFamily.appendChild(document.createTextNode(` ${json_data.vx_family || 'N/A'}`));
    card.appendChild(pVxFamily);

    const pMulti = document.createElement('p');
    pMulti.textContent = t('popupMultiscanResult', `Multiscan-Ergebnis: ${json_data.multiscan_result || 'N/A'}`, [json_data.multiscan_result || 'N/A']);
    card.appendChild(pMulti);

    const pAddInfo = document.createElement('p');
    const addInfoStrong = document.createElement('strong');
    addInfoStrong.textContent = "Additional Information:";
    pAddInfo.appendChild(addInfoStrong);
    card.appendChild(pAddInfo);

    const pAnalysisTime = document.createElement('p');
    pAnalysisTime.textContent = `Analysis start time: ${json_data.analysis_start_time || 'N/A'}`;
    card.appendChild(pAnalysisTime);

    const pTags = document.createElement('p');
    pTags.textContent = `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`;
    card.appendChild(pTags);
}

function renderVirusTotalStats(virustotal_stats, card) {
    const pVtHead = document.createElement('p');
    pVtHead.className = "ml-2";
    const vtHeadStrong = document.createElement('strong');
    vtHeadStrong.textContent = t('popupVtResults', 'VirusTotal Ergebnisse:');
    pVtHead.appendChild(vtHeadStrong);
    card.appendChild(pVtHead);

    const pVtMal = document.createElement('p');
    const malCount = virustotal_stats.malicious || 0;
    pVtMal.className = `ml-4 ${malCount > 0 ? "text-danger" : ""}`;
    pVtMal.textContent = `Malicious: ${malCount}`;
    card.appendChild(pVtMal);

    const pVtUnd = document.createElement('p');
    pVtUnd.className = "ml-4";
    pVtUnd.textContent = `Undetected: ${virustotal_stats.undetected || 0}`;
    card.appendChild(pVtUnd);

    const pVtSus = document.createElement('p');
    const susCount = virustotal_stats.suspicious || 0;
    pVtSus.className = `ml-4 ${susCount > 0 ? "text-warning" : ""}`;
    pVtSus.textContent = `Suspicious: ${susCount}`;
    card.appendChild(pVtSus);

    const pVtHarm = document.createElement('p');
    pVtHarm.className = "ml-4";
    pVtHarm.textContent = `Harmless: ${virustotal_stats.harmless || 0}`;
    card.appendChild(pVtHarm);
}

function renderScannerResults(scanners, card) {
    if (scanners && scanners.length > 0) {
        // Optimization: Use DocumentFragment to batch DOM insertions and avoid multiple reflows
        const fragment = document.createDocumentFragment();
        for (const scanner of scanners) {
            const pScanner = document.createElement('p');
            pScanner.className = "ml-2";
            pScanner.textContent = `Scanner: ${scanner.name}`;
            fragment.appendChild(pScanner);

            const pStatus = document.createElement('p');
            pStatus.className = "ml-4";
            pStatus.textContent = `Status: ${scanner.status}`;
            fragment.appendChild(pStatus);

            const avResults = scanner.anti_virus_results;
            if (avResults) {
                const pAvRes = document.createElement('p');
                pAvRes.className = "ml-4";
                pAvRes.textContent = t('popupAvResults', 'AV-Ergebnisse:');
                fragment.appendChild(pAvRes);

                for (const avResult of avResults) {
                    const { product, verdict } = avResult;
                    const pAv = document.createElement('p');
                    pAv.className = "ml-6";
                    pAv.textContent = t('popupAvVerdict', `AV: ${product} - Urteil: ${verdict}`, [product, verdict]);
                    fragment.appendChild(pAv);
                }
            }
        }
        card.appendChild(fragment);
    } else {
        const emptyCard = document.createElement('div');
        emptyCard.className = 'card card-info mt-2';
        emptyCard.setAttribute('role', 'status');
        const pNoScanners = document.createElement('p');
        pNoScanners.className = 'text-info';
        pNoScanners.textContent = t('popupNoScanners', 'Keine Scanner-Ergebnisse verfügbar.');
        emptyCard.appendChild(pNoScanners);
        card.appendChild(emptyCard);
    }
}

function renderFileDetails(json_data, card) {
    const pHash256 = document.createElement('p');
    pHash256.textContent = t('popupHashLabel', `SHA-256-Hashwert: ${json_data.sha256}`, [json_data.sha256]);
    card.appendChild(pHash256);

    const pFileName = document.createElement('p');
    pFileName.textContent = t('popupFileNameLabel', `Letzter Dateiname: ${json_data.last_file_name || 'N/A'}`, [json_data.last_file_name || 'N/A']);
    card.appendChild(pFileName);

    const pSize = document.createElement('p');
    pSize.textContent = t('popupSizeLabel', `Größe: ${json_data.size || 'N/A'} Bytes`, [json_data.size || 'N/A']);
    card.appendChild(pSize);

    const pType = document.createElement('p');
    pType.textContent = t('popupTypeLabel', `Typ: ${json_data.type || 'N/A'}`, [json_data.type || 'N/A']);
    card.appendChild(pType);
}

function renderActionButtons(hybrid_sha, attachmentName, card) {
    const btnRescan = document.createElement('button');
    btnRescan.id = `btn-rescan-${hybrid_sha}`;
    btnRescan.className = "btn-success mt-2";
    btnRescan.textContent = t('popupRescanButton', 'Erneut scannen (Rescan)');
    btnRescan.setAttribute('aria-describedby', `rescan-status-${hybrid_sha}`);
    card.appendChild(btnRescan);

    const pRescanStatus = document.createElement('p');
    pRescanStatus.id = `rescan-status-${hybrid_sha}`;
    pRescanStatus.className = "mt-2";
    pRescanStatus.setAttribute('aria-live', 'polite');
    pRescanStatus.setAttribute('role', 'status');
    card.appendChild(pRescanStatus);

    if (attachmentName && /\.html?$/i.test(attachmentName)) {
        const btnCdr = document.createElement('button');
        btnCdr.id = `btn-cdr-${hybrid_sha}`;
        btnCdr.className = "btn-primary mt-2 ml-2";
        btnCdr.textContent = t('popupCdrButton', 'Bereinigen & Herunterladen (Lokales CDR)');
        btnCdr.setAttribute('aria-describedby', `cdr-status-${hybrid_sha}`);
        card.appendChild(btnCdr);

        const pCdrStatus = document.createElement('p');
        pCdrStatus.id = `cdr-status-${hybrid_sha}`;
        pCdrStatus.className = "mt-2";
        pCdrStatus.setAttribute('aria-live', 'polite');
        pCdrStatus.setAttribute('role', 'status');
        card.appendChild(pCdrStatus);
    }
}

function renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats = null }) {
    const card = document.createElement('div');
    card.className = "card mb-3";

    const h2 = document.createElement('h2');
    h2.textContent = t('popupCheckedElement', `Geprüftes Element: ${attachmentName || t('popupUnknown', 'Unbekannt')}`, [attachmentName || t('popupUnknown', 'Unbekannt')]);
    card.appendChild(h2);

    if (json_data.state === 'IN_PROGRESS') {
        renderInProgressStatus(json_data, hybrid_sha, card);
    } else {
        renderThreatInfo(json_data, card);

        const pTags = document.createElement('p');
        pTags.textContent = `Tags: ${json_data.tags ? json_data.tags.join(', ') : 'N/A'}`;
        card.appendChild(pTags);

        if (virustotal_stats) {
            renderVirusTotalStats(virustotal_stats, card);
        }
    }

    renderScannerResults(json_data.scanners, card);
    renderFileDetails(json_data, card);
    renderActionButtons(hybrid_sha, attachmentName, card);
    return card;
}

const hybrid_report_cache = new Map();

/**
 * Returns the shared ApiGateway instance when it is available in the current
 * document (popup.html loads api_gateway.js before this module) and null
 * otherwise - for example in unit tests that only provide fetch().
 */
function getApiGateway() {
    if (typeof apiGateway !== 'undefined' && apiGateway && typeof apiGateway.fetchWithTimeout === 'function') {
        return apiGateway;
    }
    if (typeof globalThis !== 'undefined' && globalThis.apiGateway &&
        typeof globalThis.apiGateway.fetchWithTimeout === 'function') {
        return globalThis.apiGateway;
    }
    const Ctor = (typeof globalThis !== 'undefined') ? globalThis.ApiGateway : undefined;
    return (typeof Ctor === 'function') ? new Ctor() : null;
}

/**
 * Uses the central ApiGateway (uniform timeouts and error messages) when it is
 * available and falls back to plain fetch() otherwise.
 */
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const gateway = getApiGateway();
    if (gateway) {
        return gateway.fetchWithTimeout(url, options, timeout);
    }
    return fetch(url, options);
}

async function fetch_hybrid_report(hybrid_sha) {
    if (hybrid_report_cache.has(hybrid_sha)) {
        return hybrid_report_cache.get(hybrid_sha);
    }

    const options = {
        method: 'GET',
        url: 'https://hybrid-analysis.com/api/v2/overview/' + hybrid_sha,
        headers: {
            accept: 'application/json',
            'api-key': apikey_hybridanalysis,
            'user-agent': 'Falcon',
        },
    };

    const fetchPromise = (async () => {
        try {
            const response = await fetchWithTimeout(options.url, options);
            const json_data = await response.json();

            const result = { response, json_data };
            if (response.status !== 200) {
                hybrid_report_cache.delete(hybrid_sha);
            }

            return result;
        } catch (error) {
            hybrid_report_cache.delete(hybrid_sha);
            throw error;
        }
    })();

    hybrid_report_cache.set(hybrid_sha, fetchPromise);
    return fetchPromise;
}

function setupRescanButton({ hybrid_sha, attachmentName, messageId, partName, headerMessageId }) {
    let rescanBtn = document.getElementById(`btn-rescan-${hybrid_sha}`);
    if (rescanBtn) {
        rescanBtn.addEventListener('click', function() {
            let btn = this;
            let statusEl = document.getElementById(`rescan-status-${hybrid_sha}`);
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = t('popupRescanSending', 'Sende Rescan...');
            statusEl.textContent = t('popupRescanUploading', 'Datei wird für Rescan hochgeladen...');

            browser.runtime.sendMessage({
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = t('popupRescanStarted', 'Rescan erfolgreich initiiert. Lade Seite neu...');
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2";
                    btn.innerText = t('popupSuccess', 'Erfolgreich');
                    if (btn.rescanTimeoutId) clearTimeout(btn.rescanTimeoutId);
                    btn.rescanTimeoutId = setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    statusEl.innerText = t('popupRescanError', 'Fehler beim Rescan: ' + (res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')), [res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')]);
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = t('popupRetry', 'Erneut versuchen');
                }
            }).catch(err => {
                statusEl.innerText = t('popupCommunicationError', 'Kommunikationsfehler: ' + err, [String(err)]);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = t('popupRetry', 'Erneut versuchen');
            });
        });
    }
}

function setupCdrButton({ hybrid_sha, attachmentName, messageId, partName }) {
    let cdrBtn = document.getElementById(`btn-cdr-${hybrid_sha}`);
    if (cdrBtn) {
        cdrBtn.addEventListener('click', function() {
            let btn = this;
            let statusEl = document.getElementById(`cdr-status-${hybrid_sha}`);
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerText = t('popupCdrRunning', 'Bereinige...');
            statusEl.innerText = t('popupCdrInProgress', 'Lokales CDR wird durchgeführt...');

            browser.runtime.sendMessage({
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = t('popupCdrDownloadStarted', 'Herunterladen erfolgreich initiiert.');
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = t('popupCdrDone', 'Bereinigt');
                } else {
                    statusEl.innerText = t('popupDownloadError', 'Fehler beim Herunterladen: ' + (res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')), [res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')]);
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = t('popupRetry', 'Erneut versuchen');
                }
            }).catch(err => {
                statusEl.innerText = t('popupCommunicationError', 'Kommunikationsfehler: ' + err, [String(err)]);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = t('popupRetry', 'Erneut versuchen');
            });
        });
    }
}

function render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, json_data }, targetContainer) {
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    let reportNode = renderReport({ json_data, attachmentName, hybrid_sha, virustotal_stats });
    container.appendChild(reportNode);

    setupRescanButton({ hybrid_sha, attachmentName, messageId, partName, headerMessageId });
    setupCdrButton({ hybrid_sha, attachmentName, messageId, partName });
}

function handle_hybrid_report_error(response, attachmentName, targetContainer) {
    console.error(`Hybrid Analysis API error: ${response.status} - ${response.statusText}`);
    let errDiv1 = document.createElement('div');
    errDiv1.className = 'alert-error';
    errDiv1.setAttribute('role', 'alert');

    let errMsg = document.createElement('span');
    errMsg.id = 'api-error-msg-key';
    errMsg.textContent = t('popupApiError', `API Error: ${response.status} für Element ${attachmentName}`, [response.status, attachmentName]);
    errDiv1.appendChild(errMsg);

    if (response.status === 401 || response.status === 403) {
        errMsg.textContent += t('popupApiErrorHint', ' (Möglicherweise ungültiger oder fehlender API-Schlüssel).');
        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = t('popupOpenSettings', 'Einstellungen öffnen');
        btnSettings.setAttribute('aria-describedby', 'api-error-msg-key');
        btnSettings.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });
        errDiv1.appendChild(document.createElement('br'));
        errDiv1.appendChild(btnSettings);
    }

    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    container.appendChild(errDiv1);
}

function handle_hybrid_report_fetch_error(error, attachmentName, targetContainer) {
    console.error('Fetch error:', error);
    let errDiv2 = document.createElement('div');
    errDiv2.className = 'alert-error';
    errDiv2.setAttribute('role', 'alert');
    errDiv2.textContent = t('popupNetworkError', `Netzwerkfehler: ${error.message} für Element ${attachmentName}`, [error.message, attachmentName]);
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    container.appendChild(errDiv2);
}

async function get_hybrid_report_by_sha256({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats = null }, targetContainer) {
    try {
        const { response, json_data } = await fetch_hybrid_report(hybrid_sha);

        if (response.status === 200) {
            render_hybrid_report_ui({ hybrid_sha, attachmentName, messageId, partName, headerMessageId, virustotal_stats, json_data }, targetContainer);
        } else {
            handle_hybrid_report_error(response, attachmentName, targetContainer);
        }
    } catch (error) {
        handle_hybrid_report_fetch_error(error, attachmentName, targetContainer);
    }
}

function handleUrlScanClick(btn, url, urlId, headerMessageId) {
    let statusEl = document.getElementById(`upload-status-${urlId}`);
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerText = "Sende URL...";
    statusEl.innerText = t('popupUrlTransfer', 'URL wird an Hybrid Analysis übertragen...');

    browser.runtime.sendMessage({
        action: "scanUrl",
        url: url,
        headerMessageId: headerMessageId
    }).then(response => {
        if (response && response.status === 'success') {
            statusEl.innerText = t('popupScanOrdered', 'Scan erfolgreich beauftragt! Lade Analyseergebnisse...');
            btn.removeAttribute('aria-busy');
            btn.className = "btn-success mt-2";
            btn.innerText = t('popupSuccess', 'Erfolgreich');
            if (btn.urlScanTimeoutId) clearTimeout(btn.urlScanTimeoutId);
            btn.urlScanTimeoutId = setTimeout(() => {
                const el = document.getElementById(`upload-container-${urlId}`);
                if (el) el.remove();
                // response.data.sha256 enthält den sha256-Hash des URL-Scans
                get_hybrid_report_by_sha256({
                    hybrid_sha: response.data.sha256,
                    attachmentName: url
                });
            }, 3000);
        } else {
            statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : t('popupUnknownError', 'Unbekannter Fehler'));
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = t('popupRetry', 'Erneut versuchen');
        }
    }).catch(err => {
        statusEl.innerText = t('popupCommunicationError', 'Kommunikationsfehler: ' + err, [String(err)]);
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerText = t('popupRetry', 'Erneut versuchen');
    });
}

function processRecordLinks(links, headerMessageId, syncFragment, fetchTasks) {
    for (const linkObj of links) {
        if (linkObj.state === 'UNKNOWN') {
            renderManualUrlScanUI(linkObj.url, headerMessageId, syncFragment);
        } else if (linkObj.hybrid_sha256) {
            fetchTasks.push((frag) => get_hybrid_report_by_sha256({
                hybrid_sha: linkObj.hybrid_sha256,
                attachmentName: linkObj.url
            }, frag));
        }
    }
}

function renderManualUrlScanUI(url, headerMessageId, targetContainer) {
    let container = targetContainer || document.getElementById('hybrid_analysis_api_content');
    // Erzeuge eine sichere, eindeutige ID für die URL
    const u8 = new TextEncoder().encode(url);
    // ⚡ Bolt Optimization: Use a pre-allocated array and .join() to avoid string concatenation overhead.
    const hex = new Array(u8.length);
    for (let j = 0; j < u8.length; j++) hex[j] = byteToHex[u8[j]];
    let urlId = hex.join('');

    let card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${urlId}`;
    card.setAttribute('role', 'status');

    let h2 = document.createElement('h2');
    h2.textContent = `URL: ${url}`;
    card.appendChild(h2);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(t('popupUrlFoundPrefix', 'Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie ')));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = "nicht automatisch hochgeladen";
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = "URL jetzt scannen";
    btnUpload.setAttribute('aria-describedby', `upload-status-${urlId}`);
    card.appendChild(btnUpload);

    let pStatus = document.createElement('p');
    pStatus.id = `upload-status-${urlId}`;
    pStatus.className = "mt-2";
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    container.appendChild(card);

    btnUpload.addEventListener('click', function() {
        handleUrlScanClick(this, url, urlId, headerMessageId);
    });
}

function handleUploadClick({ hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    const handler = function() {
        let btn = this;
        let statusId = `upload-status-${safeHash}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.innerText = "Lade hoch...";
        if (statusEl) statusEl.textContent = t('popupFileTransfer', 'Datei wird an Hybrid Analysis übertragen...');

        browser.runtime.sendMessage({
            action: "uploadAttachment",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName,
            hash: hash,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                if (statusEl) statusEl.innerText = t('popupUploadSuccess', 'Upload erfolgreich! Lade Analyseergebnisse...');
                btn.removeAttribute('aria-busy');
                btn.className = "btn-success mt-2";
                btn.innerText = t('popupSuccess', 'Erfolgreich');
                if (btn.uploadTimeoutId) clearTimeout(btn.uploadTimeoutId);
                btn.uploadTimeoutId = setTimeout(() => {
                    let container = document.getElementById(`upload-container-${safeHash}`);
                    if (container) container.remove();
                    get_hybrid_report_by_sha256({
                        hybrid_sha: hash,
                        attachmentName: attachmentName,
                        messageId: messageId,
                        partName: partName,
                        headerMessageId: headerMessageId
                    });
                }, 3000);
            } else {
                if (statusEl) statusEl.innerText = "Fehler beim Upload: " + (response ? response.message : t('popupUnknownError', 'Unbekannter Fehler'));
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = t('popupRetry', 'Erneut versuchen');
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = t('popupCommunicationError', 'Kommunikationsfehler: ' + err, [String(err)]);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = t('popupRetry', 'Erneut versuchen');
        });
    };

    return handler;
}

function createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${hash}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = `Datei jetzt scannen (Upload)`;
    btnUpload.setAttribute('aria-describedby', `upload-status-${hash}`);
    card.appendChild(btnUpload);

    let pUploadStatus = document.createElement('p');
    pUploadStatus.id = `upload-status-${hash}`;
    pUploadStatus.className = "mt-2";
    pUploadStatus.setAttribute('aria-live', 'polite');
    pUploadStatus.setAttribute('role', 'status');
    card.appendChild(pUploadStatus);

    btnUpload.addEventListener('click', handleUploadClick({ hash, safeHash, attachmentName, messageId, partName, headerMessageId }));
}

function createCdrButton(card, safeHash, attachmentName, messageId, partName) {
    if (!attachmentName || !/\.html?$/i.test(attachmentName)) {
        return;
    }

    let cdrBtn = document.createElement('button');
    cdrBtn.id = `btn-cdr-${safeHash}`;
    cdrBtn.className = "btn-primary mt-2 ml-2";
    cdrBtn.textContent = "Bereinigen & Herunterladen (Lokales CDR)";
    cdrBtn.setAttribute('aria-describedby', `cdr-status-${safeHash}`);
    card.appendChild(cdrBtn);

    let pCdrStatus = document.createElement('p');
    pCdrStatus.id = `cdr-status-${safeHash}`;
    pCdrStatus.className = "mt-2";
    pCdrStatus.setAttribute("aria-live", "polite");
    pCdrStatus.setAttribute("role", "status");
    card.appendChild(pCdrStatus);

    cdrBtn.addEventListener('click', function() {
        let btn = this;
        let statusId = `cdr-status-${safeHash}`;
        let statusEl = document.getElementById(statusId);
        btn.disabled = true;
        if (btn) btn.setAttribute('aria-busy', 'true');
        btn.innerText = t('popupCdrRunning', 'Bereinige...');
        if (statusEl) statusEl.textContent = t('popupCdrInProgress', 'Lokales CDR wird durchgeführt...');

        browser.runtime.sendMessage({
            action: "downloadDisarmed",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName
        }).then(res => {
            if (res && res.status === 'success') {
                if (statusEl) statusEl.innerText = t('popupCdrDownloadStarted', 'Herunterladen erfolgreich initiiert.');
                if (btn) {
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = t('popupCdrDone', 'Bereinigt');
                }
            } else {
                if (statusEl) statusEl.innerText = t('popupDownloadError', 'Fehler beim Herunterladen: ' + (res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')), [res ? res.message : t('popupUnknownError', 'Unbekannter Fehler')]);
                btn.disabled = false;
                if (btn) btn.removeAttribute('aria-busy');
                btn.innerText = t('popupRetry', 'Erneut versuchen');
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = t('popupCommunicationError', 'Kommunikationsfehler: ' + err, [String(err)]);
            btn.disabled = false;
            if (btn) btn.removeAttribute('aria-busy');
            btn.innerText = t('popupRetry', 'Erneut versuchen');
        });
    });
}

function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId, targetContainer) {
    let safeHash = escapeHTML(hash);

    let card = document.createElement('div');
    card.className = "card card-info mb-3";
    card.id = `upload-container-${safeHash}`;
    card.setAttribute('role', 'status');

    let h2 = document.createElement('h2');
    h2.textContent = `Anhang: ${attachmentName || t('popupUnknown', 'Unbekannt')}`;
    card.appendChild(h2);

    let pHash = document.createElement('p');
    pHash.textContent = `SHA-256: ${hash}`;
    card.appendChild(pHash);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(t('popupFileUnknownPrefix', 'Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie ')));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = "nicht automatisch hochgeladen";
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId });
    createCdrButton(card, safeHash, attachmentName, messageId, partName);

    if (targetContainer) {
        targetContainer.appendChild(card);
    } else {
        document.getElementById('hybrid_analysis_api_content').appendChild(card);
    }
}
