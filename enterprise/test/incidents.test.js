"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { Ledger, signed, hash } = require("../ledger.cjs");
const { deriveIncidents, validateRules } = require("../incidents.cjs");
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-incidents-"));
  const server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519");
  const registration = {
    keyId: "device",
    organizationId: crypto.randomUUID(),
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: crypto.randomUUID(),
    policyVersion: 1,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const ledger = new Ledger({
    directory,
    registrations: [registration],
    serverKeyId: "server",
    serverPrivateKey: server.privateKey.export({
      type: "pkcs8",
      format: "pem",
    }),
  });
  const trust = {
    serverPublicKey: server.publicKey,
    serverKeyId: "server",
    registrations: [registration],
  };
  const rules = {
    schemaVersion: 1,
    organizationId: registration.organizationId,
    ruleSetId: "risk",
    version: 1,
    rules: [
      {
        id: "risky-open",
        outcomes: ["OPENED"],
        minScore: 70,
        matchUnknownScore: false,
        providerVerdicts: [],
        severity: "high",
      },
    ],
  };
  let sequence = 0;
  const interactionId = crypto.randomUUID();
  const add = (changes = {}) => {
    const event = {
      schemaVersion: 2,
      eventId: crypto.randomUUID(),
      interactionId,
      deviceId: registration.deviceId,
      streamEpoch: registration.streamEpoch,
      sequence: ++sequence,
      observedAt: "2026-10-14T09:00:00Z",
      kind: "CLICKED",
      outcome: null,
      attemptNumber: 0,
      policyId: registration.policyId,
      policyVersion: 1,
      extensionVersion: "1.22.0",
      urlMode: "domain_only",
      urlRedacted: "https://example.org",
      assessment: {
        localScore: 80,
        modelVersion: "test-v1",
        providerVerdict: "UNKNOWN",
        provider: "none",
        observedAt: "2026-10-14T09:00:00Z",
        reasonCodes: [],
      },
      reason: null,
      ...changes,
    };
    ledger.accept(signed(event, "device", device.privateKey));
    return event;
  };
  const data = () => ({
    kind: "thundy-staged-journal-export",
    schemaVersion: 1,
    records: ledger.exportRecords(),
  });
  return {
    add,
    data,
    trust,
    rules,
    server,
    ledger,
    cleanup() {
      ledger.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}
function opened(f) {
  f.add();
  f.add({ kind: "OPEN_INTENT", attemptNumber: 1 });
  return f.add({ kind: "DECISION", outcome: "OPENED", attemptNumber: 1 });
}
test("decision snapshot remains unchanged after later scores and reprocessing", () => {
  const f = fixture();
  try {
    const decision = opened(f),
      first = deriveIncidents(f.data(), f.rules, f.trust);
    assert.equal(first.incidents.length, 1);
    assert.equal(first.incidents[0].decisionEventId, decision.eventId);
    f.add({
      kind: "ASSESSMENT_UPDATED",
      attemptNumber: 1,
      assessment: {
        localScore: 1,
        modelVersion: "test-v2",
        providerVerdict: "UNKNOWN",
        provider: "none",
        observedAt: "2026-10-14T09:00:00Z",
        reasonCodes: [],
      },
    });
    const updated = deriveIncidents(f.data(), f.rules, f.trust);
    assert.deepEqual(updated.incidents, first.incidents);
    assert.deepEqual(updated, deriveIncidents(f.data(), f.rules, f.trust));
    first.incidents[0].assessmentAtDecision.localScore = 0;
    assert.equal(updated.incidents[0].assessmentAtDecision.localScore, 80);
    assert.equal(updated.evidence.sealed, false);
  } finally {
    f.cleanup();
  }
});
test("abort with unknown score is explicit and late high assessment is not a decision", () => {
  const f = fixture();
  try {
    f.add();
    f.add({
      kind: "DECISION",
      outcome: "ABORTED",
      reason: "cancel",
      assessment: {
        localScore: null,
        modelVersion: null,
        providerVerdict: "UNKNOWN",
        provider: "none",
        observedAt: null,
        reasonCodes: [],
      },
    });
    f.add({ kind: "ASSESSMENT_UPDATED" });
    f.rules.rules[0].outcomes = ["ABORTED"];
    assert.equal(
      deriveIncidents(f.data(), f.rules, f.trust).incidents.length,
      0,
    );
    f.rules.rules[0].matchUnknownScore = true;
    const report = deriveIncidents(f.data(), f.rules, f.trust);
    assert.equal(report.incidents[0].assessmentAtDecision.localScore, null);
    assert.equal(report.decisionsEvaluated, 1);
    f.rules.rules[0].providerVerdicts = ["MALICIOUS"];
    assert.equal(
      deriveIncidents(f.data(), f.rules, f.trust).incidents.length,
      0,
    );
  } finally {
    f.cleanup();
  }
});
test("failed opening and successful retry have distinct rule-bound identities", () => {
  const f = fixture();
  try {
    f.rules.rules[0].outcomes = ["OPENED", "OPEN_ERROR"];
    f.add();
    f.add({ kind: "OPEN_INTENT", attemptNumber: 1 });
    f.add({
      kind: "DECISION",
      outcome: "OPEN_ERROR",
      reason: "browser_error",
      attemptNumber: 1,
    });
    f.add({ kind: "OPEN_INTENT", attemptNumber: 2 });
    f.add({ kind: "DECISION", outcome: "OPENED", attemptNumber: 2 });
    const a = deriveIncidents(f.data(), f.rules, f.trust);
    assert.equal(a.incidents.length, 2);
    assert.notEqual(a.incidents[0].incidentId, a.incidents[1].incidentId);
    f.rules.version = 2;
    assert.notEqual(
      deriveIncidents(f.data(), f.rules, f.trust).incidents[0].incidentId,
      a.incidents[0].incidentId,
    );
    f.rules.version = 1;
    f.rules.rules[0].outcomes.reverse();
    assert.deepEqual(deriveIncidents(f.data(), f.rules, f.trust), a);
    f.rules.rules[0].severity = "critical";
    assert.notEqual(
      deriveIncidents(f.data(), f.rules, f.trust).incidents[0].incidentId,
      a.incidents[0].incidentId,
    );
  } finally {
    f.cleanup();
  }
});
test("reject unsigned/tampered input, wrong roots, organisation and missing device trust", () => {
  const f = fixture();
  try {
    opened(f);
    const data = f.data();
    for (const trust of [
      { ...f.trust, registrations: null },
      { ...f.trust, serverKeyId: "other" },
      {
        ...f.trust,
        serverPublicKey: crypto.generateKeyPairSync("ed25519").publicKey,
      },
    ])
      assert.throws(() => deriveIncidents(data, f.rules, trust));
    f.rules.organizationId = crypto.randomUUID();
    assert.throws(
      () => deriveIncidents(data, f.rules, f.trust),
      /INCIDENT_ORGANIZATION_MISMATCH/,
    );
    f.rules.organizationId = f.trust.registrations[0].organizationId;
    data.records[2].eventEnvelope.payload.assessment.localScore = 99;
    assert.throws(() => deriveIncidents(data, f.rules, f.trust));
    const forged = f.data();
    forged.records[2].eventEnvelope.signature = "A".repeat(86);
    const p = forged.records[2].receipt.payload;
    p.envelopeHash = hash(forged.records[2].eventEnvelope);
    forged.records[2].receipt = signed(p, "server", f.server.privateKey);
    assert.throws(
      () => deriveIncidents(forged, f.rules, f.trust),
      /SIGNATURE_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
test("externally pinned tail detects valid prefix truncation", () => {
  const f = fixture();
  try {
    opened(f);
    const data = f.data(),
      head = hash(data.records.at(-1).receipt);
    assert.equal(
      deriveIncidents(data, f.rules, { ...f.trust, expectedHead: head })
        .evidence.headPinned,
      true,
    );
    data.records.pop();
    assert.throws(
      () => deriveIncidents(data, f.rules, { ...f.trust, expectedHead: head }),
      /INCIDENT_HEAD_MISMATCH/,
    );
    assert.equal(
      deriveIncidents(data, f.rules, f.trust).evidence.headPinned,
      false,
    );
  } finally {
    f.cleanup();
  }
});
test("reject ambiguous or unbounded rules and payloads", () => {
  const f = fixture();
  try {
    for (const modify of [
      (r) => (r.extra = true),
      (r) => (r.version = 0),
      (r) => r.rules.push({ ...r.rules[0] }),
      (r) => (r.rules[0].outcomes = []),
      (r) => (r.rules[0].minScore = 101),
      (r) => (r.rules[0].providerVerdicts = ["invented"]),
      (r) => (r.rules[0].outcomes = ["OPENED", "OPENED"]),
      (r) => (r.rules[0].matchUnknownScore = 1),
      (r) => (r.rules[0].severity = "urgent"),
    ]) {
      const rules = structuredClone(f.rules);
      modify(rules);
      assert.throws(() => validateRules(rules));
    }
    assert.throws(
      () =>
        deriveIncidents(
          { padding: "x".repeat(16 * 1024 * 1024) },
          f.rules,
          f.trust,
        ),
      /INCIDENT_INPUT_CAPACITY/,
    );
    const empty = deriveIncidents(f.data(), f.rules, {
      ...f.trust,
      expectedHead: null,
    });
    assert.equal(empty.decisionsEvaluated, 0);
    assert.deepEqual(empty.incidents, []);
  } finally {
    f.cleanup();
  }
});
test("threshold boundary and blocked outcomes match only their explicit rules", () => {
  const f = fixture();
  try {
    f.add();
    f.add({ kind: "DECISION", outcome: "BLOCKED", reason: "policy_block" });
    assert.equal(
      deriveIncidents(f.data(), f.rules, f.trust).incidents.length,
      0,
    );
    f.rules.rules[0].outcomes = ["BLOCKED"];
    f.rules.rules[0].minScore = 81;
    assert.equal(
      deriveIncidents(f.data(), f.rules, f.trust).incidents.length,
      0,
    );
    f.rules.rules[0].minScore = 80;
    assert.equal(
      deriveIncidents(f.data(), f.rules, f.trust).incidents.length,
      1,
    );
  } finally {
    f.cleanup();
  }
});
test("CLI creates bounded public-key report without changing writer or overwriting output", () => {
  const { spawnSync } = require("node:child_process");
  const f = fixture();
  try {
    opened(f);
    const file = (name) => path.join(path.dirname(f.ledger.journalPath), name);
    for (const [name, value] of [
      ["export.json", f.data()],
      ["rules.json", f.rules],
      ["registry.json", { registrations: f.trust.registrations }],
    ])
      fs.writeFileSync(file(name), JSON.stringify(value));
    fs.writeFileSync(
      file("public.pem"),
      f.server.publicKey.export({ type: "spki", format: "pem" }),
    );
    const before = fs.readFileSync(f.ledger.journalPath),
      lock = fs.readFileSync(f.ledger.lockPath);
    const args = [
      "enterprise/incidents_cli.cjs",
      "--export",
      file("export.json"),
      "--rules",
      file("rules.json"),
      "--registry",
      file("registry.json"),
      "--server-public-key",
      file("public.pem"),
      "--server-key-id",
      "server",
      "--out",
      file("report.json"),
      "--expected-head",
      hash(f.data().records.at(-1).receipt),
    ];
    const run = (changes) =>
      spawnSync(process.execPath, [...args, ...changes], { encoding: "utf8" });
    assert.equal(run([]).status, 0);
    const report = JSON.parse(fs.readFileSync(file("report.json")));
    assert.equal(report.incidents.length, 1);
    assert.equal(report.evidence.headPinned, true);
    assert.equal(fs.statSync(file("report.json")).mode & 0o077, 0);
    assert.notEqual(run([]).status, 0);
    assert.notEqual(run(["--private-key", "sensitive"]).status, 0);
    assert.deepEqual(fs.readFileSync(f.ledger.journalPath), before);
    assert.deepEqual(fs.readFileSync(f.ledger.lockPath), lock);
    fs.unlinkSync(file("report.json"));
    fs.writeFileSync(
      file("public.pem"),
      f.server.privateKey.export({ type: "pkcs8", format: "pem" }),
    );
    const error = run([]);
    assert.notEqual(error.status, 0);
    assert.ok(!error.stderr.includes("PRIVATE KEY"));
    assert.ok(!fs.existsSync(file("report.json")));
    fs.writeFileSync(
      file("public.pem"),
      f.server.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.renameSync(file("export.json"), file("real.json"));
    fs.symlinkSync(file("real.json"), file("export.json"));
    assert.notEqual(run([]).status, 0);
    assert.ok(!fs.existsSync(file("report.json")));
  } finally {
    f.cleanup();
  }
});
test("incident fan-out is bounded without returning a partial report", () => {
  const f = fixture();
  try {
    f.rules.rules = Array.from({ length: 100 }, (_, i) => ({
      ...f.rules.rules[0],
      id: "rule-" + i,
      outcomes: ["ABORTED"],
    }));
    for (let i = 0; i < 101; i++) {
      const interactionId = crypto.randomUUID();
      f.add({ interactionId });
      f.add({
        interactionId,
        kind: "DECISION",
        outcome: "ABORTED",
        reason: "cancel",
      });
    }
    assert.throws(
      () => deriveIncidents(f.data(), f.rules, f.trust),
      /INCIDENT_OUTPUT_CAPACITY/,
    );
  } finally {
    f.cleanup();
  }
});
