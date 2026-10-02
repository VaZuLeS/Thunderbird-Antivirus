// ---------------------------------------------------------------------------
// Data collection consent
//
// manifest.json declares `data_collection_permissions: { required: ["none"],
// optional: ["personalCommunications"] }` and the Thunderbird permission
// `sensitiveDataUpload` as an optional permission. Thunderbird has no built-in
// onboarding prompt for data collection ("add-ons must request consent
// explicitly", webextension-api.thunderbird.net/en/mv3/permissions.html), so the
// consent is requested here - inside the save click handler, i.e. in a user
// gesture. Feature detection via permissions.getAll() keeps this working on
// Thunderbird builds without the built-in data collection consent.
// ---------------------------------------------------------------------------
const DATA_COLLECTION_REQUEST = {
    data_collection: ['personalCommunications'],
    permissions: ['sensitiveDataUpload']
};

async function dataCollectionConsentSupported() {
    try {
        const permissions = await browser.permissions.getAll();
        return !!permissions && Object.prototype.hasOwnProperty.call(permissions, 'data_collection');
    } catch (e) {
        return false;
    }
}

/**
 * Requests the data collection consent (and the Thunderbird permission for
 * uploading sensitive data). Returns true if the add-on may transmit.
 */
async function requestDataCollectionConsent() {
    if (!(await dataCollectionConsentSupported())) {
        // No built-in consent model: the checkbox on this page is the authority.
        await requestSensitiveDataUploadPermission();
        return true;
    }
    try {
        const granted = await browser.permissions.request(DATA_COLLECTION_REQUEST);
        return granted === true;
    } catch (e) {
        // Older builds may not accept the combined request; try the permission alone.
        await requestSensitiveDataUploadPermission();
        return true;
    }
}

async function requestSensitiveDataUploadPermission() {
    try {
        await browser.permissions.contains({ permissions: ['sensitiveDataUpload'] }) ||
            await browser.permissions.request({ permissions: ['sensitiveDataUpload'] });
    } catch (e) {
        // Best effort: the permission is a signal for reviewers, not a gate.
    }
}

async function removeDataCollectionConsent() {
    try {
        await browser.permissions.remove({ data_collection: ['personalCommunications'] });
    } catch (e) { /* ignore */ }
    try {
        await browser.permissions.remove({ permissions: ['sensitiveDataUpload'] });
    } catch (e) { /* ignore */ }
}

