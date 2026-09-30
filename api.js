const byteToHex = new Array(256);
for (let n = 0; n <= 255; n++) {
    byteToHex[n] = n.toString(16).padStart(2, '0');
}

// UI localization for the popup. Self-contained (the popup also loads db.js,
// but the string helper must work in every environment, including tests).
function uiText(key, fallback, subs) {
    try {
        if (typeof browser !== 'undefined' && browser.i18n && typeof browser.i18n.getMessage === 'function') {
            const value = browser.i18n.getMessage(key, subs);
            if (value) return value;
        }
    } catch (e) { /* fall through to the bundled fallback */ }
    const values = Array.isArray(subs) ? subs.slice() : (subs === undefined ? [] : [subs]);
    return String(fallback).replace(/\$(\d)/g, (match, index) => {
        const position = Number(index) - 1;
        return position < values.length ? String(values[position]) : match;
    });
}

const HTML_ESCAPE_FAST_REGEX = /[&<>"']/;

// Localize the static popup markup (see popup.html and _locales/).
try {
    if (typeof applyUiTranslations === 'function') applyUiTranslations();
    document.title = uiText('popupTitle', 'Thundy AV – Email Scanner for Thunderbird');
} catch (e) { /* ignore */ }


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

// Hinweis: Ein fehlender Hybrid-Analysis-Schlüssel beendet die Anzeige nicht
// mehr. Er wird weiter unten als Hinweis ausgegeben, damit die lokal
// gespeicherten Ergebnisse trotzdem sichtbar bleiben.

// Aktuell angezeigte Nachricht ermitteln. getDisplayedMessages() ohne tabId
// bezieht sich auf den aktiven Tab; nur wenn das leer bleibt, wird der Tab
// zusätzlich über die Tabs-API bestimmt (Fallback).
// Hinweis: Dies benötigt die messagesRead Berechtigung.
// Manifest V3 in Thunderbird: getDisplayedMessages() liefert eine MessageList.
function pickFirstMessage(list) {
    if (!list) return null;
    if (Array.isArray(list)) return list[0] || null;
    if (Array.isArray(list.messages)) return list.messages[0] || null;
    return list;
}

let message = null;
if (browser.messageDisplay && typeof browser.messageDisplay.getDisplayedMessages === 'function') {
    message = pickFirstMessage(await browser.messageDisplay.getDisplayedMessages());
    if (!message) {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
            message = pickFirstMessage(await browser.messageDisplay.getDisplayedMessages(tabs[0].id));
        }
    }
} else if (browser.messageDisplay) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    message = await browser.messageDisplay.getDisplayedMessage(tabs[0].id);
}

// Ohne Zustimmung zu externer Analyse wird nichts übertragen - das muss im
// Popup sichtbar sein, bevor der Nutzer Uploads auslöst. Wo die Umgebung die
// eingebaute Datenkonsent-Kategorie anbietet, muss diese zusätzlich erteilt
// sein (dieselbe Regel wie im Hintergrundskript in mayTransmitExternally()).
const settings = await browser.storage.local.get(['externalAnalysisConsent']);
let externalAnalysisConsent = settings.externalAnalysisConsent === true;

if (externalAnalysisConsent) {
    try {
        if (browser.permissions && typeof browser.permissions.getAll === 'function') {
            const granted = await browser.permissions.getAll();
            if (granted && Array.isArray(granted.data_collection) &&
                !granted.data_collection.includes('personalCommunications')) {
                externalAnalysisConsent = false;
            }
        }
    } catch (e) { /* keep the add-on consent */ }
}

// ---------------------------------------------------------------------------
// Popup rendering helpers
// ---------------------------------------------------------------------------
const resultsContainer = document.getElementById('hybrid_analysis_api_content');

function severityForScore(score) {
    if (typeof score !== 'number' || Number.isNaN(score)) return 'info';
    if (score >= 70) return 'danger';
    if (score >= 50) return 'warn';
    if (score > 0) return 'info';
    return 'ok';
}

function createCard(kind, extraClass = '') {
    const card = document.createElement('div');
    card.className = ('card card--' + kind + (extraClass ? ' ' + extraClass : '')).trim();
    return card;
}

function createSettingsButton(extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ('btn btn--primary ' + extraClass).trim();
    button.textContent = uiText('popupOpenSettings', 'Einstellungen öffnen');
    button.addEventListener('click', () => {
        try { browser.runtime.openOptionsPage(); } catch (e) { /* ignore */ }
    });
    return button;
}

function appendHint(container, { id, kind = 'info', text, withSettingsButton = false } = {}) {
    const card = createCard(kind, 'hint');
    if (id) card.id = id;
    card.setAttribute('role', 'status');

    const paragraph = document.createElement('p');
    paragraph.className = 'card__text';
    paragraph.textContent = text;
    card.appendChild(paragraph);

    if (withSettingsButton) card.appendChild(createSettingsButton());

    container.appendChild(card);
    return card;
}

