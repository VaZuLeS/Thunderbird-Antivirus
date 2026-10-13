// Message-view UI. Resolve labels in the extension before script injection.
async function injectIntoMessageDisplay(tabId, func, args = []) {
    if (tabId === undefined || tabId === null) return null;
    const injection = { target: { tabId }, func, args };
    try {
        return await browser.scripting.executeScript(injection);
    } catch (e) {
        Logger.warn('Injecting into the message display failed (please report with your Thunderbird version):', e);
        if (!injectionFailureReported) {
            injectionFailureReported = true;
            notify('notificationTitleError', 'notificationInjectionFailed');
        }
        return null;
    }
}

async function injectTimeOfClickProtection(tabId, filteredUrls, messageId = null) {
    if (!timeOfClickProtection) return;
    const labels = { waiting: msg('linkChecking'), warning: msg('linkWarning'), unknown: msg('linkUnknown'), proceed: msg('linkProceed'), noDetection: msg('linkNoDetection'), cancel: msg('linkCancel') };
    await injectIntoMessageDisplay(tabId, function(labels, messageId) {
        if (document.documentElement.dataset.thundyClickProtection) return;
        document.documentElement.dataset.thundyClickProtection = 'true';
        let busy = false;
        async function onClick(event) {
            const link = event.target.closest && event.target.closest('a[href]');
            if (!link || !/^https?:/i.test(link.href) || (event.type === 'auxclick' && event.button !== 1)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (busy) return;
            busy = true;
            const url = link.href;
            const newTab = event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1 || link.target === '_blank';
            const panel = document.createElement('div');
            panel.setAttribute('role', 'alertdialog');
            panel.setAttribute('aria-modal', 'true');
            panel.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;z-index:2147483647;background:#fff;color:#222;border:2px solid #555;padding:16px;font:16px sans-serif;';
            const text = document.createElement('p');
            text.textContent = labels.waiting;
            panel.appendChild(text);
            document.body.appendChild(panel);
            const cancel = document.createElement('button');
            cancel.textContent = labels.cancel;
            const close = () => { panel.remove(); busy = false; link.focus(); };
            cancel.addEventListener('click', close);
            panel.appendChild(cancel);
            panel.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); close(); }
                if (event.key === 'Tab') {
                    const buttons = Array.from(panel.querySelectorAll('button'));
                    const index = buttons.indexOf(document.activeElement);
                    event.preventDefault();
                    buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
                }
            });
            cancel.focus();
            let result;
            try {
                result = await browser.runtime.sendMessage({ action: 'checkLinkState', url, messageId, userAction: true });
            } catch (e) { result = { status: 'ERROR' }; }
            if (!link.isConnected || !panel.isConnected || link.href !== url) { busy = false; panel.remove(); return; }
            const dangerous = /MALICIOUS|SUSPICIOUS|MALICIOUS_VISUAL/.test(result && result.status || '');
            text.textContent = dangerous ? labels.warning : result && result.status === 'CLEAN' ? labels.noDetection : labels.unknown;

            const proceed = document.createElement('button');
            proceed.textContent = labels.proceed;
            proceed.addEventListener('click', () => {
                panel.remove(); busy = false;
                if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
                else window.location.assign(url);
            });
            panel.appendChild(proceed);
            cancel.focus();
        }
        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);
    }, [labels, messageId]);
}

async function injectThreatBanner(tabId, threat) {
    if (threat.score >= 50 || threat.authStatus === 'pass') {
        await injectIntoMessageDisplay(tabId, function(score, reasons, authStatus, localized) {
                const t = (key, fallback, subs) => {
                    try {
                        return localized[key] || browser.i18n.getMessage(key, subs) || fallback;
                    } catch (e) {
                        return fallback;
                    }
                };
                if (score >= 50) {
                    // Sichere DOM-Manipulation ohne innerHTML
                    const banner = document.createElement('div');
                    banner.id = 'thundy-threat-banner';
                    banner.style.backgroundColor = '#ffeeee';
                    banner.style.border = '1px solid #ff0000';
                    banner.style.color = '#ff0000';
                    banner.style.padding = '10px';
                    banner.style.margin = '10px';
                    banner.style.borderRadius = '4px';
                    banner.style.fontWeight = 'bold';
                    banner.style.fontFamily = 'Arial, sans-serif';
                    banner.style.zIndex = '9999';

                    const title = document.createElement('div');
                    title.textContent = '🔴 ⚠️ ' + t('bannerThreatTitle', 'Thundy AV warning') +
                        ' (' + t('bannerThreatScore', 'Risk score: $SCORE$ of 100', [String(score)]) + ')';
                    title.style.fontSize = '16px';
                    title.style.marginBottom = '5px';
                    banner.appendChild(title);

                    const reasonList = document.createElement('ul');
                    reasonList.style.margin = '0';
                    reasonList.style.paddingLeft = '20px';
                    reasonList.style.fontSize = '14px';

                    for (const reason of reasons) {
                        const li = document.createElement('li');
                        li.textContent = reason;
                        reasonList.appendChild(li);
                    }
                    banner.appendChild(reasonList);

                    document.body.prepend(banner);
                } else if (authStatus === 'pass') {
                    const badge = document.createElement('div');
                    badge.id = 'thundy-auth-badge';
                    badge.style.display = 'inline-block';
                    badge.style.backgroundColor = '#e6ffe6';
                    badge.style.border = '1px solid #008000';
                    badge.style.color = '#008000';
                    badge.style.padding = '5px 10px';
                    badge.style.margin = '10px';
                    badge.style.borderRadius = '20px';
                    badge.style.fontWeight = 'bold';
                    badge.style.fontFamily = 'Arial, sans-serif';
                    badge.style.fontSize = '12px';
                    badge.style.zIndex = '9999';
                    badge.textContent = '🟢 🛡️ ' + t('bannerAuthPass', 'Trusted server reports SPF/DKIM/DMARC passed');

                    document.body.prepend(badge);
                }
        }, [threat.score, threat.reasons, threat.authStatus, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key, key === 'bannerThreatScore' ? [String(threat.score)] : [])]))]);
    }
}