// Event-Listener für das Laden der Seite
let _saveTimeoutId = null;
let _clearTimeoutId = null;
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey',
        'adminEmails', 'adminPhone', 'adminContactName', 'adminOrganization',
        'reportIncludeUrls', 'linkGateMode', 'linkGateEnabled'
    ]).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('urlscanApikey').value = result.urlscanApikey || "";
      document.getElementById('virustotalApikey').value = result.virustotalApikey || "";
      document.getElementById('privacyTier').value = result.privacyTier || "strict";
      document.getElementById('customWhitelist').value = (result.customWhitelist || []).join(', ');
      document.getElementById('customBlacklist').value = (result.customBlacklist || []).join(', ');
      document.getElementById('alwaysManual').checked = result.alwaysManual || false;
      document.getElementById('autoScanLinks').checked = result.autoScanLinks || false;
      // Default für timeOfClickProtection ist true
      document.getElementById('timeOfClickProtection').checked = result.timeOfClickProtection !== undefined ? result.timeOfClickProtection : true;
      // Zustimmung zur externen Analyse ist standardmäßig NICHT erteilt
      document.getElementById('externalAnalysisConsent').checked = result.externalAnalysisConsent === true;
      document.getElementById('ipReputationProvider').value = result.ipReputationProvider || "none";
      document.getElementById('ipReputationApiKey').value = result.ipReputationApiKey || "";

      // Administrator-Kontakte / Link-Gate / Report-Datenschutz (Plan 1.7, Abschnitt 6.4)
      document.getElementById('adminEmails').value = (result.adminEmails || []).join('; ');
      document.getElementById('adminPhone').value = result.adminPhone || "";
      document.getElementById('adminContactName').value = result.adminContactName || "";
      document.getElementById('adminOrganization').value = result.adminOrganization || "";
      // reportIncludeUrls default: true (Plan 6.4)
      document.getElementById('reportIncludeUrls').checked = result.reportIncludeUrls !== undefined ? result.reportIncludeUrls : true;
      document.getElementById('linkGateMode').value = result.linkGateMode || "strict";
      document.getElementById('linkGateEnabled').checked = result.linkGateEnabled !== undefined ? result.linkGateEnabled : true;
      updateAdminEmailsStatus();
      updateAdminPhoneStatus();

      const alwaysManualCheckbox = document.getElementById('alwaysManual');
      const privacyTierSelect = document.getElementById('privacyTier');

      function updatePrivacyTierStatus() {
          // The privacy tier now also governs the manual actions (popup upload /
          // URL scan), so it is never irrelevant - the tier stays selectable and
          // "strict" blocks those actions explicitly (see P0-2).
          privacyTierSelect.disabled = false;
          privacyTierSelect.title = alwaysManualCheckbox.checked
              ? 'Automatische Uploads sind gesperrt ("Immer manuell scannen"); die Stufe gilt weiterhin für manuelle Scans.'
              : '';
      }

      const autoScanLinksCheckbox = document.getElementById('autoScanLinks');
      const timeOfClickProtectionCheckbox = document.getElementById('timeOfClickProtection');

      function updateTimeOfClickProtectionStatus() {
          if (autoScanLinksCheckbox.checked) {
              timeOfClickProtectionCheckbox.disabled = true;
              timeOfClickProtectionCheckbox.title = 'Time-of-Click Protection ist irrelevant, wenn Auto-Scan aktiv ist';
          } else {
              timeOfClickProtectionCheckbox.disabled = false;
              timeOfClickProtectionCheckbox.title = '';
          }
      }

      // Initiale Setzung
      updatePrivacyTierStatus();
      updateTimeOfClickProtectionStatus();

      // Event Listener für Änderungen
      alwaysManualCheckbox.addEventListener('change', updatePrivacyTierStatus);
      autoScanLinksCheckbox.addEventListener('change', updateTimeOfClickProtectionStatus);
    });
  });
  
  document.getElementById('save').addEventListener('click', async function() {
    const apikeyInput = document.getElementById('apikey');
    if (!apikeyInput.reportValidity()) {
        return;
    }

    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    saveBtn.textContent = 'Wird gespeichert...';

    let mySetting = apikeyInput.value.trim().replace(/\r|\n/g, '');
    let urlhausSetting = document.getElementById('urlhausApikey').value.trim().replace(/\r|\n/g, '');
    let urlscanSetting = document.getElementById('urlscanApikey').value.trim().replace(/\r|\n/g, '');
    let virustotalSetting = document.getElementById('virustotalApikey').value.trim().replace(/\r|\n/g, '');
    let privacyTierSetting = document.getElementById('privacyTier').value;

    let whitelistStr = document.getElementById('customWhitelist').value;
    let whitelistSetting = [];
    for (let start = 0; start < whitelistStr.length; ) {
        let end = whitelistStr.indexOf(',', start);
        if (end === -1) end = whitelistStr.length;
        let item = whitelistStr.substring(start, end).trim().toLowerCase();
        if (item.length > 0) whitelistSetting.push(item);
        start = end + 1;
    }

    let blacklistStr = document.getElementById('customBlacklist').value;
    let blacklistSetting = [];
    for (let start = 0; start < blacklistStr.length; ) {
        let end = blacklistStr.indexOf(',', start);
        if (end === -1) end = blacklistStr.length;
        let item = blacklistStr.substring(start, end).trim().toLowerCase();
        if (item.length > 0) blacklistSetting.push(item);
        start = end + 1;
    }

    let alwaysManualSetting = document.getElementById('alwaysManual').checked;
    let autoScanLinksSetting = document.getElementById('autoScanLinks').checked;
    let timeOfClickProtectionSetting = document.getElementById('timeOfClickProtection').checked;
    let externalAnalysisConsentSetting = document.getElementById('externalAnalysisConsent').checked;
    let ipReputationProviderSetting = document.getElementById('ipReputationProvider').value;
    let ipReputationApiKeySetting = document.getElementById('ipReputationApiKey').value.trim().replace(/\r|\n/g, '');

    // Administrator-Kontakte validieren (ungültige Einträge werden gemeldet,
    // nicht stillschweigend verworfen) und Report-/Gate-Einstellungen lesen.
    const adminEmailsParsed = updateAdminEmailsStatus();
    const adminPhoneParsed = updateAdminPhoneStatus();
    const adminContactNameSetting = document.getElementById('adminContactName').value.trim();
    const adminOrganizationSetting = document.getElementById('adminOrganization').value.trim();
    const reportIncludeUrlsSetting = document.getElementById('reportIncludeUrls').checked;
    const linkGateModeSetting = document.getElementById('linkGateMode').value;
    const linkGateEnabledSetting = document.getElementById('linkGateEnabled').checked;

    browser.storage.local.set({
        apikey: mySetting,
        urlhausApikey: urlhausSetting,
        urlscanApikey: urlscanSetting,
        virustotalApikey: virustotalSetting,
        privacyTier: privacyTierSetting,
        customWhitelist: whitelistSetting,
        customBlacklist: blacklistSetting,
        alwaysManual: alwaysManualSetting,
        autoScanLinks: autoScanLinksSetting,
        timeOfClickProtection: timeOfClickProtectionSetting,
        externalAnalysisConsent: externalAnalysisConsentSetting,
        ipReputationProvider: ipReputationProviderSetting,
        ipReputationApiKey: ipReputationApiKeySetting,
        adminEmails: adminEmailsParsed.emails,
        adminPhone: adminPhoneParsed.phone,
        adminContactName: adminContactNameSetting,
        adminOrganization: adminOrganizationSetting,
        reportIncludeUrls: reportIncludeUrlsSetting,
        linkGateMode: linkGateModeSetting,
        linkGateEnabled: linkGateEnabledSetting
    }).then(async () => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Speichern';

        // Host-Berechtigungen nur für die tatsächlich konfigurierten Dienste
        // anfragen (Nutzer-Geste = Klick auf "Speichern").
        const requestedOrigins = [];
        if (mySetting) requestedOrigins.push(['hybrid-analysis.com', 'https://hybrid-analysis.com/*']);
        if (virustotalSetting || ipReputationProviderSetting === 'virustotal') requestedOrigins.push(['virustotal.com', 'https://www.virustotal.com/*']);
        if (urlscanSetting) requestedOrigins.push(['urlscan.io', 'https://urlscan.io/*']);
        if (urlhausSetting) requestedOrigins.push(['urlhaus.abuse.ch', 'https://urlhaus-api.abuse.ch/*']);
        if (ipReputationProviderSetting === 'abuseipdb') requestedOrigins.push(['abuseipdb.com', 'https://api.abuseipdb.com/*']);

        // Daten-Deklaration und Konsent: das Manifest deklariert die Übermittlung
        // als optional, deshalb wird die Zustimmung hier eingeholt (Thunderbird
        // zeigt keinen eigenen Prompt). Lehnt der Nutzer den Dialog ab, wird die
        // Checkbox zurückgesetzt - ohne Zustimmung wird nichts übertragen.
        if (externalAnalysisConsentSetting) {
            const consentGranted = await requestDataCollectionConsent();
            if (!consentGranted) {
                externalAnalysisConsentSetting = false;
                await browser.storage.local.set({ externalAnalysisConsent: false });
                const consentBox = document.getElementById('externalAnalysisConsent');
                if (consentBox) consentBox.checked = false;
                statusSpan.textContent = 'Zustimmung zur Datenübermittlung nicht erteilt – es wird nichts übertragen.';
            }
        } else {
            await removeDataCollectionConsent();
        }

        if (externalAnalysisConsentSetting && requestedOrigins.length > 0) {
            const denied = [];
            for (const [label, origin] of requestedOrigins) {
                try {
                    const granted = await browser.permissions.contains({ origins: [origin] }) ||
                        await browser.permissions.request({ origins: [origin] });
                    if (!granted) denied.push(label);
                } catch (e) {
                    console.error('Permission request failed', e);
                    denied.push(label);
                }
            }
            if (denied.length > 0) {
                alert('Host‑Berechtigung nicht erteilt für: ' + denied.join(', ') +
                    '. Ohne diese Berechtigung sind die entsprechenden Prüfungen deaktiviert.');
            }
        }

        if (statusSpan.id === 'status') {
            if (_saveTimeoutId) clearTimeout(_saveTimeoutId);
            _saveTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        } else {
            if (_clearTimeoutId) clearTimeout(_clearTimeoutId);
            _clearTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        }
    }).catch(error => {
        console.error("Speichern fehlgeschlagen", error);
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = 'Speichern';
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
    if (!confirm('Möchten Sie den Cache wirklich leeren? Dies entfernt alle lokal gespeicherten Analyse-Ergebnisse.')) {
        return;
    }
    const clearBtn = document.getElementById('clearCache');
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-busy', 'true');
    clearBtn.textContent = 'Wird geleert...';

    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.className = 'text-success ml-2';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = await clearStore(db, 'hybridanalysis');

        if (cleared) {
            statusSpan.textContent = 'Cache erfolgreich geleert.';
        } else {
            statusSpan.textContent = 'Datenbank existiert noch nicht oder ist bereits leer.';
        }
    } catch (error) {
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = 'Fehler beim Leeren des Caches.';
        console.error(error);
    } finally {
        clearBtn.disabled = false;
        clearBtn.removeAttribute('aria-busy');
        clearBtn.textContent = 'Cache leeren';
    }

    statusSpan.style.display = 'inline';
    if (statusSpan.id === 'status') {
            if (_saveTimeoutId) clearTimeout(_saveTimeoutId);
            _saveTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        } else {
            if (_clearTimeoutId) clearTimeout(_clearTimeoutId);
            _clearTimeoutId = setTimeout(() => {
                if (statusSpan.style) statusSpan.style.display = 'none';
            }, 3000);
        }
  });