function appendScanAction(container, message, { enabled, reason } = {}) {
    const card = createCard(enabled ? 'info' : 'neutral', 'scan-action');

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'thundy-scan-now';
    button.className = 'btn btn--primary';
    button.textContent = uiText('popupScanNow', 'Diese Nachricht jetzt scannen');
    button.disabled = enabled !== true;
    if (enabled !== true && reason) button.title = reason;

    const status = document.createElement('p');
    status.className = 'card__meta';
    status.setAttribute('role', 'status');
    status.textContent = enabled === true
        ? uiText('popupScanHint', 'Prüft Anhänge und Links über die konfigurierten Dienste und speichert das Ergebnis für dieses Popup.')
        : (reason || uiText('popupScanDisabled', 'Scannen ist erst nach Zustimmung und mit hinterlegtem API-Schlüssel möglich.'));

    button.addEventListener('click', async () => {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = uiText('bannerScanRunning', 'Scanne…');
        status.textContent = uiText('popupScanRunningHint', 'Der Scan läuft…');

        let response = null;
        try {
            response = await browser.runtime.sendMessage({
                action: 'requestScan',
                messageId: message.id,
                senderEmail: extractSenderEmailFromAuthor(message.author),
                persist: false
            });
        } catch (error) {
            response = null;
        }

        if (response && response.success) {
            status.textContent = uiText('popupScanDoneHint', 'Scan abgeschlossen – Ansicht wird aktualisiert…');
            button.textContent = uiText('bannerScanDone', 'Scan abgeschlossen');
            try {
                if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
                    window.location.reload();
                    return;
                }
            } catch (e) { /* the popup may not allow a reload in tests */ }
        } else if (response && response.error === 'permission_denied') {
            status.textContent = uiText('bannerPermissionDenied', 'Erforderliche Host-Berechtigung wurde verweigert');
        } else if (response && (response.error === 'EXTERNAL_ANALYSIS_DISABLED' || response.code === 'EXTERNAL_ANALYSIS_DISABLED')) {
            status.textContent = uiText('bannerConsentMissing', 'Externe Analyse ist in den Einstellungen deaktiviert – es wurden keine Daten übertragen.');
        } else {
            status.textContent = uiText('popupScanFailed', 'Scan fehlgeschlagen');
        }
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = uiText('popupScanNow', 'Diese Nachricht jetzt scannen');
    });

    card.appendChild(button);
    card.appendChild(status);
    container.appendChild(card);
    return card;
}

/** Extracts the plain email address from a header author string. */
function extractSenderEmailFromAuthor(author) {
    const value = String(author || '');
    const match = value.match(/[^\s<>"]+@[^\s<>"]+/);
    return match ? match[0] : '';
}

function renderSectionTitle(container, key, fallback) {
    const title = document.createElement('h2');
    title.className = 'section__title';
    title.textContent = uiText(key, fallback);
    container.appendChild(title);
    return title;
}

function stateChipKind(state) {
    const value = String(state || 'UNKNOWN').toUpperCase();
    if (value === 'MALICIOUS' || value === 'MALICIOUS_VISUAL') return 'danger';
    if (value === 'CLEAN') return 'ok';
    if (value === 'UPLOADED' || value === 'IN_PROGRESS') return 'info';
    return 'neutral';
}

/**
 * Renders stored per-item results (attachment and link verdicts) that are
 * already in the local database. Nothing is transmitted for this, so it is
 * shown regardless of the consent state.
 */
function appendResultList(container, rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const card = createCard('neutral', 'results-list');
    const list = document.createElement('ul');
    list.className = 'list';
    for (const row of rows) {
        const item = document.createElement('li');
        item.className = 'list__item';

        const title = document.createElement('span');
        title.className = 'list__item-title';
        title.textContent = row.title;
        title.title = row.title;
        item.appendChild(title);

        const chip = document.createElement('span');
        chip.className = 'chip chip--' + row.kind;
        chip.textContent = row.chip;
        item.appendChild(chip);

        if (row.reasons && row.reasons.length > 0) {
            const text = document.createElement('span');
            text.className = 'list__item-text';
            text.textContent = row.reasons.join(' · ');
            item.appendChild(text);
        }

        list.appendChild(item);
    }
    card.appendChild(list);
    container.appendChild(card);
    return card;
}

