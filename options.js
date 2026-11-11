// Portable appearance profiles contain appearance only, never permissions,
// consent, provider keys, sender rules or historical decisions.
const LocalSettingsProfile = (() => {
    const keys = ['thundyAppearance', 'thundyAccent', 'thundyDensity'];
    const fields = { mode: ['system', 'light', 'dark'], accent: ['ocean', 'violet', 'forest', 'amber'], density: ['comfortable', 'compact'] };
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    function parse(input) {
        if (typeof input === 'string') { if (input.length > 8192) throw new Error('PROFILE_INVALID'); input = JSON.parse(input); }
        if (!object(input) || Object.keys(input).sort().join(',') !== 'appearance,kind,schemaVersion' || input.schemaVersion !== 1 || input.kind !== 'thundy-local-settings' || !object(input.appearance) || Object.keys(input.appearance).sort().join(',') !== 'accent,density,mode') throw new Error('PROFILE_INVALID');
        for (const [key, values] of Object.entries(fields)) if (!values.includes(input.appearance[key])) throw new Error('PROFILE_INVALID');
        return { schemaVersion: 1, kind: 'thundy-local-settings', appearance: { mode: input.appearance.mode, accent: input.appearance.accent, density: input.appearance.density } };
    }
    function create(settings) {
        const appearance = {};
        Object.keys(fields).forEach((field, index) => { const value = settings[keys[index]]; appearance[field] = fields[field].includes(value) ? value : fields[field][0]; });
        return parse({ schemaVersion: 1, kind: 'thundy-local-settings', appearance });
    }
    async function prepare(input, storage) { return { profile: parse(input), before: create(await storage.get(keys)) }; }
    async function commit(proposal, storage) {
        const profile = parse(proposal.profile), before = parse(proposal.before);
        if (JSON.stringify(create(await storage.get(keys))) !== JSON.stringify(before)) throw new Error('PROFILE_CHANGED');
        await storage.set(Object.fromEntries(Object.keys(fields).map((field, index) => [keys[index], profile.appearance[field]])));
        return profile;
    }
    return { keys, parse, create, prepare, commit };
})();

// Portable protection profiles contain only safe local protection options,
// never consent, provider keys, host permissions, sender trust lists or logs.
const LocalProtectionProfile = (() => {
    const keys = ['privacyTier', 'alwaysManual', 'timeOfClickProtection', 'scanMode', 'autoScanLinks'];
    const tiers = ['strict', 'balanced', 'max'];
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    function parse(input) {
        if (typeof input === 'string') { if (input.length > 8192) throw new Error('PROFILE_INVALID'); input = JSON.parse(input); }
        if (!object(input) || Object.keys(input).sort().join(',') !== 'kind,protection,schemaVersion' || ![1,2].includes(input.schemaVersion) || input.kind !== 'thundy-local-protection' || !object(input.protection) || Object.keys(input.protection).sort().join(',') !== (input.schemaVersion === 1 ? 'alwaysManual,privacyTier,timeOfClickProtection' : 'alwaysManual,autoScanLinks,privacyTier,scanMode,timeOfClickProtection')) throw new Error('PROFILE_INVALID');
        const { privacyTier, alwaysManual, timeOfClickProtection } = input.protection;
        if (!tiers.includes(privacyTier) || typeof alwaysManual !== 'boolean' || typeof timeOfClickProtection !== 'boolean') throw new Error('PROFILE_INVALID');
        if (input.schemaVersion === 2 && (!['allDisplayed','approvedSenders','manual'].includes(input.protection.scanMode) || typeof input.protection.autoScanLinks !== 'boolean' || alwaysManual !== (input.protection.scanMode === 'manual'))) throw new Error('PROFILE_INVALID');
        return { schemaVersion: input.schemaVersion, kind: 'thundy-local-protection', protection: { privacyTier, alwaysManual, timeOfClickProtection, ...(input.schemaVersion === 2 ? {scanMode:input.protection.scanMode,autoScanLinks:input.protection.autoScanLinks} : {}) } };
    }
    function create(settings = {}) {
        const privacyTier = tiers.includes(settings.privacyTier) ? settings.privacyTier : 'strict';
        const alwaysManual = settings.alwaysManual === true;
        const timeOfClickProtection = settings.timeOfClickProtection !== undefined ? Boolean(settings.timeOfClickProtection) : true;
        const explicit = ['allDisplayed','approvedSenders','manual'].includes(settings.scanMode);
        return parse({ schemaVersion: explicit ? 2 : 1, kind: 'thundy-local-protection', protection: { privacyTier, alwaysManual: explicit ? settings.scanMode === 'manual' : alwaysManual, timeOfClickProtection, ...(explicit ? {scanMode:settings.scanMode,autoScanLinks:settings.autoScanLinks === true} : {}) } });
    }
    function createExport(settings = {}) {
        // Match the effective scan-policy defaults, without exporting consent.
        const scanMode = ['allDisplayed','approvedSenders','manual'].includes(settings.scanMode) ? settings.scanMode : settings.alwaysManual === true ? 'manual' : 'approvedSenders';
        return create({...settings, scanMode, autoScanLinks: settings.autoScanLinks === true});
    }
    function changes(profile, settings) {
        if (profile.schemaVersion === 2) return {...profile.protection};
        const scanMode = profile.protection.alwaysManual ? 'manual' : createExport(settings).protection.scanMode;
        return {...profile.protection, scanMode, alwaysManual:scanMode === 'manual'};
    }
    async function prepare(input, storage) {
        const profile = parse(input), settings = await storage.get(keys);
        return {profile, before:createExport(settings), after:createExport({...settings,...changes(profile,settings)})};
    }
    async function commit(proposal, storage) {
        const profile = parse(proposal?.profile), before = parse(proposal?.before), settings = await storage.get(keys);
        if (JSON.stringify(createExport(settings)) !== JSON.stringify(before)) throw new Error('PROFILE_CHANGED');
        await storage.set(changes(profile,settings));
        return profile;
    }
    return { keys, parse, create, createExport, prepare, commit };
})();

