"use strict";
const crypto = require("node:crypto");
const {
  DurableJournal,
  need,
  clone,
  exact,
  identifier,
  hex,
} = require("./durable_journal.cjs");
const { deriveIncidents } = require("./incidents.cjs");
const { hash, deviceRegistry } = require("./ledger.cjs");
const { redactUrl, validateEventPayload } = require("./contracts.cjs");
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const RESOLUTIONS = ["false_positive", "remediated", "risk_accepted"];
function setup({ organizationId, trust, maxCases = 1000 }) {
  need(
    uuid(organizationId) &&
      Number.isSafeInteger(maxCases) &&
      maxCases > 0 &&
      maxCases <= 10000 &&
      trust &&
      identifier(trust.serverKeyId),
    "CASES_CONFIG_INVALID",
  );
  const publicOnly = (key) =>
    key?.type === "public" ||
    (typeof key === "string" &&
      /^-----BEGIN PUBLIC KEY-----\r?\n/.test(key) &&
      !key.includes("PRIVATE KEY"));
  need(
    publicOnly(trust.serverPublicKey) &&
      Array.isArray(trust.registrations) &&
      trust.registrations.every(
        (r) => r.organizationId === organizationId && publicOnly(r.publicKey),
      ),
    "CASES_PUBLIC_TRUST_REQUIRED",
  );
  const serverKey =
    trust.serverPublicKey?.type === "public"
      ? trust.serverPublicKey
      : crypto.createPublicKey(trust.serverPublicKey);
  need(serverKey.asymmetricKeyType === "ed25519", "CASES_TRUST_INVALID");
  const registry = deviceRegistry(trust.registrations);
  const registrations = [...registry.values()]
    .map((r) => ({
      ...r,
      publicKey: r.publicKey.export({ type: "spki", format: "pem" }),
    }))
    .sort((a, b) => (a.keyId < b.keyId ? -1 : a.keyId > b.keyId ? 1 : 0));
  const normalized = {
    serverKeyId: trust.serverKeyId,
    serverPublicKey: serverKey.export({ type: "spki", format: "pem" }),
    registrations,
  };
  const sourceId = crypto
    .createHash("sha256")
    .update(serverKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  const scope = {
    kind: "incident-cases-v1",
    organizationId,
    trustId: hash(normalized),
    maxCases,
  };
  const reducer = (state, p) => {
    const d = p.data;
    need(d && hex(d.caseId) && identifier(d.actorId), "CASES_ACTION_INVALID");
    if (p.kind === "CREATED") {
      need(
        exact(d, "caseId,actorId,incident,ruleSet,source") &&
          !Object.hasOwn(state.cases, d.caseId) &&
          Object.keys(state.cases).length < maxCases,
        "CASES_CREATE_INVALID",
      );
      const i = d.incident,
        r = d.ruleSet,
        s = d.source;
      need(
        exact(
          i,
          "incidentId,ruleId,severity,organizationId,deviceId,streamEpoch,interactionId,decisionEventId,eventEnvelopeHash,receiptHash,decisionAt,outcome,attemptNumber,urlMode,urlRedacted,policyId,policyVersion,assessmentAtDecision",
        ) &&
          exact(r, "organizationId,ruleSetId,version,hash") &&
          exact(s, "sourceId,tailReceiptHash,headPinned") &&
          i.organizationId === organizationId &&
          r.organizationId === organizationId &&
          s.sourceId === sourceId &&
          hex(s.tailReceiptHash) &&
          typeof s.headPinned === "boolean" &&
          i.incidentId === d.caseId &&
          [
            i.deviceId,
            i.streamEpoch,
            i.interactionId,
            i.decisionEventId,
            i.policyId,
          ].every(uuid) &&
          [i.eventEnvelopeHash, i.receiptHash, r.hash].every(hex) &&
          identifier(i.ruleId) &&
          identifier(r.ruleSetId) &&
          Number.isSafeInteger(r.version) &&
          r.version > 0 &&
          Number.isSafeInteger(i.policyVersion) &&
          i.policyVersion > 0 &&
          Number.isSafeInteger(i.attemptNumber) &&
          i.attemptNumber >= 0 &&
          ["low", "medium", "high", "critical"].includes(i.severity) &&
          ["OPENED", "ABORTED", "BLOCKED", "OPEN_ERROR"].includes(i.outcome) &&
          Number.isFinite(Date.parse(i.decisionAt)) &&
          i.urlMode === "domain_only" &&
          redactUrl(i.urlRedacted).urlRedacted === i.urlRedacted,
        "CASES_INCIDENT_INVALID",
      );
      const a = i.assessmentAtDecision;
      need(
        exact(
          a,
          "localScore,modelVersion,providerVerdict,provider,observedAt,reasonCodes",
        ) &&
          (a.localScore === null ||
            (Number.isInteger(a.localScore) &&
              a.localScore >= 0 &&
              a.localScore <= 100)) &&
          Array.isArray(a.reasonCodes) &&
          a.reasonCodes.length <= 100 &&
          (a.observedAt === null ||
            (Number.isFinite(Date.parse(a.observedAt)) &&
              Date.parse(a.observedAt) <= Date.parse(i.decisionAt))),
        "CASES_ASSESSMENT_INVALID",
      );
      validateEventPayload(
        {
          schemaVersion: 2,
          eventId: i.decisionEventId,
          interactionId: i.interactionId,
          deviceId: i.deviceId,
          streamEpoch: i.streamEpoch,
          sequence: 1,
          observedAt: i.decisionAt,
          kind: "DECISION",
          outcome: i.outcome,
          attemptNumber: i.attemptNumber,
          policyId: i.policyId,
          policyVersion: i.policyVersion,
          extensionVersion: "1.22.0",
          urlMode: i.urlMode,
          urlRedacted: i.urlRedacted,
          assessment: a,
          reason: {
            OPENED: null,
            ABORTED: "cancel",
            BLOCKED: "policy_block",
            OPEN_ERROR: "browser_error",
          }[i.outcome],
        },
        {
          deviceId: i.deviceId,
          streamEpoch: i.streamEpoch,
          policyId: i.policyId,
        },
      );
      need(
        d.caseId ===
          hash({
            sourceId,
            organizationId,
            eventId: i.decisionEventId,
            eventEnvelopeHash: i.eventEnvelopeHash,
            ruleSetHash: r.hash,
            ruleId: i.ruleId,
          }),
        "CASES_IDENTITY_INVALID",
      );
      state.cases[d.caseId] = {
        caseId: d.caseId,
        incident: clone(i),
        ruleSet: clone(r),
        source: clone(s),
        status: "NEW",
        revision: 1,
        assigneeId: null,
        resolutionCode: null,
        createdAt: p.at,
        updatedAt: p.at,
        history: [],
      };
    } else {
      const c = state.cases[d.caseId];
      need(
        c &&
          Number.isSafeInteger(d.expectedRevision) &&
          d.expectedRevision === c.revision,
        "CASES_REVISION_CONFLICT",
      );
      if (p.kind === "ASSIGNED") {
        need(
          exact(d, "caseId,actorId,expectedRevision,assigneeId") &&
            c.status !== "RESOLVED" &&
            (d.assigneeId === null || identifier(d.assigneeId)),
          "CASES_ASSIGNMENT_INVALID",
        );
        c.assigneeId = d.assigneeId;
      } else if (p.kind === "TRANSITIONED") {
        need(
          exact(d, "caseId,actorId,expectedRevision,to,resolutionCode") &&
            (
              {
                NEW: ["ACKNOWLEDGED"],
                ACKNOWLEDGED: ["IN_PROGRESS"],
                IN_PROGRESS: ["RESOLVED"],
              }[c.status] || []
            ).includes(d.to) &&
            (d.to === "RESOLVED"
              ? RESOLUTIONS.includes(d.resolutionCode)
              : d.resolutionCode === null),
          "CASES_TRANSITION_INVALID",
        );
        c.status = d.to;
        c.resolutionCode = d.resolutionCode;
      } else if (p.kind === "REOPENED") {
        need(
          exact(d, "caseId,actorId,expectedRevision") &&
            c.status === "RESOLVED",
          "CASES_REOPEN_INVALID",
        );
        c.status = "IN_PROGRESS";
        c.resolutionCode = null;
      } else throw new Error("CASES_ACTION_INVALID");
      c.revision++;
      c.updatedAt = p.at;
    }
    const c = state.cases[d.caseId];
    c.history.push({
      index: p.index,
      at: p.at,
      actorId: d.actorId,
      action: p.kind,
      revision: c.revision,
      status: c.status,
      assigneeId: c.assigneeId,
      resolutionCode: c.resolutionCode,
    });
    return state;
  };
  return { scope, reducer, trust: normalized };
}
function status(state, head) {
  const cases = Object.values(state.cases),
    counts = { NEW: 0, ACKNOWLEDGED: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const c of cases) counts[c.status]++;
  return {
    schemaVersion: 1,
    kind: "thundy-incident-case-status",
    head,
    counts,
    cases,
    sealed: false,
    authorizationMode: "trusted-local-operator",
    ssoIntegrated: false,
  };
}
class IncidentCases {
  constructor({
    directory,
    signerKeyId,
    signerPrivateKey,
    organizationId,
    trust,
    maxCases = 1000,
    ...options
  }) {
    need(
      Object.keys(options).every((k) =>
        ["clock", "io", "maxBytes", "maxActions", "expectedHead"].includes(k),
      ),
      "CASES_OPTION_UNSUPPORTED",
    );
    const config = setup({ organizationId, trust, maxCases });
    Object.assign(this, { trust: config.trust, organizationId, maxCases });
    this.journal = new DurableJournal({
      directory,
      signerKeyId,
      signerPrivateKey,
      ...options,
      scope: config.scope,
      reducer: config.reducer,
      initialState: { cases: {} },
    });
  }
  static verifyJournal(
    content,
    { organizationId, trust, maxCases = 1000, ...options },
  ) {
    need(
      Object.keys(options).every((k) =>
        [
          "signerKeyId",
          "signerPublicKey",
          "maxBytes",
          "maxActions",
          "expectedHead",
        ].includes(k),
      ),
      "CASES_OPTION_UNSUPPORTED",
    );
    const config = setup({ organizationId, trust, maxCases }),
      verified = DurableJournal.verify(content, {
        ...options,
        scope: config.scope,
        reducer: config.reducer,
        initialState: { cases: {} },
      });
    return {
      ...status(verified.state, verified.head),
      verification: {
        actionCount: verified.actionCount,
        headPinned: verified.headPinned,
        signerFingerprint: verified.signerFingerprint,
        signaturesVerified: true,
        originalDeviceEvidenceReverified: false,
      },
    };
  }
  ingest(data, rules, { actorId, expectedHead } = {}) {
    need(
      identifier(actorId) && rules?.organizationId === this.organizationId,
      "CASES_SCOPE_INVALID",
    );
    this.journal.now();
    const report = deriveIncidents(data, rules, {
        ...this.trust,
        ...(expectedHead !== undefined ? { expectedHead } : {}),
      }),
      state = this.journal.snapshot(),
      newCases = [],
      results = [];
    for (const incident of report.incidents) {
      const old = state.cases[incident.incidentId];
      need(
        !old ||
          (hash(old.incident) === hash(incident) &&
            hash(old.ruleSet) === hash(report.ruleSet)),
        "CASES_ID_CONFLICT",
      );
      if (!old)
        newCases.push({
          caseId: incident.incidentId,
          actorId,
          incident,
          ruleSet: report.ruleSet,
          source: {
            sourceId: report.evidence.sourceId,
            tailReceiptHash: report.evidence.tailReceiptHash,
            headPinned: report.evidence.headPinned,
          },
        });
      results.push({ caseId: incident.incidentId, duplicate: !!old });
    }
    need(
      Object.keys(state.cases).length + newCases.length <= this.maxCases,
      "CASES_CAPACITY",
    );
    need(
      this.journal.records.length + newCases.length <=
        this.journal.maxActions &&
        this.journal.bytes +
          newCases.reduce(
            (n, c) => n + Buffer.byteLength(JSON.stringify(c)) + 1024,
            0,
          ) <=
          this.journal.maxBytes,
      "JOURNAL_CAPACITY",
    );
    for (const c of newCases) this.journal.append("CREATED", c);
    return results;
  }
  assign(caseId, { actorId, expectedRevision, assigneeId }) {
    this.journal.append("ASSIGNED", {
      caseId,
      actorId,
      expectedRevision,
      assigneeId,
    });
    return this.status();
  }
  transition(caseId, { actorId, expectedRevision, to, resolutionCode = null }) {
    this.journal.append("TRANSITIONED", {
      caseId,
      actorId,
      expectedRevision,
      to,
      resolutionCode,
    });
    return this.status();
  }
  reopen(caseId, { actorId, expectedRevision }) {
    this.journal.append("REOPENED", { caseId, actorId, expectedRevision });
    return this.status();
  }
  status() {
    return status(this.journal.snapshot(), this.journal.head());
  }
  close() {
    this.journal.close();
  }
}
module.exports = { IncidentCases };
