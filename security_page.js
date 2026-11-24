/* No secret is ever returned to the email document. Background opens the link. */
(async () => {
    if (ThundyI18n.ready) await ThundyI18n.ready;
    const challenge=new URL(location.href).searchParams.get('approval');
    const t=key=>ThundyI18n.get(key),status=document.getElementById('status'),form=document.getElementById('approvalForm');
    const send=async(op,extra={})=>{const result=await browser.runtime.sendMessage({action:'linkApprovalCommand',op,challenge,...extra});if(!result?.success&&result?.code)throw Error(result.code);return result;};
    const score = value => Number.isFinite(value) && value>=0 && value<=100 ? value+'/100' : t('analysisUnknown');
    const finish = key => {form.hidden=true;status.textContent=t(key);status.focus();};
    status.textContent=t('linkChecking');
    send('status').then(result=>{
        if (!result?.url) throw Error('APPROVAL_EXPIRED');
        document.getElementById('destination').textContent=result.url;
        document.getElementById('approvalScore').textContent=score(result.score);
        document.getElementById('approvalLocalScore').textContent=score(result.heuristicScore);
        document.getElementById('approvalEvidence').hidden=false;
        status.textContent='';
        form.hidden=false;
    }).catch(()=>finish('securityExpired'));
    form.addEventListener('submit',async event=>{
        event.preventDefault();const button=form.querySelector('button');button.disabled=true;
        const input=document.getElementById('password');const password=input.value;input.value='';
        try{const result=await send('approve',{password,confirmed:document.getElementById('confirmed').checked});if(!result?.success)throw Error('OPEN_FAILED');finish('securityOpened');}
        catch(error){
            const terminal = {
                LINK_HANDOFF_PENDING:'linkHandoffPending',LINK_PREFLIGHT_TIMEOUT:'linkPreflightTimeout',
                LINK_CONTEXT_CHANGED:'securityExpired',MESSAGE_CONTEXT_CHANGED:'securityExpired',
                APPROVAL_CHANGED:'securityExpired',APPROVAL_EXPIRED:'securityExpired',
                APPROVAL_NOT_CONFIGURED:'securityApprovalMissing'
            }[error.message];
            if (terminal) finish(terminal);
            else {
                status.textContent=t(error.message==='PASSWORD_WAIT'?'securityWait':'securityApprovalFailed');
                button.disabled=false;
                input.focus();
            }
        }
    });
})();
