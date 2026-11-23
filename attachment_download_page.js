(() => {
    const t = key => ThundyI18n.get(key);
    const get = id => document.getElementById(id);
    const challenge = location.hash.slice(1);
    const names = {
        ATTACHMENT_CONTEXT_CHANGED:'attachmentContextChanged',
        ATTACHMENT_DIALOG_EXPIRED:'securityExpired',
        ATTACHMENT_READ_FAILED:'attachmentReadFailed',
        ATTACHMENT_CHECK_TIMEOUT:'scanFailure_timeout',
        ATTACHMENT_BLOCKED:'attachmentBlocked',
        ATTACHMENT_OPEN_FAILED:'attachmentOpenFailed',
        APPROVAL_NOT_CONFIGURED:'securityApprovalMissing',
        PASSWORD_WAIT:'securityWait',
        PASSWORD_INVALID:'securityApprovalFailed',
        REPORT_UNAVAILABLE:'hybridReportUnavailable'
    };
    const form = get('attachmentSaveForm'), cancel = get('attachmentCancel'), status = get('attachmentStatus');
    const report = get('attachmentReport'), password = get('attachmentPassword'), submit = get('attachmentConfirm');
    const refresh = get('attachmentRefresh');
    let busy = false;
    let operation = 'save';
    const send = (op,extra) => browser.runtime.sendMessage({action:'attachmentDownloadCommand',op,challenge,...extra});
    function render(details) {
        operation = details.operation || 'save';
        if (operation === 'open') {
            get('attachmentScope').textContent = t('attachmentOpenScope');
            submit.textContent = t('attachmentConfirmOpen');
        }
        get('attachmentDecision').hidden = false;
        const action = t(operation === 'open' ? 'attachmentConfirmOpen' : 'attachmentConfirmSave');
        get('attachmentAction').textContent = action;
        get('attachmentName').textContent = details.name;
        get('attachmentScore').textContent = !Number.isFinite(details.score) ? t('auditUnavailable') : details.score+' / 100';
        get('attachmentThreshold').textContent = !Number.isFinite(details.threshold) ? t('auditUnavailable') : details.threshold+' / 100';
        get('attachmentState').textContent = t('hybridReportProcessing_'+(details.currentState ?? details.state));
        const provenance=get('attachmentProvenance');
        provenance.hidden=!details.source;
        if (details.source) {
            provenance.textContent=[t(details.source==='archive'?'attachmentArchivedFinding':'attachmentCurrentFinding'),
                Number.isFinite(details.observedAt) ? new Date(details.observedAt).toLocaleString(document.documentElement.lang) : t('analysisTimeUnknown')].join(' · ');
        }
        const headings = {allow:operation === 'open' ? 'protectionOpenAllowed' : 'protectionSaveAllowed',
            warn:'protectionWarn',approval:'protectionApproval',block:'protectionBlocked'};
        const title = get('attachmentDecisionTitle');
        title.textContent = t(headings[details.mode]);
        title.className = 'protection-decision '+details.mode;
        const reasons = {malicious:'protectionMalicious',unknown:'analysisSimpleIncomplete',policy_invalid:'managedPolicyInvalid'};
        let reason = reasons[details.reason] ? t(reasons[details.reason]) : t('protectionAttachmentAllowedReason');
        if (details.reason === 'malicious') {
            reason = [reason,...(details.maliciousProviders || [])].join(' · ');
        } else if (details.reason === 'threshold') {
            reason = [t(details.managed ? 'protectionManagedThreshold' : 'protectionThreshold')+' · '+details.threshold+' / 100',
                'Hybrid Analysis '+details.score+' / 100'].join(' · ');
        }
        if (details.mode === 'approval' && !details.approvalConfigured) reason += ' · '+t('securityApprovalMissing');
        get('attachmentReason').textContent = reason;
        const approval = details.mode === 'approval';
        form.hidden = details.mode === 'block' || approval && !details.approvalConfigured;
        get('attachmentPasswordLabel').hidden = !approval;
        password.required = approval;
        report.hidden = !details.report;
        refresh.hidden = false;
    }
    function finish(key) {
        form.hidden = report.hidden = refresh.hidden = cancel.hidden = true;
        status.textContent = t(key);
        status.focus();
    }
    async function run(op, extra) {
        if (busy) return;
        busy = submit.disabled = report.disabled = refresh.disabled = cancel.disabled = true;
        try {
            const result = await send(op,extra);
            if (result?.details) {
                render(result.details);
                if (result.changed) status.textContent = t('attachmentDecisionChanged');
                else if (op === 'refresh') status.textContent = t('attachmentFindingUnchanged');
                const nextFocus = op === 'refresh' ? refresh : cancel;
                nextFocus.disabled = false;
                nextFocus.focus();
            } else if (result?.saved || result?.opened) finish(result.opened ? 'attachmentOpenRequested' : 'attachmentSaveRequested');
            else if (op === 'cancel') finish(operation === 'open' ? 'linkCancel' : 'attachmentSaveCancelled');
            else if (!result?.success) {
                if (['ATTACHMENT_CONTEXT_CHANGED','ATTACHMENT_DIALOG_EXPIRED','ATTACHMENT_READ_FAILED'].includes(result?.code)) finish(names[result.code]);
                else status.textContent = t(names[result?.code] || 'attachmentFailed');
            }
        } catch (_) {finish('attachmentFailed');}
        finally {busy = submit.disabled = report.disabled = refresh.disabled = cancel.disabled = false;}
    }
    form.addEventListener('submit',event => {
        event.preventDefault();
        const value = password.value;
        password.value = '';
        void run('save',{password:value});
    });
    report.addEventListener('click',() => run('report'));
    refresh.addEventListener('click',() => run('refresh'));
    cancel.addEventListener('click',() => run('cancel'));
    document.addEventListener('keydown',event => {
        if (event.key === 'Escape' && !cancel.hidden) void run('cancel');
    });
    void run('status');
})();
