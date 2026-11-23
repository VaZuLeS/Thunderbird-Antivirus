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

async function bindMessageAppearance(tabId) {
    if (typeof ThundyTheme === 'undefined' || typeof ThundyTheme.watch !== 'function') return;
    await injectIntoMessageDisplay(tabId, function() {
        if (document.__thundyMessageAppearance || !browser.runtime.connect) return;
        const hosts = ['thundy-link-dialog','thundy-threat-banner','thundy-auth-badge','thundy-optin-banner','thundy-analysis-status'];
        let css;
        const apply = style => {
            if (!css || !style) return;
            const selector = style.dataset.thundyTheme === 'analysis' ? '.card,.inline-toolbar' : '.thundy-surface';
            style.textContent = selector + '{' + css + '}';
        };
        document.__thundyMessageAppearance = apply;
        const port = browser.runtime.connect({name:'thundy-message-appearance'});
        port.onMessage.addListener(theme => {
            if (typeof theme?.css !== 'string') return;
            css = theme.css;
            for (const id of hosts) apply(document.getElementById(id)?.shadowRoot?.querySelector('style[data-thundy-theme]'));
        });
        port.onDisconnect.addListener(() => { delete document.__thundyMessageAppearance; });
    });
}

async function injectTimeOfClickProtection(tabId, filteredUrls, messageId = null) {
    const policy = typeof ThundySecurity !== 'undefined' && (await ThundySecurity.effective()).policy;
    const forced = policy?.enabled === true;
    if (!timeOfClickProtection && !forced) return;
    const labels = { scoreLabel:msg('localScoreLink'), localIncomplete:msg('analysisLocalIncomplete'), localNone:msg('localScoreNoIndicators'), localIndicators:msg('localScoreIndicators'), simple:msg('analysisSimple'), expert:msg('analysisExpert'), approvalMissing:msg('securityApprovalMissing'), approvalExpired:msg('securityExpired'), explanation:msg('analysisScoreExplanation'), incomplete:msg('analysisSimpleIncomplete'), danger:msg('analysisSimpleDanger'), caution:msg('analysisSimpleCaution'), waiting: msg('linkChecking'), proceed: msg('linkProceed'), noDetection: msg('linkNoDetection'), cancel: msg('linkCancel'), title: msg('linkDialogTitle'), destination: msg('linkDestination'), details: msg('linkUrlDetails'), open: msg('linkOpenBrowser'), opening: msg('linkOpening'), failed: msg('linkOpenFailed'), limited: msg('linkCheckLimited'), score: msg('auditLocalScore'), unavailable: msg('auditUnavailable'), decisionScore:msg('auditDecisionScore'), handoffPending:msg('linkHandoffPending'), preflightTimeout:msg('linkPreflightTimeout'), auditFailed: msg('auditFailure'), origins: { live: msg('checkOrigin_live'), stored: msg('checkOrigin_stored'), none: msg('checkOrigin_none') }, outcomes: {incomplete:msg('analysisSimpleIncomplete'), rate_limited:msg('checkOutcome_rate_limited'), invalid_key:msg('checkOutcome_invalid_key'),success: msg('checkOutcome_success'), failed: msg('checkOutcome_failed'), disabled: msg('checkOutcome_disabled'), permission_denied: msg('checkOutcome_permission_denied'), missing_key: msg('checkOutcome_missing_key'), missing_reference: msg('checkOutcome_missing_reference'), not_requested: msg('checkOutcome_not_requested'), no_result: msg('checkOutcome_no_result')}, observed: msg('checkObserved'), attempted: msg('checkAttempted') };
    const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
    labels.decisions = {allow:msg('protectionOpenAllowed'),warn:msg('protectionWarn'),
        approval:msg('protectionApproval'),block:msg('protectionBlocked')};
    labels.causes = {malicious:msg('protectionMalicious'),threshold:msg('protectionThreshold'),
        managedThreshold:msg('protectionManagedThreshold'),unknown:msg('analysisSimpleIncomplete'),
        incomplete:msg('analysisSimpleIncomplete'),context_changed:msg('linkContextChanged'),
        policy_invalid:msg('managedPolicyInvalid')};
    labels.requestApproval = msg('protectionRequestApproval');
    await injectIntoMessageDisplay(tabId, function(labels, displayedId, theme, forced) {
        document.__thundyLinkMessageId = displayedId;
        document.documentElement.dataset.thundyForcedProtection = forced ? 'true' : 'false';
        if (document.documentElement.dataset.thundyClickProtection) return;
        document.documentElement.dataset.thundyClickProtection = 'true';
        let busy = false;
        async function onClick(event) {
            const link = event.target.closest && event.target.closest('a[href]');
            if (!link || !/^https?:/i.test(link.href) || !((event.type === 'click' && event.button === 0) || (event.type === 'auxclick' && event.button === 1) || (event.type === 'contextmenu' && document.documentElement.dataset.thundyForcedProtection==='true'))) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (busy) return;
            busy = true;
            const messageId = document.__thundyLinkMessageId;
            const url = link.href;
            const interactionId = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
            let opening = false, awaitingHandoff = false, checking = false, chooseContextAction;
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
            themeStyle.dataset.thundyTheme = '';
            themeStyle.textContent = '.thundy-surface {' + (theme?.css || '') + '}';
            style.textContent = `
                * { box-sizing:border-box; }
                .dialog { width:520px;max-width:100%;max-height:calc(100vh - 32px);overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#17243a);border:1px solid var(--card-border,#cbd5e1);border-radius:16px;padding:24px;box-shadow:0 20px 70px #0004;font:14px/1.55 system-ui,sans-serif;text-align:left; }
                header { display:flex;align-items:center;gap:12px;margin-bottom:20px; }
                .brand { display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:var(--btn-primary-bg,#075985);color:var(--btn-primary-text,#fff);font-size:22px;font-weight:800; }
                strong { font-size:18px; } h2 { margin:0;font-size:13px;font-weight:400;color:var(--text-muted,#475569); }
                .label { color:var(--text-muted,#475569);font-size:12px;font-weight:600;margin:0 0 4px; }
                .destination { font-size:18px;font-weight:650;overflow-wrap:anywhere;margin:0 0 12px; }
                details { border:1px solid var(--card-border,#cbd5e1);border-radius:8px;padding:10px 12px;margin-bottom:18px; } summary { cursor:pointer; } code { display:block;font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap;margin-top:10px;user-select:text; }
                .result { padding:14px;border-radius:10px;background:var(--accent-soft,#eff6ff);border-left:4px solid var(--link-color,#0369a1);margin:0 0 12px; }
                .danger { background:var(--alert-error-bg,#fff1f2);border-color:var(--color-danger,#be123c);color:var(--color-danger,#881337); } .unknown { background:var(--warning-bg,#fff7ed);border-color:var(--color-warning,#92510d);color:var(--color-warning,#92510d); }
                .note { color:var(--text-muted,#475569);font-size:12px;margin:12px 0; } ul { padding-left:20px;overflow-wrap:anywhere; }
                .error { color:var(--color-danger,#be123c);background:var(--alert-error-bg,#fff1f2);padding:8px;margin:12px 0; } .error:empty { display:none; }
                footer { display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:20px; }
                button { font:600 14px/1.4 system-ui,sans-serif;border:1px solid var(--input-border,#94a3b8);border-radius:8px;padding:10px 16px;min-height:var(--control-size,44px);cursor:pointer;background:var(--card-bg,#fff);color:var(--text-color,#17243a);max-width:100%;overflow-wrap:anywhere; }
                .primary { background:var(--btn-primary-bg,#075985);color:var(--btn-primary-text,#fff); } .warning { background:var(--btn-danger-bg,#9f1239); }
                button:focus-visible,summary:focus-visible { outline:3px solid var(--link-color,#0369a1);outline-offset:3px; } button:disabled { opacity:.6;cursor:wait; }
                @media (forced-colors:active) { .dialog,button { border-color:ButtonText; } button:focus-visible,summary:focus-visible { outline-color:Highlight; } }

            `;
            const card = document.createElement('section'); card.className = 'dialog thundy-surface'; card.tabIndex = -1;
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
            const host = document.createElement('p'); host.className = 'destination'; host.textContent = new URL(url).hostname;
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = labels.details;
            const address = document.createElement('code'); address.textContent = url;
            details.append(summary, address);
            const decisionStatus = document.createElement('div'); decisionStatus.setAttribute('role','status'); decisionStatus.setAttribute('aria-atomic','true');
            const text = document.createElement('p'); text.id = 'thundy-link-result'; text.className = 'result'; text.textContent = labels.waiting;
            const cause = document.createElement('p'); cause.className = 'decision-reason'; cause.hidden = true;
            decisionStatus.append(text,cause);
            const score = document.createElement('p');score.className='note local-score';score.textContent=labels.scoreLabel+': '+labels.unavailable;
            const note = document.createElement('p'); note.className = 'note'; note.textContent = labels.limited;
            const reasons = document.createElement('ul'); reasons.hidden = true;
            const error = document.createElement('p'); error.className = 'error'; error.setAttribute('role', 'alert');
            const footer = document.createElement('footer');
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = labels.cancel;
            const close = (reason = 'cancel') => {
                if (!panel.isConnected || (opening && reason !== 'opened' && reason !== 'context_closed')) return;
                panel.remove(); busy = false; if (link.isConnected) link.focus();
                chooseContextAction?.(false);
                document.defaultView.removeEventListener('pagehide', onPageHide);
                if (checking && reason !== 'opened' && !awaitingHandoff) browser.runtime.sendMessage({ action: 'cancelLinkInteraction', interactionId, url, messageId, reason }).catch(() => {});
            };
            const onPageHide = () => close('context_closed');
            document.defaultView.addEventListener('pagehide', onPageHide);

            cancel.addEventListener('click', () => close('cancel')); footer.appendChild(cancel);
            card.append(decisionStatus, label, host, details, score, reasons, note, error, footer); root.append(themeStyle, style, card); document.body.appendChild(panel);
            // Refresh without delaying security UI if the background is unavailable.
            if (document.__thundyMessageAppearance) document.__thundyMessageAppearance(themeStyle);
            else if (theme) {
                Promise.resolve(browser.runtime.sendMessage({ action: 'getUiTheme' })).then(latest => {
                    if (panel.isConnected && latest && typeof latest.css === 'string') themeStyle.textContent = '.thundy-surface {' + latest.css + '}';
                }).catch(() => {});
            }
            root.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); close('escape'); }
                if (event.key === 'Tab') {
                    const controls = Array.from(root.querySelectorAll('button:not(:disabled),summary'));
                    const index = controls.indexOf(root.activeElement);
                    event.preventDefault();
                    const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length;
                    controls[next].focus();
                }
            });
            cancel.focus();
            if (event.type === 'contextmenu') {
                text.textContent = labels.open;
                const openIntent = document.createElement('button');
                openIntent.type = 'button';
                openIntent.textContent = labels.open;
                const selected = new Promise(resolve => { chooseContextAction = resolve; });
                openIntent.addEventListener('click',() => chooseContextAction(true));
                footer.appendChild(openIntent);
                if (!await selected) return;
                chooseContextAction = null;
                openIntent.remove();
                if (!link.isConnected || link.href !== url) { close('destination_changed'); return; }
                text.textContent = labels.waiting;
                cancel.focus();
            }
            checking = true;
            let result;
            try { result = await browser.runtime.sendMessage({ action: 'checkLinkState', url, messageId, interactionId, userAction: true }); }
            catch (e) { result = { status: 'ERROR' }; }
            if (!panel.isConnected) return;
            if (!link.isConnected || link.href !== url) { close('destination_changed'); return; }
            const malicious = ['MALICIOUS','MALICIOUS_VISUAL'].includes(result?.status);
            const dangerous = malicious || result?.status === 'SUSPICIOUS';
            const noDetection = result?.status === 'CLEAN' && result.check?.outcome === 'success';
            const clean = noDetection && result.check.origin === 'live';
            const local=result?.local||{score:result?.score,state:'unknown',reasons:[]};
            const validScore=typeof local.score==='number'&&Number.isFinite(local.score)&&local.score>=0&&local.score<=100&&local.state!=='failed';
            const uncertain = !clean || !validScore || local.state !== 'checked';
            const protection = result?.protection;
            const mode = protection?.mode || (protection?.required ? 'approval' : dangerous || uncertain || local.score >= 25 ? 'warn' : 'allow');
            function showDecision(mode, rules) {
                const reason = rules?.reason;
                const provider = result?.provider && result.provider !== 'none' ? result.provider : '';
                const providers = [...new Set([...(rules?.providers || []),...(malicious && provider ? [provider] : [])])];
                const threshold = rules?.managed ? labels.causes.managedThreshold : labels.causes.threshold;
                let why;
                if (reason === 'threshold') {
                    why = [threshold+(Number.isFinite(rules.threshold) ? ' · '+rules.threshold+' / 100' : ''),
                        Number.isFinite(rules.score) ? labels.decisionScore+' '+rules.score+' / 100' : ''].filter(Boolean).join(' · ');
                } else if (reason === 'malicious' || !reason && malicious) {
                    why = [labels.causes.malicious,...providers].join(' · ');
                } else {
                    why = labels.causes[reason] || (dangerous ? [labels.caution,provider].filter(Boolean).join(' · ') :
                        mode === 'allow' && noDetection ? [labels.noDetection,provider,labels.origins[result.check.origin]].filter(Boolean).join(' · ') :
                        uncertain ? labels.incomplete : validScore && local.score > 0 ? labels.localIndicators : labels.localNone);
                }
                text.className = 'result ' + (mode === 'block' || malicious ? 'danger' : mode !== 'allow' ? 'unknown' : '');
                text.textContent = labels.decisions[mode] || labels.decisions.warn;
                cause.textContent = why;
                cause.hidden = !why;
            }
            showDecision(mode,protection);
            score.textContent=labels.scoreLabel+': '+(validScore?local.score+' / 100':labels.unavailable);
            if(validScore&&local.state==='incomplete'){const limited=document.createElement('p');limited.className='note';limited.textContent=labels.localIncomplete;card.insertBefore(limited,note);}
            const displayedReasons=[...(Array.isArray(local.reasons)?local.reasons.map(text=>({text,source:'local'})):[]),...[...new Set([...(local.providerReasons||[]),...(Array.isArray(result?.reasons)?result.reasons:[])])].map(text=>({text,source:'provider'}))];
            if (displayedReasons.length) {
                for (const [index,reason] of displayedReasons.entries()) { const item = document.createElement('li'); item.textContent = String(reason.text);item.dataset.source=reason.source; if(index>=3){item.dataset.expert='true';item.hidden=true;} reasons.appendChild(item); }
                reasons.hidden = !reasons.childElementCount;
            }
            if (result && (result.errorDetails || result.check?.error)) {
                const errItem = document.createElement('li');
                errItem.dataset.expert='true';errItem.hidden=true;
                errItem.textContent = String(result.errorDetails || result.check.error);
                reasons.appendChild(errItem);
                reasons.hidden = false;
            }
            if (Number.isFinite(local.decisionScore)) {
                const decision=document.createElement('p');decision.className='note';decision.dataset.expert='true';decision.hidden=true;
                decision.textContent=labels.decisionScore+' · '+local.decisionScore+' / 100';
                card.insertBefore(decision,note);
            }
            if(result?.check?.outcome && result.check.outcome!=='success') {
                const pending=document.createElement('p');pending.className='note';
                pending.textContent=labels.outcomes[result.check.outcome]||labels.incomplete;
                card.insertBefore(pending,note);
            }
            if (result?.check) {
                const provenance = document.createElement('p'); provenance.className = 'note';provenance.dataset.expert='true';provenance.hidden=true;
                const date = value => value == null ? labels.unavailable : new Date(value).toLocaleString();
                provenance.textContent = (labels.origins[result.check.origin] || labels.unavailable) + ' · ' + (labels.outcomes[result.check.outcome] || labels.unavailable) + ' · ' + labels.attempted + ': ' + date(result.check.attemptedAt) + ' · ' + labels.observed + ': ' + date(result.check.observedAt);
                card.insertBefore(provenance, note);
            }
            if (result && result.auditSaved === false) { const auditNotice = document.createElement('p'); auditNotice.className = 'error'; auditNotice.textContent = labels.auditFailed; card.insertBefore(auditNotice, footer); }
            const explanation=document.createElement('p');explanation.textContent=labels.explanation;card.insertBefore(explanation,footer);
            const view=document.createElement('button');view.type='button';view.textContent=labels.expert;let expert=false;view.addEventListener('click',()=>{expert=!expert;view.textContent=expert?labels.simple:labels.expert;for(const node of root.querySelectorAll('[data-expert]'))node.hidden=!expert;});card.append(view);
            if (mode === 'block') return;
            const proceed = document.createElement('button'); proceed.type = 'button'; proceed.className = 'primary' + (dangerous ? ' warning' : '');
            const buttonLabel = mode === 'approval' ? labels.requestApproval : mode === 'allow' ? labels.open : labels.proceed;
            proceed.textContent = buttonLabel;
            proceed.addEventListener('click', async () => {
                if (opening || !panel.isConnected) return;
                if (!link.isConnected || link.href !== url) { close('destination_changed'); return; }
                opening = true; cancel.disabled = true; proceed.disabled = true; proceed.setAttribute('aria-busy', 'true'); proceed.textContent = labels.opening; error.textContent = '';
                // Disabled buttons can lose focus before the asynchronous handoff finishes.
                card.focus();
                // Keep the dialog on failure, so the user can retry or cancel.
                try {
                    let opened = await browser.runtime.sendMessage({ action: 'openCheckedLink', url, messageId, interactionId });
                    if (opened?.code === 'APPROVAL_REQUIRED') {
                        opened = await browser.runtime.sendMessage({action:'startLinkApproval',url,messageId,interactionId});
                        if (opened?.success) {
                            opening=false;cancel.disabled=false;proceed.disabled=false;
                            proceed.removeAttribute('aria-busy');proceed.textContent=buttonLabel;return;
                        }
                    }
                    if (opened?.code === 'APPROVAL_NOT_CONFIGURED') {
                        error.textContent=labels.approvalMissing;opening=false;cancel.disabled=false;proceed.hidden=true;cancel.focus();return;
                    }
                    if (['LINK_POLICY_BLOCKED','POLICY_INVALID'].includes(opened?.code)) {
                        showDecision('block',opened.protection || {reason:opened.code==='POLICY_INVALID'?'policy_invalid':'context_changed'});
                        opening=false;cancel.disabled=false;proceed.hidden=true;cancel.focus();return;
                    }
                    if (opened?.code === 'LINK_HANDOFF_PENDING') {
                        error.textContent=labels.handoffPending;opening=false;awaitingHandoff=true;cancel.disabled=false;
                        proceed.hidden=true;cancel.focus();return;
                    }
                    if (['LINK_PREFLIGHT_TIMEOUT','LINK_CONTEXT_CHANGED','MESSAGE_CONTEXT_CHANGED','APPROVAL_CHANGED','LINK_CHECK_REQUIRED'].includes(opened?.code)) {
                        error.textContent=opened.code==='LINK_PREFLIGHT_TIMEOUT'?labels.preflightTimeout:labels.approvalExpired;
                        opening=false;cancel.disabled=false;
                        proceed.hidden=true;cancel.focus();return;
                    }
                    if (opened && opened.success) { close('opened'); return; }
                } catch (e) { /* show the localized error below */ }
                opening = false; cancel.disabled = false; proceed.disabled = false; proceed.removeAttribute('aria-busy'); proceed.textContent = buttonLabel; error.textContent = labels.failed;
                if (!root.activeElement || root.activeElement === card) proceed.focus();
            });
            footer.appendChild(proceed); cancel.focus();
        }
        document.addEventListener('click', onClick, true);
        document.addEventListener('auxclick', onClick, true);
        document.addEventListener('contextmenu', onClick, true);
        document.addEventListener('dragstart',event=>{if(document.documentElement.dataset.thundyForcedProtection==='true' && event.target.closest?.('a[href]'))event.preventDefault();},true);
    }, [labels, messageId, theme, forced]);
    await bindMessageAppearance(tabId);
}

