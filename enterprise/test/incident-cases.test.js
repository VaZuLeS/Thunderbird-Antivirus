"use strict";
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { Ledger, signed, hash } = require("../ledger.cjs"),
  { IncidentCases } = require("../incident_cases.cjs");
function fixture(extra = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "thundy-cases-")),
    server = crypto.generateKeyPairSync("ed25519"),
    device = crypto.generateKeyPairSync("ed25519"),
    writer = crypto.generateKeyPairSync("ed25519");
  const r = {
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
    directory: path.join(base, "ledger"),
    registrations: [r],
    serverKeyId: "server",
    serverPrivateKey: server.privateKey.export({
      type: "pkcs8",
      format: "pem",
    }),
  });
  const interactionId = crypto.randomUUID();
  let sequence = 0;
  for (const changes of [
    {},
    { kind: "OPEN_INTENT", attemptNumber: 1 },
    { kind: "DECISION", outcome: "OPENED", attemptNumber: 1 },
  ])
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
          policyVersion: 1,
          extensionVersion: "1.22.0",
          urlMode: "domain_only",
          urlRedacted: "https://example.org",
          assessment: {
            localScore: 80,
            modelVersion: "v1",
            providerVerdict: "UNKNOWN",
            provider: "none",
            observedAt: "2026-10-14T09:00:00Z",
            reasonCodes: [],
          },
          reason: null,
          ...changes,
        },
        "device",
        device.privateKey,
      ),
    );
  const data = {
    schemaVersion: 1,
    kind: "thundy-staged-journal-export",
    records: ledger.exportRecords(),
  };
  ledger.close();
  const trust = {
      serverKeyId: "server",
      serverPublicKey: server.publicKey,
      registrations: [r],
    },
    rules = {
      schemaVersion: 1,
      organizationId: r.organizationId,
      ruleSetId: "risk",
      version: 1,
      rules: [
        {
          id: "high-open",
          outcomes: ["OPENED"],
          minScore: 70,
          matchUnknownScore: false,
          providerVerdicts: [],
          severity: "high",
        },
      ],
    };
  const options = {
    directory: path.join(base, "cases"),
    organizationId: r.organizationId,
    trust,
    signerKeyId: "cases",
    signerPrivateKey: writer.privateKey,
    ...extra,
  };
  let store = new IncidentCases(options);
  const publicOptions = {
    organizationId: r.organizationId,
    trust,
    signerKeyId: "cases",
    signerPublicKey: writer.publicKey,
    maxCases: extra.maxCases || 1000,
  };
  return {
    base,
    writer,
    options,
    publicOptions,
    data,
    rules,
    get store() {
      return store;
    },
    ingest() {
      return store.ingest(data, rules, {
        actorId: "ingest",
        expectedHead: hash(data.records.at(-1).receipt),
      })[0].caseId;
    },
    restart() {
      store.close();
      store = new IncidentCases(options);
    },
    cleanup() {
      store.close();
      fs.rmSync(base, { recursive: true, force: true });
    },
  };
}
test("case lifecycle and assignment survive restart; reingest never reopens a resolved case", () => {
  const f = fixture();
  try {
    const caseId = f.ingest();
    f.store.assign(caseId, {
      actorId: "admin",
      expectedRevision: 1,
      assigneeId: "analyst-1",
    });
    f.store.transition(caseId, {
      actorId: "analyst-1",
      expectedRevision: 2,
      to: "ACKNOWLEDGED",
    });
    f.store.transition(caseId, {
      actorId: "analyst-1",
      expectedRevision: 3,
      to: "IN_PROGRESS",
    });
    f.store.transition(caseId, {
      actorId: "analyst-1",
      expectedRevision: 4,
      to: "RESOLVED",
      resolutionCode: "remediated",
    });
    f.restart();
    const item = f.store.status().cases[0];
    assert.equal(item.status, "RESOLVED");
    assert.equal(item.incident.assessmentAtDecision.localScore, 80);
    assert.equal(item.history.length, 5);
    assert.equal(item.assigneeId, "analyst-1");
    const head = f.store.status().head;
    assert.equal(
      f.store.ingest(f.data, f.rules, { actorId: "ingest" })[0].duplicate,
      true,
    );
    assert.equal(f.store.status().head, head);
    f.store.reopen(caseId, { actorId: "admin", expectedRevision: 5 });
    assert.equal(f.store.status().cases[0].revision, 6);
    assert.equal(f.store.status().cases[0].resolutionCode, null);
  } finally {
    f.cleanup();
  }
});
test("stale revisions, lifecycle shortcuts and arbitrary resolution text are rejected without append", () => {
  const f = fixture();
  try {
    const caseId = f.ingest(),
      head = f.store.status().head;
    assert.throws(
      () =>
        f.store.transition(caseId, {
          actorId: "admin",
          expectedRevision: 1,
          to: "RESOLVED",
          resolutionCode: "remediated",
        }),
      /CASES_TRANSITION_INVALID/,
    );
    assert.throws(
      () =>
        f.store.assign(caseId, {
          actorId: "admin",
          expectedRevision: 0,
          assigneeId: "a",
        }),
      /CASES_REVISION_CONFLICT/,
    );
    assert.throws(
      () => f.store.reopen(caseId, { actorId: "admin", expectedRevision: 1 }),
      /CASES_REOPEN_INVALID/,
    );
    assert.equal(f.store.status().head, head);
    f.store.transition(caseId, {
      actorId: "admin",
      expectedRevision: 1,
      to: "ACKNOWLEDGED",
    });
    f.store.transition(caseId, {
      actorId: "admin",
      expectedRevision: 2,
      to: "IN_PROGRESS",
    });
    assert.throws(
      () =>
        f.store.transition(caseId, {
          actorId: "admin",
          expectedRevision: 3,
          to: "RESOLVED",
          resolutionCode: "https://secret/?token=x",
        }),
      /CASES_TRANSITION_INVALID/,
    );
    assert.throws(
      () =>
        f.store.assign(caseId, {
          actorId: "admin",
          expectedRevision: 1,
          assigneeId: "b",
        }),
      /CASES_REVISION_CONFLICT/,
    );
  } finally {
    f.cleanup();
  }
});
test("public-key verification matches active writer without touching journal or lock", () => {
  const f = fixture();
  try {
    f.ingest();
    const file = f.store.journal.logPath,
      lock = f.store.journal.lockPath,
      before = fs.readFileSync(file),
      lockBefore = fs.readFileSync(lock),
      verified = IncidentCases.verifyJournal(before, {
        ...f.publicOptions,
        expectedHead: f.store.status().head,
      });
    assert.deepEqual(verified.cases, f.store.status().cases);
    assert.equal(verified.verification.headPinned, true);
    assert.equal(verified.verification.originalDeviceEvidenceReverified, false);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.deepEqual(fs.readFileSync(lock), lockBefore);
    assert.throws(
      () =>
        IncidentCases.verifyJournal(before, {
          ...f.publicOptions,
          signerPublicKey: f.writer.privateKey,
        }),
      /JOURNAL_PUBLIC_KEY_REQUIRED/,
    );
    assert.throws(
      () =>
        IncidentCases.verifyJournal(before, {
          ...f.publicOptions,
          signerPrivateKey: f.writer.privateKey,
        }),
      /CASES_OPTION_UNSUPPORTED/,
    );
  } finally {
    f.cleanup();
  }
});
test("tampering, partial tail, wrong signing key/scope and valid-prefix truncation fail", () => {
  const f = fixture();
  try {
    const id = f.ingest();
    f.store.assign(id, {
      actorId: "admin",
      expectedRevision: 1,
      assigneeId: "analyst",
    });
    const content = fs.readFileSync(f.store.journal.logPath, "utf8"),
      head = f.store.status().head;
    for (const bad of [
      content + "{}",
      content.replace('"actorId":"ingest"', '"actorId":"attacker"'),
    ])
      assert.throws(() => IncidentCases.verifyJournal(bad, f.publicOptions));
    assert.throws(() =>
      IncidentCases.verifyJournal(content, {
        ...f.publicOptions,
        signerPublicKey: crypto.generateKeyPairSync("ed25519").publicKey,
      }),
    );
    assert.throws(
      () =>
        IncidentCases.verifyJournal(content, {
          ...f.publicOptions,
          maxCases: 999,
        }),
      /JOURNAL_ACTION_INVALID/,
    );
    const prefix = content.split("\n")[0] + "\n";
    assert.throws(
      () =>
        IncidentCases.verifyJournal(prefix, {
          ...f.publicOptions,
          expectedHead: head,
        }),
      /JOURNAL_HEAD_MISMATCH/,
    );
    assert.equal(
      IncidentCases.verifyJournal(prefix, f.publicOptions).verification
        .headPinned,
      false,
    );
  } finally {
    f.cleanup();
  }
});
test("forged source, foreign org, rule version changes and capacity are checked", () => {
  const f = fixture({ maxCases: 1 });
  try {
    const bad = structuredClone(f.data);
    bad.records[2].eventEnvelope.payload.assessment.localScore = 99;
    assert.throws(() => f.store.ingest(bad, f.rules, { actorId: "ingest" }));
    assert.throws(
      () =>
        f.store.ingest(
          f.data,
          { ...f.rules, organizationId: crypto.randomUUID() },
          { actorId: "ingest" },
        ),
      /CASES_SCOPE_INVALID/,
    );
    f.ingest();
    assert.throws(
      () =>
        f.store.ingest(
          f.data,
          { ...f.rules, version: 2 },
          { actorId: "ingest" },
        ),
      /CASES_CAPACITY/,
    );
    assert.equal(f.store.status().cases.length, 1);
  } finally {
    f.cleanup();
  }
});
test("failed fsync does not confirm or mutate state; recovery verifies complete persisted action", () => {
  let fail = false;
  const f = fixture({
    io: {
      ...fs,
      fsyncSync(fd) {
        if (fail) throw new Error("offline");
        fs.fsyncSync(fd);
      },
    },
  });
  try {
    const id = f.ingest();
    fail = true;
    assert.throws(
      () =>
        f.store.assign(id, {
          actorId: "admin",
          expectedRevision: 1,
          assigneeId: "analyst",
        }),
      /JOURNAL_UNAVAILABLE/,
    );
    assert.throws(() => f.store.status(), /JOURNAL_UNAVAILABLE/);
    fail = false;
    f.restart();
    assert.equal(f.store.status().cases[0].revision, 2);
    assert.equal(f.store.status().cases[0].assigneeId, "analyst");
  } finally {
    f.cleanup();
  }
});
test("exclusive writer and journal capacity preserve existing cases", () => {
  const f = fixture({ maxActions: 1 });
  try {
    const id = f.ingest();
    assert.throws(() => new IncidentCases(f.options), /JOURNAL_WRITER_LOCKED/);
    assert.throws(
      () =>
        f.store.assign(id, {
          actorId: "admin",
          expectedRevision: 1,
          assigneeId: null,
        }),
      /JOURNAL_CAPACITY/,
    );
    assert.equal(f.store.status().cases[0].revision, 1);
    assert.equal(
      f.store.ingest(f.data, f.rules, { actorId: "ingest" })[0].duplicate,
      true,
    );
  } finally {
    f.cleanup();
  }
});
test("CLI reader requires only public config and can verify while writer is locked", () => {
  const { spawnSync } = require("node:child_process");
  const f = fixture();
  try {
    f.ingest();
    const file = (name) => path.join(f.base, name);
    fs.writeFileSync(
      file("writer-public.pem"),
      f.writer.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("server-public.pem"),
      f.publicOptions.trust.serverPublicKey.export({
        type: "spki",
        format: "pem",
      }),
    );
    fs.writeFileSync(
      file("registry.json"),
      JSON.stringify({ registrations: f.publicOptions.trust.registrations }),
    );
    const config = {
      schemaVersion: 1,
      organizationId: f.options.organizationId,
      signerKeyId: "cases",
      signerPublicKeyFile: file("writer-public.pem"),
      serverKeyId: "server",
      serverPublicKeyFile: file("server-public.pem"),
      registryFile: file("registry.json"),
      maxCases: 1000,
    };
    fs.writeFileSync(file("config.json"), JSON.stringify(config));
    const argv = [
        "enterprise/incident_cases_cli.cjs",
        "verify",
        "--journal",
        f.store.journal.logPath,
        "--config",
        file("config.json"),
        "--out",
        file("report.json"),
      ],
      run = (extra) =>
        spawnSync(process.execPath, [...argv, ...extra], { encoding: "utf8" });
    assert.equal(run([]).status, 0);
    assert.equal(
      JSON.parse(fs.readFileSync(file("report.json"))).cases[0].status,
      "NEW",
    );
    assert.equal(fs.statSync(file("report.json")).mode & 0o077, 0);
    assert.notEqual(run([]).status, 0);
    assert.notEqual(run(["--private-key", "SECRET"]).status, 0);
    fs.unlinkSync(file("report.json"));
    const review = spawnSync(
      process.execPath,
      [
        ...argv.map((arg) => (arg === "verify" ? "review" : arg)),
        "--lang",
        "de",
      ],
      { encoding: "utf8" },
    );
    assert.equal(review.status, 0, review.stderr);
    assert.ok(
      fs.readFileSync(file("report.json"), "utf8").includes("Fallübersicht"),
    );
    fs.unlinkSync(file("report.json"));
    fs.writeFileSync(
      file("config.json"),
      JSON.stringify({ ...config, privateKey: "SECRET" }),
    );
    const denied = run([]);
    assert.notEqual(denied.status, 0);
    assert.ok(!denied.stderr.includes("SECRET"));
  } finally {
    f.cleanup();
  }
});
test("CLI writer verifies its public key and revision before changing a case", () => {
  const { spawnSync } = require("node:child_process");
  const f = fixture();
  try {
    const caseId = f.ingest();
    f.store.close();
    const file = (name) => path.join(f.base, name);
    fs.writeFileSync(
      file("private.pem"),
      f.writer.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      file("writer.pem"),
      f.writer.publicKey.export({ type: "spki", format: "pem" }),
    );
    fs.writeFileSync(
      file("server.pem"),
      f.publicOptions.trust.serverPublicKey.export({
        type: "spki",
        format: "pem",
      }),
    );
    fs.writeFileSync(
      file("registry.json"),
      JSON.stringify({ registrations: f.publicOptions.trust.registrations }),
    );
    fs.writeFileSync(
      file("config.json"),
      JSON.stringify({
        schemaVersion: 1,
        organizationId: f.options.organizationId,
        signerKeyId: "cases",
        signerPublicKeyFile: file("writer.pem"),
        serverKeyId: "server",
        serverPublicKeyFile: file("server.pem"),
        registryFile: file("registry.json"),
        maxCases: 1000,
      }),
    );
    const run = (revision = "1") =>
      spawnSync(
        process.execPath,
        [
          "enterprise/incident_cases_cli.cjs",
          "ack",
          "--directory",
          f.options.directory,
          "--config",
          file("config.json"),
          "--private-key",
          file("private.pem"),
          "--actor-id",
          "analyst",
          "--case-id",
          caseId,
          "--expected-revision",
          revision,
        ],
        { encoding: "utf8" },
      );
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).revision, 2);
    assert.notEqual(run().status, 0);
    assert.notEqual(run("2.0").status, 0);
    const wrong = crypto.generateKeyPairSync("ed25519");
    fs.writeFileSync(
      file("private.pem"),
      wrong.privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    assert.ok(run("2").stderr.includes("CASES_WRITER_KEY_MISMATCH"));
    const verified = IncidentCases.verifyJournal(
      fs.readFileSync(path.join(f.options.directory, "actions.jsonl")),
      f.publicOptions,
    );
    assert.equal(verified.cases[0].status, "ACKNOWLEDGED");
    assert.equal(verified.cases[0].history[1].actorId, "analyst");
  } finally {
    f.cleanup();
  }
});