function storedStateLabel(state) {
    const value = String(state || 'UNKNOWN').toUpperCase();
    if (value === 'MALICIOUS' || value === 'MALICIOUS_VISUAL') return uiText('popupStateMalicious', 'bösartig');
    if (value === 'CLEAN') return uiText('popupStateClean', 'unauffällig');
    if (value === 'UPLOADED') return uiText('popupStateUploaded', 'in Analyse');
    if (value === 'IN_PROGRESS') return uiText('popupStateInProgress', 'läuft');
    return uiText('popupStateUnknown', 'unbekannt');
}

function formatTimestamp(value) {
    try {
        const date = value ? new Date(value) : new Date();
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString();
    } catch (e) {
        return '';
    }
}

function renderMessageMeta(message) {
    const setField = (id, value, fallback) => {
        const element = document.getElementById(id);
        if (!element) return;
        const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
        element.textContent = hasValue ? value : fallback;
        element.classList.toggle('is-muted', !hasValue);
    };

    setField('subject', message.subject, uiText('popupNoSubject', '(Kein Betreff)'));
    setField('from', message.author, uiText('popupUnknownSender', '(Unbekannter Absender)'));
    setField('MessageHeaderID', message.headerMessageId, uiText('popupNoMessageId', '(Keine ID)'));
    setField('message_date', message.date ? formatTimestamp(message.date) : '', uiText('popupNoDate', '(Kein Datum)'));
}

/**
 * Renders the stored local assessment (risk score, reasons, authentication
 * result). This data is local only, so it is shown independently of any consent.
 */
function renderAssessmentCard(record, container) {
    const assessment = record && record.localAssessment;
    if (!assessment) return false;

    const severity = severityForScore(assessment.score);
    const card = createCard(severity, 'assessment');
    card.id = 'thundy-assessment';

    const head = document.createElement('div');
    head.className = 'card__head';
    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = uiText('popupLocalAssessment', 'Lokale Bewertung');
    head.appendChild(title);

    const chip = document.createElement('span');
    chip.className = 'chip chip--' + severity;
    chip.textContent = uiText('popupScoreValue', 'Risiko $1/100', [String(assessment.score)]);
    head.appendChild(chip);
    card.appendChild(head);

    const score = document.createElement('div');
    score.className = 'score';
    score.setAttribute('role', 'img');
    score.setAttribute('aria-label', chip.textContent);
    const fill = document.createElement('div');
    fill.className = 'score__fill score__fill--' + severity;
    fill.style.width = Math.max(0, Math.min(100, Number(assessment.score) || 0)) + '%';
    score.appendChild(fill);
    card.appendChild(score);

    const badges = document.createElement('div');
    badges.className = 'badges';
    if (assessment.authStatus === 'pass') {
        const authChip = document.createElement('span');
        authChip.className = 'chip chip--ok';
        authChip.textContent = uiText('bannerAuthPass', 'Sender verified (SPF/DKIM/DMARC passed)');
        badges.appendChild(authChip);
    } else if (assessment.authStatus === 'fail') {
        const authChip = document.createElement('span');
        authChip.className = 'chip chip--warn';
        authChip.textContent = uiText('popupAuthFail', 'SPF/DKIM/DMARC-Prüfung fehlgeschlagen');
        badges.appendChild(authChip);
    }
    if (badges.children.length > 0) card.appendChild(badges);

    const reasons = Array.isArray(assessment.reasons) ? assessment.reasons : [];
    if (reasons.length > 0) {
        const list = document.createElement('ul');
        list.className = 'reasons';
        for (const reason of reasons) {
            const item = document.createElement('li');
            item.className = 'reasons__item';
            item.textContent = reason;
            list.appendChild(item);
        }
        card.appendChild(list);
    } else {
        const quiet = document.createElement('p');
        quiet.className = 'card__text';
        quiet.textContent = uiText('popupNoFindings', 'Die lokalen Prüfungen haben keine Auffälligkeiten gefunden.');
        card.appendChild(quiet);
    }

    const evaluatedAt = formatTimestamp(assessment.evaluatedAt);
    const meta = document.createElement('p');
    meta.className = 'card__meta';
    meta.textContent = evaluatedAt
        ? uiText('popupEvaluatedAt', 'Bewertet: $1', [evaluatedAt])
        : uiText('popupEvaluatedUnknown', 'Bewertungszeitpunkt unbekannt');
    card.appendChild(meta);

    container.appendChild(card);
    return true;
}

/**
 * Reads the stored analysis record for a message (IndexedDB, keyed by the
 * Message-ID header). Resolves with null when nothing is stored or on errors.
 */
