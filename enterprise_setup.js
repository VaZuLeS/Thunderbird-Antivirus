// Only local preferences and explicit file exports. No fetch or provider calls.
document.addEventListener('DOMContentLoaded', async () => {
    const $ = id => document.getElementById(id), t = key => ThundyI18n.get(key);
    const controls = { hosting:'profileHosting',sso:'profileSso',devices:'profileDevices',siem:'profileSiem',tickets:'profileTickets' };
    let draft;
    for(const [category,id] of Object.entries(controls)) {
        for(const profile of ThundyEnterpriseProfiles.categories[category]) {
            const option=document.createElement('option');option.value=profile.id;
            option.textContent=profile.id==='none'?t('profilesNone'):profile.id==='local-development'?t('profilesLocal'):profile.id==='self-hosted'?t('profilesSelfHosted'):profile.label;
            $(id).appendChild(option);
        }
    }
    function setSelection(selection) { for(const [category,id] of Object.entries(controls)) $(id).value=selection[category]; }
    const selection = () => Object.fromEntries(Object.entries(controls).map(([category,id])=>[category,$(id).value]));
    function render() {
        try {
            draft=ThundyEnterpriseProfiles.buildDraft(selection());
            $('profilePreview').textContent=JSON.stringify(draft,null,2);$('profileRequirements').replaceChildren();
            const requirements=[...draft.readiness.requiredSettings,...draft.readiness.secretReferences.map(item=>item.category+': '+item.reference)];
            if(!requirements.length) requirements.push(t('profilesNoExternalSettings'));
            for(const requirement of requirements) { const item=document.createElement('li');item.textContent=requirement;$('profileRequirements').appendChild(item); }
            $('profileExport').disabled=false;$('profileSave').disabled=false;
        } catch(error) { draft=null;$('profileExport').disabled=true;$('profileSave').disabled=true;$('profileStatus').textContent=t('profilesFailed'); }
    }
    $('profileForm').addEventListener('submit',event=>event.preventDefault());
    $('profileBundle').addEventListener('change',()=>{
        const bundle=ThundyEnterpriseProfiles.bundles[$('profileBundle').value];if(bundle)setSelection(bundle);render();
    });
    for(const id of Object.values(controls)) $(id).addEventListener('change',()=>{ $('profileBundle').value='custom';render(); });
    $('profileSave').addEventListener('click',async()=>{
        if(!draft)return;
        try { await browser.storage.local.set({enterpriseProfileSelection:selection()});$('profileStatus').textContent=t('profilesSaved'); }
        catch(error){$('profileStatus').textContent=t('profilesFailed');}
    });
    $('profileExport').addEventListener('click',async()=>{
        if(!draft)return;
        try {
            const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
            try { await browser.downloads.download({url,filename:'thundy-enterprise-profile.json',saveAs:true}); }
            finally {URL.revokeObjectURL(url);}
            $('profileStatus').textContent=t('profilesExported');
        } catch(error){$('profileStatus').textContent=t('profilesFailed');}
    });
    $('profileReset').addEventListener('click',async()=>{
        setSelection(ThundyEnterpriseProfiles.bundles.local);$('profileBundle').value='local';render();
        try {await browser.storage.local.remove('enterpriseProfileSelection');$('profileStatus').textContent=t('profilesSaved');}
        catch(error){$('profileStatus').textContent=t('profilesFailed');}
    });
    setSelection(ThundyEnterpriseProfiles.bundles.local);
    try {
        const stored=await browser.storage.local.get('enterpriseProfileSelection');
        if(stored.enterpriseProfileSelection){setSelection(ThundyEnterpriseProfiles.normalizeSelection(stored.enterpriseProfileSelection));$('profileBundle').value='custom';}
    } catch(error){$('profileStatus').textContent=t('profilesFailed');}
    render();
});
