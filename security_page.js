/* No secret is ever returned to the email document. Background opens the link. */
(() => {
    const challenge=new URL(location.href).searchParams.get('approval');
    const t=key=>ThundyI18n.get(key),status=document.getElementById('status'),form=document.getElementById('approvalForm');
    const send=async(op,extra={})=>{const result=await browser.runtime.sendMessage({action:'linkApprovalCommand',op,challenge,...extra});if(!result?.success&&result?.code)throw Error(result.code);return result;};
    send('status').then(result=>{document.getElementById('destination').textContent=result.url;document.getElementById('approvalScore').textContent=Number.isFinite(result.score)&&result.score>=0&&result.score<=100?String(result.score)+'/100':t('analysisUnknown');}).catch(()=>{form.hidden=true;status.textContent=t('securityExpired');status.focus();});
    form.addEventListener('submit',async event=>{
        event.preventDefault();const button=form.querySelector('button');button.disabled=true;
        const input=document.getElementById('password');const password=input.value;input.value='';
        try{const result=await send('approve',{password,confirmed:document.getElementById('confirmed').checked});if(!result?.success)throw Error('OPEN_FAILED');form.hidden=true;status.textContent=t('securityOpened');status.focus();}
        catch(_){status.textContent=t('securityApprovalFailed');button.disabled=false;}
    });
})();
