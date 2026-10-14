"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  canonicalize = require("canonicalize"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Ledger, signed, hash } = require("../ledger.cjs"),
  { simulate } = require("../policy_simulation.cjs"),
  example = require("../../docs/enterprise/policy.example.json");
function fixture(assessmentChanges = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-simulation-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519"),
    issuer = crypto.generateKeyPairSync("ed25519"),
    now = Date.parse("2026-10-14T12:00:00Z");
  const r = {
    keyId: "device",
    organizationId: example.organizationId,
    deviceId: crypto.randomUUID(),
    streamEpoch: crypto.randomUUID(),
    policyId: example.policyId,
    policyVersion: 3,
    revoked: false,
    publicKey: device.publicKey.export({ type: "spki", format: "pem" }),
  };
  const ledger = new Ledger({
    directory: path.join(root, "ledger"),
    registrations: [r],
    serverKeyId: "server",
    serverPrivateKey: server.privateKey.export({
      type: "pkcs8",
      format: "pem",
    }),
  });
  let sequence = 0;
  const assessment = {
    localScore: 60,
    modelVersion: "v1",
    providerVerdict: "CLEAN",
    provider: "hybridanalysis",
    observedAt: "2026-10-14T09:00:00Z",
    reasonCodes: [],
    ...assessmentChanges,
  };
  const add = (changes = {}) =>
    ledger.accept(
      signed(
        {
          schemaVersion: 2,
          eventId: crypto.randomUUID(),
          interactionId,
          deviceId: r.deviceId,
          streamEpoch: r.streamEpoch,
          sequence: ++sequence,
          observedAt: "2026-10-14T09:00:00Z",
          kind: "CLICKED",
          outcome: null,
          attemptNumber: 0,
          policyId: r.policyId,
          policyVersion: 3,
          extensionVersion: "1.22.0",
          urlMode: "domain_only",
          urlRedacted: "https://example.org",
          assessment,
          reason: null,
          ...changes,
        },
        "device",
        device.privateKey,
      ),
    );
  const interactionId = crypto.randomUUID();
  add();
  add({ kind: "OPEN_INTENT", attemptNumber: 1 });
  add({ kind: "DECISION", outcome: "OPENED", attemptNumber: 1 });
  const sign = (version, edit = () => {}) => {
    const payload = structuredClone(example);
    payload.version = version;
    edit(payload);
    return {
      keyId: "issuer",
      payload,
      signature: crypto
        .sign(null, Buffer.from(canonicalize(payload)), issuer.privateKey)
        .toString("base64url"),
    };
  };
  const policyContext = {
    organizationId: example.organizationId,
    policyId: example.policyId,
    groupIds: ["pilot"],
    capabilities: [...example.requiredCapabilities],
    clientVersion: "1.22.0",
    highestVersion: 3,
    trustedKeys: new Map([
      [
        "issuer",
        {
          organizationId: example.organizationId,
          publicKey: issuer.publicKey,
          notBefore: now - 86400000,
          notAfter: now + 86400000,
          revokedAt: null,
        },
      ],
    ]),
  };
  const options = () => ({
    baseline: sign(3),
    candidate: sign(4, (p) => {
      p.openingRules.blockScore = 55;
      p.openingRules.warnScore = 40;
    }),
    data: {
      schemaVersion: 1,
      kind: "thundy-staged-journal-export",
      records: ledger.exportRecords(),
    },
    policyContext,
    eventTrust: {
      serverKeyId: "server",
      serverPublicKey: server.publicKey,
      registrations: [r],
    },
    now,
  });
  return {
    root,
    issuer,
    server,
    sign,
    add,
    options,
    policyContext,
    cleanup() {
      ledger.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
test("signed policy comparison uses decision score and never activates policy", () => {
  const f = fixture();
  try {
    const options = f.options(),
      before = hash(options.data),
      r = simulate(options);
    assert.equal(r.results[0].assessmentAtDecision.localScore, 60);
    assert.equal(r.results[0].baselineModeled.action, "justification_required");
    assert.equal(r.results[0].candidateModeled.action, "block");
    assert.equal(r.counts.more_restrictive, 1);
    assert.ok(r.diff.some((d) => d.path === "/openingRules/blockScore"));
    assert.equal(r.opened, false);
    assert.equal(r.sealed, false);
    assert.equal(r.policyActivated, false);
    assert.equal(hash(options.data), before);
    assert.equal(f.policyContext.highestVersion, 3);
  } finally {
    f.cleanup();
  }
});
test("late assessments do not rewrite historical impact and repeated runs are deterministic", () => {
  const f = fixture();
  try {
    const first = simulate(f.options());
    f.add({
      kind: "ASSESSMENT_UPDATED",
      attemptNumber: 1,
      assessment: {
        localScore: 1,
        modelVersion: "v2",
        providerVerdict: "CLEAN",
        provider: "hybridanalysis",
        observedAt: "2026-10-14T09:00:00Z",
        reasonCodes: [],
      },
    });
    const second = simulate(f.options());
    assert.deepEqual(second.results, first.results);
    assert.deepEqual(second, simulate(f.options()));
  } finally {
    f.cleanup();
  }
});
test("unknown and malicious scores cannot become hypothetical successful opening", () => {
  const f = fixture();
  try {
    const options = f.options();
    options.candidate = f.sign(4, (p) => {
      p.openingRules.warnScore = 70;
      p.openingRules.blockScore = 90;
    });
    const relaxed = simulate(options);
    assert.equal(relaxed.counts.different_gate, 1);
    assert.equal(
      relaxed.results[0].candidateModeled.action,
      "wait_for_receipt",
    );
    const unavailable = simulate({ ...options, scenario: "audit_unavailable" });
    assert.equal(
      unavailable.results[0].candidateModeled.reason,
      "AUDIT_UNAVAILABLE",
    );
    assert.equal(unavailable.assumptions.intentSealed, false);
    assert.throws(
      () => simulate({ ...options, scenario: "sealed" }),
      /SIMULATION_SCENARIO_INVALID/,
    );
  } finally {
    f.cleanup();
  }
});
test("foreign groups, bad signatures, rollback and expired policies are rejected", () => {
  const f = fixture();
  try {
    const options = f.options();
    const forged = structuredClone(options.candidate);
    forged.payload.openingRules.blockScore = 60;
    assert.throws(
      () => simulate({ ...options, candidate: forged }),
      /POLICY_SIGNATURE_INVALID/,
    );
    assert.throws(
      () => simulate({ ...options, candidate: f.sign(3) }),
      /SIMULATION_VERSION_NOT_INCREASING/,
    );
    assert.throws(
      () =>
        simulate({
          ...options,
          policyContext: { ...f.policyContext, groupIds: ["foreign"] },
        }),
      /POLICY_SCOPE_DENIED/,
    );
    assert.throws(
      () =>
        simulate({
          ...options,
          policyContext: { ...f.policyContext, highestVersion: 4 },
        }),
      /POLICY_ROLLBACK/,
    );
    assert.throws(
      () => simulate({ ...options, now: Date.parse("2026-10-15T08:00:00Z") }),
      /POLICY_EXPIRED/,
    );
    f.policyContext.trustedKeys.get("issuer").revokedAt = options.now;
    assert.throws(() => simulate(options), /POLICY_KEY_INACTIVE/);
  } finally {
    f.cleanup();
  }
});
test("forged events, missing device trust and external head mismatch fail closed", () => {
  const f = fixture();
  try {
    const options = f.options();
    assert.throws(
      () =>
        simulate({
          ...options,
          eventTrust: { ...options.eventTrust, registrations: null },
        }),
      /SIMULATION_EVENT_TRUST_REQUIRED/,
    );
    assert.throws(
      () =>
        simulate({
          ...options,
          eventTrust: { ...options.eventTrust, expectedHead: "a".repeat(64) },
        }),
      /SIMULATION_HEAD_MISMATCH/,
    );
    const bad = structuredClone(options.data);
    bad.records[2].eventEnvelope.payload.assessment.localScore = 0;
    assert.throws(() => simulate({ ...options, data: bad }));
    assert.equal(
      simulate({
        ...options,
        eventTrust: {
          ...options.eventTrust,
          expectedHead: hash(options.data.records.at(-1).receipt),
        },
      }).evidence.headPinned,
      true,
    );
  } finally {
    f.cleanup();
  }
});
test("semantic set reorder produces no array diff; unrelated baseline version is counted as skipped", () => {
  const f = fixture();
  try {
    const options = f.options();
    options.candidate = f.sign(4, (p) => p.requiredCapabilities.reverse());
    assert.ok(
      !simulate(options).diff.some((d) => d.path === "/requiredCapabilities"),
    );
    options.baseline = f.sign(2);
    options.policyContext = { ...options.policyContext, highestVersion: 2 };
    const r = simulate(options);
    assert.equal(r.evaluatedDecisions, 0);
    assert.equal(r.skippedDecisions, 1);
  } finally {
    f.cleanup();
  }
});
test("unknown remains unknown and malicious provider verdict outranks low score", () => {
  for (const assessment of [
    {
      localScore: null,
      modelVersion: null,
      providerVerdict: "UNKNOWN",
      provider: "none",
      observedAt: null,
    },
    { localScore: 0, providerVerdict: "MALICIOUS" },
  ]) {
    const f = fixture(assessment);
    try {
      const options = f.options();
      options.candidate = f.sign(4, (p) => {
        p.openingRules.warnScore = 70;
        p.openingRules.blockScore = 90;
      });
      const r = simulate(options);
      assert.equal(
        r.results[0].assessmentAtDecision.localScore,
        assessment.localScore,
      );
      assert.equal(
        r.results[0].candidateModeled.action,
        assessment.providerVerdict === "MALICIOUS"
          ? "block"
          : "justification_required",
      );
    } finally {
      f.cleanup();
    }
  }
});
test("CLI uses only public keys, creates private report and rejects secret config fields", () => {
  const { spawnSync } = require("node:child_process");
  const f = fixture();
  try {
    const file = (name) => path.join(f.root, name),
      write = (name, value) =>
        fs.writeFileSync(file(name), JSON.stringify(value));
    fs.writeFileSync(
      file("issuer.pem"),
      f.issuer.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("server.pem"),
      f.server.publicKey.export({ type: "spki", format: "pem" }),
    );
    const options = f.options(),
      now = Date.now(),
      edit = (p) => {
        p.issuedAt = new Date(now - 1000).toISOString();
        p.expiresAt = new Date(now + 3600000).toISOString();
      };
    write("baseline.json", f.sign(3, edit));
    write("candidate.json", f.sign(4, edit));
    write("events.json", options.data);
    write("registry.json", { registrations: options.eventTrust.registrations });
    const c = {
      schemaVersion: 1,
      organizationId: example.organizationId,
      policyId: example.policyId,
      groupIds: ["pilot"],
      capabilities: example.requiredCapabilities,
      clientVersion: "1.22.0",
      highestVersion: 3,
      policyKeys: [
        {
          keyId: "issuer",
          publicKeyFile: file("issuer.pem"),
          notBefore: new Date(now - 86400000).toISOString(),
          notAfter: new Date(now + 86400000).toISOString(),
          revokedAt: null,
        },
      ],
      serverKeyId: "server",
      serverPublicKeyFile: file("server.pem"),
      registryFile: file("registry.json"),
    };
    write("config.json", c);
    const run = () =>
      spawnSync(
        process.execPath,
        [
          "enterprise/policy_simulation_cli.cjs",
          "--baseline",
          file("baseline.json"),
          "--candidate",
          file("candidate.json"),
          "--export",
          file("events.json"),
          "--config",
          file("config.json"),
          "--out",
          file("report.json"),
        ],
        { encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    assert.equal(
      JSON.parse(fs.readFileSync(file("report.json"))).policyActivated,
      false,
    );
    assert.equal(fs.statSync(file("report.json")).mode & 0o077, 0);
    assert.notEqual(run().status, 0);
    fs.unlinkSync(file("report.json"));
    write("config.json", { ...c, privateKey: "SECRET" });
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.ok(!rejected.stderr.includes("SECRET"));
    assert.ok(!fs.existsSync(file("report.json")));
  } finally {
    f.cleanup();
  }
});
test("queue-allowed candidate may model an intent but never grants a real opening", () => {
  const f = fixture();
  try {
    const options = f.options();
    options.candidate = f.sign(4, (p) => {
      p.openingRules.warnScore = 70;
      p.openingRules.blockScore = 90;
      p.openingRules.auditMode = "queueAllowed";
    });
    const report = simulate(options);
    assert.equal(report.counts.less_restrictive, 1);
    assert.equal(report.results[0].candidateModeled.action, "allow_intent");
    assert.equal(report.policyActivated, false);
    assert.equal(report.opened, false);
    assert.equal(report.assumptions.intentSealed, false);
  } finally {
    f.cleanup();
  }
});
