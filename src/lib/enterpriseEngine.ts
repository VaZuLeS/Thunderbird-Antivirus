// Port of enterprise_profiles.js for enterprise profiles and verification drafts
import { EnterpriseCategories, EnterpriseProfileItem, EnterpriseSelection } from '../types';

const profile = (
  id: string,
  label: string | null,
  protocol: string,
  requiredSettings: string[] = [],
  secretRefs: string[] = [],
  components: string[] = []
): EnterpriseProfileItem => ({
  id,
  label,
  protocol,
  requiredSettings,
  secretRefs,
  components,
  implementation: 'configuration-profile'
});

export const ENTERPRISE_CATEGORIES: EnterpriseCategories = {
  hosting: [
    profile('local-development', 'Local development', 'loopback-development', [], [], ['Node.js', 'PostgreSQL', 'Development storage']),
    profile('self-hosted', 'Self-hosted / on-premises', 'self-hosted', ['region', 'serviceOrigin', 'postgresEndpoint', 'objectLockStorage', 'keyManagement'], ['POSTGRES_PASSWORD'], ['Node.js', 'PostgreSQL', 'S3-compatible Object Lock']),
    profile('azure', 'Microsoft Azure', 'azure', ['region', 'serviceOrigin', 'resourceGroup', 'postgresEndpoint', 'storageAccount', 'keyVault'], [], ['Container Apps', 'Azure Database for PostgreSQL', 'Blob immutable storage', 'Key Vault']),
    profile('aws', 'Amazon Web Services', 'aws', ['region', 'serviceOrigin', 'postgresEndpoint', 's3Bucket', 'kmsKey'], [], ['ECS / Fargate', 'RDS PostgreSQL', 'S3 Object Lock', 'KMS']),
    profile('gcp', 'Google Cloud', 'gcp', ['region', 'serviceOrigin', 'projectId', 'postgresEndpoint', 'storageBucket', 'kmsKey'], [], ['Cloud Run', 'Cloud SQL PostgreSQL', 'Cloud Storage Bucket Lock', 'Cloud KMS']),
  ],
  sso: [
    profile('none', 'Disabled', 'disabled'),
    profile('entra-id', 'Microsoft Entra ID', 'oidc-code-pkce', ['tenantId', 'clientId', 'redirectUri', 'groupRoleMapping', 'mfaMapping'], ['OIDC_CLIENT_SECRET']),
    profile('keycloak', 'Keycloak', 'oidc-code-pkce', ['issuerUrl', 'realm', 'clientId', 'redirectUri', 'groupRoleMapping', 'mfaMapping'], ['OIDC_CLIENT_SECRET']),
    profile('okta', 'Okta', 'oidc-code-pkce', ['issuerUrl', 'clientId', 'redirectUri', 'groupRoleMapping', 'mfaMapping'], ['OIDC_CLIENT_SECRET']),
    profile('generic-oidc', 'OpenID Connect', 'oidc-code-pkce', ['issuerUrl', 'clientId', 'redirectUri', 'groupRoleMapping', 'mfaMapping'], ['OIDC_CLIENT_SECRET']),
  ],
  devices: [
    profile('none', 'Disabled', 'disabled'),
    profile('intune', 'Microsoft Intune', 'managed-package', ['organizationId', 'installerPackage', 'deploymentGroup'], [], ['Windows / macOS', 'Signed broker package']),
    profile('jamf', 'Jamf Pro', 'managed-package', ['organizationId', 'installerPackage', 'deploymentGroup'], [], ['macOS', 'Signed broker package']),
    profile('ansible', 'Ansible', 'managed-package', ['organizationId', 'inventoryReference', 'installerPackage'], [], ['Linux / Windows / macOS', 'OS-specific installer']),
    profile('generic-mdm', 'MDM / package distribution', 'managed-package', ['organizationId', 'installerPackage', 'deploymentGroup']),
  ],
  siem: [
    profile('none', 'Disabled', 'disabled'),
    profile('splunk', 'Splunk', 'splunk-hec', ['httpsEndpoint', 'sourceType', 'index'], ['SPLUNK_HEC_TOKEN']),
    profile('sentinel', 'Microsoft Sentinel', 'azure-monitor-logs', ['logIngestionEndpoint', 'dataCollectionRuleId', 'streamName', 'tenantId', 'clientId'], ['AZURE_MONITOR_CLIENT_SECRET']),
    profile('elastic', 'Elastic Security / Elasticsearch', 'elasticsearch-bulk', ['httpsEndpoint', 'indexOrDataStream'], ['ELASTIC_API_KEY']),
    profile('generic-https', 'HTTPS JSON', 'https-json', ['httpsEndpoint', 'authenticationMethod'], ['SIEM_AUTH_CREDENTIAL']),
  ],
  tickets: [
    profile('none', 'Disabled', 'disabled'),
    profile('jira-cloud', 'Atlassian Jira Cloud', 'jira-rest-v3', ['cloudId', 'projectKey', 'issueTypeId', 'oauthClientId'], ['JIRA_OAUTH_CREDENTIAL']),
    profile('jira-data-center', 'Atlassian Jira Data Center', 'jira-rest-v2', ['httpsBaseUrl', 'projectKey', 'issueTypeId'], ['JIRA_PAT']),
    profile('servicenow', 'ServiceNow', 'servicenow-table', ['httpsBaseUrl', 'oauthClientId'], ['SERVICENOW_OAUTH_CREDENTIAL']),
    profile('gitlab', 'GitLab Issues', 'gitlab-rest-v4', ['httpsBaseUrl', 'projectId'], ['GITLAB_API_TOKEN']),
  ],
};

