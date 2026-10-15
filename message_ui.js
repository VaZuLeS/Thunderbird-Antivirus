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
    const labels = { waiting: msg('linkChecking'), warning: msg('linkWarning'), unknown: msg('linkUnknown'), proceed: msg('linkProceed'), noDetection: msg('linkNoDetection'), cancel: msg('linkCancel'), title: msg('linkDialogTitle'), destination: msg('linkDestination'), details: msg('linkUrlDetails'), open: msg('linkOpenBrowser'), opening: msg('linkOpening'), failed: msg('linkOpenFailed'), limited: msg('linkCheckLimited'), score: msg('auditLocalScore'), unavailable: msg('auditUnavailable'), auditFailed: msg('auditFailure') };
    const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
    await injectIntoMessageDisplay(tabId, function(labels, messageId, theme) {
        if (document.documentElement.dataset.thundyClickProtection) return;
        document.documentElement.dataset.thundyClickProtection = 'true';
        let busy = false;
        async function onClick(event) {
            const link = event.target.closest && event.target.closest('a[href]');
            if (!link || !/^https?:/i.test(link.href) || !((event.type === 'click' && event.button === 0) || (event.type === 'auxclick' && event.button === 1))) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (busy) return;
            busy = true;
            const url = link.href;
            const interactionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
            let opening = false;
            const panel = document.createElement('div');
            panel.id = 'thundy-link-dialog';
            panel.setAttribute('role', 'alertdialog');
            panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('aria-labelledby', 'thundy-link-title');
            panel.setAttribute('aria-describedby', 'thundy-link-result');
            panel.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:auto!important;height:auto!important;z-index:2147483647!important;background:rgba(15,23,42,.48)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:16px!important;box-sizing:border-box!important;';
            // Shadow DOM isolates the security UI from styles in the email.
            const root = panel.attachShadow({ mode: 'open' });
            const style = document.createElement('style');
            const themeStyle = document.createElement('style');
            themeStyle.textContent = ':host {' + (theme?.css || '') + '}';
            style.textContent = `
                * { box-sizing:border-box; }
                .dialog { width:520px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#17243a);border:1px solid var(--card-border,#cbd5e1);border-radius:16px;padding:24px;box-shadow:0 20px 70px #0004;font:14px/1.55 system-ui,sans-serif;text-align:left; }
                header { display:flex;align-items:center;gap:12px;margin-bottom:20px; }
                .brand { display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--btn-primary-bg,#075985);color:white;font-size:22px;font-weight:800; }
                strong { font-size:18px; } h2 { margin:0;font-size:13px;font-weight:400;color:var(--text-muted,#475569); }
                .label { color:var(--text-muted,#475569);font-size:12px;font-weight:600;margin:0 0 4px; }
                .destination { font-size:18px;font-weight:650;overflow-wrap:anywhere;margin:0 0 12px; }
                details { border:1px solid var(--card-border,#cbd5e1);border-radius:8px;padding:10px 12px;margin-bottom:18px; } summary { cursor:pointer; } code { display:block;font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap;margin-top:10px;user-select:text; }
                .result { padding:14px;border-radius:10px;background:var(--accent-soft,#eff6ff);border-left:4px solid var(--link-color,#0369a1);margin:0 0 12px; }
                .danger { background:var(--alert-error-bg,#fff1f2);border-color:var(--color-danger,#be123c); } .unknown { background:var(--warning-bg,#fff7ed);border-color:var(--color-warning,#b45309); }
                .note { color:var(--text-muted,#475569);font-size:12px;margin:12px 0; } ul { padding-left:20px;overflow-wrap:anywhere; }
                .error { color:var(--color-danger,#be123c);margin:12px 0; } .error:empty { display:none; }
                footer { display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:20px; }
                button { font:600 14px/1.4 system-ui,sans-serif;border:1px solid var(--input-border,#94a3b8);border-radius:8px;padding:10px 16px;cursor:pointer;background:var(--card-bg,#fff);color:var(--text-color,#17243a);max-width:100%;overflow-wrap:anywhere; }
                .primary { background:var(--btn-primary-bg,#075985);color:#fff;border-color:var(--btn-primary-bg,#075985); } .warning { background:#9f1239;border-color:#9f1239; }
                button:focus-visible,summary:focus-visible { outline:3px solid #0284c7;outline-offset:3px; } button:disabled { opacity:.6;cursor:wait; }

            `;
            const card = document.createElement('section'); card.className = 'dialog';
            const header = document.createElement('header');
            const brand = document.createElement('span'); brand.className = 'brand'; brand.textContent = 'T'; brand.setAttribute('aria-hidden', 'true');
            const headings = document.createElement('div');
            const name = document.createElement('strong'); name.textContent = 'Thundy AV';
            const title = document.createElement('h2'); title.id = 'thundy-link-title'; title.textContent = labels.title;
            headings.append(name, title); header.append(brand, headings); card.appendChild(header);
            // ARIA references must stay in the same tree as their targets.
            panel.setAttribute('aria-label', 'Thundy AV · ' + labels.title);
            panel.removeAttribute('aria-labelledby'); panel.removeAttribute('aria-describedby');
            const label = document.createElement('p'); label.className = 'label'; label.textContent = labels.destination;
            const host = document.createElement('p'); host.className = 'destination'; host.textContent = new URL(url).host;
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = labels.details;
            const address = document.createElement('code'); address.textContent = url;
            details.append(summary, address); card.append(label, host, details);
            const text = document.createElement('p'); text.id = 'thundy-link-result'; text.className = 'result'; text.setAttribute('role', 'status'); text.setAttribute('aria-live', 'polite'); text.textContent = labels.waiting;
            const note = document.createElement('p'); note.className = 'note'; note.textContent = labels.limited;
            const reasons = document.createElement('ul'); reasons.hidden = true;
            const error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert');
            const footer = document.createElement('footer');
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = labels.cancel;
            const close = (reason = 'cancel') => {
                if (!panel.isConnected || (opening && reason !== 'opened' && reason !== 'context_closed')) return;
                panel.remove(); busy = false; if (link.isConnected) link.focus();
                document.defaultView.removeEventListener('pagehide', onPageHide);
                if (reason !== 'opened') browser.runtime.sendMessage({ action: 'cancelLinkInteraction', interactionId, url, messageId, reason }).catch(() => {});
            };
            const onPageHide = () => close('context_closed');
            document.defaultView.addEventListener('pagehide', onPageHide);

            cancel.addEventListener('click', () => close('cancel')); footer.appendChild(cancel);
            card.append(text, reasons, note, error, footer); root.append(themeStyle, style, card); document.body.appendChild(panel);
            // Refresh without delaying security UI if the background is unavailable.
            if (theme) {
                Promise.resolve(browser.runtime.sendMessage({ action: 'getUiTheme' })).then(latest => {
                    if (panel.isConnected && latest && typeof latest.css === 'string') themeStyle.textContent = ':host {' + latest.css + '}';
                }).catch(() => {});
            }
            root.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); close('escape'); }
                if (event.key === 'Tab') {
                    const controls = Array.from(root.querySelectorAll('button:not(:disabled),summary'));
                    const index = controls.indexOf(root.activeElement);
                    event.preventDefault(); controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
                }
            });
            cancel.focus();
            let result;
            try { result = await browser.runtime.sendMessage({ action: 'checkLinkState', url, messageId, interactionId, userAction: true }); }
            catch (e) { result = { status: 'ERROR' }; }
            if (!panel.isConnected) return;
            if (!link.isConnected || link.href !== url) { close('destination_changed'); return; }
            const dangerous = /MALICIOUS|SUSPICIOUS|MALICIOUS_VISUAL/.test(result && result.status || '');
            const clean = result && result.status === 'CLEAN';
            text.className = 'result ' + (dangerous ? 'danger' : clean ? '' : 'unknown');
            text.textContent = dangerous ? labels.warning : clean ? labels.noDetection : labels.unknown;
            if (result && Array.isArray(result.reasons)) {
                for (const reason of result.reasons) { const item = document.createElement('li'); item.textContent = String(reason); reasons.appendChild(item); }
                reasons.hidden = !reasons.childElementCount;
            }
            const score = document.createElement('p'); score.className = 'note';
            score.textContent = labels.score + ': ' + (Number.isFinite(result && result.score) ? result.score + ' / 100' : labels.unavailable);
            card.insertBefore(score, note);
            if (result && result.auditSaved === false) { const auditNotice = document.createElement('p'); auditNotice.className = 'error'; auditNotice.textContent = labels.auditFailed; card.insertBefore(auditNotice, footer); }
            const proceed = document.createElement('button'); proceed.type = 'button'; proceed.className = 'primary' + (dangerous ? ' warning' : '');
            const buttonLabel = clean ? labels.open : labels.proceed;
            proceed.textContent = buttonLabel;
            proceed.addEventListener('click', async () => {
                if (opening || !panel.isConnected) return;
                if (!link.isConnected || link.href !== url) { close('destination_changed'); return; }
                opening = true; cancel.disabled = true; proceed.disabled = true; proceed.setAttribute('aria-busy', 'true'); proceed.textContent = labels.opening; error.textContent = '';
                // Keep the dialog on failure, so the user can retry or cancel.
                try {
                    const opened = await browser.runtime.sendMessage({ action: 'openCheckedLink', url, messageId, interactionId });
                    if (opened && opened.success) { close('opened'); return; }
                } catch (e) { /* show the localized error below */ }
                opening = false; cancel.disabled = false; proceed.disabled = false; proceed.removeAttribute('aria-busy'); proceed.textContent = buttonLabel; error.textContent = labels.failed;
            });
            footer.appendChild(proceed); cancel.focus();
        }
        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);
    }, [labels, messageId, theme]);
}