async function injectOptInBanner(tabId, messageId, senderEmail, consentGiven) {
  await injectIntoMessageDisplay(tabId, function(messageId, senderEmail, consentGiven, localized) {
        const t = (key, fallback, subs) => {
          try {
            return localized[key] || browser.i18n.getMessage(key, subs) || fallback;
          } catch (e) {
            return fallback;
          }
        };

        const existing = document.getElementById('thundy-optin-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'thundy-optin-banner';
        banner.style.backgroundColor = '#fff8e1';
        banner.style.border = '1px solid #ffcc80';
        banner.style.color = '#333';
        banner.style.padding = '8px';
        banner.style.margin = '8px';
        banner.style.borderRadius = '4px';
        banner.style.fontFamily = 'Arial, sans-serif';
        banner.style.zIndex = '9999';

        const text = document.createElement('span');
        text.textContent = t('bannerTitleOptIn', 'Thundy AV: real-time scanning is not enabled for this message.');
        banner.appendChild(text);

        const createButton = (label, persist) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.style.marginLeft = '10px';
          btn.addEventListener('click', async () => {
            const buttons = banner.querySelectorAll('button');
            buttons.forEach(b => { b.disabled = true; b.setAttribute('aria-busy', 'true'); });
            btn.textContent = t('bannerScanRunning', 'Scanning…');
            try {
              const resp = await browser.runtime.sendMessage({
                action: 'requestScan',
                messageId: messageId,
                senderEmail: senderEmail,
                persist: persist
              });
              if (resp && resp.success) {
                btn.textContent = t('bannerScanDone', 'Scan finished');
                btn.removeAttribute('aria-busy');
                buttons.forEach(b => { b.disabled = false; });
                if (persist) {
                  setNote(t('bannerSenderOptIn', 'This sender is now scanned automatically.'));
                }
              } else if (resp && resp.error === 'permission_denied') {
                btn.textContent = t('bannerPermissionDenied', 'Required host permission was denied');
                // A request triggered from the banner travels over
                // runtime.sendMessage, so it has no user gesture in the context
                // that calls permissions.request; if it is rejected, the options
                // page is the reliable path (P2-23).
                setNote(t('bannerPermissionDeniedHint', 'The host permission for the analysis service is missing. Please grant it in the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'HOST_PERMISSION_MISSING' || resp.code === 'HOST_PERMISSION_MISSING')) {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                setNote(t('bannerPermissionDeniedHint', 'The host permission for the analysis service is missing. Please grant it in the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'TIER_BLOCKS_UPLOAD' || resp.code === 'TIER_BLOCKS_UPLOAD' ||
                                  resp.error === 'TIER_REQUIRES_MAX' || resp.code === 'TIER_REQUIRES_MAX')) {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                setNote(t('bannerTierBlocked', 'This action is not allowed by the current privacy tier. See the add-on options.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              } else if (resp && (resp.error === 'EXTERNAL_ANALYSIS_DISABLED' || resp.code === 'EXTERNAL_ANALYSIS_DISABLED')) {
                setNote(t('bannerConsentMissing', 'External analysis is disabled in the options – nothing was transmitted.'));
                addOptionsButton();
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); btn.textContent = label; });
              } else {
                btn.textContent = t('bannerScanFailed', 'Scan failed');
                buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
              }
            } catch (e) {
              btn.textContent = t('bannerScanFailed', 'Scan failed');
              buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); });
            }
          });
          banner.appendChild(btn);
        };

        const note = document.createElement('div');
        note.id = 'thundy-optin-note';
        note.style.fontSize = '12px';
        note.style.marginTop = '6px';
        note.textContent = t('bannerNoteOptIn', 'Scanning transmits data to external analysis services, but only if you enabled it in the add-on settings and only after you gave your consent. See the add-on options.');
        if (!consentGiven) {
          note.textContent = t('bannerConsentMissing', 'External analysis is disabled in the options – nothing was transmitted.');
        }

        function setNote(value) {
          note.textContent = value;
        }

        function addOptionsButton() {
          if (banner.querySelector('#thundy-open-options')) return;
          const optionsButton = document.createElement('button');
          optionsButton.id = 'thundy-open-options';
          optionsButton.type = 'button';
          optionsButton.textContent = t('bannerOpenOptions', 'Open options');
          optionsButton.style.marginLeft = '10px';
          optionsButton.setAttribute('aria-describedby', 'thundy-optin-note');
          optionsButton.addEventListener('click', () => browser.runtime.openOptionsPage());
          note.appendChild(optionsButton);
        }

        createButton(t('bannerScanOnce', 'Scan this message once'), false);
        createButton(t('bannerScanSender', 'Always scan this sender'), true);

        banner.appendChild(note);

        if (!consentGiven) {
          addOptionsButton();
        }

        document.body.prepend(banner);
  }, [messageId, senderEmail, consentGiven === true, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key)]))]);
}
