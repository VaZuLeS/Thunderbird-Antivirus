const VIEW_MODES = ['quiet', 'private', 'business', 'research', 'audit'];

// Event-Listener für das Laden der Seite
let _saveTimeoutId = null;
let _clearTimeoutId = null;
document.addEventListener('DOMContentLoaded', function() {
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey', 'viewMode', 'historyEnabled', 'historyLimit', 'webhookEnabled', 'webhookUrl', 'webhookSecret'
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
      document.getElementById('viewMode').value = VIEW_MODES.includes(result.viewMode) ? result.viewMode : 'private';
      document.getElementById('historyEnabled').checked = result.historyEnabled !== false;
      document.getElementById('historyLimit').value = result.historyLimit || 500;
      document.getElementById('webhookEnabled').checked = result.webhookEnabled === true;
      document.getElementById('webhookUrl').value = result.webhookUrl || '';
      document.getElementById('webhookSecret').value = result.webhookSecret || '';

      const alwaysManualCheckbox = document.getElementById('alwaysManual');
      const privacyTierSelect = document.getElementById('privacyTier');

      function updatePrivacyTierStatus() {
          if (alwaysManualCheckbox.checked) {
              privacyTierSelect.disabled = true;
              privacyTierSelect.title = 'Datenschutz-Stufe ist bei manuellem Scan irrelevant';
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
    let viewModeSetting = document.getElementById('viewMode').value;
    let historyEnabledSetting = document.getElementById('historyEnabled').checked;
    let historyLimitSetting = parseInt(document.getElementById('historyLimit').value, 10) || 500;
    let webhookEnabledSetting = document.getElementById('webhookEnabled').checked;
    let webhookUrlSetting = document.getElementById('webhookUrl').value.trim();
    let webhookSecretSetting = document.getElementById('webhookSecret').value.trim();
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
        viewMode: viewModeSetting,
        historyEnabled: historyEnabledSetting,
        historyLimit: historyLimitSetting,
        webhookEnabled: webhookEnabledSetting,
        webhookUrl: webhookUrlSetting,
        webhookSecret: webhookSecretSetting
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

// ---------------------------------------------------------------------------
// Verlauf: Anzeige, Filter, Export und Loeschen (alles lokal)
// ---------------------------------------------------------------------------
function formatHistoryTimestamp(entry) {
    if (!entry || !entry.timestamp) return '-';
    const date = new Date(entry.timestamp);
    return isNaN(date.getTime()) ? entry.timestamp : date.toLocaleString();
}

function describeHistoryLine(entry) {
    const target = entry.transmitted ? 'uebertragen an ' + (entry.provider || 'Anbieter') : 'nur lokal';
    const subject = entry.attachmentName || entry.domain || entry.ip || entry.subject || '(Nachricht)';
    const parts = [formatHistoryTimestamp(entry), entry.action, target, subject];
    if (entry.sha256) parts.push('sha256=' + entry.sha256);
    if (entry.jobId) parts.push('job=' + entry.jobId);
    if (entry.verdict) parts.push('verdict=' + entry.verdict);
    if (entry.detail) parts.push(entry.detail);
    return parts.join(' | ');
}

function buildHistoryCsv(entries) {
    const columns = ['timestamp', 'action', 'transmitted', 'provider', 'dataType', 'timing',
        'subject', 'sender', 'attachmentName', 'sha256', 'verdict', 'outcome', 'detail'];
    const delimiter = ';';
    const escape = (value) => {
        if (value === undefined || value === null) return '';
        const text = String(value).split('"').join('""');
        return text.indexOf(delimiter) !== -1 || text.indexOf('"') !== -1 || text.indexOf('\n') !== -1
            ? '"' + text + '"'
            : text;
    };
    const lines = [columns.join(delimiter)];
    for (const entry of entries || []) {
        lines.push(columns.map(column => escape(entry[column])).join(delimiter));
    }
    return lines.join('\n');
}

function buildHistoryJson(entries) {
    return JSON.stringify(entries || [], null, 2);
}

function downloadHistoryFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

let lastHistoryEntries = [];

async function loadHistory() {
    const list = document.getElementById('historyList');
    const summary = document.getElementById('historySummary');
    if (!list) return;
    const filterElement = document.getElementById('historyFilter');
    const onlyTransmissions = !!(filterElement && filterElement.value === 'transmissions');

    let response;
    try {
        const searchField = document.getElementById('historySearch');
        const fromField = document.getElementById('historyFrom');
        const toField = document.getElementById('historyTo');
        response = await browser.runtime.sendMessage({
            action: 'getHistory',
            onlyTransmissions: onlyTransmissions,
            search: searchField && searchField.value ? searchField.value : undefined,
            from: fromField && fromField.value ? fromField.value : undefined,
            to: toField && toField.value ? toField.value + 'T23:59:59' : undefined
        });
    } catch (error) {
        if (summary) summary.textContent = 'Verlauf konnte nicht geladen werden.';
        return;
    }
    if (!response || response.status !== 'success') {
        if (summary) summary.textContent = 'Verlauf konnte nicht geladen werden.';
        return;
    }

    lastHistoryEntries = response.entries || [];
    list.textContent = '';
    for (const entry of lastHistoryEntries.slice().reverse()) {
        const item = document.createElement('li');
        item.textContent = describeHistoryLine(entry);
        list.appendChild(item);
    }
    if (summary) {
        const stats = response.summary || {};
        summary.textContent = lastHistoryEntries.length + ' Eintrag/Eintraege angezeigt - ' +
            (stats.transmissions || 0) + ' Uebertragung(en), ' + (stats.local || 0) + ' rein lokal' +
            (stats.lastTransmissionAt ? ', letzte Uebertragung: ' + new Date(stats.lastTransmissionAt).toLocaleString() : '');
    }
}

// ---------------------------------------------------------------------------
// Statistik und Diagnose (rein lokal, keine Übertragung)
// ---------------------------------------------------------------------------
function renderStatistics(container, statistics, managedInfo) {
    if (!container) return;
    container.textContent = '';

    const headline = document.createElement('p');
    headline.textContent = 'Zeitraum ' + statistics.windowDays + ' Tag(e): ' + statistics.recent + ' von ' +
        statistics.total + ' Einträgen';
    container.appendChild(headline);

    const summaryList = document.createElement('ul');
    const lines = [
        'Übertragungen an Anbieter: ' + statistics.transmissions,
        'Rein lokale Prüfungen: ' + statistics.localOnly
    ];
    for (const [provider, count] of Object.entries(statistics.byProvider || {})) {
        lines.push('davon ' + provider + ': ' + count);
    }
    for (const [action, count] of Object.entries(statistics.byAction || {})) {
        lines.push('Aktion ' + action + ': ' + count);
    }
    if (managedInfo && managedInfo.managed) {
        lines.push('Verwaltete Vorgaben aktiv: ' + (managedInfo.managedKeys || []).join(', '));
    }
    for (const line of lines) {
        const item = document.createElement('li');
        item.textContent = line;
        summaryList.appendChild(item);
    }
    container.appendChild(summaryList);

    const days = Object.entries(statistics.byDay || {}).sort();
    if (days.length > 0) {
        const dayList = document.createElement('small');
        dayList.textContent = 'Pro Tag: ' + days.map(([day, count]) => day + ': ' + count).join(' · ');
        container.appendChild(dayList);
    }
}

function renderDiagnostics(container, report) {
    if (!container) return;
    container.textContent = '';

    const headline = document.createElement('p');
    headline.textContent = 'Ergebnis: ' + report.summary.ok + ' ok, ' + report.summary.warn + ' Hinweis(e), ' +
        report.summary.fail + ' Fehler - Stand ' + new Date(report.generatedAt).toLocaleString();
    container.appendChild(headline);

    const list = document.createElement('ul');
    for (const check of report.checks) {
        const item = document.createElement('li');
        const icon = check.status === 'ok' ? '✅' : (check.status === 'warn' ? '⚠️' : '❌');
        item.textContent = icon + ' ' + check.label + ': ' + check.detail;
        list.appendChild(item);
    }
    container.appendChild(list);
}

// ---------------------------------------------------------------------------
// Eigene Regeln (lokale IOC-Listen): prüfen, anwenden, exportieren, importieren
// ---------------------------------------------------------------------------
function renderRulesStatus(message, isError) {
    const status = document.getElementById('rulesStatus');
    if (!status) return;
    status.textContent = message;
    status.className = isError ? 'text-danger' : 'text-success';
}

async function loadRulesIntoEditor() {
    const field = document.getElementById('rulesJson');
    if (!field) return;
    try {
        const response = await browser.runtime.sendMessage({ action: 'getRuleProfile' });
        if (response && response.status === 'success') {
            field.value = JSON.stringify(response.rules || [], null, 2);
        }
    } catch (error) {
        console.error('Regeln konnten nicht geladen werden:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const validateButton = document.getElementById('rulesValidate');
    if (validateButton) {
        validateButton.addEventListener('click', async function() {
            const field = document.getElementById('rulesJson');
            let rules;
            try {
                rules = JSON.parse(field.value || '[]');
            } catch (error) {
                renderRulesStatus('JSON ungültig: ' + error.message, true);
                return;
            }
            const profile = JSON.stringify({
                schema: 'thundy-av-rules/1',
                rules,
                whitelist: Array.from(contextWhitelist()),
                blacklist: Array.from(contextBlacklist())
            });
            const response = await browser.runtime.sendMessage({ action: 'importRuleProfile', profile, replaceLists: false });
            if (response && response.status === 'success') {
                renderRulesStatus('Übernommen: ' + response.rules.length + ' Regel(n).', false);
            } else {
                renderRulesStatus('Fehler: ' + ((response && response.errors) || ['unbekannt']).join(' | '), true);
            }
        });
    }

    const exportButton = document.getElementById('rulesExport');
    if (exportButton) {
        exportButton.addEventListener('click', async function() {
            const response = await browser.runtime.sendMessage({ action: 'getRuleProfile' });
            if (response && response.status === 'success') {
                downloadHistoryFile('thundy-av-regelprofil.json', response.profile, 'application/json');
                renderRulesStatus('Profil exportiert.', false);
            }
        });
    }

    const importFileButton = document.getElementById('rulesImportFile');
    const importInput = document.getElementById('rulesImportInput');
    if (importFileButton && importInput) {
        importFileButton.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async function() {
            const file = importInput.files && importInput.files[0];
            if (!file) return;
            const text = await file.text();
            const response = await browser.runtime.sendMessage({ action: 'importRuleProfile', profile: text });
            if (response && response.status === 'success') {
                renderRulesStatus('Importiert: ' + response.rules.length + ' Regel(n), ' +
                    response.whitelistSize + ' Whitelist-/ ' + response.blacklistSize + ' Blacklist-Einträge.', false);
                await loadRulesIntoEditor();
            } else {
                renderRulesStatus('Import fehlgeschlagen: ' + ((response && response.errors) || ['unbekannt']).join(' | '), true);
            }
        });
    }

    const webhookTest = document.getElementById('webhookTest');
    if (webhookTest) {
        webhookTest.addEventListener('click', async function() {
            const status = document.getElementById('webhookStatus');
            status.textContent = ' Sende Testdatensatz...';
            try {
                const response = await browser.runtime.sendMessage({ action: 'testWebhook' });
                status.textContent = response && response.status === 'success'
                    ? ' Erfolgreich gesendet (HTTP ' + response.httpStatus + ').'
                    : ' Fehlgeschlagen: ' + ((response && response.message) || 'unbekannt');
            } catch (error) {
                status.textContent = ' Fehlgeschlagen: ' + error.message;
            }
        });
    }

    const searchFieldElement = document.getElementById('historySearch');
    if (searchFieldElement) {
        let searchTimer = null;
        searchFieldElement.addEventListener('input', function() {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(loadHistory, 300);
        });
    }
    ['historyFrom', 'historyTo'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.addEventListener('change', loadHistory);
    });

    loadRulesIntoEditor();
});

function contextWhitelist() {
    const field = document.getElementById('customWhitelist');
    return field && field.value ? field.value.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) : [];
}

function contextBlacklist() {
    const field = document.getElementById('customBlacklist');
    return field && field.value ? field.value.split(',').map(value => value.trim().toLowerCase()).filter(Boolean) : [];
}

// Statistik und Diagnose (Listener)
document.addEventListener('DOMContentLoaded', function() {
    const statisticsButton = document.getElementById('statisticsRefresh');
    if (statisticsButton) {
        statisticsButton.addEventListener('click', async function() {
            const panel = document.getElementById('statisticsPanel');
            const days = parseInt(document.getElementById('statisticsDays').value, 10) || 7;
            try {
                const response = await browser.runtime.sendMessage({ action: 'getStatistics', days });
                if (response && response.status === 'success') {
                    renderStatistics(panel, response.statistics, { managed: response.managed, managedKeys: response.managedKeys });
                } else {
                    panel.textContent = 'Statistik konnte nicht geladen werden.';
                }
            } catch (error) {
                console.error('Statistik fehlgeschlagen:', error);
                panel.textContent = 'Statistik konnte nicht geladen werden.';
            }
        });
    }

    const diagnosticsButton = document.getElementById('diagnosticsRun');
    if (diagnosticsButton) {
        diagnosticsButton.addEventListener('click', async function() {
            const panel = document.getElementById('diagnosticsPanel');
            try {
                const response = await browser.runtime.sendMessage({ action: 'getDiagnostics' });
                if (response && response.status === 'success') {
                    renderDiagnostics(panel, response.report);
                } else {
                    panel.textContent = 'Diagnose konnte nicht ausgeführt werden.';
                }
            } catch (error) {
                console.error('Diagnose fehlgeschlagen:', error);
                panel.textContent = 'Diagnose konnte nicht ausgeführt werden.';
            }
        });
    }
});

// Verlaufs-Listener (eigener DOMContentLoaded-Block)
document.addEventListener('DOMContentLoaded', function() {
    const refresh = document.getElementById('historyRefresh');
    if (refresh) refresh.addEventListener('click', loadHistory);

    const filter = document.getElementById('historyFilter');
    if (filter) filter.addEventListener('change', loadHistory);

    const csvButton = document.getElementById('historyExportCsv');
    if (csvButton) csvButton.addEventListener('click', function() {
        downloadHistoryFile('thundy-av-verlauf.csv', buildHistoryCsv(lastHistoryEntries), 'text/csv;charset=utf-8');
    });

    const jsonButton = document.getElementById('historyExportJson');
    if (jsonButton) jsonButton.addEventListener('click', function() {
        downloadHistoryFile('thundy-av-verlauf.json', buildHistoryJson(lastHistoryEntries), 'application/json');
    });

    const clearButton = document.getElementById('historyClear');
    if (clearButton) clearButton.addEventListener('click', async function() {
        if (!confirm('Verlauf wirklich loeschen? Alle lokal gespeicherten Eintraege werden entfernt.')) return;
        try {
            await browser.runtime.sendMessage({ action: 'clearHistory' });
            await loadHistory();
        } catch (error) {
            console.error('Verlauf konnte nicht geleert werden:', error);
        }
    });

    loadHistory();
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