async function injectThreatBanner(tabId, threat) {
    if (threat.score >= 50 || threat.authStatus === 'pass') {
        const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
        await injectIntoMessageDisplay(tabId, function(score, reasons, authStatus, localized, theme) {
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
                    banner.style.cssText = (theme?.css || '') + 'background:var(--alert-error-bg,#fff1f2);border:1px solid var(--color-danger,#be123c);border-left:4px solid var(--color-danger,#be123c);color:var(--color-danger,#881337);padding:16px;margin:12px;border-radius:12px;font:14px/1.55 system-ui,sans-serif;';

                    const title = document.createElement('div');
                    title.textContent = t('bannerThreatTitle', 'Thundy AV warning') +
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

                    document.getElementById('thundy-threat-banner')?.remove();
                    document.getElementById('thundy-auth-badge')?.remove();
                    document.body.prepend(banner);
                } else if (authStatus === 'pass') {
                    const badge = document.createElement('div');
                    badge.id = 'thundy-auth-badge';
                    badge.style.display = 'inline-block';
                    badge.style.cssText = theme?.css || '';
                    badge.style.backgroundColor = 'var(--card-bg,#e6ffe6)';
                    badge.style.border = '1px solid var(--color-success,#008000)';
                    badge.style.color = 'var(--color-success,#008000)';
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
        }, [threat.score, threat.reasons, threat.authStatus, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key, key === 'bannerThreatScore' ? [String(threat.score)] : [])])), theme]);
    }
}