export const ENTERPRISE_BUNDLES: Record<string, EnterpriseSelection> = {
  local: { hosting: 'local-development', sso: 'none', devices: 'none', siem: 'none', tickets: 'none' },
  microsoft: { hosting: 'azure', sso: 'entra-id', devices: 'intune', siem: 'sentinel', tickets: 'servicenow' },
  openSource: { hosting: 'self-hosted', sso: 'keycloak', devices: 'ansible', siem: 'elastic', tickets: 'gitlab' },
  cloud: { hosting: 'aws', sso: 'okta', devices: 'generic-mdm', siem: 'splunk', tickets: 'jira-cloud' },
};

export function buildEnterpriseDraft(selection: EnterpriseSelection) {
  const integrations: Record<string, any> = {};
  const requiredSettings: string[] = [];
  const secretReferences: Array<{ category: string; reference: string }> = [];

  for (const catKey of Object.keys(ENTERPRISE_CATEGORIES) as Array<keyof EnterpriseCategories>) {
    const list = ENTERPRISE_CATEGORIES[catKey];
    const chosen = list.find(item => item.id === selection[catKey]) || list[0];
    const requested = chosen.protocol !== 'disabled';

    integrations[catKey] = {
      profileId: chosen.id,
      protocol: chosen.protocol,
      requested,
      enabled: false,
      implementation: chosen.implementation,
      settings: {},
      components: [...chosen.components],
    };

    for (const s of chosen.requiredSettings) {
      requiredSettings.push(`${catKey}.${s}`);
    }
    for (const r of chosen.secretRefs) {
      secretReferences.push({ category: catKey, reference: r });
    }
  }

  return {
    schemaVersion: 1,
    kind: 'thundy-enterprise-profile-draft',
    mode: 'disabled',
    selection,
    integrations,
    privacy: {
      urlMode: 'domain_only',
      identityResolutionEnabled: false,
      automaticTransmission: false,
    },
    readiness: {
      state: 'draft',
      deployment: 'not_deployed',
      integrationAcceptance: 'pending',
      requiredSettings,
      secretReferences,
      approvalRequired: true,
    },
  };
}
