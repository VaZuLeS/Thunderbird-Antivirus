'use strict';
// Preparatory, Node-only core. No deployment, network, or extension activation.
const { verify } = require('node:crypto');
const Ajv = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const canonicalize = require('canonicalize');
const policySchema = require('../docs/enterprise/policy.schema.json');
const eventSchema = require('../docs/enterprise/event.schema.json');
const ajv = new Ajv({ strict: true, strictTypes: false, allErrors: true });
addFormats(ajv);
const policyValidator = ajv.compile(policySchema);
const eventValidator = ajv.compile(eventSchema);
const verifiedPolicies = new WeakMap();

class ContractError extends Error {
    constructor(code) { super(code); this.name = 'ContractError'; this.code = code; }
}
function assert(condition, code) { if (!condition) throw new ContractError(code); }
function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
}
function copyValidated(validator, input, code) {
    let value;
    assert(validator(input), code);
    try { value = JSON.parse(JSON.stringify(input)); }
    catch { throw new ContractError(code); }
    assert(validator(value), code);
    return value;
}
function versionParts(value) {
    assert(typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value), 'CLIENT_VERSION_INVALID');
    const parts = value.split('.').map(Number);
    assert(parts.every(Number.isSafeInteger), 'CLIENT_VERSION_INVALID');
    return parts;
}
function compareVersions(left, right) {
    const a = versionParts(left), b = versionParts(right);
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return 0;
}
function validatePolicyPayload(input) {
    const value = copyValidated(policyValidator, input, 'POLICY_SCHEMA_INVALID');
    assert(Date.parse(value.issuedAt) < Date.parse(value.expiresAt), 'POLICY_TIME_INVALID');
    assert(value.openingRules.warnScore < value.openingRules.blockScore, 'POLICY_THRESHOLDS_INVALID');
    const health = value.health;
    assert(health.heartbeatSeconds < health.lateAfterSeconds && health.lateAfterSeconds < health.unknownAfterSeconds, 'POLICY_HEALTH_INVALID');
    versionParts(value.minimumExtensionVersion);
    return freeze(value);
}
function verifySignedPolicy(envelope, context) {
    assert(envelope && typeof envelope === 'object' && !Array.isArray(envelope) && Object.keys(envelope).sort().join(',') === 'keyId,payload,signature', 'POLICY_ENVELOPE_INVALID');
    assert(typeof envelope.keyId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(envelope.keyId), 'POLICY_ENVELOPE_INVALID');
    assert(typeof envelope.signature === 'string' && /^[A-Za-z0-9_-]{86}$/.test(envelope.signature), 'POLICY_SIGNATURE_INVALID');
    const payload = validatePolicyPayload(envelope.payload);
    const now = context.now ?? Date.now();
    assert(Number.isFinite(now), 'POLICY_TIME_INVALID');
    const key = context.trustedKeys instanceof Map && context.trustedKeys.get(envelope.keyId);
    assert(key && key.publicKey?.type === 'public' && key.publicKey.asymmetricKeyType === 'ed25519', 'POLICY_KEY_UNTRUSTED');
    assert(key.organizationId === context.organizationId && payload.organizationId === context.organizationId && payload.policyId === context.policyId, 'POLICY_SCOPE_DENIED');
    assert(Array.isArray(context.groupIds) && payload.groupIds.some(group => context.groupIds.includes(group)), 'POLICY_SCOPE_DENIED');
    assert(Number.isFinite(key.notBefore) && Number.isFinite(key.notAfter) && now >= key.notBefore && now < key.notAfter && (key.revokedAt == null || now < key.revokedAt), 'POLICY_KEY_INACTIVE');
    const signature = Buffer.from(envelope.signature, 'base64url');
    assert(signature.toString('base64url') === envelope.signature && verify(null, Buffer.from(canonicalize(payload), 'utf8'), key.publicKey, signature), 'POLICY_SIGNATURE_INVALID');
    assert(Date.parse(payload.issuedAt) <= now + 120000, 'POLICY_NOT_YET_VALID');
    assert(Date.parse(payload.expiresAt) > now, 'POLICY_EXPIRED');
    assert(Number.isSafeInteger(context.highestVersion) && context.highestVersion >= 0 && payload.version >= context.highestVersion, 'POLICY_ROLLBACK');
    assert(compareVersions(context.clientVersion, payload.minimumExtensionVersion) >= 0, 'CLIENT_VERSION_UNSUPPORTED');
    assert(Array.isArray(context.capabilities) && payload.requiredCapabilities.every(capability => context.capabilities.includes(capability)), 'CLIENT_CAPABILITIES_UNSUPPORTED');
    verifiedPolicies.set(payload, { context, keyId: envelope.keyId, publicKey: key.publicKey });
    return payload;
}