async function injectOptInBanner(tabId, messageId, senderEmail, consentGiven) {
  const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
  await injectIntoMessageDisplay(tabId, function(messageId, senderEmail, consentGiven, localized, theme) {
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
        banner.style.cssText = (theme?.css || '') + 'background:var(--card-bg,#f0f7ff);border:1px solid var(--card-border,#bfd6ee);border-left:4px solid var(--btn-primary-bg,#075985);color:var(--text-color,#17243a);padding:16px;margin:12px;border-radius:12px;font:14px/1.55 system-ui,sans-serif;';

        const text = document.createElement('p');
        text.style.cssText = 'margin:0 0 12px;font-weight:600;';
        text.textContent = t('bannerTitleOptIn', 'Thundy AV: real-time scanning is not enabled for this message.');
        banner.appendChild(text);

        const createButton = (label, persist) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.style.cssText = 'margin:0 8px 8px 0;padding:9px 13px;border:1px solid var(--btn-primary-bg,#075985);border-radius:8px;background:var(--btn-primary-bg,#075985);color:#fff;font:600 13px/1.4 system-ui,sans-serif;cursor:pointer;';
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
        note.style.marginTop = '8px';
        note.style.color = 'var(--text-muted,#334155)';
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
  }, [messageId, senderEmail, consentGiven === true, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key)])), theme]);
}
