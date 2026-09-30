// UI localization for the options page. Self-contained (the page also loads
// db.js, but the helper must work in every environment, including tests).
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

/**
 * Asks for the optional data collection category "personalCommunications"
 * where the environment offers the built-in data consent experience
 * (Firefox/Thunderbird 140+). Returns true when the environment has no such API
 * (then the add-on's own consent checkbox is authoritative) or when the
 * category has been granted.
 */
async function requestDataCollectionConsent() {
    try {
        if (!browser.permissions || typeof browser.permissions.getAll !== 'function') return true;
        const granted = await browser.permissions.getAll();
        if (!granted || !Array.isArray(granted.data_collection)) return true;
        if (granted.data_collection.includes('personalCommunications')) return true;
        if (typeof browser.permissions.request !== 'function') return true;
        return (await browser.permissions.request({ data_collection: ['personalCommunications'] })) === true;
    } catch (e) {
        console.error('Data collection consent request failed', e);
        return true;
    }
}

/**
 * Shows a short self-check so users and reviewers can see whether the
 * in-message UI is registered and how the consent/keys are set. Nothing is
 * transmitted anywhere for this.
 */
async function renderDiagnostics() {
    const output = document.getElementById('diagnosticsOutput');
    if (!output) return;
    const lines = [];

    try {
        const api = browser.scripting && browser.scripting.messageDisplay;
        const registered = api && typeof api.getRegisteredScripts === 'function' ? await api.getRegisteredScripts() : null;
        if (Array.isArray(registered)) {
            const active = registered.some((script) => script && script.id === 'thundy-ui');
            lines.push(active
                ? uiText('optionsDiagUiActive', 'UI in der Nachrichtenansicht: registriert')
                : uiText('optionsDiagUiInactive', 'UI in der Nachrichtenansicht: NICHT registriert – das Add-on bitte neu laden'));
        } else {
            lines.push(uiText('optionsDiagUiUnknown', 'UI in der Nachrichtenansicht: konnte nicht geprüft werden'));
        }
    } catch (e) {
        lines.push(uiText('optionsDiagUiUnknown', 'UI in der Nachrichtenansicht: konnte nicht geprüft werden'));
    }

    try {
        const stored = await browser.storage.local.get([
            'externalAnalysisConsent', 'apikey', 'virustotalApikey', 'urlscanApikey', 'urlhausApikey',
            'ipReputationProvider', 'ipReputationApiKey', 'privacyTier'
        ]);
        lines.push(stored && stored.externalAnalysisConsent === true
            ? uiText('optionsDiagConsentOn', 'Externe Analyse: erlaubt')
            : uiText('optionsDiagConsentOff', 'Externe Analyse: nicht erlaubt (es wird nichts übertragen)'));
        const keyCount = ['apikey', 'virustotalApikey', 'urlscanApikey', 'urlhausApikey', 'ipReputationApiKey']
            .filter((name) => stored && typeof stored[name] === 'string' && stored[name].length > 0).length;
        lines.push(uiText('optionsDiagKeys', 'Hinterlegte API-Schlüssel: $1', [String(keyCount)]));
        lines.push(uiText('optionsDiagTier', 'Datenschutz-Stufe: $1', [String((stored && stored.privacyTier) || 'strict')]));
    } catch (e) {
        lines.push(uiText('optionsDiagStorageUnknown', 'Einstellungen: konnten nicht gelesen werden'));
    }

    output.textContent = '';
    for (const line of lines) {
        const item = document.createElement('li');
        item.textContent = line;
        output.appendChild(item);
    }
}