function readAnalysisRecord(key) {
    return new Promise((resolve) => {
        if (!key) { resolve(null); return; }
        try {
            const openRequest = indexedDB.open("thunderbird_av", 3);

            openRequest.onupgradeneeded = function (e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('hybridanalysis')) {
                    db.createObjectStore('hybridanalysis', { keyPath: 'messageHeader' });
                }
            };

            openRequest.onerror = function () { resolve(null); };

            openRequest.onsuccess = function (e) {
                try {
                    const db = e.target.result;
                    const transaction = db.transaction(["hybridanalysis"], "readonly");
                    const store = transaction.objectStore("hybridanalysis");
                    const getRequest = store.get(key);
                    getRequest.onsuccess = function () { resolve(getRequest.result || null); };
                    getRequest.onerror = function () { resolve(null); };
                } catch (error) {
                    console.error('Could not read the stored analysis record', error);
                    resolve(null);
                }
            };
        } catch (error) {
            console.error('Could not open the analysis database', error);
            resolve(null);
        }
    });
}

// ---------------------------------------------------------------------------
// Main flow: the local assessment is shown first, provider data only with consent
// ---------------------------------------------------------------------------
if (!resultsContainer) {
    console.error('The popup container is missing in popup.html');
} else if (!message) {
    resultsContainer.textContent = '';
    appendHint(resultsContainer, {
        id: 'thundy-no-message',
        kind: 'info',
        text: uiText('popupSelectMail', 'Bitte wählen Sie eine E-Mail aus, um sie zu überprüfen.')
    });
} else {
    renderMessageMeta(message);
    resultsContainer.textContent = '';
    const loadingCard = appendHint(resultsContainer, {
        id: 'thundy-initial-loading',
        kind: 'info',
        text: uiText('popupLoadingResults', 'Lade Analyseergebnisse...')
    });
    loadingCard.setAttribute('aria-busy', 'true');

    const record = await readAnalysisRecord(message.headerMessageId);
    const attachments = (record && Array.isArray(record.attachments)) ? record.attachments : [];
    const links = (record && Array.isArray(record.links)) ? record.links : [];
    const hasAttachments = attachments.length > 0;
    const hasLinks = links.length > 0;
    const mayQueryProviders = externalAnalysisConsent && !!apikey_hybridanalysis;

    resultsContainer.textContent = '';

    const hasAssessment = renderAssessmentCard(record, resultsContainer);

    // A scan can be started right here; it refreshes the view when it finished.
    appendScanAction(resultsContainer, message, {
        enabled: mayQueryProviders,
        reason: !externalAnalysisConsent
            ? uiText('popupScanDisabledConsent', 'Scannen ist erst möglich, wenn Sie die externe Analyse in den Einstellungen erlauben.')
            : uiText('popupScanDisabledKey', 'Scannen benötigt einen hinterlegten API-Schlüssel (z. B. Hybrid Analysis).')
    });

    if (!externalAnalysisConsent) {
        appendHint(resultsContainer, {
            id: 'thundy-consent-notice',
            kind: 'warn',
            text: uiText('popupConsentDisabled', 'Externe Analyse ist nicht aktiviert: Es werden keine Hashes, Dateien oder Links an Analyse-Dienste übertragen.'),
            withSettingsButton: true
        });
    } else if (!apikey_hybridanalysis) {
        appendHint(resultsContainer, {
            id: 'thundy-api-key-hint',
            kind: 'warn',
            text: uiText('popupNoApiKey', ' Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.'),
            withSettingsButton: true
        });
    }

    const fetchTasks = [];
    const resultsBlockedHint = () => appendHint(resultsContainer, {
        kind: 'info',
        text: uiText('popupResultsBlocked', 'Gespeicherte Analyseergebnisse werden nicht abgerufen, solange die externe Analyse in den Einstellungen nicht erlaubt ist.')
    });

    if (hasAttachments) {
        renderSectionTitle(resultsContainer, 'popupSectionAttachments', 'Anhänge');
        const rows = [];
        for (const attachment of attachments) {
            const state = String(attachment.state || 'UNKNOWN').toUpperCase();
            if (state !== 'UNKNOWN') {
                rows.push({
                    title: attachment.attachment_name || uiText('commonUnknown', 'Unbekannt'),
                    chip: uiText('popupAttachmentState', 'Status: $1', [storedStateLabel(state)]),
                    kind: stateChipKind(state),
                    reasons: Array.isArray(attachment.reasons) ? attachment.reasons : []
                });
            }
        }
        appendResultList(resultsContainer, rows);

        for (const attachment of attachments) {
            const state = String(attachment.state || 'UNKNOWN').toUpperCase();
            if (state === 'UNKNOWN') {
                if (mayQueryProviders) {
                    renderManualUploadUI(attachment.hybrid_sha256, attachment.attachment_name, message.id, attachment.partName, message.headerMessageId, null);
                } else {
                    appendHint(resultsContainer, {
                        kind: 'info',
                        text: uiText('popupUnknownAttachment', 'Anhang „$1“ ist noch unbekannt und wird ohne Zustimmung/API-Schlüssel nicht hochgeladen.', [attachment.attachment_name || uiText('commonUnknown', 'Unbekannt')])
                    });
                }
            } else if (mayQueryProviders) {
                fetchTasks.push((fragment) =>
                    get_hybrid_report_by_sha256({
                        hybrid_sha: attachment.hybrid_sha256,
                        attachmentName: attachment.attachment_name,
                        messageId: message.id,
                        partName: attachment.partName,
                        headerMessageId: message.headerMessageId,
                        virustotal_stats: attachment.virustotal_stats
                    }, fragment)
                );
            }
        }
    }

    if (hasLinks) {
        renderSectionTitle(resultsContainer, 'popupSectionLinks', 'Links');
        appendResultList(resultsContainer, links.map((link) => ({
            title: link.url,
            chip: uiText('popupLinkState', 'Link: $1', [storedStateLabel(link.state)]),
            kind: stateChipKind(link.state),
            reasons: Array.isArray(link.reasons) ? link.reasons : []
        })));

        if (mayQueryProviders) {
            processRecordLinks(links, message.headerMessageId, null, fetchTasks);
        }
    }

    if (fetchTasks.length > 0) {
        await Promise.all(fetchTasks.map(async task => {
            const taskFragment = document.createDocumentFragment();
            await task(taskFragment);
            if (taskFragment.hasChildNodes()) {
                resultsContainer.appendChild(taskFragment);
            }
        }));
    }

    if (!hasAssessment && !hasAttachments && !hasLinks) {
        appendHint(resultsContainer, {
            id: 'thundy-no-record',
            kind: 'info',
            text: uiText('popupNoRecordHint', 'Für diese Nachricht liegt noch kein Ergebnis vor. Öffnen Sie die Nachricht erneut oder starten Sie einen Scan über den Banner oberhalb der Nachricht.')
        });
    } else if (hasAssessment && !hasAttachments && !hasLinks) {
        appendHint(resultsContainer, {
            id: 'thundy-no-provider-data',
            kind: 'info',
            text: uiText('popupNoAttachmentsOrUrls', 'Keine Anhänge oder URLs für diese E-Mail gefunden.')
        });
    }
}
})();