// ---------------------------------------------------------------------------
// Administrator-Kontakt, Link-Gate und Report-Vorlagen (Plan 1.7, Workstream C)
//
// report.js stellt die reine Engine `ThundyReport` bereit (parseAdminEmails,
// parseAdminPhone, buildHelpRequest). Sie wird in options.html vor options.js
// geladen. Damit diese Seite auch dann funktioniert, wenn die Engine fehlt
// (z. B. alter Zwischenstand), werden alle Aufrufe feature-detected und durch
// minimale lokale Fallbacks abgesichert.
// ---------------------------------------------------------------------------

function getReportEngine() {
    return (typeof ThundyReport !== 'undefined' && ThundyReport) ? ThundyReport : null;
}

/**
 * Validiert Administrator-E-Mail-Adressen. Bevorzugt ThundyReport.parseAdminEmails
 * (Abschnitt 6.2), fällt sonst auf eine lokale Minimalprüfung zurück.
 * @returns {{emails: string[], invalid: string[]}}
 */
function parseAdminEmailsSafe(raw) {
    const engine = getReportEngine();
    if (engine && typeof engine.parseAdminEmails === 'function') {
        try {
            return engine.parseAdminEmails(raw);
        } catch (e) { /* fall through to local fallback */ }
    }
    const emails = [];
    const invalid = [];
    const parts = String(raw == null ? '' : raw).split(';');
    for (const part of parts) {
        const value = part.trim();
        if (value.length === 0) continue;
        const normalized = value.toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
            if (emails.indexOf(normalized) === -1) emails.push(normalized);
        } else {
            invalid.push(value);
        }
    }
    return { emails: emails, invalid: invalid };
}

