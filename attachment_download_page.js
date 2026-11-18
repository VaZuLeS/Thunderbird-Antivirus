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
        APPROVAL_NOT_CONFIGURED:'securityApprovalMissing',
        PASSWORD_WAIT:'securityWait',
        PASSWORD_INVALID:'securityApprovalFailed',
        REPORT_UNAVAILABLE:'hybridReportUnavailable'
    };
    const form = get('attachmentSaveForm'), cancel = get('attachmentCancel'), status = get('attachmentStatus');
    const report = get('attachmentReport'), password = get('attachmentPassword'), submit = get('attachmentConfirm');
    let busy = false;
    const send = (op,extra) => browser.runtime.sendMessage({action:'attachmentDownloadCommand',op,challenge,...extra});
    function render(details) {
        get('attachmentDecision').hidden = false;
        get('attachmentName').textContent = details.name;
        get('attachmentScore').textContent = details.score === null ? t('analysisUnknown') : details.score+' / 100';
        get('attachmentThreshold').textContent = details.threshold+' / 100';
        get('attachmentState').textContent = t('hybridReportProcessing_'+(details.currentState ?? details.state));
        const provenance=get('attachmentProvenance');
        provenance.hidden=!details.source;
        if (details.source) {
            provenance.textContent=[t(details.source==='archive'?'attachmentArchivedFinding':'attachmentCurrentFinding'),
                Number.isFinite(details.observedAt) ? new Date(details.observedAt).toLocaleString(document.documentElement.lang) : t('analysisTimeUnknown')].join(' · ');
        }
        const reasons = {threshold:'attachmentThresholdReached',malicious:'attachmentMalicious',unknown:'attachmentUnknown'};
        const state = details.mode === 'block' ? 'attachmentBlocked' :
            details.mode === 'approval' ? details.approvalConfigured ? 'attachmentNeedsApproval' : 'securityApprovalMissing' : null;
        get('attachmentReason').textContent = [reasons[details.reason],state].filter(Boolean).map(t).join(' · ');
        const approval = details.mode === 'approval';
        form.hidden = details.mode === 'block' || approval && !details.approvalConfigured;
        get('attachmentPasswordLabel').hidden = !approval;
        password.required = approval;
        report.hidden = !details.report;
    }
    function finish(key) {
        form.hidden = report.hidden = cancel.hidden = true;
        status.textContent = t(key);
        status.focus();
    }
    async function run(op, extra) {
        if (busy) return;
        busy = submit.disabled = report.disabled = cancel.disabled = true;
        try {
            const result = await send(op,extra);
            if (result?.details) {
                render(result.details);
                if (result.changed) status.textContent = t('attachmentDecisionChanged');
                cancel.disabled = false;
                cancel.focus();
            } else if (result?.saved) finish('attachmentSaveRequested');
            else if (op === 'cancel') finish('attachmentSaveCancelled');
            else if (!result?.success) {
                if (['ATTACHMENT_CONTEXT_CHANGED','ATTACHMENT_DIALOG_EXPIRED','ATTACHMENT_READ_FAILED'].includes(result?.code)) finish(names[result.code]);
                else status.textContent = t(names[result?.code] || 'attachmentFailed');
            }
        } catch (_) {finish('attachmentFailed');}
        finally {busy = submit.disabled = report.disabled = cancel.disabled = false;}
    }
    form.addEventListener('submit',event => {
        event.preventDefault();
        const value = password.value;
        password.value = '';
        void run('save',{password:value});
    });
    report.addEventListener('click',() => run('report'));
    cancel.addEventListener('click',() => run('cancel'));
    document.addEventListener('keydown',event => {
        if (event.key === 'Escape' && !cancel.hidden) void run('cancel');
    });
    void run('status');
})();
