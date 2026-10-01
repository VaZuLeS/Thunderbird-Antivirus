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
  // ---------------------------------------------------------------------------
  // Selbsttest / Diagnose
  // ---------------------------------------------------------------------------
  const selfTestButton = document.getElementById('runSelfTest');
  const selfTestReport = document.getElementById('selfTestReport');
  const selfTestStatus = document.getElementById('selfTestStatus');
  const copySelfTestButton = document.getElementById('copySelfTestReport');
  const saveSelfTestButton = document.getElementById('saveSelfTestReport');
  let lastSelfTestReport = null;

  function selfTestBadge(status) {
    const badge = document.createElement('span');
    badge.className = 'thundy-badge thundy-badge--' +
      (status === 'pass' ? 'low' : (status === 'warn' ? 'medium' : 'critical'));
    badge.textContent = status === 'pass' ? 'PASS' : (status === 'warn' ? 'HINWEIS' : 'FEHLER');
    return badge;
  }

  function selfTestReportAsText(report) {
    const lines = ['Thundy AV Selbsttest-Bericht (' + report.startedAt + ')'];
    lines.push('Ergebnis: ' + String(report.summary.verdict).toUpperCase() +
      ' (' + report.summary.pass + ' bestanden / ' + report.summary.fail + ' Fehler / ' +
      report.summary.warn + ' Hinweise)');
    lines.push('');
    for (const check of report.checks) {
      lines.push('[' + String(check.status).toUpperCase() + '] ' + check.id + ' – ' + check.title +
        (check.detail ? ' :: ' + check.detail : ''));
    }
    lines.push('');
    lines.push(report.note);
    return lines.join('\n');
  }

  function renderSelfTestReport(report) {
    if (!selfTestReport) return;
    selfTestReport.textContent = '';

    const summary = document.createElement('div');
    summary.className = 'thundy-chip-row';
    const verdictBadge = document.createElement('span');
    const verdictSeverity = report.summary.verdict === 'ok' ? 'low'
      : (report.summary.verdict === 'attention' ? 'medium' : 'critical');
    verdictBadge.className = 'thundy-badge thundy-badge--' + verdictSeverity;
    verdictBadge.textContent = 'Ergebnis: ' + String(report.summary.verdict).toUpperCase();
    summary.appendChild(verdictBadge);
    summary.appendChild(document.createTextNode(' ' + report.summary.pass + ' bestanden, ' +
      report.summary.fail + ' Fehler, ' + report.summary.warn + ' Hinweise'));
    selfTestReport.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'thundy-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['Status', 'Prüfung', 'Detail']) {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const check of report.checks) {
      const row = document.createElement('tr');
      const statusCell = document.createElement('td');
      statusCell.appendChild(selfTestBadge(check.status));
      row.appendChild(statusCell);
      const titleCell = document.createElement('td');
      titleCell.textContent = check.title;
      const code = document.createElement('code');
      code.className = 'thundy-mono';
      code.textContent = check.id;
      titleCell.appendChild(document.createTextNode(' '));
      titleCell.appendChild(code);
      row.appendChild(titleCell);
      const detailCell = document.createElement('td');
      detailCell.textContent = check.detail || '';
      row.appendChild(detailCell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    selfTestReport.appendChild(table);

    const note = document.createElement('p');
    note.className = 'thundy-note thundy-note--info';
    note.textContent = report.note;
    selfTestReport.appendChild(note);
  }


  // ---------------------------------------------------------------------------
  // Selbsttest / Diagnose (Fortsetzung: Ausführung und Export)
  // ---------------------------------------------------------------------------
  async function runSelfTestFromOptions() {
    if (!selfTestButton) return;
    selfTestButton.disabled = true;
    selfTestButton.setAttribute('aria-busy', 'true');
    const previousLabel = selfTestButton.textContent;
    selfTestButton.textContent = 'Selbsttest läuft …';
    if (selfTestStatus) selfTestStatus.classList.remove('thundy-hidden');
    try {
      const response = await browser.runtime.sendMessage({ action: 'runSelfTest' });
      if (!response || response.status !== 'success') {
        throw new Error(response && response.message ? response.message : 'Selbsttest fehlgeschlagen');
      }
      lastSelfTestReport = response.data;
      renderSelfTestReport(lastSelfTestReport);
      if (copySelfTestButton) copySelfTestButton.disabled = false;
      if (saveSelfTestButton) saveSelfTestButton.disabled = false;
      if (selfTestStatus) {
        selfTestStatus.textContent = 'Selbsttest abgeschlossen (' + lastSelfTestReport.checks.length + ' Prüfungen).';
      }
    } catch (error) {
      if (selfTestStatus) selfTestStatus.textContent = 'Selbsttest fehlgeschlagen: ' + error.message;
    } finally {
      selfTestButton.disabled = false;
      selfTestButton.removeAttribute('aria-busy');
      selfTestButton.textContent = previousLabel;
    }
  }

  if (selfTestButton) {
    selfTestButton.addEventListener('click', runSelfTestFromOptions);
  }

  if (copySelfTestButton) {
    copySelfTestButton.addEventListener('click', async () => {
      if (!lastSelfTestReport) return;
      const text = selfTestReportAsText(lastSelfTestReport);
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          copied = true;
        }
      } catch (error) {
        copied = false;
      }
      if (selfTestStatus) selfTestStatus.textContent = copied ? 'Bericht kopiert.' : 'Kopieren nicht möglich.';
    });
  }

  if (saveSelfTestButton) {
    saveSelfTestButton.addEventListener('click', async () => {
      saveSelfTestButton.disabled = true;
      try {
        const response = await browser.runtime.sendMessage({ action: 'saveSelfTestReport' });
        if (!response || response.status !== 'success') {
          throw new Error(response && response.message ? response.message : 'Speichern fehlgeschlagen');
        }
        if (selfTestStatus) selfTestStatus.textContent = 'Bericht gespeichert: ' + response.data.filename;
      } catch (error) {
        if (selfTestStatus) selfTestStatus.textContent = 'Speichern fehlgeschlagen: ' + error.message;
      } finally {
        saveSelfTestButton.disabled = false;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Verlauf & Pivot (lokaler Indikator-Index)
  // ---------------------------------------------------------------------------
  const historyButton = document.getElementById('runHistorySearch');
  const historyResults = document.getElementById('historyResults');
  const historyStatus = document.getElementById('historyStatus');

  function renderHistoryResults(result) {
    if (!historyResults) return;
    historyResults.textContent = '';
    if (!result.messages || result.messages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'thundy-empty';
      empty.textContent = result.totalIndicators === 0
        ? 'Der lokale Index ist noch leer – er füllt sich, während Nachrichten gescannt werden.'
        : 'Keine Treffer für diese Suche.';
      historyResults.appendChild(empty);
      return;
    }
    const caption = document.createElement('p');
    caption.className = 'thundy-note thundy-note--info';
    caption.textContent = result.messages.length + ' Nachricht(en) von ' + result.totalMessages +
      ' Treffern (Index: ' + result.totalIndicators + ' Indikatoren, lokal)';
    historyResults.appendChild(caption);

    const table = document.createElement('table');
    table.className = 'thundy-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['Betreff', 'Datum', 'Verdikt', 'Indikatoren', 'Öffnen']) {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (const message of result.messages) {
      const row = document.createElement('tr');
      const subjectCell = document.createElement('td');
      subjectCell.textContent = message.subject || '(ohne Betreff)';
      row.appendChild(subjectCell);
      const dateCell = document.createElement('td');
      dateCell.textContent = message.date ? new Date(message.date).toLocaleString('de-DE') : '–';
      row.appendChild(dateCell);
      const verdictCell = document.createElement('td');
      const severity = message.verdict === 'malicious' ? 'critical'
        : (message.verdict === 'suspicious' ? 'high' : (message.verdict === 'unclear' ? 'medium' : 'low'));
      const badge = document.createElement('span');
      badge.className = 'thundy-badge thundy-badge--' + severity;
      badge.textContent = (message.verdict || 'unbekannt') + ' (' + (message.score || 0) + ')';
      verdictCell.appendChild(badge);
      row.appendChild(verdictCell);
      const indicatorCell = document.createElement('td');
      indicatorCell.className = 'thundy-mono';
      indicatorCell.textContent = (message.indicators || []).join(', ');
      row.appendChild(indicatorCell);
      const actionCell = document.createElement('td');
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'thundy-copy';
      openButton.textContent = 'Öffnen';
      openButton.addEventListener('click', async () => {
        try {
          if (browser.messageDisplay && typeof browser.messageDisplay.open === 'function' && message.messageHeader) {
            await browser.messageDisplay.open({ headerMessageId: message.messageHeader });
          }
        } catch (error) {
          openButton.textContent = 'Nicht möglich';
        }
      });
      actionCell.appendChild(openButton);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    historyResults.appendChild(table);
  }

  async function runHistorySearch() {
    if (!historyButton) return;
    const query = document.getElementById('historyQuery') ? document.getElementById('historyQuery').value : '';
    const kind = document.getElementById('historyKind') ? document.getElementById('historyKind').value : 'any';
    const verdict = document.getElementById('historyVerdict') ? document.getElementById('historyVerdict').value : 'any';
    historyButton.disabled = true;
    if (historyStatus) {
      historyStatus.classList.remove('thundy-hidden');
      historyStatus.textContent = 'Suche läuft …';
    }
    try {
      const response = await browser.runtime.sendMessage({ action: 'searchHistory', query: query, kind: kind, verdict: verdict });
      if (!response || response.status !== 'success') {
        throw new Error(response && response.message ? response.message : 'Suche fehlgeschlagen');
      }
      renderHistoryResults(response.data);
      if (historyStatus) historyStatus.textContent = response.data.totalMessages + ' Nachricht(en) gefunden.';
    } catch (error) {
      if (historyStatus) historyStatus.textContent = 'Suche fehlgeschlagen: ' + error.message;
    } finally {
      historyButton.disabled = false;
    }
  }

  if (historyButton) {
    historyButton.addEventListener('click', runHistorySearch);
  }
  const historyQueryField = document.getElementById('historyQuery');
  if (historyQueryField) {
    historyQueryField.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runHistorySearch();
      }
    });
  }

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
        const db = await openDB('thunderbird_av', 4);
        const cleared = await clearStore(db, 'hybridanalysis');
        // Der lokale Indikator-Index (Pivot/Verlauf) enthält Nachrichtenbezug und
        // wird beim Leeren des Caches mit entfernt.
        const indexCleared = await clearStore(db, 'iocs');

        if (cleared || indexCleared) {
            statusSpan.textContent = 'Cache und lokaler Indikator-Index erfolgreich geleert.';
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