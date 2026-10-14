"use strict";
const crypto = require("node:crypto");
const {
  verifyEnvelope,
  signed,
  hash,
  nextEventState,
  deviceRegistry,
} = require("./ledger.cjs");
const { validateEventPayload } = require("./contracts.cjs");
class EvidenceError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
const need = (condition, code) => {
  if (!condition) throw new EvidenceError(code);
};
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const hex = (value) =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const date = (value) =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
function publicKey(input) {
  const key = input?.type === "public" ? input : crypto.createPublicKey(input);
  need(key.asymmetricKeyType === "ed25519", "EVIDENCE_KEY_INVALID");
  return key;
}
function sourceId(key) {
  return crypto
    .createHash("sha256")
    .update(publicKey(key).export({ type: "spki", format: "der" }))
    .digest("hex");
}
function verifyRecords(
  data,
  { serverPublicKey, serverKeyId = null, registrations = null } = {},
) {
  need(
    data &&
      Object.keys(data).sort().join(",") === "kind,records,schemaVersion" &&
      data.kind === "thundy-staged-journal-export" &&
      data.schemaVersion === 1 &&
      Array.isArray(data.records) &&
      data.records.length <= 100000,
    "EVIDENCE_EXPORT_INVALID",
  );
  const key = publicKey(serverPublicKey),
    registry = registrations === null ? null : deviceRegistry(registrations),
    seen = new Set(),
    streams = new Map(),
    interactions = new Map(),
    receiptHashes = [];
  let previous = null,
    pinnedKeyId = serverKeyId;
  for (const record of data.records) {
    need(
      record &&
        Object.keys(record).sort().join(",") === "eventEnvelope,receipt",
      "EVIDENCE_RECORD_INVALID",
    );
    const r = verifyEnvelope(record.receipt, key),
      envelope = record.eventEnvelope;
    need(
      r.schemaVersion === 1 &&
        r.status === "STAGED" &&
        uuid(r.organizationId) &&
        uuid(r.deviceId) &&
        uuid(r.streamEpoch) &&
        uuid(r.eventId) &&
        uuid(r.ingressId) &&
        date(r.receivedAt) &&
        r.ingressIndex === receiptHashes.length + 1 &&
        r.previousReceiptHash === previous,
      "EVIDENCE_RECEIPT_INVALID",
    );
    if (pinnedKeyId === null) pinnedKeyId = record.receipt.keyId;
    need(
      record.receipt.keyId === pinnedKeyId,
      "EVIDENCE_SERVER_KEY_ID_MISMATCH",
    );
    need(
      envelope &&
        Object.keys(envelope).sort().join(",") === "keyId,payload,signature" &&
        typeof envelope.keyId === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(envelope.keyId) &&
        typeof envelope.signature === "string" &&
        /^[A-Za-z0-9_-]{86}$/.test(envelope.signature),
      "EVIDENCE_DEVICE_ENVELOPE_INVALID",
    );
    let registration;
    if (registry) {
      registration = registry.get(envelope.keyId);
      need(
        registration && registration.organizationId === r.organizationId,
        "EVIDENCE_DEVICE_UNTRUSTED",
      );
      verifyEnvelope(envelope, registration.publicKey);
    }
    const context = registration || {
      deviceId: r.deviceId,
      streamEpoch: r.streamEpoch,
      policyId: envelope.payload?.policyId,
    };
    const event = validateEventPayload(envelope.payload, context);
    need(
      !seen.has(event.eventId) &&
        event.eventId === r.eventId &&
        event.deviceId === r.deviceId &&
        event.streamEpoch === r.streamEpoch &&
        event.sequence === r.sequence &&
        r.payloadHash === hash(event) &&
        r.envelopeHash === hash(envelope) &&
        (!registry || event.policyVersion === registration.policyVersion),
      "EVIDENCE_EVENT_BINDING_INVALID",
    );
    const next = nextEventState(
      event,
      { organizationId: r.organizationId },
      streams,
      interactions,
    );
    streams.set(next.stream, event.sequence);
    interactions.set(next.key, next.state);
    seen.add(event.eventId);
    previous = hash(record.receipt);
    receiptHashes.push(previous);
  }
  return {
    sourceId: sourceId(key),
    entryCount: data.records.length,
    tailReceiptHash: previous,
    receiptHashes,
    serverKeyId: pinnedKeyId,
    deviceSignaturesVerified: registry !== null,
  };
}
function makeCheckpoint(
  data,
  { serverPrivateKey, serverKeyId, now = Date.now(), registrations = null },
) {
  const privateKey =
      serverPrivateKey?.type === "private"
        ? serverPrivateKey
        : crypto.createPrivateKey(serverPrivateKey),
    key = crypto.createPublicKey(privateKey);
  need(Number.isFinite(now), "CHECKPOINT_TIME_INVALID");
  const report = verifyRecords(data, {
    serverPublicKey: key,
    serverKeyId,
    registrations,
  });
  return signed(
    {
      schemaVersion: 1,
      kind: "thundy-staged-checkpoint",
      sourceId: report.sourceId,
      entryCount: report.entryCount,
      tailReceiptHash: report.tailReceiptHash,
      evidenceStatus: "STAGED",
      createdAt: new Date(now).toISOString(),
    },
    serverKeyId,
    privateKey,
  );
}
function verifyCheckpoint(checkpoint, { serverPublicKey, serverKeyId }) {
  const key = publicKey(serverPublicKey),
    p = verifyEnvelope(checkpoint, key);
  need(checkpoint.keyId === serverKeyId, "CHECKPOINT_KEY_ID_MISMATCH");
  need(
    Object.keys(p).sort().join(",") ===
      "createdAt,entryCount,evidenceStatus,kind,schemaVersion,sourceId,tailReceiptHash" &&
      p.schemaVersion === 1 &&
      p.kind === "thundy-staged-checkpoint" &&
      p.sourceId === sourceId(key) &&
      p.evidenceStatus === "STAGED" &&
      Number.isSafeInteger(p.entryCount) &&
      p.entryCount >= 0 &&
      p.entryCount <= 100000 &&
      (p.entryCount === 0
        ? p.tailReceiptHash === null
        : hex(p.tailReceiptHash)) &&
      date(p.createdAt),
    "CHECKPOINT_INVALID",
  );
  return p;
}
function matchCheckpoint(report, checkpoint, { allowExtension = false } = {}) {
  need(
    report.sourceId === checkpoint.sourceId &&
      report.entryCount >= checkpoint.entryCount,
    "EVIDENCE_TRUNCATED_OR_WRONG_SOURCE",
  );
  need(
    allowExtension || report.entryCount === checkpoint.entryCount,
    "EVIDENCE_SNAPSHOT_COUNT_MISMATCH",
  );
  const atCheckpoint = checkpoint.entryCount
    ? report.receiptHashes[checkpoint.entryCount - 1]
    : null;
  need(
    atCheckpoint === checkpoint.tailReceiptHash,
    "EVIDENCE_FORK_OR_CHECKPOINT_MISMATCH",
  );
  return {
    anchoredEntryCount: checkpoint.entryCount,
    unanchoredSuffixCount: report.entryCount - checkpoint.entryCount,
  };
}
function verifyWitness(
  anchor,
  { witnessPublicKey, expectedAnchorHash, serverPublicKey, serverKeyId },
) {
  need(
    hex(expectedAnchorHash) && hash(anchor) === expectedAnchorHash,
    "WITNESS_HEAD_MISMATCH",
  );
  const p = verifyEnvelope(anchor, publicKey(witnessPublicKey));
  need(
    Object.keys(p).sort().join(",") ===
      "anchorIndex,checkpoint,kind,previousWitnessHash,schemaVersion,witnessedAt" &&
      p.schemaVersion === 1 &&
      p.kind === "thundy-staged-witness-anchor" &&
      Number.isSafeInteger(p.anchorIndex) &&
      p.anchorIndex >= 1 &&
      (p.anchorIndex === 1
        ? p.previousWitnessHash === null
        : hex(p.previousWitnessHash)) &&
      date(p.witnessedAt),
    "WITNESS_ANCHOR_INVALID",
  );
  const checkpoint = verifyCheckpoint(p.checkpoint, {
    serverPublicKey,
    serverKeyId,
  });
  return { payload: p, checkpoint };
}
function verifyEvidence(data, options) {
  const report = verifyRecords(data, options);
  const configured = [
    options.witnessAnchor,
    options.witnessPublicKey,
    options.expectedAnchorHash,
  ].filter((value) => value !== undefined && value !== null).length;
  need(configured === 0 || configured === 3, "WITNESS_TRUST_INCOMPLETE");
  need(
    !options.allowExtension || configured === 3,
    "EVIDENCE_PREFIX_REQUIRES_WITNESS",
  );
  let coverage = {
    anchoredEntryCount: 0,
    unanchoredSuffixCount: report.entryCount,
  };
  if (configured) {
    need(
      typeof options.serverKeyId === "string",
      "WITNESS_SERVER_KEY_ID_REQUIRED",
    );
    const verified = verifyWitness(options.witnessAnchor, options);
    coverage = matchCheckpoint(report, verified.checkpoint, {
      allowExtension: options.allowExtension === true,
    });
  }
  return {
    verified: true,
    sourceId: report.sourceId,
    entryCount: report.entryCount,
    tailReceiptHash: report.tailReceiptHash,
    deviceSignaturesVerified: report.deviceSignaturesVerified,
    witnessVerified: configured === 3,
    ...coverage,
    completeSnapshotWitnessed:
      configured === 3 && coverage.unanchoredSuffixCount === 0,
    evidenceStatus: "STAGED",
    sealed: false,
  };
}
module.exports = {
  EvidenceError,
  verifyRecords,
  makeCheckpoint,
  verifyCheckpoint,
  matchCheckpoint,
  verifyWitness,
  verifyEvidence,
  sourceId,
};
