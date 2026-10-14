'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const canonicalize = require('canonicalize');
const core = require('../contracts.cjs');
const policyExample = require('../../docs/enterprise/policy.example.json');
const eventExample = require('../../docs/enterprise/event.example.json');
const clone = value => JSON.parse(JSON.stringify(value));
const now = Date.parse('2026-10-14T12:00:00Z');
const error = code => err => err instanceof core.ContractError && err.code === code && err.message === code;
function setup(change = () => {}) {
    const payload = clone(policyExample); change(payload);
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const envelope = { keyId: 'policy-key', payload, signature: sign(null, Buffer.from(canonicalize(payload)), privateKey).toString('base64url') };
    const context = { now, organizationId: payload.organizationId, policyId: payload.policyId, groupIds: ['pilot'], highestVersion: 0, clientVersion: '1.20.0', capabilities: [...payload.requiredCapabilities], trustedKeys: new Map([['policy-key', { publicKey, organizationId: payload.organizationId, notBefore: now - 86400000, notAfter: now + 86400000, revokedAt: null }]]) };
    return { payload, envelope, context, publicKey, privateKey };
}
const eventContext = { deviceId: eventExample.deviceId, streamEpoch: eventExample.streamEpoch, policyId: eventExample.policyId };
const operational = { now, brokerReady: true, outboxDurable: true, intentSealed: true };