/**
 * Validiert die Telefonnummer. Bevorzugt ThundyReport.parseAdminPhone.
 * @returns {{phone: string, valid: boolean}}
 */
function parseAdminPhoneSafe(raw) {
    const engine = getReportEngine();
    if (engine && typeof engine.parseAdminPhone === 'function') {
        try {
            return engine.parseAdminPhone(raw);
        } catch (e) { /* fall through to local fallback */ }
    }
    const value = String(raw == null ? '' : raw).trim();
    const valid = value.length === 0 || /^[+()0-9][0-9 ()\/-]{2,}$/.test(value);
    return { phone: value, valid: valid };
}

/**
 * Zeigt ungültige Administrator-E-Mail-Adressen in einem aria-live-Status an
 * (kein stilles Verwerfen). Gibt das Validierungsergebnis zurück.
 */
function updateAdminEmailsStatus() {
    const input = document.getElementById('adminEmails');
    const status = document.getElementById('adminEmailsStatus');
    const parsed = parseAdminEmailsSafe(input ? input.value : '');
    if (status) {
        if (parsed.invalid.length > 0) {
            status.textContent = 'Ungültige E-Mail-Adresse(n) – nicht gespeichert: ' + parsed.invalid.join('; ');
            status.className = 'text-danger ml-2';
        } else {
            status.textContent = '';
            status.className = 'text-success ml-2';
        }
    }
    return parsed;
}

