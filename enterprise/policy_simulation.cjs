"use strict";
const crypto = require("node:crypto");
const { verifySignedPolicy, evaluateOpening } = require("./contracts.cjs");
const { verifyRecords } = require("./evidence.cjs");
const { hash } = require("./ledger.cjs");
const { need, clone, identifier } = require("./durable_journal.cjs");
function contextCopy(context, now) {
  need(
    context?.trustedKeys instanceof Map &&
      context.trustedKeys.size > 0 &&
      context.trustedKeys.size <= 1000 &&
      Array.isArray(context.groupIds) &&
      Array.isArray(context.capabilities) &&
      Number.isSafeInteger(context.highestVersion) &&
      context.highestVersion >= 0,
    "SIMULATION_CONTEXT_INVALID",
  );
  const trustedKeys = new Map();
  for (const [id, key] of context.trustedKeys) {
    need(
      identifier(id) &&
        key.publicKey?.type === "public" &&
        key.publicKey.asymmetricKeyType === "ed25519",
      "SIMULATION_PUBLIC_KEY_REQUIRED",
    );
    trustedKeys.set(id, {
      ...key,
      publicKey: crypto.createPublicKey(
        key.publicKey.export({ type: "spki", format: "pem" }),
      ),
    });
  }
  return {
    ...context,
    now,
    groupIds: [...context.groupIds],
    capabilities: [...context.capabilities],
    trustedKeys,
  };
}
function normalize(policy) {
  const p = clone(policy);
  p.groupIds.sort();
  p.requiredCapabilities.sort();
  p.providerRules.providersAllowed.sort();
  return p;
}
function diff(before, after, path = "") {
  if (hash(before) === hash(after)) return [];
  if (
    before &&
    after &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  )
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort()
      .flatMap((key) => diff(before[key], after[key], path + "/" + key));
  return [{ path, before: clone(before), after: clone(after) }];
}
const rank = {
  allow_intent: 1,
  justification_required: 2,
  wait_for_receipt: 2,
  approval_required: 3,
  block: 4,
};
function simulate({
  baseline,
  candidate,
  data,
  policyContext,
  eventTrust,
  now = Date.now(),
  scenario = "healthy_unacknowledged",
}) {
  need(
    Number.isSafeInteger(now) &&
      ["healthy_unacknowledged", "audit_unavailable"].includes(scenario),
    "SIMULATION_SCENARIO_INVALID",
  );
  need(
    Buffer.byteLength(JSON.stringify(data)) <= 16 * 1024 * 1024,
    "SIMULATION_INPUT_CAPACITY",
  );
  const context = contextCopy(policyContext, now),
    before = verifySignedPolicy(baseline, context),
    after = verifySignedPolicy(candidate, context);
  need(after.version > before.version, "SIMULATION_VERSION_NOT_INCREASING");
  need(
    eventTrust &&
      identifier(eventTrust.serverKeyId) &&
      Array.isArray(eventTrust.registrations) &&
      eventTrust.registrations.length > 0,
    "SIMULATION_EVENT_TRUST_REQUIRED",
  );
  const publicOnly = (k) =>
    k?.type === "public" ||
    (typeof k === "string" &&
      /^-----BEGIN PUBLIC KEY-----\r?\n/.test(k) &&
      !k.includes("PRIVATE KEY"));
  need(
    publicOnly(eventTrust.serverPublicKey) &&
      eventTrust.registrations.every((r) => publicOnly(r.publicKey)),
    "SIMULATION_PUBLIC_KEY_REQUIRED",
  );
  const evidence = verifyRecords(data, eventTrust);
  need(
    evidence.deviceSignaturesVerified &&
      data.records.every(
        (r) => r.receipt.payload.organizationId === before.organizationId,
      ),
    "SIMULATION_EVENT_SCOPE_DENIED",
  );
  if (eventTrust.expectedHead !== undefined)
    need(
      eventTrust.expectedHead === evidence.tailReceiptHash,
      "SIMULATION_HEAD_MISMATCH",
    );
  const assumptions = {
    brokerReady: scenario === "healthy_unacknowledged",
    outboxDurable: scenario === "healthy_unacknowledged",
    intentSealed: false,
    justification: null,
    explicitlyBlocked: false,
  };
  const results = [],
    counts = {
      more_restrictive: 0,
      less_restrictive: 0,
      different_gate: 0,
      unchanged: 0,
    };
  let skipped = 0;
  for (const record of data.records) {
    const e = record.eventEnvelope.payload;
    if (e.kind !== "DECISION") continue;
    if (e.policyId !== before.policyId || e.policyVersion !== before.version) {
      skipped++;
      continue;
    }
    const oldResult = evaluateOpening(before, e.assessment, {
        ...assumptions,
        now,
      }),
      newResult = evaluateOpening(after, e.assessment, { ...assumptions, now });
    const direction =
      oldResult.action === newResult.action &&
      oldResult.reason === newResult.reason
        ? "unchanged"
        : rank[newResult.action] > rank[oldResult.action]
          ? "more_restrictive"
          : rank[newResult.action] < rank[oldResult.action]
            ? "less_restrictive"
            : "different_gate";
    counts[direction]++;
    results.push({
      decisionEventId: e.eventId,
      receiptHash: hash(record.receipt),
      eventEnvelopeHash: hash(record.eventEnvelope),
      decisionAt: e.observedAt,
      actualOutcome: e.outcome,
      urlMode: e.urlMode,
      urlRedacted: e.urlRedacted,
      assessmentAtDecision: clone(e.assessment),
      baselineModeled: oldResult,
      candidateModeled: newResult,
      direction,
    });
  }
  return {
    schemaVersion: 1,
    kind: "thundy-policy-simulation",
    mode: "offline-comparison",
    evaluatedAt: new Date(now).toISOString(),
    scenario,
    assumptions,
    modeledScope: {
      organizationId: context.organizationId,
      policyId: context.policyId,
      groupIds: [...context.groupIds].sort(),
      clientVersion: context.clientVersion,
      highestVersion: context.highestVersion,
    },
    baseline: { version: before.version, hash: hash(baseline) },
    candidate: { version: after.version, hash: hash(candidate) },
    diff: diff(normalize(before), normalize(after)),
    evidence: {
      sourceId: evidence.sourceId,
      entryCount: evidence.entryCount,
      tailReceiptHash: evidence.tailReceiptHash,
      deviceSignaturesVerified: true,
      headPinned: eventTrust.expectedHead !== undefined,
    },
    counts,
    evaluatedDecisions: results.length,
    skippedDecisions: skipped,
    results,
    policyActivated: false,
    opened: false,
    sealed: false,
    limitations: [
      "CURRENT_TIME_POLICY_CHECK",
      "HISTORICAL_ASSESSMENT_ONLY",
      "EVENT_GROUP_MEMBERSHIP_NOT_RECORDED",
      "NO_PROVIDER_OR_RETENTION_SIMULATION",
      "NO_ROLLOUT_OR_AUTHORIZATION",
    ],
  };
}
module.exports = { simulate };