function redactUrl(raw) {
    assert(typeof raw === 'string' && !/[\u0000-\u0020\u007f]/.test(raw), 'URL_INVALID');
    let url; try { url = new URL(raw); } catch { throw new ContractError('URL_INVALID'); }
    assert(['http:', 'https:'].includes(url.protocol), 'URL_SCHEME_DENIED');
    return freeze({ urlMode: 'domain_only', urlRedacted: url.protocol + '//' + url.host });
}
function validateEventPayload(input, context) {
    const value = copyValidated(eventValidator, input, 'EVENT_SCHEMA_INVALID');
    assert(value.deviceId === context.deviceId && value.streamEpoch === context.streamEpoch && value.policyId === context.policyId, 'EVENT_SCOPE_DENIED');
    assert(redactUrl(value.urlRedacted).urlRedacted === value.urlRedacted, 'EVENT_URL_NOT_CANONICAL');
    const assessment = value.assessment;
    assert(assessment.observedAt == null || Date.parse(assessment.observedAt) <= Date.parse(value.observedAt), 'EVENT_ASSESSMENT_TIME_INVALID');
    assert(assessment.localScore == null || (assessment.modelVersion != null && assessment.observedAt != null), 'EVENT_SCORE_PROVENANCE_MISSING');
    assert(assessment.provider !== 'none' || ['UNKNOWN', 'ERROR', 'NOT_CHECKED'].includes(assessment.providerVerdict), 'EVENT_PROVIDER_PROVENANCE_MISSING');
    if (value.kind !== 'DECISION') assert(value.reason == null, 'EVENT_REASON_INVALID');
    if (value.kind === 'CLICKED') assert(value.attemptNumber === 0, 'EVENT_ATTEMPT_INVALID');
    if (value.kind === 'OPEN_INTENT') assert(value.attemptNumber > 0, 'EVENT_ATTEMPT_INVALID');
    if (value.kind === 'DECISION') {
        const reasons = { OPENED: [null], OPEN_ERROR: ['browser_error'], BLOCKED: ['policy_block'], ABORTED: ['cancel', 'escape', 'destination_changed', 'context_closed'] };
        assert(reasons[value.outcome].includes(value.reason), 'EVENT_REASON_INVALID');
        if (['OPENED', 'OPEN_ERROR'].includes(value.outcome)) assert(value.attemptNumber > 0, 'EVENT_ATTEMPT_INVALID');
    }
    return freeze(value);
}

// Inputs supplied by a future trusted broker/receipt verifier, never by the UI.
// This evaluator is deliberately not wired into the current extension.
function evaluateOpening(policy, assessment, state) {
    const registration = verifiedPolicies.get(policy);
    assert(registration, 'POLICY_NOT_VERIFIED');
    const now = state.now ?? Date.now();
    assert(Number.isFinite(now), 'POLICY_TIME_INVALID');
    if (now >= Date.parse(policy.expiresAt)) return freeze({ action: 'block', reason: 'POLICY_EXPIRED' });
    const currentKey = registration.context.trustedKeys.get(registration.keyId);
    if (!currentKey || currentKey.publicKey !== registration.publicKey || currentKey.organizationId !== policy.organizationId || now < currentKey.notBefore || now >= currentKey.notAfter || currentKey.revokedAt != null && now >= currentKey.revokedAt) return freeze({ action: 'block', reason: 'POLICY_KEY_INACTIVE' });
    if (!Number.isSafeInteger(registration.context.highestVersion) || policy.version < registration.context.highestVersion) return freeze({ action: 'block', reason: 'POLICY_SUPERSEDED' });
    if (registration.context.organizationId !== policy.organizationId || registration.context.policyId !== policy.policyId || !Array.isArray(registration.context.groupIds) || !policy.groupIds.some(group => registration.context.groupIds.includes(group))) return freeze({ action: 'block', reason: 'POLICY_SCOPE_DENIED' });

    assert(assessment && (assessment.localScore === null || Number.isInteger(assessment.localScore) && assessment.localScore >= 0 && assessment.localScore <= 100), 'ASSESSMENT_INVALID');
    assert(eventSchema.properties.assessment.properties.providerVerdict.enum.includes(assessment.providerVerdict), 'ASSESSMENT_INVALID');
    if (state.brokerReady !== true || state.outboxDurable !== true) return freeze({ action: 'block', reason: 'AUDIT_UNAVAILABLE' });
    if (state.explicitlyBlocked || ['MALICIOUS', 'MALICIOUS_VISUAL'].includes(assessment.providerVerdict)) return freeze({ action: 'block', reason: 'MALICIOUS_OR_BLOCKLIST' });
    const rules = policy.openingRules;
    const unknown = assessment.localScore === null || ['UNKNOWN', 'ERROR', 'TIMEOUT', 'NOT_CHECKED'].includes(assessment.providerVerdict);
    const actions = [];
    if (assessment.providerVerdict === 'SUSPICIOUS') actions.push(rules.suspicious);
    if (assessment.localScore !== null && assessment.localScore >= rules.blockScore) actions.push('block');
    else if (assessment.localScore !== null && assessment.localScore >= rules.warnScore) actions.push('warn');
    if (unknown) actions.push(rules.unknown);
    if (actions.includes('block')) return freeze({ action: 'block', reason: 'POLICY_RISK' });
    if (actions.includes('approval_required')) return freeze({ action: 'approval_required', reason: 'POLICY_APPROVAL' });
    if (actions.includes('warn')) {
        if (rules.warnOverride === 'deny') return freeze({ action: 'block', reason: 'POLICY_OVERRIDE_DENIED' });
        if (rules.warnOverride === 'approval_required') return freeze({ action: 'approval_required', reason: 'POLICY_APPROVAL' });
        if (typeof state.justification !== 'string' || !state.justification.trim()) return freeze({ action: 'justification_required', reason: 'POLICY_WARNING' });
    }
    // An intent receipt is not proof of OPENED. The future caller reports the
    // successful browser handoff as a separate DECISION only after it occurs.
    if (rules.auditMode === 'requireSealedIntent' && state.intentSealed !== true) return freeze({ action: 'wait_for_receipt', reason: 'AUDIT_ACK_REQUIRED' });
    return freeze({ action: 'allow_intent', reason: 'POLICY_SATISFIED' });
}
module.exports = { ContractError, validatePolicyPayload, verifySignedPolicy, validateEventPayload, redactUrl, evaluateOpening, compareVersions };