function renderInProgressStatus(json_data, hybrid_sha, card) {
    const pStatus = document.createElement('p');
    pStatus.className = "text-warning";
    const statusStrong = document.createElement('strong');
    statusStrong.textContent = uiText('popupStatusLabel', 'Status:');
    pStatus.appendChild(statusStrong);
    pStatus.appendChild(document.createTextNode(uiText('popupInProgress', ' Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.')));
    card.appendChild(pStatus);

    const pHash = document.createElement('p');
    pHash.textContent = uiText('popupSha256', 'SHA-256: $1', [json_data.sha256 || hybrid_sha]);
    card.appendChild(pHash);
}

function renderThreatInfo(json_data, card) {
    let threatClass = "text-success";
    let semanticLabel = " (Normal)";
    if (json_data.threat_score > 50) {
        threatClass = "text-warning";
        semanticLabel = " (Suspicious)";
    }
    if (json_data.threat_score > 80) {
        threatClass = "text-danger";
        semanticLabel = " (Critical)";
    }

    const pThreat = document.createElement('p');
    const threatStrong = document.createElement('strong');
    threatStrong.className = `head_line ${threatClass}`;
    threatStrong.textContent = uiText('popupThreatScore', 'Bedrohungsscore:');
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
    verdictStrong.textContent = uiText('popupVerdict', 'Urteil:');
    pVerdict.appendChild(verdictStrong);
    pVerdict.appendChild(document.createTextNode(" "));
    const verdictSpan = document.createElement('span');
    verdictSpan.className = threatClass;
    verdictSpan.textContent = json_data.verdict;
    pVerdict.appendChild(verdictSpan);
    card.appendChild(pVerdict);

    const pVxFamily = document.createElement('p');
    const vxStrong = document.createElement('strong');
    vxStrong.textContent = uiText('popupVxFamily', 'Vx-Familie:');
    pVxFamily.appendChild(vxStrong);
    pVxFamily.appendChild(document.createTextNode(` ${json_data.vx_family || 'N/A'}`));
    card.appendChild(pVxFamily);

    const pMulti = document.createElement('p');
    pMulti.textContent = uiText('popupMultiscan', 'Multiscan-Ergebnis: $1', [json_data.multiscan_result || 'N/A']);
    card.appendChild(pMulti);

    const pAddInfo = document.createElement('p');
    const addInfoStrong = document.createElement('strong');
    addInfoStrong.textContent = "Additional Information:";
    pAddInfo.appendChild(addInfoStrong);
    card.appendChild(pAddInfo);

    const pAnalysisTime = document.createElement('p');
    pAnalysisTime.textContent = uiText('popupAnalysisStart', 'Analysis start time: $1', [json_data.analysis_start_time || 'N/A']);
    card.appendChild(pAnalysisTime);

    const pTags = document.createElement('p');
    pTags.textContent = uiText('popupTags', 'Tags: $1', [json_data.tags ? json_data.tags.join(', ') : 'N/A']);
    card.appendChild(pTags);
}

