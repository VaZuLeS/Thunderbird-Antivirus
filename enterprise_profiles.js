// Optional configuration profiles. No client, connection or deployment is activated.
(function(root) {
    'use strict';
    const profile = (id, label, protocol, requiredSettings = [], secretRefs = [], components = []) => ({ id, label, protocol, requiredSettings, secretRefs, components, implementation: 'configuration-profile' });
    const categories = {
        hosting: [
            profile('local-development','Local development','loopback-development',[],[],['Node.js','PostgreSQL','Development storage']),
            profile('self-hosted','Self-hosted / on-premises','self-hosted',['region','serviceOrigin','postgresEndpoint','objectLockStorage','keyManagement'],['POSTGRES_PASSWORD'],['Node.js','PostgreSQL','S3-compatible Object Lock']),
            profile('azure','Microsoft Azure','azure',['region','serviceOrigin','resourceGroup','postgresEndpoint','storageAccount','keyVault'],[],['Container Apps','Azure Database for PostgreSQL','Blob immutable storage','Key Vault']),
            profile('aws','Amazon Web Services','aws',['region','serviceOrigin','postgresEndpoint','s3Bucket','kmsKey'],[],['ECS / Fargate','RDS PostgreSQL','S3 Object Lock','KMS']),
            profile('gcp','Google Cloud','gcp',['region','serviceOrigin','projectId','postgresEndpoint','storageBucket','kmsKey'],[],['Cloud Run','Cloud SQL PostgreSQL','Cloud Storage Bucket Lock','Cloud KMS']),
        ],
        sso: [
            profile('none',null,'disabled'),
            profile('entra-id','Microsoft Entra ID','oidc-code-pkce',['tenantId','clientId','redirectUri','groupRoleMapping','mfaMapping'],['OIDC_CLIENT_SECRET']),
            profile('keycloak','Keycloak','oidc-code-pkce',['issuerUrl','realm','clientId','redirectUri','groupRoleMapping','mfaMapping'],['OIDC_CLIENT_SECRET']),
            profile('okta','Okta','oidc-code-pkce',['issuerUrl','clientId','redirectUri','groupRoleMapping','mfaMapping'],['OIDC_CLIENT_SECRET']),
            profile('generic-oidc','OpenID Connect','oidc-code-pkce',['issuerUrl','clientId','redirectUri','groupRoleMapping','mfaMapping'],['OIDC_CLIENT_SECRET']),
        ],
        devices: [
            profile('none',null,'disabled'),
            profile('intune','Microsoft Intune','managed-package',['organizationId','installerPackage','deploymentGroup'],[],['Windows / macOS','Signed broker package']),
            profile('jamf','Jamf Pro','managed-package',['organizationId','installerPackage','deploymentGroup'],[],['macOS','Signed broker package']),
            profile('ansible','Ansible','managed-package',['organizationId','inventoryReference','installerPackage'],[],['Linux / Windows / macOS','OS-specific installer']),
            profile('generic-mdm','MDM / package distribution','managed-package',['organizationId','installerPackage','deploymentGroup']),
        ],
        siem: [
            profile('none',null,'disabled'),
            profile('splunk','Splunk','splunk-hec',['httpsEndpoint','sourceType','index'],['SPLUNK_HEC_TOKEN']),
            profile('sentinel','Microsoft Sentinel','azure-monitor-logs',['logIngestionEndpoint','dataCollectionRuleId','streamName','tenantId','clientId'],['AZURE_MONITOR_CLIENT_SECRET']),
            profile('elastic','Elastic Security / Elasticsearch','elasticsearch-bulk',['httpsEndpoint','indexOrDataStream'],['ELASTIC_API_KEY']),
            profile('generic-https','HTTPS JSON','https-json',['httpsEndpoint','authenticationMethod'],['SIEM_AUTH_CREDENTIAL']),
        ],
        tickets: [
            profile('none',null,'disabled'),
            profile('jira-cloud','Atlassian Jira Cloud','jira-rest-v3',['cloudId','projectKey','issueTypeId','oauthClientId'],['JIRA_OAUTH_CREDENTIAL']),
            profile('jira-data-center','Atlassian Jira Data Center','jira-rest-v2',['httpsBaseUrl','projectKey','issueTypeId'],['JIRA_PAT']),
            profile('servicenow','ServiceNow','servicenow-table',['httpsBaseUrl','oauthClientId'],['SERVICENOW_OAUTH_CREDENTIAL']),
            profile('gitlab','GitLab Issues','gitlab-rest-v4',['httpsBaseUrl','projectId'],['GITLAB_API_TOKEN']),
        ],
    };
    const bundles = {
        local: { hosting:'local-development',sso:'none',devices:'none',siem:'none',tickets:'none' },
        microsoft: { hosting:'azure',sso:'entra-id',devices:'intune',siem:'sentinel',tickets:'servicenow' },
        openSource: { hosting:'self-hosted',sso:'keycloak',devices:'ansible',siem:'elastic',tickets:'gitlab' },
        cloud: { hosting:'aws',sso:'okta',devices:'generic-mdm',siem:'splunk',tickets:'jira-cloud' },
    };
    function freeze(value) { if(value && typeof value === 'object') { Object.values(value).forEach(freeze);Object.freeze(value); } return value; }
    freeze(categories); freeze(bundles);
    function normalizeSelection(input = {}) {
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('PROFILE_SELECTION_INVALID');
        const keys = Object.keys(input);
        if (keys.some(key => !Object.hasOwn(categories,key))) throw new Error('PROFILE_SELECTION_INVALID');
        const output = {};
        for(const category of Object.keys(categories)) {
            const id = Object.hasOwn(input,category) ? input[category] : bundles.local[category];
            if(typeof id !== 'string' || !categories[category].some(item=>item.id===id)) throw new Error('PROFILE_SELECTION_INVALID');
            output[category]=id;
        }
        return output;
    }
    function buildDraft(input = {}) {
        const selection = normalizeSelection(input), integrations = {}, requiredSettings=[], secretReferences=[];
        for(const category of Object.keys(categories)) {
            const chosen = categories[category].find(item=>item.id===selection[category]);
            const requested = chosen.protocol !== 'disabled';
            integrations[category] = { profileId:chosen.id,protocol:chosen.protocol,requested,enabled:false,implementation:chosen.implementation,settings:{},components:[...chosen.components] };
            for(const setting of chosen.requiredSettings) requiredSettings.push(category+'.'+setting);
            for(const reference of chosen.secretRefs) secretReferences.push({ category,reference });
        }
        return {
            schemaVersion:1,kind:'thundy-enterprise-profile-draft',mode:'disabled',selection,integrations,
            privacy:{ urlMode:'domain_only',identityResolutionEnabled:false,automaticTransmission:false },
            readiness:{ state:'draft',deployment:'not_deployed',integrationAcceptance:'pending',requiredSettings,secretReferences,approvalRequired:true },
        };
    }
    const api=freeze({categories,bundles,normalizeSelection,buildDraft});
    if(typeof module==='object' && module.exports) module.exports=api;
    else root.ThundyEnterpriseProfiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);
