"use strict";
// Offline, deterministic derivation. No tickets, network, or SEALED assertion.
const { verifyRecords } = require("./evidence.cjs");
const { hash } = require("./ledger.cjs");
const eventSchema = require("../docs/enterprise/event.schema.json");
class IncidentError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
function need(condition, code) {
  if (!condition) throw new IncidentError(code);
}
const exact = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === keys.split(",").sort().join(",");
const id = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function choices(values, allowed, nonempty = false) {
  return (
    Array.isArray(values) &&
    (!nonempty || values.length > 0) &&
    values.length <= allowed.length &&
    new Set(values).size === values.length &&
    values.every((value) => allowed.includes(value))
  );
}
function validateRules(input) {
  need(
    exact(input, "schemaVersion,organizationId,ruleSetId,version,rules") &&
      input.schemaVersion === 1 &&
      uuid(input.organizationId) &&
      id(input.ruleSetId) &&
      Number.isSafeInteger(input.version) &&
      input.version > 0 &&
      Array.isArray(input.rules) &&
      input.rules.length > 0 &&
      input.rules.length <= 100,
    "INCIDENT_RULESET_INVALID",
  );
  const ids = new Set();
  for (const rule of input.rules) {
    need(
      exact(
        rule,
        "id,outcomes,minScore,matchUnknownScore,providerVerdicts,severity",
      ) &&
        id(rule.id) &&
        !ids.has(rule.id) &&
        choices(
          rule.outcomes,
          ["OPENED", "ABORTED", "BLOCKED", "OPEN_ERROR"],
          true,
        ) &&
        Number.isInteger(rule.minScore) &&
        rule.minScore >= 0 &&
        rule.minScore <= 100 &&
        typeof rule.matchUnknownScore === "boolean" &&
        choices(
          rule.providerVerdicts,
          eventSchema.properties.assessment.properties.providerVerdict.enum,
        ) &&
        ["low", "medium", "high", "critical"].includes(rule.severity),
      "INCIDENT_RULE_INVALID",
    );
    ids.add(rule.id);
  }
  // Order in sets is not semantic; stable hashes survive reorderings.
  const rules = JSON.parse(JSON.stringify(input));
  rules.rules.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const rule of rules.rules) {
    rule.outcomes.sort();
    rule.providerVerdicts.sort();
  }
  return rules;
}
function deriveIncidents(data, ruleSet, trust) {
  const rules = validateRules(ruleSet);
  need(
    trust &&
      id(trust.serverKeyId) &&
      Array.isArray(trust.registrations) &&
      trust.registrations.length > 0,
    "INCIDENT_TRUST_REQUIRED",
  );
  const publicOnly = (key) =>
    key?.type === "public" ||
    (typeof key === "string" &&
      /^-----BEGIN PUBLIC KEY-----\r?\n/.test(key) &&
      !key.includes("PRIVATE KEY"));
  need(
    publicOnly(trust.serverPublicKey) &&
      trust.registrations.every((registration) =>
        publicOnly(registration?.publicKey),
      ),
    "INCIDENT_PUBLIC_KEY_REQUIRED",
  );
  // Bound work before cryptographic verification; caller must bound file reads too.
  need(
    Buffer.byteLength(JSON.stringify(data)) <= 16 * 1024 * 1024,
    "INCIDENT_INPUT_CAPACITY",
  );
  const verified = verifyRecords(data, trust);
  need(verified.deviceSignaturesVerified, "INCIDENT_TRUST_REQUIRED");
  if (trust.expectedHead !== undefined)
    need(
      trust.expectedHead === verified.tailReceiptHash,
      "INCIDENT_HEAD_MISMATCH",
    );
  need(
    data.records.every(
      (record) =>
        record.receipt.payload.organizationId === rules.organizationId,
    ),
    "INCIDENT_ORGANIZATION_MISMATCH",
  );
  const ruleSetHash = hash(rules),
    incidents = [];
  let decisionsEvaluated = 0;
  for (const record of data.records) {
    const event = record.eventEnvelope.payload;
    if (event.kind !== "DECISION") continue;
    decisionsEvaluated++;
    for (const rule of rules.rules) {
      const assessment = event.assessment;
      if (
        !rule.outcomes.includes(event.outcome) ||
        !(assessment.localScore === null
          ? rule.matchUnknownScore
          : assessment.localScore >= rule.minScore) ||
        (rule.providerVerdicts.length > 0 &&
          !rule.providerVerdicts.includes(assessment.providerVerdict))
      )
        continue;
      const eventEnvelopeHash = hash(record.eventEnvelope);
      need(incidents.length < 10000, "INCIDENT_OUTPUT_CAPACITY");
      incidents.push({
        incidentId: hash({
          sourceId: verified.sourceId,
          organizationId: rules.organizationId,
          eventId: event.eventId,
          eventEnvelopeHash,
          ruleSetHash,
          ruleId: rule.id,
        }),
        ruleId: rule.id,
        severity: rule.severity,
        organizationId: rules.organizationId,
        deviceId: event.deviceId,
        streamEpoch: event.streamEpoch,
        interactionId: event.interactionId,
        decisionEventId: event.eventId,
        eventEnvelopeHash,
        receiptHash: hash(record.receipt),
        decisionAt: event.observedAt,
        outcome: event.outcome,
        attemptNumber: event.attemptNumber,
        urlMode: event.urlMode,
        urlRedacted: event.urlRedacted,
        policyId: event.policyId,
        policyVersion: event.policyVersion,
        assessmentAtDecision: JSON.parse(JSON.stringify(assessment)),
      });
    }
  }
  return {
    schemaVersion: 1,
    kind: "thundy-incident-derivation",
    ruleSet: {
      organizationId: rules.organizationId,
      ruleSetId: rules.ruleSetId,
      version: rules.version,
      hash: ruleSetHash,
    },
    evidence: {
      sourceId: verified.sourceId,
      entryCount: verified.entryCount,
      tailReceiptHash: verified.tailReceiptHash,
      serverKeyId: verified.serverKeyId,
      deviceSignaturesVerified: true,
      headPinned: trust.expectedHead !== undefined,
      status: "STAGED",
      sealed: false,
    },
    decisionsEvaluated,
    incidents,
  };
}
module.exports = { deriveIncidents, validateRules, IncidentError };