function renderVirusTotalStats(virustotal_stats, card) {
    const pVtHead = document.createElement('p');
    pVtHead.className = "ml-2";
    const vtHeadStrong = document.createElement('strong');
    vtHeadStrong.textContent = uiText('popupVtResults', 'VirusTotal Ergebnisse:');
    pVtHead.appendChild(vtHeadStrong);
    card.appendChild(pVtHead);

    const pVtMal = document.createElement('p');
    const malCount = virustotal_stats.malicious || 0;
    pVtMal.className = `ml-4 ${malCount > 0 ? "text-danger" : ""}`;
    pVtMal.textContent = uiText('popupVtMalicious', 'Malicious: $1', [malCount]);
    card.appendChild(pVtMal);

    const pVtUnd = document.createElement('p');
    pVtUnd.className = "ml-4";
    pVtUnd.textContent = uiText('popupVtUndetected', 'Undetected: $1', [virustotal_stats.undetected || 0]);
    card.appendChild(pVtUnd);

    const pVtSus = document.createElement('p');
    const susCount = virustotal_stats.suspicious || 0;
    pVtSus.className = `ml-4 ${susCount > 0 ? "text-warning" : ""}`;
    pVtSus.textContent = uiText('popupVtSuspicious', 'Suspicious: $1', [susCount]);
    card.appendChild(pVtSus);

    const pVtHarm = document.createElement('p');
    pVtHarm.className = "ml-4";
    pVtHarm.textContent = uiText('popupVtHarmless', 'Harmless: $1', [virustotal_stats.harmless || 0]);
    card.appendChild(pVtHarm);
}