// Explicit field projection: never serialize storage, error objects or API keys.
const SupportReport = (() => {
    const keys = ['privacyTier', 'alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'externalAnalysisConsent', 'thundyAppearance', 'thundyAccent', 'thundyDensity'];
    function project(settings) {
        const result = {};
        for (const key of keys) {
            const value = settings[key];
            if (['alwaysManual', 'autoScanLinks', 'timeOfClickProtection', 'externalAnalysisConsent'].includes(key)) { if (typeof value === 'boolean') result[key] = value; }
            else {
                const allowed = { privacyTier: ['strict', 'balanced', 'max'], thundyAppearance: ['system', 'light', 'dark'], thundyAccent: ['ocean', 'violet', 'forest', 'amber'], thundyDensity: ['comfortable', 'compact'] };
                if (allowed[key].includes(value)) result[key] = value;
            }
        }
        return result;
    }
    async function create(api, configuration) {
        const safeVersion = value => typeof value === 'string' && /^\d+(?:\.\d+){0,3}(?:[a-z]\d*)?$/i.test(value) ? value : null;
        let info = {};
        try { info = await api.runtime.getBrowserInfo(); } catch (error) { /* no raw error in report */ }
        return { schemaVersion: 1, kind: 'thundy-local-support', authenticatedSource: false, createdAt: new Date().toISOString(),
            extensionVersion: safeVersion(api.runtime.getManifest().version), thunderbirdVersion: safeVersion(info.version),
            capabilities: { displayedMessages: typeof api.messageDisplay?.getDisplayedMessages === 'function', hostPermissions: typeof api.permissions?.contains === 'function', downloads: typeof api.downloads?.download === 'function' },
            ...(configuration ? { configuration: project(await api.storage.local.get(keys)) } : {}) };
    }
    return { project, create };
})();

const settingsStorage = typeof ThundySettings !== 'undefined' ? ThundySettings.storage : typeof browser !== 'undefined' ? browser.storage.local : null;
const ProviderKeyTester = (() => {
    async function testKey(provider,key,permissionsApi=browser.permissions) {
        const conf=ThundyProviders.registry[provider];
        if(!key||!key.trim())return {status:'empty'};
        if(!conf)return {status:'error'};
        if(!await permissionsApi.contains({origins:[conf.origin]}).catch(()=>false)) {
            if(!await permissionsApi.request({origins:[conf.origin]}).catch(()=>false))return {status:'permission_denied'};
        }
        if(typeof ThundySettings!=='undefined')return ThundySettings.send({action:'testProviderKey',provider,key:key.trim()});
        return ThundyProviders.test(provider,key.trim());
    }
    return {testKey,get endpoints(){return typeof ThundyProviders !== 'undefined' ? ThundyProviders.registry : {};}};
})();
if (typeof globalThis !== 'undefined') globalThis.ProviderKeyTester = ProviderKeyTester;
function uiText(key, fallback, params = []) {
    return typeof ThundyI18n !== 'undefined' ? ThundyI18n.get(key, params) : params.reduce((text, value, i) => text.replaceAll('$' + (i + 1), String(value)), fallback);
}

// manifest.json declares `data_collection_permissions: { required: ["none"],
// optional: ["personalCommunications"] }` and the Thunderbird permission
// `sensitiveDataUpload` as an optional permission. Thunderbird has no built-in
// onboarding prompt for data collection ("add-ons must request consent
// explicitly", webextension-api.thunderbird.net/en/mv3/permissions.html), so the
// consent is requested here - inside the save click handler, i.e. in a user
// gesture. Feature detection via permissions.getAll() keeps this working on
// Thunderbird builds without the built-in data collection consent.
// ---------------------------------------------------------------------------
let collectionConsentSupported = true;

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
async function requestDataCollectionConsent(origins = []) {
    try {
        if (collectionConsentSupported) {
            return await browser.permissions.request({ ...DATA_COLLECTION_REQUEST, origins }) === true;
        }
        return await requestSensitiveDataUploadPermission(origins);
    } catch (e) {
        return false;
    }
}

async function requestSensitiveDataUploadPermission(origins = []) {
    try {
        return await browser.permissions.request({ permissions: ['sensitiveDataUpload'], origins }) === true;
    } catch (e) {
        return false;
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
    document.body.addEventListener('input', event => {
        if (!event.target.closest('#appearance,#supportReport,#localProfile,.security-controls') && event.target.matches('input,select,textarea')) {
            const dirty = document.getElementById('settingsDirty');
            if (dirty) dirty.hidden = false;
        }
    });
    const profileInput = document.getElementById('localProfileInput');
    if (profileInput) {
        const preview = document.getElementById('localProfileDiff'), apply = document.getElementById('localProfileApply'), status = document.getElementById('localProfileStatus'), file = document.getElementById('localProfileFile');
        let proposal = null, generation = 0, applying = false;
        const reset = () => { generation++; proposal = null; preview.hidden = true; apply.disabled = true; status.textContent = ''; };
        profileInput.addEventListener('input', reset);
        file.addEventListener('change', async () => {
            if (applying) return;
            reset(); profileInput.value = ''; const own = generation, selected = file.files[0];
            if (!selected) return;
            try { if (selected.size > 8192) throw new Error('PROFILE_INVALID'); const text = await selected.text(); if (own !== generation) return; profileInput.value = text; }
            catch (error) { if (own === generation) status.textContent = uiText('localProfileInvalid', 'Invalid profile'); }
        });
        document.getElementById('localProfilePreview').addEventListener('click', async () => {
            if (applying) return;
            reset(); const own = generation, input = profileInput.value;
            try {
                if (typeof ThundyTheme !== 'undefined') await ThundyTheme.whenIdle();
                const parsedKind = typeof input === 'string' && input.length <= 8192 ? JSON.parse(input)?.kind : null;
                if (parsedKind === 'thundy-local-protection') {
                    const prepared = await LocalProtectionProfile.prepare(input, browser.storage.local);
                    if (own !== generation) return;
                    proposal = prepared;
                    const desired = prepared.after.protection;
                    const tierLabels = { strict: 'ui_145', balanced: 'ui_146', max: 'ui_147' };
                    const boolLabel = v => v ? uiText('localProfileYes', 'Yes') : uiText('localProfileNo', 'No');
                    preview.textContent = [
                        uiText('ui_144', 'Privacy tier:') + ' ' + uiText(tierLabels[prepared.before.protection.privacyTier], prepared.before.protection.privacyTier) + ' → ' + uiText(tierLabels[desired.privacyTier], desired.privacyTier),
                        uiText('ui_160', 'Always scan manually') + ': ' + boolLabel(prepared.before.protection.alwaysManual) + ' → ' + boolLabel(desired.alwaysManual),
                        uiText('scanModeLabel','Automatic external scans') + ': ' + uiText(({allDisplayed:'scanModeAll',approvedSenders:'scanModeSenders',manual:'scanModeManual'})[prepared.before.protection.scanMode],prepared.before.protection.scanMode) + ' → ' + uiText(({allDisplayed:'scanModeAll',approvedSenders:'scanModeSenders',manual:'scanModeManual'})[desired.scanMode],desired.scanMode),
                        uiText('ui_162','Automatic link analysis') + ': ' + boolLabel(prepared.before.protection.autoScanLinks) + ' → ' + boolLabel(desired.autoScanLinks),
                        uiText('scanModeHelp','Configured services may receive full URLs.'),
                        ...(prepared.profile.schemaVersion === 1 ? [uiText('localProtectionLegacyHelp','Older profiles cannot expand automatic scan scope or turn on URL submission. The preview shows the effective result.')] : []),
                        uiText('ui_164', 'Check links before opening them') + ': ' + boolLabel(prepared.before.protection.timeOfClickProtection) + ' → ' + boolLabel(desired.timeOfClickProtection)
                    ].join('\n');
                } else {
                    const prepared = await LocalSettingsProfile.prepare(input, browser.storage.local);
                    if (own !== generation) return;
                    proposal = prepared;
                    const names = { mode: 'themeMode', accent: 'themeAccent', density: 'themeDensity' };
                    const values = { system: 'themeSystem', light: 'themeLight', dark: 'themeDark', ocean: 'themeOcean', violet: 'themeViolet', forest: 'themeForest', amber: 'themeAmber', comfortable: 'themeComfortable', compact: 'themeCompact' };
                    preview.textContent = Object.keys(names).map(field => uiText(names[field], field) + ': ' + uiText(values[prepared.before.appearance[field]], '') + ' → ' + uiText(values[prepared.profile.appearance[field]], '')).join('\n');
                }
                preview.hidden = false; apply.disabled = false; preview.focus();
            } catch (error) { if (own === generation) status.textContent = uiText('localProfileInvalid', 'Invalid profile'); }
        });
        document.getElementById('localProfileDiscard').addEventListener('click', () => { if (!applying) { reset(); profileInput.value = ''; file.value = ''; } });
        apply.addEventListener('click', async () => {
            if (!proposal || applying) return;
            applying = true; apply.disabled = true;
            const controls = Array.from(document.querySelectorAll('#appearance input,#localProfile input,#localProfile textarea,#localProfile button')).filter(control => control !== apply);
            const states = controls.map(control => control.disabled); controls.forEach(control => { control.disabled = true; });
            try {
                if (typeof ThundyTheme !== 'undefined') await ThundyTheme.whenIdle();
                if (proposal.profile?.kind === 'thundy-local-protection') {
                    await LocalProtectionProfile.commit(proposal, settingsStorage);
                    const committed = proposal.after;
                    const tierEl = document.getElementById('privacyTier'), manualEl = document.getElementById('alwaysManual'), tocEl = document.getElementById('timeOfClickProtection');
                    if (tierEl) tierEl.value = committed.protection.privacyTier;
                    if (manualEl) manualEl.checked = committed.protection.alwaysManual;
                    const modeEl=document.getElementById('scanMode'), linksEl=document.getElementById('autoScanLinks');
                    if(modeEl) modeEl.value=committed.protection.scanMode || (committed.protection.alwaysManual ? 'manual' : modeEl.value);
                    if(linksEl && committed.schemaVersion === 2) linksEl.checked=committed.protection.autoScanLinks;
                    if (tocEl) tocEl.checked = committed.protection.timeOfClickProtection;
                } else {
                    await LocalSettingsProfile.commit(proposal, settingsStorage);
                }
                reset(); status.textContent = uiText('localProfileApplied', 'Profile applied');
            }
            catch (error) { status.textContent = uiText(error.message === 'PROFILE_CHANGED' ? 'localProfileChanged' : 'localProfileFailed', 'Profile could not be applied'); apply.disabled = false; }
            finally { applying = false; controls.forEach((control, index) => { control.disabled = states[index]; }); if (document.activeElement === document.body || document.activeElement === apply) (proposal ? apply : document.getElementById('localProfilePreview')).focus(); }
        });
        const exportProfile = async protection => {
            let url;
            try {
                if (typeof ThundyTheme !== 'undefined') await ThundyTheme.whenIdle();
                const model = protection ? LocalProtectionProfile : LocalSettingsProfile;
                const settings = await browser.storage.local.get(model.keys);
                const profile = protection ? model.createExport(settings) : model.create(settings);
                url = URL.createObjectURL(new Blob([JSON.stringify(profile, null, 2)], {type:'application/json'}));
                await browser.downloads.download({url, filename:protection ? 'thundy-local-protection.json' : 'thundy-local-settings.json', saveAs:true});
                status.textContent = uiText('auditExported', 'Export saved');
            } catch (_) { status.textContent = uiText('auditExportFailed', 'Export failed'); }
            finally { if (url) URL.revokeObjectURL(url); }
        };
        document.getElementById('localProfileExport').addEventListener('click', () => exportProfile(false));
        document.getElementById('localProtectionProfileExport').addEventListener('click', () => exportProfile(true));
    }
    const previewButton = document.getElementById('supportPreview');
    if (previewButton) {
        const content = document.getElementById('supportContent'), save = document.getElementById('supportSave'), config = document.getElementById('supportConfiguration'), status = document.getElementById('supportStatus');
        let preview = null, generation = 0;
        config.addEventListener('change', () => { generation++; preview = null; save.disabled = true; content.hidden = true; });
        previewButton.addEventListener('click', async () => {
            const current = ++generation, configuration = config.checked;
            save.disabled = true; preview = null; content.hidden = true;
            try { const report = JSON.stringify(await SupportReport.create(browser, configuration), null, 2); if (current !== generation) return; preview = report; content.textContent = preview; content.hidden = false; save.disabled = false; content.focus(); status.textContent = ''; }
            catch (error) { if (current !== generation) return; content.hidden = true; status.textContent = uiText('auditExportFailed', 'Export failed'); }
        });
        save.addEventListener('click', async () => {
            if (!preview) return;
            let url;
            try { url = URL.createObjectURL(new Blob([preview], { type: 'application/json' })); await browser.downloads.download({ url, filename: 'thundy-support.json', saveAs: true }); status.textContent = uiText('auditExported', 'Export saved'); }
            catch (error) { status.textContent = uiText('auditExportFailed', 'Export failed'); }
            finally { if (url) URL.revokeObjectURL(url); }
        });
    }
    dataCollectionConsentSupported().then(supported => { collectionConsentSupported = supported; });
    // Abrufen der gespeicherten Einstellung
    browser.storage.local.get([
        'apikey', 'urlhausApikey', 'urlscanApikey', 'virustotalApikey',
        'alwaysManual', 'scanMode', 'autoScanLinks', 'timeOfClickProtection',
        'privacyTier', 'customWhitelist', 'customBlacklist',
        'externalAnalysisConsent', 'ipReputationProvider', 'ipReputationApiKey', 'trustedAuthServers', 'scanningEnabledSenders'
    ]).then((result) => {
      document.getElementById('apikey').value = result.apikey || "";
      const trustedInput = document.getElementById('trustedAuthServers');
      if (trustedInput) trustedInput.value = (result.trustedAuthServers || []).join(', ');
      const senderInput = document.getElementById('scanningEnabledSenders');
      if (senderInput) senderInput.value = (result.scanningEnabledSenders || []).join('\n');
      document.getElementById('urlhausApikey').value = result.urlhausApikey || "";
      document.getElementById('urlscanApikey').value = result.urlscanApikey || "";
      document.getElementById('virustotalApikey').value = result.virustotalApikey || "";
      document.getElementById('privacyTier').value = result.privacyTier || "strict";
      document.getElementById('customWhitelist').value = (result.customWhitelist || []).join(', ');
      document.getElementById('customBlacklist').value = (result.customBlacklist || []).join(', ');
      document.getElementById('alwaysManual').checked = result.scanMode ? result.scanMode === 'manual' : result.alwaysManual || false;
      const modeSelect = document.getElementById('scanMode');
      if (modeSelect) { modeSelect.value = result.scanMode || ''; modeSelect.addEventListener('change', () => { document.getElementById('alwaysManual').checked = modeSelect.value === 'manual'; updatePrivacyTierStatus(); }); }
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
              ? uiText("ui_071", "Automatische Uploads sind gesperrt (\"Immer manuell scannen\"); die Stufe gilt weiterhin für manuelle Scans.")
              : '';
      }

      const autoScanLinksCheckbox = document.getElementById('autoScanLinks');
      const timeOfClickProtectionCheckbox = document.getElementById('timeOfClickProtection');

      function updateTimeOfClickProtectionStatus() {
          timeOfClickProtectionCheckbox.disabled = false;
          timeOfClickProtectionCheckbox.title = '';
      }

      // Initiale Setzung
      updatePrivacyTierStatus();
      updateTimeOfClickProtectionStatus();

      // Event Listener für Änderungen
      alwaysManualCheckbox.addEventListener('change', updatePrivacyTierStatus);
      autoScanLinksCheckbox.addEventListener('change', updateTimeOfClickProtectionStatus);

      function attachKeyTestHandler(buttonId, inputId, statusId, getProvider) {
          const button = document.getElementById(buttonId);
          const input = document.getElementById(inputId);
          const statusSpan = document.getElementById(statusId);
          if (!button || !input || !statusSpan) return;

          input.addEventListener('input', () => {
              statusSpan.textContent = '';
              statusSpan.className = 'key-test-status';
          });

          button.addEventListener('click', async () => {
              const provider = typeof getProvider === 'function' ? getProvider() : getProvider;
              if (!provider || provider === 'none') {
                  statusSpan.className = 'key-test-status text-warning';
                  statusSpan.textContent = uiText('testApiKeySelectProvider', 'Please select an IP reputation provider first.');
                  return;
              }

              const rawKey = input.value.trim().replace(/\r|\n/g, '');
              if (!rawKey) {
                  statusSpan.className = 'key-test-status text-warning';
                  statusSpan.textContent = uiText('testApiKeyEmpty', 'Please enter an API key first.');
                  return;
              }

              button.disabled = true;
              button.setAttribute('aria-busy', 'true');
              statusSpan.className = 'key-test-status';
              statusSpan.textContent = uiText('testApiKeyTesting', 'Testing connection…');

              try {
                  if (!window.confirm(uiText('providerTestDisclosure', 'This sends your key and fixed test data to the provider, without message content. Continue?'))) { button.disabled=false;return; }
                  const result = await ProviderKeyTester.testKey(provider, rawKey);
                  if (result.status === 'valid') {
                      statusSpan.className = 'key-test-status text-success';
                      statusSpan.textContent = uiText('testApiKeyValid', 'Connection successful. API key is valid.');
                  } else if (result.status === 'invalid_key') {
                      statusSpan.className = 'key-test-status text-danger';
                      statusSpan.textContent = uiText('testApiKeyInvalid', 'Connection failed: Invalid API key.');
                  } else if (result.status === 'rate_limited') {
                      statusSpan.className = 'key-test-status text-warning';
                      statusSpan.textContent = uiText('testApiKeyRateLimited', 'Rate limit or quota reached. Please try again later.');
                  } else if (result.status === 'permission_denied') {
                      statusSpan.className = 'key-test-status text-danger';
                      statusSpan.textContent = uiText('testApiKeyPermissionDenied', 'Permission to connect to service host was denied.');
                  } else if (result.status === 'empty') {
                      statusSpan.className = 'key-test-status text-warning';
                      statusSpan.textContent = uiText('testApiKeyEmpty', 'Please enter an API key first.');
                  } else {
                      statusSpan.className = 'key-test-status text-danger';
                      statusSpan.textContent = uiText('testApiKeyError', 'Connection test failed.');
                  }
              } catch (err) {
                  statusSpan.className = 'key-test-status text-danger';
                  statusSpan.textContent = uiText('testApiKeyError', 'Connection test failed.') + (err && err.message ? ' (' + err.message + ')' : '');
              } finally {
                  button.disabled = false;
                  button.removeAttribute('aria-busy');
              }
          });
      }

      attachKeyTestHandler('testHybridKey', 'apikey', 'testHybridKeyStatus', 'hybridanalysis');
      attachKeyTestHandler('testUrlhausKey', 'urlhausApikey', 'testUrlhausKeyStatus', 'urlhaus');
      attachKeyTestHandler('testUrlscanKey', 'urlscanApikey', 'testUrlscanKeyStatus', 'urlscan');
      attachKeyTestHandler('testVirustotalKey', 'virustotalApikey', 'testVirustotalKeyStatus', 'virustotal');
      attachKeyTestHandler('testIpReputationKey', 'ipReputationApiKey', 'testIpReputationKeyStatus', () => document.getElementById('ipReputationProvider')?.value);

      const ipProviderSelect = document.getElementById('ipReputationProvider');
      if (ipProviderSelect) {
          ipProviderSelect.addEventListener('change', () => {
              const statusSpan = document.getElementById('testIpReputationKeyStatus');
              if (statusSpan) {
                  statusSpan.textContent = '';
                  statusSpan.className = 'key-test-status';
              }
          });
      }
    });
  });
  
  const saveElement = document.getElementById('save');
  if (saveElement) saveElement.addEventListener('click', async function() {
    const apikeyInput = document.getElementById('apikey');
    if (!apikeyInput.reportValidity()) {
        return;
    }

    const senderInput = document.getElementById('scanningEnabledSenders');
    const senderEntries = (senderInput?.value || '').split(/[\r\n,]+/).map(address => address.trim().toLowerCase()).filter(Boolean);
    if (senderInput) {
        senderInput.setCustomValidity(senderEntries.every(address => /^[^\s@<>]+@[^\s@<>]+$/.test(address)) ? '' : uiText('invalidSenderAddress', 'Enter plain email addresses.'));
        if (!senderInput.reportValidity()) return;
    }

    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    saveBtn.textContent = uiText("ui_073", "Wird gespeichert...");

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
    // Host-Berechtigungen nur für die tatsächlich konfigurierten Dienste
    // anfragen (Nutzer-Geste = Klick auf "Speichern").
    const requestedOrigins = [];
    if (mySetting) requestedOrigins.push(['hybrid-analysis.com', 'https://hybrid-analysis.com/*']);
    if (virustotalSetting || (ipReputationProviderSetting === 'virustotal' && ipReputationApiKeySetting)) requestedOrigins.push(['virustotal.com', 'https://www.virustotal.com/*']);
    if (urlscanSetting && privacyTierSetting === 'max') requestedOrigins.push(['urlscan.io', 'https://urlscan.io/*']);
    if (urlhausSetting) requestedOrigins.push(['urlhaus.abuse.ch', 'https://urlhaus-api.abuse.ch/*']);
    if (ipReputationProviderSetting === 'abuseipdb' && ipReputationApiKeySetting) requestedOrigins.push(['abuseipdb.com', 'https://api.abuseipdb.com/*']);


    const consentPromise = externalAnalysisConsentSetting ? requestDataCollectionConsent(requestedOrigins.map(([, origin]) => origin)) : Promise.resolve(false);
    settingsStorage.set({
        scanningEnabledSenders: [...new Set(senderEntries)],
        trustedAuthServers: (document.getElementById('trustedAuthServers')?.value || '').split(',').map(host => host.trim().toLowerCase()).filter(host => /^[a-z0-9.-]+$/.test(host)),
        apikey: mySetting,
        urlhausApikey: urlhausSetting,
        urlscanApikey: urlscanSetting,
        virustotalApikey: virustotalSetting,
        privacyTier: privacyTierSetting,
        customWhitelist: whitelistSetting,
        customBlacklist: blacklistSetting,
        alwaysManual: alwaysManualSetting,
        ...(['allDisplayed','approvedSenders','manual'].includes(document.getElementById('scanMode')?.value) ? {scanMode: document.getElementById('scanMode').value} : {}),
        autoScanLinks: autoScanLinksSetting,
        timeOfClickProtection: timeOfClickProtectionSetting,
        externalAnalysisConsent: false,
        ipReputationProvider: ipReputationProviderSetting,
        ipReputationApiKey: ipReputationApiKeySetting
    }).then(async () => {
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.className = 'text-success ml-2';
        statusSpan.textContent = uiText("ui_073", "Wird gespeichert...");
        statusSpan.style.display = 'inline';


        // Daten-Deklaration und Konsent: das Manifest deklariert die Übermittlung
        // als optional, deshalb wird die Zustimmung hier eingeholt (Thunderbird
        // zeigt keinen eigenen Prompt). Lehnt der Nutzer den Dialog ab, wird die
        // Checkbox zurückgesetzt - ohne Zustimmung wird nichts übertragen.
        if (externalAnalysisConsentSetting) {
            const consentGranted = await consentPromise;
            if (!consentGranted) {
                externalAnalysisConsentSetting = false;
                await settingsStorage.set({ externalAnalysisConsent: false });
                const consentBox = document.getElementById('externalAnalysisConsent');
                if (consentBox) consentBox.checked = false;
                statusSpan.textContent = uiText("ui_076", "Zustimmung zur Datenübermittlung nicht erteilt – es wird nichts übertragen.");
            }
        } else {
            await removeDataCollectionConsent();
        }

        await settingsStorage.set({ externalAnalysisConsent: externalAnalysisConsentSetting === true });

        if (externalAnalysisConsentSetting && requestedOrigins.length > 0) {
            const denied = [];
            for (const [label, origin] of requestedOrigins) {
                try {
                    const granted = await browser.permissions.contains({ origins: [origin] });
                    if (!granted) denied.push(label);
                } catch (e) {
                    console.error('Permission request failed', e);
                    denied.push(label);
                }
            }
            if (denied.length > 0) {
                alert(uiText("ui_077", "Host‑Berechtigung nicht erteilt für: ") + denied.join(', ') +
                    uiText("ui_078", ". Ohne diese Berechtigung sind die entsprechenden Prüfungen deaktiviert."));
            }
        }

        if (externalAnalysisConsentSetting || !document.getElementById('externalAnalysisConsent').checked) {
            if (statusSpan.textContent === uiText('ui_073', 'Wird gespeichert...')) statusSpan.textContent = uiText('ui_074', 'Erfolgreich gespeichert!');
        }
        const dirty = document.getElementById('settingsDirty');
        if (dirty) dirty.hidden = true;
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = uiText("ui_075", "Speichern");

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
        let statusSpan = document.getElementById('saveStatus');
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = uiText("ui_079", "Fehler beim Speichern!");
        statusSpan.style.display = 'inline';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = uiText("ui_075", "Speichern");
    });
  });

  const clearCacheElement = document.getElementById('clearCache');
  if (clearCacheElement) clearCacheElement.addEventListener('click', async function() {
    if (!confirm(uiText("ui_080", "Möchten Sie den Cache wirklich leeren? Dies entfernt alle lokal gespeicherten Analyse-Ergebnisse."))) {
        return;
    }
    const clearBtn = document.getElementById('clearCache');
    clearBtn.disabled = true;
    clearBtn.setAttribute('aria-busy', 'true');
    clearBtn.textContent = uiText("ui_081", "Wird geleert...");

    let statusSpan = document.getElementById('clearCacheStatus');
    statusSpan.style.display = 'none';
    statusSpan.textContent = '';
    statusSpan.className = 'text-success ml-2';

    try {
        const db = await openDB('thunderbird_av', 3);
        const cleared = typeof ThundySettings !== 'undefined' ? (await ThundySettings.send({action:'securityClearCache'})).success : await clearStore(db, 'hybridanalysis');
        await (typeof ThundySettings !== 'undefined' ? ThundySettings.send({action:'clearMemoryCaches'}) : browser.runtime.sendMessage({action:'clearMemoryCaches'}));
        if (typeof db.close === 'function') db.close();

        if (cleared) {
            statusSpan.textContent = uiText("ui_082", "Cache erfolgreich geleert.");
        } else {
            statusSpan.textContent = uiText("ui_083", "Datenbank existiert noch nicht oder ist bereits leer.");
        }
    } catch (error) {
        statusSpan.className = 'text-danger ml-2';
        statusSpan.textContent = uiText("ui_084", "Fehler beim Leeren des Caches.");
        console.error(error);
    } finally {
        clearBtn.disabled = false;
        clearBtn.removeAttribute('aria-busy');
        clearBtn.textContent = uiText("ui_085", "Cache leeren");
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