test('signed policy validates formats, capabilities and trusted scope and stays immutable', () => {
    const { envelope, context } = setup(); const policy = core.verifySignedPolicy(envelope, context);
    assert.equal(policy.version, 3); assert.ok(Object.isFrozen(policy.openingRules));
    envelope.payload.openingRules.blockScore = 1; assert.equal(policy.openingRules.blockScore, 80);
    assert.throws(() => { policy.openingRules.blockScore = 1; }, TypeError);
});
test('JCS known ordering vector and real Ed25519 reject changed content and another signer', () => {
    assert.equal(canonicalize({ z: 1, a: { z: null, a: '\n' } }), '{"a":{"a":"\\n","z":null},"z":1}');
    const { envelope, context } = setup(); envelope.payload.openingRules.warnScore = 49;
    assert.throws(() => core.verifySignedPolicy(envelope, context), error('POLICY_SIGNATURE_INVALID'));
    const other = setup(); envelope.payload = clone(policyExample); envelope.signature = other.envelope.signature;
    assert.throws(() => core.verifySignedPolicy(envelope, context), error('POLICY_SIGNATURE_INVALID'));
});
test('untrusted keys, wrong organization, policy and group cannot authorize a policy', () => {
    for (const edit of [ctx => { ctx.trustedKeys.clear(); }, ctx => { ctx.organizationId = 'other'; }, ctx => { ctx.policyId = 'other'; }, ctx => { ctx.groupIds = ['other']; }]) {
        const { envelope, context } = setup(); edit(context);
        assert.throws(() => core.verifySignedPolicy(envelope, context), err => ['POLICY_KEY_UNTRUSTED','POLICY_SCOPE_DENIED'].includes(err.code));
    }
});
test('key revocation, key expiry, future policy, policy expiry and rollback are rejected', () => {
    const cases = [
        [ctx => { ctx.trustedKeys.get('policy-key').revokedAt = now; }, 'POLICY_KEY_INACTIVE'],
        [ctx => { ctx.trustedKeys.get('policy-key').notAfter = now; }, 'POLICY_KEY_INACTIVE'],
        [ctx => { ctx.now = Date.parse('2026-10-14T07:00:00Z'); }, 'POLICY_NOT_YET_VALID'],
        [ctx => { ctx.now = Date.parse('2026-10-15T08:00:00Z'); }, 'POLICY_EXPIRED'],
        [ctx => { ctx.highestVersion = 4; }, 'POLICY_ROLLBACK'],
    ];
    for (const [edit, code] of cases) { const { envelope, context } = setup(); edit(context); assert.throws(() => core.verifySignedPolicy(envelope, context), error(code)); }
});
test('a legacy version number without enterprise capabilities cannot activate managed policy', () => {
    const { envelope, context } = setup(); context.capabilities = [];
    assert.throws(() => core.verifySignedPolicy(envelope, context), error('CLIENT_CAPABILITIES_UNSUPPORTED'));
    context.capabilities = [...envelope.payload.requiredCapabilities]; context.clientVersion = '1.19.9';
    assert.throws(() => core.verifySignedPolicy(envelope, context), error('CLIENT_VERSION_UNSUPPORTED'));
    assert.equal(core.compareVersions('1.20.0','1.9.0'), 1);
    for (const version of ['01.20.0','1.20','Infinity.0.0','9007199254740992.0.0']) assert.throws(() => core.compareVersions(version,'1.20.0'), error('CLIENT_VERSION_INVALID'));
});
test('malformed policy formats, unknown fields and nonsensical thresholds fail without exposing values', () => {
    const cases = [
        [p => { p.issuedAt = 'not-a-date'; }, 'POLICY_SCHEMA_INVALID'],
        [p => { p.organizationId = 'not-a-uuid'; }, 'POLICY_SCHEMA_INVALID'],
        [p => { p.secret = 'do-not-expose'; }, 'POLICY_SCHEMA_INVALID'],
        [p => { p.providerRules.fullUrlAnalysisAllowed = true; }, 'POLICY_SCHEMA_INVALID'],
        [p => { p.expiresAt = p.issuedAt; }, 'POLICY_TIME_INVALID'],
        [p => { p.openingRules.warnScore = 90; }, 'POLICY_THRESHOLDS_INVALID'],
        [p => { p.health.lateAfterSeconds = p.health.heartbeatSeconds; }, 'POLICY_HEALTH_INVALID'],
    ];
    for (const [edit, code] of cases) { const p = clone(policyExample); edit(p); assert.throws(() => core.validatePolicyPayload(p), error(code)); }
});
test('unknown and low scores never override stronger local or provider risk', () => {
    const { envelope, context } = setup(); const policy = core.verifySignedPolicy(envelope, context);
    for (const assessment of [{ localScore: 0, providerVerdict: 'MALICIOUS' }, { localScore: 0, providerVerdict: 'MALICIOUS_VISUAL' }, { localScore: 90, providerVerdict: 'UNKNOWN' }]) {
        assert.equal(core.evaluateOpening(policy, assessment, operational).action, 'block');
    }
    assert.equal(core.evaluateOpening(policy, { localScore: null, providerVerdict: 'CLEAN' }, operational).action, 'justification_required');
    assert.equal(core.evaluateOpening(policy, { localScore: 0, providerVerdict: 'UNKNOWN' }, operational).action, 'justification_required');
    assert.equal(core.evaluateOpening(policy, { localScore: 0, providerVerdict: 'SUSPICIOUS' }, operational).action, 'approval_required');
});
test('warning justification and sealed intent are distinct gates; no evaluator result claims OPENED', () => {
    const { envelope, context } = setup(); const policy = core.verifySignedPolicy(envelope, context);
    const assessment = { localScore: 60, providerVerdict: 'CLEAN' };
    assert.equal(core.evaluateOpening(policy, assessment, operational).action, 'justification_required');
    assert.equal(core.evaluateOpening(policy, assessment, { ...operational, justification: 'case purpose', intentSealed: false }).action, 'wait_for_receipt');
    const result = core.evaluateOpening(policy, assessment, { ...operational, justification: 'case purpose' });
    assert.equal(result.action, 'allow_intent'); assert.equal(result.outcome, undefined);
    assert.equal(core.evaluateOpening(policy, { localScore: 0, providerVerdict: 'CLEAN' }, { ...operational, explicitlyBlocked: true }).action, 'block');
});
test('lost broker, non-durable queue, invalid status types, expiry and unsigned policy fail closed', () => {
    const { envelope, context } = setup(); const policy = core.verifySignedPolicy(envelope, context), assessment = { localScore: 0, providerVerdict: 'CLEAN' };
    for (const state of [{ ...operational, brokerReady: false }, { ...operational, outboxDurable: false }, { ...operational, brokerReady: 'true' }]) assert.equal(core.evaluateOpening(policy, assessment, state).action, 'block');
    assert.equal(core.evaluateOpening(policy, assessment, { ...operational, now: Date.parse(policy.expiresAt) }).reason, 'POLICY_EXPIRED');
    assert.throws(() => core.evaluateOpening(clone(policy), assessment, operational), error('POLICY_NOT_VERIFIED'));
    for (const localScore of [undefined,-1,101,'0',NaN]) assert.throws(() => core.evaluateOpening(policy, { localScore, providerVerdict: 'CLEAN' }, operational), error('ASSESSMENT_INVALID'));
});
test('domain-only redaction drops userinfo, ports normalized by URL, paths, all query and fragments', () => {
    assert.deepEqual(core.redactUrl('https://user:password@EXAMPLE.org:443/private/token?x=secret#access'), { urlMode:'domain_only',urlRedacted:'https://example.org' });
    assert.equal(core.redactUrl('https://bücher.example/private%2Ftoken?a=%252Fsecret').urlRedacted,'https://xn--bcher-kva.example');
    assert.equal(core.redactUrl('http://[::1]:8080/p?secret').urlRedacted,'http://[::1]:8080');
    for (const raw of ['javascript:alert(1)','file:///private','not a url','https://example.org\n?secret']) assert.throws(() => core.redactUrl(raw), err => ['URL_INVALID','URL_SCHEME_DENIED'].includes(err.code));
});
test('event scope and domain-only format are enforced; unknown score remains null', () => {
    assert.equal(core.validateEventPayload(eventExample, eventContext).assessment.localScore, null);
    for (const field of ['deviceId','streamEpoch','policyId']) assert.throws(() => core.validateEventPayload(eventExample, { ...eventContext, [field]:'other' }), error('EVENT_SCOPE_DENIED'));
    for (const url of ['https://example.org/?token=secret','https://user:secret@example.org','https://example.org/private']) {
        const event = clone(eventExample); event.urlRedacted = url; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_SCHEMA_INVALID'));
    }
    const nonCanonical = clone(eventExample); nonCanonical.urlRedacted = 'https://EXAMPLE.org';
    assert.throws(() => core.validateEventPayload(nonCanonical,eventContext), error('EVENT_URL_NOT_CANONICAL'));
});
test('event outcome, attempt, reason and assessment provenance are semantically checked', () => {
    const event = clone(eventExample); event.outcome = 'OPENED'; event.reason = null; event.attemptNumber = 1;
    assert.equal(core.validateEventPayload(event,eventContext).outcome,'OPENED');
    event.attemptNumber = 0; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_ATTEMPT_INVALID'));
    event.attemptNumber = 1; event.reason = 'escape'; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_REASON_INVALID'));
    event.reason = null; event.assessment.localScore = 0; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_SCORE_PROVENANCE_MISSING'));
    event.assessment.localScore = null; event.assessment.providerVerdict = 'CLEAN'; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_PROVIDER_PROVENANCE_MISSING'));
    event.assessment.providerVerdict = 'UNKNOWN'; event.assessment.observedAt = '2026-10-14T08:02:00Z'; assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_ASSESSMENT_TIME_INVALID'));
    event.kind = 'OPEN_INTENT'; event.outcome = null; event.assessment.observedAt = null;
    assert.equal(core.validateEventPayload(event,eventContext).outcome,null);
});


test('cached verification is invalidated by live key revocation, changed scope or a newer policy', () => {
    for (const [edit, reason] of [
        [ctx => { ctx.trustedKeys.get('policy-key').revokedAt = now; }, 'POLICY_KEY_INACTIVE'],
        [ctx => { ctx.trustedKeys.clear(); }, 'POLICY_KEY_INACTIVE'],
        [ctx => { ctx.highestVersion = 4; }, 'POLICY_SUPERSEDED'],
        [ctx => { ctx.groupIds = ['other']; }, 'POLICY_SCOPE_DENIED'],
    ]) {
        const { envelope, context } = setup(); const policy = core.verifySignedPolicy(envelope, context); edit(context);
        assert.equal(core.evaluateOpening(policy, { localScore: 0, providerVerdict: 'CLEAN' }, operational).reason, reason);
    }
});

test('non-JSON numbers cannot silently turn into unknown scores during payload copying', () => {
    for (const localScore of [NaN,Infinity,-Infinity]) {
        const event = clone(eventExample); event.assessment.localScore = localScore;
        assert.throws(() => core.validateEventPayload(event,eventContext), error('EVENT_SCHEMA_INVALID'));
    }
});