function renderScannerResults(scanners, card) {
    if (scanners && scanners.length > 0) {
        // Optimization: Use DocumentFragment to batch DOM insertions and avoid multiple reflows
        const fragment = document.createDocumentFragment();
        for (const scanner of scanners) {
            const pScanner = document.createElement('p');
            pScanner.className = "ml-2";
            pScanner.textContent = uiText('popupScanner', 'Scanner: $1', [scanner.name]);
            fragment.appendChild(pScanner);

            const pStatus = document.createElement('p');
            pStatus.className = "ml-4";
            pStatus.textContent = uiText('popupScannerStatus', 'Status: $1', [scanner.status]);
            fragment.appendChild(pStatus);

            const avResults = scanner.anti_virus_results;
            if (avResults) {
                const pAvRes = document.createElement('p');
                pAvRes.className = "ml-4";
                pAvRes.textContent = uiText('popupAvResults', 'AV-Ergebnisse:');
                fragment.appendChild(pAvRes);

                for (const avResult of avResults) {
                    const { product, verdict } = avResult;
                    const pAv = document.createElement('p');
                    pAv.className = "ml-6";
                    pAv.textContent = uiText('popupAvVerdict', 'AV: $1 - Urteil: $2', [product, verdict]);
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
        pNoScanners.textContent = uiText('popupNoScannerResults', 'Keine Scanner-Ergebnisse verfügbar.');
        emptyCard.appendChild(pNoScanners);
        card.appendChild(emptyCard);
    }
}

function renderFileDetails(json_data, card) {
    const pHash256 = document.createElement('p');
    pHash256.textContent = uiText('popupSha256Value', 'SHA-256-Hashwert: $1', [json_data.sha256]);
    card.appendChild(pHash256);

    const pFileName = document.createElement('p');
    pFileName.textContent = uiText('popupLastName', 'Letzter Dateiname: $1', [json_data.last_file_name || 'N/A']);
    card.appendChild(pFileName);

    const pSize = document.createElement('p');
    pSize.textContent = uiText('popupSize', 'Größe: $1 Bytes', [json_data.size || 'N/A']);
    card.appendChild(pSize);

    const pType = document.createElement('p');
    pType.textContent = uiText('popupType', 'Typ: $1', [json_data.type || 'N/A']);
    card.appendChild(pType);
}

function renderActionButtons(hybrid_sha, attachmentName, card) {
    const btnRescan = document.createElement('button');
    btnRescan.id = `btn-rescan-${hybrid_sha}`;
    btnRescan.className = "btn-success mt-2";
    btnRescan.textContent = uiText('popupRescanButton', 'Erneut scannen (Rescan)');
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
        btnCdr.textContent = uiText('popupCdrButton', 'Bereinigen & Herunterladen (Lokales CDR)');
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
    h2.textContent = uiText('popupCheckedItem', 'Geprüftes Element: $1', [attachmentName || uiText('commonUnknown', 'Unbekannt')]);
    card.appendChild(h2);

    if (json_data.state === 'IN_PROGRESS') {
        renderInProgressStatus(json_data, hybrid_sha, card);
    } else {
        renderThreatInfo(json_data, card);

        const pTags = document.createElement('p');
        pTags.textContent = uiText('popupTags', 'Tags: $1', [json_data.tags ? json_data.tags.join(', ') : 'N/A']);
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
            const response = await fetch(options.url, options);
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
            btn.textContent = uiText('popupSendRescan', 'Sende Rescan...');
            statusEl.textContent = uiText('popupUploadingRescan', 'Datei wird für Rescan hochgeladen...');

            browser.runtime.sendMessage({
                action: "uploadAttachment",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName,
                hash: hybrid_sha,
                headerMessageId: headerMessageId
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = uiText('popupRescanStarted', 'Rescan erfolgreich initiiert. Lade Seite neu...');
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2";
                    btn.innerText = uiText('popupSuccess', 'Erfolgreich');
                    if (btn.rescanTimeoutId) clearTimeout(btn.rescanTimeoutId);
                    btn.rescanTimeoutId = setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    statusEl.innerText = uiText('popupRescanFailed', 'Fehler beim Rescan: $1', [res ? res.message : uiText('commonUnknownError', 'Unbekannter Fehler')]);
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = uiText('popupRetry', 'Erneut versuchen');
                }
            }).catch(err => {
                statusEl.innerText = uiText('popupCommunicationError', 'Kommunikationsfehler: $1', [err]);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = uiText('popupRetry', 'Erneut versuchen');
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
            btn.innerText = uiText('popupDisarming', 'Bereinige...');
            statusEl.innerText = uiText('popupLocalCdrRunning', 'Lokales CDR wird durchgeführt...');

            browser.runtime.sendMessage({
                action: "downloadDisarmed",
                messageId: messageId,
                partName: partName,
                attachmentName: attachmentName
            }).then(res => {
                if (res && res.status === 'success') {
                    statusEl.innerText = uiText('popupDownloadStarted', 'Herunterladen erfolgreich initiiert.');
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = uiText('popupDisarmed', 'Bereinigt');
                } else {
                    statusEl.innerText = uiText('popupDownloadFailed', 'Fehler beim Herunterladen: $1', [res ? res.message : uiText('commonUnknownError', 'Unbekannter Fehler')]);
                    btn.disabled = false;
                    btn.removeAttribute('aria-busy');
                    btn.innerText = uiText('popupRetry', 'Erneut versuchen');
                }
            }).catch(err => {
                statusEl.innerText = uiText('popupCommunicationError', 'Kommunikationsfehler: $1', [err]);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = uiText('popupRetry', 'Erneut versuchen');
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
    console.error(uiText('popupHybridApiError', 'Hybrid Analysis API error: $1 - $2', [response.status, response.statusText]));
    let errDiv1 = document.createElement('div');
    errDiv1.className = 'alert-error';
    errDiv1.setAttribute('role', 'alert');

    let errMsg = document.createElement('span');
    errMsg.id = 'api-error-msg-key';
    errMsg.textContent = uiText('popupApiError', 'API Error: $1 für Element $2', [response.status, attachmentName]);
    errDiv1.appendChild(errMsg);

    if (response.status === 401 || response.status === 403) {
        errMsg.textContent += uiText('popupApiKeyHint', ' (Möglicherweise ungültiger oder fehlender API-Schlüssel).');
        let btnSettings = document.createElement('button');
        btnSettings.className = 'btn-primary mt-2 ml-2';
        btnSettings.textContent = uiText('popupOpenSettings', 'Einstellungen öffnen');
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
    errDiv2.textContent = uiText('popupNetworkError', 'Netzwerkfehler: $1 für Element $2', [error.message, attachmentName]);
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
    btn.innerText = uiText('popupSendUrl', 'Sende URL...');
    statusEl.innerText = uiText('popupUrlUploading', 'URL wird an Hybrid Analysis übertragen...');

    browser.runtime.sendMessage({
        action: "scanUrl",
        url: url,
        headerMessageId: headerMessageId
    }).then(response => {
        if (response && response.status === 'success') {
            statusEl.innerText = uiText('popupUrlScanStarted', 'Scan erfolgreich beauftragt! Lade Analyseergebnisse...');
            btn.removeAttribute('aria-busy');
            btn.className = "btn-success mt-2";
            btn.innerText = uiText('popupSuccess', 'Erfolgreich');
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
            statusEl.innerText = uiText('popupUploadFailed', 'Fehler beim Upload: $1', [response ? response.message : uiText('commonUnknownError', 'Unbekannter Fehler')]);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = uiText('popupRetry', 'Erneut versuchen');
        }
    }).catch(err => {
        statusEl.innerText = uiText('popupCommunicationError', 'Kommunikationsfehler: $1', [err]);
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        btn.innerText = uiText('popupRetry', 'Erneut versuchen');
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
    h2.textContent = uiText('popupUrlHeading', 'URL: $1', [url]);
    card.appendChild(h2);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(uiText('popupPrivacyUnknownUrl', 'Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie ')));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = uiText('popupNotUploadedAutomatically', 'nicht automatisch hochgeladen');
    pInfo.appendChild(infoStrong);
    pInfo.appendChild(document.createTextNode("."));
    card.appendChild(pInfo);

    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${urlId}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = uiText('popupScanUrlNow', 'URL jetzt scannen');
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
        btn.innerText = uiText('popupUploading', 'Lade hoch...');
        if (statusEl) statusEl.textContent = uiText('popupFileTransfer', 'Datei wird an Hybrid Analysis übertragen...');

        browser.runtime.sendMessage({
            action: "uploadAttachment",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName,
            hash: hash,
            headerMessageId: headerMessageId
        }).then(response => {
            if (response && response.status === 'success') {
                if (statusEl) statusEl.innerText = uiText('popupUploadSuccess', 'Upload erfolgreich! Lade Analyseergebnisse...');
                btn.removeAttribute('aria-busy');
                btn.className = "btn-success mt-2";
                btn.innerText = uiText('popupSuccess', 'Erfolgreich');
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
                if (statusEl) statusEl.innerText = uiText('popupUploadFailed', 'Fehler beim Upload: $1', [response ? response.message : uiText('commonUnknownError', 'Unbekannter Fehler')]);
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.innerText = uiText('popupRetry', 'Erneut versuchen');
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = uiText('popupCommunicationError', 'Kommunikationsfehler: $1', [err]);
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            btn.innerText = uiText('popupRetry', 'Erneut versuchen');
        });
    };

    return handler;
}

function createUploadButton(card, { hash, safeHash, attachmentName, messageId, partName, headerMessageId }) {
    let btnUpload = document.createElement('button');
    btnUpload.id = `btn-upload-${hash}`;
    btnUpload.className = "btn-primary mt-2";
    btnUpload.textContent = uiText('popupScanFileNow', 'Datei jetzt scannen (Upload)');
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
    cdrBtn.textContent = uiText('popupCdrButton', 'Bereinigen & Herunterladen (Lokales CDR)');
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
        btn.innerText = uiText('popupDisarming', 'Bereinige...');
        if (statusEl) statusEl.textContent = uiText('popupLocalCdrRunning', 'Lokales CDR wird durchgeführt...');

        browser.runtime.sendMessage({
            action: "downloadDisarmed",
            messageId: messageId,
            partName: partName,
            attachmentName: attachmentName
        }).then(res => {
            if (res && res.status === 'success') {
                if (statusEl) statusEl.innerText = uiText('popupDownloadStarted', 'Herunterladen erfolgreich initiiert.');
                if (btn) {
                    btn.removeAttribute('aria-busy');
                    btn.className = "btn-success mt-2 ml-2";
                    btn.innerText = uiText('popupDisarmed', 'Bereinigt');
                }
            } else {
                if (statusEl) statusEl.innerText = uiText('popupDownloadFailed', 'Fehler beim Herunterladen: $1', [res ? res.message : uiText('commonUnknownError', 'Unbekannter Fehler')]);
                btn.disabled = false;
                if (btn) btn.removeAttribute('aria-busy');
                btn.innerText = uiText('popupRetry', 'Erneut versuchen');
            }
        }).catch(err => {
            if (statusEl) statusEl.innerText = uiText('popupCommunicationError', 'Kommunikationsfehler: $1', [err]);
            btn.disabled = false;
            if (btn) btn.removeAttribute('aria-busy');
            btn.innerText = uiText('popupRetry', 'Erneut versuchen');
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
    h2.textContent = uiText('popupAttachmentHeading', 'Anhang: $1', [attachmentName || uiText('commonUnknown', 'Unbekannt')]);
    card.appendChild(h2);

    let pHash = document.createElement('p');
    pHash.textContent = uiText('popupSha256', 'SHA-256: $1', [hash]);
    card.appendChild(pHash);

    let pInfo = document.createElement('p');
    pInfo.className = "text-info";
    pInfo.appendChild(document.createTextNode(uiText('popupPrivacyUnknownFile', 'Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie ')));
    const infoStrong = document.createElement('strong');
    infoStrong.textContent = uiText('popupNotUploadedAutomatically', 'nicht automatisch hochgeladen');
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
