"use strict";
const crypto = require("node:crypto"),
  hash = (value) =>
    crypto.createHash("sha256").update(String(value)).digest("hex");
function fixture(count = 30) {
  const states = ["NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"],
    outcomes = ["OPENED", "ABORTED", "BLOCKED", "OPEN_ERROR"];
  return {
    schemaVersion: 1,
    kind: "thundy-incident-case-status",
    head: hash("journal"),
    sealed: false,
    verification: {
      signaturesVerified: true,
      originalDeviceEvidenceReverified: false,
      headPinned: false,
      signerFingerprint: hash("key"),
    },
    cases: Array.from({ length: count }, (_, i) => ({
      caseId: hash(i),
      status: states[i % 4],
      revision: 1,
      assigneeId: i % 2 ? "analyst-1" : null,
      resolutionCode: i % 4 === 3 ? "remediated" : null,
      ruleSet: { version: 1, hash: hash("rules") },
      incident: {
        severity: ["low", "medium", "high", "critical"][i % 4],
        outcome: outcomes[i % 4],
        urlMode: "domain_only",
        urlRedacted: "https://example" + i + ".org",
        assessmentAtDecision: {
          localScore: i % 5 === 0 ? null : 80,
          providerVerdict: "UNKNOWN",
          modelVersion: "model-1",
        },
        decisionAt: "2026-10-14T09:00:00.000Z",
        policyVersion: 3,
        ruleId: "rule-1",
        decisionEventId: crypto.randomUUID(),
        eventEnvelopeHash: hash("event" + i),
        receiptHash: hash("receipt" + i),
      },
      history: [
        {
          index: i + 1,
          at: "2026-10-14T10:00:00.000Z",
          actorId: "local-operator",
          action: "CREATED",
          status: states[i % 4],
          revision: 1,
          assigneeId: null,
          resolutionCode: null,
        },
      ],
    })),
  };
}
module.exports = { fixture };