// Event-Listener für das Laden der Seite
let _saveTimeoutId = null;
let _clearTimeoutId = null;
document.addEventListener('DOMContentLoaded', function() {
    // Self-check for the in-message UI and the current consent/keys.
    renderDiagnostics().catch((error) => console.error('Diagnostics failed', error));

    // Localize the static markup (see options.html and _locales/).
    try {
        if (typeof applyUiTranslations === 'function') applyUiTranslations();
        document.title = uiText('optionsTitle', 'Thundy AV Einstellungen');
    } catch (e) { /* ignore */ }

    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey'
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

      const alwaysManualCheckbox = document.getElementById('alwaysManual');
      const privacyTierSelect = document.getElementById('privacyTier');

      function updatePrivacyTierStatus() {
          if (alwaysManualCheckbox.checked) {
              privacyTierSelect.disabled = true;
              privacyTierSelect.title = uiText('optionsPrivacyTierIrrelevant', 'Datenschutz-Stufe ist bei manuellem Scan irrelevant');
          } else {
              privacyTierSelect.disabled = false;
              privacyTierSelect.title = '';
          }
      }

      const autoScanLinksCheckbox = document.getElementById('autoScanLinks');
      const timeOfClickProtectionCheckbox = document.getElementById('timeOfClickProtection');

      function updateTimeOfClickProtectionStatus() {
          if (autoScanLinksCheckbox.checked) {
              timeOfClickProtectionCheckbox.disabled = true;
              timeOfClickProtectionCheckbox.title = uiText('optionsTocIrrelevant', 'Time-of-Click Protection ist irrelevant, wenn Auto-Scan aktiv ist');
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
    saveBtn.textContent = uiText('optionsSaving', 'Wird gespeichert...');

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
        ipReputationApiKey: ipReputationApiKeySetting
    }).then(async () => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = uiText('optionsSave', 'Speichern');

        // Datenkonsent: wo die Umgebung die eingebaute Kategorie-Zustimmung
        // anbietet, wird sie zusätzlich angefragt (Nutzer-Geste = "Speichern").
        // Die eigene Checkbox bleibt der Fallback für ältere Versionen.
        if (externalAnalysisConsentSetting) {
            const dataCollectionGranted = await requestDataCollectionConsent();
            if (!dataCollectionGranted) {
                alert(uiText('optionsDataConsentDenied', 'Ohne die Zustimmung zur Datenkategorie „persönliche Kommunikation“ überträgt die Erweiterung keine Daten. Die externe Analyse bleibt deaktiviert.'));
                document.getElementById('externalAnalysisConsent').checked = false;
                await browser.storage.local.set({ externalAnalysisConsent: false });
            }
        }

        // Host-Berechtigungen nur für die tatsächlich konfigurierten Dienste
        // anfragen (Nutzer-Geste = Klick auf "Speichern").
        const requestedOrigins = [];
        if (mySetting) requestedOrigins.push(['hybrid-analysis.com', 'https://hybrid-analysis.com/*']);
        if (virustotalSetting || ipReputationProviderSetting === 'virustotal') requestedOrigins.push(['virustotal.com', 'https://www.virustotal.com/*']);
        if (urlscanSetting) requestedOrigins.push(['urlscan.io', 'https://urlscan.io/*']);
        if (urlhausSetting) requestedOrigins.push(['urlhaus.abuse.ch', 'https://urlhaus-api.abuse.ch/*']);
        if (ipReputationProviderSetting === 'abuseipdb') requestedOrigins.push(['abuseipdb.com', 'https://api.abuseipdb.com/*']);

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
                alert(uiText('optionsPermissionDenied', 'Host-Berechtigung nicht erteilt für: $1. Ohne diese Berechtigung sind die entsprechenden Prüfungen deaktiviert.', [denied.join(', ')]));
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
        saveBtn.textContent = uiText('optionsSave', 'Speichern');
    });
  });

  document.getElementById('clearCache').addEventListener('click', async function() {
    if (!confirm(uiText('optionsCacheClearConfirm', 'Möchten Sie den Cache wirklich leeren? Dies entfernt alle lokal gespeicherten Analyse-Ergebnisse.'))) {
        return;
    }
    const clearBtn = document.getElementById('clearCache');
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-busy', 'true');
    clearBtn.textContent = uiText('optionsClearing', 'Wird geleert...');

    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.className = 'text-success ml-2';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = await clearStore(db, 'hybridanalysis');

        if (cleared) {
            statusSpan.textContent = uiText('optionsCacheCleared', 'Cache erfolgreich geleert.');
        } else {
            statusSpan.textContent = uiText('optionsCacheEmpty', 'Datenbank existiert noch nicht oder ist bereits leer.');
        }
    } catch (error) {
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = uiText('optionsCacheClearFailed', 'Fehler beim Leeren des Caches.');
        console.error(error);
    } finally {
        clearBtn.disabled = false;
        clearBtn.removeAttribute('aria-busy');
        clearBtn.textContent = uiText('optionsClearCache', 'Cache leeren');
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