/**
 * Zeigt eine ungültige Telefonnummer im aria-live-Status an.
 */
function updateAdminPhoneStatus() {
    const input = document.getElementById('adminPhone');
    const status = document.getElementById('adminPhoneStatus');
    const parsed = parseAdminPhoneSafe(input ? input.value : '');
    if (status) {
        if (!parsed.valid && parsed.phone.length > 0) {
            status.textContent = 'Telefonnummer nicht erkannt – bitte prüfen (z. B. +49 30 1234567).';
            status.className = 'text-danger ml-2';
        } else {
            status.textContent = '';
            status.className = 'text-success ml-2';
        }
    }
    return parsed;
}

/**
 * Liest die aktuellen Administrator-Kontaktdaten aus dem Formular.
 */
function collectAdminContacts() {
    const emailInput = document.getElementById('adminEmails');
    const phoneInput = document.getElementById('adminPhone');
    const nameInput = document.getElementById('adminContactName');
    const orgInput = document.getElementById('adminOrganization');
    return {
        emails: parseAdminEmailsSafe(emailInput ? emailInput.value : '').emails,
        phone: parseAdminPhoneSafe(phoneInput ? phoneInput.value : '').phone,
        name: nameInput ? nameInput.value.trim() : '',
        organization: orgInput ? orgInput.value.trim() : ''
    };
}

/**
 * Erzeugt aus den aktuellen Formularwerten eine Hilfe-Vorlage.
 * Primär über ThundyReport.buildHelpRequest (Abschnitt 6.2).
 * @returns {{to: string[]|string, subject: string, body: string}}
 */
function buildCurrentHelpTemplate() {
    const contacts = collectAdminContacts();
    const gateModeEl = document.getElementById('linkGateMode');
    const gateEnabledEl = document.getElementById('linkGateEnabled');
    const includeUrlsEl = document.getElementById('reportIncludeUrls');
    const input = {
        contacts: contacts,
        reporter: { email: '', name: '' },
        meta: {
            version: '1.7.0',
            generatedAt: new Date().toISOString(),
            linkGateMode: gateModeEl ? gateModeEl.value : 'strict',
            linkGateEnabled: gateEnabledEl ? gateEnabledEl.checked : true,
            reportIncludeUrls: includeUrlsEl ? includeUrlsEl.checked : true
        }
    };

    const engine = getReportEngine();
    if (engine && typeof engine.buildHelpRequest === 'function') {
        try {
            const template = engine.buildHelpRequest(input);
            if (template && typeof template === 'object') return template;
        } catch (e) { /* fall through to local fallback */ }
    }

    // Lokaler Fallback, falls report.js nicht geladen werden konnte.
    const toLine = contacts.emails.join('; ');
    const body = [
        'Hallo,',
        '',
        'ich benötige Unterstützung bei der Bewertung einer verdächtigen E-Mail.',
        '',
        'Kontaktdaten des Administrator-Kontakts:',
        '  E-Mail: ' + (toLine || '(nicht hinterlegt)'),
        '  Telefon: ' + (contacts.phone || '(nicht hinterlegt)'),
        '  Name: ' + (contacts.name || '(nicht hinterlegt)'),
        '  Organisation: ' + (contacts.organization || '(nicht hinterlegt)'),
        '',
        'Bitte prüfen Sie den Vorgang. Die Details liefere ich auf Anforderung nach.',
        '',
        'Hinweis: Diese Vorlage wurde lokal vom Add-on Thundy AV erzeugt; es wurden keine Daten übertragen.'
    ].join('\n');

    return {
        to: contacts.emails,
        subject: 'Thundy AV: Hilfeanforderung – verdächtige E-Mail',
        body: body
    };
}