async function injectThreatBanner(tabId, threat) {
    {
        const theme = typeof ThundyTheme !== 'undefined' ? await ThundyTheme.snapshot() : null;
        await injectIntoMessageDisplay(tabId, function(score, reasons, authStatus, localized, theme, assessment) {
                if (assessment) {
                    const currentMessage=document.documentElement.dataset.thundyAnalysisMessage;
                    if(currentMessage && currentMessage!==String(assessment.messageId))return;
                    const previous=document.__thundyLocalAssessment;
                    const retired=previous?.retired || [];
                    if(retired.includes(assessment.runtimeId))return;
                    if(previous?.messageId===assessment.messageId && previous.runtimeId===assessment.runtimeId && previous.revision>=assessment.revision)return;
                    if(previous && previous.runtimeId!==assessment.runtimeId)retired.push(previous.runtimeId);
                    document.__thundyLocalAssessment={...assessment,retired};
                }
                document.getElementById('thundy-threat-banner')?.remove();
                document.getElementById('thundy-auth-badge')?.remove();
                const t = (key, fallback, subs) => {
                    try {
                        return localized[key] || browser.i18n.getMessage(key, subs) || fallback;
                    } catch (e) {
                        return fallback;
                    }
                };
                if (score >= 50 || authStatus === 'pass') {
                    const host = document.createElement('div');
                    host.id = score >= 50 ? 'thundy-threat-banner' : 'thundy-auth-badge';
                    host.style.cssText = 'all:initial!important;display:block!important;';
                    const root = host.attachShadow({mode:'open'});
                    const palette = document.createElement('style');
                    palette.dataset.thundyTheme = '';
                    palette.textContent = '.thundy-surface {' + (theme?.css || '') + '}';
                    root.append(palette);
                    document.body.prepend(host);
                    document.__thundyMessageAppearance?.(palette);
                }
                if (score >= 50) {
                    // Sichere DOM-Manipulation ohne innerHTML
                    const banner = document.createElement('div');
                    banner.className = 'thundy-surface';
                    banner.style.cssText = 'background:var(--alert-error-bg,#fff1f2);border:1px solid var(--color-danger,#be123c);border-left:4px solid var(--color-danger,#be123c);color:var(--color-danger,#881337);padding:16px;margin:12px;border-radius:12px;font:14px/1.55 system-ui,sans-serif;overflow-wrap:anywhere;';

                    const title = document.createElement('div');
                    title.textContent = '⚠ ' + t('bannerThreatTitle', 'Thundy AV warning') +
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

                    document.getElementById('thundy-threat-banner').shadowRoot.append(banner);
                } else if (authStatus === 'pass') {
                    const badge = document.createElement('div');
                    badge.className = 'thundy-surface';
                    badge.style.display = 'inline-block';
                    badge.style.backgroundColor = 'var(--success-bg,#e6ffe6)';
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

                    document.getElementById('thundy-auth-badge').shadowRoot.append(badge);
                }
        }, [threat.score, threat.reasons, threat.authStatus, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key, key === 'bannerThreatScore' ? [String(threat.score)] : [])])), theme, threat.assessment || null]);
        await bindMessageAppearance(tabId);
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

        const host = document.createElement('div');
        host.id = 'thundy-optin-banner';
        host.style.cssText = 'all:initial!important;display:block!important;';
        const root = host.attachShadow({mode:'open'});
        const palette = document.createElement('style');
        palette.dataset.thundyTheme = '';
        palette.textContent = '.thundy-surface {' + (theme?.css || '') + '}';
        const focus = document.createElement('style');
        focus.textContent = 'button:focus-visible {outline:3px solid var(--link-color,#0369a1);outline-offset:3px} @media (forced-colors:active) {button:focus-visible {outline-color:Highlight}}';
        const banner = document.createElement('div');
        banner.className = 'thundy-surface';
        banner.style.cssText = 'background:var(--card-bg,#f0f7ff);border:1px solid var(--card-border,#bfd6ee);border-left:4px solid var(--link-color,#075985);color:var(--text-color,#17243a);padding:16px;margin:12px;border-radius:12px;font:14px/1.55 system-ui,sans-serif;overflow-wrap:anywhere;';

        const text = document.createElement('p');
        text.style.cssText = 'margin:0 0 12px;font-weight:600;';
        text.textContent = t('bannerTitleOptIn', 'Thundy AV: real-time scanning is not enabled for this message.');
        banner.appendChild(text);

        const createButton = (label, persist) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = label;
          btn.style.cssText = 'margin:0 8px 8px 0;padding:9px 13px;border:1px solid var(--input-border,#627891);border-radius:8px;background:var(--btn-primary-bg,#075985);color:var(--btn-primary-text,#fff);font:600 13px/1.4 system-ui,sans-serif;cursor:pointer;';
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
                setNote(t('bannerConsentMissing', 'New external requests are disabled. Previously stored reports may still be shown.'));
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
          note.textContent = t('bannerConsentMissing', 'New external requests are disabled. Previously stored reports may still be shown.');
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

        root.append(palette,focus,banner);
        document.body.prepend(host);
        document.__thundyMessageAppearance?.(palette);
  }, [messageId, senderEmail, consentGiven === true, Object.fromEntries(Object.keys(I18N_FALLBACKS).map(key => [key, msg(key)])), theme]);
  await bindMessageAppearance(tabId);
}