/**
 * Formatiert eine Vorlage für das Vorschaufeld / die Zwischenablage.
 */
function formatTemplateText(template) {
    const to = Array.isArray(template.to) ? template.to.join('; ') : (template.to || '');
    return 'An: ' + to + '\nBetreff: ' + (template.subject || '') + '\n\n' + (template.body || '');
}

/**
 * Rendert die aktuelle Vorlage in das readonly-Vorschaufeld.
 * @returns {object} die erzeugte Vorlage
 */
function renderTemplatePreview() {
    const template = buildCurrentHelpTemplate();
    const preview = document.getElementById('reportPreview');
    if (preview) preview.value = formatTemplateText(template);
    return template;
}

function setTemplateStatus(message, className) {
    const status = document.getElementById('templateStatus');
    if (!status) return;
    status.textContent = message;
    status.className = className + ' ml-2';
    status.style.display = 'inline';
}

function templateHasRecipients(template) {
    if (Array.isArray(template.to)) return template.to.length > 0;
    return !!(template.to && String(template.to).trim().length > 0);
}

document.getElementById('requestHelpTemplate').addEventListener('click', async function() {
    const template = renderTemplatePreview();

    if (!templateHasRecipients(template)) {
        setTemplateStatus('Kein Administrator-Kontakt hinterlegt. Bitte oben eine gültige E-Mail-Adresse eintragen und speichern.', 'text-danger');
        return;
    }

    const composeAvailable = typeof browser !== 'undefined' && browser.compose &&
        typeof browser.compose.beginNew === 'function';

    if (composeAvailable) {
        try {
            await browser.compose.beginNew({
                to: template.to,
                subject: template.subject,
                body: template.body,
                isPlainText: true
            });
            setTemplateStatus('Compose-Fenster mit der Hilfe-Vorlage geöffnet.', 'text-success');
            return;
        } catch (e) {
            console.error('Compose-Fenster konnte nicht geöffnet werden', e);
        }
    }

    // Fallback: Vorlage steht im Vorschaufeld bereit und wird nach Möglichkeit
    // in die Zwischenablage kopiert.
    setTemplateStatus('Compose ist nicht verfügbar. Die Vorlage steht im Vorschaufeld – bitte den Text manuell kopieren.', 'text-warning');
    try {
        const preview = document.getElementById('reportPreview');
        if (typeof navigator !== 'undefined' && navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(preview ? preview.value : '');
        }
    } catch (e) { /* Clipboard kann blockiert sein - kein Absturz */ }
});

document.getElementById('previewTemplate').addEventListener('click', function() {
    const template = renderTemplatePreview();
    if (!templateHasRecipients(template)) {
        setTemplateStatus('Vorlage erzeugt – aber es ist kein Administrator-Kontakt hinterlegt.', 'text-warning');
    } else {
        setTemplateStatus('Vorlage erzeugt.', 'text-success');
    }
});

document.getElementById('copyTemplate').addEventListener('click', async function() {
    const preview = document.getElementById('reportPreview');
    let text = preview ? preview.value : '';
    if (!text) {
        text = formatTemplateText(buildCurrentHelpTemplate());
        if (preview) preview.value = text;
    }
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard &&
            typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
            setTemplateStatus('Vorlage in die Zwischenablage kopiert.', 'text-success');
        } else {
            setTemplateStatus('Zwischenablage nicht verfügbar. Bitte den Text manuell markieren und kopieren.', 'text-warning');
        }
    } catch (e) {
        setTemplateStatus('Kopieren fehlgeschlagen. Bitte den Text manuell markieren und kopieren.', 'text-danger');
    }
});

// Live-Validierung der Kontaktfelder (kein stilles Verwerfen ungültiger Werte).
document.getElementById('adminEmails').addEventListener('input', updateAdminEmailsStatus);
document.getElementById('adminPhone').addEventListener('input', updateAdminPhoneStatus);

